/**
 * stage-dist.mjs — post-build hook.
 *
 * Mirrors the freshly-built `dist/` into `<workspace>/active-sync-lab/dist` so the
 * Release Captain / push.bat can deploy instantly from one fixed location, no matter
 * which candidate is active.
 *
 * LOCAL-ONLY BY DESIGN: `active-sync-lab/` lives OUTSIDE the git repo, so it is never
 * present in a CI / Cloudflare Pages checkout. If it isn't found (or anything goes
 * wrong), this no-ops and exits 0 — it must NEVER break the production build that
 * Cloudflare runs from the pushed source.
 */
import { existsSync, rmSync, cpSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

try {
  const scriptsDir = dirname(fileURLToPath(import.meta.url));            // .../source/scripts
  const distDir = resolve(scriptsDir, "..", "dist");                    // .../source/dist
  // scripts -> source -> <candidate> -> candidates -> fdmc-sunday-sync-lab -> active-sync-lab
  const activeLab = resolve(scriptsDir, "..", "..", "..", "..", "active-sync-lab");
  const target = resolve(activeLab, "dist");

  if (!existsSync(activeLab)) {
    console.log("[stage-dist] active-sync-lab not found — skipping (CI / Cloudflare build).");
  } else if (!existsSync(distDir)) {
    console.log("[stage-dist] dist/ not found — nothing to stage.");
  } else {
    rmSync(target, { recursive: true, force: true });
    cpSync(distDir, target, { recursive: true });
    console.log(`[stage-dist] staged dist -> ${target}`);
  }
} catch (err) {
  console.log("[stage-dist] skipped (non-fatal):", err?.message ?? err);
}

process.exit(0);
