/**
 * ENCOUNTER CHECKER v2 — a faithful TypeScript port of `encounter_checker_reference_v2.mjs`.
 *
 * Source: the Embedded App Payload of `broken_chain_encounter_checker_app_ready_v2.xlsx`,
 * decoded from base64 and SHA-256 verified against that sheet's manifest
 * (dcbc288b2231ba1bd0ee873dab75f7187815b5932e1ce747e8ef055f53dae788). Its own test suite
 * runs 11/11 green.
 *
 * So this is a PORT, not an adaptation — the arithmetic, the names and the semantics match the
 * reference line for line, so any future divergence is a bug rather than a design choice. It
 * replaces a set of terms I invented and which have NO counterpart in the contract:
 *
 *  · `attritionFactor` (n+1)/2n           → superseded by continuous group depletion
 *  · `KILLED_BODY_DPR_RETAINED`           → superseded by the same
 *  · `LETHAL_ENEMY_REMAINING` (35%)       → the contract reports a fatal ROUND, not a threshold
 *  · `DPR_FLAT_FROM_ROUND`                → the R4+ profile already says this
 *  · authored per-PC thresholds           → the contract gives every PC an EQUAL pool
 *
 * The differences that matter most, all of which the old model got wrong:
 *  1. Party damage SCALES with survivors (× standing ÷ size); monster damage does NOT.
 *  2. A wounded group deals proportionally less — it does not fight at full output until dead.
 *  3. Every PC has `partySustain / partySize`, not an authored share.
 *  4. The party-size multiplier lives INSIDE effective HP, and never touches DPR.
 *  5. Effective HP divides by damage pass and damage uptime — two channels absent before.
 */

import {
  partySizeHpMultiplier,
  partyCurveRow,
  type PartyEquipmentMode,
} from "./partyCurveV2";

export { partySizeHpMultiplier };

const EPSILON = 1e-9;

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

// ─── Sustain ──────────────────────────────────────────────────────────────────

export type SustainFactor = {
  /**
   * REQUIRED. The double-count guard is enforced, not advisory: two factors sharing a stack
   * group throw, so one effect cannot be credited twice under two labels.
   */
  stackGroup: string;
  label?: string;
  contribution: number;
};

/**
 * PRODUCT(1 + contribution) − 1, never a sum.
 *
 * The workbook's Sustain Calibration sheet states this three times and backs it with
 * "600 / 600 retained cases exact", reproducing the original 80,000-case rule. An earlier
 * pass in this app made contributions additive; that was wrong.
 */
export function combineSustainContributions(factors: SustainFactor[] = []): number {
  const seen = new Set<string>();
  let multiplier = 1;
  for (const factor of factors) {
    const stackGroup = String(factor.stackGroup ?? factor.label ?? "").trim();
    if (!stackGroup) throw new TypeError("every sustain factor needs a stackGroup");
    if (seen.has(stackGroup)) throw new Error(`duplicate sustain stackGroup: ${stackGroup}`);
    seen.add(stackGroup);
    const contribution = Number(factor.contribution);
    if (!Number.isFinite(contribution) || contribution <= -1) {
      throw new RangeError(`invalid sustain contribution for ${stackGroup}`);
    }
    multiplier *= 1 + contribution;
  }
  return multiplier - 1;
}

// ─── Probability ──────────────────────────────────────────────────────────────

export function attackHitProbability(attackBonus: number, targetAc: number): number {
  return clamp((21 + attackBonus - targetAc) / 20, 0.05, 0.95);
}

export function expectedAttackDamage(
  rawAverage: number, attackBonus: number, targetAc: number, targetCount = 1,
): number {
  return rawAverage * attackHitProbability(attackBonus, targetAc) * targetCount;
}

export function saveFailureProbability(saveDc: number, targetSaveBonus: number): number {
  return clamp((saveDc - targetSaveBonus - 1) / 20, 0, 1);
}

