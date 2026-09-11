/**
 * REBUILD FROZEN CHECK TOTALS AS FORMULAS — every character, one pass, nothing guessed.
 *
 *   npm run fix:checks -- <export.json> [out.json]
 *
 * Christopher, 2026-09-11: *"fix the checks on all character and creatures."*
 *
 * ⚠ EVERY CHECK ROW IN THE PARTY IS A FROZEN TOTAL. Ripsnarl's Athletics reads `1d20+7`: correct at
 * the level somebody typed it, and silently wrong at the next one. Ninety rows across five sheets,
 * each of which stops matching its character on the next ASI or proficiency step.
 *
 * ── WHY THIS IS A SCRIPT AND NOT A MIGRATION ────────────────────────────────────────────────
 * 0.7.34: *"REPLACE BY DERIVATION, not a migration that deletes party data."* 0.8.40.9 broke that
 * rule and was reverted. A conversion that REWRITES rows is the same species of act, so it does not
 * run on load, behind a version key, or anywhere the author cannot see it first. It reads an export,
 * writes a NEW file, and leaves the original untouched — and it prints every row it changed.
 *
 * ── AND IT ONLY CHANGES WHAT IT CAN PROVE ───────────────────────────────────────────────────
 * A frozen total encodes a decision that can be recovered exactly. For each row the modifier is
 * derived three ways — unproficient, proficient, expertise — and the stored number must equal ONE
 * of them:
 *
 *   `1d20+7` on STR 18 (+4) with PB +3  →  +4 +3  →  PROFICIENT, rewritten `1d20+@STR+@PROF`
 *   `1d20+2` on DEX 14 (+2)             →  +2     →  unproficient, the stored row is REMOVED
 *                                                     because the generated row already says it
 *   `1d20+9` on STR 18 (+4) with PB +3  →  matches nothing — LEFT ALONE and reported
 *
 * That last case is the one that matters. A total the three derivations cannot explain has
 * something else in it — an item, a feat, Reliable Talent, a racial bonus — and rewriting it as
 * `@STR+@PROF` would silently delete that bonus. **Anything unexplained keeps its number.**
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { deriveActorStats } from "../src/core/state/deriveActorStats";
import { proficiencyBonus } from "../src/core/rules/dnd5e";
import { characterLevel } from "../src/core/rules/multiclass";
import { SKILL_BY_NAME, skillFormula, resolveSkillChecks, classifyFrozenCheck } from "../src/modules/dnd-5e/srdSkills";
import { resolveFormulaVars } from "../src/core/state/resolveFormulaVars";
import type { Actor } from "../src/core/types/actor";
import type { ActorAction } from "../src/core/types/tabs";

const [, , IN, OUT] = process.argv;
if (!IN) {
  console.error("usage: npm run fix:checks -- <export.json> [out.json]");
  process.exit(1);
}
const outPath = OUT ?? IN.replace(/\.json$/, "") + ".checks-fixed.json";

const raw = JSON.parse(readFileSync(resolve(IN), "utf8")) as unknown;

/** Exports have shipped in three shapes; edit in place whichever one arrived. */
function actorsOf(data: unknown): Actor[] {
  if (Array.isArray(data)) return data as Actor[];
  const obj = data as Record<string, unknown>;
  const inner = (obj.actors ?? obj.library ?? obj) as Record<string, unknown>;
  return Object.values(inner).filter(a => a && typeof a === "object" && "tabs" in (a as object)) as Actor[];
}

const actors = actorsOf(raw);
if (actors.length === 0) {
  console.error(`No actors found in ${IN}.`);
  process.exit(1);
}

/** Sum the flat terms after the dice are removed — the same reader the passives use. */
function flatTotal(formula: string): number | null {
  if (/@/.test(formula)) return null; // already a formula; nothing frozen to convert
  const withoutDice = formula.replace(/\b\d*d\d+\b/gi, "");
  if (!/\d/.test(withoutDice) && !/[+-]\s*0/.test(withoutDice)) return 0;
  let total = 0;
  for (const m of withoutDice.matchAll(/([+-]?)\s*(\d+)/g)) total += (m[1] === "-" ? -1 : 1) * Number(m[2]);
  return total;
}

/**
 * ⚠ CAPTURED BEFORE ANYTHING IS TOUCHED. The verification at the end needs the numbers the sheets
 * had on the way IN, and reading them back off the edited actors would compare the result with
 * itself — a check that cannot fail.
 */
const originalTotals = new Map<string, Map<string, number>>();
for (const actor of actors) {
  const stats = deriveActorStats(actor);
  const m = new Map<string, number>();
  for (const row of (actor.tabs?.checks ?? []) as ActorAction[]) {
    if (!SKILL_BY_NAME.has((row.label ?? "").trim().toLowerCase())) continue;
    const f = String(row.metadata?.attack ?? row.description ?? "");
    const t = flatTotal(f) ?? flatTotal(resolveFormulaVars(f, actor, stats));
    if (t !== null) m.set(row.label, t);
  }
  originalTotals.set(actor.name, m);
}

