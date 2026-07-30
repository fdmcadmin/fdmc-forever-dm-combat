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

/**
 * Scale an upcast rider — "what ONE extra slot level adds" — by the number of levels above
 * the spell's base, so a rider can be authored once instead of per level.
 *
 *   scaleUpcastRider("1d6", 2)            → "2d6"     (Fireball at L5)
 *   scaleUpcastRider("2d8", 3)            → "6d8"     (Cure Wounds at L4)
 *   scaleUpcastRider("1d8+2", 2)          → "2d8 + 4"
 *   scaleUpcastRider("1d6", 2, true)      → "4d6"     (crit: dice double, see below)
 *
 * On a CRIT only the dice double, never the flat modifiers (PHB) — so the dice count is
 * multiplied by `steps × 2` while flat terms stay on `steps`.
 *
 * Anything the parser cannot safely multiply (an @VAR, arithmetic, parentheses) is repeated
 * `steps` times joined by "+" instead. That is uglier but always arithmetically right, which
 * matters more than tidiness for something feeding a real roll.
 */
export function scaleUpcastRider(formula: string, steps: number, crit = false): string {
  const trimmed = (formula ?? "").trim().replace(/^\+\s*/, "");
  if (!trimmed || steps <= 0) {
    return "";
  }

  const diceSteps = crit ? steps * 2 : steps;
  const repeat = () => Array.from({ length: steps }, () => trimmed).join(" + ");

  // A variable or arithmetic term can't be folded into a single coefficient safely.
  if (/[@*/()]/.test(trimmed)) {
    return steps === 1 && !crit ? trimmed : repeat();
  }

  const parts = trimmed.split(/(?=[+-])/).map((part) => part.trim()).filter(Boolean);
  const scaled: Array<{ sign: string; body: string }> = [];

  for (const part of parts) {
    const sign = part.startsWith("-") ? "-" : "+";
    const body = part.replace(/^[+-]\s*/, "");

    const dice = body.match(/^(\d*)d(\d+)$/i);
    if (dice) {
      const count = dice[1] === "" ? 1 : Number.parseInt(dice[1], 10);
      scaled.push({ sign, body: `${count * diceSteps}d${dice[2]}` });
      continue;
    }

    const flat = body.match(/^\d+$/);
    if (flat) {
      scaled.push({ sign, body: String(Number.parseInt(body, 10) * steps) });
      continue;
    }

    return repeat();
  }

  return scaled
    .map((term, index) => (index === 0
      ? (term.sign === "-" ? `-${term.body}` : term.body)
      : ` ${term.sign} ${term.body}`))
    .join("");
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
