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
 *   typed     COMBAT proficiencies — armour, weapons, tools — and languages. Christopher:
 *             *"combat proficencies are the only thing that need to be there."* Nothing in the
 *             actor model records them and no table can infer them from a class name once a sheet
 *             has a single exception on it.
 *
 * ⚠ PASSIVES MOVED FROM THE SECOND COLUMN TO THE FIRST, AND WITHOUT A SKILL LIST. They were typed
 * because no per-skill proficiency is stored — but the sheet was already stating it: *"we already
 * have the skills in checks."* A Perception row reading `1d20+@WIS+@PROF` says proficient and
 * `1d20+@WIS` says not, and resolving either one and dropping the d20 leaves exactly the number a
 * passive is 10 plus. No eighteen-skill grid, no new field, no second copy of a fact the sheet
 * already holds — and where a row is simply absent the score is flagged rather than asserted.
 *
 * That split is why the imported sheets carried TWO note rows and not one, and it is the reason
 * neither is deleted here: the derived half stops being worth reading, the typed half is the only
 * copy that exists.
 */

import type { Actor } from "../types/actor";
import type { ActorAction } from "../types/tabs";
import type { DerivedStats } from "../state/deriveActorStats";
import { proficiencyBonus } from "./dnd5e";
import { castingAbilityForClass, classLevels, characterLevel, hitDicePools, type CastingAbility } from "./multiclass";
import { getActorInitiativeModifier } from "../state/initiative";
import { resolveFormulaVars } from "../state/resolveFormulaVars";
import { resolveSpecies } from "../../modules/dnd-5e/srdSpecies";
import { damageResponsesForActor } from "../../modules/dnd-5e/classDamageResponses";
import { resourcesForClasses } from "../../modules/dnd-5e/classResources";
import { resolveSkillChecks } from "../../modules/dnd-5e/srdSkills";
import { speciesRecoveryFor, classRecoveryFor } from "../../modules/dnd-5e/recoveryRegistry.generated";
import { srdClass } from "../../modules/dnd-5e/srdClasses.generated";

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

/**
 * A passive score, read off the check row the sheet already has.
 *
 * ⚠ NO SKILL LIST, AND NO PER-SKILL PROFICIENCY FIELD. Christopher: *"we already have the skills in
 * checks but the question is how do we let it happen without needed to add every skills for someone
 * to check if they are proficient with."*
 *
 * The answer is that the check row IS the declaration. A row exists because somebody added the
 * skill, and its formula already carries the whole modifier — `1d20+@WIS+@PROF` for a proficient
 * Perception, `1d20+@WIS` for an unproficient one. Resolving that formula and dropping the d20
 * leaves exactly the number a passive is 10 plus. Adding eighteen skills to every sheet so one of
 * them can be ticked would be building a second copy of a fact the sheet already states.
 *
 * `hasRow: false` means the sheet has no such check. The score is then 10 + the raw ability
 * modifier and is FLAGGED — an unproficient guess is right for some characters and low by the
 * proficiency bonus for others, and the flag is the difference between a number and a claim.
 */
export type PassiveScore = { skill: string; ability: AbilityId; value: number; hasRow: boolean };

