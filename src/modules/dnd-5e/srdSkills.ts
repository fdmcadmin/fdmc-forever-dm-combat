/**
 * THE EIGHTEEN SKILLS, AND THEIR GOVERNING ABILITY.
 *
 * Christopher, 2026-09-10: *"why did raphael not get the checks, this wasnt build by me but
 * generated because checks should come from the SRD."*
 *
 * ⚠ THEY SHOULD, AND UNTIL NOW NOTHING IN THE APP KNEW WHAT A SKILL WAS. The only place the list
 * existed was `commonSkillChecks()` in `modules/the-broken-chain/actors/actorHelpers.ts` — CAMPAIGN
 * content, reachable only by the five hand-built party sheets. An actor created by any other route
 * got none, which is exactly what happened: five sheets carry all 18 and Raphael carries zero.
 *
 * ⚠ AND THE ROWS THOSE FIVE CARRY ARE FROZEN NUMBERS. Ripsnarl's Athletics reads `1d20+7` — +4 STR
 * and +3 proficiency, correct at the level somebody typed it and silently wrong at the next one.
 * It is the hand-typed note's failure in another costume, eighteen rows at a time. Rows built here
 * carry `@`-tokens instead, so an ASI or a proficiency step moves all eighteen at once.
 *
 * ── LICENCE ─────────────────────────────────────────────────────────────────────────────────
 * The skill list and its ability assignments are SRD content, identical in 5.1 and 5.2.1, and
 * carried under the same CC-BY-4.0 attribution the rest of the mod ships — see `SRD_ATTRIBUTION`
 * in `srdContent.ts`. It is transcribed here rather than parsed from anything at runtime.
 */

import type { ActorAction } from "../../core/types/tabs";

export type SkillAbility = "str" | "dex" | "int" | "wis" | "cha";

export type SrdSkill = { name: string; ability: SkillAbility };

/** Alphabetical, the order a sheet prints them. */
export const SRD_SKILLS: readonly SrdSkill[] = [
  { name: "Acrobatics", ability: "dex" },
  { name: "Animal Handling", ability: "wis" },
  { name: "Arcana", ability: "int" },
  { name: "Athletics", ability: "str" },
  { name: "Deception", ability: "cha" },
  { name: "History", ability: "int" },
  { name: "Insight", ability: "wis" },
  { name: "Intimidation", ability: "cha" },
  { name: "Investigation", ability: "int" },
  { name: "Medicine", ability: "wis" },
  { name: "Nature", ability: "int" },
  { name: "Perception", ability: "wis" },
  { name: "Performance", ability: "cha" },
  { name: "Persuasion", ability: "cha" },
  { name: "Religion", ability: "int" },
  { name: "Sleight of Hand", ability: "dex" },
  { name: "Stealth", ability: "dex" },
  { name: "Survival", ability: "wis" },
];

export const SKILL_BY_NAME = new Map(SRD_SKILLS.map(s => [s.name.toLowerCase(), s]));

