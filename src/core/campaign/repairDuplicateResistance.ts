/**
 * REPAIR — drop the double-counted resistance row from STORED creature copies.
 *
 * ⚠ THE BUILD WAS FIXED AND THE DM'S COPIES WERE NOT, WHICH IS THE WORST HALF TO MISS.
 *
 * 0.7.60.7 removed a defence row that priced a resistance the creature already carried as a typed
 * `damageResponses` entry. Two rows, two different stack groups, so they never deduped and the
 * multiplier applied twice — Quillshrike read 62 effective HP off a 39 HP body.
 *
 * That fix landed in `authored.generated.ts`, which is what SHIPS. It could not reach a creature
 * the DM had already saved their own copy of: a stored copy outranks the shipped template by
 * design, so thirteen creatures kept running the doubled row and the table kept pricing them with
 * it. The build says the bug is fixed; the fight says otherwise.
 *
 * Christopher: *"i should not have to go through and remove each copy to get rid of it [...] how
 * [do i] fix this without having to open[] 10 different encounter and then find the 13 creatures
 * and revert them to library."*
 *
 * He should not, and he does not have to: encounters store only body CHOICES against a templateId,
 * never creature copies, so every affected fight is fixed by repairing the two monster stores. No
 * encounter needs opening.
 *
 * ── WHY THIS IS NOT "REVERT TO LIBRARY" ─────────────────────────────────────────────────────
 * Reverting would throw away every other edit made to those creatures, which is the thing this
 * codebase has already been burned by twice. This removes ONE row and leaves the rest of the
 * stored copy untouched.
 *
 * ── AND WHY IT CANNOT TOUCH A CREATURE THAT LEGITIMATELY HAS ONE ────────────────────────────
 * A row is only removed when ALL of these hold:
 *   1. the stored copy has a counterpart in the SHIPPED library (so it is a campaign creature the
 *      DM edited, not one of their own originals);
 *   2. the row matches the known duplicate signature;
 *   3. the SHIPPED template no longer carries that row.
 *
 * (3) is what makes this self-limiting rather than a blanket rule: the shipped creature is the
 * authority on whether the row belongs, so a creature that is supposed to have one keeps it, and a
 * DM's own creature is never considered at all.
 */

import type { MainMonsterTemplate } from "../monsters/runtime/mainMonsterRuntime";
import { loadMonsterLibrary, saveMonsterLibrary } from "../monsters/dmMonsterLibrary";

const REPAIR_KEY = "fdmc.duplicateResistance.repair.v1";
const REPAIR_VERSION = "0.8.1.1-double-resistance";

/**
 * The row 0.7.60.7 removed. Matched on NAME, with the multiplier as a secondary confirmation —
 * the name is what the authoring wrote and the number is what made it wrong.
 */
const DUPLICATE_NAME = "Resistance - ~50% of opposing damage";
const DUPLICATE_MULTIPLIER = 1.3418341811719772;

/** A structural view of a defence row — matches the real type without re-declaring it. */
type DefenceRow = { name?: string; ehpMultiplier?: number };

function isDuplicateRow(d: DefenceRow): boolean {
  if ((d.name ?? "").trim() !== DUPLICATE_NAME) return false;
  // Absent multiplier still counts: the name alone identifies the authoring that produced it.
  if (typeof d.ehpMultiplier !== "number") return true;
  return Math.abs(d.ehpMultiplier - DUPLICATE_MULTIPLIER) < 1e-6;
}

export type ResistanceRepairReport = {
  /** Creature names that had a row removed, for the DM to see what moved. */
  repaired: string[];
  /** How many rows came out in total. */
  rows: number;
};

export function repairDuplicateResistance(
  bundled: MainMonsterTemplate[],
  force = false,
): ResistanceRepairReport {
  const report: ResistanceRepairReport = { repaired: [], rows: 0 };
  try {
    if (!force && window.localStorage.getItem(REPAIR_KEY) === REPAIR_VERSION) return report;
  } catch { return report; }

  const shipped = new Map(bundled.map(t => [t.templateId, t]));

  for (const owner of ["campaign", "dm"] as const) {
    let changed = false;
    const next = loadMonsterLibrary(owner).map(stored => {
      const ship = shipped.get(stored.templateId);
      if (!ship) return stored;                       // a DM original — not ours to touch

      const defences = stored.stats?.defenses ?? [];
      if (!defences.some(isDuplicateRow)) return stored;

      // (3) — the shipped creature is the authority. If it still carries the row, so may this copy.
      const shippedDefences = ship.stats?.defenses ?? [];
      if (shippedDefences.some(isDuplicateRow)) return stored;

      const kept = defences.filter(d => !isDuplicateRow(d));
      report.rows += defences.length - kept.length;
      report.repaired.push(stored.name);
      changed = true;
      return { ...stored, stats: { ...stored.stats, defenses: kept } };
    });
    if (changed) saveMonsterLibrary(next, owner);
  }

  try { window.localStorage.setItem(REPAIR_KEY, REPAIR_VERSION); } catch { /* ok */ }
  return report;
}

/**
 * How many stored copies still carry the row — without changing anything.
 *
 * For a panel that wants to offer the repair rather than perform it silently, and for a DM who
 * wants to know the answer before agreeing to anything.
 */
export function countDuplicateResistance(bundled: MainMonsterTemplate[]): string[] {
  const shipped = new Map(bundled.map(t => [t.templateId, t]));
  const hits: string[] = [];
  for (const owner of ["campaign", "dm"] as const) {
    for (const stored of loadMonsterLibrary(owner)) {
      const ship = shipped.get(stored.templateId);
      if (!ship) continue;
      const defences = stored.stats?.defenses ?? [];
      const shippedDefences = ship.stats?.defenses ?? [];
      if (defences.some(isDuplicateRow) && !shippedDefences.some(isDuplicateRow)) hits.push(stored.name);
    }
  }
  return hits;
}
