import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import { buildContext, type MatchContext } from '../src/matcher.ts';
import type { Runtime } from '../src/server.ts';
import { catalog, config, rules, snapshots, T0 } from './fixtures.ts';
import * as store from '../src/store.ts';

/** The review API is loosely typed on purpose; tests only need the shape. */
const asJson = async (response: Response): Promise<any> => response.json();

let home: string;
let base: string;
let port: number;
let close: () => Promise<void>;
let date: string;

before(async () => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'mbdtt-srv-'));
  process.env.MBD_TT_HOME = home;
  process.env.MBD_TT_LOG_FILE = '0';

  const store = await import('../src/store.ts');
  const { createServer } = await import('../src/server.ts');

  date = store.localDate(T0);
  for (const snapshot of snapshots(T0, 120, {
    app: 'Photoshop', bundleId: 'com.adobe.Photoshop',
    documentPath: '/Volumes/Projects/Clients/SAPN/2026/PowerlineSafety_Poster.psd',
  })) store.appendSnapshot(snapshot);

  let context: MatchContext = buildContext(config(), rules, catalog());
  const runtime: Runtime = {
    config: context.config,
    getContext: () => context,
    reloadContext: () => { context = buildContext(config(), rules, catalog(), []); },
    getClient: () => null,
    refreshCatalog: async () => {},
  };
  store.rebuildDay(date, context);

  const server = createServer(runtime);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as AddressInfo).port;
  runtime.config.server.port = port;
  base = `http://127.0.0.1:${port}`;
  close = () => new Promise<void>((resolve) => { server.close(() => resolve()); });
});

after(async () => {
  await close();
  fs.rmSync(home, { recursive: true, force: true });
  delete process.env.MBD_TT_HOME;
});

