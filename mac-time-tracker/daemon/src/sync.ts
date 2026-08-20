import type { Catalog, FolderRef, ListRef, SpaceRef } from './catalog.ts';
import type { Config, DayFile, ProposedEntry, TaskRef } from './types.ts';
import { ClickUpClient, ClickUpError, toTaskRefs } from './clickup.ts';
import { normalizeName } from './text.ts';
import { saveDay } from './store.ts';
import { log } from './log.ts';

/** Read the whole workspace shape plus open tasks into a local cache. */
export async function refreshCatalog(client: ClickUpClient, config: Config): Promise<Catalog> {
  const me = await client.getUser();
  const { teams } = await client.getTeams();
  const teamId = config.clickup.workspaceId || teams[0]?.id;
  if (!teamId) throw new Error('No ClickUp workspace available for this token.');

  const wanted = new Set(config.clickup.spaces.map(normalizeName));
  const allSpaces = (await client.getSpaces(teamId)).spaces.filter((s) => !s.archived);
  const spaces: SpaceRef[] = allSpaces
    .filter((s) => wanted.size === 0 || wanted.has(normalizeName(s.name)))
    .map((s) => ({ id: s.id, name: s.name }));

  const folders: FolderRef[] = [];
  const lists: ListRef[] = [];

  for (const space of spaces) {
    const spaceFolders = (await client.getFolders(space.id)).folders;
    for (const folder of spaceFolders) {
      folders.push({ id: folder.id, name: folder.name, spaceId: space.id, spaceName: space.name });
      for (const list of (await client.getFolderLists(folder.id)).lists) {
        lists.push({
          id: list.id, name: list.name,
          folderId: folder.id, folderName: folder.name,
          spaceId: space.id, spaceName: space.name,
        });
      }
    }
    for (const list of (await client.getFolderlessLists(space.id)).lists) {
      lists.push({
        id: list.id, name: list.name,
        folderId: null, folderName: null,
        spaceId: space.id, spaceName: space.name,
      });
    }
  }

  const raw = await client.getTeamTasks(teamId, {
    spaceIds: spaces.map((s) => s.id),
    assigneeIds: config.clickup.onlyMyTasks ? [String(me.user.id)] : [],
  });

  // The team-task endpoint doesn't always name the space/folder, so fill the
  // gaps from the list index we just built.
  const listsById = new Map(lists.map((l) => [l.id, l]));
  const tasks: TaskRef[] = toTaskRefs(raw).map((task) => {
    const list = listsById.get(task.listId);
    return {
      ...task,
      listName: task.listName || (list?.name ?? ''),
      folderName: task.folderName ?? list?.folderName ?? null,
      spaceName: task.spaceName || (list?.spaceName ?? ''),
    };
  }).filter((task) => listsById.has(task.listId));

  log.info(`Catalog refreshed: ${spaces.length} spaces, ${folders.length} folders, ${lists.length} lists, ${tasks.length} tasks`);

  return { fetchedAt: Date.now(), workspaceId: teamId, userId: me.user.id, spaces, folders, lists, tasks };
}

export interface PushResult {
  pushed: number;
  skipped: number;
  failures: Array<{ entryId: string; reason: string }>;
}

/**
 * Write every approved entry to ClickUp. Entries flip to `synced` one at a time
 * and the day is saved after each success, so an interruption can't double-post.
 */
export async function pushApproved(
  client: ClickUpClient,
  config: Config,
  day: DayFile,
): Promise<PushResult> {
  const result: PushResult = { pushed: 0, skipped: 0, failures: [] };
  const teamId = config.clickup.workspaceId;
  if (!teamId) {
    result.failures.push({ entryId: '-', reason: 'clickup.workspaceId is not set' });
    return result;
  }

  for (const entry of day.entries) {
    if (entry.status !== 'approved') continue;
    if (!entry.taskId) {
      result.skipped++;
      result.failures.push({ entryId: entry.id, reason: 'approved without a task' });
      continue;
    }
    try {
      const created = await client.createTimeEntry(teamId, {
        tid: entry.taskId,
        start: entry.start,
        duration: entry.durationMs,
        description: buildDescription(entry),
        billable: entry.billable,
      });
      entry.status = 'synced';
      entry.clickupEntryId = created.data?.id;
      entry.syncedAt = Date.now();
      saveDay(day);
      result.pushed++;
    } catch (error) {
      const reason = error instanceof ClickUpError ? `${error.message}: ${error.body.slice(0, 200)}` : String(error);
      log.error(`Failed to push entry ${entry.id}`, reason);
      result.failures.push({ entryId: entry.id, reason });
    }
  }
  return result;
}

function buildDescription(entry: ProposedEntry): string {
  const text = entry.description.trim();
  return text.length > 250 ? `${text.slice(0, 247)}...` : text;
}
