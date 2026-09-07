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
import { shortRestRecoveryFromActors } from "../../modules/dnd-5e/shortRestRecovery";

/**
 * WHERE A SHORT REST'S NUMBER CAME FROM — carried out of the pricing pass so the control can show
 * the figure the run actually spent, instead of the published median it was printing regardless.
 */
/**
 * WHAT A SHORT REST HANDS BACK, ON BOTH CLOCKS.
 *
 * ⚠ TWO NUMBERS, BECAUSE TWO DIFFERENT THINGS COME BACK. Hit Dice buy hit points and move the
 * SUSTAIN clock; refreshed pools — Action Surge, Pact slots, Ki, an item's charges — buy damage
 * and move the TEMPO one. The run carried a single figure counted from Hit Dice alone, so a
 * Warlock party recovered no damage at all on a short rest even with four Pact slots back.
 *
 * Christopher, 2026-09-07: *"the baseline recovery for X class … should cover everything from
 * health to charges on items."*
 */
type RestRecovery = {
  /** Share of full SUSTAIN a short rest returns, from Hit Dice. */
  fraction: number;
  /** Share of the day's RESOURCE supply it returns, from every pool that refreshes. */
  resourceFraction: number;
  source: "override" | "party" | "published";
  detail?: string;
};
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
import { actRunExportText, actRunExportFilename, type ActRunExportRow } from "./actRunExport";
import { downloadExport } from "../export/encounterLogExport";
import type { EncounterDefinition } from "../monsters/encounterLibrary";
import { rosterFromTemplates } from "./rosterFromLibrary";
import { partyDamageMixFromActors, EMPTY_DAMAGE_MIX } from "./partyDamageMix";
import { simulateEncounter, resolvePartyProfile, bondArrangement } from "./checkerV2";
import { partyBondMitigationFromActors } from "../../modules/the-broken-chain/bondMitigationFromActors";
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
  /**
   * ⚠ THE RUN HAS TO SEE THE BONDS THE FIGHT DOES.
   *
   * The difficulty panel reads the party's bond mitigation and takes it off every round. If this
   * panel did not, the two surfaces would disagree about the same fight by however much the
   * party's bonds are worth — and "why does the estimator not agree with the checker" is a
   * question this codebase has already answered once at the cost of a whole version.
   *
   * Read on the same terms as the damage mix directly above: only when the readable player actors
   * match the run's party size, so six characters are never averaged into a four-player run.
   */
  const bondMitigation = useMemo(() => {
    const players = (actors as Array<{ kind?: string }>).filter(a => a?.kind === "player");
    const size = Math.max(1, run?.partySize ?? 4);
    return players.length === size ? partyBondMitigationFromActors(players as never[]) : null;
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
   * it; a short rest gives back what THIS party's Hit Dice are worth.
   *
   * ⚠ THAT USED TO BE A POPULATION MEDIAN FOR EVERY TABLE. `SHORT_REST_RECOVERY` is 0.255401, the
   * median across 384 sampled L7-L9 parties, and the V3.0 method rules exactly that out: *"Each
   * actor spends their own remaining Hit Dice one at a time until max HP or none remain."* The
   * order of authority is now the DM's own override, then the party in front of you, then the
   * published median when no actors are chosen — and the panel says which one it used.
   */
  const priced = useMemo(() => {
    const partySize = Math.max(1, run?.partySize ?? 4);
    const bondArrange = bondArrangement(
      run?.partyMode === "Broken Chain" ? "brokenChain" : "wotcStandard",
      bondMitigation?.perRound ?? 0,
      Boolean(bondMitigation),
    );
    /** Resolved per step, because the share depends on that step's own full sustain. */
    const recoveryFor = (fullSustain: number): RestRecovery => {
      /**
       * ⚠ AN OVERRIDE IS ONE NUMBER AND IT SPEAKS FOR BOTH CLOCKS. A DM typing "30%" is saying what
       * a short rest is worth to this party overall; splitting their single figure in two would be
       * the app inventing a distinction they did not make.
       */
      if (run?.shortRestRecovery !== undefined) {
        const f = Math.max(0, Math.min(1, run.shortRestRecovery));
        return { fraction: f, resourceFraction: f, source: "override" };
      }
      const derived = shortRestRecoveryFromActors(actors as never[], fullSustain);
      if (derived) {
        const dice = (derived.perActor ?? []).map(a => `${a.actor} ${a.pools}`).join(" · ");
        const pools = derived.resources.length > 0
          ? `${derived.resourcesBack.toFixed(0)} of ${derived.resourcesPerDay.toFixed(0)} day resources back: ${derived.resources.map(r => `${r.actor} ${r.resource}`).join(", ")}`
          : "no pool on these sheets refreshes on a short rest";
        return {
          fraction: Math.max(0, Math.min(1, derived.fraction)),
          resourceFraction: Math.max(0, Math.min(1, derived.resourceFraction)),
          source: "party",
          detail: [dice, pools].filter(Boolean).join(" — "),
        };
      }
      return { fraction: SHORT_REST_RECOVERY, resourceFraction: SHORT_REST_RECOVERY, source: "published" };
    };
    /**
     * ⚠ TWO CLOCKS, BECAUSE A SHORT REST DOES NOT REFILL THEM AT THE SAME RATE.
     *
     * `spentSustain` is hit points and is what a fight's cost is measured in. `spentResources` is
     * the day's slots, pools and charges — it is spent by the same fights and refilled by the
     * same rests, but a short rest hands back a Warlock's whole Pact suite and almost no HP, and a
     * Wizard's the other way round. One number could only be right for one of them.
     */
    let spentSustain = 0;
    let spentResources = 0;
    return resolved.map(step => {
      const encounter = encounters.find(e => e.id === step.encounterId);
      const arrivingSpent = spentSustain;
      const arrivingResources = spentResources;
      if (!encounter) {
        return { id: step.id, missing: true as const, arrivingSpent, arrivingResources, result: null, cost: 0 };
      }
      try {
        const entries = encounter.entries
          .map(entry => ({
            template: monsterLibrary.find(m => m.templateId === entry.templateId),
            quantity: Math.max(1, entry.count),
          }))
          .filter((e): e is { template: MainMonsterTemplate; quantity: number } => Boolean(e.template));
        if (entries.length === 0) {
          return { id: step.id, missing: false as const, empty: true as const, arrivingSpent, arrivingResources, result: null, cost: 0 };
        }
        // Party AC and save bonus come from the published defence curve for the run's mode — the
        // same two numbers the difficulty panel takes, derived the same way (the save bonus is the
        // mean of the six ability rows). Nothing here invents a party defence.
        // The denominator follows the same arrangement the clock does — see `bondArrangement`.
        const defence = partyDefenceAt(step.partyLevel, bondArrange.baselineMode);
        const saveBonus = (defence.str + defence.dex + defence.con + defence.int + defence.wis + defence.cha) / 6;
        // The full library, not just this fight — a summoned creature is never already on the field.
        const built = rosterFromTemplates(entries, step.partyLevel, {
          ac: defence.ac, saveBonus, partySize, damageMix: partyDamageMix,
        }, monsterLibrary);
        // Weakest bodies first — the same kill priority the difficulty panel simulates.
        const roster = [...built.roster].sort((a, b) => a.baseHp * a.quantity - b.baseHp * b.quantity);
        const full = resolvePartyProfile({ level: step.partyLevel, size: partySize });
        /**
         * ⚠ THE RUN NEVER DEPLETED ITS DAMAGE, ONLY ITS HIT POINTS.
         *
         * This passed `customSustain` and nothing else, so every fight in a run was fought at
         * FRESH round-1 damage however deep into the block it was — the same fault the difficulty
         * panel had. `arrivingSpent` is the input `resolvePartyProfile` already takes for it, and
         * the resource clock is what belongs there: damage runs out when slots do, not when hit
         * points do.
         */
        const profile = (arrivingSpent > 0 || arrivingResources > 0)
          ? resolvePartyProfile({
            level: step.partyLevel, size: partySize,
            arrivingSpent: arrivingResources,
            customSustain: full.sustain * (1 - arrivingSpent),
          })
          : full;
        const result = simulateEncounter({
          party: {
            size: profile.size, sustain: profile.sustain, dpr: profile.dpr,
            // Counted once — see `bondArrangement`.
            mitigationPerRound: bondArrange.mitigation,
          },
          roster,
        });
        // What the fight actually took out of the party, as a share of a FULL pool — so the
        // fractions stay comparable across a block however depleted the party already was.
        const taken = result.rounds[result.rounds.length - 1]?.cumulativeMonsterDamage ?? 0;
        const cost = full.sustain > 0 ? taken / full.sustain : 0;
        const rest = recoveryFor(full.sustain);
        /**
         * ⚠ THE SAME CARRY RULE, RUN ONCE PER CLOCK. `nextArrivalSpent` is gated and correct for
         * one clock, so it is called twice rather than reimplemented for two — a Long rest still
         * zeroes both, a skipped rest still carries both, and only the short-rest give-back
         * differs between them.
         *
         * The resource clock advances by the same fight cost, because a fight that took 30% of the
         * party's hit points is a fight in which they spent about that much of their kit; nothing
         * published measures the two separately, and inventing a second cost would be exactly the
         * unpublished exchange rate this pass keeps refusing to make up.
         */
        spentSustain = nextArrivalSpent(spentSustain, cost, step.restTaken, rest.fraction);
        spentResources = nextArrivalSpent(spentResources, cost, step.restTaken, rest.resourceFraction);
        return { id: step.id, missing: false as const, arrivingSpent, arrivingResources, result, cost, rest };
      } catch {
        return { id: step.id, missing: false as const, failed: true as const, arrivingSpent, arrivingResources, result: null, cost: 0 };
      }
    });
    // ⚠ `bondMitigation` IS A PARTY INPUT AND REACHES NO ROSTER FIGURE, so it must be named here
    // or a party gaining a Guardian would not re-price the run until something else moved.
  }, [resolved, encounters, monsterLibrary, run?.partySize, run?.shortRestRecovery, run?.partyMode, partyDamageMix, bondMitigation]);

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

  /**
   * ⚠ THE EXPORT READS THE SAME `priced` THE PANEL DRAWS FROM, AND NOTHING ELSE.
   *
   * Christopher: *"i also want to add a export the act run button so i can the information that
   * the right side give."* The right side IS `priced`, so the export takes it whole rather than
   * re-simulating — a second pass would be a second model of the run, and the file would slowly
   * stop matching the screen it was exported from.
   */
  function exportRun() {
    if (!run) return;
    const rows: ActRunExportRow[] = resolved.map(s => {
      const p = pricedById.get(s.id);
      const encounter = encounters.find(e => e.id === s.encounterId);
      const arriving = p?.arrivingSpent ?? 0;
      const cost = p?.cost ?? 0;
      const r = p?.result ?? null;
      const outcome: ActRunExportRow["outcome"] = !r
        ? "not priced"
        : r.fatalRound !== null ? "wipe"
          : r.completionRound !== null ? "clear" : "unresolved";
      const note = p?.missing ? "no encounter — the step references a fight that is not in the library"
        : p && "empty" in p && p.empty ? "no creatures in the encounter"
          : p && "failed" in p && p.failed ? "the checker could not price this fight"
            : undefined;
      return {
        sequence: s.sequence,
        name: s.name,
        encounter: encounter?.name ?? "(none)",
        partyLevel: s.partyLevel,
        restType: s.restType,
        restStatus: s.restStatus,
        restTaken: s.restTaken,
        assumedRisky: s.assumedRisky,
        arrivingSpent: arriving,
        fightCost: cost,
        leavesSpent: Math.min(1, arriving + cost),
        outcome,
        round: r ? (r.fatalRound ?? r.completionRound ?? null) : null,
        downs: r?.downsAtCompletion ?? 0,
        ...(note ? { note } : {}),
      };
    });
    /**
     * The recovery figure the run ACTUALLY spent, not the published median — the same correction
     * the summary line got at 0.8.25.0. It is resolved per step, so the first step that produced
     * one is the run's; a run with no priced step falls back to the panel's own default.
     */
    const used = priced.find(p => "rest" in p && p.rest)?.rest;
    downloadExport(
      actRunExportText({
        runName: run.name,
        partyMode: run.partyMode,
        partySize: Math.max(1, run.partySize ?? 4),
        generatedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
        shortRestRecovery: used
          ? { fraction: used.fraction, source: used.source, ...(used.detail ? { detail: used.detail } : {}) }
          : { fraction: run.shortRestRecovery ?? SHORT_REST_RECOVERY, source: run.shortRestRecovery !== undefined ? "override" : "published" },
        rows,
        blocks: restBlocks(resolved),
        levelGates: runLevelGates(run.steps),
      }),
      actRunExportFilename(run.name),
    );
  }

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
        {run && run.steps.length > 0 && (
          <button type="button" onClick={exportRun}
            title="Download the run: what each fight costs, how spent the party arrives, and where they end. Tab separated, so the fight table pastes straight into a sheet."
            style={{ fontSize: 10, padding: "3px 9px", background: "#8a7a5222", border: "1px solid #8a7a5288", borderRadius: 3, color: "#c8b57a", cursor: "pointer" }}>
            Export run
          </button>
        )}
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
                {/*
                  ⚠ SHOW THE NUMBER THE RUN ACTUALLY SPENT.

                  This printed `run.shortRestRecovery ?? SHORT_REST_RECOVERY` — the DM's override or
                  the published median — and never the party-resolved figure the simulation had been
                  using since 0.8.25.0. So a table whose own Hit Dice buy back 28.7% was shown 25%,
                  the population median, and told the app could not know. Christopher: *"it says that
                  the per class recovery isnt there."* It was there; the control was not showing it.

                  The caption follows the same order of authority the pricing pass uses, and names it.
                */}
                {(() => {
                  const rest: RestRecovery = priced.find(x => x.rest)?.rest
                    ?? { fraction: SHORT_REST_RECOVERY, resourceFraction: SHORT_REST_RECOVERY, source: "published" };
                  return (
                    <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, fontSize: 10, color: "#8a8a9a" }}>
                      A short rest returns
                      {/* ⚠ CLEARING THE FIELD MUST DROP THE OVERRIDE, NOT WRITE ZERO.
                          `Number("") || 0` is 0, and 0 is a DEFINED override — so emptying the box
                          did not fall back to this party's own recovery, it asserted that a short
                          rest returns nothing. The caption right beside it said "Clear it to read
                          this party's own Hit Dice again", which was then untrue.
                          Christopher: *"if i remove the 25% it sets it at 0 not at the baseline
                          recovery for X class."* An empty box is the absence of an opinion. */}
                      <input type="number" min={0} max={100} value={Math.round(rest.fraction * 100)}
                        onChange={e => {
                          const raw = e.target.value.trim();
                          if (raw === "") { patchRun(run.id, { shortRestRecovery: undefined }); return; }
                          const pct = Number(raw);
                          if (!Number.isFinite(pct)) return;
                          patchRun(run.id, { shortRestRecovery: Math.max(0, Math.min(100, pct)) / 100 });
                        }}
                        title="Empty this box to go back to what THIS party actually recovers — their Hit Dice, their short-rest class pools and their item charges. Typing 0 is a different statement: that a short rest returns nothing."
                        style={{ ...input, width: 46, textAlign: "center" }} />
                      % of sustain
                      {/* ⚠ AND THE OTHER CLOCK, BECAUSE IT IS A DIFFERENT NUMBER. Hit Dice buy hit
                          points; Action Surge, Pact slots and an item's charges buy damage, and a
                          party can recover a lot of one and none of the other. */}
                      <span style={{ color: rest.resourceFraction > 0 ? "#7fb069" : "#666" }}
                        title="Every pool on these sheets that refreshes on a short rest — class resources, pact slots, free casts and item charges — as a share of what they carry across the whole day. This moves the DAMAGE clock; the sustain figure beside it moves the hit-point one.">
                        {" + "}{Math.round(rest.resourceFraction * 100)}{"% of day resources"}
                      </span>
                      <span style={{ color: "#555" }} title={rest.detail ?? undefined}>
                        {rest.source === "override"
                          ? "— your override, applied to both clocks. Clear the box to read this party again (typing 0 says a rest returns nothing, which is a different claim)."
                          : rest.source === "party"
                            ? `— resolved from THIS party${rest.detail ? ": " + rest.detail : ""}.`
                            : "— the published median across 384 sampled parties. Choose a party and it resolves from their own Hit Dice and pools."}
                      </span>
                    </label>
                  );
                })()}
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
