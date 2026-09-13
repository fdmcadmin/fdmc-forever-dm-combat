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
