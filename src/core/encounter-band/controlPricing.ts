/**
 * CONTROL PRICING — the deterministic d20 repricing rules from the v7 pricing contract.
 *
 * Source: `encounter_checker_runtime_package_v7_pricing_ac_save.json` → `pricing_contract.rules`,
 * plus `encounter_checker_pricing_ac_save_reference_v7_reach_provisional.json` →
 * `grapple_restrain_frighten_stun`. LAYER: D&D MOD under RULE THREE.
 *
 * ⚠ EVERY RULE HERE IS MARKED auto=YES IN THE CONTRACT AND NEEDS NO NEW DATA. They are closed-form
 * transformations of a probability the checker already computes. Christopher, 2026-08-20:
 * *"If a pricing rule is deterministic and you have all required inputs, implement it. Do not stop
 * at 'unblocked.'"* Reporting them as available instead of building them was the failure.
 *
 * ⚠ THE MATH IS ON THE DIE, NOT ON THE DAMAGE. Advantage is not "+5 to hit" and disadvantage is
 * not a flat damage tax — both are order statistics on two d20s, and their effect on the hit rate
 * depends entirely on where that rate already sits. At p=0.5 advantage is worth +0.25; at p=0.9 it
 * is worth +0.09. A flat modifier would misprice both ends, which is exactly the *"opaque universal
 * multiplier"* the reference tells us to avoid when event math is available.
 */

import { mentionsUnnegated } from "../text/negatedMention";

/** Roll two d20s and keep the better: the chance of success rises to 1 − (1−p)². */
export function withAdvantage(p: number): number {
  return 1 - (1 - p) * (1 - p);
}

/** Roll two d20s and keep the worse: the chance of success falls to p². */
export function withDisadvantage(p: number): number {
  return p * p;
}

/**
 * Reroll a FAILED d20 once and take the second result.
 *
 * Mathematically identical to advantage on the success probability — you fail only if both rolls
 * fail — but it is kept separate because it is a different mechanic with a different cost (a
 * resource, usually once per rest) and the trace should say which one was priced.
 */
export function withRerollOnFail(p: number): number {
  return 1 - (1 - p) * (1 - p);
}

/** How a d20 is being modified. `none` is a first-class value so callers never branch on undefined. */
export type RollSwing = "none" | "advantage" | "disadvantage";

/** Apply a swing to a success probability. */
export function applySwing(p: number, swing: RollSwing): number {
  if (swing === "advantage") return withAdvantage(p);
  if (swing === "disadvantage") return withDisadvantage(p);
  return p;
}

/**
 * Two swings combining. In 5e advantage and disadvantage CANCEL — they do not stack and they do
 * not partially offset. Modelling them as additive is a rules error that compounds across a trace.
 */
export function combineSwings(a: RollSwing, b: RollSwing): RollSwing {
  if (a === b) return a;
  if (a === "none") return b;
  if (b === "none") return a;
  return "none"; // one of each: they cancel
}

/**
 * What a condition does to the creature suffering it, and to attacks made against it.
 *
 * Sourced rule by rule from the contract. `actionsLost` is the incapacitation case — the contract
 * separates "loses its actions" from "cannot reach", and only the former zeroes damage regardless
 * of position.
 */
export type ConditionEffect = {
  /** Attacks made BY the affected creature. */
  outgoingAttacks: RollSwing;
  /** Attacks made AGAINST the affected creature. */
  incomingAttacks: RollSwing;
  /** Saves the affected creature rolls; `dexOnly` narrows it to DEX (Restrained). */
  saves: RollSwing;
  savesDexOnly?: boolean;
  /** The creature takes no actions at all — damage is 0 for the duration, wherever it stands. */
  actionsLost?: boolean;
  /** Movement becomes 0. */
  speedZero?: boolean;
  detail: string;
};

/**
 * The conditions the contract prices automatically.
 *
 * ⚠ RESTRAINED IS THREE EFFECTS, NOT ONE. Contract: *"Target attacks have disadvantage; attacks
 * against target have advantage; Dex saves have disadvantage."* Pricing only the first (the
 * obvious one) under-counts it by roughly half — the incoming-advantage term is usually the larger
 * of the two, because the party is attacking far more often than the single restrained creature.
 */
