import { defaultConfig } from '../src/config.ts';
import type { Catalog } from '../src/catalog.ts';
import type { Config, Rule, Snapshot } from '../src/types.ts';

/** A trimmed stand-in for the real Motion by Design workspace. */
export function catalog(): Catalog {
  const spaces = [
    { id: 'sp1', name: 'CAAS MBD Clients' },
    { id: 'sp2', name: 'MBD Non billable' },
  ];
  const folders = [
    { id: 'f-sapn', name: 'SAPN', spaceId: 'sp1', spaceName: 'CAAS MBD Clients' },
    { id: 'f-resmed', name: 'Resmed', spaceId: 'sp1', spaceName: 'CAAS MBD Clients' },
    { id: 'f-maptek', name: 'Maptek', spaceId: 'sp1', spaceName: 'CAAS MBD Clients' },
  ];
  const lists = [
    { id: 'l-sapn', name: 'SAPN - Retainer Projects 2026', folderId: 'f-sapn', folderName: 'SAPN', spaceId: 'sp1', spaceName: 'CAAS MBD Clients' },
    { id: 'l-resmed', name: 'Resmed - Retainer List 2026', folderId: 'f-resmed', folderName: 'Resmed', spaceId: 'sp1', spaceName: 'CAAS MBD Clients' },
    { id: 'l-maptek', name: 'Maptek - Retainer List 2026', folderId: 'f-maptek', folderName: 'Maptek', spaceId: 'sp1', spaceName: 'CAAS MBD Clients' },
    { id: 'l-admin', name: 'Active list', folderId: null, folderName: null, spaceId: 'sp2', spaceName: 'MBD Non billable' },
  ];
  const task = (taskId: string, taskName: string, listId: string) => {
    const list = lists.find((l) => l.id === listId)!;
    return {
      taskId, taskName, listId,
      listName: list.name, folderName: list.folderName, spaceName: list.spaceName,
      url: `https://app.clickup.com/t/${taskId}`, status: 'in progress',
    };
  };
  return {
    fetchedAt: Date.now(),
    workspaceId: '9003163669',
    userId: 1,
    spaces, folders, lists,
    tasks: [
      task('86aaa0001', 'Powerline Safety poster series', 'l-sapn'),
      task('86aaa0002', 'Summer bushfire EDM', 'l-sapn'),
      task('86bbb0001', 'AirSense 11 launch social assets', 'l-resmed'),
      task('86bbb0002', 'Sleep clinic brochure refresh', 'l-resmed'),
      task('86ccc0001', 'Underground drilling explainer video', 'l-maptek'),
      task('86ddd0001', 'Internal admin and email', 'l-admin'),
    ],
  };
}

export function config(overrides: Partial<Config> = {}): Config {
  return {
    ...structuredClone(defaultConfig),
    projectRoots: [{ path: '/Volumes/Projects/Clients', clientSegment: 0 }],
    ...overrides,
  };
}

export const rules: Rule[] = [
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
  {
    name: 'Never record password managers',
    when: { appRegex: '(?i)1password' },
    then: {},
    weight: 100,
    ignore: true,
  },
];

/** Build a run of snapshots `count` samples long, one every `stepMs`. */
export function snapshots(
  start: number,
  count: number,
  base: Partial<Snapshot> & Pick<Snapshot, 'bundleId' | 'app'>,
  stepMs = 5000,
): Snapshot[] {
  return Array.from({ length: count }, (_, i) => ({
    ts: start + i * stepMs,
    title: null,
    documentPath: null,
    url: null,
    idleSeconds: 0,
    locked: false,
    ...base,
  }));
}

/** 2026-08-20 09:00 local. */
export const T0 = new Date(2026, 7, 20, 9, 0, 0).getTime();
