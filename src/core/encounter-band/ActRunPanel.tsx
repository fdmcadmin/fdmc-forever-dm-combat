/**
 * ACT RUN — compose a sequence of your own fights and see how the party fares across it.
 *
 * ⚠ NOTHING IS BUNDLED. The first version shipped Act 3 as a fixed ten-fight table, which is a
 * PRESET, and v7.4's architecture_rule forbids exactly that: *"No campaign encounter preset or
 * built-in monster roster may supply those values."* Christopher: *"the act run should be able to
 * choose the fights you use and show the run result."*
 *
 * THE CHAIN THIS SITS AT THE END OF:
 *   creature → ESTIMATOR (validate + price) → ENCOUNTER (assemble) → CHECKER (rate vs party level)
 *   → ACT RUN (sequence, carry rest state)
 *
 * This panel is the last link only. It sequences encounters the DM built and applies rest state
 * between them; it never prices a fight, and the checker and estimator are untouched.
 */

import { useEffect, useMemo, useState } from "react";
import {
  resolveActRun,
  restBlocks,
  runLevelGates,
  normalizeRun,
  allyOverlayActive,
  loadActRuns,
  saveActRuns,
  newActRun,
  REST_SEMANTICS,
  REST_STATUSES,
  type ActRun,
  type ActRunStep,
  type RestChoice,
  type RestType,
  type RestStatus,
} from "./actRun";
import type { EncounterDefinition } from "../monsters/encounterLibrary";

type ActRunPanelProps = {
  /** The DM's own encounters — the only thing a run may be built from. */
  encounters: EncounterDefinition[];
};

const REST_COLOR: Record<string, string> = { Long: "#7b68ee", Short: "#4caf50", None: "#555" };
const input = { width: "100%", padding: "2px 5px", borderRadius: 3, border: "1px solid #444", background: "#111", color: "#fff", fontSize: 11 } as const;

