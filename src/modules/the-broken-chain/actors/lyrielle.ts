import type { Actor } from "../../../core/types/actor";
import { brokenChainBonds } from "../content/bonds";
import { lyriellePinnedReactions } from "../content/pinnedReactions";
import { createBrokenChainDrainTrackers } from "../content/drainTrackers";
import { createPlayerTabs } from "../content/tabActions";
import { attackAction, bondAction, checks, commonSkillChecks, compactResource, feature, passiveEquipment, reminder, spellAction, utility, referenceUtility } from "./actorHelpers";

export const lyrielle: Actor = {
  id: "lyrielle",
  kind: "player",
  name: "Lyrielle",
  subtitle: "Wood Elf Ranger · Level 2 · current baseline",
  race: "Wood Elf",
  className: "Ranger",
  level: 2,
  stats: {
    ac: 15,
    hp: { current: 20, max: 20, temp: 0 },
    speed: "35 ft",
  },
  abilityScores: {
    str: { score: 10, modifier: 2 },
    dex: { score: 16, modifier: 5 },
    con: { score: 15, modifier: 2 },
    int: { score: 8, modifier: -1 },
    wis: { score: 14, modifier: 2 },
    cha: { score: 12, modifier: 1 },
  },
  classFeatureTracker: {
    label: "Hunter's Mark / Faelar",
    value: "HM +1d6 · Faelar pre-BotL",
    note: "Faelar uses baseline wolf companion/reference data until level 3.",
  },
  pinnedReactions: lyriellePinnedReactions,
  tabs: createPlayerTabs({
    main: [
      attackAction({ id: "longbow", label: "Longbow", attack: "1d20+7", damage: "1d8+3", crit: "2d8+3", range: "150/600 ft", details: "Heavy, Two-Handed, Slow.", additive: "Hunter's Mark +1d6", economyCost: ["main"] }),
      attackAction({ id: "shortsword", label: "Shortsword", attack: "1d20+5", damage: "1d6+3", crit: "2d6+3", range: "Reach 5 ft", details: "Finesse, Light, Vex.", additive: "Hunter's Mark +1d6", economyCost: ["main"] }),
    ],
    spells: [
      spellAction({ id: "hunters-mark", label: "Hunter's Mark", damage: "+1d6 force on hit", range: "90 ft", cost: "Bonus Action", details: "Concentration up to 1 hour. Add force damage when Lyrielle hits the marked target.", economyCost: ["bonus"], category: "Bonus Action Spells" }),
    ],
    bond: [
      bondAction({ id: "faelar-reminder", label: "Faelar Reminder", details: "Faelar has baseline companion data. Resolve Faelar after Lyrielle using the current table ruling." }),
    ],
    checksOverride: [
      ...checks([
        ["Fey Charm WIS Save", "[2d20kh1+2] · Fey Ancestry, use when saving against being Charmed with Wisdom.", "Saves"],
        ["Fey Charm CHA Save", "[2d20kh1+1] · Fey Ancestry, use when saving against being Charmed with Charisma.", "Saves"],
      ]),
      ...commonSkillChecks({
        acrobatics: "[1d20+3]",
        animalHandling: "[1d20+4]",
        arcana: "[1d20-1]",
        athletics: "[1d20+2]",
        deception: "[1d20+1]",
        history: "[1d20-1]",
        insight: "[1d20+2]",
        intimidation: "[1d20+1]",
        investigation: "[1d20-1]",
        medicine: "[1d20+2]",
        nature: "[1d20+1]",
        perception: "[1d20+6]",
        performance: "[1d20+1]",
        persuasion: "[1d20+1]",
        religion: "[1d20-1]",
        sleightOfHand: "[1d20+3]",
        stealth: "[1d20+3]",
        survival: "[1d20+2]",
      }),
    ],
    featuresOverride: [
      feature("hunters-mark-feature", "Hunter's Mark Reference", "Manual target/concentration reference. Damage display appears as modifier help on weapon cards.", "Active Features"),
      feature("fey-ancestry", "Fey Ancestry", "Advantage on saves against Charmed. Magic cannot put Lyrielle to sleep.", "Features / Passives"),
      feature("faelar", "Faelar", "Faelar has baseline companion data and acts after Lyrielle. BotL upgrade waits until level 3/v1.1.", "Companion Reference"),
    ],
    equipmentOverride: [
      passiveEquipment("longbow", "Longbow", "Martial, Ammunition, Heavy, Range, Two-Handed, Slow."),
      passiveEquipment("shortsword", "Shortsword", "Martial, Finesse, Light, Vex."),
    ],
    resourcesOverride: [],
    outOfCombatOverride: [
      utility("short-rest", "Short Rest", "Hit Dice: 2/2. Recover HP: 1d10+2 per Ranger Hit Die spent. No automation in 0.4.0b."),
      referenceUtility("long-rest", "Long Rest", "Return to full HP. Recover hit dice up to half total. Reset spell uses and daily features manually."),
    ],
    notesOverride: [
      reminder("passives", "Passives", "Darkvision 60 ft. · Passive Perception 16 · Passive Investigation 9 · Passive Insight 12."),
    ],
  }),
  moduleData: {
    act: 2,
    theme: "frozen-north-horror",
    statBlockStatus: "confirmed",
    bond: brokenChainBonds.lyrielle,
    ...createBrokenChainDrainTrackers(),
  },
};