/** ⚠ Uses the PRINTED success damage. Never assume half unless the block says half. */
export function expectedSaveDamage(opts: {
  failureAverage: number;
  successAverage?: number;
  saveDc: number;
  targetSaveBonus: number;
  targetCount?: number;
}): number {
  const { failureAverage, successAverage = 0, saveDc, targetSaveBonus, targetCount = 1 } = opts;
  const failureProbability = saveFailureProbability(saveDc, targetSaveBonus);
  return (failureProbability * failureAverage
    + (1 - failureProbability) * successAverage) * targetCount;
}

/** (max − min + 1) / 6, and only AFTER the feature has been spent once. */
export function rechargeProbability(minimum: number, maximum = 6): number {
  if (!Number.isInteger(minimum) || !Number.isInteger(maximum)
    || minimum < 1 || maximum > 6 || minimum > maximum) {
    throw new RangeError("recharge range must be within 1..6");
  }
  return (maximum - minimum + 1) / 6;
}

// ─── Round profiles ───────────────────────────────────────────────────────────

export type RoundProfile = {
  round1: number; round2: number; round3: number; round4Plus: number;
};

export function roundValue(profile: Partial<RoundProfile>, round: number): number {
  if (round <= 1) return Number(profile.round1 ?? 0);
  if (round === 2) return Number(profile.round2 ?? 0);
  if (round === 3) return Number(profile.round3 ?? 0);
  return Number(profile.round4Plus ?? 0);
}

// ─── Party profile ────────────────────────────────────────────────────────────

export type ConvergenceItem = { round1Burst?: number; sustainCredit?: number };

/** The shape `resolvePartyProfile` needs from a curve row's mode block. */
type PartyCurveModeLike = {
  sustain: number; round1: number; round2: number; round3: number; round4Plus: number;
};

export type PartyProfile = {
  size: number;
  level: number;
  equipmentMode: PartyEquipmentMode;
  evidence: string;
  /** Levels 17-20; the contract requires a visible badge. */
  projection: boolean;
  dpr: RoundProfile;
  sustain: number;
  convergenceApplied: ConvergenceItem[];
};

/**
 * Resolves the Standard / Broken Chain switch BEFORE any simulation.
 *
 * ⚠ TURNING THE CAMPAIGN OFF IS A FIRST-CLASS FEATURE. Christopher: the app's ability to turn
 * off the Broken Chain campaign has to be part of the checker, because the campaign's projected
 * loot distribution is tied into its curve — a table not running The Broken Chain needs the
 * generalized four-player progression instead. `wotcStandard` assumes no magic-item bonus and
 * ignores Convergence entirely.
 */
export function resolvePartyProfile(opts: {
  level: number;
  size: number;
  equipmentMode?: PartyEquipmentMode;
  convergence?: ConvergenceItem[];
  customDpr?: RoundProfile | null;
  customSustain?: number | null;
  /** Defaults to the bundled v2 curve. Present so a caller (or a test) can supply its own. */
  partyCurve?: { curve: Array<{ level: number } & Record<string, unknown>> } | null;
}): PartyProfile {
  const { level, size, equipmentMode = "wotcStandard", convergence = [],
    customDpr = null, customSustain = null, partyCurve = null } = opts;
  const row = (partyCurve
    ? partyCurve.curve.find(candidate => Number(candidate.level) === Number(level))
    : partyCurveRow(level)) as
    | { evidence?: string; wotcStandard: PartyCurveModeLike; brokenChain: PartyCurveModeLike }
    | undefined;
  if (!row) throw new RangeError(`party curve does not contain level ${level}`);
  if (!Number.isInteger(size) || size < 1) throw new RangeError("size must be a positive integer");
  const modeKey: PartyEquipmentMode = equipmentMode === "brokenChain" ? "brokenChain" : "wotcStandard";
  const source = row[modeKey];
  const scale = size / 4;
  const campaignEnabled = modeKey === "brokenChain";
  const convergenceBurst = campaignEnabled
    ? convergence.reduce((sum, item) => sum + Number(item.round1Burst ?? 0), 0) : 0;
  const convergenceSustain = campaignEnabled
    ? convergence.reduce((sum, item) => sum + Number(item.sustainCredit ?? 0), 0) : 0;
  const dpr: RoundProfile = customDpr ?? {
    // Convergence burst lands on ROUND 1 ONLY.
    round1: source.round1 * scale + convergenceBurst,
    round2: source.round2 * scale,
    round3: source.round3 * scale,
    round4Plus: source.round4Plus * scale,
  };
  const sustain = customSustain ?? source.sustain * scale + convergenceSustain;
  const evidence = String(row.evidence ?? "");
  return {
    size, level, equipmentMode: modeKey,
    evidence,
    projection: evidence.startsWith("PROJECTED"),
    dpr, sustain,
    convergenceApplied: campaignEnabled ? convergence : [],
  };
}

