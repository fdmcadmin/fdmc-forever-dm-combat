/**
 * THE v5 READER GATE — every authored clause as a composition of broad readers.
 *
 * Christopher, 2026-09-13, on the v5 pricer: *"Reader layer first."* v5 changes no Act 3 number. What it
 * changes is how a creature is READ: "An authored effect is composed from as many readers as it needs:
 * resolution + targeting + damage/control + duration + action/resource + final state."
 *
 * The rules this file enforces are the workbook's Runtime Contract:
 *
 *   r34  parse order — Resolution → Targeting → Damage/Control → Duration/Concentration →
 *        Action/Resource → Special Body/System → Final Effect
 *   r35  "Any non-instant state must select a duration reader. Missing duration is NEEDS_INPUT."
 *   r36  "Any duration/staged state must select an endpoint/final-effect result, even if the result is
 *        simply CLEAN EXPIRATION."
 *   r41  "If no reader composition represents a clause, return NEEDS_INPUT."
 *
 * ⚠ THIS FILE PRICES NOTHING. Like `coverageGate.ts` it answers "how does this resolve, and by what" —
 * the chosen scope was the reader layer, with no price moving.
 *
 * ⚠ FIELDS FIRST, THEN THE RULES SENTENCE — the parser's rule. A roll IS BR001; a save with half on
 * success IS BR003; the economy field IS BR083/84/85. The text cues below are the workbook's own
 * "Detection Cues" column written as patterns, and add what fields cannot say: durations, conditions,
 * movement, target filters, endpoints. Every reader carries the evidence it was chosen on.
 *
 * r41 is judged per SENTENCE: `coverageGate.auditCoverage` names the sentences no pricing primitive
 * routes, and a sentence stays NEEDS_INPUT only if the reader cues cannot compose it either — one detector
 * for "a sentence nothing represents", not two that disagree.
 */
import {
  BROAD_READERS, FINAL_EFFECTS, READER_FAMILIES, PRIMITIVE_READER_ALIASES, READER_COMPOSITIONS, READER_VARIABLES,
} from "./broadReaders.generated";
import { parseCreature } from "./parseCreature";
import type { ParsedFeature } from "./featureResolver";
import { conditionsImposedBy } from "./controlPricing";
import { auditCoverage, mechanicsOf } from "./coverageGate";
import { readConcentration } from "./mechanicText";
import { isMultiattackAction } from "../monsters/multiattackText";
import type { MainMonsterTemplate } from "../monsters/runtime/mainMonsterRuntime";

/** `variables` — the workbook Reader Variables its pricing formula is written in (BR001: N_ATTACKS, P_HIT, D_FULL). */
export type ReaderUse = { id: string; name: string; family: string; evidence: string; variables: string[] };
export type EndpointUse = { id: string; pattern: string; evidence: string };
export type MechanicComposition = {
  channel: string;
  name: string;
  readers: ReaderUse[];
  finals: EndpointUse[];
  needsInput: string[];
  /** The workbook's Reader Compositions example this clause shares the most readers with (≥ 3, endpoints included). */
  example?: { id: string; pattern: string; shared: number; of: number };
};
export type ReaderReport = {
  mechanics: MechanicComposition[];
  needsInput: { channel: string; name: string; reason: string }[];
  /** True when every clause composed and every lasting state has a duration. */
  ready: boolean;
  /** Distinct readers this creature uses. */
  readersUsed: number;
};

const READER = new Map(BROAD_READERS.map(r => [r.id, r]));
const ENDPOINT = new Map(FINAL_EFFECTS.map(f => [f.id, f]));
const ALIAS = new Map(PRIMITIVE_READER_ALIASES.map(a => [a.primitive, a.readers]));
const VARIABLES_OF = new Map(BROAD_READERS.map(r => [
  r.id, READER_VARIABLES.map(v => v.name).filter(n => new RegExp(`\\b${n}\\b`).test(r.pricing)),
]));
const familyRank = (family: string) => {
  const i = READER_FAMILIES.indexOf(family);
  return i < 0 ? READER_FAMILIES.length : i;
};

