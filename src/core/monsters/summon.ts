/**
 * SUMMONS — a body that arrives mid-fight, belongs to whoever called it, and lives in the app.
 *
 * Christopher: *"we need to build the lair and the summons because both of these are needed in
 * the app and summon has to come first since the lair builds off of it as a start of combat
 * summon"*, and on where the bodies go: *"the tokens are never spawned on the map only in the
 * app, the dm needs to have their own tokens."*
 *
 * ── ⚠ WHAT WAS ALREADY HERE, AND IS NOT REBUILT ─────────────────────────────────────────────
 *
 * Almost all of it. RULE 0, and it saved the whole shape of this file:
 *
 *   a companion body        Faelar is an actor with `kind: "companion"`, his own HP, AC and
 *                           attack. A summoned body is that, not a new concept.
 *   a form choice           `actionSets` / `materializeTemplateBody` already turn ONE template
 *                           into a body that took one package — the Elemental Mirror's element.
 *                           The Otherworldly Steed's Celestial / Fey / Fiend is the same shape:
 *                           one block, three packages, one picked per casting.
 *   a creature template     `MainMonsterTemplate` already holds stats, actions, traits, saves.
 *
 * So a summon is a POINTER plus a context, not a second creature format:
 *   · `templateId` when the body exists in the library — the Steed, built once, cast forever
 *   · `inline` when it does not — an Eldritch Cannon has no library entry and needs none
 *
 * ── ⚠ THE ONE THING THAT GENUINELY DID NOT EXIST ────────────────────────────────────────────
 *
 * A summoned body's numbers are mostly the SUMMONER'S. Read the Otherworldly Steed:
 *
 *   AC        10 + 1 per spell level          -> the slot, not the steed
 *   HP        5 + 10 per spell level          -> the slot
 *   PB        "equals your Proficiency Bonus" -> the caster, stated outright
 *   Slam      "Bonus equals your spell attack modifier"
 *   Fell Glare "DC equals your spell save DC"
 *   damage    1d8 plus the spell's level, of a type the FORM decides
 *
 * `resolveMonsterFormula` answers every `@` from the creature's own scores, which is right for a
 * creature and wrong for a summon: it would give the Steed its own proficiency and its own save
 * DC, neither of which the block grants it. The Eldritch Cannon (HP "5 x your Artificer level")
 * and the Covenant bond-creature (HP "your class Hit Die maximum + your level", attack
 * "1d20 + your proficiency") are the same story.
 *
 * THE RULE, and it is the stat block's own: the body's ABILITY SCORES are the body's — the Steed
 * really does have STR 18. Everything the block phrases as "your" comes from the summoner, and
 * everything phrased as "the spell's level" comes from the slot.
 */

import type { MainMonsterTemplate } from "./runtime/mainMonsterRuntime";
import { resolveMonsterFormula } from "./resolveMonsterFormulaVars";
import { materializeTemplateBody, type ActionSetPicks } from "./actionSetPicks";

/** What the summoner brings to the body's formulas. Deliberately narrow — any caster-like object. */
export type SummonerContext = {
  /** For `@LEVEL` — the cannon's "5 x your Artificer level", the bond's "+ your level". */
  level?: number;
  /** For `@PROF` / `@PB` — "PB equals your Proficiency Bonus". */
  proficiencyBonus?: number;
  /** For `@SPELL` — "Bonus equals your spell attack modifier". */
  spellAttackBonus?: number;
  /** For `@DC` — "DC equals your spell save DC". */
  spellSaveDc?: number;
  /** For `@MAIN` — the caster's own key modifier, used by the bond's "1d8 + your main stat". */
  mainModifier?: number;
  /** For `@HITDIEMAX` — the Covenant bond-creature's "your class Hit Die maximum". */
  hitDieMax?: number;
  name?: string;
};

