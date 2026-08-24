import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const here = path.dirname(fileURLToPath(import.meta.url));
const applet = path.resolve(here, '..', '..', 'observer-script', 'MBDTimeTracker.js');
const source = fs.readFileSync(applet, 'utf8');

/**
 * The script observer is what every Mac without developer tools actually runs.
 * It is JavaScript for Automation, compiled to an .app at install time, so it
 * cannot be imported — but its logic is ordinary JavaScript, and everything
 * macOS-specific arrives through three globals. Stub those and the whole
 * sampler runs here, which is the only way any of this gets exercised off a
 * Mac. What is being pinned down is the shape of the line it appends to the
 * spool: drift there breaks tracking silently.
 */

interface Stubs {
  /** Frontmost process, as System Events would describe it. */
  front?: {
    name: string;
    bundleId?: string;
    /** The window with keyboard focus — what the person is actually in. */
    focused?: { title?: string | null; axDocument?: string | null } | null;
    /** windows[0]: often a palette, an inspector, or another open document. */
    title?: string | null;
    axDocument?: string | null;
    /** Apps that do not publish AXFocusedWindow at all. */
    noFocusedWindow?: boolean;
  };
  /** Raw ioreg HIDIdleTime output, in nanoseconds. */
  idleNanos?: string;
  locked?: boolean;
  /** Contents of config.json, or undefined for "no file". */
  config?: unknown;
  /** Browser answers, keyed by bundle id. */
  browser?: { url?: string; mode?: string };
}

interface Harness {
  run: () => void;
  idle: () => number;
  quit: () => boolean;
  lines: string[];
  snapshot: () => Record<string, unknown>;
  shellCommands: string[];
  appsAsked: string[];
  spoolPath: () => string;
  exits: number[];
}

