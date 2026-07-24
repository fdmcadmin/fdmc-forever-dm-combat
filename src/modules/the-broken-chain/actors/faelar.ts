import type { Actor } from "../../../core/types/actor";
import { brokenChainBonds } from "../content/bonds";
import { faelarPinnedReactions } from "../content/pinnedReactions";
import { createPlayerTabs } from "../content/tabActions";
import { attackAction, checks, feature, normalizedAction, reminder } from "./actorHelpers";

// ─── Owner-derived inputs ─────────────────────────────────────────────────────
// Almost nothing on the Beast of the Land is its own — AC, HP, to-hit, damage, saves
// and checks all read off LYRIELLE. These three numbers are the only inputs; every
// value below is computed from them, so a level-up is a one-line change here.
//
// NOTE: the bundled `lyrielle.ts` still says level 2 — that file is stale relative to
// the live room. Level 5 is pinned three independent ways: a proficiency bonus of 3
// (levels 5-8), HP 30 = 5 + 5 × 5, and 5 Hit Dice (d8s equal to ranger level).

/** Lyrielle's ranger level. */
const RANGER_LEVEL = 5;
/** Lyrielle's proficiency bonus — 3 at levels 5-8. */
const RANGER_PROFICIENCY_BONUS = 3;
/** Lyrielle's Wisdom modifier (WIS 14). Drives the beast's AC and its damage. */
const RANGER_WIS_MOD = 2;

/** "AC 13 plus your Wisdom modifier" → 15. */
const BEAST_AC = 13 + RANGER_WIS_MOD;
/** "HP 5 plus five times your Ranger level" → 30. Hit Dice = ranger level in d8s. */
const BEAST_HP = 5 + 5 * RANGER_LEVEL;
/** Beast's Strike to-hit = the ranger's spell attack modifier (PB + WIS). */
const BEAST_ATTACK = RANGER_PROFICIENCY_BONUS + RANGER_WIS_MOD;
/** Beast's Strike damage = 1d8 + 2 + the ranger's Wisdom modifier. */
const BEAST_DAMAGE_BONUS = 2 + RANGER_WIS_MOD;
/** Primal Bond: every save and check is the beast's own modifier + the ranger's PB. */
const beastSave = (score: number) => Math.floor((score - 10) / 2) + RANGER_PROFICIENCY_BONUS;
const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

/**
 * Faelar — Lyrielle's Primal Companion in her Beast of the Land form.
 *
 * Everything mechanical here is keyed to the RANGER, not to the beast:
 *
 *  · AC   13 + her Wisdom modifier (not the beast's Dexterity).
 *  · HP   5 + 5 × her ranger level — NOT a fixed 30; it scales every level.
 *  · Saves + checks  Primal Bond adds her proficiency bonus to ALL of them, so the
 *    printed saves are `ability mod + PB` and do NOT match the raw scores. That is
 *    what `abilityScores[x].save` is for — the card shows the score and its own
 *    modifier, with the real save on the bottom line.
 *      STR 14 (+2) → +5 · DEX 14 (+2) → +5 · CON 15 (+2) → +5
 *      INT  8 (-1) → +2 · WIS 14 (+2) → +5 · CHA 11 (+0) → +3
 *  · Beast's Strike  to-hit = her SPELL ATTACK modifier (PB + WIS); damage =
 *    1d8 + 2 + her WISDOM modifier.
 *
 * These are computed from the constants above rather than written as `@vars` on
 * purpose: `@WIS`/`@PROF` resolve against the BEAST's own scores, which is the wrong
 * creature. It happens to be numerically identical today (beast WIS 14 = hers), which
 * is exactly the coincidence that would silently break on her next ASI.
 */
