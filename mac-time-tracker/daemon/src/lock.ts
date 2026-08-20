import fs from 'node:fs';
import path from 'node:path';
import { ensureDirs, paths, readJson } from './paths.ts';
import { log } from './log.ts';

interface LockFile {
  pid: number;
  hostname: string;
  startedAt: number;
}

/**
 * Only one daemon may own a data directory.
 *
 * Two of them — say the launch agent plus a hand-started `npm start` — would
 * both rebuild and save the same day file, and the later write would silently
 * throw away the earlier one's approvals. Worse, both would advance the spool
 * offset, so each would see only half the activity.
 */
export class InstanceLock {
  #file: string;
  #held = false;

  constructor(file = path.join(paths.data(), 'daemon.lock')) {
    this.#file = file;
  }

  /** Returns null on success, or a description of who already holds it. */
  acquire(): string | null {
    if (this.#held) return null;
    ensureDirs();
    const existing = readJson<LockFile>(this.#file);

    if (existing && this.#isAlive(existing)) {
      const age = Math.round((Date.now() - existing.startedAt) / 60_000);
      return (
        `another tracker is already running (pid ${existing.pid} on ${existing.hostname}, started ${age} min ago). ` +
        `If that is wrong, delete ${this.#file} and start again`
      );
    }
    if (existing) {
      log.warn(`Clearing a stale lock from pid ${existing.pid}`);
    }

    const record: LockFile = {
      pid: process.pid,
      hostname: process.env.HOSTNAME ?? 'this Mac',
      startedAt: Date.now(),
    };
    // Exclusive create closes the window where two daemons start together;
    // fall back to a plain write when clearing a stale lock.
    try {
      fs.writeFileSync(this.#file, JSON.stringify(record), { flag: 'wx', mode: 0o600 });
    } catch {
      try {
        fs.writeFileSync(this.#file, JSON.stringify(record), { mode: 0o600 });
      } catch (error) {
        return `could not write the lock file: ${String(error)}`;
      }
    }
    this.#held = true;
    return null;
  }

  release(): void {
    if (!this.#held) return;
    try {
      // Only remove it if it is still ours.
      const current = readJson<LockFile>(this.#file);
      if (current?.pid === process.pid) fs.unlinkSync(this.#file);
    } catch {
      /* nothing useful to do at shutdown */
    }
    this.#held = false;
  }

  /**
   * A lock from a previous boot, or from a process that was killed, is stale.
   * Signal 0 tests for existence without touching the process.
   *
   * A pid held by *this* process still counts as alive — that means another
   * InstanceLock here already owns it, and the second one must be refused.
   */
  #isAlive(lock: LockFile): boolean {
    try {
      process.kill(lock.pid, 0);
      return true;
    } catch (error) {
      // EPERM means it exists but belongs to someone else — still alive.
      return (error as NodeJS.ErrnoException).code === 'EPERM';
    }
  }
}
