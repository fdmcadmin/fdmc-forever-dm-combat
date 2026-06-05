import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import OBR from "@owlbear-rodeo/sdk";
import type { Actor } from "../types/actor";
import { DEFAULT_COMBAT_RULES_PROFILE } from "../types/committedRoll";
import type {
  CommittedRollDamageChoice,
  CommittedRollMap,
  CommittedRollOutcome,
  CommittedRollOutcomeMode,
  CommittedRollState,
  StartCommittedRollInput,
} from "../types/committedRoll";

const COMMITTED_ROLL_STORAGE_KEY = "fdm:committed-roll-state:v1";
const COMMITTED_ROLL_CHANNEL = "forever-dm-combat:committed-roll-state:v1";

type CommittedRollSyncMessage = { type: "replace"; state: CommittedRollMap };

function isCommittedRollSyncMessage(data: unknown): data is CommittedRollSyncMessage {
  if (!data || typeof data !== "object") {
    return false;
  }

  const message = data as { type?: unknown; state?: unknown };
  return message.type === "replace" && Boolean(message.state && typeof message.state === "object");
}

function createInitialState(actors: Actor[]): CommittedRollMap {
  return actors.reduce<CommittedRollMap>((state, actor) => {
    state[actor.id] = null;
    return state;
  }, {});
}


function readStoredCommittedRolls(): CommittedRollMap | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(COMMITTED_ROLL_STORAGE_KEY);
    return raw ? JSON.parse(raw) as CommittedRollMap : null;
  } catch {
    return null;
  }
}

function persistCommittedRolls(state: CommittedRollMap) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(COMMITTED_ROLL_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Keep in-memory roll state usable if browser storage is unavailable.
  }
}

function mergeStoredCommittedRolls(actors: Actor[], initialState: CommittedRollMap) {
  const stored = readStoredCommittedRolls();

  if (!stored) {
    return initialState;
  }

  return actors.reduce<CommittedRollMap>((state, actor) => {
    state[actor.id] = stored[actor.id] ?? null;
    return state;
  }, {});
}

function inferOutcomeMode(input: StartCommittedRollInput): CommittedRollOutcomeMode {
  if (input.outcomeMode) {
    return input.outcomeMode;
  }

  if (input.attackFormula?.trim()) {
    return "attack-roll";
  }

  if (input.saveDc?.trim()) {
    return "dc-check";
  }

  return "triggered";
}

function normalizeCritThreshold(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 20;
  }

  return Math.min(20, Math.max(1, Math.floor(value)));
}

function createBridgeRequestId(actionId: string) {
  const randomPart = Math.random().toString(36).slice(2, 9);
  return `fdm-${Date.now()}-${actionId}-${randomPart}`;
}

function extractNaturalRoll(rawResult: string) {
  const value = rawResult.trim();

  if (!value) {
    return null;
  }

  const explicitNatural = value.match(/\b(?:nat|natural)\s*(\d{1,2})\b/i);
  if (explicitNatural) {
    const parsed = Number.parseInt(explicitNatural[1], 10);
    return parsed >= 1 && parsed <= 20 ? parsed : null;
  }

  const firstNumber = value.match(/\b(\d{1,2})\b/);
  if (!firstNumber) {
    return null;
  }

  const parsed = Number.parseInt(firstNumber[1], 10);
  return parsed >= 1 && parsed <= 20 ? parsed : null;
}

function withResult(state: CommittedRollState, rollResult: string): CommittedRollState {
  const naturalRoll = extractNaturalRoll(rollResult);
  const rulesProfile = state.rulesProfile ?? DEFAULT_COMBAT_RULES_PROFILE;
  const isAttackRoll = state.outcomeMode === "attack-roll";
  const isCrit = Boolean(
    isAttackRoll &&
    rulesProfile.naturalAttack20Crits &&
    typeof naturalRoll === "number" &&
    naturalRoll >= state.critThreshold
  );
  const isCriticalFailure = Boolean(
    isAttackRoll &&
    rulesProfile.naturalAttack1CriticalFailure &&
    naturalRoll === 1
  );
  const autoConfirmCritHit = Boolean(isCrit && rulesProfile.naturalAttack20AutoHits);
  const nextPhase = autoConfirmCritHit
    ? state.hasCritDamageChoice || state.hasDamageChoice
      ? "awaiting-damage"
      : "awaiting-resolution"
    : "result-held";

  return {
    ...state,
    phase: nextPhase,
    rollResult: rollResult.trim(),
    naturalRoll,
    isCrit,
    isCriticalFailure,
    outcome: autoConfirmCritHit ? "hit" : undefined,
    damageChoice: undefined,
  };
}

