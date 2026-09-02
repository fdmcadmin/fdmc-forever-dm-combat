/**
 * FDMC ENCOUNTER ENGINE — the public contract.
 *
 * Portability spec §4: *"Create a small public API around the existing encounter-band functions
 * without rewriting their mathematics."* and §2: *"If an existing system can be wired into this
 * architecture, wire it. Do not create a second estimator, second checker, second workbook
 * interpretation, or second source of encounter truth."*
 *
 * ⚠ EVERY TYPE HERE IS RE-EXPORTED, NOT REDECLARED. The spec is explicit — *"Use the repository's
 * real types where they already exist. Do not duplicate type definitions just to satisfy this
 * sketch."* A parallel type is a second source of truth wearing a different hat: it compiles, it
 * drifts, and the drift is invisible until an adapter reads a field the engine stopped writing.
 *
 * ── WHAT THE BOUNDARY IS FOR ────────────────────────────────────────────────────────────────
 * The mathematics already exists and is verified against the workbook to the last digit. What did
 * not exist was a NAMED SURFACE: adapters reached into `encounter-band/*` file by file, so every
 * one of them depended on the layout of the implementation rather than on a promise about it.
 *
 * The engine ships to Owlbear, Foundry, Roll20 and Fantasy Grounds. Those adapters are thin — spec
 * §3: *"Platform adapters are thin shells. They may transform platform data into the engine input
 * contract and transform engine output for display. They may not redefine encounter mathematics."*
 * This file is what they are allowed to know.
 */

export type {
  EstimatorInput,
  EstimatorResult,
} from "../encounter-band/creatureEstimator";

export type {
  PartyCurveRow,
  PartyCurveMode,
  PartyEquipmentMode,
} from "../encounter-band/partyCurveV2";

export type {
  EncounterResult,
  RosterGroup,
  SimulationRound,
  PartyProfile,
  DamageAllocation,
} from "../encounter-band/checkerV2";

export type {
  CoverageReport,
  MechanicSource,
  BasePacket,
  CoverageHit,
  CoverageBlock,
} from "../encounter-band/coverageGate";

/**
 * The engine's own version, independent of the app's.
 *
 * ⚠ THIS IS THE NUMBER AN ADAPTER PINS TO, not `package.json`. The app ships far more often than
 * the encounter mathematics changes, and an adapter that had to re-verify parity on every UI patch
 * would stop re-verifying at all. Bump this only when a capability's INPUT OR OUTPUT changes, or
 * when a number it produces moves.
 */
export const ENGINE_VERSION = "1.0.0" as const;

/** Every capability the engine exposes. The registry and the fallback manifest key off these. */
export const ENGINE_CAPABILITIES = [
  "estimateCreature",
  "resolvePartyProfile",
  "checkEncounter",
  "auditCoverage",
] as const;

export type EngineCapability = typeof ENGINE_CAPABILITIES[number];

/**
 * What a capability returns when it cannot answer.
 *
 * ⚠ NEVER A ZERO, NEVER A GUESS. Christopher, on the pricing contract: *"Return NEEDS_INPUT when
 * required information is unavailable — never silently price it as zero."* The same rule governs
 * the engine boundary, because a zero that reaches an adapter is indistinguishable from a real
 * answer once it has been rendered.
 */
export type EngineFailure = {
  ok: false;
  capability: EngineCapability;
  reason: "NEEDS_INPUT" | "CONTRACT_VIOLATION" | "THREW";
  detail: string;
  /** Which implementation produced this — `active`, or the recovery artifact. */
  from: "active" | "fallback" | "none";
};

export type EngineOk<T> = { ok: true; value: T; from: "active" | "fallback" };

export type EngineOutcome<T> = EngineOk<T> | EngineFailure;

export function isOk<T>(o: EngineOutcome<T>): o is EngineOk<T> {
  return o.ok;
}
