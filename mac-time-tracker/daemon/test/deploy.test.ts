import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { applyDeploySettings, deriveChannel, readPackagedDeploy } from '../src/deploy.ts';

function tempConfig(contents: unknown): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mbdtt-deploy-'));
  const file = path.join(dir, 'config.json');
  fs.writeFileSync(file, JSON.stringify(contents, null, 2));
  return file;
}

describe('deploy settings', () => {
  it('sets the channel and status folder without disturbing anything else', () => {
    // The whole point: the person running the installer has already edited
    // quickLog and projectRoots. Rewriting those would be worse than leaving
    // the Mac unconnected.
    const file = tempConfig({
      clickup: { workspaceId: '9003163669', catalogTtlMinutes: 60 },
      capture: { roundToMinutes: 15 },
      update: { channel: '', checkEveryHours: 6, autoApply: true },
      fleet: { statusDir: '', reportEveryMinutes: 30 },
      quickLog: [{ label: 'MBD Meeting', taskId: '86d2c5302', minutes: 30, billable: false }],
    });

    const result = applyDeploySettings(
      { channel: '/Volumes/Server/TimeTracker', statusDir: '/Volumes/Server/TimeTracker/status' },
      file,
    );
    assert.equal(result.unchanged, false);

    const after = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(after.update.channel, '/Volumes/Server/TimeTracker');
    assert.equal(after.fleet.statusDir, '/Volumes/Server/TimeTracker/status');
    // Untouched, all of it.
    assert.equal(after.update.checkEveryHours, 6);
    assert.equal(after.update.autoApply, true);
    assert.equal(after.fleet.reportEveryMinutes, 30);
    assert.equal(after.capture.roundToMinutes, 15);
    assert.equal(after.clickup.workspaceId, '9003163669');
    assert.equal(after.quickLog.length, 1);
    assert.equal(after.quickLog[0].taskId, '86d2c5302');
  });

  it('fixes the logging grid on an install that predates the policy', () => {
    // Every Mac installed from the old example config is on 5-minute blocks.
    // Updates replace code, not config, so this is the only way to move them.
    const file = tempConfig({
      capture: { sampleIntervalSeconds: 5, roundToMinutes: 5, minEntryMinutes: 5, dayStartHour: 7 },
      quickLog: [{ label: 'MBD Meeting', taskId: '86d2c5302', minutes: 30, billable: false }],
    });
    applyDeploySettings({ roundMinutes: 15 }, file);
    const after = JSON.parse(fs.readFileSync(file, 'utf8'));
    // Both together: rounding to 15 while still allowing 5-minute entries
    // would leave the short ones untouched and the day uneven.
    assert.equal(after.capture.roundToMinutes, 15);
    assert.equal(after.capture.minEntryMinutes, 15);
    assert.equal(after.capture.sampleIntervalSeconds, 5, 'the sampling rate is unrelated');
    assert.equal(after.capture.dayStartHour, 7);
    assert.equal(after.quickLog.length, 1);
  });

  it('does not write defaults into the file', () => {
    // Going through the typed config loader would fill in every default, which
    // silently opts the Mac out of any later change to them.
    const file = tempConfig({ update: { channel: '' } });
    applyDeploySettings({ channel: '/share' }, file);
    const after = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.deepEqual(Object.keys(after), ['update']);
    assert.equal(after.capture, undefined);
    assert.equal(after.targets, undefined);
  });

  it('reports when nothing changed, so re-running the installer is quiet', () => {
    const file = tempConfig({ update: { channel: '/share' }, fleet: { statusDir: '/share/status' } });
    const result = applyDeploySettings({ channel: '/share', statusDir: '/share/status' }, file);
    assert.equal(result.unchanged, true);
  });

  it('flags a path that is not reachable rather than failing silently', () => {
    // A wrong path is worse than an empty one: the tracker works perfectly and
    // reports to nobody, and nobody finds out for weeks.
    const file = tempConfig({});
    const result = applyDeploySettings({ channel: '/Volumes/NotMounted/TimeTracker' }, file);
    assert.deepEqual(result.unreachable, ['/Volumes/NotMounted/TimeTracker']);

    const real = fs.mkdtempSync(path.join(os.tmpdir(), 'mbdtt-share-'));
    assert.deepEqual(applyDeploySettings({ channel: real }, tempConfig({})).unreachable, []);
  });

  it('works on a config file that does not exist yet', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mbdtt-deploy-'));
    const file = path.join(dir, 'config.json');
    applyDeploySettings({ channel: '/share' }, file);
    assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).update.channel, '/share');
  });

  it('derives the channel from a staged bundle, and only from one', () => {
    // A staged bundle sits at <channel>/MBDTimeTracker-<version>/, and the
    // channel is whichever folder holds LATEST. Right by construction.
    const share = fs.mkdtempSync(path.join(os.tmpdir(), 'mbdtt-share-'));
    const bundle = path.join(share, 'MBDTimeTracker-20260821-abc1234');
    fs.mkdirSync(bundle);
    assert.equal(deriveChannel(bundle), null, 'derived a channel with no LATEST next door');

    fs.writeFileSync(path.join(share, 'LATEST'), 'MBDTimeTracker-20260821-abc1234\n');
    assert.equal(deriveChannel(bundle), share);

    // An unzipped download in Downloads must not be mistaken for a channel.
    const downloads = fs.mkdtempSync(path.join(os.tmpdir(), 'mbdtt-dl-'));
    const unzipped = path.join(downloads, 'MBD-TimeTracker-20260821', 'app');
    fs.mkdirSync(unzipped, { recursive: true });
    assert.equal(deriveChannel(unzipped), null);
  });

  it('reads settings baked into a package, and shrugs at one without them', () => {
    const packaged = fs.mkdtempSync(path.join(os.tmpdir(), 'mbdtt-pkg-'));
    assert.equal(readPackagedDeploy(packaged), null);

    fs.writeFileSync(
      path.join(packaged, 'deploy.json'),
      JSON.stringify({ channel: '/Volumes/Server/TimeTracker', statusDir: '/Volumes/Server/TimeTracker/status' }),
    );
    assert.equal(readPackagedDeploy(packaged)?.channel, '/Volumes/Server/TimeTracker');
  });
});
