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

export type CampaignProfile = {
  id: string;
  /** Creature name. */
  n: string;
  ac: number;
  hp: number;
  cr: number | null;
  /** Legendary action budget. */
  la: number;
  /** THE calibrated trait multiplier — the product the workbook computed for this creature. */
  tm: number;
  /** Trait stack groups this creature claims. */
  tt: string[];
  /** Features. */
  f: CampaignFeature[];
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
  campaign_profiles: CampaignProfile[];
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

/** Find a calibrated rule by its printed label. */
export function traitRule(label: string): TraitRule | undefined {
  const key = label.trim().toLowerCase();
  return TRAIT_RULES.find(r => r.label.trim().toLowerCase() === key);
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

/**
 * The workbook's own record for a campaign creature, by name.
 *
 * Returns undefined for a DM's homebrew, which is the normal case — the checker then prices
 * the entered creature. It is only campaign creatures the workbook has already measured.
 */
export function campaignProfile(name: string): CampaignProfile | undefined {
  const key = name.trim().toLowerCase();
  return COMPACT.campaign_profiles.find(p => p.n.trim().toLowerCase() === key);
}
