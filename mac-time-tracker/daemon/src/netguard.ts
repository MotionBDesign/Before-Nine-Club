/**
 * Process-wide network allowlist.
 *
 * Deployment requirement: this tool must touch nothing outside the Mac it
 * runs on except the ClickUp API. Rather than trusting every future edit to
 * remember that, the guard replaces global fetch with one that refuses any
 * other destination. It is installed before anything else runs, so a bug, a
 * malicious rules file, or a compromised config cannot exfiltrate through
 * fetch even in principle.
 *
 * Node's lower-level net/http modules are not wrapped — nothing in the daemon
 * uses them for outbound connections, and the tripwire test in
 * test/netguard.test.ts fails the build if an import ever appears.
 */
const ALLOWED_HOSTS = new Set(['api.clickup.com']);

let installed = false;

export class BlockedNetworkAccess extends Error {
  constructor(url: string) {
    super(
      `Blocked outbound request to ${url}. ` +
      `This tracker only speaks to ${[...ALLOWED_HOSTS].join(', ')}; anything else is refused by design.`,
    );
    this.name = 'BlockedNetworkAccess';
  }
}

type FetchInput = string | URL | { url: string };

function hostOf(input: FetchInput): string {
  if (input instanceof URL) return input.hostname;
  if (typeof input === 'string') return new URL(input).hostname;
  return new URL(input.url).hostname;
}

export function installNetworkGuard(): void {
  if (installed) return;
  installed = true;

  const realFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = ((input: FetchInput, init?: RequestInit) => {
    let host: string;
    try {
      host = hostOf(input);
    } catch {
      return Promise.reject(new BlockedNetworkAccess(String(input)));
    }
    if (!ALLOWED_HOSTS.has(host)) {
      return Promise.reject(new BlockedNetworkAccess(String(input)));
    }
    return realFetch(input as Parameters<typeof realFetch>[0], init);
  }) as typeof fetch;
}

/** Exposed so the doctor can print what the process is allowed to reach. */
export function allowedHosts(): string[] {
  return [...ALLOWED_HOSTS];
}
