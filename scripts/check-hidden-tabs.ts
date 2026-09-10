/**
 * NOTHING THE EXPORT CARRIES MAY BE UNREACHABLE ON THE SHEET.
 *   npx tsx scripts/check-hidden-tabs.ts
 *
 * Christopher, 2026-09-10, looking at a party export:
 *   *"why are there note being exported with my json when that character has no notes"*
 *   *"every one of my actors have them and i have not put in any of them and they dont show up in
 *    any section or any place to remove them"*
 *   *"none of this information should be there, why is stuff like this hiding in a json for
 *    export, this leads to reading these wrong."*
 *
 * ⚠ THE BUG WAS NOT THAT THE DATA EXISTED. It was that it existed with NO READER.
 *
 * `actor.tabs` is exported whole, so every id in `TabId` reaches the JSON. The card renders
 * `orderedTabs`, which is a SHORTER list. Two ids had fallen off it:
 *
 *   · `notes`   — the tab was rendered, but by `ActorNotesPanel` off the SESSION note store, a
 *                 different list with a different shape. `actor.tabs.notes` had no reader at all.
 *                 Two reference rows imported with the original sheets rode along invisibly for
 *                 months and surfaced only in the JSON, where prose reads as fact.
 *   · `outOfCombat` — dropped from `orderedTabs` at P-SHEET when Short and Long Rest became
 *                 buttons, yet still OFFERED as a move destination in the editor. A door into a
 *                 room with no lights.
 *
 * That is the third instance this session of a field every layer honours and none renders, so
 * the gate is written against the RULE rather than against those two ids: every member of
 * `TabId` is either in `orderedTabs` or folded into a tab that is, and the editor never offers a
 * destination that fails the same test.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");
/** Comments carry tab ids in prose; strip them so nothing is counted from a sentence. */
const codeOf = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

const card = codeOf("src/core/ui/ActorCard.tsx");

console.log("Nothing the export carries may be unreachable on the sheet\n");

/* ── every TabId has a reader ─────────────────────────────────────────────────────────────── */
console.log("1. every id in TabId reaches a surface");

const tabsSrc = codeOf("src/core/types/tabs.ts");
const unionAt = tabsSrc.indexOf("export type TabId");
const unionEnd = tabsSrc.indexOf(";", unionAt);
const TAB_IDS = [...tabsSrc.slice(unionAt, unionEnd).matchAll(/"([a-zA-Z]+)"/g)].map(m => m[1]);
ok("TabId parsed", TAB_IDS.length >= 10, TAB_IDS.join(", "));

const orderedAt = card.indexOf("const orderedTabs: TabId[] = [");
const orderedEnd = card.indexOf("];", orderedAt);
const ORDERED = [...card.slice(orderedAt, orderedEnd).matchAll(/"([a-zA-Z]+)"/g)].map(m => m[1]);
ok("orderedTabs parsed", ORDERED.length >= 8, ORDERED.join(", "));

/**
 * A tab that is not rendered on its own may still be READ, by being folded into one that is.
 * `tabContents` is the only place that may do it, which is why the fold is read from there and
 * not from a list kept beside it — a list would drift, a parse cannot.
 */
const foldAt = card.indexOf("function tabContents");
const foldEnd = card.indexOf("\n}", foldAt);
const foldBody = card.slice(foldAt, foldEnd);
const FOLDED = [...foldBody.matchAll(/actor\.tabs\.([a-zA-Z]+) \?\? \[\]/g)].map(m => m[1]);
ok("tabContents folds at least the two retired tabs", FOLDED.length >= 2, FOLDED.join(", "));

for (const id of TAB_IDS) {
  const rendered = ORDERED.includes(id);
  const folded = FOLDED.includes(id);
  ok(`  ${id} is ${rendered ? "rendered" : folded ? "folded into a rendered tab" : "NOWHERE"}`,
    rendered || folded);
}

/* ── the notes tab reads its own rows ─────────────────────────────────────────────────────── */
console.log("\n2. the Notes tab renders the SHEET's notes, not only the session store");
{
  /**
   * ⚠ THE MUTATION IS THE SHIPPED SHAPE: `<ActorNotesPanel notes={actorNotes} …>` with no
   * `sheetNotes`. `notes` and `sheetNotes` are two different lists from two different stores and
   * the panel needs both, so asserting the panel merely EXISTS proves nothing — it existed
   * before, and that is how the rows hid.
   */
  const panelAt = card.indexOf("<ActorNotesPanel");
  const panelEnd = card.indexOf("/>", panelAt);
  const props = card.slice(panelAt, panelEnd);
  ok("the card passes the session notes", /notes=\{actorNotes\}/.test(props));
  ok("...and the sheet's own note rows", /sheetNotes=\{/.test(props), props.replace(/\s+/g, " ").slice(0, 160));
  ok("...through tabContents, so it reads like every other tab",
    /sheetNotes=\{tabContents\(actor, "notes"\)/.test(props));

  const panel = codeOf("src/core/ui/ActorNotesPanel.tsx");
  ok("the panel accepts them", /sheetNotes\?: readonly SheetNote\[\]/.test(panel));
  ok("...and actually renders them", /sheetNotes\.map\(/.test(panel));
  /**
   * ⚠ READ-ONLY ON PURPOSE. The card has no callback that writes `actor.tabs`; a Delete button
   * here would need one, and that is a second writer for a list the editor already owns.
   */
  const listAt = panel.indexOf("sheetNotes.map(");
  const listEnd = panel.indexOf("</div>", listAt);
  ok("...with no Delete button, because the card cannot write actor.tabs",
    !panel.slice(listAt, listEnd).includes("note-delete-button"));
}

/* ── the editor is where they come off ────────────────────────────────────────────────────── */
console.log("\n3. and the editor still owns removing them");
{
  const editor = codeOf("src/core/ui/ActorEditor.tsx");
  ok("the Notes step exists", /activeTab === "notes" &&/.test(editor));
  ok("...bound to the actor's own note rows", /tabId="notes" actions=\{tabsDraft\.notes \?\? \[\]\}/.test(editor));
  ok("...and is reachable from the step bar", /EDITOR_TABS[^\n]*"notes"/.test(editor));
  /**
   * The count badge is the only thing that would have shown Christopher the two rows without
   * opening the step, which is why it is gated rather than assumed.
   */
  ok("...and its badge counts them", /case "notes": return \(tabsDraft\.notes \?\? \[\]\)\.length/.test(editor));
}

/* ── no door into a room with no lights ───────────────────────────────────────────────────── */
console.log("\n4. the editor never offers a destination the card cannot show");
{
  const tab = codeOf("src/core/ui/ActorEditorActionTab.tsx");
  const at = tab.indexOf("const MOVE_TARGETS");
  const end = tab.indexOf("];", at);
  const targets = [...tab.slice(at, end).matchAll(/id: "([a-zA-Z]+)"/g)].map(m => m[1]);
  ok("MOVE_TARGETS parsed", targets.length > 0, targets.join(", "));
  for (const id of targets) {
    ok(`  ${id} is a tab the card renders`, ORDERED.includes(id));
  }
  ok("outOfCombat is no longer offered", !targets.includes("outOfCombat"));
}

console.log(failures ? `\nFAILED (${failures})` : "\nALL PASS");
process.exit(failures ? 1 : 0);
