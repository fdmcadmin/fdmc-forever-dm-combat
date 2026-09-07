/**
 * THE CURRENT PARTY'S OWN R1/R2/R3/R4+ — STEP FOUR, THE GATE ON STEP THREE.
 *   npm run check:party
 *
 * Authority: `broken_chain_checker_runtime_v3_3_slot_resource_budget.xlsx`, `Resource Conversion`.
 * Every assertion below is one of its rows, and each is written so that BREAKING THE RULE FAILS
 * IT — a gate that cannot fail is worse than no gate, so the mutations are half the file.
 *
 *   row 5   "Base DPR must exclude every resource listed below."
 *   row 43  "Use marginal damage above the action that the spell or feature replaces.
 *            Action spells cannot be added on top of the actor's normal Action."
 *   row 44  "The same slot cannot become both damage and healing."
 *   row 45  "Schedule legal resource uses by round, then write R1/R2/R3/R4+.
 *            The daily average is an audit result, not a replacement for round scheduling."
 *
 * and three rulings Christopher gave on 2026-09-07, which are the reason this pass exists:
 *
 *   "the ember heart spends a charge (with a rest recharge)"
 *   "momentum strike has a movement requirement"
 *   "spirit shield has a range it requires but should be considered usable in most fights per round"
 *
 * ⚠ THE EXIT CHECK IS THE LAST THING IN THIS FILE.
 */

import { actorAsCreature } from "../src/core/encounter-band/actorAsCreature";
import { resourceLedgerFromActor, RESOURCE_DAY } from "../src/core/encounter-band/resourceLedger";
import { currentPartyMetrics, targetFromRoster } from "../src/core/encounter-band/currentPartyResolver";

let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};

const resource = (id: string, label: string, kind: string, additive: number, regain?: number | "all") => ({
  id, label, actionKind: "resource", economyCost: [], logMode: "silent",
  metadata: { resourceKind: kind, additive: String(additive), ...(regain !== undefined ? { shortRestRegain: regain } : {}) },
});

/**
 * A sheet carrying one of each shape this pass had to learn to read: a weapon, a levelled smite,
 * an at-will damage rider with a printed movement requirement, and a magic item that spends a
 * charge. The wordings are the live ones, not ones chosen because the code already accepts them.
 */
const base = {
  id: "test", kind: "player", name: "Test PC", level: 9,
  attacksPerAction: 2,
  stats: { ac: 18, hp: { current: 80, max: 80 }, speed: "30 ft." },
  abilityScores: { str: { score: 20 }, dex: { score: 12 }, con: { score: 16 },
    int: { score: 10 }, wis: { score: 12 }, cha: { score: 16 } },
  tabs: {
    main: [
      { id: "sword", label: "Longsword", actionKind: "attack", economyCost: ["main"], logMode: "default",
        metadata: { attack: "1d20+@STR+@PROF", damage: "1d8+@STR", damageType: "Slashing" } },
      { id: "dagger", label: "Dagger", actionKind: "attack", economyCost: ["main"], logMode: "default",
        metadata: { attack: "1d20+@DEX+@PROF", damage: "1d4+@DEX", damageType: "Piercing" } },
      // Damage, no roll of its own, no cost — a rider, and it prints a movement requirement.
      { id: "momentum", label: "Momentum Strike", actionKind: "feature", economyCost: [], logMode: "default",
        metadata: { damage: "1d6", damageType: "Bludgeoning",
          details: "If you move at least 10 feet toward the target, your first hit this turn deals an extra 1d6 damage." } },
    ],
    spells: [
      { id: "smite", label: "Divine Smite", actionKind: "spell", economyCost: [], logMode: "default",
        metadata: { damage: "2d8", spellLevel: 1, details: "On a hit, expend a slot." } },
    ],
    equipment: [
      { id: "atk-heart", label: "Wendigo Ember Heart", actionKind: "attack", economyCost: ["main"], logMode: "default",
        metadata: { damage: "3d6", damageType: "Cold", saveDc: "CON DC 13",
          charges: { max: 1, reset: "manual", note: "Recharges at dawn" },
          details: "Devouring Cold (1/day; recharges at dawn)." } },
    ],
    resources: [
      resource("slots1", "Spell Slots L1", "spellSlot", 4),
      resource("hd", "Hit Dice (d10)", "pool", 9),
    ],
  },
} as never;

/** A three-body fight to swing at. AC 15 so a miss is possible and the numbers move. */
const roster = [
  { template: { stats: { ac: 15 }, abilities: [
    { label: "STR", value: "16 (+3)" }, { label: "DEX", value: "12 (+1)" },
    { label: "CON", value: "14 (+2)" }, { label: "INT", value: "10 (+0)" },
    { label: "WIS", value: "12 (+1)" }, { label: "CHA", value: "10 (+0)" }] }, quantity: 3 },
];
const target = targetFromRoster(roster as never, 1)!;

