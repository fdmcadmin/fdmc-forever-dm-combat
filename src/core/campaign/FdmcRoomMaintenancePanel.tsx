import { BackupPanel } from "../ui/BackupPanel";
import { loadGmSettings, saveGmSettings, RULESET_OPTIONS, type GmSettings, type RulesetId } from "../state/gmSettings";
import type { Coins } from "../currency/currency";
import type { ImportResult } from "../seats/actorLibraryExport";
import { useMemo, useState } from "react";
import type { FdmcTableBinding } from "../table-state/sharedTableState";
import { safeStorage } from "../utils/safeStorage";

export type FdmcRoomMaintenanceScanEntry = {
  key: string;
  bytes: number;
  isCanonical: boolean;
};

export type FdmcRoomMaintenanceScanResult = {
  ok: boolean;
  entries: FdmcRoomMaintenanceScanEntry[];
  totalBytes: number;
  message: string;
};

export type FdmcRoomMaintenancePurgeResult = {
  ok: boolean;
  removedKeys: string[];
  failedKeys: string[];
  message: string;
};

export type FdmcRoomMaintenanceReinitializeChecks = {
  tableBindingExists: boolean;
  sharedTableStateExists: boolean;
  actorsByIdEmpty: boolean;
  actorsOrderEmpty: boolean;
  combatPhaseSetup: boolean;
  revisionIsOne: boolean;
};

export type FdmcRoomMaintenanceReinitializeResult = {
  ok: boolean;
  checks: FdmcRoomMaintenanceReinitializeChecks;
  tableBinding?: FdmcTableBinding;
  message: string;
};

export type FdmcRoomMaintenanceActorSnapshotResult = {
  ok: boolean;
  mode: "saved" | "restored" | "empty" | "blocked" | "error";
  actorCount: number;
  bytes: number;
  snapshotAt?: number;
  actorIds?: string[];
  message: string;
};

