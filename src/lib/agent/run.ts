// Agent runner: loads the org's applications, runs the deterministic engine,
// persists new proposals as Actions, updates derived application state, and
// writes AgentRun + AuditLog records for every proposal/execution.

import { db } from "../db";
import { recommendForApplication, type AppSnapshot, type RuleContext } from "./engine";

export const APP_INCLUDE = {
  candidate: true,
  role: { include: { recruiter: true, hiringManager: true } },
  stage: true,
  source: true,
  interviews: {
    include: {
      feedback: { include: { interviewer: true } },
      panelists: { include: { user: true } },
    },
  },
  communications: true,
  actions: true,
} as const;

export async function runAgent(trigger: "SCHEDULED" | "MANUAL", now = new Date()) {
  const org = await db.organization.findFirstOrThrow();
  const rules = await db.actionRule.findMany({ where: { organizationId: org.id } });
  const ruleModes = Object.fromEntries(rules.map((r) => [r.ruleKey, r.mode]));

  const apps = (await db.application.findMany({
    where: { candidate: { organizationId: org.id } },
    include: APP_INCLUDE,
  })) as AppSnapshot[];

  const openRoles = await db.role.findMany({
    where: { organizationId: org.id, status: "OPEN" },
    select: {
      id: true,
      title: true,
      requiredCriteria: true,
      recruiterId: true,
      hiringManagerId: true,
    },
  });

  const activeCandidateIds = new Set(
    apps.filter((a) => a.status === "ACTIVE").map((a) => a.candidateId)
  );

  const ctx: RuleContext = { now, ruleModes, openRoles, activeCandidateIds };

  const run = await db.agentRun.create({
    data: {
      organizationId: org.id,
      trigger,
      startedAt: now,
      summary: "",
    },
  });

  let proposals = 0;
  let executed = 0;

  for (const app of apps) {
    const { derived, recommendations } = recommendForApplication(app, ctx);

    // Persist derived state when it changed.
    if (
      app.status === "ACTIVE" &&
      (app.momentum !== derived.momentum ||
        app.risk !== derived.risk ||
        app.blockerType !== derived.blockerType)
    ) {
      await db.application.update({
        where: { id: app.id },
        data: {
          momentum: derived.momentum,
          risk: derived.risk,
          blockerType: derived.blockerType,
          blockerDescription: derived.blockerDescription,
        },
      });
      if (derived.risk !== app.risk && (derived.risk === "HIGH" || derived.risk === "CRITICAL")) {
        await db.auditLog.create({
          data: {
            organizationId: org.id,
            applicationId: app.id,
            actorType: "AGENT",
            actorName: "Relay Agent",
            eventType: "RISK_CHANGE",
            title: `Risk elevated to ${derived.risk}`,
            previousState: app.risk,
            newState: derived.risk,
            rationale: derived.blockerDescription ?? "Derived from stage SLA and competing-process signals",
            createdAt: now,
          },
        });
      }
    }

    for (const rec of recommendations) {
      const autoExecute = !rec.requiresApproval && ruleModes[rec.ruleKey] === "AUTO_INTERNAL";
      const action = await db.action.create({
        data: {
          applicationId: app.id,
          type: rec.type,
          title: rec.title,
          proposedContent: rec.proposedContent,
          rationale: rec.rationale,
          supportingFacts: JSON.stringify(rec.supportingFacts),
          ownerId: rec.ownerId,
          recipientId: rec.recipientId,
          status: autoExecute ? "WAITING" : "PROPOSED",
          risk: rec.risk,
          approvalMode: autoExecute ? "AUTO" : "APPROVAL_REQUIRED",
          createdBy: "AGENT",
          dueAt: rec.dueAt,
          createdAt: now,
          agentRunId: run.id,
        },
      });
      proposals++;

      await db.auditLog.create({
        data: {
          organizationId: org.id,
          applicationId: app.id,
          actionId: action.id,
          actorType: "AGENT",
          actorName: "Relay Agent",
          eventType: "AGENT_PROPOSAL",
          title: rec.title,
          detail: rec.proposedContent,
          newState: autoExecute ? "WAITING" : "PROPOSED",
          rationale: rec.rationale,
          createdAt: now,
        },
      });

      if (autoExecute) {
        executed++;
        // Low-risk internal reminders are sent immediately as internal messages.
        await db.communication.create({
          data: {
            applicationId: app.id,
            direction: "INTERNAL",
            channel: "SLACK",
            subject: rec.title,
            body: rec.proposedContent,
            sentAt: now,
            candidateFacing: false,
          },
        });
        await db.auditLog.create({
          data: {
            organizationId: org.id,
            applicationId: app.id,
            actionId: action.id,
            actorType: "AGENT",
            actorName: "Relay Agent",
            eventType: "AGENT_EXECUTION",
            title: `Sent internal reminder: ${rec.title}`,
            previousState: "PROPOSED",
            newState: "WAITING",
            rationale: `Rule mode is "Automatic internal action" and the action is low-risk internal.`,
            createdAt: now,
          },
        });
      }
    }
  }

  const blocked = await db.application.count({
    where: { status: "ACTIVE", momentum: { in: ["BLOCKED", "AT_RISK"] } },
  });

  const summary = `Reviewed ${apps.length} applications · ${proposals} proposals · ${executed} auto-executed internal actions · ${blocked} applications blocked or at risk`;

  await db.agentRun.update({
    where: { id: run.id },
    data: { finishedAt: new Date(now.getTime() + 1000), summary, proposalsCount: proposals },
  });

  return { runId: run.id, proposals, executed, summary };
}
