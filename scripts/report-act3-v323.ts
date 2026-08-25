/**
 * What the estimator makes of the v3.23 Act 3 rebuild.
 *   npx tsx scripts/report-act3-v323.ts
 *
 * Christopher, on handing over `Broken_Chain_Act3_Encounters_v3_23_F8_Designed_Update.docx`:
 * *"look at each traits and check what the rebuilt creature estimator shows for each trait, dpr
 * for each action and ensure that the encounter checker can read every one of them."*
 *
 * Three columns, because three different things can go wrong:
 *   TRAITS  — did each defence resolve to a CALIBRATED rule, or is it carrying a bare number?
 *   ACTIONS — what the trace actually schedules per round, and what each scheduled item is worth.
 *   READ    — does anything in the block reach the checker as unreadable?
 *
 * This is a REPORT, not a check: it asserts nothing and always exits 0. What it prints is meant
 * to be read against the document.
 */
import { BROKEN_CHAIN_MONSTER_LIBRARY } from "../src/data/broken-chain/monsterLibrary";
import { rosterFromTemplates, traitFactorsFor } from "../src/core/encounter-band/rosterFromLibrary";
import { parseCreature } from "../src/core/encounter-band/parseCreature";
import { traceCreature } from "../src/core/encounter-band/actionTrace";
import { traitRule } from "../src/core/encounter-band/compactImport";
import { partyDefenceAt } from "../src/core/encounter-band/partyDefenceCurve";
import { resolvePartyProfile, simulateEncounter } from "../src/core/encounter-band/checkerV2";

const LEVEL = 8;
const SIZE = 4;
const def = partyDefenceAt(LEVEL, "brokenChain");
const target = {
  ac: def.ac, partySize: SIZE,
  saveBonus: (def.str + def.dex + def.con + def.int + def.wis + def.cha) / 6,
  saves: { str: def.str, dex: def.dex, con: def.con, int: def.int, wis: def.wis, cha: def.cha },
};

const FIGHTS: Array<[string, string[]]> = [
  ["FIGHT 7 — The Last Court", ["Blackbough Reeve", "Gloam Harrow", "Brandwing"]],
  ["FIGHT 8 — The Occupied Acre", ["Demon Knight of Punishment", "Breaker", "Demonic Reaver"]],
  ["FIGHT 3 — Gate I (Crone trait update)", ["Veilwood Crone", "Darkmare"]],
];

const pick = (n: string) => {
  const t = BROKEN_CHAIN_MONSTER_LIBRARY.find(x => x.name === n);
  if (!t) throw new Error(`no library entry named ${n}`);
  return t;
};

let uncalibrated = 0;
let unreadable = 0;

