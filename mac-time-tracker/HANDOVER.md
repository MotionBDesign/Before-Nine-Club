# MBD Time Tracker — handover

Written to be pasted or attached into another conversation so development can
continue there. Everything below is current as of `b4d1c48`.

**Repo:** `MotionBDesign/Before-Nine-Club`
**Branch:** `claude/clickup-time-tracking-mac-m3ta4g`
**Code:** `mac-time-tracker/`

---

## What it is

A macOS background app that watches which app, file and window is in front,
infers which ClickUp task the time belongs to, and proposes a timesheet a
person approves before anything is written to ClickUp.

Nothing reaches ClickUp without a human pressing approve. That was a fixed
requirement from the start, not a setting.

## Decisions already made (don't relitigate without reason)

| Decision | Why |
|---|---|
| Suggest-and-confirm, never auto-log | Chosen explicitly over auto-logging |
| Swift shim + TypeScript brain | Chosen architecture; the Swift half is now optional |
| 6.5 h (390 min) minimum logged daily, billable-first | Studio policy |
| 15-minute blocks, nothing shorter | Explicit: "I don't want people to select anything that isn't less than a 15 minute block" |
| Adelaide time, 07:00–19:00 only | Explicit |
| Quick-log buttons for MBD meetings/admin/training | "Easily logged without looking" |
| Zero runtime dependencies, Node 22 type-stripping | No build step; the installer provisions its own Node |
| Outbound network restricted to `api.clickup.com` | Enforced in-process, with a test that fails the build if bypassed |

## Architecture

```
observer (per-user LaunchAgent)          daemon (per-user LaunchAgent)
"MBD Time Tracker.app"                   node src/index.ts
  samples every 5s          ─spool─▶       segments → matches → proposes
  frontmost app, AXTitle,   NDJSON         serves review UI on 127.0.0.1:7878
  AXFocusedWindow/AXDocument,              pushes approved entries to ClickUp
  browser tab URL, idle, lock
```

Two agents on purpose: macOS attributes the Accessibility grant to whatever
launchd starts directly, so the observer must be its own agent.

**All storage is local**, in `~/Library/Application Support/MBDTimeTracker/`:
config, rules, day files, raw activity, cached catalog, correction history.
There is no server-side component and no shared database.

---

## What a ClickUp replacement would have to provide

This is the whole integration surface. Read endpoints build a cached catalog;
one write endpoint does the actual logging.

**Read — to build the task catalog (refreshed hourly):**

| Purpose | ClickUp endpoint |
|---|---|
| Identify the user | `GET /user` |
| Spaces in the workspace | `GET /team/{id}/space` |
| Folders in a space | `GET /space/{id}/folder` |
| Lists in a folder / space | `GET /folder/{id}/list`, `GET /space/{id}/list` |
| Tasks, filtered, paged | `GET /team/{id}/task` |

**Write — the only mutation:**

| Purpose | ClickUp endpoint |
|---|---|
| Log time | `POST /team/{id}/time_entries` — `{tid, start, duration, description, billable}` |
| Reconcile after a failed push | `GET /team/{id}/time_entries?start_date&end_date` |

That reconcile call matters: if a create times out after the server committed,
the tracker looks for the entry before retrying, so a dropped connection can't
bill a client twice.

**The data model it actually needs** — a replacement must supply this per task,
or the matcher has nothing to work with:

```ts
interface TaskRef {
  taskId: string;      // stable id, used as the log target
  taskName: string;    // the matcher's main signal — see below
  listId: string;
  listName: string;
  folderName: string | null;   // this is the CLIENT. Load-bearing.
  spaceName: string;           // billable vs non-billable is decided from this
  url: string | null;
  status: string | null;
}
```

**Two things a replacement must not lose:**

1. **Folder = client.** Matching leans on the folder name appearing in the file
   path (`/Volumes/Projects/Clients/SAPN/...` → folder `SAPN`). A flat task
   list with no client grouping would drop match accuracy hard.
