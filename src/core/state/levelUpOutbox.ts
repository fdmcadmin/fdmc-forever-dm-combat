import { safeStorage } from "../utils/safeStorage";
import type { LevelUpRequest } from "../ui/LevelUpRequestPanel";

/**
 * THE PLAYER'S LEVEL-UP OUTBOX — a submitted step, kept until somebody answers it.
 *
 * ⚠ A BROADCAST WITH NOBODY LISTENING IS NOT A REQUEST, IT IS A DELETION.
 *
 * Submitting sent `fdmc:level-up-request` with `destination: "REMOTE"` and immediately told the
 * player *"Level-up request sent! Your DM is reviewing the changes."* Both halves were written as
 * if someone had received it. Nothing did when the GM's app was shut: the request reached no
 * window, no window wrote it down, and the player sat on a sentence that was simply untrue.
 * Christopher, 2026-10-18: *"if the GM app isnt open and someone submits a level up request it
 * goes into the void."*
 *
 * The DM side already persisted these — but inside `if (!isDmMode || !OBR.isAvailable) return;`,
 * so the durability belonged to a window that had to be open to provide it. That is the half
 * that cannot help here.
 *
 * ### The mirror of the convergence inbox
 *
 * `convergenceInbox` records requests the GM has RECEIVED. This records the one the player has
 * SENT, on the player's own machine, and keeps it until it is approved, rejected, or discarded.
 * Same disease, opposite end of the wire — so an outbox, not another inbox.
 *
 * ⚠ ONE STEP PER CHARACTER, BY DESIGN. Keyed by `actorId`, so resubmitting overwrites rather
 * than piling up: a player pressing Resubmit three times has one outstanding step, not three, and
 * the GM cannot be handed the same level-up as three separate approvals. It also bounds what this
 * costs in localStorage, which holds a whole proposed `Actor` per step and is shared with the
 * export.
 *
 * ⚠ NOTHING HERE SENDS. Christopher chose manual resubmit over re-sending on open, so this module
 * only ever stores and reads; the broadcast stays where the player's click is.
 */

/**
 * `pending`   — written at submit. We do not know that anyone heard it.
 * `delivered` — a GM window acknowledged receipt (`fdmc:level-up-received`). It is really queued.
 * `rejected`  — the GM said no, and `reason` says why. The step is KEPT so the player can revise
 *               what they built rather than reconstruct it; only approval or Discard removes one.
 */
export type LevelUpStepStatus = "pending" | "delivered" | "rejected";

export type PendingLevelUpStep = {
  /** The exact request that was broadcast, so Resubmit re-sends the same thing. */
  request: LevelUpRequest;
  status: LevelUpStepStatus;
  submittedAt: string;
  /** Last time the player pressed Resubmit, when they have. */
  resubmittedAt?: string;
  deliveredAt?: string;
  rejectedAt?: string;
  /** The DM's stated reason, on a rejection. */
  reason?: string;
};

const KEY = "fdmc.player.levelUpOutbox.v1";

/**
 * Fired in THIS window whenever the outbox changes. The write is the signal.
 *
 * Cross-window updates already arrive as the native `storage` event, which only fires in OTHER
 * windows — this covers the one that did the writing. The same pairing `openLootOffer` uses, and
 * for the same reason: a player's card and their level-up panel are often two different windows.
 */
export const LEVEL_UP_OUTBOX_CHANGED = "fdmc:level-up-outbox-changed";

type Outbox = Record<string, PendingLevelUpStep>;

/**
 * ⚠ A STORED STEP IS UNTRUSTED INPUT. It was written by an older build, possibly a different one,
 * and it is read on mount by every surface — so a step that is merely PRESENT must never be able
 * to take a panel down. 0.8.78.0 blanked the GM seat on exactly this shape of failure: it
 * survived a reload and an extension restart, because the trigger was saved rather than cached,
 * and a stored object that is the wrong shape crashes identically on every load forever.
 *
 * So every entry is shape-checked here, at the one door, rather than trusted by each of the
 * ~6 call sites. Anything that would not render is dropped: the player loses a queued step they
 * can resubmit, which is a far smaller loss than a panel that will not open.
 */
