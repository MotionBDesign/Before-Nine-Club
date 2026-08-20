import { spawn, type ChildProcess } from 'node:child_process';
import readline from 'node:readline';
import fs from 'node:fs';
import type { Config, Snapshot } from './types.ts';
import { log } from './log.ts';

/** What the daemon needs from whatever is feeding it snapshots. */
export interface ActivitySource {
  stop(): void;
  /** Discard already-consumed raw data. A no-op when there is no spool. */
  rotate(): boolean;
}

/** Strip anything the privacy settings say we shouldn't keep. */
export function sanitize(snapshot: Snapshot, config: Config): Snapshot {
  const clean: Snapshot = { ...snapshot };
  if (!config.privacy.recordTitles) clean.title = null;
  if (!config.privacy.recordUrls) {
    clean.url = null;
  } else if (clean.url && config.privacy.redactUrlQuery) {
    try {
      const parsed = new URL(clean.url);
      clean.url = `${parsed.origin}${parsed.pathname}`;
    } catch {
      /* leave unparseable URLs alone */
    }
  }
  return clean;
}

function looksLikeSnapshot(value: unknown): value is Snapshot {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.ts === 'number' && typeof v.bundleId === 'string' && typeof v.idleSeconds === 'number';
}

/**
 * Run the Swift observer and stream its NDJSON snapshots. The helper is the
 * only part that needs macOS APIs; if it dies we restart it with backoff
 * rather than silently stopping the day's tracking.
 */
export function startObserver(
  binaryPath: string,
  config: Config,
  onSnapshot: (snapshot: Snapshot) => void,
): ActivitySource {
  let child: ChildProcess | null = null;
  let stopped = false;
  let restarts = 0;
  let restartTimer: NodeJS.Timeout | null = null;

  function launch(): void {
    if (stopped) return;
    if (!fs.existsSync(binaryPath)) {
      log.error(
        `Observer binary missing at ${binaryPath}. Build it with: (cd observer && swift build -c release)`,
      );
      scheduleRestart();
      return;
    }

    log.info(`Starting observer: ${binaryPath}`);
    const args = [
      '--interval', String(config.capture.sampleIntervalSeconds),
      '--browser-urls', config.observer.browserUrls,
    ];
    const proc = spawn(binaryPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child = proc;

    const rl = readline.createInterface({ input: proc.stdout! });
    rl.on('line', (line) => {
      if (!line.trim()) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        log.warn('Observer emitted a non-JSON line', line.slice(0, 200));
        return;
      }
      if (!looksLikeSnapshot(parsed)) {
        // The helper reports permission problems on the same channel.
        const record = parsed as Record<string, unknown>;
        if (typeof record.error === 'string') log.error(`Observer: ${record.error}`);
        return;
      }
      restarts = 0;
      onSnapshot(sanitize(parsed, config));
    });

    proc.stderr!.on('data', (chunk: Buffer) => {
      const text = chunk.toString().trim();
      if (text) log.warn(`Observer stderr: ${text}`);
    });

    proc.on('exit', (code, signal) => {
      child = null;
      if (stopped) return;
      log.warn(`Observer exited (code=${code} signal=${signal}); restarting`);
      scheduleRestart();
    });

    proc.on('error', (error) => {
      log.error('Failed to spawn observer', error.message);
    });
  }

  function scheduleRestart(): void {
    if (stopped || restartTimer) return;
    const delay = Math.min(30_000, 2 ** Math.min(restarts, 4) * 1000);
    restarts++;
    restartTimer = setTimeout(() => {
      restartTimer = null;
      launch();
    }, delay);
  }

  launch();

  return {
    stop(): void {
      stopped = true;
      if (restartTimer) clearTimeout(restartTimer);
      child?.kill('SIGTERM');
    },
    rotate: () => false,
  };
}