export type SummonSpec = {
  /** What the table calls it. Falls back to the resolved template's own name. */
  name?: string;
  /** How many bodies this call brings. Default 1. */
  count?: number;
  /**
   * A creature in the library. The Steed is built ONCE as a template with its three form
   * packages, and every casting points here.
   */
  templateId?: string;
  /**
   * A body with no library entry. Used only when `templateId` is absent or does not resolve —
   * an Eldritch Cannon is one artificer's, not campaign content.
   */
  inline?: MainMonsterTemplate;
  /**
   * Which package each set picked, for a template with forms. `{ form: "Celestial" }` on the
   * Steed. Fed straight to `materializeTemplateBody`, which already does this for the Mirror.
   */
  /**
   * ⚠ THE SAME SHAPE THE MIRROR USES — a set id to the option names it picked, one entry per
   * slot in that set. `{ form: ["Celestial"] }` on the Steed. Fed straight to
   * `materializeTemplateBody`; a summon never needs its own picking logic.
   */
  picks?: ActionSetPicks;
  /**
   * Rounds it lasts. Unset = until it drops or is dismissed. The Covenant bond-creature "lasts
   * 2 turns"; a Steed lasts until something kills it.
   */
  durationRounds?: number;
  /**
   * ⚠ WHOSE TURN IT ACTS ON, AND IT CHANGES THE PRICE. A body on its OWN initiative adds a whole
   * turn to the round; one that acts on the summoner's turn does not — Faelar "acts during
   * Lyrielle's turn", and the Covenant bond-creature "acts on your turn". Reading the second as
   * the first hands a party a free extra combatant every round.
   */
  acts?: "own-initiative" | "summoner-turn";
  /** The slot this casting spent, for `@SLOT`. The Steed is entirely a function of it. */
  slotLevel?: number;
  /** Free text for the card — "requires a level 4+ slot to fly". */
  note?: string;
};

/**
 * The summoner's contribution to a body's formulas.
 *
 * ⚠ THESE OVERRIDE the body's own answers for the same names, and that is the whole point. A
 * Steed asked for `@PROF` must get the CASTER's, because its block says so in those words.
 */
export function summonerVars(summoner: SummonerContext, slotLevel: number | undefined): Record<string, string> {
  const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
  const vars: Record<string, string> = {};
  if (typeof slotLevel === "number") vars.SLOT = String(slotLevel);
  if (typeof summoner.level === "number") vars.LEVEL = String(summoner.level);
  if (typeof summoner.proficiencyBonus === "number") {
    vars.PROF = signed(summoner.proficiencyBonus);
    vars.PB = signed(summoner.proficiencyBonus);
  }
  if (typeof summoner.spellAttackBonus === "number") {
    vars.SPELL = signed(summoner.spellAttackBonus);
    vars.ATK = signed(summoner.spellAttackBonus);
    vars.ATTACK = signed(summoner.spellAttackBonus);
  }
  if (typeof summoner.spellSaveDc === "number") vars.DC = String(summoner.spellSaveDc);
  if (typeof summoner.mainModifier === "number") vars.MAIN = signed(summoner.mainModifier);
  if (typeof summoner.hitDieMax === "number") vars.HITDIEMAX = String(summoner.hitDieMax);
  return vars;
}

/**
 * Substitute a summoned body's formula: the summoner's values first, then the body's own.
 *
 * Longest name first, so `@HITDIEMAX` is not eaten by a prefix match on a shorter key — the same
 * ordering `resolveMonsterFormula` uses and for the same reason.
 */
export function resolveSummonFormula(
  formula: string | undefined,
  body: MainMonsterTemplate,
  summoner: SummonerContext,
  slotLevel?: number,
): string {
  if (!formula?.trim()) return formula ?? "";
  const vars = summonerVars(summoner, slotLevel);
  let out = formula;
  for (const name of Object.keys(vars).sort((a, b) => b.length - a.length)) {
    out = out.replace(new RegExp(`@${name}\\b`, "gi"), vars[name]);
  }
  /**
   * Whatever the summoner did not answer falls through to the body's own scores — `@STR` on a
   * Steed that really does have STR 18. A body with nothing to say leaves the token in place,
   * which is what makes a typo visible instead of silently zero.
   */
  out = resolveMonsterFormula(out, body);
  return arithmetic(out);
}

