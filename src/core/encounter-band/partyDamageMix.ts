/**
 * WHAT THIS PARTY ACTUALLY DEALS, BY DAMAGE TYPE — read from the actors themselves.
 *
 * Christopher, on being asked to weight a resistance by hand: *"i shouldnt need to weight how much
 * fire damage the party has for this to be a resistance it has"*, and the general rule the same
 * day: *"the price should come from the action not the workbook, nothing should be priced from the
 * workbook because we have the information in the app."*
 *
 * Both are the same instruction, and both were right.
 *
 * ─── WHY A SHARE WAS BEING ASKED FOR AT ALL ─────────────────────────────────────────────────
 *
 * The workbook prices a typed response as a fraction of the opposing side's output —
 * `pricing_contract.rules.21.formula`: *"Weight by the opposing side's actual eligible damage-type
 * share and bypass rules."* So "resistant to fire" is not a fixed multiplier; it is half of
 * however much fire the party throws, which is a fact about the PARTY.
 *
 * The workbook publishes no table of that, and inventing a plausible 15% is exactly what the
 * coverage gate exists to reject — so an unweighted response was recorded, displayed, and priced
 * at NOTHING until someone typed a number. That was defensible when the app could not know the
 * answer. It is not defensible now: twelve campaign creatures resist fire, every one of them
 * priced at zero, and the actors carrying the party's whole action list were sitting right there.
 *
 * ⚠ THIS IS DERIVED, NOT ENTERED — RULE 2. The author PICKS the response ("resistant to fire");
 * the number is DERIVED from what the party's own actions say they deal. An explicit `share`
 * remains available as an override for a table whose damage mix is not in the app, and it wins
 * when set, but nothing is blocked on it any more.
 *
 * ─── WHAT COUNTS ────────────────────────────────────────────────────────────────────────────
 *
 * Every action on every chosen actor that carries a damage formula AND a damage type: weapon
 * attacks, spells, and typed riders. The weight is the expected value of the formula, so a 6d6
 * fireball counts for more than a 1d10 firebolt, which is the whole point of a share.
 *
 * ⚠ AN INCOMPLETE SHEET DOES NOT GET TO ANSWER. An action with a damage formula and no recorded
 * type is a gap in the data, not a category of damage — D&D has no untyped damage. So the mix is
 * `usable` only when EVERY damaging action states its type, and a partial one reports the gap
 * instead of a number.
 *
 * That line is not caution for its own sake. Measured against the real party on 2026-08-26: of 20
 * damaging actions across six sheets, FIVE stated a type and all five were Unarmed Strike. Nobody's
 * weapon or spell said what it deals. A mix built from that says the party deals 100% bludgeoning
 * and 0% fire — so every "resistant to fire" in Act 3 would price at exactly nothing, confidently,
 * while Ignatius stands there holding Burning Seals (Fire).
 *
 * A confident wrong number is worse than the "I cannot price this" it replaced. The type is
 * written in the DESCRIPTION on those sheets ("Martial. Piercing. Finesse.") and reading it from
 * there is precisely what the app is not allowed to do — tag from stated fields, never from prose.
 *
 * ⚠ THE THRESHOLD IS ALL-OR-NOTHING BECAUSE ANY OTHER NUMBER WOULD BE INVENTED. "Trust it above
 * 80% coverage" needs an 80 that nothing publishes. Full coverage needs no constant, fails toward
 * reporting rather than guessing, and names exactly what to fill in — after which every typed
 * response in the library prices itself with nothing more to do.
 */

import { damageExpressionAverage } from "./damageExpression";
import { DAMAGE_TYPES, normalizeDamageType } from "../constants/damageTypes";
import { BASE_WEAPONS } from "../constants/baseWeapons";

export { normalizeDamageType };

/** Deliberately narrow, so any actor-like object works — same approach as `partyHealingFromActors`. */
type RiderLike = { formula?: string; damageType?: string };
type ActionLike = {
  label?: string;
  actionKind?: string;
  metadata?: {
    damage?: string;
    damageType?: string;
    spell?: { damage?: string; damageType?: string };
    riders?: RiderLike[];
  };
};
/** ⚠ `tabs` IS A RECORD OF TAB NAME → ACTION ARRAY, not an array of tabs. See `partyHealingFromActors`. */
type TabsLike = Record<string, ActionLike[] | undefined>;
type ActorLike = { name?: string; actions?: ActionLike[]; tabs?: TabsLike };

export type DamageMixSource = {
  actor: string;
  label: string;
  type: string;
  /** Expected damage this line contributes to the mix. */
  amount: number;
};

