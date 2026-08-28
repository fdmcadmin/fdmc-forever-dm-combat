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

  // ⚠ THE MIGRATION MOVES RATHER THAN COPIES — the same feat on both tabs would count twice.
  const onBoth = partyFeatsFromActors([
    { name: "Double", level: 8, tabs: { features: [{ label: "Magic Initiate" }], feats: [{ label: "Magic Initiate" }] } },
  ]);
  ok("the same feat on both tabs doubles — which is why the migration moves",
    Math.abs(onBoth.dpr - onFeatures.dpr * 2) < 1e-9,
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

console.log(`\n${failures === 0 ? "PASS" : `FAIL — ${failures} check(s)`}`);
process.exit(failures === 0 ? 0 : 1);
