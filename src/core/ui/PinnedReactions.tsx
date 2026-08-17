import type { PinnedReaction } from "../types/actor";
import { actionCostLabels } from "../types/actionEconomy";
import type { ActionCost, ActorActionEconomyState } from "../types/actionEconomy";
import type { CommittedRollOutcomeMode, CommittedRollState } from "../types/committedRoll";
import type { ReadiedRollCandidate } from "./CommittedRollPanel";

type PinnedReactionsProps = {
  actorName: string;
  reactions: PinnedReaction[];
  actionState: ActorActionEconomyState;
  committedRoll: CommittedRollState | null;
  resolvedReadiedKeys: string[];
  usedCostSlots: ActionCost[];
  onUseReaction: (reaction: PinnedReaction) => void;
  onUnreadyReaction: (reaction: PinnedReaction) => void;
  /** The actor weapon attacks an Opportunity Attack may be made WITH. */
  weaponAttacks?: { id: string; label: string }[];
  /** Ready that weapon action on the REACTION slot — the same action, spent off-turn. */
  onUseWeaponAsReaction?: (actionId: string) => void;
  onCommitRoll: (candidate: ReadiedRollCandidate) => void;
};

function getReadiedKey(reactionId: string) {
  return `pinned:${reactionId}`;
}

function inferPinnedOutcomeMode(reaction: PinnedReaction): CommittedRollOutcomeMode {
  const searchableText = `${reaction.label} ${reaction.description ?? ""}`;

  if (/\battack\b/i.test(searchableText)) {
    return "attack-roll";
  }

  if (/\b(?:save|saving throw|dc\s*\d+|\w+\s+dc\s*\d+)\b/i.test(searchableText)) {
    return "dc-check";
  }

  return "triggered";
}

function rollButtonLabelForMode(mode: CommittedRollOutcomeMode) {
  if (mode === "dc-check") {
    return "Check";
  }

  if (mode === "triggered") {
    return "Trigger";
  }

  return "Roll";
}

export function PinnedReactions({
  actorName,
  reactions,
  weaponAttacks,
  onUseWeaponAsReaction,
  actionState,
  committedRoll,
  resolvedReadiedKeys,
  usedCostSlots,
  onUseReaction,
  onUnreadyReaction,
  onCommitRoll,
}: PinnedReactionsProps) {
  if (reactions.length === 0) {
    return null;
  }

  return (
    <section className="card-section">
      <h3 className="section-heading">Pinned Reactions / References</h3>
      <div className="pinned-grid">
        {reactions.map((reaction) => {
          const readiedKey = getReadiedKey(reaction.id);
          const readied = actionState.reaction === readiedKey;
          const resolved = resolvedReadiedKeys.includes(readiedKey) || usedCostSlots.includes("reaction");
          const committed = committedRoll?.readiedKey === readiedKey;
          const commitBlocked = Boolean(committedRoll && committedRoll.readiedKey !== readiedKey);
          const willSwap = Boolean(actionState.reaction && !readied);
          const outcomeMode = inferPinnedOutcomeMode(reaction);

          return (
            <div className={`action-button-shell ${readied ? "readied-shell" : ""} ${resolved ? "resolved-shell" : ""}`} key={reaction.id}>
              <button
                className={`action-button ${readied ? "readied" : ""} ${resolved ? "resolved-action" : ""} ${committed ? "committed-action" : ""} ${willSwap ? "swap-warning" : ""}`}
                type="button"
                aria-disabled={resolved}
                onClick={() => {
                  if (resolved) {
                    return;
                  }

                  onUseReaction(reaction);
                }}
                onContextMenu={(event) => {
                  if (resolved || !readied) {
                    return;
                  }

                  event.preventDefault();
                  onUnreadyReaction(reaction);
                }}
              >
                <span className="action-label-row">
                  <span className="action-label">{reaction.label}</span>
                  <span className="action-cost-tags">
                    <span className="action-cost-tag">{actionCostLabels.reaction}</span>
                  </span>
                </span>
                {reaction.description && <span className="action-description">{reaction.description}</span>}
                {committed && <span className="action-description readied-text">Roll active — resolve or reset the roll panel.</span>}
                {readied && !committed && <span className="action-description readied-text">Readied — use {rollButtonLabelForMode(outcomeMode)} below or right-click to unready.</span>}
                {resolved && <span className="action-description resolved-text">Used — reset before using again.</span>}
                {willSwap && !readied && !resolved && (
                  <span className="action-description warning-text">
                    {actorName} already has a Reaction readied. Clicking {reaction.label} will swap the readied Reaction.
                  </span>
                )}
              </button>

              {/* ⚠ AN OPPORTUNITY ATTACK IS A WEAPON ATTACK, so it has to offer the weapons.
                  Christopher, 2026-08-17: *"clicking a OA should open up any of the weapon attack
                  actions to be used (this is like a rider that will allow an off turn attack)."*

                  The OA carried no dice of its own, so its Roll button rolled nothing — it was a
                  declaration and no more. These buttons ready the ACTUAL weapon action on the
                  REACTION slot, so the swing uses that weapon's real to-hit and damage, scales
                  with the character, and honours whatever is armed on it. Nothing is duplicated;
                  the same action is simply spent off-turn.

                  Only for a reaction with no authored source — an authored reaction already has
                  its own dice and does not need a weapon picked for it. */}
              {!reaction.sourceActionId && (weaponAttacks?.length ?? 0) > 0 && !resolved && (
                <div className="pinned-weapon-row" style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: "2px 0" }}>
                  {weaponAttacks!.map(weapon => (
                    <button
                      key={weapon.id}
                      type="button"
                      className="inline-commit-button"
                      title={`Make an ${reaction.label} with ${weapon.label} — readies it on the Reaction slot with its own attack and damage`}
                      onClick={() => onUseWeaponAsReaction?.(weapon.id)}
                    >
                      ⚔ {weapon.label}
                    </button>
                  ))}
                </div>
              )}

              {readied && !committed && !commitBlocked && (
                <button
                  className="inline-commit-button"
                  type="button"
                  onClick={() =>
                    onCommitRoll({
                      readiedKey,
                      actionLabel: reaction.label,
                      costs: ["reaction"],
                      outcomeMode,
                    })
                  }
                >
                  {rollButtonLabelForMode(outcomeMode)}
                </button>
              )}
              {readied && commitBlocked && !committed && (
                <span className="inline-commit-note">Resolve or reset the active roll first.</span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
