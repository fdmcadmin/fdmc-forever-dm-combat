/**
 * Backups — the DM's choice about how much safety net they want.
 *
 * Deliberately self-contained: it takes the version and a way to read the wallets, and hands
 * back what a restore produced. That keeps it placement-agnostic (maintenance panel today,
 * combat window if that turns out to be where it's wanted) and keeps the GM the only writer
 * of room state — a restore RETURNS the purses, it doesn't publish them.
 */

import { useEffect, useRef, useState } from "react";
import {
  loadBackupSettings, saveBackupSettings, loadSnapshots, takeSnapshot, takeSnapshotIfChanged, restoreSnapshot,
  downloadSnapshot, deleteSnapshot, snapshotBytes, MAX_SNAPSHOTS,
  type BackupSettings, type BackupSnapshot,
} from "../state/autoBackup";
import type { Coins } from "../currency/currency";
import type { ImportResult } from "../seats/actorLibraryExport";

type Props = {
  version: string;
  /** Read at the moment a backup is taken, so a snapshot always carries current gold. */
  getWallets: () => Record<string, Coins>;
  /** A restore landed — the host reloads its library and publishes the returned purses. */
  onRestored: (result: ImportResult) => void;
  /** Optional extra actions to sit alongside (log export, library export). */
  extraActions?: React.ReactNode;
};

const CYAN = "#6fe0e0";

const btn = (accent: string): React.CSSProperties => ({
  fontSize: 11, padding: "3px 10px", background: "transparent",
  border: `1px solid ${accent}55`, borderRadius: 4, color: accent, cursor: "pointer",
});

