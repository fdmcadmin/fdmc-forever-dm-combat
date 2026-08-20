/**
 * CREATURE ESTIMATOR — the workbook v4 "Creature Estimator" sheet, as its own tool.
 *
 * ⚠ IT DOES NOT BELONG ON THE CREATOR PAGE, and it was there anyway. Christopher, 2026-08-20:
 * *"we had decided that the creature estimator wasnt suppose to be on the creator page, it was
 * suppose to be its own thing."*
 *
 * The reason it is its own thing is the same reason the sheet is its own sheet: it MEASURES a
 * creature, it does not help build one. Sitting inside the Defenses step it read as a live grade
 * on the numbers being typed — as though the creator were steering toward a target CR — when the
 * sheet's own bound is the opposite: *"it is not an official CR ruling and it never rewrites a
 * creature's printed action budget."* Nothing here writes to a creature, and now nothing here is
 * adjacent to the fields that do.
 *
 * ⚠ THE DPR COMES FROM THE TRACE, never from a number typed twice. `parseCreature` +
 * `traceCreature` are the same pair the encounter checker runs, so the estimate and the encounter
 * check can never disagree about what a creature does.
 */

import { useMemo, useState } from "react";
import type { MainMonsterTemplate } from "../monsters/runtime/mainMonsterRuntime";
import { CREATOR_BANDS, type CreatorBandId } from "../monsters/creator/monsterCreatorModel";
import { estimateCreature } from "./creatureEstimator";
import { parseCreature } from "./parseCreature";
import { traceCreature } from "./actionTrace";
import { partyDefenceAt } from "./partyDefenceCurve";
import type { PartyEquipmentMode } from "./partyCurveV2";

const box: React.CSSProperties = {
  background: "#12121c", border: "1px solid #23233a", borderRadius: 6, padding: 10,
};
const labelStyle: React.CSSProperties = {
  fontSize: 10, color: "#666", marginBottom: 1, display: "block",
};
const inputStyle: React.CSSProperties = {
  padding: "3px 7px", borderRadius: 4, border: "1px solid #444", background: "#111",
  color: "#fff", fontSize: 11, width: "100%",
};
const hintStyle: React.CSSProperties = {
  fontSize: 10, color: "#667", lineHeight: 1.5, margin: "4px 0 0",
};

