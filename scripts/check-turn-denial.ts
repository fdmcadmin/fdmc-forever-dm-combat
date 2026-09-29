/**
 * A PC'S LOST TURN IS CHARGED — AS THAT PC'S SHARE, AND IT COUNTS WHEN THE CREATURE CHOOSES.
 *   npx tsx scripts/check-turn-denial.ts
 *
 * Christopher, 2026-09-13: *"it should be charged on PC loses of turn not party loss of turn"* — and, asked
 * how a creature picks between a damage attack and a controlling one: *"Control counts"*; and asked about
 * disadvantage conditions: *"Whole turns only."*
 *
 *   1. the per-use arithmetic and the printed duration (`turnDenial.ts`)
 *   2. the trace chooses by damage + PC turns, and schedules damage only (`actionTrace.ts`)
 *   3. the simulation takes 1 ÷ party size per lost turn, in the round it falls (`checkerV2.ts`)
 *   4. the campaign creatures, through the real roster build
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { turnDenialFor, type TurnDenial } from "../src/core/encounter-band/turnDenial";
import { parseCreature, type ParsedCreature } from "../src/core/encounter-band/parseCreature";
import { traceCreature } from "../src/core/encounter-band/actionTrace";
import { simulateEncounter, type RosterGroup } from "../src/core/encounter-band/checkerV2";
import { rosterFromTemplates, pcTurnValueAt } from "../src/core/encounter-band/rosterFromLibrary";
import { partyDefenceAt } from "../src/core/encounter-band/partyDefenceCurve";
import { BROKEN_CHAIN_MONSTER_LIBRARY as L } from "../src/data/broken-chain/monsterLibrary";
import type { MainMonsterTemplate } from "../src/core/monsters/runtime/mainMonsterRuntime";
import type { ParsedFeature } from "../src/core/encounter-band/featureResolver";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps;
const priced = (x: ReturnType<typeof turnDenialFor>): x is TurnDenial => !!x && "perTarget" in x;

console.log("A PC's lost turn\n");

// ── 1. what one use takes ──────────────────────────────────────────────────────────────────────
console.log("1. per use: who it lands on, and for how many of their turns");
const T = { ac: 16, saveBonus: 3, saves: { str: 3, dex: 3, con: 3, int: 3, wis: 3, cha: 3 } };
const feat = (f: Partial<ParsedFeature>) => ({ name: "Test", activationType: "action", conditions: [], isArea: false, replacesRoutineSlot: false, ...f }) as ParsedFeature;
{
  // +5 against AC 16: 50% hit. DC 10 against +3: 30% fail. Until the end of its next turn: one turn.
  const claws = turnDenialFor(feat({ attackBonus: 5, saveDc: 10, saveAbility: "con", text: "The target must make the Constitution save or be paralyzed until end of its next turn." }), T);
  ok("hit, then fail, then one turn: 50% × 30% × 1", priced(claws) && near(claws.perTarget, 0.15) && claws.turns.length === 1 && near(claws.expectedTurns, 1),
    priced(claws) ? claws.basis : JSON.stringify(claws));
  const early = turnDenialFor(feat({ saveDc: 14, saveAbility: "wis", text: "On a failure the target is Incapacitated until the start of the target's next turn." }), T);
  ok("until the start of the TARGET's next turn takes no turn — it ends before the PC acts", priced(early) && early.expectedTurns === 0);
  const stun = turnDenialFor(feat({ saveDc: 15, saveAbility: "con", text: "On a failed save the target has the Stunned condition for 1 minute. At the end of each of its turns, the target repeats the saving throw, ending the effect on itself on a success." }), T);
  // DC 15 against +3 fails 55%: 1 + 0.55 + 0.55² + … over ten turns.
  const tenTurns = Array.from({ length: 10 }, (_, k) => Math.pow(0.55, k)).reduce((s, p) => s + p, 0);
  ok("a minute with a repeat save stands through each failed save", priced(stun) && near(stun.perTarget, 0.55) && near(stun.expectedTurns, tenTurns),
    priced(stun) ? `${stun.expectedTurns.toFixed(3)} turns` : JSON.stringify(stun));
  const lasting = turnDenialFor(feat({ saveDc: 15, saveAbility: "con", text: "On a failure the target is paralyzed." }), T);
  ok("no printed duration is not charged — it is named (r35)", !!lasting && !priced(lasting) && /r35/.test(lasting.reason), lasting && !priced(lasting) ? lasting.reason : "");
  const nobody = turnDenialFor(feat({ text: "You have the Incapacitated condition until the end of your next turn." }), T);
  ok("no attack roll or save decides who — not charged, and named", !!nobody && !priced(nobody), nobody && !priced(nobody) ? nobody.reason : "");
  const ending = turnDenialFor(feat({ saveDc: 16, saveAbility: "dex", conditions: ["incapacitated"],
    text: "Failure: the creature is Pinned until the start of its next turn. The Pinned condition ends early if the Ravager moves or has the Incapacitated condition." }), T);
  ok("a condition named only in how the effect ENDS takes no one's turn", ending === undefined);
  const prone = turnDenialFor(feat({ saveDc: 15, saveAbility: "dex", text: "On a failure the target falls prone until the end of its next turn." }), T);
  ok("whole turns only: prone (disadvantage) is not a lost turn", prone === undefined);
}

// ── 2. the choice ──────────────────────────────────────────────────────────────────────────────
console.log("\n2. the creature chooses by damage + PC turns, and schedules damage only");
const byName = (n: string) => L.find(t => t.name === n) as MainMonsterTemplate;
const d7 = partyDefenceAt(7, "brokenChain");
const target7 = { ac: d7.ac, partySize: 4, saveBonus: (d7.str + d7.dex + d7.con + d7.int + d7.wis + d7.cha) / 6,
  saves: { str: d7.str, dex: d7.dex, con: d7.con, int: d7.int, wis: d7.wis, cha: d7.cha } };
const turn7 = pcTurnValueAt(7, 4, "brokenChain");
ok("one PC's turn at L7 is the party's round ÷ 4", !!turn7 && turn7.round2 > 0, turn7 ? turn7.round2.toFixed(1) : "none");
const mourner = byName("Hollow Mourner");
const picked = (withTurn: boolean) => traceCreature(parseCreature(mourner), { ...target7, ...(withTurn && turn7 ? { pcTurnValue: turn7 } : {}) }, 4).rounds[1].scheduled;
{
  const plain = picked(false);
  const weighed = picked(true);
  const claws = weighed.find(s => s.feature === "Claws");
  ok("without a party to value a turn, the Hollow Mourner Bites — as before", plain.some(s => s.feature === "Bite") && !plain.some(s => s.feature === "Claws"),
    plain.map(s => `${s.feature} ${s.expectedDamage.toFixed(1)}`).join(", "));
  ok("valuing a PC's turn, it uses Claws: 4.8 damage + a paralyzed PC's turn beats 5.8", !!claws, weighed.map(s => `${s.feature} ${s.expectedDamage.toFixed(1)}`).join(", "));
  ok("...its scheduled damage is Claws' damage alone", !!claws && claws.expectedDamage < 5.8 && claws.expectedDamage > 4, claws?.expectedDamage.toFixed(2));
  ok("...and it carries the PC turns it takes", !!claws?.pcTurnsDenied && claws.pcTurnsDenied.pcs > 0.1 && claws.pcTurnsDenied.pcs < 0.2 && claws.pcTurnsDenied.turns.length === 1,
    claws?.pcTurnsDenied?.basis ?? "none");
}

// ── 3. the clock ───────────────────────────────────────────────────────────────────────────────
console.log("\n3. a lost turn takes that PC's share of the party's round, in the round it falls");
const all = (v: number) => ({ round1: v, round2: v, round3: v, round4Plus: v });
const party = { size: 4, sustain: 100000, dpr: all(40) };
type Round = { partyDamage: number; pcTurnsLost?: number };
const run = (roster: RosterGroup[]) => (simulateEncounter({ party, roster }) as unknown as { rounds: Round[] }).rounds;
const deny = (pcs: number) => ({ round1: [{ pcs, turns: [1] }], round2: [{ pcs, turns: [1] }], round3: [{ pcs, turns: [1] }], round4Plus: [{ pcs, turns: [1] }] });
const body = (id: string, hp: number, denials?: ReturnType<typeof deny>): RosterGroup =>
  ({ id, name: id, quantity: 1, baseHp: hp, flatHpPerBody: true, dpr: all(5), ...(denials ? { pcTurnDenials: denials } : {}) });
{
  // No initiative stated: half the time the creature acts first, so half its caught PC loses this round's turn.
  const rs = run([body("C", 1000, deny(1))]);
  ok("round 1: half a PC's turn (the creature acts first half the time) → 40 × (1 − 0.5/4) = 35",
    near(rs[0].pcTurnsLost ?? 0, 0.5) && near(rs[0].partyDamage, 35), `${rs[0].pcTurnsLost} lost, ${rs[0].partyDamage.toFixed(2)} dealt`);
  ok("round 2: the rest of round 1's, plus half of round 2's — one PC's turn → 30", near(rs[1].pcTurnsLost ?? 0, 1) && near(rs[1].partyDamage, 30),
    `${rs[1].pcTurnsLost} lost, ${rs[1].partyDamage.toFixed(2)} dealt`);
  const none = run([body("C", 1000)]);
  ok("  (mutation) without the denial the party deals its whole round", near(none[1].partyDamage, 40) && none[1].pcTurnsLost === undefined);
  const flood = run([body("C", 1000, deny(10))]);
  ok("never more than the whole party", flood.every(r => r.partyDamage >= 0 && (r.pcTurnsLost ?? 0) <= 4), flood.slice(0, 3).map(r => r.partyDamage.toFixed(1)).join(", "));
  // A body the party kills in round 1 queues nothing afterwards; only round 1's second half arrives.
  const dies = run([body("C", 20, deny(1)), body("T", 100000)]);
  ok("a dead creature takes no more turns: round 2 carries only round 1's remainder, round 3 none",
    near(dies[1].pcTurnsLost ?? 0, 0.5) && dies[2].pcTurnsLost === undefined && near(dies[2].partyDamage, 40),
    dies.slice(0, 3).map(r => `${(r.pcTurnsLost ?? 0).toFixed(2)}`).join(", "));
}

// ── 4. the campaign ────────────────────────────────────────────────────────────────────────────
console.log("\n4. the published creatures");
const built = (t: MainMonsterTemplate) => rosterFromTemplates([{ template: t, quantity: 1 }], 7, target7 as never);
{
  const b = built(mourner);
  const row = b.roster.find(g => g.name === "Hollow Mourner");
  ok("the Hollow Mourner's row carries the PC turns its Claws take, every round", !!row?.pcTurnDenials?.round1?.length && !!row?.pcTurnDenials?.round4Plus?.length,
    JSON.stringify(row?.pcTurnDenials?.round2));
  ok("...and the roster says so, as a lost PC turn and not as damage", b.assumptions.some(a => /^Claws: paralyzed/.test(a.detail) && /lost turns/.test(a.detail)));
  const noParalysis = { ...mourner, actions: (mourner.actions ?? []).map(a => a.name === "Claws" ? { ...a, text: "Non-undead target must make the Constitution save." } : a) } as MainMonsterTemplate;
  ok("  (mutation) Claws without the paralysis takes no turns, and the Mourner Bites again",
    !built(noParalysis).roster.find(g => g.name === "Hollow Mourner")?.pcTurnDenials);
  const ravager = built(byName("Stormscar Ravager"));
  ok("the Stormscar Ravager's Pin takes no PC's turn (Incapacitated is only how it ends)",
    !ravager.roster.find(g => g.name === "Stormscar Ravager")?.pcTurnDenials
      && !ravager.assumptions.some(a => /Intercepting Leap.*incapacitated/i.test(a.detail)));
}

// ── 5. wired ────────────────────────────────────────────────────────────────────────────────────
console.log("\n5. the panels value a PC's turn from the party they simulate");
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");
/**
 * ⚠ THE CHOSEN PARTY'S OWN TURN, WHEN IT HAS BEEN READ. 0.8.57.0: *"A chosen party's own actors are not
 * read for it yet."* The simulation already charged a lost turn against the read party's round, but the
 * creature WEIGHED its choice against the curve's — two parties for one decision. The read party's per-PC
 * round now wins, and the curve stands only when there is no read offence.
 */
{
  const panel = read("src/core/encounter-band/EncounterDifficultyPanel.tsx");
  ok("the fight panel values a turn from the READ party first, the curve only as fallback",
    /pcTurnValue: readPcTurnValue \?\? pcTurnValueAt\(/.test(panel));
  ok("...where the read turn is the read party's round ÷ its size, memoised",
    /const readPcTurnValue = useMemo\(\(\) => \(currentParty && currentParty\.round1Dpr > 0/.test(panel)
      && /round2: currentParty\.round2Dpr \/ Math\.max\(1, partySize\)/.test(panel));
  ok("...and the read party is computed BEFORE the roster that needs it",
    panel.indexOf("const currentParty = useMemo") > 0 && panel.indexOf("const currentParty = useMemo") < panel.indexOf("const roster = useMemo"));
}
ok("the act run passes its run's (it simulates on the curve, so the curve is its party)", /pcTurnValue: pcTurnValueAt\(/.test(read("src/core/encounter-band/ActRunPanel.tsx")));

// ── 6. an area catches as many PCs for control as for damage ────────────────────────────────────
console.log("\n6. an area control effect counts the same PCs its damage does");
{
  /**
   * 0.8.57.0: *"An area counts its printed targets, else one — the area-target share used for damage is
   * not exported to the trace."* The same breath that burned two PCs stunned one.
   */
  const cone = (isArea: boolean): ParsedCreature => ({
    name: "Coner", ac: 14, maxHp: 80, attacksPerTurn: 1, assumptions: [],
    features: [{
      name: "Stun Cone", activationType: "action", damage: "4d6", saveDc: 15, saveAbility: "con", isArea,
      recharge: "5-6", text: "Each creature in a 15-foot cone makes a Constitution saving throw. On a failure it takes 14 (4d6) damage and is Stunned until the end of its next turn.",
    }],
  } as unknown as ParsedCreature);
  const use = (isArea: boolean, size: number) => traceCreature(cone(isArea), { ...target7, partySize: size, ...(turn7 ? { pcTurnValue: turn7 } : {}) }, 1)
    .rounds[0].scheduled.find(s => s.feature === "Stun Cone");
  const four = use(true, 4), six = use(true, 6), single = use(false, 4);
  ok("an area with no printed count catches half the party for its STUN, as it does for its damage",
    !!four?.pcTurnsDenied && !!single?.pcTurnsDenied && near(four.pcTurnsDenied.pcs / single.pcTurnsDenied.pcs, 2),
    `${four?.pcTurnsDenied?.pcs.toFixed(3)} vs ${single?.pcTurnsDenied?.pcs.toFixed(3)} (targets ${four?.targets})`);
  ok("...and scales with the party — three of six", !!six?.pcTurnsDenied && six.targets === 3, `targets ${six?.targets}`);
}

// ── 7. a concentrated condition loses its later turns when the hold breaks ──────────────────────
console.log("\n7. concentrated control: each later turn stands only while the holder keeps it (BR073)");
{
  /**
   * 0.8.57.0 charged a concentrated Hold for every turn it printed. v5 BR073: *"P_ACTIVE_R multiplies the
   * sequence of required concentration saves and source survival."*
   */
  const held = (concentration: boolean, conSave = 0) => ({
    round1: [{ pcs: 1, turns: [1, 1, 1, 1, 1], ...(concentration ? { concentration: true } : {}) }],
  });
  const caster = (id: string, hp: number, concentration: boolean, conSave = 0): RosterGroup =>
    ({ id, name: id, quantity: 1, baseHp: hp, flatHpPerBody: true, dpr: all(5), pcTurnDenials: held(concentration) as never, conSave });
  const totalLost = (rs: Round[]) => rs.slice(0, 5).reduce((s, r) => s + (r.pcTurnsLost ?? 0), 0);

  /**
   * The party is busy with something else, so nothing is dealt to the caster: the hold is 1 and
   * nothing changes.
   *
   * ⚠ THE DECOY HAS TO EARN THE PARTY'S ATTENTION NOW. It used to be enough to write it first,
   * because the authored order WAS the kill order. Since the Tactical AI landed, the party picks by
   * threat — and a caster that holds a PC every round is worth 10 a turn of it, so the party quite
   * correctly went for the caster and broke the concentration this assertion needs intact. A decoy
   * hitting for 40 outranks it, which is what "the party hits something else" has to mean now.
   */
  const decoy = (id: string): RosterGroup => ({ ...body(id, 100000), dpr: all(40) });
  const plainDecoy = run([decoy("Decoy"), caster("Caster", 100000, false)]);
  const concDecoy = run([decoy("Decoy"), caster("Caster", 100000, true)]);
  ok("while the party hits something else, a concentrated hold costs exactly what it printed",
    near(totalLost(plainDecoy), totalLost(concDecoy)), `${totalLost(plainDecoy).toFixed(3)} vs ${totalLost(concDecoy).toFixed(3)}`);

  // The party hits the caster: its later turns thin out with every save it has to make.
  const plainHit = run([caster("Caster", 100000, false)]);
  const concHit = run([caster("Caster", 100000, true, 0)]);
  ok("when the party damages the caster, the concentrated Hold takes FEWER turns",
    totalLost(concHit) < totalLost(plainHit) - 1e-6, `${totalLost(concHit).toFixed(3)} < ${totalLost(plainHit).toFixed(3)}`);
  const strong = run([caster("Caster", 100000, true, 12)]);
  ok("...and a caster with a strong CON save keeps more of them than a weak one",
    totalLost(strong) > totalLost(concHit) + 1e-6, `CON +12 ${totalLost(strong).toFixed(3)} > CON +0 ${totalLost(concHit).toFixed(3)}`);

  // A dead holder owes nothing after it falls.
  const dies = run([caster("Caster", 30, true, 30), body("T", 100000)]);
  ok("a holder killed in round 1 owes no turns from round 2 on beyond the one already landing",
    (dies[2]?.pcTurnsLost ?? 0) === 0 && (dies[3]?.pcTurnsLost ?? 0) === 0,
    dies.slice(0, 4).map(r => (r.pcTurnsLost ?? 0).toFixed(2)).join(", "));

  const heldDenial = turnDenialFor(feat({ saveDc: 14, saveAbility: "wis", conditions: ["paralyzed"],
    text: "The target must succeed on a DC 14 Wisdom saving throw or be Paralyzed for 1 minute (concentration)." }), T);
  ok("the denial is flagged as concentration and its basis names the hold",
    priced(heldDenial) && heldDenial.concentration === true && /held by concentration/.test(heldDenial.basis),
    priced(heldDenial) ? heldDenial.basis : JSON.stringify(heldDenial));
  const timedDenial = turnDenialFor(feat({ saveDc: 14, saveAbility: "wis", conditions: ["paralyzed"],
    text: "The target must succeed on a DC 14 Wisdom saving throw or be Paralyzed until the end of its next turn." }), T);
  ok("  (mutation) the same condition on a printed timer is NOT flagged as concentration",
    priced(timedDenial) && timedDenial.concentration === false, priced(timedDenial) ? timedDenial.basis : JSON.stringify(timedDenial));
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
