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

import { readFileSync, writeFileSync, existsSync } from "node:fs";
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


/**
 * ⚠ NORMALISE ON INGEST, OR THE NEXT EXPORT UNDOES THE LAST MIGRATION.
 *
 * Christopher, 2026-08-28: *"everything is dnd compliant so that means when i export the next time
 * it shouldnt change what you just did."*
 *
 * The app's author export carries whatever prose an action was written with. 0.8.9.0 moved damage
 * type and reach OUT of that prose and into fields across both campaign libraries — and a fold is
 * a WHOLESALE regeneration, so without this the very next export would put the prose back and the
 * app would be reading two dialects again.
 *
 * This is the boundary where outside content enters the codebase, so it is where the house style
 * is applied. Same rules as `statBlockGrammar`: the numbers are fields, the sentence is the rider.
 *
 * ⚠ IT NEVER GUESSES A TYPE. A clause that does not STATE its damage type is passed through
 * untouched — inventing one here would write a resistance decision into a DM's campaign silently.
 * ⚠ AND IT LEAVES TWO TYPES ALONE, because one `damageType` cannot hold them.
 */
const DAMAGE_TYPES = ["acid","bludgeoning","cold","fire","force","lightning","necrotic",
  "piercing","poison","psychic","radiant","slashing","thunder"];
const ATTACK_PREFIX = /\b(?:Melee|Ranged|Melee or Ranged)\s+(?:Weapon\s+|Spell\s+)?Attack(?:\s+Roll)?\s*:?\s*/i;
const TOHIT = /[+-]\s*\d+\s*to hit\s*[.,;]?\s*/i;
// ⚠ A DUAL RANGE IS ONE RANGE. Taking "reach 10 ft. or range 60 ft." as only its first half left
// "or range 60 ft." stranded at the front of the text.
const RANGE = /\b((?:reach\s+\d+\s*ft\.?|ranged?\s+\d+(?:\/\d+)?\s*ft\.?|melee or thrown\s+\d+(?:\/\d+)?\s*ft\.?)(?:\s+or\s+(?:reach|range)\s+\d+(?:\/\d+)?\s*ft\.?)?)\s*[.,;]?\s*/i;
/**
 * ⚠ A TARGET RESTRICTION IS RULES TEXT AND IS KEPT — "one target" IS NOT THE ONLY SHAPE.
 *
 * Christopher: *"some of the actions feel incomplete."* The first version matched only "one target"
 * and "one creature", so "one LARGE or smaller creature" survived as a dangling lead and four
 * actions read as fragments: *"one Large or smaller creature. Until the grapple ends…"*.
 *
 * A bare "one target" says nothing the fields do not. A RESTRICTION on what may be targeted is a
 * rule, and `targets` is a COUNT with nowhere to put it — so it is rewritten as its own sentence
 * rather than dropped or left hanging.
 */
const TARGET = /\bone\s+(?:target|creature|incapacitated target)\s*[.,;]\s*/i;
const TARGET_RESTRICTED = /\b(one\s+[^.,;]*?creature)\s*[.,;]\s*/i;
// ⚠ IT STOPS AT A COMMA, NOT AT THE NEXT PERIOD. Reading to the period swallowed riders that
// continued the same sentence: "bludgeoning damage, AND THE TARGET IS GRAPPLED (escape DC 16)" lost
// the grapple along with the damage type. Three actions lost a rule outright before this was found,
// and a migration that DELETES a rule is worse than the duplication it set out to remove.
const HIT_CLAUSE = /Hit\s*:\s*\d+\s*\(([^)]*)\)\s*([^.;,]*)[.;,]?\s*/i;

function normaliseAction(a) {
  if (!a || typeof a !== "object" || a.damageType) return a;
  const text = typeof a.text === "string" ? a.text : "";
  const hit = text.match(HIT_CLAUSE);
  if (!hit) return a;

  const found = [...new Set(DAMAGE_TYPES.filter(t =>
    new RegExp("\\b" + t + "\\b", "i").test(hit[1] + " " + (hit[2] || ""))))];
  if (found.length !== 1) return a;                      // none stated, or two — leave it

  const rangeM = text.match(RANGE);
  let rest = text.replace(hit[0], " ").replace(ATTACK_PREFIX, " ").replace(TOHIT, " ");
  if (rangeM) rest = rest.replace(RANGE, " ");
  rest = rest.replace(TARGET, " ");
  const restricted = rest.match(TARGET_RESTRICTED);
  if (restricted) rest = rest.replace(TARGET_RESTRICTED, `Targets ${restricted[1]}. `);
  // A rider that continued the damage sentence starts with "and …". Lifting it out leaves a
  // fragment, so it is given the subject the sentence used to supply.
  rest = rest.replace(/(^|\.\s+)and\s+the\s+/i, (_m, lead) => `${lead}On a hit the `);
  rest = rest.replace(/^\s*damage\s*[.;]?/i, " ")
             .replace(/\s{2,}/g, " ").replace(/^[\s,.;:]+/, "").trim();

  const out = { ...a, damageType: found[0][0].toUpperCase() + found[0].slice(1) };
  if (rangeM && !out.range) out.range = rangeM[1].replace(/\s+/g, " ").replace(/[,;]$/, "").trim();
  if (rest) out.text = rest; else delete out.text;
  return out;
}