export const faelar: Actor = {
  id: "faelar",
  kind: "companion",
  name: "Faelar",
  subtitle: "Beast of the Land · Primal Companion · Owner: Lyrielle",
  race: "Beast of the Land",
  className: "Primal Companion",
  level: 0,
  stats: {
    ac: BEAST_AC,
    hp: { current: BEAST_HP, max: BEAST_HP, temp: 0 },
    speed: "40 ft, Climb 40 ft",
  },
  // score = the beast's own ability; save = that modifier + Lyrielle's PB (Primal Bond),
  // so every save moves in step with her proficiency bonus rather than the raw score.
  abilityScores: {
    str: { score: 14, save: beastSave(14) },
    dex: { score: 14, save: beastSave(14) },
    con: { score: 15, save: beastSave(15) },
    int: { score: 8, save: beastSave(8) },
    wis: { score: 14, save: beastSave(14) },
    cha: { score: 11, save: beastSave(11) },
  },
  classFeatureTracker: {
    label: "Primal Companion",
    value: "Beast of the Land",
    note: `AC 13+WIS · HP 5 + 5×ranger level ${RANGER_LEVEL} = ${BEAST_HP} (${RANGER_LEVEL}d8). Damage type chosen when summoned.`,
  },
  pinnedReactions: faelarPinnedReactions,
  tabs: createPlayerTabs({
    main: [
      attackAction({
        id: "beasts-strike",
        label: "Beast's Strike",
        attack: `1d20${fmt(BEAST_ATTACK)}`,
        damage: `1d8${fmt(BEAST_DAMAGE_BONUS)}`,
        range: "Reach 5 ft",
        details:
          `Melee attack. To-hit equals Lyrielle's spell attack modifier (${fmt(BEAST_ATTACK)}); damage is 1d8 + 2 + her Wisdom modifier. ` +
          "Bludgeoning, piercing or slashing — the type is chosen when the beast is summoned. " +
          "If the beast moved at least 20 ft. straight toward the target before the hit, it deals an extra 1d6 of the " +
          "same type and the target has the Prone condition if it is Large or smaller.",
        economyCost: ["main"],
      }),
      normalizedAction({
        id: "beasts-strike-charge",
        label: "Charge Rider (+1d6)",
        damage: "1d6",
        actionKind: "attack",
        details:
          "Only when the beast moved at least 20 ft. straight toward the target before the hit. Extra 1d6 of the same " +
          "damage type as Beast's Strike; the target has the Prone condition if it is Large or smaller. " +
          "Rider on the strike — costs no action of its own.",
        economyCost: [],
      }),
    ],
    bond: [],
    checksOverride: checks([
      // Primal Bond adds Lyrielle's PB to every check, on top of the beast's own modifier.
      // WIS 14 and DEX 14 both give +2, so these all land on the same number today.
      ["Perception", `[1d20${fmt(beastSave(14))}] · Advantage when relying on hearing or smell.`, "Ability Checks"],
      ["Stealth", `[1d20${fmt(beastSave(14))}]`, "Ability Checks"],
      ["Athletics", `[1d20${fmt(beastSave(14))}]`, "Ability Checks"],
      ["Survival", `[1d20${fmt(beastSave(14))}]`, "Ability Checks"],
    ]),
    featuresOverride: [
      feature(
        "primal-bond",
        "Primal Bond",
        `Add Lyrielle's Proficiency Bonus (${RANGER_PROFICIENCY_BONUS}) to any ability check or saving throw Faelar makes. Already included in the saves and checks shown on this card.`,
        "Features / Passives",
      ),
      feature(
        "keen-hearing-smell",
        "Keen Hearing and Smell",
        "Advantage on Wisdom (Perception) checks that rely on hearing or smell.",
        "Features / Passives",
      ),
      feature(
        "ranger-companion",
        "Acts on Lyrielle's Turn",
        "Faelar takes her turn during Lyrielle's turn — select Faelar in the combat tracker to spend her action. Lyrielle commands her as part of her own turn flow.",
        "Companion Reference",
      ),
    ],
    equipmentOverride: [],
    resourcesOverride: [],
    outOfCombatOverride: [],
    notesOverride: [
      // Passive Perception = 10 + the Primal-Bond-boosted Perception modifier.
      reminder("senses", "Senses", `Darkvision 60 ft. Passive Perception ${10 + beastSave(14)}.`),
      reminder(
        "summon-damage-type",
        "Damage Type",
        "Beast's Strike deals bludgeoning, piercing or slashing — chosen when Faelar is summoned. Note the choice here for the session.",
      ),
    ],
  }),
  moduleData: {
    act: 2,
    theme: "frozen-north-horror",
    statBlockStatus: "confirmed",
    ownerId: "lyrielle",
    bond: brokenChainBonds.faelar,
  },
};
