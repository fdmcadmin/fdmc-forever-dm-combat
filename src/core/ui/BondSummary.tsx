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
    return (
      <section className="bond-summary" aria-label="Bond summary">
        <div className="bond-summary-header">
          <div>
            <p className="eyebrow">Bond · {resolved.numeral} {resolved.stageName}</p>
            <h3>{template.name}</h3>
          </div>
        </div>
        {/* A held-back bond says WHY. "not yet earned" is a different thing from "broken". */}
        {resolved.blockedBy && (
          <p style={{ fontSize: 11, color: "#e9a66a" }}>
            Held at {resolved.stageName} — {resolved.blockedBy.label} first.
          </p>
        )}
        {resolved.awaitingPathChoice && (
          <p style={{ fontSize: 11, color: "#e9a66a" }}>
            {resolved.stageName} reached — the permanent path has not been chosen yet.
          </p>
        )}
        {resolved.effect && <p>{resolved.effect}</p>}
        {resolved.chosen && (
          <p><strong>{resolved.chosen.name}.</strong> {resolved.chosen.text}</p>
        )}
        {resolved.unchosen && (
          <p style={{ opacity: 0.75 }}><strong>{resolved.unchosen.name}.</strong> {resolved.unchosen.text}</p>
        )}
        {template.onYourTurn && <p className="bond-summary-flow">{template.onYourTurn}</p>}
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
