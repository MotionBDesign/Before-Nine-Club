import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Config } from './types.ts';
import { expandHome, onUnmountedVolume, paths, writeJsonAtomic } from './paths.ts';
import { installedVersion } from './update.ts';
import { loadDay, localDate } from './store.ts';
import { log } from './log.ts';
import { readMemory, DAEMON_RSS_WARN_MB, OBSERVER_RSS_WARN_MB, type MemoryReading } from './health.ts';

/**
 * A one-file-per-Mac health report on the file server, so whoever looks after
 * this can see the whole studio at a glance instead of asking people whether
 * their tracker is working.
 *
 * Deliberately operational only: version, whether the observer is alive,
 * whether a token is present, and how much time is on today's sheet. Never
 * which tasks, files, apps or sites — none of that leaves the machine. The
 * minutes are here because "0 logged at 4pm" is the clearest signal that an
 * install has quietly broken.
 */
export interface FleetStatus {
  mac: string;
  user: string;
  version: string | null;
  reportedAt: number;
  daemonStartedAt: number;
  /** Age of the newest observer sample, in seconds. Null when never seen. */
  observerLastSampleAgeSeconds: number | null;
  observerHealthy: boolean;
  accessibilityLikelyGranted: boolean;
  hasToken: boolean;
  catalogTasks: number;
  today: { date: string; loggedMinutes: number; billableMinutes: number; pendingMinutes: number; syncedMinutes: number };
  targets: { dailyMinutes: number; billableMinutes: number };
  /**
   * Resident memory for both long-lived processes. One reading means little;
   * a week of reports climbing on the same Mac is what would show a leak, and
   * across the studio it separates "this software leaks" from "that Mac".
   *
   * Optional: a status file written by an older tracker will not have it.
   */
  memory?: MemoryReading;
  lastError: string | null;
}

function statusFile(dir: string): string {
  // One stable filename per machine+user, so re-reporting overwrites rather
  // than piling up.
  const safe = (value: string) => value.replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 40);
  return path.join(expandHome(dir), `${safe(os.hostname())}--${safe(os.userInfo().username)}.json`);
}

/**
 * The observer writes every few seconds. If the spool has not grown in a few
 * minutes the agent is not running. And if it is running but has never
 * produced a title or a document path, Accessibility permission was never
 * granted — the single most common silent failure.
 */
function observerHealth(config: Config): Pick<FleetStatus, 'observerLastSampleAgeSeconds' | 'observerHealthy' | 'accessibilityLikelyGranted'> {
  const spool = config.observer.spoolPath || paths.spool();
  let ageSeconds: number | null = null;
  try {
    ageSeconds = Math.round((Date.now() - fs.statSync(spool).mtimeMs) / 1000);
  } catch {
    ageSeconds = null;
  }
  const healthy = ageSeconds !== null && ageSeconds < 300;

  // Look at the tail of today's snapshots for any evidence of AX access.
  let granted = false;
  try {
    const raw = fs.readFileSync(paths.snapshots(localDate()), 'utf8');
    const lines = raw.split('\n').filter(Boolean).slice(-200);
    granted = lines.some((line) => {
      try {
        const snapshot = JSON.parse(line) as { title?: unknown; documentPath?: unknown; url?: unknown };
        return Boolean(snapshot.title || snapshot.documentPath || snapshot.url);
      } catch {
        return false;
      }
    });
  } catch {
    granted = false;
  }

  return { observerLastSampleAgeSeconds: ageSeconds, observerHealthy: healthy, accessibilityLikelyGranted: granted };
}