function normaliseMonster(m) {
  if (!m || typeof m !== "object") return m;
  const pass = list => (Array.isArray(list) ? list.map(normaliseAction) : list);
  return { ...m, traits: pass(m.traits), actions: pass(m.actions), reactions: pass(m.reactions) };
}

const monsters = (Array.isArray(payload.monsters) ? payload.monsters : []).map(normaliseMonster);
const equipment = Array.isArray(payload.equipment) ? payload.equipment : [];
// Older exports predate encounters. Absent is legal and folds to an empty array rather than
// failing — a file made before the field existed is not a corrupt file.
const encounters = Array.isArray(payload.encounters) ? payload.encounters : [];

/**
 * ⚠ BUT "LEGAL" AND "INTENDED" ARE DIFFERENT THINGS, AND THIS ONE BIT ME.
 *
 * Creatures and equipment MERGE by id; encounters REPLACE. So a payload written to change one
 * field on some items — no `encounters` key, because it has nothing to say about them — does not
 * leave them alone. It empties them. Folding an equipment-only payload on 2026-09-11 deleted all
 * 24 authored encounters, 587 lines, and only `check:pools` failing on the very next command
 * turned that into a scare instead of a loss.
 *
 * An older export legitimately has no encounters AND is folding into a tree that has none either.
 * Wiping a populated set with an absent key is the case that is always a mistake, so it needs the
 * author to say so out loud.
 */
if (encounters.length === 0) {
  const current = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
  const populated = /export const AUTHORED_ENCOUNTERS: EncounterDefinition\[\] = \[\s*\{/.test(current);
  if (populated && !process.argv.includes("--drop-encounters")) {
    console.error("REFUSED: this payload carries no encounters and the authored file has some.");
    console.error("  Encounters REPLACE on fold, so folding this would delete every one of them.");
    console.error("  Carry them through in the payload, or pass --drop-encounters if you mean it.");
    process.exit(1);
  }
}

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
/**
 * ⚠ THIS FUNCTION ONCE ATE THE LIBRARY, SILENTLY, AND THAT IS THE WHOLE REASON IT IS THIS LONG.
 *
 * `catch { return []; }` looks defensive and is the opposite. `mergeById` carries forward
 * whatever this returns, so an empty return does not mean "nothing to carry" — it means
 * "REPLACE the entire authored library with just this payload". A publish holding two
 * creatures rewrote AUTHORED_MONSTERS from eighteen entries to two, and printed nothing,
 * because the "carried forward" line below only fires when `previous` is non-empty.
 *
 * What made it fire: `authored.generated.ts` is TYPESCRIPT, and TypeScript permits trailing
 * commas. `JSON.parse` does not. One reformat of the generated file — an editor's
 * format-on-save is enough — and every subsequent fold quietly reset the library. Nothing in
 * the run said so; the damage only surfaced downstream as `check:traits` reporting that a
 * creature had "got cheaper with no record", which is that gate doing exactly its job.
 *
 * So: trailing commas are tolerated, and a parse failure is FATAL. Refusing to fold is
 * recoverable — the author fixes the file and pushes again. Folding against a phantom empty
 * library is not: it writes the loss into the generated file and pushes it.
 */
const previousArray = (name) => {
  const m = previous.match(new RegExp(`export const ${name}[^=]*=\\s*(\\[[\\s\\S]*?\\n\\]);`));
  if (!m) {
    // A genuinely empty `= [];` does not match the regex and is legitimate on a first fold.
    // The export being PRESENT but unparseable is not — that is a shape this cannot read.
    if (previous.includes(`export const ${name}`) && !previous.match(new RegExp(`export const ${name}[^=]*=\\s*\\[\\s*\\];`))) {
      console.error(`FATAL: found ${name} in ${OUT} but could not extract its array.`);
      console.error(`Refusing to fold: carrying on would REPLACE the authored library with this payload alone.`);
      process.exit(1);
    }
    return [];
  }
  try {
    // TS trailing commas -> valid JSON. Only ",]" / ",}" are touched; string content is not.
    return JSON.parse(m[1].replace(/,(\s*[\]}])/g, "$1"));
  } catch (err) {
    console.error(`FATAL: ${name} in ${OUT} did not parse: ${err.message}`);
    console.error(`Refusing to fold: this would have silently reset the authored library to the`);
    console.error(`${name === "AUTHORED_MONSTERS" ? "creatures" : "items"} in this payload alone, discarding every earlier publish.`);
    process.exit(1);
  }
};
/**
 * ⚠ A PUBLISH FOLDS NEW CONTENT IN; IT DOES NOT REPLACE WHAT IT DOES NOT MENTION.
 *
 * Christopher, 2026-09-12: *"why is the publish not folding in new content while retaining old
 * content."* Because this did `byId.set(id, item)` — an incoming item REPLACED the previous entry
 * entirely, so every field the exporting browser had never heard of was deleted by the act of
 * publishing an item that happened to share its id.
 *
 * `fdmc-author-bot`'s 17:30Z fold is the case: it carried 24 convergence outputs whose
 * `convergence` object predated the tier labels, and all 24 tiers went. The nine weapon riders at
 * 0.8.40.5 were the same fault, and the fix then was to move the data to the seed — a workaround
 * for this, not a cure. Christopher: *"we are not suppose to be writing to the seeded section
 * everything is suppose to be authored publishes."* So the cure goes here.
 *
 * The rule is the one `mergeAuthored` already states for the seed↔authored merge, applied at the
 * fold: **a field the incoming copy does not MENTION is not a decision to remove it.** Plain
 * objects merge key-wise so a nested `convergence` keeps its tier; arrays and primitives replace,
 * because an authored array IS a complete statement of that list.
 *
 * ⚠ `--replace` STILL EXISTS AND STILL MEANS WHOLESALE. Clearing a field deliberately is the rare
 * case and it should be the one that has to say so.
 */
