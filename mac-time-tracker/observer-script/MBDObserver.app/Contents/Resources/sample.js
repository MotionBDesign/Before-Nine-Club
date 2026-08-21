// Sample the frontmost app through System Events, and print one JSON object.
//
// This is the no-compiler observer: JavaScript for Automation reaches the same
// Accessibility attributes the Swift observer does (AXTitle, AXDocument), using
// only osascript, which every Mac already has.
//
// Called as:  osascript -l JavaScript sample.js <idleSeconds> <locked>
// Output must match the Snapshot shape in daemon/src/types.ts exactly.

function run(argv) {
  var idleSeconds = parseFloat(argv[0]) || 0;
  var locked = String(argv[1]) === 'true';

  var out = {
    ts: Date.now(),
    app: 'unknown',
    bundleId: 'unknown',
    title: null,
    documentPath: null,
    url: null,
    idleSeconds: idleSeconds,
    locked: locked
  };

  // Nothing worth inspecting behind a locked screen, and the AX calls would
  // only stall against the login window.
  if (locked) return JSON.stringify(out);

  var systemEvents = Application('System Events');
  systemEvents.includeStandardAdditions = true;

  var proc;
  try {
    proc = systemEvents.applicationProcesses.whose({ frontmost: true })[0];
    out.app = proc.name();
    try { out.bundleId = proc.bundleIdentifier(); } catch (e) {}
  } catch (e) {
    return JSON.stringify(out);
  }

  // Window title and open document, straight off the focused window.
  try {
    var win = proc.windows[0];
    try { out.title = win.title() || null; } catch (e) {}
    try {
      var doc = win.attributes.byName('AXDocument').value();
      if (doc) {
        var text = String(doc);
        if (text.indexOf('file://') === 0) {
          // Percent-decoded POSIX path, matching what the Swift observer emits.
          out.documentPath = decodeURIComponent(text.replace(/^file:\/\/(localhost)?/, ''));
        } else if (text.indexOf('http://') === 0 || text.indexOf('https://') === 0) {
          out.url = text;
        } else if (text.indexOf('/') === 0) {
          out.documentPath = text;
        }
      }
    } catch (e) {}
  } catch (e) {}

  // Browsers answer directly, and more reliably than the AX tree does.
  var CHROMIUM = [
    'com.google.Chrome', 'com.google.Chrome.beta', 'com.google.Chrome.dev', 'com.google.Chrome.canary',
    'org.chromium.Chromium', 'com.brave.Browser', 'com.brave.Browser.beta', 'com.brave.Browser.nightly',
    'com.microsoft.edgemac', 'com.microsoft.edgemac.Beta', 'com.microsoft.edgemac.Dev',
    'com.vivaldi.Vivaldi', 'com.operasoftware.Opera', 'com.operasoftware.OperaGX',
    'company.thebrowser.Browser', 'com.bookry.wavebox', 'com.pushplaylabs.sidekick'
  ];
  var SAFARI = ['com.apple.Safari', 'com.apple.SafariTechnologyPreview'];

  try {
    if (CHROMIUM.indexOf(out.bundleId) !== -1) {
      var chrome = Application(out.bundleId);
      var w = chrome.windows[0];
      // Never record a private window: no address and no title either, since a
      // page title usually names the page just as plainly.
      var mode = '';
      try { mode = String(w.mode()); } catch (e) {}
      if (mode.indexOf('incognito') !== -1) {
        out.title = null; out.url = null; out.documentPath = null;
      } else {
        out.url = w.activeTab.url() || out.url;
      }
    } else if (SAFARI.indexOf(out.bundleId) !== -1) {
      // Safari gives no way to inspect a private window; documented as a gap.
      out.url = Application(out.bundleId).documents[0].url() || out.url;
    }
  } catch (e) {}

  return JSON.stringify(out);
}
