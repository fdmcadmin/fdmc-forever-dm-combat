/**
 * ACT RUN — play an act end to end and see where the party actually stands.
 *
 * Christopher: *"i should be able to choose act 3 and then set the rests and long rest and see
 * how the party fairs."*
 *
 * ⚠ THIS PANEL PRICES NOTHING. The workbook's own header draws the line — *"App-facing run setup
 * only. Encounters are built in Encounter Checker from estimator-priced creatures."* — and the
 * instruction was *"dont change anything from the corrected estimator and checker"*. So this
 * sequences fights and applies rest state; the checker and the estimator are untouched and remain
 * the only things that judge a fight.
 *
 * WHAT IT IS FOR. A single fight rated in isolation always looks survivable. An act is a chain of
 * them with rests in known places, and the question a DM actually has is whether the party arrives
 * at the finale with anything left. The risky-rest flag is the point: a run that quietly completes
 * a Threatened short rest reports a party in better shape than the campaign can promise, and every
 * fight after it is judged against resources they might not have.
 */

import { useMemo, useState } from "react";
import {
  resolveActRun,
  actLevelGates,
  actsIn,
  haleOverlayActive,
  REST_SEMANTICS,
  type ActRunStep,
  type RestChoice,
} from "./actRun";

type ActRunPanelProps = {
  /** The campaign's authored run sequences. Empty = nothing to run. */
  steps: ActRunStep[];
};

const REST_COLOR: Record<string, string> = {
  Long: "#7b68ee",
  Short: "#4caf50",
  None: "#555",
};

