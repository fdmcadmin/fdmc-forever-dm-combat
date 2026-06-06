/**
 * deriveActorStats
 *
 * Calculates the actor's final stats by stacking equipment effects
 * on top of base profile values.
 *
 * Order of operations:
 *   1. Start with base profile stats (ability scores, AC, HP, speed)
 *   2. Apply setStat overrides (Belt of Hill Giant Strength → STR 21)
 *   3. Apply addStat additives (+2 STR from Gauntlets)
 *   4. Apply setAC (armor that replaces the AC formula)
 *   5. Apply addAC (shield +2, ring +1)
 *   6. DEX modifier applies to AC if armor allows it
 *
 * Display format when modified: "21(9)" — derived(base) — modifier from DERIVED
 */

import type { Actor } from "../types/actor";
import type { EquipmentItem, AbilityStatId, StatEffect } from "../ui/EquipmentBagEditor";
import { loadEquipmentLibrary } from "../ui/EquipmentBagEditor";
import type { ActorStatusTrackerState } from "../types/status";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DerivedAbilityScore = {
  /** The effective (modified) score shown on the card */
  score: number;
  /** The base profile score — shown in parens if different from score */
  baseScore: number;
  /** Derived modifier from effective score */
  modifier: number;
  /** Whether equipment is currently modifying this stat */
  isModified: boolean;
  /** Which item is modifying it (for tooltip) */
  modifiedBy?: string;
};

