import http from 'node:http';
import type { Config, DayFile, ProposedEntry } from './types.ts';
import type { MatchContext } from './matcher.ts';
import type { ClickUpClient } from './clickup.ts';
import { addManualEntry, loadDay, localDate, listDays, rebuildDay, recordCorrection, saveDay } from './store.ts';
import { pushApproved } from './sync.ts';
import { renderPage } from './ui.ts';
import { log } from './log.ts';

export interface Runtime {
  config: Config;
  getContext(): MatchContext;
  reloadContext(): void;
  getClient(): ClickUpClient | null;
  refreshCatalog(): Promise<void>;
}

function json(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

function isLoopbackHost(value: string): boolean {
  // Strip the port, keeping bracketed IPv6 literals intact.
  const host = value.startsWith('[')
    ? value.slice(0, value.indexOf(']') + 1)
    : (value.split(':')[0] ?? '');
  return LOOPBACK_HOSTS.has(host.toLowerCase());
}

/**
 * The socket only listens on loopback, but a page on any origin could still
 * point a request at it. Requiring a loopback Host closes DNS rebinding, and
 * rejecting a foreign Origin closes drive-by CSRF.
 */
function isLocalRequest(req: http.IncomingMessage): boolean {
  if (!isLoopbackHost(req.headers.host ?? '')) return false;

  const origin = req.headers.origin;
  if (origin !== undefined && origin !== 'null') {
    try {
      const parsed = new URL(origin);
      if (parsed.protocol !== 'http:' || !isLoopbackHost(parsed.host)) return false;
    } catch {
      return false;
    }
  }
  return true;
}

async function readBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > 1_000_000) throw new Error('Request body too large');
    chunks.push(chunk as Buffer);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
}

function findEntry(day: DayFile, id: string): ProposedEntry | undefined {
  return day.entries.find((e) => e.id === id);
}

function summarise(day: DayFile) {
  const total = (predicate: (e: ProposedEntry) => boolean) =>
    day.entries.filter(predicate).reduce((sum, e) => sum + e.durationMs, 0);
  return {
    trackedMs: total(() => true),
    pendingMs: total((e) => e.status === 'pending'),
    approvedMs: total((e) => e.status === 'approved'),
    syncedMs: total((e) => e.status === 'synced'),
    billableMs: total((e) => e.billable && e.status !== 'rejected'),
    /** Everything that will end up on the timesheet — what counts toward the day. */
    loggedMs: total((e) => e.status !== 'rejected'),
  };
}

