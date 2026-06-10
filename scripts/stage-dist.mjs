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
 *
 * MIRROR FILE-BY-FILE (robocopy /MIR) — DO NOT rmdir the target root. The old approach
 * (rmSync(target, {recursive:true}) + cpSync) threw EBUSY ("resource busy or locked,
 * rmdir") whenever active-sync-lab\dist was locked — open in Explorer, an AV scan, or a
 * held file handle — and the catch below swallowed it, leaving the active deploy dist
 * SILENTLY STALE while the build reported success (bit the 2026-06-09 icon build).
 * robocopy /MIR copies each file individually and tolerates locks (with bounded
 * retries), matching push.bat so the two staging paths can't diverge.
 */
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

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
  } else if (process.platform !== "win32") {
    // active-sync-lab is a Windows-only local staging dir; robocopy is Windows-only.
    console.log("[stage-dist] active-sync-lab present but not on Windows — skipping (robocopy mirror is Windows-only).");
  } else {
    // /MIR mirrors file-by-file (and never rmdir's the target root, so a folder held
    // open in Explorer can't abort the mirror). /R:2 /W:1 bounds retries so a genuinely
    // locked file can't hang the build. /NFL /NDL /NJH /NJS /NP keep output quiet —
    // same flags push.bat uses. robocopy exit codes: <8 = success/info, >=8 = failure.
    const r = spawnSync(
      "robocopy",
      [distDir, target, "/MIR", "/R:2", "/W:1", "/NFL", "/NDL", "/NJH", "/NJS", "/NP"],
      { stdio: "ignore", windowsHide: true }
    );
    const code = r.error ? 16 : (r.status ?? 16);
    if (code >= 8) {
      console.log(
        `[stage-dist] WARNING: robocopy mirror reported errors (exit ${code}). ` +
        `active-sync-lab\\dist may be STALE — close anything holding it open ` +
        `(Explorer / AV scan), then re-run the build or stage manually.`
      );
    } else {
      console.log(`[stage-dist] staged dist -> ${target}`);
    }
  }
} catch (err) {
  console.log("[stage-dist] skipped (non-fatal):", err?.message ?? err);
}

process.exit(0);
