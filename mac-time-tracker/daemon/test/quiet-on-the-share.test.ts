import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { onUnmountedVolume } from '../src/paths.ts';
import { publishedVersion } from '../src/update.ts';
import { readFleet, reportStatus } from '../src/fleet.ts';

/**
 * The tracker reaches the studio share twice: to look for an update, and to
 * write its health file. Both run unattended on a timer, which means neither
 * may ever reach into a volume that is not mounted — a stat into a dead SMB
 * mount can hang for tens of seconds, and on some setups it is what puts a
 * "enter your password for the server" box on someone's screen.
 */
describe('touching the studio share', () => {
  // This box has no /Volumes, so the mount list is injected: the logic that
  // matters only ever runs on a Mac, and it should not go untested for that.
  const mounted = (...names: string[]) => () => names;

  it('recognises a path on a volume that is not mounted', () => {
    const volumes = mounted('Macintosh HD', 'Projects');
    assert.equal(onUnmountedVolume('/Volumes/MBD Server/Software/TimeTracker', volumes), true);
    assert.equal(onUnmountedVolume('/Volumes/Projects/Clients', volumes), false);
    // Names with spaces must survive the split, or the share is wrongly
    // declared missing every time.
    assert.equal(onUnmountedVolume('/Volumes/Macintosh HD/x', volumes), false);
    // Local paths are never network paths, whatever they are called.
    assert.equal(onUnmountedVolume('/Users/ashley/Volumes/thing', volumes), false);
    assert.equal(onUnmountedVolume(os.tmpdir(), volumes), false);
    assert.equal(onUnmountedVolume('~/Dropbox/MBD/TimeTracker', volumes), false);
    // The volumes directory itself is not a volume.
    assert.equal(onUnmountedVolume('/Volumes', volumes), false);
    assert.equal(onUnmountedVolume('/Volumes/', volumes), false);
  });

  it('never declares a share missing on a machine with no /Volumes at all', () => {
    // Getting this backwards would silently disable updates and reporting on
    // every non-Mac, including the machines the tests run on.
    assert.equal(onUnmountedVolume('/Volumes/Anything/x', () => null), false);
  });

  it('reports no update rather than reaching into an unmounted share', () => {
    assert.equal(publishedVersion('/Volumes/DefinitelyNotMounted/TimeTracker'), null);
    assert.equal(publishedVersion(''), null);
  });

  it('reads an empty fleet rather than reaching into an unmounted share', () => {
    assert.deepEqual(readFleet('/Volumes/DefinitelyNotMounted/TimeTracker/status'), []);
  });

  it('does nothing at all with no channel and no status folder', () => {
    // What `configure --local-only` leaves behind. There must be no path at
    // all from here to a network volume.
    assert.equal(publishedVersion(''), null);
    assert.deepEqual(readFleet(''), []);
    // reportStatus returns before touching anything; the assertion is that it
    // neither throws nor creates a directory somewhere unexpected.
    assert.doesNotThrow(() =>
      reportStatus({ fleet: { statusDir: '', reportEveryMinutes: 30 } } as never, {} as never));
  });

  it('still works normally on a folder that is actually there', () => {
    // The guard must not turn into "never read the share at all".
    const share = fs.mkdtempSync(path.join(os.tmpdir(), 'mbdtt-share-'));
    fs.writeFileSync(path.join(share, 'LATEST'), 'MBDTimeTracker-20260824-abc1234\n');
    assert.deepEqual(publishedVersion(share), {
      bundle: 'MBDTimeTracker-20260824-abc1234',
      version: '20260824-abc1234',
    });
  });
});
