// MBD Time Tracker — the observer, as a JavaScript for Automation applet.
//
// Compiled at install time with `osacompile -s -l JavaScript`, which ships with
// macOS and produces a genuine .app bundle with a real executable inside. That
// matters for two reasons: macOS attaches the Accessibility grant to a bundle
// identity, and the permission dialog names the bundle — so people are asked to
// allow "MBD Time Tracker", not "bash".
//
// It writes one JSON snapshot per line to the spool the daemon tails. The shape
// must match Snapshot in daemon/src/types.ts exactly.

ObjC.import('Foundation');
ObjC.import('stdlib');

var app = Application.currentApplication();
app.includeStandardAdditions = true;

var HOME = ObjC.unwrap($.NSHomeDirectory());
var DATA_DIR = HOME + '/Library/Application Support/MBDTimeTracker';
var SPOOL = DATA_DIR + '/observer.ndjson';
var INTERVAL = 5;
/**
 * Quit and let launchd start a fresh copy every so often.
 *
 * This process is meant to live for weeks. AppleScript's runtime was not
 * written for that: every tick builds Apple Event descriptors and ObjC objects
 * whose autorelease pool an applet's idle handler never reliably drains, so
 * memory creeps rather than settles. Rather than chase that inside a runtime
 * with no way to measure it, the process is simply short-lived. Restarting
 * costs nothing -- KeepAlive brings it straight back, ThrottleInterval does
 * not apply to a job that ran for hours, and the Accessibility grant belongs
 * to the bundle, not the process, so nothing is re-prompted.
 */
var RECYCLE_MINUTES = 120;
var startedAt = Date.now();

/** Chromium and its rebadges all share one AppleScript dictionary. */
var CHROMIUM = [
  'com.google.Chrome', 'com.google.Chrome.beta', 'com.google.Chrome.dev', 'com.google.Chrome.canary',
  'org.chromium.Chromium', 'com.brave.Browser', 'com.brave.Browser.beta', 'com.brave.Browser.nightly',
  'com.microsoft.edgemac', 'com.microsoft.edgemac.Beta', 'com.microsoft.edgemac.Dev',
  'com.vivaldi.Vivaldi', 'com.operasoftware.Opera', 'com.operasoftware.OperaGX',
  'company.thebrowser.Browser', 'com.bookry.wavebox', 'com.pushplaylabs.sidekick'
];
var SAFARI = ['com.apple.Safari', 'com.apple.SafariTechnologyPreview'];

/* ------------------------------------------------------------- plumbing -- */

function shell(command) {
  try {
    return String(app.doShellScript(command));
  } catch (e) {
    return '';
  }
}

function ensureDataDir() {
  var fm = $.NSFileManager.defaultManager;
  if (!fm.fileExistsAtPath(DATA_DIR)) {
    fm.createDirectoryAtPathWithIntermediateDirectoriesAttributesError(DATA_DIR, true, $(), null);
  }
}

function appendLine(text) {
  var data = $.NSString.alloc.initWithUTF8String(text + '\n')
    .dataUsingEncoding($.NSUTF8StringEncoding);
  var fm = $.NSFileManager.defaultManager;
  if (!fm.fileExistsAtPath(SPOOL)) {
    fm.createFileAtPathContentsAttributes(SPOOL, data, $());
    return;
  }
  var handle = $.NSFileHandle.fileHandleForWritingAtPath(SPOOL);
  if (!handle.js) return;
  handle.seekToEndOfFile;
  handle.writeData(data);
  handle.closeFile;
}

/** Read config the daemon wrote, so interval and spool stay in one place. */
function loadSettings() {
  try {
    var raw = $.NSString.stringWithContentsOfFileEncodingError(
      DATA_DIR + '/config.json', $.NSUTF8StringEncoding, null);
    if (!raw.js) return;
    var config = JSON.parse(ObjC.unwrap(raw));
    if (config.capture && config.capture.sampleIntervalSeconds > 0) {
      INTERVAL = config.capture.sampleIntervalSeconds;
    }
    if (config.observer && config.observer.spoolPath) {
      SPOOL = config.observer.spoolPath;
    }
    if (config.observer && config.observer.recycleMinutes > 0) {
      RECYCLE_MINUTES = config.observer.recycleMinutes;
    }
  } catch (e) {
    // Defaults are fine; never let a malformed config stop tracking.
  }
}

/* ------------------------------------------------------------ machine  -- */

/** Seconds since the last keyboard or mouse event. Needs no permission. */
function idleSeconds() {
  var raw = shell("ioreg -c IOHIDSystem | awk '/HIDIdleTime/ {print $NF; exit}'");
  var digits = raw.replace(/[^0-9]/g, '');
  return digits ? Math.round(parseInt(digits, 10) / 1000000000) : 0;
}

