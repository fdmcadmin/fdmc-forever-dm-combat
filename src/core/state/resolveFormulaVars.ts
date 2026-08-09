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
  };
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
