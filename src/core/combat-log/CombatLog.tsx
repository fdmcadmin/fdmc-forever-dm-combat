import { useState } from "react";
import { actionCostLabels } from "../types/actionEconomy";
import type { CombatLogEntry } from "../types/combatLog";
import { summarizeEncounter, type CombatantTotals } from "./encounterSummary";

// ─── Encounter summary ────────────────────────────────────────────────────────

function StatLine({ label, row, value }: { label: string; row?: CombatantTotals; value?: (r: CombatantTotals) => number }) {
  if (!row || !value) return null;
  return (
    <div className="log-summary-stat">
      <span className="log-summary-stat-label">{label}</span>
      <span className="log-summary-stat-name">{row.name}</span>
      <span className="log-summary-stat-value">{value(row)}</span>
    </div>
  );
}

function SummaryTable({ rows, heading }: { rows: CombatantTotals[]; heading: string }) {
  if (rows.length === 0) return null;
  return (
    <>
      <p className="log-summary-subhead">{heading}</p>
      <table className="log-summary-table">
        <thead>
          <tr>
            <th>Combatant</th><th>Dealt</th><th>Taken</th><th>Healed</th><th>Res</th>
            <th title="Actions · Bonus · Reactions · Legendary">A · B · R · L</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td>
                {r.name}
                {/* Inference is surfaced, never hidden — a total resting on a manual HP
                    tweak is not the same claim as one built from committed rolls. */}
                {r.inferredEntries > 0 && (
                  <span className="log-summary-inferred" title={`${r.inferredEntries} entr${r.inferredEntries === 1 ? "y" : "ies"} inferred from the active turn rather than a committed roll`}> ~</span>
                )}
              </td>
              <td>{r.damageDealt || "—"}</td>
              <td>{r.damageTaken || "—"}</td>
              <td>{r.healingDone || "—"}</td>
              <td>{r.resourcesSpent || "—"}</td>
              <td className="log-summary-economy">
                {r.actions} · {r.bonusActions} · {r.reactions} · {r.legendaryActions}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export function EncounterSummaryPanel({ entries }: { entries: CombatLogEntry[] }) {
  const summary = summarizeEncounter(entries);
  if (summary.combatants.length === 0) return null;
  // Group by side so "who carried the fight" stays a party question — otherwise the boss
  // wins damage-dealt simply by being the thing everyone is fighting.
  const party = summary.combatants.filter(c => c.side === "party");
  const monsters = summary.combatants.filter(c => c.side === "monster");
  const unknown = summary.combatants.filter(c => !c.side);
  return (
    <section className="log-summary" aria-label="Encounter summary">
      <div className="log-summary-head">
        <h3>Encounter Summary</h3>
        <span className="log-summary-meta">
          {summary.rounds > 0 ? `${summary.rounds} rounds · ` : ""}{summary.totalEntries} entries
        </span>
      </div>
      <div className="log-summary-scope">
        {summary.leadersScopedToParty ? "Party leaders" : "All combatants"}
      </div>
      <div className="log-summary-stats">
        <StatLine label="Most damage" row={summary.leaders.mostDamageDealt} value={r => r.damageDealt} />
        <StatLine label="Most damage taken" row={summary.leaders.mostDamageTaken} value={r => r.damageTaken} />
        <StatLine label="Most healing" row={summary.leaders.mostHealing} value={r => r.healingDone} />
        <StatLine label="Most resources" row={summary.leaders.mostResources} value={r => r.resourcesSpent} />
      </div>
      <SummaryTable rows={party} heading="Party" />
      <SummaryTable rows={monsters} heading="Monsters" />
      <SummaryTable rows={unknown} heading={party.length || monsters.length ? "Unassigned" : "Combatants"} />
      {summary.inferredEntries > 0 && (
        <p className="log-summary-note">
          ~ {summary.inferredEntries} entr{summary.inferredEntries === 1 ? "y was" : "ies were"} inferred from the
          active turn rather than a committed roll, so those totals are an estimate.
        </p>
      )}
    </section>
  );
}

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

  // P9 pre-work flag closed: download the full encounter log as JSON (self-contained,
  // uses the entries already in hand — no parent wiring needed).
  function handleExport() {
    if (entries.length === 0) return;
    const payload = {
      schema: "fdmc.encounter-log.v1",
      exportedAt: new Date().toISOString(),
      entryCount: entries.length,
      // Totals ride along so the export answers "who carried that fight" without the
      // reader having to re-derive it from the transcript.
      summary: summarizeEncounter(entries),
      entries,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fdmc-encounter-log-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

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
          <button className="log-clear-button export" type="button" onClick={handleExport}
            disabled={entries.length === 0}
            title={entries.length === 0 ? "No log entries to export yet." : "Download the full encounter log as JSON."}>
            Export
          </button>
        </div>
      </div>

      {isExpanded && <EncounterSummaryPanel entries={entries} />}

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
