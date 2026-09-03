import type { Actor } from "../types/actor";
import { proficiencyBonus } from "../rules/dnd5e";
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

  /**
   * ⚠ A COMPANION IS PROFICIENT AT ITS OWNER'S LEVEL.
   *
   * Christopher: *"all of these things are affected by the ranger lvl or the pc level, this is how
   * things with companions are suppose to be."* Stamped HERE because this is the one place every
   * surface already funnels through — the card, the popout, the seat library and the combat
   * tracker all call `resolveActor`, so the 18 `resolveFormulaVars` call sites downstream need
   * no change at all and cannot drift apart.
   *
   * ⚠ THE OWNER IS READ THROUGH THE OVERRIDE LAYER, not off the bundled base. A DM who levels
   * Lyrielle in the editor writes an override; reading `library[ownerId].level` alone would leave
   * Faelar proficient at whatever level shipped in the source file.
   *
   * `moduleData.ownerId` is the canonical home — `Actor.ownerId` exists on the type but every
   * live call site (the combat tracker's grouping, `resetCompanionTurns`, the editor's save path)
   * reads and writes the moduleData one.
   */
  if (merged.kind === "companion") {
    // Held in a local so `act`/`theme`/`statBlockStatus` stay narrowed when it is spread below.
    const ownModule = merged.moduleData;
    const ownerId = ownModule?.ownerId;
    if (ownerId && ownModule) {
      const ownerLevel = overrides[ownerId]?.level ?? library[ownerId]?.level;
      /**
       * ⚠ WIS AND PB COME FROM THE OWNER. THE REST OF THE STAT BLOCK DOES NOT.
       *
       * Christopher, 2026-09-03: *"WIS and PB are carried over to the companion for saves and
       * damage, while the ABS of faelar come from the beast of the land stat block."* So this
       * replaces exactly one ability score and leaves STR/DEX/CON/INT/CHA alone — the beast is
       * still the beast, it is only proficient and wise at its owner's measure.
       *
       * Overriding the SCORE rather than adding a token means every consumer already works:
       * `@WIS` in a damage formula, the WIS save row, and any check that reads the modifier all
       * resolve through the same field they always did.
       *
       * It is invisible on the current party — Lyrielle and Faelar are both WIS 14 — which is
       * precisely why it needed a gate rather than an eye.
       */
      const ownerWis = overrides[ownerId]?.abilityScores?.wis ?? library[ownerId]?.abilityScores?.wis;
      const ownerModule = overrides[ownerId]?.moduleData ?? library[ownerId]?.moduleData;
      const ownerAssignment = ownerModule?.bondAssignment;

      let stamped = merged;
      if (typeof ownerLevel === "number" && Number.isFinite(ownerLevel)) {
        stamped = { ...stamped, proficiencyBonus: proficiencyBonus(ownerLevel) };
      }
      if (ownerWis) {
        stamped = { ...stamped, abilityScores: { ...stamped.abilityScores, wis: ownerWis } };
      }
      if (ownerAssignment) {
        stamped = {
          ...stamped,
          moduleData: {
            ...ownModule,
            // Keys are omitted rather than set to undefined — `exactOptionalPropertyTypes`.
            ownerBond: {
              assignment: ownerAssignment,
              ...(typeof ownerLevel === "number" ? { ownerLevel } : {}),
              ...(ownerModule?.milestones ? { milestones: ownerModule.milestones } : {}),
            },
          },
        };
      }
      return stamped;
    }
  }

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