export function createServer(runtime: Runtime): http.Server {
  return http.createServer((req, res) => {
    void handle(req, res).catch((error: unknown) => {
      log.error('Review server error', error instanceof Error ? error.message : String(error));
      if (!res.headersSent) json(res, 500, { error: String(error) });
    });
  });

  async function handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    if (!isLocalRequest(req)) {
      json(res, 403, { error: 'This server only accepts local requests.' });
      return;
    }
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const method = req.method ?? 'GET';

    if (method === 'GET' && url.pathname === '/') {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'",
      });
      res.end(renderPage());
      return;
    }

    if (method === 'GET' && url.pathname === '/api/day') {
      // An absent *or* empty `date` means "today".
      const date = url.searchParams.get('date')?.trim() || localDate();
      const day = loadDay(date);
      const catalog = runtime.getContext().catalog;
      const tasksById = new Map(catalog.tasks.map((t) => [t.taskId, t]));
      json(res, 200, {
        day,
        summary: summarise(day),
        days: listDays(),
        catalogFetchedAt: catalog.fetchedAt,
        taskCount: catalog.tasks.length,
        targets: runtime.config.targets,
        quickLog: runtime.config.quickLog.map((button, index) => ({
          index,
          label: button.label,
          minutes: button.minutes,
          billable: button.billable,
          taskName: tasksById.get(button.taskId)?.taskName ?? null,
        })),
      });
      return;
    }

    if (method === 'POST' && url.pathname === '/api/quick-log') {
      const body = await readBody(req);
      const index = Number(body.index);
      const button = runtime.config.quickLog[index];
      if (!button) {
        json(res, 400, { error: 'No such quick-log button.' });
        return;
      }
      const date = String(body.date ?? '').trim() || localDate();
      const minutes = Number.isFinite(Number(body.minutes)) && Number(body.minutes) > 0
        ? Number(body.minutes)
        : button.minutes;
      const task = runtime.getContext().tasksById.get(button.taskId) ?? null;
      const entry = addManualEntry(date, {
        taskId: button.taskId,
        taskName: task?.taskName ?? button.label,
        listName: task?.listName ?? null,
        folderName: task?.folderName ?? null,
        spaceName: task?.spaceName ?? null,
        label: button.label,
        minutes,
        billable: button.billable,
      });
      const day = loadDay(date);
      json(res, 200, { entry, day, summary: summarise(day) });
      return;
    }

    if (method === 'GET' && url.pathname === '/api/tasks') {
      const query = (url.searchParams.get('q') ?? '').toLowerCase().trim();
      const tasks = runtime.getContext().catalog.tasks;
      const matches = (query
        ? tasks.filter((t) =>
            t.taskName.toLowerCase().includes(query) ||
            t.listName.toLowerCase().includes(query) ||
            (t.folderName ?? '').toLowerCase().includes(query))
        : tasks
      ).slice(0, 50);
      json(res, 200, { tasks: matches });
      return;
    }

    if (method === 'POST' && url.pathname.startsWith('/api/entry/')) {
      const id = decodeURIComponent(url.pathname.slice('/api/entry/'.length));
      const patch = await readBody(req);
      const date = String(patch.date ?? '').trim() || localDate();
      const day = loadDay(date);
      const entry = findEntry(day, id);
      if (!entry) {
        json(res, 404, { error: 'No such entry' });
        return;
      }
      if (entry.status === 'synced') {
        json(res, 409, { error: 'Already pushed to ClickUp; edit it there instead.' });
        return;
      }

      if (typeof patch.taskId === 'string' || patch.taskId === null) {
        const nextTaskId = patch.taskId as string | null;
        if (nextTaskId && nextTaskId !== entry.suggestion.taskId) {
          entry.corrected = true;
          recordCorrection(entry, nextTaskId);
          runtime.reloadContext();
        }
        entry.taskId = nextTaskId;
      }
      if (typeof patch.description === 'string') entry.description = patch.description.slice(0, 250);
      if (typeof patch.billable === 'boolean') entry.billable = patch.billable;
      if (typeof patch.durationMinutes === 'number' && Number.isFinite(patch.durationMinutes)) {
        entry.durationMs = Math.max(0, Math.round(patch.durationMinutes)) * 60_000;
      }
      if (patch.status === 'approved' || patch.status === 'rejected' || patch.status === 'pending') {
        if (patch.status === 'approved' && !entry.taskId) {
          json(res, 400, { error: 'Pick a task before approving.' });
          return;
        }
        entry.status = patch.status;
      }
      saveDay(day);
      json(res, 200, { entry, summary: summarise(day) });
      return;
    }

    if (method === 'POST' && url.pathname === '/api/day/rebuild') {
      const date = ((await readBody(req)) as { date?: string }).date?.trim() || localDate();
      const day = rebuildDay(date, runtime.getContext());
      json(res, 200, { day, summary: summarise(day) });
      return;
    }

    if (method === 'POST' && url.pathname === '/api/day/approve-all') {
      const date = ((await readBody(req)) as { date?: string }).date?.trim() || localDate();
      const day = loadDay(date);
      let approved = 0;
      for (const entry of day.entries) {
        if (entry.status === 'pending' && entry.taskId) {
          entry.status = 'approved';
          approved++;
        }
      }
      saveDay(day);
      json(res, 200, { day, approved, summary: summarise(day) });
      return;
    }

    if (method === 'POST' && url.pathname === '/api/day/push') {
      const date = ((await readBody(req)) as { date?: string }).date?.trim() || localDate();
      const client = runtime.getClient();
      if (!client) {
        json(res, 400, { error: 'No ClickUp token configured. Run `npm run doctor`.' });
        return;
      }
      const day = loadDay(date);
      const result = await pushApproved(client, runtime.config, day);
      json(res, 200, { result, day: loadDay(date), summary: summarise(loadDay(date)) });
      return;
    }

    if (method === 'POST' && url.pathname === '/api/catalog/refresh') {
      await runtime.refreshCatalog();
      const catalog = runtime.getContext().catalog;
      json(res, 200, { taskCount: catalog.tasks.length, fetchedAt: catalog.fetchedAt });
      return;
    }

    json(res, 404, { error: 'Not found' });
  }
}
