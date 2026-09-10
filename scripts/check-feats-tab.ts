/**
 * NOTHING LIVES ON A TAB THE EDITOR CANNOT REACH.
 *   npx tsx scripts/check-feats-tab.ts
 *
 * Christopher, 2026-09-10: *"where is the great weapon master on ripsnarls's features because its
 * not there on mine and i cant edit something i cant see"*, and the decision behind it: *"we
 * discussed removing all of the things out of feats because it is a tab we dont need."*
 *
 * ─── ⚠ THE SHAPE: READ BY EVERYTHING, EDITABLE BY NOTHING ───────────────────────────────────
 *
 * Feats and class features are one tab, and it is Features. The card never needed telling — four
 * separate readers scan `Object.values(actor.tabs).flat()`, so a feat on the old `feats` tab still
 * drove its damage and still drew its toggle. The EDITOR was the one reader that was not tolerant:
 * its Features step read `features` alone.
 *
 * And the sweep that was supposed to empty `feats` was keyed ONE-SHOT per browser. Once
 * `fdmc.featsIntoFeatures.migration.v1` was set, anything arriving afterwards stayed there for
 * good — visible on the card, driving numbers, and impossible to open.
 *
 * ⚠ A ONE-SHOT MIGRATION IS A MIGRATION THAT CAN BE OUTRUN. That is the lesson worth keeping: a
 * tab that is "not needed" has to be empty EVERY time, not once.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mergeFeatsIntoFeatures } from "../src/core/campaign/migrateFeatsIntoFeatures";
import type { Actor } from "../src/core/types/actor";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};
const codeOf = (p: string) => readFileSync(resolve(ROOT, p), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

/** A sheet with Great Weapon Master stranded on the retired tab, as Ripsnarl's was. */
const stranded = {
  id: "ripsnarl", name: "Ripsnarl", kind: "player", level: 7,
  stats: { ac: 14, hp: { current: 68, max: 68 }, speed: "40 ft" },
  pinnedReactions: [],
  tabs: {
    features: [{ id: "rage", label: "Rage" }],
    feats: [{ id: "gwm", label: "Great Weapon Master", metadata: { combatStyleDamage: "+3" } }],
  },
} as unknown as Actor;

console.log("Nothing lives on a tab the editor cannot reach\n");

console.log("1. the sweep moves it, and keeps moving it");
{
  const { actor, moved } = mergeFeatsIntoFeatures(stranded);
  ok("Great Weapon Master moves onto features", moved === 1, `moved ${moved}`);
  ok("...and the retired tab is emptied", ((actor.tabs.feats ?? []) as unknown[]).length === 0);
  ok("...without losing what was already there",
    ((actor.tabs.features ?? []) as Array<{ id: string }>).map(f => f.id).join(",") === "rage,gwm");

  // Idempotent: running again moves nothing and changes nothing.
  const again = mergeFeatsIntoFeatures(actor);
  ok("running it again is a no-op", again.moved === 0);

  /**
   * ⚠ THE MUTATION IS THE ONE-SHOT KEY. The driver must not return early on a stored flag, or a
   * feat added after that flag was set is stranded for the life of the browser profile.
   */
  const driver = codeOf("src/core/campaign/migrateFeatsIntoFeatures.ts");
  ok("the driver no longer guards on a one-shot key",
    !/localStorage\.getItem\(KEY\)/.test(driver) && !/const KEY = /.test(driver));
}

console.log("\n2. and the editor can see both tabs regardless");
{
  const editor = codeOf("src/core/ui/ActorEditor.tsx");
  ok("the Features step reads feats as well as features",
    /actions=\{\[\.\.\.\(tabsDraft\.features \?\? \[\]\), \.\.\.\(tabsDraft\.feats \?\? \[\]\)\]\}/.test(editor));
  ok("...and writing back empties the retired tab",
    /features: next, feats: \[\]/.test(editor));
  ok("...and the step's count agrees with the list it shows",
    /\(tabsDraft\.features \?\? \[\]\)\.length \+ \(tabsDraft\.feats \?\? \[\]\)\.length/.test(editor));
}

console.log(failures ? `\nFAILED (${failures})` : "\nALL PASS");
process.exit(failures ? 1 : 0);
