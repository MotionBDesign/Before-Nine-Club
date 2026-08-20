import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import type { Snapshot } from '../src/types.ts';
import { config, T0 } from './fixtures.ts';

let home: string;
let spool: string;

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'mbdtt-spool-'));
  process.env.MBD_TT_HOME = home;
  process.env.MBD_TT_LOG_FILE = '0';
  fs.mkdirSync(path.join(home, 'cache'), { recursive: true });
  spool = path.join(home, 'observer.ndjson');
});

afterEach(() => {
  fs.rmSync(home, { recursive: true, force: true });
  delete process.env.MBD_TT_HOME;
});

const line = (overrides: Partial<Snapshot> = {}): string =>
  `${JSON.stringify({
    ts: T0, app: 'Photoshop', bundleId: 'com.adobe.Photoshop',
    title: null, documentPath: null, url: null, idleSeconds: 0, locked: false,
    ...overrides,
  })}\n`;

async function reader(onSnapshot: (s: Snapshot) => void, cfg = config()) {
  const { startSpoolReader } = await import('../src/spool.ts');
  // A very long poll interval keeps the tests driven by explicit drain() calls.
  return startSpoolReader(spool, cfg, onSnapshot, 3_600_000);
}

describe('spool reader', () => {
  it('reads only what has arrived since last time', async () => {
    fs.writeFileSync(spool, line({ ts: 1 }) + line({ ts: 2 }));
    const seen: Snapshot[] = [];
    const handle = await reader((s) => seen.push(s));
    assert.equal(seen.length, 2);

    fs.appendFileSync(spool, line({ ts: 3 }));
    assert.equal(handle.drain(), 1);
    assert.deepEqual(seen.map((s) => s.ts), [1, 2, 3]);
    handle.stop();
  });

  it('waits for a half-written line to be finished', async () => {
    const complete = line({ ts: 1 });
    const half = '{"ts":2,"app":"Photoshop","bundleId":"com.adobe.Ph';
    fs.writeFileSync(spool, complete + half);

    const seen: Snapshot[] = [];
    const handle = await reader((s) => seen.push(s));
    assert.equal(seen.length, 1);

    fs.appendFileSync(spool, 'otoshop","idleSeconds":0,"locked":false}\n');
    handle.drain();
    assert.deepEqual(seen.map((s) => s.ts), [1, 2]);
    handle.stop();
  });

  it('starts over when the spool is truncated underneath it', async () => {
    fs.writeFileSync(spool, line({ ts: 1 }) + line({ ts: 2 }));
    const seen: Snapshot[] = [];
    const handle = await reader((s) => seen.push(s));
    assert.equal(seen.length, 2);

    fs.truncateSync(spool, 0);
    fs.appendFileSync(spool, line({ ts: 9 }));
    handle.drain();
    assert.deepEqual(seen.map((s) => s.ts), [1, 2, 9]);
    handle.stop();
  });

  it('does not rotate while a line is still incomplete', async () => {
    fs.writeFileSync(spool, line({ ts: 1 }) + '{"ts":2,"partial":');
    const handle = await reader(() => {});
    assert.equal(handle.rotate(), false);
    assert.ok(fs.statSync(spool).size > 0);
    handle.stop();
  });

  it('rotates once everything has been consumed', async () => {
    fs.writeFileSync(spool, line({ ts: 1 }));
    const handle = await reader(() => {});
    assert.equal(handle.rotate(), true);
    assert.equal(fs.statSync(spool).size, 0);
    handle.stop();
  });

  it('resumes from the stored offset across a restart', async () => {
    fs.writeFileSync(spool, line({ ts: 1 }) + line({ ts: 2 }));
    const first: Snapshot[] = [];
    (await reader((s) => first.push(s))).stop();
    assert.equal(first.length, 2);

    fs.appendFileSync(spool, line({ ts: 3 }));
    const second: Snapshot[] = [];
    const handle = await reader((s) => second.push(s));
    assert.deepEqual(second.map((s) => s.ts), [3]);
    handle.stop();
  });

  it('skips a corrupt line and keeps going', async () => {
    fs.writeFileSync(spool, line({ ts: 1 }) + 'not json at all\n' + line({ ts: 2 }));
    const seen: Snapshot[] = [];
    const handle = await reader((s) => seen.push(s));
    assert.deepEqual(seen.map((s) => s.ts), [1, 2]);
    handle.stop();
  });

  it('applies the privacy settings to what the observer wrote', async () => {
    fs.writeFileSync(spool, line({ url: 'https://app.clickup.com/t/86aaa0001?token=secret', title: 'Poster' }));
    const seen: Snapshot[] = [];
    const cfg = config();
    cfg.privacy.redactUrlQuery = true;
    cfg.privacy.recordTitles = false;
    const handle = await reader((s) => seen.push(s), cfg);
    assert.equal(seen[0]!.url, 'https://app.clickup.com/t/86aaa0001');
    assert.equal(seen[0]!.title, null);
    handle.stop();
  });

  it('copes with the spool not existing yet', async () => {
    const seen: Snapshot[] = [];
    const handle = await reader((s) => seen.push(s));
    assert.equal(seen.length, 0);
    fs.writeFileSync(spool, line({ ts: 5 }));
    handle.drain();
    assert.equal(seen.length, 1);
    handle.stop();
  });
});