export type DmReference = {
  /** "5d10 + 1d6" — mixed, never pretending to be N of one size. */
  hitDice: { die: string; count: number }[];
  speed: { sheet: string; speciesFt?: number; note?: string };
  darkvisionFt?: number;
  /** Species traits, so a race trait need not be authored as a feature to be readable. */
  speciesName?: string;
  /**
   * WHICH DOCUMENT ANSWERED for this race, which is not always the one the sheet asked for.
   * Printed beside a species claim so a pool that exists in only one edition is visibly an
   * edition's claim rather than a bare assertion.
   */
  speciesRuleset?: "5.2.1" | "5.1";
  speciesTraits: { name: string; text: string }[];
  /** Resistances, immunities and vulnerabilities with the feature each comes from. */
  damageResponses: { type: string; response: string; source: string; gatedByResource?: string }[];
  /** Every pool the class tables grant at this level, flagged for whether the sheet has it. */
  resources: ReferenceResource[];
  /** Passive Perception / Insight / Investigation, off the sheet's own check rows. */
  passives: PassiveScore[];
  /**
   * Pools the SUBCLASS grants, checked against the short-rest registry.
   *
   * ⚠ NAMED, NOT SIZED, AND THAT IS THE HONEST LIMIT. `classResources.ts` says so in its own
   * header — *"this table has 13 classes and NO subclasses"* — so there is no MAX to grant. The
   * registry does name the resource and the level it arrives at, which is enough to say *"your
   * subclass has one of these and your sheet does not"* without inventing how many uses it has.
   * Christopher: *"which if clicked should read the class and subclass and races and check them
   * against the libraries"* — this is the subclass half, as far as the libraries can answer.
   */
  subclassPools: { resource: string; earliestLevel: number | null; onSheet: boolean }[];
  /**
   * Pools the SPECIES grants, from the corrected recovery workbook.
   *
   * ⚠ THIS IS THE HALF I SAID COULD NOT BE DONE. The species traits state their uses in PROSE —
   * *"Proficiency Bonus times per Long Rest"* — and `never-infer-data-from-prose` forbids parsing
   * that. The `v4_Recovery_Corrected` workbook publishes them as DATA instead, keyed by edition:
   * an Orc's Adrenaline Rush comes back on a short rest, Relentless Endurance does not, and the
   * 5.1 Dragonborn's Breath Weapon refreshes on either while the 5.2.1 one does not. Transcription
   * was never needed — the authority already existed.
   */
  speciesPools: { resource: string; shortRest: string; longRest: string; onSheet: boolean }[];
  /** The SRD row for each of this character's classes, where the document covers it. */
  classReference: { className: string; hitDie: string; savingThrows: string[]; skillChoice: string; srdSubclass: string }[];
  /**
   * Rows the derivation now supplies — flagged, never removed. Filled by `deriveDmReference` once
   * the rest of the reference is known, because "redundant" is measured against what was actually
   * derived for THIS actor.
   */
  covered: RedundantRow[];
  /** The DM's own line — custom races, homebrew classes, anything the tables cannot know. */
  dmNote?: string;
};

/** The three passives a table actually asks for. */
const PASSIVE_SKILLS: readonly { skill: string; ability: AbilityId }[] = [
  { skill: "Perception", ability: "wis" },
  { skill: "Insight", ability: "wis" },
  { skill: "Investigation", ability: "int" },
];

/**
 * Sum every flat term left after the dice are removed.
 *
 * ⚠ ON THE RESOLVED STRING, NOT THE AUTHORED ONE. A sheet may write `1d20+@WIS+@PROF` or a flat
 * `1d20+5` — both are in the party's files — and only the resolver knows what the tokens are worth.
 * Reading the raw formula would work for one style and silently return 0 for the other.
 */
function flatTotal(resolved: string): number {
  const withoutDice = resolved.replace(/\b\d*d\d+\b/gi, "");
  let total = 0;
  for (const m of withoutDice.matchAll(/([+-]?)\s*(\d+)/g)) total += (m[1] === "-" ? -1 : 1) * Number(m[2]);
  return total;
}

/**
 * ⚠ THE VALUE COMES OFF THE RESOLVED ROW; THE FLAG COMES OFF THE STORED ONE.
 *
 * Once `resolveSkillChecks` publishes all eighteen, EVERY skill has a row — so "has a row" stopped
 * meaning anything and the flag had to move. What it asks now is whether the sheet has STATED
 * anything about this skill: a generated row is the mod's default, and a default says unproficient
 * because it has no way to know otherwise. A proficient character nobody has ticked still reads
 * low, and the flag is the only thing that says so.
 *
 * The gate caught this the moment the resolver landed — `hasRow` was true for all three on a sheet
 * storing two, which is a flag that cannot fail.
 */
function passivesFor(actor: Actor, stats: DerivedStats): PassiveScore[] {
  const resolve = (f: string) => resolveFormulaVars(f, actor, stats);
  const stored = actor.tabs?.checks ?? [];
  const rows = resolveSkillChecks(stored);
  const statedLabels = new Set(stored.map(r => (r.label ?? "").trim().toLowerCase()));
  return PASSIVE_SKILLS.map(({ skill, ability }) => {
    const key = skill.toLowerCase();
    const row = rows.find(r => (r.label ?? "").trim().toLowerCase() === key);
    const formula = row?.metadata?.attack ?? row?.description ?? "";
    return {
      skill, ability,
      value: formula ? 10 + flatTotal(resolve(formula)) : 10 + stats[ability].modifier,
      hasRow: statedLabels.has(key),
    };
  });
}

