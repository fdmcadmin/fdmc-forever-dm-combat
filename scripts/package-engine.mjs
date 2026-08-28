/**
 * PACKAGE THE ENCOUNTER ENGINE — Gate 6.
 *
 * Christopher's decision, verbatim where it sets policy:
 *
 *   *"use GitHub Release assets as the authoritative storage for certified last-known-good Encounter
 *   Engine artifacts. `dist/engine/` is only temporary/generated build output, not an authority, and
 *   do not introduce npm packaging yet."*
 *
 *   *"Keep one editable engine implementation in source. The LKG is an immutable compiled release
 *   artifact, never a second editable source tree. Include a small version/hash manifest so the
 *   runtime and diagnostics can identify exactly which candidate and fallback were executed."*
 *
 * ── WHAT THIS DOES ──────────────────────────────────────────────────────────────────────────
 *   npm run engine:package    compile the engine from source, hash it, write dist/engine/ and
 *                             stamp src/.../fallbackManifest.ts with what is bundled
 *   npm run engine:certify    promote the packaged candidate to engine-lkg/, so the NEXT build
 *                             ships it as the recovery artifact
 *
 * ⚠ `dist/engine/` IS OUTPUT, NOT STORAGE. It is rebuilt on demand and safe to delete. The record of
 * a certified engine is the GitHub Release asset; `engine-lkg/` is a working copy bundled so the
 * running app never needs the network to recover.
 *
 * ⚠ AND CERTIFY IS A SEPARATE COMMAND ON PURPOSE. Packaging happens on every build; promotion is a
 * decision that should follow CI and a look at the diff. Making them one step would let an untested
 * candidate become the thing everything else falls back to.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "dist", "engine");
const LKG_DIR = path.join(ROOT, "engine-lkg");
const MANIFEST_TS = path.join(ROOT, "src", "core", "encounter-engine", "fallbackManifest.ts");

const certify = process.argv.includes("--certify");

const appVersion = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version;
const engineVersion = (fs.readFileSync(path.join(ROOT, "src", "core", "encounter-engine", "contracts.ts"), "utf8")
  .match(/ENGINE_VERSION\s*=\s*"([^"]+)"/) || [])[1] ?? "0.0.0";

/* ── 1. Compile the engine and everything it reaches. ───────────────────────────────────────── */

fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

console.log("compiling the engine…");
execSync(
  "npx tsc --ignoreConfig src/core/encounter-engine/capabilities.ts "
  + `--outDir "${OUT_DIR}" --module es2020 --target es2020 --moduleResolution bundler `
  + "--skipLibCheck --removeComments --resolveJsonModule",
  { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] },
);

/* ── 2. Hash what was emitted. ──────────────────────────────────────────────────────────────── */

/**
 * ⚠ THE HASH COVERS EVERY EMITTED FILE, in a stable order.
 *
 * Hashing only the entry point would produce the same digest for two engines whose mathematics
 * differed in a dependency — which is the exact case the hash exists to distinguish. Sorted, because
 * directory order is not guaranteed and a hash that changes without the code changing is noise.
 */
function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith(".js")) out.push(p);
  }
  return out;
}

const files = walk(OUT_DIR).sort();
const digest = crypto.createHash("sha256");
for (const f of files) {
  digest.update(path.relative(OUT_DIR, f).replace(/\\/g, "/"));
  digest.update(fs.readFileSync(f));
}
const hash = digest.digest("hex").slice(0, 12);

