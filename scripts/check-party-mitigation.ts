/**
 * WHAT THE PARTY'S OWN CLASSES PREVENT — and the two ways it gets inflated.
 *   npm run check:classmit
 *
 * The checker priced a CREATURE's resistances against the party's damage mix and never asked the
 * same question of the party. Two rules decide whether the answer is honest:
 *
 *   Action Timing row 22  "All normal Reactions compete for the same actor budget: defensive,
 *                          offensive, opportunity attacks, spell reactions, item reactions, and
 *                          creature reactions."
 *   Action Timing row 13  "Once spent, no other normal Reaction is legal until refresh."
 *
 * and one that decides whether it is a reading at all: a mechanic is read from a STATED field,
 * never from a feature's description. A Barbarian does not resist bludgeoning because the class
 * is called Barbarian.
 *
 * ⚠ EVERY ASSERTION HAS A MUTATION THAT MUST FLIP IT.
 * ⚠ THE EXIT CHECK IS THE LAST THING IN THIS FILE.
 */

import { partyMitigationFromActors, rosterDamageMix } from "../src/core/encounter-band/partyMitigationFromActors";

let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};

/** A fight that throws exactly two types, so a share is arithmetic rather than a guess. */
const roster = [{
  name: "Test Body",
  actions: [
    { name: "Claw", damage: "10", damageType: "Slashing" },
    { name: "Wither", damage: "10", damageType: "Necrotic" },
  ],
}];
const mix = rosterDamageMix(roster as never);

const pc = (name: string, over: Record<string, unknown> = {}) => ({
  id: name, kind: "player", name, level: 5,
  stats: { ac: 16, hp: { current: 40, max: 40 }, speed: "30 ft." },
  abilityScores: { str: { score: 16 }, dex: { score: 14 }, con: { score: 14 },
    int: { score: 10 }, wis: { score: 12 }, cha: { score: 10 } },
  tabs: { main: [] },
  ...over,
}) as never;

console.log("The party's own mitigation, read from stated fields\n");

/* ── 1. The roster's damage, in types ────────────────────────────────────────────────────── */
console.log("A resistance is weighed against what THIS fight throws");
{
  ok("the roster's mix is readable", mix.usable, `typed ${(mix.coverage * 100).toFixed(0)}%`);
  ok("...and splits evenly between the two types it deals",
    Math.abs((mix.shares.slashing ?? 0) - 0.5) < 1e-9 && Math.abs((mix.shares.necrotic ?? 0) - 0.5) < 1e-9,
    JSON.stringify(mix.shares));

  const party = [pc("A", { damageResponses: [{ type: "necrotic", response: "resistant" }] }), pc("B")];
  const m = partyMitigationFromActors(party, { mix });
  ok("a stated resistance raises effective HP", m.multiplier > 1, `x${m.multiplier.toFixed(4)}`);
  ok("...and names the share it was weighed at",
    m.resisted.length === 1 && Math.abs(m.resisted[0].share - 0.25) < 1e-9,
    `${(m.resisted[0]?.share * 100).toFixed(1)}% of incoming`);

  /**
   * ⚠ ONE CHARACTER'S RESISTANCE IS NOT THE PARTY'S. Half the incoming damage is necrotic, but
   * only one of two characters resists it, so the eligible share is a quarter — not a half.
   * Getting this wrong makes a party of six read as though everyone raged.
   */
  const solo = partyMitigationFromActors([party[0]], { mix });
  ok("mutation: the same resistance is worth MORE in a smaller party",
    solo.multiplier > m.multiplier,
    `1 PC x${solo.multiplier.toFixed(3)} vs 2 PCs x${m.multiplier.toFixed(3)}`);

  /** ⚠ AND A RESISTANCE TO SOMETHING NOTHING DEALS IS WORTH NOTHING. */
  const irrelevant = partyMitigationFromActors(
    [pc("A", { damageResponses: [{ type: "psychic", response: "immune" }] })], { mix });
  ok("immunity to a type this fight never deals changes nothing",
    Math.abs(irrelevant.multiplier - 1) < 1e-9, `x${irrelevant.multiplier.toFixed(4)}`);

  /** A qualifier cannot be evaluated, so it is priced at the bound and REPORTED. */
  const raging = partyMitigationFromActors(
    [pc("A", { damageResponses: [{ type: "slashing", response: "resistant", qualifier: "while raging" }] })], { mix });
  ok("a qualifier is reported, not silently applied or dropped",
    raging.multiplier > 1 && raging.resisted[0].qualifierUnresolved, raging.resisted[0]?.response.qualifier);
}

/* ── 2. Nothing stated is a NAMED zero, never a silent one ───────────────────────────────── */
console.log("\nA character with nothing entered is named");
{
  const m = partyMitigationFromActors([pc("A"), pc("B")], { mix });
  ok("both characters are named as having entered nothing",
    m.withoutStatedResponses.length === 2, m.withoutStatedResponses.join(", "));
  ok("...and the multiplier is exactly 1, not a guess", m.multiplier === 1);

  /**
   * ⚠ THE PROSE IS NOT READ, AND THIS IS THE ASSERTION THAT KEEPS IT THAT WAY. The live sheets
   * say "Resistance to Necrotic and Radiant damage" inside a feature's description and the app
   * must still price nothing until the DM states it as a field. A gate that let this pass would
   * be inviting exactly the inference this codebase refuses to make.
   */
  const prosey = pc("A", {
    tabs: { features: [{ id: "f", label: "Celestial Resistance", actionKind: "feature",
      description: "Resistance to Necrotic and Radiant damage.",
      metadata: { details: "Resistance to Necrotic and Radiant damage." } }] },
  });
  const fromProse = partyMitigationFromActors([prosey], { mix });
  ok("a resistance written only in a description is NOT read",
    fromProse.multiplier === 1 && fromProse.withoutStatedResponses.includes("A"),
    `x${fromProse.multiplier}`);
  ok("mutation: stating the same thing as a field DOES price it",
    partyMitigationFromActors(
      [pc("A", { damageResponses: [{ type: "necrotic", response: "resistant" }] })], { mix },
    ).multiplier > 1);
}

