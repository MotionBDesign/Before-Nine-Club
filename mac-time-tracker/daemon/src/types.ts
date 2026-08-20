/** One observation of what the Mac was doing, emitted by the Swift observer. */
export interface Snapshot {
  /** epoch milliseconds */
  ts: number;
  /** Human-readable app name, e.g. "Adobe Photoshop 2026" */
  app: string;
  /** e.g. "com.adobe.Photoshop" */
  bundleId: string;
  /** Focused window title, or null when unavailable/suppressed. */
  title: string | null;
  /** Filesystem path of the focused document (AXDocument), or null. */
  documentPath: string | null;
  /** URL of the focused browser tab, or null. */
  url: string | null;
  /** Seconds since the last keyboard/mouse event. */
  idleSeconds: number;
  /** True when the screen is locked or the screensaver is running. */
  locked?: boolean;
}

/** A contiguous run of snapshots that share the same working context. */
export interface ActivityBlock {
  id: string;
  start: number;
  end: number;
  /** Wall time minus sampled idle, in milliseconds. */
  activeMs: number;
  app: string;
  bundleId: string;
  titles: string[];
  paths: string[];
  urls: string[];
  samples: number;
}

export interface TaskRef {
  taskId: string;
  taskName: string;
  listId: string;
  listName: string;
  folderName: string | null;
  spaceName: string;
  url: string | null;
  status: string | null;
}

export interface Candidate {
  task: TaskRef | null;
  /** Set when we could place the work with a client/list but not a specific task. */
  listId: string | null;
  listName: string | null;
  folderName: string | null;
  spaceName: string | null;
  score: number;
  reasons: string[];
}

export interface Suggestion {
  taskId: string | null;
  taskName: string | null;
  listId: string | null;
  listName: string | null;
  folderName: string | null;
  spaceName: string | null;
  /** 0..1 */
  confidence: number;
  reasons: string[];
  alternatives: Array<{ taskId: string | null; taskName: string | null; listName: string | null; score: number }>;
  billable: boolean | null;
}

export type EntryStatus = 'pending' | 'approved' | 'rejected' | 'synced';

/** A proposed line on the day's timesheet. */
export interface ProposedEntry {
  id: string;
  date: string;
  start: number;
  end: number;
  /** Raw measured active time. */
  activeMs: number;
  /** activeMs after rounding; this is what gets pushed. */
  durationMs: number;
  blockIds: string[];
  evidence: {
    apps: string[];
    paths: string[];
    titles: string[];
    urls: string[];
  };
  suggestion: Suggestion;
  status: EntryStatus;
  /** User's final choice; defaults to suggestion.taskId. */
  taskId: string | null;
  description: string;
  billable: boolean;
  clickupEntryId?: string;
  syncedAt?: number;
  /** Set when the user edited the task away from the suggestion. */
  corrected?: boolean;
}

export interface DayFile {
  date: string;
  updatedAt: number;
  entries: ProposedEntry[];
}

/* ---------------------------------------------------------------- rules -- */

export interface RuleWhen {
  bundleId?: string;
  appRegex?: string;
  titleRegex?: string;
  pathRegex?: string;
  pathContains?: string;
  urlRegex?: string;
}

export interface RuleThen {
  /** Named capture group (from any `when` regex) holding a literal ClickUp task id. */
  taskIdFrom?: string;
  taskId?: string;
  /** Narrow to a ClickUp folder (client), list, or space by name. */
  folder?: string;
  folderFrom?: string;
  list?: string;
  space?: string;
  /** Text used to search task names within the narrowed scope. */
  taskQueryFrom?: string;
}

export interface Rule {
  name: string;
  when: RuleWhen;
  then: RuleThen;
  /** Relative strength. Direct task identification should sit near 100. */
  weight: number;
  billable?: boolean;
  /** Skip this block entirely (e.g. password managers). */
  ignore?: boolean;
}

/* --------------------------------------------------------------- config -- */

export interface ProjectRoot {
  /** Absolute path, `~` allowed. */
  path: string;
  /**
   * Zero-based index of the path segment (relative to `path`) that names the
   * client, e.g. 0 for /Volumes/Projects/Clients/<Client>/...
   */
  clientSegment: number;
}

export interface Config {
  clickup: {
    workspaceId: string;
    tokenEnv: string;
    keychainService: string;
    keychainAccount: string;
    defaultBillable: boolean;
    /** Only consider tasks in these spaces. Empty = all spaces. */
    spaces: string[];
    /** Only consider tasks assigned to the authenticated user. */
    onlyMyTasks: boolean;
    catalogTtlMinutes: number;
  };
  capture: {
    sampleIntervalSeconds: number;
    idleThresholdSeconds: number;
    minBlockSeconds: number;
    mergeGapSeconds: number;
    roundToMinutes: number;
    minEntryMinutes: number;
  };
  observer: {
    /**
     * 'spool' — the observer runs as its own launch agent and appends to a
     * file we tail. This is the installed default, and the only mode where
     * macOS attributes Accessibility permission to the observer binary.
     * 'spawn' — the daemon starts the observer as a child. Handy in dev, but
     * then the *parent* is what needs the Accessibility grant.
     */
    mode: 'spool' | 'spawn';
    /** Empty means the default location inside the data directory. */
    spoolPath: string;
    /** Empty means observer/.build/release/BNObserver next to the daemon. */
    binaryPath: string;
    pollSeconds: number;
    /**
     * How the observer reads browser addresses.
     * 'accessibility' — no extra permission prompts, but Chromium exposes the
     *   URL inconsistently and private windows cannot be detected.
     * 'appleScript' — reliable, and the only mode that recognises an incognito
     *   window (which is then recorded as nothing at all). Costs one macOS
     *   Automation prompt per browser.
     * 'off' — never read browser URLs.
     */
    browserUrls: 'accessibility' | 'appleScript' | 'off';
  };
  server: { port: number; host: string };
  review: {
    /** Local hours (0–23) at which to nudge you to review the day. */
    notifyHours: number[];
    /** Rebuild the running day's proposal this often. */
    rebuildEveryMinutes: number;
  };
  projectRoots: ProjectRoot[];
  /** Maps a folder name found on disk to a ClickUp folder name. */
  clientAliases: Record<string, string>;
  /**
   * Which phase of work each app implies, keyed by bundle id.
   *
   * Tasks here are routinely split into "… COPY", "… DESIGN", "… STORYBOARD",
   * "… ANIMATION", "… POSTPRODUCTION" siblings under one parent. The filename
   * often can't tell them apart, but the app you are in can: After Effects
   * means animation, Word means copy. These words are matched against task
   * names to break exactly that tie.
   */
  appPhases: Record<string, string[]>;
  ignore: {
    bundleIds: string[];
    titlePatterns: string[];
    pathPatterns: string[];
  };
  privacy: {
    recordTitles: boolean;
    recordUrls: boolean;
    /** Strip query strings and fragments from recorded URLs. */
    redactUrlQuery: boolean;
    /** Delete raw snapshot files older than this. 0 disables cleanup. */
    retainRawSnapshotDays: number;
  };
  autoConfirm: {
    /** Never true in this build: entries always need a human approval. */
    enabled: false;
  };
}
