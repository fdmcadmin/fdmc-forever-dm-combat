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
 *  1. ⚠ STALE — party damage NO LONGER scales by standing, and this line said it did long after
 *     the code stopped. The certified R1→R4+ decline IS the attrition, so scaling it again by
 *     projected casualties counts the same wearing-down twice; and because focus-fire and
 *     spread-evenly project downs on different schedules, feeding that back made one fight finish
 *     in 5 rounds or 6 depending on a display toggle. See `partyDamage` below for the removal.
 *
 *     ⚠ AND THE LIMIT THAT LEAVES, because it is real. That decline is an AVERAGE over 4,096
 *     parties, where one body dropping in round 4 is smeared into roughly a tenth off the round.
 *     A level 1 party of four loses a quarter of its output the moment a PC drops, immediately and
 *     visibly. Christopher: *"why would a down not low dpr, they dont get to continue to damage
 *     when they are downed."* Correct — an averaged curve cannot express that, and only per-actor
 *     state can. Until it exists, low-level readings overstate a party that is losing bodies.
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
import { hostileFractionActingFirst } from "./initiativeOrder";
import { concentrationHold, cycleActiveShare } from "./durationPricing";
import { depleteRoundValue } from "./partyResourceCurve";

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
  /**
   * Share of the party's resources already gone when this fight starts. 0 = fresh, 1 = empty.
   *
   * ⚠ THIS MOVES DAMAGE AS WELL AS SUSTAIN. It used to be the caller's job and the caller only
   * ever scaled sustain, so a party 60% down opened with a full nova — *"a healer who spends
   * half a fight burning through L3 spell slots cant go into the next fight buring the same lvl
   * 3 spell slots."* Both halves are resolved here now so there is one implementation of it.
   */
  arrivingSpent?: number;
  /** Defaults to the bundled v2 curve. Present so a caller (or a test) can supply its own. */
  partyCurve?: { curve: Array<{ level: number } & Record<string, unknown>> } | null;
}): PartyProfile {
  const { level, size, equipmentMode = "wotcStandard", convergence = [],
    customDpr = null, customSustain = null, arrivingSpent = 0, partyCurve = null } = opts;
  const row = (partyCurve
    ? partyCurve.curve.find(candidate => Number(candidate.level) === Number(level))
    : partyCurveRow(level)) as
    | {
        evidence?: string;
        wotcStandard: PartyCurveModeLike;
        brokenChain: PartyCurveModeLike;
        /** Certified per-size rows; absent on an injected curve, which then scales as before. */
        bySize?: Partial<Record<number, { wotcStandard: PartyCurveModeLike; brokenChain: PartyCurveModeLike }>>;
      }
    | undefined;
  if (!row) throw new RangeError(`party curve does not contain level ${level}`);
  if (!Number.isInteger(size) || size < 1) throw new RangeError("size must be a positive integer");
  const modeKey: PartyEquipmentMode = equipmentMode === "brokenChain" ? "brokenChain" : "wotcStandard";
  /**
   * ⚠ THE CERTIFIED SIZE ROW WINS OVER SCALING, because scaling could not answer the question.
   *
   * `size / 4` applied to the party and `partySizeHpMultiplier` applied to creature EHP are both
   * linear in size, so they cancelled and party size never moved time-to-clear. V3.0 certifies
   * 3P/5P/6P independently and they are not linear — six-player sustain at level 6 Broken Chain is
   * 1.74x the four-player figure, not 1.50x.
   *
   * Scaling remains the fallback for a size the table does not certify, so an unusual party still
   * gets an answer rather than an exception.
   */
  const sized = row.bySize?.[size];
  const source = sized ? sized[modeKey] : row[modeKey];
  const scale = sized ? 1 : size / 4;
  const campaignEnabled = modeKey === "brokenChain";
  const convergenceBurst = campaignEnabled
    ? convergence.reduce((sum, item) => sum + Number(item.round1Burst ?? 0), 0) : 0;
  const convergenceSustain = campaignEnabled
    ? convergence.reduce((sum, item) => sum + Number(item.sustainCredit ?? 0), 0) : 0;
  /**
   * The wotcStandard row is the DEPLETABLE base at every mode — see `depleteRoundValue`. In
   * wotcStandard the two rows are the same object, so the gift delta is zero and this is a plain
   * scale.
   */
  const base = sized ? sized.wotcStandard : row.wotcStandard;
  const spent = Math.min(1, Math.max(0, Number(arrivingSpent) || 0));
  const deplete = (key: "round1" | "round2" | "round3" | "round4Plus"): number =>
    depleteRoundValue(base[key] * scale, source[key] * scale, spent);
  const dpr: RoundProfile = customDpr ?? {
    // Convergence burst lands on ROUND 1 ONLY.
    round1: deplete("round1") + convergenceBurst,
    round2: deplete("round2"),
    round3: deplete("round3"),
    round4Plus: deplete("round4Plus"),
  };
  const sustain = customSustain
    ?? (source.sustain * scale + convergenceSustain) * (1 - spent);
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
  /**
   * This body's initiative modifier — its DEX unless the sheet states one.
   *
   * ⚠ ABSENT IS NOT ZERO-AND-IGNORED. When no body in a roster states one, every body ties the
   * party and `hostileFractionActingFirst` returns 0.5 — the midpoint the simulation used before
   * initiative was read at all. So an unstated roster behaves exactly as it did.
   */
  initiativeMod?: number;
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
  /**
   * Party size is already expressed as this group's BODY COUNT, so the party-size HP band must
   * not apply on top. The campaign's sole case is the Elemental Mirror — see
   * `MonsterStats.oneBodyPerPc`.
   */
  flatHpPerBody?: boolean;
  dpr: Partial<RoundProfile>;
  /** Share of its own turns this group actually acts. Applies to DPR, not HP. */
  dprUptime?: number;
  /**
   * ── A TIMED BODY — the workbook's `child_entities` model ──────────────────────────────────
   *
   * The round this group ARRIVES. 1, or unset, means it is there when the fight starts. A summon
   * called on round 2 is `arrivesRound: 3` — the round its body first acts.
   *
   * ⚠ THE WORKBOOK ASKS FOR EXACTLY THIS, in the anti-double-count column shared by all five
   * `child_entities` primitives: *"Add each created body as a timed roster entry with its own HP,
   * initiative/action schedule, duration."* Every word of that is a field, and `arrivesRound` is
   * the one the simulation could not express: `encounterEhp` was a single total summed before the
   * first round, so a body that arrives later had nowhere to arrive.
   *
   * Christopher: *"the lair builds off of it as a start of combat summon"* — that case is
   * `arrivesRound: 1`, which is why the opening summon needs no special handling.
   */
  arrivesRound?: number;
  /**
   * The last round this group is present. Unset = until it drops.
   *
   * ⚠ `temporary_body_duration`: *"Body/action value only for authored active rounds."* The
   * Covenant bond-creature "lasts 2 turns", so called on round 2 it is `arrivesRound: 3,
   * expiresAfterRound: 4`. Its damage counts for two rounds and its HP is never something the
   * party has to chew through — it leaves on its own.
   */
  expiresAfterRound?: number;
  /**
   * ⚠ `split_body`: *"Replace parent with authored bodies; never duplicate parent HP."* A group
   * marked this way does not ADD its HP to the encounter — it inherits what its parent had left.
   * Counting both is the double-count that primitive exists to forbid.
   */
  replacesParent?: boolean;
  /**
   * ⚠ AN ACTOR WITH NO BODY — the shape a LAIR needs, and the one the roster could not hold.
   *
   * Christopher: *"lair summons happen at round 0 and they get a initiative 20 so there isnt a
   * summon because its a 'creature' with a X action but one 1 action per turn."* Exactly right,
   * and it is the workbook's own model: `lair_action` is `separate_action_budget` on the offense
   * channel — *"Price on authored initiative/cadence."* Its own action, once a round, on its own
   * initiative. Not a summoned body, and not part of the parent creature's action economy.
   *
   * A lair therefore has to ACT without being a body, and `livingBodies` refuses that: it bails on
   * `bodyEhp <= 0`, correctly, because a body with no hit points is not a body. So a lair entered
   * at 0 HP contributed nothing, and a fight with a lair priced identically to one without.
   *
   * A bodiless group:
   *  · adds NOTHING to encounter EHP — there is no body for the party to cut through, and
   *    inventing one would make the environment something you can kill;
   *  · can never be killed, so it keeps acting for as long as it is present;
   *  · is still governed by `arrivesRound` / `expiresAfterRound` like anything else.
   */
  bodiless?: boolean;
  /**
   * THIS GROUP STOPS ACTING ONCE THAT GROUP IS DEAD.
   *
   * Christopher: *"[Lairs] go away with the boss they are attached to but the 'lair' will be used
   * for things like active volcano and world hazards."*
   *
   * Two different things wearing the same mechanism, and the difference is exactly one field. A
   * boss's lair is an extension of the boss — kill the dragon and the clearing stops rearranging
   * itself — so it names its parent here and falls silent when that parent has no living bodies
   * left. A volcano names nobody: it was erupting before the fight and does not care how the fight
   * goes.
   *
   * ⚠ WITHOUT THIS A BOUND LAIR IS PRICED FOREVER. A `bodiless` group can never be killed, which
   * is the point, so a boss lair with a damaging option would go on contributing damage for every
   * round the simulation runs after the boss is already dead — the party would be charged for an
   * environment that stopped when the creature did.
   */
  endsWithGroupId?: string;
  outcomeEvents?: OutcomeEvent[];
  /**
   * HOW MANY OF THE PARTY'S ACTIONS EACH ROUND MUST TARGET THIS CREATURE while it stands.
   *
   * Christopher, 2026-09-13, on Commanding Presence: *"it should be once per turn, not a constant
   * passive, so the read is still a reaction."* A Reaction forces ONE Action a round onto the Knight —
   * not every Action, which is what moving it to the front of the kill order would claim. So that
   * share of the party's round (actions ÷ party size) goes into this group BEFORE the kill order, and
   * the creatures ahead of it in the order are reached that much later. See `damageIntoGroup`.
   */
  redirectsPartyActionsPerRound?: number;
  /**
   * A TARGET-SUBSTITUTION REACTION MOVES THIS SHARE OF EVERY ROUND DOWN THE KILL ORDER.
   *
   * Cold Counsel moves a targeted ally out of an attacker's reach; the attacker "can choose another legal
   * target". So that share of the party's round lands on the NEXT body instead of the one it is killing —
   * the focus dies later, the next body sooner, and nothing is destroyed. Stamped by the roster pass on a
   * bodiless row; `prepareRoster` applies it. See `rosterInteractions.ts`.
   */
  substitutesPartyDamagePerRound?: number;
  /**
   * WHAT SURVIVES OF THE PARTY'S OWN DAMAGE while this group is on the field — 1 is all of it.
   *
   * A zone that gives the PCs inside it −3 to hit takes that share off what the party deals, for as
   * long as the creature holding it stands. It belongs on the party's clock, not in any creature's HP
   * (workbook: *"never hidden in creature HP"*), and it ends through `endsWithGroupId` like any bound
   * row. See `rosterInteractions.ts`.
   */
  partyDamageFactor?: number;
  /**
   * THIS GROUP LEADS THE KILL ORDER — a passive forced target ("every creature-targeting Action must
   * target it"). Stamped by the roster pass; any caller that re-sorts the roster (the panels sort
   * weakest-first) must keep these in front, or the sort silently undoes the rule.
   */
  killOrderFirst?: boolean;
  /**
   * THIS ROW'S VALUE STANDS ON A CONCENTRATION SPELL — v5 BR066 + BR073 (Winter's Toll).
   *
   * `dpr` is the effect standing every turn of its cycle. The simulation replaces it with
   * max(0, activeShare × dependent + fixed), where activeShare is the average share of the recast cycle
   * that stood given the party's damage into the holder last round (`durationPricing.ts`), and scales the
   * row's `partyDamageFactor` loss by the same share. At a share of 1 — a holder nobody has hit — that is
   * exactly `dpr`, so nothing moves until the party reaches the caster.
   */
  concentration?: {
    /** The body concentrating. The party's damage into it calls the Constitution saves. */
    holderGroupId: string;
    conSave: number;
    /** The printed duration in the holder's turns — the recast cycle. Winter's Toll: 2. */
    activeTurns: number;
    /** Per round: what exists only while the effect stands. */
    dependent: Partial<RoundProfile>;
    /** Per round: what is spent or gained whether or not it holds — the Action given up is negative. */
    fixed: Partial<RoundProfile>;
  };
  /**
   * THE PC TURNS THIS GROUP TAKES AWAY, per body, per round of its own schedule — Stunned, Paralyzed,
   * Incapacitated, Unconscious, Petrified.
   *
   * Christopher, 2026-09-13: *"it should be charged on PC loses of turn not party loss of turn."* Each
   * entry is one scheduled use: `pcs` the expected PCs it catches, `turns[k]` the chance each loses its
   * (k+1)th following turn. The simulation takes each lost turn's share of the party's damage (1 ÷ party
   * size) off the round that turn falls in. See `turnDenial.ts`.
   *
   * `concentration` marks a use held by concentration: its later turns stand only while THIS group keeps
   * the hold (its `conSave` against the party's damage into it), and end when it dies (v5 BR073).
   */
  pcTurnDenials?: Partial<Record<keyof RoundProfile, { pcs: number; turns: number[]; concentration?: boolean }[]>>;
  /** This group's Constitution save — what a concentration hold on its own control is tested against. */
  conSave?: number;
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
    // The band scales HP with party size. A group whose BODY COUNT already tracks party size has
    // had that lever pulled once; pulling it again gives three mirrors at 67 HP for a 3P party.
    * (group.flatHpPerBody ? 1 : partySizeHpMultiplier(partySize));
}

