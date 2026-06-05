import type { PinnedReaction } from "../../../core/types/actor";

export const opportunityAttackReaction: PinnedReaction = {
  id: "opportunity-attack",
  label: "Opportunity Attack",
  description: "Reaction attack when a creature leaves reach.",
};

export const defaultPlayerPinnedReactions: PinnedReaction[] = [opportunityAttackReaction];

export const mavikPinnedReactions: PinnedReaction[] = [opportunityAttackReaction];

export const leedragoonPinnedReactions: PinnedReaction[] = [opportunityAttackReaction];

export const thaylaPinnedReactions: PinnedReaction[] = [opportunityAttackReaction];

export const lyriellePinnedReactions: PinnedReaction[] = [opportunityAttackReaction];

export const faelarPinnedReactions: PinnedReaction[] = [];

export const vaelithPinnedReactions: PinnedReaction[] = [opportunityAttackReaction];
