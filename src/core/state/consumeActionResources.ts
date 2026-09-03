/**
 * consumeActionResources
 *
 * Single source of truth for "casting/using an action pulls from its resource pool".
 * Called from every ActorCard render site's onStartCommittedRoll (main app actorToShow
 * + focusedActor, and the actor popout) so spell slots / class-feature uses decrement
 * the same way no matter which card a player is using.
 *
 * Branches (first match wins):
 *   0. action carrying its own item charges → spends that item's pool (magic item, N charges)
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
  /**
   * ⚠ ONE DIE IS SPENT FROM A POOL OF DICE, and an exact substring match cannot see that.
   *
   * The prose names what this USE costs, so it is written singular — "Magic Action; 1 Psionic
   * Energy Die". The pool is named for what it HOLDS, so it is plural — "Psionic Energy Dice".
   * `prose.includes(label)` is false, no resource resolves, and the card does nothing at all when
   * clicked. Christopher: *"half of my pisionic dice do nothing."*
   *
   * Half, precisely: Psionic Strike carries a structured `slotCost` and returns above this line,
   * so it works; both Telekinetic Movement entries name their cost only in prose and were dead.
   * The same trap catches "1 Luck Point" against "Luck Points", "1 Superiority Die" against
   * "Superiority Dice", and every other pool whose singular is not its plural.
   *
   * Matching stays WHOLE-WORD and symmetric — both sides get the same normalisation — so this
   * loosens the spelling and not the meaning. `dice`→`die` is spelled out because it is an
   * irregular this vocabulary genuinely uses in both directions; the trailing-s rule covers the
   * regular cases. The exact match is tried first and unchanged.
   */
  const normalise = (value: string) => value
    .toLowerCase()
    .replace(/\bdice\b/g, "die")
    .replace(/\b(\w{3,}?)s\b/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  const proseNormalised = normalise(prose);
  // Longest label first so "Spell Slots L1" wins over a bare "Spell" style label.
  const candidates = [...resourceLabels]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .filter(label => label.trim().length > 2);
  return candidates.find(label => prose.includes(label.trim().toLowerCase()))
    ?? candidates.find(label => proseNormalised.includes(normalise(label)));
}

export function consumeActionResourcesOnCommit(params: {
  actorId: string;
  actorName: string;
  action: ActorAction;
  consumeSpellSlot: (actorId: string, level: number) => ConsumeResult;
  consumeNamedResource: (actorId: string, label: string) => ConsumeResult;
  /** Spends the action's own item pool. Absent on callers that predate item charges. */
  consumeItemCharge?: (actorId: string, action: ActorAction) => ConsumeResult;
  log: (entry: AddCombatLogEntryInput) => void;
  /** This actor's resource labels — enables the `metadata.cost` prose fallback. */
  resourceLabels?: string[];
  /** Level the spell is actually cast at — the player's upcast pick. Absent = as authored. */
  castLevel?: number;
}): void {
  const { actorId, actorName, action, consumeSpellSlot, consumeNamedResource, consumeItemCharge, log, resourceLabels = [], castLevel } = params;

  // 0. The action carries an item's own charge pool (Gapstep Boots 2 charges, Edge Alignment
  //    Ring 1 charge, a potion). Only itemToAction / itemToAttackAction set metadata.charges,
  //    so this can never collide with a spell or a class feature — and it must run before the
  //    prose scan in branch 3, which could otherwise match an unrelated Resources row on a
  //    word in the item's rules text.
  if (action.metadata?.charges && consumeItemCharge) {
    const r = consumeItemCharge(actorId, action);
    if (r.outcome === "spent") {
      log({ actorName, actionName: action.label, tabId: "equipment", message: `${actorName} expends a charge from ${action.label} (${r.remaining}/${r.max ?? "?"} left).` });
    } else if (r.outcome === "empty") {
      log({ actorName, actionName: action.label, tabId: "equipment", message: `⚠ ${actorName} has no charges left on ${action.label} — used without a charge.` });
    }
    return;
  }

  // 1. Class-feature spell ("freeCast"): spends its dedicated N/long-rest resource
  //    (label = spell name), NOT a spell slot. Must run before the slot branch below.
  /**
   * ⚠ FREE USES AND A SPELL SLOT ARE NOT TWO DIFFERENT SPELLS.
   *
   * Christopher, 2026-08-28: *"just because something is 1 cast per long rest doesnt mean it should
   * need 2 different spells. if it is used at the base level it should consume the free usages,
   * while upcasting it or casting at base level without the free usage would still use the spell
   * slot."*
   *
   * This branch used to spend the free use and RETURN unconditionally, so a `freeCast` spell could
   * never touch a slot — not when upcast, not when its pool was empty. Divine Smite therefore had
   * to be authored twice, once as a class feature and once as a spell, and the two copies drift.
   *
   * The rule, in order:
   *   · UPCAST                        → a slot, always. The free use buys the base casting only.
   *   · BASE LEVEL, uses remaining    → a free use.
   *   · BASE LEVEL, pool empty        → fall through to the slot, if the spell has a level.
   *
   * Falling through is the whole point: the return below happens only when there is no slot to
   * fall back to, which is the one case where "cast without a charge" is still the honest answer.
   */
  if (action.actionKind === "spell" && action.metadata?.spellSlotMode === "freeCast") {
    const authored = action.metadata?.spellLevel ?? 0;
    const upcast = castLevel !== undefined && authored > 0 && castLevel > authored;

    if (!upcast) {
      const r = consumeNamedResource(actorId, action.label);
      if (r.outcome === "spent") {
        log({ actorName, actionName: action.label, tabId: "spells", message: `${actorName} casts ${action.label} (class feature) — ${r.remaining}/${r.max ?? "?"} uses left.` });
        return;
      }
      if (authored <= 0) {
        // No slot to fall back to — the pool was the only source.
        log({ actorName, actionName: action.label, tabId: "spells", message: `⚠ ${actorName} has no ${action.label} uses left — cast without a charge.` });
        return;
      }
      log({ actorName, actionName: action.label, tabId: "spells", message: `${actorName} has no ${action.label} uses left — casting from a spell slot instead.` });
    }
    // Upcast, or the pool is spent: branch 2 takes it from here and spends the slot.
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
