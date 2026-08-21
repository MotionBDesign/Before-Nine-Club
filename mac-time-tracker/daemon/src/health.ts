import { execFileSync } from 'node:child_process';

/**
 * How much memory the tracker is using — both halves of it.
 *
 * Two long-lived processes run for weeks between logins: this daemon, and the
 * observer, which on most Macs is an AppleScript applet ticking every five
 * seconds. Neither can be watched from Activity Monitor without knowing what
 * to look for, so the numbers are surfaced in the review page and in the fleet
 * report. A figure that climbs steadily across a week is the signal; a single
 * reading is only ever a baseline.
 */
export interface MemoryReading {
  daemonMB: number;
  observerMB: number | null;
  observerPid: number | null;
  observerName: string | null;
}

/** Anything above this is worth saying out loud. Steady state is well under. */
export const DAEMON_RSS_WARN_MB = 300;
export const OBSERVER_RSS_WARN_MB = 250;

const round = (bytes: number) => Math.round((bytes / 1_048_576) * 10) / 10;

/**
 * Find the observer among the running processes. It is one of two things: the
 * applet inside "MBD Time Tracker.app", or the compiled BNObserver binary.
 * Matching on the full command line is the only way to tell an applet apart
 * from every other applet on the machine.
 */
function observerProcess(): { pid: number; rssMB: number; name: string } | null {
  let out: string;
  try {
    // -A: every process. rss is in kilobytes on macOS.
    out = execFileSync('ps', ['-Ao', 'pid=,rss=,command='], {
      encoding: 'utf8',
      timeout: 4000,
      maxBuffer: 4 * 1024 * 1024,
    });
  } catch {
    return null;
  }

  for (const line of out.split('\n')) {
    const match = /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(line);
    if (!match) continue;
    const command = match[3]!;
    const isApplet = command.includes('MBD Time Tracker.app') && command.includes('/MacOS/');
    const isSwift = /\/BNObserver(\s|$)/.test(command);
    if (!isApplet && !isSwift) continue;
    return {
      pid: Number(match[1]),
      rssMB: round(Number(match[2]) * 1024),
      name: isApplet ? 'MBD Time Tracker.app' : 'BNObserver',
    };
  }
  return null;
}

export function readMemory(): MemoryReading {
  const observer = observerProcess();
  return {
    daemonMB: round(process.memoryUsage.rss()),
    observerMB: observer?.rssMB ?? null,
    observerPid: observer?.pid ?? null,
    observerName: observer?.name ?? null,
  };
}
