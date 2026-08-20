/**
 * A representative slice of the live Motion by Design workspace, pulled from
 * the ClickUp API. It exists to test the matcher against how tasks are really
 * named here rather than against tidy invented examples.
 *
 * The important shape: most work is a parent task plus phase-suffixed
 * children — SCRIPTS, STORYBOARD, DESIGN, ANIMATION, VO, POSTPRODUCTION —
 * so the phase, not the project, is usually what has to be distinguished.
 */
import type { Catalog } from '../src/catalog.ts';

const LISTS: Array<[string, string, string]> = [
  // [listId, listName, folderName]
  ['901614105218', 'SAPN - Retainer Projects 2026', 'SAPN'],
  ['901614107571', 'Resmed - Retainer List 2026', 'Resmed'],
  ['901616227668', 'Resmed - B2B2C List', 'Resmed - B2B2C'],
  ['901614107547', 'Maptek - Retainer List 2026', 'Maptek'],
  ['901614107539', 'Symons Clark - Retainer List 2026', 'Symons Clark'],
  ['901614107541', 'Ilim College - Retainer List 2026', 'Ilim College'],
  ['901614107531', 'Cole School Experts Retainer List 2026', 'Cole School Experts'],
  ['901614107575', 'Aurizn - Retainer List 2026', 'Aurizn'],
  ['901614107554', 'AOL - Retainer List 2026', 'AOL'],
  ['901614195358', 'Subnet Retainer List', 'Subnet'],
  ['901614104724', 'MBD - Billable Projects 2026', 'MBD Billable'],
];

/** The MBD Non billable space's Active list — quick-log targets live here. */
const NON_BILLABLE_LIST: [string, string] = ['901614104585', 'Active list'];
const NON_BILLABLE_TASKS: Array<[string, string]> = [
  ['86d2c5302', 'MBD - Non billable - Meetings, catch ups'],
  ['86d2c55nd', 'MBD - Non billable - Admin, shops'],
  ['86d2c54d1', 'MBD - Non billable - Training, Trials'],
  ['86d2c5581', 'MBD - Non billable - Clean, tidy up'],
];

