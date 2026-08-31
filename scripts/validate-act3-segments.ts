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
 * WHAT LEVEL THE PARTY WALKS EACH FIGHT AT, and where a full rest falls.
 *
 * This is the one campaign fact the encounter records do not carry — an encounter knows its roster,
 * not when in the act it is met. Keyed by AUTHORED ID so a rename cannot break it.
 */
const SEGMENTS: Array<{ label: string; level: number; encounterIds: string[] }> = [
  { label: "Level 6", level: 6, encounterIds: [
    "act3-e1-the-first-court", "act3-e2-the-cut-below", "act3-e3-gate-i-crone-and-mare"] },
  { label: "Level 7", level: 7, encounterIds: [
    "act3-e4-the-hollow-feast", "act3-e5-the-scar-line", "campaign-mt3nm2j9"] },
  { label: "Level 8", level: 8, encounterIds: [
    "act3-e7-the-last-court", "act3-e8-the-occupied-acre", "act3-e9-gate-iii-veil-torn-dragon"] },
  { label: "Level 9", level: 9, encounterIds: ["act3-e10-the-center"] },
];

/**
 * WHAT THIS ENGINE MEASURED, at 0.8.9.6, against the authored library.
 *
 * ⚠ NOT A TARGET AND NOT A BALANCE JUDGEMENT — a fingerprint. Drift from it means the ENGINE or the
 * CONTENT changed; whether that change was wanted is a question for the app, with a real party.
 * When a change is intended, re-run with UPDATE_REFERENCE=1 and commit the result WITH the change
 * that caused it, exactly as `check:baseline` is accepted.
 */
const REFERENCE: Record<string, { completion: string; monsterDamage: number }> = {
  "act3-e1-the-first-court": { completion: "R3", monsterDamage: 45 },
  "act3-e2-the-cut-below": { completion: "R2", monsterDamage: 82 },
  "act3-e3-gate-i-crone-and-mare": { completion: "R3", monsterDamage: 124 },
  "act3-e4-the-hollow-feast": { completion: "R3", monsterDamage: 55 },
  "act3-e5-the-scar-line": { completion: "R3", monsterDamage: 91 },
  // ⚠ FAIL R4 — a WIPE in this model, and it is the fight to look at in the app with a real party.
  "campaign-mt3nm2j9": { completion: "FAIL R4", monsterDamage: 256 },
  "act3-e7-the-last-court": { completion: "R3", monsterDamage: 85 },
  "act3-e8-the-occupied-acre": { completion: "R3", monsterDamage: 75 },
  "act3-e9-gate-iii-veil-torn-dragon": { completion: "R4", monsterDamage: 211 },
  "act3-e10-the-center": { completion: "R4", monsterDamage: 249 },
};

const TOLERANCE = 5;

function runFight(encounterId: string, level: number, sustainNow: number, fullSustain: number) {
  const enc = AUTHORED_ENCOUNTERS.find(e => e.id === encounterId);
  if (!enc) throw new Error(`authored encounter missing: ${encounterId}`);

  const defence = partyDefenceAt(level, MODE);
  const saves = { str: defence.str, dex: defence.dex, con: defence.con, int: defence.int, wis: defence.wis, cha: defence.cha };
  const saveAvg = (defence.str + defence.dex + defence.con + defence.int + defence.wis + defence.cha) / 6;

  const entries = enc.entries.map(e => ({ template: byId(e.templateId), quantity: e.count }));
  const built = rosterFromTemplates(entries, level, { ac: defence.ac, saveBonus: saveAvg, partySize: PARTY_SIZE, saves });
  const profile = resolvePartyProfile({ level, size: PARTY_SIZE, equipmentMode: MODE, customSustain: sustainNow });
  const result = simulateEncounter({
    party: { size: PARTY_SIZE, sustain: sustainNow, dpr: profile.dpr },
    roster: built.roster, settings: { damageAllocation: "focus_fire" },
  });
  const last = result.rounds[result.rounds.length - 1];
  const spent = last?.cumulativeMonsterDamage ?? 0;
  return {
    name: enc.name,
    completion: result.completionRound !== null ? `R${result.completionRound}`
      : result.fatalRound !== null ? `FAIL R${result.fatalRound}` : "—",
    monsterDamage: spent,
    usedPct: (spent / fullSustain) * 100,
    left: sustainNow - spent,
    leftPct: ((sustainNow - spent) / fullSustain) * 100,
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
  let sustainNow = full;

  for (const id of seg.encounterIds) {
    const r = runFight(id, seg.level, sustainNow, full);
    measured[id] = { completion: r.completion, monsterDamage: Math.round(r.monsterDamage) };

    const ref = REFERENCE[id];
    const delta = ref ? `${ref.completion} ${ref.monsterDamage} (${(r.monsterDamage - ref.monsterDamage >= 0 ? "+" : "")}${(r.monsterDamage - ref.monsterDamage).toFixed(0)})` : "no reference";
    console.log(`${W(r.name, 34)}${W(r.completion, 8)}${W(r.monsterDamage.toFixed(0), 14)}${W(`${r.usedPct.toFixed(0)}%`, 8)}${W(`${r.left.toFixed(0)} / ${full.toFixed(0)} — ${r.leftPct.toFixed(0)}%`, 20)}  ${delta}`);

    if (ref && Math.abs(ref.monsterDamage - r.monsterDamage) > TOLERANCE) {
      drift.push(`${r.name}: engine ${r.monsterDamage.toFixed(0)} vs measured ${ref.monsterDamage} (${(r.monsterDamage - ref.monsterDamage).toFixed(0)})`);
    }
    for (const a of r.assumptions) if (a.flag === "NEEDS DM INPUT") notPriced.push(`${r.name}: ${a.creature} · ${a.field}`);
    sustainNow = r.left;
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
