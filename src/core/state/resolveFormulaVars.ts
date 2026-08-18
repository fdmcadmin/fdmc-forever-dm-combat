/**
 * resolveFormulaVars
 *
 * Replaces @VARIABLE tokens in roll formulas with real values derived from
 * the actor's current stats (including equipment modifiers).
 *
 * Supported variables (RAW ability mods vs COMPLETE bonuses — see @ATK below):
 *   @STR  — STR modifier (e.g. +3, -1)
 *   @DEX  — DEX modifier
 *   @CON  — CON modifier
 *   @INT  — INT modifier
 *   @WIS  — WIS modifier
 *   @CHA  — CHA modifier
 *   @PROF — Proficiency bonus (+2 through +6 based on level)
 *   @SPELL — Spell attack bonus (spellcasting mod + PROF)
 *   @ATK  — Martial attack bonus (best of STR/DEX + PROF) — the twin of @SPELL
 *   @MAIN/@SECOND/@THIRD — that class slot's level
 *   @CLASSCOMBINED — hit-dice pool readout ("5d10 + 1d6"), NOT rollable
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
import { classLevels, hitDicePools, castingAbilityForClass } from "../rules/multiclass";
import { deriveActorStats } from "./deriveActorStats";
import type { ActorStatusTrackerState } from "../types/status";

// ─── Proficiency bonus by level ───────────────────────────────────────────────
// The formula itself is the D&D module's (core/rules/dnd5e.ts); this stays as the name the
// rest of the sheet code already imports.

import { proficiencyBonus as getProficiencyBonus } from "../rules/dnd5e";
export { getProficiencyBonus };

// ─── Signed number string ─────────────────────────────────────────────────────

export type CastingClassSlot = "main" | "second" | "third";

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
function getSpellcastingMod(actor: Actor, stats: DerivedStats, castingClass?: CastingClassSlot): number {
  /**
   * THE ACTION'S OWN CLASS WINS. A Paladin 5 / Sorcerer 1 casts Paladin spells off CHA and
   * Sorcerer spells off CHA too — but a Wizard/Cleric needs INT for one and WIS for the other,
   * and before this there was no way to say so: the scan below is ACTOR-WIDE and returns on the
   * first tagged action it finds, so a single action's tag set @SPELL for the entire sheet.
   *
   * The ability is derived from the class NAME (see castingAbilityForClass), so this needed no
   * new field on any class row and no migration.
   */
  const slotIndex = castingClass === "second" ? 1 : castingClass === "third" ? 2 : castingClass === "main" ? 0 : -1;
  if (slotIndex >= 0) {
    const row = classLevels(actor)[slotIndex];
    const ability = row && castingAbilityForClass(row.name);
    if (ability) return stats[ability].modifier;
  }

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

  /**
   * No action-declared class and no tag: fall back to the MAIN class's derived ability before
   * the string-matching below. `classes[0]` is structured data; `className` is a display string
   * that a multiclass character writes as "Paladin 5 / Sorcerer 1", where `.includes()` returns
   * whichever branch happens to be listed first in the chain.
   */
  const mainClass = classLevels(actor)[0];
  const mainAbility = mainClass && castingAbilityForClass(mainClass.name);
  if (mainAbility) return stats[mainAbility].modifier;

  // Legacy: single-class display string, kept for sheets with no `classes[]` rows.
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
  drainState?: ActorStatusTrackerState,
  /** The action being resolved, so @SPELL can use ITS class rather than the sheet's. */
  castingClass?: CastingClassSlot,
): Record<string, string> {
  const stats = derivedStats ?? deriveActorStats(actor, undefined, drainState);
  const prof = getProficiencyBonus(actor.level);
  const spellMod = getSpellcastingMod(actor, stats, castingClass);

  /**
   * @ATK — the MARTIAL counterpart to @SPELL, and it includes proficiency.
   *
   * ⚠ CHANGED 2026-08-18. It used to be the bare modifier, `max(STR, DEX)`, while @SPELL was
   * mod + proficiency. Two tokens that read as a matched pair meant different things, so
   * `1d20+@ATK` was quietly missing proficiency where `1d20+@SPELL` was not. Christopher:
   * *"shouldnt @atk be: main modifier and PB? while @str would pull the +3 modifier."*
   *
   * The vocabulary now has one rule:
   *   · @STR/@DEX/… are RAW ability modifiers.
   *   · @PROF is proficiency alone.
   *   · @ATK and @SPELL are COMPLETE bonuses — the number you add to a d20, mod + proficiency.
   *
   * So a martial save DC is `8+@ATK`, a spell save DC is `8+@SPELL`, and a DC keyed to one
   * specific stat is `8+@STR+@PROF`. Safe to change: @ATK appeared nowhere in the campaign
   * library or the live party, and authored weapons spell out `@PROF+@STR` explicitly, so
   * nothing double-counts.
   */
  const atkMod = Math.max(stats.str.modifier, stats.dex.modifier) + prof;
  // @SPELL/@SAVE_BONUS — spellcasting mod + proficiency (a DC's "8 +" part is typed, not here)
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
    "@ATK": signed(atkMod),            // martial attack bonus: best of STR/DEX + proficiency
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
  drainState?: ActorStatusTrackerState,
  /**
   * Which class slot casts this, when resolving ONE action's formula. Optional so the 19
   * existing call sites keep their behaviour; pass it (or use `resolveActionFormula`) wherever
   * the action is in hand and @SPELL should follow the action rather than the sheet.
   */
  castingClass?: CastingClassSlot,
): string {
  if (!formula?.trim()) return formula ?? "";

  const vars = buildFormulaVarMap(actor, derivedStats, drainState, castingClass);
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

/**
 * Resolve one ACTION's formula, with `@SPELL` following that action's declared class.
 *
 * Prefer this over `resolveFormulaVars` anywhere the action is in hand. A Wizard/Cleric has two
 * casting stats, and the sheet-wide resolver can only ever pick one of them — which is how a
 * single tagged action came to set `@SPELL` for every spell on the character.
 */
export function resolveActionFormula(
  formula: string | undefined,
  action: { metadata?: { castingClass?: CastingClassSlot } } | undefined,
  actor: Actor,
  derivedStats?: DerivedStats,
  drainState?: ActorStatusTrackerState,
): string {
  return resolveFormulaVars(formula, actor, derivedStats, drainState, action?.metadata?.castingClass);
}
