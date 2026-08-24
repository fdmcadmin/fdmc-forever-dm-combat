import type { MonsterValidationIssue } from "../types/monsterTypes";

type MonsterWarningsPanelProps = {
  issues: MonsterValidationIssue[];
};

export function MonsterWarningsPanel({ issues }: MonsterWarningsPanelProps) {
  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");
  const infos = issues.filter((issue) => issue.severity === "info");

  if (issues.length === 0) {
    return (
      <section className="monster-dev-panel monster-dev-good-panel" aria-label="Monster JCON validation results">
        <div>
          <p className="eyebrow">Validation</p>
          <h3>No blocking warnings</h3>
        </div>
        <p className="subtle">Monster card rendered from the supplied native FDM JCON without missing-field warnings.</p>
      </section>
    );
  }

  return (
    <section className="monster-dev-panel monster-dev-warning-panel" aria-label="Monster JCON validation results">
      <div className="monster-dev-panel-heading">
        <div>
          <p className="eyebrow">Validation</p>
          <h3>{errors.length} errors · {warnings.length} warnings · {infos.length} notes</h3>
        </div>
        <span className="monster-dev-pill">no silent failure</span>
      </div>
      <div className="monster-dev-issue-list">
        {issues.map((issue, index) => (
          <article className={`monster-dev-issue ${issue.severity}`} key={`${issue.path}-${index}`}>
            <strong>{issue.severity.toUpperCase()}</strong>
            <code>{issue.path}</code>
            <span>{issue.message}</span>
          </article>
        ))}
      </div>
    </section>
  );
}
