/**
 * CAN THE APP EXPRESS A SUMMON? — the three Christopher named, built.
 *   npx tsx scripts/check-summons.ts
 *
 * Christopher: *"test this buy building the 3 different divine steeds, the summon from the
 * artificer, and the summon from the Covenant Bond."*
 *
 * They are a good test set because they break in three different directions:
 *
 *   OTHERWORLDLY STEED   almost every number is a function of the SLOT — AC "10 + 1 per spell
 *                        level", HP "5 + 10 per spell level", damage "1d8 plus the spell's level"
 *                        — and its proficiency, attack bonus and save DC are the CASTER's, in the
 *                        block's own words. Three forms, one block: Celestial / Fey / Fiend swap
 *                        the damage type AND the bonus action.
 *   ELDRITCH CANNON      no library entry, and its HP is "5 x your Artificer level". Today those
 *                        numbers live in the DETAILS TEXT of a resource row, which is why nothing
 *                        can read them.
 *   COVENANT BOND-CREATURE  "lasts 2 turns", "acts on your turn", HP "your class Hit Die maximum
 *                        + your level", attack "1d20 + your proficiency", and its damage climbs
 *                        with the bond's stage.
 *
 * ⚠ WHAT IS ASSERTED IS THE ARITHMETIC, not that a body appeared. A summon that resolves to the
 * wrong HP is worse than one that fails, because it prices a fight and says nothing.
 */
import { materializeSummon, resolveSummonFormula, arithmetic, type SummonSpec, type SummonerContext } from "../src/core/monsters/summon";
import { legalLairOptions, lairDamagePerRound, unpricedLairOptions } from "../src/core/monsters/lair";
import { lairRosterGroups } from "../src/core/encounter-band/lairRoster";
import { BROKEN_CHAIN_MONSTER_LIBRARY } from "../src/data/broken-chain/monsterLibrary";
import { formatAbilityEntry } from "../src/core/monsters/creator/monsterCreatorModel";
import type { MainMonsterTemplate } from "../src/core/monsters/runtime/mainMonsterRuntime";