/** Readers that describe a STATE the mechanic leaves behind — r35 requires a duration for them. */
const LASTING_STATE = new Set(["BR024", "BR040", "BR045", "BR046", "BR047", "BR048", "BR049", "BR055", "BR056", "BR057", "BR058", "BR059", "BR060"]);
const DURATION_READERS = new Set([
  "BR061", "BR062", "BR063", "BR064", "BR065", "BR066", "BR067", "BR068", "BR069", "BR070", "BR071",
  "BR075", "BR076", "BR077", "BR079", "BR080", "BR081",
]);
/** States that carry their own printed ending: a grapple ends on escape (Iron Grasp: "escape DC 16"). */
const SELF_ENDING = new Set(["BR053"]);

const CONDITION_READER: Record<string, string> = {
  prone: "BR054", grappled: "BR053", restrained: "BR053",
  blinded: "BR055", invisible: "BR055",
  frightened: "BR056", charmed: "BR056",
  poisoned: "BR057",
  incapacitated: "BR058", stunned: "BR058", paralyzed: "BR058", unconscious: "BR058", petrified: "BR058",
};

type RawEntry = {
  name?: string; kind?: string; roll?: string; save?: string; text?: string; damage?: string;
  damageType?: string | readonly string[]; extraDamage?: readonly unknown[]; concentration?: boolean; summon?: unknown;
};

/** id → evidence, plus which ids were read as a lasting state rather than a gate or a momentary rider. */
type Uses = { evidence: Map<string, string>; lasting: Set<string> };
const newUses = (): Uses => ({ evidence: new Map(), lasting: new Set() });
function adder(u: Uses) {
  return (id: string, evidence: string, lasting = LASTING_STATE.has(id)) => {
    if (!READER.has(id)) return;
    if (!u.evidence.has(id)) u.evidence.set(id, evidence);
    if (lasting) u.lasting.add(id);
  };
}

