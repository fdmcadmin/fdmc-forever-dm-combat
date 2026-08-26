#!/usr/bin/env node
/**
 * fold-authoring — take an author export from the app and write it into the build.
 *
 *   node scripts/fold-authoring.mjs fdmc-campaign-authoring-2026-08-19.json
 *
 * Regenerates `src/data/broken-chain/authored.generated.ts` WHOLESALE. That file is merged
 * over the hand-written libraries by id at module load, so this script never touches
 * monsterLibrary.ts or equipmentLibrary.ts — a generated blob must not be able to rewrite
 * hand-authored source, and a bad fold must never be able to corrupt it.
 *
 * The fold is the point where in-app authoring stops being one browser's localStorage and
 * becomes content that ships. Run it, build, push.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const SCHEMA = "fdmc.campaign-authoring.v1";
const OUT = resolve("src/data/broken-chain/authored.generated.ts");

/** Must match campaignDigest() in src/core/campaign/authorExport.ts exactly. */
function campaignDigest(monsters, equipment, encounters = []) {
  const canonical = JSON.stringify({ monsters, equipment, encounters }, (_k, v) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)));
    }
    return v;
  });
  let h = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) {
    h ^= canonical.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `fnv1a-${h.toString(16).padStart(8, "0")}-${canonical.length}`;
}

const file = process.argv[2];
if (!file) {
  console.error("usage: node scripts/fold-authoring.mjs <author-export.json>");
  process.exit(1);
}

let payload;
try {
  payload = JSON.parse(readFileSync(resolve(file), "utf8"));
} catch (e) {
  console.error(`Could not read ${file}: ${e.message}`);
  process.exit(1);
}

if (payload.schema !== SCHEMA) {
  console.error(`Wrong file. Expected schema "${SCHEMA}", got "${payload.schema ?? "(none)"}".`);
  console.error("This script takes an AUTHOR export (DM panel → Export campaign authoring),");
  console.error("not a monster-library or equipment-library export.");
  process.exit(1);
}

const monsters = Array.isArray(payload.monsters) ? payload.monsters : [];
const equipment = Array.isArray(payload.equipment) ? payload.equipment : [];
// Older exports predate encounters. Absent is legal and folds to an empty array rather than
// failing — a file made before the field existed is not a corrupt file.
const encounters = Array.isArray(payload.encounters) ? payload.encounters : [];

// The export states its own digest. A mismatch means the file was edited between export and
// fold — refuse rather than publish something the app never produced.
const digest = campaignDigest(monsters, equipment, encounters);
if (payload.digest && payload.digest !== digest) {
  console.error("Digest mismatch — this file was modified after it was exported.");
  console.error(`  stated:   ${payload.digest}`);
  console.error(`  computed: ${digest}`);
  console.error("Re-export from the app rather than hand-editing the JSON.");
  process.exit(1);
}

// Refuse entries that cannot be merged: a creature with no templateId, or an item with no id,
// would silently vanish into the merge rather than replacing or appending anything.
const badMonsters = monsters.filter(m => !m?.templateId);
const badItems = equipment.filter(i => !i?.id);
const badEncounters = encounters.filter(e => !e?.id);
if (badMonsters.length || badItems.length || badEncounters.length) {
  console.error(`Unmergeable entries: ${badMonsters.length} creature(s) with no templateId, ${badItems.length} item(s) with no id, ${badEncounters.length} encounter(s) with no id.`);
  process.exit(1);
}

/**
 * ⚠ AN EMPTY DEFENCE ROW IS A LEFTOVER, NOT A DECISION — AND IT BLOCKED A PUBLISH.
 *
 * The editor's defence list can be left holding a row nobody filled in: `{ name: "", ehpMultiplier: 1 }`.
 * The coverage gate reads that as a multiplier of 1.0 with no stated reason — correctly, because
 * *"a decided non-contribution needs its reason, an undecided one is a gap"* — and fails the fold.
 * One blank row on the Gloam Harrow is enough to stop the whole publish.
 *
 * The editor no longer writes them. This drops the ones already sitting in a browser, because an
 * author cannot reach into their own localStorage to delete a row they cannot see, and being
 * permanently unable to publish is not a reasonable price for a stray click.
 *
 * ⚠ AFTER THE DIGEST CHECK, DELIBERATELY. This changes the content, so computing the digest over
 * the stripped version would make every genuine export fail as "modified after it was exported".
 */
let strippedDefences = 0;
for (const m of monsters) {
  const defenses = m?.stats?.defenses;
  if (!Array.isArray(defenses)) continue;
  const kept = defenses.filter(d => String(d?.name ?? "").trim() !== "");
  if (kept.length !== defenses.length) {
    strippedDefences += defenses.length - kept.length;
    m.stats.defenses = kept;
  }
}
if (strippedDefences > 0) {
  console.log(`Dropped ${strippedDefences} unnamed defence row(s) — a blank row is not an authored 1.0.`);
}

