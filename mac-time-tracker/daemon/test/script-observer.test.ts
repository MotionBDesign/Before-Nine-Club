import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const here = path.dirname(fileURLToPath(import.meta.url));
const bundle = path.resolve(here, '..', '..', 'observer-script', 'MBDObserver.app');

/**
 * The script observer replaces the Swift one on Macs with no developer tools.
 * Its whole contract is the shape of the line it appends to the spool, so that
 * is what these check — a drift here would break tracking silently.
 */
describe('script observer bundle', () => {
  it('is a well-formed app bundle', () => {
    assert.ok(fs.existsSync(path.join(bundle, 'Contents', 'Info.plist')));
    assert.ok(fs.existsSync(path.join(bundle, 'Contents', 'MacOS', 'MBDObserver')));
    assert.ok(fs.existsSync(path.join(bundle, 'Contents', 'Resources', 'sample.js')));
  });

  it('ships its executable with the executable bit set', () => {
    const mode = fs.statSync(path.join(bundle, 'Contents', 'MacOS', 'MBDObserver')).mode;
    assert.ok(mode & 0o111, 'MBDObserver is not executable');
  });

  it('declares itself a background helper with a stable identity', () => {
    const plist = fs.readFileSync(path.join(bundle, 'Contents', 'Info.plist'), 'utf8');
    // LSUIElement keeps it out of the Dock; the bundle id is what the
    // Accessibility grant attaches to.
    assert.match(plist, /<key>LSUIElement<\/key>\s*<true\/>/);
    assert.match(plist, /au\.com\.motionbydesign\.observer/);
    assert.match(plist, /<key>CFBundleExecutable<\/key>\s*<string>MBDObserver<\/string>/);
  });

  it('accepts the same arguments as the Swift observer', () => {
    const script = fs.readFileSync(path.join(bundle, 'Contents', 'MacOS', 'MBDObserver'), 'utf8');
    for (const flag of ['--interval', '--out', '--browser-urls']) {
      assert.ok(script.includes(flag), `the script observer ignores ${flag}`);
    }
  });

  it('emits a snapshot the daemon can actually parse', async () => {
    // Run the sampler's logic with System Events stubbed, which is the part
    // that cannot be exercised on anything but a Mac.
    const source = fs.readFileSync(path.join(bundle, 'Contents', 'Resources', 'sample.js'), 'utf8');
    const factory = new Function('Application', `${source}; return run;`);

    const stubApp = (name: string) => {
      if (name === 'System Events') {
        return {
          applicationProcesses: {
            whose: () => [{
              name: () => 'Adobe Photoshop 2026',
              bundleIdentifier: () => 'com.adobe.Photoshop',
              windows: [{
                title: () => 'Curtailment_styleframes_01.psd',
                attributes: {
                  byName: () => ({
                    value: () => 'file:///Volumes/Projects/Clients/SAPN/2026/Curtailment%20styleframes.psd',
                  }),
                },
              }],
            }],
          },
        };
      }
      return {};
    };

    const run = factory(stubApp);
    const line = run(['12', 'false']);
    const snapshot = JSON.parse(line);

    // Exactly the fields daemon/src/types.ts declares.
    assert.equal(typeof snapshot.ts, 'number');
    assert.equal(snapshot.app, 'Adobe Photoshop 2026');
    assert.equal(snapshot.bundleId, 'com.adobe.Photoshop');
    assert.equal(snapshot.title, 'Curtailment_styleframes_01.psd');
    assert.equal(snapshot.idleSeconds, 12);
    assert.equal(snapshot.locked, false);
    // file:// URLs must arrive percent-decoded, or path matching silently fails.
    assert.equal(snapshot.documentPath, '/Volumes/Projects/Clients/SAPN/2026/Curtailment styleframes.psd');
    assert.equal(snapshot.url, null);
  });

  it('records nothing but the app while the screen is locked', () => {
    const source = fs.readFileSync(path.join(bundle, 'Contents', 'Resources', 'sample.js'), 'utf8');
    const run = new Function('Application', `${source}; return run;`)(() => ({}));
    const snapshot = JSON.parse(run(['900', 'true']));
    assert.equal(snapshot.locked, true);
    assert.equal(snapshot.title, null);
    assert.equal(snapshot.documentPath, null);
  });

  it('produces a snapshot the segmenter accepts', async () => {
    const source = fs.readFileSync(path.join(bundle, 'Contents', 'Resources', 'sample.js'), 'utf8');
    const run = new Function('Application', `${source}; return run;`)((name: string) =>
      name === 'System Events'
        ? {
            applicationProcesses: {
              whose: () => [{
                name: () => 'Photoshop',
                bundleIdentifier: () => 'com.adobe.Photoshop',
                windows: [{ title: () => 'a.psd', attributes: { byName: () => ({ value: () => '/x/a.psd' }) } }],
              }],
            },
          }
        : {});

    const { segment } = await import('../src/segmenter.ts');
    const { config } = await import('./fixtures.ts');
    const base = new Date(2026, 7, 20, 10, 0, 0).getTime();

    // A run of identical samples, exactly as the spool would carry them.
    const snapshots = Array.from({ length: 240 }, (_, i) => ({
      ...JSON.parse(run(['0', 'false'])),
      ts: base + i * 5000,
    }));

    const blocks = segment(snapshots, config());
    assert.equal(blocks.length, 1, 'the segmenter should see one continuous block');
    assert.equal(blocks[0]!.paths[0], '/x/a.psd');
    assert.equal(blocks[0]!.activeMs, 240 * 5000);
  });
});