export type PreparedGroup = RosterGroup & {
  order: number;
  bodyEhp: number;
  groupEhp: number;
  /** Cumulative EHP through the END of this group — the roster is KILL PRIORITY order. */
  cumulativeEnd: number;
  dprUptime: number;
  /**
   * A forced-target Reaction in this roster, as it reaches THIS group. `self` is the group the party
   * must target; `delayed` is every group AHEAD of it in the kill order, reached later because part of
   * each round went into the forced target first. Groups behind it are unaffected. See `damageIntoGroup`.
   */
  soak?: { role: "self" | "delayed"; share: number; soakEhp: number };
};

export function prepareRoster(roster: RosterGroup[], partySize: number): PreparedGroup[] {
  let cumulativeEnd = 0;
  const prepared: PreparedGroup[] = roster
    .filter(group => Number(group.quantity ?? 0) > 0)
    .map((group, index) => {
      const quantity = Number(group.quantity);
      const bodyEhp = effectiveHpPerBody(group, partySize);
      const groupEhp = quantity * bodyEhp;
      cumulativeEnd += groupEhp;
      return { ...group, order: index + 1, quantity, bodyEhp, groupEhp, cumulativeEnd,
        dprUptime: Number(group.dprUptime ?? 1) };
    });
  /**
   * ⚠ ONE FORCED TARGET IS MODELLED. The first body-bearing group that redirects party Actions takes
   * that share of every round; a second is left to the kill order and would need its own pass.
   */
  const forcedIndex = prepared.findIndex(g => !g.bodiless && Number(g.redirectsPartyActionsPerRound ?? 0) > 0);
  if (forcedIndex >= 0) {
    const forced = prepared[forcedIndex];
    const share = Math.min(1, Number(forced.redirectsPartyActionsPerRound) / Math.max(1, partySize));
    prepared[forcedIndex] = { ...forced, soak: { role: "self", share, soakEhp: forced.groupEhp } };
    for (let i = 0; i < forcedIndex; i++) {
      if (prepared[i].bodiless) continue;
      prepared[i] = { ...prepared[i], soak: { role: "delayed", share, soakEhp: forced.groupEhp } };
    }
  }
  /**
   * ⚠ A TARGET SUBSTITUTION IS THE FORCED TARGET'S MIRROR. The forced target pulls a share of every round
   * FORWARD onto itself; a substitution pushes a share off the body the party is killing onto the NEXT one.
   * Both are "a fixed share of every round reaches a group before the kill order does", which is exactly
   * what `soak` means — so the same field carries it, on the group that receives the moved swing.
   *
   * ⚠ ONE IS MODELLED, and a forced target wins. If a roster has both, the forced target already owns the
   * soak lane and a second claim on the same rounds would double-count them; the substitution is left to
   * the kill order and the roster line still names it.
   */
  if (forcedIndex < 0) {
    const substitution = prepared.find(g => Number(g.substitutesPartyDamagePerRound ?? 0) > 0);
    const bodies = prepared.map((g, i) => ({ g, i })).filter(x => !x.g.bodiless && x.g.groupEhp > 0);
    if (substitution && bodies.length >= 2) {
      const share = Math.min(1, Number(substitution.substitutesPartyDamagePerRound));
      const receiver = bodies[1];   // the "another legal target" — the next body after the one being killed
      prepared[receiver.i] = { ...receiver.g, soak: { role: "self", share, soakEhp: receiver.g.groupEhp } };
      for (const { g, i } of bodies) {
        if (i >= receiver.i) break;
        prepared[i] = { ...g, soak: { role: "delayed", share, soakEhp: receiver.g.groupEhp } };
      }
    }
  }
  return prepared;
}

