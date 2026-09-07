/**
 * WHAT THIS PARTY CAN HEAL, READ FROM THE ACTORS THEMSELVES.
 *
 * Christopher: *"the app encounter checker should be able to read current actors and then use the
 * derived slot count and built in actions such as class actions and say ok this party's sustain
 * is +X."*
 *
 * ─── WHY THIS GAP EXISTS AT ALL ─────────────────────────────────────────────────────────────
 *
 * The party curve is the 128-party field, and the v9 run's methods sheet says exactly what that
 * field could not do — flagged BLOCKER, not implemented:
 *
 *     "Class healing — No invented healing or revival package was assigned to abstract parties.
 *      Class/subclass identities absent from 128 source profiles. Full sequential completion is
 *      not certifiable."
 *
 * The field knows the party HAS slots; it cannot know any of them could be Cure Wounds, because
 * it does not know anyone is a Paladin. So `sustain` inherits that hole, and every party clock
 * reading has been high by whatever the party can actually heal.
 *
 * We are not an abstract party. The actors are right there.
 *
 * ─── ⚠ WHAT COUNTS, AND WHAT DELIBERATELY DOES NOT ──────────────────────────────────────────
 *
 * The workbook's `healing` primitive: *"Expected usable SAME-ENCOUNTER healing, capped by missing
 * HP/overheal and action/resource availability."* Three things fall out of that wording:
 *
 *   COUNTED — a flat HP pool that exists only to heal. Lay on Hands is the case: a pool of 5 x
 *   level that can do nothing else, so it is not a slot already counted as damage in the curve.
 *   It is additive, and it is the one clean omission.
 *
 *   NOT COUNTED — HIT DICE. They are spent on a SHORT REST, not in the encounter, so they are not
 *   same-encounter healing. They are already modelled: `SHORT_REST_RECOVERY` is published and the
 *   act run applies it between fights. Counting them here would charge the same recovery twice.
 *
 *   NOT COUNTED — CURE WOUNDS AND FRIENDS. A Ranger's or Artificer's slots are ALREADY in the DPR
 *   curve. Spending one on healing converts damage into healing; it is a TRADE, not extra
 *   capacity, and that is precisely what "capped by action/resource availability" means. Adding
 *   it would count the same slot on both sides of the fight.
 *
 * ⚠ EVERY POOL IS REPORTED WITH THE ACTOR AND THE LINE IT WAS READ FROM. This reads a resource's
 * own stated description, which is prose, so nothing is allowed to be silent about it: the panel
 * prints the source of every point it adds, and a DM who disagrees can see exactly which pool to
 * argue with.
 */

/** The shape this needs off an actor — deliberately narrow, so any actor-like object works. */
type ResourceLike = {
  label?: string;
  description?: string;
  actionKind?: string;
  metadata?: { additive?: string; resourceKind?: string; cost?: string; details?: string };
};
/**
 * ⚠ `tabs` IS A RECORD OF TAB NAME → ACTION ARRAY. Not an array of tabs, and not `{ actions }`
 * either — `tabs.resources` IS the array. Both wrong guesses were made before reading a real
 * character, and each silently returned zero pools rather than failing, which is the worse
 * outcome: a party with two paladins read as having no healing at all.
 */
type TabsLike = Record<string, ResourceLike[] | undefined>;
type ActorLike = { name?: string; actions?: ResourceLike[]; tabs?: TabsLike };

export type HealingSource = {
  actor: string;
  label: string;
  /** Points of same-encounter healing this pool carries. */
  amount: number;
  /** The phrase in the resource's own description that identified it. Shown to the DM. */
  evidence: string;
};

export type PartyHealing = {
  total: number;
  sources: HealingSource[];
  /** Pools that look like healing but are deliberately excluded, and why. Shown, not hidden. */
  excluded: Array<{ actor: string; label: string; reason: string }>;
};

/** Every resource on an actor, wherever the actor keeps them. */
function resourcesOf(actor: ActorLike): ResourceLike[] {
  const fromTabs = Object.values(actor.tabs ?? {}).flatMap(t => Array.isArray(t) ? t : []);
  return [...(actor.actions ?? []), ...fromTabs].filter(a => a?.actionKind === "resource");
}

/**
 * Read one party's same-encounter healing capacity.
 *
 * @param actors the party as the app currently holds it
 */
export function partyHealingFromActors(actors: ActorLike[]): PartyHealing {
  const sources: HealingSource[] = [];
  const excluded: PartyHealing["excluded"] = [];
  const seen = new Set<string>();

  for (const actor of actors) {
    const who = actor.name ?? "unnamed";
    for (const r of resourcesOf(actor)) {
      const kind = r.metadata?.resourceKind;
      if (kind !== "pool") continue;                       // slots are damage, and already counted
      const label = r.label ?? "";
      const text = `${label} ${r.description ?? r.metadata?.details ?? ""}`.toLowerCase();
      if (!/\bheal/.test(text)) continue;                  // the pool says nothing about healing

      // A pool spent on a rest is not same-encounter healing, and short rests are already priced.
      if (/hit die|hit dice/.test(text) || /short rest to heal/.test(text)) {
        excluded.push({ actor: who, label, reason: "Hit Dice are spent on a short rest, not in the fight — already counted by the published short-rest recovery." });
        continue;
      }

      const amount = Number(r.metadata?.additive ?? 0);
      if (!Number.isFinite(amount) || amount <= 0) {
        excluded.push({ actor: who, label, reason: "No readable pool size, so it contributes nothing rather than a guess." });
        continue;
      }
      /**
       * ⚠ THE POOL MUST BE DENOMINATED IN HIT POINTS. Lay on Hands is "5 HP / Long Rest" and its
       * max IS the healing. A pool of USES — three castings of something — is a different unit,
       * and treating a 3 as 3 HP would be nonsense. Only a pool that says HP is read as HP.
       */
      /**
       * WARNING: "HEALING POINTS" IS A HIT POINT, AND THIS DID NOT KNOW THE WORD.
       *
       * The test accepted only "hp" and "hit points". Lay on Hands is authored as
       * "25 healing points / Long Rest" - the one pool this whole reader was written for - so the
       * Paladin was excluded as "counted in uses, not hit points" and the party healing total came
       * out at exactly 0. Christopher: *"the healing and stuff like that from the screenshots
       * should move the current numbers if they were already counted right?"* It should have;
       * nothing was reaching the total to move it.
       *
       * WARNING: "POINTS" ALONE STAYS OUT. Ki, sorcery and psi points are pools of USES, and
       * reading a 5 as 5 HP would be nonsense - which is what this guard exists to stop. Only the
       * phrase that says the points ARE healing is added.
       */
      if (!/\bhp\b|hit points|healing points?/.test(text)) {
        excluded.push({ actor: who, label, reason: "The pool heals but is counted in uses, not hit points — its size cannot be read as HP." });
        continue;
      }

      const key = `${who}|${label}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const evidence = (r.description ?? r.metadata?.details ?? "").slice(0, 60).trim();
      sources.push({ actor: who, label, amount, evidence });
    }
  }

  return { total: sources.reduce((s, x) => s + x.amount, 0), sources, excluded };
}
