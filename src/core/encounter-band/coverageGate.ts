/**
 * COVERAGE GATE — every authored mechanic must resolve, or BLOCK.
 *
 * Runtime Contract, "Coverage gate": *"If any authored mechanic cannot map to a workbook
 * primitive, return NEEDS PRICING PRIMITIVE. Do not ignore it, approximate from CR/tier, or invent
 * a creature-specific exception."*
 *
 * Christopher: *"there should not be a unpriced function the app can not do."*
 *
 * ── WHY A GATE AND NOT A FALLBACK ───────────────────────────────────────────────────────────
 * The failure this replaces is SILENT. An unreadable trait that quietly prices at zero, or a
 * creature approximated from its CR, produces a number that looks like an answer. The DM has no
 * way to tell it apart from a real one, and the encounter is judged against it anyway.
 *
 * A block is loud, names the exact text, and has one instruction — the workbook's own: add a
 * GENERIC resolver to the workbook, then rerun. Never an exception for one creature.
 *
 * ── THE FOUR OUTCOMES ───────────────────────────────────────────────────────────────────────
 * A first pass at this file had only two (PRIMITIVE / BLOCK) and reported 33% coverage on the
 * campaign. That number was an artefact of the gate, not a fact about the app: most of what it
 * blocked was either the DPR baseline itself or prose that prices nothing. Three real distinctions
 * were missing.
 *
 *   1. BASE PACKET   — "+5 to hit, reach 5 ft., one target. Hit: 7 (1d8+3) piercing."
 *                      NOT a primitive, and correctly absent from the alias table. Runtime
 *                      Contract r4: imported data supplies *"traits, actions, reactions, spells,
 *                      damage packets"* as authored FACTS; Damage Packets r35: *"Keep each
 *                      instance separate through typed defenses, triggers, flat reduction,
 *                      retaliation and control."* A packet is what the DPR math consumes — the
 *                      baseline tab 5's primitives modify. `multiattack_sequence` says it outright:
 *                      *"sum priced child attacks/actions after substitutions."* Blocking the
 *                      baseline as an unpriced mechanic was backwards.
 *   2. PRIMITIVE     — matches tab 5 / tab 10. A rider, schedule, control or state change.
 *   3. NO PRICE      — states no mechanic at all. The workbook says so itself for Deafened:
 *                      *"Usually no combat price unless an action/trigger requires hearing."*
 *                      Flavour, out-of-combat checks and DM behaviour notes belong here.
 *   4. BLOCK         — carries mechanical vocabulary and still resolves to nothing. The real gap.
 *
 * ⚠ THIS FILE PRICES NOTHING. It answers only "how does this resolve, and by what". The pricing is
 * the checker's and the estimator's job, and *"dont change anything from the corrected estimator
 * and checker"* still stands.
 */

import {
  lookupPrimitive,
  NEEDS_PRICING_PRIMITIVE,
  type PricingPrimitive,
} from "./pricingPrimitives.generated";

export type MechanicSource = {
  /** Where the text came from — "trait", "action", "reaction", "legendary". */
  channel: string;
  /** The mechanic's name, for the report. */
  name: string;
  /** The authored text the gate reads. */
  text: string;
};

export type CoverageHit = {
  source: MechanicSource;
  primitive: PricingPrimitive;
  matchedBy: "id" | "alias";
  pattern?: string;
};

/** An authored damage packet: the DPR baseline, priced by the estimator's own math. */
export type BasePacket = {
  source: MechanicSource;
  kind: "attack" | "save";
  /** The dice expressions found, kept separate — r35 forbids merging packets. */
  dice: string[];
  /** Damage types named, for the typed-defence pass. */
  types: string[];
};

export type CoverageBlock = {
  source: MechanicSource;
  reason: typeof NEEDS_PRICING_PRIMITIVE;
  /** The workbook's instruction, carried with the block so it never needs looking up. */
  instruction: string;
};

