/**
 * A CREATURE PRICES FROM ITS STAT BLOCK — NOBODY HAS TO TICK A BOX FIRST.
 *   npx tsx scripts/check-mechanic-text.ts
 *
 * Christopher, 2026-09-13: *"if i have to go in and check 10 different boxes to test a encounter then
 * how does this help others when they build their own creatures."* The pricing routes (attackWith,
 * grantsAdvantage, mark riders) and the roster interactions were fields only. `mechanicText.ts` reads
 * the rules sentence when the field is empty; the field stays as the override.
 *
 * The proof that matters is the strip test: take every box that was ticked on the Act 3 creatures
 * away, and the price must not move by a cent.
 *
 * ⚠ NOT A SNAPSHOT OF EVERY READ IN THE LIBRARY. Authored content folds through CI and a publish must
 * never fail because a DM wrote a new sentence the reader recognises. The reads below are required to
 * be PRESENT; the negatives are required to stay absent.
 */
import { BROKEN_CHAIN_MONSTER_LIBRARY as L } from "../src/data/broken-chain/monsterLibrary";
import { readRosterInteraction, readAttackWith, readGrantsAdvantage, readMarkRiders } from "../src/core/encounter-band/mechanicText";
import { parseCreature } from "../src/core/encounter-band/parseCreature";
import { traceCreature } from "../src/core/encounter-band/actionTrace";
import { rosterFromTemplates } from "../src/core/encounter-band/rosterFromLibrary";
import { partyDefenceAt } from "../src/core/encounter-band/partyDefenceCurve";
import type { MainMonsterTemplate } from "../src/core/monsters/runtime/mainMonsterRuntime";

let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};
type Row = { name: string; text?: string; damage?: string; [k: string]: unknown };
const by = (n: string) => L.find(t => t.name === n) as MainMonsterTemplate;
const rowOf = (creature: string, action: string): Row => {
  const t = by(creature) as unknown as Record<string, Row[] | undefined>;
  return [...(t.traits ?? []), ...(t.actions ?? []), ...(t.reactions ?? [])].find(a => a.name === action) as Row;
};

console.log("A creature prices from its stat block\n");

console.log("1. the readers, on the sentences the Act 3 creatures print");
const toll = readRosterInteraction(rowOf("Gloam Harrow", "Winter’s Toll").text);
ok("Winter's Toll → a +3/+3/−3/−3 zone lasting 2 turns",
  JSON.stringify(toll?.value) === JSON.stringify({ kind: "roll_modifier_zone", allyAttack: 3, allySave: 3, hostileAttack: -3, hostileSave: -3, durationRounds: 2 }),
  JSON.stringify(toll?.value));
ok("Cruel Instruction → an ally's extra attack inside Winter's Toll",
  JSON.stringify(readRosterInteraction(rowOf("Gloam Harrow", "Cruel Instruction").text, ["Winter’s Toll"])?.value) === JSON.stringify({ kind: "ally_extra_attack", requiresZone: "Winter’s Toll" }));
ok("Cold Counsel → a target substitution inside Winter's Toll",
  readRosterInteraction(rowOf("Gloam Harrow", "Cold Counsel").text, ["Winter’s Toll"])?.value.kind === "target_substitution");
ok("Commanding Presence → a forced target", readRosterInteraction(rowOf("Demon Knight of Punishment", "Commanding Presence").text)?.value.kind === "forced_target_order");
ok("Final Pruning → makes one Shearing Cut", readAttackWith(rowOf("Blackbough Reeve", "Final Pruning").text, ["Shearing Cut", "Spoiling Cut", "Final Pruning"], "Final Pruning")?.value === "Shearing Cut");
ok("Reckless Sentence → Advantage on its own attacks", readGrantsAdvantage(rowOf("Demon Knight of Punishment", "Reckless Sentence").text)?.value === "own-attacks");
const rider = readMarkRiders(rowOf("Brandwing", "Closing Stroke").text, "Closing Stroke")?.value[0];
ok("Closing Stroke → a once-per-turn 2d6 Psychic rider", rider?.damage === "2d6" && rider?.damageType === "Psychic" && rider?.cadence === "once-per-turn", JSON.stringify(rider));