/**
 * ⚠ A SUMMON'S NUMBERS ARE EXPRESSIONS, NOT VALUES, so substitution alone is not enough.
 *
 * "5 + 10 per spell level" is authored `5+10*@SLOT`, and at a level 2 slot that substitutes to
 * `5+10*2` — a string. Every other formula in this app is dice handed to a roller, which is why
 * nothing evaluated arithmetic before: `1d8+3` is not meant to be reduced. But an AC of `10+2`
 * and a max HP of `5+20` are single numbers the app has to store as numbers.
 *
 * Only pure arithmetic is folded. Anything containing a die is left exactly as written, so
 * `1d8+@SLOT` becomes `1d8+2` and stays rollable.
 */
export function arithmetic(expr: string): string {
  const text = expr.trim();
  if (!text || /\d\s*d\s*\d/i.test(text)) return expr;
  if (!/^[\d\s+\-*/().]+$/.test(text)) return expr;
  try {
    // Constrained to digits and operators by the guard above — there is nothing else to run.
    const value = Function(`"use strict";return (${text})`)() as unknown;
    return typeof value === "number" && Number.isFinite(value) ? String(value) : expr;
  } catch {
    return expr;
  }
}

/**
 * Turn a summon spec into the body that actually arrives.
 *
 * ⚠ THE ORDER MATTERS AND IS THE SAME ORDER `materializeTemplateBody` ALREADY ESTABLISHED:
 *
 *   1. resolve the template   — the library entry, or the inline block
 *   2. take the form          — Celestial / Fey / Fiend, via the existing action-set machinery
 *   3. resolve the formulas   — LAST, against the finished body, because the form can change the
 *                               body's scores and therefore its own `@MAIN`
 *
 * Doing (3) before (2) is the exact silent-wrong-number failure `materializeTemplateBody` warns
 * about in its own comment, so this defers to it rather than reimplementing any of it.
 */
