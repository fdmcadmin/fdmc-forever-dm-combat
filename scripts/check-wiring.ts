/**
 * THE WIRING GATE — is every module REACHABLE, and by whom?
 *
 * Run: npm run check:wiring
 *
 * ⚠ THIS IS THE OTHER HALF OF RULE 0. RULE 0 says scan before you build, because the capability is
 * probably already there. The half that keeps costing this project is the follow-up: **does
 * anything CALL it?**
 *
 * The receipts are in MASTER. `summon.ts` resolved every formula with zero production callers.
 * `effectiveSustain` + `SUSTAIN_TRAITS` sat with no caller while the panel used a legacy
 * multiplier. `estimateMonsterDamage` already took `attacksPerTurn` and no call site passed it.
 * `RosterGroup.arrivesRound` had no production writer. And 335 parsed SRD creatures reach nothing.
 * Every one is the same shape: the code is right, the data is right, nothing connects them.
 *
 * A type error cannot catch this and neither can a unit test — a module with no importer still
 * compiles and its own test still passes. Only the GRAPH shows it.
 *
 * ── THE THREE ANSWERS, AND ONLY ONE OF THEM IS A BUG ────────────────────────────────────────
 *
 *   LIVE          imported, transitively, from one of the HTML entry points. It ships.
 *   BUILD INPUT   not in any bundle because a SCRIPT compiles it — `capabilities.ts` is the
 *                 engine artifact's entry, deliberately outside the app graph so the artifact
 *                 cannot contain the loader that chooses artifacts (0.8.7.0).
 *   SCRIPT-ONLY   nothing but a gate imports it. ⚠ THIS IS THE DANGEROUS ONE: a capability
 *                 proven only by its own test script is not a feature, and it is the exact shape
 *                 MASTER records four times over.
 *   ORPHAN        nothing imports it at all. Wiring still to do, or a file to delete.
 *
 * ⚠ THE EXIT CHECK IS THE LAST THING IN THIS FILE. See MASTER on `check:summons`.
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

// ⚠ fileURLToPath, not `.pathname` — a space in the repo path arrives percent-encoded otherwise,
// and "Codex%20Workspace" is a directory that does not exist.
const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const SRC = join(ROOT, "src");
const SCRIPTS = join(ROOT, "scripts");

let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};

function walk(dir: string, match: RegExp, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, match, out);
    else if (match.test(e)) out.push(p);
  }
  return out;
}

const files = walk(SRC, /\.(ts|tsx)$/).filter(f => !/\.d\.ts$/.test(f));
const scripts = existsSync(SCRIPTS) ? walk(SCRIPTS, /\.(ts|tsx|mjs|js)$/) : [];
const rel = (p: string) => relative(SRC, p).replace(/\\/g, "/");

/* ── Entry points: whatever the HTML files load ─────────────────────────────────────────── */
const entries: string[] = [];
for (const html of readdirSync(ROOT).filter(f => f.endsWith(".html"))) {
  for (const m of readFileSync(join(ROOT, html), "utf8").matchAll(/src="\/(src\/[^"]+\.tsx?)"/g)) {
    const p = join(ROOT, m[1]);
    if (existsSync(p)) entries.push(p);
  }
}

/* ── The import graph ───────────────────────────────────────────────────────────────────── */
const IMPORT = /(?:^|\n)\s*(?:import|export)\s[^;]*?from\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;

