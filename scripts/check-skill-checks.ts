/**
 * THE EIGHTEEN SKILLS COME FROM THE SRD, AND THE EDITOR CAN OPEN THE TAB.
 *   npx tsx scripts/check-skill-checks.ts
 *
 * Christopher, 2026-09-10: *"why did raphael not get the checks, this wasnt build by me but
 * generated because checks should come from the SRD."*
 *
 * ⚠ TWO FAULTS, ONE CAUSE. The skill list existed only inside `commonSkillChecks()` in the
 * BROKEN CHAIN module's actor helper, and `EDITOR_TABS` had no Checks step — so the only sheets
 * with checks were the five built by hand, and nothing could make them for a sixth. Measured on
 * the 2026-09-11 export: five actors with 18 rows, Raphael with 0.
 *
 * ⚠ AND EVERY ONE OF THOSE 90 ROWS IS A FROZEN TOTAL. Athletics reads `1d20+7`, which was right at
 * the level somebody typed it. This is the hand-typed note's failure wearing a different costume,
 * eighteen rows at a time, which is why the gate asserts TOKENS rather than merely asserting that
 * a row exists.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SRD_SKILLS, SKILL_BY_NAME, skillCheckId, skillFormula, skillCheckRow,
  proficiencyFromFormula, resolveSkillChecks, classifyFrozenCheck,
} from "../src/modules/dnd-5e/srdSkills";
import { deriveDmReference } from "../src/core/rules/sheetSummary";
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

console.log("The eighteen skills come from the SRD\n");

console.log("1. the list is complete and each skill has its ability");
{
  ok("eighteen skills", SRD_SKILLS.length === 18, String(SRD_SKILLS.length));
  const by = (n: string) => SKILL_BY_NAME.get(n.toLowerCase())?.ability;
  ok("Athletics is STR", by("Athletics") === "str");
  ok("Stealth, Acrobatics and Sleight of Hand are DEX",
    by("Stealth") === "dex" && by("Acrobatics") === "dex" && by("Sleight of Hand") === "dex");
  ok("Perception, Insight, Survival, Medicine and Animal Handling are WIS",
    ["Perception", "Insight", "Survival", "Medicine", "Animal Handling"].every(s => by(s) === "wis"));
  ok("Investigation, Arcana, History, Nature and Religion are INT",
    ["Investigation", "Arcana", "History", "Nature", "Religion"].every(s => by(s) === "int"));
  ok("Deception, Intimidation, Performance and Persuasion are CHA",
    ["Deception", "Intimidation", "Performance", "Persuasion"].every(s => by(s) === "cha"));
  /** ⚠ NO ABILITY IS CON. A CON skill would be a transcription error, not a house rule. */
  ok("mutation: nothing is a CON skill", SRD_SKILLS.every(s => s.ability !== ("con" as never)));
}

console.log("\n2. the formula carries tokens, never a total");
{
  const stealth = SKILL_BY_NAME.get("stealth")!;
  ok("unproficient", skillFormula(stealth, false) === "1d20+@DEX", skillFormula(stealth, false));
  ok("proficient adds @PROF", skillFormula(stealth, true) === "1d20+@DEX+@PROF", skillFormula(stealth, true));
  /** Expertise is the proficiency bonus twice — stated as two terms so the resolver adds it twice. */
  ok("expertise adds it twice", skillFormula(stealth, true, true) === "1d20+@DEX+@PROF+@PROF");

  /**
   * ⚠ THE ASSERTION THAT SEPARATES THIS FROM WHAT THE PARTY CARRIES NOW. Every row on every sheet
   * today is a bare number; if this ever produces one, the feature has become the bug it replaced.
   */
  ok("mutation: no generated formula is a bare total",
    SRD_SKILLS.every(s => /@/.test(skillFormula(s, false)) && /@/.test(skillFormula(s, true))));

  ok("every term carries an explicit +, per the baseWeapons convention",
    SRD_SKILLS.every(s => !/[^+]@/.test(skillFormula(s, true))));
}

console.log("\n3. proficiency reads back out of the formula");
{
  ok("a plain row is unproficient", proficiencyFromFormula("1d20+@DEX").proficient === false);
  ok("one @PROF is proficiency", proficiencyFromFormula("1d20+@DEX+@PROF").proficient === true);
  ok("two is expertise", proficiencyFromFormula("1d20+@DEX+@PROF+@PROF").expertise === true);
  ok("...and one is NOT expertise", proficiencyFromFormula("1d20+@DEX+@PROF").expertise === false);
  /** A frozen total cannot say — it reads as unproficient, and the editor labels it rather than trusting it. */
  ok("a frozen total claims nothing", proficiencyFromFormula("1d20+7").proficient === false);
}