describe('review server', () => {
  it('names the task the entry is actually logged against, not the guess', async () => {
    // The bug this pins: after correcting a match, the card kept showing the
    // *suggested* task's name, so people saw a name with nothing to do with
    // the entry -- and the ClickUp name they had just picked was nowhere.
    const before = await asJson(await fetch(`${base}/api/day?date=${date}`));
    const entry = before.day.entries[0];
    assert.equal(entry.resolved.taskName, 'Powerline Safety poster series');
    assert.equal(entry.resolved.folderName, 'SAPN');
    assert.equal(entry.resolved.stale, false);

    const patched = await asJson(await fetch(`${base}/api/entry/${entry.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, taskId: '86ccc0001' }),
    }));
    assert.equal(patched.entry.resolved.taskId, '86ccc0001');
    assert.equal(patched.entry.resolved.taskName, 'Underground drilling explainer video');
    assert.equal(patched.entry.resolved.folderName, 'Maptek');
    // The suggestion is untouched -- it is the record of what was guessed.
    assert.equal(patched.entry.suggestion.taskName, 'Powerline Safety poster series');

    const after_ = await asJson(await fetch(`${base}/api/day?date=${date}`));
    assert.equal(after_.day.entries[0].resolved.taskName, 'Underground drilling explainer video');

    // The week rolls up under the corrected client too.
    const week = await asJson(await fetch(`${base}/api/week?date=${date}`));
    const today = week.days.find((d: any) => d.date === date);
    assert.ok(today.byClient.Maptek > 0, 'the week still counts this under SAPN');
    assert.equal(today.byClient.SAPN, undefined);

    // Put it back so the rest of the suite sees what it expects.
    await fetch(`${base}/api/entry/${entry.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, taskId: '86aaa0001' }),
    });
  });

  it('reports what the observer can actually see, per app', async () => {
    const t = await asJson(await fetch(`${base}/api/tracking?date=${date}`));
    assert.equal(t.accessibility, 'granted');
    assert.ok(t.observer.totalSamples > 0);
    const photoshop = t.apps.find((a: any) => a.bundleId === 'com.adobe.Photoshop');
    assert.ok(photoshop, 'Photoshop is missing from the tracking view');
    assert.equal(photoshop.pathRate, 1);
    assert.equal(
      photoshop.examplePath,
      '/Volumes/Projects/Clients/SAPN/2026/PowerlineSafety_Poster.psd',
    );
    assert.ok(photoshop.activeMs > 0);
  });

  it('calls out a missing Accessibility grant rather than showing a blank day', async () => {
    // Without the grant every app still reports its name, and nothing else.
    // That is indistinguishable from a quiet day unless it is named.
    const blindDate = '2026-03-02';
    for (const snapshot of snapshots(new Date(2026, 2, 2, 9, 0, 0).getTime(), 40, {
      app: 'DaVinci Resolve',
      bundleId: 'com.blackmagic-design.DaVinciResolve',
      title: null,
      documentPath: null,
    })) store.appendSnapshot(snapshot);

    const t = await asJson(await fetch(`${base}/api/tracking?date=${blindDate}`));
    assert.equal(t.accessibility, 'missing');
    const resolve = t.apps.find((a: any) => a.app === 'DaVinci Resolve');
    assert.ok(resolve, 'Resolve should still be listed — it is tracked, just unreadable');
    assert.equal(resolve.titleRate, 0);
    assert.ok(resolve.activeMs > 0, 'the time is tracked even with nothing readable');
  });

  it('says so when a task is not in the cached catalog', async () => {
    const before = await asJson(await fetch(`${base}/api/day?date=${date}`));
    const entry = before.day.entries[0];
    const patched = await asJson(await fetch(`${base}/api/entry/${entry.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, taskId: '86zzz9999' }),
    }));
    // The id still pushes fine; only the name is unknown, and inventing one
    // would be worse than admitting it.
    assert.equal(patched.entry.resolved.taskId, '86zzz9999');
    assert.equal(patched.entry.resolved.taskName, null);
    assert.equal(patched.entry.resolved.stale, true);

    await fetch(`${base}/api/entry/${entry.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, taskId: '86aaa0001' }),
    });
  });

  it('serves the review page', async () => {
    const response = await fetch(`${base}/`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /Timesheet review/);
  });

  it('returns the day with a summary', async () => {
    const response = await fetch(`${base}/api/day?date=${date}`);
    const body = await asJson(response);
    assert.equal(body.day.entries.length, 1);
    assert.equal(body.day.entries[0].suggestion.taskId, '86aaa0001');
    assert.ok(body.summary.trackedMs > 0);
    assert.equal(body.summary.approvedMs, 0);
  });

  it('treats an empty date parameter as today', async () => {
    // The UI sends `?date=` before it knows which day it is showing.
    const body = await asJson(await fetch(`${base}/api/day?date=`));
    assert.equal(body.day.date, store.localDate());
  });

  it('searches the cached tasks', async () => {
    const response = await fetch(`${base}/api/tasks?q=brochure`);
    const body = await asJson(response);
    assert.equal(body.tasks.length, 1);
    assert.equal(body.tasks[0].taskId, '86bbb0002');
  });

  it('refuses to approve an entry with no task', async () => {
    const day = await asJson(await fetch(`${base}/api/day?date=${date}`));
    const id = day.day.entries[0].id;
    const cleared = await fetch(`${base}/api/entry/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, taskId: null }),
    });
    assert.equal(cleared.status, 200);

    const response = await fetch(`${base}/api/entry/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, status: 'approved' }),
    });
    assert.equal(response.status, 400);
  });

  it('records a correction when the task is changed by hand', async () => {
    const store = await import('../src/store.ts');
    const day = await asJson(await fetch(`${base}/api/day?date=${date}`));
    const id = day.day.entries[0].id;

    const response = await fetch(`${base}/api/entry/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, taskId: '86ccc0001', status: 'approved', durationMinutes: 45 }),
    });
    assert.equal(response.status, 200);
    const body = await asJson(response);
    assert.equal(body.entry.status, 'approved');
    assert.equal(body.entry.durationMs, 45 * 60_000);
    assert.equal(body.entry.corrected, true);
    assert.ok(store.loadCorrections().some((c) => c.taskId === '86ccc0001'));
  });

  it('rejects a request that did not come from loopback', async () => {
    // fetch() refuses to set Host, so this one goes out over raw http.
    const status = await new Promise<number>((resolve, reject) => {
      const request = http.request(
        { host: '127.0.0.1', port, path: '/api/day', headers: { host: 'tracker.evil.test' } },
        (response) => { response.resume(); resolve(response.statusCode ?? 0); },
      );
      request.on('error', reject);
      request.end();
    });
    assert.equal(status, 403);
  });

  it('accepts a request from localhost by name', async () => {
    const status = await new Promise<number>((resolve, reject) => {
      const request = http.request(
        { host: '127.0.0.1', port, path: '/api/day', headers: { host: `localhost:${port}` } },
        (response) => { response.resume(); resolve(response.statusCode ?? 0); },
      );
      request.on('error', reject);
      request.end();
    });
    assert.equal(status, 200);
  });

  it('rejects a cross-origin post', async () => {
    const response = await fetch(`${base}/api/day/approve-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://evil.test' },
      body: JSON.stringify({ date }),
    });
    assert.equal(response.status, 403);
  });

  it('will not push without a ClickUp token', async () => {
    const response = await fetch(`${base}/api/day/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date }),
    });
    assert.equal(response.status, 400);
  });
});
