/**
 * EncounterDifficultyPanel — the encounter checker, running the WORKBOOK's model.
 *
 * This is `simulateEncounter` from `checkerV2.ts` (a verified port of the workbook's own
 * reference runtime, 11/11 of its tests green) driven by app data. It replaced the previous
 * model wholesale — Christopher, 2026-08-14: *"why is the old model a thing still, this
 * replaces the checker wholesale."* Nothing here computes balance arithmetic of its own.
 *
 * The two DM inputs that matter most:
 *  · EQUIPMENT MODE — turning the Broken Chain campaign OFF is a first-class feature, because
 *    the campaign curve has its projected loot distribution baked in. A table not running the
 *    campaign gets `wotcStandard`: the generalized four-player progression, no assumed magic
 *    items, Convergence ignored.
 *  · DAMAGE ALLOCATION — focus fire or spread evenly. The contract is explicit that survivor
 *    counts are MODEL PROJECTIONS under the selected allocation, not observed outcomes.
 *
 * Any creature works. The roster adapter does not care whether a creature is SRD, Broken Chain,
 * or a DM's own homebrew — same arithmetic, same outputs.
 */

import { useMemo, useState } from "react";
import type { EncounterDefinition } from "../monsters/encounterLibrary";
import type { MainMonsterTemplate } from "../monsters/runtime/mainMonsterRuntime";
import {
  simulateEncounter, resolvePartyProfile,
  type DamageAllocation, type EncounterResult,
} from "./checkerV2";
import {
  GENERIC_CHECKER_LEVELS, isProjectedLevel, partySizeHpMultiplier,
  type PartyEquipmentMode,
} from "./partyCurveV2";
import { rosterFromTemplates } from "./rosterFromLibrary";
import { DEFAULT_PARTY_DEFENCE } from "./damageExpression";

const PARTY_SIZES = [3, 4, 5, 6] as const;
const MODES: { id: PartyEquipmentMode; label: string; blurb: string }[] = [
  { id: "wotcStandard", label: "Standard", blurb: "Generic 4-player progression. No assumed magic items; Convergence ignored. Use this when the table is not running The Broken Chain." },
  { id: "brokenChain", label: "Broken Chain", blurb: "Campaign gear overlay included — the projected campaign loot distribution is part of this curve." },
];
const ALLOCATIONS: { id: DamageAllocation; label: string; blurb: string }[] = [
  { id: "focus_fire", label: "Focus fire", blurb: "Sequential damage packing against equal per-PC pools. Projects the MOST individual downs for a given damage total." },
  { id: "spread_evenly", label: "Spread evenly", blurb: "Even allocation across equal per-PC pools. Every standing PC is damaged before anyone falls." },
];

const box: React.CSSProperties = {
  background: "#0d0d14", border: "1px solid #2a2a3e", borderRadius: 6, padding: "8px 10px",
};
const chip = (active: boolean): React.CSSProperties => ({
  fontSize: 10, fontWeight: active ? 700 : 500, padding: "3px 8px",
  background: active ? "#4f9dff" : "#0d0d14", color: active ? "#fff" : "#8a8aa0",
  border: `1px solid ${active ? "#4f9dff" : "#2a2a3e"}`, borderRadius: 4, cursor: "pointer",
});
const label: React.CSSProperties = {
  display: "block", fontSize: 10, color: "#8a8aa0", textTransform: "uppercase",
  letterSpacing: 1, marginBottom: 3,
};

