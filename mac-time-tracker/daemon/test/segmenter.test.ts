import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { absorbFragments, buildEntries, contextKey, segment } from '../src/segmenter.ts';
import { buildContext } from '../src/matcher.ts';
import type { ActivityBlock, Snapshot } from '../src/types.ts';
import { catalog, config, rules, snapshots, T0 } from './fixtures.ts';

const cfg = config();
const totalActive = (blocks: ActivityBlock[]) => blocks.reduce((sum, b) => sum + b.activeMs, 0);

describe('contextKey', () => {
  it('ignores churning window titles when a document is open', () => {
    const base = { ts: T0, app: 'Photoshop', bundleId: 'com.adobe.Photoshop', documentPath: '/a/b.psd', url: null, idleSeconds: 0 };
    assert.equal(
      contextKey({ ...base, title: 'b.psd @ 100%' } as Snapshot),
      contextKey({ ...base, title: 'b.psd @ 250%' } as Snapshot),
    );
  });

  it('separates two pages in the same browser', () => {
    const base = { ts: T0, app: 'Chrome', bundleId: 'com.google.Chrome', documentPath: null, title: null, idleSeconds: 0 };
    assert.notEqual(
      contextKey({ ...base, url: 'https://app.clickup.com/t/86aaa0001' } as Snapshot),
      contextKey({ ...base, url: 'https://app.clickup.com/t/86bbb0001' } as Snapshot),
    );
  });

  it('treats the same page with different query strings as one context', () => {
    const base = { ts: T0, app: 'Chrome', bundleId: 'com.google.Chrome', documentPath: null, title: null, idleSeconds: 0 };
    assert.equal(
      contextKey({ ...base, url: 'https://app.clickup.com/t/86aaa0001?tab=1' } as Snapshot),
      contextKey({ ...base, url: 'https://app.clickup.com/t/86aaa0001?tab=2' } as Snapshot),
    );
  });
});

describe('segment', () => {
  it('turns a steady run of samples into one block', () => {
    const blocks = segment(
      snapshots(T0, 24, { app: 'Photoshop', bundleId: 'com.adobe.Photoshop', documentPath: '/x/a.psd' }),
      cfg,
    );
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0]!.activeMs, 24 * 5000);
    assert.deepEqual(blocks[0]!.paths, ['/x/a.psd']);
  });

  it('drops idle samples instead of billing them', () => {
    const active = snapshots(T0, 24, { app: 'Photoshop', bundleId: 'com.adobe.Photoshop', documentPath: '/x/a.psd' });
    const idle = snapshots(T0 + 24 * 5000, 60, {
      app: 'Photoshop', bundleId: 'com.adobe.Photoshop', documentPath: '/x/a.psd', idleSeconds: 900,
    });
    const blocks = segment([...active, ...idle], cfg);
    assert.equal(totalActive(blocks), 24 * 5000);
  });

  it('never counts time while the screen is locked', () => {
    const locked = snapshots(T0, 60, {
      app: 'loginwindow', bundleId: 'com.apple.loginwindow', locked: true,
    });
    assert.deepEqual(segment(locked, cfg), []);
  });

  it('splits a block when the daemon was not running in between', () => {
    const before = snapshots(T0, 24, { app: 'Photoshop', bundleId: 'com.adobe.Photoshop', documentPath: '/x/a.psd' });
    const after = snapshots(T0 + 3_600_000, 24, { app: 'Photoshop', bundleId: 'com.adobe.Photoshop', documentPath: '/x/a.psd' });
    const blocks = segment([...before, ...after], cfg);
    assert.equal(blocks.length, 2);
  });

  it('honours ignored bundle ids', () => {
    const blocks = segment(
      snapshots(T0, 60, { app: '1Password', bundleId: 'com.1password.1password' }),
      cfg,
    );
    assert.deepEqual(blocks, []);
  });
});

