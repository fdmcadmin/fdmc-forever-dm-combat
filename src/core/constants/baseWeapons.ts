/**
 * Base weapon set (2024 PHB) for the equipment library.
 *
 * WHY THIS EXISTS: the library shipped with campaign magic items only — Frostedge,
 * Rimecleaver, Canopy Bow — and not one mundane Longbow or Scimitar. So every basic weapon
 * on every character sheet had to be hand-authored as a main-tab attack, because there was
 * nothing to attach. That is the whole reason the party carries 24 hand-written attacks
 * beside 4 generated ones, and why removing a weapon leaves its attack behind.
 *
 * With these present, a weapon is BUILT once and ATTACHED, and `itemToAttackAction` generates
 * its attack. Nothing is authored twice.
 *
 * FORMULA CONVENTION — every term carries an explicit `+`:
 *     attack  1d20+@PROF+@STR
 *     damage  1d8+@STR
 * The separator is not cosmetic. It guarantees the term is read: without it, a var that fails
 * to resolve can swallow the segment. `@PROF` stays symbolic so martial-proficiency features
 * can drop it for a character who lacks proficiency with that weapon.
 *
 * FINESSE IS TWO ENTRIES, not one weapon with a stat choice — the ability is baked into the
 * formula, so the STR and DEX forms are different items. This matches the campaign library's
 * existing "Frostedge (DEX)" / "Rimecleaver (DEX)" pattern.
 *
 * Masteries are the official 2024 assignments. They are REFERENCE ONLY on the card: a
 * character has a mastery because it is active for them, not because the weapon carries one.
 */

import type { WeaponMasteryName } from "./weaponMastery";

export type BaseWeaponSeed = {
  id: string;
  name: string;
  category: string;
  attack: string;
  damage: string;
  crit: string;
  range?: string;
  mastery?: WeaponMasteryName;
  tags: string[];
  description: string;
};

const m = (id: string, name: string, dmg: string, critDmg: string, mastery: WeaponMasteryName, category: string, tags: string[], desc: string, range?: string): BaseWeaponSeed => ({
  id: `base-${id}`, name, category,
  attack: "1d20+@PROF+@STR", damage: `${dmg}+@STR`, crit: `${critDmg}+@STR`,
  range, mastery, tags, description: desc,
});

/** Finesse/ranged weapons use DEX. */
const d = (id: string, name: string, dmg: string, critDmg: string, mastery: WeaponMasteryName, category: string, tags: string[], desc: string, range?: string): BaseWeaponSeed => ({
  id: `base-${id}`, name, category,
  attack: "1d20+@PROF+@DEX", damage: `${dmg}+@DEX`, crit: `${critDmg}+@DEX`,
  range, mastery, tags, description: desc,
});

