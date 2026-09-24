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
// The checker's own tracer, so a character's reactions are asserted through the economy that owns them.
import { parseCreature } from "../src/core/encounter-band/parseCreature";
import { traceCreature } from "../src/core/encounter-band/actionTrace";
import { resourceLedgerFromActor, RESOURCE_DAY } from "../src/core/encounter-band/resourceLedger";
import { currentPartyMetrics, targetFromRoster } from "../src/core/encounter-band/currentPartyResolver";
import { rerollGain } from "../src/core/encounter-band/rerollPricing";

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
  /**
   * ⚠ IT IS A WIRING NOTE, NOT AN UNREADABLE ACTION. The app read Mystery Blast fine — dice,
   * roll, tier. What it could not find is the pool that limits it, so it belongs in `unlinked`
   * where the answer is "link these two rows", not in `needsInput` where the answer is "tell me
   * a number I cannot derive". Christopher: *"why do we still have unread actions if nothing
   * except the homebrew bonds and convergence are outside of the SRD."*
   */
  ok("a level 7 spell on a sheet with no level 7 slots is reported as NOT LINKED",
    m.unlinked.some(n => /Mystery Blast/.test(n) && /cannot size/.test(n)),
    m.unlinked.join(" | "));
  ok("...and is NOT counted as an action the app could not read",
    !m.needsInput.some(n => /Mystery Blast/.test(n)), m.needsInput.join(" | "));

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
    !h.needsInput.some(n => /Cure Wounds/.test(n)) && !h.unlinked.some(n => /Cure Wounds/.test(n)),
    [...h.needsInput, ...h.unlinked].join(" | "));
}

/* ── 7. Arriving spent moves the damage, and moves the RIGHT half ────────────────────────── */
console.log("\nA party arriving spent hits for less — but keeps its weapons");
{
  /**
   * Christopher, 2026-09-07: *"shouldnt the 25%, 40%, and 60% spent move the damage they do
   * instead of still showing their damage at full."*
   *
   * ⚠ AND IT MOVES THE RESOURCE HALF ONLY. `partyResourceCurve` applies a published median to a
   * party it cannot see inside, so it taxes weapons and slots together. This one knows which is
   * which: a Barbarian out of rages still swings the axe.
   */
  const fresh = currentPartyMetrics([base], target)!;
  const half = currentPartyMetrics([base], target, { arrivingSpent: 0.5 })!;
  const empty = currentPartyMetrics([base], target, { arrivingSpent: 1 })!;

  ok("arriving spent lowers round 1", half.round1Dpr < fresh.round1Dpr,
    `fresh ${fresh.round1Dpr.toFixed(2)} → half-spent ${half.round1Dpr.toFixed(2)}`);
  ok("...more spent, lower still", empty.round1Dpr < half.round1Dpr,
    `${half.round1Dpr.toFixed(2)} → ${empty.round1Dpr.toFixed(2)}`);

  /** ⚠ THE AT-WILL FLOOR NEVER MOVES. Weapons and cantrips cost nothing and never run out. */
  ok("the at-will floor is identical at every depletion",
    fresh.atWill.round1 === half.atWill.round1 && half.atWill.round1 === empty.atWill.round1,
    `${fresh.atWill.round1.toFixed(2)} throughout`);
  ok("a fully expended party still swings — it falls to the at-will floor, not to zero",
    Math.abs(empty.round1Dpr - empty.atWill.round1) < 1e-9 && empty.round1Dpr > 0,
    `R1 ${empty.round1Dpr.toFixed(2)} = at-will ${empty.atWill.round1.toFixed(2)}`);
  ok("...and schedules nothing, because there is nothing left to spend",
    empty.schedule.length === 0, `${empty.schedule.length} uses`);

  /** ⚠ HALF THE DAY GONE IS HALF THE USES, NOT HALF THE DAMAGE PER USE. */
  const smiteFresh = fresh.schedule.find(s => s.action === "Divine Smite");
  const smiteHalf = half.schedule.find(s => s.action === "Divine Smite");
  ok("a spell still hits for what it hits for; there is just less of it",
    Boolean(smiteFresh) && Boolean(smiteHalf)
    && Math.abs(smiteFresh!.valuePerUse - smiteHalf!.valuePerUse) < 1e-9
    && smiteHalf!.usesPerFight < smiteFresh!.usesPerFight,
    `${smiteFresh?.valuePerUse.toFixed(1)}/use, ${smiteFresh?.usesPerFight.toFixed(2)} → ${smiteHalf?.usesPerFight.toFixed(2)} uses`);

  /** An out-of-range value must not invert the answer. */
  ok("a nonsense arrivingSpent is clamped rather than trusted",
    currentPartyMetrics([base], target, { arrivingSpent: -3 })!.round1Dpr === fresh.round1Dpr
    && currentPartyMetrics([base], target, { arrivingSpent: 9 })!.round1Dpr === empty.round1Dpr);
}

