/**
 * THE BODIES THAT ARE ACTUALLY ON THE FIELD — a summon's last mile into the turn order.
 *
 * Christopher, 2026-09-08: *"these arent showing in the combat chart for the divine stead and the
 * eldritch cannon"*, and *"this has to be able to track rounds in combat or the covenant creature
 * would just always be on."*
 *
 * ─── ⚠ THE MODEL WAS FINISHED; ITS EXITS WERE NOT ───────────────────────────────────────────
 *
 * `summon.ts` resolves every formula the three named cases need and `check:summons` proves the
 * arithmetic against a PC summoner. `SummonSpec` already carries `durationRounds` — *"the Covenant
 * bond-creature lasts 2 turns; a Steed lasts until something kills it"* — and `acts`, which
 * decides whether a body takes a turn of its own or moves on the caster's. Both fields were
 * authored and neither had a single reader in production. The gate says why it never showed:
 * *"⚠ WHAT IS ASSERTED IS THE ARITHMETIC, not that a body appeared."*
 *
 * This is where a body appears.
 *
 * ─── ⚠ WHY DURATION IS COUNTED FROM A ROUND AND NOT A TIMER ─────────────────────────────────
 *
 * A summon that expires has to expire ON A ROUND the table can see, because the table argues about
 * rounds and not about wall-clock. `summonedOnRound` plus `durationRounds` is the whole state; the
 * tracker asks "is it still up on round N" and gets an answer it can show. Nothing is scheduled,
 * nothing ticks, and a round rewind therefore un-expires a body correctly rather than leaving it
 * dead because a timer already fired.
 */

import type { Actor } from "../types/actor";
import type { MainMonsterTemplate } from "../monsters/runtime/mainMonsterRuntime";
import { materializeSummon, type SummonSpec } from "../monsters/summon";
import { summonerContextFromActor } from "./summonFromActor";

/**
 * One casting that is still standing, as the table stored it.
 *
 * ⚠ THE SPEC IS COPIED, NOT REFERENCED. A Steed summoned with a 3rd-level slot keeps that slot's
 * numbers even if the caster later edits the action or casts it again at a different level — the
 * body on the field is the one that was called, not whatever the sheet says now.
 */
export type ActiveSummon = {
  /** Stable id for this body, so HP and initiative can be tracked against it. */
  id: string;
  /** The character who called it. */
  ownerId: string;
  /** The action's id, so a second casting of the SAME action can replace the first. */
  actionId: string;
  spec: SummonSpec;
  /** The combat round it arrived on. Duration is measured from here. */
  summonedOnRound: number;
  /** The slot spent, when the body scales with it. */
  slotLevel?: number;
  /**
   * THE RESOLVED BODY, WRITTEN BY THE CLIENT THAT HAS THE LIBRARY — the GM.
   *
   * Christopher, 2026-09-15: *"even on the full version the players should not need to download the monster
   * library and the equipment library and players should only have to load the data that is attached to that
   * seat"*, and *"the DM should be broadcasting any changes [...] so they just have to be able to receive
   * those packets for those characters attached to their seats and be able to read the room meta data"*.
   *
   * MASTER's rule — *"The RECORD travels, never the body"* — was about ROOM METADATA, which is 16KB for every
   * extension on the table combined and must never hold a stat block. This is the summon CHANNEL, and a
   * player with no monster library cannot materialize a body from a record: without this the Steed and the
   * Cannon simply never appeared on a player's tracker. The GM resolves it once and it travels with the
   * record; the record is still what persists and what expires.
   */
  body?: MainMonsterTemplate;
  /** How many bodies that one call brought — resolved with `body`. */
  bodyCount?: number;
};

/** A body on the field, resolved and ready for the turn order. */
export type ResolvedSummon = {
  id: string;
  name: string;
  ownerId: string;
  body: MainMonsterTemplate;
  /** How many bodies this one call brought. */
  count: number;
  /** `own-initiative` takes a row of its own; `summoner-turn` nests under its caster. */
  acts: "own-initiative" | "summoner-turn";
  /** The last round it is up. Undefined means until it drops or is dismissed. */
  expiresAfterRound?: number;
  /** Anything `materializeSummon` could not resolve, carried rather than swallowed. */
  problems: string[];
};

