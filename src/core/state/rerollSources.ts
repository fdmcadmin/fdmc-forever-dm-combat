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

/**
 * HOW the source changes the roll. Not every "reroll" throws the die again.
 *
 * Christopher, 2026-08-17: *"right now it wouldnt let a feat like lucky 'reroll a roll' or a feat
 * that says use the other side of the dice."*
 *
 *   reroll — throw it again. A NEW random result; Lucky, a Stabilized Band charge.
 *   flip   — use the OTHER SIDE of the die: 21 − natural on a d20, so a 3 becomes 18. Nothing
 *            random happens, so it must never go out as a dice request — the result is already
 *            determined by the roll that was made.
 *
 * Treating a flip as a reroll would send a fresh request and produce an unrelated number, which is
 * the opposite of what the feat says.
 */
export type RerollMethod = "reroll" | "flip";

export type RerollSource = {
  id: string;
  kind: RerollSourceKind;
  label: string;
  /** Read from the source's own text; defaults to a true reroll. */
  method: RerollMethod;
  condition?: string;     // e.g. "cantrip attack or damage roll"
  costLabel?: string;     // e.g. "1 charge", "1/LR", "no cost"
  /** For item sources — the equipment item ID to decrement charge */
  itemId?: string;
  /** For feature sources — the action ID to mark as used */
  featureActionId?: string;
  /** The action id whose charge/use pool this spends — carried so the caller can spend it. */
  spendActionId?: string;
};

/**
 * "Use the other side of the die" versus "roll it again", read from the source's own wording.
 * Anything that does not say otherwise is a true reroll — the common case.
 */
function methodFromText(text: string | undefined): RerollMethod {
  return /\b(other side|opposite (?:side|face)|flip the (?:die|dice))\b/i.test(text ?? "")
    ? "flip"
    : "reroll";
}

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
      // An explicit choice beats reading the prose — see EquipmentEffect.rerollMethod.
      method: item.effect.rerollMethod
        ?? methodFromText(`${item.effect.condition ?? ""} ${item.mechanicsText ?? ""} ${item.description ?? ""}`),
      condition: item.effect.condition,
      costLabel: `${remaining}/${item.charges.max} charge${item.charges.max === 1 ? "" : "s"}`,
      itemId: item.id,
      spendActionId: action.id,
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
      method: (action.metadata?.rerollMethod as RerollMethod | undefined)
        ?? methodFromText(`${action.description ?? ""} ${action.metadata?.details ?? ""}`),
      condition: action.description ?? action.metadata?.details,
      costLabel,
      featureActionId: action.id,
      spendActionId: action.id,
    });
  }

  /**
   * ── DM Approved — always available, and it offers EVERY method ─────────────
   *
   * Christopher, 2026-08-17: *"the DM approve needs to says and then have the other options we
   * have been talking about."* A DM override is not limited to throwing the die again — if a DM
   * can rule a reroll, they can rule that the other side of the die is used. One entry per method
   * so the choice is made in the picker rather than assumed, and the log records WHICH.
   *
   * Costs nothing and spends nothing: it is a ruling, not a resource.
   */
  for (const method of ["reroll", "flip"] as RerollMethod[]) {
    sources.push({
      id: `dm:approved:${method}`,
      kind: "dm",
      label: method === "flip" ? "DM Approved — other side of the die" : "DM Approved — reroll",
      method,
      condition: method === "flip"
        ? "Use the opposite face: 21 − the natural roll. Nothing is re-rolled."
        : "Throw the die again for a new result.",
      costLabel: "no cost",
    });
  }

  return sources;
}
