/**
 * Local dice roller — the last link in the roller chain.
 *
 * Dice+ is the built-in roller and gets first refusal on every roll. When no dice
 * extension answers (none installed, or the request times out), the table should not
 * be stuck on "Waiting for roll…" — the math takes over here, rolls the formula
 * locally, and posts the result to the log exactly as though a dice app had rolled it.
 *
 * Deliberately its own module with no OBR import so it works outside Owlbear too.
 */

export type LocalRollTerm =
  | { kind: "dice"; count: number; sides: number; rolls: number[]; sign: 1 | -1; total: number }
  | { kind: "flat"; value: number; sign: 1 | -1; total: number };

export type LocalRollResult = {
  formula: string;
  /** The first d20 rolled, when there is one — drives nat 1 / nat 20 handling. */
  naturalRoll?: number;
  total: number;
  terms: LocalRollTerm[];
  /** "1d20+5 → [17] +5 = 22" — reads like a dice app's output in the log. */
  text: string;
};

const TERM = /([+-]?)\s*(\d*)d(\d+)|([+-]?)\s*(\d+)(?!\s*d)/gi;

function rollDie(sides: number, rng: () => number): number {
  return Math.floor(rng() * sides) + 1;
}

/**
 * Roll a dice formula: "1d20+5", "2d8+3", "1d12", "4", "1d20+@PROF" (resolve @vars
 * BEFORE calling — anything non-numeric left in the string is ignored).
 * Returns null when the formula contains no rollable or numeric term at all.
 */
export function rollFormulaLocally(formula: string, rng: () => number = Math.random): LocalRollResult | null {
  if (!formula || !formula.trim()) return null;
  // Strip square brackets some formulas carry ("[1d20+3]") and any leftover @vars.
  const cleaned = formula.replace(/[[\]]/g, "").replace(/@[A-Za-z]+/g, "").trim();
  const terms: LocalRollTerm[] = [];
  let naturalRoll: number | undefined;
  let match: RegExpExecArray | null;
  TERM.lastIndex = 0;

  while ((match = TERM.exec(cleaned)) !== null) {
    const [, diceSign, rawCount, rawSides, flatSign, rawFlat] = match;
    if (rawSides !== undefined) {
      const sides = Number.parseInt(rawSides, 10);
      const count = rawCount === "" ? 1 : Number.parseInt(rawCount, 10);
      if (!Number.isFinite(sides) || sides < 1 || !Number.isFinite(count) || count < 1) continue;
      const sign: 1 | -1 = diceSign === "-" ? -1 : 1;
      const rolls: number[] = [];
      for (let i = 0; i < count; i++) rolls.push(rollDie(sides, rng));
      // The first d20 in the formula is the natural roll the table cares about.
      if (sides === 20 && naturalRoll === undefined) naturalRoll = rolls[0];
      const sum = rolls.reduce((a, b) => a + b, 0);
      terms.push({ kind: "dice", count, sides, rolls, sign, total: sign * sum });
    } else if (rawFlat !== undefined) {
      const value = Number.parseInt(rawFlat, 10);
      if (!Number.isFinite(value)) continue;
      const sign: 1 | -1 = flatSign === "-" ? -1 : 1;
      terms.push({ kind: "flat", value, sign, total: sign * value });
    }
  }

  if (terms.length === 0) return null;
  const total = terms.reduce((sum, t) => sum + t.total, 0);

  const parts = terms.map((t, i) => {
    const op = t.sign === -1 ? "−" : i === 0 ? "" : "+";
    const body = t.kind === "dice" ? `[${t.rolls.join(", ")}]` : String(t.value);
    return i === 0 && t.sign === 1 ? body : `${op} ${body}`;
  });

  return {
    formula,
    naturalRoll,
    total,
    terms,
    text: `${formula} → ${parts.join(" ")} = ${total}`,
  };
}

/** Nat 20 / nat 1 detection for a local roll, matching the bridge's semantics. */
export function localRollCrit(result: LocalRollResult | null, critThreshold = 20): {
  isCrit: boolean;
  isFumble: boolean;
} {
  const nat = result?.naturalRoll;
  if (typeof nat !== "number") return { isCrit: false, isFumble: false };
  return { isCrit: nat >= critThreshold, isFumble: nat === 1 };
}
