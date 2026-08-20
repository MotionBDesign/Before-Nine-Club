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

export function startSpoolReader(
  file: string,
  config: Config,
  onSnapshot: (snapshot: Snapshot) => void,
  pollMs = 5000,
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
      const length = stat.size - offset;
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
