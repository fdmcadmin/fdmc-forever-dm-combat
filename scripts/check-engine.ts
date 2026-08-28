/**
 * THE ENGINE GATE — parity, contract validation, and fault isolation.
 *
 * Run: npm run check:engine
 *
 * Portability spec Gate 1 (*"verify workbook parity remains exact"*) and Gate 4 (*"deliberately
 * break each capability; prove only the broken capability falls back; prove unrelated current code
 * remains active; prove double failure fails closed"*).
 *
 * ⚠ THE EXIT CHECK IS THE LAST THING IN THIS FILE. MASTER records why: `check:summons` printed PASS
 * and exited 0 while four of its own assertions printed FAIL, because its exit check sat ABOVE a
 * block of tests. Nothing may be appended below the exit.
 */

import {
  engine, engineDirect, engineDiagnostics, resetCapability,
  ENGINE_VERSION, ENGINE_CAPABILITIES, isOk,
} from "../src/core/encounter-engine";
import { registerActive, capabilityState } from "../src/core/encounter-engine/safeExecute";
import { ENGINE_MANIFEST, FALLBACK_REGISTRATION } from "../src/core/encounter-engine";
import { PARTY_CURVE_V2 } from "../src/core/encounter-band/partyCurveV2";

let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};

console.log(`FDMC Encounter Engine ${ENGINE_VERSION} — ${ENGINE_CAPABILITIES.length} capabilities\n`);

/* ── 1. Parity: the boundary must not change a single number. ───────────────────────────────── */
console.log("Boundary parity — wrapped output must equal direct output");
{
  const input = {
    rawHp: 120, ac: 16, ehpMultiplier: 1, r1Dpr: 30, r2PlusDpr: 22,
    offenseBasis: "attack" as const, attackBonus: 7, saveDc: 15,
  };
  const direct = engineDirect.estimateCreature(input);
  const wrapped = engine.estimateCreature(input);
  ok("estimateCreature wrapped === direct",
    isOk(wrapped) && JSON.stringify(wrapped.value) === JSON.stringify(direct));

  // The workbook's own worked example, which MASTER records as exact.
  ok("workbook example still CR 5", direct.estimatedCr === 5, `got ${direct.estimatedCr}`);
  ok("workbook example 3-round DPR exact",
    direct.modeledDpr === 24.666666666666668, `got ${direct.modeledDpr}`);
}
{
  const row = PARTY_CURVE_V2.find(r => r.level === 9)!;
  ok("L9 4P wotcStandard R1 exact",
    row.wotcStandard.round1 === 107.34437314590798, `got ${row.wotcStandard.round1}`);
  ok("L9 4P wotcStandard sustain exact",
    row.wotcStandard.sustain === 487.2898080604998, `got ${row.wotcStandard.sustain}`);
}

/* ── 2. Contract validation catches what a try/catch cannot. ────────────────────────────────── */
console.log("\nContract validation");
{
  const good = engine.estimateCreature({
    rawHp: 90, ac: 15, r1Dpr: 20, r2PlusDpr: 15, offenseBasis: "attack", attackBonus: 6,
  });
  ok("a sound result passes", isOk(good));

  // ⚠ NaN WITHOUT THROWING is the failure a try/catch misses and a DM cannot see.
  registerActive("estimateCreature", (() => ({
    effectiveHp: NaN, effectiveAc: 15, modeledDpr: 10, estimatedCr: 3,
    baseDefensiveCr: 1, acAdjustedDefensiveCr: 1, baseOffensiveCr: 1, deliveryAdjustedOffensiveCr: 1,
  })) as never);
  const nan = engine.estimateCreature({ rawHp: 1, ac: 1, r1Dpr: 1, r2PlusDpr: 1 });
  /**
   * ⚠ DETECTION IS THE INVARIANT, not the outcome. With an LKG bundled the fallback answers, so
   * the call SUCCEEDS — from `fallback`. The proof that the NaN was caught is on the capability's
   * own record, not in the return value.
   */
  ok("NaN output is detected as a CONTRACT_VIOLATION",
    (capabilityState("estimateCreature").lastFailure ?? "").includes("violated its contract"),
    capabilityState("estimateCreature").lastFailure ?? "nothing recorded");
  ok("and the caller is told which implementation answered",
    !nan.ok ? nan.from === "active" || nan.from === "none" : nan.from === "fallback",
    nan.ok ? `ok from ${nan.from}` : `failed from ${nan.from}`);

  registerActive("estimateCreature", (() => { throw new Error("boom"); }) as never);
  engine.estimateCreature({ rawHp: 1, ac: 1, r1Dpr: 1, r2PlusDpr: 1 });
  ok("a throw is caught and recorded",
    (capabilityState("estimateCreature").lastFailure ?? "").includes("threw"),
    capabilityState("estimateCreature").lastFailure ?? "nothing recorded");
}

