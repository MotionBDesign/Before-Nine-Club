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
