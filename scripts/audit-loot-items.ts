/**
 * THE LOOT DOCUMENT vs THE ITEMS THE APP SHIPS.
 *   npx tsx scripts/audit-loot-items.ts <loot.txt>
 *
 * Christopher, 2026-09-10: *"do a full item audit then fix the items that use charge in combat and
 * ensure the riders are there for the same kind of items"*, after finding that *"the per turn rider
 * on weapons are only on the gift chassis not the regular weapons."*
 *
 * ─── ⚠ WHAT THIS READS, AND WHY IT READS THE PROSE ──────────────────────────────────────────
 *
 * The document is the authority for what an item DOES; the app is where that has to become fields.
 * So this parses the published Effect line and asks two questions of every item:
 *
 *   · does it fire ONCE PER ROUND / TURN on a hit?      -> it needs a `riders` entry
 *   · does it spend a CHARGE with an action cost?       -> it needs `charges` AND `activation`
 *
 * ⚠ IT NEVER GUESSES FROM A NAME. "Never infer data from prose" is a standing rule here, and the
 * exception it allows is exactly this: reading a STATED mechanic out of the item's own published
 * effect text, reported for a human to act on rather than written silently into the library.
 *
 * ⚠ AND IT REPORTS, IT DOES NOT WRITE. A fold is how authored content changes; this is the list
 * that fold is built from, and the same list re-run afterwards is the proof.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BROKEN_CHAIN_EQUIPMENT_LIBRARY as EQUIPMENT_LIBRARY } from "../src/data/broken-chain/equipmentLibrary";

type DocItem = { name: string; typeLine: string; effect: string };

const file = process.argv[2] ?? "loot.txt";
const lines = readFileSync(resolve(file), "utf8").split("\n");

/**
 * An item entry is a NAME line followed by an `Effect.` line. The name line carries the type after
 * a run of spaces — "Rimecleaver  Melee Two-Handed (greatsword) · +1" — and a heading never does.
 */
const docItems: DocItem[] = [];
for (let i = 1; i < lines.length; i++) {
  if (!/^Effect\./.test(lines[i])) continue;
  const head = lines[i - 1].trim();
  // "Source." / "Note." lines are prose ABOUT an item, never the name of one.
  if (!head || /^(Description|Effect|Table|Pick|Source|Note|Awarded|Requirement)\b/.test(head)) continue;
  const split = head.match(/^(.+?)\s{2,}(.+)$/);
  const name = (split ? split[1] : head).trim();
  const typeLine = split ? split[2].trim() : "";
  let effect = lines[i].replace(/^Effect\.\s*/, "");
  // An effect can run to a second paragraph before the Description.
  for (let j = i + 1; j < lines.length && !/^(Description|Effect)\./.test(lines[j]); j++) {
    if (/^\S.*\s{2,}\S/.test(lines[j])) break;   // the next item's name line
    effect += " " + lines[j];
  }
  if (name.length < 60) docItems.push({ name, typeLine, effect: effect.trim() });
}

/** Fires on a hit, once a round or turn — the shape `ItemRider` exists for. */
const RIDER = /\bonce per (?:round|turn)\b[^.]*?\b(?:when you hit|when an attack|on a hit|hits?)\b|\b(?:when you hit)[^.]*?\bonce per (?:round|turn)\b/i;
/** Spends a charge, and states an action cost for spending it. */
/**
 * ⚠ A CHARGE AND A PER-DAY USE ARE THE SAME POOL WEARING TWO NAMES. "expend 1 charge" and
 * "1/day; recharges at dawn" both mean a limited pool the card has to count down, and a good half
 * of the combat items in this document are written the second way.
 */
const CHARGE_IN_COMBAT = /\bexpend(?:s|ing)? \d+ charge\b|\b\d+\s*\/\s*day\b|\bhas \d+ charges\b|\b\d+\s*\/\s*(?:short|long) rest\b/i;
const ACTION_COST = /\bas an? (magic |bonus |free )?action\b|\bas a reaction\b/i;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
const byName = new Map(EQUIPMENT_LIBRARY.map(i => [norm(i.name), i as Record<string, unknown>]));

const missingRider: string[] = [];
const missingCharges: string[] = [];
const missingActivation: string[] = [];
const notInApp: string[] = [];
let riderExpected = 0;
let chargeExpected = 0;

for (const d of docItems) {
  const app = byName.get(norm(d.name));
  if (!app) { notInApp.push(`${d.name}  ${d.typeLine}`); continue; }

  if (RIDER.test(d.effect)) {
    riderExpected++;
    const riders = (app.riders ?? []) as Array<{ cadence?: string }>;
    if (!riders.some(r => r.cadence === "perTurn" || r.cadence === "perRound")) {
      missingRider.push(`${d.name}\n      ${d.effect.slice(0, 150)}`);
    }
  }

  if (CHARGE_IN_COMBAT.test(d.effect)) {
    chargeExpected++;
    const charges = app.charges as { max?: number } | undefined;
    if (!charges || !(charges.max! > 0)) missingCharges.push(`${d.name}  — ${d.typeLine}`);
    if (ACTION_COST.test(d.effect) && !app.activation) {
      missingActivation.push(`${d.name}  — ${(d.effect.match(ACTION_COST) ?? [""])[0]}`);
    }
  }
}

const head = (t: string) => console.log(`\n${t}\n${"─".repeat(100)}`);
console.log(`LOOT AUDIT — ${docItems.length} items in the document, ${EQUIPMENT_LIBRARY.length} in the app\n`);
console.log(`  the document states a once-per-round rider on   ${riderExpected} item(s)`);
console.log(`  the document states a charge spent in combat on ${chargeExpected} item(s)`);

head(`MISSING RIDER — the effect fires once a round on a hit, the item carries none (${missingRider.length})`);
missingRider.forEach(m => console.log(`  ${m}`));
if (!missingRider.length) console.log("  none");

head(`MISSING CHARGES — the effect expends a charge, the item has no pool (${missingCharges.length})`);
missingCharges.forEach(m => console.log(`  ${m}`));
if (!missingCharges.length) console.log("  none");

head(`MISSING ACTIVATION — spends a charge for a stated action cost, no activation set (${missingActivation.length})`);
missingActivation.forEach(m => console.log(`  ${m}`));
if (!missingActivation.length) console.log("  none");

head(`IN THE DOCUMENT, NOT IN THE APP (${notInApp.length})`);
notInApp.slice(0, 40).forEach(m => console.log(`  ${m}`));
if (notInApp.length > 40) console.log(`  … and ${notInApp.length - 40} more`);
if (!notInApp.length) console.log("  none");

const gaps = missingRider.length + missingCharges.length + missingActivation.length;
console.log(`\n${gaps === 0 ? "NO GAPS" : `${gaps} GAP(S)`} across ${docItems.length} documented items.`);
