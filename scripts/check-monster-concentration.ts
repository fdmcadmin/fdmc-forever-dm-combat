/**
 * A CREATURE'S SPELL CAN NEED CONCENTRATION, AND THE CARD TRACKS IT.
 *   npx tsx scripts/check-monster-concentration.ts
 *
 * Christopher, 2026-09-13: *"the Winter's toll also needs to be concentration but i cant choose those
 * on monster spells."* A PC action has carried `concentration` since the spell table; a creature had
 * no field, no box, and a card that could not show what it was holding.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BROKEN_CHAIN_MONSTER_LIBRARY as L } from "../src/data/broken-chain/monsterLibrary";
import { readConcentration } from "../src/core/encounter-band/mechanicText";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};
const code = (p: string) => readFileSync(resolve(ROOT, p), "utf8");

console.log("A creature's spell can need concentration\n");

console.log("1. the text reader");
ok("a spell that ends 'Concentration' reads as concentration", !!readConcentration("…allies in the area gain a +3 bonus. Concentration"));
ok("'Duration: Concentration, up to 1 minute'", !!readConcentration("Duration: Concentration, up to 1 minute. You create a sphere."));
ok("'(Concentration)'", !!readConcentration("Hold Person (Concentration). The target must succeed."));
ok("'the target loses concentration' is NOT this creature's concentration", !readConcentration("On a failed save the target loses concentration."));
ok("'breaks its concentration' is NOT this creature's concentration", !readConcentration("A hit breaks the target's concentration."));
ok("no mention, no concentration", !readConcentration("Gloam Harrow chooses a point she can see within 60 feet."));

console.log("\n2. the published Winter's Toll");
const harrow = L.find(t => t.name === "Gloam Harrow") as unknown as { actions: { name: string; concentration?: boolean }[] };
const tolls = harrow.actions.filter(a => /^Winter.s Toll$/.test(a.name));
ok("every Winter's Toll entry needs concentration", tolls.length > 0 && tolls.every(a => a.concentration === true), `${tolls.length} entr${tolls.length === 1 ? "y" : "ies"}`);

console.log("\n3. the editor can set it and the card tracks it");
const editor = code("src/core/monsters/MonsterTemplateEditor.tsx");
ok("a Conc. box on monster spell rows writes `concentration`", /updateListItem\(list, realIdx, \{ concentration:/.test(editor));
const card = code("src/core/ui/MonsterActorCard.tsx");
const use = card.slice(card.indexOf("async function handleUseAction"), card.indexOf("async function handleUseAction") + 6000);
ok("using a concentration action sets what the creature holds", /needsConcentration\(action\)[\s\S]*setConcentratingOn\(action\.name\)/.test(use));
ok("a second concentration spell ends the first, and says so", /stops concentrating on/.test(use));
ok("the header can drop it", /loses concentration on[\s\S]{0,80}setConcentratingOn\(null\)/.test(card));
ok("the action tile marks a concentration spell", /needsConcentration\(action\) && \(/.test(card));

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
