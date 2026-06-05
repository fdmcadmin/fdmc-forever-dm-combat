import type { Actor } from "../../../core/types/actor";
import { brokenChainBonds } from "../content/bonds";
import { faelarPinnedReactions } from "../content/pinnedReactions";
import { createPlayerTabs } from "../content/tabActions";
import { attackAction, checks, feature, reminder } from "./actorHelpers";

export const faelar: Actor = {
  id: "faelar",
  kind: "companion",
  name: "Faelar",
  subtitle: "Wolf Companion · Pre-BotL baseline · Owner: Lyrielle",
  race: "Wolf",
  className: "Companion Reference",
  level: 0,
  stats: {
    ac: 13,
    hp: { current: 11, max: 11, temp: 0 },
    speed: "40 ft",
  },
  abilityScores: {
    str: { modifier: 1 },
    dex: { modifier: 2 },
    con: { modifier: 1 },
    int: { modifier: -4 },
    wis: { modifier: 1 },
    cha: { modifier: -2 },
  },
  classFeatureTracker: {
    label: "Companion Baseline",
    value: "Pre-BotL Wolf",
    note: "Upgrade waits for Lyrielle level 3 / v1.1.",
  },
  pinnedReactions: faelarPinnedReactions,
  tabs: createPlayerTabs({
    main: [
      attackAction({ id: "bite", label: "Bite", attack: "1d20+4", damage: "1d4 piercing", range: "Reach 5 ft", details: "One target. Resolve companion timing by current table ruling.", economyCost: ["main"] }),
    ],
    bond: [],
    checksOverride: checks([
      ["Perception", "[1d20+3] · Advantage when relying on hearing or smell.", "Ability Checks"],
      ["Stealth", "[1d20+4]", "Ability Checks"],
    ]),
    featuresOverride: [
      feature("keen-hearing-smell", "Keen Hearing and Smell", "Advantage on Wisdom (Perception) checks that rely on hearing or smell.", "Features / Passives"),
      feature("ranger-companion", "Ranger Companion Reminder", "Faelar acts after Lyrielle. Use Lyrielle's turn flow and current table ruling for movement and commands.", "Companion Reference"),
    ],
    equipmentOverride: [],
    resourcesOverride: [],
    outOfCombatOverride: [],
    notesOverride: [
      reminder("passive-perception", "Passive Perception", "Passive Perception 13."),
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
