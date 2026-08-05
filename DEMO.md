# Relay — 5-Minute Demo Script

> Setup: `npm run db:seed && npm run dev`, open http://localhost:3000.
> Re-seed right before the demo so all SLA clocks are live.

## 0:00 — The one-liner

"Your ATS tells you where candidates *are*. Relay tells you — and does — what happens
*next*. Every active candidate here has a next action, an owner, and a due date. If one
doesn't, Relay treats it as an error."

## 0:20 — Command Center

- Point at the stat row: ~18 active, ~7 blocked, 1 at risk. "This is the entire job: get
  blocked to zero."
- The **Attention Required** queue is ranked by risk. Read the top card aloud —
  **Maya Chen**: Senior Quant Researcher, Hiring Manager Review, 3 days in stage.
  Blocker: *James Wu has not reviewed the profile*. Context: *Citadel final round Friday*.
  "Relay didn't just flag the stall — it knows she has a competing final in three days,
  drafted the escalation, and attached the facts it reasoned from."
- Click **Edit** to show the draft is editable, then **Approve**. "One click. The message
  is sent, the action moves to 'waiting on James', and every step was audit-logged."
- Show the right rail: *Today's Agent Summary* — the day's brief in four lines.

## 1:30 — The error state

- Still on the queue: find **Nate Brooks** — "No next action defined." "This is the core
  invariant. Nobody dropped him silently; Relay raised it as a critical issue with a
  2-hour due date."

## 1:50 — Candidates

- Open **Candidates**. "Dense, sortable, and honest — momentum is a label you can defend
  (Moving / Slowing / Blocked / At Risk), not an unexplained score."
- Filter Status → Blocked. "Every blocked candidate, the next action, and whose court the
  ball is in."
- Click **Wei Zhang** → detail page. Show the **Next Best Action** card (chase two
  overdue scorecards), then the **Timeline** tab: "submission → interviews → agent
  proposals → executions — every event stamped with who or what initiated it."

## 3:00 — Actions & safety

- Open **Actions**. "The approval queue. Low-risk internal actions support bulk approval —
  select all, approve. Candidate-facing and offer-related actions never auto-execute;
  they're individually reviewed."
- Flip to **Waiting on Others** — "the reminders Relay already sent automatically under
  the 24-hour recruiter-review rule."

## 3:45 — Automations

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
