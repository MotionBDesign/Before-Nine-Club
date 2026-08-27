# MBD Dashboard — Today Tab: knowledge file

Handover document for the MBD Dashboard project. Everything below is either
verified against live data (marked **verified**) or an explicit design decision.
Written 26 August 2026.

---

## 1. The system as it stands

| | |
|---|---|
| `10.0.0.87:3100` | Main dashboard. Retainer Pace Race, the rocket, project days lines, Months tab, Team tab (U/I/L KPI chips). |
| `10.0.0.87:3200` | Trial build. Today tab, Job's brief tab, Open Loops, Meetings, Bonus tab. |
| Data source | ClickUp workspace `9003163669`. |
| Rollout intent | Prove function on `:3200` first, then port to `:3100`. Do not build directly on `:3100`. |

The **Bonus tab** is a tab inside the same app, not a separate tool. It is the
internal benchmark for legibility — the components, theme and data layer already
exist, so Today does not need a new visual language invented for it.

---

## 2. The people

**Producers / accounts** (they dish out work): Yamileth (Yami), Andrea Kurian, Dom Legg.
**Production** (they make the work): Kavindu Madushan (motion), Sergio Rodriguez (design),
Rochelle Tuladhar (design), Amal Zakaria (design), Ashley Pollard (design), Elle (copy).
Plus a `@Designers` Slack group.

**Active clients:** Resmed (+ Resmed B2B2C), SAPN, Maptek, Aurizn, Ilim College,
Symons Clark, Cole School Experts, AOL, Subnet, 48hr Film Project, CMAX, Fujifilm.
Several more are marked Inactive in ClickUp.

---

## 3. Ground truth from ClickUp — **verified 26 Aug 2026**

These were read from live tasks, not assumed. They should override any guess.

- **A day is 6.5 hours.** Not 8. From the workspace's own formula:
  `Days Tracked = Hours Tracked / 6.5`.
- **Rates in use:** `$817` per day, `$135` per hour (both in custom-field formulas).
- **Statuses:** `pipeline`, `to do`, `in progress`, `feedback alterations`,
  `with the client`, `complete`, `complete to be invoiced`.
  Note that `with the client` and `feedback alterations` are **waiting** states —
  work sits on a person's name but consumes none of their day. Counting them as
  load makes every plate look full.
- **Work TYPE field:** `Retainer` / `Quoted` / `Non Billable` / `Sponsored`.
- **TIME HEALTH formula already exists**, with four states:
  `🟢 On Track` (<70% of estimate) → `🟠 Close to Short Time` (70–80%) →
  `🟡 Time for Review` (80–100%) → `🔴 Overtime` (>100%).
  **The UI should reuse these four words** so the board agrees with the reports.
- **REV. ROUNDS field** carries the real production stages: Moodboard, Script v1–3,
  Styleframing V1–2, Storyboarding V1–6, Animation V1–6, Edit v1–3, Draft 1.
- Time tracking is real and used — estimates and tracked time are both populated.

### Gaps found (these constrain the build)

- **Tasks carry no attachments and empty descriptions.** Thumbnails cannot come
  from ClickUp. Realistic sources are the Google Drive job folders and the studio
  share (`MBD/homes/admin/Clients/…`). Drive exposes thumbnails via its API; the
  share needs a small watcher on the newest file in a job folder.
- **Most tasks have no assignee and no due date.** Allocation is happening in
  Slack and never landing in ClickUp. This is the single most important finding:
  the Dish out screen is not a nicer surface for an existing process, it is the
  mechanism that finally *captures* allocation.

---

## 4. How work actually flows today (the process being replaced)

