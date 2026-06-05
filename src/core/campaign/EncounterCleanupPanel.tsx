import { useState } from "react";

type EncounterCleanupPanelProps = {
  activeMonsterCount: number;
  combatantCount: number;
  persistentEquipmentCount: number;
  onCleanup: () => Promise<string>;
};

export function EncounterCleanupPanel({
  activeMonsterCount,
  combatantCount,
  persistentEquipmentCount,
  onCleanup,
}: EncounterCleanupPanelProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [status, setStatus] = useState("Cleanup not run.");

  async function handleRun() {
    const message = await onCleanup();
    setStatus(message);
    setConfirmed(false);
  }

  return (
    <section className="controlled-intake-card" aria-label="Encounter cleanup">
      <p className="eyebrow">Danger Zone</p>
      <h3>Encounter Cleanup</h3>
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
    </section>
  );
}
