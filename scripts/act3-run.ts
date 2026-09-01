/**
 * ACT 3, START TO END — the same check that was run on F3, applied to every fight.
 *   npm run report:act3
 *
 * Christopher, 2026-09-01: *"and do the same check from act 3 start to act 3 end."*
 *
 * F3 was diagnosed by asking four questions of one fight. This asks them of all ten:
 *
 *   1. WHAT IS EACH BODY WORTH, and which factors got it there. A body with no factors at all is
 *      the F3 finding — the Veilwood Crone carried nothing while the Mare carried the whole pair's
 *      protection.
 *   2. WHAT DOES THE PARTY LAND, cumulatively, by round.
 *   3. HOW CLOSE IS THE ROUND COUNT TO FLIPPING. F3 clears at 220.9 EHP against 243.9 landed by
 *      the end of round 3 — a 10.4% shortfall. A fight sitting a few percent under a boundary is
 *      one correction away from a different answer, and reporting the round alone hides that.
 *   4. WHAT IT COSTS, carried through the act with its rests.
 *
 * ⚠ THIS IS A REPORT, NOT A GATE. It fails on nothing. `validate:segments` is the drift detector;
 * this is the thing you read when a number looks wrong and you want to know why.
 */

import { BROKEN_CHAIN_MONSTER_LIBRARY } from "../src/data/broken-chain/monsterLibrary";
import { AUTHORED_ENCOUNTERS } from "../src/data/broken-chain/authored.generated";
import { rosterFromTemplates } from "../src/core/encounter-band/rosterFromLibrary";
import { partyDefenceAt } from "../src/core/encounter-band/partyDefenceCurve";
import { effectiveHpPerBody, simulateEncounter, resolvePartyProfile } from "../src/core/encounter-band/checkerV2";
import { SHORT_REST_RECOVERY } from "../src/core/encounter-band/partyResourceCurve";
import type { MainMonsterTemplate } from "../src/core/monsters/runtime/mainMonsterRuntime";

const lib = BROKEN_CHAIN_MONSTER_LIBRARY as MainMonsterTemplate[];
const MODE = "brokenChain" as const;
const SIZE = 4;

/**
 * The act as it is PLAYED — long rest at each level change, SHORT REST between fights.
 *
 * ⚠ THE FIRST VERSION MODELLED NO SHORT RESTS AT ALL, and Christopher caught it: *"are these using
 * the fresh/25%/40/60 doesn't model that the fight should be fought at with the short rest being
 * 25-30% recovery."* Right — a party does not walk from The Cut Below into Gate I without stopping,
 * and a run that pretends otherwise reports every fight after the first as arriving lower than it
 * ever would.
 *
 * `SHORT_REST_RECOVERY` is 0.2554 — 25.5%, inside the band he named, and PUBLISHED rather than
 * chosen here: it is the share of a party's resource pool a short rest hands back, p10 0.07 to p90
 * 0.40 depending on how much of the kit is short-rest refreshed.
 *
 * ⚠ A REST CHANGES WHAT THE PARTY ARRIVES WITH, NOT HOW FAST THEY KILL. Rounds-to-clear is roster
 * EHP against party DPR, and neither moves when the party is rested. So the short rests below fix
 * the DRAIN column and change no round count — which is itself the answer to why these fights come
 * in under the workbook.
 */
const SEGMENTS: Array<{ level: number; ids: string[] }> = [
  { level: 6, ids: ["act3-e1-the-first-court", "act3-e2-the-cut-below", "act3-e3-gate-i-crone-and-mare"] },
  { level: 7, ids: ["act3-e4-the-hollow-feast", "act3-e5-the-scar-line", "campaign-mt3nm2j9"] },
  { level: 8, ids: ["act3-e7-the-last-court", "act3-e8-the-occupied-acre", "act3-e9-gate-iii-veil-torn-dragon"] },
  { level: 9, ids: ["act3-e10-the-center"] },
];

