const HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Timesheet review</title>
<style>
  :root {
    color-scheme: light dark;
    --bg: #f6f7f9; --panel: #ffffff; --line: #e2e5ea; --text: #16181d;
    --muted: #666d78; --accent: #2f6df6; --ok: #12805c; --warn: #9a6400; --bad: #b4232a;
    --chip: #eef1f6;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #14161a; --panel: #1c1f25; --line: #2c313a; --text: #e8eaee;
      --muted: #9aa2ae; --accent: #6f9dff; --ok: #4fd1a5; --warn: #e0b050; --bad: #ff7b7b;
      --chip: #262b33;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--text);
    font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  }
  header {
    position: sticky; top: 0; z-index: 5; background: var(--panel);
    border-bottom: 1px solid var(--line); padding: 10px 16px;
    display: flex; gap: 8px; align-items: center; flex-wrap: wrap;
  }
  h1 { font-size: 15px; margin: 0 8px 0 0; font-weight: 650; letter-spacing: -0.01em; white-space: nowrap; }
  main { padding: 20px; max-width: 1180px; margin: 0 auto; }
  button, select, input[type=text], input[type=number] {
    font: inherit; color: inherit; background: var(--panel);
    border: 1px solid var(--line); border-radius: 7px; padding: 6px 10px;
  }
  button { cursor: pointer; }
  button:hover:not(:disabled) { border-color: var(--accent); }
  button:disabled { opacity: 0.45; cursor: default; }
  button.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
  .spacer { flex: 1; }
  .summary { display: flex; gap: 22px; flex-wrap: wrap; margin-bottom: 18px; }
  .summary div { display: flex; flex-direction: column; }
  .summary .k { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
  .summary .v { font-size: 20px; font-variant-numeric: tabular-nums; font-weight: 600; }
  .entry {
    background: var(--panel); border: 1px solid var(--line); border-radius: 10px;
    padding: 14px 16px; margin-bottom: 10px;
    display: grid; grid-template-columns: 132px minmax(0, 1fr) 300px; gap: 16px; align-items: start;
  }
  .entry[data-status=approved] { border-left: 3px solid var(--ok); }
  .entry[data-status=synced] { border-left: 3px solid var(--accent); opacity: 0.72; }
  .entry[data-status=rejected] { opacity: 0.42; }
  .when { font-variant-numeric: tabular-nums; }
  .when .range { color: var(--muted); font-size: 12px; }
  .when .dur { font-size: 17px; font-weight: 600; margin-top: 2px; }
  .when input { width: 78px; text-align: right; }
  .what .desc { width: 100%; }
  .evidence { margin-top: 8px; font-size: 12px; color: var(--muted); word-break: break-all; }
  .evidence code { background: var(--chip); padding: 1px 5px; border-radius: 4px; }
  .reasons { margin-top: 6px; font-size: 12px; color: var(--muted); }
  .reasons li { margin-left: 16px; }
  .chip {
    display: inline-block; font-size: 11px; padding: 2px 8px; border-radius: 99px;
    background: var(--chip); color: var(--muted); margin-right: 6px; white-space: nowrap;
  }
  .chip.high { color: var(--ok); } .chip.mid { color: var(--warn); } .chip.low { color: var(--bad); }
  .pick { position: relative; }
  .pick input { width: 100%; }
  .pick .current { font-weight: 600; margin-bottom: 4px; }
  .pick .path { font-size: 12px; color: var(--muted); margin-bottom: 6px; }
  .results {
    position: absolute; z-index: 4; left: 0; right: 0; top: 100%;
    background: var(--panel); border: 1px solid var(--line); border-radius: 8px;
    max-height: 260px; overflow: auto; box-shadow: 0 8px 26px rgba(0,0,0,0.18);
  }
  .results div { padding: 7px 10px; cursor: pointer; border-bottom: 1px solid var(--line); }
  .results div:last-child { border-bottom: 0; }
  .results div:hover { background: var(--chip); }
  .results small { display: block; color: var(--muted); }
  .actions { display: flex; gap: 6px; margin-top: 10px; align-items: center; flex-wrap: wrap; }
  .actions label { font-size: 12px; color: var(--muted); display: flex; gap: 4px; align-items: center; }
  #toast {
    position: fixed; bottom: 18px; left: 50%; transform: translateX(-50%);
    background: var(--panel); border: 1px solid var(--line); border-radius: 8px;
    padding: 9px 16px; box-shadow: 0 8px 26px rgba(0,0,0,0.2); display: none; max-width: 80vw;
  }
  .empty { color: var(--muted); padding: 40px 0; text-align: center; }
</style>
</head>
<body>
<header>
  <h1>Timesheet review</h1>
  <select id="date"></select>
  <button id="rebuild">Rebuild from activity</button>
  <button id="refresh">Refresh ClickUp tasks</button>
  <span class="spacer"></span>
  <span id="catalog" class="chip"></span>
  <button id="approveAll">Approve all matched</button>
  <button id="push" class="primary">Push approved to ClickUp</button>
