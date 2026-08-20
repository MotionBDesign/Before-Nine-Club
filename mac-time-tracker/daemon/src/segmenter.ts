import crypto from 'node:crypto';
import path from 'node:path';
import type { ActivityBlock, Config, ProposedEntry, Snapshot } from './types.ts';
import { matchBlock, type MatchContext } from './matcher.ts';
import { uniq } from './text.ts';
import { compileAll } from './regex.ts';
import { log } from './log.ts';

const MAX_EVIDENCE = 12;

function compileIgnorePatterns(patterns: string[]): RegExp[] {
  // A bad pattern shouldn't stop the day being built, but it should be loud.
  return compileAll(patterns, (pattern) => log.warn('Ignoring unparseable ignore pattern', pattern));
}

/**
 * Inside the configured working window. Hours wrap sensibly if someone sets an
 * overnight window (22 to 06); a start equal to the end means "no bound".
 */
export function withinWorkingHours(ts: number, startHour: number, endHour: number): boolean {
  if (startHour === endHour) return true;
  const hour = new Date(ts).getHours() + new Date(ts).getMinutes() / 60;
  return startHour < endHour
    ? hour >= startHour && hour < endHour
    : hour >= startHour || hour < endHour;
}

/** Screen locked, idle past the threshold, outside hours, or explicitly ignored. */
function isCountable(snapshot: Snapshot, config: Config, ignoreTitles: RegExp[], ignorePaths: RegExp[]): boolean {
  if (snapshot.locked) return false;
  if (!withinWorkingHours(snapshot.ts, config.capture.dayStartHour, config.capture.dayEndHour)) return false;
  if (snapshot.idleSeconds >= config.capture.idleThresholdSeconds) return false;
  if (config.ignore.bundleIds.includes(snapshot.bundleId)) return false;
  if (snapshot.title && ignoreTitles.some((r) => r.test(snapshot.title!))) return false;
  if (snapshot.documentPath && ignorePaths.some((r) => r.test(snapshot.documentPath!))) return false;
  return true;
}

/**
 * The identity of a working context. Window titles churn constantly (progress
 * bars, unread counts) so they are deliberately not part of the key — the open
 * document, or the page, is what actually defines "what I'm working on".
 */
export function contextKey(snapshot: Snapshot): string {
  if (snapshot.documentPath) return `${snapshot.bundleId}|file:${snapshot.documentPath}`;
  if (snapshot.url) {
    try {
      const parsed = new URL(snapshot.url);
      return `${snapshot.bundleId}|url:${parsed.host}${parsed.pathname}`;
    } catch {
      return `${snapshot.bundleId}|url:${snapshot.url}`;
    }
  }
  return snapshot.bundleId;
}

function blockId(start: number, end: number, key: string): string {
  return crypto.createHash('sha1').update(`${start}:${end}:${key}`).digest('hex').slice(0, 12);
}

/** Group a day's snapshots into contiguous runs of the same working context. */
export function segment(snapshots: Snapshot[], config: Config): ActivityBlock[] {
  const sampleMs = config.capture.sampleIntervalSeconds * 1000;
  // A gap larger than this means the daemon (or the Mac) was away, not that
  // you worked straight through — never bridge one.
  const maxGapMs = sampleMs * 3;
  const ignoreTitles = compileIgnorePatterns(config.ignore.titlePatterns);
  const ignorePaths = compileIgnorePatterns(config.ignore.pathPatterns);

  const ordered = [...snapshots].sort((a, b) => a.ts - b.ts);

  interface Draft {
    key: string; start: number; last: number; samples: number;
    app: string; bundleId: string; titles: string[]; paths: string[]; urls: string[];
  }
  const drafts: Draft[] = [];
  let current: Draft | null = null;

  for (const snapshot of ordered) {
    if (!isCountable(snapshot, config, ignoreTitles, ignorePaths)) {
      current = null;
      continue;
    }
    const key = contextKey(snapshot);
    if (!current || current.key !== key || snapshot.ts - current.last > maxGapMs) {
      current = {
        key, start: snapshot.ts, last: snapshot.ts, samples: 0,
        app: snapshot.app, bundleId: snapshot.bundleId, titles: [], paths: [], urls: [],
      };
      drafts.push(current);
    }
    current.last = snapshot.ts;
    current.samples += 1;
    if (snapshot.title) current.titles.push(snapshot.title);
    if (snapshot.documentPath) current.paths.push(snapshot.documentPath);
    if (snapshot.url) current.urls.push(snapshot.url);
  }

  const blocks: ActivityBlock[] = drafts.map((draft) => {
    const end = draft.last + sampleMs;
    return {
      id: blockId(draft.start, end, draft.key),
      start: draft.start,
      end,
      activeMs: Math.min(draft.samples * sampleMs, end - draft.start),
      app: draft.app,
      bundleId: draft.bundleId,
      titles: uniq(draft.titles).slice(0, MAX_EVIDENCE),
      paths: uniq(draft.paths).slice(0, MAX_EVIDENCE),
      urls: uniq(draft.urls).slice(0, MAX_EVIDENCE),
      samples: draft.samples,
    };
  });

  return absorbFragments(blocks, config.capture.minBlockSeconds * 1000);
}