/** The workbook's own Encounter Results sheet, for the side-by-side. */
const WB: Record<string, { rounds: number; cost: number }> = {
  "act3-e1-the-first-court": { rounds: 3, cost: 15.2 },
  "act3-e2-the-cut-below": { rounds: 3, cost: 36.3 },
  "act3-e3-gate-i-crone-and-mare": { rounds: 3, cost: 31.6 },
  "act3-e4-the-hollow-feast": { rounds: 3, cost: 19.4 },
  "act3-e5-the-scar-line": { rounds: 3, cost: 26.2 },
  "campaign-mt3nm2j9": { rounds: 5, cost: 47.9 },
  "act3-e7-the-last-court": { rounds: 3, cost: 24.4 },
  "act3-e8-the-occupied-acre": { rounds: 5, cost: 47.6 },
  "act3-e9-gate-iii-veil-torn-dragon": { rounds: 5, cost: 55.8 },
  "act3-e10-the-center": { rounds: 5, cost: 63.3 },
};

const pct = (n: number) => `${n.toFixed(1)}%`;
const fragile: string[] = [];
const unprotected: string[] = [];

console.log("BROKEN CHAIN — ACT 3, START TO END");
console.log(`party ${SIZE} · Broken Chain curve · focus fire · sustain carried inside each segment\n`);

