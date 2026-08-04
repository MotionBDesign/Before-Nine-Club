# MBD Slack Operating System

*How we run Slack so work doesn't fall through the cracks. Built on the Pip Decks rules in `01-pipdecks-foundations.md`. (Refined against the Aug 2026 comms audit — see `04-findings/`.)*

## Channels

- **One channel per client** (existing pattern — keep). Everything about that client lives there.
- **#motion-by-design**: internal ops — weekly priorities, wins, process. Not a dumping ground for client tasks.
- **Pinned per client channel**: a canvas with ① current jobs + stage, ② decision log (one line per decision, dated), ③ latest-file links. The pin is the source of truth, not scrollback.

## The five message rules

1. **Name one owner.** Every request @mentions a single person. "Can anyone help?" assigns work to nobody — if you're tempted to write it, the PM picks the owner instead.
2. **Every ask carries a when.** Date + time + timezone. "EOD Thu ACST", not "when you can".
3. **Threads for work, channel for milestones.** Discussion of a version happens in that version's thread; the channel top-level is for briefs, versions shipped, decisions, deadlines.
4. **Files get names, links get context.** `Client_Project_Deliverable_V2.pdf` — never "(2).pdf" or "final-final". NAS `smb://` links don't work for everyone from everywhere: when a file matters, upload it to the channel or a shared drive *and* give the NAS path.
5. **Close the loop.** When a version ships or a decision lands, the thread ends with a ✅ message stating the outcome and the next who/what/when. React with 👀 when you've seen an ask, so silence is never ambiguous.

## Weekly rhythm

| When | What | Who |
|---|---|---|
| Mon 9:30 | Priorities post (template in `03-templates/weekly-status.md`) | everyone |
| Wed | Project pulse per active client | PM |
| Fri 4:00 | Ship/slip post | everyone |
| Monthly, 30 min | Sailboat retro — wind/anchor/rocks, fix one process thing | all, Dom facilitates |

## Escalation defaults

- Blocked >2 business days → escalate to Dom/Yami; don't re-wait.
- Client silent on approval >3 business days → PM chases with consequence stated ("to hold the print date we need sign-off by…").
- Urgent = phone/DM + channel message. A channel message alone is not "I told them".
