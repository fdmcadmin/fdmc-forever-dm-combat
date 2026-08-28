/**
 * THE SRD GATE — the parse against the audit, and the CR 26-30 extension.
 *
 * Run: npm run check:srd
 *
 * RULE 1: `SRD_5.2.1_creature_pricing_mechanics_audit.md` is the authority. It read the printed
 * pages; `import-srd.mjs` read a text layer that drops digits. This gate asserts the library agrees
 * with the document wherever the document speaks, and COUNTS what it cannot fix.
 *
 * ⚠ THE DEFICIT IS ASSERTED, NOT HIDDEN. 38 stat blocks the audit lists were never produced by the
 * parser, and they cannot be recovered from the audit — it carries no actions, and a body with AC
 * and HP and no actions prices at zero DPR. The count is pinned here so it can only go DOWN
 * silently; going UP fails.
 *
 * ⚠ THE EXIT CHECK IS THE LAST THING IN THIS FILE. See MASTER on `check:summons`.
 */

import {
  SRD_LIBRARY, SRD_ABSENT, SRD_UNMATCHED, SRD_CORRECTED, SRD_STILL_INCOMPLETE,
  SRD_USABLE, SLOT_SCALED_SUMMONS, srdNameKey,
} from "../src/modules/dnd-5e/srdLibrary";
import { SRD_AUDIT_CHASSIS, SRD_AUDIT_CR_ROWS } from "../src/modules/dnd-5e/srdAuditChassis.generated";
import { estimateCreature } from "../src/core/encounter-band/creatureEstimator";

let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};

console.log(`SRD 5.2.1 — ${SRD_AUDIT_CHASSIS.length} audited blocks vs ${SRD_LIBRARY.length} parsed\n`);

/* ── The audit is loaded and complete ───────────────────────────────────────────────────── */
console.log("The audit document");
ok("all 330 chassis rows present", SRD_AUDIT_CHASSIS.length === 330, String(SRD_AUDIT_CHASSIS.length));
ok("every row carries AC, HP and a CR",
  SRD_AUDIT_CHASSIS.every(c => c.ac > 0 && c.hp > 0 && c.cr.length > 0));
ok("the CR 26-30 extension has five rows", SRD_AUDIT_CR_ROWS.length === 5);

/* ── The corrections actually landed ────────────────────────────────────────────────────── */
console.log("\nThe audit corrects the parse");
{
  ok("something was corrected", SRD_CORRECTED.length > 0, `${SRD_CORRECTED.length} record(s)`);

  // Every creature matched to a printed page now agrees with it, by construction.
  const disagree = SRD_LIBRARY.filter(c => c.chassis && (
    String(c.cr) !== c.chassis.cr || c.ac !== c.chassis.ac || c.hp !== c.chassis.hp));
  ok("no matched creature disagrees with its printed page", disagree.length === 0,
    disagree.slice(0, 3).map(c => c.name).join(", "));

  // The named repairs the audit was adopted for.
  const byName = new Map(SRD_LIBRARY.map(c => [srdNameKey(c.name), c]));
  const expect: Array<[string, "cr" | "ac" | "hp", string | number]> = [
    ["Gold Dragon Wyrmling", "cr", "3"],
    ["Silver Dragon Wyrmling", "cr", "2"],
    ["White Dragon Wyrmling", "cr", "2"],
    ["Young White Dragon", "cr", "6"],
    ["Bat", "hp", 1], ["Frog", "hp", 1], ["Hawk", "hp", 1], ["Owl", "hp", 1],
    ["Rat", "hp", 1], ["Weasel", "hp", 1], ["Spider", "hp", 1], ["Scorpion", "hp", 1],
    ["Piranha", "hp", 1], ["Kobold Warrior", "hp", 7], ["Octopus", "cr", "0"],
    ["Vulture", "cr", "0"],
  ];
  for (const [name, field, want] of expect) {
    const c = byName.get(srdNameKey(name));
    ok(`${name}: ${field} = ${want}`, Boolean(c) && String(c![field]) === String(want),
      c ? `got ${String(c[field])}` : "not in the library");
  }
}

