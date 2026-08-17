/**
 * FEATURE RESOLUTION — v3 App Contract rows 11, 12 and 14 (all marked REQUIRED).
 *
 *   feature_resolution  "Calculate from the printed feature first. Resolve named spells only
 *                        when a stat block abbreviates them; printed dice/averages override a
 *                        library profile."
 *   spell_cast_level    "A spell cast with a stated 7th-level (or other) slot is priced at that
 *                        exact cast level. It must never be silently priced at a lower tier."
 *   unknown_mechanic    "If timing, target count, action cost, or damage is not readable, flag
 *                        NEEDS DM INPUT or ESTIMATED. Do not use a hidden CR-band substitute."
 *
 * The order of precedence is the whole design, and it runs printed-first:
 *
 *   1. PRINTED WINS.  A damage expression on the feature is the answer. The library is not
 *      consulted, even for a spell the app knows perfectly well.
 *   2. NAMED SPELL, only if the block ABBREVIATED it — a spell name and no dice. Resolved from
 *      the versioned profile AT ITS STATED CAST LEVEL.
 *   3. OTHERWISE, SAY SO.  `NEEDS_DM_INPUT` or `ESTIMATED` with the reason recorded. Never a
 *      CR-band or tier substitute — the contract calls that out twice, because a silent
 *      substitute is indistinguishable from a real answer once it reaches a total.
 */

import { spellProfile, type SpellProfile, type SrdVersion } from "./compactImport";
import { damageExpressionAverage } from "./encounterConstruction";

/** How a feature's damage was arrived at — carried all the way to the trace. */
export type DamageMethod =
  | "printed"            // read off the entered stat block
  | "named_spell"        // resolved from the versioned profile at its stated cast level
  | "needs_dm_input"     // unreadable; the DM must supply it
  | "estimated";         // resolvable in shape but not in value

export type ResolutionFlag = "NEEDS DM INPUT" | "ESTIMATED";

export type FeatureAssumption = {
  feature: string;
  flag: ResolutionFlag;
  /** What could not be read — timing, target count, action cost, or damage. */
  field: "timing" | "targets" | "action_cost" | "damage" | "cast_level";
  detail: string;
};

export type ResolvedFeature = {
  name: string;
  method: DamageMethod;
  /** Expected damage for ONE use, before hit/save probability and target count. */
  rawAverage: number;
  /** The level the spell was actually cast at, when one applies. */
  castLevel: number | null;
  /** A component that resolves on a later round, kept OUT of cast-round damage. */
  delayedAverage: number;
  notes: string[];
  assumptions: FeatureAssumption[];
};

/** The fields the parser is contractually required to read off a feature. */
export type ParsedFeature = {
  name: string;
  /** From the SECTION HEADING, never inferred from the word "Recharge". */
  activationType?: "action" | "bonus_action" | "reaction" | "legendary_action" | "lair_action" | "trait";
  damage?: string;
  attackBonus?: number;
  saveDc?: number;
  /** Printed success damage. Never assumed to be half unless the block says half. */
  successDamage?: string;
  targets?: number;
  recharge?: string;
  uses?: number;
  resourcePool?: string;
  timing?: string;
  /** A recognised spell this feature casts. */
  spellName?: string;
  /** The slot level it is cast with. THIS is what the spell is priced at. */
  spellSlotLevel?: number;
  text?: string;
};

/**
 * Damage for a spell profile at a GIVEN CAST LEVEL.
 *
 * ⚠ NEVER DOWNGRADES. If a block casts Fireball with a 7th-level slot, this returns the
 * 7th-level value — base damage plus `upcast` for every level above the spell's own base.
 * Pricing it at 3rd because that is Fireball's base level is the exact failure row 12 forbids.
 *
 * A `delayed` component (Acid Arrow's end-of-next-turn tick) is returned separately so it is
 * never folded into the cast round.
 */
export function spellDamageAtCastLevel(
  profile: SpellProfile, castLevel: number,
): { immediate: number; delayed: number } {
  const baseLevel = profile.base_level ?? profile.level ?? castLevel;
  const levelsAbove = Math.max(0, castLevel - baseLevel);

  if (profile.components?.length) {
    let immediate = 0, delayed = 0;
    for (const c of profile.components) {
      const value = Number(c.raw ?? 0) + levelsAbove * Number(c.upcast ?? 0);
      if (c.delayed) delayed += value; else immediate += value;
    }
    return { immediate, delayed };
  }
  return {
    immediate: Number(profile.raw ?? 0) + levelsAbove * Number(profile.upcast ?? 0),
    delayed: 0,
  };
}

/**
 * Resolve one feature into expected damage for a single use, with its provenance.
 *
 * Nothing here guesses. Every path either produces a number with a stated method, or an
 * assumption the DM has to answer.
 */
