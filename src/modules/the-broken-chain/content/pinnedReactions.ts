/**
 * ⚠ THE OPPORTUNITY ATTACK MOVED TO CORE (0.7.9.8) and is seeded onto every actor card at
 * render time. It is a rule of the game, not campaign content.
 *
 * What was here before was a second declaration of it plus one named export per character, and
 * NOT ONE of them was ever imported. Every authored actor shipped `pinnedReactions: []`, so the
 * OA row rendered empty on all six characters — the capability existed, the data existed,
 * nothing connected them (RULE ZERO).
 *
 * These re-exports stay so existing imports keep resolving to the ONE definition instead of a
 * copy that can drift. Do not add per-character lists here: an actor that needs its own pinned
 * reaction authors it as a reaction-tab action with `pinReaction`, which
 * `getPinnedReactionShortcuts` already picks up and which overrides the seed.
 */

import { OPPORTUNITY_ATTACK_REACTION, type PinnedReaction } from "../../../core/types/actor";

export const opportunityAttackReaction = OPPORTUNITY_ATTACK_REACTION;

/** Kept for callers that want it explicitly; the card seeds it whether or not this is used. */
export const defaultPlayerPinnedReactions: PinnedReaction[] = [OPPORTUNITY_ATTACK_REACTION];
