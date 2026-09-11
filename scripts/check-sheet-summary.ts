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
import { deriveSheetSummary, formatSheetSummary, deriveDmReference, formatDmReference } from "../src/core/rules/sheetSummary";
import { deriveActorStats } from "../src/core/state/deriveActorStats";
import { classResourceRowsToAdd } from "../src/modules/dnd-5e/classResourceActions";
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

console.log("\n6. the DM reference reads the tables, not the sheet's authoring");
{
  /**
   * ⚠ THE ASSERTION THIS WHOLE BLOCK EXISTS FOR. Christopher: *"just because it is derived doesnt
   * mean a trait or a class resource got created for it."* This Dwarf has NO feature rows and NO
   * resource pools — the fixture's tabs are empty on purpose — and the reference still has to know
   * about Dwarven Resilience, 120 ft darkvision and a Rage pool.
   */
  const dwarf = { ...barbarian, race: "Dwarf" } as unknown as Actor;
  const ref = deriveDmReference(dwarf, deriveActorStats(dwarf));
  const lines = formatDmReference(ref);

  ok("a species resistance is derived with NO feature row authored",
    ref.damageResponses.some(r => r.type === "poison" && r.response === "resistant"),
    JSON.stringify(ref.damageResponses));
  ok("...and it names the feature it came from",
    ref.damageResponses.some(r => /Dwarven Resilience/.test(r.source)),
    ref.damageResponses.map(r => r.source).join("; "));
  ok("darkvision is derived", ref.darkvisionFt === 120, String(ref.darkvisionFt));
  ok("...and prints on the speed line", lines.some(l => l.includes("Darkvision 120 ft")), lines.join(" | "));
  ok("species traits are listed so they need not be authored as features",
    ref.speciesTraits.length > 0 && lines.some(l => l.startsWith("Dwarf traits:")));

  ok("hit dice come out of the class", lines.some(l => l === "Hit Dice: 9d12."), lines.join(" | "));

  const rage = ref.resources.find(r => /Rage/i.test(r.label));
  ok("the class pool is derived", Boolean(rage), ref.resources.map(r => r.label).join(", "));
  ok("...and flagged as NOT on the sheet, because nothing authored it", rage?.onSheet === false);
  ok("...with its own warning line",
    lines.some(l => l.startsWith("⚠ No pool on the sheet for:") && /Rage/.test(l)), lines.join(" | "));

  /**
   * ⚠ MUTATION: AUTHOR THE POOL AND THE WARNING HAS TO GO. A flag that is always true reports
   * nothing — this is the half that proves `onSheet` is read from `tabs.resources` and not
   * hard-coded.
   */
  const withPool = { ...dwarf, tabs: { ...dwarf.tabs, resources: [{ id: "res-rage", label: "Rage", actionKind: "resource" }] } } as unknown as Actor;
  const after = deriveDmReference(withPool, deriveActorStats(withPool));
  ok("mutation: authoring the pool clears the flag",
    after.resources.find(r => /Rage/i.test(r.label))?.onSheet === true);
  ok("...and removes the warning line",
    !formatDmReference(after).some(l => l.startsWith("⚠ No pool on the sheet for:") && /Rage/.test(l)));
}

console.log("\n7. speed is measured against the 30 ft baseline, and homebrew is typed");
{
  /**
   * *"things like +10 movement and things that those races get or if a class would increase above
   * the baseline 30 ft or even reduce below it."*
   */
  const wood = { ...barbarian, race: "Wood Elf" } as unknown as Actor;
  const ref = deriveDmReference(wood, deriveActorStats(wood));
  ok("a species that deviates says so", Boolean(ref.speed.note), String(ref.speed.note));
  ok("...naming the difference from 30", /\+5 on the 30 ft baseline/.test(ref.speed.note ?? ""), String(ref.speed.note));

  const plain = deriveDmReference({ ...barbarian, race: "Human" } as unknown as Actor, deriveActorStats(barbarian));
  ok("mutation: a 30 ft species adds no line", plain.speed.note === undefined, String(plain.speed.note));

  /**
   * ⚠ THE HOMEBREW FIELD IS `classFeatureTracker.note` — the field 0.7.10.25 kept as *"the one
   * field holding something nothing else knows."* A custom race's resistance has no table to come
   * from, so it is typed, and it prints in the same block as the derived lines.
   */
  const custom = {
    ...barbarian, race: "Skarn (homebrew)",
    classFeatureTracker: { label: "", value: "", note: "Resistance: radiant, necrotic. Speed 40 ft." },
  } as unknown as Actor;
  const lines = formatDmReference(deriveDmReference(custom, deriveActorStats(custom)));
  ok("the DM's own line is carried", lines.includes("Resistance: radiant, necrotic. Speed 40 ft."), lines.join(" | "));
  ok("...and an unknown race derives no species claim", deriveDmReference(custom, deriveActorStats(custom)).speciesName === undefined);
}

