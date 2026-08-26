import type { MainMonsterTemplate } from "../../core/monsters/runtime/mainMonsterRuntime";
import { AUTHORED_MONSTERS, mergeAuthored } from "./authored.generated";

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
const act2S2E2Label = "Act 2 S2 E2 - Last Directive";
const fortCervanBandLabel = "The Fort — Cervan's Band";

const BUNDLED_MONSTER_LIBRARY: MainMonsterTemplate[] = [
  // ── Act 1 · Wardenwood — Thornfang Pack ──────────────────────────────────────
  {
    templateId: "broken-chain:act1:thornfang-wolf:v1",
    name: "Thornfang Wolf",
    encounterId: "act1-thornfang-pack",
    encounterLabel: act1ThornfangPackLabel,
    // No v12 workbook lane for this fight - coverage is explicit at 1.0 rather than an
    // invented multiplier. Revisit if it ever gets a Monte Carlo run.
    stats: {
      kind: "beast", ac: 13, maxHp: 11, speed: "50 ft", classification: "normal",
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
      { name: "Savage Bite", kind: "attack", roll: "1d20 + @ATK", damage: "2d4 + @MAIN", save: "STR DC 12", text: "+4 to hit, reach 5 ft., one target. Hit: 7 (2d4 + 2) piercing. DC 12 Strength save or knocked prone." },
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
      kind: "beast", ac: 14, maxHp: 26, speed: "50 ft", classification: "strong",
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
      { name: "Rending Bite", kind: "attack", roll: "1d20 + @ATK", damage: "2d6 + @MAIN", save: "STR DC 13", text: "+5 to hit, reach 5 ft., one target. Hit: 10 (2d6 + 3) piercing. DC 13 Strength save or knocked prone." },
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
      kind: "monstrosity", ac: 13, maxHp: 59, attacksPerTurn: 2, speed: "40 ft", classification: "mid-boss",
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
      // Rending Multiattack = one Beak + one Claw (Archetype Pass v4).
      { name: "Beak", kind: "attack", roll: "1d20 + 6", damage: "1d10 + 4", text: "+6 to hit, reach 5 ft., one creature. Hit: 9 (1d10 + 4) piercing." },
      { name: "Claw", kind: "attack", roll: "1d20 + 6", damage: "2d6 + 4", text: "+6 to hit, reach 5 ft., one target. Hit: 11 (2d6 + 4) slashing." },
      // Full Action — replaces Rending Multiattack. The pin, not the damage, is the point.
      { name: "Crushing Pin", kind: "action", save: "STR DC 13", damage: "2d6", recharge: "5-6", text: "Recharge 5-6. Full Action — replaces Rending Multiattack. DC 13 STR save or grappled + pinned, taking 2d6 bludgeoning at the start of each Owlbear turn until escape (DC 13)." },
    ],
    reactions: [],
    resources: [],
    notes: ["Wardenwood forest apex predator. Challenge 3.", "Skills: Perception +5.", "Senses: Darkvision 60 ft., Passive Perception 15."],
    visibility: { defaultState: "hp-bar", hiddenName: "Shape in the Trees", revealedName: "Mosshide Owlbear" },
  },
  // ── Act 1 · Wardenwood — Mosshide Cub ────────────────────────────────────────
  // Added 2026-08-14 from Archetype Pass v4. "Two cubs share the den and both are combatants
  // at every supported party size" — they are the encounter's moral weight, not its threat.
  {
    templateId: "broken-chain:act1:mosshide-cub:v1",
    name: "Mosshide Cub",
    encounterId: "act1-mosshide-owlbear",
    encounterLabel: act1MosshideLabel,
    stats: {
      kind: "monstrosity", ac: 12, maxHp: 5, speed: "30 ft", classification: "normal",
      defenses: [
        { name: "No notable defensive traits", ehpMultiplier: 1.0, note: "A 5-HP juvenile body that flees rather than dies. Plain HP bar." },
      ],
    },
    abilities: [
      formatAbility("STR", 12, 1),
      formatAbility("DEX", 12, 1),
      formatAbility("CON", 11, 0),
      formatAbility("INT", 3, -4),
      formatAbility("WIS", 10, 0),
      formatAbility("CHA", 6, -2),
    ],
    traits: [
      { name: "Stay by the Mother", kind: "trait", text: "Both cubs enter the encounter at every party size. They do not open the fight and stay close to the Owlbear rather than choosing targets tactically." },
      { name: "Bolt", kind: "trait", text: "A cub flees the instant it drops to 45% of its own HP, crashing into the brush rather than dying. It provokes nothing and does not return." },
      { name: "Follows the Mother", kind: "trait", text: "If Mosshide is driven off rather than killed, any surviving cub follows her out — the fight simply ends." },
    ],
    actions: [
      { name: "Claw", kind: "attack", roll: "1d20 + @ATK", damage: "1d4 + @MAIN", text: "+3 to hit, reach 5 ft., one target. Hit: 3 (1d4 + 1) slashing. The only attack it knows, and it barely knows it." },
    ],
    reactions: [],
    resources: [],
    notes: [
      "Chassis: Mastiff (SRD fallback juvenile body). Archetype: chassis-leaning minion.",
      "A moral weight, not a threat. Killing a fleeing cub is allowed and is meant to cost something at the table — the whole encounter is built so the party can choose not to.",
    ],
    visibility: { defaultState: "hp-bar", hiddenName: "The Things in the Den", revealedName: "Mosshide Cub" },
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
      kind: "unspecified", ac: 15, maxHp: 16, attacksPerTurn: 1, speed: "30 ft", classification: "normal",
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
      { name: "Notched Scimitar", kind: "attack", roll: "1d20 + @ATK", damage: "1d6 + @MAIN", text: "+5 to hit, reach 5 ft., one target. Hit: 6 (1d6 + 3) slashing." },
      { name: "Dagger", kind: "attack", roll: "1d20 + @ATK", damage: "1d4 + @MAIN", text: "+5 to hit, melee or thrown 20/60 ft., one target. Hit: 5 (1d4 + 3) piercing." },
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
      kind: "beast", ac: 13, maxHp: 26, speed: "30 ft., climb 30 ft.", classification: "normal",
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
      { name: "Bite", kind: "attack", roll: "1d20 + @ATK", damage: "1d8 + @MAIN", save: "CON DC 11", text: "+5 to hit, reach 5 ft., one target. Hit: 7 (1d8 + 3) piercing. DC 11 Constitution save or take 2 (1d4) poison at the start of its next turn." },
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
      kind: "unspecified", ac: 13, maxHp: 16, attacksPerTurn: 2, speed: "30 ft.", classification: "normal",
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
      { name: "Reed Spear", kind: "attack", roll: "1d20 + @STR+@PROF", damage: "1d8 + @MAIN", text: "Melee or thrown. +3 to hit, reach 5 ft. or range 20/60 ft., one target. Hit: 6 (1d8 + 2) piercing." },
      { name: "Net", kind: "attack", roll: "1d20 + @ATK", text: "Thrown 5/15 ft., one Large or smaller creature. On a hit, the target is Restrained until it frees itself (DC 10 STR check as an action) or the net is destroyed (AC 10, 5 slashing). Only one Ambusher carries a net." },
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
      kind: "unspecified", ac: 13, maxHp: 100, attacksPerTurn: 2, speed: "50 ft", classification: "act-boss",
      defenses: [
        { name: "Phantom Step", ehpMultiplier: 1, note: "RETIRED LEGACY DEBT — was x1.18, a hand-authored figure predating the workbook. Calibrated handling: attack-disadvantage-until-damaged + triggered reaction. Kept as a trait, and priced with Phantom Lunge. Decided 1.0 because the effect IS priced, just not as effective HP; charging both would count it twice." },
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
      // Renamed to the authored block (Archetype Pass v4): Multiattack is one Gore + one Hooves.
      { name: "Gore", kind: "attack", roll: "1d20 + @ATK", damage: "2d8 + @MAIN", text: "Melee Weapon Attack: +6 to hit, reach 10 ft., one target. Hit: 13 (2d8 + 4) piercing damage. The strike lands a half-second before the creature appears to move." },
      { name: "Hooves", kind: "attack", roll: "1d20 + @ATK", damage: "2d6 + @MAIN", text: "Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 11 (2d6 + 4) bludgeoning damage. The hooves connect with a sound that is wrong." },
      /**
       * "Phantom Charge (recharges after a Multiattack turn). Full Action — replaces
       * Multiattack." That cadence is strictly ALTERNATING — Charge, Multiattack, Charge — so
       * it is up on half of all turns, which `rechargeAvailability("4-6")` states as 3/6.
       *
       * It is a DAMAGE SACRIFICE FOR CONTROL and is meant to be: one Gore instead of Gore +
       * Hooves, bought with a DC 14 push-and-prone. The Stalker opens with it (Christopher:
       * "most recharge abilities in dnd would be the opening hand of a creature, the
       * limitation of the traits are what stop it").
       *
       * Cadence checked before choosing: alternating reads 12.03 DPR against 13.22 for a
       * 1d6 recharge 5-6 — 1.19 apart, and BOTH resolve to the identical fight (3.99 rounds,
       * "1 down, 1 badly hurt", never lethal). The cadence does not move the meter, because a
       * Charge turn is a Multiattack turn the Stalker does not get.
       */
      { name: "Phantom Charge", kind: "attack", roll: "1d20 + @ATK", damage: "2d8 + @MAIN", save: "STR DC 14", recharge: "4-6", text: "Recharges after a Multiattack turn. Full Action — replaces Multiattack. Move up to its speed in a straight line and make one Gore attack at any point. If it moved 20+ ft. and hits, DC 14 STR save or the target is knocked prone and pushed 10 ft." },
      { name: "Phase Shift (Bonus Action)", kind: "action", text: "Flickers up to 15 ft., no opportunity attacks. The afterimage stays in its old space. This does NOT reset Phantom Step's disadvantage — it stacks a stale image on top of the displacement." },
    ],
    reactions: [
      { name: "Phantom Lunge", kind: "reaction", roll: "1d20 + @ATK", damage: "2d6 + @MAIN", text: "When a creature within 10 feet misses because of Phantom Step's afterimage, the Stalker can make one Hollow Stamp attack against that creature." },
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
      kind: "beast", ac: 13, maxHp: 75, speed: "50 ft", classification: "strong",
      defenses: [
        { name: "Ambush + Apex Unleashed", ehpMultiplier: 1, note: "RETIRED LEGACY DEBT — was x1.40, a hand-authored figure predating the workbook. Calibrated handling: offensive trigger / action economy. Apex is priced through Breath, not as effective HP. Decided 1.0 because the effect IS priced, just not as effective HP; charging both would count it twice." },
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
      { name: "Bite", kind: "attack", roll: "1d20 + @ATK", damage: "2d6 + @MAIN", save: "STR DC 14", text: "Target is knocked prone on a failed Strength save." },
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
      kind: "beast", ac: 12, maxHp: 26, speed: "40 ft", classification: "normal",
      defenses: [
        { name: "Pack coordination", ehpMultiplier: 1, note: "RETIRED LEGACY DEBT — was x1.40, a hand-authored figure predating the workbook. Calibrated handling: conditional attack advantage. Kept as an advantage trait, priced in the attack matrix. Decided 1.0 because the effect IS priced, just not as effective HP; charging both would count it twice." },
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
      { name: "Bite", kind: "attack", roll: "1d20 + @ATK", damage: "2d4 + @MAIN", save: "STR DC 12", text: "Target is knocked prone on a failed Strength save." },
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
      kind: "undead", ac: 12, maxHp: 42, speed: "20 ft", classification: "normal",
      defenses: [
        { name: "Hollow Fortitude", ehpMultiplier: 1, note: "RETIRED LEGACY DEBT — was x1.45, a hand-authored figure predating the workbook. Calibrated handling: drop-to-1 / revive primitive. Kept as a save-to-1 trait and priced there. Decided 1.0 because the effect IS priced, just not as effective HP; charging both would count it twice." },
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
      { name: "Slam", kind: "attack", roll: "1d20 + @STR+@PROF", damage: "1d6 + @STR bludgeoning + 1d6 cold", text: "+3 to hit. Hit: 4 (1d6 + 1) bludgeoning plus 3 (1d6) cold." },
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
      { name: "Bite", kind: "attack", roll: "1d20 + @CON+@PROF", damage: "2d6 + @MAIN", text: "One incapacitated target only." },
      { name: "Claws", kind: "attack", roll: "1d20 + @ATK", damage: "2d4 + @MAIN", save: "CON DC 10", text: "If target is not undead, it is paralyzed until the end of its next turn on a failed save." },
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
      kind: "undead", ac: 13, maxHp: 36, speed: "30 ft", classification: "normal",
      defenses: [
        { name: "Cold Aura + paralysis", ehpMultiplier: 1, note: "RETIRED LEGACY DEBT — was x1.45, a hand-authored figure predating the workbook. Calibrated handling: control / save manipulation. Priced as the Aura and the Claw, each directly. Decided 1.0 because the effect IS priced, just not as effective HP; charging both would count it twice." },
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
      { name: "Bite", kind: "attack", roll: "1d20 + @ATK", damage: "2d8 + @MAIN", text: "+5 to hit. Hit: 12 (2d8 + 3) piercing damage." },
      { name: "Claws", kind: "attack", roll: "1d20 + @ATK", damage: "2d6 + @MAIN", save: "CON DC 10", text: "Non-undead target must make the Constitution save or be paralyzed until end of its next turn." },
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
        { name: "Nonmagical resistance + STR drain", ehpMultiplier: 1, note: "RETIRED LEGACY DEBT — was x1.45, a hand-authored figure predating the workbook. Calibrated handling: typed resistance + ability drain. Each is priced directly, by its own primitive. Decided 1.0 because the effect IS priced, just not as effective HP; charging both would count it twice." },
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
        roll: "1d20 + @STR+@PROF",
        damage: "2d6 + @STR",
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
      kind: "celestial", ac: 14, maxHp: 85, attacksPerTurn: 2, speed: "0 ft., fly 5 ft", classification: "elite",
      defenses: [
        { name: "Weeping Souls + max-HP drain", ehpMultiplier: 1, note: "RETIRED LEGACY DEBT — was x1.64, a hand-authored figure predating the workbook. Calibrated handling: aura + max-HP drain + stun, each priced by its own primitive. Decided 1.0 because the effect IS priced, just not as effective HP; charging both would count it twice." },
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
      { name: "Corrupted Smite", kind: "attack", roll: "1d20 + @ATK", damage: "2d8 + @MAIN", text: "+6 to hit. Hit: 13 (2d8 + 4) necrotic damage." },
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
      kind: "undead", ac: 19, maxHp: 12, speed: "0 ft., fly 50 ft. (hover)", classification: "normal",
      defenses: [
        { name: "Patrol screen", ehpMultiplier: 1, note: "RETIRED LEGACY DEBT — was x1.64, a hand-authored figure predating the workbook. Calibrated handling: typed physical resistance + movement, each priced by its own primitive. Decided 1.0 because the effect IS priced, just not as effective HP; charging both would count it twice." },
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
    actions: [{ name: "Corrupted Shock", kind: "attack", roll: "1d20 + @WIS+@PROF", damage: "1d8", text: "+4 to hit, reach 5 ft., one creature. Hit: 4 (1d8) corrupted radiant damage." }],
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
      kind: "unspecified", ac: 14, maxHp: 65, attacksPerTurn: 2, speed: "30 ft", classification: "elite",
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
      { name: "Antler-Crowned Blade", kind: "attack", roll: "1d20 + @ATK", damage: "1d8 + @MAIN", text: "+5 to hit, reach 5 ft., one target. Hit: 7 (1d8 + 3) slashing." },
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
      kind: "unspecified", ac: 14, maxHp: 65, attacksPerTurn: 2, speed: "30 ft", classification: "strong",
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
      { name: "Breaching Scimitar", kind: "attack", roll: "1d20 + @ATK", damage: "1d6 + @MAIN", text: "+5 to hit, reach 5 ft., one target. Hit: 6 (1d6 + 3) slashing." },
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
      kind: "unspecified", ac: 14, maxHp: 33, speed: "30 ft", classification: "strong",
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
      { name: "Gloamknife", kind: "attack", roll: "1d20 + @ATK", damage: "1d6 + @MAIN + 1d4", text: "+5 to hit, reach 5 ft., one target. Hit: 6 (1d6 + 3) piercing plus 2 (1d4) cold — a cold that takes warmth out rather than putting chill in." },
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
        { name: "Two fronts + Grab", ehpMultiplier: 1, note: "RETIRED LEGACY DEBT — was x1.21, a hand-authored figure predating the workbook. Calibrated handling: encounter structure + grapple + automatic damage. Structure is the roster's job; the rest price directly. Decided 1.0 because the effect IS priced, just not as effective HP; charging both would count it twice." },
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
      // Retyped to the Act 2 4P Baseline stat block (2026-08-14). The app had drifted on all
      // four lines: Claw was +6 (doc +5), Rend was recharge 4-6 / +3d6 / DC 13 (doc 5-6 /
      // +2d6 / DC 12), and Grab carried 2d8 (doc 2d6) with NO damage field at all, so its
      // automatic damage was reaching nothing.
      /**
       * DEX, not STR, and CR 4, not 5 (Christopher, 2026-08-14): *"lessers arent suppose to be
       * off the str for the claw they are suppose to be off dex, this is a skirmisher"* and
       * *"Lessers arent CR correct they are suppose to be a 4 not a 5."*
       *
       * The two corrections explain each other. The authored +5 / 1d8+3 is STR (+3) at PB +2 —
       * internally consistent all along, so the CR 5 LABEL was the error, not the maths. Fixed
       * to the Skirmisher's own ability: DEX 18 (+4) at PB +2 gives +6 to hit and 1d8+4.
       *
       * ⚠ A +1/+1 increase on a creature the table has already fought. Small, and it is the
       * correct value rather than a retune.
       */
      { name: "Claw", kind: "attack", roll: "1d20 + 6", damage: "1d8 + 4 + 1d6", text: "+6 to hit, reach 5 ft., one target. Hit: 8 (1d8 + 4) slashing plus 3 (1d6) cold." },
      /**
       * MIGHTY LEAP is a BONUS-ACTION Claw, not a passive trait: "If the Wendigo moves at
       * least 20 feet in a straight line toward a creature, it can make one Claw attack
       * against that creature as a bonus action."
       *
       * It sat only in `traits` with no damage, so a whole extra attack was invisible to the
       * model. A bonus action is outside the action budget, so this ADDS to the turn rather
       * than competing with the Raking Multiattack — which is exactly what makes the Lesser
       * Wendigo an opener rather than a grinder.
       */
      // ⚠ GATED: all three riders below are CONDITIONAL and the model has no way to price a
      // condition, only to include or exclude it. Counting them as always-on took the Lesser
      // Wendigo from 12.1 to 15.3 DPR and moved the fight AWAY from observed play — see the
      // note on Grab. They are listed so they are visible, and excluded so they do not inflate.
      // Mighty Leap needs a 20+ ft straight-line approach, which is a first-round condition,
      // not a per-turn one.
      { name: "Mighty Leap Claw (Bonus Action)", kind: "attack", roll: "1d20 + 6", damage: "1d8 + 4 + 1d6", gated: true, text: "Bonus action after moving 20+ ft. in a straight line toward a creature: one Claw. On a hit, DC 13 STR save or prone." },
      // Rend needs BOTH Claws to hit the same creature AND the recharge to be up — roughly a
      // 10% turn, not a 33% one.
      { name: "Rend", kind: "action", recharge: "5-6", damage: "2d6", save: "STR DC 12", gated: true, text: "Recharge 5-6. If both Claws hit the same creature this turn: +2d6 slashing, DC 12 STR save or knocked prone." },
      /**
       * GRAB REPLACES ONE CLAW and then ticks: "Grappled creature takes 2d6 automatic damage
       * at the start of each of the Wendigo's turns until escape."
       *
       * ⚠ GATED, and this one is the calibration case. The damage below is the RECURRING TICK,
       * and the model has no concept of ongoing damage — only include or exclude. Priced as a
       * steady-state 2d6 per turn it assumes the grapple lands on the first attempt and is
       * never escaped, which is not a fight, it is a worst case.
       *
       * OBSERVED PLAY (Christopher, 4 players, 2 bodies at 90 HP each): the fight ran FOUR
       * ROUNDS with NOBODY DOWN. Counting Grab, Mighty Leap and Rend as always-on put the
       * model at "2 down" — further from the table than leaving them out. So they are listed
       * and excluded until the model can carry a probability rather than a boolean.
       */
      { name: "Grab (replaces one Claw)", kind: "action", damage: "2d6", save: "STR DC 13", gated: true, text: "Replaces one Claw. DC 13 STR save or grappled. A grappled creature takes 2d6 automatic damage at the start of each of the Wendigo's turns until it escapes." },
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
      /**
       * ⚠ WORKBOOK VALUE. This creature carried three hand-written multipliers — 1.30, 1.14 and
       * 1.26 — whose product was ×1.867 against the workbook's own ×1.436, a 30% over-count. None
       * of those three numbers appears in the 58 calibrated trait rules; they were invented.
       * RULE ZERO-B: nothing in the app beats the workbook.
       */
      { name: "Workbook profile tm (Raise the Frozen · Frost Ward · control denial)", ehpMultiplier: 1.436, provenance: "workbook-profile",
        note: "Calibrated whole-kit multiplier, authored here. Do not decompose into invented per-trait numbers." },
    ],
    },
    abilities: [
      /**
       * ABS corrected 2026-08-14 — INT had been shifted down and the app had drifted further
       * still (it carried CHA 16 / CON 12, matching neither the doc nor itself).
       *
       * THE STAT BLOCK PROVES ITS OWN INT: "Rimebound Spellcasting (INT, DC 14, +6)". At PB +2
       * both numbers require an INT modifier of +4 — the spell attack (+4 +2 = +6) and the save
       * DC (8 +2 +4 = 14). So INT is 18, not 16, and the two points came off INT onto CON.
       * Christopher: "it probably got shifted from the int when it shouldnt."
       *
       * Putting them back preserves the pool total (78), leaves DEX at 14 so AC 15 is untouched,
       * and removes the duplicate 16s. It also makes the line an exact TACTICIAN spine deal
       * (INT→DEX→CON→WIS→CHA→STR of {18,14,14,12,10,10}), which the old line was not — the
       * archetype and the numbers now agree instead of merely sharing a label.
       */
      formatAbility("STR", 10, 0),
      formatAbility("DEX", 14, 2),
      formatAbility("CON", 14, 2),
      formatAbility("INT", 18, 4),
      formatAbility("WIS", 12, 1),
      formatAbility("CHA", 10, 0),
    ],
    traits: [
      { name: "Warding Line", kind: "trait", text: "While at least two Frozen Sentinels are alive, each has advantage on saves against effects that would move it or knock it prone." },
      { name: "Frozen Nature", kind: "trait", text: "Immune to cold; needs no air, food, drink, or sleep. Fire and radiant damage cut through the frost unhindered." },
      { name: "Rimebound Spellcasting (INT, DC 14, +6)", kind: "trait", text: "Cantrips: Rime Touch, Killing Frost. 1st (4 slots): Frost Ward, Rimestep. 2nd (3 slots): Bind in Ice (holds a creature fast, as hold person). 3rd (2 slots): Raise the Frozen." },
    ],
    actions: [
      { name: "Rime Claw", kind: "attack", roll: "1d20 + @ATK", damage: "2d6 + 3", text: "+6 to hit, reach 5 ft., one target. Hit: 10 (2d6 + 3) cold. The wound crusts over with black frost." },
      { name: "Rime Bolt", kind: "attack", roll: "1d20 + @ATK", damage: "2d8 + 3 + 1d8", save: "STR DC 15", text: "Ranged spell attack, +6 to hit, range 120 ft., one target. Hit: 12 (2d8 + 3) cold plus 4 (1d8) necrotic. FIRST Rime Bolt each turn only: if the target is Large or smaller, it makes a DC 15 STR save or is restrained as icy tendrils lock around it for 1 minute. A restrained target can use its action to repeat the save, ending the effect on itself on a success." },
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
      /**
       * ⚠ WORKBOOK VALUE. This creature carried three hand-written multipliers — 1.30, 1.14 and
       * 1.26 — whose product was ×1.867 against the workbook's own ×1.436, a 30% over-count. None
       * of those three numbers appears in the 58 calibrated trait rules; they were invented.
       * RULE ZERO-B: nothing in the app beats the workbook.
       */
      { name: "Workbook profile tm (Frozen Resurrection · Unbroken Rank · control denial)", ehpMultiplier: 1.436, provenance: "workbook-profile",
        note: "Calibrated whole-kit multiplier, authored here. Do not decompose into invented per-trait numbers." },
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
      { name: "Longsword", kind: "attack", roll: "1d20 + @ATK", damage: "1d8 + @MAIN", text: "+5 to hit, reach 5 ft., one target. Hit: 8 (1d8 + 3) slashing. One-handed behind the shield." },
      { name: "Rime Bolt", kind: "attack", roll: "1d20 + @ATK", damage: "2d8 + @MAIN", text: "+5 to hit, range 30 ft., one target. Hit: 12 (2d8 + 3) cold. This version does not restrain." },
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
      /**
       * ⚠ WORKBOOK VALUE. This creature carried three hand-written multipliers — 1.30, 1.14 and
       * 1.26 — whose product was ×1.867 against the workbook's own ×1.436, a 30% over-count. None
       * of those three numbers appears in the 58 calibrated trait rules; they were invented.
       * RULE ZERO-B: nothing in the app beats the workbook.
       */
      { name: "Workbook profile tm (Raise the Frozen · Frost Ward · Whiteout / Grasping Rime)", ehpMultiplier: 1.436, provenance: "workbook-profile",
        note: "Calibrated whole-kit multiplier, authored here. Do not decompose into invented per-trait numbers." },
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
      { name: "Rime Bolt", kind: "attack", roll: "1d20 + 7", damage: "2d8 + @MAIN + 1d8", save: "STR DC 15", text: "Ranged spell attack, +7 to hit, range 120 ft., one target. Hit: 12 (2d8 + 3) cold plus 4 (1d8) necrotic. EVERY Rime Bolt the Weaver casts carries the icy-tendril restrain: if the target is Large or smaller, it makes a DC 15 STR save or is restrained by icy tendrils for 1 minute, repeating the save as an action to end it." },
      { name: "Frost-Weave Pull", kind: "action", recharge: "6", save: "STR DC 15", damage: "4d6", text: "The Weaver hauls on threads of frost woven through the ice. Each creature within 30 ft makes a DC 15 STR save. On a fail: dragged up to 20 ft straight toward the Weaver across the ice, takes 14 (4d6) cold, and is restrained in frost-weave until the end of its next turn. On a success: half damage, no pull, no restrain. Sets the party up for the Sentinels, the Rime Wight's blade, and the killing frost." },
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
        { name: "Wrapped in the Pale", ehpMultiplier: 1, note: "RETIRED LEGACY DEBT — was x1.32, a hand-authored figure predating the workbook. Calibrated handling: flat 3 damage reduction per attack — a damage_reduction_flat primitive, not an HP multiplier. Decided 1.0 because the effect IS priced, just not as effective HP; charging both would count it twice." },
        { name: "Shadow Shift", ehpMultiplier: 1, note: "RETIRED LEGACY DEBT — was x1.16, a hand-authored figure predating the workbook. Calibrated handling: bonus-action movement / reachability. Priced on the clock, never as effective HP. Decided 1.0 because the effect IS priced, just not as effective HP; charging both would count it twice." },
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
      { name: "Frost Slam", kind: "attack", roll: "1d20 + 5", damage: "2d8 + @STR", text: "+5 to hit, reach 10 ft., one target. Hit: 11 (2d8 + 2) cold." },
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
        { name: "Reknit in the Cold", ehpMultiplier: 1, note: "RETIRED LEGACY DEBT — was x1.40, a hand-authored figure predating the workbook. Calibrated handling: conditional +34 HP same-body return. A drop-prevention/revive primitive. Decided 1.0 because the effect IS priced, just not as effective HP; charging both would count it twice." },
        { name: "Unfixed Shape + Fold Into the Cold", ehpMultiplier: 1, note: "RETIRED LEGACY DEBT — was x1.10, a hand-authored figure predating the workbook. Calibrated handling: disadvantage-until-first-hit + Hide, each priced by its own primitive. Decided 1.0 because the effect IS priced, just not as effective HP; charging both would count it twice." },
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
      { name: "Frostshadow Claw", kind: "attack", roll: "1d20 + @ATK", damage: "3d8 + @MAIN", text: "+6 to hit, reach 5 ft., one target. Hit: 17 (3d8 + 4) psychic — the cold of being unmade, not the cold of weather. It does not bleed you; it thins you." },
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
        { name: "Bone Armor (resistance phase)", ehpMultiplier: 1.3, provenance: "derived", note: "Back half of the bar only. Resistance to all damage except fire/radiant, with a 0.25 bypass share, gives a 0.625 weighted pass fraction: the armored 65 raw costs 104. Across the whole bar that is (65 unarmored + 104 armored) / 130 = 1.30." },
        { name: "Bone Armor regeneration", ehpMultiplier: 1.3976, provenance: "derived", note: "2d10+3 (avg 14) at the start of each turn while armor is active, expected 3 ticks = 42 healing, which costs 42 / 0.625 = 67.2 of party output. Composes onto the 169 above: 236.2 / 169 = 1.3976, giving 236.2 total personal EHP (= 130 x 1.817)." },
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
      { name: "Devouring Claw", kind: "attack", roll: "1d20 + 7", damage: "2d10 + @MAIN", save: "STR DC 15", text: "+7 to hit, reach 5 ft. Hit: 15 (2d10 + 4) cold. DC 15 STR save or grappled." },
      { name: "Hunger Bite (Grappled only)", kind: "attack", roll: "1d20 + 8", damage: "3d8 + @MAIN", text: "+7 to hit, one grappled creature. Hit: 17 (3d8 + 4) cold. The grappled creature's maximum HP is reduced by HALF the cold damage dealt until a long rest — a creature reduced to 0 max HP dies and freezes." },
      { name: "Hungering Leap", kind: "action", recharge: "5-6", save: "STR DC 16", damage: "2d6", text: "Leaps up to 30 ft to an unoccupied space it can see. Each creature within 10 ft of the landing makes a DC 15 STR save or is knocked prone and pushed 10 ft (2d6 bludgeoning on a fail). It then makes one Devouring Claw against the nearest creature." },
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
  // ─── ACT 3 · The Veiled Wood ────────────────────────────────────────────────
  // Transcribed from Broken_Chain_Act3_Encounters_Clean_v3_11.docx (2026-08-11).
  //
  // Encounter ids are act3-eN, taken from the document's own FIGHT numbering. The doc gives
  // no session split, so none is invented: parseActPlacement reads session 0 and orders on the
  // encounter number, which is exactly the fight order.
  //
  // The doc writes Multiattack; the model deleted it. Every one became stats.attacksPerTurn,
  // summing all four wordings the document uses ("makes two X attacks", "one Horn and one
  // Hooves", "one Bite and two Claw", "two Claw attacks, or casts a spell" -> the spell branch
  // adds nothing, because a spell is a FULL action here).
  //
  // GATES ARE MID-BOSSES (Christopher). The doc bands them Elite / Gate / Act Boss; the app has
  // no Gate, and a gate sits above elite and below the act boss.
  //
  // LAIR ACTIONS are carried in notes, not as actions. A lair is a SUMMON at initiative 20 and
  // the summon mechanism is unbuilt — filing them as ordinary actions would read as things the
  // creature can do on its own turn, which is precisely what they are not.
  {
    templateId: "broken-chain:act3:snarlroot:v1",
    name: "Snarlroot",
    encounterId: "act3-e1-the-first-court",
    encounterLabel: "Act 3 E1 - The First Court",
    stats: {
      kind: "fey", ac: 17, maxHp: 59, speed: "30 ft., climb 20 ft.",
      defenses: [
        { name: "No notable defensive traits", ehpMultiplier: 1, note: "Root-Road and Deep-Footed are movement and anti-prone; neither reduces damage taken. Plain HP bar." },
      ],
      attacksPerTurn: 2,
      size: "Medium", classification: "elite", archetype: "bruiser",
      skills: [{ label: "Athletics", modifier: 7 }],
      proficiencyBonus: 3,
    },
    abilities: [
      { label: "STR", value: "18 (+4)", saveProficient: true },
      { label: "DEX", value: "14 (+2)" },
      { label: "CON", value: "16 (+3)", saveProficient: true },
      { label: "INT", value: "12 (+1)" },
      { label: "WIS", value: "14 (+2)" },
      { label: "CHA", value: "10 (+0)" },
    ],
    traits: [
      { name: "Root-Road", kind: "trait", text: "As a bonus action, choose two spaces of natural ground within 20 feet. Until the start of the next turn, a visible root seam joins them. Snarlroot can treat the seam as normal ground even across roots, brush, or a low obstacle, and it can move along the seam without provoking opportunity attacks." },
      { name: "Deep-Footed", kind: "trait", text: "While touching natural ground, Snarlroot has advantage on saves against being knocked prone or moved against its will." },
    ],
    actions: [
      { name: "Knotted Club", kind: "attack", roll: "1d20 + @ATK", damage: "1d12 + @MAIN", text: "Melee Weapon Attack: +7 to hit, reach 5 ft.; Hit: 10 (1d12 + 4) bludgeoning." },
      { name: "Sweeping Growth (Recharge 5–6)", kind: "action", save: "STR DC 15", recharge: "5-6", text: "Choose one creature on natural ground within 20 ft. It makes a DC 15 Strength save. On a failure, roots carry it up to 15 ft. along the ground to an unoccupied space and it cannot take reactions until the start of its next turn. On a success, it can be moved up to 5 ft. only." },
    ],
    reactions: [
    ],
    resources: [],
    notes: [
      "A squat Fey of rope-hair, bark knots, and stone-dark hands. The roots do not obstruct it; they lean toward its feet as if waiting to be told where the path is.",
    ],
    visibility: { defaultState: "hp-bar", hiddenName: "Snarlroot", revealedName: "Snarlroot" },
  },
  {
    templateId: "broken-chain:act3:hollow-warden:v1",
    name: "Hollow Warden",
    encounterId: "act3-e1-the-first-court",
    encounterLabel: "Act 3 E1 - The First Court",
    stats: {
      kind: "fey", ac: 16, maxHp: 76, speed: "40 ft.",
      defenses: [
        { name: "Bark-Ribbed", ehpMultiplier: 1.028819, provenance: "interpolated", note: "Workbook: Fixed prevention, interpolated to 3/round below the 8/round anchor (+0.028819). Reduces B/P/S by 3, first time each round." },
      ],
      attacksPerTurn: 2,
      size: "Large", classification: "elite", archetype: "guardian",
      skills: [{ label: "Perception", modifier: 5 }],
      proficiencyBonus: 3,
    },
    abilities: [
      { label: "STR", value: "16 (+3)", saveProficient: true },
      { label: "DEX", value: "14 (+2)" },
      { label: "CON", value: "18 (+4)", saveProficient: true },
      { label: "INT", value: "10 (+0)" },
      { label: "WIS", value: "14 (+2)" },
      { label: "CHA", value: "12 (+1)" },
    ],
    traits: [
      { name: "Bark-Ribbed", kind: "trait", text: "The first time each round the Warden takes bludgeoning, piercing, or slashing damage, reduce it by 3." },
    ],
    actions: [
      { name: "Name the Threshold", kind: "action", economyCost: "bonus", text: "Bonus Action: choose a 15-ft. line of natural ground within 15 ft. Until the start of the Warden’s next turn, the line is visibly braced by roots and bent branches. The Warden can use Bar the Way when a hostile creature crosses that line." },
      { name: "Long Spear", kind: "attack", roll: "1d20 + @STR+@PROF", damage: "1d10 + @STR", text: "Melee Weapon Attack: +6 to hit, reach 10 ft.; Hit: 8 (1d10 + 3) piercing." },
    ],
    reactions: [
      { name: "Bar the Way", kind: "reaction", save: "STR DC 15", text: "When a hostile creature crosses the named threshold, move up to 10 ft. without provoking. If the Warden ends within reach, the creature makes a DC 15 Strength save. On a failure, its speed becomes 0 for the rest of the turn. On a success, its remaining speed is reduced by 10 ft." },
    ],
    resources: [],
    notes: [
      "A tall, antlered sentinel whose hide carries moss and pale shelf-fungus. It does not guard another creature; it guards a threshold, and the Wood agrees that the threshold matters.",
    ],
    visibility: { defaultState: "hp-bar", hiddenName: "Hollow Warden", revealedName: "Hollow Warden" },
  },
  {
    templateId: "broken-chain:act3:larkskein:v1",
    name: "Larkskein",
    encounterId: "act3-e1-the-first-court",
    encounterLabel: "Act 3 E1 - The First Court",
    stats: {
      kind: "fey", ac: 14, maxHp: 36, speed: "30 ft., fly 30 ft.",
      defenses: [
        { name: "No notable defensive traits", ehpMultiplier: 1, note: "Leafway and Pollen Map are mobility and tracking. Plain HP bar." },
      ],
      size: "Small", classification: "elite", archetype: "mystic",
      skills: [{ label: "Stealth", modifier: 7 }, { label: "Perception", modifier: 8 }],
      proficiencyBonus: 3,
    },
    abilities: [
      { label: "STR", value: "10 (+0)" },
      { label: "DEX", value: "18 (+4)", saveProficient: true },
      { label: "CON", value: "12 (+1)" },
      { label: "INT", value: "14 (+2)" },
      { label: "WIS", value: "20 (+5)", saveProficient: true },
      { label: "CHA", value: "10 (+0)" },
    ],
    traits: [
      { name: "Leafway", kind: "trait", text: "When initiative is rolled, choose two living plants or natural growths within 30 ft. Until the end of Larkskein’s first turn, it can spend 5 ft. of movement to move from adjacent to one to adjacent to the other. This is movement through the Wood, not teleportation, and deals no damage." },
      { name: "Pollen Map", kind: "trait", text: "When Larkskein hits a creature, that creature leaves a faint visible trail until the start of Larkskein’s next turn; it cannot benefit from being hidden from Larkskein during that time." },
    ],
    actions: [
      { name: "Glass-Thorn", kind: "attack", roll: "1d20 + @ATK", damage: "2d10 + @MAIN", text: "Ranged Spell Attack: +8 to hit, range 90 ft.; Hit: 16 (2d10 + 5) piercing." },
      { name: "Folded Distance (Recharge 5–6)", kind: "action", recharge: "5-6", text: "Choose a 15-ft.-radius area within 60 ft. Until the start of Larkskein’s next turn, creatures treat every 10 ft. moved inside the area as 5 ft. when moving toward the center and 15 ft. when moving away. No creature loses an action or is forcibly moved." },
    ],
    reactions: [
    ],
    resources: [],
    notes: [
      "A three-foot moth-winged Fey whose dust looks like pollen until it hangs in the air long enough to become a map. Distance around it is measured by leaves rather than feet.",
    ],
    visibility: { defaultState: "hp-bar", hiddenName: "Larkskein", revealedName: "Larkskein" },
  },
  {
    templateId: "broken-chain:act3:quillshrike:v1",
    name: "Quillshrike",
    encounterId: "act3-e2-the-cut-below",
    encounterLabel: "Act 3 E2 - The Cut Below",
    stats: {
      kind: "fiend", ac: 17, maxHp: 39, speed: "40 ft., climb 20 ft.",
      defenses: [
        { name: "No notable defensive traits", ehpMultiplier: 1, note: "First Nails and Snap to the Nail are repositioning. Plain HP bar." },
      ],
      attacksPerTurn: 2,
      size: "Medium", classification: "elite", archetype: "skirmisher",
      skills: [{ label: "Acrobatics", modifier: 8 }, { label: "Stealth", modifier: 8 }],
      proficiencyBonus: 3,
    },
    abilities: [
      { label: "STR", value: "14 (+2)" },
      { label: "DEX", value: "20 (+5)", saveProficient: true },
      { label: "CON", value: "12 (+1)" },
      { label: "INT", value: "12 (+1)" },
      { label: "WIS", value: "10 (+0)" },
      { label: "CHA", value: "14 (+2)" },
    ],
    traits: [
      { name: "First Nails", kind: "trait", text: "When initiative is rolled, place two visible nail marks in spaces within 20 ft. Quillshrike may then move up to half speed toward one of them. No attack or save occurs." },
    ],
    actions: [
      { name: "Snap to the Nail", kind: "action", economyCost: "bonus", text: "Bonus Action: choose one nail mark within 30 ft. Move up to 15 ft. in a straight line toward it without provoking opportunity attacks, then remove that mark. This movement scars the ground it crosses until the start of the next turn." },
      { name: "Razor Quill", kind: "attack", roll: "1d20 + @ATK", damage: "1d12 + @MAIN slashing + 1d6", text: "Melee Weapon Attack: +8 to hit, reach 5 ft.; Hit: 11 (1d12 + 5) slashing plus 3 (1d6) psychic once per turn." },
      { name: "Black Fan (Recharge 5–6)", kind: "action", save: "DEX DC 16", recharge: "5-6", damage: "4d8", text: "15-ft. cone, DC 16 Dexterity save; 18 (4d8) piercing on a failure, half on a success. The ground in the cone becomes visibly scored by straight black cuts until the end of the next round." },
    ],
    reactions: [
    ],
    resources: [],
    notes: [
      "A narrow Fiend plated in black quills like forged nails. Wherever it stops, one of those nails ends up driven into bark, stone, or soil, leaving a straight line where the forest had none.",
    ],
    visibility: { defaultState: "hp-bar", hiddenName: "Quillshrike", revealedName: "Quillshrike" },
  },
  {
    templateId: "broken-chain:act3:marrowstalk:v1",
    name: "Marrowstalk",
    encounterId: "act3-e2-the-cut-below",
    encounterLabel: "Act 3 E2 - The Cut Below",
    stats: {
      kind: "fiend", ac: 15, maxHp: 68, speed: "30 ft.",
      defenses: [
        { name: "No notable defensive traits", ehpMultiplier: 1, note: "Breakroot is terrain, Marrow Grip is a speed debuff on the target. Plain HP bar." },
      ],
      attacksPerTurn: 2,
      size: "Large", classification: "elite", archetype: "bruiser",
      skills: [{ label: "Athletics", modifier: 7 }],
      proficiencyBonus: 3,
    },
    abilities: [
      { label: "STR", value: "18 (+4)", saveProficient: true },
      { label: "DEX", value: "16 (+3)" },
      { label: "CON", value: "18 (+4)", saveProficient: true },
      { label: "INT", value: "10 (+0)" },
      { label: "WIS", value: "10 (+0)" },
      { label: "CHA", value: "12 (+1)" },
    ],
    traits: [
      { name: "Breakroot", kind: "trait", text: "The first 10 ft. of natural difficult terrain Marrowstalk enters on a turn costs no extra movement. The spaces it crosses become scarred until the start of its next turn; natural difficult terrain in those spaces is suppressed, and a hostile creature entering a scarred space spends 5 extra ft. of movement." },
      { name: "Marrow Grip", kind: "trait", text: "A creature hit by Hooking Claw has its speed reduced by 10 ft. until the start of Marrowstalk’s next turn; multiple hits do not stack." },
    ],
    actions: [
      { name: "Hooking Claw", kind: "attack", roll: "1d20 + @ATK", damage: "1d10 + @MAIN", text: "Melee Weapon Attack: +7 to hit, reach 10 ft.; Hit: 9 (1d10 + 4) slashing." },
      { name: "Crushing Cast (Recharge 5–6)", kind: "action", save: "STR DC 15", recharge: "5-6", damage: "4d8", text: "One creature within 10 ft. makes a DC 15 Strength save. Failure: 18 (4d8) bludgeoning, knocked prone, and moved up to 10 ft. into a space Marrowstalk can see. Success: half damage and not moved." },
    ],
    reactions: [
    ],
    resources: [],
    notes: [
      "A heavy Fiend whose limbs look assembled around the idea of a hook. It does not pass through undergrowth; it crushes a corridor through it and leaves that corridor wrong behind it.",
    ],
    visibility: { defaultState: "hp-bar", hiddenName: "Marrowstalk", revealedName: "Marrowstalk" },
  },
  {
    templateId: "broken-chain:act3:shardbound:v1",
    name: "Shardbound",
    encounterId: "act3-e2-the-cut-below",
    encounterLabel: "Act 3 E2 - The Cut Below",
    stats: {
      kind: "fiend", ac: 17, maxHp: 46, speed: "30 ft.",
      defenses: [
        { name: "Shatter the Stake", ehpMultiplier: 1.047749, rule: "First attack each round at disadvantage", note: "Workbook: First attack each round at disadvantage (+0.047749). Spends a stake to impose disadvantage on one attack; two stakes." },
      ],
      attacksPerTurn: 2,
      size: "Medium", classification: "elite", archetype: "tactician",
      skills: [{ label: "Arcana", modifier: 8 }],
      proficiencyBonus: 3,
    },
    abilities: [
      { label: "STR", value: "10 (+0)" },
      { label: "DEX", value: "16 (+3)", saveProficient: true },
      { label: "CON", value: "14 (+2)" },
      { label: "INT", value: "20 (+5)", saveProficient: true },
      { label: "WIS", value: "12 (+1)" },
      { label: "CHA", value: "12 (+1)" },
    ],
    traits: [
      { name: "Refracted Origin", kind: "trait", text: "When making a ranged spell attack, Shardbound can have the attack originate from itself or from one of its stakes it can see. Range is measured from the chosen origin. This can bend a sight line but does not increase damage." },
    ],
    actions: [
      { name: "Survey Stake", kind: "action", economyCost: "bonus", text: "Bonus Action: create one crystal stake in an unoccupied space within 30 ft. Maximum two stakes; creating a third removes the oldest. A stake is an object (AC 13, 8 HP) and provides no cover." },
      { name: "Crystal Bolt", kind: "attack", roll: "1d20 + @ATK", damage: "2d6 + @MAIN", text: "Ranged Spell Attack: +8 to hit, range 100 ft.; Hit: 12 (2d6 + 5) force." },
      { name: "Refracted Lance (Recharge 5–6)", kind: "action", save: "DEX DC 16", recharge: "5-6", damage: "5d8", text: "Draw a 60-ft. line from Shardbound or one visible stake. Creatures in the line make a DC 16 Dexterity save; 22 (5d8) force on failure, half on success." },
    ],
    reactions: [
      { name: "Shatter the Stake", kind: "reaction", text: "When Shardbound is targeted by an attack, it can destroy one visible stake within 30 ft. to impose disadvantage on that attack. Once per round." },
    ],
    resources: [],
    notes: [
      "A faceted Fiend that plants crystal into living soil as if staking a survey line. The crystal does not grow with the Wood. It replaces what was there.",
    ],
    visibility: { defaultState: "hp-bar", hiddenName: "Shardbound", revealedName: "Shardbound" },
  },
  {
    templateId: "broken-chain:act3:veilwood-crone:v1",
    name: "Veilwood Crone",
    encounterId: "act3-e3-gate-i-crone-and-mare",
    encounterLabel: "Act 3 E3 - Gate I: The Crone and the Mare",
    stats: {
      kind: "fey", ac: 16, maxHp: 119, speed: "30 ft., swim 30 ft.",
      defenses: [
        { name: "Control spellcasting", ehpMultiplier: 1.108348, rule: "Opposing damage uptime -10%", note: "Workbook: Opposing damage uptime -10% (+0.108348). Entangle, Web and Hold Person cost the party attacking turns; this is a CLOCK tax, not resistance." },
      ],
      attacksPerTurn: 2,
      size: "Medium", classification: "mid-boss", archetype: "mystic",
      // "7th-level spellcaster; spell save DC 17, +9 to hit. Slots 4 / 3 / 3 / 1."
      // The only Spellcasting line in the act, and it sits in TRAITS rather than ACTIONS.
      // Her Multiattack reads "two Claw attacks, OR casts a spell" — which is the model's own
      // rule already: a spell is a FULL action and never adds to the attack budget.
      spellSlots: [{ level: 1, max: 4 }, { level: 2, max: 3 }, { level: 3, max: 3 }, { level: 4, max: 1 }],
      skills: [{ label: "Nature", modifier: 7 }, { label: "Perception", modifier: 9 }],
      proficiencyBonus: 3,
    },
    abilities: [
      { label: "STR", value: "18 (+4)" },
      { label: "DEX", value: "18 (+4)" },
      { label: "CON", value: "18 (+4)", saveProficient: true },
      { label: "INT", value: "18 (+4)" },
      { label: "WIS", value: "22 (+6)", saveProficient: true },
      { label: "CHA", value: "14 (+2)" },
    ],
    traits: [
      { name: "Spellcasting", kind: "trait", roll: "1d20 + 9", text: "7th-level spellcaster; spell save DC 17, +9 to hit. Slots 4 / 3 / 3 / 1. Core control list: Entangle, Web, Hold Person. A spell replaces Multiattack." },
      { name: "Night-Garden Native", kind: "trait", text: "The Crone ignores difficult terrain created by plants and vegetation, and nonmagical plants do not impede her movement." },
    ],
    actions: [
      { name: "Claw", kind: "attack", roll: "1d20 + @STR+@PROF", damage: "2d8 + @STR", text: "Melee Weapon Attack: +7 to hit, reach 5 ft.; Hit: 13 (2d8 + 4) slashing damage." },
      { name: "Venomous Eruption (1/Day)", kind: "action", save: "WIS DC 17", damage: "6d8", text: "Choose a point within 60 ft.; creatures in a 20-ft.-radius sphere make a DC 17 Wisdom save. Failure: 27 (6d8) poison damage and poisoned until the end of the creature’s next turn. Success: half damage and not poisoned." },
      { name: "Blighted Vitality (Recharge 4–6)", kind: "action", save: "CON DC 17", recharge: "4-6", text: "Choose up to two creatures within 60 ft. Each makes a DC 17 Constitution save. On a failure, healing received is halved until the end of the Crone’s second turn after the effect begins. Reapplying the effect does not extend or stack the duration." },
    ],
    reactions: [
    ],
    resources: [],
    notes: [
      "The Crone is not an invader. Black flowers open for her because this is still Feywild soil. Her cruelty is native: poisonous hospitality, thorn-shadow, and the night-side of living things.",
    ],
    visibility: { defaultState: "hp-bar", hiddenName: "Veilwood Crone", revealedName: "Veilwood Crone" },
  },
  {
    templateId: "broken-chain:act3:darkmare:v1",
    name: "Darkmare",
    encounterId: "act3-e3-gate-i-crone-and-mare",
    encounterLabel: "Act 3 E3 - Gate I: The Crone and the Mare",
    stats: {
      kind: "fiend", ac: 12, maxHp: 97, speed: "50 ft.",
      defenses: [
        { name: "Darkmane (constant obscurement)", ehpMultiplier: 1.11326, rule: "Concealment until first attack hits each round", note: "Workbook: Concealment until first attack hits each round (+0.113260). One-way magical obscurement, permanent." },
        { name: "Shadow Shroud (1/Day)", ehpMultiplier: 1.056615, provenance: "interpolated", note: "Workbook: temporary AC, interpolated to +2 AC for 1 round from the +5 AC anchor (+0.056615)." },
      ],
      attacksPerTurn: 2,
      size: "Large", classification: "mid-boss", archetype: "bruiser",
      skills: [{ label: "Perception", modifier: 5 }],
    },
    abilities: [
      { label: "STR", value: "20 (+5)", save: 8 },
      { label: "DEX", value: "14 (+2)" },
      { label: "CON", value: "14 (+2)", save: 7 },
      { label: "INT", value: "10 (+0)" },
      { label: "WIS", value: "16 (+3)" },
      { label: "CHA", value: "17 (+3)" },
    ],
    traits: [
      { name: "Darkmane (Constant)", kind: "trait", text: "Darkmare creates one-way magical obscurement around itself. Non-allied creatures are obscured through the effect; Darkmare and its allies see normally." },
      { name: "Umbral Passage", kind: "trait", text: "At the start of Darkmare’s turn, it may move or teleport up to 30 ft. and carry one willing allied creature inside Darkmane with it. Umbral Passage fails while Darkmare’s speed is below 34 ft.; that is the encounter’s pinning threshold." },
      { name: "Shadow Shroud (1/Day)", kind: "trait", text: "Action: choose Darkmare or one creature within 60 ft. The target gains +2 AC until the end of Darkmare’s next turn, and attacks against it have disadvantage until it is hit once. The disadvantage ends on that first hit; the AC duration does not." },
    ],
    actions: [
      { name: "Horn", kind: "attack", roll: "1d20 + 8", damage: "2d8 + @MAIN", text: "Melee Weapon Attack: +8 to hit, reach 5 ft.; Hit: 14 (2d8 + 5) cold damage." },
      { name: "Hooves", kind: "attack", roll: "1d20 + 8", damage: "2d6 + @MAIN", text: "Melee Weapon Attack: +8 to hit, reach 5 ft.; Hit: 12 (2d6 + 5) bludgeoning damage." },
    ],
    reactions: [
    ],
    resources: [],
    notes: [
      "A war-mount shaped from a noble silhouette and then invaded from the inside. Its hooves do not ask the Wood for a road; they burn one.",
    ],
    visibility: { defaultState: "hp-bar", hiddenName: "Darkmare", revealedName: "Darkmare" },
  },
  {
    templateId: "broken-chain:act3:hollowbloom:v1",
    name: "Hollowbloom",
    // ⚠ REPLACED OUT OF FIGHT 4 by the v3_13 Hollow Feast rewrite. The creature is kept —
    // the doc replaces the ROSTER, not the authored statblock — but it is no longer in any
    // encounter. Give it an encounterId to field it again.
    stats: {
      kind: "fey", ac: 15, maxHp: 75, speed: "30 ft., climb 20 ft.",
      defenses: [
        { name: "Offered Shelter", ehpMultiplier: 1.049548, rule: "Half cover vs ranged attacks", note: "Workbook: Half cover vs ranged attacks (+0.049548). Two 5-ft circles granting half cover." },
      ],
      size: "Small", classification: "elite", archetype: "tactician",
      skills: [{ label: "Nature", modifier: 8 }],
      proficiencyBonus: 3,
    },
    abilities: [
      { label: "STR", value: "10 (+0)" },
      { label: "DEX", value: "16 (+3)" },
      { label: "CON", value: "18 (+4)" },
      { label: "INT", value: "20 (+5)", saveProficient: true },
      { label: "WIS", value: "16 (+3)", saveProficient: true },
      { label: "CHA", value: "12 (+1)" },
    ],
    traits: [
      { name: "Offered Shelter", kind: "trait", save: "DEX DC 16", text: "When initiative is rolled, create two 5-ft. flower circles on natural ground within 40 ft. A creature in a circle has half cover. At the start of Hollowbloom’s turn, each occupied circle closes; the occupant makes a DC 16 Dexterity save or is restrained until the end of its turn. The circle then withers." },
    ],
    actions: [
      { name: "Set the Table", kind: "action", economyCost: "bonus", text: "Bonus Action: create one new Offered Shelter circle within 30 ft. Maximum two circles at a time." },
      { name: "Bark Needle", kind: "attack", roll: "1d20 + @ATK", damage: "2d8 + @MAIN", text: "Ranged Spell Attack: +8 to hit, range 90 ft.; Hit: 14 (2d8 + 5) piercing." },
      { name: "Close the Bloom (Recharge 5–6)", kind: "action", save: "DEX DC 16", recharge: "5-6", damage: "4d8", text: "Choose one visible 10-ft. area of flowers or natural growth within 60 ft. Creatures there make a DC 16 Dexterity save; 18 (4d8) slashing on failure, half on success, and a creature that fails cannot take reactions until the end of its turn." },
    ],
    reactions: [
    ],
    resources: [],
    notes: [
      "A small figure of hollow bark and flower-pale fingers. It offers shelter the way a trap offers shelter: truthfully, until the moment the offer closes.",
    ],
    visibility: { defaultState: "hp-bar", hiddenName: "Hollowbloom", revealedName: "Hollowbloom" },
  },
  {
    templateId: "broken-chain:act3:briar-regent:v1",
    name: "Briar Regent",
    encounterId: "act3-e4-the-hollow-feast",
    encounterLabel: "Act 3 E4 - The Hollow Feast",
    stats: {
      kind: "fey", ac: 16, maxHp: 55, speed: "35 ft.",
      defenses: [
        { name: "No effective-HP trait", ehpMultiplier: 1, note: "Doc v3_13: forced movement is priced by the runtime trace, never as raw HP. Unyielding Bearing is a prone save, not survivability." },
      ],
      attacksPerTurn: 2,
      size: "Large", classification: "elite", archetype: "bruiser",
      skills: [{ label: "Intimidation", modifier: 7 }],
      proficiencyBonus: 3,
    },
    abilities: [
      { label: "STR", value: "20 (+5)", saveProficient: true },
      { label: "DEX", value: "14 (+2)" },
      { label: "CON", value: "16 (+3)" },
      { label: "INT", value: "14 (+2)" },
      { label: "WIS", value: "16 (+3)", saveProficient: true },
      { label: "CHA", value: "18 (+4)" },
    ],
    traits: [
      { name: "Keep Your Distance", kind: "trait", text: "Once on each of the Regent's turns when it hits a creature with a melee attack, it can push that creature up to 5 ft. directly away from itself." },
      { name: "Unyielding Bearing", kind: "trait", text: "The Regent has advantage on saving throws against being knocked prone." },
    ],
    actions: [
      { name: "Thorn Talon", kind: "attack", roll: "1d20 + @ATK", damage: "2d8 + @MAIN", text: "Melee Weapon Attack: +8 to hit, reach 10 ft.; Hit: 14 (2d8 + 5) slashing. Multiattack: two Thorn Talon attacks." },
      { name: "Invitation Withdrawn (Recharge 5-6)", kind: "action", save: "STR DC 16", recharge: "5-6", damage: "4d8", text: "Each enemy of the Regent's choice within 15 ft. makes a DC 16 Strength save. On a failure, a creature takes 18 (4d8) slashing damage, is pushed 15 ft. directly away from the Regent, and cannot take reactions until the start of its next turn. On a success, it takes half damage and is pushed 5 ft. This action REPLACES the Regent's Multiattack." },
    ],
    reactions: [
    ],
    resources: [],
    notes: [
      "A tall, narrow Fey whose long limbs make it seem larger in motion than at rest. Wine-dark growth overlaps its body like formal dress, and backward-growing branchwork frames its head without resembling horns. It carries itself as the most dangerous creature in the meeting, because it is.",
      "The primary danger of Fight 4. Its melee loop drives characters AWAY; Invitation Withdrawn is a larger rejection, not a pull inward.",
    ],
    visibility: { defaultState: "hp-bar", hiddenName: "Briar Regent", revealedName: "Briar Regent" },
  },
  {
    templateId: "broken-chain:act3:folded-bulwark:v1",
    name: "Folded Bulwark",
    encounterId: "act3-e4-the-hollow-feast",
    encounterLabel: "Act 3 E4 - The Hollow Feast",
    stats: {
      kind: "fiend", ac: 18, maxHp: 46, speed: "25 ft.",
      defenses: [
        // ⚠ TAKE THE BLOW IS NOT AN EHP MULTIPLIER, BY INSTRUCTION. It reduces an ALLY's damage
        // by 8 and costs the Bulwark 4 unpreventable damage — it moves damage rather than
        // removing it, and the encounter page says to price it in the runtime trace.
        { name: "No effective-HP trait", ehpMultiplier: 1, note: "Doc v3_13: Interpose is priced by the runtime trace. It redirects damage to the guardian; it does not add effective HP to the roster." },
      ],
      attacksPerTurn: 2,
      size: "Large", classification: "strong", archetype: "guardian",
      skills: [{ label: "Athletics", modifier: 7 }],
      proficiencyBonus: 3,
    },
    abilities: [
      { label: "STR", value: "18 (+4)", saveProficient: true },
      { label: "DEX", value: "10 (+0)" },
      { label: "CON", value: "18 (+4)", saveProficient: true },
      { label: "INT", value: "8 (-1)" },
      { label: "WIS", value: "14 (+2)" },
      { label: "CHA", value: "12 (+1)" },
    ],
    traits: [
      { name: "Braced Form", kind: "trait", text: "The Bulwark has advantage on saving throws and ability checks made to resist being knocked prone or moved against its will." },
      { name: "Interposing Bulk", kind: "trait", text: "A hostile creature moving through the Bulwark's reach toward a creature on the opposite side of the Bulwark treats that movement as difficult terrain." },
    ],
    actions: [
      { name: "Heavy Fist", kind: "attack", roll: "1d20 + @ATK", damage: "1d10 + @MAIN", text: "Melee Weapon Attack: +7 to hit, reach 5 ft.; Hit: 9 (1d10 + 4) bludgeoning. Multiattack: two Heavy Fist attacks." },
    ],
    reactions: [
      { name: "Interpose", kind: "reaction", text: "When another creature within 10 ft. of the Bulwark is hit by an attack, the Bulwark can move up to 5 ft. toward that creature without provoking opportunity attacks. If it ends within 5 ft. of that creature, reduce the triggering damage by 8. The Bulwark then takes 4 damage that cannot be reduced or prevented. Once per round." },
    ],
    resources: [],
    notes: [
      "A broad Fiend built from overlapping folds of black-red hide and dense plated tissue. Its mass spreads sideways rather than upward. It carries no chains, stakes, saintly shape, or siege hardware; every part of it looks designed for one purpose - putting itself between danger and the creature beside it.",
      "Bodyguard. Protects any nearby ally, but its encounter priority is the Regent. Killing it does NOT turn the Host hostile.",
    ],
    visibility: { defaultState: "hp-bar", hiddenName: "Folded Bulwark", revealedName: "Folded Bulwark" },
  },
  {
    templateId: "broken-chain:act3:velvet-host:v1",
    name: "Velvet Host",
    encounterId: "act3-e4-the-hollow-feast",
    encounterLabel: "Act 3 E4 - The Hollow Feast",
    stats: {
      /**
       * ⚠ AC 17 / HP 82 IS CORRECT — DO NOT "FIX" IT TO 16 / 75.
       *
       * v3.14 prints AC 16 / HP 75 and I briefly changed this to match it. That was wrong: v3.21
       * is the current document, its card prints AC 17 / HP 82, and its Fight 4 scaling table
       * agrees — Velvet Host 62 / 82 / 103 for 3P / 4P / 5P. The older doc was superseded.
       *
       * Recorded here because the drift is a trap: anyone diffing this library against a v3.14 copy
       * will find exactly one mismatch and be tempted to correct the right value into the wrong one.
       */
      kind: "fey", ac: 17, maxHp: 82, speed: "30 ft.",
      defenses: [
      /**
       * ⚠ THE APP CREDITED NOTHING AND THE WORKBOOK CREDITS ×1.108. "No effective-HP trait" was
       * asserted here; the profile carries `persistent_aura_or_dot`, and Perfect Host's advantage
       * on saves against charm and fear is a real defence. Under-counting is as much a divergence
       * as over-counting.
       */
      { name: "Workbook profile tm (Perfect Host · persistent aura)", ehpMultiplier: 1.108348, provenance: "workbook-profile",
        note: "Calibrated whole-kit multiplier, authored here." },
    ],
      attacksPerTurn: 2,
      size: "Medium", classification: "elite", archetype: "commander",
      skills: [{ label: "Insight", modifier: 5 }, { label: "Persuasion", modifier: 8 }],
      proficiencyBonus: 3,
    },
    abilities: [
      { label: "STR", value: "12 (+1)" },
      { label: "DEX", value: "16 (+3)" },
      { label: "CON", value: "18 (+4)", saveProficient: true },
      { label: "INT", value: "16 (+3)" },
      { label: "WIS", value: "14 (+2)" },
      { label: "CHA", value: "20 (+5)", saveProficient: true },
    ],
    traits: [
      { name: "Perfect Host", kind: "trait", text: "The Host has advantage on saving throws against being charmed or frightened." },
      { name: "Even-Handed Hospitality", kind: "trait", text: "At the start of each of the Host's turns while neutral, choose exactly one party creature and one creature opposing the party within 60 ft. A creature chosen on the previous Host turn cannot be chosen again. Both gain Courtesy until the start of the Host's next turn." },
      { name: "Courtesy", kind: "trait", text: "The target's speed increases by 10 ft. The first 5 ft. it willingly moves while Courtesy lasts does not provoke opportunity attacks." },
      { name: "Hospitality Broken", kind: "trait", text: "If a party creature damages the Host, or the party reduces a Fey allied with the Host to 0 HP, the Host becomes hostile to the party immediately. The death of a Fiend does not trigger this trait." },
      { name: "Courtesy Withdrawn", kind: "trait", text: "While hostile, Even-Handed Hospitality continues to choose one creature from each side. The allied target receives Courtesy. The party target instead receives Discourtesy." },
      { name: "Discourtesy", kind: "trait", text: "The target's speed is reduced by 10 ft. The first time it willingly moves on its turn, it cannot take reactions until that movement ends." },
      { name: "An Unwelcome Guest", kind: "trait", text: "While hostile, once per turn when the Host damages a creature affected by Discourtesy, it can move that creature up to 5 ft. to an unoccupied space it can see. This movement does not provoke opportunity attacks." },
    ],
    actions: [
      // ⚠ BOTH ARE HOSTILE-ONLY. The Host contributes NO attack DPR while neutral — the
      // encounter page prices its opening trace at 0 and its hostile trace at ~19 DPR.
      { name: "Withering Word (Hostile Only)", kind: "attack", roll: "1d20 + @ATK", damage: "1d8 + @MAIN", text: "Melee or Ranged Spell Attack: +8 to hit, reach 10 ft. or range 60 ft.; Hit: 9 (1d8 + 5) psychic. Hostile only — the Host makes no attack while neutral." },
    ],
    reactions: [
    ],
    resources: [],
    notes: [
      "A composed Fey wrapped in velvet-dark leaves and ribbon-thin growth. It stands beside the meeting ground, never above it, and treats hospitality as a rule that remains true until one side proves otherwise.",
      "Begins NEUTRAL. Turns hostile if the party damages it or drops a Fey under its hospitality; a Fiend's death does not turn it.",
    ],
    visibility: { defaultState: "hp-bar", hiddenName: "Velvet Host", revealedName: "Velvet Host" },
  },
  {
    templateId: "broken-chain:act3:mothwake:v1",
    name: "Mothwake",
    // ⚠ REPLACED OUT OF FIGHT 4 by the v3_13 Hollow Feast rewrite. The creature is kept —
    // the doc replaces the ROSTER, not the authored statblock — but it is no longer in any
    // encounter. Give it an encounterId to field it again.
    stats: {
      kind: "fey", ac: 14, maxHp: 44, speed: "30 ft., fly 30 ft.",
      defenses: [
        { name: "No notable defensive traits", ehpMultiplier: 1, note: "Hush After Failure and Moonless Swarm are movement. Plain HP bar." },
      ],
      attacksPerTurn: 2,
      size: "Medium", classification: "elite", archetype: "mystic",
      skills: [{ label: "Stealth", modifier: 7 }, { label: "Perception", modifier: 8 }],
      proficiencyBonus: 3,
    },
    abilities: [
      { label: "STR", value: "10 (+0)" },
      { label: "DEX", value: "18 (+4)", saveProficient: true },
      { label: "CON", value: "12 (+1)" },
      { label: "INT", value: "14 (+2)" },
      { label: "WIS", value: "20 (+5)", saveProficient: true },
      { label: "CHA", value: "16 (+3)" },
    ],
    traits: [
      { name: "Hush After Failure", kind: "trait", text: "Once per round when a creature within 30 ft. fails a saving throw, Mothwake may move up to 10 ft. without provoking opportunity attacks." },
      { name: "Moonless Swarm", kind: "trait", text: "Mothwake can move through the spaces of other creatures, but cannot end there." },
    ],
    actions: [
      { name: "Hushwing", kind: "attack", roll: "1d20 + @ATK", damage: "2d6 + @MAIN", text: "Ranged Spell Attack: +8 to hit, range 90 ft.; Hit: 12 (2d6 + 5) psychic." },
      { name: "Black Petal Fall (Recharge 5–6)", kind: "action", save: "WIS DC 16", recharge: "5-6", damage: "4d8", text: "20-ft.-radius sphere within 90 ft.; creatures inside make a DC 16 Wisdom save. Failure: 18 (4d8) psychic and the creature cannot gain advantage on attack rolls until the end of its next turn. Success: half damage." },
    ],
    reactions: [
    ],
    resources: [],
    notes: [
      "A mantle of black moths repeatedly almost forms a person. The wings settle only when it is listening to a heartbeat.",
    ],
    visibility: { defaultState: "hp-bar", hiddenName: "Mothwake", revealedName: "Mothwake" },
  },
  {
    templateId: "broken-chain:act3:moss-crowned-charger:v1",
    name: "Moss-Crowned Charger",
    encounterId: "act3-e5-the-scar-line",
    encounterLabel: "Act 3 E5 - The Scar Line",
    stats: {
      kind: "fey", ac: 14, maxHp: 105, speed: "40 ft.",
      defenses: [
        { name: "Rooted Turn", ehpMultiplier: 1.056615, provenance: "interpolated", note: "Workbook: temporary AC, interpolated to +2 AC for 1 round (+0.056615)." },
      ],
      attacksPerTurn: 2,
      size: "Large", classification: "elite", archetype: "guardian",
      skills: [{ label: "Athletics", modifier: 7 }, { label: "Perception", modifier: 6 }],
      proficiencyBonus: 3,
    },
    abilities: [
      { label: "STR", value: "18 (+4)", saveProficient: true },
      { label: "DEX", value: "10 (+0)" },
      { label: "CON", value: "20 (+5)", saveProficient: true },
      { label: "INT", value: "10 (+0)" },
      { label: "WIS", value: "12 (+1)" },
      { label: "CHA", value: "10 (+0)" },
    ],
    traits: [
      { name: "Boughway", kind: "trait", text: "When the Charger moves at least 15 ft. through natural vegetation, the path it crossed becomes easy ground until the start of its next turn: difficult terrain from plants is suppressed there for every creature." },
    ],
    actions: [
      { name: "Rooted Turn", kind: "action", economyCost: "bonus", text: "Bonus Action: speed becomes 0 until the start of the next turn; AC increases by 2 and it has advantage on saves against forced movement. It cannot use this after moving more than 10 ft. this turn." },
      { name: "Tusk", kind: "attack", roll: "1d20 + @STR+@PROF", damage: "2d6 + @STR", text: "Melee Weapon Attack: +7 to hit, reach 5 ft.; Hit: 11 (2d6 + 4) piercing." },
      { name: "Canopy Rush (Recharge 5–6)", kind: "action", save: "STR DC 16", recharge: "5-6", damage: "4d8", text: "Move up to 30 ft. in a line through natural vegetation. One creature in the path makes a DC 16 Strength save. Failure: 18 (4d8) bludgeoning and pushed up to 15 ft.; success: half damage and no push." },
    ],
    reactions: [
    ],
    resources: [],
    notes: [
      "A broad boar-like Fey with fern fronds along its spine and an antlered crown grown from mossy bone. The Wood parts for its charge and closes behind it.",
    ],
    visibility: { defaultState: "hp-bar", hiddenName: "Moss-Crowned Charger", revealedName: "Moss-Crowned Charger" },
  },
  {
    templateId: "broken-chain:act3:rift-slick:v1",
    name: "Rift-Slick",
    encounterId: "act3-e5-the-scar-line",
    encounterLabel: "Act 3 E5 - The Scar Line",
    stats: {
      kind: "fiend", ac: 12, maxHp: 59, speed: "40 ft., climb 30 ft.",
      defenses: [
        { name: "No notable defensive traits", ehpMultiplier: 1, note: "Through the Wound and Scar Slip are movement. Plain HP bar." },
      ],
      attacksPerTurn: 2,
      size: "Medium", classification: "elite", archetype: "skirmisher",
      skills: [{ label: "Acrobatics", modifier: 8 }, { label: "Stealth", modifier: 8 }],
      proficiencyBonus: 3,
    },
    abilities: [
      { label: "STR", value: "14 (+2)" },
      { label: "DEX", value: "20 (+5)", saveProficient: true },
      { label: "CON", value: "14 (+2)" },
      { label: "INT", value: "16 (+3)", saveProficient: true },
      { label: "WIS", value: "12 (+1)" },
      { label: "CHA", value: "10 (+0)" },
    ],
    traits: [
      { name: "Through the Wound", kind: "trait", text: "Rift-Slick can move through a space as narrow as 3 inches without squeezing. When it passes through natural cover, roots, or a tree-space, it leaves a 5-ft. scar at the exit until the start of its next turn." },
    ],
    actions: [
      { name: "Scar Slip", kind: "action", economyCost: "bonus", text: "Bonus Action: move up to 15 ft. to a scarred space it can see without provoking opportunity attacks. This is physical movement through a wound in the terrain, not teleportation." },
      { name: "Raking Claw", kind: "attack", roll: "1d20 + @ATK", damage: "1d12 + @MAIN", text: "Melee Weapon Attack: +8 to hit, reach 5 ft.; Hit: 11 (1d12 + 5) slashing." },
      { name: "Warping Cut (Recharge 5–6)", kind: "action", save: "DEX DC 16", recharge: "5-6", damage: "4d8", text: "30-ft. line, DC 16 Dexterity save; 18 (4d8) force on failure, half on success. The line becomes scarred ground until the end of the next round." },
    ],
    reactions: [
    ],
    resources: [],
    notes: [
      "A gray Fiend whose body can become too thin for its skeleton and then remember bones afterward. Wherever it squeezes through the Wood, sap hisses from the wound.",
    ],
    visibility: { defaultState: "hp-bar", hiddenName: "Rift-Slick", revealedName: "Rift-Slick" },
  },
  {
    templateId: "broken-chain:act3:nail-saint:v1",
    name: "Nail Saint",
    encounterId: "act3-e5-the-scar-line",
    encounterLabel: "Act 3 E5 - The Scar Line",
    stats: {
      kind: "fiend", ac: 16, maxHp: 56, speed: "30 ft.",
      defenses: [
        { name: "Claimed Line", ehpMultiplier: 1.108348, rule: "Opposing damage uptime -10%", note: "Workbook: Opposing damage uptime -10% (+0.108348). Costs the first crosser each round 10 extra ft or stops it." },
      ],
      size: "Medium", classification: "elite", archetype: "tactician",
      skills: [{ label: "Arcana", modifier: 8 }],
      proficiencyBonus: 3,
    },
    abilities: [
      { label: "STR", value: "10 (+0)" },
      { label: "DEX", value: "16 (+3)", saveProficient: true },
      { label: "CON", value: "14 (+2)" },
      { label: "INT", value: "20 (+5)", saveProficient: true },
      { label: "WIS", value: "14 (+2)" },
      { label: "CHA", value: "14 (+2)" },
    ],
    traits: [
      { name: "Claimed Line", kind: "trait", text: "The first hostile creature each round that crosses a claimed line must spend 10 extra ft. of movement or stop immediately before crossing, its choice. Forced movement ignores this rule." },
    ],
    actions: [
      { name: "Drive Nail", kind: "action", economyCost: "bonus", text: "Bonus Action: place one nail in an adjacent solid surface. Maximum two. A nail is an object (AC 13, 8 HP). A straight line up to 20 ft. long between Nail Saint and a nail is a claimed line until the start of the next turn." },
      { name: "Boundary Spike", kind: "attack", roll: "1d20 + @ATK", damage: "2d8 + @MAIN", text: "Ranged Spell Attack: +8 to hit, range 90 ft.; Hit: 14 (2d8 + 5) force." },
      { name: "Hammer the Border (Recharge 5–6)", kind: "action", save: "STR DC 16", recharge: "5-6", damage: "4d8", text: "Choose one visible nail within 60 ft. Creatures within 10 ft. of it make a DC 16 Strength save; 18 (4d8) force on failure and pushed 10 ft. away from the nail, half damage and no push on success." },
    ],
    reactions: [
    ],
    resources: [],
    notes: [
      "A thin Fiend wrapped in strips of material that look stitched to nothing. It carries iron nails too long for carpentry and drives them into living wood like survey posts.",
    ],
    visibility: { defaultState: "hp-bar", hiddenName: "Nail Saint", revealedName: "Nail Saint" },
  },
  {
    templateId: "broken-chain:act3:blackbough-reeve:v1",
    name: "Blackbough Reeve",
    encounterId: "act3-e7-the-last-court",
    encounterLabel: "Act 3 E7 - The Last Court",
    stats: {
      kind: "fey", ac: 16, maxHp: 86, speed: "35 ft.",
      defenses: [
        { name: "Seasoned by Severity", ehpMultiplier: 1, note: "DECIDED 1.0, not unassessed. Advantage on STR/DEX saves and immunity to charmed and frightened. The workbook publishes Condition immunity with a NULL contribution, and a monster's own save quality never enters effective HP because the party's damage is a curve rather than a save. Nothing here reduces damage taken." },
      ],
      attacksPerTurn: 2,
      size: "Medium", classification: "elite", archetype: "bruiser",
      skills: [{ label: "Athletics", modifier: 9 }],
      proficiencyBonus: 4,
    },
    abilities: [
      { label: "STR", value: "20 (+5)", saveProficient: true },
      { label: "DEX", value: "18 (+4)", saveProficient: true },
      { label: "CON", value: "10 (+0)" },
      { label: "INT", value: "16 (+3)" },
      { label: "WIS", value: "18 (+4)", saveProficient: true },
      { label: "CHA", value: "19 (+4)" },
    ],
    traits: [
      { name: "Seasoned by Severity", kind: "trait", text: "The Reeve has advantage on Strength and Dexterity saving throws and is immune to the Charmed and Frightened conditions." },
    ],
    actions: [
      { name: "Shearing Cut", kind: "attack", roll: "1d20 + @ATK", damage: "2d8 + @MAIN", text: "Melee Weapon Attack: +9 to hit, reach 5 ft., one target. Hit: 14 (2d8 + 5) slashing damage. Multiattack: the Reeve makes two attacks, choosing Shearing Cut or Spoiling Cut for each." },
      { name: "Spoiling Cut", kind: "attack", roll: "1d20 + @ATK", damage: "1d8 + @MAIN", text: "Melee Weapon Attack: +9 to hit, reach 5 ft., one target. Hit: 10 (1d8 + 5) slashing damage. The target must succeed on a DC 17 Constitution saving throw or, until the start of the Reeve’s next turn, damage it deals to creatures other than the Reeve is reduced by 5 for each damage instance. This effect ends early immediately after the affected creature makes an attack against the Reeve, whether that attack hits or misses." },
    ],
    reactions: [
    ],
    resources: [],
    notes: [
      "A broad-shouldered Fey wrapped in split black bark and hooked thorn. Pale cuts run through the growth like old pruning scars. It carries itself like a keeper who has spent years deciding what the Wood is allowed to keep.",
      "DM DESIGN READ. The Reeve does not lock movement or force targets into place. It either prunes through raw damage or makes ignoring it expensive. A martial can clear Spoiling Cut by committing an attack to the Reeve, then spend any remaining attacks elsewhere. No recharge ability and no special reaction are part of this block.",
      "UNPRICED IN EHP. Spoiling Cut takes 5 off every damage instance the target aims at anyone except the Reeve. That is ally-side damage prevention, nearest to the workbook's Fixed prevention - 8/round (+0.141871), but it is conditional, single-target and cleared by attacking the Reeve. Left unpriced pending a calibration decision: v3.23 states the fight's 253 raw HP is the figure BEFORE trait, control, reaction, targeting and Winter's Toll conversion.",
    ],
    visibility: { defaultState: "hp-bar", hiddenName: "Blackbough Reeve", revealedName: "Blackbough Reeve" },
  },
  {
    templateId: "broken-chain:act3:gloam-harrow:v1",
    name: "Gloam Harrow",
    encounterId: "act3-e7-the-last-court",
    encounterLabel: "Act 3 E7 - The Last Court",
    stats: {
      kind: "fey", ac: 16, maxHp: 86, speed: "30 ft.",
      defenses: [
        { name: "Fey Mind", ehpMultiplier: 1, note: "DECIDED 1.0, not unassessed. Advantage on saves against being charmed, and magic cannot put her to sleep. Condition defence, which the workbook publishes with a NULL contribution. No damage is reduced." },
      ],
      attacksPerTurn: 1,
      size: "Medium", classification: "elite", archetype: "commander",
      skills: [{ label: "Insight", modifier: 7 }, { label: "Persuasion", modifier: 8 }],
      proficiencyBonus: 3,
    },
    abilities: [
      { label: "STR", value: "10 (+0)" },
      { label: "DEX", value: "16 (+3)" },
      { label: "CON", value: "10 (+0)" },
      { label: "INT", value: "12 (+1)" },
      { label: "WIS", value: "18 (+4)", saveProficient: true },
      { label: "CHA", value: "20 (+5)", saveProficient: true },
    ],
    traits: [
      { name: "Fey Mind", kind: "trait", text: "Gloam Harrow has advantage on saving throws against being Charmed, and magic cannot put her to sleep." },
    ],
    actions: [
      { name: "Winter Needle", kind: "attack", roll: "1d20 + @ATK", damage: "1d10 + @MAIN", text: "Ranged Spell Attack: +8 to hit, range 90 ft., one target. Hit: 10 (1d10 + 5) cold and psychic damage." },
      { name: "Winter’s Toll", kind: "action", text: "Choose a point within 60 ft. Until the start of Harrow’s next turn, a 15-ft.-radius area is steeped in biting Fey glamour. Harrow’s allies in the area gain +3 to attack rolls and saving throws. Hostile creatures in the area take -3 to attack rolls and saving throws. The area ends early if Harrow is incapacitated." },
    ],
    reactions: [
    ],
    resources: [],
    notes: [
      "A courtly Fey in a mantle of dead-green leaves stitched through with pale winter light. She speaks of hardship as cultivation: the Wood has sheltered too much, spared too much, and should learn again what deserves to survive.",
      "DM DESIGN READ. Harrow is the enchanter and commander, not a secondary damage dealer. Winter’s Toll helps allies and hinders enemies in the same space, so placement is the action. Using it costs Harrow her Action and therefore her own damage for the round. Its flat 3 is intentional.",
      "UNPRICED IN EHP, AND THE WRONG SHAPE FOR A PER-CREATURE MULTIPLIER. Winter’s Toll is roster-wide: -3 to party attack rolls reads as roughly +3 AC on every ally standing in it, against the workbook's Shield-like +5 AC - 1 round (+0.141537). It is also a trade, because casting it costs Harrow her whole action, which is why her own damage column is one attack and not two.",
    ],
    visibility: { defaultState: "hp-bar", hiddenName: "Gloam Harrow", revealedName: "Gloam Harrow" },
  },
  {
    templateId: "broken-chain:act3:brandwing:v1",
    name: "Brandwing",
    encounterId: "act3-e7-the-last-court",
    encounterLabel: "Act 3 E7 - The Last Court",
    stats: {
      kind: "fiend", ac: 17, maxHp: 81, speed: "30 ft., fly 40 ft.",
      defenses: [
        { name: "Magic Resistance", ehpMultiplier: 1.115824, rule: "Magic Resistance", note: "Workbook: Magic Resistance (+0.115824), exact. Advantage on saving throws against spells and other magical effects." },
      ],
      attacksPerTurn: 2,
      size: "Medium", classification: "elite", archetype: "tactician",
      skills: [{ label: "Perception", modifier: 8 }, { label: "Investigation", modifier: 9 }],
      proficiencyBonus: 4,
    },
    abilities: [
      { label: "STR", value: "10 (+0)" },
      { label: "DEX", value: "20 (+5)", saveProficient: true },
      { label: "CON", value: "10 (+0)" },
      { label: "INT", value: "20 (+5)", saveProficient: true },
      { label: "WIS", value: "18 (+4)", saveProficient: true },
      { label: "CHA", value: "14 (+2)" },
    ],
    traits: [
      { name: "Magic Resistance", kind: "trait", text: "Brandwing has advantage on saving throws against spells and other magical effects." },
    ],
    actions: [
      { name: "Red Script", kind: "action", economyCost: "bonus", damage: "1d8", text: "Bonus Action: choose one creature within 90 ft. Clear Angle: ignore half and three-quarters cover against it, and the first Ember Lance this turn gains +2 to hit. Closing Stroke: the first Ember Lance that hits it this turn deals an extra 4 (1d8) fire damage. Only one Red Script can be active at a time." },
      { name: "Ember Lance", kind: "attack", roll: "1d20 + @ATK", damage: "2d10 + @MAIN", text: "Ranged Spell Attack: +9 to hit, range 120 ft., one target. Hit: 16 (2d10 + 5) fire and psychic damage. Multiattack: Brandwing makes two Ember Lance attacks." },
    ],
    reactions: [
      { name: "Cinder Skip", kind: "reaction", text: "When Brandwing is hit by an attack or targeted by a spell, the triggering attack or spell resolves completely. Brandwing then teleports up to 15 ft. to an unoccupied space it can see." },
    ],
    resources: [],
    notes: [
      "A narrow Fiend with wing-like sheets of ember script. It writes on bark by touching it and leaves the letters burning after its hand is gone. Brandwing is the only Fiend in the Last Court roster.",
      "CINDER SKIP IS NOT MITIGATION, and prices at nothing on purpose. The block says the triggering attack or spell resolves COMPLETELY before the teleport, so it changes where Brandwing is standing next, not what it takes.",
      "RED SCRIPT CARRIES ITS 1d8 SO THE CHECKER CAN READ IT. Without a damage field the checker reported NEEDS DM INPUT - dice appear in the printed text and score zero - which is a real read failure, not a quibble. Once per turn is the rider’s true frequency, so a bonus-action line is the right shape. The trace applies it flat while the block conditions it on the first Ember Lance HITTING, so this reads about 1.4 a round generous. The +2 to hit is not counted at all.",
    ],
    visibility: { defaultState: "hp-bar", hiddenName: "Brandwing", revealedName: "Brandwing" },
  },
  {
    templateId: "broken-chain:act3:demon-knight-of-punishment:v1",
    name: "Demon Knight of Punishment",
    encounterId: "act3-e8-the-occupied-acre",
    encounterLabel: "Act 3 E8 - The Occupied Acre",
    stats: {
      kind: "fiend", ac: 17, maxHp: 153, speed: "30 ft.",
      defenses: [
        { name: "Oppressive Presence + Commanding Presence", ehpMultiplier: 1, note: "UNPRICED, and left at 1.0 deliberately. Forcing one instance of every multi-target Action onto the Knight is the workbook's Damage transfer / redirection, which it publishes with a NULL contribution - the one category it declines to price. It is also not this creature's own sustain: it moves damage from its allies ONTO the Knight, so a per-creature multiplier above 1.0 would be backwards. Needs a roster-level decision." },
      ],
      attacksPerTurn: 1,
      size: "Medium", classification: "elite", archetype: "guardian",
      skills: [{ label: "Intimidation", modifier: 7 }, { label: "Perception", modifier: 6 }],
      proficiencyBonus: 4,
    },
    abilities: [
      { label: "STR", value: "18 (+4)" },
      { label: "DEX", value: "14 (+2)" },
      { label: "CON", value: "19 (+4)", saveProficient: true },
      { label: "INT", value: "14 (+2)" },
      { label: "WIS", value: "14 (+2)", saveProficient: true },
      { label: "CHA", value: "17 (+3)" },
    ],
    traits: [
      { name: "Barbed Plate", kind: "trait", text: "When a creature within 5 ft. hits the Knight with a melee attack that deals bludgeoning, piercing, or slashing damage, that attacker takes piercing damage equal to the Knight’s Constitution modifier (4). The triggering attack resolves normally." },
      { name: "Oppressive Presence", kind: "trait", text: "When a hostile creature uses an Action that creates two or more creature-targeting instances and the Knight is a legal target, at least one of those instances must target the Knight. This does not apply to single-target Actions or effects that target only a point, area, object, or space, and it never overrides the effect’s normal targeting restrictions." },
    ],
    actions: [
      { name: "Iron Grasp", kind: "attack", roll: "1d20 + @ATK", damage: "1d10 + @MAIN", text: "Melee Weapon Attack: +8 to hit, reach 5 ft., one Large or smaller creature. Hit: 9 (1d10 + 4) bludgeoning damage, and the target is grappled (escape DC 16). Until the grapple ends, the target is restrained. The Knight can restrain only one creature this way at a time." },
    ],
    reactions: [
      { name: "Commanding Presence", kind: "reaction", text: "When a hostile creature the Knight can see within 30 ft. uses an Action that creates two or more creature-targeting instances, the Knight can react before targets are designated. If it is a legal target, one additional target instance must target the Knight. This cannot force more instances onto the Knight than the effect legally permits; increasing the effect’s target count can therefore create additional free target instances." },
    ],
    resources: [],
    notes: [
      "A broad knight-shape locked inside shattered infernal plate. The transformation has split the armor open at the joints and driven barbs through the seams, leaving it easier to strike than the intact knight it once resembled. It does not evade attention. It makes attention expensive.",
      "DM DESIGN READ. The Knight is the wall. Its shattered plate is deliberately hittable, but its raw body is large. Barbed Plate punishes repeated close physical hits. Oppressive Presence taxes multi-target creature effects once, and Commanding Presence can force a second legal instance into the Knight; single-target effects remain valid answers.",
      "BARBED PLATE IS DAMAGE, NOT DEFENCE, and the trace cannot see it. 4 piercing per melee hit taken is real pressure on the party - roughly 12 a round against three melee hits - but it is retaliation triggered by the PARTY's action, and the trace prices only what the creature spends its own action economy on. Not counted in the DPR below.",
    ],
    visibility: { defaultState: "hp-bar", hiddenName: "Demon Knight of Punishment", revealedName: "Demon Knight of Punishment" },
  },
  {
    templateId: "broken-chain:act3:breaker:v1",
    name: "Breaker",
    encounterId: "act3-e8-the-occupied-acre",
    encounterLabel: "Act 3 E8 - The Occupied Acre",
    stats: {
      kind: "fiend", ac: 15, maxHp: 130, speed: "40 ft.",
      defenses: [
        { name: "No notable defensive traits", ehpMultiplier: 1, note: "Two-Handed Hold, Cast Aside and the grapples are CONTROL - they move bodies and deny position, they do not reduce damage taken. v3.23: AC 15 is intentional, the party should be able to hit it while still working through 130 HP. A plain HP bar is the correct read." },
      ],
      attacksPerTurn: 4,
      size: "Large", classification: "elite", archetype: "bruiser",
      skills: [{ label: "Athletics", modifier: 9 }, { label: "Perception", modifier: 7 }],
      proficiencyBonus: 4,
    },
    abilities: [
      { label: "STR", value: "21 (+5)", saveProficient: true },
      { label: "DEX", value: "14 (+2)" },
      { label: "CON", value: "18 (+4)", saveProficient: true },
      { label: "INT", value: "12 (+1)" },
      { label: "WIS", value: "16 (+3)", saveProficient: true },
      { label: "CHA", value: "17 (+3)" },
    ],
    traits: [
      { name: "Two-Handed Hold", kind: "trait", text: "The Breaker can grapple up to two creatures at the same time, one with each grasping limb. A grasping limb holding a creature cannot be used to attack another target until that grapple ends." },
    ],
    actions: [
      { name: "Grasping Limb", kind: "attack", roll: "1d20 + @ATK", damage: "1d6 + @MAIN", routineSlots: 2, text: "Melee Weapon Attack: +9 to hit, reach 10 ft., one Medium or smaller creature. Hit: 8 (1d6 + 5) bludgeoning damage, and the target is grappled (escape DC 17). Multiattack: the Breaker makes four attacks, two Grasping Limb and two Heavy Blow. A grasping limb already holding a creature cannot make its assigned Grasping Limb attack against another target." },
      { name: "Heavy Blow", kind: "attack", roll: "1d20 + @ATK", damage: "1d8 + @MAIN", routineSlots: 2, text: "Melee Weapon Attack: +9 to hit, reach 5 ft., one target. Hit: 9 (1d8 + 5) bludgeoning damage." },
      { name: "Cast Aside", kind: "action", economyCost: "free", text: "1/Turn. After the Breaker hits with Grasping Limb, it may move one creature grappled by it to another unoccupied space within 10 ft. of the Breaker. This forced movement does not provoke opportunity attacks. If the creature is placed beyond the reach of the limb holding it, that grapple ends." },
    ],
    reactions: [
    ],
    resources: [],
    notes: [
      "A massive four-limbed Fiend built to ruin formation rather than hold ground. Two long grasping limbs reach ahead of its shoulders while the shorter arms hammer whatever remains close. It is broad, obvious, and easy to hit; the problem is how much body must be cut through before it stops rearranging the fight.",
      "DM DESIGN READ. The Breaker enters the party's shape rather than defending a point. Its four-attack routine lets it seize up to two bodies while Heavy Blows keep the turn relevant; Cast Aside is the formation-breaking payoff.",
      "THE ROUTINE IS A FIXED 2+2 SPLIT, not four of the best attack. Grasping Limb averages 8.5 and Heavy Blow 9.5, so the authored routine is 2x8.5 + 2x9.5 = 36 before to-hit, while a free choice of four would read 38. Check the DPR column against 36, not 38.",
    ],
    visibility: { defaultState: "hp-bar", hiddenName: "Breaker", revealedName: "Breaker" },
  },
  {
    templateId: "broken-chain:act3:demonic-reaver:v1",
    name: "Demonic Reaver",
    encounterId: "act3-e8-the-occupied-acre",
    encounterLabel: "Act 3 E8 - The Occupied Acre",
    stats: {
      kind: "fiend", ac: 18, maxHp: 90, speed: "40 ft.",
      defenses: [
        { name: "Blur", ehpMultiplier: 1.227798, provenance: "derived", note: "DERIVED from two published sources, not estimated. Attack rolls against the Reaver have disadvantage, permanently and against every attack. v9 Pricing Resolver row 21 publishes the math: base p=clamp((21+AB-AC)/20,.05,.95), disadvantage=p^2. The AC increase equivalent to turning p into p-squared is dAC=20p(1-p), which is remarkably flat across every plausible hit chance - 5.00 at p=0.50, 4.95 at p=0.55, 4.80 at p=0.60 - so permanent disadvantage IS +5 AC. Priced through the app-s own AC_CONTRIBUTION bands and their published combining rule: +3 (0.140100) + +2 (0.087698) = 0.227798. Cross-check: the calibrated All attacks at disadvantage - 1 round row is +0.129416, so permanent reads 1.76x a single round, which is the right order for a three-to-four round fight." },
      ],
      attacksPerTurn: 2,
      size: "Medium", classification: "elite", archetype: "skirmisher",
      skills: [{ label: "Acrobatics", modifier: 8 }, { label: "Stealth", modifier: 12 }, { label: "Perception", modifier: 12 }],
      proficiencyBonus: 4,
    },
    abilities: [
      { label: "STR", value: "10 (+0)" },
      { label: "DEX", value: "18 (+4)", saveProficient: true },
      { label: "CON", value: "12 (+1)" },
      { label: "INT", value: "16 (+3)" },
      { label: "WIS", value: "18 (+4)", saveProficient: true },
      { label: "CHA", value: "14 (+2)" },
    ],
    traits: [
      { name: "Blur", kind: "trait", text: "The Reaver’s outline shifts and shimmers out of place. Attack rolls against it have disadvantage. An attacker that does not rely on sight, or that can see through illusions, ignores this effect." },
      { name: "Scent the Expense", kind: "trait", text: "Whenever a hostile creature the Reaver can see within 60 ft. expends a limited-use resource, that creature becomes the Reaver’s quarry, replacing any previous quarry. Spell slots, class-feature uses, item charges, and similar resources count; recurring once-per-turn riders and other effects that do not consume a limited use do not. At the start of the Reaver’s turn, its current quarry locks until the end of that turn and cannot be replaced during that turn. While moving toward its quarry, the Reaver’s movement is doubled. Once per turn when the Reaver hits its quarry with an attack, the hit deals an extra 10 (4d4) fire damage." },
    ],
    actions: [
      { name: "Rending Talon", kind: "attack", roll: "1d20 + @ATK", damage: "1d10 + @MAIN slashing + 2d6 fire", text: "Melee Attack: +8 to hit, reach 5 ft., one target. Hit: 16 (1d10 + 4 slashing plus 2d6 fire) damage. Multiattack: the Reaver makes two Rending Talon attacks." },
    ],
    reactions: [
    ],
    resources: [],
    notes: [
      "A hunter that tracks expenditure rather than position. It reads the moment a resource leaves a caster's hands and goes straight for it.",
      "DM DESIGN READ. The Reaver hunts actual expenditure, not passive Gift riders. The most recent qualifying spender before its turn becomes the quarry; once the turn begins that quarry locks. Blur makes attack-roll focus inefficient, while doubled pursuit movement and the 4d4 quarry rider make spending a real resource visible and dangerous.",
      "THE QUARRY RIDER IS NOT IN THE DPR. Scent the Expense adds 10 (4d4) fire once per turn on a hit against the quarry - about a third again on top of the routine - but it fires only when the party spends a limited-use resource, which is party state the trace does not model. The DPR below is the floor, not the ceiling.",
    ],
    visibility: { defaultState: "hp-bar", hiddenName: "Demonic Reaver", revealedName: "Demonic Reaver" },
  },
  {
    templateId: "broken-chain:act3:veil-torn-wyrmling:v1",
    name: "Veil-Torn Wyrmling",
    encounterId: "act3-e9-gate-iii-veil-torn-dragon",
    encounterLabel: "Act 3 E9 - Gate III: The Veil-Torn Dragon",
    stats: {
      kind: "dragon", ac: 17, maxHp: 39, speed: "30 ft., glide 30 ft.",
      defenses: [
        { name: "Moon-Slick Scales", ehpMultiplier: 1.047749, rule: "First attack each round at disadvantage", note: "Workbook: First attack each round at disadvantage (+0.047749). Applies to the first opportunity attack each round." },
      ],
      size: "Small", classification: "mid-boss", archetype: "skirmisher",
      skills: [{ label: "Perception", modifier: 5 }],
      proficiencyBonus: 3,
    },
    abilities: [
      { label: "STR", value: "14 (+2)" },
      { label: "DEX", value: "18 (+4)", saveProficient: true },
      { label: "CON", value: "14 (+2)" },
      { label: "INT", value: "14 (+2)" },
      { label: "WIS", value: "14 (+2)" },
      { label: "CHA", value: "16 (+3)", saveProficient: true },
    ],
    traits: [
      { name: "Moon-Slick Scales", kind: "trait", text: "The first opportunity attack made against the wyrmling each round has disadvantage." },
    ],
    actions: [
      { name: "Broken Gleam", kind: "action", economyCost: "bonus", text: "Bonus Action: Disengage and move up to 10 ft. This movement cannot rise vertically unless it starts from higher ground." },
      { name: "Bite", kind: "attack", roll: "1d20 + 7", damage: "2d6 + @MAIN piercing + 1d6 radiant", text: "Melee Weapon Attack: +7 to hit, reach 5 ft.; Hit: 11 (2d6 + 4) piercing plus 3 (1d6) radiant." },
      { name: "Moonshard Breath (Recharge 5–6)", kind: "action", save: "DEX DC 14", recharge: "5-6", damage: "4d6", text: "30-ft. line, 5 ft. wide; DC 14 Dexterity save (Charisma-based); 14 (4d6) radiant on failure, half on success." },
    ],
    reactions: [
    ],
    resources: [],
    notes: [
      "A smaller dragon whose movements still look graceful until the canopy tugs it half a beat too early. Both wyrmlings use the same standalone block.",
    ],
    visibility: { defaultState: "hp-bar", hiddenName: "Veil-Torn Wyrmling", revealedName: "Veil-Torn Wyrmling" },
  },
  {
    templateId: "broken-chain:act3:veil-torn-dragon:v1",
    name: "Veil-Torn Dragon",
    encounterId: "act3-e9-gate-iii-veil-torn-dragon",
    encounterLabel: "Act 3 E9 - Gate III: The Veil-Torn Dragon",
    stats: {
      kind: "dragon", ac: 18, maxHp: 195, speed: "40 ft.; Broken Lift only",
      defenses: [
        { name: "Legendary Resistance (1/Day)", ehpMultiplier: 1.042458, rule: "Legendary Resistance - 1 use", note: "Workbook: Legendary Resistance - 1 use (+0.042458), exact." },
      ],
      attacksPerTurn: 3,
      size: "Huge", classification: "mid-boss", archetype: "commander",
      legendaryPerRound: 1,
      skills: [{ label: "Perception", modifier: 8 }],
      proficiencyBonus: 4,
    },
    abilities: [
      { label: "STR", value: "20 (+5)" },
      { label: "DEX", value: "18 (+4)" },
      { label: "CON", value: "20 (+5)", saveProficient: true },
      { label: "INT", value: "18 (+4)" },
      { label: "WIS", value: "18 (+4)", saveProficient: true },
      { label: "CHA", value: "20 (+5)", saveProficient: true },
    ],
    traits: [
      { name: "Legendary Resistance (1/Day)", kind: "trait", text: "If the dragon fails a saving throw, it can choose to succeed instead." },
      { name: "Moonmark (2/Day)", kind: "trait", save: "DEX DC 17", text: "Action: choose a point within 60 ft.; a 15-ft. radius fills with pale motes until the start of the dragon’s next turn. Creatures of the dragon’s choice in the area make a DC 17 Dexterity save. On a failure, they cannot benefit from invisibility and the first attack against them before the effect ends has advantage. No damage." },
    ],
    actions: [
      { name: "Broken Lift (Recharge 5–6)", kind: "action", economyCost: "bonus", recharge: "5-6", text: "Bonus Action: launch and glide up to 40 ft., ignoring ground terrain and opportunity attacks. It must end on a surface that supports it; it has no standing fly speed." },
      { name: "Bite", kind: "attack", roll: "1d20 + 9", damage: "2d10 + 5 piercing + 2d6 radiant", text: "Melee Weapon Attack: +9 to hit, reach 10 ft.; Hit: 16 (2d10 + 5) piercing plus 7 (2d6) radiant." },
      { name: "Claw", kind: "attack", roll: "1d20 + 9", damage: "2d6 + 5", text: "Melee Weapon Attack: +9 to hit, reach 5 ft.; Hit: 12 (2d6 + 5) slashing." },
      { name: "Fractured Dream Breath (Recharge 5–6)", kind: "action", save: "CON DC 17", recharge: "5-6", text: "60-ft. cone, DC 17 Constitution save. Failure: until the end of the target’s next turn, speed is halved, it cannot take reactions, and the first attack against it has advantage. The first time the target takes damage, the no-reactions and advantage portions end immediately, but the speed reduction remains until the normal duration ends." },
      { name: "Moonfall Breath (Recharge 5–6)", kind: "action", save: "DEX DC 17", recharge: "5-6", damage: "8d8", text: "90-ft. line, 10 ft. wide; DC 17 Dexterity save; 36 (8d8) radiant on failure, half on success. The two breath options share the same recharge." },
      { name: "Tail Sweep", kind: "action", roll: "1d20 + 9", damage: "1d8 + 5", legendaryCost: 1, text: "Once per round at the end of another creature’s turn, make one Tail attack: +9 to hit, reach 15 ft.; Hit: 9 (1d8 + 5) bludgeoning, and the dragon may move 5 ft. without provoking from the target hit." },
    ],
    reactions: [
    ],
    resources: [],
    notes: [
      "A real Fey-touched dragon caught at the point where native belonging has become control. Its wings still know how to fly. The Wood has started deciding when they open.",
      "LAIR ACTIONS (not yet playable from the tracker — a lair is a SUMMON at initiative 20, and the summon mechanism is unbuilt). At initiative count 20 (losing ties), choose one option. The same option cannot be used on consecutive rounds. Ground Remembers Wrong. Choose up to three 10-ft. squares of natural ground within 90 ft. Creatures there make a DC 17 Strength save or slide up to 10 ft. to a safe space chosen by the lair. Branches Close. A 15-ft.-radius sphere within 90 ft. becomes heavily obscured by overlapping leaves and wrong-angle branches until the next initiative count 20. Borrowed Sky. Choose one creature within 90 ft. The lair moves it up to 20 ft. horizontally and 10 ft. vertically, placing it safely on a surface. An unwilling creature can resist with a DC 17 Strength save.",
    ],
    visibility: { defaultState: "hp-bar", hiddenName: "Veil-Torn Dragon", revealedName: "Veil-Torn Dragon" },
  },
  {
    /**
     * THE ELEMENTAL MIRROR — a TEMPLATE creature, not a stat block to drop on the map.
     *
     * *"The Wood builds one mirror for each adventurer."* Body count equals party size (3/4/5) and
     * every mirror keeps a flat 90 HP — the one encounter in the campaign where party scaling moves
     * the number of bodies instead of the HP of each.
     *
     * Each body is finished in the ENCOUNTER editor from three choices, exactly as the card says:
     *   1. an unused ARCHETYPE  — reshapes the six scores below; sets attack and spell lines
     *   2. an unused ELEMENT package — names the body and supplies {primary} / {secondary}
     *   3. one legal BOND at its Metamorphosis path
     * No duplicates across the roster; the editor enforces that by removing taken options.
     *
     * Sources: the Elemental Mirror statblock card, Act 3 encounters v3.15 Fight 6, and the
     * Signature Spell Packages sheet. The ABS array is 18/16/14/12/12/10 for every archetype —
     * one multiset dealt into each archetype's spine, which is why the reshape reproduces the
     * card's published rows exactly.
     */
    templateId: "broken-chain:act3:elemental-mirror:v1",
    name: "Elemental Mirror",
    encounterId: "act3-e6-gate-ii-the-mirrors",
    encounterLabel: "Act 3 E6 - Gate II: The Mirrors",
    isTemplate: true,
    bodyNameFormat: "{pick} Mirror",
    stats: {
      kind: "aberration", ac: 15, maxHp: 90, speed: "30 ft.",
      attacksPerTurn: 2,
      defenses: [
        { name: "Elemental Guard", ehpMultiplier: 1.075916, rule: "Telegraphed alternating immunity/resistance", note: "Workbook: Telegraphed alternating immunity/resistance (+0.075916), exact. Read from the trait text by traitClassifier on \"immunity that rotates each turn\" - the mirror had NO defences at all, so a Gate boss priced at flat 90 raw HP with its signature ability worth zero." },
      ],
      size: "Medium", classification: "elite", cr: 7,
      // "The Wood builds one mirror for each adventurer." Flat 90 HP each; the count follows
      // party size and the party-size HP band does not apply. See `oneBodyPerPc`.
      oneBodyPerPc: true,
    },
    /**
     * The ABS array. Left in printed order — a body's chosen archetype deals these same six
     * numbers into its own spine, so no archetype is baked in here.
     */
    abilities: [
      { label: "STR", value: "18 (+4)" },
      { label: "DEX", value: "16 (+3)" },
      { label: "CON", value: "14 (+2)" },
      { label: "INT", value: "12 (+1)" },
      { label: "WIS", value: "12 (+1)" },
      { label: "CHA", value: "10 (+0)" },
    ],
    actionSets: [
      {
        id: "element",
        label: "Element package",
        pick: 1,
        namesBody: true,
        note: "Primary locks its paired secondary. Do not duplicate a package across the roster.",
        optionVars: {
        "Ice": { primary: "ice", secondary: "necrotic", pair: "Ice/Necrotic", group: "Defensive-solid" },
        "Earth": { primary: "earth", secondary: "radiant", pair: "Earth/Radiant", group: "Defensive-solid" },
        "Nature": { primary: "nature", secondary: "poison", pair: "Nature/Poison", group: "Defensive-solid" },
        "Fire": { primary: "fire", secondary: "lightning", pair: "Fire/Lightning", group: "Offensive-fluid" },
        "Water": { primary: "water", secondary: "acid", pair: "Water/Acid", group: "Offensive-fluid" },
        "Air": { primary: "air", secondary: "force", pair: "Air/Force", group: "Offensive-fluid" },
        },
      },
    ],
    traits: [
      { name: "Elemental Guard", kind: "trait", text: "The mirror is immune to {primary} and {secondary} damage. The active immunity changes every turn and is always described aloud before damage is committed, so players can route damage around it." },
      { name: "Constructed Answer", kind: "trait", text: "The mirror is built from an archetype, an element package and one bond at its Metamorphosis path. It is close enough to a party's roles to be insulting, and never an exact copy." },
      { name: "Signature Limit", kind: "trait", text: "Roster-limited: at most one 1/day signature effect per round across the whole mirror encounter, and at most one Offensive and one Defensive mirror may use a signature in any one round." },
    ],
    actions: [
      /**
       * ⚠ ONE Claw and ONE Bolt, not six of each. The damage TYPE comes from the element package
       * the body took ({primary}), and the to-hit and damage modifier come from the creature's own
       * scores after the archetype reshape — @MAIN is its highest stat, @PROF comes from CR.
       */
      { name: "Claw", kind: "attack", roll: "1d20+@MAIN+@PROF", damage: "2d6+@MAIN {primary}", text: "Melee Weapon Attack, reach 5 ft. The archetype sets the modifier; the element sets the damage type." },
      { name: "Bolt", kind: "attack", roll: "1d20+@MAIN+@PROF", damage: "2d6+@MAIN {primary}", text: "Ranged Spell Attack, range 60 ft. The archetype sets the modifier; the element sets the damage type." },
      { name: "Gravefrost Reflections", kind: "reaction", setId: "element", setOption: "Ice", uses: 1, damage: "2d6", save: "WIS DC @DC", text: "1/Day, Reaction when the mirror is targeted by an attack. Three ice-and-shadow reflections appear for up to 1 minute. While a reflection remains, when an attack would hit the mirror, roll a d20; on a 6 or higher the attack destroys a reflection instead. A reflection uses the mirror's AC. When the last reflection is destroyed, the creature that destroyed it takes 2d6 cold or necrotic damage (mirror's choice) and must succeed on a Wisdom saving throw or be frightened of the mirror until the end of its next turn." },
      { name: "Ray of Frost", kind: "spell", setId: "element", setOption: "Ice", roll: "1d20+@SPELL", damage: "2d8 cold", text: "At-will cantrip. Ranged Spell Attack, range 60 ft. Hit: 2d8 cold damage, and the target's speed is reduced by 10 feet until the start of the mirror's next turn." },
      { name: "Misty Step", kind: "spell", setId: "element", setOption: "Ice", uses: 3, text: "3/day. Bonus Action. The mirror teleports up to 30 feet to an unoccupied space it can see. No damage." },
      { name: "Sunstone Aegis", kind: "action", setId: "element", setOption: "Earth", uses: 1, save: "CON DC @DC", text: "1/Day, Action. Luminous stone closes around the mirror until the start of its next turn, granting +2 AC. The first time each creature targets the mirror with an attack during the effect, that creature makes a Constitution saving throw before the attack. On a failed save, it is blinded until the end of the current turn. A creature makes this save only once per casting." },
      { name: "Mold Earth", kind: "spell", setId: "element", setOption: "Earth", text: "At-will cantrip. Move or shape a 5-foot cube of dirt or stone within 30 ft. — excavate it, change its colour, or make it difficult terrain until the mirror's concentration ends. No damage." },
      { name: "Guiding Bolt", kind: "spell", setId: "element", setOption: "Earth", uses: 3, roll: "1d20+@SPELL", damage: "4d6 radiant", text: "3/day. Ranged Spell Attack, range 120 ft. Hit: 4d6 radiant damage, and the next attack roll against the target before the end of the mirror's next turn has advantage." },
      { name: "Venomroot Bloom", kind: "action", setId: "element", setOption: "Nature", uses: 1, save: "CON DC @DC", text: "1/Day, Action. Choose a point within 60 feet. Poisonous roots erupt in a 20-foot-radius area until the start of the mirror's next turn. The area is difficult terrain for creatures other than the mirror. A creature that enters the area for the first time on a turn or starts its turn there makes a Constitution saving throw. On a failed save, its speed becomes 0 and it is poisoned until the start of its next turn. On a success, its speed is halved until the start of its next turn." },
      { name: "Thorn Whip", kind: "spell", setId: "element", setOption: "Nature", roll: "1d20+@SPELL", damage: "2d6 piercing", text: "At-will cantrip. Melee Spell Attack, reach 30 ft. Hit: 2d6 piercing damage, and the mirror pulls a Large or smaller target up to 10 feet closer." },
      { name: "Ray of Sickness", kind: "spell", setId: "element", setOption: "Nature", uses: 3, roll: "1d20+@SPELL", damage: "2d8 poison", text: "3/day. Ranged Spell Attack, range 60 ft. Hit: 2d8 poison damage, and the target makes a Constitution save or is poisoned until the end of the mirror's next turn." },
      { name: "Stormcharged Fireball", kind: "action", setId: "element", setOption: "Fire", uses: 1, damage: "3d6 {primary} + 3d6 {secondary}", save: "DEX DC @DC", text: "1/Day, Action. Choose a point within 90 feet. A 15-foot-radius sphere erupts with fire threaded by lightning. Each creature in the area makes a Dexterity saving throw, taking 3d6 fire plus 3d6 lightning damage on a failed save, or half as much on a success." },
      { name: "Fire Bolt", kind: "spell", setId: "element", setOption: "Fire", roll: "1d20+@SPELL", damage: "2d10 fire", text: "At-will cantrip. Ranged Spell Attack, range 120 ft. Hit: 2d10 fire damage. A flammable object hit by this spell ignites if it is not being worn or carried." },
      { name: "Thunderwave", kind: "spell", setId: "element", setOption: "Fire", uses: 3, damage: "2d8 thunder", save: "CON DC @DC", text: "3/day. Each creature in a 15-foot cube originating from the mirror makes a Constitution save, taking 2d8 thunder damage and being pushed 10 feet away on a failure, or half damage and no push on a success." },
      { name: "Caustic Tide", kind: "action", setId: "element", setOption: "Water", uses: 1, damage: "2d8 bludgeoning + 2d8 {secondary}", save: "DEX DC @DC", text: "1/Day, Action. A 30-foot-long, 10-foot-wide wave surges from the mirror. Creatures in the wave make a Dexterity saving throw, taking 2d8 bludgeoning plus 2d8 acid damage and falling prone on a failed save. On a success, a creature takes half damage and does not fall prone." },
      { name: "Shape Water", kind: "spell", setId: "element", setOption: "Water", text: "At-will cantrip. Move or shape a 5-foot cube of water within 30 ft., freeze it, or change its colour. No damage." },
      { name: "Grease", kind: "spell", setId: "element", setOption: "Water", uses: 3, save: "DEX DC @DC", text: "3/day. A 10-foot square within 60 ft. becomes difficult terrain. A creature there when it appears, or entering or ending its turn there, makes a Dexterity save or falls prone. No damage." },
      { name: "Gravitic Squall", kind: "action", setId: "element", setOption: "Air", uses: 1, damage: "2d8 thunder + 2d8 {secondary}", save: "STR DC @DC", text: "1/Day, Action. A 30-foot cone of compressed air and force tears outward. Creatures in the cone make a Strength saving throw, taking 2d8 thunder plus 2d8 force damage on a failed save, and the mirror pushes or pulls each failed target 15 feet. On a success, a creature takes half damage and is not moved." },
      { name: "Gust", kind: "spell", setId: "element", setOption: "Air", save: "STR DC @DC", text: "At-will cantrip. One creature within 30 ft. makes a Strength save or is pushed 5 feet away, or the mirror moves an unattended object or creates a harmless gust. No damage." },
      { name: "Vortex Warp", kind: "spell", setId: "element", setOption: "Air", uses: 3, save: "CON DC @DC", text: "3/day. One creature within 90 ft. makes a Constitution save. On a failure, the mirror teleports it to an unoccupied space it can see within 90 feet. No damage." },
    ],
    reactions: [],
    resources: [],
    notes: [
      "Elemental Guard must remain deterministic and readable. The active immunity changes every turn; players should be able to route damage around it.",
      "Use different prime archetypes so the fight reads as a party-shaped system rather than identical attackers. At 3 players use three, at 4 use four, at 5 use five.",
      "Party-size scaling is the MIRROR EXCEPTION: each mirror stays at 90 HP and AC 15, and the encounter scales only by matching the number of mirrors to the number of PCs.",
    ],
    visibility: { defaultState: "hp-bar", hiddenName: "Mirror", revealedName: "Elemental Mirror" },
  },
  {
    templateId: "broken-chain:act3:thought-harrower:v1",
    name: "Thought Harrower",
    encounterId: "act3-e10-the-center",
    encounterLabel: "Act 3 E10 - The Center",
    stats: {
      kind: "aberration", ac: 17, maxHp: 173, speed: "30 ft.",
      defenses: [
        { name: "Legendary Resistance (1/Day)", ehpMultiplier: 1.042458, rule: "Legendary Resistance - 1 use", note: "Workbook: Legendary Resistance - 1 use (+0.042458), exact." },
      ],
      attacksPerTurn: 2,
      size: "Medium", classification: "act-boss", archetype: "tactician",
      legendaryPerRound: 1,
      skills: [{ label: "Arcana", modifier: 10 }, { label: "Perception", modifier: 8 }],
      proficiencyBonus: 4,
    },
    abilities: [
      { label: "STR", value: "14 (+2)" },
      { label: "DEX", value: "12 (+1)" },
      { label: "CON", value: "16 (+3)" },
      { label: "INT", value: "22 (+6)", saveProficient: true },
      { label: "WIS", value: "18 (+4)", saveProficient: true },
      { label: "CHA", value: "18 (+4)" },
    ],
    traits: [
      { name: "Legendary Resistance (1/Day)", kind: "trait", text: "If the Harrower fails a saving throw, it can choose to succeed instead." },
      { name: "Residual Hunger", kind: "trait", text: "Once per round when a creature within 60 ft. expends a spell slot or limited-use class or item resource, Harrower may move up to 10 ft. without provoking. Nothing is stolen or suppressed." },
      { name: "Wrong Origin", kind: "trait", text: "A Rift Lance may originate from Harrower or from one fracture it can see. Range is measured from the origin. This changes geometry, not damage." },
    ],
    actions: [
      { name: "Fracture Seed", kind: "action", economyCost: "bonus", text: "Bonus Action: place one visible fracture in an unoccupied space within 40 ft. Maximum two. A fracture occupies no space and provides no cover. It lasts until the Harrower creates a third or is incapacitated." },
      { name: "Rift Lance", kind: "attack", roll: "1d20 + @ATK", damage: "2d8 + 6", text: "Ranged Spell Attack: +10 to hit, range 120 ft.; Hit: 15 (2d8 + 6) psychic." },
      { name: "Unmake Distance (Recharge 5–6)", kind: "action", save: "INT DC 18", recharge: "5-6", damage: "6d8", text: "30-ft. cone from Harrower or a fracture, DC 18 Intelligence save; 27 (6d8) psychic on failure, half on success. A failed creature is also moved up to 15 ft. toward or away from the origin, Harrower’s choice." },
      { name: "Mind Hook", kind: "action", save: "WIS DC 18", legendaryCost: 1, damage: "2d6", text: "Once per round at the end of another creature’s turn, one creature within 30 ft. of Harrower or a fracture makes a DC 18 Wisdom save. Failure: 7 (2d6) psychic and moved 10 ft. toward the origin; success: no effect." },
    ],
    reactions: [
      { name: "Fold Thought", kind: "reaction", text: "After an attack targeting Harrower resolves, move up to 10 ft. without provoking; once per round." },
    ],
    resources: [],
    notes: [
      "The thing doing the thinking at the center has too many correct angles. It does not cast darkness or shadow; it makes two places become adjacent because it has forgotten that they were not.",
      "LAIR ACTIONS (not yet playable from the tracker — a lair is a SUMMON at initiative 20, and the summon mechanism is unbuilt). At initiative count 20 (losing ties), choose one option. The same option cannot be used on consecutive rounds. Adjacent Elsewhere. Choose two 10-ft. spaces within 90 ft. Until the next initiative count 20, a creature that enters one may spend 5 ft. of movement to exit from the other. Each creature can use this once per turn. Memory of Falling. Choose a 15-ft.-radius area within 90 ft. Creatures there make a DC 18 Strength save or slide 10 ft. in one horizontal direction chosen by the Harrower. No damage. Wrong Angle. Choose a 20-ft.-radius area within 90 ft. Until the next initiative count 20, ranged attacks that originate inside or target inside the area treat half cover as no cover and three-quarters cover as half cover. The distortion benefits both sides.",
    ],
    visibility: { defaultState: "hp-bar", hiddenName: "Thought Harrower", revealedName: "Thought Harrower" },
  },
  {
    templateId: "broken-chain:act3:grief-colossus:v1",
    name: "Grief Colossus",
    encounterId: "act3-e10-the-center",
    encounterLabel: "Act 3 E10 - The Center",
    stats: {
      kind: "aberration", ac: 18, maxHp: 230, speed: "35 ft.",
      defenses: [
        { name: "Legendary Resistance (1/Day)", ehpMultiplier: 1.042458, rule: "Legendary Resistance - 1 use", note: "Workbook: Legendary Resistance - 1 use (+0.042458), exact." },
        { name: "Body Between", ehpMultiplier: 1.232313, rule: "Fixed prevention - 12/round", note: "Workbook: Fixed prevention - 12/round (+0.232313), exact. Reduces the triggering damage by 12 once per round." },
      ],
      attacksPerTurn: 2,
      size: "Huge", classification: "act-boss", archetype: "guardian",
      skills: [{ label: "Athletics", modifier: 10 }],
      proficiencyBonus: 4,
    },
    abilities: [
      { label: "STR", value: "22 (+6)", saveProficient: true },
      { label: "DEX", value: "10 (+0)" },
      { label: "CON", value: "22 (+6)", saveProficient: true },
      { label: "INT", value: "10 (+0)" },
      { label: "WIS", value: "14 (+2)" },
      { label: "CHA", value: "10 (+0)" },
    ],
    traits: [
      { name: "Legendary Resistance (1/Day)", kind: "trait", text: "If the Colossus fails a saving throw, it can choose to succeed instead." },
      { name: "Impossible Mass", kind: "trait", text: "Advantage on saves against being knocked prone or moved against its will." },
    ],
    actions: [
      { name: "Anchor the Wrong", kind: "action", economyCost: "bonus", text: "Bonus Action: until the start of the next turn, speed becomes 0, reach increases by 5 ft., and it cannot be moved against its will. It can end this effect early at the start of its turn." },
      { name: "Fist", kind: "attack", roll: "1d20 + @ATK", damage: "2d10 + @MAIN", text: "Melee Weapon Attack: +10 to hit, reach 10 ft.; Hit: 17 (2d10 + 6) bludgeoning." },
      { name: "Collapse Space (Recharge 5–6)", kind: "action", save: "STR DC 18", recharge: "5-6", damage: "5d8", text: "Creatures of the Colossus’s choice within 15 ft. make a DC 18 Strength save. Failure: 22 (5d8) force and knocked prone. Success: half damage and not prone." },
    ],
    reactions: [
      { name: "Body Between", kind: "reaction", text: "When another creature within 15 ft. takes damage, move up to 10 ft. toward it without provoking. If the Colossus ends within 5 ft., reduce the triggering damage by 12; the Colossus then takes 6 psychic damage that cannot be reduced. Once per round." },
    ],
    resources: [],
    notes: [
      "The weight behind the thought. Its limbs do not bend in the same number of places twice, but when it decides a space is occupied, the battlefield has to argue with several tons of certainty.",
    ],
    visibility: { defaultState: "hp-bar", hiddenName: "Grief Colossus", revealedName: "Grief Colossus" },
  },
];

/**
 * The campaign creature library the app actually reads.
 *
 * Hand-authored content above, in-app authoring folded in from the generated file. A creature
 * the author edited in the app replaces its bundled twin by templateId; a brand new one is
 * appended. Nothing above this line is ever rewritten by a tool.
 */
/**
 * ⚠ FIGHT 7 AND FIGHT 8 ARE FROZEN — VOID FOR CHANGES, NOT REMOVED.
 *
 * Christopher: *"i said void the E7 and E8"*, then, when I filtered them out of the shipped
 * library: *"void changes on them not remove them."*
 *
 * So The Last Court and The Occupied Acre stay exactly as they are and stay in the app. What is
 * void is EDITING them: they are excluded from every reconciliation pass against the encounter
 * documents, and no version check applies to their six creatures — Walking Court, Hushrunner,
 * Brandwing, Siege Saint, Ashstep, Rift Scribe.
 *
 * That matters because v3.21 reassigns Fight 7 outright: its roster there is Blackbough Reeve ·
 * Gloam Harrow · Brandwing, where this library holds Walking Court · Hushrunner · Brandwing. Under
 * any normal pass that reads as drift to correct. It is not. Leave it.
 */
export const VOIDED_FOR_CHANGES = new Set([
  "act3-e7-the-last-court",       // Walking Court · Hushrunner · Brandwing
  "act3-e8-the-occupied-acre",    // Siege Saint · Ashstep · Rift Scribe
]);

export const BROKEN_CHAIN_MONSTER_LIBRARY: MainMonsterTemplate[] =
  mergeAuthored(BUNDLED_MONSTER_LIBRARY, AUTHORED_MONSTERS, t => t.templateId);