/* ── 3. One Reaction per character, contended with the bond ──────────────────────────────── */
console.log("\nOne Reaction per character (Action Timing rows 13 and 22)");
{
  const reaction = (label: string, damage?: string) => ({
    id: label, label, actionKind: "feature", economyCost: ["reaction"], logMode: "default",
    metadata: { effectKind: "reduction", ...(damage ? { damage } : {}) },
  });

  const twoReactions = pc("A", { tabs: { main: [reaction("Spirit Shield", "1d6"), reaction("Iron Guard", "2d6")] } });
  const m = partyMitigationFromActors([twoReactions], { damagePerHit: 20 });
  ok("two reactions on one character count ONCE, at the better one",
    m.reactions.length === 1 && Math.abs(m.reactionPerRound - 7) < 1e-9,
    `${m.reactionPerRound.toFixed(2)}/round from ${m.reactions[0]?.action}`);

  /** ⚠ A REACTION WITH NO DICE HALVES THE HIT, and needs the hit to do it. */
  const dodge = pc("A", { tabs: { main: [reaction("Uncanny Dodge")] } });
  const halved = partyMitigationFromActors([dodge], { damagePerHit: 20 });
  ok("a printed-dice-less reduction halves one incoming hit",
    Math.abs(halved.reactionPerRound - 10) < 1e-9 && halved.reactions[0].basis === "halved",
    `${halved.reactionPerRound}/round`);
  ok("...and with no incoming figure it contributes nothing rather than a guess",
    partyMitigationFromActors([dodge], {}).reactionPerRound === 0);

  /**
   * ⚠ THE BOND AND THE CLASS FEATURE COMPETE FOR THE SAME REACTION. A bond worth more displaces
   * the class one entirely; a bond worth less is topped up by the DIFFERENCE, never by the whole
   * feature on top of a bond already in the total.
   */
  const shielded = pc("A", { tabs: { main: [reaction("Spirit Shield", "1d6")] } });   // 3.5
  const displaced = partyMitigationFromActors([shielded], { damagePerHit: 20 }, { A: 9 });
  ok("a better bond reaction displaces the class one entirely",
    displaced.reactionPerRound === 0 && displaced.displacedByBond.length === 1,
    displaced.displacedByBond[0] && `${displaced.displacedByBond[0].action} ${displaced.displacedByBond[0].amount} < bond ${displaced.displacedByBond[0].bondAmount}`);

  const topUp = partyMitigationFromActors([shielded], { damagePerHit: 20 }, { A: 1 });
  ok("a weaker bond is topped up by the DIFFERENCE, not by the whole feature",
    Math.abs(topUp.reactionPerRound - 2.5) < 1e-9, `${topUp.reactionPerRound}/round (3.5 - 1)`);

  /** ⚠ MUTATION: an action that is not a Reaction must not be counted as one. */
  const notAReaction = pc("A", {
    tabs: { main: [{ id: "x", label: "Shield Bash", actionKind: "feature", economyCost: ["main"],
      metadata: { effectKind: "reduction", damage: "1d6" } }] },
  });
  ok("mutation: the same reduction on the Action channel is not a Reaction",
    partyMitigationFromActors([notAReaction], { damagePerHit: 20 }).reactionPerRound === 0);

  /** ⚠ MUTATION: a reaction that DEALS damage is not mitigation. */
  const riposte = pc("A", {
    tabs: { main: [{ id: "r", label: "Riposte", actionKind: "feature", economyCost: ["reaction"],
      metadata: { damage: "2d6", damageType: "Slashing" } }] },
  });
  ok("mutation: an untagged damaging reaction is not read as mitigation",
    partyMitigationFromActors([riposte], { damagePerHit: 20 }).reactionPerRound === 0);
}

/* ── 4. Two characters, two budgets ──────────────────────────────────────────────────────── */
console.log("\nTwo characters bring two Reactions");
{
  const r = (label: string, damage: string) => ({
    id: label, label, actionKind: "feature", economyCost: ["reaction"], logMode: "default",
    metadata: { effectKind: "reduction", damage },
  });
  const m = partyMitigationFromActors(
    [pc("A", { tabs: { main: [r("Spirit Shield", "1d6")] } }), pc("B", { tabs: { main: [r("Warding Flare", "1d6")] } })],
    { damagePerHit: 20 });
  ok("each character contributes their own", Math.abs(m.reactionPerRound - 7) < 1e-9,
    `${m.reactionPerRound}/round across ${m.reactions.length}`);
  ok("an empty party is a clean zero, not a crash",
    partyMitigationFromActors([], { mix }).multiplier === 1);
}

console.log(failures === 0 ? "\nAll assertions passed." : `\n${failures} assertion(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
