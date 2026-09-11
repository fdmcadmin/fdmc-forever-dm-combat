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
import { castingAbilityForClass, classLevels, characterLevel, hitDicePools, type CastingAbility } from "./multiclass";
import { getActorInitiativeModifier } from "../state/initiative";
import { resolveSpecies } from "../../modules/dnd-5e/srdSpecies";
import { damageResponsesForActor } from "../../modules/dnd-5e/classDamageResponses";
import { resourcesForClasses } from "../../modules/dnd-5e/classResources";

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

/* ══ THE DM REFERENCE ══════════════════════════════════════════════════════════════════════════
 *
 * Christopher, 2026-09-10, on why the typed note had to go and what replaces it:
 *
 *   *"any changes to a character sheet or a lvl up was broken, it still had stuff from level 5 in
 *   it … a compiled of resources (because these arent getting into the right place all the time)
 *   (this should be regenerated every time a level up happens), a list of HP dice and other things
 *   for a DM to quick glance where things like darkvision, resistances, and other derived thing
 *   from the SRD that shows for when a dm or player is like i took X damage type … besides the
 *   class trait because those class and race trait would then not need to be made as a feature."*
 *
 *   *"just because it is derived doesnt mean a trait or a class resource got created for it."*
 *
 * ⚠ THAT LAST LINE IS THE WHOLE DESIGN. Derived and authored are two different facts, and this
 * block reports BOTH: what the SRD and the class tables say the character has, and — separately —
 * whether anything on the sheet was ever created for it. A resistance shows here whether or not a
 * feature row exists, because the player asking *"I just took radiant, do I resist it?"* needs the
 * rule, not an inventory of what somebody remembered to author. And a class pool the sheet has no
 * Resources entry for is NAMED as missing rather than quietly printed as though it were there.
 *
 * ⚠ AND IT IS WHY A STALE TYPED NOTE IS NOT A SMALL PROBLEM. The one on the party still read level
 * 5 at level 9. Nothing here is stored: it recomputes on every render, so a level-up moves it with
 * no regeneration step to forget.
 */

export type ReferenceResource = {
  label: string;
  max: number | string;
  reset: string;
  className: string;
  level: number;
  /** ⚠ Whether a pool with this label exists in `tabs.resources`. Derived does not mean authored. */
  onSheet: boolean;
};

export type DmReference = {
  /** "5d10 + 1d6" — mixed, never pretending to be N of one size. */
  hitDice: { die: string; count: number }[];
  speed: { sheet: string; speciesFt?: number; note?: string };
  darkvisionFt?: number;
  /** Species traits, so a race trait need not be authored as a feature to be readable. */
  speciesName?: string;
  speciesTraits: { name: string; text: string }[];
  /** Resistances, immunities and vulnerabilities with the feature each comes from. */
  damageResponses: { type: string; response: string; source: string; gatedByResource?: string }[];
  /** Every pool the class tables grant at this level, flagged for whether the sheet has it. */
  resources: ReferenceResource[];
  /** The DM's own line — custom races, homebrew classes, anything the tables cannot know. */
  dmNote?: string;
};