// ─── Published state triggers ─────────────────────────────────────────────────
//
// "Encounter phases fire from published HP or combat-state conditions. They are NEVER
// free-form DM timing inputs." The optional gates below are real combat state — corpse
// denied, out of range, activator already spent — not a round the DM picks.

/**
 * ⚠ BOTH KEY STYLES ARE ACCEPTED, deliberately. The reference reads camelCase AND snake_case
 * for every field, because the payload JSON is snake_case while app code is camelCase. Porting
 * only the camelCase half made the Wendigo Wight's published half-HP phase silently fail to
 * fire — the trigger arrived as `hp_fraction` and read as `undefined`.
 */
export type StateTrigger = {
  type?: string; kind?: string;
  hpFraction?: number; hp_fraction?: number; fraction?: number;
  hp?: number;
  fullTurnsAtZero?: number; full_turns_at_zero?: number;
};

export type TriggerState = {
  currentHp?: number; current_hp?: number;
  previousHp?: number; previous_hp?: number;
  maxHp?: number; max_hp?: number;
  alreadyTriggered?: boolean; already_triggered?: boolean;
  usesRemaining?: number; uses_remaining?: number;
  activatorAlive?: boolean; activator_alive?: boolean;
  activatorFullForm?: boolean; activator_full_form?: boolean;
  corpseAvailable?: boolean; corpse_available?: boolean;
  withinRange?: boolean; within_range?: boolean;
  fullTurnsAtZero?: number; full_turns_at_zero?: number;
};

export function stateTriggerEligible(trigger: StateTrigger, state: TriggerState = {}): boolean {
  const type = String(trigger?.type ?? trigger?.kind ?? "");
  const currentHp = Number(state.currentHp ?? state.current_hp ?? 0);
  const previousHp = Number(state.previousHp ?? state.previous_hp ?? currentHp);
  const maxHp = Number(state.maxHp ?? state.max_hp ?? 0);
  const alreadyTriggered = Boolean(state.alreadyTriggered ?? state.already_triggered);
  const usesRemaining = Number(state.usesRemaining ?? state.uses_remaining ?? 1);
  if (alreadyTriggered || usesRemaining <= 0) return false;
  if (state.activatorAlive === false || state.activator_alive === false) return false;
  if (state.activatorFullForm === false || state.activator_full_form === false) return false;
  if (state.corpseAvailable === false || state.corpse_available === false) return false;
  if (state.withinRange === false || state.within_range === false) return false;

  if (type === "first_damage_to_hp_fraction_or_below" || type === "hp_at_or_below") {
    const fraction = Number(trigger.hpFraction ?? trigger.hp_fraction ?? trigger.fraction ?? 0);
    if (!(maxHp > 0) || !(fraction >= 0 && fraction <= 1)) return false;
    const threshold = maxHp * fraction;
    return previousHp > threshold + EPSILON && currentHp <= threshold + EPSILON;
  }
  if (type === "body_at_zero_hp" || type === "hp_zero") {
    return currentHp <= Number(trigger.hp ?? 0) + EPSILON;
  }
  if (type === "body_at_zero_hp_for_full_turn" || type === "start_turn_after_zero_duration") {
    const hp = Number(trigger.hp ?? 0);
    const required = Number(trigger.fullTurnsAtZero ?? trigger.full_turns_at_zero ?? 1);
    const elapsed = Number(state.fullTurnsAtZero ?? state.full_turns_at_zero ?? 0);
    return currentHp <= hp + EPSILON && elapsed >= required;
  }
  throw new RangeError(`unsupported state trigger type: ${type}`);
}