console.log("The party's own rounds, scheduled from its own sheets\n");

/* ── 1. The target is the fight, not the party ───────────────────────────────────────────── */
console.log("The party swings at the roster, not at itself");
{
  ok("the roster's AC is what the party rolls against", target.ac === 15, `AC ${target.ac}`);
  ok("...and its saves are the bodies' own modifiers",
    Math.abs(target.saves.con - 2) < 1e-9 && Math.abs(target.saves.str - 3) < 1e-9,
    `CON +${target.saves.con}, STR +${target.saves.str}`);
  ok("an empty roster gives no target rather than a default one",
    targetFromRoster([], 4) === null);
}

/* ── 2. An item charge is a resource the ledger can size ─────────────────────────────────── */
console.log("\nAn item pool is counted, and its reset is the item's own word");
{
  const { creature, spends } = actorAsCreature(base);
  const names = (creature.actions ?? []).map(a => a.name);
  ok("the item is NOT in the at-will base (row 5)", !names.includes("Wendigo Ember Heart"),
    names.join(", "));
  const heart = spends.find(s => s.label === "Wendigo Ember Heart");
  ok("...it is handed to the ledger with a pool KEY, not just a flag",
    Boolean(heart?.chargeKey), `chargeKey=${heart?.chargeKey}`);

  const led = resourceLedgerFromActor(base);
  const row = led.rows.find(r => r.chargeKey === heart?.chargeKey);
  ok("the ledger has a row for it", Boolean(row), led.rows.map(r => r.resource).join(", "));
  /**
   * ⚠ "RECHARGES AT DAWN" IS ONE USE ACROSS THE WHOLE DAY, NOT ONE PER FIGHT. The day is five
   * fights and one Short Rest; a manual/dawn reset recovers at neither.
   */
  ok("a dawn reset is ONE use across all five fights", row?.totalUses === 1,
    `${row?.startUses} + ${row?.recoveredPerShortRest}/rest + ${row?.recoveredPerFight}/fight = ${row?.totalUses}`);
  ok("...and all of it is offence, because that is what the item does",
    row?.offense === 1 && row?.sustain === 0, `${row?.offense} off / ${row?.sustain} sus`);

  /** ⚠ MUTATION: change the reset and the count must move, or the field is not being read. */
  const shortRest = JSON.parse(JSON.stringify(base));
  shortRest.tabs.equipment[0].metadata.charges.reset = "shortRest";
  const srRow = resourceLedgerFromActor(shortRest).rows.find(r => r.kind === "itemCharge");
  ok("mutation: a shortRest reset recovers at the one scheduled rest",
    srRow?.totalUses === 2, `${srRow?.totalUses} uses`);

  const perFight = JSON.parse(JSON.stringify(base));
  perFight.tabs.equipment[0].metadata.charges.reset = "encounter";
  const efRow = resourceLedgerFromActor(perFight).rows.find(r => r.kind === "itemCharge");
  ok("mutation: an encounter reset gives one use per fight",
    efRow?.totalUses === RESOURCE_DAY.fightsPerLongRest, `${efRow?.totalUses} uses`);

  /** Allocate-once must survive every one of those. */
  for (const [name, r] of [["dawn", row], ["shortRest", srRow], ["encounter", efRow]] as const) {
    ok(`${name}: allocates exactly what it has (row 44)`,
      Boolean(r) && Math.abs(r!.offense + r!.sustain + r!.other - r!.totalUses) < 1e-9,
      `${r?.offense}+${r?.sustain}+${r?.other} of ${r?.totalUses}`);
  }
}

