import { installNetworkGuard } from './netguard.ts';
installNetworkGuard();

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Runtime, defaultObserverPath } from './runtime.ts';
import { loadDay, localDate, listDays, rebuildDay, saveDay } from './store.ts';
import { pushApproved } from './sync.ts';
import { loadToken } from './config.ts';
import { paths, ensureDirs } from './paths.ts';
import { validateConfig, validateRules } from './validate.ts';
import { allowedHosts } from './netguard.ts';
import { loadRules } from './config.ts';
import { openUrl } from './notify.ts';
import { LOW_CONFIDENCE } from './matcher.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');

const ESC = String.fromCharCode(27);
const useColour = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
const paint = (code: string, text: string): string =>
  useColour ? `${ESC}[${code}m${text}${ESC}[0m` : text;
const green = (t: string) => paint('32', t);
const amber = (t: string) => paint('33', t);
const dim = (t: string) => paint('2', t);

function hhmm(ms: number): string {
  const mins = Math.round(ms / 60_000);
  return `${String(Math.floor(mins / 60)).padStart(2, ' ')}h ${String(mins % 60).padStart(2, '0')}m`;
}

function clock(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function report(date: string): void {
  const day = loadDay(date);
  if (day.entries.length === 0) {
    console.log(`No entries for ${date}.`);
    return;
  }
  console.log(`\n  ${date}\n`);
  for (const entry of day.entries) {
    const flag = entry.status === 'synced' ? green('*')
      : entry.status === 'approved' ? green('>')
      : entry.status === 'rejected' ? dim('.') : ' ';
    const task = entry.taskId ? (entry.suggestion.taskName ?? entry.taskId) : amber('(no task)');
    const scope = [entry.suggestion.folderName, entry.suggestion.listName].filter(Boolean).join(' > ');
    const conf = entry.taskId && entry.suggestion.confidence < LOW_CONFIDENCE ? amber(' (low confidence)') : '';
    console.log(`  ${flag} ${clock(entry.start)}-${clock(entry.end)}  ${hhmm(entry.durationMs)}  ${task}${conf}`);
    console.log(dim(`      ${scope || '-'}  |  ${entry.description}`));
  }
  const total = day.entries.filter((e) => e.status !== 'rejected').reduce((s, e) => s + e.durationMs, 0);
  const pending = day.entries.filter((e) => e.status === 'pending').reduce((s, e) => s + e.durationMs, 0);
  console.log(`\n  Total ${hhmm(total)}  |  awaiting review ${hhmm(pending)}\n`);
}

async function doctor(): Promise<void> {
  const results: Array<[boolean, string]> = [];
  ensureDirs();
  results.push([true, `Data directory: ${paths.data()}`]);
  results.push([true, `Outbound network: restricted to ${allowedHosts().join(', ')} (enforced in-process; verify with Little Snitch or \`lsof -i -p <pid>\`)`]);

  const configExists = fs.existsSync(paths.config());
  results.push([configExists, configExists
    ? `Config: ${paths.config()}`
    : 'No config yet - run `node src/cli.ts init` to copy the examples in.']);

  const rulesExist = fs.existsSync(paths.rules());
  results.push([rulesExist, rulesExist
    ? `Rules: ${paths.rules()}`
    : 'No rules.json (optional, but it makes matching much better).']);

  const runtime = new Runtime();

  const observer = defaultObserverPath(runtime.config.observer.binaryPath);
  const observerExists = fs.existsSync(observer);
  results.push([observerExists, observerExists
    ? `Observer binary: ${observer}`
    : `Observer not built. Run: (cd ${path.join(repoRoot, 'observer')} && swift build -c release)`]);

  if (runtime.config.observer.mode === 'spool') {
    const spool = runtime.config.observer.spoolPath || paths.spool();
    try {
      const stat = fs.statSync(spool);
      const ageMinutes = (Date.now() - stat.mtimeMs) / 60_000;
      // The observer samples every few seconds, so anything older than a couple
      // of minutes means it is not running (or has no permission to say much).
      results.push([ageMinutes < 2,
        `Observer spool ${spool}: last written ${ageMinutes < 1 ? 'just now' : `${Math.round(ageMinutes)} min ago`}`]);
    } catch {
      results.push([false, `Observer spool ${spool} does not exist. Is com.motionbydesign.timetracker.observer loaded? Check: launchctl list | grep timetracker`]);
    }
  } else {
    results.push([true, 'Observer mode: spawn (the daemon starts the observer itself)']);
  }

  const token = loadToken(runtime.config);
  results.push([token !== null, token
    ? 'ClickUp token found.'
    : `No ClickUp token. Store one with:\n      security add-generic-password -s ${runtime.config.clickup.keychainService} -a ${runtime.config.clickup.keychainAccount} -w '<token>'`]);

  if (token) {
    try {
      const user = await runtime.getClient()!.getUser();
      results.push([true, `Authenticated as ${user.user.username} <${user.user.email}>`]);
    } catch (error) {
      results.push([false, `ClickUp rejected the token: ${String(error)}`]);
    }
  }

  const catalog = runtime.getContext().catalog;
  results.push([catalog.tasks.length > 0, catalog.tasks.length > 0
    ? `Catalog: ${catalog.tasks.length} tasks, ${catalog.folders.length} client folders (fetched ${new Date(catalog.fetchedAt).toLocaleString()})`
    : 'Catalog empty - run `node src/cli.ts catalog`.']);

  const roots = runtime.config.projectRoots;
  if (roots.length === 0) {
    results.push([false, 'No projectRoots configured; client detection falls back to folder-name matching only.']);
  } else {
    for (const root of roots) {
      const expanded = root.path.replace(/^~/, process.env.HOME ?? '~');
      const mounted = fs.existsSync(expanded);
      results.push([mounted, `Project root ${expanded}${mounted ? '' : ' (not mounted)'}`]);
    }
  }

  console.log('');
  for (const [ok, message] of results) console.log(`  ${ok ? green('OK') : amber(' !')} ${message}`);

  const problems = [
    ...validateConfig(runtime.config),
    ...validateRules(loadRules()),
  ];
  if (problems.length > 0) {
    console.log('');
    for (const problem of problems) {
      const tag = problem.severity === 'error' ? amber('ERR') : dim('wrn');
      console.log(`  ${tag} ${problem.message}`);
    }
  }
  console.log('');
  if (problems.some((p) => p.severity === 'error')) process.exitCode = 1;
}

function init(): void {
  ensureDirs();
  const examples: Array<[string, string]> = [
    [path.join(repoRoot, 'config', 'config.example.json'), paths.config()],
    [path.join(repoRoot, 'config', 'rules.example.json'), paths.rules()],
  ];
  for (const [from, to] of examples) {
    if (fs.existsSync(to)) {
      console.log(`  skipped ${to} (already exists)`);
      continue;
    }
    fs.copyFileSync(from, to);
    fs.chmodSync(to, 0o600);
    console.log(`  wrote ${to}`);
  }
  console.log('\n  Edit those, then run `node src/cli.ts doctor`.\n');
}

async function main(): Promise<void> {
  const [command = 'help', arg] = process.argv.slice(2);
  const date = arg && /^\d{4}-\d{2}-\d{2}$/.test(arg) ? arg : localDate();

  switch (command) {
    case 'init':
      init();
      return;
    case 'doctor':
      await doctor();
      return;
    case 'catalog': {
      const runtime = new Runtime();
      await runtime.refreshCatalog();
      const catalog = runtime.getContext().catalog;
      console.log(`  ${catalog.tasks.length} tasks across ${catalog.lists.length} lists cached.`);
      return;
    }
    case 'rebuild': {
      const runtime = new Runtime();
      rebuildDay(date, runtime.getContext());
      report(date);
      return;
    }
    case 'report':
      report(date);
      return;
    case 'days':
      for (const d of listDays()) console.log(`  ${d}`);
      return;
    case 'approve-all': {
      const day = loadDay(date);
      let count = 0;
      for (const entry of day.entries) {
        if (entry.status === 'pending' && entry.taskId) { entry.status = 'approved'; count++; }
      }
      saveDay(day);
      console.log(`  Approved ${count} entries for ${date}.`);
      return;
    }
    case 'push': {
      const runtime = new Runtime();
      const client = runtime.getClient();
      if (!client) { console.error('  No ClickUp token configured.'); process.exitCode = 1; return; }
      const result = await pushApproved(client, runtime.config, loadDay(date));
      console.log(`  Pushed ${result.pushed}, skipped ${result.skipped}.`);
      for (const failure of result.failures) console.error(`  ! ${failure.entryId}: ${failure.reason}`);
      if (result.failures.length > 0) process.exitCode = 1;
      return;
    }
    case 'review': {
      const runtime = new Runtime();
      openUrl(`http://${runtime.config.server.host}:${runtime.config.server.port}/`);
      return;
    }
    default:
      console.log(`
  Usage: node src/cli.ts <command> [YYYY-MM-DD]

    init          Copy the example config and rules into the data directory
    doctor        Check config, token, observer build and catalog
    catalog       Refresh the cached ClickUp workspace and tasks
    rebuild       Re-derive a day's proposed entries from raw activity
    report        Print a day's proposed timesheet
    days          List days with recorded activity
    approve-all   Approve every matched pending entry for a day
    push          Write approved entries to ClickUp
    review        Open the review UI in your browser
`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
