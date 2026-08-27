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
 * This panel is the last link only. It sequences encounters the DM built, applies rest state
 * between them, and RUNS EACH FIGHT THROUGH THE CHECKER at its own party level with the party
 * arriving as spent as the fights before it left them. It contains no model of its own — every
 * number comes from rosterFromTemplates / resolvePartyProfile / simulateEncounter, the same three
 * calls the difficulty panel makes.
 */

import { useEffect, useMemo, useState } from "react";
import { SHORT_REST_RECOVERY } from "./partyResourceCurve";
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
  nextArrivalSpent,
} from "./actRun";
import type { EncounterDefinition } from "../monsters/encounterLibrary";
import { rosterFromTemplates } from "./rosterFromLibrary";
import { partyDamageMixFromActors, EMPTY_DAMAGE_MIX } from "./partyDamageMix";
import { simulateEncounter, resolvePartyProfile } from "./checkerV2";
import { partyDefenceAt } from "./partyDefenceCurve";
import type { MainMonsterTemplate } from "../monsters/runtime/mainMonsterRuntime";

type ActRunPanelProps = {
  /** The DM's own encounters — the only thing a run may be built from. */
  encounters: EncounterDefinition[];
  /**
   * The creature library as it ACTUALLY is — pass `resolveMonsterLibrary(...).library`, never the
   * bundled constant, or the run prices shipped creatures instead of the DM's edited ones.
   */
  monsterLibrary: MainMonsterTemplate[];
  /**
   * The DM's actors, for the same reason the difficulty panel takes them: a creature's typed
   * resistance is priced against the party's ACTUAL damage mix, not a figure someone types in.
   * Optional — with none readable the run prices exactly as it did before.
   */
  actors?: unknown[];
};

const REST_COLOR: Record<string, string> = { Long: "#7b68ee", Short: "#4caf50", None: "#555" };
const input = { width: "100%", padding: "2px 5px", borderRadius: 3, border: "1px solid #444", background: "#111", color: "#fff", fontSize: 11 } as const;

