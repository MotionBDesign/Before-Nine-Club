/**
 * Realistic days of work against the live workspace, each paired with the task
 * it must land on. Shared by `npm run evaluate` and the regression test so
 * there is exactly one corpus.
 */
import type { ActivityBlock, Config, Rule } from '../src/types.ts';
import { defaultConfig } from '../src/config.ts';

const ROOT = '/Volumes/Projects/Clients';

const rules: Rule[] = [
  {
    name: 'ClickUp task open in the browser',
    when: { urlRegex: 'app\\.clickup\\.com/t/(?:\\d+/)?(?<taskId>[A-Za-z0-9-]{5,})' },
    then: { taskIdFrom: 'taskId' },
    weight: 100,
  },
  {
    name: 'Client folder on the server',
    when: { pathRegex: '/Clients/(?<client>[^/]+)/' },
    then: { folderFrom: 'client' },
    weight: 65,
  },
];

interface Case {
  label: string;
  expect: string;
  app: string;
  bundleId: string;
  path?: string;
  title?: string;
  url?: string;
}

const CASES: Case[] = [
  // --- Unambiguous: the file names the job -------------------------------
  { label: 'Illustrator on a SAPN illustration', expect: '86d3yjw8z',
    app: 'Illustrator', bundleId: 'com.adobe.Illustrator',
    path: `${ROOT}/SAPN/2026/Electricity at home illustration/electricity_at_home_v4.ai` },
  { label: 'InDesign on the Symons mining brochure', expect: '86d3pjg2b',
    app: 'InDesign', bundleId: 'com.adobe.InDesign',
    path: `${ROOT}/Symons Clark/2026/Mining Brochure/SC_MiningBrochure_v2.indd` },
  { label: 'Photoshop on the Resmed landing page banner', expect: '86d3ke9z4',
    app: 'Photoshop', bundleId: 'com.adobe.Photoshop',
    path: `${ROOT}/Resmed/2026/Agnostic landing page/agnostic_landing_banner_1440.psd` },
  { label: 'InDesign on the Ilim annual report', expect: '86d34c576',
    app: 'InDesign', bundleId: 'com.adobe.InDesign',
    path: `${ROOT}/Ilim College/2026/Annual Report/ilim_annual_report_2026.indd` },
  { label: 'PowerPoint on the Aurizn town hall deck', expect: '86d42bdb7',
    app: 'Microsoft PowerPoint', bundleId: 'com.microsoft.Powerpoint',
    path: `${ROOT}/Aurizn/2026/GPTW/Aurizn_GPTW_TownHall.pptx` },
  { label: 'Premiere on the AOL UBA edit', expect: '86d3mwjd9',
    app: 'Adobe Premiere Pro', bundleId: 'com.adobe.PremierePro',
    path: `${ROOT}/AOL/2026/UBA/UBA_2026_postproduction.prproj` },
  { label: 'After Effects on the Maptek Vulcan explainer', expect: '86d3nybhu',
    app: 'After Effects', bundleId: 'com.adobe.AfterEffects',
    path: `${ROOT}/Maptek/2026/Vulcan Explainer/vulcan_explainer_v3.aep` },

  // --- Phase families: same project, different stage ---------------------
  { label: 'Word on the Symons onboarding script', expect: '86d06enrw',
    app: 'Microsoft Word', bundleId: 'com.microsoft.Word',
    path: `${ROOT}/Symons Clark/2026/Onboarding Visitors video/Onboarding_Visitors_script_v3.docx` },
  { label: 'Illustrator on the Symons onboarding storyboard', expect: '86d06envy',
    app: 'Illustrator', bundleId: 'com.adobe.Illustrator',
    path: `${ROOT}/Symons Clark/2026/Onboarding Visitors video/Onboarding_Visitors_storyboard.ai` },
  { label: 'Premiere on the Symons onboarding edit', expect: '86d06ep1p',
    app: 'Adobe Premiere Pro', bundleId: 'com.adobe.PremierePro',
    path: `${ROOT}/Symons Clark/2026/Onboarding Visitors video/Onboarding_Visitors_edit.prproj` },
  { label: 'After Effects on the Symons fitness animation', expect: '86d0pfv7r',
    app: 'After Effects', bundleId: 'com.adobe.AfterEffects',
    path: `${ROOT}/Symons Clark/2026/Fitness for work video/fitness_for_work_animation.aep` },
  { label: 'Word on the SAPN curtailment script', expect: '86d3bn9v1',
    app: 'Microsoft Word', bundleId: 'com.microsoft.Word',
    path: `${ROOT}/SAPN/2026/Smarter Homes Solar Curtailment/Curtailment_Test_script.docx` },
  { label: 'Photoshop on the SAPN curtailment styleframes', expect: '86d3bn9ya',
    app: 'Photoshop', bundleId: 'com.adobe.Photoshop',
    path: `${ROOT}/SAPN/2026/Smarter Homes Solar Curtailment/Curtailment_styleframes_01.psd` },
  { label: 'After Effects on the SAPN curtailment animation', expect: '86d3bn9zy',
    app: 'After Effects', bundleId: 'com.adobe.AfterEffects',
    path: `${ROOT}/SAPN/2026/Smarter Homes Solar Curtailment/Curtailment_animation_v2.aep` },
  { label: 'Illustrator on the SAPN educational series design', expect: '86d31k2ag',
    app: 'Illustrator', bundleId: 'com.adobe.Illustrator',
    path: `${ROOT}/SAPN/2026/Educational series/Solar_and_electricity_design.ai` },
  { label: 'After Effects on the MBD CAS explainer', expect: '86d1jjfu5',
    app: 'After Effects', bundleId: 'com.adobe.AfterEffects',
    path: `${ROOT}/MBD Billable/2026/CAS Explainer/CAS_explainer_post.aep` },
  { label: 'Illustrator on the MBD CAS explainer design', expect: '86d1jjft4',
    app: 'Illustrator', bundleId: 'com.adobe.Illustrator',
    path: `${ROOT}/MBD Billable/2026/CAS Explainer/CAS_explainer_design.ai` },
  { label: 'Word on the Aurizn GPTW copy', expect: '86d4187pk',
    app: 'Microsoft Word', bundleId: 'com.microsoft.Word',
    path: `${ROOT}/Aurizn/2026/GPTW/GPTW_wallpapers_banners_posters_copy.docx` },
  { label: 'Photoshop on the Aurizn GPTW concepts', expect: '86d4187kj',
    app: 'Photoshop', bundleId: 'com.adobe.Photoshop',
    path: `${ROOT}/Aurizn/2026/GPTW/GPTW_wallpapers_concepts.psd` },
  { label: 'Word on the Cole social content', expect: '86d0ah56h',
    app: 'Microsoft Word', bundleId: 'com.microsoft.Word',
    path: `${ROOT}/Cole School Experts/2025/Social Media Oct/social_media_oct_content.docx` },
  { label: 'Illustrator on the Ilim yearbook layout', expect: '86d0tehnb',
    app: 'Illustrator', bundleId: 'com.adobe.Illustrator',
    path: `${ROOT}/Ilim College/2025/Yearbook/yearbook_2025_layout.ai` },

  // --- Client abbreviations differing from the ClickUp folder ------------
  { label: 'Folder "Symons" vs ClickUp "Symons Clark"', expect: '86d40ncfk',
    app: 'Illustrator', bundleId: 'com.adobe.Illustrator',
    path: `${ROOT}/Symons/2026/Emergency Icons/emergency_icons_design.ai` },
  { label: 'Folder "Cole" vs ClickUp "Cole School Experts"', expect: '86d3ymq7z',
    app: 'Photoshop', bundleId: 'com.adobe.Photoshop',
    path: `${ROOT}/Cole/2026/EDM/cole_edm_year_end.psd` },
  { label: 'Folder "Ilim" vs ClickUp "Ilim College"', expect: '86d3tvpg0',
    app: 'Illustrator', bundleId: 'com.adobe.Illustrator',
    path: `${ROOT}/Ilim/2026/Dallas girls poster/dallas_girls_poster.ai` },

  // --- Browser and non-file signals -------------------------------------
  { label: 'ClickUp task open in Chrome', expect: '86d3n282a',
    app: 'Google Chrome', bundleId: 'com.google.Chrome',
    url: 'https://app.clickup.com/t/86d3n282a', title: 'Subnet - Conference Video' },
  { label: 'Slack channel named for the client', expect: '86d3rq6xc',
    app: 'Slack', bundleId: 'com.tinyspeck.slackmacgap',
    title: 'AOL - OBD July edits — Motion by Design' },

  // --- Near misses that must not be over-confident -----------------------
  { label: 'Ambiguous Resmed promo file', expect: 'AMBIGUOUS',
    app: 'Photoshop', bundleId: 'com.adobe.Photoshop',
    path: `${ROOT}/Resmed/2026/Promos/promo.psd` },
  { label: 'Terminal with nothing to go on', expect: 'NONE',
    app: 'Terminal', bundleId: 'com.apple.Terminal', title: 'dom@mac: ~' },
];


export function caseBlock(c: Case): ActivityBlock {
  return {
    id: 'b', start: 0, end: 3_600_000, activeMs: 3_600_000,
    app: c.app, bundleId: c.bundleId,
    titles: c.title ? [c.title] : [],
    paths: c.path ? [c.path] : [],
    urls: c.url ? [c.url] : [],
    samples: 720,
  };
}

export const evalConfig: Config = {
  ...structuredClone(defaultConfig),
  projectRoots: [{ path: ROOT, clientSegment: 0 }],
  clientAliases: { Symons: 'Symons Clark', Cole: 'Cole School Experts', Ilim: 'Ilim College' },
  targets: { dailyMinutes: 390, billableMinutes: 390 },
  quickLog: [
    { label: 'MBD Meeting', taskId: '86d2c5302', minutes: 30, billable: false },
    { label: 'Admin', taskId: '86d2c55nd', minutes: 15, billable: false },
    { label: 'Training', taskId: '86d2c54d1', minutes: 30, billable: false },
  ],
};

export { ROOT, rules as evalRules, CASES };
export type { Case };