export function deriveDmReference(actor: Actor, stats: DerivedStats): DmReference {
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

  const ref: DmReference = {
    hitDice: hitDicePools(actor),
    speed: { sheet: sheetSpeed, speciesFt: species?.speedFt, note: speedNote },
    darkvisionFt: species?.darkvisionFt,
    speciesName: species?.name,
    speciesRuleset: species?.ruleset,
    speciesTraits: (species?.traits ?? []).map(t => ({ name: t.name, text: t.text })),
    damageResponses: damageResponsesForActor(actor).map(r => ({
      type: r.type, response: r.response, source: r.source, gatedByResource: r.gatedByResource,
    })),
    resources,
    /**
     * ⚠ MATCHED ON THE SPECIES THE SHEET RESOLVED TO, NOT THE RACE STRING. "Wood Elf" resolves to
     * the Elf entry, and the workbook keys its rows on the species; asking it about "Wood Elf"
     * would find nothing and report a Lineage's free casts as absent on every elf in the party.
     */
    /**
     * ⚠ THE RULESET THAT ANSWERED, NOT THE ONE THE SHEET ASKED FOR.
     *
     * `resolveSpecies` documents this exactly: *"Which document actually answered — not always the
     * one requested"*, because a race in only ONE of the two resolves there whatever the sheet
     * says. Passing `actor.srdRuleset` meant a sheet stating 5.2.1 with a Half-Orc resolved its
     * traits from 5.1 and then asked the recovery registry about a 5.2.1 Half-Orc, which does not
     * exist — so Relentless Endurance came back as no pool at all, silently.
     *
     * Christopher, 2026-09-11: *"wood elf is on the SRD 5.1 not the 5.2.1 which is why Lyrielle
     * shows species pool not on the sheet."* Her sheet states 5.2.1 and the Elf resolves in BOTH,
     * so that one is not this bug — see the note on `speciesRuleset` below — but hunting it found
     * this one, which would have cost every Half-Orc and Half-Elf in the party their racial pool.
     */
    speciesPools: speciesRecoveryFor(
      species?.ruleset ?? actor.srdRuleset ?? "5.2.1",
      species?.species.name,
      characterLevel(actor),
    ).map(r => ({
      resource: r.resource,
      shortRest: r.shortRestMode,
      longRest: r.longRestMode,
      onSheet: haveLabels.has(r.resource.trim().toLowerCase()),
    })),
    covered: [], // filled below — "redundant" is measured against the finished reference
    passives: passivesFor(actor, stats),
    /**
     * ⚠ A ROW SAYING "none" IS AN ANSWER, NOT A HOLE — the registry's own words. Most subclasses
     * grant nothing of their own and say so explicitly; dropping those rows would turn "checked,
     * has nothing" into "never checked", so they are filtered out HERE by name rather than being
     * mistaken for a gap.
     */
    /**
     * ⚠ THE CORRECTED WORKBOOK IS THE AUTHORITY HERE, NOT THE OLDER SHORT-REST REGISTRY.
     *
     * Christopher: *"ensure the recovery from the workbooks is in the app since it under represents
     * what each class and subclass could be recovered on short."* `shortRestRules.generated.ts`
     * answers one question — what comes back on a SHORT rest — and `recoveryRegistry.generated.ts`
     * answers both, keyed by edition. A subclass pool read from the narrower table reported "none"
     * for rules the corrected sheet prices.
     *
     * The older registry is still read by `resourcesForClasses` for its recovery LINE, which is a
     * different question and the reason both files still exist.
     */
    subclassPools: classRows.flatMap(r =>
      classRecoveryFor(actor.srdRuleset ?? "5.2.1", r.name, r.subclassName, r.level)
        .filter(rule => rule.subclassName && rule.engineKind !== "none")
        .map(rule => ({
          resource: rule.resource,
          earliestLevel: rule.minLevel || null,
          onSheet: haveLabels.has(rule.resource.trim().toLowerCase()),
        })),
    ),
    /**
     * The SRD's own row for this class — hit die, saves, skill choice and the subclass it
     * publishes. Printed so a DM can see what the sheet is supposed to look like, and so a
     * subclass the SRD does not carry is visibly a house choice rather than a silent one.
     */
    classReference: classRows
      .map(r => ({ stated: r.name, srd: srdClass(r.name) }))
      .filter(x => x.srd)
      .map(x => ({
        className: x.srd!.name,
        hitDie: x.srd!.hitDie,
        savingThrows: x.srd!.savingThrows,
        skillChoice: `choose ${x.srd!.skillChoiceCount} of ${x.srd!.skillChoices}`,
        srdSubclass: x.srd!.subclass,
      })),
    dmNote: actor.classFeatureTracker?.note?.trim() || undefined,
  };

  /**
   * ⚠ LAST, AND ON THE FINISHED OBJECT. Whether a row is redundant depends on what THIS reference
   * derived — a Darkvision row is a duplicate on an Aasimar and the only copy on a Kobold — so the
   * flagger cannot run until the species, responses and pools are all resolved.
   */
  ref.covered = redundantSheetRows(actor, ref);
  return ref;
}

