# Relay

**The AI hiring execution layer that keeps every candidate moving.**

Traditional applicant tracking systems record where candidates are. Relay sits above them
(Greenhouse, Ashby, Lever) as the system of *execution*: it identifies the next action for
every active candidate, assigns an owner and a due date, detects when the process is
blocked, and recommends — or executes — the action required to move the process forward.

The core invariant: **every active application always has a current stage, a next action,
an owner, and a due date.** A candidate without a next action is treated as an error state.

## Quick start

```bash
npm install
npm run db:seed   # creates SQLite db, pushes schema, seeds data, runs one agent pass
npm run dev       # http://localhost:3000
```

No external API keys are required. The prototype uses SQLite via Prisma; the schema is
PostgreSQL-compatible (see `prisma/schema.prisma` header for the swap procedure).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run db:seed` | Reset the database, re-seed, and run an agent pass |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Typecheck |

Seed timestamps are relative to *when you seed*, so SLA breaches, overdue actions, and
momentum states are live immediately. Re-run `npm run db:seed` any time to reset the demo.

## What to look at

- **Command Center** (`/`) — blocked and at-risk candidates, why they're blocked, who owns
  the next action, and what Relay recommends. Approve / Edit / Wait / Dismiss inline.
- **Candidates** (`/candidates`) — dense sortable table with momentum, next action, owner,
  due date, risk, and source. Click through to the candidate detail page (overview,
  timeline, interviews, feedback, communications, applications).
- **Actions** (`/actions`) — the approval queue: needs approval, waiting on others,
  escalations, executed, dismissed. Bulk-approve low-risk internal actions.
- **Automations** (`/automations`) — the SLA rules the agent runs, each with a mode
  (suggest / auto-internal / approval-required / disabled) and a plain-language rule builder.
- **Analytics** (`/analytics`) — movement metrics: idle time, blockers over time, overdue
  actions by owner, stage waits vs SLA, conversion, momentum by role.
- **Settings** (`/settings`) — mock integration states, stage mapping, SLA policies,
  roles & permissions, agent permissions, and the full audit log.

The signed-in user is **Sarah Kim (Recruiting Lead)** — the "My actions" filter and all
human-initiated audit entries use her identity.

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Prisma (SQLite →
PostgreSQL-ready) · Lucide icons · Recharts.

## Docs

- [`PRODUCT.md`](./PRODUCT.md) — product thesis and workflow
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — system design, agent boundaries, data flow, ATS integration model
- [`DEMO.md`](./DEMO.md) — five-minute demo script
