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

export function consumeActionResourcesOnCommit(params: {
  actorId: string;
  actorName: string;
  action: ActorAction;
  consumeSpellSlot: (actorId: string, level: number) => ConsumeResult;
  consumeNamedResource: (actorId: string, label: string) => ConsumeResult;
  log: (entry: AddCombatLogEntryInput) => void;
}): void {
  const { actorId, actorName, action, consumeSpellSlot, consumeNamedResource, log } = params;

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

  // 2. Spell with slot level → decrement matching slot resource. Upcasting is
  //    data-authored: the action carries the level it casts at (metadata.spellLevel).
  if (action.actionKind === "spell" && (action.metadata?.spellLevel ?? 0) > 0) {
    const lvl = action.metadata?.spellLevel ?? 1;
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
  const slotCost = action.metadata?.slotCost?.trim();
  if (slotCost && slotCost !== "Cantrip" && slotCost !== "No Slot" && !slotCost.startsWith("L")) {
    const r = consumeNamedResource(actorId, slotCost);
    if (r.outcome === "spent") {
      log({ actorName, actionName: action.label, tabId: "resources", message: `${actorName} uses ${r.label ?? slotCost} (${r.remaining}/${r.max ?? "?"} left).` });
    } else if (r.outcome === "empty") {
      log({ actorName, actionName: action.label, tabId: "resources", message: `⚠ ${actorName} is out of ${r.label ?? slotCost} — ${action.label} used without a charge.` });
    }
  }
}
