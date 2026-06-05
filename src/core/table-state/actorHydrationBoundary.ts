import type { Actor } from "../types/actor";
import type { FdmcActorLiveState, FdmcRoomLiveState } from "./fdmcRoomLiveState";

/**
 * Three-layer actor resolution:
 *   Base Actor Source          (bundled source file or DM library)
 * + Current Actor Override     (DM edits stored in localStorage — P3)
 * + Live Table State           (HP, initiative, trackers from room metadata)
 * = Rendered Current Actor
 *
 * In P1: override layer is a no-op (empty overrides).
 * In P3: override layer is populated by the actor editor.
 */

export type ActorOverrideMap = Record<string, Partial<Actor>>;

export function resolveActor(
  actorId: string,
  library: Record<string, Actor>,
  overrides: ActorOverrideMap,
  liveState: FdmcRoomLiveState,
): Actor | undefined {
  const base = library[actorId];
  if (!base) return undefined;

  const override = overrides[actorId] ?? {};
  const live: FdmcActorLiveState | undefined = liveState.actorLiveState[actorId];

  // Merge base + override (shallow — tabs/actions deep merge happens in P3)
  const merged: Actor = {
    ...base,
    ...override,
    stats: {
      ...base.stats,
      ...(override.stats ?? {}),
      // Live HP always wins over both base and override
      hp: live?.hp ?? override.stats?.hp ?? base.stats.hp,
    },
  };

  return merged;
}

export function resolveActors(
  actorIds: string[],
  library: Record<string, Actor>,
  overrides: ActorOverrideMap,
  liveState: FdmcRoomLiveState,
): Actor[] {
  return actorIds.flatMap(id => {
    const actor = resolveActor(id, library, overrides, liveState);
    return actor ? [actor] : [];
  });
}

/**
 * Build the actor library from bundled source actors.
 * In P2 this is replaced by the DM localStorage library.
 * In P1 we import directly from the module source files.
 */
export function buildActorLibraryFromBundled(actors: Actor[]): Record<string, Actor> {
  return Object.fromEntries(actors.map(a => [a.id, a]));
}
