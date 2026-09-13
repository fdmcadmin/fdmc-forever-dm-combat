/**
 * THE v5 READER LAYER — imported exactly, and every Act 3 clause composed from it.
 *   npx tsx scripts/check-broad-readers.ts
 *
 * Christopher, 2026-09-13, on the v5 pricer: *"Reader layer first."* The workbook's Parser Coverage Gate
 * states its own expected counts; the import is held to them. Then the compositions the workbook itself
 * lists for the current Act 3 creatures are required of the app's reader, and the Runtime Contract's
 * duration rule is proven to fail when a lasting state has no duration.
 *
 * ⚠ NOT A "ZERO NEEDS_INPUT ACROSS THE LIBRARY" ASSERTION. Authored content folds through CI; a DM
 * writing a new sentence must never fail a publish. The library count is REPORTED.
 */
import {
  BROAD_READERS, FINAL_EFFECTS, READER_FAMILIES, READER_COMPOSITIONS, PRIMITIVE_READER_ALIASES, BROAD_READER_EXPECTED,
} from "../src/core/encounter-band/broadReaders.generated";
import { composeReaders } from "../src/core/encounter-band/broadReaderGate";
import { BROKEN_CHAIN_MONSTER_LIBRARY as L } from "../src/data/broken-chain/monsterLibrary";
import type { MainMonsterTemplate } from "../src/core/monsters/runtime/mainMonsterRuntime";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};

console.log("The v5 broad reader layer\n");

console.log("1. the import matches the workbook's own Parser Coverage Gate");
const readerIds = new Set(BROAD_READERS.map(r => r.id));
const finalIds = new Set(FINAL_EFFECTS.map(f => f.id));
ok(`${BROAD_READER_EXPECTED.readers} broad readers`, BROAD_READERS.length === BROAD_READER_EXPECTED.readers, String(BROAD_READERS.length));
ok(`${BROAD_READER_EXPECTED.families} reader families, in parse order`, READER_FAMILIES.length === BROAD_READER_EXPECTED.families
  && READER_FAMILIES[0] === "Resolution" && READER_FAMILIES[1] === "Targeting", READER_FAMILIES.join(" → "));
ok(`${BROAD_READER_EXPECTED.finals} endpoint patterns`, FINAL_EFFECTS.length === BROAD_READER_EXPECTED.finals);
ok(`${BROAD_READER_EXPECTED.aliases} legacy primitives aliased`, PRIMITIVE_READER_ALIASES.length === BROAD_READER_EXPECTED.aliases);
ok(`${BROAD_READER_EXPECTED.concentrationReaders} concentration readers`,
  BROAD_READERS.filter(r => /concentration/i.test(r.name)).length === BROAD_READER_EXPECTED.concentrationReaders);
ok(`${BROAD_READER_EXPECTED.twoTurnReaders} exactly-two-turn reader`, BROAD_READERS.filter(r => /two turns/i.test(r.name)).length === BROAD_READER_EXPECTED.twoTurnReaders);
ok("every alias and composition names a reader or endpoint that exists",
  PRIMITIVE_READER_ALIASES.every(a => a.readers.length > 0 && a.readers.every(id => readerIds.has(id)))
  && READER_COMPOSITIONS.every(c => c.readers.every(id => readerIds.has(id)) && c.finals.every(id => finalIds.has(id))));

console.log("\n2. the Act 3 creatures compose as the workbook reads them");
const by = (n: string) => L.find(t => t.name === n) as MainMonsterTemplate;
const readersOf = (creature: string, mechanic: string) => {
  const m = composeReaders(by(creature)).mechanics.find(x => x.name === mechanic);
  return { ids: new Set(m?.readers.map(r => r.id) ?? []), finals: new Set(m?.finals.map(f => f.id) ?? []), needs: m?.needsInput ?? [] };
};
const expect = (creature: string, mechanic: string, readers: string[], finals: string[] = []) => {
  const got = readersOf(creature, mechanic);
  const missing = readers.filter(id => !got.ids.has(id));
  const missingFinals = finals.filter(id => !got.finals.has(id));
  ok(`${creature} · ${mechanic} ⊇ ${[...readers, ...finals].join(" + ")}`, missing.length === 0 && missingFinals.length === 0 && got.needs.length === 0,
    missing.length || missingFinals.length ? `missing ${[...missing, ...missingFinals].join(", ")}` : got.needs.join("; "));
};
// Workbook Profile Actions "Broad Reader IDs" for these packets, plus the duration/endpoint readers r35/r36 require.
expect("Brandwing", "Ember Lance", ["BR001", "BR014", "BR029", "BR030", "BR083"]);
expect("Brandwing", "Closing Stroke", ["BR031", "BR084"]);
expect("Brandwing", "Cinder Skip", ["BR085", "BR012", "BR052"]);
expect("Gloam Harrow", "Winter’s Toll", ["BR024", "BR018", "BR046", "BR047", "BR066", "BR070", "BR073", "BR083"], ["FE29", "FE23", "FE26"]);
expect("Gloam Harrow", "Cruel Instruction", ["BR095", "BR084"]);
expect("Gloam Harrow", "Cold Counsel", ["BR085", "BR026", "BR051"]);
expect("Demon Knight of Punishment", "Commanding Presence", ["BR025", "BR085"]);
expect("Demon Knight of Punishment", "Reckless Sentence", ["BR046", "BR062", "BR084"], ["FE26"]);
// "escape DC 16" is the grapple's own ending, not a second saving throw: BR001, not BR006; endpoint FE08.
expect("Demon Knight of Punishment", "Iron Grasp", ["BR001", "BR029", "BR053", "BR083"], ["FE08"]);
expect("Blackbough Reeve", "Final Pruning", ["BR012", "BR029", "BR085"]);
// A claw roll with a CON DC 10 save field is BR006; "until end of its next turn" with no article is still BR063.
expect("Hollow Mourner", "Claws", ["BR006", "BR058", "BR063"], ["FE01"]);
ok("Winter's Toll imposes no condition and makes no attack roll ('ends early if Harrow is Incapacitated' is its ending)", (() => {
  const tolls = composeReaders(by("Gloam Harrow")).mechanics.filter(m => m.name === "Winter’s Toll");
  return tolls.length > 0 && tolls.every(m => !m.readers.some(r => r.id === "BR058" || r.id === "BR001"));
})());
const refraction = composeReaders(by("Elemental Mirror")).mechanics.find(m => m.name === "Reactive Refraction");
ok("'impose Disadvantage on that attack' is one attack, not a lasting state", !!refraction && refraction.needsInput.length === 0, refraction?.needsInput.join("; "));

