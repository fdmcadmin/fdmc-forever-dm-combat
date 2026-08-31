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
import type { TemplateBodyChoice } from "../monsters/encounterLibrary";
import {
  simulateEncounter, resolvePartyProfile, effectiveHpPerBody,
  type DamageAllocation, type EncounterResult,
} from "./checkerV2";
import { aggregateAudit, auditDivergence, type AggregateAudit } from "./aggregateAudit";
import {
  GENERIC_CHECKER_LEVELS, isProjectedLevel, partySizeHpMultiplier,
  type PartyEquipmentMode,
} from "./partyCurveV2";
import { rosterFromTemplates } from "./rosterFromLibrary";
import { partyDefenceAt } from "./partyDefenceCurve";
import { partyHealingFromActors } from "./partyHealingFromActors";
import { partyFeatsFromActors } from "../../modules/dnd-5e/featsFromActors";
import { incomingSaveExposure, meanTargetAc } from "./incomingSaveExposure";
import { partyDamageMixFromActors, EMPTY_DAMAGE_MIX } from "./partyDamageMix";

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

export function EncounterDifficultyPanel({ encounters, monsterLibrary, actors = [] }: {
  encounters: EncounterDefinition[];
  monsterLibrary: MainMonsterTemplate[];
  /**
   * The party as the app currently holds it. Optional so any other caller still works, but
   * supplying it is what closes v9’s class-healing blocker: an abstract 128-party profile can
   * never know somebody is a Paladin, and these actors say so.
   */
  actors?: unknown[];
}) {
  const [open, setOpen] = useState(false);
  const [encounterId, setEncounterId] = useState<string>("");
  const [partySize, setPartySize] = useState<number>(4);
  const [partyLevel, setPartyLevel] = useState<number>(GENERIC_CHECKER_LEVELS.minimum);
  const [equipmentMode, setEquipmentMode] = useState<PartyEquipmentMode>("wotcStandard");
  const [allocation, setAllocation] = useState<DamageAllocation>("focus_fire");
  const [targetSafetyMargin, setTargetSafetyMargin] = useState<number>(1);
  /**
   * ⚠ AC AND SAVES ARE NOW READ, NOT ASKED FOR. v7 ships `party_defense_curve` — an average AC and
   * all SIX save averages, by level and by equipment mode. The checker used to require a typed AC
   * because the workbook published the formulas and no table; it publishes the table now.
   *
   * `null` means "use the curve". A typed value overrides it, because a real table is not the
   * average table — and the override is what stops an automatic number being unarguable.
   */
  const [acOverride, setAcOverride] = useState<number | null>(null);
  const [saveOverride, setSaveOverride] = useState<number | null>(null);
  const defence = partyDefenceAt(partyLevel, equipmentMode);
  const targetAc = acOverride ?? defence.ac;
  /** Six saves, unless the DM has typed one number to flatten them. */
  const saves = saveOverride === null
    ? { str: defence.str, dex: defence.dex, con: defence.con, int: defence.int, wis: defence.wis, cha: defence.cha }
    : { str: saveOverride, dex: saveOverride, con: saveOverride, int: saveOverride, wis: saveOverride, cha: saveOverride };
  const targetSave = saveOverride ?? (defence.str + defence.dex + defence.con + defence.int + defence.wis + defence.cha) / 6;
  /** Whether the checker is using the curve or the DM's typed numbers — surfaced in the panel. */
  const isOverridden = acOverride !== null || saveOverride !== null;
  const curveModeLabel = equipmentMode === "brokenChain" ? "Broken Chain" : "WotC standard";
  /** Share of the party's sustain already spent when this fight starts. 0 = fresh. */
  const [arrivingSpent, setArrivingSpent] = useState<number>(0);

  /**
   * ⚠ THE PARTY IS THE ACTORS. There is no built-in party and there must not be one —
   * `brokenChainActors` is deliberately empty, and everything below reads the DM's own library.
   *
   * Christopher: *"if someone puts 6 on the party size but has 4 actors in the data then the
   * response is add more actors due to unable to read enough actors, if 4 and the party is 5 then
   * it should be check which actors you want to use for this party."*
   *
   * Party size is a curve input — it picks the HP band and scales the DPR — so it is not merely
   * decorative when it disagrees with the roster. Too FEW actors means the checker is pricing a
   * party that does not exist; too MANY means it is guessing which of them showed up.
   */
  const players = useMemo(
    () => (actors as Array<{ id?: string; name?: string; kind?: string }>).filter(a => a?.kind === "player"),
    [actors],
  );
  /**
   * Which of the DM's actors are in THIS party.
   *
   * ⚠ MORE ACTORS THAN SEATS MEANS UNRESOLVED, NOT "ALL OF THEM". Defaulting to every actor read
   * six characters' healing pools into a four-player party, which is a guess wearing a number.
   * The party is not resolved until exactly `partySize` are chosen, and until then nothing is
   * read off the actors at all.
   */
  const [chosenActorIds, setChosenActorIds] = useState<string[]>([]);
  const chosen = useMemo(
    () => players.length === partySize
      ? players
      : players.filter(a => chosenActorIds.includes(a.id ?? "")),
    [players, partySize, chosenActorIds],
  );
  const resolved = chosen.length === partySize;

  /**
   * The same three answers at every size from 3 to 6 — Christopher: *"3 player would make you
   * check which 3 if you had more, 4 same as 3 but if you only had 3 it would tell you not enough
   * actors in the profile to read correctly, same with 5 and same with 6."*
   *
   * Party size is a CURVE INPUT: it picks the HP band and scales DPR and sustain. So a mismatch
   * is not cosmetic — too few actors means the checker is being asked about a party that is not
   * in the data, and too many means it does not know which of them showed up.
   */
  const rosterFit: { level: "ok" | "short" | "over"; message: string } =
    players.length === 0
      ? { level: "short", message: `No player actors in the library — nothing about this party can be read, so sustain and healing come from the generic ${partySize}-player curve alone.` }
      : players.length < partySize
        ? { level: "short", message: `Not enough actors in the profile to read a ${partySize}-player party correctly — ${players.length} readable. Add ${partySize - players.length} more, or check a smaller party.` }
        : players.length > partySize
          ? {
            level: "over",
            message: resolved
              ? `${chosen.length} of ${players.length} chosen for this ${partySize}-player party.`
              : `${players.length} actors for a ${partySize}-player party — check which ${partySize} you want to use. Nothing is read off the actors until you do.`,
          }
          : { level: "ok", message: `${players.length} actors, matching the ${partySize}-player curve.` };

  /**
   * Same-encounter healing pools the published sustain does not contain — read from the CHOSEN
   * actors, so a six-actor library priced as a four-player party contributes four actors' pools.
   */
  const partyHealing = useMemo(
    () => resolved
      ? partyHealingFromActors(chosen as never[])
      // Unresolved: read nothing rather than a number built from the wrong actors.
      : { total: 0, sources: [], excluded: [] },
    [chosen, resolved],
  );

  /**
   * What this party DEALS, by type — so a creature's typed resistance prices itself against the
   * actual party instead of asking the author to weigh it by hand. Same resolution rule as the
   * healing above: an unresolved roster reads NOTHING rather than a mix built from the wrong
   * actors, because an overstated fire share overprices every fire-resistant creature in the act.
   */
  const partyDamageMix = useMemo(
    () => resolved ? partyDamageMixFromActors(chosen as never[]) : EMPTY_DAMAGE_MIX,
    [chosen, resolved],
  );

  const encounter = encounters.find(e => e.id === encounterId) ?? encounters[0];

  const roster = useMemo(() => {
    if (!encounter) return { roster: [], assumptions: [] };
    const entries = encounter.entries
      .map(entry => ({
        template: monsterLibrary.find(m => m.templateId === entry.templateId),
        quantity: Math.max(1, entry.count),
        // The DM's per-body choices for a template creature — the archetype, element package and
        // bond each body actually took. Without them the checker prices the unfinished template,
        // which carries every choice at once. See `RosterEntryInput.bodies`.
        bodies: entry.bodies,
      }))
      .filter(e => Boolean(e.template)) as Array<{ template: MainMonsterTemplate; quantity: number; bodies?: TemplateBodyChoice[] }>;
    // Kill priority: weakest bodies first — a party that is paying attention clears the cheap
    // ones to cut incoming damage. The simulation depletes groups in exactly this order.
    // The full library, not just this fight — a summoned creature is never already on the field.
    const built = rosterFromTemplates(entries, partyLevel, { ac: targetAc, saveBonus: targetSave, partySize, saves, damageMix: partyDamageMix }, monsterLibrary);
    return {
      roster: [...built.roster].sort((a, b) => a.baseHp * a.quantity - b.baseHp * b.quantity),
      assumptions: built.assumptions,
    };
  }, [encounter, monsterLibrary, partyLevel, targetAc, targetSave, partySize, equipmentMode, partyDamageMix]);

  /**
   * THE PARTY ARRIVES HAVING ALREADY SPENT SOMETHING. A gate is not fought fresh — it is fought
   * after the two encounters before it, which is exactly why a 35-45% gate still sends a party
   * to a rest.
   *
   * ⚠ DAMAGE MOVES WITH IT, NOT JUST SUSTAIN. This used to hand the checker a reduced
   * `customSustain` and leave the round profile at its fresh figures, so an arriving-spent party
   * opened with the same nova it would have thrown fresh and only fell over sooner. Both halves
   * now resolve inside `resolvePartyProfile` off the published fresh/expended reference — see
   * `partyResourceCurve`.
   */
  const profile = useMemo(() => {
    try {
      return resolvePartyProfile({
        level: partyLevel, size: partySize, equipmentMode, arrivingSpent,
      });
    } catch { return null; }
  }, [partyLevel, partySize, equipmentMode, arrivingSpent]);

  /**
   * ⚠ FEATS LAND ON THE LINES THAT ALREADY EXIST, not on a panel of their own.
   *
   * Christopher: *"the feats should show next to the dpr as a increase or in the healing if it
   * increases sustain above the party line"*, and *"i didnt ask for a new party estimator."*
   *
   * Read from the characters' own feats/features tabs — the same pair `deriveActorStats` reads —
   * and priced with every `resolved*` flag TRUE, because the entered sheet already contains the
   * AC and HP a feat grants. That guard is what stops the app recalculating what a DM typed in.
   */
  /**
   * ⚠ THE FIGHT IS AN INPUT TO THE FEATS, and it was not being passed.
   *
   * Shield Master needs the share of incoming damage that comes through Dex saves; Great Weapon
   * Master needs a hit chance, which needs an AC to roll against. Both are properties of the
   * encounter that is already selected in this panel, so neither is something a DM should be asked
   * to type. See `incomingSaveExposure`.
   */
  const fightInputs = useMemo(() => {
    const entries = (encounter?.entries ?? [])
      .map(e => ({ template: monsterLibrary.find(m => m.templateId === e.templateId), quantity: Math.max(1, e.count) }))
      .filter(e => Boolean(e.template)) as Array<{ template: MainMonsterTemplate; quantity: number }>;
    return { targetAC: meanTargetAc(entries), saveExposure: incomingSaveExposure(entries) };
  }, [encounter, monsterLibrary]);

  const partyFeats = useMemo(() => partyFeatsFromActors(chosen as unknown[], {
    baseDpr: profile?.dpr.round1, baseEhp: profile?.sustain,
    targetAC: fightInputs.targetAC, saveExposure: fightInputs.saveExposure,
  }), [chosen, profile, fightInputs]);

  const result = useMemo<EncounterResult | null>(() => {
    if (roster.roster.length === 0 || !profile) return null;
    try {
      return simulateEncounter({
        party: { size: profile.size, sustain: profile.sustain, dpr: profile.dpr },
        roster: roster.roster,
        settings: { damageAllocation: allocation, targetSafetyMargin },
      });
    } catch {
      return null;
    }
  }, [roster, profile, allocation, targetSafetyMargin]);

  /**
   * THE WORKBOOK'S OWN READING OF THE SAME ROSTER.
   *
   * ⚠ THE PANEL USED TO SHOW ONE MODEL AND CALL IT THE ANSWER. `simulateEncounter` is the body
   * trace the Runtime Contract requires for final behaviour — it removes a body's output the round
   * that body dies, and drops party output as PCs go down. The visible Encounter Checker in the
   * workbook does neither; it runs flat.
   *
   * The two therefore disagree, always in the same direction: with more than one body the trace
   * reads SOFTER. Six pikemen at level 6 come out 3 PCs down on the aggregate and 1 on the trace.
   * Showing only the trace meant the panel quietly promised a gentler fight than the workbook did,
   * with nothing on screen to say a second opinion existed.
   *
   * Christopher: *"at no point does the app tell us something is faster or slower then the workbook
   * does."* So both are computed, and the divergence is stated rather than resolved.
   */
  const aggregate = useMemo<AggregateAudit | null>(() => {
    if (roster.roster.length === 0 || !profile) return null;
    try {
      return aggregateAudit({
        level: partyLevel,
        partySize: profile.size,
        mode: equipmentMode,
        groups: roster.roster.map(g => ({
          name: g.name,
          quantity: g.quantity,
          // The sheet expects group EHP already priced and already party-size scaled, which is
          // exactly what the checker's own per-body helper produces.
          groupEhp: g.quantity * effectiveHpPerBody(g, profile.size),
          round1DprPerBody: g.dpr?.round1 ?? 0,
          round2PlusDprPerBody: g.dpr?.round2 ?? g.dpr?.round1 ?? 0,
        })),
        targetSafetyMargin,
      });
    } catch { return null; }
  }, [roster, profile, partyLevel, equipmentMode, targetSafetyMargin]);

  const divergence = useMemo(
    () => (aggregate && result
      ? auditDivergence(aggregate, { completionRound: result.completionRound, downsAtCompletion: result.downsAtCompletion })
      : null),
    [aggregate, result],
  );

  /**
   * What the fight costs, as a share of a FULL party's sustain — and where that leaves a party
   * that did not arrive full. Both read off the simulation's own per-round monster damage; no
   * separate arithmetic.
   */
  const partyClock = useMemo(() => {
    if (!result || !profile) return { thisFight: 0, cumulative: 0 };
    const fullSustain = profile.sustain / Math.max(0.01, 1 - arrivingSpent);
    const spent = result.rounds.reduce((s, r) => s + (r.monsterDamage ?? 0), 0);
    const thisFight = fullSustain > 0 ? spent / fullSustain : 0;
    return { thisFight, cumulative: arrivingSpent + thisFight };
  }, [result, profile, arrivingSpent]);

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
                  {/* What the actors say about that number — see `rosterFit`. */}
                  <div style={{ fontSize: 10, marginTop: 3, color: rosterFit.level === "ok" ? "#6a8a6a" : rosterFit.level === "short" ? "#e07b39" : "#c9a227" }}>
                    {rosterFit.message}
                  </div>
                  {/*
                    More actors than the party size: the DM says which ones are in this fight,
                    rather than the checker silently taking the first N. The choice feeds the
                    healing readout, so picking a party without its paladins shows immediately.
                  */}
                  {rosterFit.level === "over" && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4, alignItems: "center" }}>
                      {players.map(a => {
                        const id = a.id ?? "";
                        const on = chosenActorIds.includes(id);
                        // Full is full: at N chosen, the rest are unavailable rather than silently
                        // making an N+1 party. Deselect somebody to swap.
                        const full = !on && chosen.length >= partySize;
                        return (
                          <button key={id} type="button" disabled={full}
                            onClick={() => setChosenActorIds(on
                              ? chosenActorIds.filter(x => x !== id)
                              : [...chosenActorIds, id])}
                            style={{ ...chip(on), fontSize: 9, opacity: full ? 0.35 : 1, cursor: full ? "not-allowed" : "pointer" }}
                            title={on ? "In this party — click to leave out"
                              : full ? `That is already ${partySize}. Leave someone out first.`
                                : "Click to put in this party"}>
                            {on ? "✓ " : ""}{a.name ?? "unnamed"}
                          </button>
                        );
                      })}
                      <span style={{ fontSize: 10, color: resolved ? "#6a8a6a" : "#c9a227", alignSelf: "center" }}>
                        {chosen.length}/{partySize}
                      </span>
                      {chosen.length > 0 && (
                        <button type="button" onClick={() => setChosenActorIds([])}
                          style={{ ...chip(false), fontSize: 9 }} title="Clear the selection">clear</button>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <label style={label}>Party level</label>
                  <select
                    value={partyLevel}
                    onChange={e => setPartyLevel(Number(e.target.value))}
                    style={{ fontSize: 11, padding: "3px 6px", borderRadius: 4, border: "1px solid #2a2a3e", background: "#0d0d14", color: "#ddd" }}
                  >
                    {/* 1–20, both equipment modes. The floor used to be 3, which left a DM unable
                        to check a level 1 or 2 fight at all. See `GENERIC_CHECKER_LEVELS`. */}
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
                <div title="What the party has already spent when this fight starts. A gate is fought after the encounters before it, not fresh.">
                  <label style={label}>Arrives spent</label>
                  <div style={{ display: "flex", gap: 4 }}>
                    {[0, 0.25, 0.4, 0.6].map(v => (
                      <button key={v} type="button" onClick={() => setArrivingSpent(v)} style={chip(arrivingSpent === v)}>
                        {v === 0 ? "fresh" : `${v * 100}%`}
                      </button>
                    ))}
                  </div>
                </div>
                {/* ⚠ THIS TOOLTIP USED TO SAY THE OPPOSITE OF WHAT THE PANEL DOES. It read "the
                    workbook publishes the hit and save formulas but no party AC table, so this is
                    yours to enter" — true of v6, false since v7 shipped `party_defense_curve`, and
                    the panel has been reading that curve since 0.7.10.38. A stale code comment is
                    a trap for the next session; a stale TOOLTIP is a lie told to the DM at the
                    table, so it is the more urgent of the two. */}
                <div title={
                  isOverridden
                    ? "OVERRIDDEN — the checker is using your typed numbers, not the party curve. Clear both to go back to the curve."
                    : `Read from the party defence curve at level ${partyLevel} (${curveModeLabel}): average AC and the matching ability save. Type over either one for your own table — a real table is not the average table.`
                }>
                  <label style={label}>
                    Party AC / save{" "}
                    {isOverridden
                      ? <button type="button" onClick={() => { setAcOverride(null); setSaveOverride(null); }}
                          title="Go back to the curve value for this level"
                          style={{ fontSize: 9, padding: "0 4px", background: "#e07b3922", border: "1px solid #e07b3955", borderRadius: 3, color: "#e07b39", cursor: "pointer" }}>
                          overridden · reset
                        </button>
                      : <span style={{ fontSize: 9, color: "#5a5a6e" }}>from curve</span>}
                  </label>
                  <div style={{ display: "flex", gap: 4 }}>
                    <input type="number" value={targetAc} onChange={e => setAcOverride(e.target.value === "" ? null : Number(e.target.value))}
                      style={{ width: 48, fontSize: 11, padding: "3px 6px", borderRadius: 4, border: `1px solid ${acOverride === null ? "#2a2a3e" : "#e07b3988"}`, background: "#0d0d14", color: "#ddd" }} />
                    <input type="number" value={Number(targetSave.toFixed(2))} onChange={e => setSaveOverride(e.target.value === "" ? null : Number(e.target.value))}
                      style={{ width: 48, fontSize: 11, padding: "3px 6px", borderRadius: 4, border: `1px solid ${saveOverride === null ? "#2a2a3e" : "#e07b3988"}`, background: "#0d0d14", color: "#ddd" }} />
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
                        {partyFeats.dpr > 0 && (
                          <span style={{ color: "#e0b070" }} title={partyFeats.matched.map(m => `${m.actor}: ${m.feats.join(", ")}`).join(" · ")}>
                            {" +"}{partyFeats.dpr.toFixed(1)}{" from feats"}
                          </span>
                        )}
                        {" · sustain "}{profile.sustain.toFixed(0)}
                        {partyFeats.partyEhp > 0 && (
                          <span style={{ color: "#7be08a" }} title={partyFeats.matched.map(m => `${m.actor}: ${m.feats.join(", ")}`).join(" · ")}>
                            {" +"}{partyFeats.partyEhp.toFixed(0)}{" healing from feats"}
                          </span>
                        )}
                        {partyFeats.needsInput.length > 0 && (
                          /* ⚠ SAID, NOT SWALLOWED. A feat that could not be priced is a question,
                             excluded from the two figures above rather than added as zero. */
                          <span style={{ color: "#c0a060" }}
                            title={partyFeats.needsInput.map(n => `${n.actor} · ${n.feat} · ${n.channel} — needs ${n.missing.join(", ")}`).join("\n")}>
                            {" · "}{partyFeats.needsInput.length}{" feat channel"}
                            {partyFeats.needsInput.length === 1 ? "" : "s"}{" need input"}
                          </span>
                        )}
                      </div>
                      {/*
                        ⚠ UNDER SUSTAIN, NOT INSIDE IT — and that is the whole point.

                        The party curve is the 128-party field, and v9's methods sheet flags what
                        that field could not do: *"Class healing — no invented healing or revival
                        package was assigned to abstract parties. Class/subclass identities absent
                        from 128 source profiles."* So `sustain` has a hole exactly the size of
                        what this party can heal, and every clock reading has been high by it.

                        Folding it into `sustain` would move every reading at once and quietly
                        change what the 35-45% gate band means, since that band was calibrated
                        against a sustain figure that excluded this. So it sits beneath the
                        published number where both can be read, and the band stays arguable.
                      */}
                      {partyHealing.total > 0 && (
                        <div style={{ fontSize: 10, color: "#6a8a6a", marginTop: 2 }}>
                          {"+ healing "}<strong style={{ color: "#7fbf7f" }}>{partyHealing.total}</strong>
                          {" HP not in that sustain — "}
                          {partyHealing.sources.map(s => `${s.actor} ${s.label} ${s.amount}`).join(" · ")}
                          {". Same-encounter pools only; hit dice are short-rest recovery and already counted."}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* THE PARTY CLOCK — what this fight COSTS, as a share of what the party has.
                      Christopher, 2026-08-16: a gate landing at 35-45% *"would still make a
                      party consider resting if they have used the resources against 2
                      encounters and then hit that gate."* The rest decision is CUMULATIVE, so
                      the cost of one fight is only half the reading — the other half is what
                      the party has left when it walks in, which is the control below. */}
                  <div style={{ ...box, marginBottom: 8, fontSize: 10 }}>
                    <span style={{ color: "#8a8aa0" }}>PARTY CLOCK </span>
                    <strong style={{ color: partyClock.thisFight >= 0.5 ? "#e07b39" : "#7be08a" }}>
                      {(partyClock.thisFight * 100).toFixed(0)}%
                    </strong>
                    <span style={{ color: "#555" }}> of a full party's sustain spent on this fight</span>
                    {arrivingSpent > 0 && (
                      <>
                        <span style={{ color: "#555" }}> · arriving {(arrivingSpent * 100).toFixed(0)}% down → </span>
                        <strong style={{ color: partyClock.cumulative >= 1 ? "#ff4444" : partyClock.cumulative >= 0.75 ? "#e07b39" : "#7be08a" }}>
                          {(partyClock.cumulative * 100).toFixed(0)}% spent by the end
                        </strong>
                      </>
                    )}
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

                  {/* THE WORKBOOK'S AGGREGATE AUDIT, side by side with the body trace. It is
                      shown whether or not the two agree: a DM who only ever sees them when they
                      differ has no way to know the check was run the rest of the time. */}
                  {aggregate && (
                    <div style={{ ...box, marginBottom: 8, fontSize: 10 }}>
                      <div style={{ color: "#7bb0e0", marginBottom: 3, letterSpacing: 0.4 }}>
                        WORKBOOK AGGREGATE AUDIT
                        <span style={{ color: "#555", letterSpacing: 0 }}> · flat DPR, no bodies removed</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 4, color: "#999" }}>
                        <span>ends <strong style={{ color: "#ddd" }}>R{String(aggregate.completionRound)}</strong></span>
                        <span>fatal <strong style={{ color: typeof aggregate.fatalRound === "number" ? "#ff4444" : "#7be08a" }}>{String(aggregate.fatalRound)}</strong></span>
                        <span>down <strong style={{ color: "#ddd" }}>{String(aggregate.projectedDowns)}</strong></span>
                        <span>standing <strong style={{ color: "#ddd" }}>{aggregate.standingAtCompletion}</strong></span>
                      </div>
                      {divergence && !divergence.agrees && (
                        <div style={{ marginTop: 4, paddingTop: 4, borderTop: "1px solid #2a2a3e", color: "#e0b070", lineHeight: 1.45 }}>
                          {divergence.note}
                        </div>
                      )}
                    </div>
                  )}

                  {/* NOTHING IS SILENT — *"if the checker has no idea how to parse something
                      it will tell the dm to cal[culate] that damage."* A silent OMISSION
                      reaches the total exactly as unchallenged as a silent substitute would.
                      A well-formed stat block should produce NONE of these; they mean
                      something is written wrong or is an inferred action. */}
                  {/* ⚠ "COULD NOT PRICE" WAS WRONG FOR MOST OF WHAT IT LISTED. The heading counted
                      every assumption, but the two flags mean opposite things:

                        ESTIMATED       — it WAS priced, against a stated basis (an area against
                                          the four-PC benchmark, say). The number is in the total.
                        NEEDS DM INPUT  — it genuinely could not be priced and scored ZERO.

                      Reporting "3 things the checker could not price" for a library encounter
                      whose every number had in fact been computed made shipped content look
                      broken. Christopher, 2026-08-20: *"there is still 3 things the checker cant
                      price and this is against the encounter that is from the library."* Two of
                      those three were priced; the third was a real parser gap, now fixed. */}
                  {roster.assumptions.length > 0 && (() => {
                    const blocked = roster.assumptions.filter(a => a.flag === "NEEDS DM INPUT").length;
                    const estimated = roster.assumptions.length - blocked;
                    return (
                    <div style={{ ...box, marginBottom: 8, fontSize: 10 }}>
                      <div style={{ fontWeight: 600, marginBottom: 2, color: blocked > 0 ? "#e07b39" : "#c9a227" }}>
                        {blocked > 0 && `${blocked} thing${blocked === 1 ? "" : "s"} the checker could not price — ${blocked === 1 ? "it scores" : "they score"} 0 until you fill ${blocked === 1 ? "it" : "them"} in`}
                        {blocked > 0 && estimated > 0 && " · "}
                        {estimated > 0 && `${estimated} priced on a stated assumption`}
                      </div>
                      {roster.assumptions.map((a, i) => (
                        <div key={i} style={{ color: a.flag === "NEEDS DM INPUT" ? "#e07b39" : "#8a8aa0" }}>
                          [{a.flag === "NEEDS DM INPUT" ? "NOT PRICED" : "PRICED · assumption"}] {a.creature} · {a.field} — {a.detail}
                        </div>
                      ))}
                    </div>
                    );
                  })()}

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

                  {/* ⚠ THIS LINE USED TO CALL A PUBLISHED FIGURE A GUESS. It said "your entry, not a
                      workbook figure" unconditionally — including in the default case, where both
                      numbers come from `partyDefenceCurve`, transcribed verbatim from the v7 pricing
                      reference and reconciled across all 280 cells. Christopher: *"why would the
                      checker not already know where the standard party ac is when the referenced
                      file already has that in."* It does know; the sentence was lying about it.
                      It now says which of the two it actually used, and only claims an entry when
                      the DM has genuinely overridden one. */}
                  <div style={{ fontSize: 9, color: "#666", marginBottom: 6 }}>
                    Survivor counts are model projections under {allocation === "focus_fire" ? "focus fire" : "even spread"}, not observed outcomes.
                    {" "}Every attack was resolved against AC {Number(targetAc.toFixed(2))}{acOverride === null ? "" : " (your override)"}
                    {" "}and every save against a +{Number(targetSave.toFixed(2))}{saveOverride === null ? "" : " (your override)"} bonus
                    {acOverride === null && saveOverride === null
                      ? ` — the published ${equipmentMode === "brokenChain" ? "Broken Chain" : "Standard"} party curve at level ${partyLevel}, not an assumption.`
                      : " — an override you entered, replacing the published curve."}
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