const TASKS: Array<[string, string, string]> = [
  // [taskId, taskName, listId]
  ['86d42w42h', 'SAPN - Apprentice recruitment SM videos', '901614105218'],
  ['86d41cdvc', 'SAPN Prostate Cancer Awareness month', '901614105218'],
  ['86d411aqa', 'SAPN - new brand guidelines - Feedback and variations', '901614105218'],
  ['86d3yjw8z', 'SAPN - Electricity at home illustration', '901614105218'],
  ['86d3w34qt', 'SAPN- Naidoc week video', '901614105218'],
  ['86d3mfjmu', 'SAPN - EWIT 2026 shoot and post production', '901614105218'],
  ['86d34c10e', 'SAPN - New animation 2026 Helicopter inspections', '901614105218'],
  ['86d19y584', 'SAPN - Customer Response Vehicle comms DESIGN + POSTPRODUCTION', '901614105218'],
  ['86d17w0yp', 'SAPN - RAP Artwork EPS file', '901614105218'],
  ['86d0qafwg', 'SAPN - Day in the life - CADET Video', '901614105218'],
  ['86d04tan4', 'SAPN - Before you dig / digging near by powerlines poles DESIGN + POST', '901614105218'],
  ['86d2w4864', 'SAPN - Evergreen campaign - Get prepared COPY + DESIGN', '901614105218'],
  // Four-way phase split — the hardest family in the workspace.
  ['86d3bn9np', 'SAPN New explainer - Annual Smarter Homes Solar Curtailment Test', '901614105218'],
  ['86d3bn9v1', 'SAPN New explainer - Annual Smarter Homes Solar Curtailment Test COPY SCRIPT', '901614105218'],
  ['86d3bn9ya', 'SAPN New explainer - Annual Smarter Homes Solar Curtailment Test DESIGN STYLEFRAMES + STORYBOARD', '901614105218'],
  ['86d3bn9zy', 'SAPN New explainer - Annual Smarter Homes Solar Curtailment Test ANIMATION + VO', '901614105218'],
  ['86d31k272', 'SAPN - Educational series - Solar and electricity', '901614105218'],
  ['86d31k28t', 'SAPN - Educational series - Solar and electricity COPY/CONTENT', '901614105218'],
  ['86d31k2ag', 'SAPN - Educational series - Solar and electricity DESIGN', '901614105218'],
  ['86d31k2c0', 'SAPN - Educational series - Solar and electricity ANIMATION + VO', '901614105218'],

  ['86d42ff8d', 'Resmed - CPAP Trial EDM', '901614107571'],
  ['86d42bgyj', 'Resmed - ATL + OOH Ads Aug 2026', '901614107571'],
  ['86d3qj25d', 'Resmed - ATL + OOH Ads July 2026', '901614107571'],
  ['86d4213xf', 'Resmed - Tiered Bundles EDMs', '901614107571'],
  ['86d408jdp', 'Resmed - TIered Bundles', '901614107571'],
  ['86d408vjz', 'Resmed - Service days EDMs', '901614107571'],
  ['86d411aa4', 'Resmed - comorbidity artwork -ads', '901614107571'],
  ['86d3v5fv8', 'Resmed - Ecom mask resize images', '901614107571'],
  ['86d3ke9z4', 'Resmed - Agnostic Landing page banner', '901614107571'],
  ['86d2mct22', 'Resmed - May promo', '901614107571'],
  ['86d2mct2v', 'Resmed - May promo KV DESIGN', '901614107571'],
  ['86d288ap3', 'Resmed - April Promos Rollout DESIGN AND PRODUCTION', '901614107571'],
  ['86d42vdv2', 'B2B - Therapy plan x 6 brochures brand updates', '901616227668'],
  ['86d41w18t', 'B2B - Aircurve 11 Vautor Hype reel launch', '901616227668'],
  ['86d3t0uwr', 'B2B - Marketing Hub', '901616227668'],

  ['86d435ptp', 'Maptek - NS4 on site at Kanmantoo Mine', '901614107547'],
  ['86d3ykhp2', 'Maptek - Evolution Promo', '901614107547'],
  ['86d3pu2uw', 'Maptek - Conference video', '901614107547'],
  ['86d3nybxp', 'Maptek - Conference content', '901614107547'],
  ['86d3nybke', 'Maptek - Blast Logic Explainer', '901614107547'],
  ['86d3nybhu', 'Maptek - Vulcan Explainer', '901614107547'],
  ['86d3nybh8', 'maptek - vestrex explainer', '901614107547'],
  ['86d2xhcpr', 'Maptek Vestrex Teaser New script + styleframes', '901614107547'],
  ['86d2aw6pn', 'Maptek - Recruitment Video POSTPRODUCTION', '901614107547'],
  ['86d24yv9q', 'Maptek - Corporate Video POST PRODUCTION', '901614107547'],
  ['86d23488v', 'Maptek - Corporate Videos', '901614107547'],
  ['86d39f3h5', 'Maptek - How to videos DESIGN and POSTPRODUCTION', '901614107547'],
  ['86d36ccmg', 'Maptek - 45 years - socials cuts', '901614107547'],

  // Five-way phase split.
  ['86d06ennj', 'Symons - Onboarding Visitors video', '901614107539'],
  ['86d06enrw', 'Symons - Onboarding Visitors video - SCRIPTS', '901614107539'],
  ['86d06envy', 'Symons - Onboarding Visitors video - STORYBOARD', '901614107539'],
  ['86d06ep1p', 'Symons - Onboarding Visitors video - POSTPRODUCTION', '901614107539'],
  ['86d06ep2v', 'Symons - Onboarding Visitors video - VO', '901614107539'],
  ['86d0pfv1a', 'Symons - Fitness for work video', '901614107539'],
  ['86d0pfv5y', 'Symons - Fitness for work video STORYBOARD', '901614107539'],
  ['86d0pfv7r', 'Symons - Fitness for work video ANIMATION/POST', '901614107539'],
  ['86d0pfv8r', 'Symons - Fitness for work video VO', '901614107539'],
  ['86d2nnn68', 'Symons - Induction Video - Animation', '901614107539'],
  ['86d2nnn82', 'Symons - Induction Video - Rewrite CONTENT/COPY', '901614107539'],
  ['86d2nnna0', 'Symons - Induction Video - Storyboard DESIGN', '901614107539'],
  ['86d3pjg2b', 'Symons - Mining Brochure', '901614107539'],
  ['86d3pu42f', 'Symons - HSE Survey results poster', '901614107539'],
  ['86d3pdge2', 'Symons - Survey results PPT', '901614107539'],
  ['86d40ncfk', 'Symons - Emergency Icons design', '901614107539'],
  ['86d2buu9f', 'Symons - Email Signature Outlook template 2026', '901614107539'],
  ['86d1r2gyv', "Symons - 'Ask Jason poster' DESIGN", '901614107539'],

  ['86d40zbww', 'ILIM - Guilds Course Copy 2026', '901614107541'],
  ['86d40990y', 'ILIM - Recruitment Social Post', '901614107541'],
  ['86d3tvpg0', 'Ilim - Dallas girls poster Design', '901614107541'],
  ['86d3tvpht', 'Ilim - School Fee Schedule', '901614107541'],
  ['86d34c576', 'Ilim - Annual report 2026', '901614107541'],
  ['86d0mdv0f', 'Ilim - Yearbook', '901614107541'],
  ['86d0mdv7d', 'Ilim - Yearbook - COVERS & INT TEMPLATE CONCEPTS DESIGN', '901614107541'],
  ['86d0tehnb', 'Ilim - yearbook 2025 - LAYOUT DESIGN', '901614107541'],
  ['86d0tejun', 'Ilim - yearbook 2025 - CONTENT + FINAL DELIVERY', '901614107541'],
  ['86d1y5zax', 'Ilim - VCE Video Feb 2026', '901614107541'],
  ['86d1y5zgb', 'Ilim - VCE Video -Feb 2026 SHOOT DAYS', '901614107541'],
  ['86d1y5zpq', 'Ilim VCE Video - PRE AND POST PRODUCTION', '901614107541'],
  ['86d1y6081', 'Ilim - VCE Video - MOODBOARD/CONCEPT', '901614107541'],
  ['86d2h3xpj', 'Ilim - Classroom posters x 7 REDESIGN', '901614107541'],

  ['86d3zqwzf', 'Cole - Corporate video post production', '901614107531'],
  ['86d3ymq7z', 'Cole - EDM Year-end', '901614107531'],
  ['86d3ymq5f', 'Cole - SEP socials', '901614107531'],
  ['86d3h1evk', 'Cole - All services Prospectus brochure COPY + DESIGN', '901614107531'],
  ['86d0ah51v', 'Cole - Social Media Oct 2025', '901614107531'],
  ['86d0ah56h', 'Cole - Social Media Oct 2025 CONTENT', '901614107531'],
  ['86d0ah5b7', 'Cole - Social Media Oct 2025 DESIGN / POST PRODUCTION', '901614107531'],
  ['86d1a96mq', 'Cole - School payroll health selfdiagnosis DESIGN', '901614107531'],
  ['86d3arx0e', 'Cole - Website', '901614107531'],

  ['86d42bdb7', 'Aurizn GPTW Town Hall PPT', '901614107575'],
  ['86d42bd8q', 'Aurizn GPTW Leader Toolkit', '901614107575'],
  ['86d4186py', 'Aurizn - GPTW wallpapaers, email banners, posters', '901614107575'],
  ['86d4187kj', 'Aurizn - GPTW wallpapaers, email banners, posters CONCEPTS', '901614107575'],
  ['86d4187pk', 'Aurizn - GPTW wallpapaers, email banners, posters COPY', '901614107575'],
  ['86d420rd3', 'Aurizn - AmCham Parliamentary Showcase Booklet', '901614107575'],
  ['86d3me3yq', 'Aurzin - Company slidedeck', '901614107575'],
  ['86d22gdr0', 'Aurizn - Sales Deck DESIGN + CONTENT', '901614107575'],

  ['86d3rq6xc', 'AOL - OBD July edits', '901614107554'],
  ['86d3mwjd9', 'AOL - UBA 2026 postproduction', '901614107554'],
  ['86d3n282a', 'Subnet - Conference Video', '901614195358'],

  ['86d42yb6p', 'MBD - Onboarding 2026', '901614104724'],
  ['86d4096mf', 'MBD EDM - August 2026', '901614104724'],
  ['86d3hjnbn', 'MBD - EDM July', '901614104724'],
  ['86d3850d3', 'MBD - Website SEO Pages 2026', '901614104724'],
  ['86d1jjfk6', 'MBD - CAS Explainer 2026', '901614104724'],
  ['86d1jjfq5', 'MBD - CAS Explainer 2026 CONTENT', '901614104724'],
  ['86d1jjft4', 'MBD - CAS Explainer 2026 DESIGN', '901614104724'],
  ['86d1jjfu5', 'MBD - CAS Explainer 2026 POST PRODUCTION', '901614104724'],
  ['86d2xhem0', 'MBD - Marketing Funnels COPY', '901614104724'],
];