/* ── 3. Fault isolation: only the broken capability degrades. ───────────────────────────────── */
console.log("\nFault isolation — Gate 4");
{
  // estimateCreature is still broken from the block above. Everything else must be untouched.
  const curve = engine.resolvePartyProfile({ level: 9, size: 4, equipmentMode: "wotcStandard" });
  ok("resolvePartyProfile unaffected by a broken estimateCreature", isOk(curve));

  const cov = engine.auditCoverage([{ channel: "action", name: "Bite", text: "Melee Weapon Attack: +5 to hit, reach 5 ft.; Hit: 7 (1d8 + 3) piercing." }]);
  ok("auditCoverage unaffected", isOk(cov));

  // Three consecutive failures trip the breaker on that capability ALONE.
  engine.estimateCreature({ rawHp: 1, ac: 1, r1Dpr: 1, r2PlusDpr: 1 });
  engine.estimateCreature({ rawHp: 1, ac: 1, r1Dpr: 1, r2PlusDpr: 1 });
  const diag = engineDiagnostics();
  ok("breaker quarantined estimateCreature", diag.estimateCreature.quarantined,
    `failures=${diag.estimateCreature.failures}`);
  ok("no other capability is quarantined",
    ENGINE_CAPABILITIES.filter(c => c !== "estimateCreature").every(c => !diag[c].quarantined));

  // ⚠ FAIL CLOSED. With no last-known-good artifact registered there is nothing to fall back to,
  // and the answer must be a failure rather than a zero.
  const closed = engine.estimateCreature({ rawHp: 50, ac: 14, r1Dpr: 10, r2PlusDpr: 8 });
  if (FALLBACK_REGISTRATION.registered.includes("estimateCreature")) {
    // ⚠ AFTER CERTIFICATION the quarantined capability RECOVERS. That is the point of Gate 6.
    ok("quarantined with an LKG bundled recovers rather than failing",
      isOk(closed) && closed.from === "fallback",
      isOk(closed) ? `from ${closed.from}` : closed.detail);
  } else {
    // ⚠ BEFORE CERTIFICATION it must fail loudly rather than return a zero.
    ok("quarantined with no fallback fails closed", !closed.ok && closed.from === "none",
      isOk(closed) ? "returned a value" : closed.detail);
  }
}

/* ── 4. Recovery restores the real implementation. ──────────────────────────────────────────── */
console.log("\nRecovery");
{
  registerActive("estimateCreature", engineDirect.estimateCreature as never);
  resetCapability("estimateCreature");
  const back = engine.estimateCreature({
    rawHp: 120, ac: 16, ehpMultiplier: 1, r1Dpr: 30, r2PlusDpr: 22,
    offenseBasis: "attack", attackBonus: 7, saveDc: 15,
  });
  ok("capability recovers after reset", isOk(back) && back.value.estimatedCr === 5);
  ok("diagnostics clear", !engineDiagnostics().estimateCreature.quarantined);
}

/* ── Gate 6 — artifact packaging, version identification, candidate→LKG recovery ────────── */
console.log("\nGate 6 — packaging and recovery");
{
  const m = ENGINE_MANIFEST;
  ok("the candidate is packaged, not a source checkout", m.candidate.hash !== "unpackaged",
    `${m.candidate.engineVersion} ${m.candidate.hash}`);
  ok("the hash identifies the build", /^[0-9a-f]{12}$/.test(m.candidate.hash), m.candidate.hash);
  ok("every capability is declared in the artifact",
    ENGINE_CAPABILITIES.every(c => m.candidate.capabilities.includes(c)),
    m.candidate.capabilities.join(","));
  ok("GitHub Release is the authority of record", m.authority === "github-release");

  /**
   * ⚠ THE RECOVERY TEST IS THE POINT OF GATE 6. Everything above proves the artifact EXISTS;
   * this proves it RUNS when the candidate does not. Without it, the packaging is filing.
   */
  if (FALLBACK_REGISTRATION.registered.length === 0) {
    ok("no LKG bundled yet — fails closed, which is the correct pre-certification state",
      FALLBACK_REGISTRATION.missing.length === ENGINE_CAPABILITIES.length);
  } else {
    ok("the bundled LKG registered every capability",
      FALLBACK_REGISTRATION.missing.length === 0,
      `missing ${FALLBACK_REGISTRATION.missing.join(",") || "none"}`);
    ok("the LKG is identified by version and hash",
      !!m.lkg && /^[0-9a-f]{12}$/.test(m.lkg.hash),
      m.lkg ? `${m.lkg.engineVersion} ${m.lkg.hash}` : "none");

    // Break the candidate, then confirm the ANSWER still arrives — from the fallback.
    registerActive("aggregateAudit", (() => { throw new Error("candidate down"); }) as never);
    const recovered = engine.aggregateAudit({
      level: 9, partySize: 4, mode: "wotcStandard",
      groups: [{ quantity: 1, groupEhp: 300, round1DprPerBody: 66, round2PlusDprPerBody: 55 }],
    });
    ok("a broken candidate recovers to the bundled LKG",
      isOk(recovered) && recovered.from === "fallback",
      isOk(recovered) ? `from ${recovered.from}` : recovered.detail);
    ok("and the recovered answer is the real one",
      isOk(recovered) && recovered.value.encounterEhp === 300,
      isOk(recovered) ? String(recovered.value.encounterEhp) : "");

    registerActive("aggregateAudit", engineDirect.aggregateAudit as never);
    resetCapability("aggregateAudit");
    ok("and the candidate comes back after reset",
      isOk(engine.aggregateAudit({
        level: 9, partySize: 4, mode: "wotcStandard",
        groups: [{ quantity: 1, groupEhp: 300, round1DprPerBody: 66, round2PlusDprPerBody: 55 }],
      })));
  }
}

console.log(`\n${failures === 0 ? "PASS" : `FAIL — ${failures} check(s)`}`);
process.exit(failures === 0 ? 0 : 1);
