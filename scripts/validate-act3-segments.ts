/**
 * ACT 3 SEQUENTIAL RUN — measured against the AUTHORED library.
 *
 * Run: npm run validate:segments
 *
 * ⚠ THE AUTHORED LIBRARY IS THE TRUTH FOR THE BROKEN CHAIN (Christopher, 2026-08-28):
 * *"V3_15 is well over 10 iterations back, why is even saved, the authored library is the truth
 * for the BC mod."*
 *
 * This file used to carry rosters and reference figures transcribed out of
 * `Broken_Chain_Act3_Encounters_Current_Rosters_Only_v3_15.docx`. That document is more than ten
 * iterations old, and keeping a copy of it here had three costs, all of which were paid:
 *
 *   · IT MEASURED FIGHTS THE APP NO LONGER HAS. E7 and E8 were reported "NOT RUN — the document
 *     jumps from FIGHT 6 to FIGHT 9", while The Last Court and The Occupied Acre have been
 *     authored encounters the whole time.
 *   · IT MEASURED CREATURES THAT HAD MOVED ON. The four Mirrors were HAND-BUILT here with ONE
 *     attack and none of their spells, while the authored Mirror has two attacks and a full kit.
 *     That produced a 65-damage gap I filed as "the one with no explanation" — pointing at the
 *     campaign when the stale copy was in this file. A hand-built creature is a second copy, and
 *     the second copy is always the one that is wrong.
 *   · AND IT INVITED A COMPARISON THAT MEANS NOTHING. A number from a superseded document is not a
 *     target; disagreeing with it is the content being newer.
 *
 * So there is no transcription any more. The rosters ARE the authored encounters, and the only
 * reference is what this engine measured last — which makes this a DRIFT detector, its honest job.
 *
 * ⚠ WHAT THIS IS NOT: the Encounter Checker. The app reads the DM's actual party actors, prices
 * typed resistances off their real damage mix, and takes an arrival state per fight. A script has
 * no actors, so resistances price at nothing here and the figures for fights containing them are a
 * LOWER BOUND. Balance is judged in the app; this only answers "did the engine move?".
 *
 * ⚠ THE EXIT CHECK IS THE LAST THING IN THIS FILE. See MASTER on `check:summons`.
 */

import { BROKEN_CHAIN_MONSTER_LIBRARY } from "../src/data/broken-chain/monsterLibrary";
import { AUTHORED_ENCOUNTERS } from "../src/data/broken-chain/authored.generated";
import { rosterFromTemplates } from "../src/core/encounter-band/rosterFromLibrary";
import { simulateEncounter, resolvePartyProfile } from "../src/core/encounter-band/checkerV2";
import { partyDefenceAt } from "../src/core/encounter-band/partyDefenceCurve";
import { nextArrivalSpent } from "../src/core/encounter-band/actRun";
import { SHORT_REST_RECOVERY } from "../src/core/encounter-band/partyResourceCurve";
import { ACT3_SEGMENTS } from "./act3Layout";
import type { MainMonsterTemplate } from "../src/core/monsters/runtime/mainMonsterRuntime";

const lib = BROKEN_CHAIN_MONSTER_LIBRARY as MainMonsterTemplate[];
const PARTY_SIZE = 4;
const MODE = "brokenChain" as const;

/**
 * ⚠ BY TEMPLATE ID, NEVER BY NAME. Christopher: *"there should be no 'snapshot' only my authored
 * id, because snapshot means it reverts to things from before the changes."* This validator once
 * crashed on `not in library: Veil-Torn Wyrmling` because that id had been renamed "Veilbound Drake
 * Guard". The creature never moved; only its label did, which is what authoring is for.
 */
const byId = (id: string): MainMonsterTemplate => {
  const t = lib.find(m => m.templateId === id);
  if (!t) throw new Error(`not in library: ${id}`);
  return t;
};