function load(stubs: Stubs = {}): Harness {
  const lines: string[] = [];
  const shellCommands: string[] = [];
  const appsAsked: string[] = [];
  const files = new Map<string, string>();
  let spool = '';

  const objcString = (value: string | undefined) => ({ js: value });

  const fileManager = {
    fileExistsAtPath: (p: string) => files.has(String(p)),
    createDirectoryAtPathWithIntermediateDirectoriesAttributesError: (p: string) => {
      files.set(String(p), '');
      return true;
    },
    createFileAtPathContentsAttributes: (p: string, data: { text: string }) => {
      spool = String(p);
      files.set(String(p), data.text);
      for (const line of data.text.split('\n')) if (line) lines.push(line);
      return true;
    },
  };

  const exits: number[] = [];
  const dollar: any = () => null;
  dollar.exit = (code: number) => { exits.push(code); };
  dollar.NSUTF8StringEncoding = 4;
  dollar.NSHomeDirectory = () => objcString('/Users/tester');
  dollar.NSFileManager = { defaultManager: fileManager };
  dollar.NSString = {
    alloc: {
      initWithUTF8String: (text: string) => ({
        dataUsingEncoding: () => ({ text: String(text) }),
      }),
    },
    stringWithContentsOfFileEncodingError: (p: string) =>
      objcString(files.get(String(p))),
  };
  dollar.NSFileHandle = {
    fileHandleForWritingAtPath: (p: string) => ({
      js: String(p),
      seekToEndOfFile: undefined,
      writeData: (data: { text: string }) => {
        spool = String(p);
        files.set(String(p), (files.get(String(p)) ?? '') + data.text);
        for (const line of data.text.split('\n')) if (line) lines.push(line);
      },
      closeFile: undefined,
    }),
  };

  if (stubs.config !== undefined) {
    files.set(
      '/Users/tester/Library/Application Support/MBDTimeTracker/config.json',
      JSON.stringify(stubs.config),
    );
  }

  const ObjC = {
    import: () => undefined,
    unwrap: (value: any) =>
      value !== null && typeof value === 'object' && 'js' in value ? value.js : value,
  };

  const currentApplication = {
    includeStandardAdditions: false,
    doShellScript: (command: string) => {
      shellCommands.push(String(command));
      if (command.includes('HIDIdleTime')) return stubs.idleNanos ?? '"HIDIdleTime" = 0';
      if (command.includes('CGSSessionScreenIsLocked')) {
        return stubs.locked ? '"CGSSessionScreenIsLocked" = Yes' : '';
      }
      return '';
    },
  };

  const front = stubs.front;
  /** An accessibility element: unknown attributes throw, as they do on a Mac. */
  const element = (attrs: Record<string, unknown>) => ({
    title: () => attrs.AXTitle ?? null,
    attributes: {
      byName: (key: string) => ({
        value: () => {
          if (!(key in attrs)) throw new Error(`no ${key}`);
          return attrs[key];
        },
      }),
    },
  });

  const firstWindow = front && element({
    ...(front.title !== undefined ? { AXTitle: front.title } : {}),
    ...(front.axDocument !== undefined ? { AXDocument: front.axDocument } : {}),
  });
  const focusedWindow = front?.focused
    ? element({
        ...(front.focused.title !== undefined ? { AXTitle: front.focused.title } : {}),
        ...(front.focused.axDocument !== undefined ? { AXDocument: front.focused.axDocument } : {}),
      })
    : null;

  const process_ = front && {
    name: () => front.name,
    bundleIdentifier: () => {
      if (front.bundleId === undefined) throw new Error('no bundle id');
      return front.bundleId;
    },
    attributes: {
      byName: (key: string) => ({
        value: () => {
          if (key !== 'AXFocusedWindow') throw new Error(`no ${key}`);
          // Some apps never publish it; others publish it as null.
          if (front.noFocusedWindow) throw new Error('no AXFocusedWindow');
          return focusedWindow;
        },
      }),
    },
    windows: [firstWindow],
  };

  const Application: any = (name: string) => {
    appsAsked.push(String(name));
    if (name === 'System Events') {
      return {
        applicationProcesses: {
          whose: () => (process_ ? [process_] : []),
        },
      };
    }
    if (stubs.browser) {
      const window = {
        mode: () => {
          if (stubs.browser!.mode === undefined) throw new Error('no mode');
          return stubs.browser!.mode;
        },
        activeTab: { url: () => stubs.browser!.url ?? '' },
      };
      return { windows: [window], documents: [{ url: () => stubs.browser!.url ?? '' }] };
    }
    throw new Error(`no stub for ${name}`);
  };
  Application.currentApplication = () => currentApplication;

  const factory = new Function(
    'ObjC',
    'Application',
    '$',
    `${source}\nreturn { run: run, idle: idle, quit: quit };`,
  );
  const handlers = factory(ObjC, Application, dollar);

  return {
    ...handlers,
    lines,
    shellCommands,
    appsAsked,
    exits,
    spoolPath: () => spool,
    snapshot: () => {
      handlers.run();
      handlers.idle();
      return JSON.parse(lines[lines.length - 1]!);
    },
  };
}

