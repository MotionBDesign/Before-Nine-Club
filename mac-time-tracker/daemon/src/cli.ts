import { installNetworkGuard } from './netguard.ts';
installNetworkGuard();

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Runtime, defaultObserverPath } from './runtime.ts';
import { loadCatalog, loadDay, localDate, listDays, rebuildDay, resolveTask, saveDay } from './store.ts';
import { pushApproved } from './sync.ts';
import { loadToken } from './config.ts';
import { paths, ensureDirs } from './paths.ts';
import { validateConfig, validateRules } from './validate.ts';
import { allowedHosts } from './netguard.ts';
import { loadRules } from './config.ts';
import { openUrl } from './notify.ts';
import { LOW_CONFIDENCE } from './matcher.ts';
import { applyUpdate, checkForUpdate, installedVersion } from './update.ts';
import { assess, readFleet } from './fleet.ts';
import { readMemory, DAEMON_RSS_WARN_MB } from './health.ts';
import { applyDeploySettings, type DeploySettings } from './deploy.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');

const ESC = String.fromCharCode(27);
const useColour = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
const paint = (code: string, text: string): string =>
  useColour ? `${ESC}[${code}m${text}${ESC}[0m` : text;
const green = (t: string) => paint('32', t);
const amber = (t: string) => paint('33', t);
const dim = (t: string) => paint('2', t);
const red = (t: string) => paint('31', t);

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
  // Names come from the catalog by way of the entry's *chosen* task, so a
  // corrected entry prints the task it will be logged against.
  const tasksById = new Map(loadCatalog().tasks.map((t) => [t.taskId, t]));
  for (const entry of day.entries) {
    const flag = entry.status === 'synced' ? green('*')
      : entry.status === 'approved' ? green('>')
      : entry.status === 'rejected' ? dim('.') : ' ';
    const resolved = resolveTask(entry, tasksById);
    const task = entry.taskId ? (resolved.taskName ?? entry.taskId) : amber('(no task)');
    const scope = [resolved.folderName, resolved.listName].filter(Boolean).join(' > ');
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
    : fs.existsSync(path.join(repoRoot, 'BUNDLE'))
      ? `Observer missing from this bundle at ${observer}. Re-run scripts/install.sh from the server folder.`
      : `No observer at ${observer}. Re-run scripts/install.sh, which builds "MBD Time Tracker.app" with osacompile.`]);

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

  const memory = readMemory();
  results.push([
    memory.observerMB !== null,
    memory.observerMB === null
      ? 'Observer process not found — it is not running, so nothing is being recorded.'
      : `Observer running as "${memory.observerName}" (pid ${memory.observerPid}), using ${memory.observerMB}MB.`,
  ]);
  results.push([
    memory.daemonMB < DAEMON_RSS_WARN_MB,
    `This process is using ${memory.daemonMB}MB` +
      (memory.daemonMB < DAEMON_RSS_WARN_MB ? '' : ` — over the ${DAEMON_RSS_WARN_MB}MB it should ever need; please report it.`),
  ]);

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

