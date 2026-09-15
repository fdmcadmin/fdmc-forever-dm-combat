/**
 * READ THE STAT BLOCK, SO NOBODY HAS TO TICK BOXES TO GET A CREATURE PRICED.
 *
 * Christopher, 2026-09-13: *"if i have to go in and check 10 different boxes to test a encounter then
 * how does this help others when they build their own creatures."* He is right. 0.8.50.2 and 0.8.51.0
 * added `attackWith`, `grantsAdvantage`, `rosterInteraction` and mark riders as fields only — so a
 * creature priced correctly ONLY if its author knew those boxes existed, and every creature anyone
 * else writes, and every stored copy of these ones, priced the old way: at 0.
 *
 * ⚠ THIS IS THE PARSER'S EXISTING RULE, NOT A NEW ONE: FIELD FIRST, THEN THE TEXT. `parseCreature`
 * already reads saves, DCs, target counts, conditions and forced movement out of the rules text when
 * the field is empty, and the workbook's own Parser Coverage Gate is a table of rules-text patterns →
 * pricing primitives. The boxes stay, as the override for a block worded some other way.
 *
 * ⚠ WHAT IS READ IS A RULES SENTENCE, NEVER A NAME. "Commanding Presence" says nothing; "that Action
 * must target the Knight" does. Every reader returns the phrase it matched, so the editor can show
 * exactly what it read and a wrong read is visible, not silent.
 */
import type { RosterInteraction } from "../monsters/rosterInteraction";
import type { MonsterRider } from "../monsters/monsterRider";

export type TextRead<T> = { value: T; evidence: string };

/**
 * One spelling for matching. Curly apostrophes and minus signs are the ones a pasted block carries;
 * "ft." and friends are abbreviations whose full stop would otherwise end a sentence early.
 */
