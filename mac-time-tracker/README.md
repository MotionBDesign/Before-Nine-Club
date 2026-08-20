# Time tracker

Watches what you actually work on during the day, proposes a timesheet against
real ClickUp tasks, and writes only the entries you approve.

Nothing reaches ClickUp without you saying so.

```
                                        (own launch agent, so macOS gives
   ┌──────────────┐                      *it* the Accessibility permission)
   │  BNObserver  │  frontmost app, window title,
   │    (Swift)   │  open document path, browser URL, idle time
   └──────┬───────┘
          │  appends NDJSON
          ▼
   observer.ndjson  ──tailed by──▶  ┌──────────────────┐
                                    │  daemon (Node)   │
                                    │  segment → match │
                                    │  → propose       │
                                    └───────┬──────────┘
                                            │
                              ┌─────────────┴─────────────┐
                              ▼                           ▼
                    http://127.0.0.1:7878         ClickUp time entries
                    review & approve               (approved only)
```

## What it does with what it sees

Every five seconds the observer records the frontmost app, the focused window
title, the open document's file path, and — in browsers — the current URL.
The daemon turns that stream into blocks of work and then tries to name each
one, in this order:

1. **A ClickUp task you had open.** A task URL in the browser is taken at face
   value. So is a task id written into a filename.
2. **The job folder on your server.** `…/Clients/SAPN/2026/Artwork/poster.psd`
   resolves to the `SAPN` folder in ClickUp. Configured project roots are
   preferred; failing that, any path segment matching a ClickUp folder or list
   name counts.
3. **The filename against task names.** Within the client's lists, the file and
   window title are scored against task names, weighting rare words heavily —
   `PowerlineSafety_Poster_A2_v3.psd` picks *Powerline Safety poster series*
   over *Summer bushfire EDM*.
4. **What you told it last time.** Every correction you make is remembered
   against that file's directory, so the next file in the same job folder is
   suggested correctly without you writing a rule.

Each proposal shows its confidence and its reasoning, so a wrong guess is
obvious rather than silent.

Idle time (no keyboard or mouse past a threshold) and locked-screen time are
never counted. Short detours — a 30-second glance at Slack — are folded back
into the block around them rather than becoming their own line.

## Requirements

- macOS 13 or newer
- Node 22.18+ (`brew install node`) — the daemon runs TypeScript directly, no build step
- Xcode command line tools (`xcode-select --install`) for the Swift observer
- A ClickUp personal API token (ClickUp → Settings → Apps → API Token)

No npm dependencies at runtime. `@types/node` and `typescript` are dev-only.

## Try it before installing anything

```bash
cd daemon
npm install          # dev types only
npm run demo         # seeds a fake day, opens the review UI on :7879
```

That runs entirely offline against fixture data in a temp directory. Ctrl-C
removes it.

## Install

```bash
./scripts/install.sh
```

It builds the observer, sets up `~/Library/Application Support/MBDTimeTracker`,
stores your ClickUp token in the login keychain, caches your workspace, and
loads two launch agents so tracking starts at login.

### The one manual step

macOS will not hand over window titles or file paths until you grant
Accessibility permission:

**System Settings → Privacy & Security → Accessibility**, then `+` and add:

```
<repo>/observer/.build/release/BNObserver
```

(Cmd-Shift-G in the file picker lets you paste that path.) Then:

```bash
launchctl kickstart -k gui/$UID/com.motionbydesign.timetracker.observer
```

This is why the observer is its own launch agent rather than a child of the
daemon: macOS attributes the permission to whichever process launchd started,
so a spawned observer would mean granting Accessibility to your entire Node
install instead.

Without the permission the tracker still runs — it just only knows which app is
in front, which is not enough for the matching to be useful.

## Daily use

```
open http://127.0.0.1:7878/                 review, adjust, approve, push
node daemon/src/cli.ts report [YYYY-MM-DD]  the same thing in the terminal
node daemon/src/cli.ts doctor               check config, token, permissions
node daemon/src/cli.ts catalog              re-cache ClickUp tasks
node daemon/src/cli.ts push [YYYY-MM-DD]    push approved entries
./scripts/install.sh --uninstall            stop tracking (keeps your data)
```

You get a notification at 1pm and 5pm if there is unreviewed time; change that
with `review.notifyHours`.

In the review UI: edit the minutes, retype the description, search for a
different task, toggle billable, then **Approve**. **Push approved to ClickUp**
writes them. Approved and pushed entries are frozen — later rebuilds cannot
undo them.

## Configuration

`~/Library/Application Support/MBDTimeTracker/config.json`, seeded from
`config/config.example.json`.

The settings worth revisiting:

| Key | Why you'd change it |
| --- | --- |
| `projectRoots` | Where client job folders live, and which path segment names the client. This is what makes server-structure matching work. |
| `clientAliases` | When the folder name on disk differs from the ClickUp folder name. |
| `capture.idleThresholdSeconds` | How long away from the keyboard stops counting (default 3 min). |
| `capture.roundToMinutes` | Rounding for pushed entries (default 5). |
| `capture.minBlockSeconds` | How short a stretch counts as its own piece of work (default 60s). |
| `ignore` | Apps, window titles and paths to never record at all. |
| `privacy.retainRawSnapshotDays` | How long raw activity is kept (default 30 days). |

### Browser URLs

`observer.browserUrls` decides how the address of the current tab is read:

| Mode | Reliability | Prompts | Private windows |
| --- | --- | --- | --- |
| `accessibility` (default) | Good in Safari, patchy in Chromium | None beyond Accessibility | Not detected |
| `appleScript` | Reliable across Chrome, Edge, Brave, Arc, Vivaldi, Opera, Safari | One macOS Automation prompt per browser | Incognito windows are recorded as nothing at all |
| `off` | — | None | n/a |

