import type { TaskRef } from './types.ts';

export interface SpaceRef { id: string; name: string }
export interface FolderRef { id: string; name: string; spaceId: string; spaceName: string }
export interface ListRef {
  id: string;
  name: string;
  folderId: string | null;
  folderName: string | null;
  spaceId: string;
  spaceName: string;
}

/** A cached snapshot of the ClickUp workspace we can match against offline. */
export interface Catalog {
  fetchedAt: number;
  workspaceId: string;
  userId: number | null;
  spaces: SpaceRef[];
  folders: FolderRef[];
  lists: ListRef[];
  tasks: TaskRef[];
}

export const emptyCatalog = (workspaceId = ''): Catalog => ({
  fetchedAt: 0,
  workspaceId,
  userId: null,
  spaces: [],
  folders: [],
  lists: [],
  tasks: [],
});

export function isStale(catalog: Catalog, ttlMinutes: number): boolean {
  return Date.now() - catalog.fetchedAt > ttlMinutes * 60_000;
}
