import path from 'node:path';
import type { ActivityBlock, Config, Rule, Suggestion, TaskRef } from './types.ts';
import type { Catalog, FolderRef, ListRef } from './catalog.ts';
import { buildIdf, normalizeName, overlapScore, pathHasSegment, tokenize, uniq } from './text.ts';
import { expandHome } from './paths.ts';
import { compileRegex } from './regex.ts';

/* ------------------------------------------------------------- scoring ---- */

/**
 * Score contributions, on a scale where ~100 means "certain". These are the
 * dials worth turning if suggestions feel off; they are deliberately coarse.
 */
const WEIGHT = {
  /** A ClickUp task URL open in the browser, or a task id in a rule. */
  directTask: 100,
  /** You corrected a previous entry with the same file directory. */
  learnedExactDir: 85,
  learnedParentDir: 55,
  learnedApp: 15,
  /** A configured project root told us the client name. */
  projectRootClient: 60,
  /** A ClickUp folder/list name appears verbatim as a path segment. */
  folderInPath: 45,
  listInPath: 40,
  /** A ClickUp folder name appears in the window title (Slack channel, mail subject). */
  folderInTitle: 22,
  /** Maximum contribution from task-name token overlap. */
  taskNameOverlap: 40,
  /** Default weight for a rule that does not set one. */
  ruleDefault: 50,
} as const;

/** Below this, the UI shows the entry as "needs a decision" rather than a guess. */
export const LOW_CONFIDENCE = 0.45;

/* ------------------------------------------------------------ learning ---- */

export interface Correction {
  key: string;
  taskId: string;
  ts: number;
}

export type CorrectionIndex = Map<string, { taskId: string; count: number; ts: number }>;

/** Keep the most-used task per key, breaking ties on recency. */
export function indexCorrections(corrections: Correction[]): CorrectionIndex {
  const tally = new Map<string, Map<string, { count: number; ts: number }>>();
  for (const c of corrections) {
    if (!c?.key || !c?.taskId) continue;
    const perKey = tally.get(c.key) ?? new Map();
    const prev = perKey.get(c.taskId) ?? { count: 0, ts: 0 };
    perKey.set(c.taskId, { count: prev.count + 1, ts: Math.max(prev.ts, c.ts ?? 0) });
    tally.set(c.key, perKey);
  }
  const index: CorrectionIndex = new Map();
  for (const [key, perKey] of tally) {
    let best: { taskId: string; count: number; ts: number } | null = null;
    for (const [taskId, stat] of perKey) {
      if (!best || stat.count > best.count || (stat.count === best.count && stat.ts > best.ts)) {
        best = { taskId, count: stat.count, ts: stat.ts };
      }
    }
    if (best) index.set(key, best);
  }
  return index;
}

/**
 * The keys a block can be remembered by, most specific first. Correcting one
 * entry teaches every later file in the same job folder.
 */
export function learnKeys(block: Pick<ActivityBlock, 'paths' | 'urls' | 'bundleId'>): string[] {
  const keys: string[] = [];
  for (const p of block.paths) {
    const dir = path.dirname(p);
    keys.push(`dir:${dir}`);
    const parent = path.dirname(dir);
    if (parent && parent !== dir && parent !== '/') keys.push(`pdir:${parent}`);
  }
  for (const u of block.urls) {
    try {
      const parsed = new URL(u);
      keys.push(`url:${parsed.host}${parsed.pathname}`);
    } catch {
      /* not a parseable URL */
    }
  }
  keys.push(`app:${block.bundleId}`);
  return uniq(keys);
}

/* -------------------------------------------------------------- context --- */