/* ── 3. Free damage with no roll is a rider, not a dropped line ──────────────────────────── */
console.log("\nAt-will damage with no roll of its own rides the best attack");
{
  const { creature, unreadable, assumptions } = actorAsCreature(base);
  ok("nothing damaging was dropped as unreadable", unreadable.length === 0, unreadable.join(" | "));
  const sword: any = (creature.actions ?? []).find(a => a.name === "Longsword");
  const dagger: any = (creature.actions ?? []).find(a => a.name === "Dagger");
  ok("the rider is attached to the BEST attack, not the first one",
    (sword?.riders ?? []).some((r: any) => r.name === "Momentum Strike")
    && (dagger?.riders ?? []).length === 0,
    `sword ${(sword?.riders ?? []).length}, dagger ${(dagger?.riders ?? []).length}`);
  ok("...at once-per-turn, not per-hit",
    (sword?.riders ?? [])[0]?.cadence === "once-per-turn", (sword?.riders ?? [])[0]?.cadence);

  /**
   * ⚠ THE PRINTED REQUIREMENT IS ESTIMATED, NOT NEEDS-INPUT. `Pricing Resolver` rows 50 and 56
   * only reprice reach "when terrain and ranges make the movement relevant", and the checker has
   * no terrain — so it is counted as met and the assumption is stated where it can be argued with.
   */
  ok("its movement requirement is recorded as a stated assumption",
    assumptions.some(a => /Momentum Strike/.test(a) && /counted as met/.test(a)),
    assumptions.join(" | "));

  /** ⚠ MUTATION: take the rider away and R1 must fall, or it was never being counted. */
  const withRider = currentPartyMetrics([base], target)!;
  const stripped = JSON.parse(JSON.stringify(base));
  stripped.tabs.main = stripped.tabs.main.filter((a: any) => a.id !== "momentum");
  const without = currentPartyMetrics([stripped], target)!;
  ok("mutation: removing the rider lowers round 1",
    withRider.round1Dpr > without.round1Dpr + 0.5,
    `${withRider.round1Dpr.toFixed(2)} vs ${without.round1Dpr.toFixed(2)}`);

  /** A character with no attack has nothing for it to ride, and must SAY so. */
  const noWeapon = JSON.parse(JSON.stringify(base));
  noWeapon.tabs.main = noWeapon.tabs.main.filter((a: any) => a.id === "momentum");
  ok("a rider with no attack to ride is reported, not silently kept",
    actorAsCreature(noWeapon).unreadable.some(u => /no at-will attack for it to ride/.test(u)),
    actorAsCreature(noWeapon).unreadable.join(" | "));
}

/* ── 4. Round scheduling, not a flat daily average ───────────────────────────────────────── */
console.log("\nResource uses are placed in rounds (row 45)");
{
  const m = currentPartyMetrics([base], target)!;
  ok("the at-will floor is under every round", m.atWill.round1 > 0,
    `at-will ${m.atWill.round1.toFixed(2)}`);
  ok("resource uses were actually scheduled", m.schedule.length > 0,
    m.schedule.map(s => `R${s.round} ${s.action}`).join(", "));

  /** ⚠ BEST FIRST. The profile must DECLINE, which is the shape the certified rows have. */
  ok("round 1 is the party's best round", m.round1Dpr > m.round4PlusDpr,
    `R1 ${m.round1Dpr.toFixed(2)} → R4+ ${m.round4PlusDpr.toFixed(2)}`);
  ok("...and every use sits in its own round, one per round",
    new Set(m.schedule.map(s => `${s.actor}|${s.round}`)).size === m.schedule.length,
    m.schedule.map(s => `R${s.round}`).join(","));

  /**
   * ⚠ THE AUDIT FIGURE IS NOT THE ROUND PROFILE, and this is the assertion that says so. A flat
   * `damage/day ÷ 25` uplift would make every round equal; the schedule must not produce that.
   */
  const flat = m.audit.flatUpliftPerRound;
  const upliftR1 = m.round1Dpr - m.atWill.round1;
  const upliftR4 = m.round4PlusDpr - m.atWill.round4Plus;
  ok("the daily average is reported apart from the rounds", flat > 0, `${flat.toFixed(2)}/round`);
  ok("...and the rounds did NOT all receive the same uplift",
    Math.abs(upliftR1 - upliftR4) > 1e-6,
    `R1 +${upliftR1.toFixed(2)} vs R4+ +${upliftR4.toFixed(2)}`);
  ok("...and neither round received the flat daily figure",
    Math.abs(upliftR1 - flat) > 1e-6,
    `R1 +${upliftR1.toFixed(2)} vs flat ${flat.toFixed(2)}`);
}

