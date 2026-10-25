import type { Actor } from "../types/actor";
import type { ActorAction } from "../types/tabs";
import { deriveActorStats } from "./deriveActorStats";
// Advantage is 2d20kh1 — ONE helper owns that notation; see RULE 0.
import { applyAdvantage } from "../dice/diceFormula";

// ─── Initiative modifier — single source of truth ───────────────────────────────
// Used by both the actor card's roll button (initiativeRollFormula) and the combat
// tracker's auto-roll (buildCombatants). Keep these in lockstep — divergence is how
// the tracker ended up rolling 1d20+0 for players while the card rolled correctly.

/**
 * Sum of explicitly-entered initiative bonuses across every tab
 * (`metadata.initiativeBonus`). Value comes ONLY from what the player/DM entered —
 * no hardcoded feat names or ruleset assumptions. Alert, etc. live here.
 */
export function getActorTraitInitiativeBonus(actor: Actor): number {
  return (Object.values(actor.tabs).flat() as ActorAction[]).reduce((total, action) => {
    const bonus = (action.metadata as { initiativeBonus?: number } | undefined)?.initiativeBonus;
    return typeof bonus === "number" && Number.isFinite(bonus) ? total + bonus : total;
  }, 0);
}

/**
 * Effective initiative modifier: derived DEX modifier (equipment + drain aware) plus
 * any trait initiative bonuses (Alert and friends).
 */
export function getActorInitiativeModifier(actor: Actor): number {
  return deriveActorStats(actor).dex.modifier + getActorTraitInitiativeBonus(actor);
}

/**
 * Does anything on this sheet grant ADVANTAGE on Initiative?
 *
 * Read from `metadata.initiativeAdvantage` on any row, the same way `initiativeBonus` is summed:
 * value comes only from what was entered, with no hardcoded feature names. A permanent grant
 * lives here; a one-off (a spell cast before the fight) is passed per roll instead — see the
 * `advantage` argument below.
 */
export function getActorInitiativeAdvantage(actor: Actor): boolean {
  return (Object.values(actor.tabs).flat() as ActorAction[]).some(action =>
    (action.metadata as { initiativeAdvantage?: boolean } | undefined)?.initiativeAdvantage === true);
}

/**
 * `1d20+N` initiative formula for an actor, N = effective initiative modifier.
 *
 * ⚠ ADVANTAGE IS AN OR, NOT AN OVERRIDE. A sheet that permanently grants it keeps it even when
 * the caller passes nothing, and a situational grant (the toggle beside the roll) can turn it on
 * for a character whose sheet does not. Nothing can turn a standing grant OFF by omission.
 */
export function initiativeRollFormula(actor: Actor, advantage = false): string {
  const total = getActorInitiativeModifier(actor);
  const flat = `1d20${total >= 0 ? `+${total}` : String(total)}`;
  return (advantage || getActorInitiativeAdvantage(actor)) ? applyAdvantage(flat, "adv") : flat;
}
