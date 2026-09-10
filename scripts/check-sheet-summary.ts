/**
 * THE COMBAT SUMMARY IS DERIVED, AND NOTHING DELETES THE TYPED ONE.
 *   npx tsx scripts/check-sheet-summary.ts
 *
 * Christopher, 2026-09-10: *"you stripped out everything that the note section was suppose to do on
 * the main profile page … see what i wanted the notes section to contain and be generated from."*
 *
 * ⚠ TWO THINGS ARE GATED HERE AND THE SECOND ONE IS THE IMPORTANT ONE.
 *
 *   1. the summary is GENERATED — every line moves when the actor moves
 *   2. no migration DELETES the typed copy
 *
 * (2) is a regression guard with a name on it. 0.8.40.9 shipped exactly such a migration, against
 * a rule this codebase had already written down twice — 0.7.10.25, trimming this very tracker:
 * *"the stored values are left on existing actors rather than deleted"*; 0.7.34, on the bond
 * ladder: *"REPLACE BY DERIVATION, not a migration that deletes party data … a migration would
 * have been irreversible loss for a change a render rule expresses completely."* A rule written in
 * two commit messages and no gate is a rule that gets broken by the next person who does not read
 * them, and that person was me.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { deriveSheetSummary, formatSheetSummary } from "../src/core/rules/sheetSummary";
import { deriveActorStats } from "../src/core/state/deriveActorStats";
import type { Actor } from "../src/core/types/actor";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};
const codeOf = (p: string) => readFileSync(resolve(ROOT, p), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

/** A Ripsnarl-shaped Barbarian: STR 18, CON 14, proficient in STR and CON saves, PB +3. */
const barbarian = {
  id: "rip", name: "Ripsnarl", className: "Barbarian", level: 9, proficiencyBonus: 3,
  stats: { ac: 15, hp: { current: 90, max: 90 }, speed: "40 ft" },
  abilityScores: {
    str: { score: 18, saveProficient: true }, dex: { score: 14 }, con: { score: 14, saveProficient: true },
    int: { score: 8 }, wis: { score: 10 }, cha: { score: 12 },
  },
  tabs: { main: [], equipment: [], features: [] },
} as unknown as Actor;

const summaryOf = (a: Actor) => deriveSheetSummary(a, deriveActorStats(a));

console.log("The combat summary is derived, and nothing deletes the typed one\n");

console.log("1. the saves line is computed, not copied");
{
  const s = summaryOf(barbarian);
  const by = (id: string) => s.saves.find(x => x.ability === id)!;
  ok("STR is proficient: +4 mod +3 PB = +7", by("str").modifier === 7, String(by("str").modifier));
  ok("CON is proficient: +2 mod +3 PB = +5", by("con").modifier === 5, String(by("con").modifier));
  ok("DEX is NOT proficient: +2 flat", by("dex").modifier === 2 && !by("dex").proficient);
  ok("INT is negative and stays negative", by("int").modifier === -1, String(by("int").modifier));
  ok("the printed proficiency bonus is used", s.proficiencyBonus === 3);

  const line = formatSheetSummary(s)[0];
  ok("...and it prints the way a sheet prints it",
    line.startsWith("Saves: STR +7, DEX +2, CON +5, INT -1, WIS +0, CHA +1.") && line.includes("Prof +3."),
    line);
}

console.log("\n2. mutation: move the actor and every line moves with it");
{
  /**
   * ⚠ THE ONE ASSERTION THAT SEPARATES THIS FROM A STORED STRING. A hand-typed note reads the same
   * after an ASI; this must not. If these two lines ever match, the summary has been cached
   * somewhere and the whole feature has quietly become the bug it replaced.
   */
  const levelled = {
    ...barbarian, proficiencyBonus: 4,
    abilityScores: { ...barbarian.abilityScores, str: { score: 20, saveProficient: true } },
  } as unknown as Actor;
  const before = formatSheetSummary(summaryOf(barbarian))[0];
  const after = formatSheetSummary(summaryOf(levelled))[0];
  ok("an ASI and a PB step change the saves line", before !== after);
  ok("...to the right numbers", after.startsWith("Saves: STR +9,") && after.includes("Prof +4."), after);
}

console.log("\n3. the AC line names what made the number");
{
  const s = summaryOf(barbarian);
  ok("a character with no equipment prints the bare AC",
    formatSheetSummary(s)[1] === "AC 15.", formatSheetSummary(s)[1]);

  const armoured = {
    ...barbarian, stats: { ...barbarian.stats, ac: 11 },
    tabs: { ...barbarian.tabs, equipment: [
      { id: "equip-chain", label: "Chain Mail", actionKind: "equipment",
        metadata: { equipped: true, statEffects: [{ type: "setAC", value: 16 }] } },
      { id: "equip-shield", label: "Shield", actionKind: "equipment",
        metadata: { equipped: true, statEffects: [{ type: "addAC", value: 2 }] } },
    ] },
  } as unknown as Actor;
  const line = formatSheetSummary(summaryOf(armoured))[1];
  ok("equipment is named in the line", line.includes("Chain Mail") && line.includes("Shield"), line);
  ok("...and the base is shown beside the total", /^AC \d+ — 11 base, with /.test(line), line);
}

