/**
 * WHAT ONE CREATURE DOES TO THE OTHERS IS PRICED AFTER THE ROSTER IS ASSEMBLED — AS THE WORKBOOK DOES.
 *   npx tsx scripts/check-roster-interactions.ts
 *
 * Christopher, 2026-09-13: *"why can we price aoe spells that do damage but not aoe spells that buff
 * and hinder."* The v4 Roster Interaction workbook's Act3 Roster Interactions sheet is the authority.
 * Its burden cells are TYPED values; this gate rebuilds the Last Court from the workbook's own packets
 * (Act3 Enemy Offense) and requires the app's pass to reproduce all four of them.
 *
 * Each assertion is paired with the same roster minus the authored interaction, which must lose it.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BROKEN_CHAIN_MONSTER_LIBRARY as L } from "../src/data/broken-chain/monsterLibrary";
import { rosterInteractions, rankedCoverage, ZONE_COVERAGE, type InteractionEntry } from "../src/core/encounter-band/rosterInteractions";
import { rosterFromTemplates } from "../src/core/encounter-band/rosterFromLibrary";
import { simulateEncounter, resolvePartyProfile, prepareRoster, damageIntoGroup } from "../src/core/encounter-band/checkerV2";
import { partyDefenceAt } from "../src/core/encounter-band/partyDefenceCurve";
import type { MainMonsterTemplate } from "../src/core/monsters/runtime/mainMonsterRuntime";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;
const party0 = () => resolvePartyProfile({ level: 8, size: 4, equipmentMode: "brokenChain" });
const byName = (n: string) => L.find(t => t.name === n) as MainMonsterTemplate;
const withLists = (t: MainMonsterTemplate, lists: Record<string, unknown[]>, attacksPerTurn?: number) =>
  ({ ...t, traits: [], reactions: [], ...lists, lair: undefined,
    stats: { ...t.stats, defenses: [], ...(attacksPerTurn ? { attacksPerTurn } : {}) } }) as unknown as MainMonsterTemplate;

console.log("Roster interactions are priced after the roster is assembled\n");

// ── 1. the workbook's Last Court, from its own packets ─────────────────────────────────────────
console.log("1. Winter's Toll + Cruel Instruction reproduce the workbook's burden cells");
const zone = { kind: "roll_modifier_zone", allyAttack: 3, allySave: 3, hostileAttack: -3, hostileSave: -3, durationRounds: 2 };
const harrowOf = (withZone = true, cruel: Record<string, unknown> = { kind: "ally_extra_attack", requiresZone: "Winter's Toll" }) =>
  withLists(byName("Gloam Harrow"), { actions: [
    { name: "Winter Needle", kind: "attack", roll: "1d20+8", damage: "10" },
    { name: "Winter’s Toll", kind: "action", ...(withZone ? { rosterInteraction: zone } : {}) },
    { name: "Cruel Instruction", kind: "action", economyCost: "bonus", rosterInteraction: cruel },
  ] }, 1);
const reeve = withLists(byName("Blackbough Reeve"), { actions: [{ name: "Shearing Cut", kind: "attack", roll: "1d20+9", damage: "14" }] }, 2);
const brandwing = withLists(byName("Brandwing"), { actions: [{ name: "Ember Lance", kind: "attack", roll: "1d20+9", damage: "16",
  riders: [{ name: "Closing Stroke", damage: "4.5", cadence: "once-per-turn" }] }] }, 2);
const court = (harrow: MainMonsterTemplate): InteractionEntry[] => [
  { id: "reeve", name: "Blackbough Reeve", template: reeve, quantity: 1 },
  { id: "harrow", name: "Gloam Harrow", template: harrow, quantity: 1 },
  { id: "brandwing", name: "Brandwing", template: brandwing, quantity: 1 },
];
/** The workbook prices each PC's defence and takes the mean — so does this. */
/**
 * ⚠ ON THE WORKBOOK'S OWN COVERAGE. Its cells were priced with the half-roster convention, so that is
 * what reproduces them; it proves the formula. The campaign prices with Christopher's placement —
 * section 1b.
 */
