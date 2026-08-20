import { log } from './log.ts';

const API = 'https://api.clickup.com/api/v2';

export class ClickUpError extends Error {
  status: number;
  body: string;

  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = 'ClickUpError';
    this.status = status;
    this.body = body;
  }
}

interface RawTask {
  id: string;
  custom_id?: string | null;
  name: string;
  url?: string;
  status?: { status?: string };
  list?: { id?: string; name?: string };
  folder?: { id?: string; name?: string; hidden?: boolean };
  space?: { id?: string; name?: string };
}

/**
 * Minimal ClickUp v2 client. Personal API tokens go in `Authorization`
 * verbatim — no `Bearer` prefix, unlike most APIs.
 */
export class ClickUpClient {
  #token: string;
  /** ClickUp's documented floor is 100 requests/minute on the free plan. */
  #minIntervalMs = 650;
  #nextSlot = 0;

  constructor(token: string) {
    this.#token = token;
  }

  async #throttle(): Promise<void> {
    const now = Date.now();
    const wait = Math.max(0, this.#nextSlot - now);
    this.#nextSlot = Math.max(now, this.#nextSlot) + this.#minIntervalMs;
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  }

  async request<T>(endpoint: string, init: RequestInit = {}, attempt = 0): Promise<T> {
    await this.#throttle();
    const response = await fetch(`${API}${endpoint}`, {
      ...init,
      headers: {
        Authorization: this.#token,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });

    if (response.status === 429 && attempt < 4) {
      const retryAfter = Number(response.headers.get('retry-after') ?? '0');
      const delay = retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 1000;
      log.warn(`ClickUp rate limited; retrying in ${delay}ms`, endpoint);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return this.request<T>(endpoint, init, attempt + 1);
    }
    if (response.status >= 500 && attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 1000));
      return this.request<T>(endpoint, init, attempt + 1);
    }
    if (!response.ok) {
      const body = await response.text();
      throw new ClickUpError(`ClickUp ${init.method ?? 'GET'} ${endpoint} → ${response.status}`, response.status, body);
    }
    return (await response.json()) as T;
  }

  getUser(): Promise<{ user: { id: number; username: string; email: string } }> {
    return this.request('/user');
  }

  getTeams(): Promise<{ teams: Array<{ id: string; name: string }> }> {
    return this.request('/team');
  }

  getSpaces(teamId: string): Promise<{ spaces: Array<{ id: string; name: string; archived: boolean }> }> {
    return this.request(`/team/${teamId}/space?archived=false`);
  }

  getFolders(spaceId: string): Promise<{ folders: Array<{ id: string; name: string }> }> {
    return this.request(`/space/${spaceId}/folder?archived=false`);
  }

  getFolderLists(folderId: string): Promise<{ lists: Array<{ id: string; name: string }> }> {
    return this.request(`/folder/${folderId}/list?archived=false`);
  }

  getFolderlessLists(spaceId: string): Promise<{ lists: Array<{ id: string; name: string }> }> {
    return this.request(`/space/${spaceId}/list?archived=false`);
  }

  /**
   * Pull open tasks across whole spaces in one paged sweep rather than
   * per-list — far fewer requests against the rate limit.
   */
  async getTeamTasks(
    teamId: string,
    options: { spaceIds?: string[]; assigneeIds?: string[] } = {},
  ): Promise<RawTask[]> {
    const tasks: RawTask[] = [];
    for (let page = 0; page < 50; page++) {
      const params = new URLSearchParams({
        page: String(page),
        subtasks: 'true',
        include_closed: 'false',
        archived: 'false',
        order_by: 'updated',
      });
      for (const id of options.spaceIds ?? []) params.append('space_ids[]', id);
      for (const id of options.assigneeIds ?? []) params.append('assignees[]', id);

      const result = await this.request<{ tasks: RawTask[]; last_page?: boolean }>(
        `/team/${teamId}/task?${params.toString()}`,
      );
      tasks.push(...result.tasks);
      if (result.last_page || result.tasks.length === 0) break;
    }
    return tasks;
  }

  /** `start` and `duration` are epoch/elapsed milliseconds. */
  createTimeEntry(
    teamId: string,
    entry: { tid: string; start: number; duration: number; description?: string; billable?: boolean; tags?: string[] },
  ): Promise<{ data: { id: string } }> {
    return this.request(`/team/${teamId}/time_entries`, {
      method: 'POST',
      body: JSON.stringify(entry),
    });
  }

  getRunningEntry(teamId: string): Promise<{ data: unknown }> {
    return this.request(`/team/${teamId}/time_entries/current`);
  }
}

export function toTaskRefs(tasks: RawTask[]): Array<{
  taskId: string; taskName: string; listId: string; listName: string;
  folderName: string | null; spaceName: string; url: string | null; status: string | null;
}> {
  const refs = [];
  for (const task of tasks) {
    if (!task.id || !task.name || !task.list?.id) continue;
    refs.push({
      taskId: task.id,
      taskName: task.name,
      listId: task.list.id,
      listName: task.list.name ?? '',
      // ClickUp reports folderless lists with a synthetic "hidden" folder.
      folderName: task.folder?.hidden ? null : (task.folder?.name ?? null),
      spaceName: task.space?.name ?? '',
      url: task.url ?? null,
      status: task.status?.status ?? null,
    });
  }
  return refs;
}
