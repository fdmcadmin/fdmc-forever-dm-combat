/**
 * AUTHORED CAMPAIGN CONTENT — GENERATED FILE. DO NOT EDIT BY HAND.
 *
 * Written by `scripts/fold-authoring.mjs` from an author export produced in the app
 * (DM panel → Export campaign authoring). Hand edits are lost on the next fold.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The base library is CODE. A browser extension cannot write its own source, so content
 * authored in the app previously had nowhere to go but `localStorage`, where it belonged to
 * one browser and died with a cleared cache. Authoring a whole act that way loses the act.
 *
 * This file closes the loop WITHOUT letting a generated blob rewrite hand-written source:
 * the bundled libraries stay authored by hand, this file is regenerated wholesale, and the
 * two are merged by id at module load. An author edit to a bundled creature replaces it; a
 * new creature is appended; nothing hand-written is ever rewritten by a tool.
 *
 * PROVENANCE, NOT PROTECTION
 * --------------------------
 * `AUTHORED_DIGEST` fingerprints the content below as it shipped. It exists so a local copy
 * claiming to BE campaign content can be checked against what was actually published — see
 * `verifyCampaignProvenance`. It is not DRM and cannot be: anything running in a browser can
 * be edited by the person running it. What it does guarantee is that a local edit cannot
 * PASS AS authored campaign content, and that no local edit reaches anyone else — the
 * canonical library is whatever is in the build, and only the author can push a build.
 */

import type { MainMonsterTemplate } from "../../core/monsters/runtime/mainMonsterRuntime";
import type { EquipmentItem } from "../../core/ui/EquipmentBagEditor";
import type { EncounterDefinition } from "../../core/monsters/encounterLibrary";

/** Creatures authored in-app. Replaces a bundled creature by templateId, or adds a new one. */
export const AUTHORED_MONSTERS: MainMonsterTemplate[] = [
  {
    "templateId": "broken-chain:act3:veil-torn-dragon:v1",
    "name": "Veil-Torn Dragon",
    "encounterId": "act3-e9-gate-iii-veil-torn-dragon",
    "encounterLabel": "Act 3 E9 - Gate III: The Veil-Torn Dragon",
    "stats": {
      "kind": "dragon",
      "ac": 19,
      "maxHp": 195,
      "speed": "40 ft.; Broken Lift only",
      "defenses": [
        {
          "name": "Legendary Resistance (1/Day)",
          "ehpMultiplier": 1.042458,
          "rule": "Legendary Resistance - 1 use",
          "note": "Workbook: Legendary Resistance - 1 use (+0.042458), exact."
        }
      ],
      "attacksPerTurn": 3,
      "size": "Huge",
      "classification": "mid-boss",
      "archetype": "commander",
      "legendaryPerRound": 1,
      "skills": [
        {
          "label": "Perception",
          "modifier": 8
        }
      ],
      "cr": 8
    },
    "abilities": [
      {
        "label": "STR",
        "value": "16 (+3)"
      },
      {
        "label": "DEX",
        "value": "16 (+3)"
      },
      {
        "label": "CON",
        "value": "20 (+5)",
        "save": 9
      },
      {
        "label": "INT",
        "value": "20 (+5)"
      },
      {
        "label": "WIS",
        "value": "20 (+5)",
        "save": 8
      },
      {
        "label": "CHA",
        "value": "22 (+6)",
        "save": 9
      }
    ],
    "traits": [
      {
        "name": "Legendary Resistance (1/Day)",
        "kind": "trait",
        "text": "If the dragon fails a saving throw, it can choose to succeed instead."
      },
      {
        "name": "Moonmark (2/Day)",
        "kind": "trait",
        "save": "DEX DC 17",
        "text": "Action: choose a point within 60 ft.; a 15-ft. radius fills with pale motes until the start of the dragon’s next turn. Creatures of the dragon’s choice in the area make a DC 17 Dexterity save. On a failure, they cannot benefit from invisibility and the first attack against them before the effect ends has advantage. No damage."
      },
      {
        "name": "Blind SIght",
        "kind": "trait",
        "range": "30 FT"
      },
      {
        "name": "Darkvision",
        "kind": "trait",
        "range": "120"
      }
    ],
    "actions": [
      {
        "name": "Broken Lift (Recharge 5–6)",
        "kind": "action",
        "economyCost": "bonus",
        "recharge": "5-6",
        "text": "Bonus Action: launch and glide up to 40 ft., ignoring ground terrain and opportunity attacks. It must end on a surface that supports it; it has no standing fly speed."
      },
      {
        "name": "Bite",
        "kind": "attack",
        "roll": "1d20 + @ATK",
        "damage": "2d10 + @STR piercing + 2d6 radiant",
        "text": "Hit: 14 (2d10 + 3) piercing damage plus 7 (2d6) cold damage"
      },
      {
        "name": "Claw",
        "kind": "attack",
        "roll": "1d20 + @ATK",
        "damage": "2d6 + @STR",
        "text": "Melee Weapon Attack: +9 to hit, reach 5 ft.; Hit: 12 (2d6 + 3) slashing."
      },
      {
        "name": "Veilstorm Breath",
        "kind": "action",
        "save": "DEX",
        "recharge": "5-6",
        "text": "90-ft. line, 10 ft. wide; DC 17 Dexterity save; 36 (8d8) lightning damage on failure, half on success. ",
        "range": "90 FT, 10 FT Wide",
        "damage": "8d8"
      },
      {
        "name": "Tail Sweep",
        "kind": "action",
        "roll": "1d20 + @ATK",
        "damage": "1d8 + @STR",
        "legendaryCost": 1,
        "text": "Once per round at the end of another creature’s turn, make one Tail attack: +9 to hit, reach 15 ft.; Hit: 9 (1d8 + 5) bludgeoning, and the dragon may move 5 ft. without provoking from the target hit."
      }
    ],
    "reactions": [],
    "resources": [],
    "notes": [
      "A real Fey-touched dragon caught at the point where native belonging has become control. Its wings still know how to fly. The Wood has started deciding when they open.",
      "LAIR ACTIONS (not yet playable from the tracker — a lair is a SUMMON at initiative 20, and the summon mechanism is unbuilt). At initiative count 20 (losing ties), choose one option. The same option cannot be used on consecutive rounds. Ground Remembers Wrong. Choose up to three 10-ft. squares of natural ground within 90 ft. Creatures there make a DC 17 Strength save or slide up to 10 ft. to a safe space chosen by the lair. Branches Close. A 15-ft.-radius sphere within 90 ft. becomes heavily obscured by overlapping leaves and wrong-angle branches until the next initiative count 20. Borrowed Sky. Choose one creature within 90 ft. The lair moves it up to 20 ft. horizontally and 10 ft. vertically, placing it safely on a surface. An unwilling creature can resist with a DC 17 Strength save."
    ],
    "visibility": {
      "defaultState": "hp-bar",
      "hiddenName": "Veil-Torn Dragon",
      "revealedName": "Veil-Torn Dragon"
    },
    "dmEdited": {
      "at": "2026-08-25T23:35:23.635Z"
    }
  },
  {
    "templateId": "broken-chain:boss:mirage-stalker:v1",
    "name": "Mirage Stalker",
    "encounterId": "act1-boss",
    "encounterLabel": "Act 1 Boss",
    "stats": {
      "kind": "unspecified",
      "ac": 13,
      "maxHp": 100,
      "attacksPerTurn": 2,
      "speed": "50 ft",
      "classification": "act-boss",
      "defenses": [
        {
          "name": "Phantom Step",
          "ehpMultiplier": 1.18,
          "provenance": "uncalibrated",
          "note": "Attacks against it have disadvantage until it takes damage in a round, so the party's first swing each round is much likelier to miss. Roughly one lost attack per round early in the fight."
        },
        {
          "name": "All attacks at disadvantage - 1 round",
          "ehpMultiplier": 1.1294156939022204,
          "note": "Read from \"Phantom Step\" (trait) on \"attack rolls against it have disadvantage\"."
        },
        {
          "name": "Condition immunity",
          "ehpMultiplier": 1,
          "note": "Read from \"Condition Immunity - Frightened\" (trait) on \"immune to a condition\". The workbook calibrates this rule as UNPRICED — it is a real trait with no published weight."
        }
      ]
    },
    "abilities": [
      {
        "label": "STR",
        "value": "19 (+4)"
      },
      {
        "label": "DEX",
        "value": "14 (+2)"
      },
      {
        "label": "CON",
        "value": "16 (+3)"
      },
      {
        "label": "INT",
        "value": "4 (-3)"
      },
      {
        "label": "WIS",
        "value": "12 (+1)"
      },
      {
        "label": "CHA",
        "value": "6 (-2)"
      }
    ],
    "traits": [
      {
        "name": "Phantom Step",
        "kind": "trait",
        "text": "When the Stalker moves, it leaves an afterimage at its departure point. Attack rolls against the Stalker have disadvantage until it takes damage that round. Attacks targeting the afterimage auto-miss and trigger Phantom Lunge. Usable twice per fight total. Does not trigger the round the Stalker takes damage. Recharge roll/control belongs on this trait/resource, not on Phantom Charge."
      },
      {
        "name": "Wrong Geometry",
        "kind": "trait",
        "text": "The Stalker does not read as a natural creature. Effects that specifically target beasts do not affect it."
      },
      {
        "name": "Condition Immunity - Frightened",
        "kind": "trait",
        "text": "The Stalker is immune to the frightened condition."
      }
    ],
    "actions": [
      {
        "name": "Gore",
        "kind": "attack",
        "roll": "1d20 + @ATK",
        "damage": "2d8 + @MAIN",
        "text": "Melee Weapon Attack: +6 to hit, reach 10 ft., one target. Hit: 13 (2d8 + 4) piercing damage. The strike lands a half-second before the creature appears to move."
      },
      {
        "name": "Hooves",
        "kind": "attack",
        "roll": "1d20 + @ATK",
        "damage": "2d6 + @MAIN",
        "text": "Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 11 (2d6 + 4) bludgeoning damage. The hooves connect with a sound that is wrong."
      },
      {
        "name": "Phantom Charge",
        "kind": "attack",
        "roll": "1d20 + @ATK",
        "damage": "2d8 + @MAIN",
        "save": "STR DC 14",
        "recharge": "4-6",
        "text": "Recharges after a Multiattack turn. Full Action — replaces Multiattack. Move up to its speed in a straight line and make one Gore attack at any point. If it moved 20+ ft. and hits, DC 14 STR save or the target is knocked prone and pushed 10 ft."
      },
      {
        "name": "Phase Shift (Bonus Action)",
        "kind": "action",
        "text": "Flickers up to 15 ft., no opportunity attacks. The afterimage stays in its old space. This does NOT reset Phantom Step's disadvantage — it stacks a stale image on top of the displacement."
      }
    ],
    "reactions": [
      {
        "name": "Phantom Lunge",
        "kind": "reaction",
        "roll": "1d20 + @ATK",
        "damage": "2d6 + @MAIN",
        "text": "When a creature within 10 feet misses because of Phantom Step's afterimage, the Stalker can make one Hollow Stamp attack against that creature."
      }
    ],
    "resources": [
      {
        "id": "mirage-stalker-phantom-step-uses",
        "name": "Phantom Step Uses",
        "current": 2,
        "max": 2,
        "reset": "fight",
        "note": "Two uses per fight total."
      },
      {
        "id": "mirage-stalker-phantom-step-recharge",
        "name": "Phantom Step Recharge",
        "current": 0,
        "max": 1,
        "reset": "Recharge 5-6",
        "note": "Roll at the start of the Stalker turn if needed."
      },
      {
        "id": "mirage-stalker-phantom-charge-recharge-note",
        "name": "Phantom Charge Condition",
        "current": 1,
        "max": 1,
        "reset": "Recharge 5-6",
        "note": "Requires at least 20 ft. of straight-line movement before the hit rider applies."
      }
    ],
    "notes": [
      "Act 1 Final Boss. Huge aberration, formerly a giant elk.",
      "Saving Throws: STR +6, CON +5.",
      "Skills: Perception +3.",
      "Condition Immunities: Frightened.",
      "Senses: Darkvision 60 ft., Passive Perception 13.",
      "Proficiency Bonus: +2."
    ],
    "visibility": {
      "defaultState": "condition",
      "hiddenName": "Something Wrong in the Keep",
      "revealedName": "Mirage Stalker"
    },
    "dmEdited": {
      "at": "2026-08-26T03:40:04.686Z"
    }
  },
  {
    "templateId": "broken-chain:act2-s1:pale-stalker:v1",
    "name": "Pale Stalker",
    "encounterId": "act2-s1-e1-hollow-pack",
    "encounterLabel": "Act 2 S1 E1 - Hollow Pack",
    "stats": {
      "kind": "beast",
      "ac": 13,
      "maxHp": 75,
      "speed": "50 ft",
      "classification": "strong",
      "defenses": [
        {
          "name": "Ambush + Apex Unleashed",
          "ehpMultiplier": 1.4,
          "provenance": "uncalibrated",
          "note": "Waits out round 1 and only commits on the round-2 timer, so the party's opening burst lands on chaff; Cold Breath unlocks when the first Pack Hunter drops. v12 analytic 1.48 rds × 1.27 dynamics."
        }
      ],
      "cr": 2
    },
    "abilities": [
      {
        "label": "STR",
        "value": "18 (+4)"
      },
      {
        "label": "DEX",
        "value": "13 (+1)"
      },
      {
        "label": "CON",
        "value": "14 (+2)"
      },
      {
        "label": "INT",
        "value": "7 (-2)"
      },
      {
        "label": "WIS",
        "value": "12 (+1)"
      },
      {
        "label": "CHA",
        "value": "8 (-1)"
      }
    ],
    "traits": [
      {
        "name": "Keen Hearing and Smell",
        "kind": "trait",
        "text": "Advantage on Wisdom (Perception) checks that rely on hearing or smell."
      },
      {
        "name": "Pack Tactics",
        "kind": "trait",
        "text": "Advantage on attack rolls against a creature if at least one ally is within 5 feet of it and not incapacitated."
      },
      {
        "name": "Apex Unleashed",
        "kind": "trait",
        "text": "While both Pack Hunters are alive, Cold Breath is locked. When the first Pack Hunter dies, Cold Breath becomes available immediately and Exploit Weakness increases."
      },
      {
        "name": "Exploit Weakness",
        "kind": "trait",
        "text": "When attacking a prone target, a target with reduced speed, or a creature damaged by another creature this round, add cold damage on hit."
      }
    ],
    "actions": [
      {
        "name": "Bite",
        "kind": "attack",
        "roll": "1d20 + @ATK",
        "damage": "2d6 + @MAIN",
        "save": "STR DC 14",
        "text": "Target is knocked prone on a failed Strength save."
      },
      {
        "name": "Cold Breath",
        "kind": "action",
        "damage": "4d8",
        "save": "DEX DC 12",
        "text": "Recharge 5-6; locked while both Pack Hunters are alive. Each creature in a 15-foot cone takes cold damage on a failed save, or half on success."
      }
    ],
    "reactions": [],
    "resources": [
      {
        "id": "pale-stalker-cold-breath-recharge",
        "name": "Cold Breath",
        "current": 0,
        "max": 1,
        "reset": "Recharge 5-6",
        "note": "Locked until first Pack Hunter dies."
      }
    ],
    "notes": [
      "Damage Immunities: Cold.",
      "Skills: Perception +3, Stealth +3.",
      "Senses: Darkvision 60 ft., Passive Perception 13.",
      "Understands Common but does not speak it."
    ],
    "visibility": {
      "defaultState": "hp-bar",
      "hiddenName": "Patient Wolf",
      "revealedName": "Pale Stalker"
    },
    "dmEdited": {
      "at": "2026-08-26T03:40:57.199Z"
    }
  }
];