console.log("\n4. the casting lines come off the class, multiclass included");
{
  const sorcerer = {
    ...barbarian, className: "Sorcerer", classes: [{ name: "Sorcerer", level: 9, castingAbility: "cha" }],
    abilityScores: { ...barbarian.abilityScores, cha: { score: 18 } },
  } as unknown as Actor;
  const s = summaryOf(sorcerer);
  ok("one caster row", s.casting.length === 1, JSON.stringify(s.casting));
  ok("spell attack is mod + PB", s.casting[0]?.attack === 7, String(s.casting[0]?.attack));
  ok("save DC is 8 + mod + PB", s.casting[0]?.saveDc === 15, String(s.casting[0]?.saveDc));

  const multi = {
    ...sorcerer, className: "Paladin / Sorcerer",
    classes: [{ name: "Paladin", level: 2, castingAbility: "cha" }, { name: "Sorcerer", level: 7, castingAbility: "cha" }],
  } as unknown as Actor;
  ok("a multiclass caster prints one line per class", summaryOf(multi).casting.length === 2);

  /**
   * ⚠ A SINGLE-CLASS CASTER GROWS NO `classes[]` — className and level already say it. Without the
   * fall-through to the class NAME, every single-class Wizard, Cleric and Artificer derived
   * nothing and the profile block read "pick one".
   */
  const wizard = { ...barbarian, className: "Wizard", classes: undefined,
    abilityScores: { ...barbarian.abilityScores, int: { score: 18 } } } as unknown as Actor;
  ok("mutation: a single-class caster with no classes[] still derives", summaryOf(wizard).casting.length === 1,
    JSON.stringify(summaryOf(wizard).casting));

  ok("a non-caster prints no casting line", summaryOf(barbarian).casting.length === 0);
}

console.log("\n5. it is rendered above the typed rows, and stored nowhere");
{
  const card = codeOf("src/core/ui/ActorCard.tsx");
  ok("the card generates it on render", /summaryLines=\{formatSheetSummary\(/.test(card));
  const panel = codeOf("src/core/ui/ActorNotesPanel.tsx");
  ok("the panel renders it", /summaryLines\.map\(/.test(panel));
  /**
   * ⚠ ABOVE THE TYPED ROWS, BY POSITION. A reader who meets the hand-typed copy first has no way
   * to know the generated one disagrees; printed together, a stale sentence is obvious.
   */
  ok("...above the sheet's typed notes",
    panel.indexOf("summaryLines.map(") < panel.indexOf("sheetNotes.map("));

  const mod = codeOf("src/core/rules/sheetSummary.ts");
  ok("mutation: the summary module writes nothing back onto the actor",
    !/classFeatureTracker\s*[:=]/.test(mod) && !/save\w*\(/.test(mod));
}

console.log("\n6. and no migration deletes the typed copy");
{
  /**
   * ⚠ NAMED AND SEARCHED FOR. 0.8.40.9's `stripImportedReferenceNotes` removed note rows and blanked
   * `classFeatureTracker.note` — the field 0.7.10.25 kept on purpose as *"the one field holding
   * something nothing else knows."*
   */
  ok("the deleting migration is gone",
    !existsSync(resolve(ROOT, "src/core/campaign/stripImportedReferenceNotes.ts")));

  const campaign = resolve(ROOT, "src/core/campaign");
  const offenders: string[] = [];
  for (const f of readdirSync(campaign)) {
    if (!f.endsWith(".ts")) continue;
    const src = codeOf(`src/core/campaign/${f}`);
    /** A migration may EMPTY a tab it is folding away (feats), but must not drop note rows or the tracker note. */
    if (/notes:\s*(keep|\[\])/.test(src) || /classFeatureTracker[^}]*note:\s*""/.test(src)) offenders.push(f);
  }
  ok("no migration strips notes or the tracker note", offenders.length === 0, offenders.join(", "));

  for (const entry of ["src/App.tsx", "src/dm-panel.tsx"]) {
    ok(`  ${entry} does not run one`, !/migrateImportedReferenceNotes/.test(codeOf(entry)));
  }
}

console.log(failures ? `\nFAILED (${failures})` : "\nALL PASS");
process.exit(failures ? 1 : 0);
