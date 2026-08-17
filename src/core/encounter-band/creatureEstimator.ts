/**
 * creatureEstimator — a faithful port of the workbook's "Creature Estimator" sheet.
 *
 * Source: `broken_chain_encounter_checker_audit_v4.xlsx`, sheet 3 "Creature Estimator".
 * Christopher, 2026-08-17: *"then utilize the workbooks updated creature estimator for the
 * encounter builder."*
 *
 * The sheet's own framing, quoted because it bounds what this may claim:
 *   *"Enter a creature's actual defensive data and expected DPR from the parser. This estimates a
 *   practical CR range from selected SRD medians; it is not an official CR ruling and it never
 *   rewrites a creature's printed action budget."*
 *   *"This workbook displays the estimator only; it does not author or alter creature rules."*
 *
 * So this SUGGESTS. It never writes to a creature, never touches an action budget, and its output
 * is a range plus a sentence of guidance.
 *
 * ⚠ THE CR LADDERS ARE NOT MONOTONIC AND THAT IS NOT A BUG. Read the defensive ladder: 178 → CR 9,
 * 180.2 → CR 10, then 203.8 → CR **12**, 207.2 → CR **14**, 219.0 → CR **13**, 222.0 → CR **15**,
 * 245.5 → CR **11**. The offensive ladder is shuffled the same way (94.05 → CR 19, 106.075 → 14).
 * They are compiled from SELECTED SRD MEDIANS, and real SRD creatures are not monotonic in HP or
 * damage by CR. Every branch below is transcribed in the sheet's own order. Do not "fix" the
 * sequence — sorting it would be inventing a model, which is the exact failure that got the
 * previous checker deleted.
 */

/** Inputs, mapped to the sheet's cells so the port stays auditable. */
export type EstimatorInput = {
  /** B4 — the creature's printed HP, before AC or traits. */
  rawHp: number;
  /** B5 — printed Armor Class. */
  ac: number;
  /** B6 — the trait/sustain multiplier (the PRODUCT of its defensive traits). */
  traitMultiplier: number;
  /** B7 — expected damage in round 1. */
  r1Dpr: number;
  /** B8 — expected damage in round 2 onward. */
  r2PlusDpr: number;
  /** B9 — optional. Set it to receive editor guidance toward that CR. */
  desiredCr?: number;
};

export type EstimatorResult = {
  /** E5 — MAX(0.5, 1 + 0.045 × (AC − 15)). */
  armorFactor: number;
  /** E6 — rawHp × traitMultiplier × armorFactor. */
  effectiveHp: number;
  /** E7 — (R1 + 3 × R2+) / 4. A four-round fight, one opener and three sustained. */
  modeledDpr: number;
  /** E8 — CR implied by effective HP. */
  defensiveCr: number;
  /** E9 — CR implied by modeled DPR. */
  offensiveCr: number;
  /** E10 — "4–7". The two CRs widened by one in each direction. */
  suggestedCrRange: string;
  /** E11 — ROUND(AVERAGE(defensive, offensive), 0). */
  suggestedCrCenter: number;
  /** E12 — effective HP to add (+) or remove (−) to reach `desiredCr`. Null without one. */
  targetEhpAdjustment: number | null;
  /** E13 — expected DPR to add (+) or remove (−) to reach `desiredCr`. Null without one. */
  targetDprAdjustment: number | null;
  /** E14 — the sentence the sheet prints, verbatim in shape. */
  guidance: string;
};

/**
 * E8. Transcribed branch-for-branch from the sheet.
 *
 * The first two branches both yield 1 — that is in the source, and it means anything under 45
 * effective HP is CR 1. Kept rather than collapsed so a diff against the sheet stays line-for-line.
 */
function defensiveCrFor(ehp: number): number {
  if (ehp < 26.389888) return 1;
  if (ehp < 45.000000) return 1;
  if (ehp < 60.000000) return 2;
  if (ehp < 82.000000) return 3;
  if (ehp < 105.000000) return 4;
  if (ehp < 123.000000) return 5;
  if (ehp < 126.500000) return 6;
  if (ehp < 136.000000) return 7;
  if (ehp < 165.000000) return 8;
  if (ehp < 178.000000) return 9;
  if (ehp < 180.205575) return 10;
  if (ehp < 203.834878) return 12;
  if (ehp < 207.186514) return 14;
  if (ehp < 218.991831) return 13;
  if (ehp < 222.048975) return 15;
  if (ehp < 245.481279) return 11;
  if (ehp < 260.804113) return 16;
  if (ehp < 260.804113) return 17;   // unreachable in the sheet too — kept for fidelity
  if (ehp < 334.750689) return 18;
  if (ehp < 347.138402) return 19;
  return 20;
}

