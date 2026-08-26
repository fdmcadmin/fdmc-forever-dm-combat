/**
 * The v7 runtime bundle — the app's single bundled checker asset.
 *
 * Source: `encounter_checker_runtime_package_v7_pricing_ac_save.json`, schema version 6.3.2,
 * from the v7 pricing/AC-save bundle Christopher supplied.
 *
 * ⚠ v7 IS RULE ONE. Christopher, 2026-08-20: *"purge any verson that is not v7 … v7 is the new
 * rule, Rule 1."* There is now exactly one checker asset in the app and it is this one.
 *
 * The v3 compact import it replaced (`encounter_checker_compact_import_v3.json`, 260,359 bytes)
 * is DELETED, not merely unreferenced — a superseded bundle sitting in the tree is the next
 * session's plausible-looking source. v7 is a strict superset: identical contract shape, the same
 * 58 calibrated trait rules, the same expected-monster-AC and AC-contribution tables, the same
 * spell profiles, the same 51 campaign profiles and the same parser rules, verified section by
 * section before the delete. Four sections DIFFER and the app had been reading the stale side of
 * every one: `party_curve`, `campaign_semantics`, `campaign_presets` and `effect_families`.
 *
 * ⚠ AND `whole_body_attrition` WAS IN v3 TOO. The rule the engine broke until 0.7.10.52 had been
 * sitting in the bundled asset the whole time — this was never a case of the workbook moving ahead
 * of the app. The app simply did not implement a rule it already shipped.
 *
 * ⚠ ONE IMPORT, NOT TWENTY-FOUR TABS. The workbook stays the audit source and the
 * implementation contract; the app bundles only this. Its own `purpose` field states the
 * boundary Christopher drew: *"This is not a creature browser and contains no raw SRD
 * stat-block text."* The `srd_index` is 324 IDENTIFICATION records — name, id, AC, HP, CR — so
 * the checker can recognise a creature a DM names. It is not a catalogue to browse, and it
 * carries no stat-block prose. A DM builds their own creatures; this prices them.
 */

import raw from "../../data/checker/v7-runtime.json";

// ─── Shapes (only the parts the app consumes are typed) ───────────────────────

export type SpellComponent = {
  name: string;
  raw: number;
  mode: "attack" | "save" | "auto" | string;
  /** Share of the printed damage that still lands on a miss/success. */
  miss_fraction?: number;
  /** Added per slot level ABOVE the spell's base level. */
  upcast?: number;
  /** Resolves later than the cast round; must not be folded into cast-round DPR. */
  delayed?: boolean;
};

export type SpellProfile = {
  level: number;
  raw: number;
  mode: "attack" | "save" | "auto" | "composite" | string;
  base_level?: number;
  upcast?: number;
  miss_fraction?: number;
  components?: SpellComponent[];
};

export type EffectFamily = {
  family: string;
  channel: "sustain" | "damage" | "control" | string;
  model: string;
  guidance: string;
};

export type SrdIndexEntry = {
  n: string; id: string; v: string; p: string;
  ac: number; hp: number; cr: number | null;
  variants?: string[];
};

/**
 * THE WORKBOOK'S OWN PARSE OF A CAMPAIGN CREATURE.
 *
 * 51 of them ship in the bundle — every Broken Chain creature, read by the workbook itself:
 * its AC, its HP, its calibrated trait multiplier, its trait stack groups, and each feature
 * with the activation channel, attack roll, save, averaged damage, recharge and use limit
 * already resolved.
 *
 * ⚠ THIS IS THE LAW. Christopher, 2026-08-16: *"anything that disagrees with the workbook is
 * now legacy."* Where an app-authored creature disagrees with its profile here, the profile
 * wins and the disagreement is stated. The app is not a second opinion about a creature the
 * workbook has already measured across 80k sustain calibrations.
 */
export type CampaignFeature = {
  /** Printed feature name. */
  n: string;
  /** Activation channel, from the section heading. */
  t: "trait" | "action" | "bonus_action" | "reaction" | string;
  /** What kind of thing it is: trait, attack, action, reaction. */
  k: string;
  /** Recharge range as [min, max]. Availability only — never a channel. */
  r: [number, number] | null;
  /** Use limit, e.g. `{ uses: 1, period: "day" }`. */
  u: { uses: number; period: string } | null;
  /** Printed attack roll, e.g. "1d20 + 6". */
  a: string | null;
  /** Printed save, e.g. "STR DC 12". */
  s: string | null;
  /** Damage as [average, expression, type] — the workbook has already averaged it. */
  d: Array<[number, string, string]>;
  /** Cast level, when the feature casts a spell. */
  c: number | null;
  /** Spell level. */
  l: number | null;
  /** Rechargeable — the ability replaces the routine Action when it is up. */
  rr: boolean;
};


