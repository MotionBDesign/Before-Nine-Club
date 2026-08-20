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
