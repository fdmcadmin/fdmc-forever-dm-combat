import type { Actor } from "../../../core/types/actor";
import { brokenChainBonds } from "../content/bonds";
import { thaylaPinnedReactions } from "../content/pinnedReactions";
import { createBrokenChainDrainTrackers } from "../content/drainTrackers";
import { createPlayerTabs } from "../content/tabActions";
import { attackAction, bondAction, commonSkillChecks, compactResource, feature, passiveEquipment, reminder, reactionFeature, utility, referenceUtility } from "./actorHelpers";

export const thayla: Actor = {
  id: "thayla",
  kind: "player",
  name: "Thayla",
  subtitle: "Goliath Monk / Barbarian · Level 2 · current baseline",
  race: "Goliath",
  className: "Monk / Barbarian",
  level: 2,
  stats: {
    ac: 13,
    hp: { current: 17, max: 17, temp: 0 },
    speed: "30 ft",
  },
  abilityScores: {
    str: { score: 17, modifier: 5 },
    dex: { score: 14, modifier: 4 },
    con: { score: 13, modifier: 1 },
    int: { score: 10, modifier: 0 },
    wis: { score: 13, modifier: 1 },
    cha: { score: 8, modifier: -1 },
  },
  classFeatureTracker: {
    label: "Rage / Stone / Maul",
    value: "Rage 2/2 · Stone SR · Maul 1/LR",
    note: "Bond choice happens before action.",
  },
  pinnedReactions: thaylaPinnedReactions,
  tabs: createPlayerTabs({
    main: [
      attackAction({ id: "unarmed-strike", label: "Unarmed Strike", attack: "1d20+6", damage: "1d6+4", crit: "2d6+4", range: "Reach 5 ft", details: "Martial Arts baseline.", additive: "With Rage: 1d6+6 / crit 2d6+6", economyCost: ["main"] }),
      attackAction({ id: "dagger", label: "Dagger", attack: "1d20+5", damage: "1d6+3", crit: "2d6+3", range: "Reach 5 ft or 20/60 ft", details: "Finesse, Light, Thrown, Nick.", additive: "With Rage if attacking with STR: 1d6+5 / crit 2d6+5", economyCost: ["main"] }),
      attackAction({ id: "flail", label: "Flail", attack: "1d20+5", damage: "1d8+3", crit: "2d8+3", range: "Reach 5 ft", details: "Sap.", additive: "With Rage: 1d8+5 / crit 2d8+5", economyCost: ["main"] }),
      attackAction({ id: "quarterstaff", label: "Quarterstaff", attack: "1d20+5", damage: "1d6+3", crit: "2d6+3", range: "Reach 5 ft", details: "Versatile 1d8+3 / crit 2d8+3. Topple.", additive: "With Rage: +2 damage when using STR", economyCost: ["main"] }),
    ],
    bonus: [
      attackAction({ id: "bonus-unarmed-strike", label: "Bonus Unarmed Strike", attack: "1d20+6", damage: "1d6+4", crit: "2d6+4", range: "Reach 5 ft", details: "Martial Arts bonus strike.", additive: "With Rage: 1d6+6 / crit 2d6+6", economyCost: ["bonus"] }),
      attackAction({ id: "eldritch-maul", label: "Eldritch Maul", damage: "+1d6 force", crit: "+2d6 force", cost: "Bonus Action", details: "1/Long Rest. For 1 minute, melee attacks have 15 ft reach and deal extra force damage.", economyCost: ["bonus"], category: "Bonus Actions" }),
    ],
    bond: [
      bondAction({ id: "focus", label: "Focus", damage: "1d4", details: "Choose before taking an action. Defensive bond option on the next hit." }),
      bondAction({ id: "pressure", label: "Pressure", damage: "1d4", details: "Choose before taking an action. Offensive bond option for Thayla's next hit." }),
    ],
    checksOverride: commonSkillChecks({
      acrobatics: "[1d20+4]",
      animalHandling: "[1d20+1]",
      arcana: "[1d20+2]",
      athletics: "[1d20+5]",
      deception: "[1d20-1]",
      history: "[1d20+2]",
      insight: "[1d20+1]",
      intimidation: "[1d20-1]",
      investigation: "[1d20+0]",
      medicine: "[1d20+1]",
      nature: "[1d20+0]",
      perception: "[1d20+1]",
      performance: "[1d20-1]",
      persuasion: "[1d20-1]",
      religion: "[1d20+0]",
      sleightOfHand: "[1d20+2]",
      stealth: "[1d20+4]",
      survival: "[1d20+1]",
    }),
    featuresOverride: [
      feature("rage", "Rage", "2/2. Click to prepare Rage. It becomes active on the next eligible melee attack roll.", "Active Features", "table-note"),
      reactionFeature("stones-endurance", "Stone's Endurance", "1/Short Rest reaction, reduce damage by 1d12+1."),
      feature("eldritch-maul-tracker", "Eldritch Maul", "1/Long Rest. Reference lives here; actual activation lives as a Bonus Action.", "Equipment / Feature Tracking"),
      feature("martial-arts", "Martial Arts", "Can use Dexterity for Unarmed Strikes and Monk weapons; can use 1d6 damage die.", "Features / Passives"),
      feature("resistances", "Resistances", "Bludgeoning from nonmagical attacks while raging; Cold.", "Features / Passives"),
    ],
    equipmentOverride: [
      passiveEquipment("dagger", "Dagger", "Simple, Finesse, Light, Thrown, Nick."),
      passiveEquipment("flail", "Flail", "Martial, Sap."),
      passiveEquipment("quarterstaff", "Quarterstaff", "Simple, Versatile, Topple."),
      passiveEquipment("eldritch-maul", "Eldritch Maul", "Reference item. Activation appears as a Bonus Action, so equipment click stays non-logging."),
    ],
    resourcesOverride: [],
    outOfCombatOverride: [
      utility("short-rest", "Short Rest", "Hit Dice: Monk 1/1, Barbarian 1/1. Recover HP: 1d8+1 or 1d12+1. Recover Stone's Endurance."),
      referenceUtility("long-rest", "Long Rest", "Return to full HP. Recover hit dice up to half total. Reset Rage to 2/2 and daily features."),
    ],
    notesOverride: [
      reminder("passives", "Passives", "Passive Perception 11 · Passive Investigation 10 · Passive Insight 11."),
      reminder("languages", "Languages", "Celestial, Common, Giant, Ravenfolk."),
    ],
  }),
  moduleData: {
    act: 2,
    theme: "frozen-north-horror",
    statBlockStatus: "confirmed",
    bond: brokenChainBonds.thayla,
    ...createBrokenChainDrainTrackers(),
  },
};
