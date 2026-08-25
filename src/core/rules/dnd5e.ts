/**
 * D&D 5e arithmetic — the MODULE's rules, not the engine's.
 *
 * FDMC is meant to run anything; these three formulas are the parts that are specifically
 * D&D. They live here so a custom system replaces one file rather than hunting derivations
 * through the sheet code. Nothing in here should know about actors, tabs or storage.
 *
 * (Christopher: "the hardcoded should also be only hardcoded to the module level not the
 * system level.")
 */

/** Ability modifier: the score over 10, halved, rounded down. */
export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/** Proficiency bonus by character level: +2 at 1st, stepping every four levels. */
export function proficiencyBonus(level: number): number {
  return Math.floor((Math.max(1, level) - 1) / 4) + 2;
}

/**
 * Saving-throw modifier.
 *
 * Proficiency is a FLAG, not a typed number. A typed save has to be re-entered on every
 * level-up and after every score change — work that is easy to miss and invisible until
 * someone rolls, because a save reads as a plain "+X" with nothing to compare it against.
 *
 * `explicit` stays supported as the escape hatch for saves that follow neither rule — a
 * summon whose saves key off its summoner rather than its own scores.
 */
export function savingThrowModifier(opts: {
  modifier: number;
  saveProficient?: boolean;
  explicit?: number;
  /** A character's level, when the bonus follows from it. Ignored if `explicitBonus` is given. */
  level?: number;
  /**
   * The proficiency bonus itself, when it is PRINTED rather than derived.
   *
   * A monster stat block states its bonus directly and frequently states no CR, so there is
   * nothing to derive from — see `creatureProficiencyBonus`. A character always has a level, so
   * the player side keeps passing that.
   */
  explicitBonus?: number;
}): number {
  if (typeof opts.explicit === "number") return opts.explicit;
  const pb = typeof opts.explicitBonus === "number"
    ? opts.explicitBonus
    : proficiencyBonus(Math.max(1, Math.floor(opts.level ?? 1)));
  return opts.modifier + (opts.saveProficient ? pb : 0);
}

/**
 * Read a legacy typed save back into a proficiency flag.
 *
 * Sheets authored before the flag existed carry a hand-typed number on every ability. A save
 * exactly one proficiency bonus above the modifier was a proficient save; one equal to the
 * modifier was not. Anything else is genuinely bespoke and keeps its explicit value.
 */
export function inferSaveProficiency(opts: {
  save: number;
  modifier: number;
  level: number;
}): { saveProficient: boolean; keepExplicit: boolean } {
  const pb = proficiencyBonus(opts.level);
  if (opts.save === opts.modifier + pb) return { saveProficient: true, keepExplicit: false };
  if (opts.save === opts.modifier) return { saveProficient: false, keepExplicit: false };
  return { saveProficient: false, keepExplicit: true };
}