Switch to `appleScript` if ClickUp tabs aren't being picked up, or if you want
the incognito guarantee. Firefox exposes its URL to neither mechanism.

### Rules

`rules.json` (from `config/rules.example.json`) narrows or pins the match.
A rule fires only when **every** clause it declares matches:

```json
{
  "name": "Client folder on the server",
  "when": { "pathRegex": "/Clients/(?<client>[^/]+)/" },
  "then": { "folderFrom": "client" },
  "weight": 65
}
```

`when` accepts `bundleId`, `appRegex`, `titleRegex`, `pathRegex`,
`pathContains`, `urlRegex`. `then` accepts `taskId`, `taskIdFrom`, `folder`,
`folderFrom`, `list`, `space`. Add `"billable": false` to force non-billable, or
`"ignore": true` to drop the activity entirely.

Weights are on a scale where 100 means certain; the ordering in the example file
is a reasonable starting point. A leading `(?i)` works even though JavaScript
regexes don't support it — it's translated for you.

## Privacy

Everything stays on your Mac apart from the time entries you approve.

- Raw activity lives in `~/Library/Application Support/MBDTimeTracker/days/`,
  owner-readable only, pruned after `retainRawSnapshotDays`.
- URL query strings are stripped by default (`privacy.redactUrlQuery`).
- `privacy.recordTitles` / `recordUrls` turn those fields off entirely.
- `ignore.bundleIds` and `ignore.titlePatterns` skip apps and windows before
  anything is written — password managers are excluded out of the box.
- The review server binds to loopback and rejects any request whose `Host` or
  `Origin` is not loopback.
- The ClickUp token lives in your login keychain, not in a config file.

The observer makes no network calls at all.

## Development

```bash
cd daemon
npm test          # 70 tests, no network, no ClickUp account needed
npm run typecheck
npm run demo
```

Set `MBD_TT_HOME` to point the whole thing at a scratch directory.

To run without launch agents, set `observer.mode` to `"spawn"` and run
`npm start` — but note the Accessibility permission then belongs to the process
that started the daemon (your terminal), not to `BNObserver`.

### Layout

```
observer/   Swift. Samples the frontmost app. No network, no disk beyond the spool.
daemon/     TypeScript. Everything else.
  src/spool.ts      tails the observer's output
  src/segmenter.ts  snapshots → blocks → proposed entries
  src/matcher.ts    which ClickUp task does this belong to
  src/sync.ts       ClickUp catalog and time-entry push
  src/server.ts     the local review API
config/     Example config and rules
scripts/    Installer and launch agent templates
```

## Prior art

Worth knowing what already exists before extending this.

**Commercial, and closer to this than anything open source:**

- [Rize](https://rize.io) — automatic tracking with a native ClickUp
  integration that suggests client/project/task per entry and learns from
  keywords you teach it. The nearest thing to what this does. Activity data
  goes to their cloud. From $23.99/user/month (Pro, annual); $29.99/seat/month
  for teams.
- [Memtime](https://www.memtime.com) — captures apps, documents and file names
  entirely offline, mirrors your ClickUp projects and tasks, and you assemble
  entries from a timeline. Local-first like this tool, but the mapping is
  manual rather than inferred. From about $12/user/month.
- [Timing](https://timingapp.com) — strong Mac-native automatic tracking, local
  data, no ClickUp push.

If a subscription is acceptable, Rize covers most of this today. This tool
exists because of the parts it doesn't: matching against your own server folder
structure, rules you control, and nothing leaving the machine.

**Open source, all of it manual:** `gwleuverink/clickup-time-tracker` (archived,
Electron calendar UI), `delta-proc/clickup-time-tracker`,
`SferaDev/clickup-time-tracking`. All are hand-entry front ends over the
ClickUp API — none observe activity, so none help with the hard part.

**Techniques borrowed:**

- [ActivityWatch](https://github.com/ActivityWatch/aw-watcher-window) (MPL-2.0)
  reads titles via `kAXTitleAttribute`, same as here — which confirms
  Screen Recording permission is not needed. Its incognito check is the basis
  for the private-window guard in `BrowserURL.swift`. Its watcher records app
  and title only, with no document path, and has no ClickUp integration.
- [sindresorhus/get-windows](https://github.com/sindresorhus/get-windows) (MIT)
  supplied the browser bundle-identifier coverage in `BrowserURL.swift`. Note
  it reads titles from `CGWindowListCopyWindowInfo`, which *does* require
  Screen Recording permission — a second, scarier prompt this tool avoids.

Neither exposes the open document's file path, which is the signal most of the
matching here depends on.

## Known limitations

- Apps that don't publish `AXDocument` (some Electron apps, Figma desktop) give
  a window title but no file path, so matching leans on the title. `AXDocument`
  is also unreliable for tabbed or hidden full-screen windows.
- Firefox exposes its URL to neither the Accessibility API nor AppleScript, so
  browser matching there falls back to the window title.
- Safari offers no way to detect a private window, so the incognito guard
  covers Chromium browsers only. Exclude Safari private browsing with an
  `ignore.titlePatterns` entry if that matters.
- Sampling is a fixed 5-second poll. ActivityWatch additionally subscribes to
  `AXObserver` focus-change notifications for instant boundaries; at 5-minute
  rounding that difference is not worth the extra moving parts here.
- The Swift observer has not been run on a Mac yet — it was written and reviewed
  but not compiled, since the machine it was built on is Linux. Expect the first
  `swift build` to be where any typos surface.
- Live ClickUp timers are not started or stopped; entries are written after the
  fact, once approved.