export function useCommittedRollState(actors: Actor[]) {
  const initialState = useMemo(() => createInitialState(actors), [actors]);
  const [committedRollByActorId, setCommittedRollByActorId] = useState<CommittedRollMap>(() => mergeStoredCommittedRolls(actors, initialState));
  const broadcastReadyRef = useRef(false);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== COMMITTED_ROLL_STORAGE_KEY) {
        return;
      }

      setCommittedRollByActorId(mergeStoredCommittedRolls(actors, createInitialState(actors)));
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [actors]);

  useEffect(() => {
    if (!OBR.isAvailable) {
      return;
    }

    broadcastReadyRef.current = true;

    return OBR.broadcast.onMessage(COMMITTED_ROLL_CHANNEL, (event) => {
      if (!isCommittedRollSyncMessage(event.data)) {
        return;
      }

      persistCommittedRolls(event.data.state);
      setCommittedRollByActorId(mergeStoredCommittedRolls(actors, createInitialState(actors)));
    });
  }, [actors]);

  const broadcastState = useCallback((state: CommittedRollMap) => {
    if (!OBR.isAvailable || !broadcastReadyRef.current) {
      return;
    }

    void OBR.broadcast.sendMessage(COMMITTED_ROLL_CHANNEL, { type: "replace", state }, { destination: "REMOTE" }).catch(() => undefined);
  }, []);

  const setAndPersist = useCallback((updater: (current: CommittedRollMap) => CommittedRollMap) => {
    setCommittedRollByActorId((current) => {
      const next = updater(current);
      persistCommittedRolls(next);
      broadcastState(next);
      return next;
    });
  }, [broadcastState]);

  const getCommittedRoll = useCallback(
    (actor: Actor) => committedRollByActorId[actor.id] ?? null,
    [committedRollByActorId]
  );

  const startCommittedRoll = useCallback((actorId: string, input: StartCommittedRollInput) => {
    const outcomeMode = inferOutcomeMode(input);
    const requiresRollResult = outcomeMode === "attack-roll" || outcomeMode === "ability-check";
    const hasDamageChoice = Boolean(input.damageFormula?.trim());
    const hasCritDamageChoice = Boolean(outcomeMode === "attack-roll" && input.critDamageFormula?.trim());

    setAndPersist((current) => ({
      ...current,
      [actorId]: {
        ...input,
        outcomeMode,
        phase: requiresRollResult ? "committed" : "result-held",
        rollResult: "",
        naturalRoll: null,
        isCrit: false,
        isCriticalFailure: false,
        critThreshold: normalizeCritThreshold(input.critThreshold),
        rulesProfile: input.rulesProfile ?? DEFAULT_COMBAT_RULES_PROFILE,
        requiresRollResult,
        hasDamageChoice,
        hasCritDamageChoice,
        rerollCount: 0,
        bridgeRequestId: input.bridgeRequestId ?? createBridgeRequestId(input.actionId),
        bridgeSentCount: 0,
      },
    }));
  }, [setAndPersist]);

  const setCommittedRollResult = useCallback((actorId: string, rollResult: string) => {
    setAndPersist((current) => {
      const state = current[actorId];

      if (!state) {
        return current;
      }

      return {
        ...current,
        [actorId]: withResult(state, rollResult),
      };
    });
  }, [setAndPersist]);

  const chooseCommittedRollOutcome = useCallback((actorId: string, outcome: CommittedRollOutcome) => {
    setAndPersist((current) => {
      const state = current[actorId];

      if (!state) {
        return current;
      }

      if (outcome === "reroll") {
        if (!state.requiresRollResult) {
          return current;
        }

        return {
          ...current,
          [actorId]: {
            ...state,
            phase: "committed",
            rollResult: "",
            naturalRoll: null,
            isCrit: false,
            isCriticalFailure: false,
            outcome: "reroll",
            damageChoice: undefined,
            rerollCount: state.rerollCount + 1,
          },
        };
      }

      if (state.isCriticalFailure && outcome === "hit") {
        return current;
      }

      if (state.isCrit && state.rulesProfile.naturalAttack20AutoHits && outcome === "miss") {
        return current;
      }

      return {
        ...current,
        [actorId]: {
          ...state,
          phase: outcome === "hit" ? "awaiting-damage" : "awaiting-resolution",
          outcome,
          damageChoice: undefined,
        },
      };
    });
  }, [setAndPersist]);

  const chooseCommittedRollDamage = useCallback((actorId: string, damageChoice: CommittedRollDamageChoice) => {
    setAndPersist((current) => {
      const state = current[actorId];

      if (!state) {
        return current;
      }

      return {
        ...current,
        [actorId]: {
          ...state,
          phase: "awaiting-resolution",
          outcome: "hit",
          damageChoice,
        },
      };
    });
  }, [setAndPersist]);

  const markCommittedRollBridgeSent = useCallback((actorId: string) => {
    setAndPersist((current) => {
      const state = current[actorId];

      if (!state) {
        return current;
      }

      return {
        ...current,
        [actorId]: {
          ...state,
          bridgeSentCount: state.bridgeSentCount + 1,
        },
      };
    });
  }, [setAndPersist]);

  const clearCommittedRoll = useCallback((actorId: string) => {
    setAndPersist((current) => ({
      ...current,
      [actorId]: null,
    }));
  }, [setAndPersist]);

  const resetAllCommittedRolls = useCallback(() => {
    const next = createInitialState(actors);
    persistCommittedRolls(next);
    setCommittedRollByActorId(next);
    broadcastState(next);
  }, [actors, broadcastState]);

  return {
    committedRollByActorId,
    getCommittedRoll,
    startCommittedRoll,
    setCommittedRollResult,
    chooseCommittedRollOutcome,
    chooseCommittedRollDamage,
    markCommittedRollBridgeSent,
    clearCommittedRoll,
    resetAllCommittedRolls,
  };
}
