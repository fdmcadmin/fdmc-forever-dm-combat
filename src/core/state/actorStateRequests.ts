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
  | { type: "fdmc:request-actor-tracker"; actorId: string; trackerId: string; current: number };

const AUTO_APPROVED_TYPES = new Set<ActorStateRequest["type"]>([
  "fdmc:request-actor-hp",
  "fdmc:request-actor-initiative",
  "fdmc:request-actor-tracker",
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
