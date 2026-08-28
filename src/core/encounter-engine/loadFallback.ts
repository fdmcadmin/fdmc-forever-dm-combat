/**
 * REGISTER THE BUNDLED LKG — the one place the recovery artifact enters the running app.
 *
 * Christopher's Gate 6 decision: *"The adapter/runtime registry loads the candidate first and
 * switches to the bundled LKG artifact only when the candidate throws, fails its result/schema/
 * invariant validation, or otherwise meets the defined runtime-failure condition. Do not depend on
 * downloading the LKG from GitHub during live execution."*
 *
 * ⚠ A STATIC IMPORT, DELIBERATELY. A dynamic one would defer the failure to the moment of recovery —
 * exactly when the app is already in trouble — and would let a missing artifact go unnoticed until
 * it was needed. Importing at load means a broken bundle fails the build, not the session.
 *
 * ⚠ AND THE ARTIFACT IS ALLOWED TO BE EMPTY. Before the first certification `CAPABILITIES` is null,
 * nothing registers, and `safeExecute` fails closed. That is the honest state; filling the slot with
 * a copy of current source would produce a fallback that recovers from a bug into the same bug.
 */

import { CAPABILITIES, ARTIFACT } from "../../../engine-lkg/index.js";
import { ENGINE_CAPABILITIES, type EngineCapability } from "./contracts";
import { registerFallback } from "./safeExecute";

export type FallbackRegistration = {
  registered: EngineCapability[];
  /** Named so a mismatch between artifact and contract is visible rather than silent. */
  missing: EngineCapability[];
  artifact: unknown;
};

/**
 * Register whatever the bundled artifact provides.
 *
 * ⚠ PER CAPABILITY, NOT ALL-OR-NOTHING. An older artifact may predate a capability that has since
 * been added; the ones it does carry are still worth having, and the ones it does not are reported
 * rather than quietly absent.
 */
export function registerBundledFallback(): FallbackRegistration {
  const out: FallbackRegistration = { registered: [], missing: [], artifact: ARTIFACT };
  const caps = CAPABILITIES as Record<string, unknown> | null;
  if (!caps) {
    out.missing = [...ENGINE_CAPABILITIES];
    return out;
  }
  for (const c of ENGINE_CAPABILITIES) {
    const impl = caps[c];
    if (typeof impl === "function") {
      registerFallback(c, impl as never);
      out.registered.push(c);
    } else {
      out.missing.push(c);
    }
  }
  return out;
}