function ago(ts: number): string {
  const minutes = Math.round((Date.now() - ts) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hrs = Math.round(minutes / 60);
  return hrs < 48 ? `${hrs}h ago` : `${Math.round(hrs / 24)}d ago`;
}

/** The studio-wide view: who is running what, and who needs help. */
function fleet(runtime: Runtime): void {
  const dir = runtime.config.fleet.statusDir;
  if (!dir) {
    console.log('\n  No fleet.statusDir configured — nothing to report on.\n');
    return;
  }
  const statuses = readFleet(dir);
  if (statuses.length === 0) {
    console.log(`\n  No status files in ${dir}. Is the share mounted, and has anyone reported yet?\n`);
    return;
  }

  const badge: Record<string, string> = {
    ok: green('  ok  '), attention: amber(' check'), broken: red(' BROKEN'), stale: dim(' stale'),
  };
  const versions = new Set(statuses.map((s) => s.version ?? 'unknown'));

  console.log('');
  for (const status of statuses) {
    const { verdict, note } = assess(status);
    const who = `${status.user}@${status.mac}`.padEnd(28).slice(0, 28);
    const version = (status.version ?? 'unknown').padEnd(18);
    const today = `${(status.today.loggedMinutes / 60).toFixed(1)}h logged`;
    const target = `${(status.targets.dailyMinutes / 60).toFixed(1)}h`;
    const memory = status.memory
      ? dim(`  ${status.memory.daemonMB}MB + ${status.memory.observerMB ?? '-'}MB`)
      : '';
    console.log(`  ${badge[verdict]}  ${who} ${dim(version)} ${today} / ${target}   ${dim(ago(status.reportedAt))}${memory}`);
    if (note) console.log(`            ${amber(note)}`);
  }

  if (versions.size > 1) {
    console.log(`\n  ${amber('!')} ${versions.size} different versions in use: ${[...versions].join(', ')}`);
    console.log('    Stage a release and they will pick it up on their next update check.');
  }
  console.log('');
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
    case 'probe': {
      // The honest answer to "does it work in <app>?" is to look. Switch
      // between apps while this runs and watch what each one gives up.
      const runtime = new Runtime();
      const spool = runtime.config.observer.spoolPath || paths.spool();
      const seconds = Number(arg) > 0 ? Number(arg) : 60;
      console.log(`\n  Watching ${spool} for ${seconds}s.`);
      console.log('  Switch between apps and open a document in each.\n');
      console.log(`  ${'APP'.padEnd(22)}${'FILE PATH'.padEnd(30)}TITLE`);
      console.log(`  ${'-'.repeat(72)}`);

      const seen = new Set<string>();
      const started = Date.now();
      let offset = 0;
      try {
        offset = fs.statSync(spool).size;
      } catch {
        console.error('  No spool yet — is the observer agent running?\n');
        return;
      }

      while (Date.now() - started < seconds * 1000) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        let chunk = '';
        try {
          const stat = fs.statSync(spool);
          if (stat.size <= offset) continue;
          const handle = fs.openSync(spool, 'r');
          const buffer = Buffer.alloc(stat.size - offset);
          fs.readSync(handle, buffer, 0, buffer.length, offset);
          fs.closeSync(handle);
          offset = stat.size;
          chunk = buffer.toString('utf8');
        } catch {
          continue;
        }
        for (const line of chunk.split('\n')) {
          if (!line.trim()) continue;
          let snap: { app?: string; documentPath?: string | null; url?: string | null; title?: string | null };
          try { snap = JSON.parse(line); } catch { continue; }
          const key = `${snap.app}|${snap.documentPath ?? snap.url ?? ''}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const where = snap.documentPath ?? snap.url ?? dim('(none)');
          const title = snap.title ?? dim('(none)');
          console.log(`  ${String(snap.app ?? '?').slice(0, 21).padEnd(22)}${String(where).slice(0, 29).padEnd(30)}${String(title).slice(0, 40)}`);
        }
      }
      console.log(`\n  Apps with a file path or URL will match best. Title-only still works\n  via the filename; app-only needs a rule or a manual entry.\n`);
      return;
    }
    case 'configure': {
      // Wiring an *existing* install, without reinstalling it. Every Mac needs
      // the same two paths, and typing them into six config files by hand is
      // how five of them end up right.
      const flags = process.argv.slice(3);
      const settings: DeploySettings = {};
      for (let i = 0; i < flags.length; i += 2) {
        const value = flags[i + 1];
        if (value === undefined) break;
        if (flags[i] === '--channel') settings.channel = value;
        else if (flags[i] === '--status-dir') settings.statusDir = value;
        else if (flags[i] === '--workspace') settings.workspaceId = value;
        else if (flags[i] === '--round-minutes') {
          const minutes = Number(value);
          if (!Number.isFinite(minutes) || minutes <= 0) {
            console.error(`\n  --round-minutes needs a positive number, got "${value}"\n`);
            process.exitCode = 1;
            return;
          }
          settings.roundMinutes = minutes;
        }
      }
      if (Object.keys(settings).length === 0) {
        console.log(`
  Usage: tracker configure [--channel <path>] [--status-dir <path>] [--workspace <id>]

    --channel      folder on the share holding LATEST and the staged bundles.
                   Updates are picked up from here automatically.
    --status-dir   folder this Mac writes its health file into, so the studio
                   can see whether tracking is actually working.
    --workspace    ClickUp workspace id.
    --round-minutes  the grid time is logged on, e.g. 15. Sets both the
                   rounding and the shortest entry, which have to agree.

  Nothing else in config.json is touched.
`);
        process.exitCode = 1;
        return;
      }

      const result = applyDeploySettings(settings);
      console.log('');
      if (result.unchanged) {
        console.log(`  Already set that way in ${result.configPath}`);
      } else {
        for (const [key, value] of Object.entries(result.applied)) {
          console.log(`  ${green('OK')} ${key} = ${value}`);
        }
        console.log(`\n  Written to ${result.configPath}`);
      }
      for (const missing of result.unreachable) {
        console.log(`  ${amber(' !')} ${missing} is not reachable right now — mount the share, or check the path.`);
      }
      if (result.applied.roundMinutes !== undefined) {
        console.log(`\n  Days already recorded keep their old shape until rebuilt:`);
        console.log(`    tracker rebuild            today`);
        console.log(`    tracker rebuild 2026-08-20 a particular day`);
      }
      console.log(`\n  Restart the tracker so it picks this up:`);
      console.log(`    launchctl kickstart -k gui/$UID/com.motionbydesign.timetracker\n`);
      return;
    }

    case 'fleet': {
      fleet(new Runtime());
      return;
    }
    case 'update': {
      const runtime = new Runtime();
      const check = checkForUpdate(runtime.config);
      console.log(`\n  Installed: ${check.installed ?? 'unknown'}`);
      console.log(`  Published: ${check.published ?? 'unavailable'}`);
      console.log(`  ${check.reason}\n`);
      if (check.available) {
        if (arg === '--apply') {
          applyUpdate(check);
          console.log('  Installer launched; the agents will restart shortly.\n');
        } else {
          console.log('  Run `node src/cli.ts update --apply` to install it now.\n');
        }
      }
      return;
    }
    case 'version':
      console.log(`  ${installedVersion() ?? 'source checkout (no bundle stamp)'}`);
      return;
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
    version       Show which bundle is installed
    update        Check the server for a newer bundle (--apply to install)
    fleet         Show every Mac's tracker health from the shared status folder
    configure     Point this Mac at the studio's update channel and status
                  folder — run "tracker configure" for the flags
    probe [secs]  Watch what each app actually reports — the way to check
                  whether Resolve, Photoshop or Figma give up a file path
`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