/* ══ WHAT THE SHEET NO LONGER NEEDS TO CARRY ═══════════════════════════════════════════════════
 *
 * Christopher: *"it should be able to flag what is not needed in the features as the extra actions
 * that are already made, this way when we purge the action/traits/features/spells and rebuild them
 * we can do it correctly."*
 *
 * ⚠ FLAGGED, NEVER REMOVED — and that sentence is load-bearing after 0.8.40.9. This returns a LIST.
 * Nothing here writes, and the rebuild is a decision made by a person looking at it.
 *
 * ⚠ MATCHED AGAINST WHAT WAS ACTUALLY DERIVED FOR **THIS** ACTOR, NOT AGAINST A WORD LIST. A
 * Darkvision row is redundant on an Aasimar because `resolveSpecies` answered for that sheet; the
 * same row on a Kobold is the ONLY copy that exists, because the SRD's ten species do not include
 * one and nothing derived it. A name-based rule would delete the second along with the first —
 * which is how a party loses Pack Tactics and Sunlight Sensitivity in a cleanup.
 */
export type RedundantRow = {
  tab: "features" | "feats" | "outOfCombat" | "main" | "bonus";
  id: string;
  label: string;
  /** What now covers it — shown so the call is reviewable rather than trusted. */
  coveredBy: string;
};

/** Mechanisms that replaced a row outright, and the thing that replaced them. */
const RETIRED_ROWS: readonly { match: RegExp; coveredBy: string }[] = [
  { match: /^short rest$/i, coveredBy: "the Short Rest button" },
  { match: /^long rest$/i, coveredBy: "the Long Rest button" },
  { match: /^weapon mastery$/i, coveredBy: "the Weapon Mastery picker" },
];