/**
 * WHERE THE FIGHTS FALL — the shared layout, and the engine's rest model on top of it.
 *
 * ⚠ THIS FILE USED TO CARRY ITS OWN `SEGMENTS` AND NO RESTS AT ALL, and both halves of that were
 * wrong. Christopher, 2026-09-08: *"why would something as a validate need to care about the act
 * when something like this is suppose to be engine based"*.
 *
 * It should not, and it no longer does. `actRun.ts` is the rest model — *"LAYER: engine. Acts,
 * rests and level gates are not a 5e idea and not a Broken Chain one"* — and `nextArrivalSpent`
 * plus the published `SHORT_REST_RECOVERY` are what apply one. The only thing that stays here is
 * the campaign fact an encounter record cannot carry, and even that is now shared with
 * `act3-run.ts` rather than copied: see `act3Layout.ts`.
 *
 * What the second copy cost, exactly: carrying raw sustain with NO rest walked the party into
 * Gate II at 62% spent and reported a round-2 wipe. Christopher: *"no gate 2 doesnt wipe on round
 * 2 why is that measured."* It does not — from a correct arrival state it does not, and the
 * v3.45 Mirror replay shows six of eight cohort parties clearing it.
 */
const SEGMENTS = ACT3_SEGMENTS.map(seg => ({ label: `Level ${seg.level}`, level: seg.level, steps: seg.steps }));

/**
 * WHAT THIS ENGINE MEASURED, at 0.8.11.5, against the authored library.
 *
 * ⚠ TWO FIGURES MOVED AT 0.8.13.0, when the simulation stopped assuming half a roster acts before
 * the party and started reading each body's DEX against the party's. Gate I rose 124 → 130: the
 * Crone and the Mare outrun a level-6 party, so more of their output lands before it can be
 * removed. The Center FELL 252 → 243: the Thought Harrower is DEX +1 against a level-9 party at
 * +3.1, so the party now outruns it. Both moves are the model reading initiative it previously
 * could not see, and both are small because the old midpoint was a fair average — it was only
 * ever wrong at the ends.
 *
 * ⚠ THE CUT BELOW MOVED R2 -> R3 (82 -> 105) when Shardbound's "Shatter the Stake" was RESTORED:
 * a reaction imposing disadvantage once a round, priced at the workbook's own +0.047749, which the
 * authoring round trip had dropped. An extra round of the fight is an extra round of its damage.
 *
 * ⚠ NOT A TARGET AND NOT A BALANCE JUDGEMENT — a fingerprint. Drift from it means the ENGINE or the
 * CONTENT changed; whether that change was wanted is a question for the app, with a real party.
 * When a change is intended, re-run with UPDATE_REFERENCE=1 and commit the result WITH the change
 * that caused it, exactly as `check:baseline` is accepted.
 */
const REFERENCE: Record<string, { completion: string; monsterDamage: number }> = {
  "act3-e1-the-first-court": { completion: "R2", monsterDamage: 40 },
  "act3-e2-the-cut-below": { completion: "R2", monsterDamage: 111 },
  "act3-e3-gate-i-crone-and-mare": { completion: "R3", monsterDamage: 167 },
  "act3-e4-the-hollow-feast": { completion: "R3", monsterDamage: 63 },
  /**
   * ⚠ THE FIGHT TO LOOK AT. 267 damage over five rounds is 54% of a level-7 pool, where every
   * other fight in the act costs 9-40%. It is what walks the party into Gate II at 41% spent
   * instead of the 25-30% Christopher states, and it is the one figure here that is recorded
   * rather than accepted.
   */
  "act3-e5-the-scar-line": { completion: "R5", monsterDamage: 267 },
  "campaign-mt3nm2j9": { completion: "FAIL R4", monsterDamage: 307 },
  "act3-e7-the-last-court": { completion: "R3", monsterDamage: 137 },
  "act3-e8-the-occupied-acre": { completion: "R4", monsterDamage: 135 },
  "act3-e9-gate-iii-veil-torn-dragon": { completion: "R4", monsterDamage: 238 },
  "act3-e10-the-center": { completion: "R4", monsterDamage: 376 },
};

