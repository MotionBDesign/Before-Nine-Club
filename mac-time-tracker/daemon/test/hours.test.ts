import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { segment, withinWorkingHours } from '../src/segmenter.ts';
import { config, snapshots } from './fixtures.ts';

/** 2026-08-20 at a given local hour. */
const at = (hour: number, minute = 0) => new Date(2026, 7, 20, hour, minute, 0).getTime();

describe('working hours window', () => {
  it('accepts times inside a normal 7-19 day', () => {
    assert.equal(withinWorkingHours(at(7, 0), 7, 19), true);
    assert.equal(withinWorkingHours(at(12, 30), 7, 19), true);
    assert.equal(withinWorkingHours(at(18, 59), 7, 19), true);
  });

  it('rejects times outside it, on both ends', () => {
    assert.equal(withinWorkingHours(at(6, 59), 7, 19), false);
    assert.equal(withinWorkingHours(at(19, 0), 7, 19), false);
    assert.equal(withinWorkingHours(at(23, 30), 7, 19), false);
    assert.equal(withinWorkingHours(at(3, 0), 7, 19), false);
  });

  it('handles a window that crosses midnight', () => {
    assert.equal(withinWorkingHours(at(23, 0), 22, 6), true);
    assert.equal(withinWorkingHours(at(2, 0), 22, 6), true);
    assert.equal(withinWorkingHours(at(12, 0), 22, 6), false);
  });

  it('treats an equal start and end as no bound at all', () => {
    assert.equal(withinWorkingHours(at(3, 0), 0, 0), true);
    assert.equal(withinWorkingHours(at(23, 0), 0, 0), true);
  });
});

describe('segmenting against the working window', () => {
  const cfg = config();

  it('keeps a normal working morning', () => {
    const blocks = segment(
      snapshots(at(9), 720, { app: 'Photoshop', bundleId: 'com.adobe.Photoshop', documentPath: '/x/a.psd' }),
      cfg,
    );
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0]!.activeMs, 3_600_000);
  });

  it('drops a late-night session entirely', () => {
    // 23:00 is outside 07:00-19:00, so none of it reaches the timesheet.
    const blocks = segment(
      snapshots(at(23), 720, { app: 'After Effects', bundleId: 'com.adobe.AfterEffects', documentPath: '/x/b.aep' }),
      cfg,
    );
    assert.deepEqual(blocks, []);
  });

  it('keeps only the part of an evening session inside the window', () => {
    // 18:00 to 20:00; everything from 19:00 is discarded.
    const blocks = segment(
      snapshots(at(18), 1440, { app: 'Premiere', bundleId: 'com.adobe.PremierePro', documentPath: '/x/c.prproj' }),
      cfg,
    );
    const total = blocks.reduce((sum, b) => sum + b.activeMs, 0);
    assert.equal(total, 3_600_000, `expected one hour kept, got ${total / 60000}m`);
  });

  it('can be widened by config for a studio that works later', () => {
    const late = config();
    late.capture.dayEndHour = 23;
    const blocks = segment(
      snapshots(at(20), 720, { app: 'Premiere', bundleId: 'com.adobe.PremierePro', documentPath: '/x/d.prproj' }),
      late,
    );
    assert.equal(blocks.length, 1);
  });
});

describe('date handling east of Greenwich', () => {
  it('never uses a UTC date for "today"', async () => {
    // The bug this guards: toISOString() in Adelaide (UTC+9:30) returns
    // yesterday's date until mid-morning, so the wrong day was highlighted
    // exactly when people open the page.
    const ui = await import('../src/ui.ts');
    const page = ui.renderPage();
    assert.ok(
      !page.includes('toISOString().slice(0, 10)'),
      'the page still derives a local date from toISOString()',
    );
    assert.ok(page.includes('todayInZone'), 'expected a zone-aware today helper');
  });

  it('renders every clock time through one configured zone', async () => {
    const ui = await import('../src/ui.ts');
    const page = ui.renderPage();
    assert.ok(page.includes('Intl.DateTimeFormat'), 'times should be formatted with an explicit timeZone');
    assert.ok(!page.includes('d.getHours()'), 'no raw local-hour formatting should remain');
  });
});