export type SpawnedChild = {
  catalogName: string | null; quantity: number; baseHp: number;
  armorClass: number | null; initiative: unknown;
};

/** Resolves the deterministic restore / state / spawn payload for an eligible event. */
export function resolveStateTrigger(
  event: (StateTrigger & Record<string, unknown>) | { trigger?: StateTrigger } & Record<string, unknown>,
  state: TriggerState = {},
  partySize = 4,
): {
  triggered: boolean; state: TriggerState; stateChanges?: unknown[];
  spawnedChildren: SpawnedChild[]; consumesAction?: boolean;
} {
  const e = event as Record<string, any>;
  const trigger = (e.trigger ?? e) as StateTrigger;
  if (!stateTriggerEligible(trigger, state)) {
    return { triggered: false, state: { ...state }, spawnedChildren: [] };
  }
  const maxHp = Number(state.maxHp ?? state.max_hp ?? 0);
  const restoreFraction = e.restoreToHpFraction ?? e.restore_to_hp_fraction;
  const nextState: TriggerState = {
    ...state,
    alreadyTriggered: true,
    usesRemaining: Math.max(0, Number(state.usesRemaining ?? state.uses_remaining ?? 1) - 1),
  };
  if (restoreFraction !== undefined && restoreFraction !== null) {
    nextState.currentHp = maxHp * Number(restoreFraction);
  }
  const spawn = e.spawn as Record<string, any> | undefined;
  const spawnedChildren: SpawnedChild[] = [];
  if (spawn) {
    const fixedBaseHp = Number(spawn.baseHp ?? spawn.base_hp ?? 0);
    const fourPcBaseHp = Number(spawn.fourPcBaseHp ?? spawn.four_pc_base_hp ?? 0);
    let baseHp = fourPcBaseHp > 0 ? fourPcBaseHp * partySizeHpMultiplier(partySize) : fixedBaseHp;
    if (spawn.roundHp === "nearest_integer" || spawn.round_hp === "nearest_integer") {
      baseHp = Math.round(baseHp);
    }
    spawnedChildren.push({
      catalogName: spawn.catalogName ?? spawn.catalog_name ?? null,
      quantity: Number(spawn.quantity ?? 1),
      baseHp,
      armorClass: Number(spawn.armorClass ?? spawn.armor_class ?? 0) || null,
      initiative: spawn.initiative ?? null,
    });
  }
  return {
    triggered: true,
    state: nextState,
    stateChanges: [...((e.stateChanges as unknown[]) ?? (e.state_changes as unknown[]) ?? [])],
    spawnedChildren,
    consumesAction:
      String(e.cost?.activationType ?? e.cost?.activation_type ?? "").toLowerCase() === "action",
  };
}

// ─── Effective HP ─────────────────────────────────────────────────────────────