describe('script observer applet', () => {
  it('exports the three handlers an osacompile applet is driven by', () => {
    // `osacompile -s` keeps the applet alive and calls idle() on a timer;
    // without these three it would launch, do nothing, and quit.
    for (const handler of ['function run(', 'function idle(', 'function quit(']) {
      assert.ok(source.includes(handler), `the applet has no ${handler}…`);
    }
  });

  it('appends one line per tick and asks to be called again on the interval', () => {
    const observer = load({ front: { name: 'Finder', bundleId: 'com.apple.finder' } });
    observer.run();
    assert.equal(observer.idle(), 5);
    assert.equal(observer.lines.length, 1);
    assert.equal(observer.idle(), 5);
    assert.equal(observer.lines.length, 2);
  });

  it('emits a snapshot the daemon can actually parse', () => {
    const observer = load({
      idleNanos: '"HIDIdleTime" = 12000000000',
      front: {
        name: 'Adobe Photoshop 2026',
        bundleId: 'com.adobe.Photoshop',
        title: 'Curtailment_styleframes_01.psd',
        axDocument: 'file:///Volumes/Projects/Clients/SAPN/2026/Curtailment%20styleframes.psd',
      },
    });
    const snapshot = observer.snapshot();

    // Exactly the fields daemon/src/types.ts declares.
    assert.equal(typeof snapshot.ts, 'number');
    assert.equal(snapshot.app, 'Adobe Photoshop 2026');
    assert.equal(snapshot.bundleId, 'com.adobe.Photoshop');
    assert.equal(snapshot.title, 'Curtailment_styleframes_01.psd');
    assert.equal(snapshot.idleSeconds, 12);
    assert.equal(snapshot.locked, false);
    // file:// URLs must arrive percent-decoded, or path matching silently fails.
    assert.equal(
      snapshot.documentPath,
      '/Volumes/Projects/Clients/SAPN/2026/Curtailment styleframes.psd',
    );
    assert.equal(snapshot.url, null);
  });

  it('still reports the app when Accessibility has not been granted', () => {
    // Without the grant, title and AXDocument throw. Losing them must not cost
    // the sample: the app alone still tells the matcher which phase this is.
    const observer = load({
      front: { name: 'DaVinci Resolve', bundleId: 'com.blackmagic-design.DaVinciResolve' },
    });
    const snapshot = observer.snapshot();
    assert.equal(snapshot.app, 'DaVinci Resolve');
    assert.equal(snapshot.bundleId, 'com.blackmagic-design.DaVinciResolve');
    assert.equal(snapshot.title, null);
    assert.equal(snapshot.documentPath, null);
  });

  it('records nothing but the clock while the screen is locked', () => {
    const observer = load({
      locked: true,
      idleNanos: '"HIDIdleTime" = 900000000000',
      front: { name: 'Adobe Photoshop 2026', bundleId: 'com.adobe.Photoshop', title: 'secret.psd' },
    });
    const snapshot = observer.snapshot();
    assert.equal(snapshot.locked, true);
    assert.equal(snapshot.app, 'unknown');
    assert.equal(snapshot.title, null);
    assert.equal(snapshot.documentPath, null);
    assert.equal(snapshot.idleSeconds, 900);
    // And it must not have gone near System Events, which would only stall
    // against the login window.
    assert.ok(!observer.appsAsked.includes('System Events'));
  });

  it('never records a private browsing window', () => {
    const observer = load({
      front: { name: 'Google Chrome', bundleId: 'com.google.Chrome', title: 'Gmail' },
      browser: { mode: 'incognito', url: 'https://mail.google.com/' },
    });
    const snapshot = observer.snapshot();
    assert.equal(snapshot.url, null);
    assert.equal(snapshot.title, null);
  });

  it('reads a normal browser tab', () => {
    const observer = load({
      front: { name: 'Google Chrome', bundleId: 'com.google.Chrome', title: 'Figma' },
      browser: { mode: 'normal', url: 'https://www.figma.com/design/abc/SAPN-Curtailment' },
    });
    assert.equal(observer.snapshot().url, 'https://www.figma.com/design/abc/SAPN-Curtailment');
  });

  it('takes its interval and spool path from the daemon config', () => {
    const observer = load({
      front: { name: 'Finder', bundleId: 'com.apple.finder' },
      config: {
        capture: { sampleIntervalSeconds: 11 },
        observer: { spoolPath: '/Users/tester/elsewhere/observer.ndjson' },
      },
    });
    observer.run();
    assert.equal(observer.idle(), 11);
    assert.equal(observer.spoolPath(), '/Users/tester/elsewhere/observer.ndjson');
  });

  it('keeps its defaults when the config is malformed', () => {
    const observer = load({ front: { name: 'Finder', bundleId: 'com.apple.finder' } });
    // load() with no config leaves the file missing, which is the same path a
    // half-written file takes. Either way tracking must not stop.
    observer.run();
    assert.equal(observer.idle(), 5);
    assert.ok(observer.spoolPath().endsWith('/MBDTimeTracker/observer.ndjson'));
  });

  it('reads the window being worked in, not whichever one is first', () => {
    // The bug this pins: windows[0] is the first window in the process's list,
    // which in an app with palettes and several open documents is regularly
    // not the one in front. Reporting it put time against a file that merely
    // happened to be open — the tracker looking like it invented things.
    const observer = load({
      front: {
        name: 'Adobe Photoshop 2026',
        bundleId: 'com.adobe.Photoshop',
        title: 'Colour',
        axDocument: 'file:///Volumes/Projects/Clients/Resmed/2026/Old_promo.psd',
        focused: {
          title: 'Curtailment_styleframes_01.psd',
          axDocument: 'file:///Volumes/Projects/Clients/SAPN/2026/Curtailment_styleframes_01.psd',
        },
      },
    });
    const snapshot = observer.snapshot();
    assert.equal(snapshot.title, 'Curtailment_styleframes_01.psd');
    assert.equal(
      snapshot.documentPath,
      '/Volumes/Projects/Clients/SAPN/2026/Curtailment_styleframes_01.psd',
    );
  });

  it('falls back to the first window for apps that publish no focused one', () => {
    // A rough answer beats none: plenty of apps never expose AXFocusedWindow.
    const observer = load({
      front: {
        name: 'DaVinci Resolve',
        bundleId: 'com.blackmagic-design.DaVinciResolve',
        noFocusedWindow: true,
        title: 'DaVinci Resolve 19 - Curtailment_v04',
      },
    });
    assert.equal(observer.snapshot().title, 'DaVinci Resolve 19 - Curtailment_v04');
  });

  it('quits after its recycle window so launchd starts a fresh process', () => {
    // The applet is meant to run for weeks; AppleScript's runtime is not. It
    // is cheaper to be short-lived than to chase allocations inside a runtime
    // that offers no way to measure them.
    const observer = load({
      front: { name: 'Finder', bundleId: 'com.apple.finder' },
      config: { observer: { recycleMinutes: 0.0001 } },  // 6ms
    });
    observer.run();
    observer.idle();
    assert.deepEqual(observer.exits, [], 'it quit on the very first tick');

    const slept = Date.now() + 15;
    while (Date.now() < slept) { /* the window is milliseconds; just wait it out */ }
    observer.idle();
    // Non-zero, so a launch agent still configured with SuccessfulExit:false
    // brings it back rather than treating the recycle as a clean stop.
    assert.deepEqual(observer.exits, [1]);
    // And the sample for that tick was written before quitting.
    assert.equal(observer.lines.length, 2);
  });

  it('never recycles when the config turns it off', () => {
    const observer = load({
      front: { name: 'Finder', bundleId: 'com.apple.finder' },
      config: { observer: { recycleMinutes: 0 } },
    });
    observer.run();
    for (let i = 0; i < 5; i++) observer.idle();
    assert.deepEqual(observer.exits, []);
  });

  it('produces snapshots the segmenter accepts', async () => {
    const observer = load({
      front: {
        name: 'Adobe Photoshop 2026',
        bundleId: 'com.adobe.Photoshop',
        title: 'a.psd',
        axDocument: '/x/a.psd',
      },
    });
    const { segment } = await import('../src/segmenter.ts');
    const { config } = await import('./fixtures.ts');
    const base = new Date(2026, 7, 20, 10, 0, 0).getTime();

    const one = observer.snapshot();
    // A run of identical samples, exactly as the spool would carry them.
    const snapshots = Array.from({ length: 240 }, (_, i) => ({ ...one, ts: base + i * 5000 })) as never;

    const blocks = segment(snapshots, config());
    assert.equal(blocks.length, 1, 'the segmenter should see one continuous block');
    assert.equal(blocks[0]!.paths[0], '/x/a.psd');
    assert.equal(blocks[0]!.activeMs, 240 * 5000);
  });
});