export function ActRunPanel({ encounters, monsterLibrary, actors = [] }: ActRunPanelProps) {
  const [runs, setRuns] = useState<ActRun[]>(() => loadActRuns());
  const [activeId, setActiveId] = useState<string>(() => loadActRuns()[0]?.id ?? "");
  const [choices, setChoices] = useState<Record<string, RestChoice>>({});
  const [addId, setAddId] = useState<string>("");

  useEffect(() => { saveActRuns(runs); }, [runs]);

  const run = runs.find(r => r.id === activeId);

  /**
   * What this party deals, by damage type — read only when the roster is UNAMBIGUOUS.
   *
   * ⚠ SAME DISCIPLINE AS THE DIFFICULTY PANEL, WITHOUT ITS PICKER. That panel makes the DM choose
   * WHICH actors are in a party when the library holds more than the party size, because reading
   * six actors' damage into a four-player fight overstates every share it produces — and an
   * overstated fire share overprices every fire-resistant creature in the act. This panel has no
   * such picker, so it reads the actors only when there is nothing to choose: exactly as many
   * player actors as the run's party size. Otherwise it reads none, and prices as it always did.
   */
  const partyDamageMix = useMemo(() => {
    const players = (actors as Array<{ kind?: string }>).filter(a => a?.kind === "player");
    const size = Math.max(1, run?.partySize ?? 4);
    return players.length === size ? partyDamageMixFromActors(players as never[]) : EMPTY_DAMAGE_MIX;
  }, [actors, run?.partySize]);
  const resolved = useMemo(() => (run ? resolveActRun(run.steps, choices) : []), [run, choices]);
  const blocks = useMemo(() => restBlocks(resolved), [resolved]);
  const gates = useMemo(() => (run ? runLevelGates(run.steps) : []), [run]);
  const risky = resolved.filter(s => s.assumedRisky);

  /**
   * ⚠ THE RUN RESULT — what this panel was missing. Christopher: *"the act run should be able to
   * choose the fights you use and SHOW THE RUN RESULT."* Until now it sequenced fights and carried
   * rest state without ever pricing one, so it could tell you the shape of a run and nothing about
   * how it goes.
   *
   * ⚠ IT STILL PRICES NOTHING ITSELF. Every number below comes from the same three calls the
   * difficulty panel makes — `rosterFromTemplates`, `resolvePartyProfile`, `simulateEncounter` —
   * at the step's own party level. There is no second model here; that is the whole lesson of the
   * four scripts retired at 0.7.36.
   *
   * THE SEQUENCE IS THE PART A RUN KNOWS. Each fight is priced with the party arriving as spent as
   * the fights before it left them (`customSustain`, the contract's own input for exactly this),
   * and a fight's cost is read from the checker's own `cumulativeMonsterDamage`. A long rest resets
   * it; a short rest gives back what the DM says it is worth, because v7 publishes no party
   * short-rest recovery and inventing one would silently move every fight after it.
   */
  const priced = useMemo(() => {
    const partySize = Math.max(1, run?.partySize ?? 4);
    const recovery = Math.max(0, Math.min(1, run?.shortRestRecovery ?? SHORT_REST_RECOVERY));
    let spent = 0;
    return resolved.map(step => {
      const encounter = encounters.find(e => e.id === step.encounterId);
      const arrivingSpent = spent;
      if (!encounter) {
        return { id: step.id, missing: true as const, arrivingSpent, result: null, cost: 0 };
      }
      try {
        const entries = encounter.entries
          .map(entry => ({
            template: monsterLibrary.find(m => m.templateId === entry.templateId),
            quantity: Math.max(1, entry.count),
          }))
          .filter((e): e is { template: MainMonsterTemplate; quantity: number } => Boolean(e.template));
        if (entries.length === 0) {
          return { id: step.id, missing: false as const, empty: true as const, arrivingSpent, result: null, cost: 0 };
        }
        // Party AC and save bonus come from the published defence curve for the run's mode — the
        // same two numbers the difficulty panel takes, derived the same way (the save bonus is the
        // mean of the six ability rows). Nothing here invents a party defence.
        const defence = partyDefenceAt(step.partyLevel, run?.partyMode === "Broken Chain" ? "brokenChain" : "wotcStandard");
        const saveBonus = (defence.str + defence.dex + defence.con + defence.int + defence.wis + defence.cha) / 6;
        const built = rosterFromTemplates(entries, step.partyLevel, {
          ac: defence.ac, saveBonus, partySize, damageMix: partyDamageMix,
        });
        // Weakest bodies first — the same kill priority the difficulty panel simulates.
        const roster = [...built.roster].sort((a, b) => a.baseHp * a.quantity - b.baseHp * b.quantity);
        const full = resolvePartyProfile({ level: step.partyLevel, size: partySize });
        const profile = arrivingSpent > 0
          ? resolvePartyProfile({ level: step.partyLevel, size: partySize, customSustain: full.sustain * (1 - arrivingSpent) })
          : full;
        const result = simulateEncounter({
          party: { size: profile.size, sustain: profile.sustain, dpr: profile.dpr },
          roster,
        });
        // What the fight actually took out of the party, as a share of a FULL pool — so the
        // fractions stay comparable across a block however depleted the party already was.
        const taken = result.rounds[result.rounds.length - 1]?.cumulativeMonsterDamage ?? 0;
        const cost = full.sustain > 0 ? taken / full.sustain : 0;
        spent = nextArrivalSpent(spent, cost, step.restTaken, recovery);
        return { id: step.id, missing: false as const, arrivingSpent, result, cost };
      } catch {
        return { id: step.id, missing: false as const, failed: true as const, arrivingSpent, result: null, cost: 0 };
      }
    });
  }, [resolved, encounters, monsterLibrary, run?.partySize, run?.shortRestRecovery, run?.partyMode, partyDamageMix]);

  const pricedById = useMemo(() => new Map(priced.map(p => [p.id, p])), [priced]);

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
                      /**
                       * ⚠ THE REST DEFAULT MUST MOVE WITH THE TYPE, AND IT DID NOT.
                       *
                       * A step is created with `restDefault: "Skip"`, which is right while
                       * `restType` is "None". Choosing Long or Short changed only the TYPE, so the
                       * step kept "Skip" — and `restCompletesByDefault` bails on "Skip" before it
                       * ever looks at the status. Every rest a DM added was silently not taken:
                       * the button read "skipped" and the party carried its whole spend forward.
                       *
                       * Visible in Christopher's Act 3 run — Gate I is a Long/Safe rest, and the
                       * Hollow Feast after it still arrived at 97% spent and wiped in round 1. A
                       * long rest resets to 0, which `nextArrivalSpent` has always done correctly;
                       * it was never being told the rest happened.
                       *
                       * "Take" rather than "Complete": Take lets the STATUS decide, so Set/Safe/
                       * Available complete and Threatened/Unsafe/Conditional still do not — which
                       * is the whole reason a status sits beside the type. Skipping stays a
                       * deliberate act through the cycle button.
                       */
                      patchStep(s.id, rt === "None"
                        ? { restType: rt, restStatus: "—" as RestStatus, restDefault: "Skip" as const }
                        : { restType: rt, restDefault: "Take" as const });
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
                  {/* ── THE RESULT, per fight ────────────────────────────────────────────
                      Arrival state first, because it is what makes this a RUN rather than a
                      list: the same fight reads differently third-in-a-block than fresh. */}
                  {(() => {
                    const p = pricedById.get(s.id);
                    if (!p) return null;
                    if (p.missing) return <span style={{ fontSize: 10, color: "#ff9999", width: 168, textAlign: "right" }}>no encounter</span>;
                    if ("empty" in p && p.empty) return <span style={{ fontSize: 10, color: "#e9a66a", width: 168, textAlign: "right" }}>no creatures</span>;
                    if (!p.result) return <span style={{ fontSize: 10, color: "#666", width: 168, textAlign: "right" }}>not priced</span>;
                    const r = p.result;
                    const cleared = r.completionRound !== null;
                    const fatal = r.fatalRound !== null;
                    const verdict = fatal ? `WIPE R${r.fatalRound}` : cleared ? `clear R${r.completionRound}` : "no resolution";
                    const colour = fatal ? "#ff5840" : cleared ? "#4bb469" : "#e9a66a";
                    const downs = r.downsAtCompletion ?? 0;
                    return (
                      <span style={{ display: "flex", alignItems: "baseline", gap: 6, width: 168, justifyContent: "flex-end", whiteSpace: "nowrap" }}
                        title={`Arrives with ${Math.round(p.arrivingSpent * 100)}% of its sustain already spent.\nThis fight costs ${Math.round(p.cost * 100)}% of a full pool.\n${downs} down at completion.`}>
                        <span style={{ fontSize: 9, color: p.arrivingSpent >= 0.6 ? "#e9a66a" : "#667", fontVariantNumeric: "tabular-nums" }}>
                          in {Math.round(p.arrivingSpent * 100)}%
                        </span>
                        <span style={{ fontSize: 10, color: colour, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{verdict}</span>
                        {downs > 0 && <span style={{ fontSize: 9, color: "#e08585" }}>{downs}&#8595;</span>}
                      </span>
                    );
                  })()}
                  <button type="button" onClick={() => patchRun(run.id, { steps: normalizeRun(run.steps.filter(x => x.id !== s.id)) })}
                    style={{ fontSize: 10, padding: "1px 5px", background: "transparent", border: "1px solid #5a1a1a", borderRadius: 3, color: "#ff9999", cursor: "pointer" }}>✕</button>
                </div>
              );
            })}
          </div>

          {/* ── THE RUN RESULT ───────────────────────────────────────────────────────────
              A run's answer is not its worst fight; it is where the party ends up, and whether
              anything killed them on the way. */}
          {(() => {
            const rated = priced.filter(p => p.result);
            if (rated.length === 0) return null;
            const wipes = rated.filter(p => p.result!.fatalRound !== null);
            const unresolved = rated.filter(p => p.result!.fatalRound === null && p.result!.completionRound === null);
            const last = priced[priced.length - 1];
            const worst = rated.reduce((a, b) => (b.arrivingSpent > a.arrivingSpent ? b : a));
            const finalSpent = last ? Math.min(1, last.arrivingSpent + last.cost) : 0;
            return (
              <div style={{ marginTop: 8, padding: "7px 9px", background: "#12131c", border: `1px solid ${wipes.length ? "#5a1a1a" : "#262638"}`, borderRadius: 4 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "#8a7a52" }}>Run result</span>
                  <span style={{ fontSize: 11, color: wipes.length ? "#ff5840" : "#4bb469", fontWeight: 600 }}>
                    {wipes.length === 0
                      ? `${rated.length} fights, no wipe`
                      : `${wipes.length} wipe${wipes.length === 1 ? "" : "s"}: ${wipes.map(w => resolved.find(x => x.id === w.id)?.name).filter(Boolean).join(", ")}`}
                  </span>
                  <span style={{ fontSize: 11, color: "#aab", fontVariantNumeric: "tabular-nums" }}>
                    ends at {Math.round(finalSpent * 100)}% spent
                  </span>
                  <span style={{ fontSize: 10, color: "#667", fontVariantNumeric: "tabular-nums" }}>
                    deepest arrival {Math.round(worst.arrivingSpent * 100)}%
                  </span>
                </div>
                {unresolved.length > 0 && (
                  <p style={{ fontSize: 10, color: "#e9a66a", margin: "4px 0 0" }}>
                    {unresolved.length} fight{unresolved.length === 1 ? "" : "s"} never resolved within the
                    round cap — the party cannot finish {unresolved.length === 1 ? "it" : "them"} at this level.
                  </p>
                )}
                {/* The one number the workbook does not publish, printed where it is used. */}
                <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, fontSize: 10, color: "#8a8a9a" }}>
                  A short rest returns
                  <input type="number" min={0} max={100} value={Math.round((run.shortRestRecovery ?? SHORT_REST_RECOVERY) * 100)}
                    onChange={e => patchRun(run.id, { shortRestRecovery: Math.max(0, Math.min(100, Number(e.target.value) || 0)) / 100 })}
                    style={{ ...input, width: 46, textAlign: "center" }} />
                  % of sustain
                  <span style={{ color: "#555" }}>
                    — your table's call. v7 publishes no party short-rest recovery, so the run will not invent one.
                  </span>
                </label>
              </div>
            );
          })()}

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
        Creatures are validated in the estimator, assembled into encounters, and rated by the checker
        against the party level. This tab sequences them and carries rest state; every number above is
        the checker's own, run once per fight at that fight's arrival state.
      </p>
    </section>
  );
}
