/**
 * damageTypeVisuals — one place that maps a D&D damage type to its colour + icon, so a
 * damage chip reads at a glance which kind of harm it does (cold vs necrotic vs fire…).
 *
 * Shared by the monster card and the PC card. Add a type here and every chip picks it up.
 */

export type DamageTypeVisual = { color: string; icon: string };

const DEFAULT_VISUAL: DamageTypeVisual = { color: "#e07b39", icon: "💥" };

// Keyed by the lowercase damage-type word as it appears in rules text.
const DAMAGE_TYPE_VISUALS: Record<string, DamageTypeVisual> = {
  cold: { color: "#5aa0e0", icon: "❄" },
  fire: { color: "#e8703a", icon: "🔥" },
  necrotic: { color: "#9d6bd0", icon: "💀" },
  radiant: { color: "#f0c040", icon: "☀" },
  lightning: { color: "#6fc8e6", icon: "⚡" },
  thunder: { color: "#b0a0e6", icon: "🔊" },
  acid: { color: "#7fce7a", icon: "🧪" },
  poison: { color: "#8fbf47", icon: "☠" },
  psychic: { color: "#e07bc4", icon: "🧠" },
  force: { color: "#b7b7ff", icon: "✨" },
  // physical types share one look — the weapon icon
  slashing: { color: "#b9ad9c", icon: "⚔" },
  piercing: { color: "#b9ad9c", icon: "🗡" },
  bludgeoning: { color: "#b9ad9c", icon: "🔨" },
  healing: { color: "#57c07a", icon: "➕" },
};

/** Look up a type's colour + icon; unknown/untyped falls back to the neutral 💥. */
export function damageTypeVisual(type?: string): DamageTypeVisual {
  if (!type) return DEFAULT_VISUAL;
  return DAMAGE_TYPE_VISUALS[type.trim().toLowerCase()] ?? DEFAULT_VISUAL;
}

export type TypedDamageComponent = { dice: string; type?: string };

/**
 * Split a damage line into typed components for coloured chips.
 *
 * The dice string alone ("2d8 + 3 + 1d8") carries no types, so the rules TEXT is the source:
 * it reliably writes "(2d8 + 3) cold plus 4 (1d8) necrotic". We pair each parenthetical that
 * contains dice with the type word that follows it, and show just the die (2d8, 1d8) — flat
 * modifiers are dropped from the chip, matching the mockup.
 *
 * Falls back to a single untyped chip (the raw damage) when the text can't be parsed, so a
 * chip is never lost.
 */
export function splitTypedDamage(
  damage?: string,
  text?: string,
  /** One type, or the two an Elemental Mirror deals on a single roll. */
  damageType?: string | readonly string[],
): TypedDamageComponent[] {
  const raw = (damage ?? "").trim();
  if (!raw) return [];

  /**
   * ⚠ THE FIELD FIRST, AND THE TEXT ONLY AS A FALLBACK — the comment above is now HALF WRONG.
   *
   * It said the rules TEXT is the source because the dice string carries no types, and that WAS
   * true. The 0.8.9.x one-grammar pass then moved the type into the structured `damageType` field
   * and deleted the "Hit: 9 (2d6 + 4) slashing damage." prose that had been saying it twice — so
   * this parser was left reading a sentence that no longer contains the answer, and every migrated
   * monster action lost its coloured type chip at the table.
   *
   * Christopher, 2026-08-31: *"the damage type comes from the text, why did we change the design
   * from the PC model when using the monster model."* The PC model was never changed: an actor
   * action has had a `damageType` control all along and `ActorCard` composes the line from the
   * fields. The monster half moved its DATA and left both its card and its editor reading prose.
   * This is the card half.
   *
   * Two types on one roll — the Elemental Mirror's *"stay duel typing for the possible resist
   * windows"* — are written in the one field and split here, so the chips keep showing both.
   */
  // An array is the authored shape for two types on one roll; a string still splits on "and", "/"
  // and "+" so a hand-typed "Cold and Necrotic" is read the same way.
  const stated = Array.isArray(damageType)
    ? damageType.map(t => String(t))
    : String(damageType ?? "").split(/\s*(?:\band\b|\+|\/|,)\s*/i);
  {
    const known = stated.map(t => t.trim().toLowerCase()).filter(t => t && t in DAMAGE_TYPE_VISUALS);
    if (known.length) {
      const dice = raw.match(/\d+d\d+/g) ?? [];
      // One type: the whole line is that type. Two: pair them with the dice in order, and when
      // there is only one die both types ride it — which is what "one roll, two types" means.
      if (known.length === 1) return [{ dice: raw, type: known[0] }];
      return known.map((t, i) => ({ dice: dice[i] ?? dice[0] ?? raw, type: t }));
    }
  }

  const components: TypedDamageComponent[] = [];
  if (text) {
    // "(<dice…>) <type>" — the parenthetical must contain at least one NdM die.
    const re = /\(([^)]*\d+d\d+[^)]*)\)\s*([a-zA-Z]+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const die = (m[1].match(/\d+d\d+/) ?? [])[0];
      const type = m[2].toLowerCase();
      if (die && damageTypeVisual(type) !== undefined && type in DAMAGE_TYPE_VISUALS) {
        components.push({ dice: die, type });
      }
    }
  }

  // Only trust the parse if it accounts for every die in the damage string; otherwise the
  // text and the formula disagree and a single raw chip is safer than a partial one.
  const diceInDamage = raw.match(/\d+d\d+/g) ?? [];
  const parsedDice = components.map(c => c.dice);
  const coversAll = diceInDamage.length > 0 && diceInDamage.every(d => parsedDice.includes(d));
  if (components.length > 0 && coversAll) return components;

  return [{ dice: raw }];
}
