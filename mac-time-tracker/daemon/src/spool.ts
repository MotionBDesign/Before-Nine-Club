import fs from 'node:fs';
import path from 'node:path';
import type { Config, Snapshot } from './types.ts';
import { sanitize, type ActivitySource } from './observer.ts';
import { paths, readJson, writeJsonAtomic } from './paths.ts';
import { log } from './log.ts';

/**
 * The installed observer is its own launch agent — that is what makes macOS
 * attribute the Accessibility permission to the observer binary instead of to
 * whatever process spawned it. It appends snapshots to a spool file; this
 * reader tails that file and hands complete lines to the daemon.
 *
 * Polling beats fs.watch here: it survives the file being replaced, needs no
 * platform-specific event handling, and a few seconds of latency costs nothing
 * when samples arrive every five seconds anyway.
 */
export interface SpoolHandle extends ActivitySource {
  /** Read whatever is pending right now. */
  drain(): number;
}

interface OffsetFile {
  file: string;
  offset: number;
}

function offsetPath(): string {
  return path.join(paths.cache(), 'spool.offset.json');
}

function loadOffset(file: string): number {
  const stored = readJson<OffsetFile>(offsetPath());
  return stored && stored.file === file ? stored.offset : 0;
}

function saveOffset(file: string, offset: number): void {
  writeJsonAtomic(offsetPath(), { file, offset } satisfies OffsetFile);
}

function looksLikeSnapshot(value: unknown): value is Snapshot {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.ts === 'number' && typeof v.bundleId === 'string' && typeof v.idleSeconds === 'number';
}

/** Roughly a fortnight of samples; far past this the daemon is not running. */
const DEFAULT_MAX_SPOOL_BYTES = 64 * 1024 * 1024;

/**
 * The most one poll will read. Catching up after an outage otherwise means
 * allocating the whole backlog as a Buffer *and* as a string at once — tens of
 * megabytes in a process that normally sits in single digits. Polling again in
 * a few seconds costs nothing and keeps the ceiling flat.
 */
const MAX_READ_PER_DRAIN = 4 * 1024 * 1024;

export function startSpoolReader(
  file: string,
  config: Config,
  onSnapshot: (snapshot: Snapshot) => void,
  pollMs = 5000,
  maxBytes = DEFAULT_MAX_SPOOL_BYTES,
): SpoolHandle {
  let offset = loadOffset(file);
  /** A line the observer was still writing when we read; completed next poll. */
  let partial = '';
  let missingWarned = false;

  function drain(): number {
    let stat: fs.Stats;
    try {
      stat = fs.statSync(file);
    } catch {
      if (!missingWarned) {
        missingWarned = true;
        log.warn(`Observer spool ${file} does not exist yet. Is the observer agent running?`);
      }
      return 0;
    }
    missingWarned = false;

    // If the daemon has been down, the observer keeps appending. Without a cap
    // a long outage would fill the disk; past it we keep only the recent tail.
    if (stat.size > maxBytes) {
      log.error(
        `Observer spool reached ${Math.round(stat.size / 1e6)}MB — the daemon was probably down. ` +
        'Discarding all but the most recent activity.',
      );
      try {
        const keep = Math.floor(maxBytes / 2);
        const handle = fs.openSync(file, 'r');
        const buffer = Buffer.alloc(keep);
        const read = fs.readSync(handle, buffer, 0, keep, stat.size - keep);
        fs.closeSync(handle);
        // Start at the first clean line boundary in the kept tail.
        const text = buffer.subarray(0, read).toString('utf8');
        const firstBreak = text.indexOf('\n');
        fs.writeFileSync(file, firstBreak === -1 ? '' : text.slice(firstBreak + 1), { mode: 0o600 });
      } catch (error) {
        log.error('Could not trim the spool; truncating it', String(error));
        try { fs.truncateSync(file, 0); } catch { /* nothing else to try */ }
      }
      offset = 0;
      partial = '';
      saveOffset(file, 0);
      return 0;
    }

    if (stat.size < offset) {
      // Truncated or replaced — start again from the top.
      log.info('Observer spool was reset; reading from the start.');
      offset = 0;
      partial = '';
    }
    if (stat.size === offset) return 0;

    let chunk: string;
    let handle: number | undefined;
    try {
      handle = fs.openSync(file, 'r');
      const length = Math.min(stat.size - offset, MAX_READ_PER_DRAIN);
      const buffer = Buffer.alloc(length);
      const read = fs.readSync(handle, buffer, 0, length, offset);
      chunk = buffer.subarray(0, read).toString('utf8');
      offset += read;
    } catch (error) {
      log.error('Failed to read the observer spool', String(error));
      return 0;
    } finally {
      if (handle !== undefined) fs.closeSync(handle);
    }

    const text = partial + chunk;
    const lastBreak = text.lastIndexOf('\n');
    if (lastBreak === -1) {
      // No newline in a whole read: either the observer is mid-line (a few
      // hundred bytes, normal) or something is writing a line that will never
      // end. Holding on to the latter would grow without limit.
      if (text.length > MAX_READ_PER_DRAIN) {
        log.error('Observer spool line exceeded the read limit; discarding it.');
        partial = '';
        return 0;
      }
      partial = text;
      return 0;
    }
    partial = text.slice(lastBreak + 1);

    let delivered = 0;
    for (const line of text.slice(0, lastBreak).split('\n')) {
      if (!line.trim()) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        log.warn('Skipping unparseable spool line', line.slice(0, 200));
        continue;
      }
      if (!looksLikeSnapshot(parsed)) {
        const record = parsed as Record<string, unknown>;
        if (typeof record.error === 'string') log.error(`Observer: ${record.error}`);
        continue;
      }
      onSnapshot(sanitize(parsed, config));
      delivered++;
    }
    saveOffset(file, offset);
    return delivered;
  }

  function rotate(): boolean {
    // Only safe when nothing is half-read; otherwise we would drop a sample.
    if (partial !== '') return false;
    try {
      const stat = fs.statSync(file);
      if (stat.size !== offset) return false;
      fs.truncateSync(file, 0);
      offset = 0;
      saveOffset(file, 0);
      log.info('Rotated the observer spool.');
      return true;
    } catch {
      return false;
    }
  }

  const timer = setInterval(drain, pollMs);
  drain();

  return {
    stop(): void {
      clearInterval(timer);
      drain();
    },
    drain,
    rotate,
  };
}