/**
 * ⚠ AN ENCOUNTER MUST NOT REFERENCE A CREATURE THAT IS NOT SHIPPING. THIS IS AN ERROR NOW.
 *
 * It used to warn, because it compared only against the export and so could not tell a bundled
 * creature from a deleted one: *"fine if they are bundled already, a broken fight if they are
 * not."* It can tell — the bundled library is a file on disk — and the difference between those
 * two cases is the difference between nothing and a silently empty gate.
 *
 * The failure is not hypothetical. An export taken BEFORE a seed rebuild still names the old
 * creatures: the 2026-08-25 export's Last Court points at `walking-court` and `hushrunner`,
 * which v3.23 replaced. `AUTHORED_ENCOUNTERS` wins over the seed by id, and the checker filters
 * entries whose template is missing, so folding that export would have replaced two rebuilt
 * Act 3 fights with EMPTY ones. No crash, no error, no bodies.
 */
/**
 * ⚠ AN UNCHANGED FOLD MUST COMMIT NOTHING, AND THE TIMESTAMP WAS STOPPING THAT.
 *
 * `AUTHORED_AT` was `new Date()` on every run, so re-folding the same payload always produced a
 * one-line diff and the workflow's `git diff --cached --quiet` guard never fired. Every push of
 * `authoring/current.json` — including one that changed nothing — landed a commit whose entire
 * content was a new timestamp, which then rejected the next unrelated push with a non-fast-forward.
 *
 * The field means "when the fold last WROTE this file". If the fold did not change it, it did not
 * write it, and the old timestamp is the true answer.
 */
const previous = (() => {
  try { return readFileSync(resolve("src/data/broken-chain/authored.generated.ts"), "utf8"); }
  catch { return ""; }
})();
const unchanged = previous.includes(`export const AUTHORED_DIGEST = ${JSON.stringify(digest)};`);
const foldedAt = unchanged
  ? (previous.match(/export const AUTHORED_AT = "([^"]*)";/)?.[1] ?? new Date().toISOString())
  : new Date().toISOString();

