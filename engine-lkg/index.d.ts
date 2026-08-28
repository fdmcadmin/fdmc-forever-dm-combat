/**
 * Types for the bundled LKG artifact.
 *
 * ⚠ HAND-WRITTEN AND STABLE, unlike `index.js` which is overwritten by `engine:certify`. The shape
 * is the CONTRACT the artifact must satisfy; keeping it here means a certified artifact that does
 * not match is a compile error rather than a runtime surprise during recovery.
 */

/** The certified engine's implementations, or null when nothing is certified yet. */
export declare const CAPABILITIES: Record<string, unknown> | null;

/** Mirrors `manifest.json` — version, hash, build time. Null while nothing is certified. */
export declare const ARTIFACT: {
  engineVersion: string;
  hash: string;
  builtAt: string;
  appVersion: string;
  capabilities: string[];
} | null;
