/**
 * ATTUNEMENT — 5e's answer, and it lives in 5e's mod.
 *
 * Three attuned items at once, and a fourth is refused until one comes off. That number is a D&D
 * fact, not an engine fact: `core/equipment/equipRules.ts` owns the question "may this be
 * equipped?" and names no cap at all.
 *
 * ⚠ IT IS EQUIPPED ITEMS THAT HOLD A SLOT. An attuned item sitting in the bag is cargo. That is why
 * the count runs through `isWorn` rather than a local test — the engine owns what "worn" means, so
 * this rule and `deriveActorStats` can never disagree about which items are on.
 */

import type { EquipRule } from "../../core/equipment/equipRules";
import { isWorn } from "../../core/equipment/equipRules";

export const ATTUNEMENT_LIMIT = 3;

/** What the card's "ATTUNED n/3" badge reads. Exported so the number lives in exactly one place. */
export function attunementUsage(equipment: readonly { metadata?: { attunementRequired?: boolean; equipped?: boolean } }[]) {
  const used = equipment.filter(a => a.metadata?.attunementRequired && a.metadata?.equipped !== false).length;
  return { used, limit: ATTUNEMENT_LIMIT, full: used >= ATTUNEMENT_LIMIT };
}

export const attunementRule: EquipRule = ({ actorName, target, equipment }) => {
  if (!target.metadata?.attunementRequired) return null;

  const attuned = equipment.filter(a => a.metadata?.attunementRequired && isWorn(a)).length;
  if (attuned < ATTUNEMENT_LIMIT) return null;

  return {
    rule: "Attunement Full",
    message: `⚠ ${actorName} is already attuned to ${ATTUNEMENT_LIMIT} items — ${target.label} stays unequipped until one is removed.`,
    hint: `Already attuned to ${ATTUNEMENT_LIMIT} items — unequip one first.`,
  };
};
