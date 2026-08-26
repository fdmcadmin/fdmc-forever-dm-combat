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
 * ⚠ THE SHARE IS AN INPUT, AND AN UNSET ONE PRICES AT NOTHING. The workbook says "the opposing
 * side's ACTUAL eligible damage-type share" — a fact about the party, not a constant, and the
 * runtime publishes no table of it. Defaulting to a plausible 15% would be inventing exactly the
 * kind of figure the coverage gate exists to reject, so a response with no share is recorded,
 * displayed, and contributes 0 until someone says what the share is.
 */

export type DamageResponse = {
  type: string;
  response: "resistant" | "immune" | "vulnerable";
  qualifier?: string;
  /**
   * This damage type's share of the party's output, 0–1. Unset = not yet weighted, prices at 1.0.
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
  /** Responses recorded but not weighted — shown rather than silently treated as zero. */
  unweighted: DamageResponse[];
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
): DamageResponsePrice {
  const all = responses ?? [];
  const unweighted = all.filter(r => r.type.trim() !== "" && !Number.isFinite(r.share as number));
  const weighted = all.filter(r => r.type.trim() !== "" && Number.isFinite(r.share as number));

  let removed = 0;
  for (const r of weighted) {
    const share = Math.min(1, Math.max(0, r.share as number));
    removed += share * (1 - PASS_FRACTION[r.response]);
  }
  // A party cannot be prevented from dealing more than all of its damage, and a creature cannot
  // be made to take more than triple — the clamp is a guardrail on nonsense input, not a model.
  const passFraction = Math.min(3, Math.max(0.05, 1 - removed));
  return { multiplier: 1 / passFraction, passFraction, unweighted };
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
