/**
 * parseCreature — v3 App Contract row 10 (REQUIRED).
 *
 *   creature_input  "Read each entered creature's sections, features, action text, damage,
 *                    attack bonus, save DC, targets, recharge, uses, slot pool, and timing
 *                    into normalized features."
 *
 * The parser's own rules, from the compact import:
 *   source_of_truth     "Entered action text and numeric fields; do not use CR-band damage
 *                        for identified actions."
 *   action_type_source  "section heading"
 *   unknown_policy      "NEEDS DM INPUT or ESTIMATED with trace; never silently use a lower
 *                        spell tier or CR band."
 *
 * ⚠ ACTIVATION TYPE COMES FROM THE SECTION, NEVER FROM THE WORD "RECHARGE". Recharge controls
 * availability only — it never turns a Bonus Action into an Action. That distinction is the
 * one the contract repeats most often, because getting it wrong silently inflates a creature's
 * action budget.
 *
 * The workbook is the law here: a well-formed 5e stat block should parse completely. An
 * assumption coming out of this file means the block is written wrong or the mechanic is
 * inferred rather than printed — not that the checker is guessing.
 */

import type { MainMonsterTemplate } from "../monsters/runtime/mainMonsterRuntime";
import type { ParsedFeature, FeatureAssumption } from "./featureResolver";
import { spellProfile, campaignProfile, type CampaignProfile } from "./compactImport";
import { conditionsImposedBy } from "./controlPricing";
import { isMultiattackAction, multiattackCountFromText } from "../monsters/multiattackText";
import { parseSaveAbility } from "./partyDefenceCurve";

export type ActivationType = NonNullable<ParsedFeature["activationType"]>;

export type ParsedCreature = {
  name: string;
  ac: number | undefined;
  maxHp: number;
  /** Size of the routine Action budget — how many attacks a Multiattack makes. */
  attacksPerTurn: number;
  features: ParsedFeature[];
  assumptions: FeatureAssumption[];
};

/** "DC 17 Wisdom saving throw" / "WIS DC 17" / "DC 14 STR save" → 17. */
export function parseSaveDc(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const m = text.match(/DC\s*(\d+)/i);
  return m ? Number.parseInt(m[1], 10) : undefined;
}

/** "1d20 + 7" → 7. The printed attack bonus, never derived from ability scores. */
export function parseAttackBonus(roll: string | undefined): number | undefined {
  if (!roll) return undefined;
  const m = roll.match(/([+-])\s*(\d+)\s*$/);
  return m ? (m[1] === "-" ? -1 : 1) * Number.parseInt(m[2], 10) : undefined;
}

/**
 * PRINTED melee reach, in feet: "reach 10 ft." → 10.
 *
 * ⚠ ONLY THE PRINTED VALUE. The v7 reach reference forbids inferring reach from size — a Huge
 * creature has a 15-ft footprint and whatever reach its attack prints, commonly still 5 or 10.
 * `undefined` means "not printed", and the caller applies the ruleset default rather than
 * guessing something size-flavoured here.
 */
