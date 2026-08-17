/**
 * The v3 compact import — the app's single bundled checker asset.
 *
 * Source: `encounter_checker_compact_import_v3.json`, schema
 * `fdmc.encounter-checker-compact-import.v3` 3.0.0, decoded from the Embedded App Payload of
 * `broken_chain_encounter_checker_app_ready_v3.xlsx` and SHA-256 verified (260,359 bytes)
 * against that sheet's own manifest before it was copied in.
 *
 * ⚠ ONE IMPORT, NOT TWENTY-FOUR TABS. The workbook stays the audit source and the
 * implementation contract; the app bundles only this. Its own `purpose` field states the
 * boundary Christopher drew: *"This is not a creature browser and contains no raw SRD
 * stat-block text."* The `srd_index` is 324 IDENTIFICATION records — name, id, AC, HP, CR — so
 * the checker can recognise a creature a DM names. It is not a catalogue to browse, and it
 * carries no stat-block prose. A DM builds their own creatures; this prices them.
 */

import raw from "../../data/checker/encounter_checker_compact_import_v3.json";

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
  campaign_profiles: Array<Record<string, unknown>>;
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

/** Identify a creature the DM named, for reference only — never to supply its stat block. */
export function srdIdentify(name: string): SrdIndexEntry | undefined {
  const key = name.trim().toLowerCase();
  return COMPACT.srd_index.find(e => e.n.toLowerCase() === key);
}
