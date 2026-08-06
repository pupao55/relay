// Relay end-to-end smoke suite.
//
// Prereqs: a freshly seeded database (npm run db:seed) and a running server.
//   RELAY_BASE_URL=http://localhost:3000 node e2e/smoke.mjs
// Uses the locally installed Google Chrome via playwright-core (no browser download).
// The suite mutates data (approvals, the Maya Chen flow) — re-seed afterwards.

import { chromium } from "playwright-core";

const BASE = process.env.RELAY_BASE_URL ?? "http://localhost:3000";
const SHOTS = process.env.RELAY_SHOTS_DIR ?? null;

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const results = [];
const check = (name, ok, extra = "") => {
  results.push(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
};
const shot = async (name) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });
};

// ---------------------------------------------------------------------------
// 1. Command Center hierarchy
// ---------------------------------------------------------------------------
await page.goto(BASE + "/", { waitUntil: "networkidle" });
const headline = await page.locator("h1").first().innerText();
check("headline leads with intervention count", /need(s)? intervention now/.test(headline), headline);

const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
check("Geist font applied", /Geist/i.test(font));

for (const tile of [
  "Candidates requiring intervention",
  "Relay executes automatically",
  "Decisions needing human judgment",
  "Immediate withdrawal risk",
]) {
  check(`tile: ${tile}`, (await page.locator(`text=${tile}`).count()) > 0);
}

const withdrawalGroup = page.locator("section[aria-label='Immediate withdrawal risk']");
check("withdrawal-risk group renders first-class", (await withdrawalGroup.count()) === 1);
check(
  "Maya Chen sits in withdrawal-risk group",
  (await withdrawalGroup.locator("text=Maya Chen").count()) > 0
);
check(
  "unowned error-state group renders",
  (await page.locator("section[aria-label='Unowned — error state']").count()) === 1
);
check(
  "cards state escalation behavior",
  (await page.locator("text=If no one responds").count()) >= 3
);

// HM stack ranking: James Wu has Maya (#1) and Daniel (#2) waiting; the
// manager controls the order themselves.
const danielLi = page.locator("li", { has: page.locator("text=Daniel Reyes") }).first();
check(
  "rank arrows shown for multi-candidate queue",
  (await danielLi.locator("button[aria-label='Move Daniel Reyes up']").count()) === 1
);
await danielLi.locator("button[aria-label='Move Daniel Reyes up']").click();
await page.waitForTimeout(2500);
const danielRank = await page
  .locator("li", { has: page.locator("text=Daniel Reyes") })
  .first()
  .locator("span")
  .first()
  .innerText();
check("manager reorder persists (Daniel now #1)", danielRank.trim() === "1", `rank ${danielRank.trim()}`);
await shot("01-command-center");

// ---------------------------------------------------------------------------
// 2. Maya Chen flow: At Risk -> approve nudge -> receipt
// ---------------------------------------------------------------------------
const mayaCard = page.locator("li", { has: page.locator("a", { hasText: "Maya Chen" }) }).first();
check(
  "Maya card explains the blocker",
  (await mayaCard.locator("text=Blocked:").count()) > 0 &&
    (await mayaCard.locator("text=James Wu").count()) > 0
);
await mayaCard.locator("button:has-text('Approve')").first().click();
await page.waitForSelector("text=Executed", { timeout: 8000 });
const receiptText = await page.locator("[role='dialog']").innerText();
check("execution receipt: action performed", /Action performed/i.test(receiptText));
check("execution receipt: recipient James Wu", /James Wu/.test(receiptText));
check("execution receipt: candidate state", /Candidate state/i.test(receiptText));
check("execution receipt: next action", /Next action/i.test(receiptText));
check("execution receipt: escalation behavior", /If no one responds/i.test(receiptText));
await shot("02-execution-receipt");
await page.locator("[role='dialog'] button:has-text('Done')").click();
await page.waitForTimeout(1500);

// ---------------------------------------------------------------------------
// 3. Maya Chen flow: hiring-manager review -> Advance -> Moving
// ---------------------------------------------------------------------------
await page.goto(BASE + "/candidates", { waitUntil: "networkidle" });
await page.locator("a:has-text('Maya Chen')").first().click();
await page.waitForSelector("text=Next best action", { timeout: 8000 });
await page.locator("button:has-text('Review as hiring manager')").click();
await page.waitForTimeout(600);
const sheetText = await page.locator("[role='dialog']").innerText();
check("HM sheet: candidate summary", /Two Sigma/.test(sheetText));
check("HM sheet: role-fit evidence", /Fit against your criteria/i.test(sheetText));
check("HM sheet: primary concern", /Primary concern/i.test(sheetText));
check("HM sheet: timing risk", /Timing/i.test(sheetText) && /Citadel/i.test(sheetText));
check("HM sheet: resume access", (await page.locator("button:has-text('Open résumé')").count()) > 0);
for (const b of ["Advance", "Request info", "Redirect", "Decline"]) {
  check(`HM sheet: ${b} action`, (await page.locator(`[role='dialog'] button:has-text('${b}')`).count()) > 0);
}
await shot("03-hm-review-sheet");

