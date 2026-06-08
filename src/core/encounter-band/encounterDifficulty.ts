/**
 * encounterDifficulty.ts — P9.5 homebrew encounter party-size / level band heuristic.
 *
 * AUTHORITY / BOUNDARY: This is NOT an official CR calculator (see MASTER.md
 * "Do-Not-Build → Public CR calculator"). It is an internal, fully transparent
 * threat-budget guide for the DM's own campaign monsters: given an encounter's
 * monsters and a party of `size` PCs at a pseudo-`level`, it rates difficulty and
 * recommends how many monsters to add/remove to land in the "Standard" band — a
 * fair fight that isn't overpowered for the party. Pure functions, no side effects,
 * no dependency on any P0–P9 state or protected component.
 *
 * Threat model (HP-driven — MainMonsterTemplate carries no CR/tier, only HP + kind):
 *   unitThreat   = maxHp × kindMult × multiattackMult
 *                  kindMult        = 1.6 for a boss, else 1.0
 *                  multiattackMult = 1.25 if the creature has a Multiattack, else 1.0
 *   partyBudget  = size × (PC_BASE + PC_PER_LEVEL × level)
 *   ratio        = encounterThreat / partyBudget
 * Bands (by ratio): <0.5 Trivial · 0.5–0.8 Easy · 0.8–1.2 Standard · 1.2–1.6 Hard · >1.6 Deadly
 *
 * Constants are tuned so the campaign's existing fights read sensibly (e.g. the Act 1
 * Frostbound Owlbear + 2 wolves ≈ Standard for 6 level-1 PCs). Adjust here only.
 */

export type Difficulty = "Trivial" | "Easy" | "Standard" | "Hard" | "Deadly";

export type ThreatMonster = {
  /** templateId — stable key for grouping */
  id: string;
  name: string;
  maxHp: number;
  isBoss: boolean;
  multiattack: boolean;
  count: number;
};

// ── Tunable constants ────────────────────────────────────────────────────────
export const PC_BASE = 12;        // threat a level-0 PC notionally absorbs
export const PC_PER_LEVEL = 10;   // added per pseudo-level
const BOSS_MULT = 1.6;
const MULTIATTACK_MULT = 1.25;
const STANDARD_LOW = 0.8;         // ratio floor of the Standard band
const STANDARD_HIGH = 1.2;        // ratio ceiling of the Standard band

export function unitThreat(m: Pick<ThreatMonster, "maxHp" | "isBoss" | "multiattack">): number {
  const hp = Math.max(1, m.maxHp || 0);
  return hp * (m.isBoss ? BOSS_MULT : 1) * (m.multiattack ? MULTIATTACK_MULT : 1);
}

export function encounterThreat(monsters: ThreatMonster[]): number {
  return monsters.reduce((sum, m) => sum + unitThreat(m) * Math.max(0, m.count), 0);
}

export function partyBudget(size: number, level: number): number {
  const s = Math.max(1, Math.floor(size || 0));
  const l = Math.max(1, level || 0);
  return s * (PC_BASE + PC_PER_LEVEL * l);
}

export function difficultyFromRatio(ratio: number): Difficulty {
  if (ratio < 0.5) return "Trivial";
  if (ratio < STANDARD_LOW) return "Easy";
  if (ratio <= STANDARD_HIGH) return "Standard";
  if (ratio <= 1.6) return "Hard";
  return "Deadly";
}

export type EncounterRating = {
  threat: number;
  budget: number;
  ratio: number;
  difficulty: Difficulty;
};

export function rateEncounter(monsters: ThreatMonster[], size: number, level: number): EncounterRating {
  const threat = encounterThreat(monsters);
  const budget = partyBudget(size, level);
  const ratio = budget > 0 ? threat / budget : 0;
  return { threat, budget, ratio, difficulty: difficultyFromRatio(ratio) };
}

export type BandChange = { id: string; name: string; delta: number; resultingCount: number };