export type CompactImport = {
  schema: string;
  version: string;
  purpose: string;
  contract: Record<string, unknown> & {
    damage?: {
      action_economy?: string[];
      interpretation?: Record<string, string>;
    };
  };
  parser: {
    source_of_truth: string;
    required_feature_fields: string[];
    action_type_source: string;
    save_patterns: string[];
    success_patterns: string[];
    unknown_policy: string;
  };
  spell_profiles: Record<string, Record<string, SpellProfile>>;
  full_caster_slots: Array<Record<string, number>>;
  effect_families: EffectFamily[];
  srd_index: SrdIndexEntry[];
  campaign_presets: Array<Record<string, unknown>>;
  source_policy: Record<string, unknown>;
};

export const COMPACT: CompactImport = raw as unknown as CompactImport;

/** The SRD version a lookup should use. 5.2.1 is the default; 5.1 is kept as a separate record. */
export type SrdVersion = "5.2.1" | "5.1";

/**
 * Look up a named spell's profile. Names are matched case-insensitively against the
 * versioned table; an unrecognised name returns undefined so the caller can flag it rather
 * than substitute anything.
 */
export function spellProfile(name: string, version: SrdVersion = "5.2.1"): SpellProfile | undefined {
  const table = COMPACT.spell_profiles[version] ?? COMPACT.spell_profiles["5.2.1"];
  if (!table) return undefined;
  const key = name.trim().toLowerCase();
  return table[key];
}

export function effectFamily(family: string): EffectFamily | undefined {
  return COMPACT.effect_families.find(f => f.family === family);
}

// ─── The calibration: what a creature's traits are WORTH ──────────────────────
//
// This is the answer to "why would we not put in the things that tell us what a creature can
// do" — all of it ships in the bundle and none of it needs transcribing by hand. 58 calibrated
// trait rules, each carrying its own STACK GROUP so the double-count guard is data rather than
// a name I invented, plus the expected-AC curve for levels 3-20 and the AC contribution bands.

export type TraitRule = {
  label: string;
  contribution: number;
  multiplier: number;
  /** The double-count key. Two rules sharing one are the SAME effect and must not both apply. */
  stack_group: string;
  application: string;
  scope: string;
  status: string;
};

const SUSTAIN = (COMPACT.contract as { sustain?: Record<string, unknown> }).sustain ?? {};

/** All 58 calibrated trait rules. The reference a DM's homebrew trait is priced against. */
export const TRAIT_RULES: TraitRule[] = (SUSTAIN.trait_rules as TraitRule[]) ?? [];

/** Monster AC the model expects at each party level, 3-20. */
export const EXPECTED_MONSTER_AC: Record<number, number> =
  Object.fromEntries(Object.entries((SUSTAIN.expected_monster_ac as Record<string, number>) ?? {})
    .map(([k, v]) => [Number(k), v]));

/** AC delta → effective-HP contribution. Bands are CUMULATIVE VALUES, not increments. */
export const AC_CONTRIBUTION: Record<number, number> =
  Object.fromEntries(Object.entries((SUSTAIN.ac_contribution as Record<string, number>) ?? {})
    .map(([k, v]) => [Number(k), v]));

/**
 * WHAT A RULE WITH NO MULTIPLIER ACTUALLY IS — and it is not "unpriced".
 *
 * ⚠ THE APP USED ONE WORD FOR FOUR DIFFERENT ANSWERS. Eighteen of the fifty-eight calibrated
 * rules carry no `multiplier`, and the app printed every one of them as "unpriced" — which reads
 * as "the workbook has nothing to say about this" when the workbook says something specific about
 * each. The `status` column has carried the real answer the whole time:
 *
 *   formula     the model needs ENCOUNTER inputs, so no single ×1.xxx can exist — Parry, damage
 *               transfer, once-per-round halving, shared HP, temporary HP, save rerolls
 *   profile     it needs the PARTY's composition — Limited Spell Immunity needs the party's
 *               affected spell share
 *   tag_only    worth what the opposing party's actual control makes it worth — Condition Immunity
 *   no_credit   deliberately ZERO for this encounter — Rejuvenation happens AFTER the fight, so it
 *               does not make the creature harder to beat in it
 *
 * Christopher, on the v10 workbook: *"null multiplier + formula/profile/tag_only/no_credit ≠
 * UNPRICED [...] the app is still using 'does this have a numeric multiplier?' as its definition
 * of priced, while the workbook's definition is 'does this mechanic have a supported resolution
 * model?' Those are no longer the same thing."*
 *
 * ⚠ AND ADDING A FIXED MULTIPLIER TO SILENCE THEM WOULD BE THE WRONG FIX — his words, and the
 * workbook's: v10's Generic Trait Fallback sheet says of a single elemental resistance
 * "Party-share weighted; no fixed blanket multiplier [...] Do not assume ~50% party damage."
 *
 * Only a null multiplier with NO recognised status is genuinely unpriced.
 */
