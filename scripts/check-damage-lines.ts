/**
 * A SECOND DAMAGE TYPE ON THE SAME HIT IS ONE PACKET, AND EVERY SURFACE READS IT.
 *   npx tsx scripts/check-damage-lines.ts
 *
 * Christopher, 2026-09-13: *"if a action has 2 damage types i should be able to write 1 action
 * choose a damage type and then write 2nd dice line and a damage type."* The editor only offered a
 * rider, so Brandwing's Ember Lance published as a rider whose dice box held `"1d6 Psychic"` and a
 * rules text reduced to `"and 6 (1d6 Psychic)"`.
 *
 * ⚠ THE FIELD IS ONLY REAL IF EVERY LAYER READS IT. The recurring fault in this app is a field every
 * layer honours and none writes — or one writes and none reads. So each reader is asserted on the
 * PUBLISHED Brandwing, and each assertion is paired with the same input minus the line, which must
 * come out different. A check that passes both ways is not checking anything.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BROKEN_CHAIN_MONSTER_LIBRARY } from "../src/data/broken-chain/monsterLibrary";
import { parseCreature } from "../src/core/encounter-band/parseCreature";
import { traceCreature } from "../src/core/encounter-band/actionTrace";
import { rosterDamageMix } from "../src/core/encounter-band/partyMitigationFromActors";
import { incomingSaveExposure } from "../src/core/encounter-band/incomingSaveExposure";
import { describeStatBlockAction } from "../src/modules/dnd-5e/statBlockGrammar";
import { resolveMonsterActionFormulas } from "../src/core/monsters/resolveMonsterFormulaVars";
import { damagePacket } from "../src/core/monsters/damageLines";
import type { MainMonsterTemplate } from "../src/core/monsters/runtime/mainMonsterRuntime";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};
const codeOf = (p: string) => readFileSync(resolve(ROOT, p), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\/[^\n]*/g, "");

type Action = { name: string; damage?: string; damageType?: unknown; extraDamage?: { damage: string; damageType?: unknown }[]; riders?: { name: string }[]; text?: string; range?: string; targets?: number };

console.log("A second damage type on the same hit is one packet\n");

const brandwing = BROKEN_CHAIN_MONSTER_LIBRARY.find(t => t.name === "Brandwing") as MainMonsterTemplate | undefined;
ok("Brandwing is in the library", !!brandwing);
if (!brandwing) process.exit(1);
const lance = ((brandwing as unknown as { actions: Action[] }).actions).find(a => a.name === "Ember Lance");
ok("it has an Ember Lance", !!lance);
if (!lance) process.exit(1);

/** The same creature with the second line removed — the mutation every check is measured against. */
const withoutLine = {
  ...brandwing,
  actions: (brandwing as unknown as { actions: Action[] }).actions.map(a => a.name === "Ember Lance" ? { ...a, extraDamage: undefined } : a),
} as unknown as MainMonsterTemplate;

console.log("\n1. the published Ember Lance is written as one hit");
ok("Fire on the main line", lance.damage === "2d12 + @DEX" && lance.damageType === "Fire", `${lance.damage} ${String(lance.damageType)}`);
ok("Psychic on a second damage line", lance.extraDamage?.length === 1 && lance.extraDamage[0].damage === "1d6" && lance.extraDamage[0].damageType === "Psychic",
  JSON.stringify(lance.extraDamage));
