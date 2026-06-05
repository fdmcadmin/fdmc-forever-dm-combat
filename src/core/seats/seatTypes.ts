import type { Actor } from "../types/actor";
import type { FdmcRecentEventSlot } from "../table-state/fdmcRoomLiveState";

// ─── Seat definitions (stored in room metadata) ───────────────────────────────

export type FdmcSeat = {
  seatId: string;         // "seat-1", "seat-2", etc.
  label: string;          // "Player 1"
  seatMode: "player" | "viewer";
  actorIds: string[];     // ["vaelith", "faelar"]
  primaryActorId: string;
};

export type FdmcSeatBinding = {
  seatId: string;
  viewerSeatKey: string;  // hashed viewer identity — never raw email/name/id
  boundAt: string;
};

// ─── Broadcast message types ──────────────────────────────────────────────────

export type SeatClaimBroadcast = {
  type: "fdmc:seat-claim";
  seatId: string;
  viewerSeatKey: string;
};

export type ActorDataBroadcast = {
  type: "fdmc:actor-data";
  seatId: string;
  actors: Actor[];
  recentEventWindow: FdmcRecentEventSlot[];
};

export type ActorDataRequestBroadcast = {
  type: "fdmc:actor-data-request";
  seatId: string;
  viewerSeatKey: string;
};

export type SeatAssignBroadcast = {
  type: "fdmc:seat-assign";
  seatId: string;
  viewerSeatKey: string;
  label: string;
  seatMode: "player" | "viewer";
  actorIds: string[];
  primaryActorId: string;
};

export type SeatBroadcastMessage =
  | SeatClaimBroadcast
  | ActorDataBroadcast
  | ActorDataRequestBroadcast
  | SeatAssignBroadcast;

// ─── Broadcast channel ────────────────────────────────────────────────────────

export const FDMC_SEAT_BROADCAST_CHANNEL = "forever-dm-combat:seats:v1";

// ─── Type guards ──────────────────────────────────────────────────────────────

export function isSeatClaimBroadcast(msg: unknown): msg is SeatClaimBroadcast {
  return Boolean(msg && typeof msg === "object" && (msg as { type?: unknown }).type === "fdmc:seat-claim");
}

export function isActorDataBroadcast(msg: unknown): msg is ActorDataBroadcast {
  return Boolean(msg && typeof msg === "object" && (msg as { type?: unknown }).type === "fdmc:actor-data");
}

export function isActorDataRequestBroadcast(msg: unknown): msg is ActorDataRequestBroadcast {
  return Boolean(msg && typeof msg === "object" && (msg as { type?: unknown }).type === "fdmc:actor-data-request");
}

export function isSeatAssignBroadcast(msg: unknown): msg is SeatAssignBroadcast {
  return Boolean(msg && typeof msg === "object" && (msg as { type?: unknown }).type === "fdmc:seat-assign");
}

// ─── Viewer seat key hashing ──────────────────────────────────────────────────

/**
 * Derives a stable, non-identifying hash from an OBR viewer ID.
 * We never store the raw ID. The hash is consistent per viewer per session.
 */
export function hashViewerId(rawId: string): string {
  // Simple deterministic hash — not crypto, just obfuscation of raw identity
  let hash = 0;
  for (let i = 0; i < rawId.length; i++) {
    const char = rawId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `vk-${Math.abs(hash).toString(36)}`;
}
