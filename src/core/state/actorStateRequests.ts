/**
 * Player → GM state requests (auto-approved tier).
 *
 * THE RULE (Christopher): the GM is the single writer to room metadata. Player cards are
 * LENT to a seat; a seat never writes shared state itself. That is what stops two players
 * writing at once, and it is why the approval button exists.
 *
 * Two tiers:
 *   AUTO-APPROVED — combat-related, applied by the GM the instant it arrives with no
 *     click: HP / temp HP, initiative, status trackers, conditions, resource spends,
 *     equipping gear the character already has. These must not interrupt play.
 *   NEEDS APPROVAL — changes that fundamentally alter a card: creating equipment, level
 *     up. Those queue in the DM Approvals panel (see the existing level-up request flow).
 *
 * This module carries the AUTO tier. It exists because player windows were writing room
 * metadata DIRECTLY (`useActorLiveState` has no GM gate, and the actor popout mounts it),
 * so a player's HP write could land a revision ahead of the GM's copy — which is how the
 * GM ended up publishing a stale revision and the table froze mid-combat.
 *
 * Turn advance already worked this way (`fdmc:request-next-turn`); this applies the same
 * pattern to the rest of the combat state.
 */

import type { HitPoints } from "../types/actor";

/** Auto-approved, combat-related change a seat may ask the GM to apply. */
export type ActorStateRequest =
  | { type: "fdmc:request-actor-hp"; actorId: string; hp: HitPoints }
  | { type: "fdmc:request-actor-initiative"; actorId: string; initiative: number | null }
  | { type: "fdmc:request-actor-tracker"; actorId: string; trackerId: string; current: number }
  /**
   * A REST is a passive change, but it rewrites the whole card: resource pools refill for
   * the rest actually taken (short vs long), recharge abilities come back, and a long rest
   * restores HP. It therefore has to run on the GM's master copy like anything else —
   * previously a player's popout reset its OWN counters and wrote HP directly, so the
   * master card and the seat could disagree about what had been spent.
   */
  | { type: "fdmc:request-actor-rest"; actorId: string; restType: "short" | "long" }
  /**
   * Move coin between the PARTY purse and this character, in copper. Positive takes from the
   * purse, negative contributes to it.
   *
   * Auto-approved, because the party purse is the party's — asking the DM for permission to
   * spend the group's own money is the ceremony this is meant to remove. What it is NOT is a
   * free write: the GM still applies it against the balance at the moment of applying, so two
   * seats reaching for the same last 50 gp resolve in order and the second one is refused.
   *
   * `actorId` is who reached in. That is the audit trail — a shared pot that changes without
   * a name attached is the thing that starts arguments at the table.
   */
  | { type: "fdmc:request-party-transfer"; actorId: string; copper: number }
  /**
   * EQUIP / UNEQUIP, and the grip a versatile weapon is held in.
   *
   * A seat is LENT a card and is expected to run it. Managing what that character is wearing
   * is not a change to the base model — it takes no action, spends nothing, and reverses in a
   * click — so it belongs in the auto tier beside HP and trackers, not behind an approval.
   * Levelling up and adding spells rewrite what the character IS; those still queue.
   *
   * This lived on its own message with its own listener, which meant a seat's gear change
   * depended on a code path nobody else used. Putting it here makes it work exactly the way
   * HP already does: the GM applies it the instant it arrives, with no card open and nothing
   * to click.
   */
  | { type: "fdmc:request-actor-equip"; actorId: string; actionId: string }
  | { type: "fdmc:request-actor-grip"; actorId: string; actionId: string; grip: "1h" | "2h" };

const AUTO_APPROVED_TYPES = new Set<ActorStateRequest["type"]>([
  "fdmc:request-actor-hp",
  "fdmc:request-actor-initiative",
  "fdmc:request-actor-tracker",
  "fdmc:request-actor-rest",
  "fdmc:request-party-transfer",
  "fdmc:request-actor-equip",
  "fdmc:request-actor-grip",
]);

/** True for a well-formed auto-approved request from a seat. */
export function isActorStateRequest(value: unknown): value is ActorStateRequest {
  if (!value || typeof value !== "object") return false;
  const msg = value as { type?: unknown; actorId?: unknown };
  return typeof msg.type === "string"
    && AUTO_APPROVED_TYPES.has(msg.type as ActorStateRequest["type"])
    && typeof msg.actorId === "string"
    && msg.actorId.length > 0;
}
