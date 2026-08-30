/**
 * THE ONE WAY THE APP READS A STAT BLOCK — SRD 5.2.1 (2024) phrasing.
 *
 * Christopher, 2026-08-28: *"using the SRD language make sure the BC library follows the style of
 * it so the app only has to know how to read one way, and the text for something like claw
 * shouldnt have to read hit: do X damage, it should just say on hit this is the damage it does and
 * the type."*
 *
 * Two rules follow, and they are the whole design:
 *
 * 1. **ONE GRAMMAR.** The SRD's 2024 wording is the standard, and the campaign is written to match.
 *    Two dialects means two readers, and the second one is always the one that is wrong — MASTER
 *    records that pattern under RULE 0 more than once. Before this, the SRD said
 *    *"Melee Attack Roll: +7 ... Hit: 14 (2d8 + 5) Slashing damage"* while the Broken Chain said
 *    *"+6 to hit ... Hit: 11 (2d6 + 4) slashing"*, and nothing could read both.
 *
 * 2. **THE NUMBERS ARE FIELDS, NOT PROSE.** `damage` and `damageType` are structured, so the app
 *    RENDERS "on hit: 2d6 + 4 Slashing" rather than reading it back out of a sentence. What is left
 *    in `text` is the part a sentence is actually for — the rider: *"If the target is a Medium or
 *    smaller creature, it has the Prone condition."*
 *
 * ⚠ A PARSER IS NOT AN AUTHORING FORMAT. This reads the SRD because the SRD is what we were given.
 * Campaign content is AUTHORED in the fields directly; it never round-trips through prose.
 */

/** The damage types the 2024 stat blocks use, capitalised as they are printed. */
export const DAMAGE_TYPES = [
  "Acid", "Bludgeoning", "Cold", "Fire", "Force", "Lightning", "Necrotic",
  "Piercing", "Poison", "Psychic", "Radiant", "Slashing", "Thunder",
] as const;

export type DamageType = (typeof DAMAGE_TYPES)[number];

const ABILITY_BY_NAME: Record<string, string> = {
  Strength: "STR", Dexterity: "DEX", Constitution: "CON",
  Intelligence: "INT", Wisdom: "WIS", Charisma: "CHA",
};

export type ParsedClause = {
  /** "1d20 + 7" when the block prints an attack roll. */
  roll?: string;
  /** The dice only: "2d8 + 5". Never the printed average — that is derived, not authored. */
  damage?: string;
  /** Capitalised as the SRD prints it. */
  damageType?: DamageType;
  /** "DEX DC 15", in the app's own short form. */
  save?: string;
  /** Reach or range, as printed: "reach 5 ft.", "range 150/600 ft.". */
  range?: string;
  /**
   * What is LEFT once the mechanics are fields — the rider, and nothing else. Empty when the
   * clause said only "hit for this much of this type", which is the common case.
   */
  text: string;
};

/**
 * ⚠ THE PDF TEXT LAYER BREAKS WORDS ACROSS A COLUMN AND LEAVES THE PAGE FOOTER IN THE PROSE.
 * "es - cape DC 14", "condi - tion", and a trailing "System Reference Document 5.2.1 363". None of
 * that is content, and all of it would otherwise be shown to a DM as if the stat block said it.
 */
export function cleanStatBlockText(raw: string): string {
  return raw
    .replace(/System Reference Document 5\.2\.1\s*\d*/g, "")
    .replace(/(\w)\s+-\s+(\w)/g, "$1$2")     // "es - cape" -> "escape"
    .replace(/\s*\n\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const TYPE_ALT = DAMAGE_TYPES.join("|");

/** "Hit: 14 (2d8 + 5) Slashing damage." / "Failure: 10 (3d6) Psychic damage." */
const DAMAGE_RE = new RegExp(
  `(?:Hit|Failure(?: or Success)?)\\s*:\\s*\\d+\\s*\\(([^)]+)\\)\\s*(${TYPE_ALT})\\s*damage\\s*\\.?`,
  "i",
);
/** Some lines print dice with no average: "Hit: 2d6 Fire damage." */
const DAMAGE_NO_AVG_RE = new RegExp(
  `(?:Hit|Failure(?: or Success)?)\\s*:\\s*(\\d+d\\d+(?:\\s*[+-]\\s*\\d+)?)\\s*(${TYPE_ALT})\\s*damage\\s*\\.?`,
  "i",
);
const ATTACK_RE = /(?:Melee|Ranged|Melee or Ranged)\s+Attack\s+Roll\s*:\s*([+-]?\d+)\s*,?\s*/i;
const SAVE_RE = /(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+Saving\s+Throw\s*:\s*DC\s*(\d+)\s*,?\s*/i;
const RANGE_RE = /\b(reach\s+\d+\s*ft\.?|range\s+\d+(?:\/\d+)?\s*ft\.?)/i;

const properType = (s: string): DamageType =>
  (DAMAGE_TYPES.find(t => t.toLowerCase() === s.toLowerCase()) ?? "Bludgeoning");

/**
 * Read one printed clause into fields.
 *
 * ⚠ EVERY MECHANICAL PHRASE IS REMOVED FROM `text` AS IT IS CAPTURED. That is what stops the app
 * saying the same thing twice — once as a number it can use and once as a sentence it cannot.
 */
export function parseStatBlockClause(raw: string): ParsedClause {
  let text = cleanStatBlockText(raw ?? "");
  const out: ParsedClause = { text: "" };

  const atk = text.match(ATTACK_RE);
  if (atk) {
    out.roll = `1d20 + ${Number(atk[1])}`;
    text = text.replace(ATTACK_RE, "");
  }

  const save = text.match(SAVE_RE);
  if (save) {
    out.save = `${ABILITY_BY_NAME[save[1]]} DC ${save[2]}`;
    text = text.replace(SAVE_RE, "");
  }

  const range = text.match(RANGE_RE);
  if (range) {
    out.range = range[1].replace(/\s+/g, " ");
    text = text.replace(RANGE_RE, "");
  }

  const dmg = text.match(DAMAGE_RE) ?? text.match(DAMAGE_NO_AVG_RE);
  if (dmg) {
    out.damage = dmg[1].replace(/\s+/g, " ").trim();
    out.damageType = properType(dmg[2]);
    text = text.replace(dmg[0], "");
  }

  // "Success: Half damage" is the default for a save that deals damage; it carries no rider.
  text = text.replace(/Success\s*:\s*Half damage\s*\.?/i, "");

  out.text = text.replace(/^[\s,.;]+/, "").replace(/\s{2,}/g, " ").trim();
  return out;
}

/**
 * How the app SAYS a damage line, from the fields. One place, so every surface phrases it alike.
 *
 * This is the counterpart to the parser: nothing renders "Hit: X" from prose, because no prose
 * carries it any more.
 */
export function describeDamage(damage?: string, damageType?: DamageType): string {
  if (!damage) return "";
  return damageType ? `${damage} ${damageType}` : damage;
}