const isPlainObject = v =>
  typeof v === "object" && v !== null && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;

const foldOver = (previous, incoming) => {
  if (!previous || !isPlainObject(previous) || !isPlainObject(incoming)) return incoming;
  const out = { ...previous };
  for (const [k, v] of Object.entries(incoming)) {
    if (v === undefined) continue;
    out[k] = isPlainObject(v) && isPlainObject(previous[k]) ? foldOver(previous[k], v) : v;
  }
  return out;
};

const mergeById = (label, incoming, idOf, previous) => {
  if (REPLACE) return incoming;
  const byId = new Map(previous.map(p => [idOf(p), p]));
  for (const item of incoming) byId.set(idOf(item), foldOver(byId.get(idOf(item)), item));
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
  const merged = bundled.map(b => {
    const over = overrides.get(idOf(b));
    if (!over) return b;
    /**
     * ⚠ FIELD-WISE, NOT WHOLESALE — OR THE SEED CAN NEVER GAIN A FIELD AGAIN.
     *
     * This replaced the bundled entry outright. That is fine while the two describe the same
     * shape, and it silently freezes the library the moment the shape grows: the equipment export
     * carries ALL 137 items, so every seeded item is also an "authored" one, and an authored copy
     * taken before a field existed permanently shadowed it.
     *
     * The case that surfaced it: an activation field — what using an item costs — was added and written
     * onto 21 library items, and not one of them reached the app. Every single row was overridden
     * by its own snapshot from a browser that predated the field.
     *
     * A field the authored copy does not MENTION is not a decision to remove it; it is a field
     * that did not exist when the export was taken. So an authored copy overrides the fields it
     * actually states, and the seed supplies the rest.
     *
     * ⚠ THE COST, STATED: clearing a field back to empty no longer travels through the fold —
     * the seed's value returns. That is the rarer case and a visible one, and it is a far smaller
     * price than a library that can never be improved again.
     */
    /**
     * ⚠ AND THE SAME RULE HAS TO REACH ONE LEVEL DOWN, WHICH IT DID NOT.
     *
     * Christopher published at 2026-09-12T17:30Z and all 24 convergence TIER labels vanished —
     * the identical shape as the nine weapon riders at 0.8.40.5, arriving through a door that was
     * supposed to be shut. The field-wise merge above was already correct; it was only one level
     * deep. \`convergence\` is a nested OBJECT, so an authored copy stating
     * \`{role, enabled, mechanicalTag}\` replaced the seed's \`{role, enabled, mechanicalTag, tier}\`
     * WHOLE, and the tier went with it.
     *
     * The reasoning two paragraphs up applies unchanged inside a nested object: a key the authored
     * copy does not MENTION is not a decision to remove it. So plain objects merge key-wise and
     * everything else — arrays, dates, primitives — still replaces outright, because an authored
     * array IS a complete statement of that list.
     */
    const isPlainObject = (v: unknown): v is Record<string, unknown> =>
      typeof v === "object" && v !== null && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;

    const stated: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(over as Record<string, unknown>)) {
      if (v === undefined) continue;
      const seeded = (b as Record<string, unknown>)[k];
      stated[k] = isPlainObject(v) && isPlainObject(seeded) ? { ...seeded, ...v } : v;
    }
    return { ...(b as Record<string, unknown>), ...stated } as T;
  });
  const bundledIds = new Set(bundled.map(idOf));
  return [...merged, ...authored.filter(a => !bundledIds.has(idOf(a)))];
}
`;

writeFileSync(OUT, header + body);
console.log(`Folded ${monsters.length} creature(s), ${encounters.length} encounter(s) and ${equipment.length} item(s) into authored.generated.ts`);
if (unchanged) console.log("  content unchanged — the timestamp was left alone so this fold commits nothing");
console.log(`  digest ${digest}`);
console.log("Next: npx tsc -b && npm run build, then commit and push.");