/** Equipment authored in-app — including unpicked Gift chassis. Replaces or adds by id. */
export const AUTHORED_EQUIPMENT: EquipmentItem[] = [
  {
    "id": "bc-tools-repairs",
    "name": "Tools / Repairs",
    "type": "gear",
    "description": "A tool set, a repair, or replacement field kit. Write in what it actually is.",
    "mechanicsText": "Basic spending line. Covers one tool set, one repair, or one replacement of field gear — name it when you buy it (leatherworker's tools, smith's kit, re-stitched pack). The app deducts the gold; the note records what the party actually bought.",
    "isUsable": false,
    "value": "15gp",
    "dmNote": "Ledger line, not a catalog. Buy it again for each tool set or repair.",
    "isLocked": true
  },
  {
    "id": "bc-rations-supplies",
    "name": "Rations / Survival Supplies",
    "type": "gear",
    "description": "A travel leg's food and cold-weather supplies. Write in what it actually is.",
    "mechanicsText": "Basic spending line. Restocks one travel leg of rations and survival supplies. Usable meat recovered from a hunt can offset one purchase by 5gp instead of generating coin.",
    "isUsable": false,
    "value": "10gp",
    "dmNote": "Ledger line, not a catalog. Buy it again each time the party restocks.",
    "isLocked": true
  },
  {
    "id": "bc-farwatch-glass",
    "name": "Farwatch Glass",
    "type": "magic",
    "description": "A thumb-sized oval of smoke-dark glass with a silver thread trapped inside it. The thread drifts when the glass is idle and snaps toward whatever the glass is remembering when awakened. Tags: A1 · Utility",
    "mechanicsText": "Once per long rest, as a Magic action, choose one creature or object you can see within 60 feet. For the next 10 minutes, while that target is within 300 feet of you and on the same plane of existence, the silver thread points in its direction. The glass gives no information about distance or obstacles.",
    "isUsable": false,
    "value": "55gp",
    "act": "Act 1",
    "sourceEncounter": "ALDRIC'S FINAL STOCK",
    "charges": {
      "max": 1,
      "reset": "longRest"
    },
    "convergence": {
      "role": "input",
      "enabled": true,
      "mechanicalTag": "Utility",
      "actLabel": "A1"
    },
    "isLocked": false
  },
  {
    "id": "bc-slipstone",
    "name": "Slipstone",
    "type": "magic",
    "description": "A flat piece of violet-grey stone whose two faces never seem perfectly aligned. Turn it in the hand and one edge appears to arrive a fraction of a heartbeat before the rest. Tags: A1 · Movement",
    "mechanicsText": "Once per short or long rest, you can use a Bonus Action to move up to 10 feet without provoking opportunity attacks. This movement ignores difficult terrain, but you cannot pass through creatures, objects, or spaces you could not normally enter.",
    "isUsable": false,
    "value": "60gp",
    "act": "Act 2",
    "sourceEncounter": "ALDRIC'S FINAL STOCK",
    "charges": {
      "max": 1,
      "reset": "shortRest"
    },
    "convergence": {
      "role": "input",
      "enabled": true,
      "mechanicalTag": "Movement",
      "actLabel": "A1"
    },
    "isLocked": true
  },
  {
    "id": "bc-rootheart-seed",
    "name": "Rootheart Seed",
    "type": "magic",
    "description": "A black seed the size of a thumbnail, veined with dull green-gold. It is almost weightless until the ground shifts beneath its bearer, when it becomes suddenly and impossibly heavy. Tags: A1 · Stability",
    "mechanicsText": "Once per long rest, when an effect would knock you prone or move you against your will, you can use your Reaction to either remain standing or reduce the forced movement by up to 10 feet.",
    "isUsable": false,
    "value": "50gp",
    "act": "Act 2",
    "sourceEncounter": "ALDRIC'S FINAL STOCK",
    "charges": {
      "max": 1,
      "reset": "longRest"
    },
    "convergence": {
      "role": "input",
      "enabled": true,
      "mechanicalTag": "Stability",
      "actLabel": "A1"
    },
    "isLocked": true
  },
  {
    "id": "tbc-thornback-hatchet",
    "name": "Thornback Hatchet",
    "type": "weapon",
    "category": "Melee One-Handed",
    "description": "Frontier-forged, the head wrapped in hardwood from the deep canopy. The grip has been re-wrapped twice by different hands. Someone carried this a long way before you.",
    "mechanicsText": "+1 to attack and damage rolls. This weapon's damage counts as magical.",
    "isUsable": false,
    "attack": "1d20+@PROF+@STR+1",
    "damage": "1d6+@STR+1",
    "crit": "2d6+@STR+1",
    "mastery": "Vex",
    "act": "Act 2",
    "sourceEncounter": "A1 The Creekside Den",
    "isLocked": true
  },
  {
    "id": "tbc-frontier-greataxe",
    "name": "Frontier Greataxe",
    "type": "weapon",
    "category": "Melee Two-Handed",
    "description": "The head is heavier than standard, re-tempered in the field by someone who knew what they were doing. The haft is straight-grained hardwood from deep in the canopy. It has been sharpened recently.",
    "mechanicsText": "+1 to attack and damage rolls. This weapon's damage counts as magical.",
    "isUsable": false,
    "attack": "1d20+@PROF+@STR+1",
    "damage": "1d12+@STR+1",
    "crit": "2d12+@STR+1",
    "mastery": "Cleave",
    "act": "Act 2",
    "sourceEncounter": "A1 The Creekside Den",
    "isLocked": true
  },
  {
    "id": "tbc-briarfang-rapier",
    "name": "Briarfang Rapier",
    "type": "weapon",
    "category": "Finesse",
    "description": "Slender, balanced for the space between trees. The blade is narrow enough to thread between branches without catching. Whoever made this knew the forest.",
    "mechanicsText": "+1 to attack and damage rolls. This weapon's damage counts as magical.",
    "isUsable": false,
    "attack": "1d20+@PROF+@DEX+1",
    "damage": "1d8+@DEX+1",
    "crit": "2d8+@DEX+1",
    "mastery": "Vex",
    "act": "Act 1",
    "sourceEncounter": "A1 The Creekside Den",
    "isLocked": false
  },
  {
    "id": "tbc-canopy-bow",
    "name": "Canopy Bow",
    "type": "weapon",
    "category": "Ranged",
    "description": "Strung with gut and finished with bark lacquer. The draw is light but the release is clean — made for shooting through branches, not across open ground.",
    "mechanicsText": "+1 to attack and damage rolls. This weapon's damage counts as magical.",
    "isUsable": false,
    "attack": "1d20+@PROF+@DEX+1",
    "damage": "1d6+@DEX+1",
    "crit": "2d6+@DEX+1",
    "mastery": "Vex",
    "act": "Act 2",
    "sourceEncounter": "A1 The Creekside Den",
    "isLocked": true
  },
  {
    "id": "tbc-rootknot-staff",
    "name": "Rootknot Staff",
    "isSpellFocus": true,
    "type": "magic",
    "description": "A walking staff that doubles as a weapon and a focus. The knot at the top is tied in a pattern no living tradition teaches.",
    "mechanicsText": "Can be used as a spellcasting focus. +1 to spell attack rolls and spell save DC. Can also be wielded as a +1 quarterstaff.",
    "isUsable": false,
    "attack": "1d20+@PROF+@STR+1",
    "damage": "1d6+@STR+1",
    "crit": "2d6+@STR+1",
    "mastery": "Topple",
    "spellFocusAttack": "+1",
    "spellFocusDamage": "+1",
    "spellFocusSaveDc": "+1",
    "act": "Act 2",
    "sourceEncounter": "A1 The Creekside Den",
    "isLocked": true
  },
  {
    "id": "tbc-ironbark-plate",
    "name": "Ironbark Plate",
    "type": "armor",
    "description": "Plates of compressed bark layered over iron backing. It shouldn't work but the bark is harder than iron and the whole assembly is lighter than it looks.",
    "mechanicsText": "AC 14. You have advantage on saving throws against being frightened.",
    "isUsable": false,
    "ac": "14",
    "act": "Act 2",
    "sourceEncounter": "A1 The Creekside Den",
    "isLocked": true
  },
  {
    "id": "tbc-huntsman-s-brigandine",
    "name": "Huntsman's Brigandine",
    "type": "armor",
    "description": "Assembled from plates of cured hide over a canvas backing. The hide is from something large that frontier hunters stopped naming. It fits like it remembers a different body.",
    "mechanicsText": "AC 14 + DEX modifier (max 2). You have advantage on Wisdom (Perception) checks.",
    "isUsable": false,
    "ac": "14 + DEX (max 2)",
    "act": "Act 2",
    "sourceEncounter": "A1 The Creekside Den",
    "isLocked": true
  },
  {
    "id": "tbc-tracker-s-wrap",
    "name": "Tracker's Wrap",
    "type": "armor",
    "description": "Stitched tight enough to move in and loose enough to breathe. Someone added strips of dark fabric at the shoulders and forearms — not decoration, camouflage. Made for someone who needed to not be seen.",
    "mechanicsText": "AC 11 + DEX modifier. You have advantage on Dexterity (Stealth) checks while wearing this armor.",
    "isUsable": false,
    "ac": "11 + DEX",
    "act": "Act 2",
    "sourceEncounter": "A1 The Creekside Den",
    "isLocked": true
  },
  {
    "id": "tbc-pathfinder-s-token",
    "name": "Pathfinder's Token",
    "type": "magic",
    "description": "A carved disc of dense wood worn at the belt. It pulls faintly in the direction of open ground, the way a compass finds north. Tags: A1 · Movement",
    "mechanicsText": "While worn, you ignore difficult terrain caused by natural growth — mud, roots, undergrowth, and shallow water.",
    "isUsable": false,
    "act": "Act 2",
    "sourceEncounter": "A1 The Creekside Den",
    "convergence": {
      "role": "input",
      "enabled": true,
      "mechanicalTag": "Movement",
      "actLabel": "A1"
    },
    "isLocked": true
  },
  {
    "id": "tbc-canopy-eye",
    "name": "Canopy Eye",
    "type": "magic",
    "description": "A lens of polished amber in a bone frame. Held to the eye it reads the forest honestly — distances feel true, hidden things feel closer to the surface. Tags: A1 · Utility",
    "mechanicsText": "Once per short or long rest, you can use a Bonus Action to make a Wisdom (Perception) check to locate a concealed creature or object.",
    "isUsable": false,
    "act": "Act 2",
    "sourceEncounter": "A1 The Creekside Den",
    "charges": {
      "max": 1,
      "reset": "shortRest"
    },
    "convergence": {
      "role": "input",
      "enabled": true,
      "mechanicalTag": "Utility",
      "actLabel": "A1"
    },
    "isLocked": true
  },
  {
    "id": "tbc-stillstep-blade",
    "name": "Stillstep Mace",
    "type": "weapon",
    "category": "Melee One-Handed",
    "description": "Taken from a creature that was never quite where it appeared. The head reads as something other than steel.",
    "mechanicsText": "+1 to attack and damage rolls. This weapon's damage counts as magical for the purpose of overcoming resistance and immunity to nonmagical damage. Once per short or long rest, immediately after you hit a creature with this weapon, you can move up to 10 feet without provoking opportunity attacks.",
    "isUsable": false,
    "attack": "1d20+@PROF+@STR+1",
    "damage": "1d6+@STR+1",
    "crit": "2d6+@STR+1",
    "mastery": "Sap",
    "act": "Act 2",
    "sourceEncounter": "A1 The Ruined Keep",
    "charges": {
      "max": 1,
      "reset": "shortRest"
    },
    "isLocked": true
  },
  {
    "id": "tbc-splitwood-maul",
    "name": "Splitwood Maul",
    "type": "weapon",
    "category": "Melee Two-Handed",
    "description": "Carved from a tree split at the root by something that wasn't lightning. Frontier folk leave split trees alone.",
    "mechanicsText": "+1 to attack and damage rolls. Once per long rest, when you hit a Large or smaller creature with this weapon, you can push it up to 10 feet directly away from you.",
    "isUsable": false,
    "attack": "1d20+@PROF+@STR+1",
    "damage": "2d6+@STR+1",
    "crit": "4d6+@STR+1",
    "mastery": "Topple",
    "act": "Act 2",
    "sourceEncounter": "A1 The Ruined Keep",
    "charges": {
      "max": 1,
      "reset": "longRest"
    },
    "isLocked": true
  },
  {
    "id": "tbc-phantom-cord-dagger",
    "name": "Phantom Cord Dagger",
    "type": "weapon",
    "category": "Finesse",
    "description": "Wrapped in sinew from something that didn't stay in one place. The cord pulls faintly toward whatever the blade last cut.",
    "mechanicsText": "+1 to attack and damage rolls. When you hit a creature, you know its exact location until the start of your next turn, and it can't be hidden from you during that time.",
    "isUsable": false,
    "attack": "1d20+@PROF+@DEX+1",
    "damage": "1d4+@DEX+1",
    "crit": "2d4+@DEX+1",
    "mastery": "Nick",
    "act": "Act 2",
    "sourceEncounter": "A1 The Ruined Keep",
    "isLocked": true
  },
  {
    "id": "tbc-hollow-elk-bow",
    "name": "Hollow Elk Bow",
    "type": "weapon",
    "category": "Ranged",
    "description": "Strung from the antlers of something the hunters stopped naming. The string hums a note just below hearing.",
    "mechanicsText": "+1 to attack and damage rolls. Attacks made with this bow ignore half cover.",
    "isUsable": false,
    "attack": "1d20+@PROF+@DEX+1",
    "damage": "1d6+@DEX+1",
    "crit": "2d6+@DEX+1",
    "mastery": "Vex",
    "act": "Act 2",
    "sourceEncounter": "A1 The Ruined Keep",
    "isLocked": true
  },
  {
    "id": "tbc-the-staring-knot",
    "name": "Staring-Knot Wand",
    "effect": {
      "type": "reroll",
      "rerollMethod": "reroll",
      "condition": "a creature succeeded on a save against your spell — it rerolls"
    },
    "isSpellFocus": true,
    "spellFocusAttack": "+1",
    "spellFocusDamage": "+1",
    "spellFocusSaveDc": "+1",
    "type": "magic",
    "description": "A short length of pale wood, the grain spiralling to a knot at the tip. Sight along it and the tip never sits quite where your hand says it should. The knot has a centre, and the centre has a way of being aimed back at you.",
    "mechanicsText": "Can be used as a spellcasting focus. The wand has 1 charge. When a creature succeeds on a saving throw against a spell you cast, you can expend the charge to force that creature to reroll the save; it must use the new result. The wand regains its charge when you finish a long rest.",
    "isUsable": false,
    "act": "Act 2",
    "sourceEncounter": "A1 The Ruined Keep",
    "charges": {
      "max": 1,
      "reset": "longRest"
    },
    "isLocked": true
  },
  {
    "id": "tbc-splitgrain-vest",
    "name": "Splitgrain Vest",
    "type": "armor",
    "description": "Stitched from hide that died confused about where it was. The leather shows two grain directions at once.",
    "mechanicsText": "AC 11 + DEX modifier. You have advantage on saving throws against being frightened.",
    "isUsable": false,
    "ac": "11 + DEX",
    "act": "Act 2",
    "sourceEncounter": "A1 The Ruined Keep",
    "isLocked": true
  },
  {
    "id": "tbc-ashwood-brigandine",
    "name": "Ashwood Brigandine",
    "type": "armor",
    "description": "Plated with bark from the corruption's edge, where the wood hardened wrong — denser than any living tree.",
    "mechanicsText": "AC 14 + DEX modifier (max 2). Once per long rest, when you are hit by an attack, you can use your reaction to reduce that attack's damage by 1d6.",
    "isUsable": true,
    "damage": "1d6",
    "ac": "14 + DEX (max 2)",
    "act": "Act 1",
    "sourceEncounter": "A1 The Ruined Keep",
    "charges": {
      "max": 1,
      "reset": "longRest"
    },
    "isLocked": false,
    "unlockSnapshot": "{\"ac\":\"14 + DEX (max 2)\",\"act\":\"Act 2\",\"charges\":{},\"damage\":\"1d6\",\"description\":\"Plated with bark from the corruption's edge, where the wood hardened wrong — denser than any living tree.\",\"id\":\"tbc-ashwood-brigandine\",\"isUsable\":true,\"mechanicsText\":\"AC 14 + DEX modifier (max 2). Once per long rest, when you are hit by an attack, you can use your reaction to reduce that attack's damage by 1d6.\",\"name\":\"Ashwood Brigandine\",\"sourceEncounter\":\"MIRAGE STALKER\",\"type\":\"armor\"}"
  },
  {
    "id": "tbc-hollowstep-plate",
    "name": "Hollowstep Plate",
    "type": "armor",
    "description": "Hammered from fort-armory iron, re-tempered in the field. It walks quieter than iron should — as if the ground isn't sure you're standing on it.",
    "mechanicsText": "AC 16. You don't have disadvantage on Dexterity (Stealth) checks while wearing this armor.",
    "isUsable": false,
    "ac": "16",
    "act": "Act 2",
    "sourceEncounter": "A1 The Ruined Keep",
    "isLocked": true
  },
  {
    "id": "tbc-displaced-ward-brooch",
    "name": "Displaced Ward Brooch",
    "type": "magic",
    "description": "A Ward field brooch recovered from the ruin. The enamel is cracked and the pin is bent — whatever happened here did not spare the equipment. Tags: A1 · Defense",
    "mechanicsText": "When you take force damage, you can use your Reaction to reduce that damage by 1d6. Once used, this property cannot be used again until you finish a long rest.",
    "isUsable": true,
    "damage": "1d6",
    "act": "Act 2",
    "sourceEncounter": "A1 The Ruined Keep",
    "charges": {
      "max": 1,
      "reset": "longRest"
    },
    "convergence": {
      "role": "input",
      "enabled": true,
      "mechanicalTag": "Defense",
      "actLabel": "A1"
    },
    "isLocked": true
  },
  {
    "id": "tbc-pack-sense-totem",
    "name": "Pack-Sense Totem",
    "type": "magic",
    "description": "A small carved figure that feels heavier than it should. It hums faintly when held by someone in a group — quieter when alone. Tags: A1 · Stability",
    "mechanicsText": "While worn, you have advantage on saving throws against being knocked prone.",
    "isUsable": false,
    "act": "Act 2",
    "sourceEncounter": "A1 The Ruined Keep",
    "convergence": {
      "role": "input",
      "enabled": true,
      "mechanicalTag": "Stability",
      "actLabel": "A1"
    },
    "isLocked": true
  },
  {
    "id": "tbc-ward-signet",
    "name": "Ward Signet",
    "type": "gear",
    "description": "The signet forms in front of the party as Hale brings two Ward objects together. He leaves the completed tool with them as proof that the reaction can be repeated. Tags: Demo output · No player recipe",
    "mechanicsText": "While wearing this signet, you cannot be surprised. This item is already complete and is never counted as one of the party’s raw Convergence components.",
    "isUsable": false,
    "act": "Act 1",
    "sourceEncounter": "HALE'S COTTAGE",
    "isLocked": true
  },
  {
    "id": "tbc-frostedge",
    "name": "Frostedge",
    "type": "weapon",
    "category": "Melee Versatile",
    "description": "A blade recovered from the Ward field cache at the cemetery edge. The edge holds a cold that the forge didn't give it.",
    "mechanicsText": "+1 to attack and damage rolls. Versatile: 1d8 one-handed, 1d10 two-handed. Once per short or long rest, when you hit a creature, deal an additional 1d6 cold damage. This weapon's damage counts as magical.",
    "isUsable": false,
    "attack": "1d20+@PROF+@STR+1",
    "damage": "1d8+@STR+1",
    "crit": "2d8+@STR+1",
    "mastery": "Sap",
    "act": "Act 2",
    "sourceEncounter": "ELITE QUEST REWARD",
    "charges": {
      "max": 1,
      "reset": "shortRest"
    },
    "isLocked": true
  },
  {
    "id": "tbc-coldshot",
    "name": "Coldshot",
    "type": "weapon",
    "category": "Ranged",
    "description": "A ranged weapon recovered from the Ward cache. The grip is wrong — too light, too balanced for something this size.",
    "mechanicsText": "While attuned, you gain proficiency with this weapon. +1 to attack and damage rolls. Once per short or long rest, when you hit a creature, deal an additional 2d6 cold damage. This weapon's damage counts as magical.",
    "isUsable": false,
    "attack": "1d20+@PROF+@DEX+1",
    "damage": "1d10+@DEX+1",
    "crit": "2d10+@DEX+1",
    "mastery": "Push",
    "act": "Act 2",
    "sourceEncounter": "ELITE QUEST REWARD",
    "attunementRequired": true,
    "charges": {
      "max": 1,
      "reset": "shortRest"
    },
    "isLocked": true
  },
  {
    "id": "tbc-rimeguard-heavy",
    "name": "Rimeguard (Heavy)",
    "type": "armor",
    "description": "The armor adjusts to whoever puts it on — the fit is always correct, the weight always right. No tanner made this.",
    "mechanicsText": "Heavy proficiency: AC 17. This is +1 magical armor; the bonus is already included in that value. This is +1 magical armor; the bonus is already included in every value below. The wearer reduces cold damage taken by 3 per hit.",
    "isUsable": false,
    "ac": "17",
    "act": "Act 2",
    "sourceEncounter": "ELITE QUEST REWARD",
    "isLocked": true
  },
  {
    "id": "tbc-rimeguard-medium",
    "name": "Rimeguard (Medium)",
    "type": "armor",
    "description": "The armor adjusts to whoever puts it on — the fit is always correct, the weight always right. No tanner made this.",
    "mechanicsText": "Medium proficiency: AC 16 + DEX (max 2). This is +1 magical armor; the bonus is already included in that value. This is +1 magical armor; the bonus is already included in every value below. The wearer reduces cold damage taken by 3 per hit.",
    "isUsable": false,
    "ac": "16 + DEX (max 2)",
    "act": "Act 2",
    "sourceEncounter": "ELITE QUEST REWARD",
    "isLocked": true
  },
  {
    "id": "tbc-rimeguard-light",
    "name": "Rimeguard (Light)",
    "type": "armor",
    "description": "The armor adjusts to whoever puts it on — the fit is always correct, the weight always right. No tanner made this.",
    "mechanicsText": "Light proficiency: AC 13 + DEX. This is +1 magical armor; the bonus is already included in that value. This is +1 magical armor; the bonus is already included in every value below. The wearer reduces cold damage taken by 3 per hit.",
    "isUsable": false,
    "ac": "13 + DEX",
    "act": "Act 2",
    "sourceEncounter": "ELITE QUEST REWARD",
    "isLocked": true
  },
  {
    "id": "tbc-marrow",
    "name": "Marrow Shield",
    "type": "shield",
    "ac": "+3",
    "description": "Named for the first thing strength drain reaches. The face of it is unmarked — no emblem, no device. It belonged to someone who didn't want to be found.",
    "mechanicsText": "+3 bonus to AC — a shield's base +2 plus a +1 magical bonus. When the bearer would suffer a Strength score reduction, they add +2 to the Constitution saving throw.",
    "isUsable": false,
    "act": "Act 2",
    "sourceEncounter": "ELITE QUEST REWARD",
    "isLocked": true
  },
  {
    "id": "tbc-frost-brace",
    "name": "Frost Brace",
    "type": "magic",
    "description": "A bracer of pale iron that does not warm in the hand. Ward field issue — standard cold protection for operatives running north of the treeline. Tags: A2 · Defense",
    "mechanicsText": "While worn, reduce cold damage you take by 2.",
    "isUsable": false,
    "act": "Act 2",
    "sourceEncounter": "ELITE QUEST REWARD",
    "convergence": {
      "role": "input",
      "enabled": true,
      "mechanicalTag": "Defense",
      "actLabel": "A2"
    },
    "isLocked": true
  },
  {
    "id": "tbc-drift-globe",
    "name": "Drift Globe",
    "type": "magic",
    "description": "A frosted glass orb kept on the innkeeper’s shelf. Brennan left it for whoever had to go back into the dark. It hovers at shoulder height and holds a light that does not gutter in wind or cold. Tags: A2 · Cleanse",
    "mechanicsText": "As a Magic action, command the globe to shed bright light in a 20-foot radius and dim light 20 feet farther, or to go dark. It follows its bearer at walking pace. Once per long rest, as a Bonus Action, the globe can flare for 1 minute; while a creature is inside its bright light, you know the occupied space of any Invisible or magically hidden creature there, though the creature remains Invisible or hidden.",
    "isUsable": false,
    "value": "95gp",
    "act": "Act 2",
    "sourceEncounter": "NORTHGATE INN STOCK",
    "charges": {
      "max": 1,
      "reset": "longRest"
    },
    "convergence": {
      "role": "input",
      "enabled": true,
      "mechanicalTag": "Cleanse",
      "actLabel": "A2"
    },
    "isLocked": true
  },
  {
    "id": "tbc-frostward-periapt",
    "name": "Frostward Periapt",
    "type": "magic",
    "description": "A pendant of pale bone on a leather thong. The surface stays dry even when frost forms on everything around it. Tags: A2 · Defense",
    "mechanicsText": "While worn, you have advantage on saving throws against disease and against gaining the Poisoned condition, and you ignore the effects of nonmagical extreme cold.",
    "isUsable": false,
    "value": "90gp",
    "act": "Act 2",
    "sourceEncounter": "NORTHGATE INN STOCK",
    "convergence": {
      "role": "input",
      "enabled": true,
      "mechanicalTag": "Defense",
      "actLabel": "A2"
    },
    "isLocked": true
  },
  {
    "id": "tbc-north-wind-flask",
    "name": "North Wind Flask",
    "type": "gear",
    "description": "A stoppered blue-glass flask that rattles with trapped wind. Frost forms around the cork whenever the pressure inside rises.",
    "mechanicsText": "The flask has 2 charges. As a Magic action, expend 1 charge to create a 15-foot cube of gale wind originating from you until the end of your next turn. A creature that enters the cube for the first time on a turn or starts its turn there must succeed on a DC 13 Strength saving throw or be pushed 10 feet directly away from you. Ranged weapon attacks that pass through the gale have disadvantage. The flask regains all expended charges at dawn.",
    "isUsable": false,
    "value": "115gp",
    "act": "Act 2",
    "sourceEncounter": "NORTHGATE INN STOCK",
    "charges": {
      "max": 2,
      "reset": "manual",
      "note": "Recharges at dawn"
    },
    "isLocked": true
  },
  {
    "id": "tbc-frostmarrow-spear",
    "name": "Frostmarrow Spear",
    "type": "weapon",
    "category": "Melee Versatile",
    "description": "Pulled from the frozen lakebed during the clearing of the north road. The head is ice that never melts. Hunters called it cold that remembers.",
    "mechanicsText": "+1 to attack and damage rolls. Once per round, when you hit a creature with this weapon, the target must succeed on a DC 13 Constitution saving throw or its speed is reduced by 10 feet until the end of its next turn. This weapon's damage counts as magical.",
    "isUsable": false,
    "attack": "1d20+@PROF+@STR+1",
    "damage": "1d6+@STR+1",
    "crit": "2d6+@STR+1",
    "mastery": "Sap",
    "act": "Act 2",
    "sourceEncounter": "A2 Northgate Night Defense",
    "isLocked": true
  },
  {
    "id": "tbc-rimecleaver-versatile-thrown-handaxe-equivalent-1-no-attunement",
    "name": "Rimecleaver",
    "type": "weapon",
    "category": "Melee Two-Handed",
    "description": "Too much weapon for one hand and built that way on purpose. The blade is dark iron that doesn't warm in the hand no matter how long it's held, and it takes the same bite out of frozen ground as it does out of anything else.",
    "mechanicsText": "+1 to attack and damage rolls. Once per round, when you hit a creature with this weapon, the target takes an additional 1d6 cold damage. Once per round, when an attack with this weapon reduces a creature to 0 hit points, you can immediately move up to 10 feet without provoking opportunity attacks. This weapon's damage counts as magical.",
    "isUsable": false,
    "attack": "1d20+@PROF+@STR+1",
    "damage": "2d6+@STR+1",
    "crit": "4d6+@STR+1",
    "mastery": "Graze",
    "act": "Act 2",
    "sourceEncounter": "A2 Northgate Night Defense",
    "isLocked": true
  },
  {
    "id": "tbc-splitfrost-blade",
    "name": "Splitfrost Blade",
    "type": "weapon",
    "category": "Finesse",
    "description": "A blade that makes no sound when drawn. The edge is correct — unnervingly correct, as if it was made for a single specific purpose that nobody named.",
    "mechanicsText": "+1 to attack and damage rolls. Once per round, when you hit a creature with this weapon, the first attack roll that creature makes against you before the start of your next turn has disadvantage. This weapon's damage counts as magical.",
    "isUsable": false,
    "attack": "1d20+@PROF+@DEX+1",
    "damage": "1d8+@DEX+1",
    "crit": "2d8+@DEX+1",
    "mastery": "Vex",
    "act": "Act 2",
    "sourceEncounter": "A2 Northgate Night Defense",
    "isLocked": true
  },
  {
    "id": "tbc-coldsnap-bow",
    "name": "Coldsnap Bow",
    "type": "weapon",
    "category": "Ranged",
    "description": "Strung with gut from something that ran north and didn't come back. The draw is heavier than it should be at this temperature. It pulls as if it wants to be drawn.",
    "mechanicsText": "+1 to attack and damage rolls. Once per round, when you hit a creature with this weapon, the target takes an additional 1d4 cold damage. This weapon's damage counts as magical.",
    "isUsable": false,
    "attack": "1d20+@PROF+@DEX+1",
    "damage": "1d8+@DEX+1",
    "crit": "2d8+@DEX+1",
    "mastery": "Slow",
    "act": "Act 2",
    "sourceEncounter": "A2 Northgate Night Defense",
    "isLocked": true
  },
  {
    "id": "tbc-icebound-reliquary",
    "name": "Icebound Reliquary",
    "isSpellFocus": true,
    "type": "magic",
    "description": "A rough stone of clouded ice set in a Ward field mount. The original inscription has been polished away and something else cut in its place. It does not melt, and it does not warm.",
    "mechanicsText": "Can be used as a spellcasting focus. +1 to spell attack rolls and spell save DC. Once per long rest, when you cast a healing spell, one target of that spell regains an additional 1d8 hit points.",
    "isUsable": true,
    "damage": "1d8",
    "effect": {
      "type": "armedEffect",
      "label": "Icebound Blessing",
      "formula": "+1d8"
    },
    "spellFocusAttack": "+1",
    "spellFocusDamage": "+1",
    "spellFocusSaveDc": "+1",
    "act": "Act 2",
    "sourceEncounter": "A2 Northgate Night Defense",
    "charges": {
      "max": 1,
      "reset": "longRest"
    },
    "isLocked": true
  },
  {
    "id": "tbc-permafrost-hide",
    "name": "Permafrost Hide",
    "type": "armor",
    "description": "Cured in conditions no tanner would choose. It doesn't warm you — it just stops the cold from taking more.",
    "mechanicsText": "AC 13 + DEX modifier. This is +1 magical armor; the bonus is already included. You have resistance to cold damage.",
    "isUsable": false,
    "ac": "13 + DEX",
    "act": "Act 2",
    "sourceEncounter": "A2 Northgate Night Defense",
    "isLocked": true
  },
  {
    "id": "tbc-hollowbone-halfplate",
    "name": "Hollowbone Halfplate",
    "type": "armor",
    "description": "Iron, bone, and cord assembled by someone who knew exactly what they were doing. The bone inlays came from something that didn't die quickly.",
    "mechanicsText": "AC 16 + DEX modifier (max 2). This is +1 magical armor; the bonus is already included. When a creature within 5 feet hits you with a melee attack, it takes 2 cold damage.",
    "isUsable": false,
    "ac": "16 + DEX (max 2)",
    "act": "Act 2",
    "sourceEncounter": "A2 Northgate Night Defense",
    "isLocked": true
  },
  {
    "id": "tbc-bonemarch-plate",
    "name": "Bonemarch Plate",
    "type": "armor",
    "description": "Pulled from the Ward northern cache. Whoever wore it last didn't need it anymore. The iron has a grain to it that standard smelting doesn't produce — as if it was forged somewhere colder than any forge.",
    "mechanicsText": "AC 17. This is +1 magical armor; the bonus is already included. When you are reduced to 0 hit points but not killed outright, you can drop to 1 hit point instead. Once per long rest.",
    "isUsable": false,
    "ac": "17",
    "act": "Act 2",
    "sourceEncounter": "A2 Northgate Night Defense",
    "charges": {
      "max": 1,
      "reset": "longRest"
    },
    "isLocked": true
  },
  {
    "id": "tbc-hollow-lantern",
    "name": "Hollow Lantern",
    "type": "magic",
    "description": "A Ward field lantern recovered from the village cache. Its pale flame does not flicker in wind, and for a moment it shows what prefers not to be found. Tags: A2 · Cleanse",
    "mechanicsText": "As a Bonus Action, expend its charge. Until the end of your next turn, you know the space occupied by any Invisible or magically hidden creature within 15 feet of you. This does not make the creature visible. The lantern regains its charge when you finish a long rest.",
    "isUsable": false,
    "act": "Act 2",
    "sourceEncounter": "A2 Northgate Night Defense",
    "charges": {
      "max": 1,
      "reset": "longRest"
    },
    "convergence": {
      "role": "input",
      "enabled": true,
      "mechanicalTag": "Cleanse",
      "actLabel": "A2"
    },
    "isLocked": true
  },
  {
    "id": "tbc-drifter-s-knot-charm",
    "name": "Drifter's Knot Charm",
    "type": "magic",
    "description": "A knot of frozen cord worn at the belt. It tugs gently toward solid footing, the way a compass finds north. Tags: A2 · Stability",
    "mechanicsText": "While worn, you have advantage on saving throws against being knocked prone or moved against your will.",
    "isUsable": false,
    "act": "Act 2",
    "sourceEncounter": "A2 Northgate Night Defense",
    "convergence": {
      "role": "input",
      "enabled": true,
      "mechanicalTag": "Stability",
      "actLabel": "A2"
    },
    "isLocked": true
  },
  {
    "id": "bc-sentinel-chalk",
    "name": "Sentinel Chalk",
    "type": "magic",
    "description": "A stick of blue-white chalk recovered from the frozen line. A mark drawn with it holds its edge even under snow and rime. Tags: A2 · Utility",
    "mechanicsText": "As a Magic action, expend 1 charge to draw a line up to 10 feet long on a solid surface and choose any creatures you can see. Until your next long rest, the first unchosen Tiny or larger creature to cross that line causes it to flash and sound a clear chime audible out to 60 feet, then the mark ends. The chalk regains all expended charges when you finish a long rest.",
    "isUsable": false,
    "act": "Act 2",
    "sourceEncounter": "A2 The River Crossing",
    "charges": {
      "max": 3,
      "reset": "longRest"
    },
    "convergence": {
      "role": "input",
      "enabled": true,
      "mechanicalTag": "Utility",
      "actLabel": "A2"
    },
    "isLocked": true
  },
  {
    "id": "bc-gloamstep-shard",
    "name": "Gloamstep Shard",
    "type": "magic",
    "description": "A sliver of dark glass rimed white on one edge and perfectly black on the other. In dim light the shard seems a few inches closer than the hand holding it. Tags: A2 · Movement",
    "mechanicsText": "As a Bonus Action while you are in dim light or darkness, teleport up to 10 feet to an unoccupied space you can see that is also in dim light or darkness. Once used, this property cannot be used again until you finish a long rest.",
    "isUsable": false,
    "act": "Act 2",
    "sourceEncounter": "A2 The Hill Clearing",
    "charges": {
      "max": 1,
      "reset": "longRest"
    },
    "convergence": {
      "role": "input",
      "enabled": true,
      "mechanicalTag": "Movement",
      "actLabel": "A2"
    },
    "isLocked": true
  },
  {
    "id": "tbc-lake-ice-blade",
    "name": "Lake-Ice Flail",
    "type": "weapon",
    "category": "Melee One-Handed",
    "description": "The head was cut from ice on the lake's deepest shelf — ice older than the winter, older than whatever went wrong here. It has never once needed re-forming.",
    "mechanicsText": "+1 to attack and damage rolls. Once per round, when you hit a creature with this weapon, it takes an additional 1d6 cold damage. When you reduce a creature to 0 hit points with this weapon, each other creature of your choice within 10 feet of the defeated creature takes 1d6 cold damage. This weapon's damage counts as magical.",
    "isUsable": false,
    "attack": "1d20+@PROF+@STR+1",
    "damage": "1d8+@STR+1",
    "crit": "2d8+@STR+1",
    "mastery": "Sap",
    "act": "Act 2",
    "sourceEncounter": "A2 The Frozen Lake",
    "attunementRequired": true,
    "isLocked": true
  },
  {
    "id": "tbc-shattered-vigil",
    "name": "Shattered Vigil",
    "type": "weapon",
    "category": "Melee Two-Handed",
    "description": "A Ward field instrument recovered from the base at the lake's edge. Whatever it was designed to do, it has been doing something else for long enough that the original purpose is gone. The carvings shift when you aren't looking directly at them.",
    "mechanicsText": "+1 to attack and damage rolls. Heavy, Two-Handed. Once per round, when you hit a creature with this weapon, it takes an additional 1d8 cold damage. Once per short or long rest, when you hit a creature with this weapon, it must succeed on a DC 14 Strength saving throw or be knocked prone. This weapon's damage counts as magical.",
    "isUsable": false,
    "attack": "1d20+@PROF+@STR+1",
    "damage": "2d6+@STR+1",
    "crit": "4d6+@STR+1",
    "act": "Act 2",
    "sourceEncounter": "A2 The Frozen Lake",
    "attunementRequired": true,
    "charges": {
      "max": 1,
      "reset": "shortRest"
    },
    "isLocked": true
  },
  {
    "id": "tbc-hollow-fang",
    "name": "Hollow Fang",
    "type": "weapon",
    "category": "Finesse",
    "description": "Pulled from the lakebed after the fight. The blade is wrong — too thin, too light, the metal composition something no northern forge produces. It vibrates at a frequency just below hearing when drawn.",
    "mechanicsText": "+1 to attack and damage rolls. Once per round, when you hit a creature with this weapon, it takes an additional 1d6 cold damage. If you are at or below half your hit point maximum when this additional damage is dealt, you regain 1d4 hit points. This healing doesn't function if the target is a Construct or Undead. This weapon's damage counts as magical.",
    "isUsable": false,
    "attack": "1d20+@PROF+@DEX+1",
    "damage": "1d8+@DEX+1",
    "crit": "2d8+@DEX+1",
    "mastery": "Vex",
    "act": "Act 2",
    "sourceEncounter": "A2 The Frozen Lake",
    "attunementRequired": true,
    "isLocked": true
  },
  {
    "id": "tbc-starvation-brand",
    "name": "Starvation Brand",
    "type": "weapon",
    "category": "Ranged",
    "description": "Recovered from the Ward's northern cache — standard issue, but the limbs have been re-worked by hands unknown. Arrows fired from it leave a trail that lingers a half-second too long, like the weapon is reluctant to let go of what it touched.",
    "mechanicsText": "+1 to attack and damage rolls. Once per round, when you hit a creature with this weapon, it takes an additional 1d6 cold damage. Until the start of your next turn, that creature regains only half as many hit points from any healing, rounding down. This weapon's damage counts as magical.",
    "isUsable": false,
    "attack": "1d20+@PROF+@DEX+1",
    "damage": "1d8+@DEX+1",
    "crit": "2d8+@DEX+1",
    "mastery": "Slow",
    "act": "Act 2",
    "sourceEncounter": "A2 The Frozen Lake",
    "attunementRequired": true,
    "isLocked": true
  },
  {
    "id": "tbc-voidtempered-blade-versatile-longsword",
    "name": "Voidtempered Blade",
    "isSpellFocus": true,
    "type": "magic",
    "description": "The blade came out of the lake the same moment the Wendigo fell. Nobody threw it in. The metal is wrong — it conducts something that isn't heat, and when a spell passes through it the air around the edge smells of ozone and something older.",
    "mechanicsText": "Can be wielded as a +1 shortsword AND used as a spellcasting focus simultaneously. While attuned, you gain proficiency with this weapon. +1 to attack rolls, damage rolls, spell attack rolls, and spell save DC. Once per round, when you hit a creature with this weapon on the same turn you cast a spell, the target takes an additional 1d8 cold damage. This weapon's damage counts as magical.",
    "isUsable": false,
    "attack": "1d20+@PROF+@DEX+1",
    "damage": "1d6+@DEX+1",
    "crit": "2d6+@DEX+1",
    "mastery": "Vex",
    "spellFocusAttack": "+1",
    "spellFocusDamage": "+1",
    "spellFocusSaveDc": "+1",
    "act": "Act 2",
    "sourceEncounter": "A2 The Frozen Lake",
    "attunementRequired": true,
    "isLocked": true
  },
  {
    "id": "tbc-wight-iron-plate",
    "name": "Wight Iron Plate",
    "type": "armor",
    "description": "Salvaged from the Ward base at the lake's edge, left by someone who never came back for it. The iron is near-black and, against all sense, faintly warm.",
    "mechanicsText": "AC 18. This is +1 magical armor; the bonus is already included. You have advantage on saving throws against being paralyzed or restrained, and any effect that would reduce your Strength score reduces it by 1 less (minimum 0).",
    "isUsable": false,
    "ac": "18",
    "act": "Act 2",
    "sourceEncounter": "A2 The Frozen Lake",
    "isLocked": true
  },
  {
    "id": "tbc-frosted-sentinel-wrap",
    "name": "Frosted Sentinel Wrap",
    "type": "armor",
    "description": "Salvaged from the Ward lake base. The previous owner left notes in the lining — field observations in a hand that got progressively harder to read. The last entry is a single word. The word is north.",
    "mechanicsText": "AC 16 + DEX modifier (max 2). This is +1 magical armor; the bonus is already included. You have resistance to cold damage. When you are hit by a melee attack, the attacker takes 1d4 cold damage.",
    "isUsable": true,
    "damage": "1d4",
    "ac": "16 + DEX (max 2)",
    "act": "Act 2",
    "sourceEncounter": "A2 The Frozen Lake",
    "isLocked": true
  },
  {
    "id": "tbc-veilstitched-leathers",
    "name": "Veilstitched Leathers",
    "type": "armor",
    "description": "Stitched from material that isn't quite leather — too uniform, too consistent, no grain variation anywhere. Whatever animal produced it either didn't exist or doesn't anymore. It fits like it was made for whoever is wearing it.",
    "mechanicsText": "AC 13 + DEX modifier. This is +1 magical armor; the bonus is already included. You have advantage on Dexterity saving throws. When you take damage that would reduce you below half your hit point maximum for the first time each encounter, you gain 2d6 temporary hit points.",
    "isUsable": true,
    "damage": "2d6",
    "charges": {
      "max": 1,
      "reset": "encounter"
    },
    "ac": "13 + DEX",
    "act": "Act 2",
    "sourceEncounter": "A2 The Frozen Lake",
    "isLocked": true
  },
  {
    "id": "tbc-wendigo-heart-ember",
    "name": "Wendigo Ember Heart",
    "type": "magic",
    "damage": "3d6",
    "saveDc": "CON DC 13",
    "description": "Whatever organ this once was no longer resembles one — a black, porous remnant, brittle as burned stone. It is somehow still warm, and when gripped it answers with a pulse of devouring cold. Tags: A2 · Offensive",
    "mechanicsText": "Devouring Cold (1/day; recharges at dawn). As a Magic action, target one creature you can see within 30 feet. It must make a DC 13 Constitution saving throw, taking 3d6 cold damage on a failed save or half as much on a successful save.",
    "isUsable": false,
    "act": "Act 2",
    "sourceEncounter": "A2 The Frozen Lake",
    "charges": {
      "max": 1,
      "reset": "manual",
      "note": "Recharges at dawn"
    },
    "convergence": {
      "role": "input",
      "enabled": true,
      "mechanicalTag": "Offensive",
      "actLabel": "A2"
    },
    "isLocked": true
  },
  {
    "id": "tbc-frozen-lake-core",
    "name": "Frozen Lake Core",
    "type": "magic",
    "description": "A column of ice drawn from the lake’s center by no tool the party carries. It sat waiting at the shore after the fight, as if set there to be found. Tags: A2 · Stability",
    "mechanicsText": "Frozen Resolve (1/day; recharges at dawn). When you fail a saving throw, roll 1d4 and add it to the saving throw, potentially turning the failure into a success.",
    "isUsable": true,
    "damage": "1d4",
    "effect": {
      "type": "armedEffect",
      "label": "Frozen Resolve",
      "formula": "+1d4"
    },
    "act": "Act 2",
    "sourceEncounter": "A2 The Frozen Lake",
    "charges": {
      "max": 1,
      "reset": "manual",
      "note": "Recharges at dawn"
    },
    "convergence": {
      "role": "input",
      "enabled": true,
      "mechanicalTag": "Stability",
      "actLabel": "A2"
    },
    "isLocked": true
  },
  {
    "id": "bc-anchor-thread",
    "name": "Anchor Thread",
    "type": "magic",
    "description": "A braided metallic thread that tightens when the bearer loses footing. Tags: Recipe: Movement + Stability · Completed: Stability",
    "mechanicsText": "Once per long rest, when an effect would move you against your will or knock you prone, you can ignore the forced movement or remain standing.",
    "isUsable": false,
    "tier": "1",
    "act": "Act 2",
    "charges": {
      "max": 1,
      "reset": "longRest"
    },
    "convergence": {
      "role": "output",
      "enabled": true,
      "mechanicalTag": "Movement + Stability"
    },
    "isLocked": true
  },
  {
    "id": "bc-clarity-hood",
    "name": "Clarity Hood",
    "effect": {
      "type": "reroll",
      "rerollMethod": "reroll",
      "condition": "a failed save vs Charmed, Frightened, or an illusion"
    },
    "type": "magic",
    "description": "A light hood whose inner weave sharpens at the edge of false images and invasive emotion. Tags: Recipe: Defense + Utility · Completed: Utility",
    "mechanicsText": "Once per long rest, when you fail a saving throw against being Charmed or Frightened, or against an illusion spell or effect, reroll the save and use the new result.",
    "isUsable": false,
    "tier": "1",
    "act": "Act 2",
    "charges": {
      "max": 1,
      "reset": "longRest"
    },
    "convergence": {
      "role": "output",
      "enabled": true,
      "mechanicalTag": "Defense + Utility"
    },
    "isLocked": true
  },
  {
    "id": "bc-step-stabilizer",
    "name": "Step Stabilizer",
    "type": "magic",
    "description": "A small paired set of heel plates that seem to find the next safe piece of ground first. Tags: Recipe: Movement + Utility · Completed: Movement",
    "mechanicsText": "Natural difficult terrain costs you no extra movement. Once per short or long rest, you can take the Disengage action as a Bonus Action.",
    "isUsable": false,
    "tier": "1",
    "act": "Act 2",
    "charges": {
      "max": 1,
      "reset": "shortRest"
    },
    "convergence": {
      "role": "output",
      "enabled": true,
      "mechanicalTag": "Movement + Utility"
    },
    "isLocked": true
  },
  {
    "id": "bc-reinforced-wrap",
    "name": "Reinforced Wrap",
    "type": "magic",
    "description": "A strip of grey Ward cloth that stiffens for a heartbeat when a blow lands. Tags: Recipe: Defense + Stability · Completed: Defense",
    "mechanicsText": "Once per long rest, when an attack hits you, you can use your Reaction to reduce the damage by 1d10.",
    "isUsable": true,
    "damage": "1d10",
    "tier": "1",
    "act": "Act 2",
    "charges": {
      "max": 1,
      "reset": "longRest"
    },
    "convergence": {
      "role": "output",
      "enabled": true,
      "mechanicalTag": "Defense + Stability"
    },
    "isLocked": true
  },
  {
    "id": "bc-lensing-glass",
    "name": "Lensing Glass",
    "type": "magic",
    "description": "A clear lens that catches edges the eye normally loses. Tags: Recipe: Cleanse + Utility · Completed: Cleanse",
    "mechanicsText": "As a Bonus Action, expend 1 charge. Until the end of your next turn, you can see Invisible creatures and see through magical visual obscurement within 30 feet. The glass regains all expended charges when you finish a long rest.",
    "isUsable": false,
    "tier": "1",
    "act": "Act 2",
    "charges": {
      "max": 2,
      "reset": "longRest"
    },
    "convergence": {
      "role": "output",
      "enabled": true,
      "mechanicalTag": "Cleanse + Utility"
    },
    "isLocked": true
  },
  {
    "id": "bc-splitgrain-grip",
    "name": "Splitgrain Grip",
    "type": "magic",
    "damage": "1d6",
    "description": "A narrow weapon wrap split along two opposing grains. When the bearer commits to a strike, one grain drives forward while the other seems to pull the hand toward the next opening. Tags: Recipe: Offensive + Movement · Completed: Offensive",
    "mechanicsText": "Once per long rest, when you hit a creature with a weapon attack, you can deal an additional 1d6 damage of one damage type dealt by the attack. Immediately after the attack, you can move up to 10 feet without provoking opportunity attacks from that creature.",
    "isUsable": false,
    "tier": "1",
    "act": "Act 2",
    "charges": {
      "max": 1,
      "reset": "longRest"
    },
    "convergence": {
      "role": "output",
      "enabled": true,
      "mechanicalTag": "Offensive + Movement"
    },
    "isLocked": true
  },
  {
    "id": "bc-drift-anchor",
    "name": "Drift Anchor",
    "type": "magic",
    "description": "A compact Ward anchor that grows heavy only when the world tries to move its bearer. Tags: Recipe: Movement + Stability · Completed: Stability",
    "mechanicsText": "You have advantage on saving throws against being moved against your will or knocked prone. Once per day at dawn recharge, when either effect would happen, you can ignore it entirely.",
    "isUsable": false,
    "tier": "2",
    "act": "Act 2",
    "charges": {
      "max": 1,
      "reset": "manual",
      "note": "Recharges at dawn"
    },
    "convergence": {
      "role": "output",
      "enabled": true,
      "mechanicalTag": "Movement + Stability"
    },
    "isLocked": true
  },
  {
    "id": "bc-hollowlight",
    "name": "Hollowlight",
    "effect": {
      "type": "reroll",
      "rerollMethod": "reroll",
      "condition": "a failed save vs Blinded, Charmed, Frightened or Restrained"
    },
    "type": "magic",
    "description": "A pale light source that does not brighten darkness so much as make it stop lying. Tags: Recipe: Cleanse + Utility · Completed: Utility",
    "mechanicsText": "You can see through magical darkness within 30 feet. Once per day, when you fail a saving throw against being Blinded, Charmed, Frightened, or Restrained, you can reroll the save and use the new result.",
    "isUsable": false,
    "tier": "2",
    "act": "Act 2",
    "charges": {
      "max": 1,
      "reset": "manual",
      "note": "Recharges at dawn"
    },
    "convergence": {
      "role": "output",
      "enabled": true,
      "mechanicalTag": "Cleanse + Utility"
    },
    "isLocked": true
  },
  {
    "id": "bc-quickstep",
    "name": "Quickstep",
    "type": "magic",
    "description": "A matched pair of light Ward plates that seem to shorten the distance between one step and the next. Tags: Recipe: Movement + Utility · Completed: Movement",
    "mechanicsText": "Your speed increases by 5 feet and difficult terrain costs you no extra movement. Once per day, you can take the Dash action as a Bonus Action; your movement does not provoke opportunity attacks until the end of that turn.",
    "isUsable": false,
    "tier": "2",
    "act": "Act 2",
    "charges": {
      "max": 1,
      "reset": "manual",
      "note": "Recharges at dawn"
    },
    "convergence": {
      "role": "output",
      "enabled": true,
      "mechanicalTag": "Movement + Utility"
    },
    "isLocked": true
  },
  {
    "id": "bc-edgeworn",
    "name": "Edgeworn",
    "type": "magic",
    "description": "A thin grip plate whose sharpened inner grain seems to carry a committed blow through protections that should have turned it aside. Tags: Recipe: Offensive + Cleanse · Completed: Offensive",
    "mechanicsText": "Once per day, when you hit with a weapon attack, choose one damage type dealt by the hit. For that hit, resistance to the chosen type is ignored, and immunity to the chosen type is treated as resistance.",
    "isUsable": false,
    "tier": "2",
    "act": "Act 2",
    "charges": {
      "max": 1,
      "reset": "manual",
      "note": "Recharges at dawn"
    },
    "convergence": {
      "role": "output",
      "enabled": true,
      "mechanicalTag": "Offensive + Cleanse"
    },
    "isLocked": true
  },
  {
    "id": "bc-driftveil",
    "name": "Driftveil",
    "type": "magic",
    "description": "A short mantle that pulls sideways at the instant a blow finds its wearer. Tags: Recipe: Defense + Movement · Completed: Defense",
    "mechanicsText": "Once per day, when an attack hits you, you can use your Reaction to move up to 10 feet without provoking opportunity attacks and reduce the triggering attack’s damage by 1d8.",
    "isUsable": true,
    "damage": "1d8",
    "tier": "2",
    "act": "Act 2",
    "charges": {
      "max": 1,
      "reset": "manual",
      "note": "Recharges at dawn"
    },
    "convergence": {
      "role": "output",
      "enabled": true,
      "mechanicalTag": "Defense + Movement"
    },
    "isLocked": true
  },
  {
    "id": "bc-clearward-mantle",
    "name": "Clearward Mantle",
    "type": "magic",
    "description": "A narrow shoulder wrap that warms when hostile magic or poison settles into the body. Tags: Recipe: Defense + Cleanse · Completed: Cleanse",
    "mechanicsText": "You have advantage on saving throws against gaining the Poisoned condition. Once per day, as a Bonus Action, end one of the following conditions on yourself: Blinded, Charmed, Frightened, or Poisoned.",
    "isUsable": false,
    "tier": "2",
    "act": "Act 2",
    "charges": {
      "max": 1,
      "reset": "manual",
      "note": "Recharges at dawn"
    },
    "convergence": {
      "role": "output",
      "enabled": true,
      "mechanicalTag": "Defense + Cleanse"
    },
    "isLocked": true
  },
  {
    "id": "bc-turnstep-relay",
    "name": "Turnstep Relay",
    "type": "magic",
    "description": "A narrow pair of hinged plates whose inner marks click toward the next threat a heartbeat before it moves. Tags: Recipe: Movement + Tactical · Completed: Tactical",
    "mechanicsText": "Once per day, when a hostile creature you can see within 30 feet starts its turn, you can use your Reaction to move up to half your Speed without provoking opportunity attacks. This movement occurs before that creature takes any action or movement.",
    "isUsable": false,
    "tier": "2",
    "act": "Act 3",
    "charges": {
      "max": 1,
      "reset": "manual",
      "note": "Recharges at dawn"
    },
    "convergence": {
      "role": "output",
      "enabled": true,
      "mechanicalTag": "Movement + Tactical"
    },
    "isLocked": true
  },
  {
    "id": "bc-opening-thorn",
    "name": "Opening Thorn",
    "type": "magic",
    "description": "A hooked thorn that opens into a bright seam when a strike creates the exact moment another combatant can exploit. Tags: Recipe: Offensive + Tactical · Completed: Tactical",
    "mechanicsText": "Once per day, when you deal damage to a creature, you can expose an opening until the start of your next turn. The next attack roll made by another creature against that target has advantage. If that attack hits, the attacker can immediately move up to 10 feet without provoking opportunity attacks from the target.",
    "isUsable": false,
    "tier": "2",
    "act": "Act 3",
    "charges": {
      "max": 1,
      "reset": "manual",
      "note": "Recharges at dawn"
    },
    "convergence": {
      "role": "output",
      "enabled": true,
      "mechanicalTag": "Offensive + Tactical"
    },
    "isLocked": true
  },
  {
    "id": "bc-heldroot-knot",
    "name": "Heldroot Knot",
    "type": "magic",
    "description": "A loop of braided root and fine silver thread that closes around spent magic before an interruption can carry it away. Tags: Recipe: Utility + Continuity · Completed: Continuity",
    "mechanicsText": "Once per day, when a creature's Reaction causes an action you take to fail or prevents it from resolving, choose one spell slot, charge, or limited-use class resource you expended as part of that action. That resource is not expended. The creature's Reaction otherwise resolves normally.",
    "isUsable": false,
    "tier": "2",
    "act": "Act 3",
    "charges": {
      "max": 1,
      "reset": "manual",
      "note": "Recharges at dawn"
    },
    "convergence": {
      "role": "output",
      "enabled": true,
      "mechanicalTag": "Utility + Continuity"
    },
    "isLocked": true
  },
  {
    "id": "bc-rootfast-loop",
    "name": "Rootfast Loop",
    "type": "magic",
    "description": "A seamless ring of living root that refuses to open under strain, even when every fiber in it should have separated. Tags: Recipe: Stability + Continuity · Completed: Continuity",
    "mechanicsText": "Once per day, when you fail a Constitution saving throw to maintain Concentration, you can succeed instead.",
    "isUsable": false,
    "tier": "2",
    "act": "Act 3",
    "charges": {
      "max": 1,
      "reset": "manual",
      "note": "Recharges at dawn"
    },
    "convergence": {
      "role": "output",
      "enabled": true,
      "mechanicalTag": "Stability + Continuity"
    },
    "isLocked": true
  },
  {
    "id": "base-club",
    "name": "Club",
    "type": "weapon",
    "description": "A simple wooden club.",
    "isUsable": true,
    "attack": "1d20+@PROF+@STR",
    "damage": "1d4+@STR",
    "crit": "2d4+@STR",
    "category": "Melee One-Handed",
    "mastery": "Slow",
    "tags": [
      "simple",
      "light"
    ],
    "isLocked": true
  },
  {
    "id": "base-greatclub",
    "name": "Greatclub",
    "type": "weapon",
    "description": "A heavy two-handed club.",
    "isUsable": true,
    "attack": "1d20+@PROF+@STR",
    "damage": "1d8+@STR",
    "crit": "2d8+@STR",
    "category": "Melee Two-Handed",
    "mastery": "Push",
    "tags": [
      "simple"
    ],
    "isLocked": true
  },
  {
    "id": "base-mace",
    "name": "Mace",
    "type": "weapon",
    "description": "A weighted bludgeon.",
    "isUsable": true,
    "attack": "1d20+@PROF+@STR",
    "damage": "1d6+@STR",
    "crit": "2d6+@STR",
    "category": "Melee One-Handed",
    "mastery": "Sap",
    "tags": [
      "simple"
    ],
    "isLocked": true
  },
  {
    "id": "base-quarterstaff",
    "name": "Quarterstaff",
    "type": "weapon",
    "description": "A stout wooden staff. Versatile (1d8).",
    "isUsable": true,
    "attack": "1d20+@PROF+@STR",
    "damage": "1d6+@STR",
    "crit": "2d6+@STR",
    "category": "Melee Versatile",
    "mastery": "Topple",
    "tags": [
      "simple",
      "versatile"
    ],
    "isLocked": true
  },
  {
    "id": "base-spear",
    "name": "Spear",
    "type": "weapon",
    "description": "A thrusting polearm. Versatile (1d8).",
    "isUsable": true,
    "attack": "1d20+@PROF+@STR",
    "damage": "1d6+@STR",
    "crit": "2d6+@STR",
    "range": "20/60 ft",
    "category": "Melee Versatile",
    "mastery": "Sap",
    "tags": [
      "simple",
      "thrown",
      "versatile"
    ],
    "isLocked": true
  },
  {
    "id": "base-handaxe",
    "name": "Handaxe",
    "type": "weapon",
    "description": "A light axe balanced for throwing.",
    "isUsable": true,
    "attack": "1d20+@PROF+@STR",
    "damage": "1d6+@STR",
    "crit": "2d6+@STR",
    "range": "20/60 ft",
    "category": "Melee One-Handed",
    "mastery": "Vex",
    "tags": [
      "simple",
      "light",
      "thrown"
    ],
    "isLocked": true
  },
  {
    "id": "base-javelin",
    "name": "Javelin",
    "type": "weapon",
    "description": "A throwing spear.",
    "isUsable": true,
    "attack": "1d20+@PROF+@STR",
    "damage": "1d6+@STR",
    "crit": "2d6+@STR",
    "range": "30/120 ft",
    "category": "Melee One-Handed",
    "mastery": "Slow",
    "tags": [
      "simple",
      "thrown"
    ],
    "isLocked": true
  },
  {
    "id": "base-light-hammer",
    "name": "Light Hammer",
    "type": "weapon",
    "description": "A small throwing hammer.",
    "isUsable": true,
    "attack": "1d20+@PROF+@STR",
    "damage": "1d4+@STR",
    "crit": "2d4+@STR",
    "range": "20/60 ft",
    "category": "Melee One-Handed",
    "mastery": "Nick",
    "tags": [
      "simple",
      "light",
      "thrown"
    ],
    "isLocked": true
  },
  {
    "id": "base-dagger",
    "name": "Dagger",
    "type": "weapon",
    "description": "A finesse blade. DEX form.",
    "isUsable": true,
    "attack": "1d20+@PROF+@DEX",
    "damage": "1d4+@DEX",
    "crit": "2d4+@DEX",
    "range": "20/60 ft",
    "category": "Melee One-Handed",
    "mastery": "Nick",
    "tags": [
      "simple",
      "light",
      "finesse",
      "thrown"
    ],
    "isLocked": true
  },
  {
    "id": "base-sickle",
    "name": "Sickle",
    "type": "weapon",
    "description": "A curved reaping blade.",
    "isUsable": true,
    "attack": "1d20+@PROF+@DEX",
    "damage": "1d4+@DEX",
    "crit": "2d4+@DEX",
    "category": "Melee One-Handed",
    "mastery": "Nick",
    "tags": [
      "simple",
      "light"
    ],
    "isLocked": true
  },
  {
    "id": "base-light-crossbow",
    "name": "Light Crossbow",
    "type": "weapon",
    "description": "A light crossbow.",
    "isUsable": true,
    "attack": "1d20+@PROF+@DEX",
    "damage": "1d8+@DEX",
    "crit": "2d8+@DEX",
    "range": "80/320 ft",
    "category": "Ranged Two-Handed",
    "mastery": "Slow",
    "tags": [
      "simple",
      "ammunition",
      "loading"
    ],
    "isLocked": true
  },
  {
    "id": "base-shortbow",
    "name": "Shortbow",
    "type": "weapon",
    "description": "A short recurve bow.",
    "isUsable": true,
    "attack": "1d20+@PROF+@DEX",
    "damage": "1d6+@DEX",
    "crit": "2d6+@DEX",
    "range": "80/320 ft",
    "category": "Ranged Two-Handed",
    "mastery": "Vex",
    "tags": [
      "simple",
      "ammunition"
    ],
    "isLocked": true
  },
  {
    "id": "base-dart",
    "name": "Dart",
    "type": "weapon",
    "description": "A weighted throwing dart.",
    "isUsable": true,
    "attack": "1d20+@PROF+@DEX",
    "damage": "1d4+@DEX",
    "crit": "2d4+@DEX",
    "range": "20/60 ft",
    "category": "Ranged One-Handed",
    "mastery": "Vex",
    "tags": [
      "simple",
      "finesse",
      "thrown"
    ],
    "isLocked": true
  },
  {
    "id": "base-sling",
    "name": "Sling",
    "type": "weapon",
    "description": "A leather sling.",
    "isUsable": true,
    "attack": "1d20+@PROF+@DEX",
    "damage": "1d4+@DEX",
    "crit": "2d4+@DEX",
    "range": "30/120 ft",
    "category": "Ranged One-Handed",
    "mastery": "Slow",
    "tags": [
      "simple",
      "ammunition"
    ],
    "isLocked": true
  },
  {
    "id": "base-battleaxe",
    "name": "Battleaxe",
    "type": "weapon",
    "description": "Versatile (1d10).",
    "isUsable": true,
    "attack": "1d20+@PROF+@STR",
    "damage": "1d8+@STR",
    "crit": "2d8+@STR",
    "category": "Melee Versatile",
    "mastery": "Topple",
    "tags": [
      "martial",
      "versatile"
    ],
    "isLocked": true
  },
  {
    "id": "base-flail",
    "name": "Flail",
    "type": "weapon",
    "description": "A chain-hafted striking head.",
    "isUsable": true,
    "attack": "1d20+@PROF+@STR",
    "damage": "1d8+@STR",
    "crit": "2d8+@STR",
    "category": "Melee One-Handed",
    "mastery": "Sap",
    "tags": [
      "martial"
    ],
    "isLocked": true
  },
  {
    "id": "base-glaive",
    "name": "Glaive",
    "type": "weapon",
    "description": "A reach polearm.",
    "isUsable": true,
    "attack": "1d20+@PROF+@STR",
    "damage": "1d10+@STR",
    "crit": "2d10+@STR",
    "category": "Melee Two-Handed",
    "mastery": "Graze",
    "tags": [
      "martial",
      "heavy",
      "reach"
    ],
    "isLocked": true
  },
  {
    "id": "base-greataxe",
    "name": "Greataxe",
    "type": "weapon",
    "description": "A great two-handed axe.",
    "isUsable": true,
    "attack": "1d20+@PROF+@STR",
    "damage": "1d12+@STR",
    "crit": "2d12+@STR",
    "category": "Melee Two-Handed",
    "mastery": "Cleave",
    "tags": [
      "martial",
      "heavy"
    ],
    "isLocked": true
  },
  {
    "id": "base-greatsword",
    "name": "Greatsword",
    "type": "weapon",
    "description": "A great two-handed blade.",
    "isUsable": true,
    "attack": "1d20+@PROF+@STR",
    "damage": "2d6+@STR",
    "crit": "4d6+@STR",
    "category": "Melee Two-Handed",
    "mastery": "Graze",
    "tags": [
      "martial",
      "heavy"
    ],
    "isLocked": true
  },
  {
    "id": "base-halberd",
    "name": "Halberd",
    "type": "weapon",
    "description": "A reach polearm.",
    "isUsable": true,
    "attack": "1d20+@PROF+@STR",
    "damage": "1d10+@STR",
    "crit": "2d10+@STR",
    "category": "Melee Two-Handed",
    "mastery": "Cleave",
    "tags": [
      "martial",
      "heavy",
      "reach"
    ],
    "isLocked": true
  },
  {
    "id": "base-lance",
    "name": "Lance",
    "type": "weapon",
    "description": "A mounted charging weapon.",
    "isUsable": true,
    "attack": "1d20+@PROF+@STR",
    "damage": "1d10+@STR",
    "crit": "2d10+@STR",
    "category": "Melee Two-Handed",
    "mastery": "Topple",
    "tags": [
      "martial",
      "reach"
    ],
    "isLocked": true
  },
  {
    "id": "base-longsword",
    "name": "Longsword",
    "type": "weapon",
    "description": "Versatile (1d10).",
    "isUsable": true,
    "attack": "1d20+@PROF+@STR",
    "damage": "1d8+@STR",
    "crit": "2d8+@STR",
    "category": "Melee Versatile",
    "mastery": "Sap",
    "tags": [
      "martial",
      "versatile"
    ],
    "isLocked": true
  },
  {
    "id": "base-maul",
    "name": "Maul",
    "type": "weapon",
    "description": "A great two-handed hammer.",
    "isUsable": true,
    "attack": "1d20+@PROF+@STR",
    "damage": "2d6+@STR",
    "crit": "4d6+@STR",
    "category": "Melee Two-Handed",
    "mastery": "Topple",
    "tags": [
      "martial",
      "heavy"
    ],
    "isLocked": true
  },
  {
    "id": "base-morningstar",
    "name": "Morningstar",
    "type": "weapon",
    "description": "A spiked bludgeon.",
    "isUsable": true,
    "attack": "1d20+@PROF+@STR",
    "damage": "1d8+@STR",
    "crit": "2d8+@STR",
    "category": "Melee One-Handed",
    "mastery": "Sap",
    "tags": [
      "martial"
    ],
    "isLocked": true
  },
  {
    "id": "base-pike",
    "name": "Pike",
    "type": "weapon",
    "description": "A long reach polearm.",
    "isUsable": true,
    "attack": "1d20+@PROF+@STR",
    "damage": "1d10+@STR",
    "crit": "2d10+@STR",
    "category": "Melee Two-Handed",
    "mastery": "Push",
    "tags": [
      "martial",
      "heavy",
      "reach"
    ],
    "isLocked": true
  },
  {
    "id": "base-trident",
    "name": "Trident",
    "type": "weapon",
    "description": "Versatile (1d10).",
    "isUsable": true,
    "attack": "1d20+@PROF+@STR",
    "damage": "1d8+@STR",
    "crit": "2d8+@STR",
    "range": "20/60 ft",
    "category": "Melee Versatile",
    "mastery": "Topple",
    "tags": [
      "martial",
      "thrown",
      "versatile"
    ],
    "isLocked": true
  },
  {
    "id": "base-warhammer",
    "name": "Warhammer",
    "type": "weapon",
    "description": "Versatile (1d10).",
    "isUsable": true,
    "attack": "1d20+@PROF+@STR",
    "damage": "1d8+@STR",
    "crit": "2d8+@STR",
    "category": "Melee Versatile",
    "mastery": "Push",
    "tags": [
      "martial",
      "versatile"
    ],
    "isLocked": true
  },
  {
    "id": "base-war-pick",
    "name": "War Pick",
    "type": "weapon",
    "description": "A piercing military pick.",
    "isUsable": true,
    "attack": "1d20+@PROF+@STR",
    "damage": "1d8+@STR",
    "crit": "2d8+@STR",
    "category": "Melee One-Handed",
    "mastery": "Sap",
    "tags": [
      "martial"
    ],
    "isLocked": true
  },
  {
    "id": "base-rapier",
    "name": "Rapier",
    "type": "weapon",
    "description": "A finesse duelling blade. DEX form.",
    "isUsable": true,
    "attack": "1d20+@PROF+@DEX",
    "damage": "1d8+@DEX",
    "crit": "2d8+@DEX",
    "category": "Melee One-Handed",
    "mastery": "Vex",
    "tags": [
      "martial",
      "finesse"
    ],
    "isLocked": true
  },
  {
    "id": "base-scimitar",
    "name": "Scimitar",
    "type": "weapon",
    "description": "A curved finesse blade. DEX form.",
    "isUsable": true,
    "attack": "1d20+@PROF+@DEX",
    "damage": "1d6+@DEX",
    "crit": "2d6+@DEX",
    "category": "Melee One-Handed",
    "mastery": "Nick",
    "tags": [
      "martial",
      "light",
      "finesse"
    ],
    "isLocked": true
  },
  {
    "id": "base-shortsword",
    "name": "Shortsword",
    "type": "weapon",
    "description": "A short finesse blade. DEX form.",
    "isUsable": true,
    "attack": "1d20+@PROF+@DEX",
    "damage": "1d6+@DEX",
    "crit": "2d6+@DEX",
    "category": "Melee One-Handed",
    "mastery": "Vex",
    "tags": [
      "martial",
      "light",
      "finesse"
    ],
    "isLocked": true
  },
  {
    "id": "base-whip",
    "name": "Whip",
    "type": "weapon",
    "description": "A reach finesse weapon. DEX form.",
    "isUsable": true,
    "attack": "1d20+@PROF+@DEX",
    "damage": "1d4+@DEX",
    "crit": "2d4+@DEX",
    "category": "Melee One-Handed",
    "mastery": "Slow",
    "tags": [
      "martial",
      "finesse",
      "reach"
    ],
    "isLocked": true
  },
  {
    "id": "base-blowgun",
    "name": "Blowgun",
    "type": "weapon",
    "description": "A silent dart tube.",
    "isUsable": true,
    "attack": "1d20+@PROF+@DEX",
    "damage": "1+@DEX",
    "crit": "2+@DEX",
    "range": "25/100 ft",
    "category": "Ranged Two-Handed",
    "mastery": "Vex",
    "tags": [
      "martial",
      "ammunition",
      "loading"
    ],
    "isLocked": true
  },
  {
    "id": "base-hand-crossbow",
    "name": "Hand Crossbow",
    "type": "weapon",
    "description": "A one-handed crossbow.",
    "isUsable": true,
    "attack": "1d20+@PROF+@DEX",
    "damage": "1d6+@DEX",
    "crit": "2d6+@DEX",
    "range": "30/120 ft",
    "category": "Ranged One-Handed",
    "mastery": "Vex",
    "tags": [
      "martial",
      "ammunition",
      "light",
      "loading"
    ],
    "isLocked": true
  },
  {
    "id": "base-heavy-crossbow",
    "name": "Heavy Crossbow",
    "type": "weapon",
    "description": "A heavy crossbow.",
    "isUsable": true,
    "attack": "1d20+@PROF+@DEX",
    "damage": "1d10+@DEX",
    "crit": "2d10+@DEX",
    "range": "100/400 ft",
    "category": "Ranged Two-Handed",
    "mastery": "Push",
    "tags": [
      "martial",
      "ammunition",
      "heavy",
      "loading"
    ],
    "isLocked": true
  },
  {
    "id": "base-longbow",
    "name": "Longbow",
    "type": "weapon",
    "description": "A tall war bow.",
    "isUsable": true,
    "attack": "1d20+@PROF+@DEX",
    "damage": "1d8+@DEX",
    "crit": "2d8+@DEX",
    "range": "150/600 ft",
    "category": "Ranged Two-Handed",
    "mastery": "Slow",
    "tags": [
      "martial",
      "ammunition",
      "heavy"
    ],
    "isLocked": true
  },
  {
    "id": "base-dagger-str",
    "name": "Dagger (STR)",
    "type": "weapon",
    "description": "A finesse blade built off Strength.",
    "isUsable": true,
    "attack": "1d20+@PROF+@STR",
    "damage": "1d4+@STR",
    "crit": "2d4+@STR",
    "range": "20/60 ft",
    "category": "Melee One-Handed",
    "mastery": "Nick",
    "tags": [
      "simple",
      "light",
      "finesse",
      "thrown"
    ],
    "isLocked": true
  },
  {
    "id": "base-rapier-str",
    "name": "Rapier (STR)",
    "type": "weapon",
    "description": "A finesse duelling blade built off Strength.",
    "isUsable": true,
    "attack": "1d20+@PROF+@STR",
    "damage": "1d8+@STR",
    "crit": "2d8+@STR",
    "category": "Melee One-Handed",
    "mastery": "Vex",
    "tags": [
      "martial",
      "finesse"
    ],
    "isLocked": true
  },
  {
    "id": "base-scimitar-str",
    "name": "Scimitar (STR)",
    "type": "weapon",
    "description": "A curved finesse blade built off Strength.",
    "isUsable": true,
    "attack": "1d20+@PROF+@STR",
    "damage": "1d6+@STR",
    "crit": "2d6+@STR",
    "category": "Melee One-Handed",
    "mastery": "Nick",
    "tags": [
      "martial",
      "light",
      "finesse"
    ],
    "isLocked": true
  },
  {
    "id": "base-shortsword-str",
    "name": "Shortsword (STR)",
    "type": "weapon",
    "description": "A short finesse blade built off Strength.",
    "isUsable": true,
    "attack": "1d20+@PROF+@STR",
    "damage": "1d6+@STR",
    "crit": "2d6+@STR",
    "category": "Melee One-Handed",
    "mastery": "Vex",
    "tags": [
      "martial",
      "light",
      "finesse"
    ],
    "isLocked": true
  },
  {
    "id": "base-unarmed-strike",
    "name": "Unarmed Strike",
    "type": "weapon",
    "description": "A punch, kick, headbutt or shove. Always available.",
    "isUsable": true,
    "attack": "1d20+@PROF+@STR",
    "damage": "1+@STR",
    "crit": "2+@STR",
    "category": "Melee One-Handed",
    "tags": [
      "unarmed"
    ],
    "isLocked": true
  },
  {
    "id": "tbc-branchcall-marker",
    "name": "Branchcall Marker",
    "type": "magic",
    "description": "A leaf-thin disc of living wood etched with branching paths. Its edges flex toward nearby motion, and two of the carved routes brighten together when the battlefield opens. Tags: A3 · Tactical",
    "mechanicsText": "Once per day, when a creature you can see within 30 feet ends its turn, you can use your Reaction. You and one willing creature you can see within 30 feet can each move up to 10 feet without provoking opportunity attacks.",
    "isUsable": false,
    "act": "Act 3",
    "sourceEncounter": "A3 The Center",
    "charges": {
      "max": 1,
      "reset": "manual",
      "note": "Recharges at dawn"
    },
    "convergence": {
      "role": "input",
      "enabled": true,
      "mechanicalTag": "Tactical",
      "actLabel": "A3"
    },
    "isLocked": false
  },
  {
    "id": "tbc-held-echo-knot",
    "name": "Held-Echo Knot",
    "type": "magic",
    "description": "A knot of silver bark-fiber that remembers tension after it is released. When an action is cut short, the knot tightens around the spent effort as though refusing to let the commitment disappear with it. Tags: A3 · Continuity",
    "mechanicsText": "Once per day, when a creature's Reaction causes an action you take to fail or prevents it from resolving, choose one spell slot, charge, or limited-use class resource you expended as part of that action. That resource is not expended. The Reaction otherwise resolves normally.",
    "isUsable": false,
    "act": "Act 3",
    "sourceEncounter": "A3 The Center",
    "charges": {
      "max": 1,
      "reset": "manual",
      "note": "Recharges at dawn"
    },
    "convergence": {
      "role": "input",
      "enabled": true,
      "mechanicalTag": "Continuity",
      "actLabel": "A3"
    },
    "isLocked": true
  },
  {
    "id": "tbc-veilwash-leaf",
    "name": "Veilwash Leaf",
    "type": "magic",
    "description": "A translucent leaf whose veins carry warm yellow in one direction and icy blue in the other. Pressed to living skin, hostile residue beads away from it like rain refusing to cling. Tags: A3 · Cleanse",
    "mechanicsText": "Once per day, as a Magic action, touch a creature and end one of the following conditions on it: Blinded, Deafened, Paralyzed, or Poisoned.",
    "isUsable": false,
    "act": "Act 3",
    "sourceEncounter": "A3 The Center",
    "charges": {
      "max": 1,
      "reset": "manual",
      "note": "Recharges at dawn"
    },
    "convergence": {
      "role": "input",
      "enabled": true,
      "mechanicalTag": "Cleanse",
      "actLabel": "A3"
    },
    "isLocked": true
  },
  {
    "id": "tbc-thornwake-splinter",
    "name": "Thornwake Splinter",
    "type": "magic",
    "damage": "2d8",
    "description": "A dark thorn tipped with a point of amber-red light. Once awakened by a strike, its glow catches in the wound and keeps the damage from quietly knitting itself closed. Tags: A3 · Offensive",
    "mechanicsText": "Once per day, when you deal damage to a creature, you can cause the splinter to flare. The creature takes an additional 2d8 damage of one type dealt by the triggering effect, and it cannot regain hit points until the start of your next turn.",
    "isUsable": false,
    "act": "Act 3",
    "sourceEncounter": "A3 The Center",
    "charges": {
      "max": 1,
      "reset": "manual",
      "note": "Recharges at dawn"
    },
    "convergence": {
      "role": "input",
      "enabled": true,
      "mechanicalTag": "Offensive",
      "actLabel": "A3"
    },
    "isLocked": true
  },
  {
    "id": "tbc-crosspath-token",
    "name": "Crosspath Token",
    "type": "magic",
    "description": "A forked token of blackwood split by a pale living vein. When danger is about to move first, the vein leans toward the opening as though the forest has already seen the crossing. Tags: A3 · Tactical",
    "mechanicsText": "Once per day, after Initiative is rolled but before the first turn begins, choose one hostile creature you can see that has a higher Initiative than you. During the first round, you take your turn immediately before that creature. You do not also act at your original Initiative that round. Starting with round 2, you return to your original Initiative.",
    "isUsable": false,
    "act": "Act 3",
    "sourceEncounter": "A3 Gate I: Twilight Pond",
    "charges": {
      "max": 1,
      "reset": "manual",
      "note": "Recharges at dawn"
    },
    "convergence": {
      "role": "input",
      "enabled": true,
      "mechanicalTag": "Tactical",
      "actLabel": "A3"
    },
    "isLocked": true
  },
  {
    "id": "tbc-rootbound-thread",
    "name": "Rootbound Thread",
    "type": "magic",
    "description": "A green-gold root fiber braided around a darker inner strand. It tightens without cutting when concentration begins to slip, holding the bearer to the thing they chose to keep. Tags: A3 · Continuity",
    "mechanicsText": "Once per day, when you fail a Constitution saving throw to maintain Concentration, you can succeed instead.",
    "isUsable": false,
    "act": "Act 3",
    "sourceEncounter": "A3 Gate I: Twilight Pond",
    "charges": {
      "max": 1,
      "reset": "manual",
      "note": "Recharges at dawn"
    },
    "convergence": {
      "role": "input",
      "enabled": true,
      "mechanicalTag": "Continuity",
      "actLabel": "A3"
    },
    "isLocked": true
  },
  {
    "id": "tbc-bloodbriar-seed",
    "name": "Bloodbriar Seed",
    "type": "magic",
    "damage": "2d8",
    "description": "A red-black seed with two hooked veins that never point the same direction. One flare follows the bearer's strike; the second waits for another hand to answer it. Tags: A3 · Offensive",
    "mechanicsText": "Once per day, when you damage a creature, you can awaken the seed until the start of your next turn. The first time another creature damages that target before then, the target takes an additional 2d8 damage of one damage type dealt by that triggering effect.",
    "isUsable": false,
    "act": "Act 3",
    "sourceEncounter": "A3 Gate I: Twilight Pond",
    "charges": {
      "max": 1,
      "reset": "manual",
      "note": "Recharges at dawn"
    },
    "convergence": {
      "role": "input",
      "enabled": true,
      "mechanicalTag": "Offensive",
      "actLabel": "A3"
    },
    "isLocked": false
  },
  {
    "id": "tbc-mirrorbark-scale",
    "name": "Mirrorbark Scale",
    "effect": {
      "type": "reroll",
      "rerollMethod": "reroll",
      "condition": "when an attack hits you (Reaction) — the attacker rerolls"
    },
    "type": "magic",
    "description": "A thumb-sized plate of polished bark whose grain catches reflections a fraction too early. At the instant of impact, the false reflection seems to pull the real blow after it. Tags: A3 · Defense",
    "mechanicsText": "Once per day, when an attack hits you, you can use your Reaction to force the attacker to reroll the attack roll and use the new roll.",
    "isUsable": false,
    "act": "Act 3",
    "sourceEncounter": "A3 Gate I: Twilight Pond",
    "charges": {
      "max": 1,
      "reset": "manual",
      "note": "Recharges at dawn"
    },
    "convergence": {
      "role": "input",
      "enabled": true,
      "mechanicalTag": "Defense",
      "actLabel": "A3"
    },
    "isLocked": true
  },
  {
    "id": "item-mt4owsbd",
    "name": "Gift of the Realmkeeper  ",
    "type": "weapon",
    "description": "Warm living wood settles into a reliable one-handed form. Amber-yellow magic gathers first at the grip and hand protection, then runs outward through the grain as if the weapon was grown to keep something standing",
    "isUsable": true,
    "sourceEncounter": "A3 Gate II: Open Clearing",
    "chassis": {
      "categories": [
        "Melee One-Handed"
      ],
      "ability": "STR"
    },
    "grantsProficiency": true,
    "pbToDamage": true,
    "chassisBonus": 2,
    "act": "Act 3",
    "mechanicsText": "When you make a weapon attack with this Gift, you are considered proficient with it. Use the normal base damage die or dice of the chosen weapon form. The Gift grants a +2 bonus to its weapon attack and normal weapon damage rolls, and you add your Proficiency Bonus to its normal weapon damage roll",
    "attunementRequired": true,
    "riders": [
      {
        "id": "rider-mt4p4w5d",
        "label": "",
        "cadence": "perTurn",
        "formula": "1d6",
        "damageType": "Healing"
      }
    ],
    "sourceEncounters": [
      "A3 Gate III: Veilscar Hollow"
    ]
  },
  {
    "id": "tbc-gift-of-the-last-measure",
    "name": "Gift of the Last Measure",
    "chassis": {
      "categories": [
        "Melee Two-Handed"
      ],
      "ability": "STR"
    },
    "description": "Heartwood the colour of a late bonfire, heavy in the hands and heavier at the end of the swing. The grain runs the wrong way down the haft, as though the tree grew around the blow it was meant to strike.",
    "type": "weapon",
    "isUsable": true,
    "act": "Act 3",
    "sourceEncounter": "Act 3 - Gate II: The Mirrors",
    "sourceEncounters": [
      "Act 3 - Gate III: The Veil-Torn Dragon",
      "A3 Gate III: Veilscar Hollow",
      "A3 Gate II: Open Clearing"
    ],
    "grantsProficiency": true,
    "pbToDamage": true,
    "chassisBonus": 2,
    "attunementRequired": true,
    "mechanicsText": "When you make a weapon attack with this Gift, you are considered proficient with it. Use the normal base damage die or dice of the chosen weapon form. The Gift grants a +2 bonus to its weapon attack and normal weapon damage rolls, and you add your Proficiency Bonus to its normal weapon damage roll",
    "riders": [
      {
        "id": "rider-gift-of-the-last-measure",
        "label": "",
        "cadence": "perTurn",
        "formula": "1d8",
        "damageType": "Force"
      }
    ]
  },
  {
    "id": "tbc-gift-of-the-long-watch",
    "name": "Gift of the Long Watch",
    "chassis": {
      "categories": [
        "Ranged Two-Handed",
        "Ranged One-Handed"
      ],
      "ability": "DEX"
    },
    "description": "Pale limbwood strung with something finer than gut. It draws quietly, and the sound it makes on release arrives a moment after the shot does.",
    "type": "weapon",
    "isUsable": true,
    "act": "Act 3",
    "sourceEncounter": "Act 3 - Gate II: The Mirrors",
    "sourceEncounters": [
      "Act 3 - Gate III: The Veil-Torn Dragon",
      "A3 Gate III: Veilscar Hollow",
      "A3 Gate II: Open Clearing"
    ],
    "grantsProficiency": true,
    "pbToDamage": true,
    "chassisBonus": 2,
    "attunementRequired": true,
    "mechanicsText": "When you make a weapon attack with this Gift, you are considered proficient with it. Use the normal base damage die or dice of the chosen weapon form. The Gift grants a +2 bonus to its weapon attack and normal weapon damage rolls, and you add your Proficiency Bonus to its normal weapon damage roll",
    "riders": [
      {
        "id": "rider-gift-of-the-long-watch",
        "label": "",
        "cadence": "perTurn",
        "formula": "1d6",
        "damageType": "Radiant"
      }
    ]
  },
  {
    "id": "tbc-gift-of-the-open-hand",
    "name": "Gift of the Open Hand",
    "chassis": {
      "categories": [
        "Melee One-Handed"
      ],
      "ability": "STR",
      "requireTags": [
        "thrown"
      ]
    },
    "description": "Balanced for leaving the hand. Amber sap beads along the throwing edge and never quite falls, and the weapon is always warmer coming back than it was going out.",
    "type": "weapon",
    "isUsable": true,
    "act": "Act 3",
    "sourceEncounter": "Act 3 - Gate II: The Mirrors",
    "sourceEncounters": [
      "Act 3 - Gate III: The Veil-Torn Dragon",
      "A3 Gate III: Veilscar Hollow",
      "A3 Gate II: Open Clearing"
    ],
    "grantsProficiency": true,
    "pbToDamage": true,
    "chassisBonus": 2,
    "attunementRequired": true,
    "mechanicsText": "When you make a weapon attack with this Gift, you are considered proficient with it. Use the normal base damage die or dice of the chosen weapon form. The Gift grants a +2 bonus to its weapon attack and normal weapon damage rolls, and you add your Proficiency Bonus to its normal weapon damage roll",
    "riders": [
      {
        "id": "rider-gift-of-the-open-hand",
        "label": "",
        "cadence": "perTurn",
        "formula": "1d6",
        "damageType": "Force"
      }
    ]
  },
  {
    "id": "tbc-gift-of-the-quiet-step",
    "name": "Gift of the Quiet Step",
    "chassis": {
      "categories": [
        "Melee One-Handed"
      ],
      "ability": "DEX",
      "anyOfTags": [
        "finesse",
        "light"
      ]
    },
    "description": "Thin, dark, and nearly weightless. Held still it is difficult to look directly at; moving, it is difficult to look away from.",
    "type": "weapon",
    "isUsable": true,
    "act": "Act 3",
    "sourceEncounter": "Act 3 - Gate II: The Mirrors",
    "sourceEncounters": [
      "Act 3 - Gate III: The Veil-Torn Dragon",
      "A3 Gate III: Veilscar Hollow",
      "A3 Gate II: Open Clearing"
    ],
    "grantsProficiency": true,
    "pbToDamage": true,
    "chassisBonus": 2,
    "attunementRequired": true,
    "mechanicsText": "When you make a weapon attack with this Gift, you are considered proficient with it. Use the normal base damage die or dice of the chosen weapon form. The Gift grants a +2 bonus to its weapon attack and normal weapon damage rolls, and you add your Proficiency Bonus to its normal weapon damage roll",
    "riders": [
      {
        "id": "rider-gift-of-the-quiet-step",
        "label": "",
        "cadence": "perTurn",
        "formula": "1d6",
        "damageType": "Psychic"
      }
    ]
  },
  {
    "id": "tbc-gift-of-the-standing-line",
    "name": "Gift of the Standing Line",
    "chassis": {
      "categories": [
        "Melee Two-Handed"
      ],
      "ability": "STR",
      "requireTags": [
        "reach"
      ]
    },
    "description": "A long shaft of grey-green wood that has clearly been used as a fence post and clearly objected. It settles into a guard position on its own if the wielder stops thinking about it.",
    "type": "weapon",
    "isUsable": true,
    "act": "Act 3",
    "sourceEncounter": "Act 3 - Gate II: The Mirrors",
    "sourceEncounters": [
      "Act 3 - Gate III: The Veil-Torn Dragon",
      "A3 Gate III: Veilscar Hollow",
      "A3 Gate II: Open Clearing"
    ],
    "grantsProficiency": true,
    "pbToDamage": true,
    "chassisBonus": 2,
    "attunementRequired": true,
    "mechanicsText": "When you make a weapon attack with this Gift, you are considered proficient with it. Use the normal base damage die or dice of the chosen weapon form. The Gift grants a +2 bonus to its weapon attack and normal weapon damage rolls, and you add your Proficiency Bonus to its normal weapon damage roll",
    "riders": [
      {
        "id": "rider-gift-of-the-standing-line",
        "label": "",
        "cadence": "perTurn",
        "formula": "1d8",
        "damageType": "Cold"
      }
    ]
  },
  {
    "id": "tbc-gift-of-the-deep-root",
    "name": "Gift of the Deep Root",
    "chassis": {
      "requireTags": [
        "two-handed"
      ]
    },
    "description": "A two-handed stave still carrying a knot of the tree it was taken from. Spells cast through it arrive a half-beat late and noticeably louder.",
    "isSpellFocus": true,
    "spellFocusAttack": "+1",
    "spellFocusDamage": "+1",
    "spellFocusSaveDc": "+1",
    "type": "weapon",
    "isUsable": true,
    "act": "Act 3",
    "sourceEncounter": "Act 3 - Gate II: The Mirrors",
    "sourceEncounters": [
      "Act 3 - Gate III: The Veil-Torn Dragon",
      "A3 Gate III: Veilscar Hollow",
      "A3 Gate II: Open Clearing"
    ],
    "grantsProficiency": true,
    "pbToDamage": true,
    "chassisBonus": 2,
    "attunementRequired": true,
    "mechanicsText": "When you make a weapon attack with this Gift, you are considered proficient with it. Use the normal base damage die or dice of the chosen weapon form. The Gift grants a +2 bonus to its weapon attack and normal weapon damage rolls, and you add your Proficiency Bonus to its normal weapon damage roll",
    "riders": [
      {
        "id": "rider-gift-of-the-deep-root",
        "label": "",
        "cadence": "perTurn",
        "formula": "1d8",
        "damageType": "Necrotic"
      }
    ]
  },
  {
    "id": "tbc-gift-of-the-turning-season",
    "name": "Gift of the Turning Season",
    "chassis": {
      "requireTags": [
        "one-handed"
      ]
    },
    "description": "A short focus meant to be held in the off hand while the other is busy. The wood changes colour with the season it is carried through, and remembers every one it has seen.",
    "isSpellFocus": true,
    "spellFocusAttack": "+1",
    "spellFocusDamage": "+1",
    "spellFocusSaveDc": "+1",
    "type": "weapon",
    "isUsable": true,
    "act": "Act 3",
    "sourceEncounter": "Act 3 - Gate II: The Mirrors",
    "sourceEncounters": [
      "Act 3 - Gate III: The Veil-Torn Dragon",
      "A3 Gate III: Veilscar Hollow",
      "A3 Gate II: Open Clearing"
    ],
    "grantsProficiency": true,
    "pbToDamage": true,
    "chassisBonus": 2,
    "attunementRequired": true,
    "mechanicsText": "When you make a weapon attack with this Gift, you are considered proficient with it. Use the normal base damage die or dice of the chosen weapon form. The Gift grants a +2 bonus to its weapon attack and normal weapon damage rolls, and you add your Proficiency Bonus to its normal weapon damage roll",
    "riders": [
      {
        "id": "rider-gift-of-the-turning-season",
        "label": "",
        "cadence": "perTurn",
        "formula": "1d6",
        "damageType": "Lightning"
      }
    ]
  },
  {
    "id": "tbc-rimestone-pauldron",
    "name": "Rimestone Pauldron",
    "type": "magic",
    "description": "Hammered from rimesteel salvaged off the road. One piece, not a set. Whoever wore it before didn't need the other shoulder guarded — they only ever turned one side to the fight.",
    "isUsable": true,
    "charges": {
      "max": 1,
      "reset": "longRest"
    },
    "effect": {
      "type": "tempHP",
      "value": "5",
      "label": "+5 temp HP when attacking at disadvantage"
    },
    "attunementRequired": false,
    "isLocked": true,
    "category": "Shoulder guard",
    "tier": "Tier 1.5",
    "act": "Act 2",
    "session": "Session 1",
    "sourceEncounter": "Ward Cache-DM Reward",
    "sourceType": "dm-reward",
    "mechanicsText": "When you would make an attack roll with disadvantage, you may use 1 charge to gain 5 temporary hit points.",
    "dmNote": "DM: Award this cache when a party was overscaled for an encounter or came close to TPK. Brennan left it on the road knowing what was there. The party finds it after the fight."
  },
  {
    "id": "tbc-ward-iron-bracer",
    "name": "Ward Iron Bracer",
    "type": "magic",
    "description": "Standard Ward field issue. The interior is scored with tally marks — not decorative, functional. Someone was counting something. The count stops at seventeen.",
    "isUsable": true,
    "charges": {
      "max": 1,
      "reset": "longRest"
    },
    "effect": {
      "type": "spellSlotSub",
      "value": "L1",
      "label": "Sub for L1 spell slot (defensive spells)"
    },
    "attunementRequired": false,
    "isLocked": true,
    "category": "Bracer",
    "tier": "Tier 1.5",
    "act": "Act 2",
    "session": "Session 1",
    "sourceEncounter": "Ward Cache-DM Reward",
    "sourceType": "dm-reward",
    "mechanicsText": "When you cast a defensive spell of 1st level, you may use 1 charge in place of a spell slot."
  },
  {
    "id": "tbc-coldwell-vial",
    "name": "Coldwell Vial",
    "type": "magic",
    "description": "A sealed vial of water drawn from somewhere north of the treeline. It stays cold regardless of temperature. Ward field medics carry these.",
    "isUsable": true,
    "charges": {
      "max": 1,
      "reset": "longRest"
    },
    "effect": {
      "type": "spellSlotSub",
      "value": "L1",
      "label": "Sub for L1 spell slot (healing spells)"
    },
    "attunementRequired": false,
    "isLocked": true,
    "category": "Vial worn at the belt",
    "tier": "Tier 1.5",
    "act": "Act 2",
    "session": "Session 1",
    "sourceEncounter": "Ward Cache-DM Reward",
    "sourceType": "dm-reward",
    "mechanicsText": "When you cast a healing spell of 1st level, you may use 1 charge in place of a spell slot."
  },
  {
    "id": "tbc-bonded-cord",
    "name": "Bonded Cord",
    "type": "magic",
    "description": "A length of braided cord that hums faintly within 30 feet of trained animals. Ward field scouts use these to coordinate across terrain.",
    "isUsable": true,
    "charges": {
      "max": 1,
      "reset": "longRest"
    },
    "effect": {
      "type": "advantage",
      "label": "Give advantage on ally attack (within 5ft of another ally)"
    },
    "attunementRequired": false,
    "isLocked": true,
    "category": "Worn at the wrist",
    "tier": "Tier 1.5",
    "act": "Act 2",
    "session": "Session 1",
    "sourceEncounter": "Ward Cache-DM Reward",
    "sourceType": "dm-reward",
    "mechanicsText": "When an ally attacks a creature within 5 feet of another ally, you may use 1 charge to give that attack advantage."
  },
  {
    "id": "tbc-voidtouched-lens",
    "name": "Voidtouched Lens",
    "type": "magic",
    "description": "A disc of dark glass in a bone frame. Through it, the space where a spell lands looks different — a faint impression that lingers a half-second after impact. The Ward recovered this from somewhere they don't put in reports.",
    "isUsable": true,
    "charges": {
      "max": 1,
      "reset": "longRest"
    },
    "effect": {
      "type": "reroll",
      "label": "Reroll cantrip attack or damage roll — take either result"
    },
    "attunementRequired": false,
    "isLocked": true,
    "category": "Worn at the neck",
    "tier": "Tier 1.5",
    "act": "Act 2",
    "session": "Session 1",
    "sourceEncounter": "Ward Cache-DM Reward",
    "sourceType": "dm-reward",
    "mechanicsText": "When you make a cantrip attack roll or damage roll, you may use 1 charge to reroll it and take either result."
  },
  {
    "id": "tbc-hollow-pack-ward-token",
    "name": "Hollow Pack Ward Token",
    "type": "magic",
    "description": "A flat disc of dark iron pressed with the Ward field mark and left in the cache deliberately. Not found — placed.",
    "isUsable": true,
    "charges": {
      "max": 1,
      "reset": "longRest"
    },
    "effect": {
      "type": "nullifyDamage",
      "value": "cold",
      "label": "Nullify cold damage — one instance"
    },
    "attunementRequired": false,
    "isLocked": true,
    "category": "Convergence Input · Equip",
    "tier": "Tier 1.5",
    "act": "Act 2",
    "session": "Session 1",
    "sourceEncounter": "Ward Cache-DM Reward",
    "sourceType": "dm-reward",
    "mechanicsText": "When you would take cold damage from any source, you may use 1 charge to nullify that damage entirely.",
    "tags": [
      "A1",
      "Frost",
      "Stability"
    ],
    "convergence": {
      "role": "input",
      "enabled": true,
      "mechanicalTag": "Stability",
      "actLabel": "A1",
      "flavorTag": "Frost"
    }
  }
];

