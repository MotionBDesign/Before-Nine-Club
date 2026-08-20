import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import type { DayFile, ProposedEntry } from '../src/types.ts';
import { config } from './fixtures.ts';

let home: string;

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'mbdtt-safety-'));
  process.env.MBD_TT_HOME = home;
  process.env.MBD_TT_LOG_FILE = '0';
});

afterEach(() => {
  fs.rmSync(home, { recursive: true, force: true });
  delete process.env.MBD_TT_HOME;
});

describe('instance lock', () => {
  it('lets the first daemon in and keeps the second out', async () => {
    const { InstanceLock } = await import('../src/lock.ts');
    const first = new InstanceLock(path.join(home, 'daemon.lock'));
    const second = new InstanceLock(path.join(home, 'daemon.lock'));

    assert.equal(first.acquire(), null);
    const refusal = second.acquire();
    assert.ok(refusal, 'the second daemon should have been refused');
    assert.match(refusal, /already running/);
  });

  it('lets the next daemon in once the first releases', async () => {
    const { InstanceLock } = await import('../src/lock.ts');
    const file = path.join(home, 'daemon.lock');
    const first = new InstanceLock(file);
    first.acquire();
    first.release();
    assert.equal(new InstanceLock(file).acquire(), null);
  });

  it('clears a lock left behind by a process that no longer exists', async () => {
    const { InstanceLock } = await import('../src/lock.ts');
    const file = path.join(home, 'daemon.lock');
    // A pid that cannot be running: the kernel never assigns pid 0 to a user
    // process, and the check treats it as dead.
    fs.writeFileSync(file, JSON.stringify({ pid: 999_999, hostname: 'old', startedAt: Date.now() - 86_400_000 }));
    assert.equal(new InstanceLock(file).acquire(), null);
  });

  it('does not remove a lock that now belongs to someone else', async () => {
    const { InstanceLock } = await import('../src/lock.ts');
    const file = path.join(home, 'daemon.lock');
    const lock = new InstanceLock(file);
    lock.acquire();
    fs.writeFileSync(file, JSON.stringify({ pid: 4321, hostname: 'other', startedAt: Date.now() }));
    lock.release();
    assert.ok(fs.existsSync(file), 'released a lock it no longer owned');
  });
});