function norm(text: string | undefined): string {
  return String(text ?? "").replace(/[’‘`]/g, "'").replace(/[−–—]/g, "-").replace(/\s+/g, " ").toLowerCase();
}

/**
 * The text with its ENDING clauses removed. Winter's Toll: "The area ends early if Harrow is Incapacitated"
 * names how the zone stops (BR080), not a condition the zone imposes — read conditions from what is left.
 */
function withoutEndings(t: string): string {
  return t.replace(/\b(ends?) (early )?(if|when) [^.;]*|\buntil [^.;]*\b(dies|is incapacitated|is killed)\b[^.;]*/g, "");
}

const WHO = "(its|her|his|their|the [a-z' -]+'s)";
const NUM = "(two|three|four|five|six|\\d+)";

/**
 * The workbook's Detection Cues as patterns. Reads a normalized sentence or a whole rules text; knows
 * nothing about fields, so it is also the per-sentence r41 test.
 */
function readTextCues(t: string, u: Uses, resolutionKnown: boolean) {
  const add = adder(u);
  const has = (re: RegExp) => re.test(t);

  // 1 ── Resolution
  if (!resolutionKnown) {
    if (has(/\b(melee|ranged|spell) attack roll\b|\battack roll: \+\d/)) add("BR001", "attack roll");
    if (has(/\bsaving throw\b|\bdc \d+ [a-z]+ save\b/)) add(has(/\bhalf as much\b|\bsuccess: half\b/) ? "BR003" : "BR002", "saving throw");
  }
  if (has(/\bescape dc \d+\b|\bescape check\b|\bability check\b|\bcontested\b/)) add("BR004", "escape / ability check");
  if (has(/\bchoose one\b|\bone of the following\b/)) add("BR010", "choose one");
  if (has(/\bon a hit\b|\bhit:|\bon a miss\b|\bcritical hit\b/)) add("BR011", "on a hit / miss / critical");
  if (has(/\bwhen(ever)? (a|an|the|another|one|each|it|an ally|a hostile)\b[^.]*\b(hit|hits|damage[ds]?|targeted|attack(s|ed)?|enters|moves|crosses|fails|reduced)\b/)) add("BR012", "a triggering event");

  // 2 ── Targeting
  if (has(new RegExp(`\\bup to ${NUM} (creatures|targets)\\b`))) add("BR016", "up to N targets");
  else if (has(new RegExp(`\\b(exactly )?${NUM} (creatures|targets)\\b`))) add("BR015", "a fixed number of targets");
  if (has(/\bone (creature|target|allied creature|party creature|ally)\b|\bthe target\b/)) add("BR014", "one creature");
  if (has(/\beach (hostile |other )?creature\b|\ball creatures\b/)) add("BR017", "each creature in an area");
  if (has(/\ball(y|ies|ied)\b|\benem(y|ies)\b|\bhostile\b|\bwilling\b|\bopposing\b/)) add("BR018", "ally / hostile filter");
  if (has(/\b(unoccupied space|a point|an object|a surface|natural ground)\b/)) add("BR019", "point / space / object");
  if (has(/\b(cone|line|sphere|cube|cylinder|emanation|radius)\b|\b\d+-foot (square|path|squares)\b/)) add("BR020", "area shape");
  if (has(/\bnearest\b|\brandom\b|\bjumps to\b/)) add("BR021", "nearest / random / chain");
  if (has(/\bwithin \d+ (feet|ft)\b|\breach \d+ (feet|ft)\b|\brange \d+(\/\d+)? (feet|ft)\b|\badjacent\b|\bwithin (its )?reach\b/)) add("BR022", "within a distance / reach");
  if (has(/\boriginates? from\b/)) add("BR023", "alternate origin");
  if (has(/\b(enters|starts its turn in|ends its turn in|inside)\b/)) add("BR024", "zone membership", false);
  if (has(/\bmust target\b|\bmust (be )?include(d)?\b/)) add("BR025", "must target / must include");
  if (has(/\bchoose(s)? another (legal )?target\b|\bredirect|\binterpose|\bbecomes the target\b[^.]*\binstead\b/)) add("BR026", "another target instead");
  if (has(/\bcan (see|hear|sense)\b/)) add("BR027", "sight or hearing gate");
  if (has(/\bcover\b|\bobscured\b|\blegal target\b|\bcannot target\b/)) add("BR028", "cover / legality");

  // 3 ── Damage & HP
  if (has(/\b\d+ \(\d+d\d+[^)]*\) [a-z]+ damage\b|\btakes? \d+(d\d+)? [a-z]* ?damage\b/)) add("BR029", "a damage packet");
  if (has(new RegExp(`\\bat the start of ${WHO} turns?\\b[^.]*\\bdamage\\b`))) add("BR032", "start-of-turn damage");
  if (has(new RegExp(`\\bat the end of ${WHO} turns?\\b[^.]*\\bdamage\\b`))) add("BR033", "end-of-turn damage");
  if (has(/\bwhen the effect ends\b[^.]*\bdamage\b|\bthen takes\b[^.]*\bdamage\b/)) add("BR034", "delayed damage");
  if (has(/\b(enters|starts its turn (in|within))\b[^.]*\bdamage\b/)) add("BR035", "zone / contact damage");
  if (has(/\bwhen (it is |the [a-z' -]+ is )?hit\b[^.]*\battacker takes\b|\breflect/)) add("BR037", "retaliation");
  if (has(/\btakes? (the damage|it) instead\b|\bsplit (the )?damage\b|\btransfer/)) add("BR038", "damage transfer");
  if (has(/\breduces? (it|the damage|that damage|damage)[^.]*\bby \d/)) add("BR039", "damage reduction");
  if (has(/\b(gains?|has) (resistance|immunity|vulnerability)\b/)) add("BR040", "resistance / immunity");
  if (has(/\bregains? (\d+ )?hit points\b|\bheals?\b/)) add("BR041", "healing");
  if (has(/\bregenerat|\babsorbs?\b/)) add("BR042", "regeneration / absorption");
  if (has(/\btemporary hit points\b/)) add("BR043", "temporary hit points");
  if (has(/\bhit point maximum\b/)) add("BR044", "hit point maximum");

  // 3 ── Control
  for (const c of conditionsImposedBy({ text: withoutEndings(t) })) add(CONDITION_READER[c] ?? "BR045", c);
  // Elemental Mirror: "impose Disadvantage on that attack" — one attack, gone when it resolves.
  if (has(/\b(advantage|disadvantage) on (that|the triggering|this) attack\b/)) add("BR046", "Advantage / Disadvantage on the triggering attack", false);
  else if (has(/\b(advantage|disadvantage) on (its |their |the )?(next )?attack rolls?\b|\battack rolls? (made )?against [^.]*\b(have|has) (advantage|disadvantage)\b/)) add("BR046", "attack Advantage / Disadvantage");
  if (has(/\b(advantage|disadvantage) on [^.]*\b(saving throws?|checks?)\b|[+-]\d+ (bonus |penalty )?to (its |their )?saving throws\b/)) add("BR047", "save Advantage / Disadvantage");
  if (has(/[+-] ?\d+ (bonus |penalty )?to (its |their )?(ac|armor class)\b|\b(ac|armor class) (increases|decreases)\b/)) add("BR048", "AC modifier");
  if (has(/\bspeed (becomes|is) 0\b|\bspeed (is )?(halved|reduced|increases|doubled)\b|\bspeed of 0\b/)) add("BR049", "speed modifier");
  if (has(/\bdifficult terrain\b/)) add("BR050", "difficult terrain");
  if (has(/\b(push(es|ed)?|pull(s|ed)?|slides?)\b[^.]*\b\d+ (feet|ft)\b|\b(moves?|carr(y|ies)) (the target|that ally|that creature|the creature|the attacker|it|them)\b/)) add("BR051", "moves the target");
  if (has(/\bteleports?\b|\bswap(s)? (places|spaces)\b/)) add("BR052", "teleport / swap");
  if (has(/\b(can'?t|cannot) take reactions\b/)) add("BR059", "can't take Reactions");
  if (has(/\bwithout provoking\b|\bdoes not provoke\b/)) add("BR059", "the movement does not provoke", false);
  if (has(/\b(can'?t|cannot) take (actions|an action|bonus actions)\b|\bone (fewer|less) attack\b/)) add("BR060", "action restriction");

  // 4 ── Duration & Final
  if (has(/\bconcentration\b/)) add("BR070", "concentration");
  if (has(/\bconcentration,? up to\b/)) add("BR071", "concentration, up to");
  if (has(/\binstantaneous\b/)) add("BR061", "instantaneous");
  // "until" or "before" — Larkskein's Advantage is spent "before the end of its next turn".
  if (has(/\b(until|before) (the )?start of the target's next turn\b/)) add("BR064", "until the start of the target's next turn");
  else if (has(new RegExp(`\\b(until|before) (the )?start of ${WHO} next turn\\b`))) add("BR062", "until the start of its next turn");
  if (has(/\b(until|before) (the )?end of the target's next turn\b/)) add("BR065", "until the end of the target's next turn");
  else if (has(new RegExp(`\\b(until|before) (the )?end of ${WHO} next turn\\b`))) add("BR063", "until the end of its next turn");
  if (has(/\b(for |lasts? )(2|two) (turns|rounds)\b/)) add("BR066", "exactly two turns");
  else if (has(/\b(for |lasts? )(3|4|5|6|7|8|9|three|four|five|six) (turns|rounds)\b/)) add("BR067", "a fixed number of rounds");
  if (has(/\b(1|one) minute\b/)) add("BR068", "one minute");
  if (has(/\b(10 minutes|1 hour|8 hours|24 hours|\d+ days)\b/)) add("BR069", "a long fixed duration");
  if (has(/\brepeats? the saving throw at the start\b|\bat the start of each of its turns\b[^.]*\bsaving throw\b/)) add("BR075", "save ends at the start of its turn");
  if (has(/\brepeats? the saving throw at the end\b|\bat the end of each of its turns\b[^.]*\bsaving throw\b/)) add("BR076", "save ends at the end of its turn");
  if (has(/\brepeats? the saving throw\b/) && !u.evidence.has("BR075") && !u.evidence.has("BR076")) add("BR077", "a repeat save");
  if (has(/\bsecond (failure|failed)\b|\bfails (it )?again\b/)) add("BR078", "staged failure");
  if (has(/\bends (early )?if [^.]*\btakes? damage\b|\buses? an action to wake\b/)) add("BR079", "ends on damage");
  if (has(/\bends (early )?if [^.]*\b(incapacitated|dies|is killed|leaves)\b|\buntil [^.]*\b(dies|is incapacitated)\b/)) add("BR080", "ends if the source is incapacitated, dies or leaves range");
  if (has(/\bwhile (it is |they are |it remains |the [a-z' -]+ (is|remains) )?(within|inside)\b|\bwhile [^.]*\bcan see\b|\btether/)) add("BR081", "while within / while it can see");
  if (has(/\bwhen the effect ends\b|\bat the end of the duration\b/)) add("BR082", "final resolution");

  // 5 ── Action Economy
  if (has(/\bonce per turn\b|\b1\s*\/\s*turn\b|\bthe first time\b[^.]*\bon (its|a) turn\b/)) add("BR092", "once per turn");
  if (has(/\bonce per round\b|\b1\s*\/\s*round\b/)) add("BR093", "once per round");
  if (has(/\brecharge \d/)) add("BR090", "recharge");
  if (has(/\b\d\s*\/\s*day\b|\bper (long |short )?rest\b/)) add("BR091", "uses per day / rest");
  if (has(/\blegendary action/)) add("BR087", "legendary action");
  if (has(/\binitiative count 20\b|\blair action\b/)) add("BR088", "lair action");
  if (has(/\bonce per encounter\b|\bvillain action\b/)) add("BR089", "once per encounter");
  if (has(/\bcharges?\b|\bspell[- ]slots?\b|\b\d(st|nd|rd|th)-level (spell )?slots?\b|\bshared pool\b/)) add("BR094", "charges / spell slots");
  if (has(/\ball(y|ies) (can |may )?(immediately )?(makes?|takes?|uses?) (one|an|a) (weapon )?(attack|action)\b/)) add("BR095", "an ally acts");
  if (has(/\badditional reactions?\b|\bmultiple reactions\b|\bmore than one reaction\b/)) add("BR096", "extra Reactions");

  // 6 ── Special Systems
  if (has(/\bspells?\b|\bmagical effect\b|\bcounterspell|\bdispel/)) add("BR097", "spell / magical effect");
  if (has(/\bhigher[- ]level slot\b|\bat higher levels\b|\bcast at (level )?\d\b|\bexpends? [^.]*\bspell slot\b/)) add("BR098", "slot / upcast");
  if (has(/\bsummons?\b|\bconjures?\b/)) add("BR099", "summon");
  if (has(/\b(shapechange|polymorph|transforms? into|new form)\b/)) add("BR100", "transformation");
  if (has(/\bbloodied\b|\bhalf (of )?its (total )?(maximum )?hit points\b|\bphase\b/)) add("BR101", "threshold state");
  if (has(/\breduced to 0 hit points\b|\bdrops? to 0 hit points\b|\bdeath burst\b/)) add("BR102", "0-HP trigger");
  if (has(/\bswallow|\bengulf/)) add("BR103", "swallow / engulf");
  if (has(/\bregeneration stops\b|\bcan'?t regain hit points\b/)) add("BR104", "regeneration shutoff");
  if (has(/\blegendary resistance\b|\bchoose to succeed\b/)) add("BR105", "legendary resistance");
  if (has(/\bminion\b|\bgroup attack\b/)) add("BR106", "minion body");
  if (has(/\bcompanion\b|\bretainer\b/)) add("BR107", "companion body");
  if (has(/\bdamage threshold\b|\bimmutable form\b/)) add("BR108", "special defense");
}

function composeFields(raw: RawEntry, f: ParsedFeature, channel: string, concentrationCount: number): Uses {
  const u = newUses();
  const add = adder(u);
  const t = norm(raw.text);
  const ri = f.rosterInteraction;
  const escape = /\bescape dc \d+\b/.test(t) && !/\bsaving throw\b/.test(t);

  // 1 ── Resolution — the roll and save fields
  if (f.attackBonus !== undefined && f.saveDc !== undefined && !escape) add("BR006", "an attack roll, then a saving throw");
  else if (f.attackBonus !== undefined) add("BR001", `attack roll ${raw.roll ?? `+${f.attackBonus}`}`);
  else if (f.saveDc !== undefined && !escape) {
    const half = f.successDamage !== undefined && f.successDamage !== "0";
    add(half ? "BR003" : "BR002", `DC ${f.saveDc}${f.saveAbility ? ` ${f.saveAbility.toUpperCase()}` : ""} save${half ? ", half on a success" : ""}`);
  } else if (f.damage) add("BR005", "damage with no attack roll or save");
  if (isMultiattackAction(raw.name, raw.text)) add("BR008", "Multiattack");
  if (f.replacesRoutineSlot) add("BR009", "replaces one routine attack");
  if ((f.riders ?? []).length > 0) add("BR011", "a rider on a hit");

  // 2 ── Targeting
  if (f.isArea) { add("BR017", "each creature in an area"); add("BR020", "area shape"); }
  else if (typeof f.targets === "number" && f.targets > 1) add("BR015", `${f.targets} targets`);
  else if (f.targets === 1 || f.attackBonus !== undefined) add("BR014", "one target");
  if (ri?.kind === "roll_modifier_zone") { add("BR024", "a zone the creature places", true); add("BR018", "allies and hostiles filtered"); }
  if (ri?.kind === "forced_target_order") add("BR025", "hostile Actions must target it");
  if (ri?.kind === "target_substitution") { add("BR026", "the attack re-checks its target"); add("BR051", "moves the targeted ally"); }
  if (ri?.kind === "ally_extra_attack") add("BR018", "one ally");

  // 3 ── Damage & HP / Control
  if (f.damage) add("BR029", `damage ${raw.damage ?? f.damage}`);
  if ((raw.extraDamage?.length ?? 0) > 0 || Array.isArray(raw.damageType)) add("BR030", "more than one damage type");
  for (const r of f.riders ?? []) {
    if (r.cadence === "once-per-turn") add("BR031", `${r.name}: once per turn`);
    else add("BR029", `${r.name}: extra damage on a hit`);
  }
  if (f.attackWith) add("BR029", `makes one ${f.attackWith} attack`);
  const imposing = withoutEndings(t);
  for (const c of conditionsImposedBy(f)) {
    if (t.includes(c) && !imposing.includes(c)) continue; // named only in how the effect ends
    add(CONDITION_READER[c] ?? "BR045", c);
  }
  if (escape) add("BR053", "escape DC");
  if (f.grantsAdvantage) add("BR046", "Advantage on its own attacks", false);
  if (f.forcedMovementFt) add("BR051", `moves the target ${f.forcedMovementFt} ft.`);
  if (ri?.kind === "roll_modifier_zone") {
    if (ri.allyAttack || ri.hostileAttack) add("BR046", `attack rolls ${[ri.allyAttack && `+${ri.allyAttack} allies`, ri.hostileAttack && `${ri.hostileAttack} hostiles`].filter(Boolean).join(", ")}`);
    if (ri.allySave || ri.hostileSave) add("BR047", `saving throws ${[ri.allySave && `+${ri.allySave} allies`, ri.hostileSave && `${ri.hostileSave} hostiles`].filter(Boolean).join(", ")}`);
  }

  // 4 ── Duration — the concentration field and the zone's printed turns
  if (raw.concentration ?? Boolean(readConcentration(raw.text))) {
    add("BR070", "concentration");
    add("BR073", "concentration breaks on a failed Constitution save");
    if (concentrationCount > 1) add("BR072", "a second concentration effect ends the first");
  }
  const zoneTurns = ri?.kind === "roll_modifier_zone" ? Number(ri.durationRounds ?? 0) : 0;
  if (zoneTurns === 2) add("BR066", "the zone lasts two turns");
  else if (zoneTurns > 2) add("BR067", `the zone lasts ${zoneTurns} rounds`);

  // 5 ── Action Economy — the activation field
  const economy: Record<string, [string, string]> = {
    action: ["BR083", "an Action"], bonus_action: ["BR084", "a Bonus Action"], reaction: ["BR085", "a Reaction"],
    trait: ["BR086", "passive"], free: ["BR086", "free / automatic"],
    legendary_action: ["BR087", "a legendary action"], lair_action: ["BR088", "a lair action"],
  };
  const [economyId, economyWhy] = economy[f.activationType ?? "action"] ?? economy.action;
  add(economyId, economyWhy);
  if (f.recharge) add("BR090", `Recharge ${f.recharge}`);
  if (f.uses !== undefined) add("BR091", `${f.uses} use${f.uses === 1 ? "" : "s"}`);
  if (f.spellSlotLevel !== undefined) { add("BR094", `level ${f.spellSlotLevel} slot`); add("BR098", `cast at level ${f.spellSlotLevel}`); }
  if (ri?.kind === "ally_extra_attack") add("BR095", "an ally makes one attack");

  // 6 ── Special Systems
  if (raw.kind === "spell" || f.spellName) add("BR097", raw.kind === "spell" ? "a spell" : `the ${f.spellName} spell`);
  if (raw.summon) add("BR099", "summon");

  // Then the rules sentence. A reaction's "when…" is its trigger whatever the channel was typed as.
  readTextCues(t, u, u.evidence.has("BR001") || u.evidence.has("BR002") || u.evidence.has("BR003") || u.evidence.has("BR006"));
  if (channel === "reaction" && /\bwhen(ever)?\b/.test(t)) add("BR012", "the Reaction's trigger");
  return u;
}

/** r34 order, r35 duration, r36 endpoint — run after every source of readers has been merged. */
function finalize(channel: string, name: string, u: Uses, passive: boolean, text: string): MechanicComposition {
  const has = (id: string) => u.evidence.has(id);
  const readers = [...u.evidence.entries()]
    .map(([id, evidence]) => { const r = READER.get(id)!; return { id, name: r.name, family: r.family, evidence, variables: VARIABLES_OF.get(id) ?? [] }; })
    .sort((a, b) => familyRank(a.family) - familyRank(b.family) || a.id.localeCompare(b.id));

  const duration = [...u.evidence.keys()].some(id => DURATION_READERS.has(id));
  const selfEnding = [...u.evidence.keys()].some(id => SELF_ENDING.has(id));
  const lasting = [...u.lasting];
  const needsInput: string[] = [];
  if (lasting.length > 0 && !duration && !selfEnding && !passive) {
    const states = lasting.map(id => `${id} ${READER.get(id)!.name}`).join(", ");
    needsInput.push(/\bfor the rest of (the|this|the current|its) turn\b/.test(text)
      ? `${states} lasts "the rest of the turn", and no v5 duration reader is shorter than BR062/BR063 — Runtime Contract r35`
      : `a lasting state (${states}) with no duration reader — Runtime Contract r35`);
  }

  const finals: EndpointUse[] = [];
  const end = (id: string, evidence: string) => {
    const e = ENDPOINT.get(id);
    if (e && !finals.some(x => x.id === id)) finals.push({ id, pattern: e.pattern, evidence });
  };
  if (duration || selfEnding) {
    if (has("BR070")) end("FE29", "concentration ends");
    if (u.lasting.has("BR024")) end("FE23", "the zone collapses");
    if (u.lasting.has("BR046") || u.lasting.has("BR047") || u.lasting.has("BR048")) end("FE26", "the modifier ends");
    if (u.lasting.has("BR040")) end("FE27", "the resistance ends");
    if (has("BR053")) end("FE08", "the grapple is escaped or released");
    if (u.lasting.has("BR056")) end("FE35", "the fear or charm ends");
    if (has("BR025") || has("BR026")) end("FE36", "the forced target ends");
    if (has("BR032") || has("BR033") || has("BR035")) end("FE31", "the recurring damage stops");
    if (has("BR075") || has("BR076") || has("BR077")) end("FE17", "a successful save clears it");
    if (has("BR099")) end("FE12", "the summon despawns");
    if (has("BR100")) end("FE13", "the transformation reverts");
    if (finals.length === 0) end("FE01", "clean expiration");
  }
  // The nearest worked example from the workbook — a pointer to how v5 means a shape like this to be read.
  let example: MechanicComposition["example"];
  for (const c of READER_COMPOSITIONS) {
    const shared = c.readers.filter(id => has(id)).length;
    if (shared < 3 || !c.finals.every(id => finals.some(f => f.id === id))) continue;
    if (!example || shared > example.shared) example = { id: c.id, pattern: c.pattern, shared, of: c.readers.length };
  }
  return { channel, name, readers, finals, needsInput, example };
}

/**
 * Compose every authored mechanic on a creature from the broad readers.
 *
 * The parsed features and the raw entries are the same list in the same order — `parseCreature` walks
 * traits, actions, reactions, legendary and lair actions — so each feature is paired with the entry it
 * came from, and the entry's own fields (extra damage lines, concentration, a summon) are read with it.
 */
export function composeReaders(template: MainMonsterTemplate): ReaderReport {
  const any = template as unknown as Record<string, RawEntry[] | undefined>;
  const sections: [string, RawEntry[]][] = [
    ["trait", any.traits ?? []], ["action", any.actions ?? []], ["reaction", any.reactions ?? []],
    ["legendary", any.legendaryActions ?? []], ["lair", any.lairActions ?? []],
  ];
  const raws = sections.flatMap(([channel, list]) => list.filter(Boolean).map(raw => ({ channel, raw })));
  const features = parseCreature(template).features;
  const concentrationCount = raws.filter(({ raw }) => raw.concentration ?? Boolean(readConcentration(raw.text))).length;

  const coverage = auditCoverage(mechanicsOf(template as never));
  const blockedBy = new Map<string, string[]>();
  for (const b of coverage.blocked) {
    const key = `${b.source.channel}|${b.source.name}`;
    blockedBy.set(key, [...(blockedBy.get(key) ?? []), b.source.text]);
  }
  const aliasedBy = new Map<string, { primitive: string; readers: string[] }[]>();
  for (const hit of coverage.covered) {
    const readers = ALIAS.get(hit.primitive.id);
    if (!readers) continue;
    const key = `${hit.source.channel}|${hit.source.name}`;
    aliasedBy.set(key, [...(aliasedBy.get(key) ?? []), { primitive: hit.primitive.id, readers }]);
  }

  const mechanics = raws.map(({ channel, raw }, i) => {
    const feature = features[i];
    const u = composeFields(raw, feature, channel, concentrationCount);
    const add = adder(u);
    const key = `${channel}|${raw.name}`;
    // The v7 primitives a sentence already routed to, carried across by the workbook's alias table.
    // Resolution is a field fact — a roll or a save — so an alias never adds one: Winter's Toll's "+3 bonus
    // to attack rolls" routes to attack_roll_packet, but the Toll makes no attack roll.
    for (const { primitive, readers } of aliasedBy.get(key) ?? []) {
      // And an alias never re-types a state the fields or text already read as momentary (Elemental
      // Mirror's Disadvantage "on that attack"); it marks a lasting state only for a reader nothing else found.
      for (const id of readers) {
        if (READER.get(id)?.family === "Resolution") continue;
        add(id, `via primitive ${primitive}`, !u.evidence.has(id) && LASTING_STATE.has(id));
      }
    }
    const passive = feature.activationType === "trait" || feature.activationType === "free";
    const m = finalize(channel, raw.name ?? "unnamed", u, passive, norm(raw.text));
    // r41 per sentence: a clause no primitive routes still composes if the reader cues read it.
    for (const sentence of blockedBy.get(key) ?? []) {
      const alone = newUses();
      readTextCues(norm(sentence), alone, false);
      if (alone.evidence.size === 0) m.needsInput.push(`no reader composition represents "${sentence}" — Runtime Contract r41`);
    }
    return m;
  });

  const needsInput = mechanics.flatMap(m => m.needsInput.map(reason => ({ channel: m.channel, name: m.name, reason })));
  return {
    mechanics,
    needsInput,
    ready: needsInput.length === 0,
    readersUsed: new Set(mechanics.flatMap(m => m.readers.map(r => r.id))).size,
  };
}
