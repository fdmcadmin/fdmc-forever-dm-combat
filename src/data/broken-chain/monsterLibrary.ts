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

const act1ThornfangPackLabel = "Act 1 — Thornfang Pack";
const act1MosshideLabel = "Act 1 — Mosshide Owlbear";
const act1ReaverLabel = "Act 1 — Greenwood Raider Band";
const act1SpiderNestLabel = "Act 1 — Threadbare Spider Nest";
const act1SwampLabel = "Act 1 — Swamp Ambush";
const act1BossLabel = "Act 1 Boss";
const act2S1E1Label = "Act 2 S1 E1 - Hollow Pack";
const act2S1E2Label = "Act 2 S1 E2 - Frozen Hollow";
const act2S2E1Label = "Act 2 S2 E1 - Corrupted Hunters";
const act2S2E2Label = "Act 2 S2 E2 - Last Directive";
const fortCervanBandLabel = "The Fort — Cervan's Band";

export const BROKEN_CHAIN_MONSTER_LIBRARY: MainMonsterTemplate[] = [
  // ── Act 1 · Wardenwood — Thornfang Pack ──────────────────────────────────────
  {
    templateId: "broken-chain:act1:thornfang-wolf:v1",
    name: "Thornfang Wolf",
    encounterId: "act1-thornfang-pack",
    encounterLabel: act1ThornfangPackLabel,
    stats: { kind: "monster", ac: 13, maxHp: 18, speed: "50 ft" },
    abilities: [
      formatAbility("STR", 13, 1),
      formatAbility("DEX", 15, 2),
      formatAbility("CON", 12, 1),
      formatAbility("INT", 3, -4),
      formatAbility("WIS", 12, 1),
      formatAbility("CHA", 6, -2),
    ],
    traits: [
      { name: "Pack Tactics", kind: "trait", text: "Advantage on attack rolls against a creature if at least one ally is within 5 feet of it and not incapacitated." },
      { name: "Keen Hearing and Smell", kind: "trait", text: "Advantage on Wisdom (Perception) checks that rely on hearing or smell." },
      { name: "Forest-Strider", kind: "trait", text: "Thickets, briar, and undergrowth are not difficult terrain for the wolf, and it leaves no tracks in the woods." },
    ],
    actions: [
      { name: "Savage Bite", kind: "attack", roll: "1d20 + 4", damage: "2d4 + 2", save: "STR DC 12", text: "+4 to hit, reach 5 ft., one target. Hit: 7 (2d4 + 2) piercing. DC 12 Strength save or knocked prone." },
    ],
    reactions: [],
    resources: [],
    notes: ["Wardenwood wolf minion. Run in packs of 3–5 led by a Thornfang Packlord.", "Skills: Perception +3, Stealth +4.", "Senses: Darkvision 60 ft., Passive Perception 13."],
    visibility: { defaultState: "hp-bar", hiddenName: "Patient Wolf", revealedName: "Thornfang Wolf" },
  },
  {
    templateId: "broken-chain:act1:thornfang-packlord:v1",
    name: "Thornfang Packlord",
    encounterId: "act1-thornfang-pack",
    encounterLabel: act1ThornfangPackLabel,
    // HP tuned down 39→33 after the Act 1 opener ran ~6 rounds (high variant hit 48,
    // above a standard dire wolf). Standard 33 / low 24 / high 41 — run standard for L1.
    stats: { kind: "monster", ac: 14, maxHp: 33, speed: "50 ft" },
    abilities: [
      formatAbility("STR", 17, 3),
      formatAbility("DEX", 15, 2),
      formatAbility("CON", 15, 2),
      formatAbility("INT", 3, -4),
      formatAbility("WIS", 12, 1),
      formatAbility("CHA", 7, -2),
    ],
    traits: [
      { name: "Pack Tactics", kind: "trait", text: "Advantage on attack rolls against a creature if at least one ally is within 5 feet of it and not incapacitated." },
      { name: "Keen Hearing and Smell", kind: "trait", text: "Advantage on Wisdom (Perception) checks that rely on hearing or smell." },
      { name: "Forest-Strider", kind: "trait", text: "Thickets, briar, and undergrowth are not difficult terrain, and the Packlord leaves no tracks in the woods." },
    ],
    actions: [
      { name: "Rending Bite", kind: "attack", roll: "1d20 + 5", damage: "2d6 + 3", save: "STR DC 13", text: "+5 to hit, reach 5 ft., one target. Hit: 10 (2d6 + 3) piercing. DC 13 Strength save or knocked prone." },
      { name: "Hunting Howl", kind: "action", text: "Bonus Action. Each Thornfang Wolf within 30 feet that can hear the Packlord may immediately move up to its speed toward an enemy without provoking opportunity attacks." },
    ],
    reactions: [],
    resources: [],
    notes: ["Wardenwood dire-wolf alpha. Hunting Howl repositions the pack.", "Skills: Perception +3, Stealth +4.", "Senses: Darkvision 60 ft., Passive Perception 13."],
    visibility: { defaultState: "hp-bar", hiddenName: "Great Wolf", revealedName: "Thornfang Packlord" },
  },
  // ── Act 1 · Wardenwood — Mosshide Owlbear ────────────────────────────────────
  {
    templateId: "broken-chain:act1:mosshide-owlbear:v1",
    name: "Mosshide Owlbear",
    encounterId: "act1-mosshide-owlbear",
    encounterLabel: act1MosshideLabel,
    stats: { kind: "monster", ac: 13, maxHp: 59, speed: "40 ft" },
    abilities: [
      formatAbility("STR", 20, 5),
      formatAbility("DEX", 12, 1),
      formatAbility("CON", 17, 3),
      formatAbility("INT", 3, -4),
      formatAbility("WIS", 12, 1),
      formatAbility("CHA", 7, -2),
    ],
    traits: [
      { name: "Keen Sight and Smell", kind: "trait", text: "Advantage on Wisdom (Perception) checks that rely on sight or smell." },
      { name: "Thornhide", kind: "trait", text: "Briar and broken bark are matted into the owlbear's pelt. A creature that hits it with a melee attack while within 5 feet takes 2 (1d4) piercing damage." },
    ],
    actions: [
      { name: "Multiattack", kind: "action", attackCount: 2, text: "The owlbear makes one Beak attack and one Raking Claws attack." },
      { name: "Beak", kind: "attack", roll: "1d20 + 7", damage: "1d10 + 5", text: "+7 to hit, reach 5 ft., one creature. Hit: 10 (1d10 + 5) piercing." },
      { name: "Raking Claws", kind: "attack", roll: "1d20 + 7", damage: "2d8 + 5", text: "+7 to hit, reach 5 ft., one target. Hit: 14 (2d8 + 5) slashing." },
    ],
    reactions: [],
    resources: [],
    notes: ["Wardenwood forest apex predator. Challenge 3.", "Skills: Perception +5.", "Senses: Darkvision 60 ft., Passive Perception 15."],
    visibility: { defaultState: "hp-bar", hiddenName: "Shape in the Trees", revealedName: "Mosshide Owlbear" },
  },
  // ── Act 1 · Wardenwood — Greenwood Raider Band ───────────────────────────────
  {
    templateId: "broken-chain:act1:greenwood-reaver:v1",
    name: "Greenwood Reaver",
    encounterId: "act1-greenwood-reaver",
    encounterLabel: act1ReaverLabel,
    stats: { kind: "monster", ac: 15, maxHp: 65, speed: "30 ft" },
    abilities: [
      formatAbility("STR", 15, 2),
      formatAbility("DEX", 16, 3),
      formatAbility("CON", 14, 2),
      formatAbility("INT", 11, 0),
      formatAbility("WIS", 11, 0),
      formatAbility("CHA", 14, 2),
    ],
    traits: [
      { name: "Woodwise", kind: "trait", text: "The Reaver ignores difficult terrain from thickets and undergrowth, and has advantage on Dexterity (Stealth) checks made to hide in forest cover." },
    ],
    actions: [
      { name: "Multiattack", kind: "action", attackCount: 3, text: "The Reaver makes two Notched Scimitar attacks and one Dagger attack (melee or thrown)." },
      { name: "Notched Scimitar", kind: "attack", roll: "1d20 + 5", damage: "1d6 + 3", text: "+5 to hit, reach 5 ft., one target. Hit: 6 (1d6 + 3) slashing." },
      { name: "Dagger", kind: "attack", roll: "1d20 + 5", damage: "1d4 + 3", text: "+5 to hit, melee or thrown 20/60 ft., one target. Hit: 5 (1d4 + 3) piercing." },
      { name: "Cruel Command", kind: "action", text: "Bonus Action. One ally within 30 feet that can hear the Reaver can use its reaction to make one weapon attack." },
    ],
    reactions: [
      { name: "Parry", kind: "reaction", text: "The Reaver adds 2 to its AC against one melee attack that would hit it. Must see attacker and be wielding a melee weapon." },
    ],
    resources: [],
    notes: ["Wardenwood forest-road raider captain. Challenge 2.", "Saving Throws: STR +4, DEX +5, WIS +2.", "Skills: Athletics +4, Deception +4, Stealth +5.", "Senses: Passive Perception 10."],
    visibility: { defaultState: "hp-bar", hiddenName: "Raider Captain", revealedName: "Greenwood Reaver" },
  },
  // ── Act 1 · Wardenwood — Threadbare Spider Nest (Far Realm seed) ──────────────
  {
    templateId: "broken-chain:act1:threadbare-spider:v1",
    name: "Threadbare Spider",
    encounterId: "act1-threadbare-spider-nest",
    encounterLabel: act1SpiderNestLabel,
    stats: { kind: "monster", ac: 13, maxHp: 22, speed: "30 ft., climb 30 ft." },
    abilities: [
      formatAbility("STR", 12, 1),
      formatAbility("DEX", 16, 3),
      formatAbility("CON", 12, 1),
      formatAbility("INT", 3, -4),
      formatAbility("WIS", 11, 0),
      formatAbility("CHA", 4, -3),
    ],
    traits: [
      { name: "Wrong-Spun Web", kind: "trait", text: "The nest's webbing is difficult terrain. A creature entering a webbed square for the first time on a turn must succeed on a DC 11 Dexterity save or have its speed reduced to 0 until the start of its next turn." },
      { name: "Half-Step Skitter", kind: "trait", text: "The spider moves a beat out of sync. The first time each round a creature misses it with a melee attack, the spider may move 5 feet without provoking opportunity attacks." },
      { name: "Far Realm Fingerprint", kind: "trait", text: "The spider is an aberration, not a beast — effects that affect only beasts do not affect it. The first sign of the same wrongness that produced the Mirage Stalker." },
    ],
    actions: [
      { name: "Bite", kind: "attack", roll: "1d20 + 5", damage: "1d8 + 3", save: "CON DC 11", text: "+5 to hit, reach 5 ft., one target. Hit: 7 (1d8 + 3) piercing. DC 11 Constitution save or take 2 (1d4) poison at the start of its next turn." },
    ],
    reactions: [],
    resources: [],
    notes: ["Campaign-original — NOT an SRD reskin. Act 1 Opening Encounter 1, party level 1. Run 3–4 in the nest.", "Skills: Stealth +5.", "Senses: Darkvision 60 ft., Passive Perception 10."],
    visibility: { defaultState: "hp-bar", hiddenName: "Spider", revealedName: "Threadbare Spider" },
  },
  // ── Act 1 · Wardenwood — Swamp Ambush ────────────────────────────────────────
  {
    templateId: "broken-chain:act1:swamp-ambusher:v1",
    name: "Swamp Ambusher",
    encounterId: "act1-swamp-ambush",
    encounterLabel: act1SwampLabel,
    stats: { kind: "monster", ac: 13, maxHp: 26, speed: "30 ft." },
    abilities: [
      formatAbility("STR", 12, 1),
      formatAbility("DEX", 14, 2),
      formatAbility("CON", 14, 2),
      formatAbility("INT", 10, 0),
      formatAbility("WIS", 11, 0),
      formatAbility("CHA", 10, 0),
    ],
    traits: [
      { name: "Marsh-Footed", kind: "trait", text: "The Ambusher ignores difficult terrain created by mud, water, or reeds. The party does not — the bandits flow through the swamp while the party slogs." },
      { name: "Ambush Instinct", kind: "trait", text: "In the first round of combat, the Ambusher has advantage on attack rolls against any creature that hasn't taken a turn yet, and deals an extra 3 (1d6) damage on a hit." },
    ],
    actions: [
      { name: "Reed Spear", kind: "attack", roll: "1d20 + 3", damage: "1d8 + 2", text: "Melee or thrown. +3 to hit, reach 5 ft. or range 20/60 ft., one target. Hit: 6 (1d8 + 2) piercing." },
      { name: "Net", kind: "attack", roll: "1d20 + 4", text: "Thrown 5/15 ft., one Large or smaller creature. On a hit, the target is Restrained until it frees itself (DC 10 STR check as an action) or the net is destroyed (AC 10, 5 slashing). Only one Ambusher carries a net." },
    ],
    reactions: [],
    resources: [],
    notes: ["Campaign-original — NOT an SRD reskin. Act 1 Opening Encounter 2. Grounded human threat, no supernatural element. Run 4–5 with terrain.", "Skills: Stealth +4, Survival +2.", "Senses: Passive Perception 10."],
    visibility: { defaultState: "hp-bar", hiddenName: "Bandit", revealedName: "Swamp Ambusher" },
  },
  // ── Act 1 · Boss ──────────────────────────────────────────────────────────────
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
  // ── The Fort — Cervan's Band ─────────────────────────────────────────────────
  // AC / HP / ability scores derived to the listed CR (+5 to hit + 1d8+3 / 1d6+3 pins
  // STR/DEX 16, prof +2). Tune in the editor if you have exact numbers.
  {
    templateId: "broken-chain:fort:cervan-thornwarden:v1",
    name: "Cervan Thornwarden",
    encounterId: "fort-cervan-band",
    encounterLabel: fortCervanBandLabel,
    stats: { kind: "monster", ac: 15, maxHp: 45, speed: "30 ft" },
    abilities: [
      formatAbility("STR", 16, 3),
      formatAbility("DEX", 12, 1),
      formatAbility("CON", 15, 2),
      formatAbility("INT", 11, 0),
      formatAbility("WIS", 13, 1),
      formatAbility("CHA", 15, 2),
    ],
    traits: [
      { name: "Thornwarden's Hold", kind: "trait", text: "Allied bandits within 30 ft cannot be frightened and will not flee while he stands." },
      { name: "A Word, Not a Shout", kind: "trait", text: "At the start of his turn, one ally he can see moves up to 10 ft without provoking opportunity attacks." },
      { name: "Guard the Root", kind: "trait", text: "If combat reaches the inner storehouse, the Thornwarden stops maneuvering and fights only to hold the door." },
    ],
    actions: [
      { name: "Crowned Multiattack", kind: "action", attackCount: 2, text: "The Thornwarden makes two Antler-Crowned Blade attacks." },
      { name: "Antler-Crowned Blade", kind: "attack", roll: "1d20 + 5", damage: "1d8 + 3", text: "+5 to hit, reach 5 ft., one target. Hit: 7 (1d8 + 3) slashing." },
      { name: "Collector's Order", kind: "action", text: "Two allied bandits within 30 ft each immediately make one weapon attack." },
    ],
    reactions: [
      { name: "None Are Spent Yet", kind: "reaction", text: "1/fight. When an ally within 30 ft would drop to 0 HP, that ally drops to 1 HP instead." },
    ],
    resources: [],
    notes: [
      "CR 2 (450 XP). Elite Leader — Pressure: Elite (6-player only, or 5-player hard mode).",
      "Never opens the fight personally — Collector's Order and A Word, Not a Shout run the first two rounds.",
      "Repositions his Reaver toward whichever wall is failing.",
      "If the storehouse is threatened, all discipline narrows to that door — players should notice the change.",
      "AC/HP/abilities derived to CR 2 — tune to taste.",
    ],
    visibility: { defaultState: "hp-bar", hiddenName: "Fort Commander", revealedName: "Cervan Thornwarden" },
  },
  {
    templateId: "broken-chain:fort:fortbreaker-reaver:v1",
    name: "Fortbreaker Reaver",
    encounterId: "fort-cervan-band",
    encounterLabel: fortCervanBandLabel,
    stats: { kind: "monster", ac: 16, maxHp: 45, speed: "30 ft" },
    abilities: [
      formatAbility("STR", 16, 3),
      formatAbility("DEX", 12, 1),
      formatAbility("CON", 16, 3),
      formatAbility("INT", 10, 0),
      formatAbility("WIS", 12, 1),
      formatAbility("CHA", 13, 1),
    ],
    traits: [
      { name: "No Wall Falls Twice", kind: "trait", text: "While above half HP, allied bandits within 20 ft add +1 to attack rolls." },
    ],
    actions: [
      { name: "Reaver's Multiattack", kind: "action", attackCount: 2, text: "The Reaver makes two Breaching Scimitar attacks." },
      { name: "Breaching Scimitar", kind: "attack", roll: "1d20 + 5", damage: "1d6 + 3", text: "+5 to hit, reach 5 ft., one target. Hit: 6 (1d6 + 3) slashing." },
      { name: "Move, Damn You", kind: "action", text: "Bonus Action. One allied bandit within 20 ft moves up to its speed." },
    ],
    reactions: [
      { name: "Turn the Blade", kind: "reaction", text: "When hit by a melee attack, reduce the damage by 1d6." },
    ],
    resources: [],
    notes: [
      "CR 2 (450 XP). Leader — Pressure: Strong.",
      "Plugs gaps personally — wherever a bandit just died, the Reaver is there next round.",
      "Uses Move, Damn You to rotate fresh bodies onto the wall and wounded ones off.",
      "Surrenders only if the Thornwarden is dead and the fight is clearly lost.",
      "AC/HP/abilities derived to CR 2 — tune to taste.",
    ],
    visibility: { defaultState: "hp-bar", hiddenName: "The Shouting One", revealedName: "Fortbreaker Reaver" },
  },
  {
    templateId: "broken-chain:fort:gloamknife-stray:v1",
    name: "Gloamknife Stray",
    encounterId: "fort-cervan-band",
    encounterLabel: fortCervanBandLabel,
    stats: { kind: "monster", ac: 14, maxHp: 27, speed: "30 ft" },
    abilities: [
      formatAbility("STR", 11, 0),
      formatAbility("DEX", 16, 3),
      formatAbility("CON", 13, 1),
      formatAbility("INT", 11, 0),
      formatAbility("WIS", 13, 1),
      formatAbility("CHA", 12, 1),
    ],
    traits: [
      { name: "Half-Here", kind: "trait", text: "In dim light or darkness, attacks against the Gloamknife Stray have disadvantage." },
      { name: "Wrong Silhouette", kind: "trait", text: "The first attack each creature makes against it has disadvantage — its true position is a step from where it appears." },
    ],
    actions: [
      { name: "Gloamknife", kind: "attack", roll: "1d20 + 5", damage: "1d6 + 3 + 1d4", text: "+5 to hit, reach 5 ft., one target. Hit: 6 (1d6 + 3) piercing plus 2 (1d4) cold — a cold that takes warmth out rather than putting chill in." },
      { name: "Slip Between", kind: "action", text: "Bonus Action. Teleport up to 15 ft between dim light or darkness areas it can see." },
    ],
    reactions: [],
    resources: [],
    notes: [
      "CR 1 (200 XP). Skirmisher / Ambusher — Pressure: Strong (dark) / Normal (light).",
      "Operates at the fight's edges — picks the isolated, the wounded, the one who wandered from torchlight.",
      "Slips Between every turn; never attacks twice from the same shadow.",
      "Retreats the moment bright light pins it — and not toward the other bandits.",
      "Bright light strips Half-Here and grounds Slip Between — a lantern is a weapon against it.",
      "AC/HP/abilities derived to CR 1 — tune to taste.",
    ],
    visibility: { defaultState: "hp-bar", hiddenName: "The Wrong Shadow", revealedName: "Gloamknife Stray" },
  },
];
