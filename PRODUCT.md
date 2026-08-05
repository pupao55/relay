# Relay — Product Thesis

## The problem

Recruiting teams don't lose candidates because they lack data. They lose them because
**nobody acts in time**:

- applications sit unreviewed;
- hiring managers delay decisions;
- interviews take days to schedule;
- scorecards go missing after interviews;
- candidates hear nothing and quietly accept competing offers;
- recruiters spend their days chasing people instead of closing them.

The ATS is a **system of record**. It can tell you that a candidate has been "In HM
Review" for five days. It will not tell you that this candidate has a Citadel final round
on Friday, that the hiring manager's median response time is 41 hours, that a reminder was
already sent, and that the correct next move is a direct escalation plus a same-day status
note to the candidate. And it certainly won't draft either message.

## The thesis

**Hiring is an execution problem, and execution is ownable by software.** Relay is the
execution layer above the ATS:

1. **Every active application always has a next action, an owner, and a due date.**
   This is enforced as an invariant. An application without one is an error state that
   Relay surfaces as a critical issue.
2. **Stalls are detected, not discovered.** SLA rules (recruiter review 24h, HM review
   48h, feedback 12h, candidate updates every 3 business days, offer approvals 24h,
   idle-process review at 7 days) run continuously against real timestamps.
3. **The agent proposes; humans control the blast radius.** Low-risk internal actions
   (reminders, tasks) can execute automatically. Anything candidate-facing, offer-related,
   or reputationally risky always requires human approval — one click, with the draft,
   rationale, and supporting facts in front of you.
4. **Everything is auditable.** Every proposal, approval, edit, delay, dismissal, and
   execution writes an audit event with actor, previous state, new state, and rationale.

## The primary user

An internal recruiter or recruiting lead running multiple open roles. Their day in Relay:

1. **Open the Command Center.** Five numbers: active, blocked, at risk, overdue,
   completed this week. Below: the Attention Required queue, ranked by risk.
2. **Work the queue.** Each item = candidate + blocker + context + recommended action +
   rationale. Approve sends it. Edit revises the draft first. Wait defers 24h. Dismiss
   kills it (logged, with reason).
3. **Trust the floor.** Healthy candidates aren't in the queue, but each still has an
   owner and a due next step — visible in the Candidates table and on every profile.

## Why momentum labels, not scores

Relay classifies every application as **Moving / Slowing / Blocked / At Risk** — states a
recruiter can act on and defend to a hiring manager. An unexplained "72/100 AI score"
invites arguments about the number; "Blocked: two scorecards overdue from Grace and David"
invites action. Every state is traceable to facts shown alongside it.

## What Relay is not

- **Not a replacement ATS.** The ATS stays the system of record; Relay syncs state and
  writes back stage changes.
- **Not an autonomous recruiter.** The agent never rejects, never negotiates, never
  discloses feedback. Its autonomy ceiling is internal nudges — everything else is a
  human's one-click decision.
- **Not a sourcing tool.** Relay starts when an application exists.

## The wedge and the moat

The wedge is time-to-action: teams adopt Relay because candidates stop falling through
cracks in week one. The compounding asset is the execution graph — who responds in what
time, which stages stall by role, which interventions actually restart processes. That
data makes each subsequent recommendation better, and it lives nowhere else in the stack.
