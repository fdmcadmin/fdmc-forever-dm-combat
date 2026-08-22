/**
 * Base spellcasting focus set (2024 PHB) for the equipment library.
 *
 * WHY THIS EXISTS: the same reason `baseWeapons.ts` exists. The library shipped campaign focuses
 * — Rootknot Staff, Staring-Knot Wand — and not one mundane Orb or Holy Symbol, so a caster's
 * focus had to be hand-authored every time. And the chassis system filters BASE_WEAPONS, which
 * meant a Gift authored as a *Spellcasting Focus* matched ZERO forms: the category does not exist
 * in a table of weapons.
 *
 * ── THE PATTERN IS baseWeapons.ts, DELIBERATELY ──────────────────────────────────────────────
 * Same seed shape, same category-plus-tags split, same "one entry per real thing" rule that makes
 * finesse two weapons rather than one weapon with a choice. A chassis is a FILTER, and a filter is
 * only as good as the vocabulary underneath it.
 *
 * ⚠ A FOCUS IS NOT A WEAPON, so it carries no attack, damage or crit. Anything that needs those
 * is a weapon that HAPPENS to be a focus — see the `weapon` tag below, which is exactly what a
 * "battle focus" is.
 *
 * CATEGORY = what class list it belongs to (Arcane / Druidic / Holy). TAGS = how it is held and
 * what else it is, so a chassis can say "a focus you can fight with" or "a one-handed focus"
 * without a second category axis.
 */

export type BaseFocusSeed = {
  id: string;
  name: string;
  /** Arcane Focus · Druidic Focus · Holy Symbol — the 2024 class-list split. */
  category: string;
  /**
   * one-handed | two-handed — how it occupies the hands.
   * weapon — it is ALSO a real weapon (a staff is a quarterstaff), so a battle focus can filter
   * on it and a Gift built on one still swings.
   * worn — an emblem or amulet needs no hand at all.
   * arcane | druidic | holy — the class list again as a tag, so a filter can cross categories.
   */
  tags: string[];
  description: string;
  /** For a focus that is also a weapon: the BASE_WEAPONS id its attack comes from. */
  weaponFormId?: string;
};

const f = (id: string, name: string, category: string, tags: string[], description: string, weaponFormId?: string): BaseFocusSeed =>
  ({ id: `focus-${id}`, name, category, tags, description, ...(weaponFormId ? { weaponFormId } : {}) });

export const BASE_FOCUSES: BaseFocusSeed[] = [
  // ── Arcane focuses ────────────────────────────────────────────────────────
  f("crystal", "Crystal", "Arcane Focus", ["arcane", "one-handed"], "A cut crystal held in one hand."),
  f("orb", "Orb", "Arcane Focus", ["arcane", "one-handed"], "A polished sphere of glass or stone."),
  f("rod", "Rod", "Arcane Focus", ["arcane", "one-handed"], "A short ornamented rod."),
  f("wand", "Wand", "Arcane Focus", ["arcane", "one-handed"], "A slender tapered wand."),
  // A staff is a quarterstaff that also focuses — the reason `weapon` is a tag and not a category.
  f("staff", "Staff", "Arcane Focus", ["arcane", "two-handed", "weapon"], "A tall staff, and a serviceable quarterstaff.", "base-quarterstaff"),

  // ── Druidic focuses ───────────────────────────────────────────────────────
  f("sprig-of-mistletoe", "Sprig of Mistletoe", "Druidic Focus", ["druidic", "one-handed"], "A cutting of living mistletoe."),
  f("totem", "Totem", "Druidic Focus", ["druidic", "one-handed"], "A carved token of beast or season."),
  f("wooden-staff", "Wooden Staff", "Druidic Focus", ["druidic", "two-handed", "weapon"], "A staff of living wood, and a serviceable quarterstaff.", "base-quarterstaff"),
  f("yew-wand", "Yew Wand", "Druidic Focus", ["druidic", "one-handed"], "A wand cut from yew."),

  // ── Holy symbols ──────────────────────────────────────────────────────────
  // An emblem is borne on a shield or worn, so it costs no hand at all.
  f("amulet", "Amulet", "Holy Symbol", ["holy", "worn"], "A holy symbol worn at the throat."),
  f("emblem", "Emblem", "Holy Symbol", ["holy", "worn"], "A holy symbol borne on a shield or worn openly."),
  f("reliquary", "Reliquary", "Holy Symbol", ["holy", "one-handed"], "A small case holding a sacred relic."),
];

/** Every base focus a chassis will accept. Mirrors `matchingForms` for weapons. */
export function matchingFocuses(spec: { categories?: string[]; requireTags?: string[]; anyOfTags?: string[] } | undefined): BaseFocusSeed[] {
  if (!spec) return [];
  return BASE_FOCUSES.filter(form => {
    if (spec.categories?.length && !spec.categories.includes(form.category)) return false;
    if (spec.requireTags?.length && !spec.requireTags.every(t => form.tags.includes(t))) return false;
    if (spec.anyOfTags?.length && !spec.anyOfTags.some(t => form.tags.includes(t))) return false;
    return true;
  });
}

/** The category values a chassis may filter on — used by the creator's picker. */
export const FOCUS_CATEGORIES = ["Arcane Focus", "Druidic Focus", "Holy Symbol"] as const;