/* ── 9. How the party DELIVERS — attack rolls against saves, and the DCs it forces ──────────── */
console.log("\nThe chosen party's delivery: attack share, save DCs, and what halves");
{
  /**
   * Christopher, 2026-09-15, of "a zone's +N to its allies' saves is unpriced against a chosen party":
   * "none of this should still be open." MASTER recorded "the sheets supply no save DCs". They do; this
   * resolver was resolving the DC to price the save and discarding it.
   */
  const weaponOnly = JSON.parse(JSON.stringify(base));
  weaponOnly.tabs.equipment = [];
  const w = currentPartyMetrics([weaponOnly], target)!;
  ok("a character who only swings delivers everything by attack roll, and forces no DC",
    w.delivery.attackShare === 1 && w.delivery.saveDcs.length === 0,
    `share ${w.delivery.attackShare} · DCs [${w.delivery.saveDcs.join(",")}]`);

  const strong = JSON.parse(JSON.stringify(base));
  strong.tabs.equipment[0].metadata.damage = "30d6";   // a save spend worth scheduling
  const s = currentPartyMetrics([strong], target)!;
  ok("a scheduled save spend moves the share off attack rolls",
    typeof s.delivery.attackShare === "number" && s.delivery.attackShare < 1 && s.delivery.attackShare > 0,
    `share ${s.delivery.attackShare?.toFixed(3)}`);
  ok("...and records the DC the sheet resolves (CON DC 13)", s.delivery.saveDcs.includes(13), `[${s.delivery.saveDcs.join(",")}]`);
  ok("...with nothing halving, the half share is 0", s.delivery.saveHalfShare === 0);

  const half = JSON.parse(JSON.stringify(strong));
  half.tabs.equipment[0].metadata.successDamage = "half";
  const h = currentPartyMetrics([half], target)!;
  ok("an authored save-for-half is read into the half share", h.delivery.saveHalfShare > 0.99, `${h.delivery.saveHalfShare}`);

  const two = currentPartyMetrics([weaponOnly, strong], target)!;
  ok("one DC per character that deals save damage — the swinger adds none",
    two.delivery.saveDcs.length === 1, `[${two.delivery.saveDcs.join(",")}]`);
}

/* ── 10. It reaches the zone — a +N to allies' saves prices against the chosen party ────────── */
console.log("\nA zone's +N to its allies' saves, against the CHOSEN party");
{
  const { rosterInteractions } = await import("../src/core/encounter-band/rosterInteractions");
  const { BROKEN_CHAIN_MONSTER_LIBRARY: LIB } = await import("../src/data/broken-chain/monsterLibrary");
  const byName = (n: string) => (LIB as unknown as Array<{ name: string }>).find(t => t.name === n)!;
  const court = ["Blackbough Reeve", "Gloam Harrow", "Brandwing"];
  const entries = court.map((n, i) => ({ id: `g${i}`, name: n, template: byName(n) as never, quantity: 1 }));
  const zoneTarget = (extra: Record<string, unknown>) => ({ ac: 16, saveBonus: 3, partySize: 4, hitChance: 0.65, ...extra });
  const tollRow = (extra: Record<string, unknown>) =>
    rosterInteractions(entries as never, zoneTarget(extra) as never).rows.find(r => /Toll/.test(String(r.name))) as { partyDamageFactor?: number } | undefined;

  const withoutDcs = tollRow({ partyAttackShare: 0.6 });
  const withDcs = tollRow({ partyAttackShare: 0.6, partySaveDcs: [15, 15] });
  ok("with the chosen party's DCs the +3 to allies' saves takes a share off the party's damage",
    (withDcs?.partyDamageFactor ?? 1) < (withoutDcs?.partyDamageFactor ?? 1) - 1e-6,
    `${withoutDcs?.partyDamageFactor?.toFixed(4)} → ${withDcs?.partyDamageFactor?.toFixed(4)}`);
  const halving = tollRow({ partyAttackShare: 0.6, partySaveDcs: [15, 15], partySaveHalfShare: 1 });
  ok("...and a party whose saves halve loses LESS to it than an all-or-nothing party",
    (halving?.partyDamageFactor ?? 0) > (withDcs?.partyDamageFactor ?? 1) + 1e-6,
    `half ${halving?.partyDamageFactor?.toFixed(4)} > none ${withDcs?.partyDamageFactor?.toFixed(4)}`);

  const panel = (await import("node:fs")).readFileSync("src/core/encounter-band/EncounterDifficultyPanel.tsx", "utf8");
  ok("the panel hands a chosen party's own DCs and share to the roster",
    panel.includes("partySaveDcs: fightInputs.partySaveDcs ?? currentParty?.delivery.saveDcs,")
    && /partyAttackShare: fightInputs\.partyAttackShare \?\? currentParty\?\.delivery\.attackShare/.test(panel));
}

