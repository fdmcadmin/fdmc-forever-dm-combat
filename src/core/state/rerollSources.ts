/**
 * Reroll source system
 *
 * Scans an actor for all available reroll sources:
 *   - Equipment items with effect.type === "reroll" and charges remaining
 *   - Class features/actions tagged with "reroll"
 *   - DM Approved (always available, no resource consumed)
 *
 * Used by the RerollSourcePicker in CommittedRollPanel.
 */

import type { Actor } from "../types/actor";
import type { EquipmentItem } from "../ui/EquipmentBagEditor";
import { loadEquipmentLibrary } from "../ui/EquipmentBagEditor";
import { loadActorLibrary } from "../seats/dmActorLibrary";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RerollSourceKind = "item" | "feature" | "dm";

export type RerollSource = {
  id: string;
  kind: RerollSourceKind;
  label: string;
  condition?: string;     // e.g. "cantrip attack or damage roll"
  costLabel?: string;     // e.g. "1 charge", "1/LR", "no cost"
  /** For item sources — the equipment item ID to decrement charge */
  itemId?: string;
  /** For feature sources — the action ID to mark as used */
  featureActionId?: string;
};

// ─── Scanner ─────────────────────────────────────────────────────────────────

/**
 * Get all available reroll sources for an actor.
 * chargesRemaining: map of itemId → current remaining charges (from resource counter state)
 * usedFeatureIds: set of action IDs already used this turn/rest
 */
export function getRerollSources(
  actor: Actor,
  chargesRemaining: Record<string, number> = {},
  usedFeatureIds: Set<string> = new Set(),
): RerollSource[] {
  const sources: RerollSource[] = [];
  const equipmentLibrary = loadEquipmentLibrary();

  // ── Scan equipped items ───────────────────────────────────────────────────
  const equippedActions = actor.tabs.equipment ?? [];
  for (const action of equippedActions) {
    // Match to library item by stripping "equip-" prefix
    const itemId = action.id.replace(/^equip-/, "");
    const item = equipmentLibrary.find(i => i.id === itemId || i.id === `bc-equip-${itemId}` || action.id === `equip-${i.id}`);

    if (!item?.effect || item.effect.type !== "reroll") continue;
    if (!item.charges) continue;

    const remaining = chargesRemaining[action.id] ?? chargesRemaining[item.id] ?? item.charges.max;
    if (remaining <= 0) continue;

    sources.push({
      id: `item:${item.id}`,
      kind: "item",
      label: item.name,
      condition: item.effect.condition,
      costLabel: `${remaining}/${item.charges.max} charge${item.charges.max === 1 ? "" : "s"}`,
      itemId: item.id,
    });
  }

  // ── Scan class features / actions tagged "reroll" ─────────────────────────
  const allActions = [
    ...Object.values(actor.tabs).flat(),
  ];

  for (const action of allActions) {
    const hasRerollTag = action.tags?.includes("reroll");
    const hasRerollAdditive = action.metadata?.additive === "reroll";
    if (!hasRerollTag && !hasRerollAdditive) continue;
    if (usedFeatureIds.has(action.id)) continue;

    const costLabel = action.metadata?.cost ?? "1 use";
    sources.push({
      id: `feature:${action.id}`,
      kind: "feature",
      label: action.label,
      condition: action.description ?? action.metadata?.details,
      costLabel,
      featureActionId: action.id,
    });
  }

  // ── DM Approved — always available ───────────────────────────────────────
  sources.push({
    id: "dm:approved",
    kind: "dm",
    label: "DM Approved",
    costLabel: "no cost",
  });

  return sources;
}
