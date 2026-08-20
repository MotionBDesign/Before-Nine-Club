import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Config, Rule } from './types.ts';
import type { MatchContext } from './matcher.ts';
import { buildContext } from './matcher.ts';
import { ClickUpClient } from './clickup.ts';
import { loadConfig, loadRules, loadToken } from './config.ts';
import { loadCatalog, loadCorrections, saveCatalog } from './store.ts';
import { isStale } from './catalog.ts';
import { refreshCatalog } from './sync.ts';
import { ensureDirs } from './paths.ts';
import { log } from './log.ts';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Where `swift build -c release` leaves the observer binary. */
export function defaultObserverPath(configured = ''): string {
  return (
    configured ||
    process.env.MBD_TT_OBSERVER ||
    path.resolve(here, '..', '..', 'observer', '.build', 'release', 'BNObserver')
  );
}

/**
 * Shared state for the daemon and the CLI: config, rules, the cached ClickUp
 * catalog, and the match context derived from all three.
 */
export class Runtime {
  config: Config;
  rules: Rule[];
  #context: MatchContext;
  #client: ClickUpClient | null;

  constructor() {
    ensureDirs();
    this.config = loadConfig();
    this.rules = loadRules();
    const token = loadToken(this.config);
    this.#client = token ? new ClickUpClient(token) : null;
    if (!token) log.warn('No ClickUp token found — matching works offline, but nothing can be pushed.');
    this.#context = this.#build();
  }

  #build(): MatchContext {
    const catalog = loadCatalog(this.config.clickup.workspaceId);
    if (!this.config.clickup.workspaceId && catalog.workspaceId) {
      this.config.clickup.workspaceId = catalog.workspaceId;
    }
    return buildContext(this.config, this.rules, catalog, loadCorrections());
  }

  getContext(): MatchContext {
    return this.#context;
  }

  /** Re-derive the context, e.g. after a correction was recorded. */
  reloadContext(): void {
    this.#context = this.#build();
  }

  getClient(): ClickUpClient | null {
    return this.#client;
  }

  hasToken(): boolean {
    return this.#client !== null;
  }

  async refreshCatalog(): Promise<void> {
    const client = this.#client;
    if (!client) throw new Error('No ClickUp token configured.');
    const catalog = await refreshCatalog(client, this.config);
    saveCatalog(catalog);
    this.config.clickup.workspaceId = catalog.workspaceId;
    this.reloadContext();
  }

  /** Refresh only when the cache has aged out; never blocks startup on failure. */
  async refreshCatalogIfStale(): Promise<void> {
    if (!this.#client) return;
    if (!isStale(this.#context.catalog, this.config.clickup.catalogTtlMinutes)) return;
    try {
      await this.refreshCatalog();
    } catch (error) {
      log.error('Catalog refresh failed; continuing with the cached copy', String(error));
    }
  }
}