export function ActRunPanel({ encounters }: ActRunPanelProps) {
  const [runs, setRuns] = useState<ActRun[]>(() => loadActRuns());
  const [activeId, setActiveId] = useState<string>(() => loadActRuns()[0]?.id ?? "");
  const [choices, setChoices] = useState<Record<string, RestChoice>>({});
  const [addId, setAddId] = useState<string>("");

  useEffect(() => { saveActRuns(runs); }, [runs]);

  const run = runs.find(r => r.id === activeId);
  const resolved = useMemo(() => (run ? resolveActRun(run.steps, choices) : []), [run, choices]);
  const blocks = useMemo(() => restBlocks(resolved), [resolved]);
  const gates = useMemo(() => (run ? runLevelGates(run.steps) : []), [run]);
  const risky = resolved.filter(s => s.assumedRisky);

  function patchRun(id: string, up: Partial<ActRun>) {
    setRuns(rs => rs.map(r => (r.id === id ? { ...r, ...up } : r)));
  }
  function patchStep(stepId: string, up: Partial<ActRunStep>) {
    if (!run) return;
    patchRun(run.id, { steps: normalizeRun(run.steps.map(s => (s.id === stepId ? { ...s, ...up } : s))) });
  }
  function addFight() {
    if (!run || !addId) return;
    const enc = encounters.find(e => e.id === addId);
    if (!enc) return;
    const last = run.steps[run.steps.length - 1];
    const step: ActRunStep = {
      id: `s-${Date.now().toString(36)}`,
      sequence: run.steps.length + 1,
      encounterId: enc.id,
      name: enc.name,
      // A new fight starts where the previous one left the party — the run carries level forward.
      partyLevel: last?.levelAfter ?? 1,
      restType: "None", restStatus: "—", restDefault: "Skip",
      levelAfter: last?.levelAfter ?? 1,
    };
    patchRun(run.id, { steps: normalizeRun([...run.steps, step]) });
    setAddId("");
  }
  function move(stepId: string, dir: -1 | 1) {
    if (!run) return;
    const ordered = run.steps.slice().sort((a, b) => a.sequence - b.sequence);
    const i = ordered.findIndex(s => s.id === stepId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ordered.length) return;
    [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
    patchRun(run.id, { steps: normalizeRun(ordered.map((s, k) => ({ ...s, sequence: k + 1 }))) });
  }

  const cycle = (c: RestChoice): RestChoice => (c === "default" ? "complete" : c === "complete" ? "skip" : "default");

  return (
    <section style={{ marginBottom: 12, padding: "10px 12px", background: "#12101f", border: "1px solid #2a2a3e", borderRadius: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, fontSize: 13, color: "#9d8cff" }}>Act Run</h3>
        <select value={activeId} onChange={e => { setActiveId(e.target.value); setChoices({}); }}
          style={{ ...input, width: "auto", fontSize: 12 }}>
          <option value="">— pick a run —</option>
          {runs.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <button type="button" onClick={() => { const r = newActRun(`Run ${runs.length + 1}`); setRuns(rs => [...rs, r]); setActiveId(r.id); }}
          style={{ fontSize: 10, padding: "3px 9px", background: "#7b68ee22", border: "1px solid #7b68ee55", borderRadius: 3, color: "#7b68ee", cursor: "pointer" }}>
          + Run
        </button>
        {run && (
          <button type="button" onClick={() => { setRuns(rs => rs.filter(r => r.id !== run.id)); setActiveId(""); }}
            style={{ fontSize: 10, padding: "3px 8px", background: "transparent", border: "1px solid #5a1a1a", borderRadius: 3, color: "#ff9999", cursor: "pointer" }}>✕</button>
        )}
      </div>

      {!run && (
        <p style={{ fontSize: 11, color: "#666", margin: 0 }}>
          A run is a sequence of YOUR encounters. Nothing is bundled — build the creatures in the
          estimator, assemble them into encounters, then order those encounters here and set the
          rests between them.
        </p>
      )}

      {run && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 6, marginBottom: 8 }}>
            <label style={{ fontSize: 10, color: "#888" }}>Run name
              <input value={run.name} onChange={e => patchRun(run.id, { name: e.target.value })} style={input} />
            </label>
            <label style={{ fontSize: 10, color: "#888" }}>Party mode
              <select value={run.partyMode} onChange={e => patchRun(run.id, { partyMode: e.target.value as ActRun["partyMode"] })} style={input}>
                <option>Broken Chain</option><option>WotC Standard</option>
              </select>
            </label>
            <label style={{ fontSize: 10, color: "#888", display: "flex", alignItems: "center", gap: 4, paddingTop: 12 }}>
              <input type="checkbox" checked={Boolean(run.vsEntity)} onChange={e => patchRun(run.id, { vsEntity: e.target.checked || undefined })} />
              vs entity
            </label>
          </div>

          {/* Add a fight — only from encounters that exist. */}
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <select value={addId} onChange={e => setAddId(e.target.value)} style={{ ...input, flex: 1 }}>
              <option value="">— add a fight from your encounters —</option>
              {encounters.slice().sort((a, b) => (a.actTag ?? "").localeCompare(b.actTag ?? "") || a.name.localeCompare(b.name))
                .map(e => <option key={e.id} value={e.id}>{e.actTag ? `${e.actTag} · ` : ""}{e.name}</option>)}
            </select>
            <button type="button" onClick={addFight} disabled={!addId}
              style={{ fontSize: 11, padding: "3px 10px", background: addId ? "#2a6e2a" : "#222", border: "none", borderRadius: 3, color: addId ? "#fff" : "#555", cursor: addId ? "pointer" : "not-allowed" }}>
              + Fight
            </button>
          </div>

          {run.steps.length === 0 && (
            <p style={{ fontSize: 11, color: "#666", margin: "0 0 8px" }}>
              No fights yet. {encounters.length === 0
                ? "Build an encounter first — a run can only reference encounters you have made."
                : "Add one above."}
            </p>
          )}

          {blocks.length > 0 && (
            <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
              {blocks.map((b, i) => (
                <span key={i} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: "#1a1630", border: "1px solid #4b3f8f", color: "#cfc6ff" }}>
                  {b.fights} fight{b.fights === 1 ? "" : "s"} · {b.shortRests} short → {b.endsAt}
                </span>
              ))}
            </div>
          )}

          {risky.length > 0 && (
            <p style={{ fontSize: 11, color: "#e9a66a", margin: "0 0 8px" }}>
              ⚠ This run assumes {risky.length} rest{risky.length === 1 ? "" : "s"} that is not guaranteed
              ({risky.map(s => s.name).join(", ")}). Everything after the first is judged against
              resources the party may not have.
            </p>
          )}

          <div style={{ display: "grid", gap: 3 }}>
            {resolved.map(s => {
              const choice = choices[s.id] ?? "default";
              const missing = !encounters.some(e => e.id === s.encounterId);
              return (
                <div key={s.id} style={{ display: "flex", gap: 5, alignItems: "center", padding: "4px 6px", background: "#161622", border: `1px solid ${s.assumedRisky ? "#5a4a1a" : "#262638"}`, borderRadius: 4 }}>
                  <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    <button type="button" onClick={() => move(s.id, -1)} style={{ fontSize: 8, lineHeight: 1, padding: 0, background: "transparent", border: "none", color: "#666", cursor: "pointer" }}>▲</button>
                    <button type="button" onClick={() => move(s.id, 1)} style={{ fontSize: 8, lineHeight: 1, padding: 0, background: "transparent", border: "none", color: "#666", cursor: "pointer" }}>▼</button>
                  </span>
                  <span style={{ fontSize: 10, color: "#666", width: 16 }}>{s.sequence}</span>
                  {/* A renamed or deleted encounter says so rather than silently pricing nothing. */}
                  <span style={{ fontSize: 11, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: missing ? "#ff9999" : "#ddd" }}
                    title={missing ? "This encounter no longer exists in your library." : s.encounterId}>
                    {s.name}{missing ? " — missing" : ""}
                  </span>
                  <input type="number" value={s.partyLevel} onChange={e => patchStep(s.id, { partyLevel: Math.max(1, Number(e.target.value) || 1) })}
                    title="Party level for this fight" style={{ ...input, width: 42, textAlign: "center" }} />
                  <select value={s.restType} onChange={e => {
                      const rt = e.target.value as RestType;
                      patchStep(s.id, { restType: rt, ...(rt === "None" ? { restStatus: "—" as RestStatus, restDefault: "Skip" as const } : {}) });
                    }} style={{ ...input, width: 62 }}>
                    <option>None</option><option>Short</option><option>Long</option>
                  </select>
                  {s.restType !== "None" && (
                    <select value={s.restStatus} onChange={e => patchStep(s.id, { restStatus: e.target.value as RestStatus })}
                      title={REST_SEMANTICS[`${s.restType}/${s.restStatus}`] ?? ""} style={{ ...input, width: 92 }}>
                      {REST_STATUSES.filter(x => x !== "—").map(x => <option key={x}>{x}</option>)}
                    </select>
                  )}
                  <input type="number" value={s.levelAfter} onChange={e => patchStep(s.id, { levelAfter: Math.max(1, Number(e.target.value) || 1) })}
                    title="Level after this fight and its rest — set higher than the party level to make it a level gate"
                    style={{ ...input, width: 42, textAlign: "center", color: s.levelAfter > s.partyLevel ? "#4caf50" : "#fff" }} />
                  {s.restType !== "None" ? (
                    <button type="button" onClick={() => setChoices(c => ({ ...c, [s.id]: cycle(choice) }))}
                      title={`${s.restNote}\n\nClick to cycle: default → complete → skip`}
                      style={{
                        width: 86, fontSize: 10, padding: "2px 5px", borderRadius: 3, cursor: "pointer",
                        background: s.restTaken === "None" ? "transparent" : `${REST_COLOR[s.restTaken]}22`,
                        border: `1px solid ${choice !== "default" ? "#7b68ee" : s.restTaken === "None" ? "#333" : REST_COLOR[s.restTaken]}`,
                        color: s.restTaken === "None" ? "#666" : REST_COLOR[s.restTaken],
                      }}>
                      {s.restTaken === "None" ? "skipped" : s.restTaken}{choice !== "default" ? " *" : ""}
                    </button>
                  ) : <span style={{ width: 86 }} />}
                  <button type="button" onClick={() => patchRun(run.id, { steps: normalizeRun(run.steps.filter(x => x.id !== s.id)) })}
                    style={{ fontSize: 10, padding: "1px 5px", background: "transparent", border: "1px solid #5a1a1a", borderRadius: 3, color: "#ff9999", cursor: "pointer" }}>✕</button>
                </div>
              );
            })}
          </div>

          {gates.length > 0 && (
            <p style={{ fontSize: 10, color: "#666", margin: "8px 0 0" }}>
              Level gates: {gates.map(g => `${g.from}→${g.to} after ${g.after}`).join(" · ")}
            </p>
          )}
          {resolved.some(s => allyOverlayActive(run, s)) && (
            <p style={{ fontSize: 10, color: "#9d8cff", margin: "4px 0 0" }}>
              Ally overlay active on {resolved.filter(s => allyOverlayActive(run, s)).length} fight(s) —
              an allied actor, and deliberately NOT counted in party-size scaling.
            </p>
          )}
        </>
      )}

      <p style={{ fontSize: 9, color: "#555", margin: "6px 0 0" }}>
        Run setup only. Creatures are validated in the estimator, assembled into encounters, and each
        encounter is rated by the checker against the party level — this tab never prices anything.
      </p>
    </section>
  );
}
