import { installNetworkGuard } from './netguard.ts';
installNetworkGuard();

import { Runtime, defaultObserverPath } from './runtime.ts';
import { startObserver, type ActivitySource } from './observer.ts';
import { startSpoolReader } from './spool.ts';
import { createServer } from './server.ts';
import { appendSnapshot, loadDay, localDate, pruneSnapshots, rebuildDay } from './store.ts';
import { paths } from './paths.ts';
import { notify } from './notify.ts';
import { InstanceLock } from './lock.ts';
import { applyUpdate, checkForUpdate, confirmInstalled } from './update.ts';
import { buildStatus, reportStatus } from './fleet.ts';
import { validateConfig, validateRules } from './validate.ts';
import { log } from './log.ts';

const MINUTE = 60_000;

function pendingMinutes(date: string): number {
  return Math.round(
    loadDay(date).entries
      .filter((e) => e.status === 'pending')
      .reduce((sum, e) => sum + e.durationMs, 0) / MINUTE,
  );
}

function loggedMinutes(date: string): { logged: number; billable: number } {
  const entries = loadDay(date).entries.filter((e) => e.status !== 'rejected');
  const logged = entries.reduce((sum, e) => sum + e.durationMs, 0) / MINUTE;
  const billable = entries.filter((e) => e.billable).reduce((sum, e) => sum + e.durationMs, 0) / MINUTE;
  return { logged: Math.round(logged), billable: Math.round(billable) };
}

function hours(minutes: number): string {
  return `${(minutes / 60).toFixed(1)}h`;
}

