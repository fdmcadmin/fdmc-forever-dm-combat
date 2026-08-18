/**
 * creatureEstimator — a faithful port of the workbook's "Creature Estimator" sheet.
 *
 * Source: `broken_chain_encounter_checker_audit_v6.xlsx`, sheet 3 "Creature Estimator",
 * transcribed from the FORMULA layer (cells E5–E16, A19), not from the displayed values. The
 * display cells are blank by design: the checker fills them from the traits a DM authors and
 * from the monster library, so the sheet ships as a shape, not as data.
 *
 * ⚠ THIS REPLACES THE v4 PORT. v4 rated from selected SRD medians; v6 rates 2014 WotC
 * DMG-style, separately on defence and offence, through CR 25. What changed:
 *   · three-round DPR `(R1 + 2×R2+)/3`, was a four-round `(R1 + 3×R2+)/4`
 *   · a source-traced FLAT EHP adjustment and an AC adjustment, ALONGSIDE the trait multiplier
 *     v4 already had — two channels now, not one replacing the other (see `ehpMultiplier`)
 *   · attack bonus OR save DC as an offence delivery axis — v4 had no such axis at all
 *   · base AND adjusted CR on both axes, was one figure each
 *   · CR 0–25 with fractional low CRs (0, 1/8, 1/4, 1/2), was CR 1–20
 *
 * ⚠ THE v4 LADDERS WERE NON-MONOTONIC AND CARRIED A "DO NOT SORT" WARNING. That warning does
 * NOT apply here and has been removed deliberately. v6's ladders are DMG bands and ARE
 * monotonic — every threshold below rises. If you are diffing against the old file, the
 * ordering changed because the source table changed, not because it got tidied.
 *
 * The sheet's own framing still bounds what this may claim: it SUGGESTS. It never writes to a
 * creature, never rewrites an authored action budget, and its output is a range plus guidance.
 * Control, target allocation, individual saves, action denial and sequencing are NOT priced
 * here — `requiredRuntimeTrace` says so in the result, because the sheet says so on its face.
 */

/** Inputs, mapped to the sheet's cells so the port stays auditable. */
export type EstimatorInput = {
  /** B4 — printed HP, before adjustments. */
  rawHp: number;
  /** B5 — printed Armor Class. */
  ac: number;
  /**
   * The source-traced EHP MULTIPLIER — the product of applicable defensive traits, and the
   * figure the sustain calibration produces. Defaults to 1.
   *
   * ⚠ THIS EXTENDS THE SHEET DELIBERATELY. v6's E5 is `MAX(1, B4+B6)`, additive only. Folding
   * a ×1.25 into the flat channel gives the same effective HP — `raw + raw×(m−1) = raw×m` — but
   * it ERASES the calibrated multiplier from view and makes the workbook unauditable. So the
   * two channels are kept separate. A diff against cell E5 will show the extra term; that is
   * intended, not a transcription slip.
   */
  ehpMultiplier?: number;
  /**
   * B6 — the source-traced FLAT effective HP adjustment: regeneration, healing, restored HP,
   * fixed barriers. ADDITIVE, and applied after the multiplier.
   *
   * ⚠ ONE TRAIT, ONE CHANNEL. Anything counted in `ehpMultiplier` must not also appear here,
   * and AC-equivalent effects belong in `acAdjustment` so the DMG defensive-CR shift prices
   * them — not in either HP channel.
   */
  ehpAdjustment?: number;
  /** B7 — source-traced effective AC adjustment. ADDITIVE. */
  acAdjustment?: number;
  /** B8 — expected damage in round 1. */
  r1Dpr: number;
  /** B9 — expected damage in round 2 onward. */
  r2PlusDpr: number;
  /** B10 — which axis the offence is delivered on. */
  offenseBasis?: "attack" | "saveDc";
  /** B11 — creature attack bonus. Read when `offenseBasis` is "attack". */
  attackBonus?: number;
  /** B12 — creature save DC. Read when `offenseBasis` is "saveDc". */
  saveDc?: number;
  /** B13 — optional. Set it to receive editor guidance toward that CR. */
  desiredCr?: number;
};

