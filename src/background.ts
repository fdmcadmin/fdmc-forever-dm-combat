/**
 * FDMC background page — persistent token context-menu registration.
 *
 * WHY THIS EXISTS:
 * The main app (`App.tsx`) is the OBR *action popover* (`manifest.action.popover = "/"`).
 * It only runs while that popover is open, so registering the token right-click menu there
 * means the menu (and its click handlers) vanish the moment the DM closes the popover —
 * which is exactly when they're working from the map. OBR loads this background page
 * invisibly whenever the extension is active in a room (`manifest.background`), so it can
 * own the context menu for the whole session, independent of any popover.
 *
 * Authority note: this only registers GM-filtered menu entries and writes TOKEN bindings /
 * lock state. It never changes character ownership (DM-owned truth stays in DM-local
 * storage). Token assignment is not actor ownership.
 */

import OBR from "@owlbear-rodeo/sdk";
import { syncTokenContextMenus } from "./core/tokens/tokenContextMenu";
import { FDMC_ROOM_LIVE_STATE_KEY } from "./core/table-state/sharedTableState";
import { normalizeFdmcRoomLiveState, type FdmcRoomLiveState } from "./core/table-state/fdmcRoomLiveState";
import { readFdmcRoomStateKey, subscribeFdmcRoomStateKey } from "./core/table-state/roomStateBridge";

// Only re-register when the seat set (or table) actually changes — room state bumps its
// revision constantly (HP, initiative, combat), and re-syncing the menu on every bump
// would thrash OBR's context-menu host.
let lastSig = "";

function seatSignature(state: FdmcRoomLiveState): string {
  return state.tableId + "|" + Object.values(state.seats)
    .map(s => `${s.seatId}:${s.label}:${s.seatMode}:${s.primaryActorId}`)
    .join("|");
}

function applyState(state: FdmcRoomLiveState): void {
  const sig = seatSignature(state);
  if (sig === lastSig) return;
  lastSig = sig;
  void syncTokenContextMenus(state.tableId, state.seats);
}

OBR.onReady(() => {
  console.info("[FDMC] background ready — registering token context menus.");

  // Register GM Lock + Clear immediately so they're available even before a table is
  // claimed / seats exist. Per-seat "Assign to <seat>" entries fill in from room state.
  void syncTokenContextMenus("", {});

  // Initial pull of current room state (adds the per-seat entries if a table is live).
  void readFdmcRoomStateKey(FDMC_ROOM_LIVE_STATE_KEY, normalizeFdmcRoomLiveState)
    .then(state => { if (state) applyState(state); })
    .catch(() => undefined);

  // Keep the per-seat entries in sync as seats are added / renamed / re-assigned.
  subscribeFdmcRoomStateKey(FDMC_ROOM_LIVE_STATE_KEY, normalizeFdmcRoomLiveState, applyState);
});