const meanBurden = (acs: number[], harrow = harrowOf()) => {
  const per = acs.map(ac => rosterInteractions(court(harrow), { ac, saveBonus: 4, partySize: 4 }, { coverage: "half-roster" }).burdens[0]?.burden ?? [0, 0, 0, 0]);
  return [0, 1].map(i => per.reduce((s, b) => s + b[i], 0) / per.length);
};
const wotc = meanBurden([18, 15, 13, 15]);
const bc = meanBurden([18, 15, 13, 16]);
ok("WOTC round 1 = 13.500234375", near(wotc[0], 13.500234375), wotc[0].toFixed(9));
ok("WOTC round 2+ = 16.937734375", near(wotc[1], 16.937734375), wotc[1].toFixed(9));
ok("BC round 1 = 13.437890625", near(bc[0], 13.437890625), bc[0].toFixed(9));
ok("BC round 2+ = 16.812890625", near(bc[1], 16.812890625), bc[1].toFixed(9));
const noZone = meanBurden([18, 15, 13, 15], harrowOf(false, { kind: "ally_extra_attack" }));
ok("  (mutation) without the zone there is no +3 and no Action given up", noZone[1] > 0 && !near(noZone[1], wotc[1]), `${noZone[1].toFixed(3)} (extra attack only)`);
const typo = rosterInteractions(court(harrowOf(true, { kind: "ally_extra_attack", requiresZone: "Winter's Tol" })), { ac: 15, saveBonus: 4 });
ok("an extra attack naming a zone that does not exist is reported", typo.assumptions.some(a => a.flag === "NEEDS DM INPUT" && /no zone action/.test(a.detail)));
ok("a creature priced alone gets no roster row", rosterInteractions([court(harrowOf())[1]], { ac: 15, saveBonus: 4 }).rows.length === 0);

// ── 1b. Christopher's placement ────────────────────────────────────────────────────────────────
console.log("\n1b. the placement: centred on the best ally, the party caught less and less");
const allyW = rankedCoverage(ZONE_COVERAGE.allies, 3);
const partyW = rankedCoverage(ZONE_COVERAGE.party, 4);
ok("allies: 100%, then 30%, then lower", near(allyW[0], 1) && near(allyW[1], 0.3) && allyW[2] < allyW[1], allyW.map(w => w.toFixed(3)).join(", "));
ok("the party: 75%, then 1/3, then lower and lower", near(partyW[0], 0.75) && near(partyW[1], 1 / 3) && partyW[2] < partyW[1] && partyW[3] < partyW[2],
  partyW.map(w => w.toFixed(3)).join(", "));
{
  const t = { ac: 15, saveBonus: 4, partySize: 4 };
  const placed = rosterInteractions(court(harrowOf()), t).burdens[0];
  const half = rosterInteractions(court(harrowOf()), t, { coverage: "half-roster" }).burdens[0];
  // At AC 15 both hit on 75%, 90% with +3. Brandwing gains more: 2×16×0.15 plus its once-per-turn
  // 4.5 moving from P(≥1 of 2) = 1 − 0.25² to 1 − 0.10²; the Reeve 2×14×0.15.
  const reeveGain = 2 * 14 * 0.15;
  const brandGain = 2 * 16 * 0.15 + 4.5 * ((1 - 0.1 * 0.1) - (1 - 0.25 * 0.25));
  ok("the zone's offence is 100% of the best ally's gain + 30% of the other's",
    near(placed.allyGain[1], brandGain + 0.3 * reeveGain, 1e-9), `${placed.allyGain[1].toFixed(4)} vs ${(brandGain + 0.3 * reeveGain).toFixed(4)}`);
  ok("  (mutation) the half-roster split prices it differently", !near(placed.allyGain[1], half.allyGain[1], 1e-6), `half-roster ${half.allyGain[1].toFixed(4)}`);
  ok("the party inside is 0.75 + 1/3 + … of 4", near(placed.pcsInside, partyW.reduce((s, w) => s + w, 0)), placed.pcsInside.toFixed(4));
  ok("with no chosen party the −3 on its attacks is not guessed", placed.partyDamageFactor === undefined);
  const withParty = rosterInteractions(court(harrowOf()), { ...t, hitChance: 0.65 }).burdens[0];
  const share = placed.pcsInside / 4;
  ok("with a chosen party at 65%, it deals share × (1 − 50/65) less", near(withParty.partyDamageFactor ?? 1, 1 - share * (1 - 0.5 / 0.65), 1e-9),
    `×${withParty.partyDamageFactor?.toFixed(4)}`);
}

