/**
 * resolveFormulaVars
 *
 * Replaces @VARIABLE tokens in roll formulas with real values derived from
 * the actor's current stats (including equipment modifiers).
 *
 * Supported variables:
 *   @STR  — STR modifier (e.g. +3, -1)
 *   @DEX  — DEX modifier
 *   @CON  — CON modifier
 *   @INT  — INT modifier
 *   @WIS  — WIS modifier
 *   @CHA  — CHA modifier
 *   @PROF — Proficiency bonus (+2 through +6 based on level)
 *   @SPELL — Spell attack bonus (spellcasting mod + PROF)
 *
 * Example:
 *   formula: "1d20+@STR+@PROF"
 *   STR mod +3, PROF +2 → "1d20+3+2" → Dice+ shows "1d20+3+2 = 17"
 *
 *   formula: "1d20+@STR+@PROF+1"  (magic weapon +1)
 *   STR mod +3, PROF +2 → "1d20+3+2+1"
 *
 *   formula: "2d6+@STR"
 *   STR mod +3 → "2d6+3"
 *
 * Belt of Hill Giant Strength (STR → 21, mod +5):
 *   Before: 1d20+@STR+@PROF → "1d20+0+2" (STR 9, mod -1... wait: see below)
 *   After:  1d20+@STR+@PROF → "1d20+5+2" (STR 21, mod +5)
 *
 * When the belt is removed, formulas automatically revert to base STR mod.
 */

import type { Actor } from "../types/actor";
import type { DerivedStats } from "./deriveActorStats";
import { classLevels, hitDicePools } from "../rules/multiclass";
import { deriveActorStats } from "./deriveActorStats";
import type { ActorStatusTrackerState } from "../types/status";

// ─── Proficiency bonus by level ───────────────────────────────────────────────
// The formula itself is the D&D module's (core/rules/dnd5e.ts); this stays as the name the
// rest of the sheet code already imports.

import { proficiencyBonus as getProficiencyBonus } from "../rules/dnd5e";
export { getProficiencyBonus };

// ─── Signed number string ─────────────────────────────────────────────────────

function signed(n: number): string {
  return n >= 0 ? `+${n}` : String(n);
}

// ─── Variable map builder ─────────────────────────────────────────────────────

/**
 * Determine which stat to use for @SPELL.
 * Checks actor features for trait-based stat swaps first,
 * then falls back to class-based defaults.
 *
 * Tags that swap spellcasting stat:
 *   "spell-uses-str" → uses STR
 *   "spell-uses-dex" → uses DEX
 *   "spell-uses-int" → uses INT
 *   "spell-uses-wis" → uses WIS
 *   "spell-uses-cha" → uses CHA
 */
function getSpellcastingMod(actor: Actor, stats: DerivedStats): number {
  // Check features/actions for trait-based stat swap
  const allActions = Object.values(actor.tabs).flat();
  for (const action of allActions) {
    const tags = action.tags ?? [];
    if (tags.includes("spell-uses-str")) return stats.str.modifier;
    if (tags.includes("spell-uses-dex")) return stats.dex.modifier;
    if (tags.includes("spell-uses-int")) return stats.int.modifier;
    if (tags.includes("spell-uses-wis")) return stats.wis.modifier;
    if (tags.includes("spell-uses-cha")) return stats.cha.modifier;
    // Hexblade: "spell-uses-cha-or-str" — pick higher
    if (tags.includes("spell-uses-cha-or-str")) return Math.max(stats.cha.modifier, stats.str.modifier);
  }

  // Class-based defaults
  const className = (actor.className ?? "").toLowerCase();
  if (className.includes("warlock") || className.includes("sorcerer") || className.includes("bard")) {
    return stats.cha.modifier;
  }
  if (className.includes("paladin")) {
    return stats.cha.modifier;
  }
  if (className.includes("wizard") || className.includes("artificer")) {
    return stats.int.modifier;
  }
  // Druid, Cleric, Ranger default to WIS
  return stats.wis.modifier;
}

