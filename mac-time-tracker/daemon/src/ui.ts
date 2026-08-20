/**
 * The review page, served from the local daemon at 127.0.0.1.
 *
 * Design notes worth keeping in mind when editing:
 *
 * - This is a tool, not a document: the summary reads before the detail, and
 *   state is carried by shape and colour as well as by number.
 * - Every client gets a stable hue, derived from its ClickUp folder name. That
 *   single device is what makes a day scannable — you see the shape of who you
 *   worked for before you read a word.
 * - Two panes: a draggable timeline for *when*, cards for *what*. Correcting a
 *   boundary is a drag; correcting a task is a search. Neither should require
 *   the other.
 * - Class names are namespaced (tl-, ent-, wk-) because this file has already
 *   been bitten once by two components sharing a name.
 */
const HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Timesheet Review</title>
<style>
  :root {
    color-scheme: light dark;
    /* Neutrals carry a slight indigo bias so they sit with the accent rather
       than reading as unconsidered greys. */
    --ground: #f6f6fa;
    --panel: #ffffff;
    --panel-2: #f1f1f7;
    --line: #e2e2ec;
    --line-strong: #cfcfdd;
    --text: #16161f;
    --muted: #64647a;
    --accent: #4f46e5;
    --accent-soft: #ecebfd;
    --ok: #0f7a52;
    --ok-soft: #e2f3ec;
    --warn: #8a5a00;
    --warn-soft: #fbf0da;
    --bad: #b0202c;
    --bad-soft: #fbe6e8;
    --shadow: 0 1px 2px rgba(20, 20, 40, 0.05), 0 8px 24px rgba(20, 20, 40, 0.06);
    /* Client hues resolve through these so both themes stay harmonious. */
    --cl-s: 62%;
    --cl-l: 52%;
    --cl-soft-l: 94%;
    --cl-ink-l: 30%;
    --radius: 12px;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --ground: #101019;
      --panel: #191922;
      --panel-2: #20202b;
      --line: #2b2b38;
      --line-strong: #3a3a4a;
      --text: #e8e8f0;
      --muted: #9a9ab2;
      --accent: #8b8cf7;
      --accent-soft: #262649;
      --ok: #4ed6a1;
      --ok-soft: #10352a;
      --warn: #e5b45c;
      --warn-soft: #3a2e12;
      --bad: #ff8b91;
      --bad-soft: #3d1a1f;
      --shadow: 0 1px 2px rgba(0, 0, 0, 0.4), 0 8px 24px rgba(0, 0, 0, 0.3);
      --cl-s: 52%;
      --cl-l: 60%;
      --cl-soft-l: 20%;
      --cl-ink-l: 78%;
    }
  }
  :root[data-theme="dark"] {
    --ground: #101019; --panel: #191922; --panel-2: #20202b; --line: #2b2b38;
    --line-strong: #3a3a4a; --text: #e8e8f0; --muted: #9a9ab2;
    --accent: #8b8cf7; --accent-soft: #262649;
    --ok: #4ed6a1; --ok-soft: #10352a; --warn: #e5b45c; --warn-soft: #3a2e12;
    --bad: #ff8b91; --bad-soft: #3d1a1f;
    --shadow: 0 1px 2px rgba(0, 0, 0, 0.4), 0 8px 24px rgba(0, 0, 0, 0.3);
    --cl-s: 52%; --cl-l: 60%; --cl-soft-l: 20%; --cl-ink-l: 78%;
  }

  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--ground); color: var(--text);
    font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  button, select, input, textarea { font: inherit; color: inherit; }
  button { cursor: pointer; }
  :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 4px; }
  @media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }

  /* ------------------------------------------------------------ header -- */
  header {
    position: sticky; top: 0; z-index: 20; background: var(--panel);
    border-bottom: 1px solid var(--line); padding: 10px 18px;
    display: flex; flex-direction: column; gap: 10px;
  }
  .hrow { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  h1 { font-size: 15px; font-weight: 650; margin: 0 6px 0 0; letter-spacing: -0.01em; white-space: nowrap; }
  .spacer { flex: 1 1 auto; }
  .btn {
    background: var(--panel); border: 1px solid var(--line-strong); border-radius: 8px;
    padding: 6px 11px; transition: border-color 120ms, background 120ms;
  }
  .btn:hover:not(:disabled) { border-color: var(--accent); }
  .btn:disabled { opacity: 0.45; cursor: default; }
  .btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 550; }
  .btn.primary:hover:not(:disabled) { filter: brightness(1.08); }
  .btn.ghost { border-style: dashed; }
  .chip {
    display: inline-flex; align-items: center; gap: 5px; font-size: 11px; padding: 3px 9px;
    border-radius: 99px; background: var(--panel-2); color: var(--muted); white-space: nowrap;
  }

  /* Week strip — the day pills, and the way back to any day in this week. */
  .week-strip { display: flex; gap: 6px; align-items: stretch; }
  .daypill {
    display: flex; flex-direction: column; align-items: center; gap: 2px;
    min-width: 52px; padding: 6px 8px 7px; border-radius: 10px;
    border: 1px solid var(--line); background: var(--panel); color: var(--muted);
    transition: border-color 120ms, background 120ms;
  }
  .daypill:hover { border-color: var(--accent); }
  .daypill .dow { font-size: 10px; text-transform: uppercase; letter-spacing: 0.07em; }
  .daypill .num { font-size: 15px; font-weight: 650; color: var(--text); font-variant-numeric: tabular-nums; }
  .daypill .met { width: 100%; height: 3px; border-radius: 99px; background: var(--line); }
  .daypill .met i { display: block; height: 100%; border-radius: 99px; background: var(--ok); }
  .daypill[aria-current="true"] { background: var(--accent-soft); border-color: var(--accent); }
  .daypill.future { opacity: 0.45; }

  .quicklog { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .quicklog .lbl { font-size: 10px; text-transform: uppercase; letter-spacing: 0.07em; color: var(--muted); }

  /* -------------------------------------------------------------- shell -- */
  main { padding: 16px 18px 60px; max-width: 1500px; margin: 0 auto; }
  .panes { display: grid; grid-template-columns: 290px minmax(0, 1fr); gap: 16px; align-items: start; }
  @media (max-width: 1080px) { .panes { grid-template-columns: 1fr; } }

  .card {
    background: var(--panel); border: 1px solid var(--line);
    border-radius: var(--radius); box-shadow: var(--shadow);
  }

  /* ----------------------------------------------------------- progress -- */
  .goal { padding: 14px 16px; margin-bottom: 14px; }
  .goal .top { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-bottom: 9px; }
  .goal .headline { font-weight: 650; font-size: 15px; letter-spacing: -0.01em; }
  .goal .headline.ok { color: var(--ok); }
  .goal .headline.warn { color: var(--warn); }
  .goal .headline.bad { color: var(--bad); }
  .goal .aside { font-size: 12px; color: var(--muted); }
  .meter { position: relative; height: 12px; border-radius: 99px; background: var(--panel-2); overflow: hidden; }
  .meter .seg { position: absolute; top: 0; bottom: 0; }
  .meter .seg.billable { background: var(--ok); }
  .meter .seg.other { background: var(--muted); opacity: 0.5; }
  .goal .mark { position: relative; height: 14px; margin-top: 3px; }
  .goal .mark i {
    position: absolute; top: -17px; width: 2px; height: 18px; background: var(--text); opacity: 0.45;
  }
  .goal .mark span {
    position: absolute; top: 0; transform: translateX(-50%); font-size: 10px; color: var(--muted);
    white-space: nowrap; font-variant-numeric: tabular-nums;
  }
  .goal .key { display: flex; gap: 14px; margin-top: 6px; font-size: 11px; color: var(--muted); }
  .goal .key i { display: inline-block; width: 9px; height: 9px; border-radius: 3px; margin-right: 5px; vertical-align: -1px; }

  /* ---------------------------------------------------------- timeline -- */
  .tl { padding: 12px 12px 14px; position: sticky; top: 128px; }
  .tl-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px; }
  .tl-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.07em; color: var(--muted); }
  .tl-hint { font-size: 11px; color: var(--muted); }
  .tl-grid { position: relative; margin-left: 44px; border-left: 1px solid var(--line); }
  .tl-hour { position: absolute; left: -44px; right: 0; border-top: 1px dashed var(--line); }
  .tl-hour span {
    position: absolute; left: 0; top: -7px; width: 38px; text-align: right;
    font-size: 10px; color: var(--muted); font-variant-numeric: tabular-nums;
  }
  .tl-block {
    position: absolute; left: 6px; right: 4px; border-radius: 7px; padding: 4px 7px; overflow: hidden;
    background: hsl(var(--h) var(--cl-s) var(--cl-l)); color: #fff;
    border: 1px solid hsl(var(--h) var(--cl-s) calc(var(--cl-l) - 10%));
    cursor: grab; touch-action: none; user-select: none;
    font-size: 11px; line-height: 1.25;
  }
  .tl-block:active { cursor: grabbing; }
  .tl-block.dragging { z-index: 5; box-shadow: 0 8px 20px rgba(0,0,0,0.28); }
  .tl-block.selected { outline: 2px solid var(--text); outline-offset: 1px; }
  .tl-block.rejected { opacity: 0.35; }
  .tl-block .who { font-weight: 600; }
  .tl-block .len { opacity: 0.85; font-variant-numeric: tabular-nums; }
  .tl-block .grip {
    position: absolute; left: 0; right: 0; bottom: 0; height: 7px; cursor: ns-resize;
  }
  .tl-block .grip::after {
    content: ''; position: absolute; left: 50%; bottom: 2px; transform: translateX(-50%);
    width: 18px; height: 2px; border-radius: 2px; background: rgba(255,255,255,0.65);
  }
  .tl-gap {
    position: absolute; left: 6px; right: 4px; border-radius: 6px;
    border: 1px dashed var(--line-strong); color: var(--muted);
    font-size: 10px; display: flex; align-items: center; justify-content: center;
  }
  .tl-empty { color: var(--muted); font-size: 12px; padding: 20px 4px; text-align: center; }
  .tl-note { margin-top: 9px; font-size: 11px; color: var(--warn); }

  /* ------------------------------------------------------------ entries -- */
  .ent-list { display: flex; flex-direction: column; gap: 10px; }
  .ent {
    display: grid; grid-template-columns: 34px 128px minmax(0, 1fr) 300px;
    gap: 14px; align-items: start; padding: 13px 15px 13px 0;
    border-left: 4px solid hsl(var(--h) var(--cl-s) var(--cl-l));
    scroll-margin-top: 150px; transition: border-color 120ms;
  }
  .ent.none { border-left-color: var(--line-strong); }
  .ent[data-status="synced"] { opacity: 0.72; }
  .ent[data-status="rejected"] { opacity: 0.45; }
  .ent.flash { animation: flash 1.1s ease-out; }
  @keyframes flash { from { background: var(--accent-soft); } to { background: var(--panel); } }

  /* State column: a tick that is unmistakable across the room. */
  .ent-state { display: flex; flex-direction: column; align-items: center; gap: 6px; padding-top: 2px; padding-left: 11px; }
  .tick {
    width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center;
    border: 1.5px solid var(--line-strong); background: var(--panel); color: transparent;
    transition: background 120ms, border-color 120ms, color 120ms;
  }
  .tick svg { width: 13px; height: 13px; }
  .tick:hover { border-color: var(--ok); color: var(--ok); }
  .ent[data-status="approved"] .tick { background: var(--ok); border-color: var(--ok); color: #fff; }
  .ent[data-status="synced"] .tick { background: var(--accent); border-color: var(--accent); color: #fff; }
  .ent-kill {
    width: 22px; height: 22px; border-radius: 6px; border: 1px solid transparent;
    background: none; color: var(--muted); display: grid; place-items: center; padding: 0;
  }
  .ent-kill svg { width: 12px; height: 12px; }
  .ent-kill:hover { color: var(--bad); border-color: var(--bad); background: var(--bad-soft); }

  .ent-when { font-variant-numeric: tabular-nums; }
  .ent-when .range { font-size: 12px; color: var(--muted); }
  .ent-when .dur { display: flex; align-items: baseline; gap: 4px; margin-top: 3px; }
  .ent-when input {
    width: 66px; text-align: right; font-size: 17px; font-weight: 650; padding: 3px 6px;
    border: 1px solid transparent; border-radius: 6px; background: var(--panel-2);
    font-variant-numeric: tabular-nums;
  }
  .ent-when input:hover:not(:disabled) { border-color: var(--line-strong); }
  .ent-when .unit { font-size: 12px; color: var(--muted); }
  .ent-when .measured { font-size: 11px; color: var(--muted); margin-top: 3px; }

  .ent-what .desc {
    width: 100%; border: 1px solid transparent; background: none; border-radius: 6px;
    padding: 3px 6px; margin: -3px 0 0 -6px; font-size: 14px;
  }
  .ent-what .desc:hover:not(:disabled) { border-color: var(--line); background: var(--panel-2); }
  .ent-what .meta { margin-top: 5px; font-size: 12px; color: var(--muted); }
  .ent-what .paths {
    margin-top: 4px; font: 11px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
    color: var(--muted); word-break: break-all;
  }
  .ent-what .why { margin: 6px 0 0; padding: 0; list-style: none; font-size: 12px; color: var(--muted); }
  .ent-what .why li { padding-left: 13px; position: relative; }
  .ent-what .why li::before { content: '·'; position: absolute; left: 4px; }

  .ent-task { position: relative; }
  .ent-task .conf { font-size: 11px; padding: 2px 8px; border-radius: 99px; display: inline-block; margin-bottom: 5px; }
  .conf.high { background: var(--ok-soft); color: var(--ok); }
  .conf.mid { background: var(--warn-soft); color: var(--warn); }
  .conf.low { background: var(--bad-soft); color: var(--bad); }
  .ent-task .name { font-weight: 600; line-height: 1.35; }
  .ent-task .name.empty { color: var(--muted); font-weight: 500; }
  .ent-task .scope {
    display: inline-block; margin-top: 4px; font-size: 11px; padding: 2px 8px; border-radius: 99px;
    background: hsl(var(--h) var(--cl-s) var(--cl-soft-l)); color: hsl(var(--h) var(--cl-s) var(--cl-ink-l));
  }
  .ent-task .search {
    width: 100%; margin-top: 7px; padding: 6px 9px; border-radius: 7px;
    border: 1px solid var(--line-strong); background: var(--panel);
  }
  .results {
    position: absolute; z-index: 12; left: 0; right: 0; top: 100%; margin-top: 3px;
    background: var(--panel); border: 1px solid var(--line-strong); border-radius: 9px;
    max-height: 280px; overflow: auto; box-shadow: var(--shadow);
  }
  .results div { padding: 7px 10px; cursor: pointer; border-bottom: 1px solid var(--line); }
  .results div:last-child { border-bottom: 0; }
  .results div:hover { background: var(--accent-soft); }
  .results small { display: block; color: var(--muted); }
  .ent-actions { display: flex; gap: 8px; align-items: center; margin-top: 9px; flex-wrap: wrap; font-size: 12px; }
  .ent-actions label { color: var(--muted); display: flex; gap: 5px; align-items: center; cursor: pointer; }

  /* --------------------------------------------------------------- week -- */
  .wk { padding: 16px; }
  .wk-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
  @media (max-width: 900px) { .wk-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  .wk-day { border: 1px solid var(--line); border-radius: 10px; padding: 11px 12px; background: var(--panel); }
  .wk-day.today { border-color: var(--accent); }
  .wk-day .d { font-size: 11px; text-transform: uppercase; letter-spacing: 0.07em; color: var(--muted); }
  .wk-day .h { font-size: 20px; font-weight: 650; font-variant-numeric: tabular-nums; margin: 2px 0 8px; }
  .wk-day .h.short { color: var(--warn); }
  .wk-day .h.none { color: var(--muted); }
  .wk-stack { display: flex; height: 8px; border-radius: 99px; overflow: hidden; background: var(--panel-2); }
  .wk-stack i { display: block; height: 100%; }
  .wk-clients { margin-top: 9px; display: flex; flex-direction: column; gap: 3px; font-size: 11px; }
  .wk-clients div { display: flex; justify-content: space-between; gap: 8px; color: var(--muted); }
  .wk-clients .sw { display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-right: 5px; vertical-align: -1px; }
  .wk-total { display: flex; gap: 26px; flex-wrap: wrap; margin-bottom: 14px; }
  .wk-total div { display: flex; flex-direction: column; }
  .wk-total .k { font-size: 11px; text-transform: uppercase; letter-spacing: 0.07em; color: var(--muted); }
  .wk-total .v { font-size: 22px; font-weight: 650; font-variant-numeric: tabular-nums; }

  .seg-ctl { display: inline-flex; background: var(--panel-2); border-radius: 8px; padding: 2px; gap: 2px; }
  .seg-ctl button { background: none; border: 0; border-radius: 6px; padding: 5px 12px; color: var(--muted); font-size: 13px; }
  .seg-ctl button[aria-pressed="true"] { background: var(--panel); color: var(--text); font-weight: 550; box-shadow: var(--shadow); }

  .empty { color: var(--muted); text-align: center; padding: 50px 0; }
  #toast {
    position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); z-index: 40;
    background: var(--panel); border: 1px solid var(--line-strong); border-radius: 9px;
    padding: 10px 16px; box-shadow: var(--shadow); display: none; max-width: 80vw;
  }
</style>
</head>
<body>
<header>
  <div class="hrow">
    <h1>Timesheet review</h1>
    <span class="week-strip" id="weekstrip"></span>
    <span class="spacer"></span>
    <span class="seg-ctl" id="viewctl">
      <button data-view="day" aria-pressed="true">Day</button>
      <button data-view="week" aria-pressed="false">Week</button>
    </span>
    <span id="catalog" class="chip"></span>
    <button class="btn" id="rebuild">Rebuild</button>
    <button class="btn" id="approveAll">Approve all matched</button>
    <button class="btn primary" id="push">Push to ClickUp</button>
  </div>
  <div class="hrow quicklog" id="quick"></div>
</header>
<main>
  <div class="card goal" id="goal" style="display:none"></div>
  <div id="dayview">
    <div class="panes">
      <div class="card tl" id="timeline"></div>
      <div class="ent-list" id="entries"></div>
    </div>
  </div>
  <div class="card wk" id="weekview" style="display:none"></div>
</main>
<div id="toast"></div>
<script>
(function () {
  var state = {
    date: null, day: null, targets: null, quickLog: [], view: 'day', selected: null, week: null,
    display: { timezone: '', dayStartHour: 7, dayEndHour: 19 },
    window: { from: 7, to: 19, stretched: false }
  };

  var ICON_TICK = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l3.2 3.2L13 5"/></svg>';
  var ICON_X = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>';

  /* ------------------------------------------------------------ helpers -- */
  function fmt(ms) {
    var mins = Math.max(0, Math.round(ms / 60000));
    var h = Math.floor(mins / 60), m = mins % 60;
    return h > 0 ? h + 'h ' + String(m).padStart(2, '0') + 'm' : m + 'm';
  }
  function hoursOnly(ms) { return (ms / 3600000).toFixed(1) + 'h'; }
  /**
   * All times render in one explicit zone. On an installed tracker that is the
   * Mac's own zone; setting display.timezone pins it, so a shared preview shows
   * studio time rather than whatever zone the viewer's browser happens to be in.
   */
  var TZ;
  var fmtClock, fmtParts;
  function setTimezone(tz) {
    TZ = tz || undefined;
    fmtClock = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ });
    fmtParts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TZ });
  }
  setTimezone('');

  function clock(ts) { return fmtClock.format(new Date(ts)); }

  /** Minutes since midnight in the display zone — the timeline's coordinate space. */
  function minutesOfDay(ts) {
    var hm = clock(ts).split(':');
    return Number(hm[0]) * 60 + Number(hm[1]);
  }

  /** Today's date in the display zone. Never toISOString(), which is UTC and
      lands on yesterday all morning anywhere east of Greenwich. */
  function todayInZone() { return fmtParts.format(new Date()); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function basename(p) { return p.split('/').pop(); }
  function toast(message, isError) {
    var el = document.getElementById('toast');
    el.textContent = message;
    el.style.borderColor = isError ? 'var(--bad)' : 'var(--line-strong)';
    el.style.display = 'block';
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.style.display = 'none'; }, 4500);
  }
  async function api(path, options) {
    var response = await fetch(path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, options));
    var body = await response.json();
    if (!response.ok) throw new Error(body.error || ('HTTP ' + response.status));
    return body;
  }

  /**
   * A stable hue per client. Same folder name always lands on the same colour,
   * on every machine, with no palette to maintain.
   */
  var HUES = [259, 199, 154, 24, 336, 96, 217, 44, 280, 172];
  function hueFor(name) {
    if (!name) return null;
    var h = 0;
    for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return HUES[h % HUES.length];
  }
  function clientOf(entry) {
    return entry.suggestion.folderName || entry.suggestion.spaceName || null;
  }
  function hueStyle(entry) {
    var hue = hueFor(clientOf(entry));
    return hue === null ? '' : ' style="--h:' + hue + '"';
  }

  function live(entries) { return entries.filter(function (e) { return e.status !== 'deleted'; }); }

  /* ----------------------------------------------------------- progress -- */
  function renderGoal(summary) {
    var el = document.getElementById('goal');
    if (!state.targets) { el.style.display = 'none'; return; }
    var dayMs = state.targets.dailyMinutes * 60000;
    var billTargetMs = state.targets.billableMinutes * 60000;
    var logged = summary.loggedMs || 0;
    var billable = Math.min(summary.billableMs || 0, logged);
    var other = logged - billable;
    var scale = Math.max(dayMs, billTargetMs, logged, 1);

    var cls, headline, aside;
    if (billable >= billTargetMs) {
      cls = 'ok';
      headline = 'Billable target met — ' + fmt(billable) + ' billable';
      aside = 'Anything else today is a bonus.';
    } else if (logged >= dayMs) {
      cls = 'warn';
      headline = fmt(logged) + ' logged, ' + fmt(billable) + ' billable';
      aside = 'Day minimum met. Swap in billable work if any is available — target is ' + fmt(billTargetMs) + '.';
    } else {
      cls = logged >= dayMs * 0.6 ? 'warn' : 'bad';
      headline = fmt(dayMs - logged) + ' short of the ' + fmt(dayMs) + ' day';
      aside = fmt(billable) + ' billable · ' + fmt(other) + ' non-billable. Meeting not logged? Use the buttons above.';
    }

    var bp = Math.min(100, (billable / scale) * 100);
    var op = Math.min(100 - bp, (other / scale) * 100);
    var mp = Math.min(100, (dayMs / scale) * 100);

    el.style.display = '';
    el.innerHTML =
      '<div class="top"><span class="headline ' + cls + '">' + headline + '</span>' +
      '<span class="aside">' + aside + '</span></div>' +
      '<div class="meter">' +
        '<div class="seg billable" style="left:0;width:' + bp + '%"></div>' +
        '<div class="seg other" style="left:' + bp + '%;width:' + op + '%"></div>' +
      '</div>' +
      (mp < 100 ? '<div class="mark"><i style="left:' + mp + '%"></i><span style="left:' + mp + '%">' + fmt(dayMs) + ' target</span></div>' : '') +
      '<div class="key"><span><i style="background:var(--ok)"></i>billable</span>' +
      '<span><i style="background:var(--muted);opacity:0.5"></i>non-billable</span></div>';
  }

  /* ------------------------------------------------------------ week bar -- */
  function renderWeekStrip() {
    var el = document.getElementById('weekstrip');
    if (!state.week) { el.innerHTML = ''; return; }
    var todayIso = todayInZone();
    el.innerHTML = state.week.days.slice(0, 5).map(function (d) {
      var target = (state.targets && state.targets.dailyMinutes * 60000) || 1;
      var pct = Math.min(100, (d.summary.loggedMs / target) * 100);
      var parts = d.date.split('-');
      var dow = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][state.week.days.indexOf(d)];
      return '<button class="daypill' + (d.date > todayIso ? ' future' : '') + '" data-date="' + d.date + '"' +
        ' aria-current="' + (d.date === state.date) + '" title="' + fmt(d.summary.loggedMs) + ' logged">' +
        '<span class="dow">' + dow + '</span>' +
        '<span class="num">' + Number(parts[2]) + '</span>' +
        '<span class="met"><i style="width:' + pct + '%"></i></span></button>';
    }).join('');
  }

  /* ----------------------------------------------------------- timeline -- */
  var PX_PER_HOUR = 58;
  var SNAP_MIN = 5;

  /**
   * The working window, from config. It is expanded only if an entry genuinely
   * falls outside it — hiding recorded time would be worse than a longer axis —
   * and the page says so when that happens.
   */
  function timelineWindow(entries) {
    var from = state.display.dayStartHour;
    var to = state.display.dayEndHour;
    var stretched = false;
    entries.forEach(function (e) {
      var startH = minutesOfDay(e.start) / 60;
      var endH = startH + e.durationMs / 3600000;
      if (startH < from) { from = Math.floor(startH); stretched = true; }
      if (endH > to) { to = Math.ceil(endH); stretched = true; }
    });
    return { from: from, to: Math.max(to, from + 1), stretched: stretched };
  }

  function renderTimeline() {
    var el = document.getElementById('timeline');
    var entries = live(state.day.entries);
    if (!entries.length) {
      el.innerHTML = '<div class="tl-head"><span class="tl-title">Timeline</span></div>' +
        '<div class="tl-empty">Nothing recorded yet.</div>';
      return;
    }
    var win = timelineWindow(entries);
    var height = (win.to - win.from) * PX_PER_HOUR;

    var hours = '';
    for (var h = win.from; h <= win.to; h++) {
      hours += '<div class="tl-hour" style="top:' + ((h - win.from) * PX_PER_HOUR) + 'px">' +
        '<span>' + String(h).padStart(2, '0') + ':00</span></div>';
    }

    var blocks = entries.map(function (entry) {
      var top = ((minutesOfDay(entry.start) - win.from * 60) / 60) * PX_PER_HOUR;
      var h = Math.max(20, (entry.durationMs / 3600000) * PX_PER_HOUR);
      var label = entry.suggestion.taskName || entry.description || 'Unmatched';
      var client = clientOf(entry) || 'No client';
      return '<div class="tl-block' + (entry.status === 'rejected' ? ' rejected' : '') +
        (state.selected === entry.id ? ' selected' : '') + '" data-id="' + entry.id + '"' +
        ' style="top:' + top + 'px;height:' + h + 'px;' +
        (hueFor(client) !== null ? '--h:' + hueFor(client) : '--h:250') + '"' +
        ' title="' + esc(label) + '">' +
        (h > 30 ? '<div class="who">' + esc(client) + '</div>' : '') +
        '<div class="len">' + clock(entry.start) + ' · ' + fmt(entry.durationMs) + '</div>' +
        (entry.status === 'synced' ? '' : '<div class="grip" data-grip="' + entry.id + '"></div>') +
        '</div>';
    }).join('');

    el.innerHTML =
      '<div class="tl-head"><span class="tl-title">Timeline</span>' +
      '<span class="tl-hint">drag to move · edge to resize</span></div>' +
      '<div class="tl-grid" style="height:' + height + 'px">' + hours + blocks + '</div>' +
      (win.stretched
        ? '<div class="tl-note">Some time falls outside ' +
          String(state.display.dayStartHour).padStart(2, '0') + ':00–' +
          String(state.display.dayEndHour).padStart(2, '0') + ':00.</div>'
        : '');
    state.window = win;
  }

  /* Dragging a block moves its start; dragging the grip changes its length. */
  var drag = null;
  document.addEventListener('pointerdown', function (event) {
    var grip = event.target.closest ? event.target.closest('.grip') : null;
    var block = event.target.closest ? event.target.closest('.tl-block') : null;
    if (!block) return;
    var entry = state.day.entries.filter(function (e) { return e.id === block.dataset.id; })[0];
    if (!entry || entry.status === 'synced') return;

    drag = {
      id: entry.id, mode: grip ? 'resize' : 'move', y0: event.clientY,
      start0: entry.start, dur0: entry.durationMs, el: block, moved: false
    };
    block.classList.add('dragging');
    block.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  document.addEventListener('pointermove', function (event) {
    if (!drag) return;
    var deltaMin = ((event.clientY - drag.y0) / PX_PER_HOUR) * 60;
    var snapped = Math.round(deltaMin / SNAP_MIN) * SNAP_MIN;
    if (Math.abs(snapped) < SNAP_MIN && !drag.moved) return;
    drag.moved = true;

    // Everything is clamped to the visible window, so a block can never be
    // dragged off the axis and lose its relationship to the hour labels.
    var win = state.window;
    var lo = win.from * 60;
    var hi = win.to * 60;
    var startMin0 = minutesOfDay(drag.start0);
    var durMin0 = drag.dur0 / 60000;

    if (drag.mode === 'move') {
      var wanted = startMin0 + snapped;
      var placed = Math.min(Math.max(wanted, lo), hi - durMin0);
      drag.newStart = drag.start0 + (placed - startMin0) * 60000;
      drag.newDur = drag.dur0;
      drag.el.style.top = (((placed - lo) / 60) * PX_PER_HOUR) + 'px';
    } else {
      var maxMin = hi - startMin0;
      var durMin = Math.min(Math.max(durMin0 + snapped, SNAP_MIN), maxMin);
      drag.newDur = durMin * 60000;
      drag.newStart = drag.start0;
      drag.el.style.height = Math.max(20, (durMin / 60) * PX_PER_HOUR) + 'px';
    }
    var len = drag.el.querySelector('.len');
    if (len) len.textContent = clock(drag.newStart) + ' · ' + fmt(drag.newDur);
  });

  document.addEventListener('pointerup', async function () {
    if (!drag) return;
    var finished = drag;
    drag = null;
    finished.el.classList.remove('dragging');
    if (!finished.moved) { select(finished.id); return; }

    try {
      await patch(finished.id, {
        start: finished.newStart,
        durationMinutes: Math.round(finished.newDur / 60000)
      });
      render();
      toast('Adjusted to ' + clock(finished.newStart) + ' · ' + fmt(finished.newDur));
    } catch (e) { toast(e.message, true); render(); }
  });

  function select(id) {
    state.selected = id;
    renderTimeline();
    var card = document.querySelector('.ent[data-id="' + id + '"]');
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.classList.remove('flash');
      void card.offsetWidth;
      card.classList.add('flash');
    }
  }

  /* ------------------------------------------------------------ entries -- */
  function renderEntry(entry) {
    var s = entry.suggestion;
    var synced = entry.status === 'synced';
    var pct = Math.round((s.confidence || 0) * 100);
    var confCls = s.confidence >= 0.7 ? 'high' : s.confidence >= 0.45 ? 'mid' : 'low';
    var confWord = s.confidence >= 0.7 ? 'confident' : s.confidence >= 0.45 ? 'unsure' : 'guess';
    var scope = [s.folderName, s.listName].filter(Boolean).map(esc).join(' › ');
    var why = (s.reasons || []).map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('');
    var files = entry.evidence.paths.slice(0, 2).map(function (p) { return esc(p); }).join('<br>');
    var urls = entry.evidence.urls.slice(0, 1).map(function (u) { return esc(u); }).join('');

    return '<div class="card ent' + (clientOf(entry) ? '' : ' none') + '" data-status="' + entry.status + '"' +
      ' data-id="' + entry.id + '"' + hueStyle(entry) + '>' +

      '<div class="ent-state">' +
        '<button class="tick" data-act="toggle" title="' +
          (entry.status === 'approved' ? 'Approved — click to undo' :
           synced ? 'In ClickUp' : 'Approve this entry') + '"' + (synced ? ' disabled' : '') + '>' +
          ICON_TICK + '</button>' +
        (synced ? '' : '<button class="ent-kill" data-act="delete" title="Delete this entry">' + ICON_X + '</button>') +
      '</div>' +

      '<div class="ent-when">' +
        '<div class="range">' + clock(entry.start) + '–' + clock(entry.end) + '</div>' +
        '<div class="dur"><input type="number" min="0" step="5" value="' + Math.round(entry.durationMs / 60000) + '"' +
          (synced ? ' disabled' : '') + ' data-act="duration"><span class="unit">min</span></div>' +
        '<div class="measured">measured ' + fmt(entry.activeMs) + '</div>' +
      '</div>' +

      '<div class="ent-what">' +
        '<input class="desc" type="text" value="' + esc(entry.description) + '"' + (synced ? ' disabled' : '') + ' data-act="description">' +
        '<div class="meta">' + esc(entry.evidence.apps.join(', ')) + '</div>' +
        (files || urls ? '<div class="paths">' + files + (urls ? (files ? '<br>' : '') + urls : '') + '</div>' : '') +
        (why ? '<ul class="why">' + why + '</ul>' : '') +
      '</div>' +

      '<div class="ent-task">' +
        '<span class="conf ' + confCls + '">' + pct + '% · ' + confWord + '</span>' +
        '<div class="name' + (entry.taskId ? '' : ' empty') + '">' +
          (entry.taskId ? esc(entry._picked || s.taskName || entry.taskId) : 'No task chosen') + '</div>' +
        (scope ? '<div class="scope">' + scope + '</div>' : '') +
        (synced ? '' : '<input class="search" type="text" placeholder="Search tasks…" data-act="search">') +
        '<div class="ent-actions">' +
          (synced
            ? '<span class="conf high">in ClickUp</span>'
            : '<button class="btn" data-act="skip">' + (entry.status === 'rejected' ? 'Un-skip' : 'Skip') + '</button>' +
              '<label><input type="checkbox" data-act="billable"' + (entry.billable ? ' checked' : '') + '> billable</label>') +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function render() {
    renderWeekStrip();
    var container = document.getElementById('entries');
    var entries = live(state.day.entries);
    if (!entries.length) {
      container.innerHTML = '<div class="card empty">No activity recorded for this day yet.</div>';
    } else {
      container.innerHTML = entries.map(renderEntry).join('');
    }
    renderTimeline();
  }

  async function patch(id, body) {
    var result = await api('/api/entry/' + encodeURIComponent(id), {
      method: 'POST',
      body: JSON.stringify(Object.assign({ date: state.date }, body))
    });
    var index = state.day.entries.findIndex(function (e) { return e.id === id; });
    if (index >= 0) state.day.entries[index] = result.entry;
    renderGoal(result.summary);
    return result.entry;
  }

  /* --------------------------------------------------------------- week -- */
  function renderWeek() {
    var el = document.getElementById('weekview');
    if (!state.week) { el.innerHTML = '<div class="empty">Loading…</div>'; return; }
    var days = state.week.days.slice(0, 5);
    var dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    var todayIso = todayInZone();
    var targetMs = state.targets.dailyMinutes * 60000;

    var totalLogged = days.reduce(function (s, d) { return s + d.summary.loggedMs; }, 0);
    var totalBillable = days.reduce(function (s, d) { return s + d.summary.billableMs; }, 0);
    var totalPending = days.reduce(function (s, d) { return s + d.summary.pendingMs; }, 0);
    var weekTarget = targetMs * 5;

    var cards = days.map(function (d, i) {
      var clients = Object.keys(d.byClient).sort(function (a, b) { return d.byClient[b] - d.byClient[a]; });
      var stack = clients.map(function (c) {
        var pct = (d.byClient[c] / Math.max(d.summary.loggedMs, 1)) * 100;
        return '<i style="width:' + pct + '%;background:hsl(' + hueFor(c) + ' var(--cl-s) var(--cl-l))"></i>';
      }).join('');
      var rows = clients.slice(0, 4).map(function (c) {
        return '<div><span><span class="sw" style="background:hsl(' + hueFor(c) + ' var(--cl-s) var(--cl-l))"></span>' +
          esc(c) + '</span><span>' + fmt(d.byClient[c]) + '</span></div>';
      }).join('');
      var cls = d.summary.loggedMs === 0 ? 'none' : (d.summary.loggedMs < targetMs ? 'short' : '');
      return '<button class="wk-day' + (d.date === todayIso ? ' today' : '') + '" data-goto="' + d.date + '" style="text-align:left">' +
        '<div class="d">' + dayNames[i] + '</div>' +
        '<div class="h ' + cls + '">' + hoursOnly(d.summary.loggedMs) + '</div>' +
        '<div class="wk-stack">' + stack + '</div>' +
        (rows ? '<div class="wk-clients">' + rows + '</div>' : '<div class="wk-clients"><div>Nothing logged</div></div>') +
        '</button>';
    }).join('');

    el.innerHTML =
      '<div class="wk-total">' +
        '<div><span class="k">Week logged</span><span class="v">' + fmt(totalLogged) + '</span></div>' +
        '<div><span class="k">Billable</span><span class="v">' + fmt(totalBillable) + '</span></div>' +
        '<div><span class="k">Target</span><span class="v">' + fmt(weekTarget) + '</span></div>' +
        '<div><span class="k">Still to review</span><span class="v">' + fmt(totalPending) + '</span></div>' +
      '</div>' +
      '<div class="wk-grid">' + cards + '</div>';
  }

  function setView(view) {
    state.view = view;
    document.getElementById('dayview').style.display = view === 'day' ? '' : 'none';
    document.getElementById('weekview').style.display = view === 'week' ? '' : 'none';
    document.getElementById('goal').style.display = view === 'day' && state.targets ? '' : 'none';
    document.querySelectorAll('#viewctl button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.view === view));
    });
    if (view === 'week') renderWeek();
  }

  /* ---------------------------------------------------------------- load -- */
  async function loadWeek(date) {
    state.week = await api('/api/week' + (date ? '?date=' + encodeURIComponent(date) : ''));
    renderWeekStrip();
    if (state.view === 'week') renderWeek();
  }

  async function load(date) {
    var data = await api(date ? '/api/day?date=' + encodeURIComponent(date) : '/api/day');
    state.date = data.day.date;
    state.day = data.day;
    state.targets = data.targets || null;
    state.quickLog = data.quickLog || [];
    if (data.display) { state.display = data.display; setTimezone(data.display.timezone); }

    var quick = document.getElementById('quick');
    quick.innerHTML = state.quickLog.length
      ? '<span class="lbl">Quick log</span>' + state.quickLog.map(function (q) {
          return '<button class="btn ghost" data-quick="' + q.index + '" title="' + esc(q.taskName || q.label) + '">+ ' +
            esc(q.label) + ' ' + q.minutes + 'm</button>';
        }).join('')
      : '';

    document.getElementById('catalog').textContent = data.taskCount + ' tasks';
    renderGoal(data.summary);
    render();
    await loadWeek(state.date);
  }

  /* ------------------------------------------------------------- events -- */
  document.addEventListener('click', async function (event) {
    var t = event.target;

    var pill = t.closest ? t.closest('.daypill') : null;
    if (pill) { try { await load(pill.dataset.date); setView('day'); } catch (e) { toast(e.message, true); } return; }

    var goto = t.closest ? t.closest('[data-goto]') : null;
    if (goto) { try { await load(goto.dataset.goto); setView('day'); } catch (e) { toast(e.message, true); } return; }

    if (t.dataset && t.dataset.view) { setView(t.dataset.view); return; }

    if (t.dataset && t.dataset.quick !== undefined) {
      try {
        var q = state.quickLog[Number(t.dataset.quick)];
        var data = await api('/api/quick-log', {
          method: 'POST', body: JSON.stringify({ index: Number(t.dataset.quick), date: state.date })
        });
        state.day = data.day; renderGoal(data.summary); render(); loadWeek(state.date);
        toast('Logged ' + q.minutes + 'm — ' + q.label + '. Adjust on the entry if it ran longer.');
      } catch (e) { toast(e.message, true); }
      return;
    }

    var pick = t.closest ? t.closest('.results div[data-task-id]') : null;
    if (pick) {
      var card = pick.closest('.ent');
      try {
        var updated = await patch(card.dataset.id, { taskId: pick.dataset.taskId });
        updated._picked = pick.dataset.taskName;
        render(); loadWeek(state.date);
      } catch (e) { toast(e.message, true); }
      return;
    }

    var entCard = t.closest ? t.closest('.ent') : null;
    if (!entCard) return;
    var id = entCard.dataset.id;
    var act = t.closest('[data-act]') ? t.closest('[data-act]').dataset.act : null;

    try {
      if (act === 'toggle') {
        var entry = state.day.entries.filter(function (e) { return e.id === id; })[0];
        await patch(id, { status: entry.status === 'approved' ? 'pending' : 'approved' });
        render(); loadWeek(state.date);
      }
      if (act === 'delete') {
        await patch(id, { status: 'deleted' });
        render(); loadWeek(state.date);
        toast('Entry deleted. Rebuilding the day will not bring it back.');
      }
      if (act === 'skip') {
        var e2 = state.day.entries.filter(function (e) { return e.id === id; })[0];
        await patch(id, { status: e2.status === 'rejected' ? 'pending' : 'rejected' });
        render(); loadWeek(state.date);
      }
    } catch (e) { toast(e.message, true); }
  });

  document.addEventListener('change', async function (event) {
    var t = event.target;
    var card = t.closest ? t.closest('.ent') : null;
    if (!card || !t.dataset || !t.dataset.act) return;
    try {
      if (t.dataset.act === 'duration') { await patch(card.dataset.id, { durationMinutes: Number(t.value) }); render(); loadWeek(state.date); }
      if (t.dataset.act === 'description') await patch(card.dataset.id, { description: t.value });
      if (t.dataset.act === 'billable') { await patch(card.dataset.id, { billable: t.checked }); loadWeek(state.date); }
    } catch (e) { toast(e.message, true); }
  });

  var searchTimer = null;
  document.addEventListener('input', function (event) {
    var t = event.target;
    if (!t.dataset || t.dataset.act !== 'search') return;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async function () {
      var open = t.parentElement.querySelector('.results');
      if (open) open.remove();
      if (t.value.trim().length < 2) return;
      var data = await api('/api/tasks?q=' + encodeURIComponent(t.value.trim()));
      var box = document.createElement('div');
      box.className = 'results';
      box.innerHTML = data.tasks.map(function (task) {
        return '<div data-task-id="' + esc(task.taskId) + '" data-task-name="' + esc(task.taskName) + '">' +
          esc(task.taskName) + '<small>' + esc([task.folderName, task.listName].filter(Boolean).join(' › ')) + '</small></div>';
      }).join('') || '<div><small>No matches</small></div>';
      t.parentElement.appendChild(box);
    }, 220);
  });

  document.getElementById('rebuild').addEventListener('click', async function () {
    try {
      var data = await api('/api/day/rebuild', { method: 'POST', body: JSON.stringify({ date: state.date }) });
      state.day = data.day; renderGoal(data.summary); render(); loadWeek(state.date);
      toast('Rebuilt from raw activity.');
    } catch (e) { toast(e.message, true); }
  });
  document.getElementById('approveAll').addEventListener('click', async function () {
    try {
      var data = await api('/api/day/approve-all', { method: 'POST', body: JSON.stringify({ date: state.date }) });
      state.day = data.day; renderGoal(data.summary); render(); loadWeek(state.date);
      toast('Approved ' + data.approved + ' entries.');
    } catch (e) { toast(e.message, true); }
  });
  document.getElementById('push').addEventListener('click', async function () {
    if (!confirm('Write all approved entries to ClickUp?')) return;
    try {
      var data = await api('/api/day/push', { method: 'POST', body: JSON.stringify({ date: state.date }) });
      state.day = data.day; renderGoal(data.summary); render(); loadWeek(state.date);
      var failed = data.result.failures.length;
      toast('Pushed ' + data.result.pushed + ' entries' + (failed ? ', ' + failed + ' failed' : '.'), failed > 0);
    } catch (e) { toast(e.message, true); }
  });

  load('').catch(function (e) { toast(e.message, true); });
})();
</script>
</body>
</html>`;

export function renderPage(): string {
  return HTML;
}