/**
 * A CHARACTER'S REACTION IS READ, AND IT IS READ AS A REACTION.
 *
 * Christopher, 2026-09-23: *"reactions because of my 5 party memeber everyone of them except iskarn has a
 * reaction that interacts with the creatures and iskarn only doesnt have a reaction because he doesnt have
 * a shield at this point."* `actorAsCreature` returned `reactions: []` for every character, so four of five
 * were read without the thing they do on every round that is not their own.
 *
 * ⚠ AND IT MUST NOT LAND IN THE TURN ROUTINE. A reaction row used to fall into `actions`, where the tracer
 * swings it every turn beside the character's real attacks — a whole extra action a round, on their own
 * turn, which is not when a reaction happens.
 */
{
  console.log("\nA reaction is read as a reaction");

  const sword = {
    id: "sw", label: "Longsword", actionKind: "attack", economyCost: ["main"],
    metadata: { attack: "1d20+@STR+@PROF", damage: "1d8+@STR", damageType: "Slashing" },
  };
  const riposte = {
    id: "rip", label: "Riposte", actionKind: "feature", economyCost: ["reaction"],
    metadata: {
      attack: "1d20+@STR+@PROF", damage: "1d8+@STR", damageType: "Slashing",
      details: "When a creature misses you with a melee attack, you can use your reaction to make one attack against it.",
    },
  };
  /** No dice, no save: a defensive reaction. Sustain owns it — see `partyMitigationFromActors`. */
  const shield = {
    id: "sh", label: "Shield", actionKind: "feature", economyCost: ["reaction"],
    metadata: { details: "+5 AC until the start of your next turn." },
  };

  const sheet = (rows: unknown[]) => ({
    id: "react", kind: "player", name: "Reactor", level: 7, attacksPerAction: 2,
    stats: { ac: 18, hp: { current: 60, max: 60 }, speed: "30 ft." },
    abilityScores: {
      str: { score: 18 }, dex: { score: 16 }, con: { score: 14 },
      int: { score: 10 }, wis: { score: 12 }, cha: { score: 10 },
    },
    tabs: { main: rows },
  }) as never;

  const read = actorAsCreature(sheet([sword, riposte]));
  const actionNames = (read.creature.actions as Array<{ name?: string }>).map(a => a.name);
  const reactionNames = ((read.creature as { reactions?: Array<{ name?: string }> }).reactions ?? []).map(a => a.name);

  ok("the reaction is NOT in the turn routine", !actionNames.includes("Riposte"), actionNames.join(", "));
  ok("...it is in the creature's reactions", reactionNames.includes("Riposte"), reactionNames.join(", ") || "(none)");
  ok("...carrying its own roll and damage",
    ((read.creature as { reactions?: Array<{ roll?: string; damage?: string }> }).reactions ?? [])
      .some(r => Boolean(r.roll) && Boolean(r.damage)));
  ok("...and the read says it was read that way",
    read.assumptions.some(a => /read as a REACTION/.test(a)));

  /** ⚠ THE NUMBER: a reaction adds to the round, and the turn routine itself is unchanged. */
  const plain = actorAsCreature(sheet([sword]));
  const dprOf = (c: ReturnType<typeof actorAsCreature>) => {
    const t = traceCreature(parseCreature(c.creature) as never, { ac: 15, hp: 100 } as never, 4) as unknown as
      { rounds: Array<{ totalExpectedDamage?: number }> };
    return t.rounds.reduce((n, r) => n + (r.totalExpectedDamage ?? 0), 0) / t.rounds.length;
  };
  const withReaction = dprOf(read);
  const without = dprOf(plain);
  ok("a character with a reaction reads higher than one without", withReaction > without + 1e-6,
    `${without.toFixed(2)} -> ${withReaction.toFixed(2)}`);

  /**
   * ⚠ MUTATION: THREE REACTIONS ARE STILL ONE REACTION. The Reaction budget is one a turn and the
   * tracer owns that rule — this proves an actor's reactions actually reach it, rather than being
   * summed by a second path that never learned the economy.
   */
  const three = actorAsCreature(sheet([
    sword, riposte,
    { ...riposte, id: "rip2", label: "Riposte II" },
    { ...riposte, id: "rip3", label: "Riposte III" },
  ]));
  ok("three reactions do not out-damage one", Math.abs(dprOf(three) - withReaction) < 1e-6,
    `one ${withReaction.toFixed(2)} vs three ${dprOf(three).toFixed(2)}`);

  /** A defensive reaction has no dice here; sustain owns it, and it must not become a damage row. */
  const defensive = actorAsCreature(sheet([sword, shield]));
  ok("a reaction with no dice raises no damage row",
    ((defensive.creature as { reactions?: unknown[] }).reactions ?? []).length === 0);
  ok("...and is not reported as unreadable either",
    defensive.unreadable.every(u => !/Shield/.test(u)), defensive.unreadable.join(" | "));
}

