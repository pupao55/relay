# Relay — Architecture

## System overview

```
┌─────────────────────────────────────────────────────────────┐
│  Next.js App Router (src/app)                               │
│  Server components (reads) · Server actions (writes)        │
│  Client components only for interactivity (filters, dialogs)│
├─────────────────────────────────────────────────────────────┤
│  src/lib/actions.ts     — all mutations, all audit-logged   │
│  src/lib/agent/engine.ts— pure, deterministic rule engine   │
│  src/lib/agent/run.ts   — loads state, persists proposals   │
│  src/lib/types.ts       — pseudo-enum single source of truth│
├─────────────────────────────────────────────────────────────┤
│  Prisma → SQLite (dev) / PostgreSQL (drop-in)               │
└─────────────────────────────────────────────────────────────┘
```

- **Reads** happen in server components (`page.tsx` files query Prisma directly).
- **Writes** go exclusively through server actions in `src/lib/actions.ts`. Every mutation
  that touches an agent action or application state writes an `AuditLog` row (actor,
  actor type, event type, previous state, new state, rationale). UI refreshes via
  `revalidatePath`, so state changes appear immediately.
- **Enums**: SQLite doesn't support Prisma enums, so status fields are strings constrained
  by union types in `src/lib/types.ts`. On PostgreSQL these can be promoted to native
  enums without touching call sites.

## Data model

Core entities (see `prisma/schema.prisma`): `Organization`, `User`, `Role`, `Candidate`,
`Application`, `PipelineStage`, `Action`, `ActionRule`, `Communication`, `Interview`
(+ `InterviewPanelist`), `Feedback`, `ExternalSource`, `Integration`, `AgentRun`,
`AuditLog`.

Key relationships and invariants:

- A `Candidate` may have multiple `Application`s; each belongs to one `Role` and one
  current `PipelineStage`, and carries derived `momentum`, `risk`, and blocker fields.
- **An active `Application` must have one open `Action`** (owner, due date, status, risk,
  approval mode). The agent's integrity rule (`no-next-action`) raises a CRITICAL issue
  when this invariant is violated — the issue itself becomes the next action.
- Every agent proposal and execution creates an `AgentRun`-linked `Action` plus an
  `AuditLog` entry. Human decisions (approve/edit/delay/dismiss/complete/reassign) each
  write their own audit event.

Action statuses: `PROPOSED → APPROVED / IN_PROGRESS / WAITING → COMPLETED`, or
`DISMISSED` / `FAILED`. Risk levels: `LOW / MEDIUM / HIGH / CRITICAL`.

## The agent

### Boundaries (the safety model)

The agent lives behind three hard boundaries:

1. **Purity.** `engine.ts` is a pure function of `(application snapshot, now, rule modes)`
   → `(derived state, recommendations)`. No I/O, no randomness, no wall-clock reads. It is
   deterministic and unit-testable.
2. **Persistence firewall.** Only `run.ts` writes agent output to the database, and only
   as `PROPOSED` actions (or `WAITING` for auto-executed low-risk internal reminders).
   The engine cannot mutate anything.
3. **Approval ceiling.** Action types in `ALWAYS_APPROVAL_ACTION_TYPES` (candidate
   updates, redirections, offer actions, escalations) and anything HIGH/CRITICAL risk can
   never auto-execute, regardless of the automation rule's mode. Rejections and
   compensation communication are not agent action types at all.

### Rule set

| Rule key | Trigger | Output |
|---|---|---|
| `recruiter-review-24h` | Recruiter review > 24h | Internal reminder (auto-executable) |
| `hm-review-48h` | HM review > 48h / > 72h | Contextual reminder → escalation |
| `feedback-12h` | Scorecard pending > 12h post-interview | Feedback chase (auto-executable) |
| `scheduling-24h` | Interview unscheduled > 24h | Scheduling proposal |
| `candidate-update-3bd` | No candidate-facing touch in 3 business days | Drafted status email (approval required) |
| `offer-approval-24h` | Offer approval pending > 24h | Escalation (approval required) |
| `idle-7d` | No activity 7 days | Process-review task |
| `no-next-action` | Active app with zero open actions | CRITICAL integrity issue |
| `redirection` | Role-specific rejection + criteria overlap with another open role | Redirection proposal |