/* ── 4b. The item charge reaches a round when it is worth taking ─────────────────────────── */
console.log("\nAn item charge is scheduled, not just counted");
{
  /**
   * ⚠ THE LEDGER ROW IS ONLY HALF THE PROOF. The Ember Heart as printed is 3d6 on a save, which is
   * WORSE than two weapon swings — so row 43 prices it at zero and it correctly never schedules.
   * That is the right answer and it is also indistinguishable from the old bug, where the item was
   * excluded from the base and then found no row at all. Make it plainly worth taking and it must
   * appear, which is the only thing that separates "priced at zero" from "never priced".
   */
  const strong = JSON.parse(JSON.stringify(base));
  strong.tabs.equipment[0].metadata.damage = "30d6";
  const m = currentPartyMetrics([strong], target)!;
  const use = m.schedule.find(s => s.action === "Wendigo Ember Heart");
  ok("a charge worth spending is placed in a round", Boolean(use),
    m.schedule.map(s => `R${s.round} ${s.action}`).join(", "));
  /** One dawn charge over five fights is a fifth of a use per fight — not one, and not none. */
  ok("...at the day's allocation spread over the day, not once per fight",
    Boolean(use) && Math.abs(use!.usesPerFight - 1 / RESOURCE_DAY.fightsPerLongRest) < 1e-9,
    `${use?.usesPerFight.toFixed(2)} uses/fight`);

  /** ⚠ AND SAVE-FOR-HALF IS READ, NEVER ASSUMED — both directions asserted. */
  const half = JSON.parse(JSON.stringify(strong));
  half.tabs.equipment[0].metadata.successDamage = "half";
  const halfUse = currentPartyMetrics([half], target)!.schedule.find(s => s.action === "Wendigo Ember Heart");
  ok("an authored save-for-half is worth more than all-or-nothing",
    Boolean(halfUse) && halfUse!.valuePerUse > use!.valuePerUse,
    `half ${halfUse?.valuePerUse.toFixed(2)} vs none ${use?.valuePerUse.toFixed(2)}`);
  ok("...and a save with NO printed success damage is not silently halved",
    Math.abs(use!.valuePerUse - halfUse!.valuePerUse) > 1e-6);
}

/* ── 5. Marginal value, in both directions (row 43) ──────────────────────────────────────── */
console.log("\nWhat a use is worth is what it costs to take");
{
  /**
   * ⚠ AN ACTION SPELL GIVES UP THE ROUTINE; A BONUS ACTION SPELL GIVES UP NOTHING. Charging the
   * routine to a Bonus Action spell prices it below what it is worth, and row 43 only covers the
   * Action case — the converse is `economyCost`, which the sheets already carry.
   */
  const mk = (economyCost: string[]) => {
    const a = JSON.parse(JSON.stringify(base));
    a.tabs.spells = [{ id: "bolt", label: "Guiding Bolt", actionKind: "spell", economyCost, logMode: "default",
      metadata: { damage: "4d6", attack: "1d20+@SPELL", spellLevel: 1 } }];
    return currentPartyMetrics([a], target)!;
  };
  const asAction = mk(["main"]);
  const asBonus = mk(["bonus"]);
  ok("a Bonus Action spell is worth more than the same spell as an Action",
    asBonus.round1Dpr > asAction.round1Dpr,
    `bonus R1 ${asBonus.round1Dpr.toFixed(2)} vs action R1 ${asAction.round1Dpr.toFixed(2)}`);

  /** The rider case: expended only after the hit lands, so it is NOT discounted again. */
  const m = currentPartyMetrics([base], target)!;
  const smite = m.schedule.find(s => s.action === "Divine Smite");
  ok("a rider is priced at its full damage, not at hit chance x damage",
    Boolean(smite) && Math.abs(smite!.valuePerUse - 9) < 1e-9,
    `Divine Smite ${smite?.valuePerUse.toFixed(2)} (2d8 = 9)`);
}

/* ── 6. A spend nothing can size is REPORTED, never silently zero ────────────────────────── */
console.log("\nA resource the ledger cannot size is named, not dropped");
{
  const orphan = JSON.parse(JSON.stringify(base));
  orphan.tabs.spells.push({ id: "mystery", label: "Mystery Blast", actionKind: "spell",
    economyCost: ["main"], logMode: "default",
    metadata: { damage: "6d6", attack: "1d20+@SPELL", spellLevel: 7 } });
  const m = currentPartyMetrics([orphan], target)!;
  ok("a level 7 spell on a sheet with no level 7 slots is reported",
    m.needsInput.some(n => /Mystery Blast/.test(n) && /cannot size/.test(n)),
    m.needsInput.join(" | "));

  /**
   * ⚠ AND A TIER THAT LEGITIMATELY ALLOCATED NOTHING TO OFFENCE MUST STAY QUIET. Collapsing the
   * two is how the Ember Heart vanished; conflating them the other way would cry wolf on every
   * healer.
   */
  const healer = JSON.parse(JSON.stringify(base));
  healer.tabs.spells = [{ id: "cure", label: "Cure Wounds", actionKind: "spell",
    economyCost: ["main"], logMode: "default",
    metadata: { damage: "2d8+@CHA", spellLevel: 1, details: "Touch a creature to restore 2d8+3 hit points." } }];
  const h = currentPartyMetrics([healer], target)!;
  ok("a healing-only tier says nothing — it allocated correctly",
    !h.needsInput.some(n => /Cure Wounds/.test(n)), h.needsInput.join(" | "));
}

console.log(failures === 0 ? "\nAll assertions passed." : `\n${failures} assertion(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
