import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { DayFile, ProposedEntry, Snapshot } from './types.ts';
import type { Catalog } from './catalog.ts';
import { emptyCatalog } from './catalog.ts';
import type { Correction, MatchContext } from './matcher.ts';
import { learnKeys } from './matcher.ts';
import { ensureDirs, paths, readJson, writeJsonAtomic } from './paths.ts';
import { buildEntries, segment } from './segmenter.ts';
import { log } from './log.ts';

/** Local calendar date — the timesheet follows the wall clock, not UTC. */
export function localDate(ts: number = Date.now()): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function appendSnapshot(snapshot: Snapshot): void {
  ensureDirs();
  fs.appendFileSync(paths.snapshots(localDate(snapshot.ts)), `${JSON.stringify(snapshot)}\n`, { mode: 0o600 });
}

export function readSnapshots(date: string): Snapshot[] {
  let raw: string;
  try {
    raw = fs.readFileSync(paths.snapshots(date), 'utf8');
  } catch {
    return [];
  }
  const snapshots: Snapshot[] = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try {
      snapshots.push(JSON.parse(line) as Snapshot);
    } catch {
      log.warn('Skipping unparseable snapshot line');
    }
  }
  return snapshots;
}

export function loadDay(date: string): DayFile {
  return readJson<DayFile>(paths.entries(date)) ?? { date, updatedAt: 0, entries: [] };
}

export function saveDay(day: DayFile): void {
  ensureDirs();
  writeJsonAtomic(paths.entries(day.date), { ...day, updatedAt: Date.now() });
}

/**
 * Entries you have already touched are frozen: their time is carved out of the
 * day before re-segmentation, so a rebuild can never undo an approval or a
 * hand-picked task.
 */
function isLocked(entry: ProposedEntry): boolean {
  return entry.status !== 'pending' || entry.corrected === true || entry.manual === true;
}

/**
 * A deleted entry is kept as a tombstone rather than removed. Its time range
 * still carves the underlying snapshots out of a rebuild, which is what stops
 * the same wrong entry reappearing ten minutes later.
 */
export function deleteEntry(date: string, id: string): ProposedEntry | null {
  const day = loadDay(date);
  const entry = day.entries.find((e) => e.id === id);
  if (!entry) return null;
  if (entry.status === 'synced') return null;
  entry.status = 'deleted';
  saveDay(day);
  return entry;
}

/** Undo a deletion while the day is still open. */
export function restoreEntry(date: string, id: string): ProposedEntry | null {
  const day = loadDay(date);
  const entry = day.entries.find((e) => e.id === id);
  if (!entry || entry.status !== 'deleted') return null;
  entry.status = 'pending';
  saveDay(day);
  return entry;
}

export function rebuildDay(date: string, ctx: MatchContext): DayFile {
  const existing = loadDay(date);
  const locked = existing.entries.filter(isLocked);
  const lockedRanges = locked.map((e) => [e.start, e.end] as const);

  const snapshots = readSnapshots(date).filter(
    (s) => !lockedRanges.some(([start, end]) => s.ts >= start && s.ts < end),
  );

  const blocks = segment(snapshots, ctx.config);
  const fresh = buildEntries(blocks, ctx, date);

  // A rebuild can regenerate an id that a locked entry already owns.
  const lockedIds = new Set(locked.map((e) => e.id));
  const entries = [...locked, ...fresh.filter((e) => !lockedIds.has(e.id))]
    .sort((a, b) => a.start - b.start);

  const day: DayFile = { date, updatedAt: Date.now(), entries };
  saveDay(day);
  return day;
}

/* --------------------------------------------------------- manual entries -- */

/**
 * A quick-log entry: a block of time entered by a button press rather than
 * observed activity. It arrives pre-approved (the click *is* the review) and
 * ends now, on the theory that people log a meeting right after standing up
 * from it. Its time range carves the underlying snapshots out of rebuilds, so
 * a meeting logged over ambient activity never double-counts.
 */
