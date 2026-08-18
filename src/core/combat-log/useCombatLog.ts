import { useCallback, useEffect, useRef, useState } from "react";
import OBR from "@owlbear-rodeo/sdk";
import type { AddCombatLogEntryInput, CombatLogEntry } from "../types/combatLog";

function createTimestamp() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function inferTone(input: AddCombatLogEntryInput): CombatLogEntry["tone"] {
  if (input.tone) {
    return input.tone;
  }

  if (input.tabId === "system") {
    return "system";
  }

  if (!input.actionCosts || input.actionCosts.length === 0) {
    return "table-note";
  }

  return "combat";
}

const SHARED_COMBAT_LOG_STORAGE_KEY = "fdm:shared-combat-log:v1";
const SHARED_COMBAT_LOG_CHANNEL = "forever-dm-combat:shared-combat-log:v1";
/**
 * ⚠ THERE ARE TWO LOGS AND THIS IS THE ONE ON SCREEN.
 *
 * `events/encounterLog.ts` carries its own `ENCOUNTER_LOG_MAX` and was raised to 2500 in
 * 0.7.9.5 — but that log feeds EXPORT and the encounter-library panel. The "Encounter Log"
 * panel a DM actually reads renders `CombatLogEntry[]` from THIS hook, so the raise never
 * reached the screen and the panel kept reporting "100 entries stored" through every fight.
 *
 * The sizing argument is the same one that file already makes: an 8-round boss fight with a
 * ~11-combatant board produces roughly 2,050 entries once attacks, bonus actions, legendary
 * actions, initiative and system markers are counted. 100 truncates exactly the fights the log
 * matters most for — the long ones.
 *
 * This log is broadcast to every seat and mirrored into localStorage, so it is bounded for the
 * same reason: at ~220 bytes an entry, 2500 is ~550KB against a ~5MB budget.
 *
 * KEEP THE TWO IN STEP. Raising one and not the other is what produced this bug.
 */
const MAX_SHARED_LOG_ENTRIES = 2500;

type CombatLogSyncMessage =
  | { type: "add"; entry: CombatLogEntry; supersedePendingKeys?: string[] }
  | { type: "removePending"; pendingKeys: string[] }
  | { type: "clearPending" }
  | { type: "clearAll" };

function readSharedEntries(): CombatLogEntry[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(SHARED_COMBAT_LOG_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((entry): entry is CombatLogEntry =>
      Boolean(entry && typeof entry.id === "string" && typeof entry.message === "string")
    );
  } catch {
    return [];
  }
}

function writeSharedEntries(entries: CombatLogEntry[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      SHARED_COMBAT_LOG_STORAGE_KEY,
      JSON.stringify(entries.slice(0, MAX_SHARED_LOG_ENTRIES))
    );
  } catch {
    // Keep the in-memory log usable if browser storage is unavailable.
  }
}


function pruneAndAddEntry(base: CombatLogEntry[], entry: CombatLogEntry, supersedePendingKeys: string[] = []) {
  const supersedeSet = new Set(supersedePendingKeys);
  const pruned = base.filter((currentEntry) => {
    if (entry.pendingKey && currentEntry.pendingKey === entry.pendingKey) {
      return false;
    }

    if (currentEntry.pendingKey && supersedeSet.has(currentEntry.pendingKey)) {
      return false;
    }

    return !(
      currentEntry.actorName === entry.actorName &&
      currentEntry.actionName === entry.actionName &&
      currentEntry.message === entry.message &&
      currentEntry.tabId === entry.tabId
    );
  });

  return [entry, ...pruned].slice(0, MAX_SHARED_LOG_ENTRIES);
}

function isCombatLogSyncMessage(data: unknown): data is CombatLogSyncMessage {
  if (!data || typeof data !== "object") {
    return false;
  }

  const message = data as { type?: unknown };
  return message.type === "add" || message.type === "removePending" || message.type === "clearPending" || message.type === "clearAll";
}

function createEntry(input: AddCombatLogEntryInput): CombatLogEntry {
  return {
    id: crypto.randomUUID(),
    actorName: input.actorName,
    actionName: input.actionName,
    message: input.message ?? `${input.actorName} has readied ${input.actionName}.`,
    rollResult: input.rollResult,
    timestamp: createTimestamp(),
    tabId: input.tabId,
    actionCosts: input.actionCosts ?? [],
    pendingKey: input.pendingKey,
    tone: inferTone(input),
  };
}

export function useCombatLog() {
  const [entries, setEntries] = useState<CombatLogEntry[]>(() => readSharedEntries());
  const broadcastReadyRef = useRef(false);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === SHARED_COMBAT_LOG_STORAGE_KEY) {
        setEntries(readSharedEntries());
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    if (!OBR.isAvailable) {
      return;
    }

    broadcastReadyRef.current = true;

    return OBR.broadcast.onMessage(SHARED_COMBAT_LOG_CHANNEL, (event) => {
      if (!isCombatLogSyncMessage(event.data)) {
        return;
      }

      const message = event.data;

      setEntries((current) => {
        const currentShared = readSharedEntries();
        const base = currentShared.length > 0 ? currentShared : current;
        let next = base;

        if (message.type === "add") {
          next = pruneAndAddEntry(base, message.entry, message.supersedePendingKeys ?? []);
        } else if (message.type === "removePending") {
          const pendingKeySet = new Set(message.pendingKeys);
          next = base.filter((entry) => !entry.pendingKey || !pendingKeySet.has(entry.pendingKey));
        } else if (message.type === "clearPending") {
          next = base.filter((entry) => !entry.pendingKey);
        } else if (message.type === "clearAll") {
          next = [];
        }

        writeSharedEntries(next);
        return next;
      });
    });
  }, []);

  const broadcast = useCallback((message: CombatLogSyncMessage) => {
    if (!OBR.isAvailable || !broadcastReadyRef.current) {
      return;
    }

    void OBR.broadcast.sendMessage(SHARED_COMBAT_LOG_CHANNEL, message, { destination: "REMOTE" }).catch(() => undefined);
  }, []);

  const addEntry = useCallback((input: AddCombatLogEntryInput) => {
    const entry = createEntry(input);
    const supersedePendingKeys = input.supersedePendingKeys ?? [];

    setEntries((current) => {
      const currentShared = readSharedEntries();
      const base = currentShared.length > 0 ? currentShared : current;
      const next = pruneAndAddEntry(base, entry, supersedePendingKeys);

      writeSharedEntries(next);
      return next;
    });

    broadcast({ type: "add", entry, supersedePendingKeys });
  }, [broadcast]);

  const removePendingEntries = useCallback((pendingKeys: string[]) => {
    if (pendingKeys.length === 0) {
      return;
    }

    const pendingKeySet = new Set(pendingKeys);
    setEntries((current) => {
      const next = current.filter((entry) => !entry.pendingKey || !pendingKeySet.has(entry.pendingKey));
      writeSharedEntries(next);
      return next;
    });

    broadcast({ type: "removePending", pendingKeys });
  }, [broadcast]);

  const clearPendingEntries = useCallback(() => {
    setEntries((current) => {
      const next = current.filter((entry) => !entry.pendingKey);
      writeSharedEntries(next);
      return next;
    });

    broadcast({ type: "clearPending" });
  }, [broadcast]);

  const clearEntries = useCallback(() => {
    writeSharedEntries([]);
    setEntries([]);
    broadcast({ type: "clearAll" });
  }, [broadcast]);

  return {
    entries,
    addEntry,
    removePendingEntries,
    clearPendingEntries,
    clearEntries,
  };
}