/* ── A summon is not missing a CR ───────────────────────────────────────────────────────── */
console.log("\nSpell summons scale with the slot, not a CR");
{
  const byName = new Map(SRD_LIBRARY.map(c => [srdNameKey(c.name), c]));
  for (const name of SLOT_SCALED_SUMMONS) {
    const c = byName.get(srdNameKey(name));
    ok(`${name}: marked slot-scaled`, c?.scaling === "slot", c ? c.scaling : "not in the library");
    ok(`${name}: CR is not reported as missing`, Boolean(c) && !c!.missing.includes("CR"),
      c ? `missing [${c.missing}]` : "");
  }
  ok("no other record is slot-scaled",
    SRD_LIBRARY.filter(c => c.scaling === "slot").length === SLOT_SCALED_SUMMONS.length);
}

/* ── Curly punctuation is not an absence ────────────────────────────────────────────────── */
console.log("\nName folding");
{
  ok("the mangled apostrophe folds to the printed name",
    srdNameKey("Will-o -Wisp") === srdNameKey("Will-o’-Wisp"));
  const wisp = SRD_LIBRARY.find(c => srdNameKey(c.name) === srdNameKey("Will-o’-Wisp"));
  ok("so Will-o'-Wisp matches its page rather than reading as missing", Boolean(wisp?.chassis));
}

/* ── The deficit, counted ───────────────────────────────────────────────────────────────── */
console.log("\nWhat the audit cannot fix");
{
  // ⚠ PINNED. This may fall when the PDF is re-parsed; it must never rise unnoticed.
  ok("38 audited creatures are still absent from the parse", SRD_ABSENT.length === 38,
    `${SRD_ABSENT.length}: ${SRD_ABSENT.slice(0, 4).map(c => c.name).join(", ")}…`);
  ok("nothing absent was invented into the library",
    SRD_LIBRARY.every(c => c.chassis || c.scaling === "slot" || SRD_UNMATCHED.includes(c)));
  ok("the parser's own fragments are quarantined, not offered",
    SRD_UNMATCHED.every(c => !SRD_USABLE.includes(c)), `${SRD_UNMATCHED.length} unmatched`);
  ok("nothing incomplete is offered as usable",
    SRD_STILL_INCOMPLETE.every(c => !SRD_USABLE.includes(c)),
    `${SRD_STILL_INCOMPLETE.length} incomplete, ${SRD_USABLE.length} usable`);
}

/* ── M28 — the estimator reaches CR 30 ──────────────────────────────────────────────────── */
console.log("\nM28 — the estimator reaches CR 30");
{
  // Below the extension nothing may move: a mid-table creature prices exactly as before.
  const mid = estimateCreature({ rawHp: 150, ac: 17, r1Dpr: 40, r2PlusDpr: 40,
    offenseBasis: "attackBonus", attackBonus: 9 });
  ok("a mid-table creature still lands inside the table",
    mid.capStatus === "WITHIN CR 0-30 TABLE" && typeof mid.estimatedCr === "number",
    `${mid.estimatedCr}`);

  // The Tarrasque is the block M28 exists for: 676 HP, AC 25, and a very large three-round DPR.
  const tarrasque = estimateCreature({ rawHp: 676, ac: 25, r1Dpr: 290, r2PlusDpr: 290,
    offenseBasis: "attackBonus", attackBonus: 19 });
  ok("the Tarrasque no longer falls off the top",
    tarrasque.capStatus === "WITHIN CR 0-30 TABLE",
    `${tarrasque.capStatus}, cr ${tarrasque.estimatedCr}`);
  ok("and it rates above CR 25",
    typeof tarrasque.estimatedCr === "number" && tarrasque.estimatedCr > 25,
    String(tarrasque.estimatedCr));

  // Past CR 30 it must still say so rather than pretend.
  const beyond = estimateCreature({ rawHp: 2000, ac: 30, r1Dpr: 900, r2PlusDpr: 900,
    offenseBasis: "attackBonus", attackBonus: 25 });
  ok("past the table it reports manual review", beyond.capStatus === "ABOVE CR 30 - MANUAL REVIEW");
  ok("and the sentinel names the new top", beyond.estimatedCr === "30+", String(beyond.estimatedCr));

  // The bands are continuous with the sheet: CR 25 closed at 625/230, CR 26 opens at 626/231.
  const row26 = SRD_AUDIT_CR_ROWS.find(r => r.cr === 26)!;
  ok("the audit's CR 26 HP band opens where CR 25 closed", row26.hpLow === 626, String(row26.hpLow));
  ok("and its DPR band likewise", row26.dprLow === 231, String(row26.dprLow));
}

console.log(`\n${failures === 0 ? "PASS" : `FAIL — ${failures} check(s)`}`);
process.exit(failures === 0 ? 0 : 1);