let converted = 0, removed = 0, kept = 0, alreadyFine = 0;
const unexplained: string[] = [];

console.log(`Rebuilding frozen check totals — ${actors.length} actor(s) from ${IN}\n`);

for (const actor of actors) {
  const stats = deriveActorStats(actor);
  const printed = Number(actor.proficiencyBonus);
  const pb = printed > 0 ? printed : proficiencyBonus(characterLevel(actor));
  const rows = (actor.tabs?.checks ?? []) as ActorAction[];
  if (rows.length === 0) continue;

  const next: ActorAction[] = [];
  const changes: string[] = [];

  for (const row of rows) {
    const skill = SKILL_BY_NAME.get((row.label ?? "").trim().toLowerCase());
    const formula = String(row.metadata?.attack ?? row.description ?? "");
    const total = skill ? flatTotal(formula) : null;

    if (!skill || total === null) {
      /** Not one of the eighteen, or already a formula — untouched either way. */
      next.push(row);
      if (skill) alreadyFine++;
      continue;
    }

    const mod = stats[skill.ability].modifier;
    const reading = classifyFrozenCheck(total, mod, pb);
    if (reading === "unproficient") {
      /**
       * ⚠ REMOVED, NOT REWRITTEN. Unproficient is what `resolveSkillChecks` generates, so storing
       * it is a second copy of the mod's own list. The row still renders; it just stops being data.
       */
      removed++;
      changes.push(`  − ${row.label.padEnd(16)} ${formula.padEnd(10)} → generated (unproficient, ${mod >= 0 ? "+" : ""}${mod})`);
      continue;
    }
    if (reading === "proficient" || reading === "expertise") {
      const expertise = reading === "expertise";
      const rebuilt = skillFormula(skill, true, expertise);
      next.push({
        ...row,
        description: rebuilt,
        metadata: { ...row.metadata, attack: rebuilt, details: rebuilt },
      });
      converted++;
      changes.push(`  ✎ ${row.label.padEnd(16)} ${formula.padEnd(10)} → ${rebuilt}${expertise ? "  (expertise)" : ""}`);
      continue;
    }

    /**
     * ⚠ UNEXPLAINED TOTALS KEEP THEIR NUMBER. Something else is in there and this script does not
     * know what; rewriting it as tokens would delete a bonus nobody recorded anywhere else.
     */
    next.push(row);
    kept++;
    unexplained.push(`${actor.name} · ${row.label}: ${formula} — ${skill.ability.toUpperCase()} ${mod >= 0 ? "+" : ""}${mod}, PB +${pb}; no combination gives ${total}`);
  }

  if (changes.length > 0) {
    console.log(`── ${actor.name}`);
    for (const c of changes) console.log(c);
    console.log("");
  }
  actor.tabs.checks = next;
}

/* ══ PROVE NO NUMBER MOVED ═════════════════════════════════════════════════════════════════════
 *
 * ⚠ A CONVERSION IS ONLY SAFE IF IT IS VALUE-PRESERVING, and saying so is not the same as showing
 * it. Every row is re-read the way the CARD reads it — through `resolveSkillChecks`, so removed
 * rows come back generated — resolved against the actor, and compared with the number the sheet
 * had before. A single disagreement aborts without writing the file.
 */
const before = new Map<string, number>();
for (const [name, rows] of originalTotals) for (const [label, total] of rows) before.set(`${name}::${label}`, total);

const drift: string[] = [];
for (const actor of actors) {
  const stats = deriveActorStats(actor);
  for (const row of resolveSkillChecks(actor.tabs?.checks ?? [])) {
    const key = `${actor.name}::${row.label}`;
    if (!before.has(key)) continue;
    const now = flatTotal(resolveFormulaVars(String(row.metadata?.attack ?? ""), actor, stats));
    if (now !== before.get(key)) drift.push(`${key}: was ${before.get(key)}, now ${now}`);
  }
}

if (drift.length > 0) {
  console.error(`\n✗ ABORTED — ${drift.length} row(s) changed value. Nothing was written.`);
  for (const d of drift) console.error("  " + d);
  process.exit(1);
}
console.log(`\n✓ every one of the ${before.size} rows resolves to the number it had before.`);

writeFileSync(resolve(outPath), JSON.stringify(raw, null, 2), "utf8");

console.log(`${converted} rewritten as formulas · ${removed} removed (the generated row says the same)`);
console.log(`${alreadyFine} already formulas · ${kept} left alone because the number could not be explained`);
if (unexplained.length > 0) {
  console.log("\n⚠ LEFT ALONE — each of these has a bonus from somewhere this script cannot see:");
  for (const u of unexplained) console.log("  " + u);
}
console.log(`\nWrote ${outPath}. The original is untouched — import this one when you have read the list.`);