function norm(text: string | undefined): string {
  return String(text ?? "")
    .replace(/[’‘`]/g, "'")
    .replace(/[−–—]/g, "-")
    .replace(/\b(ft|lb|in|min|hr|approx|e\.g|i\.e)\./gi, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const ROLLS = "(?:attack rolls|saving throws|ability checks)";
const ROLL_LIST = `(${ROLLS}(?:\\s*(?:,|,? and)\\s*${ROLLS})*)`;

/** "until the start of its next turn" is one turn; "lasts 2 turns" is two; a minute is ten rounds. */
function durationOf(t: string): number {
  const counted = t.match(/\blasts?\s+(?:for\s+)?(\d+)\s+(?:turns?|rounds?)\b/i);
  if (counted) return Number(counted[1]);
  if (/\buntil the (?:start|end) of (?:its|her|his|their|the [\w' -]{1,40}?'s) next turn\b/i.test(t)) return 1;
  if (/\b1 minute\b|\bconcentration\b/i.test(t)) return 10;
  return 1;
}

/**
 * The text with its ENDING clauses removed. Winter's Toll: "The area ends early if Harrow is Incapacitated"
 * names how the zone stops (BR080), not a condition it imposes; the Stormscar Ravager's Pin "ends early if
 * the Ravager … has the Incapacitated condition" takes no PC's turn. Read imposed conditions from what is left.
 */
export function withoutEndingClauses(text: string): string {
  return text.replace(/\b(ends?) (early )?(if|when) [^.;]*|\buntil [^.;]*\b(dies|is incapacitated|is killed)\b[^.;]*/gi, "");
}

const WHO_TURN = "(its|her|his|their|the [a-z' -]+'s)";

/**
 * THE v5 DURATION READERS — BR061 to BR082 — read off a rules sentence, each with the phrase it matched.
 *
 * ⚠ ONE READER, TWO CALLERS. The reader composition (`broadReaderGate`) shows these, and the pricer that
 * charges a PC's lost turns (`turnDenial`) prices from them — so the duration a DM sees on a clause is the
 * duration the checker charges.
 */
export function readDurationReaders(text: string | undefined): TextRead<string>[] {
  const t = norm(text).toLowerCase();
  const out: TextRead<string>[] = [];
  const take = (id: string, re: RegExp) => {
    const m = t.match(re);
    if (m && !out.some(r => r.value === id)) out.push({ value: id, evidence: m[0] });
    return Boolean(m);
  };
  const has = (id: string) => out.some(r => r.value === id);

  take("BR070", /\bconcentration\b/);
  take("BR071", /\bconcentration,? up to\b[^.]*/);
  take("BR061", /\binstantaneous\b/);
  /**
   * ⚠ "FOR THE REST OF THE TURN" IS BR061, AND IT WAS REPORTED AS A WORKBOOK GAP.
   *
   * 0.8.55.0 left Threshold Spear and Perimeter Strike NEEDS_INPUT with *"no v5 duration reader is
   * shorter than BR062/BR063"*. That skipped the shortest one v5 has. BR061 Instantaneous prices
   * *"P_ACTIVE_R = 0 after the resolving event; only immediate and explicit final effects contribute"*,
   * and a Speed of 0 that closes with the turn the hit lands in is exactly that: its whole value is
   * the movement it stops now, and nothing of it reaches any later turn. BR049's own alias says the
   * same from the other side — `speed_zero`: *"Set Speed to 0 for the printed window."* The window
   * is printed; it is this turn.
   *
   * Christopher, 2026-09-15: *"the v5 workbook should have covered well over 200+
   * action/bonus/reaction/spells."* It did. The reader list was not read to the end.
   */
  if (!has("BR061")) take("BR061", /\bfor the rest of (the|this|the current|that|its) (current )?turn\b/);
  // "until" or "before" — Larkskein's Advantage is spent "before the end of its next turn".
  if (!take("BR064", /\b(until|before) (the )?start of the target's next turn\b/)) {
    take("BR062", new RegExp(`\\b(until|before) (the )?start of ${WHO_TURN} next turn\\b`));
  }
  /**
   * ⚠ A STATE SCOPED TO THE TARGET'S OWN TURN IS BR065.
   *
   * The Velvet Host's Discourtesy: *"The target's speed is reduced by 10 ft. The first time it
   * willingly moves on its turn, it cannot take reactions until that movement ends."* The second
   * sentence is the window for both effects — everything the clause does happens "on its turn", and
   * the reaction lock ends inside that turn when the movement does. BR065 Until End of Target Next
   * Turn is the reader that bounds it.
   *
   * Narrow on purpose: it needs "the first time … on its turn", the shape that names a window. A bare
   * "The target can't take Reactions." still has no duration and stays NEEDS_INPUT — the gate's
   * mutation holds that line.
   */
  if (!has("BR065")) take("BR065", /\bthe first time (it|the target|that creature) [^.]*\bon its (next )?turn\b/);
  if (!take("BR065", /\b(until|before) (the )?end of the target's next turn\b/)) {
    take("BR063", new RegExp(`\\b(until|before) (the )?end of ${WHO_TURN} next turn\\b`));
  }
  if (!take("BR066", /\b(for |lasts? )(2|two) (turns|rounds)\b/)) {
    take("BR067", /\b(for |lasts? )(3|4|5|6|7|8|9|three|four|five|six|seven|eight|nine) (turns|rounds)\b/);
  }
  take("BR068", /\b(1|one) minute\b/);
  take("BR069", /\b(10 minutes|1 hour|8 hours|24 hours|\d+ days)\b/);
  take("BR075", /\brepeats? the saving throw at the start\b|\bat the start of each of its turns\b[^.]*\bsaving throw\b/);
  take("BR076", /\brepeats? the saving throw at the end\b|\bat the end of each of its turns\b[^.]*\bsaving throw\b/);
  if (!has("BR075") && !has("BR076")) take("BR077", /\brepeats? the saving throw\b/);
  take("BR078", /\bsecond (failure|failed)\b|\bfails (it )?again\b/);
  take("BR079", /\bends (early )?if [^.]*\btakes? damage\b|\buses? an action to wake\b/);
  take("BR080", /\bends (early )?if [^.]*\b(incapacitated|dies|is killed|leaves)\b|\buntil [^.]*\b(dies|is incapacitated)\b/);
  take("BR081", /\bwhile (it is |they are |it remains |the [a-z' -]+ (is|remains) )?(within|inside)\b|\bwhile [^.]*\bcan see\b|\btether/);
  take("BR082", /\bwhen the effect ends\b|\bat the end of the duration\b/);
  /**
   * ⚠ A MARK WITH NO PRINTED TIMER IS HELD BY ITS SOURCE — BR080, ENDING IN FE36.
   *
   * Brandwing's Calculated Angle *"targets one creature it can see within 90 feet and marks it"* and
   * names no duration. v5 does not leave that open: a designation is a source-held state, BR080 Ends
   * on Source Death / Incapacitation / Range Break bounds it, and FE36 Forced-Target / Mark State Ends
   * is the endpoint (*"Target-order/mark rule ends and normal targeting returns"*). Combat pricing
   * then caps it at the encounter horizon like every other long state.
   *
   * Only when nothing else gave a duration — a mark that DOES print a timer keeps that timer.
   */
  const timed = out.some(r => r.value !== "BR080");
  if (!timed && !has("BR080")) {
    const mark = t.match(/\bmarks (it|the target|that creature|a creature)\b|\bthe marked (target|creature)\b/);
    if (mark) out.push({ value: "BR080", evidence: `${mark[0]} — no printed timer, so the mark lasts while its source holds it` });
  }
  return out;
}

/** The zone this text names, if it names one of the creature's zone actions — "inside Winter's Toll". */
function zoneNamedIn(t: string, zoneNames: readonly string[]): string | undefined {
  const lower = t.toLowerCase();
  return [...zoneNames].sort((a, b) => b.length - a.length)
    .find(z => norm(z) && lower.includes(norm(z).toLowerCase()));
}

/**
 * What this action does to OTHER creatures, from its rules text.
 *
 *   roll_modifier_zone   "allies … gain a +3 bonus to attack rolls and saving throws" and/or
 *                        "hostile creatures … take a −3 penalty to attack rolls and saving throws"
 *   ally_extra_attack    "… one ally … to make one (normal/weapon) attack"
 *   forced_target_order  "… hostile creature … must target the Knight" / "must be included among its targets"
 *   target_substitution  "… moves that ally … no longer a legal target" / "becomes the target instead"
 */
export function readRosterInteraction(text: string | undefined, zoneNames: readonly string[] = []): TextRead<RosterInteraction> | undefined {
  const t = norm(text);
  if (!t) return undefined;

  const ally = t.match(new RegExp(`\\ballies\\b[^.]*?\\b(?:gain|gains|get|gets|have|has)\\s+a\\s+\\+?(\\d+)\\s+bonus\\s+to\\s+${ROLL_LIST}`, "i"));
  const hostile = t.match(new RegExp(`\\b(?:hostile creatures?|enem(?:y|ies)(?: creatures?)?)\\b[^.]*?\\b(?:take|takes|suffer|suffers|have|has)\\s+a\\s+-?(\\d+)\\s+penalty\\s+to\\s+${ROLL_LIST}`, "i"));
  if (ally || hostile) {
    const bonus = ally ? Number(ally[1]) : 0;
    const penalty = hostile ? -Math.abs(Number(hostile[1])) : 0;
    return {
      value: {
        kind: "roll_modifier_zone",
        ...(ally && /attack/i.test(ally[2]) ? { allyAttack: bonus } : {}),
        ...(ally && /saving/i.test(ally[2]) ? { allySave: bonus } : {}),
        ...(hostile && /attack/i.test(hostile[2]) ? { hostileAttack: penalty } : {}),
        ...(hostile && /saving/i.test(hostile[2]) ? { hostileSave: penalty } : {}),
        durationRounds: durationOf(t),
      },
      evidence: [ally?.[0], hostile?.[0]].filter(Boolean).join(" · "),
    };
  }

  const extra = t.match(/\b(?:one|an?|each)\s+(?:ally|allied creature|of (?:its|her|his|their) allies)\b[^.]*?\bto\s+make\s+(?:one|an?)\s+(?:(?:normal|weapon|melee|ranged)\s+)*attack\b/i);
  if (extra) {
    const requiresZone = zoneNamedIn(t, zoneNames);
    return { value: { kind: "ally_extra_attack", ...(requiresZone ? { requiresZone } : {}) }, evidence: extra[0] };
  }

  const forced = t.match(/\b(?:hostile creatures?|enem(?:y|ies))\b.*?\bmust\s+(?:target|attack)\s+(?:the\s+[\w' -]{1,40}?|it|him|her|them)\b|\bmust be included among (?:its|the) targets\b/i);
  if (forced && /\b(?:hostile|enem)/i.test(t)) {
    return { value: { kind: "forced_target_order" }, evidence: forced[0] };
  }

  const moved = t.match(/\bmoves?\s+that\s+ally\b[^.]*/i);
  const reassigned = t.match(/\bno longer a legal target\b|\bbecomes the (?:new )?target(?: of the attack)? instead\b/i);
  if (moved && reassigned) {
    const requiresZone = zoneNamedIn(t, zoneNames);
    return { value: { kind: "target_substitution", ...(requiresZone ? { requiresZone } : {}) }, evidence: `${moved[0]} · ${reassigned[0]}` };
  }
  return undefined;
}

/**
 * "…it makes one Shearing Cut attack against that creature." — the name must be one of THIS creature's
 * own actions, so the read is a match against stated data, not a guess at what an attack is called.
 */
export function readAttackWith(text: string | undefined, actionNames: readonly string[], selfName?: string): TextRead<string> | undefined {
  const t = norm(text);
  if (!t) return undefined;
  const names = actionNames
    .filter(n => n && norm(n).toLowerCase() !== norm(selfName).toLowerCase() && !/multiattack/i.test(n))
    .sort((a, b) => b.length - a.length);
  for (const name of names) {
    const hit = t.match(new RegExp(`\\bmakes?\\s+(?:one|an?|a single)\\s+${esc(norm(name))}\\s+attack\\b`, "i"));
    if (hit) return { value: name, evidence: hit[0] };
  }
  return undefined;
}

/**
 * "…the Knight has Advantage on attack rolls…" — Advantage on its OWN attacks. Not "attack rolls
 * against it have Advantage" (the cost, a different subject), and not "advantage on attack rolls
 * against a prone target" (a condition on someone else).
 */
export function readGrantsAdvantage(text: string | undefined): TextRead<"own-attacks"> | undefined {
  const t = norm(text);
  const hit = t.match(/\b(?:it|he|she|they|the\s+[\w' -]{1,40}?)\s+(?:has|have|gains?)\s+advantage\s+on\s+(?:(?:its|their|all)\s+)?(?:(?:melee|ranged|weapon|spell)\s+)*attack\s+rolls\b(?!\s+against)/i);
  return hit ? { value: "own-attacks", evidence: hit[0] } : undefined;
}

/**
 * CONCENTRATION AS THE DURATION — "Concentration", "Duration: Concentration, up to 1 minute",
 * "(Concentration)", "requires concentration".
 *
 * ⚠ NOT A SPELL THAT MENTIONS SOMEONE ELSE'S CONCENTRATION. "the target loses concentration" and
 * "breaks concentration" describe an effect on the target, and reading them as this creature's own
 * duration would end the creature's other spell on every use.
 */
export function readConcentration(text: string | undefined): TextRead<true> | undefined {
  const t = norm(text);
  if (!t) return undefined;
  if (/\b(?:loses?|lose|break|breaks|broken|ends?|disrupts?|interrupts?)\s+(?:its |their |the target's |that creature's )?concentration\b/i.test(t)
    && !/\bduration:\s*concentration\b/i.test(t)) return undefined;
  const hit = t.match(/\bduration:\s*concentration\b[^.]*|\brequires concentration\b|\(concentration(?:,[^)]*)?\)|(?:^|[.;:]\s*)concentration(?:\s*,?\s*up to\b[^.]*)?\s*(?:\.|$)/i);
  return hit ? { value: true, evidence: hit[0].replace(/^[.;:]\s*/, "").trim() } : undefined;
}

/**
 * A MARK'S PAYLOAD: "The first time Brandwing hits the marked target with Ember Lance, the target takes
 * an extra 7 (2d6) Psychic damage." One hit a turn at most, so it is a once-per-turn rider.
 *
 * ⚠ ONLY FOR AN ACTION WITH NO DAMAGE OF ITS OWN (the caller checks). On an attack that already has
 * dice the same sentence is usually CONDITIONAL — "against a frightened creature" — and a rider read
 * with no chance would bill it on every turn.
 */
export function readMarkRiders(text: string | undefined, featureName: string): TextRead<MonsterRider[]> | undefined {
  const t = norm(text);
  const hit = t.match(/\b(?:the first time|once per turn|once on each of its turns)\b[^.]*?\bhits?\b[^.]*?\b(?:takes?|deals?)\s+(?:an?\s+)?(?:extra|additional)\s+\d+\s+\((\d+d\d+(?:\s*[+-]\s*\d+)?)\)\s+([a-z]+)\s+damage\b/i);
  if (!hit) return undefined;
  const type = hit[2][0].toUpperCase() + hit[2].slice(1).toLowerCase();
  return {
    value: [{ name: featureName, damage: hit[1].replace(/\s+/g, ""), damageType: type, cadence: "once-per-turn" }],
    evidence: hit[0],
  };
}
