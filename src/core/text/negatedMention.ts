/**
 * Does a stat block MEAN a term, or merely mention it while denying it?
 *
 * ⚠ THIS BUG HAS NOW BEEN WRITTEN TWICE, WHICH IS WHY IT LIVES IN ONE PLACE.
 *
 *   1. Conditions. Pack Tactics reads *"…if that ally isn't incapacitated"*, and a bare word match
 *      tagged every Thornfang Wolf as IMPOSING Incapacitated — a condition that zeroes damage. The
 *      trait that grants them advantage would have deleted their offence instead.
 *   2. Multiattack. The Frozen Husk reads *"Its only attack — no multiattack, no rider."* A bare
 *      match flagged it as having an unreadable Multiattack and told the DM to go fix a creature
 *      that was already correct.
 *
 * Same failure, two functions, caught only because both were run against the live library. Writing
 * the guard a third time is how it comes back, so callers import this.
 *
 * ⚠ IT IS DELIBERATELY CONSERVATIVE. It only looks BACKWARDS from the match, within one clause —
 * so "no multiattack" is caught while "the target is restrained" is untouched, and a negation in a
 * previous sentence cannot mask a real statement in this one. A guard that reached further would
 * start swallowing genuine mechanics, which is worse than the thing it prevents.
 */

/** Words that flip the sense of a term appearing shortly after them. */
const NEGATORS = /\b(?:isn'?t|aren'?t|not|no|none|never|non|no longer|without|unless|lacks?|immune to|immunity to|ends? if|already)\b[^.;]{0,20}$/i;

/**
 * True when the text contains AT LEAST ONE occurrence of `term` that is not negated.
 *
 * ⚠ THIS IS THE PRIMARY FUNCTION AND THE ONLY ONE WITH UNAMBIGUOUS SEMANTICS. A first version
 * expressed the logic as "is every mention negated?", which reads fine until the term does not
 * appear at all — an empty set is vacuously all-negated, so the inverse said the text asserted a
 * term it never contained. Every condition in the table came back as imposed by every action. The
 * validation script caught it immediately; the lesson is that the absent case is the one to state
 * first, not the one to leave implied.
 */
export function mentionsUnnegated(text: string | undefined, term: RegExp | string): boolean {
  const t = text ?? "";
  if (!t) return false;
  const pattern = typeof term === "string"
    ? new RegExp(`\\b${term}\\b`, "gi")
    : new RegExp(term.source, term.flags.includes("g") ? term.flags : `${term.flags}g`);
  for (const match of t.matchAll(pattern)) {
    const before = t.slice(Math.max(0, match.index - 40), match.index);
    if (!NEGATORS.test(before)) return true;
  }
  return false;
}

/**
 * True when the term appears and EVERY occurrence is negated — "no multiattack", "isn't
 * incapacitated". A term that never appears is not a negated mention, it is simply absent.
 */
export function isOnlyNegatedMention(text: string | undefined, term: RegExp | string): boolean {
  const t = text ?? "";
  if (!t) return false;
  const pattern = typeof term === "string"
    ? new RegExp(`\\b${term}\\b`, "gi")
    : new RegExp(term.source, term.flags.includes("g") ? term.flags : `${term.flags}g`);
  const appears = [...t.matchAll(pattern)].length > 0;
  return appears && !mentionsUnnegated(t, term);
}
