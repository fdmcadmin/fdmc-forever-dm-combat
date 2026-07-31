/**
 * EncounterDifficultyPanel — P9.5 party-size / level band check (DM tool).
 *
 * Self-contained. Pick an encounter, choose a party size (4 / 5 / 6) and a pseudo
 * level, and get a difficulty rating + an add/remove recommendation to land the
 * fight in the "Standard" band (fair, not overpowered). Reads only the encounter
 * definitions + monster template library passed in as props; mutates nothing and
 * touches no P0–P9 state. Difficulty math lives in `encounterDifficulty.ts`.
 */

import { useMemo, useState } from "react";
import type { EncounterDefinition } from "../monsters/encounterLibrary";
import type { MainMonsterTemplate } from "../monsters/runtime/mainMonsterRuntime";
import { recommendAdjustment, unitThreat, type ThreatMonster, type Difficulty } from "./encounterDifficulty";
import { ESCALATION_LADDER, auditEncounter, estimateMonsterDamage, type EscalationId } from "./encounterConstruction";
import {
  estimateRounds, partyDpr, hpForPartySize, LANE_MULTIPLIER, LANE_LABEL, RESOURCE_LABEL, RESOURCE_MULTIPLIER,
  CLASSIFICATION_LABEL,
  type PartyLane, type PartyResources, type RoundsMonster, type RoundsEstimate,
} from "./encounterRounds";

// 3 / 4 / 5 — the campaign is authored against a FOUR-player baseline (Christopher,
// 2026-07-21). low/standard/high HP = 3P/4P/5P; an encounter's authored HP is its 4P total.
const PARTY_SIZES = [3, 4, 5] as const;
const LANES: PartyLane[] = ["easy", "standard", "hard", "punishing"];
const RESOURCES: PartyResources[] = ["fresh", "shortRest", "depleted"];

const VERDICT_COLOR: Record<RoundsEstimate["verdict"], string> = {
  Throwaway: "#ff4444",
  Short: "#e07b39",
  "On target": "#4caf50",
  Long: "#e07b39",
  Slog: "#ff4444",
};

const DIFFICULTY_COLOR: Record<Difficulty, string> = {
  Trivial: "#8a8aa0",
  Easy: "#5aa0e0",
  Standard: "#4caf50",
  Hard: "#e07b39",
  Deadly: "#ff4444",
};

// HP now scales off the SAME party size that drives partyDpr below. It used to come from a
// per-creature `entry.hpVariant`, so the defensive and offensive sides of the estimate could
// be told two different party sizes — a 5-man HP bar divided by 3-man damage.

function toThreatMonsters(encounter: EncounterDefinition, library: MainMonsterTemplate[], partySize: number): ThreatMonster[] {
  const out: ThreatMonster[] = [];
  for (const entry of encounter.entries) {
    const t = library.find(m => m.templateId === entry.templateId);
    if (!t) continue;
    out.push({
      id: entry.templateId,
      name: t.name,
      maxHp: hpForPartySize(t.stats.maxHp, partySize),
      // Threat weight comes from classification, never from kind. kind: "boss" driving a
      // hidden x1.6 here is the exact double-count MonsterClassification was introduced to
      // kill — it survived in this legacy panel until 2026-07-25.
      isBoss: t.stats.classification === "mid-boss"
        || t.stats.classification === "act-boss"
        || t.stats.classification === "final-boss",
      multiattack: (t.actions ?? []).some(a => /multiattack/i.test(a.name ?? "")),
      count: entry.count,
    });
  }
  return out;
}

function toRoundsMonsters(encounter: EncounterDefinition, library: MainMonsterTemplate[], partySize: number): RoundsMonster[] {
  const out: RoundsMonster[] = [];
  for (const entry of encounter.entries) {
    const t = library.find(m => m.templateId === entry.templateId);
    if (!t) continue;
    out.push({
      id: entry.templateId,
      name: t.name,
      maxHp: hpForPartySize(t.stats.maxHp, partySize),
      count: entry.count,
      ac: typeof t.stats.ac === "number" ? t.stats.ac : Number.parseInt(String(t.stats.ac), 10) || undefined,
      defenses: t.stats.defenses,
      damageUptime: t.stats.damageUptime,
      kitMultiplier: t.stats.kitMultiplier,
      classification: t.stats.classification ?? "normal",
    });
  }
  return out;
}