1. Briefs arrive as **Slack messages in client channels** (e.g. #resmed, #maptek-motionbydesign).
2. Yami reads them, decides a budget in **hours** ("Copy — 2 to 3 hrs including revs.
   Design — 4 hr"), and splits the job into **steps with different owners**
   ("Copy @Elle, then Design in Figma @Designers once copy is done").
3. Each afternoon Yami posts **"Tomorrow's list"** to `#motion-by-design`, grouped by
   person, with priorities in plain English ("Cmax - priority for now",
   "to go off before Friday", "if there is more feedback").
4. ClickUp gets updated inconsistently — statuses sometimes, assignees rarely.

**The Today tab is competing with step 3, not with `:3100`.** To win it has to be
faster to *write* than that Slack post and easier to *read* than it.

---

## 5. Open feedback and known bugs

Raised by Yami in the dashboard chat, 24–26 August:

| Priority | Item |
|---|---|
| **1 — blocking** | Allocation and status changes made on the dashboard **do not write back to ClickUp**. Tested with "Aurizn - Infinite Studio Post": moved out of pipeline onto Sergio, ClickUp still shows pipeline and unassigned. A board that silently lies is worse than no board. |
| 2 | "With the client" day counts appear to include weekend days. |
| 3 | Job's brief tab — task names should follow `Client - Project` naming convention. |
| 4 | Budgets must be expressed in **hours**, to match ClickUp. "Otherwise we are not speaking on the same variables." |
| 5 | Show the full task name (allow two lines) plus the ClickUp route, so a subtask is distinguishable from a main task. |
| 6 | Add the ClickUp link to task names in the morning job selection lists. |

---

## 6. The Today tab — scope

**Purpose:** a morning page. Someone opens it, finds out what they have to do,
and closes it. It is **not** a replacement for the Projects tab or the Retainers tab.

**The test for anything proposed for this tab:** would someone do something
different today because they saw it? If not, it belongs on Projects or Retainers.

**Deliberately excluded:** retainer burn and pace, the months view, full project
detail (task trees, dependencies, file lists, history), and anything below
threshold (clients waiting under two days, work due beyond this week).

---

## 7. The model — Today splits into four views

### Accounts — the client boundary
For Yami, Andrea, Dom. Reads left to right as a flow:

`New in — to brief` → `Needs review` → `Ready to go off` → `With the client`

Each column ends in a verb: brief it, review it, send it, chase it. Days-waiting
is computed from the last client touch, so bumps surface themselves rather than
living in someone's head.

> **Note:** `Ready to go off` (approved internally, not yet sent) does not exist
> as a ClickUp status today. It needs adding, or inferring.

### Production — inside the studio
For the makers. Reads top to bottom by urgency:

`Fresh feedback in` → `My day` → `Rest of the week`

Fresh client feedback sits *above* the day and carries **the client's actual
words on the card**, so nobody opens ClickUp to find out what changed. Own load
shown as a ring against 6.5h, with a one-click "ask Yami to move one".

### Dish out — allocation
Two modes:
- **Board** — the unplaced pile against live per-person capacity, sorted most-free
  first. Capacity updates while a card is being dragged, so overload is visible
  *before* the drop.
- **Assign run** — one job at a time filling the screen, team as one-tap targets,
  `1`–`9` to pick, `⏎` to place and advance. Supports splitting a job into steps
  with a per-step owner and hour budget, mirroring how Yami already briefs.

### Day plan — the hand-off
The last thing Yami touches before going home, and the piece that was originally
missing. Placing a job on a person is not the same as telling them what to do.

- Order each person's day (drag).
- **Star one must-do per person** — the single thing that has to happen if the
  day goes sideways. Not five priorities.
- Add **a free-text note per person**, in Yami's voice — "CMAX is the priority",
  "Do not send until Dom and I have talked". This instruction is the real content
  of the hand-off and no status field can carry it.
- **Publish** does three things: writes assignee, hours and status to ClickUp;
  fills each person's Production tab in that order with the star and the note;
  and drafts the 4:30pm Slack post to `#motion-by-design`.

---

## 8. Design principles

1. **Colour means state, never identity.** Twelve clients do not get twelve
   colours. Clients are identified by their artwork and a neutral text chip.
   Colour is reserved for over / stale / waiting / on track.
2. **Colour always ships with a word.** Every state is a pill: dot *and* label.
   Survives colour-blindness, projection and print.
3. **Imagery frees colour.** Showing a thumbnail of the actual deliverable
   identifies the client faster than any swatch, which is what lets colour stay
   reserved for state. Falls back to a generated placeholder when no image exists —
   imagery is an enhancement, never a dependency. Minimum useful thumbnail is ~44px.
4. **Separate booked from parked.** Waiting states shown as a hatched segment
   outside the solid fill, so real free capacity stays honest.
5. **Hours and days in the units the business uses** — hours for budgets (matching
   ClickUp), days for capacity, 6.5h = 1 day.
6. **Always draw the target line.** A bar alone is a number; a bar with a target
   tick is a verdict.
7. **Sort order is the answer.** Most-free person at the top of the allocation list.
8. **Every write shows its receipt.** Optimistic, then confirmed against ClickUp,
   with a visible failure lane and retry. Roll back on failure — never keep a
   change that did not save.
9. **Notifications are a queue to empty, not a stream to watch.** Four tiers, and
   only tier 1 (a client is blocked on us) may interrupt.
10. **Lead with a sentence.** Every screen opens in plain English —
    "Two clients are waiting on us." Numbers support it underneath.
11. **The empty state is the instruction manual.** "Nothing needs you. 6 jobs land
    tomorrow" beats a shrugging illustration.

**Visual language:** one friendly sans at weight 650–800 for anything that
matters, negative tracking on large numbers, generous padding, tonal elevation
over heavy shadow (Material 3), Apple-style rings for capacity and the three
studio KPIs, translucent material used once where it earns its place.

---

## 9. Build order

1. **Make the writes land, and show the receipt.** Nothing else matters until a
   drag reaches ClickUp and says so. Yami has already found the failing case.
2. **Capacity rail above the fold.** Six rows, sorted most-free first, hatched
   segments for waiting work. Highest value per pixel in the app.
3. **The allocation board and assign run.** The pair that retires the Slack post.
4. **The day plan and publish.** Turns allocation into a briefed day.
5. **Attention queue and aged open loops.** Then turn the ClickUp → Slack firehose
   down to tier 1 only.
6. **The ten-day capacity heat grid.** Moves from reacting to today into seeing
   the cliff — a sales instrument more than a studio one.
7. **The wall display.** Cheap once the data model exists.
8. **Slow-burn views:** fairness strip, promise strip, day timeline.

---

## 10. Open decisions

1. **Does Today plan *today* or *tomorrow*?** Yami's Slack post is written in the
   afternoon for the next day, so the real planning horizon is tomorrow — but the
   tab is called Today. Pick one and name the tab after it. Trying to be both is
   the most likely reason a good build still gets ignored.
2. **Add a `Ready to go off` status to ClickUp, or infer it?**
3. **What is the bump threshold, per client?** Currently drafted at 3 days to
   amber, 7 to red. Resmed answer in hours; Ilim in weeks.
4. **Where do "new in" cards come from?** Briefs arrive as Slack messages. Without
   something converting those, Yami still creates cards by hand.
5. **Is Production personalised per person, or one shared floor board?**
   Personalised is better for the team, worse for Yami — she may want both.
6. **Thumbnail source:** Google Drive API, or a watcher on the studio share?

---

## 11. Reference links

- **Today board spec** (Accounts, Production, Dish out, Day plan) —
  https://claude.ai/code/artifact/166da4be-aee2-455a-b49d-cc60e33c799c
- **Visual direction** (design language, imagery, rings, materials) —
  https://claude.ai/code/artifact/582accbc-e7d1-4fa7-8f4e-84741bc675d5
- **Original research** (11 concepts, notification model, reference wall) —
  https://claude.ai/code/artifact/04ae9b4b-4237-4298-a634-090b8b61d402

> Artifacts are private by default. Share each from its own share menu before
> sending the links to anyone else.

Source files also committed to `MotionBDesign/Before-Nine-Club` on branch
`claude/3200-dashboard-ux-research-e7ns16`, under `docs/dashboard-research/`.