export type RosterGroup = {
  id?: string;
  name?: string;
  quantity: number;
  baseHp: number;
  /** Healing / form / temp-HP pools legally available IN THIS FIGHT. */
  explicitSameEncounterPools?: number;
  acMultiplier?: number;
  /** Fraction of opposing damage that gets through. A DIVISOR: lower = harder to kill. */
  damagePassFraction?: number;
  /** Reachable / targetable / action-available fraction. Also a DIVISOR. */
  damageUptime?: number;
  traitFactors?: SustainFactor[];
  /** Fallback when factors are not itemised. */
  ehpAdjustment?: number;
  dpr: Partial<RoundProfile>;
  /** Share of its own turns this group actually acts. Applies to DPR, not HP. */
  dprUptime?: number;
  outcomeEvents?: OutcomeEvent[];
};

/**
 * (raw HP + explicit pools) × AC × trait product ÷ damage pass ÷ damage uptime × party size.
 *
 * ⚠ One effect uses ONE channel. Anything entered as an explicit pool, a damage-pass fraction
 * or an uptime must not also receive a trait multiplier.
 */
export function effectiveHpPerBody(group: RosterGroup, partySize: number): number {
  const rawHp = Number(group.baseHp ?? 0);
  const explicitPools = Number(group.explicitSameEncounterPools ?? 0);
  const acMultiplier = Number(group.acMultiplier ?? 1);
  const damagePassFraction = Number(group.damagePassFraction ?? 1);
  const damageUptime = Number(group.damageUptime ?? 1);
  const traitAdjustment = group.traitFactors
    ? combineSustainContributions(group.traitFactors)
    : Number(group.ehpAdjustment ?? 0);
  if (rawHp < 0 || explicitPools < 0 || acMultiplier <= 0
    || damagePassFraction <= 0 || damageUptime <= 0) {
    throw new RangeError(`invalid sustain inputs for ${group.name ?? group.id ?? "creature"}`);
  }
  return (rawHp + explicitPools)
    * acMultiplier
    * (1 + traitAdjustment)
    / damagePassFraction
    / damageUptime
    * partySizeHpMultiplier(partySize);
}

export type PreparedGroup = RosterGroup & {
  order: number;
  bodyEhp: number;
  groupEhp: number;
  /** Cumulative EHP through the END of this group — the roster is KILL PRIORITY order. */
  cumulativeEnd: number;
  dprUptime: number;
};

export function prepareRoster(roster: RosterGroup[], partySize: number): PreparedGroup[] {
  let cumulativeEnd = 0;
  return roster
    .filter(group => Number(group.quantity ?? 0) > 0)
    .map((group, index) => {
      const quantity = Number(group.quantity);
      const bodyEhp = effectiveHpPerBody(group, partySize);
      const groupEhp = quantity * bodyEhp;
      cumulativeEnd += groupEhp;
      return { ...group, order: index + 1, quantity, bodyEhp, groupEhp, cumulativeEnd,
        dprUptime: Number(group.dprUptime ?? 1) };
    });
}

/** How much of this group is still standing, 0–1, given cumulative party damage. */
export function remainingGroupFraction(group: PreparedGroup, cumulativePartyDamage: number): number {
  if (group.groupEhp <= 0) return 0;
  return clamp((group.cumulativeEnd - cumulativePartyDamage) / group.groupEhp, 0, 1);
}

/**
 * ⚠ CONTINUOUS DEPLETION. A group that is half dead deals half damage — it does not fight at
 * full output until the last body drops. This replaces the old `attritionFactor` and
 * `KILLED_BODY_DPR_RETAINED` outright.
 */
export function encounterDprAt(
  roster: PreparedGroup[], cumulativePartyDamage: number, round: number,
): number {
  return roster.reduce((total, group) => {
    const remaining = remainingGroupFraction(group, cumulativePartyDamage);
    const bodyDpr = roundValue(group.dpr, round);
    return total + group.quantity * bodyDpr * group.dprUptime * remaining;
  }, 0);
}

// ─── Special outcomes ─────────────────────────────────────────────────────────

export type OutcomeEvent = {
  name?: string;
  kind?: string;
  targetCount?: number;
  conditionProbability?: number;
  failureProbability?: number;
  saveDc?: number;
  targetSaveBonus?: number;
  earliestRound?: number;
};

