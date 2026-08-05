"use server";

// All state mutations flow through these server actions. Every mutation that
// touches an agent action writes an AuditLog entry (who, what, previous state,
// new state, rationale, human vs agent).

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { runAgent } from "@/lib/agent/run";
import { CURRENT_USER_EMAIL } from "@/lib/current-user";

async function currentUser() {
  return db.user.findUniqueOrThrow({ where: { email: CURRENT_USER_EMAIL } });
}

async function audit(data: {
  applicationId?: string | null;
  actionId?: string | null;
  actorType: "HUMAN" | "AGENT" | "SYSTEM";
  actorName: string;
  eventType: string;
  title: string;
  detail?: string;
  previousState?: string;
  newState?: string;
  rationale?: string;
}) {
  const org = await db.organization.findFirstOrThrow();
  await db.auditLog.create({
    data: { organizationId: org.id, ...data },
  });
}

function refresh() {
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------------
// Action lifecycle
// ---------------------------------------------------------------------------

/**
 * Approving a proposed action lets the agent execute it:
 * message-type actions send a communication; the action moves to WAITING
 * (on a recipient) or COMPLETED (candidate updates), task-types to APPROVED.
 */
export async function approveAction(actionId: string) {
  const user = await currentUser();
  const action = await db.action.findUniqueOrThrow({
    where: { id: actionId },
    include: { application: { include: { candidate: true } }, recipient: true },
  });
  if (!["PROPOSED", "WAITING"].includes(action.status)) return;

  const messageTypes = ["REMINDER", "ESCALATION", "FEEDBACK_REQUEST", "CANDIDATE_UPDATE", "OFFER_APPROVAL"];
  const isMessage = messageTypes.includes(action.type);
  const isCandidateFacing = action.type === "CANDIDATE_UPDATE";
  const newStatus = isCandidateFacing ? "COMPLETED" : isMessage ? "WAITING" : "APPROVED";

  await db.action.update({
    where: { id: actionId },
    data: {
      status: newStatus,
      completedAt: newStatus === "COMPLETED" ? new Date() : null,
    },
  });

  if (isMessage) {
    await db.communication.create({
      data: {
        applicationId: action.applicationId,
        direction: isCandidateFacing ? "OUTBOUND" : "INTERNAL",
        channel: isCandidateFacing ? "EMAIL" : "SLACK",
        subject: action.title,
        body: action.proposedContent,
        sentById: user.id,
        sentAt: new Date(),
        candidateFacing: isCandidateFacing,
      },
    });
  }

  await db.application.update({
    where: { id: action.applicationId },
    data: {
      lastActivityAt: new Date(),
      ...(isCandidateFacing ? { lastCandidateUpdateAt: new Date() } : {}),
    },
  });

  await audit({
    applicationId: action.applicationId,
    actionId: action.id,
    actorType: "HUMAN",
    actorName: user.name,
    eventType: "ACTION_APPROVED",
    title: `Approved: ${action.title}`,
    detail: isMessage ? `Agent executed — ${isCandidateFacing ? "email sent to candidate" : "internal message sent"}.` : undefined,
    previousState: action.status,
    newState: newStatus,
    rationale: action.rationale,
  });

  if (isMessage) {
    await audit({
      applicationId: action.applicationId,
      actionId: action.id,
      actorType: "AGENT",
      actorName: "Relay Agent",
      eventType: "AGENT_EXECUTION",
      title: isCandidateFacing
        ? `Sent status update to ${action.application.candidate.name}`
        : `Sent: ${action.title}`,
      detail: action.proposedContent,
      newState: newStatus,
      rationale: "Executed after human approval.",
    });
  }

  refresh();
}

export async function editAction(
  actionId: string,
  updates: { title?: string; proposedContent?: string; dueAt?: string; risk?: string }
) {
  const user = await currentUser();
  const action = await db.action.findUniqueOrThrow({ where: { id: actionId } });
  await db.action.update({
    where: { id: actionId },
    data: {
      ...(updates.title !== undefined ? { title: updates.title } : {}),
      ...(updates.proposedContent !== undefined ? { proposedContent: updates.proposedContent } : {}),
      ...(updates.dueAt !== undefined ? { dueAt: new Date(updates.dueAt) } : {}),
      ...(updates.risk !== undefined ? { risk: updates.risk } : {}),
    },
  });
  await audit({
    applicationId: action.applicationId,
    actionId: action.id,
    actorType: "HUMAN",
    actorName: user.name,
    eventType: "ACTION_EDITED",
    title: `Edited draft: ${updates.title ?? action.title}`,
    previousState: action.proposedContent,
    newState: updates.proposedContent ?? action.proposedContent,
    rationale: "Human revised the agent draft before execution.",
  });
  refresh();
}

export async function dismissAction(actionId: string, reason?: string) {
  const user = await currentUser();
  const action = await db.action.findUniqueOrThrow({ where: { id: actionId } });
  if (["COMPLETED", "DISMISSED"].includes(action.status)) return;
  await db.action.update({ where: { id: actionId }, data: { status: "DISMISSED" } });
  await audit({
    applicationId: action.applicationId,
    actionId: action.id,
    actorType: "HUMAN",
    actorName: user.name,
    eventType: "ACTION_DISMISSED",
    title: `Dismissed: ${action.title}`,
    previousState: action.status,
    newState: "DISMISSED",
    rationale: reason || "Dismissed without a stated reason.",
  });
  refresh();
}

/** "Wait": push the due date out and log the delay. */
export async function delayAction(actionId: string, hours = 24) {
  const user = await currentUser();
  const action = await db.action.findUniqueOrThrow({ where: { id: actionId } });
  const newDue = new Date(Math.max(action.dueAt.getTime(), Date.now()) + hours * 3600_000);
  await db.action.update({ where: { id: actionId }, data: { dueAt: newDue } });
  await audit({
    applicationId: action.applicationId,
    actionId: action.id,
    actorType: "HUMAN",
    actorName: user.name,
    eventType: "ACTION_DELAYED",
    title: `Delayed ${hours}h: ${action.title}`,
    previousState: action.dueAt.toISOString(),
    newState: newDue.toISOString(),
    rationale: `Human chose to wait ${hours}h before acting.`,
  });
  refresh();
}

export async function completeAction(actionId: string) {
  const user = await currentUser();
  const action = await db.action.findUniqueOrThrow({ where: { id: actionId } });
  if (["COMPLETED", "DISMISSED"].includes(action.status)) return;
  await db.action.update({
    where: { id: actionId },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
  await db.application.update({
    where: { id: action.applicationId },
    data: { lastActivityAt: new Date() },
  });
  await audit({
    applicationId: action.applicationId,
    actionId: action.id,
    actorType: "HUMAN",
    actorName: user.name,
    eventType: "ACTION_COMPLETED",
    title: `Completed: ${action.title}`,
    previousState: action.status,
    newState: "COMPLETED",
  });
  refresh();
}

export async function changeActionOwner(actionId: string, ownerId: string) {
  const user = await currentUser();
  const action = await db.action.findUniqueOrThrow({
    where: { id: actionId },
    include: { owner: true },
  });
  const newOwner = await db.user.findUniqueOrThrow({ where: { id: ownerId } });
  await db.action.update({ where: { id: actionId }, data: { ownerId } });
  await audit({
    applicationId: action.applicationId,
    actionId: action.id,
    actorType: "HUMAN",
    actorName: user.name,
    eventType: "OWNER_CHANGED",
    title: `Reassigned "${action.title}" to ${newOwner.name}`,
    previousState: action.owner.name,
    newState: newOwner.name,
  });
  refresh();
}

export async function bulkApproveActions(actionIds: string[]) {
  for (const id of actionIds) {
    const action = await db.action.findUnique({ where: { id } });
    // Safety: bulk approval is only for low-risk internal actions.
    if (action && action.risk === "LOW" && action.status === "PROPOSED") {
      await approveAction(id);
    }
  }
  refresh();
}

// ---------------------------------------------------------------------------
// Application mutations
// ---------------------------------------------------------------------------

export async function updateApplicationStage(applicationId: string, stageId: string) {
  const user = await currentUser();
  const app = await db.application.findUniqueOrThrow({
    where: { id: applicationId },
    include: { stage: true, candidate: true },
  });
  const stage = await db.pipelineStage.findUniqueOrThrow({ where: { id: stageId } });
  await db.application.update({
    where: { id: applicationId },
    data: {
      stageId,
      stageEnteredAt: new Date(),
      lastActivityAt: new Date(),
      momentum: "MOVING",
      risk: "LOW",
      blockerType: "NONE",
      blockerDescription: null,
      ...(stage.name === "Hired" ? { status: "HIRED" } : {}),
    },
  });
  await audit({
    applicationId,
    actorType: "HUMAN",
    actorName: user.name,
    eventType: "STAGE_CHANGE",
    title: `Moved ${app.candidate.name} to ${stage.name}`,
    previousState: app.stage.name,
    newState: stage.name,
  });
  refresh();
}

export async function addNote(applicationId: string, body: string) {
  const user = await currentUser();
  if (!body.trim()) return;
  await db.communication.create({
    data: {
      applicationId,
      direction: "INTERNAL",
      channel: "NOTE",
      subject: "Note",
      body: body.trim(),
      sentById: user.id,
      sentAt: new Date(),
      candidateFacing: false,
    },
  });
  await db.application.update({
    where: { id: applicationId },
    data: { lastActivityAt: new Date() },
  });
  refresh();
}

// ---------------------------------------------------------------------------
// Automations
// ---------------------------------------------------------------------------

export async function toggleAutomation(ruleId: string, active: boolean) {
  const user = await currentUser();
  const rule = await db.actionRule.findUniqueOrThrow({ where: { id: ruleId } });
  await db.actionRule.update({
    where: { id: ruleId },
    data: { active, ...(active === false ? {} : {}) },
  });
  await audit({
    actorType: "HUMAN",
    actorName: user.name,
    eventType: "RULE_CHANGED",
    title: `${active ? "Enabled" : "Disabled"} automation: ${rule.name}`,
    previousState: rule.active ? "active" : "inactive",
    newState: active ? "active" : "inactive",
  });
  refresh();
}

export async function setAutomationMode(ruleId: string, mode: string) {
  const user = await currentUser();
  const rule = await db.actionRule.findUniqueOrThrow({ where: { id: ruleId } });
  await db.actionRule.update({
    where: { id: ruleId },
    data: { mode, active: mode !== "DISABLED" },
  });
  await audit({
    actorType: "HUMAN",
    actorName: user.name,
    eventType: "RULE_CHANGED",
    title: `Changed "${rule.name}" mode`,
    previousState: rule.mode,
    newState: mode,
  });
  refresh();
}

export async function createAutomationRule(input: {
  name: string;
  trigger: string;
  conditions: string[];
  proposedAction: string;
  mode: string;
  escalationPath: string;
  slaHours: number;
}) {
  const user = await currentUser();
  const org = await db.organization.findFirstOrThrow();
  const ruleKey =
    "custom-" +
    input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) +
    "-" + Date.now().toString(36);
  await db.actionRule.create({
    data: {
      organizationId: org.id,
      ruleKey,
      name: input.name,
      trigger: input.trigger,
      conditions: JSON.stringify(input.conditions),
      proposedAction: input.proposedAction,
      mode: input.mode,
      escalationPath: input.escalationPath,
      slaHours: input.slaHours,
      active: input.mode !== "DISABLED",
    },
  });
  await audit({
    actorType: "HUMAN",
    actorName: user.name,
    eventType: "RULE_CREATED",
    title: `Created automation: ${input.name}`,
    newState: input.mode,
  });
  refresh();
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export async function runAgentNow() {
  const result = await runAgent("MANUAL");
  refresh();
  return result;
}
