import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import type { Config, Rule } from './types.ts';
import { paths, readJson } from './paths.ts';
import { log } from './log.ts';

export const defaultConfig: Config = {
  clickup: {
    workspaceId: '',
    tokenEnv: 'CLICKUP_API_TOKEN',
    keychainService: 'mbd-time-tracker',
    keychainAccount: 'clickup-api-token',
    defaultBillable: true,
    spaces: [],
    onlyMyTasks: false,
    catalogTtlMinutes: 60,
  },
  capture: {
    sampleIntervalSeconds: 5,
    idleThresholdSeconds: 180,
    minBlockSeconds: 60,
    mergeGapSeconds: 300,
    roundToMinutes: 5,
    minEntryMinutes: 5,
  },
  observer: { mode: 'spool', spoolPath: '', binaryPath: '', pollSeconds: 5, browserUrls: 'accessibility' },
  server: { port: 7878, host: '127.0.0.1' },
  review: { notifyHours: [13, 17], rebuildEveryMinutes: 10 },
  // 6.5 hours: the studio's daily minimum, billable-first.
  targets: { dailyMinutes: 390, billableMinutes: 390 },
  quickLog: [],
  projectRoots: [],
  clientAliases: {},
  appPhases: {
    'com.adobe.AfterEffects': ['animation', 'animations', 'animated', 'animate', 'motion', 'vfx', 'post', 'postproduction'],
    'com.adobe.PremierePro': ['postproduction', 'post', 'edit', 'edits', 'cuts', 'film', 'reel', 'production'],
    'com.apple.FinalCut': ['postproduction', 'post', 'edit', 'edits', 'cuts', 'film', 'reel'],
    'com.blackmagic-design.DaVinciResolve': ['postproduction', 'post', 'edit', 'grade', 'colour', 'color'],
    'com.adobe.Photoshop': ['design', 'styleframes', 'concepts', 'concept', 'artwork', 'images', 'image', 'kv', 'retouch', 'banner', 'banners'],
    'com.adobe.Illustrator': ['design', 'storyboard', 'storyboards', 'icons', 'illustration', 'artwork', 'concepts', 'layout', 'poster', 'posters'],
    'com.adobe.InDesign': ['design', 'layout', 'brochure', 'booklet', 'yearbook', 'report', 'prospectus', 'flyer', 'flyers', 'template'],
    'com.adobe.Audition': ['vo', 'voiceover', 'audio', 'sound', 'podcast'],
    'com.adobe.LightroomClassic': ['photos', 'photo', 'headshots', 'photoshoot', 'shoot', 'retouch'],
    'com.microsoft.Word': ['copy', 'content', 'script', 'scripts', 'rewrite', 'proposal'],
    'com.apple.iWork.Pages': ['copy', 'content', 'script', 'scripts', 'rewrite'],
    'com.google.Chrome.app.Documents': ['copy', 'content', 'script', 'scripts'],
    'com.microsoft.Powerpoint': ['ppt', 'deck', 'slidedeck', 'slides', 'presentation', 'toolkit'],
    'com.apple.iWork.Keynote': ['ppt', 'deck', 'slidedeck', 'slides', 'presentation'],
    'com.figma.Desktop': ['design', 'concepts', 'ui', 'website', 'landing', 'wireframe'],
  },
  ignore: {
    bundleIds: [
      'com.apple.loginwindow',
      'com.apple.ScreenSaver.Engine',
      'com.agilebits.onepassword7',
      'com.1password.1password',
    ],
    titlePatterns: [],
    pathPatterns: [],
  },
  privacy: {
    recordTitles: true,
    recordUrls: true,
    redactUrlQuery: true,
    retainRawSnapshotDays: 30,
  },
  autoConfirm: { enabled: false },
};

/** Shallow-merge per section so a partial user config still picks up new defaults. */
export function loadConfig(): Config {
  const user = readJson<Partial<Config>>(paths.config());
  if (!user) {
    log.warn(`No config at ${paths.config()}; using defaults. Run \`npm run doctor\` for setup help.`);
    return structuredClone(defaultConfig);
  }
  const base = structuredClone(defaultConfig);
  return {
    clickup: { ...base.clickup, ...user.clickup },
    capture: { ...base.capture, ...user.capture },
    observer: { ...base.observer, ...user.observer },
    server: { ...base.server, ...user.server },
    review: { ...base.review, ...user.review },
    targets: { ...base.targets, ...user.targets },
    quickLog: user.quickLog ?? base.quickLog,
    projectRoots: user.projectRoots ?? base.projectRoots,
    clientAliases: { ...base.clientAliases, ...user.clientAliases },
    appPhases: { ...base.appPhases, ...user.appPhases },
    ignore: { ...base.ignore, ...user.ignore },
    privacy: { ...base.privacy, ...user.privacy },
    autoConfirm: { enabled: false },
  };
}

export function loadRules(): Rule[] {
  const rules = readJson<Rule[]>(paths.rules());
  if (!rules) return [];
  if (!Array.isArray(rules)) {
    log.error('rules.json must contain an array; ignoring it.');
    return [];
  }
  return rules.filter((r) => {
    const ok = typeof r?.name === 'string' && typeof r?.when === 'object';
    if (!ok) log.warn('Skipping malformed rule', r);
    return ok;
  });
}

/**
 * Token lookup order: env var, then the login keychain, then config.json.
 * The keychain is the recommended home for it — nothing lands in a dotfile.
 */
export function loadToken(config: Config): string | null {
  const fromEnv = process.env[config.clickup.tokenEnv];
  if (fromEnv) return fromEnv.trim();

  try {
    const out = execFileSync(
      '/usr/bin/security',
      ['find-generic-password', '-s', config.clickup.keychainService, '-a', config.clickup.keychainAccount, '-w'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    const trimmed = out.trim();
    if (trimmed) return trimmed;
  } catch {
    /* not on macOS, or no such keychain item */
  }

  const raw = readJson<{ clickup?: { token?: string } }>(paths.config());
  const fromFile = raw?.clickup?.token?.trim();
  if (fromFile) {
    try {
      const mode = fs.statSync(paths.config()).mode & 0o777;
      if (mode & 0o077) log.warn(`${paths.config()} holds a token but is group/world readable. chmod 600 it.`);
    } catch {
      /* ignore */
    }
    return fromFile;
  }
  return null;
}
