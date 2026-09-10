/**
 * ONE MERGE FOR A CREATURE'S HP PATCH — the thing three call sites were each writing by hand.
 *
 * Christopher, 2026-09-10: *"when i click -25% -10% and +10% and +25% for the health of a creature
 * it removes the hp like it would be moving it down but then resnaps the max hp to the set
 * number."*
 *
 * ─── ⚠ WHAT WENT WRONG, AND WHY IT COULD ────────────────────────────────────────────────────
 *
 * The Pace dial rescales a creature by moving CURRENT AND MAX TOGETHER, so the bar sits at the
 * same fraction the instant it is applied — *"nothing moves and nothing rewinds. Only the PACE
 * changes."* It emitted `{ currentHp, maxHp }` correctly.
 *
 * Then three separate handlers each merged that patch onto the instance by hand, and all three
 * wrote the same line:
 *
 *     max: m.maxHp        // ← the instance's, not the patch's
 *
 * So `currentHp` landed and `maxHp` was dropped. The card's sync effect then reset its local max
 * from the prop, snapping the bar back — and the creature was left genuinely damaged instead of
 * rescaled, which is the exact opposite of what the control promises. A -25% click did 25% of the
 * creature's HP in real damage.
 *
 * ⚠ THE FIX IS NOT THREE FIXED COPIES. Three hand-written merges of one shape is the defect;
 * correcting each one leaves the fourth caller free to reintroduce it. This is the merge.
 */

import type { MainEncounterMonsterInstance } from "../monsters/runtime/mainMonsterRuntime";

/** What a card may change about a creature's hit points. */
export type MonsterHpPatch = Partial<Pick<
  MainEncounterMonsterInstance,
  "currentHp" | "maxHp" | "tempHp"
>>;

/** The three numbers every persistence path takes. */
export type MonsterHp = { current: number; max: number; temp: number };

/**
 * Fold a patch onto a creature's current hit points.
 *
 * ⚠ EVERY FIELD FALLS BACK TO THE INSTANCE, AND EVERY FIELD IS READ. A patch that carries a value
 * wins; one that omits it leaves that number alone. The bug this replaces is what happens when a
 * field is neither read nor defaulted, but hardcoded to the instance's.
 */
export function monsterHpFromPatch(
  instance: Pick<MainEncounterMonsterInstance, "currentHp" | "maxHp" | "tempHp">,
  patch: MonsterHpPatch,
): MonsterHp {
  const max = typeof patch.maxHp === "number" ? patch.maxHp : instance.maxHp;
  const current = typeof patch.currentHp === "number" ? patch.currentHp : instance.currentHp;
  return {
    max,
    /**
     * ⚠ CURRENT IS CLAMPED TO THE RESULTING MAX, not to the old one. Scaling down by 25% lowers
     * both together, so the clamp is normally a no-op — but a patch that lowers max ALONE (a DM
     * editing the ceiling) must not leave a creature sitting above its own bar.
     */
    current: Math.max(0, Math.min(max, current)),
    temp: typeof patch.tempHp === "number" ? patch.tempHp : (instance.tempHp ?? 0),
  };
}
