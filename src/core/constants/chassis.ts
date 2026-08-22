/**
 * Adaptive / chassis items.
 *
 * A chassis item is ONE library entry that becomes a specific weapon when a form is chosen —
 * "Two-Handed Strength Weapon · +2" rather than eight separate Gifts, one per greatweapon.
 * The Act 3 Feywild Gifts are the case this was built for, but plenty of D&D items work this
 * way, so nothing here is campaign-specific.
 *
 * A CHASSIS IS A FILTER over BASE_WEAPONS, not a list. That table already carries category,
 * mastery, tags and formulas with the ability baked in, so a chassis only has to say which
 * subset is legal; the form supplies the dice and the item supplies the bonuses.
 */

import { BASE_WEAPONS, type BaseWeaponSeed } from "./baseWeapons";

export type ChassisAbility = "STR" | "DEX" | "any";

export type ChassisSpec = {
  /** Legal categories. Empty/absent = any category. */
  categories?: string[];
  /** Which ability the form must use. "any" leaves it to the form. */
  ability?: ChassisAbility;
  /** Tags the form must ALL have — "thrown", "reach". */
  requireTags?: string[];
  /** Tags the form must have AT LEAST ONE of. "Finesse or Light Melee" needs this, and it is
   *  why an AND-only filter was not enough. */
  anyOfTags?: string[];
  /** The chosen form's base-weapon id. Set on the ACTOR's copy, not on the library item. */
  formId?: string;
};

/** How a versatile form is currently held. Absent = one-handed. */
export type WeaponGrip = "1h" | "2h";

/** The ability a base weapon uses, read off its own formula rather than duplicated as data. */
export function formAbility(form: BaseWeaponSeed): "STR" | "DEX" {
  return form.attack.includes("@DEX") ? "DEX" : "STR";
}

/**
 * The two-handed damage die of a versatile weapon.
 *
 * BASE_WEAPONS states this in its description ("Versatile (1d8)") rather than as a field, so
 * it is parsed — but from OUR OWN authored strings, written by one helper, not from a campaign
 * document. Parsing prose is what mis-tagged the armour slots once; the difference here is the
 * prose is generated, and a miss degrades safely: no match simply means "not versatile", and
 * the weapon keeps its one-handed die.
 */
export function versatileDamageDie(form: BaseWeaponSeed): string | null {
  return form.description.match(/Versatile \((\d+d\d+)\)/i)?.[1] ?? null;
}

export function isVersatileForm(form: BaseWeaponSeed): boolean {
  return form.tags.includes("versatile") && versatileDamageDie(form) !== null;
}

/** Every base weapon a chassis will accept. */
export function matchingForms(spec: ChassisSpec | undefined): BaseWeaponSeed[] {
  if (!spec) return [];
  return BASE_WEAPONS.filter(form => {
    if (spec.categories?.length && !spec.categories.includes(form.category)) return false;
    if (spec.ability && spec.ability !== "any" && formAbility(form) !== spec.ability) return false;
    if (spec.requireTags?.length && !spec.requireTags.every(t => form.tags.includes(t))) return false;
    if (spec.anyOfTags?.length && !spec.anyOfTags.some(t => form.tags.includes(t))) return false;
    return true;
  });
}

export function findForm(formId: string | undefined): BaseWeaponSeed | undefined {
  return formId ? BASE_WEAPONS.find(w => w.id === formId) : undefined;
}


/**
 * Compose the attack/damage/crit a chassis produces once a form and grip are settled.
 *
 * Every term stays explicit and symbolic — `1d20+@PROF+@STR+2`, `1d12+@STR+2+@PROF` — so the
 * card resolves them the same way it resolves a plain weapon, and a level-up moves them.
 *
 * @param bonus       magic bonus, added to attack AND damage
 * @param pbToDamage  the item adds Proficiency Bonus to its damage roll (the Feywild Gifts do)
 */
export function composeChassisAttack(
  form: BaseWeaponSeed,
  grip: WeaponGrip,
  bonus = 0,
  pbToDamage = false,
): { attack: string; damage: string; crit: string } {
  const plus = bonus ? `+${bonus}` : "";
  const pb = pbToDamage ? "+@PROF" : "";
  const ability = formAbility(form);

  // Two-handing a versatile weapon swaps the die; everything else about the line is unchanged.
  const twoHandDie = grip === "2h" ? versatileDamageDie(form) : null;
  const damageDice = twoHandDie ?? form.damage.split("+")[0];
  const critDice = twoHandDie
    ? `${(Number.parseInt(twoHandDie, 10) || 1) * 2}d${twoHandDie.split("d")[1]}`
    : form.crit.split("+")[0];

  return {
    attack: `${form.attack}${plus}`,
    damage: `${damageDice}+@${ability}${plus}${pb}`,
    crit: `${critDice}+@${ability}${plus}${pb}`,
  };
}

/**
 * Can this actor two-hand right now?
 *
 * A versatile weapon needs the OFF HAND FREE to take the two-handed die. A shield is the usual
 * blocker: donning or doffing one costs an action, so it cannot be worked around mid-turn —
 * unlike the grip change itself, which is free and may happen between attacks in an Extra
 * Attack sequence.
 *
 * Takes the actor's equipment rows so the check reads what is actually WORN, not what is owned.
 */
export function offHandBlocker(
  equipment: Array<{ label: string; metadata?: { equipped?: boolean; slot?: string } }>,
): string | null {
  const worn = equipment.filter(a => a.metadata?.equipped !== false);
  const shield = worn.find(a => a.metadata?.slot === "shield");
  return shield ? shield.label : null;
}
