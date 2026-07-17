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
    stats: { kind: "monster", ac: 12, maxHp: 26, speed: "40 ft" },
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
    stats: { kind: "monster", ac: 12, maxHp: 42, speed: "20 ft" },
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
    // REPLACED by the Corrupted Hunter in Frozen Hollow (2026-07-17 library sweep; the
    // authoritative encounter doc). Kept as a dormant library template — no encounterId, so
    // it is not seeded into any fight.
    encounterId: undefined,
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
    stats: { kind: "monster", ac: 13, maxHp: 36, speed: "30 ft" },
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
    // Moved into Frozen Hollow, replacing the Ghoul (2026-07-17 sweep). Its standalone
    // "Corrupted Hunters" encounter is voided by having no creatures left in it.
    // HP 60 -> 82 (Wight chassis kept per the chassis-HP rule); Elite classification is what
    // places the Frozen Hollow fight in the elite band.
    encounterId: "act2-s1-e2-frozen-hollow",
    encounterLabel: act2S1E2Label,
    stats: { kind: "monster", ac: 14, maxHp: 82, speed: "30 ft", classification: "elite" },
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
    stats: { kind: "boss", ac: 14, maxHp: 85, speed: "0 ft., fly 5 ft", kitMultiplier: 1.10 },
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
    stats: { kind: "monster", ac: 19, maxHp: 12, speed: "0 ft., fly 50 ft. (hover)", kitMultiplier: 1.50 },
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
  // ── Act 2 · S3 — Lesser Wendigos (Village Night Defense) ─────────────────────
  {
    templateId: "broken-chain:act2:lesser-wendigo:v1",
    name: "Lesser Wendigo",
    encounterId: "act2-s3-village-defense",
    encounterLabel: "Act 2 S3 - Lesser Wendigos (Village Night Defense)",
    stats: { kind: "boss", ac: 15, maxHp: 120, speed: "40 ft", classification: "mid-boss" },
    abilities: [
      formatAbility("STR", 17, 3),
      formatAbility("DEX", 14, 2),
      formatAbility("CON", 16, 3),
      formatAbility("INT", 6, -2),
      formatAbility("WIS", 12, 1),
      formatAbility("CHA", 7, -2),
    ],
    traits: [
      { name: "Mighty Leap", kind: "trait", text: "If it moves at least 20 ft in a straight line toward a creature (including dropping from a rooftop), it may make one Claw attack against that creature as a bonus action. On a hit, DC 13 STR save or knocked prone." },
      { name: "The Cold It Carries", kind: "trait", text: "Every Claw attack deals an extra 1d6 cold. Not weather — what replaced whatever this thing used to be." },
      { name: "Husk on Death", kind: "trait", text: "At 0 HP it collapses into a drained, withered husk — the same shape the villagers described from the silent town. Narrative only." },
    ],
    actions: [
      { name: "Raking Multiattack", kind: "action", attackCount: 2, text: "Two Claw attacks. It can replace one Claw with Grab." },
      { name: "Claw", kind: "attack", roll: "1d20 + 6", damage: "1d8 + 3 + 1d6", text: "+6 to hit, reach 5 ft., one target. Hit: 7 (1d8 + 3) slashing plus 3 (1d6) cold." },
      { name: "Rend", kind: "action", recharge: "4-6", save: "STR DC 13", text: "If both Claws hit the same creature this turn: +3d6 slashing, DC 13 STR save or knocked prone." },
      { name: "Grab (replaces one Claw)", kind: "action", save: "STR DC 13", text: "DC 13 STR save or grappled. A grappled creature takes 2d8 automatic damage at the start of each of the Wendigo's turns until it escapes." },
    ],
    reactions: [],
    resources: [],
    notes: [
      "Pseudo-Level-5 Mid-Act Boss. HP by party: 108 (4P low) / 120 (5P baseline) / 132 (6P high). Bumped 100->120, to-hit +6, Rend +3d6 / Recharge 4-6, Grab 2d8: a party of 4 dropped the old one in 4 rounds with nobody down, so the Act 2 line from here on is tuned to make them work for it.",
      "Village Night Defense: 2x Lesser Wendigo at 4-5P (staggered / simultaneous rooftop entry), 3x at 6P. Level 5 gate fires on the 2nd kill.",
      "Rooftops are their terrain — they enter from above and Mighty Leap off them; buildings break straight-line charge lanes. Neither retreats or repositions defensively.",
      "Track Rend recharge per Wendigo separately; Grab status per Wendigo (2d8 auto/turn; escape DC 13 flat at every party size — bands move HP and count, never DCs); Mighty Leap straight-line check on entry; husk flag on each death.",
      "AC/abilities reconstructed from the encounter doc's to-hit / DCs — tune to taste.",
    ],
    visibility: { defaultState: "hp-bar", hiddenName: "Rooftop Shape", revealedName: "Lesser Wendigo" },
  },
  // ── Act 2 · S4 — Frozen Sentinels (the line that patches itself) ──────────────
  {
    templateId: "broken-chain:act2:frozen-sentinel:v1",
    name: "Frozen Sentinel",
    encounterId: "act2-s4-frozen-sentinels",
    encounterLabel: "Act 2 S4 - Frozen Sentinels",
    // kit 1.80 = the line's control stack (~0.60-0.70 party uptime) PLUS the ~52 HP of
    // frost-thralls the two casters raise, which maxHp cannot see. Thralls themselves are
    // ~1.0 chaff (no spells) — they add raw HP, not denial.
    stats: { kind: "monster", ac: 15, maxHp: 65, speed: "30 ft", attacksPerTurn: 2, kitMultiplier: 1.80 },
    abilities: [
      formatAbility("STR", 11, 0),
      formatAbility("DEX", 15, 2),
      formatAbility("CON", 14, 2),
      formatAbility("INT", 16, 3),
      formatAbility("WIS", 12, 1),
      formatAbility("CHA", 16, 3),
    ],
    traits: [
      { name: "Warding Line", kind: "trait", text: "While at least two Frozen Sentinels are alive, each has advantage on saves against effects that would move it or knock it prone." },
      { name: "Frozen Nature", kind: "trait", text: "Immune to cold; needs no air, food, drink, or sleep. Fire and radiant damage cut through the frost unhindered." },
      { name: "Rimebound Spellcasting (INT, DC 14, +6)", kind: "trait", text: "Cantrips: Rime Touch, Killing Frost. 1st (4 slots): Frost Ward, Rimestep. 2nd (3 slots): Bind in Ice (holds a creature fast, as hold person). 3rd (2 slots): Raise the Frozen." },
    ],
    actions: [
      { name: "Multiattack", kind: "action", attackCount: 2, text: "Two Rime Claw attacks, or casts two Rime Bolts. When it casts two Rime Bolts, ONLY the first carries the icy-tendril restrain." },
      { name: "Rime Claw", kind: "attack", roll: "1d20 + 6", damage: "2d6 + 3", text: "+6 to hit, reach 5 ft., one target. Hit: 10 (2d6 + 3) cold. The wound crusts over with black frost." },
      { name: "Rime Bolt", kind: "attack", roll: "1d20 + 6", damage: "2d8 + 3 + 1d8", save: "STR DC 15", text: "Ranged spell attack, +6 to hit, range 120 ft., one target. Hit: 12 (2d8 + 3) cold plus 4 (1d8) necrotic. FIRST Rime Bolt each turn only: if the target is Large or smaller, it makes a DC 15 STR save or is restrained as icy tendrils lock around it for 1 minute. A restrained target can use its action to repeat the save, ending the effect on itself on a success." },
      { name: "Raise the Frozen (Animate Dead, 3rd-level slot)", kind: "action", text: "When any creature of the line drops to 0 HP, a surviving CASTER (Frozen Sentinel or Frost-Weaver) may use its action to raise it as a frost-thrall. FROST-THRALL: rises at 33% of its own maximum HP — Sentinel 21, Frostbound Warden 28, Frost-Weaver 25 — loses ALL spellcasting and every reaction (no Frost Ward, no Bind in Ice, no Glacial Freeze, no Whiteout), and attacks only with Rime Claw. One raise per caster; each body can be raised once. Raising costs that caster its whole action — a round of control traded for a body that only claws." },
      { name: "Rimestep (Bonus Action, 1st slot)", kind: "action", text: "Teleport 30 ft to a space it can see, holding the line." },
    ],
    reactions: [
      { name: "Frost Ward (Reaction, 1st slot)", kind: "reaction", text: "+5 AC until the start of its next turn when hit by an attack." },
      { name: "Glacial Freeze (Reaction, 1/day) — its Counterspell", kind: "reaction", text: "When a creature within 60 ft tries to cast a spell, the Sentinel snaps its fingers and a flash of supernatural frost instantly encases the caster's hands and arcane focus — the verbal and somatic components freeze solid before the spell can leave them. The spell fails and its slot is wasted if it is 3rd level or lower; for 4th level or higher, the Sentinel makes an INT check (DC 10 + the spell's level), and the spell fails on a success. ONLY the Frozen Sentinel has this — the Frost-Weaver does not." },
    ],
    resources: [],
    notes: [
      "Elite anchor / control caster — the homebrew 'deathlock' of the frozen north (original creature; WotC stat block used only as mechanical inspiration).",
      "HP by party band: 49 (4P) / 65 (5P baseline) / 81 (6P). The S4 line is Sentinel 65 + Frostbound Warden 85 + Frost-Weaver 75 = 225 base at 5P, up to ~278 with both raises.",
      "ENCOUNTER MATH (do not re-derive from raw HP): party fights S4 AND S5 at L5, pseudo +1, fresh off the village long rest. Balance to 5P MIDPOINT DPR (~100.5 expected, ~77.4 effective at 77% realization) — never to peak, or a low-rolling party turns this into a 10-round slog. 225 base carries the whole control stack (2x Bind in Ice, Whiteout, 3x Frost Ward, Wail, restraining bolts, Glacial Freeze) = party uptime ~0.60-0.70, so it plays as ~322-376 effective. Thralls add ~53 raw but carry NO control, so they are ~1.0 chaff, not 1.6. Total ~377-431 effective = 4.9-5.6 rounds, which sits correctly UNDER the Wendigo Wight's 5.8.",
      "Holds a line and never chases. Glacial Freeze (its reskinned Counterspell) fires on the party's first real spell — freezes the components solid. Raise the Frozen patches the line the moment one falls: drop two fast.",
      "Track Glacial Freeze (1/day per Sentinel), Raise-the-Frozen slots, Warding Line active count, Frost Ward reaction uses, and any icy-tendril restrains (repeat save as an action).",
      "Drop: Gold at performance band + Potion of Resistance (Cold) x1 + Antitoxin x2.",
      "Homebrew — original names/flavor; AC/HP/DCs tuned for pseudo-L6, adjust to taste.",
    ],
    visibility: { defaultState: "hp-bar", hiddenName: "Ward Armor in the Road", revealedName: "Frozen Sentinel" },
  },
  // ── Act 2 · S4 — Frostbound Warden (defensive fear-caster + withering claws) ───
  {
    templateId: "broken-chain:act2:frostbound-warden:v1",
    name: "Frostbound Warden",
    encounterId: "act2-s4-frozen-sentinels",
    encounterLabel: "Act 2 S4 - Frozen Sentinels",
    // kit 1.80: shares the S4 line's control stack + thrall HP (see Frozen Sentinel).
    stats: { kind: "monster", ac: 15, maxHp: 85, speed: "30 ft", attacksPerTurn: 2, kitMultiplier: 1.80 },
    abilities: [
      formatAbility("STR", 11, 0),
      formatAbility("DEX", 14, 2),
      formatAbility("CON", 16, 3),
      formatAbility("INT", 12, 1),
      formatAbility("WIS", 14, 2),
      formatAbility("CHA", 16, 3),
    ],
    traits: [
      { name: "Frozen Nature", kind: "trait", text: "Immune to cold; needs no air, food, drink, or sleep. Fire and radiant damage cut through the frost unhindered." },
      { name: "Turn Resistance", kind: "trait", text: "Advantage on saving throws against any effect that turns undead." },
      { name: "Warden's Wards (CHA, DC 13, +5)", kind: "trait", text: "Defensive casting only: Frost Ward (as a reaction), Rimestep (teleport 30 ft), Bind in Ice (holds one creature fast, as hold person). It wards and pins — it does not blast." },
    ],
    actions: [
      { name: "Multiattack", kind: "action", attackCount: 2, text: "Two Withering Frost claws, or casts one warding/control spell in place of the attacks." },
      { name: "Withering Frost", kind: "attack", roll: "1d20 + 5", damage: "1d8 + 3 + 1d6", save: "CON DC 13", text: "+5 to hit, reach 5 ft., one target. Hit: 7 (1d8 + 3) cold plus 3 (1d6) necrotic. The target makes a DC 13 CON save; on a fail its hit point maximum drops by the total damage taken until it finishes a long rest. A creature reduced to 0 max HP this way dies and freezes where it falls." },
      { name: "Wail of the Frozen Dead (1/day) — its Fear", kind: "action", save: "WIS DC 13", text: "The Warden looses a cold, hollow wail. Each creature in a 30-ft cone that can hear it makes a DC 13 WIS save or is frightened of the Warden for 1 minute. A frightened creature repeats the save at the end of each of its turns, ending the effect on a success." },
      { name: "Rime Bolt", kind: "attack", roll: "1d20 + 5", damage: "2d8 + 3", text: "Ranged spell attack, +5 to hit, range 120 ft., one target. Hit: 12 (2d8 + 3) cold. (No restrain — that rider belongs to the Sentinel's and the Weaver's bolts.)" },
    ],
    reactions: [
      { name: "Frost Ward (Reaction)", kind: "reaction", text: "+5 AC until the start of its next turn when hit by an attack." },
    ],
    resources: [],
    notes: [
      "FRONT-LINE RUSHER — the homebrew 'deathlock wight' step-up (original creature; WotC stat block used only as mechanical inspiration). The beefiest body of the S4 line: it closes, the two casters hold the back.",
      "HP band: 64 (4P) / 85 (5P baseline) / 106 (6P). It is NOT a raiser — only the two casters (Sentinel, Frost-Weaver) carry Raise the Frozen. Raised as a frost-thrall it returns at 28 HP with Rime Claw only, losing Wail and Frost Ward.",
      "Withering Frost is the attrition clock: max-HP reduction until a long rest. Wail of the Frozen Dead scatters the front line for a round. Frost Ward soaks the first big hit each round.",
      "Track Wail (1/day), Withering Frost max-HP reductions per target, Frost Ward reaction uses, and Bind in Ice targets.",
      "Homebrew — original names/flavor; tune AC/HP/DCs to taste.",
    ],
    visibility: { defaultState: "hp-bar", hiddenName: "The Warden That Forgot Its Name", revealedName: "Frostbound Warden" },
  },
  // ── Act 2 · S4 — Frost-Weaver (CR-5 controller; opens with Whiteout) ───────────
  {
    templateId: "broken-chain:act2:frost-weaver:v1",
    name: "Frost-Weaver",
    encounterId: "act2-s4-frozen-sentinels",
    encounterLabel: "Act 2 S4 - Frozen Sentinels",
    // kit 1.80: Whiteout (heavily obscured = disadvantage in), restraining bolts,
    // Frost-Weave Pull, Rimestep — the line's densest denial — plus thrall HP.
    stats: { kind: "boss", ac: 14, maxHp: 75, speed: "30 ft", attacksPerTurn: 2, kitMultiplier: 1.80 },
    abilities: [
      formatAbility("STR", 10, 0),
      formatAbility("DEX", 16, 3),
      formatAbility("CON", 14, 2),
      formatAbility("INT", 17, 3),
      formatAbility("WIS", 14, 2),
      formatAbility("CHA", 15, 2),
    ],
    traits: [
      { name: "Frozen Nature", kind: "trait", text: "Immune to cold; needs no air, food, drink, or sleep. Fire and radiant damage cut through the frost unhindered." },
      { name: "Controller, Not a Brute", kind: "trait", text: "The Frost-Weaver shapes the battlefield rather than trading blows — it opens with Whiteout, keeps casters and strikers pinned, and drags the party where it wants them. Control over damage, always." },
      { name: "Weave Spellcasting (INT, DC 15, +7)", kind: "trait", text: "Cantrips: Rime Touch, Killing Frost. Control kit: Whiteout, Bind in Ice (as hold person), Grasping Rime (a 20-ft sphere of clutching frost, as hunger of hadar), Rimestep. It has NO Glacial Freeze — the Sentinel silences casters, the Weaver moves and pins them." },
    ],
    actions: [
      { name: "Multiattack", kind: "action", attackCount: 2, text: "Casts two Rime Bolts. Both carry the icy-tendril restrain — the Weaver is the one creature in the line whose every bolt binds. It gives this up whenever Whiteout or Frost-Weave Pull is the better play, which is most turns." },
      { name: "Whiteout (Turn 1, its Sleet Storm)", kind: "action", save: "DEX DC 15", text: "A 40-ft-tall, 20-ft-radius cylinder of freezing rain centered on a point within 150 ft. The area is heavily obscured, open flames in it are doused, and its ground becomes slick ice (difficult terrain). When a creature enters the area for the first time on a turn or starts its turn there, it makes a DC 15 DEX save or falls prone. A creature concentrating that starts its turn in the area makes a DC 15 concentration save or loses the spell. The Weaver drops this on turn one." },
      { name: "Rime Bolt", kind: "attack", roll: "1d20 + 7", damage: "2d8 + 3 + 1d8", save: "STR DC 15", text: "Ranged spell attack, +7 to hit, range 120 ft., one target. Hit: 12 (2d8 + 3) cold plus 4 (1d8) necrotic. EVERY Rime Bolt the Weaver casts carries the icy-tendril restrain: if the target is Large or smaller, it makes a DC 15 STR save or is restrained by icy tendrils for 1 minute, repeating the save as an action to end it." },
      { name: "Frost-Weave Pull", kind: "action", recharge: "6", save: "STR DC 15", text: "The Weaver hauls on threads of frost woven through the ice. Each creature within 30 ft makes a DC 15 STR save. On a fail: dragged up to 20 ft straight toward the Weaver across the ice, takes 14 (4d6) cold, and is restrained in frost-weave until the end of its next turn. On a success: half damage, no pull, no restrain. Sets the party up for the Sentinels, the Warden's claws, and the killing frost." },
      { name: "Raise the Frozen (Animate Dead, 3rd-level slot)", kind: "action", text: "The Weaver is the line's SECOND caster and carries Animate Dead alongside the Sentinel. When any creature of the line drops to 0 HP, it may use its action to raise it as a frost-thrall: 33% of its own maximum HP (Sentinel 21, Warden 28, Frost-Weaver 25), no spellcasting, no reactions, Rime Claw only. One raise per caster; each body once." },
      { name: "Rimestep (Bonus Action)", kind: "action", text: "Teleport 30 ft to a space it can see, staying out of melee reach." },
    ],
    reactions: [],
    resources: [],
    notes: [
      "Controller — the homebrew 'frost-weaver' (original creature). Prefers control to damage every turn, and is the line's SECOND caster (carries Animate Dead with the Sentinel).",
      "HP band: 56 (4P) / 75 (5P baseline) / 94 (6P). One per Frozen Sentinel line — it is the brain: Whiteout turn 1, then pins with Bind in Ice / Grasping Rime and repositions with Rimestep and Frost-Weave Pull.",
      "NOTE: every attack it has is a spell, so a raised Frost-Weaver would have nothing to do — the shared frost-thrall profile (33% HP, Rime Claw only) is what makes its raised state legal.",
      "Opening: Whiteout on turn 1 blinds ranged attackers and ices the floor (DEX-save-or-prone). Frost-Weave Pull (Recharge 6) is the big control swing — drag the party off their marks into the Sentinels' reach and lock them in frost-weave.",
      "Every Frost-Weaver Rime Bolt restrains (the 'mastermind' icy-tendril rider). No Counterspell/Glacial Freeze — that belongs to the Sentinel only.",
      "Track Whiteout area + concentration checks, Frost-Weave Pull recharge (6), icy-tendril restrains, and Grasping Rime/Bind in Ice targets.",
      "Homebrew — original names/flavor; tune AC/HP/DCs to taste.",
    ],
    visibility: { defaultState: "hp-bar", hiddenName: "The Shape That Weaves the Cold", revealedName: "Frost-Weaver" },
  },
  // ── Act 2 · S4 — Pale Drifter (the tone shift) ───────────────────────────────
  {
    templateId: "broken-chain:act2:pale-drifter:v1",
    name: "Pale Drifter",
    encounterId: "act2-s4-pale-drifter",
    encounterLabel: "Act 2 S4 - Pale Drifter",
    // kit 1.30: Shadow Shift every turn (melee never gets a full round on it, ~0.85
    // uptime) + Soul-Touched (~1.1 now that magic weapons are common).
    stats: { kind: "boss", ac: 16, maxHp: 120, speed: "30 ft", kitMultiplier: 1.30 },
    abilities: [
      formatAbility("STR", 18, 4),
      formatAbility("DEX", 14, 2),
      formatAbility("CON", 16, 3),
      formatAbility("INT", 6, -2),
      formatAbility("WIS", 12, 1),
      formatAbility("CHA", 10, 0),
    ],
    traits: [
      { name: "Soul-Touched", kind: "trait", text: "Nonmagical weapon attacks deal half damage. Magical weapons connect fully." },
      { name: "Pale Aura", kind: "trait", text: "Sheds dim light 20 ft in wrong-temperature blue-white. Darkness zones near it are highly visible — Shadow Shift targets are predictable if the party maps them." },
      { name: "Death Burst", kind: "trait", text: "At 0 HP the Drifter comes apart. Every creature within 15 ft makes a DC 14 CON save, taking 21 (6d6) cold on a fail, half on a success. Flat DC, flat radius, every party size — the band moves HP, never abilities. Spread before the killing blow." },
    ],
    actions: [
      { name: "Multiattack", kind: "action", attackCount: 2, text: "Two Frost Slam attacks." },
      { name: "Frost Slam", kind: "attack", roll: "1d20 + 7", damage: "2d10 + 4", text: "+7 to hit, reach 10 ft., one target. Hit: 15 (2d10 + 4) cold." },
      { name: "Shadow Shift (Bonus Action)", kind: "action", text: "Teleport up to 20 ft between dim light or darkness areas it can see — a flat 20 ft at every party size. Magical effect, so Counterspell can attempt to block it. It never attacks twice from the same position." },
    ],
    reactions: [],
    resources: [],
    notes: [
      "Elite Solo. HP: 90 (4P) / 120 (5P baseline) / 150 (6P) — HP is the ONLY thing the band moves.",
      "BANDS DO NOT CHANGE ABILITIES. Death Burst is a flat DC 14 / 6d6 / 15-ft radius at every party size (was DC 12/14/15 with a 20-ft radius at 6P — that scaling is removed). Shadow Shift is a flat 20 ft (was 15 ft at 4P). Numbers checked: at a depleted 20 HP, 6d6 downs at least one of the three melee ~5.3 times in 10 and all three ~0.11 in 10 — it hurts, it does not execute. It cannot touch anyone above 36 HP.",
      "Uses Shadow Shift every turn (never attacks twice from the same position) and targets whoever just spent a resource or is holding concentration.",
      "Death Burst is the exam — it does not warn the party. Flag party spread positions before the kill blow. Soul-Touched resistance flagged per attacker (magical vs nonmagical).",
      "Drop: Gold at performance band + Potion of Greater Healing x2. Camp before stepping onto the ice.",
      "AC/abilities reconstructed from the encounter doc — tune to taste.",
    ],
    visibility: { defaultState: "hp-bar", hiddenName: "The Light at the Tree Line", revealedName: "Pale Drifter" },
  },
  // ── Act 2 · S4 — Frozen Cloak (the Drifter's shadow; homebrew) ────────────────
  {
    templateId: "broken-chain:act2:frozen-cloak:v1",
    name: "Frozen Cloak",
    encounterId: "act2-s4-pale-drifter",
    encounterLabel: "Act 2 S4 - Pale Drifter",
    // kit 1.84 = (85 raw + 34 Reknit) x 1.31 denial, expressed against maxHp 85.
    // Reknit's second life is NOT in maxHp, so the multiplier must carry it or the
    // rounds estimate silently under-counts this creature by 40%.
    stats: { kind: "monster", ac: 14, maxHp: 85, speed: "30 ft, fly 30 ft (hover)", kitMultiplier: 1.84 },
    abilities: [
      formatAbility("STR", 1, -5),
      formatAbility("DEX", 17, 3),
      formatAbility("CON", 12, 1),
      formatAbility("INT", 14, 2),
      formatAbility("WIS", 13, 1),
      formatAbility("CHA", 14, 2),
    ],
    traits: [
      { name: "Cold-Woven", kind: "trait", text: "Resistant to nonmagical bludgeoning, piercing, and slashing. Immune to cold, necrotic, and poison. VULNERABLE to radiant. Immune to the exhaustion, grappled, paralyzed, petrified, poisoned, prone, and restrained conditions — there is no body here to hold down." },
      { name: "Reknit in the Cold", kind: "trait", text: "When the Frozen Cloak drops to 0 hit points while standing in dim light or darkness, it does not die — it comes apart into a drift of frost and reknits at the START of its next turn with 34 hit points, in an unoccupied space it can see within 20 ft. Once per fight. It CANNOT reknit if the blow that dropped it was radiant, or if it is standing in bright light when it falls. Kill it in the light, or kill it twice." },
      { name: "Bodiless Drift", kind: "trait", text: "Moves through creatures and objects as if they were difficult terrain. Takes 5 (1d10) force damage if it ends its turn inside an object." },
      { name: "Light-Struck", kind: "trait", text: "In bright light, the Cloak has disadvantage on attack rolls and ability checks. A lantern is a weapon against it — and against Reknit in the Cold." },
    ],
    actions: [
      { name: "Frostshadow Claw", kind: "attack", roll: "1d20 + 5", damage: "3d8 + 3", text: "+5 to hit, reach 5 ft., one target. Hit: 16 (3d8 + 3) psychic — the cold of being unmade, not the cold of weather. It does not bleed you; it thins you." },
      { name: "Fold Into the Cold (Bonus Action)", kind: "action", text: "While in dim light or darkness, the Cloak takes the Hide action. The Pale Drifter's Pale Aura sheds dim light in a 20-ft radius — the Drifter IS its cover. Run them together or the Cloak loses half its kit." },
    ],
    reactions: [],
    resources: [],
    notes: [
      "Homebrew 'frozen cloak' — original creature and flavor; a WotC shadow-fiend stat block was mechanical inspiration only. Pairs with the Pale Drifter as the S4 tone-shift fight.",
      "HP band: 64 (4P) / 85 (5P baseline) / 106 (6P). Reknit returns it at 34 (40%), once.",
      "ENCOUNTER MATH: fought at L5, pseudo +1, on a SHORT REST ONLY (the village long rest was before S4; the next long rest is right before the Wendigo Wight), so party output here is ~68 effective, below the fresh 77.4. Drifter 120 x ~1.3 = ~156 effective, plus Cloak (85 + 34 reknit = 119 raw) x ~1.31 = ~156 effective -> ~312 total = ~4.6 rounds. Sits above the 3-round floor and under the Wight's 6.0.",
      "The synergy IS the fight: Pale Aura's dim light lets the Cloak Fold Into the Cold every single turn, while the Drifter Shadow Shifts out of melee. Bright light and radiant break both — Light-Struck, Reknit, and the Drifter's own darkness-hopping all fold to a lantern.",
      "Its resistances are deliberately NOT the full source suite (which resists all B/P/S regardless of magic). By this point the party has had two chances at magical weapons, so nonmagical-only resistance keeps the effective HP near 1.76x rather than ballooning past the act boss.",
      "Demonic-restoration-style 'reforms elsewhere after death' was cut — it never mattered at the table. Reknit in the Cold replaces it with a real combat beat that has real counterplay.",
    ],
    visibility: { defaultState: "hp-bar", hiddenName: "The Cold That Follows the Light", revealedName: "Frozen Cloak" },
  },
  // ── Act 2 · S5 — Wendigo Wight (The Lake Fight, final boss) ───────────────────
  {
    templateId: "broken-chain:act2:wendigo-wight:v1",
    name: "Wendigo Wight",
    encounterId: "act2-s5-wendigo-wight",
    encounterLabel: "Act 2 S5 - Wendigo Wight (The Lake Fight)",
    // kit 1.37: Wrong Cold aura spacing (~5%), Hunger Leap repositioning on ~33% of rounds
    // (~10-15%), legendary-driven downs (~10%), + working Frozen Endurance (~4%).
    stats: { kind: "boss", ac: 17, maxHp: 340, speed: "40 ft", kitMultiplier: 1.37, classification: "act-boss" },
    abilities: [
      formatAbility("STR", 20, 5),
      formatAbility("DEX", 14, 2),
      formatAbility("CON", 18, 4),
      formatAbility("INT", 8, -1),
      formatAbility("WIS", 14, 2),
      formatAbility("CHA", 12, 1),
    ],
    traits: [
      { name: "Wrong Cold (Aura)", kind: "trait", text: "At the start of the Wendigo Wight's turn, all creatures within 10 ft take 1d8 cold damage automatically. No save. This is not weather." },
      { name: "Bone Field Raise", kind: "trait", text: "The bone field under the ice is full of what it has already eaten. On round 2, as a bonus action, the Wight hauls one Lesser Wendigo (70 HP — freshly pulled from the ice, hasn't fed) up through the ice. Once per fight. The Wight ALWAYS has this trait; whether there is a body to raise is a ROSTER question — add 1x Lesser Wendigo to this encounter at 6P and this is simply how it walks on. At 4-5P the roster holds none and the trait never fires. Count changes with the band; abilities do not." },
      { name: "Frozen Endurance", kind: "trait", text: "The FIRST time the Wendigo Wight drops to 0 hit points, it drops to 1 hit point instead — the wrong cold knits it back together before it can finish dying. No save, no roll. Once per fight. Fire or radiant damage bypasses this completely: if the blow that reduced it to 0 was fire or radiant, it dies then and there." },
    ],
    actions: [
      { name: "Hunger Multiattack", kind: "action", attackCount: 2, text: "Two Devouring Claw attacks, plus one Hunger Bite if a creature is grappled." },
      { name: "Devouring Claw", kind: "attack", roll: "1d20 + 8", damage: "2d10 + 5 + 1d8", save: "STR DC 15", text: "+8 to hit, 2d10 + 5 slashing plus 1d8 cold. DC 15 STR save or grappled." },
      { name: "Hunger Bite (Grappled only)", kind: "attack", roll: "1d20 + 8", damage: "3d8 + 5 + 2d8", text: "+8 to hit, 3d8 + 5 piercing plus 2d8 cold. The grappled creature's max HP is reduced by the cold damage dealt until a long rest." },
      { name: "Hunger Leap", kind: "action", recharge: "5-6", save: "STR DC 15", text: "Leaps up to 30 ft to an unoccupied space it can see. Each creature within 10 ft of the landing makes a DC 15 STR save or is knocked prone and pushed 10 ft (2d6 bludgeoning on a fail). It then makes one Devouring Claw against the nearest creature." },
      { name: "Legendary Actions (3/round)", kind: "action", text: "The Wendigo Wight can take 3 legendary actions, choosing from the options below; only one at a time and only at the end of another creature's turn. It regains all spent legendary actions at the start of its turn." },
      { name: "Mark Prey (Legendary — 1 action)", kind: "action", text: "Marks one creature it can see. Until the end of that creature's next turn, the Wendigo has advantage on attacks against it and ignores any bonus to its AC from shields." },
      { name: "Frozen Prowl (Legendary — 1 action)", kind: "action", text: "Moves up to half its speed across the ice without provoking opportunity attacks." },
      { name: "Wrong Cold Pulse (Legendary — 2 actions)", kind: "action", save: "CON DC 15", text: "The wrong cold gutters outward. Each creature within 15 ft takes 9 (2d8) cold damage (no save); each must then make a DC 15 CON save or have its speed halved until the end of its next turn." },
    ],
    reactions: [],
    resources: [],
    notes: [
      "ACT 2 FINAL BOSS. HP: 310 (4P) / 340 (5P baseline) / 370 (6P) per the encounter document — do NOT re-derive this from raw HP. Runs 3 Legendary Actions/round (Mark Prey, Frozen Prowl, Wrong Cold Pulse) so the solo boss keeps action-economy pace with 4-6 PCs; claws +8, grapple DC 15 — all flat at every party size. At 6P add 1x Lesser Wendigo (70 HP) to the ROSTER; Bone Field Raise is merely how it arrives on round 2. That is a count change, not a band-gated ability.",
      "ENCOUNTER MATH: fought at L5 (pseudo +1), FRESH off the minimum-hours long rest, so the party is at full 5P midpoint DPR (~77.4 effective). 340 raw x ~1.33 kit (Wrong Cold aura spacing, Hunger Leap repositioning ~33% of rounds, legendary-driven downs) = ~450 effective = 5.8 rounds, hitting the ~6-round act-boss target. Solving forward gives 349 vs the doc's 340 — within 3%, so the document is correct and an earlier 370 bump was reverted.",
      "Frozen Endurance REWRITTEN (was dead): the old 'DC 10 + damage taken' CON save could never be passed — a 25-damage killing blow set DC 35 against a d20+4 — so it only fired on chip damage and its fire/radiant counterplay was meaningless. It is now automatic and once per fight, which makes the fire/radiant bypass a real decision. Costs the party roughly one extra attack (~+4% effective HP), so the kit multiplier moves ~1.33 -> ~1.37 and 340 lands at 6.0 rounds — still on target, no HP change needed.",
      "Open ice field — no cover, no darkness. The whole fight is about managing the 10-ft Wrong Cold aura; Hunger Leap resets positions so the party can't just kite. Grapple + Hunger Bite is the max-HP attrition clock.",
      "Frozen Endurance is bypassed by fire and radiant. Track Wrong Cold per round, grapple + max-HP reduction per creature, Hunger Leap recharge, Mark Prey (1/round), and the 6P Bone Field Raise flag. Level 6 gate on kill.",
      "AC/abilities reconstructed from the encounter doc's to-hit / DCs — tune to taste.",
    ],
    visibility: { defaultState: "hp-bar", hiddenName: "The Thing at the Center of the Lake", revealedName: "Wendigo Wight" },
  },
];
