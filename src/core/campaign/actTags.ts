/**
 * Act tagging + campaign ordering — one source of truth for "which act does this belong to,
 * and where does it sit inside that act".
 *
 * WHY: act membership used to be derived inline with a hardcoded
 * `id.startsWith("act1") ? "Act 1" : id.startsWith("act2") ? "Act 2" : undefined`, so
 * anything from Act 3 onward silently fell out of every act grouping. Authoring Act 3
 * needs act membership to be a real, open-ended concept.
 *
 * Ids encode their own position: `act2-s4-e1-pale-drifter` → act 2, session 4, encounter 1.
 * Both halves (session/encounter) are optional — `act1-boss` is act 1 with no session.
 * Pure module: no React, no SDK.
 */

/** Anything that can be placed on the campaign timeline. */
export type ActPlacement = {
  /** 1-based act number; 0 = unplaced (sorts last, labelled "Unsorted"). */
  act: number;
  /** 1-based session inside the act, or 0 when the id doesn't say. */
  session: number;
  /** 1-based encounter inside the session, or 0 when the id doesn't say. */
  encounter: number;
};

const UNPLACED: ActPlacement = { act: 0, session: 0, encounter: 0 };

/**
 * Read the act/session/encounter position out of an id such as:
 *   "act2-s4-e1-pale-drifter" → { act: 2, session: 4, encounter: 1 }
 *   "act1-boss"               → { act: 1, session: 0, encounter: 0 }
 *   "custom-1a2b3c"           → { act: 0, ... }  (unplaced)
 * Open-ended by design: act 3, 4, 10 all parse without a code change.
 */
export function parseActPlacement(id: string | null | undefined): ActPlacement {
  if (!id) return UNPLACED;
  const actMatch = /^act\s*(\d+)/i.exec(id.trim());
  if (!actMatch) return UNPLACED;
  const act = Number.parseInt(actMatch[1], 10);
  if (!Number.isFinite(act) || act <= 0) return UNPLACED;
  const session = Number.parseInt(/-s(\d+)\b/i.exec(id)?.[1] ?? "", 10);
  const encounter = Number.parseInt(/-e(\d+)\b/i.exec(id)?.[1] ?? "", 10);
  return {
    act,
    session: Number.isFinite(session) ? session : 0,
    encounter: Number.isFinite(encounter) ? encounter : 0,
  };
}

/** Display label for an act number — "Act 3", or "Unsorted" for unplaced content. */
export function actLabel(act: number): string {
  return act > 0 ? `Act ${act}` : "Unsorted";
}

/**
 * The act an id belongs to, as a label. Replaces the old hardcoded act1/act2 ternary,
 * so Act 3+ tags itself with no further edits. Returns undefined when unplaced, so
 * callers can keep treating "no act" as a distinct case.
 */
export function actTagForId(id: string | null | undefined): string | undefined {
  const { act } = parseActPlacement(id);
  return act > 0 ? actLabel(act) : undefined;
}

/**
 * Sortable key for campaign order: act, then session, then encounter, then name.
 * Unplaced content sorts to the very end rather than jumbling in at act 0.
 */
export function campaignSortKey(id: string | null | undefined, name = ""): string {
  const { act, session, encounter } = parseActPlacement(id);
  const bucket = act > 0 ? act : 9999; // unplaced last
  const pad = (n: number) => String(n).padStart(3, "0");
  return `${pad(bucket)}-${pad(session)}-${pad(encounter)}-${name.toLowerCase()}`;
}

/** Compare two placeable records in campaign order. */
export function byCampaignOrder<T>(getId: (x: T) => string | undefined, getName: (x: T) => string) {
  return (a: T, b: T) => campaignSortKey(getId(a), getName(a)).localeCompare(campaignSortKey(getId(b), getName(b)));
}

/**
 * Parse an act out of a free-text act field ("Act 2", "act 3", "2") — the equipment
 * library stores act as prose rather than in the id.
 */
export function parseActField(value: string | null | undefined): number {
  if (!value) return 0;
  const m = /(\d+)/.exec(value);
  const n = m ? Number.parseInt(m[1], 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Session number from a free-text session field ("Session 3", "3"). 0 when absent. */
export function parseSessionField(value: string | null | undefined): number {
  if (!value) return 0;
  const m = /(\d+)/.exec(value);
  const n = m ? Number.parseInt(m[1], 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 0;
}
