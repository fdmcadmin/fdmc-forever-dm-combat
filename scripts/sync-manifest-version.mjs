/**
 * Keep public/manifest.json's version in step with package.json.
 *
 * OBR reads the MANIFEST for an extension's version, and uses it to decide whether anything
 * needs re-fetching. The manifest version was hardcoded, so it sat at 0.7.2.12 while
 * package.json climbed through a whole session of fixes: every build produced new code, every
 * deploy shipped it, and OBR kept serving the cached bundle because as far as it could tell
 * nothing had changed. The symptom is the worst kind — work that is genuinely committed,
 * genuinely built, genuinely deployed, and genuinely not running.
 *
 * Runs on prebuild so it cannot be forgotten. Writes only when the value differs, so it does
 * not churn the file or the diff.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const pkgPath = resolve(root, "package.json");
const manifestPath = resolve(root, "public/manifest.json");

const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const raw = readFileSync(manifestPath, "utf8");
const manifest = JSON.parse(raw);

if (manifest.version === pkg.version) {
  console.log(`[manifest-version] already ${pkg.version}`);
} else {
  const before = manifest.version;
  manifest.version = pkg.version;
  // Match the file's existing shape: 2-space indent, trailing newline. Rewriting the whole
  // file is safe here because it is small, flat, and machine-owned.
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`[manifest-version] ${before} -> ${pkg.version}`);
}
