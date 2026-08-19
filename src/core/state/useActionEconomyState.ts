import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import OBR from "@owlbear-rodeo/sdk";
import type { Actor } from "../types/actor";
import { slotsOf } from "../types/actionEconomy";
import type { ActionCost, EconomySlot, ActorActionEconomyMap, ActorActionEconomyState } from "../types/actionEconomy";
import { emptyActionEconomyState } from "../types/actionEconomy";

const ACTION_STATE_STORAGE_KEY = "fdm:action-economy-state:v1";
const ACTION_STATE_CHANNEL = "forever-dm-combat:action-economy-state:v1";

type ActionStateSyncMessage = { type: "replace"; state: ActorActionEconomyMap };

function isActionStateSyncMessage(data: unknown): data is ActionStateSyncMessage {
  if (!data || typeof data !== "object") {
    return false;
  }

  const message = data as { type?: unknown; state?: unknown };
  return message.type === "replace" && Boolean(message.state && typeof message.state === "object");
}

function cloneEmptyState(): ActorActionEconomyState {
  return { ...emptyActionEconomyState };
}

function createInitialState(actors: Actor[]): ActorActionEconomyMap {
  return actors.reduce<ActorActionEconomyMap>((state, actor) => {
    state[actor.id] = cloneEmptyState();
    return state;
  }, {});
}

function readStoredState(): ActorActionEconomyMap | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(ACTION_STATE_STORAGE_KEY);
    return raw ? JSON.parse(raw) as ActorActionEconomyMap : null;
  } catch {
    return null;
  }
}

function persistState(state: ActorActionEconomyMap) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(ACTION_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Keep in-memory state usable if storage is unavailable.
  }
}

function mergeStoredState(actors: Actor[], initialState: ActorActionEconomyMap) {
  const stored = readStoredState();

  if (!stored) {
    return initialState;
  }

  return actors.reduce<ActorActionEconomyMap>((state, actor) => {
    state[actor.id] = {
      ...cloneEmptyState(),
      ...(stored[actor.id] ?? {}),
    };
    return state;
  }, {});
}

export function useActionEconomyState(actors: Actor[]) {
  const initialState = useMemo(() => createInitialState(actors), [actors]);
  const [actionStateByActorId, setActionStateByActorId] = useState<ActorActionEconomyMap>(() => mergeStoredState(actors, initialState));
  const broadcastReadyRef = useRef(false);
  const stateRef = useRef(actionStateByActorId);
  stateRef.current = actionStateByActorId;

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== ACTION_STATE_STORAGE_KEY) {
        return;
      }

      setActionStateByActorId(mergeStoredState(actors, createInitialState(actors)));
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [actors]);

  useEffect(() => {
    if (!OBR.isAvailable) {
      return;
    }

    broadcastReadyRef.current = true;
    // UX-6: re-broadcast current state on mount so late-joining peers get current economy
    const currentStored = readStoredState();
    if (currentStored) {
      void OBR.broadcast.sendMessage(ACTION_STATE_CHANNEL, { type: "replace", state: currentStored }, { destination: "ALL" }).catch(() => undefined);
    }

    return OBR.broadcast.onMessage(ACTION_STATE_CHANNEL, (event) => {
      if (!isActionStateSyncMessage(event.data)) {
        return;
      }

      // Merge incoming state — don't overwrite other actors' economy (popout only has one actor)
      const existing = readStoredState() ?? {};
      persistState({ ...existing, ...event.data.state });
      setActionStateByActorId(mergeStoredState(actors, createInitialState(actors)));
    });
  }, [actors]);

  const broadcastState = useCallback((state: ActorActionEconomyMap) => {
    if (!OBR.isAvailable) {
      return;
    }
    // Removed broadcastReadyRef guard — timing issues caused silent drops on early clicks.
    // OBR.isAvailable is the only guard needed; the listener may not be registered yet
    // on the DM side but the message will still deliver since OBR queues broadcasts.
    void OBR.broadcast.sendMessage(ACTION_STATE_CHANNEL, { type: "replace", state }, { destination: "ALL" }).catch(() => undefined);
  }, []);

  const setAndPersist = useCallback((updater: (current: ActorActionEconomyMap) => ActorActionEconomyMap) => {
    setActionStateByActorId((current) => {
      const next = updater(current);
      persistState(next);
      broadcastState(next);
      return next;
    });
  }, [broadcastState]);

  const getActionState = useCallback(
    (actor: Actor) => actionStateByActorId[actor.id] ?? cloneEmptyState(),
    [actionStateByActorId]
  );

  const readyActionCosts = useCallback((actorId: string, costs: ActionCost[], readiedKey: string) => {
    // Only SLOT costs are readied. A free action still reaches here with ["free"], and readying
    // it must be a no-op rather than inventing a slot to hold it.
    const slots = slotsOf(costs);
    if (slots.length === 0) {
      return;
    }

    setAndPersist((current) => {
      const currentActorState = current[actorId] ?? cloneEmptyState();
      const nextActorState = { ...currentActorState };

      slots.forEach((cost) => {
        nextActorState[cost] = readiedKey;
      });

      return {
        ...current,
        [actorId]: nextActorState,
      };
    });
  }, [setAndPersist]);

  const unreadyActionKey = useCallback((actorId: string, readiedKey: string) => {
    setAndPersist((current) => {
      const currentActorState = current[actorId] ?? cloneEmptyState();
      const nextActorState = { ...currentActorState };
      let changed = false;

      (Object.keys(nextActorState) as EconomySlot[]).forEach((cost) => {
        if (nextActorState[cost] === readiedKey) {
          nextActorState[cost] = null;
          changed = true;
        }
      });

      if (!changed) {
        return current;
      }

      return {
        ...current,
        [actorId]: nextActorState,
      };
    });
  }, [setAndPersist]);

  const resetActorTurn = useCallback((actorId: string) => {
    setAndPersist((current) => ({
      ...current,
      [actorId]: cloneEmptyState(),
    }));
  }, [setAndPersist]);

  const resetAllTurns = useCallback(() => {
    const next = createInitialState(actors);
    persistState(next);
    setActionStateByActorId(next);
    broadcastState(next);
  }, [actors, broadcastState]);

  return {
    actionStateByActorId,
    getActionState,
    readyActionCosts,
    unreadyActionKey,
    resetActorTurn,
    resetAllTurns,
  };
}
