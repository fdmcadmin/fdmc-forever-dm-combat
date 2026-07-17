/**
 * encounterRounds.ts — predicted ROUNDS-TO-KILL for an encounter.
 *
 * WHY THIS EXISTS: `encounterDifficulty.ts` reports `threat 360 vs budget 288 = 1.25×`.
 * Those units are invented — nothing at the table is 288 of anything, so the DM cannot
 * check the claim against reality. It rated 2× Lesser Wendigo at low as "Hard" for a
 * party of 4; the fight ran 3.5–4.5 rounds and nobody went down.
 *
 * Rounds-to-kill is falsifiable: the panel predicts a number, the DM counts rounds at
 * the table, and a mismatch means the model is wrong. That feedback loop is the point.
 *
 *   rounds = Σ(rawHP × kitMultiplier × count) ÷ (midpointDPR × size/5 × lane × REALIZATION)
 *
 * CALIBRATION (2026-07: single data point — treat as provisional):
 *   2× Lesser Wendigo @ 90 HP = 180 HP died in 3.5–4.5 rounds to a 4P party at L4.
 *   Chart expected 58.1 → ~45 actual, so REALIZATION ≈ 0.77.
 *
 * Source of truth for DPR: `broken_chain_encounter_dpr_design.xlsx` (bond + class, 5P).
 *
 * The predicted number is judged against a TARGET BAND chosen by the encounter's
 * classification (see `ROUND_BAND`) — a normal fight and an act boss are no longer held
 * to the same window.
 */

// Type-only: erased at compile, so this module stays dependency-free for the test harness.
import type { MonsterClassification } from "../monsters/runtime/mainMonsterRuntime";

/**
 * 5-player MIDPOINT expected DPR by pseudo level.
 *
 * MIDPOINT, never peak: L6 peak is 246.7 vs midpoint 112.2, so sizing to peak would make
 * a low-rolling party grind a fight built for 2.2× their real output.
 *
 * L3/L6/L9/L12 are read off the chart's Encounter DPR Bands. L4/L5 are derived by backing
 * the selected party's ~1.18× premium out of its per-level rows. L5 is a CLIFF — class DPR
 * jumps 53.3 → 102.1 as Extra Attack and 3rd-level spells come online — which is why any
 * ladder tuned before L5 reads ~2× undersized after it.
 */
const MIDPOINT_DPR_5P: ReadonlyArray<readonly [level: number, dpr: number]> = [
  [3, 55.0],
  [4, 59.3],
  [5, 100.5],
  [6, 112.2],
  [9, 135.1],
  [12, 142.8],
];

/**
 * Fraction of chart DPR a real table actually lands. The chart is dice EV with no
 * hit-chance, no movement, no rounds spent not attacking. Calibrated from ONE fight —
 * the weakest number in this model. Every prediction scales linearly with it.
 */
export const REALIZATION = 0.77;

/** Party bond posture. Multiplier = that party's DPR ÷ midpoint DPR. */
export type PartyLane = "easy" | "standard" | "hard" | "punishing";

/**
 * Measured, not guessed: the selected party snapshot runs 132.6 vs midpoint 112.2 at L6
 * = 1.18×, which is the "punishing" anchor. A 4-player punishing party (0.8 × 1.18 ≈ 0.95)
 * therefore fights like a 5-player standard one — which is exactly why "2 Lessers at low"
 * felt easy while the checker called it Hard.
 */
export const LANE_MULTIPLIER: Record<PartyLane, number> = {
  easy: 0.87,        // defensive bonds
  standard: 1.0,     // mixed — the midpoint itself
  hard: 1.14,        // offensive, retains some defence
  punishing: 1.18,   // damage on the mind; every choice-bond in the offence lane
};

export const LANE_LABEL: Record<PartyLane, string> = {
  easy: "Easy · defensive",
  standard: "Standard · mixed",
  hard: "Hard · offensive",
  punishing: "Punishing · all damage",
};

/**
 * TARGET FIGHT LENGTH per classification, in rounds (Christopher, 2026-07-17).
 *
 * The band IS the wiggle room: anywhere inside it is "On target". Below min the party
 * walked through it; above max it is turning into a slog. Note there is no single
 * 3-round floor — a `normal` fight is *supposed* to end in 2-2.5; the floor only ever
 * applied to bosses.
 *
 * Data, not code — on purpose. These are the targets every encounter is judged against,
 * so they must be correctable from real fights rather than buried in a threshold chain
 * (the mistake `BOSS_MULT` made).
 */
export const ROUND_BAND: Record<MonsterClassification, { min: number; max: number }> = {
  normal: { min: 2, max: 2.5 },
  strong: { min: 2.25, max: 3.5 },
  elite: { min: 3.25, max: 4.5 },
  "mid-boss": { min: 4, max: 5.5 },
  "act-boss": { min: 5, max: 6.5 },
  "final-boss": { min: 6, max: 8 },
};

export const CLASSIFICATION_LABEL: Record<MonsterClassification, string> = {
  normal: "Normal",
  strong: "Strong",
  elite: "Elite",
  "mid-boss": "Mid boss",
  "act-boss": "Act boss",
  "final-boss": "Final boss",
};

/** Weakest → strongest. The encounter's band comes from the strongest creature in it. */
export const CLASSIFICATION_ORDER: readonly MonsterClassification[] = [
  "normal",
  "strong",
  "elite",
  "mid-boss",
  "act-boss",
  "final-boss",
];