function ago(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs}h ago` : `${Math.round(hrs / 24)}d ago`;
}

export function BackupPanel({ version, getWallets, onRestored, extraActions }: Props) {
  const [settings, setSettings] = useState<BackupSettings>(() => loadBackupSettings());
  const [snapshots, setSnapshots] = useState<BackupSnapshot[]>(() => loadSnapshots());
  const [note, setNote] = useState<string | null>(null);
  const [confirmingRestore, setConfirmingRestore] = useState<string | null>(null);
  const refresh = () => setSnapshots(loadSnapshots());

  const say = (msg: string) => { setNote(msg); window.setTimeout(() => setNote(null), 6000); };

  function backupNow(trigger: Parameters<typeof takeSnapshot>[2] = "manual") {
    const snap = takeSnapshot(version, getWallets(), trigger);
    refresh();
    if (!snap) { say("Nothing to back up — the actor library is empty."); return; }
    say(`Backed up ${snap.actorCount} actor${snap.actorCount === 1 ? "" : "s"}`
      + (snap.walletCount ? ` and ${snap.walletCount} purse${snap.walletCount === 1 ? "" : "s"}.` : ", no wallets held any coin."));
  }

  /**
   * Back up when the tools CLOSE, not when they open — and only if something changed.
   *
   * Opening captured the state you arrived with, which is the state already sitting in the
   * ring; the work done during the session was only ever caught by the next open, an hour or
   * a week later. Closing captures what you just did.
   *
   * The change check is what makes an unmount trigger safe. This panel unmounts on every tab
   * switch, so an unconditional snapshot would churn five identical copies in a minute and
   * push the one that mattered off the end of the ring.
   *
   * The refs read current values at unmount time — the cleanup closure captures whatever was
   * bound when the effect ran, and a snapshot taken from a stale party is worse than none.
   */
  const closeRef = useRef({ mode: settings.mode, version, getWallets });
  closeRef.current = { mode: settings.mode, version, getWallets };
  useEffect(() => () => {
    const { mode, version: v, getWallets: wallets } = closeRef.current;
    if (mode === "off") return;
    takeSnapshotIfChanged(v, wallets(), "session-end");
  }, []);

  // Interval backups only run while this panel is mounted — a closed panel does no work.
  useEffect(() => {
    if (settings.mode !== "interval") return;
    const ms = Math.max(5, settings.intervalMinutes) * 60 * 1000;
    const timer = window.setInterval(() => { takeSnapshotIfChanged(version, getWallets(), "interval"); refresh(); }, ms);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.mode, settings.intervalMinutes]);

  function update(patch: Partial<BackupSettings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveBackupSettings(next);
  }

  const kb = Math.round(snapshotBytes() / 1024);

  return (
    <div className="fdmc-maintenance-section" style={{ borderTop: `1px solid ${CYAN}33`, paddingTop: 10 }}>
      <h4 style={{ margin: "0 0 4px" }}>5. Backups</h4>
      <p style={{ margin: "0 0 8px", fontSize: 11, color: "#888", lineHeight: 1.5 }}>
        Kept in <strong>this browser</strong> (localStorage <code>fdmc.backup.snapshots.v1</code>)
        under a key the party wipe never clears, so a wipe-and-reimport is undoable. It does{" "}
        <strong>not</strong> survive clearing browser data, and it does not follow you to another
        browser or machine — save a file for that. Newest {MAX_SNAPSHOTS} are kept; the
        oldest drops off.
      </p>
      <p style={{ margin: "0 0 8px", fontSize: 11, color: "#666", lineHeight: 1.5 }}>
        <strong>Each session</strong> takes one when you close these tools, and only if something
        actually changed — so re-opening without touching anything won't spend a slot.
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: "#888" }}>Automatic:</span>
        {([
          ["off", "Off"],
          ["session", "Each session"],
          ["interval", "On a timer"],
        ] as const).map(([mode, label]) => (
          <button key={mode} type="button" onClick={() => update({ mode })}
            style={{ ...btn(settings.mode === mode ? CYAN : "#555"),
              background: settings.mode === mode ? `${CYAN}18` : "transparent",
              fontWeight: settings.mode === mode ? 600 : 400 }}>
            {label}
          </button>
        ))}
        {settings.mode === "interval" && (
          <label style={{ fontSize: 11, color: "#888", display: "flex", alignItems: "center", gap: 4 }}>
            every
            <input type="number" min={5} max={240} value={settings.intervalMinutes}
              onChange={e => update({ intervalMinutes: Math.max(5, Number.parseInt(e.target.value, 10) || 30) })}
              style={{ width: 52, padding: "2px 4px", borderRadius: 3, border: "1px solid #333", background: "#111", color: "#fff", fontSize: 11 }} />
            min
          </label>
        )}
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        <button type="button" onClick={() => backupNow("manual")} style={{ ...btn(CYAN), background: `${CYAN}18`, fontWeight: 600 }}>
          Back Up Now
        </button>
        {extraActions}
      </div>

      {note && <p style={{ margin: "0 0 8px", fontSize: 11, color: CYAN }}>{note}</p>}

      {snapshots.length === 0 ? (
        <p style={{ margin: 0, fontSize: 11, color: "#555", fontStyle: "italic" }}>No backups yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {snapshots.map(s => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
              padding: "5px 8px", background: "#161622", border: "1px solid #2a2a3e", borderRadius: 5 }}>
              <span style={{ fontSize: 11, color: "#ddd", minWidth: 74 }}>{ago(s.takenAt)}</span>
              <span style={{ fontSize: 10, color: "#666" }}>
                {s.actorCount} actor{s.actorCount === 1 ? "" : "s"}
                {s.walletCount ? ` · ${s.walletCount} purse${s.walletCount === 1 ? "" : "s"}` : " · no coin"}
                {s.trigger !== "manual" ? ` · ${s.trigger.replace("-", " ")}` : ""}
              </span>
              <div style={{ display: "flex", gap: 5, marginLeft: "auto" }}>
                <button type="button" onClick={() => { downloadSnapshot(s.id); say("Saved to your downloads."); }}
                  style={btn("#888")} title="Save this backup out as a file">Save file</button>
                {confirmingRestore === s.id ? (
                  <>
                    <button type="button" style={{ ...btn("#e0b85a"), background: "#2a2010", fontWeight: 600 }}
                      onClick={() => {
                        const result = restoreSnapshot(s.id, version, getWallets());
                        setConfirmingRestore(null); refresh();
                        say(result.message);
                        if (result.ok) onRestored(result);
                      }}>
                      Confirm restore
                    </button>
                    <button type="button" style={btn("#666")} onClick={() => setConfirmingRestore(null)}>Cancel</button>
                  </>
                ) : (
                  <button type="button" style={btn("#e0b85a")} onClick={() => setConfirmingRestore(s.id)}
                    title="Replace the current library with this backup. The current state is snapshotted first.">
                    Restore
                  </button>
                )}
                <button type="button" style={btn("#5a4a4a")} onClick={() => { deleteSnapshot(s.id); refresh(); }} title="Delete this backup">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {snapshots.length > 0 && (
        <p style={{ margin: "6px 0 0", fontSize: 10, color: "#555" }}>
          {snapshots.length} backup{snapshots.length === 1 ? "" : "s"} · about {kb}KB · oldest drops off after 5.
        </p>
      )}
    </div>
  );
}
