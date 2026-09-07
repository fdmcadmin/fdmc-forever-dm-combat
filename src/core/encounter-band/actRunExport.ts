/**
 * THE ACT RUN, AS A FILE — what the right-hand side of the panel says, in something the DM keeps.
 *
 * Christopher, 2026-09-07: *"i also want to add a export the act run button so i can the
 * information that the right side give, where is show what sustain is spend, how much a fight
 * take and where they end."*
 *
 * Three questions, and the export answers exactly those three per fight:
 *
 *   what sustain is spent   `arrivingSpent` before, `fightCost` for the fight, `leavesSpent` after
 *   how much a fight takes  the same cost, plus the round it cleared or killed on and the downs
 *   where they end          the run summary — final spent, deepest arrival, wipes, rest blocks
 *
 * ─── ⚠ THIS PRICES NOTHING, AND THAT IS THE WHOLE CONSTRAINT ────────────────────────────────
 *
 * `actRun.ts` says it for the sequencer and it is doubly true here: the validation chain is
 * estimator → encounter → checker → run, and each step consumes the one before it. This module is
 * a FIFTH thing that consumes the fourth. Every number below is handed to it already computed by
 * `simulateEncounter` and `nextArrivalSpent`; if this file ever computes a difficulty, a cost or a
 * recovery of its own it has become a second model of the run, and the run and its export will
 * drift apart exactly the way the four scripts retired at 0.7.36 did.
 *
 * ─── ⚠ TAB-SEPARATED, AND FOR A REASON ──────────────────────────────────────────────────────
 *
 * The fight table is TSV inside a plain-text report. A fixed-width table reads well and pastes
 * into a spreadsheet as one mangled column; a bare CSV pastes cleanly and reads badly. Tabs do
 * both — the report is legible in any editor AND every row lands in its own cells when pasted
 * into the workbook this campaign is balanced in.
 *
 * ⚠ PERCENTAGES ARE WRITTEN AS NUMBERS, NOT AS "47%". A cell containing `47%` is text in some
 * locales and a number in others; `0.47` is a number everywhere and formats as a percentage with
 * one click. The human-readable summary at the top uses percent signs, because nobody pastes a
 * paragraph into a pivot table.
 */

import type { RestType, RestStatus } from "./actRun";

/** How the run's short-rest recovery was decided — the same three sources the panel reports. */
export type RestRecoverySource = "override" | "party" | "published";

export type ActRunExportRow = {
  sequence: number;
  name: string;
  /** The encounter this step references, or what went wrong instead. */
  encounter: string;
  partyLevel: number;
  restType: RestType;
  restStatus: RestStatus;
  restTaken: RestType | "None";
  /** True when the run took a rest its status does not guarantee. */
  assumedRisky: boolean;
  /** Share of a FULL sustain pool already spent when this fight starts, 0..1. */
  arrivingSpent: number;
  /** Share of a full pool this fight consumed, 0..1. */
  fightCost: number;
  /**
   * Share spent when the fight ENDS and before any rest, 0..1.
   *
   * ⚠ CARRIED, NOT RECOMPUTED. It is `min(1, arriving + cost)` — the same clamp `nextArrivalSpent`
   * applies — and it is stated as a field rather than derived in the formatter so the export and
   * the panel can never disagree about where a fight left the party.
   */
  leavesSpent: number;
  outcome: "clear" | "wipe" | "unresolved" | "not priced";
  /** The round it cleared or wiped on. Null when it did neither. */
  round: number | null;
  downs: number;
  /** Why there is no result, when there is none. */
  note?: string;
};

export type ActRunExport = {
  runName: string;
  partyMode: string;
  partySize: number;
  generatedAt: string;
  shortRestRecovery: { fraction: number; source: RestRecoverySource; detail?: string };
  rows: ActRunExportRow[];
  /** Stretches between full resets — `restBlocks`, handed in rather than recomputed. */
  blocks: ReadonlyArray<{ fights: number; shortRests: number; endsAt: string }>;
  /** Where the run levels up — `runLevelGates`, likewise. */
  levelGates: ReadonlyArray<{ after: string; from: number; to: number }>;
};

const pct = (n: number) => `${Math.round(Math.max(0, Math.min(1, n)) * 100)}%`;
/** Four decimals: enough that a 0.01% difference between two runs is visible, few enough to read. */
const num = (n: number) => (Math.round(n * 10000) / 10000).toString();

const RECOVERY_SOURCE: Record<RestRecoverySource, string> = {
  override: "your override for this run",
  party: "this party's own Hit Dice",
  published: "the published median across 384 sampled L7-L9 parties",
};

/**
 * The run as a report: a summary a DM can read, then a table a spreadsheet can eat.
 *
 * ⚠ THE SUMMARY LEADS WITH WHERE THEY END, because that is the question a run answers. A run's
 * verdict is not its worst fight — a party can survive every fight in a block and still arrive at
 * the last one with nothing left, and that is the case the panel exists to show.
 */
