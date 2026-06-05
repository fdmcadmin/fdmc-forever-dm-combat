import type { BondModuleData } from "../../../core/types/actor";

export const brokenChainBonds: Record<string, BondModuleData> = {
  mavik: {
    name: "Field Instinct",
    state: "ready",
    timing: "afterAction",
    turnFlow: "Action → Bonus → Bond",
    ruleNote: "Action → Bonus → Bond. Combat only.",
    currentEffect: "Restore: heal a target within 20 ft. for 1d4.",
  },
  leedragoon: {
    name: "Tactical Instinct",
    state: "ready",
    timing: "nextTurn",
    turnFlow: "Action → Bonus → Bond setup → resolves next turn",
    ruleNote: "Action → Bonus → Bond. Combat only.",
    currentEffect: "Loaded Round: target cannot take reactions until their next turn.",
  },
  lyrielle: {
    name: "Faelar Companion Flow",
    state: "ready",
    timing: "sameTurnAfterPlayer",
    turnFlow: "Lyrielle acts → Faelar resolves separately after Lyrielle",
    ruleNote: "Pre-BotL baseline companion reference. Use Faelar's own card/token data.",
    currentEffect: "Faelar acts after Lyrielle using the current table ruling for movement and commands.",
  },
  faelar: {
    name: "Pre-BotL Wolf Companion",
    state: "ready",
    timing: "sameTurnAfterPlayer",
    turnFlow: "Acts after Lyrielle",
    ruleNote: "Baseline wolf companion/reference before the level 3 BotL upgrade.",
    currentEffect: "Bite +4 to hit, 1d4 piercing. Keen Hearing and Smell applies to hearing/smell Perception checks.",
  },
  thayla: {
    name: "Anchor Instinct",
    state: "ready",
    timing: "beforeAction",
    turnFlow: "Bond choice → Action → Bonus",
    ruleNote: "Bond choice → Action → Bonus. Combat only.",
    currentEffect:
      "Focus: defensive bond choice. Pressure: offensive bond choice. Choose before taking the paired action.",
  },
  vaelith: {
    name: "Dark Bargain",
    state: "ready",
    timing: "nextTurn",
    turnFlow: "Hit trigger → Bond choice → next-turn effect",
    ruleNote: "Triggered bond. Combat only.",
    currentEffect:
      "Dark Whisper: after Vaelith's attack lands, target takes 1d4 psychic damage at the start of its next turn.",
  },
};
