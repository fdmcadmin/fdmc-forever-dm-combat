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
 * ── TWO THINGS COME BACK, AND THEY ARE NOT THE SAME THING ────────────────────────────────────
 *
 * Christopher, 2026-09-07: *"the baseline recovery for X class … should cover everything from
 * health to charges on items."* He is right, and the workbook's own Short Rest Rules sheet says it
 * first: *"The app reads this compact authority to resolve the actual actor it is showing. The
 * external party runtime applies these rules to live state; the workbook does not simulate the
 * 1,024 parties or substitute a generic 25% recovery."*
 *
 * So BOTH halves are computed, and they are kept apart because they are spent on different things:
 *
 *   · HIT DICE → SUSTAIN. They convert directly into hit points, which is what sustain measures.
 *   · REFRESHED POOLS → TEMPO. Action Surge, Pact slots, Ki, Superiority Dice and an item's
 *     short-rest charges buy damage and options, not survivability.
 *
 * ⚠ AND MIXING THEM INTO ONE FRACTION WOULD INVENT AN EXCHANGE RATE THE WORKBOOK DOES NOT PUBLISH.
 * The earlier version of this file counted only the first and called it "the" recovery, which made
 * a Warlock party recover nothing on a short rest even though four Pact slots came back. The fix
 * is not to fold the pools into the HP number; it is to return the second fraction beside it and
 * let the act run spend each on the clock it belongs to.
 *
 * ⚠ THE RESOURCE HALF IS COUNTED BY THE LEDGER, NOT BY A SECOND READING. `resourceLedgerFromActor`
 * already resolves every pool on a sheet and already records `recoveredPerShortRest` against
 * `totalUses` — spell slots, pact slots, class pools, free casts and item charges alike. Asking it
 * is RULE ZERO; re-deriving "what comes back on a short rest" here would be a second answer that
 * can disagree with the one the day budget is built from.
 *
 * ⚠ AND IT IS A CEILING, WHICH IS SAID RATHER THAN HIDDEN. The Method says a PC spends their
 * REMAINING dice. An act run tracks how spent the party is as one fraction, not per-actor dice, so
 * what this computes is the full pool: everything a rested party could buy back. `spentDice` lets a
 * caller that does know narrow it. Reporting the ceiling as if it were the expectation would make
 * every fight after a short rest read easier than it is, so the result says which it is.
 */

import { hitDicePools } from "../../core/rules/multiclass";
import { knownShortRestClass } from "./shortRestRules.generated";
import { resourceLedgerFromActor } from "../../core/encounter-band/resourceLedger";

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

/** A pool that comes back on a short rest, and how much of the day's supply it is. */
export type ShortRestResourceRecovery = {
  actor: string;
  resource: string;
  /** Uses returned at ONE scheduled short rest. */
  back: number;
  /** Uses this pool supplies across the whole day, so `back` can be read as a share. */
  ofDay: number;
};

export type ShortRestRecovery = {
  /** Hit points the party can buy back by spending Hit Dice. */
  recoveredHp: number;
  /**
   * That as a share of full party sustain — the SUSTAIN clock's recovery, and what `actRun`
   * consumes for hit points.
   */
  fraction: number;
  /**
   * Uses returned across every short-rest pool the party carries — class resources, pact slots,
   * free casts and item charges — as a share of the day's total supply.
   *
   * ⚠ THIS IS THE TEMPO CLOCK, NOT THE SUSTAIN ONE. It is what a Warlock gets back, and it is why
   * counting only Hit Dice made a Pact Magic party read as recovering nothing.
   */
  resourceFraction: number;
  resourcesBack: number;
  resourcesPerDay: number;
  resources: ShortRestResourceRecovery[];
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
    /**
     * ⚠ A MULTICLASS SHEET'S `className` IS A LABEL, NOT A CLASS, AND THIS GATE READ IT AS ONE.
     *
     * The registry check ran before `hitDicePools`, against the DISPLAY string. A multiclass PC
     * carries something like "Paladin  / Sorcerer" there — a heading for the card — while the
     * machine truth is the `classes` array, which `hitDicePools` already reads and already sums
     * (5d10 + 2d6). "Paladin  / Sorcerer" is in no registry, so the actor was rejected here and
     * every one of their Hit Dice vanished from the party's short-rest recovery.
     *
     * Measured on the live party: four of five PCs were counted and the multiclass one was not,
     * which is a real chunk of the number the act run spends between fights.
     *
     * So ask the STRUCTURED rows when they exist, and fall back to the label only when they do
     * not — which is the same precedence `hitDicePools` itself uses one line below.
     */
    const rows = Array.isArray(actor.classes)
      ? (actor.classes as Array<{ name?: string }>).filter(r => r && typeof r.name === "string")
      : [];
    if (rows.length > 0) {
      const unknown = rows.map(r => String(r.name).trim()).filter(n => n && !knownShortRestClass(n));
      if (unknown.length > 0) {
        unresolved.push({
          actor: who,
          reason: `${unknown.map(n => `"${n}"`).join(", ")} ${unknown.length === 1 ? "is" : "are"} not in the short-rest registry, so its Hit Dice cannot be confirmed.`,
        });
        continue;
      }
    } else {
      const cls = (actor.className ?? "").trim();
      if (cls && !knownShortRestClass(cls)) {
        unresolved.push({
          actor: who,
          reason: `"${cls}" is not in the short-rest registry, so its Hit Dice cannot be confirmed.`,
        });
        continue;
      }
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

  /**
   * ⚠ THE OTHER HALF, ASKED OF THE LEDGER RATHER THAN RE-DERIVED.
   *
   * `resourceLedgerFromActor` already resolves every pool on a sheet — spell slots, pact slots,
   * class resources, free casts and item charges — and already records how many uses each returns
   * at ONE scheduled short rest against how many it supplies across the day. That is exactly the
   * question here, so it is asked rather than answered a second time.
   *
   * ⚠ A POOL THAT RETURNS NOTHING STILL COUNTS IN THE DENOMINATOR. A party of Wizards recovers no
   * resources on a short rest, and the honest way to say so is 0 out of their whole day's supply —
   * not to omit them and report a share of nothing.
   */
  const resources: ShortRestResourceRecovery[] = [];
  let resourcesBack = 0;
  let resourcesPerDay = 0;
  for (const actor of actors) {
    let rows: ReturnType<typeof resourceLedgerFromActor>["rows"] = [];
    try { rows = resourceLedgerFromActor(actor as never).rows; } catch { continue; }
    for (const row of rows) {
      if (!(row.totalUses > 0)) continue;
      resourcesPerDay += row.totalUses;
      if (row.recoveredPerShortRest <= 0) continue;
      resourcesBack += row.recoveredPerShortRest;
      resources.push({
        actor: actor.name ?? "(unnamed)",
        resource: row.resource,
        back: row.recoveredPerShortRest,
        ofDay: row.totalUses,
      });
    }
  }

  if (perActor.length === 0) return null;
  return {
    recoveredHp,
    fraction: Math.min(1, recoveredHp / fullSustain),
    resourceFraction: resourcesPerDay > 0 ? Math.min(1, resourcesBack / resourcesPerDay) : 0,
    resourcesBack,
    resourcesPerDay,
    resources,
    ceiling: !narrowed,
    perActor,
    unresolved,
  };
}
