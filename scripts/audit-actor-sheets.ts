/**
 * THE REBUILD LIST — what every sheet derives, what it is missing, and what it no longer needs.
 *   npm run audit:sheets -- fdmc-actor-library-export.json
 *
 * Christopher: *"it should be able to flag what is not needed in the features as the extra actions
 * that are already made, this way when we purge the action/traits/features/spells and rebuild them
 * we can do it correctly."*
 *
 * ⚠ THIS READS PRIVATE PARTY DATA AND MUST NEVER WRITE ANY OF IT INTO THE TREE. The export is
 * gitignored (`fdmc-actor-library-export.json`) for the reason `private-party-is-local-only`
 * records: the six characters are not campaign content and nothing tracked may carry them. This
 * script prints to a terminal and emits no file.
 *
 * ⚠ AND IT CHANGES NOTHING. Three sections, all of them lists:
 *
 *   DERIVED   what the tables answer for this actor, so the rebuild knows what it need not author
 *   MISSING   class pools the tables grant that have no Resources entry — *"these arent getting
 *             into the right place all the time"*
 *   COVERED   rows the derivation now supplies, matched against what was derived for THIS actor
 *             rather than against a list of words. A Darkvision row is redundant on an Aasimar and
 *             is the only copy on a Kobold, and the difference is whether `resolveSpecies` answered.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { deriveSheetSummary, formatSheetSummary, deriveDmReference, formatDmReference, redundantSheetRows } from "../src/core/rules/sheetSummary";
import { deriveActorStats } from "../src/core/state/deriveActorStats";
import type { Actor } from "../src/core/types/actor";

const path = process.argv[2] ?? "fdmc-actor-library-export.json";
let raw: unknown;
try {
  raw = JSON.parse(readFileSync(resolve(path), "utf8"));
} catch (e) {
  console.error(`Could not read ${path} — ${(e as Error).message}`);
  console.error("Usage: npm run audit:sheets -- <export.json>");
  process.exit(1);
}

/** Exports have shipped in three shapes over this project's life; take whichever one arrived. */
function actorsFrom(data: unknown): Actor[] {
  if (Array.isArray(data)) return data as Actor[];
  const obj = data as Record<string, unknown>;
  const inner = (obj.actors ?? obj.library ?? obj) as Record<string, unknown>;
  return Object.values(inner).filter(a => a && typeof a === "object" && "tabs" in (a as object)) as Actor[];
}

const actors = actorsFrom(raw);
if (actors.length === 0) {
  console.error(`No actors found in ${path}.`);
  process.exit(1);
}

console.log(`Sheet audit — ${actors.length} actor(s) from ${path}\n`);

let totalMissing = 0;
let totalCovered = 0;

for (const actor of actors) {
  const stats = deriveActorStats(actor);
  const summary = deriveSheetSummary(actor, stats);
  const ref = deriveDmReference(actor, stats);
  const covered = redundantSheetRows(actor, ref);

  console.log(`── ${actor.name} · ${actor.className ?? "?"} ${actor.level ?? "?"} · ${actor.race ?? "no race stated"}`);

  console.log("   DERIVED");
  for (const line of [...formatSheetSummary(summary), ...formatDmReference(ref)]) {
    if (line.startsWith("⚠")) continue; // the gaps get their own section
    console.log("     " + line);
  }

  const missing = ref.resources.filter(r => !r.onSheet);
  const subMissing = ref.subclassPools.filter(p => !p.onSheet);
  const speciesMissing = ref.speciesPools.filter(p => !p.onSheet);
  if (missing.length > 0 || subMissing.length > 0 || speciesMissing.length > 0) {
    console.log("   MISSING — granted by the tables, no pool on the sheet");
    for (const m of missing) console.log(`     ${m.label} ${m.max} · ${m.className}, from level ${m.level} · resets ${m.reset}`);
    for (const s of subMissing) console.log(`     ${s.resource} · subclass${s.earliestLevel ? `, from level ${s.earliestLevel}` : ""} · uses not in any table — set them by hand`);
    for (const s of speciesMissing) console.log(`     ${s.resource} · species · short rest ${s.shortRest}, long rest ${s.longRest}`);
    totalMissing += missing.length + subMissing.length + speciesMissing.length;
  }

  if (covered.length > 0) {
    console.log("   COVERED — the derivation supplies this now; drop it on the rebuild");
    for (const c of covered) console.log(`     ${c.tab}/${c.id} · "${c.label}" → ${c.coveredBy}`);
    totalCovered += covered.length;
  }

  /**
   * ⚠ A SHEET THE TABLES CANNOT ANSWER FOR IS REPORTED AS SUCH, not silently skipped — but only
   * where an answer was ever OWED.
   *
   * Christopher, 2026-09-10: *"Faelar needs no class name its a beast of the land and its tagged to
   * the beast master"*, and *"Rimekin … comes from one of the new books, they are usable but they
   * are not in the list."* Neither is a fault, and printing them as findings buries the two that
   * are. A companion has no class by design; a species from a book the SRD does not cover is a
   * legitimate sheet whose race is simply typed. The line says which of the two it is.
   */
  const isCompanion = (actor as { kind?: string }).kind === "companion";
  if (!ref.speciesName && actor.race) {
    console.log(`   ⓘ ${actor.race} is outside the SRD's ten species — its traits are typed, and nothing on this sheet's race is redundant.`);
  } else if (ref.speciesName && ref.speciesPools.length === 0) {
    /**
     * ⚠ THE THIRD CATEGORY, SAID OUT LOUD. Christopher, on the Aasimar: *"It will be handled the
     * same way the Rimekin is as a entered race and a authored rest pool."* A species the app
     * RESOLVES but the recovery workbook does not price is neither derived nor missing — its pools
     * are authored — and a silent section would leave a reader to guess which of the three it is.
     */
    console.log(`   ⓘ ${ref.speciesName} resolves its traits, but the recovery registry prices no pool for it — any species pool here is authored on the sheet.`);
  }
  if (ref.resources.length === 0 && !isCompanion && (actor.className ?? "").trim() !== "") {
    console.log(`   ⓘ the class tables have no entry for "${actor.className}" — its pools are authored, not derived.`);
  }

  /**
   * ⚠ NO CHECK ROWS IS A FAULT, AND IT HAS ONE CAUSE. Nothing outside the hand-built module helper
   * ever made them: *"why did raphael not get the checks, this wasnt build by me but generated."*
   */
  const checks = actor.tabs?.checks ?? [];
  if (checks.length === 0) {
    console.log("   ⓘ this sheet stores no check rows — the eighteen SRD skills are generated, so they render; tick proficiency on the Checks step where it applies.");
  } else {
    const frozen = checks.filter(c => {
      const f = c.metadata?.attack ?? c.description ?? "";
      return f && !/@/.test(f);
    });
    if (frozen.length > 0) {
      console.log(`   ⚠ ${frozen.length} of ${checks.length} check rows are FROZEN TOTALS — correct at the level they were typed, silently stale after an ASI or a proficiency step. Tick them on the Checks step to rebuild as formulas.`);
    }
  }

  console.log("");
}

console.log(`${totalMissing} pool(s) missing across the party · ${totalCovered} row(s) the derivation now covers`);
console.log("Nothing was changed. This is a list to rebuild FROM.");
