import { actionCostLabels } from "../types/actionEconomy";
import type { ActionCost } from "../types/actionEconomy";
import type { ActorAction } from "../types/tabs";

type ActionButtonProps = {
  action: ActorAction;
  costs: ActionCost[];
  readied: boolean;
  resolved?: boolean;
  committed?: boolean;
  commitBlocked?: boolean;
  willSwapCosts: ActionCost[];
  compact?: boolean;
  concentrationActive?: boolean;
  concentrationConflict?: boolean;
  activeConcentrationLabel?: string | null;
  onClick: (action: ActorAction) => void;
  onUnready?: (action: ActorAction) => void;
  onCommitRoll?: (action: ActorAction) => void;
  /** Called when DM wants to reset the active committed roll to swap to this action */
  onResetCommittedRoll?: () => void;
  rollButtonLabel?: string;
};

const summaryRowLabels = new Set(["Attack", "Damage", "Crit", "Crit Range", "Save", "Range", "Slot Cost", "Spell Level", "Concentration"]);

function formatSwapMessage(willSwapCosts: ActionCost[], actionLabel: string) {
  if (willSwapCosts.length === 0) {
    return null;
  }

  const labels = willSwapCosts.map((cost) => actionCostLabels[cost]).join(" + ");
  return `${labels} already readied. Clicking ${actionLabel} will swap your readied ${labels}.`;
}

function metadataRows(action: ActorAction) {
  const metadata = action.metadata;

  if (!metadata) {
    return [];
  }

  return [
    ["Attack", metadata.attack],
    ["Damage", metadata.damage],
    ["Crit", metadata.crit],
    ["Crit Range", metadata.critThreshold ? `${metadata.critThreshold}-20` : undefined],
    ["Save", metadata.saveDc],
    ["Range", metadata.range],
    ["Cost", metadata.cost],
    ["Slot Cost", metadata.slotCost],
    ["Spell Level", metadata.spellLevel !== undefined ? String(metadata.spellLevel) : undefined],
    ["Concentration", metadata.concentration],
    ["Modifier", metadata.withModifier],
    ["Additive", metadata.additive],
  ].filter((row): row is [string, string] => Boolean(row[1]));
}

function hasDetails(action: ActorAction, rows: [string, string][]) {
  return Boolean(action.description || action.metadata?.details || action.tags?.length || rows.length > 0);
}