export type SpecialOutcomeRisk = {
  groupId: string | null;
  creature: string;
  name: string;
  kind: string;
  earliestRound: number;
  expectedAffectedTargets: number;
  probabilityAtLeastOne: number;
  /** Always 0 — instant-death effects never become fake DPR. */
  deterministicDamageCredit: number;
};

/** Keeps zero-HP / instant-death mechanics OUT of the damage clock, reported separately. */
export function specialOutcomeRisks(roster: PreparedGroup[]): SpecialOutcomeRisk[] {
  const risks: SpecialOutcomeRisk[] = [];
  for (const group of roster) {
    for (const event of group.outcomeEvents ?? []) {
      const targetCount = Math.max(0, Number(event.targetCount ?? 1));
      const conditionProbability = clamp(Number(event.conditionProbability ?? 1), 0, 1);
      let probabilityPerTarget: number;
      if (event.failureProbability !== undefined) {
        probabilityPerTarget = clamp(Number(event.failureProbability), 0, 1) * conditionProbability;
      } else if (event.saveDc !== undefined && event.targetSaveBonus !== undefined) {
        probabilityPerTarget = saveFailureProbability(Number(event.saveDc), Number(event.targetSaveBonus))
          * conditionProbability;
      } else {
        probabilityPerTarget = conditionProbability;
      }
      const effectiveTrials = targetCount * Math.max(1, Number(group.quantity ?? 1));
      risks.push({
        groupId: group.id ?? null,
        creature: group.name ?? group.id ?? "Creature",
        name: event.name ?? event.kind ?? "Special outcome",
        kind: event.kind ?? "state_change",
        earliestRound: Math.max(1, Number(event.earliestRound ?? 1)),
        expectedAffectedTargets: effectiveTrials * probabilityPerTarget,
        probabilityAtLeastOne: effectiveTrials > 0
          ? 1 - (1 - probabilityPerTarget) ** effectiveTrials : 0,
        deterministicDamageCredit: 0,
      });
    }
  }
  return risks;
}

// ─── PCER / MER ───────────────────────────────────────────────────────────────

/** Total party damage delivered by a fractional round count, walking the R1..R4+ ladder. */
export function partyDamageCapacityAt(profile: Partial<RoundProfile>, roundEquivalent: number): number {
  const value = Math.max(0, Number(roundEquivalent));
  const r1 = roundValue(profile, 1), r2 = roundValue(profile, 2);
  const r3 = roundValue(profile, 3), r4 = roundValue(profile, 4);
  if (value <= 1) return value * r1;
  if (value <= 2) return r1 + (value - 1) * r2;
  if (value <= 3) return r1 + r2 + (value - 2) * r3;
  return r1 + r2 + r3 + (value - 3) * r4;
}

/** PCER — fractional rounds for the party to consume an EHP total. The inverse of the above. */
export function partyRoundEquivalent(
  profile: Partial<RoundProfile>, encounterEhp: number,
): number | null {
  const target = Math.max(0, Number(encounterEhp));
  const r1 = roundValue(profile, 1), r2 = roundValue(profile, 2);
  const r3 = roundValue(profile, 3), r4 = roundValue(profile, 4);
  if (target <= r1) return r1 > 0 ? target / r1 : null;
  if (target <= r1 + r2) return r2 > 0 ? 1 + (target - r1) / r2 : null;
  if (target <= r1 + r2 + r3) return r3 > 0 ? 2 + (target - r1 - r2) / r3 : null;
  return r4 > 0 ? 3 + (target - r1 - r2 - r3) / r4 : null;
}

// ─── The simulation ───────────────────────────────────────────────────────────

export type DamageAllocation = "focus_fire" | "spread_evenly";