// ── 2. the published creatures, through the real roster build ──────────────────────────────────
console.log("\n2. the Last Court and the Occupied Acre, as published");
const d = partyDefenceAt(8, "brokenChain");
const target = { ac: d.ac, partySize: 4, saveBonus: (d.str + d.dex + d.con + d.int + d.wis + d.cha) / 6,
  saves: { str: d.str, dex: d.dex, con: d.con, int: d.int, wis: d.wis, cha: d.cha } };
const build = (names: string[], patch?: (t: MainMonsterTemplate) => MainMonsterTemplate) =>
  rosterFromTemplates(names.map(n => ({ template: patch ? patch(byName(n)) : byName(n), quantity: 1 })), 8, target as never);
const f7 = build(["Blackbough Reeve", "Gloam Harrow", "Brandwing"]);
const tollRow = f7.roster.find(g => g.id === "broken-chain:act3:gloam-harrow:v1:roster");
ok("the Harrow's zone is a roster row that ends with the Harrow",
  !!tollRow && tollRow.bodiless === true && tollRow.endsWithGroupId === "broken-chain:act3:gloam-harrow:v1" && Number(tollRow.dpr.round2) > 0,
  tollRow ? `${tollRow.name}: R1 ${Number(tollRow.dpr.round1).toFixed(1)}, R2+ ${Number(tollRow.dpr.round2).toFixed(1)}` : "missing");
/**
 * The mutation removes the interaction in BOTH places it can come from — the box and the sentence.
 * Since 0.8.52.0 the rules text is read when the box is empty (`mechanicText.ts`), so stripping the
 * box alone leaves the price exactly where it was; that is `check:mechanictext`'s strip test.
 */
const stripped = (t: MainMonsterTemplate) => ({ ...t,
  actions: (t.actions ?? []).map(a => ({ ...a, rosterInteraction: undefined, text: a.rosterInteraction ? "" : a.text })),
  reactions: (t.reactions ?? []).map(a => ({ ...a, rosterInteraction: undefined, text: a.rosterInteraction ? "" : a.text })) }) as MainMonsterTemplate;
ok("  (mutation) without the authored interaction there is no row",
  !build(["Blackbough Reeve", "Gloam Harrow", "Brandwing"], stripped).roster.some(g => String(g.id).endsWith(":roster")));
ok("with no chosen party, the −3 on the party's attacks is named, not dropped",
  f7.assumptions.some(a => /Not priced: .*party's attacks needs a chosen party's hit chance/.test(a.detail)));
const f7Party = rosterFromTemplates(["Blackbough Reeve", "Gloam Harrow", "Brandwing"].map(n => ({ template: byName(n), quantity: 1 })), 8, { ...target, hitChance: 0.65 } as never);
const f7PartyRow = f7Party.roster.find(g => g.id === "broken-chain:act3:gloam-harrow:v1:roster") as { partyDamageFactor?: number } | undefined;
ok("with a chosen party, the Toll row carries the party's lost damage", (f7PartyRow?.partyDamageFactor ?? 1) < 1, `×${f7PartyRow?.partyDamageFactor?.toFixed(3)}`);
{
  const res = simulateEncounter({ party: { size: 4, sustain: party0().sustain, dpr: party0().dpr }, roster: f7Party.roster }) as unknown as { rounds: { round: number; partyDamage: number; partyPotential: number }[] };
  const r1 = res.rounds[0];
  ok("...and the simulation deals that much less while the Harrow stands", r1.partyDamage < r1.partyPotential,
    `R1 ${r1.partyDamage.toFixed(1)} of ${r1.partyPotential.toFixed(1)}`);
}
ok("Cold Counsel is named as a target event", f7.assumptions.some(a => /^Cold Counsel:/.test(a.detail)));