export interface MatchContext {
  config: Config;
  rules: Rule[];
  catalog: Catalog;
  corrections: CorrectionIndex;
  taskTokens: Map<string, string[]>;
  idf: Map<string, number>;
  tasksById: Map<string, TaskRef>;
  listsById: Map<string, ListRef>;
  listsByFolderId: Map<string, ListRef[]>;
  listsBySpaceId: Map<string, ListRef[]>;
  tasksByListId: Map<string, TaskRef[]>;
  foldersByNorm: Map<string, FolderRef>;
  listsByNorm: Map<string, ListRef>;
  spaceIdByNorm: Map<string, string>;
  aliasByNorm: Map<string, string>;
}

export function buildContext(
  config: Config,
  rules: Rule[],
  catalog: Catalog,
  corrections: Correction[] = [],
): MatchContext {
  const taskTokens = new Map<string, string[]>();
  for (const task of catalog.tasks) taskTokens.set(task.taskId, tokenize(task.taskName));
  const idf = buildIdf([...taskTokens.values()]);

  const tasksById = new Map(catalog.tasks.map((t) => [t.taskId, t]));
  const listsById = new Map(catalog.lists.map((l) => [l.id, l]));

  const listsByFolderId = new Map<string, ListRef[]>();
  const listsBySpaceId = new Map<string, ListRef[]>();
  for (const list of catalog.lists) {
    if (list.folderId) {
      listsByFolderId.set(list.folderId, [...(listsByFolderId.get(list.folderId) ?? []), list]);
    }
    listsBySpaceId.set(list.spaceId, [...(listsBySpaceId.get(list.spaceId) ?? []), list]);
  }

  const tasksByListId = new Map<string, TaskRef[]>();
  for (const task of catalog.tasks) {
    tasksByListId.set(task.listId, [...(tasksByListId.get(task.listId) ?? []), task]);
  }

  const foldersByNorm = new Map(catalog.folders.map((f) => [normalizeName(f.name), f]));
  const listsByNorm = new Map(catalog.lists.map((l) => [normalizeName(l.name), l]));
  const spaceIdByNorm = new Map(catalog.spaces.map((s) => [normalizeName(s.name), s.id]));
  const aliasByNorm = new Map(
    Object.entries(config.clientAliases).map(([from, to]) => [normalizeName(from), to]),
  );

  return {
    config, rules, catalog,
    corrections: indexCorrections(corrections),
    taskTokens, idf, tasksById, listsById,
    listsByFolderId, listsBySpaceId, tasksByListId,
    foldersByNorm, listsByNorm, spaceIdByNorm, aliasByNorm,
  };
}

/* ---------------------------------------------------------------- rules --- */

interface RuleHit {
  rule: Rule;
  captures: Record<string, string>;
}

function testPattern(pattern: string | undefined, values: string[]): RegExpMatchArray | null {
  if (!pattern) return null;
  const regex = compileRegex(pattern);
  if (!regex) return null;
  for (const value of values) {
    const match = value.match(regex);
    if (match) return match;
  }
  return null;
}

/** A rule fires only when every clause it declares matches something in the block. */
export function evaluateRules(block: ActivityBlock, rules: Rule[]): RuleHit[] {
  const hits: RuleHit[] = [];
  for (const rule of rules) {
    const captures: Record<string, string> = {};
    let declared = 0;
    let satisfied = 0;

    const clauses: Array<[string | undefined, string[]]> = [
      [rule.when.appRegex, [block.app]],
      [rule.when.titleRegex, block.titles],
      [rule.when.pathRegex, block.paths],
      [rule.when.urlRegex, block.urls],
    ];
    for (const [pattern, values] of clauses) {
      if (!pattern) continue;
      declared++;
      const match = testPattern(pattern, values);
      if (match) {
        satisfied++;
        Object.assign(captures, match.groups ?? {});
      }
    }
    if (rule.when.bundleId !== undefined) {
      declared++;
      if (rule.when.bundleId === block.bundleId) satisfied++;
    }
    if (rule.when.pathContains !== undefined) {
      declared++;
      const needle = rule.when.pathContains.toLowerCase();
      if (block.paths.some((p) => p.toLowerCase().includes(needle))) satisfied++;
    }

    if (declared > 0 && declared === satisfied) hits.push({ rule, captures });
  }
  return hits;
}

