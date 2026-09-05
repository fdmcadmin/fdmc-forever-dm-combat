/**
 * THE BOND MITIGATION GATE — and the only assertion that matters is that it ARRIVES.
 *
 * Run: npm run check:bond-mitigation
 *
 * ⚠ THIS FILE EXISTS BECAUSE OF A NAMED FAULT, NOT A HYPOTHETICAL ONE. `partyHealingFromActors`
 * was correct, was called, and reached a CAPTION — computed at line 165 of the panel and used only
 * inside JSX at line 590. It never touched sustain, EHP, the trace or the survivor count. Every
 * Act 3 gate was priced against a party with no healing while a green "+ healing" number sat on
 * screen saying otherwise.
 *
 * So computing a mitigation figure is not the feature. The feature is the figure CHANGING THE
 * FIGHT, and the way to prove that is to break it: run the same encounter with mitigation and
 * without, and require the outcome to move. A test that only checks the number is the same test
 * that would have passed while healing reached nothing.
 *
 * ⚠ THE EXIT CHECK IS THE LAST THING IN THIS FILE.
 */

import {
  partyBondMitigationFromActors,
} from "../src/modules/the-broken-chain/bondMitigationFromActors";
import { BROKEN_CHAIN_BOND_TEMPLATES } from "../src/modules/the-broken-chain/content/bondTemplates";
import { TBC_MILESTONE } from "../src/modules/the-broken-chain/content/bondGates";
import { simulateEncounter, type RosterGroup } from "../src/core/encounter-band/checkerV2";
import type { Actor } from "../src/core/types/actor";

let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};

/** A character carrying one bond, at a level and a path. */
const bonded = (
  name: string, templateId: string, level: number,
  chosenPathIndex?: 0 | 1, milestones: string[] = [],
): Actor => ({
  id: name, kind: "player", name, subtitle: "", level,
  stats: { ac: 16, hp: { current: 40, max: 40 }, speed: "30 ft" },
  pinnedReactions: [], tabs: {},
  moduleData: {
    act: 3, theme: "test", statBlockStatus: "confirmed",
    bondAssignment: { templateId, ...(chosenPathIndex !== undefined ? { chosenPathIndex } : {}) },
    milestones,
  },
} as unknown as Actor);

console.log("Bond mitigation — read from the characters, and it has to reach the fight\n");

/* ── The inventory Christopher described ─────────────────────────────────────────────────── */
console.log("\"almost every bond has some version of damage reduction for self or others\"");
{
  /**
   * ⚠ THE INVARIANT IS NOT A COUNT. The first version of this gate asserted "at least 11 of 14
   * price above zero" and failed at 7, which told me nothing about whether 7 was right. It is:
   * five of the remaining seven mitigate by ACCURACY (disadvantage, or a penalty to the attack
   * roll), which this deliberately does not price, and two are genuinely pure offence.
   *
   * The property worth defending is that NOTHING IS DROPPED — every bond either produces a
   * priced figure or says why it did not. A silent zero is the failure mode that put this whole
   * pass on the board, and a count would never have caught it: when disadvantage bonds were
   * falling through, the count was the same 7 it is now.
   */
  const silent = BROKEN_CHAIN_BOND_TEMPLATES.filter(t =>
    ([0, 1] as const).every(p => {
      const m = partyBondMitigationFromActors([bonded("T", t.id, 6, p)]);
      return m.perRound === 0 && m.unpriced.length === 0;
    }));
  /**
   * ⚠ ZERO, NOT "AT MOST ONE". This read `<= 1` while Skirmish was the known exception, and
   * Christopher corrected the premise: *"this is one of the only bonds that doesnt have a stated
   * defense because dart lets the POC move without OA happening."* Dart IS a defence — an
   * opportunity attack that never happens — it simply prints no die. Once that was classified,
   * the tolerance became a hole big enough to hide a real regression in, so it is gone.
   */
  ok("NO bond is silently dropped, on either path — it prices, or it says why",
    silent.length === 0, silent.length ? `silent: ${silent.map(t => t.id).join(", ")}` : "none silent");

  const priced = BROKEN_CHAIN_BOND_TEMPLATES.filter(t =>
    ([0, 1] as const).some(p => partyBondMitigationFromActors([bonded("T", t.id, 6, p)]).perRound > 0));
  console.log(`     ${priced.length} of ${BROKEN_CHAIN_BOND_TEMPLATES.length} price directly: ${priced.map(t => t.id).join(", ")}`);

  // The four Christopher named by hand.
  for (const [id, path] of [["guardian", 0], ["devout", 0], ["mending", 0], ["warden", 1]] as const) {
    const m = partyBondMitigationFromActors([bonded("T", id, 6, path)]);
    ok(`${id} prices above zero`, m.perRound > 0, `${m.perRound.toFixed(1)} HP/round via ${m.sources[0]?.option ?? "—"}`);
  }

  /**
   * ⚠ THE REGRESSION FOR THE BUG THIS GATE FOUND. Disadvantage bonds must never be silent.
   *
   * Checked across BOTH paths, not one. The first version tested path 0 only and failed on
   * Suppressing, whose path 0 is Keen Eye (reaction suppression) and Suppressing Shot (speed
   * halved) — neither imposes disadvantage, so a silent path 0 is the CORRECT answer there. Its
   * disadvantage lives on path 1's Steady Aim. Asserting a path that does not carry the effect
   * tests the fixture, not the code.
   */
  for (const id of ["precise", "suppressing", "resonant"] as const) {
    const reasons = ([0, 1] as const).flatMap(p =>
      partyBondMitigationFromActors([bonded("T", id, 6, p)]).unpriced.map(u => u.reason));
    ok(`${id} reports its disadvantage as unpriced accuracy`,
      reasons.includes("accuracy"), reasons.join(", ") || "SILENT ON BOTH PATHS");
  }
}

