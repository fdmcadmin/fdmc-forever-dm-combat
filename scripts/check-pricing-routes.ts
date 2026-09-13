/**
 * AN ACTION WITH NO DAMAGE OF ITS OWN IS STILL PRICED — BY WHAT IT DOES TO THE ATTACKS.
 *   npx tsx scripts/check-pricing-routes.ts
 *
 * Christopher, 2026-09-13: *"there should be nothing that is priced at 0, most if all of these
 * abilities should be readable from the SRD pdfs and the workbooks."* Three Act 3 features carried
 * no dice and priced at exactly 0, so the trace never spent the budget they sit on:
 *
 *   Brandwing / Closing Stroke        a mark whose once-per-turn rider lands on Ember Lance
 *   Blackbough Reeve / Final Pruning  a reaction that "makes one Shearing Cut attack"
 *   Demon Knight / Reckless Sentence  Advantage on its own attacks
 *
 * Each is asserted on the PUBLISHED creature and against the same creature with its route removed —
 * which must go back to not being scheduled. A check that passes both ways checks nothing.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BROKEN_CHAIN_MONSTER_LIBRARY as L } from "../src/data/broken-chain/monsterLibrary";
import { parseCreature } from "../src/core/encounter-band/parseCreature";
import { traceCreature } from "../src/core/encounter-band/actionTrace";
import { withAdvantage } from "../src/core/encounter-band/controlPricing";
import type { MainMonsterTemplate } from "../src/core/monsters/runtime/mainMonsterRuntime";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};
const codeOf = (p: string) => readFileSync(resolve(ROOT, p), "utf8");

type Row = { name: string; [k: string]: unknown };
const target = { ac: 16, saveBonus: 4, partySize: 4 };
const creature = (name: string) => L.find(t => t.name === name) as MainMonsterTemplate;
/** The same creature with one action rewritten — the mutation each check is measured against. */
const withAction = (t: MainMonsterTemplate, action: string, fn: (a: Row) => Row) => {
  const any = t as unknown as Record<string, Row[] | undefined>;
  const out: Record<string, unknown> = { ...t };
  for (const list of ["actions", "reactions", "traits"]) {
    if (any[list]) out[list] = any[list]!.map(a => (a.name === action ? fn({ ...a }) : a));
  }
  return out as unknown as MainMonsterTemplate;
};
const roundTwo = (t: MainMonsterTemplate) => traceCreature(parseCreature(t), target, 4).rounds[1];
const rowOf = (t: MainMonsterTemplate, feature: string) => roundTwo(t).scheduled.find(s => s.feature === feature && s.expectedDamage > 0);

console.log("An action with no damage of its own is still priced\n");

console.log("1. a mark's once-per-turn rider is priced against the turn's attacks");
const brandwing = creature("Brandwing");
const stroke = rowOf(brandwing, "Closing Stroke");
const lances = roundTwo(brandwing).scheduled.filter(s => s.feature === "Ember Lance");
ok("Closing Stroke is scheduled on the Bonus Action", stroke?.channel === "bonus_action", stroke?.expectation);
const p = 1 - Math.min(0.95, Math.max(0.05, (21 + 9 - target.ac) / 20));
const expected = 7 * (1 - Math.pow(p, lances.length));
ok("worth 2d6 × P(at least one Ember Lance hits)", !!stroke && Math.abs(stroke.expectedDamage - expected) < 0.01,
  `${stroke?.expectedDamage.toFixed(2)} vs ${expected.toFixed(2)} over ${lances.length} lances`);
ok("  (mutation) without its rider it is not scheduled", !rowOf(withAction(brandwing, "Closing Stroke", a => ({ ...a, riders: undefined })), "Closing Stroke"));
ok("its printed 2d6 no longer asks for a damage field",
  !traceCreature(parseCreature(brandwing), target, 4).assumptions.some(a => a.feature === "Closing Stroke" && /no damage field/.test(a.detail)));

console.log("\n2. a response that makes one of the creature's attacks is worth that attack");
const reeve = creature("Blackbough Reeve");
const pruning = rowOf(reeve, "Final Pruning");
const cut = roundTwo(reeve).scheduled.find(s => s.feature === "Shearing Cut");
ok("Final Pruning spends the Reaction", pruning?.channel === "reaction", pruning?.expectation);
ok("worth exactly one Shearing Cut", !!pruning && !!cut && Math.abs(pruning.expectedDamage - cut.expectedDamage) < 1e-9,
  `${pruning?.expectedDamage.toFixed(2)} vs ${cut?.expectedDamage.toFixed(2)}`);
ok("  (mutation) without attackWith it is not scheduled", !rowOf(withAction(reeve, "Final Pruning", a => ({ ...a, attackWith: undefined })), "Final Pruning"));
const halved = rowOf(withAction(reeve, "Final Pruning", a => ({ ...a, triggerChance: 0.5 })), "Final Pruning");
ok("a 50% trigger halves it", !!halved && !!pruning && Math.abs(halved.expectedDamage - pruning.expectedDamage / 2) < 1e-9);
const typo = traceCreature(parseCreature(withAction(reeve, "Final Pruning", a => ({ ...a, attackWith: "Shearing Kut" }))), target, 4);
ok("a name that matches no action is reported, not priced at 0 silently",
  typo.assumptions.some(a => a.feature === "Final Pruning" && a.flag === "NEEDS DM INPUT"));

console.log("\n3. Advantage on its own attacks is the difference Advantage makes");
const knight = creature("Demon Knight of Punishment");
const sentence = rowOf(knight, "Reckless Sentence");
const grasp = roundTwo(knight).scheduled.find(s => s.feature === "Iron Grasp");
const gp = Math.min(0.95, Math.max(0.05, (21 + 8 - target.ac) / 20));
const gain = grasp ? grasp.expectedDamage * (withAdvantage(gp) / gp - 1) : NaN;
ok("Reckless Sentence spends the Bonus Action", sentence?.channel === "bonus_action", sentence?.expectation);
ok("worth Iron Grasp × (p_adv / p − 1)", !!sentence && Math.abs(sentence.expectedDamage - gain) < 0.01,
  `${sentence?.expectedDamage.toFixed(2)} vs ${gain.toFixed(2)}`);
ok("  (mutation) without the grant it is not scheduled", !rowOf(withAction(knight, "Reckless Sentence", a => ({ ...a, grantsAdvantage: undefined })), "Reckless Sentence"));

console.log("\n4. the editor can write all three, and the parser carries them");
const editor = codeOf("src/core/monsters/MonsterTemplateEditor.tsx");
ok("a 'Makes one attack with' select writes attackWith", /updateListItem\(list, realIdx, \{ attackWith: e\.target\.value \|\| undefined \}\)/.test(editor));
ok("an Advantage checkbox writes grantsAdvantage", /grantsAdvantage: e\.target\.checked \? "own-attacks" : undefined/.test(editor));
ok("a Trigger % box writes triggerChance", /updateListItem\(list, realIdx, \{ triggerChance:/.test(editor));
const parser = codeOf("src/core/encounter-band/parseCreature.ts");
ok("parseSection passes all three through", /attackWith: a\.attackWith/.test(parser) && /grantsAdvantage: a\.grantsAdvantage/.test(parser) && /triggerChance: a\.triggerChance/.test(parser));

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