/* ------------------------------------------------------- path inference --- */

/**
 * Read the client name straight out of the file path using the configured
 * project roots — this is the "tied to server structure" path.
 */
export function clientFromProjectRoots(filePath: string, config: Config): string | null {
  for (const root of config.projectRoots) {
    const base = expandHome(root.path).replace(/\/+$/, '');
    if (!filePath.startsWith(`${base}/`)) continue;
    const segments = filePath.slice(base.length + 1).split('/').filter(Boolean);
    const segment = segments[root.clientSegment];
    if (segment) return segment;
  }
  return null;
}

function resolveClientToFolder(name: string, ctx: MatchContext): FolderRef | null {
  const alias = ctx.aliasByNorm.get(normalizeName(name));
  const target = normalizeName(alias ?? name);
  const exact = ctx.foldersByNorm.get(target);
  if (exact) return exact;
  // ClickUp folders carry suffixes like "(Inactive)" or " - B2B2C"; allow a
  // prefix match so "Resmed" still lands on "Resmed" rather than nothing.
  for (const [norm, folder] of ctx.foldersByNorm) {
    if (norm.startsWith(target) && target.length >= 3) return folder;
  }
  return null;
}

/* --------------------------------------------------------------- match ---- */

interface ScopeHint {
  listIds: string[];
  weight: number;
  reason: string;
  folderName?: string;
  spaceName?: string;
}

function listIdsForFolder(folder: FolderRef, ctx: MatchContext): string[] {
  return (ctx.listsByFolderId.get(folder.id) ?? []).map((l) => l.id);
}

function collectScopeHints(block: ActivityBlock, hits: RuleHit[], ctx: MatchContext): ScopeHint[] {
  const hints: ScopeHint[] = [];

  for (const { rule, captures } of hits) {
    const weight = rule.weight ?? WEIGHT.ruleDefault;
    const folderName = rule.then.folder ?? (rule.then.folderFrom ? captures[rule.then.folderFrom] : undefined);
    if (folderName) {
      const folder = resolveClientToFolder(folderName, ctx);
      if (folder) {
        hints.push({
          listIds: listIdsForFolder(folder, ctx),
          weight,
          reason: `rule "${rule.name}" → client ${folder.name}`,
          folderName: folder.name,
          spaceName: folder.spaceName,
        });
      }
    }
    if (rule.then.list) {
      const list = ctx.listsByNorm.get(normalizeName(rule.then.list));
      if (list) {
        hints.push({
          listIds: [list.id],
          weight,
          reason: `rule "${rule.name}" → list ${list.name}`,
          folderName: list.folderName ?? undefined,
          spaceName: list.spaceName,
        });
      }
    }
    if (rule.then.space) {
      const spaceId = ctx.spaceIdByNorm.get(normalizeName(rule.then.space));
      if (spaceId) {
        hints.push({
          listIds: (ctx.listsBySpaceId.get(spaceId) ?? []).map((l) => l.id),
          weight,
          reason: `rule "${rule.name}" → space ${rule.then.space}`,
          spaceName: rule.then.space,
        });
      }
    }
  }

  for (const filePath of block.paths) {
    const client = clientFromProjectRoots(filePath, ctx.config);
    if (client) {
      const folder = resolveClientToFolder(client, ctx);
      if (folder) {
        hints.push({
          listIds: listIdsForFolder(folder, ctx),
          weight: WEIGHT.projectRootClient,
          reason: `project root: client folder "${client}" → ${folder.name}`,
          folderName: folder.name,
          spaceName: folder.spaceName,
        });
      }
    }
    // Fallback that needs no configuration: any ClickUp folder or list name
    // sitting in the path is a strong hint on its own.
    for (const folder of ctx.catalog.folders) {
      if (pathHasSegment(filePath, folder.name)) {
        hints.push({
          listIds: listIdsForFolder(folder, ctx),
          weight: WEIGHT.folderInPath,
          reason: `path contains client folder "${folder.name}"`,
          folderName: folder.name,
          spaceName: folder.spaceName,
        });
      }
    }
    for (const list of ctx.catalog.lists) {
      if (pathHasSegment(filePath, list.name)) {
        hints.push({
          listIds: [list.id],
          weight: WEIGHT.listInPath,
          reason: `path contains list "${list.name}"`,
          folderName: list.folderName ?? undefined,
          spaceName: list.spaceName,
        });
      }
    }
  }

  for (const title of block.titles) {
    const normTitle = normalizeName(title);
    for (const folder of ctx.catalog.folders) {
      const norm = normalizeName(folder.name);
      if (norm.length >= 3 && normTitle.includes(norm)) {
        hints.push({
          listIds: listIdsForFolder(folder, ctx),
          weight: WEIGHT.folderInTitle,
          reason: `window title mentions "${folder.name}"`,
          folderName: folder.name,
          spaceName: folder.spaceName,
        });
      }
    }
  }

  return hints;
}