export function parseReachFt(text: string | undefined): number | undefined {
  const m = (text ?? "").match(/\breach\s+(\d+)\s*(?:ft|feet|')/i);
  return m ? Number.parseInt(m[1], 10) : undefined;
}

/**
 * PRINTED range, in feet: "range 80/320 ft." → 80, "within 30 feet" → 30, "60-foot cone" → 60.
 *
 * The NORMAL range is what prices — the long range carries disadvantage, which is a separate
 * repricing and must not be silently treated as free reach.
 */
export function parseRangeFt(text: string | undefined): number | undefined {
  const t = text ?? "";
  const slash = t.match(/\brange\s+(\d+)\s*\/\s*\d+\s*(?:ft|feet|')/i);
  if (slash) return Number.parseInt(slash[1], 10);
  const plain = t.match(/\brange\s+(\d+)\s*(?:ft|feet|')/i);
  if (plain) return Number.parseInt(plain[1], 10);
  const within = t.match(/\bwithin\s+(\d+)\s*(?:ft|feet|')/i);
  if (within) return Number.parseInt(within[1], 10);
  const shape = t.match(/(\d+)[-\s]*(?:ft|foot|feet)[-\s]*(?:cone|line|radius|sphere|cube|emanation)/i);
  if (shape) return Number.parseInt(shape[1], 10);
  return undefined;
}

/**
 * FORCED MOVEMENT in feet: "pushed 15 feet away" → +15, "pulled 20 feet" → −20.
 *
 * Sign is direction: positive opens the gap, negative closes it. Both change reachability, and
 * a pull can be as disabling as a push for a creature whose damage is a 120-ft spell.
 */
export function parseForcedMovementFt(text: string | undefined): number | undefined {
  const t = text ?? "";
  const push = t.match(/\b(?:push(?:ed|es)?|shov(?:ed|es)?|knock(?:ed|s)?\s+back|thrown|hurled)\b[^.]{0,40}?(\d+)\s*(?:ft|feet|')/i);
  if (push) return Number.parseInt(push[1], 10);
  const pull = t.match(/\b(?:pull(?:ed|s)?|drag(?:ged|s)?|yank(?:ed|s)?)\b[^.]{0,40}?(\d+)\s*(?:ft|feet|')/i);
  if (pull) return -Number.parseInt(pull[1], 10);
  return undefined;
}

/**
 * Is this an AREA effect — a shape rather than a target list?
 *
 * v7 wants "an explicit target count from the statblock or runtime catalog when available". A
 * cone, a radius or a line has neither: it has GEOMETRY, and how many PCs it catches depends on
 * the party standing in it. That is not unknowable — the checker is a FOUR-PC BASELINE model and
 * already knows the party size it is running. `aoeTargetsForParty` turns the shape into a count.
 */
export function isAreaEffect(text: string | undefined): boolean {
  const t = text ?? "";
  if (!t) return false;
  return /\b(?:cone|radius|emanation|cube|sphere|\bline\b)\b/i.test(t)
    || /\b(?:each|every|all) (?:other )?creatures?\b/i.test(t)
    || /\bcreatures? of the [^.]*?choice\b/i.test(t);
}

/**
 * How many PCs an area effect is expected to catch, for a party of this size.
 *
 * ⚠ HALF THE PARTY — AND THE "TWO-TARGET BENCHMARK" IS EXACTLY THAT. The catalog's two-target
 * figure is stated as a FOUR-PC benchmark: two of four. The workbook is a four-PC baseline
 * throughout (`fourPcBaseline: true`, `campaign_baseline.party_size: 4`), so the benchmark is not
 * a magic constant — it is half the party, and it scales with the party actually being run.
 *
 * Counting an area as ONE target, which is what this did before, under-prices every cone and
 * every burst in the campaign. It is why the Grief Colossus's Collapse Space read as WEAKER than
 * its own Fist routine and got scheduled out of the fight.
 *
 * Floor, minimum 1: rounding up would claim an area reliably catches a larger share of a small
 * party than of a big one, which is backwards.
 */
export function aoeTargetsForParty(partySize: number): number {
  const size = Number.isFinite(partySize) && partySize > 0 ? partySize : 4;
  return Math.max(1, Math.floor(size / 2));
}

/**
 * Target count from the printed wording. Only counts what the text actually says — an area
 * effect with no stated target count is left undefined so the resolver can flag it, because
 * the catalog's two-target figure is a four-PC benchmark and not a default.
 */
export function parseTargets(text: string | undefined): number | undefined {
  if (!text) return undefined;
  if (/\bone (?:target|creature)\b/i.test(text)) return 1;
  if (/\btwo (?:targets|creatures)\b/i.test(text)) return 2;
  if (/\bthree (?:targets|creatures)\b/i.test(text)) return 3;
  const n = text.match(/\bup to (\w+) creatures\b/i);
  if (n) {
    const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
    return words[n[1].toLowerCase()] ?? (Number.parseInt(n[1], 10) || undefined);
  }
  return undefined;
}

/**
 * The damage a SUCCESSFUL save still takes, read from the block's own words.
 *
 * v7 `parser.success_patterns` lists exactly this: "Half damage" · "No damage" · "printed
 * alternate damage". So half IS parseable and always was — the checker simply never read it and
 * flagged every save-for-half in the campaign as *"No success damage printed; treated as none."*
 * That under-prices each of them by the entire success half.
 *
 * ⚠ STILL NEVER ASSUMED. A block that says nothing gets nothing. That is the rule that stops an
 * all-or-nothing save being quietly halved, and it is why this reads wording rather than defaulting.
 */
export function parseSuccessDamage(text: string | undefined, failDamage: string | undefined): string | undefined {
  const t = text ?? "";
  if (!t) return undefined;
  /**
   * v7 `parser.success_patterns` names the CATEGORY — "No damage" — not the wording, and stat
   * blocks write that category several ways.
   *
   * ⚠ "NO EFFECT" WAS MISSING, AND IT COST A REAL FLAG. The Thought Harrower's Mind Hook prints
   * *"Failure: 7 (2d6) psychic … ; success: no effect."* That is the clearest possible statement
   * of the "No damage" pattern, and the checker reported it as unreadable — one of three things it
   * claimed it could not price about creatures shipped in the campaign library.
   *
   * These are all the same category, never an assumption: the block SAYS the save negates.
   */
  if (/\b(?:no damage|no effect|negates?|isn'?t affected|is not affected|takes no damage|nothing happens)\b/i.test(t)) return "0";
  const saysHalf = /\bhalf(?: as much)?(?: damage)?\b[^.]{0,40}\bsuccess/i.test(t)
    || /\bsuccess(?:ful save)?\b[^.]{0,40}\bhalf\b/i.test(t)
    || /\bhalf as much damage\b/i.test(t);
  if (!saysHalf) return undefined;
  const avg = damageAverageOf(failDamage);
  return avg === undefined ? undefined : String(avg / 2);
}

/**
 * Success damage for one authored action, data first.
 *
 * `onSave` is the monster editor's own field and outranks the prose; the text is only read when
 * the block was written before that field existed. "custom" without an amount falls back to the
 * text rather than silently pricing zero.
 */
function successDamageFor(a: { onSave?: string; successDamage?: string; damage?: string; text?: string }): string | undefined {
  if (a.onSave === "none") return "0";
  if (a.onSave === "half") {
    const avg = damageAverageOf(a.damage);
    return avg === undefined ? undefined : String(avg / 2);
  }
  if (a.onSave === "custom" && a.successDamage?.trim()) return a.successDamage.trim();
  return parseSuccessDamage(a.text, a.damage);
}

/** Average of a printed damage expression, so "half" can be resolved to a number. */
function damageAverageOf(expr: string | undefined): number | undefined {
  if (!expr) return undefined;
  const pre = expr.trim().match(/^\s*(\d+(?:\.\d+)?)\s*\(/);
  if (pre) return Number.parseFloat(pre[1]);
  let total = 0;
  let saw = false;
  for (const m of expr.matchAll(/([+-]?)\s*(\d*)d(\d+)/gi)) {
    saw = true;
    const sign = m[1] === "-" ? -1 : 1;
    const count = m[2] === "" ? 1 : Number.parseInt(m[2], 10);
    total += sign * (count * (Number.parseInt(m[3], 10) + 1)) / 2;
  }
  for (const m of expr.replace(/[+-]?\s*\d*d\d+/gi, " ").matchAll(/([+-])\s*(\d+)/g)) {
    saw = true;
    total += (m[1] === "-" ? -1 : 1) * Number.parseInt(m[2], 10);
  }
  return saw ? total : undefined;
}

/** "Recharge 5-6" / "Recharge 6" → the printed range. Availability ONLY. */
export function parseRecharge(field: string | undefined, name: string | undefined): string | undefined {
  if (field) return field;
  const m = (name ?? "").match(/recharge\s*(\d\s*[-–]\s*\d|\d)/i);
  return m ? m[1].replace(/\s|–/g, m[1].includes("-") || m[1].includes("–") ? "-" : "") : undefined;
}

/** "(1/Day)" / "2/Day" / "Usable twice" → the number of uses. */
export function parseUses(name: string | undefined, text: string | undefined): number | undefined {
  const src = `${name ?? ""} ${text ?? ""}`;
  const perDay = src.match(/(\d+)\s*\/\s*day/i);
  if (perDay) return Number.parseInt(perDay[1], 10);
  if (/\bonce per (?:fight|day|combat)\b/i.test(src)) return 1;
  const twice = src.match(/\b(?:usable )?twice\b/i);
  if (twice) return 2;
  return undefined;
}

/**
 * ACTIVATION TYPE FROM THE SECTION, with the name only as a fallback for blocks that mark it
 * inline ("Drive the Pack (Bonus Action)") — which is how these stat blocks are authored.
 * The word "Recharge" is deliberately never consulted.
 */
export function parseActivationType(
  section: "traits" | "actions" | "reactions" | "legendary" | "lair",
  name: string | undefined,
): ActivationType {
  if (section === "traits") return "trait";
  if (section === "reactions") return "reaction";
  if (section === "legendary") return "legendary_action";
  if (section === "lair") return "lair_action";
  const n = name ?? "";
  if (/\(\s*bonus action/i.test(n)) return "bonus_action";
  if (/\(\s*reaction/i.test(n)) return "reaction";
  if (/legendary action/i.test(n)) return "legendary_action";
  if (/lair action/i.test(n)) return "lair_action";
  return "action";
}

/** A recognised spell named by the feature, so the resolver can price an abbreviated one. */
export function detectSpell(name: string | undefined, text: string | undefined): string | undefined {
  for (const candidate of [name, text]) {
    if (!candidate) continue;
    // Prefer an explicit "casts X" / "(X)" mention, then the bare feature name.
    const cast = candidate.match(/\bcasts?\s+([A-Z][A-Za-z' ]+)/);
    if (cast && spellProfile(cast[1])) return cast[1].trim();
    const paren = candidate.match(/\(([^)]+)\)/);
    if (paren && spellProfile(paren[1])) return paren[1].trim();
  }
  if (name && spellProfile(name.replace(/\s*\(.*$/, ""))) return name.replace(/\s*\(.*$/, "").trim();
  return undefined;
}

type RawAction = {
  name?: string; kind?: string; roll?: string; damage?: string; save?: string;
  text?: string; recharge?: string; attackCount?: number; spellSlotLevel?: number;
  legendaryCost?: number; economyCost?: string; gated?: boolean;
  /** Authored in the monster editor — these outrank anything parsed from the action text. */
  targets?: number; onSave?: string; successDamage?: string; uses?: number;
  /** The action's printed reach/range, one field — see MonsterReaderAction.range. */
  range?: string; conditions?: string[];
};

function parseSection(
  entries: readonly RawAction[] | undefined,
  section: "traits" | "actions" | "reactions" | "legendary" | "lair",
  creature: string,
  assumptions: FeatureAssumption[],
): ParsedFeature[] {
  const out: ParsedFeature[] = [];
  for (const a of entries ?? []) {
    if (!a) continue;
    const name = a.name ?? "unnamed";
    const activationType = a.economyCost === "bonus"
      ? "bonus_action"
      : a.legendaryCost !== undefined
        ? "legendary_action"
        : parseActivationType(section, name);

    const feature: ParsedFeature = {
      name,
      activationType,
      damage: a.damage,
      attackBonus: parseAttackBonus(a.roll),
      saveDc: parseSaveDc(a.save ?? a.text),
      saveAbility: parseSaveAbility(a.save ?? a.text),
      /**
       * Reachability inputs, all DERIVED. The DM authors one `range` string exactly as on the PC
       * sheet; whether it reads as a melee reach or a ranged distance is the parser's job, not a
       * classification the DM should have to make before typing a number. Forced movement is read
       * from the action text, because it is a consequence the text states.
       */
      reachFt: parseReachFt(a.range) ?? parseReachFt(a.text),
      rangeFt: parseRangeFt(a.range) ?? parseRangeFt(a.text),
      conditions: a.conditions ?? conditionsImposedBy({ text: a.text }),
      forcedMovementFt: parseForcedMovementFt(a.text),
      /**
       * ⚠ AUTHORED DATA BEATS PARSED PROSE. `a.targets` and `a.onSave` are fields the monster
       * editor now writes; the text is the fallback for a block that predates them. A printed
       * count also clears the area estimate outright — there is nothing left to estimate.
       */
      targets: a.targets ?? parseTargets(a.text),
      isArea: (a.targets ?? parseTargets(a.text)) === undefined && isAreaEffect(a.text),
      // v7 success_patterns: half / none / printed alternate. Read, never assumed.
      successDamage: successDamageFor(a),
      recharge: parseRecharge(a.recharge, name),
      uses: parseUses(name, a.text),
      replacesRoutineSlot: replacesRoutineSlot(name),
      spellSlotLevel: a.spellSlotLevel,
      spellName: detectSpell(name, a.text),
      gated: a.gated,
      text: a.text,
    };

    // A save-based feature with no readable DC is a real gap, not a default.
    if (!feature.attackBonus && !feature.saveDc && feature.damage) {
      assumptions.push({
        feature: name, flag: "ESTIMATED", field: "action_cost",
        detail: `"${name}" has damage but neither an attack bonus nor a save DC, so it is treated as automatic.`,
      });
    }
    if (a.gated) {
      assumptions.push({
        feature: name, flag: "ESTIMATED", field: "timing",
        detail: `"${name}" is authored as unavailable under this encounter's conditions and is not counted.`,
      });
    }
    out.push(feature);
  }
  return out;
}

/**
 * Normalise an entered creature into features the resolver and the trace can consume.
 *
 * Traits are parsed too — a trait can carry a damaging rider, and the contract's effect
 * families explicitly include auras, retaliation and death bursts, which live in that section.
 */
export function parseCreature(template: MainMonsterTemplate): ParsedCreature {
  const assumptions: FeatureAssumption[] = [];
  const name = template.name;
  const acRaw = typeof template.stats.ac === "number"
    ? template.stats.ac
    : Number.parseInt(String(template.stats.ac), 10);
  const ac = Number.isFinite(acRaw) ? acRaw : undefined;
  if (ac === undefined) {
    assumptions.push({ feature: name, flag: "NEEDS DM INPUT", field: "action_cost",
      detail: "No readable AC on this creature." });
  }

  const t = template as MainMonsterTemplate & {
    reactions?: RawAction[]; legendaryActions?: RawAction[]; lairActions?: RawAction[];
  };

  const features = [
    ...parseSection(template.traits as RawAction[] | undefined, "traits", name, assumptions),
    ...parseSection(template.actions as RawAction[] | undefined, "actions", name, assumptions),
    ...parseSection(t.reactions, "reactions", name, assumptions),
    ...parseSection(t.legendaryActions, "legendary", name, assumptions),
    ...parseSection(t.lairActions, "lair", name, assumptions),
  ];

  /**
   * ⚠ MULTIATTACK IS PRICED, NOT ESTIMATED. v7 contract, auto=YES: *"Resolve the printed legal
   * sequence and sum the expected values of its component attacks/actions."*
   *
   * This used to take `stats.attacksPerTurn ?? 1` and flag ESTIMATED — so a block that plainly
   * says "makes three attacks" was priced at ONE and reported as an assumption. Two failures at
   * once: it under-counted the creature by two thirds of its routine offence, and it called a
   * printed fact unreadable.
   *
   * Order: authored count, then the PRINTED sequence, then flag. Only the last is an assumption.
   */
  const multiattackAction = (template.actions as RawAction[] | undefined)
    ?.find(a => isMultiattackAction(a.name, a.text));
  /**
   * ⚠ THE COMPONENT NAMES ARE PASSED IN, which is the whole point of reading a printed sequence.
   * The helper has always accepted them and NEITHER call site supplied them, so a Multiattack that
   * spells itself out by name — "makes a Bite attack and two Claw attacks" — returned undefined
   * and asked the DM for a number sitting in the creature's own action list.
   */
  const componentNames = (template.actions as RawAction[] | undefined)
    ?.filter(a => a !== multiattackAction && a.name)
    .map(a => a.name as string) ?? [];
  const printedSequence = multiattackAction
    ? multiattackCountFromText(multiattackAction.text ?? multiattackAction.name, componentNames)
    : undefined;
  const attacksPerTurn = template.stats.attacksPerTurn ?? printedSequence ?? 1;
  const hasRoutineAttacks = features.some(f => f.activationType === "action" && f.attackBonus !== undefined);
  if (!template.stats.attacksPerTurn && printedSequence !== undefined) {
    // Read, not assumed — recorded so the trace shows where the budget came from.
    assumptions.push({ feature: name, flag: "ESTIMATED", field: "action_cost",
      detail: `Action budget of ${printedSequence} read from the printed Multiattack sequence. Set Attacks per turn to make it a stated fact.` });
  } else if (!template.stats.attacksPerTurn && hasRoutineAttacks && multiattackAction) {
    assumptions.push({ feature: name, flag: "NEEDS DM INPUT", field: "action_cost",
      detail: "This creature has a Multiattack but its sequence could not be read, so the Action budget is one attack per turn — almost certainly too few. Enter Attacks per turn." });
  } else if (!template.stats.attacksPerTurn && hasRoutineAttacks) {
    assumptions.push({ feature: name, flag: "ESTIMATED", field: "action_cost",
      detail: "No Multiattack printed, so the Action budget is one attack per turn." });
  }

  return { name, ac, maxHp: template.stats.maxHp, attacksPerTurn, features, assumptions };
}

// ─── The workbook's own reading of a campaign creature ────────────────────────
//
// Christopher, 2026-08-16: *"anything that disagrees with the workbook is now legacy."*
//
// 51 Broken Chain creatures ship in the bundle already parsed BY THE WORKBOOK — AC, HP,
// calibrated trait multiplier, and each feature's channel, attack roll, save, averaged damage,
// recharge and use limit. When a creature has a profile, that profile is what the checker
// prices. The app's authored copy is not a second opinion; where the two differ, the difference
// is reported and the workbook's number is the one used.

/** A field where the app's authored creature and the workbook's record disagree. */
export type ProfileDisagreement = {
  field: string;
  app: string;
  workbook: string;
};

export type WorkbookCreature = {
  parsed: ParsedCreature;
  profile: CampaignProfile;
  /** THE calibrated trait product for this creature — supersedes any app-side trait pricing. */
  traitMultiplier: number;
  traitStackGroups: string[];
  disagreements: ProfileDisagreement[];
};

/**
 * A feature whose printed name says it takes the place of a routine attack — the workbook
 * prints "Grab (replaces one Claw)" exactly that way. It competes for ONE Multiattack slot;
 * it is not an extra attack, and counting it as one inflates the routine.
 */
export function replacesRoutineSlot(name: string | undefined): boolean {
  return /\b(?:replaces|instead of|in place of)\b/i.test(name ?? "");
}

/**
 * "STR DC 12" → 12, via the same reader the app path uses.
 *
 * ⚠ `printedText` IS THE APP'S ACTION TEXT, and it matters. The v7 profiles carry the numbers —
 * damage, attack, save, recharge — but NOT the action prose, so on their own they can say nothing
 * about "half on a success" or "30-ft. cone". The workbook being silent on those is not the
 * workbook contradicting the block; it simply does not record them. So the app's own text is read
 * for exactly the two things the profile cannot express, and for nothing else.
 */
function featureFromProfile(
  f: CampaignProfile["f"][number],
  printedText?: string,
): ParsedFeature {
  const channel = f.t === "bonus_action" ? "bonus_action"
    : f.t === "reaction" ? "reaction"
      : f.t === "trait" ? "trait"
        : "action";
  // The workbook has already averaged the damage; hand it over pre-averaged so the resolver
  // reads the number it computed rather than re-rolling the expression.
  const [average] = f.d[0] ?? [];
  return {
    name: f.n,
    activationType: channel,
    damage: average !== undefined ? `${average} (${f.d[0]?.[1] ?? ""})` : undefined,
    attackBonus: parseAttackBonus(f.a ?? undefined),
    saveDc: parseSaveDc(f.s ?? undefined),
    saveAbility: parseSaveAbility(f.s ?? printedText),
    // The profile carries no geometry, so reach/range/conditions come from the printed text.
    reachFt: parseReachFt(printedText),
    rangeFt: parseRangeFt(printedText),
    conditions: conditionsImposedBy({ text: printedText }),
    forcedMovementFt: parseForcedMovementFt(printedText),
    targets: parseTargets(f.n) ?? parseTargets(printedText),
    // The profile records the FAIL damage only. Half-on-a-success and the shape of an area live
    // in the printed text, so they are read from there — the two things the profile cannot hold.
    successDamage: parseSuccessDamage(printedText, f.d[0]?.[1]),
    isArea: (parseTargets(f.n) ?? parseTargets(printedText)) === undefined && isAreaEffect(printedText),
    recharge: f.r ? `${f.r[0]}-${f.r[1]}` : undefined,
    uses: f.u?.uses,
    spellSlotLevel: f.c ?? undefined,
    spellName: detectSpell(f.n, undefined),
    replacesRoutineSlot: replacesRoutineSlot(f.n),
    text: printedText,
  };
}

/**
 * Read a campaign creature from the workbook, and report where the app disagrees with it.
 *
 * Returns undefined when the workbook has no record — a DM's own creature, which is the normal
 * case and takes the `parseCreature` path instead.
 *
 * `attacksPerTurn` still comes from the app: the profiles publish no Multiattack size, so it is
 * the one combat field the app supplies rather than overrides.
 */
export function workbookCreature(template: MainMonsterTemplate): WorkbookCreature | undefined {
  const profile = campaignProfile(template.name);
  if (!profile) return undefined;

  const disagreements: ProfileDisagreement[] = [];
  const appAc = typeof template.stats.ac === "number"
    ? template.stats.ac : Number.parseInt(String(template.stats.ac), 10);
  if (Number.isFinite(appAc) && appAc !== profile.ac) {
    disagreements.push({ field: "AC", app: String(appAc), workbook: String(profile.ac) });
  }
  if (template.stats.maxHp !== profile.hp) {
    disagreements.push({ field: "HP", app: String(template.stats.maxHp), workbook: String(profile.hp) });
  }

  const appTraitProduct = (template.stats.defenses ?? [])
    .reduce((p, d) => p * (d.ehpMultiplier || 1), 1);
  if (Math.abs(appTraitProduct - profile.tm) > 0.005) {
    disagreements.push({
      field: "trait multiplier",
      app: `×${appTraitProduct.toFixed(3)}`,
      workbook: `×${profile.tm.toFixed(3)}`,
    });
  }

  const assumptions: FeatureAssumption[] = [];
  /**
   * ⚠ THE PROFILE CARRIES NO ATTACK COUNT, BUT THE BLOCK DOES. A profile publishes
   * `id, n, ac, hp, cr, la, tm, tt, f` — no Multiattack size, in v3 or v7. That is a fact about
   * the PROFILE, and the old note here stopped there and defaulted to one attack.
   *
   * It should never have. v7 prices Multiattack auto=YES from *"the printed legal sequence"*, and
   * the printed sequence is on the app-side action text, which this path also has. Reading the
   * profile's silence as "unknowable" discarded a fact sitting in the same template.
   */
  const profileMultiattack = (template.actions as RawAction[] | undefined)
    ?.find(a => isMultiattackAction(a.name, a.text));
  const profileComponents = (template.actions as RawAction[] | undefined)
    ?.filter(a => a !== profileMultiattack && a.name)
    .map(a => a.name as string) ?? [];
  const profileSequence = profileMultiattack
    ? multiattackCountFromText(profileMultiattack.text ?? profileMultiattack.name, profileComponents)
    : undefined;
  const attacksPerTurn = template.stats.attacksPerTurn ?? profileSequence ?? 1;
  if (!template.stats.attacksPerTurn && profileSequence !== undefined) {
    assumptions.push({ feature: profile.n, flag: "ESTIMATED", field: "action_cost",
      detail: `The workbook profile publishes no Multiattack size, so the Action budget of ${profileSequence} was read from the block's printed sequence.` });
  } else if (!template.stats.attacksPerTurn) {
    assumptions.push({ feature: profile.n, flag: "ESTIMATED", field: "action_cost",
      detail: "Neither the workbook profile nor the printed text gives a Multiattack size, so the Action budget is one attack per turn." });
  }

  /**
   * WHAT THE WORKBOOK DOES NOT PUBLISH, THE APP SUPPLIES — and a null is not a contradiction.
   *
   * The profiles carry no gating concept at all: whether a feature is usable in THIS encounter
   * is authoring the workbook never saw. Same for a recharge or use limit it recorded as null
   * while the entered block prints one. Neither is the workbook being overruled; it is silent
   * there, and silence is not an answer to override.
   *
   * Without this the Lesser Wendigo threw a gated Rend and a gated bonus-action Claw, both of
   * which its encounter says it cannot use.
   */
  const appActions = (template.actions ?? []) as RawAction[];
  const features = profile.f.map(f => {
    const app = appActions.find(a => (a?.name ?? "").trim().toLowerCase() === f.n.trim().toLowerCase());
    const parsed = featureFromProfile(f, app?.text);
    if (!app) return parsed;
    if (app.gated) {
      parsed.gated = true;
      assumptions.push({ feature: f.n, flag: "ESTIMATED", field: "timing",
        detail: `"${f.n}" is authored as unavailable under this encounter's conditions and is not counted. The workbook profile records no gating either way.` });
    }
    if (!parsed.recharge && app.recharge) {
      parsed.recharge = parseRecharge(app.recharge, app.name);
      assumptions.push({ feature: f.n, flag: "ESTIMATED", field: "timing",
        detail: `Recharge ${parsed.recharge} comes from the entered stat block; the workbook profile records none for "${f.n}".` });
    }
    return parsed;
  });

  return {
    parsed: {
      name: profile.n,
      ac: profile.ac,
      maxHp: profile.hp,
      attacksPerTurn,
      features,
      assumptions,
    },
    profile,
    traitMultiplier: profile.tm,
    traitStackGroups: profile.tt,
    disagreements,
  };
}