export const CONDITION_EFFECTS: Record<string, ConditionEffect> = {
  restrained: {
    outgoingAttacks: "disadvantage",
    incomingAttacks: "advantage",
    saves: "disadvantage",
    savesDexOnly: true,
    detail: "Restrained: its attacks at disadvantage, attacks against it at advantage, DEX saves at disadvantage.",
  },
  /**
   * ⚠ STUNNED AND INCAPACITATED ARE THE SAME PRICE HERE ON PURPOSE. Stunned is incapacitated plus
   * auto-failed STR/DEX saves plus advantage to attackers; incapacitated is the action loss alone.
   * Both zero the creature's damage for the duration, which is the whole offensive consequence —
   * the difference between them is defensive, and shows up in `incomingAttacks` and the save line.
   */
  stunned: {
    outgoingAttacks: "none",
    incomingAttacks: "advantage",
    saves: "disadvantage",
    actionsLost: true,
    speedZero: true,
    detail: "Stunned: no actions, speed 0, attacks against it at advantage, STR and DEX saves fail.",
  },
  incapacitated: {
    outgoingAttacks: "none",
    incomingAttacks: "none",
    saves: "none",
    actionsLost: true,
    detail: "Incapacitated: takes no actions and no reactions.",
  },
  paralyzed: {
    outgoingAttacks: "none",
    incomingAttacks: "advantage",
    saves: "disadvantage",
    actionsLost: true,
    speedZero: true,
    detail: "Paralyzed: no actions, speed 0, attacks against it at advantage and auto-crit within 5 ft.",
  },
  prone: {
    // The attack matrix is range-dependent, so it is resolved by `proneIncomingSwing` instead of
    // a single value here — a melee attacker gains advantage where a ranged one suffers the
    // opposite, and collapsing that to one swing is what makes prone price wrongly.
    outgoingAttacks: "disadvantage",
    incomingAttacks: "none",
    saves: "none",
    detail: "Prone: its attacks at disadvantage; attacks against it depend on the attacker's distance.",
  },
  frightened: {
    outgoingAttacks: "disadvantage",
    incomingAttacks: "none",
    saves: "none",
    detail: "Frightened: attacks and checks at disadvantage while the source is visible, and it cannot willingly approach.",
  },
  grappled: {
    outgoingAttacks: "none",
    incomingAttacks: "none",
    saves: "none",
    speedZero: true,
    detail: "Grappled: Speed 0. Actions are not removed.",
  },
  /**
   * ⚠ UNCONSCIOUS AND PETRIFIED TAKE THE WHOLE TURN TOO, and were missing — so no reader could see them.
   * Both carry the Incapacitated condition by rule. Christopher, 2026-09-13, on how a monster's control is
   * charged: *"it should be charged on PC loses of turn"* — these are two of the conditions that do it.
   */
  unconscious: {
    outgoingAttacks: "none",
    incomingAttacks: "advantage",
    saves: "disadvantage",
    actionsLost: true,
    speedZero: true,
    detail: "Unconscious: incapacitated and prone, speed 0, attacks against it at advantage and auto-crit within 5 ft, STR and DEX saves fail.",
  },
  petrified: {
    outgoingAttacks: "none",
    incomingAttacks: "advantage",
    saves: "disadvantage",
    actionsLost: true,
    speedZero: true,
    detail: "Petrified: incapacitated, speed 0, attacks against it at advantage, STR and DEX saves fail, resistance to all damage.",
  },
};

/**
 * Attacks against a PRONE target. Contract: *"attacks from ≤5 ft gain advantage and attacks from
 * >5 ft have disadvantage."*
 *
 * ⚠ THIS IS WHY PRONE CANNOT BE ONE NUMBER. Against a melee party prone is a liability; against a
 * ranged one it is protection. The reference asks for it to be *"weighted by party melee/ranged
 * attack share when available"* — `meleeShare` is that weight.
 */
export function proneIncomingSwing(attackerDistanceFt: number): RollSwing {
  return attackerDistanceFt <= 5 ? "advantage" : "disadvantage";
}

/**
 * Expected hit probability against a prone target for a MIXED party.
 *
 * `meleeShare` is the fraction of the party's attacks made from within 5 ft. The two halves are
 * priced separately and recombined, because advantage on one half and disadvantage on the other
 * do not cancel — they are different attacks.
 */
export function pHitVsProne(pHit: number, meleeShare: number): number {
  const share = Math.min(1, Math.max(0, meleeShare));
  return share * withAdvantage(pHit) + (1 - share) * withDisadvantage(pHit);
}

/** Look up a condition by name, tolerating the printed casing. */
export function conditionEffect(name: string | undefined): ConditionEffect | undefined {
  if (!name) return undefined;
  return CONDITION_EFFECTS[name.trim().toLowerCase()];
}

/**
 * Read the conditions a feature imposes, from its authored list first and its printed text second.
 *
 * ⚠ AUTHORED OUTRANKS PROSE, the same precedence the rest of the parser uses. Text-matching is a
 * fallback so that existing library creatures — none of which carry an authored condition list —
 * still price; it is not the primary path.
 */
export function conditionsImposedBy(feature: { conditions?: readonly string[]; text?: string }): string[] {
  if (feature.conditions?.length) {
    return feature.conditions.map(c => c.trim().toLowerCase()).filter(c => c in CONDITION_EFFECTS);
  }
  const text = (feature.text ?? "").toLowerCase();
  if (!text) return [];
  return Object.keys(CONDITION_EFFECTS).filter(c => mentionsUnnegated(text, c));
}

