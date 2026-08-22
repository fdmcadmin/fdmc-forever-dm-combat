/**
 * AGGREGATE ENCOUNTER AUDIT — the workbook's visible Encounter Checker, cell for cell.
 *
 * Christopher: *"at no point does the app tell us something is faster or slower then the workbook
 * does, the workbook writes the story, if the app cant read the same story then the app needs to be
 * corrected."*
 *
 * ── WHY THIS EXISTS ALONGSIDE `simulateEncounter` ───────────────────────────────────────────
 * They are two different models, and the app was only running one of them.
 *
 * `simulateEncounter` is the BODY TRACE the Runtime Contract requires: it applies party damage to
 * actual bodies, removes a body at 0 HP, drops that body's future output, and reduces party output
 * as PCs go down. The Runtime Contract is explicit that this is the final word — *"The app must use
 * target/body tracing for final encounter behavior."*
 *
 * This file is the OTHER model: the visible checker, which the same contract calls *"a fast
 * aggregate audit… It can combine EHP/DPR for sanity checks."* It runs flat. Monster DPR does not
 * fall as bodies die, party DPR does not fall as PCs go down, and the only concession to the fight
 * ending is the completion-round fraction.
 *
 * ⚠ THE TWO DO NOT AGREE, AND THAT IS THE POINT OF HAVING BOTH. Six pikemen against a level-6
 * party: the aggregate says 249 cumulative monster damage and 3 PCs down; the body trace says 159.5
 * and 1 down, because it kills pikemen as the fight goes and stops paying for their attacks. With a
 * single body the two coincide exactly — there is nothing to remove early. The gap grows with body
 * count, and it always runs the same direction: the body trace reports the SAFER encounter.
 *
 * Running only the body trace therefore meant the app quietly told a DM an encounter was gentler
 * than the workbook said, with nothing on screen to show a second opinion existed. Both numbers are
 * legitimate; showing one of them silently is not.
 *
 * ⚠ NOTHING HERE TOUCHES THE CORRECTED CHECKER OR ESTIMATOR. *"dont change anything from the
 * corrected estimator and checker."* This is additive: a second reading of the same roster.
 *
 * ── PROVENANCE ──────────────────────────────────────────────────────────────────────────────
 * Every formula below was read out of `sheet2.xml` in
 * `broken_chain_encounter_checker_v7_7_claude_app_contract.xlsx` and is named by its own cell, so a
 * future edit to the workbook can be diffed against this file line by line.
 */

import { PARTY_CURVE_V2, type PartyEquipmentMode } from "./partyCurveV2";

/** Rows 25–44 of the checker's round table. Twenty rounds, and the sheet stops there. */
const ROUND_ROWS = 20;

export type AggregateGroup = {
  /** Only for the report; a roster row is allowed to be unnamed. */
  name?: string;
  /** B13:B20 — how many bodies. */
  quantity: number;
  /** G13:G20 — the group's effective HP, as transferred from the Creature Estimator. */
  groupEhp: number;
  /** E13:E20 — round-1 DPR for ONE body. */
  round1DprPerBody: number;
  /** F13:F20 — round-2-onward DPR for ONE body. */
  round2PlusDprPerBody: number;
};

export type AggregateRound = {
  round: number;
  /** B25:B44 — party DPR this round, straight off the curve. Never reduced for downs. */
  partyDpr: number;
  /** C25:C44 — cumulative party damage. */
  cumulativePartyDamage: number;
  /** D25:D44 — monster DPR this round. Never reduced for dead bodies. */
  monsterDpr: number;
  /** E25:E44 — cumulative monster damage. */
  cumulativeMonsterDamage: number;
};

export type AggregateAudit = {
  /** L5 — SUM(G13:G20). */
  encounterEhp: number;
  /** L6 — SUM(H13:H20), where H = qty × R1 DPR. */
  monsterDprRound1: number;
  /** L7 — SUM(I13:I20), where I = qty × R2+ DPR. */
  monsterDprRound2Plus: number;
  /** L8 — the party's sustain pool. */
  partySustain: number;
  /** L9 — the round the party finishes it. `"ENTER CREATURE"` with an empty roster, `">20"` past the table. */
  completionRound: number | "ENTER CREATURE" | ">20";
  /** L10 — the round cumulative monster damage exceeds party sustain. */
  fatalRound: number | "-" | "NOT FATAL";
  /** L11 — MIN(party size, INT(monster damage at completion ÷ sustain per PC)). */
  projectedDowns: number | "-";
  /** L12 — damage landed but nobody dropped. */
  residualDamageFlag: "YES" | "NO" | "-";
  /** L13 — party size − projected downs. */
  standingAtCompletion: number;
  /** L14 — effective HP to add (+) or remove (−) to hit the target safety margin. */
  ehpAdjustmentToTarget: number | "ENTER R2+ DPR";
  /** The round table, so the numbers can be shown rather than asserted. */
  rounds: AggregateRound[];
};