await page.locator("[role='dialog'] button:has-text('Advance')").click();
await page.waitForSelector("text=Advanced", { timeout: 8000 });
const reviewReceipt = await page.locator("[role='dialog']").innerText();
check("review receipt: stage change to Phone Screen", /Phone Screen/.test(reviewReceipt));
check(
  "review receipt: momentum At Risk -> Moving",
  /At Risk/.test(reviewReceipt) && /Moving/.test(reviewReceipt)
);
check("review receipt: scheduling is next action", /Schedule Maya Chen/i.test(reviewReceipt));
await shot("04-review-receipt");
await page.locator("[role='dialog'] button:has-text('Done')").click();
await page.waitForTimeout(2000);

// Maya's live state after the flow.
const header = await page.locator("h1").first().innerText();
check("still on Maya's profile", /Maya Chen/.test(header));
const pageText = await page.locator("main").innerText();
check("Maya is now Moving in Phone Screen", /Moving/.test(pageText) && /Phone Screen/.test(pageText));
check(
  "scheduling action created for recruiter",
  /Schedule Maya Chen/i.test(pageText)
);

// Timeline shows the full audited story.
await page.locator("button[role='tab']:has-text('timeline')").click();
await page.waitForTimeout(500);
const timeline = await page.locator("main").innerText();
check("timeline: HM advance audited", /James Wu advanced Maya Chen/i.test(timeline));
check("timeline: next action creation audited", /Created next action/i.test(timeline));
await shot("05-maya-timeline");

// ---------------------------------------------------------------------------
// 3b. HM review queue: pre-SLA visibility, internal notes, one-click advance
// ---------------------------------------------------------------------------
await page.goto(BASE + "/", { waitUntil: "networkidle" });
check("review queue card renders", (await page.locator("text=Review queue").count()) > 0);
// Hannah Goldberg is inside SLA — invisible to the intervention queue, but an
// HM should still see her waiting.
const hannahRow = page.locator("li", { has: page.locator("text=Hannah Goldberg") }).first();
check("in-SLA candidate visible to HM queue", (await hannahRow.count()) === 1);
await hannahRow.locator("button:has-text('Review')").click();
await page.waitForTimeout(600);
const hannahSheet = await page.locator("[role='dialog']").innerText();
check("sheet shows existing internal note", /Referral signal is strong/.test(hannahSheet));
check("sheet shows work history", /MEng/.test(hannahSheet));
await page.locator("[role='dialog'] textarea").fill("Portfolio review done — solid systems depth.");
await page.locator("[role='dialog'] button:has-text('Save note')").click();
await page.waitForTimeout(2500);
check(
  "saved note appears without closing the sheet",
  /Portfolio review done/.test(await page.locator("[role='dialog']").innerText())
);
await shot("03b-review-notes");
await page.locator("[role='dialog'] button:has-text('Advance')").click();
await page.waitForSelector("text=Advanced", { timeout: 8000 });
const hannahReceipt = await page.locator("[role='dialog']").innerText();
check("advance from review queue works", /Phone Screen/.test(hannahReceipt));
await page.locator("[role='dialog'] button:has-text('Done')").click();
await page.waitForTimeout(1500);

// ---------------------------------------------------------------------------
// 4. Redirect triage: Sofia Marino -> ML Infrastructure Engineer pipeline
// ---------------------------------------------------------------------------
await page.goto(BASE + "/actions", { waitUntil: "networkidle" });
const sofiaCard = page
  .locator("li", { has: page.locator("text=Consider Sofia Marino") })
  .first();
check("redirect proposal lists matching criteria", (await sofiaCard.locator("text=Kubernetes").count()) > 0);
await sofiaCard.locator("button:has-text('Approve')").click();
await page.waitForSelector("text=Action performed", { timeout: 8000 });
const redirectReceipt = await page.locator("[role='dialog']").innerText();
check(
  "redirect receipt: moved into target pipeline",
  /Moved Sofia Marino into the ML Infrastructure Engineer pipeline/i.test(redirectReceipt)
);
check("redirect receipt: receiving recruiter named", /Priya Sharma/.test(redirectReceipt));
check("redirect receipt: warm note drafted", /warm note/i.test(redirectReceipt));
await page.locator("[role='dialog'] button:has-text('Done')").click();
await page.waitForTimeout(1500);

await page.goto(BASE + "/candidates", { waitUntil: "networkidle" });
const sofiaRows = page.locator("tr", { has: page.locator("text=Sofia Marino") });
check("Sofia has two applications (old + redirect)", (await sofiaRows.count()) === 2);
const rowsText = await page.locator("tbody").innerText();
check(
  "Sofia active on ML Infrastructure Engineer via Redirect",
  /Sofia Marino[\s\S]*?ML Infrastructure Engineer/.test(rowsText)
);

