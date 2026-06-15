import type { Actor } from "../types/actor";
import type { ActorAction } from "../types/tabs";
import { deriveActorStats } from "./deriveActorStats";

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

/** `1d20+N` initiative formula for an actor, N = effective initiative modifier. */
export function initiativeRollFormula(actor: Actor): string {
  const total = getActorInitiativeModifier(actor);
  return `1d20${total >= 0 ? `+${total}` : String(total)}`;
}