/**
 * Is this body still standing on `round`?
 *
 * ⚠ A SUMMON IS UP ON THE ROUND IT ARRIVES. "Lasts 2 turns" summoned on round 3 means rounds 3 and
 * 4 — counting the arrival round as elapsed would give a two-round body one round of life, which
 * is the off-by-one that makes a DM stop trusting the tracker.
 */
export function isStandingOn(record: ActiveSummon, round: number): boolean {
  if (round < record.summonedOnRound) return false;
  const duration = record.spec.durationRounds;
  if (!duration || duration <= 0) return true;
  return round <= record.summonedOnRound + duration - 1;
}

/**
 * Resolve every standing summon for this round.
 *
 * ⚠ A RECORD WHOSE OWNER OR BODY IS GONE IS REPORTED, NOT DROPPED. A Steed pointing at a deleted
 * creature is a broken sheet the DM needs to see, and a body that silently fails to appear is
 * indistinguishable at the table from one that was never summoned.
 */
export function resolveActiveSummons(
  records: readonly ActiveSummon[],
  actors: readonly Actor[],
  round: number,
  library: readonly MainMonsterTemplate[] = [],
): { summons: ResolvedSummon[]; problems: string[] } {
  const summons: ResolvedSummon[] = [];
  const problems: string[] = [];
  const byId = new Map(actors.map(a => [a.id, a]));

  for (const record of records) {
    if (!isStandingOn(record, round)) continue;
    const owner = byId.get(record.ownerId);
    if (!owner) {
      problems.push(`A summoned body is on the field with no caster: its owner ${record.ownerId} is not in this fight.`);
      continue;
    }
    /**
     * ⚠ THE SLOT LIVES ON THE SPEC, because it is a fact about THIS CASTING. `materializeSummon`
     * reads `spec.slotLevel` — it takes no slot parameter — so a record that stores the slot
     * beside the spec has to fold it in, or a Steed cast with a 4th-level slot resolves its
     * `10+@SLOT` AC against nothing and comes out at 10.
     */
    const spec = record.slotLevel !== undefined && record.spec.slotLevel === undefined
      ? { ...record.spec, slotLevel: record.slotLevel }
      : record.spec;
    /**
     * ⚠ THE BODY THE RECORD CARRIES WINS, and a client without the library has only that. The GM writes it
     * (see `ActiveSummon.body`); materializing again here would need the library this exists to avoid.
     */
    const carried = record.body ? { body: record.body, count: Math.max(1, Number(record.bodyCount ?? 1)), problems: [] as string[] } : undefined;
    const made = carried ?? materializeSummon(spec, summonerContextFromActor(owner, record.slotLevel), library);
    if (!made?.body) {
      problems.push(...(made?.problems ?? [`"${record.spec.name ?? "summon"}" could not be built.`]));
      continue;
    }
    problems.push(...made.problems);
    summons.push({
      id: record.id,
      name: spec.name ?? made.body.name,
      ownerId: record.ownerId,
      body: made.body,
      count: Math.max(1, made.count),
      /**
       * ⚠ THE DEFAULT IS ITS OWN TURN, because that is what a summon usually is and because the
       * quieter mistake is the other one: reading "acts on your turn" as a turn of its own hands
       * the party a free extra combatant every round, which is exactly what `SummonSpec.acts`
       * was written to prevent.
       */
      acts: spec.acts ?? "own-initiative",
      ...(spec.durationRounds && spec.durationRounds > 0
        ? { expiresAfterRound: record.summonedOnRound + spec.durationRounds - 1 }
        : {}),
      problems: made.problems,
    });
  }

  return { summons, problems };
}

/**
 * ⚠ A SECOND CASTING OF THE SAME ACTION REPLACES THE FIRST. Find Steed does not give a Paladin two
 * steeds; re-casting it moves the arrival round, which is what makes the duration restart. Two
 * DIFFERENT actions from the same caster both stand, which is why the key is owner AND action.
 */
export function withSummonRecord(records: readonly ActiveSummon[], record: ActiveSummon): ActiveSummon[] {
  return [...records.filter(r => !(r.ownerId === record.ownerId && r.actionId === record.actionId)), record];
}
