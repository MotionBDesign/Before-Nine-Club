import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { buildContext } from '../src/matcher.ts';
import { catalog, config, rules, snapshots, T0 } from './fixtures.ts';

let home: string;

/**
 * Every store function reads MBD_TT_HOME at call time, so pointing it at a
 * temp directory fully isolates these tests from a real installation.
 */
beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'mbdtt-'));
  process.env.MBD_TT_HOME = home;
  process.env.MBD_TT_LOG_FILE = '0';
});

afterEach(() => {
  fs.rmSync(home, { recursive: true, force: true });
  delete process.env.MBD_TT_HOME;
});

const ctx = () => buildContext(config(), rules, catalog());

const sapnDay = () => snapshots(T0, 120, {
  app: 'Photoshop', bundleId: 'com.adobe.Photoshop',
  documentPath: '/Volumes/Projects/Clients/SAPN/2026/PowerlineSafety_Poster.psd',
});

describe('store', () => {
  it('round-trips snapshots through the day file', async () => {
    const store = await import('../src/store.ts');
    for (const snapshot of sapnDay()) store.appendSnapshot(snapshot);
    assert.equal(store.readSnapshots(store.localDate(T0)).length, 120);

    const day = store.rebuildDay(store.localDate(T0), ctx());
    assert.equal(day.entries.length, 1);
    assert.equal(day.entries[0]!.suggestion.taskId, '86aaa0001');
    assert.equal(day.entries[0]!.status, 'pending');
  });

  it('skips a corrupt snapshot line rather than losing the day', async () => {
    const store = await import('../src/store.ts');
    const date = store.localDate(T0);
    for (const snapshot of sapnDay()) store.appendSnapshot(snapshot);
    fs.appendFileSync(path.join(home, 'days', `${date}.snapshots.ndjson`), '{ this is not json\n');
    assert.equal(store.readSnapshots(date).length, 120);
  });

  it('never undoes an approval when the day is rebuilt', async () => {
    const store = await import('../src/store.ts');
    const date = store.localDate(T0);
    for (const snapshot of sapnDay()) store.appendSnapshot(snapshot);

    const first = store.rebuildDay(date, ctx());
    first.entries[0]!.status = 'approved';
    first.entries[0]!.taskId = '86aaa0002';
    store.saveDay(first);

    const second = store.rebuildDay(date, ctx());
    const approved = second.entries.filter((e) => e.status === 'approved');
    assert.equal(approved.length, 1);
    assert.equal(approved[0]!.taskId, '86aaa0002');
    // The approved range is carved out, so it isn't proposed a second time.
    assert.equal(second.entries.length, 1);
  });

  it('keeps a hand-picked task on a still-pending entry', async () => {
    const store = await import('../src/store.ts');
    const date = store.localDate(T0);
    for (const snapshot of sapnDay()) store.appendSnapshot(snapshot);

    const first = store.rebuildDay(date, ctx());
    first.entries[0]!.taskId = '86ccc0001';
    first.entries[0]!.corrected = true;
    store.saveDay(first);

    const second = store.rebuildDay(date, ctx());
    assert.equal(second.entries[0]!.taskId, '86ccc0001');
  });

  it('remembers a correction so the next file in that folder matches', async () => {
    const store = await import('../src/store.ts');
    const date = store.localDate(T0);
    for (const snapshot of sapnDay()) store.appendSnapshot(snapshot);
    const day = store.rebuildDay(date, ctx());

    store.recordCorrection(day.entries[0]!, '86aaa0002');
    const corrections = store.loadCorrections();
    assert.ok(corrections.length > 0);
    assert.ok(corrections.every((c) => c.taskId === '86aaa0002'));
    // The blunt app-level key would over-generalise from a single correction.
    assert.ok(!corrections.some((c) => c.key.startsWith('app:')));
  });

  it('prunes raw snapshots past the retention window but keeps the entries', async () => {
    const store = await import('../src/store.ts');
    const old = Date.now() - 60 * 86_400_000;
    const oldDate = store.localDate(old);
    for (const snapshot of snapshots(old, 20, { app: 'Photoshop', bundleId: 'com.adobe.Photoshop' })) {
      store.appendSnapshot(snapshot);
    }
    store.saveDay({ date: oldDate, updatedAt: Date.now(), entries: [] });

    assert.equal(store.pruneSnapshots(30), 1);
    assert.equal(store.readSnapshots(oldDate).length, 0);
    assert.ok(fs.existsSync(path.join(home, 'days', `${oldDate}.entries.json`)));
  });

  it('writes state files that only the owner can read', async () => {
    const store = await import('../src/store.ts');
    store.saveDay({ date: '2026-08-20', updatedAt: Date.now(), entries: [] });
    const mode = fs.statSync(path.join(home, 'days', '2026-08-20.entries.json')).mode & 0o777;
    assert.equal(mode & 0o077, 0, `expected owner-only, got ${mode.toString(8)}`);
  });
});