export const BASE_WEAPONS: BaseWeaponSeed[] = [
  // ── Simple melee ──────────────────────────────────────────────────────────
  m("club", "Club", "1d4", "2d4", "Slow", "Melee One-Handed", ["simple", "light"], "A simple wooden club."),
  m("greatclub", "Greatclub", "1d8", "2d8", "Push", "Melee Two-Handed", ["simple"], "A heavy two-handed club."),
  m("mace", "Mace", "1d6", "2d6", "Sap", "Melee One-Handed", ["simple"], "A weighted bludgeon."),
  m("quarterstaff", "Quarterstaff", "1d6", "2d6", "Topple", "Melee Versatile", ["simple", "versatile"], "A stout wooden staff. Versatile (1d8)."),
  m("spear", "Spear", "1d6", "2d6", "Sap", "Melee Versatile", ["simple", "thrown", "versatile"], "A thrusting polearm. Versatile (1d8).", "20/60 ft"),
  m("handaxe", "Handaxe", "1d6", "2d6", "Vex", "Melee One-Handed", ["simple", "light", "thrown"], "A light axe balanced for throwing.", "20/60 ft"),
  m("javelin", "Javelin", "1d6", "2d6", "Slow", "Melee One-Handed", ["simple", "thrown"], "A throwing spear.", "30/120 ft"),
  m("light-hammer", "Light Hammer", "1d4", "2d4", "Nick", "Melee One-Handed", ["simple", "light", "thrown"], "A small throwing hammer.", "20/60 ft"),
  d("dagger", "Dagger", "1d4", "2d4", "Nick", "Melee One-Handed", ["simple", "light", "finesse", "thrown"], "A finesse blade. DEX form.", "20/60 ft"),
  d("sickle", "Sickle", "1d4", "2d4", "Nick", "Melee One-Handed", ["simple", "light"], "A curved reaping blade."),

  // ── Simple ranged ─────────────────────────────────────────────────────────
  d("light-crossbow", "Light Crossbow", "1d8", "2d8", "Slow", "Ranged Two-Handed", ["simple", "ammunition", "loading"], "A light crossbow.", "80/320 ft"),
  d("shortbow", "Shortbow", "1d6", "2d6", "Vex", "Ranged Two-Handed", ["simple", "ammunition"], "A short recurve bow.", "80/320 ft"),
  d("dart", "Dart", "1d4", "2d4", "Vex", "Ranged One-Handed", ["simple", "finesse", "thrown"], "A weighted throwing dart.", "20/60 ft"),
  d("sling", "Sling", "1d4", "2d4", "Slow", "Ranged One-Handed", ["simple", "ammunition"], "A leather sling.", "30/120 ft"),

  // ── Martial melee ─────────────────────────────────────────────────────────
  m("battleaxe", "Battleaxe", "1d8", "2d8", "Topple", "Melee Versatile", ["martial", "versatile"], "Versatile (1d10)."),
  m("flail", "Flail", "1d8", "2d8", "Sap", "Melee One-Handed", ["martial"], "A chain-hafted striking head."),
  m("glaive", "Glaive", "1d10", "2d10", "Graze", "Melee Two-Handed", ["martial", "heavy", "reach"], "A reach polearm."),
  m("greataxe", "Greataxe", "1d12", "2d12", "Cleave", "Melee Two-Handed", ["martial", "heavy"], "A great two-handed axe."),
  m("greatsword", "Greatsword", "2d6", "4d6", "Graze", "Melee Two-Handed", ["martial", "heavy"], "A great two-handed blade."),
  m("halberd", "Halberd", "1d10", "2d10", "Cleave", "Melee Two-Handed", ["martial", "heavy", "reach"], "A reach polearm."),
  m("lance", "Lance", "1d10", "2d10", "Topple", "Melee Two-Handed", ["martial", "reach"], "A mounted charging weapon."),
  m("longsword", "Longsword", "1d8", "2d8", "Sap", "Melee Versatile", ["martial", "versatile"], "Versatile (1d10)."),
  m("maul", "Maul", "2d6", "4d6", "Topple", "Melee Two-Handed", ["martial", "heavy"], "A great two-handed hammer."),
  m("morningstar", "Morningstar", "1d8", "2d8", "Sap", "Melee One-Handed", ["martial"], "A spiked bludgeon."),
  m("pike", "Pike", "1d10", "2d10", "Push", "Melee Two-Handed", ["martial", "heavy", "reach"], "A long reach polearm."),
  m("trident", "Trident", "1d8", "2d8", "Topple", "Melee Versatile", ["martial", "thrown", "versatile"], "Versatile (1d10).", "20/60 ft"),
  m("warhammer", "Warhammer", "1d8", "2d8", "Push", "Melee Versatile", ["martial", "versatile"], "Versatile (1d10)."),
  m("war-pick", "War Pick", "1d8", "2d8", "Sap", "Melee One-Handed", ["martial"], "A piercing military pick."),
  d("rapier", "Rapier", "1d8", "2d8", "Vex", "Melee One-Handed", ["martial", "finesse"], "A finesse duelling blade. DEX form."),
  d("scimitar", "Scimitar", "1d6", "2d6", "Nick", "Melee One-Handed", ["martial", "light", "finesse"], "A curved finesse blade. DEX form."),
  d("shortsword", "Shortsword", "1d6", "2d6", "Vex", "Melee One-Handed", ["martial", "light", "finesse"], "A short finesse blade. DEX form."),
  d("whip", "Whip", "1d4", "2d4", "Slow", "Melee One-Handed", ["martial", "finesse", "reach"], "A reach finesse weapon. DEX form."),

  // ── Martial ranged ────────────────────────────────────────────────────────
  d("blowgun", "Blowgun", "1", "2", "Vex", "Ranged Two-Handed", ["martial", "ammunition", "loading"], "A silent dart tube.", "25/100 ft"),
  d("hand-crossbow", "Hand Crossbow", "1d6", "2d6", "Vex", "Ranged One-Handed", ["martial", "ammunition", "light", "loading"], "A one-handed crossbow.", "30/120 ft"),
  d("heavy-crossbow", "Heavy Crossbow", "1d10", "2d10", "Push", "Ranged Two-Handed", ["martial", "ammunition", "heavy", "loading"], "A heavy crossbow.", "100/400 ft"),
  d("longbow", "Longbow", "1d8", "2d8", "Slow", "Ranged Two-Handed", ["martial", "ammunition", "heavy"], "A tall war bow.", "150/600 ft"),

  // ── Finesse STR forms — the same weapon built off Strength ────────────────
  // Finesse lets the wielder choose; the formula bakes the choice, so each is its own item.
  m("dagger-str", "Dagger (STR)", "1d4", "2d4", "Nick", "Melee One-Handed", ["simple", "light", "finesse", "thrown"], "A finesse blade built off Strength.", "20/60 ft"),
  m("rapier-str", "Rapier (STR)", "1d8", "2d8", "Vex", "Melee One-Handed", ["martial", "finesse"], "A finesse duelling blade built off Strength."),
  m("scimitar-str", "Scimitar (STR)", "1d6", "2d6", "Nick", "Melee One-Handed", ["martial", "light", "finesse"], "A curved finesse blade built off Strength."),
  m("shortsword-str", "Shortsword (STR)", "1d6", "2d6", "Vex", "Melee One-Handed", ["martial", "light", "finesse"], "A short finesse blade built off Strength."),

  // ── Unarmed — every character has one; not a library weapon elsewhere ─────
  {
    id: "base-unarmed-strike", name: "Unarmed Strike", category: "Melee One-Handed",
    attack: "1d20+@PROF+@STR", damage: "1+@STR", crit: "2+@STR",
    tags: ["unarmed"], description: "A punch, kick, headbutt or shove. Always available.",
  },
];