function isUsableStep(v: unknown): v is PendingLevelUpStep {
  if (!v || typeof v !== "object") return false;
  const s = v as PendingLevelUpStep;
  const r = s.request as LevelUpRequest | undefined;
  // The fields the banner and the approval panel actually read.
  return !!r
    && typeof r.actorId === "string" && r.actorId.length > 0
    && typeof r.actorName === "string"
    && !!r.proposedActor && typeof r.proposedActor === "object"
    && typeof (r.proposedActor as { level?: unknown }).level === "number"
    && (s.status === "pending" || s.status === "delivered" || s.status === "rejected");
}

/**
 * ⚠ BOUNDED. One step per character still means one per CHARACTER, and the GM window records a
 * step for every player who submits — each holding a whole proposed `Actor`. Left unbounded that
 * is a quota failure waiting for a big table, and a quota failure is not local: it makes the NEXT
 * unrelated write throw, anywhere in the app. Oldest submissions go first.
 */
const MAX_STEPS = 24;

export function loadLevelUpOutbox(): Outbox {
  try {
    const raw = safeStorage().getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object") return {};
    const clean: Outbox = {};
    for (const [id, step] of Object.entries(parsed as Record<string, unknown>)) {
      if (isUsableStep(step)) clean[id] = step;
    }
    return clean;
  } catch {
    return {};
  }
}

function write(outbox: Outbox): void {
  // Trim before storing — see MAX_STEPS.
  const ids = Object.keys(outbox);
  if (ids.length > MAX_STEPS) {
    const byAge = ids.sort((a, b) =>
      String(outbox[a]?.submittedAt ?? "").localeCompare(String(outbox[b]?.submittedAt ?? "")));
    for (const id of byAge.slice(0, ids.length - MAX_STEPS)) delete outbox[id];
  }
  try { safeStorage().setItem(KEY, JSON.stringify(outbox)); } catch { /* private mode — see below */ }
  try { window.dispatchEvent(new CustomEvent(LEVEL_UP_OUTBOX_CHANGED)); } catch { /* no DOM */ }
}

/**
 * ⚠ `levelUpStepFor(actorId)` WAS HERE AND IS DELETED, because the hooks fix removed its only
 * caller. Subscribing per-character is what put a `useEffect` below five early returns and threw
 * React #310; the app now holds the whole outbox and looks a character up at render time, which
 * needs no helper. A one-line convenience with no caller is how a module starts carrying two ways
 * to do the same thing — `check:wiring` caught it the moment it went unused.
 */

/**
 * Record a submission. Overwrites any existing step for that character — see the one-per-character
 * note above.
 *
 * ⚠ CALLED BEFORE THE BROADCAST, NOT AFTER. If the send throws, or the tab is closed mid-send, the
 * step is already on disk: the failure mode we are fixing is precisely "it looked sent and was
 * not", so the record must not depend on the send succeeding.
 */
export function recordLevelUpSubmission(request: LevelUpRequest): PendingLevelUpStep {
  const outbox = loadLevelUpOutbox();
  const now = new Date().toISOString();
  const existing = outbox[request.actorId];
  const step: PendingLevelUpStep = {
    request,
    status: "pending",
    submittedAt: existing?.submittedAt ?? now,
    ...(existing ? { resubmittedAt: now } : {}),
  };
  outbox[request.actorId] = step;
  write(outbox);
  return step;
}

/** A GM window said it has the request. Only ever promotes a step that is still outstanding. */
export function markLevelUpDelivered(actorId: string): void {
  const outbox = loadLevelUpOutbox();
  const step = outbox[actorId];
  // A receipt for a rejected step is stale chatter from an older round — ignore it rather than
  // reviving a decision the GM has already made.
  if (!step || step.status === "rejected") return;
  outbox[actorId] = { ...step, status: "delivered", deliveredAt: new Date().toISOString() };
  write(outbox);
}

/** The GM said no. The step STAYS so the player can revise it — see `LevelUpStepStatus`. */
export function markLevelUpRejected(actorId: string, reason?: string): void {
  const outbox = loadLevelUpOutbox();
  const step = outbox[actorId];
  if (!step) return;
  outbox[actorId] = {
    ...step, status: "rejected", rejectedAt: new Date().toISOString(),
    ...(reason?.trim() ? { reason: reason.trim() } : {}),
  };
  write(outbox);
}

/** Approved, or the player discarded it. Either way the step is done. */
export function clearLevelUpStep(actorId: string): void {
  const outbox = loadLevelUpOutbox();
  if (!(actorId in outbox)) return;
  delete outbox[actorId];
  write(outbox);
}