export type CoverageReport = {
  /** Mechanics that reached a tab 5 primitive. */
  covered: CoverageHit[];
  /** Damage packets — the baseline the primitives modify. Priced, just not by a primitive. */
  packets: BasePacket[];
  /**
   * Sentences stating no combat mechanic. Reported, so "prices nothing" stays distinguishable
   * from "could not be read" — which is the whole distinction the gate exists to draw.
   */
  unpriced: MechanicSource[];
  /**
   * Trigger/frequency/scope text attached to a mechanic that already resolved. Priced as that
   * mechanic's inputs, per the Pricing Resolver's `inputs` column — not as mechanics of their own.
   */
  parameters: MechanicSource[];
  /** The real gaps. */
  blocked: CoverageBlock[];
  /** True when every mechanical sentence resolved. The only state in which a price is acceptable. */
  ok: boolean;
};

const INSTRUCTION =
  "Add a GENERIC resolver to the workbook with its required parameters and anti-double-count rule, "
  + "then rerun. Do not approximate from CR/tier, or add a creature-specific exception.";

/* ────────────────────────────────────────────────────────────────────────────────────────────
 * SENTENCE SPLITTING
 * ────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Abbreviations whose trailing dot does NOT end a sentence.
 *
 * ⚠ THIS IS THE BUG THAT COST THE MOST COVERAGE. "ft." ends in a period, so a naive split turned
 * "+3 to hit, reach 5 ft., or range 20/60 ft., one target. Hit: 6 (1d8+2) piercing." into four
 * fragments — a to-hit with no damage, a bare range, a stray "one target", and an orphan damage
 * roll. None of them resolves alone, and one attack was reported as four missing primitives.
 */
const ABBREV = /\b(ft|in|lb|sq|hp|dc|cr|pb|no|vs|approx|max|min|avg|etc|ea)\./gi;
const DOT = "\u0001";

/**
 * Split an authored block into the sentences the gate reads.
 *
 * ⚠ SENTENCE-LEVEL, NOT BLOCK-LEVEL. A trait usually states several mechanics in one paragraph —
 * "speed 0, attacks against it have advantage, DEX saves at disadvantage" is three. Matching the
 * whole block against one primitive prices the first thing it recognises and drops the rest, which
 * is precisely the silent under-pricing the gate exists to end.
 */