export function EncounterDifficultyPanel({ encounters, monsterLibrary }: {
  encounters: EncounterDefinition[];
  monsterLibrary: MainMonsterTemplate[];
}) {
  const [open, setOpen] = useState(false);
  const [encounterId, setEncounterId] = useState<string>("");
  const [partySize, setPartySize] = useState<number>(4);
  const [partyLevel, setPartyLevel] = useState<number>(GENERIC_CHECKER_LEVELS.minimum);
  const [equipmentMode, setEquipmentMode] = useState<PartyEquipmentMode>("wotcStandard");
  const [allocation, setAllocation] = useState<DamageAllocation>("focus_fire");
  const [targetSafetyMargin, setTargetSafetyMargin] = useState<number>(1);
  /**
   * The party's own defensive numbers — a DM INPUT, because the workbook publishes the hit and
   * save FORMULAS but no party AC or save-bonus table anywhere in the bundle. Inventing one
   * here would move every damage figure in the checker on an unmeasured guess.
   */
  const [targetAc, setTargetAc] = useState<number>(DEFAULT_PARTY_DEFENCE.ac);
  const [targetSave, setTargetSave] = useState<number>(DEFAULT_PARTY_DEFENCE.saveBonus);

  const encounter = encounters.find(e => e.id === encounterId) ?? encounters[0];

  const roster = useMemo(() => {
    if (!encounter) return { roster: [], assumptions: [] };
    const entries = encounter.entries
      .map(entry => ({
        template: monsterLibrary.find(m => m.templateId === entry.templateId),
        quantity: Math.max(1, entry.count),
      }))
      .filter((e): e is { template: MainMonsterTemplate; quantity: number } => Boolean(e.template));
    // Kill priority: weakest bodies first — a party that is paying attention clears the cheap
    // ones to cut incoming damage. The simulation depletes groups in exactly this order.
    const built = rosterFromTemplates(entries, partyLevel, { ac: targetAc, saveBonus: targetSave });
    return {
      roster: [...built.roster].sort((a, b) => a.baseHp * a.quantity - b.baseHp * b.quantity),
      assumptions: built.assumptions,
    };
  }, [encounter, monsterLibrary, partyLevel, targetAc, targetSave]);

  const result = useMemo<EncounterResult | null>(() => {
    if (roster.roster.length === 0) return null;
    try {
      const party = resolvePartyProfile({ level: partyLevel, size: partySize, equipmentMode });
      return simulateEncounter({
        party: { size: party.size, sustain: party.sustain, dpr: party.dpr },
        roster: roster.roster,
        settings: { damageAllocation: allocation, targetSafetyMargin },
      });
    } catch {
      return null;
    }
  }, [roster, partyLevel, partySize, equipmentMode, allocation, targetSafetyMargin]);

  const profile = useMemo(() => {
    try { return resolvePartyProfile({ level: partyLevel, size: partySize, equipmentMode }); }
    catch { return null; }
  }, [partyLevel, partySize, equipmentMode]);

  const fatal = result?.fatalRound ?? null;
  const headline = !result ? { text: "no roster", color: "#8a6a2a" }
    : fatal !== null ? { text: `FATAL R${fatal}`, color: "#ff4444" }
    : { text: `CLEARS R${result.completionRound ?? "—"}`, color: "#4caf50" };

  return (
    <section style={{ marginBottom: 12, background: "#11131a", border: "1px solid #2a2a3e", borderLeft: "3px solid #4f9dff", borderRadius: 6 }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "8px 10px", background: "transparent", border: "none", color: "#fff", cursor: "pointer" }}
      >
        <span style={{ fontSize: 11, color: "#4f9dff", width: 12, flexShrink: 0 }}>{open ? "▼" : "▶"}</span>
        <span style={{ fontSize: 12, fontWeight: 600, flex: 1, minWidth: 0 }}>📊 Encounter Checker</span>
        <span style={{ fontSize: 10, color: "#666", flexShrink: 0 }}>workbook v3</span>
      </button>

      {open && (
        <div style={{ padding: "0 10px 10px" }}>
          {encounters.length === 0 ? (
            <p style={{ fontSize: 12, color: "#777", fontStyle: "italic", margin: 0 }}>
              No encounters yet. Build one with + Encounter first.
            </p>
          ) : (
            <>
              <div style={{ marginBottom: 8 }}>
                <label style={label}>Encounter</label>
                <select
                  value={encounter?.id ?? ""}
                  onChange={e => setEncounterId(e.target.value)}
                  style={{ width: "100%", fontSize: 11, padding: "3px 6px", borderRadius: 4, border: "1px solid #2a2a3e", background: "#0d0d14", color: "#ddd" }}
                >
                  {encounters.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>

              {/* Equipment mode — the campaign on/off switch. */}
              <div style={{ marginBottom: 8 }}>
                <label style={label}>Equipment mode</label>
                <div style={{ display: "flex", gap: 4 }}>
                  {MODES.map(m => (
                    <button key={m.id} type="button" title={m.blurb}
                      onClick={() => setEquipmentMode(m.id)} style={chip(equipmentMode === m.id)}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                <div>
                  <label style={label}>Party size</label>
                  <div style={{ display: "flex", gap: 4 }}>
                    {PARTY_SIZES.map(s => (
                      <button key={s} type="button" onClick={() => setPartySize(s)} style={chip(partySize === s)}
                        title={`HP multiplier ×${partySizeHpMultiplier(s)}`}>{s}P</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={label}>Party level</label>
                  <select
                    value={partyLevel}
                    onChange={e => setPartyLevel(Number(e.target.value))}
                    style={{ fontSize: 11, padding: "3px 6px", borderRadius: 4, border: "1px solid #2a2a3e", background: "#0d0d14", color: "#ddd" }}
                  >
                    {Array.from({ length: GENERIC_CHECKER_LEVELS.maximum - GENERIC_CHECKER_LEVELS.minimum + 1 },
                      (_, i) => GENERIC_CHECKER_LEVELS.minimum + i).map(l => (
                        <option key={l} value={l}>L{l}{isProjectedLevel(l) ? " (projected)" : ""}</option>
                      ))}
                  </select>
                </div>
                <div>
                  <label style={label}>Safety margin</label>
                  <input type="number" step="0.5" value={targetSafetyMargin}
                    onChange={e => setTargetSafetyMargin(Number(e.target.value))}
                    style={{ width: 60, fontSize: 11, padding: "3px 6px", borderRadius: 4, border: "1px solid #2a2a3e", background: "#0d0d14", color: "#ddd" }} />
                </div>
                <div title="Your table's own numbers. The workbook publishes the hit and save formulas but no party AC table, so this is yours to enter — it is never assumed from your level.">
                  <label style={label}>Party AC / save</label>
                  <div style={{ display: "flex", gap: 4 }}>
                    <input type="number" value={targetAc} onChange={e => setTargetAc(Number(e.target.value))}
                      style={{ width: 48, fontSize: 11, padding: "3px 6px", borderRadius: 4, border: "1px solid #2a2a3e", background: "#0d0d14", color: "#ddd" }} />
                    <input type="number" value={targetSave} onChange={e => setTargetSave(Number(e.target.value))}
                      style={{ width: 48, fontSize: 11, padding: "3px 6px", borderRadius: 4, border: "1px solid #2a2a3e", background: "#0d0d14", color: "#ddd" }} />
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={label}>Damage allocation</label>
                <div style={{ display: "flex", gap: 4 }}>
                  {ALLOCATIONS.map(a => (
                    <button key={a.id} type="button" title={a.blurb}
                      onClick={() => setAllocation(a.id)} style={chip(allocation === a.id)}>
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>

              {isProjectedLevel(partyLevel) && (
                <div style={{ ...box, borderColor: "#8a6a2a", marginBottom: 8, fontSize: 10, color: "#c9a227" }}>
                  ⚠ PROJECTED — levels 17–20 carry no field samples and are extrapolated.
                </div>
              )}

              {result && profile ? (
                <>
                  <div style={{ ...box, border: `1px solid ${headline.color}`, marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 5 }}>
                      <span style={{ fontSize: 20, fontWeight: 700, color: headline.color, lineHeight: 1 }}>
                        {headline.text}
                      </span>
                      <span style={{ fontSize: 11, color: "#aaa" }}>
                        {result.standingAtCompletion ?? 0} of {partySize} standing
                      </span>
                      <span style={{ marginLeft: "auto", fontSize: 10, color: "#8a8aa0" }}>
                        {result.downsAtCompletion ?? 0} down · {result.damagedButStandingAtCompletion ?? 0} damaged
                      </span>
                    </div>
                    <div style={{ fontSize: 10, color: "#777", lineHeight: 1.6 }}>
                      <div>
                        <span style={{ color: "#e0a87b" }}>EHP</span>{" "}
                        <strong style={{ color: "#aaa" }}>{result.encounterEhp.toFixed(0)}</strong>
                        <span style={{ color: "#555" }}> · roster DPR {result.startingEncounterDpr.toFixed(1)}</span>
                      </div>
                      <div>
                        <span style={{ color: "#7bc8e0" }}>PCER</span>{" "}
                        {result.pcer === null ? "—" : result.pcer.toFixed(2)}
                        <span style={{ color: "#555" }}> rds to clear · </span>
                        <span style={{ color: "#e07be0" }}>MER</span>{" "}
                        {result.mer === null ? "—" : result.mer.toFixed(2)}
                        <span style={{ color: "#555" }}> rds to fall · margin </span>
                        <strong style={{ color: (result.safetyMargin ?? 0) >= targetSafetyMargin ? "#4caf50" : "#e07b39" }}>
                          {result.safetyMargin === null ? "—" : result.safetyMargin.toFixed(2)}
                        </strong>
                      </div>
                      <div style={{ color: "#666" }}>
                        {partySize}P · L{partyLevel} · {equipmentMode === "brokenChain" ? "Broken Chain" : "Standard"}
                        {" · party "}{profile.dpr.round1.toFixed(0)}/{profile.dpr.round2.toFixed(0)}/
                        {profile.dpr.round3.toFixed(0)}/{profile.dpr.round4Plus.toFixed(0)} DPR
                        {" · sustain "}{profile.sustain.toFixed(0)}
                      </div>
                    </div>
                  </div>

                  {/* Balance adjustment — the contract's own recommendation output. */}
                  {result.balanceAdjustment.scaledHpChange !== null && (
                    <div style={{ ...box, marginBottom: 8, fontSize: 10, color: "#777" }}>
                      <span style={{ color: "#7be08a" }}>TO HIT A {targetSafetyMargin}-ROUND MARGIN</span>{" "}
                      <strong style={{ color: result.balanceAdjustment.scaledHpChange < 0 ? "#e07b39" : "#4caf50" }}>
                        {result.balanceAdjustment.scaledHpChange > 0 ? "+" : ""}
                        {result.balanceAdjustment.scaledHpChange.toFixed(0)} EHP
                      </strong>
                      <span style={{ color: "#555" }}>
                        {" ("}{((result.balanceAdjustment.percentChange ?? 0) * 100).toFixed(0)}%
                        {", "}{(result.balanceAdjustment.baseFourPcHpChange ?? 0).toFixed(0)} at the 4P base{")"}
                      </span>
                    </div>
                  )}

                  {/* NOTHING IS SILENT — *"if the checker has no idea how to parse something
                      it will tell the dm to cal[culate] that damage."* A silent OMISSION
                      reaches the total exactly as unchallenged as a silent substitute would.
                      A well-formed stat block should produce NONE of these; they mean
                      something is written wrong or is an inferred action. */}
                  {roster.assumptions.length > 0 && (
                    <div style={{ ...box, marginBottom: 8, fontSize: 10 }}>
                      <div style={{ fontWeight: 600, marginBottom: 2, color: "#c9a227" }}>
                        {roster.assumptions.length} thing{roster.assumptions.length === 1 ? "" : "s"} the checker could not price on its own
                      </div>
                      {roster.assumptions.map((a, i) => (
                        <div key={i} style={{ color: a.flag === "NEEDS DM INPUT" ? "#e07b39" : "#8a8aa0" }}>
                          [{a.flag}] {a.creature} · {a.field} — {a.detail}
                        </div>
                      ))}
                    </div>
                  )}

                  {result.specialOutcomeRisks.length > 0 && (
                    <div style={{ ...box, marginBottom: 8, fontSize: 10, color: "#c9a227" }}>
                      {result.specialOutcomeRisks.map((r, i) => (
                        <div key={i}>
                          ⚠ {r.creature} · {r.name} — earliest R{r.earliestRound},{" "}
                          {(r.probabilityAtLeastOne * 100).toFixed(0)}% at least one. Reported, never counted as damage.
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ fontSize: 9, color: "#666", marginBottom: 6 }}>
                    Survivor counts are model projections under {allocation === "focus_fire" ? "focus fire" : "even spread"}, not observed outcomes.
                    {" "}Every attack was resolved against AC {targetAc} and every save against a +{targetSave} bonus — your entry, not a workbook figure.
                  </div>

                  <details>
                    <summary style={{ fontSize: 10, color: "#8a8aa0", cursor: "pointer" }}>
                      Round by round ({result.rounds.length})
                    </summary>
                    <div style={{ fontSize: 9, color: "#777", marginTop: 4 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "24px repeat(6, 1fr)", gap: 3, color: "#8a8aa0", fontWeight: 600 }}>
                        <span>R</span><span>Party</span><span>Cum</span><span>EHP left</span><span>Mon dmg</span><span>Down</span><span>Standing</span>
                      </div>
                      {result.rounds.map(r => (
                        <div key={r.round} style={{ display: "grid", gridTemplateColumns: "24px repeat(6, 1fr)", gap: 3,
                          color: r.fatalNow ? "#ff4444" : r.completesNow ? "#4caf50" : "#777" }}>
                          <span>{r.round}</span>
                          <span>{r.partyDamage.toFixed(0)}</span>
                          <span>{r.cumulativePartyDamage.toFixed(0)}</span>
                          <span>{r.monsterEhpLeft.toFixed(0)}</span>
                          <span>{r.monsterDamage.toFixed(0)}</span>
                          <span>{r.downs}</span>
                          <span>{r.standing}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                </>
              ) : (
                <p style={{ fontSize: 11, color: "#8a6a2a", fontStyle: "italic" }}>
                  This encounter has no readable creatures yet.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
