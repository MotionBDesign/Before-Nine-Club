/**
 * Generate a shareable, clickable preview of the review UI.
 *
 * It takes the *real* page — same markup, same stylesheet, same behaviour —
 * and swaps only the network layer for an in-memory stand-in seeded with
 * sample days. That way what people approve is the interface they will
 * actually get, not a mockup that drifts from it.
 *
 *   node scripts/build-preview.ts <output.html>
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Run this with TZ set to the studio zone (npm run build-preview does), so the
// sample timestamps and the segmenter's working-hours filter agree with what
// the page will render. Generated in a different zone, a "9am" day comes out
// shifted and the blocks no longer sit on their hour lines.
if (!process.env.TZ) {
  console.warn('  TZ is not set; run via `npm run build-preview` so sample times match the display zone.');
}
import { renderPage } from '../src/ui.ts';
import { buildContext } from '../src/matcher.ts';
import { segment, buildEntries } from '../src/segmenter.ts';
import type { ProposedEntry, Snapshot } from '../src/types.ts';
import { realCatalog } from '../test/real-tasks.ts';
import { evalConfig, evalRules } from '../test/real-cases.ts';
import { snapshots } from '../test/fixtures.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] ?? path.resolve(here, '..', '..', 'preview.html');

const ROOT = '/Volumes/Projects/Clients';
const minutes = (n: number) => n * 60_000;

/** 2026-08-20 09:00 local — a fixed morning so the preview is reproducible. */
const T0 = new Date(2026, 7, 20, 9, 0, 0).getTime();

const config = structuredClone(evalConfig);
config.display.timezone = 'Australia/Adelaide';
const context = buildContext(config, evalRules, realCatalog());

function build(timeline: Snapshot[]): ProposedEntry[] {
  return buildEntries(segment(timeline, config), context, '2026-08-20');
}

/* ---------------------------------------------------------- scenarios ---- */

/** A good day: everything matched, target met. */
const typicalDay = build([
  ...snapshots(T0, 1080, {
    app: 'Photoshop', bundleId: 'com.adobe.Photoshop',
    title: 'Curtailment_styleframes_01.psd @ 100%',
    documentPath: `${ROOT}/SAPN/2026/Smarter Homes Solar Curtailment/Curtailment_styleframes_01.psd`,
  }),
  ...snapshots(T0 + minutes(45), 6, {
    app: 'Slack', bundleId: 'com.tinyspeck.slackmacgap', title: 'sapn-team (Channel) - Motion by Design',
  }),
  ...snapshots(T0 + minutes(90), 120, {
    app: 'Google Chrome', bundleId: 'com.google.Chrome',
    title: 'Resmed - CPAP Trial EDM - ClickUp', url: 'https://app.clickup.com/t/86d42ff8d',
  }),
  ...snapshots(T0 + minutes(100), 1320, {
    app: 'Photoshop', bundleId: 'com.adobe.Photoshop',
    title: 'CPAP_trial_EDM_header.psd',
    documentPath: `${ROOT}/Resmed/2026/CPAP Trial EDM/CPAP_trial_EDM_header.psd`,
  }),
  ...snapshots(T0 + minutes(210), 600, {
    app: 'Google Chrome', bundleId: 'com.google.Chrome', title: 'News', idleSeconds: 1800,
  }),
  ...snapshots(T0 + minutes(270), 1440, {
    app: 'Adobe Premiere Pro', bundleId: 'com.adobe.PremierePro',
    title: 'Onboarding_Visitors_edit.prproj',
    documentPath: `${ROOT}/Symons Clark/2026/Onboarding Visitors video/Onboarding_Visitors_edit.prproj`,
  }),
  ...snapshots(T0 + minutes(390), 900, {
    app: 'Microsoft Word', bundleId: 'com.microsoft.Word',
    title: 'GPTW_wallpapers_banners_posters_copy.docx',
    documentPath: `${ROOT}/Aurizn/2026/GPTW/GPTW_wallpapers_banners_posters_copy.docx`,
  }),
]);

