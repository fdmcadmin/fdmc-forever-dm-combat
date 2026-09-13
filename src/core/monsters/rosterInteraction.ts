/**
 * AN ACTION WHOSE VALUE LANDS ON ANOTHER CREATURE — priced after the encounter roster is assembled.
 *
 * Christopher, 2026-09-13: *"why can we price aoe spells that do damage but not aoe spells that buff
 * and hinder."* Because every creature was priced alone: nothing let one creature's action change
 * another creature's numbers, so Winter's Toll, Cruel Instruction, Cold Counsel and Commanding
 * Presence all read 0.
 *
 * The v4 Roster Interaction workbook (Act3 Roster Interactions, Runtime Contract r24) is the law here:
 *
 *   "Effects that change another creature's attacks, saves, target assignment, or survival are
 *    priced only after the encounter roster is assembled. They never become a flat multiplier on
 *    the source body."  ·  "A creature-level 0 or x1.000 is not a priced answer."
 *
 * ⚠ THE FIELD IS THE OVERRIDE; THE RULES TEXT IS READ FIRST WHEN IT IS EMPTY. "+3 bonus to attack
 * rolls" is read by `encounter-band/mechanicText.ts`, so a creature prices without anyone ticking a
 * box — Christopher: *"if i have to go in and check 10 different boxes to test a encounter then how
 * does this help others when they build their own creatures."* See `rosterInteractions.ts` for the pass.
 */
export type RosterInteraction =
  /**
   * `roll_modifier_zone` — Winter's Toll. Flat modifiers to rolls made by creatures in the area.
   * Priced with the workbook's half-roster convention: half the roster's bodies are in the area.
   */
  | {
    kind: "roll_modifier_zone";
    /** Added to allies' attack rolls in the zone (+3). */
    allyAttack?: number;
    /** Added to allies' saving throws in the zone (+3). */
    allySave?: number;
    /** Added to hostile attack rolls in the zone (−3). */
    hostileAttack?: number;
    /** Added to hostile saving throws in the zone (−3). */
    hostileSave?: number;
    /** How many turns one casting lasts — the source re-spends its Action once per this many rounds. */
    durationRounds?: number;
  }
  /**
   * `ally_extra_attack` — Cruel Instruction. The best legal ally makes one normal attack, after the
   * zone's modifiers. `requiresZone` names the zone action the ally must be inside.
   */
  | { kind: "ally_extra_attack"; requiresZone?: string }
  /**
   * `forced_target_order` — Commanding Presence. While legal and in range, this creature is the first
   * target for the party's creature-targeting Actions: it moves to the front of the kill order.
   */
  | { kind: "forced_target_order" }
  /**
   * `target_substitution` — Cold Counsel. A targeted ally is moved and the attack re-checked for
   * legality. The workbook marks it ROSTER EVENT REQUIRED and publishes no numeric burden.
   */
  | { kind: "target_substitution"; requiresZone?: string };

export type RosterInteractionKind = RosterInteraction["kind"];

/** Names match across straight and curly apostrophes — "Winter's Toll" is "Winter’s Toll". */
export function sameActionName(a: string | undefined, b: string | undefined): boolean {
  const norm = (s: string | undefined) => String(s ?? "").replace(/[’‘`]/g, "'").trim().toLowerCase();
  return norm(a) !== "" && norm(a) === norm(b);
}