/** True while the screen is locked or the screensaver is running. */
function screenLocked() {
  var raw = shell("ioreg -n Root -d1 -r | grep CGSSessionScreenIsLocked || echo ''");
  return raw.indexOf('Yes') !== -1;
}

/* ------------------------------------------------------------- sampling -- */

/** One accessibility attribute, or null. Missing attributes throw; most do. */
function attributeOf(element, name) {
  try {
    var value = element.attributes.byName(name).value();
    return value === undefined || value === null ? null : value;
  } catch (e) {
    return null;
  }
}


function sample() {
  var out = {
    ts: Date.now(),
    app: 'unknown',
    bundleId: 'unknown',
    title: null,
    documentPath: null,
    url: null,
    idleSeconds: idleSeconds(),
    locked: screenLocked()
  };

  // Nothing worth inspecting behind a locked screen, and the calls would only
  // stall against the login window.
  if (out.locked) return out;

  var systemEvents = Application('System Events');
  var proc;
  try {
    proc = systemEvents.applicationProcesses.whose({ frontmost: true })[0];
    out.app = proc.name();
    try { out.bundleId = proc.bundleIdentifier(); } catch (e) {}
  } catch (e) {
    return out;
  }

  /**
   * The window being worked in -- which is not the same as windows[0].
   *
   * windows[0] is the first window in the process's list, and in an app with
   * palettes, inspectors and several open documents that is regularly not the
   * one in front. Reading it reports a file that merely happens to be open as
   * though it were being worked on, which puts time against the wrong job and
   * makes the tracker look like it is inventing things.
   *
   * AXFocusedWindow is the one with keyboard focus. Some apps do not publish
   * it, so windows[0] stays as a fallback -- a rough answer beats none.
   */
  var win = null;
  try { win = proc.attributes.byName('AXFocusedWindow').value(); } catch (e) {}
  if (!win) {
    try { win = proc.windows[0]; } catch (e) {}
  }

  if (win) {
    // An AX element reference answers through attributes; a System Events
    // window object also answers title(). Try the attribute first so both
    // routes go through the same path.
    try { out.title = attributeOf(win, 'AXTitle') || null; } catch (e) {}
    if (!out.title) {
      try { out.title = win.title() || null; } catch (e) {}
    }
    try {
      var doc = attributeOf(win, 'AXDocument');
      if (doc) {
        var text = String(doc);
        if (text.indexOf('file://') === 0) {
          // Must arrive percent-decoded or path matching silently misses.
          out.documentPath = decodeURIComponent(text.replace(/^file:\/\/(localhost)?/, ''));
        } else if (text.indexOf('http://') === 0 || text.indexOf('https://') === 0) {
          out.url = text;
        } else if (text.indexOf('/') === 0) {
          out.documentPath = text;
        }
      }
    } catch (e) {}
  }

  // Browsers answer directly, and far more reliably than the AX tree does.
  try {
    if (CHROMIUM.indexOf(out.bundleId) !== -1) {
      var browser = Application(out.bundleId);
      var front = browser.windows[0];
      var mode = '';
      try { mode = String(front.mode()); } catch (e) {}
      if (mode.indexOf('incognito') !== -1) {
        // Private browsing is never recorded — not the address, and not the
        // title either, which usually names the page just as plainly.
        out.title = null; out.url = null; out.documentPath = null;
      } else {
        out.url = front.activeTab.url() || out.url;
      }
    } else if (SAFARI.indexOf(out.bundleId) !== -1) {
      // Safari gives no way to inspect a private window; a documented gap.
      out.url = Application(out.bundleId).documents[0].url() || out.url;
    }
  } catch (e) {}

  return out;
}

/* ---------------------------------------------------------------- applet -- */

function run() {
  loadSettings();
  ensureDataDir();
  startedAt = Date.now();
}

/** Called by the applet runtime; the return value is seconds until next call. */
function idle() {
  try {
    appendLine(JSON.stringify(sample()));
  } catch (e) {
    try {
      appendLine(JSON.stringify({ error: String(e) }));
    } catch (ignored) {}
  }

  if (RECYCLE_MINUTES > 0 && Date.now() - startedAt > RECYCLE_MINUTES * 60000) {
    // Exit non-zero: KeepAlive is set to restart on any exit, but a failure
    // code also means a launchd configured the old way still brings it back.
    $.exit(1);
  }

  return INTERVAL;
}

function quit() {
  return true;
}
