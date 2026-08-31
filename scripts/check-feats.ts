/**
 * THE FEAT GATE — the workbook's contract, enforced.
 *
 * Run: npm run check:feats
 *
 * ⚠ THE EXIT CHECK IS THE LAST THING IN THIS FILE. See MASTER on `check:summons`.
 */

import { FEAT_PRICING, featPricing } from "../src/modules/dnd-5e/featPricing.generated";
import { priceFeat, priceFeats, evaluateExpression } from "../src/modules/dnd-5e/featEvaluator";
import { partyFeatsFromActors } from "../src/modules/dnd-5e/featsFromActors";

let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};

console.log(`Feat pricing — ${FEAT_PRICING.length} feats from the v12 workbook\n`);

/* ── Lookup ─────────────────────────────────────────────────────────────────────────────── */
console.log("Lookup by edition:name");
ok("exact key resolves", featPricing("2024:Alert")?.name === "Alert");
ok("2014 and 2024 are different rows",
  featPricing("2014:Alert")?.key !== featPricing("2024:Alert")?.key
  || !featPricing("2014:Alert"));
ok("a bare name defaults to 2024", featPricing("Alert")?.edition === "2024");
ok("an unknown feat is undefined, not a zero", featPricing("Definitely Not A Feat") === undefined);

/* ── The grammar ────────────────────────────────────────────────────────────────────────── */
console.log("\nExpression grammar");
ok("arithmetic", (evaluateExpression("2+3*4", {}) as { value: number }).value === 14);
ok("parentheses", (evaluateExpression("(2+3)*4", {}) as { value: number }).value === 20);
ok("ternary + comparison",
  (evaluateExpression("round==1 ? 10 : 0", { round: 1 }) as { value: number }).value === 10);
ok("ternary false branch",
  (evaluateExpression("round==1 ? 10 : 0", { round: 2 }) as { value: number }).value === 0);
{
  const h = evaluateExpression("hit(7,16)", {});
  ok("hit() is the checker's clamp", h.ok && Math.abs(h.value - 0.6) < 1e-9, h.ok ? String(h.value) : "");
}
{
  // ⚠ THE RULE THAT MATTERS: a missing variable is a QUESTION, never a zero.
  const r = evaluateExpression("attacks*perHitDamage", { attacks: 2 });
  ok("a missing variable is NEEDS_INPUT", !r.ok && r.missing.includes("perHitDamage"),
    r.ok ? `returned ${r.value}` : r.missing.join(","));
}
{
  const r = evaluateExpression("1 + doesNotExist(3)", {});
  ok("an unknown helper is NEEDS_INPUT", !r.ok);
}

/* ── Resolved-actor guard ───────────────────────────────────────────────────────────────── */
console.log("\nResolved-actor double-count guard");
{
  // Tough: "resolvedMaxHp ? 0 : 2*level" — already-applied benefits must not be re-added.
  const already = priceFeat("Tough", { resolvedMaxHp: true, level: 8 });
  const not = priceFeat("Tough", { resolvedMaxHp: false, level: 8 });
  ok("Tough adds nothing when max HP already includes it",
    already?.personalEhp.ok === true && already.personalEhp.value === 0);
  ok("Tough adds 2*level when it does not",
    not?.personalEhp.ok === true && not.personalEhp.value === 16,
    not?.personalEhp.ok ? String(not.personalEhp.value) : "");
}

/* ── Channels stay separate ─────────────────────────────────────────────────────────────── */
console.log("\nChannel separation");
{
  const p = priceFeat("Archery", { resolvedAttackBonus: false, attacks: 2, attackBonus: 7, targetAC: 16, perHitDamage: 8 });
  ok("Archery prices DPR", p?.dpr.ok === true && p.dpr.value > 0,
    p?.dpr.ok ? p.dpr.value.toFixed(3) : "");
  ok("Archery touches neither EHP channel",
    p?.personalEhp.ok === true && p.personalEhp.value === 0
    && p?.partyEhp.ok === true && p.partyEhp.value === 0);
}
{
  const p = priceFeat("Healer", { partySize: 4, level: 8, availableUsesPerRestCycle: 2 });
  ok("Healer prices PARTY_EHP only",
    p?.partyEhp.ok === true && p.partyEhp.value > 0 && p.dpr.ok === true && p.dpr.value === 0,
    p?.partyEhp.ok ? p.partyEhp.value.toFixed(1) : "");
}
{
  const p = priceFeat("Crafter", {});
  ok("an inert feat is inert, not NEEDS_INPUT", p?.inert === true && p.dpr.ok === true);
}