Redirections execute structurally rather than as messages: approving one creates a new
`Application` on the target role (source: Internal Redirect) in Recruiter Review, a
review task for the receiving recruiter, and a drafted candidate-facing warm note that
still requires approval. Agent-proposed redirects carry a `targetRoleId`; HM-initiated
redirects ("strong, wrong team") resolve the target by best criteria overlap at approval
time, and close out with an audit trail if no open role matches.

Competing-deadline detection is cross-cutting: a competing process within 3 days elevates
momentum to At Risk and risk to HIGH (CRITICAL inside 2 days), and is threaded into the
drafted message content ("Maya has a Citadel final on Friday…").

Every recommendation carries: action type, target, owner, due date, risk, rationale, and
supporting facts (the exact data points it was derived from), rendered verbatim in the UI.

### Model-drafted content (implemented)

`src/lib/agent/drafting.ts` implements the seam described above. The deterministic
engine remains the trigger detector — which SLAs fired, which facts matter, risk,
owners, and due dates are never model-generated. When `ANTHROPIC_API_KEY` is set, the
message *body* of each recommendation is drafted by the Anthropic API
(`claude-opus-4-8` by default; override with `RELAY_DRAFTING_MODEL`), using the
engine's template as the baseline and the supporting facts as the only allowed inputs.

Safety properties: explicit opt-in (no key → deterministic templates, so the prototype
runs with zero credentials); a validation gate (length bounds, must reference the
candidate) with fallback to the template on any error, refusal, or invalid output; and
the approval pipeline, risk ceiling, and audit trail are unchanged — a model-drafted
proposal is still just a `PROPOSED` action a human approves.

## Data flow for one interaction

Approving Maya Chen's escalation:

1. Client `ActionControls` calls the `approveAction` server action.
2. Status `PROPOSED → WAITING` (message-type actions wait on their recipient);
   a `Communication` row is created (internal Slack-style message);
   `Application.lastActivityAt` updates.
3. Two audit events: `ACTION_APPROVED` (human, Sarah Kim) and `AGENT_EXECUTION`
   (agent, post-approval send).
4. `revalidatePath` re-renders every route; the item leaves the Command Center queue and
   appears under Actions → Waiting on Others; the candidate timeline shows both events.

## Future ATS integration model

The prototype fakes the ATS boundary with seeded data plus the `Integration` table. The
production shape:

- **Ingest**: webhook subscriptions (Greenhouse/Ashby/Lever) land normalized events on a
  queue; a sync worker upserts `Candidate`/`Application`/`Interview`/`Feedback` rows and
  stamps `ExternalSource`. Nightly full reconciliation catches missed webhooks. The
  `Application.stageId` mapping is per-org configuration (Settings → Stage Mapping).
- **Egress**: approved stage changes and notes write back through the ATS API under the
  integration's service account; Relay-originated messages send via the email/calendar
  integrations (Gmail/Outlook, Google/Microsoft calendars), never through the ATS.
- **Conflict rule**: the ATS wins on *record* fields (stage names, candidate PII); Relay
  wins on *execution* fields (actions, owners, due dates, momentum, risk) — those never
  leave Relay.
- **Identity**: ATS user IDs map to Relay `User` rows at connect time; unmapped actors
  fall back to a service identity so audit attribution is never empty.

The agent never talks to integrations directly: it proposes actions; the execution layer
(server actions today, a worker in production) performs I/O after the approval gate.

Two execution paths are already structural rather than message-based: approving a
**scheduling** action books the unscheduled interview (next-business-day slot standing in
for calendar availability), sets scorecard deadlines, and emails the candidate the
confirmation; approving a **redirection** creates the application in the target pipeline.
The inbound direction is demonstrated by **Settings → ATS → "Simulate sync event"**, which
applies one deterministic Greenhouse-style webhook (an overdue scorecard landing),
resolves the corresponding chase, and audits the change as `Greenhouse Sync`.