export function buildFormulaVarMap(
  actor: Actor,
  derivedStats?: DerivedStats,
  drainState?: ActorStatusTrackerState
): Record<string, string> {
  const stats = derivedStats ?? deriveActorStats(actor, undefined, drainState);
  const prof = getProficiencyBonus(actor.level);
  const spellMod = getSpellcastingMod(actor, stats);

  // @ATK = highest of STR or DEX — for flexible weapons (finesse, thrown)
  const atkMod = Math.max(stats.str.modifier, stats.dex.modifier);
  // @SAVE = spellcasting DC without the 8 + part (just the mod + prof portion)
  const saveMod = spellMod + prof;

  return {
    "@STR": signed(stats.str.modifier),
    "@DEX": signed(stats.dex.modifier),
    "@CON": signed(stats.con.modifier),
    "@INT": signed(stats.int.modifier),
    "@WIS": signed(stats.wis.modifier),
    "@CHA": signed(stats.cha.modifier),
    "@PROF": signed(prof),
    "@SPELL": signed(saveMod),         // spell attack bonus (mod + prof)
    "@SAVE_BONUS": signed(saveMod),    // same value, alias for clarity in save DC expressions
    "@ATK": signed(atkMod),            // highest of STR/DEX — for finesse weapons
    // Shorthand without @ for weapon builders who prefer no prefix
    "STR_MOD": signed(stats.str.modifier),
    "DEX_MOD": signed(stats.dex.modifier),
    "PROF": signed(prof),

    /**
     * CLASS LEVELS BY SLOT (Christopher, 2026-08-18): *"we already have the classes on the
     * profile so why cant it use @main @second @third for the reference to the class."*
     *
     * `classes[]` is ordered, so slot 0 is the main class. Referring to the SLOT rather than
     * the class name means a formula survives a rename and reads the same on every sheet —
     * `@MAIN` is "my main class's level" for anyone, where `@FIGHTERLVL` would only ever be
     * right for one character.
     *
     * This is what Second Wind needed: `1d10+@MAIN` on a Fighter. Before this the only
     * level-derived token was `@PROF`, which is the wrong curve entirely.
     *
     * A slot with no class resolves to 0, so a single-class sheet using `@SECOND` degrades to
     * "+0" rather than leaving a raw token in the dice string.
     *
     * ⚠ BOTH CASES ARE REGISTERED. Replacement is a literal `replaceAll`, so `@main` typed in
     * lowercase would otherwise never resolve and would reach Dice+ as text — a trap this file
     * has already sprung once.
     */
    ...classLevelVars(actor),

    /**
     * @CLASSCOMBINED — the hit dice this character can actually roll, as a readable pool
     * ("5d10 + 1d6" for a Paladin 5 / Sorcerer 1). Sourced from `hitDicePools`, which already
     * groups by die and sums the levels that share it.
     *
     * ⚠ NOT A ROLLABLE EXPRESSION. Spending a hit die is a CHOICE of which die, so this is a
     * readout for the resource row, not something to hand to the dice bridge. An action that
     * rolls "a hit die" needs the picker, not this string.
     */
    "@CLASSCOMBINED": hitDicePools(actor).map(p => `${p.count}${p.die}`).join(" + ") || "—",
  };
}

/** `@MAIN` / `@SECOND` / `@THIRD` (and lowercase aliases) → that class slot's level. */
function classLevelVars(actor: Actor): Record<string, string> {
  const rows = classLevels(actor);
  const slots: [string, number][] = [
    ["MAIN", rows[0]?.level ?? 0],
    ["SECOND", rows[1]?.level ?? 0],
    ["THIRD", rows[2]?.level ?? 0],
  ];
  const out: Record<string, string> = {};
  for (const [name, level] of slots) {
    out[`@${name}`] = signed(level);
    out[`@${name.toLowerCase()}`] = signed(level);
  }
  return out;
}

// ─── Main resolver ────────────────────────────────────────────────────────────

/**
 * Replace @VARIABLE tokens in a formula string with real values.
 * Returns the resolved formula ready for Dice+ or display.
 */
export function resolveFormulaVars(
  formula: string | undefined,
  actor: Actor,
  derivedStats?: DerivedStats,
  drainState?: ActorStatusTrackerState
): string {
  if (!formula?.trim()) return formula ?? "";

  const vars = buildFormulaVarMap(actor, derivedStats, drainState);
  let resolved = formula;

  /**
   * ⚠ A VARIABLE IN DICE-COUNT POSITION IS A COUNT, NOT A BONUS.
   *
   * `@PROFd4` means "proficiency-many d4s" — the shape a scaling cantrip needs so it grows with
   * level instead of being re-authored at every tier (Raphael's Healing Hands is authored
   * exactly this way). Every value in the map is SIGNED for use as a bonus, so the plain
   * substitution turned it into "+3d4": a signed number where a die count belongs, which reads
   * as a bonus of 3d4 rather than 3d4 of healing, and breaks outright mid-expression.
   *
   * Anything immediately followed by `d<number>` therefore substitutes the MAGNITUDE:
   *   "@PROFd4"        → "3d4"
   *   "2d8+@INTd6"     → "2d8+4d6"
   * A modifier of 0 or less yields ONE die rather than "0d4" or a negative count, because a
   * character with no bonus still rolls the spell.
   */
  resolved = resolved.replace(/@([A-Z_]+)(?=d\d)/gi, (match, name: string) => {
    const value = vars[`@${name.toUpperCase()}`];
    if (value === undefined) return match;          // unknown token: leave it visible
    const magnitude = Math.abs(Number.parseInt(value, 10));
    if (!Number.isFinite(magnitude)) return match;
    return String(Math.max(1, magnitude));
  });

  for (const [token, value] of Object.entries(vars)) {
    // Replace all occurrences — handles both "+@STR" and "@STR" at start
    resolved = resolved.replaceAll(token, value);
  }

  // Clean up double signs: "+-3" → "-3", "++2" → "+2"
  resolved = resolved.replace(/\+\+/g, "+").replace(/\+-/g, "-");

  return resolved;
}

/**
 * Check if a formula contains any @VARIABLE tokens.
 * Used to show an indicator on the action card that the formula is dynamic.
 */
export function formulaHasVars(formula?: string): boolean {
  return Boolean(formula && /@(STR|DEX|CON|INT|WIS|CHA|PROF|SPELL|SAVE_BONUS|ATK)/.test(formula));
}

/**
 * Get the display string for a formula — resolved if vars present.
 * Used in action card labels: "1d20+5" vs "1d20+@STR+@PROF → 1d20+5"
 */
export function formulaDisplayLabel(
  formula: string | undefined,
  actor: Actor,
  derivedStats?: DerivedStats
): string {
  if (!formula) return "";
  if (!formulaHasVars(formula)) return formula;
  const resolved = resolveFormulaVars(formula, actor, derivedStats);
  return resolved; // show resolved value; tooltip can show original template
}