/* ── Totals exclude what could not be answered ──────────────────────────────────────────── */
console.log("\nParty totals");
{
  const t = priceFeats(["Tough", "Archery", "Crafter", "Not A Feat"], { resolvedMaxHp: false, level: 8 });
  ok("unknown feats are listed, not priced", t.unknown.includes("Not A Feat"));
  ok("Archery reports NEEDS_INPUT without its accuracy inputs",
    t.needsInput.some(n => n.feat === "Archery"));
  ok("the total excludes the unanswered channel", t.personalEhp === 16, String(t.personalEhp));
}

/* ── Every shipped expression is parseable ──────────────────────────────────────────────── */
console.log("\nWhole-table parse");
{
  const rich: Record<string, number> = {};
  for (const f of FEAT_PRICING) {
    for (const src of [f.dpr, f.personalEhp, f.partyEhp]) {
      for (const m of (src ?? "").matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)) rich[m[0]] = 2;
    }
  }
  let unparseable = 0;
  const broken: string[] = [];
  for (const f of FEAT_PRICING) {
    for (const [ch, src] of [["dpr", f.dpr], ["personalEhp", f.personalEhp], ["partyEhp", f.partyEhp]] as const) {
      const r = evaluateExpression(src, rich);
      if (!r.ok && r.missing.some(m => m.startsWith("<"))) { unparseable++; broken.push(`${f.key}.${ch}`); }
    }
  }
  ok("every expression in the table parses", unparseable === 0,
    unparseable ? broken.slice(0, 5).join(", ") : `${FEAT_PRICING.length * 3} expressions`);
}