/**
 * Encounters authored in-app — the fights, their act tag and ORDER, and the bodies built from
 * any template creature they field. Replaces a bundled encounter by id, or adds a new one.
 */
export const AUTHORED_ENCOUNTERS: EncounterDefinition[] = [
  {
    "id": "act1-thornfang-pack",
    "name": "A1 The Split Treeline",
    "actTag": "Act 1",
    "classification": "normal",
    "entries": [
      {
        "templateId": "broken-chain:act1:thornfang-wolf:v1",
        "count": 2,
        "startingVisibility": "hp-bar",
        "hiddenNameOverride": "Patient Wolf"
      },
      {
        "templateId": "broken-chain:act1:thornfang-packlord:v1",
        "count": 1,
        "startingVisibility": "hp-bar",
        "hiddenNameOverride": "Great Wolf"
      }
    ],
    "owner": "campaign",
    "order": 1
  },
  {
    "id": "act1-greenwood-reaver",
    "name": "A1 The Eastern Farmstead",
    "actTag": "Act 1",
    "classification": "normal",
    "entries": [
      {
        "templateId": "broken-chain:act1:greenwood-reaver:v1",
        "count": 2,
        "startingVisibility": "hp-bar",
        "hiddenNameOverride": "Raider Captain"
      }
    ],
    "owner": "campaign",
    "order": 2
  },
  {
    "id": "act1-mosshide-owlbear",
    "name": "A1 The Creekside Den",
    "actTag": "Act 1",
    "classification": "mid-boss",
    "entries": [
      {
        "templateId": "broken-chain:act1:mosshide-owlbear:v1",
        "count": 1,
        "startingVisibility": "hp-bar",
        "hiddenNameOverride": "Shape in the Trees"
      },
      {
        "templateId": "broken-chain:act1:mosshide-cub:v1",
        "count": 2,
        "startingVisibility": "hp-bar",
        "hiddenNameOverride": "The Things in the Den"
      }
    ],
    "owner": "campaign",
    "order": 3
  },
  {
    "id": "act1-threadbare-spider-nest",
    "name": "A1 The Webbed Crossing",
    "actTag": "Act 1",
    "classification": "normal",
    "entries": [
      {
        "templateId": "broken-chain:act1:threadbare-spider:v1",
        "count": 4,
        "startingVisibility": "hp-bar",
        "hiddenNameOverride": "Spider"
      }
    ],
    "owner": "campaign",
    "order": 4
  },
  {
    "id": "act1-swamp-ambush",
    "name": "A1 The Swamp Road",
    "actTag": "Act 1",
    "classification": "normal",
    "entries": [
      {
        "templateId": "broken-chain:act1:swamp-ambusher:v1",
        "count": 4,
        "startingVisibility": "hp-bar",
        "hiddenNameOverride": "Bandit"
      }
    ],
    "owner": "campaign",
    "order": 5
  },
  {
    "id": "fort-cervan-band",
    "name": "A1 The Road Fort",
    "classification": "elite",
    "entries": [
      {
        "templateId": "broken-chain:fort:cervan-thornwarden:v1",
        "count": 1,
        "startingVisibility": "hp-bar",
        "hiddenNameOverride": "Fort Commander"
      },
      {
        "templateId": "broken-chain:fort:fortbreaker-reaver:v1",
        "count": 1,
        "startingVisibility": "hp-bar",
        "hiddenNameOverride": "The Shouting One"
      },
      {
        "templateId": "broken-chain:fort:gloamknife-stray:v1",
        "count": 1,
        "startingVisibility": "hp-bar",
        "hiddenNameOverride": "The Wrong Shadow"
      }
    ],
    "owner": "campaign",
    "order": 6,
    "actTag": "Act 1"
  },
  {
    "id": "act1-boss",
    "name": "A1 The Ruined Keep",
    "actTag": "Act 1",
    "classification": "act-boss",
    "entries": [
      {
        "templateId": "broken-chain:boss:mirage-stalker:v1",
        "count": 1,
        "startingVisibility": "condition",
        "hiddenNameOverride": "Something Wrong in the Keep"
      }
    ],
    "order": 7,
    "owner": "campaign"
  },
  {
    "id": "act2-s1-e1-hollow-pack",
    "name": "A2 The Northgate Road",
    "actTag": "Act 2",
    "classification": "strong",
    "entries": [
      {
        "templateId": "broken-chain:act2-s1:pale-stalker:v1",
        "count": 1,
        "startingVisibility": "hp-bar",
        "hiddenNameOverride": "Patient Wolf"
      },
      {
        "templateId": "broken-chain:act2-s1:pack-hunter:v1",
        "count": 2,
        "startingVisibility": "hp-bar",
        "hiddenNameOverride": "Corrupted Hunter"
      }
    ],
    "owner": "campaign",
    "order": 1
  },
  {
    "id": "act2-s1-e2-frozen-hollow",
    "name": "A2 The Frozen Hollow",
    "actTag": "Act 2",
    "classification": "elite",
    "entries": [
      {
        "templateId": "broken-chain:act2-s1:icebound-zombie:v1",
        "count": 1,
        "startingVisibility": "hp-bar",
        "hiddenNameOverride": "Icebound Corpse"
      },
      {
        "templateId": "broken-chain:act2-s1:hollow-mourner:v1",
        "count": 1,
        "startingVisibility": "hp-bar",
        "hiddenNameOverride": "Hollow Mourner"
      },
      {
        "templateId": "broken-chain:act2-s2:corrupted-hunter:v1",
        "count": 1,
        "startingVisibility": "hp-bar",
        "hiddenNameOverride": "Corrupted Hunter"
      }
    ],
    "owner": "campaign",
    "order": 2
  },
  {
    "id": "act2-s2-e2-last-directive",
    "name": "A2 The Desecrated Cemetery",
    "actTag": "Act 2",
    "classification": "elite",
    "entries": [
      {
        "templateId": "broken-chain:act2-s2:soul-gorged-guardian:v1",
        "count": 1,
        "startingVisibility": "hp-bar",
        "hiddenNameOverride": "Broken Guardian"
      },
      {
        "templateId": "broken-chain:act2-s2:grave-light:v1",
        "count": 3,
        "startingVisibility": "hp-bar",
        "hiddenNameOverride": "Grave Light"
      }
    ],
    "owner": "campaign",
    "order": 3
  },
  {
    "id": "act2-s3-village-defense",
    "name": "A2 Northgate Night Defense",
    "actTag": "Act 2",
    "classification": "mid-boss",
    "entries": [
      {
        "templateId": "broken-chain:act2:lesser-wendigo:v1",
        "count": 2,
        "startingVisibility": "hp-bar",
        "hiddenNameOverride": "Rooftop Shape"
      }
    ],
    "owner": "campaign",
    "order": 4
  },
  {
    "id": "act2-s4-frozen-sentinels",
    "name": "A2 The River Crossing",
    "actTag": "Act 2",
    "classification": "elite",
    "entries": [
      {
        "templateId": "broken-chain:act2:frozen-sentinel:v1",
        "count": 1,
        "startingVisibility": "hp-bar",
        "hiddenNameOverride": "Ward Armor in the Road"
      },
      {
        "templateId": "broken-chain:act2:rime-wight:v1",
        "count": 1,
        "startingVisibility": "hp-bar",
        "hiddenNameOverride": "The Standing Soldier"
      },
      {
        "templateId": "broken-chain:act2:frozen-husk:v1",
        "count": 1,
        "startingVisibility": "hp-bar",
        "hiddenNameOverride": "Something Standing That Shouldn't"
      },
      {
        "templateId": "broken-chain:act2:frost-weaver:v1",
        "count": 1,
        "startingVisibility": "hp-bar",
        "hiddenNameOverride": "The Shape That Weaves the Cold"
      }
    ],
    "owner": "campaign",
    "order": 5
  },
  {
    "id": "act2-s4-pale-drifter",
    "name": "A2 The Hill Clearing",
    "actTag": "Act 2",
    "classification": "elite",
    "entries": [
      {
        "templateId": "broken-chain:act2:pale-drifter:v1",
        "count": 1,
        "startingVisibility": "hp-bar",
        "hiddenNameOverride": "The Light at the Tree Line"
      },
      {
        "templateId": "broken-chain:act2:frozen-cloak:v1",
        "count": 1,
        "startingVisibility": "hp-bar",
        "hiddenNameOverride": "The Cold That Follows the Light"
      }
    ],
    "owner": "campaign",
    "order": 6
  },
  {
    "id": "act2-s5-wendigo-wight",
    "name": "A2 The Frozen Lake",
    "actTag": "Act 2",
    "classification": "act-boss",
    "entries": [
      {
        "templateId": "broken-chain:act2:wendigo-wight:v1",
        "count": 1,
        "startingVisibility": "hp-bar",
        "hiddenNameOverride": "The Thing at the Center of the Lake"
      }
    ],
    "owner": "campaign",
    "order": 7
  },
  {
    "id": "act3-e1-the-first-court",
    "name": "A3 The First Court",
    "actTag": "Act 3",
    "entries": [
      {
        "templateId": "broken-chain:act3:snarlroot:v1",
        "count": 1,
        "startingVisibility": "hp-bar",
        "hiddenNameOverride": "Snarlroot"
      },
      {
        "templateId": "broken-chain:act3:hollow-warden:v1",
        "count": 1,
        "startingVisibility": "hp-bar",
        "hiddenNameOverride": "Hollow Warden"
      },
      {
        "templateId": "broken-chain:act3:larkskein:v1",
        "count": 1,
        "startingVisibility": "hp-bar",
        "hiddenNameOverride": "Larkskein"
      }
    ],
    "owner": "campaign",
    "order": 1
  },
  {
    "id": "act3-e2-the-cut-below",
    "name": "A3 The Cut Below",
    "actTag": "Act 3",
    "entries": [
      {
        "templateId": "broken-chain:act3:quillshrike:v1",
        "count": 1,
        "startingVisibility": "hp-bar",
        "hiddenNameOverride": "Quillshrike"
      },
      {
        "templateId": "broken-chain:act3:marrowstalk:v1",
        "count": 1,
        "startingVisibility": "hp-bar",
        "hiddenNameOverride": "Marrowstalk"
      },
      {
        "templateId": "broken-chain:act3:shardbound:v1",
        "count": 1,
        "startingVisibility": "hp-bar",
        "hiddenNameOverride": "Shardbound"
      }
    ],
    "owner": "campaign",
    "order": 2
  },
  {
    "id": "act3-e3-gate-i-crone-and-mare",
    "name": "A3 Gate I: Twilight Pond",
    "actTag": "Act 3",
    "entries": [
      {
        "templateId": "broken-chain:act3:veilwood-crone:v1",
        "count": 1,
        "startingVisibility": "hp-bar",
        "hiddenNameOverride": "Veilwood Crone"
      },
      {
        "templateId": "broken-chain:act3:darkmare:v1",
        "count": 1,
        "startingVisibility": "hp-bar",
        "hiddenNameOverride": "Darkmare"
      }
    ],
    "owner": "campaign",
    "order": 3
  },
  {
    "id": "act3-e4-the-hollow-feast",
    "name": "A3 The Hollow Feast",
    "actTag": "Act 3",
    "entries": [
      {
        "templateId": "broken-chain:act3:briar-regent:v1",
        "count": 1,
        "startingVisibility": "hp-bar",
        "hiddenNameOverride": "Briar Regent"
      },
      {
        "templateId": "broken-chain:act3:folded-bulwark:v1",
        "count": 1,
        "startingVisibility": "hp-bar",
        "hiddenNameOverride": "Folded Bulwark"
      },
      {
        "templateId": "broken-chain:act3:velvet-host:v1",
        "count": 1,
        "startingVisibility": "hp-bar",
        "hiddenNameOverride": "Velvet Host"
      }
    ],
    "owner": "campaign",
    "order": 4
  },
  {
    "id": "act3-e5-the-scar-line",
    "name": "A3 The Scar Line",
    "actTag": "Act 3",
    "entries": [
      {
        "templateId": "broken-chain:act3:moss-crowned-charger:v1",
        "count": 1,
        "startingVisibility": "hp-bar",
        "hiddenNameOverride": "Moss-Crowned Charger"
      },
      {
        "templateId": "broken-chain:act3:rift-slick:v1",
        "count": 1,
        "startingVisibility": "hp-bar",
        "hiddenNameOverride": "Rift-Slick"
      },
      {
        "templateId": "broken-chain:act3:nail-saint:v1",
        "count": 1,
        "startingVisibility": "hp-bar",
        "hiddenNameOverride": "Nail Saint"
      }
    ],
    "owner": "campaign",
    "order": 5
  },
  {
    "id": "campaign-mt3nm2j9",
    "name": "A3 Gate II: Open Clearing",
    "entries": [
      {
        "templateId": "broken-chain:act3:elemental-mirror:v1",
        "count": 4,
        "startingVisibility": "hp-bar",
        "hiddenNameOverride": "Mirror",
        "bodies": [
          {
            "id": "bmt86707w",
            "name": ""
          },
          {
            "id": "bmt86712r",
            "name": ""
          },
          {
            "id": "bmt8671fm",
            "name": ""
          },
          {
            "id": "bmt8672ed",
            "name": ""
          }
        ]
      }
    ],
    "owner": "campaign",
    "actTag": "Act 3",
    "order": 6
  },
  {
    "id": "act3-e6-gate-ii-the-mirrors",
    "name": "Act 3 E6 - Gate II: The Mirrors",
    "actTag": "Act 3",
    "entries": [
      {
        "templateId": "broken-chain:act3:elemental-mirror:v1",
        "count": 1,
        "startingVisibility": "hp-bar",
        "hiddenNameOverride": "Mirror"
      }
    ],
    "owner": "campaign",
    "order": 6
  },
  {
    "id": "act3-e7-the-last-court",
    "name": "Act 3 - The Last Court",
    "actTag": "Act 3",
    "entries": [
      {
        "templateId": "broken-chain:act3:blackbough-reeve:v1",
        "count": 1,
        "startingVisibility": "hp-bar",
        "hiddenNameOverride": "Blackbough Reeve"
      },
      {
        "templateId": "broken-chain:act3:gloam-harrow:v1",
        "count": 1,
        "startingVisibility": "hp-bar",
        "hiddenNameOverride": "Gloam Harrow"
      },
      {
        "templateId": "broken-chain:act3:brandwing:v1",
        "count": 1,
        "startingVisibility": "hp-bar",
        "hiddenNameOverride": "Brandwing"
      }
    ],
    "owner": "campaign",
    "order": 7
  },
  {
    "id": "act3-e8-the-occupied-acre",
    "name": "Act 3 - The Occupied Acre",
    "actTag": "Act 3",
    "entries": [
      {
        "templateId": "broken-chain:act3:demonic-reaver:v1",
        "count": 1,
        "startingVisibility": "hp-bar",
        "hiddenNameOverride": "Demonic Reaver"
      },
      {
        "templateId": "broken-chain:act3:breaker:v1",
        "count": 1,
        "startingVisibility": "hp-bar",
        "hiddenNameOverride": "Breaker"
      },
      {
        "templateId": "broken-chain:act3:demon-knight-of-punishment:v1",
        "count": 1,
        "startingVisibility": "hp-bar",
        "hiddenNameOverride": "Demon Knight of Punishment"
      }
    ],
    "owner": "campaign",
    "order": 8
  },
  {
    "id": "act3-e9-gate-iii-veil-torn-dragon",
    "name": "A3 Gate III: Veilscar Hollow",
    "actTag": "Act 3",
    "entries": [
      {
        "templateId": "broken-chain:act3:veil-torn-wyrmling:v1",
        "count": 2,
        "startingVisibility": "hp-bar",
        "hiddenNameOverride": "Veil-Torn Wyrmling"
      },
      {
        "templateId": "broken-chain:act3:veil-torn-dragon:v1",
        "count": 1,
        "startingVisibility": "hp-bar",
        "hiddenNameOverride": "Veil-Torn Dragon"
      }
    ],
    "owner": "campaign",
    "order": 9
  },
  {
    "id": "act3-e10-the-center",
    "name": "A3 The Center",
    "actTag": "Act 3",
    "entries": [
      {
        "templateId": "broken-chain:act3:thought-harrower:v1",
        "count": 1,
        "startingVisibility": "hp-bar",
        "hiddenNameOverride": "Thought Harrower"
      },
      {
        "templateId": "broken-chain:act3:grief-colossus:v1",
        "count": 1,
        "startingVisibility": "hp-bar",
        "hiddenNameOverride": "Grief Colossus"
      }
    ],
    "owner": "campaign",
    "order": 10
  }
];

/** Fingerprint of the two arrays above, as published. Empty when nothing is authored. */
export const AUTHORED_DIGEST = "fnv1a-1f5c0c67-100968";

/** When the fold script last wrote this file. */
export const AUTHORED_AT = "2026-08-26T05:09:49.998Z";

/**
 * Merge authored content over a bundled list by id.
 *
 * Authored entries WIN for their own id — that is the point of authoring — and anything the
 * author has not touched is left exactly as the hand-written source has it. Order is stable:
 * bundled entries keep their position, genuinely new ones are appended.
 */
export function mergeAuthored<T>(bundled: T[], authored: T[], idOf: (item: T) => string): T[] {
  if (authored.length === 0) return bundled;
  const overrides = new Map(authored.map(a => [idOf(a), a]));
  const merged = bundled.map(b => overrides.get(idOf(b)) ?? b);
  const bundledIds = new Set(bundled.map(idOf));
  return [...merged, ...authored.filter(a => !bundledIds.has(idOf(a)))];
}