console.log("\n8. passives come off the check rows the sheet already has");
{
  /**
   * ⚠ NO SKILL LIST ANYWHERE. Christopher: *"we already have the skills in checks but the question
   * is how do we let it happen without needed to add every skills for someone to check if they are
   * proficient with."* The row IS the declaration and its formula IS the proficiency, so a sheet
   * with two check rows derives two passives and is flagged on the third.
   */
  const seen = {
    ...barbarian,
    tabs: { ...barbarian.tabs, checks: [
      // Proficient: the formula carries @PROF. WIS 10 → +0, PB +3 → passive 13.
      { id: "check-perception", label: "Perception", actionKind: "check", metadata: { attack: "1d20+@WIS+@PROF" } },
      // Not proficient. WIS 10 → passive 10.
      { id: "check-insight", label: "Insight", actionKind: "check", metadata: { attack: "1d20+@WIS" } },
    ] },
  } as unknown as Actor;
  const ref = deriveDmReference(seen, deriveActorStats(seen));
  const p = (skill: string) => ref.passives.find(x => x.skill === skill)!;

  ok("a proficient check row reads 10 + mod + PB", p("Perception").value === 13, String(p("Perception").value));
  ok("an unproficient one reads 10 + mod", p("Insight").value === 10, String(p("Insight").value));
  ok("both are marked as having a row", p("Perception").hasRow && p("Insight").hasRow);

  /**
   * ⚠ AND THE MISSING ONE IS FLAGGED RATHER THAN ASSERTED. INT 8 → 9, which is right for an
   * unproficient character and three low for a proficient one; the flag is the difference between
   * a number and a claim.
   */
  ok("a skill with no row is flagged", p("Investigation").hasRow === false);
  ok("...and its guess is the bare modifier", p("Investigation").value === 9, String(p("Investigation").value));
  const line = formatDmReference(ref).find(l => l.startsWith("Passive:"))!;
  ok("...and the line says so out loud",
    /Investigation 9 \(no check row — unproficient assumed\)/.test(line), line);

  /**
   * ⚠ A FLAT FORMULA HAS TO WORK TOO. Sheets in this party carry both styles, and reading the RAW
   * formula for `@PROF` would score one of them and silently return 10 for the other.
   */
  const flat = {
    ...barbarian,
    tabs: { ...barbarian.tabs, checks: [
      { id: "check-perception", label: "Perception", actionKind: "check", metadata: { attack: "1d20+5" } },
    ] },
  } as unknown as Actor;
  ok("mutation: a flat-number check row still scores",
    deriveDmReference(flat, deriveActorStats(flat)).passives.find(x => x.skill === "Perception")?.value === 15);
}

