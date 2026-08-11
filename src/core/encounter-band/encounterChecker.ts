/**
 * THE ENCOUNTER CHECKER — how a monster gets vetted before it is played.
 *
 * This is a transcription of the checker workbook's Encounter Race, not a model invented here.
 * Its three outputs, and the formulas, are the sheet's own:
 *
 *   MER          = party sustain / monster DPR        (rounds the PARTY survives)
 *   roundsToKill = monster sustain / party DPR        (rounds the MONSTER survives)
 *   raceMargin   = MER - roundsToKill                 (positive = party ahead)
 *
 * ⚠ A CLASSIFICATION IS LETHALITY, NOT ROUND LENGTH (Christopher).
 *
 * Round length already falls out of HP divided by DPR — the tag adds nothing by repeating it.
 * What the tag actually says is how much the fight COSTS: a mid-boss might last three rounds
 * and put one character down; an act boss four rounds, two down, one hurt and one at mid HP.
 * So the readout here is a casualty count and the state of the survivors, and the party's
 * per-PC thresholds are what make that computable — they sum to the party's effective HP, so
 * damage crossing each one in turn drops a character.
 *
 * The old `ROUND_BAND` in encounterRounds.ts answers the other question and is left alone; it
 * is a pacing check, and pacing and lethality are not the same thing.
 */

import {
  PARTY_BASELINE, EXPECTED_MONSTER_AC, AC_DELTA_CONTRIBUTION,
  type PartyBaseline,
} from "./dprBaseline";

export function partyBaselineFor(level: number): PartyBaseline | undefined {
  return PARTY_BASELINE.find(b => b.level === level);
}

/**
 * Effective sustain for one creature: raw HP adjusted by how hard it is to hurt.
 *
 * The AC delta is measured against what the model expects a monster to have at THAT party
 * level, and applied per creature before any encounter total — a creature two points under
 * the curve is genuinely softer than its HP suggests, and the sheet prices that.
 *
 * `traitContributions` are the values from SUSTAIN_TRAITS. They are summed rather than
 * multiplied because the workbook expresses them as shares of effective sustain, but the
 * workbook is equally explicit that they are single-factor references: stacking every defence
 * a creature owns will overstate it, so pass the ones the party will actually run into.
 */
export function effectiveSustain(opts: {
  rawHp: number;
  ac: number;
  partyLevel: number;
  traitContributions?: number[];
}): number {
  const expected = EXPECTED_MONSTER_AC[opts.partyLevel];
  let acContribution = 0;
  if (expected !== undefined) {
    const delta = Math.round(opts.ac - expected);
    if (delta !== 0) {
      // Beyond ±3 the sheet says to combine the listed bands, so walk out in steps.
      const step = delta > 0 ? 1 : -1;
      for (let d = step; Math.abs(d) <= Math.abs(delta); d += step) {
        const band = AC_DELTA_CONTRIBUTION[Math.abs(d) > 3 ? 3 * step : d];
        acContribution += band ?? 0;
      }
    }
  }
  const traits = (opts.traitContributions ?? []).reduce((a, b) => a + b, 0);
  return opts.rawHp * (1 + acContribution + traits);
}

/**
 * ATTRITION — the share of its printed DPR a roster actually delivers.
 *
 * A dead body stops dealing damage. With `bodies` killed in sequence the encounter averages
 * (bodies + 1) / 2·bodies of its printed output: 1.00 for a lone boss, 0.75 for a pair, 0.67
 * for three, 0.63 for four.
 *
 * This is not a fudge factor — it is the entire reason a tag means what it means. Two bodies
 * and six bodies holding the same total HP and the same total DPR are not the same fight, and
 * without this term they score identically. Concentration is what makes a boss lethal.
 */
export function attritionFactor(bodies: number): number {
  const n = Math.max(1, bodies);
  return (n + 1) / (2 * n);
}

export type EncounterCheck = {
  partyLevel: number;
  partyDpr: number;
  partySustain: number;
  monsterSustain: number;
  monsterDpr: number;
  bodies: number;
  /** Rounds the monster survives — the fight's length. */
  roundsToKill: number;
  /** Rounds the party survives. The sheet calls this MER. */
  mer: number;
  /** MER − roundsToKill. Positive means the party wins the race. */
  raceMargin: number;
  status: "PARTY AHEAD" | "TOO CLOSE" | "MONSTER AHEAD";
  /** Damage the party actually absorbs, after attrition. */
  damageTaken: number;
  /** How many characters go down — this is what the classification tag is about. */
  pcsDowned: number;
  /** How far into the next character's health the fight reaches, 0–1. */
  nextPcPressure: number;
  /** Plain reading of the cost, e.g. "2 down, 1 at mid HP". */
  lethalityRead: string;
};