export function resolveFeature(
  feature: ParsedFeature,
  options: { srdVersion?: SrdVersion } = {},
): ResolvedFeature {
  const notes: string[] = [];
  const assumptions: FeatureAssumption[] = [];
  const name = feature.name || "unnamed feature";

  // ── 1. PRINTED WINS ────────────────────────────────────────────────────────
  const printed = damageExpressionAverage(feature.damage);
  if (printed > 0) {
    if (feature.spellName) {
      notes.push(`Printed damage overrides the ${feature.spellName} library profile.`);
    }
    return {
      name, method: "printed", rawAverage: printed,
      castLevel: feature.spellSlotLevel ?? null,
      delayedAverage: 0, notes, assumptions,
    };
  }

  // ── 2. NAMED SPELL, only because the block abbreviated it ──────────────────
  if (feature.spellName) {
    const profile = spellProfile(feature.spellName, options.srdVersion ?? "5.2.1");
    if (profile) {
      // The cast level is the STATED slot. Falling back to the spell's own base level is a
      // last resort and is recorded, because an unstated slot is a real ambiguity.
      const stated = feature.spellSlotLevel;
      const castLevel = stated ?? profile.base_level ?? profile.level;
      if (stated === undefined) {
        assumptions.push({
          feature: name, flag: "ESTIMATED", field: "cast_level",
          detail: `No slot level printed for ${feature.spellName}; priced at its base level ${castLevel}. If the block casts it higher, say so — it is never priced down.`,
        });
      }
      const { immediate, delayed } = spellDamageAtCastLevel(profile, castLevel);
      notes.push(`${feature.spellName} resolved at cast level ${castLevel}.`);
      if (delayed > 0) {
        notes.push(`${delayed.toFixed(1)} of it resolves on a later round and is scheduled, not added to the cast round.`);
      }
      return {
        name, method: "named_spell", rawAverage: immediate, castLevel,
        delayedAverage: delayed, notes, assumptions,
      };
    }
    assumptions.push({
      feature: name, flag: "NEEDS DM INPUT", field: "damage",
      detail: `"${feature.spellName}" is not in the versioned spell profiles. Enter its damage — the checker will not substitute a tier estimate.`,
    });
    return { name, method: "needs_dm_input", rawAverage: 0, castLevel: feature.spellSlotLevel ?? null,
      delayedAverage: 0, notes, assumptions };
  }

  // ── 3. UNREADABLE — say so, never substitute ───────────────────────────────
  if (/\d+d\d+/.test(feature.text ?? "")) {
    assumptions.push({
      feature: name, flag: "NEEDS DM INPUT", field: "damage",
      detail: "Dice appear in the printed text but no damage field was entered, so this scores 0. Enter the damage expression.",
    });
  } else if (feature.attackBonus !== undefined || feature.saveDc !== undefined) {
    assumptions.push({
      feature: name, flag: "NEEDS DM INPUT", field: "damage",
      detail: "The feature has an attack bonus or save DC but no readable damage.",
    });
  }
  return { name, method: "needs_dm_input", rawAverage: 0, castLevel: null,
    delayedAverage: 0, notes, assumptions };
}

/**
 * Expected damage for one use, after hit/save probability and target count.
 *
 * ⚠ SUCCESS DAMAGE IS THE PRINTED VALUE. The contract is explicit that half is not assumed
 * unless the block says half — a save-for-none effect priced at half is a fabricated number.
 */
export function expectedDamageForFeature(
  resolved: ResolvedFeature,
  feature: ParsedFeature,
  target: { ac: number; saveBonus: number },
): { expected: number; basis: string; assumptions: FeatureAssumption[] } {
  const assumptions = [...resolved.assumptions];
  const targets = feature.targets ?? 1;
  if (feature.targets === undefined && (feature.saveDc !== undefined)) {
    assumptions.push({
      feature: resolved.name, flag: "ESTIMATED", field: "targets",
      detail: "No target count printed for an area effect; counted as 1. The catalog's two-target value is a four-PC benchmark, not a default.",
    });
  }
  if (resolved.rawAverage <= 0) return { expected: 0, basis: "no readable damage", assumptions };

  if (feature.attackBonus !== undefined) {
    const hit = Math.min(0.95, Math.max(0.05, (21 + feature.attackBonus - target.ac) / 20));
    return {
      expected: resolved.rawAverage * hit * targets,
      basis: `${resolved.rawAverage.toFixed(1)} × ${(hit * 100).toFixed(0)}% hit${targets > 1 ? ` × ${targets}` : ""}`,
      assumptions,
    };
  }
  if (feature.saveDc !== undefined) {
    const pFail = Math.min(1, Math.max(0, (feature.saveDc - target.saveBonus - 1) / 20));
    const success = damageExpressionAverage(feature.successDamage);
    if (feature.successDamage === undefined) {
      assumptions.push({
        feature: resolved.name, flag: "ESTIMATED", field: "damage",
        detail: "No success damage printed; treated as none. Half is never assumed unless the block says half.",
      });
    }
    return {
      expected: (pFail * resolved.rawAverage + (1 - pFail) * success) * targets,
      basis: `${(pFail * 100).toFixed(0)}% fail → ${resolved.rawAverage.toFixed(1)}, else ${success.toFixed(1)}${targets > 1 ? ` × ${targets}` : ""}`,
      assumptions,
    };
  }
  return {
    expected: resolved.rawAverage * targets,
    basis: `${resolved.rawAverage.toFixed(1)} automatic${targets > 1 ? ` × ${targets}` : ""}`,
    assumptions,
  };
}