/* ── The unchosen branch is still live ───────────────────────────────────────────────────── */
console.log("\nThe path NOT taken keeps a weaker version, and it still counts");
{
  // Devout Wrath (path 1) is the OFFENSIVE branch — Shelter is held, and Shelter is temp HP.
  const wrath = partyBondMitigationFromActors([bonded("T", "devout", 6, 1)]);
  ok("a Devout who took Wrath still has Shelter's temporary HP",
    wrath.perRound > 0 && wrath.sources[0]?.held === true,
    `${wrath.perRound.toFixed(1)} via ${wrath.sources[0]?.option} (held)`);

  const aegis = partyBondMitigationFromActors([bonded("T", "devout", 6, 0)]);
  ok("and the CHOSEN branch prices higher than the held one",
    aegis.perRound > wrath.perRound, `${aegis.perRound.toFixed(1)} vs ${wrath.perRound.toFixed(1)}`);
}

/* ── The companion bond's path decides what it IS ────────────────────────────────────────── */
console.log("\nA companion bond's path is not cosmetic");
{
  /**
   * ⚠ WHY THE UNREACHABLE PATH PICKER WAS A REAL DEFECT, not a cosmetic one.
   *
   * Christopher, 2026-09-02: *"there is no way to choose the specialization for the companion."*
   * `ActorEditor` rendered the companion picker OR the path picker, never both, so Pack Instinct —
   * the only `actor: "companion"` template — could never have its path set, while the card printed
   * "Metamorphosis reached — choose the permanent path".
   *
   * A script cannot see a JSX either/or. What it CAN prove is that the choice changes the answer:
   * Bonded Strike is the companion's damage line and Shielding Bond reduces the next hit on the
   * closest ally, so an unset path is not a neutral default — it decides whether the bond reaches
   * the checker as mitigation at all.
   */
  const companionBonds = BROKEN_CHAIN_BOND_TEMPLATES.filter(t => t.actor === "companion");
  ok("the ladder still has a companion bond to guard", companionBonds.length > 0,
    companionBonds.map(t => t.id).join(", "));

  for (const t of companionBonds) {
    const paths = t.stages[2]?.paths ?? [];
    ok(`${t.id} offers two paths at Metamorphosis for the picker to render`, paths.length === 2,
      paths.map(p => p.name).join(" / "));
    const p0 = partyBondMitigationFromActors([bonded("C", t.id, 6, 0)]);
    const p1 = partyBondMitigationFromActors([bonded("C", t.id, 6, 1)]);
    ok(`${t.id}'s two paths price DIFFERENTLY — the choice is load-bearing`,
      p0.perRound !== p1.perRound,
      `${p0.perRound.toFixed(1)} (${p0.sources[0]?.option ?? "—"}) vs ${p1.perRound.toFixed(1)} (${p1.sources[0]?.option ?? "—"})`);
  }
}

/* ── One bond, one option, one round ─────────────────────────────────────────────────────── */
console.log("\nA bond fires ONCE — the options are not summed");
{
  const one = partyBondMitigationFromActors([bonded("T", "mending", 9, 0)]);
  ok("a single bonded character reports exactly one source", one.sources.length === 1,
    one.sources.map(s => s.option).join(", "));
}

