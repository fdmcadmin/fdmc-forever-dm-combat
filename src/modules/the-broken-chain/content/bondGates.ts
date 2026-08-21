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
  /**
   * Act 3, Fight 10 — The Center. Both bodies down: Thought Harrower and Grief Colossus.
   *
   * ⚠ NOT the Veil-Torn Dragon. That is FIGHT 9, "Gate III", and it gates the party to LEVEL 9;
   * Fight 10 "The Center" is the Act Boss they then fight AT level 9. An earlier version of this
   * file named a fight called `act3-f10-veil-torn-dragon`, which conflated the two and matched no
   * encounter in the library at all — so the milestone could never have fired.
   * Source: `Broken_Chain_Act3_Encounters_Current_Rosters_Only_v3_15.docx` (RULE 1).
   */
  act3BossDefeated: "tbc:act3-e10-the-center-defeated",
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
    label: "Act 3 · Fight 10 — The Center (defeat the Thought Harrower and Grief Colossus)",
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
  /**
   * The id the campaign library actually uses — `encounterId` on the Thought Harrower and the
   * Grief Colossus in `monsterLibrary.ts`, labelled "Act 3 E10 - The Center".
   *
   * ⚠ Only ids that EXIST go in here. An earlier version listed `act3-f10-veil-torn-dragon` and
   * `act3-boss`; neither appears anywhere in the library, so both were dead entries that made the
   * table look more thorough than it was while the milestone could never fire.
   */
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