export function CreatureEstimatorPanel({ monsterLibrary }: { monsterLibrary: MainMonsterTemplate[] }) {
  const [open, setOpen] = useState(false);
  const [templateId, setTemplateId] = useState<string>("");
  const [refBand, setRefBand] = useState<CreatorBandId>("mid");
  const [refMode, setRefMode] = useState<PartyEquipmentMode>("wotcStandard");
  const [desiredCr, setDesiredCr] = useState<number | undefined>(undefined);

  const template = monsterLibrary.find(t => t.templateId === templateId);

  const estimate = useMemo(() => {
    if (!template) return null;
    const parsed = parseCreature(template);
    const band = CREATOR_BANDS.find(b => b.id === refBand) ?? CREATOR_BANDS[1];
    const defence = partyDefenceAt(band.referenceLevel, refMode);
    const saveAverage = (defence.str + defence.dex + defence.con + defence.int + defence.wis + defence.cha) / 6;
    // THREE rounds, not four: v6 rates the legal three-round action sequence.
    const trace = traceCreature(parsed, {
      ac: defence.ac, saveBonus: saveAverage,
      saves: { str: defence.str, dex: defence.dex, con: defence.con, int: defence.int, wis: defence.wis, cha: defence.cha },
    }, 3);
    // The trait multiplier is the PRODUCT of the authored defences, matching the checker's own
    // combination rule. Flat effects belong in `ehpAdjustment`, AC-equivalent ones in `acAdjustment`.
    const traitMultiplier = (template.stats.defenses ?? [])
      .reduce((product, d) => product * (d.ehpMultiplier || 1), 1);
    const acValue = typeof template.stats.ac === "number"
      ? template.stats.ac : Number.parseInt(String(template.stats.ac), 10);
    const attackBonus = parsed.features.reduce((best, f) => Math.max(best, f.attackBonus ?? 0), 0);
    const saveDc = parsed.features.reduce((best, f) => Math.max(best, f.saveDc ?? 0), 0);
    return estimateCreature({
      rawHp: template.stats.maxHp || 0,
      ac: Number.isFinite(acValue) ? acValue : 15,
      ehpMultiplier: traitMultiplier,
      ehpAdjustment: 0,
      acAdjustment: 0,
      r1Dpr: trace.rounds[0]?.totalExpectedDamage ?? 0,
      r2PlusDpr: trace.rounds[1]?.totalExpectedDamage ?? 0,
      offenseBasis: attackBonus > 0 ? "attack" : "saveDc",
      attackBonus,
      saveDc,
      desiredCr,
    });
  }, [template, refBand, refMode, desiredCr]);

  const band = CREATOR_BANDS.find(b => b.id === refBand) ?? CREATOR_BANDS[1];
  const defence = partyDefenceAt(band.referenceLevel, refMode);

  return (
    <div style={{ ...box, marginTop: 10 }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left",
          background: "transparent", border: "none", padding: 0, cursor: "pointer", color: "#4f9dff" }}>
        <span style={{ fontSize: 11, width: 12 }}>{open ? "▼" : "▶"}</span>
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
          Creature estimator — workbook v4
        </span>
      </button>

      {open && (
        <>
          <p style={hintStyle}>
            Rates ONE creature on its own — what it survives and what it deals — and suggests a CR range. It measures; it never writes to the creature, and it is not an official CR ruling.
          </p>

          <div style={{ display: "flex", gap: 6, alignItems: "flex-end", flexWrap: "wrap", marginTop: 8 }}>
            <div style={{ flex: 2, minWidth: 200 }}>
              <span style={labelStyle}>Creature</span>
              <select value={templateId} onChange={e => setTemplateId(e.target.value)} style={inputStyle}>
                <option value="">— pick a creature —</option>
                {monsterLibrary.map(t => (
                  <option key={t.templateId} value={t.templateId}>
                    {t.name} (AC {String(t.stats.ac)} · {t.stats.maxHp} HP)
                  </option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 150 }}>
              <span style={labelStyle}>Rated against</span>
              <select value={refBand} onChange={e => setRefBand(e.target.value as CreatorBandId)} style={inputStyle}>
                {CREATOR_BANDS.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
              </select>
            </div>
            <div style={{ width: 120 }}>
              <span style={labelStyle}>Party</span>
              <select value={refMode} onChange={e => setRefMode(e.target.value as PartyEquipmentMode)} style={inputStyle}>
                <option value="wotcStandard">WotC standard</option>
                <option value="brokenChain">Broken Chain</option>
              </select>
            </div>
            <div style={{ width: 100 }}>
              <span style={labelStyle}>Desired CR</span>
              <input type="number" min={1} max={20} value={desiredCr ?? ""} placeholder="—"
                onChange={e => setDesiredCr(e.target.value ? Math.max(1, Math.min(20, Number(e.target.value))) : undefined)}
                style={inputStyle} />
            </div>
          </div>

          <p style={{ ...hintStyle, marginTop: 6 }}>
            L{band.referenceLevel} party · AC <strong style={{ color: "#99a" }}>{defence.ac}</strong>
            {" "}· saves STR {defence.str} DEX {defence.dex} CON {defence.con} INT {defence.int} WIS {defence.wis} CHA {defence.cha}
          </p>

          {!template && (
            <p style={{ ...hintStyle, color: "#555", fontStyle: "italic" }}>Pick a creature to rate it.</p>
          )}

          {template && estimate && (
            <>
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8, flexWrap: "wrap", fontSize: 11, color: "#99a" }}>
                <span>EHP multiplier <strong style={{ color: "#dfe4ff" }}>×{estimate.ehpMultiplier.toFixed(3)}</strong></span>
                <span>effective AC <strong style={{ color: "#dfe4ff" }}>{estimate.effectiveAc}</strong></span>
                <span>effective HP <strong style={{ color: "#dfe4ff" }}>{estimate.effectiveHp.toFixed(0)}</strong></span>
                <span>three-round DPR <strong style={{ color: "#dfe4ff" }}>{estimate.modeledDpr.toFixed(1)}</strong></span>
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 4, flexWrap: "wrap", fontSize: 11, color: "#99a" }}>
                <span>defensive CR <strong style={{ color: "#dfe4ff" }}>{estimate.baseDefensiveCr}</strong>
                  <span style={{ color: "#667" }}> → AC-adj {estimate.acAdjustedDefensiveCr}</span></span>
                <span>offensive CR <strong style={{ color: "#dfe4ff" }}>{estimate.baseOffensiveCr}</strong>
                  <span style={{ color: "#667" }}> → atk/DC-adj {estimate.deliveryAdjustedOffensiveCr}</span></span>
                <span>suggested <strong style={{ color: "#7be08a" }}>{estimate.crRange}</strong>
                  <span style={{ color: "#667" }}> centre {estimate.estimatedCr}</span></span>
                {estimate.capStatus !== "WITHIN CR 0-25 TABLE" && (
                  <span style={{ color: "#e8b64c" }}>{estimate.capStatus}</span>
                )}
              </div>
              <p style={{ ...hintStyle, marginTop: 6 }}>{estimate.guidance}</p>
              <p style={{ ...hintStyle, color: "#555" }}>
                Estimated from selected SRD medians — a practical range, not an official CR ruling. The DPR is this creature's own traced schedule, so it already respects Recharge, use limits and gating.
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}
