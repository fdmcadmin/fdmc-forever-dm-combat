/**
 * REACHABILITY — deterministic control pricing before a full tactical-position trace exists.
 *
 * Source: `encounter_checker_pricing_ac_save_reference_v7_reach_provisional.json` →
 * `pricing.provisional_reach_conditions`, transcribed. LAYER: D&D MOD under RULE THREE.
 *
 * ⚠ THE ABSENCE OF BATTLEFIELD COORDINATES IS NOT A REASON TO LEAVE THIS UNPRICED. Christopher,
 * 2026-08-20: *"Do not treat absence of full battlefield coordinates as meaning Prone/Grappled/
 * forced movement are inherently unpriceable. Use deterministic reachability from creature
 * footprint, movement state, and authored attack/spell/effect reach/range."* He is right — every
 * input the contract's formulas need is already authored or derivable:
 *
 *   footprint  ← creature SIZE (Tiny…Gargantuan), a field the editor already has
 *   reach      ← the PRINTED reach on a melee action; ruleset default when omitted
 *   range      ← the PRINTED range on a ranged attack, spell, aura or save effect
 *   movement   ← the creature's speed, modified by the condition being priced
 *
 * The only thing missing was a separation, and a separation is a single number — not a coordinate
 * system. What is priced is whether a routine can still legally reach, which is deterministic.
 *
 * ⚠ SIZE IS OCCUPIED SPACE, NOT REACH. The reference says so outright: *"Creature size defines
 * occupied space, not attack reach."* A Huge creature does not get 15 ft of melee reach for being
 * Huge — it gets a 15×15 footprint, and its reach is whatever its attack prints. Both matter,
 * because reachability is measured EDGE TO EDGE: the footprint is what shortens the gap.
 *
 * ⚠ PROVISIONAL, and the reference labels it so. `full_trace_upgrade`: when exact positions,
 * per-action reaches, heights and target identities exist they supersede these assumptions
 * "without changing the pricing principle" — so the shape here is the shape that survives.
 */

import type { ParsedFeature } from "./featureResolver";

/** Occupied combat space per size, in feet. From `size_space_ft`. */
export const SIZE_SPACE_FT: Record<string, number> = {
  tiny: 2.5,       // "provisional combat footprint"
  small: 5,
  medium: 5,
  large: 10,
  huge: 15,
  gargantuan: 20,  // "minimum; use authored larger space when explicitly provided"
};

/** A PC's space. `pc_default_space`: 5×5 unless an authored effect changes it. */
export const PC_SPACE_FT = 5;

/** The ruleset default melee reach, used ONLY when an action prints none. */
export const DEFAULT_MELEE_REACH_FT = 5;

/**
 * Occupied space for a creature size. Unknown sizes fall back to Medium — the commonest case,
 * and the one that neither flatters nor punishes a creature whose size was not authored.
 */
export function spaceForSize(size: string | undefined): number {
  if (!size) return PC_SPACE_FT;
  return SIZE_SPACE_FT[size.trim().toLowerCase()] ?? PC_SPACE_FT;
}

/**
 * The distance an action can legally cover.
 *
 * ⚠ NEVER INFERRED FROM SIZE. `reach_source` is explicit: *"Never infer melee reach from size
 * alone. Use the printed reach on the attack/action."* A ranged action uses its printed normal
 * range; `range_source` covers weapons, spells, saves, auras and other effects alike.
 */
export function reachOfFeature(feature: ParsedFeature): number {
  if (typeof feature.rangeFt === "number" && Number.isFinite(feature.rangeFt)) return feature.rangeFt;
  if (typeof feature.reachFt === "number" && Number.isFinite(feature.reachFt)) return feature.reachFt;
  return DEFAULT_MELEE_REACH_FT;
}

/**
 * Is a routine legal at this separation?
 *
 * `creature_to_creature_test`: reachable when the shortest EDGE-TO-EDGE distance between the two
 * occupied spaces is ≤ the action's legal reach/range. `separationFt` is already that edge-to-edge
 * gap, so the footprints are accounted for by whoever computed it — see `separationAfterMove`.
 */
export function isReachable(separationFt: number, reachFt: number): boolean {
  return separationFt <= reachFt + 1e-9;
}

/**
 * Edge-to-edge separation after a creature closes with whatever movement it has.
 *
 * Movement shortens the gap directly; it cannot go below zero (bodies do not overlap). The
 * footprints matter when converting a centre-to-centre distance, which is why callers that hold
 * one pass it through `edgeGapFromCentres` first.
 */
export function separationAfterMove(separationFt: number, movementFt: number): number {
  return Math.max(0, separationFt - Math.max(0, movementFt));
}

/** Centre-to-centre → edge-to-edge, subtracting half of each footprint. */
export function edgeGapFromCentres(centreDistanceFt: number, sizeA: string | undefined, sizeB: string | undefined): number {
  return Math.max(0, centreDistanceFt - spaceForSize(sizeA) / 2 - spaceForSize(sizeB) / 2);
}

