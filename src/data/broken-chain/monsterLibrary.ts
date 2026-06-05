import type { MonsterReaderAction } from "../../core/monsters/MonsterJconScanner";
import type { MainMonsterTemplate } from "../../core/monsters/runtime/mainMonsterRuntime";

function formatAbility(label: string, score: number, modifier: number) {
  const signed = modifier >= 0 ? `+${modifier}` : `${modifier}`;
  return { label, value: `${score} (${signed})` };
}

function saveText(save: string | undefined, dc: number | undefined) {
  if (save && typeof dc === "number") {
    return `${save} DC ${dc}`;
  }
  return save;
}

function appendParts(...parts: Array<string | undefined>) {
  return parts.filter(Boolean).join("\n");
}

const act1BossLabel = "Act 1 Boss";
const act2S1E1Label = "Act 2 S1 E1 - Hollow Pack";
const act2S1E2Label = "Act 2 S1 E2 - Frozen Hollow";
const act2S2E1Label = "Act 2 S2 E1 - Corrupted Hunters";
const act2S2E2Label = "Act 2 S2 E2 - Last Directive";

export const BROKEN_CHAIN_MONSTER_LIBRARY: MainMonsterTemplate[] = [
  {
    templateId: "broken-chain:boss:mirage-stalker:v1",
    name: "Mirage Stalker",
    encounterId: "act1-boss",
    encounterLabel: act1BossLabel,
    stats: { kind: "boss", ac: 14, maxHp: 100, speed: "50 ft" },
    abilities: [
      formatAbility("STR", 19, 4),
      formatAbility("DEX", 14, 2),
      formatAbility("CON", 16, 3),
      formatAbility("INT", 4, -3),
      formatAbility("WIS", 12, 1),
      formatAbility("CHA", 6, -2),
    ],
    traits: [
      { name: "Phantom Step", kind: "trait", text: "When the Stalker moves, it leaves an afterimage at its departure point. Attack rolls against the Stalker have disadvantage until it takes damage that round. Attacks targeting the afterimage auto-miss and trigger Phantom Lunge. Usable twice per fight total. Does not trigger the round the Stalker takes damage. Recharge roll/control belongs on this trait/resource, not on Phantom Charge." },
      { name: "Wrong Geometry", kind: "trait", text: "The Stalker does not read as a natural creature. Effects that specifically target beasts do not affect it." },
      { name: "Condition Immunity - Frightened", kind: "trait", text: "The Stalker is immune to the frightened condition." },
    ],
    actions: [
      { name: "Multiattack", kind: "action", attackCount: 2, text: "The Mirage Stalker makes one Phantom Rake attack and one Hollow Stamp attack." },
      { name: "Phantom Rake", kind: "attack", roll: "1d20 + 6", damage: "2d8 + 4", text: "Melee Weapon Attack: +6 to hit, reach 10 ft., one target. Hit: 13 (2d8 + 4) piercing damage. The strike lands a half-second before the creature appears to move." },
      { name: "Hollow Stamp", kind: "attack", roll: "1d20 + 6", damage: "2d6 + 4", text: "Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 11 (2d6 + 4) bludgeoning damage. The hooves connect with a sound that is wrong." },
      { name: "Phantom Charge", kind: "attack", roll: "1d20 + 6", damage: "2d8 + 4", save: "STR DC 14", text: "Recharge 5-6. Melee Weapon Attack after at least 20 ft. of straight-line movement. On hit after the movement requirement, target must succeed on the Strength save or be pushed 10 ft. and knocked prone." },
    ],
    reactions: [
      { name: "Phantom Lunge", kind: "reaction", roll: "1d20 + 6", damage: "2d6 + 4", text: "When a creature within 10 feet misses because of Phantom Step's afterimage, the Stalker can make one Hollow Stamp attack against that creature." },
    ],
    resources: [
      { id: "mirage-stalker-phantom-step-uses", name: "Phantom Step Uses", current: 2, max: 2, reset: "fight", note: "Two uses per fight total." },
      { id: "mirage-stalker-phantom-step-recharge", name: "Phantom Step Recharge", current: 0, max: 1, reset: "Recharge 5-6", note: "Roll at the start of the Stalker turn if needed." },
      { id: "mirage-stalker-phantom-charge-recharge-note", name: "Phantom Charge Condition", current: 1, max: 1, reset: "Recharge 5-6", note: "Requires at least 20 ft. of straight-line movement before the hit rider applies." },
    ],
    notes: [
      "Act 1 Final Boss. Huge aberration, formerly a giant elk.",
      "Saving Throws: STR +6, CON +5.",
      "Skills: Perception +3.",
      "Condition Immunities: Frightened.",
      "Senses: Darkvision 60 ft., Passive Perception 13.",
      "Proficiency Bonus: +2.",
    ],
    visibility: { defaultState: "condition", hiddenName: "Something Wrong in the Keep", revealedName: "Mirage Stalker" },
  },
  {
    templateId: "broken-chain:act2-s1:pale-stalker:v1",
    name: "Pale Stalker",
    encounterId: "act2-s1-e1-hollow-pack",
    encounterLabel: act2S1E1Label,
    stats: { kind: "monster", ac: 13, maxHp: 75, speed: "50 ft" },
    abilities: [
      formatAbility("STR", 18, 4),
      formatAbility("DEX", 13, 1),
      formatAbility("CON", 14, 2),
      formatAbility("INT", 7, -2),
      formatAbility("WIS", 12, 1),
      formatAbility("CHA", 8, -1),
    ],
    traits: [
      { name: "Keen Hearing and Smell", kind: "trait", text: "Advantage on Wisdom (Perception) checks that rely on hearing or smell." },
      { name: "Pack Tactics", kind: "trait", text: "Advantage on attack rolls against a creature if at least one ally is within 5 feet of it and not incapacitated." },
      { name: "Apex Unleashed", kind: "trait", text: "While both Pack Hunters are alive, Cold Breath is locked. When the first Pack Hunter dies, Cold Breath becomes available immediately and Exploit Weakness increases." },
      { name: "Exploit Weakness", kind: "trait", text: "When attacking a prone target, a target with reduced speed, or a creature damaged by another creature this round, add cold damage on hit." },
    ],
    actions: [
      { name: "Bite", kind: "attack", roll: "1d20 + 6", damage: "2d6 + 4", save: "STR DC 14", text: "Target is knocked prone on a failed Strength save." },
      { name: "Cold Breath", kind: "action", damage: "4d8", save: "DEX DC 12", text: "Recharge 5-6; locked while both Pack Hunters are alive. Each creature in a 15-foot cone takes cold damage on a failed save, or half on success." },
    ],
    reactions: [],
    resources: [{ id: "pale-stalker-cold-breath-recharge", name: "Cold Breath", current: 0, max: 1, reset: "Recharge 5-6", note: "Locked until first Pack Hunter dies." }],
    notes: ["Damage Immunities: Cold.", "Skills: Perception +3, Stealth +3.", "Senses: Darkvision 60 ft., Passive Perception 13.", "Understands Common but does not speak it."],
    visibility: { defaultState: "hp-bar", hiddenName: "Patient Wolf", revealedName: "Pale Stalker" },
  },
  {
    templateId: "broken-chain:act2-s1:pack-hunter:v1",
    name: "Pack Hunter",
    encounterId: "act2-s1-e1-hollow-pack",
    encounterLabel: act2S1E1Label,
    stats: { kind: "monster", ac: 12, maxHp: 47, speed: "40 ft" },
    abilities: [
      formatAbility("STR", 14, 2),
      formatAbility("DEX", 15, 2),
      formatAbility("CON", 14, 2),
      formatAbility("INT", 5, -3),
      formatAbility("WIS", 12, 1),
      formatAbility("CHA", 6, -2),
    ],
    traits: [{ name: "Pack Tactics", kind: "trait", text: "Advantage on attack rolls against a creature if at least one ally is within 5 feet of it and not incapacitated." }],
    actions: [
      { name: "Bite", kind: "attack", roll: "1d20 + 4", damage: "2d4 + 2", save: "STR DC 12", text: "Target is knocked prone on a failed Strength save." },
    ],
    reactions: [],
    resources: [],
    notes: ["Run 2 in Hollow Pack.", "Skills: Perception +3, Stealth +2.", "Senses: Darkvision 30 ft., Passive Perception 13.", "Cornered Howl can be suppressed by Silence and Silencing Round."],
    visibility: { defaultState: "hp-bar", hiddenName: "Corrupted Hunter", revealedName: "Pack Hunter" },
  },
  {
    templateId: "broken-chain:act2-s1:icebound-zombie:v1",
    name: "Icebound Zombie",
    encounterId: "act2-s1-e2-frozen-hollow",
    encounterLabel: act2S1E2Label,
    stats: { kind: "monster", ac: 12, maxHp: 45, speed: "20 ft" },
    abilities: [
      formatAbility("STR", 13, 1),
      formatAbility("DEX", 6, -2),
      formatAbility("CON", 16, 3),
      formatAbility("INT", 3, -4),
      formatAbility("WIS", 6, -2),
      formatAbility("CHA", 5, -3),
    ],
    traits: [
      { name: "Hollow Fortitude", kind: "trait", text: "When damage reduces the Zombie to 0 HP, it makes a Constitution save DC 5 + damage taken unless the damage is radiant or from a critical hit. On success, it drops to 1 HP instead." },
      { name: "Wendigo-Drained", kind: "trait", text: "Does not bleed. Speed reduction on hit does not affect it unless magical." },
    ],
    actions: [
      { name: "Slam", kind: "attack", roll: "1d20 + 3", damage: "1d6 + 1 bludgeoning + 1d6 cold", text: "+3 to hit. Hit: 4 (1d6 + 1) bludgeoning plus 3 (1d6) cold." },
    ],
    reactions: [],
    resources: [],
    notes: ["Saving Throws: WIS +0.", "Damage Immunities: Cold, Poison.", "Condition Immunities: Poisoned.", "Senses: Darkvision 60 ft., Passive Perception 8."],
    visibility: { defaultState: "hp-bar", hiddenName: "Icebound Corpse", revealedName: "Icebound Zombie" },
  },
  {
    templateId: "broken-chain:act2-s1:ghoul:v1",
    name: "Ghoul",
    encounterId: "act2-s1-e2-frozen-hollow",
    encounterLabel: act2S1E2Label,
    stats: { kind: "monster", ac: 12, maxHp: 35, speed: "30 ft" },
    abilities: [
      formatAbility("STR", 13, 1),
      formatAbility("DEX", 15, 2),
      formatAbility("CON", 10, 0),
      formatAbility("INT", 7, -2),
      formatAbility("WIS", 10, 0),
      formatAbility("CHA", 8, -1),
    ],
    traits: [{ name: "Hungry Dead", kind: "trait", text: "Advantage on attack rolls against any creature that has not yet taken a turn this combat, or that is paralyzed." }],
    actions: [
      { name: "Bite", kind: "attack", roll: "1d20 + 2", damage: "2d6 + 2", text: "One incapacitated target only." },
      { name: "Claws", kind: "attack", roll: "1d20 + 4", damage: "2d4 + 2", save: "CON DC 10", text: "If target is not undead, it is paralyzed until the end of its next turn on a failed save." },
    ],
    reactions: [],
    resources: [],
    notes: ["Damage Immunities: Poison.", "Condition Immunities: Charmed, Exhaustion, Poisoned.", "Senses: Darkvision 60 ft., Passive Perception 10."],
    visibility: { defaultState: "hp-bar", hiddenName: "Hungry Dead", revealedName: "Ghoul" },
  },
  {
    templateId: "broken-chain:act2-s1:hollow-mourner:v1",
    name: "Hollow Mourner",
    encounterId: "act2-s1-e2-frozen-hollow",
    encounterLabel: act2S1E2Label,
    stats: { kind: "monster", ac: 13, maxHp: 42, speed: "30 ft" },
    abilities: [
      formatAbility("STR", 16, 3),
      formatAbility("DEX", 17, 3),
      formatAbility("CON", 10, 0),
      formatAbility("INT", 11, 0),
      formatAbility("WIS", 10, 0),
      formatAbility("CHA", 8, -1),
    ],
    traits: [
      { name: "Hollow Cold Aura", kind: "trait", text: "A creature starting its turn within 10 feet must succeed on a Constitution save or have disadvantage on Constitution saves until start of its next turn." },
      { name: "Turning Defiance", kind: "trait", text: "If it fails a saving throw against an effect that would turn undead, it may reroll and must use the new result." },
    ],
    actions: [
      { name: "Bite", kind: "attack", roll: "1d20 + 5", damage: "2d8 + 3", text: "+5 to hit. Hit: 12 (2d8 + 3) piercing damage." },
      { name: "Claws", kind: "attack", roll: "1d20 + 5", damage: "2d6 + 3", save: "CON DC 10", text: "Non-undead target must make the Constitution save or be paralyzed until end of its next turn." },
    ],
    reactions: [],
    resources: [],
    notes: ["Damage Resistances: Necrotic.", "Damage Immunities: Poison.", "Condition Immunities: Charmed, Exhaustion, Poisoned.", "Senses: Darkvision 60 ft., Passive Perception 10."],
    visibility: { defaultState: "hp-bar", hiddenName: "Hollow Mourner", revealedName: "Hollow Mourner" },
  },
  {
    templateId: "broken-chain:act2-s2:corrupted-hunter:v1",
    name: "Corrupted Hunter",
    encounterId: "act2-s2-e1-corrupted-hunters",
    encounterLabel: act2S2E1Label,
    stats: { kind: "monster", ac: 14, maxHp: 60, speed: "30 ft" },
    abilities: [
      formatAbility("STR", 15, 2),
      formatAbility("DEX", 14, 2),
      formatAbility("CON", 16, 3),
      formatAbility("INT", 8, -1),
      formatAbility("WIS", 12, 1),
      formatAbility("CHA", 8, -1),
    ],
    traits: [{ name: "Coordinated Strike", kind: "trait", text: "When this creature hits a target already hit by another Corrupted Hunter this round, it deals an additional 1d8 necrotic damage." }],
    actions: [
      { name: "Multiattack", kind: "action", attackCount: 2, text: "The Hunter makes two Corrupted Claw attacks." },
      {
        name: "Corrupted Claw",
        kind: "attack",
        roll: "1d20 + 4",
        damage: "2d6 + 2",
        save: "CON DC 13",
        text: appendParts(
          "+4 to hit. Hit: 9 (2d6 + 2) slashing.",
          "Strength score reduced by 1d4 until short/long rest. Short rest removes 50%; long rest removes 100%. Cap 6 per player per fight."
        ),
      },
    ],
    reactions: [],
    resources: [{ id: "corrupted-hunter-str-drain-cap", name: "STR Drain Cap", current: 0, max: 6, reset: "per player / per fight", note: "Track manually per player." }],
    notes: ["Saving Throws: CON +5.", "Skills: Perception +3, Stealth +2.", "Damage Immunities: Poison.", "Condition Immunities: Poisoned, Exhaustion.", "Senses: Darkvision 60 ft., Passive Perception 13."],
    visibility: { defaultState: "hp-bar", hiddenName: "Corrupted Hunter", revealedName: "Corrupted Hunter" },
  },
  {
    templateId: "broken-chain:act2-s2:soul-gorged-guardian:v1",
    name: "Soul-Gorged Guardian",
    encounterId: "act2-s2-e2-last-directive",
    encounterLabel: act2S2E2Label,
    stats: { kind: "boss", ac: 14, maxHp: 85, speed: "0 ft., fly 5 ft" },
    abilities: [
      formatAbility("STR", 16, 3),
      formatAbility("DEX", 12, 1),
      formatAbility("CON", 16, 3),
      formatAbility("INT", 14, 2),
      formatAbility("WIS", 18, 4),
      formatAbility("CHA", 16, 3),
    ],
    traits: [
      { name: "Weeping Souls Aura", kind: "trait", text: "A creature starting its turn within 10 feet must succeed on a Wisdom save or be Rattled until start of next turn. Rattled means disadvantage on Wisdom and Constitution saves." },
      { name: "Mad Certainty", kind: "trait", text: "Immune to Charmed. It genuinely believes it is still doing holy work." },
    ],
    actions: [
      { name: "Multiattack", kind: "action", attackCount: 2, text: "The Guardian makes two Corrupted Smite attacks." },
      { name: "Corrupted Smite", kind: "attack", roll: "1d20 + 6", damage: "2d8 + 4", text: "+6 to hit. Hit: 13 (2d8 + 4) necrotic damage." },
      { name: "Soul Vomit", kind: "action", damage: "6d6", save: "CON DC 13", text: "Recharge 5-6. Each creature in a 15-foot cone takes necrotic damage on a failed save, or half on success. Rattled creatures save at disadvantage." },
    ],
    reactions: [],
    resources: [{ id: "soul-guardian-soul-vomit-recharge", name: "Soul Vomit Recharge", current: 0, max: 1, reset: "Recharge 5-6", note: "Rattled creatures save at disadvantage." }],
    notes: ["Saving Throws: WIS +7, CHA +6.", "Damage Vulnerabilities: Necrotic.", "Condition Immunities: Charmed, Frightened.", "Senses: Truesight 60 ft., Passive Perception 14."],
    visibility: { defaultState: "hp-bar", hiddenName: "Broken Guardian", revealedName: "Soul-Gorged Guardian" },
  },
  {
    templateId: "broken-chain:act2-s2:grave-light:v1",
    name: "Grave Light",
    encounterId: "act2-s2-e2-last-directive",
    encounterLabel: act2S2E2Label,
    stats: { kind: "monster", ac: 19, maxHp: 12, speed: "0 ft., fly 50 ft. (hover)" },
    abilities: [
      formatAbility("STR", 1, -5),
      formatAbility("DEX", 28, 9),
      formatAbility("CON", 10, 0),
      formatAbility("INT", 13, 1),
      formatAbility("WIS", 14, 2),
      formatAbility("CHA", 11, 0),
    ],
    traits: [
      { name: "Incorporeal Movement", kind: "trait", text: "Can move through creatures and objects as difficult terrain. Nonmagical weapon attacks pass through it and deal no damage. Takes 5 (1d10) force damage if it ends its turn inside an object." },
      { name: "Corrupted Light", kind: "trait", text: "Sheds dim sickly pale-gold light in a 10-foot radius." },
    ],
    actions: [{ name: "Corrupted Shock", kind: "attack", roll: "1d20 + 4", damage: "1d8", text: "+4 to hit, reach 5 ft., one creature. Hit: 4 (1d8) corrupted radiant damage." }],
    reactions: [],
    resources: [],
    notes: ["Run 3 in Last Directive.", "Damage Immunities: Lightning, Poison.", "Condition Immunities: Exhaustion, Grappled, Paralyzed, Poisoned, Prone, Restrained, Unconscious.", "Senses: Darkvision 120 ft., Passive Perception 12."],
    visibility: { defaultState: "hp-bar", hiddenName: "Grave Light", revealedName: "Grave Light" },
  },
];
