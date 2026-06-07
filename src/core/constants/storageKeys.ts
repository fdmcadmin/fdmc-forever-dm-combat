/**
 * FDMC localStorage keys.
 *
 * Centralized so the same store is never spelled two different ways across files
 * (which would split one logical store into two and lose data silently).
 *
 * Authority note: these are DM-local / browser-local stores. They are never the
 * source of room truth — room metadata holds only compact live state (see P0).
 */
export const FDMC_STORAGE_KEYS = {
  /** Queue of encounter monster instances handed from the monster popover to the main DM window. */
  encounterLoadQueue: "fdmc.dm.encounterLoadQueue.v1",
  /** Pending player level-up requests awaiting DM approval (DM-side inbox). */
  pendingLevelUpRequests: "fdmc:pending-level-up-requests",
} as const;
