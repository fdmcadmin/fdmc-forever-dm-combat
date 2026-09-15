/**
 * THE UNCHOSEN PARTY PRICES AGAINST THE BALANCED CENTRE LINE — ITS OWN ACTORS, THIS FIGHT'S AC.
 *   npx tsx scripts/check-center-accuracy.ts
 *
 * Christopher, 2026-09-13: *"make sure the checker can price against the unchosen party dpr balanced
 * center line."* The centre curve carried DPR and sustain but no accuracy, so anything priced through the
 * party's hit chance fell back or went unpriced whenever nobody had picked characters.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CENTER_LINE_ACTORS } from "../src/core/encounter-band/centerLineAccuracy.generated";
import { centerLineActors, centerLineHitChance, centerLineAttackShare, centerLineSaveDcs, centerLineMeleeAttackShare } from "../src/core/encounter-band/centerLineAccuracy";
import { BROKEN_CHAIN_MONSTER_LIBRARY as L } from "../src/data/broken-chain/monsterLibrary";
import { rosterFromTemplates } from "../src/core/encounter-band/rosterFromLibrary";
import { partyDefenceAt } from "../src/core/encounter-band/partyDefenceCurve";
import { meanTargetAc } from "../src/core/encounter-band/incomingSaveExposure";
import type { MainMonsterTemplate } from "../src/core/monsters/runtime/mainMonsterRuntime";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};
const code = (p: string) => readFileSync(resolve(ROOT, p), "utf8");

console.log("The unchosen party prices against the balanced centre line\n");

console.log("1. the table is the certified endpoints' actors");
const missing: string[] = [];
for (const size of [3, 4, 5, 6]) for (let level = 1; level <= 16; level++) for (const mode of ["wotcStandard", "brokenChain"]) {
  const row = CENTER_LINE_ACTORS[`${size}P|${level}|${mode}`];
  if (!row || row.endpoints.length !== 4 || row.endpoints.some(e => e.members.length !== size)) missing.push(`${size}P|${level}|${mode}`);
}
ok("every size 3-6, level 1-16 and mode has four endpoints of that many actors", missing.length === 0, missing.slice(0, 5).join(", "));
const bc8 = centerLineActors(8, "brokenChain", 4) ?? [];
const wotc8 = centerLineActors(8, "wotcStandard", 4) ?? [];
const fighterBc = bc8.find(a => a.id === "4P-069-REP::offense_2024::PC3");
const fighterWotc = wotc8.find(a => a.id === "4P-069-REP::offense_2024::PC3");
ok("L8 BC holds the BOS Fighter at +10 (its +2 weapon included)", fighterBc?.attackBonus === 10 && fighterBc?.attackShare === 0.82, JSON.stringify(fighterBc));
ok("  (mutation) the same Fighter in WotC is +8", fighterWotc?.attackBonus === 8);
ok("every actor carries a real bonus and share, and a DC or an honest null",
  Object.values(CENTER_LINE_ACTORS).flatMap(r => r.endpoints.flatMap(e => e.members))
    .every(a => Number.isFinite(a.attackBonus) && (a.spellSaveDc === null || Number.isFinite(a.spellSaveDc)) && a.attackShare >= 0 && a.attackShare <= 1));

console.log("\n2. resolved against the fight, never stored");
const expected = bc8.reduce((s, a) => s + Math.min(0.95, Math.max(0.05, (21 + a.attackBonus - 16) / 20)), 0) / bc8.length;
const got = centerLineHitChance(8, "brokenChain", 4, 16);
ok("hit chance at AC 16 = the mean of each actor's own d20", got !== undefined && Math.abs(got - expected) < 1e-12, `${((got ?? 0) * 100).toFixed(2)}%`);
ok("a lower AC is hit more often", (centerLineHitChance(8, "brokenChain", 4, 13) ?? 0) > (got ?? 1));
ok("Broken Chain gear hits more often than WotC at the same AC", (got ?? 0) > (centerLineHitChance(8, "wotcStandard", 4, 16) ?? 1));
ok("no population run above L16 — absent, not guessed", centerLineHitChance(17, "brokenChain", 4, 16) === undefined);
ok("an attack share and save DCs come with it", (centerLineAttackShare(8, "brokenChain", 4) ?? -1) > 0
  && (centerLineSaveDcs(8, "brokenChain", 4)?.length ?? 0) === bc8.filter(a => a.spellSaveDc !== null).length);
ok("the generated table stores no hit chance", !/hitChance|hit_chance/.test(code("src/core/encounter-band/centerLineAccuracy.generated.ts")));

console.log("\n2b. how much of it lands inside 5 ft — for a target-substitution Reaction");
{
  /**
   * Christopher, 2026-09-15: *"cold counsel should use the 4 parties the balanced center was based line to
   * determine the melee share."* Read from each actor's OWN weapon in the source build (`melee`), divided by
   * the swings its Attack action makes (`attacks`) — one Reaction re-checks one attack.
   */
  const every = Object.values(CENTER_LINE_ACTORS).flatMap(r => r.endpoints.flatMap(e => e.members));
  ok("every actor says whether it swings in reach, and how many swings it gets",
    every.every(a => typeof a.melee === "boolean" && Number.isInteger(a.attacks) && a.attacks >= 1));
  ok("the four parties are a mix — some melee, some not",
    every.some(a => a.melee) && every.some(a => !a.melee),
    `${every.filter(a => a.melee).length} of ${every.length} swing in reach`);
  const byHand = bc8.reduce((s, a) => s + (a.melee ? a.attackShare / Math.max(1, a.attacks) : 0), 0) / bc8.length;
  const read = centerLineMeleeAttackShare(8, "brokenChain", 4);
  ok("one melee swing = the mean of each actor's own share ÷ its swings", read !== undefined && Math.abs(read - byHand) < 1e-12, `${((read ?? 0) * 100).toFixed(2)}% of one actor's round`);
  ok("...it is less than the attack share, because a swing is not a turn and not every actor is melee",
    (read ?? 1) < (centerLineAttackShare(8, "brokenChain", 4) ?? 0));
  /** ⚠ MUTATION: counting whole turns instead of one swing reads high wherever anyone has Extra Attack. */
  const wholeTurns = bc8.reduce((s, a) => s + (a.melee ? a.attackShare : 0), 0) / bc8.length;
  ok("  (mutation) charging the whole turn instead of one swing is a different, larger number", wholeTurns > (read ?? 0));
  ok("no population run above L16 — absent, not guessed", centerLineMeleeAttackShare(17, "brokenChain", 4) === undefined);
  const panelCode = code("src/core/encounter-band/EncounterDifficultyPanel.tsx");
  ok("the fight panel supplies it for the unchosen party, and the chosen party's own for a chosen one",
    panelCode.includes("partyMeleeAttackShare: center ? centerLineMeleeAttackShare(partyLevel, equipmentMode, partySize) : undefined")
    && panelCode.includes("partyMeleeAttackShare: fightInputs.partyMeleeAttackShare ?? currentParty?.delivery.meleeAttackShare"));
  ok("the act run supplies it too",
    code("src/core/encounter-band/ActRunPanel.tsx").includes("partyMeleeAttackShare: centerLineMeleeAttackShare(step.partyLevel, runMode, partySize)"));
}

