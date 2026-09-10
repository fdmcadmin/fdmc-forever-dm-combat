/**
 * THE IMPORTED REFERENCE PROSE COMES OFF EVERY ACTOR, AND ONLY THAT.
 *   npx tsx scripts/check-reference-notes.ts
 *
 * Christopher, 2026-09-10: *"now i have to go through every single character and delete 2 to 3
 * different fields."*
 *
 * ⚠ THIS GATE EXISTS BECAUSE THE SWEEP DELETES. Every other migration in this codebase MOVES
 * data — feats onto features, names onto encounters — and the worst a bad move can do is put a row
 * somewhere odd. This one takes rows away, so the test that matters is not "did it remove the two"
 * but "did it remove ONLY the two": an authored note and an authored tracker note are in the
 * fixture for exactly that, and they are the assertions that would catch an over-broad pattern.
 */
import { stripImportedReferenceNotes, migrateImportedReferenceNotes } from "../src/core/campaign/stripImportedReferenceNotes";
import type { Actor } from "../src/core/types/actor";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};
const codeOf = (p: string) => readFileSync(resolve(ROOT, p), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

/** Ripsnarl and Lights Stone as the export prints them, trimmed to what the sweep reads. */
const actorWithImports = {
  id: "lst", name: "Lights Stone",
  classFeatureTracker: {
    label: "Rage / Saves", value: "Rage +2 dmg · 3/LR",
    note: "Saves: STR +7, DEX +2, CON +5, INT -1, WIS +0, CHA +1. Prof +3. Initiative +2.",
  },
  tabs: {
    notes: [
      { id: "combat-notes-lst", label: "Combat Notes", actionKind: "note",
        metadata: { details: "Base AC 11 before equipment. Chain Mail, Shield, and Defense produce equipped AC 19." } },
      { id: "proficiencies-lst", label: "Proficiencies and Languages", actionKind: "note",
        metadata: { details: "Armor: Heavy, Light, Medium, Shields. Languages: Common, Dwarvish, Elvish." } },
      { id: "note-1757000000000", label: "Owes the smith 40gp", actionKind: "note", metadata: { details: "" } },
    ],
    outOfCombat: [{ id: "short-rest-lst", label: "Short Rest", actionKind: "utility" }],
  },
} as unknown as Actor;

console.log("The imported reference prose comes off every actor — and only that\n");

console.log("1. the two importer rows go");
{
  const { actor, strip } = stripImportedReferenceNotes(actorWithImports);
  const left = (actor.tabs.notes ?? []).map(n => n.id);
  ok("both imported ids removed", strip.removed.length === 2, strip.removed.join(", "));
  ok("...combat-notes-", strip.removed.includes("combat-notes-lst"));
  ok("...proficiencies-", strip.removed.includes("proficiencies-lst"));

  /**
   * ⚠ THE ONE THAT MATTERS. An id-CONTAINS match, or a match on the label "Notes", or a sweep that
   * simply emptied the tab, would each pass every assertion above and take this row with them.
   */
  ok("mutation: an authored note SURVIVES", left.includes("note-1757000000000"), left.join(", "));
  ok("...and it is the only thing left", left.length === 1);
}

console.log("\n2. the derived tracker note is cleared, and nothing else on the tracker");
{
  const { actor, strip } = stripImportedReferenceNotes(actorWithImports);
  ok("the saves restatement is gone", strip.trackerNoteCleared && actor.classFeatureTracker?.note === "");
  /**
   * ⚠ THE TRACKER SURVIVES THE NOTE. "Rage / Saves" and "Rage +2 dmg · 3/LR" are authored and the
   * Features tab renders them; dropping the object to delete one sentence would take a real
   * feature readout off the card.
   */
  ok("...but the label and value are untouched",
    actor.classFeatureTracker?.label === "Rage / Saves" && actor.classFeatureTracker?.value === "Rage +2 dmg · 3/LR");

  const authored = {
    ...actorWithImports,
    classFeatureTracker: { label: "Rage / Saves", value: "3/LR", note: "Frenzy is off the table until Tavi is back up." },
  } as unknown as Actor;
  const r = stripImportedReferenceNotes(authored);
  ok("mutation: a note somebody WROTE survives", r.actor.classFeatureTracker?.note === authored.classFeatureTracker?.note);
}

console.log("\n3. an actor with nothing to strip is returned untouched");
{
  const clean = { id: "x", name: "Clean", tabs: { notes: [] } } as unknown as Actor;
  const { actor, strip } = stripImportedReferenceNotes(clean);
  ok("no removals", strip.removed.length === 0 && !strip.trackerNoteCleared);
  /**
   * ⚠ IDENTITY, NOT DEEP-EQUAL. The library sweep writes only when something changed, and it
   * decides that from the report — a copy returned here would be a copy written to storage on
   * every load, which is how a "free" sweep starts costing a write per page open.
   */
  ok("...and the same object comes back", actor === clean);
}

console.log("\n4. the library sweep writes once, and reports what it LEAVES");
{
  const library: Record<string, Actor> = { lst: actorWithImports, clean: { id: "c", name: "Clean", tabs: { notes: [] } } as unknown as Actor };
  let saved: Record<string, Actor> | null = null;
  const report = migrateImportedReferenceNotes(() => library, next => { saved = next; });

  ok("one actor changed", report.actors === 1, JSON.stringify({ actors: report.actors, notes: report.notesRemoved }));
  ok("two note rows removed", report.notesRemoved === 2);
  ok("one tracker note cleared", report.trackerNotesCleared === 1);
  ok("the library was saved", saved !== null);

  /**
   * ⚠ THE REPORT IS THE HONEST HALF OF THIS FEATURE. The sweep removes only what it can NAME, so
   * anything else sitting on the two hidden-prone tabs has to come back by name — otherwise the
   * next unnamed row is found the same way this one was, by reading a JSON months later.
   */
  ok("the authored note is reported as remaining",
    (report.remaining["Lights Stone"] ?? []).includes("notes/note-1757000000000"),
    JSON.stringify(report.remaining));
  ok("...and so is the outOfCombat row",
    (report.remaining["Lights Stone"] ?? []).includes("outOfCombat/short-rest-lst"));
}

console.log("\n5. it runs on EVERY load, from BOTH entry points");
{
  const mod = codeOf("src/core/campaign/stripImportedReferenceNotes.ts");
  /**
   * ⚠ NO ONE-SHOT KEY. The feats migration carried one and anything reaching the tab afterwards
   * stayed for good; re-importing a sheet would put these straight back.
   */
  ok("mutation: no one-shot storage key", !/localStorage|migration\.v\d/.test(mod));

  for (const entry of ["src/App.tsx", "src/dm-panel.tsx"]) {
    const src = codeOf(entry);
    ok(`  ${entry} runs the sweep`, /migrateImportedReferenceNotes\(loadActorLibrary, saveActorLibrary\)/.test(src));
  }
}

console.log(failures ? `\nFAILED (${failures})` : "\nALL PASS");
process.exit(failures ? 1 : 0);
