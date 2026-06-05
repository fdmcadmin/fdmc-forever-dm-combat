import { useState } from "react";
import { actionCostLabels } from "../types/actionEconomy";
import type { CombatLogEntry } from "../types/combatLog";

type CombatLogProps = {
  entries: CombatLogEntry[];
  onClear: () => void;
};

function formatCosts(entry: CombatLogEntry) {
  if (!entry.actionCosts || entry.actionCosts.length === 0) {
    return "Table note";
  }

  return entry.actionCosts.map((cost) => actionCostLabels[cost]).join(" + ");
}

function formatSource(entry: CombatLogEntry) {
  if (entry.tabId === "system") {
    return "System";
  }

  if (entry.tabId === "pinned") {
    return "Pinned";
  }

  if (!entry.tabId) {
    return "Unknown";
  }

  return entry.tabId.charAt(0).toUpperCase() + entry.tabId.slice(1);
}

function formatToneLabel(entry: CombatLogEntry) {
  if (entry.tone === "system") {
    return "System";
  }

  if (entry.tone === "table-note") {
    return "Table Note";
  }

  return formatCosts(entry);
}

export function CombatLog({ entries, onClear }: CombatLogProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <section className={`combat-log ${isExpanded ? "expanded" : "collapsed"}`} aria-label="DM combat log export tool">
      <div className="log-header">
        <button
          className="log-collapse-button"
          type="button"
          onClick={() => setIsExpanded((current) => !current)}
          aria-expanded={isExpanded}
        >
          <span>
            <p className="eyebrow">DM / Builder Log</p>
            <h2>Encounter Log</h2>
          </span>
          <span className="log-collapse-indicator">{isExpanded ? "Collapse" : "Expand"}</span>
        </button>
        <div className="log-action-row" aria-label="Encounter log actions">
          <button className="log-clear-button" type="button" onClick={onClear}>
            Clear
          </button>
          <button className="log-clear-button export" type="button" disabled title="Export wiring lands in a later pass.">
            Export
          </button>
        </div>
      </div>

      {isExpanded ? (
        entries.length === 0 ? (
          <p className="empty-log">No combat entries yet. Recent events remain visible in the combat window.</p>
        ) : (
          <div className="log-list">
            {entries.map((entry) => (
              <article className={`log-entry ${entry.tone ?? "combat"}`} key={entry.id}>
                <p className="log-line">{entry.message}</p>
                <p className="log-meta">
                  {entry.timestamp} · {entry.actorName} · {formatToneLabel(entry)} · {formatSource(entry)}
                </p>
              </article>
            ))}
          </div>
        )
      ) : (
        <p className="empty-log compact-log-summary">
          {entries.length === 0 ? "No encounter log entries yet." : `${entries.length} encounter log ${entries.length === 1 ? "entry" : "entries"} stored.`}
        </p>
      )}
    </section>
  );
}