export function materializeSummon(
  spec: SummonSpec,
  summoner: SummonerContext,
  library: readonly MainMonsterTemplate[] = [],
): { body: MainMonsterTemplate; count: number; problems: string[] } | undefined {
  const problems: string[] = [];
  const fromLibrary = spec.templateId
    ? library.find(t => t.templateId === spec.templateId)
    : undefined;
  /**
   * ⚠ A NAMED TEMPLATE THAT IS MISSING IS AN ERROR, NOT A REASON TO FALL BACK. Silently using the
   * inline block when the id does not resolve would hide a renamed or deleted creature behind a
   * body that still appears — the same failure `fold-authoring` refuses outright for encounters.
   */
  if (spec.templateId && !fromLibrary) {
    problems.push(`"${spec.name ?? spec.templateId}" names the creature ${spec.templateId}, which is not in the library.`);
    if (!spec.inline) return { body: undefined as never, count: 0, problems };
  }
  const template = fromLibrary ?? spec.inline;
  if (!template) {
    problems.push(`"${spec.name ?? "summon"}" has neither a creature to summon nor a body of its own.`);
    return { body: undefined as never, count: 0, problems };
  }

  /**
   * ⚠ THE SUMMONER'S VALUES GO IN FIRST, BEFORE THE BODY IS SHAPED — and the first version of
   * this had it backwards, which the three test summons caught on the first run.
   *
   * `materializeTemplateBody` resolves `@` vars ITSELF, against the finished body. Calling it
   * first therefore left nothing for the summoner to answer: the Steed's Slam had already become
   * the STEED's own attack bonus (+6) instead of the caster's (+5), Fell Glare carried the
   * steed's own save DC, and the cannon and the bond-creature both took the CR-less proficiency
   * floor of +2 where their blocks say "your proficiency".
   *
   * ⚠ AND THE OBVIOUS FIX — resolve everything afterwards — IS THE ONE THAT FILE WARNS AGAINST,
   * for a real reason: the archetype reshape moves which score is highest, so the body's own
   * `@MAIN` is not knowable until it has been shaped.
   *
   * Both hold at once, because the two var sets are independent. A caster's proficiency is a
   * caster's proficiency whatever body arrives, so those substitute into the template up front;
   * whatever is left is the body's own, and is resolved after the reshape exactly as before.
   */
  const casterVars = summonerVars(summoner, spec.slotLevel);
  const casterNames = Object.keys(casterVars).sort((a, b) => b.length - a.length);
  const withCaster = (value: string | undefined): string | undefined => {
    if (!value?.trim()) return value;
    let out = value;
    for (const name of casterNames) out = out.replace(new RegExp(`@${name}\\b`, "gi"), casterVars[name]);
    return out.replace(/\+\s*\+/g, "+").replace(/\+\s*-/g, "-");
  };
  const casterAction = <T extends { roll?: string; damage?: string; save?: string }>(a: T): T => ({
    ...a,
    ...(a.roll ? { roll: withCaster(a.roll) } : {}),
    ...(a.damage ? { damage: withCaster(a.damage) } : {}),
    ...(a.save ? { save: withCaster(a.save) } : {}),
  });
  const seeded: MainMonsterTemplate = {
    ...template,
    stats: {
      ...template.stats,
      ac: withCaster(String(template.stats.ac)) as unknown as number,
      maxHp: withCaster(String(template.stats.maxHp)) as unknown as number,
    },
    actions: (template.actions ?? []).map(casterAction),
    reactions: (template.reactions ?? []).map(casterAction),
    traits: (template.traits ?? []).map(casterAction),
  };

  const shaped = materializeTemplateBody(seeded, {
    id: `summon-${spec.templateId ?? "inline"}`,
    name: spec.name ?? template.name,
    actionPicks: spec.picks,
  });

  /**
   * Whatever the caster did not answer is the body's own, and `materializeTemplateBody` has
   * already resolved it. This pass only folds the arithmetic that a single number needs — dice
   * are left exactly as written, because they are meant to be rolled.
   */
  const resolveAction = <T extends { roll?: string; damage?: string; save?: string }>(a: T): T => ({
    ...a,
    ...(a.roll ? { roll: arithmetic(a.roll) } : {}),
    ...(a.damage ? { damage: arithmetic(a.damage) } : {}),
  });

  /** AC and HP are single NUMBERS, so their expressions are folded — see `arithmetic`. */
  const acResolved = resolveSummonFormula(String(shaped.stats.ac), shaped, summoner, spec.slotLevel);
  const hpResolved = resolveSummonFormula(String(shaped.stats.maxHp), shaped, summoner, spec.slotLevel);
  const hpNumber = Number.parseInt(hpResolved, 10);
  if (!Number.isFinite(hpNumber) || hpNumber <= 0) {
    problems.push(`"${shaped.name}" resolved its HP to "${hpResolved}", which is not a number of hit points.`);
  }

  const body: MainMonsterTemplate = {
    ...shaped,
    stats: {
      ...shaped.stats,
      ac: Number.isFinite(Number(acResolved)) ? Number(acResolved) : shaped.stats.ac,
      maxHp: Number.isFinite(hpNumber) && hpNumber > 0 ? hpNumber : shaped.stats.maxHp,
      /**
       * ⚠ THE SUMMONER'S PROFICIENCY, WHEN THE BLOCK SAYS SO. The Steed prints "PB equals your
       * Proficiency Bonus" and has no CR, so without this every `@PB` on it would fall back to
       * the CR-less floor of +2 and quietly under-price a level 9 caster's steed.
       */
      ...(typeof summoner.proficiencyBonus === "number" ? { proficiencyBonus: summoner.proficiencyBonus } : {}),
    },
    actions: (shaped.actions ?? []).map(resolveAction),
    reactions: (shaped.reactions ?? []).map(resolveAction),
    traits: (shaped.traits ?? []).map(resolveAction),
  };

  return { body, count: Math.max(1, Math.floor(spec.count ?? 1)), problems };
}
