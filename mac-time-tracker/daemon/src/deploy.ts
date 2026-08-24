import fs from 'node:fs';
import path from 'node:path';
import { expandHome, paths, readJson, writeJsonAtomic } from './paths.ts';

/**
 * The two settings that turn a lone install into a managed one: where updates
 * come from, and where this Mac reports its health.
 *
 * They are deliberately separate from the rest of the config. Everything else
 * is a preference someone might reasonably change; these two are decided once
 * for the studio and are the difference between "we can see whether it works"
 * and finding out weeks later that someone's tracker died in July. They are
 * applied by the installer rather than typed by hand, because a path typed
 * into a JSON file on six Macs is a path that is wrong on at least one.
 */
export interface DeploySettings {
  /** Folder on the share holding LATEST and the staged bundles. */
  channel?: string;
  /** Folder each Mac writes its health file into. */
  statusDir?: string;
  /** Set once for the studio so nobody has to find it in ClickUp. */
  workspaceId?: string;
  /**
   * The grid time is logged on. Set here because it is a studio-wide policy,
   * not a preference — and because installs made before it was settled are
   * still carrying whatever the example config said at the time.
   */
  roundMinutes?: number;
}

export interface DeployResult {
  applied: DeploySettings;
  unchanged: boolean;
  configPath: string;
  /** Paths that are set but not reachable right now — usually an unmounted share. */
  unreachable: string[];
}

/**
 * Merge deploy settings into config.json, touching nothing else.
 *
 * Reads and rewrites the file as a plain object rather than going through the
 * typed loader: the loader fills in every default, so writing its output back
 * would freeze today's defaults into the file and quietly opt this Mac out of
 * future changes to them.
 */
export function applyDeploySettings(settings: DeploySettings, configPath = paths.config()): DeployResult {
  const config = (readJson<Record<string, unknown>>(configPath) ?? {}) as Record<string, any>;
  const applied: DeploySettings = {};
  let changed = false;

  type StringKey = 'channel' | 'statusDir' | 'workspaceId';
  const set = (section: string, key: string, value: string | undefined, label: StringKey) => {
    if (value === undefined) return;
    config[section] = { ...(config[section] as object | undefined) };
    if (config[section][key] !== value) {
      config[section][key] = value;
      changed = true;
    }
    applied[label] = value;
  };

  set('update', 'channel', settings.channel, 'channel');
  set('fleet', 'statusDir', settings.statusDir, 'statusDir');
  set('clickup', 'workspaceId', settings.workspaceId, 'workspaceId');

  if (settings.roundMinutes !== undefined) {
    // Both together, always: rounding to 15 while still allowing 5-minute
    // entries would leave the short ones untouched and the day uneven.
    config.capture = { ...(config.capture as object | undefined) } as Record<string, unknown>;
    for (const key of ['roundToMinutes', 'minEntryMinutes']) {
      if (config.capture[key] !== settings.roundMinutes) {
        config.capture[key] = settings.roundMinutes;
        changed = true;
      }
    }
    applied.roundMinutes = settings.roundMinutes;
  }

  if (changed) writeJsonAtomic(configPath, config);

  const unreachable: string[] = [];
  for (const candidate of [applied.channel, applied.statusDir]) {
    if (candidate && !fs.existsSync(expandHome(candidate))) unreachable.push(candidate);
  }

  return { applied, unchanged: !changed, configPath, unreachable };
}

/**
 * Deploy settings shipped inside a package, so an install that was emailed as
 * a zip is wired up the same as one run off the share.
 *
 * Without this, a zip install has no channel and no status directory: it works
 * perfectly and reports to nobody, which is the failure mode that matters —
 * it looks fine right up until it isn't.
 */
export function readPackagedDeploy(packageRoot: string): DeploySettings | null {
  return readJson<DeploySettings>(path.join(packageRoot, 'deploy.json'));
}

/**
 * Work out the channel from where the installer is being run.
 *
 * A staged bundle lives at <channel>/MBDTimeTracker-<version>/, and the
 * channel is the folder holding LATEST. Deriving it beats asking: the path is
 * already right by construction, and nobody has to remember how the share is
 * spelled on their Mac.
 */
export function deriveChannel(sourceDir: string): string | null {
  const parent = path.dirname(path.resolve(sourceDir));
  return fs.existsSync(path.join(parent, 'LATEST')) ? parent : null;
}
