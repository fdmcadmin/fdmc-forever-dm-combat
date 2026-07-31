import type { MonsterReaderAction } from "../../core/monsters/MonsterJconScanner";
import type { MainMonsterTemplate } from "../../core/monsters/runtime/mainMonsterRuntime";

/**
 * `save` is the SAVING-THROW modifier when it differs from the ability modifier — i.e.
 * when the creature is proficient in that save. Omit it and the save equals the check,
 * which is correct for a creature with no save proficiency.
 *
 * NOTE: no Act 2 creature currently authors saves, so every one of them saves at its raw
 * modifier. That matters most for the Wendigo Wight: a solo act boss with no proficient
 * saves is very exposed to save-or-suck, since its HP only matters if it gets to act.
 */
function formatAbility(label: string, score: number, modifier: number, save?: number) {
  const signed = modifier >= 0 ? `+${modifier}` : `${modifier}`;
  return { label, value: `${score} (${signed})`, ...(typeof save === "number" ? { save } : {}) };
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
    // No v12 workbook lane for this fight - coverage is explicit at 1.0 rather than an
    // invented multiplier. Revisit if it ever gets a Monte Carlo run.
    stats: {
      kind: "beast", ac: 13, maxHp: 18, speed: "50 ft",
      defenses: [
        { name: "No notable defensive traits", ehpMultiplier: 1.0, note: "Pack Tactics is offensive (advantage to hit), not durability. Plain HP bar." },
      ],
    },
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
    // No v12 workbook lane for this fight - coverage is explicit at 1.0 rather than an
    // invented multiplier. Revisit if it ever gets a Monte Carlo run.
    stats: {
      kind: "beast", ac: 14, maxHp: 33, speed: "50 ft",
      defenses: [
        { name: "No notable defensive traits", ehpMultiplier: 1.0, note: "Leads the pack but takes damage normally. Plain HP bar." },
      ],
    },
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
    // No v12 workbook lane for this fight - coverage is explicit at 1.0 rather than an
    // invented multiplier. Revisit if it ever gets a Monte Carlo run.
    stats: {
      kind: "monstrosity", ac: 13, maxHp: 59, attacksPerTurn: 2, speed: "40 ft",
      defenses: [
        { name: "No notable defensive traits", ehpMultiplier: 1.0, note: "Big HP pool, no resistances or revival. Plain HP bar." },
      ],
    },
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
    // No v12 workbook lane for this fight - coverage is explicit at 1.0 rather than an
    // invented multiplier. Revisit if it ever gets a Monte Carlo run.
    stats: {
      kind: "unspecified", ac: 15, maxHp: 65, attacksPerTurn: 3, speed: "30 ft",
      defenses: [
        { name: "No notable defensive traits", ehpMultiplier: 1.0, note: "No resistances, no second life. Plain HP bar." },
      ],
    },
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
    // No v12 workbook lane for this fight - coverage is explicit at 1.0 rather than an
    // invented multiplier. Revisit if it ever gets a Monte Carlo run.
    stats: {
      kind: "beast", ac: 13, maxHp: 22, speed: "30 ft., climb 30 ft.",
      defenses: [
        { name: "No notable defensive traits", ehpMultiplier: 1.0, note: "Webbing slows the party but does not make the spider harder to kill. Plain HP bar." },
      ],
    },
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
    // No v12 workbook lane for this fight - coverage is explicit at 1.0 rather than an
    // invented multiplier. Revisit if it ever gets a Monte Carlo run.
    stats: {
      kind: "unspecified", ac: 13, maxHp: 26, speed: "30 ft.",
      defenses: [
        { name: "No notable defensive traits", ehpMultiplier: 1.0, note: "Ambush is an opener, not durability. Plain HP bar." },
      ],
    },
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
    // Act 1 boss. No v12 workbook lane, but unlike the Act 1 chaff it has a real defensive
    // trait, so it is itemised rather than flattened to 1.0. ESTIMATE — no MC run.
    stats: {
      kind: "unspecified", ac: 14, maxHp: 100, attacksPerTurn: 2, speed: "50 ft",
      defenses: [
        { name: "Phantom Step", ehpMultiplier: 1.18, note: "Attacks against it have disadvantage until it takes damage in a round, so the party's first swing each round is much likelier to miss. Roughly one lost attack per round early in the fight." },
      ],
    },
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
    // Hollow Pack formation defense (shared with Pack Hunter) — derived from the v12
    // Encounter Safety screen: 159 HP @5P won in 1.48 rounds, lifted onto the Monte Carlo
    // scale by the ×1.27 dynamics factor the two MC-run fights show. PROVISIONAL: this
    // fight has no MC lane of its own yet.
    stats: {
      kind: "beast", ac: 13, maxHp: 75, speed: "50 ft",
      defenses: [
        { name: "Ambush + Apex Unleashed", ehpMultiplier: 1.40, note: "Waits out round 1 and only commits on the round-2 timer, so the party's opening burst lands on chaff; Cold Breath unlocks when the first Pack Hunter drops. v12 analytic 1.48 rds × 1.27 dynamics." },
      ],
    },
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
    // Shares the Hollow Pack formation defense (see Pale Stalker). AC 12 is its own
    // offensive-side term — it is the easiest body in the fight to hit.
    stats: {
      kind: "beast", ac: 12, maxHp: 26, speed: "40 ft",
      defenses: [
        { name: "Pack coordination", ehpMultiplier: 1.40, note: "Shares the Hollow Pack formation value; the Hunters screen the Stalker until one of them falls. v12 analytic 1.48 rds × 1.27 dynamics. PROVISIONAL — no MC lane yet." },
      ],
    },
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
    // Frozen Hollow formation defense (shared across all three bodies) — v12 Encounter
    // Safety: 200 HP @5P won in 2.02 rounds, × 1.27 dynamics. PROVISIONAL, no MC lane yet.
    stats: {
      kind: "undead", ac: 12, maxHp: 42, speed: "20 ft",
      defenses: [
        { name: "Hollow Fortitude", ehpMultiplier: 1.45, note: "DC 5 + damage CON save at 0 HP drops it to 1 instead (radiant or a crit bypasses), so kills must be confirmed. Carries the Frozen Hollow formation value: v12 analytic 2.02 rds × 1.27 dynamics." },
      ],
    },
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
    // No v12 workbook lane for this fight - coverage is explicit at 1.0 rather than an
    // invented multiplier. Revisit if it ever gets a Monte Carlo run.
    stats: {
      kind: "undead", ac: 12, maxHp: 35, speed: "30 ft",
      defenses: [
        { name: "No notable defensive traits", ehpMultiplier: 1.0, note: "Unused legacy creature (no encounter). Plain HP bar." },
      ],
    },
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
    // Shares the Frozen Hollow formation defense (see Icebound Zombie).
    stats: {
      kind: "undead", ac: 13, maxHp: 36, speed: "30 ft",
      defenses: [
        { name: "Cold Aura + paralysis", ehpMultiplier: 1.45, note: "Aura saves compound with the Hunter's drain and paralysis removes whole PC turns. Frozen Hollow formation value: v12 analytic 2.02 rds × 1.27 dynamics. PROVISIONAL." },
      ],
    },
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
    // Shares the Frozen Hollow formation defense (see Icebound Zombie).
    stats: {
      kind: "undead", ac: 14, maxHp: 82, attacksPerTurn: 2, speed: "30 ft", classification: "elite",
      defenses: [
        { name: "Nonmagical resistance + STR drain", ehpMultiplier: 1.45, note: "Halves nonmagical weapon damage and drains STR (cap 6), softening every later hit. Frozen Hollow formation value: v12 analytic 2.02 rds × 1.27 dynamics. PROVISIONAL." },
      ],
    },
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
    // Re-derived under the split model. The old 1.10 was calibrated when kitMultiplier still
    // absorbed AC; now AC 14 is its own offensive-side term, so this number is traits only.
    // v12 Encounter Safety: Last Directive 151 HP @5P won in 1.74 rounds × 1.27 dynamics.
    stats: {
      kind: "celestial", ac: 14, maxHp: 85, attacksPerTurn: 2, speed: "0 ft., fly 5 ft",
      defenses: [
        { name: "Weeping Souls + max-HP drain", ehpMultiplier: 1.64, note: "Corrupted Touch cuts the party's max HP until a long rest, so their effective pool shrinks while the Guardian's does not — the aura makes every extra round cost more. PROVISIONAL: derived from the analytic screen, no MC lane yet." },
      ],
    },
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
    // The old 1.50 was almost entirely its AC 19 wearing a defensive costume. With AC split
    // out (acFactor 0.62 at L4 — by far the hardest thing to hit in the act) what remains is
    // the shared Last Directive formation value, not a second helping of the same armour.
    stats: {
      kind: "undead", ac: 19, maxHp: 12, speed: "0 ft., fly 50 ft. (hover)",
      defenses: [
        { name: "Patrol screen", ehpMultiplier: 1.64, note: "Three Lights tracked separately; magical vs nonmagical matters per attacker. Shares the Last Directive formation value. PROVISIONAL — analytic-derived, no MC lane yet." },
      ],
    },
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
    // No v12 workbook lane for this fight - coverage is explicit at 1.0 rather than an
    // invented multiplier. Revisit if it ever gets a Monte Carlo run.
    stats: {
      kind: "unspecified", ac: 15, maxHp: 45, attacksPerTurn: 2, speed: "30 ft",
      defenses: [
        { name: "No notable defensive traits", ehpMultiplier: 1.0, note: "No resistances, no second life. Plain HP bar." },
      ],
    },
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
    // No v12 workbook lane for this fight - coverage is explicit at 1.0 rather than an
    // invented multiplier. Revisit if it ever gets a Monte Carlo run.
    stats: {
      kind: "unspecified", ac: 16, maxHp: 45, attacksPerTurn: 2, speed: "30 ft",
      defenses: [
        { name: "No notable defensive traits", ehpMultiplier: 1.0, note: "No resistances, no second life. Plain HP bar." },
      ],
    },
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
    // No v12 workbook lane for this fight - coverage is explicit at 1.0 rather than an
    // invented multiplier. Revisit if it ever gets a Monte Carlo run.
    stats: {
      kind: "unspecified", ac: 14, maxHp: 27, speed: "30 ft",
      defenses: [
        { name: "No notable defensive traits", ehpMultiplier: 1.0, note: "Slip Between repositions it; bright light grounds that entirely. Plain HP bar." },
      ],
    },
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
    // v12 Encounter Safety: Lesser Wendigos 300 HP @5P (2× 120 at 4P) won in 2.46 rounds
    // × 1.27 dynamics. PROVISIONAL — analytic-derived, no MC lane of its own yet.
    stats: {
      kind: "undead", ac: 15, maxHp: 120, attacksPerTurn: 2, speed: "40 ft", classification: "mid-boss",
      size: "Large", archetype: "skirmisher",
      defenses: [
        { name: "Two fronts + Grab", ehpMultiplier: 1.21, note: "Two bodies entering from separate approaches split the party's focus, and a grappled PC bleeds turns escaping. Note the workbook gives this fight NO trait-based EHP uplift — the value here is fight dynamics, not resistances." },
      ],
    },
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
    // HP grounded in chassis (2026-07-17): Deathlock (MMotM CR 4) chassis = 8d8; its dispel
    // magic is the Glacial Freeze counterspell. Tactician (INT) archetype — leaned MORE caster,
    // LESS body: CON +1 (not +2), so 8d8 avg 36 + 1x8 = 44 (was a guessed 65). kit 1.80 = the
    // line's control stack (~0.60-0.70 party uptime) plus the Frozen Husk(s) any raiser can
    // add, which maxHp cannot see. A husk is ~1.0 chaff (no spells, its own AC14/HP25 template
    // — see "Frozen Husk" below) — raw HP, not denial.
    // HP 52 = authored 4P standard (v12 encounter doc: "HP 52 · AC 15. 7d8 + 21 at CON 16").
    // Formation defenses (shared by all three bodies — the v12 MC constrains the encounter
    // total, not each creature). AC now handled separately on the offensive side.
    stats: {
      kind: "undead", ac: 15, maxHp: 52, speed: "30 ft", attacksPerTurn: 2,
      size: "Medium", classification: "elite", archetype: "tactician",
      spellSlots: [{ level: 1, max: 4 }, { level: 2, max: 3 }, { level: 3, max: 2 }],
      defenses: [
        { name: "Raise the Frozen", ehpMultiplier: 1.30, note: "Two casters each raise one body as a 33%-HP frost-thrall; the formation's own revival value, ~+30% HP across the fight." },
        { name: "Frost Ward (reaction)", ehpMultiplier: 1.14, note: "+5 AC on a hit, once per round per body — a spent reaction turns roughly one landed attack per round into a miss." },
        { name: "Control denial (Whiteout / Bind in Ice / Glacial Freeze)", ehpMultiplier: 1.26, note: "Heavy obscurement, paralysis, restraints and an outright countered spell cost the party attacking turns." },
      ],
    },
    abilities: [
      formatAbility("STR", 11, 0),
      formatAbility("DEX", 15, 2),
      formatAbility("CON", 12, 1),
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
      { name: "Rime Claw", kind: "attack", roll: "1d20 + 6", damage: "2d6 + 3", text: "+6 to hit, reach 5 ft., one target. Hit: 10 (2d6 + 3) cold. The wound crusts over with black frost." },
      { name: "Rime Bolt", kind: "attack", roll: "1d20 + 6", damage: "2d8 + 3 + 1d8", save: "STR DC 15", text: "Ranged spell attack, +6 to hit, range 120 ft., one target. Hit: 12 (2d8 + 3) cold plus 4 (1d8) necrotic. FIRST Rime Bolt each turn only: if the target is Large or smaller, it makes a DC 15 STR save or is restrained as icy tendrils lock around it for 1 minute. A restrained target can use its action to repeat the save, ending the effect on itself on a success." },
      { name: "Raise the Frozen (Animate Dead, 3rd-level slot)", kind: "action", spellSlotLevel: 3, text: "When any creature of the line drops to 0 HP, a surviving CASTER (Frozen Sentinel or Frost-Weaver) may use its action to raise it as a FROZEN HUSK (its own creature: AC 14, HP 25, Rime Claw only — add it as a new monster instance; it is not a reduced copy of the raised body). One raise per caster; each body can be raised once. Raising costs that caster its whole action — a round of control traded for a body that only claws." },
      { name: "Rimestep (Bonus Action, 1st slot)", kind: "action", spellSlotLevel: 1, text: "Teleport 30 ft to a space it can see, holding the line." },
    ],
    reactions: [
      { name: "Frost Ward (Reaction, 1st slot)", kind: "reaction", spellSlotLevel: 1, text: "+5 AC until the start of its next turn when hit by an attack." },
      { name: "Glacial Freeze (Reaction, 1/day) — its Counterspell", kind: "reaction", text: "When a creature within 60 ft tries to cast a spell, the Sentinel snaps its fingers and a flash of supernatural frost instantly encases the caster's hands and arcane focus — the verbal and somatic components freeze solid before the spell can leave them. The spell fails and its slot is wasted if it is 3rd level or lower; for 4th level or higher, the Sentinel makes an INT check (DC 10 + the spell's level), and the spell fails on a success. ONLY the Frozen Sentinel has this — the Frost-Weaver does not." },
    ],
    resources: [],
    notes: [
      "Elite anchor / control caster — the homebrew 'deathlock' of the frozen north (original creature; WotC stat block used only as mechanical inspiration).",
      "HP by party band: 33 (4P) / 44 (5P baseline) / 55 (6P). The S4 line is Sentinel 44 + Rime Wight 45 + Frost-Weaver 75 = 164 base at 5P (chassis-grounded 2026-07-17), plus up to 75 raw (3x Frozen Husk, AC 14 / HP 25 each, flat at every party size) if all three raisers fire. The Rime Wight itself is a THIRD raiser (Frozen Resurrection, 1/fight) — the line has three ways to bring a body back, not two. A husk is its OWN creature (see 'Frozen Husk' below), not a percentage of the raiser's HP.",
      "ENCOUNTER MATH (chassis-grounded, 2026-07-17): party fights S4 AND S5 at L5. Balance to 5P MIDPOINT DPR (~100.5 expected, ~77.4 effective at 77% realization) — never to peak. Base 164 (Sentinel 44 + Rime Wight 45 + Weaver 75) x kit 1.80 = ~295 effective = ~3.8 rounds, landing the fight in the elite band (target 3.25-4.5) and correctly UNDER the Wendigo Wight's act-boss ~6.0. The old 225 base was a guess and read 5.23 (over the elite ceiling); grounding each body in its chassis fixed it. Rime Wight (formerly Frostbound Warden) went through three revisions on the way here — see its own notes for the full history — while the line's HP total held at 164 throughout, so the round count is unchanged. kit 1.80 is still a stat-block estimate (control stack + thrall HP) pending the DPR sheet.",
      "Holds a line and never chases. Glacial Freeze (its reskinned Counterspell) fires on the party's first real spell — freezes the components solid. Raise the Frozen patches the line the moment one falls: drop two fast.",
      "Track Glacial Freeze (1/day per Sentinel), Raise-the-Frozen slots, Warding Line active count, Frost Ward reaction uses, and any icy-tendril restrains (repeat save as an action).",
      "Drop: Gold at performance band + Potion of Resistance (Cold) x1 + Antitoxin x2.",
      "Homebrew — original names/flavor; AC/HP/DCs tuned for pseudo-L6, adjust to taste.",
    ],
    visibility: { defaultState: "hp-bar", hiddenName: "Ward Armor in the Road", revealedName: "Frozen Sentinel" },
  },
  // ── Act 2 · S4 — Rime Wight (armored front-liner; retired/redesigned from Frostbound Warden) ──
  {
    templateId: "broken-chain:act2:rime-wight:v1",
    name: "Rime Wight",
    encounterId: "act2-s4-frozen-sentinels",
    encounterLabel: "Act 2 S4 - Frozen Sentinels",
    // REDESIGNED 2026-07-17 (rev 3) from Frostbound Warden — full FDMC archetype build
    // (Bruiser STR, "Armored Front-Liner"), not a fear-caster. Same HP basis as rev 2
    // (45 = 6d8 avg 27 + CON +3 x6, ex-Haze-Wight grounding) so the line's 5P total (164)
    // and round count (~3.8, elite on target) are unchanged. Ability array from the sheet:
    // STR 16 / DEX 12 / CON 16 / INT 12 / WIS 11 / CHA 14. Kit estimate carried at the S4
    // line's shared 1.80 (control stack + any Frozen Husks raised) — the sheet flags its OWN
    // kit as "not yet assigned," pending the new archetype-driven creator.
    // Shares the Frozen Sentinels formation defenses (see Frozen Sentinel); AC 17 is its own
    // offensive-side term and is what makes it the formation's hardest body to hit.
    stats: {
      kind: "undead", ac: 17, maxHp: 45, speed: "30 ft", attacksPerTurn: 2,
      size: "Medium", classification: "elite", archetype: "bruiser",
      defenses: [
        { name: "Frozen Resurrection", ehpMultiplier: 1.30, note: "Raises one destroyed ally per fight as a 40%-HP husk; matched to the formation's shared revival value." },
        { name: "Unbroken Rank", ehpMultiplier: 1.14, note: "Half-speed riders and formation discipline cost the party positioning turns." },
        { name: "Control denial (formation)", ehpMultiplier: 1.26, note: "Shares the line's Whiteout / Bind in Ice / Glacial Freeze denial." },
      ],
    },
    abilities: [
      formatAbility("STR", 16, 3),
      formatAbility("DEX", 12, 1),
      formatAbility("CON", 16, 3),
      formatAbility("INT", 12, 1),
      formatAbility("WIS", 11, 0),
      formatAbility("CHA", 14, 2),
    ],
    traits: [
      { name: "Frozen Nature", kind: "trait", text: "Immune to cold; needs no air, food, drink, or sleep. Fire and radiant damage cut through the frost unhindered." },
      { name: "Turn Resistance", kind: "trait", text: "Advantage on saving throws against any effect that turns undead." },
      { name: "Unbroken Rank", kind: "trait", text: "When both of the Rime Wight's Longsword attacks hit the same creature on its turn, the cold sets into the wounds: that creature's speed is halved until the end of its next turn. The front rank slows around it — the soldier it was never let a line move through, and neither does this." },
      { name: "Frostbite Injection", kind: "trait", text: "The first time a target is hit by a Longsword or Rime Bolt on each of the Wight's turns, DC 13 CON or the target's maximum HP falls by the total damage taken until it finishes a long rest. A creature reduced to 0 maximum HP dies and freezes." },
    ],
    actions: [
      { name: "Longsword", kind: "attack", roll: "1d20 + 5", damage: "1d8 + 3", text: "+5 to hit, reach 5 ft., one target. Hit: 8 (1d8 + 3) slashing. One-handed behind the shield." },
      { name: "Rime Bolt", kind: "attack", roll: "1d20 + 5", damage: "2d8 + 3", text: "+5 to hit, range 30 ft., one target. Hit: 12 (2d8 + 3) cold. This version does not restrain." },
      { name: "Frozen Resurrection (1/fight)", kind: "action", text: "If a destroyed ally within 30 ft has lain dead a full turn — it fell on an earlier round and is still down at the start of the Wight's turn — the Wight raises it as a FROZEN HUSK (its own creature: AC 14, HP 25, Rime Claw only — spawn/add it as a new monster instance, not a reduced copy of the raised body). Full form only: once the Wight has itself been raised into a husk, it can no longer do this. A husk cannot raise anything; one revival per body, and the chain ends." },
      { name: "Rimestep (Bonus Action, Recharge 5-6)", kind: "action", recharge: "5-6", text: "Teleport up to 30 ft to a seen space." },
    ],
    reactions: [],
    resources: [],
    notes: [
      "ELITE ARMORED FRONT-LINER — homebrew (original creature, archetype-authored; no chassis stat block reused beyond the HP basis, see the version history). Bruiser (STR): high STR with CON matched at the same lean, mid DEX, everything else lower. A sword-and-shield front body — takes the front rank, commits fully to melee or fully to range, and shrinks max HP with every landed hit. Its one revival is a keystone effect, not a commander's kit; identity and primary stat stay STR melee.",
      "AC 17 full form (plate + shield). HP band: 34 (4P) / 45 (5P baseline) / 56 (6P). Save DC 13 (CON). Senses darkvision 60 ft., intelligence retained. When raised, it is NOT itself at reduced HP — swap the card for the separate 'Frozen Husk' template (see below).",
      "Immunities: cold, poison; exhaustion, frightened, poisoned. Fire and radiant are UNHINDERED (normal damage, not doubled) — they cut through Frozen Nature rather than being resisted by it. Unified across the whole frozen line 2026-07-25; the Rime Wight and its husk previously carried a lone 'vulnerability to both' that no other member had.",
      "It is a RAISER (Frozen Resurrection, 1/fight) alongside the two casters (Sentinel, Frost-Weaver's Raise the Frozen) — the line now has three ways to bring a body back. Unlike the casters' slot-based raise, this is a natural 1/fight power gated to its own full form: once the Wight itself is a husk, it can no longer raise. The resurrection is delayed (target must have been down a full turn) and one-time per body — the party gets a full turn to deny it (finish the corpse, drag it past 30 ft, or kill the Wight first).",
      "Tactics: takes the front rank sword-and-board, or plants at range for two Rime Bolts (does not mix). Landing both Longswords on one target halves its speed (Unbroken Rank) — spread out and it never triggers. Rimestep (recharge 5-6) re-plants it in a runner's path or back into Frozen Resurrection range of a fallen ally. Frostbite Injection works the max-HP attrition on whichever target is already shrinking.",
      "Track: max-HP reductions by target (Frostbite Injection); Unbroken Rank half-speed riders; Frozen Resurrection 1/fight + full-form gate; Rimestep recharge; husk conversions.",
      "Version history: was 'Frostbound Warden' (defensive fear-caster on the Deathlock Wight chassis, HP 37, glass-brute inversion) -> rev 2 re-chassised to the Haze Wight frontline body (HP 45) -> rev 3 (this entry) is the full archetype-authored 'Rime Wight' redesign. HP basis (45) held constant across rev 2->3, so the S4 line's 5P total (164) and round count (~3.8, elite on target) are unchanged.",
    ],
    visibility: { defaultState: "hp-bar", hiddenName: "The Standing Soldier", revealedName: "Rime Wight" },
  },
  // ── Act 2 · S4 — Frozen Husk (shared raised-body creature, NOT a % of the raiser) ──
  {
    templateId: "broken-chain:act2:frozen-husk:v1",
    name: "Frozen Husk",
    encounterId: "act2-s4-frozen-sentinels",
    encounterLabel: "Act 2 S4 - Frozen Sentinels",
    // Built 2026-07-17: a risen creature IS its own stat block, not a body computed as a
    // percentage of whichever line member it used to be. Replaces the earlier per-raiser
    // "40% of max HP" math (which also silently dropped mage armor on caster husks, an AC
    // quirk nobody would remember to apply by hand). ONE shared husk for any of the three
    // raise abilities (Frozen Sentinel's Raise the Frozen, Frost-Weaver's Raise the Frozen,
    // Rime Wight's Frozen Resurrection): when one fires, add THIS as a new monster instance
    // — do not reduce the raised body's own card. AC 14 / HP 25 sit in the middle of what
    // the old per-body husks spread across (AC 12-15, 18-30 HP), so this is not a power
    // change, just a fixed, visible number instead of a derived one.
    // DELIBERATELY 1.0. The husk's whole value is already priced into the raisers' "Raise
    // the Frozen" / "Frozen Resurrection" defenses — counting it again here would double-bill
    // the same revival. It is also a stripped body (Rime Claw only, no spells, no reactions),
    // so on its own it really is a plain HP bar.
    stats: {
      kind: "undead", ac: 14, maxHp: 25, speed: "30 ft",
      defenses: [
        { name: "None (stripped husk)", ehpMultiplier: 1.0, note: "Revival value is carried by the creature that raised it, not by the husk. Do not add an uplift here." },
      ],
    },
    abilities: [
      formatAbility("STR", 14, 2),
      formatAbility("DEX", 10, 0),
      formatAbility("CON", 12, 1),
      formatAbility("INT", 3, -4),
      formatAbility("WIS", 6, -2),
      formatAbility("CHA", 3, -4),
    ],
    traits: [
      { name: "Frozen Nature", kind: "trait", text: "Immune to cold; needs no air, food, drink, or sleep. Fire and radiant damage cut through the frost unhindered." },
      { name: "Mindless Remnant", kind: "trait", text: "Nothing of the raised creature's spellcasting, reactions, or other kit survives the raise — no intelligence, no plans, no defenses beyond the claw. It attacks the nearest target until destroyed." },
    ],
    actions: [
      { name: "Rime Claw", kind: "attack", roll: "1d20 + 5", damage: "1d8 + 3", text: "+5 to hit, reach 5 ft., one target. Hit: 8 (1d8 + 3) cold. Its only attack — no multiattack, no rider." },
    ],
    reactions: [],
    resources: [],
    notes: [
      "SPAWN, DON'T COMPUTE — whichever raise ability fires (Frozen Sentinel, Frost-Weaver, or Rime Wight), add this template as a new monster instance in the encounter. It is not '40% of the raised body's max HP'; it is a flat AC 14 / HP 25 / Rime Claw body regardless of which line member it used to be.",
      "One per raised body — the raising creature's own ability text caps how many times it can fire (each caster once per Raise the Frozen; Rime Wight once per fight via Frozen Resurrection, and only while it is in its own full form).",
      "Homebrew — original creature, archetype-authored (no chassis). Fixed at every party size; do not band it 4/5/6 — a husk is a flat outcome of the raise, not a scaled encounter body.",
    ],
    visibility: { defaultState: "hp-bar", hiddenName: "Something Standing That Shouldn't", revealedName: "Frozen Husk" },
  },
  // ── Act 2 · S4 — Frost-Weaver (CR-5 controller; opens with Whiteout) ───────────
  {
    templateId: "broken-chain:act2:frost-weaver:v1",
    name: "Frost-Weaver",
    encounterId: "act2-s4-frozen-sentinels",
    encounterLabel: "Act 2 S4 - Frozen Sentinels",
    // HP grounded in chassis (2026-07-17): the Deathlock Wight (d8 caster) chassis SCALED UP
    // to CR 5 = ~10d8; CHA-Commander archetype with high CON (+3) → 10d8 avg 45 + 3x10 = 75.
    // The commander is the line's highest body on purpose (52 Sentinel < 75 Weaver). kit 1.80:
    // Whiteout (heavily obscured = disadvantage in), restraining bolts, Frost-Weave Pull,
    // Rimestep — the line's densest denial — plus any Frozen Husks raised.
    // Shares the Frozen Sentinels formation defenses (see Frozen Sentinel). AC 14 is the
    // softest of the three — the offensive-side term now shows that instead of hiding it.
    stats: {
      kind: "undead", ac: 14, maxHp: 75, speed: "30 ft", attacksPerTurn: 2,
      size: "Medium", classification: "elite", archetype: "commander",
      spellSlots: [{ level: 1, max: 3 }, { level: 2, max: 2 }, { level: 3, max: 2 }, { level: 4, max: 1 }],
      defenses: [
        { name: "Raise the Frozen", ehpMultiplier: 1.30, note: "Second caster of the line; raises one body per fight as a 33%-HP frost-thrall." },
        { name: "Frost Ward (reaction)", ehpMultiplier: 1.14, note: "+5 AC on a hit, once per round — turns roughly one landed attack per round into a miss." },
        { name: "Whiteout / Grasping Rime / Frost-Weave Pull", ehpMultiplier: 1.26, note: "The line's densest denial: heavy obscurement, restraints and forced repositioning cost the party attacking turns." },
      ],
    },
    abilities: [
      formatAbility("STR", 10, 0),
      formatAbility("DEX", 16, 3),
      formatAbility("CON", 16, 3),
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
      { name: "Whiteout (Turn 1, its Sleet Storm)", kind: "action", spellSlotLevel: 4, save: "DEX DC 15", text: "A 40-ft-tall, 20-ft-radius cylinder of freezing rain centered on a point within 150 ft. The area is heavily obscured, open flames in it are doused, and its ground becomes slick ice (difficult terrain). When a creature enters the area for the first time on a turn or starts its turn there, it makes a DC 15 DEX save or falls prone. A creature concentrating that starts its turn in the area makes a DC 15 concentration save or loses the spell. The Weaver drops this on turn one." },
      { name: "Rime Bolt", kind: "attack", roll: "1d20 + 7", damage: "2d8 + 3 + 1d8", save: "STR DC 15", text: "Ranged spell attack, +7 to hit, range 120 ft., one target. Hit: 12 (2d8 + 3) cold plus 4 (1d8) necrotic. EVERY Rime Bolt the Weaver casts carries the icy-tendril restrain: if the target is Large or smaller, it makes a DC 15 STR save or is restrained by icy tendrils for 1 minute, repeating the save as an action to end it." },
      { name: "Frost-Weave Pull", kind: "action", recharge: "6", save: "STR DC 15", text: "The Weaver hauls on threads of frost woven through the ice. Each creature within 30 ft makes a DC 15 STR save. On a fail: dragged up to 20 ft straight toward the Weaver across the ice, takes 14 (4d6) cold, and is restrained in frost-weave until the end of its next turn. On a success: half damage, no pull, no restrain. Sets the party up for the Sentinels, the Rime Wight's blade, and the killing frost." },
      { name: "Raise the Frozen (Animate Dead, 3rd-level slot)", kind: "action", spellSlotLevel: 3, text: "The Weaver is the line's SECOND caster and carries Animate Dead alongside the Sentinel. When any creature of the line drops to 0 HP, it may use its action to raise it as a FROZEN HUSK (its own creature: AC 14, HP 25, Rime Claw only — add it as a new monster instance). One raise per caster; each body once." },
      { name: "Rimestep (Bonus Action)", kind: "action", spellSlotLevel: 1, text: "Teleport 30 ft to a space it can see, staying out of melee reach." },
    ],
    reactions: [],
    resources: [],
    notes: [
      "Controller — the homebrew 'frost-weaver' (original creature). Prefers control to damage every turn, and is the line's SECOND caster (carries Animate Dead with the Sentinel).",
      "HP band: 56 (4P) / 75 (5P baseline) / 94 (6P). One per Frozen Sentinel line — it is the brain: Whiteout turn 1, then pins with Bind in Ice / Grasping Rime and repositions with Rimestep and Frost-Weave Pull.",
      "NOTE: every attack it has is a spell, so a raised Frost-Weaver would have nothing to do — the shared Frozen Husk creature (AC 14, HP 25, Rime Claw only) is what makes its raised state legal, since the husk isn't a reduced copy of the Weaver's own kit.",
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
    // HP 136 = authored 4P standard (v12 doc: "HP 136 · AC 17. 16d8 + 64 at CON 18").
    // 2026-07-25: the ability array/Death Burst DC/Frost Slam formula previously lagged
    // this comment's own derivation (still showed the pre-rebuild CON 16/DC 14/+7 to hit).
    // Applied the rebuild the comment already describes: STR 14/DEX 10/CON 18/INT 8/WIS
    // 10/CHA 8 (Guardian order STR>DEX preserved on the chassis's 68-point pool), which
    // lifts Death Burst to DC 15 and recomputes Frost Slam to +5 to hit / 2d8+2 cold
    // (STR +2, PB +3). AC 17 is unaffected — it's authored natural armour, not from DEX.
    stats: {
      kind: "undead", ac: 17, maxHp: 136, attacksPerTurn: 2, speed: "30 ft",
      size: "Large", classification: "elite", archetype: "guardian",
      defenses: [
        { name: "Wrapped in the Pale", ehpMultiplier: 1.32, note: "-3 damage per attack while in its own dim-light aura. Against ~7 landed attacks/round that is a large flat reduction — and bright light switches it off entirely." },
        { name: "Shadow Shift", ehpMultiplier: 1.16, note: "Teleports between shadows every turn, so melee rarely gets a full round on it." },
      ],
    },
    abilities: [
      formatAbility("STR", 14, 2),
      formatAbility("DEX", 10, 0),
      formatAbility("CON", 18, 4),
      formatAbility("INT", 8, -1),
      formatAbility("WIS", 10, 0),
      formatAbility("CHA", 8, -1),
    ],
    traits: [
      // 2026-07-25 (Christopher): the doc had these two names on each other's text.
      // Soul-Touched is the OFFENSIVE trait — its attacks touch the soul, so they are
      // magical. The defensive half was "Wrought Cold", which is REPLACED here by the
      // frozen line's shared Frozen Nature: all five creatures before the boss carry it,
      // so the Drifter should not have a bespoke trait doing the same job under its own
      // name. This drops the old nonmagical-half-damage resistance, which the defenses
      // array never counted (kit = Wrapped in the Pale 1.32 × Shadow Shift 1.16), so the
      // encounter's verified 3.39-round result is unaffected.
      { name: "Soul-Touched", kind: "trait", text: "All of the Pale Drifter's attacks are magical and overcome resistance to nonmagical damage. It does not strike with a body; it strikes with the cold that is wearing one." },
      { name: "Frozen Nature", kind: "trait", text: "Immune to cold; needs no air, food, drink, or sleep. Fire and radiant damage cut through the frost unhindered." },
      { name: "Wrapped in the Pale", kind: "trait", text: "While the Pale Drifter is in dim light or darkness — which its own aura supplies by default — reduce the damage of each attack against it by 3. Bright light suppresses this entirely: a lit brazier, a lantern, or Sacred Weapon turns it off." },
      { name: "Pale Aura", kind: "trait", text: "Sheds dim light 20 ft in wrong-temperature blue-white. Darkness zones near it are highly visible — Shadow Shift targets are predictable if the party maps them." },
      { name: "Death Burst", kind: "trait", text: "At 0 HP the Drifter comes apart. Every creature within 15 ft makes a DC 15 CON save, taking 21 (6d6) cold on a fail, half on a success. Flat DC, flat radius, every party size — the band moves HP, never abilities. Spread before the killing blow." },
    ],
    actions: [
      { name: "Frost Slam", kind: "attack", roll: "1d20 + 5", damage: "2d8 + 2", text: "+5 to hit, reach 10 ft., one target. Hit: 11 (2d8 + 2) cold." },
      { name: "Shadow Shift (Bonus Action)", kind: "action", text: "Teleport up to 20 ft between dim light or darkness areas it can see — a flat 20 ft at every party size. Magical effect, so Counterspell can attempt to block it. It never attacks twice from the same position." },
    ],
    reactions: [],
    resources: [],
    notes: [
      "Elite Solo. HP: 90 (4P) / 120 (5P baseline) / 150 (6P) — HP is the ONLY thing the band moves.",
      "BANDS DO NOT CHANGE ABILITIES. Death Burst is a flat DC 15 / 6d6 / 15-ft radius at every party size (was DC 12/14/15 with a 20-ft radius at 6P — that scaling is removed; DC rose again to 15 with the CON 16→18 rebuild). Shadow Shift is a flat 20 ft (was 15 ft at 4P). Numbers checked: at a depleted 20 HP, 6d6 downs at least one of the three melee ~5.3 times in 10 and all three ~0.11 in 10 — it hurts, it does not execute. It cannot touch anyone above 36 HP.",
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
    // The 34-HP Reknit is a DEFENSE, not extra maxHp — keeping it here means the panel
    // shows why this creature outlasts its bar, and that bright light removes it.
    stats: {
      kind: "fiend", ac: 15, maxHp: 85, speed: "30 ft, fly 30 ft (hover)",
      // Official 5e creature type, not the flavour name: the chassis is the 2024 Shadow
      // Demon, so it publishes as a FIEND. "Incorporeal Cold-Woven Entity" is the campaign
      // description; publication needs a real type (Christopher, 2026-07-25).
      size: "Medium", classification: "elite", archetype: "skirmisher",
      defenses: [
        { name: "Reknit in the Cold", ehpMultiplier: 1.40, note: "Returns once at 34 of 85 HP (40%) if it dies in dim light. Radiant damage or bright light at the moment it falls prevents it entirely." },
        { name: "Unfixed Shape + Fold Into the Cold", ehpMultiplier: 1.10, note: "First hit each turn is blunted and it hides as a bonus action inside the Drifter's aura, costing the party attacks." },
      ],
    },
    abilities: [
      formatAbility("STR", 1, -5),
      formatAbility("DEX", 18, 4),
      formatAbility("CON", 14, 2),
      formatAbility("INT", 12, 1),
      formatAbility("WIS", 12, 1),
      formatAbility("CHA", 14, 2),
    ],
    traits: [
      // DELIBERATELY NOT "Frozen Nature" (Christopher, 2026-07-25): every other creature in
      // the S4/S5 line shares Frozen Nature, but the Cloak is an incorporeal cold-woven
      // entity, not frozen undead — Cold-Woven is its own unique trait and stays that way.
      // Text matches the encounter doc verbatim. Fire and radiant are UNHINDERED (normal
      // damage) — the app previously said "VULNERABLE to radiant", which was wrong. The
      // "kill it in the light" counterplay does NOT come from a damage multiplier: it comes
      // from Reknit being denied by radiant/bright light, plus Light-Struck's disadvantage.
      { name: "Cold-Woven", kind: "trait", text: "Immune to cold, necrotic, and poison; needs no air, food, drink, or sleep. Fire and radiant damage are unhindered. Resistant to nonmagical bludgeoning, piercing, and slashing. Immune to the exhaustion, grappled, paralyzed, petrified, poisoned, prone, and restrained conditions — there is no body here to hold down." },
      { name: "Unfixed Shape", kind: "trait", text: "The Cloak has no settled outline until something connects with it. Attack rolls against it have disadvantage until the first time it's hit on a turn; after that hit, attacks resolve normally until the start of its next turn. A cheap attack can strip this before the party commits its big strike — that choice is the counterplay." },
      { name: "Reknit in the Cold", kind: "trait", text: "When the Frozen Cloak drops to 0 hit points while standing in dim light or darkness, it does not die — it comes apart into a drift of frost and reknits at the START of its next turn with 34 hit points, in an unoccupied space it can see within 20 ft. Once per fight. It CANNOT reknit if the blow that dropped it was radiant, or if it is standing in bright light when it falls. Kill it in the light, or kill it twice." },
      { name: "Bodiless Drift", kind: "trait", text: "Moves through creatures and objects as if they were difficult terrain. Takes 5 (1d10) force damage if it ends its turn inside an object." },
      { name: "Light-Struck", kind: "trait", text: "In bright light, the Cloak has disadvantage on attack rolls and ability checks. A lantern is a weapon against it — and against Reknit in the Cold." },
    ],
    actions: [
      { name: "Frostshadow Claw", kind: "attack", roll: "1d20 + 6", damage: "3d8 + 4", text: "+6 to hit, reach 5 ft., one target. Hit: 17 (3d8 + 4) psychic — the cold of being unmade, not the cold of weather. It does not bleed you; it thins you." },
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
    // (~10-15%), legendary-driven downs (~10%).
    // 2026-07-17 CR-reduction pass: the fight was on-target in the FDMC round model (~6 rounds)
    // but a traditional CR calc read this at CR 12+, an untenable gap from the act's ~CR 9
    // intent. Lowered the two levers that drive that number WITHOUT touching HP (the survivability
    // counterweight that keeps the fight at ~6 rounds): AC 17 -> 15 (defensive lever) and STR
    // 20 -> 18 (-> to-hit +8 -> +7, claw/bite damage +5 -> +4). Both melee attacks are now pure
    // cold (Devouring Claw 2d10+4, Hunger Bite 3d8+4) — the 1d8/2d8 cold additives are folded in,
    // not stacked. NOTE: all-cold means any cold resistance halves the whole melee kit (a real
    // frozen-act failure point). The Hunger Bite max-HP drain is deliberately VARIABLE — HALF the
    // cold damage dealt (dice-tracked, not a flat cap), so the attrition clock tracks the roll. No
    // self-heal: it drains the target's max HP, it does not return HP to the Wight.
    // AUTHORED 4P BASELINE: 130 HP (3P 98 / 5P 163), per the encounter doc's creature table
    // and the Monster Builder workbook's worked calibration. Both agree.
    //
    // This REPLACES the old 288 (from "360 @5P ÷ 1.25"), which was tuned against the retired
    // v12 DPR line — the one that turned out to be the midpoint of the min and max party
    // rather than the balanced center, and read ~30% high at L5. With the corrected
    // denominator the fight is authored at 130, not re-derived from a 5-player figure: 4P is
    // the baseline every CR is built around, and 3P/5P come from the HP band, never the
    // other way round.
    //
    // Sustain is PHASE-AWARE, not one flat number (workbook rule: count each feature once,
    // and resolve AC in party DPR rather than folding it into EHP). The three entries below
    // reproduce the sheet's 236.2 personal EHP from 130 raw:
    //   Phase 1  65 raw, unarmored            →  65.0
    //   Phase 2  65 raw ÷ 0.625 pass fraction → 104.0
    //   Regen    3 ticks × 14 ÷ 0.625         →  67.2
    //                                          = 236.2  (÷130 = 1.817)
    // The Lesser Wendigo's 45 is a SEPARATE add pool and is deliberately not multiplied by
    // the Wight's defenses.
    stats: {
      kind: "aberration", ac: 17, maxHp: 130, attacksPerTurn: 2, speed: "40 ft", classification: "act-boss",
      damageUptime: 0.86, // aura spacing + Hungering Leap repositioning, per the workbook calibration
      size: "Large", archetype: "bruiser",
      defenses: [
        { name: "Bone Armor (resistance phase)", ehpMultiplier: 1.3, note: "Back half of the bar only. Resistance to all damage except fire/radiant, with a 0.25 bypass share, gives a 0.625 weighted pass fraction: the armored 65 raw costs 104. Across the whole bar that is (65 unarmored + 104 armored) / 130 = 1.30." },
        { name: "Bone Armor regeneration", ehpMultiplier: 1.3976, note: "2d10+3 (avg 14) at the start of each turn while armor is active, expected 3 ticks = 42 healing, which costs 42 / 0.625 = 67.2 of party output. Composes onto the 169 above: 236.2 / 169 = 1.3976, giving 236.2 total personal EHP (= 130 x 1.817)." },
        { name: "Wrong Cold + Hungering Leap tempo", ehpMultiplier: 1.0, note: "Aura spacing and Leap repositioning are an UPTIME tax on the party (0.86 in the workbook), not extra HP. Counted on the damage clock via pcEffectiveDamage, never here — folding it in would double-charge it." },
      ],
    },
    abilities: [
      formatAbility("STR", 18, 4),
      formatAbility("DEX", 16, 3),
      formatAbility("CON", 16, 3),
      formatAbility("INT", 8, -1),
      formatAbility("WIS", 14, 2),
      formatAbility("CHA", 12, 1),
    ],
    traits: [
      { name: "Bone-Nest Camouflage", kind: "trait", text: "While motionless within its bone nest, the Wendigo Wight is indistinguishable from the surrounding remains. When it begins to assemble, each creature within 30 feet must succeed on a DC 14 Wisdom (Perception) check to notice the movement in time. A creature whose passive Perception is 14 or higher notices automatically. A creature that fails is Surprised during the opening round: it cannot move or take an action on its first turn, and it cannot take a reaction until that turn ends. Bone-Nest Camouflage does not impose disadvantage on initiative." },
      { name: "Wrong Cold (Aura)", kind: "trait", text: "The area within 15 feet of the Wight is difficult terrain for hostile creatures. At the start of the Wight's turn, each conscious hostile creature in that area must make a DC 15 Constitution saving throw, taking 1d10 cold damage on a failed save or half as much on a successful one. Creatures at 0 hit points are unaffected. This is not weather." },
      { name: "Bone-Pile Return", kind: "trait", text: "The first time damage leaves the Wight at half its hit point maximum or fewer, resolve that damage completely. If the Wight is grappling a creature, it ends the grapple by throwing that creature into its space; the creature has the prone condition. Hungering Leap immediately recharges, and the Wight uses it to move to its bone pile without provoking opportunity attacks. This special use causes no landing damage, push, prone condition, or Devouring Claw. On landing, the Wight returns to half its hit point maximum, Bone Armor forms, and Bone Field Raise resolves. Hungering Leap is then expended normally." },
      { name: "Bone Armor", kind: "trait", text: "While Bone Armor is active, the Wight has resistance to all damage except fire and radiant. At the start of each of its turns while Bone Armor is active, the Wight regains 14 (2d10+3) hit points, up to its hit point maximum." },
      { name: "Bone Field Raise", kind: "trait", text: "When Bone-Pile Return resolves, one Lesser Wendigo rises from the bone field. Roll initiative for it immediately. It has its own initiative count: if that count has not passed in the current round, it acts this round; otherwise, its first turn is in the next round. The Lesser uses the party-size HP band (34 / 45 / 56 for 3P / 4P / 5P) and is a SEPARATE add pool — its HP is never multiplied by the Wight's own defences." },
    ],
    actions: [
      { name: "Devouring Claw", kind: "attack", roll: "1d20 + 7", damage: "2d10 + 4", save: "STR DC 15", text: "+7 to hit, reach 5 ft. Hit: 15 (2d10 + 4) cold. DC 15 STR save or grappled." },
      { name: "Hunger Bite (Grappled only)", kind: "attack", roll: "1d20 + 8", damage: "3d8 + 4", text: "+7 to hit, one grappled creature. Hit: 17 (3d8 + 4) cold. The grappled creature's maximum HP is reduced by HALF the cold damage dealt until a long rest — a creature reduced to 0 max HP dies and freezes." },
      { name: "Hungering Leap", kind: "action", recharge: "5-6", save: "STR DC 16", text: "Leaps up to 30 ft to an unoccupied space it can see. Each creature within 10 ft of the landing makes a DC 15 STR save or is knocked prone and pushed 10 ft (2d6 bludgeoning on a fail). It then makes one Devouring Claw against the nearest creature." },
      { name: "Mark Prey (Legendary Action, 1/round)", kind: "action", text: "The Wendigo marks one creature it can see. Until the end of that creature's next turn, the Wendigo has advantage on attacks against it and ignores any bonus to its AC from shields. This is its ONLY legendary action — one per round." },
    ],
    reactions: [],
    resources: [],
    notes: [
      "ACT 2 ACT BOSS. HP 130 (4P) — the AUTHORED baseline, with 98 (3P) / 163 (5P) from the uniform band. Source: the archetyped encounter doc's creature table and the Monster Builder workbook's worked L5 calibration, which agree. 4P is the baseline every CR is built around; 3P/5P come FROM it and are never the thing it is derived from. This replaces the old 288, which was '360 @5P ÷ 1.25' against the retired v12 DPR line — that line was the midpoint of the min and max party rather than the balanced center, and read ~30% high at L5, so anything sized against it came out heavy.",
      "WORKED CALIBRATION (4P, L5): personal sustain 236.2 EHP from 130 raw (phase 1 65, armored phase 104, regen 67.2) plus a SEPARATE 45-HP Lesser = 281.2 monster sustain. PC effective damage 68.36 (79.49 target-resolved vs AC 17, x 0.86 uptime for aura/leap/repositioning). PCER 4.11, MER 5.59, pressure 0.736, margin 1.47 — a high-output act boss (ladder target 4.5 / 0.725).",
      "LEGENDARY ACTIONS: Mark Prey ONLY, 1/round (Christopher, 2026-07-25, confirming the REVISED encounter doc). Frozen Prowl and Wrong Cold Pulse were removed — they were never in the encounter document. Claws +7, both cold, grapple DC 15 — all flat at every party size. Bone Field Raise ALWAYS fires when Bone-Pile Return resolves, at every party size - the Lesser is part of the standard fight, not a 6P-only roster add. It uses the band 34 / 45 / 56 and rolls its own initiative.",
      "CR REDUCTION (2026-07-17): a traditional CR calc had this at CR 12+ (offense-driven: the old grapple-bite loop hit ~69 raw); the act's intent is ~CR 9. HP was deliberately NOT touched — it is the survivability counterweight that keeps the fight at ~6 rounds, and dropping it would only make a still-lethal boss a swingy glass cannon. Instead the offense/defense levers came down: AC 17->15, STR 20->18 (to-hit +8->+7), and the melee loop from ~69 raw grapple / 41 ungrappled to ~48 / 30 (all cold now). That reads ~CR 6-7 offense grappled / ~CR 5 ungrappled, pulling the whole creature toward the CR 8-9 neighborhood. The FDMC round count is unchanged (~6.0, act-boss on target) because the model has no monster-AC/DPR term — the fight stays the same LENGTH while its per-round LETHALITY and rules-facing CR come down.",
      "ENCOUNTER MATH: fought at L5 (pseudo +1), FRESH off the minimum-hours long rest, so the party is at full 5P midpoint DPR (~77.4 effective). 340 raw x ~1.33 kit (Wrong Cold aura spacing, Hunger Leap repositioning ~33% of rounds, legendary-driven downs) = ~450 effective = 5.8 rounds, hitting the ~6-round act-boss target. Solving forward gives 349 vs the doc's 340 — within 3%, so the document is correct and an earlier 370 bump was reverted.",
      "Frozen Endurance was REMOVED from the encounter model. It is absent from the archetyped encounter doc and from the Monster Builder workbook's phase mechanics, both of which list only Bone-Nest Camouflage, Wrong Cold, Bone-Pile Return, Bone Armor and Bone Field Raise. Its old 1.06 ehpMultiplier came off the defences with it; the armored phase and its regeneration now carry the whole back half of the bar.",
      "Open ice field — no cover, no darkness. The whole fight is about managing the 10-ft Wrong Cold aura; Hunger Leap resets positions so the party can't just kite. Grapple + Hunger Bite is the max-HP attrition clock.",
      "HUNGER BITE DRAIN (2026-07-19): the max-HP reduction is HALF the cold damage dealt (dice-variable, not the full bite). Half was the intended attrition rate; the full-bite version shipped in 0.6.3.12 was a misread. No self-heal — this drains the target's max HP only, it does NOT return HP to the Wight (kit multiplier stays 1.37, no survivability change).",
      "Track Wrong Cold per round, grapple + max-HP reduction (half the bite) per creature, Hunger Leap recharge, Mark Prey (1/round), and the 6P Bone Field Raise flag. Level 6 gate on kill.",
      "AC/abilities reconstructed from the encounter doc's to-hit / DCs — tune to taste.",
    ],
    visibility: { defaultState: "hp-bar", hiddenName: "The Thing at the Center of the Lake", revealedName: "Wendigo Wight" },
  },
];
