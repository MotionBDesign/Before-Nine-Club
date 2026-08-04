# Performance, Culture & KPIs

*Companion to the findings report. What to measure, how to build the culture that hits it, and how it maps to what MBD already tracks. August 2026.*

## What you track today (and what it misses)

| Where | What | Gap |
|---|---|---|
| ClickUp | Timesheets (chased weekly, GIF-nagging is a running gag) | Compliance is manual; data arrives too late to steer the week |
| Slack (manual) | Retainer traffic-lights 🔴🟠🟡, per-task hour caps | Hand-compiled by Yami — accurate but fragile and unqueryable |
| Slack To-do List | Task states | No cycle times, no revision counts, no delivery record |
| Before Nine Club portal (localhost) | Members total/active/paused, upcoming events, RSVPs | No revenue (MRR), churn %, pause→cancel conversion, attendance rate, or activation — the stats are counts, not health |

The pattern: **effort is tracked, outcomes aren't.** Hours are visible; whether jobs shipped on time, in how many rounds, and error-free is nowhere. The audit's incidents (four client-caught missed-edit rounds, deadline-morning approvals) are invisible to every current metric.

## The agency scorecard — eight numbers, monthly

Pick few, wire them into rituals that already exist (daily post, Friday ship, retainer summary), review at the monthly retro. Everything below is derivable from the comms system just installed — no new software required to start.

**Delivery quality**
1. **Revision rounds per job** (target: ≤2). Counted from the feedback-round template. The single best proxy for brief quality — a 3+ round job means the brief or the playback failed, and it's the retro's first agenda item.
2. **Client-caught misses** (target: 0/month). Any time a client points out an edit we said was done, a wrong link, a lost file. Log one line in the channel when it happens (blame-free — it's a system metric, not a person metric). This number is currently ~4-6/month and nobody sees it.
3. **On-time rate vs first promised date** (target: ≥90%). Only countable if dates are declared — which move #5 (declare dates) makes true. The canvas's 📤 dates are the record.

**Flow**
4. **Same-day acknowledge rate** on client requests (target: 100%). A 👀 reaction or one-line reply counts. Kills the 10-day-silence class of incident.
5. **Time in "waiting on client"** per job. The canvas tracks since-when; anything >3 days triggers the chase rule. Makes the invisible half of every timeline visible — and defensible when clients ask why a job slipped.

**Commercial**
6. **Retainer utilisation** — formalise the traffic-lights from ClickUp data instead of hand-compiling: hours logged ÷ retainer hours, per client, auto-pulled weekly. Same number Yami already produces, minus the manual labour.
7. **Scoped-before-started %** (target: 100%). Jobs with written deliverable/rounds/cost/date before work began. The Quad Chart pattern, counted.

**Team**
8. **Timesheet completeness by Friday 4pm** (target: 100%). It's the input to #6 — tie it to the Friday ship post ("ship post isn't done until timesheet is") and retire the GIF-nagging. Five minutes at day's end beats reconstruction on Friday.

**Explicitly not KPIs:** individual speed, messages answered after hours, hours worked. The audit shows tempo is already excellent; measuring it invites burnout in a team that already accepts 45-minute deadlines. Measure the *system* (rounds, misses, waiting time), not the people.

## Before Nine Club dashboard — add outcomes to the counts

The admin dashboard shows member counts and event lists. Four additions turn it into a health monitor:
- **MRR + movement** (new / churned / paused $) — from Stripe data already flowing through the webhook.
- **Churn % and pause→cancel conversion** — a pause is a churn early-warning; today it's just an amber number.
- **RSVP rate and attendance per event** (RSVPs exist in the schema; surface yes-rate and show-rate) — the leading indicator of engagement before churn shows up.
- **Activation**: % of new members who RSVP to an event in their first 30 days.

## Culture & teamwork — build on what's real

The audit found genuine psychological safety, fast blame-free cover for sick teammates, and a team that invents its own fixes. These suggestions bank that, rather than importing corporate ritual.

1. **De-risk the Yami bottleneck — deliberately.** Routing, chasing, QA and client relay all run through one person, and the system visibly degrades on her sick days. Fixes: the codified daily-post format (anyone can run the morning), the canvas as shared state, and a named "day's poster" who inherits routing when she's off. Frame it as protecting Yami, because it is — the current setup means she can never actually be off.
2. **Blame-free 15-minute incident reviews.** Wrong-link-twice, the print-file swap, the lost quote — each is a systems lesson worth 15 minutes of "what made this possible?" (not "who did it?"). One per month at the retro is enough. The team's safety culture makes this cheap; most agencies can't run these at all.
3. **Make the trade visible on urgent work.** Everything-ASAP is the biggest quiet culture risk in the audit — same-hour asks accepted by default, sickness announcements ~2×/week. The urgency triage rule ("doing X now → Y slips, ok?") turns heroics into decisions, and gives Dom the data to start saying no or charging rush rates.
4. **Weekly 30-minute crit, separate from QA.** "Ready for Chi" catches errors; a crit grows craft. One piece of work, Rose/Thorn/Bud, rotating presenter. This is also where Sergio-class onboarding gaps (folder duplication, naming) close without being corrections.
5. **Shout-outs with receipts.** Client praise already arrives ("Truly one of my proudest pieces of work") and gets a quick emoji. Log it: a #wins channel or a section in the Friday post. It compounds — morale, case-study material, and evidence at review time.
6. **Capacity flag as a norm, not a confession.** The Monday post's green/tight/overloaded flag only works if "overloaded" is answered with "what moves?" rather than sympathy. Dom models it once and it sticks.
7. **The retro is the ratchet.** The team already generates improvements bottom-up (emoji protocol, folder standard, process stages draft). The monthly Sailboat retro's only job is to pick ONE and make it permanent. Twelve institutionalised improvements a year is transformation at zero cost.

## Rollout of measurement (keep it manual first)

- **Month 1:** count only #2 (client-caught misses) and #1 (rounds per job) — a tally in the retro doc. Manual, honest, revealing.
- **Month 2:** add declared-date tracking via the canvas (#3, #4, #5).
- **Month 3:** automate retainer utilisation from ClickUp (#6) and retire the hand-compiled summary; add the portal dashboard metrics.
- **Only then** consider a real dashboard — by which point you'll know which numbers you actually look at.
