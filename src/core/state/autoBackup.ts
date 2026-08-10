/**
 * Rolling backups of the party — a choice, never something that happens to you.
 *
 * WHY THIS EXISTS: the actor library lives in localStorage and the wallets live in room
 * metadata, so "remove all party characters" plus a bad re-import can lose a campaign's
 * worth of sheets, gear and gold. The DM already has a manual export; this is the version
 * that is still there when someone forgets to press it.
 *
 * TWO LAYERS, because they fail differently:
 *   snapshot ring — kept in localStorage under a key `wipePartyData` does NOT clear, so it
 *                   survives a party wipe and restores in one click. It does NOT survive
 *                   clearing browser data, and it is not a substitute for a file.
 *   file download — survives anything, but a browser can only write a file by downloading
 *                   one, and silently downloading files at an interval is obnoxious. So the
 *                   file is always the DM's press, and the ring is what runs on its own.
 *
 * A snapshot IS an export file (same payload builder), so anything in the ring can be handed
 * to the importer or saved out later.
 */

import { buildExportPayload, applyExportPayload, type ImportResult } from "../seats/actorLibraryExport";
import type { Coins } from "../currency/currency";

/** Deliberately absent from PARTY_LOCAL_KEYS in wipePartyData.ts — a wipe must not eat the backups. */
const SNAPSHOT_KEY = "fdmc.backup.snapshots.v1";
const SETTINGS_KEY = "fdmc.backup.settings.v1";

/** Keep enough to step back past a bad import, few enough to stay inside the storage quota. */
const MAX_SNAPSHOTS = 5;

export type BackupTrigger = "manual" | "session-start" | "interval" | "before-restore" | "before-wipe";

export type BackupSnapshot = {
  id: string;
  takenAt: string;
  trigger: BackupTrigger;
  actorCount: number;
  walletCount: number;
  /** The export payload verbatim. */
  payload: unknown;
};

export type BackupSettings = {
  /**
   * off      — nothing automatic; the DM presses Back Up Now.
   * session  — one snapshot when the DM opens the tools for the day. Cheap, and covers the
   *            case that actually bites: a wipe-and-reimport gone wrong mid-session.
   * interval — session, plus every `intervalMinutes` while the panel is open.
   */
  mode: "off" | "session" | "interval";
  intervalMinutes: number;
};

const DEFAULT_SETTINGS: BackupSettings = { mode: "session", intervalMinutes: 30 };

export function loadBackupSettings(): BackupSettings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<BackupSettings>;
    return {
      mode: parsed.mode === "off" || parsed.mode === "interval" ? parsed.mode : "session",
      intervalMinutes: Number.isFinite(parsed.intervalMinutes) && (parsed.intervalMinutes as number) >= 5
        ? Math.floor(parsed.intervalMinutes as number) : 30,
    };
  } catch { return DEFAULT_SETTINGS; }
}

export function saveBackupSettings(settings: BackupSettings): void {
  try { window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* quota */ }
}

export function loadSnapshots(): BackupSnapshot[] {
  try {
    const raw = window.localStorage.getItem(SNAPSHOT_KEY);
    const list = raw ? JSON.parse(raw) as BackupSnapshot[] : [];
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

/**
 * Take a snapshot. Returns null when there is nothing worth keeping — an empty library
 * would otherwise push a real backup out of the ring.
 */
export function takeSnapshot(
  version: string,
  wallets: Record<string, Coins>,
  trigger: BackupTrigger = "manual",
): BackupSnapshot | null {
  const payload = buildExportPayload(version, wallets);
  const actorCount = Object.keys(payload.actors ?? {}).length;
  if (actorCount === 0) return null;

  const snapshot: BackupSnapshot = {
    id: `snap-${Date.now().toString(36)}`,
    takenAt: new Date().toISOString(),
    trigger,
    actorCount,
    walletCount: Object.keys(payload.wallets ?? {}).length,
    payload,
  };
  const next = [snapshot, ...loadSnapshots()].slice(0, MAX_SNAPSHOTS);
  try {
    window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(next));
  } catch {
    // Over quota — drop to the two most recent rather than losing the ring entirely.
    try { window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(next.slice(0, 2))); } catch { return null; }
  }
  return snapshot;
}

/**
 * Restore a snapshot. Takes a safety snapshot of the CURRENT state first, so restoring the
 * wrong one is itself undoable — the single most likely way to lose data here is a hasty
 * click on the wrong row.
 */
export function restoreSnapshot(id: string, version: string, currentWallets: Record<string, Coins>): ImportResult {
  const snap = loadSnapshots().find(s => s.id === id);
  if (!snap) return { ok: false, actorCount: 0, equipmentCount: 0, message: "That backup is no longer in the ring." };
  takeSnapshot(version, currentWallets, "before-restore");
  return applyExportPayload(snap.payload as Parameters<typeof applyExportPayload>[0]);
}

/** Save a snapshot out as the same JSON the manual export produces. */
export function downloadSnapshot(id: string): boolean {
  const snap = loadSnapshots().find(s => s.id === id);
  if (!snap) return false;
  const blob = new Blob([JSON.stringify(snap.payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `fdmc-backup-${snap.takenAt.slice(0, 10)}-${snap.id}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}

export function deleteSnapshot(id: string): void {
  try {
    window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(loadSnapshots().filter(s => s.id !== id)));
  } catch { /* quota */ }
}

/** Rough size of the ring, so the DM can see what it costs before turning the interval up. */
export function snapshotBytes(): number {
  try { return (window.localStorage.getItem(SNAPSHOT_KEY) ?? "").length; } catch { return 0; }
}