/** A day that needs work: short of target, one guess, one dead end. */
const needsWorkDay = build([
  ...snapshots(T0, 720, {
    app: 'Photoshop', bundleId: 'com.adobe.Photoshop',
    title: 'promo.psd', documentPath: `${ROOT}/Resmed/2026/Promos/promo.psd`,
  }),
  ...snapshots(T0 + minutes(75), 900, {
    app: 'After Effects', bundleId: 'com.adobe.AfterEffects',
    title: 'vulcan_explainer_v3.aep',
    documentPath: `${ROOT}/Maptek/2026/Vulcan Explainer/vulcan_explainer_v3.aep`,
  }),
  ...snapshots(T0 + minutes(210), 480, {
    app: 'Terminal', bundleId: 'com.apple.Terminal', title: 'dom@studio: ~',
  }),
  ...snapshots(T0 + minutes(280), 600, {
    app: 'Figma', bundleId: 'com.figma.Desktop', title: 'Cole - Website – Figma',
  }),
]);

/** Mid-review: some approved, some already pushed. */
const inProgressDay = typicalDay.map((entry, index) => {
  if (index === 0) return { ...entry, status: 'synced' as const, clickupEntryId: 'te-demo', syncedAt: Date.now() };
  if (index === 1) return { ...entry, status: 'approved' as const };
  return entry;
});

const SCENARIOS = {
  typical: { label: 'Matched day', date: '2026-08-20', entries: typicalDay },
  needsWork: { label: 'Needs decisions', date: '2026-08-19', entries: needsWorkDay },
  inProgress: { label: 'Part-way through', date: '2026-08-18', entries: inProgressDay },
};

/* ------------------------------------------------------------- assemble -- */

const page = renderPage();

// Swap the network layer. Everything above and below it is the real page.
const realApi = `  async function api(path, options) {
    var response = await fetch(path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, options));
    var body = await response.json();
    if (!response.ok) throw new Error(body.error || ('HTTP ' + response.status));
    return body;
  }`;
if (!page.includes(realApi)) {
  throw new Error('The api() helper in src/ui.ts changed; update build-preview.ts to match.');
}

const mockApi = `  // ---- preview stand-in for the local server -----------------------------
  // Same request shapes as the real API, answered from memory so the page can
  // be clicked through anywhere. Nothing here runs in the installed tracker.
  async function api(path, options) {
    await new Promise(function (r) { setTimeout(r, 90); });  // feel of a real round trip
    var body = options && options.body ? JSON.parse(options.body) : {};
    var method = (options && options.method) || 'GET';
    return PREVIEW.handle(method, path, body);
  }`;

const previewData = {
  scenarios: SCENARIOS,
  tasks: realCatalog().tasks.map((t) => ({
    taskId: t.taskId, taskName: t.taskName, listName: t.listName, folderName: t.folderName,
  })),
  targets: config.targets,
  display: {
    timezone: config.display.timezone,
    dayStartHour: config.capture.dayStartHour,
    dayEndHour: config.capture.dayEndHour,
    snapMinutes: config.capture.roundToMinutes,
    minEntryMinutes: config.capture.minEntryMinutes,
  },
  quickLog: config.quickLog.map((button, index) => {
    const task = realCatalog().tasks.find((t) => t.taskId === button.taskId);
    return { index, label: button.label, minutes: button.minutes, billable: button.billable, taskName: task?.taskName ?? button.label };
  }),
};