/* ── What is deliberately not priced ─────────────────────────────────────────────────────── */
console.log("\nReported, never invented");
{
  // Vanguard's Iron Guard reduces an ATTACK ROLL. It must not be counted as damage removed.
  const vanguard = partyBondMitigationFromActors([bonded("T", "vanguard", 6, 1)]);
  ok("an attack-roll penalty is NOT priced as damage",
    vanguard.unpriced.some(u => u.reason === "accuracy"),
    vanguard.unpriced.map(u => u.reason).join(", ") || "nothing reported");
  ok("...and it is reported rather than dropped", vanguard.unpriced.length > 0);

  // Guardian's Challenge redirects; it does not reduce.
  const guardian = partyBondMitigationFromActors([bonded("T", "guardian", 6, 1)]);
  ok("forced targeting is reported as an allocation effect",
    guardian.unpriced.some(u => u.reason === "targeting"));

  // Unbroken writes "+ your modifier" and v13 names no ability for it.
  const unbroken = partyBondMitigationFromActors([bonded("T", "guardian", 13, 0, [TBC_MILESTONE.act3BossDefeated])]);
  ok("the unnamed Unbroken modifier is reported, not guessed",
    unbroken.unpriced.some(u => u.reason === "modifier"),
    unbroken.unpriced.filter(u => u.reason === "modifier").map(u => u.option).join(", ") || "none");
}

/* ── A party with no bonds says so ───────────────────────────────────────────────────────── */
console.log("\nA zero is never silent");
{
  const plain = { id: "p", kind: "player", name: "Unbonded", subtitle: "", level: 8,
    stats: { ac: 15, hp: { current: 30, max: 30 }, speed: "30 ft" },
    pinnedReactions: [], tabs: {} } as unknown as Actor;
  const m = partyBondMitigationFromActors([plain]);
  ok("no assignment gives zero", m.perRound === 0);
  ok("...and names the character, so the zero reads as a fact not a bug",
    m.withoutBond.includes("Unbonded"), m.withoutBond.join(", "));
  ok("an empty party is zero with nothing reported",
    partyBondMitigationFromActors([]).perRound === 0);
}

/* ── The milestone gate holds the price down ─────────────────────────────────────────────── */
console.log("\nA held bond prices at the stage it is HELD at");
{
  const earned = partyBondMitigationFromActors([bonded("T", "guardian", 9, 0, [TBC_MILESTONE.act3BossDefeated])]);
  const held = partyBondMitigationFromActors([bonded("T", "guardian", 9, 0, [])]);
  ok("level 9 WITH the Act 3 boss prices higher than level 9 without",
    earned.perRound > held.perRound,
    `earned ${earned.perRound.toFixed(1)} vs held ${held.perRound.toFixed(1)}`);
  ok("and the held one is not zero — it is still a Metamorphosis bond", held.perRound > 0);
}

/* ── ⚠ THE ARRIVAL TEST: PROVE IT BY BREAKING IT ─────────────────────────────────────────── */
console.log("\nIt reaches the FIGHT, not a caption");
{
  const party = { size: 4, sustain: 300, dpr: { round1: 55, round2: 50, round3: 45, round4Plus: 40 } };
  const roster: RosterGroup[] = [{
    name: "body", quantity: 3, baseHp: 70, initiativeMod: 2,
    dpr: { round1: 26, round2: 24, round3: 22, round4Plus: 20 },
  }];
  const run = (mitigationPerRound: number) =>
    simulateEncounter({ party: { ...party, initiative: 2, mitigationPerRound }, roster });

  const none = run(0);
  const some = run(20);
  const took = (r: ReturnType<typeof simulateEncounter>) =>
    r.rounds.reduce((s, x) => s + x.monsterDamage, 0);

  ok("mitigation strictly reduces the damage the party takes",
    took(some) < took(none), `${took(some).toFixed(1)} vs ${took(none).toFixed(1)}`);
  ok("the round trace reports what was stopped",
    some.rounds.every(r => r.bondMitigation > 0) && none.rounds.every(r => r.bondMitigation === 0));
  ok("...and the amount stopped is the mitigation, capped by the round's own damage",
    some.rounds.every(r => r.bondMitigation <= 20 + 1e-9));

  // ⚠ ZERO MITIGATION MUST REPRODUCE THE PRE-BOND FIGHT EXACTLY.
  const silent = simulateEncounter({ party: { ...party, initiative: 2 }, roster });
  const shape = (r: ReturnType<typeof simulateEncounter>) => JSON.stringify({
    completion: r.completionRound, fatal: r.fatalRound,
    rounds: r.rounds.map(x => [x.round, +x.monsterDamage.toFixed(9), x.standing]),
  });
  ok("a party with no bonds is the identical fight it was before bonds were read",
    shape(silent) === shape(none));

  // And enough of it changes the VERDICT, which is the whole point.
  const heavy = run(80);
  ok("enough mitigation changes downs, not just a displayed number",
    (heavy.downsAtCompletion ?? 99) < (none.downsAtCompletion ?? 0)
    || (heavy.standingAtCompletion ?? 0) > (none.standingAtCompletion ?? 0),
    `down ${none.downsAtCompletion} → ${heavy.downsAtCompletion}, standing ${none.standingAtCompletion} → ${heavy.standingAtCompletion}`);

  // Mitigation can never HEAL the party above what the fight deals.
  const absurd = run(10_000);
  ok("mitigation cannot run the party's HP up",
    absurd.rounds.every(r => r.monsterDamage >= 0)
    && absurd.rounds.reduce((s, r) => s + r.monsterDamage, 0) === 0);
}