/**
 * Excel `MATCH(x, range, 1)` over an ascending range: the 1-indexed position of the last value that
 * is still ≤ x. Zero when the first value already exceeds x.
 */
function matchLessOrEqual(x: number, range: number[]): number {
  let i = 0;
  while (i < range.length && range[i] <= x) i++;
  return i;
}

/**
 * Run the visible Encounter Checker.
 *
 * ⚠ THE SAME GUARDRAIL AS EVERYWHERE ELSE: party-size scaling belongs to creature EFFECTIVE HP and
 * never to creature DPR. `groupEhp` is expected to arrive already scaled, exactly as the sheet
 * expects it to arrive already priced from the Creature Estimator.
 */
export function aggregateAudit(opts: {
  /** B4 — party level. */
  level: number;
  /** B6 — campaign party size. */
  partySize: number;
  /** B5 — which curve. */
  mode: PartyEquipmentMode;
  groups: AggregateGroup[];
  /** B7 — how much of its output a monster still lands on the round it dies. Sheet default 0.5. */
  completionRoundMonsterFraction?: number;
  /** B8 — target safety margin, in rounds. Sheet default 1. */
  targetSafetyMargin?: number;
}): AggregateAudit {
  const {
    level, partySize, mode, groups,
    completionRoundMonsterFraction: B7 = 0.5,
    targetSafetyMargin: B8 = 1,
  } = opts;

  const row = PARTY_CURVE_V2.find(r => r.level === level);
  if (!row) throw new RangeError(`no party curve row for level ${level}`);
  const curve = mode === "brokenChain" ? row.brokenChain : row.wotcStandard;

  // E5:E8 and F5 — VLOOKUP into the Rounds DPR & Sustain tab.
  const E5 = curve.round1, E6 = curve.round2, E7 = curve.round3, E8 = curve.round4Plus;
  const B6 = partySize;

  const L5 = groups.reduce((s, g) => s + g.groupEhp, 0);
  const L6 = groups.reduce((s, g) => s + g.quantity * g.round1DprPerBody, 0);
  const L7 = groups.reduce((s, g) => s + g.quantity * g.round2PlusDprPerBody, 0);
  const L8 = curve.sustain;

  // B25=$E$5, B26=$E$6, B27=$E$7, B28:B44=$E$8.
  const B: number[] = [E5, E6, E7, ...Array<number>(ROUND_ROWS - 3).fill(E8)];
  const C: number[] = [], D: number[] = [], E: number[] = [];
  for (let i = 0; i < ROUND_ROWS; i++) {
    C[i] = i === 0 ? B[0] : C[i - 1] + B[i];
    /**
     * D25 = IF(C25>=$L$5, $B$7*$L$6, $L$6)
     * D26 = IF(C25>=$L$5, 0, IF(C26>=$L$5, $B$7*$L$7, $L$7))
     *
     * Read it as: the monsters were already finished before this round (0), they are finished
     * DURING this round (the completion fraction), or they are still up (full output).
     */
    if (i === 0) D[i] = C[0] >= L5 ? B7 * L6 : L6;
    else D[i] = C[i - 1] >= L5 ? 0 : (C[i] >= L5 ? B7 * L7 : L7);
    E[i] = i === 0 ? D[0] : E[i - 1] + D[i];
  }

  // L9 = IF(L5<=0,"ENTER CREATURE",IF(L5<=C25,1,IF(L5>C44,">20",MATCH(L5-0.000001,C25:C44,1)+1)))
  const completionRound: AggregateAudit["completionRound"] =
    L5 <= 0 ? "ENTER CREATURE"
      : L5 <= C[0] ? 1
        : L5 > C[ROUND_ROWS - 1] ? ">20"
          : matchLessOrEqual(L5 - 0.000001, C) + 1;

  // L10 = IF(L5<=0,"-",IF(L8<=E25,1,IF(L8>E44,"NOT FATAL",MATCH(L8-0.000001,E25:E44,1)+1)))
  const fatalRound: AggregateAudit["fatalRound"] =
    L5 <= 0 ? "-"
      : L8 <= E[0] ? 1
        : L8 > E[ROUND_ROWS - 1] ? "NOT FATAL"
          : matchLessOrEqual(L8 - 0.000001, E) + 1;

  // INDEX(E25:E44, L9) — cumulative monster damage as of the completion round.
  const damageAtCompletion = typeof completionRound === "number"
    ? (E[completionRound - 1] ?? E[ROUND_ROWS - 1])
    : 0;

  // L11 = IF(L5<=0,"-",MIN($B$6,INT(IFERROR(INDEX(E25:E44,L9),E44)/(L8/$B$6))))
  const projectedDowns: number | "-" =
    L5 <= 0 ? "-" : Math.min(B6, Math.trunc(damageAtCompletion / (L8 / B6)));

  // L12 = IF(L5<=0,"-",IF(AND(INDEX(E25:E44,L9)>0,L11<$B$6),"YES","NO"))
  const residualDamageFlag: AggregateAudit["residualDamageFlag"] =
    L5 <= 0 ? "-" : (damageAtCompletion > 0 && (projectedDowns as number) < B6 ? "YES" : "NO");

  // L13 = IF(L5<=0,$B$6,$B$6-L11)
  const standingAtCompletion = L5 <= 0 ? B6 : B6 - (projectedDowns as number);

  // L14 = IF(L7<=0,"ENTER R2+ DPR",((L8/L7)-$B$8)*AVERAGE(E5:E8)-L5)
  const ehpAdjustmentToTarget: number | "ENTER R2+ DPR" =
    L7 <= 0 ? "ENTER R2+ DPR" : ((L8 / L7) - B8) * ((E5 + E6 + E7 + E8) / 4) - L5;

  return {
    encounterEhp: L5,
    monsterDprRound1: L6,
    monsterDprRound2Plus: L7,
    partySustain: L8,
    completionRound,
    fatalRound,
    projectedDowns,
    residualDamageFlag,
    standingAtCompletion,
    ehpAdjustmentToTarget,
    rounds: B.map((partyDpr, i) => ({
      round: i + 1,
      partyDpr,
      cumulativePartyDamage: C[i],
      monsterDpr: D[i],
      cumulativeMonsterDamage: E[i],
    })),
  };
}

