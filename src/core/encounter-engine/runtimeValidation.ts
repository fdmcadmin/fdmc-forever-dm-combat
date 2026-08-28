/**
 * RUNTIME CONTRACT VALIDATION — Gate 2 of the portability spec.
 *
 * *"Define finite/required/invariant checks for each public capability; validate outputs without
 * changing valid results."*
 *
 * ⚠ THIS NEVER CHANGES A VALID ANSWER. It inspects and reports. A validator that "corrects" its
 * input is a second implementation of the mathematics, which is the one thing the whole
 * architecture forbids — and it would hide the very fault it exists to catch.
 *
 * ── WHAT COUNTS AS A VIOLATION ──────────────────────────────────────────────────────────────
 * Spec §8 lists the runtime failures worth quarantining a capability for. The ones expressible as
 * a check on the OUTPUT are here:
 *
 *   NaN / Infinity            a number that cannot be rendered or compared
 *   a missing required field  the adapter will read `undefined` and display it
 *   a negative quantity       HP, damage and rounds have no meaning below zero
 *
 * ⚠ AND NOT: "a number I did not expect". The engine is allowed to be surprising — a boss that
 * clears in one round is a real answer. Only self-contradiction is a fault, which is why every
 * check below is structural rather than a range someone thought looked sensible.
 */

import type { EngineCapability } from "./contracts";

export type ContractViolation = { field: string; problem: string };

const finite = (v: unknown): boolean => typeof v === "number" && Number.isFinite(v);

function requireFinite(out: Record<string, unknown>, fields: string[]): ContractViolation[] {
  const bad: ContractViolation[] = [];
  for (const f of fields) {
    const v = out[f];
    if (v === undefined || v === null) bad.push({ field: f, problem: "missing" });
    else if (!finite(v)) bad.push({ field: f, problem: `not a finite number (${String(v)})` });
  }
  return bad;
}

function requireNonNegative(out: Record<string, unknown>, fields: string[]): ContractViolation[] {
  const bad: ContractViolation[] = [];
  for (const f of fields) {
    const v = out[f];
    if (finite(v) && (v as number) < 0) bad.push({ field: f, problem: `negative (${String(v)})` });
  }
  return bad;
}

/**
 * Check one capability's output against its contract.
 *
 * Returns the violations; an empty array means the output is structurally sound. It says nothing
 * about whether the number is RIGHT — that is what the workbook fixtures and `validate:*` are for.
 */
export function validateOutput(capability: EngineCapability, output: unknown): ContractViolation[] {
  if (output === undefined || output === null) {
    return [{ field: "<result>", problem: "no result returned" }];
  }
  const o = output as Record<string, unknown>;

  switch (capability) {
    case "estimateCreature":
      return [
        ...requireFinite(o, ["effectiveHp", "effectiveAc", "modeledDpr",
          "baseDefensiveCr", "acAdjustedDefensiveCr", "baseOffensiveCr", "deliveryAdjustedOffensiveCr"]),
        ...requireNonNegative(o, ["effectiveHp", "modeledDpr"]),
        // `estimatedCr` is a number OR a top-of-table sentinel past it, checked by SHAPE.
        //
        // ⚠ NOT ONE LITERAL. The sentinel names where the table stops, so it changed from "25+" to
        // "30+" when M28 extended it — and a certified LKG packaged before M28 still returns the
        // old one. Pinning the literal would make a correct recovery answer read as a contract
        // violation, which is the regime trap Gate 6 already paid for once.
        ...(o.estimatedCr === undefined || o.estimatedCr === null
          ? [{ field: "estimatedCr", problem: "missing" }]
          : finite(o.estimatedCr) || /^\d+\+$/.test(String(o.estimatedCr))
            ? []
            : [{ field: "estimatedCr", problem: `neither a number nor a "<cr>+" sentinel (${String(o.estimatedCr)})` }]),
      ];

    case "resolvePartyProfile": {
      const dpr = (o.dpr ?? {}) as Record<string, unknown>;
      return [
        ...requireFinite(o, ["size", "level", "sustain"]),
        ...requireNonNegative(o, ["size", "sustain"]),
        ...requireFinite(dpr, ["round1", "round2", "round3", "round4Plus"]),
        ...requireNonNegative(dpr, ["round1", "round2", "round3", "round4Plus"]),
      ];
    }

    case "checkEncounter": {
      const bad = [
        ...requireFinite(o, ["encounterEhp", "startingEncounterDpr"]),
        ...requireNonNegative(o, ["encounterEhp", "startingEncounterDpr"]),
      ];
      // completionRound / fatalRound are legitimately null — "it never ends" and "nobody dies" are
      // both real answers. When present they must be a positive round number.
      for (const f of ["completionRound", "fatalRound", "downsAtCompletion", "standingAtCompletion"]) {
        const v = o[f];
        if (v === null || v === undefined) continue;
        if (!finite(v)) bad.push({ field: f, problem: `not a finite number (${String(v)})` });
        else if ((v as number) < 0) bad.push({ field: f, problem: `negative (${String(v)})` });
      }
      if (!Array.isArray(o.rounds)) bad.push({ field: "rounds", problem: "not an array" });
      return bad;
    }

    case "aggregateAudit": {
      const bad = [
        ...requireFinite(o, ["encounterEhp", "monsterDprRound1", "monsterDprRound2Plus", "partySustain"]),
        ...requireNonNegative(o, ["encounterEhp", "monsterDprRound1", "monsterDprRound2Plus", "partySustain"]),
      ];
      if (!Array.isArray(o.rounds)) bad.push({ field: "rounds", problem: "not an array" });
      // The sheet's own sentinels are strings; a number is equally valid. Anything else is not.
      for (const f of ["completionRound", "fatalRound", "projectedDowns"]) {
        const v = o[f];
        if (typeof v === "string") continue;
        if (!finite(v)) bad.push({ field: f, problem: `neither a number nor a sheet sentinel (${String(v)})` });
      }
      return bad;
    }

    case "auditCoverage": {
      const bad: ContractViolation[] = [];
      for (const f of ["covered", "packets", "unpriced", "parameters", "blocked"]) {
        if (!Array.isArray(o[f])) bad.push({ field: f, problem: "not an array" });
      }
      if (typeof o.ok !== "boolean") bad.push({ field: "ok", problem: "not a boolean" });
      // ⚠ The one cross-field invariant that matters: `ok` must mean what it says.
      if (Array.isArray(o.blocked) && typeof o.ok === "boolean"
          && o.ok !== ((o.blocked as unknown[]).length === 0)) {
        bad.push({ field: "ok", problem: "disagrees with blocked.length" });
      }
      return bad;
    }
  }
}