export type EstimatorResult = {
  /** The multiplier that was applied, surfaced so the calibration stays visible in the UI. */
  ehpMultiplier: number;
  /** E5, extended — MAX(1, rawHp × ehpMultiplier + ehpAdjustment). */
  effectiveHp: number;
  /** E6 — ac + acAdjustment. */
  effectiveAc: number;
  /** E7 — (R1 + 2×R2+) / 3. THREE rounds: one opener, two sustained. */
  modeledDpr: number;
  /** E8 — CR implied by effective HP alone. */
  baseDefensiveCr: number;
  /** E9 — E8 shifted 1 CR per FULL 2 points of AC difference, clamped 0–25. */
  acAdjustedDefensiveCr: number;
  /** E10 — CR implied by three-round DPR alone. */
  baseOffensiveCr: number;
  /** E11 — E10 shifted 1 CR per FULL 2 points of attack-bonus or save-DC difference. */
  deliveryAdjustedOffensiveCr: number;
  /** E12 — ROUND(AVERAGE(E9, E11), 0), or "25+" past the table. */
  estimatedCr: number | "25+";
  /** E13 — "CR 4-CR 7". */
  crRange: string;
  /** E14 — effective HP to add (+) or remove (−) to reach `desiredCr`. Null without one. */
  targetEhpAdjustment: number | null;
  /** E15 — three-round DPR to add (+) or remove (−) to reach `desiredCr`. Null without one. */
  targetDprAdjustment: number | null;
  /** E16 — whether the profile still sits inside the CR 0–25 table. */
  capStatus: "WITHIN CR 0-25 TABLE" | "ABOVE CR 25 - MANUAL REVIEW";
  /** A19 — the sentence the sheet prints, verbatim in shape. */
  guidance: string;
  /** The sheet's standing caveat, surfaced so a caller cannot quietly drop it. */
  requiredRuntimeTrace: string;
};

/** Threshold ladders: `[upperBound, value]`, first match wins, else the trailing value. */
type Ladder = ReadonlyArray<readonly [number, number]>;

const step = (ladder: Ladder, fallback: number, x: number): number => {
  for (const [bound, value] of ladder) if (x <= bound) return value;
  return fallback;
};

/** E8 — effective HP → CR. */
const DEFENSIVE_CR: Ladder = [
  [6, 0], [35, 0.125], [49, 0.25], [70, 0.5], [85, 1], [100, 2], [115, 3], [130, 4],
  [145, 5], [160, 6], [175, 7], [190, 8], [205, 9], [220, 10], [235, 11], [250, 12],
  [265, 13], [280, 14], [295, 15], [310, 16], [325, 17], [340, 18], [355, 19], [400, 20],
  [445, 21], [490, 22], [535, 23], [580, 24],
];

/** E10 — three-round DPR → CR. */
const OFFENSIVE_CR: Ladder = [
  [1, 0], [3, 0.125], [5, 0.25], [8, 0.5], [14, 1], [20, 2], [26, 3], [32, 4],
  [38, 5], [44, 6], [50, 7], [56, 8], [62, 9], [68, 10], [74, 11], [80, 12],
  [86, 13], [92, 14], [98, 15], [104, 16], [110, 17], [116, 18], [122, 19], [140, 20],
  [158, 21], [176, 22], [194, 23], [212, 24],
];

/** E9's inner ladder — the AC a creature of this CR is expected to have. */
const EXPECTED_AC: Ladder = [[3, 13], [4, 14], [7, 15], [9, 16], [12, 17], [16, 18]];
/** E11's inner ladder, save-DC branch. */
const EXPECTED_SAVE_DC: Ladder = [[3, 13], [4, 14], [7, 15], [10, 16], [12, 17], [16, 18], [20, 19], [23, 20]];
/** E11's inner ladder, attack-bonus branch. */
const EXPECTED_ATTACK: Ladder = [[2, 3], [3, 4], [4, 5], [7, 6], [10, 7], [15, 8], [16, 9], [20, 10], [23, 11]];

/** The sheet's ceilings. Past either, the table stops meaning anything. */
const EHP_CEILING = 625;
const DPR_CEILING = 230;

/**
 * The shared shape of E9 and E11: shift the base CR by one step per FULL 2 points of
 * difference, in the direction of the difference, then clamp to the table.
 * `SIGN(d) * INT(ABS(d)/2)` — a difference of 1 moves nothing.
 */
function shiftPerTwo(baseCr: number, actual: number, expected: number): number {
  const delta = actual - expected;
  const steps = Math.sign(delta) * Math.trunc(Math.abs(delta) / 2);
  return Math.max(0, Math.min(25, baseCr + steps));
}