/**
 * The one number a DM needs when the two models disagree: how much softer the body trace is.
 *
 * ⚠ ALWAYS REPORT THE AGGREGATE WHEN IT IS HARSHER. The body trace removes dead bodies' output and
 * is the contract's final answer, but it is also the optimistic one, and a DM reading only it has
 * no way to know the aggregate expected two more PCs on the floor.
 */
export function auditDivergence(
  aggregate: AggregateAudit,
  bodyTrace: { completionRound: number | null; downsAtCompletion: number | null },
): { agrees: boolean; note: string } {
  const aggDowns = typeof aggregate.projectedDowns === "number" ? aggregate.projectedDowns : null;
  const aggRound = typeof aggregate.completionRound === "number" ? aggregate.completionRound : null;

  /**
   * ⚠ A NULL IS NOT AN AGREEMENT. The body trace returns null for every outcome when the party is
   * wiped before it finishes the roster — there is no completion round because there is no
   * completion. Comparing null against the aggregate's numbers and finding "no difference" reported
   * a wipe as a clean match, which is the most dangerous possible thing for this function to say.
   */
  if (bodyTrace.completionRound === null) {
    const wipes = typeof aggregate.fatalRound === "number";
    return {
      agrees: wipes,
      note: wipes
        ? `Both models wipe the party — the body trace never finishes the roster, and the aggregate `
          + `audit puts the fatal round at ${aggregate.fatalRound}.`
        : `The body trace wipes the party before the roster is cleared, but the workbook's aggregate `
          + `audit reports "${aggregate.fatalRound}". The two models disagree on survival, not just `
          + `on margin — check the roster's DPR before running this fight.`,
    };
  }

  const roundGap = aggRound !== null ? Math.abs(aggRound - bodyTrace.completionRound) : 0;
  const downGap = aggDowns !== null && bodyTrace.downsAtCompletion !== null
    ? aggDowns - bodyTrace.downsAtCompletion : 0;

  if (roundGap < 1 && downGap === 0) return { agrees: true, note: "Aggregate audit and body trace agree." };
  if (roundGap >= 1) {
    return {
      agrees: false,
      note: `The fight ends on round ${bodyTrace.completionRound} by body trace and round ${aggRound} `
        + `by the workbook's aggregate audit. Treat the aggregate as the sanity check and look for `
        + `why the traced roster is dying faster or slower than its flat DPR implies.`,
    };
  }
  return {
    agrees: false,
    note: `Body trace projects ${bodyTrace.downsAtCompletion} down, the workbook's aggregate audit `
      + `${aggDowns}. The trace removes each body's output the round it dies, so it always reads `
      + `softer with more than one body; the aggregate is the pessimistic sanity check.`,
  };
}