export function addManualEntry(
  date: string,
  options: {
    /** Null for a blank entry the person will pick a task for. */
    taskId: string | null;
    taskName: string | null;
    listName: string | null;
    folderName: string | null;
    spaceName: string | null;
    label: string;
    minutes: number;
    billable: boolean;
    /** Explicit block start. Omitted means "ending now", as quick-log does. */
    start?: number;
    /** Pre-approved (a quick-log click is its own review) or left pending. */
    approved?: boolean;
    /** Injectable for tests. */
    now?: number;
  },
): ProposedEntry {
  const now = options.now ?? Date.now();
  const durationMs = Math.max(1, Math.round(options.minutes)) * 60_000;
  const start = options.start ?? now - durationMs;
  const entry: ProposedEntry = {
    id: crypto.createHash('sha1')
      .update(`manual:${date}:${now}:${start}:${options.taskId ?? 'blank'}`)
      .digest('hex').slice(0, 12),
    date,
    start,
    end: start + durationMs,
    activeMs: durationMs,
    durationMs,
    blockIds: [],
    evidence: { apps: ['Quick log'], paths: [], titles: [options.label], urls: [] },
    suggestion: {
      taskId: options.taskId,
      taskName: options.taskName,
      listId: null,
      listName: options.listName,
      folderName: options.folderName,
      spaceName: options.spaceName,
      confidence: options.taskId ? 1 : 0,
      reasons: options.taskId
        ? [`logged with the "${options.label}" button`]
        : ['added by hand — pick the task'],
      alternatives: [],
      billable: options.billable,
    },
    // A blank entry cannot be approved until a task is chosen.
    status: options.approved && options.taskId ? 'approved' : 'pending',
    taskId: options.taskId,
    description: options.label,
    billable: options.billable,
    manual: true,
  };

  const day = loadDay(date);
  day.entries = [...day.entries, entry].sort((a, b) => a.start - b.start);
  saveDay(day);
  return entry;
}

/* ----------------------------------------------------------- corrections -- */

/**
 * Remember that this activity belonged to this task, so the next file in the
 * same job folder gets suggested correctly without a rule being written.
 */
export function recordCorrection(entry: ProposedEntry, taskId: string): void {
  ensureDirs();
  const keys = learnKeys({
    paths: entry.evidence.paths,
    urls: entry.evidence.urls,
    bundleId: entry.evidence.apps[0] ?? '',
  });
  const ts = Date.now();
  const lines = keys
    // The app-level key is too blunt to learn from a single correction.
    .filter((key) => !key.startsWith('app:'))
    .map((key) => `${JSON.stringify({ key, taskId, ts } satisfies Correction)}\n`)
    .join('');
  if (lines) fs.appendFileSync(paths.corrections(), lines, { mode: 0o600 });
}

export function loadCorrections(): Correction[] {
  let raw: string;
  try {
    raw = fs.readFileSync(paths.corrections(), 'utf8');
  } catch {
    return [];
  }
  const out: Correction[] = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line) as Correction);
    } catch {
      /* skip */
    }
  }
  return out;
}

/* --------------------------------------------------------------- catalog -- */

export function loadCatalog(workspaceId = ''): Catalog {
  return readJson<Catalog>(paths.catalog()) ?? emptyCatalog(workspaceId);
}

export function saveCatalog(catalog: Catalog): void {
  ensureDirs();
  writeJsonAtomic(paths.catalog(), catalog);
}

/* --------------------------------------------------------------- hygiene -- */

/** Raw snapshots are the most sensitive thing on disk; don't keep them forever. */
export function pruneSnapshots(retainDays: number): number {
  if (retainDays <= 0) return 0;
  const cutoff = Date.now() - retainDays * 86_400_000;
  let removed = 0;
  let files: string[];
  try {
    files = fs.readdirSync(paths.days());
  } catch {
    return 0;
  }
  for (const file of files) {
    if (!file.endsWith('.snapshots.ndjson')) continue;
    const date = file.replace('.snapshots.ndjson', '');
    const parsed = Date.parse(`${date}T23:59:59`);
    if (Number.isNaN(parsed) || parsed >= cutoff) continue;
    try {
      fs.unlinkSync(path.join(paths.days(), file));
      removed++;
    } catch {
      /* ignore */
    }
  }
  return removed;
}

export function listDays(): string[] {
  try {
    return fs
      .readdirSync(paths.days())
      .filter((f) => f.endsWith('.entries.json'))
      .map((f) => f.replace('.entries.json', ''))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}
