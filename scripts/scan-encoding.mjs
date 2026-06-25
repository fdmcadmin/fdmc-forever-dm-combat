#!/usr/bin/env node
/**
 * scan-encoding - fails the build if any source file contains UTF-8 mojibake
 * (double-encoded text, e.g. a multiplication sign stored as a two-character
 * "C3 lead" sequence instead of the real glyph).
 *
 * Wired as the npm `prebuild` step, so every `npm run build` - and therefore every
 * patch that gets pushed - is gated on a clean scan. Every match pattern is built
 * from \u escapes (this file is pure ASCII) so it never trips its own check.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, extname } from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["src", "scripts"];
const SCAN_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".css", ".html"]);
const SKIP_DIRS = new Set(["node_modules", "dist", ".git"]);

// High-confidence mojibake lead sequences (UTF-8 decoded as cp1252 / Latin-1):
//   C3 + accent/punct  -> most accented chars + the x / division signs
//   E2 80              -> en/em dashes and curly quotes
//   E2 88              -> math minus / operators
//   F0 9F              -> mangled astral emoji
//   C2 + control/punct -> NBSP / degree / copyright family
const MOJIBAKE = new RegExp(
  "\\u00C3[\\u0080-\\u00FF\\u0152\\u0153\\u0178\\u2013\\u2014\\u2019\\u201C\\u201D]" +
  "|\\u00E2\\u20AC" +
  "|\\u00E2\\u02C6" +
  "|\\u00F0\\u0178" +
  "|\\u00C2[\\u0080-\\u00BF\\u2013\\u2014]",
);

const hits = [];
let scanned = 0;

function scanFile(file) {
  let text;
  try { text = readFileSync(file, "utf8"); } catch { return; }
  scanned++;
  text.split(/\r?\n/).forEach((line, i) => {
    if (MOJIBAKE.test(line)) hits.push({ file, line: i + 1, text: line.trim().slice(0, 120) });
  });
}

function walk(dir) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(p); }
    else if (SCAN_EXTS.has(extname(e.name))) scanFile(p);
  }
}

// Root-level HTML entry points + the scanned source dirs.
for (const f of readdirSync(ROOT)) {
  if (extname(f) === ".html") scanFile(join(ROOT, f));
}
for (const d of SCAN_DIRS) walk(join(ROOT, d));

if (hits.length) {
  console.error(`\n[scan-encoding] FAILED - ${hits.length} mojibake / encoding artifact(s):\n`);
  for (const h of hits) console.error(`  ${h.file}:${h.line}  ${h.text}`);
  console.error(`\nThese are double-encoded UTF-8 characters. Fix them before building/pushing.\n`);
  process.exit(1);
}
console.log(`[scan-encoding] clean - no mojibake in ${scanned} files.`);
