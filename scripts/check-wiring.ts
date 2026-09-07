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

/* ══ EXPORT GRANULARITY ═════════════════════════════════════════════════════════════════════
 *
 * ⚠ A LIVE MODULE PROVES NOTHING ABOUT WHAT IS INSIDE IT.
 *
 * Everything above answers "does anything import this FILE?" and that is where this gate stopped —
 * so 0.8.15 and 0.8.16 shipped five exports with no production caller while the ledger stayed
 * clean and PASS printed. `healingResolution.ts` is imported by `ActorCard.tsx`, so it is LIVE; of
 * its four exports only `usableHealing` is ever called. `initiativeOrder.ts` is imported by the
 * checker; two of its four exports are reached.
 *
 * Christopher: *"why [are] both the class midigation, the partyDefenseFromActors unable to be
 * called if rule 0 part 2 is being followed."* For those two the answer was that neither is a
 * wiring fault — one IS called, the other was never built. But the question found this: the gate
 * implementing RULE 0's second half could not see one level down, which is exactly where the
 * failure it exists to catch had moved.
 *
 * ── HOW REACH IS DECIDED, AND WHY IT IS THE IMPORT AND NOT THE TEXT ───────────────────────────
 *
 * An export is reached when another file IMPORTS THAT NAME from it. Grepping for the identifier
 * would be a guess: short names collide, a name in a comment counts, and a local variable sharing
 * the name reads as a call. The import statement is exact.
 *
 * ⚠ A NAMESPACE IMPORT REACHES EVERYTHING. `import * as X from "./m"` can use any export, and
 * nothing short of resolving `X.foo` would tell which — so the whole module is treated as reached
 * rather than reporting every export as an orphan. Under-reporting beats a wall of false alarms
 * nobody reads.
 *
 * ⚠ TYPES ARE NOT CHECKED. An unused type is dead weight the compiler already flags at its use
 * site; an unused FUNCTION is a capability nobody can reach, which is the thing that keeps costing.
 */
const VALUE_EXPORT = /^\s*export\s+(?:async\s+)?(?:function\*?|const|class|let|var)\s+([A-Za-z_$][\w$]*)/gm;
const EXPORT_LIST = /^\s*export\s*\{([^}]*)\}\s*(?:from\s*["'][^"']+["'])?\s*;?/gm;
/** `import { a, b as c }` / `import Default,` — the NAMES a file pulls from one module. */
const IMPORT_NAMES = /(?:^|\n)\s*(?:import|export)\s+(?:type\s+)?(?:([A-Za-z_$][\w$]*)\s*,?\s*)?(?:\{([^}]*)\})?\s*(?:from\s*)?["']([^"']+)["']/g;
const NAMESPACE_IMPORT = /(?:^|\n)\s*import\s+\*\s+as\s+[A-Za-z_$][\w$]*\s+from\s*["']([^"']+)["']/g;

function valueExportsOf(file: string): string[] {
  const text = readFileSync(file, "utf8");
  const names = new Set<string>();
  for (const m of text.matchAll(VALUE_EXPORT)) names.add(m[1]);
  for (const m of text.matchAll(EXPORT_LIST)) {
    for (const part of m[1].split(",")) {
      const name = part.trim().split(/\s+as\s+/)[0].trim();
      // `export { type Foo }` and bare `type` re-exports are not value exports.
      if (name && !/^type\b/.test(part.trim())) names.add(name);
    }
  }
  return [...names];
}