/**
 * A fight is judged by its BIGGEST threat: a mid-boss escorted by chaff is a mid-boss
 * fight (4-5.5), not an average of the two. Chaff still adds HP, so it pushes the
 * estimate up inside that band rather than changing which band applies.
 */
export function encounterClassification(monsters: RoundsMonster[]): MonsterClassification {
  let top = 0;
  for (const m of monsters) {
    if (m.count <= 0) continue;
    const idx = CLASSIFICATION_ORDER.indexOf(m.classification ?? "normal");
    if (idx > top) top = idx;
  }
  return CLASSIFICATION_ORDER[top]!;
}

export type RoundsMonster = {
  id: string;
  name: string;
  /** HP after the party-size band is applied. */
  maxHp: number;
  count: number;
  /** Threat tier — sets the target band for the fight. Unset = "normal". */
  classification?: MonsterClassification;
  /**
   * Effective-HP multiplier from the creature's KIT — resistances, teleport/reposition,
   * control that denies party turns, and downs. Raw HP ÷ DPR badly under-counts: the
   * Wendigo Wight's aura + Hunger Leap + legendary-driven downs cost ~25% of party uptime,
   * so 340 raw plays like ~450. 1.0 = a static punching bag.
   */
  kitMultiplier: number;
};

/** Linear interpolation across the chart's level checkpoints. */
export function midpointDprForLevel(level: number): number {
  const lv = Math.max(1, Math.min(20, Math.floor(level || 1)));
  const pts = MIDPOINT_DPR_5P;
  if (lv <= pts[0][0]) return pts[0][1];
  if (lv >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
  for (let i = 0; i < pts.length - 1; i++) {
    const [l0, d0] = pts[i];
    const [l1, d1] = pts[i + 1];
    if (lv >= l0 && lv <= l1) {
      if (l1 === l0) return d0;
      return d0 + ((d1 - d0) * (lv - l0)) / (l1 - l0);
    }
  }
  return pts[pts.length - 1][1];
}

/** Effective party DPR — what the table actually puts out per round. */
export function partyDpr(
  size: number,
  level: number,
  lane: PartyLane = "standard",
  resources: PartyResources = "fresh",
): number {
  const s = Math.max(1, Math.floor(size || 5));
  return midpointDprForLevel(level)
    * (s / 5)
    * LANE_MULTIPLIER[lane]
    * RESOURCE_MULTIPLIER[resources]
    * REALIZATION;
}

/** Total effective HP the party must chew through, kit included. */
export function effectiveHp(monsters: RoundsMonster[]): number {
  return monsters.reduce(
    (sum, m) => sum + m.maxHp * (m.kitMultiplier || 1) * Math.max(0, m.count),
    0,
  );
}

export type RoundsEstimate = {
  rawHp: number;
  effectiveHp: number;
  dpr: number;
  rounds: number;
  /** The tier this fight is judged as — the strongest creature in it. */
  classification: MonsterClassification;
  /** The target band for that tier. Inside it = On target. */
  band: { min: number; max: number };
  /** How the fight reads against its own band. */
  verdict: "Throwaway" | "Short" | "On target" | "Long" | "Slog";
};

/**
 * Judge a predicted round count against its tier's band.
 *
 * Inside the band = On target — the band already carries the wiggle room, so nothing is
 * added on top. Outside it, the margins scale with the band so the wording means the same
 * thing at every tier: a normal fight (2-2.5) is a Slog past ~3.1, an act boss (5-6.5)
 * past ~8.1.
 */
export function verdictForRounds(
  rounds: number,
  classification: MonsterClassification = "normal",
): RoundsEstimate["verdict"] {
  const band = ROUND_BAND[classification] ?? ROUND_BAND.normal;
  if (rounds < band.min * 0.75) return "Throwaway";
  if (rounds < band.min) return "Short";
  if (rounds <= band.max) return "On target";
  if (rounds <= band.max * 1.25) return "Long";
  return "Slog";
}

/**
 * Resource state when the fight starts. The campaign fixes these by MAP, not by chance —
 * e.g. the village long rest sits before S4, then there is nowhere to long rest until the
 * Wendigo Wight, so the Pale Drifter is *always* fought on a short rest. Spell slots do
 * not return on a short rest, and the Frozen Sentinels are built to burn them (Glacial
 * Freeze wastes a slot outright; Whiteout breaks concentration).
 *
 * The 0.88 / 0.75 figures are estimates, not measurements. The number that would pin them
 * is slots remaining when the party walks out of the Sentinels.
 */
export type PartyResources = "fresh" | "shortRest" | "depleted";

export const RESOURCE_MULTIPLIER: Record<PartyResources, number> = {
  fresh: 1.0,
  shortRest: 0.88,
  depleted: 0.75,
};

export const RESOURCE_LABEL: Record<PartyResources, string> = {
  fresh: "Fresh · long rest",
  shortRest: "Short rest only",
  depleted: "Depleted",
};

export function estimateRounds(
  monsters: RoundsMonster[],
  size: number,
  level: number,
  lane: PartyLane = "standard",
  resources: PartyResources = "fresh",
): RoundsEstimate {
  const rawHp = monsters.reduce((s, m) => s + m.maxHp * Math.max(0, m.count), 0);
  const eff = effectiveHp(monsters);
  const dpr = partyDpr(size, level, lane, resources);
  const rounds = dpr > 0 ? eff / dpr : 0;
  const classification = encounterClassification(monsters);
  const band = ROUND_BAND[classification] ?? ROUND_BAND.normal;
  return {
    rawHp,
    effectiveHp: eff,
    dpr,
    rounds,
    classification,
    band,
    verdict: verdictForRounds(rounds, classification),
  };
}
