// Single source of truth for the string pseudo-enums stored in SQLite.
// When migrating to PostgreSQL these can be promoted to native Prisma enums.

export const ACTION_STATUSES = [
  "PROPOSED",
  "APPROVED",
  "IN_PROGRESS",
  "WAITING",
  "COMPLETED",
  "DISMISSED",
  "FAILED",
] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

export const RISK_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const MOMENTUM = ["MOVING", "SLOWING", "BLOCKED", "AT_RISK"] as const;
export type Momentum = (typeof MOMENTUM)[number];

export const APPLICATION_STATUSES = [
  "ACTIVE",
  "REJECTED",
  "WITHDRAWN",
  "HIRED",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const BLOCKER_TYPES = [
  "NONE",
  "RECRUITER",
  "HIRING_MANAGER",
  "SCHEDULING",
  "FEEDBACK",
  "OFFER_APPROVAL",
  "CANDIDATE",
] as const;
export type BlockerType = (typeof BLOCKER_TYPES)[number];

export const ACTION_TYPES = [
  "REMINDER",
  "ESCALATION",
  "SCHEDULING",
  "CANDIDATE_UPDATE",
  "FEEDBACK_REQUEST",
  "STAGE_ADVANCE",
  "REDIRECTION",
  "OFFER_APPROVAL",
  "DATA_INTEGRITY",
  "TASK",
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export const AUTOMATION_MODES = [
  "SUGGEST_ONLY",
  "AUTO_INTERNAL",
  "APPROVAL_REQUIRED",
  "DISABLED",
] as const;
export type AutomationMode = (typeof AUTOMATION_MODES)[number];

export const SOURCE_TYPES = [
  "DIRECT_SOURCING",
  "REFERRAL",
  "INBOUND",
  "AGENCY",
  "INTERNAL",
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

// ---------- Display metadata ----------

export const MOMENTUM_META: Record<
  Momentum,
  { label: string; className: string; dot: string }
> = {
  MOVING: {
    label: "Moving",
    className:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-900",
    dot: "bg-emerald-500",
  },
  SLOWING: {
    label: "Slowing",
    className:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-900",
    dot: "bg-amber-500",
  },
  BLOCKED: {
    label: "Blocked",
    className:
      "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-900",
    dot: "bg-red-500",
  },
  AT_RISK: {
    label: "At Risk",
    className:
      "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-900",
    dot: "bg-orange-500",
  },
};

export const RISK_META: Record<RiskLevel, { label: string; className: string }> = {
  LOW: {
    label: "Low",
    className:
      "bg-neutral-100 text-neutral-600 border-neutral-200 dark:bg-neutral-900 dark:text-neutral-400 dark:border-neutral-800",
  },
  MEDIUM: {
    label: "Medium",
    className:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-900",
  },
  HIGH: {
    label: "High",
    className:
      "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-900",
  },
  CRITICAL: {
    label: "Critical",
    className:
      "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-900",
  },
};

export const ACTION_STATUS_META: Record<ActionStatus, { label: string; className: string }> = {
  PROPOSED: {
    label: "Proposed",
    className:
      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-900",
  },
  APPROVED: {
    label: "Approved",
    className:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-900",
  },
  IN_PROGRESS: {
    label: "In Progress",
    className:
      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-900",
  },
  WAITING: {
    label: "Waiting",
    className:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-900",
  },
  COMPLETED: {
    label: "Completed",
    className:
      "bg-neutral-100 text-neutral-600 border-neutral-200 dark:bg-neutral-900 dark:text-neutral-400 dark:border-neutral-800",
  },
  DISMISSED: {
    label: "Dismissed",
    className:
      "bg-neutral-100 text-neutral-500 border-neutral-200 dark:bg-neutral-900 dark:text-neutral-500 dark:border-neutral-800",
  },
  FAILED: {
    label: "Failed",
    className:
      "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-900",
  },
};

export const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  REMINDER: "Reminder",
  ESCALATION: "Escalation",
  SCHEDULING: "Scheduling",
  CANDIDATE_UPDATE: "Candidate Update",
  FEEDBACK_REQUEST: "Feedback Request",
  STAGE_ADVANCE: "Stage Advance",
  REDIRECTION: "Role Redirection",
  OFFER_APPROVAL: "Offer Approval",
  DATA_INTEGRITY: "Data Integrity",
  TASK: "Task",
};

export const BLOCKER_LABELS: Record<BlockerType, string> = {
  NONE: "None",
  RECRUITER: "Recruiter review",
  HIRING_MANAGER: "Hiring manager",
  SCHEDULING: "Scheduling",
  FEEDBACK: "Feedback",
  OFFER_APPROVAL: "Offer approval",
  CANDIDATE: "Candidate",
};

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  DIRECT_SOURCING: "Sourced",
  REFERRAL: "Referral",
  INBOUND: "Inbound",
  AGENCY: "Agency",
  INTERNAL: "Redirect",
};

export const AUTOMATION_MODE_META: Record<AutomationMode, { label: string; description: string }> = {
  SUGGEST_ONLY: {
    label: "Suggest only",
    description: "Relay surfaces the recommendation; nothing happens until a human acts.",
  },
  AUTO_INTERNAL: {
    label: "Automatic internal action",
    description: "Relay executes internal, low-risk actions (reminders, tasks) automatically and logs them.",
  },
  APPROVAL_REQUIRED: {
    label: "Approval required",
    description: "Relay drafts the action and queues it for one-click human approval.",
  },
  DISABLED: {
    label: "Disabled",
    description: "This rule never fires.",
  },
};

// Structured decline reasons — every HM "no" calibrates sourcing for the role.
export const DECLINE_REASONS = [
  "Seniority",
  "Compensation",
  "Domain fit",
  "Skills gap",
  "Timing",
] as const;
export type DeclineReason = (typeof DECLINE_REASONS)[number];

// ---------- Execution receipts ----------

/** Returned by approveAction — what Relay just did, shown to the approver. */
export interface ExecutionReceipt {
  performed: string;
  recipient: string | null;
  channel: string | null;
  candidateName: string;
  resultingState: string;
  nextAction: string;
  escalation: string | null;
}

/** Returned by hmReviewDecision — the state change the decision produced. */
export interface ReviewReceipt {
  decision: "ADVANCE" | "DECLINE" | "REQUEST_INFO" | "REDIRECT";
  actor: string;
  candidateName: string;
  previousStage: string;
  newStage: string;
  momentumBefore: string;
  momentumAfter: string;
  nextAction: string;
}

// High-risk action types can never run automatically, regardless of rule mode.
export const ALWAYS_APPROVAL_ACTION_TYPES: ActionType[] = [
  "CANDIDATE_UPDATE",
  "REDIRECTION",
  "OFFER_APPROVAL",
  "ESCALATION",
];