/** file → { names it imports from that target, or ALL for a namespace import } */
function namesPulledBy(readers: string[]): { byTarget: Map<string, Set<string>>; whole: Set<string> } {
  const byTarget = new Map<string, Set<string>>();
  const whole = new Set<string>();
  for (const f of readers) {
    const text = readFileSync(f, "utf8");
    for (const m of text.matchAll(NAMESPACE_IMPORT)) {
      const t = resolveSpec(f, m[1]);
      if (t) whole.add(t);
    }
    for (const m of text.matchAll(IMPORT_NAMES)) {
      const target = resolveSpec(f, m[3]);
      if (!target || target === f) continue;
      const set = byTarget.get(target) ?? new Set<string>();
      if (m[1]) set.add(m[1]);
      for (const part of (m[2] ?? "").split(",")) {
        const name = part.trim().split(/\s+as\s+/)[0].trim();
        if (name && !/^type\b/.test(part.trim())) set.add(name);
      }
      byTarget.set(target, set);
    }
  }
  return { byTarget, whole };
}

const prodPull = namesPulledBy(files);
const scriptPull = namesPulledBy(scripts);

/**
 * ⚠ AN EXPORT USED INSIDE ITS OWN LIVE MODULE IS REACHED, and the first version of this called
 * fifty of them orphans.
 *
 * `encounterDprAt` is exported AND called by `simulateEncounter` two functions down; the code runs
 * on every encounter. `resolveSummonFormula` is exported and used by `materializeSummon`. Reporting
 * those as unreachable is false — the export is merely wider than it needs to be, which is an API
 * question, not a wiring one. The failure this gate is for is a function NOTHING runs.
 *
 * ⚠ COMMENTS ARE STRIPPED FIRST. This codebase names its own functions in prose constantly — the
 * note above `relativeHostileOrder` says "relativeHostileOrder" — so counting raw text would mark
 * every genuine orphan as internally used and the gate would find nothing. That is the
 * cannot-fail shape all over again.
 */
const stripComments = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");

function usedInsideOwnModule(file: string, name: string): boolean {
  const code = stripComments(readFileSync(file, "utf8"));
  const hits = code.match(new RegExp(`\\b${name.replace(/\$/g, "\\$")}\\b`, "g"))?.length ?? 0;
  return hits > 1;   // the declaration itself is the first
}

/** An entry point's own exports answer to the HTML that loads it, not to another module. */
const entrySet = new Set(entries);
const orphanExports: string[] = [];
const scriptOnlyExports: string[] = [];
let exportsChecked = 0;

for (const f of files) {
  if (!live.has(f) || entrySet.has(f)) continue;          // dead modules are already reported above
  if (prodPull.whole.has(f) || scriptPull.whole.has(f)) continue;   // namespace import — reaches all
  const reachedByProd = prodPull.byTarget.get(f) ?? new Set<string>();
  const reachedByScript = scriptPull.byTarget.get(f) ?? new Set<string>();
  for (const name of valueExportsOf(f)) {
    exportsChecked++;
    if (reachedByProd.has(name)) continue;
    if (usedInsideOwnModule(f, name)) continue;
    if (reachedByScript.has(name)) scriptOnlyExports.push(`${rel(f)} → ${name}`);
    else orphanExports.push(`${rel(f)} → ${name}`);
  }
}
orphanExports.sort(); scriptOnlyExports.sort();

/**
 * ⚠ THE SAME LEDGER DISCIPLINE AS THE MODULE LISTS, one level down. Each line is a capability
 * nothing a DM touches can reach. Removing one is progress; adding one is a deliberate edit.
 */
const KNOWN_SCRIPT_ONLY_EXPORTS: readonly string[] = [
  "core/constants/damageTypes.ts → damageTypesOf",
  "core/encounter-band/controlPricing.ts → proneIncomingSwing",
  "core/encounter-band/controlPricing.ts → withRerollOnFail",
  "core/encounter-band/initiativeOrder.ts → relativeHostileOrder",
  "core/encounter-band/reachability.ts → edgeGapFromCentres",
  "core/encounter-band/reachability.ts → priceForcedMovement",
  "core/encounter-band/reachability.ts → priceFrightened",
  "core/encounter-band/reachability.ts → priceGrappled",
  "core/encounter-band/reachability.ts → priceProne",
  "core/encounter-engine/index.ts → engine",
  "core/monsters/creator/monsterCreatorModel.ts → creatureSaves",
  "core/monsters/lair.ts → legalLairOptions",
  "core/rules/healingResolution.ts → expectedHealingAtLevel",
  "core/rules/healingResolution.ts → healingMultiplierFromText",
  "core/ui/itemActivation.ts → sweepItemActivation",
  "modules/dnd-5e/srdAuditChassis.generated.ts → SRD_AUDIT_CR_ROWS",
  "modules/dnd-5e/srdLibrary.ts → SRD_ABSENT",
  "modules/dnd-5e/srdLibrary.ts → SRD_CORRECTED",
  "modules/dnd-5e/srdLibrary.ts → SRD_STILL_INCOMPLETE",
  "modules/dnd-5e/srdLibrary.ts → SRD_UNMATCHED",
];

