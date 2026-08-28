/**
 * ENGINE DIAGNOSTICS — Gate 7's live proof, as a button a DM can press.
 *
 * Portability spec Gate 7: *"run the real FDMC app; force one engine capability to fail; verify
 * visible fallback behavior; verify combat/library/equipment and unrelated checker functions
 * continue."*
 *
 * ⚠ THAT GATE CANNOT BE AUTOMATED FROM THIS REPOSITORY, which is exactly why it needs a control.
 * `check:engine` proves fault isolation in a script; it cannot prove that the RUNNING app degrades
 * the way the script says, because nothing here can open a live room. This panel is the hand that
 * pulls the lever, so the proof takes one click instead of a hand-edited build.
 *
 * ── ⚠ UNLOCKED-AND-AUTHOR ONLY ──────────────────────────────────────────────────────────────
 * Christopher: *"shown that this is a unlocked only feature."* Deliberately breaking a capability is
 * not something a player should be able to do to their own table, so it sits behind the same author
 * gate as publishing. It is a diagnostic, not a feature.
 *
 * ── AND IT IS REVERSIBLE ────────────────────────────────────────────────────────────────────
 * Every break is undone by `Restore`, which re-registers the real implementation and clears the
 * quarantine. Nothing here writes to storage, so a reload is also a full reset.
 */

import { useState } from "react";
import {
  engineDirect, engineDiagnostics, resetCapability,
  ENGINE_CAPABILITIES, ENGINE_VERSION, type EngineCapability,
} from "../encounter-engine";
import { registerActive } from "../encounter-engine/safeExecute";

const box: React.CSSProperties = {
  background: "#12121c", border: "1px solid #23233a", borderRadius: 6, padding: 10,
};

/** The real implementations, so `Restore` puts back exactly what was there. */
const REAL: Record<EngineCapability, unknown> = {
  estimateCreature: engineDirect.estimateCreature,
  resolvePartyProfile: engineDirect.resolvePartyProfile,
  checkEncounter: engineDirect.checkEncounter,
  aggregateAudit: engineDirect.aggregateAudit,
  auditCoverage: engineDirect.auditCoverage,
};

export function EngineDiagnosticsPanel({ enabled = false }: { enabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [, force] = useState(0);
  const refresh = () => force(n => n + 1);

  if (!enabled) return null;
  const diag = engineDiagnostics();
  const broken = ENGINE_CAPABILITIES.filter(c => diag[c].quarantined);

  /**
   * ⚠ THE INJECTED FAULT RETURNS A PLAUSIBLE-LOOKING OBJECT WITH ONE POISONED FIELD, not a throw.
   * A throw is the easy case and any try/catch would survive it. `NaN` in a real field is the
   * failure that reaches a DM looking like an answer, and proving the contract validator catches
   * THAT is the only version of this test worth running.
   */
  const breakIt = (c: EngineCapability) => {
    registerActive(c, (() => ({
      effectiveHp: NaN, effectiveAc: NaN, modeledDpr: NaN, estimatedCr: NaN,
      encounterEhp: NaN, startingEncounterDpr: NaN, rounds: [],
      monsterDprRound1: NaN, monsterDprRound2Plus: NaN, partySustain: NaN,
      covered: [], packets: [], unpriced: [], parameters: [], blocked: [], ok: true,
      size: NaN, level: NaN, sustain: NaN, dpr: {},
    })) as never);
    // Three calls trip the breaker, matching BREAKER_THRESHOLD.
    refresh();
  };

  const restore = (c: EngineCapability) => {
    registerActive(c, REAL[c] as never);
    resetCapability(c);
    refresh();
  };

  return (
    <div style={{ ...box, marginTop: 10, borderLeft: "3px solid #7b68ee" }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left",
          background: "transparent", border: "none", padding: 0, cursor: "pointer", color: "#7b68ee" }}>
        <span style={{ fontSize: 11, width: 12 }}>{open ? "▼" : "▶"}</span>
        <span style={{ fontSize: 12, fontWeight: 600 }}>Engine Diagnostics</span>
        <span style={{ fontSize: 10, color: "#667" }}>
          v{ENGINE_VERSION} · {broken.length === 0 ? "all healthy" : `${broken.length} quarantined`}
        </span>
        <span style={{ marginLeft: "auto", fontSize: 9, color: "#7b68ee99", letterSpacing: 0.4 }}>
          AUTHOR ONLY
        </span>
      </button>

      {open && (
        <div style={{ marginTop: 8, fontSize: 11 }}>
          <p style={{ margin: "0 0 7px", color: "#8a8aa0", lineHeight: 1.5 }}>
            Break a capability to prove the rest of the app keeps working. The injected fault returns
            a normal-looking result with <code>NaN</code> in it rather than throwing — the failure a
            try/catch would miss and a DM could not see. Three calls trip the breaker.
          </p>
          {ENGINE_CAPABILITIES.map(c => {
            const s = diag[c];
            return (
              <div key={c} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0",
                borderTop: "1px solid #1e1e30" }}>
                <span style={{ width: 150, color: s.quarantined ? "#e07b8a" : "#c9d0e8" }}>{c}</span>
                <span style={{ width: 90, fontSize: 10, color: s.quarantined ? "#e07b8a" : "#7be08a" }}>
                  {s.quarantined ? "QUARANTINED" : "active"}
                </span>
                <span style={{ width: 70, fontSize: 10, color: "#667" }}>
                  {s.failures > 0 ? `${s.failures} fail` : ""}
                </span>
                <span style={{ fontSize: 10, color: "#667" }}>
                  {s.hasFallback ? "recovery registered" : "no recovery — fails closed"}
                </span>
                <button type="button" onClick={() => breakIt(c)}
                  style={{ marginLeft: "auto", fontSize: 10, padding: "2px 7px", background: "#3a1c24",
                    color: "#e07b8a", border: "1px solid #6a3240", borderRadius: 3, cursor: "pointer" }}>
                  Break
                </button>
                <button type="button" onClick={() => restore(c)}
                  style={{ fontSize: 10, padding: "2px 7px", background: "#1c3a24", color: "#7be08a",
                    border: "1px solid #2a6e3a", borderRadius: 3, cursor: "pointer" }}>
                  Restore
                </button>
              </div>
            );
          })}
          {broken.length > 0 && (
            <p style={{ margin: "7px 0 0", color: "#c0a060", lineHeight: 1.5 }}>
              {broken.join(", ")} {broken.length === 1 ? "is" : "are"} quarantined. Everything else —
              combat, the library, equipment, and the other engine capabilities — should still be
              working. That is the whole claim Gate 7 asks you to confirm by hand.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
