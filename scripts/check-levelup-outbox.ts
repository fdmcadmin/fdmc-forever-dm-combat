/**
 * A SUBMITTED LEVEL-UP SURVIVES A CLOSED GM APP.
 *   npm run check:levelup
 *
 * Christopher, 2026-10-18: *"if the GM app isnt open and someone submits a level up request it
 * goes into the void because the GM doesnt have the site open."*
 *
 * ⚠ THE BUG WAS A SENTENCE AS MUCH AS A MECHANISM. Submitting broadcast with
 * `destination: "REMOTE"` and then told the player *"Your DM is reviewing the changes"* — a claim
 * the app had no way to make. When no GM window existed the request reached nothing, nothing wrote
 * it down, and the build that went into it was gone with it. The DM side DID persist these, but
 * inside `if (!isDmMode || !OBR.isAvailable) return;` — durability owned by the window that had to
 * be open to provide it, which is the half that cannot help here.
 *
 * This gate holds the three properties that make the fix real: the step is written BEFORE the
 * send, every submit path writes one, and the player is never again told something the app
 * cannot know.
 */
import { readFileSync } from "node:fs";

let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};

const outbox = readFileSync("src/core/state/levelUpOutbox.ts", "utf8");
const panel = readFileSync("src/core/ui/LevelUpRequestPanel.tsx", "utf8");
const workspace = readFileSync("src/core/ui/LevelUpWorkspace.tsx", "utf8");
const app = readFileSync("src/App.tsx", "utf8");
const dmPanel = readFileSync("src/dm-panel.tsx", "utf8");

console.log("A submitted level-up survives a closed GM app\n");

console.log("1. the step is recorded, and recorded FIRST");
{
  /**
   * ⚠ ORDER IS THE PROPERTY. Recording after a successful send would reproduce the original bug
   * for every failure mode that is not "the GM was listening": a throw, a closed tab mid-send, a
   * broadcast nobody receives. The record must not depend on the send.
   */
  const idx = panel.indexOf("recordLevelUpSubmission(request)");
  const send = panel.indexOf("OBR.broadcast.sendMessage", idx);
  ok("submitLevelUpRequest records the step", idx > 0);
  ok("...BEFORE it broadcasts", idx > 0 && send > idx);
  ok("...and offline still keeps the step", /if \(!OBR\.isAvailable\) return true; \/\/ offline dev — the step is saved/.test(panel));
  ok("the record survives a send that throws",
    /catch \{\s*return false;\s*\}/.test(panel) && !/catch[\s\S]{0,80}clearLevelUpStep/.test(panel));
}

console.log("\n2. BOTH submit paths go through it");
{
  /**
   * ⚠ TWO SUBMIT SITES EXISTED, EACH BUILDING THE REQUEST BY HAND. One learning to save a step
   * and the other not would mean a player's work survives from one screen and vanishes from
   * another — and which screen they used is not something anyone thinks to ask about.
   */
  ok("the workspace defers to the shared helper",
    /return submitLevelUpRequest\(actor, seatId, proposed\);/.test(workspace));
  ok("...and no longer builds its own request",
    !/type: "fdmc:level-up-request",[\s\S]{0,200}proposedActor: proposed/.test(workspace));
  ok("the panel uses it too", /await submitLevelUpRequest\(actor, seatId, proposedActor\)/.test(panel));
}

console.log("\n3. receipt is sent where the request is WRITTEN DOWN");
{
  /**
   * A receipt on merely hearing the broadcast would promise durability the GM side had not yet
   * provided. Both GM surfaces record, so both must acknowledge — and only after storing.
   */
  for (const [name, src, store] of [
    ["the main window", app, "FDMC_STORAGE_KEYS.pendingLevelUpRequests"],
    ["the DM panel", dmPanel, "LEVEL_UP_STORAGE_KEY"],
  ] as const) {
    const stored = src.indexOf(store);
    const ack = src.indexOf('type: "fdmc:level-up-received"');
    ok(`${name} acknowledges receipt`, ack > 0);
    ok(`...after it has stored the request`, stored > 0 && ack > stored);
  }
  ok("the player marks the step delivered on that receipt",
    /isLevelUpReceived\(msg\)[\s\S]{0,160}markLevelUpDelivered\(msg\.actorId\)/.test(app));
}

console.log("\n4. the three endings");
{
  ok("approval clears the step", /approved[\s\S]{0,200}clearLevelUpStep\(approvedId\)/.test(app));
  /**
   * ⚠ REJECTION KEEPS IT. The toast has always said "you can revise and resubmit" — and before
   * this there was nothing left to revise, because the player's build only ever existed inside
   * the message that was refused.
   */
  ok("rejection KEEPS the step, with the reason", /markLevelUpRejected\(rejectedId, reason\)/.test(app)
    && /status: "rejected"[\s\S]{0,120}reason: reason\.trim\(\)/.test(outbox));
  ok("...and a stale receipt cannot revive a rejected step",
    /if \(!step \|\| step\.status === "rejected"\) return;/.test(outbox));
  ok("discard is the only other way out", /export function clearLevelUpStep/.test(outbox)
    && /Discard/.test(app));
}

console.log("\n5. one step per character");
{
  /**
   * Keyed by actorId, so pressing Resubmit three times leaves one outstanding step rather than
   * three — the GM cannot be handed the same level-up as three separate approvals, and the whole
   * proposed Actor is stored only once in localStorage, which is shared with the export.
   */
  ok("the outbox is keyed by actorId", /type Outbox = Record<string, PendingLevelUpStep>/.test(outbox));
  ok("...so resubmitting overwrites rather than piling up",
    /outbox\[request\.actorId\] = step;/.test(outbox));
  ok("...and the original submit time is preserved across resubmits",
    /submittedAt: existing\?\.submittedAt \?\? now/.test(outbox));
}

console.log("\n6. nothing re-sends on its own, and nothing claims what it cannot know");
{
  /**
   * Christopher chose manual resubmit over re-sending on open, so the store must never send.
   *
   * ⚠ COMMENTS STRIPPED FIRST — the module EXPLAINS that it does not broadcast, and the word in
   * that explanation is not a call. A source-text gate that cannot tell prose from code fails on
   * its own documentation.
   */
  const outboxCode = outbox.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  ok("the outbox module never broadcasts", !/sendMessage|broadcast/i.test(outboxCode));
  /**
   * ⚠ THE SENTENCE WAS HALF THE BUG. "Your DM is reviewing the changes" was printed the instant
   * the broadcast left, whether or not any DM existed to review it.
   */
  ok("the sent screen no longer claims the DM is reviewing it",
    !/Your DM is reviewing the changes/.test(panel));
  ok("...it says what is actually true — the step is saved",
    /It is saved on your card until your DM answers it/.test(panel));
  ok("the card offers Resubmit only while it is unconfirmed",
    /levelUpStep\.status !== "delivered" && \(/.test(app));
}

console.log(failures === 0
  ? "\nOK — a level-up is kept until it is answered, and the player is told the truth about it"
  : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
