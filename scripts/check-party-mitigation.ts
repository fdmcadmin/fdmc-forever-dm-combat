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
 * and one that decides where the resistances come from at all. Christopher, 2026-09-07: *"all of
 * those resistances should be there because they are based on classes not because they want them,
 * same with the rage, it should already be known what rage resists."* So they are DERIVED from the
 * stated race and class through a hand-built rule table, the entered field is the override, and
 * what stays forbidden is the other thing — scanning a feature's DESCRIPTION for the word
 * "resistance", which breaks on every homebrew wording. Both halves are asserted below.
 *
 * ⚠ EVERY ASSERTION HAS A MUTATION THAT MUST FLIP IT.
 * ⚠ THE EXIT CHECK IS THE LAST THING IN THIS FILE.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { partyMitigationFromActors, rosterDamageMix } from "../src/core/encounter-band/partyMitigationFromActors";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
import { classDamageResponsesFor, damageResponsesForActor } from "../src/modules/dnd-5e/classDamageResponses";

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

/* ── 2. The class and the lineage are already known ──────────────────────────────────────── */
console.log("\nA class or lineage resistance is KNOWN, not asked for");
{
  /**
   * Christopher, 2026-09-07: *"all of those resistances should be there because they are based on
   * classes not because they want them, same with the rage, it should already be known what rage
   * resists."* Keyed on the STATED race and class — the same hand-built rule-table shape
   * `casterLean` and `weaponMastery` use.
   */
  const aasimar = pc("Ash", { race: "Aasimar", className: "Artificer" });
  const derived = classDamageResponsesFor(aasimar);
  ok("an Aasimar resists necrotic and radiant without being told",
    derived.length === 2 && derived.every(r => r.response === "resistant")
    && derived.map(r => r.type).sort().join(",") === "necrotic,radiant",
    derived.map(r => `${r.response} ${r.type}`).join(", "));
  ok("...and it names the feature it came from",
    derived[0]?.source === "Aasimar · Celestial Resistance", derived[0]?.source);

  ok("a Dwarf resists poison — and a SUBRACE still resolves",
    classDamageResponsesFor(pc("X", { race: "Mountain Dwarf" }))[0]?.type === "poison");
  ok("a lineage the table does not cover grants nothing",
    classDamageResponsesFor(pc("X", { race: "Kobold", className: "Paladin" })).length === 0);
  /** ⚠ A CHOICE IS NOT A RULE. A Dragonborn's type depends on ancestry the sheet does not state. */
  ok("a Dragonborn is NOT given a resistance the sheet never chose",
    classDamageResponsesFor(pc("X", { race: "Dragonborn" })).length === 0);

  const barb = classDamageResponsesFor(pc("R", { race: "Orc", className: "Barbarian" }));
  ok("a Barbarian resists bludgeoning, piercing and slashing",
    barb.map(r => r.type).sort().join(",") === "bludgeoning,piercing,slashing",
    barb.map(r => r.type).join(", "));
  ok("...gated by the Rage pool, not granted outright",
    barb.every(r => r.gatedByResource === "Rage"));

  const m = partyMitigationFromActors([aasimar], { mix });
  ok("the derived rule reaches the price with no field entered",
    m.multiplier > 1 && m.withoutStatedResponses.length === 0, `x${m.multiplier.toFixed(3)}`);
  ok("...and the panel can say where it came from",
    m.resisted[0]?.source === "Aasimar · Celestial Resistance", m.resisted[0]?.source);

  /** ⚠ MUTATION: change the race and the resistance must go. */
  ok("mutation: the same character as a Human resists nothing",
    partyMitigationFromActors([pc("Ash", { race: "Human", className: "Artificer" })], { mix }).multiplier === 1);

  /** An entered response for the SAME type replaces the rule rather than stacking with it. */
  const both = damageResponsesForActor(pc("Ash", {
    race: "Aasimar",
    damageResponses: [{ type: "necrotic", response: "immune" }],
  }));
  ok("an entered response overrides the derived one for that type, and only that type",
    both.filter(r => r.type === "necrotic").length === 1
    && both.find(r => r.type === "necrotic")?.response === "immune"
    && both.some(r => r.type === "radiant"),
    both.map(r => `${r.response} ${r.type}`).join(", "));
}

