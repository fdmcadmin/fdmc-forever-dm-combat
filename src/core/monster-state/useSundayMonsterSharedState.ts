import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import OBR from "@owlbear-rodeo/sdk";
import {
  cloneSundayMonsterRuntimeState,
  stampSundayMonsterRuntimeState,
  SUNDAY_MONSTER_STATE_BROADCAST,
  SUNDAY_MONSTER_STATE_METADATA_KEY,
  type SundayMonsterRuntimeState,
} from "./SundayMonsterStateContract";
import { makeSundayMonsterRuntimeState } from "./theBrokenChainSundayMonsters";

type SundayMonsterStateSyncMessage = {
  type: "fdmc:sunday:monster-runtime:update";
  state: SundayMonsterRuntimeState;
};

type ObrLike = typeof OBR & {
  room?: {
    getMetadata?: () => Promise<Record<string, unknown>>;
    setMetadata?: (metadata: Record<string, unknown>) => Promise<void>;
    onMetadataChange?: (callback: (metadata: Record<string, unknown>) => void) => () => void;
  };
};

function isSundayMonsterState(value: unknown): value is SundayMonsterRuntimeState {
  return Boolean(value && typeof value === "object" && (value as { schema?: unknown }).schema === "fdmc.sunday.monster-runtime.v1");
}

function isSundayMonsterStateSyncMessage(value: unknown): value is SundayMonsterStateSyncMessage {
  return Boolean(
    value &&
    typeof value === "object" &&
    (value as { type?: unknown }).type === "fdmc:sunday:monster-runtime:update" &&
    isSundayMonsterState((value as { state?: unknown }).state)
  );
}

function normalizeSundayMonsterState(value: SundayMonsterRuntimeState): SundayMonsterRuntimeState {
  return {
    ...value,
    syncVersion: value.syncVersion ?? 1,
    updatedAt: value.updatedAt ?? new Date().toISOString(),
    updatedBy: value.updatedBy ?? "system",
  };
}

function readLocalFallback() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(SUNDAY_MONSTER_STATE_METADATA_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return isSundayMonsterState(parsed) ? normalizeSundayMonsterState(parsed) : null;
  } catch {
    return null;
  }
}

function writeLocalFallback(state: SundayMonsterRuntimeState) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(SUNDAY_MONSTER_STATE_METADATA_KEY, JSON.stringify(state));
  } catch {
    // Keep the React view usable if browser storage is blocked.
  }
}

async function readRoomState() {
  const obr = OBR as ObrLike;
  if (!OBR.isAvailable || typeof obr.room?.getMetadata !== "function") {
    return readLocalFallback();
  }

  try {
    const metadata = await obr.room.getMetadata();
    const value = metadata[SUNDAY_MONSTER_STATE_METADATA_KEY];
    return isSundayMonsterState(value) ? normalizeSundayMonsterState(cloneSundayMonsterRuntimeState(value)) : readLocalFallback();
  } catch {
    return readLocalFallback();
  }
}

async function writeRoomState(state: SundayMonsterRuntimeState) {
  writeLocalFallback(state);

  const obr = OBR as ObrLike;
  if (!OBR.isAvailable || typeof obr.room?.setMetadata !== "function") {
    return;
  }

  try {
    const existingMetadata = typeof obr.room.getMetadata === "function" ? await obr.room.getMetadata() : {};
    await obr.room.setMetadata({
      ...existingMetadata,
      [SUNDAY_MONSTER_STATE_METADATA_KEY]: cloneSundayMonsterRuntimeState(state),
    });
  } catch {
    // Local fallback already updated. Sunday Beta can still be tested locally.
  }

  try {
    await OBR.broadcast.sendMessage(
      SUNDAY_MONSTER_STATE_BROADCAST,
      { type: "fdmc:sunday:monster-runtime:update", state: cloneSundayMonsterRuntimeState(state) } satisfies SundayMonsterStateSyncMessage,
      { destination: "REMOTE" }
    );
  } catch {
    // Metadata subscription is the table-truth layer; broadcast is just a nudge.
  }
}

export function useSundayMonsterSharedState(defaultEncounterId = "act2-s1-e1-hollow-pack") {
  const defaultState = useMemo(() => makeSundayMonsterRuntimeState(defaultEncounterId), [defaultEncounterId]);
  const [state, setState] = useState<SundayMonsterRuntimeState>(() => readLocalFallback() ?? defaultState);
  const stateRef = useRef(state);
  const mountedRef = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    mountedRef.current = true;

    void readRoomState().then((roomState) => {
      if (!mountedRef.current) return;
      setState(roomState ?? defaultState);
    });

    return () => {
      mountedRef.current = false;
    };
  }, [defaultState]);

  useEffect(() => {
    const obr = OBR as ObrLike;
    if (!OBR.isAvailable || typeof obr.room?.onMetadataChange !== "function") {
      return;
    }

    return obr.room.onMetadataChange((metadata) => {
      const value = metadata[SUNDAY_MONSTER_STATE_METADATA_KEY];
      if (isSundayMonsterState(value)) {
        writeLocalFallback(value);
        setState(normalizeSundayMonsterState(cloneSundayMonsterRuntimeState(value)));
      }
    });
  }, []);

  useEffect(() => {
    if (!OBR.isAvailable) {
      return;
    }

    return OBR.broadcast.onMessage(SUNDAY_MONSTER_STATE_BROADCAST, (event) => {
      if (!isSundayMonsterStateSyncMessage(event.data)) {
        return;
      }

      const normalized = normalizeSundayMonsterState(event.data.state);
      writeLocalFallback(normalized);
      setState(cloneSundayMonsterRuntimeState(normalized));
    });
  }, []);

  const commitState = useCallback(async (updater: SundayMonsterRuntimeState | ((current: SundayMonsterRuntimeState) => SundayMonsterRuntimeState)) => {
    const base = cloneSundayMonsterRuntimeState(stateRef.current);
    const nextDraft = typeof updater === "function" ? updater(base) : cloneSundayMonsterRuntimeState(updater);
    const next = normalizeSundayMonsterState(nextDraft);
    stateRef.current = next;
    setState(next);
    await writeRoomState(next);
  }, []);

  const resetState = useCallback(async (encounterId = defaultEncounterId) => {
    await commitState(stampSundayMonsterRuntimeState(makeSundayMonsterRuntimeState(encounterId), "dm"));
  }, [commitState, defaultEncounterId]);

  const refreshFromRoom = useCallback(async () => {
    const roomState = await readRoomState();
    const next = normalizeSundayMonsterState(roomState ?? stateRef.current);
    stateRef.current = next;
    writeLocalFallback(next);
    setState(cloneSundayMonsterRuntimeState(next));
  }, []);

  return {
    state,
    commitState,
    resetState,
    refreshFromRoom,
    metadataKey: SUNDAY_MONSTER_STATE_METADATA_KEY,
    broadcastChannel: SUNDAY_MONSTER_STATE_BROADCAST,
  };
}
