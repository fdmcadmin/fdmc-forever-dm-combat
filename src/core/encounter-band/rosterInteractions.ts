/**
 * THE ROSTER PASS — what one creature's action does to the OTHER creatures in the fight.
 *
 * Christopher, 2026-09-13: *"why can we price aoe spells that do damage but not aoe spells that buff
 * and hinder."* Every creature was priced alone, so an action whose value lands on an ally had no
 * step in which to be priced, and read 0. The v4 Roster Interaction workbook states the rule:
 *
 *   Act3 Pricing Readme r19  "Effects that change another creature's attacks, saves, target
 *                             assignment, or survival are priced only after the encounter roster is
 *                             assembled. They never become a flat multiplier on the source body."
 *   Runtime Contract r24     "A creature-level 0 or x1.000 is not a priced answer."
 *
 * ── WINTER'S TOLL + CRUEL INSTRUCTION (Act3 Roster Interactions, A3F7) ───────────────────────────
 *
 * *"Existing hit-chance formula, +3 attack modifier, half-roster coverage, Harrow Action replacement,
 * best-ally extra attack."* The workbook's burden cells are typed values, so the formula was recovered
 * from them and reproduces all four to the last digit (WOTC 13.500234375 / 16.937734375, BC
 * 13.437890625 / 16.812890625 — asserted by `check:rosterinteractions`):
 *
 *   burden(round) = coverage × Σ allies (routine at +N − routine)          the zone's offence
 *                 + best ally's one normal attack at +N                     Cruel Instruction
 *                 − the source's own Action damage × (1 in round 1, 1/duration after)
 *
 *   coverage = (roster bodies / 2) / allied attack bodies, capped at 1 — "1.5 of the two eligible
 *   allied attack bodies in expectation". The half-roster convention, NOT floored: the workbook's 1.5.
 *
 * The routine at +N is the ally's own trace against AC − N, so every attack the trace schedules —
 * riders, reactions that make attacks, setups — gains exactly what +N gives it, clamps and all.
 *
 * ⚠ THE OTHER HALF IS NOT IN THIS NUMBER, AND SAYS SO. *"Affected hostile attack/save events must be
 * recomputed separately; never hidden in creature HP."* The −3 on the party's attacks and saves is a
 * defence EVENT; the checker has no per-attack event layer, and the workbook's own adjusted DPR leaves
 * it out too. It is reported on the roster line, not silently dropped.
 *
 * ── COMMANDING PRESENCE (A3F8) ──────────────────────────────────────────────────────────────────
 *
 * *"No EHP multiplier. The effect preserves Reaver/Breaker by changing kill order while Knight is
 * legal. Use the existing kill-order/body-timing model."* The roster IS kill-priority order
 * (`prepareRoster`), so the creature moves to the front of it. The whole-body attrition that follows
 * prices the rest: its allies live longer, and keep dealing damage longer.
 *
 * ── COLD COUNSEL (A3F7) ─────────────────────────────────────────────────────────────────────────
 *
 * *"ROSTER EVENT REQUIRED … Never silently treat this as zero."* Burden 0 in the workbook, pending a
 * target-event resolver the checker does not have. Named on the roster line for exactly that reason.
 */

import type { MainMonsterTemplate } from "../monsters/runtime/mainMonsterRuntime";
import { sameActionName, type RosterInteraction } from "../monsters/rosterInteraction";
import { riderWeight } from "../monsters/monsterRider";
import { parseCreature, type ParsedCreature } from "./parseCreature";
import { traceCreature } from "./actionTrace";
import { resolveFeature, expectedDamageForFeature, type ParsedFeature } from "./featureResolver";
import { damageExpressionAverage } from "./damageExpression";
import type { RosterGroup } from "./checkerV2";

type Target = Parameters<typeof traceCreature>[1];
type Zone = Extract<RosterInteraction, { kind: "roll_modifier_zone" }>;

