import type { Actor } from "../../../core/types/actor";
import { brokenChainBonds } from "../content/bonds";
import { leedragoonPinnedReactions } from "../content/pinnedReactions";
import { createBrokenChainDrainTrackers } from "../content/drainTrackers";
import { createPlayerTabs } from "../content/tabActions";
import { attackAction, bondAction, commonSkillChecks, compactResource, feature, passiveEquipment, reminder, reactionFeature, utility, referenceUtility } from "./actorHelpers";

export const leedragoon: Actor = {
  id: "leedragoon",
  kind: "player",
  name: "Leedragoon",
  subtitle: "Variant Human Gunslinger · Level 2 · current baseline",
  race: "Variant Human",
  className: "Gunslinger",
  level: 2,
  stats: {
    ac: 14,
    hp: { current: 17, max: 17, temp: 0 },
    speed: "30 ft",
  },
  abilityScores: {
    str: { score: 10, modifier: 0 },
    dex: { score: 15, modifier: 4 },
    con: { score: 15, modifier: 2 },
    int: { score: 14, modifier: 2 },
    wis: { score: 12, modifier: 1 },
    cha: { score: 8, modifier: 1 },
  },
  classFeatureTracker: {
    label: "Risk Dice",
    value: "4 / 4 d8",
    note: "Recover on Short or Long Rest. Weapon crit range 19-20.",
  },
  pinnedReactions: leedragoonPinnedReactions,
  tabs: createPlayerTabs({
    main: [
      attackAction({ id: "double-barrel-shotgun", label: "Double-Barrel Shotgun", attack: "1d20+6", damage: "2d6+2", crit: "4d6+2", range: "20/60 ft", details: "Scatter, Recoil, Reload, Two-Handed. Crits 19-20.", critThreshold: 19, diceLabel: "DBS", economyCost: ["main"] }),
      attackAction({ id: "revolver", label: "Revolver", attack: "1d20+6", damage: "2d6+2", crit: "4d6+2", range: "30/120 ft", details: "Recoil, Reload, Slow. Crits 19-20.", critThreshold: 19, economyCost: ["main"] }),
      attackAction({ id: "sniper-rifle", label: "Sniper Rifle", attack: "1d20+6", damage: "2d8+2", crit: "4d8+2", range: "100/400 ft", details: "Heavy, Loading, Two-Handed, Sighted. Crits 19-20.", critThreshold: 19, economyCost: ["main"] }),
    ],
    bond: [
      bondAction({ id: "loaded-round", label: "Loaded Round", details: "Bond Action setup. Target cannot take reactions until their next turn." }),
    ],
    checksOverride: commonSkillChecks({
      acrobatics: "[1d20+4]",
      animalHandling: "[1d20+1]",
      arcana: "[1d20+2]",
      athletics: "[1d20+0]",
      deception: "[1d20-1]",
      history: "[1d20+4]",
      insight: "[1d20+1]",
      intimidation: "[1d20-1]",
      investigation: "[1d20+2]",
      medicine: "[1d20+1]",
      nature: "[1d20+4]",
      perception: "[1d20+1]",
      performance: "[1d20-1]",
      persuasion: "[1d20-1]",
      religion: "[1d20+2]",
      sleightOfHand: "[1d20+4]",
      stealth: "[1d20+4]",
      survival: "[1d20+1]",
    }),
    featuresOverride: [
      feature("risk-dice-feature", "Risk Dice", "4/4 d8. Spend for maneuvers and recover on Short or Long Rest.", "Active Features"),
      feature("grazing-shot", "Grazing Shot", "Spend 1 Risk Die after a ranged miss to deal Risk Die +2 damage. Resolve and update the count at the table.", "Risk Dice Options", "table-note"),
      feature("maverick-spirit", "Maverick Spirit", "Spend 1 Risk Die on failed INT/WIS/CHA check or save to add it to the roll.", "Risk Dice Options", "table-note"),
      reactionFeature("skin-of-your-teeth", "Skin of Your Teeth", "Reaction. Spend 1 Risk Die after being hit to raise AC by the die result for that attack."),
      feature("quick-draw", "Quick Draw", "Advantage on Initiative. Initiative action includes this as 2d20kh1+2.", "Features / Passives"),
      feature("critical-shot", "Critical Shot", "Ranged weapon attacks score a critical hit on 19-20.", "Features / Passives"),
    ],
    equipmentOverride: [
      attackAction({ id: "equip-double-barrel-shotgun", label: "Double-Barrel Shotgun", attack: "1d20+6", damage: "2d6+2", crit: "4d6+2", range: "20/60 ft", details: "Weapon shortcut. Scatter, Recoil, Reload, Two-Handed. Crits 19-20.", critThreshold: 19, diceLabel: "DBS", economyCost: ["main"], category: "Weapon Roll Shortcuts" }),
      attackAction({ id: "equip-revolver", label: "Revolver", attack: "1d20+6", damage: "2d6+2", crit: "4d6+2", range: "30/120 ft", details: "Weapon shortcut. Recoil, Reload, Slow. Crits 19-20.", critThreshold: 19, economyCost: ["main"], category: "Weapon Roll Shortcuts" }),
      attackAction({ id: "equip-sniper-rifle", label: "Sniper Rifle", attack: "1d20+6", damage: "2d8+2", crit: "4d8+2", range: "100/400 ft", details: "Weapon shortcut. Heavy, Loading, Two-Handed, Sighted. Crits 19-20.", critThreshold: 19, economyCost: ["main"], category: "Weapon Roll Shortcuts" }),
      passiveEquipment("double-barrel-shotgun-reference", "DBS Reference", "Simple firearm, Recoil, Reload, Two-Handed, Scatter."),
      passiveEquipment("revolver-reference", "Revolver Reference", "Simple firearm, Recoil, Reload, Slow."),
      passiveEquipment("sniper-rifle-reference", "Sniper Rifle Reference", "Martial firearm, Heavy, Loading, Two-Handed, Sighted."),
    ],
    resourcesOverride: [],
    outOfCombatOverride: [
      utility("short-rest", "Short Rest", "Hit Dice: 2/2. Recover HP: 1d10+2 per Gunslinger Hit Die spent. Recover Risk Dice to 4/4."),
      referenceUtility("long-rest", "Long Rest", "Return to full HP. Recover hit dice up to half total. Recover Risk Dice to 4/4."),
    ],
    notesOverride: [
      reminder("passives", "Passives", "Passive Perception 11 · Passive Investigation 12 · Passive Insight 11."),
    ],
  }),
  moduleData: {
    act: 2,
    theme: "frozen-north-horror",
    statBlockStatus: "confirmed",
    bond: brokenChainBonds.leedragoon,
    ...createBrokenChainDrainTrackers(),
  },
};
