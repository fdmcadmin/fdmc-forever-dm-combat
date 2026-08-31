/**
 * PARTY FEATS — read off the characters themselves, priced onto the encounter's own lines.
 *
 * Christopher: *"the feats should show next to the dpr as a increase or in the healing if it
 * increases sustain above the party line"*, and *"i didnt ask for a new party estimator (this was
 * never in the build design)."*
 *
 * ⚠ SO THERE IS NO SEPARATE PANEL AND NO SEPARATE FEAT LIST. An earlier pass built both — a Party
 * Estimator with its own DM-entered feat selection — which was scope nobody asked for and a second
 * place for the same fact to live. Feats are on the CHARACTER; this reads them from there.
 *
 * ── ⚠ AC AND HP ARE NOT RECALCULATED, DELIBERATELY ──────────────────────────────────────────
 * Christopher: *"the things like increased ac and increase hp [...] shouldnt need to be calc by the
 * app since HP is entered by the DM or player who is creating/editing the card."*
 *
 * He is right, and the workbook already agrees: *"Do not re-add static ASI, attack bonus, AC, save,
 * or max-HP benefits already present on the character"*, with the expressions guarding themselves —
 * Tough reads `resolvedMaxHp ? 0 : 2*level`. A sheet in this app is FINAL, so every `resolved*` flag
 * below is true and every static benefit prices at zero.
 *
 * What survives that guard is exactly what the encounter lines want: damage the character adds, and
 * healing they bring to the party. Nothing else is double counted because nothing else is counted.
 *
 * ── WHICH TAB ───────────────────────────────────────────────────────────────────────────────
 * Both. `deriveActorStats` already reads `feats` and `features` together with the note that
 * *"`features` is being retired into `feats`"*, and a reader that picked one would disagree with the
 * stat derivation on any character mid-migration.
 */

import { priceFeats, type PartyFeatTotals } from "./featEvaluator";
import { featPricing } from "./featPricing.generated";
import { featContextFromActor, type ActorLikeForFeats } from "./featContextFromActor";

type Entry = { label?: string; description?: string };
type ActorLike = {
  name?: string;
  level?: number;
  tabs?: Record<string, Entry[] | undefined>;
};

export type PartyFeatContribution = {
  /** Added party DPR. Shown beside the party's own DPR line. */
  dpr: number;
  /** Added party-wide sustain — healing and shared prevention. Shown beside sustain. */
  partyEhp: number;
  /** Feat names that matched the workbook, per character. */
  matched: Array<{ actor: string; feats: string[] }>;
  /** Entries on a feats/features tab that are not feats in the workbook. Not an error. */
  unmatched: string[];
  /** Channels that could not be priced, each naming the character it belongs to. */
  needsInput: Array<PartyFeatTotals["needsInput"][number] & { actor: string }>;
};

/**
 * Every entry on a character's feat-bearing tabs, ONCE.
 *
 * ⚠ THE SAME FEAT ON BOTH TABS WAS PRICED TWICE. This reads `feats` and `features` together
 * because `deriveActorStats` does and a reader that picked one would disagree with it mid-
 * migration — but concatenating them means a character carrying "Shield Master" on both tabs got
 * its DPR and its needs-input line counted twice over. It showed as a duplicate row in the panel's
 * tooltip, which is the visible half; the invisible half was a double-counted total.
 *
 * Deduped case-insensitively, since the two tabs are hand-entered and need not agree on casing.
 */
function featEntries(actor: ActorLike): string[] {
  const tabs = actor.tabs ?? {};
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of [...(tabs.feats ?? []), ...(tabs.features ?? [])]) {
    const label = (e?.label ?? "").trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
}

/**
 * Price the party's feats onto the two lines the encounter panel already shows.
 *
 * ⚠ ONLY WHAT THE APP ACTUALLY KNOWS GOES IN THE CONTEXT. level, PB and party size are real;
 * accuracy inputs belong to one attack against one enemy and are absent, so any feat needing them
 * reports NEEDS_INPUT rather than being priced off a plausible-looking guess.
 */
/**
 * @param known values the app genuinely has. `baseDpr` and `baseEhp` come from the resolved party
 *              profile, so feats expressed as a share of party output (Alert, Musician) can price
 *              instead of asking for a number the panel is already showing.
 */
export function partyFeatsFromActors(
  actors: unknown[],
  /**
   * ⚠ `targetAC` AND `saveExposure` ARE WHAT THIS FUNCTION WAS MISSING ENTIRELY.
   *
   * Its context was level, PB, party size, round and the two party totals — no equipment, no
   * weapon, no enemy. So `shieldEquipped`, `hitChance`, `perHitDamage` and `onceHit` could never
   * arrive and Shield Master and Great Weapon Master reported NEEDS_INPUT forever, no matter what
   * the character was holding. Deriving a shield's SLOT correctly (0.8.10) was a prerequisite for
   * this and not a substitute for it.
   *
   * Both come from the fight the panel is already showing. See `incomingSaveExposure`.
   */
  known: {
    baseDpr?: number;
    baseEhp?: number;
    targetAC?: number;
    saveExposure?: Partial<Record<"str" | "dex" | "con" | "int" | "wis" | "cha", number>>;
  } = {},
): PartyFeatContribution {
  const party = (actors as ActorLike[]).filter(Boolean);
  const out: PartyFeatContribution = { dpr: 0, partyEhp: 0, matched: [], unmatched: [], needsInput: [] };

  for (const actor of party) {
    const entries = featEntries(actor);
    if (entries.length === 0) continue;

    // Only entries the workbook knows are feats. A class feature on the same tab is not one.
    const knownFeats = entries.filter(e => featPricing(e));
    for (const e of entries) if (!featPricing(e)) out.unmatched.push(e);
    if (knownFeats.length === 0) continue;

    const level = actor.level ?? 1;
    const totals = priceFeats(knownFeats, {
      level,
      PB: Math.floor((level - 1) / 4) + 2,
      partySize: party.length,
      round: 1,
      ...(known.baseDpr !== undefined ? { baseDpr: known.baseDpr } : {}),
      ...(known.baseEhp !== undefined ? { baseEhp: known.baseEhp } : {}),
      /**
       * ⚠ THE SHEET IS FINAL. Every static benefit is already inside the entered AC, HP, attack
       * bonus and saves, so the expressions' own guards return zero for them. This is the line
       * that stops the app recalculating what a DM typed in.
       */
      resolvedMaxHp: true,
      resolvedAC: true,
      resolvedAttackBonus: true,
      resolvedSaves: true,
      resolvedAttackPackets: true,

      /**
       * What this character is holding and what it is swinging at. Keys are omitted rather than
       * defaulted when they cannot be read, so a sheet with no readable weapon still reports
       * NEEDS_INPUT instead of pricing off a zero.
       */
      ...featContextFromActor(actor as ActorLikeForFeats, known.targetAC),
      ...(known.saveExposure?.dex !== undefined ? { DexSaveExposure: known.saveExposure.dex } : {}),
    });

    out.dpr += totals.dpr;
    out.partyEhp += totals.partyEhp;
    // ⚠ NAMED. Two characters with the same feat produced two identical lines with nothing to tell
    // them apart, so the panel read as a duplicate rather than as two people.
    out.needsInput.push(...totals.needsInput.map(n => ({ ...n, actor: actor.name ?? "Unnamed" })));
    out.matched.push({ actor: actor.name ?? "Unnamed", feats: totals.priced.map(p => p.name) });
  }

  return out;
}
