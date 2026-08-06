# Research: What the Big Three Did Well, and Where Practitioners Still Hurt

Field research (Aug 2026) across review platforms, practitioner forums (Reddit
r/recruiting, Blind), and recruiting-ops writing. This file records the findings, the
first principles derived from them, and the five design iterations they drove.

## What each incumbent did well

**Ashby** — analytics as a first-class product, not a reporting afterthought: funnel
conversion, bottleneck identification, recruiter capacity — no BI team required. Plus
scheduling automation (mutual availability across panels, self-serve links) and an
all-in-one feel (ATS + CRM + scheduler in one surface) that makes recruiters fast.
([Dover](https://www.dover.com/blog/ashby-ats-review-pricing-alternatives),
[IndustryLabs](https://www.industrylabs.ai/articles/ashby-review))

**Greenhouse** — structured interviewing: interview kits, per-role focus areas, and
scorecards that keep every interviewer measuring the same things — cutting bias,
speeding decisions, leaving an audit trail. Their newer scorecard summaries surface
agreement/disagreement across a panel automatically. Their own guidance admits the
weakness: interviewers skip scorecards because they're busy and see no payoff.
([Greenhouse scorecard guidance](https://www.greenhouse.com/guidance/tips-for-improving-interview-scorecard-submission-rate),
[Capterra reviews](https://www.capterra.com/p/133100/Greenhouse/reviews/))

**Lever** — the candidate relationship: ATS+CRM hybrid, bidirectional Gmail/Outlook
sync so communication is captured without manual logging, nurture campaigns, clean
referral portal. ([work-management.org](https://work-management.org/hr/lever-review/),
[Treegarden](https://treegarden.io/blog/lever-review-2026/))

## Where practitioners still hurt

1. **Half the job is admin.** ~52% of recruiter time goes to scheduling, follow-up, and
   data entry; 2+ hours per req on calendar coordination alone; coordinators describe
   "living inside the inbox."
   ([IQTalent](https://blog.iqtalent.com/recruiting-time-allocation-audit),
   [candidate.fyi](https://candidate.fyi/post/the-interview-scheduling-gap-no-one-talks-about))
2. **Recruiter ↔ HM misalignment is the root waste.** "That's not quite what I'm
   looking for" after a sourced batch; feedback loops slow, unclear, or nonexistent;
   endless loop debates. ([Talroo](https://www.talroo.com/blog/why-your-hiring-process-is-slower-than-it-should-be-and-how-to-fix-it),
   [Recruiter.com](https://www.recruiter.com/recruiting/the-time-wasters-of-your-hiring-process/))
3. **Scorecards don't come in.** Chasing interviewers for feedback is a daily ritual;
   Greenhouse ships a manual "send reminder" button for exactly this.
   ([Greenhouse support](https://support.greenhouse.io/hc/en-us/articles/360027281232))
4. **Candidates are left dark → ghosting culture.** Blind is full of "ghosted after
   onsite" threads; recruiters field constant status-update calls because candidates
   have no other way to know. ([Blind](https://www.teamblind.com/post/why-tf-do-recruiters-ghost-after-an-onsite-icgevzwq),
   [Ask a Manager](https://askamanager.org/2013/08/10-things-job-seekers-hate-about-recruiters.html))
5. **Nobody can see whose court the ball is in** without building reports — the reason
   Ashby's built-in bottleneck analytics won.

## First principles

- **P1 — Every avoided status ping compounds.** The system should answer "what has the
  candidate been told, and when are they owed more?" without anyone asking.
- **P2 — Alignment is data, not meetings.** Every HM decision carries a structured
  reason; the aggregate teaches the recruiter what to source — replacing the sync
  meeting where "not what I'm looking for" gets discovered late.
- **P3 — Make the right thing the lazy thing.** A scorecard that takes one click in the
  place you already are gets submitted; anything else gets chased.
- **P4 — Show consensus, not documents.** A panel's signal should be readable in one
  glance (who said what, who's missing), not by opening five scorecards.
- **P5 — Accountability must be ambient.** Bottleneck people and stages surface
  automatically, named, with numbers — not in a report someone has to build.

## The five iterations

| # | Principle | Change |
|---|---|---|
| 1 | P3 | **One-click scorecards in context** — interviewers (and the HM home's "Scorecards you owe") submit a rating + optional note inline; blocker clears immediately, chase auto-resolves |
| 2 | P4 | **Panel signal strip** — per-candidate consensus row (rating-colored dots per interviewer, pending ghosted) on the candidate header and feedback tab |
| 3 | P1 | **Candidate-touch visibility** — "last told N ago / owed update" as a first-class column on Candidates, red at 3+ business days |
| 4 | P2 | **Structured decline reasons** — HM decline/redirect picks a reason chip (seniority, compensation, domain, skills, timing); role page shows the calibration histogram so sourcing self-corrects |
| 5 | P5 | **Named bottlenecks** — Analytics leads with "where hiring time goes": the bottleneck stage vs SLA and the slowest responders this week, computed, not configured |

## Follow-on build: the two deepest learnings

**Scheduling handshake (Ashby's lesson, adapted).** The single biggest admin sink is
calendar coordination. Relay's scheduling execution is now a handshake instead of a
decree: approving a scheduling action offers the candidate three concrete times (mock
panel availability), the interview moves to *awaiting candidate's pick*, and the pick —
arriving as an inbound sync event — auto-confirms the slot, sets scorecard deadlines,
and closes the action. Zero back-and-forth owned by a human; escalation re-offers fresh
times after 48h of silence.

**Interview kits (Greenhouse's lesson, lite).** Every non-completed interview shows a
deterministic kit: the role's required criteria split round-robin across the panel so
each interviewer measures something specific, plus the candidate's primary concern
assigned as an explicit probe. The panel measures the same things on purpose — and the
scorecard consensus strip (iteration 2) closes that loop on the way out.
