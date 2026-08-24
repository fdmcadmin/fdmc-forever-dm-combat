import { safeStorage } from "../utils/safeStorage";
/**
 * pendingDrafts — DM-local "create library" staging (P-ROLL3b).
 *
 * Holds in-progress actor / monster / equipment creations as PENDING drafts until
 * the DM finalizes them into the real library. Drafts survive reloads so an
 * unfinished creation is never lost to an accidental refresh.
 *
 * DM/browser-local only (localStorage). A draft's `payload` is opaque to this
 * module — each builder defines its own snapshot shape and is responsible for
 * restoring it on Resume.
 */

export type PendingDraftKind = "actor" | "monster" | "equipment";

export type PendingDraft<TPayload = unknown> = {
  /** Stable id; reusing it overwrites the same draft instead of piling up copies. */
  id: string;
  /** Human label shown in the Drafts list. */
  name: string;
  /** ISO timestamp of the last save. */
  savedAt: string;
  /** Builder-defined snapshot of the in-progress creation. */
  payload: TPayload;
};

const KEYS: Record<PendingDraftKind, string> = {
  actor: "fdmc.pending.actor.v1",
  monster: "fdmc.pending.monster.v1",
  equipment: "fdmc.pending.equipment.v1",
};

export function loadPendingDrafts<TPayload = unknown>(kind: PendingDraftKind): PendingDraft<TPayload>[] {
  try {
    const raw = safeStorage().getItem(KEYS[kind]);
    const items = raw ? (JSON.parse(raw) as PendingDraft<TPayload>[]) : [];
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

function writePendingDrafts(kind: PendingDraftKind, drafts: PendingDraft[]): void {
  try {
    safeStorage().setItem(KEYS[kind], JSON.stringify(drafts));
  } catch {
    // localStorage unavailable — drafts are a convenience, never fatal
  }
}

/** Insert or overwrite a draft (matched by id) and return the updated list. */
export function savePendingDraft<TPayload = unknown>(
  kind: PendingDraftKind,
  draft: PendingDraft<TPayload>,
): PendingDraft<TPayload>[] {
  const drafts = loadPendingDrafts(kind);
  const idx = drafts.findIndex((d) => d.id === draft.id);
  if (idx === -1) drafts.push(draft as PendingDraft);
  else drafts[idx] = draft as PendingDraft;
  writePendingDrafts(kind, drafts);
  return loadPendingDrafts<TPayload>(kind);
}

/** Remove a draft by id (called on Finalize or Discard) and return the updated list. */
export function removePendingDraft<TPayload = unknown>(
  kind: PendingDraftKind,
  id: string,
): PendingDraft<TPayload>[] {
  writePendingDrafts(kind, loadPendingDrafts(kind).filter((d) => d.id !== id));
  return loadPendingDrafts<TPayload>(kind);
}

/** Stable-ish id for a brand-new draft. */
export function newPendingDraftId(kind: PendingDraftKind): string {
  return `${kind}-draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}
