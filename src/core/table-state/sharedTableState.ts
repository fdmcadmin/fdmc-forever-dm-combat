/**
 * sharedTableState.ts
 * P1: Reduced to table binding only. All actor live state moved to fdmcRoomLiveState.ts.
 * The old FdmcSharedActor / FdmcSharedTableState / actorPanelData / quickActions are removed.
 */

// ─── Constants ────────────────────────────────────────────────────────────────

export const FDMC_TABLE_BINDING_KEY = "fdmc.main.tableBinding.v1";

/** Legacy key — kept for room metadata migration reads only. Do not write to this. */
export const FDMC_SHARED_TABLE_STATE_KEY = "fdmc.main.sharedTableState.v1";

/** Current live state key — all reads/writes use this. */
export const FDMC_ROOM_LIVE_STATE_KEY = "fdmc.main.roomLiveState.v1";

// ─── Table binding ────────────────────────────────────────────────────────────

export type FdmcTableBinding = {
  version: 1;
  tableId: string;
  gmControllerId: string | null;
  gmDisplayLabel: "GM";
  claimedAt: number;
  updatedAt: number;
};

export function normalizeTableBinding(value: unknown): FdmcTableBinding | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Partial<FdmcTableBinding>;
  const tableId = typeof candidate.tableId === "string" && candidate.tableId
    ? candidate.tableId
    : "fdmc-room-table";
  const gmControllerId = typeof candidate.gmControllerId === "string"
    ? candidate.gmControllerId
    : null;
  return {
    version: 1,
    tableId,
    gmControllerId,
    gmDisplayLabel: "GM",
    claimedAt: typeof candidate.claimedAt === "number" ? candidate.claimedAt : Date.now(),
    updatedAt: typeof candidate.updatedAt === "number" ? candidate.updatedAt : Date.now(),
  };
}

export function createTableBinding(gmControllerId: string | null): FdmcTableBinding {
  const now = Date.now();
  return {
    version: 1,
    tableId: `fdmc-table-${now}`,
    gmControllerId,
    gmDisplayLabel: "GM",
    claimedAt: now,
    updatedAt: now,
  };
}
