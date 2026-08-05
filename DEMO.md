# Relay — Demo Script

> Setup: `npm run db:seed && npm run dev`, open http://localhost:3000.
> Re-seed right before the demo so all SLA clocks are live.

## The 2-minute core story: Maya Chen, At Risk → Moving

This is the loop that makes Relay not-an-ATS. Run it first, uninterrupted.

**0:00 — Open the Command Center.** The headline isn't a dashboard — it's a sentence:
*"5 candidates need intervention now."* Below it, four numbers that divide the work:
who needs intervention, what Relay executes automatically, what needs human judgment,
and who is at immediate withdrawal risk.

**0:15 — Read Maya's card, top of "Immediate withdrawal risk."** Every card answers five
questions in order: **Blocked** — James Wu has not reviewed the profile (3 days).
**Why now** — Maya has a Citadel final round Friday. **Owner** — Sarah Kim, due in 3h.
**Relay will** — send the escalation it already drafted, competing-deadline context
included. **If no one responds** — flagged to the department head tomorrow, hold-note
drafted for Maya. Nothing here is a score; everything is a fact with a consequence.

**0:40 — Click Approve.** The **execution receipt** appears: what was sent, to whom
(James Wu), Maya's resulting state (waiting on James, still At Risk), the new next
action, and the escalation clock now running. Close it — the card has left the queue.

**1:00 — Point at the Review queue in the right rail.** Every candidate waiting on a
hiring manager, grouped by manager, *before* the SLA breaches — Hannah Goldberg is only
20 hours in and already visible. Click **Review** on Maya (or open it from her profile).
This is James's entire experience: summary, 4/4 fit against *his* criteria, the one
concern (comp at top of band), the timing banner, résumé, and four buttons — with
keyboard shortcuts (A / I / R / D). No ATS navigation, no tabs.

**1:20 — Click Advance.** The decision receipt shows the whole state change: Hiring
Manager Review → Phone Screen, momentum **At Risk → Moving**, and the next action Relay
just created — *Schedule Maya's phone screen, Sarah Kim, due in 24h*.

**1:40 — Open the Timeline tab.** The full story is audited: the stall, the escalation,
the approval, James's decision, the scheduling action creation — each stamped human,
agent, or system. "Blocked candidate to moving candidate in four clicks, two people,
zero chasing — and every step attributable."

---

## The 5-minute extended walkthrough

## 0:00 — The one-liner

"Your ATS tells you where candidates *are*. Relay tells you — and does — what happens
*next*. Every active candidate here has a next action, an owner, and a due date. If one
doesn't, Relay treats it as an error."

## 0:20 — Command Center

- Run the 2-minute Maya story above.
- Point out the queue grouping: **withdrawal risk → unowned → blocked → overdue** —
  urgency order, not stage order. One card per candidate; further queued actions ride
  along as "Also queued" rows.
- Show the right rail: the **Review queue** (every pending HM review, one click to
  decide), **Waiting on replies** (whose court the ball is in, with reply deadlines),
  and **idle candidate-days** — days candidates sat without activity, and how many of
  those days completed Relay actions closed out this week.

## 2:20 — The error state

- In the queue: **Nate Brooks** under "Unowned — error state." "This is the core
  invariant. Nobody dropped him silently; Relay raised it as a critical issue with a
  2-hour due date and told you what happens if it's ignored."

## 2:40 — Candidates

- Open **Candidates**. "Dense, sortable, and honest — momentum is a label you can defend
  (Moving / Slowing / Blocked / At Risk), not an unexplained score."
- Filter Status → Blocked. "Every blocked candidate, the next action, and whose court the
  ball is in."
- Click **Wei Zhang** → detail page. Show the **Next Best Action** card (chase two
  overdue scorecards), then the **Timeline** tab: "submission → interviews → agent
  proposals → executions — every event stamped with who or what initiated it."

## 3:30 — Actions & safety

- Open **Actions**. "The approval queue. Low-risk internal actions support bulk approval —
  select all, approve. Candidate-facing and offer-related actions never auto-execute;
  they're individually reviewed."
- Flip to **Waiting on Others** — "the reminders Relay already sent automatically under
  the 24-hour recruiter-review rule."

## 4:00 — Automations

- Open **Automations**. Walk one rule: *Hiring-manager review within 48 hours* — trigger,
  conditions, proposed action, escalation path, and the mode selector (suggest / automatic
  internal / approval required / disabled).
- Open **New rule** to show the plain-language builder, read the live sentence preview.

## 4:20 — Analytics & audit

- Open **Analytics**: "Movement metrics only — where processes wait and on whom. Time in
  stage vs SLA shows HM review and offer approval are the chokepoints; overdue actions by
  owner tells you who to talk to."
- Open **Settings → Audit Logs**: "Every proposal, approval, edit, and execution —
  human or agent — with before/after state. This is what makes agent execution safe to
  deploy in a hiring process."

## 4:55 — Close

"ATSs record. Relay executes. Blocked goes to zero, candidates stop going dark, and your
recruiters spend their time closing — not chasing."