console.log("\n9. one builder makes the resource row, and the tick actually adds it");
{
  /**
   * ⚠ THE BUILDER WAS INLINE IN THE RESOURCES STEP, which is why nothing else could add a pool.
   * Christopher: *"the derived is suppose to add those fields to the resources correct? if it isnt
   * then we have the srd in the mod in the actor section for no reason."*
   */
  const rows = [{ name: "Barbarian", level: 9 }];
  const toAdd = classResourceRowsToAdd(rows, []);
  ok("the shared builder produces rows", toAdd.length > 0, toAdd.map(r => r.label).join(", "));
  ok("...as spendable resource actions",
    toAdd.every(r => r.actionKind === "resource" && r.metadata?.additive !== undefined));
  ok("...carrying the registry's short-rest regain where it names one",
    toAdd.some(r => r.metadata?.shortRestRegain !== undefined),
    JSON.stringify(toAdd.map(r => ({ l: r.label, s: r.metadata?.shortRestRegain }))));

  /**
   * ⚠ ADDS ONLY WHAT IS MISSING — 0.7.10.25's rule, and the reason this is an add and not a sync:
   * *"an existing pool keeps its current count, because a half-spent Rage must not be silently
   * refilled."*
   */
  ok("mutation: a pool already on the sheet is not offered again",
    classResourceRowsToAdd(rows, ["Rage"]).every(r => !/^Rage$/i.test(r.label)));
  ok("...matched case-insensitively", classResourceRowsToAdd(rows, ["rage"]).every(r => !/^Rage$/i.test(r.label)));

  const editor = codeOf("src/core/ui/ActorEditor.tsx");
  ok("the Resources step uses the shared builder, not a private copy",
    /missing\.map\(classResourceToAction\)/.test(editor));
  ok("...and no inline row-builder is left behind", !/id: `res-\$\{slugifyForActionId/.test(editor));
  ok("the Has class resources tick fills on the way IN", /if \(e\.target\.checked\) \{/.test(editor));
  /**
   * ⚠ ON THE WAY IN ONLY. Unticking is not a statement that a half-spent pool should be destroyed.
   */
  /**
   * The fill is reached ONLY from inside the checked branch — asserted by shape rather than by
   * hunting for an absence, because "no removal anywhere in a 1400-line file" is not a thing a
   * regex can honestly claim.
   */
  ok("...and the fill is reachable only from the checked branch",
    /if \(e\.target\.checked\) \{\s*const added = onFillClassResources/.test(editor));
  ok("...the untick path only clears the note", /\} else \{\s*setFillNote\(null\);\s*\}/.test(editor));
  ok("it reads the DRAFT class, not the saved one",
    /parseClassLevels\(profileDraft\.className, profileDraft\.multiclassLevels\)/.test(editor));
  /**
   * ⚠ AND THE ⚠ LINE IS ACTIONABLE WHERE IT IS READ. A warning that can only be acted on by
   * leaving for another step is a warning that gets read and forgotten.
   */
  ok("the DM Reference offers the fix beside the warning",
    /referenceLines\.some\(l => l\.startsWith\("⚠ No pool on the sheet"\)\) && onFillClassResources/.test(editor));
}

console.log("\n10. the subclass is checked against the registry — named, not sized");
{
  /**
   * ⚠ THE HONEST LIMIT, STATED AS A TEST. `classResources.ts` says in its own header that it has
   * *"13 classes and NO subclasses"*, so there is no max to grant. The short-rest registry DOES
   * name the resource and its level, which is enough to say the sheet is missing one without
   * inventing how many uses it has.
   */
  const champion = { ...barbarian, className: "Fighter", subclassName: "Champion", level: 9 } as unknown as Actor;
  const ref = deriveDmReference(champion, deriveActorStats(champion));
  const lines = formatDmReference(ref);

  ok("a class pool still carries its max", ref.resources.some(r => r.max !== undefined && r.max !== ""));
  ok("subclass rows are read from the registry", Array.isArray(ref.subclassPools));
  /**
   * ⚠ A ROW SAYING "none" IS AN ANSWER, NOT A HOLE — the registry's own words. Most subclasses
   * grant nothing and say so explicitly; those must never surface as a missing pool.
   */
  ok("mutation: a registry row reading \"none\" is never reported as missing",
    !lines.some(l => /Subclass grants[^.]*\bnone\b/i.test(l)), lines.join(" | "));
  ok("...and the subclass line asks for uses rather than inventing them",
    ref.subclassPools.length === 0
    || lines.some(l => l.includes("the registry names them but not how many")),
    lines.join(" | "));
}

console.log("\n11. it is on the DM's editor and not the level-up panel");
{
  const editor = codeOf("src/core/ui/ActorEditor.tsx");
  ok("the reference is computed from the DRAFT, not the saved actor",
    /const preview = \{\s*\.\.\.actor,/.test(editor) && /level: Number\(profileDraft\.level\)/.test(editor));
  /**
   * ⚠ READING `tabsDraft` IS PART OF IT. The missing-pool line compares against `tabs.resources`;
   * off the saved tabs it would keep warning about a pool just added on the Resources step.
   */
  ok("...including the resources being edited right now", /tabs: tabsDraft,/.test(editor));
  ok("mutation: it is withheld in propose mode — the level-up side",
    /referenceLines=\{proposeMode \? undefined : profileReference\}/.test(editor));
}

console.log("\n12. and no migration deletes the typed copy");
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