export type ReachOutcome = {
  /** The features that can still legally reach a target. */
  reachable: ParsedFeature[];
  /** Every damaging routine is out of reach — the contract's DPR = 0 case. */
  allOutOfReach: boolean;
  /** The separation the test was run at, after the condition's movement effect. */
  effectiveSeparationFt: number;
  /** Plain-language record of what was applied, for the trace. */
  note: string;
};

/**
 * Which damaging routines survive a condition, and whether any do.
 *
 * The shared tail of every `pricing_sequence` in the reference: apply the movement effect,
 * recompute the gap, test every legal melee/ranged/spell/save/trait routine, and if none reaches,
 * that action window's DPR is 0.
 */
export function reachableRoutines(
  features: readonly ParsedFeature[],
  separationFt: number,
  movementFt: number,
  note: string,
): ReachOutcome {
  const effective = separationAfterMove(separationFt, movementFt);
  const reachable = features.filter(f => isReachable(effective, reachOfFeature(f)));
  return {
    reachable,
    allOutOfReach: reachable.length === 0 && features.length > 0,
    effectiveSeparationFt: effective,
    note,
  };
}

/**
 * PRONE. `provisional_reach_conditions.prone.pricing_sequence`, in order.
 *
 * Standing costs HALF the creature's speed *"unless an authored rule changes the cost"*; what is
 * left is what it can close with. Standing itself deals no damage — the reference says so
 * explicitly, so it is never credited as an action.
 */
export function priceProne(
  features: readonly ParsedFeature[],
  separationFt: number,
  speedFt: number,
  opts: { standingCostFt?: number; canStand?: boolean } = {},
): ReachOutcome {
  const canStand = opts.canStand ?? true;
  const standingCost = opts.standingCostFt ?? speedFt / 2;
  const movement = canStand ? Math.max(0, speedFt - standingCost) : 0;
  return reachableRoutines(features, separationFt, movement,
    canStand
      ? `Prone: standing costs ${standingCost} ft of ${speedFt} ft, leaving ${movement} ft to close.`
      : `Prone and unable to stand: no movement available.`);
}

/**
 * GRAPPLED. `provisional_reach_conditions.grappled`.
 *
 * ⚠ SPEED 0 IS NOT "LOSES ITS ACTIONS". The contract is emphatic — *"Do not remove actions"* —
 * so the creature keeps its full routine and is priced from where it stands. Melee still reaches
 * anything already within reach, and every ranged/spell/save option remains available. Only when
 * NOTHING can reach does DPR go to 0.
 */
export function priceGrappled(features: readonly ParsedFeature[], separationFt: number): ReachOutcome {
  return reachableRoutines(features, separationFt, 0,
    "Grappled: Speed 0, priced from the current space — actions are not removed.");
}

/**
 * FORCED MOVEMENT. `provisional_reach_conditions.forced_movement`.
 *
 * The displacement changes the separation; then the SAME reachability test runs for the next
 * action window, with whatever movement remains. *"Do not apply an arbitrary flat DPR percentage
 * when legal reachability can be determined."*
 */
export function priceForcedMovement(
  features: readonly ParsedFeature[],
  separationFt: number,
  displacementFt: number,
  speedFt: number,
): ReachOutcome {
  const pushed = Math.max(0, separationFt + displacementFt);
  const out = reachableRoutines(features, pushed, speedFt,
    `Forced movement: ${displacementFt >= 0 ? "pushed" : "pulled"} ${Math.abs(displacementFt)} ft to a ${pushed} ft gap, then ${speedFt} ft of movement available.`);
  return out;
}

/**
 * FRIGHTENED. `provisional_reach_conditions.frightened`.
 *
 * ⚠ NOT AUTOMATICALLY ZERO. The condition forbids willingly moving CLOSER to the source, so the
 * creature closes no distance — but the reference is explicit that *"If the creature can use a
 * legal non-approach ranged/spell routine, price that routine instead of forcing DPR to 0."*
 * A frightened caster with a 120-ft spell is not disarmed; a frightened brute with a 5-ft reach
 * and a 30-ft gap is. Attack repricing (disadvantage while the source is visible) is applied
 * separately by `controlPricing`.
 */
export function priceFrightened(
  features: readonly ParsedFeature[],
  separationFt: number,
  opts: { sourceVisible?: boolean } = {},
): ReachOutcome {
  const visible = opts.sourceVisible ?? true;
  if (!visible) {
    return { reachable: [...features], allOutOfReach: false, effectiveSeparationFt: separationFt,
      note: "Frightened but the source is not visible: no restriction applies." };
  }
  // Cannot willingly move closer, so no gap is closed — everything is tested from where it stands.
  return reachableRoutines(features, separationFt, 0,
    "Frightened: cannot willingly approach the source, so no distance is closed; non-approach routines still price normally.");
}
