import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { config } from './fixtures.ts';

let home: string;
let server: string;

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'mbdtt-up-'));
  server = fs.mkdtempSync(path.join(os.tmpdir(), 'mbdtt-srv-'));
  process.env.MBD_TT_HOME = home;
  process.env.MBD_TT_LOG_FILE = '0';
  fs.mkdirSync(path.join(home, 'cache'), { recursive: true });
});

afterEach(() => {
  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(server, { recursive: true, force: true });
  delete process.env.MBD_TT_HOME;
});

function installBundle(version: string): void {
  const appDir = path.join(home, 'app');
  fs.mkdirSync(appDir, { recursive: true });
  fs.writeFileSync(path.join(appDir, 'BUNDLE'), `${version}\n`);
}

function publishBundle(version: string, complete = true): void {
  const bundle = `MBDTimeTracker-${version}`;
  fs.mkdirSync(path.join(server, bundle, 'scripts'), { recursive: true });
  if (complete) fs.writeFileSync(path.join(server, bundle, 'scripts', 'install.sh'), '#!/bin/bash\ntrue\n');
  fs.writeFileSync(path.join(server, 'LATEST'), `${bundle}\n`);
}

const withChannel = () => {
  const cfg = config();
  cfg.update.channel = server;
  return cfg;
};

describe('version comparison', () => {
  it('treats a later date as newer', async () => {
    const { isNewer } = await import('../src/update.ts');
    assert.equal(isNewer('20260821-aaaaaaa', '20260820-bbbbbbb'), true);
    assert.equal(isNewer('20260819-aaaaaaa', '20260820-bbbbbbb'), false);
  });

  it('allows a same-day republish so a fix can ship twice in one day', async () => {
    const { isNewer } = await import('../src/update.ts');
    assert.equal(isNewer('20260820-fixfix1', '20260820-bbbbbbb'), true);
  });

  it('is a no-op when the versions match', async () => {
    const { isNewer } = await import('../src/update.ts');
    assert.equal(isNewer('20260820-aaaaaaa', '20260820-aaaaaaa'), false);
  });

  it('treats anything as newer when nothing is installed', async () => {
    const { isNewer } = await import('../src/update.ts');
    assert.equal(isNewer('20260820-aaaaaaa', null), true);
  });
});

describe('update checks', () => {
  it('finds a newer published bundle', async () => {
    const { checkForUpdate } = await import('../src/update.ts');
    installBundle('20260820-aaaaaaa');
    publishBundle('20260821-bbbbbbb');

    const check = checkForUpdate(withChannel());
    assert.equal(check.available, true);
    assert.equal(check.installed, '20260820-aaaaaaa');
    assert.equal(check.published, '20260821-bbbbbbb');
    assert.ok(check.bundlePath?.includes('MBDTimeTracker-20260821-bbbbbbb'));
  });

  it('reports up to date when versions match', async () => {
    const { checkForUpdate } = await import('../src/update.ts');
    installBundle('20260820-aaaaaaa');
    publishBundle('20260820-aaaaaaa');
    assert.equal(checkForUpdate(withChannel()).available, false);
  });

  it('never offers an older bundle', async () => {
    const { checkForUpdate } = await import('../src/update.ts');
    installBundle('20260825-aaaaaaa');
    publishBundle('20260820-bbbbbbb');
    assert.equal(checkForUpdate(withChannel()).available, false);
  });

  it('does not offer a bundle whose installer is missing', async () => {
    // Guards against picking up a release that is still being copied.
    const { checkForUpdate } = await import('../src/update.ts');
    installBundle('20260820-aaaaaaa');
    publishBundle('20260821-bbbbbbb', false);

    const check = checkForUpdate(withChannel());
    assert.equal(check.available, false);
    assert.match(check.reason, /missing or incomplete/);
  });

  it('stays quiet when the share is not mounted', async () => {
    const { checkForUpdate } = await import('../src/update.ts');
    installBundle('20260820-aaaaaaa');
    const cfg = config();
    cfg.update.channel = '/Volumes/definitely-not-mounted-xyz';

    const check = checkForUpdate(cfg);
    assert.equal(check.available, false);
    assert.match(check.reason, /unreachable/);
  });

  it('does nothing when no channel is configured', async () => {
    const { checkForUpdate } = await import('../src/update.ts');
    installBundle('20260820-aaaaaaa');
    const check = checkForUpdate(config());
    assert.equal(check.available, false);
    assert.match(check.reason, /no update channel/);
  });
});

describe('fleet health', () => {
  const base = {
    mac: 'studio-imac', user: 'dom', version: '20260820-aaaaaaa',
    reportedAt: Date.now(), daemonStartedAt: Date.now() - 3_600_000,
    observerLastSampleAgeSeconds: 5, observerHealthy: true,
    accessibilityLikelyGranted: true, hasToken: true, catalogTasks: 109,
    today: { date: '2026-08-20', loggedMinutes: 300, billableMinutes: 280, pendingMinutes: 20, syncedMinutes: 0 },
    targets: { dailyMinutes: 390, billableMinutes: 390 },
    lastError: null as string | null,
  };

  it('calls a working install ok', async () => {
    const { assess } = await import('../src/fleet.ts');
    assert.equal(assess(base).verdict, 'ok');
  });

  it('flags a dead observer as broken', async () => {
    const { assess } = await import('../src/fleet.ts');
    const result = assess({ ...base, observerHealthy: false });
    assert.equal(result.verdict, 'broken');
    assert.match(result.note, /not producing samples/);
  });

  it('flags missing Accessibility permission as broken', async () => {
    // The most common silent failure: it runs, but sees almost nothing.
    const { assess } = await import('../src/fleet.ts');
    const result = assess({ ...base, accessibilityLikelyGranted: false });
    assert.equal(result.verdict, 'broken');
    assert.match(result.note, /Accessibility/);
  });

  it('flags a Mac that stopped reporting as stale', async () => {
    const { assess } = await import('../src/fleet.ts');
    const result = assess({ ...base, reportedAt: Date.now() - 8 * 3_600_000 });
    assert.equal(result.verdict, 'stale');
  });

  it('flags a missing token as needing attention, not broken', async () => {
    const { assess } = await import('../src/fleet.ts');
    assert.equal(assess({ ...base, hasToken: false }).verdict, 'attention');
  });

  it('round-trips status files through the shared folder', async () => {
    const { reportStatus, readFleet } = await import('../src/fleet.ts');
    const cfg = config();
    cfg.fleet.statusDir = server;
    reportStatus(cfg, base);

    const fleet = readFleet(server);
    assert.equal(fleet.length, 1);
    assert.equal(fleet[0]!.user, 'dom');
    assert.equal(fleet[0]!.today.loggedMinutes, 300);
  });

  it('carries no record of what anyone worked on', async () => {
    const { reportStatus } = await import('../src/fleet.ts');
    const cfg = config();
    cfg.fleet.statusDir = server;
    reportStatus(cfg, base);

    const file = fs.readdirSync(server).find((f) => f.endsWith('.json'))!;
    const raw = fs.readFileSync(path.join(server, file), 'utf8');
    for (const leak of ['taskId', 'taskName', 'documentPath', 'paths', 'titles', 'urls', 'evidence']) {
      assert.ok(!raw.includes(leak), `fleet status leaked "${leak}"`);
    }
  });

  it('silently skips reporting when the share is unreachable', async () => {
    const { reportStatus } = await import('../src/fleet.ts');
    const cfg = config();
    cfg.fleet.statusDir = '/Volumes/definitely-not-mounted-xyz';
    assert.doesNotThrow(() => reportStatus(cfg, base));
  });
});