describe('absorbFragments', () => {
  const make = (id: string, start: number, activeMs: number): ActivityBlock => ({
    id, start, end: start + activeMs, activeMs,
    app: id, bundleId: id, titles: [], paths: [], urls: [], samples: 1,
  });

  it('conserves total time when folding a short detour away', () => {
    const blocks = [make('work', T0, 1_800_000), make('slack', T0 + 1_800_000, 20_000)];
    const result = absorbFragments(blocks, 60_000);
    assert.equal(result.length, 1);
    assert.equal(totalActive(result), 1_820_000);
  });

  it('gives the fragment to the block it sat next to', () => {
    const blocks = [
      make('early', T0, 600_000),
      make('late', T0 + 4_000_000, 600_000),
      make('detour', T0 + 4_600_000, 15_000),
    ];
    const result = absorbFragments(blocks, 60_000);
    assert.equal(result.find((b) => b.id === 'late')!.activeMs, 615_000);
    assert.equal(result.find((b) => b.id === 'early')!.activeMs, 600_000);
  });

  it('keeps something rather than losing a whole day of short blocks', () => {
    const blocks = [make('a', T0, 20_000), make('b', T0 + 20_000, 30_000)];
    const result = absorbFragments(blocks, 60_000);
    assert.equal(result.length, 1);
    assert.equal(totalActive(result), 50_000);
  });
});

describe('buildEntries', () => {
  const ctx = () => buildContext(cfg, rules, catalog());

  it('merges neighbouring blocks that landed on the same task', () => {
    const day = [
      ...snapshots(T0, 60, {
        app: 'Photoshop', bundleId: 'com.adobe.Photoshop',
        documentPath: '/Volumes/Projects/Clients/SAPN/2026/PowerlineSafety_Poster.psd',
      }),
      ...snapshots(T0 + 300_000, 60, {
        app: 'Illustrator', bundleId: 'com.adobe.Illustrator',
        documentPath: '/Volumes/Projects/Clients/SAPN/2026/PowerlineSafety_Poster_A2.ai',
      }),
    ];
    const entries = buildEntries(segment(day, cfg), ctx(), '2026-08-20');
    assert.equal(entries.length, 1);
    assert.equal(entries[0]!.suggestion.taskId, '86aaa0001');
    assert.deepEqual(entries[0]!.evidence.apps, ['Photoshop', 'Illustrator']);
  });

  it('keeps two different clients apart', () => {
    const day = [
      ...snapshots(T0, 60, {
        app: 'Photoshop', bundleId: 'com.adobe.Photoshop',
        documentPath: '/Volumes/Projects/Clients/SAPN/2026/PowerlineSafety_Poster.psd',
      }),
      ...snapshots(T0 + 300_000, 60, {
        app: 'InDesign', bundleId: 'com.adobe.InDesign',
        documentPath: '/Volumes/Projects/Clients/Resmed/2026/Sleep_clinic_brochure.indd',
      }),
    ];
    const entries = buildEntries(segment(day, cfg), ctx(), '2026-08-20');
    assert.equal(entries.length, 2);
    assert.deepEqual(entries.map((e) => e.suggestion.folderName), ['SAPN', 'Resmed']);
  });

  it('does not merge two unidentified blocks into one entry', () => {
    const day = [
      ...snapshots(T0, 30, { app: 'Terminal', bundleId: 'com.apple.Terminal' }),
      ...snapshots(T0 + 200_000, 30, { app: 'Notes', bundleId: 'com.apple.Notes' }),
    ];
    const entries = buildEntries(segment(day, cfg), ctx(), '2026-08-20');
    assert.equal(entries.length, 2);
  });

  it('rounds durations to the configured increment', () => {
    const rounded = config({ capture: { ...cfg.capture, roundToMinutes: 15, minEntryMinutes: 15 } });
    const day = snapshots(T0, 100, {
      app: 'Photoshop', bundleId: 'com.adobe.Photoshop',
      documentPath: '/Volumes/Projects/Clients/SAPN/2026/PowerlineSafety_Poster.psd',
    });
    const entries = buildEntries(
      segment(day, rounded),
      buildContext(rounded, rules, catalog()),
      '2026-08-20',
    );
    assert.equal(entries[0]!.activeMs, 500_000);
    assert.equal(entries[0]!.durationMs, 900_000);
  });
});
