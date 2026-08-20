import { Runtime, defaultObserverPath } from './runtime.ts';
import { startObserver, type ActivitySource } from './observer.ts';
import { startSpoolReader } from './spool.ts';
import { createServer } from './server.ts';
import { appendSnapshot, loadDay, localDate, pruneSnapshots, rebuildDay } from './store.ts';
import { paths } from './paths.ts';
import { notify } from './notify.ts';
import { log } from './log.ts';

const MINUTE = 60_000;

function pendingMinutes(date: string): number {
  return Math.round(
    loadDay(date).entries
      .filter((e) => e.status === 'pending')
      .reduce((sum, e) => sum + e.durationMs, 0) / MINUTE,
  );
}

async function main(): Promise<void> {
  const runtime = new Runtime();
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
      if (minutes > 0) {
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
      const minutes = pendingMinutes(currentDate);
      if (minutes >= 15) {
        notify('Time to confirm', `${(minutes / 60).toFixed(1)}h unreviewed. Open ${reviewUrl}`);
      }
    }
  }, MINUTE);

  const server = createServer(runtime);
  server.listen(config.server.port, config.server.host, () => {
    log.info(`Review UI on ${reviewUrl}`);
    if (!runtime.hasToken()) log.warn('Running without a ClickUp token; push will be disabled.');
  });
  server.on('error', (error) => {
    log.error('Review server failed to start', error.message);
  });

  function shutdown(signal: string): void {
    log.info(`Received ${signal}; shutting down`);
    clearInterval(rebuildTimer);
    clearInterval(tickTimer);
    source.stop();
    rebuildToday();
    server.close(() => process.exit(0));
    // Don't hang forever on a keep-alive connection.
    setTimeout(() => process.exit(0), 3000).unref();
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  rebuildToday();
  log.info('Tracker running.');
}

main().catch((error: unknown) => {
  log.error('Daemon failed to start', error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