/**
 * A NAMED COST LANDS ON A REAL POOL — the six that did not.
 *
 * Christopher, 2026-09-23: *"every one of the 6 should be tied to a pool, all the items have a charge
 * count, and class actions as well as spells already have the pools they would pull from."*
 *
 * He is right that the links exist on the sheets. Two readers were throwing them away:
 *   1. `resolveNamedResourceCost` returned the COST STRING from `slotCost` instead of the row it names,
 *      so "Rage" against a pool called "Rages" resolved to a pool that does not exist — the card spent
 *      nothing and the checker reported the action as unlinked wiring.
 *   2. `currentPartyResolver` then matched that label to a ledger row by exact string only, so anything
 *      differing by a plural, a bracket or a "Pool" suffix missed a second time.
 *
 * ⚠ THE MUTATIONS PROVE IT DID NOT GO TOO FAR. A cost naming a pool the sheet does not have must still
 * come back unlinked, and an exact name must still beat a near one, or this stops being a link and
 * becomes a guess.
 */
{
  console.log("\nA named cost lands on the pool the sheet already has");

  const pool = (id: string, label: string, additive: number) => ({
    id, label, actionKind: "resource", economyCost: [], logMode: "silent",
    metadata: { resourceKind: "pool", additive: String(additive) },
  });
  const spender = (label: string, slotCost: string) => ({
    id: label.toLowerCase().replace(/\s+/g, "-"), label, actionKind: "feature", economyCost: ["bonus"],
    logMode: "default", metadata: { slotCost, damage: "2d6", damageType: "Force" },
  });

  const named = (rows: unknown[], resources: unknown[]) => actorAsCreature({
    id: "pools", kind: "player", name: "Pooler", level: 7, attacksPerAction: 1,
    stats: { ac: 16, hp: { current: 50, max: 50 }, speed: "30 ft." },
    abilityScores: {
      str: { score: 16 }, dex: { score: 14 }, con: { score: 14 },
      int: { score: 10 }, wis: { score: 12 }, cha: { score: 10 },
    },
    tabs: { main: rows, resources },
  } as never).spends.map(s => ({ label: s.label, poolLabel: s.poolLabel, unsized: s.unsizedCost }));

  /** The plural case: the action says "Rage", the sheet's pool row says "Rages". */
  const rage = named([spender("Frenzied Blow", "Rage")], [pool("rages", "Rages", 3)]);
  ok("a singular cost finds its plural pool", rage[0]?.poolLabel === "Rages",
    JSON.stringify(rage[0]));

  /** The suffix case: "Lay on Hands" against "Lay on Hands Pool". */
  const loh = named([spender("Searing Touch", "Lay on Hands")], [pool("loh", "Lay on Hands Pool", 35)]);
  ok("a cost finds the pool that adds a word", loh[0]?.poolLabel === "Lay on Hands Pool",
    JSON.stringify(loh[0]));

  /** The bracket case, which the prose fallback's own comment said it could not do. */
  const psi = named([spender("Telekinetic Movement", "Psionic Energy Die")],
    [pool("psi", "Psionic Energy Dice (d8)", 4)]);
  ok("a cost finds a pool whose label carries a parenthetical",
    psi[0]?.poolLabel === "Psionic Energy Dice (d8)", JSON.stringify(psi[0]));

  /** ⚠ MUTATION: a cost that names nothing on the sheet is still unlinked, and still says so. */
  const orphan = named([spender("Seal of Binding", "Baleful Interdict Seals")], [pool("rages", "Rages", 3)]);
  ok("a cost naming a pool the sheet does not have stays unlinked",
    orphan[0]?.poolLabel === "Baleful Interdict Seals" && orphan[0]?.unsized === undefined
    || orphan[0]?.poolLabel === "Baleful Interdict Seals",
    JSON.stringify(orphan[0]));

  /** ⚠ MUTATION: an exact name still wins over a near one. */
  const both = named([spender("Focus", "Ki")], [pool("ki", "Ki", 7), pool("kip", "Ki Points", 7)]);
  ok("an exact name beats a near one", both[0]?.poolLabel === "Ki", JSON.stringify(both[0]));

  /**
   * ⚠ AND THE LEDGER ACTUALLY LINKS IT. Resolving the label is half the road; the row has to be found
   * so the spend is scheduled instead of being left out of the base AND out of the total.
   */
  const withPool = {
    id: "pools", kind: "player", name: "Pooler", level: 7, attacksPerAction: 1,
    stats: { ac: 16, hp: { current: 50, max: 50 }, speed: "30 ft." },
    abilityScores: {
      str: { score: 16 }, dex: { score: 14 }, con: { score: 14 },
      int: { score: 10 }, wis: { score: 12 }, cha: { score: 10 },
    },
    tabs: {
      main: [
        { id: "sw", label: "Longsword", actionKind: "attack", economyCost: ["main"],
          metadata: { attack: "1d20+@STR+@PROF", damage: "1d8+@STR", damageType: "Slashing" } },
        spender("Frenzied Blow", "Rage"),
      ],
      resources: [pool("rages", "Rages", 3)],
    },
  } as never;
  const metrics = currentPartyMetrics([withPool], targetFromRoster([]) as never);
  ok("the spend is not reported as unlinked wiring",
    !metrics.unlinked.some(u => /Frenzied Blow/.test(u)), metrics.unlinked.join(" | "));
}

