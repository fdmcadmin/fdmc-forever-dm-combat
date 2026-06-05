import type { Actor } from "../../../core/types/actor";
import { brokenChainBonds } from "../content/bonds";
import { mavikPinnedReactions } from "../content/pinnedReactions";
import { createBrokenChainDrainTrackers } from "../content/drainTrackers";
import { createPlayerTabs } from "../content/tabActions";
import { attackAction, bondAction, checks, commonSkillChecks, compactResource, feature, passiveEquipment, reminder, spellAction, utility, referenceUtility } from "./actorHelpers";

const mavikChecks = [
  ...checks([
    ["Concentration Check", "Use the current concentration save from the sheet/table.", "Combat Checks"],
  ]),
  ...commonSkillChecks({
    acrobatics: "[1d20+3]",
    animalHandling: "[1d20+4]",
    arcana: "[1d20+5]",
    athletics: "[1d20+0]",
    deception: "[1d20+1]",
    history: "[1d20+1]",
    insight: "[1d20+4]",
    intimidation: "[1d20+1]",
    investigation: "[1d20-1]",
    medicine: "[1d20+6]",
    nature: "[1d20+3]",
    perception: "[1d20+6]",
    performance: "[1d20+1]",
    persuasion: "[1d20+1]",
    religion: "[1d20-1]",
    sleightOfHand: "[1d20+3]",
    stealth: "[1d20+3]",
    survival: "[1d20+4]",
  }),
];

