# MBD Communication Review — Findings & Recommendations

*Synthesis of the Slack audit (May–Aug 2026) and client email audit (Jun–Aug 2026), benchmarked against Pip Decks principles (see `01-pipdecks-foundations.md`). August 2026.*

## The headline

MBD communicates with **speed, warmth and unusual money-transparency** — clients praise turnaround unprompted, keep expanding scope, and the team invents its own process fixes (emoji protocol, "Ready for Chi" gate, folder standards). Those are strengths most agencies this size never build.

But the system runs on **memory and one person's manual relay**. Briefs arrive as pasted emails or "brief in meeting"; feedback fragments across five surfaces; nobody writes down what changed, what shipped, or what was approved. The result, visible in one month of evidence: **four client-caught missed-edit rounds, a 10-day unsent reply, two wrong links, a lost quote, and a print file swapped overnight at the printer.** Client goodwill is currently the QA function and the safety net — that's an asset being spent, not banked.

In Pip Decks terms: the team is brilliant at **tempo** and weak at **playback** — the tactics that close loops (Playback, Who/What/When, decision logs) are exactly the ones missing.

## What you're doing well (keep, and make official)

| Strength | Evidence | Pip Decks lens |
|---|---|---|
| Daily priorities post with hour budgets + deadlines | Yami, every workday ~08:30 | Priority Map, done daily — rare discipline |
| Retainer traffic-light transparency | Weekly 🔴🟠🟡 summaries; "1 hr max" task caps | Commercial constraints visible to makers |
| Turnaround speed clients notice | ADSTAR invite: 4 versions in 24h; same-hour TVC fix | Tempo is a genuine differentiator |
| Clarifying before executing (often) | AS10/AirMini catch; "remove or move lower?"; audio-feed flag | Playback — when it happens, it works |
| Staged approval gates | script → storyboard → animation; styleframes first | Bounded rounds |
| Template-first mindset (Andrea) | "REUSE existing template pls"; event-tile systems | Convert one-offs into systems |
| Internal QA gate (Yami/Chi) | "Ready for Chi" status; brand/colour checks | Critique before client |
| Self-correcting culture, high psychological safety | Emoji protocol, Slack List, folder proposal — all bottom-up | The retro instinct exists; it just isn't scheduled |
| Commercial sharpness (Dom) | Budget-first scoping; unused-scope flags; interim quote updates | Guide, not vendor |

## What to fix — seven moves, in priority order

### 1. Delivery Playback — the single highest-ROI change
Every delivery (email or Slack) carries a numbered **"Changes made: 1/2/3"** list mirroring the feedback received, plus what was *not* done and why. Four missed-edit rounds in a month happened because nobody plays back edits against the list; the client re-checks everything. This is one paragraph per delivery and it converts the client from QA-inspector to approver. *(Pip Decks: Playback.)*

### 2. One thread per version — end feedback fragmentation
The version post is top-level; **all** feedback for that version lives in its thread. Feedback arriving via Figma/GSlides/PDF/phone/in-person gets a one-line pointer dropped in the thread by whoever received it. The thread is the index. Kills "don't know what AOL feedback Yami is referring to" and "I think she gave feedback on the old version, but we're not sure." *(Template: `03-templates/feedback.md`.)*

### 3. The per-client pinned canvas — sent/approved log + decision log
Three sections: live jobs & stages, dated one-line decisions, links (Drive + NAS + Figma). Answers "did this go off?", "was it approved?", "what did we agree in June?" without scroll-back or memory. Also de-risks the Yami single-point-of-failure: anyone can read the state of play. *(Spec: `02-slack-operating-system.md`.)*

### 4. Written brief or it isn't briefed — especially from principals
"Brief in meeting" cost a full day of "is this what Dom wants?"; the Fuji urgent job ran on an email that never sent. Rule: verbal briefs get a 3-line recap in the channel same day; anything bigger uses the brief template (5 minutes). The Aurizn client's briefs prove the value — their structured briefs sailed through; the drip-fed ones churned. *(Template: `03-templates/brief.md`; skill: `mbd-brief`.)*

### 5. Declare dates, verify delivery
Replace "soon / nearly there / end of week or sooner" with a date and time — set the deadline before the client does. And after sending anything that matters (links, quotes, print files): **verify it landed and opens** ("Can you confirm the link opens for you?"). The wrong-link-twice and lost-Xero-quote incidents were silent failures a one-line check would have caught. For print: "print-ready" becomes a gated state — internal pre-flight proof before the file goes to the printer.

### 6. Scope and money in writing at kickoff — every job
Dom's Law Society and CCA threads are the model (budget first, interim updates, line-item rationale). Make that the default for *all* jobs: even three lines — deliverable, rounds included, cost/hours, date — before work starts. The Quad Chart pattern (no quote, no ETA, approved the morning of the deadline) is the alternative.

### 7. Urgency triage + register calibration
- Same-hour asks get a visible trade: "Doing X now → Y slips to tomorrow, ok?" Everything-ASAP is a choice, and it's currently the default.
- Match register to the reader: "Heyaaa" and emoji-only replies are fine with long-standing contacts, not as the house default to C-suite and corporates. One pleasantry line, then the point. And run the 30-second proofread — typos ("breifed", "might of") are the cheapest credibility leak to fix.
- Never expose internal resourcing to clients ("waiting to hear from Jason about priorities") — internally it's honest; externally it reads "you're not the priority".

## Person-by-person, in one line each

- **Andrea**: best-in-team clarifying and playback on the way *in*; adopt Delivery Playback on the way *out* (three missed-edit rounds), and a same-day acknowledge rule so no brief sits 10 days.
- **Yami**: the operational engine and best chaser; declare dates instead of "soon", keep internal ops internal, calibrate the register, and let the canvas carry status so it survives her sick days.
- **Dom**: best commercial instincts and structure when deliberate; slow down 30 seconds per email — proofread, verify links, no bare forwards — and put every verbal brief in writing same day.

## The rollout (keep it boring)

1. **Week 1**: Dom announces the five message rules + Delivery Playback in #motion-by-design. Pin the canvas in the 3 busiest client channels (Aurizn, ResMed, Symons Clark) — don't boil all 40.
2. **Week 2–3**: PM starts using the brief + feedback templates on new jobs only. No retrofitting.
3. **Week 4**: first monthly Sailboat retro — review what stuck, institutionalise ONE more improvement (the team already generates them; the retro is the ratchet).
4. **Ongoing**: the Claude skills (`mbd-brief`, `mbd-feedback`, `mbd-client-email`) do the heavy lifting — paste a messy thread, get a structured brief/round/email back.

## What we could NOT assess

Kelsian/KBR/Pacific Aerospace had no substantive 2026 email in reach; the last ~3-4 weeks of some client channels were sampled via search only; and the PipDecks card library on the NAS wasn't reachable from this session — foundations were written from the published Pip Decks systems.
