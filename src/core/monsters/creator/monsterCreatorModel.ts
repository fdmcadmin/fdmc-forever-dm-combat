/**
 * Monster Creator generation model — single source of truth (Monster Gate, MG1).
 *
 * The guided monster creator is a REFERENCE SCAFFOLD, not a CR calculator, rules validator, or
 * auto-balancer. Every value it produces is a starting point the DM manually reviews and may
 * override. See `_specs/MONSTER-GATE-SPEC.md` and the source model
 * `fdmc-monster-creator-archetype-stat-ac-model-v1.md` (the numeric truth this file encodes).
 *
 * This module was extracted verbatim from the inline model in `core/ui/MonsterJconBuilder.tsx`
 * so later Monster-Gate phases (and any future encounter/creator tooling) share ONE definition
 * instead of a copy buried in a 1100-line component. MG1 is a pure refactor: identical values,
 * no behavior change. The classification leans (§9) and action-economy tiers (§10) are added here
 * as first-class data — they were described in the source model but never coded; MG4 consumes them.
 *
 * GUARDRAIL: do NOT add an exact archetype AC-modifier table ("Guardian +2 AC"). None was ever
 * designed. Baseline AC comes from the party-level band only; any numeric lean stays preview-only
 * until Christopher approves it (source model §11).
 */

import type { MonsterAbilityId } from "../../types/monsterTypes";

export type MonsterLevelBandId = "low" | "mid" | "high" | "extreme" | "final";
export type MonsterPressureId = "standard" | "strong" | "elite" | "bossGate";

export type HpReference = {
  low: number;
  high: number | null;
  suggested: number;
};

export type MonsterLevelBandInfo = {
  label: string;
  shortLabel: string;
  primary: number;
  secondary: number;
  floor: number;
  attackBonus: number;
  damage: string;
  critDamage: string;
  suggestedHp: number;
  suggestedAc: number;
  hpReferences: Record<MonsterPressureId, HpReference>;
};

export const ABILITY_IDS: MonsterAbilityId[] = ["str", "dex", "con", "int", "wis", "cha"];

/** Six primary-ability creature styles (source model §3.3 / §6). "How it FIGHTS." */
export const ABILITY_STYLE_LABELS: Record<MonsterAbilityId, string> = {
  str: "STR bruiser / brute",
  dex: "DEX hunter / skirmisher",
  con: "CON endurance / guardian",
  int: "INT caster / tactician",
  wis: "WIS predator / mystic",
  cha: "CHA presence / commander",
};

/** Encounter-pressure tiers (source model §3.2). Selects HP reference; does NOT change AC. */
export const PRESSURE_LABELS: Record<MonsterPressureId, string> = {
  standard: "Standard table",
  strong: "Strong party",
  elite: "Elite creature",
  bossGate: "Boss / gate phase",
};

export const PRESSURE_NOTES: Record<MonsterPressureId, string> = {
  standard: "baseline quick combat creature",
  strong: "stronger party, magic items, or favorable player action economy",
  elite: "mini-boss, dangerous solo, or sturdy named enemy",
  bossGate: "boss, phase wall, ritual gate, or set-piece endurance target",
};

/**
 * Party-level baseline table (source model §4 / §7 / §8). Establishes ability baselines, attack
 * bonus, starter damage, baseline AC, and per-pressure HP references. `suggestedHp`/`suggestedAc`
 * are the band's plain defaults before a pressure tier is chosen.
 */
export const LEVEL_BANDS: Record<MonsterLevelBandId, MonsterLevelBandInfo> = {
  low: {
    label: "Low party level 1–4",
    shortLabel: "low 1–4",
    primary: 14,
    secondary: 12,
    floor: 8,
    attackBonus: 4,
    damage: "1d6 + 2",
    critDamage: "2d6 + 2",
    suggestedHp: 22,
    suggestedAc: 13,
    hpReferences: {
      standard: { low: 11, high: 35, suggested: 22 },
      strong: { low: 35, high: 55, suggested: 44 },
      elite: { low: 55, high: 75, suggested: 65 },
      bossGate: { low: 75, high: null, suggested: 90 },
    },
  },
  mid: {
    label: "Mid party level 5–8",
    shortLabel: "mid 5–8",
    primary: 16,
    secondary: 14,
    floor: 10,
    attackBonus: 6,
    damage: "2d6 + 3",
    critDamage: "4d6 + 3",
    suggestedHp: 65,
    suggestedAc: 15,
    hpReferences: {
      standard: { low: 45, high: 90, suggested: 65 },
      strong: { low: 90, high: 135, suggested: 110 },
      elite: { low: 135, high: 190, suggested: 160 },
      bossGate: { low: 190, high: null, suggested: 220 },
    },
  },
  high: {
    label: "High party level 9–12",
    shortLabel: "high 9–12",
    primary: 18,
    secondary: 16,
    floor: 10,
    attackBonus: 8,
    damage: "3d8 + 4",
    critDamage: "6d8 + 4",
    suggestedHp: 135,
    suggestedAc: 17,
    hpReferences: {
      standard: { low: 90, high: 160, suggested: 125 },
      strong: { low: 160, high: 235, suggested: 195 },
      elite: { low: 235, high: 320, suggested: 275 },
      bossGate: { low: 320, high: null, suggested: 360 },
    },
  },
  extreme: {
    label: "Extreme party level 13–16",
    shortLabel: "extreme 13–16",
    primary: 20,
    secondary: 18,
    floor: 12,
    attackBonus: 10,
    damage: "4d10 + 5",
    critDamage: "8d10 + 5",
    suggestedHp: 230,
    suggestedAc: 19,
    hpReferences: {
      standard: { low: 160, high: 260, suggested: 215 },
      strong: { low: 260, high: 380, suggested: 315 },
      elite: { low: 380, high: 520, suggested: 450 },
      bossGate: { low: 520, high: null, suggested: 600 },
    },
  },
  final: {
    label: "Final party level 17–20",
    shortLabel: "final 17–20",
    primary: 22,
    secondary: 20,
    floor: 12,
    attackBonus: 12,
    damage: "6d10 + 6",
    critDamage: "12d10 + 6",
    suggestedHp: 360,
    suggestedAc: 21,
    hpReferences: {
      standard: { low: 260, high: 420, suggested: 340 },
      strong: { low: 420, high: 650, suggested: 520 },
      elite: { low: 650, high: 900, suggested: 760 },
      bossGate: { low: 900, high: null, suggested: 1000 },
    },
  },
};