const previewRuntime = `
<script>
// Preview backend: in-memory, seeded with real ClickUp task names and days
// produced by the actual segmenter and matcher.
var PREVIEW = (function () {
  var DATA = ${JSON.stringify(previewData)};
  var state = {};
  Object.keys(DATA.scenarios).forEach(function (key) {
    var scenario = DATA.scenarios[key];
    state[scenario.date] = JSON.parse(JSON.stringify(scenario));
  });
  var dates = Object.keys(state).sort().reverse();
  var current = DATA.scenarios.typical.date;

  function day(date) { return state[date] || state[current]; }

  function summarise(d) {
    function total(fn) {
      return d.entries.filter(fn).reduce(function (sum, e) { return sum + e.durationMs; }, 0);
    }
    function live(e) { return e.status !== 'deleted'; }
    function counts(e) { return e.status !== 'deleted' && e.status !== 'rejected'; }
    return {
      trackedMs: total(live),
      pendingMs: total(function (e) { return e.status === 'pending'; }),
      approvedMs: total(function (e) { return e.status === 'approved'; }),
      syncedMs: total(function (e) { return e.status === 'synced'; }),
      billableMs: total(function (e) { return e.billable && counts(e); }),
      loggedMs: total(counts)
    };
  }

  function payload(date) {
    var d = day(date);
    return {
      day: { date: d.date, updatedAt: Date.now(), entries: d.entries },
      summary: summarise(d),
      days: dates,
      catalogFetchedAt: Date.now(),
      taskCount: DATA.tasks.length,
      targets: DATA.targets,
      display: DATA.display,
      quickLog: DATA.quickLog
    };
  }

  function handle(method, path, body) {
    var date = (body && body.date) || current;

    if (path.indexOf('/api/day?') === 0 || path === '/api/day') {
      var q = path.split('date=')[1];
      if (q) { date = decodeURIComponent(q); }
      if (state[date]) current = date;
      return payload(current);
    }

    if (path.indexOf('/api/week') === 0) {
      // Build a Mon-Fri week around whichever sample day is showing, so the
      // week view has something real to draw.
      var anchor = state[current];
      var parts = anchor.date.split('-').map(Number);
      var at = new Date(parts[0], parts[1] - 1, parts[2]);
      at.setDate(at.getDate() - ((at.getDay() + 6) % 7));
      var out = [];
      for (var i = 0; i < 7; i++) {
        var iso = at.getFullYear() + '-' + String(at.getMonth() + 1).padStart(2, '0') + '-' + String(at.getDate()).padStart(2, '0');
        var d = state[iso];
        var byClient = {};
        if (d) {
          d.entries.forEach(function (e) {
            if (e.status === 'deleted' || e.status === 'rejected') return;
            var c = e.suggestion.folderName || e.suggestion.spaceName || 'Unassigned';
            byClient[c] = (byClient[c] || 0) + e.durationMs;
          });
        }
        out.push({
          date: iso,
          summary: d ? summarise(d) : { trackedMs: 0, pendingMs: 0, approvedMs: 0, syncedMs: 0, billableMs: 0, loggedMs: 0 },
          byClient: byClient,
          entryCount: d ? d.entries.length : 0
        });
        at.setDate(at.getDate() + 1);
      }
      return { weekStart: out[0].date, days: out, targets: DATA.targets };
    }

    if (path.indexOf('/api/tasks') === 0) {
      var term = decodeURIComponent((path.split('q=')[1] || '')).toLowerCase();
      var matches = DATA.tasks.filter(function (t) {
        return t.taskName.toLowerCase().indexOf(term) !== -1 ||
               (t.listName || '').toLowerCase().indexOf(term) !== -1 ||
               (t.folderName || '').toLowerCase().indexOf(term) !== -1;
      }).slice(0, 50);
      return { tasks: matches };
    }

    if (path.indexOf('/api/entry/') === 0) {
      var id = decodeURIComponent(path.slice('/api/entry/'.length));
      var d = day(date);
      var entry = d.entries.filter(function (e) { return e.id === id; })[0];
      if (!entry) throw new Error('No such entry');
      if (entry.status === 'synced') throw new Error('Already pushed to ClickUp; edit it there instead.');

      if (body.taskId !== undefined) {
        if (body.taskId && body.taskId !== entry.suggestion.taskId) {
          entry.corrected = true;
          var picked = DATA.tasks.filter(function (t) { return t.taskId === body.taskId; })[0];
          if (picked) {
            entry.suggestion.taskName = picked.taskName;
            entry.suggestion.listName = picked.listName;
            entry.suggestion.folderName = picked.folderName;
            entry.suggestion.confidence = 1;
            entry.suggestion.reasons = ['you chose this task'];
          }
        }
        entry.taskId = body.taskId;
      }
      if (typeof body.description === 'string') entry.description = body.description;
      if (typeof body.billable === 'boolean') entry.billable = body.billable;
      if (typeof body.durationMinutes === 'number') {
        entry.durationMs = Math.max(0, Math.round(body.durationMinutes)) * 60000;
        entry.end = entry.start + entry.durationMs;
      }
      if (typeof body.start === 'number') {
        entry.start = Math.round(body.start);
        entry.end = entry.start + entry.durationMs;
      }
      if (body.status) {
        if (body.status === 'approved' && !entry.taskId) throw new Error('Pick a task before approving.');
        entry.status = body.status;
      }
      return { entry: entry, summary: summarise(d) };
    }

    if (path === '/api/entry') {
      var into = day(date);
      var grain = DATA.display.snapMinutes || 15;
      var mins = Math.max(DATA.display.minEntryMinutes || grain, Math.round((body.minutes || grain) / grain) * grain);
      var start = Number(body.start);
      if (!isFinite(start)) start = into.entries.length ? into.entries[0].start : Date.now();
      var blank = {
        id: 'manual-' + Math.round(start) + '-' + mins,
        date: into.date,
        start: start, end: start + mins * 60000,
        activeMs: mins * 60000, durationMs: mins * 60000,
        blockIds: [],
        evidence: { apps: ['Added by hand'], paths: [], titles: ['Added by hand'], urls: [] },
        suggestion: {
          taskId: null, taskName: null, listId: null, listName: null, folderName: null, spaceName: null,
          confidence: 0, reasons: ['added by hand — pick the task'], alternatives: [], billable: true
        },
        status: 'pending', taskId: null,
        description: 'Added by hand', billable: true, manual: true
      };
      into.entries = into.entries.concat([blank]).sort(function (a, b) { return a.start - b.start; });
      return { entry: blank, day: payload(date).day, summary: summarise(into) };
    }

    if (path === '/api/day/rebuild') {
      return { day: payload(date).day, summary: summarise(day(date)) };
    }

    if (path === '/api/day/approve-all') {
      var target = day(date);
      var approved = 0;
      target.entries.forEach(function (e) {
        if (e.status === 'pending' && e.taskId) { e.status = 'approved'; approved++; }
      });
      return { day: payload(date).day, approved: approved, summary: summarise(target) };
    }

    if (path === '/api/day/push') {
      var pushing = day(date);
      var pushed = 0;
      pushing.entries.forEach(function (e) {
        if (e.status === 'approved') { e.status = 'synced'; e.syncedAt = Date.now(); pushed++; }
      });
      return {
        result: { pushed: pushed, skipped: 0, reconciled: 0, failures: [] },
        day: payload(date).day,
        summary: summarise(pushing)
      };
    }

    if (path === '/api/catalog/refresh') {
      return { taskCount: DATA.tasks.length, fetchedAt: Date.now() };
    }

    if (path === '/api/quick-log') {
      var button = DATA.quickLog[body.index];
      if (!button) throw new Error('No such quick-log button.');
      var into = day(date);
      var mins = body.minutes || button.minutes;
      var end = into.entries.length
        ? Math.max.apply(null, into.entries.map(function (e) { return e.end; }))
        : Date.now();
      var entry = {
        id: 'manual-' + Math.round(end) + '-' + body.index,
        date: into.date,
        start: end, end: end + mins * 60000,
        activeMs: mins * 60000, durationMs: mins * 60000,
        blockIds: [],
        evidence: { apps: ['Quick log'], paths: [], titles: [button.label], urls: [] },
        suggestion: {
          taskId: button.taskId || 'quick-' + body.index, taskName: button.taskName,
          listId: null, listName: 'Active list', folderName: null, spaceName: 'MBD Non billable',
          confidence: 1, reasons: ['logged with the "' + button.label + '" button'],
          alternatives: [], billable: button.billable
        },
        status: 'approved', taskId: 'quick-' + body.index,
        description: button.label, billable: button.billable, manual: true
      };
      into.entries = into.entries.concat([entry]).sort(function (a, b) { return a.start - b.start; });
      return { entry: entry, day: payload(date).day, summary: summarise(into) };
    }

    throw new Error('Not found: ' + path);
  }

  function reset(key) {
    var scenario = DATA.scenarios[key];
    state[scenario.date] = JSON.parse(JSON.stringify(scenario));
    current = scenario.date;
    return scenario.date;
  }

  return { handle: handle, reset: reset, scenarios: DATA.scenarios };
})();
</script>
`;

