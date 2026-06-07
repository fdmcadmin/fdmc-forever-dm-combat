/**
 * Token right-click context menu (GM-only).
 *
 * Lets the DM right-click a token on the map and:
 *   - GM Lock / Unlock it instantly (quick-lock monster tokens at any time)
 *   - Assign it to a seat (writes the token binding + seat color marker), without
 *     opening the full seat-management panel.
 *
 * Authority note: this only writes a TOKEN binding + lock state. It never changes
 * who owns the character — DM-owned character truth stays in DM-local storage (P0).
 * Token assignment is not actor ownership.
 */

import OBR from "@owlbear-rodeo/sdk";
import { writeTokenBinding, lockToken, unlockToken, clearTokenBinding, type FdmcTokenBinding } from "./tokenBinding";
import { getSeatColor } from "../seats/seatColors";
import type { FdmcSeat } from "../seats/seatTypes";

const GM_LOCK_ID = "fdmc.tokenmenu.gmlock.v1";
const CLEAR_ID = "fdmc.tokenmenu.clear.v1";
const ASSIGN_PREFIX = "fdmc.tokenmenu.assign.";

// Track which per-seat assign menus we created so we can remove stale ones.
let registeredAssignIds: string[] = [];

function svgDataUri(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function seatIcon(color: string): string {
  return svgDataUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" fill="${color}" stroke="white" stroke-width="1.5"/></svg>`);
}

const LOCK_ICON = svgDataUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>');
const UNLOCK_ICON = svgDataUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-1.5"/></svg>');
const CLEAR_ICON = svgDataUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>');

type ContextMenuApiShape = {
  create: (menu: unknown) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

function contextMenuApi(): ContextMenuApiShape | null {
  const api = (OBR as unknown as { contextMenu?: ContextMenuApiShape }).contextMenu;
  return api ?? null;
}

/**
 * (Re)build the DM token context menus for the current seats. Idempotent — removes
 * any stale per-seat entries first, then recreates the live set.
 */
export async function syncTokenContextMenus(tableId: string, seats: Record<string, FdmcSeat>): Promise<void> {
  const api = contextMenuApi();
  if (!api) return;

  // Remove previously-registered per-seat entries before rebuilding.
  await Promise.all(registeredAssignIds.map(id => api.remove(id).catch(() => undefined)));
  registeredAssignIds = [];

  // GM Lock / Unlock toggle — label flips based on the token's current lock state.
  await api.create({
    id: GM_LOCK_ID,
    icons: [
      { icon: LOCK_ICON, label: "GM Lock token", filter: { roles: ["GM"], every: [{ key: "locked", value: false }] } },
      { icon: UNLOCK_ICON, label: "GM Unlock token", filter: { roles: ["GM"], every: [{ key: "locked", value: true }] } },
    ],
    onClick: (ctx: { items: { id: string; locked?: boolean }[] }) => {
      // If any selected token is unlocked, lock all; otherwise unlock all.
      const lockAll = ctx.items.some(i => !i.locked);
      for (const item of ctx.items) {
        if (lockAll) void lockToken(item.id);
        else void unlockToken(item.id);
      }
    },
  }).catch(() => undefined);

  // Clear assignment.
  await api.create({
    id: CLEAR_ID,
    icons: [{ icon: CLEAR_ICON, label: "Clear FDMC assignment", filter: { roles: ["GM"] } }],
    onClick: (ctx: { items: { id: string }[] }) => {
      for (const item of ctx.items) void clearTokenBinding(item.id);
    },
  }).catch(() => undefined);

  // One "Assign to <seat>" entry per active player seat.
  const seatList = Object.values(seats)
    .filter(s => s.seatMode !== "viewer")
    .sort((a, b) => a.seatId.localeCompare(b.seatId, undefined, { numeric: true }));

  for (const seat of seatList) {
    const id = `${ASSIGN_PREFIX}${seat.seatId}`;
    const color = getSeatColor(seat.seatId);
    await api.create({
      id,
      icons: [{ icon: seatIcon(color), label: `Assign to ${seat.label}`, filter: { roles: ["GM"] } }],
      onClick: (ctx: { items: { id: string }[] }) => {
        const binding: FdmcTokenBinding = {
          version: 1,
          tableId,
          bindingType: "seat",
          seatId: seat.seatId,
          actorId: seat.primaryActorId || seat.actorIds[0] || "",
          actorType: "player",
          boundBy: "gm",
          boundAt: Date.now(),
          allowPlayerMove: false, // DM-only by default; DM can grant movement in the token panel
        };
        for (const item of ctx.items) {
          void writeTokenBinding(item.id, binding).then(() => lockToken(item.id)).catch(() => undefined);
        }
      },
    }).catch(() => undefined);
    registeredAssignIds.push(id);
  }
}

/** Remove all FDMC token context menus (effect cleanup). */
export async function teardownTokenContextMenus(): Promise<void> {
  const api = contextMenuApi();
  if (!api) return;
  await Promise.all([
    api.remove(GM_LOCK_ID).catch(() => undefined),
    api.remove(CLEAR_ID).catch(() => undefined),
    ...registeredAssignIds.map(id => api.remove(id).catch(() => undefined)),
  ]);
  registeredAssignIds = [];
}
