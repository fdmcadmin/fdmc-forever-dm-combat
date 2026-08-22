/**
 * MONSTER FORMULA VARIABLES — the creature-side twin of `state/resolveFormulaVars.ts`.
 *
 * ⚠ WHY THIS EXISTS. Christopher: *"we built all monster actions to read variable and if it isnt
 * built then something is wrong."* He was right that it should be, and right that something was
 * wrong: `resolveFormulaVars` was called in exactly ONE file — `ActorCard.tsx`, the PC card.
 * `MonsterActorCard` took `action.roll` RAW and sent it to the dice bridge, and `localRoller`
 * strips any leftover `@TOKEN` before rolling.
 *
 * So an authored `1d20+@MAIN+@PB` on a creature rolled as a bare `1d20`. Not an error, not a
 * warning — a silently unmodified attack, which is the worst way for this to fail.
 *
 * ── WHY A SEPARATE RESOLVER ────────────────────────────────────────────────────────────────
 * The PC resolver reads an ACTOR: class levels, spell focuses, drain trackers, equipment. A
 * creature has none of those and has one thing a PC does not — a CR that fixes its proficiency.
 * `@MAIN` even means something different on each side: on a PC it is a class LEVEL, on a
 * creature it is the modifier of the ability its archetype leads with. Sharing one function
 * would mean one of the two meanings being wrong.
 *
 * ── THE VOCABULARY ─────────────────────────────────────────────────────────────────────────
 *   @STR @DEX @CON @INT @WIS @CHA  — raw ability modifiers from the creature's own scores
 *   @PB / @PROF                    — proficiency, derived from CR (0–4 = +2, 5–8 = +3, …)
 *   @MAIN                          — the archetype's primary ability modifier
 *   @ATK / @ATTACK                 — the complete attack bonus: @MAIN + @PB
 *   @SPELL                         — the complete spell attack bonus: @MAIN + @PB
 *   @DC                            — save DC: 8 + @MAIN + @PB
 *
 * @ATK and @SPELL are COMPLETE bonuses, exactly as on the PC side, so `1d20+@ATK` is the whole
 * attack and `1d20+@ATK+@PB` would double-count. That parity is deliberate: a DM who has learned
 * the PC vocabulary should not have to learn a second one.
 */

import type { MainMonsterTemplate } from "./runtime/mainMonsterRuntime";
import { abilityModifier } from "../rules/dnd5e";
import { ABILITY_ORDER, scoresFromTemplate, type AbilityLabel } from "./creator/monsterCreatorModel";

/** Proficiency from Challenge Rating — CR 0–4 = +2, 5–8 = +3, 9–12 = +4, … */
export function monsterProficiency(cr: number | undefined): number {
  return Math.floor((Math.max(1, Math.floor(cr ?? 1)) - 1) / 4) + 2;
}

/**
 * `@MAIN` — THE CREATURE'S HIGHEST LISTED STAT.
 *
 * Christopher, 2026-08-22: *"@main on a monster needs to be the highest listed stat."*
 *
 * One rule, readable off the stat block without knowing the archetype table. It also means the
 * archetype reshape and `@MAIN` agree by construction: dealing the array into the archetype's
 * spine puts the 18 on that archetype's lead ability, so the highest score IS the lead.
 *
 * Ties break by the printed ability order (STR, DEX, CON, INT, WIS, CHA), so a creature with two
 * 16s always resolves the same way rather than depending on object key order.
 *
 * ✅ RULED, DO NOT RE-RAISE. This makes a Guardian mirror +7/+4 where the Elemental Mirror card
 * prints +6/+3 — the card uses its STR 16 rather than its CON 18, and every other archetype
 * matches. Christopher, 2026-08-22: *"its fine for the guardian to be +7."* One readable rule
 * beats a per-archetype exception table, and the card is the stale side of the disagreement.
 */
export function monsterMainAbility(template: MainMonsterTemplate): AbilityLabel {
  const scores = scoresFromTemplate(template.abilities ?? []);
  return ABILITY_ORDER.reduce(
    (best, l) => (scores[l] > scores[best] ? l : best),
    "STR" as AbilityLabel,
  );
}

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

/** Every variable a creature supplies, ready to substitute. */
export function monsterFormulaVars(template: MainMonsterTemplate): Record<string, string> {
  const scores = scoresFromTemplate(template.abilities ?? []);
  const pb = monsterProficiency(template.stats?.cr);
  const main = abilityModifier(scores[monsterMainAbility(template)]);

  const vars: Record<string, string> = {};
  for (const label of ABILITY_ORDER) vars[label] = signed(abilityModifier(scores[label]));
  // @PROF is canonical (it matches the PC vocabulary); @PB is accepted because it is the name a
  // DM reaches for first, and losing an attack bonus to a synonym is not a lesson worth teaching.
  vars.PROF = signed(pb);
  vars.PB = signed(pb);
  vars.MAIN = signed(main);
  vars.ATK = signed(main + pb);
  vars.ATTACK = signed(main + pb);
  vars.SPELL = signed(main + pb);
  vars.DC = String(8 + main + pb);
  return vars;
}

/**
 * Substitute `@TOKEN`s in one formula against a creature.
 *
 * ⚠ AN UNKNOWN TOKEN IS LEFT IN PLACE. `localRoller` deletes anything still matching `@[A-Za-z]+`,
 * so a typo that survives to the roller becomes a silently unmodified roll. Leaving it visible
 * means the DM sees `@MAN` on the card and fixes it, rather than watching an attack quietly miss
 * by three for a session.
 *
 * Longest names first, or `@ATTACK` would be eaten by the `@ATK`… no — by a prefix match on a
 * shorter key. Sorting by length removes the whole class of problem.
 */
export function resolveMonsterFormula(formula: string | undefined, template: MainMonsterTemplate): string {
  if (!formula?.trim()) return formula ?? "";
  const vars = monsterFormulaVars(template);
  const names = Object.keys(vars).sort((a, b) => b.length - a.length);
  let out = formula;
  for (const name of names) {
    out = out.replace(new RegExp(`@${name}\\b`, "gi"), vars[name]);
  }
  // "1d20++3" / "1d20+-1" are legal-looking but read badly and some parsers choke.
  return out.replace(/\+\s*\+/g, "+").replace(/\+\s*-/g, "-").trim();
}

/** Resolve every formula-bearing field on a creature's actions. Used before rendering or rolling. */
export function resolveMonsterActionFormulas<T extends { roll?: string; damage?: string; save?: string }>(
  action: T,
  template: MainMonsterTemplate,
): T {
  return {
    ...action,
    ...(action.roll ? { roll: resolveMonsterFormula(action.roll, template) } : {}),
    ...(action.damage ? { damage: resolveMonsterFormula(action.damage, template) } : {}),
    ...(action.save ? { save: resolveMonsterFormula(action.save, template) } : {}),
  };
}