export type InteractionEntry = {
  /** The roster group id — a creature's templateId. */
  id: string;
  name: string;
  template: MainMonsterTemplate;
  quantity: number;
  initiativeMod?: number;
};

export type InteractionAssumption = { creature: string; flag: "NEEDS DM INPUT" | "ESTIMATED"; field: string; detail: string };

export type ZoneBurden = {
  source: string;
  zone: string;
  extraAttackName?: string;
  coverage: number;
  eligibleBodies: number;
  /** Per round 1..4+: the zone's offence on the allies it covers. */
  allyGain: number[];
  /** Per round: the best ally's extra attack. */
  extraAttack?: number[];
  extraAttackFrom?: string;
  /** Per round: what the source gives up of its own Action to keep the zone up. */
  actionGivenUp: number[];
  /** Per round: the burden added to the encounter. */
  burden: number[];
};

export type RosterInteractionResult = {
  /** Bodiless rows carrying the added burden, each ending with its source. */
  rows: RosterGroup[];
  /** Group ids that must lead the kill order — a PASSIVE forced target. */
  killOrderFirst: string[];
  /** Groups a forced-target REACTION sends party Actions to, once a round. */
  redirects: { id: string; actionsPerRound: number }[];
  assumptions: InteractionAssumption[];
  burdens: ZoneBurden[];
};

const ROUNDS = [0, 1, 2, 3] as const;

/** An attack roll this creature actually makes — what a +N to attack rolls can move. */
function makesAttackRolls(parsed: ParsedCreature): boolean {
  return parsed.features.some(f => f.attackBonus !== undefined && !f.gated && f.activationType !== "trait");
}

/** "One normal attack": an Action attack that is not a spell, a recharge or a limited use. */
function isNormalAttack(f: ParsedFeature): boolean {
  return f.activationType === "action" && f.attackBonus !== undefined && !f.gated
    && f.spellSlotLevel === undefined && !f.recharge && f.uses === undefined;
}

function bestSingleAttack(parsed: ParsedCreature, target: Target): { name: string; value: number } | undefined {
  let best: { name: string; value: number } | undefined;
  for (const f of parsed.features) {
    if (!isNormalAttack(f)) continue;
    const resolved = resolveFeature(f, { recordedDefences: parsed.recordedDefences });
    const { expected } = expectedDamageForFeature(resolved, f, target);
    const hit = Math.min(0.95, Math.max(0.05, (21 + (f.attackBonus as number) - target.ac) / 20));
    // A per-hit rider rides this attack; a once-per-turn one belongs to the turn, not to one swing.
    const perHit = (f.riders ?? []).filter(r => r.cadence === "per-hit")
      .reduce((sum, r) => sum + damageExpressionAverage(r.damage) * riderWeight(r, hit, 1), 0);
    const value = expected + perHit;
    if (!best || value > best.value) best = { name: f.name, value };
  }
  return best;
}

function roundTotals(parsed: ParsedCreature, target: Target): number[] {
  const rounds = traceCreature(parsed, target, 4).rounds;
  return ROUNDS.map(i => rounds[i]?.totalExpectedDamage ?? rounds[rounds.length - 1]?.totalExpectedDamage ?? 0);
}