const TOLERANCE = 5;

function runFight(encounterId: string, level: number, arrivingSpent: number, fullSustain: number) {
  const enc = AUTHORED_ENCOUNTERS.find(e => e.id === encounterId);
  if (!enc) throw new Error(`authored encounter missing: ${encounterId}`);

  const defence = partyDefenceAt(level, MODE);
  const saves = { str: defence.str, dex: defence.dex, con: defence.con, int: defence.int, wis: defence.wis, cha: defence.cha };
  const saveAvg = (defence.str + defence.dex + defence.con + defence.int + defence.wis + defence.cha) / 6;

  const entries = enc.entries.map(e => ({ template: byId(e.templateId), quantity: e.count }));
  const built = rosterFromTemplates(entries, level, { ac: defence.ac, saveBonus: saveAvg, partySize: PARTY_SIZE, saves });
  /**
   * ⚠ `arrivingSpent`, NOT `customSustain`. Christopher, 2026-09-01: *"you are wrong that the %
   * of spent didn't effect dpr."* A depleted party also KILLS slower, so scaling only the pool
   * left a spent party opening every fight with a full nova. `act3-run.ts` was corrected for this
   * a week before this file was; the copy is how the correction got un-made.
   */
  const profile = resolvePartyProfile({ level, size: PARTY_SIZE, equipmentMode: MODE, arrivingSpent });
  const result = simulateEncounter({
    /**
     * ⚠ THE DEX LINE IS THE PARTY'S INITIATIVE, AND LEAVING IT OUT IS NOT NEUTRAL. Omitted, the
     * party schedules at +0 while every Act 3 body reads its real DEX (+2 to +5 across the
     * library), so every roster would act first far more often here than it does in the app.
     * This script has to schedule the party the same way the panel does or it is measuring a
     * fight nobody plays.
     */
    party: { size: PARTY_SIZE, sustain: profile.sustain, dpr: profile.dpr, initiative: defence.dex },
    roster: built.roster, settings: { damageAllocation: "focus_fire" },
  });
  const last = result.rounds[result.rounds.length - 1];
  const spent = last?.cumulativeMonsterDamage ?? 0;
  /** What this fight cost, as a share of the FULL pool — the unit `nextArrivalSpent` carries. */
  const cost = fullSustain > 0 ? spent / fullSustain : 0;
  return {
    name: enc.name,
    completion: result.completionRound !== null ? `R${result.completionRound}`
      : result.fatalRound !== null ? `FAIL R${result.fatalRound}` : "—",
    monsterDamage: spent,
    usedPct: (spent / fullSustain) * 100,
    cost,
    left: fullSustain * (1 - Math.min(1, arrivingSpent + cost)),
    leftPct: (1 - Math.min(1, arrivingSpent + cost)) * 100,
    assumptions: built.assumptions,
  };
}

const W = (s: string, n: number) => s.padEnd(n).slice(0, n);
const UPDATING = process.env.UPDATE_REFERENCE === "1";

console.log("BROKEN CHAIN — ACT 3, from the AUTHORED library, sustain carried inside each segment");
console.log(`party ${PARTY_SIZE} · Broken Chain mode · focus fire · ${AUTHORED_ENCOUNTERS.filter(e => (e.actTag ?? "").includes("3")).length} authored Act 3 encounters\n`);
console.log(`${W("Fight", 34)}${W("Ends", 8)}${W("Monster dmg", 14)}${W("Used", 8)}${W("Left in segment", 20)}  vs measured`);
console.log("─".repeat(112));

const drift: string[] = [];
const notPriced: string[] = [];
const measured: Record<string, { completion: string; monsterDamage: number }> = {};