const acre = ["Demonic Reaver", "Breaker", "Demon Knight of Punishment"];
const f8 = build(acre);
const f8Plain = build(acre, stripped);
const knightRow = f8.roster.find(g => g.name === "Demon Knight of Punishment") as { redirectsPartyActionsPerRound?: number } | undefined;
ok("Commanding Presence, as a Reaction, keeps the authored kill order", f8.roster[0]?.name === "Demonic Reaver", f8.roster.map(g => g.name).join(" → "));
ok("...and redirects one party Action a round onto the Knight", knightRow?.redirectsPartyActionsPerRound === 1);
ok("  (mutation) without it nothing is redirected", !(f8Plain.roster.find(g => g.name === "Demon Knight of Punishment") as { redirectsPartyActionsPerRound?: number } | undefined)?.redirectsPartyActionsPerRound);
// The same words written as a passive trait send EVERY Action at the Knight: it leads the kill order.
const asTrait = (t: MainMonsterTemplate) => t.name !== "Demon Knight of Punishment" ? t : ({ ...t,
  reactions: (t.reactions ?? []).filter(a => a.name !== "Commanding Presence"),
  traits: [...(t.traits ?? []), ...(t.reactions ?? []).filter(a => a.name === "Commanding Presence")] }) as MainMonsterTemplate;
const f8Trait = build(acre, asTrait);
ok("a passive forced target leads the kill order instead", f8Trait.roster[0]?.name === "Demon Knight of Punishment", f8Trait.roster.map(g => g.name).join(" → "));
const party = resolvePartyProfile({ level: 8, size: 4, equipmentMode: "brokenChain" });
const damageOf = (roster: typeof f8.roster) => {
  const res = simulateEncounter({ party: { size: 4, sustain: party.sustain, dpr: party.dpr }, roster }) as unknown as { rounds: { cumulativeMonsterDamage: number }[] };
  return res.rounds[res.rounds.length - 1]?.cumulativeMonsterDamage ?? 0;
};
const [plainDmg, reactionDmg, traitDmg] = [damageOf(f8Plain.roster), damageOf(f8.roster), damageOf(f8Trait.roster)];
ok("once a round sits between nothing and every Action", plainDmg < reactionDmg && reactionDmg < traitDmg,
  `none ${plainDmg.toFixed(1)} < reaction ${reactionDmg.toFixed(1)} < passive ${traitDmg.toFixed(1)}`);

// The share arithmetic, on a roster small enough to check by hand: A (100) then K (100), K redirects
// 1 Action of a 4-PC party. After 80 damage K has absorbed 20 and A 60; after 200 both are dead.
{
  const row = (id: string, redirect?: number) => ({ id, name: id, quantity: 1, baseHp: 100, flatHpPerBody: true, dpr: { round1: 1 }, ...(redirect ? { redirectsPartyActionsPerRound: redirect } : {}) });
  const [a, k] = prepareRoster([row("A"), row("K", 1)], 4);
  ok("after 80: the forced target has 20, the one ahead of it 60", near(damageIntoGroup(k, 80), 20) && near(damageIntoGroup(a, 80), 60),
    `K ${damageIntoGroup(k, 80)}, A ${damageIntoGroup(a, 80)}`);
  ok("after 200: both full, nothing lost", near(damageIntoGroup(k, 200), 100) && near(damageIntoGroup(a, 200), 100));
  const [a0] = prepareRoster([row("A"), row("K")], 4);
  ok("  (mutation) without the Reaction the one ahead takes all 80", near(damageIntoGroup(a0, 80), 80));
}
ok("the Knight carries no presence defence row any more",
  !(byName("Demon Knight of Punishment").stats.defenses ?? []).some(x => /Presence/.test(x.name)));

// ── 3. the editor writes it ─────────────────────────────────────────────────────────────────────
console.log("\n3. the editor can author every kind");
const editor = readFileSync(resolve(ROOT, "src/core/monsters/MonsterTemplateEditor.tsx"), "utf8");
ok("an 'Affects other creatures' select writes rosterInteraction", /rosterInteraction: kind === "roll_modifier_zone" \? \{ kind \}/.test(editor));
ok("the zone's modifiers and duration have boxes", ["allyAttack", "allySave", "hostileAttack", "hostileSave", "durationRounds"].every(k => editor.includes(`zoneNum("${k}"`)));
ok("an extra attack or a swap can name the zone it needs", /rosterInteraction: \{ \.\.\.ri, requiresZone:/.test(editor));
ok("the parser carries it", /rosterInteraction: a\.rosterInteraction/.test(readFileSync(resolve(ROOT, "src/core/encounter-band/parseCreature.ts"), "utf8")));

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