export type BandRecommendation = EncounterRating & {
  action: "add" | "remove" | "none";
  /** Per-template count change to land in the Standard band (minimal disruption). */
  changes: BandChange[];
  /** Projected ratio after applying `changes`. */
  projectedRatio: number;
  summary: string;
};

/**
 * Recommend the minimal count change to bring the encounter into the Standard band
 * for the given party. Adds the cheapest (lowest-threat) creature when too weak;
 * trims cheapest-first when too strong, so a boss/strong identity survives where
 * possible. Loops are guarded.
 */
export function recommendAdjustment(monsters: ThreatMonster[], size: number, level: number): BandRecommendation {
  const rating = rateEncounter(monsters, size, level);
  const budget = rating.budget;
  const lowThreat = budget * STANDARD_LOW;
  const highThreat = budget * STANDARD_HIGH;

  const done = (action: BandRecommendation["action"], changes: BandChange[], threat: number, summary: string): BandRecommendation => ({
    ...rating,
    action,
    changes,
    projectedRatio: budget > 0 ? threat / budget : 0,
    summary,
  });

  if (monsters.length === 0) {
    return done("none", [], 0, "No monsters in this encounter yet.");
  }

  // Already in the Standard band → nothing to do.
  if (rating.threat >= lowThreat && rating.threat <= highThreat) {
    return done("none", [], rating.threat, "Already balanced for this party — no change needed.");
  }

  const cheapestWithRoom = (removedSoFar: Record<string, number>, removable: boolean) =>
    [...monsters]
      .sort((a, b) => unitThreat(a) - unitThreat(b))
      .find(m => !removable || (m.count - (removedSoFar[m.id] ?? 0)) > 0);

  // Too weak → ADD cheapest creature until we reach the Standard floor.
  if (rating.threat < lowThreat) {
    const knob = cheapestWithRoom({}, false)!;
    const ut = unitThreat(knob);
    let threat = rating.threat;
    let added = 0;
    while (threat < lowThreat && added < 100) { threat += ut; added += 1; }
    const changes: BandChange[] = [{ id: knob.id, name: knob.name, delta: added, resultingCount: knob.count + added }];
    return done("add", changes, threat, `Add ${added}× ${knob.name} → ${difficultyFromRatio(threat / budget)} (${(threat / budget).toFixed(2)}×).`);
  }

  // Too strong → REMOVE cheapest-first until we reach the Standard ceiling.
  const removed: Record<string, number> = {};
  let threat = rating.threat;
  let guard = 0;
  while (threat > highThreat && guard < 500) {
    guard += 1;
    // Never trim the encounter down to nothing — a lone over-strong creature is a
    // structural problem (HP / party size / level), not a count problem.
    const totalRemaining = monsters.reduce((sum, m) => sum + (m.count - (removed[m.id] ?? 0)), 0);
    if (totalRemaining <= 1) break;
    const knob = cheapestWithRoom(removed, true);
    if (!knob) break; // nothing left to remove
    removed[knob.id] = (removed[knob.id] ?? 0) + 1;
    threat -= unitThreat(knob);
  }
  const changes: BandChange[] = Object.entries(removed).map(([id, n]) => {
    const m = monsters.find(x => x.id === id)!;
    return { id, name: m.name, delta: -n, resultingCount: m.count - n };
  });
  if (changes.length === 0) {
    return done("remove", [], threat, "Over-powered, but it's a single high-threat creature — lower its HP or raise party size/level instead of removing it.");
  }
  const stillOver = threat > highThreat;
  const summary = "Remove " + changes.map(c => `${-c.delta}× ${c.name}`).join(", ") +
    ` → ${difficultyFromRatio(threat / budget)} (${(threat / budget).toFixed(2)}×)` +
    (stillOver ? ". Still above Standard — also lower HP or raise party size/level." : ".");
  return done("remove", changes, threat, summary);
}
