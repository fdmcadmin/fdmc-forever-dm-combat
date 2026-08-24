import { useCallback, useEffect, useMemo, useState } from "react";
import type { Actor, DrainTracker } from "../types/actor";
import type { ActorStatusTrackerMap, ActorStatusTrackerState, StatusTrackerId } from "../types/status";
import { safeStorage } from "../utils/safeStorage";

const ACTOR_STATUS_STORAGE_KEY = "fdm:actor-status-state:v1";

function resolveTrackerForActor(actor: Actor, tracker?: DrainTracker): DrainTracker | undefined {
  if (!tracker) {
    return undefined;
  }

  const resolvedMax = tracker.maxSource === "actorHpMax" ? actor.stats.hp.max : tracker.max;
  const resolvedWarningAt = tracker.warningAtSource === "max" ? resolvedMax : tracker.warningAt;

  return {
    ...tracker,
    max: resolvedMax,
    warningAt: resolvedWarningAt,
  };
}

function cloneTracker(tracker?: DrainTracker): DrainTracker | undefined {
  if (!tracker) {
    return undefined;
  }

  return { ...tracker };
}

/** Default (undrained) tracker set for an actor. Exported so a seat can compute the value a
 * RESET would produce and request it, instead of writing its own copy — see actor-popout. */
export function createActorStatus(actor: Actor): ActorStatusTrackerState {
  return {
    strDrain: resolveTrackerForActor(actor, actor.moduleData?.strDrain),
    lifeDrain: resolveTrackerForActor(actor, actor.moduleData?.lifeDrain),
  };
}

function createInitialStatusState(actors: Actor[]): ActorStatusTrackerMap {
  return actors.reduce<ActorStatusTrackerMap>((state, actor) => {
    state[actor.id] = createActorStatus(actor);
    return state;
  }, {});
}

function readStoredStatus(): ActorStatusTrackerMap | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = safeStorage().getItem(ACTOR_STATUS_STORAGE_KEY);
    return raw ? JSON.parse(raw) as ActorStatusTrackerMap : null;
  } catch {
    return null;
  }
}

function persistStatus(state: ActorStatusTrackerMap) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    safeStorage().setItem(ACTOR_STATUS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Keep in-memory status usable if storage is unavailable.
  }
}

function mergeStoredStatus(actors: Actor[], initial: ActorStatusTrackerMap) {
  const stored = readStoredStatus();

  if (!stored) {
    return initial;
  }

  return actors.reduce<ActorStatusTrackerMap>((state, actor) => {
    state[actor.id] = {
      ...createActorStatus(actor),
      ...(stored[actor.id] ?? {}),
    };
    return state;
  }, {});
}


function clampTrackerValue(value: number, max?: number) {
  const minimumClamped = Math.max(0, value);

  if (typeof max === "number") {
    return Math.min(max, minimumClamped);
  }

  return minimumClamped;
}

export function useActorStatusState(actors: Actor[]) {
  const initialState = useMemo(() => createInitialStatusState(actors), [actors]);
  const [statusByActorId, setStatusByActorId] = useState<ActorStatusTrackerMap>(() => mergeStoredStatus(actors, initialState));

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== ACTOR_STATUS_STORAGE_KEY) {
        return;
      }

      setStatusByActorId(mergeStoredStatus(actors, createInitialStatusState(actors)));
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [actors]);

  const setAndPersist = useCallback((updater: (current: ActorStatusTrackerMap) => ActorStatusTrackerMap) => {
    setStatusByActorId((current) => {
      const next = updater(current);
      persistStatus(next);
      return next;
    });
  }, []);

  const getActorStatus = useCallback(
    (actor: Actor) => statusByActorId[actor.id] ?? createActorStatus(actor),
    [statusByActorId]
  );

  const setActorTracker = useCallback(
    (actorId: string, trackerId: StatusTrackerId, nextTracker: DrainTracker) => {
      setAndPersist((current) => ({
        ...current,
        [actorId]: {
          ...(current[actorId] ?? {}),
          [trackerId]: {
            ...nextTracker,
            current: clampTrackerValue(nextTracker.current, nextTracker.max),
          },
        },
      }));
    },
    []
  );

  const resetActorTracker = useCallback(
    (actor: Actor, trackerId: StatusTrackerId) => {
      const defaultStatus = createActorStatus(actor);
      const defaultTracker = defaultStatus[trackerId];

      if (!defaultTracker) {
        return;
      }

      setAndPersist((current) => ({
        ...current,
        [actor.id]: {
          ...(current[actor.id] ?? {}),
          [trackerId]: cloneTracker(defaultTracker),
        },
      }));
    },
    []
  );

  const resetActorStatuses = useCallback((actor: Actor) => {
    setAndPersist((current) => ({
      ...current,
      [actor.id]: createActorStatus(actor),
    }));
  }, []);

  const resetAllStatuses = useCallback(() => {
    const next = createInitialStatusState(actors);
    persistStatus(next);
    setStatusByActorId(next);
  }, [actors]);

  return {
    statusByActorId,
    getActorStatus,
    setActorTracker,
    resetActorTracker,
    resetActorStatuses,
    resetAllStatuses,
  };
}