export function realCatalog(): Catalog {
  const spaces = [
    { id: 'sp1', name: 'CAAS MBD Clients' },
    { id: 'sp2', name: 'MBD Non billable' },
  ];
  const folderNames = [...new Set(LISTS.map(([, , folder]) => folder))];
  const folders = folderNames.map((name) => ({
    id: `f-${name.toLowerCase().replace(/\W+/g, '')}`,
    name,
    spaceId: 'sp1',
    spaceName: 'CAAS MBD Clients',
  }));
  const folderIdByName = new Map(folders.map((f) => [f.name, f.id]));

  const lists = LISTS.map(([id, name, folderName]) => ({
    id, name,
    folderId: folderIdByName.get(folderName) ?? null,
    folderName,
    spaceId: 'sp1',
    spaceName: 'CAAS MBD Clients',
  }));
  const listById = new Map(lists.map((l) => [l.id, l]));

  const tasks = TASKS.map(([taskId, taskName, listId]) => {
    const list = listById.get(listId)!;
    return {
      taskId, taskName, listId,
      listName: list.name,
      folderName: list.folderName,
      spaceName: list.spaceName,
      url: `https://app.clickup.com/t/${taskId}`,
      status: 'in progress',
    };
  });

  lists.push({
    id: NON_BILLABLE_LIST[0], name: NON_BILLABLE_LIST[1],
    folderId: null as string | null, folderName: null as string | null,
    spaceId: 'sp2', spaceName: 'MBD Non billable',
  } as (typeof lists)[number]);
  for (const [taskId, taskName] of NON_BILLABLE_TASKS) {
    tasks.push({
      taskId, taskName,
      listId: NON_BILLABLE_LIST[0], listName: NON_BILLABLE_LIST[1],
      folderName: null as string | null, spaceName: 'MBD Non billable',
      url: `https://app.clickup.com/t/${taskId}`, status: 'ongoing',
    } as (typeof tasks)[number]);
  }

  return { fetchedAt: Date.now(), workspaceId: '9003163669', userId: 1, spaces, folders, lists, tasks };
}

export const realTaskCount = TASKS.length;