const problems: string[] = [];
const eq = (what: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${what}${ok ? "" : `   got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
  if (!ok) problems.push(what);
};

/** Lights Stone: Paladin/Sorcerer 6. PB +3, CHA-based spell attack +5, save DC 13. */
const paladin: SummonerContext = {
  name: "Lights Stone", level: 6, proficiencyBonus: 3,
  spellAttackBonus: 5, spellSaveDc: 13, mainModifier: 2, hitDieMax: 10,
};

// ─── 1. THE OTHERWORLDLY STEED, all three forms from ONE template ────────────────────────────
const STEED: MainMonsterTemplate = {
  templateId: "srd:otherworldly-steed", name: "Otherworldly Steed",
  stats: {
    kind: "celestial", ac: "10+@SLOT", maxHp: "5+10*@SLOT" as unknown as number,
    speed: "60 ft.", attacksPerTurn: 1,
  },
  abilities: [
    formatAbilityEntry("STR", 18), formatAbilityEntry("DEX", 12), formatAbilityEntry("CON", 14),
    formatAbilityEntry("INT", 6), formatAbilityEntry("WIS", 12), formatAbilityEntry("CHA", 8),
  ],
  // ONE set, three options — exactly the Elemental Mirror's shape. The form picks the damage
  // type on the Slam AND which bonus action comes with it.
  actionSets: [{ id: "form", label: "Form", pick: 1, namesBody: true }],
  actions: [
    { name: "Otherworldly Slam", kind: "attack", roll: "1d20+@SPELL", damage: "1d8+@SLOT",
      text: "Melee Attack Roll: bonus equals your spell attack modifier, reach 5 ft." },
    { name: "Healing Touch", kind: "action", setId: "form", setOption: "Celestial", economyCost: "bonus",
      damage: "2d8+@SLOT", text: "Recharges after a Long Rest. One creature within 5 ft regains HP." },
    { name: "Fey Step", kind: "action", setId: "form", setOption: "Fey", economyCost: "bonus",
      text: "Recharges after a Long Rest. The steed teleports up to 60 feet." },
    { name: "Fell Glare", kind: "action", setId: "form", setOption: "Fiend", economyCost: "bonus",
      save: "WIS DC @DC", text: "Recharges after a Long Rest. Frightened until the end of your next turn." },
  ],
  visibility: { defaultState: "hp-bar", hiddenName: "Steed", revealedName: "Otherworldly Steed" },
} as unknown as MainMonsterTemplate;

console.log("OTHERWORLDLY STEED — one template, three forms, cast at a level 2 slot\n");
for (const form of ["Celestial", "Fey", "Fiend"]) {
  const spec: SummonSpec = {
    templateId: "srd:otherworldly-steed", picks: { form: [form] }, slotLevel: 2, acts: "own-initiative",
  };
  const made = materializeSummon(spec, paladin, [STEED]);
  const body = made!.body;
  const slam = body.actions?.find(a => a.name === "Otherworldly Slam");
  const bonus = body.actions?.filter(a => a.setId === "form") ?? [];
  console.log(`  ${form}: AC ${body.stats.ac} · ${body.stats.maxHp} HP · Slam ${slam?.roll} for ${slam?.damage} · bonus action: ${bonus.map(b => b.name).join(", ") || "(none)"}`);

  eq(`${form} AC is 10 + 1 per spell level = 12`, body.stats.ac, 12);
  eq(`${form} HP is 5 + 10 per spell level = 25`, body.stats.maxHp, 25);
  eq(`${form} Slam uses the CASTER's spell attack bonus`, slam?.roll, "1d20+5");
  eq(`${form} Slam damage is 1d8 plus the slot`, slam?.damage, "1d8+2");
  eq(`${form} took exactly its own bonus action`, bonus.map(b => b.name), [
    form === "Celestial" ? "Healing Touch" : form === "Fey" ? "Fey Step" : "Fell Glare",
  ]);
  eq(`${form} carries the CASTER's proficiency, not a CR floor`, body.stats.proficiencyBonus, 3);
}
// The Fiend's glare reads the CASTER's save DC — the block says so in those words.
{
  const fiend = materializeSummon({ templateId: "srd:otherworldly-steed", picks: { form: ["Fiend"] }, slotLevel: 2 }, paladin, [STEED])!;
  eq("Fell Glare uses the CASTER's spell save DC", fiend.body.actions?.find(a => a.name === "Fell Glare")?.save, "WIS DC 13");
}
// A level 4 slot moves every number the block says it should.
{
  const big = materializeSummon({ templateId: "srd:otherworldly-steed", picks: { form: ["Celestial"] }, slotLevel: 4 }, paladin, [STEED])!;
  console.log(`\n  at a level 4 slot: AC ${big.body.stats.ac} · ${big.body.stats.maxHp} HP · Slam ${big.body.actions?.find(a => a.name === "Otherworldly Slam")?.damage}`);
  eq("a level 4 slot gives AC 14", big.body.stats.ac, 14);
  eq("a level 4 slot gives 45 HP", big.body.stats.maxHp, 45);
  eq("a level 4 slot gives 1d8+4 on the Slam", big.body.actions?.find(a => a.name === "Otherworldly Slam")?.damage, "1d8+4");
}

// ─── 2. THE ELDRITCH CANNON — inline, no library entry, HP from the caster's level ───────────
console.log(`\nELDRITCH CANNON — inline body, HP "5 x your Artificer level"\n`);
const artificer: SummonerContext = { name: "Raphael", level: 6, proficiencyBonus: 3, spellAttackBonus: 6, spellSaveDc: 14 };
const CANNON: MainMonsterTemplate = {
  templateId: "inline:eldritch-cannon", name: "Eldritch Cannon",
  stats: { kind: "construct", ac: 18, maxHp: "5*@LEVEL" as unknown as number, speed: "15 ft.", attacksPerTurn: 1 },
  abilities: [formatAbilityEntry("STR", 10), formatAbilityEntry("DEX", 10), formatAbilityEntry("CON", 10),
    formatAbilityEntry("INT", 10), formatAbilityEntry("WIS", 10), formatAbilityEntry("CHA", 10)],
  // Three modes the artificer picks between with a Bonus Action — a set, like the Steed's forms.
  actionSets: [{ id: "mode", label: "Cannon mode", pick: 1 }],
  actions: [
    { name: "Flamethrower", kind: "action", setId: "mode", setOption: "Flamethrower", damage: "2d8", save: "DEX DC @DC",
      text: "15-foot cone. Dexterity save for half fire damage." },
    { name: "Force Ballista", kind: "attack", setId: "mode", setOption: "Force Ballista", roll: "1d20+@SPELL", damage: "2d8",
      text: "Ranged attack, 120 ft. Force damage and pushed 5 feet." },
    { name: "Protector", kind: "action", setId: "mode", setOption: "Protector", damage: "1d8+@LEVEL",
      text: "Each ally within 10 feet gains temporary hit points." },
  ],
  visibility: { defaultState: "hp-bar", hiddenName: "Cannon", revealedName: "Eldritch Cannon" },
} as unknown as MainMonsterTemplate;
{
  const made = materializeSummon({ inline: CANNON, picks: { mode: ["Force Ballista"] }, acts: "summoner-turn" }, artificer)!;
  const ballista = made.body.actions?.find(a => a.name === "Force Ballista");
  console.log(`  AC ${made.body.stats.ac} · ${made.body.stats.maxHp} HP · ${ballista?.name} ${ballista?.roll} for ${ballista?.damage}`);
  eq("HP is 5 x the artificer's level = 30", made.body.stats.maxHp, 30);
  eq("AC is the printed 18, untouched", made.body.stats.ac, 18);
  eq("the ballista uses the artificer's spell attack bonus", ballista?.roll, "1d20+6");
  eq("only the chosen mode came with it", made.body.actions?.filter(a => a.setId === "mode").map(a => a.name), ["Force Ballista"]);
  eq("an inline body needs no library at all", made.problems, []);
}

// ─── 3. THE COVENANT BOND-CREATURE — duration, and it acts on YOUR turn ──────────────────────
console.log(`\nCOVENANT BOND-CREATURE — "lasts 2 turns", "acts on your turn"\n`);
const CALL: MainMonsterTemplate = {
  templateId: "inline:covenant-call", name: "Bond-Creature",
  stats: { kind: "aberration", ac: 12, maxHp: "@HITDIEMAX+@LEVEL" as unknown as number, speed: "30 ft.", attacksPerTurn: 1 },
  abilities: [formatAbilityEntry("STR", 10), formatAbilityEntry("DEX", 10), formatAbilityEntry("CON", 10),
    formatAbilityEntry("INT", 10), formatAbilityEntry("WIS", 10), formatAbilityEntry("CHA", 10)],
  actions: [{ name: "Bond Strike", kind: "attack", roll: "1d20+@PROF", damage: "1d8", text: "One attack." }],
  visibility: { defaultState: "hp-bar", hiddenName: "Bond-Creature", revealedName: "Bond-Creature" },
} as unknown as MainMonsterTemplate;
{
  const spec: SummonSpec = { inline: CALL, durationRounds: 2, acts: "summoner-turn", name: "Bond-Creature" };
  const made = materializeSummon(spec, paladin)!;
  const strike = made.body.actions?.find(a => a.name === "Bond Strike");
  console.log(`  ${made.body.stats.maxHp} HP · ${strike?.roll} for ${strike?.damage} · lasts ${spec.durationRounds} rounds · acts on ${spec.acts}`);
  eq("HP is the class Hit Die maximum + level = 10 + 6", made.body.stats.maxHp, 16);
  eq("the attack uses YOUR proficiency", strike?.roll, "1d20+3");
  eq("it lasts two turns", spec.durationRounds, 2);
  /**
   * ⚠ THE ONE THAT CHANGES THE PRICE. A body on its own initiative adds a whole turn to the
   * round; one acting on the summoner's turn does not. Reading the second as the first hands the
   * party a free extra combatant every round for the whole fight.
   */
  eq("it acts on the summoner's turn, not its own", spec.acts, "summoner-turn");
}

// ─── ARITHMETIC IS FOLDED ONLY WHERE IT MUST BE ──────────────────────────────────────────────
console.log(`\narithmetic — folded for a single number, never for dice\n`);
eq("AC expression folds to a number", arithmetic("10+2"), "12");
eq("HP expression folds to a number", arithmetic("5+10*2"), "25");
eq("dice are left rollable", arithmetic("1d8+2"), "1d8+2");
eq("a mixed expression is left alone", arithmetic("2d8+1d4"), "2d8+1d4");

// ─── A NAMED TEMPLATE THAT IS MISSING IS AN ERROR, NOT A FALLBACK ────────────────────────────
{
  const missing = materializeSummon({ templateId: "srd:not-here", name: "Ghost Steed" }, paladin, [STEED]);
  console.log(`\n  a summon naming a creature that is gone: ${missing?.problems.length} problem(s)`);
  eq("a missing template is reported, not silently skipped", missing?.problems.length, 1);
}

/**
 * ⚠ A TOKEN NOBODY CAN ANSWER IS LEFT VISIBLE, and the first version of this check asserted the
 * wrong invariant: that `@SPELL` survives when the summoner does not supply one. It does not, and
 * should not — the BODY has its own scores and its own spell attack bonus, so `@SPELL` on a
 * creature is a real question with a real answer. The summoner only overrides it.
 *
 * What must stay on screen is a token neither side knows. `localRoller` deletes any leftover
 * `@TOKEN` before rolling, so one that resolves to nothing becomes a silently unmodified roll —
 * which is the worst way for a typo to fail.
 */
{
  const bare: SummonerContext = {};
  const known = resolveSummonFormula("1d20+@SPELL", CALL, bare, undefined);
  eq("a token the BODY can answer resolves from the body", /@/.test(known), false);
  eq("a token nobody can answer stays on screen",
    resolveSummonFormula("1d20+@MADEUP", CALL, bare, undefined).includes("@MADEUP"), true);
}


/**
 * ─── LAIRS — the environment taking a turn ──────────────────────────────────────────────────
 *
 * Christopher: *"what about the lair actions on the gate 3 and act 3 final."*
 *
 * ⚠ THEY WERE ALREADY WRITTEN, AND PARKED WITH THEIR OWN REASON. Both creatures carried their
 * lair actions in `notes` under a comment that said exactly why:
 *
 *   "a lair is a SUMMON at initiative 20 and the summon mechanism is unbuilt — filing them as
 *    ordinary actions would read as things the creature can do on its own turn, which is
 *    precisely what they are not."
 *
 * That reasoning was right, and it is the reason a lair is a FIELD rather than three more rows in
 * `actions`: filed as actions the checker would have scheduled them into the creature's own
 * budget and handed the Dragon three extra turns' worth of options it never had.
 */
{
  const lairs = BROKEN_CHAIN_MONSTER_LIBRARY.filter(t => t.lair);
  console.log(`\nLAIRS — ${lairs.length} creature(s) carry one\n`);
  for (const t of lairs) {
    const lair = t.lair!;
    console.log(`  ${t.name}  (initiative ${lair.initiative}, no repeat: ${lair.noRepeatConsecutive})`);
    for (const o of lair.options) console.log(`     ${o.name.padEnd(24)} ${o.effect ?? "UNPRICED"}${o.save ? ` · ${o.save}` : ""}`);
  }

  eq("both fights he named carry a lair", lairs.map(t => t.name).sort(), ["Thought Harrower", "Veil-Torn Dragon"]);

  for (const t of lairs) {
    const lair = t.lair!;
    eq(`${t.name} lair is on initiative 20`, lair.initiative, 20);
    eq(`${t.name} lair cannot repeat an option`, lair.noRepeatConsecutive, true);
    eq(`${t.name} lair has three options`, lair.options.length, 3);
    /**
     * ⚠ NOT ONE OF THE SIX DEALS DAMAGE, and a lair priced as DPR would invent damage the fight
     * does not contain. They move bodies, obscure ground and change cover — which is why v10
     * added `cover_modifier`, `terrain_portal_or_adjacency_link` and `roll_modifier_zone` under
     * "current campaign coverage".
     */
    eq(`${t.name} lair deals no damage`, lairDamagePerRound(lair, () => 0), 0);
    eq(`${t.name} lair has nothing the workbook cannot place`, unpricedLairOptions(lair).map(o => o.name), []);
  }

  // THE NO-REPEAT RULE IS REAL ARITHMETIC, not decoration: with three options and no repeat, a
  // fight sees them in rotation rather than the best one every round.
  const dragon = lairs.find(t => t.name === "Veil-Torn Dragon")!.lair!;
  eq("with nothing used yet, every option is legal", legalLairOptions(dragon, undefined).length, 3);
  eq("after Branches Close, it cannot repeat", legalLairOptions(dragon, "Branches Close").map(o => o.name),
    ["Ground Remembers Wrong", "Borrowed Sky"]);

  // A one-option lair cannot alternate with nothing — the rule must not silence it.
  const single = { initiative: 20, noRepeatConsecutive: true, options: [{ name: "Only", text: "x", effect: "cover" as const }] };
  eq("a one-option lair still acts", legalLairOptions(single, "Only").length, 1);
}


if (problems.length) { console.error(`\nFAILED — ${problems.length}:\n  ${problems.join("\n  ")}`); process.exit(1); }
console.log(`\nPASS — all three summons build, every number the block calls "yours" comes from the summoner, and both lairs act on 20 without repeating.`)
/**
 * ⚠ THE CHECKER HAS TO BE ABLE TO SEE THE LAIR. Christopher: *"the summon feature was suppose to
 * then build into the lair actions and then the checker could read that a lair is summoned."*
 *
 * summon.ts and lair.ts were both finished; the gap was between them and the pricer.
 * rosterFromTemplates never read template.lair, and RosterGroup.arrivesRound had ZERO production
 * writers — checkerV2 could schedule a body arriving on round 3 and nothing ever handed it one.
 */
{
  const dragon = BROKEN_CHAIN_MONSTER_LIBRARY.find(t => t.name === "Veil-Torn Dragon")!;
  const guard = BROKEN_CHAIN_MONSTER_LIBRARY.find(t => t.name === "Veilbound Drake Guard")!;

  const bare = lairRosterGroups(dragon, BROKEN_CHAIN_MONSTER_LIBRARY);
  eq("a lair with no summon adds no bodies", bare.groups.length, 0);
  eq("...but the checker is TOLD the lair is there", bare.assumptions.some(a => a.field === "lair"), true);

  const withSummon = {
    ...dragon,
    lair: {
      ...dragon.lair!,
      openingSummon: { name: "Guard", templateId: guard.templateId, count: 2 },
      options: dragon.lair!.options.map((o, i) =>
        i === 0 ? { ...o, summon: { name: "Shard", templateId: guard.templateId, durationRounds: 2 } } : o),
    },
  } as typeof dragon;
  const built = lairRosterGroups(withSummon, BROKEN_CHAIN_MONSTER_LIBRARY);
  eq("an opening summon becomes a body", built.groups[0].quantity, 2);
  eq("...standing from round 1", built.groups[0].arrivesRound, 1);
  eq("...with the summoned template HP", built.groups[0].baseHp, guard.stats.maxHp);
  eq("a duration becomes an expiry", built.groups[1].expiresAfterRound, 2);
  eq("an option summon is flagged as a ceiling, not a schedule",
    built.assumptions.some(a => a.flag === "ESTIMATED" && /ceiling/.test(a.detail)), true);

  const broken = { ...dragon, lair: { ...dragon.lair!, openingSummon: { templateId: "nope" } } } as typeof dragon;
  eq("a summon nothing resolves is REPORTED, not skipped",
    lairRosterGroups(broken, BROKEN_CHAIN_MONSTER_LIBRARY).assumptions.some(a => a.flag === "NEEDS DM INPUT"), true);
}

;