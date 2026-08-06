// Model-drafted action content — the seam described in ARCHITECTURE.md.
//
// The deterministic engine stays the trigger detector (SLA math must never
// hallucinate); this layer only rewrites the *message body* of a
// recommendation. It is strictly optional: it activates only when
// ANTHROPIC_API_KEY is set, and any error or invalid output falls back to the
// engine's deterministic template. Titles, risk, owners, due dates, and
// supporting facts are never model-generated.

import Anthropic from "@anthropic-ai/sdk";
import type { Recommendation } from "./engine";

const DRAFTING_MODEL = process.env.RELAY_DRAFTING_MODEL ?? "claude-opus-4-8";

let cached: Anthropic | null | undefined;

function getClient(): Anthropic | null {
  if (cached !== undefined) return cached;
  // Explicit opt-in only — the prototype must run with zero credentials.
  cached = process.env.ANTHROPIC_API_KEY
    ? new Anthropic({ timeout: 15_000, maxRetries: 1 })
    : null;
  return cached;
}

export function modelDraftingEnabled(): boolean {
  return getClient() !== null;
}

export function draftingModel(): string {
  return DRAFTING_MODEL;
}

const SYSTEM = `You draft short recruiting-operations messages for Relay, a hiring execution tool. A human recruiter reviews and approves every draft before anything is sent — you never send anything.

Rules:
- Use only the facts provided. Never invent names, dates, times, numbers, or process details.
- Keep every name, date, and deadline exactly as given.
- Be concrete and direct. Name the blocker, the ask, and the deadline. No filler, no "AI-powered" language, no exclamation marks.
- Internal messages: at most 90 words, informal-professional, address the recipient by first name.
- Candidate-facing emails: at most 130 words, warm and plain, sign with the recruiter's name.
- Return ONLY the message body as plain text. No subject line, no preamble, no quotes, no markdown.`;

export interface DraftContext {
  candidateName: string;
  roleTitle: string;
  stageName: string;
  blocker: string | null;
  competing: string | null;
  recipientName: string | null;
  recruiterName: string;
}

/**
 * Returns a model-drafted body for the recommendation, or the deterministic
 * template when drafting is disabled, fails, or produces invalid output.
 */
export async function draftProposedContent(
  rec: Recommendation,
  ctx: DraftContext
): Promise<{ content: string; drafted: boolean }> {
  const client = getClient();
  if (!client) return { content: rec.proposedContent, drafted: false };

  const isCandidateFacing = rec.type === "CANDIDATE_UPDATE" || rec.type === "REDIRECTION";
  const prompt = [
    `Action type: ${rec.type}${isCandidateFacing ? " (candidate-facing)" : " (internal)"}`,
    `Candidate: ${ctx.candidateName} — considering ${ctx.roleTitle}, currently in ${ctx.stageName}`,
    ctx.recipientName ? `Message recipient: ${ctx.recipientName}` : null,
    `Recruiter (sender for candidate emails): ${ctx.recruiterName}`,
    ctx.blocker ? `Blocker: ${ctx.blocker}` : null,
    ctx.competing ? `Timing: ${ctx.competing}` : null,
    `Why this action now: ${rec.rationale}`,
    `Supporting facts:\n${rec.supportingFacts.map((f) => `- ${f}`).join("\n")}`,
    `\nBaseline draft (improve on this without changing any facts):\n${rec.proposedContent}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await client.messages.create({
      model: DRAFTING_MODEL,
      max_tokens: 1024,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: prompt }],
    });
    if (response.stop_reason === "refusal") {
      return { content: rec.proposedContent, drafted: false };
    }
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    // Validation gate: the draft must be substantive, bounded, and still be
    // about this candidate. Anything else falls back to the template.
    const firstName = ctx.candidateName.split(" ")[0];
    const valid =
      text.length >= 20 &&
      text.length <= 2000 &&
      (text.includes(firstName) || text.includes(ctx.candidateName));
    return valid ? { content: text, drafted: true } : { content: rec.proposedContent, drafted: false };
  } catch {
    return { content: rec.proposedContent, drafted: false };
  }
}