function resolveSpec(fromFile: string, spec: string): string | null {
  if (!spec.startsWith(".")) return null;
  const base = resolve(dirname(fromFile), spec);
  for (const c of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return null;
}

const importsOf = new Map<string, string[]>();
for (const f of [...files, ...scripts]) {
  const out: string[] = [];
  for (const m of readFileSync(f, "utf8").matchAll(IMPORT)) {
    const target = resolveSpec(f, m[1] ?? m[2]);
    if (target) out.push(target);
  }
  importsOf.set(f, out);
}

function reachFrom(roots: string[]): Set<string> {
  const seen = new Set<string>();
  const stack = [...roots];
  while (stack.length) {
    const f = stack.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    for (const t of importsOf.get(f) ?? []) if (!seen.has(t)) stack.push(t);
  }
  return seen;
}

const live = reachFrom(entries);
const fromScripts = reachFrom(scripts);

/**
 * A file a build script COMPILES rather than imports — named in a script as a path.
 *
 * ⚠ THIS FILE IS EXCLUDED FROM ITS OWN SEARCH. The ledgers below quote the very paths being
 * classified, and this gate lives in `scripts/` — so without the filter it read its own
 * known-orphan list as "a script names this file" and reclassified two real orphans as build
 * inputs. A checker that reads its own output is measuring itself.
 */
const scriptText = scripts
  .filter(s => !s.endsWith("check-wiring.ts"))
  .map(s => readFileSync(s, "utf8")).join("\n");
const isBuildInput = (f: string) => {
  const name = rel(f);
  return scriptText.includes(name) || scriptText.includes(name.replace(/\.tsx?$/, ""));
};

/**
 * ⚠ ORDER MATTERS, AND GETTING IT WRONG HIDES THE FINDING.
 *
 * The first version asked "is this file's path mentioned in any script?" before asking "does a
 * script IMPORT it" — and since a gate naturally names the module it tests, every script-only
 * module was absorbed into "build input" and the whole audit came back clean. The import graph is
 * EXACT; a path appearing in a string is a guess. Ask the exact question first.
 */
const orphans: string[] = [];
const scriptOnly: string[] = [];
const buildInputs: string[] = [];
for (const f of files) {
  if (live.has(f)) continue;
  if (fromScripts.has(f)) scriptOnly.push(rel(f));
  else if (isBuildInput(f)) buildInputs.push(rel(f));
  else orphans.push(rel(f));
}
orphans.sort(); scriptOnly.sort(); buildInputs.sort();

/**
 * ⚠ THESE LISTS ARE A LEDGER OF DEBT, NOT A PERMISSION SLIP.
 *
 * Every line ships in no bundle. They are pinned so the count cannot grow quietly; each is either
 * wiring still to do or a file to delete. Removing a line is progress. ADDING one takes the same
 * deliberate edit as writing the code, which is the point.
 */
const KNOWN_ORPHANS: readonly string[] = [
  // Campaign content with no reader on any surface.
  "modules/the-broken-chain/content/tabActions.ts",
  // A monster-runtime slot component nothing renders.
  "core/monsters/runtime/MonsterRuntimeSetupSlot.tsx",
];

const KNOWN_SCRIPT_ONLY: readonly string[] = [
  // ⚠ EACH OF THESE IS PROVEN BY A GATE AND CALLED BY NOTHING THE DM CAN REACH.
  "core/encounter-band/encounterDiagnostics.ts",       // validate:invariants only
  "core/ui/reactionEconomyAudit.ts",                   // check:reactions only
  "modules/the-broken-chain/actors/actorHelpers.ts",   // check:partyfit / check:healing only
  // The SRD modules used to sit here — 335 creatures proven by a gate and reachable by nothing.
  // 0.8.9.0 added the third source to resolveMonsterLibrary and they are LIVE. Left as a note
  // rather than a blank: the ledger shrinking is the only visible record that debt was paid.
];

console.log(`Wiring — ${files.length} modules, ${entries.length} entry points, ${scripts.length} scripts\n`);

console.log("Entry points");
ok("every HTML entry resolves to a source file", entries.length === 8, `${entries.length} found`);

console.log(`\nLIVE — ${live.size} of ${files.length} modules reach a bundle`);

console.log(`\nBUILD INPUT — ${buildInputs.length} (compiled by a script, deliberately outside the app graph)`);
for (const b of buildInputs) console.log(`     ${b}`);

console.log(`\nSCRIPT-ONLY — ${scriptOnly.length} (a gate proves it; nothing a DM touches calls it)`);
for (const s of scriptOnly) console.log(`     ${s}${KNOWN_SCRIPT_ONLY.includes(s) ? "" : "   ⚠ NEW"}`);

console.log(`\nORPHAN — ${orphans.length} (no importer anywhere)`);
for (const o of orphans) console.log(`     ${o}${KNOWN_ORPHANS.includes(o) ? "" : "   ⚠ NEW"}`);

console.log("\nThe ledger");
const newOrphans = orphans.filter(o => !KNOWN_ORPHANS.includes(o));
const newScriptOnly = scriptOnly.filter(s => !KNOWN_SCRIPT_ONLY.includes(s));
const staleOrphans = KNOWN_ORPHANS.filter(k => !orphans.includes(k));
const staleScriptOnly = KNOWN_SCRIPT_ONLY.filter(k => !scriptOnly.includes(k));

ok("no NEW orphan", newOrphans.length === 0, newOrphans.join(", "));
ok("no NEW script-only module", newScriptOnly.length === 0, newScriptOnly.join(", "));
ok("the orphan ledger has no stale entries", staleOrphans.length === 0,
  staleOrphans.length ? `now wired — delete from the list: ${staleOrphans.join(", ")}` : "");
ok("the script-only ledger has no stale entries", staleScriptOnly.length === 0,
  staleScriptOnly.length ? `now wired — delete from the list: ${staleScriptOnly.join(", ")}` : "");

console.log(`\n${failures === 0 ? "PASS" : `FAIL — ${failures} check(s)`}`);
process.exit(failures === 0 ? 0 : 1);
