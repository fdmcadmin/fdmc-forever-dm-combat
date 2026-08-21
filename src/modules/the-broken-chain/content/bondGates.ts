/**
 * BOND STAGE GATES — Broken Chain mod content.
 *
 * A bond stage needs its LEVEL and, where this campaign says so, a story beat as well.
 * Christopher: *"the party needs to have killed the act 3 boss for the bond upgrade — can we flag
 * if encounter end = A3 F10 bond changes to tempered."*
 *
 * LAYER: which stage is gated on which fight is campaign content (RULE 3). The mechanism —
 * `BondStageGate`, and a blocked stage blocking everything above it — is engine, in
 * `core/types/bond.ts`. Another campaign ships different gates, or none.
 */

import type { BondStageGate } from "../../../core/types/bond";

/** Milestone ids this campaign raises. Opaque to the engine. */
export const TBC_MILESTONE = {
  /** Act 3, Fight 10 — the Veil-Torn Dragon is dead. */
  act3BossDefeated: "tbc:act3-f10-boss-defeated",
} as const;

/**
 * Level alone does not grant Tempered. The party reaches level 9 and still holds at
 * Metamorphosis until the Act 3 boss falls.
 *
 * Only ONE stage is gated. Realized (3) and Metamorphosis (6) come with the level; Unbroken (13)
 * needs no gate of its own because it sits above Tempered and a blocked stage blocks everything
 * above it — a level-13 party that never beat Act 3 is held at Metamorphosis, which is the
 * correct answer rather than a special case.
 */
export const BROKEN_CHAIN_BOND_GATES: readonly BondStageGate[] = [
  {
    stage: 3, // Tempered
    milestoneId: TBC_MILESTONE.act3BossDefeated,
    label: "Act 3 · Fight 10 — defeat the Veil-Torn Dragon",
  },
];

/**
 * Encounters whose completion raises a milestone.
 *
 * Keyed by encounter id. Matching is exact: an encounter renamed in the library stops raising its
 * milestone, which is a visible failure (the bond does not advance and says why) rather than a
 * silent one.
 */
const MILESTONE_BY_ENCOUNTER: Record<string, string> = {
  "act3-f10-veil-torn-dragon": TBC_MILESTONE.act3BossDefeated,
  // Aliases seen in authored encounter data for the same fight.
  "act3-boss": TBC_MILESTONE.act3BossDefeated,
  "act3-e10-the-center": TBC_MILESTONE.act3BossDefeated,
};

/**
 * The milestone an encounter raises when it ENDS in a party win, or undefined.
 *
 * Call this where an encounter is resolved; the returned id goes into the party's earned set and
 * `resolveBondStage` does the rest. Nothing here decides whether the party won — that is the
 * caller's question, and a wipe must not advance anybody's bond.
 */
export function bondMilestoneForEncounter(encounterId: string): string | undefined {
  return MILESTONE_BY_ENCOUNTER[encounterId.trim().toLowerCase()];
}