const bundledSource = readFileSync(resolve("src/data/broken-chain/monsterLibrary.ts"), "utf8");
const bundledIds = new Set([...bundledSource.matchAll(/templateId: "([^"]+)"/g)].map(m => m[1]));
const shippingIds = new Set([...monsters.map(m => m.templateId), ...bundledIds]);
const dangling = [];
for (const e of encounters) {
  for (const entry of e.entries ?? []) {
    if (entry.templateId && !shippingIds.has(entry.templateId)) {
      dangling.push(`${e.name || e.id} -> ${entry.templateId}`);
    }
  }
}
if (dangling.length) {
  console.error(`REFUSING TO FOLD: ${dangling.length} encounter entr${dangling.length === 1 ? "y" : "ies"} name a creature that is in neither this export nor the bundled library.`);
  console.error("Folding this would ship those fights EMPTY, because an authored encounter replaces the seeded one by id.");
  for (const d of dangling) console.error(`    ${d}`);
  console.error("\nThe usual cause is an export taken before a seed rebuild. Re-export from the app against the current build.");
  process.exit(1);
}
console.log(`Encounter references check out: ${bundledIds.size} bundled creature id(s) known.`);

/**
 * ⚠ A PUBLISH UPDATES THE AUTHORED SET. IT DOES NOT REPLACE IT.
 *
 * This wrote the payload's arrays straight out, so the authored set became whatever ONE browser
 * happened to export that minute — and every creature missing from that export silently reverted
 * to the bundled seed. It is visible in the history, three folds in a row:
 *
 *     f4d329f  17 authored creatures
 *     c4d283b   4      Brandwing, Rift-Slick, Veil-Torn Dragon, Demonic Reaver
 *     ed59450   3      Rift-Slick, Blackbough Reeve, Grief Colossus
 *
 * Eleven minutes apart, and almost disjoint. The Drake Guard, Thought Harrower, Breaker, Gloam
 * Harrow, Quillshrike, Marrowstalk, Shardbound, Darkmare, Nail Saint and Folded Bulwark all went
 * back to stats nobody had chosen since the rebuild.
 *
 *   Christopher: *"no matter what i do when i push something it reverts to a seed that SHOULD NOT
 *   EXIST, my edits are the new seed, if i am not overwriting the seed then whats the point of
 *   doing edits if the seed can just say nah i like this version better and change it back."*
 *
 * He is right, and it is a one-line consequence of replace semantics. An authored creature is an
 * OVERRIDE OF A BUNDLED ONE — dropping it is not "no change", it is a revert. So creatures and
 * equipment MERGE by id: a publish carrying three creatures updates three and leaves the rest
 * authored exactly as they were.
 *
 * ⚠ ENCOUNTERS STAY REPLACE, DELIBERATELY. An authored encounter can be a whole fight rather than
 * an override, and deleting a fight is a thing the author actually does — merging would make the
 * Gate II mirrors fight immortal, which is the bug next door. The count has held at 24 across four
 * publishes, so the export is not losing them the way it loses creatures.
 *
 * `--replace` forces the old behaviour for a deliberate reset. Nothing is silent either way: what
 * was carried forward is printed by name.
 */
const REPLACE = process.argv.includes("--replace");
const previousArray = (name) => {
  const m = previous.match(new RegExp(`export const ${name}[^=]*=\\s*(\\[[\\s\\S]*?\\n\\]);`));
  if (!m) return [];
  try { return JSON.parse(m[1]); } catch { return []; }
};
const mergeById = (label, incoming, idOf, previous) => {
  if (REPLACE) return incoming;
  const byId = new Map(previous.map(p => [idOf(p), p]));
  for (const item of incoming) byId.set(idOf(item), item);
  const kept = [...byId.values()];
  const carried = previous.filter(p => !incoming.some(i => idOf(i) === idOf(p)));
  if (carried.length) {
    console.log(`  ${label}: ${incoming.length} updated, ${carried.length} carried forward — ${carried.map(p => p.name ?? idOf(p)).join(", ")}`);
  }
  return kept;
};
const foldedMonsters = mergeById("creatures", monsters, m => m.templateId, previousArray("AUTHORED_MONSTERS"));
const foldedEquipment = mergeById("equipment", equipment, i => i.id, previousArray("AUTHORED_EQUIPMENT"));

const header = readFileSync(OUT, "utf8").split("import type { MainMonsterTemplate }")[0];
const body = `import type { MainMonsterTemplate } from "../../core/monsters/runtime/mainMonsterRuntime";
import type { EquipmentItem } from "../../core/ui/EquipmentBagEditor";
import type { EncounterDefinition } from "../../core/monsters/encounterLibrary";

/** Creatures authored in-app. Replaces a bundled creature by templateId, or adds a new one. */
export const AUTHORED_MONSTERS: MainMonsterTemplate[] = ${JSON.stringify(foldedMonsters, null, 2)};

/** Equipment authored in-app — including unpicked Gift chassis. Replaces or adds by id. */
export const AUTHORED_EQUIPMENT: EquipmentItem[] = ${JSON.stringify(foldedEquipment, null, 2)};

/**
 * Encounters authored in-app — the fights, their act tag and ORDER, and the bodies built from
 * any template creature they field. Replaces a bundled encounter by id, or adds a new one.
 */
export const AUTHORED_ENCOUNTERS: EncounterDefinition[] = ${JSON.stringify(encounters, null, 2)};

/**
 * Fingerprint of the PAYLOAD that last updated this file — not of the arrays above.
 *
 * They stopped being the same thing when the fold began MERGING creatures and equipment by id
 * rather than replacing them, which it does because a publish carrying three creatures must not
 * revert the other fourteen. The digest still answers the question it was built for — "is this
 * generated file the untouched output of a real export?" — and it is also what the encounter
 * library seed version keys off, so a publish still re-seeds a browser.
 */
export const AUTHORED_DIGEST = ${JSON.stringify(digest)};

/** When the fold script last wrote this file. */
export const AUTHORED_AT = ${JSON.stringify(foldedAt)};

/**
 * Merge authored content over a bundled list by id.
 *
 * Authored entries WIN for their own id — that is the point of authoring — and anything the
 * author has not touched is left exactly as the hand-written source has it. Order is stable:
 * bundled entries keep their position, genuinely new ones are appended.
 */
export function mergeAuthored<T>(bundled: T[], authored: T[], idOf: (item: T) => string): T[] {
  if (authored.length === 0) return bundled;
  const overrides = new Map(authored.map(a => [idOf(a), a]));
  const merged = bundled.map(b => overrides.get(idOf(b)) ?? b);
  const bundledIds = new Set(bundled.map(idOf));
  return [...merged, ...authored.filter(a => !bundledIds.has(idOf(a)))];
}
`;

writeFileSync(OUT, header + body);
console.log(`Folded ${monsters.length} creature(s), ${encounters.length} encounter(s) and ${equipment.length} item(s) into authored.generated.ts`);
if (unchanged) console.log("  content unchanged — the timestamp was left alone so this fold commits nothing");
console.log(`  digest ${digest}`);
console.log("Next: npx tsc -b && npm run build, then commit and push.");