export type DerivedStats = {
  str: DerivedAbilityScore;
  dex: DerivedAbilityScore;
  con: DerivedAbilityScore;
  int: DerivedAbilityScore;
  wis: DerivedAbilityScore;
  cha: DerivedAbilityScore;
  ac: number;
  acBase: number;         // before equipment
  acModifiedBy: string[]; // which items contributed
  hpMax: number;
  hpMaxBase: number;
  speed: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

function makeDerived(score: number, base: number, modifiedBy?: string): DerivedAbilityScore {
  return {
    score,
    baseScore: base,
    modifier: calcModifier(score),
    isModified: score !== base,
    modifiedBy: score !== base ? modifiedBy : undefined,
  };
}

// ─── Synthesize StatEffect from ac string field ───────────────────────────────
// Covers items that have ac: "14", "+2", "11 + DEX", "14 + DEX (max 2)" etc.
// "+N" → addAC (shield, ring); leading number → setAC (armor base)

function synthesizeAcEffect(item: EquipmentItem): StatEffect | undefined {
  const ac = item.ac?.trim();
  if (!ac) return undefined;
  if (ac.startsWith("+")) {
    const val = parseInt(ac.slice(1), 10);
    if (!isNaN(val) && val > 0) return { type: "addAC", value: val };
  } else {
    const match = /^(\d+)/.exec(ac);
    if (match) {
      const val = parseInt(match[1], 10);
      if (!isNaN(val) && val > 0) return { type: "setAC", value: val };
    }
  }
  return undefined;
}

// ─── Get equipped items from actor + library ──────────────────────────────────

export function getEquippedLibraryItems(actor: Actor): EquipmentItem[] {
  const library = loadEquipmentLibrary();
  const equippedActions = actor.tabs.equipment ?? [];
  const items: EquipmentItem[] = [];

  for (const action of equippedActions) {
    // Match action to library item by id
    const strippedId = action.id.replace(/^equip-/, "");
    const item = library.find(i =>
      i.id === strippedId ||
      i.id === action.id ||
      `equip-${i.id}` === action.id ||
      i.id === `bc-equip-${strippedId}`
    );
    if (!item) continue;

    if (item.statEffects?.length) {
      items.push(item);
    } else if (item.ac) {
      // Synthesize statEffects from ac string so deriveActorStats picks it up
      const synth = synthesizeAcEffect(item);
      if (synth) items.push({ ...item, statEffects: [synth] });
    }
  }

  return items;
}

// ─── Main derivation function ─────────────────────────────────────────────────

export function deriveActorStats(
  actor: Actor,
  equippedItems?: EquipmentItem[],
  /** Current drain state — reduces effective ability scores */
  drainState?: ActorStatusTrackerState
): DerivedStats {
  const items = equippedItems ?? getEquippedLibraryItems(actor);

  // Base values from profile
  const base = {
    str: actor.abilityScores?.str?.score ?? 10,
    dex: actor.abilityScores?.dex?.score ?? 10,
    con: actor.abilityScores?.con?.score ?? 10,
    int: actor.abilityScores?.int?.score ?? 10,
    wis: actor.abilityScores?.wis?.score ?? 10,
    cha: actor.abilityScores?.cha?.score ?? 10,
  };

  const derived = { ...base };
  const modifiedBy: Record<AbilityStatId, string | undefined> = {
    str: undefined, dex: undefined, con: undefined,
    int: undefined, wis: undefined, cha: undefined,
  };

  let baseAC = actor.stats.ac;
  let acOverridden = false;
  const acModifiedBy: string[] = [];
  let acBonus = 0;
  let hpMaxBonus = 0;

  // Pass 1: setStat overrides (item forces a stat to a specific value)
  for (const item of items) {
    for (const effect of item.statEffects ?? []) {
      if (effect.type === "setStat" && effect.stat) {
        const current = derived[effect.stat];
        // Set overrides always win — they don't stack with each other
        // Use the higher of current or the set value (some belts "set to X if higher")
        derived[effect.stat] = Math.max(current, effect.value);
        modifiedBy[effect.stat] = item.name;
      }
      if (effect.type === "setAC") {
        if (!acOverridden || effect.value > baseAC) {
          baseAC = effect.value;
          acOverridden = true;
          acModifiedBy.push(`${item.name} (base ${effect.value})`);
        }
      }
    }
  }

  // Pass 2: addStat additives
  for (const item of items) {
    for (const effect of item.statEffects ?? []) {
      if (effect.type === "addStat" && effect.stat) {
        derived[effect.stat] += effect.value;
        modifiedBy[effect.stat] = modifiedBy[effect.stat]
          ? `${modifiedBy[effect.stat]}, ${item.name}`
          : item.name;
      }
      if (effect.type === "addAC") {
        acBonus += effect.value;
        acModifiedBy.push(`${item.name} (+${effect.value})`);
      }
      if (effect.type === "addHP") {
        hpMaxBonus += effect.value;
      }
    }
  }

  // Pass 3: apply drain effects — drain reduces effective score
  // STR drain: "STR Drain 4/6" means STR is reduced by current drain value
  if (drainState?.strDrain) {
    const drainAmount = drainState.strDrain.current ?? 0;
    if (drainAmount > 0) {
      derived.str = Math.max(1, derived.str - drainAmount);
      modifiedBy.str = modifiedBy.str
        ? `${modifiedBy.str}, STR Drained -${drainAmount}`
        : `STR Drained -${drainAmount}`;
    }
  }
  // Life drain reduces CON (common undead mechanic)
  if (drainState?.lifeDrain) {
    const drainAmount = drainState.lifeDrain.current ?? 0;
    if (drainAmount > 0) {
      derived.con = Math.max(1, derived.con - drainAmount);
      modifiedBy.con = modifiedBy.con
        ? `${modifiedBy.con}, Life Drained -${drainAmount}`
        : `Life Drained -${drainAmount}`;
    }
  }

  // DEX cap for armor: if armor was set with setAC, DEX mod may apply
  // Simple rule: if AC was overridden by armor, add DEX mod unless armor is heavy
  // (Heavy armor: no DEX; Medium: cap +2; Light/Unarmored: full DEX)
  // For now we trust the player's base AC already accounts for this at profile time
  // Equipment AC additions are flat bonuses (shields, rings, etc.)
  const finalAC = baseAC + acBonus;

  return {
    str: makeDerived(derived.str, base.str, modifiedBy.str),
    dex: makeDerived(derived.dex, base.dex, modifiedBy.dex),
    con: makeDerived(derived.con, base.con, modifiedBy.con),
    int: makeDerived(derived.int, base.int, modifiedBy.int),
    wis: makeDerived(derived.wis, base.wis, modifiedBy.wis),
    cha: makeDerived(derived.cha, base.cha, modifiedBy.cha),
    ac: finalAC,
    acBase: actor.stats.ac,
    acModifiedBy,
    hpMax: actor.stats.hp.max + hpMaxBonus,
    hpMaxBase: actor.stats.hp.max,
    speed: typeof actor.stats.speed === "string" ? actor.stats.speed : "30 ft",
  };
}

// ─── Format display strings ────────────────────────────────────────────────────

/** "21(9)" when modified, "9" when not */
export function formatDerivedScore(derived: DerivedAbilityScore): string {
  if (!derived.isModified) return String(derived.score);
  return `${derived.score}(${derived.baseScore})`;
}

/** "+5" or "-1" */
export function formatModifier(modifier: number): string {
  return modifier >= 0 ? `+${modifier}` : String(modifier);
}