ok("no rider pretending to be the second type", !(lance.riders ?? []).some(r => r.name === "Ember Lance"));
ok("range and target count restored", lance.range === "range 120 ft., one target" && lance.targets === 1);
ok("no text fragment left behind", !/and 6 \(1d6/.test(lance.text ?? ""));

console.log("\n2. the pricer sees the whole hit");
const featureOf = (t: MainMonsterTemplate) => parseCreature(t).features.find(f => f.name === "Ember Lance");
const withLineFeature = featureOf(brandwing);
const withoutLineFeature = featureOf(withoutLine);
ok("the parsed damage carries the 1d6", /1d6/.test(withLineFeature?.damage ?? ""), withLineFeature?.damage);
ok("  (mutation) without the line it does not", !/1d6/.test(withoutLineFeature?.damage ?? ""), withoutLineFeature?.damage);
const target = { ac: 16, saveBonus: 4 };
const dpr = (t: MainMonsterTemplate) => traceCreature(parseCreature(t), target).averagePerRound;
const withDpr = dpr(brandwing);
const withoutDpr = dpr(withoutLine);
ok("the traced DPR is higher with the line than without", withDpr > withoutDpr, `${withDpr.toFixed(1)} vs ${withoutDpr.toFixed(1)}`);

console.log("\n3. the stat block prints both types");
const printed = describeStatBlockAction(resolveMonsterActionFormulas(lance as never, brandwing) as never);
ok("prints \"plus 3 (1d6) Psychic damage\"", /plus 3 \(1d6\) Psychic damage/.test(printed), printed);
ok("  (mutation) without the line it does not", !/Psychic/.test(describeStatBlockAction({ ...lance, extraDamage: undefined } as never)));

console.log("\n4. every damage line resolves its tokens");
const tokenised = resolveMonsterActionFormulas({ damage: "1d8 + @DEX", extraDamage: [{ damage: "1d6 + @DEX" }] }, brandwing);
ok("a token in the second line is resolved", !/@/.test(tokenised.extraDamage?.[0].damage ?? "@"), tokenised.extraDamage?.[0].damage);
ok("damagePacket joins the lines and drops blanks", damagePacket({ damage: "2d12 + 5", extraDamage: [{ damage: "1d6" }, { damage: " " }] }) === "2d12 + 5 + 1d6");

console.log("\n5. the party damage mix reads the type and survives a two-type roll");
const harrow = BROKEN_CHAIN_MONSTER_LIBRARY.find(t => t.name === "Gloam Harrow");
let mixText = "";
let threw = "";
try { mixText = JSON.stringify(rosterDamageMix([brandwing, ...(harrow ? [harrow] : [])] as never)).toLowerCase(); }
catch (e) { threw = String(e); }
ok("the roster with the Gloam Harrow does not throw", !threw, threw);
const psychicShare = (t: MainMonsterTemplate) => {
  const mix = rosterDamageMix([t] as never) as unknown as Record<string, unknown>;
  const found = JSON.stringify(mix).toLowerCase().match(/"psychic":\s*([\d.]+)/);
  return found ? Number(found[1]) : 0;
};
ok("psychic is in the Brandwing's mix", psychicShare(brandwing) > 0, `share ${psychicShare(brandwing).toFixed(3)}`);
ok("  (mutation) without the line there is less of it", psychicShare(withoutLine) < psychicShare(brandwing),
  `${psychicShare(withoutLine).toFixed(3)} vs ${psychicShare(brandwing).toFixed(3)}`);
ok("the two-type roster's mix is readable", mixText.length > 2);
ok("incomingSaveExposure reads the packet", codeOf("src/core/encounter-band/incomingSaveExposure.ts").includes("damagePacket(a)"));
void incomingSaveExposure;

console.log("\n6. the table rolls it and the editor can write it");
const card = codeOf("src/core/ui/MonsterActorCard.tsx");
ok("the card rolls the whole packet", /damageFormula = normalizeFormula\(damagePacket\(action\)\)/.test(card));
ok("the card shows a chip per line", /extraDamage \?\? \[\]\)\.flatMap/.test(card));
const editor = codeOf("src/core/monsters/MonsterTemplateEditor.tsx");
ok("the editor has a + Damage line button wired to addDamageLine", /onClick=\{\(\) => addDamageLine\(list, realIdx\)\}/.test(editor));
ok("each line has its own type box", /updateDamageLine\(list, realIdx, li, \{ damageType:/.test(editor));
ok("a rider has a type box, so its type stops living in the dice", /updateRider\(list, realIdx, ri, \{ damageType:/.test(editor));
ok("chassis substitution fixes the second line's tokens", /extraDamage: \(lines as/.test(codeOf("src/core/monsters/actionSetPicks.ts")));
ok("summons resolve the second line against the caster", /extraDamage: a\.extraDamage\.map/.test(codeOf("src/core/monsters/summon.ts")));

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
