/**
 * T4 SINGULAR — one per character. The Broken Chain's answer, in the Broken Chain's mod.
 *
 * Christopher, 2026-08-17: *"a t4 per character would be a easy fix because it still takes a
 * attunment slot and we just add a t4=1percharacter."*
 *
 * ⚠ THE TWO CAPS ARE INDEPENDENT. A T4 spends one of 5e's three attunement slots like anything
 * else, AND no character may hold two. One T4 plus two ordinary attuned items is legal and full;
 * one T4 and nothing else still cannot take a second T4. They are separate rules from separate
 * layers, which is exactly why neither belongs in the engine — the engine asks, these answer.
 *
 * The tier ladder is the forge's own, documented in `EquipmentLibraryStandalone`: A1+A1 and A1+A2
 * make Tier 1, A1+A3 / A2+A2 / A2+A3 make Tier 2, A3+A3 reaches Tier 3, and A4 tempered by a
 * Catalyst is Tier 4.
 *
 * ⚠ NO T4 EXISTS IN THE CAMPAIGN LIBRARY YET — it tops out at tier 2. This guards a shape the data
 * has not reached rather than one it currently breaks.
 */

import type { EquipRule } from "../../core/equipment/equipRules";
import { isWorn } from "../../core/equipment/equipRules";

/**
 * The tier field is FREE TEXT in the editor, so "4", "T4" and "Tier 4" all read as a T4.
 *
 * Anchored at the START so "14" and "Tier 3" can never match, but trailing words are allowed
 * because "Tier 4 Singular" is the packet's own phrasing and a DM will write it that way.
 */
export function isT4Singular(tier: string | number | undefined): boolean {
  if (tier === undefined || tier === null) return false;
  return /^\s*(?:t(?:ier)?\s*)?4(?![\d.])/i.test(String(tier));
}

/** What the card reads to badge and disable. One T4, so `full` is simply "you already have one". */
export function singularUsage(equipment: readonly { metadata?: { tier?: string; equipped?: boolean } }[]) {
  const used = equipment.filter(a => isT4Singular(a.metadata?.tier) && a.metadata?.equipped !== false).length;
  return { used, limit: 1, full: used >= 1 };
}

export const singularRule: EquipRule = ({ actorName, target, equipment }) => {
  if (!isT4Singular(target.metadata?.tier)) return null;

  const worn = equipment.filter(a => isT4Singular(a.metadata?.tier) && isWorn(a)).length;
  if (worn < 1) return null;

  return {
    rule: "T4 Limit",
    message: `⚠ ${actorName} already carries a Tier 4 Singular — ${target.label} stays unequipped until that one is removed. One T4 per character, on top of the attunement cap.`,
    hint: "One T4 Singular per character — unequip the one you have first.",
  };
};