/**
 * Qualitative classification leans (source model §9). Design guidance for MANUAL tuning and the
 * MG4 lean preview — NOT automatic rules and NOT numeric modifiers. Keyed by primary-ability style.
 */
export type ClassificationLean = {
  label: string;
  durability: string;
  mobility: string;
  defense: string;
  action: string;
};

export const CLASSIFICATION_LEANS: Record<MonsterAbilityId, ClassificationLean> = {
  str: {
    label: "Bruiser / Brute / Giant",
    durability: "High STR and CON; higher HP lean; lower DEX",
    mobility: "Normal or reduced",
    defense: "Survives by body mass and HP more than avoidance",
    action: "Heavy melee hits, shove, grab, knockdown",
  },
  dex: {
    label: "Hunter / Skirmisher",
    durability: "High DEX; lower HP lean",
    mobility: "Higher speed, climb, disengage, leap, reposition",
    defense: "Avoidance and movement rather than heavy armor",
    action: "Mobile attacks, mark, flank, hit-and-move",
  },
  con: {
    label: "Endurance / Guardian",
    durability: "High CON; tank lean",
    mobility: "Normal or reduced",
    defense: "Higher AC and/or damage reduction; holds space",
    action: "Intercept, protect, lock down, punish movement",
  },
  int: {
    label: "Caster / Controller",
    durability: "High INT, WIS, or CHA; lower physical lean",
    mobility: "Normal, teleport, or protected positioning",
    defense: "Lower or baseline AC unless magic defense is part of the concept",
    action: "Saves, zones, debuffs, control, limited high-impact spells",
  },
  wis: {
    label: "Predator / Mystic",
    durability: "High WIS; strong perception/instinct",
    mobility: "Often higher pursuit or unusual movement",
    defense: "Baseline defense with senses, stealth, or supernatural protection",
    action: "Ambush, tracking, fear, nature/divine effects",
  },
  cha: {
    label: "Presence / Commander",
    durability: "High CHA; leadership or aura identity",
    mobility: "Normal",
    defense: "Baseline defense, allies or reactions may provide protection",
    action: "Commands, auras, fear, ally movement, tactical support",
  },
};

/**
 * Action-economy scaffold (source model §10) — how many KINDS of combat tools a creature gets.
 * Separate axis from both style and encounter pressure ("Bruiser" ≠ "Elite"; "Boss" doesn't set
 * the primary ability). This is the guided starting shape, not a cap.
 */
export type ActionEconomyTierId = "normal" | "strong" | "elite" | "boss";

export const ACTION_ECONOMY_TIERS: Record<ActionEconomyTierId, { label: string; scaffold: string }> = {
  normal: { label: "Normal", scaffold: "Action + Trait" },
  strong: { label: "Strong", scaffold: "Action + Recharge + up to 3 Traits" },
  elite: { label: "Elite", scaffold: "Action + Bonus Action + Reaction + up to 3 Traits" },
  boss: {
    label: "Boss",
    scaffold: "Action or Multiattack + Bonus Action + Reaction + Recharge/Phase + 3 or more Traits",
  },
};

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/**
 * Guided ability-spread rule (source model §5). Starts every ability at the band floor, sets CON
 * to the secondary value, sets the chosen primary to the primary value, then keeps DEX / CON / WIS
 * from collapsing so no creature becomes unnaturally immobile or fragile.
 */
export function buildGuidedAbilities(
  primaryAbility: MonsterAbilityId,
  band: MonsterLevelBandId,
): Record<MonsterAbilityId, { score: number; modifier: number }> {
  const bandInfo = LEVEL_BANDS[band];
  const base: Record<MonsterAbilityId, number> = {
    str: bandInfo.floor,
    dex: bandInfo.floor,
    con: bandInfo.secondary,
    int: bandInfo.floor,
    wis: bandInfo.floor,
    cha: bandInfo.floor,
  };

  base[primaryAbility] = bandInfo.primary;

  if (primaryAbility !== "dex") {
    base.dex = Math.max(base.dex, bandInfo.floor + 2);
  }

  if (primaryAbility !== "con") {
    base.con = Math.max(base.con, bandInfo.secondary);
  }

  if (primaryAbility === "int" || primaryAbility === "wis" || primaryAbility === "cha") {
    base.wis = Math.max(base.wis, bandInfo.secondary - 2);
  }

  return Object.fromEntries(
    ABILITY_IDS.map((abilityId) => [
      abilityId,
      {
        score: base[abilityId],
        modifier: abilityModifier(base[abilityId]),
      },
    ]),
  ) as Record<MonsterAbilityId, { score: number; modifier: number }>;
}