async function main(): Promise<void> {
  const lock = new InstanceLock();
  const conflict = lock.acquire();
  if (conflict) {
    log.error(`Refusing to start: ${conflict}.`);
    log.error('Two trackers sharing a data directory overwrite each other\'s approvals.');
    process.exit(1);
  }

  const runtime = new Runtime();

  // Bad config should be loud at startup, not discovered days later. Errors
  // are logged but do not stop tracking — recording activity is still useful
  // while the config is being fixed.
  const problems = [...validateConfig(runtime.config), ...validateRules(runtime.rules)];
  for (const problem of problems) {
    if (problem.severity === 'error') log.error(`Config: ${problem.message}`);
    else log.warn(`Config: ${problem.message}`);
  }

  await runtime.refreshCatalogIfStale();

  const { config } = runtime;
  const reviewUrl = `http://${config.server.host}:${config.server.port}/`;

  let currentDate = localDate();
  const notifiedHours = new Set<number>();

  // In spool mode the observer is a separate launch agent and already
  // sanitised nothing — startSpoolReader applies the privacy settings itself.
  const spoolFile = config.observer.spoolPath || paths.spool();
  const source: ActivitySource = config.observer.mode === 'spawn'
    ? startObserver(defaultObserverPath(config.observer.binaryPath), config, appendSnapshot)
    : startSpoolReader(spoolFile, config, appendSnapshot, config.observer.pollSeconds * 1000);
  log.info(
    config.observer.mode === 'spawn'
      ? 'Observer mode: spawn (the daemon starts the observer itself)'
      : `Observer mode: spool (${spoolFile})`,
  );

  /** Re-derive today's proposal so the review page is never more than a few minutes stale. */
  function rebuildToday(): void {
    try {
      rebuildDay(currentDate, runtime.getContext());
    } catch (error) {
      log.error('Rebuild failed', String(error));
    }
  }

  const rebuildTimer = setInterval(rebuildToday, Math.max(1, config.review.rebuildEveryMinutes) * MINUTE);

  const tickTimer = setInterval(() => {
    const today = localDate();

    if (today !== currentDate) {
      // Close out yesterday before anything else touches it.
      rebuildToday();
      const minutes = pendingMinutes(currentDate);
      const closing = loggedMinutes(currentDate);
      if (closing.logged < config.targets.dailyMinutes) {
        notify(
          'Yesterday came up short',
          `${currentDate}: ${hours(closing.logged)} logged of ${hours(config.targets.dailyMinutes)}. Top it up before pushing.`,
        );
      } else if (minutes > 0) {
        notify('Timesheet ready', `${(minutes / 60).toFixed(1)}h from ${currentDate} is waiting for review.`);
      }
      currentDate = today;
      notifiedHours.clear();
      const removed = pruneSnapshots(config.privacy.retainRawSnapshotDays);
      if (removed > 0) log.info(`Pruned ${removed} old snapshot files`);
      // Everything in the spool has been filed into day files by now.
      source.rotate();

      void runtime.refreshCatalogIfStale();
      return;
    }

    const hour = new Date().getHours();
    if (config.review.notifyHours.includes(hour) && !notifiedHours.has(hour)) {
      notifiedHours.add(hour);
      rebuildToday();
      const pending = pendingMinutes(currentDate);
      const { logged, billable } = loggedMinutes(currentDate);
      const { dailyMinutes, billableMinutes } = config.targets;

      // The afternoon nudges are about the day target first, review second —
      // a shortfall discovered at 5pm is still fixable; at 9am tomorrow it isn't.
      if (logged < dailyMinutes) {
        notify(
          'Timesheet is short',
          `${hours(logged)} logged of the ${hours(dailyMinutes)} day (${hours(billable)} billable). Meetings not logged yet? ${reviewUrl}`,
        );
      } else if (billable < billableMinutes) {
        notify(
          'Day logged, billable short',
          `${hours(logged)} logged but only ${hours(billable)} billable of the ${hours(billableMinutes)} target.`,
        );
      } else if (pending >= 15) {
        notify('Time to confirm', `${hours(pending)} unreviewed. Open ${reviewUrl}`);
      }
    }
  }, MINUTE);

  // A version that has started successfully is a version that works; clear
  // any failure counter from an earlier update attempt.
  confirmInstalled();

  const startedAt = Date.now();
  let lastError: string | null = null;

  function publishStatus(): void {
    if (!config.fleet.statusDir) return;
    try {
      reportStatus(config, buildStatus(config, {
        hasToken: runtime.hasToken(),
        catalogTasks: runtime.getContext().catalog.tasks.length,
        startedAt,
        lastError,
      }));
    } catch (error) {
      log.debug('Fleet report failed', String(error));
    }
  }

  function checkUpdates(): void {
    if (!config.update.channel) return;
    const check = checkForUpdate(config);
    if (!check.available) {
      log.debug(`Update check: ${check.reason}`);
      return;
    }
    if (!config.update.autoApply) {
      log.info(`Update ${check.published} is available (autoApply is off).`);
      notify('Tracker update available', `Version ${check.published} is on the server. Run install.sh when convenient.`);
      return;
    }
    log.info(`Applying update ${check.published}; this process will be restarted.`);
    if (applyUpdate(check)) {
      // The installer stops this agent shortly. Get a final status out first so
      // the fleet view shows the attempt rather than an unexplained silence.
      lastError = null;
      publishStatus();
    }
  }

  const fleetTimer = setInterval(publishStatus, Math.max(5, config.fleet.reportEveryMinutes) * MINUTE);
  const updateTimer = setInterval(checkUpdates, Math.max(1, config.update.checkEveryHours) * 60 * MINUTE);

  const server = createServer(runtime);
  server.listen(config.server.port, config.server.host, () => {
    log.info(`Review UI on ${reviewUrl}`);
    if (!runtime.hasToken()) log.warn('Running without a ClickUp token; push will be disabled.');
  });
  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      // Tracking still works; only the review UI is unavailable, so say what
      // to do rather than dying with a stack trace.
      log.error(
        `Port ${config.server.port} is already in use. Tracking continues, but the review UI is not available. ` +
        'Change server.port in config.json, or stop whatever is on that port.',
      );
      return;
    }
    log.error('Review server failed to start', error.message);
  });

  function shutdown(signal: string): void {
    log.info(`Received ${signal}; shutting down`);
    clearInterval(rebuildTimer);
    clearInterval(tickTimer);
    clearInterval(fleetTimer);
    clearInterval(updateTimer);
    source.stop();
    rebuildToday();
    lock.release();
    server.close(() => process.exit(0));
    // Don't hang forever on a keep-alive connection.
    setTimeout(() => process.exit(0), 3000).unref();
  }

  // A crash must not leave a lock behind that blocks the next start.
  process.on('uncaughtException', (error) => {
    log.error('Unhandled error; shutting down', error.stack ?? String(error));
    lock.release();
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    // Log and keep running: one failed ClickUp call should not stop tracking.
    log.error('Unhandled promise rejection', String(reason));
    lastError = String(reason).slice(0, 200);
  });

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  rebuildToday();
  publishStatus();
  // Check on the way up so a Mac that was off during a release catches up at
  // login rather than waiting for the first interval.
  setTimeout(checkUpdates, 30_000).unref();
  log.info('Tracker running.');
}

main().catch((error: unknown) => {
  log.error('Daemon failed to start', error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