</header>
<main>
  <div class="summary" id="summary"></div>
  <div id="entries"></div>
</main>
<div id="toast"></div>
<script>
(function () {
  var state = { date: null, day: null };

  function fmt(ms) {
    var mins = Math.round(ms / 60000);
    var h = Math.floor(mins / 60), m = mins % 60;
    return h > 0 ? h + 'h ' + String(m).padStart(2, '0') + 'm' : m + 'm';
  }
  function clock(ts) {
    var d = new Date(ts);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function toast(message, isError) {
    var el = document.getElementById('toast');
    el.textContent = message;
    el.style.borderColor = isError ? 'var(--bad)' : 'var(--line)';
    el.style.display = 'block';
    clearTimeout(el._timer);
    el._timer = setTimeout(function () { el.style.display = 'none'; }, 4500);
  }
  async function api(path, options) {
    var response = await fetch(path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, options));
    var body = await response.json();
    if (!response.ok) throw new Error(body.error || ('HTTP ' + response.status));
    return body;
  }

  function confidenceChip(c) {
    var pct = Math.round((c || 0) * 100);
    var cls = c >= 0.7 ? 'high' : c >= 0.45 ? 'mid' : 'low';
    var label = c >= 0.7 ? 'confident' : c >= 0.45 ? 'unsure' : 'guess';
    return '<span class="chip ' + cls + '">' + pct + '% · ' + label + '</span>';
  }

  function renderSummary(summary) {
    var rows = [
      ['Tracked', summary.trackedMs], ['Needs review', summary.pendingMs],
      ['Approved', summary.approvedMs], ['In ClickUp', summary.syncedMs],
      ['Billable', summary.billableMs],
    ];
    document.getElementById('summary').innerHTML = rows.map(function (r) {
      return '<div><span class="k">' + r[0] + '</span><span class="v">' + fmt(r[1]) + '</span></div>';
    }).join('');
  }

  function renderEntry(entry) {
    var s = entry.suggestion;
    var evidence = [];
    if (entry.evidence.paths.length) {
      evidence.push(entry.evidence.paths.slice(0, 3).map(function (p) {
        return '<code>' + esc(p) + '</code>';
      }).join(' '));
    }
    if (entry.evidence.urls.length) {
      evidence.push(entry.evidence.urls.slice(0, 2).map(function (u) {
        return '<code>' + esc(u) + '</code>';
      }).join(' '));
    }
    var reasons = (s.reasons || []).map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('');
    var taskLabel = entry.taskId
      ? esc(s.taskId === entry.taskId ? (s.taskName || entry.taskId) : (entry._pickedName || s.taskName || entry.taskId))
      : '<span style="color:var(--muted)">No task chosen</span>';
    var scope = [s.folderName, s.listName].filter(Boolean).map(esc).join(' › ');
    var synced = entry.status === 'synced';

    return '<div class="entry" data-status="' + entry.status + '" data-id="' + entry.id + '">' +
      '<div class="when">' +
        '<div class="range">' + clock(entry.start) + '–' + clock(entry.end) + '</div>' +
        '<div class="dur"><input type="number" min="0" step="5" value="' + Math.round(entry.durationMs / 60000) + '"' +
          (synced ? ' disabled' : '') + ' data-act="duration"> m</div>' +
        '<div class="range" style="margin-top:4px">measured ' + fmt(entry.activeMs) + '</div>' +
      '</div>' +
      '<div class="what">' +
        '<input type="text" class="desc" value="' + esc(entry.description) + '"' + (synced ? ' disabled' : '') + ' data-act="description">' +
        '<div class="evidence">' + esc(entry.evidence.apps.join(', ')) + (evidence.length ? '<br>' + evidence.join('<br>') : '') + '</div>' +
        (reasons ? '<ul class="reasons">' + reasons + '</ul>' : '') +
      '</div>' +
      '<div class="pick">' +
        confidenceChip(s.confidence) +
        '<div class="current">' + taskLabel + '</div>' +
        (scope ? '<div class="path">' + scope + '</div>' : '') +
        (synced ? '' : '<input type="text" placeholder="Search tasks…" data-act="search">') +
        '<div class="actions">' +
          (synced
            ? '<span class="chip high">in ClickUp</span>'
            : '<button data-act="approve">Approve</button><button data-act="reject">Skip</button>' +
              '<label><input type="checkbox" data-act="billable"' + (entry.billable ? ' checked' : '') + '> billable</label>') +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function render() {
    var container = document.getElementById('entries');
    if (!state.day || state.day.entries.length === 0) {
      container.innerHTML = '<div class="empty">No activity recorded for this day yet.</div>';
      return;
    }
    container.innerHTML = state.day.entries.map(renderEntry).join('');
  }

  async function load(date) {
    var data = await api(date ? '/api/day?date=' + encodeURIComponent(date) : '/api/day');
    state.date = data.day.date;
    state.day = data.day;
    var select = document.getElementById('date');
    var days = data.days.indexOf(state.date) === -1 ? [state.date].concat(data.days) : data.days;
    select.innerHTML = days.map(function (d) {
      return '<option value="' + d + '"' + (d === state.date ? ' selected' : '') + '>' + d + '</option>';
    }).join('');
    document.getElementById('catalog').textContent = data.taskCount + ' tasks cached' +
      (data.catalogFetchedAt ? ' · ' + new Date(data.catalogFetchedAt).toLocaleTimeString() : ' · never synced');
    renderSummary(data.summary);
    render();
  }

  async function patch(id, body) {
    var result = await api('/api/entry/' + encodeURIComponent(id), {
      method: 'POST',
      body: JSON.stringify(Object.assign({ date: state.date }, body)),
    });
    var index = state.day.entries.findIndex(function (e) { return e.id === id; });
    if (index >= 0) state.day.entries[index] = result.entry;
    renderSummary(result.summary);
    return result.entry;
  }

  document.addEventListener('click', async function (event) {
    var target = event.target;
    var card = target.closest ? target.closest('.entry') : null;

    if (target.dataset && target.dataset.taskId !== undefined && target.closest('.results')) {
      var id = target.closest('.entry').dataset.id;
      try {
        var updated = await patch(id, { taskId: target.dataset.taskId });
        updated._pickedName = target.dataset.taskName;
        render();
      } catch (e) { toast(e.message, true); }
      return;
    }
    if (!card || !target.dataset) return;
    var entryId = card.dataset.id;
    try {
      if (target.dataset.act === 'approve') { await patch(entryId, { status: 'approved' }); render(); }
      if (target.dataset.act === 'reject') { await patch(entryId, { status: 'rejected' }); render(); }
    } catch (e) { toast(e.message, true); }
  });

  document.addEventListener('change', async function (event) {
    var target = event.target;
    var card = target.closest ? target.closest('.entry') : null;
    if (!card || !target.dataset || !target.dataset.act) return;
    try {
      if (target.dataset.act === 'duration') await patch(card.dataset.id, { durationMinutes: Number(target.value) });
      if (target.dataset.act === 'description') await patch(card.dataset.id, { description: target.value });
      if (target.dataset.act === 'billable') await patch(card.dataset.id, { billable: target.checked });
    } catch (e) { toast(e.message, true); }
  });

  var searchTimer = null;
  document.addEventListener('input', function (event) {
    var target = event.target;
    if (!target.dataset || target.dataset.act !== 'search') return;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async function () {
      var box = target.parentElement.querySelector('.results');
      if (box) box.remove();
      if (target.value.trim().length < 2) return;
      var data = await api('/api/tasks?q=' + encodeURIComponent(target.value.trim()));
      var el = document.createElement('div');
      el.className = 'results';
      el.innerHTML = data.tasks.map(function (t) {
        return '<div data-task-id="' + esc(t.taskId) + '" data-task-name="' + esc(t.taskName) + '">' +
          esc(t.taskName) + '<small>' + esc([t.folderName, t.listName].filter(Boolean).join(' › ')) + '</small></div>';
      }).join('') || '<div><small>No matches</small></div>';
      target.parentElement.appendChild(el);
    }, 220);
  });

  document.getElementById('date').addEventListener('change', function (e) { load(e.target.value); });
  document.getElementById('rebuild').addEventListener('click', async function () {
    try {
      var data = await api('/api/day/rebuild', { method: 'POST', body: JSON.stringify({ date: state.date }) });
      state.day = data.day; renderSummary(data.summary); render(); toast('Rebuilt from raw activity.');
    } catch (e) { toast(e.message, true); }
  });
  document.getElementById('refresh').addEventListener('click', async function () {
    try { var d = await api('/api/catalog/refresh', { method: 'POST' }); toast('Cached ' + d.taskCount + ' tasks.'); load(state.date); }
    catch (e) { toast(e.message, true); }
  });
  document.getElementById('approveAll').addEventListener('click', async function () {
    try {
      var data = await api('/api/day/approve-all', { method: 'POST', body: JSON.stringify({ date: state.date }) });
      state.day = data.day; renderSummary(data.summary); render(); toast('Approved ' + data.approved + ' entries.');
    } catch (e) { toast(e.message, true); }
  });
  document.getElementById('push').addEventListener('click', async function () {
    if (!confirm('Write all approved entries to ClickUp?')) return;
    try {
      var data = await api('/api/day/push', { method: 'POST', body: JSON.stringify({ date: state.date }) });
      state.day = data.day; renderSummary(data.summary); render();
      var failed = data.result.failures.length;
      toast('Pushed ' + data.result.pushed + ' entries' + (failed ? ', ' + failed + ' failed' : '.'), failed > 0);
    } catch (e) { toast(e.message, true); }
  });

  load('');
})();
</script>
</body>
</html>`;

export function renderPage(): string {
  return HTML;
}
