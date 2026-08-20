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
const { catalog, config, rules, snapshots } = await import('../test/fixtures.ts');

const day = new Date();
day.setHours(9, 0, 0, 0);
const T0 = day.getTime();
const minutes = (n: number) => n * 60_000;

// Sample counts are in 5-second ticks, so 720 ticks is an hour.
const timeline = [
  ...snapshots(T0, 720, {
    app: 'Photoshop', bundleId: 'com.adobe.Photoshop',
    title: 'SAPN_PowerlineSafety_Poster_A2_v3.psd @ 100%',
    documentPath: '/Volumes/Projects/Clients/SAPN/2026/Artwork/SAPN_PowerlineSafety_Poster_A2_v3.psd',
  }),
  ...snapshots(T0 + minutes(37), 6, {
    app: 'Slack', bundleId: 'com.tinyspeck.slackmacgap', title: 'sapn-artwork (Channel) - Motion by Design',
  }),
  ...snapshots(T0 + minutes(60), 120, {
    app: 'Google Chrome', bundleId: 'com.google.Chrome',
    title: 'Sleep clinic brochure refresh', url: 'https://app.clickup.com/t/9003163669/86bbb0002',
  }),
  ...snapshots(T0 + minutes(70), 1320, {
    app: 'InDesign', bundleId: 'com.adobe.InDesign',
    title: 'Sleep_clinic_brochure.indd',
    documentPath: '/Volumes/Projects/Clients/Resmed/2026/Print/Sleep_clinic_brochure.indd',
  }),
  // A long lunch: sampled, but idle, so it should never reach the timesheet.
  ...snapshots(T0 + minutes(180), 720, {
    app: 'Google Chrome', bundleId: 'com.google.Chrome', title: 'News', idleSeconds: 1800,
  }),
  ...snapshots(T0 + minutes(240), 1440, {
    app: 'After Effects', bundleId: 'com.adobe.AfterEffects',
    title: 'drilling_explainer_v2.aep',
    documentPath: '/Volumes/Projects/Clients/Maptek/2026/Video/drilling_explainer_v2.aep',
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