console.log("\n3. the Runtime Contract's duration rule bites");
const base = by("Brandwing");
const withAction = (text: string) => ({ ...base, actions: [...(base.actions ?? []), { name: "Test Glare", kind: "action", text }] }) as unknown as MainMonsterTemplate;
const glare = (text: string) => composeReaders(withAction(text)).mechanics.find(m => m.name === "Test Glare")!;
const noDuration = glare("The target has the Frightened condition.");
ok("a lasting condition with no duration is NEEDS_INPUT (r35)", noDuration.needsInput.some(n => /no duration reader/.test(n)), noDuration.needsInput.join("; "));
const timed = glare("The target has the Frightened condition until the end of its next turn.");
ok("  (mutation) the same condition 'until the end of its next turn' composes", timed.needsInput.length === 0 && timed.readers.some(r => r.id === "BR063"),
  timed.readers.map(r => r.id).join(" + "));
ok("  ...and names its endpoint, even if only a clean expiration (r36)", timed.finals.length > 0, timed.finals.map(f => f.id).join(", "));
const shove = glare("The Brandwing moves the target up to 10 feet. This movement does not provoke Opportunity Attacks.");
ok("a move that does not provoke is not a lasting Reaction lock", shove.needsInput.length === 0 && shove.readers.some(r => r.id === "BR059"),
  shove.needsInput.join("; ") || shove.readers.map(r => r.id).join(" + "));
const locked = glare("The target can't take Reactions.");
ok("  (mutation) 'can't take Reactions' with no duration is NEEDS_INPUT", locked.needsInput.some(n => /BR059/.test(n)), locked.needsInput.join("; "));
const lance = composeReaders(by("Brandwing")).mechanics.find(m => m.name === "Ember Lance")!;
ok("each reader names the workbook variables its formula uses (BR001 → P_HIT)",
  lance.readers.find(r => r.id === "BR001")?.variables.includes("P_HIT") === true, lance.readers.find(r => r.id === "BR001")?.variables.join(", "));
const tollExample = composeReaders(by("Gloam Harrow")).mechanics.find(m => m.name === "Winter’s Toll")?.example;
ok("Winter's Toll points at the workbook's concentration-zone example", tollExample?.id === "EX01", tollExample ? `${tollExample.id} ${tollExample.shared}/${tollExample.of}` : "none");
ok("readers are listed in the workbook's parse order", (() => {
  const toll = composeReaders(by("Gloam Harrow")).mechanics.find(m => m.name === "Winter’s Toll")!;
  const ranks = toll.readers.map(r => READER_FAMILIES.indexOf(r.family));
  return ranks.every((r, i) => i === 0 || r >= ranks[i - 1]);
})());

console.log("\n4. the estimator shows it");
const panel = readFileSync(resolve(ROOT, "src/core/encounter-band/CreatureEstimatorPanel.tsx"), "utf8");
ok("the panel composes readers for the chosen creature", /composeReaders\(template\)/.test(panel));
ok("...and prints READY or NEEDS_INPUT with each mechanic's readers and endpoint", /READER COMPOSITION: READY/.test(panel) && /NEEDS_INPUT: \{n\}/.test(panel));

console.log("\n5. the library, reported (not a gate)");
let needs = 0;
const needsBy: string[] = [];
for (const t of L as MainMonsterTemplate[]) {
  const r = composeReaders(t);
  needs += r.needsInput.length;
  if (r.needsInput.length) needsBy.push(`${t.name} ${r.needsInput.length}`);
}
console.log(`  ${L.length} creatures · ${needs} NEEDS_INPUT clause${needs === 1 ? "" : "s"}${needsBy.length ? ` · ${needsBy.join(", ")}` : ""}`);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
