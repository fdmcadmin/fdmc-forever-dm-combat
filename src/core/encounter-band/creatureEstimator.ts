/**
 * creatureEstimator — a faithful port of the workbook's "Creature Estimator" sheet.
 *
 * Source: `broken_chain_encounter_checker_audit_v6.xlsx`, sheet 3 "Creature Estimator",
 * transcribed from the FORMULA layer (cells E5–E16, A19), not from the displayed values. The
 * display cells are blank by design: the checker fills them from the traits a DM authors and
 * from the monster library, so the sheet ships as a shape, not as data.
 *
 * ⚠ THIS REPLACES THE v4 PORT. v4 rated from selected SRD medians; v6 rates 2014 WotC
 * DMG-style, separately on defence and offence, through CR 30 (CR 25 before M28). What changed:
 *   · three-round DPR `(R1 + 2×R2+)/3`, was a four-round `(R1 + 3×R2+)/4`
 *   · a source-traced FLAT EHP adjustment and an AC adjustment, ALONGSIDE the trait multiplier
 *     v4 already had — two channels now, not one replacing the other (see `ehpMultiplier`)
 *   · attack bonus OR save DC as an offence delivery axis — v4 had no such axis at all
 *   · base AND adjusted CR on both axes, was one figure each
 *   · CR 0–30 with fractional low CRs (0, 1/8, 1/4, 1/2), was CR 1–20
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
  /** E9 — E8 shifted 1 CR per FULL 2 points of AC difference, clamped 0–30. */
  acAdjustedDefensiveCr: number;
  /** E10 — CR implied by three-round DPR alone. */
  baseOffensiveCr: number;
  /** E11 — E10 shifted 1 CR per FULL 2 points of attack-bonus or save-DC difference. */
  deliveryAdjustedOffensiveCr: number;
  /**
   * E12 — ROUND(AVERAGE(E9, E11), 0), or the top-of-table sentinel past it.
   *
   * ⚠ THE SENTINEL NAMES THE TABLE'S TOP, SO IT MOVED WITH IT: "25+" became "30+" at M28. It
   * crosses the engine boundary, and a certified LKG built before M28 still emits "25+" — which
   * is why `runtimeValidation` checks the SHAPE rather than one literal.
   */
  estimatedCr: number | `${number}+`;
  /** E13 — "CR 4-CR 7". */
  crRange: string;
  /** E14 — effective HP to add (+) or remove (−) to reach `desiredCr`. Null without one. */
  targetEhpAdjustment: number | null;
  /** E15 — three-round DPR to add (+) or remove (−) to reach `desiredCr`. Null without one. */
  targetDprAdjustment: number | null;
  /** E16 — whether the profile still sits inside the CR 0–30 table. */
  capStatus: "WITHIN CR 0-30 TABLE" | "ABOVE CR 30 - MANUAL REVIEW";
  /** A19 — the sentence the sheet prints, verbatim in shape. */
  guidance: string;
  /** The sheet's standing caveat, surfaced so a caller cannot quietly drop it. */
  requiredRuntimeTrace: string;
};

/**
 * M28 — THE TABLE REACHES CR 30, NOT CR 25.
 *
 * *"The current estimator stops at CR 25, while the SRD includes a CR 30 stat block."* The audit
 * supplies the continuation rows and they are a CONTINUATION, not a reinterpretation: CR 25 closed
 * at 625 EHP / 230 DPR and the document opens CR 26 at 626 / 231. The same two-CR-per-2-point
 * AC/attack/DC adjustment runs unchanged.
 *
 * ⚠ NOTHING BELOW CR 26 MOVES. The delivery ladders gain rows that restate what their fallbacks
 * already returned, so every creature the app has ever priced prices identically. The Tarrasque is
 * the one SRD block this exists for.
 */
const TABLE_TOP_CR = 30;

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
  // M28 — the audit's CR 26-30 HP bands. They continue the sheet exactly: CR 25 closed at 625,
  // and the document opens CR 26 at 626, so nothing here reinterprets a band that already existed.
  [625, 25], [670, 26], [715, 27], [760, 28], [805, 29],
];

