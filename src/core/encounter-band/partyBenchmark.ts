/**
 * CURRENT PARTY vs MIDPOINT — the workbook's own comparison, brought into the checker.
 *
 * `Rounds DPR & Sustain` states the contract on its machine-contract rows:
 *
 *   *"Checker comparison | Current party vs midpoint | Delta | raw + percent"*  (row 73)
 *   *"Midpoint authority | Rounds DPR & Sustain | Four-endpoint midpoint for selected
 *   level/mode"*  (Runtime Inputs B35)
 *
 * WHAT THE MIDPOINT IS. The published four-endpoint balanced centre — (BOS + BDS + WOS + WDS) / 4
 * — for the selected level and equipment mode, at the certification party of FOUR and fully fresh.
 * It is deliberately un-scaled and un-depleted: it is the line every party is measured against,
 * not a restatement of the party in front of you.
 *
 * WHAT THE CURRENT PARTY IS. The profile the checker is actually running this fight with — party
 * size scaling and arriving-spent depletion already applied — plus the contributions the app can
 * read off the CHOSEN characters rather than assume: feat DPR, feat healing, and the healing pool
 * `partyHealingFromActors` resolves from real slots and resources.
 *
 * ⚠ THAT IS NARROWER THAN THE WORKBOOK'S OWN INPUT, AND THE DIFFERENCE MATTERS. Runtime Inputs
 * B31 requires the current party's R1/R2/R3/R4+/Sustain to come from *"actor event simulation …
 * calculated after healing/resource use and Reaction arbitration"*. The app has no such
 * simulation, so what it compares is the curve as scaled for THIS fight plus the measurable
 * actor deltas on top. A party reads under the line because it is short a body or arrived spent,
 * and over it because its feats and healing carry it there. It does NOT yet read under because
 * the actual characters roll worse than the certification four — that needs the simulation, and
 * claiming it without one would be inventing a number.
 */

import { PARTY_CURVE_V2, type PartyEquipmentMode } from "./partyCurveV2";

export type BenchmarkKey = "round1" | "round2" | "round3" | "round4Plus" | "sustain" | "fourRoundAvg";

export type BenchmarkRow = {
  key: BenchmarkKey;
  /** "R1", "R2", "R3", "R4+", "Sustain", "4-rd avg" — the workbook's own labels. */
  label: string;
  midpoint: number;
  current: number;
  /** current − midpoint. Positive is over the line. */
  delta: number;
  /** delta ÷ midpoint, or null where the midpoint is zero and a ratio would be meaningless. */
  percent: number | null;
};

export type PartyBenchmark = {
  level: number;
  mode: PartyEquipmentMode;
  /** Levels 17-20 carry no population run; the caller must badge them. */
  projected: boolean;
  rows: BenchmarkRow[];
};

export type RoundsAndSustain = {
  round1: number;
  round2: number;
  round3: number;
  round4Plus: number;
  sustain: number;
};

const LABELS: Record<Exclude<BenchmarkKey, "fourRoundAvg">, string> = {
  round1: "R1",
  round2: "R2",
  round3: "R3",
  round4Plus: "R4+",
  sustain: "Sustain",
};

/** The four-round average — Runtime Inputs B27, `AVERAGE(R1:R4+)`. */
export function fourRoundAverage(p: Pick<RoundsAndSustain, "round1" | "round2" | "round3" | "round4Plus">): number {
  return (p.round1 + p.round2 + p.round3 + p.round4Plus) / 4;
}

function row(key: BenchmarkKey, label: string, midpoint: number, current: number): BenchmarkRow {
  const delta = current - midpoint;
  return {
    key,
    label,
    midpoint,
    current,
    delta,
    percent: midpoint === 0 ? null : delta / midpoint,
  };
}

/**
 * The published midpoint for a level and mode — four players, fresh, no convergence.
 *
 * Returns null above the empirical range only if the level is absent from the curve entirely;
 * 17-20 ARE returned, flagged `projected`, because the checker still offers them.
 */
export function midpointFor(
  level: number,
  mode: PartyEquipmentMode,
  /** The party actually being measured. Omitted keeps the published four-player line. */
  partySize?: number,
): (RoundsAndSustain & { projected: boolean; sizeCertified: boolean }) | null {
  const curve = PARTY_CURVE_V2.find(r => r.level === level);
  if (!curve) return null;
  /**
   * ⚠ THE LINE HAS TO BE DRAWN FOR THE PARTY THAT IS STANDING ON IT.
   *
   * This read `curve[mode]` — the FOUR-PLAYER row — always, while the current side is the
   * party's own size-scaled profile. So a five-player table was measured against a four-player
   * line and read permanently over it, by the 5P/4P ratio and nothing else.
   *
   * Christopher, 2026-09-07, at L7 / 5P / Broken Chain: *"there is no way my currenty party is
   * this strong above the line."* They were not. Of the +46.0 the panel showed on R1, 42.4 was
   * 165.126 (the certified 5P row) against 122.678 (the 4P row) and only 3.5 was their feats.
   * Sustain read +214.8, which is 708.498 against 493.742 — the size ratio exactly, every time,
   * for any 5P party however it was performing.
   *
   * The un-scaled 4P line was the ONLY midpoint that existed before V3.0: sizes were reached by
   * multiplying, so a size-matched midpoint would have been the same number times the same factor
   * and told you nothing. V3.0 certifies 3P/5P/6P independently from the actor-first pool
   * (0.8.23.0), so the comparison can now be like for like — and has to be, or the delta reports
   * the party's SIZE where it claims to report its strength.
   *
   * Falls back to the published 4P row for a size the table does not certify, which is the same
   * rule `resolvePartyProfile` already follows for scaling.
   */
  const sized = partySize === undefined ? undefined : curve.bySize?.[partySize]?.[mode];
  const m = sized ?? curve[mode];
  return {
    round1: m.round1,
    round2: m.round2,
    round3: m.round3,
    round4Plus: m.round4Plus,
    sustain: m.sustain,
    projected: String(curve.evidence ?? "").startsWith("PROJECTED"),
    sizeCertified: Boolean(sized),
  };
}

/**
 * Compare the party the checker is running against the published midpoint for its level and mode.
 *
 * Returns null when the level is not in the curve at all — a missing row is a question, not a
 * zero, and the panel shows nothing rather than a delta against nothing.
 */
export function partyBenchmark(opts: {
  level: number;
  mode: PartyEquipmentMode;
  /** The party being measured — the midpoint is drawn for THIS size when the curve certifies it. */
  partySize?: number;
  current: RoundsAndSustain;
}): PartyBenchmark | null {
  const mid = midpointFor(opts.level, opts.mode, opts.partySize);
  if (!mid) return null;
  const { current } = opts;
  const rows: BenchmarkRow[] = [
    row("round1", LABELS.round1, mid.round1, current.round1),
    row("round2", LABELS.round2, mid.round2, current.round2),
    row("round3", LABELS.round3, mid.round3, current.round3),
    row("round4Plus", LABELS.round4Plus, mid.round4Plus, current.round4Plus),
    row("fourRoundAvg", "4-rd avg", fourRoundAverage(mid), fourRoundAverage(current)),
    row("sustain", LABELS.sustain, mid.sustain, current.sustain),
  ];
  return { level: opts.level, mode: opts.mode, projected: mid.projected, rows };
}