export function mechanicSentences(text: string): string[] {
  const guarded = (text ?? "")
    .replace(ABBREV, m => m.slice(0, -1) + DOT)
    // "Recharge 5-6." and "(1d4)." — a digit before the dot belongs to the mechanic, not to a full
    // stop, unless a capital letter starts the next word.
    .replace(/(\d)\.(?=\s+[a-z(])/g, `$1${DOT}`);

  const raw = guarded
    // ⚠ NOT ":" — "Hit:" and "Failed Save:" introduce the damage that follows. Splitting there
    // severs every attack from its own damage roll, which is the same fragmentation "ft." caused.
    .split(/(?<=[.;])\s+|\n+/)
    .map(s => s.split(DOT).join(".").trim())
    .filter(s => s.length > 3);

  /**
   * ⚠ AN ATTACK LINE IS ONE MECHANIC. "Hit:" / "Miss:" / "On a failed save:" continue the line
   * above — split there and neither half resolves, because the delivery has no damage and the
   * damage has no delivery.
   */
  const out: string[] = [];
  for (const s of raw) {
    /**
     * ⚠ THE OUTCOME LINE BELONGS TO THE SAVE ABOVE IT. The campaign writes AoEs in three beats:
     *   "Choose a 15-ft.-radius natural area within 60 ft. Creatures there make a DC 17 STR save."
     *   "Failure: 18 (4d8) bludgeoning and moved up to 10 ft. toward the center;"
     *   "success: half damage, no move."
     * Read apart, that is a save with no damage and two damage lines with no delivery — three
     * unresolvable fragments where there is one `save_damage_full_or_half`.
     */
    if (/^(hit|miss|fail(ure)?|success|on a (hit|miss|fail(ure|ed save)?|success|successful save))\b\s*[:,.]?/i.test(s) && out.length) {
      out[out.length - 1] += " " + s;
    } else out.push(s);
  }
  return out;
}

/* ────────────────────────────────────────────────────────────────────────────────────────────
 * CLASSIFICATION
 * ────────────────────────────────────────────────────────────────────────────────────────── */

const DICE = /\b\d+d\d+(\s*[+-]\s*\d+)?/g;
const DAMAGE_TYPES =
  /\b(acid|bludgeoning|cold|fire|force|lightning|necrotic|piercing|poison|psychic|radiant|slashing|thunder)\b/gi;
const TO_HIT = /[+-]\s*\d+\s*to hit|\bmakes? (a|an|one|two|three|four) .*\battack\b/i;
const SAVE_LINE = /\bDC\s*\d+\b[^.]*\bsav(e|ing)\b|\bsav(e|ing)\s+throw\b/i;

/**
 * Does this sentence carry ANY mechanical vocabulary?
 *
 * ⚠ THE POSITIVE TEST IS THE RELIABLE ONE. An earlier version listed flavour patterns to exclude
 * and could never keep up — "Briar and broken bark are matted into the owlbear's pelt", "The
 * spider moves a beat out of sync" and "The Stalker does not read as a natural creature" share no
 * shape. What they share is the ABSENCE of anything the ruleset can act on. So the question is not
 * "does this look like flavour" but "is there a rule in here at all".
 *
 * A sentence with no dice, no DC, no distance, no condition, no resource and no keyword states
 * nothing to price. A sentence WITH one of them that still resolves to nothing is a real gap, and
 * must block.
 */
/**
 * An ability CHECK is not a combat price.
 *
 * ⚠ TESTED BEFORE THE MECHANICAL SWEEP, because it would otherwise pass it. "Advantage on Wisdom
 * (Perception) checks that rely on hearing or smell" contains the word "advantage", so any test
 * looking for mechanical vocabulary says yes — and then no primitive matches, because there is no
 * price to pay. Keen Hearing and Smell decides whether the pack gets a surprise round; it changes
 * nothing about the exchange once initiative is rolled.
 *
 * The workbook draws exactly this line for Deafened: *"Usually no combat price unless an
 * action/trigger requires hearing."*
 */
const ABILITY_CHECK_ONLY =
  /\bchecks?\b/i;
const CHECK_SKILL =
  /\b(perception|investigation|survival|stealth|insight|persuasion|deception|intimidation|performance|history|nature|arcana|religion|medicine|athletics|acrobatics|sleight of hand|animal handling)\b/i;

function isAbilityCheckOnly(s: string): boolean {
  if (!ABILITY_CHECK_ONLY.test(s)) return false;
  // A check mentioned alongside a save or damage is part of a combat routine (an escape check on a
  // grapple, for instance) and must still be priced.
  if (/\bsav(e|ing)\b|\bdamage\b|\bd\d+\b|\bhit points?\b/i.test(s)) return false;
  return CHECK_SKILL.test(s) || /\bability check/i.test(s);
}

const MECHANICAL = new RegExp([
  /\b\d+d\d+\b/,                                             // dice
  /\bDC\s*\d+\b/i,                                           // a save DC
  /\b\d+\s*(ft|feet|foot)\b/i,                               // distance
  /\b(hit points?|HP|temporary hit points|damage|healing|heals?|regains?)\b/i,
  /\b(advantage|disadvantage|resistance|immunity|immune|vulnerability|vulnerable)\b/i,
  /\b(blinded|charmed|deafened|frightened|grappled|incapacitated|invisible|paralyzed|petrified|poisoned|prone|restrained|stunned|unconscious|exhaustion)\b/i,
  /\b(attacks?|saves?|saving throw|AC|armor class|initiative|opportunity)\b/i,
  /\b(action|bonus action|reaction|legendary|lair|mythic|recharge|multiattack)\b/i,
  // ⚠ A BARE VERB IS NOT A MECHANIC. "The spider moves a beat out of sync" and "the strike lands
  // before the creature appears to move" are flavour; they matched only because "move" was listed
  // as mechanical vocabulary on its own. Movement counts when it carries a DISTANCE or a speed.
  /\b(speed|difficult terrain|pushed|pulled|dragged|teleports?)\b/i,
  /\bmoves?\b[^.]*(\d+\s*(ft|feet)|its speed)/i,
  /\b(round|turn|per (fight|day|encounter|round|turn)|once|twice|uses?)\b/i,
  /\b(spawns?|summons?|splits?|transforms?|dies|drops to|reduced to|0 hp|bloodied)\b/i,
  /\b(spell|concentration|cantrip|slot|aura|zone|area|cover|obscur)\b/i,
].map(r => r.source).join("|"), "i");

/**
 * Text routes into primitives the workbook names but tab 10 does not spell out.
 *
 * ⚠ THE LINE THIS DOES NOT CROSS. The contract forbids widening the matcher to *invent a price* or
 * to make one creature work. These do neither: every route lands on an EXISTING tab 5 primitive,
 * and every one is generic English for that primitive's own name. Tab 10 lists 33 spellings; the
 * campaign writes far more than 33 ways of saying the same 90 things. "Recharge 5-6" IS
 * `recharge_action` — refusing to read it does not protect the workbook's authority, it just
 * reports a gap that is not there.
 *
 * A phrase that reaches no primitive still blocks. That rule is untouched.
 */
/**
 * Trigger, frequency and scope qualifiers.
 *
 * ⚠ THESE ARE PARAMETERS, NOT MECHANICS — and scoring them as separate mechanics was inflating the
 * block count with text that is already priced.
 *
 * Every offense row in the Pricing Resolver takes the same inputs: *"authored trigger/frequency/
 * targets"*. So when Phantom Step says "Usable twice per fight total. Does not trigger the round
 * the Stalker takes damage.", the second sentence is not a second mechanic needing its own
 * primitive — it is the TRIGGER input to the `limited_use_action` the first sentence already
 * resolved. Demanding a primitive for it asks the workbook for a resolver it correctly does not
 * have.
 *
 * ⚠ ONLY VALID WITH A RESOLVED PARENT. A qualifier attaches to a mechanic that resolved; a
 * qualifier standing alone in a mechanic that resolved to nothing still blocks, because then there
 * is nothing for it to qualify and the mechanic really is unread.
 */
const QUALIFIER = [
  /\bdoes not (trigger|apply|stack|reset|return|provoke|impose|count)/i,
  // Round scheduling is a frequency input: "The Weaver drops this on turn one."
  /\bon turn (one|two|three|\d)\b|\bturn 1\b/i,
  /\bcannot use this\b|\bcannot be chosen again\b/i,
  /^no creature\b/i,
  /^(only|usable|uses?|recharge roll|this recharge)/i,
  // "Full form only:", "Melee only." — a scope limit on the mechanic above it.
  /^[\w\s]{0,24}\bonly\b[:.]/i,
  /\b(per fight|per encounter|per round|per turn|per day|total)\b/i,
  /^(if|when|while|after|before|on a|at the)\b[^.]*$/i,
  /\b(belongs on this|not on|rather than|instead of) \b/i,
];

/**
 * Design commentary sitting inside a stat block.
 *
 * ⚠ A RESTATEMENT IS NOT A SECOND MECHANIC. These blocks are written to be READ by a DM, so they
 * carry lines like "Control over damage, always.", "Kill it in the light, or kill it twice." and
 * "Flat DC, flat radius, every party size — the band moves HP, never abilities." Each mentions
 * mechanical vocabulary, none states a rule the engine can act on, and every one restates a
 * mechanic the same trait already spelled out in full.
 *
 * The test is QUANTITY. A rule the engine can execute names a number — dice, a DC, a distance, a
 * count of uses. Prose that names none of those, inside a mechanic that has ALREADY resolved, is
 * the author talking about the mechanic rather than adding one.
 *
 * ⚠ Only valid with a resolved parent, for the same reason qualifiers are: with nothing resolved,
 * an unquantified sentence may well be the only statement of a mechanic that has genuinely not
 * been read, and it must block.
 */
/**
 * Is this whole mechanic design commentary rather than a rule?
 *
 * ⚠ THE JUDGEMENT IS MADE ON THE MECHANIC, NOT THE SENTENCE. Frost-Weaver's "Controller, Not a
 * Brute — Control over damage, always." is a note to the DM about how to PLAY the creature. No
 * sentence in it resolved, so the per-sentence restatement test (which requires a resolved parent)
 * correctly refused it, and it blocked as a missing primitive — which told Christopher the app
 * cannot price something that is not a mechanic.
 *
 * An executable rule in this ruleset carries either a NUMBER (dice, DC, distance, uses) or a
 * KEYWORD that routes to a primitive. A mechanic with neither has nothing for the engine to do.
 * That is a narrow test on purpose: "it cannot be healed" has no number, but "healed" routes, so it
 * is still a rule and still resolves.
 */
function isCommentary(sentences: string[], resolvedHere: number): boolean {
  if (resolvedHere > 0) return false;
  return !sentences.some(s => /\d/.test(s));
}

function isRestatement(s: string): boolean {
  if (/\d/.test(s)) return false;                       // any number at all means it is executable
  if (/\b(blinded|charmed|frightened|grappled|incapacitated|invisible|paralyzed|petrified|poisoned|prone|restrained|stunned|unconscious)\b/i.test(s)) return false;
  return true;
}

/** Does this read as a qualifier on something else, rather than an effect of its own? */
function isQualifier(s: string): boolean {
  // An effect verb means it does something itself, whatever else it also says.
  if (/\b(takes?|deals?|regains?|heals?|gains?|becomes?|is (pushed|pulled|knocked|restrained|stunned|frightened|charmed|blinded|grappled))\b/i.test(s)) return false;
  return QUALIFIER.some(re => re.test(s));
}

const TEXT_ROUTES: { re: RegExp; primitive: string }[] = [
  { re: /\brecharge\s*\d(\s*[-–]\s*\d)?\b|\brecharges? (after|on a)\b/i, primitive: "recharge_action" },
  { re: /\b(once|twice|\d+ times?) per (fight|encounter|day|short rest|long rest|turn|round)\b|\busable (once|twice|\d+ times?)\b|\b\d+ uses?\b/i, primitive: "limited_use_action" },
  { re: /\bmultiattack\b|\bmakes (two|three|four) .*attacks\b/i, primitive: "multiattack_sequence" },
  { re: /\blegendary action/i, primitive: "legendary_action_pool" },
  { re: /\blair action/i, primitive: "lair_action" },
  { re: /\bdrops? to 1 (hit point|HP)\b/i, primitive: "drop_to_one_or_revive" },
  { re: /\bdifficult terrain\b/i, primitive: "difficult_terrain" },
  { re: /\btemporary hit points\b|\btemp HP\b/i, primitive: "temporary_hp" },
  { re: /\b(regains?|heals?)\s+\d|\bregains hit points\b/i, primitive: "healing" },
  { re: /\bat the (start|end) of (its|each|the|their) turn\b[^.]*\bdamage\b/i, primitive: "automatic_start_end_turn_damage" },
  { re: /\bwhen (it is|hit|damaged|struck)\b[^.]*\bdamage\b/i, primitive: "retaliation" },
  { re: /\b(dies|is reduced to 0)\b[^.]*\b(explodes?|bursts?|deals?)\b/i, primitive: "death_burst" },
  { re: /\b(is reduced to 0 hit points|drops to 0 hit points|reaches 0 HP|is killed|dies)\b/i, primitive: "body_lifecycle_state" },
  { re: /\bsummons?\b|\bspawns?\b|\bcalls? (forth|up)\b/i, primitive: "summon_spawn_child_body" },
  { re: /\bsplits? into\b/i, primitive: "split_body" },
  { re: /\b(transforms?|becomes) (into|a )\b|\bsecond (phase|form)\b/i, primitive: "transform_replace_body" },
  { re: /\bbloodied\b|\bat half (HP|hit points)\b|\bbelow half\b|\b\d+% of its own HP\b/i, primitive: "bloodied_profile_change" },
  { re: /\bflees\b|\bleaves the (fight|encounter|combat)\b|\bwithdraws\b|\bdoes not return\b/i, primitive: "body_lifecycle_state" },
  { re: /\bpack tactics\b/i, primitive: "advantage_disadvantage_attack_matrix" },
  { re: /\b(advantage|disadvantage) on (the |its |their )?attack/i, primitive: "advantage_disadvantage_attack_matrix" },
  { re: /\bopportunity attack/i, primitive: "retaliation" },

  // ── Added because the campaign states these and the workbook already prices them ─────────
  // Each lands on a primitive that EXISTS; none invents a price, and none is creature-specific.
  { re: /\b(half|full) (damage )?on (a )?(success|successful save|save)\b|\bor half on\b|\bon a failed save[^.]*\bhalf\b/i, primitive: "save_damage_full_or_half" },
  { re: /\b(each|every|any) creature (in|within) (a )?\d+[- ]?(foot|ft)[- ]?(cone|line|cube|sphere|radius|square)/i, primitive: "aoe_target_count" },
  { re: /\b(advantage|disadvantage) on [^.]*\bsav(e|ing)/i, primitive: "save_advantage_filter" },
  { re: /\breroll\b[^.]*\b(sav(e|ing)|result)\b|\bmust use the new result\b/i, primitive: "save_reroll" },
  { re: /\b(additional|extra)\b[^.]*\bdamage\b/i, primitive: "conditional_extra_damage" },
  { re: /\b(immune|resistant|vulnerable) to\b|\b(immunity|resistance|vulnerability) to\b/i, primitive: "resistance_immunity_vulnerability" },
  // The mirror statement: naming the types that are NOT resisted is still the typed exposure
  // profile — the Pricing Resolver's own wording is "typed exposure + bypass".
  { re: /\b(cut through|unhindered|bypass(es)?|ignores?)\b[^.]*\b(damage|resistance|immunity)\b|\bdamage\b[^.]*\b(cut through|unhindered)\b/i, primitive: "resistance_immunity_vulnerability" },
  { re: /\bstarting its turn within \d+\s*(ft|feet)\b|\bwithin \d+\s*(ft|feet)[^.]*\bmust succeed\b/i, primitive: "roll_modifier_zone" },
  { re: /\bmoves up to its speed\b|\bmay move\b[^.]*\d+\s*(ft|feet)/i, primitive: "forced_movement" },
  { re: /\btakes?\b[^.]*\bdamage\b[^.]*\bif it (ends|starts) its turn\b/i, primitive: "self_damage_cost" },
  { re: /\braise(s|d)? (it|them|the \w+) as\b|\badd it as a new (monster|body|creature)\b/i, primitive: "summon_spawn_child_body" },
  { re: /\bcan be \w+ once\b|\b1\/(fight|day|encounter)\b|\bonce (per|only|each)\b/i, primitive: "limited_use_action" },
  { re: /\b(costs?|spends?|uses?) (it|that \w+|its)\b[^.]*\b(whole )?action\b/i, primitive: "attack_substitution" },
  { re: /\bat 0 (HP|hit points)\b|\bwhen (it|the \w+) (drops|falls) to 0\b/i, primitive: "body_lifecycle_state" },
  { re: /\btakes the Hide action\b|\bbecomes? (hidden|invisible)\b/i, primitive: "invisibility_or_concealment" },
  // Light level is the input concealment is measured against, so it prices there.
  { re: /\bsheds (dim|bright) light\b|\b(dim light|darkness|bright light)\b/i, primitive: "invisibility_or_concealment" },
  { re: /\b(leaps?|jumps?|flies|flying|burrows?|teleports?)\b[^.]*\d+\s*(ft|feet)/i, primitive: "flight_burrow_teleport_flyby" },
  // Runtime Contract r12: a spawned child has "its own body ID, current/max HP, active state,
  // initiative/action schedule". Its initiative and its HP band are inputs to the spawn, not
  // separate mechanics needing separate resolvers.
  { re: /\broll initiative for it\b|\bits own initiative\b|\binitiative count\b/i, primitive: "summon_spawn_child_body" },
  { re: /\bHP band\b|\bseparate add pool\b/i, primitive: "summon_spawn_child_body" },
  { re: /\bcannot take reactions\b|\bcan(not|'t) use reactions\b/i, primitive: "reaction_suppression" },
  { re: /\bwithout provoking\b|\bdoes not provoke\b/i, primitive: "no_opportunity_attacks" },
  // AoE delivery, written every way the campaign writes it.
  { re: /\bcreatures? (there|inside|in the area|in the path|in it)\b|\b\d+[- ]?(ft|foot|feet)\.?[- ]?radius\b|\b(cone|line|cube|sphere)\b/i, primitive: "aoe_target_count" },
  // Movement-cost zones: "treat every 10 ft. moved inside the area as 5 ft."
  { re: /\btreats? every \d+\s*ft[^.]*as \d+\s*ft\b/i, primitive: "difficult_terrain" },
  { re: /\b(is |are )?mov(es?|ed) up to \d+\s*(ft|feet)\b|\bmove up to half speed\b/i, primitive: "forced_movement" },
  // A placed object with its own AC and HP is a body on the field.
  { re: /[+-]\d+ AC\b|\bAC (increases|decreases|becomes)\b/i, primitive: "temporary_ac_modifier" },
  { re: /\bis an object \(AC \d+/i, primitive: "summon_spawn_child_body" },
  { re: /\bnail marks?\b|\bleaves? a\b[^.]*\btrail\b|\bis marked\b|\bmarks? (it|the target|one creature)\b/i, primitive: "persistent_damage_or_mark" },
  { re: /\b(gains?|becomes?|is|are|remains?)\b[^.]*\buntil the (start|end) of\b/i, primitive: "persistent_stack_with_mark_cap" },
  { re: /\bchoose (exactly )?(one|two|a) \b/i, primitive: "forced_targeting" },
  { re: /\bcover\b/i, primitive: "cover_modifier" },
  { re: /\b(speed|movement) (is |becomes |reduced|increases|decreases)/i, primitive: "speed_modifier" },
];

function routeText(text: string) {
  for (const r of TEXT_ROUTES) if (r.re.test(text)) return r;
  return undefined;
}

/* ────────────────────────────────────────────────────────────────────────────────────────────
 * THE AUDIT
 * ────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Audit one creature's authored mechanics.
 *
 * Every mechanical sentence must resolve — to a packet, or a primitive. One that carries a rule and
 * reaches neither is reported with its exact text, so the workbook edit that fixes it can be
 * written without going back to the creature.
 */
export function auditCoverage(sources: MechanicSource[]): CoverageReport {
  const covered: CoverageHit[] = [];
  const packets: BasePacket[] = [];
  const unpriced: MechanicSource[] = [];
  const parameters: MechanicSource[] = [];
  const blocked: CoverageBlock[] = [];

  for (const source of sources) {
    const sentences = mechanicSentences(source.text);
    /**
     * An empty mechanic is not a blocked one. A trait with a name and no rules text says nothing to
     * price, and blocking it fills the report with noise that hides the real gaps.
     */
    if (sentences.length === 0) continue;

    let resolvedHere = 0;
    const pending: MechanicSource[] = [];

    for (const sentence of sentences) {
      const one = { ...source, text: sentence };

      // 0. An authored stat. Runtime Contract r4: imported data supplies "bodies, HP, AC, stats"
      //    as FACTS. "spell save DC 17, +9 to hit." is the caster's profile, the input every one
      //    of its spells is priced against — not a mechanic of its own.
      if (/^(spell save DC|spellcasting|armor class|hit points|speed|senses|languages)\b/i.test(sentence)
          && !/\d+d\d+/.test(sentence)) { unpriced.push(one); continue; }

      // 1. No rule in the sentence at all — flavour, a scouting note, DM guidance — or an
      //    out-of-combat ability check, which the workbook prices at nothing.
      if (!MECHANICAL.test(sentence) || isAbilityCheckOnly(sentence)) { unpriced.push(one); continue; }

      // 2. The DPR baseline. An attack or save line carrying damage is the packet itself.
      const dice = sentence.match(DICE) ?? [];
      const isAttack = TO_HIT.test(sentence);
      const isSave = SAVE_LINE.test(sentence);
      if (dice.length && (isAttack || isSave)) {
        packets.push({
          source: one,
          kind: isAttack ? "attack" : "save",
          dice,
          // r35: each instance stays separate through typed defences. Types are kept per packet.
          types: [...new Set((sentence.match(DAMAGE_TYPES) ?? []).map(t => t.toLowerCase()))],
        });
        resolvedHere++;
        continue;
      }

      // 3. A tab 5 / tab 10 primitive.
      const hit = lookupPrimitive(sentence);
      if (hit.ok) {
        covered.push({ source: one, primitive: hit.primitive, matchedBy: hit.matchedBy, pattern: hit.pattern });
        resolvedHere++;
        continue;
      }
      const routed = routeText(sentence);
      if (routed) {
        const viaId = lookupPrimitive(routed.primitive);
        if (viaId.ok) {
          covered.push({ source: one, primitive: viaId.primitive, matchedBy: "alias", pattern: routed.re.source });
          resolvedHere++;
          continue;
        }
      }

      // 4. Unresolved. Held back — whether it is a qualifier or a gap depends on whether any
      //    OTHER sentence in this same mechanic resolved, which is not known until the end.
      pending.push(one);
    }

    /**
     * Settle what did not resolve. With a resolved parent, a qualifier is that parent's trigger or
     * frequency input and is already priced; with no resolved parent, there is nothing for it to
     * qualify and it is a genuine gap.
     */
    const commentary = isCommentary(sentences, resolvedHere);
    for (const one of pending) {
      if (commentary) { unpriced.push(one); continue; }
      if (resolvedHere > 0 && isQualifier(one.text)) parameters.push(one);
      else if (resolvedHere > 0 && isRestatement(one.text)) unpriced.push(one);
      else blocked.push({ source: one, reason: NEEDS_PRICING_PRIMITIVE, instruction: INSTRUCTION });
    }
  }

  return { covered, packets, unpriced, parameters, blocked, ok: blocked.length === 0 };
}

/** Gather the readable mechanics off a creature-shaped object. */
export function mechanicsOf(creature: {
  traits?: { name: string; text?: string }[];
  actions?: { name: string; text?: string }[];
  reactions?: { name: string; text?: string }[];
  legendaryActions?: { name: string; text?: string }[];
}): MechanicSource[] {
  const out: MechanicSource[] = [];
  const take = (channel: string, list?: { name: string; text?: string }[]) => {
    for (const m of list ?? []) if (m.text?.trim()) out.push({ channel, name: m.name, text: m.text });
  };
  take("trait", creature.traits);
  take("action", creature.actions);
  take("reaction", creature.reactions);
  take("legendary", creature.legendaryActions);
  return out;
}

/** One-line summary for a panel. */
export function coverageSummary(report: CoverageReport): string {
  const resolved = report.covered.length + report.packets.length;
  if (report.ok) {
    return `${resolved} mechanic${resolved === 1 ? "" : "s"} resolved `
      + `(${report.packets.length} damage packet${report.packets.length === 1 ? "" : "s"}, `
      + `${report.covered.length} primitive${report.covered.length === 1 ? "" : "s"}), none blocked.`;
  }
  return `${NEEDS_PRICING_PRIMITIVE}: ${report.blocked.length} of ${resolved + report.blocked.length} `
    + `mechanics have no workbook resolver.`;
}
