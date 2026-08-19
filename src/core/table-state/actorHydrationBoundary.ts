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

  /**
   * ⚠ TABS MERGE PER TAB. A shallow `...override` replaced base.tabs WHOLESALE, so an override
   * carrying only `{ equipment }` deleted every other tab from the resolved actor — main, spells,
   * features, the lot. `stats` two lines below has always merged properly; tabs never did, and
   * the comment claiming the deep merge "happens in P3" outlived P3.
   *
   * It stayed invisible while overrides held a FULL copy of every tab: replacing a complete
   * duplicate with itself is a no-op. The moment anything reduced an override to a subset, the
   * missing tabs vanished from the resolved actor — and because `upsertActorInLibrary` writes a
   * resolved actor straight back to base, the next save wrote the loss through to the library.
   *
   * Verified against a live backup: base 10 populated tabs + override 1 (equipment) resolved to
   * 1 tab before this, and to all 10 after.
   *
   * An override tab still WINS wholesale for the tabs it actually carries — that is the intended
   * rule and is what lets equipment be overridden — but it can no longer speak for tabs it says
   * nothing about.
   */
  const merged: Actor = {
    ...base,
    ...override,
    tabs: { ...base.tabs, ...(override.tabs ?? {}) },
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