/** The band a desired CR sits in, derived from the ladder rather than restated. */
function bandMidpoint(ladder: Ladder, ceiling: number, cr: number): number {
  const index = ladder.findIndex(([, value]) => value === cr);
  if (index === -1) {
    // CR 25 — the open top band, closed by the sheet's ceiling.
    const lower = ladder[ladder.length - 1][0] + 1;
    return (lower + ceiling) / 2;
  }
  const lower = index === 0 ? 0 : ladder[index - 1][0] + 1;
  return (lower + ladder[index][0]) / 2;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

export function estimateCreature(input: EstimatorInput): EstimatorResult {
  const ehpMultiplier = input.ehpMultiplier ?? 1;
  const effectiveHp = Math.max(                                                        // E5+
    1, input.rawHp * ehpMultiplier + (input.ehpAdjustment ?? 0),
  );
  const effectiveAc = input.ac + (input.acAdjustment ?? 0);                            // E6
  const modeledDpr = (input.r1Dpr + 2 * input.r2PlusDpr) / 3;                          // E7

  const baseDefensiveCr = step(DEFENSIVE_CR, 25, effectiveHp);                         // E8
  const acAdjustedDefensiveCr = shiftPerTwo(                                           // E9
    baseDefensiveCr, effectiveAc, step(EXPECTED_AC, 19, baseDefensiveCr),
  );

  const baseOffensiveCr = step(OFFENSIVE_CR, 25, modeledDpr);                          // E10
  const bySaveDc = input.offenseBasis === "saveDc";
  const deliveryAdjustedOffensiveCr = shiftPerTwo(                                     // E11
    baseOffensiveCr,
    bySaveDc ? (input.saveDc ?? 0) : (input.attackBonus ?? 0),
    bySaveDc
      ? step(EXPECTED_SAVE_DC, 21, baseOffensiveCr)
      : step(EXPECTED_ATTACK, 12, baseOffensiveCr),
  );

  // E16, and the same test gates E12 and E13. Both adjusted CRs are already clamped to 25, so
  // the third arm of the sheet's OR() can never fire — transcribed anyway, to stay diffable.
  const averageCr = (acAdjustedDefensiveCr + deliveryAdjustedOffensiveCr) / 2;
  const aboveTable = effectiveHp > EHP_CEILING || modeledDpr > DPR_CEILING || averageCr > 25;
  const capStatus = aboveTable ? "ABOVE CR 25 - MANUAL REVIEW" : "WITHIN CR 0-25 TABLE";

  const lowCr = Math.min(acAdjustedDefensiveCr, deliveryAdjustedOffensiveCr);
  const highCr = Math.max(acAdjustedDefensiveCr, deliveryAdjustedOffensiveCr);

  const desired = input.desiredCr;
  const hasDesired = typeof desired === "number" && Number.isFinite(desired);
  const targetEhpAdjustment = hasDesired                                               // E14
    ? bandMidpoint(DEFENSIVE_CR, EHP_CEILING, desired as number) - effectiveHp : null;
  const targetDprAdjustment = hasDesired                                               // E15
    ? bandMidpoint(OFFENSIVE_CR, DPR_CEILING, desired as number) - modeledDpr : null;

  const guidance = !hasDesired                                                         // A19
    ? "Set a desired CR to receive baseline editor guidance."
    : `To approach the CR ${desired} baseline: `
      + `${(targetEhpAdjustment as number) >= 0 ? "add " : "remove "}`
      + `${Math.abs(Math.round(targetEhpAdjustment as number))} source-traced effective HP and `
      + `${(targetDprAdjustment as number) >= 0 ? "add " : "remove "}`
      + `${Math.abs(round1(targetDprAdjustment as number)).toFixed(1)} expected three-round DPR. `
      + "AC and attack/save differences can shift the final rating; preserve authored actions, "
      + "Recharge, slots, and timing, then rerun the parser and encounter trace.";

  return {
    ehpMultiplier,
    effectiveHp,
    effectiveAc,
    modeledDpr,
    baseDefensiveCr,
    acAdjustedDefensiveCr,
    baseOffensiveCr,
    deliveryAdjustedOffensiveCr,
    estimatedCr: aboveTable ? "25+" : Math.round(averageCr),                           // E12
    crRange: aboveTable ? `CR ${lowCr}-CR 25+` : `CR ${lowCr}-CR ${highCr}`,           // E13
    targetEhpAdjustment,
    targetDprAdjustment,
    capStatus,
    guidance,
    requiredRuntimeTrace: "PER-TARGET ACTION / CONTROL / SEQUENCING",
  };
}
