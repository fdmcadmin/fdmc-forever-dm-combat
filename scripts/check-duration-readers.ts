/**
 * v5 PHASE 2 — THE DURATION READERS ARE PRICED.
 *   npx tsx scripts/check-duration-readers.ts
 *
 * Christopher, 2026-09-13: *"complete phase 2."* Phase 1 read every duration; this proves what they are
 * worth, in the v5 pricer's own formulas (`durationPricing.ts`):
 *
 *   BR073  concentration holds through each damage instance's Constitution save (DC 10 or half)
 *   BR066  two turns = turn 1 + P_ACTIVE_2 × turn 2          BR067  N turns, the same product
 *   BR075 / BR076 / BR077  a save-ends state stands through each failed repeat save
 *
 * and that the checker charges them where a price already depends on them: a concentration zone (Winter's
 * Toll) loses its later turns only when the party's damage reaches its caster. Every mutation below is the
 * same roster or clause with the one reader removed.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { concentrationHold, cycleActiveShare, repeatFailChance, saveEndsActiveTurns } from "../src/core/encounter-band/durationPricing";
import { simulateEncounter, resolvePartyProfile, type RosterGroup } from "../src/core/encounter-band/checkerV2";
import { rosterFromTemplates } from "../src/core/encounter-band/rosterFromLibrary";
import { partyDefenceAt } from "../src/core/encounter-band/partyDefenceCurve";
import { composeReaders } from "../src/core/encounter-band/broadReaderGate";
import { creatureSaves } from "../src/core/monsters/creator/monsterCreatorModel";
import { BROKEN_CHAIN_MONSTER_LIBRARY as L } from "../src/data/broken-chain/monsterLibrary";
import type { MainMonsterTemplate } from "../src/core/monsters/runtime/mainMonsterRuntime";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps;

console.log("The v5 duration readers, priced\n");

// ── 1. the formulas ─────────────────────────────────────────────────────────────────────────────
console.log("1. the arithmetic, against hand-worked numbers");
ok("BR073: no damage, no save — concentration holds", concentrationHold(0, 0, 15).hold === 1);
{
  const one = concentrationHold(0, 12, 15);
  ok("one blow of 12 at CON +0: one save at DC 10, 55%", one.instances === 1 && one.dc === 10 && near(one.hold, 0.55), `${one.instances} × DC ${one.dc} → ${one.hold}`);
  const four = concentrationHold(0, 60, 15);
  ok("60 in PC shares of 15: four saves at DC 10 → 0.55⁴", near(four.instances, 4) && near(four.hold, Math.pow(0.55, 4)), four.hold.toFixed(4));
  const big = concentrationHold(0, 40, 40);
  ok("one blow of 40: DC 20 → 5%", big.dc === 20 && near(big.hold, 0.05), `DC ${big.dc} → ${big.hold.toFixed(3)}`);
  ok("the DC never passes 30", concentrationHold(0, 100, 100).dc === 30);
  ok("CON +5 at DC 10 holds 80%", near(concentrationHold(5, 10, 10).hold, 0.8));
}
ok("BR066: two turns, never hit — the whole cycle stands", near(cycleActiveShare(2, 1), 1));
ok("BR066: two turns at a 30.25% hold → (1 + 0.3025) / 2", near(cycleActiveShare(2, 0.3025), 0.65125));
ok("BR067: three turns at 50% → (1 + 0.5 + 0.25) / 3", near(cycleActiveShare(3, 0.5), 1.75 / 3));
ok("a one-turn effect has no later turn to lose", near(cycleActiveShare(1, 0), 1));
ok("P_REPEAT_FAIL: DC 15 against +4 fails half the time", near(repeatFailChance(15, 4), 0.5));
{
  const end = saveEndsActiveTurns("end", 0.4, 3);
  ok("BR076: save at the end of its turn — 1, 0.4, 0.16", near(end.expectedTurns, 1.56) && near(end.duringTurn[2], 0.16), end.duringTurn.join(", "));
  const start = saveEndsActiveTurns("start", 0.4, 3);
  ok("BR075: save at the start — the turn is lost only on a fail: 0.4, 0.16, 0.064", near(start.expectedTurns, 0.624) && near(start.beforeSave[0], 1),
    start.duringTurn.map(p => p.toFixed(3)).join(", "));
  ok("a cap of 0 turns stands for none", saveEndsActiveTurns("end", 1, 0).expectedTurns === 0);
}

// ── 2. the checker ─────────────────────────────────────────────────────────────────────────────
console.log("\n2. the checker loses a concentration zone's later turns only when the caster is hit");
const all = (v: number) => ({ round1: v, round2: v, round3: v, round4Plus: v });
const body = (id: string, hp: number, dpr: number): RosterGroup => ({ id, name: id, quantity: 1, baseHp: hp, flatHpPerBody: true, dpr: all(dpr) });
const zoneRow = (concentration: boolean): RosterGroup => ({
  id: "Z", name: "Z", quantity: 1, baseHp: 0, bodiless: true, dpr: all(10), arrivesRound: 1, endsWithGroupId: "H", partyDamageFactor: 0.8,
  ...(concentration ? { concentration: { holderGroupId: "H", conSave: 0, activeTurns: 2, dependent: all(20), fixed: all(-10) } } : {}),
});
type Round = { partyDamage: number; monsterDamage: number; concentration?: { hold: number; activeShare: number; damageToHolder: number }[] };
const sim = (order: RosterGroup[], concentration: boolean) =>
  (simulateEncounter({ party: { size: 4, sustain: 2000, dpr: all(60) }, roster: [...order, zoneRow(concentration)] }) as unknown as { rounds: Round[] }).rounds;
{
  const holderFirst = [body("H", 150, 5), body("A", 300, 10)];
  const [withC, without] = [sim(holderFirst, true), sim(holderFirst, false)];
  ok("round 1 is the cast: identical with and without concentration",
    near(withC[0].partyDamage, without[0].partyDamage) && near(withC[0].monsterDamage, without[0].monsterDamage));
  const r2 = withC[1].concentration?.[0];
  // Round 1: 60 × 0.8 = 48 into the caster, four PC shares of 12 → four saves at DC 10.
  ok("round 2: 48 into the caster → four saves at DC 10 → hold 0.55⁴", !!r2 && near(r2.damageToHolder, 48) && near(r2.hold, Math.pow(0.55, 4)),
    r2 ? `${r2.damageToHolder.toFixed(1)} dealt, hold ${r2.hold.toFixed(4)}, share ${r2.activeShare.toFixed(4)}` : "no report");
  ok("...so the zone stands (1 + hold) / 2 of its cycle", !!r2 && near(r2.activeShare, (1 + Math.pow(0.55, 4)) / 2));
  ok("...the party loses less to it and the allies gain less from it",
    withC[1].partyDamage > without[1].partyDamage && withC[1].monsterDamage < without[1].monsterDamage,
    `party ${withC[1].partyDamage.toFixed(2)} vs ${without[1].partyDamage.toFixed(2)}; monsters ${withC[1].monsterDamage.toFixed(2)} vs ${without[1].monsterDamage.toFixed(2)}`);
  ok("  (mutation) without concentration no round carries a report", without.every(r => r.concentration === undefined));
}
{
  // The party kills A (300) first; at 48 a round the caster takes nothing for six rounds.
  const allyFirst = [body("A", 300, 10), body("H", 150, 5)];
  const [withC, without] = [sim(allyFirst, true), sim(allyFirst, false)];
  const same = [0, 1, 2, 3, 4, 5].every(i => near(withC[i].partyDamage, without[i].partyDamage) && near(withC[i].monsterDamage, without[i].monsterDamage));
  ok("while the party kills someone else, every round is exactly what it was", same,
    withC.slice(0, 6).map(r => r.concentration?.[0]?.hold.toFixed(2)).join(", "));
}

// ── 3. the campaign ────────────────────────────────────────────────────────────────────────────
console.log("\n3. Winter's Toll, as published");
const byName = (n: string) => L.find(t => t.name === n) as MainMonsterTemplate;
const d = partyDefenceAt(8, "brokenChain");
const target = { ac: d.ac, partySize: 4, hitChance: 0.65, saveBonus: (d.str + d.dex + d.con + d.int + d.wis + d.cha) / 6,
  saves: { str: d.str, dex: d.dex, con: d.con, int: d.int, wis: d.wis, cha: d.cha } };
const court = ["Blackbough Reeve", "Gloam Harrow", "Brandwing"];
const build = (patch?: (t: MainMonsterTemplate) => MainMonsterTemplate) =>
  rosterFromTemplates(court.map(n => ({ template: patch ? patch(byName(n)) : byName(n), quantity: 1 })), 8, target as never).roster;
const HARROW = "broken-chain:act3:gloam-harrow:v1";
const roster = build();
const toll = roster.find(g => g.id === `${HARROW}:roster`);
const harrow = byName("Gloam Harrow");
const con = creatureSaves((harrow.abilities ?? []) as never, harrow.stats as never).con;
ok("the Toll row is concentration, held by the Harrow, a two-turn cycle, at her own CON save",
  !!toll?.concentration && toll.concentration.holderGroupId === HARROW && toll.concentration.activeTurns === 2 && toll.concentration.conSave === con,
  toll?.concentration ? `CON ${con}, ${toll.concentration.activeTurns} turns` : "no concentration on the row");
ok("dependent + fixed is the workbook burden to the digit, every round",
  !!toll?.concentration && (["round1", "round2", "round3", "round4Plus"] as const).every(k =>
    near(Math.max(0, Number(toll.concentration!.dependent[k]) + Number(toll.concentration!.fixed[k])), Number(toll.dpr[k]), 1e-9)));
const noConc = (t: MainMonsterTemplate) => t.name !== "Gloam Harrow" ? t : ({ ...t,
  actions: (t.actions ?? []).map(a => /Winter.s Toll/.test(a.name) ? { ...a, concentration: false, text: String(a.text ?? "").replace(/\bConcentration\b\.?/g, "") } : a) }) as MainMonsterTemplate;
ok("  (mutation) a Toll that is not concentration carries none", !build(noConc).find(g => g.id === `${HARROW}:roster`)?.concentration);
{
  const party = resolvePartyProfile({ level: 8, size: 4, equipmentMode: "brokenChain" });
  const run = (r: RosterGroup[]) => (simulateEncounter({ party: { size: 4, sustain: party.sustain, dpr: party.dpr }, roster: r }) as unknown as { rounds: (Round & { cumulativeMonsterDamage: number })[] }).rounds;
  const held = run(roster);
  const always = run(roster.map(g => (g.concentration ? { ...g, concentration: undefined } : g)));
  const last = (rs: { cumulativeMonsterDamage: number }[]) => rs[rs.length - 1]?.cumulativeMonsterDamage ?? 0;
  const breaks = held.map((r, i) => `R${i + 1} ${r.concentration?.[0]?.damageToHolder.toFixed(0) ?? "–"}→${r.concentration?.[0]?.activeShare.toFixed(2) ?? "–"}`).join(" · ");
  ok("the Last Court never costs more for the hold, and each round reports it", last(held) <= last(always) + 1e-9 && held.every(r => !!r.concentration),
    `${last(held).toFixed(1)} vs ${last(always).toFixed(1)} always standing — ${breaks}`);
}

// ── 4. save-ends, in the reader composition ────────────────────────────────────────────────────
console.log("\n4. a save-ends state states how long it stands against the reference party");
const base = byName("Brandwing");
const glare = (text: string, party = true) => composeReaders(({ ...base, actions: [...(base.actions ?? []), { name: "Test Glare", kind: "action", save: "CON DC 15", text }] }) as unknown as MainMonsterTemplate,
  party ? { saves: { str: 4, dex: 4, con: 4, int: 4, wis: 4, cha: 4 }, horizonTurns: 4 } : undefined).mechanics.find(m => m.name === "Test Glare")!;
const endSave = glare("The target has the Paralyzed condition. At the end of each of its turns, the target repeats the saving throw, ending the effect on itself on a success.");
ok("BR076 at DC 15 against +4: 1 + 0.5 + 0.25 + 0.125 of 4 turns", endSave.duration?.reader === "BR076" && near(endSave.duration.expectedTurns, 1.875),
  endSave.duration?.basis ?? "no duration");
const startSave = glare("The target has the Paralyzed condition. The target repeats the saving throw at the start of each of its turns, ending the effect on itself on a success.");
ok("BR075: the save comes first — 0.5 + 0.25 + 0.125 + 0.0625", startSave.duration?.reader === "BR075" && near(startSave.duration.expectedTurns, 0.9375),
  startSave.duration?.basis ?? "no duration");
ok("...and a save-ends state needs no other duration (r35)", endSave.needsInput.length === 0 && startSave.needsInput.length === 0);
ok("  (mutation) with no party there is nothing to price it against", glare("The target has the Paralyzed condition. At the end of each of its turns, the target repeats the saving throw.", false).duration === undefined);

// ── 5. wired ────────────────────────────────────────────────────────────────────────────────────
console.log("\n5. every price reaches a surface");
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");
ok("the checker applies the hold to its round loop", /concentrationHold\(c\.conSave/.test(read("src/core/encounter-band/checkerV2.ts")) && /encounterDprAt\(prepared, cumulativePartyDamage, round, activeShare\)/.test(read("src/core/encounter-band/checkerV2.ts")));
ok("the estimator prices save-ends against its reference party", /composeReaders\(template, \{/.test(read("src/core/encounter-band/CreatureEstimatorPanel.tsx")));

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
