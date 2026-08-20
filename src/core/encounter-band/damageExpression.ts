/**
 * Reading a printed damage expression. The one piece of the old `encounterConstruction.ts`
 * that survived it — everything else in that file was a parallel action-budget model,
 * superseded by `parseCreature` + `actionTrace`.
 */

/** Average of a dice expression's rolled part: "2d10" → 11. */
function diceAverage(count: number, faces: number): number {
  return (count * (faces + 1)) / 2;
}

/**
 * Expected value of a damage string. Handles the shapes the scanner and creature editor
 * actually produce:
 *   "2d10 + 4"                     → 15
 *   "1d8 + 2 slashing + 1d4 cold"  → 9   (every die and flat term counts, types ignored)
 *   "15 (2d10 + 4)"                → 15  (a leading pre-averaged total wins)
 */
export function damageExpressionAverage(expr: string | undefined): number {
  if (!expr) return 0;
  const text = expr.trim();
  if (!text) return 0;

  const preAveraged = text.match(/^\s*(\d+)\s*\(/);
  if (preAveraged) return Number.parseInt(preAveraged[1], 10);

  /**
   * ⚠ A BARE NUMBER IS A DAMAGE VALUE. Without this the function read "13.5" as ZERO — it only
   * understood dice and SIGNED flat terms, so an unsigned standalone figure fell through every
   * branch and returned 0.
   *
   * That is not hypothetical: half-on-a-save resolves to exactly this shape. Every "half as much
   * on a success" in the campaign was being computed correctly and then silently discarded here,
   * which is why a save-for-half still priced as all-or-nothing.
   */
  const bare = text.match(/^\s*(\d+(?:\.\d+)?)\s*$/);
  if (bare) return Number.parseFloat(bare[1]);

  let total = 0;
  for (const m of text.matchAll(/([+-]?)\s*(\d*)d(\d+)/gi)) {
    const sign = m[1] === "-" ? -1 : 1;
    const count = m[2] === "" ? 1 : Number.parseInt(m[2], 10);
    const faces = Number.parseInt(m[3], 10);
    if (Number.isFinite(count) && Number.isFinite(faces) && faces > 0) {
      total += sign * diceAverage(count, faces);
    }
  }
  const withoutDice = text.replace(/[+-]?\s*\d*d\d+/gi, " ");
  for (const m of withoutDice.matchAll(/([+-])\s*(\d+)/g)) {
    total += (m[1] === "-" ? -1 : 1) * Number.parseInt(m[2], 10);
  }
  return Math.max(0, total);
}

/**
 * What a creature's attacks are resolving AGAINST — the party's own numbers.
 *
 * ⚠ THIS IS A DM INPUT, NOT A CURVE. The workbook publishes the arithmetic —
 *     hit    = clamp((21 + attack_bonus − target_ac) / 20, 0.05, 0.95)
 *     save   = p_fail × fail_damage + (1 − p_fail) × success_damage
 * — and it publishes NO party AC or save-bonus table. There is no such column anywhere in the
 * bundle: not in the contract, not in the party curve, not in the campaign profiles.
 *
 * So the app does not get to supply one. A per-level table here would be exactly the kind of
 * invented design that got the previous model deleted — plausible, unmeasured, and silently
 * moving every damage number in the checker. The DM enters their table's real armour class;
 * the checker states what it used.
 */
export type PartyDefence = {
  ac: number;
  saveBonus: number;
  /**
   * How many PCs are in the fight. Used to price an AREA effect with no printed target count —
   * a cone catches a share of the party, and the workbook's four-PC "two-target" benchmark is
   * exactly half of one. Defaults to the workbook's own four-PC baseline.
   */
  partySize?: number;
};

/**
 * The starting point the input box opens on: a 4-PC party's mid AC and a mid save bonus.
 *
 * Stated as a starting value, never as an authority — the panel prints it as an assumption on
 * every result so it is never mistaken for a workbook figure.
 */
export const DEFAULT_PARTY_DEFENCE: PartyDefence = { ac: 16, saveBonus: 3 };
