/**
 * CriticalFailureReference — the Nat 1 tables, readable without rolling a Nat 1.
 *
 * Until now the only way to see either table was to actually roll a natural 1 on an attack:
 * `CommittedRollPanel` renders the d6 picker behind `isAttackCriticalFailure`, so the DM could
 * never look the tables up in advance, and a player could never see what the table even was.
 *
 * BOTH TABLES, ALWAYS. First Nat 1 and Second Nat 1 side by side — the second table is the one
 * people forget exists, and it is the one with the only damaging result in the system.
 *
 * MELEE AND SPELL ARE THE SAME TABLE. There is one critical-failure table set and it applies to
 * any attack roll, a swing or a Fire Bolt alike. This says so out loud rather than leaving a DM
 * to wonder whether a spell attack uses something else — the two columns here are the two
 * TABLES, not two weapon types.
 *
 * Pure reference. Changes no state, spends nothing, and never writes to the log.
 */

import {
  STANDARD_CRITICAL_FAILURE_TABLE,
  DOUBLE_CRITICAL_FAILURE_TABLE,
  type CriticalFailureEntry,
} from "../data/criticalFailureTables";

type Props = {
  open: boolean;
  onClose: () => void;
  /** DM view shows the full effect; a player seat sees the summary the table is allowed to see. */
  playerSafe?: boolean;
};

function TableColumn({ title, blurb, entries, playerSafe }: {
  title: string; blurb: string; entries: CriticalFailureEntry[]; playerSafe: boolean;
}) {
  return (
    <div style={{ flex: "1 1 260px", minWidth: 240 }}>
      <h4 style={{ margin: "0 0 2px", fontSize: 13, color: "#e07b39" }}>{title}</h4>
      <p style={{ margin: "0 0 8px", fontSize: 10, color: "#777" }}>{blurb}</p>
      <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
        {entries.map(entry => (
          <li key={entry.id} style={{
            display: "flex", gap: 8, alignItems: "flex-start",
            background: "#0d0d14", border: "1px solid #2a2a3e", borderRadius: 6, padding: "6px 8px",
          }}>
            <span style={{
              flexShrink: 0, width: 20, height: 20, borderRadius: 4, background: "#1c1c2b",
              border: "1px solid #3a3a52", color: "#e07b39", fontWeight: 700, fontSize: 11,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}>{entry.roll}</span>
            <span style={{ minWidth: 0 }}>
              <strong style={{ display: "block", fontSize: 12, color: "#dcdce6" }}>{entry.title}</strong>
              <span style={{ fontSize: 11, color: "#9a9ab0" }}>
                {playerSafe ? entry.playerSummary : entry.dmEffect}
              </span>
              {!playerSafe && entry.damageClause && (
                <em style={{ display: "block", fontSize: 10, color: "#c9a227", marginTop: 2 }}>{entry.damageClause}</em>
              )}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function CriticalFailureReference({ open, onClose, playerSafe = false }: Props) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Natural 1 tables"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "min(820px, 100%)", maxHeight: "85vh", display: "flex", flexDirection: "column",
          background: "#13131f", border: "1px solid #2a2a3e", borderRadius: 10,
          boxShadow: "0 12px 40px rgba(0,0,0,0.5)", color: "#dcdce6",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #2a2a3e" }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>⚀ Natural 1 — failure tables</h3>
          <button type="button" onClick={onClose} aria-label="Close Nat 1 tables"
            style={{ fontSize: 13, padding: "3px 10px", background: "transparent", border: "1px solid #444", borderRadius: 4, color: "#aaa", cursor: "pointer" }}>✕ Close</button>
        </div>

        <div style={{ padding: "10px 16px", borderBottom: "1px solid #2a2a3e", fontSize: 11, color: "#9a9ab0" }}>
          One table set covers <strong style={{ color: "#dcdce6" }}>every attack roll — melee, ranged and spell alike</strong>.
          On a natural 1 the attack misses; roll a d6 on the first table. A second natural 1 in the
          same combat uses the second table.
          {!playerSafe && <> Only the second table's <strong style={{ color: "#dcdce6" }}>6</strong> can deal damage, and only to a level 1 actor.</>}
        </div>

        <div style={{ overflowY: "auto", padding: 16, display: "flex", flexWrap: "wrap", gap: 20 }}>
          <TableColumn
            title="First Nat 1"
            blurb="The opening failure. Nothing here deals damage."
            entries={STANDARD_CRITICAL_FAILURE_TABLE}
            playerSafe={playerSafe}
          />
          <TableColumn
            title="Second Nat 1"
            blurb="A second failure in the same fight. Harder consequences."
            entries={DOUBLE_CRITICAL_FAILURE_TABLE}
            playerSafe={playerSafe}
          />
        </div>
      </div>
    </div>
  );
}
