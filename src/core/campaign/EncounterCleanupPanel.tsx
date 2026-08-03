import { useState } from "react";

type EncounterCleanupPanelProps = {
  activeMonsterCount: number;
  combatantCount: number;
  persistentEquipmentCount: number;
  onCleanup: () => Promise<string>;
  /** How many party characters are currently in the library. */
  partyCount?: number;
  /** Remove ALL party characters + every layer keyed to them. Returns a report line. */
  onWipeParty?: () => Promise<string>;
};

export function EncounterCleanupPanel({
  activeMonsterCount,
  combatantCount,
  persistentEquipmentCount,
  onCleanup,
  partyCount = 0,
  onWipeParty,
}: EncounterCleanupPanelProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [status, setStatus] = useState("Cleanup not run.");
  const [wipeText, setWipeText] = useState("");
  const [wipeStatus, setWipeStatus] = useState<string | null>(null);
  const [wiping, setWiping] = useState(false);
  const wipeArmed = wipeText.trim().toUpperCase() === "REMOVE PARTY";

  async function handleWipeParty() {
    if (!onWipeParty || !wipeArmed) return;
    setWiping(true);
    try {
      setWipeStatus(await onWipeParty());
      setWipeText("");
    } finally {
      setWiping(false);
    }
  }

  async function handleRun() {
    const message = await onCleanup();
    setStatus(message);
    setConfirmed(false);
  }

  return (
    <section className="controlled-intake-card" aria-label="Encounter cleanup" style={{ borderTop: "3px solid #e0b85a" }}>
      <p className="eyebrow" style={{ color: "#e0b85a" }}>🧹 Cleanup</p>
      <h3 style={{ color: "#e0b85a" }}>Encounter Cleanup</h3>
      <p className="subtle">This clears the active monster encounter state while preserving actor assignments and seat bindings.</p>
      <div className="fdmc-grid three">
        <span>Active monsters: {activeMonsterCount}</span>
        <span>Combatants: {combatantCount}</span>
        <span>Equipment records: {persistentEquipmentCount}</span>
      </div>
      <label className="checkbox-label">
        <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
        Confirm encounter cleanup
      </label>
      <div className="fdmc-button-row">
        <button className="secondary-button danger" type="button" onClick={() => void handleRun()} disabled={!confirmed}>
          Run Cleanup
        </button>
      </div>
      <p className="subtle">{status}</p>

      {/* ── Remove all party characters ───────────────────────────────────────
          Separate and harder-gated than encounter cleanup: this is the clean-slate
          step before re-importing a party. Deleting the actors alone is NOT enough —
          resource counters and live HP are keyed by ACTOR ID, so an import that reuses
          the same ids would inherit stale pools and HP. */}
      {onWipeParty && (
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid #3a2a2a" }}>
          <p className="eyebrow" style={{ color: "#ff7a6a" }}>⚠ Remove All Party Characters</p>
          <p className="subtle" style={{ marginTop: 4 }}>
            Deletes all <strong>{partyCount}</strong> party character{partyCount === 1 ? "" : "s"} <em>and</em> everything
            keyed to them — overrides, resource pools, live HP / temp HP / coins, action economy,
            committed rolls and notes — so a re-import starts clean with nothing leaking through.
          </p>
          <p className="subtle" style={{ marginTop: 4, color: "#8a8aa0" }}>
            Monsters, encounters, equipment and seats are <strong>kept</strong>. Seats re-bind
            automatically if the imported actors reuse the same ids. <strong>Export first —
            this cannot be undone.</strong>
          </p>
          <label className="checkbox-label" style={{ display: "block", marginTop: 8 }}>
            Type <code>REMOVE PARTY</code> to confirm
            <input
              type="text"
              value={wipeText}
              onChange={(e) => setWipeText(e.target.value)}
              placeholder="REMOVE PARTY"
              style={{ display: "block", marginTop: 4, padding: "4px 8px", borderRadius: 4, border: "1px solid #5a2a2a", background: "#12121c", color: "#fff", fontSize: 12, width: "100%", maxWidth: 220 }}
            />
          </label>
          <div className="fdmc-button-row" style={{ marginTop: 8 }}>
            <button
              className="secondary-button danger"
              type="button"
              disabled={!wipeArmed || wiping || partyCount === 0}
              onClick={() => void handleWipeParty()}
            >
              {wiping ? "Removing…" : `Remove all ${partyCount} party character${partyCount === 1 ? "" : "s"}`}
            </button>
          </div>
          {wipeStatus && <p className="subtle" style={{ color: "#7be08a" }}>{wipeStatus}</p>}
        </div>
      )}
    </section>
  );
}