/** E9. Same rule: transcribed in the sheet's order, including the shuffled CR labels. */
function offensiveCrFor(dpr: number): number {
  if (dpr < 7.350000) return 1;
  if (dpr < 9.625000) return 1;
  if (dpr < 15.400000) return 2;
  if (dpr < 16.800000) return 3;
  if (dpr < 22.550000) return 4;
  if (dpr < 33.787500) return 5;
  if (dpr < 36.275000) return 7;
  if (dpr < 40.075000) return 6;
  if (dpr < 40.100000) return 8;
  if (dpr < 45.712500) return 9;
  if (dpr < 52.000000) return 10;
  if (dpr < 63.450000) return 11;
  if (dpr < 67.150000) return 12;
  if (dpr < 75.400000) return 13;
  if (dpr < 94.050000) return 19;
  if (dpr < 106.075000) return 14;
  if (dpr < 106.075000) return 17;   // unreachable in the sheet too — kept for fidelity
  if (dpr < 110.400000) return 18;
  if (dpr < 112.400000) return 16;
  if (dpr < 138.375000) return 15;
  return 20;
}

/** E12's lookup: the effective-HP target for a desired CR. */
const TARGET_EHP: Record<number, number> = {
  1: 26.389888, 2: 45.000000, 3: 60.000000, 4: 82.000000, 5: 105.000000,
  6: 123.000000, 7: 126.500000, 8: 136.000000, 9: 165.000000, 10: 178.000000,
  11: 222.048975, 12: 180.205575, 13: 207.186514, 14: 203.834878, 15: 218.991831,
  16: 245.481279, 17: 260.804113, 18: 260.804113, 19: 334.750689, 20: 347.138402,
};

/** E13's lookup: the DPR target for a desired CR. */
const TARGET_DPR: Record<number, number> = {
  1: 7.350000, 2: 9.625000, 3: 15.400000, 4: 16.800000, 5: 22.550000,
  6: 36.275000, 7: 33.787500, 8: 40.075000, 9: 40.100000, 10: 45.712500,
  11: 52.000000, 12: 63.450000, 13: 67.150000, 14: 94.050000, 15: 112.400000,
  16: 110.400000, 17: 106.075000, 18: 106.075000, 19: 75.400000, 20: 138.375000,
};

/** Excel ROUND — half away from zero, which is not what `Math.round` does for negatives. */
function excelRound(value: number, digits = 0): number {
  const factor = 10 ** digits;
  const scaled = value * factor;
  return (scaled < 0 ? -Math.round(-scaled) : Math.round(scaled)) / factor;
}

export function estimateCreature(input: EstimatorInput): EstimatorResult {
  const armorFactor = Math.max(0.5, 1 + 0.045 * (input.ac - 15));
  const effectiveHp = input.rawHp * input.traitMultiplier * armorFactor;
  const modeledDpr = (input.r1Dpr + 3 * input.r2PlusDpr) / 4;

  const defensiveCr = defensiveCrFor(effectiveHp);
  const offensiveCr = offensiveCrFor(modeledDpr);

  const low = Math.max(1, Math.min(defensiveCr, offensiveCr) - 1);
  const high = Math.min(20, Math.max(defensiveCr, offensiveCr) + 1);

  const desired = input.desiredCr;
  const hasDesired = typeof desired === "number" && desired >= 1 && desired <= 20;
  const targetEhpAdjustment = hasDesired ? TARGET_EHP[desired] - effectiveHp : null;
  const targetDprAdjustment = hasDesired ? TARGET_DPR[desired] - modeledDpr : null;

  /**
   * E14, verbatim in shape. The closing clause is the important half and is quoted from the
   * sheet: the estimator may move HP and DPR, and it must NOT move the action economy.
   */
  const guidance = !hasDesired
    ? "Set a desired CR to receive editor guidance."
    : `To approach CR ${desired}: ${(targetEhpAdjustment as number) >= 0 ? "add " : "remove "}`
      + `${Math.abs(targetEhpAdjustment as number).toFixed(0)} effective HP and `
      + `${(targetDprAdjustment as number) >= 0 ? "add " : "remove "}`
      + `${Math.abs(targetDprAdjustment as number).toFixed(1)} expected DPR. `
      + "Preserve action channels, Recharge, slots, and printed timing; then rerun the parser "
      + "and encounter check.";

  return {
    armorFactor,
    effectiveHp,
    modeledDpr,
    defensiveCr,
    offensiveCr,
    suggestedCrRange: `${low}–${high}`,
    suggestedCrCenter: excelRound((defensiveCr + offensiveCr) / 2, 0),
    targetEhpAdjustment,
    targetDprAdjustment,
    guidance,
  };
}