/**
 * How much of the party's cumulative damage has landed on THIS group.
 *
 * With no forced target it is the kill order, exactly as it always was: nothing lands on a group
 * until every group ahead of it is dead.
 *
 * ⚠ A FORCED-TARGET REACTION TAKES A FIXED SHARE OF EVERY ROUND FIRST. Because the share is fixed,
 * what it has absorbed after cumulative damage C is simply min(share × C, its EHP) — the same total
 * whichever rounds C arrived in — so every reader of this function stays a function of C alone:
 *
 *   forced group        its share, plus whatever the kill order reaches it with afterwards
 *   groups AHEAD of it  reached later by exactly the amount the forced group absorbed
 *   groups BEHIND it    unchanged: by the time the order reaches them, it has passed through all of it
 */
export function damageIntoGroup(group: PreparedGroup, cumulativePartyDamage: number): number {
  const start = group.cumulativeEnd - group.groupEhp;
  if (!group.soak) return clamp(cumulativePartyDamage - start, 0, group.groupEhp);
  const absorbed = Math.min(group.soak.share * Math.max(0, cumulativePartyDamage), group.soak.soakEhp);
  if (group.soak.role === "delayed") return clamp(cumulativePartyDamage - absorbed - start, 0, group.groupEhp);
  return absorbed + clamp(cumulativePartyDamage - absorbed - start, 0, group.groupEhp - absorbed);
}

