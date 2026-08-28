/**
 * SAFE EXECUTION + CAPABILITY REGISTRY — Gates 3 and 4 of the portability spec.
 *
 * *"If one active engine capability throws, returns invalid output, or violates its runtime
 * contract, quarantine only that capability and immediately execute its last-known-good
 * implementation. The rest of the application continues using the newest working code."*
 *
 * ── ⚠ FALLBACK IS PER CAPABILITY, NEVER PER APPLICATION ─────────────────────────────────────
 * Spec §5.2. A broken `auditCoverage` must not roll `checkEncounter` back to an older version, and
 * it must not take the combat tracker, the library or the equipment system with it. Each capability
 * has its own state, and a quarantine on one says nothing about the others.
 *
 * ── ⚠ FAIL CLOSED, NEVER GUESS ──────────────────────────────────────────────────────────────
 * Spec §9. When there is no recovery implementation — which is the case on a fresh install, because
 * a last-known-good artifact only exists after a release has been promoted — the capability returns
 * a FAILURE. It does not return zero, an empty object, or the input echoed back. Christopher's rule
 * for the pricing contract is the same rule: *"never silently price it as zero."*
 *
 * A caller that receives a failure must show it. That is the whole point: the alternative is a
 * number nobody can tell apart from a real one.
 *
 * ── ⚠ AND NO `-old.ts` FILES ────────────────────────────────────────────────────────────────
 * Spec §5.1 is explicit that `creatureEstimator-old.ts` and friends must never exist: *"That would
 * create multiple editable authorities and violate the architecture. LKG code belongs in immutable
 * build/release artifacts."* So the registry holds a SLOT, and a release artifact fills it. Nothing
 * here creates a second editable copy of the mathematics, and this file deliberately ships with
 * every fallback slot empty rather than with a hand-written stand-in.
 */

import {
  type EngineCapability,
  type EngineOutcome,
  ENGINE_CAPABILITIES,
} from "./contracts";
import { validateOutput, type ContractViolation } from "./runtimeValidation";

export type CapabilityState = {
  /** Quarantined: the active implementation has failed and is no longer called. */
  quarantined: boolean;
  /** Consecutive failures. The breaker trips at `BREAKER_THRESHOLD`. */
  failures: number;
  /** What went wrong most recently, for the DM-only diagnostics panel. */
  lastFailure: string | null;
  /** Whether a recovery implementation is registered at all. */
  hasFallback: boolean;
};

/**
 * ⚠ ONE FAILURE IS NOT A FAULT; A PATTERN IS. Spec §11 asks for a circuit breaker rather than an
 * instant trip, because a single bad input can throw without the implementation being broken. Three
 * consecutive failures on the same capability is a fault in the code, not in one roster.
 */
const BREAKER_THRESHOLD = 3;

type Impl = (...args: never[]) => unknown;

const active = new Map<EngineCapability, Impl>();
const fallback = new Map<EngineCapability, Impl>();
const state = new Map<EngineCapability, CapabilityState>();

for (const c of ENGINE_CAPABILITIES) {
  state.set(c, { quarantined: false, failures: 0, lastFailure: null, hasFallback: false });
}

/** Register the current implementation of a capability. Called once, at module load. */
export function registerActive(capability: EngineCapability, impl: Impl): void {
  active.set(capability, impl);
}

/**
 * Register a recovery implementation, loaded from a release artifact.
 *
 * ⚠ NOT CALLED ANYWHERE IN THIS REPOSITORY, and that is correct. The artifact format is Gate 6;
 * until it exists there is nothing legitimate to register, and inventing one here would create the
 * second editable authority §5.1 forbids.
 */
export function registerFallback(capability: EngineCapability, impl: Impl): void {
  fallback.set(capability, impl);
  const s = state.get(capability);
  if (s) s.hasFallback = true;
}

export function capabilityState(capability: EngineCapability): CapabilityState {
  return { ...(state.get(capability) as CapabilityState) };
}

export function engineDiagnostics(): Record<EngineCapability, CapabilityState> {
  const out = {} as Record<EngineCapability, CapabilityState>;
  for (const c of ENGINE_CAPABILITIES) out[c] = capabilityState(c);
  return out;
}

/** Clear a quarantine — for the DM-only panel, and for fault-injection tests. */
export function resetCapability(capability: EngineCapability): void {
  state.set(capability, { quarantined: false, failures: 0, lastFailure: null,
    hasFallback: fallback.has(capability) });
}

function describe(violations: ContractViolation[]): string {
  return violations.map(v => `${v.field}: ${v.problem}`).join("; ");
}

/**
 * Run a capability, validate what it returns, and quarantine it if it misbehaves.
 *
 * The order matters and is the spec's: run, VALIDATE, then decide. An implementation that returns
 * `NaN` without throwing is exactly the failure mode this exists for — it is the one a try/catch
 * alone would miss, and the one that reaches a DM looking like an answer.
 */
export function safeExecute<T>(capability: EngineCapability, ...args: unknown[]): EngineOutcome<T> {
  const s = state.get(capability) as CapabilityState;

  const attempt = (impl: Impl | undefined, from: "active" | "fallback"): EngineOutcome<T> | null => {
    if (!impl) return null;
    let raw: unknown;
    try {
      raw = (impl as (...a: unknown[]) => unknown)(...args);
    } catch (err) {
      s.failures++;
      s.lastFailure = `${from} threw: ${err instanceof Error ? err.message : String(err)}`;
      return { ok: false, capability, reason: "THREW", detail: s.lastFailure, from };
    }
    const violations = validateOutput(capability, raw);
    if (violations.length) {
      s.failures++;
      s.lastFailure = `${from} violated its contract — ${describe(violations)}`;
      return { ok: false, capability, reason: "CONTRACT_VIOLATION", detail: s.lastFailure, from };
    }
    // A clean run clears the breaker: the fault was in the input, not the implementation.
    if (from === "active") { s.failures = 0; s.lastFailure = null; }
    return { ok: true, value: raw as T, from };
  };

  if (!s.quarantined) {
    const first = attempt(active.get(capability), "active");
    if (first && first.ok) return first;
    if (first && s.failures >= BREAKER_THRESHOLD) s.quarantined = true;
    if (first && !fallback.has(capability)) return first;   // fail closed — no recovery available
  }

  const recovered = attempt(fallback.get(capability), "fallback");
  if (recovered) return recovered;

  return {
    ok: false,
    capability,
    reason: "NEEDS_INPUT",
    detail: s.quarantined
      ? `${capability} is quarantined and no last-known-good implementation is registered.`
      : `${capability} has no registered implementation.`,
    from: "none",
  };
}
