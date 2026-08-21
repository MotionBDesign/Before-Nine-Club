import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readMemory, DAEMON_RSS_WARN_MB, OBSERVER_RSS_WARN_MB } from '../src/health.ts';
import { assess } from '../src/fleet.ts';
import type { FleetStatus } from '../src/fleet.ts';

function status(overrides: Partial<FleetStatus> = {}): FleetStatus {
  return {
    mac: 'studio-imac', user: 'ashley', version: '2026.08.21',
    reportedAt: Date.now(), daemonStartedAt: Date.now() - 3_600_000,
    observerLastSampleAgeSeconds: 5, observerHealthy: true, accessibilityLikelyGranted: true,
    hasToken: true, catalogTasks: 113,
    today: { date: '2026-08-21', loggedMinutes: 400, billableMinutes: 400, pendingMinutes: 0, syncedMinutes: 400 },
    targets: { dailyMinutes: 390, billableMinutes: 390 },
    memory: { daemonMB: 60, observerMB: 25, observerPid: 900, observerName: 'MBD Time Tracker.app' },
    lastError: null,
    ...overrides,
  };
}

describe('memory health', () => {
  it('reads its own resident memory', () => {
    const reading = readMemory();
    assert.ok(reading.daemonMB > 0, 'the daemon reported no memory at all');
    // A Node process that has loaded this suite is nowhere near the ceiling;
    // if it were, the ceiling would be the thing that is wrong.
    assert.ok(reading.daemonMB < DAEMON_RSS_WARN_MB, `baseline is already ${reading.daemonMB}MB`);
  });

  it('reports no observer when none is running', () => {
    // Nothing named "MBD Time Tracker.app" or BNObserver exists here, and a
    // wrong match would be worse than none: it would report a stranger's
    // memory as the tracker's.
    const reading = readMemory();
    assert.equal(reading.observerMB, null);
    assert.equal(reading.observerPid, null);
  });

  it('flags a Mac whose tracker is eating memory', () => {
    const daemon = assess(status({
      memory: { daemonMB: DAEMON_RSS_WARN_MB + 1, observerMB: 20, observerPid: 1, observerName: 'x' },
    }));
    assert.equal(daemon.verdict, 'attention');
    assert.match(daemon.note, /daemon is using/);

    const observer = assess(status({
      memory: { daemonMB: 50, observerMB: OBSERVER_RSS_WARN_MB + 1, observerPid: 1, observerName: 'x' },
    }));
    assert.equal(observer.verdict, 'attention');
    assert.match(observer.note, /observer is using/);
  });

  it('says nothing about a healthy Mac, or one reporting from an older version', () => {
    assert.equal(assess(status()).verdict, 'ok');
    // A status file written before memory was reported must not be read as a
    // fault; it just predates the field.
    assert.equal(assess(status({ memory: undefined })).verdict, 'ok');
  });

  it('puts a real failure ahead of memory', () => {
    const both = assess(status({
      observerHealthy: false,
      memory: { daemonMB: 9999, observerMB: 9999, observerPid: 1, observerName: 'x' },
    }));
    assert.equal(both.verdict, 'broken');
  });
});