/**
 * How much of this group is still standing, 0–1, given cumulative party damage.
 *
 * ⚠ RETAINED FOR REPORTING ONLY — it is NOT what prices damage any more. See `livingBodies`.
 * A continuous fraction is the right way to describe how far through a group the party has got;
 * it is the wrong way to decide how hard that group hits.
 */
export function remainingGroupFraction(group: PreparedGroup, cumulativePartyDamage: number): number {
  if (group.groupEhp <= 0) return 0;
  return clamp((group.groupEhp - damageIntoGroup(group, cumulativePartyDamage)) / group.groupEhp, 0, 1);
}

/**
 * How many bodies of this group are STILL ALIVE after `cumulativePartyDamage`.
 *
 * ⚠ v7 `campaign_semantics.whole_body_attrition`: *"A living creature retains its full legal
 * output until its body reaches 0 HP. Do not linearly reduce a singleton's DPR as its HP is
 * chipped."*
 *
 * This is the rule the engine used to break. `encounterDprAt` multiplied each group's DPR by the
 * continuous remaining fraction, so a creature at 60% HP dealt 60% damage — the exact linear
 * reduction the rule forbids, and applied from the FIRST round in which the party lands a hit.
 * Two 100-EHP bodies read 36 in round 1 where the rule says 40, and the error compounded every
 * round, so a fight read easier the longer it ran. Both Fight 10 creatures are singletons, so
 * they were under-counted from round one to the end.
 *
 * Bodies die one at a time and in kill order. Damage lands on THIS group only after every earlier
 * group in the order is dead, so the group's own share is measured from `cumulativeStart`.
 */
export function livingBodies(group: PreparedGroup, cumulativePartyDamage: number): number {
  // An actor with no body is never killed and never soaks — see `RosterGroup.bodiless`.
  if (group.bodiless) return Math.max(0, Number(group.quantity ?? 0));
  if (group.bodyEhp <= 0) return 0;
  // Kill order, plus any share a forced-target Reaction takes first — see `damageIntoGroup`.
  const intoThisGroup = damageIntoGroup(group, cumulativePartyDamage);
  // A body is dead only once its WHOLE effective pool is gone; a chipped body is still a body.
  const killed = Math.floor((intoThisGroup + EPSILON) / group.bodyEhp);
  return Math.max(0, group.quantity - killed);
}

/**
 * ⚠ WHOLE-BODY ATTRITION, per v7 `campaign_semantics.whole_body_attrition`.
 *
 * Output falls in STEPS of one body's DPR as bodies drop, never smoothly as HP is chipped. A
 * group of four at 60% total HP is not "four creatures at 60% output" — it is one dead and three
 * fighting at full strength, and those are very different numbers.
 *
 * The previous version multiplied by `remainingGroupFraction` and was labelled "CONTINUOUS
 * DEPLETION … replaces the old attritionFactor outright" — a deliberate app decision taken
 * against an explicit workbook rule. RULE ZERO-B: where the app and the workbook disagree, the
 * workbook wins and the app is the thing that changes.
 */
/**
 * Is this group on the field in this round?
 *
 * ⚠ A BODY THAT HAS NOT ARRIVED DEALS NO DAMAGE AND HAS NO HP TO CHEW THROUGH, and a body whose
 * duration is up stops being either. Both halves matter: crediting a summon's damage from round 1
 * hands the fight output it never had, and leaving an expired body's HP in the pool makes the
 * party chase something that walked away.
 */
export function groupPresentIn(group: { arrivesRound?: number; expiresAfterRound?: number }, round: number): boolean {
  const arrives = Number(group.arrivesRound ?? 1);
  if (round < arrives) return false;
  const expires = group.expiresAfterRound;
  return typeof expires !== "number" || round <= expires;
}

/**
 * The encounter's effective HP as of a given round — everything that has ARRIVED by then.
 *
 * ⚠ THIS WAS A CONSTANT, AND THAT IS WHAT MADE A TIMED BODY INEXPRESSIBLE. `encounterEhp` was
 * summed once before round 1, so a summon arriving on round 3 either counted from the start (the
 * party chipping at something not yet on the field) or not at all.
 *
 * ⚠ AN EXPIRED BODY'S HP STAYS COUNTED ONCE IT HAS ARRIVED. A body that leaves after two rounds
 * still had to be dealt with while it was there, and the party's damage into it is spent either
 * way — removing its HP from the pool retroactively would hand that damage back.
 *
 * ⚠ AND A `split_body` ADDS NOTHING. *"Replace parent with authored bodies; never duplicate
 * parent HP."* Its pool is the parent's, already counted.
 */
export function encounterEhpAt(roster: PreparedGroup[], round: number): number {
  return roster.reduce((sum, group) => {
    if (group.replacesParent) return sum;
    return round >= Number(group.arrivesRound ?? 1) ? sum + group.groupEhp : sum;
  }, 0);
}