/**
 * Run one encounter against the party baseline.
 *
 * `monsterSustain` is the sum of every body's effective sustain (see effectiveSustain).
 * `monsterDpr` is the roster's printed per-round output — expected damage, not a peak burst.
 *
 * Note that `roundsToKill` depends only on monster sustain and party DPR, never on monster
 * DPR. So the fight's length is known before any monster damage is priced, which is what lets
 * a once-per-fight ability be amortised exactly rather than iterated to a fixed point.
 */
export function checkEncounter(opts: {
  partyLevel: number;
  monsterSustain: number;
  monsterDpr: number;
  /** Number of separate bodies. Drives attrition; defaults to a single body. */
  bodies?: number;
}): EncounterCheck | null {
  const base = partyBaselineFor(opts.partyLevel);
  if (!base) return null;

  const bodies = Math.max(1, opts.bodies ?? 1);
  const roundsToKill = opts.monsterSustain / base.dpr;
  const mer = base.sustain / opts.monsterDpr;
  const raceMargin = mer - roundsToKill;

  const damageTaken = opts.monsterDpr * roundsToKill * attritionFactor(bodies);

  // The thresholds are shares of `baseEhp`, but the race is run against `sustain`. Put them on
  // the same axis before reading them, or the casualty count and the margin disagree about how
  // much punishment the party owns. Scaled this way, a margin of exactly 0 is exactly a wipe.
  const scale = base.sustain / base.baseEhp;
  let cumulative = 0;
  let pcsDowned = 0;
  let nextPcPressure = 0;
  for (let i = 0; i < base.thresholds.length; i++) {
    const share = base.thresholds[i] * scale;
    if (damageTaken >= cumulative + share) { pcsDowned++; cumulative += share; continue; }
    nextPcPressure = Math.max(0, (damageTaken - cumulative) / share);
    break;
  }

  const hurt = nextPcPressure >= 0.66 ? "1 badly hurt"
    : nextPcPressure >= 0.33 ? "1 at mid HP"
    : nextPcPressure > 0 ? "1 scratched" : "";
  const lethalityRead = pcsDowned >= base.thresholds.length
    ? "PARTY WIPE"
    : [pcsDowned > 0 ? `${pcsDowned} down` : "none down", hurt].filter(Boolean).join(", ");

  return {
    partyLevel: opts.partyLevel,
    partyDpr: base.dpr,
    partySustain: base.sustain,
    monsterSustain: opts.monsterSustain,
    monsterDpr: opts.monsterDpr,
    bodies,
    roundsToKill, mer, raceMargin,
    status: raceMargin > 1 ? "PARTY AHEAD" : raceMargin > 0 ? "TOO CLOSE" : "MONSTER AHEAD",
    damageTaken, pcsDowned, nextPcPressure, lethalityRead,
  };
}

/**
 * What each classification is SUPPOSED to cost, in characters.
 *
 * The tag is the price of the fight, not its length (Christopher): "a mid boss might last 3
 * rounds but down 1 person, or an act boss might last 4 rounds but down 2, leave one hurt and
 * one at mid hp". Those two entries are his words; the rest step down from them.
 *
 * Verified against the authored Act 3 roster at the level each fight is run: the three Gates
 * land on 1 down and the act boss on 2 down.
 */
export const EXPECTED_LETHALITY: Record<string, { downed: number; note: string }> = {
  normal: { downed: 0, note: "Nobody down. Resource cost only." },
  strong: { downed: 0, note: "Nobody down, but someone should end it hurt." },
  elite: { downed: 0, note: "Nobody down, or one if the party misplays. Expensive, not deadly." },
  "mid-boss": { downed: 1, note: "One down. Roughly three rounds." },
  "act-boss": { downed: 2, note: "Two down, one hurt and one at mid HP. Roughly four rounds." },
  "final-boss": { downed: 3, note: "Three down. The fight is meant to nearly end them." },
};

/** Does the fight cost what its tag says it should? */
export function lethalityVerdict(check: EncounterCheck, classification: string): {
  ok: boolean; expected: number; actual: number; note: string;
} {
  const want = EXPECTED_LETHALITY[classification] ?? EXPECTED_LETHALITY.normal;
  return {
    // One character either side of the mark is inside authoring tolerance; the workbook is a
    // distribution over 150k runs, not a promise about one table's dice.
    ok: Math.abs(check.pcsDowned - want.downed) <= 1,
    expected: want.downed,
    actual: check.pcsDowned,
    note: want.note,
  };
}
