/**
 * EncounterDifficultyPanel — the encounter checker, running the WORKBOOK's model.
 *
 * This is `simulateEncounter` from `checkerV2.ts` (a verified port of the workbook's own
 * reference runtime, 11/11 of its tests green) driven by app data. It replaced the previous
 * model wholesale — Christopher, 2026-08-14: *"why is the old model a thing still, this
 * replaces the checker wholesale."* Nothing here computes balance arithmetic of its own.
 *
 * The two DM inputs that matter most:
 *  · EQUIPMENT MODE — turning the Broken Chain campaign OFF is a first-class feature, because
 *    the campaign curve has its projected loot distribution baked in. A table not running the
 *    campaign gets `wotcStandard`: the generalized four-player progression, no assumed magic
 *    items, Convergence ignored.
 *  · DAMAGE ALLOCATION — focus fire or spread evenly. The contract is explicit that survivor
 *    counts are MODEL PROJECTIONS under the selected allocation, not observed outcomes.
 *
 * Any creature works. The roster adapter does not care whether a creature is SRD, Broken Chain,
 * or a DM's own homebrew — same arithmetic, same outputs.
 */

import { useMemo, useState } from "react";
import type { EncounterDefinition } from "../monsters/encounterLibrary";
import type { MainMonsterTemplate } from "../monsters/runtime/mainMonsterRuntime";
import type { TemplateBodyChoice } from "../monsters/encounterLibrary";
import {
  simulateEncounter, resolvePartyProfile, effectiveHpPerBody,
  type DamageAllocation, type EncounterResult,
  bondArrangement,
} from "./checkerV2";
import {
  GENERIC_CHECKER_LEVELS, isProjectedLevel, partySizeHpMultiplier,
  type PartyEquipmentMode,
} from "./partyCurveV2";
import { rosterFromTemplates } from "./rosterFromLibrary";
import { partyDefenceAt } from "./partyDefenceCurve";
import { partyHealingFromActors } from "./partyHealingFromActors";
import { partyBenchmark } from "./partyBenchmark";
import { resourceLedgerFromActors, RESOURCE_DAY } from "./resourceLedger";
import { currentPartyMetrics, targetFromRoster } from "./currentPartyResolver";
import { BROKEN_CHAIN_BOND_TEMPLATES } from "../../modules/the-broken-chain/content/bondTemplates";
import { classResourceLean } from "../../modules/dnd-5e/casterLean";
import { bondTemplateForActor } from "../rules/bondProgress";
import { parseCreature } from "./parseCreature";
import { traceCreature } from "./actionTrace";
import { partyDefenceFromActors } from "./partyDefenceFromActors";
import { partyBondMitigationFromActors } from "../../modules/the-broken-chain/bondMitigationFromActors";
import { partyMitigationFromActors, rosterDamageMix } from "./partyMitigationFromActors";
import { partyFeatsFromActors } from "../../modules/dnd-5e/featsFromActors";
import { slotCapabilityFromActors } from "../../modules/dnd-5e/slotCapability";
import { incomingSaveExposure, meanTargetAc } from "./incomingSaveExposure";
import { parseAttackBonus } from "./parseCreature";
import { attackHitProbability } from "./checkerV2";
import { attackProfile } from "../../modules/dnd-5e/featContextFromActor";
import { partyDamageMixFromActors, EMPTY_DAMAGE_MIX } from "./partyDamageMix";

const PARTY_SIZES = [3, 4, 5, 6] as const;
const MODES: { id: PartyEquipmentMode; label: string; blurb: string }[] = [
  { id: "wotcStandard", label: "Standard", blurb: "Generic 4-player progression. No assumed magic items; Convergence ignored. Use this when the table is not running The Broken Chain." },
  { id: "brokenChain", label: "Broken Chain", blurb: "Campaign gear overlay included — the projected campaign loot distribution is part of this curve." },
];
const ALLOCATIONS: { id: DamageAllocation; label: string; blurb: string }[] = [
  { id: "focus_fire", label: "Focus fire", blurb: "Sequential damage packing against equal per-PC pools. Projects the MOST individual downs for a given damage total." },
  { id: "spread_evenly", label: "Spread evenly", blurb: "Even allocation across equal per-PC pools. Every standing PC is damaged before anyone falls." },
];

const box: React.CSSProperties = {
  background: "#0d0d14", border: "1px solid #2a2a3e", borderRadius: 6, padding: "8px 10px",
};
const chip = (active: boolean): React.CSSProperties => ({
  fontSize: 10, fontWeight: active ? 700 : 500, padding: "3px 8px",
  background: active ? "#4f9dff" : "#0d0d14", color: active ? "#fff" : "#8a8aa0",
  border: `1px solid ${active ? "#4f9dff" : "#2a2a3e"}`, borderRadius: 4, cursor: "pointer",
});
const label: React.CSSProperties = {
  display: "block", fontSize: 10, color: "#8a8aa0", textTransform: "uppercase",
  letterSpacing: 1, marginBottom: 3,
};

