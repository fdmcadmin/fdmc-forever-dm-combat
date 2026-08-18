/**
 * damageTypeChoice — read a spell or item's own rules text and work out whether its damage type
 * is FIXED or something the caster picks.
 *
 * LAYER: D&D MOD. The phrasings below are 5e's ("of your choice", "instead of"); another d20
 * system words the same idea differently and would ship its own reader. The SHAPE the result
 * feeds — a default plus a permitted set — is engine.
 *
 * WHY THIS EXISTS. `damageType` was one authored string, so a spell whose type the caster chooses
 * could not be expressed at all: Chromatic Orb and Sorcerous Burst had to be authored as one
 * arbitrary type and corrected by hand at the table every time. Christopher: *"if a spell says
 * the you choose, then this is where the damage type would come from otherwise it a pick this
 * when building the damage spell."*
 *
 * ⚠ THE MODAL DECIDES A REPLACEMENT, and getting this wrong is the whole risk. A variant item's
 * text names BOTH types in one sentence, so a naive scan offers the type the item explicitly does
 * NOT do:
 *
 *   "this weapon deals cold damage instead of fire"          → FIXED cold. One type. The fire is
 *                                                              being described only to be denied.
 *   "you can deal cold damage instead of fire"               → CHOICE of cold or fire. The modal
 *                                                              ("can"/"may") makes it optional.
 *   "damage of a type you choose: acid, cold, or fire"       → CHOICE of all three.
 *   "deals 2d6 fire damage"                                  → FIXED fire.
 *
 * Healing has no damage type at all, and asking for one is noise — callers pass the outcome mode
 * so a healing action returns `none`.
 */

import { DAMAGE_TYPES, type DamageType } from "../constants/damageTypes";

export type DamageTypeReading = {
  /** `none` — nothing to author (healing, or no type in the text). */
  kind: "none" | "fixed" | "choice";
  /** The type to use, or the one pre-selected when the caster chooses. */
  primary?: DamageType;
  /** Every type the caster may pick. Only meaningful for `choice`. */
  options: DamageType[];
  /** Why the reader decided this, shown in the editor so a wrong guess is visible. */
  reason: string;
};

/** "of your choice", "you choose", "one of the following" … */
const CHOICE_PHRASE = /\b(?:of (?:your|its) choice|you choose|choose one|type you choose|one of the following)\b/i;

/**
 * A replacement, with the REPLACING type captured first: "cold damage instead of fire".
 * `[\s\S]{0,40}` spans "damage" and any wording between the two type names without letting the
 * match run into an unrelated sentence.
 */
const REPLACEMENT = new RegExp(
  `\\b(${DAMAGE_TYPES.join("|")})\\b[\\s\\S]{0,40}?\\b(?:instead of|rather than|in place of)\\b[\\s\\S]{0,20}?\\b(${DAMAGE_TYPES.join("|")})\\b`,
  "i",
);

/**
 * A modal in front of the replacement makes it OPTIONAL — the caster may take either. Without
 * one the sentence is declarative and the replacement is total.
 */
const PERMISSIVE = /\b(?:can|may|could|option(?:al|ally)?|at your option)\b/i;

function typesIn(text: string): DamageType[] {
  const found = DAMAGE_TYPES.filter(t => new RegExp(`\\b${t}\\b`, "i").test(text));
  return [...new Set(found)];
}

export function readDamageTypeChoice(
  text: string | undefined,
  outcomeMode?: string,
): DamageTypeReading {
  // Healing never carries a damage type; offering one is noise on every healing spell.
  if (outcomeMode === "healing") {
    return { kind: "none", options: [], reason: "Healing — no damage type." };
  }

  const source = (text ?? "").trim();
  if (!source) return { kind: "none", options: [], reason: "No rules text to read." };

  const present = typesIn(source);
  if (present.length === 0) {
    return { kind: "none", options: [], reason: "No damage type named in the text." };
  }

  // "a type you choose" wins outright — it is the spell saying so in its own words.
  if (CHOICE_PHRASE.test(source)) {
    return {
      kind: "choice",
      primary: present[0],
      options: present,
      reason: `Text offers a choice — ${present.length} type${present.length === 1 ? "" : "s"} named.`,
    };
  }

  const replacement = source.match(REPLACEMENT);
  if (replacement) {
    const replacing = replacement[1].toLowerCase() as DamageType;
    const replaced = replacement[2].toLowerCase() as DamageType;
    // A modal ANYWHERE in the same sentence as the replacement makes it the caster's option.
    const sentence = source.slice(Math.max(0, replacement.index! - 80), replacement.index! + replacement[0].length);
    if (PERMISSIVE.test(sentence)) {
      return {
        kind: "choice",
        primary: replacing,
        options: [replacing, replaced],
        reason: `"${replacing} instead of ${replaced}", and the text says it is optional — either may be used.`,
      };
    }
    return {
      kind: "fixed",
      primary: replacing,
      options: [replacing],
      reason: `"${replacing} instead of ${replaced}" — a hard replacement, so ${replaced} is not available.`,
    };
  }

  return {
    kind: "fixed",
    primary: present[0],
    options: [present[0]],
    reason: present.length > 1
      ? `Several types named; using the first (${present[0]}). Set it by hand if that is wrong.`
      : `Single type named (${present[0]}).`,
  };
}