export function encounterDprAt(
  roster: PreparedGroup[], cumulativePartyDamage: number, round: number,
  /** Per concentration row, the share of its cycle that stood — see `RosterGroup.concentration`. Absent = all of it. */
  activeShare?: ReadonlyMap<string, number>,
): number {
  return roster.reduce((total, group) => {
    // A body not on the field this round contributes nothing — see `groupPresentIn`.
    if (!groupPresentIn(group, round)) return total;
    /**
     * A lair ends with the creature it belongs to — see `RosterGroup.endsWithGroupId`. A world
     * hazard names no parent and is unaffected by this branch.
     */
    if (group.endsWithGroupId) {
      const parent = roster.find(g => g.id === group.endsWithGroupId);
      if (parent && livingBodies(parent, cumulativePartyDamage) <= 0) return total;
    }
    const alive = livingBodies(group, cumulativePartyDamage);
    const c = group.concentration;
    const share = c && group.id ? activeShare?.get(group.id) : undefined;
    const bodyDpr = c && share !== undefined
      ? Math.max(0, share * roundValue(c.dependent, round) + roundValue(c.fixed, round))
      : roundValue(group.dpr, round);
    return total + alive * bodyDpr * group.dprUptime;
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
  /** HP the party's bonds stopped this round — reduction, temp HP and healing together. */
  bondMitigation: number;
  downs: number;
  damagedButStanding: number;
  standing: number;
  completesNow: boolean;
  fatalNow: boolean;
  status: "ONGOING" | "COMPLETE" | "FATAL" | "PARTY_DOWN";
  /** Each concentration row this round — v5 BR066 + BR073. Absent when the roster has none. */
  concentration?: { id: string; name: string; damageToHolder: number; hold: number; activeShare: number }[];
  /** PC turns lost this round to Stunned / Paralyzed / Incapacitated — see `RosterGroup.pcTurnDenials`. Absent when none. */
  pcTurnsLost?: number;
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
  /** How MER was read: the round the pool empties, or the fight's own mean round when it never does. */
  merBasis: "fall" | "rate" | null;
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

/**
 * BONDS ARE COUNTED ONCE — AND THE BASELINE HAS TO BE THE BOND-FREE ONE TO DO IT.
 *
 * The workbook names two internally consistent arrangements:
 *
 *   1. a BOND-FREE sustain denominator, plus live Bond prevention applied once on the combat
 *      clock — *"Recommended for the current UI"*. "The existing WotC Standard 617 baseline meets
 *      that requirement; the existing Broken Chain baseline does not."
 *   2. an ALL-IN Broken Chain sustain that already contains Bonds, and no second subtraction.
 *
 * ⚠ THE APP WAS DOING NEITHER. `mitigationPerRound` was passed unconditionally while the
 * denominator followed the selected mode, so Broken Chain mode took the all-in BC row AND took the
 * party's Bond prevention off incoming damage a second time.
 *
 * ⚠ AND ARRANGEMENT 2 IS THE WRONG FIX HERE, WHICH IS WHY IT IS NOT THE ONE IMPLEMENTED. Making BC
 * mode consistent by dropping the subtraction is coherent arithmetic and it discards the thing the
 * app actually knows: THIS party's bonds, read off their own sheets since 0.8.14.0. The certified
 * BC row carries the certification average instead. Arrangement 1 keeps the live reading, so that
 * is the one taken — the denominator moves to the bond-free row whenever live bonds are on the
 * clock, and the panel says it did.
 *
 * The toggle test the spec gives: turn Bonds off and the clock must change EXACTLY once, while the
 * sustain denominator does not move at all.
 */
export function bondArrangement(
  selectedMode: "wotcStandard" | "brokenChain",
  perRound: number,
  /** Is the app reading this party's own bonds at all — not "is the figure above zero". */
  readsLiveBonds: boolean,
): { baselineMode: "wotcStandard" | "brokenChain"; mitigation: number; reason: string } {
  /**
   * ⚠ THE CERTIFIED ROWS ARE LEFT ALONE. THE ONLY QUESTION IS WHICH ONE IS COMPARED AGAINST.
   *
   * Christopher, 2026-09-07: *"leave the certified R1/R2/R3/R4+/Sustain rows numerically
   * unchanged. The Bond fix only changes which existing certified row the live party compares
   * against: bond-free WotC baseline for Standard, BC baseline for Broken Chain."*
   *
   * So the baseline follows the MODE, and each mode then gets the arrangement its own row
   * requires — which is the workbook's rule that bonds are counted once:
   *
   *   Standard      the WotC row is BOND-FREE, so live bond prevention lands once on the clock.
   *   Broken Chain  the BC row is certified from BC actor state INCLUDING active legal bonds,
   *                 so nothing is subtracted a second time.
   *
   * ⚠ AN EARLIER PASS FORCED THE WOTC ROW IN BOTH MODES. That kept the app's live bond reading in
   * Broken Chain mode, and it silently swapped which certified row the DM was being measured
   * against — `Resource Conversion` row 47: *"Leave unchanged; compare the calculated current
   * party against it."* Changing the comparison row is not "leaving it unchanged".
   */
  const bonds = readsLiveBonds ? Math.max(0, perRound || 0) : 0;
  if (selectedMode === "brokenChain") {
    return {
      baselineMode: "brokenChain",
      mitigation: 0,
      reason: "already inside the certified Broken Chain row — not subtracted again",
    };
  }
  return {
    baselineMode: "wotcStandard",
    mitigation: bonds,
    reason: bonds > 0
      ? "applied once on the clock — the WotC Standard row is bond-free"
      : "no bond mitigation read from this party",
  };
}

export function simulateEncounter(opts: {
  party: {
    size: number; sustain: number; dpr: Partial<RoundProfile>;
    /**
     * The party's initiative modifier — the DEX line. Read from the chosen characters when there
     * are any (`partyDefenceFromActors`), otherwise the defence curve's DEX average.
     */
    initiative?: number;
    /**
     * Expected HP the party's BONDS prevent, absorb or restore each round — damage reduction,
     * temporary HP and healing, read from the characters' own assignments. See
     * `modules/the-broken-chain/bondMitigationFromActors`.
     *
     * ⚠ NOT PART OF SUSTAIN. Sustain is a pool spent once; this recurs every round, so folding it
     * into sustain would price a Guardian's Stand as a single 8 HP instead of 8 HP a round for the
     * length of the fight. In a five-round gate those differ by a factor of five.
     */
    mitigationPerRound?: number;
  };
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
  /**
   * ⚠ HOW MUCH OF THE ROSTER'S OUTPUT IS ALREADY COMMITTED WHEN THE PARTY ACTS.
   *
   * This replaces a hard-coded 0.5. See `initiativeOrder` for why it is a probability rather
   * than an order, and why 0.5 is still exactly what an evenly-matched roster produces.
   */
  const partyInitiative = Number(party.initiative ?? 0);
  const hostileFirst = hostileFractionActingFirst(
    prepared.map(g => ({
      name: g.name,
      quantity: g.quantity,
      initiativeMod: Number(g.initiativeMod ?? 0),
      weight: roundValue(g.dpr, 1),
    })),
    Number.isFinite(partyInitiative) ? partyInitiative : 0,
  );
  /**
   * ⚠ THE ENCOUNTER'S TOTAL, ONCE EVERYTHING HAS ARRIVED. This is the figure the report quotes,
   * the PCER divides by, and the HP-change guidance scales — all of which are questions about the
   * whole fight, so all of which want the full pool.
   *
   * The SIMULATION uses `encounterEhpAt(round)` instead, because "has the party finished?" is a
   * question about what is on the field right now. With no timed bodies the two are identical,
   * which is every encounter in the campaign today.
   */
  const encounterEhp = prepared.reduce(
    (sum, group) => (group.replacesParent ? sum : sum + group.groupEhp), 0);
  const maxRounds = Number(settings.maxRounds ?? 20);
  const damageAllocation: DamageAllocation =
    settings.damageAllocation === "spread_evenly" ? "spread_evenly" : "focus_fire";
  // EQUAL pools. Not an authored per-PC share.
  const sustainPerPc = partySustain / partySize;
  /**
   * ⚠ WHAT THE BONDS STOP FROM LANDING. Zero when the party carries none, which reproduces every
   * number this simulation produced before bonds were read at all.
   */
  const mitigationPerRound = Math.max(0, Number(party.mitigationPerRound ?? 0));
  const rounds: SimulationRound[] = [];
  let cumulativePartyDamage = 0;
  let cumulativeMonsterDamage = 0;
  let standing = partySize;
  let completionRound: number | null = null;
  let fatalRound: number | null = null;
  /** PC turns queued to be lost, by round — see the charge inside the loop. */
  const deniedPcTurns: number[] = [];
  /** Lost turns held by a creature's CONCENTRATION — each still owed turn stands only while its holder keeps it. */
  const concentrationDenied: Array<{ holderId: string; queued: number; at: number; lost: number }> = [];

  for (let round = 1; round <= maxRounds; round += 1) {
    const pcsStart = standing;
    const partyPotential = roundValue(party.dpr, round);
    /**
     * ⚠ THE SURVIVOR PROJECTION IS AN OUTPUT AND MUST NOT DRIVE THE TRACE.
     *
     * This used to read `partyPotential * pcsStart / partySize` — party damage scaled by how many
     * PCs the model projected were still standing. That makes a PROJECTION an INPUT, and v7 is
     * explicit about what these numbers are (`contract.survivor_projection.precision`):
     *
     *     "Downs, damaged-but-standing, and standing counts are model projections under the
     *      selected allocation, not observed combat outcomes."
     *
     * The audit says the same in its own words: *"Down, Standing, completion round and safety
     * margin must be outputs of the trace rather than assumptions used to force the trace toward
     * a verdict."*
     *
     * ⚠ THE OBSERVABLE DEFECT: the two allocations project downs on different schedules —
     * focus fire drops PCs one at a time, spread-evenly drops none until the party's whole
     * sustain is gone — so feeding that back changed PARTY DAMAGE, and with it the completion
     * round. The same fight completed in 5 rounds or 6 depending on a display toggle. A lens on
     * the result was silently rewriting the result.
     *
     * The party curve is already the party's expected output for the round; scaling it again by
     * projected casualties counts the same attrition twice. A total-party-down is still terminal —
     * that is the `pcsStart === 0` guard, and the loop breaks on it.
     */
    /**
     * ⚠ A CONCENTRATION EFFECT STANDS ON ITS LATER TURNS ONLY IF ITS CASTER HELD IT — v5 BR066 + BR073.
     *
     * *"Two-turn value = V_turn1 + P_ACTIVE_2 × V_turn2; P_ACTIVE_2 includes source survival,
     * concentration, repeat saves, and break conditions."* Source survival is already `endsWithGroupId`.
     * Concentration is the party's damage into the holder over the last round: each PC's share of it one
     * damage instance and one Constitution save (`durationPricing.concentrationHold`). The row's dependent
     * value then carries the average share of its recast cycle that stood — (1 + hold) / 2 for two turns —
     * the same cycle average its round-2+ burden already uses for the Action given up.
     *
     * While the party is killing something else the holder takes nothing, the hold is 1, and every
     * number is exactly what it was. Round 1 is the cast: nothing has been dealt to it yet.
     */
    const activeShare = new Map<string, number>();
    const concentrationReport: NonNullable<SimulationRound["concentration"]> = [];
    for (const group of prepared) {
      const c = group.concentration;
      if (!c || !group.id) continue;
      const previous = rounds[rounds.length - 1];
      const holder = prepared.find(g => g.id === c.holderGroupId);
      let damageToHolder = 0;
      let hold = 1;
      if (previous && holder && previous.partyDamage > 0) {
        damageToHolder = Math.max(0, damageIntoGroup(holder, previous.cumulativePartyDamage)
          - damageIntoGroup(holder, previous.cumulativePartyDamage - previous.partyDamage));
        hold = concentrationHold(c.conSave, damageToHolder, previous.partyDamage / partySize).hold;
      }
      const share = cycleActiveShare(c.activeTurns, hold);
      activeShare.set(group.id, share);
      concentrationReport.push({ id: group.id, name: String(group.name ?? group.id), damageToHolder, hold, activeShare: share });
    }
    /**
     * ⚠ A HINDERING ZONE TAKES ITS SHARE OFF THE PARTY'S OWN DAMAGE — while its holder stands.
     * Every active `partyDamageFactor` multiplies; a row bound to a dead creature no longer counts, and a
     * concentration row's loss counts for the share of its cycle that stood.
     * With none present this is exactly 1, so every other fight is unchanged.
     */
    const partyFactor = prepared.reduce((factor, group) => {
      const f = Number(group.partyDamageFactor ?? 1);
      if (!(f < 1) || !groupPresentIn(group, round)) return factor;
      if (group.endsWithGroupId) {
        const parent = prepared.find(g => g.id === group.endsWithGroupId);
        if (parent && livingBodies(parent, cumulativePartyDamage) <= 0) return factor;
      }
      const share = group.concentration && group.id ? activeShare.get(group.id) ?? 1 : 1;
      return factor * Math.max(0, 1 - share * (1 - f));
    }, 1);
    /**
     * ⚠ A PC WHO LOSES ITS TURN DEALS NOTHING THAT TURN — ITS SHARE, NOT THE PARTY'S ROUND.
     *
     * Christopher, 2026-09-13: *"it should be charged on PC loses of turn not party loss of turn."* Each
     * use a living body makes this round queues its caught PCs' lost turns. The first lands this round if
     * the monster acts before the party (`hostileFirst`), otherwise next round, and each later turn one
     * round after that. A round's lost turns take 1 ÷ party size of the party's damage each, and never
     * more than the whole party. Bodies acting are counted at the start of the round, before the party's
     * damage lands — the charge cannot depend on the damage it reduces.
     */
    const scheduleKey = (round <= 1 ? "round1" : round === 2 ? "round2" : round === 3 ? "round3" : "round4Plus") as keyof RoundProfile;
    /**
     * ⚠ A CONCENTRATED CONDITION LOSES ITS LATER TURNS WHEN THE HOLD BREAKS — v5 BR073.
     *
     * *"P_ACTIVE_R multiplies the sequence of required concentration saves and source survival."* 0.8.57.0
     * charged a concentrated Hold or Stun for every turn it printed, as if the caster could never be broken
     * (*"A concentration hold is not applied to control"*). Each round, every turn it still owes is multiplied
     * by THIS round's hold — the holder's CON save against the party's damage into it last round, one save
     * per damage instance, the same `concentrationHold` a concentration zone uses — and a dead holder owes
     * nothing. A turn queued this round is not tested yet: nothing has been dealt to the caster since the cast.
     */
    if (concentrationDenied.length) {
      const previous = rounds[rounds.length - 1];
      const holdOf = new Map<string, number>();
      for (const owed of concentrationDenied) {
        if (owed.at < round || owed.queued >= round || owed.lost <= 0) continue;
        let hold = holdOf.get(owed.holderId);
        if (hold === undefined) {
          const holder = prepared.find(g => g.id === owed.holderId);
          if (!holder || livingBodies(holder, cumulativePartyDamage) <= 0) hold = 0;
          else if (previous && previous.partyDamage > 0) {
            const damageToHolder = Math.max(0, damageIntoGroup(holder, previous.cumulativePartyDamage)
              - damageIntoGroup(holder, previous.cumulativePartyDamage - previous.partyDamage));
            hold = concentrationHold(Number(holder.conSave ?? 0), damageToHolder, previous.partyDamage / partySize).hold;
          } else hold = 1;
          holdOf.set(owed.holderId, hold);
        }
        owed.lost *= hold;
      }
    }
    if (completionRound === null && pcsStart > 0) {
      for (const group of prepared) {
        const uses = group.pcTurnDenials?.[scheduleKey];
        if (!uses?.length || !groupPresentIn(group, round)) continue;
        if (group.endsWithGroupId) {
          const parent = prepared.find(g => g.id === group.endsWithGroupId);
          if (parent && livingBodies(parent, cumulativePartyDamage) <= 0) continue;
        }
        const acting = livingBodies(group, cumulativePartyDamage) * group.dprUptime;
        for (const use of uses) {
          use.turns.forEach((p, k) => {
            const lost = acting * use.pcs * p;
            if (use.concentration && group.id) {
              concentrationDenied.push({ holderId: group.id, queued: round, at: round + k, lost: lost * hostileFirst });
              concentrationDenied.push({ holderId: group.id, queued: round, at: round + k + 1, lost: lost * (1 - hostileFirst) });
              return;
            }
            deniedPcTurns[round + k] = (deniedPcTurns[round + k] ?? 0) + lost * hostileFirst;
            deniedPcTurns[round + k + 1] = (deniedPcTurns[round + k + 1] ?? 0) + lost * (1 - hostileFirst);
          });
        }
      }
    }
    const concentrationLost = concentrationDenied.reduce((s, owed) => s + (owed.at === round ? owed.lost : 0), 0);
    const pcTurnsLost = Math.min(partySize, (deniedPcTurns[round] ?? 0) + concentrationLost);
    const partyDamage = completionRound || pcsStart === 0 ? 0 : partyPotential * partyFactor * (1 - pcTurnsLost / partySize);
    const partyDamageBefore = cumulativePartyDamage;
    cumulativePartyDamage += partyDamage;
    /**
     * ⚠ AGAINST WHAT IS ON THE FIELD, NOT THE WHOLE FIGHT. A party cannot finish an encounter it
     * has not met yet: with a summon arriving on round 3, clearing rounds 1–2 is not a clear.
     * Comparing against the full total would also do the opposite harm — a fight would read as
     * unfinished while the party stands over the last body, because HP that has not arrived is
     * still counted against them.
     *
     * Identical to `encounterEhp` for a fight with no timed bodies, which is every encounter in
     * the campaign today.
     */
    const ehpOnField = encounterEhpAt(prepared, round);
    const completesNow = completionRound === null && ehpOnField > 0
      && cumulativePartyDamage + EPSILON >= ehpOnField;
    const monsterDprStart = encounterDprAt(prepared, partyDamageBefore, round, activeShare);
    const monsterDprEnd = encounterDprAt(prepared, cumulativePartyDamage, round, activeShare);
    /**
     * ⚠ Monster damage is NOT scaled by PCs standing — survivors remain valid targets.
     *
     * ⚠ NO EXTRA COMPLETION-ROUND DISCOUNT. v7 `campaign_semantics.final_round`: *"Use a single
     * initiative model; never apply an extra completion-round damage discount ON TOP OF
     * midpoint/whole-body attrition."*
     *
     * ⚠ THE MIDPOINT IS NOW THE DEFAULT CASE OF A READ ONE. This was a fixed (start + end) / 2;
     * it is now `hostileFirst * start + (1 - hostileFirst) * end`, where the fraction comes from
     * the bodies' own initiative modifiers against the party's. An evenly-matched roster yields
     * 0.5 and therefore the identical number. It is still ONE initiative model, which is what the
     * rule below requires — it is simply no longer the same one for every fight.
     *
     * The midpoint of start-of-round and end-of-round output IS the single initiative model, and
     * with whole-body attrition it already accounts for bodies dropping mid-round. Multiplying it
     * again by `completionRoundMonsterFraction` (0.5 by default) was the second discount the rule
     * names — it halved the monsters' output in the very round the fight is decided, which is
     * usually their most dangerous one.
     */
    const monsterDamageBeforeBonds = completionRound || pcsStart === 0
      ? 0
      : hostileFirst * monsterDprStart + (1 - hostileFirst) * monsterDprEnd;
    /**
     * ⚠ CAPPED AT THE ROUND'S OWN DAMAGE, so mitigation can never run the party's HP UP.
     *
     * Reduction and temporary HP genuinely cannot: an unspent point of either is simply wasted.
     * HEALING can in principle restore earlier losses, and letting it do so here would be wrong
     * in the other direction — with no per-PC HP tracking, uncapped healing would let a party
     * exceed full HP and outrun a fight it should lose. Capping per round understates a dedicated
     * healer slightly and can never overstate one, which is the correct way round for a checker
     * a DM uses to decide whether a fight is survivable.
     */
    const bondMitigation = Math.min(mitigationPerRound, monsterDamageBeforeBonds);
    const monsterDamage = monsterDamageBeforeBonds - bondMitigation;
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
      bondMitigation,
      // What is left of what has ARRIVED — the number a DM reads mid-fight.
      monsterEhpLeft: Math.max(0, ehpOnField - cumulativePartyDamage),
      monsterDprStart, monsterDprEnd, monsterDamage, cumulativeMonsterDamage,
      downs, damagedButStanding, standing, completesNow, fatalNow, status,
      ...(concentrationReport.length ? { concentration: concentrationReport } : {}),
      ...(pcTurnsLost > 0 ? { pcTurnsLost } : {}),
    });
    if (completionRound !== null) break;
    if (standing === 0) break;
  }

  const completionState = completionRound === null
    ? null : rounds.find(row => row.round === completionRound) ?? null;
  const startingEncounterDpr = encounterDprAt(prepared, 0, 1);
  const pcer = partyRoundEquivalent(party.dpr, encounterEhp);
  /**
   * MER — ROUNDS UNTIL THE PARTY RUNS OUT, AT THE RATE THIS FIGHT ACTUALLY DEALS.
   *
   * Christopher, 2026-09-23, on Act 3 fights headlined FALLS FIRST above a round table showing the
   * party surviving: *"none of these things should be correct."* He was right, and the fault was one
   * division. This was sustain / the roster DPR of ROUND ONE — the whole roster, alive, for every round
   * of the fight — while PCER walks the party down its own R1..R4+ ladder and the simulation beside it
   * kills bodies. The Scar Line read "2.63 rounds to fall" against a fight that deals 112, 62, 28, 16, 9:
   * 227 of a 296 pool, so the party never falls at all.
   *
   * PCER and MER now measure the same way — each side at its own decaying rate:
   *   the party FALLS      the fractional round its pool empties, read off the rounds themselves
   *   it does not fall     sustain / the fight own mean round, so the margin stays a number a DM can
   *                        compare and the HP-change suggestion still has something to solve for
   *
   * ⚠ PCER/MER ARE THE CHECKER OWN, not workbook rows (MASTER: the checker "adds PCER/MER, safety
   * margin, special-outcome risks and allocation" to the v6 fields), so this definition is ours to
   * correct. The roster opening DPR is still reported as `startingEncounterDpr`.
   */
  const monsterDamageDealt = rounds.reduce((sum, row) => sum + row.monsterDamage, 0);
  let merBasis: "fall" | "rate" | null = null;
  const mer = (() => {
    let cum = 0;
    for (const row of rounds) {
      if (row.monsterDamage > 0 && cum + row.monsterDamage + EPSILON >= partySustain) {
        merBasis = "fall";
        return row.round - 1 + (partySustain - cum) / row.monsterDamage;
      }
      cum += row.monsterDamage;
    }
    const meanRound = rounds.length > 0 ? monsterDamageDealt / rounds.length : 0;
    if (!(meanRound > 0)) return null;
    merBasis = "rate";
    return partySustain / meanRound;
  })();
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
    pcer, mer, safetyMargin, merBasis,
    balanceAdjustment: {
      targetSafetyMargin, targetPcer, targetEncounterEhp, scaledHpChange, baseFourPcHpChange,
      percentChange: scaledHpChange === null || encounterEhp === 0 ? null : scaledHpChange / encounterEhp,
    },
    rounds,
  };
}