console.log("\n3. the checker uses it when nobody is chosen");
const panel = code("src/core/encounter-band/EncounterDifficultyPanel.tsx");
ok("the fight panel falls back to the centre line", /chosenHit \?\? centerLineHitChance\(partyLevel, equipmentMode, partySize, targetAC\)/.test(panel));
ok("...and passes its share and DCs into the roster", /partyAttackShare: fightInputs\.partyAttackShare/.test(panel) && /partySaveDcs: fightInputs\.partySaveDcs/.test(panel));
const run = code("src/core/encounter-band/ActRunPanel.tsx");
ok("the act run prices against it too", /hitChance: centerLineHitChance\(step\.partyLevel, runMode, partySize, meanTargetAc\(entries\)\)/.test(run));

const d = partyDefenceAt(8, "brokenChain");
const court = ["Blackbough Reeve", "Gloam Harrow", "Brandwing"].map(n => L.find(t => t.name === n) as MainMonsterTemplate);
const entries = court.map(template => ({ template, quantity: 1 }));
const base = { ac: d.ac, partySize: 4, saveBonus: (d.str + d.dex + d.con + d.int + d.wis + d.cha) / 6,
  saves: { str: d.str, dex: d.dex, con: d.con, int: d.int, wis: d.wis, cha: d.cha } };
const center = {
  ...base,
  hitChance: centerLineHitChance(8, "brokenChain", 4, meanTargetAc(entries)),
  partyAttackShare: centerLineAttackShare(8, "brokenChain", 4),
  partySaveDcs: centerLineSaveDcs(8, "brokenChain", 4),
  partyAccuracySource: "center" as const,
};
const built = rosterFromTemplates(entries, 8, center as never);
const row = built.roster.find(g => String(g.id).endsWith(":roster")) as { partyDamageFactor?: number } | undefined;
const line = built.assumptions.find(a => /Winter.s Toll \+ Cruel Instruction/.test(a.detail))?.detail ?? "";
ok("the Last Court's Toll prices against the unchosen centre party", (row?.partyDamageFactor ?? 1) < 1, `×${row?.partyDamageFactor?.toFixed(3)}`);
ok("...the −3 to its attacks AND the +3 to allies' saves", /balanced centre party/.test(line) && /to hit for/.test(line) && /to allies' saves: −/.test(line), line.slice(0, 220));
const noDcs = rosterFromTemplates(entries, 8, { ...center, partySaveDcs: undefined } as never);
ok("  (mutation) without the centre's DCs the saves side is named, not priced",
  noDcs.assumptions.some(a => /Not priced: .*allies' saves needs the party's save DCs/.test(a.detail)));

console.log("\n4. a passive forced target survives the panels' weakest-first sort");
ok("the fight panel keeps killOrderFirst in front", /Number\(Boolean\(b\.killOrderFirst\)\) - Number\(Boolean\(a\.killOrderFirst\)\)/.test(panel));
ok("the act run keeps killOrderFirst in front", /Number\(Boolean\(b\.killOrderFirst\)\) - Number\(Boolean\(a\.killOrderFirst\)\)/.test(run));
const acre = ["Demonic Reaver", "Breaker", "Demon Knight of Punishment"].map(n => L.find(t => t.name === n) as MainMonsterTemplate)
  .map(t => t.name !== "Demon Knight of Punishment" ? t : ({ ...t,
    reactions: (t.reactions ?? []).filter(a => a.name !== "Commanding Presence"),
    traits: [...(t.traits ?? []), ...(t.reactions ?? []).filter(a => a.name === "Commanding Presence")] }) as MainMonsterTemplate);
const passive = rosterFromTemplates(acre.map(template => ({ template, quantity: 1 })), 8, base as never);
const knight = passive.roster.find(g => g.name === "Demon Knight of Punishment") as { killOrderFirst?: boolean } | undefined;
ok("the roster stamps a passive forced target killOrderFirst", knight?.killOrderFirst === true);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