export type PricingModel = "multiplier" | "formula" | "profile" | "conditional" | "no_credit" | "unpriced";

const MODEL_BY_STATUS: Record<string, PricingModel> = {
  formula: "formula",
  profile: "profile",
  tag_only: "conditional",
  no_credit: "no_credit",
};

export function pricingModelOf(rule: Pick<TraitRule, "multiplier" | "status">): PricingModel {
  if (rule.multiplier != null) return "multiplier";
  return MODEL_BY_STATUS[String(rule.status ?? "").trim().toLowerCase()] ?? "unpriced";
}

/** How that model reads on a card or an editor row. Short, because it sits beside a name. */
export const PRICING_MODEL_LABEL: Record<PricingModel, string> = {
  multiplier: "",
  formula: "Formula",
  profile: "Party Profile",
  conditional: "Conditional",
  no_credit: "0 — Post Encounter",
  unpriced: "UNPRICED",
};

/** The one-line reason, for a tooltip — so the label is never just a word. */
export const PRICING_MODEL_WHY: Record<PricingModel, string> = {
  multiplier: "",
  formula: "Priced by a formula that needs encounter inputs, so there is no single effective-HP multiplier for it.",
  profile: "Priced against this party's actual composition rather than a fixed figure.",
  conditional: "Worth what the opposing party's actual use of that control makes it worth.",
  no_credit: "Correctly worth zero for THIS encounter — it happens after the fight, so it does not make the creature harder to beat in it.",
  unpriced: "No resolution model in the workbook. This one really is a gap.",
};

/** Find a calibrated rule by its printed label. */
export function traitRule(label: string): TraitRule | undefined {
  const key = label.trim().toLowerCase();
  return TRAIT_RULES.find(r => r.label.trim().toLowerCase() === key);
}

/**
 * Which calibrated rule a defence actually IS, when its `rule` and its `name` disagree.
 *
 * ⚠ THE ONE THAT AGREES WITH THE MULTIPLIER IS THE ONE THAT WAS PICKED. A stale `rule` left over
 * from an earlier selection is not a second opinion, it is debris — and the multiplier says which
 * of the two is debris, because it was written at the same moment as the pick.
 *
 * The Veilbound Drake Guard is the case: name "Resistance - ~50% of opposing damage", multiplier
 * 1.3418341811719772 which is that rule exactly, and `rule` reading "First attack each round at
 * disadvantage" from a previous pick. Resolving `rule` first priced it as the wrong trait and
 * blocked its publish.
 *
 * Falls back to `rule` then `name` when neither matches, so a genuinely bespoke multiplier still
 * reports against whichever rule it claims.
 */
export function resolveTraitRule(
  defence: { name: string; rule?: string; ehpMultiplier?: number },
): TraitRule | undefined {
  const byRule = defence.rule ? traitRule(defence.rule) : undefined;
  const byName = traitRule(defence.name);
  const x = defence.ehpMultiplier ?? 1;
  const agrees = (r: TraitRule | undefined) =>
    r && r.contribution !== null && Math.abs((1 + r.contribution) - x) < 5e-6;
  if (agrees(byRule)) return byRule;
  if (agrees(byName)) return byName;
  return byRule ?? byName;
}

/**
 * Every distinct stack group in the calibration — the vocabulary an authored trait can claim.
 * Two traits on one creature sharing a group are one effect counted twice.
 */
export function stackGroups(): string[] {
  return [...new Set(TRAIT_RULES.map(r => r.stack_group))].sort();
}

/** Identify a creature the DM named, for reference only — never to supply its stat block. */
export function srdIdentify(name: string): SrdIndexEntry | undefined {
  const key = name.trim().toLowerCase();
  return COMPACT.srd_index.find(e => e.n.toLowerCase() === key);
}
