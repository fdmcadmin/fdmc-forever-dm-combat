/**
 * TYPED RESISTANCE, IMMUNITY AND VULNERABILITY — priced from what the block says.
 *
 * Christopher: *"i want to type the defense like resistance to cold and then it prices off that
 * text not have to go in and create a trait just for it to price."*
 *
 * The workbook publishes the formula, `pricing_contract.rules.21.formula`:
 *
 *     "Weight by the opposing side's actual eligible damage-type share and bypass rules;
 *      immunity passes 0 eligible damage, resistance 0.5, vulnerability 2.0."
 *
 * So a response is not a calibrated ROW to pick off a list — it is that multiplier applied to
 * whatever share of the party's damage is of that type. That is why "immune to cold" has no entry
 * in the 58 rules: those rows are shares of opposing damage (`Resistance - ~25%`), and a named
 * type is only one input to them.
 *
 * ─── THE ARITHMETIC ─────────────────────────────────────────────────────────────────────────
 *
 *   pass fraction = 1 − Σ share_i × (1 − k_i)          k = 0 immune · 0.5 resistant · 2.0 vulnerable
 *   effective HP  = 1 / pass fraction
 *
 * Immune to cold at a 15% cold share removes that 15% outright: pass 0.85, effective HP ×1.176.
 * Resistant halves it: pass 0.925, ×1.081. Vulnerable DOUBLES it, so pass rises to 1.20 and
 * effective HP falls to ×0.833 — a vulnerability makes a creature cheaper, which is the point.
 *
 * ⚠ THE SHARE IS DERIVED FROM THE PARTY, NOT TYPED IN. It used to be an input, and an unset one
 * priced at NOTHING — defensible while the app had no way to know the answer, and wrong the moment
 * it did. Twelve campaign creatures resist fire; every one of them was pricing at zero and asking
 * the author to weight it by hand.
 *
 *   Christopher: *"i shouldnt need to weight how much fire damage the party has for this to be a
 *   resistance it has"*, and *"the price should come from the action not the workbook, nothing
 *   should be priced from the workbook because we have the information in the app."*
 *
 * `partyDamageMixFromActors` reads the share off the party's own actions — see that file. This
 * still invents nothing: with no actors to read there is no mix, and a response with no mix and no
 * explicit share is recorded, displayed, and contributes 0 exactly as before. An explicit `share`
 * remains available and WINS, for a table whose damage is not in the app.
 */

import { normalizeDamageType, type PartyDamageMix } from "./partyDamageMix";

export type DamageResponse = {
  type: string;
  response: "resistant" | "immune" | "vulnerable";
  qualifier?: string;
  /**
   * OVERRIDE. This damage type's share of the party's output, 0–1. Unset is the normal case — the
   * share is then read from the party's actual actions. Set it only for a party the app cannot see.
   *
   * ⚠ BYPASS BELONGS IN HERE. "Resistant to nonmagical bludgeoning" against a party carrying
   * magic weapons has an ELIGIBLE share near zero even though bludgeoning is a large share of
   * their damage — the workbook's own words are "actual ELIGIBLE damage-type share and bypass
   * rules". The qualifier is what makes the two differ, and the share is where that difference
   * is expressed.
   */
  share?: number;
};

/** How much of an eligible packet still lands. Published figures, not chosen ones. */
export const PASS_FRACTION: Record<DamageResponse["response"], number> = {
  immune: 0,
  resistant: 0.5,
  vulnerable: 2.0,
};

export type DamageResponsePrice = {
  /** Effective-HP multiplier across every weighted response. 1.0 when none are weighted. */
  multiplier: number;
  /** Fraction of party damage that still lands. */
  passFraction: number;
  /** Responses with no share available at all — shown rather than silently treated as zero. */
  unweighted: DamageResponse[];
  /**
   * Responses priced from the PARTY's damage mix rather than an entered figure, with the share
   * used. Reported so a number the DM did not type is still a number they can see and argue with.
   */
  derived: Array<{ response: DamageResponse; share: number; qualifierUnresolved: boolean }>;
};

/**
 * Price a creature's typed responses together.
 *
 * They combine on ONE pass fraction rather than as a product of separate multipliers, because
 * they are shares of the same pool: being immune to cold and resistant to fire removes cold's
 * share and half of fire's, and multiplying two independently-derived multipliers would
 * double-count the overlap between them.
 */
export function priceDamageResponses(
  responses: readonly DamageResponse[] | undefined,
  /**
   * The party's damage-type composition, from `partyDamageMixFromActors`. Absent means no actors
   * were readable, and then an unweighted response behaves as it always did: recorded, not priced.
   */
  mix?: PartyDamageMix,
): DamageResponsePrice {
  const all = responses ?? [];
  const named = all.filter(r => r.type.trim() !== "");

  /**
   * The explicit share if there is one, otherwise the party's own. A type the party does not deal
   * at all resolves to 0 — which is a real answer, not a missing one: resistance to a damage type
   * nobody in the party throws is worth exactly nothing, and saying so is the point of reading it
   * from the actors rather than asking.
   */
  const shareFor = (r: DamageResponse): { share: number; derived: boolean } | undefined => {
    if (Number.isFinite(r.share as number)) return { share: r.share as number, derived: false };
    // ⚠ `usable`, NOT "has any data". A mix built from sheets that mostly state no damage type
    // answers 0% to everything, which reads as a decision and is a gap. See `partyDamageMix.ts`.
    if (!mix?.usable) return undefined;
    return { share: mix.shares[normalizeDamageType(r.type)] ?? 0, derived: true };
  };

  const unweighted = named.filter(r => shareFor(r) === undefined);
  const derived: DamageResponsePrice["derived"] = [];

  let removed = 0;
  for (const r of named) {
    const resolved = shareFor(r);
    if (!resolved) continue;
    const share = Math.min(1, Math.max(0, resolved.share));
    /**
     * ⚠ A QUALIFIER NARROWS ELIGIBILITY AND NOTHING HERE CAN READ IT. "Resistant to nonmagical
     * bludgeoning" against a party carrying magic weapons is eligible on almost none of that
     * type's share, and the qualifier is free prose. Priced at the FULL type share — the upper
     * bound — and reported as such, rather than silently narrowed by a guess or silently dropped
     * to zero. An explicit `share` is the way to state the real figure.
     */
    if (resolved.derived) {
      derived.push({ response: r, share, qualifierUnresolved: Boolean(r.qualifier?.trim()) });
    }
    removed += share * (1 - PASS_FRACTION[r.response]);
  }
  // A party cannot be prevented from dealing more than all of its damage, and a creature cannot
  // be made to take more than triple — the clamp is a guardrail on nonsense input, not a model.
  const passFraction = Math.min(3, Math.max(0.05, 1 - removed));
  return { multiplier: 1 / passFraction, passFraction, unweighted, derived };
}

/** One-line summary for a card or an editor row: "Immune to cold · Vulnerable to radiant". */
export function describeDamageResponses(responses: readonly DamageResponse[] | undefined): string {
  return (responses ?? [])
    .filter(r => r.type.trim() !== "")
    .map(r => {
      const word = r.response === "immune" ? "Immune" : r.response === "vulnerable" ? "Vulnerable" : "Resistant";
      return `${word} to ${r.type}${r.qualifier ? ` ${r.qualifier}` : ""}`;
    })
    .join(" · ");
}