2. **Task names carry the work phase.** Names like
   `SAPN … Curtailment Test DESIGN STYLEFRAMES + STORYBOARD` are what let the
   app in use (After Effects → animation, Word → copy) sharpen the match.
   Terse names like "Curtailment" would remove that signal entirely.

Matching currently scores **28/28 on real MBD ClickUp data** (109 real tasks,
28 evaluation cases, `daemon/scripts/evaluate.ts`). That number is the
regression gate — any replacement's data shape should be run through it.

---

## State

**Working and verified off-device:** 207 tests pass, matcher 28/28. The review
UI is browser-verified (Playwright) for the day, week, tracking and fleet
views, timeline drag/clamping, and timezone correctness.

**Never run on a Mac.** Neither observer has been executed on macOS by me — I
develop on Linux. The applet's logic is now unit-tested with System Events,
ObjC and the shell stubbed, but the real AX behaviour is unproven. This is the
single biggest risk in the project.

**Deployed:** one install, on Ashley's Mac.

## Recently fixed (all live on the branch)

- Cards named the *suggested* task, not the one the time was logged against —
  so correcting a match showed an unrelated name
- An open app alone was enough to assign a specific task; Resolve in front with
  nothing readable pinned time to an arbitrary video task
- Unmatched blocks never merged, so an unbroken stretch fragmented and each
  piece rounded up independently — 40 minutes logged as 60
- Observer read `windows[0]`, not the focused window, reporting files that were
  merely open
- "Approve all matched" swept in weak guesses
- Memory: applet now recycles every 2 h; spool reads capped per poll
- Never stats a path inside an unmounted volume

## Open, needs a decision

1. **The shared folder path.** Updates and fleet health both need one location
   every Mac can reach — a file server path, or a Dropbox/Drive folder (works
   off-network; recommended). Until it's set, updates go by email and no Mac
   reports in. `configure --channel <path>` or bake it in with
   `package-for-tester.sh --channel <path>`.
2. **Ashley's Mac needs `configure --round-minutes 15`** — installs made from
   the old example config are on 5-minute blocks, and updates replace code, not
   config.
3. **Adobe apps prompting for the server on launch, studio-wide.** Ruled out as
   tracker-related: it is a per-user install on one Mac with no server
   component. Likely an aliased font folder, CC linked assets, recent-file
   lists, or lapsed SMB credentials. `scripts/is-it-installed.command` checks.

## Running it

```bash
cd mac-time-tracker/daemon
npx tsc --noEmit                                    # typecheck
node --test --experimental-strip-types "test/*.test.ts"
node scripts/evaluate.ts                            # matcher accuracy
npm run build-preview                               # clickable UI preview

../scripts/install.sh                               # install (macOS)
../scripts/package-for-tester.sh ~/Desktop          # zip for a teammate
../scripts/stage-release.sh /path/to/share          # publish an update
```

Everyday commands once installed, via
`~/Library/Application Support/MBDTimeTracker/tracker`:
`report`, `doctor`, `probe`, `fleet`, `configure`, `rebuild`, `push`.

## Where the important code is

| File | What |
|---|---|
| `daemon/src/matcher.ts` | Scoring and weights. `LOW_CONFIDENCE = 0.45` |
| `daemon/src/segmenter.ts` | Snapshots → blocks → entries; merge and rounding |
| `daemon/src/text.ts` | Tokenising and the IDF-weighted similarity |
| `daemon/src/ui.ts` | The whole review UI, as one template literal |
| `daemon/src/clickup.ts` | The entire ClickUp surface |
| `observer-script/MBDTimeTracker.js` | The JXA observer compiled to an .app |
| `daemon/test/real-cases.ts` | The 28 evaluation cases |

⚠️ `ui.ts` is one giant template literal, so TypeScript checks none of the
JavaScript inside it and escape sequences get eaten on the way out.
`test/ui.test.ts` parses what actually ships — keep it.
