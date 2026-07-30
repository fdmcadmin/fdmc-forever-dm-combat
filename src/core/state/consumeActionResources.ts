/**
 * consumeActionResources
 *
 * Single source of truth for "casting/using an action pulls from its resource pool".
 * Called from every ActorCard render site's onStartCommittedRoll (main app actorToShow
 * + focusedActor, and the actor popout) so spell slots / class-feature uses decrement
 * the same way no matter which card a player is using.
 *
 * Branches (first match wins):
 *   1. freeCast class-feature spell → spends its named N/long-rest resource (label = spell name)
 *   2. levelled spell (spellLevel > 0) → spends the matching spell-slot resource for that level
 *   3. any action with a named slotCost → spends that named resource (Channel Divinity, Rage, …)
 */

import type { ActorAction } from "../types/tabs";
import type { AddCombatLogEntryInput } from "../types/combatLog";
import type { ConsumeResult } from "./useResourceCounterState";

/**
 * The named pool an action spends, or undefined when it names none.
 *
 * Prefers the machine field `metadata.slotCost`. When that is absent it falls back to
 * scanning the human `metadata.cost` prose for one of the actor's own resource labels —
 * sheets overwhelmingly author the cost as text ("Bonus Action; 1 Channel Divinity",
 * "Bonus Action; 1 Second Wind use") and leave slotCost null, which left Lay on Hands,
 * Channel Divinity, Rage, Second Wind and Action Surge linked to nothing: clicking them
 * spent no charge and (being logMode "silent") gave no feedback at all.
 *
 * The fallback only fires on an actual label match against THIS actor's resources, so it
 * can never invent a pool that isn't on the sheet.
 */
export function resolveNamedResourceCost(
  action: ActorAction,
  resourceLabels: string[],
): string | undefined {
  const slotCost = action.metadata?.slotCost?.trim();
  if (slotCost && slotCost !== "Cantrip" && slotCost !== "No Slot" && !/^L\d/i.test(slotCost)) {
    return slotCost;
  }
  if (slotCost) return undefined; // an explicit Cantrip / No Slot / L1 is not a named pool

  const prose = action.metadata?.cost?.trim().toLowerCase();
  if (!prose) return undefined;
  // Longest label first so "Spell Slots L1" wins over a bare "Spell" style label.
  const match = [...resourceLabels]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .find(label => label.trim().length > 2 && prose.includes(label.trim().toLowerCase()));
  return match;
}

export function consumeActionResourcesOnCommit(params: {
  actorId: string;
  actorName: string;
  action: ActorAction;
  consumeSpellSlot: (actorId: string, level: number) => ConsumeResult;
  consumeNamedResource: (actorId: string, label: string) => ConsumeResult;
  log: (entry: AddCombatLogEntryInput) => void;
  /** This actor's resource labels — enables the `metadata.cost` prose fallback. */
  resourceLabels?: string[];
  /** Level the spell is actually cast at — the player's upcast pick. Absent = as authored. */
  castLevel?: number;
}): void {
  const { actorId, actorName, action, consumeSpellSlot, consumeNamedResource, log, resourceLabels = [], castLevel } = params;

  // 1. Class-feature spell ("freeCast"): spends its dedicated N/long-rest resource
  //    (label = spell name), NOT a spell slot. Must run before the slot branch below.
  if (action.actionKind === "spell" && action.metadata?.spellSlotMode === "freeCast") {
    const r = consumeNamedResource(actorId, action.label);
    if (r.outcome === "spent") {
      log({ actorName, actionName: action.label, tabId: "spells", message: `${actorName} casts ${action.label} (class feature) — ${r.remaining}/${r.max ?? "?"} uses left.` });
    } else if (r.outcome === "empty") {
      log({ actorName, actionName: action.label, tabId: "spells", message: `⚠ ${actorName} has no ${action.label} uses left — cast without a charge.` });
    }
    return;
  }

  // 2. Spell with slot level → decrement matching slot resource. The level comes from the
  //    card's upcast picker when the player chose one, and falls back to the level the
  //    action was authored at. A pick below the spell's own level is not castable.
  if (action.actionKind === "spell" && (action.metadata?.spellLevel ?? 0) > 0) {
    const authored = action.metadata?.spellLevel ?? 1;
    const lvl = castLevel !== undefined && castLevel >= authored ? castLevel : authored;
    const r = consumeSpellSlot(actorId, lvl);
    if (r.outcome === "spent") {
      log({ actorName, actionName: action.label, tabId: "spells", message: `${actorName} casts ${action.label} — expends a Level ${lvl} slot (${r.remaining}/${r.max ?? "?"} left).` });
    } else if (r.outcome === "empty") {
      log({ actorName, actionName: action.label, tabId: "spells", message: `⚠ ${actorName} has no Level ${lvl} slots left for ${action.label} — cast not slot-backed.` });
    }
    return;
  }

  // 3. Any action with a slotCost that references a named resource
  //    (Channel Divinity, Rage, Bardic Inspiration, Fury of the Gods, …).
  //    Skip spell-slot level tokens ("L1", "L2", …) — those are handled by branch 2 —
  //    but NOT named resources that merely start with L (Lay on Hands, Luck, …).
  const slotCost = resolveNamedResourceCost(action, resourceLabels);
  if (slotCost) {
    const r = consumeNamedResource(actorId, slotCost);
    if (r.outcome === "spent") {
      log({ actorName, actionName: action.label, tabId: "resources", message: `${actorName} uses ${r.label ?? slotCost} (${r.remaining}/${r.max ?? "?"} left).` });
    } else if (r.outcome === "empty") {
      log({ actorName, actionName: action.label, tabId: "resources", message: `⚠ ${actorName} is out of ${r.label ?? slotCost} — ${action.label} used without a charge.` });
    }
  }
}