export type SimulationRound = {
  round: number;
  partyPotential: number;
  pcsStart: number;
  partyDamage: number;
  cumulativePartyDamage: number;
  monsterEhpLeft: number;
  monsterDprStart: number;
  monsterDprEnd: number;
  monsterDamage: number;
  cumulativeMonsterDamage: number;
  downs: number;
  damagedButStanding: number;
  standing: number;
  completesNow: boolean;
  fatalNow: boolean;
  status: "ONGOING" | "COMPLETE" | "FATAL" | "PARTY_DOWN";
};

export type EncounterResult = {
  encounterEhp: number;
  startingEncounterDpr: number;
  completionRound: number | null;
  fatalRound: number | null;
  fatalRoundBasis: string;
  damageAllocation: DamageAllocation;
  survivorCountBasis: string;
  earliestPossibleSpecialFatalRound: number | null;
  specialOutcomeRisks: SpecialOutcomeRisk[];
  downsAtCompletion: number | null;
  damagedButStandingAtCompletion: number | null;
  standingAtCompletion: number | null;
  pcer: number | null;
  mer: number | null;
  safetyMargin: number | null;
  balanceAdjustment: {
    targetSafetyMargin: number;
    targetPcer: number | null;
    targetEncounterEhp: number | null;
    scaledHpChange: number | null;
    baseFourPcHpChange: number | null;
    percentChange: number | null;
  };
  rounds: SimulationRound[];
};