/**
 * ⚠ 101 EXPORTS NOTHING RUNS — the debt this gate exists to stop growing.
 *
 * Measured, not chosen. Every line is an exported function or constant that no other production
 * file imports and that its own module never uses, so no code path in the app reaches it. Some are
 * genuinely load-bearing ideas that were never wired — `verifyCampaignProvenance` is the digest
 * check MASTER describes as what stops a local edit passing as authored content, and it is called
 * nowhere. Others are helpers a refactor left behind.
 *
 * They are pinned so the number cannot climb quietly. Wire one, or delete it, and remove its line —
 * a stale entry FAILS this gate, so the ledger cannot drift out of date either.
 */
const KNOWN_ORPHAN_EXPORTS: readonly string[] = [
  "core/campaign/actTags.ts → byCampaignOrder",
  "core/campaign/authorExport.ts → verifyCampaignProvenance",
  "core/campaign/authorMode.ts → verifyAuthorKey",
  "core/campaign/repairDuplicateResistance.ts → countDuplicateResistance",
  "core/constants/damageTypes.ts → describeDamageTypes",
  "core/constants/damageTypes.ts → firstDamageTypeIn",
  "core/constants/weaponMastery.ts → WEAPON_MASTERY_INDEX",
  "core/content/contentScope.ts → authoringRefusal",
  "core/content/contentScope.ts → byScope",
  "core/content/contentScope.ts → canSaveToPersonalLibrary",
  "core/content/contentScope.ts → canUseInEncounter",
  "core/currency/currency.ts → canAfford",
  "core/dice/localRoller.ts → localRollCrit",
  "core/encounter-band/checkerV2.ts → expectedAttackDamage",
  "core/encounter-band/checkerV2.ts → expectedSaveDamage",
  "core/encounter-band/checkerV2.ts → rechargeProbability",
  "core/encounter-band/checkerV2.ts → resolveStateTrigger",
  "core/encounter-band/compactImport.ts → effectFamily",
  "core/encounter-band/compactImport.ts → srdIdentify",
  "core/encounter-band/compactImport.ts → stackGroups",
  "core/encounter-band/coverageGate.ts → coverageSummary",
  "core/encounter-band/damageExpression.ts → DEFAULT_PARTY_DEFENCE",
  "core/encounter-band/partyCurveV2.ts → EMPIRICAL_LEVELS",
  "core/encounter-band/partyDefenceCurve.ts → saveBonusFor",
  "core/encounter-band/partyResourceCurve.ts → PUBLISHED_LEVELS",
  "core/encounter-band/pricingPrimitives.generated.ts → primitivesInChannel",
  "core/encounter-engine/contracts.ts → isOk",
  "core/events/encounterLog.ts → attributeEvent",
  "core/jcon/jconStorageBoundary.ts → FDMC_JCON_STORAGE_BOUNDARY",
  "core/jcon/jconStorageBoundary.ts → createPublicEquipmentSnapshot",
  "core/jcon/jconStorageBoundary.ts → getPrivateJconStorageSummary",
  "core/jcon/jconStorageBoundary.ts → getRoomJconStorageSummary",
  "core/monsters/MonsterJconScanner.tsx → MonsterJconScanner",
  "core/monsters/actionSetPicks.ts → availableInSet",
  "core/monsters/actionSetPicks.ts → emptyActionSetPicks",
  "core/monsters/actionSetPicks.ts → needsActionSetPicks",
  "core/monsters/actionSetPicks.ts → unfilledActionSlots",
  "core/monsters/dmMonsterLibrary.ts → clearStagedMonsters",
  "core/monsters/dmMonsterLibrary.ts → normalizedToTemplate",
  "core/monsters/dmMonsterLibrary.ts → stageMonster",
  "core/monsters/dmMonsterLibrary.ts → unstageMonster",
  "core/monsters/runtime/mainMonsterRuntime.ts → MIRAGE_STALKER_TEMPLATE",
  "core/monsters/runtime/mainMonsterRuntime.ts → makePlayerSafeMonsterLabel",
  "core/monsters/runtime/mainMonsterRuntime.ts → maxClassification",
  "core/monsters/runtime/mainMonsterRuntime.ts → rescaleMonsterHp",
  "core/rules/bondProgress.ts → assignBond",
  "core/rules/multiclass.ts → formatClassLevels",
  "core/seats/dmActorLibrary.ts → applyLevelUpApproval",
  "core/seats/playerActorCache.ts → clearCache",
  "core/seats/playerActorCache.ts → getCachedActor",
  "core/seats/seatColors.ts → MONSTER_COLOR_SOFT",
  "core/seats/seatColors.ts → findSeatForActor",
  "core/state/autoBackup.ts → loadWalletMirror",
  "core/state/convergenceInbox.ts → clearConvergenceInbox",
  "core/state/resolveFormulaVars.ts → formulaDisplayLabel",
  "core/state/resolveFormulaVars.ts → resolveActionFormula",
  "core/table-state/actorHydrationBoundary.ts → resolveActors",
  "core/table-state/fdmcRoomLiveState.ts → deregisterMonsterInstance",
  "core/table-state/fdmcRoomLiveState.ts → spendPartyCopper",
  "core/table-state/roomStateBridge.ts → FDMC_ROOM_STATE_VERSION",
  "core/table-state/roomStateBridge.ts → getFdmcRoomSyncDiagnostics",
  "core/table-state/roomStateBridge.ts → subscribeFdmcRoomSyncDiagnostics",
  "core/table-state/sharedTableBudget.ts → FDMC_SHARED_TABLE_SAFE_BYTES",
  "core/table-state/sharedTableState.ts → FDMC_SHARED_TABLE_STATE_KEY",
  "core/text/negatedMention.ts → isOnlyNegatedMention",
  "core/tokens/tokenBinding.ts → validateTokenBinding",
  "core/tokens/tokenContextMenu.ts → teardownTokenContextMenus",
  "core/types/actionEconomy.ts → ECONOMY_SLOTS",
  "core/types/actionEconomy.ts → isFreeCost",
  "core/types/spellSlots.ts → formatSpellLevel",
  "core/types/spellSlots.ts → makeSpellCastingData",
  "core/types/spellSlots.ts → spellSlotResourceKey",
  "core/ui/EquipmentBagEditor.tsx → bindableWeapons",
  "core/ui/EquipmentBagEditor.tsx → resolveBoundFocus",
  "core/ui/EquipmentLibraryStandalone.tsx → isConvergenceOffer",
  "core/ui/EquipmentLibraryStandalone.tsx → isLootChoice",
  "core/ui/EquipmentLibraryStandalone.tsx → isLootDelivery",
  "core/ui/EquipmentLibraryStandalone.tsx → isLootOffer",
  "core/ui/LevelUpRequestPanel.tsx → isLevelUpResponse",
  "core/ui/itemActivation.ts → readActivationFromText",
  "core/ui/pcActionAdapters.ts → appendActorActionToActor",
  "core/ui/pcActionTypes.ts → PC_ROLL_MODES",
  "core/ui/pcActionTypes.ts → makeBondPairActions",
  "core/ui/pcActionTypes.ts → splitPcActionsByTab",
  "core/ui/pcActionTypes.ts → validatePcActionDraft",
  "core/ui/tabVisuals.ts → tabEmptyHint",
  "core/utils/safeStorage.ts → storageGet",
  "core/utils/safeStorage.ts → storageMode",
  "core/utils/safeStorage.ts → storageRemove",
  "core/utils/safeStorage.ts → storageSet",
  "data/broken-chain/authored.generated.ts → AUTHORED_AT",
  "data/broken-chain/monsterLibrary.ts → VOIDED_FOR_CHANGES",
  "modules/dnd-5e/featPricing.generated.ts → FEAT_EXPRESSION_DICTIONARY",
  "modules/dnd-5e/srdAuditChassis.generated.ts → SRD_AUDIT_BY_NAME",
  "modules/dnd-5e/srdContent.ts → DND_MOD_PROVENANCE",
  "modules/dnd-5e/srdContent.ts → SRD_ATTRIBUTION",
  // Both licence strings are ledgered together: neither is displayed yet, which is a real
  // outstanding gap now that TWO CC-BY documents ship. Surfacing them is owed.
  "modules/dnd-5e/srdContent.ts → SRD_51_ATTRIBUTION",
  "modules/dnd-5e/srdContent.ts → isSrdRecord",
  "modules/dnd-5e/srdLibrary.ts → SRD_LIBRARY_BY_ID",
  "modules/dnd-5e/srdMonsters.generated.ts → SRD_BY_ID",
  "modules/dnd-5e/srdMonsters.generated.ts → SRD_NEEDS_INPUT",
  "modules/dnd-5e/statBlockGrammar.ts → describeDamage",
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

console.log(`\nEXPORTS — ${exportsChecked} value exports across the live modules`);
console.log(`  unreached by production: ${scriptOnlyExports.length} script-only, ${orphanExports.length} orphan`);
for (const s of scriptOnlyExports) console.log(`     ${s}${KNOWN_SCRIPT_ONLY_EXPORTS.includes(s) ? "" : "   ⚠ NEW"}`);
for (const o of orphanExports) console.log(`     ${o}   ⚠ ORPHAN EXPORT`);

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

const newScriptOnlyExports = scriptOnlyExports.filter(s => !KNOWN_SCRIPT_ONLY_EXPORTS.includes(s));
const staleScriptOnlyExports = KNOWN_SCRIPT_ONLY_EXPORTS.filter(k => !scriptOnlyExports.includes(k));
ok("no NEW export proven only by a gate", newScriptOnlyExports.length === 0, newScriptOnlyExports.join(", "));
ok("the export ledger has no stale entries", staleScriptOnlyExports.length === 0,
  staleScriptOnlyExports.length ? `now called — delete from the list: ${staleScriptOnlyExports.join(", ")}` : "");
/**
 * ⚠ AN ORPHAN EXPORT IS NEVER LEDGERED. A module can be wiring still to do; an exported function
 * that nothing imports — not even a gate — is unreachable and unproven at once, which is strictly
 * worse than either. Wire it, test it, or delete it.
 */
const newOrphanExports = orphanExports.filter(o => !KNOWN_ORPHAN_EXPORTS.includes(o));
const staleOrphanExports = KNOWN_ORPHAN_EXPORTS.filter(k => !orphanExports.includes(k));
ok("no NEW orphan export", newOrphanExports.length === 0, newOrphanExports.join(", "));
ok("the orphan-export ledger has no stale entries", staleOrphanExports.length === 0,
  staleOrphanExports.length ? `now reached — delete from the list: ${staleOrphanExports.join(", ")}` : "");

console.log(`\n${failures === 0 ? "PASS" : `FAIL — ${failures} check(s)`}`);
process.exit(failures === 0 ? 0 : 1);
