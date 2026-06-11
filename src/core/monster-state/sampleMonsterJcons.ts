export const sampleMonsterJcons = {
  emberWightHunter: {
    schema: "fdm/actor-v1",
    id: "ember-wight-hunter",
    kind: "monster",
    name: "Ember Wight Hunter",
    subtitle: "Undead skirmisher · Monster Dev sample",
    campaignModule: "the-broken-chain",
    tags: ["undead", "fire-nest", "skirmisher"],
    defense: {
      ac: 14,
      hp: {
        current: 38,
        max: 38,
        temp: 0
      },
      speed: {
        walk: 30,
        climb: 20
      }
    },
    abilities: {
      str: { score: 12, modifier: 1 },
      dex: { score: 16, modifier: 3 },
      con: { score: 14, modifier: 2 },
      int: { score: 8, modifier: -1 },
      wis: { score: 12, modifier: 1 },
      cha: { score: 10, modifier: 0 }
    },
    actions: [
      {
        id: "charred-bow",
        name: "Charred Bow",
        kind: "weaponAttack",
        cost: "Main",
        range: "80/320 ft",
        attack: "1d20 + 5",
        damage: "1d8 + 3",
        critDamage: "2d8 + 3",
        critThreshold: 20,
        damageType: "piercing/fire",
        description: "Ranged attack. On a hit, the wound smolders until the start of the hunter's next turn."
      },
      {
        id: "ash-claw",
        name: "Ash Claw",
        kind: "meleeAttack",
        cost: "Main",
        range: "5 ft",
        attack: "1d20 + 5",
        damage: "1d6 + 3",
        critDamage: "2d6 + 3",
        critThreshold: 20,
        damageType: "slashing/fire"
      }
    ],
    bonusActions: [
      {
        id: "cinder-step",
        name: "Cinder Step",
        kind: "rangedAttack",
        cost: "Bonus",
        range: "30 ft",
        attack: "1d20 + 5",
        damage: "1d4 + 3",
        critDamage: "2d4 + 3",
        critThreshold: 20,
        damageType: "fire",
        description: "Bonus action skirmish shot used after repositioning through smoke. Monster Dev uses this to test Bonus Action Dice+ hit/miss flow."
      }
    ],
    reactions: [
      {
        id: "ember-duck",
        name: "Ember Duck",
        kind: "rangedAttack",
        cost: "Reaction",
        range: "60 ft",
        attack: "1d20 + 5",
        damage: "1d6 + 3",
        critDamage: "2d6 + 3",
        critThreshold: 20,
        damageType: "fire",
        description: "Reaction countershot when missed by a ranged attack. Monster Dev uses this to test Reaction Dice+ hit/miss flow."
      }
    ],
    traits: [
      {
        id: "undead-fortitude-lite",
        name: "Ashen Fortitude",
        description: "When the hunter drops to 0 HP, mark it as down. The DM decides whether table fiction allows it to rise again."
      },
      {
        id: "fire-nest-hunter",
        name: "Fire Nest Hunter",
        description: "The hunter is comfortable around smoke, ash, and low flame."
      }
    ],
    resources: [
      {
        id: "ember-duck-uses",
        name: "Ember Duck",
        current: 1,
        max: 1,
        reset: "round",
        note: "Manual reset for Monster Dev."
      }
    ],
    visibility: {
      defaultMode: "condition",
      hiddenName: "Unrevealed Hunter",
      revealedName: "Ember Wight Hunter"
    },
    notes: ["Native FDM monster sample for the 5174 workbench."]
  },

  mirageStalker: {
    schema: "fdm/monster-v1",
    id: "mirage-stalker-act-1-boss",
    kind: "boss",
    name: "Mirage Stalker",
    subtitle: "Act 1 Final Boss · Ruined keep interior · Huge aberration · Challenge 4",
    campaignModule: "the-broken-chain",
    tags: [
      "act-1",
      "final-boss",
      "ruined-keep",
      "huge",
      "aberration",
      "boss",
      "challenge-4",
      "party-levels-2-3",
      "publication-draft"
    ],
    defense: {
      ac: 14,
      hp: {
        current: 100,
        max: 100,
        temp: 0
      },
      speed: "50 ft"
    },
    abilities: {
      str: { score: 19, modifier: 4 },
      dex: { score: 14, modifier: 2 },
      con: { score: 16, modifier: 3 },
      int: { score: 4, modifier: -3 },
      wis: { score: 12, modifier: 1 },
      cha: { score: 6, modifier: -2 }
    },
    actions: [
      {
        id: "mirage-stalker-multiattack",
        name: "Multiattack",
        kind: "multiattack",
        cost: "Action",
        attackCount: 2,
        attacks: [
          {
            id: "mirage-stalker-phantom-rake-subattack",
            name: "Phantom Rake",
            attack: "1d20 + 6",
            range: "10 ft",
            damage: "2d8 + 4",
            critDamage: "4d8 + 4",
            damageType: "piercing",
            description: "The strike lands a half-second before the creature appears to move."
          },
          {
            id: "mirage-stalker-hollow-stamp-subattack",
            name: "Hollow Stamp",
            attack: "1d20 + 6",
            range: "5 ft",
            damage: "2d6 + 4",
            critDamage: "4d6 + 4",
            damageType: "bludgeoning",
            description: "The hooves connect with a sound that is wrong — too hollow, too resonant for something this large standing on stone."
          }
        ],
        description: "The Mirage Stalker makes one Phantom Rake attack and one Hollow Stamp attack."
      },
      {
        id: "mirage-stalker-phantom-rake",
        name: "Phantom Rake",
        kind: "meleeAttack",
        cost: "Action",
        range: "10 ft",
        attack: "1d20 + 6",
        damage: "2d8 + 4",
        critDamage: "4d8 + 4",
        critThreshold: 20,
        damageType: "piercing",
        description: "Melee Weapon Attack: +6 to hit, reach 10 ft., one target. Hit: 13 (2d8 + 4) piercing damage. The strike lands a half-second before the creature appears to move."
      },
      {
        id: "mirage-stalker-hollow-stamp",
        name: "Hollow Stamp",
        kind: "meleeAttack",
        cost: "Action",
        range: "5 ft",
        attack: "1d20 + 6",
        damage: "2d6 + 4",
        critDamage: "4d6 + 4",
        critThreshold: 20,
        damageType: "bludgeoning",
        description: "Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 11 (2d6 + 4) bludgeoning damage. The hooves connect with a sound that is wrong — too hollow, too resonant for something this large standing on stone."
      },
    ],
    bonusActions: [
      {
        id: "mirage-stalker-phase-shift",
        name: "Phase Shift",
        kind: "manual",
        cost: "Bonus Action",
        range: "Self / 15 ft",
        description: "The Stalker flickers between positions, moving up to 15 feet without provoking opportunity attacks. Its afterimage remains at its departure point until the start of its next turn. This movement does NOT reset Phantom Step's disadvantage — the afterimage is simply added on top, so the Stalker is now displaced AND has a stale image where it used to be."
      }
    ],
    reactions: [
      {
        id: "mirage-stalker-phantom-lunge",
        name: "Phantom Lunge",
        kind: "reactionAttack",
        cost: "Reaction",
        range: "10 ft",
        attack: "1d20 + 6",
        damage: "2d6 + 4",
        critDamage: "4d6 + 4",
        critThreshold: 20,
        damageType: "bludgeoning",
        description: "When a creature within 10 feet of the Stalker misses it with an attack because of Phantom Step's disadvantage by targeting the afterimage, the Stalker can make one Hollow Stamp attack against that creature."
      }
    ],
    legendaryActions: [],
    traits: [
      {
        id: "mirage-stalker-phantom-step",
        name: "Phantom Step",
        description: "When the Stalker moves, it leaves an afterimage at its departure point. Attack rolls against the Stalker have disadvantage until it takes damage that round. Attacks targeting the afterimage auto-miss and trigger Phantom Lunge. Usable twice per fight total. Does not trigger the round the Stalker takes damage. Recharge roll/control belongs on this trait/resource, not on Phantom Charge."
      },
      {
        id: "mirage-stalker-wrong-geometry",
        name: "Wrong Geometry",
        description: "The Stalker does not read as a natural creature. Effects that specifically target beasts, such as a ranger's Favored Foe or spells that affect only beasts, do not affect it. It is an aberration."
      },
      {
        id: "mirage-stalker-condition-immunity-frightened",
        name: "Condition Immunity — Frightened",
        description: "The Stalker is immune to the frightened condition. The corruption burned out its fear response."
      }
    ],
    resources: [
      {
        id: "mirage-stalker-phantom-step-uses",
        name: "Phantom Step Uses",
        current: 2,
        max: 2,
        reset: "fight",
        note: "Two uses per fight total. Does not trigger during a round in which the Stalker has taken damage."
      },
      {
        id: "mirage-stalker-phantom-step-recharge",
        name: "Phantom Step Recharge",
        current: 0,
        max: 1,
        reset: "Recharge 5-6",
        note: "Roll at the start of the Stalker turn if Phantom Step is spent/available-by-recharge in the current test flow. Recharge control belongs on Phantom Step."
      },
      {
        id: "mirage-stalker-phantom-charge-recharge-note",
        name: "Phantom Charge Condition",
        current: 1,
        max: 1,
        reset: "Recharge 5-6",
        note: "Phantom Charge is an action with Recharge 5-6. Its prone/push rider is hit-gated and also requires at least 20 ft of straight-line movement before the Phantom Rake attack."
      }
    ],
    visibility: {
      defaultMode: "condition",
      hiddenName: "Something Wrong in the Keep",
      revealedName: "Mirage Stalker"
    },
    notes: [
      "Act 1 Final Boss · Ruined keep interior · party levels 2→3 · Huge aberration, formerly a giant elk.",
      "Challenge 4 design target for a 5-PC party at levels 2–3. Builder-side estimate only; not public/player-facing balance text.",
      "Saving Throws: STR +6, CON +5.",
      "Skills: Perception +3.",
      "Condition Immunities: Frightened.",
      "Senses: Darkvision 60 ft., Passive Perception 13.",
      "Proficiency Bonus: +2.",
      "Running the fight: Phantom Step uses and Phantom Charge recharge are the only active counters needed mid-fight.",
      "Darkness zones: both staircase tops and the lair contain magical darkness zones. The Stalker will Phase Shift into these to deny targeting.",
      "Faerie Fire answer: cast into the darkness zone as an area, no sight required; magical outline bypasses darkness.",
      "Signature moment: Phase Shift + Phantom Lunge. Use once early so the table learns to confirm position before swinging.",
      "DM Note: Phantom Step does not trigger the round the Stalker takes damage — landing a hit suppresses the afterimage and confirms real position. Once the two uses are spent, the mechanic is gone."
    ]
  },


  act2S1PaleStalker: {
    schema: "fdm/monster-v1",
    id: "act2-s1-pale-stalker",
    kind: "monster",
    name: "Pale Stalker",
    subtitle: "Act 2 Session 1 · Hollow Pack · Large monstrosity · Strong",
    campaignModule: "the-broken-chain",
    tags: ["act-2", "session-1", "hollow-pack", "strong", "monstrosity", "party-levels-2-3"],
    defense: { ac: 13, hp: { current: 75, max: 75, temp: 0 }, speed: "50 ft" },
    abilities: {
      str: { score: 18, modifier: 4 }, dex: { score: 13, modifier: 1 }, con: { score: 14, modifier: 2 },
      int: { score: 7, modifier: -2 }, wis: { score: 12, modifier: 1 }, cha: { score: 8, modifier: -1 }
    },
    actions: [
      { id: "pale-stalker-bite", name: "Bite", kind: "meleeAttack", cost: "Action", range: "5 ft", attack: "1d20 + 6", damage: "2d6 + 4", critDamage: "4d6 + 4", damageType: "piercing", hitRider: { save: "STR DC 14", failEffect: "Target is knocked prone." }, description: "+6 to hit, reach 5 ft., one target. Hit: 11 (2d6 + 4) piercing damage. If the target is a creature, it must succeed on a DC 14 Strength saving throw or be knocked prone." },
      { id: "pale-stalker-cold-breath", name: "Cold Breath", kind: "save", cost: "Action", range: "15-foot cone", save: "DEX", dc: 12, damage: "4d8", damageType: "cold", recharge: "Recharge 5-6; locked while both Pack Hunters are alive", description: "Each creature in the area makes a DC 12 Dexterity save, taking 18 (4d8) cold damage on failed save or half on success. Apex Unleashed makes this available when the first Pack Hunter dies." }
    ],
    bonusActions: [], reactions: [], legendaryActions: [],
    traits: [
      { id: "pale-stalker-keen", name: "Keen Hearing and Smell", description: "Advantage on Wisdom (Perception) checks that rely on hearing or smell." },
      { id: "pale-stalker-pack-tactics", name: "Pack Tactics", description: "Advantage on attack rolls against a creature if at least one ally is within 5 feet of it and not incapacitated." },
      { id: "pale-stalker-apex", name: "Apex Unleashed", description: "While both Pack Hunters are alive, Cold Breath is locked. When the first Pack Hunter dies, Cold Breath becomes available immediately and recharges on 5-6. Exploit Weakness damage increases by 1d6 for the rest of the fight." },
      { id: "pale-stalker-exploit", name: "Exploit Weakness", description: "When attacking a prone target, a target with reduced speed, or a creature damaged by another creature this round, add 1d8 cold damage on hit. Increases to 2d8 after Apex Unleashed activates." }
    ],
    resources: [{ id: "pale-stalker-cold-breath-recharge", name: "Cold Breath", current: 0, max: 1, reset: "Recharge 5-6", note: "Locked until first Pack Hunter dies." }],
    visibility: { defaultMode: "hp-bar", hiddenName: "Patient Wolf", revealedName: "Pale Stalker" },
    notes: ["Encounter 1 — Hollow Pack. Teaches positioning and control.", "Damage Immunities: Cold.", "Skills: Perception +3, Stealth +3.", "Senses: Darkvision 60 ft., Passive Perception 13.", "Language note: understands Common but does not speak it."]
  },

  act2S1PackHunter: {
    schema: "fdm/monster-v1",
    id: "act2-s1-pack-hunter",
    kind: "monster",
    name: "Pack Hunter",
    subtitle: "Act 2 Session 1 · Hollow Pack · Medium corrupted beast · Strong · run 2",
    campaignModule: "the-broken-chain",
    tags: ["act-2", "session-1", "hollow-pack", "strong", "beast", "run-2", "party-levels-2-3"],
    defense: { ac: 12, hp: { current: 47, max: 47, temp: 0 }, speed: "40 ft" },
    abilities: { str: { score: 14, modifier: 2 }, dex: { score: 15, modifier: 2 }, con: { score: 14, modifier: 2 }, int: { score: 5, modifier: -3 }, wis: { score: 12, modifier: 1 }, cha: { score: 6, modifier: -2 } },
    actions: [{ id: "pack-hunter-bite", name: "Bite", kind: "meleeAttack", cost: "Action", range: "5 ft", attack: "1d20 + 4", damage: "2d4 + 2", critDamage: "4d4 + 2", damageType: "piercing", hitRider: { save: "STR DC 12", failEffect: "Target is knocked prone." }, description: "+4 to hit, reach 5 ft., one target. Hit: 7 (2d4 + 2) piercing damage. DC 12 Strength save or knocked prone." }],
    bonusActions: [{ id: "pack-hunter-cornered-howl", name: "Cornered Howl", kind: "manual", cost: "Bonus Action", range: "30 ft", description: "When this creature has no ally within 5 feet, each allied creature within 30 feet that can hear it may immediately move up to half speed toward the howling creature. This movement does not provoke opportunity attacks." }],
    reactions: [], legendaryActions: [],
    traits: [{ id: "pack-hunter-pack-tactics", name: "Pack Tactics", description: "Advantage on attack rolls against a creature if at least one ally is within 5 feet of it and not incapacitated." }],
    resources: [],
    visibility: { defaultMode: "hp-bar", hiddenName: "Corrupted Hunter", revealedName: "Pack Hunter" },
    notes: ["Run 2 in Hollow Pack.", "Skills: Perception +3, Stealth +2.", "Senses: Darkvision 30 ft., Passive Perception 13.", "Cornered Howl is physical sound only; Silence and Silencing Round can suppress the reaction that enables it."]
  },

  act2S1IceboundZombie: {
    schema: "fdm/monster-v1",
    id: "act2-s1-icebound-zombie",
    kind: "monster",
    name: "Icebound Zombie",
    subtitle: "Act 2 Session 1 · Frozen Hollow · Medium undead · Standard",
    campaignModule: "the-broken-chain",
    tags: ["act-2", "session-1", "frozen-hollow", "standard", "undead", "party-levels-2-3"],
    defense: { ac: 12, hp: { current: 45, max: 45, temp: 0 }, speed: "20 ft" },
    abilities: { str: { score: 13, modifier: 1 }, dex: { score: 6, modifier: -2 }, con: { score: 16, modifier: 3 }, int: { score: 3, modifier: -4 }, wis: { score: 6, modifier: -2 }, cha: { score: 5, modifier: -3 } },
    actions: [{ id: "icebound-zombie-slam", name: "Slam", kind: "meleeAttack", cost: "Action", range: "5 ft", attack: "1d20 + 3", damage: "1d6 + 1 bludgeoning + 1d6 cold", critDamage: "2d6 + 1 bludgeoning + 2d6 cold", damageType: "bludgeoning/cold", description: "+3 to hit. Hit: 4 (1d6 + 1) bludgeoning plus 3 (1d6) cold." }],
    bonusActions: [], reactions: [], legendaryActions: [],
    traits: [
      { id: "icebound-zombie-hollow-fortitude", name: "Hollow Fortitude", description: "When damage reduces the Zombie to 0 HP, it makes a CON save DC 5 + damage taken unless the damage is radiant or from a critical hit. On success, drops to 1 HP instead." },
      { id: "icebound-zombie-wendigo-drained", name: "Wendigo-Drained", description: "Does not bleed. Speed reduction on hit does not affect it unless magical." }
    ],
    resources: [],
    visibility: { defaultMode: "hp-bar", hiddenName: "Icebound Corpse", revealedName: "Icebound Zombie" },
    notes: ["Saving Throws: WIS +0.", "Damage Immunities: Cold, Poison.", "Condition Immunities: Poisoned.", "Senses: Darkvision 60 ft., Passive Perception 8."]
  },

  act2S1Ghoul: {
    schema: "fdm/monster-v1",
    id: "act2-s1-ghoul",
    kind: "monster",
    name: "Ghoul",
    subtitle: "Act 2 Session 1 · Frozen Hollow · Medium undead · Standard",
    campaignModule: "the-broken-chain",
    tags: ["act-2", "session-1", "frozen-hollow", "standard", "undead", "party-levels-2-3"],
    defense: { ac: 12, hp: { current: 35, max: 35, temp: 0 }, speed: "30 ft" },
    abilities: { str: { score: 13, modifier: 1 }, dex: { score: 15, modifier: 2 }, con: { score: 10, modifier: 0 }, int: { score: 7, modifier: -2 }, wis: { score: 10, modifier: 0 }, cha: { score: 8, modifier: -1 } },
    actions: [
      { id: "ghoul-bite", name: "Bite", kind: "meleeAttack", cost: "Action", range: "5 ft", attack: "1d20 + 2", damage: "2d6 + 2", critDamage: "4d6 + 2", damageType: "piercing", description: "+2 to hit, one incapacitated target only. Hit: 9 (2d6 + 2) piercing damage." },
      { id: "ghoul-claws", name: "Claws", kind: "meleeAttack", cost: "Action", range: "5 ft", attack: "1d20 + 4", damage: "2d4 + 2", critDamage: "4d4 + 2", damageType: "slashing", hitRider: { save: "CON DC 10", failEffect: "Target is paralyzed until the end of its next turn." }, description: "+4 to hit. If target is not undead, DC 10 CON save or paralyzed until end of next turn." }
    ],
    bonusActions: [], reactions: [], legendaryActions: [],
    traits: [{ id: "ghoul-hungry-dead", name: "Hungry Dead", description: "Advantage on attack rolls against any creature that has not yet taken a turn this combat, or that is paralyzed." }],
    resources: [],
    visibility: { defaultMode: "hp-bar", hiddenName: "Hungry Dead", revealedName: "Ghoul" },
    notes: ["Damage Immunities: Poison.", "Condition Immunities: Charmed, Exhaustion, Poisoned.", "Senses: Darkvision 60 ft., Passive Perception 10."]
  },

  act2S1HollowMourner: {
    schema: "fdm/monster-v1",
    id: "act2-s1-hollow-mourner",
    kind: "monster",
    name: "Hollow Mourner",
    subtitle: "Act 2 Session 1 · Frozen Hollow · Medium undead · Standard",
    campaignModule: "the-broken-chain",
    tags: ["act-2", "session-1", "frozen-hollow", "standard", "undead", "party-levels-2-3"],
    defense: { ac: 13, hp: { current: 42, max: 42, temp: 0 }, speed: "30 ft" },
    abilities: { str: { score: 16, modifier: 3 }, dex: { score: 17, modifier: 3 }, con: { score: 10, modifier: 0 }, int: { score: 11, modifier: 0 }, wis: { score: 10, modifier: 0 }, cha: { score: 8, modifier: -1 } },
    actions: [
      { id: "hollow-mourner-bite", name: "Bite", kind: "meleeAttack", cost: "Action", range: "5 ft", attack: "1d20 + 5", damage: "2d8 + 3", critDamage: "4d8 + 3", damageType: "piercing", description: "+5 to hit. Hit: 12 (2d8 + 3) piercing damage." },
      { id: "hollow-mourner-claws", name: "Claws", kind: "meleeAttack", cost: "Action", range: "5 ft", attack: "1d20 + 5", damage: "2d6 + 3", critDamage: "4d6 + 3", damageType: "slashing", hitRider: { save: "CON DC 10", failEffect: "Target is paralyzed until the end of its next turn." }, description: "+5 to hit. Non-undead target must make DC 10 CON save or be paralyzed until end of next turn." }
    ],
    bonusActions: [], reactions: [], legendaryActions: [],
    traits: [
      { id: "hollow-mourner-cold-aura", name: "Hollow Cold Aura", description: "A creature starting its turn within 10 feet must succeed on DC 11 CON save or have disadvantage on CON saves until start of its next turn." },
      { id: "hollow-mourner-turning-defiance", name: "Turning Defiance", description: "If it fails a saving throw against an effect that would turn undead, it may reroll and must use the new result." }
    ],
    resources: [],
    visibility: { defaultMode: "hp-bar", hiddenName: "Hollow Mourner", revealedName: "Hollow Mourner" },
    notes: ["Damage Resistances: Necrotic.", "Damage Immunities: Poison.", "Condition Immunities: Charmed, Exhaustion, Poisoned.", "Senses: Darkvision 60 ft., Passive Perception 10."]
  },

  act2S2CorruptedHunter: {
    schema: "fdm/monster-v1",
    id: "act2-s2-corrupted-hunter",
    kind: "monster",
    name: "Corrupted Hunter",
    subtitle: "Act 2 Session 2 · Corrupted Hunters · Medium undead (Wight chassis) · Strong · run 2",
    campaignModule: "the-broken-chain",
    tags: ["act-2", "session-2", "corrupted-hunters", "strong", "undead", "wight", "run-2", "party-levels-3-4"],
    // Rebuilt on the Monster Manual Wight chassis (CR 3): AC 14, 45 HP, STR 15 DEX 14 CON 16
    // INT 10 WIS 13 CHA 15, Multiattack (2 weapon) OR one Life Drain, plus Sunlight Sensitivity.
    // Cold-north Broken Chain flavor layered on top; campaign STR-drain rider kept alongside
    // the Wight's signature max-HP Life Drain.
    defense: { ac: 14, hp: { current: 45, max: 45, temp: 0 }, speed: "30 ft" },
    abilities: { str: { score: 15, modifier: 2 }, dex: { score: 14, modifier: 2 }, con: { score: 16, modifier: 3 }, int: { score: 10, modifier: 0 }, wis: { score: 13, modifier: 1 }, cha: { score: 15, modifier: 2 } },
    actions: [
      { id: "corrupted-hunter-multiattack", name: "Multiattack", kind: "multiattack", cost: "Action", attackCount: 2, attacks: [{ id: "corrupted-hunter-blade-1", name: "Frostbitten Longblade", attack: "1d20 + 4", range: "5 ft", damage: "1d8 + 2 slashing + 1d4 cold", critDamage: "2d8 + 2 slashing + 2d4 cold", damageType: "slashing/cold" }, { id: "corrupted-hunter-blade-2", name: "Frostbitten Longblade", attack: "1d20 + 4", range: "5 ft", damage: "1d8 + 2 slashing + 1d4 cold", critDamage: "2d8 + 2 slashing + 2d4 cold", damageType: "slashing/cold" }], description: "The Hunter makes two Frostbitten Longblade attacks, or uses Corrupted Life Drain once in place of both (Wight chassis Multiattack)." },
      { id: "corrupted-hunter-frostbitten-longblade", name: "Frostbitten Longblade", kind: "meleeAttack", cost: "Action", range: "5 ft", attack: "1d20 + 4", damage: "1d8 + 2 slashing + 1d4 cold", critDamage: "2d8 + 2 slashing + 2d4 cold", damageType: "slashing/cold", description: "+4 to hit, reach 5 ft., one target. Hit: 6 (1d8 + 2) slashing plus 2 (1d4) cold." },
      { id: "corrupted-hunter-corrupted-life-drain", name: "Corrupted Life Drain", kind: "meleeAttack", cost: "Action", range: "5 ft", attack: "1d20 + 4", damage: "1d6 + 2", critDamage: "2d6 + 2", damageType: "necrotic", hitRider: { save: "CON DC 13", failEffect: "Max HP is reduced by the necrotic damage taken until a long rest (Wight Life Drain), AND Strength score drops by 1d4 (cold-rot rider; STR drain cap 6 per player per fight). A humanoid reduced to 0 max HP this way rises as a Hollow thrall under DM control." }, description: "Wight chassis Life Drain. +4 to hit, reach 5 ft., one creature. Hit: 5 (1d6 + 2) necrotic. DC 13 CON save or max HP reduced by the necrotic taken until long rest, plus campaign STR drain." }
    ],
    bonusActions: [], reactions: [], legendaryActions: [],
    traits: [
      { id: "corrupted-hunter-coordinated-strike", name: "Coordinated Strike", description: "When this creature hits a target already hit by another Corrupted Hunter this round, it deals an additional 1d8 necrotic damage." },
      { id: "corrupted-hunter-sunlight-sensitivity", name: "Sunlight Sensitivity", description: "Wight chassis. While in sunlight, the Hunter has disadvantage on attack rolls and on Wisdom (Perception) checks that rely on sight." }
    ],
    resources: [{ id: "corrupted-hunter-str-drain-cap", name: "STR Drain Cap", current: 0, max: 6, reset: "per player / per fight", note: "Track manually per player. A long rest removes both the Life Drain max-HP reduction and the STR drain." }],
    visibility: { defaultMode: "hp-bar", hiddenName: "Corrupted Hunter", revealedName: "Corrupted Hunter" },
    notes: ["Built on the Monster Manual Wight chassis (CR 3): AC 14, 45 HP, Multiattack + Life Drain, Sunlight Sensitivity.", "Saving Throws: CON +5.", "Skills: Perception +3, Stealth +4.", "Damage Resistances: Necrotic; bludgeoning/piercing/slashing from nonmagical, non-silvered weapons.", "Damage Immunities: Poison.", "Condition Immunities: Exhaustion, Poisoned.", "Senses: Darkvision 60 ft., Passive Perception 13."]
  },

  act2S2SoulGorgedGuardian: {
    schema: "fdm/monster-v1",
    id: "act2-s2-soul-gorged-guardian",
    kind: "boss",
    name: "Soul-Gorged Guardian",
    subtitle: "Act 2 Session 2 · Last Directive · Large corrupted celestial · Elite",
    campaignModule: "the-broken-chain",
    tags: ["act-2", "session-2", "last-directive", "elite", "celestial", "party-levels-3-4"],
    defense: { ac: 14, hp: { current: 85, max: 85, temp: 0 }, speed: "0 ft., fly 5 ft" },
    abilities: { str: { score: 16, modifier: 3 }, dex: { score: 12, modifier: 1 }, con: { score: 16, modifier: 3 }, int: { score: 14, modifier: 2 }, wis: { score: 18, modifier: 4 }, cha: { score: 16, modifier: 3 } },
    actions: [
      { id: "soul-guardian-multiattack", name: "Multiattack", kind: "multiattack", cost: "Action", attackCount: 2, attacks: [{ id: "soul-guardian-smite-1", name: "Corrupted Smite", attack: "1d20 + 6", range: "5 ft", damage: "2d8 + 4", critDamage: "4d8 + 4", damageType: "necrotic" }, { id: "soul-guardian-smite-2", name: "Corrupted Smite", attack: "1d20 + 6", range: "5 ft", damage: "2d8 + 4", critDamage: "4d8 + 4", damageType: "necrotic" }], description: "The Guardian makes two Corrupted Smite attacks." },
      { id: "soul-guardian-corrupted-smite", name: "Corrupted Smite", kind: "meleeAttack", cost: "Action", range: "5 ft", attack: "1d20 + 6", damage: "2d8 + 4", critDamage: "4d8 + 4", damageType: "necrotic", description: "+6 to hit. Hit: 13 (2d8 + 4) necrotic damage." },
      { id: "soul-guardian-soul-vomit", name: "Soul Vomit", kind: "save", cost: "Action", range: "15-foot cone", save: "CON", dc: 13, damage: "6d6", damageType: "necrotic", recharge: "Recharge 5-6", description: "Each creature in the area makes DC 13 CON save, taking 21 (6d6) necrotic on failure or half on success. Rattled creatures make this save at disadvantage." }
    ],
    bonusActions: [], reactions: [], legendaryActions: [],
    traits: [
      { id: "soul-guardian-weeping-souls", name: "Weeping Souls Aura", description: "A creature starting its turn within 10 feet must succeed on DC 13 WIS save or be Rattled until start of next turn. Rattled: disadvantage on Wisdom and Constitution saves." },
      { id: "soul-guardian-mad-certainty", name: "Mad Certainty", description: "Immune to Charmed. It genuinely believes it is still doing holy work." }
    ],
    resources: [{ id: "soul-guardian-soul-vomit-recharge", name: "Soul Vomit Recharge", current: 0, max: 1, reset: "Recharge 5-6", note: "Rattled creatures save at disadvantage." }],
    visibility: { defaultMode: "hp-bar", hiddenName: "Broken Guardian", revealedName: "Soul-Gorged Guardian" },
    notes: ["Saving Throws: WIS +7, CHA +6.", "Damage Vulnerabilities: Necrotic.", "Condition Immunities: Charmed, Frightened.", "Senses: Truesight 60 ft., Passive Perception 14."]
  },

  act2S2GraveLight: {
    schema: "fdm/monster-v1",
    id: "act2-s2-grave-light",
    kind: "monster",
    name: "Grave Light",
    subtitle: "Act 2 Session 2 · Last Directive · Tiny corrupted undead wisp · Standard · run 3",
    campaignModule: "the-broken-chain",
    tags: ["act-2", "session-2", "last-directive", "standard", "undead", "wisp", "run-3", "party-levels-3-4"],
    defense: { ac: 19, hp: { current: 12, max: 12, temp: 0 }, speed: "0 ft., fly 50 ft. (hover)" },
    abilities: { str: { score: 1, modifier: -5 }, dex: { score: 28, modifier: 9 }, con: { score: 10, modifier: 0 }, int: { score: 13, modifier: 1 }, wis: { score: 14, modifier: 2 }, cha: { score: 11, modifier: 0 } },
    actions: [{ id: "grave-light-corrupted-shock", name: "Corrupted Shock", kind: "meleeAttack", cost: "Action", range: "5 ft", attack: "1d20 + 4", damage: "1d8", critDamage: "2d8", damageType: "corrupted radiant", description: "+4 to hit, reach 5 ft., one creature. Hit: 4 (1d8) corrupted radiant damage." }],
    bonusActions: [], reactions: [], legendaryActions: [],
    traits: [
      { id: "grave-light-incorporeal", name: "Incorporeal Movement", description: "Can move through creatures and objects as difficult terrain. Nonmagical weapon attacks pass through it and deal no damage. Takes 5 (1d10) force damage if it ends turn inside an object." },
      { id: "grave-light-corrupted-light", name: "Corrupted Light", description: "Sheds dim sickly pale-gold light in a 10-foot radius. Does not interact mechanically with torches or darkness." }
    ],
    resources: [],
    visibility: { defaultMode: "hp-bar", hiddenName: "Grave Light", revealedName: "Grave Light" },
    notes: ["Run 3 in Last Directive.", "Damage Immunities: Lightning, Poison.", "Condition Immunities: Exhaustion, Grappled, Paralyzed, Poisoned, Prone, Restrained, Unconscious.", "Senses: Darkvision 120 ft., Passive Perception 12.", "AC 19 is the wall; 12 HP means one clean magical hit can drop it."]
  },

  thornfangWolf: {
    schema: "fdm/monster-v1",
    id: "act1-thornfang-wolf",
    kind: "monster",
    name: "Thornfang Wolf",
    subtitle: "Act 1 · Wardenwood · Medium beast · Minion",
    campaignModule: "the-broken-chain",
    tags: ["act-1", "woodland", "wardenwood", "thornfang-pack", "beast", "wolf", "minion", "party-levels-1-3"],
    defense: { ac: 13, hp: { current: 18, max: 18, temp: 0 }, speed: "50 ft" },
    abilities: { str: { score: 13, modifier: 1 }, dex: { score: 15, modifier: 2 }, con: { score: 12, modifier: 1 }, int: { score: 3, modifier: -4 }, wis: { score: 12, modifier: 1 }, cha: { score: 6, modifier: -2 } },
    actions: [{ id: "thornfang-wolf-bite", name: "Savage Bite", kind: "meleeAttack", cost: "Action", range: "5 ft", attack: "1d20 + 4", damage: "2d4 + 2", critDamage: "4d4 + 2", damageType: "piercing", hitRider: { save: "STR DC 12", failEffect: "Target is knocked prone." }, description: "+4 to hit, reach 5 ft., one target. Hit: 7 (2d4 + 2) piercing. DC 12 STR save or knocked prone." }],
    bonusActions: [], reactions: [], legendaryActions: [],
    traits: [
      { id: "thornfang-wolf-pack-tactics", name: "Pack Tactics", description: "Advantage on attack rolls against a creature if at least one of the wolf's allies is within 5 feet of it and not incapacitated." },
      { id: "thornfang-wolf-keen", name: "Keen Hearing and Smell", description: "Advantage on Wisdom (Perception) checks that rely on hearing or smell." },
      { id: "thornfang-wolf-forest-strider", name: "Forest-Strider", description: "Thickets, briar, and undergrowth are not difficult terrain for the wolf, and it leaves no tracks in the woods." }
    ],
    resources: [],
    visibility: { defaultMode: "hp-bar", hiddenName: "Patient Wolf", revealedName: "Thornfang Wolf" },
    notes: ["Wardenwood wolf minion. Run in packs of 3-5 led by a Thornfang Packlord.", "Skills: Perception +3, Stealth +4.", "Senses: Darkvision 60 ft., Passive Perception 13."]
  },

  thornfangPacklord: {
    schema: "fdm/monster-v1",
    id: "act1-thornfang-packlord",
    kind: "monster",
    name: "Thornfang Packlord",
    subtitle: "Act 1 · Wardenwood · Large beast · Strong · pack alpha",
    campaignModule: "the-broken-chain",
    tags: ["act-1", "woodland", "wardenwood", "thornfang-pack", "beast", "wolf", "dire", "strong", "party-levels-1-3"],
    // HP tuned 39→33 (Act 1 opener ran long; high variant hit 48, above a dire wolf).
    defense: { ac: 14, hp: { current: 33, max: 33, temp: 0 }, speed: "50 ft" },
    abilities: { str: { score: 17, modifier: 3 }, dex: { score: 15, modifier: 2 }, con: { score: 15, modifier: 2 }, int: { score: 3, modifier: -4 }, wis: { score: 12, modifier: 1 }, cha: { score: 7, modifier: -2 } },
    actions: [{ id: "thornfang-packlord-bite", name: "Rending Bite", kind: "meleeAttack", cost: "Action", range: "5 ft", attack: "1d20 + 5", damage: "2d6 + 3", critDamage: "4d6 + 3", damageType: "piercing", hitRider: { save: "STR DC 13", failEffect: "Target is knocked prone." }, description: "+5 to hit, reach 5 ft., one target. Hit: 10 (2d6 + 3) piercing. DC 13 STR save or knocked prone." }],
    bonusActions: [{ id: "thornfang-packlord-howl", name: "Hunting Howl", kind: "manual", cost: "Bonus Action", range: "30 ft", description: "Each Thornfang Wolf within 30 feet that can hear the Packlord may immediately move up to its speed toward an enemy without provoking opportunity attacks." }],
    reactions: [], legendaryActions: [],
    traits: [
      { id: "thornfang-packlord-pack-tactics", name: "Pack Tactics", description: "Advantage on attack rolls against a creature if at least one ally is within 5 feet of it and not incapacitated." },
      { id: "thornfang-packlord-keen", name: "Keen Hearing and Smell", description: "Advantage on Wisdom (Perception) checks that rely on hearing or smell." },
      { id: "thornfang-packlord-forest-strider", name: "Forest-Strider", description: "Thickets, briar, and undergrowth are not difficult terrain, and the Packlord leaves no tracks in the woods." }
    ],
    resources: [],
    visibility: { defaultMode: "hp-bar", hiddenName: "Great Wolf", revealedName: "Thornfang Packlord" },
    notes: ["Wardenwood dire-wolf alpha. Leads Thornfang Wolves; Hunting Howl repositions the pack.", "Skills: Perception +3, Stealth +4.", "Senses: Darkvision 60 ft., Passive Perception 13."]
  },

  mosshideOwlbear: {
    schema: "fdm/monster-v1",
    id: "act1-mosshide-owlbear",
    kind: "monster",
    name: "Mosshide Owlbear",
    subtitle: "Act 1 · Wardenwood · Forest apex predator · Large monstrosity · Strong · Challenge 3",
    campaignModule: "the-broken-chain",
    tags: ["act-1", "woodland", "wardenwood", "owlbear", "monstrosity", "strong", "challenge-3", "party-levels-1-3"],
    // Owlbear chassis (CR 3): AC 13, 59 HP, STR 20 CON 17, Beak + Claws multiattack, Keen Sight/Smell.
    defense: { ac: 13, hp: { current: 59, max: 59, temp: 0 }, speed: "40 ft" },
    abilities: { str: { score: 20, modifier: 5 }, dex: { score: 12, modifier: 1 }, con: { score: 17, modifier: 3 }, int: { score: 3, modifier: -4 }, wis: { score: 12, modifier: 1 }, cha: { score: 7, modifier: -2 } },
    actions: [
      { id: "mosshide-owlbear-multiattack", name: "Multiattack", kind: "multiattack", cost: "Action", attackCount: 2, attacks: [{ id: "mosshide-owlbear-beak", name: "Beak", attack: "1d20 + 7", range: "5 ft", damage: "1d10 + 5", critDamage: "2d10 + 5", damageType: "piercing" }, { id: "mosshide-owlbear-claws", name: "Raking Claws", attack: "1d20 + 7", range: "5 ft", damage: "2d8 + 5", critDamage: "4d8 + 5", damageType: "slashing" }], description: "The owlbear makes one Beak attack and one Raking Claws attack." },
      { id: "mosshide-owlbear-beak-single", name: "Beak", kind: "meleeAttack", cost: "Action", range: "5 ft", attack: "1d20 + 7", damage: "1d10 + 5", critDamage: "2d10 + 5", damageType: "piercing", description: "+7 to hit, reach 5 ft., one creature. Hit: 10 (1d10 + 5) piercing." },
      { id: "mosshide-owlbear-claws-single", name: "Raking Claws", kind: "meleeAttack", cost: "Action", range: "5 ft", attack: "1d20 + 7", damage: "2d8 + 5", critDamage: "4d8 + 5", damageType: "slashing", description: "+7 to hit, reach 5 ft., one target. Hit: 14 (2d8 + 5) slashing." }
    ],
    bonusActions: [], reactions: [], legendaryActions: [],
    traits: [
      { id: "mosshide-owlbear-keen", name: "Keen Sight and Smell", description: "Advantage on Wisdom (Perception) checks that rely on sight or smell." },
      { id: "mosshide-owlbear-thornhide", name: "Thornhide", description: "Briar and broken bark are matted into the owlbear's pelt. A creature that hits it with a melee attack while within 5 feet takes 2 (1d4) piercing damage." }
    ],
    resources: [],
    visibility: { defaultMode: "hp-bar", hiddenName: "Shape in the Trees", revealedName: "Mosshide Owlbear" },
    notes: ["Built on the Owlbear chassis (CR 3): AC 13, 59 HP, Beak + Claws multiattack.", "Skills: Perception +5.", "Senses: Darkvision 60 ft., Passive Perception 15."]
  },

  greenwoodReaver: {
    schema: "fdm/monster-v1",
    id: "act1-greenwood-reaver",
    kind: "monster",
    name: "Greenwood Reaver",
    subtitle: "Act 1 · Wardenwood · Forest-road raider captain · Medium humanoid · Strong · Challenge 2",
    campaignModule: "the-broken-chain",
    tags: ["act-1", "woodland", "wardenwood", "humanoid", "bandit", "raider", "strong", "challenge-2", "party-levels-1-3"],
    // Bandit Captain chassis (CR 2): AC 15, 65 HP, two scimitar + dagger multiattack, Parry reaction.
    defense: { ac: 15, hp: { current: 65, max: 65, temp: 0 }, speed: "30 ft" },
    abilities: { str: { score: 15, modifier: 2 }, dex: { score: 16, modifier: 3 }, con: { score: 14, modifier: 2 }, int: { score: 11, modifier: 0 }, wis: { score: 11, modifier: 0 }, cha: { score: 14, modifier: 2 } },
    actions: [
      { id: "greenwood-reaver-multiattack", name: "Multiattack", kind: "multiattack", cost: "Action", attackCount: 3, attacks: [{ id: "greenwood-reaver-scimitar-1", name: "Notched Scimitar", attack: "1d20 + 5", range: "5 ft", damage: "1d6 + 3", critDamage: "2d6 + 3", damageType: "slashing" }, { id: "greenwood-reaver-scimitar-2", name: "Notched Scimitar", attack: "1d20 + 5", range: "5 ft", damage: "1d6 + 3", critDamage: "2d6 + 3", damageType: "slashing" }, { id: "greenwood-reaver-dagger", name: "Dagger", attack: "1d20 + 5", range: "20/60 ft", damage: "1d4 + 3", critDamage: "2d4 + 3", damageType: "piercing" }], description: "The Reaver makes two Notched Scimitar attacks and one Dagger attack (melee or thrown)." },
      { id: "greenwood-reaver-scimitar-single", name: "Notched Scimitar", kind: "meleeAttack", cost: "Action", range: "5 ft", attack: "1d20 + 5", damage: "1d6 + 3", critDamage: "2d6 + 3", damageType: "slashing", description: "+5 to hit, reach 5 ft., one target. Hit: 6 (1d6 + 3) slashing." },
      { id: "greenwood-reaver-dagger-single", name: "Dagger", kind: "rangedAttack", cost: "Action", range: "20/60 ft", attack: "1d20 + 5", damage: "1d4 + 3", critDamage: "2d4 + 3", damageType: "piercing", description: "+5 to hit, melee or thrown 20/60 ft., one target. Hit: 5 (1d4 + 3) piercing." }
    ],
    bonusActions: [{ id: "greenwood-reaver-command", name: "Cruel Command", kind: "manual", cost: "Bonus Action", range: "30 ft", description: "One ally within 30 feet that can hear the Reaver can use its reaction to make one weapon attack." }],
    reactions: [{ id: "greenwood-reaver-parry", name: "Parry", kind: "manual", cost: "Reaction", range: "Self", description: "The Reaver adds 2 to its AC against one melee attack that would hit it. To do so, it must see the attacker and be wielding a melee weapon." }],
    legendaryActions: [],
    traits: [
      { id: "greenwood-reaver-woodwise", name: "Woodwise", description: "The Reaver ignores the difficult terrain of thickets and undergrowth, and has advantage on Dexterity (Stealth) checks made to hide in forest cover." }
    ],
    resources: [],
    visibility: { defaultMode: "hp-bar", hiddenName: "Raider Captain", revealedName: "Greenwood Reaver" },
    notes: ["Built on the Bandit Captain chassis (CR 2): AC 15, 65 HP, two scimitar + dagger multiattack, Parry reaction.", "Saving Throws: STR +4, DEX +5, WIS +2.", "Skills: Athletics +4, Deception +4, Stealth +5.", "Senses: Passive Perception 10."]
  },

  act1ThreadbareSpider: {
    schema: "fdm/monster-v1",
    id: "act1-threadbare-spider",
    kind: "monster",
    name: "Threadbare Spider",
    subtitle: "Act 1 · Wardenwood · Spider Nest · Medium aberration (was a beast) · Strong · Challenge 1/2",
    campaignModule: "the-broken-chain",
    // Campaign-original Far Realm seed creature (NOT an SRD reskin) — from broken_chain_act1_statblocks.docx.
    tags: ["act-1", "woodland", "wardenwood", "far-realm", "aberration", "spider", "strong", "challenge-1-2", "party-levels-1"],
    defense: { ac: 13, hp: { current: 22, max: 22, temp: 0 }, speed: "30 ft., climb 30 ft." },
    abilities: { str: { score: 12, modifier: 1 }, dex: { score: 16, modifier: 3 }, con: { score: 12, modifier: 1 }, int: { score: 3, modifier: -4 }, wis: { score: 11, modifier: 0 }, cha: { score: 4, modifier: -3 } },
    actions: [{ id: "threadbare-spider-bite", name: "Bite", kind: "meleeAttack", cost: "Action", range: "5 ft", attack: "1d20 + 5", damage: "1d8 + 3", critDamage: "2d8 + 3", damageType: "piercing", hitRider: { save: "CON DC 11", failEffect: "Take 2 (1d4) poison damage at the start of its next turn." }, description: "+5 to hit, reach 5 ft., one target. Hit: 7 (1d8 + 3) piercing. DC 11 CON save or take 2 (1d4) poison at the start of its next turn." }],
    bonusActions: [], reactions: [], legendaryActions: [],
    traits: [
      { id: "threadbare-spider-wrong-spun-web", name: "Wrong-Spun Web", description: "The nest's webbing is difficult terrain. A creature that enters a webbed square for the first time on a turn must succeed on a DC 11 Dexterity saving throw or have its speed reduced to 0 until the start of its next turn (the strands pull the wrong way). This teaches the party to look before they move." },
      { id: "threadbare-spider-half-step-skitter", name: "Half-Step Skitter", description: "The spider moves a beat out of sync. The first time each round a creature misses it with a melee attack, the spider may move 5 feet without provoking opportunity attacks." },
      { id: "threadbare-spider-wrongness", name: "Far Realm Fingerprint", description: "The first, faintest sign of the same wrongness that produced the Mirage Stalker. The spider is an aberration, not a beast — effects that affect only beasts do not affect it." }
    ],
    resources: [],
    visibility: { defaultMode: "hp-bar", hiddenName: "Spider", revealedName: "Threadbare Spider" },
    notes: ["Campaign-original — NOT an SRD reskin. Act 1 Opening Encounter 1, tone-setter, party level 1. Run 3-4 in the nest (more than 4 gets swingy).", "Skills: Stealth +5.", "Senses: Darkvision 60 ft., Passive Perception 10.", "The web (speed-0 save) teaches the instinct the Mirage Stalker's Phantom Step will demand later."]
  },

  act1SwampAmbusher: {
    schema: "fdm/monster-v1",
    id: "act1-swamp-ambusher",
    kind: "monster",
    name: "Swamp Ambusher",
    subtitle: "Act 1 · Wardenwood · Bandit Swamp Ambush · Medium humanoid · Strong · Challenge 1/2",
    campaignModule: "the-broken-chain",
    // Campaign-original grounded human raiders (NOT an SRD reskin) — from broken_chain_act1_statblocks.docx.
    tags: ["act-1", "woodland", "wardenwood", "humanoid", "bandit", "raider", "strong", "challenge-1-2", "party-levels-1"],
    defense: { ac: 13, hp: { current: 26, max: 26, temp: 0 }, speed: "30 ft. (ignores swamp difficult terrain — see Marsh-Footed)" },
    abilities: { str: { score: 12, modifier: 1 }, dex: { score: 14, modifier: 2 }, con: { score: 14, modifier: 2 }, int: { score: 10, modifier: 0 }, wis: { score: 11, modifier: 0 }, cha: { score: 10, modifier: 0 } },
    actions: [
      { id: "swamp-ambusher-reed-spear", name: "Reed Spear", kind: "meleeAttack", cost: "Action", range: "5 ft or 20/60 ft", attack: "1d20 + 3", damage: "1d8 + 2", critDamage: "2d8 + 2", damageType: "piercing", description: "Melee or thrown. +3 to hit, reach 5 ft. or range 20/60 ft., one target. Hit: 6 (1d8 + 2) piercing." },
      { id: "swamp-ambusher-net", name: "Net (one Ambusher carries)", kind: "rangedAttack", cost: "Action", range: "5/15 ft", attack: "1d20 + 4", description: "Ranged. Range 5/15 ft., one Large or smaller creature. On a hit, the target is Restrained until it frees itself (DC 10 STR check as an action) or the net is destroyed (AC 10, 5 slashing; immune to bludgeoning/poison/psychic). Only one Ambusher carries a net." }
    ],
    bonusActions: [], reactions: [], legendaryActions: [],
    traits: [
      { id: "swamp-ambusher-marsh-footed", name: "Marsh-Footed", description: "The Ambusher ignores difficult terrain created by mud, water, or reeds. The party does not — the bandits flow through the swamp while the party slogs." },
      { id: "swamp-ambusher-ambush-instinct", name: "Ambush Instinct", description: "In the first round of combat, the Ambusher has advantage on attack rolls against any creature that hasn't yet taken a turn, and deals an extra 3 (1d6) damage on a hit." }
    ],
    resources: [],
    visibility: { defaultMode: "hp-bar", hiddenName: "Bandit", revealedName: "Swamp Ambusher" },
    notes: ["Campaign-original — NOT an SRD reskin. Act 1 Opening Encounter 2. Grounded human threat, no supernatural element. Run 4-5 with terrain.", "Skills: Stealth +4, Survival +2.", "Senses: Passive Perception 10.", "Built around terrain advantage — force the fight onto solid ground. The Net teaches handling control before the Mirage Stalker's knockdown does."]
  },

  missingFieldStressTest: {
    schema: "fdm/actor-v1",
    kind: "monster",
    subtitle: "Validation stress test",
    defense: {
      hp: {
        max: 22
      }
    },
    actions: [
      {
        damage: "1d6 + 2",
        description: "This action intentionally has no name so the workbench warning panel can prove it does not fail silently."
      }
    ],
    traits: [
      {
        name: "Incomplete Trait"
      }
    ]
  }
} as const;

export type SampleMonsterKey = keyof typeof sampleMonsterJcons;
