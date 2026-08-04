# MBD Slack Operating System

*How we run Slack so work doesn't fall through the cracks. Built on the Pip Decks rules in `01-pipdecks-foundations.md` and grounded in the Aug 2026 comms audit (`04-findings/`). Principle: keep what already works — the daily priorities post, the retainer traffic-lights, the emoji protocol — and close the four gaps the audit found: fragmented feedback, tribal sent/approved state, verbal briefs, and everything routing through one person.*

## Keep (already working — now official)

- **Yami's daily priorities post** (~08:30, per-person bullets, hour budgets, deadlines). This is the backbone. Codify the format so anyone — Dom, Chi — can post it identically when Yami is off. The post is a *role*, not a person.
- **Weekly retainer traffic-lights** (🔴 over / 🟠 close / 🟡 behind). Keep weekly, same day each week.
- **Emoji protocol**: 👀 seen/looking · 📤 sent to client · ✅ done · 🆗 client approved · 🔴/🧨 urgent. Add it to the pinned canvas so new starters learn it day one.
- **"Ready for Chi" QA gate** before anything goes to a client.
- **One channel per client.** Keep — but see thread rules below.

## The five message rules

1. **Name one owner.** Every request @mentions a single person. "Can anyone help?" and "first designer in" assign work to nobody — if you're tempted to write it, pick a name (the priorities post tells you who has capacity). If Yami is off, the day's poster owns routing.
2. **Every ask carries a when.** Date + time + timezone ("EOD Thu ACST"). Received a client deadline? Post it verbatim, then the *internal* deadline (client time minus QA buffer).
3. **One thread per deliverable-version.** The version post ("SC Brochure V2 — [link]") is top-level; ALL feedback, questions and fixes for that version go in its thread. This is the single biggest fix from the audit: feedback currently scatters across Slack drips, Figma, GSlides, PDFs and in-person chats. Feedback given in any other surface (Figma, PDF, phone, hallway) gets one summary line dropped into the version thread by whoever received it — the thread is the index, even when the detail lives elsewhere.
4. **Files get names, links get context.** `Client_Project_Deliverable_V2.pdf` — a new job is a new filename, not a higher V number. When a file matters, post the Slack upload or Drive link *and* the NAS path (smb:// is dead on mobile and off-network — never the only link).
5. **Close the loop in writing.** 📤 with a line ("V2 went to Mitchell 3:40pm") when work ships; 🆗 with the quote when a client approves. Verbal briefs and in-person feedback get a 3-line written recap in the channel same day — "brief in meeting" with no follow-up post is not a brief.

## Per-client pinned canvas (new)

One pinned canvas per client channel, three sections, maintained by whoever posts the update:
1. **Live jobs** — job / stage (brief → concept → V1 → revisions round _/_ → final → 📤 → 🆗) / owner / next date.
2. **Decision log** — one dated line per decision ("Jun 12 — client locked green palette V3"). Ends the scroll-back archaeology.
3. **Links** — brief doc, Drive folder, NAS path, Figma. One place, all surfaces.

This canvas is also the **sent/approved log** — the answer to "not sure if this went off?" is the canvas, not memory.

## Urgency triage (new)

Same-hour client asks ("need it in 45 min") are sometimes real, but ASAP-by-default burns quality and people. When an urgent ask lands, the receiver posts: **what's actually due when, what it bumps** ("Doing the Fuji fix now → Aurizn tiles slip to tomorrow — ok?"). Dom/Yami confirm the trade in one line. Urgent still means phone/DM + channel message — a channel post alone is not "I told them".

## Weekly rhythm

| When | What | Who |
|---|---|---|
| Daily ~08:30 | Priorities post (codified format — `03-templates/weekly-status.md`) | Yami, or the day's poster |
| Same day weekly | Retainer traffic-lights | Yami |
| Fri 4:00 | Ship/slip: what went 📤/🆗, what slipped + new date, what clients are waiting on (nothing silently crosses a weekend) | poster |
| Monthly, 30 min | Sailboat retro — wind/anchor/rocks; institutionalise ONE improvement (the team already invents fixes — emoji protocol, folder standard; the retro is where they become permanent) | all, Dom facilitates |

## Escalation defaults

- Blocked or unanswered >1 business day → re-ask naming a person and a time; >2 days → escalate to Dom/Yami. Chasing by punctuation ("@design???") means routing failed — fix the owner, not the volume.
- Client silent on approval >3 business days → chase with the consequence stated ("to hold the print date we need sign-off by Thu").
- Yami off → the day's poster inherits routing + chasing explicitly, named in the priorities post.