for (const seg of SEGMENTS) {
  const full = resolvePartyProfile({ level: seg.level, size: PARTY_SIZE, equipmentMode: MODE }).sustain;
  console.log(`${W(`FULL REST / ${seg.label}`, 34)}${W("—", 8)}${W("—", 14)}${W("—", 8)}${full.toFixed(0)} / ${full.toFixed(0)}`);
  /** Arrival state, as a SHARE of the full pool — the unit the engine carries rests in. */
  let spent = 0;

  for (const step of seg.steps) {
    const id = step.id;
    const r = runFight(id, seg.level, spent, full);
    measured[id] = { completion: r.completion, monsterDamage: Math.round(r.monsterDamage) };

    const ref = REFERENCE[id];
    const delta = ref ? `${ref.completion} ${ref.monsterDamage} (${(r.monsterDamage - ref.monsterDamage >= 0 ? "+" : "")}${(r.monsterDamage - ref.monsterDamage).toFixed(0)})` : "no reference";
    console.log(`${W(r.name, 34)}${W(r.completion, 8)}${W(r.monsterDamage.toFixed(0), 14)}${W(`${r.usedPct.toFixed(0)}%`, 8)}${W(`${r.left.toFixed(0)} / ${full.toFixed(0)} — ${r.leftPct.toFixed(0)}%`, 20)}  ${delta}`);

    if (ref && Math.abs(ref.monsterDamage - r.monsterDamage) > TOLERANCE) {
      drift.push(`${r.name}: engine ${r.monsterDamage.toFixed(0)} vs measured ${ref.monsterDamage} (${(r.monsterDamage - ref.monsterDamage).toFixed(0)})`);
    }
    for (const a of r.assumptions) if (a.flag === "NEEDS DM INPUT") notPriced.push(`${r.name}: ${a.creature} · ${a.field}`);

    /**
     * ⚠ THE REST IS THE ENGINE'S, NOT THIS FILE'S. `nextArrivalSpent` is where Long resets to 0,
     * Short gives back the published `SHORT_REST_RECOVERY`, and None carries it all. Re-deriving
     * any of that here is what produced a Gate II wipe that does not happen.
     */
    spent = nextArrivalSpent(spent, r.cost, step.restAfter, SHORT_REST_RECOVERY);
    if (step.restAfter !== "None") {
      const label = step.restAfter === "Long"
        ? "LONG REST — full reset"
        : `SHORT REST +${(SHORT_REST_RECOVERY * 100).toFixed(1)}%${step.restConfirmed ? "" : "  [placement UNCONFIRMED]"}`;
      console.log(`${W("", 34)}${W("", 8)}${W("", 14)}${W("", 8)}${label} → next arrives at ${((1 - spent) * 100).toFixed(1)}%`);
    }
  }
  console.log("");
}

console.log("DRIFT FROM THE MEASURED REFERENCE — this is what fails the build\n" + "─".repeat(112));
if (drift.length === 0) console.log("  none — every fight is within 5 damage of what it last measured");
else {
  drift.forEach(m => console.log("  " + m));
  console.log("\n  If the change was INTENDED, record it:  UPDATE_REFERENCE=1 npm run validate:segments");
  console.log("  and commit the new figures WITH the change that caused them.");
}

console.log("\nNOT PRICED — structural, because this script runs headless\n" + "─".repeat(112));
if (notPriced.length === 0) console.log("  none");
else {
  notPriced.forEach(m => console.log("  " + m));
  console.log("  ⚠ A typed resistance is weighed by the PARTY'S share of that damage type, and a script");
  console.log("    has no party actors. These price at nothing, so their fights read LOW. The app's");
  console.log("    Encounter Checker reads the real party and is where balance is judged.");
}

if (UPDATING) {
  console.log("\nUPDATED REFERENCE — paste over REFERENCE in this file\n" + "─".repeat(112));
  for (const [id, m] of Object.entries(measured)) {
    console.log(`  ${JSON.stringify(id)}: { completion: ${JSON.stringify(m.completion)}, monsterDamage: ${m.monsterDamage} },`);
  }
}

console.log(`\n${drift.length === 0 ? "PASS" : `FAIL — ${drift.length} fight(s) drifted`}`);
process.exit(drift.length === 0 ? 0 : 1);
