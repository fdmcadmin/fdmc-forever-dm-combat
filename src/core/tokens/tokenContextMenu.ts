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
import { getSeatColorIndex } from "../seats/seatColors";
import type { FdmcSeat } from "../seats/seatTypes";

const GM_LOCK_ID = "fdmc.tokenmenu.gmlock.v1";
const CLEAR_ID = "fdmc.tokenmenu.clear.v1";
const ASSIGN_PREFIX = "fdmc.tokenmenu.assign.";

// Track which per-seat assign menus we created so we can remove stale ones.
let registeredAssignIds: string[] = [];

// OBR context-menu icons MUST be real URL paths (relative or absolute). The SDK
// normalizes any non-http icon URL by prefixing `window.location.origin`, which mangles
// a `data:image/svg+xml;base64,…` data URI into something like
// `https://app.origin/data:image/svg+xml;base64,…` — a broken request, so the icon
// (and effectively the whole entry) never renders. These static SVGs ship from
// `public/fdmc-icons/` → served at `/fdmc-icons/*.svg`, which the SDK normalizes
// cleanly to `https://app.origin/fdmc-icons/*.svg`.
const ICON_BASE = "/fdmc-icons";
const LOCK_ICON = `${ICON_BASE}/gm-lock.svg`;
const UNLOCK_ICON = `${ICON_BASE}/gm-unlock.svg`;
const CLEAR_ICON = `${ICON_BASE}/clear-assignment.svg`;

/** Static seat marker icon path whose baked color matches the seat's palette color. */
function seatIcon(seatId: string): string {
  const idx = getSeatColorIndex(seatId);
  if (idx < 0) return `${ICON_BASE}/seat-default.svg`;
  return `${ICON_BASE}/seat-${idx + 1}.svg`;
}

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
/**
 * Status flag in localStorage so the DM popover (a separate same-origin context from this
 * persistent background page) can warn when the token context menu isn't usable.
 */
export const TOKEN_MENU_STATUS_KEY = "fdmc.tokenMenu.status.v1";
/** Last registration error message, surfaced in the DM token assignment panel. */
export const TOKEN_MENU_ERROR_KEY = "fdmc.tokenMenu.error.v1";
function setMenuStatus(status: "ready" | "unavailable", error?: string): void {
  try {
    window.localStorage.setItem(TOKEN_MENU_STATUS_KEY, status);
    if (status === "ready" || !error) window.localStorage.removeItem(TOKEN_MENU_ERROR_KEY);
    else window.localStorage.setItem(TOKEN_MENU_ERROR_KEY, error);
  } catch { /* localStorage unavailable */ }
}

export async function syncTokenContextMenus(tableId: string, seats: Record<string, FdmcSeat>): Promise<void> {
  const api = contextMenuApi();
  if (!api) {
    const msg = "OBR.contextMenu API unavailable — menu not registered.";
    console.warn(`[FDMC] token context menu: ${msg}`);
    setMenuStatus("unavailable", msg);
    return;
  }

  // Collect per-entry failures instead of swallowing them — a silent failure here is why the
  // menu can appear to be "missing". We only flip status to "ready" once every create resolves;
  // any failure stores the first error so the DM token assignment panel can surface it.
  const errors: string[] = [];
  const tryCreate = async (what: string, menu: unknown): Promise<void> => {
    try {
      await api.create(menu);
    } catch (e) {
      console.warn(`[FDMC] token context menu: failed to register "${what}":`, e);
      errors.push(`${what}: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  // Remove previously-registered per-seat entries before rebuilding.
  await Promise.all(registeredAssignIds.map(id => api.remove(id).catch(() => undefined)));
  registeredAssignIds = [];

  // GM Lock / Unlock toggle — label flips based on the token's current lock state.
  // NOTE: a token's `locked` is often `undefined` (not literally `false`), and OBR's
  // default `==` comparison means `value: false` would NOT match an unlocked token —
  // hiding the whole entry. Use `locked != true` so the Lock icon shows whenever the
  // token is not explicitly locked.
  await tryCreate("GM Lock", {
    id: GM_LOCK_ID,
    icons: [
      { icon: LOCK_ICON, label: "GM Lock token", filter: { roles: ["GM"], every: [{ key: "locked", value: true, operator: "!=" }] } },
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
  });

  // Clear assignment.
  await tryCreate("Clear assignment", {
    id: CLEAR_ID,
    icons: [{ icon: CLEAR_ICON, label: "Clear FDMC assignment", filter: { roles: ["GM"] } }],
    onClick: (ctx: { items: { id: string }[] }) => {
      for (const item of ctx.items) void clearTokenBinding(item.id);
    },
  });

  // One "Assign to <seat>" entry per active player seat.
  const seatList = Object.values(seats)
    .filter(s => s.seatMode !== "viewer")
    .sort((a, b) => a.seatId.localeCompare(b.seatId, undefined, { numeric: true }));

  for (const seat of seatList) {
    const id = `${ASSIGN_PREFIX}${seat.seatId}`;
    await tryCreate(`Assign to ${seat.label}`, {
      id,
      icons: [{ icon: seatIcon(seat.seatId), label: `Assign to ${seat.label}`, filter: { roles: ["GM"] } }],
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
    });
    registeredAssignIds.push(id);
  }

  // Only now — after every registration attempt resolved — decide health. "ready" requires a
  // clean run; any failure keeps the menu flagged unavailable and records the error for the panel.
  if (errors.length > 0) setMenuStatus("unavailable", errors.join(" | "));
  else setMenuStatus("ready");
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
