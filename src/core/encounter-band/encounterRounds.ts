/**
 * Shared encounter vocabulary — types and party-size helpers only.
 *
 * ⚠ THE MODEL THAT USED TO LIVE HERE IS GONE (0.7.9.1). Christopher: *"why is the old model a
 * thing still, this replaces the checker wholesale."* The balance model is now
 * `checkerV2.ts` — a verified port of the workbook's own reference runtime — fed by
 * `partyCurveV2.ts`. Nothing in the app computes encounter arithmetic of its own any more.
 *
 * What was deleted, and why each had to go:
 *  · `MIDPOINT_DPR_4P` / `midpointDprForLevel` / `partyDpr` — superseded by the v2 party curve,
 *    which covers 20 levels, two equipment modes and a real R1..R4+ profile.
 *  · `estimateRounds` / `RoundsEstimate` / `ROUND_BAND` / `verdictForRounds` — the checker
 *    reports a completion round and a fatal round; it does not grade a fight against a band.
 *  · `LANE_MULTIPLIER` / `RESOURCE_MULTIPLIER` (easy…punishing, fresh…depleted) — invented
 *    here and absent from the contract, which takes an equipment mode plus optional custom
 *    DPR/sustain overrides instead.
 *  · `acFactor` / `PARTY_ATTACK_SHARE` / `BASELINE_TARGET_AC` — AC is a multiplier on the
 *    CREATURE's effective HP in the contract, not a discount on the party's damage. It lives
 *    in `rosterFromLibrary.acMultiplierFor` now.
 *  · `effectiveHp` / `defensiveMultiplier` — replaced by `effectiveHpPerBody`, which combines
 *    traits as a PRODUCT and divides by damage pass and uptime.
 *  · `REALIZATION` — a dice-EV fudge with nothing to correct any more.
 *
 * Only the shared vocabulary other modules genuinely need survives here.
 */

// Type-only: erased at compile, so this module stays dependency-free.
import type { MonsterClassification } from "../monsters/runtime/mainMonsterRuntime";
import { partySizeHpMultiplier } from "./partyCurveV2";

/**
 * One named defensive trait and what it is worth as an effective-HP multiplier.
 *
 * ITEMISED ON PURPOSE. "Reknit in the Cold returns it at 40% once" is checkable at the table;
 * a bare 1.84 is not. `rosterFromLibrary` converts each of these into a checker sustain factor
 * — `ehpMultiplier: 1.40` is the workbook's `contribution: 0.40`, and the two columns differ by
 * exactly 1.0 — and the checker then combines them as a PRODUCT, rejecting duplicate stack
 * groups so one effect cannot be credited twice.
 */
export type MonsterDefense = {
  /** The trait's actual name, as printed on the stat block. Doubles as its stack group. */
  name: string;
  /** Effective-HP multiplier. 1.40 = "this trait is worth 40% more HP". */
  ehpMultiplier: number;
  /** Why it is worth that — the arithmetic, so a future session can re-check it. */
  note?: string;
};

export const CLASSIFICATION_LABEL: Record<MonsterClassification, string> = {
  normal: "Normal",
  strong: "Strong",
  elite: "Elite",
  "mid-boss": "Mid boss",
  "act-boss": "Act boss",
  "final-boss": "Final boss",
};

/** Weakest → strongest. A fight's tier comes from the strongest creature in it. */
export const CLASSIFICATION_ORDER: readonly MonsterClassification[] = [
  "normal", "strong", "elite", "mid-boss", "act-boss", "final-boss",
];

/**
 * The higher of two tiers — a declared encounter tier may only ESCALATE above what its roster
 * justifies, never soften it.
 */
export function maxClassification(
  a: MonsterClassification | undefined,
  b: MonsterClassification,
): MonsterClassification {
  if (!a) return b;
  return CLASSIFICATION_ORDER.indexOf(a) >= CLASSIFICATION_ORDER.indexOf(b) ? a : b;
}

/**
 * The party size the campaign is AUTHORED against. An encounter's authored HP is its 4-player
 * total; every other size scales from there.
 */
export const BASELINE_PARTY_SIZE = 4;

/** Sizes offered in the library UI. The model itself accepts any positive integer. */
export const SUPPORTED_PARTY_SIZES = [3, 4, 5, 6] as const;

/**
 * Kept as a lookup for UI that wants to show the multiplier for a handful of sizes.
 * The authority is `partySizeHpMultiplier` — max(0.25, 1 + 0.25 × (n − 4)) — which this
 * table is generated from rather than duplicating.
 */
export const PARTY_SIZE_HP_MULTIPLIER: Record<number, number> = Object.fromEntries(
  SUPPORTED_PARTY_SIZES.map(size => [size, partySizeHpMultiplier(size)]),
);

/**
 * An encounter's authored 4P HP scaled to the party actually fighting it.
 *
 * ⚠ FOR DISPLAY ONLY. The checker applies `partySizeHpMultiplier` INSIDE `effectiveHpPerBody`,
 * so a roster passed to `simulateEncounter` must carry RAW authored HP — scaling it here as
 * well would apply the multiplier twice.
 *
 * ROUNDS, not floors: rounding reproduces the workbook's own published bands exactly
 * (129/172/215, 166/221/276, 180/240/300), where flooring read one HP light.
 */
export function hpForPartySize(baseHp: number, partySize: number): number {
  const mult = partySizeHpMultiplier(partySize);
  if (mult === 1) return baseHp;
  return Math.max(1, Math.round(baseHp * mult));
}
