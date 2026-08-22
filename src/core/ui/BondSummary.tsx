import type { Actor } from "../types/actor";
import { resolveBond } from "../rules/bondProgress";
import { BROKEN_CHAIN_BOND_TEMPLATES } from "../../modules/the-broken-chain/content/bondTemplates";
import { BROKEN_CHAIN_BOND_GATES } from "../../modules/the-broken-chain/content/bondGates";
import type { ActorActionEconomyState } from "../types/actionEconomy";

const timingLabels: Record<string, string> = {
  beforeAction: "Before Action",
  afterHit: "After Hit",
  afterAction: "After Action",
  sameTurnAfterPlayer: "Same Turn After Player",
  nextTurn: "Next Turn",
};

type BondSummaryProps = {
  actor: Actor;
  actionState: ActorActionEconomyState;
};

export function BondSummary({ actor, actionState }: BondSummaryProps) {
  /**
   * THE v13 BOND WINS WHEN THERE IS ONE.
   *
   * A character's bond used to be one flat `currentEffect` string with no stages and no paths,
   * read from a per-PC table. The ladder replaces it: which of the fourteen is stored on the
   * actor, and everything else is DERIVED — the stage from level (3/6/9/13) gated by campaign
   * milestones, the live text from the stage and the permanent path.
   *
   * The old shape is still read as a fallback so an actor imported before the ladder existed
   * still shows something rather than going blank mid-session.
   */
  const assignment = actor.moduleData?.bondAssignment;
  const template = assignment
    ? BROKEN_CHAIN_BOND_TEMPLATES.find(b => b.id === assignment.templateId)
    : undefined;

  if (assignment && template) {
    const resolved = resolveBond(template, assignment, {
      level: actor.level ?? 1,
      gates: BROKEN_CHAIN_BOND_GATES,
      milestones: actor.moduleData?.milestones ?? [],
    });
    /**
     * COMPACT, LIKE THE BOND TAB.
     *
     * Christopher: *"i dont like the massive character box it created."* The first version was a
     * full panel with a heading block, both paths as paragraphs and a turn-flow line — taller than
     * the character sheet it sat on. The bond TAB already had the right shape: a title, a cost tag,
     * and the detail folded away until asked for. This matches that.
     *
     * The unchosen path is NOT shown here. It is real and it matters, but it belongs behind the
     * details fold rather than doubling the height of every card that carries a bond.
     */
    const line = resolved.blockedBy
      ? `Held at ${resolved.stageName} — ${resolved.blockedBy.label} first.`
      : resolved.awaitingPathChoice
        ? `${resolved.stageName} reached — choose the permanent path.`
        : resolved.chosen
          ? `${resolved.chosen.name}. ${resolved.chosen.text}`
          : (resolved.effect ?? "");
    const warn = Boolean(resolved.blockedBy || resolved.awaitingPathChoice);
    return (
      <section className="bond-summary" aria-label="Bond summary"
        style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #2a2a3e", background: "#12101f" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, letterSpacing: 1, color: "#9d8cff", textTransform: "uppercase" }}>
            Bond · {resolved.numeral} {resolved.stageName}
          </span>
          <strong style={{ fontSize: 12 }}>{template.name}</strong>
        </div>
        {line && (
          <p style={{ margin: "3px 0 0", fontSize: 11, lineHeight: 1.35, color: warn ? "#e9a66a" : "#aab" }}>{line}</p>
        )}
      </section>
    );
  }
  const bond = actor.moduleData?.bond;

  if (!bond) {
    return null;
  }

  return (
    <section className="bond-summary" aria-label="Bond summary">
      <div className="bond-summary-header">
        <div>
          <p className="eyebrow">Homebrew / Bond</p>
          <h3>{bond.name}</h3>
        </div>
        <span className={`bond-state-pill ${actionState.bond ? "readied" : "ready"}`}>
          {actionState.bond ? "readied" : "ready"}
        </span>
      </div>
      <p className="bond-timing">Timing: {timingLabels[bond.timing] ?? bond.timing}</p>
      {bond.turnFlow && <p className="bond-flow">Table flow: {bond.turnFlow}</p>}
      {bond.ruleNote && <p className="bond-rule-note">Rule: {bond.ruleNote}</p>}
      <p className="bond-effect">{bond.currentEffect}</p>
    </section>
  );
}