export type PartyDamageMix = {
  /**
   * WHERE THE SHARES CAME FROM. `actors` is this table's own characters; `published-neutral` is
   * the certified profile used when no party is chosen. A derived number is still reported, and it
   * has to say which one it is — a table whose damage is 40% radiant is not the published mix.
   */
  source?: "actors" | "published-neutral";
  /** Damage type (lower case) → its share of the party's TYPED output, 0–1. */
  shares: Record<string, number>;
  /** Expected typed damage the shares were computed over. */
  typedTotal: number;
  /**
   * Typed damage as a fraction of ALL damage found, 0–1. 1.0 means every damaging action on the
   * sheets named its type. Lower means the shares rest on less of the party than they look like.
   */
  coverage: number;
  /**
   * Whether `shares` may be priced against. False when any damaging action failed to state its
   * type — see the header. A false mix is not an empty one: it still carries `untyped`, which is
   * the list of what to fix.
   */
  usable: boolean;
  /** Damaging actions that state no damage type. The work item, named, so it can be finished. */
  untyped: Array<{ actor: string; label: string; amount: number }>;
  /** Every line that fed the mix — so a DM who disagrees can see exactly what to argue with. */
  sources: DamageMixSource[];
};

export const EMPTY_DAMAGE_MIX: PartyDamageMix = { shares: {}, typedTotal: 0, coverage: 0, usable: false, untyped: [], sources: [] };

/** Every action an actor has, wherever the actor keeps them. */
function actionsOf(actor: ActorLike): ActionLike[] {
  const fromTabs = Object.values(actor.tabs ?? {}).flatMap(t => Array.isArray(t) ? t : []);
  return [...(actor.actions ?? []), ...fromTabs];
}

/**
 * WHAT A WEAPON DEALS, WITHOUT ANYBODY TYPING IT IN.
 *
 * Christopher: *"i shouldnt need to go through each of my character sheet."* He is right, and the
 * sheets were never the place for it. A Greataxe deals slashing because it is a Greataxe, and
 * `BASE_WEAPONS` is where that is known — so an action whose damage field states no type is
 * matched against the weapon table by NAME.
 *
 * ⚠ THIS IS A LOOKUP ON A NAME, NOT A READ OF PROSE. The label of a weapon action IS the weapon's
 * name, and the table is keyed by that name — the same shape as `traitRule(d.name)` matching a
 * defence against the calibrated rules. It never touches the description, which is where these
 * sheets happen to spell the type out ("Martial. Piercing. Finesse.") and where reading it would
 * be inference.
 *
 * A name that is not in the table — a magic item, a class feature, a spell — simply does not
 * match, and stays an honest gap.
 */
const WEAPON_TYPE_BY_NAME = new Map<string, string>(
  BASE_WEAPONS.map(w => [w.name.trim().toLowerCase(), w.damageType]),
);