export function buildStatus(
  config: Config,
  context: { hasToken: boolean; catalogTasks: number; startedAt: number; lastError: string | null },
): FleetStatus {
  const date = localDate();
  const entries = loadDay(date).entries;
  const minutes = (predicate: (e: (typeof entries)[number]) => boolean) =>
    Math.round(entries.filter(predicate).reduce((sum, e) => sum + e.durationMs, 0) / 60_000);

  return {
    mac: os.hostname(),
    user: os.userInfo().username,
    version: installedVersion(),
    reportedAt: Date.now(),
    daemonStartedAt: context.startedAt,
    ...observerHealth(config),
    hasToken: context.hasToken,
    catalogTasks: context.catalogTasks,
    today: {
      date,
      loggedMinutes: minutes((e) => e.status !== 'rejected'),
      billableMinutes: minutes((e) => e.billable && e.status !== 'rejected'),
      pendingMinutes: minutes((e) => e.status === 'pending'),
      syncedMinutes: minutes((e) => e.status === 'synced'),
    },
    targets: { ...config.targets },
    memory: readMemory(),
    lastError: context.lastError,
  };
}

export function reportStatus(config: Config, status: FleetStatus): void {
  if (!config.fleet.statusDir) return;
  const dir = expandHome(config.fleet.statusDir);
  // Never touch a path inside a share that is not mounted. This runs on a
  // timer in the background, and a stat into a dead SMB mount can hang for
  // tens of seconds or prompt the person for their server password.
  if (onUnmountedVolume(config.fleet.statusDir)) {
    log.debug(`The volume holding ${dir} is not mounted; skipping this report.`);
    return;
  }
  try {
    if (!fs.existsSync(dir)) {
      log.debug(`Fleet status directory ${dir} is not reachable; skipping this report.`);
      return;
    }
    writeJsonAtomic(statusFile(config.fleet.statusDir), status);
  } catch (error) {
    // Never let a missing share disturb tracking.
    log.debug('Could not write the fleet status file', String(error));
  }
}

export function readFleet(statusDir: string): FleetStatus[] {
  const dir = expandHome(statusDir);
  if (onUnmountedVolume(statusDir)) return [];
  let files: string[];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }
  const statuses: FleetStatus[] = [];
  for (const file of files) {
    try {
      statuses.push(JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')) as FleetStatus);
    } catch {
      /* a half-written file will be complete next time */
    }
  }
  return statuses.sort((a, b) => a.mac.localeCompare(b.mac));
}

export type FleetVerdict = 'ok' | 'attention' | 'broken' | 'stale';

/** What a person looking at the fleet actually wants to know: who needs help. */
export function assess(status: FleetStatus, now = Date.now()): { verdict: FleetVerdict; note: string } {
  const reportAgeMinutes = (now - status.reportedAt) / 60_000;
  if (reportAgeMinutes > 240) {
    return { verdict: 'stale', note: `no report for ${Math.round(reportAgeMinutes / 60)}h — Mac off, or the tracker is not running` };
  }
  if (!status.observerHealthy) {
    return { verdict: 'broken', note: 'observer agent is not producing samples' };
  }
  if (!status.accessibilityLikelyGranted) {
    return { verdict: 'broken', note: 'Accessibility permission missing — titles and file paths are blank' };
  }
  if (!status.hasToken) {
    return { verdict: 'attention', note: 'no ClickUp token; nothing can be pushed' };
  }
  if (status.catalogTasks === 0) {
    return { verdict: 'attention', note: 'task catalog is empty' };
  }
  // Deliberately below lastError: a tracker eating memory still works, but
  // left alone for a fortnight it will not.
  const memory = status.memory;
  if (memory) {
    if (memory.daemonMB > DAEMON_RSS_WARN_MB) {
      return { verdict: 'attention', note: `daemon is using ${memory.daemonMB}MB — restart it and tell whoever maintains this` };
    }
    if (memory.observerMB !== null && memory.observerMB > OBSERVER_RSS_WARN_MB) {
      return { verdict: 'attention', note: `observer is using ${memory.observerMB}MB — restart it and tell whoever maintains this` };
    }
  }
  if (status.lastError) {
    return { verdict: 'attention', note: status.lastError };
  }
  return { verdict: 'ok', note: '' };
}
