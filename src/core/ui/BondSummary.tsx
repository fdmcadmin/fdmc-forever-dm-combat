import type { Actor } from "../types/actor";
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