type FdmcRoomMaintenancePanelProps = {
  onScan: () => Promise<FdmcRoomMaintenanceScanResult>;
  onPurge: () => Promise<FdmcRoomMaintenancePurgeResult>;
  onReinitialize: () => Promise<FdmcRoomMaintenanceReinitializeResult>;
  onActorSnapshot: () => Promise<FdmcRoomMaintenanceActorSnapshotResult>;
  onPurgeSeatMetadata: () => Promise<void>;
  /** Backup section. Omitted where the host has no room state to read wallets from. */
  backup?: {
    version: string;
    getWallets: () => Record<string, Coins>;
    onRestored: (result: ImportResult) => void;
    extraActions?: React.ReactNode;
  };
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function FdmcRoomMaintenancePanel({
  onScan,
  onPurge,
  onReinitialize,
  onActorSnapshot,
  onPurgeSeatMetadata,
  backup,
}: FdmcRoomMaintenancePanelProps) {
  const [scanResult, setScanResult] = useState<FdmcRoomMaintenanceScanResult | undefined>(undefined);
  const [purgeResult, setPurgeResult] = useState<FdmcRoomMaintenancePurgeResult | undefined>(undefined);
  const [reinitializeResult, setReinitializeResult] = useState<FdmcRoomMaintenanceReinitializeResult | undefined>(undefined);
  const [actorSnapshotResult, setActorSnapshotResult] = useState<FdmcRoomMaintenanceActorSnapshotResult | undefined>(undefined);
  const [seatPurgeStatus, setSeatPurgeStatus] = useState<string | null>(null);
  const [purgeArmed, setPurgeArmed] = useState(false);
  const [purgeConfirmText, setPurgeConfirmText] = useState("");
  const [busyAction, setBusyAction] = useState<"scan" | "snapshot" | "seatPurge" | "purge" | "reinitialize" | null>(null);
  // Data and Purge are separate tabs on purpose — see the render.
  const [tab, setTab] = useState<"data" | "purge">("data");
  const [settings, setSettings] = useState<GmSettings>(() => loadGmSettings());

  const purgeConfirmed = purgeConfirmText === "RESET FDMC";
  const sortedEntries = useMemo(() => scanResult?.entries ?? [], [scanResult]);

  async function handleScan() {
    setBusyAction("scan");
    try {
      const result = await onScan();
      setScanResult(result);
      setPurgeResult(undefined);
      setReinitializeResult(undefined);
    } finally {
      setBusyAction(null);
    }
  }

  async function handleActorSnapshot() {
    setBusyAction("snapshot");
    try {
      const result = await onActorSnapshot();
      setActorSnapshotResult(result);
      const rescan = await onScan();
      setScanResult(rescan);
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSeatPurge() {
    setBusyAction("seatPurge");
    setSeatPurgeStatus(null);
    try {
      await onPurgeSeatMetadata();
      setSeatPurgeStatus("Seat metadata cleared — all seat bindings and seat config removed from room metadata and safeStorage().");
    } catch (e) {
      setSeatPurgeStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusyAction(null);
    }
  }

  async function handlePurge() {
    if (!purgeArmed) {
      setPurgeArmed(true);
      setPurgeConfirmText("");
      return;
    }
    if (!purgeConfirmed) {
      return;
    }

    setBusyAction("purge");
    try {
      const result = await onPurge();
      setPurgeResult(result);
      setPurgeArmed(false);
      setPurgeConfirmText("");
      const rescan = await onScan();
      setScanResult(rescan);
    } finally {
      setBusyAction(null);
    }
  }

  async function handleReinitialize() {
    setBusyAction("reinitialize");
    try {
      const result = await onReinitialize();
      setReinitializeResult(result);
      const rescan = await onScan();
      setScanResult(rescan);
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <section className="controlled-intake-card fdmc-room-maintenance-card" aria-label="GM data" style={{ borderTop: "3px solid #6fe0e0" }}>
      <p className="eyebrow" style={{ color: "#6fe0e0" }}>GM Data</p>
      <h3 style={{ color: "#6fe0e0" }}>Settings &amp; Data</h3>
      {/* Two tabs, deliberately separated: things you keep, and things you destroy.
          They had been sitting in one list, which put "back up the party" one button away
          from "purge the room" — the purge half is also on its way out, and mixing them
          made that impossible to signal. */}
      <div style={{ display: "flex", gap: 4, marginBottom: 10, borderBottom: "1px solid #2a2a3e" }}>
        {([["data", "Data & Backup"], ["purge", "Reset & Purge"]] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setTab(id)}
            style={{ fontSize: 12, padding: "5px 12px", background: "transparent", border: "none",
              borderBottom: `2px solid ${tab === id ? (id === "purge" ? "#e0b85a" : "#6fe0e0") : "transparent"}`,
              color: tab === id ? (id === "purge" ? "#e0b85a" : "#6fe0e0") : "#666",
              cursor: "pointer", fontWeight: tab === id ? 600 : 400 }}>
            {label}
          </button>
        ))}
      </div>

      {tab === "data" && (<>
      <div className="fdmc-maintenance-section" style={{ paddingBottom: 10 }}>
        <div>
          <h4>Ruleset</h4>
          <p className="subtle">
            Which module supplies the maths — ability modifiers, proficiency bonus, feats, the weapon tables.
            One option today; the engine itself is rules-agnostic, so a second is an addition rather than a rewrite.
          </p>
        </div>
        <select value={settings.ruleset}
          onChange={e => { const next = { ...settings, ruleset: e.target.value as RulesetId }; setSettings(next); saveGmSettings(next); }}
          style={{ padding: "5px 8px", borderRadius: 4, border: "1px solid #333", background: "#111", color: "#fff", fontSize: 12 }}>
          {RULESET_OPTIONS.map(o => (
            <option key={o.id} value={o.id} disabled={!o.available}>{o.label}{o.available ? "" : " — not ready"}</option>
          ))}
        </select>
      </div>
      <p className="subtle" style={{ margin: "0 0 10px", fontSize: 11 }}>
        {RULESET_OPTIONS.find(o => o.id === settings.ruleset)?.blurb}
      </p>

      <div className="fdmc-maintenance-section scan-section">
        <div>
          <h4>1. Scan FDMC Room Metadata</h4>
          <p className="subtle">Lists only keys starting with fdmc. or forever-dm-combat and estimates their JSON size.</p>
        </div>
        <button className="secondary-button" type="button" onClick={() => void handleScan()} disabled={busyAction !== null}>
          {busyAction === "scan" ? "Scanning..." : "Scan FDMC Room Metadata"}
        </button>
      </div>

      {scanResult && (
        <div className="fdmc-maintenance-results" aria-label="FDMC metadata scan results">
          <p className={scanResult.ok ? "subtle" : "subtle warning-text"}>{scanResult.message}</p>
          <p className="subtle">Total estimated FDMC metadata size: {formatBytes(scanResult.totalBytes)}</p>
          {sortedEntries.length > 0 ? (
            <div className="fdmc-maintenance-key-list">
              {sortedEntries.map((entry) => (
                <div className="fdmc-maintenance-key-row" key={entry.key}>
                  <span className="fdmc-maintenance-key-name">{entry.key}</span>
                  <span className="fdmc-maintenance-key-badge">{entry.isCanonical ? "canonical" : "FDMC"}</span>
                  <span className="fdmc-maintenance-key-size">{formatBytes(entry.bytes)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="subtle">No FDMC-owned room metadata keys are currently visible.</p>
          )}
        </div>
      )}

      <div className="fdmc-maintenance-section actor-snapshot-section">
        <div>
          <h4>2. Actor Snapshot / Rehydrate</h4>
          <p className="subtle">
            One-button local safety pass: saves current room actors when actors exist, or restores the last local actor snapshot when the room has no actors.
          </p>
        </div>
        <button className="secondary-button" type="button" onClick={() => void handleActorSnapshot()} disabled={busyAction !== null}>
          {busyAction === "snapshot" ? "Working..." : "Actor Snapshot / Rehydrate"}
        </button>
      </div>

      {actorSnapshotResult && (
        <div className="fdmc-maintenance-results">
          <p className={actorSnapshotResult.ok ? "subtle" : "subtle warning-text"}>{actorSnapshotResult.message}</p>
          {actorSnapshotResult.actorIds && actorSnapshotResult.actorIds.length > 0 && (
            <p className="subtle">Actors: {actorSnapshotResult.actorIds.join(", ")}</p>
          )}
          <p className="subtle">Snapshot size: {formatBytes(actorSnapshotResult.bytes)}</p>
        </div>
      )}

      {backup && (
        <BackupPanel
          version={backup.version}
          getWallets={backup.getWallets}
          onRestored={backup.onRestored}
          extraActions={backup.extraActions}
        />
      )}
      </>)}

      {tab === "purge" && (<>
        <div style={{ padding: "8px 10px", marginBottom: 10, background: "#2a2010", border: "1px solid #6e5a20", borderRadius: 6 }}>
          <p style={{ margin: 0, fontSize: 11, color: "#e0b85a", fontWeight: 600 }}>⚠ These are going away.</p>
          <p style={{ margin: "3px 0 0", fontSize: 11, color: "#888", lineHeight: 1.5 }}>
            Recovery tools from when room state had to be repaired by hand. They destroy data and
            cannot be undone from here. Take a backup on the Data tab first — every one of these
            can cost a session, and the party wipe can cost the gold outright.
          </p>
        </div>
      <div className="fdmc-maintenance-section seat-purge-section">
        <div>
          <h4>2b. Purge All Seat Metadata</h4>
          <p className="subtle">
            Clears all seat definitions and player bindings from OBR room metadata and DM safeStorage(). All players are returned to the seat picker. Does not touch actors or combat state.
          </p>
        </div>
        <button
          className="secondary-button danger-zone-button"
          type="button"
          onClick={() => void handleSeatPurge()}
          disabled={busyAction !== null}
        >
          {busyAction === "seatPurge" ? "Clearing..." : "Purge All Seat Metadata"}
        </button>
      </div>

      {seatPurgeStatus && (
        <div className="fdmc-maintenance-results">
          <p className="subtle">{seatPurgeStatus}</p>
        </div>
      )}

      <div className="fdmc-maintenance-section purge-section">
        <div>
          <h4>3. Purge FDMC Metadata</h4>
          <p className="subtle">
            Removes only FDMC-owned room metadata from this Owlbear room after readback-confirmed purge.
          </p>
        </div>
        <button
          className="secondary-button danger-zone-button"
          type="button"
          onClick={() => void handlePurge()}
          disabled={busyAction !== null || (purgeArmed && !purgeConfirmed)}
        >
          {busyAction === "purge" ? "Purging..." : purgeArmed ? "Confirm FDMC Metadata Purge" : "Purge FDMC Metadata"}
        </button>
      </div>

      {purgeArmed && (
        <div className="fdmc-maintenance-warning" role="alert">
          <strong>Confirmation required</strong>
          <p>
            This removes only FDMC-owned room metadata from this Owlbear room. It does not delete tokens, maps, or other
            extensions&apos; metadata. Party actors, assignments, and combat state stored in FDMC room metadata will be cleared.
          </p>
          <label className="fdmc-maintenance-confirm-label">
            Type RESET FDMC to confirm
            <input
              type="text"
              value={purgeConfirmText}
              onChange={(event) => setPurgeConfirmText(event.target.value)}
              placeholder="RESET FDMC"
            />
          </label>
        </div>
      )}

      {purgeResult && (
        <div className="fdmc-maintenance-results">
          <p className={purgeResult.ok ? "subtle" : "subtle warning-text"}>{purgeResult.message}</p>
          {purgeResult.removedKeys.length > 0 && (
            <p className="subtle">Removed: {purgeResult.removedKeys.join(", ")}</p>
          )}
          {purgeResult.failedKeys.length > 0 && (
            <p className="subtle warning-text">Failed readback removal: {purgeResult.failedKeys.join(", ")}</p>
          )}
        </div>
      )}

      <div className="fdmc-maintenance-section reinitialize-section">
        <div>
          <h4>4. Reinitialize FDMC State</h4>
          <p className="subtle">
            Creates a clean FDMC table binding and compact canonical sharedTableState with setup phase and no actors.
          </p>
        </div>
        <button className="primary-button" type="button" onClick={() => void handleReinitialize()} disabled={busyAction !== null}>
          {busyAction === "reinitialize" ? "Reinitializing..." : "Reinitialize FDMC State"}
        </button>
      </div>

      {reinitializeResult && (
        <div className="fdmc-maintenance-results">
          <p className={reinitializeResult.ok ? "subtle" : "subtle warning-text"}>{reinitializeResult.message}</p>
          <div className="fdmc-maintenance-check-grid">
            {Object.entries(reinitializeResult.checks).map(([key, passed]) => (
              <span className={passed ? "fdmc-check-pass" : "fdmc-check-fail"} key={key}>
                {passed ? "PASS" : "FAIL"} {key}
              </span>
            ))}
          </div>
        </div>
      )}

      </>)}
    </section>
  );
}
