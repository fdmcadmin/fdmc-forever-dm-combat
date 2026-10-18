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

export function loadLevelUpOutbox(): Outbox {
  try {
    const raw = safeStorage().getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Outbox) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function write(outbox: Outbox): void {
  try { safeStorage().setItem(KEY, JSON.stringify(outbox)); } catch { /* private mode — see below */ }
  try { window.dispatchEvent(new CustomEvent(LEVEL_UP_OUTBOX_CHANGED)); } catch { /* no DOM */ }
}

/** The step this character is waiting on, or null. */
export function levelUpStepFor(actorId: string | undefined): PendingLevelUpStep | null {
  if (!actorId) return null;
  return loadLevelUpOutbox()[actorId] ?? null;
}

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