export function ActRunPanel({ steps }: ActRunPanelProps) {
  const acts = useMemo(() => actsIn(steps), [steps]);
  const [act, setAct] = useState<string>(acts[0] ?? "");
  const [choices, setChoices] = useState<Record<string, RestChoice>>({});

  const actSteps = useMemo(() => steps.filter(s => s.act === act), [steps, act]);
  const resolved = useMemo(() => resolveActRun(actSteps, choices), [actSteps, choices]);
  const gates = useMemo(() => actLevelGates(actSteps), [actSteps]);

  if (steps.length === 0) return null;

  /**
   * How far the party gets before the next full reset.
   *
   * A LONG rest is the only thing that truly resets the party, so the meaningful unit is the
   * block between long rests — that is the stretch resources have to cover. Counting fights since
   * the last long rest answers the question a DM is actually asking.
   */
  const blocks: { from: string; fights: number; shortRests: number; endsAt: string }[] = [];
  let cur = { from: resolved[0]?.name ?? "", fights: 0, shortRests: 0, endsAt: "" };
  for (const s of resolved) {
    cur.fights += 1;
    if (s.restTaken === "Short") cur.shortRests += 1;
    if (s.restTaken === "Long") {
      cur.endsAt = s.name;
      blocks.push(cur);
      cur = { from: "", fights: 0, shortRests: 0, endsAt: "" };
    }
  }
  if (cur.fights > 0) { cur.endsAt = "end of act"; blocks.push(cur); }

  const risky = resolved.filter(s => s.assumedRisky);
  const hale = resolved.filter(s => haleOverlayActive(s));

  const cycle = (id: string, current: RestChoice): RestChoice =>
    current === "default" ? "complete" : current === "complete" ? "skip" : "default";

  return (
    <section style={{ marginBottom: 12, padding: "10px 12px", background: "#12101f", border: "1px solid #2a2a3e", borderRadius: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, fontSize: 13, color: "#9d8cff" }}>Act Run</h3>
        <select value={act} onChange={e => { setAct(e.target.value); setChoices({}); }}
          style={{ fontSize: 12, padding: "3px 8px", borderRadius: 3, border: "1px solid #444", background: "#111", color: "#fff" }}>
          {acts.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <span style={{ fontSize: 10, color: "#666" }}>
          {actSteps.length} fights · levels {Math.min(...actSteps.map(s => s.partyLevel))}–{Math.max(...actSteps.map(s => s.levelAfter))}
        </span>
        {Object.keys(choices).length > 0 && (
          <button type="button" onClick={() => setChoices({})}
            style={{ fontSize: 10, padding: "2px 8px", background: "transparent", border: "1px solid #444", borderRadius: 3, color: "#888", cursor: "pointer" }}>
            reset rests
          </button>
        )}
      </div>

      {/* Blocks between long rests — the stretch the party's resources have to cover. */}
      <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
        {blocks.map((b, i) => (
          <span key={i} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: "#1a1630", border: "1px solid #4b3f8f", color: "#cfc6ff" }}>
            {b.fights} fight{b.fights === 1 ? "" : "s"} · {b.shortRests} short → {b.endsAt}
          </span>
        ))}
      </div>

      {risky.length > 0 && (
        <p style={{ fontSize: 11, color: "#e9a66a", margin: "0 0 8px" }}>
          ⚠ This run assumes {risky.length} rest{risky.length === 1 ? "" : "s"} the campaign does not
          guarantee ({risky.map(s => s.encounterId).join(", ")}). Everything after {risky[0].encounterId} is
          judged against resources the party may not have.
        </p>
      )}

      <div style={{ display: "grid", gap: 3 }}>
        {resolved.map(s => {
          const choice = choices[s.encounterId] ?? "default";
          const overridden = choice !== "default";
          return (
            <div key={s.encounterId}
              style={{ display: "flex", gap: 8, alignItems: "center", padding: "4px 6px", background: "#161622", border: `1px solid ${s.assumedRisky ? "#5a4a1a" : "#262638"}`, borderRadius: 4 }}>
              <span style={{ fontSize: 10, color: "#666", width: 46, flexShrink: 0 }}>{s.encounterId}</span>
              <span style={{ fontSize: 11, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
              <span style={{ fontSize: 10, color: "#888", width: 26, flexShrink: 0 }}>L{s.partyLevel}</span>
              {s.levelAfter > s.partyLevel && (
                <span style={{ fontSize: 9, color: "#4caf50", flexShrink: 0 }}>→L{s.levelAfter}</span>
              )}
              {s.restType === "None" ? (
                <span style={{ fontSize: 10, color: "#444", width: 122, textAlign: "right", flexShrink: 0 }}>no rest</span>
              ) : (
                <button type="button"
                  onClick={() => setChoices(c => ({ ...c, [s.encounterId]: cycle(s.encounterId, choice) }))}
                  title={`${s.restType} / ${s.restStatus}\n${REST_SEMANTICS[`${s.restType}/${s.restStatus}`] ?? ""}\n\nClick to cycle: default → complete → skip`}
                  style={{
                    width: 122, flexShrink: 0, fontSize: 10, padding: "2px 6px", borderRadius: 3, cursor: "pointer", textAlign: "right",
                    background: s.restTaken === "None" ? "transparent" : `${REST_COLOR[s.restTaken]}22`,
                    border: `1px solid ${overridden ? "#7b68ee" : s.restTaken === "None" ? "#333" : REST_COLOR[s.restTaken]}`,
                    color: s.restTaken === "None" ? "#666" : REST_COLOR[s.restTaken],
                  }}>
                  {s.restTaken === "None" ? `${s.restType} skipped` : `${s.restTaken} · ${s.restStatus}`}
                  {overridden ? " *" : ""}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {gates.length > 0 && (
        <p style={{ fontSize: 10, color: "#666", margin: "8px 0 0" }}>
          Level gates: {gates.map(g => `${g.from}→${g.to} after ${g.after}`).join(" · ")}
        </p>
      )}
      {hale.length > 0 && (
        <p style={{ fontSize: 10, color: "#9d8cff", margin: "4px 0 0" }}>
          Hale ally overlay active on {hale.length} fight(s) — an allied actor, and deliberately NOT
          counted in party-size scaling.
        </p>
      )}
      <p style={{ fontSize: 9, color: "#555", margin: "6px 0 0" }}>
        Run setup only. Each fight is priced by the Encounter Checker from estimator-priced creatures —
        this tab never prices anything itself.
      </p>
    </section>
  );
}
