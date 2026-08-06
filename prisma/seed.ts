// Seed: 20 candidates, 6 roles, 5 recruiters, 6 hiring managers, interviewers,
// mixed sources, and a spread of healthy / slowing / blocked / at-risk
// processes. Timestamps are relative to seed time so SLA breaches and overdue
// actions are live the moment the app starts. Ends by invoking the agent once.

import { db } from "../src/lib/db";
import { runAgent } from "../src/lib/agent/run";

const now = new Date();
const HOUR = 60 * 60 * 1000;
const hoursAgo = (h: number) => new Date(now.getTime() - h * HOUR);
const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * HOUR);
const inHours = (h: number) => new Date(now.getTime() + h * HOUR);
const inDays = (d: number) => new Date(now.getTime() + d * 24 * HOUR);
const j = (v: unknown) => JSON.stringify(v);

async function main() {
  // Wipe in dependency order (idempotent re-seeding).
  await db.auditLog.deleteMany();
  await db.feedback.deleteMany();
  await db.interviewPanelist.deleteMany();
  await db.interview.deleteMany();
  await db.communication.deleteMany();
  await db.action.deleteMany();
  await db.agentRun.deleteMany();
  await db.application.deleteMany();
  await db.candidate.deleteMany();
  await db.role.deleteMany();
  await db.actionRule.deleteMany();
  await db.pipelineStage.deleteMany();
  await db.externalSource.deleteMany();
  await db.integration.deleteMany();
  await db.user.deleteMany();
  await db.organization.deleteMany();

  const org = await db.organization.create({
    data: { name: "Helios Capital" },
  });
  const orgId = org.id;

  // ---------------- Users ----------------
  const mkUser = (name: string, userRole: string, title: string, avgResponseHours = 24) =>
    db.user.create({
      data: {
        organizationId: orgId,
        name,
        email: name.toLowerCase().replace(/[^a-z]+/g, ".") + "@helioscap.com",
        userRole,
        title,
        avgResponseHours,
      },
    });

  // Recruiters
  const sarah = await mkUser("Sarah Kim", "RECRUITER", "Recruiting Lead", 4);
  const marcus = await mkUser("Marcus Bell", "RECRUITER", "Senior Technical Recruiter", 6);
  const priya = await mkUser("Priya Sharma", "RECRUITER", "Technical Recruiter", 5);
  const tom = await mkUser("Tom Okafor", "RECRUITER", "Technical Recruiter", 8);
  const elena = await mkUser("Elena Rodriguez", "RECRUITER", "Recruiting Coordinator", 3);

  // Hiring managers
  const james = await mkUser("James Wu", "HIRING_MANAGER", "Head of Quantitative Research", 41);
  const dana = await mkUser("Dana Foster", "HIRING_MANAGER", "Research Engineering Manager", 12);
  const alex = await mkUser("Alex Novak", "HIRING_MANAGER", "ML Platform Lead", 18);
  const kenji = await mkUser("Kenji Sato", "HIRING_MANAGER", "Head of Trading Systems", 52);
  const miriam = await mkUser("Miriam Adler", "HIRING_MANAGER", "Data Platform Manager", 9);
  const laura = await mkUser("Laura Chen", "HIRING_MANAGER", "VP People", 14);

  // Interviewers
  const ben = await mkUser("Ben Torres", "INTERVIEWER", "Senior Quant Researcher", 10);
  const grace = await mkUser("Grace Liu", "INTERVIEWER", "Staff Research Engineer", 30);
  const omar = await mkUser("Omar Haddad", "INTERVIEWER", "Senior ML Engineer", 8);
  const nina = await mkUser("Nina Petrov", "INTERVIEWER", "Infrastructure Engineer", 26);
  const david = await mkUser("David Stein", "INTERVIEWER", "Quant Researcher", 36);
  const yuki = await mkUser("Yuki Tanaka", "INTERVIEWER", "Senior C++ Engineer", 12);

  // ---------------- Pipeline stages ----------------
  const stageDefs: [string, number, string][] = [
    ["Recruiter Review", 24, "REVIEW"],
    ["Hiring Manager Review", 48, "REVIEW"],
    ["Phone Screen", 96, "INTERVIEW"],
    ["Technical Interview", 120, "INTERVIEW"],
    ["Onsite", 120, "INTERVIEW"],
    ["Debrief", 48, "DECISION"],
    ["Offer Approval", 24, "OFFER"],
    ["Offer Extended", 72, "OFFER"],
    ["Hired", 9999, "TERMINAL"],
  ];
  const stages: Record<string, { id: string }> = {};
  for (let i = 0; i < stageDefs.length; i++) {
    const [name, slaHours, kind] = stageDefs[i];
    stages[name] = await db.pipelineStage.create({
      data: { organizationId: orgId, name, order: i + 1, slaHours, kind },
    });
  }
  const S = (name: string) => stages[name].id;

  // ---------------- Sources ----------------
  const srcSourced = await db.externalSource.create({
    data: { organizationId: orgId, type: "DIRECT_SOURCING", name: "Direct Sourcing", details: "Outbound via LinkedIn Recruiter" },
  });
  const srcReferral = await db.externalSource.create({
    data: { organizationId: orgId, type: "REFERRAL", name: "Employee Referral" },
  });
  const srcInbound = await db.externalSource.create({
    data: { organizationId: orgId, type: "INBOUND", name: "Careers Site" },
  });
  const srcMeridian = await db.externalSource.create({
    data: { organizationId: orgId, type: "AGENCY", name: "Meridian Search Partners", details: "Contingency, 22% fee" },
  });
  const srcAtlas = await db.externalSource.create({
    data: { organizationId: orgId, type: "AGENCY", name: "Atlas Talent Group", details: "Retained, quant specialists" },
  });

  // ---------------- Roles ----------------
  const mkRole = (
    title: string, department: string, location: string, priority: string,
    recruiterId: string, hiringManagerId: string, openedDaysAgo: number,
    hiringBrief: string, required: string[], preferred: string[]
  ) =>
    db.role.create({
      data: {
        organizationId: orgId, title, department, location, priority,
        recruiterId, hiringManagerId, openedAt: daysAgo(openedDaysAgo),
        hiringBrief, requiredCriteria: j(required), preferredCriteria: j(preferred),
      },
    });

  const quantRole = await mkRole(
    "Senior Quantitative Researcher", "Quantitative Research", "New York (Hybrid)", "CRITICAL",
    sarah.id, james.id, 54,
    "Own alpha research for the mid-frequency equities desk. This is a backfill for a departing senior researcher; the desk is running under capacity and every week unfilled has direct PnL cost. We are competing head-to-head with Citadel and Jane Street for the same small pool.",
    ["5+ years alpha research in equities or futures", "Strong statistical modeling and ML fundamentals", "Production Python; comfort with large panel datasets", "Track record of live strategies with attributable PnL"],
    ["PhD in statistics, CS, math, or physics", "Experience with alternative data", "Familiarity with kdb+/q"]
  );
  const researchEngRole = await mkRole(
    "Research Engineer", "Research", "New York (Hybrid)", "HIGH",
    marcus.id, dana.id, 39,
    "Partner with quant researchers to productionize signal pipelines and build research tooling. The ideal candidate moves fluidly between research prototyping and hardened production code.",
    ["Strong Python and C++ engineering", "Experience building research platforms or ML pipelines", "Numerical computing depth (numpy, pandas, arrow)", "Collaboration with research/quant teams"],
    ["Rust experience", "Open-source contributions", "Distributed compute (Ray, Dask)"]
  );
  const mlInfraRole = await mkRole(
    "ML Infrastructure Engineer", "Platform", "New York (Hybrid)", "HIGH",
    priya.id, alex.id, 46,
    "Build the training and inference platform used by every research team: GPU cluster scheduling, feature stores, experiment tracking, and model deployment. Reliability and researcher velocity are the twin goals.",
    ["Distributed systems experience at scale", "Kubernetes and GPU cluster operations", "ML training infrastructure (PyTorch, Ray, or similar)", "Strong Python or Go"],
    ["Experience with feature stores", "Inference optimization (TensorRT, Triton)", "Terraform/IaC"]
  );
  const cppRole = await mkRole(
    "Low-Latency C++ Engineer", "Trading Systems", "Chicago (Onsite)", "CRITICAL",
    tom.id, kenji.id, 68,
    "Own the order gateway and market data path for the futures desk. Sub-microsecond sensitivity; kernel bypass networking; every nanosecond is measured. Desk head signs off on all hires personally.",
    ["Expert modern C++ (17/20) in latency-critical systems", "Kernel bypass networking (Solarflare/Onload, DPDK)", "Lock-free data structures and cache-aware design", "Exchange connectivity experience (CME, ICE)"],
    ["FPGA collaboration experience", "Linux kernel tuning", "Rust curiosity"]
  );
  const dataPlatformRole = await mkRole(
    "Data Platform Engineer", "Platform", "New York (Hybrid)", "STANDARD",
    elena.id, miriam.id, 25,
    "Build and operate the firm-wide research data lake: market data ingest, alternative data onboarding, point-in-time correctness, and query performance for thousands of daily research jobs.",
    ["Strong SQL and data modeling", "Batch and streaming pipelines (Spark, Kafka, or Flink)", "Python engineering", "Data quality and lineage tooling"],
    ["kdb+ or time-series databases", "Iceberg/Delta Lake", "AWS cost optimization"]
  );
  const recruitingLeadRole = await mkRole(
    "Technical Recruiting Lead", "Recruiting", "New York (Hybrid)", "STANDARD",
    sarah.id, laura.id, 18,
    "Lead technical recruiting across research and engineering. Own search strategy, agency relationships, and process quality metrics. Player-coach role managing two recruiters.",
    ["6+ years technical recruiting, quant/fintech preferred", "Track record closing senior research or engineering talent", "Process and metrics orientation", "Experience managing recruiters"],
    ["Experience standing up recruiting ops tooling", "Agency management background"]
  );

  // ---------------- Action rules ----------------
  const ruleData = [
    {
      ruleKey: "recruiter-review-24h", name: "Recruiter review within 24 hours",
      trigger: "Application enters Recruiter Review",
      conditions: ["Application has been in Recruiter Review for more than 24 hours", "No open reminder exists for this application"],
      proposedAction: "Send the assigned recruiter an internal reminder with candidate context",
      mode: "AUTO_INTERNAL", escalationPath: "Recruiting lead after 48 hours", slaHours: 24,
    },
    {
      ruleKey: "hm-review-48h", name: "Hiring-manager review within 48 hours",
      trigger: "Application enters Hiring Manager Review",
      conditions: ["Application has been in Hiring Manager Review for more than 48 hours"],
      proposedAction: "Draft a contextual reminder to the hiring manager; escalate to the recruiter with a direct-ping plan after 72 hours",
      mode: "APPROVAL_REQUIRED", escalationPath: "Recruiter direct ping at 72h; department head at 5 days", slaHours: 48,
    },
    {
      ruleKey: "feedback-12h", name: "Interview feedback within 12 hours",
      trigger: "Interview marked completed",
      conditions: ["A scorecard is still pending more than 12 hours after the interview ended"],
      proposedAction: "Send the interviewer an internal scorecard reminder",
      mode: "AUTO_INTERNAL", escalationPath: "Hiring manager after 24 hours", slaHours: 12,
    },
    {
      ruleKey: "candidate-update-3bd", name: "Candidate update every 3 business days",
      trigger: "Time since last candidate-facing communication",
      conditions: ["No candidate-facing update has been sent for 3 or more business days", "Application is active"],
      proposedAction: "Draft a status update email for the recruiter to approve and send",
      mode: "APPROVAL_REQUIRED", escalationPath: "Recruiting lead if unsent after 5 business days", slaHours: 72,
    },
    {
      ruleKey: "offer-approval-24h", name: "Offer approval escalated after 24 hours",
      trigger: "Application enters Offer Approval",
      conditions: ["Offer approval has been pending for more than 24 hours"],
      proposedAction: "Escalate to the approval chain and request same-day compensation sign-off",
      mode: "APPROVAL_REQUIRED", escalationPath: "Hiring manager, then department head, then CFO delegate", slaHours: 24,
    },
    {
      ruleKey: "idle-7d", name: "Process review after 7 idle days",
      trigger: "No meaningful activity on an application",
      conditions: ["No activity of any kind for 7 or more days", "Application is active"],
      proposedAction: "Create a process-review task for the recruiter: re-engage, unblock, or close out",
      mode: "SUGGEST_ONLY", escalationPath: "Recruiting lead review", slaHours: 168,
    },
    {
      ruleKey: "scheduling-24h", name: "Interviews scheduled within 24 hours of approval",
      trigger: "Interview approved but unscheduled",
      conditions: ["An interview has status Needs Scheduling for more than 24 hours"],
      proposedAction: "Propose interview slots to the candidate, prioritizing candidates with competing deadlines",
      mode: "APPROVAL_REQUIRED", escalationPath: "Recruiting coordinator pool", slaHours: 24,
    },
    {
      ruleKey: "no-next-action", name: "Every active application has a next action",
      trigger: "Continuous integrity check",
      conditions: ["An active application has zero open actions"],
      proposedAction: "Raise a critical data-integrity issue and assign the recruiter to define the next step",
      mode: "APPROVAL_REQUIRED", escalationPath: "Immediate — recruiting lead", slaHours: 2,
    },
    {
      ruleKey: "redirection", name: "Redirect role-specific rejections",
      trigger: "Application rejected with a role-specific reason",
      conditions: ["Rejection reason is role-specific (not a general signal)", "Candidate strengths overlap required criteria on another open role", "Candidate has no other active application"],
      proposedAction: "Propose moving the candidate into the matching role's pipeline with a warm note",
      mode: "SUGGEST_ONLY", escalationPath: "Owning recruiter decides", slaHours: 48,
    },
  ];
  for (const r of ruleData) {
    await db.actionRule.create({
      data: {
        organizationId: orgId, ruleKey: r.ruleKey, name: r.name, trigger: r.trigger,
        conditions: j(r.conditions), proposedAction: r.proposedAction, mode: r.mode,
        escalationPath: r.escalationPath, active: r.mode !== "DISABLED", slaHours: r.slaHours,
      },
    });
  }

  // ---------------- Integrations ----------------
  await db.integration.createMany({
    data: [
      { organizationId: orgId, kind: "ATS", provider: "Greenhouse", status: "CONNECTED", lastSyncAt: hoursAgo(0.2), detail: "Two-way sync · 6 roles, 20 candidates mapped" },
      { organizationId: orgId, kind: "EMAIL", provider: "Google Workspace", status: "CONNECTED", lastSyncAt: hoursAgo(0.1), detail: "Send-as enabled for 5 recruiter inboxes" },
      { organizationId: orgId, kind: "CALENDAR", provider: "Google Calendar", status: "CONNECTED", lastSyncAt: hoursAgo(0.5), detail: "Availability lookup for 14 interviewers" },
      { organizationId: orgId, kind: "SLACK", provider: "Slack", status: "ERROR", lastSyncAt: daysAgo(2), detail: "Token expired — reauthorize to restore reminders in #recruiting" },
    ],
  });

  // ---------------- Candidates + applications ----------------

  interface CandSpec {
    name: string; email: string; location: string; company: string; title: string;
    summary: string; strengths: string[]; concerns: string[];
    prior: { company: string; title: string; years: string }[];
    competingProcess?: string; competingDeadline?: Date;
    roleId: string; sourceId: string; stage: string;
    status?: string; resolutionReason?: string;
    appliedDaysAgo: number; stageEnteredHoursAgo: number;
    lastActivityHoursAgo: number; lastCandidateUpdateHoursAgo: number;
  }

  const specs: CandSpec[] = [
    {
      name: "Maya Chen", email: "maya.chen@gmail.com", location: "New York, NY",
      company: "Two Sigma", title: "Quantitative Researcher",
      summary: "Mid-frequency equities researcher with 6 years at Two Sigma. Built and owns two live stat-arb strategies; strong cross-sectional ML background. Actively interviewing and moving fast.",
      strengths: ["Live strategies with attributable PnL at Two Sigma", "Deep statistical modeling and ML fundamentals", "Production Python on large panel datasets", "Publishes internally on regime detection"],
      concerns: ["Compensation expectations at top of band", "Timeline pressure from competing process"],
      prior: [{ company: "Two Sigma", title: "Quantitative Researcher", years: "2020–now" }, { company: "Goldman Sachs", title: "Strats Associate", years: "2018–2020" }],
      competingProcess: "final round at Citadel", competingDeadline: inDays(2.5),
      roleId: quantRole.id, sourceId: srcSourced.id, stage: "Hiring Manager Review",
      appliedDaysAgo: 9, stageEnteredHoursAgo: 74, lastActivityHoursAgo: 74, lastCandidateUpdateHoursAgo: 78,
    },
    {
      name: "Daniel Reyes", email: "dreyes.quant@gmail.com", location: "Jersey City, NJ",
      company: "Millennium", title: "Senior Quantitative Analyst",
      summary: "Futures and rates researcher, 8 years across Millennium pods. Strong on execution-aware alpha; wants a seat with more research autonomy.",
      strengths: ["8 years systematic futures research", "Execution-cost-aware modeling", "kdb+/q fluency"],
      concerns: ["Equities experience is limited", "Two pod moves in 4 years"],
      prior: [{ company: "Millennium", title: "Senior Quant Analyst", years: "2019–now" }, { company: "SocGen", title: "Quant Analyst", years: "2016–2019" }],
      roleId: quantRole.id, sourceId: srcInbound.id, stage: "Hiring Manager Review",
      appliedDaysAgo: 3.2, stageEnteredHoursAgo: 26, lastActivityHoursAgo: 26, lastCandidateUpdateHoursAgo: 30,
    },
    {
      name: "Alina Volkov", email: "alina.volkov@proton.me", location: "New York, NY",
      company: "DE Shaw", title: "Quantitative Researcher",
      summary: "Cross-asset researcher with a physics PhD. Referred by Ben Torres (worked together at DE Shaw). Methodical, strong on alternative data onboarding.",
      strengths: ["Alternative data alpha at DE Shaw", "Physics PhD (Princeton)", "Rigorous backtesting discipline", "Referral with strong internal signal"],
      concerns: ["Less experience with live production ownership"],
      prior: [{ company: "DE Shaw", title: "Quantitative Researcher", years: "2021–now" }, { company: "Princeton", title: "PhD, Physics", years: "2016–2021" }],
      roleId: quantRole.id, sourceId: srcReferral.id, stage: "Onsite",
      appliedDaysAgo: 21, stageEnteredHoursAgo: 20, lastActivityHoursAgo: 20, lastCandidateUpdateHoursAgo: 22,
    },
    {
      name: "Wei Zhang", email: "wzhang.research@gmail.com", location: "New York, NY",
      company: "Point72 (Cubist)", title: "Quantitative Researcher",
      summary: "Systematic equities researcher at Cubist, 5 years. Strong debrief signal from onsite; two scorecards still outstanding and blocking the decision.",
      strengths: ["Mid-frequency equities alpha at Cubist", "Strong live-trading intuition in onsite", "Clean production Python"],
      concerns: ["Panel split pending final scorecards"],
      prior: [{ company: "Point72 / Cubist", title: "Quant Researcher", years: "2020–now" }, { company: "Citi", title: "Quant Associate", years: "2018–2020" }],
      roleId: quantRole.id, sourceId: srcAtlas.id, stage: "Debrief",
      appliedDaysAgo: 21, stageEnteredHoursAgo: 26, lastActivityHoursAgo: 26, lastCandidateUpdateHoursAgo: 30,
    },
    {
      name: "Tomás Silva", email: "tomas.silva.eng@gmail.com", location: "Brooklyn, NY",
      company: "Google DeepMind", title: "Research Engineer",
      summary: "Research engineer on DeepMind's science team; JAX and large-scale training pipelines. Wants to move into quant research tooling.",
      strengths: ["Large-scale JAX training pipelines", "Research-partner engineering at DeepMind", "Strong numerical computing depth"],
      concerns: ["No finance background", "Phone screen approved but not yet scheduled"],
      prior: [{ company: "Google DeepMind", title: "Research Engineer", years: "2021–now" }, { company: "Spotify", title: "ML Engineer", years: "2018–2021" }],
      roleId: researchEngRole.id, sourceId: srcSourced.id, stage: "Phone Screen",
      appliedDaysAgo: 8, stageEnteredHoursAgo: 60, lastActivityHoursAgo: 50, lastCandidateUpdateHoursAgo: 50,
    },
    {
      name: "Hannah Goldberg", email: "hgoldberg@outlook.com", location: "New York, NY",
      company: "Hudson River Trading", title: "Algo Developer",
      summary: "Algo developer at HRT with research-platform side projects. Strong C++/Python bridge profile — exactly the research engineer shape.",
      strengths: ["C++ and Python in production trading systems", "Built HRT-internal research tooling", "Fast, pragmatic collaborator per references"],
      concerns: ["May prefer pure trading-systems work"],
      prior: [{ company: "Hudson River Trading", title: "Algo Developer", years: "2019–now" }, { company: "MIT", title: "MEng, CS", years: "2017–2019" }],
      roleId: researchEngRole.id, sourceId: srcReferral.id, stage: "Hiring Manager Review",
      appliedDaysAgo: 3, stageEnteredHoursAgo: 20, lastActivityHoursAgo: 20, lastCandidateUpdateHoursAgo: 24,
    },
    {
      name: "Ravi Patel", email: "ravi.patel.dev@gmail.com", location: "Hoboken, NJ",
      company: "Bloomberg", title: "Senior Software Engineer",
      summary: "Senior engineer on Bloomberg's derivatives analytics platform. Strong numerical C++ plus recent Ray/Arrow work. Technical interview tomorrow.",
      strengths: ["Numerical C++ on derivatives analytics", "Ray and Arrow experience", "Deep testing culture"],
      concerns: ["Research-partner experience is indirect"],
      prior: [{ company: "Bloomberg", title: "Senior SWE", years: "2018–now" }, { company: "MathWorks", title: "SWE", years: "2015–2018" }],
      roleId: researchEngRole.id, sourceId: srcInbound.id, stage: "Technical Interview",
      appliedDaysAgo: 12, stageEnteredHoursAgo: 40, lastActivityHoursAgo: 12, lastCandidateUpdateHoursAgo: 12,
    },
    {
      name: "Sofia Marino", email: "sofia.marino.ml@gmail.com", location: "New York, NY",
      company: "Netflix", title: "Senior ML Infrastructure Engineer",
      summary: "Owned Netflix's distributed training platform (Kubernetes, Ray, GPU scheduling). Applied to Research Engineer; panel found her research-partnering depth thin but infrastructure depth exceptional.",
      strengths: ["Distributed systems at scale — Kubernetes and Ray platform ownership", "GPU cluster operations and scheduling at Netflix", "Strong Python and Go", "ML training infrastructure end to end"],
      concerns: ["Limited direct research collaboration", "Closed out on Research Engineer for role fit"],
      prior: [{ company: "Netflix", title: "Senior ML Infra Engineer", years: "2020–now" }, { company: "Uber", title: "SWE, Michelangelo", years: "2017–2020" }],
      roleId: researchEngRole.id, sourceId: srcInbound.id, stage: "Debrief",
      status: "REJECTED", resolutionReason: "Role-specific: panel wanted deeper research-partnering experience; infrastructure skills rated exceptional",
      appliedDaysAgo: 17, stageEnteredHoursAgo: 96, lastActivityHoursAgo: 72, lastCandidateUpdateHoursAgo: 72,
    },
    {
      name: "Jordan Lee", email: "jordan.lee.sys@gmail.com", location: "New York, NY",
      company: "OpenAI", title: "Infrastructure Engineer",
      summary: "Training-infrastructure engineer; ran GPU capacity for a research org. Cleared onsite with a strong-hire consensus. Offer packet stuck in approval since yesterday morning; holding a competing offer.",
      strengths: ["GPU fleet scheduling at research scale", "Strong-hire onsite consensus", "Kubernetes + Terraform depth"],
      concerns: ["Holding a competing offer with a hard deadline"],
      prior: [{ company: "OpenAI", title: "Infrastructure Engineer", years: "2022–now" }, { company: "Stripe", title: "SRE", years: "2019–2022" }],
      competingProcess: "competing offer from Anthropic expiring", competingDeadline: inDays(4),
      roleId: mlInfraRole.id, sourceId: srcSourced.id, stage: "Offer Approval",
      appliedDaysAgo: 24, stageEnteredHoursAgo: 30, lastActivityHoursAgo: 30, lastCandidateUpdateHoursAgo: 20,
    },
    {
      name: "Emily Nakamura", email: "emily.nakamura@fastmail.com", location: "Stamford, CT",
      company: "AWS", title: "Senior SDE, SageMaker",
      summary: "SageMaker training-platform engineer. Onsite completed yesterday; one scorecard outstanding before debrief can be scheduled.",
      strengths: ["Managed training platform at AWS scale", "Inference optimization (Triton) experience", "Calm, structured system design"],
      concerns: ["Commute; may need hybrid flexibility"],
      prior: [{ company: "AWS", title: "Senior SDE", years: "2019–now" }, { company: "Qualtrics", title: "SDE II", years: "2016–2019" }],
      roleId: mlInfraRole.id, sourceId: srcMeridian.id, stage: "Debrief",
      appliedDaysAgo: 19, stageEnteredHoursAgo: 22, lastActivityHoursAgo: 22, lastCandidateUpdateHoursAgo: 40,
    },
    {
      name: "Viktor Kovac", email: "viktor.kovac.dev@gmail.com", location: "Queens, NY",
      company: "Datadog", title: "Staff Engineer",
      summary: "Staff engineer on Datadog's metrics ingestion platform. Agency submission from Meridian; sitting unreviewed past the 24h SLA.",
      strengths: ["High-throughput distributed ingestion", "Kubernetes at fleet scale", "Strong Go"],
      concerns: ["No ML platform exposure", "Agency fee applies"],
      prior: [{ company: "Datadog", title: "Staff Engineer", years: "2018–now" }, { company: "MongoDB", title: "Senior SWE", years: "2014–2018" }],
      roleId: mlInfraRole.id, sourceId: srcMeridian.id, stage: "Recruiter Review",
      appliedDaysAgo: 1.5, stageEnteredHoursAgo: 34, lastActivityHoursAgo: 34, lastCandidateUpdateHoursAgo: 34,
    },
    {
      name: "Amara Diallo", email: "amara.diallo@gmail.com", location: "New York, NY",
      company: "Meta", title: "Production Engineer",
      summary: "Production engineer on Meta's training-cluster reliability team. Phone screen scheduled; hasn't heard from us since last week.",
      strengths: ["GPU cluster reliability at Meta", "Incident tooling and automation", "PyTorch infra familiarity"],
      concerns: ["Interview loop competing with internal transfer offer"],
      prior: [{ company: "Meta", title: "Production Engineer", years: "2019–now" }, { company: "Akamai", title: "SRE", years: "2016–2019" }],
      roleId: mlInfraRole.id, sourceId: srcInbound.id, stage: "Phone Screen",
      appliedDaysAgo: 9, stageEnteredHoursAgo: 70, lastActivityHoursAgo: 70, lastCandidateUpdateHoursAgo: 126,
    },
    {
      name: "Chris Thompson", email: "cthompson.cpp@gmail.com", location: "Chicago, IL",
      company: "Jump Trading", title: "Senior C++ Engineer",
      summary: "Order-entry systems engineer at Jump. Exactly the low-latency profile the desk asked for; Kenji has had the profile for four days without review.",
      strengths: ["Sub-microsecond order gateway work at Jump", "Onload and DPDK production experience", "CME connectivity ownership"],
      concerns: ["Non-compete may delay start by 6 months"],
      prior: [{ company: "Jump Trading", title: "Senior C++ Engineer", years: "2019–now" }, { company: "CME Group", title: "SWE", years: "2015–2019" }],
      roleId: cppRole.id, sourceId: srcSourced.id, stage: "Hiring Manager Review",
      appliedDaysAgo: 7, stageEnteredHoursAgo: 98, lastActivityHoursAgo: 98, lastCandidateUpdateHoursAgo: 100,
    },
    {
      name: "Yuna Park", email: "yuna.park.eng@gmail.com", location: "Chicago, IL",
      company: "IMC Trading", title: "C++ Engineer",
      summary: "Market-data path engineer at IMC. Technical interview was cancelled for a family emergency 8 days ago and the process has been idle since.",
      strengths: ["Feed handler development at IMC", "Lock-free queue design", "Strong systems fundamentals"],
      concerns: ["Process idle 8 days after cancelled interview", "May have cooled on the move"],
      prior: [{ company: "IMC Trading", title: "C++ Engineer", years: "2020–now" }, { company: "Samsung", title: "Embedded SWE", years: "2017–2020" }],
      roleId: cppRole.id, sourceId: srcInbound.id, stage: "Technical Interview",
      appliedDaysAgo: 18, stageEnteredHoursAgo: 200, lastActivityHoursAgo: 195, lastCandidateUpdateHoursAgo: 195,
    },
    {
      name: "Lucas Weber", email: "lucas.weber.dev@gmail.com", location: "Chicago, IL",
      company: "Optiver", title: "Senior Software Engineer",
      summary: "Execution systems engineer at Optiver. Onsite confirmed for Thursday; strong phone and technical rounds. Healthy process.",
      strengths: ["Nanosecond-benchmarked execution path work", "Cache-aware data structure design", "Strong interview signal so far"],
      concerns: ["Relocation from Amsterdam office pending visa check"],
      prior: [{ company: "Optiver", title: "Senior SWE", years: "2018–now" }, { company: "ASML", title: "SWE", years: "2015–2018" }],
      roleId: cppRole.id, sourceId: srcAtlas.id, stage: "Onsite",
      appliedDaysAgo: 15, stageEnteredHoursAgo: 30, lastActivityHoursAgo: 8, lastCandidateUpdateHoursAgo: 8,
    },
    {
      name: "Fatima Al-Rashid", email: "fatima.alrashid@gmail.com", location: "New York, NY",
      company: "Snowflake", title: "Senior Data Engineer",
      summary: "Senior data engineer on Snowflake's internal data platform. Fresh inbound application, in recruiter review well inside SLA.",
      strengths: ["Large-scale Spark and Iceberg pipelines", "Data quality tooling ownership", "Strong SQL optimization background"],
      concerns: ["No financial data experience"],
      prior: [{ company: "Snowflake", title: "Senior Data Engineer", years: "2021–now" }, { company: "Palantir", title: "Deployment Strategist", years: "2018–2021" }],
      roleId: dataPlatformRole.id, sourceId: srcInbound.id, stage: "Recruiter Review",
      appliedDaysAgo: 0.25, stageEnteredHoursAgo: 6, lastActivityHoursAgo: 6, lastCandidateUpdateHoursAgo: 6,
    },
    {
      name: "Nate Brooks", email: "nate.brooks.data@gmail.com", location: "Brooklyn, NY",
      company: "Databricks", title: "Solutions Architect",
      summary: "Solutions architect with deep Delta Lake and streaming expertise, moving back toward hands-on engineering.",
      strengths: ["Delta Lake and streaming architecture depth", "Customer-scale performance tuning", "Strong communicator"],
      concerns: ["Three years since a hands-on IC role"],
      prior: [{ company: "Databricks", title: "Solutions Architect", years: "2021–now" }, { company: "Capital One", title: "Data Engineer", years: "2017–2021" }],
      roleId: dataPlatformRole.id, sourceId: srcInbound.id, stage: "Hiring Manager Review",
      appliedDaysAgo: 4, stageEnteredHoursAgo: 30, lastActivityHoursAgo: 30, lastCandidateUpdateHoursAgo: 30,
    },
    {
      name: "Isabelle Fontaine", email: "isabelle.fontaine@gmail.com", location: "New York, NY",
      company: "Goldman Sachs", title: "VP, Data Engineering",
      summary: "Market-data platform VP at Goldman. Offer extended Monday; deciding by Thursday. Weekly check-in cadence agreed.",
      strengths: ["Point-in-time market data correctness expertise", "kdb+ and time-series depth", "Led a 6-person platform team"],
      concerns: ["Goldman counteroffer likely"],
      prior: [{ company: "Goldman Sachs", title: "VP, Data Engineering", years: "2017–now" }, { company: "BAML", title: "Associate", years: "2014–2017" }],
      roleId: dataPlatformRole.id, sourceId: srcSourced.id, stage: "Offer Extended",
      appliedDaysAgo: 30, stageEnteredHoursAgo: 40, lastActivityHoursAgo: 16, lastCandidateUpdateHoursAgo: 16,
    },
    {
      name: "Grace Osei", email: "grace.osei.talent@gmail.com", location: "New York, NY",
      company: "Ramp", title: "Senior Technical Recruiter",
      summary: "Senior technical recruiter who built Ramp's infra-hiring engine. Phone screen with Laura tomorrow. Healthy process.",
      strengths: ["Built metrics-driven recruiting ops at Ramp", "Closed senior infra and security talent", "Managed two sourcers"],
      concerns: ["No quant-finance recruiting exposure"],
      prior: [{ company: "Ramp", title: "Senior Technical Recruiter", years: "2021–now" }, { company: "Google", title: "Technical Recruiter", years: "2017–2021" }],
      roleId: recruitingLeadRole.id, sourceId: srcReferral.id, stage: "Phone Screen",
      appliedDaysAgo: 6, stageEnteredHoursAgo: 30, lastActivityHoursAgo: 10, lastCandidateUpdateHoursAgo: 10,
    },
    {
      name: "Michael O'Brien", email: "mobrien.recruiting@gmail.com", location: "New York, NY",
      company: "Citadel", title: "Recruiting Manager",
      summary: "Recruiting manager at Citadel. Withdrew after accepting a counteroffer — process had slowed at the hiring-manager stage for a week.",
      strengths: ["Deep quant-recruiting network", "Agency management experience"],
      concerns: ["Withdrew: accepted internal counteroffer after our HM review sat 7 days"],
      prior: [{ company: "Citadel", title: "Recruiting Manager", years: "2019–now" }, { company: "Selby Jennings", title: "Principal Consultant", years: "2015–2019" }],
      roleId: recruitingLeadRole.id, sourceId: srcMeridian.id, stage: "Hiring Manager Review",
      status: "WITHDRAWN", resolutionReason: "Accepted counteroffer; cited slow process",
      appliedDaysAgo: 16, stageEnteredHoursAgo: 240, lastActivityHoursAgo: 96, lastCandidateUpdateHoursAgo: 96,
    },
  ];

  const apps: Record<string, string> = {}; // candidate name -> applicationId
  const candIds: Record<string, string> = {};

  for (const s of specs) {
    const cand = await db.candidate.create({
      data: {
        organizationId: orgId, name: s.name, email: s.email, location: s.location,
        currentCompany: s.company, currentTitle: s.title, summary: s.summary,
        strengths: j(s.strengths), concerns: j(s.concerns), priorCompanies: j(s.prior),
        competingProcess: s.competingProcess ?? null,
        competingDeadline: s.competingDeadline ?? null,
        createdAt: daysAgo(s.appliedDaysAgo),
      },
    });
    candIds[s.name] = cand.id;
    const app = await db.application.create({
      data: {
        candidateId: cand.id, roleId: s.roleId, stageId: S(s.stage), sourceId: s.sourceId,
        status: s.status ?? "ACTIVE",
        resolutionReason: s.resolutionReason ?? null,
        appliedAt: daysAgo(s.appliedDaysAgo),
        stageEnteredAt: hoursAgo(s.stageEnteredHoursAgo),
        lastActivityAt: hoursAgo(s.lastActivityHoursAgo),
        lastCandidateUpdateAt: hoursAgo(s.lastCandidateUpdateHoursAgo),
      },
    });
    apps[s.name] = app.id;

    // Baseline audit trail: submission + entry into current stage.
    await db.auditLog.create({
      data: {
        organizationId: orgId, applicationId: app.id, actorType: "SYSTEM",
        actorName: "Greenhouse Sync", eventType: "SUBMISSION",
        title: "Application received",
        detail: "Application created and synced from the ATS.",
        createdAt: daysAgo(s.appliedDaysAgo),
      },
    });
    if (s.stage !== "Recruiter Review") {
      await db.auditLog.create({
        data: {
          organizationId: orgId, applicationId: app.id, actorType: "HUMAN",
          actorName: "Recruiting Team", eventType: "STAGE_CHANGE",
          title: `Advanced to ${s.stage}`,
          previousState: "Earlier stage", newState: s.stage,
          createdAt: hoursAgo(s.stageEnteredHoursAgo),
        },
      });
    }
    if (s.status === "WITHDRAWN") {
      await db.auditLog.create({
        data: {
          organizationId: orgId, applicationId: app.id, actorType: "HUMAN",
          actorName: s.name, eventType: "WITHDRAWAL",
          title: "Candidate withdrew",
          detail: s.resolutionReason ?? undefined,
          previousState: "ACTIVE", newState: "WITHDRAWN",
          createdAt: hoursAgo(s.lastActivityHoursAgo),
        },
      });
    }
    if (s.status === "REJECTED") {
      await db.auditLog.create({
        data: {
          organizationId: orgId, applicationId: app.id, actorType: "HUMAN",
          actorName: "Dana Foster", eventType: "REJECTION",
          title: "Closed out after debrief",
          detail: s.resolutionReason ?? undefined,
          previousState: "ACTIVE", newState: "REJECTED",
          createdAt: hoursAgo(s.lastActivityHoursAgo),
        },
      });
    }
  }

  // ---------------- Interviews + feedback ----------------
  const mkInterview = async (
    appName: string, name: string, status: string, scheduledAt: Date | null,
    panel: { id: string }[], feedback: { userId: string; status: string; rating?: string; summary?: string; dueAt: Date; submittedAt?: Date }[],
    durationMins = 60
  ) => {
    const iv = await db.interview.create({
      data: {
        applicationId: apps[appName], name, status, scheduledAt, durationMins,
      },
    });
    for (const p of panel) {
      await db.interviewPanelist.create({ data: { interviewId: iv.id, userId: p.id } });
    }
    for (const f of feedback) {
      await db.feedback.create({
        data: {
          interviewId: iv.id, interviewerId: f.userId, status: f.status,
          rating: f.rating ?? null, summary: f.summary ?? null,
          dueAt: f.dueAt, submittedAt: f.submittedAt ?? null,
        },
      });
    }
    return iv;
  };

  // Wei Zhang — onsite done 26h ago, 2 of 3 scorecards overdue
  await mkInterview("Wei Zhang", "Onsite — Research Panel", "COMPLETED", hoursAgo(26),
    [ben, grace, david],
    [
      { userId: ben.id, status: "SUBMITTED", rating: "YES", summary: "Strong live-trading intuition; alpha ideas were concrete and testable. Slight concern on depth outside equities.", dueAt: hoursAgo(14), submittedAt: hoursAgo(20) },
      { userId: grace.id, status: "PENDING", dueAt: hoursAgo(14) },
      { userId: david.id, status: "PENDING", dueAt: hoursAgo(14) },
    ]);
  await mkInterview("Wei Zhang", "Phone Screen", "COMPLETED", daysAgo(12),
    [ben],
    [{ userId: ben.id, status: "SUBMITTED", rating: "STRONG_YES", summary: "Clear thinker, strong stats fundamentals.", dueAt: daysAgo(11.5), submittedAt: daysAgo(11.6) }]);

  // Emily Nakamura — onsite done 22h ago, 1 scorecard overdue
  await mkInterview("Emily Nakamura", "Onsite — Platform Panel", "COMPLETED", hoursAgo(22),
    [omar, nina],
    [
      { userId: omar.id, status: "SUBMITTED", rating: "STRONG_YES", summary: "Best system-design round I've run this year. Deep, calm, practical.", dueAt: hoursAgo(10), submittedAt: hoursAgo(16) },
      { userId: nina.id, status: "PENDING", dueAt: hoursAgo(10) },
    ]);

  // Ravi Patel — technical interview tomorrow
  await mkInterview("Ravi Patel", "Technical Interview", "SCHEDULED", inHours(20),
    [grace, omar],
    [
      { userId: grace.id, status: "PENDING", dueAt: inHours(32) },
      { userId: omar.id, status: "PENDING", dueAt: inHours(32) },
    ], 90);

  // Tomás Silva — phone screen needs scheduling (blocker)
  await mkInterview("Tomás Silva", "Phone Screen", "NEEDS_SCHEDULING", null,
    [dana], [{ userId: dana.id, status: "PENDING", dueAt: inHours(72) }], 45);

  // Alina Volkov — onsite in 2 days
  await mkInterview("Alina Volkov", "Onsite — Research Panel", "SCHEDULED", inDays(2),
    [ben, david, james],
    [
      { userId: ben.id, status: "PENDING", dueAt: inDays(2.5) },
      { userId: david.id, status: "PENDING", dueAt: inDays(2.5) },
      { userId: james.id, status: "PENDING", dueAt: inDays(2.5) },
    ], 240);

  // Yuna Park — technical interview cancelled 8 days ago
  await mkInterview("Yuna Park", "Technical Interview", "CANCELLED", daysAgo(8),
    [yuki], [], 90);

  // Lucas Weber — onsite Thursday
  await mkInterview("Lucas Weber", "Onsite — Trading Systems Panel", "SCHEDULED", inDays(2),
    [yuki, kenji],
    [
      { userId: yuki.id, status: "PENDING", dueAt: inDays(2.5) },
      { userId: kenji.id, status: "PENDING", dueAt: inDays(2.5) },
    ], 240);

  // Grace Osei — phone screen tomorrow
  await mkInterview("Grace Osei", "Phone Screen", "SCHEDULED", inHours(26),
    [laura], [{ userId: laura.id, status: "PENDING", dueAt: inHours(38) }], 45);

  // Jordan Lee — completed onsite, all feedback in
  await mkInterview("Jordan Lee", "Onsite — Platform Panel", "COMPLETED", daysAgo(5),
    [omar, nina, alex],
    [
      { userId: omar.id, status: "SUBMITTED", rating: "STRONG_YES", summary: "Ran GPU capacity planning better than we do. Hire.", dueAt: daysAgo(4.5), submittedAt: daysAgo(4.6) },
      { userId: nina.id, status: "SUBMITTED", rating: "YES", summary: "Strong on scheduling internals; slightly light on storage.", dueAt: daysAgo(4.5), submittedAt: daysAgo(4.4) },
      { userId: alex.id, status: "SUBMITTED", rating: "STRONG_YES", summary: "Clear strong hire. Move fast — he has competing interest.", dueAt: daysAgo(4.5), submittedAt: daysAgo(4.5) },
    ]);

  // ---------------- Communications ----------------
  const mkComm = (appName: string, direction: string, channel: string, subject: string, body: string, sentBy: { id: string } | null, sentAtHoursAgo: number, candidateFacing: boolean) =>
    db.communication.create({
      data: {
        applicationId: apps[appName], direction, channel, subject, body,
        sentById: sentBy?.id ?? null, sentAt: hoursAgo(sentAtHoursAgo), candidateFacing,
      },
    });

  await mkComm("Maya Chen", "OUTBOUND", "EMAIL", "Helios Capital — Senior Quant Researcher", "Hi Maya — great speaking today. Sharing the role brief for the mid-frequency equities seat. James (desk head) will review your background this week.", sarah, 78, true);
  await mkComm("Maya Chen", "INBOUND", "EMAIL", "Re: Helios Capital — Senior Quant Researcher", "Thanks Sarah. Quick flag: my Citadel process moved to a final round scheduled Friday. Helios is my first choice if timing works.", null, 70, true);
  await mkComm("Maya Chen", "INTERNAL", "SLACK", "Maya Chen — timing risk", "Flagging to @james.wu: Maya has a Citadel final on Friday. Profile in your queue since Monday.", sarah, 50, false);
  await mkComm("Daniel Reyes", "OUTBOUND", "EMAIL", "Application received — Senior Quant Researcher", "Hi Daniel, thanks for applying. Your application is with our recruiting team and you'll hear from us within two business days.", elena, 52, true);
  await mkComm("Alina Volkov", "OUTBOUND", "EMAIL", "Onsite confirmed — Thursday", "Hi Alina, your onsite is confirmed for Thursday 10:00–14:00: research panel with Ben, David, and James. Agenda attached.", sarah, 22, true);
  await mkComm("Wei Zhang", "OUTBOUND", "EMAIL", "Onsite follow-up", "Hi Wei, thanks for a great onsite yesterday. We're consolidating panel feedback and will come back within two business days.", sarah, 24, true);
  await mkComm("Tomás Silva", "OUTBOUND", "EMAIL", "Next step: phone screen with Dana Foster", "Hi Tomás — Dana would love to speak. I'll follow up with scheduling options shortly.", marcus, 50, true);
  await mkComm("Ravi Patel", "OUTBOUND", "EMAIL", "Technical interview confirmed", "Hi Ravi, confirming your 90-minute technical interview tomorrow with Grace and Omar. Format: numerical computing deep-dive plus a pairing exercise.", marcus, 12, true);
  await mkComm("Jordan Lee", "OUTBOUND", "EMAIL", "Update on your Helios process", "Hi Jordan — panel feedback was outstanding. We're finalizing internal approvals now; expect an update from me tomorrow at the latest.", priya, 20, true);
  await mkComm("Jordan Lee", "INTERNAL", "SLACK", "Jordan Lee offer approval", "Comp packet with finance since yesterday 9am. He's holding an Anthropic offer. Need sign-off today.", priya, 8, false);
  await mkComm("Emily Nakamura", "OUTBOUND", "EMAIL", "Thanks for a great onsite", "Hi Emily, thank you for the time yesterday. We're gathering final feedback and will be in touch shortly.", priya, 20, true);
  await mkComm("Amara Diallo", "OUTBOUND", "EMAIL", "Phone screen scheduling", "Hi Amara — sending over times for a phone screen with the platform team.", priya, 126, true);
  await mkComm("Chris Thompson", "OUTBOUND", "EMAIL", "Helios Trading Systems — next steps", "Hi Chris, your background is exactly what the desk is looking for. Kenji is reviewing your profile this week.", tom, 100, true);
  await mkComm("Lucas Weber", "OUTBOUND", "EMAIL", "Onsite agenda — Thursday", "Hi Lucas, sharing Thursday's onsite agenda: systems deep-dive with Yuki, then desk session with Kenji.", tom, 8, true);
  await mkComm("Fatima Al-Rashid", "OUTBOUND", "EMAIL", "Application received — Data Platform Engineer", "Hi Fatima, thanks for applying! Your application is in review; you'll hear from us within two business days.", elena, 6, true);
  await mkComm("Isabelle Fontaine", "OUTBOUND", "EMAIL", "Your Helios offer", "Hi Isabelle — wonderful speaking earlier. Formal offer attached; happy to walk through comp structure whenever helpful. We're excited.", elena, 40, true);
  await mkComm("Isabelle Fontaine", "INBOUND", "EMAIL", "Re: Your Helios offer", "Thank you! Reviewing with my family — I'll have a decision by Thursday as discussed.", null, 16, true);
  await mkComm("Grace Osei", "OUTBOUND", "EMAIL", "Phone screen with Laura Chen", "Hi Grace, confirming your call with Laura tomorrow at 11:00. Looking forward to it!", sarah, 10, true);
  await mkComm("Yuna Park", "OUTBOUND", "EMAIL", "Rescheduling your technical interview", "Hi Yuna, completely understood re: the family emergency — no rush at all. Let me know when you're ready to pick a new time.", tom, 195, true);
  await mkComm("Sofia Marino", "OUTBOUND", "EMAIL", "Update on your Research Engineer application", "Hi Sofia, thank you for the deep conversations with our panel. We've decided not to move forward for this particular role — but we were genuinely impressed and may be in touch about a better fit.", marcus, 72, true);

  // Internal review notes — visible in the HM review sheet and on timelines.
  await mkComm("Hannah Goldberg", "INTERNAL", "NOTE", "Review note", "Referral signal is strong — fast-track if the phone screen confirms the C++ depth.", dana, 15, false);
  await mkComm("Daniel Reyes", "INTERNAL", "NOTE", "Review note", "Second quant candidate for James — worth ranking against Maya before Thursday's desk sync.", sarah, 20, false);
  await mkComm("Chris Thompson", "INTERNAL", "NOTE", "Review note", "Kenji is traveling this week — may need a desk-head ping to get the review done.", tom, 40, false);

  // ---------------- Human-owned open actions (healthy pipelines) ----------------
  const mkAction = (
    appName: string, type: string, title: string, content: string, rationale: string,
    facts: string[], owner: { id: string }, recipient: { id: string } | null,
    status: string, risk: string, dueInHours: number, createdHoursAgo: number,
    createdBy = "HUMAN", completedHoursAgo?: number
  ) =>
    db.action.create({
      data: {
        applicationId: apps[appName], type, title, proposedContent: content,
        rationale, supportingFacts: j(facts), ownerId: owner.id,
        recipientId: recipient?.id ?? null, status, risk,
        approvalMode: "APPROVAL_REQUIRED", createdBy,
        dueAt: inHours(dueInHours), createdAt: hoursAgo(createdHoursAgo),
        completedAt: completedHoursAgo !== undefined ? hoursAgo(completedHoursAgo) : null,
      },
    });

  await mkAction("Alina Volkov", "TASK", "Prepare onsite panel brief for Alina Volkov",
    "Circulate the interview brief to Ben, David, and James: focus areas are alternative-data alpha and production ownership. Confirm room bookings.",
    "Onsite is confirmed for Thursday; the panel needs the brief 24h ahead.",
    ["Onsite scheduled Thursday 10:00", "Panel: Ben Torres, David Stein, James Wu"],
    sarah, null, "IN_PROGRESS", "LOW", 18, 20);

  await mkAction("Daniel Reyes", "TASK", "Review Daniel Reyes' profile",
    "Review against the quant criteria and rank against Maya Chen before the desk sync.",
    "Second candidate in James's review queue; 26h in, inside the 48h SLA.",
    ["Entered Hiring Manager Review 26h ago", "James also has Maya Chen waiting (higher urgency)"],
    james, null, "IN_PROGRESS", "LOW", 20, 24);

  await mkAction("Hannah Goldberg", "TASK", "Review Hannah Goldberg's profile",
    "Review profile and confirm advance to phone screen. Referral from HRT contact — internal signal is strong.",
    "In HM review 20h; within the 48h SLA. Keeping it visible so it stays that way.",
    ["Entered Hiring Manager Review 20h ago", "Referral source with strong internal signal"],
    dana, null, "IN_PROGRESS", "LOW", 24, 18);

  await mkAction("Ravi Patel", "TASK", "Confirm interview logistics for Ravi Patel",
    "Confirm the pairing-exercise environment is set up and both interviewers have the packet.",
    "Technical interview is tomorrow; logistics should be locked today.",
    ["Interview scheduled tomorrow, 90 min", "Panel: Grace Liu, Omar Haddad"],
    marcus, null, "IN_PROGRESS", "LOW", 10, 12);

  await mkAction("Amara Diallo", "TASK", "Send phone-screen prep materials to Amara",
    "Send the platform-team prep doc and interviewer bios ahead of the phone screen.",
    "Screen is scheduled; candidate has an internal-transfer offer competing for attention.",
    ["Phone screen scheduled", "Candidate weighing internal Meta transfer"],
    priya, null, "IN_PROGRESS", "LOW", 30, 24);

  await mkAction("Fatima Al-Rashid", "TASK", "Review Fatima Al-Rashid's application",
    "Review the application against the data platform criteria; fresh inbound, 6h old.",
    "Inside the 24h recruiter-review SLA; due within 18h to stay there.",
    ["Application received 6h ago", "Recruiter review SLA: 24h"],
    elena, null, "IN_PROGRESS", "LOW", 18, 5);

  await mkAction("Isabelle Fontaine", "TASK", "Await Isabelle's decision — check in Thursday",
    "Offer decision promised by Thursday. Prep a counteroffer-response plan with Miriam in case Goldman counters.",
    "Candidate committed to a Thursday decision; a mid-window nudge risks pressure without benefit.",
    ["Offer extended Monday", "Decision promised Thursday", "Goldman counteroffer likely"],
    elena, null, "WAITING", "MEDIUM", 44, 38);

  await mkAction("Lucas Weber", "TASK", "Finalize Lucas Weber's onsite agenda",
    "Lock Thursday's schedule with Yuki and Kenji; confirm the desk session runs during market hours as requested.",
    "Onsite is in 2 days; desk-session timing needs Kenji's confirmation.",
    ["Onsite Thursday", "Desk session requested during market hours"],
    tom, null, "IN_PROGRESS", "LOW", 20, 8);

  await mkAction("Grace Osei", "TASK", "Prep Laura for Grace Osei's phone screen",
    "Share Grace's portfolio of recruiting-ops dashboards with Laura before tomorrow's call.",
    "Screen is tomorrow; Laura asked for materials in advance.",
    ["Phone screen tomorrow 11:00", "Laura requested prep materials"],
    sarah, null, "IN_PROGRESS", "LOW", 22, 10);

  // Completed actions this week (for the Command Center stat + Executed tab)
  await mkAction("Alina Volkov", "SCHEDULING", "Schedule Alina Volkov's onsite",
    "Coordinated Thursday onsite with the research panel.", "Onsite needed within the week per James.",
    ["Panel availability confirmed"], sarah, null, "COMPLETED", "LOW", -20, 60, "HUMAN", 22);
  await mkAction("Ravi Patel", "SCHEDULING", "Schedule Ravi Patel's technical interview",
    "Booked 90-minute technical for tomorrow.", "Advanced from HM review Monday.",
    ["Grace and Omar confirmed"], marcus, null, "COMPLETED", "LOW", -30, 70, "HUMAN", 36);
  await mkAction("Jordan Lee", "STAGE_ADVANCE", "Advance Jordan Lee to Offer Approval",
    "Moved to offer approval after unanimous strong-hire debrief.", "Panel consensus: strong hire.",
    ["3/3 scorecards submitted, 2 strong-yes"], priya, null, "COMPLETED", "LOW", -28, 40, "HUMAN", 30);
  await mkAction("Isabelle Fontaine", "CANDIDATE_UPDATE", "Extend offer to Isabelle Fontaine",
    "Sent the formal offer with comp breakdown.", "Approved by comp committee Monday.",
    ["Offer approved", "Comp: L6 band"], elena, null, "COMPLETED", "LOW", -40, 60, "HUMAN", 40);
  await mkAction("Grace Osei", "SCHEDULING", "Schedule Grace Osei's phone screen",
    "Booked Laura for tomorrow 11:00.", "Advanced from HM review.",
    ["Laura confirmed"], sarah, null, "COMPLETED", "LOW", -8, 30, "HUMAN", 10);
  await mkAction("Wei Zhang", "SCHEDULING", "Schedule Wei Zhang's onsite",
    "Coordinated the research panel onsite.", "Strong phone screen; James wanted a fast loop.",
    ["Panel booked"], sarah, null, "COMPLETED", "LOW", -50, 120, "HUMAN", 50);
  await mkAction("Emily Nakamura", "SCHEDULING", "Schedule Emily Nakamura's onsite",
    "Booked the platform panel.", "Meridian flagged competing processes.",
    ["Omar and Nina confirmed"], priya, null, "COMPLETED", "LOW", -46, 100, "HUMAN", 46);
  await mkAction("Maya Chen", "STAGE_ADVANCE", "Advance Maya Chen to Hiring Manager Review",
    "Advanced after recruiter screen: exceptional profile, flagged as priority.", "Screen strongly positive.",
    ["Recruiter screen: strong pass"], sarah, null, "COMPLETED", "LOW", -74, 80, "HUMAN", 74);

  // A dismissed example for the Dismissed tab
  await db.action.create({
    data: {
      applicationId: apps["Daniel Reyes"], type: "REMINDER",
      title: "Duplicate reminder: review Daniel Reyes",
      proposedContent: "Reminder to review Daniel Reyes' application.",
      rationale: "Duplicate of an existing reminder created before the weekend.",
      supportingFacts: j(["Superseded by newer reminder"]),
      ownerId: sarah.id, recipientId: sarah.id, status: "DISMISSED", risk: "LOW",
      approvalMode: "APPROVAL_REQUIRED", createdBy: "AGENT",
      dueAt: hoursAgo(20), createdAt: hoursAgo(30),
    },
  });
  await db.auditLog.create({
    data: {
      organizationId: orgId, applicationId: apps["Daniel Reyes"],
      actorType: "HUMAN", actorName: "Sarah Kim", eventType: "ACTION_DISMISSED",
      title: "Dismissed duplicate reminder", previousState: "PROPOSED", newState: "DISMISSED",
      rationale: "Duplicate of an existing reminder.", createdAt: hoursAgo(28),
    },
  });

  // Note: Nate Brooks deliberately gets NO open action — the agent's integrity
  // rule should catch it and raise a critical issue.

  // ---------------- Run the agent ----------------
  const result = await runAgent("SCHEDULED", now);
  // Second pass stabilizes derived state (e.g. risk elevation that depends on
  // actions the first pass created). It proposes nothing new — dedupe by type.
  await runAgent("SCHEDULED", new Date(now.getTime() + 1000));
  await db.agentRun.deleteMany({ where: { proposalsCount: 0 } });
  console.log(`Seeded. Agent run: ${result.summary}`);
}

main()
  .then(async () => {
    await db.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