for (const seg of SEGMENTS) {
  const d = partyDefenceAt(seg.level, MODE);
  const saves = { str: d.str, dex: d.dex, con: d.con, int: d.int, wis: d.wis, cha: d.cha };
  const saveAvg = (d.str + d.dex + d.con + d.int + d.wis + d.cha) / 6;
  const full = resolvePartyProfile({ level: seg.level, size: SIZE, equipmentMode: MODE });

  console.log("═".repeat(100));
  console.log(`FULL REST → LEVEL ${seg.level}   sustain ${full.sustain.toFixed(0)}   party DPR ${full.dpr.round1.toFixed(1)}/${full.dpr.round2.toFixed(1)}/${full.dpr.round3.toFixed(1)}/${full.dpr.round4Plus.toFixed(1)}`);

  // What the party has landed by the end of each round — the boundary every fight is measured to.
  const landed: number[] = [];
  let run = 0;
  for (let i = 1; i <= 6; i++) {
    run += i === 1 ? full.dpr.round1 : i === 2 ? full.dpr.round2 : i === 3 ? full.dpr.round3 : full.dpr.round4Plus;
    landed.push(run);
  }
  console.log(`  party lands, cumulatively: ${landed.map((v, i) => `R${i + 1} ${v.toFixed(0)}`).join(" · ")}`);

  let sustain = full.sustain;
  let firstOfSegment = true;

  for (const id of seg.ids) {
    // A short rest between fights, never before the first — that one follows a long rest.
    if (!firstOfSegment) {
      const before = sustain;
      sustain = Math.min(full.sustain, sustain + full.sustain * SHORT_REST_RECOVERY);
      console.log(`\n  ── SHORT REST   +${pct(SHORT_REST_RECOVERY * 100)} of full   ${pct((before / full.sustain) * 100)} → ${pct((sustain / full.sustain) * 100)}`);
    }
    firstOfSegment = false;
    const enc = AUTHORED_ENCOUNTERS.find(e => e.id === id);
    if (!enc) { console.log(`\n  ${id} — MISSING`); continue; }
    const entries = enc.entries
      .map(e => ({ template: lib.find(m => m.templateId === e.templateId)!, quantity: e.count }))
      .filter(e => e.template);
    const built = rosterFromTemplates(entries, seg.level, { ac: d.ac, saveBonus: saveAvg, partySize: SIZE, saves });

    const arriveAt = sustain;
    const arrivePct = (arriveAt / full.sustain) * 100;
    const profile = resolvePartyProfile({ level: seg.level, size: SIZE, equipmentMode: MODE, customSustain: arriveAt });
    const sim = simulateEncounter({
      party: { size: SIZE, sustain: profile.sustain, dpr: profile.dpr },
      roster: built.roster, settings: { damageAllocation: "focus_fire" },
    });
    const taken = sim.rounds[sim.rounds.length - 1]?.cumulativeMonsterDamage ?? 0;
    sustain = Math.max(0, arriveAt - taken);

    const total = built.roster.reduce((s, g) => s + effectiveHpPerBody(g, SIZE) * Number(g.quantity ?? 0), 0);
    /**
     * ⚠ A WIPE IS NOT A CLEAR, AND `completionRound ?? fatalRound` READ AS ONE. Gate II exits at
     * 0.0% sustain — the party is dead — and the first draft of this report printed "ends R4"
     * beside it in the same words it uses for a fight the party walks away from. The whole purpose
     * of an act run is that a fight's outcome carries into the next one, so the outcome has to be
     * the first thing the line says.
     */
    const wiped = sim.fatalRound !== null && sim.fatalRound !== undefined;
    const ends = (wiped ? sim.fatalRound : sim.completionRound) ?? 0;
    const outcome = wiped ? `WIPE R${ends}` : `ends R${ends}`;
    const w = WB[id];

    console.log(`\n  ── ${enc.name}`);
    for (const g of built.roster) {
      const each = effectiveHpPerBody(g, SIZE);
      const factors = (g.traitFactors ?? []).map(f => `${f.stackGroup ?? f.label} ${(f.contribution ?? 0) >= 0 ? "+" : ""}${(f.contribution ?? 0).toFixed(4)}`);
      const bodiless = (g as { bodiless?: boolean }).bodiless;
      console.log(`     ${String(g.name).slice(0, 38).padEnd(39)} x${String(g.quantity).padStart(2)}  EHP ${(each * Number(g.quantity ?? 0)).toFixed(1).padStart(7)}`
        + `  dpr ${Number(g.dpr?.round1 ?? 0).toFixed(1).padStart(5)}`
        + `  ${factors.length ? factors.join(", ") : bodiless ? "—" : "NO DEFENSIVE FACTORS"}`);
      if (!factors.length && !bodiless && each > 0) unprotected.push(`${enc.name} · ${g.name}`);
    }

    // How close is this to landing on a different round?
    const boundary = landed[ends - 1] ?? 0;
    const prev = landed[ends - 2] ?? 0;
    const headroom = boundary - total;
    const margin = total > 0 ? (headroom / total) * 100 : 0;
    if (!wiped && ends > 0 && margin >= 0 && margin < 15) {
      fragile.push(`${enc.name}: ends R${ends} with only ${pct(margin)} of EHP between it and R${ends + 1}`);
    }

    console.log(`     ${"".padEnd(39)}      ─────────`);
    console.log(`     roster EHP ${total.toFixed(1)}   ${outcome}`
      + (w ? `   (workbook R${w.rounds})` : "")
      + (wiped
        ? `   ·  the party ran out of sustain on round ${ends}`
        : `   ·  cleared by R${ends} because the party had landed ${boundary.toFixed(1)} by then`));
    if (!wiped && ends > 0 && headroom >= 0) {
      console.log(`     to survive into R${ends + 1} it needs > ${boundary.toFixed(1)} EHP — short by ${headroom.toFixed(1)} (${pct(margin)} more)`);
    }
    console.log(`     arrive ${pct(arrivePct)} of full  →  takes ${taken.toFixed(0)}  →  exit ${pct((sustain / full.sustain) * 100)}`
      + `   ·  this fight cost ${pct((taken / full.sustain) * 100)}`
      + (w ? `   (workbook ${pct(w.cost)})` : ""));
  }
  console.log(`\n  segment ends at ${pct((sustain / full.sustain) * 100)} of a full party's sustain`);
}

console.log("\n" + "═".repeat(100));
console.log("BODIES CARRYING NO DEFENSIVE FACTOR AT ALL");
console.log("  The F3 finding was one of these: the Crone priced at raw HP while the Mare carried the pair's");
console.log("  whole protection. Not automatically wrong — a creature MEANT to be reached belongs here — but");
console.log("  each one is a body the checker prices as if nothing on the field were helping it.");
if (unprotected.length === 0) console.log("  none");
for (const u of unprotected) console.log(`  · ${u}`);

console.log("\nFIGHTS SITTING CLOSE TO A ROUND BOUNDARY");
console.log("  A fight a few percent under the next boundary is one correction away from a different answer,");
console.log("  and the round count alone hides that. These are the ones to look at before certifying any of it.");
if (fragile.length === 0) console.log("  none");
for (const f of fragile) console.log(`  · ${f}`);