console.log("\n2. and what they must NOT read");
ok("'attack rolls against it have Advantage' is not Advantage on its own attacks", !readGrantsAdvantage("Attack rolls against the Knight have Advantage until the start of its next turn."));
ok("'advantage on attack rolls against a prone target' is not a self-grant", !readGrantsAdvantage("The wolf has advantage on attack rolls against a prone creature."));
ok("'makes one attack' names no action", !readAttackWith("It moves and makes one attack.", ["Claw"], "Leap"));
ok("an attack's name inside another word is not a match", !readAttackWith("It makes one Clawing Rush attack.", ["Claw"], "Rush"));
ok("a +3 bonus to damage is not a roll zone", !readRosterInteraction("Allies in the area gain a +3 bonus to damage rolls."));
ok("Calculated Angle (cover) reads as none of these", !readRosterInteraction(rowOf("Brandwing", "Calculated Angle").text) && !readGrantsAdvantage(rowOf("Brandwing", "Calculated Angle").text));

console.log("\n3. strip every ticked box — the price must not move");
const d = partyDefenceAt(8, "brokenChain");
const target = { ac: d.ac, partySize: 4, saveBonus: (d.str + d.dex + d.con + d.int + d.wis + d.cha) / 6,
  saves: { str: d.str, dex: d.dex, con: d.con, int: d.int, wis: d.wis, cha: d.cha } };
const strip = (t: MainMonsterTemplate) => {
  const clean = (list: Row[] = []) => list.map(({ attackWith, grantsAdvantage, rosterInteraction, triggerChance, ...rest }) => {
    void attackWith; void grantsAdvantage; void rosterInteraction; void triggerChance;
    if (rest.name !== "Closing Stroke") return rest;
    const { riders, ...noRiders } = rest; void riders; return noRiders;
  });
  const any = t as unknown as Record<string, Row[] | undefined>;
  return { ...t, actions: clean(any.actions), reactions: clean(any.reactions), traits: clean(any.traits) } as unknown as MainMonsterTemplate;
};
for (const n of ["Brandwing", "Blackbough Reeve", "Demon Knight of Punishment", "Gloam Harrow"]) {
  const a = traceCreature(parseCreature(by(n)), target, 4).averagePerRound;
  const b = traceCreature(parseCreature(strip(by(n))), target, 4).averagePerRound;
  ok(`${n} prices the same from its text alone`, Math.abs(a - b) < 1e-9, `${a.toFixed(3)} vs ${b.toFixed(3)}`);
}
const roster = (names: string[], s: boolean) =>
  rosterFromTemplates(names.map(n => ({ template: s ? strip(by(n)) : by(n), quantity: 1 })), 8, target as never);
const court = ["Blackbough Reeve", "Gloam Harrow", "Brandwing"];
const tollRow = (s: boolean) => roster(court, s).roster.find(g => String(g.id).endsWith(":roster"));
ok("the Last Court's Winter's Toll row is identical from text alone",
  !!tollRow(true) && JSON.stringify(tollRow(true)?.dpr) === JSON.stringify(tollRow(false)?.dpr), JSON.stringify(tollRow(true)?.dpr));
const knight = roster(["Demonic Reaver", "Breaker", "Demon Knight of Punishment"], true).roster
  .find(g => g.name === "Demon Knight of Punishment") as { redirectsPartyActionsPerRound?: number } | undefined;
ok("the Occupied Acre's Commanding Presence still redirects one Action a round", knight?.redirectsPartyActionsPerRound === 1);

console.log("\n4. the mutations — change the sentence and the read goes");
const reworded = (t: MainMonsterTemplate, action: string, from: RegExp, to: string) => {
  const any = t as unknown as Record<string, Row[] | undefined>;
  const edit = (list: Row[] = []) => list.map(a => a.name === action ? { ...a, text: String(a.text).replace(from, to) } : a);
  return { ...t, actions: edit(any.actions), reactions: edit(any.reactions), traits: edit(any.traits) } as unknown as MainMonsterTemplate;
};
const reeveNoName = strip(reworded(by("Blackbough Reeve"), "Final Pruning", /makes one Shearing Cut attack/, "makes one attack"));
ok("'makes one attack' leaves Final Pruning unpriced",
  traceCreature(parseCreature(reeveNoName), target, 4).averagePerRound < traceCreature(parseCreature(strip(by("Blackbough Reeve"))), target, 4).averagePerRound);
const harrowNoBonus = strip(reworded(reworded(by("Gloam Harrow"), "Winter’s Toll", /gain a \+3 bonus to attack rolls and saving throws/, "feel the cold"), "Winter’s Toll", /(take|have) a −3 penalty to attack rolls and saving throws/, "shiver"));
ok("without the +3 / −3 sentences there is no zone row",
  !rosterFromTemplates(court.map(n => ({ template: n === "Gloam Harrow" ? harrowNoBonus : strip(by(n)), quantity: 1 })), 8, target as never)
    .roster.some(g => String(g.id).endsWith(":roster") && /Toll/.test(String(g.name))));

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