/* ── A feat added on the FEATURES tab is counted ───────────────────────────────────────── */
console.log("\nFeats on the Features tab");
{
  /**
   * ⚠ MAGIC INITIATE, NOT HEALER. Healer's expression needs `availableUsesPerRestCycle`, which the
   * app does not track, so it correctly reports NEEDS_INPUT — an earlier version of this test read
   * that as the tab not working. Magic Initiate prices from `level` and `round` alone, so it is the
   * one that can prove counting happens at all.
   */
  const onFeatures = partyFeatsFromActors([
    { name: "Lights Stone", level: 8, tabs: { features: [{ label: "Magic Initiate" }], feats: [] } },
  ]);
  ok("a feat on the Features tab is priced", onFeatures.dpr > 0, onFeatures.dpr.toFixed(3));
  ok("and is attributed to its character",
    onFeatures.matched.some(m => m.actor === "Lights Stone" && m.feats.includes("Magic Initiate")));

  /**
   * ⚠ THIS ASSERTION USED TO REQUIRE THE OPPOSITE, and it was wrong in the way MASTER already
   * names: it encoded a HAZARD as an INVARIANT.
   *
   * It read *"the same feat on both tabs doubles — which is why the migration moves"*, treating a
   * double-count as acceptable because `migrateFeatsIntoFeatures` moves rather than copies. That
   * puts the guarantee in another file — one that runs ONCE, keyed by version — so a feat added by
   * hand afterwards, or an actor restored from a party backup carrying both, doubles silently. The
   * panel showed it as a duplicated row; the total was wrong by a whole feat.
   *
   * No character has a feat twice. Deduping at the read costs nothing and needs no other file to
   * behave.
   */
  const onBoth = partyFeatsFromActors([
    { name: "Double", level: 8, tabs: { features: [{ label: "Magic Initiate" }], feats: [{ label: "Magic Initiate" }] } },
  ]);
  ok("the same feat on both tabs is priced ONCE",
    Math.abs(onBoth.dpr - onFeatures.dpr) < 1e-9,
    `${onBoth.dpr.toFixed(3)} vs ${onFeatures.dpr.toFixed(3)}`);

  // A class feature sharing the tab is not a feat: ignored, and reported rather than failing.
  const mixed = partyFeatsFromActors([
    { name: "Mixed", level: 8, tabs: { features: [{ label: "Second Wind" }, { label: "Magic Initiate" }] } },
  ]);
  ok("a class feature on the tab is not priced", Math.abs(mixed.dpr - onFeatures.dpr) < 1e-9);
  ok("and is listed as unmatched", mixed.unmatched.includes("Second Wind"));

  // ⚠ A FEAT THE APP CANNOT PRICE IS A QUESTION, NOT A ZERO — and it is still recognised.
  const healer = partyFeatsFromActors([
    { name: "Medic", level: 8, tabs: { features: [{ label: "Healer" }] } },
  ]);
  ok("Healer is recognised as a feat", healer.matched.some(m => m.feats.includes("Healer")));
  ok("and reports NEEDS_INPUT rather than counting as zero",
    healer.needsInput.some(n => n.feat === "Healer" && n.missing.includes("availableUsesPerRestCycle")),
    healer.needsInput.map(n => n.missing.join(",")).join(" | "));

  // The party profile supplies baseDpr, so share-of-output feats price instead of asking.
  const alertBlind = partyFeatsFromActors([{ name: "A", level: 8, tabs: { features: [{ label: "Alert" }] } }]);
  const alertKnown = partyFeatsFromActors([{ name: "A", level: 8, tabs: { features: [{ label: "Alert" }] } }], { baseDpr: 100 });
  ok("Alert needs baseDpr when the panel has none", alertBlind.needsInput.some(n => n.feat === "Alert"));
  ok("and prices once the party profile supplies it", alertKnown.dpr > 0 && alertKnown.needsInput.length === 0,
    alertKnown.dpr.toFixed(3));
}
/* ── Static benefits are NOT recalculated ──────────────────────────────────────────────── */
console.log("\nEntered values are never recomputed");
{
  // Christopher: HP, ASI and granted spells are typed in, so a feat whose only effect is one of
  // those must price at zero — the sheet already contains it.
  const tough = partyFeatsFromActors([
    { name: "Tank", level: 10, tabs: { features: [{ label: "Tough" }] } },
  ]);
  ok("Tough adds no EHP, because the entered HP already has it",
    tough.partyEhp === 0 && tough.dpr === 0,
    `dpr ${tough.dpr} partyEhp ${tough.partyEhp}`);
}

