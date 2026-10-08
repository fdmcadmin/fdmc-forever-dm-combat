import type { ReactNode } from "react";
import { actionCostLabels } from "../types/actionEconomy";
import type { ActionCost } from "../types/actionEconomy";
import { isInertAction } from "../types/tabs";
import { effectKindLabel } from "../constants/itemTypeCapabilities";
import { WEAPON_MASTERIES, type WeaponMasteryName } from "../constants/weaponMastery";
import type { ActorAction } from "../types/tabs";

/**
 * The mastery's rules text for the ⚔ tooltip, from the ONE table that holds it.
 *
 * `masteryActive` is a plain string on the metadata — the type layer cannot promise it names a
 * real property — so an unrecognised value degrades to no extra text rather than "undefined".
 */
function masteryRulesLine(mastery: string): string {
  const summary = WEAPON_MASTERIES[mastery as WeaponMasteryName]?.summary;
  return summary ? `\n\n${summary}` : "";
}

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
  /** Resolves @VARIABLE tokens for the summary/detail chips (display only). */
  resolveFormula?: (formula: string) => string;
  /** Upcast level picker for a levelled spell. Rendered outside the action <button>,
   *  since its chips are buttons and nesting them would be invalid HTML. */
  castLevelPicker?: ReactNode;
  /**
   * The damage type the caster has chosen, when the spell lets them choose. Undefined means
   * nothing picked yet — the roll still works, it is just untyped until they say.
   */
  chosenDamageType?: string;
  onChooseDamageType?: (type: string | undefined) => void;
  /** The category, when the tile is not already inside a container that names it. */
  categoryCaption?: string;
};

const summaryRowLabels = new Set([
  "Charges", "Attack", "Damage", "Crit", "Crit Range", "Save", "Range", "Slot Cost",
  "Spell Level", "Concentration",
  // The dice row renames itself when the action says what its dice ARE — see effectKindLabel.
  "Healing", "Temp HP", "Reduction",
]);

function formatSwapMessage(willSwapCosts: ActionCost[], actionLabel: string) {
  if (willSwapCosts.length === 0) {
    return null;
  }

  const labels = willSwapCosts.map((cost) => actionCostLabels[cost]).join(" + ");
  return `${labels} already readied. Clicking ${actionLabel} will swap your readied ${labels}.`;
}

