import { useCallback, useEffect, useMemo, useState } from "react";
import type { Actor } from "../types/actor";
import type { TabId } from "../types/tabs";

const CONCENTRATION_STORAGE_KEY = "fdm:concentration-state:v1";

export type ActorConcentrationState = {
  actionId: string;
  actionLabel: string;
  sourceTabId: TabId;
  active?: boolean;
} | null;

export type ActorConcentrationMap = Record<string, ActorConcentrationState>;

function createInitialConcentrationMap(actors: Actor[]): ActorConcentrationMap {
  return actors.reduce<ActorConcentrationMap>((map, actor) => {
    map[actor.id] = null;
    return map;
  }, {});
}

function readStoredConcentration(): ActorConcentrationMap | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(CONCENTRATION_STORAGE_KEY);
    return raw ? JSON.parse(raw) as ActorConcentrationMap : null;
  } catch {
    return null;
  }
}

function persistConcentration(state: ActorConcentrationMap) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(CONCENTRATION_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Keep in-memory concentration usable if storage is unavailable.
  }
}

function mergeStoredConcentration(actors: Actor[], initial: ActorConcentrationMap) {
  const stored = readStoredConcentration();

  if (!stored) {
    return initial;
  }

  return actors.reduce<ActorConcentrationMap>((map, actor) => {
    map[actor.id] = stored[actor.id] ?? null;
    return map;
  }, {});
}

export function useActorConcentrationState(actors: Actor[]) {
  const initialMap = useMemo(() => createInitialConcentrationMap(actors), [actors]);
  const [concentrationByActorId, setConcentrationByActorId] = useState<ActorConcentrationMap>(() => mergeStoredConcentration(actors, initialMap));

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== CONCENTRATION_STORAGE_KEY) {
        return;
      }

      setConcentrationByActorId(mergeStoredConcentration(actors, createInitialConcentrationMap(actors)));
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [actors]);

  const setAndPersist = useCallback((updater: (current: ActorConcentrationMap) => ActorConcentrationMap) => {
    setConcentrationByActorId((current) => {
      const next = updater(current);
      persistConcentration(next);
      return next;
    });
  }, []);

  function getActorConcentration(actor: Actor): ActorConcentrationState {
    return concentrationByActorId[actor.id] ?? null;
  }

  function setActorConcentration(actorId: string, nextConcentration: Exclude<ActorConcentrationState, null>) {
    setAndPersist((current) => ({
      ...current,
      [actorId]: nextConcentration,
    }));
  }

  function clearActorConcentration(actorId: string) {
    setAndPersist((current) => ({
      ...current,
      [actorId]: null,
    }));
  }

  return {
    concentrationByActorId,
    getActorConcentration,
    setActorConcentration,
    clearActorConcentration,
  };
}