export function actRunExportText(x: ActRunExport): string {
  const rated = x.rows.filter(r => r.outcome === "clear" || r.outcome === "wipe" || r.outcome === "unresolved");
  const wipes = x.rows.filter(r => r.outcome === "wipe");
  const unresolved = x.rows.filter(r => r.outcome === "unresolved");
  const last = x.rows[x.rows.length - 1];
  const deepest = rated.length > 0
    ? rated.reduce((a, b) => (b.arrivingSpent > a.arrivingSpent ? b : a))
    : undefined;
  const risky = x.rows.filter(r => r.assumedRisky);

  const L: string[] = [];
  L.push(`ACT RUN — ${x.runName}`);
  L.push(`${x.partyMode} · party of ${x.partySize} · exported ${x.generatedAt}`);
  L.push("");

  L.push("WHERE THEY END");
  L.push(last
    ? `  ends at ${pct(last.leavesSpent)} of a full sustain pool spent, after ${x.rows.length} fight${x.rows.length === 1 ? "" : "s"}`
    : "  the run has no fights in it yet");
  if (deepest) L.push(`  deepest arrival: ${deepest.name} at ${pct(deepest.arrivingSpent)} already spent`);
  L.push(wipes.length === 0
    ? `  no wipe in ${rated.length} priced fight${rated.length === 1 ? "" : "s"}`
    : `  ${wipes.length} wipe${wipes.length === 1 ? "" : "s"}: ${wipes.map(w => `${w.name} (round ${w.round})`).join(", ")}`);
  if (unresolved.length > 0) {
    L.push(`  ⚠ ${unresolved.length} fight${unresolved.length === 1 ? "" : "s"} never resolved within the round cap — the party cannot finish ${unresolved.length === 1 ? "it" : "them"} at this level: ${unresolved.map(u => u.name).join(", ")}`);
  }
  /**
   * ⚠ A RUN THAT QUIETLY COMPLETED A THREATENED REST REPORTS A PARTY IN BETTER SHAPE THAN THE
   * FICTION PROMISES, and every fight after it is judged against resources they might not have.
   * `resolveActRun` computes the flag; the export refuses to bury it.
   */
  if (risky.length > 0) {
    L.push(`  ⚠ ${risky.length} rest${risky.length === 1 ? " is" : "s are"} ASSUMED to have completed and ${risky.length === 1 ? "is" : "are"} not guaranteed: ${risky.map(r => `${r.name} (${r.restType}/${r.restStatus})`).join(", ")}`);
  }
  L.push("");

  L.push("SUSTAIN RECOVERY BETWEEN FIGHTS");
  L.push(`  a short rest gives back ${pct(x.shortRestRecovery.fraction)} of a full pool — ${RECOVERY_SOURCE[x.shortRestRecovery.source]}`);
  if (x.shortRestRecovery.detail) L.push(`  ${x.shortRestRecovery.detail}`);
  L.push("  a long rest resets it to zero");
  L.push("");

  if (x.blocks.length > 0) {
    L.push("BLOCKS BETWEEN LONG RESTS");
    for (const b of x.blocks) {
      L.push(`  ${b.fights} fight${b.fights === 1 ? "" : "s"}, ${b.shortRests} short rest${b.shortRests === 1 ? "" : "s"} — ends at ${b.endsAt}`);
    }
    L.push("");
  }

  if (x.levelGates.length > 0) {
    L.push("LEVEL GATES");
    for (const g of x.levelGates) L.push(`  after ${g.after}: level ${g.from} → ${g.to}`);
    L.push("");
  }

  L.push("PER FIGHT — tab separated, paste straight into a sheet");
  L.push([
    "#", "fight", "encounter", "level",
    "arriving spent", "fight cost", "leaves spent",
    "outcome", "round", "downs",
    "rest offered", "rest status", "rest taken", "rest assumed", "note",
  ].join("\t"));
  for (const r of x.rows) {
    L.push([
      r.sequence, r.name, r.encounter, r.partyLevel,
      num(r.arrivingSpent), num(r.fightCost), num(r.leavesSpent),
      r.outcome, r.round ?? "", r.downs,
      r.restType, r.restStatus, r.restTaken, r.assumedRisky ? "assumed" : "",
      r.note ?? "",
    ].join("\t"));
  }
  L.push("");
  L.push("Spent columns are fractions of a FULL sustain pool, so they stay comparable across a");
  L.push("block however depleted the party already was. Format them as percentages in the sheet.");
  L.push("");
  L.push("Every figure here comes from the checker's own simulation of each fight at that step's");
  L.push("party level, with the party arriving as spent as the fights before it left them. The");
  L.push("export computes nothing of its own.");
  return L.join("\n");
}

/** `fdmc-act-run-<run>-<stamp>.txt` — named for the run, because a DM keeps several. */
export function actRunExportFilename(runName: string, at = new Date().toISOString()): string {
  const slug = (runName || "act-run")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "act-run";
  return `fdmc-act-run-${slug}-${at.slice(0, 19).replace(/[:T]/g, "-")}.txt`;
}
