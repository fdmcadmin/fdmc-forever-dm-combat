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

// ─── Export format ────────────────────────────────────────────────────────────

type ActorLibraryExport = {
  schema: "fdmc.actor-library-export.v1";
  exportedAt: string;
  version: string;
  actors: Record<string, Actor>;
  overrides: ActorOverrideMap;
  equipment: EquipmentItem[];
};

// ─── Export ───────────────────────────────────────────────────────────────────

export function exportActorLibrary(version = "0.6.0"): void {
  const data: ActorLibraryExport = {
    schema: "fdmc.actor-library-export.v1",
    exportedAt: new Date().toISOString(),
    version,
    actors: loadActorLibrary(),
    overrides: loadActorOverrides(),
    equipment: loadEquipmentLibrary(),
  };

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

        resolve({
          ok: true,
          actorCount,
          equipmentCount,
          message: `Imported ${actorCount} actor${actorCount === 1 ? "" : "s"} and ${equipmentCount} equipment item${equipmentCount === 1 ? "" : "s"}.`,
        });

      } catch (err) {
        resolve({ ok: false, actorCount: 0, equipmentCount: 0, message: `Parse error: ${String(err)}` });
      }
    };

    reader.onerror = () => resolve({ ok: false, actorCount: 0, equipmentCount: 0, message: "File read error." });
    reader.readAsText(file);
  });
}
