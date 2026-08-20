import fs from 'node:fs';
import { paths } from './paths.ts';

type Level = 'debug' | 'info' | 'warn' | 'error';

const order: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = order[(process.env.MBD_TT_LOG_LEVEL as Level) ?? 'info'] ?? order.info;

function emit(level: Level, message: string, extra?: unknown): void {
  if (order[level] < threshold) return;
  const line = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} ${message}${
    extra === undefined ? '' : ` ${safe(extra)}`
  }`;
  if (level === 'error' || level === 'warn') process.stderr.write(`${line}\n`);
  else process.stdout.write(`${line}\n`);
  if (process.env.MBD_TT_LOG_FILE !== '0') {
    try {
      fs.appendFileSync(paths.log(), `${line}\n`, { mode: 0o600 });
    } catch {
      /* logging must never take the daemon down */
    }
  }
}

function safe(value: unknown): string {
  try {
    return typeof value === 'string' ? value : JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export const log = {
  debug: (m: string, e?: unknown) => emit('debug', m, e),
  info: (m: string, e?: unknown) => emit('info', m, e),
  warn: (m: string, e?: unknown) => emit('warn', m, e),
  error: (m: string, e?: unknown) => emit('error', m, e),
};
