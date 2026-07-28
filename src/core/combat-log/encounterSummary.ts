/**
 * Encounter summary — the per-combatant totals shown under the log and carried in the
 * export. This is the piece that makes an exported log worth keeping: a flat transcript
 * can be read once, but totals answer "who actually carried that fight".
 *
 * Five questions, from Christopher:
 *   · who dealt the most damage (to creatures)
 *   · who took the most damage
 *   · who did the most healing
 *   · who spent the most resources
 *   · how many actions each combatant took
 *
 * ATTRIBUTION IS THE WHOLE PROBLEM. A reaction or legendary action fires during someone
 * else's turn, so crediting by "whose turn is it" hands a PC's opportunity-attack damage
 * to the monster it interrupted. Entries carry their own `actorId` plus an `attribution`
 * flag, and anything only inferred from the active turn is counted separately so a total
 * can be reported honestly rather than silently overstated.
 */

import type { CombatLogEntry } from "../types/combatLog";

export type CombatantTotals = {
  id: string;
  name: string;
  /** Unset when no entry ever declared a side (older logs). */
  side?: "party" | "monster";
  damageDealt: number;
  damageTaken: number;
  healingDone: number;
  resourcesSpent: number;
  /** Actions taken, split by economy — high-level combat blurs precisely here. */
  actions: number;
  bonusActions: number;
  reactions: number;
  legendaryActions: number;
  /** Total entries credited to this combatant that were INFERRED, not attributed. */
  inferredEntries: number;
};

export type EncounterSummary = {
  combatants: CombatantTotals[];
  rounds: number;
  totalEntries: number;
  /** How much of the damage total rests on inference rather than a committed roll. */
  inferredEntries: number;
  /** True when the leaders are party-only, so the UI can label them honestly. */
  leadersScopedToParty: boolean;
  leaders: {
    mostDamageDealt?: CombatantTotals;
    mostDamageTaken?: CombatantTotals;
    mostHealing?: CombatantTotals;
    mostResources?: CombatantTotals;
  };
};

function blank(id: string, name: string, side?: "party" | "monster"): CombatantTotals {
  return {
    id, name, side,
    damageDealt: 0, damageTaken: 0, healingDone: 0, resourcesSpent: 0,
    actions: 0, bonusActions: 0, reactions: 0, legendaryActions: 0,
    inferredEntries: 0,
  };
}

/** Highest by `pick`, or undefined when nobody scored above zero. */
function leaderBy(rows: CombatantTotals[], pick: (r: CombatantTotals) => number): CombatantTotals | undefined {
  let best: CombatantTotals | undefined;
  for (const r of rows) {
    if (pick(r) <= 0) continue;
    if (!best || pick(r) > pick(best)) best = r;
  }
  return best;
}

export function summarizeEncounter(entries: CombatLogEntry[]): EncounterSummary {
  const byId = new Map<string, CombatantTotals>();
  // Name-keyed fallback: older entries carry only actorName. Keying on the name keeps them
  // countable instead of dropping them, at the cost of merging a rename.
  const keyFor = (id: string | undefined, name: string) => id || `name:${name}`;
  const get = (id: string | undefined, name: string, side?: "party" | "monster") => {
    const k = keyFor(id, name);
    let row = byId.get(k);
    if (!row) { row = blank(k, name, side); byId.set(k, row); }
    if (side && !row.side) row.side = side;
    // A later entry carrying a real name upgrades a placeholder.
    if (name && row.name !== name && !row.name) row.name = name;
    return row;
  };

  let rounds = 0;
  let inferred = 0;

  for (const e of entries) {
    if (typeof e.round === "number") rounds = Math.max(rounds, e.round);

    const actor = get(e.actorId, e.actorName, e.actorSide);
    const amount = typeof e.amount === "number" && e.amount > 0 ? e.amount : 0;

    if (e.attribution === "inferred") { inferred++; actor.inferredEntries++; }

    switch (e.category) {
      case "damage":
        actor.damageDealt += amount;
        // The receiving side is a different combatant — credit it separately so
        // "took the most damage" is a real total and not the inverse of dealt.
        if (e.targetId || e.targetName) get(e.targetId, e.targetName ?? "", e.targetSide).damageTaken += amount;
        break;
      case "healing":
        actor.healingDone += amount;
        break;
      case "resource":
        actor.resourcesSpent += amount || 1;
        break;
      default:
        break;
    }

    // Action economy is counted from sourceKind, independent of whether the entry
    // carried a number — a miss is still an action spent.
    switch (e.sourceKind) {
      case "action":    actor.actions++;          break;
      case "bonus":     actor.bonusActions++;     break;
      case "reaction":  actor.reactions++;        break;
      case "legendary": actor.legendaryActions++; break;
      default: break;
    }
  }

  const combatants = [...byId.values()]
    // Drop rows that only ever appeared in flow entries (turn markers, system notes).
    .filter(r => r.damageDealt || r.damageTaken || r.healingDone || r.resourcesSpent
      || r.actions || r.bonusActions || r.reactions || r.legendaryActions)
    .sort((a, b) => b.damageDealt - a.damageDealt || a.name.localeCompare(b.name));

  // Leaders are a PARTY question — "who carried that fight". Computed over everyone, the
  // boss wins damage-dealt almost every time simply by being the thing all five PCs are
  // fighting and the only thing swinging back at all of them. Falls back to the whole
  // field when nothing declared a side, so older logs still produce leaders.
  const partyRows = combatants.filter(r => r.side === "party");
  const leaderPool = partyRows.length > 0 ? partyRows : combatants;

  return {
    combatants,
    rounds,
    totalEntries: entries.length,
    inferredEntries: inferred,
    /** True when the leaders below are party-only, so the UI can label them honestly. */
    leadersScopedToParty: partyRows.length > 0,
    leaders: {
      mostDamageDealt: leaderBy(leaderPool, r => r.damageDealt),
      mostDamageTaken: leaderBy(leaderPool, r => r.damageTaken),
      mostHealing:     leaderBy(leaderPool, r => r.healingDone),
      mostResources:   leaderBy(leaderPool, r => r.resourcesSpent),
    },
  };
}
