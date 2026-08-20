import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import { buildContext, type MatchContext } from '../src/matcher.ts';
import type { Runtime } from '../src/server.ts';
import { realCatalog } from './real-tasks.ts';
import { evalConfig, evalRules } from './real-cases.ts';
import { snapshots, T0 } from './fixtures.ts';

let home: string;
let base: string;
let close: () => Promise<void>;
let date: string;

const asJson = async (response: Response): Promise<any> => response.json();

before(async () => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'mbdtt-ql-'));
  process.env.MBD_TT_HOME = home;
  process.env.MBD_TT_LOG_FILE = '0';

  const store = await import('../src/store.ts');
  const { createServer } = await import('../src/server.ts');

  date = store.localDate(T0);
  // Two hours of real SAPN work, so targets have something to measure.
  for (const snapshot of snapshots(T0, 1440, {
    app: 'Photoshop', bundleId: 'com.adobe.Photoshop',
    documentPath: '/Volumes/Projects/Clients/SAPN/2026/Smarter Homes Solar Curtailment/Curtailment_styleframes_01.psd',
  })) store.appendSnapshot(snapshot);

  const config = structuredClone(evalConfig);
  let context: MatchContext = buildContext(config, evalRules, realCatalog());
  const runtime: Runtime = {
    config,
    getContext: () => context,
    reloadContext: () => { context = buildContext(config, evalRules, realCatalog(), []); },
    getClient: () => null,
    refreshCatalog: async () => {},
  };
  store.rebuildDay(date, context);

  const server = createServer(runtime);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  config.server.port = port;
  base = `http://127.0.0.1:${port}`;
  close = () => new Promise<void>((resolve) => { server.close(() => resolve()); });
});

after(async () => {
  await close();
  fs.rmSync(home, { recursive: true, force: true });
  delete process.env.MBD_TT_HOME;
});

describe('targets and quick-log over the API', () => {
  it('serves the targets and resolved quick-log buttons with the day', async () => {
    const body = await asJson(await fetch(`${base}/api/day?date=${date}`));
    assert.equal(body.targets.dailyMinutes, 390);
    assert.equal(body.targets.billableMinutes, 390);
    assert.equal(body.quickLog.length, 3);
    assert.equal(body.quickLog[0].label, 'MBD Meeting');
    assert.equal(body.quickLog[0].taskName, 'MBD - Non billable - Meetings, catch ups');
    assert.equal(typeof body.summary.loggedMs, 'number');
  });

  it('one click logs an approved, non-billable meeting on the real task', async () => {
    const body = await asJson(await fetch(`${base}/api/quick-log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ index: 0, date }),
    }));
    assert.equal(body.entry.status, 'approved');
    assert.equal(body.entry.manual, true);
    assert.equal(body.entry.taskId, '86d2c5302');
    assert.equal(body.entry.billable, false);
    assert.equal(body.entry.durationMs, 30 * 60_000);
    assert.equal(body.entry.description, 'MBD Meeting');
    // Logged time went up; billable did not.
    assert.ok(body.summary.loggedMs > body.summary.billableMs);
  });

  it('accepts a custom duration for a longer meeting', async () => {
    const body = await asJson(await fetch(`${base}/api/quick-log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ index: 0, date, minutes: 90 }),
    }));
    assert.equal(body.entry.durationMs, 90 * 60_000);
  });

  it('rejects an unknown button index', async () => {
    const response = await fetch(`${base}/api/quick-log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ index: 99, date }),
    });
    assert.equal(response.status, 400);
  });

  it('a rebuild never removes or duplicates a quick-logged meeting', async () => {
    const store = await import('../src/store.ts');
    const before = store.loadDay(date);
    const manualBefore = before.entries.filter((e) => e.manual);
    assert.ok(manualBefore.length >= 2);

    const rebuilt = await asJson(await fetch(`${base}/api/day/rebuild`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date }),
    }));
    const manualAfter = rebuilt.day.entries.filter((e: { manual?: boolean }) => e.manual);
    assert.equal(manualAfter.length, manualBefore.length);
    for (const entry of manualAfter) assert.equal(entry.status, 'approved');
  });

  it('duration of a quick-logged entry is editable like any other', async () => {
    const day = await asJson(await fetch(`${base}/api/day?date=${date}`));
    const manual = day.day.entries.find((e: { manual?: boolean }) => e.manual);
    const body = await asJson(await fetch(`${base}/api/entry/${manual.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, durationMinutes: 45 }),
    }));
    assert.equal(body.entry.durationMs, 45 * 60_000);
  });
});

describe('manual entries and activity carving', () => {
  it('carves overlapping ambient activity out of a rebuild', async () => {
    // Simulate a meeting logged over a window where the laptop showed a
    // Photoshop file open: the manual entry must own that time exclusively.
    const store = await import('../src/store.ts');
    const isolated = fs.mkdtempSync(path.join(os.tmpdir(), 'mbdtt-carve-'));
    const prevHome = process.env.MBD_TT_HOME;
    process.env.MBD_TT_HOME = isolated;
    try {
      const localDate = store.localDate(T0);
      for (const snapshot of snapshots(T0, 720, {
        app: 'Photoshop', bundleId: 'com.adobe.Photoshop',
        documentPath: '/Volumes/Projects/Clients/SAPN/2026/Smarter Homes Solar Curtailment/x.psd',
      })) store.appendSnapshot(snapshot);

      // Meeting covering the second half-hour of that hour.
      store.addManualEntry(localDate, {
        taskId: '86d2c5302', taskName: 'MBD - Non billable - Meetings, catch ups',
        listName: 'Active list', folderName: null, spaceName: 'MBD Non billable',
        label: 'MBD Meeting', minutes: 30, billable: false,
        now: T0 + 3_600_000,
      });

      const context = buildContext(structuredClone(evalConfig), evalRules, realCatalog());
      const day = store.rebuildDay(localDate, context);

      const manual = day.entries.filter((e) => e.manual);
      const observed = day.entries.filter((e) => !e.manual);
      assert.equal(manual.length, 1);
      // The observed block lost the carved half hour: ~30min remains.
      const observedMs = observed.reduce((sum, e) => sum + e.activeMs, 0);
      assert.ok(observedMs <= 31 * 60_000, `expected ~30m observed, got ${Math.round(observedMs / 60_000)}m`);
      // And the total for the day is not double-counted past the hour.
      const totalMs = day.entries.reduce((sum, e) => sum + e.durationMs, 0);
      assert.ok(totalMs <= 65 * 60_000, `expected ~1h total, got ${Math.round(totalMs / 60_000)}m`);
    } finally {
      process.env.MBD_TT_HOME = prevHome;
      fs.rmSync(isolated, { recursive: true, force: true });
    }
  });
});
