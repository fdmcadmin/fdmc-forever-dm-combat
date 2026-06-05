import type { Actor } from "../../../core/types/actor";
import { brokenChainBonds } from "../content/bonds";
import { vaelithPinnedReactions } from "../content/pinnedReactions";
import { createBrokenChainDrainTrackers } from "../content/drainTrackers";
import { createPlayerTabs } from "../content/tabActions";
import { bondAction, checks, commonSkillChecks, compactResource, feature, reminder, spellAction, utility, referenceUtility } from "./actorHelpers";

export const vaelith: Actor = {
  id: "vaelith",
  kind: "player",
  name: "Vaelith",
  subtitle: "Elf Warlock · Level 2 · current baseline",
  race: "Elf",
  className: "Warlock",
  level: 2,
  stats: {
    ac: 13,
    hp: { current: 17, max: 17, temp: 12 },
    speed: "30 ft",
  },
  abilityScores: {
    str: { score: 8, modifier: -1 },
    dex: { score: 13, modifier: 1 },
    con: { score: 15, modifier: 2 },
    int: { score: 10, modifier: 0 },
    wis: { score: 12, modifier: 3 },
    cha: { score: 17, modifier: 5 },
  },
  classFeatureTracker: {
    label: "Pact Slots / Vigor",
    value: "Slots 2/2 · Temp 12",
    note: "Save DC 13. Magical Cunning 1/Long Rest.",
  },
  pinnedReactions: vaelithPinnedReactions,
  tabs: createPlayerTabs({
    main: [],
    spells: [
      spellAction({ id: "eldritch-blast", label: "Eldritch Blast", attack: "1d20+5", damage: "1d10+3", crit: "2d10+3", range: "120 ft", cost: "Action", slotCost: "Cantrip", details: "Agonizing Blast included.", economyCost: ["main"], category: "Cantrips" }),
      spellAction({ id: "eldritch-blast-melee-disadvantage", label: "EB Melee - Disadvantage", attack: "2d20kl1+5", damage: "1d10+3", crit: "2d10+3", range: "120 ft", cost: "Action", slotCost: "Cantrip", details: "Use when hostile creature is within 5 ft.", economyCost: ["main"], category: "Cantrips" }),
      spellAction({ id: "mind-sliver", label: "Mind Sliver", damage: "1d6 psychic", saveDc: "INT DC 13", range: "60 ft", cost: "Action", slotCost: "Cantrip", details: "On failed save, subtract 1d4 from target's next save before end of Vaelith's next turn.", economyCost: ["main"], category: "Cantrips" }),
      spellAction({ id: "bane", label: "Bane", saveDc: "CHA DC 13", range: "30 ft", cost: "Action", slotCost: "Pact Slot", details: "Concentration up to 1 minute. Failed targets subtract 1d4 from attacks and saves.", economyCost: ["main"], category: "Pact Spells" }),
      spellAction({ id: "false-life", label: "False Life / Fiendish Vigor", damage: "+12 Temp HP", range: "Self", cost: "Action", slotCost: "No Pact Slot", details: "No pact slot through Fiendish Vigor. Gain +12 temporary hit points.", economyCost: ["main"], category: "Pact Spells" }),
      spellAction({ id: "dancing-lights", label: "Dancing Lights", range: "120 ft", cost: "Action", slotCost: "Cantrip", details: "Concentration up to 1 minute. Utility lighting spell.", economyCost: ["main"], category: "Utility Spells" }),
      spellAction({ id: "hex", label: "Hex", damage: "+1d6 necrotic on hits", range: "90 ft", cost: "Bonus Action", slotCost: "Pact Slot", details: "Concentration up to 1 hour. Target has disadvantage on checks with chosen ability.", economyCost: ["bonus"], category: "Bonus Action Spells" }),
    ],
    bond: [
      bondAction({ id: "dark-whisper", label: "Dark Whisper", damage: "1d4 psychic", details: "Bond Action: after Vaelith's attack lands, target takes this psychic damage at start of its next turn." }),
    ],
    checksOverride: [
      ...checks([
        ["Concentration Save - Advantage", "[2d20kh1+2] · Eldritch Mind for concentration saves.", "Saves"],
        ["Fey Charm WIS Save", "[2d20kh1+3] · Fey Ancestry, use when saving against being Charmed with Wisdom.", "Saves"],
        ["Fey Charm CHA Save", "[2d20kh1+5] · Fey Ancestry, use when saving against being Charmed with Charisma.", "Saves"],
      ]),
      ...commonSkillChecks({
        acrobatics: "[1d20+1]",
        animalHandling: "[1d20+1]",
        arcana: "[1d20+0]",
        athletics: "[1d20-1]",
        deception: "[1d20+5]",
        history: "[1d20+0]",
        insight: "[1d20+3]",
        intimidation: "[1d20+5]",
        investigation: "[1d20+2]",
        medicine: "[1d20+1]",
        nature: "[1d20+0]",
        perception: "[1d20+3]",
        performance: "[1d20+3]",
        persuasion: "[1d20+3]",
        religion: "[1d20+0]",
        sleightOfHand: "[1d20+1]",
        stealth: "[1d20+1]",
        survival: "[1d20+1]",
      }),
    ],
    featuresOverride: [
      feature("pact-slots", "Pact Slots", "2/2. Recover on Short Rest. Manual count only; no spend automation in BUILD 0.4.0b.", "Active Features"),
      feature("magical-cunning", "Magical Cunning", "1/Long Rest. 1-minute rite to regain up to 1 expended Pact Magic slot.", "Active Features"),
      feature("fiendish-vigor", "Fiendish Vigor", "False Life without pact slot; +12 temporary HP.", "Features / Passives"),
      feature("eldritch-mind", "Eldritch Mind", "Advantage on Constitution saves made to maintain concentration.", "Features / Passives"),
      feature("alert", "Alert", "Initiative total +3; can swap Initiative with one willing ally immediately after rolling.", "Features / Passives"),
      feature("fey-ancestry", "Fey Ancestry", "Advantage on saves to avoid/end Charmed. Magic cannot put Vaelith to sleep.", "Features / Passives"),
    ],
    equipmentOverride: [],
    resourcesOverride: [],
    outOfCombatOverride: [
      utility("short-rest", "Short Rest", "Hit Dice: 2/2. Recover HP: 1d8+2 per Warlock Hit Die spent. Recover pact slots."),
      referenceUtility("long-rest", "Long Rest", "Return to full HP. Recover hit dice up to half total. Reset Magical Cunning and daily features manually."),
    ],
    notesOverride: [
      reminder("passives", "Passives", "Darkvision 120 ft. · Passive Perception 13 · Passive Investigation 12 · Passive Insight 13."),
    ],
  }),
  moduleData: {
    act: 2,
    theme: "frozen-north-horror",
    statBlockStatus: "confirmed",
    bond: brokenChainBonds.vaelith,
    ...createBrokenChainDrainTrackers(),
  },
};