/* ── A real four-person party ─────────────────────────────────────────────────────────────── */
console.log("\nA whole party sums, one option each");
{
  const four = [
    bonded("Tank", "guardian", 8, 0),
    bonded("Cleric", "devout", 8, 0),
    bonded("Medic", "mending", 8, 0),
    bonded("Striker", "vanguard", 8, 0),
  ];
  const m = partyBondMitigationFromActors(four);
  console.log(`     ${m.perRound.toFixed(1)} HP/round — ${m.sources.map(s => `${s.actor} ${s.option} ${s.amount.toFixed(1)}`).join(" · ")}`);

  /**
   * ⚠ THREE SOURCES FROM FOUR BONDED CHARACTERS IS THE RIGHT ANSWER, and the first version of
   * this gate asserted four. The Striker carries Vanguard, whose every branch is an ATTACK-ROLL
   * penalty — real mitigation, deliberately unpriced. Demanding a source per character would have
   * forced exactly the invention this module refuses to make.
   */
  ok("three of the four price; the Vanguard is accounted for, not counted",
    m.sources.length === 3 && !m.sources.some(s => s.actor === "Striker"),
    m.sources.map(s => s.actor).join(", "));
  ok("...and the Vanguard is REPORTED, so its absence from the total is visible",
    m.unpriced.some(u => u.actor === "Striker" && u.reason === "accuracy"));

  /**
   * ⚠ FOUND ON THE LIVE PARTY, NOT IN A FIXTURE. Ripsnarl carries Skirmish Instinct at
   * Metamorphosis — Momentum and Dart, pure damage and movement. He produced no source, no
   * `unpriced` note and no `withoutBond` entry, so the panel named three of four characters and
   * said nothing at all about the fourth. Every character with a bond must now be accounted for
   * somewhere, which is the property this asserts.
   */
  const withSkirmish = [...four, bonded("Runner", "skirmish", 8, 0)];
  const s = partyBondMitigationFromActors(withSkirmish);
  const accountedFor = new Set([
    ...s.sources.map(x => x.actor), ...s.unpriced.map(x => x.actor),
    ...s.withoutBond, ...s.bondWithoutMitigation.map(x => x.actor),
  ]);
  ok("EVERY character is accounted for somewhere — priced, unpriced, or explicitly neither",
    withSkirmish.every(a => accountedFor.has(a.name)),
    [...accountedFor].join(", "));

  /**
   * ⚠ THE CATCH-ALL MUST BE EMPTY AGAINST THE REAL LADDER, and that is the assertion — not that it
   * fires. `bondWithoutMitigation` was added when Skirmish appeared to have no defence at all;
   * classifying Dart as avoidance emptied it. Keeping the field is right (a future authored bond
   * with no defensive text must still be named rather than vanish), but asserting it fires on
   * Skirmish would now be asserting the bug.
   *
   * Every one of the fourteen is accounted for by a real category, so this list is empty. If a
   * bond ever lands in it, that is a content or classifier question worth surfacing — which is
   * exactly what the panel prints.
   */
  ok("no AUTHORED bond falls into the catch-all — all fourteen have a real category",
    s.bondWithoutMitigation.length === 0,
    s.bondWithoutMitigation.map(b => `${b.actor} ${b.bond}`).join(", ") || "empty");
  /**
   * ⚠ THE LABEL MOVED, THE MEANING DID NOT. Skirmish's Dart is an opportunity attack that never
   * happens — movement safety. It was filed under `avoidance`, which named the whole defensive
   * family after this one narrow member, and that made the family look unpriceable because Dart
   * alone needs a provoke rate nobody has. Christopher: "Avoidance does not equal OA exposure."
   * Imposed disadvantage and forced rerolls are the Avoidance family and they price; this is
   * `oaDenial` and it still, correctly, does not.
   */
  ok("Skirmish is classified as OA DENIAL, not as 'no mitigation'",
    s.unpriced.some(u => u.actor === "Runner" && u.reason === "oaDenial"),
    s.unpriced.filter(u => u.actor === "Runner").map(u => u.reason).join(", ") || "none");
  ok("the total is their sum",
    Math.abs(m.perRound - m.sources.reduce((s, x) => s + x.amount, 0)) < 1e-9);
  ok("a level-8 party's bonds are worth a meaningful share of a round",
    m.perRound > 15, `${m.perRound.toFixed(1)} HP/round`);
}

console.log(`\n${failures === 0 ? "PASS" : `FAIL — ${failures} check(s)`}`);
process.exit(failures === 0 ? 0 : 1);
