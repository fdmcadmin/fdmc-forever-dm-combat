/**
 * Seat color identity system (P-UX1)
 *
 * Each player seat carries a distinct color. That color is the single source of
 * visual identity across the whole table:
 *   - Party Character card border / header
 *   - DM panel character slot
 *   - assigned token marker
 *   - combat tracker row rail
 *   - seat assignment UI
 *
 * Monsters/GM-controlled creatures use a deliberately separate color family so a
 * DM can glance at the table and never confuse a monster with a player seat.
 *
 * This module is pure (no React, no SDK) so it can be imported anywhere.
 */

// ─── Player seat palette ──────────────────────────────────────────────────────
// Eight high-contrast hues, chosen to stay distinct from each other, from the
// app's purple chrome, and from the monster/GM red family below.
export const SEAT_COLOR_PALETTE = [
  "#4f9dff", // 1 · blue
  "#34c759", // 2 · green
  "#ffb02e", // 3 · amber
  "#ff6b9d", // 4 · pink
  "#2dd4bf", // 5 · teal
  "#a78bfa", // 6 · lavender
  "#f97316", // 7 · orange
  "#c0e030", // 8 · lime
] as const;

/** Neutral color for unassigned / unseated characters. */
export const NEUTRAL_SEAT_COLOR = "#5a5a6e";

// ─── Monster / GM color family ────────────────────────────────────────────────
// A rust-red identity that is intentionally outside the seat palette.
export const MONSTER_COLOR = "#c8472e";
export const MONSTER_COLOR_SOFT = "#3a1c16";

/** Index → seat color (wraps if more seats than palette entries). */
export function getSeatColorByIndex(index: number): string {
  if (index < 0) return NEUTRAL_SEAT_COLOR;
  return SEAT_COLOR_PALETTE[index % SEAT_COLOR_PALETTE.length];
}

/**
 * Stable palette index (0-based, already wrapped into the palette length) for a
 * seat id such as "seat-1". Returns -1 for a missing id (→ neutral color).
 *
 * Single source of truth for both {@link getSeatColor} and the static seat icon
 * file lookup (`/fdmc-icons/seat-<n>.svg`) so the menu marker color always matches
 * the seat color shown everywhere else.
 */
export function getSeatColorIndex(seatId: string | null | undefined): number {
  if (!seatId) return -1;
  const numMatch = seatId.match(/(\d+)/);
  if (numMatch) {
    const n = Number.parseInt(numMatch[1], 10);
    if (Number.isFinite(n) && n >= 1) return (n - 1) % SEAT_COLOR_PALETTE.length;
  }
  // Non-numeric id — deterministic hash into the palette
  let hash = 0;
  for (let i = 0; i < seatId.length; i++) hash = (hash * 31 + seatId.charCodeAt(i)) | 0;
  return Math.abs(hash) % SEAT_COLOR_PALETTE.length;
}

/**
 * Stable seat color from a seat id such as "seat-1".
 * Falls back to a deterministic hash for non-numeric ids.
 */
export function getSeatColor(seatId: string | null | undefined): string {
  return getSeatColorByIndex(getSeatColorIndex(seatId));
}

/**
 * Convert a #rrggbb hex into an rgba() string with the given alpha.
 * Used for soft fills/borders that tint toward the seat color without
 * overwhelming the dark UI.
 */
export function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return hex;
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Minimal seat shape this module needs — kept structural so callers can pass
// either FdmcSeat records or the room-metadata seat snapshots.
type SeatLike = {
  seatId: string;
  seatMode?: "player" | "viewer" | "co-dm";
  actorIds?: string[];
  primaryActorId?: string;
};

/**
 * Build a map of actorId → seat color from a seat record.
 * Every character lent to a seat (primary or borrowed) inherits that seat's
 * color. Viewer seats are skipped (they don't own characters).
 */
export function buildActorSeatColorMap(
  seats: Record<string, SeatLike> | SeatLike[] | undefined | null,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!seats) return out;
  const list = Array.isArray(seats) ? seats : Object.values(seats);
  for (const seat of list) {
    if (!seat || seat.seatMode === "viewer") continue;
    const color = getSeatColor(seat.seatId);
    for (const actorId of seat.actorIds ?? []) {
      if (actorId) out[actorId] = color;
    }
  }
  return out;
}

/** Returns the seatId a given actor is assigned to, or null. */
export function findSeatForActor(
  actorId: string,
  seats: Record<string, SeatLike> | SeatLike[] | undefined | null,
): string | null {
  if (!seats) return null;
  const list = Array.isArray(seats) ? seats : Object.values(seats);
  for (const seat of list) {
    if (seat?.seatMode === "viewer") continue;
    if ((seat?.actorIds ?? []).includes(actorId)) return seat.seatId;
  }
  return null;
}