console.log("\n4. the id matches what the sheets already use");
{
  /**
   * ⚠ `check-<slug>` IS NOT A NEW CONVENTION. The hand-built helper emits `check-sleight-of-hand`
   * and the party's rows carry it; a different id here would make every existing row a duplicate
   * rather than the same row.
   */
  ok("check-sleight-of-hand", skillCheckId("Sleight of Hand") === "check-sleight-of-hand", skillCheckId("Sleight of Hand"));
  ok("check-animal-handling", skillCheckId("Animal Handling") === "check-animal-handling");
  const row = skillCheckRow(SKILL_BY_NAME.get("perception")!, true);
  ok("the row is a check, filed under Ability Checks",
    row.actionKind === "check" && row.category === "Ability Checks");
  ok("...and carries the formula where the card reads it",
    row.metadata?.attack === "1d20+@WIS+@PROF", String(row.metadata?.attack));
}

console.log("\n5. the eighteen are GENERATED, not created");
{
  /**
   * Christopher: *"this should still stay generated because they are listed as srd so shouldnt need
   * to be created once the dnd mode is loaded."*
   *
   * ⚠ THE ASSERTION THAT MAKES RAPHAEL WORK. A sheet storing nothing still resolves eighteen rows,
   * so no fill button, no migration and no author action is needed for a skill list the mod
   * already publishes.
   */
  ok("a sheet storing NOTHING still resolves eighteen", resolveSkillChecks([]).length === 18);
  ok("...each with a token formula",
    resolveSkillChecks([]).every(r => /@/.test(String(r.metadata?.attack))));

  /**
   * ⚠ STORED WINS. A frozen `1d20+7` is the author's statement about this character; generation
   * fills gaps and must never overwrite one.
   */
  const frozen = { id: "check-athletics", label: "Athletics", actionKind: "check", metadata: { attack: "1d20+7" } } as never;
  const withFrozen = resolveSkillChecks([frozen]);
  ok("mutation: a stored row replaces the generated one",
    withFrozen.find(r => r.label === "Athletics")?.metadata?.attack === "1d20+7");
  ok("...and the other seventeen are still generated", withFrozen.length === 18);

  /** A check that is not one of the eighteen is kept, not swallowed. */
  const custom = { id: "check-thieves-tools", label: "Thieves' Tools", actionKind: "check", metadata: { attack: "1d20+5" } } as never;
  ok("a custom check survives resolution",
    resolveSkillChecks([custom]).some(r => r.label === "Thieves' Tools"));
  ok("...added beyond the eighteen, not instead of one", resolveSkillChecks([custom]).length === 19);

  /** ⚠ AND THERE IS NO FILL BUTTON TO REGRESS TO. */
  const ed = codeOf("src/core/ui/SkillChecksEditor.tsx");
  ok("mutation: the editor offers no 'add the skills' button", !/Add \$\{?missing/.test(ed) && !/missingSkillCheckRows/.test(ed));
  ok("...and unticking REMOVES the stored row rather than writing an unproficient one",
    /onChange\(proficient \? \[\.\.\.others, skillCheckRow\(skill, true, expertise\)\] : others\)/.test(ed));
}

console.log("\n6. a frozen total says what it was trying to say");
{
  /**
   * Christopher, 2026-09-11: *"fix the checks on all character and creatures."* Ninety rows in the
   * party stored a NUMBER; the parts are recoverable exactly, and `npm run fix:checks` and the
   * Checks step must agree about every one of them or a tick would look like an edit.
   *
   * Ripsnarl: Athletics `1d20+7`, STR +4, PB +3.
   */
  ok("mod alone is unproficient", classifyFrozenCheck(4, 4, 3) === "unproficient");
  ok("mod + PB is proficient", classifyFrozenCheck(7, 4, 3) === "proficient");
  ok("mod + PB twice is expertise", classifyFrozenCheck(10, 4, 3) === "expertise");
  ok("a negative modifier still reads", classifyFrozenCheck(-1, -1, 3) === "unproficient");
  ok("...and proficient on top of one", classifyFrozenCheck(2, -1, 3) === "proficient");

  /**
   * ⚠ THE FOURTH ANSWER IS THE ONE THAT PROTECTS THE SHEET. A total nothing explains has an item,
   * a feat or Reliable Talent in it; calling it proficient would delete that bonus the instant the
   * row became `@STR+@PROF`.
   */
  ok("mutation: an unexplained total is NOT rounded to the nearest guess",
    classifyFrozenCheck(9, 4, 3) === "unexplained");
  ok("...nor is one that is merely close", classifyFrozenCheck(8, 4, 3) === "unexplained");

  /**
   * ⚠ AT PB 0 THE THREE CASES COLLAPSE. A companion with no printed bonus would otherwise read as
   * expertise on every skill whose total happens to equal its modifier.
   */
  ok("mutation: PB 0 explains only the bare modifier",
    classifyFrozenCheck(4, 4, 0) === "unproficient" && classifyFrozenCheck(5, 4, 0) === "unexplained");

  /** And the editor reads frozen rows through the same function, not through the token reader. */
  const ed = codeOf("src/core/ui/SkillChecksEditor.tsx");
  ok("the Checks step reads a frozen row with the same classifier", /classifyFrozenCheck\(frozenTotal, modOf/.test(ed));
  ok("...and falls back to the token reader only when there is no frozen total",
    /reading \? reading === "proficient" \|\| reading === "expertise" : fromTokens\.proficient/.test(ed));
}

console.log("\n7. the editor can open the tab the card renders");
{
  const editor = codeOf("src/core/ui/ActorEditor.tsx");
  /**
   * ⚠ THE WHOLE REASON RAPHAEL HAS NONE. `checks` is in `orderedTabs` on the card and was NOT in
   * `EDITOR_TABS`, so the tab rendered and nothing could author it — the retired-feats shape
   * exactly: a tab the card reads and the editor cannot open is invisible data.
   */
  ok("Checks is a step", /const EDITOR_TABS: EditorTab\[\] = \[[^\]]*"checks"/.test(editor));
  ok("...that renders the skills editor", /activeTab === "checks" && [\s\S]{0,40}SkillChecksEditor/.test(editor));
  ok("...bound to the actor's own check rows", /actions=\{tabsDraft\.checks \?\? \[\]\}/.test(editor));
  ok("...and its badge counts them", /case "checks": return \(tabsDraft\.checks \?\? \[\]\)\.length/.test(editor));

  const ed = codeOf("src/core/ui/SkillChecksEditor.tsx");
  /**
   * ⚠ THE TABLE IS THE MOD'S LIST, NOT THE SHEET'S. It iterates `SRD_SKILLS`, so every skill has a
   * row to tick whether or not this character has ever stored one — which is the difference between
   * Raphael having checks and Raphael needing somebody to make them.
   */
  ok("the table iterates the SRD list, not the stored rows", /SRD_SKILLS\.map\(skill =>/.test(ed));
  ok("...and a skill with no stored row still shows its generated formula",
    /\{!row && <span[^>]*> — generated, not stored<\/span>\}/.test(ed));
  ok("a frozen row is called out rather than trusted", /frozen = Boolean\(row\) && !\/@\/\.test\(formula\)/.test(ed));
  ok("custom checks are listed, not swept up", /SKILL_BY_NAME\.has\(/.test(ed));
}

console.log("\n8. and the passive reads a generated row");
{
  /**
   * ⚠ THE END-TO-END ONE. A generated Perception row has to produce the passive, or the two halves
   * of this work are correct separately and useless together.
   */
  const actor = {
    id: "x", name: "Test", className: "Ranger", level: 5, proficiencyBonus: 3,
    stats: { ac: 15, hp: { current: 40, max: 40 }, speed: "30 ft" },
    abilityScores: { str: { score: 10 }, dex: { score: 16 }, con: { score: 12 }, int: { score: 10 }, wis: { score: 14 }, cha: { score: 8 } },
    tabs: { checks: [skillCheckRow(SKILL_BY_NAME.get("perception")!, true)] },
  } as unknown as Actor;
  const ref = deriveDmReference(actor, deriveActorStats(actor));
  const perception = ref.passives.find(p => p.skill === "Perception")!;
  ok("10 + WIS 2 + PROF 3 = 15", perception.value === 15, String(perception.value));
  ok("...and it is marked as having a row", perception.hasRow === true);

  /** Ticking proficiency off has to move it — otherwise the tick writes a formula nothing reads. */
  const off = { ...actor, tabs: { checks: [skillCheckRow(SKILL_BY_NAME.get("perception")!, false)] } } as unknown as Actor;
  ok("mutation: unticking proficiency drops the passive to 12",
    deriveDmReference(off, deriveActorStats(off)).passives.find(p => p.skill === "Perception")?.value === 12);
}

console.log(failures ? `\nFAILED (${failures})` : "\nALL PASS");
process.exit(failures ? 1 : 0);