export function EncounterDifficultyPanel({ encounters, monsterLibrary, actors = [] }: {
  encounters: EncounterDefinition[];
  monsterLibrary: MainMonsterTemplate[];
  /**
   * The party as the app currently holds it. Optional so any other caller still works, but
   * supplying it is what closes v9’s class-healing blocker: an abstract 128-party profile can
   * never know somebody is a Paladin, and these actors say so.
   */
  actors?: unknown[];
}) {
  const [open, setOpen] = useState(false);
  const [encounterId, setEncounterId] = useState<string>("");
  const [partySize, setPartySize] = useState<number>(4);
  const [partyLevel, setPartyLevel] = useState<number>(GENERIC_CHECKER_LEVELS.minimum);
  const [equipmentMode, setEquipmentMode] = useState<PartyEquipmentMode>("wotcStandard");
  const [allocation, setAllocation] = useState<DamageAllocation>("focus_fire");
  const [targetSafetyMargin, setTargetSafetyMargin] = useState<number>(1);
  /**
   * ⚠ AC AND SAVES ARE NOW READ, NOT ASKED FOR. v7 ships `party_defense_curve` — an average AC and
   * all SIX save averages, by level and by equipment mode. The checker used to require a typed AC
   * because the workbook published the formulas and no table; it publishes the table now.
   *
   * `null` means "use the curve". A typed value overrides it, because a real table is not the
   * average table — and the override is what stops an automatic number being unarguable.
   */
  const [acOverride, setAcOverride] = useState<number | null>(null);
  const [saveOverride, setSaveOverride] = useState<number | null>(null);
  const defence = partyDefenceAt(partyLevel, equipmentMode);
  /** Whether the checker is using the curve or the DM's typed numbers — surfaced in the panel. */
  const isOverridden = acOverride !== null || saveOverride !== null;
  const curveModeLabel = equipmentMode === "brokenChain" ? "Broken Chain" : "WotC standard";
  /** Share of the party's sustain already spent when this fight starts. 0 = fresh. */
  const [arrivingSpent, setArrivingSpent] = useState<number>(0);

  /**
   * ⚠ THE PARTY IS THE ACTORS. There is no built-in party and there must not be one —
   * `brokenChainActors` is deliberately empty, and everything below reads the DM's own library.
   *
   * Christopher: *"if someone puts 6 on the party size but has 4 actors in the data then the
   * response is add more actors due to unable to read enough actors, if 4 and the party is 5 then
   * it should be check which actors you want to use for this party."*
   *
   * Party size is a curve input — it picks the HP band and scales the DPR — so it is not merely
   * decorative when it disagrees with the roster. Too FEW actors means the checker is pricing a
   * party that does not exist; too MANY means it is guessing which of them showed up.
   */
  const players = useMemo(
    () => (actors as Array<{ id?: string; name?: string; kind?: string }>).filter(a => a?.kind === "player"),
    [actors],
  );
  /**
   * Which of the DM's actors are in THIS party.
   *
   * ⚠ MORE ACTORS THAN SEATS MEANS UNRESOLVED, NOT "ALL OF THEM". Defaulting to every actor read
   * six characters' healing pools into a four-player party, which is a guess wearing a number.
   * The party is not resolved until exactly `partySize` are chosen, and until then nothing is
   * read off the actors at all.
   */
  const [chosenActorIds, setChosenActorIds] = useState<string[]>([]);
  const chosen = useMemo(
    () => players.length === partySize
      ? players
      : players.filter(a => chosenActorIds.includes(a.id ?? "")),
    [players, partySize, chosenActorIds],
  );
  const resolved = chosen.length === partySize;

  /**
   * ⚠ THE CURVE IS THE FALLBACK NOW, NOT THE ANSWER.
   *
   * Christopher: *"there should be a update to the standard on the dex line as well as how ac for
   * the party was obtained."* The workbook's own `Party Defense Reach` rows are stamped
   * PROVISIONAL STANDARD-PROGRESSION PROXY, and `Party Progression Runtime` says what replaces
   * them: *"Expose AC and armor source per PC. Per-PC, not party-average AC."*
   *
   * So the order of authority is: a DM's typed override, then the REAL party when one is chosen,
   * then the published proxy. The proxy is never wrong to show — it is wrong to prefer when four
   * actual characters with actual armour are sitting in the roster.
   */
  const actorDefence = useMemo(
    () => (resolved ? partyDefenceFromActors(chosen as never[]) : null),
    [chosen, resolved],
  );
  /**
   * ⚠ WHAT THE PARTY'S BONDS STOP. Christopher: *"almost every bond has some version of damage
   * reduction for self or others."* Read from the characters' own assignments, priced per round
   * because that is how often a bond fires — never folded into sustain, which is spent once.
   */

  const targetAc = acOverride ?? actorDefence?.ac ?? defence.ac;
  /**
   * Six saves, unless the DM has typed one number to flatten them.
   *
   * ⚠ THE FLATTENED FIGURE IS A DISPLAY, NOT AN INPUT. `featureResolver` reads
   * `target.saves[ability]` whenever the feature named one, so a Dex burst prices against DEX.
   * `targetSave` is the mean of whatever six are in force, shown so the panel has one number to
   * print and used only where a feature never said which save it calls for.
   */
  const saves = saveOverride !== null
    ? { str: saveOverride, dex: saveOverride, con: saveOverride, int: saveOverride, wis: saveOverride, cha: saveOverride }
    : actorDefence?.saves
      ?? { str: defence.str, dex: defence.dex, con: defence.con, int: defence.int, wis: defence.wis, cha: defence.cha };
  const targetSave = (saves.str + saves.dex + saves.con + saves.int + saves.wis + saves.cha) / 6;
  /** Where the numbers above came from, so the panel can say it rather than imply it. */
  const defenceBasis: "override" | "actors" | "curve" =
    acOverride !== null || saveOverride !== null ? "override" : actorDefence ? "actors" : "curve";

  /**
   * The same three answers at every size from 3 to 6 — Christopher: *"3 player would make you
   * check which 3 if you had more, 4 same as 3 but if you only had 3 it would tell you not enough
   * actors in the profile to read correctly, same with 5 and same with 6."*
   *
   * Party size is a CURVE INPUT: it picks the HP band and scales DPR and sustain. So a mismatch
   * is not cosmetic — too few actors means the checker is being asked about a party that is not
   * in the data, and too many means it does not know which of them showed up.
   */
  const rosterFit: { level: "ok" | "short" | "over"; message: string } =
    players.length === 0
      ? { level: "short", message: `No player actors in the library — nothing about this party can be read, so sustain and healing come from the generic ${partySize}-player curve alone.` }
      : players.length < partySize
        ? { level: "short", message: `Not enough actors in the profile to read a ${partySize}-player party correctly — ${players.length} readable. Add ${partySize - players.length} more, or check a smaller party.` }
        : players.length > partySize
          ? {
            level: "over",
            message: resolved
              ? `${chosen.length} of ${players.length} chosen for this ${partySize}-player party.`
              : `${players.length} actors for a ${partySize}-player party — check which ${partySize} you want to use. Nothing is read off the actors until you do.`,
          }
          : { level: "ok", message: `${players.length} actors, matching the ${partySize}-player curve.` };

  /**
   * Same-encounter healing pools the published sustain does not contain — read from the CHOSEN
   * actors, so a six-actor library priced as a four-player party contributes four actors' pools.
   */
  const partyHealing = useMemo(
    () => resolved
      ? partyHealingFromActors(chosen as never[])
      // Unresolved: read nothing rather than a number built from the wrong actors.
      : { total: 0, sources: [], excluded: [] },
    [chosen, resolved],
  );

  /**
   * What this party DEALS, by type — so a creature's typed resistance prices itself against the
   * actual party instead of asking the author to weigh it by hand. Same resolution rule as the
   * healing above: an unresolved roster reads NOTHING rather than a mix built from the wrong
   * actors, because an overstated fire share overprices every fire-resistant creature in the act.
   */
  const partyDamageMix = useMemo(
    () => resolved ? partyDamageMixFromActors(chosen as never[]) : EMPTY_DAMAGE_MIX,
    [chosen, resolved],
  );

  const encounter = encounters.find(e => e.id === encounterId) ?? encounters[0];
  const fightInputs = useMemo(() => {
    const entries = (encounter?.entries ?? [])
      .map(e => ({ template: monsterLibrary.find(m => m.templateId === e.templateId), quantity: Math.max(1, e.count) }))
      .filter(e => Boolean(e.template)) as Array<{ template: MainMonsterTemplate; quantity: number }>;
    const targetAC = meanTargetAc(entries);
    /**
     * ⚠ THE PARTY'S ACCURACY, READ OFF THE PARTY. Christopher: *"the parties hit chance should be
     * read by the encounter checker because that's where the dpr is suppose to move when you place
     * a party against it."*
     *
     * `attackProfile` was built for Great Weapon Master and already derives a hit chance from an
     * actor's own weapon against a target AC. The same actors that supply the DPR supply this, so
     * a permanent disadvantage effect prices against the party actually in the fight rather than
     * against a one-round anchor. No chosen party means no number and the anchor stands.
     */
    const chances = (chosen as unknown[])
      .map(a => targetAC === undefined ? undefined : attackProfile(a as never, targetAC)?.hitChance)
      .filter((h): h is number => typeof h === "number" && h > 0);
    const hitChance = chances.length ? chances.reduce((s, h) => s + h, 0) / chances.length : undefined;
    return { targetAC, saveExposure: incomingSaveExposure(entries), hitChance };
  }, [encounter, monsterLibrary, chosen]);


  const roster = useMemo(() => {
    if (!encounter) return { roster: [], assumptions: [] };
    const entries = encounter.entries
      .map(entry => ({
        template: monsterLibrary.find(m => m.templateId === entry.templateId),
        quantity: Math.max(1, entry.count),
        // The DM's per-body choices for a template creature — the archetype, element package and
        // bond each body actually took. Without them the checker prices the unfinished template,
        // which carries every choice at once. See `RosterEntryInput.bodies`.
        bodies: entry.bodies,
      }))
      .filter(e => Boolean(e.template)) as Array<{ template: MainMonsterTemplate; quantity: number; bodies?: TemplateBodyChoice[] }>;
    // Kill priority: weakest bodies first — a party that is paying attention clears the cheap
    // ones to cut incoming damage. The simulation depletes groups in exactly this order.
    // The full library, not just this fight — a summoned creature is never already on the field.
    const built = rosterFromTemplates(entries, partyLevel, { ac: targetAc, saveBonus: targetSave, partySize, saves, damageMix: partyDamageMix, hitChance: fightInputs.hitChance }, monsterLibrary);
    return {
      roster: [...built.roster].sort((a, b) => a.baseHp * a.quantity - b.baseHp * b.quantity),
      assumptions: built.assumptions,
    };
  }, [encounter, monsterLibrary, partyLevel, targetAc, targetSave, partySize, equipmentMode, partyDamageMix, fightInputs]);

  /**
   * WHAT THE HOSTILE SIDE IS DOING, so the accuracy bonds stop reading as unpriceable.
   *
   * Three bond kinds were reported "real but NOT priced" for one reason: the pricer only ever
   * received actors, so it had no per-attack damage and no hit chance to price a hit-chance effect
   * against. Both are already in this panel — the roster's round-1 damage, and the templates' own
   * attack bonuses against the AC this party actually presents.
   *
   * `incomingDamagePerHit` is recovered rather than assumed: published DPR already has hit chance
   * inside it, so dividing by attacks AND by that chance gets back to what one landed hit costs.
   */
  const hostileExposure = useMemo(() => {
    if (!encounter || targetAc === undefined || roster.roster.length === 0) return undefined;
    let dpr = 0;
    for (const g of roster.roster) {
      dpr += Number(g.dpr?.round1 ?? 0) * Math.max(1, Number(g.quantity) || 1);
    }
    let attacks = 0;
    let weightedBonus = 0;
    for (const entry of encounter.entries ?? []) {
      const template = monsterLibrary.find(m => m.templateId === entry.templateId);
      if (!template) continue;
      const bodies = Math.max(1, Number(entry.count) || 1);
      const per = Math.max(1, Number(template.stats?.attacksPerTurn ?? 1));
      const best = (template.actions ?? []).reduce(
        (top: number, a) => Math.max(top, parseAttackBonus(String(a?.roll ?? "")) ?? 0), 0);
      attacks += per * bodies;
      weightedBonus += best * per * bodies;
    }
    if (!(dpr > 0) || !(attacks > 0)) return undefined;
    const attackBonus = weightedBonus / attacks;
    const normalHit = attackHitProbability(attackBonus, targetAc);
    if (!(normalHit > 0)) return undefined;
    return {
      incomingDamagePerHit: dpr / attacks / normalHit,
      normalHit,
      attackBonus,
      /* Per-PC ACs, so a redirection bond can be priced between two NAMED bodies rather than
         against the party's mean — the mean is the one AC that cannot express a transition. */
      perPc: actorDefence?.perPc.map(p => ({ actor: p.actor, ac: p.ac })),
    };
  }, [encounter, monsterLibrary, roster, targetAc, actorDefence]);

  const bondMitigation = useMemo(
    () => (resolved ? partyBondMitigationFromActors(chosen as never[], { hostile: hostileExposure }) : null),
    [chosen, resolved, hostileExposure],
  );

  /**
   * ⚠ WHAT THE PARTY'S OWN CLASSES PREVENT — the half of defence the checker never read.
   *
   * Two things, and they are counted in different places because they ARE different things:
   *
   *   resistance  an EHP multiplier, weighed against what THIS fight throws. A resistance to
   *               something nothing in the fight deals is worth nothing, which is the whole
   *               reason it is weighed rather than assumed.
   *   reaction    HP per round, and CONTENDED with the bond's — `Action Timing` row 22 puts every
   *               normal Reaction in one budget, so a character brings the best of them and never
   *               both. The bond figure goes in so the two compete instead of stacking.
   */
  const classMitigation = useMemo(() => {
    if (!resolved) return null;
    const templates = (encounter?.entries ?? [])
      .map(e => monsterLibrary.find(m => m.templateId === e.templateId))
      .filter((t): t is MainMonsterTemplate => Boolean(t));
    const bondPerActor: Record<string, number> = {};
    for (const s of bondMitigation?.sources ?? []) {
      bondPerActor[s.actor] = Math.max(bondPerActor[s.actor] ?? 0, s.amount);
    }
    return partyMitigationFromActors(chosen as never[], {
      mix: templates.length > 0 ? rosterDamageMix(templates as never) : undefined,
      damagePerHit: hostileExposure?.incomingDamagePerHit ?? 0,
    }, bondPerActor);
  }, [chosen, resolved, encounter, monsterLibrary, hostileExposure, bondMitigation]);

  /**
   * ⚠ ONE ARRANGEMENT, DECIDED ONCE. The baseline and the clock have to agree about where bonds
   * live, so both read this — see `bondArrangement`. `equipmentMode` stays the DM's SELECTION;
   * `bondBaselineMode` is what the comparison is actually drawn against.
   */
  const bondArrange = bondArrangement(equipmentMode, bondMitigation?.perRound ?? 0, bondMitigation !== null);
  const bondBaselineMode = bondArrange.baselineMode;

  /**
   * ⚠ CAPACITY, NEVER A TOTAL. These slots are already inside the DPR curve; the point is that
   * nothing said so, and nothing said what else they could have been. One Action per turn makes
   * these alternatives, so they are counted as OPTIONS and never added to sustain or to damage.
   */
  const slotCapability = useMemo(
    () => (resolved ? slotCapabilityFromActors(chosen as never[]) : null),
    [chosen, resolved],
  );

  /**
   * ⚠ WHAT THE PARTY CAN LEGALLY SPEND ACROSS THE DAY, counted the workbook's way.
   *
   * `Resource Conversion`: total usable = starting + recovered + free, one Short Rest after fight
   * three, and every use reserved ONCE across offense / sustain / other. This is the availability
   * half only — it is displayed, not yet priced into R1..R4+, because the daily total is an audit
   * figure and row 45 is explicit that it "is not a replacement for round scheduling".
   */
  const resourceLedger = useMemo(
    () => (resolved
      ? resourceLedgerFromActors(chosen as never[], {
        /**
         * The character's ROLE decides a contested tier, and the role is the bond's — authored
         * beside it as `resourceLean`. Resolved here because the templates are module content
         * and the ledger is engine; a character with no bond returns undefined and keeps the
         * loadout split.
         */
        leanFor: (a) => {
          /**
           * ⚠ THE BOND MAY BE ON THE CARD RATHER THAN IN THE FIELD. A companion-performed bond is
           * hand-built across two sheets and writes no assignment, so reading only
           * `bondAssignment` concluded the character had no bond at all —
           * `bondTemplateForActor` reads both.
           */
          const bond = bondTemplateForActor(a as never, BROKEN_CHAIN_BOND_TEMPLATES)?.resourceLean;
          /**
           * ⚠ THE BOND FIRST, THEN THE CLASS. A bond is a stated choice about this character; a
           * half or third caster's lean is what the progression already implies. Lyrielle is the
           * case that needed it — her Pack bond is hand-built across her card and Faelar's, so no
           * assignment records it, and a Ranger is not roleless for that reason.
           */
          return bond ?? classResourceLean(a as never);
        },
      })
      : null),
    [chosen, resolved],
  );

  /**
   * ⚠ THE THING THE PARTY IS SWINGING AT IS THE ROSTER, AND THIS WAS AIMING IT AT THE PARTY.
   *
   * `targetAc` is `acOverride ?? actorDefence?.ac ?? defence.ac` — the PARTY's armour class, which
   * is exactly right where it is used, as the target for the monsters' attacks. The at-will base
   * borrowed it and handed it to `traceCreature` with a PC in the creature seat, so every
   * character's weapon was rolling against their own party's AC. `targetFromRoster` reads the
   * bodies actually in this fight, which is the only direction that means anything here.
   */
  const partyTarget = useMemo(() => {
    const entries = (encounter?.entries ?? [])
      .map(e => ({ template: monsterLibrary.find(m => m.templateId === e.templateId), quantity: Math.max(1, e.count) }))
      .filter(e => Boolean(e.template)) as Array<{ template: MainMonsterTemplate; quantity: number }>;
    return targetFromRoster(entries as never, partySize);
  }, [encounter, monsterLibrary, partySize]);

  /**
   * ⚠ THE CURRENT PARTY'S OWN R1/R2/R3/R4+ AND SUSTAIN — step three, and the end of the caveat.
   *
   * `Resource Conversion` row 8: *"Schedule the legal actions, then write party R1/R2/R3/R4+ and
   * Sustain to Runtime Inputs."* `actorAsCreature` supplies the at-will base with every resource
   * excluded (row 5), `resourceLedgerFromActor` counts what may legally be spent and reserves each
   * use once (row 44), and `currentPartyMetrics` prices those uses and PLACES THEM IN ROUNDS —
   * best first, one per round, because a character takes one Action a turn. Row 45: the daily
   * average is an audit result and never the round profile, so it is returned separately.
   *
   * Christopher, 2026-09-07: *"if we know everything on the actor we should know everything that
   * actor can do."* This is that. Until it existed the offence side of the comparison was the
   * certified line for this party's SIZE, which made the delta a row compared with itself.
   */
  const currentParty = useMemo(() => {
    if (!resolved || !partyTarget) return null;
    try {
      return currentPartyMetrics(chosen as never[], partyTarget, {
        /* The party does not arrive fresh, and the read side has to know that too. */
        arrivingSpent,
        // The same role resolution the ledger uses — bond first, then the class's own lean.
        leanFor: (a: unknown) => bondTemplateForActor(a as never, BROKEN_CHAIN_BOND_TEMPLATES)?.resourceLean
          ?? classResourceLean(a as never),
      });
    } catch { return null; }
  }, [chosen, resolved, partyTarget, arrivingSpent]);

  /**
   * THE PARTY ARRIVES HAVING ALREADY SPENT SOMETHING. A gate is not fought fresh — it is fought
   * after the two encounters before it, which is exactly why a 35-45% gate still sends a party
   * to a rest.
   *
   * ⚠ DAMAGE MOVES WITH IT, NOT JUST SUSTAIN. This used to hand the checker a reduced
   * `customSustain` and leave the round profile at its fresh figures, so an arriving-spent party
   * opened with the same nova it would have thrown fresh and only fell over sooner. Both halves
   * now resolve inside `resolvePartyProfile` off the published fresh/expended reference — see
   * `partyResourceCurve`.
   */
  const profile = useMemo(() => {
    try {
      return resolvePartyProfile({
        level: partyLevel, size: partySize, equipmentMode: bondBaselineMode, arrivingSpent,
      });
    } catch { return null; }
  }, [partyLevel, partySize, bondBaselineMode, arrivingSpent]);

  /**
   * ⚠ FEATS LAND ON THE LINES THAT ALREADY EXIST, not on a panel of their own.
   *
   * Christopher: *"the feats should show next to the dpr as a increase or in the healing if it
   * increases sustain above the party line"*, and *"i didnt ask for a new party estimator."*
   *
   * Read from the characters' own feats/features tabs — the same pair `deriveActorStats` reads —
   * and priced with every `resolved*` flag TRUE, because the entered sheet already contains the
   * AC and HP a feat grants. That guard is what stops the app recalculating what a DM typed in.
   */
  /**
   * ⚠ THE FIGHT IS AN INPUT TO THE FEATS, and it was not being passed.
   *
   * Shield Master needs the share of incoming damage that comes through Dex saves; Great Weapon
   * Master needs a hit chance, which needs an AC to roll against. Both are properties of the
   * encounter that is already selected in this panel, so neither is something a DM should be asked
   * to type. See `incomingSaveExposure`.
   */

  const partyFeats = useMemo(() => partyFeatsFromActors(chosen as unknown[], {
    baseDpr: profile?.dpr.round1, baseEhp: profile?.sustain,
    targetAC: fightInputs.targetAC, saveExposure: fightInputs.saveExposure,
  }), [chosen, profile, fightInputs]);

  /**
   * CURRENT PARTY vs MIDPOINT — `Rounds DPR & Sustain` row 73: *"Checker comparison | Current
   * party vs midpoint | Delta | raw + percent"*.
   *
   * ⚠ ONLY WHEN A REAL PARTY IS CHOSEN. `resolved` is the whole gate. Against an unresolved
   * roster the "current party" would BE the midpoint scaled for size, and a delta of a line
   * against itself is a row of zeros pretending to be a reading.
   *
   * The current side is what this fight actually runs with — size scaling and arriving-spent
   * depletion already in `profile` — plus the two contributions the app reads off the chosen
   * characters rather than assumes: feat DPR on every round, and feat healing plus the resolved
   * healing pool on sustain. Feat DPR is a flat per-round figure, so it lands on each round
   * rather than on the round-1 anchor it was priced against.
   */
  /**
   * ⚠ WHERE THE OFFENCE SIDE CAME FROM, AS A FACT THE PANEL CAN STATE.
   *
   * `read` means `currentPartyMetrics` scheduled these characters' own actions and resources
   * against this fight's bodies. `certified` means it could not — no fight selected, no readable
   * roster, or a sheet the adapter threw on — and the published curve for this party's SIZE is
   * standing in. The two must never be shown the same way: one is a reading, the other is a line.
   */
  const offenceSource: "read" | "certified" = currentParty && currentParty.round1Dpr > 0 ? "read" : "certified";

  const benchmark = useMemo(() => {
    if (!profile || !resolved) return null;
    /**
     * ⚠ FEATS ARE ADDED TO THE CERTIFIED LINE AND NOT TO THE READING, because on the read side
     * they are ALREADY IN IT. `partyFeatsFromActors` prices a feat's damage off the same sheets
     * `actorAsCreature` reads, so adding it to a number that already scheduled those actions
     * counts Great Weapon Master twice. This is the same allocate-once rule the ledger applies to
     * a slot, applied to a feat.
     */
    const read = offenceSource === "read" && currentParty;
    const dpr = read
      ? { round1: currentParty.round1Dpr, round2: currentParty.round2Dpr,
        round3: currentParty.round3Dpr, round4Plus: currentParty.round4PlusDpr }
      : { round1: profile.dpr.round1 + partyFeats.dpr, round2: profile.dpr.round2 + partyFeats.dpr,
        round3: profile.dpr.round3 + partyFeats.dpr, round4Plus: profile.dpr.round4Plus + partyFeats.dpr };
    return partyBenchmark({
      level: partyLevel,
      mode: bondBaselineMode,
      // Like for like: the current side is this size's profile, so the line must be too.
      partySize,
      current: {
        ...dpr,
        /**
         * ⚠ SUSTAIN STAYS ON THE CERTIFIED FLOOR PLUS WHAT IS READ, AND `fiveRoundSustain` IS NOT
         * ADDED TO IT. `currentPartyMetrics` sums per-actor max HP plus the healing the ledger
         * reserved for sustain; `profile.sustain` is the certified EHP for this size and
         * `partyHealing.total` is the same healing read a second way. Adding all three would
         * count this party's hit points twice and its healing three times — the exact
         * double-count `Resource Conversion` row 46 forbids ("Do not add a second free sustain
         * pool"). The read figure is reported beside the row instead, where it can be compared.
         */
        sustain: profile.sustain * (classMitigation?.multiplier ?? 1) + partyFeats.partyEhp + partyHealing.total,
      },
    });
  }, [profile, resolved, partyLevel, bondBaselineMode, partySize, partyFeats, partyHealing, currentParty, offenceSource, classMitigation]);

  const result = useMemo<EncounterResult | null>(() => {
    if (roster.roster.length === 0 || !profile) return null;
    try {
      return simulateEncounter({
        party: {
          size: profile.size,
          /**
           * ⚠ A RESISTANCE IS EFFECTIVE HP, AND IT BELONGS HERE RATHER THAN IN THE CLOCK.
           *
           * The certified sustain line is the 4,096-party field, whose parties are abstract and
           * carry no typed responses — so this multiplier adds something the baseline genuinely
           * does not have, the same way feat EHP does. It is 1.0 whenever nothing is stated, so a
           * party that has entered no responses is unchanged.
           */
          sustain: profile.sustain * (classMitigation?.multiplier ?? 1),
          /**
           * ⚠ THE SIMULATION MUST SWING THE SAME PARTY THE PANEL SAYS IT READ.
           *
           * This was `profile.dpr` — the certified curve — while the caption beside it reported
           * `currentPartyMetrics`. Christopher: *"explain why the R1 shows 138 damage, but the
           * party shows able to do only 94.3."* Because they were two different parties on one
           * screen: the round table, the clear round, the survivor counts and the margin were all
           * computed from the published line while the delta above them compared the read one.
           *
           * The read figures win when they exist, because they are this table's characters. When
           * they cannot be read the certified line stands in, and `offenceSource` says which.
           */
          dpr: offenceSource === "read" && currentParty
            ? { round1: currentParty.round1Dpr, round2: currentParty.round2Dpr,
              round3: currentParty.round3Dpr, round4Plus: currentParty.round4PlusDpr }
            : profile.dpr,
          /**
           * ⚠ THE DEX LINE, AND IT IS THE SAME LINE TWICE. Initiative is a DEX check, so the
           * party's place in the body order is the DEX average from whichever source the panel is
           * already trusting for saves — the chosen characters when there are any, the published
           * curve otherwise. Deriving a second opinion of the party's DEX here is exactly the
           * drift this file keeps paying for.
           */
          initiative: actorDefence?.initiative ?? saves.dex,
          /**
           * Counted once — see `bondArrangement` for the bond half. The class half is already
           * NET of each character's bond (`partyMitigationFromActors` subtracts it per actor,
           * because one Reaction cannot be spent twice), so these add without double-counting.
           */
          mitigationPerRound: bondArrange.mitigation + (classMitigation?.reactionPerRound ?? 0),
        },
        roster: roster.roster,
        settings: { damageAllocation: allocation, targetSafetyMargin },
      });
    } catch {
      return null;
    }
    /**
     * ⚠ `bondMitigation` AND `actorDefence` BELONG HERE EXPLICITLY. The AC and save values reach
     * the simulation THROUGH `roster`, so changing the chosen party already re-ran this by way of
     * that dependency. Mitigation and initiative do not — they are party inputs that touch no
     * roster figure, so without naming them a party could gain a Guardian and the fight would not
     * re-price until something unrelated moved.
     */
    // ⚠ `classMitigation` REACHES NO ROSTER FIGURE EITHER, so it must be named or a party that
    // states a resistance would not re-price the fight until something else moved.
  }, [roster, profile, allocation, targetSafetyMargin, bondMitigation, classMitigation, currentParty, offenceSource, actorDefence, saves.dex]);

  /**
   * What the fight costs, as a share of a FULL party's sustain — and where that leaves a party
   * that did not arrive full. Both read off the simulation's own per-round monster damage; no
   * separate arithmetic.
   */
  const partyClock = useMemo(() => {
    if (!result || !profile) return { thisFight: 0, cumulative: 0 };
    const fullSustain = profile.sustain / Math.max(0.01, 1 - arrivingSpent);
    const spent = result.rounds.reduce((s, r) => s + (r.monsterDamage ?? 0), 0);
    const thisFight = fullSustain > 0 ? spent / fullSustain : 0;
    return { thisFight, cumulative: arrivingSpent + thisFight };
  }, [result, profile, arrivingSpent]);

  const fatal = result?.fatalRound ?? null;
  /**
   * ⚠ A GREEN VERDICT MUST NOT CONTRADICT THE NUMBER PRINTED UNDER IT.
   *
   * The headline was binary: FATAL when `fatalRound` fired, CLEARS otherwise. `fatalRound` fires
   * only when cumulative monster damage empties the party's WHOLE pooled sustain, so a fight where
   * the party falls before it finishes still read as a green CLEARS — with "margin -2.47" and
   * "3 down · 1 damaged" sitting directly beneath it.
   *
   * Christopher, at level 1 against the Crone and the Mare: *"why does the checker tell me my lvl 1
   * party can beat the crone and the mare when one of the crones spells or even one of the mare's
   * attacks would kill a pc"*. The pooled model is the deeper answer and is a separate conflict;
   * this is the part that is simply a wrong label. A NEGATIVE safety margin means MER < PCER — the
   * party runs out before the roster does — and that is not a clear.
   */
  const fallsFirst = result !== null && (result.safetyMargin ?? 0) < 0;
  const headline = !result ? { text: "no roster", color: "#8a6a2a" }
    : fatal !== null ? { text: `FATAL R${fatal}`, color: "#ff4444" }
    : fallsFirst ? { text: `FALLS FIRST · roster dies R${result.completionRound ?? "—"}`, color: "#e07b39" }
    : { text: `CLEARS R${result.completionRound ?? "—"}`, color: "#4caf50" };

  return (
    <section style={{ marginBottom: 12, background: "#11131a", border: "1px solid #2a2a3e", borderLeft: "3px solid #4f9dff", borderRadius: 6 }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "8px 10px", background: "transparent", border: "none", color: "#fff", cursor: "pointer" }}
      >
        <span style={{ fontSize: 11, color: "#4f9dff", width: 12, flexShrink: 0 }}>{open ? "▼" : "▶"}</span>
        <span style={{ fontSize: 12, fontWeight: 600, flex: 1, minWidth: 0 }}>📊 Encounter Checker</span>
        <span style={{ fontSize: 10, color: "#666", flexShrink: 0 }}>workbook v3</span>
      </button>

      {open && (
        <div style={{ padding: "0 10px 10px" }}>
          {encounters.length === 0 ? (
            <p style={{ fontSize: 12, color: "#777", fontStyle: "italic", margin: 0 }}>
              No encounters yet. Build one with + Encounter first.
            </p>
          ) : (
            <>
              <div style={{ marginBottom: 8 }}>
                <label style={label}>Encounter</label>
                <select
                  value={encounter?.id ?? ""}
                  onChange={e => setEncounterId(e.target.value)}
                  style={{ width: "100%", fontSize: 11, padding: "3px 6px", borderRadius: 4, border: "1px solid #2a2a3e", background: "#0d0d14", color: "#ddd" }}
                >
                  {encounters.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>

              {/* Equipment mode — the campaign on/off switch. */}
              <div style={{ marginBottom: 8 }}>
                <label style={label}>Equipment mode</label>
                <div style={{ display: "flex", gap: 4 }}>
                  {MODES.map(m => (
                    <button key={m.id} type="button" title={m.blurb}
                      onClick={() => setEquipmentMode(m.id)} style={chip(equipmentMode === m.id)}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                <div>
                  <label style={label}>Party size</label>
                  <div style={{ display: "flex", gap: 4 }}>
                    {PARTY_SIZES.map(s => (
                      <button key={s} type="button" onClick={() => setPartySize(s)} style={chip(partySize === s)}
                        title={`HP multiplier ×${partySizeHpMultiplier(s)}`}>{s}P</button>
                    ))}
                  </div>
                  {/* What the actors say about that number — see `rosterFit`. */}
                  <div style={{ fontSize: 10, marginTop: 3, color: rosterFit.level === "ok" ? "#6a8a6a" : rosterFit.level === "short" ? "#e07b39" : "#c9a227" }}>
                    {rosterFit.message}
                  </div>
                  {/*
                    More actors than the party size: the DM says which ones are in this fight,
                    rather than the checker silently taking the first N. The choice feeds the
                    healing readout, so picking a party without its paladins shows immediately.
                  */}
                  {rosterFit.level === "over" && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4, alignItems: "center" }}>
                      {players.map(a => {
                        const id = a.id ?? "";
                        const on = chosenActorIds.includes(id);
                        // Full is full: at N chosen, the rest are unavailable rather than silently
                        // making an N+1 party. Deselect somebody to swap.
                        const full = !on && chosen.length >= partySize;
                        return (
                          <button key={id} type="button" disabled={full}
                            onClick={() => setChosenActorIds(on
                              ? chosenActorIds.filter(x => x !== id)
                              : [...chosenActorIds, id])}
                            style={{ ...chip(on), fontSize: 9, opacity: full ? 0.35 : 1, cursor: full ? "not-allowed" : "pointer" }}
                            title={on ? "In this party — click to leave out"
                              : full ? `That is already ${partySize}. Leave someone out first.`
                                : "Click to put in this party"}>
                            {on ? "✓ " : ""}{a.name ?? "unnamed"}
                          </button>
                        );
                      })}
                      <span style={{ fontSize: 10, color: resolved ? "#6a8a6a" : "#c9a227", alignSelf: "center" }}>
                        {chosen.length}/{partySize}
                      </span>
                      {chosen.length > 0 && (
                        <button type="button" onClick={() => setChosenActorIds([])}
                          style={{ ...chip(false), fontSize: 9 }} title="Clear the selection">clear</button>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <label style={label}>Party level</label>
                  <select
                    value={partyLevel}
                    onChange={e => setPartyLevel(Number(e.target.value))}
                    style={{ fontSize: 11, padding: "3px 6px", borderRadius: 4, border: "1px solid #2a2a3e", background: "#0d0d14", color: "#ddd" }}
                  >
                    {/* 1–20, both equipment modes. The floor used to be 3, which left a DM unable
                        to check a level 1 or 2 fight at all. See `GENERIC_CHECKER_LEVELS`. */}
                    {Array.from({ length: GENERIC_CHECKER_LEVELS.maximum - GENERIC_CHECKER_LEVELS.minimum + 1 },
                      (_, i) => GENERIC_CHECKER_LEVELS.minimum + i).map(l => (
                        <option key={l} value={l}>L{l}{isProjectedLevel(l) ? " (projected)" : ""}</option>
                      ))}
                  </select>
                </div>
                <div>
                  <label style={label}>Safety margin</label>
                  <input type="number" step="0.5" value={targetSafetyMargin}
                    onChange={e => setTargetSafetyMargin(Number(e.target.value))}
                    style={{ width: 60, fontSize: 11, padding: "3px 6px", borderRadius: 4, border: "1px solid #2a2a3e", background: "#0d0d14", color: "#ddd" }} />
                </div>
                <div title="What the party has already spent when this fight starts. A gate is fought after the encounters before it, not fresh.">
                  <label style={label}>Arrives spent</label>
                  <div style={{ display: "flex", gap: 4 }}>
                    {[0, 0.25, 0.4, 0.6].map(v => (
                      <button key={v} type="button" onClick={() => setArrivingSpent(v)} style={chip(arrivingSpent === v)}>
                        {v === 0 ? "fresh" : `${v * 100}%`}
                      </button>
                    ))}
                  </div>
                </div>
                {/* ⚠ THIS TOOLTIP USED TO SAY THE OPPOSITE OF WHAT THE PANEL DOES. It read "the
                    workbook publishes the hit and save formulas but no party AC table, so this is
                    yours to enter" — true of v6, false since v7 shipped `party_defense_curve`, and
                    the panel has been reading that curve since 0.7.10.38. A stale code comment is
                    a trap for the next session; a stale TOOLTIP is a lie told to the DM at the
                    table, so it is the more urgent of the two. */}
                <div title={
                  isOverridden
                    ? "OVERRIDDEN — the checker is using your typed numbers, not the party curve. Clear both to go back to the curve."
                    : defenceBasis === "actors"
                      ? `Read from the ${chosen.length} chosen characters: ${actorDefence?.perPc.map(p => `${p.actor} AC ${p.ac}`).join(" · ")}. Their own armour and save proficiencies, not the published average. Type over either one to override.`
                      : `Read from the party defence curve at level ${partyLevel} (${curveModeLabel}): average AC and the matching ability save. The workbook stamps these rows PROVISIONAL PROXY — choose a party to read real characters instead. Type over either one for your own table.`
                }>
                  <label style={label}>
                    Party AC / save{" "}
                    {isOverridden
                      ? <button type="button" onClick={() => { setAcOverride(null); setSaveOverride(null); }}
                          title="Go back to the curve value for this level"
                          style={{ fontSize: 9, padding: "0 4px", background: "#e07b3922", border: "1px solid #e07b3955", borderRadius: 3, color: "#e07b39", cursor: "pointer" }}>
                          overridden · reset
                        </button>
                      : <span style={{ fontSize: 9, color: "#5a5a6e" }}>{defenceBasis === "actors" ? "from party" : "from curve"}</span>}
                  </label>
                  <div style={{ display: "flex", gap: 4 }}>
                    <input type="number" value={targetAc} onChange={e => setAcOverride(e.target.value === "" ? null : Number(e.target.value))}
                      style={{ width: 48, fontSize: 11, padding: "3px 6px", borderRadius: 4, border: `1px solid ${acOverride === null ? "#2a2a3e" : "#e07b3988"}`, background: "#0d0d14", color: "#ddd" }} />
                    <input type="number" value={Number(targetSave.toFixed(2))} onChange={e => setSaveOverride(e.target.value === "" ? null : Number(e.target.value))}
                      style={{ width: 48, fontSize: 11, padding: "3px 6px", borderRadius: 4, border: `1px solid ${saveOverride === null ? "#2a2a3e" : "#e07b3988"}`, background: "#0d0d14", color: "#ddd" }} />
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={label}>Damage allocation</label>
                <div style={{ display: "flex", gap: 4 }}>
                  {ALLOCATIONS.map(a => (
                    <button key={a.id} type="button" title={a.blurb}
                      onClick={() => setAllocation(a.id)} style={chip(allocation === a.id)}>
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>

              {isProjectedLevel(partyLevel) && (
                <div style={{ ...box, borderColor: "#8a6a2a", marginBottom: 8, fontSize: 10, color: "#c9a227" }}>
                  ⚠ PROJECTED — levels 17–20 carry no field samples and are extrapolated.
                </div>
              )}

              {result && profile ? (
                <>
                  <div style={{ ...box, border: `1px solid ${headline.color}`, marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 5 }}>
                      <span style={{ fontSize: 20, fontWeight: 700, color: headline.color, lineHeight: 1 }}>
                        {headline.text}
                      </span>
                      <span style={{ fontSize: 11, color: "#aaa" }}>
                        {result.standingAtCompletion ?? 0} of {partySize} standing
                      </span>
                      <span style={{ marginLeft: "auto", fontSize: 10, color: "#8a8aa0" }}>
                        {result.downsAtCompletion ?? 0} down · {result.damagedButStandingAtCompletion ?? 0} damaged
                      </span>
                    </div>
                    <div style={{ fontSize: 10, color: "#777", lineHeight: 1.6 }}>
                      <div>
                        <span style={{ color: "#e0a87b" }}>EHP</span>{" "}
                        <strong style={{ color: "#aaa" }}>{result.encounterEhp.toFixed(0)}</strong>
                        <span style={{ color: "#555" }}> · roster DPR {result.startingEncounterDpr.toFixed(1)}</span>
                      </div>
                      <div>
                        <span style={{ color: "#7bc8e0" }}>PCER</span>{" "}
                        {result.pcer === null ? "—" : result.pcer.toFixed(2)}
                        <span style={{ color: "#555" }}> rds to clear · </span>
                        <span style={{ color: "#e07be0" }}>MER</span>{" "}
                        {result.mer === null ? "—" : result.mer.toFixed(2)}
                        <span style={{ color: "#555" }}> rds to fall · margin </span>
                        <strong style={{ color: (result.safetyMargin ?? 0) >= targetSafetyMargin ? "#4caf50" : "#e07b39" }}>
                          {result.safetyMargin === null ? "—" : result.safetyMargin.toFixed(2)}
                        </strong>
                      </div>
                      <div style={{ color: "#666" }}>
                        {partySize}P · L{partyLevel} · {equipmentMode === "brokenChain" ? "Broken Chain" : "Standard"}
                        {/* ⚠ ONE PARTY ON THE SCREEN. This printed the certified curve while the
                            simulation below and the delta above used the read one — three numbers
                            for the same thing. It prints whichever party actually ran. */}
                        {(() => {
                          const d = offenceSource === "read" && currentParty
                            ? { round1: currentParty.round1Dpr, round2: currentParty.round2Dpr,
                              round3: currentParty.round3Dpr, round4Plus: currentParty.round4PlusDpr }
                            : profile.dpr;
                          return <>{" · party "}{d.round1.toFixed(0)}/{d.round2.toFixed(0)}/
                            {d.round3.toFixed(0)}/{d.round4Plus.toFixed(0)} DPR</>;
                        })()}
                        {/* ⚠ FEATS ARE ONLY ADDED TO THE CERTIFIED LINE. On the read side they are
                            already inside the actions that were scheduled, so showing "+X from
                            feats" beside a read figure would claim an addition that never happened. */}
                        {offenceSource !== "read" && partyFeats.dpr > 0 && (
                          <span style={{ color: "#e0b070" }} title={partyFeats.matched.map(m => `${m.actor}: ${m.feats.join(", ")}`).join(" · ")}>
                            {" +"}{partyFeats.dpr.toFixed(1)}{" from feats"}
                          </span>
                        )}
                        {" · sustain "}{profile.sustain.toFixed(0)}
                        {partyFeats.partyEhp > 0 && (
                          <span style={{ color: "#7be08a" }} title={partyFeats.matched.map(m => `${m.actor}: ${m.feats.join(", ")}`).join(" · ")}>
                            {" +"}{partyFeats.partyEhp.toFixed(0)}{" healing from feats"}
                          </span>
                        )}
                        {partyFeats.needsInput.length > 0 && (
                          /* ⚠ SAID, NOT SWALLOWED. A feat that could not be priced is a question,
                             excluded from the two figures above rather than added as zero. */
                          <span style={{ color: "#c0a060" }}
                            title={partyFeats.needsInput.map(n => `${n.actor} · ${n.feat} · ${n.channel} — needs ${n.missing.join(", ")}`).join("\n")}>
                            {" · "}{partyFeats.needsInput.length}{" feat channel"}
                            {partyFeats.needsInput.length === 1 ? "" : "s"}{" need input"}
                          </span>
                        )}
                      </div>
                      {benchmark && (
                        /*
                          ⚠ THE LINE ABOVE IS WHAT THIS PARTY BRINGS; THIS ONE IS WHERE THAT SITS.
                          Under is not a failure and over is not a pass — a three-player party
                          reads under because it is short a body, which is the reading the DM
                          wants before they decide what to put in front of it.
                        */
                        <div style={{ color: "#666", marginTop: 2 }}>
                          <span style={{ color: "#888" }}>vs MIDPOINT</span>
                          {benchmark.projected && (
                            <span style={{ color: "#c0a060" }} title="Levels 17-20 have no population run in the workbook.">
                              {" PROJECTED"}
                            </span>
                          )}
                          {/*
                            ⚠ WHY SUSTAIN CAN READ +0% ON A PARTY THAT CLEARLY MITIGATES.
                            Bond mitigation is applied to the SIMULATION as `mitigationPerRound` —
                            it lengthens MER directly — so it is already inside the reading and
                            must not also be added here. Without saying so, "+0.0 (+0%)" next to
                            "BONDS PREVENT 16.5 HP per round" reads as a broken number rather than
                            as two figures counted in two different places.
                          */}
                          {benchmark.rows.map(r => (
                            <span key={r.key} style={{ marginLeft: 7 }}
                              title={`${r.label} — this party ${r.current.toFixed(1)} vs published midpoint ${r.midpoint.toFixed(1)}`}>
                              <span style={{ color: "#777" }}>{r.label}{" "}</span>
                              <strong style={{ color: r.delta >= 0 ? "#4caf50" : "#e07b39" }}>
                                {r.delta >= 0 ? "+" : "\u2212"}{Math.abs(r.delta).toFixed(1)}
                              </strong>
                              {r.percent !== null && (
                                <span style={{ color: "#777" }}>
                                  {" ("}{r.delta >= 0 ? "+" : "\u2212"}{Math.abs(r.percent * 100).toFixed(0)}{"%)"}
                                </span>
                              )}
                            </span>
                          ))}
                          {slotCapability && (
                            /*
                              ⚠ THE SAME SLOTS, NOT EXTRA ONES. A caster who heals did not also
                              fireball, so these are alternatives and the line says so rather than
                              letting three numbers read as a sum.
                            */
                            <span style={{ color: "#777", marginLeft: 8 }}
                              title={slotCapability.contested.length
                                ? slotCapability.contested
                                    .map(c => `${c.actor} · ${c.slotLevel ? `L${c.slotLevel} slot` : "resource"}`
                                      + ` → ${c.uses.join(" / ")} · ${c.options.join(", ")}`)
                                    .join(" | ")
                                : "No slot on this party is wanted by more than one kind of spell."}>
                              {"· slots "}{slotCapability.byUse.healing}{"H/"}
                              {slotCapability.byUse.damage}{"D/"}
                              {slotCapability.byUse.control}{"C"}
                              {slotCapability.contested.length > 0
                                && ` · ${slotCapability.contested.length} contested`}
                            </span>
                          )}
                          {resourceLedger && resourceLedger.rows.length > 0 && (() => {
                            const total = resourceLedger.rows.reduce((t, r) => t + r.totalUses, 0);
                            const off = resourceLedger.rows.reduce((t, r) => t + r.offense, 0);
                            const sus = resourceLedger.rows.reduce((t, r) => t + r.sustain, 0);
                            const recovered = resourceLedger.rows.reduce((t, r) => t + r.recoveredPerShortRest, 0);
                            return (
                              <span style={{ color: "#777", marginLeft: 8 }}
                                title={`Resource Conversion: ${RESOURCE_DAY.fightsPerLongRest} fights x ${RESOURCE_DAY.roundsPerFight} rounds, one Short Rest after fight ${RESOURCE_DAY.shortRestAfterFight}. Total usable = starting + recovered + free, and each use is reserved once across offense / sustain / other.` + String.fromCharCode(10, 10)
                                  + resourceLedger.rows.map(r => `${r.actor} · ${r.resource}: ${r.startUses}+${r.recoveredPerShortRest}/rest+${r.freeUses} = ${r.totalUses}`
                                    + ` → ${r.offense.toFixed(1)} off / ${r.sustain.toFixed(1)} sus / ${r.other.toFixed(1)} other${r.contested ? " (contested)" : ""}`).join(String.fromCharCode(10))}>
                                {"· day budget "}{total.toFixed(0)}{" uses ("}{off.toFixed(0)}{" off / "}{sus.toFixed(0)}{" sus"}
                                {recovered > 0 ? `, +${recovered.toFixed(0)} at the short rest` : ""}{")"}
                              </span>
                            );
                          })()}
                          {currentParty && currentParty.round1Dpr > 0 && (
                            <span style={{ color: "#777", marginLeft: 8 }}
                              title={"Read off the chosen characters and scheduled by the checker's own action tracer, against this fight's bodies."
                                + String.fromCharCode(10, 10)
                                + `at-will ${currentParty.atWill.round1.toFixed(1)} / ${currentParty.atWill.round2.toFixed(1)} / ${currentParty.atWill.round3.toFixed(1)} / ${currentParty.atWill.round4Plus.toFixed(1)}`
                                + String.fromCharCode(10)
                                + "resource uses, best first, one per round:" + String.fromCharCode(10)
                                + (currentParty.schedule.length === 0 ? "  (none priced)"
                                  : currentParty.schedule.map((s) => `  R${s.round} ${s.actor} · ${s.action} (${s.trigger}) +${s.valuePerUse.toFixed(1)} x${s.usesPerFight.toFixed(2)}`).join(String.fromCharCode(10)))
                                + String.fromCharCode(10, 10)
                                + `audit only — ${currentParty.audit.damagePerDay.toFixed(0)} resource damage/day, ${currentParty.audit.flatUpliftPerRound.toFixed(1)}/round across ${RESOURCE_DAY.combatRoundsPerLongRest}. Row 45: the daily average is an audit result, not the round profile.`
                                + (currentParty.estimated.length > 0 ? String.fromCharCode(10, 10) + "ESTIMATED:" + String.fromCharCode(10) + currentParty.estimated.map((s: string) => "  " + s).join(String.fromCharCode(10)) : "")
                                + (currentParty.needsInput.length > 0 ? String.fromCharCode(10, 10) + "NEEDS DM INPUT — damaging actions that could not be read:" + String.fromCharCode(10) + currentParty.needsInput.map((s: string) => "  " + s).join(String.fromCharCode(10)) : "")
                                + (currentParty.unlinked.length > 0 ? String.fromCharCode(10, 10) + "NOT LINKED — read fine, but nothing connects them to a pool, so they schedule as zero:" + String.fromCharCode(10) + currentParty.unlinked.map((s: string) => "  " + s).join(String.fromCharCode(10)) : "")}>
                              {"· read R1 "}{currentParty.round1Dpr.toFixed(1)}
                              {" → R4+ "}{currentParty.round4PlusDpr.toFixed(1)}
                              {currentParty.needsInput.length > 0 ? ` · ${currentParty.needsInput.length} unread` : ""}
                              {currentParty.unlinked.length > 0 ? ` · ${currentParty.unlinked.length} not linked` : ""}
                              {currentParty.estimated.length > 0 ? ` · ${currentParty.estimated.length} estimated` : ""}
                            </span>
                          )}
                          {/* ── WHAT THE CLASSES PREVENT ────────────────────────────────────
                              Silent only when there is genuinely nothing to say. A party that has
                              stated no responses is told so by name, because a missing multiplier
                              and an un-entered one look identical on a number. */}
                          {classMitigation && (classMitigation.multiplier > 1.0001 || classMitigation.reactionPerRound > 0) && (
                            <span style={{ color: "#777", marginLeft: 8 }}
                              title={[
                                /* ⚠ A SHARE IS A SHARE OF WHAT COULD BE TYPED. Say how much that
                                   was, or a resistance weighed against a quarter of the fight
                                   reads as though it were weighed against all of it. */
                                classMitigation.mixCoverage < 0.999
                                  ? `⚠ only ${(classMitigation.mixCoverage * 100).toFixed(0)}% of this fight's damage states a type, so every share below is a share of THAT much. Typing the rest of the stat block is what makes these exact.\n`
                                  : "",
                                classMitigation.resisted.length > 0
                                  ? "Resistances, weighed against what THIS fight throws:\n"
                                    + classMitigation.resisted.map(r => `  ${r.actor} · ${r.response.response} to ${r.response.type} — ${(r.share * 100).toFixed(1)}% of incoming · ${r.source}${r.uptimeNote ? ` · ${r.uptimeNote}` : ""}${r.qualifierUnresolved ? ` (⚠ "${r.response.qualifier}" could not be applied — priced as the upper bound)` : ""}`).join("\n")
                                  : "",
                                classMitigation.reactions.length > 0
                                  ? "\nReactions, one per character:\n"
                                    + classMitigation.reactions.map(r => `  ${r.actor} · ${r.action} ${r.amount.toFixed(1)}/round (${r.basis})`).join("\n")
                                  : "",
                                classMitigation.displacedByBond.length > 0
                                  ? "\nDisplaced — the bond's reaction is worth more, and one Reaction cannot be spent twice:\n"
                                    + classMitigation.displacedByBond.map(d => `  ${d.actor} · ${d.action} ${d.amount.toFixed(1)} < bond ${d.bondAmount.toFixed(1)}`).join("\n")
                                  : "",
                                classMitigation.withoutStatedResponses.length > 0
                                  ? `\nNo damage responses at all — nothing from their class or lineage, and nothing entered: ${classMitigation.withoutStatedResponses.join(", ")}. A choice-dependent one (a Dragonborn's ancestry, a Tiefling's legacy, a Totem) is entered on the Profile tab, because the sheet does not state which one it is.`
                                  : "",
                              ].filter(Boolean).join("\n")}>
                              {"· classes "}
                              {classMitigation.multiplier > 1.0001 ? `x${classMitigation.multiplier.toFixed(2)} EHP` : ""}
                              {classMitigation.multiplier > 1.0001 && classMitigation.reactionPerRound > 0 ? " + " : ""}
                              {classMitigation.reactionPerRound > 0 ? `${classMitigation.reactionPerRound.toFixed(1)}/rd reactions` : ""}
                            </span>
                          )}
                          {classMitigation && classMitigation.multiplier <= 1.0001 && classMitigation.reactionPerRound === 0
                            && classMitigation.withoutStatedResponses.length > 0 && (
                            <span style={{ color: "#777", marginLeft: 8 }}
                              title={`${classMitigation.withoutStatedResponses.join(", ")} have no damage responses — their class and lineage grant none, and none are entered. A choice-dependent one (a Dragonborn's ancestry, a Tiefling's legacy, a Totem Barbarian) is entered on the Profile tab, because the sheet does not state which one it is. Nothing here is read out of a feature's description.`}>
                              · no resistances ({classMitigation.withoutStatedResponses.length})
                            </span>
                          )}
                                                    {(bondMitigation?.perRound ?? 0) > 0 && (() => {
                            /*
                              ⚠ WHICH ARRANGEMENT IS IN FORCE, SAID OUT LOUD. This read "counted on
                              the clock, not in sustain" in both modes, which is only true of the
                              bond-free WotC Standard baseline. The Broken Chain row is certified
                              from BC actor state INCLUDING active legal Bonds, so on that side the
                              honest sentence is the opposite one.
                            */
                            const bm = bondArrange;
                            return (
                              <span style={{ color: "#777", marginLeft: 8 }}
                                title="Bonds are counted once: either inside the sustain denominator or on the combat clock, never both. Toggling bonds off must move the clock exactly once.">
                                {"· bonds "}{(bondMitigation?.perRound ?? 0).toFixed(1)}{"/rd — "}{bm.reason}
                              </span>
                            );
                          })()}
                          {/*
                            ⚠ SAY WHERE THE OFFENCE SIDE CAME FROM, BECAUSE THE TWO ANSWERS MEAN
                            OPPOSITE THINGS.

                            Christopher, 2026-09-07: *"you are saying my party does the exact
                            amount that the workbook balanced center does with this being 3/5
                            being new players character?"* — and, on being told the app did not
                            know: *"what do you mean the app cant know what my actors hit for
                            [...] if we know everything on the actor we should know everything
                            that actor can do."*

                            He was right, and `currentPartyMetrics` is the answer: the characters'
                            own actions scheduled by the checker's tracer, their resources counted
                            by the ledger and placed in rounds. When that reading succeeds this
                            says so. When it cannot — no fight chosen, no readable roster — the
                            certified line for this SIZE stands in, and a near-zero delta then
                            means a row compared with itself, which is the thing that must never
                            look earned.
                          */}
                          <span style={{ color: "#777", marginLeft: 8 }}
                            title={offenceSource === "read"
                              ? "R1..R4+ are these characters' own at-will routine plus their resource uses, scheduled best-first one per round against this fight's bodies. Feats are not added on top — they are already inside the actions that were scheduled. Sustain is still the certified floor plus read healing."
                              : "resolvePartyProfile reads a level and a party size, not your characters. Offence is the certified curve for this size; only feats, healing, defence, bond mitigation and hit chance are read from the chosen actors. A near-zero delta means 'this size's line, plus what we can read', not 'your party is exactly average'."}>
                            {offenceSource === "read"
                              ? `· offence read from these ${partySize} characters — at-will + scheduled resources`
                              : `· offence is the certified ${partySize}P line + feats, not read from these characters`}
                          </span>
                        </div>
                      )}
                      {/*
                        ⚠ UNDER SUSTAIN, NOT INSIDE IT — and that is the whole point.

                        The party curve is the 128-party field, and v9's methods sheet flags what
                        that field could not do: *"Class healing — no invented healing or revival
                        package was assigned to abstract parties. Class/subclass identities absent
                        from 128 source profiles."* So `sustain` has a hole exactly the size of
                        what this party can heal, and every clock reading has been high by it.

                        Folding it into `sustain` would move every reading at once and quietly
                        change what the 35-45% gate band means, since that band was calibrated
                        against a sustain figure that excluded this. So it sits beneath the
                        published number where both can be read, and the band stays arguable.
                      */}
                      {partyHealing.total > 0 && (
                        <div style={{ fontSize: 10, color: "#6a8a6a", marginTop: 2 }}>
                          {"+ healing "}<strong style={{ color: "#7fbf7f" }}>{partyHealing.total}</strong>
                          {" HP not in that sustain — "}
                          {partyHealing.sources.map(s => `${s.actor} ${s.label} ${s.amount}`).join(" · ")}
                          {". Same-encounter pools only; hit dice are short-rest recovery and already counted."}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* THE PARTY CLOCK — what this fight COSTS, as a share of what the party has.
                      Christopher, 2026-08-16: a gate landing at 35-45% *"would still make a
                      party consider resting if they have used the resources against 2
                      encounters and then hit that gate."* The rest decision is CUMULATIVE, so
                      the cost of one fight is only half the reading — the other half is what
                      the party has left when it walks in, which is the control below. */}
                  <div style={{ ...box, marginBottom: 8, fontSize: 10 }}>
                    <span style={{ color: "#8a8aa0" }}>PARTY CLOCK </span>
                    <strong style={{ color: partyClock.thisFight >= 0.5 ? "#e07b39" : "#7be08a" }}>
                      {(partyClock.thisFight * 100).toFixed(0)}%
                    </strong>
                    <span style={{ color: "#555" }}> of a full party's sustain spent on this fight</span>
                    {arrivingSpent > 0 && (
                      <>
                        <span style={{ color: "#555" }}> · arriving {(arrivingSpent * 100).toFixed(0)}% down → </span>
                        <strong style={{ color: partyClock.cumulative >= 1 ? "#ff4444" : partyClock.cumulative >= 0.75 ? "#e07b39" : "#7be08a" }}>
                          {(partyClock.cumulative * 100).toFixed(0)}% spent by the end
                        </strong>
                      </>
                    )}
                  </div>

                  {/* ⚠ WHAT THE BONDS STOPPED, AND WHAT THEY DID NOT. The party clock above is
                      already NET of this, so without the line a DM has no way to see why a gate
                      got easier — the number would simply have moved. Every source names the
                      character and the option it assumed, because the bond fires once a round and
                      a table that plays the offensive line gets a different fight. */}
                  {bondMitigation && (bondMitigation.sources.length > 0 || bondMitigation.withoutBond.length > 0
                    || bondMitigation.bondWithoutMitigation.length > 0) && (
                    <div style={{ ...box, marginBottom: 8, fontSize: 10 }}>
                      <span style={{ color: "#8a8aa0" }}>BONDS PREVENT </span>
                      <strong style={{ color: "#7fbf7f" }}>{bondMitigation.perRound.toFixed(1)} HP</strong>
                      <span style={{ color: "#555" }}> per round · already taken off the clock above</span>
                      {bondMitigation.sources.length > 0 && (
                        <div style={{ marginTop: 3, color: "#777", lineHeight: 1.5 }}>
                          {bondMitigation.sources.map(s =>
                            `${s.actor} ${s.option} ${s.amount.toFixed(1)} (${s.kind}${s.held ? ", held" : ""})`).join(" · ")}
                        </div>
                      )}
                      {/* ⚠ A BOND THAT MITIGATES NOTHING IS STILL ACCOUNTED FOR. Ripsnarl carries
                          Skirmish — pure damage and movement — and without this line a DM reading
                          a four-person party sees three names and no word about the fourth. */}
                      {bondMitigation.bondWithoutMitigation.length > 0 && (
                        <div style={{ marginTop: 3, color: "#777" }}>
                          {bondMitigation.bondWithoutMitigation.map(b => `${b.actor} ${b.bond}`).join(" · ")}
                          {" — read, and carries no mitigation on either branch."}
                        </div>
                      )}
                      {bondMitigation.withoutBond.length > 0 && (
                        <div style={{ marginTop: 3, color: "#e0b070" }}>
                          No bond assigned: {bondMitigation.withoutBond.join(", ")} — their mitigation is not in this figure.
                        </div>
                      )}
                      {bondMitigation.unpriced.length > 0 && (
                        <div style={{ marginTop: 4, paddingTop: 4, borderTop: "1px solid #2a2a3e", color: "#e0b070", lineHeight: 1.45 }}>
                          {bondMitigation.unpriced.length} bond effect{bondMitigation.unpriced.length === 1 ? "" : "s"} real but NOT priced —
                          {" "}{[...new Set(bondMitigation.unpriced.map(u => u.reason))].join(", ")}.
                          {" "}The party is stronger than this figure, never weaker.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Balance adjustment — the contract's own recommendation output. */}
                  {result.balanceAdjustment.scaledHpChange !== null && (
                    <div style={{ ...box, marginBottom: 8, fontSize: 10, color: "#777" }}>
                      <span style={{ color: "#7be08a" }}>TO HIT A {targetSafetyMargin}-ROUND MARGIN</span>{" "}
                      <strong style={{ color: result.balanceAdjustment.scaledHpChange < 0 ? "#e07b39" : "#4caf50" }}>
                        {result.balanceAdjustment.scaledHpChange > 0 ? "+" : ""}
                        {result.balanceAdjustment.scaledHpChange.toFixed(0)} EHP
                      </strong>
                      <span style={{ color: "#555" }}>
                        {" ("}{((result.balanceAdjustment.percentChange ?? 0) * 100).toFixed(0)}%
                        {", "}{(result.balanceAdjustment.baseFourPcHpChange ?? 0).toFixed(0)} at the 4P base{")"}
                      </span>
                    </div>
                  )}

                  {/* NOTHING IS SILENT — *"if the checker has no idea how to parse something
                      it will tell the dm to cal[culate] that damage."* A silent OMISSION
                      reaches the total exactly as unchallenged as a silent substitute would.
                      A well-formed stat block should produce NONE of these; they mean
                      something is written wrong or is an inferred action. */}
                  {/* ⚠ "COULD NOT PRICE" WAS WRONG FOR MOST OF WHAT IT LISTED. The heading counted
                      every assumption, but the two flags mean opposite things:

                        ESTIMATED       — it WAS priced, against a stated basis (an area against
                                          the four-PC benchmark, say). The number is in the total.
                        NEEDS DM INPUT  — it genuinely could not be priced and scored ZERO.

                      Reporting "3 things the checker could not price" for a library encounter
                      whose every number had in fact been computed made shipped content look
                      broken. Christopher, 2026-08-20: *"there is still 3 things the checker cant
                      price and this is against the encounter that is from the library."* Two of
                      those three were priced; the third was a real parser gap, now fixed. */}
                  {/**
                    * ⚠ ONLY WHAT IS NOT PRICED. Christopher, 2026-08-31: *"if something is
                    * priced (like lair actions) there shouldn't be a text that says anything
                    * about it, the only time the text should be there (including the fire
                    * resistance text) should be if something isn't built right or can[’t] be
                    * priced because it's a new action."*
                    *
                    * The ESTIMATED lines were narration of work that had already succeeded — a
                    * lair action explaining how it was priced in both directions, a typed
                    * resistance explaining the share it read off the party. Correct, and charged
                    * to the DM on every single read. The rule is now simple: this box means
                    * SOMETHING IS WRONG OR MISSING. An empty box is the good outcome.
                    *
                    * ESTIMATED assumptions still exist in the data and the scripts still print
                    * them — `validate:segments` and the gates want the full picture. It is the
                    * PANEL that stops narrating.
                    */}
                  {(() => {
                    const blocked = roster.assumptions.filter(a => a.flag === "NEEDS DM INPUT");
                    if (blocked.length === 0) return null;
                    return (
                    <div style={{ ...box, marginBottom: 8, fontSize: 10 }}>
                      <div style={{ fontWeight: 600, marginBottom: 2, color: "#e07b39" }}>
                        {`${blocked.length} thing${blocked.length === 1 ? "" : "s"} the checker could not price — ${blocked.length === 1 ? "it scores" : "they score"} 0 until you fill ${blocked.length === 1 ? "it" : "them"} in`}
                      </div>
                      {blocked.map((a, i) => (
                        <div key={i} style={{ color: "#e07b39" }}>
                          {a.creature} · {a.field} — {a.detail}
                        </div>
                      ))}
                    </div>
                    );
                  })()}

                  {result.specialOutcomeRisks.length > 0 && (
                    <div style={{ ...box, marginBottom: 8, fontSize: 10, color: "#c9a227" }}>
                      {result.specialOutcomeRisks.map((r, i) => (
                        <div key={i}>
                          ⚠ {r.creature} · {r.name} — earliest R{r.earliestRound},{" "}
                          {(r.probabilityAtLeastOne * 100).toFixed(0)}% at least one. Reported, never counted as damage.
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ⚠ THIS LINE USED TO CALL A PUBLISHED FIGURE A GUESS. It said "your entry, not a
                      workbook figure" unconditionally — including in the default case, where both
                      numbers come from `partyDefenceCurve`, transcribed verbatim from the v7 pricing
                      reference and reconciled across all 280 cells. Christopher: *"why would the
                      checker not already know where the standard party ac is when the referenced
                      file already has that in."* It does know; the sentence was lying about it.
                      It now says which of the two it actually used, and only claims an entry when
                      the DM has genuinely overridden one. */}
                  <div style={{ fontSize: 9, color: "#666", marginBottom: 6 }}>
                    Survivor counts are model projections under {allocation === "focus_fire" ? "focus fire" : "even spread"}, not observed outcomes.
                    {" "}Every attack was resolved against AC {Number(targetAc.toFixed(2))}{acOverride === null ? "" : " (your override)"}
                    {" "}and every save against a +{Number(targetSave.toFixed(2))}{saveOverride === null ? "" : " (your override)"} bonus
                    {defenceBasis === "override"
                      ? " — an override you entered, replacing everything below it."
                      : defenceBasis === "actors"
                        ? ` — read from the ${chosen.length} chosen characters' own armour and save proficiencies. DEX saves resolved at +${saves.dex.toFixed(2)}, not the six-way mean.`
                        : ` — the published ${equipmentMode === "brokenChain" ? "Broken Chain" : "Standard"} party curve at level ${partyLevel}. The workbook stamps it a PROVISIONAL PROXY; choose a party to read real characters.`}
                  </div>

                  <details>
                    <summary style={{ fontSize: 10, color: "#8a8aa0", cursor: "pointer" }}>
                      Round by round ({result.rounds.length})
                    </summary>
                    <div style={{ fontSize: 9, color: "#777", marginTop: 4 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "24px repeat(6, 1fr)", gap: 3, color: "#8a8aa0", fontWeight: 600 }}>
                        <span>R</span><span>Party</span><span>Cum</span><span>EHP left</span><span>Mon dmg</span><span>Down</span><span>Standing</span>
                      </div>
                      {result.rounds.map(r => (
                        <div key={r.round} style={{ display: "grid", gridTemplateColumns: "24px repeat(6, 1fr)", gap: 3,
                          color: r.fatalNow ? "#ff4444" : r.completesNow ? "#4caf50" : "#777" }}>
                          <span>{r.round}</span>
                          <span>{r.partyDamage.toFixed(0)}</span>
                          <span>{r.cumulativePartyDamage.toFixed(0)}</span>
                          <span>{r.monsterEhpLeft.toFixed(0)}</span>
                          <span>{r.monsterDamage.toFixed(0)}</span>
                          <span>{r.downs}</span>
                          <span>{r.standing}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                </>
              ) : (
                <p style={{ fontSize: 11, color: "#8a6a2a", fontStyle: "italic" }}>
                  This encounter has no readable creatures yet.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