/** E10 — three-round DPR → CR. */
const OFFENSIVE_CR: Ladder = [
  [1, 0], [3, 0.125], [5, 0.25], [8, 0.5], [14, 1], [20, 2], [26, 3], [32, 4],
  [38, 5], [44, 6], [50, 7], [56, 8], [62, 9], [68, 10], [74, 11], [80, 12],
  [86, 13], [92, 14], [98, 15], [104, 16], [110, 17], [116, 18], [122, 19], [140, 20],
  [158, 21], [176, 22], [194, 23], [212, 24],
  // M28 — CR 25 closed at 230 and the audit opens CR 26 at 231. Continuous, same construction.
  [230, 25], [248, 26], [266, 27], [284, 28], [302, 29],
];

/** E9's inner ladder — the AC a creature of this CR is expected to have. */
const EXPECTED_AC: Ladder = [[3, 13], [4, 14], [7, 15], [9, 16], [12, 17], [16, 18]];
/** E11's inner ladder, save-DC branch. */
const EXPECTED_SAVE_DC: Ladder = [[3, 13], [4, 14], [7, 15], [10, 16], [12, 17], [16, 18], [20, 19], [23, 20],
  // M28. The old fallback was 21, so CR 24-26 already read 21 and [26, 21] restates it rather
  // than changing it — the ladder only starts saying something new at CR 27.
  [26, 21], [29, 22]];
/** E11's inner ladder, attack-bonus branch. */
const EXPECTED_ATTACK: Ladder = [[2, 3], [3, 4], [4, 5], [7, 6], [10, 7], [15, 8], [16, 9], [20, 10], [23, 11],
  // M28, and the same restatement: the old fallback 12 already covered CR 24-26.
  [26, 12], [29, 13]];

/** The sheet's ceilings. Past either, the table stops meaning anything. */
const EHP_CEILING = 850;
const DPR_CEILING = 320;

/**
 * The shared shape of E9 and E11: shift the base CR by one step per FULL 2 points of
 * difference, in the direction of the difference, then clamp to the table.
 * `SIGN(d) * INT(ABS(d)/2)` — a difference of 1 moves nothing.
 */
function shiftPerTwo(baseCr: number, actual: number, expected: number): number {
  const delta = actual - expected;
  const steps = Math.sign(delta) * Math.trunc(Math.abs(delta) / 2);
  return Math.max(0, Math.min(TABLE_TOP_CR, baseCr + steps));
}

/** The band a desired CR sits in, derived from the ladder rather than restated. */
function bandMidpoint(ladder: Ladder, ceiling: number, cr: number): number {
  const index = ladder.findIndex(([, value]) => value === cr);
  if (index === -1) {
    // The open top band (CR 30), closed by the ceiling.
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

  const baseDefensiveCr = step(DEFENSIVE_CR, TABLE_TOP_CR, effectiveHp);                         // E8
  const acAdjustedDefensiveCr = shiftPerTwo(                                           // E9
    baseDefensiveCr, effectiveAc, step(EXPECTED_AC, 19, baseDefensiveCr),
  );

  const baseOffensiveCr = step(OFFENSIVE_CR, TABLE_TOP_CR, modeledDpr);                          // E10
  const bySaveDc = input.offenseBasis === "saveDc";
  const deliveryAdjustedOffensiveCr = shiftPerTwo(                                     // E11
    baseOffensiveCr,
    bySaveDc ? (input.saveDc ?? 0) : (input.attackBonus ?? 0),
    bySaveDc
      ? step(EXPECTED_SAVE_DC, 23, baseOffensiveCr)
      : step(EXPECTED_ATTACK, 14, baseOffensiveCr),
  );

  // E16, and the same test gates E12 and E13. Both adjusted CRs are already clamped to 25, so
  // the third arm of the sheet's OR() can never fire — transcribed anyway, to stay diffable.
  const averageCr = (acAdjustedDefensiveCr + deliveryAdjustedOffensiveCr) / 2;
  const aboveTable = effectiveHp > EHP_CEILING || modeledDpr > DPR_CEILING || averageCr > TABLE_TOP_CR;
  const capStatus = aboveTable ? "ABOVE CR 30 - MANUAL REVIEW" : "WITHIN CR 0-30 TABLE";

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
    estimatedCr: aboveTable ? `${TABLE_TOP_CR}+` : Math.round(averageCr),                           // E12
    crRange: aboveTable ? `CR ${lowCr}-CR ${TABLE_TOP_CR}+` : `CR ${lowCr}-CR ${highCr}`,           // E13
    targetEhpAdjustment,
    targetDprAdjustment,
    capStatus,
    guidance,
    requiredRuntimeTrace: "PER-TARGET ACTION / CONTROL / SEQUENCING",
  };
}