const capabilities = (fs.readFileSync(path.join(ROOT, "src", "core", "encounter-engine", "contracts.ts"), "utf8")
  .match(/ENGINE_CAPABILITIES = \[([\s\S]*?)\]/) || [, ""])[1]
  .split(",").map(s => s.trim().replace(/['"]/g, "")).filter(Boolean);

const artifact = { engineVersion, hash, builtAt: new Date().toISOString(), appVersion, capabilities };

fs.writeFileSync(path.join(OUT_DIR, "manifest.json"), JSON.stringify(artifact, null, 2));
console.log(`packaged  engine ${engineVersion} · ${hash} · ${files.length} modules · ${capabilities.length} capabilities`);

/* ── 3. Promote to the bundled LKG, on request. ─────────────────────────────────────────────── */

if (certify) {
  /**
   * ⚠ THE ARTIFACT IS RE-EXPORTED THROUGH ONE ENTRY, so the app imports a stable path no matter how
   * the engine's internal file layout changes between versions. The certified bytes are copied
   * verbatim; only this wrapper is written.
   */
  /**
   * ⚠ `index.d.ts` IS SOURCE AND SURVIVES. It is the hand-written CONTRACT the artifact must
   * satisfy, so wiping the folder wholesale removed the one file certification must not touch —
   * and the build then failed with a missing declaration rather than a bad artifact.
   */
  const decl = path.join(LKG_DIR, "index.d.ts");
  const keptDecl = fs.existsSync(decl) ? fs.readFileSync(decl, "utf8") : null;
  fs.rmSync(LKG_DIR, { recursive: true, force: true });
  fs.mkdirSync(path.join(LKG_DIR, "engine"), { recursive: true });
  if (keptDecl) fs.writeFileSync(decl, keptDecl);
  for (const f of files) {
    const rel = path.relative(OUT_DIR, f);
    const dest = path.join(LKG_DIR, "engine", rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(f, dest);
  }
  fs.writeFileSync(path.join(LKG_DIR, "manifest.json"), JSON.stringify(artifact, null, 2));

  /**
   * ⚠ RELATIVE TO THE COPIED TREE, NOT TO dist/. Computing it against OUT_DIR produced
   * "./engine/../../dist/engine/..." — an import that reaches back into build output the artifact
   * exists precisely so it does not need. The certified copy must be self-contained.
   */
  /**
   * ⚠ FOUND, NOT ASSUMED. tsc roots the emit at the common ancestor of what it compiled, so the
   * layout here is "encounter-engine/index.js" — and would gain a "core/" segment the moment a
   * capability pulled in a sibling of `core`. The hardcoded path produced an import to a file
   * that did not exist, and nothing noticed until recovery was actually attempted, which is the
   * one moment a broken artifact must not be discovered.
   */
  const entryAbs = files.find(f => f.replace(/\\/g, "/").endsWith("/encounter-engine/capabilities.js"));
  if (!entryAbs) throw new Error("engine entry point not found in the emitted output");
  const entry = path.relative(OUT_DIR, entryAbs).replace(/\\/g, "/");
  fs.writeFileSync(path.join(LKG_DIR, "index.js"), `/**
 * CERTIFIED LAST-KNOWN-GOOD ENGINE — generated by \`npm run engine:certify\`.
 *
 * ⚠ AN ARTIFACT, NOT SOURCE. Overwritten wholesale on the next certification. Editing it by hand
 * creates the second editable authority the portability spec forbids, and the hash in
 * \`manifest.json\` would stop describing what is here.
 *
 * engine ${artifact.engineVersion} · ${artifact.hash} · built ${artifact.builtAt}
 */
import * as capabilities from "./engine/${entry}";

export const CAPABILITIES = capabilities;
export const ARTIFACT = ${JSON.stringify(artifact, null, 2)};
`);
  console.log(`certified engine ${engineVersion} · ${hash} -> engine-lkg/`);
  console.log("⚠ upload dist/engine/ to the GitHub Release — that asset is the record, not this copy.");
}

/* ── 4. Stamp the manifest the running app reads. ───────────────────────────────────────────── */

const lkgManifest = fs.existsSync(path.join(LKG_DIR, "manifest.json"))
  ? JSON.parse(fs.readFileSync(path.join(LKG_DIR, "manifest.json"), "utf8"))
  : null;

let ts = fs.readFileSync(MANIFEST_TS, "utf8");
const start = ts.indexOf("export const ENGINE_MANIFEST: EngineManifest = {");
const end = ts.indexOf("\n};", start) + 3;
if (start < 0) throw new Error("ENGINE_MANIFEST not found in fallbackManifest.ts");
ts = ts.slice(0, start)
  + `export const ENGINE_MANIFEST: EngineManifest = {\n`
  + `  candidate: ${JSON.stringify(artifact, null, 2).replace(/\n/g, "\n  ")},\n`
  + `  lkg: ${lkgManifest ? JSON.stringify(lkgManifest, null, 2).replace(/\n/g, "\n  ") : "null"},\n`
  + `  authority: "github-release",\n};`
  + ts.slice(end);
fs.writeFileSync(MANIFEST_TS, ts);
console.log(`manifest  candidate ${hash} · lkg ${lkgManifest ? lkgManifest.hash : "none"}`);