export const mavik: Actor = {
  id: "mavik",
  kind: "player",
  name: "Mavik",
  subtitle: "Aarakocra Druid · Level 2 · current baseline",
  race: "Aarakocra",
  className: "Druid",
  level: 2,
  stats: {
    ac: 16,
    hp: { current: 17, max: 17, temp: 0 },
    speed: { walk: 25, fly: 50 },
  },
  abilityScores: {
    str: { score: 10, modifier: 0 },
    dex: { score: 16, modifier: 3 },
    con: { score: 14, modifier: 2 },
    int: { score: 8, modifier: 1 },
    wis: { score: 18, modifier: 6 },
    cha: { score: 12, modifier: 1 },
  },
  classFeatureTracker: {
    label: "Wild Shape / Spellcasting",
    value: "Wild Shape 2/2 · Spell +6 · DC 14",
    note: "Use sheet for slots; Wild Shape grants 2 temp HP.",
  },
  pinnedReactions: mavikPinnedReactions,
  tabs: createPlayerTabs({
    main: [
      attackAction({
        id: "staff",
        label: "Staff",
        attack: "1d20+2",
        damage: "1d6",
        crit: "2d6",
        range: "Reach 5 ft",
        details: "Versatile 1d8 / 2d8 crit. Topple.",
        economyCost: ["main"],
      }),
      attackAction({
        id: "sickle",
        label: "Sickle",
        attack: "1d20+2",
        damage: "1d4",
        crit: "2d4",
        range: "Reach 5 ft",
        details: "Light, Nick.",
        economyCost: ["main"],
      }),
      attackAction({
        id: "talons",
        label: "Talons",
        attack: "1d20+2",
        damage: "1d4",
        crit: "2d4",
        range: "Reach 5 ft",
        details: "Slashing natural weapon.",
        economyCost: ["main"],
      }),
    ],
    spells: [
      spellAction({ id: "control-flames", label: "Control Flames", range: "60 ft", cost: "Action", details: "Cantrip control/reference. Non-damage flame control effect. No Dice+ roll attached.", economyCost: ["main"], category: "Cantrips" }),
      spellAction({ id: "fire-bolt", label: "Fire Bolt", attack: "1d20+6", damage: "1d10", crit: "2d10", range: "120 ft", cost: "Action", details: "Cantrip spell attack. Fire damage.", economyCost: ["main"], category: "Cantrips" }),
      spellAction({ id: "minor-illusion", label: "Minor Illusion", range: "30 ft", cost: "Action", details: "Cantrip illusion/reference. Creates a sound or image. No Dice+ roll attached.", economyCost: ["main"], category: "Cantrips" }),
      spellAction({ id: "thorn-whip", label: "Thorn Whip", attack: "1d20+6", damage: "1d6", crit: "2d6", range: "30 ft", cost: "Action", details: "Cantrip spell attack. Large or smaller target may be pulled 10 ft closer.", economyCost: ["main"], category: "Cantrips" }),
      spellAction({ id: "cure-wounds", label: "Cure Wounds", damage: "2d8+4 healing", range: "Touch", cost: "Action", details: "1st-level healing spell. Apply healing manually.", economyCost: ["main"], category: "Prepared Spells" }),
      spellAction({ id: "entangle", label: "Entangle", saveDc: "STR DC 14", range: "90 ft", cost: "Action", details: "1st-level spell. Restrained on fail. Concentration up to 1 minute.", economyCost: ["main"], category: "Prepared Spells" }),
      spellAction({ id: "fog-cloud", label: "Fog Cloud", range: "120 ft", cost: "Action", details: "1st-level utility/control spell. Heavily obscured fog, concentration up to 1 hour.", economyCost: ["main"], category: "Utility Spells" }),
      spellAction({ id: "thunderwave", label: "Thunderwave", damage: "2d8", saveDc: "CON DC 14", range: "15 ft cube", cost: "Action", details: "Push on failed save. Apply damage manually.", economyCost: ["main"], category: "Prepared Spells" }),
      spellAction({ id: "magic-stone", label: "Magic Stone", attack: "1d20+6", damage: "1d6+4", crit: "2d6+4", range: "Touch / 60 ft thrown", cost: "Bonus Action", details: "Cantrip. Imbue stones for 1 minute. User can make a spell attack for 1d6+4 bludgeoning. Target handoff/granted-charge support remains BUILD 0.5.0 territory.", economyCost: ["bonus"], category: "Bonus Action Spells" }),
      spellAction({ id: "healing-word", label: "Healing Word", damage: "2d4+4 healing", range: "60 ft", cost: "Bonus Action", details: "1st-level healing spell. Apply healing manually.", economyCost: ["bonus"], category: "Bonus Action Spells" }),
      spellAction({ id: "silvery-barbs", label: "Silvery Barbs", range: "60 ft", cost: "Reaction", details: "1/Long Rest reaction. Force a successful d20 roll reroll; then grant advantage to one creature.", economyCost: ["reaction"], category: "Reaction Spells", pinReaction: true }),
    ],
    bond: [
      bondAction({ id: "field-instinct-restore", label: "Restore", damage: "1d4 healing", range: "20 ft", details: "Bond Action. Restore this many hit points to a target within range." }),
    ],
    checksOverride: mavikChecks,
    featuresOverride: [
      feature("wild-shape", "Wild Shape", "2/2 uses. Beast form lasts 1 hour or until ended. Grants 2 temp HP.", "Active Features"),
      feature("spellcasting", "Spellcasting", "Wisdom spellcasting. Spell Attack +6. Spell Save DC 14. Spell slots are class-feature resources; count them on the sheet until resource automation is approved.", "Class Feature Resources"),
      feature("silvery-barbs-feature", "Silvery Barbs", "1/Long Rest reaction. Currently available through Pinned Reactions.", "Reaction Features"),
      feature("wild-shape-rules", "Wild Shape Reminder", "Cannot cast spells while shape-shifted; shape-shifting does not break concentration.", "Features / Passives"),
    ],
    equipmentOverride: [
      passiveEquipment("sickle", "Sickle", "Simple, Light, Nick."),
      passiveEquipment("staff", "Staff", "Simple, Versatile, Topple."),
    ],
    resourcesOverride: [],
    outOfCombatOverride: [
      utility("short-rest", "Short Rest", "Hit Dice: 2/2. Recover HP: 1d8+2 per Druid Hit Die spent. No automation in 0.4.0b."),
      referenceUtility("long-rest", "Long Rest", "Return to full HP. Recover hit dice up to half total. Reset Wild Shape, spell slots, and daily features manually."),
    ],
    notesOverride: [
      reminder("passives", "Passives", "Passive Perception 16 · Passive Investigation 9 · Passive Insight 14."),
      reminder("languages", "Languages", "Aarakocra, Auran, Common, Druidic."),
    ],
  }),
  moduleData: {
    act: 2,
    theme: "frozen-north-horror",
    statBlockStatus: "confirmed",
    bond: brokenChainBonds.mavik,
    ...createBrokenChainDrainTrackers(),
  },
};