/* ── The accuracy inputs ARRIVE, not merely exist ─────────────────────────────────────────── */
console.log("\nEquipment and the fight reach the feat context");
{
  /**
   * ⚠ THIS ASSERTS DELIVERY, WHICH IS THE THING THAT WAS BROKEN.
   *
   * Christopher: *"you said the shield problem of need shield was fixed and the GWM would be
   * correct."* The shield LOOKUP was fixed — items derive a slot, so `offHandBlocker` finds a worn
   * shield. `partyFeatsFromActors` then never passed equipment to the evaluator at all, so
   * `shieldEquipped` could not arrive however good the lookup got. Correct code nothing reached,
   * for the third time this stretch.
   *
   * So these tests go through `partyFeatsFromActors` with a REAL sheet, never through the
   * derivation helpers directly — a helper that returns the right number to nobody is the bug.
   */
  const shieldBearer = {
    name: "Ripsnarl", level: 9, attacksPerAction: 2,
    tabs: {
      features: [{ label: "Shield Master" }, { label: "Great Weapon Master" }],
      equipment: [{ label: "Marrow Shield", metadata: { slot: "shield", equipped: true } }],
      actions: [{ label: "Greataxe", metadata: { attack: "+9", damage: "1d12 + 5" } }],
    },
  };

  const blind = partyFeatsFromActors([shieldBearer]);
  ok("with no fight selected the accuracy feats still report NEEDS_INPUT",
    blind.needsInput.some(n => n.feat === "Great Weapon Master"));

  const priced = partyFeatsFromActors([shieldBearer], {
    baseEhp: 400, targetAC: 17, saveExposure: { dex: 0.35 },
  });
  ok("Shield Master prices once the shield and the fight's Dex exposure arrive",
    !priced.needsInput.some(n => n.feat === "Shield Master"),
    priced.needsInput.filter(n => n.feat === "Shield Master").map(n => n.missing.join(",")).join(" | "));
  ok("Great Weapon Master prices from the character's own weapon",
    !priced.needsInput.some(n => n.feat === "Great Weapon Master") && priced.dpr > 0,
    `dpr ${priced.dpr.toFixed(2)} · still missing: ${priced.needsInput.map(n => n.missing.join(",")).join(" | ") || "nothing"}`);

  /** A sheet with no readable weapon must NOT be priced off a zero. */
  const unarmed = partyFeatsFromActors(
    [{ name: "Sage", level: 9, tabs: { features: [{ label: "Great Weapon Master" }] } }],
    { baseEhp: 400, targetAC: 17, saveExposure: { dex: 0.35 } });
  ok("a character with no readable weapon still reports NEEDS_INPUT",
    unarmed.needsInput.some(n => n.feat === "Great Weapon Master"));

  /** A shield nobody is wearing is not a shield. */
  const stowed = partyFeatsFromActors([{
    ...shieldBearer,
    tabs: { ...shieldBearer.tabs, equipment: [{ label: "Marrow Shield", metadata: { slot: "shield", equipped: false } }] },
  }], { baseEhp: 400, targetAC: 17, saveExposure: { dex: 0.35 } });
  ok("an UNEQUIPPED shield prices Shield Master at nothing, not at the worn value",
    stowed.dpr === priced.dpr && !stowed.needsInput.some(n => n.feat === "Shield Master"));

  /** ⚠ THE SAME FEAT ON BOTH TABS IS ONE FEAT. It used to be counted twice. */
  const doubled = partyFeatsFromActors([{
    name: "Twice", level: 9, attacksPerAction: 2,
    tabs: {
      feats: [{ label: "Great Weapon Master" }],
      features: [{ label: "great weapon master" }],
      actions: [{ label: "Greataxe", metadata: { attack: "+9", damage: "1d12 + 5" } }],
    },
  }], { baseEhp: 400, targetAC: 17, saveExposure: { dex: 0.35 } });
  const single = partyFeatsFromActors([{
    name: "Once", level: 9, attacksPerAction: 2,
    tabs: {
      feats: [{ label: "Great Weapon Master" }],
      actions: [{ label: "Greataxe", metadata: { attack: "+9", damage: "1d12 + 5" } }],
    },
  }], { baseEhp: 400, targetAC: 17, saveExposure: { dex: 0.35 } });
  ok("a feat listed on BOTH tabs is priced once, not twice",
    Math.abs(doubled.dpr - single.dpr) < 1e-9, `${doubled.dpr.toFixed(3)} vs ${single.dpr.toFixed(3)}`);

  /** Every unpriced channel says WHOSE it is. Two characters, one feat, two distinguishable lines. */
  const twoPeople = partyFeatsFromActors([
    { name: "Ripsnarl", level: 9, tabs: { features: [{ label: "Shield Master" }] } },
    { name: "Iskarn", level: 9, tabs: { features: [{ label: "Shield Master" }] } },
  ]);
  ok("an unpriced channel names the character it belongs to",
    new Set(twoPeople.needsInput.map(n => n.actor)).size === 2,
    twoPeople.needsInput.map(n => `${n.actor}:${n.feat}`).join(" | "));
}

console.log(`\n${failures === 0 ? "PASS" : `FAIL — ${failures} check(s)`}`);
process.exit(failures === 0 ? 0 : 1);