function queryTokensFor(block: ActivityBlock): string[] {
  const parts: string[] = [];
  for (const p of block.paths) parts.push(p);
  for (const t of block.titles) parts.push(t);
  for (const u of block.urls) parts.push(u);
  return uniq(parts.flatMap(tokenize));
}

function decideBillable(spaceName: string | null, hits: RuleHit[], config: Config): boolean {
  for (const { rule } of hits) {
    if (typeof rule.billable === 'boolean') return rule.billable;
  }
  if (spaceName && /non[\s-]?billable/i.test(spaceName)) return false;
  return config.clickup.defaultBillable;
}

function suggestionFromTask(task: TaskRef, confidence: number, reasons: string[], billable: boolean): Suggestion {
  return {
    taskId: task.taskId,
    taskName: task.taskName,
    listId: task.listId,
    listName: task.listName,
    folderName: task.folderName,
    spaceName: task.spaceName,
    confidence,
    reasons,
    alternatives: [],
    billable,
  };
}

export function emptySuggestion(reasons: string[] = []): Suggestion {
  return {
    taskId: null, taskName: null, listId: null, listName: null,
    folderName: null, spaceName: null, confidence: 0, reasons,
    alternatives: [], billable: null,
  };
}

/** Decide which ClickUp task a block of activity most likely belongs to. */
export function matchBlock(block: ActivityBlock, ctx: MatchContext): Suggestion {
  const hits = evaluateRules(block, ctx.rules);

  if (hits.some(({ rule }) => rule.ignore)) {
    const rule = hits.find((h) => h.rule.ignore)!.rule;
    return emptySuggestion([`ignored by rule "${rule.name}"`]);
  }

  // 1. A literal task id beats everything else.
  for (const { rule, captures } of hits) {
    const taskId = rule.then.taskId ?? (rule.then.taskIdFrom ? captures[rule.then.taskIdFrom] : undefined);
    if (!taskId) continue;
    const known = ctx.tasksById.get(taskId);
    const reason = `rule "${rule.name}" identified task ${taskId}`;
    if (known) {
      return suggestionFromTask(known, 0.97, [reason], decideBillable(known.spaceName, hits, ctx.config));
    }
    return {
      ...emptySuggestion([`${reason} (not in the cached catalog — refresh to confirm)`]),
      taskId,
      confidence: 0.8,
      billable: decideBillable(null, hits, ctx.config),
    };
  }

  // 2. Narrow to candidate lists.
  const hints = collectScopeHints(block, hits, ctx);
  const listWeight = new Map<string, number>();
  const listReason = new Map<string, string>();
  for (const hint of hints) {
    for (const listId of hint.listIds) {
      if ((listWeight.get(listId) ?? 0) < hint.weight) {
        listWeight.set(listId, hint.weight);
        listReason.set(listId, hint.reason);
      }
    }
  }

  // 3. Remembered corrections for this folder / URL / app.
  const learned = new Map<string, { weight: number; reason: string }>();
  const keys = learnKeys(block);
  for (const key of keys) {
    const hit = ctx.corrections.get(key);
    if (!hit) continue;
    const weight = key.startsWith('dir:')
      ? WEIGHT.learnedExactDir
      : key.startsWith('pdir:') || key.startsWith('url:')
        ? WEIGHT.learnedParentDir
        : WEIGHT.learnedApp;
    const existing = learned.get(hit.taskId);
    if (!existing || existing.weight < weight) {
      learned.set(hit.taskId, { weight, reason: `you previously logged ${key.replace(/^\w+:/, '')} here` });
    }
  }

  // 4. Score tasks.
  const query = queryTokensFor(block);
  const candidateTasks = listWeight.size > 0
    ? [...listWeight.keys()].flatMap((listId) => ctx.tasksByListId.get(listId) ?? [])
    : ctx.catalog.tasks;

  const scored: Array<{ task: TaskRef; score: number; reasons: string[] }> = [];
  const seen = new Set<string>();
  for (const task of [...candidateTasks, ...[...learned.keys()].flatMap((id) => {
    const t = ctx.tasksById.get(id);
    return t ? [t] : [];
  })]) {
    if (seen.has(task.taskId)) continue;
    seen.add(task.taskId);

    const reasons: string[] = [];
    let score = 0;

    const scopeWeight = listWeight.get(task.listId);
    if (scopeWeight !== undefined) {
      score += scopeWeight;
      const reason = listReason.get(task.listId);
      if (reason) reasons.push(reason);
    }

    const learnHit = learned.get(task.taskId);
    if (learnHit) {
      score += learnHit.weight;
      reasons.push(learnHit.reason);
    }

    const overlap = overlapScore(query, ctx.taskTokens.get(task.taskId) ?? [], ctx.idf);
    if (overlap > 0) {
      score += overlap * WEIGHT.taskNameOverlap;
      reasons.push(`task name matches the file (${Math.round(overlap * 100)}%)`);
    }

    if (score > 0) scored.push({ task, score, reasons });
  }

  scored.sort((a, b) => b.score - a.score || a.task.taskName.localeCompare(b.task.taskName));

  const best = scored[0];
  if (!best) {
    // We may still know the client even without a task worth suggesting.
    const bestHint = hints.slice().sort((a, b) => b.weight - a.weight)[0];
    if (bestHint) {
      const list = bestHint.listIds.length === 1 ? ctx.listsById.get(bestHint.listIds[0]!) : undefined;
      return {
        ...emptySuggestion([bestHint.reason, 'no task in that list matched — pick one']),
        listId: list?.id ?? null,
        listName: list?.name ?? null,
        folderName: bestHint.folderName ?? null,
        spaceName: bestHint.spaceName ?? null,
        confidence: 0.2,
        billable: decideBillable(bestHint.spaceName ?? null, hits, ctx.config),
      };
    }
    return emptySuggestion(['no rule, path or task name matched this activity']);
  }

  let confidence = Math.min(best.score / 100, 0.95);
  const runnerUp = scored[1];
  if (runnerUp && best.score > 0 && runnerUp.score / best.score > 0.9) {
    // Two tasks look equally plausible — say so rather than picking a coin flip.
    confidence *= 0.7;
  }

  const suggestion = suggestionFromTask(
    best.task,
    Number(confidence.toFixed(3)),
    best.reasons,
    decideBillable(best.task.spaceName, hits, ctx.config),
  );
  suggestion.alternatives = scored.slice(1, 5).map((s) => ({
    taskId: s.task.taskId,
    taskName: s.task.taskName,
    listName: s.task.listName,
    score: Number((s.score / 100).toFixed(3)),
  }));
  return suggestion;
}