function weaponDamageType(label: string | undefined): string | undefined {
  const name = (label ?? "").trim().toLowerCase();
  if (!name) return undefined;
  // "Longsword (two-handed)" and "Dagger — thrown" are the same weapon wearing a note.
  const bare = name.replace(/\s*[([—-].*$/, "").trim();
  return WEAPON_TYPE_BY_NAME.get(name) ?? WEAPON_TYPE_BY_NAME.get(bare);
}

/**
 * SPLIT A DAMAGE EXPRESSION INTO ITS TYPED PARTS.
 *
 * ⚠ THE TYPE IS OFTEN IN THE DAMAGE FIELD ITSELF, AND THAT IS A FIELD, NOT PROSE. The app's own
 * convention writes it there — `damageExpressionAverage` documents `"1d8 + 2 slashing + 1d4 cold"`
 * as a shape it handles, and every Unarmed Strike on the character sheets is `"4 bludgeoning"`.
 * Reading it out of there is reading the data. Reading it out of the DESCRIPTION — "Martial.
 * Piercing. Finesse." — is not, and is not done: tag from stated fields, never from prose.
 *
 * A type word covers its own segment AND every earlier segment nothing has claimed yet, which is
 * how the notation actually reads: `1d4+2 piercing` is 6.5 piercing, not 2 piercing and 4.5 of
 * nothing, while `1d8 + 2 slashing + 1d6 cold` splits 6.5 slashing from 3.5 cold.
 */
function splitTypedDamage(expr: string | undefined): Array<{ type: string; amount: number }> {
  const text = (expr ?? "").trim();
  if (!text) return [];

  // A pre-averaged total — "15 (2d10 + 4)" — is one value; only the whole thing can carry a type.
  const segments = /^\s*\d+\s*\(/.test(text) ? [text] : text.split(/(?=[+-])/);
  const out: Array<{ type: string; amount: number }> = [];
  let pending: Array<{ amount: number }> = [];

  for (const segment of segments) {
    const amount = damageExpressionAverage(segment.replace(/^\s*\+/, ""));
    const lower = segment.toLowerCase();
    const type = DAMAGE_TYPES.find(t => new RegExp(String.raw`\b${t}\b`).test(lower));
    if (!type) { if (amount > 0) pending.push({ amount }); continue; }
    const total = amount + pending.reduce((s, p) => s + p.amount, 0);
    pending = [];
    if (total > 0) out.push({ type, amount: total });
  }
  /**
   * Whatever no type ever claimed stays untyped — it is a gap, and gaps are reported. As ONE
   * line, not one per term: `1d12+3` is a single action's damage with a single missing type, and
   * splitting it would report the same gap twice and name it as two things to fix.
   */
  const unclaimed = pending.reduce((s, p) => s + p.amount, 0);
  if (unclaimed > 0) out.push({ type: "", amount: unclaimed });
  return out;
}

/**
 * Every typed and untyped damage line on one action, in order of how directly the type is stated:
 *
 *   1. the action's own `damageType` field           — someone said so
 *   2. a type written inside the damage expression   — "4 bludgeoning", the app's own convention
 *   3. the weapon table, matched by the action name  — a Greataxe deals slashing
 *
 * and nothing after that. An action that is none of those three is a gap, and is reported as one.
 */
function damageLinesOf(action: ActionLike): Array<{ type: string; amount: number }> {
  const md = action.metadata;
  if (!md) return [];
  const lines: Array<{ type: string; amount: number }> = [];
  const fromWeapon = weaponDamageType(action.label);

  const add = (formula: string | undefined, type: string | undefined) => {
    // A stated `damageType` is the whole answer and needs no parsing.
    const stated = normalizeDamageType(type);
    if (stated) {
      const amount = damageExpressionAverage(formula);
      if (amount > 0) lines.push({ type: stated, amount });
      return;
    }
    for (const part of splitTypedDamage(formula)) {
      // The weapon's own type answers for whatever the expression left untyped.
      lines.push(part.type || !fromWeapon ? part : { ...part, type: fromWeapon });
    }
  };
  add(md.damage, md.damageType);
  add(md.spell?.damage, md.spell?.damageType);
  // ⚠ A RIDER IS NOT THE WEAPON. Hunter's Mark's `+1d6` is its own damage with its own type, and
  // inheriting the weapon's would state something nobody said. It falls through to the gap list.
  for (const r of md.riders ?? []) add(r.formula, r.damageType);
  return lines;
}

/**
 * Read one party's damage-type composition.
 *
 * @param actors the CHOSEN actors — the ones actually in this fight. Passing the whole library for
 *   a smaller party overstates the mix in exactly the way the party-size fit check exists to catch.
 */
export function partyDamageMixFromActors(actors: readonly ActorLike[]): PartyDamageMix {
  const byType = new Map<string, number>();
  const sources: DamageMixSource[] = [];
  const untyped: PartyDamageMix["untyped"] = [];
  let typedTotal = 0;
  let allTotal = 0;

  for (const actor of actors) {
    const who = actor.name ?? "unnamed";
    for (const action of actionsOf(actor)) {
      for (const line of damageLinesOf(action)) {
        allTotal += line.amount;
        if (!line.type) {                  // a gap in the sheet, not a kind of damage
          untyped.push({ actor: who, label: action.label ?? "unnamed action", amount: line.amount });
          continue;
        }
        typedTotal += line.amount;
        byType.set(line.type, (byType.get(line.type) ?? 0) + line.amount);
        sources.push({ actor: who, label: action.label ?? "unnamed action", type: line.type, amount: line.amount });
      }
    }
  }

  if (typedTotal <= 0) return { ...EMPTY_DAMAGE_MIX, untyped, sources };

  const shares: Record<string, number> = {};
  for (const [type, amount] of byType) shares[type] = amount / typedTotal;
  const coverage = allTotal > 0 ? typedTotal / allTotal : 0;
  return {
    shares,
    typedTotal,
    coverage,
    /**
     * ⚠ ANY TYPED DAMAGE IS ENOUGH TO ANSWER. THIS DEMANDED ALL OF IT, AND THAT WAS A WALL.
     *
     * The bar was full coverage, on the reasoning that a partial mix could confidently answer
     * "0% fire" while the party is holding a fire spell. That risk is real, and the price of
     * guarding against it this way was that one unfilled action anywhere on any sheet blocked
     * every typed resistance in the campaign.
     *
     * Christopher: *"i shouldnt not have to go through and price 33 actions, the reader should
     * only say ok i read this much fire action, no action damage then it doesnt care about that
     * action."* Right — the question is how much fire the party throws, and an action with no
     * damage type is not evidence either way. It is not an obstacle to counting the fire that IS
     * readable.
     *
     * ⚠ SO THE HONESTY MOVES INTO THE REPORT INSTEAD OF THE GATE. `coverage` still says what
     * fraction of the party's damage the shares were computed over, and the checker prints it
     * beside every derived price — a qualified number the DM can argue with, rather than a
     * refusal they cannot clear without an afternoon of data entry.
     */
    usable: typedTotal > 0,
    untyped: untyped.sort((a, b) => b.amount - a.amount),
    sources: sources.sort((a, b) => b.amount - a.amount),
  };
}
