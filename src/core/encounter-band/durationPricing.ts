/**
 * THE v5 DURATION READERS, PRICED — how long a state stands, as a probability.
 *
 * Christopher, 2026-09-13: *"complete phase 2."* Phase 1 (0.8.55.0) READ durations — every lasting state
 * names its duration reader and endpoint. This file is what those readers are worth, in the v5 pricer's
 * own formulas (Broad Reader Library):
 *
 *   BR073  "For each damaging event requiring a check, P_CONC_SAVE = P(Con save >= CONC_DC); P_ACTIVE_R
 *           multiplies the sequence of required concentration saves and source survival."
 *   BR066  "Two-turn value = V_turn1 + P_ACTIVE_2*V_turn2; P_ACTIVE_2 includes source survival,
 *           concentration, repeat saves, and break conditions as applicable."
 *   BR067  "N-round value = sum(r=1..N) P_ACTIVE_R * V_EVENT_r; truncate at encounter end."
 *   BR075  "At each target-turn start, affected state first contributes until the save; after the roll,
 *           next-state probability is multiplied by P_REPEAT_FAIL."
 *   BR076  "Affected state contributes through the target's turn; at turn end, next-state probability is
 *           multiplied by P_REPEAT_FAIL."
 *   BR077  "P_ACTIVE at each interval = product of all prior repeat-failure probabilities, plus any
 *           maximum-duration cap."
 *
 * ⚠ PURE ARITHMETIC. No creature, roster or party is read here, so the packaged engine can import it.
 * The checker supplies the damage a caster took (`checkerV2`); the reader composition supplies a save DC
 * and a party save (`broadReaderGate`).
 */

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** SRD 5.2.1 Concentration: DC 10 or half the damage taken, whichever is higher, to a maximum of 30. */
function concentrationDc(damage: number): number {
  return Math.min(30, Math.max(10, Math.floor(Math.max(0, damage) / 2)));
}

/**
 * P_CONC_HOLD over one interval between the holder's turns — BR073.
 *
 * Every damage instance calls its own Constitution save, so `damage` is split into instances of
 * `instanceSize` and the hold is P_CONC_SAVE to that many (a fractional count is a fractional exponent).
 * A single blow smaller than one instance is one save at its own DC.
 *
 * ⚠ THE INSTANCE IS ONE PC'S SHARE OF THE ROUND. The party curve carries damage per round, not attacks
 * per PC, so a PC with Extra Attack is read as one larger hit: one save at a higher DC rather than two at
 * DC 10. The failure convention is every save's in the checker: fail = (DC − bonus − 1) / 20.
 */
export function concentrationHold(conSave: number, damage: number, instanceSize: number): { hold: number; instances: number; dc: number } {
  if (!(damage > 0) || !(instanceSize > 0)) return { hold: 1, instances: 0, dc: 10 };
  const size = Math.min(instanceSize, damage);
  const instances = damage / size;
  const dc = concentrationDc(size);
  const save = 1 - clamp01((dc - conSave - 1) / 20);
  return { hold: Math.pow(save, instances), instances, dc };
}

/**
 * BR066 / BR067 — the average share of a recast cycle the effect stands.
 *
 * Turn 1 stands (the cast); turn k stands with P_ACTIVE_k = hold^(k−1). Averaged over the cycle, because
 * the checker's round-2+ figures are already that cycle's average (the Action given up is 1/duration of a
 * round). Two turns: (1 + P_ACTIVE_2) / 2. One turn: always 1 — there is no later turn to lose.
 */
export function cycleActiveShare(turns: number, holdPerInterval: number): number {
  const n = Math.max(1, Math.round(Number(turns) || 1));
  const h = clamp01(holdPerInterval);
  let sum = 0;
  let p = 1;
  for (let k = 0; k < n; k++) { sum += p; p *= h; }
  return sum / n;
}

/** P_REPEAT_FAIL — an affected target failing its repeat save. The same convention as its first save. */
export function repeatFailChance(dc: number, saveBonus: number): number {
  return clamp01((dc - saveBonus - 1) / 20);
}

export type SaveEndsTiming = "start" | "end" | "interval";

/**
 * BR075 / BR076 / BR077 — how many of the target's turns a save-ends state is expected to stand, capped.
 *
 *   end / interval   the state holds through turn 1; each later turn stands with P_REPEAT_FAIL^(k−1)
 *   start            the save comes BEFORE the turn's actions: turn k stands with P_REPEAT_FAIL^k, and what
 *                    triggers before the roll (`beforeSave`) still sees P_REPEAT_FAIL^(k−1)
 *
 * `maxTurns` is the printed maximum or, for a minute, the encounter's horizon (BR068: "caps the nominal
 * ten-round duration at expected encounter length").
 */
export function saveEndsActiveTurns(timing: SaveEndsTiming, pRepeatFail: number, maxTurns: number): {
  expectedTurns: number; duringTurn: number[]; beforeSave: number[];
} {
  const f = clamp01(pRepeatFail);
  const cap = Math.max(0, Math.floor(Number(maxTurns) || 0));
  const beforeSave = Array.from({ length: cap }, (_, k) => Math.pow(f, k));
  const duringTurn = timing === "start" ? beforeSave.map(p => p * f) : beforeSave;
  return { expectedTurns: duringTurn.reduce((s, p) => s + p, 0), duringTurn, beforeSave };
}