export function simulateEncounter(opts: {
  party: { size: number; sustain: number; dpr: Partial<RoundProfile> };
  roster: RosterGroup[];
  settings?: {
    maxRounds?: number;
    completionRoundMonsterFraction?: number;
    damageAllocation?: DamageAllocation;
    targetSafetyMargin?: number;
  };
}): EncounterResult {
  const { party, roster, settings = {} } = opts;
  const partySize = Number(party.size);
  const partySustain = Number(party.sustain);
  if (!Number.isInteger(partySize) || partySize < 1 || partySustain <= 0) {
    throw new RangeError("party.size must be a positive integer and party.sustain must be positive");
  }
  const prepared = prepareRoster(roster, partySize);
  const encounterEhp = prepared.reduce((sum, group) => sum + group.groupEhp, 0);
  const maxRounds = Number(settings.maxRounds ?? 20);
  const completionRoundMonsterFraction = clamp(Number(settings.completionRoundMonsterFraction ?? 0.5), 0, 1);
  const damageAllocation: DamageAllocation =
    settings.damageAllocation === "spread_evenly" ? "spread_evenly" : "focus_fire";
  // EQUAL pools. Not an authored per-PC share.
  const sustainPerPc = partySustain / partySize;
  const rounds: SimulationRound[] = [];
  let cumulativePartyDamage = 0;
  let cumulativeMonsterDamage = 0;
  let standing = partySize;
  let completionRound: number | null = null;
  let fatalRound: number | null = null;

  for (let round = 1; round <= maxRounds; round += 1) {
    const pcsStart = standing;
    const partyPotential = roundValue(party.dpr, round);
    // Party damage scales with survivors.
    const partyDamage = completionRound || pcsStart === 0
      ? 0 : partyPotential * pcsStart / partySize;
    const partyDamageBefore = cumulativePartyDamage;
    cumulativePartyDamage += partyDamage;
    const completesNow = completionRound === null && encounterEhp > 0
      && cumulativePartyDamage + EPSILON >= encounterEhp;
    const monsterDprStart = encounterDprAt(prepared, partyDamageBefore, round);
    const monsterDprEnd = encounterDprAt(prepared, cumulativePartyDamage, round);
    // ⚠ Monster damage is NOT scaled by PCs standing — survivors remain valid targets.
    const monsterDamage = completionRound || pcsStart === 0
      ? 0
      : ((monsterDprStart + monsterDprEnd) / 2) * (completesNow ? completionRoundMonsterFraction : 1);
    cumulativeMonsterDamage += monsterDamage;
    const downs = damageAllocation === "spread_evenly"
      ? (cumulativeMonsterDamage + EPSILON >= partySustain ? partySize : 0)
      : Math.min(partySize, Math.floor((cumulativeMonsterDamage + EPSILON) / sustainPerPc));
    const residual = cumulativeMonsterDamage - downs * sustainPerPc;
    const damagedButStanding = damageAllocation === "spread_evenly"
      ? (downs === 0 && cumulativeMonsterDamage > EPSILON ? partySize : 0)
      : (downs < partySize && residual > EPSILON ? 1 : 0);
    standing = Math.max(0, partySize - downs);
    const fatalNow = fatalRound === null && cumulativeMonsterDamage + EPSILON >= partySustain;
    if (completesNow) completionRound = round;
    if (fatalNow) fatalRound = round;
    const status: SimulationRound["status"] =
      fatalNow || (fatalRound !== null && !completionRound) ? "FATAL"
        : completesNow || completionRound !== null ? "COMPLETE"
          : standing === 0 ? "PARTY_DOWN" : "ONGOING";
    rounds.push({
      round, partyPotential, pcsStart, partyDamage, cumulativePartyDamage,
      monsterEhpLeft: Math.max(0, encounterEhp - cumulativePartyDamage),
      monsterDprStart, monsterDprEnd, monsterDamage, cumulativeMonsterDamage,
      downs, damagedButStanding, standing, completesNow, fatalNow, status,
    });
    if (completionRound !== null) break;
    if (standing === 0) break;
  }

  const completionState = completionRound === null
    ? null : rounds.find(row => row.round === completionRound) ?? null;
  const startingEncounterDpr = encounterDprAt(prepared, 0, 1);
  const pcer = partyRoundEquivalent(party.dpr, encounterEhp);
  const mer = startingEncounterDpr > 0 ? partySustain / startingEncounterDpr : null;
  const safetyMargin = pcer === null || mer === null ? null : mer - pcer;
  const targetSafetyMargin = Number(settings.targetSafetyMargin ?? 1);
  const targetPcer = mer === null ? null : Math.max(0, mer - targetSafetyMargin);
  const targetEncounterEhp = targetPcer === null ? null : partyDamageCapacityAt(party.dpr, targetPcer);
  const scaledHpChange = targetEncounterEhp === null ? null : targetEncounterEhp - encounterEhp;
  const baseFourPcHpChange = scaledHpChange === null
    ? null : scaledHpChange / partySizeHpMultiplier(partySize);
  const outcomeRisks = specialOutcomeRisks(prepared);
  const earliestPossibleSpecialFatalRound = outcomeRisks
    .filter(risk => risk.kind === "instant_death" || risk.kind === "drop_to_zero")
    .reduce<number | null>((earliest, risk) =>
      earliest === null ? risk.earliestRound : Math.min(earliest, risk.earliestRound), null);

  return {
    encounterEhp,
    startingEncounterDpr,
    completionRound,
    fatalRound,
    fatalRoundBasis: "deterministic expected damage; special zero-HP/death effects are reported separately",
    damageAllocation,
    survivorCountBasis: damageAllocation === "spread_evenly"
      ? "projected under equal per-PC sustain and even damage allocation"
      : "projected under equal per-PC sustain and sequential focus fire",
    earliestPossibleSpecialFatalRound,
    specialOutcomeRisks: outcomeRisks,
    downsAtCompletion: completionState?.downs ?? null,
    damagedButStandingAtCompletion: completionState?.damagedButStanding ?? null,
    standingAtCompletion: completionState?.standing ?? null,
    pcer, mer, safetyMargin,
    balanceAdjustment: {
      targetSafetyMargin, targetPcer, targetEncounterEhp, scaledHpChange, baseFourPcHpChange,
      percentChange: scaledHpChange === null || encounterEhp === 0 ? null : scaledHpChange / encounterEhp,
    },
    rounds,
  };
}
