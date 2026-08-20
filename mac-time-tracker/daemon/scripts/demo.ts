/**
 * Seed a throwaway data directory with a plausible day of activity and open
 * the review UI against it. Nothing here touches your real data or ClickUp —
 * it exists so you can see the matching and the review flow before the Swift
 * observer is built or a token is configured.
 *
 *   node scripts/demo.ts
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Runtime } from '../src/server.ts';

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'mbdtt-demo-'));
process.env.MBD_TT_HOME = home;

const { buildContext } = await import('../src/matcher.ts');
const { defaultConfig } = await import('../src/config.ts');
const { createServer } = await import('../src/server.ts');
const store = await import('../src/store.ts');
const { snapshots } = await import('../test/fixtures.ts');
const { realCatalog } = await import('../test/real-tasks.ts');
const { evalConfig, evalRules } = await import('../test/real-cases.ts');
// The demo runs against the live workspace's actual task names and rules.
const catalog = realCatalog;
const config = () => structuredClone(evalConfig);
const rules = evalRules;

const day = new Date();
day.setHours(9, 0, 0, 0);
const T0 = day.getTime();
const minutes = (n: number) => n * 60_000;

// Sample counts are in 5-second ticks, so 720 ticks is an hour.
const ROOT = '/Volumes/Projects/Clients';
const timeline = [
  // 9:00-10:30  Photoshop on the SAPN curtailment styleframes (a DESIGN child
  // in a four-way phase family — the app is what settles which sibling).
  ...snapshots(T0, 1080, {
    app: 'Photoshop', bundleId: 'com.adobe.Photoshop',
    title: 'Curtailment_styleframes_01.psd @ 100%',
    documentPath: `${ROOT}/SAPN/2026/Smarter Homes Solar Curtailment/Curtailment_styleframes_01.psd`,
  }),
  // A 30-second Slack glance mid-morning — absorbed, never its own line.
  ...snapshots(T0 + minutes(45), 6, {
    app: 'Slack', bundleId: 'com.tinyspeck.slackmacgap', title: 'sapn-team (Channel) - Motion by Design',
  }),
  // 10:30-10:40  the ClickUp task itself open in Chrome...
  ...snapshots(T0 + minutes(90), 120, {
    app: 'Google Chrome', bundleId: 'com.google.Chrome',
    title: 'Resmed - CPAP Trial EDM - ClickUp',
    url: 'https://app.clickup.com/t/86d42ff8d',
  }),
  // ...then 10:40-12:10 in Photoshop on that EDM; both merge into one entry.
  ...snapshots(T0 + minutes(100), 1080, {
    app: 'Photoshop', bundleId: 'com.adobe.Photoshop',
    title: 'CPAP_trial_EDM_header.psd',
    documentPath: `${ROOT}/Resmed/2026/CPAP Trial EDM/CPAP_trial_EDM_header.psd`,
  }),
  // 12:10-13:00  idle lunch — sampled, never billed.
  ...snapshots(T0 + minutes(190), 600, {
    app: 'Google Chrome', bundleId: 'com.google.Chrome', title: 'News', idleSeconds: 1800,
  }),
  // 13:00-14:30  Premiere on the Symons onboarding edit (POSTPRODUCTION child).
  ...snapshots(T0 + minutes(240), 1080, {
    app: 'Adobe Premiere Pro', bundleId: 'com.adobe.PremierePro',
    title: 'Onboarding_Visitors_edit.prproj',
    documentPath: `${ROOT}/Symons Clark/2026/Onboarding Visitors video/Onboarding_Visitors_edit.prproj`,
  }),
  // 14:30-15:15  Word on the Aurizn GPTW copy (Word implies COPY work).
  ...snapshots(T0 + minutes(330), 540, {
    app: 'Microsoft Word', bundleId: 'com.microsoft.Word',
    title: 'GPTW_wallpapers_banners_posters_copy.docx',
    documentPath: `${ROOT}/Aurizn/2026/GPTW/GPTW_wallpapers_banners_posters_copy.docx`,
  }),
  // 15:15-15:45  a deliberately ambiguous Resmed promo file — shows the
  // low-confidence state where the UI asks rather than guesses hard.
  ...snapshots(T0 + minutes(375), 360, {
    app: 'Photoshop', bundleId: 'com.adobe.Photoshop',
    title: 'promo.psd',
    documentPath: `${ROOT}/Resmed/2026/Promos/promo.psd`,
  }),
  // 15:45-16:00  Terminal — nothing to go on; the honest "no task" state.
  ...snapshots(T0 + minutes(405), 180, {
    app: 'Terminal', bundleId: 'com.apple.Terminal', title: 'dom@studio: ~',
  }),
];

for (const snapshot of timeline) store.appendSnapshot(snapshot);

const demoConfig = { ...config(), server: { ...defaultConfig.server, port: 7879 } };
let context = buildContext(demoConfig, rules, catalog(), store.loadCorrections());
const date = store.localDate(T0);
store.rebuildDay(date, context);

const runtime: Runtime = {
  config: demoConfig,
  getContext: () => context,
  reloadContext: () => { context = buildContext(demoConfig, rules, catalog(), store.loadCorrections()); },
  getClient: () => null,
  refreshCatalog: async () => { throw new Error('The demo runs offline; there is nothing to refresh.'); },
};

const server = createServer(runtime);
server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`\n  Port ${demoConfig.server.port} is already in use — another demo is probably running.\n`);
  } else {
    console.error(error);
  }
  fs.rmSync(home, { recursive: true, force: true });
  process.exit(1);
});
server.listen(demoConfig.server.port, '127.0.0.1', () => {
  console.log(`\n  Demo data in ${home}`);
  console.log(`  Review UI:   http://127.0.0.1:${demoConfig.server.port}/`);
  console.log('  Push is disabled (no token). Ctrl-C to stop; the temp directory is removed.\n');
});

const cleanup = () => {
  fs.rmSync(home, { recursive: true, force: true });
  process.exit(0);
};
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
