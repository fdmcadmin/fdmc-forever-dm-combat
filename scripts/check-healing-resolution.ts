/**
 * HEALING IS WORTH WHAT REACHES THE TARGET — and the slot is spent once, for both halves of it.
 *
 * Run: npm run check:healing
 *
 * The workbook is the authority and it already states the contract. `pricingPrimitives`:
 *
 *   healing                      *"Expected usable same-encounter healing, capped by missing
 *                                HP/overheal and action/resource availability."*
 *   healing_received_multiplier  *"healing received is halved"* → 0.5
 *                                *"cannot regain HP / healing prevented"* → 0
 *
 * Christopher, 2026-09-02: *"Overhealing has zero sustain value. Upcasting must use the spell's
 * actual upcast healing progression… The healing is therefore part of the value obtained from
 * spending that slot, not a second free sustain pool."*
 *
 * ⚠ THE EXIT CHECK IS THE LAST THING IN THIS FILE.
 */

import {
  usableHealing, healingFormulaAtLevel, expectedHealingAtLevel, healingMultiplierFromText,
} from "../src/core/rules/healingResolution";
import { partyHealingFromActors } from "../src/core/encounter-band/partyHealingFromActors";
import { restResource } from "../src/modules/the-broken-chain/actors/actorHelpers";

let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps;

console.log("Healing resolution — capped by missing HP, reduced by prevention, slot spent once\n");

/* ── Capped by missing HP; overheal is worth nothing ─────────────────────────────────────── */
console.log("Capped by the target's missing HP");
{
  const full = usableHealing({ amount: 20, current: 40, effectiveMax: 40 });
  ok("a heal on a FULL target is worth zero", full.usable === 0, `usable ${full.usable}`);
  ok("...and the whole roll is reported as overheal", full.overheal === 20, `overheal ${full.overheal}`);

  const hurt = usableHealing({ amount: 20, current: 25, effectiveMax: 40 });
  ok("a heal larger than the gap is capped at the gap", hurt.usable === 15, `usable ${hurt.usable}`);
  ok("...and the remainder is overheal, not sustain", hurt.overheal === 5);

  const small = usableHealing({ amount: 6, current: 25, effectiveMax: 40 });
  ok("a heal inside the gap lands in full", small.usable === 6 && small.overheal === 0);

  /**
   * ⚠ THE EFFECTIVE MAX, NOT THE SHEET MAX. A timed max-HP boost (Aid, Heroes' Feast) raises the
   * ceiling, and healing into it is legal — capping at the authored max would make the boost
   * unusable, which is the bug `effectiveMaxHp` exists to prevent.
   */
  const boosted = usableHealing({ amount: 20, current: 40, effectiveMax: 50 });
  ok("a timed max-HP boost is heal-able headroom", boosted.usable === 10, `usable ${boosted.usable}`);
}

/* ── The healing-received multiplier ─────────────────────────────────────────────────────── */
console.log("\nThe healing_received_multiplier, straight off the workbook primitive");
{
  const halved = usableHealing({ amount: 20, multiplier: 0.5, current: 10, effectiveMax: 40 });
  ok("halved healing halves before the cap", halved.usable === 10, `usable ${halved.usable}`);

  const stopped = usableHealing({ amount: 20, multiplier: 0, current: 10, effectiveMax: 40 });
  ok("prevented healing restores nothing", stopped.usable === 0);
  ok("...and says it was PREVENTED, not merely overhealed",
    stopped.prevented && stopped.overheal === 0);

  /**
   * ⚠ MULTIPLIER FIRST, CAP SECOND. Capping first would let a halved heal on a nearly-full
   * target read HIGHER than the cap it was meant to respect: 20 capped to 4 then halved is 2,
   * but the rule is "healing received is halved" — 10 received, capped to the 4 that fit.
   */
  const order = usableHealing({ amount: 20, multiplier: 0.5, current: 36, effectiveMax: 40 });
  ok("the multiplier applies to healing RECEIVED, then the cap bounds it",
    order.usable === 4, `usable ${order.usable}`);
}

/* ── Reading the multiplier out of an effect's own words ─────────────────────────────────── */
console.log("\nThe prevention text the campaign actually writes");
{
  ok("\"cannot regain hit points\" is a full stop",
    healingMultiplierFromText("the target cannot regain hit points until the start of your next turn") === 0);
  ok("\"can't regain Hit Points\" too — the 2024 contraction",
    healingMultiplierFromText("the target can't regain Hit Points") === 0);
  ok("\"healing received is halved\" is 0.5",
    healingMultiplierFromText("healing received is halved") === 0.5);
  ok("ordinary text does not modify healing",
    healingMultiplierFromText("the target takes 2d8 damage") === 1);
  ok("no text at all is 1, never 0 — absence is not prevention",
    healingMultiplierFromText(undefined) === 1);
}

