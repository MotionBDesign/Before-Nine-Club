import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

/** Expand a leading `~` and resolve to an absolute path. */
export function expandHome(p: string): string {
  if (p === '~') return os.homedir();
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  return p;
}

/**
 * Is this path on a network volume that is not mounted right now?
 *
 * Everything the tracker reads off the studio share -- the update channel, the
 * fleet status folder -- sits under /Volumes. Calling stat() on a path inside
 * an unmounted or half-dead SMB share is not free: it can hang for tens of
 * seconds, and on some setups it is what asks the person for their server
 * password. Neither belongs on a timer that fires every half hour in the
 * background.
 *
 * Reading /Volumes itself is a local directory listing and always cheap, so
 * this checks the volume is there before anything touches a path inside it.
 */
export function onUnmountedVolume(p: string, listVolumes = readVolumes): boolean {
  const parts = expandHome(p).split(path.sep);
  // ['', 'Volumes', '<name>', ...] — anything shallower is not inside a volume.
  if (parts[1] !== 'Volumes' || !parts[2]) return false;
  const mounted = listVolumes();
  // No /Volumes at all (Linux, a test box): nothing to protect against, and
  // guessing "unmounted" here would disable the share everywhere.
  return mounted === null ? false : !mounted.includes(parts[2]);
}

/** The mounted volumes, or null if this machine has no /Volumes at all. */
function readVolumes(): string[] | null {
  try {
    return fs.readdirSync('/Volumes');
  } catch {
    return null;
  }
}

/**
 * Root for all state. Overridable with MBD_TT_HOME, which is what the tests
 * and `--data-dir` use so runs never touch the real Application Support dir.
 */
export function dataDir(): string {
  const override = process.env.MBD_TT_HOME;
  if (override) return expandHome(override);
  return path.join(os.homedir(), 'Library', 'Application Support', 'MBDTimeTracker');
}

export const paths = {
  data: dataDir,
  config: () => path.join(dataDir(), 'config.json'),
  rules: () => path.join(dataDir(), 'rules.json'),
  days: () => path.join(dataDir(), 'days'),
  cache: () => path.join(dataDir(), 'cache'),
  catalog: () => path.join(dataDir(), 'cache', 'catalog.json'),
  corrections: () => path.join(dataDir(), 'corrections.ndjson'),
  spool: () => path.join(dataDir(), 'observer.ndjson'),
  log: () => path.join(dataDir(), 'daemon.log'),
  snapshots: (date: string) => path.join(dataDir(), 'days', `${date}.snapshots.ndjson`),
  entries: (date: string) => path.join(dataDir(), 'days', `${date}.entries.json`),
};

export function ensureDirs(): void {
  for (const dir of [dataDir(), paths.days(), paths.cache()]) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
}

/** Write via a temp file + rename so a crash can never leave a half-written day. */
export function writeJsonAtomic(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(tmp, file);
}

export function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return null;
  }
}
