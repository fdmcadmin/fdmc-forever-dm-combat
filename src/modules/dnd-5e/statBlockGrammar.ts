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

import { DAMAGE_TYPES as DAMAGE_TYPES_CANONICAL } from "../../core/constants/damageTypes";

/**
 * ⚠ THE VOCABULARY IS NOT DEFINED HERE. `core/constants/damageTypes` has held it since the weapon
 * table needed it, and this file briefly kept a second capitalised copy — two lists for one
 * concept, which is the fault this whole change exists to remove. The canonical list is lowercase;
 * the SRD prints them capitalised, so that is a DISPLAY form derived from it, not another list.
 */
const CANONICAL = DAMAGE_TYPES_CANONICAL;
export const DAMAGE_TYPES = CANONICAL.map(t => t[0].toUpperCase() + t.slice(1)) as readonly string[];

export type DamageType = string;

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

const TYPE_ALT = CANONICAL.join("|");

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

const properType = (s: string): DamageType => {
  const hit = CANONICAL.find(t => t === s.toLowerCase());
  return hit ? hit[0].toUpperCase() + hit.slice(1) : "Bludgeoning";
};

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

/**
 * THE WHOLE PRINTED LINE, WRITTEN BACK OUT OF THE FIELDS.
 *
 * Christopher, 2026-08-31: *"it should read exactly how the SRD creatures do."* Right — and that
 * is the other half of the one-grammar rule. Parsing the SRD into fields is only worth doing if
 * the app can PRINT the same sentence back; otherwise moving the numbers out of the prose reads
 * as losing them, which is exactly how it looked.
 *
 * The shape is the SRD 5.2.1 block this file already parses:
 *
 *   Melee Attack Roll: +8, reach 5 ft. Hit: 13 (2d8 + 4) Cold damage.
 *   Dexterity Saving Throw: DC 18. Failure: 27 (6d8) Lightning damage.
 *
 * ⚠ THE AVERAGE IS SHOWN ONLY WHEN IT IS KNOWN. A template's damage may be `2d8 + @MAIN`, and
 * @MAIN is not resolved until a body is generated. Printing "0 (2d8 + @MAIN)" would state a
 * number the block does not have, so the average is omitted until the formula is arithmetic.
 *
 * ⚠ AND THE RIDER IS APPENDED, NEVER RE-PARSED. `text` holds only what is left once the mechanics
 * are fields — *"and lightning jumps from the target to one creature…"* — so it is added as
 * written.
 */
export function describeStatBlockAction(a: {
  roll?: string;
  damage?: string;
  damageType?: string | readonly string[];
  save?: string;
  range?: string;
  text?: string;
}): string {
  const parts: string[] = [];

  /**
   * "1d20 + 8" is how a roll is stored; the SRD prints the BONUS.
   *
   * ⚠ AND THE TERMS ARE SUMMED, because the bonus is authored as a FORMULA. Christopher,
   * 2026-08-31: *"the +X and dc X needs to still come from the creature's stats, not written into
   * the line … if a stat change you have to go into it and edit each instance."* Exactly — so an
   * attack is authored `1d20+@STR+@PROF`, and `resolveMonsterFormula` substitutes the creature's
   * own numbers to give `1d20 + 5+3`. Printing that verbatim would read "+5+3"; the SRD prints
   * "+8". Folding it here is what lets the STORED field stay a formula.
   */
  const rollTail = a.roll ? (a.roll.match(/1d20\s*(.*)$/i) ?? [])[1] : undefined;
  let bonusValue: number | undefined;
  if (rollTail !== undefined) {
    let sum = 0;
    let saw = false;
    for (const m of rollTail.matchAll(/([+-])?\s*(\d+)/g)) { sum += (m[1] === "-" ? -1 : 1) * Number(m[2]); saw = true; }
    if (saw) bonusValue = sum;
  }
  const bonus = bonusValue === undefined ? undefined : `${bonusValue < 0 ? "" : "+"}${bonusValue}`;
  // The range is printed with its own full stop ("reach 5 ft."), so adding one gives "ft..".
  const range = (a.range ?? "").trim().replace(/\.\s*$/, "");
  if (bonus) {
    const melee = /reach/i.test(range) || !range;
    parts.push(`${melee ? "Melee" : "Ranged"} Attack Roll: ${bonus}` + (range ? `, ${range}` : "") + ".");
  } else if (a.save) {
    // "DEX DC 15" -> "Dexterity Saving Throw: DC 15." A bare ability keeps its sentence and simply
    // has no DC to print — the authored field is short, and inventing one would state a number.
    const m = a.save.match(/\b(STR|DEX|CON|INT|WIS|CHA)\b\s*(?:DC\s*(\d+))?/i);
    const long: Record<string, string> = { str: "Strength", dex: "Dexterity", con: "Constitution",
      int: "Intelligence", wis: "Wisdom", cha: "Charisma" };
    parts.push(m
      ? `${long[m[1].toLowerCase()]} Saving Throw:${m[2] ? ` DC ${m[2]}` : ""}.`
      : `${a.save}.`);
  } else if (range) {
    parts.push(`${range}.`);
  }

  if (a.damage) {
    const types = Array.isArray(a.damageType) ? a.damageType : a.damageType ? [a.damageType] : [];
    const typeWords = types.map(t => String(t)[0].toUpperCase() + String(t).slice(1)).join(" and ");
    // `resolveMonsterFormula` substitutes into the string, so "2d8 + @MAIN" comes back as
    // "2d8 +5". Space the operators the way a printed block does.
    const tidy = a.damage.replace(/\s*([+-])\s*/g, " $1 ").replace(/\s{2,}/g, " ").trim();
    const average = averageOf(tidy);
    const dice = average === undefined ? `(${tidy})` : `${average} (${tidy})`;
    parts.push(`${bonus ? "Hit" : "Failure"}: ${dice}${typeWords ? ` ${typeWords}` : ""} damage.`);
  }

  const rider = (a.text ?? "").trim();
  if (rider) parts.push(rider);
  return parts.join(" ");
}

/** The printed average of a pure-dice formula, or undefined when it carries an @variable. */
function averageOf(formula: string): number | undefined {
  if (/@/.test(formula)) return undefined;
  let total = 0;
  let seen = false;
  for (const m of formula.matchAll(/([+-]?)\s*(?:(\d+)d(\d+)|(\d+))/g)) {
    const sign = m[1] === "-" ? -1 : 1;
    if (m[2]) { total += sign * Number(m[2]) * (Number(m[3]) + 1) / 2; seen = true; }
    else if (m[4]) { total += sign * Number(m[4]); seen = true; }
  }
  return seen ? Math.floor(total) : undefined;
}