/**
 * Drop blocks too short to be real work (a glance at Slack, a Finder detour)
 * and hand their time to the neighbouring block, so the day still adds up.
 */
export function absorbFragments(blocks: ActivityBlock[], minMs: number): ActivityBlock[] {
  if (blocks.length === 0) return [];
  const kept = blocks.filter((b) => b.activeMs >= minMs);
  if (kept.length === 0) {
    // Nothing cleared the bar; keep the single longest so the day isn't empty.
    const longest = blocks.reduce((a, b) => (b.activeMs > a.activeMs ? b : a));
    return [{ ...longest, activeMs: blocks.reduce((sum, b) => sum + b.activeMs, 0) }];
  }
  const result = kept.map((b) => ({ ...b }));
  for (const fragment of blocks) {
    if (fragment.activeMs >= minMs) continue;
    let nearest = result[0]!;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const candidate of result) {
      const distance = fragment.start >= candidate.end
        ? fragment.start - candidate.end
        : candidate.start >= fragment.end
          ? candidate.start - fragment.end
          : 0;
      // Ties go to the earlier block, i.e. what you were doing before the detour.
      if (distance < bestDistance) {
        bestDistance = distance;
        nearest = candidate;
      }
    }
    nearest.activeMs += fragment.activeMs;
  }
  return result;
}

/* --------------------------------------------------------------- entries -- */

function roundDuration(activeMs: number, config: Config): number {
  const minMs = config.capture.minEntryMinutes * 60_000;
  const stepMs = config.capture.roundToMinutes * 60_000;
  if (stepMs <= 0) return Math.max(activeMs, minMs);
  return Math.max(Math.round(activeMs / stepMs) * stepMs, minMs, stepMs);
}

function describe(blocks: ActivityBlock[]): string {
  const files = uniq(blocks.flatMap((b) => b.paths).map((p) => path.basename(p)));
  const apps = uniq(blocks.map((b) => b.app));
  if (files.length > 0) {
    const shown = files.slice(0, 3).join(', ');
    return files.length > 3 ? `${shown} +${files.length - 3} more` : shown;
  }
  const hosts = uniq(blocks.flatMap((b) => b.urls).flatMap((u) => {
    try { return [new URL(u).host]; } catch { return []; }
  }));
  if (hosts.length > 0) return `${apps.join(', ')} — ${hosts.slice(0, 3).join(', ')}`;
  return apps.join(', ');
}

function entryId(date: string, start: number, taskId: string | null): string {
  return crypto.createHash('sha1').update(`${date}:${start}:${taskId ?? 'none'}`).digest('hex').slice(0, 12);
}

/**
 * Match each block, then merge neighbours that landed on the same task and sit
 * within `mergeGapSeconds` of each other — one line per task, not per app switch.
 */
export function buildEntries(
  blocks: ActivityBlock[],
  ctx: MatchContext,
  date: string,
): ProposedEntry[] {
  const config = ctx.config;
  const mergeGapMs = config.capture.mergeGapSeconds * 1000;
  const ordered = [...blocks].sort((a, b) => a.start - b.start);

  interface Group { taskId: string | null; blocks: ActivityBlock[]; suggestion: ReturnType<typeof matchBlock> }
  const groups: Group[] = [];

  for (const block of ordered) {
    const suggestion = matchBlock(block, ctx);
    const previous = groups[groups.length - 1];
    const contiguous = previous
      ? block.start - previous.blocks[previous.blocks.length - 1]!.end <= mergeGapMs
      : false;
    // Only merge when both sides actually identified the same task; two nulls
    // are two unknowns, not the same piece of work.
    if (previous && contiguous && suggestion.taskId !== null && previous.taskId === suggestion.taskId) {
      previous.blocks.push(block);
      if (suggestion.confidence > previous.suggestion.confidence) previous.suggestion = suggestion;
    } else {
      groups.push({ taskId: suggestion.taskId, blocks: [block], suggestion });
    }
  }

  return groups.map((group) => {
    const start = Math.min(...group.blocks.map((b) => b.start));
    const end = Math.max(...group.blocks.map((b) => b.end));
    const activeMs = group.blocks.reduce((sum, b) => sum + b.activeMs, 0);
    return {
      id: entryId(date, start, group.taskId),
      date,
      start,
      end,
      activeMs,
      durationMs: roundDuration(activeMs, config),
      blockIds: group.blocks.map((b) => b.id),
      evidence: {
        apps: uniq(group.blocks.map((b) => b.app)),
        paths: uniq(group.blocks.flatMap((b) => b.paths)).slice(0, MAX_EVIDENCE),
        titles: uniq(group.blocks.flatMap((b) => b.titles)).slice(0, MAX_EVIDENCE),
        urls: uniq(group.blocks.flatMap((b) => b.urls)).slice(0, MAX_EVIDENCE),
      },
      suggestion: group.suggestion,
      status: 'pending',
      taskId: group.taskId,
      description: describe(group.blocks),
      billable: group.suggestion.billable ?? config.clickup.defaultBillable,
    };
  });
}