// The preview frame: a quiet strip that names what this is and lets a
// reviewer jump between states. Kept visually separate from the app itself so
// nobody mistakes the scaffolding for the product.
const frame = `
<style>
  :root { --pv-ink: #1b1f27; --pv-dim: #5d6572; --pv-line: #d9dde4; --pv-ground: #eceef2; --pv-panel: #ffffff; --pv-accent: #2f6df6; }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) { --pv-ink: #e9ebf0; --pv-dim: #98a1b0; --pv-line: #2b303a; --pv-ground: #0f1116; --pv-panel: #191c22; --pv-accent: #7aa2ff; }
  }
  :root[data-theme="dark"] { --pv-ink: #e9ebf0; --pv-dim: #98a1b0; --pv-line: #2b303a; --pv-ground: #0f1116; --pv-panel: #191c22; --pv-accent: #7aa2ff; }

  .pv-bar {
    background: var(--pv-ground); color: var(--pv-ink); border-bottom: 1px solid var(--pv-line);
    padding: 10px 20px; display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
    font: 13px/1.45 ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
  }
  .pv-bar strong { font-weight: 600; letter-spacing: 0.02em; }
  .pv-note { color: var(--pv-dim); }
  .pv-spacer { flex: 1 1 auto; }
  .pv-scenarios { display: flex; gap: 6px; flex-wrap: wrap; }
  .pv-scenarios button {
    font: inherit; color: var(--pv-ink); background: var(--pv-panel);
    border: 1px solid var(--pv-line); border-radius: 6px; padding: 4px 10px; cursor: pointer;
  }
  .pv-scenarios button:hover { border-color: var(--pv-accent); }
  .pv-scenarios button[aria-pressed="true"] { background: var(--pv-accent); border-color: var(--pv-accent); color: #fff; }
  .pv-scenarios button:focus-visible { outline: 2px solid var(--pv-accent); outline-offset: 2px; }
  @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
</style>
<div class="pv-bar">
  <strong>Preview</strong>
  <span class="pv-note">the real interface, sample data — nothing is sent to ClickUp</span>
  <span class="pv-spacer"></span>
  <span class="pv-scenarios" id="pv-scenarios"></span>
</div>
<script>
(function () {
  var host = document.getElementById('pv-scenarios');
  var keys = Object.keys(PREVIEW.scenarios);
  host.innerHTML = keys.map(function (key, i) {
    return '<button data-scenario="' + key + '" aria-pressed="' + (i === 0) + '">' +
      PREVIEW.scenarios[key].label + '</button>';
  }).join('');
  host.addEventListener('click', function (event) {
    var key = event.target.getAttribute && event.target.getAttribute('data-scenario');
    if (!key) return;
    var date = PREVIEW.reset(key);
    host.querySelectorAll('button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-scenario') === key));
    });
    // Re-enter the page's own load path so nothing about it is special-cased.
    var select = document.getElementById('date');
    select.value = date;
    select.dispatchEvent(new Event('change'));
  });
})();
</script>
`;

let html = page.replace(realApi, mockApi);
// The runtime has to exist before the page's own script runs.
html = html.replace('<body>', `<body>\n${previewRuntime}${frame}`);
html = html.replace('<title>Timesheet Review</title>', '<title>Timesheet Review Preview</title>');

fs.writeFileSync(out, html);
console.log(`  Wrote ${out} (${Math.round(fs.statSync(out).size / 1024)} KB)`);
