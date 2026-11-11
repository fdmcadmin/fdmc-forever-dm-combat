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

/**
 * Strip a label down to something Dice+ will not choke on.
 *
 * Dice+ parses the text after "#" and throws on dice or math tokens — a label like
 * "Greataxe (dmg +2)" comes back as "Unexpected token: MATH". Keep readable words only.
 */
export function sanitizeDiceLabel(label: string): string {
  return label
    .replace(/\d*d\d+/gi, " ")
    .replace(/[+\-*/#=<>()]/g, " ")
    .replace(/\b\d+\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Append "# label" to a formula that has no label of its own. */
export function labelDiceFormula(formula: string, label: string): string {
  const cleanFormula = formula.trim();
  if (!cleanFormula) return cleanFormula;
  if (cleanFormula.includes("#")) return cleanFormula;
  const safeLabel = sanitizeDiceLabel(label);
  return safeLabel ? `${cleanFormula} # ${safeLabel}` : cleanFormula;
}

/**
 * THE LABEL THE DICE FEED ACTUALLY SHOWS — who is rolling, and what with.
 *
 * Christopher, 2026-10-25, asking whether the dice log shows *"the creature who is rolling and the
 * action instead of 'DM' did x"*. It did not. Dice+ renders two things: `playerName`, which is the
 * HUMAN who clicked, and the dice notation. So every monster attack the DM rolled appeared in the
 * feed as the DM rolling bare dice — the monster card sends its formula with no label at all — and
 * one player running two characters got the same name for both.
 *
 * ⚠ THE STRUCTURED FIELDS ARE NOT ENOUGH ON THEIR OWN. `characterName` and `rolledByRole` are
 * attached to the Dice+ message, but they are OUR keys: the dice extension does not read them, so
 * nothing in them can reach the feed. The notation is the one field it is guaranteed to display,
 * which is why the attribution has to live there as well.
 *
 * A formula that already carries a label keeps it and gains the character in front, so
 * "Claw reroll" becomes "Brandwing Claw reroll" rather than losing the qualifier.
 */
export function diceFeedLabel(formula: string, characterName?: string, actionName?: string): string {
  const cleanFormula = formula.trim();
  if (!cleanFormula) return cleanFormula;
  const who = sanitizeDiceLabel(characterName ?? "");
  if (!who) return labelDiceFormula(cleanFormula, actionName ?? "");

  const hash = cleanFormula.indexOf("#");
  if (hash < 0) {
    const what = sanitizeDiceLabel(actionName ?? "");
    return `${cleanFormula} # ${what ? `${who} ${what}` : who}`;
  }
  const dice = cleanFormula.slice(0, hash).trimEnd();
  const existing = cleanFormula.slice(hash + 1).trim();
  // Already attributed (a reroll re-sent through here) — leave it alone.
  if (existing.toLowerCase().startsWith(who.toLowerCase())) return cleanFormula;
  return `${dice} # ${who}${existing ? ` ${existing}` : ""}`;
}

/**
 * THE KEEP THE ROLLER DID NOT HONOUR — advantage that added both dice instead of taking the best.
 *
 * Christopher, 2026-11-10: *"the advantage on the DM side adds the dice instead of use the best of
 * the rolls."*
 *
 * `applyAdvantage` sends the right thing: "1d20+7" goes out as "2d20kh1+7". What comes back is
 * `result.totalValue`, and the app trusted it. When the roller does not implement `kh1` it rolls
 * two d20s, keeps BOTH, and totals them — so a 6 and a 19 with +7 came back as 32 instead of 26.
 * The natural roll was never wrong, because `findDicePlusNaturalRoll` already reads each die's
 * `kept` flag and takes the max; only the total was.
 *
 * ⚠ THE FIX IS CONDITIONAL, AND THAT MATTERS. A roller that DOES honour the keep marks the dropped
 * die `kept: false`, and its total is already right — correcting that one would break it in the
 * other direction. So the total is only recomputed when the notation asked for a keep AND nothing
 * came back marked as dropped, which is the exact signature of a roller that ignored it.
 *
 * This is the half of the contract the module header has always promised: *"If a future Dice+
 * build rejects that notation, the only change needed is here + the result normalizer."*
 */

/** The keep a formula asks for — `2d20kh1` → `{ mode: "kh", count: 1 }`. Null when it asks none. */
export function keepSpec(notation: string | undefined): { mode: "kh" | "kl"; count: number } | null {
  if (!notation) return null;
  const m = /\d*d\d+k(h|l)(\d*)/i.exec(notation);
  if (!m) return null;
  const count = m[2] ? Number.parseInt(m[2], 10) : 1;
  return Number.isFinite(count) && count > 0 ? { mode: m[1].toLowerCase() === "l" ? "kl" : "kh", count } : null;
}

/**
 * The total a keep-notation roll should have had.
 *
 * Returns `total` unchanged when there is nothing to fix: no keep asked for, the roller already
 * dropped dice itself, or there were never more dice than the keep allows.
 */
export function correctedKeepTotal(
  total: number,
  notation: string | undefined,
  dice: readonly { value?: number; kept?: boolean }[],
): number {
  const keep = keepSpec(notation);
  if (!keep) return total;
  // The roller honoured it — its own total already excludes the dropped dice.
  if (dice.some(d => d.kept === false)) return total;
  const values = dice.map(d => d.value).filter((v): v is number => typeof v === "number");
  if (values.length <= keep.count) return total;
  // Highest-first for kh, lowest-first for kl; everything past `count` was never meant to count.
  const ordered = [...values].sort((a, b) => keep.mode === "kh" ? b - a : a - b);
  const dropped = ordered.slice(keep.count).reduce((sum, v) => sum + v, 0);
  return total - dropped;
}