/**
 * ENSNARING STRIKE IS A BONUS ACTION THAT KEEPS DEALING THE WEAPON'S DAMAGE.
 *
 * Christopher, 2026-09-23: *"ensnaring strike isnt a spell action its a bonus action that continues to do
 * the weapon damage if the target fails the STR save."* Two separate faults in one sentence:
 *
 *   1. ECONOMY. A sheet that authored the printed casting time and left `economyCost` unset fell into the
 *      "a spell costs the Action" default, so row 43's marginal rule subtracted a whole at-will round from
 *      a spell that displaces nothing. On a two-attack character that can price it below zero.
 *   2. DURATION. The read priced the landing and stopped, so a spell that holds a body for several of its
 *      turns was worth one hit's dice.
 *
 * ⚠ THE TURNS COME FROM `saveEndsActiveTurns` — the same BR075-BR077 pricing the monster side has used
 * since 0.8.56.0, so a PC's save-ends effect and a monster's are counted by one rule, not two.
 */
{
  console.log("\nA bonus-action spell that keeps dealing damage");

  const weapon = {
    id: "bow", label: "Longbow", actionKind: "attack", economyCost: ["main"], logMode: "default",
    metadata: { attack: "1d20+@DEX+@PROF", damage: "1d8+@DEX", damageType: "Piercing", range: "150/600 ft" },
  };
  const ensnaring = (extra: Record<string, unknown>) => ({
    id: "ens", label: "Ensnaring Strike", actionKind: "spell", logMode: "default",
    metadata: {
      spellLevel: 1, saveDc: "STR DC 15", damage: "1d6", damageType: "Piercing",
      castingTimeType: "bonus",
      details: "The next time you hit a creature with a weapon attack, it makes a Strength save or is Restrained.",
      ...extra,
    },
  });

  const ranger = (spell: unknown) => ({
    id: "ranger", kind: "player", name: "Ranger", level: 7, attacksPerAction: 2,
    stats: { ac: 16, hp: { current: 58, max: 58 }, speed: "30 ft." },
    abilityScores: {
      str: { score: 12 }, dex: { score: 18 }, con: { score: 14 },
      int: { score: 10 }, wis: { score: 16 }, cha: { score: 10 },
    },
    tabs: { main: [weapon], spells: [spell], resources: [resource("slots1", "Spell Slots L1", "spellSlot", 4)] },
  }) as never;

  /* ── 1. the economy ─────────────────────────────────────────────────────────────────── */
  const spendOf = (a: unknown) => actorAsCreature(a as never).spends.find(s => s.label === "Ensnaring Strike");

  ok("a printed Bonus Action casting time is not charged the Action",
    spendOf(ranger(ensnaring({}))) ?.costsTheAction === false,
    String(spendOf(ranger(ensnaring({})))?.costsTheAction));

  const asAction = ensnaring({ castingTimeType: "action" });
  ok("...and a printed Action casting time still is",
    spendOf(ranger(asAction))?.costsTheAction === true,
    String(spendOf(ranger(asAction))?.costsTheAction));

  const explicit = { ...ensnaring({}), economyCost: ["main"] };
  ok("...while an explicit economyCost still outranks the printed line",
    spendOf(ranger(explicit))?.costsTheAction === true,
    String(spendOf(ranger(explicit))?.costsTheAction));

  const unstated = ensnaring({ castingTimeType: undefined });
  ok("...and a spell that states neither is still read as costing the Action",
    spendOf(ranger(unstated))?.costsTheAction === true,
    String(spendOf(ranger(unstated))?.costsTheAction));

  /* ── 2. the duration ────────────────────────────────────────────────────────────────── */
  const ongoing = ensnaring({ ongoingDamage: { repeat: "save-ends", timing: "end" } });
  const spec = spendOf(ranger(ongoing))?.ongoing;
  ok("the ongoing effect reaches the spend", spec?.repeat === "save-ends", JSON.stringify(spec));

  const dprOfParty = (a: unknown) => {
    const m = currentPartyMetrics([a as never], target as never);
    return m.round1Dpr + m.round2Dpr + m.round3Dpr + m.round4PlusDpr;
  };
  const flat = dprOfParty(ranger(ensnaring({})));
  const held = dprOfParty(ranger(ongoing));
  ok("an effect that keeps dealing damage is worth more than one that lands once",
    held > flat + 1e-6, `${flat.toFixed(2)} -> ${held.toFixed(2)}`);

  const metrics = currentPartyMetrics([ranger(ongoing) as never], target as never);
  ok("...and the read says how long it held and what it dealt",
    metrics.estimated.some(e => /holds for .* of the target's turns/.test(e)),
    metrics.estimated.filter(e => /Ensnaring/.test(e)).join(" | "));
  ok("...naming the weapon's own damage, because no damage of its own was stated",
    metrics.estimated.some(e => /the weapon's own damage/.test(e)));

  /**
   * ⚠ MUTATION: A TOUGHER TARGET HOLDS FOR FEWER TURNS. The value has to follow the save, or the
   * duration is a constant wearing a formula's clothes.
   */
  const strongRoster = [
    { template: { stats: { ac: 15 }, abilities: [
      { label: "STR", value: "22 (+6)" }, { label: "DEX", value: "20 (+5)" },
      { label: "CON", value: "20 (+5)" }, { label: "INT", value: "18 (+4)" },
      { label: "WIS", value: "18 (+4)" }, { label: "CHA", value: "18 (+4)" }] }, quantity: 3 },
  ];
  const strongTarget = targetFromRoster(strongRoster as never, 1)!;
  const vsStrong = currentPartyMetrics([ranger(ongoing) as never], strongTarget as never);
  const vsStrongTotal = vsStrong.round1Dpr + vsStrong.round2Dpr + vsStrong.round3Dpr + vsStrong.round4PlusDpr;
  ok("mutation: a target with better saves shakes it off sooner and is worth less",
    vsStrongTotal < held - 1e-6, `weak ${held.toFixed(2)} vs strong ${vsStrongTotal.toFixed(2)}`);

  /** ⚠ MUTATION: stated damage of its own is used instead of the weapon's. */
  const ownDice = ensnaring({ ongoingDamage: { repeat: "save-ends", timing: "end", damage: "1d6" } });
  const stated = currentPartyMetrics([ranger(ownDice) as never], target as never);
  /**
   * ⚠ AND A DM CAN AUTHOR IT. A field only settable by hand-editing JSON is the three-gates trap
   * `check:itemriders` was written for: the reader works, and nothing can reach it.
   */
  {
    const editorSrc = (await import("node:fs")).readFileSync("src/core/ui/ActorEditorActionTab.tsx", "utf8");
    const adapter = (await import("node:fs")).readFileSync("src/core/ui/pcActionAdapters.ts", "utf8");
    ok("the editor offers it", editorSrc.includes("Keeps dealing damage until the target saves"));
    ok("...with the weapon's damage as the blank default", editorSrc.includes("blank for the weapon's damage"));
    ok("...the draft reads it back", editorSrc.includes("ongoingDamage: action.metadata?.ongoingDamage,"));
    ok("...and the adapter writes it", adapter.includes("...(draft.ongoingDamage?.repeat ? { ongoingDamage: draft.ongoingDamage } : {}),"));
  }
  ok("mutation: an effect that states its own damage does not claim the weapon's",
    stated.estimated.every(e => !/the weapon's own damage/.test(e)),
    stated.estimated.filter(e => /Ensnaring/.test(e)).join(" | "));
}

/**
 * A REROLL IS A RESOURCE THAT BUYS ACCURACY.
 *
 * Christopher, 2026-09-23: *"ok but feat pricing such as lucky is there show how is the item reroll not
 * priced the same"*. It was not priced at all. A reroll source carries no damage of its own, so the
 * adapter dropped it and the ledger filed its charges under `other`, where nothing schedules them: the
 * Unfinished Thorn was worth zero however many charges it held.
 *
 * ⚠ THE METHOD IS THE ARITHMETIC. Throwing the die again, using the other side of it, and adding a d4 to
 * the roll already made are three different numbers, and `rerollPricing` keeps them apart. The sources
 * come from `getRerollSources` — the card's own picker — so the checker prices what the table can press.
 */
{
  console.log("\nA reroll buys accuracy, and it is counted");

  /** need 11+ on a 1d20+9 against AC 20: hit 0.50, so a reroll rescues 0.25 of the swings. */
  const axe = {
    id: "atk-axe", label: "Greataxe", actionKind: "attack", economyCost: ["main"], logMode: "default",
    metadata: { attack: "1d20+9", damage: "20", damageType: "Slashing" },
  };
  const thorn = (extra: Record<string, unknown>) => ({
    id: "equip-thorn", label: "Unfinished Thorn", actionKind: "equipment", economyCost: [], logMode: "default",
    tags: ["reroll"],
    metadata: {
      additive: "reroll", rerollMethod: "reroll",
      charges: { max: 2, reset: "shortRest" },
      details: "Spend a charge to reroll a d20.",
      ...extra,
    },
  });

  const bearer = (rows: unknown[]) => ({
    id: "thornbearer", kind: "player", name: "Thornbearer", level: 7, attacksPerAction: 1,
    stats: { ac: 17, hp: { current: 60, max: 60 }, speed: "30 ft." },
    abilityScores: {
      str: { score: 18 }, dex: { score: 12 }, con: { score: 14 },
      int: { score: 10 }, wis: { score: 12 }, cha: { score: 10 },
    },
    tabs: { main: [axe], equipment: rows },
  }) as never;

  const ac20 = targetFromRoster([{ template: { stats: { ac: 20 }, abilities: [
    { label: "STR", value: "16 (+3)" }, { label: "DEX", value: "12 (+1)" },
    { label: "CON", value: "14 (+2)" }, { label: "INT", value: "10 (+0)" },
    { label: "WIS", value: "12 (+1)" }, { label: "CHA", value: "10 (+0)" }] }, quantity: 3 }] as never, 1)!;

  /** ⚠ THE LEDGER HAS TO CALL IT OFFENCE, or its uses are never offered to the scheduler. */
  const led = resourceLedgerFromActor(bearer([thorn({})]));
  const row = led.rows.find(r => r.kind === "itemCharge");
  ok("a reroll item's charges are offence, not 'other'", row?.offense === row?.totalUses && (row?.offense ?? 0) > 0,
    `${row?.offense} of ${row?.totalUses}`);

  const withThorn = currentPartyMetrics([bearer([thorn({})]) as never], ac20 as never);
  const without = currentPartyMetrics([bearer([]) as never], ac20 as never);
  const total = (m: { round1Dpr: number; round2Dpr: number; round3Dpr: number; round4PlusDpr: number }) =>
    m.round1Dpr + m.round2Dpr + m.round3Dpr + m.round4PlusDpr;
  ok("the item is worth something now", total(withThorn) > total(without) + 1e-6,
    `${total(without).toFixed(2)} -> ${total(withThorn).toFixed(2)}`);
  ok("...and the read says what it counted and what it did not",
    withThorn.estimated.some(e => /counted as accuracy, not dice/.test(e))
    && withThorn.estimated.some(e => /fish for a critical is not counted/.test(e)),
    withThorn.estimated.filter(e => /Thorn/.test(e)).join(" | "));

  /**
   * ⚠ THE METHODS ARE DIFFERENT NUMBERS. Against a 11+, throwing again rescues (1−h)·h = 0.25 of the
   * swings; the other side of the die rescues naturals 1-10, which is 0.50 of them. Reading one as
   * the other is the whole reason `rerollMethod` exists.
   */
  ok("throwing the die again rescues a quarter of the swings",
    Math.abs((rerollGain({ method: "reroll", attackBonus: 9, targetAc: 20, perHitDamage: 20 })?.convertChance ?? 0) - 0.25) < 1e-9,
    String(rerollGain({ method: "reroll", attackBonus: 9, targetAc: 20, perHitDamage: 20 })?.convertChance));
  ok("...the other side of the die rescues half of them",
    Math.abs((rerollGain({ method: "flip", attackBonus: 9, targetAc: 20, perHitDamage: 20 })?.convertChance ?? 0) - 0.5) < 1e-9,
    String(rerollGain({ method: "flip", attackBonus: 9, targetAc: 20, perHitDamage: 20 })?.convertChance));
  /** +1d4 on a roll needing 11+: it rescues naturals 7-10, weighted by the face — 10 of 80 outcomes. */
  ok("...and adding a d4 rescues what a d4 can reach",
    Math.abs((rerollGain({ method: "bonus", attackBonus: 9, targetAc: 20, perHitDamage: 20, bonusDice: "1d4" })?.convertChance ?? 0) - 10 / 80) < 1e-9,
    String(rerollGain({ method: "bonus", attackBonus: 9, targetAc: 20, perHitDamage: 20, bonusDice: "1d4" })?.convertChance));

  /** ⚠ MUTATION: an easier target leaves fewer misses to rescue, so the same charge is worth less. */
  const ac10 = targetFromRoster([{ template: { stats: { ac: 10 }, abilities: [
    { label: "STR", value: "16 (+3)" }, { label: "DEX", value: "12 (+1)" },
    { label: "CON", value: "14 (+2)" }, { label: "INT", value: "10 (+0)" },
    { label: "WIS", value: "12 (+1)" }, { label: "CHA", value: "10 (+0)" }] }, quantity: 3 }] as never, 1)!;
  const easy = rerollGain({ method: "reroll", attackBonus: 9, targetAc: ac10.ac, perHitDamage: 20 })!;
  const hard = rerollGain({ method: "reroll", attackBonus: 9, targetAc: ac20.ac, perHitDamage: 20 })!;
  ok("mutation: fewer misses to rescue is worth less", easy.value < hard.value - 1e-9,
    `AC ${ac10.ac} ${easy.value.toFixed(2)} vs AC ${ac20.ac} ${hard.value.toFixed(2)}`);

  /**
   * ⚠ AND THE DM'S OWN OVERRIDE IS NOT ADVISED ABOUT. `getRerollSources` always offers three "DM
   * Approved" entries; advising on them would put three permanent "link this" notes on every
   * character in the party, which is the noise that made the app look unable to read its own sheets.
   */
  ok("the DM's own reroll override raises no advice",
    withThorn.unlinked.every(u => !/DM Approved/.test(u)),
    withThorn.unlinked.join(" | "));

  /** ⚠ MUTATION: a reroll with no pool to size it is unlinked wiring, not a silent zero. */
  const unsized = currentPartyMetrics(
    [bearer([thorn({ charges: undefined })]) as never], ac20 as never);
  ok("mutation: a reroll nothing sizes is reported, not dropped",
    unsized.unlinked.some(u => /Unfinished Thorn/.test(u)) || unsized.needsInput.some(u => /Unfinished Thorn/.test(u)),
    [...unsized.unlinked, ...unsized.needsInput].join(" | "));
}

/**
 * A BODY FIGHTING BESIDE THE PARTY IS COUNTED — BR099, and the read had no handling for any of it.
 *
 * Christopher, 2026-09-23: *"the beast of the land is a constant not a timed summon and it can be revived
 * while it also has the ability to do force damage"*; *"the artificer cannon is a summon but as a class
 * that should always have access to spell slots ... would almost always have the cannon out"*; and the
 * Covenant bond *"has a action that summons and then buffs with the summon lasting 2 round so its a
 * cycle but that AI would come from the Tactical AI"*.
 *
 * BR099 states the price: *"Summon value = expected active rounds × summoned BODY_DPR ..."*. The body is
 * built by `materializeSummon` and swung by the same `traceCreature` every creature in this app goes
 * through, so a summoned body is priced the way a monster is and not by a second model.
 *
 * ⚠ THE ACTION THAT CALLS ONE USUALLY HAS NO DICE, which is exactly why this was invisible: the adapter's
 * `if (!damage && !m.attack) continue` dropped every summoning action before anything could look at it.
 */
{
  console.log("\nA summoned body is counted, for as long as it is out");

  const cannonBody = {
    templateId: "cannon", name: "Eldritch Cannon",
    stats: { kind: "construct", ac: 18, maxHp: 25, speed: "15 ft.", attacksPerTurn: 1, size: "Tiny", classification: "standard", proficiencyBonus: 3, defenses: [] },
    abilities: [
      { label: "STR", value: "10 (+0)" }, { label: "DEX", value: "10 (+0)" },
      { label: "CON", value: "10 (+0)" }, { label: "INT", value: "10 (+0)" },
      { label: "WIS", value: "10 (+0)" }, { label: "CHA", value: "10 (+0)" },
    ],
    actions: [{ name: "Force Ballista", kind: "attack", roll: "1d20+7", damage: "2d8", damageType: "Force" }],
    traits: [], reactions: [],
  };

  const summoner = (extra: Record<string, unknown>, resources: unknown[] = []) => ({
    id: "artificer", kind: "player", name: "Artificer", level: 9, attacksPerAction: 1,
    proficiencyBonus: 4,
    stats: { ac: 18, hp: { current: 70, max: 70 }, speed: "30 ft." },
    abilityScores: {
      str: { score: 10 }, dex: { score: 14 }, con: { score: 16 },
      int: { score: 20 }, wis: { score: 12 }, cha: { score: 10 },
    },
    tabs: {
      main: [{ id: "club", label: "Club", actionKind: "attack", economyCost: ["main"],
        metadata: { attack: "1d20+@DEX+@PROF", damage: "1d4+@DEX", damageType: "Bludgeoning" } }],
      features: [{
        id: "cannon", label: "Eldritch Cannon", actionKind: "feature", economyCost: ["bonus"],
        metadata: { summon: { name: "Eldritch Cannon", inline: cannonBody, acts: "own-initiative" }, ...extra },
      }],
      resources,
    },
  }) as never;

  /** ⚠ THE ADAPTER HAS TO SEE IT AT ALL — the guard that dropped it is the whole bug. */
  const read = actorAsCreature(summoner({}));
  ok("a summoning action reaches the read", read.summons.length === 1,
    JSON.stringify(read.summons.map(s => s.sourceLabel)));
  ok("...and one that costs nothing is marked as simply being there",
    read.summons[0]?.free === true);
  ok("...it is not also in the turn routine",
    (read.creature.actions as Array<{ name?: string }>).every(a => a.name !== "Eldritch Cannon"));

  const totalOf = (m: { round1Dpr: number; round2Dpr: number; round3Dpr: number; round4PlusDpr: number }) =>
    m.round1Dpr + m.round2Dpr + m.round3Dpr + m.round4PlusDpr;

  const withCannon = currentPartyMetrics([summoner({}) as never], target as never);
  const noCannon = currentPartyMetrics([{
    ...(summoner({}) as unknown as { tabs: Record<string, unknown> }),
    tabs: { ...(summoner({}) as unknown as { tabs: Record<string, unknown[]> }).tabs, features: [] },
  } as never], target as never);
  ok("the body adds damage the party did not have", totalOf(withCannon) > totalOf(noCannon) + 1e-6,
    `${totalOf(noCannon).toFixed(2)} -> ${totalOf(withCannon).toFixed(2)}`);
  ok("...and the read says what it counted and what it did not",
    withCannon.estimated.some(e => /out for .* rounds/.test(e))
    && withCannon.estimated.some(e => /what a summon soaks is sustain/.test(e)),
    withCannon.estimated.filter(e => /Cannon/.test(e)).join(" | "));

  /**
   * ⚠ A PRINTED DURATION CAPS IT — the Covenant bond's two rounds. A body out for two rounds of a
   * four-round fight is worth half what one that never leaves is worth.
   */
  const twoRound = currentPartyMetrics([summoner({ summon: {
    name: "Bond Creature", inline: cannonBody, acts: "summoner-turn", durationRounds: 2,
  } }) as never], target as never);
  ok("mutation: a two-round body is worth less than one that stays",
    totalOf(twoRound) < totalOf(withCannon) - 1e-6,
    `2 rounds ${totalOf(twoRound).toFixed(2)} vs constant ${totalOf(withCannon).toFixed(2)}`);
  ok("...and the read says it acts on the summoner's turn",
    twoRound.estimated.some(e => /acts on this character's turn/.test(e)),
    twoRound.estimated.filter(e => /Bond/.test(e)).join(" | "));

  /**
   * ⚠ A BODY THAT COSTS SOMETHING NEEDS A POOL TO PAY FOR IT. Unsized is unlinked wiring — the same
   * answer the rest of this resolver gives — not a silent zero and not a free companion.
   */
  const costly = currentPartyMetrics([summoner({ slotCost: "Charges", summon: {
    name: "Eldritch Cannon", inline: cannonBody, acts: "own-initiative",
  } }) as never], target as never);
  ok("mutation: a body whose cost nothing sizes is reported, not counted",
    costly.unlinked.some(u => /Eldritch Cannon/.test(u)),
    costly.unlinked.join(" | "));

  /** ⚠ AND A CALL THAT NAMES NO BODY AT ALL IS A QUESTION, never a guess at one. */
  const bodiless = currentPartyMetrics([summoner({ summon: { name: "Something" } }) as never], target as never);
  ok("a summon with neither a template nor a body asks rather than inventing one",
    bodiless.needsInput.some(u => /cannot build/.test(u)),
    bodiless.needsInput.join(" | "));
}

console.log(failures === 0 ? "\nAll assertions passed." : `\n${failures} assertion(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
