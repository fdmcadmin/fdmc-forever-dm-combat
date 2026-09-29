/**
 * THE TACTICAL AI — the round engine's decision policy, ported from Christopher's own model.
 *
 * Source: `C:\Users\cjda0\Documents\D&D campaign\Act Run Auditor\Current Model\Tactical AI Runtime`,
 * the `Tactical_AI` sheet of `Broken_Chain_Act3_Tactical_AI.xlsx` and the formulas that build it in
 * `apply_tactical_ai.py`. Its README states what it is and is not:
 *
 *   *"This is a deterministic expected-value model. The 70% settings are weighting shares, not
 *    measured 70% tactical accuracy. Exact token grid, line of sight, and per-damage-type
 *    resistance/immunity are absent from current source data, so movement and elemental
 *    counter-choice use abstract reach/group inputs."*
 *
 * ⚠ EVERY WEIGHT BELOW IS A CELL IN THAT SHEET, quoted with the note printed beside it. They are
 * editable there, so they are named constants here rather than numbers buried in a formula — the
 * same provenance rule `check:traits` enforces for trait multipliers. A weight that drifts from the
 * workbook is a silent disagreement with the model this app is supposed to be reproducing.
 */

/** `Tactical_AI!B4:B11`, in sheet order. */
export const TACTICAL_AI = {
  /** B4 — "70% of target priority comes from current threat; 30% preserves the authored order." */
  targetWeight: 0.70,
  /**
   * B5 — "70% of single-target pressure follows the most vulnerable reachable PC; 30% follows
   * authored reach weights. This is a modeled allocation, not validated behavioral accuracy."
   */
  focusFireWeight: 0.70,
  /** B6 — "Raises or lowers the expected value of creature AoE attacks based on party spacing." */
  partyClusterFactor: 0.50,
  /** B7 — "Expected additional targets when a PC uses an area action." */
  creatureClusterFactor: 0.60,
  /**
   * B8 — "Frontline melee attacks gain a 70/30 blend of advantage and normal hit chance when two or
   * more frontliners are active."
   */
  surroundAdvantageQuality: 0.70,
  /** B9 — "A reachable Guardian draws this share of single-target pressure while the Bond is active." */
  guardianChallengeShare: 0.70,
  /**
   * B10 — "Use a Bond heal or temporary-HP branch when party health falls below this share;
   * otherwise prefer its offense."
   */
  bondDefenceThreshold: 0.60,
  /** B11 — "In-combat and self-healing threshold. Downed allies remain eligible for rescue." */
  healTrigger: 0.40,
} as const;

/**
 * ⚠ A LOST TURN IS WORTH TEN DAMAGE — *to the party's target choice*, and nowhere else.
 *
 * `apply_tactical_ai.py`, building `threat_b`: *"Combat threat in expected damage, with lost turns
 * valued at 10 damage."* The formula is `Σ(Sn+An+Fn) + 10*Σ(CSn+CAn)` — a creature's expected
 * damage plus ten per PC turn it takes away.
 *
 * ⚠ THIS DOES NOT REPLACE `turnDenial`. What a lost turn COSTS the party is priced from that PC's
 * own share of the party's damage (0.8.57.0, and Christopher's ruling that it is charged on a PC's
 * lost turn rather than the party's). Ten is the model's RANKING weight — what makes a party decide
 * to kill the stunner first — and using it as a cost would overwrite a number he already settled.
 */
export const LOST_TURN_THREAT = 10;

/**
 * What one body of a group is worth killing, in the model's own units.
 *
 * Expected damage a body deals in a round, plus `LOST_TURN_THREAT` per PC turn it denies. Both are
 * per BODY, because that is what the party kills and what `encounterDprAt` multiplies by.
 */
export function bodyThreat(input: {
  /** This body's expected damage for the round — `roundValue(group.dpr, round) * dprUptime`. */
  damagePerRound: number;
  /** PC turns this body takes away in the round. */
  pcTurnsDeniedPerRound?: number;
}): number {
  const damage = Number(input.damagePerRound);
  const turns = Number(input.pcTurnsDeniedPerRound ?? 0);
  return (Number.isFinite(damage) ? Math.max(0, damage) : 0)
    + (Number.isFinite(turns) ? Math.max(0, turns) : 0) * LOST_TURN_THREAT;
}

/**
 * THE TARGET PRIORITY SCORE — `apply_tactical_ai.py`, verbatim in shape:
 *
 *     Tactical_AI!$B$4 * 4 * threat_b / MAX(0.001, MAX(threats))
 *       + (1 - Tactical_AI!$B$4) * (5 - b)
 *       + 0.00001 * (5 - b)
 *
 * ⚠ THE `4` AND THE `5 - b` ARE THE BODY COUNT, not constants. The workbook's engine is fixed at
 * four bodies, so `4` is N and `5 - b` is `N + 1 - order`: the authored term runs N..1 down the
 * list, and the threat term is normalised onto the same 0..N scale so the two halves are
 * commensurate before the weight blends them. Generalising them is what lets a six-group roster be
 * scored by the same policy rather than by a second one written here.
 *
 * The trailing `0.00001 * (N + 1 - order)` is the model's own tie-break: two identical threats keep
 * the authored order between them, deterministically, instead of depending on sort stability.
 */
export function targetScores(
  bodies: ReadonlyArray<{ threat: number; authoredOrder: number }>,
  weight: number = TACTICAL_AI.targetWeight,
): number[] {
  const n = bodies.length;
  if (n === 0) return [];
  const maxThreat = Math.max(0.001, ...bodies.map(b => (Number.isFinite(b.threat) ? b.threat : 0)));
  return bodies.map(b => {
    const authored = n + 1 - b.authoredOrder;
    const threat = Number.isFinite(b.threat) ? Math.max(0, b.threat) : 0;
    return weight * n * threat / maxThreat + (1 - weight) * authored + 0.00001 * authored;
  });
}