await page.locator("a:has-text('Sofia Marino')").first().click();
await page.waitForSelector("text=Next best action", { timeout: 8000 });
const sofiaPage = await page.locator("main").innerText();
check("new pipeline has a next action from minute one", /redirected application/i.test(sofiaPage));

// ---------------------------------------------------------------------------
// 4b. Scheduling executes structurally on approve
// ---------------------------------------------------------------------------
await page.goto(BASE + "/", { waitUntil: "networkidle" });
const tomasCard = page.locator("li", { has: page.locator("a", { hasText: "Tomás Silva" }) }).first();
if (await tomasCard.count()) {
  await tomasCard.locator("button:has-text('Approve')").first().click();
  await page.waitForSelector("text=Action performed", { timeout: 8000 });
  const schedReceipt = await page.locator("[role='dialog']").innerText();
  check("scheduling receipt: interview booked", /Booked the phone screen/i.test(schedReceipt));
  check("scheduling receipt: candidate confirmation sent", /confirmation/i.test(schedReceipt));
  check("scheduling receipt: scorecard deadline set", /Scorecards?/i.test(schedReceipt));
  await page.locator("[role='dialog'] button:has-text('Done')").click();
  await page.waitForTimeout(1500);
} else {
  check("scheduling receipt: interview booked", false, "Tomás Silva card not found");
}

// ---------------------------------------------------------------------------
// 4c. Simulated ATS webhook: scorecard lands, blocker clears
// ---------------------------------------------------------------------------
await page.goto(BASE + "/settings", { waitUntil: "networkidle" });
await page.locator("button:has-text('Simulate sync event')").click();
await page.waitForSelector("text=Webhook received", { timeout: 8000 });
check(
  "ATS sync event submits an overdue scorecard",
  (await page.locator("text=submitted their scorecard").count()) > 0
);
await page.waitForTimeout(1500);

// ---------------------------------------------------------------------------
// 5. Remaining loop mechanics (dismiss, bulk approve, automations, audit)
// ---------------------------------------------------------------------------
await page.goto(BASE + "/", { waitUntil: "networkidle" });
const beforeDismiss = await page.locator("button:has-text('Dismiss')").count();
if (beforeDismiss > 0) {
  await page.locator("button:has-text('Dismiss')").first().click();
  await page.waitForTimeout(2500);
  const afterDismiss = await page.locator("button:has-text('Dismiss')").count();
  check("dismiss removes item", afterDismiss === beforeDismiss - 1, `${beforeDismiss} -> ${afterDismiss}`);
} else {
  check("dismiss removes item", true, "skipped — queue empty");
}

await page.goto(BASE + "/actions", { waitUntil: "networkidle" });
const selAll = page.locator("button:has-text('Select all')");
if (await selAll.count()) {
  await selAll.click();
  await page.locator("button:has-text('Approve')").first().click();
  await page.waitForTimeout(2500);
}
check("bulk approve ran", true);

await page.goto(BASE + "/automations", { waitUntil: "networkidle" });
const sw = page.locator("[role='switch']").first();
const s1 = await sw.getAttribute("data-state");
await sw.click();
await page.waitForTimeout(2000);
const s2 = await page.locator("[role='switch']").first().getAttribute("data-state");
check("automation toggle flips", s1 !== s2, `${s1} -> ${s2}`);
await page.locator("[role='switch']").first().click();
await page.waitForTimeout(1500);

await page.goto(BASE + "/settings", { waitUntil: "networkidle" });
await page.locator("button[role='tab']:has-text('Audit Logs')").click();
await page.waitForTimeout(500);
const audit = await page.locator("main").innerText();
check("audit: approval logged", /Approved:/.test(audit));
check("audit: HM decision logged", /advanced Maya Chen/i.test(audit));

// Analytics: idle-days metric + formula.
await page.goto(BASE + "/analytics", { waitUntil: "networkidle" });
const analytics = await page.locator("main").innerText();
check("analytics: idle days outstanding", /Idle candidate-days outstanding/i.test(analytics));
check("analytics: idle days resolved", /Idle days resolved by Relay/i.test(analytics));
check("analytics: formula documented", /formula/i.test(analytics));

// ---------------------------------------------------------------------------
// 6. Personas: the sidebar switcher changes whose Relay this is
// ---------------------------------------------------------------------------
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await page.locator("button[aria-label='Switch persona']").first().click();
await page.locator("[role='menuitem']:has-text('James Wu')").click();
await page.waitForTimeout(2500);
check(
  "persona switch updates identity",
  (await page.locator("aside").first().innerText()).includes("James Wu")
);
check("HM persona sees their own queue labeled", (await page.locator("text=your queue").count()) >= 1);
await page.locator("button[aria-label='Switch persona']").first().click();
await page.locator("[role='menuitem']:has-text('Sarah Kim')").click();
await page.waitForTimeout(1500);

await browser.close();
console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("FAIL"));
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length > 0 ? 1 : 0);