export function redundantSheetRows(actor: Actor, ref: DmReference): RedundantRow[] {
  const out: RedundantRow[] = [];
  const norm = (s: string) => (s ?? "").trim().toLowerCase();

  /** Species trait names, and the "<Species> Traits" summary row a sheet often carries instead. */
  const traitNames = new Set(ref.speciesTraits.map(t => norm(t.name)));
  const speciesSummary = ref.speciesName ? norm(`${ref.speciesName} traits`) : null;

  /**
   * The feature half of a derived response's source — "Aasimar · Celestial Resistance" names the
   * row a sheet would have authored for it.
   */
  const responseFeatures = new Set(
    ref.damageResponses.map(r => norm(r.source.split("·").pop() ?? "")).filter(Boolean),
  );

  const poolLabels = new Set(ref.resources.filter(r => r.onSheet).map(r => norm(r.label)));

  /**
   * ⚠ ONLY A PURE REFERENCE ROW IS EVER CALLED REDUNDANT.
   *
   * A row that carries `statEffects`, an action cost, dice or a linked pool DOES something — the
   * derivation reproduces the TEXT beside it, never the mechanics. Rage is the case that proves
   * it: the species/class tables derive its resistance, so a name match flags the row, and on a
   * sheet where that row also carries the +2 damage toggle, dropping it would take the toggle with
   * it. The rebuild is allowed to lose a paragraph; it is not allowed to lose a rider.
   */
  const isReferenceOnly = (row: ActorAction) =>
    !(row.metadata?.statEffects as unknown[] | undefined)?.length
    && !(row.economyCost ?? []).length
    && !row.metadata?.attack
    && !row.metadata?.damage
    && !row.metadata?.resourceCost
    && !row.metadata?.resourceId;

  for (const tab of ["features", "feats", "outOfCombat"] as const) {
    for (const row of (actor.tabs?.[tab] ?? [])) {
      const label = norm(row.label);
      if (!label) continue;
      if (!isReferenceOnly(row)) continue;

      const retired = RETIRED_ROWS.find(r => r.match.test(row.label.trim()));
      if (retired) { out.push({ tab, id: row.id, label: row.label, coveredBy: retired.coveredBy }); continue; }

      if (speciesSummary && label === speciesSummary) {
        out.push({ tab, id: row.id, label: row.label, coveredBy: `the derived ${ref.speciesName} trait list` });
        continue;
      }
      if (traitNames.has(label)) {
        out.push({ tab, id: row.id, label: row.label, coveredBy: `${ref.speciesName} · derived species trait` });
        continue;
      }
      if (responseFeatures.has(label)) {
        out.push({ tab, id: row.id, label: row.label, coveredBy: "a derived damage response" });
        continue;
      }
      /**
       * ⚠ ONLY WHEN THE POOL IS ACTUALLY ON THE SHEET. A "Rage" feature row beside a real Rage
       * pool is a duplicate; the same row with NO pool is the only place the feature is recorded,
       * and flagging it would invite deleting the last copy.
       */
      if (poolLabels.has(label)) {
        out.push({ tab, id: row.id, label: row.label, coveredBy: "a Resources pool of the same name" });
      }
    }
  }

  return out;
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

  if (ref.passives.length > 0) {
    /**
     * ⚠ A MISSING CHECK ROW IS SAID OUT LOUD. The score is then an unproficient guess, right for
     * some characters and low by the proficiency bonus for others — printing it bare would be the
     * hand-typed note's own failure mode with a new author.
     */
    lines.push(
      "Passive: " + ref.passives.map(p =>
        `${p.skill} ${p.value}${p.hasRow ? "" : " (no proficiency stated — unproficient assumed)"}`
      ).join(", ") + ".",
    );
  }

  /**
   * ⚠ WHAT THE SRD SAYS THIS CLASS IS, beside what the sheet says it is. A subclass the document
   * does not publish is a house choice, and printing the SRD's own beside it makes that visible
   * rather than leaving a DM to wonder which of the two the app believes.
   */
  for (const c of ref.classReference) {
    lines.push(`${c.className}: Hit Die ${c.hitDie} · saves ${c.savingThrows.join(", ")} · SRD subclass ${c.srdSubclass}.`);
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

  /**
   * ⚠ SEPARATE LINE, SEPARATE WORDING, BECAUSE IT IS A WEAKER CLAIM. The class pools above come
   * with a max and can be added by a button; these are named by the registry with no size, so the
   * line asks for a look rather than offering a fix.
   */
  /**
   * ⚠ SPECIES POOLS ARE SIZED AND CADENCED, so unlike the subclass line this one can say both
   * rests. An Orc's Adrenaline Rush comes back on a SHORT rest and Relentless Endurance does not,
   * and a sheet with neither pool is missing two different things.
   */
  const speciesGaps = ref.speciesPools.filter(p => !p.onSheet);
  if (speciesGaps.length > 0) {
    lines.push(
      "⚠ Species pools not on the sheet: "
      + speciesGaps.map(p => `${p.resource} (short ${p.shortRest}, long ${p.longRest})`).join(", ")
      + `${ref.speciesRuleset ? ` — per SRD ${ref.speciesRuleset}` : ""}.`,
    );
  }

  const subMissing = ref.subclassPools.filter(p => !p.onSheet);
  if (subMissing.length > 0) {
    lines.push(
      "⚠ Subclass grants, not on the sheet: "
      + subMissing.map(p => p.resource + (p.earliestLevel ? ` (from level ${p.earliestLevel})` : "")).join(", ")
      + " — add each with its own uses; the registry names them but not how many.",
    );
  }

  /**
   * ⚠ "COVERED" IS NOT A WARNING AND IS NOT MARKED AS ONE. Nothing is broken — these rows simply
   * have a second source now, and the line exists so the purge-and-rebuild has a list to work
   * from rather than a memory. Christopher: *"this way when we purge the action/traits/features/
   * spells and rebuild them we can do it correctly."*
   */
  if (ref.covered.length > 0) {
    lines.push(
      "Now derived, so the sheet need not carry it: "
      + ref.covered.map(c => `${c.label} (${c.coveredBy})`).join(", ") + ".",
    );
  }

  if (ref.dmNote) lines.push(ref.dmNote);

  return lines;
}