describe('push safety', () => {
  const entry = (over: Partial<ProposedEntry> = {}): ProposedEntry => ({
    id: 'e1', date: '2026-08-20', start: 1_755_000_000_000, end: 1_755_003_600_000,
    activeMs: 3_600_000, durationMs: 3_600_000, blockIds: ['b1'],
    evidence: { apps: ['Photoshop'], paths: [], titles: [], urls: [] },
    suggestion: {
      taskId: '86d3pjg2b', taskName: 'Symons - Mining Brochure', listId: 'l', listName: 'l',
      folderName: 'Symons Clark', spaceName: 's', confidence: 0.9, reasons: [], alternatives: [], billable: true,
    },
    status: 'approved', taskId: '86d3pjg2b', description: 'brochure.indd', billable: true,
    ...over,
  });

  const day = (entries: ProposedEntry[]): DayFile => ({ date: '2026-08-20', updatedAt: 0, entries });

  function stubClient(behaviour: {
    onCreate: () => Promise<{ data: { id: string } }>;
    existing?: Array<{ id: string; task?: { id?: string }; start?: number }>;
  }) {
    let creates = 0;
    return {
      calls: () => creates,
      client: {
        createTimeEntry: async () => { creates++; return behaviour.onCreate(); },
        getTimeEntries: async () => ({ data: behaviour.existing ?? [] }),
      } as never,
    };
  }

  it('writes one entry per approved line and marks it synced', async () => {
    const { pushApproved } = await import('../src/sync.ts');
    const cfg = config(); cfg.clickup.workspaceId = '9003163669';
    const stub = stubClient({ onCreate: async () => ({ data: { id: 'te-1' } }) });
    const d = day([entry()]);

    const result = await pushApproved(stub.client, cfg, d);
    assert.equal(result.pushed, 1);
    assert.equal(stub.calls(), 1);
    assert.equal(d.entries[0]!.status, 'synced');
    assert.equal(d.entries[0]!.clickupEntryId, 'te-1');
  });

  it('never pushes an entry that is already synced', async () => {
    const { pushApproved } = await import('../src/sync.ts');
    const cfg = config(); cfg.clickup.workspaceId = '9003163669';
    const stub = stubClient({ onCreate: async () => ({ data: { id: 'te-2' } }) });

    const result = await pushApproved(stub.client, cfg, day([entry({ status: 'synced' })]));
    assert.equal(result.pushed, 0);
    assert.equal(stub.calls(), 0);
  });

  it('adopts the existing entry when the write landed but the reply did not', async () => {
    // The duplicate-billing case: ClickUp committed, the connection dropped.
    const { pushApproved } = await import('../src/sync.ts');
    const cfg = config(); cfg.clickup.workspaceId = '9003163669';
    const stub = stubClient({
      onCreate: async () => { throw new Error('socket hang up'); },
      existing: [{ id: 'te-already-there', task: { id: '86d3pjg2b' }, start: 1_755_000_000_000 }],
    });
    const d = day([entry()]);

    const result = await pushApproved(stub.client, cfg, d);
    assert.equal(result.reconciled, 1);
    assert.equal(result.pushed, 0);
    assert.equal(result.failures.length, 0);
    assert.equal(d.entries[0]!.status, 'synced');
    assert.equal(d.entries[0]!.clickupEntryId, 'te-already-there');
  });

  it('reports a genuine failure rather than inventing a success', async () => {
    const { pushApproved } = await import('../src/sync.ts');
    const cfg = config(); cfg.clickup.workspaceId = '9003163669';
    const stub = stubClient({ onCreate: async () => { throw new Error('401 unauthorized'); }, existing: [] });
    const d = day([entry()]);

    const result = await pushApproved(stub.client, cfg, d);
    assert.equal(result.pushed, 0);
    assert.equal(result.failures.length, 1);
    assert.equal(d.entries[0]!.status, 'approved', 'a failed entry must stay approved for a retry');
  });

  it('does not match an entry for a different task when reconciling', async () => {
    const { pushApproved } = await import('../src/sync.ts');
    const cfg = config(); cfg.clickup.workspaceId = '9003163669';
    const stub = stubClient({
      onCreate: async () => { throw new Error('socket hang up'); },
      existing: [{ id: 'te-other', task: { id: 'SOME-OTHER-TASK' }, start: 1_755_000_000_000 }],
    });
    const d = day([entry()]);

    const result = await pushApproved(stub.client, cfg, d);
    assert.equal(result.reconciled, 0);
    assert.equal(result.failures.length, 1);
  });

  it('refuses to run two pushes over the same day at once', async () => {
    const { pushApproved } = await import('../src/sync.ts');
    const cfg = config(); cfg.clickup.workspaceId = '9003163669';
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const stub = stubClient({ onCreate: async () => { await gate; return { data: { id: 'te-3' } }; } });
    const d = day([entry()]);

    const first = pushApproved(stub.client, cfg, d);
    const second = await pushApproved(stub.client, cfg, day([entry({ id: 'e2' })]));
    assert.match(second.failures[0]?.reason ?? '', /already running/);

    release();
    assert.equal((await first).pushed, 1);
    assert.equal(stub.calls(), 1, 'the second push must not have created anything');
  });

  it('will not push without a workspace id', async () => {
    const { pushApproved } = await import('../src/sync.ts');
    const cfg = config(); cfg.clickup.workspaceId = '';
    const stub = stubClient({ onCreate: async () => ({ data: { id: 'x' } }) });

    const result = await pushApproved(stub.client, cfg, day([entry()]));
    assert.equal(stub.calls(), 0);
    assert.match(result.failures[0]?.reason ?? '', /workspaceId/);
  });
});
