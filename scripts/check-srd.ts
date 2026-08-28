/**
 * THE SRD GATE — the parse against the audit, and the CR 26-30 extension.
 *
 * Run: npm run check:srd
 *
 * RULE 1: `SRD_5.2.1_creature_pricing_mechanics_audit.md` is the authority. It read the printed
 * pages; `import-srd.mjs` read a text layer that drops digits. This gate asserts the library agrees
 * with the document wherever the document speaks, and COUNTS what it cannot fix.
 *
 * ⚠ EVERY AUDITED CREATURE MUST PARSE. This started at 301 of 330 with the shortfall reported as a
 * success, because the old importer guessed names from layout and dropped an anchor it could not
 * read with a bare `continue` — no exception, no count. The parser is anchored on the audit's own
 * names now and `SRD_ABSENT` must be EMPTY. A creature going missing is a build failure, not a
 * footnote.
 *
 * ⚠ THE EXIT CHECK IS THE LAST THING IN THIS FILE. See MASTER on `check:summons`.
 */

import {
  SRD_LIBRARY, SRD_ABSENT, SRD_UNMATCHED, SRD_CORRECTED, SRD_STILL_INCOMPLETE,
  SRD_USABLE, SLOT_SCALED_SUMMONS, srdNameKey, SRD_OFF_AUDITED_PAGES,
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

/* ── The parser reads printed names ─────────────────────────────────────────────────────── */
console.log("\nNames come out as printed");
{
  const byName = new Map(SRD_LIBRARY.map(c => [c.name, c]));

  // Each of these was a DIFFERENT way for a name to break, and each cost real creatures. They are
  // named individually so a regression says WHICH defect came back, not just that the count moved.
  const named: Array<[string, string]> = [
    ["Gray Ooze", "a group heading no longer swallows the name"],
    ["Shrieker Fungus", "'Fungi' is not glued to the front of it"],
    ["Swarm of Crawling Claws", "a swarm's size line no longer becomes its name"],
    ["Swarm of Bats", "and neither does its neighbour's"],
    ["Swarm of Ravens", "the swarm sharing a CR/AC/HP triple with Bats parses on its own"],
    ["Will-o\u2019-Wisp", "CP1252 punctuation decodes, so the apostrophe survives"],
    ["Giant Rat", "a short name no longer anchors inside a longer one"],
    ["Rat", "and the short name still parses where it really lives"],
    ["Aboleth", "the first block in the book is not skipped"],
    ["Kraken", "nor is a large one"],
    ["Treant", "nor a mid-book one"],
  ];
  for (const [name, why] of named) {
    ok(`${name} — ${why}`, byName.has(name), byName.has(name) ? "" : "NOT IN THE LIBRARY");
  }

  const sizeNamed = SRD_LIBRARY.filter(c => /^(Tiny|Small|Medium|Large|Huge|Gargantuan)\b/.test(c.name));
  ok("no record is named after a size line", sizeNamed.length === 0,
    sizeNamed.map(c => c.name).join(", "));

  const withActions = SRD_LIBRARY.filter(c => (c.actions?.length ?? 0) > 0).length;
  ok("bodies survived the re-anchor — 328+ creatures have actions", withActions >= 328,
    `${withActions} of ${SRD_LIBRARY.length}`);
}

/* ── The deficit, counted ───────────────────────────────────────────────────────────────── */
console.log("\nWhat the audit cannot fix");
{
  ok("NO audited creature is absent from the parse", SRD_ABSENT.length === 0,
    SRD_ABSENT.length ? SRD_ABSENT.map(c => c.name).join(", ") : "all 330 present");
  ok("the parse produces no fragment records at all", SRD_UNMATCHED.length === 0,
    SRD_UNMATCHED.map(c => c.name).join(", ") || "none");
  ok("every record is either an audited page or a known off-page block",
    SRD_LIBRARY.every(c => c.chassis || SRD_OFF_AUDITED_PAGES.includes(c.name)));
  ok("nothing incomplete is offered as usable",
    SRD_STILL_INCOMPLETE.every(c => !SRD_USABLE.includes(c)),
    `${SRD_STILL_INCOMPLETE.length} incomplete, ${SRD_USABLE.length} usable`);
  ok("all 330 audited creatures are usable",
    SRD_USABLE.filter(c => c.chassis).length === 330,
    `${SRD_USABLE.filter(c => c.chassis).length}`);
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