/* ── 2b. A gated resistance covers the fights its resource covers ────────────────────────── */
console.log("\nRage covers the fights Rage can cover");
{
  const rageRow = (uses: number, regain?: number | "all") => ({
    id: "rage", label: "Rage", actionKind: "resource", economyCost: [], logMode: "silent",
    metadata: { resourceKind: "pool", additive: String(uses), ...(regain !== undefined ? { shortRestRegain: regain } : {}) },
  });
  /** Ripsnarl's own sheet: 2 per Long Rest, one back at the day's single Short Rest. */
  const rip = pc("Ripsnarl", { race: "Orc", className: "Barbarian", tabs: { resources: [rageRow(2, 1)] } });
  const m = partyMitigationFromActors([rip], { mix });
  const slash = m.resisted.find(r => r.response.type === "slashing")!;
  ok("three rages across a five-fight day is an uptime of 0.6",
    Math.abs((slash.uptime ?? 0) - 0.6) < 1e-9, `${slash.uptime} — ${slash.uptimeNote}`);
  ok("...and the share is scaled by it, not priced as always-on",
    Math.abs(slash.share - 0.5 * 0.6) < 1e-9, `${slash.share.toFixed(3)} of incoming`);
  ok("...so the gate is answered and is NOT also reported as an unread qualifier",
    slash.qualifierUnresolved === false);

  /** ⚠ MUTATION: more rages must be worth more. */
  const many = partyMitigationFromActors(
    [pc("Ripsnarl", { race: "Orc", className: "Barbarian", tabs: { resources: [rageRow(6)] } })], { mix });
  ok("mutation: a Barbarian with more rages than fights is priced at full uptime",
    Math.abs((many.resisted[0].uptime ?? 0) - 1) < 1e-9 && many.multiplier > m.multiplier,
    `x${many.multiplier.toFixed(3)} vs x${m.multiplier.toFixed(3)}`);

  /** ⚠ AND NO POOL IS NOT "ALWAYS ON" — the most generous reading of a gap is the wrong one. */
  const noPool = partyMitigationFromActors(
    [pc("R", { race: "Orc", className: "Barbarian", tabs: { resources: [] } })], { mix });
  ok("with no Rage pool on the sheet it covers nothing, and says why",
    noPool.multiplier === 1 && /no "Rage" pool/.test(noPool.resisted[0]?.uptimeNote ?? ""),
    noPool.resisted[0]?.uptimeNote);
}

/* ── 2c. Nothing at all is a NAMED zero, never a silent one ──────────────────────────────── */
console.log("\nA character with nothing at all is named");
{
  const m = partyMitigationFromActors([pc("A", { race: "Human" }), pc("B", { race: "Human" })], { mix });
  ok("both characters are named as having none",
    m.withoutStatedResponses.length === 2, m.withoutStatedResponses.join(", "));
  ok("...and the multiplier is exactly 1, not a guess", m.multiplier === 1);

  /**
   * ⚠ THE PROSE IS STILL NOT READ. A rule table keyed on a stated class is one thing; scanning a
   * feature's description for the word "resistance" is another, and it is the one that breaks on
   * every homebrew wording. An Illrigger's description mentioning resistance must price nothing.
   */
  const prosey = pc("A", {
    race: "Human", className: "Illrigger",
    tabs: { features: [{ id: "f", label: "Infernal Ward", actionKind: "feature",
      description: "You have resistance to fire damage.",
      metadata: { details: "You have resistance to fire damage." } }] },
  });
  const fromProse = partyMitigationFromActors([prosey], { mix });
  ok("a resistance written only in a description is NOT read",
    fromProse.multiplier === 1 && fromProse.withoutStatedResponses.includes("A"),
    `x${fromProse.multiplier}`);
  ok("mutation: stating the same thing as a field DOES price it",
    partyMitigationFromActors(
      [pc("A", { race: "Human", damageResponses: [{ type: "necrotic", response: "resistant" }] })], { mix },
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
   * ⚠ A BOND IS NOT IN THE REACTION BUDGET — so it never displaces a class reaction.
   *
   * This block used to assert the opposite: a bond worth more "displaces the class one entirely", citing
   * Action Timing row 22. Row 22, read from the v3.3 workbook, lists who competes — "defensive, offensive,
   * opportunity attacks, spell reactions, item reactions, and creature reactions" — and bonds are not on
   * it. r15 makes free/automatic "the default channel for Broken Chain Bond activations", r24 keeps a
   * response "authored as not being a Reaction" off the normal Reaction, and Guardian's Intercept prints
   * "This does not use your reaction." Christopher, 2026-09-15: it "is suppose to consume that bond action."
   */
  const shielded = pc("A", { tabs: { main: [reaction("Spirit Shield", "1d6")] } });   // 3.5
  const full = partyMitigationFromActors([shielded], { damagePerHit: 20 });
  ok("a class reaction counts in FULL — no bond figure can shrink it",
    Math.abs(full.reactionPerRound - 3.5) < 1e-9, `${full.reactionPerRound}/round`);
  ok("...and the function no longer takes a bond figure to contend with",
    partyMitigationFromActors.length <= 2, `arity ${partyMitigationFromActors.length}`);
  ok("the result carries no 'displaced by bond' list",
    !("displacedByBond" in (full as unknown as Record<string, unknown>)));

  const panelSrc = readFileSync(resolve(ROOT, "src/core/encounter-band/EncounterDifficultyPanel.tsx"), "utf8");
  ok("the panel adds bond mitigation AND the class reaction together",
    /mitigationPerRound:\s*bondArrange\.mitigation\s*\+\s*\(classMitigation\?\.reactionPerRound/.test(panelSrc));
  ok("...and passes no bond figure into the class pricer",
    !/bondPerActor/.test(panelSrc));

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
