import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildContext, matchBlock, LOW_CONFIDENCE } from '../src/matcher.ts';
import { segment, buildEntries } from '../src/segmenter.ts';
import { realCatalog } from './real-tasks.ts';
import { evalConfig, evalRules } from './real-cases.ts';
import type { ActivityBlock, Snapshot } from '../src/types.ts';

const T0 = new Date(2026, 7, 20, 10, 0, 0).getTime();

function context(overrides: Partial<typeof evalConfig.capture> = {}) {
  const config = structuredClone(evalConfig);
  Object.assign(config.capture, overrides);
  return { config, ctx: buildContext(config, evalRules, realCatalog()) };
}

function block(over: Partial<ActivityBlock>): ActivityBlock {
  return {
    id: 'b', start: T0, end: T0 + 600_000, activeMs: 600_000,
    app: 'DaVinci Resolve', bundleId: 'com.blackmagic-design.DaVinciResolve',
    titles: [], paths: [], urls: [], samples: 120,
    ...over,
  };
}

/**
 * Two faults that together made the tracker look like it was making things up:
 * it named a task when all it knew was which app was open, and it chopped an
 * unbroken stretch of work into fragments that each rounded up to the minimum
 * entry length — so forty minutes of editing was logged as an hour, against a
 * job nobody had touched.
 */
describe('what the tracker will and will not claim', () => {
  it('names no task when all it knows is that an app was open', () => {
    const { ctx } = context();
    // Resolve in front, nothing readable: no file, no page, no title. That is
    // what a Mac without the Accessibility grant reports all day.
    const suggestion = matchBlock(block({}), ctx);
    assert.equal(suggestion.taskId, null, `invented "${suggestion.taskName}" from an open app`);
    assert.equal(suggestion.confidence, 0);
  });

  it('still lets the app sharpen a task the evidence already points at', () => {
    // The app-phase signal is not thrown away — it just cannot carry a task on
    // its own. With a real path in hand it should still pick the edit task.
    const { ctx } = context();
    const withPath = matchBlock(block({
      app: 'Adobe Premiere Pro', bundleId: 'com.adobe.PremierePro',
      paths: ['/Volumes/Projects/Clients/Symons Clark/2026/Onboarding Visitors video/Onboarding_Visitors_edit.prproj'],
    }), ctx);
    assert.ok(withPath.taskId, 'a real file path should still match');
    assert.ok(
      withPath.confidence >= LOW_CONFIDENCE,
      `a direct path match should be confident, got ${withPath.confidence}`,
    );
  });

  it('keeps an unbroken stretch in one app as one entry', () => {
    const { config, ctx } = context({ roundToMinutes: 15, minEntryMinutes: 15 });
    // Forty minutes in Resolve. Its window list flickers between the project
    // window and a palette holding an unrelated file, so the context key keeps
    // changing even though the person never moved.
    const snapshots: Snapshot[] = Array.from({ length: 480 }, (_, i) => ({
      ts: T0 + i * 5000,
      app: 'DaVinci Resolve',
      bundleId: 'com.blackmagic-design.DaVinciResolve',
      title: null,
      documentPath: i % 40 < 4 ? '/Volumes/Projects/Clients/Resmed/2026/Old_promo.psd' : null,
      url: null,
      idleSeconds: 0,
      locked: false,
    }));

    const blocks = segment(snapshots, config);
    assert.ok(blocks.length > 1, 'the flicker should still produce several blocks');

    const entries = buildEntries(blocks, ctx, '2026-08-20');
    assert.equal(entries.length, 1, `forty unbroken minutes became ${entries.length} entries`);

    // And crucially it must not invent time. Rounding forty minutes onto a
    // fifteen-minute grid gives forty-five, and that is the whole of it — the
    // twelve fragments left unmerged would each have rounded up to fifteen
    // separately, turning forty minutes of editing into three hours.
    const measured = entries.reduce((sum, e) => sum + e.activeMs, 0);
    const logged = entries.reduce((sum, e) => sum + e.durationMs, 0);
    assert.equal(measured, 40 * 60_000);
    assert.equal(logged, 45 * 60_000, `40 measured minutes were logged as ${logged / 60_000}`);
    assert.ok(
      logged - measured <= 15 * 60_000,
      `rounding added ${(logged - measured) / 60_000} minutes, more than one step`,
    );
  });

  it('does not merge two different apps just because neither matched', () => {
    const { config, ctx } = context();
    const snapshots: Snapshot[] = Array.from({ length: 480 }, (_, i) => ({
      ts: T0 + i * 5000,
      ...(i < 240
        ? { app: 'DaVinci Resolve', bundleId: 'com.blackmagic-design.DaVinciResolve' }
        : { app: 'Finder', bundleId: 'com.apple.finder' }),
      title: null, documentPath: null, url: null, idleSeconds: 0, locked: false,
    })) as Snapshot[];

    const entries = buildEntries(segment(snapshots, config), ctx, '2026-08-20');
    assert.equal(entries.length, 2, 'two unrelated apps should stay two entries');
  });

  it('does not merge across a long gap in the same app', () => {
    const { config, ctx } = context();
    const morning: Snapshot[] = Array.from({ length: 120 }, (_, i) => ({
      ts: T0 + i * 5000, app: 'DaVinci Resolve',
      bundleId: 'com.blackmagic-design.DaVinciResolve',
      title: null, documentPath: null, url: null, idleSeconds: 0, locked: false,
    }));
    // Back in Resolve two hours later — a separate piece of work, and possibly
    // a different job.
    const afternoon = morning.map((s, i) => ({ ...s, ts: s.ts + 7_200_000 + i }));

    const entries = buildEntries(segment([...morning, ...afternoon], config), ctx, '2026-08-20');
    assert.equal(entries.length, 2);
  });
});
