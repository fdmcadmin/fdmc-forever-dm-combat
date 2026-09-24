/**
 * THE ENGINE MANIFEST — which candidate and which fallback are actually running.
 *
 * Gate 6, as Christopher decided it:
 *
 *   *"use GitHub Release assets as the authoritative storage for certified last-known-good Encounter
 *   Engine artifacts. `dist/engine/` is only temporary/generated build output, not an authority, and
 *   do not introduce npm packaging yet."*
 *
 *   *"At release/build time, package the current candidate engine and the previous certified LKG
 *   engine locally with the adapter. [...] Do not depend on downloading the LKG from GitHub during
 *   live execution."*
 *
 * ⚠ SO THE LKG IS BUNDLED, NOT FETCHED. A recovery path that needs the network is not a recovery
 * path: the moment it is wanted is the moment least likely to have a working fetch, and an OBR
 * extension running inside someone else's frame may have no route to a release asset at all. The
 * artifact ships beside the candidate and is loaded from disk.
 *
 * ⚠ AND THE HASH IS THE POINT, not decoration. *"Include a small version/hash manifest so the
 * runtime and diagnostics can identify exactly which candidate and fallback were executed."* When a
 * DM reports a wrong number, "0.8.6.0" is not an answer — two builds can carry that version with
 * different engine code. The hash says exactly which bytes ran.
 */

/** One packaged engine: what it is, and what it was built from. */
export type EngineArtifact = {
  /** The engine's own version, from `contracts.ts` — not the app's. */
  engineVersion: string;
  /** sha256 over the emitted engine sources, truncated for display. */
  hash: string;
  /** ISO timestamp of the packaging run. */
  builtAt: string;
  /** The app version that produced it, for tracing a report back to a release. */
  appVersion: string;
  /** Capability names the artifact actually exports. */
  capabilities: string[];
};

export type EngineManifest = {
  /** The engine compiled from current source. Always present. */
  candidate: EngineArtifact;
  /**
   * The previously certified engine, bundled alongside.
   *
   * ⚠ NULL IS A LEGITIMATE STATE, not a failure. Before the first certification there is nothing to
   * fall back to, and the honest behaviour then is to FAIL CLOSED rather than pretend. See
   * `safeExecute` — a capability with no recovery returns a failure, never a zero.
   */
  lkg: EngineArtifact | null;
  /** Where a certified artifact is published. Storage of record; never read at runtime. */
  authority: "github-release";
};

/**
 * ⚠ REPLACED AT PACKAGE TIME by `scripts/package-engine.mjs`. The values below are what a source
 * checkout reports before anything has been packaged — deliberately marked, so an unpackaged build
 * cannot be mistaken for a certified one.
 */
export const ENGINE_MANIFEST: EngineManifest = {
  candidate: {
    "engineVersion": "1.0.0",
    "hash": "26202a48f47d",
    "builtAt": "2026-09-24T00:12:37.718Z",
    "appVersion": "0.8.75.5",
    "capabilities": [
      "estimateCreature",
      "resolvePartyProfile",
      "checkEncounter",
      "auditCoverage"
    ]
  },
  lkg: {
    "engineVersion": "1.0.0",
    "hash": "dcfc23d3c99d",
    "builtAt": "2026-08-28T17:15:37.189Z",
    "appVersion": "0.8.6.0",
    "capabilities": [
      "estimateCreature",
      "resolvePartyProfile",
      "checkEncounter",
      "aggregateAudit",
      "auditCoverage"
    ]
  },
  authority: "github-release",
};

/** One line for a diagnostics panel or a bug report. */
export function engineProvenance(): string {
  const c = ENGINE_MANIFEST.candidate;
  const l = ENGINE_MANIFEST.lkg;
  return `engine ${c.engineVersion} (${c.hash})`
    + (l ? ` · LKG ${l.engineVersion} (${l.hash})` : " · no certified LKG bundled");
}
