/**
 * THE ENGINE'S MATHEMATICS — and nothing else.
 *
 * ⚠ THIS IS THE ARTIFACT ENTRY POINT, and it exists because packaging `index.ts` produced a
 * CIRCULAR ARTIFACT. `index.ts` pulls in `loadFallback`, which imports `engine-lkg/index.js` — so a
 * certified artifact built from it contained its own fallback loader, and loading the artifact
 * re-entered the artifact:
 *
 *     ReferenceError: Cannot access 'ARTIFACT' before initialization
 *
 * The failure only appeared when recovery was attempted, which is the one moment a broken recovery
 * path must not be discovered.
 *
 * ── THE RULE THAT FALLS OUT OF IT ───────────────────────────────────────────────────────────
 * A last-known-good artifact is the MATHEMATICS, not the plumbing. The registry, the circuit
 * breaker and the fallback loader are how the app CHOOSES an implementation; they must never be
 * inside one of the implementations being chosen. So the artifact is packaged from here — five
 * functions, no registry, no manifest, no fallback — and `index.ts` wires them up on top.
 *
 * ⚠ ONE EDITABLE IMPLEMENTATION STILL. These are re-exports of the same `encounter-band` functions
 * `index.ts` uses. Nothing here is a copy, so the artifact and the candidate cannot drift into
 * disagreeing about the mathematics — only about which VERSION of it is running.
 */

export { estimateCreature } from "../encounter-band/creatureEstimator";
export { resolvePartyProfile, simulateEncounter as checkEncounter } from "../encounter-band/checkerV2";
export { auditCoverage } from "../encounter-band/coverageGate";
