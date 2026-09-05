/**
 * WHAT A SHORT REST ACTUALLY GIVES THIS PARTY BACK.
 *
 * ⚠ THIS REPLACES A POPULATION MEDIAN WITH THE PARTY IN FRONT OF YOU.
 * `partyResourceCurve.SHORT_REST_RECOVERY` is 0.255401 — the median `shortRestRecovery` across 384
 * sampled L7-L9 parties. As a default it is honest and it is published. As the answer for a NAMED
 * party it is the generic the V3.0 method rules out: *"Each actor spends their own remaining Hit
 * Dice one at a time until max HP or none remain; only resources registered as Short-Rest recovery
 * refresh."* A Warlock table and a Rogue table do not recover alike, and the spread proves it —
 * p10 0.07 against p90 0.40.
 *
 * ── WHAT COUNTS AS SUSTAIN, AND WHAT DOES NOT ────────────────────────────────────────────────
 * The V3.0 Method draws the line and this module keeps it:
 *
 *   · HIT DICE ARE SUSTAIN. They convert directly into hit points, which is what sustain measures.
 *   · REFRESHED POOLS ARE NOT. Action Surge, Channel Divinity and Pact slots coming back are
 *     TEMPO — they buy damage and options, not survivability. `shortRestRules.generated` records
 *     what refreshes and `classResources` grants it; neither belongs in a sustain figure, and
 *     folding them in would invent an exchange rate the workbook does not publish.
 *
 * ⚠ AND IT IS A CEILING, WHICH IS SAID RATHER THAN HIDDEN. The Method says a PC spends their
 * REMAINING dice. An act run tracks how spent the party is as one fraction, not per-actor dice, so
 * what this computes is the full pool: everything a rested party could buy back. `spentDice` lets a
 * caller that does know narrow it. Reporting the ceiling as if it were the expectation would make
 * every fight after a short rest read easier than it is, so the result says which it is.
 */

import { hitDicePools } from "../../core/rules/multiclass";
import { knownShortRestClass } from "./shortRestRules.generated";

export type ActorLikeForRest = {
  name?: string;
  className?: string;
  level?: number;
  classes?: unknown;
  abilityScores?: { con?: { score?: number } };
};

export type ShortRestActorRecovery = {
  actor: string;
  /** "5d10 + 1d6" — the pools as they read on the sheet. */
  pools: string;
  dice: number;
  /** Hit points those dice buy back, at the average roll plus CON per die. */
  hp: number;
};

export type ShortRestRecovery = {
  /** Hit points the party can buy back by spending Hit Dice. */
  recoveredHp: number;
  /** That as a share of full party sustain — the number `actRun` consumes. */
  fraction: number;
  /** True while `recoveredHp` is the whole pool rather than what is actually left. */
  ceiling: boolean;
  perActor: ShortRestActorRecovery[];
  /** Actors the registry cannot resolve. Reported, never silently zero. */
  unresolved: Array<{ actor: string; reason: string }>;
};

/** A dN averages (N+1)/2. */
function averageDie(die: string): number {
  const faces = Number(String(die).replace(/^d/i, ""));
  return Number.isFinite(faces) && faces > 0 ? (faces + 1) / 2 : 0;
}

function conModifier(actor: ActorLikeForRest): number {
  const score = Number(actor.abilityScores?.con?.score);
  return Number.isFinite(score) ? Math.floor((score - 10) / 2) : 0;
}

/**
 * What a short rest returns to this party, in hit points and as a share of its sustain.
 *
 * Returns null when nothing resolves at all — no actors, or no readable Hit Dice — so the caller
 * falls back to the published median and can say that it did. A zero would claim this party
 * recovers nothing, which is a different and much stronger statement.
 */
export function shortRestRecoveryFromActors(
  actors: readonly ActorLikeForRest[],
  fullSustain: number,
  opts: { spentDice?: Record<string, number> } = {},
): ShortRestRecovery | null {
  if (!actors.length || !(fullSustain > 0)) return null;

  const perActor: ShortRestActorRecovery[] = [];
  const unresolved: Array<{ actor: string; reason: string }> = [];
  let recoveredHp = 0;
  let narrowed = false;

  for (const actor of actors) {
    const who = actor.name ?? "(unnamed)";
    const cls = (actor.className ?? "").trim();
    if (cls && !knownShortRestClass(cls)) {
      unresolved.push({
        actor: who,
        reason: `"${cls}" is not in the short-rest registry, so its Hit Dice cannot be confirmed.`,
      });
      continue;
    }
    const pools = hitDicePools(actor as never);
    if (!pools.length) {
      unresolved.push({ actor: who, reason: "No class or level to read Hit Dice from." });
      continue;
    }
    const con = conModifier(actor);
    let dice = 0;
    let hp = 0;
    for (const pool of pools) {
      const spent = Number(opts.spentDice?.[`${who}:${pool.die}`] ?? 0);
      if (spent > 0) narrowed = true;
      const left = Math.max(0, pool.count - Math.max(0, spent));
      dice += left;
      // A die that heals for nothing still heals for nothing; it never heals BACKWARDS.
      hp += left * Math.max(0, averageDie(pool.die) + con);
    }
    recoveredHp += hp;
    perActor.push({
      actor: who,
      pools: pools.map(p => `${p.count}${p.die}`).join(" + "),
      dice,
      hp,
    });
  }

  if (perActor.length === 0) return null;
  return {
    recoveredHp,
    fraction: Math.min(1, recoveredHp / fullSustain),
    ceiling: !narrowed,
    perActor,
    unresolved,
  };
}