for (const [fightName, names] of FIGHTS) {
  console.log(`\n${"=".repeat(78)}\n${fightName}   ·   party L${LEVEL} ${SIZE}P, AC ${def.ac.toFixed(2)}\n${"=".repeat(78)}`);

  for (const name of names) {
    const template = pick(name);
    const parsed = parseCreature(template);
    console.log(`\n  ${name}  —  ${parsed.maxHp} HP · AC ${parsed.ac} · ${template.stats.attacksPerTurn ?? 1} attack(s)/turn`);

    // ── TRAITS ────────────────────────────────────────────────────────────────
    const traitNotes: string[] = [];
    const factors = traitFactorsFor(template, [] as never);
    const defenses = template.stats.defenses ?? [];
    console.log(`    TRAITS`);
    for (const d of defenses) {
      const rule = traitRule(d.rule ?? d.name);
      const x = d.ehpMultiplier ?? 1;
      if (x === 1) {
        console.log(`      · ${d.name}  x1.0  DECIDED — ${d.note ? "reason stated, raises no assumption" : "NO NOTE, will raise an assumption"}`);
        if (!d.note) unreadable++;
      } else if (rule) {
        const exact = Math.abs((1 + rule.contribution) - x) < 5e-6;
        console.log(`      · ${d.name}  x${x.toFixed(6)}  -> "${rule.label}" [${rule.stack_group}]  ${exact ? "EXACT" : "NEAR"}`);
      } else {
        console.log(`      · ${d.name}  x${x.toFixed(6)}  *** NO CALIBRATED RULE — authored number, stack group is its own name`);
        uncalibrated++;
      }
    }
    if (defenses.length === 0) console.log(`      (none authored)`);
    const product = factors.reduce((p, f) => p * (1 + f.contribution), 1);
    console.log(`      trait product x${product.toFixed(6)}  ·  personal EHP ${(parsed.maxHp * product).toFixed(1)} before AC`);
    for (const n of traitNotes) console.log(n);

    // ── ACTIONS ───────────────────────────────────────────────────────────────
    const trace = traceCreature(parsed, target, 4);
    console.log(`    ACTIONS — what the trace schedules, per round`);
    for (const r of trace.rounds) {
      console.log(`      R${r.round}  total ${r.totalExpectedDamage.toFixed(1)}`);
      for (const s of r.scheduled) {
        console.log(`           ${s.feature.padEnd(24)} ${s.expectedDamage.toFixed(1).padStart(6)}  [${s.channel}] ${s.expectation}${s.resourceSpent ? " · spends " + s.resourceSpent : ""}`);
      }
      if (r.scheduled.length === 0) console.log(`           (nothing scheduled)`);
    }

    // ── READ ──────────────────────────────────────────────────────────────────
    const built = rosterFromTemplates([{ template, quantity: 1 }], LEVEL, target as never);
    if (built.assumptions.length === 0) {
      console.log(`    READ  clean — no assumptions`);
    } else {
      console.log(`    READ  ${built.assumptions.length} assumption(s):`);
      for (const a of built.assumptions) {
        console.log(`      [${a.flag}] ${a.field} — ${a.detail}`);
        if (a.flag === "NEEDS DM INPUT") unreadable++;
      }
    }
  }

  // ── THE FIGHT AS THE CHECKER PRICES IT ──────────────────────────────────────
  if (names.length >= 2 && !fightName.startsWith("FIGHT 3")) {
    const entries = names.map(n => ({ template: pick(n), quantity: 1 }));
    const built = rosterFromTemplates(entries, LEVEL, target as never);
    const roster = [...built.roster].sort((a, b) => a.baseHp * a.quantity - b.baseHp * b.quantity);
    const party = resolvePartyProfile({ level: LEVEL, size: SIZE, equipmentMode: "brokenChain" });
    const res = simulateEncounter({ party, roster, allocation: "focus_fire",
      partyDefence: { ac: target.ac, saveBonus: target.saveBonus, partySize: SIZE } } as never) as never as {
        rounds: Array<{ round: number; monsterDamage: number; monsterEhpLeft: number; downs: number; standing: number }>;
        completionRound: number | null; fatalRound: number | null;
      };
    const totalEhp = roster.reduce((s, g) => s + g.quantity * g.baseHp, 0);
    console.log(`\n  ── THE FIGHT ── raw HP ${totalEhp} · party ${party.dpr.round1.toFixed(0)}/${party.dpr.round2.toFixed(0)}/${party.dpr.round3.toFixed(0)}/${party.dpr.round4Plus.toFixed(0)} · sustain ${party.sustain.toFixed(0)}`);
    console.log(`     R | party dmg left | monster dmg | down | standing`);
    for (const r of res.rounds) {
      console.log(`     ${r.round} |     ${r.monsterEhpLeft.toFixed(0).padStart(6)}     |    ${r.monsterDamage.toFixed(1).padStart(5)}    |  ${r.downs}   |    ${r.standing}`);
    }
    console.log(`     clears R${res.completionRound ?? "—"}${res.fatalRound !== null ? `, FATAL R${res.fatalRound}` : ""}`);
  }
}

console.log(`\n${"=".repeat(78)}`);
console.log(`SUMMARY  ·  ${uncalibrated} defence(s) carrying an uncalibrated number  ·  ${unreadable} unreadable to the checker`);
console.log(`${"=".repeat(78)}`);