export function ActionButton({
  action,
  costs,
  readied,
  resolved,
  committed,
  commitBlocked,
  willSwapCosts,
  compact,
  concentrationActive,
  concentrationConflict,
  activeConcentrationLabel,
  onClick,
  onUnready,
  onCommitRoll,
  onResetCommittedRoll,
  rollButtonLabel = "Roll",
}: ActionButtonProps) {
  const swapMessage = formatSwapMessage(willSwapCosts, action.label);
  const rows = metadataRows(action);
  const summaryRows = rows.filter(([label]) => summaryRowLabels.has(label));
  const detailRows = rows.filter(([label]) => !summaryRowLabels.has(label));
  const isCompact = compact || action.displayMode === "compact" || costs.length === 0;
  const details = action.metadata?.details ?? action.description;
  const referenceOnly = action.logMode === "silent" && costs.length === 0;
  // BUILD 0.5.3.1.3: action-card click may prime the roll workspace immediately,
  // but table players still need the visible Roll button to send the selected roll to Dice+.
  // Keep the button available for the selected/committed action; hide only when another
  // committed roll blocks it or the action has already resolved.
  const showCommitButton = Boolean(readied && onCommitRoll && !commitBlocked && !resolved);
  const showRagePrepareButton = action.id === "rage" && !resolved;
  const showDetails = hasDetails(action, rows);

  return (
    <div className={`action-button-shell ${readied ? "readied-shell" : ""} ${resolved ? "resolved-shell" : ""}`}>
      <button
        className={`action-button ${isCompact ? "compact-action" : ""} ${readied ? "readied" : ""} ${resolved ? "resolved-action" : ""} ${committed ? "committed-action" : ""} ${willSwapCosts.length > 0 ? "swap-warning" : ""} ${referenceOnly ? "reference-only" : ""} ${concentrationActive ? "concentration-active" : ""} ${concentrationConflict ? "concentration-conflict" : ""}`}
        type="button"
        aria-disabled={referenceOnly || resolved}
        onClick={() => {
          if (referenceOnly || resolved) {
            return;
          }

          onClick(action);
        }}
        onContextMenu={(event) => {
          if (referenceOnly || resolved || !readied || !onUnready) {
            return;
          }

          event.preventDefault();
          onUnready(action);
        }}
      >
        <span className="action-label-row compact-action-title-row">
          <span className="action-label">{action.label}</span>
          {costs.length > 0 && (
            <span className="action-cost-tags">
              {costs.map((cost) => (
                <span className="action-cost-tag" key={cost}>
                  {actionCostLabels[cost]}
                </span>
              ))}
            </span>
          )}
        </span>

        {summaryRows.length > 0 && (
          <span className="action-summary-chip-row">
            {summaryRows.map(([label, value]) => (
              <span className="action-summary-chip" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </span>
            ))}
          </span>
        )}

        {concentrationActive && (
          <span className="action-description concentration-text">Pending concentration — would start if this resolves.</span>
        )}
        {concentrationConflict && activeConcentrationLabel && (
          <span className="action-description warning-text">
            Pending concentration: {activeConcentrationLabel}. Clicking {action.label} flags a concentration conflict/replacement if it resolves.
          </span>
        )}
        {committed && <span className="action-description readied-text">Roll active — use Roll to send to Dice+ or resolve/reset the roll panel.</span>}
        {readied && !committed && (
          <span className="action-description readied-text">
            {costs.length === 0
              ? `Selected — use ${rollButtonLabel} below or click another option to switch.`
              : `Readied — use ${rollButtonLabel} below or ✕ Unready to cancel.`}
          </span>
        )}
        {!readied && costs.length === 0 && onCommitRoll && <span className="action-description readied-text">Click to select this roll.</span>}
        {resolved && <span className="action-description resolved-text">Used — reset before using again.</span>}
        {swapMessage && !readied && !resolved && <span className="action-description warning-text">{swapMessage}</span>}
      </button>

      <div className="action-card-footer-row">
        {/* Visible unready button — shown for any readied economy-costed action, not just right-click */}
        {readied && !committed && !resolved && costs.length > 0 && onUnready && (
          <button
            className="inline-commit-button unready-button"
            type="button"
            onClick={(e) => { e.stopPropagation(); onUnready(action); }}
            title="Unready this action"
          >
            ✕ Unready
          </button>
        )}
        {showCommitButton && (
          <button className="inline-commit-button" type="button" onClick={() => onCommitRoll?.(action)}>
            {rollButtonLabel}
          </button>
        )}
        {showRagePrepareButton && (
          <button
            className="inline-commit-button rage-prepare-inline-button"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onClick(action);
            }}
          >
            Prepare Rage
          </button>
        )}
        {showDetails && (
          <details className="action-details-drawer">
            <summary>Details</summary>
            {details && <p>{details}</p>}
            {detailRows.length > 0 && (
              <dl>
                {detailRows.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {action.tags && action.tags.length > 0 && (
              <div className="action-tag-row details-tag-row">
                {action.tags.map((tag) => (
                  <span className="action-inline-tag" key={tag}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </details>
        )}
      </div>

      {readied && commitBlocked && !committed && (
        <span className="inline-commit-note">
          Resolve or reset the active roll first.
          {onResetCommittedRoll && (
            <button
              type="button"
              className="inline-commit-reset-link"
              onClick={(e) => { e.stopPropagation(); onResetCommittedRoll(); }}
              style={{ marginLeft: 6, fontSize: "inherit", background: "none", border: "none", color: "var(--color-accent, #7b68ee)", cursor: "pointer", textDecoration: "underline", padding: 0 }}
            >
              Reset roll
            </button>
          )}
        </span>
      )}
      {/* Right-click hint when not readied and action has costs */}
      {!readied && !resolved && costs.length === 0 && !onCommitRoll && (
        <span className="action-description" style={{ fontSize: 10, color: "#555", display: "block", marginTop: 2 }}>
          Click to roll
        </span>
      )}
    </div>
  );
}