export function rosterInteractions(entries: readonly InteractionEntry[], target: Target): RosterInteractionResult {
  const out: RosterInteractionResult = { rows: [], killOrderFirst: [], redirects: [], assumptions: [], burdens: [] };
  const live = entries.filter(e => Number(e.quantity) > 0);
  // An interaction needs somebody to interact WITH. A creature priced alone keeps its own numbers.
  if (live.length < 2) return out;

  const all = live.map(entry => ({ entry, parsed: parseCreature(entry.template) }));
  const rosterBodies = live.reduce((sum, e) => sum + Number(e.quantity), 0);
  const note = (creature: string, flag: InteractionAssumption["flag"], detail: string) =>
    out.assumptions.push({ creature, flag, field: "roster", detail });

  for (const source of all) {
    const { entry, parsed } = source;
    const withInteraction = parsed.features.filter(f => f.rosterInteraction);
    if (withInteraction.length === 0) continue;
    const of = (kind: RosterInteraction["kind"]) => withInteraction.filter(f => f.rosterInteraction?.kind === kind);

    // ── forced target order ────────────────────────────────────────────────────────────────
    /**
     * ⚠ A REACTION IS ONCE A ROUND, AND THAT IS THE DIFFERENCE BETWEEN THE TWO BRANCHES.
     *
     * Christopher: *"it should be once per turn, not a constant passive, so the read is still a
     * reaction."* A PASSIVE forced target (a trait) sends every creature-targeting Action at it, so it
     * leads the kill order. A REACTION spends the creature's one Reaction to redirect ONE Action a
     * round — one PC's share of the party's damage goes into it, and the rest follows the order.
     */
    const forced = of("forced_target_order")[0];
    if (forced) {
      const persistent = forced.activationType === "trait" || forced.activationType === "free";
      if (persistent) {
        out.killOrderFirst.push(entry.id);
        note(entry.name, "ESTIMATED",
          `${forced.name}: ${entry.name} is first in the kill order — every creature-targeting Action must target it while it is legal, so its allies stay up longer. No EHP multiplier; area and point effects keep their own targeting.`);
      } else {
        const size = Math.max(1, Math.round(Number(target.partySize ?? 4)));
        out.redirects.push({ id: entry.id, actionsPerRound: 1 });
        note(entry.name, "ESTIMATED",
          `${forced.name} (once a round): one party Action each round must target ${entry.name} while it stands — 1 of ${size} PCs' damage goes into it before the kill order, so its allies are reached later. No EHP multiplier.`);
      }
    }

    // ── a zone, and an extra attack from an ally ───────────────────────────────────────────
    const zones = of("roll_modifier_zone");
    const zoneF = zones[0];
    const extraF = of("ally_extra_attack")[0];
    if (zones.length > 1) {
      note(entry.name, "ESTIMATED", `"${zoneF.name}" is authored ${zones.length} times on ${entry.name}; it is priced once.`);
    }

    if (zoneF || extraF) {
      const zone = zoneF?.rosterInteraction as Zone | undefined;
      const allies = all.filter(a => a !== source && makesAttackRolls(a.parsed));
      const eligibleBodies = allies.reduce((sum, a) => sum + Number(a.entry.quantity), 0);
      const allyAttack = Number(zone?.allyAttack ?? 0);
      const duration = Math.max(1, Math.round(Number(zone?.durationRounds ?? 1)));
      const coverage = zone && eligibleBodies > 0 ? Math.min(1, (rosterBodies / 2) / eligibleBodies) : 0;
      const shifted: Target = { ...target, ac: target.ac - allyAttack };

      const allyGain = ROUNDS.map(() => 0);
      if (zone && allyAttack !== 0) {
        for (const ally of allies) {
          const base = roundTotals(ally.parsed, target);
          const boosted = roundTotals(ally.parsed, shifted);
          for (const i of ROUNDS) allyGain[i] += coverage * Number(ally.entry.quantity) * (boosted[i] - base[i]);
        }
      }

      let extraAttack: number[] | undefined;
      let extraAttackFrom: string | undefined;
      if (extraF) {
        const required = (extraF.rosterInteraction as { requiresZone?: string }).requiresZone;
        if (required && !(zoneF && sameActionName(required, zoneF.name))) {
          note(entry.name, "NEEDS DM INPUT",
            `${extraF.name} needs an ally inside "${required}", but ${entry.name} has no zone action by that name.`);
        } else {
          const against = required ? shifted : target;
          let best: { name: string; value: number; who: string } | undefined;
          for (const ally of allies) {
            const attack = bestSingleAttack(ally.parsed, against);
            if (attack && (!best || attack.value > best.value)) best = { ...attack, who: ally.entry.name };
          }
          if (best) {
            extraAttack = ROUNDS.map(() => best!.value);
            extraAttackFrom = `${best.who}'s ${best.name}`;
          }
        }
      }

      // Keeping the zone up costs the source its Action: all of round 1, then once per `duration`.
      const sourceRounds = traceCreature(parsed, target, 4).rounds;
      const actionGivenUp = ROUNDS.map(i => {
        if (!zoneF || zoneF.activationType !== "action") return 0;
        const own = (sourceRounds[i] ?? sourceRounds[sourceRounds.length - 1])?.scheduled ?? [];
        const actionDamage = own.filter(s => s.channel === "action").reduce((sum, s) => sum + s.expectedDamage, 0);
        return actionDamage * (i === 0 ? 1 : 1 / duration);
      });

      const burden = ROUNDS.map(i => Math.max(0, allyGain[i] + (extraAttack?.[i] ?? 0) - actionGivenUp[i]));
      const label = [zoneF?.name, extraF?.name].filter(Boolean).join(" + ");
      out.burdens.push({
        source: entry.name, zone: zoneF?.name ?? "", extraAttackName: extraF?.name, coverage, eligibleBodies,
        allyGain, extraAttack, extraAttackFrom, actionGivenUp, burden,
      });

      if (burden.some(b => b > 0)) {
        out.rows.push({
          id: `${entry.id}:roster`,
          name: `${entry.name} — ${label} (on its allies)`,
          quantity: 1,
          baseHp: 0,
          bodiless: true,
          acMultiplier: 1,
          traitFactors: [],
          dpr: { round1: burden[0], round2: burden[1], round3: burden[2], round4Plus: burden[3] },
          damageUptime: 1,
          arrivesRound: 1,
          // The zone ends when its source is Incapacitated — the roster's nearest statement of that.
          endsWithGroupId: entry.id,
          initiativeMod: entry.initiativeMod,
        });
      }

      const pct = (x: number) => `${Math.round(x * 100)}%`;
      const parts = [
        zone && allyAttack !== 0
          ? `${allyAttack > 0 ? "+" : ""}${allyAttack} to hit for ${pct(coverage)} of ${eligibleBodies} allied attack bod${eligibleBodies === 1 ? "y" : "ies"} (+${allyGain[1].toFixed(1)})`
          : undefined,
        extraAttack ? `${extraAttackFrom} as the extra attack (+${extraAttack[1].toFixed(1)})` : undefined,
        actionGivenUp[0] > 0 ? `less ${actionGivenUp[0].toFixed(1)} of ${entry.name}'s own Action in round 1, ${actionGivenUp[1].toFixed(1)} after` : undefined,
      ].filter(Boolean);
      const unresolved = zone && (zone.hostileAttack || zone.hostileSave || zone.allySave)
        ? ` Not in this number: ${[zone.allySave ? `${zone.allySave > 0 ? "+" : ""}${zone.allySave} to allies' saves` : "", zone.hostileAttack ? `${zone.hostileAttack} to hostile attacks` : "", zone.hostileSave ? `${zone.hostileSave} to hostile saves` : ""].filter(Boolean).join(", ")} — defence events the checker does not resolve yet.`
        : "";
      note(entry.name, "ESTIMATED",
        `${label}: +${burden[0].toFixed(1)} damage in round 1, +${burden[1].toFixed(1)} a round after — ${parts.join("; ") || "nothing it can add"}.${unresolved}`);
    }

    // ── target substitution — a target event, named rather than priced ─────────────────────
    for (const sub of of("target_substitution")) {
      const required = (sub.rosterInteraction as { requiresZone?: string }).requiresZone;
      note(entry.name, "ESTIMATED",
        `${sub.name}: moves a targeted ally${required ? ` inside ${required}` : ""} and re-checks the attack's target — a target event the checker does not resolve yet. The workbook publishes no numeric burden for it.`);
    }
  }
  return out;
}
