/**
 * THE COMBAT SUMMARY IS DERIVED, NOT TYPED.
 *
 * Christopher, 2026-09-10: *"you stripped out everything that the note section was suppose to do on
 * the main profile page — look in the master when we introduced the multi-class and the spell
 * casting choices for those spells and see what i wanted the notes section to contain and be
 * generated from."*
 *
 * ⚠ AND HE IS RIGHT, TWICE OVER. The rule was already written down in two places:
 *
 *   · **0.7.10.25**, trimming this very tracker: *"Label and Value were hand-typed copies of things
 *     the engine derives … The stored values are left on existing actors RATHER THAN DELETED. Note
 *     stays: it is the one field holding something nothing else knows."*
 *   · **0.7.34**, the bond ladder: *"REPLACE BY DERIVATION, not a migration that deletes party
 *     data … Nothing is deleted. Clear the assignment and the authored rows come back exactly as
 *     authored. A migration would have been irreversible loss for a change a render rule expresses
 *     completely."*
 *
 * 0.8.40.9 wrote exactly the migration both of those forbid, and it is reverted. This file is what
 * should have been built instead: the profile block ALREADY generates the multiclass casting lines
 * — *"Sorcerer — CHA +4 · PROF +3 · spell attack +7 · save DC 15"* — off `classes[]` and
 * `castingAbilityForClass`, and every remaining line of a hand-typed combat note comes off the same
 * data.
 *
 * ── WHAT IS DERIVED, AND WHAT STAYS TYPED ───────────────────────────────────────────────────
 * The line is not "reference prose" versus "real data". It is WHETHER THE APP KNOWS IT:
 *
 *   derived   saves (scores + `saveProficient` + PB), proficiency bonus, initiative (DEX plus any
 *             trait bonus), AC with the items that made it, speed, HP, and per-class spell attack
 *             and save DC.
 *   typed     proficiencies and languages; passive Perception / Insight / Investigation;
 *             darkvision and other senses. **No per-skill proficiency is stored anywhere in the
 *             actor model**, so a passive score cannot be derived — computing `10 + modifier` and
 *             calling it Passive Perception would print a number that is wrong for every character
 *             proficient in the skill. A wrong derived number is worse than an honest typed one.
 *
 * That split is why the imported sheets carried TWO note rows and not one, and it is the reason
 * neither is deleted here: the derived half stops being worth reading, the typed half is the only
 * copy that exists.
 */

import type { Actor } from "../types/actor";
import type { DerivedStats } from "../state/deriveActorStats";
import { proficiencyBonus } from "./dnd5e";
import { castingAbilityForClass, classLevels, characterLevel, type CastingAbility } from "./multiclass";
import { getActorInitiativeModifier } from "../state/initiative";

const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;
export type AbilityId = (typeof ABILITIES)[number];

export type SaveLine = { ability: AbilityId; modifier: number; proficient: boolean };
export type CastingLine = { className: string; ability: CastingAbility; modifier: number; attack: number; saveDc: number };

export type SheetSummary = {
  proficiencyBonus: number;
  saves: SaveLine[];
  initiative: number;
  ac: { total: number; base: number; from: string[] };
  speed: string;
  hpMax: number;
  casting: CastingLine[];
};

const sign = (n: number) => (n >= 0 ? `+${n}` : String(n));

/**
 * ⚠ PB IS READ, NOT ASSUMED. `derived-stats-not-stored` cuts both ways: a printed
 * `proficiencyBonus` is authoritative when present — a companion carries its owner's, which is not
 * its own level's — and only a blank one derives from the level.
 */
function pbFor(actor: Actor): number {
  const printed = Number(actor.proficiencyBonus);
  return printed > 0 ? printed : proficiencyBonus(characterLevel(actor));
}

/**
 * @param stats  the output of `deriveActorStats` — passed IN rather than computed, because every
 *               caller already has one and it is the expensive part. Computing a second one here
 *               would be a second reader of the same fact, free to disagree with the first.
 */
export function deriveSheetSummary(actor: Actor, stats: DerivedStats): SheetSummary {
  const pb = pbFor(actor);

  const saves: SaveLine[] = ABILITIES.map(ability => {
    const proficient = Boolean(actor.abilityScores?.[ability]?.saveProficient);
    return { ability, modifier: stats[ability].modifier + (proficient ? pb : 0), proficient };
  });

  /**
   * Single-class characters grow no `classes[]` — `className` and `level` already say it — so the
   * casting ability comes off the class NAME in that case. This is the same fall-through the
   * profile block needed: without it an Artificer, a Wizard and a Cleric all read "pick one".
   */
  const rows = classLevels(actor);
  const casters: { name: string; ability: CastingAbility }[] = rows.length >= 2
    ? rows.filter(r => r.castingAbility).map(r => ({ name: r.name, ability: r.castingAbility! }))
    : (() => {
        /**
         * ⚠ THE OVERRIDE LIVES ON `classes[0]`, NOT ON THE ACTOR. The profile step writes it
         * there even for a single-class character — that row exists precisely to hold a choice
         * the class name does not imply, which is the case the picker was added for.
         */
        const ability = (actor.classes?.[0]?.castingAbility as CastingAbility | undefined)
          || castingAbilityForClass(actor.className ?? "");
        return ability ? [{ name: actor.className || "Class", ability }] : [];
      })();

  const casting: CastingLine[] = casters.map(c => {
    const modifier = stats[c.ability].modifier;
    return { className: c.name, ability: c.ability, modifier, attack: modifier + pb, saveDc: 8 + modifier + pb };
  });

  return {
    proficiencyBonus: pb,
    saves,
    initiative: getActorInitiativeModifier(actor),
    ac: { total: stats.ac, base: stats.acBase, from: stats.acModifiedBy },
    speed: stats.speed,
    hpMax: stats.hpMax,
    casting,
  };
}

/**
 * The summary as the lines a sheet prints — the shape the hand-typed notes were written in, so a
 * character that has one can be read against this and the typed copy retired by eye.
 *
 * ⚠ NOT STORED ANYWHERE. That is the whole point of 0.7.34: *"the stage is derived and never stored
 * for the same reason the ACTIONS are — a written copy stops matching the first time a character
 * levels."* This returns strings for a renderer to print; nothing writes them back onto the actor.
 */
export function formatSheetSummary(summary: SheetSummary): string[] {
  const lines: string[] = [];

  lines.push(
    "Saves: " + summary.saves.map(s => `${s.ability.toUpperCase()} ${sign(s.modifier)}`).join(", ")
    + `. Prof ${sign(summary.proficiencyBonus)}. Initiative ${sign(summary.initiative)}.`
  );

  /**
   * ⚠ THE AC LINE NAMES THE ITEMS. "AC 19" is a number anybody can read off the card; "11 base →
   * 19 with Chain Mail, Shield, Defense" is the sentence the hand-typed note was written to carry,
   * and it is the one that shows WHY the number is what it is when a player asks.
   */
  lines.push(
    summary.ac.from.length > 0
      ? `AC ${summary.ac.total} — ${summary.ac.base} base, with ${summary.ac.from.join(", ")}.`
      : `AC ${summary.ac.total}.`
  );

  lines.push(`HP ${summary.hpMax}. Speed ${summary.speed}.`);

  for (const c of summary.casting) {
    lines.push(
      `${c.className} — ${c.ability.toUpperCase()} ${sign(c.modifier)} · spell attack ${sign(c.attack)} · save DC ${c.saveDc}.`
    );
  }

  return lines;
}
