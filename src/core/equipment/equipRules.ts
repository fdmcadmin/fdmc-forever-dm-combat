/**
 * MAY THIS ITEM BE EQUIPPED? — the engine owns the QUESTION, a mod owns the ANSWER.
 *
 * Christopher, 2026-08-28: *"it should still be checked against the standard rules, attunment in
 * the dnd mod and Singular in the BC mod."*
 *
 * ⚠ THIS FILE IS ENGINE. It names no ruleset, no cap and no number. Attunement is 5e's answer and
 * lives in `modules/dnd-5e`; the T4 Singular limit is the Broken Chain's and lives in
 * `modules/the-broken-chain`. Another system's mod would ship neither and the engine would not
 * notice the difference — the same split `contentScope.ts` already draws for content.
 *
 * ── WHY A SEAM AND NOT THREE COPIES ─────────────────────────────────────────────────────────
 * These two caps were written THREE times: once in `ActorCard` to disable the button, once in the
 * GM-side equip handler that performs the write, and NOT AT ALL in `EquipmentBagEditor.attachItem`,
 * which attached items straight onto the sheet already worn. Three surfaces, two of them
 * disagreeing and one silent.
 *
 * RULE 0: **two implementations of one rule will drift, and the second one is always the one that
 * is wrong.** So there is one list of rules, and every surface asks it:
 *
 *   - the WRITER asks because it is the authority and must refuse;
 *   - the CARD asks so the button is disabled before the round trip;
 *   - the BAG EDITOR asks because attaching an item is another way to end up wearing one.
 *
 * The card's answer is a courtesy that saves a round trip. The writer's answer is the rule.
 */

import type { ActorAction } from "../types/tabs";

export type EquipContext = {
  /** Used in the refusal message, so a DM watching the log knows whose sheet refused. */
  actorName: string;
  /** The item being put ON. Rules are only asked about equipping; taking off is always allowed. */
  target: ActorAction;
  /** The actor's whole equipment tab, INCLUDING the target in its current (unequipped) state. */
  equipment: ActorAction[];
};

export type EquipDenial = {
  /** Short label for the combat-log entry, e.g. "Attunement Full". */
  rule: string;
  /** Written for the player: what happened AND how to fix it. */
  message: string;
  /** One line for a disabled control's tooltip, where there is no room for the full message. */
  hint: string;
};

/**
 * A rule returns a denial or null. It must be PURE and cheap — the card calls it during render for
 * every carried item, and the writer calls it again on the way through.
 */
export type EquipRule = (ctx: EquipContext) => EquipDenial | null;

/**
 * ⚠ AN ITEM IN THE BAG HOLDS NOTHING. Every cap counts what is WORN, and this is the test that
 * decides it — the same `equipped !== false` that `deriveActorStats` uses to decide whether an
 * item's bonuses apply. Exported so a mod's rule cannot invent a second answer to "is this on?".
 *
 * The default is EQUIPPED (absent flag = worn), which is why a grant path must pass `false`
 * explicitly rather than leave it off.
 */
export function isWorn(a: ActorAction): boolean {
  return a.metadata?.equipped !== false;
}

/**
 * First denial wins, and the order of `rules` is the order the player is told about.
 *
 * Returning only the first is deliberate: a refusal is an instruction to do one thing, and listing
 * every cap an item trips at once makes the fixable one harder to find.
 */
export function checkEquip(rules: readonly EquipRule[], ctx: EquipContext): EquipDenial | null {
  for (const rule of rules) {
    const denial = rule(ctx);
    if (denial) return denial;
  }
  return null;
}