function metadataRows(action: ActorAction, resolveFormula?: (formula: string) => string) {
  const metadata = action.metadata;

  if (!metadata) {
    return [];
  }

  // Resolve @VARIABLE tokens (@PROF, @STR, …) for display so the chips show real
  // numbers ("1d8+1+2") instead of the raw template ("1d8+1+@PROF"). Display only —
  // the roll path resolves independently at commit time.
  const r = (value?: string) => (value && resolveFormula ? resolveFormula(value) : value);

  return [
    // First so the count reads before the dice on a charged item.
    ["Charges", metadata.chargeReadout],
    ["Attack", r(metadata.attack)],
    // Damage / Healing / Temp HP / Reduction — one row, named by what the dice actually do.
    [effectKindLabel(metadata.effectKind) ?? "Damage", metadata.damage ? `${r(metadata.damage)}${metadata.damageType ? ` ${metadata.damageType}` : ""}` : metadata.damage],
    ["Crit", r(metadata.crit)],
    ["Crit Range", metadata.critThreshold ? `${metadata.critThreshold}-20` : undefined],
    ["Save", r(metadata.saveDc)],
    ["Range", metadata.range],
    ["Cost", metadata.cost],
    ["Slot Cost", metadata.slotCost],
    ["Spell Level", metadata.spellLevel !== undefined ? String(metadata.spellLevel) : undefined],
    ["Duration", metadata.duration],
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
  resolveFormula,
  castLevelPicker,
  chosenDamageType,
  onChooseDamageType,
  categoryCaption,
}: ActionButtonProps) {
  const swapMessage = formatSwapMessage(willSwapCosts, action.label);
  const rows = metadataRows(action, resolveFormula);
  const summaryRows = rows.filter(([label]) => summaryRowLabels.has(label));
  const detailRows = rows.filter(([label]) => !summaryRowLabels.has(label));
  const isCompact = compact || action.displayMode === "compact" || costs.length === 0;
  /**
   * The composed stat line ("AC 16 · Requires attunement"), and the rules text, as TWO
   * things — the stat line used to hide the rules text entirely.
   *
   * `metadata.details ?? description` failed twice over. An item with no combat stats gets
   * `details: ""` from joining an empty list, and `??` does not fall through on an empty
   * string, so the Displaced Ward Brooch showed its tags and nothing else. And an item that
   * DOES have stats shadowed its rules text with them, so "reduce force damage you take by
   * 2" was never on the card at all. The two are different information and both belong.
   */
  const statLine = action.metadata?.details?.trim() || undefined;
  const rulesText = action.description?.trim() || undefined;
  const details = statLine;
  const showRulesText = rulesText && rulesText !== statLine;
  /**
   * PASSIVE means not clickable, full stop — it no longer depends on logMode and cost lining
   * up. That coupling is what let a bond tagged "reference" still spend the bond slot: the old
   * tag only suppressed DICE, while inertness was inferred from `silent && no cost`, so an
   * entry that was silent about neither stayed live.
   *
   * `utility` is deliberately NOT here. It is clickable — the click IS the action — it just
   * never rolls.
   */
  /**
   * ⚠ AN ACTION THAT SPENDS SOMETHING CAN NEVER BE INERT.
   *
   * `passive` means not clickable — but an action carrying a `slotCost` spends a pool, and a
   * pool can only be spent by clicking. Tagged both ways it is DEAD: it shows on the card,
   * costs a resource on paper, and cannot be used at all.
   *
   * That is not hypothetical. The retired `reference` tag normalises to `passive`, so every
   * pre-split action that spent a resource became unclickable the day the tag was retired —
   * while a sibling authored moments later, with no tag at all, kept working. Three options of
   * one class feature, two dead and one live, all "authored the same way". It reads as the app
   * randomly breaking, and it is the kind of thing that only shows up mid-fight.
   *
   * So the contradiction is resolved in favour of the COST: if it spends, it clicks. Data
   * cannot reproduce this bug now, whatever it carries.
   */
  // The rule lives in isInertAction — see it for why "costs nothing" never meant "does nothing".
  const referenceOnly = isInertAction(action, costs);
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
        {categoryCaption && <span className="action-category-caption">{categoryCaption}</span>}
        <span className="action-label-row compact-action-title-row">
          <span className="action-label">
            {action.label}
            {/* ⚡ flags an item that carries a charge pool. Inside the label span because
                `.action-label` is display:block — as a sibling it would drop to its own line.
                The live count rides alongside it as the Charges summary chip below. */}
            {action.metadata?.charges && (
              <span className="action-label-charge-flag" title="This item has charges" aria-label="has charges"> ⚡</span>
            )}
            {/* ◈ marks a Convergence item — the same mark the library and the forge picker
                use. A player cannot author one, but the forge is player-initiated, so an
                unmarked input is an item they never know to bring to it. Same span as ⚡
                above, for the same display:block reason. */}
            {action.metadata?.convergence && (
              <span
                className="action-label-convergence-flag"
                title={`Convergence ${action.metadata.convergence.role ?? "item"}${action.metadata.convergence.mechanicalTag ? ` · ${action.metadata.convergence.mechanicalTag}` : ""}`}
                aria-label="convergence item"
              > ◈</span>
            )}
            {/* ⚔ marks a weapon this character HAS WEAPON MASTERY WITH right now — their own
                Long Rest pick, not the weapon's authored property. The two were indistinguishable
                before: every handaxe in the game reads "Mastery: Vex" on its stat line, so the
                one fact a player needs mid-swing — do I have it on THIS weapon — was readable
                only by cross-checking a list on another tab. The mark rides both the equipment
                entry and the attack row, because the swing is where it matters.
                Same span as ⚡ and ◈ above, for the same display:block reason. */}
            {action.metadata?.masteryActive && (
              <span
                className="action-label-mastery-flag"
                title={`Weapon Mastery — ${action.metadata.masteryActive} is ACTIVE on this weapon (your Long Rest pick).${masteryRulesLine(action.metadata.masteryActive)}`}
                aria-label={`weapon mastery active: ${action.metadata.masteryActive}`}
              > ⚔{action.metadata.masteryActive}</span>
            )}
          </span>
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

        {/* P-UX4 Phase 4: passive equipment shows its effect text inline so players can
            read it on their own actor card (no roll/use, non-logging). */}
        {action.actionKind === "equipment" && action.category === "Passive" && action.description && (
          <span className="action-description" style={{ display: "block", fontSize: 11, color: "#9be9a8", marginTop: 2 }}>
            ◇ {action.description}
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

      {castLevelPicker}

      {/* ELEMENT PICKER — the caster chooses, at the table, not in the editor.
          Chromatic Orb and Sorcerous Burst name several damage types and let the caster pick
          one per cast. `damageTypeOptions` is the permitted set, read off the spell’s own
          rules text when it was saved; this is where that set finally becomes a choice.
          Until one is picked the roll still works — it is simply untyped. */}
      {(action.metadata?.damageTypeOptions?.length ?? 0) > 0 && !resolved && onChooseDamageType && (
        <div className="pinned-weapon-row" style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: "2px 0", alignItems: "center" }}>
          <span style={{ fontSize: 10, color: "#667" }}>element</span>
          {action.metadata!.damageTypeOptions!.map(type => {
            const active = chosenDamageType === type;
            return (
              <button
                key={type}
                type="button"
                className="inline-commit-button"
                title={active ? `Casting as ${type} — click to clear` : `Cast as ${type}`}
                onClick={() => onChooseDamageType(active ? undefined : type)}
                style={{
                  background: active ? "#2a3550" : undefined,
                  borderColor: active ? "#7b68ee" : undefined,
                  color: active ? "#dfe4ff" : undefined,
                }}
              >
                {type}
              </button>
            );
          })}
        </div>
      )}

      <div className="action-card-footer-row">
        {/* Visible unready button — shown for any readied economy-costed action, not just right-click */}
        {readied && !resolved && costs.length > 0 && onUnready && (
          <button
            className="inline-commit-button unready-button"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (committed && onResetCommittedRoll) onResetCommittedRoll();
              onUnready(action);
            }}
            title={committed ? "Reset roll and unready this action" : "Unready this action"}
          >
            ✕ {committed ? "Reset & Unready" : "Unready"}
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
            {showRulesText && <p className="action-details-rules">{rulesText}</p>}
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
