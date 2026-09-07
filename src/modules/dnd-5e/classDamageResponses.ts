/**
 * WHAT A CLASS OR A LINEAGE ALREADY RESISTS — because it is a RULE, not a preference.
 *
 * Christopher, 2026-09-07: *"all of those resistances should be there because they are based on
 * classes not because they want them, same with the rage, it should already be known what rage
 * resists."*
 *
 * He is right and my previous reading was wrong. `Actor.damageResponses` shipped as an entered
 * field on the grounds that the app must not read a mechanic out of a feature's description — and
 * that rule is real, but it is a rule about PROSE. A Barbarian resisting bludgeoning, piercing and
 * slashing while raging is not something inferred from the word "Barbarian"; it is what raging
 * does, the same way a proficiency bonus is what level does. Making a DM type it in is the same
 * mistake as making them type their proficiency bonus.
 *
 * ⚠ AND IT IS THE SAME SHAPE THE REST OF THIS FOLDER ALREADY USES. `casterLean` hand-lists the
 * half casters, `weaponMastery` hand-lists the mastery classes, `shortRestRecovery` hand-reads the
 * class rows. Those are hand-built rule tables keyed on a STATED class, which is the allowed thing;
 * what is banned is an auto-generated progression database, and this is neither generated nor a
 * progression.
 *
 * ─── ⚠ THE LINEAGE HALF LIVES IN `srdSpecies`, NOT HERE ─────────────────────────────────────
 *
 * This file briefly carried its own "a Dwarf resists poison" list. It now reads the SRD 5.2.1
 * species table, which is also what puts the trait rows on the character sheet — so a lineage
 * cannot resist poison for the checker and something else in the DM's feature list. RULE ZERO:
 * one table, two readers. What is left here is the CLASS half, which the species table has no
 * business knowing about.
 *
 * ─── ⚠ WHAT IS IN THE TABLE, AND THE LINE THAT KEEPS IT HONEST ──────────────────────────────
 *
 * ONLY entries that follow from the stated class or lineage with NO further choice. A Dwarf
 * resists poison whichever Dwarf they are; an Aasimar resists necrotic and radiant whichever
 * Aasimar they are. A Dragonborn's resistance depends on their ancestry, a Tiefling's on their
 * legacy in the 2024 rules, and a Barbarian's Totem on their subclass — those are CHOICES the
 * sheet does not state, so they stay in the entered field where a DM can say which one it is.
 *
 * The entered field is therefore not replaced. It is now the OVERRIDE and the extension: a stated
 * response for the same damage type wins over the derived one, and entering that type with a
 * share of 0 is how a homebrew variant switches a derived one off.
 *
 * ─── ⚠ A CONDITIONAL RESISTANCE IS GATED BY ITS RESOURCE, AND THE APP CAN COUNT THAT ────────
 *
 * Rage's resistance lasts as long as the rage. A level 1 Barbarian has two rages, regains one at
 * the day's single Short Rest, and the day is five fights — so that resistance covers three fights
 * in five, not five in five. `gatedByResource` names the pool, and `partyMitigationFromActors`
 * reads its size from the ledger the checker already builds rather than asking. That is the whole
 * point of reading the actor: *"if we know everything on the actor we should know everything that
 * actor can do."*
 */

import type { Actor } from "../../core/types/actor";
import type { DamageResponse } from "../../core/encounter-band/damageResponsePricing";
import { classLevels } from "../../core/rules/multiclass";
import { resolveSpecies } from "./srdSpecies";

export type DerivedDamageResponse = DamageResponse & {
  /** The feature it comes from — "Dwarf · Dwarven Resilience". Shown wherever it is priced. */
  source: string;
  /**
   * The resource whose uses gate it, matched against the sheet's Resources labels. Unset means it
   * is always on, which is what a lineage resistance is.
   */
  gatedByResource?: string;
};

type Rule = {
  /** Damage types this grants, all with the same response. */
  types: readonly string[];
  response: DamageResponse["response"];
  /** The printed feature, so the panel can name what it is pricing. */
  feature: string;
  /** The pool that has to be spent for it to apply, when one does. */
  gatedByResource?: string;
  /** Repeated onto the response so the "could not evaluate this" reporting still fires. */
  qualifier?: string;
};

/**
 * CLASS RULES. One entry, because one class grants a damage resistance that follows from the class
 * alone — everything else (Totem Warrior, Draconic Sorcerer, an Oath's aura) is a subclass choice.
 */
const CLASS_RULES: ReadonlyArray<{ match: RegExp; rule: Rule }> = [
  { match: /^barbarian$/i,
    rule: {
      types: ["bludgeoning", "piercing", "slashing"],
      response: "resistant",
      feature: "Rage",
      gatedByResource: "Rage",
      qualifier: "while raging",
    } },
];

/** Every class name on this sheet, structured rows first and the label when there are none. */
function classNames(actor: Actor): string[] {
  const rows = classLevels(actor as never);
  if (rows.length > 0) return rows.map(r => r.name.trim());
  return String(actor.className ?? "").split(/[/,]/).map(s => s.trim()).filter(Boolean);
}

/**
 * The damage responses this character has by being what they are.
 *
 * Returns an empty array for a class and lineage the table does not cover, which is the honest
 * answer — an Illrigger is homebrew and a Kobold grants none.
 */
export function classDamageResponsesFor(actor: Actor): DerivedDamageResponse[] {
  const out: DerivedDamageResponse[] = [];
  const push = (rule: Rule, source: string) => {
    for (const type of rule.types) {
      out.push({
        type,
        response: rule.response,
        source,
        ...(rule.qualifier ? { qualifier: rule.qualifier } : {}),
        ...(rule.gatedByResource ? { gatedByResource: rule.gatedByResource } : {}),
      });
    }
  };

  /**
   * ⚠ THE LINEAGE HALF COMES FROM `srdSpecies`, NOT FROM A SECOND LIST HERE.
   *
   * This file carried its own "a Dwarf resists poison" table until the SRD species table existed.
   * Two copies of a published fact is two places it can be wrong, and the failure would be silent
   * and asymmetric — the character sheet showing one thing and the checker pricing another. RULE
   * ZERO: one table, read by both.
   */
  const species = resolveSpecies(actor.race);
  for (const r of species?.damageResponses ?? []) {
    out.push({ type: r.type, response: r.response, source: `${species!.name} · ${r.feature}` });
  }

  for (const name of classNames(actor)) {
    for (const { match, rule } of CLASS_RULES) {
      if (match.test(name)) push(rule, `${name} · ${rule.feature}`);
    }
  }
  return out;
}

/**
 * The derived rules plus whatever the DM entered, with the entered one winning per damage type.
 *
 * ⚠ PER TYPE, NOT PER CHARACTER. A DM entering one homebrew resistance must not silently discard
 * the character's lineage rules; and a DM entering the SAME type is stating something more exact
 * about it than the table knows, so that one replaces rather than stacks — two entries for the
 * same type would remove its share twice.
 */
export function damageResponsesForActor(actor: Actor): DerivedDamageResponse[] {
  const derived = classDamageResponsesFor(actor);
  const stated = (actor.damageResponses ?? []).filter(r => r.type.trim() !== "");
  const statedTypes = new Set(stated.map(r => r.type.trim().toLowerCase()));
  return [
    ...derived.filter(r => !statedTypes.has(r.type.trim().toLowerCase())),
    ...stated.map(r => ({ ...r, source: "entered on the character sheet" })),
  ];
}