/** The id convention the hand-built sheets already use: `check-<slug>`. */
export function skillCheckId(name: string): string {
  return `check-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

/**
 * The formula for one skill.
 *
 * ⚠ TOKENS, NOT A NUMBER, AND THE `+` ON EVERY TERM IS NOT COSMETIC. `baseWeapons.ts` states the
 * convention and the reason: without an explicit separator a var that fails to resolve can swallow
 * the segment. `@PROF` stays symbolic so a proficiency step moves every proficient row at once.
 */
export function skillFormula(skill: SrdSkill, proficient: boolean, expertise = false): string {
  const prof = expertise ? "+@PROF+@PROF" : proficient ? "+@PROF" : "";
  return `1d20+@${skill.ability.toUpperCase()}${prof}`;
}

/**
 * WHAT A FROZEN TOTAL WAS TRYING TO SAY.
 *
 * Christopher, 2026-09-11: *"fix the checks on all character and creatures."* Every check row in
 * the party stored a NUMBER — `1d20+7` — which states a total and not its parts. The parts are
 * recoverable exactly: the modifier plus nothing, plus the proficiency bonus, or plus it twice.
 *
 * ⚠ AND THE FOURTH ANSWER IS THE ONE THAT MATTERS. A total none of the three explains has
 * something else in it — an item, a feat, Reliable Talent, a racial bonus — and calling it
 * "proficient" would silently delete that bonus the moment the row became `@STR+@PROF`.
 * `"unexplained"` is a real answer and every caller has to handle it rather than round to the
 * nearest guess.
 *
 * ⚠ PB IS CHECKED FOR ZERO. At PB 0 the three cases collapse into one and everything would read as
 * expertise; a companion carrying no printed bonus is exactly that case.
 */
export type FrozenCheckReading = "unproficient" | "proficient" | "expertise" | "unexplained";

export function classifyFrozenCheck(total: number, modifier: number, proficiencyBonus: number): FrozenCheckReading {
  if (total === modifier) return "unproficient";
  if (proficiencyBonus <= 0) return "unexplained";
  if (total === modifier + proficiencyBonus) return "proficient";
  if (total === modifier + proficiencyBonus * 2) return "expertise";
  return "unexplained";
}

/** Read a row's formula back: does it claim proficiency, and expertise? */
export function proficiencyFromFormula(formula: string | undefined): { proficient: boolean; expertise: boolean } {
  const hits = (formula ?? "").match(/@PROF/g)?.length ?? 0;
  return { proficient: hits > 0, expertise: hits > 1 };
}

export function skillCheckRow(skill: SrdSkill, proficient: boolean, expertise = false): ActorAction {
  return {
    id: skillCheckId(skill.name),
    label: skill.name,
    description: skillFormula(skill, proficient, expertise),
    actionKind: "check",
    category: "Ability Checks",
    logMode: "table-note",
    displayMode: "compact",
    economyCost: [],
    metadata: {
      attack: skillFormula(skill, proficient, expertise),
      details: skillFormula(skill, proficient, expertise),
    },
  } as ActorAction;
}


/**
 * THE EIGHTEEN, RESOLVED — generated because the D&D mod is loaded, overridden by what the sheet
 * actually stores.
 *
 * Christopher, 2026-09-10: *"this should still stay generated because they are listed as srd so
 * shouldnt need to be created once the dnd mode is loaded."*
 *
 * ⚠ WHICH MAKES A FILL BUTTON THE WRONG ANSWER, AND THERE ISN'T ONE. A button that writes eighteen
 * rows onto every sheet is a stored copy of a list the mod already publishes — the same mistake as
 * a written-down bond ladder or a hand-typed saves line, at eighteen rows per character. Raphael
 * never needed a fill; he needed the tab to stop reading only what was written down.
 *
 * ⚠ STORED WINS, ALWAYS. A row the sheet carries — a frozen `1d20+7`, a house formula, an expertise
 * tick — is the author's statement about this character and replaces the generated one entirely.
 * Generation fills the GAPS; it never overwrites.
 *
 * ⚠ AND UNPROFICIENT IS THE DEFAULT, SO IT NEED NOT BE STORED. Ticking proficiency writes a row;
 * unticking removes it, because the generated row already says the same thing. That is what stops
 * an export shipping eighteen rows per character that say nothing.
 */
export function resolveSkillChecks(stored: readonly ActorAction[] = []): ActorAction[] {
  const byLabel = new Map<string, ActorAction>();
  for (const a of stored) byLabel.set((a.label ?? "").trim().toLowerCase(), a);

  const generated = SRD_SKILLS.map(skill => byLabel.get(skill.name.toLowerCase()) ?? skillCheckRow(skill, false));
  /** Anything the sheet carries that is NOT one of the eighteen — a tool, a save, a campaign roll. */
  const custom = stored.filter(a => !SKILL_BY_NAME.has((a.label ?? "").trim().toLowerCase()));
  return [...generated, ...custom];
}
