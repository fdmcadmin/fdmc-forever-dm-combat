/**
 * AUTHORED CAMPAIGN CONTENT — GENERATED FILE. DO NOT EDIT BY HAND.
 *
 * Written by `scripts/fold-authoring.mjs` from an author export produced in the app
 * (DM panel → Export campaign authoring). Hand edits are lost on the next fold.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The base library is CODE. A browser extension cannot write its own source, so content
 * authored in the app previously had nowhere to go but `localStorage`, where it belonged to
 * one browser and died with a cleared cache. Authoring a whole act that way loses the act.
 *
 * This file closes the loop WITHOUT letting a generated blob rewrite hand-written source:
 * the bundled libraries stay authored by hand, this file is regenerated wholesale, and the
 * two are merged by id at module load. An author edit to a bundled creature replaces it; a
 * new creature is appended; nothing hand-written is ever rewritten by a tool.
 *
 * PROVENANCE, NOT PROTECTION
 * --------------------------
 * `AUTHORED_DIGEST` fingerprints the content below as it shipped. It exists so a local copy
 * claiming to BE campaign content can be checked against what was actually published — see
 * `verifyCampaignProvenance`. It is not DRM and cannot be: anything running in a browser can
 * be edited by the person running it. What it does guarantee is that a local edit cannot
 * PASS AS authored campaign content, and that no local edit reaches anyone else — the
 * canonical library is whatever is in the build, and only the author can push a build.
 */

import type { MainMonsterTemplate } from "../../core/monsters/runtime/mainMonsterRuntime";
import type { EquipmentItem } from "../../core/ui/EquipmentBagEditor";

/** Creatures authored in-app. Replaces a bundled creature by templateId, or adds a new one. */
export const AUTHORED_MONSTERS: MainMonsterTemplate[] = [];

/** Equipment authored in-app — including unpicked Gift chassis. Replaces or adds by id. */
export const AUTHORED_EQUIPMENT: EquipmentItem[] = [];

/** Fingerprint of the two arrays above, as published. Empty when nothing is authored. */
export const AUTHORED_DIGEST = "";

/** When the fold script last wrote this file. */
export const AUTHORED_AT = "";

/**
 * Merge authored content over a bundled list by id.
 *
 * Authored entries WIN for their own id — that is the point of authoring — and anything the
 * author has not touched is left exactly as the hand-written source has it. Order is stable:
 * bundled entries keep their position, genuinely new ones are appended.
 */
export function mergeAuthored<T>(bundled: T[], authored: T[], idOf: (item: T) => string): T[] {
  if (authored.length === 0) return bundled;
  const overrides = new Map(authored.map(a => [idOf(a), a]));
  const merged = bundled.map(b => overrides.get(idOf(b)) ?? b);
  const bundledIds = new Set(bundled.map(idOf));
  return [...merged, ...authored.filter(a => !bundledIds.has(idOf(a)))];
}