/* ── Upcasting uses the spell's own progression ──────────────────────────────────────────── */
console.log("\nUpcast healing uses the authored per-level rider");
{
  // Cure Wounds: base 2d8 at L1, +2d8 per slot level above.
  const at = (castLevel: number) =>
    healingFormulaAtLevel({ base: "2d8", upcast: "2d8", baseLevel: 1, castLevel });
  ok("cast at its own level, the base stands", at(1) === "2d8", at(1));
  ok("cast one level up adds ONE rider", at(2) === "2d8 + 2d8", at(2));
  ok("cast at 4th adds THREE — per extra level, not per level", at(4) === "2d8 + 6d8", at(4));

  ok("the expected value follows the formula",
    near(expectedHealingAtLevel({ base: "2d8", upcast: "2d8", baseLevel: 1, castLevel: 4 }), 36),
    String(expectedHealingAtLevel({ base: "2d8", upcast: "2d8", baseLevel: 1, castLevel: 4 })));

  ok("a spell that does not upcast by dice is unchanged",
    healingFormulaAtLevel({ base: "1d8+3", baseLevel: 1, castLevel: 5 }) === "1d8+3");
  ok("casting BELOW the base level cannot subtract dice",
    healingFormulaAtLevel({ base: "2d8", upcast: "2d8", baseLevel: 3, castLevel: 1 }) === "2d8");
}

/* ── ⚠ NOT A SECOND SUSTAIN POOL ─────────────────────────────────────────────────────────── */
console.log("\nA slot spent healing is not ALSO spent on damage");
{
  /**
   * The party curve already contains the damage a levelled slot would do. Counting its healing on
   * top spends the same slot twice. `partyHealingFromActors` therefore counts only flat pools that
   * can do nothing else — Lay on Hands — and this asserts the exclusion still holds, because it is
   * the whole reason the aggregate figure is honest.
   */
  /**
   * ⚠ THE REAL HELPER, NOT A HAND-BUILT OBJECT. My first fixture set `resourceKind` and
   * `details` but not `metadata.additive` — which is where the pool's VALUE lives — so Lay on
   * Hands read as 0 and the gate failed against correct code. `check-party-healing` uses
   * `restResource` for exactly this reason: a fixture that guesses the shape tests the guess.
   */
  const actor = (name: string, resources: ReturnType<typeof restResource>[]) =>
    ({ id: name.toLowerCase(), kind: "player" as const, name, tabs: { resources } });

  const withSlots = partyHealingFromActors([
    actor("Cleric", [
      restResource("slots", "Spell Slots L2", 3, "long", "spellSlot", "3 / Long Rest.", "Spell Slots"),
      restResource("cw", "Cure Wounds", 3, "long", "pool", "Heals 2d8 + spellcasting modifier.", "Spells"),
    ]),
  ] as never[]);
  ok("a levelled spell slot contributes NO free healing", withSlots.total === 0,
    `${withSlots.total} — sources: ${withSlots.sources.map(s => s.label).join(", ") || "none"}`);

  const withPool = partyHealingFromActors([
    actor("Paladin", [restResource("loh", "Lay on Hands Pool", 45, "long", "pool",
      "45 HP / Long Rest. Spend points to heal (any amount) or purify poison.", "Paladin Features")]),
  ] as never[]);
  ok("a flat pool that can do nothing ELSE does contribute", withPool.total === 45,
    String(withPool.total));
  ok("...and the exclusion is REPORTED, never silent", withSlots.excluded.length > 0,
    withSlots.excluded.map(e => e.label).join(", "));
}

/* ── The acceptance check, stated as Christopher stated it ───────────────────────────────── */
console.log("\nAcceptance: the caster gains only its LEGAL usable healing");
{
  // Cure Wounds at 3rd against a target 12 HP down: 2d8 + 2d8 + 2d8 = 27 expected, 12 usable.
  const expected = expectedHealingAtLevel({ base: "2d8", upcast: "2d8", baseLevel: 1, castLevel: 3 });
  const applied = usableHealing({ amount: expected, current: 28, effectiveMax: 40 });
  ok("the roll is the upcast roll", near(expected, 27), String(expected));
  ok("the GAIN is the missing HP, not the roll", applied.usable === 12, `usable ${applied.usable}`);
  ok("and 15 points of it were worth nothing", near(applied.overheal, 15), `overheal ${applied.overheal}`);
}

console.log(`\n${failures === 0 ? "PASS" : `FAIL — ${failures} check(s)`}`);
process.exit(failures === 0 ? 0 : 1);
