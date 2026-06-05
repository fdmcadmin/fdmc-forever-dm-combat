import OBR from "@owlbear-rodeo/sdk";
import { getSharedTableBudgetStatus, shouldLogSharedTableBudget, type SharedTableBudgetLevel } from "./sharedTableBudget";

export const FDMC_ROOM_STATE_VERSION = "0.5.3.4f-syncproof1";
const MIN_ROOM_STATE_POLL_MS = 1500;

type RoomMetadata = Record<string, unknown>;
type SyncDiagnosticsSnapshot = {
  pollCount: number;
  activeSubscriptions: number;
  lastReadAt: string;
  lastWriteAt: string;
  sharedStateSizeBytes: number;
  revision: number;
  lastError: string;
};

type OwlbearRoomBridge = {
  room?: {
    getMetadata?: () => Promise<RoomMetadata> | RoomMetadata;
    setMetadata?: (metadata: RoomMetadata) => Promise<void> | void;
    onMetadataChange?: (callback: (metadata: RoomMetadata) => void) => (() => void) | void;
  };
};

const diagnosticsListeners = new Set<() => void>();
let diagnostics: SyncDiagnosticsSnapshot = {
  pollCount: 0,
  activeSubscriptions: 0,
  lastReadAt: "",
  lastWriteAt: "",
  sharedStateSizeBytes: 0,
  revision: 0,
  lastError: "",
};

let lastSharedTableBudgetLevel: SharedTableBudgetLevel | undefined;

function estimateJsonSize(value: unknown): number {
  try {
    return JSON.stringify(value).length;
  } catch {
    return 0;
  }
}

function stableStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function readRevision(value: unknown): number | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const revision = (value as { revision?: unknown }).revision;
  return typeof revision === "number" && Number.isFinite(revision) ? revision : undefined;
}

function updateDiagnostics(patch: Partial<SyncDiagnosticsSnapshot>) {
  diagnostics = { ...diagnostics, ...patch };
  diagnosticsListeners.forEach((listener) => listener());
}

export function getFdmcRoomSyncDiagnostics(): SyncDiagnosticsSnapshot {
  return diagnostics;
}

export function subscribeFdmcRoomSyncDiagnostics(listener: () => void): () => void {
  diagnosticsListeners.add(listener);
  return () => diagnosticsListeners.delete(listener);
}

export function canUseOwlbearRoomState(): boolean {
  return Boolean(OBR.isAvailable);
}

export async function readFdmcRoomMetadata(): Promise<RoomMetadata | undefined> {
  if (!canUseOwlbearRoomState()) {
    return undefined;
  }

  const obr = OBR as unknown as OwlbearRoomBridge;
  try {
    const metadata = await obr.room?.getMetadata?.();
    updateDiagnostics({
      lastReadAt: new Date().toISOString(),
      sharedStateSizeBytes: estimateJsonSize(metadata),
      lastError: "",
    });
    return metadata && typeof metadata === "object" ? metadata : undefined;
  } catch (error) {
    updateDiagnostics({ lastError: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

export async function readFdmcRoomStateKey<T>(key: string, normalize: (value: unknown) => T | undefined): Promise<T | undefined> {
  const metadata = await readFdmcRoomMetadata();
  return normalize(metadata?.[key]);
}

export async function publishFdmcRoomStateKey(key: string, value: unknown): Promise<void> {
  if (!canUseOwlbearRoomState()) {
    return;
  }

  const obr = OBR as unknown as OwlbearRoomBridge;
  try {
    const current = await readFdmcRoomMetadata();
    if (stableStringify(current?.[key]) === stableStringify(value)) {
      updateDiagnostics({
        revision: readRevision(value) ?? diagnostics.revision,
        sharedStateSizeBytes: estimateJsonSize(current),
        lastError: "",
      });
      return;
    }

    const nextMetadata = { ...(current ?? {}), [key]: value };
    const isSharedTableStateWrite = key.includes("sharedTableState");
    if (isSharedTableStateWrite) {
      const budget = getSharedTableBudgetStatus(value);
      if (shouldLogSharedTableBudget(lastSharedTableBudgetLevel, budget.level)) {
        console.warn(budget.message);
      }
      lastSharedTableBudgetLevel = budget.level;
      if (!budget.canWrite) {
        updateDiagnostics({
          sharedStateSizeBytes: budget.bytes,
          revision: readRevision(value) ?? diagnostics.revision,
          lastError: budget.message,
        });
        throw new Error(budget.message);
      }
    }

    await obr.room?.setMetadata?.(nextMetadata);
    updateDiagnostics({
      lastWriteAt: new Date().toISOString(),
      sharedStateSizeBytes: estimateJsonSize(nextMetadata),
      revision: readRevision(value) ?? diagnostics.revision,
      lastError: "",
    });
  } catch (error) {
    updateDiagnostics({ lastError: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

export function subscribeFdmcRoomStateKey<T>(
  key: string,
  normalize: (value: unknown) => T | undefined,
  onValue: (value: T) => void,
  options: { pollMs?: number } = {},
): () => void {
  if (!canUseOwlbearRoomState()) {
    return () => undefined;
  }

  const obr = OBR as unknown as OwlbearRoomBridge;
  let stopped = false;
  let lastValue = "";
  let lastRevision: number | undefined;

  const apply = (metadata: RoomMetadata | undefined) => {
    if (!metadata || stopped) {
      return;
    }

    const next = normalize(metadata[key]);
    if (!next) {
      return;
    }

    const revision = readRevision(next);
    if (revision !== undefined && revision === lastRevision) {
      return;
    }

    const serialized = JSON.stringify(next);
    if (serialized === lastValue) {
      return;
    }

    lastValue = serialized;
    lastRevision = revision;
    updateDiagnostics({
      revision: revision ?? diagnostics.revision,
      sharedStateSizeBytes: estimateJsonSize(metadata),
      lastError: "",
    });
    onValue(next);
  };

  updateDiagnostics({ activeSubscriptions: diagnostics.activeSubscriptions + 1 });
  const unsubscribe = obr.room?.onMetadataChange?.((metadata) => apply(metadata));
  void readFdmcRoomMetadata().then(apply).catch(() => undefined);

  const pollMs = Math.max(options.pollMs ?? 5000, MIN_ROOM_STATE_POLL_MS);
  const intervalId = window.setInterval(() => {
    updateDiagnostics({ pollCount: diagnostics.pollCount + 1 });
    void readFdmcRoomMetadata().then(apply).catch(() => undefined);
  }, pollMs);

  return () => {
    stopped = true;
    window.clearInterval(intervalId);
    updateDiagnostics({ activeSubscriptions: Math.max(0, diagnostics.activeSubscriptions - 1) });
    if (typeof unsubscribe === "function") {
      unsubscribe();
    }
  };
}
