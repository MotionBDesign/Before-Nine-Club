import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import type { Config } from './types.ts';
import { expandHome, paths, readJson, writeJsonAtomic } from './paths.ts';
import { log } from './log.ts';

/**
 * Self-update from the studio file server.
 *
 * `stage-release.sh` publishes a bundle directory and a LATEST file naming it.
 * The daemon reads LATEST, and when it names a newer bundle than the one
 * installed, re-runs that bundle's installer. The installer stops the agents,
 * swaps the local copy and starts them again — so applying an update ends this
 * process, by design.
 *
 * The observer is a separate launch agent and keeps spooling activity
 * throughout, so even a failed update loses no tracking data.
 */

/** Version stamp of the copy currently installed, e.g. "20260820-accff26". */
export function installedVersion(appDir = path.resolve(paths.data(), 'app')): string | null {
  try {
    return fs.readFileSync(path.join(appDir, 'BUNDLE'), 'utf8').trim() || null;
  } catch {
    return null;
  }
}

/** Bundle name the server is currently offering, from its LATEST file. */
export function publishedVersion(channel: string): { bundle: string; version: string } | null {
  if (!channel) return null;
  try {
    const bundle = fs.readFileSync(path.join(expandHome(channel), 'LATEST'), 'utf8').trim();
    if (!bundle) return null;
    // "MBDTimeTracker-20260820-accff26" -> "20260820-accff26"
    const version = bundle.replace(/^MBDTimeTracker-/, '');
    return { bundle, version };
  } catch {
    // The share is usually just not mounted. Not worth an error.
    return null;
  }
}

/**
 * Versions are `YYYYMMDD-<sha>`. Compare the date, and treat a same-day
 * republish with a different commit as newer so a fix can ship twice in a day.
 */
export function isNewer(published: string, installed: string | null): boolean {
  if (!installed) return true;
  if (published === installed) return false;
  const date = (v: string) => Number((/^(\d{8})/.exec(v)?.[1]) ?? 0);
  const publishedDate = date(published);
  const installedDate = date(installed);
  if (publishedDate !== installedDate) return publishedDate > installedDate;
  return true;
}

interface UpdateState {
  lastAttemptedVersion: string;
  lastAttemptedAt: number;
  failures: number;
}

function statePath(): string {
  return path.join(paths.cache(), 'update-state.json');
}

/** A bundle that failed to install is retried, but not in a tight loop. */
function shouldRetry(version: string): boolean {
  const state = readJson<UpdateState>(statePath());
  if (!state || state.lastAttemptedVersion !== version) return true;
  if (state.failures < 3) return true;
  // Three failures on the same version: back off to once a day so the logs
  // stay readable and the share isn't hammered.
  return Date.now() - state.lastAttemptedAt > 86_400_000;
}

function recordAttempt(version: string): void {
  const previous = readJson<UpdateState>(statePath());
  const failures = previous?.lastAttemptedVersion === version ? previous.failures + 1 : 1;
  writeJsonAtomic(statePath(), { lastAttemptedVersion: version, lastAttemptedAt: Date.now(), failures });
}

export interface UpdateCheck {
  available: boolean;
  installed: string | null;
  published: string | null;
  /** Absolute path to the staged bundle, when one is available. */
  bundlePath: string | null;
  reason: string;
}

export function checkForUpdate(config: Config): UpdateCheck {
  const installed = installedVersion();
  if (!config.update.channel) {
    return { available: false, installed, published: null, bundlePath: null, reason: 'no update channel configured' };
  }
  const remote = publishedVersion(config.update.channel);
  if (!remote) {
    return { available: false, installed, published: null, bundlePath: null, reason: 'update channel unreachable (share not mounted?)' };
  }
  const bundlePath = path.join(expandHome(config.update.channel), remote.bundle);
  if (!fs.existsSync(path.join(bundlePath, 'scripts', 'install.sh'))) {
    return {
      available: false, installed, published: remote.version, bundlePath: null,
      reason: `LATEST names ${remote.bundle} but that bundle is missing or incomplete`,
    };
  }
  if (!isNewer(remote.version, installed)) {
    return { available: false, installed, published: remote.version, bundlePath, reason: 'up to date' };
  }
  return { available: true, installed, published: remote.version, bundlePath, reason: 'a newer bundle is published' };
}

/**
 * Launch the staged installer detached, so it survives this process being
 * stopped partway through — which is exactly what it does to us.
 */
export function applyUpdate(check: UpdateCheck): boolean {
  if (!check.available || !check.bundlePath || !check.published) return false;
  if (!shouldRetry(check.published)) {
    log.warn(`Skipping update to ${check.published}; it has failed repeatedly.`);
    return false;
  }
  recordAttempt(check.published);

  const installer = path.join(check.bundlePath, 'scripts', 'install.sh');
  log.info(`Updating ${check.installed ?? 'unknown'} -> ${check.published} using ${installer}`);

  const logFile = path.join(paths.data(), 'update.log');
  let out: number;
  try {
    out = fs.openSync(logFile, 'a');
  } catch {
    out = 1;
  }
  const child = spawn('/bin/bash', [installer], {
    detached: true,
    stdio: ['ignore', out, out],
    // Non-interactive: the installer skips the token prompt and keeps the
    // existing keychain entry.
    env: { ...process.env, MBD_TT_UNATTENDED: '1' },
  });
  child.unref();
  return true;
}

/** Clear the failure counter once the new version is confirmed running. */
export function confirmInstalled(): void {
  const state = readJson<UpdateState>(statePath());
  const current = installedVersion();
  if (state && current && state.lastAttemptedVersion === current) {
    writeJsonAtomic(statePath(), { lastAttemptedVersion: current, lastAttemptedAt: Date.now(), failures: 0 });
  }
}
