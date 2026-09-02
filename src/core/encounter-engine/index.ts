/**
 * FDMC ENCOUNTER ENGINE — the one surface an adapter is allowed to know.
 *
 * Portability spec §3: *"Platform adapters are thin shells. They may transform platform data into
 * the engine input contract and transform engine output for display. They may not redefine
 * encounter mathematics."*
 *
 * ⚠ THIS WRAPS; IT DOES NOT REIMPLEMENT. Every capability below calls the existing
 * `encounter-band` function unchanged. Spec §2: *"If an existing system can be wired into this
 * architecture, wire it. Do not create a second estimator, second checker, second workbook
 * interpretation, or second source of encounter truth."* The mathematics is already verified against
 * the workbook to the last digit; re-typing it here would put that verification at risk for nothing.
 *
 * ── TWO WAYS IN, ON PURPOSE ─────────────────────────────────────────────────────────────────
 *   engine.*        guarded. Validates output, quarantines a failing capability, fails closed.
 *   engineDirect.*  the raw function, unwrapped.
 *
 * The app's own panels use the direct form today, because changing thirty call sites to handle an
 * outcome type is a refactor with its own risk and no behaviour to show for it — spec Gate 1:
 * *"change callers only as required; no mathematical behavior change."*
 *
 * ⚠ AN ADAPTER MUST USE THE GUARDED FORM. It is running the engine on a platform this repository
 * cannot test, against data this repository has never seen. That is exactly the situation the
 * contract validation and the capability breaker exist for.
 */

import { estimateCreature as estimateCreatureImpl } from "../encounter-band/creatureEstimator";
import {
  resolvePartyProfile as resolvePartyProfileImpl,
  simulateEncounter as simulateEncounterImpl,
} from "../encounter-band/checkerV2";
import { auditCoverage as auditCoverageImpl } from "../encounter-band/coverageGate";

import {
  ENGINE_VERSION,
  ENGINE_CAPABILITIES,
  type EngineCapability,
  type EngineOutcome,
  type EstimatorInput,
  type EstimatorResult,
  type EncounterResult,
  type CoverageReport,
  type MechanicSource,
  type PartyProfile,
} from "./contracts";
import { registerActive, safeExecute, engineDiagnostics, resetCapability } from "./safeExecute";
import { registerBundledFallback } from "./loadFallback";
import { ENGINE_MANIFEST, engineProvenance } from "./fallbackManifest";

/* ── Registration. One place, at load, so the registry can never disagree with the exports. ── */
registerActive("estimateCreature", estimateCreatureImpl as never);
registerActive("resolvePartyProfile", resolvePartyProfileImpl as never);
registerActive("checkEncounter", simulateEncounterImpl as never);
registerActive("auditCoverage", auditCoverageImpl as never);

/**
 * ⚠ THE BUNDLED RECOVERY ARTIFACT, REGISTERED AT LOAD.
 *
 * Christopher: *"The adapter/runtime registry loads the candidate first and switches to the
 * bundled LKG artifact only when the candidate throws, fails its result/schema/invariant
 * validation, or otherwise meets the defined runtime-failure condition."* This is the line that
 * puts the LKG within reach; `safeExecute` decides when to use it.
 *
 * Registers nothing before the first certification, and that is correct — the capability then
 * fails closed rather than recovering into a stand-in.
 */
export const FALLBACK_REGISTRATION = registerBundledFallback();

/* ── The raw surface. Same functions, named as capabilities. ────────────────────────────────── */
export const engineDirect = {
  estimateCreature: estimateCreatureImpl,
  resolvePartyProfile: resolvePartyProfileImpl,
  checkEncounter: simulateEncounterImpl,
  auditCoverage: auditCoverageImpl,
} as const;

/* ── The guarded surface. ───────────────────────────────────────────────────────────────────── */
export const engine = {
  estimateCreature(input: EstimatorInput): EngineOutcome<EstimatorResult> {
    return safeExecute<EstimatorResult>("estimateCreature", input);
  },
  resolvePartyProfile(opts: Parameters<typeof resolvePartyProfileImpl>[0]): EngineOutcome<PartyProfile> {
    return safeExecute<PartyProfile>("resolvePartyProfile", opts);
  },
  checkEncounter(opts: Parameters<typeof simulateEncounterImpl>[0]): EngineOutcome<EncounterResult> {
    return safeExecute<EncounterResult>("checkEncounter", opts);
  },
  auditCoverage(sources: MechanicSource[]): EngineOutcome<CoverageReport> {
    return safeExecute<CoverageReport>("auditCoverage", sources);
  },
} as const;

export { ENGINE_VERSION, ENGINE_CAPABILITIES, engineDiagnostics, resetCapability };
export { ENGINE_MANIFEST, engineProvenance };
export type { EngineCapability, EngineOutcome };
export * from "./contracts";
