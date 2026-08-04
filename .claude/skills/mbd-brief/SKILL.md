---
name: mbd-brief
description: Turn a loose request (Slack messages, email, call notes) into a complete MBD project brief using Pip Decks tactics (Hero & Guide, Movie Time, Story Hooks). Use whenever new client or internal work is being briefed, when a request arrives incomplete or drip-fed, or when someone asks to "write a brief" or "brief this in".
---

# MBD Brief Writer

Convert whatever raw input you're given (pasted Slack thread, forwarded email, verbal notes) into the brief template at `docs/comms/03-templates/brief.md`.

## Method

1. **Extract** everything the source material answers: audience, goal, message, format, deadline, assets, references, owner.
2. **Force the story questions** (Pip Decks):
   - Hero & Guide: what does the *client* win if this works? Frame the goal as their outcome, not our deliverable.
   - Movie Time: write one sentence describing the scene of use (who, where, what they do next).
   - Story Hooks: reduce to ONE core message; if the source has several, rank them and flag the ranking for confirmation.
3. **Mark every gap** explicitly as `❓ MISSING — ask [person]:` with a suggested question. Never invent deadlines, budgets, or scope.
4. **Set defaults where MBD convention applies** (2 revision rounds, file naming `Client_Project_Deliverable_V#`, deadline stated with timezone ACST) and label them "default — confirm".
5. **Output**: the filled template plus a short "Questions to close the brief" list the owner can paste straight back to the requester in one message (one message, not a drip).

## Rules
- No owner + no deadline = not briefed. Say so plainly at the top if either is missing.
- Hard external dates (print, conference, tender close) get worked backwards into checkpoint dates.
- Keep the client's own words for the goal where possible — don't launder their intent into agency-speak.