export function deriveDmReference(actor: Actor): DmReference {
  const rows = classLevels(actor);
  /**
   * A single-class character grows no `classes[]`, so `classLevels` returns []. The class tables
   * still have to be asked — otherwise every single-class Barbarian reports no Rage.
   */
  const classRows = rows.length > 0
    ? rows.map(r => ({ name: r.name, level: r.level, subclassName: actor.subclassName }))
    : [{ name: actor.className ?? "", level: characterLevel(actor), subclassName: actor.subclassName }];

  const haveLabels = new Set(
    (actor.tabs?.resources ?? []).map(r => (r.label ?? "").trim().toLowerCase()).filter(Boolean),
  );

  const resources: ReferenceResource[] = resourcesForClasses(classRows).map(r => ({
    label: r.label,
    max: r.max,
    reset: r.reset,
    className: r.className,
    level: r.level,
    /**
     * ⚠ MATCHED ON THE LABEL, WHICH IS WHAT `resourcesForClasses` ALREADY DE-DUPLICATES ON, and
     * what the Resources fill button matches when it adds only what is missing. Two readers of one
     * fact have to use one rule.
     */
    onSheet: haveLabels.has(r.label.trim().toLowerCase())
      // "Channel Divinity (Cleric)" is the disambiguated form of a pool the sheet may hold plainly.
      || haveLabels.has(r.label.replace(/\s*\([^)]*\)\s*$/, "").trim().toLowerCase()),
  }));

  const species = resolveSpecies(actor.race, actor.srdRuleset);
  const sheetSpeed = typeof actor.stats.speed === "string"
    ? actor.stats.speed
    : `${actor.stats.speed?.walk ?? 30} ft`;

  /**
   * ⚠ THE BASELINE IS 30 FT AND A DEVIATION IS THE POINT. Christopher: *"things like +10 movement
   * and things that those races get or if a class would increase above the baseline 30 ft or even
   * reduce below it."* The species number is stated beside the sheet's so a Wood Elf's 35 is
   * visibly the species' doing and a sheet reading 30 is visibly wrong.
   */
  const speedNote = species && species.speedFt !== 30
    ? `${species.name} walks ${species.speedFt} ft — ${species.speedFt > 30 ? "+" : ""}${species.speedFt - 30} on the 30 ft baseline.`
    : undefined;

  return {
    hitDice: hitDicePools(actor),
    speed: { sheet: sheetSpeed, speciesFt: species?.speedFt, note: speedNote },
    darkvisionFt: species?.darkvisionFt,
    speciesName: species?.name,
    speciesTraits: (species?.traits ?? []).map(t => ({ name: t.name, text: t.text })),
    damageResponses: damageResponsesForActor(actor).map(r => ({
      type: r.type, response: r.response, source: r.source, gatedByResource: r.gatedByResource,
    })),
    resources,
    dmNote: actor.classFeatureTracker?.note?.trim() || undefined,
  };
}

/**
 * The reference as printed lines, for the Notes section.
 *
 * ⚠ THE MISSING POOLS GET THEIR OWN LINE. Burying "no pool on the sheet" inside the full list is
 * how a character reaches a fight with no Rage counter — the whole reason this block exists is
 * that the resources *"arent getting into the right place all the time."*
 */
export function formatDmReference(ref: DmReference): string[] {
  const lines: string[] = [];

  if (ref.hitDice.length > 0) {
    lines.push("Hit Dice: " + ref.hitDice.map(h => `${h.count}${h.die}`).join(" + ") + ".");
  }

  lines.push(
    `Speed: ${ref.speed.sheet}.`
    + (ref.speed.note ? ` ${ref.speed.note}` : "")
    + (ref.darkvisionFt ? ` Darkvision ${ref.darkvisionFt} ft.` : ""),
  );

  if (ref.damageResponses.length > 0) {
    const by = (kind: string) => ref.damageResponses.filter(r => r.response === kind);
    for (const [kind, label] of [["resistance", "Resistance"], ["immunity", "Immunity"], ["vulnerability", "Vulnerability"]] as const) {
      const group = by(kind);
      if (group.length === 0) continue;
      lines.push(
        `${label}: ` + group.map(r =>
          r.type + (r.gatedByResource ? ` (while ${r.gatedByResource} is up)` : "")
        ).join(", ")
        + ` — ${[...new Set(group.map(r => r.source))].join("; ")}.`,
      );
    }
  }

  if (ref.speciesTraits.length > 0) {
    lines.push(`${ref.speciesName} traits: ` + ref.speciesTraits.map(t => t.name).join(", ") + ".");
  }

  const missing = ref.resources.filter(r => !r.onSheet);
  if (ref.resources.length > 0) {
    lines.push("Class pools: " + ref.resources.map(r => `${r.label} ${r.max}`).join(", ") + ".");
  }
  if (missing.length > 0) {
    lines.push("⚠ No pool on the sheet for: " + missing.map(r => `${r.label} (${r.className}, gained at level ${r.level})`).join(", ") + ".");
  }

  if (ref.dmNote) lines.push(ref.dmNote);

  return lines;
}
