/**
 * A CHARACTER AS A SUMMONER — the adapter the summon system was always meant to have.
 *
 * Christopher, 2026-09-08: *"what do you mean a character sheet cant declare a summon, the whole
 * reason there is a summon system was for things like this."*
 *
 * He is right, and `check:summons` says so in its own fixture: the summoner it tests with is
 * `paladin` — *"Lights Stone: Paladin/Sorcerer 6. PB +3, CHA-based spell attack +5, save DC 13"* —
 * a PC, hand-written as a `SummonerContext` literal. The arithmetic was proved against a character
 * from the day it was built. What never existed was the function that turns a real `Actor` into
 * that context, so nothing could produce one outside a test.
 *
 * ─── ⚠ EVERY VALUE COMES FROM THE RESOLVER THAT ALREADY OWNS IT ─────────────────────────────
 *
 * `@SPELL` and `@DC` are questions `resolveFormulaVars` has answered for every card in the app
 * since the sheets existed, and `proficiencyBonus` is derived from level rather than read raw —
 * "a blank PB means `cr` feeds it; read stats through the resolver, never raw". Re-deriving any of
 * it here would be a second opinion that can disagree with the character's own card, which is the
 * exact failure `summonerContextFor` avoids on the creature side by asking
 * `creatureProficiencyBonus`.
 *
 * ⚠ AND `@SLOT` IS NOT THE CHARACTER'S. The Otherworldly Steed is almost entirely a function of the
 * slot it was cast with — AC "10 + 1 per spell level", HP "5 + 10 per spell level". That is a fact
 * about THIS CASTING, not about the caster, so it arrives with the call rather than from here.
 */

import type { Actor } from "../types/actor";
import type { SummonerContext } from "../monsters/summon";
import { proficiencyBonus, abilityModifier } from "../rules/dnd5e";
import { resolveFormulaVars } from "./resolveFormulaVars";
import { hitDicePools } from "../rules/multiclass";

/** The signed terms of a resolved formula — "+5" out of "@SPELL". */
function signedValue(actor: Actor, token: string): number | undefined {
  try {
    const out = resolveFormulaVars(token, actor as never);
    if (/@[A-Za-z]/.test(out)) return undefined;
    let total = 0;
    let found = false;
    for (const m of out.matchAll(/([+-]?)\s*(\d+)/g)) {
      total += (m[1] === "-" ? -1 : 1) * Number.parseInt(m[2], 10);
      found = true;
    }
    return found ? total : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The biggest Hit Die this character has, for the Covenant bond-creature's "your class Hit Die
 * maximum". A multiclass sheet has more than one; the block says "your class Hit Die", and the
 * class whose die is largest is the one a player means by it.
 */
function hitDieMaxOf(actor: Actor): number | undefined {
  const pools = hitDicePools(actor as never);
  let best = 0;
  for (const p of pools) {
    const faces = Number(String(p.die).replace(/^d/i, ""));
    if (Number.isFinite(faces)) best = Math.max(best, faces);
  }
  return best > 0 ? best : undefined;
}

/**
 * The character's own key modifier, for the bond's "1d8 + your main stat".
 *
 * ⚠ THE HIGHEST, WHICH IS THE SAME RULE `@MAIN` USES ON A CREATURE. A summon's block says "your
 * main stat" because it does not care which one it is; picking the largest is what makes one
 * sentence work for a Paladin and an Artificer alike.
 */
function mainModifierOf(actor: Actor): number | undefined {
  const scores = (actor.abilityScores ?? {}) as Partial<Record<string, { score?: number; modifier?: number }>>;
  let best: number | undefined;
  for (const key of ["str", "dex", "con", "int", "wis", "cha"]) {
    const row = scores[key];
    if (!row) continue;
    const mod = typeof row.modifier === "number"
      ? row.modifier
      : typeof row.score === "number" ? abilityModifier(row.score) : undefined;
    if (mod === undefined) continue;
    best = best === undefined ? mod : Math.max(best, mod);
  }
  return best;
}

/**
 * Turn a character into the context their summons resolve against.
 *
 * @param slotLevel the slot THIS casting spent, when the summon scales with it. Belongs to the
 *   call rather than to the caster — see the header.
 */
export function summonerContextFromActor(actor: Actor, slotLevel?: number): SummonerContext & { slotLevel?: number } {
  const level = Math.max(1, Number(actor.level ?? 1));
  return {
    name: actor.name,
    level,
    /**
     * Derived, never read raw — a sheet with a blank PB still has one.
     *
     * ⚠ AND A STORED ZERO IS A BLANK, NOT A BONUS. `?? ` alone accepts 0, and a card that never had
     * the field filled saves one; a Steed whose block says "PB equals your Proficiency Bonus" would
     * then arrive with +0 to hit and look like a rules bug rather than a missing field.
     */
    proficiencyBonus: Number(actor.proficiencyBonus) > 0
      ? Number(actor.proficiencyBonus)
      : proficiencyBonus(level),
    ...(signedValue(actor, "@SPELL") !== undefined ? { spellAttackBonus: signedValue(actor, "@SPELL") } : {}),
    ...(signedValue(actor, "8+@SPELL") !== undefined ? { spellSaveDc: signedValue(actor, "8+@SPELL") } : {}),
    ...(mainModifierOf(actor) !== undefined ? { mainModifier: mainModifierOf(actor) } : {}),
    ...(hitDieMaxOf(actor) !== undefined ? { hitDieMax: hitDieMaxOf(actor) } : {}),
    ...(slotLevel !== undefined ? { slotLevel } : {}),
  };
}
