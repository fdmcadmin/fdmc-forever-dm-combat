/**
 * Reading a Multiattack's printed sequence size.
 *
 * ⚠ v7 PRICES MULTIATTACK, auto=YES: *"Resolve the printed legal sequence and sum the expected
 * values of its component attacks/actions. Alternatives are not added together."* It is not an
 * unknown and it must not default to one attack — a creature whose block says "makes three
 * attacks" priced at one is under-counted by two thirds of its offence.
 *
 * ⚠ RULE ZERO. These patterns already existed inside `MonsterJconScanner.inferMultiattackCount`,
 * unexported, so the checker could not reach them and defaulted to 1 instead. They are lifted here
 * verbatim and BOTH callers now use them — the scanner for its turn counter, the checker for its
 * Action budget. Writing a second copy in the checker would have let the two drift on what the
 * same sentence means.
 *
 * ⚠ THE TWO CALLERS WANT DIFFERENT FALLBACKS, so this returns `undefined` rather than guessing.
 * The scanner readies a 2-attack counter so the DM has a usable tracker at the table; the checker
 * must NOT invent a number — under `unknown_policy` an unreadable sequence is flagged, never
 * silently filled. Deciding that here would force one of them to be wrong.
 */

import { mentionsUnnegated } from "../text/negatedMention";

/** "two" → 2. Also accepts digits, and "twice" which prints as a word but means 2. */
export function parseSmallNumberWord(word: string | undefined): number | undefined {
  if (!word) return undefined;
  const words: Record<string, number> = {
    one: 1, twice: 2, thrice: 3, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  };
  const key = word.trim().toLowerCase();
  if (key in words) return words[key];
  const n = Number.parseInt(key, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

const MULTIATTACK_PATTERNS = [
  /\b(?:makes?|make)\s+(one|two|twice|three|four|five|six|\d+)\s+(?:[^.]{0,40}?\s)?attacks?\b/i,
  /\b(one|two|twice|three|four|five|six|\d+)\s+(?:melee|ranged|weapon|spell|claw|bite|slam|tentacle|attack)\s+attacks?\b/i,
  /\battacks?\s+(one|two|twice|three|four|five|six|\d+)\s+times?\b/i,
  /**
   * ⚠ A HOLE IN THE INHERITED SET, found by validation. The three patterns above all require a
   * noun after the count — "makes two ATTACKS", "two claw ATTACKS", "attacks two TIMES" — so the
   * commonest short form of all, *"It attacks twice with its claws"*, matched none of them and
   * returned undefined. "Twice" and "thrice" ARE the count; they need no following noun.
   */
  /\battacks?\s+(twice|thrice)\b/i,
];

/** Does this action's name or text make it the Multiattack? */
export function isMultiattackAction(name: string | undefined, text: string | undefined): boolean {
  return mentionsUnnegated(`${name ?? ""} ${text ?? ""}`, /multi\s*attack/i);
}

/**
 * The printed sequence size from a Multiattack's text, or `undefined` when it cannot be read.
 *
 * A named-component sequence ("makes two Claw attacks and one Bite") is counted by its NAMED
 * COMPONENTS when the caller supplies the action names, because that is the printed legal
 * sequence the contract asks for and it beats a bare number.
 */
export function multiattackCountFromText(
  text: string | undefined,
  namedComponents?: readonly string[],
): number | undefined {
  if (namedComponents?.length) return namedComponents.length;
  const t = text ?? "";
  if (!t) return undefined;
  for (const pattern of MULTIATTACK_PATTERNS) {
    const count = parseSmallNumberWord(t.match(pattern)?.[1]);
    if (count && count > 0) return count;
  }
  return undefined;
}
