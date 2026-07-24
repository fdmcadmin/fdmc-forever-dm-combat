import type { Actor } from "../../../core/types/actor";
import { brokenChainBonds } from "../content/bonds";
import { faelarPinnedReactions } from "../content/pinnedReactions";
import { createPlayerTabs } from "../content/tabActions";
import { attackAction, checks, feature, normalizedAction, reminder } from "./actorHelpers";

/**
 * Faelar — Lyrielle's Primal Companion in her Beast of the Land form.
 *
 * Two things about this stat block are keyed to the RANGER, not to the beast:
 *
 *  1. Saves. Primal Bond adds Lyrielle's Proficiency Bonus (3) to every ability check
 *     and saving throw, so the printed saves are all `ability mod + 3` and do NOT match
 *     the raw scores. That's what `abilityScores[x].save` is for — the card shows the
 *     score and its own modifier, with the real save on the bottom line.
 *       STR 14 (+2) → +5 · DEX 14 (+2) → +5 · CON 15 (+2) → +5
 *       INT  8 (-1) → +2 · WIS 14 (+2) → +5 · CHA 11 (+0) → +3
 *
 *  2. Beast's Strike. To-hit equals Lyrielle's SPELL ATTACK modifier (PB 3 + WIS 2 = +5)
 *     and damage is 1d8 + 2 + her WISDOM modifier (1d8 + 2 + 2 = 1d8+4). These are stored
 *     resolved rather than as @vars on purpose: @WIS/@PROF would resolve against the
 *     BEAST's own scores, which is the wrong creature. Re-derive both if Lyrielle's
 *     Wisdom or proficiency bonus changes.
 *
 * Checks are likewise ability mod + PB 3 (Primal Bond) — which is why Perception is +5
 * and Passive Perception is exactly 15.
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
    ac: 15,
    hp: { current: 30, max: 30, temp: 0 },
    speed: "40 ft, Climb 40 ft",
  },
  // score = the beast's own ability; save = that modifier + Lyrielle's PB (Primal Bond).
  abilityScores: {
    str: { score: 14, save: 5 },
    dex: { score: 14, save: 5 },
    con: { score: 15, save: 5 },
    int: { score: 8, save: 2 },
    wis: { score: 14, save: 5 },
    cha: { score: 11, save: 3 },
  },
  classFeatureTracker: {
    label: "Primal Companion",
    value: "Beast of the Land",
    note: "HP 30 (5d8). Damage type chosen when summoned.",
  },
  pinnedReactions: faelarPinnedReactions,
  tabs: createPlayerTabs({
    main: [
      attackAction({
        id: "beasts-strike",
        label: "Beast's Strike",
        attack: "1d20+5",
        damage: "1d8+4",
        range: "Reach 5 ft",
        details:
          "Melee attack. To-hit equals Lyrielle's spell attack modifier (+5); damage is 1d8 + 2 + her Wisdom modifier. " +
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
      // Primal Bond adds Lyrielle's PB (3) to every check, on top of the beast's own modifier.
      ["Perception", "[1d20+5] · Advantage when relying on hearing or smell.", "Ability Checks"],
      ["Stealth", "[1d20+5]", "Ability Checks"],
      ["Athletics", "[1d20+5]", "Ability Checks"],
      ["Survival", "[1d20+5]", "Ability Checks"],
    ]),
    featuresOverride: [
      feature(
        "primal-bond",
        "Primal Bond",
        "Add Lyrielle's Proficiency Bonus (3) to any ability check or saving throw Faelar makes. Already included in the saves and checks shown on this card.",
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
      reminder("senses", "Senses", "Darkvision 60 ft. Passive Perception 15."),
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