export function EncounterDifficultyPanel({ encounters, monsterLibrary }: {
  encounters: EncounterDefinition[];
  monsterLibrary: MainMonsterTemplate[];
}) {
  const [open, setOpen] = useState(false);
  const [encounterId, setEncounterId] = useState<string>("");
  const [partySize, setPartySize] = useState<number>(4);
  const [targetPosition, setTargetPosition] = useState<EscalationId | undefined>(undefined);
  const [partyLevel, setPartyLevel] = useState<number>(1);
  const [lane, setLane] = useState<PartyLane>("standard");
  const [resources, setResources] = useState<PartyResources>("fresh");

  const encounter = encounters.find(e => e.id === encounterId) ?? encounters[0];
  const monsters = useMemo(
    () => (encounter ? toThreatMonsters(encounter, monsterLibrary, partySize) : []),
    [encounter, monsterLibrary, partySize],
  );
  const rec = useMemo(
    () => recommendAdjustment(monsters, partySize, partyLevel),
    [monsters, partySize, partyLevel],
  );
  const roundsMonsters = useMemo(
    () => (encounter ? toRoundsMonsters(encounter, monsterLibrary, partySize) : []),
    [encounter, monsterLibrary, partySize],
  );
  const est = useMemo(
    () => estimateRounds(roundsMonsters, partySize, partyLevel, lane, resources, encounter?.classification),
    [roundsMonsters, partySize, partyLevel, lane, resources],
  );

  const diffColor = DIFFICULTY_COLOR[rec.difficulty];
  const vColor = VERDICT_COLOR[est.verdict];

  return (
    <section style={{ marginBottom: 12, background: "#11131a", border: "1px solid #2a2a3e", borderLeft: "3px solid #4f9dff", borderRadius: 6 }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "8px 10px", background: "transparent", border: "none", color: "#fff", cursor: "pointer" }}
        title={open ? "Collapse" : "Check encounter difficulty for a party"}
      >
        <span style={{ fontSize: 11, color: "#4f9dff", width: 12, flexShrink: 0 }}>{open ? "▼" : "▶"}</span>
        <span style={{ fontSize: 12, fontWeight: 600, flex: 1, minWidth: 0 }}>📊 Party-Size Check</span>
        <span style={{ fontSize: 10, color: "#666", flexShrink: 0 }}>homebrew guide</span>
      </button>

      {open && (
        <div style={{ padding: "0 10px 10px" }}>
          {encounters.length === 0 ? (
            <p style={{ fontSize: 12, color: "#777", fontStyle: "italic", margin: 0 }}>
              No encounters to check yet. Build one with + Encounter first.
            </p>
          ) : (
            <>
              {/* Encounter picker */}
              <label style={{ display: "block", fontSize: 10, color: "#8a8aa0", textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>Encounter</label>
              <select
                value={encounter?.id ?? ""}
                onChange={e => setEncounterId(e.target.value)}
                style={{ width: "100%", fontSize: 12, padding: "4px 6px", background: "#0d0d14", border: "1px solid #2a2a3e", borderRadius: 4, color: "#fff", marginBottom: 8 }}
              >
                {encounters.map(e => (
                  <option key={e.id} value={e.id}>{e.name}{e.actTag ? ` · ${e.actTag}` : ""}</option>
                ))}
              </select>

              {/* Party size 4/5/6 + pseudo-level */}
              <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: "#8a8aa0", textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>Party size</label>
                  <div style={{ display: "flex", gap: 4 }}>
                    {PARTY_SIZES.map(size => {
                      const active = partySize === size;
                      return (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setPartySize(size)}
                          style={{
                            width: 30, fontSize: 13, fontWeight: active ? 700 : 500, padding: "4px 0",
                            background: active ? "#4f9dff" : "#0d0d14",
                            color: active ? "#fff" : "#8a8aa0",
                            border: `1px solid ${active ? "#4f9dff" : "#2a2a3e"}`, borderRadius: 4, cursor: "pointer",
                          }}
                        >
                          {size}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  {/* ACTUAL party level. It used to say "pseudo level" and invite a +1 for the
                      bonds — the DPR table already prices the bonds in, so a +1 double-counts. */}
                  <label
                    style={{ display: "block", fontSize: 10, color: "#8a8aa0", textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}
                    title="The party's ACTUAL level. Do not add +1 for bonds — the DPR model already counts one free bond action per round."
                  >
                    Party level
                  </label>
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <button type="button" onClick={() => setPartyLevel(l => Math.max(1, l - 1))}
                      style={{ width: 24, fontSize: 14, padding: "3px 0", background: "#0d0d14", color: "#8a8aa0", border: "1px solid #2a2a3e", borderRadius: 4, cursor: "pointer" }}>−</button>
                    <span style={{ minWidth: 24, textAlign: "center", fontSize: 14, fontWeight: 600, color: "#fff" }}>{partyLevel}</span>
                    <button type="button" onClick={() => setPartyLevel(l => Math.min(20, l + 1))}
                      style={{ width: 24, fontSize: 14, padding: "3px 0", background: "#0d0d14", color: "#8a8aa0", border: "1px solid #2a2a3e", borderRadius: 4, cursor: "pointer" }}>+</button>
                  </div>
                </div>
              </div>

              {/* Party bond lane — a party of 4 running all-offence fights like a 5 */}
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: "block", fontSize: 10, color: "#8a8aa0", textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>Party bond lane</label>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {LANES.map(l => {
                    const active = lane === l;
                    return (
                      <button
                        key={l}
                        type="button"
                        onClick={() => setLane(l)}
                        title={`${LANE_LABEL[l]} — ${LANE_MULTIPLIER[l]}× midpoint DPR`}
                        style={{
                          fontSize: 10, fontWeight: active ? 700 : 500, padding: "3px 8px",
                          background: active ? "#4f9dff" : "#0d0d14",
                          color: active ? "#fff" : "#8a8aa0",
                          border: `1px solid ${active ? "#4f9dff" : "#2a2a3e"}`, borderRadius: 4, cursor: "pointer",
                        }}
                      >
                        {LANE_LABEL[l]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Resource state — fixed by the MAP, not chance (e.g. no long rest between
                  the Sentinels and the Drifter), so it belongs in the prediction. */}
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: "block", fontSize: 10, color: "#8a8aa0", textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>Resources at fight start</label>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {RESOURCES.map(r => {
                    const active = resources === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setResources(r)}
                        title={`${RESOURCE_LABEL[r]} — ${RESOURCE_MULTIPLIER[r]}× party DPR`}
                        style={{
                          fontSize: 10, fontWeight: active ? 700 : 500, padding: "3px 8px",
                          background: active ? "#4f9dff" : "#0d0d14",
                          color: active ? "#fff" : "#8a8aa0",
                          border: `1px solid ${active ? "#4f9dff" : "#2a2a3e"}`, borderRadius: 4, cursor: "pointer",
                        }}
                      >
                        {RESOURCE_LABEL[r]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ROUNDS TO KILL — the falsifiable number: predict here, count at the table */}
              <div style={{ background: "#0d0d14", border: `1px solid ${vColor}`, borderRadius: 6, padding: "8px 10px", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 22, fontWeight: 700, color: vColor, lineHeight: 1 }}>
                    {est.rounds.toFixed(1)}
                  </span>
                  <span style={{ fontSize: 12, color: "#aaa" }}>rounds to kill</span>
                  {/* The band this fight is judged against — set by its strongest creature. */}
                  <span
                    style={{ fontSize: 10, color: "#8a8aa0", border: "1px solid #2a2a3e", borderRadius: 10, padding: "2px 7px" }}
                    title={`${CLASSIFICATION_LABEL[est.classification]} target: ${est.band.min}–${est.band.max} rounds. The band is the wiggle room — anywhere inside it is On target.`}
                  >
                    {CLASSIFICATION_LABEL[est.classification]} · target {est.band.min}–{est.band.max}
                  </span>
                  <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: `${vColor}22`, border: `1px solid ${vColor}`, color: vColor }}>
                    {est.verdict}
                  </span>
                </div>
                {/* The two sides shown separately — defence (their HP) over offence (your
                    damage, after AC). Splitting them is what makes this a true check. */}
                <div style={{ fontSize: 10, color: "#777", lineHeight: 1.6 }}>
                  <div>
                    <span style={{ color: "#e0a87b" }}>DEF</span>{" "}
                    {Math.round(est.rawHp)} raw HP × traits → <strong style={{ color: "#aaa" }}>{Math.round(est.effectiveHp)} effective</strong>
                  </div>
                  <div>
                    <span style={{ color: "#7bc8e0" }}>OFF</span>{" "}
                    <strong style={{ color: "#aaa" }}>{est.landedDpr.toFixed(1)} DPR</strong>
                    <span style={{ color: "#555" }}> · already target-resolved vs the L{partyLevel} AC/save profile</span>
                  </div>
                  <div style={{ color: "#666" }}>
                    {partySize}P · L{partyLevel} · {LANE_MULTIPLIER[lane]}× lane · {RESOURCE_MULTIPLIER[resources]}× rest
                  </div>
                </div>
                {/* ── The escalation ladder: PCER against MER ────────────────────────
                    The rounds figure above only answers "how long". This answers "how
                    close to collapse", which is the half the old model could not see —
                    two fights can share a kill clock and be completely different fights. */}
                {(() => {
                  const monsterDamage = estimateMonsterDamage(
                    roundsMonsters.flatMap(m => {
                      const t = monsterLibrary.find(x => x.templateId === m.id);
                      return (t?.actions ?? []).map(a => ({ ...a, kind: a.kind as string }));
                    }),
                    { partyLevel },
                  );
                  const audit = auditEncounter({
                    monsterSustain: est.effectiveHp,
                    monsterDamage: monsterDamage.dpr,
                    level: partyLevel,
                    target: targetPosition,
                  });
                  const marginColor = audit.roundMargin >= 1 ? "#4caf50" : audit.roundMargin >= 0 ? "#e07b39" : "#ff4444";
                  return (
                    <div style={{ marginTop: 7, paddingTop: 6, borderTop: "1px solid #1e1e2e" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                        <span style={{ fontSize: 9, color: "#8a8aa0", textTransform: "uppercase", letterSpacing: 1 }}>Ladder</span>
                        <select
                          value={targetPosition ?? ""}
                          onChange={e => setTargetPosition((e.target.value || undefined) as EscalationId | undefined)}
                          style={{ fontSize: 10, padding: "1px 4px", borderRadius: 3, border: "1px solid #2a2a3e", background: "#0d0d14", color: "#aaa" }}
                        >
                          <option value="">— reads as: {audit.nearest.label} —</option>
                          {ESCALATION_LADDER.map(p => (
                            <option key={p.id} value={p.id}>{p.order}. {p.label} · {p.targetPcer} rds · {Math.round(p.pressure * 100)}%</option>
                          ))}
                        </select>
                      </div>
                      <div style={{ fontSize: 10, color: "#777", lineHeight: 1.6 }}>
                        <div>
                          <span style={{ color: "#7be08a" }}>PCER</span> {audit.pcer.toFixed(2)} rds
                          <span style={{ color: "#555" }}> · fight length</span>
                          {audit.target && (
                            <span style={{ color: Math.abs(audit.target.pcerDelta) <= 0.5 ? "#4caf50" : "#e07b39" }}>
                              {"  "}{audit.target.pcerDelta >= 0 ? "+" : ""}{audit.target.pcerDelta.toFixed(2)} vs target
                            </span>
                          )}
                        </div>
                        <div>
                          <span style={{ color: "#e07be0" }}>MER</span>{" "}
                          {Number.isFinite(audit.mer) ? `${audit.mer.toFixed(2)} rds` : "—"}
                          <span style={{ color: "#555" }}> · party collapse, at {monsterDamage.dpr.toFixed(1)} monster DPR</span>
                        </div>
                        <div>
                          <span style={{ color: "#e0c87b" }}>PRESSURE</span> {(audit.pressure * 100).toFixed(0)}%
                          {audit.target && (
                            <span style={{ color: Math.abs(audit.target.pressureDelta) <= 0.08 ? "#4caf50" : "#e07b39" }}>
                              {"  "}{audit.target.pressureDelta >= 0 ? "+" : ""}{(audit.target.pressureDelta * 100).toFixed(0)}pts vs target
                            </span>
                          )}
                          <span style={{ color: "#555" }}> · margin </span>
                          <strong style={{ color: marginColor }}>{audit.roundMargin.toFixed(2)} rds</strong>
                        </div>
                      </div>
                      {monsterDamage.unread.length > 0 && (
                        <div style={{ fontSize: 9, color: "#8a6a2a", marginTop: 3 }}>
                          ⚠ monster DPR is incomplete — could not read: {monsterDamage.unread.slice(0, 3).join("; ")}
                        </div>
                      )}
                      {monsterDamage.dpr <= 0 && (
                        <div style={{ fontSize: 9, color: "#8a6a2a", marginTop: 3 }}>
                          ⚠ no readable damage on these creatures, so MER and pressure are not meaningful yet.
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Itemised defensive traits — every uplift is named and checkable. */}
                {(() => {
                  const rows = roundsMonsters.flatMap(m =>
                    (m.defenses ?? []).map(d => ({ who: m.name, ...d })));
                  if (rows.length === 0) return null;
                  return (
                    <div style={{ marginTop: 6, paddingTop: 5, borderTop: "1px solid #1e1e2e", fontSize: 9, color: "#777" }}>
                      {rows.map((d, i) => (
                        <div key={`${d.who}-${d.name}-${i}`} style={{ display: "flex", gap: 6, padding: "1px 0" }} title={d.note}>
                          <span style={{ color: "#e0a87b", minWidth: 34 }}>×{d.ehpMultiplier.toFixed(2)}</span>
                          <span style={{ color: "#999" }}>{d.name}</span>
                          <span style={{ color: "#555", marginLeft: "auto" }}>{d.who}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
                <div style={{ fontSize: 9, color: "#666", marginTop: 4, fontStyle: "italic" }}>
                  Count the real rounds and compare. A mismatch means the model is wrong, not your table.
                </div>
              </div>

              {/* Legacy threat/budget verdict — unitless, kept for reference only */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 12, background: `${diffColor}22`, border: `1px solid ${diffColor}`, color: diffColor }}>
                  {rec.difficulty}
                </span>
                <span style={{ fontSize: 10, color: "#666" }}>
                  legacy: {rec.ratio.toFixed(2)}× budget · threat {Math.round(rec.threat)} vs {Math.round(rec.budget)}
                </span>
              </div>

              {/* Recommendation */}
              <p style={{
                margin: "0 0 8px", fontSize: 12, lineHeight: 1.4,
                color: rec.action === "none" ? "#7be08a" : "#e0c98a",
                background: rec.action === "none" ? "#13251a" : "#1f1a12",
                border: `1px solid ${rec.action === "none" ? "#2f7d3f" : "#5a4a1a"}`,
                borderRadius: 5, padding: "6px 8px",
              }}>
                {rec.action === "none" ? "✓ " : "→ "}{rec.summary}
                {rec.action !== "none" && (
                  <span style={{ color: "#888" }}> (projected {rec.projectedRatio.toFixed(2)}×)</span>
                )}
              </p>

              {/* Per-template breakdown */}
              <div style={{ fontSize: 11, color: "#888" }}>
                {monsters.map(m => {
                  const change = rec.changes.find(c => c.id === m.id);
                  return (
                    <div key={m.id} style={{ display: "flex", justifyContent: "space-between", padding: "1px 0" }}>
                      <span>
                        {m.count}× {m.name}
                        {m.isBoss && <span style={{ color: "#c8472e" }}> · boss</span>}
                        {m.multiattack && <span style={{ color: "#7b68ee" }}> · multiattack</span>}
                        {change && (
                          <span style={{ color: change.delta > 0 ? "#7be08a" : "#ff9999", fontWeight: 600 }}>
                            {"  "}{change.delta > 0 ? `+${change.delta}` : change.delta} → {change.resultingCount}
                          </span>
                        )}
                      </span>
                      <span style={{ color: "#666" }}>{Math.round(unitThreat(m) * m.count)}</span>
                    </div>
                  );
                })}
              </div>

              <p style={{ margin: "8px 0 0", fontSize: 9, color: "#555", lineHeight: 1.4 }}>
                Homebrew guide only (HP-based threat × party size/level) — not official CR. A lone
                boss often plays easier than its number says (action economy); tune to your table.
              </p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
