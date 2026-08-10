/**
 * Actor Library Export / Import
 *
 * Export: downloads fdmc.dm.actorLibrary.v1 + overrides as a private JSON file.
 * Import: reads that file back and writes to localStorage.
 *
 * The bundle never contains actor data. The DM keeps their own backup file.
 * Any device, any session: import the file and the full party is ready.
 */

import type { Actor } from "../types/actor";
import type { ActorOverrideMap } from "../table-state/actorHydrationBoundary";
import { loadActorLibrary, loadActorOverrides, saveActorLibrary, saveActorOverride } from "./dmActorLibrary";
import { loadEquipmentLibrary, saveEquipmentLibrary, type EquipmentItem } from "../ui/EquipmentBagEditor";
import type { Coins } from "../currency/currency";

// ─── Export format ────────────────────────────────────────────────────────────

type ActorLibraryExport = {
  schema: "fdmc.actor-library-export.v1";
  exportedAt: string;
  version: string;
  actors: Record<string, Actor>;
  overrides: ActorOverrideMap;
  equipment: EquipmentItem[];
  /**
   * Each actor's purse, keyed by actor id.
   *
   * Coin is the one piece of character state that does NOT live in localStorage — it is
   * room metadata, written by the GM. That meant a wipe-and-reimport restored the sheets,
   * the gear and the spells, and silently returned every character to zero gold. The wallet
   * has to travel with the backup or the backup isn't one.
   */
  wallets?: Record<string, Coins>;
};

// ─── Export ───────────────────────────────────────────────────────────────────

/**
 * @param wallets Per-actor purses read from the live room state. The caller supplies them
 *   because this module deliberately knows nothing about room metadata.
 */
/**
 * Build the backup payload.
 *
 * Shared by the download and the in-browser snapshot ring deliberately: a snapshot IS an
 * export file, so a rolling backup can be handed straight to the importer, and two
 * serializers can never drift apart.
 */
export function buildExportPayload(version = "0.6.0", wallets?: Record<string, Coins>): ActorLibraryExport {
  return {
    schema: "fdmc.actor-library-export.v1",
    exportedAt: new Date().toISOString(),
    version,
    actors: loadActorLibrary(),
    overrides: loadActorOverrides(),
    equipment: loadEquipmentLibrary(),
    ...(wallets && Object.keys(wallets).length ? { wallets } : {}),
  };
}

/** Write a payload back into local storage. Returns what landed, wallets included. */
export function applyExportPayload(data: Partial<ActorLibraryExport>): ImportResult {
  if (data.schema !== "fdmc.actor-library-export.v1") {
    return { ok: false, actorCount: 0, equipmentCount: 0, message: `Unrecognised schema: ${data.schema ?? "none"}. Expected fdmc.actor-library-export.v1.` };
  }
  const actors = data.actors ?? {};
  const overrides = data.overrides ?? {};
  const equipment = data.equipment ?? [];

  saveActorLibrary({ ...loadActorLibrary(), ...actors });
  for (const [id, override] of Object.entries(overrides)) {
    if (override) saveActorOverride(id, override as Partial<Actor>);
  }
  // Merge, never replace — the equipment library is shared with the campaign module and
  // the base weapons, and a wholesale write has wiped co-residents before.
  const equipMap = new Map(loadEquipmentLibrary().map(e => [e.id, e]));
  for (const item of equipment) equipMap.set(item.id, item);
  saveEquipmentLibrary(Array.from(equipMap.values()));

  const actorCount = Object.keys(actors).length;
  const equipmentCount = equipment.length;
  const wallets = data.wallets ?? {};
  const walletCount = Object.keys(wallets).length;
  return {
    ok: true, actorCount, equipmentCount, wallets,
    // Name the wallets explicitly. A backup taken before wallets were exported restores
    // silently at zero gold, and the DM should see that rather than find out in play.
    message: `Restored ${actorCount} actor${actorCount === 1 ? "" : "s"} and ${equipmentCount} equipment item${equipmentCount === 1 ? "" : "s"}`
      + (walletCount ? `, and ${walletCount} purse${walletCount === 1 ? "" : "s"}.` : ". No wallets in this file — coin was not restored."),
  };
}
export function exportActorLibrary(version = "0.6.0", wallets?: Record<string, Coins>): void {
  const data = buildExportPayload(version, wallets);

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `fdmc-actor-library-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Import ───────────────────────────────────────────────────────────────────

export type ImportResult = {
  ok: boolean;
  actorCount: number;
  equipmentCount: number;
  message: string;
  /**
   * Purses read back out of the file. Returned rather than written, because coin is room
   * metadata and only the GM writes that — the caller applies these through the normal
   * room-state commit.
   */
  wallets?: Record<string, Coins>;
};

export function importActorLibrary(file: File): Promise<ImportResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const raw = JSON.parse(e.target?.result as string) as unknown;

        if (!raw || typeof raw !== "object") {
          resolve({ ok: false, actorCount: 0, equipmentCount: 0, message: "Invalid file format." });
          return;
        }

        const data = raw as Partial<ActorLibraryExport>;

        if (data.schema !== "fdmc.actor-library-export.v1") {
          resolve({ ok: false, actorCount: 0, equipmentCount: 0, message: `Unrecognised schema: ${data.schema ?? "none"}. Expected fdmc.actor-library-export.v1.` });
          return;
        }

        const actors = data.actors ?? {};
        const overrides = data.overrides ?? {};
        const equipment = data.equipment ?? [];

        // Write actors
        const currentLibrary = loadActorLibrary();
        const mergedLibrary = { ...currentLibrary, ...actors };
        saveActorLibrary(mergedLibrary);

        // Write overrides
        for (const [id, override] of Object.entries(overrides)) {
          if (override) saveActorOverride(id, override as Partial<Actor>);
        }

        // Write equipment — merge, don't replace
        const currentEquip = loadEquipmentLibrary();
        const equipMap = new Map(currentEquip.map(e => [e.id, e]));
        for (const item of equipment) {
          equipMap.set(item.id, item);
        }
        saveEquipmentLibrary(Array.from(equipMap.values()));

        const actorCount = Object.keys(actors).length;
        const equipmentCount = equipment.length;
        const wallets = data.wallets ?? {};
        const walletCount = Object.keys(wallets).length;

        resolve({
          ok: true,
          actorCount,
          equipmentCount,
          wallets,
          // Name the wallets explicitly. A backup taken before wallets were exported restores
          // silently at zero gold, and the DM should see that rather than discover it in play.
          message: `Imported ${actorCount} actor${actorCount === 1 ? "" : "s"} and ${equipmentCount} equipment item${equipmentCount === 1 ? "" : "s"}`
            + (walletCount ? `, and ${walletCount} purse${walletCount === 1 ? "" : "s"}.` : ". No wallets in this file — coin was not restored."),
        });

      } catch (err) {
        resolve({ ok: false, actorCount: 0, equipmentCount: 0, message: `Parse error: ${String(err)}` });
      }
    };

    reader.onerror = () => resolve({ ok: false, actorCount: 0, equipmentCount: 0, message: "File read error." });
    reader.readAsText(file);
  });
}
