/**
 * diceFormula — small pure helpers for assembling roll formulas (P-ROLL).
 *
 * These operate on the plain dice-notation strings the app already sends to the
 * Dice+ bridge (e.g. "1d20+6", "1d20 - 2"). They are deliberately string-level so
 * they compose with the existing formula plumbing without a schema change.
 *
 * Advantage / disadvantage is expressed in Dice+ keep-highest / keep-lowest
 * notation: 2d20kh1 (advantage) / 2d20kl1 (disadvantage). If a future Dice+ build
 * rejects that notation, the only change needed is here + the result normalizer in
 * useOwlbearDiceBridge.ts — callers stay untouched.
 */

export type RollMode = "normal" | "adv" | "disadv";

/**
 * Rewrite the FIRST `d20` term of a formula for advantage / disadvantage.
 * "normal" is a no-op. Modifiers and any surrounding text are preserved.
 *   applyAdvantage("1d20+6", "adv")    -> "2d20kh1+6"
 *   applyAdvantage("1d20 - 2", "disadv") -> "2d20kl1 - 2"
 */
export function applyAdvantage(formula: string, mode: RollMode): string {
  if (mode === "normal" || !formula) return formula;
  const keep = mode === "adv" ? "2d20kh1" : "2d20kl1";
  let replaced = false;
  return formula.replace(/\d*d20/i, () => {
    if (replaced) return "d20"; // shouldn't recur (no /g), but stay safe
    replaced = true;
    return keep;
  });
}

/**
 * Append a one-off bonus die to a d20 roll formula.
 *   appendBonusDie("1d20+6", "d6") -> "1d20+6 + 1d6"
 */
export function appendBonusDie(formula: string, die: string): string {
  const clean = die.startsWith("d") ? die : `d${die}`;
  if (!formula) return `1${clean}`;
  return `${formula} + 1${clean}`;
}

/** Build a raw ability-check / save formula from a modifier: "1d20+3" / "1d20-1". */
export function abilityCheckFormula(modifier: number): string {
  return `1d20${modifier >= 0 ? `+${modifier}` : `${modifier}`}`;
}

/**
 * Parse a monster ability-score display value into its modifier.
 * Accepts "19 (+4)", "4 (-3)", or a bare score "13" (derives floor((s-10)/2)).
 */
export function parseAbilityModifier(value: string): number {
  const paren = value.match(/\(\s*([+-]?\d+)\s*\)/);
  if (paren) return Number.parseInt(paren[1], 10);
  const score = Number.parseInt(value, 10);
  return Number.isFinite(score) ? Math.floor((score - 10) / 2) : 0;
}
