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
import { safeStorage } from "../utils/safeStorage";

/** Deliberately absent from PARTY_LOCAL_KEYS in wipePartyData.ts — a wipe must not eat the backups. */
const SNAPSHOT_KEY = "fdmc.backup.snapshots.v1";
const SETTINGS_KEY = "fdmc.backup.settings.v1";

/**
 * Three: enough to step back past a bad import, small enough that the whole ring stays a
 * modest package. Each snapshot is a full export payload — every actor, every tab, every
 * wallet — so depth costs real bytes against the storage quota, and a fourth copy of a party
 * buys very little over the third.
 *
 * Exported so the panel can state the depth it actually has instead of carrying its own copy
 * of the number and drifting from it.
 */
export const MAX_SNAPSHOTS = 3;

export type BackupTrigger = "manual" | "session-start" | "session-end" | "interval" | "before-restore" | "before-wipe";

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
   * session  — one snapshot when the DM CLOSES the tools, and only if something changed.
   *            Covers the case that actually bites: a wipe-and-reimport gone wrong.
   * interval — session, plus every `intervalMinutes` while the panel is open.
   */
  mode: "off" | "session" | "interval";
  intervalMinutes: number;
};

const DEFAULT_SETTINGS: BackupSettings = { mode: "session", intervalMinutes: 30 };

export function loadBackupSettings(): BackupSettings {
  try {
    const raw = safeStorage().getItem(SETTINGS_KEY);
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
  try { safeStorage().setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* quota */ }
}

export function loadSnapshots(): BackupSnapshot[] {
  try {
    const raw = safeStorage().getItem(SNAPSHOT_KEY);
    const list = raw ? JSON.parse(raw) as BackupSnapshot[] : [];
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

/**
 * Take a snapshot. Returns null when there is nothing worth keeping — an empty library
 * would otherwise push a real backup out of the ring.
 */
/**
 * Is the party actually different from the newest snapshot?
 *
 * The ring is only three deep, so a backup that changes nothing is not free — it evicts a real
 * one.
 * Opening the tools twice in a session used to burn two slots on identical copies, and the
 * snapshot you actually wanted could be pushed off the end by the noise.
 *
 * `exportedAt` is stamped at build time and moves on every call, so it is excluded — comparing
 * it would make every payload "different" and defeat the whole check.
 */
function payloadDiffers(a: unknown, b: unknown): boolean {
  const strip = (p: unknown) => {
    if (!p || typeof p !== "object") return JSON.stringify(p);
    const { exportedAt: _drop, ...rest } = p as Record<string, unknown>;
    return JSON.stringify(rest);
  };
  return strip(a) !== strip(b);
}

/**
 * Snapshot only if something moved. Returns null when the party is byte-identical to the
 * newest snapshot — the caller can treat that as "nothing to do", not as a failure.
 */
export function takeSnapshotIfChanged(
  version: string,
  wallets: Record<string, Coins>,
  trigger: BackupTrigger = "manual",
): BackupSnapshot | null {
  const payload = buildExportPayload(version, wallets);
  if (Object.keys(payload.actors ?? {}).length === 0) return null;
  const newest = loadSnapshots()[0];
  if (newest && !payloadDiffers(payload, newest.payload)) return null;
  return takeSnapshot(version, wallets, trigger);
}

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
    safeStorage().setItem(SNAPSHOT_KEY, JSON.stringify(next));
  } catch {
    // Over quota — keep the two most recent rather than losing the ring entirely.
    try { safeStorage().setItem(SNAPSHOT_KEY, JSON.stringify(next.slice(0, 2))); } catch { return null; }
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
    safeStorage().setItem(SNAPSHOT_KEY, JSON.stringify(loadSnapshots().filter(s => s.id !== id)));
  } catch { /* quota */ }
}

/** Rough size of the ring, so the DM can see what it costs before turning the interval up. */
export function snapshotBytes(): number {
  try { return (safeStorage().getItem(SNAPSHOT_KEY) ?? "").length; } catch { return 0; }
}

// ─── Wallet mirror ────────────────────────────────────────────────────────────

/**
 * A local copy of every purse, kept because coin has NO other local home.
 *
 * Actors, gear and spells live in localStorage; coin lives only in room metadata. That is
 * why a lost room can hand back a party whose ids match and whose actions all work, with
 * every wallet at zero — there was nothing local to restore from. Christopher hit exactly
 * this. The snapshot ring covers it only if a snapshot happened to be taken first; this
 * mirror is always current.
 *
 * It is a RECOVERY copy, never a source of truth: the GM still writes room state, and the
 * mirror is only read back on an explicit restore.
 */
const WALLET_MIRROR_KEY = "fdmc.backup.wallets.v1";

export type WalletMirror = { savedAt: string; wallets: Record<string, Coins> };

/** Cheap enough to call on every room-state change — it only writes when something moved. */
export function mirrorWallets(wallets: Record<string, Coins>): void {
  try {
    const held = Object.fromEntries(
      Object.entries(wallets).filter(([, c]) => Object.values(c).some(v => (v ?? 0) > 0)),
    );
    if (Object.keys(held).length === 0) return;   // never overwrite a good mirror with nothing
    const prev = safeStorage().getItem(WALLET_MIRROR_KEY);
    const next: WalletMirror = { savedAt: new Date().toISOString(), wallets: held };
    if (prev) {
      const parsed = JSON.parse(prev) as WalletMirror;
      if (JSON.stringify(parsed.wallets) === JSON.stringify(held)) return;
    }
    safeStorage().setItem(WALLET_MIRROR_KEY, JSON.stringify(next));
  } catch { /* quota or bad JSON — the ring is still the backstop */ }
}

export function loadWalletMirror(): WalletMirror | null {
  try {
    const raw = safeStorage().getItem(WALLET_MIRROR_KEY);
    return raw ? JSON.parse(raw) as WalletMirror : null;
  } catch { return null; }
}
