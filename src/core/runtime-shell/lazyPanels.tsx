/**
 * THE GM'S PANELS, LOADED WHEN THEY OPEN — NOT ON EVERY PLAYER'S WAY TO A SEAT.
 *
 * `App` is both the GM's window and every player's. It imported the encounter library (with the v7 checker
 * runtime, the monster template editor and the equipment catalogue behind it), the actor editor, the seat
 * assignment panel and the room tools statically, so a player downloaded and parsed all of it before the
 * app could mount and claim a seat. Measured at 0.8.62.1: 2.8MB of static script on the main window, of which
 * the monster library alone was 1.1MB. See `check:playerbundle`.
 *
 * Every panel here is rendered only inside the GM's tool layer, which already refuses a player
 * (`ToolPanelLayer isAllowed={isDmMode}`), so a player never triggers these downloads at all.
 */
import { lazy, type ComponentProps } from "react";
import type { EncounterLibraryPanel as EncounterLibraryPanelComponent } from "../monsters/EncounterLibraryPanel";

type EncounterLibraryPanelProps = Omit<ComponentProps<typeof EncounterLibraryPanelComponent>, "monsterLibrary">;

/** The panel and the shipped monster library travel together; the library is the panel's only reader here. */
export const LazyEncounterLibraryPanel = lazy(async () => {
  const [panel, library] = await Promise.all([
    import("../monsters/EncounterLibraryPanel"),
    import("../../data/broken-chain/monsterLibrary"),
  ]);
  function EncounterLibraryPanelWithLibrary(props: EncounterLibraryPanelProps) {
    return <panel.EncounterLibraryPanel {...props} monsterLibrary={library.BROKEN_CHAIN_MONSTER_LIBRARY} />;
  }
  return { default: EncounterLibraryPanelWithLibrary };
});

export const LazyActorEditor = lazy(() => import("../ui/ActorEditor").then(m => ({ default: m.ActorEditor })));
export const LazySeatAssignmentPanel = lazy(() => import("../seats/SeatAssignmentPanel").then(m => ({ default: m.SeatAssignmentPanel })));
export const LazyFdmcRoomMaintenancePanel = lazy(() => import("../campaign/FdmcRoomMaintenancePanel").then(m => ({ default: m.FdmcRoomMaintenancePanel })));
export const LazyEncounterCleanupPanel = lazy(() => import("../campaign/EncounterCleanupPanel").then(m => ({ default: m.EncounterCleanupPanel })));

/** What a panel shows for the moment its code is on the way. */
export function PanelLoading() {
  return <p style={{ padding: "16px 14px", margin: 0, fontSize: 12, color: "#666" }}>Loading…</p>;
}
