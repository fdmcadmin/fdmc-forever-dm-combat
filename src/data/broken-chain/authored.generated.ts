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
    "templateId": "broken-chain:act3:blackbough-reeve:v1",
    "name": "Blackbough Reeve",
    "encounterId": "act3-e7-the-last-court",
    "encounterLabel": "Act 3 E7 - The Last Court",
    "stats": {
      "kind": "fey",
      "ac": 17,
      "maxHp": 118,
      "speed": "35 ft.",
      "defenses": [
        {
          "name": "Seasoned by Severity",
          "ehpMultiplier": 1,
          "note": "DECIDED 1.0, not unassessed. Advantage on STR/DEX saves and immunity to charmed and frightened. The workbook publishes Condition immunity with a NULL contribution, and a monster's own save quality never enters effective HP because the party's damage is a curve rather than a save. Nothing here reduces damage taken."
        }
      ],
      "attacksPerTurn": 2,
      "size": "Medium",
      "classification": "elite",
      "archetype": "bruiser",
      "skills": [
        {
          "label": "Athletics",
          "modifier": 9
        }
      ],
      "proficiencyBonus": 4
    },
    "abilities": [
      {
        "label": "STR",
        "value": "20 (+5)",
        "saveProficient": true
      },
      {
        "label": "DEX",
        "value": "18 (+4)",
        "saveProficient": true
      },
      {
        "label": "CON",
        "value": "10 (+0)"
      },
      {
        "label": "INT",
        "value": "16 (+3)"
      },
      {
        "label": "WIS",
        "value": "18 (+4)",
        "saveProficient": true
      },
      {
        "label": "CHA",
        "value": "19 (+4)"
      }
    ],
    "traits": [
      {
        "name": "Seasoned by Severity",
        "kind": "trait",
        "text": "The Reeve has Advantage on Strength and Dexterity saving throws and is immune to the Charmed and Frightened conditions."
      }
    ],
    "actions": [
      {
        "name": "Deepen the Cut",
        "kind": "action",
        "economyCost": "bonus",
        "targets": 1,
        "damage": "2d6",
        "damageType": "Slashing",
        "text": "The Reeve chooses one creature affected by Spoiling Cut within 30 feet. The first time that creature damages a creature other than the Reeve before the start of the Reeve's next turn, it takes 7 (2d6) slashing damage after the triggering damage is resolved."
      },
      {
        "name": "Spoiling Cut",
        "kind": "attack",
        "roll": "1d20+9",
        "damage": "2d10 + 4",
        "damageType": "Slashing",
        "range": "reach 5 ft",
        "save": "CON DC 17",
        "text": "The target must succeed on a DC 17 Constitution saving throw or deal 5 less damage each time it deals damage to a creature other than the Reeve until the start of the Reeve's next turn. This effect ends immediately after the target makes an attack against the Reeve, whether the attack hits or misses",
        "routineSlots": 2,
        "economyCost": "action"
      }
    ],
    "reactions": [
      {
        "name": "Final Pruning",
        "kind": "action",
        "text": "When an ally that the Reeve can see within 30 feet is attacked below half of its total maximum hit points or is reduced to 0 hit points, the Reeve moves up to half its speed toward the creature that dealt the damage. This movement provokes opportunity attacks normally.",
        "attackWith": "Spoiling Cut"
      }
    ],
    "resources": [],
    "notes": [
      "A broad-shouldered Fey wrapped in split black bark and hooked thorn. Pale cuts run through the growth like old pruning scars. It carries itself like a keeper who has spent years deciding what the Wood is allowed to keep.",
      "DM DESIGN READ. The Reeve does not lock movement or force targets into place. It either prunes through raw damage or makes ignoring it expensive. A martial can clear Spoiling Cut by committing an attack to the Reeve, then spend any remaining attacks elsewhere. No recharge ability and no special reaction are part of this block.",
      "UNPRICED IN EHP. Spoiling Cut takes 5 off every damage instance the target aims at anyone except the Reeve. That is ally-side damage prevention, nearest to the workbook's Fixed prevention - 8/round (+0.141871), but it is conditional, single-target and cleared by attacking the Reeve. Left unpriced pending a calibration decision: v3.23 states the fight's 253 raw HP is the figure BEFORE trait, control, reaction, targeting and Winter's Toll conversion."
    ],
    "visibility": {
      "defaultState": "hp-bar",
      "hiddenName": "Blackbough Reeve",
      "revealedName": "Blackbough Reeve"
    },
    "dmEdited": {
      "at": "2026-09-21T19:02:55.135Z"
    }
  },
  {
    "templateId": "broken-chain:act3:brandwing:v1",
    "name": "Brandwing",
    "encounterId": "act3-e7-the-last-court",
    "encounterLabel": "Act 3 E7 - The Last Court",
    "stats": {
      "kind": "fiend",
      "ac": 17,
      "maxHp": 111,
      "speed": "40 ft., fly 40 ft.",
      "defenses": [
        {
          "name": "Magic Resistance",
          "ehpMultiplier": 1.115824,
          "rule": "Magic Resistance",
          "note": "Workbook: Magic Resistance (+0.115824), exact. Advantage on saving throws against spells and other magical effects."
        }
      ],
      "attacksPerTurn": 2,
      "size": "Medium",
      "classification": "elite",
      "archetype": "tactician",
      "skills": [
        {
          "label": "Perception",
          "modifier": 8
        },
        {
          "label": "Investigation",
          "modifier": 9
        }
      ],
      "proficiencyBonus": 4
    },
    "abilities": [
      {
        "label": "STR",
        "value": "10 (+0)"
      },
      {
        "label": "DEX",
        "value": "20 (+5)",
        "saveProficient": true
      },
      {
        "label": "CON",
        "value": "10 (+0)"
      },
      {
        "label": "INT",
        "value": "20 (+5)",
        "saveProficient": true
      },
      {
        "label": "WIS",
        "value": "18 (+4)",
        "saveProficient": true
      },
      {
        "label": "CHA",
        "value": "14 (+2)"
      }
    ],
    "traits": [
      {
        "name": "Magic Resistance",
        "kind": "trait",
        "text": "Brandwing has Advantage on saving throws against spells and other magical effects."
      },
      {
        "name": "The Opening / Write the Ending",
        "kind": "trait",
        "text": "Brandwing can mark only one creature at a time with either Calculated Angle or Closing Stroke. If Brandwing marks another creature, the previous mark ends. Which action Brandwing can use is determined by the target’s current Hit Points. Brandwing can use Calculated Angle only against a creature that has more than half its Hit Point maximum, and it can use Closing Stroke only against a creature that has half its Hit Point maximum or fewer."
      }
    ],
    "actions": [
      {
        "name": "Calculated Angle",
        "kind": "action",
        "economyCost": "bonus",
        "targets": 1,
        "damage": "",
        "text": "Brandwing targets one creature it can see within 90 feet and marks it. Brandwing’s Ember Lance attacks against the marked target ignore Half Cover and Three-Quarters Cover, and Brandwing doesn’t have Disadvantage on those attack rolls.",
        "range": "90 FT"
      },
      {
        "name": "Closing Stroke",
        "kind": "action",
        "range": "90 ft.",
        "targets": 1,
        "riders": [
          {
            "name": "Closing Stroke",
            "damage": "2d6",
            "cadence": "once-per-turn",
            "note": "marked below half maximum Hit Points",
            "damageType": "Psychic"
          }
        ],
        "text": "Brandwing targets one creature it can see within 90 feet and marks it. The first time Brandwing hits the marked target with Ember Lance, the target takes an extra 7 (2d6) Psychic damage, and the mark ends. After this extra damage is dealt, Brandwing can’t target that creature with Closing Stroke again until the encounter ends.",
        "economyCost": "bonus"
      },
      {
        "name": "Ember Lance",
        "kind": "attack",
        "economyCost": "action",
        "roll": "1d20+@ATK",
        "damage": "2d12 + @DEX",
        "damageType": "Fire",
        "routineSlots": 2,
        "extraDamage": [
          {
            "damage": "1d12",
            "damageType": "Psychic"
          }
        ],
        "range": "range 120 ft., one target",
        "targets": 1
      }
    ],
    "reactions": [
      {
        "name": "Cinder Skip",
        "kind": "action",
        "text": "When Brandwing is hit by an attack or targeted by a spell, the attack or spell resolves completely, then Brandwing teleports up to 15 feet to an unoccupied space it can see. The space it leaves and the space it enters briefly flare with infernal fire. Demon Knight of"
      }
    ],
    "resources": [],
    "notes": [
      "A narrow Fiend with wing-like sheets of ember script. It writes on bark by touching it and leaves the letters burning after its hand is gone. "
    ],
    "visibility": {
      "defaultState": "hp-bar",
      "hiddenName": "Brandwing",
      "revealedName": "Brandwing"
    },
    "dmEdited": {
      "at": "2026-09-13T06:04:36.926Z"
    }
  },
  {
    "templateId": "broken-chain:act3:breaker:v1",
    "name": "Breaker",
    "encounterId": "act3-e8-the-occupied-acre",
    "encounterLabel": "Act 3 E8 - The Occupied Acre",
    "stats": {
      "kind": "fiend",
      "ac": 16,
      "maxHp": 122,
      "speed": "40 ft.",
      "defenses": [
        {
          "name": "Four-Limbed Brace",
          "ehpMultiplier": 1.038413,
          "provenance": "interpolated",
          "note": "v3.44 ADDS THIS REACTION: when an attack hits the Breaker while it is Grappling, reduce that damage by 4 — and it must then release one grappled creature. Interpolated at half the workbook's 8/round fixed-prevention anchor (+0.038413). ⚠ AND IT COSTS THE THING THE BREAKER IS FOR: every use hands back a captive, so a party that keeps hitting it takes the grapples off one at a time. The multiplier prices the damage prevented and NOT that cost, so it is a ceiling on the defence and understates the tempo the party wins back."
        },
        {
          "name": "No notable defensive traits",
          "ehpMultiplier": 1,
          "note": "v3.44: Two-Handed Hold, Pile the Captives and the grapples are CONTROL - they move bodies and deny position, they do not reduce damage taken. Cast Aside is retired. Four-Point Brace is anti-prone. v3.23: AC 15 is intentional, the party should be able to hit it while still working through its HP. A plain HP bar is the correct read for the body."
        }
      ],
      "attacksPerTurn": 4,
      "size": "Large",
      "classification": "elite",
      "archetype": "bruiser",
      "skills": [
        {
          "label": "Athletics",
          "modifier": 9
        },
        {
          "label": "Perception",
          "modifier": 7
        }
      ],
      "proficiencyBonus": 4
    },
    "abilities": [
      {
        "label": "STR",
        "value": "21 (+5)",
        "saveProficient": true
      },
      {
        "label": "DEX",
        "value": "14 (+2)"
      },
      {
        "label": "CON",
        "value": "18 (+4)",
        "saveProficient": true
      },
      {
        "label": "INT",
        "value": "12 (+1)"
      },
      {
        "label": "WIS",
        "value": "16 (+3)",
        "saveProficient": true
      },
      {
        "label": "CHA",
        "value": "17 (+3)"
      }
    ],
    "traits": [
      {
        "name": "Two-Handed Hold",
        "kind": "trait",
        "targets": 2,
        "text": "The Breaker can grapple up to two creatures at the same time, one with each grasping limb. A grasping limb holding a creature cannot be used to attack another target until that grapple ends."
      },
      {
        "name": "Four-Point Brace",
        "kind": "trait",
        "text": "The Breaker has Advantage on saving throws against effects that would give it the Prone condition or move it against its will."
      }
    ],
    "actions": [
      {
        "name": "Pile the Captives",
        "kind": "action",
        "economyCost": "bonus",
        "text": "The Breaker moves each creature Grappled by it to another unoccupied space within its reach. If two creatures moved this way end adjacent to each other, each has Disadvantage on the next ability check it makes to escape the Breaker's Grapple before the start of the Breaker's next turn."
      },
      {
        "name": "Grasping Limb",
        "kind": "attack",
        "routineSlots": 2,
        "roll": "1d20+9",
        "damage": "2d6 + 4",
        "damageType": "Bludgeoning",
        "range": "reach 10 ft., one Medium or smaller creature",
        "text": "and the target has the Grappled condition (escape DC 17). A limb already holding a creature can't attack another target."
      },
      {
        "name": "Heavy Blow",
        "kind": "attack",
        "routineSlots": 2,
        "roll": "1d20+9",
        "damage": "2d8 + 5",
        "damageType": "Bludgeoning",
        "range": "reach 5 ft",
        "targets": 1,
        "text": "Cast Aside (1/Turn). After the Breaker hits with Grasping Limb, it can move one creature Grappled by it to another unoccupied space within 10 feet. This forced movement doesn't provoke Opportunity Attacks. If the creature is placed beyond the reach of the limb holding it, that grapple ends."
      }
    ],
    "reactions": [
      {
        "name": "Four-Limbed Brace",
        "kind": "action",
        "targets": 1,
        "text": "When an attack hits the Breaker while it is Grappling a creature, reduce the triggering damage by 4. The Breaker must then release one creature it is Grappling."
      }
    ],
    "resources": [],
    "notes": [
      "A massive four-limbed Fiend built to ruin formation rather than hold ground. Two long grasping limbs reach ahead of its shoulders while the shorter arms hammer whatever remains close. It is broad, obvious, and easy to hit; the problem is how much body must be cut through before it stops rearranging the fight.",
      "DM DESIGN READ. The Breaker enters the party's shape rather than defending a point. Its four-attack routine lets it seize up to two bodies while Heavy Blows keep the turn relevant; Cast Aside is the formation-breaking payoff.",
      "THE ROUTINE IS A FIXED 2+2 SPLIT, not four of the best attack. Grasping Limb averages 8.5 and Heavy Blow 9.5, so the authored routine is 2x8.5 + 2x9.5 = 36 before to-hit, while a free choice of four would read 38. Check the DPR column against 36, not 38."
    ],
    "visibility": {
      "defaultState": "hp-bar",
      "hiddenName": "Breaker",
      "revealedName": "Breaker"
    }
  },
  {
    "templateId": "broken-chain:act3:darkmare:v1",
    "name": "Darkmare",
    "encounterId": "act3-e3-gate-i-crone-and-mare",
    "encounterLabel": "Act 3 E3 - Gate I: The Crone and the Mare",
    "stats": {
      "proficiencyBonus": 3,
      "kind": "fiend",
      "ac": 13,
      "maxHp": 122,
      "speed": "50 ft.",
      "defenses": [
        {
          "name": "Darkmane (Constant)",
          "ehpMultiplier": 1.11326,
          "persistent": true,
          "rule": "Concealment until first attack hits each round",
          "note": "Workbook: Concealment until first attack hits each round (+0.113260). One-way magical obscurement, permanent. v3.44 names the trait \"Darkmane (Constant)\" and the row follows it, because check:traits matches a defence to the trait it prices BY NAME. ⚠ THE SECOND HALF IS DECIDED, NOT MISSED: the trait also grants Advantage on saves against spells WHILE NO ALLY IS INSIDE the veil, which is Magic Resistance (+0.115824). It is deliberately NOT added — Darkmare is fielded beside the Veilwood Crone and spends the fight keeping her inside Darkmane, so the condition that would switch it on is the one the pair is built to avoid. Pricing it would charge the party for a defence this roster gives up on purpose."
        },
        {
          "name": "Shadow Shroud (1/Day)",
          "ehpMultiplier": 1.056615,
          "provenance": "interpolated",
          "note": "Workbook: temporary AC, interpolated to +2 AC for 1 round from the +5 AC anchor (+0.056615)."
        }
      ],
      "attacksPerTurn": 2,
      "size": "Large",
      "classification": "mid-boss",
      "archetype": "bruiser",
      "skills": [
        {
          "label": "Perception",
          "modifier": 5
        }
      ]
    },
    "abilities": [
      {
        "label": "STR",
        "value": "20 (+5)"
      },
      {
        "label": "DEX",
        "value": "18 (+4)"
      },
      {
        "label": "CON",
        "value": "14 (+2)"
      },
      {
        "label": "INT",
        "value": "10 (+0)"
      },
      {
        "label": "WIS",
        "value": "14 (+2)"
      },
      {
        "label": "CHA",
        "value": "15 (+2)"
      }
    ],
    "traits": [
      {
        "name": "Darkmane (Constant)",
        "kind": "trait",
        "text": "Darkmare is the centre of a constant 30-foot-radius one-way magical veil. The radius is locked and the aura moves with Darkmare. Attack rolls against Darkmare and allied creatures inside Darkmane have Disadvantage. While Darkmare has no allied creature inside Darkmane, it has Advantage on saving throws against spells and magical effects."
      }
    ],
    "actions": [
      {
        "name": "Umbral Passage",
        "kind": "action",
        "economyCost": "bonus",
        "text": "Darkmare moves or teleports up to 30 feet and can carry one willing allied creature inside Darkmane. It cannot use this Bonus Action while its Speed is below 34 feet."
      },
      {
        "name": "Horn",
        "kind": "attack",
        "roll": "1d20+8",
        "damage": "2d12 + 4",
        "damageType": "Cold",
        "range": "reach 5 ft."
      },
      {
        "name": "Hooves",
        "kind": "attack",
        "roll": "1d20+8",
        "damage": "2d8 + 5",
        "damageType": "Bludgeoning",
        "range": "reach 5 ft."
      },
      {
        "name": "Shadow Shroud (1/Day)",
        "kind": "action",
        "uses": 1,
        "targets": 1,
        "text": "Action: choose Darkmare and one creature within 60 ft. Both targets gain +2 AC until the end of Darkmare’s next turn, and attacks against each target have Disadvantage until that target is hit once. The Disadvantage ends for a target on its first hit; the AC duration does not."
      }
    ],
    "reactions": [
      {
        "name": "Dusk Interpose",
        "kind": "action",
        "text": "When an allied creature inside Darkmane is targeted by an attack while Darkmare is within 10 feet of it, Darkmare and that ally swap spaces. If Darkmare is a legal target, it becomes the target of the attack."
      }
    ],
    "resources": [],
    "notes": [
      "A war-mount shaped from a noble silhouette and then invaded from the inside. Its hooves do not ask the Wood for a road; they burn one."
    ],
    "visibility": {
      "defaultState": "hp-bar",
      "hiddenName": "Darkmare",
      "revealedName": "Darkmare"
    }
  },
  {
    "templateId": "broken-chain:act3:demon-knight-of-punishment:v1",
    "name": "Demon Knight of Punishment",
    "encounterId": "act3-e8-the-occupied-acre",
    "encounterLabel": "Act 3 E8 - The Occupied Acre",
    "stats": {
      "kind": "fiend",
      "ac": 17,
      "maxHp": 130,
      "speed": "30 ft.",
      "defenses": [
        {
          "name": "Shattered Plate",
          "ehpMultiplier": 1.028819,
          "provenance": "interpolated",
          "note": "Workbook: Fixed prevention, interpolated to 3/round below the 8/round anchor (+0.028819). The first time each round the Knight takes bludgeoning, piercing or slashing damage, reduce it by 3 — the SAME mechanic and the same interpolation as the Hollow Warden’s Barkhide. ⚠ NOT the calibrated \"Flat DR 3 per damaging hit [volatile]\" row (+0.377915): that one pays on EVERY hit, and this trait pays once a round. The classifier reaches for the per-hit row because the words match; the cadence is what separates them."
        }
      ],
      "attacksPerTurn": 1,
      "size": "Medium",
      "classification": "elite",
      "archetype": "guardian",
      "skills": [
        {
          "label": "Intimidation",
          "modifier": 7
        },
        {
          "label": "Perception",
          "modifier": 6
        }
      ],
      "proficiencyBonus": 4
    },
    "abilities": [
      {
        "label": "STR",
        "value": "18 (+4)"
      },
      {
        "label": "DEX",
        "value": "14 (+2)"
      },
      {
        "label": "CON",
        "value": "19 (+4)",
        "saveProficient": true
      },
      {
        "label": "INT",
        "value": "14 (+2)"
      },
      {
        "label": "WIS",
        "value": "14 (+2)",
        "saveProficient": true
      },
      {
        "label": "CHA",
        "value": "17 (+3)"
      }
    ],
    "traits": [
      {
        "name": "Retaliatory Shock",
        "kind": "trait",
        "text": "When the Demon Knight of Punishment takes physical damage, each enemy within 10 feet of the Knight takes piercing damage equal to the Knight's Constitution modifier + 2 (6). The triggering damage resolves normally."
      },
      {
        "name": "Shattered Plate",
        "kind": "trait",
        "text": "The first time each round the Knight takes bludgeoning, piercing, or slashing damage, reduce it by 3."
      },
      {
        "name": "Demanding Presence",
        "kind": "trait",
        "text": "When a hostile creature the Demon Knight can see within 30 feet takes an action that targets multiple creatures, it must include the Knight among those targets if the Knight is within range and is a legal target.",
        "rosterInteraction": {
          "kind": "forced_target_order"
        }
      }
    ],
    "actions": [
      {
        "name": "Reckless Sentence",
        "kind": "action",
        "economyCost": "bonus",
        "text": "Until the start of the Knight's next turn, the Knight has Advantage on attack rolls, and attack rolls against it have Advantage.",
        "grantsAdvantage": "own-attacks"
      },
      {
        "name": "Iron Grasp",
        "kind": "attack",
        "roll": "1d20+8",
        "damage": "2d8 + 4",
        "damageType": "Bludgeoning",
        "range": "reach 5 ft., one Large or smaller creature",
        "targets": 1,
        "text": "and the target has the Grappled condition (escape DC 16). Until the grapple ends, the target also has the Restrained condition. The Knight can restrain only one creature this way at a time."
      }
    ],
    "reactions": [
      {
        "name": "Commanding Presence",
        "kind": "action",
        "text": "When a hostile creature the Knight can see within 30 feet of it takes an action that targets a single creature other than the Knight, the Knight becomes the target instead if it is within range and is a legal target.",
        "rosterInteraction": {
          "kind": "forced_target_order"
        }
      }
    ],
    "resources": [],
    "notes": [
      "A broad knight-shape locked inside shattered infernal plate. The transformation has split the armor open at the joints and driven barbs through the seams, leaving it easier to strike than the intact knight it once resembled. It does not evade attention. It makes attention expensive.",
      ""
    ],
    "visibility": {
      "defaultState": "hp-bar",
      "hiddenName": "Demon Knight of Punishment",
      "revealedName": "Demon Knight of Punishment"
    }
  },
  {
    "templateId": "broken-chain:act3:demonic-reaver:v1",
    "name": "Demonic Reaver",
    "encounterId": "act3-e8-the-occupied-acre",
    "encounterLabel": "Act 3 E8 - The Occupied Acre",
    "stats": {
      "kind": "fiend",
      "ac": 18,
      "maxHp": 103,
      "speed": "40 ft.",
      "defenses": [
        {
          "name": "Shifting Outline",
          "ehpMultiplier": 1.227798,
          "provenance": "derived",
          "note": "v3.44 RENAMES THIS TRAIT from Blur; the pricing is unchanged and the row follows the name because check:traits matches a defence to the trait it prices BY NAME. DERIVED from two published sources, not estimated. Attack rolls against the Reaver have disadvantage, permanently and against every attack. v9 Pricing Resolver row 21 publishes the math: base p=clamp((21+AB-AC)/20,.05,.95), disadvantage=p^2. The AC increase equivalent to turning p into p-squared is dAC=20p(1-p), which is remarkably flat across every plausible hit chance - 5.00 at p=0.50, 4.95 at p=0.55, 4.80 at p=0.60 - so permanent disadvantage IS +5 AC. Priced through the app-s own AC_CONTRIBUTION bands and their published combining rule: +3 (0.140100) + +2 (0.087698) = 0.227798. Cross-check: the calibrated All attacks at disadvantage - 1 round row is +0.129416, so permanent reads 1.76x a single round, which is the right order for a three-to-four round fight."
        }
      ],
      "attacksPerTurn": 2,
      "size": "Medium",
      "classification": "elite",
      "archetype": "skirmisher",
      "skills": [
        {
          "label": "Acrobatics",
          "modifier": 8
        },
        {
          "label": "Stealth",
          "modifier": 12
        },
        {
          "label": "Perception",
          "modifier": 12
        }
      ],
      "proficiencyBonus": 4
    },
    "abilities": [
      {
        "label": "STR",
        "value": "10 (+0)"
      },
      {
        "label": "DEX",
        "value": "18 (+4)",
        "saveProficient": true
      },
      {
        "label": "CON",
        "value": "12 (+1)"
      },
      {
        "label": "INT",
        "value": "16 (+3)"
      },
      {
        "label": "WIS",
        "value": "18 (+4)",
        "saveProficient": true
      },
      {
        "label": "CHA",
        "value": "14 (+2)"
      }
    ],
    "traits": [
      {
        "name": "Shifting Outline",
        "kind": "trait",
        "text": "The Reaver’s outline shifts and shimmers out of place. Attack rolls against it have Disadvantage. An attacker that does not rely on sight, or that can see through illusions, ignores this effect."
      },
      {
        "name": "Scent the Expense",
        "kind": "trait",
        "text": "Whenever a hostile creature the Reaver can see within 60 feet expends a limited-use resource, that creature becomes the Reaver’s quarry, replacing any previous quarry. Spell slots, class features with limited uses, consumables, and magic-item charges qualify; recurring once-per-turn riders that do not expend a use do not. At the start of the Reaver’s turn, its current quarry is locked until the end of that turn. While moving toward its quarry, the Reaver’s movement is doubled. Once per turn when the Reaver hits its quarry with an attack, the hit deals an extra 11 (3d6 + 1) Fire damage"
      }
    ],
    "actions": [
      {
        "name": "Close on the Expense",
        "kind": "action",
        "economyCost": "bonus",
        "text": "The Reaver moves up to half its Speed toward its locked quarry. This movement provokes Opportunity Attacks normally. If the Reaver ends within 5 feet of the quarry, it has Advantage on the next Rending Talon attack it makes against that creature before the end of the turn."
      },
      {
        "name": "Rending Talon",
        "kind": "attack",
        "roll": "1d20+8",
        "damage": "2d10 + 3",
        "damageType": "Slashing",
        "range": "reach 5 ft.",
        "riders": [
          {
            "name": "Searing Edge",
            "damage": "2d6",
            "damageType": "Fire",
            "cadence": "per-hit"
          },
          {
            "name": "Quarry Strike",
            "damage": "3d6 + 1",
            "damageType": "Fire",
            "cadence": "once-per-turn",
            "note": "Only against the creature the Reaver marked with Choose the Quarry. Counted as met: the mark is a Bonus Action the Reaver spends on the target it is attacking, so it is the Reaver's own choice rather than a condition the party controls."
          }
        ]
      }
    ],
    "reactions": [
      {
        "name": "Choose the Quarry",
        "kind": "action",
        "text": "When a sight-dependent attack misses the Reaver because of Shifting Outline, the attacker becomes the Reaver's quarry, replacing any previous quarry. The Reaver has Advantage on the next Rending Talon attack it makes against that creature before the end of its next turn."
      }
    ],
    "resources": [],
    "notes": [
      "A hunter that tracks expenditure rather than position. It reads the moment a resource leaves a caster's hands and goes straight for it.",
      "DM DESIGN READ. The Reaver hunts actual expenditure, not passive Gift riders. The most recent qualifying spender before its turn becomes the quarry; once the turn begins that quarry locks. Blur makes attack-roll focus inefficient, while doubled pursuit movement and the 4d4 quarry rider make spending a real resource visible and dangerous.",
      "THE QUARRY RIDER IS NOT IN THE DPR. Scent the Expense adds 10 (4d4) fire once per turn on a hit against the quarry - about a third again on top of the routine - but it fires only when the party spends a limited-use resource, which is party state the trace does not model. The DPR below is the floor, not the ceiling."
    ],
    "visibility": {
      "defaultState": "hp-bar",
      "hiddenName": "Demonic Reaver",
      "revealedName": "Demonic Reaver"
    }
  },
  {
    "templateId": "broken-chain:act3:folded-bulwark:v1",
    "name": "Folded Bulwark",
    "encounterId": "act3-e4-the-hollow-feast",
    "encounterLabel": "Act 3 E4 - The Hollow Feast",
    "stats": {
      "kind": "fiend",
      "ac": 18,
      "maxHp": 75,
      "speed": "25 ft.",
      "defenses": [
        {
          "name": "Take the Blow — no effective-HP contribution",
          "ehpMultiplier": 1,
          "note": "Doc v3_13: this is priced by the runtime trace. It redirects an attack to the guardian; it does not add effective HP to the roster. v3.44 renames Interpose to Take the Blow and the mechanic is unchanged. Braced Form (anti-prone), Interposing Bulk (difficult terrain through its reach) and Hunker Wide (Speed 0 for Half Cover) are position, not damage reduction."
        }
      ],
      "attacksPerTurn": 2,
      "size": "Large",
      "classification": "strong",
      "archetype": "guardian",
      "skills": [
        {
          "label": "Athletics",
          "modifier": 7
        }
      ],
      "proficiencyBonus": 3
    },
    "abilities": [
      {
        "label": "STR",
        "value": "18 (+4)",
        "saveProficient": true
      },
      {
        "label": "DEX",
        "value": "10 (+0)"
      },
      {
        "label": "CON",
        "value": "18 (+4)",
        "saveProficient": true
      },
      {
        "label": "INT",
        "value": "8 (-1)"
      },
      {
        "label": "WIS",
        "value": "14 (+2)"
      },
      {
        "label": "CHA",
        "value": "12 (+1)"
      }
    ],
    "traits": [
      {
        "name": "Braced Form",
        "kind": "trait",
        "text": "The Bulwark has Advantage on saving throws and ability checks made to resist effects that would give it the Prone condition or move it against its will."
      },
      {
        "name": "Interposing Bulk",
        "kind": "trait",
        "text": "A hostile creature moving through the Bulwark’s reach toward a creature on the opposite side of the Bulwark treats that movement as difficult terrain."
      }
    ],
    "actions": [
      {
        "name": "Hunker Wide",
        "kind": "action",
        "economyCost": "bonus",
        "text": "Until the start of the Bulwark's next turn, its Speed becomes 0 and allied creatures within 5 feet of it have Half Cover."
      },
      {
        "name": "Heavy Fist",
        "kind": "attack",
        "roll": "1d20+7",
        "damage": "1d12 + 4",
        "damageType": "Bludgeoning",
        "range": "reach 5 ft."
      }
    ],
    "reactions": [
      {
        "name": "Take the Blow",
        "kind": "action",
        "text": "When an allied creature within 5 feet is targeted by an attack, the Bulwark becomes the target if it is a legal target."
      }
    ],
    "resources": [],
    "notes": [
      "A broad Fiend built from overlapping folds of black-red hide and dense plated tissue. Its mass spreads sideways rather than upward. It carries no chains, stakes, saintly shape, or siege hardware; every part of it looks designed for one purpose - putting itself between danger and the creature beside it.",
      "Bodyguard. Protects any nearby ally, but its encounter priority is the Regent. Killing it does NOT turn the Host hostile."
    ],
    "visibility": {
      "defaultState": "hp-bar",
      "hiddenName": "Folded Bulwark",
      "revealedName": "Folded Bulwark"
    }
  },
  {
    "templateId": "broken-chain:act3:gloam-harrow:v1",
    "name": "Gloam Harrow",
    "encounterId": "act3-e7-the-last-court",
    "encounterLabel": "Act 3 E7 - The Last Court",
    "stats": {
      "kind": "fey",
      "ac": 16,
      "maxHp": 118,
      "speed": "30 ft.",
      "defenses": [
        {
          "name": "Fey Mind",
          "ehpMultiplier": 1,
          "note": "DECIDED 1.0, not unassessed. Advantage on saves against being charmed, and magic cannot put her to sleep. Condition defence, which the workbook publishes with a NULL contribution. No damage is reduced."
        }
      ],
      "attacksPerTurn": 1,
      "size": "Medium",
      "classification": "elite",
      "archetype": "commander",
      "skills": [
        {
          "label": "Insight",
          "modifier": 7
        },
        {
          "label": "Persuasion",
          "modifier": 8
        }
      ],
      "proficiencyBonus": 3
    },
    "abilities": [
      {
        "label": "STR",
        "value": "10 (+0)"
      },
      {
        "label": "DEX",
        "value": "16 (+3)"
      },
      {
        "label": "CON",
        "value": "10 (+0)"
      },
      {
        "label": "INT",
        "value": "12 (+1)"
      },
      {
        "label": "WIS",
        "value": "18 (+4)",
        "saveProficient": true
      },
      {
        "label": "CHA",
        "value": "20 (+5)",
        "saveProficient": true
      }
    ],
    "traits": [
      {
        "name": "Fey Mind",
        "kind": "trait",
        "text": "Gloam Harrow has Advantage on saving throws against being Charmed, and is Immune to sleep effects."
      }
    ],
    "actions": [
      {
        "name": "Cruel Instruction",
        "kind": "action",
        "economyCost": "bonus",
        "text": "The Harrow chooses one ally inside Winter's Toll. That ally makes one normal attack.",
        "rosterInteraction": {
          "kind": "ally_extra_attack",
          "requiresZone": "Winter’s Toll"
        }
      },
      {
        "name": "Winter Needle",
        "kind": "attack",
        "roll": "1d20+8",
        "damage": "1d10 + 4",
        "damageType": "Cold",
        "range": "range 90 ft., one target",
        "targets": 1,
        "extraDamage": [
          {
            "damage": "1d10",
            "damageType": "Psychic"
          }
        ]
      },
      {
        "name": "Winter’s Toll",
        "kind": "spell",
        "text": "Gloam Harrow fills a 15-foot cube centered on a point she can see within 60 feet of her with biting Fey glamour. The effect lasts until the end of the next round and requires concentration. Allies in the area gain a +3 bonus to attack rolls and saving throws. Hostile creatures in the area take a −3 penalty to those rolls.",
        "range": "60 FT, 15 FT cube.",
        "rosterInteraction": {
          "kind": "roll_modifier_zone",
          "allyAttack": 3,
          "allySave": 3,
          "hostileAttack": -3,
          "hostileSave": -3,
          "durationRounds": 2
        },
        "concentration": true
      }
    ],
    "reactions": [
      {
        "name": "Cold Counsel",
        "kind": "action",
        "text": "When an ally inside Winter's Toll is targeted by an attack, Gloam Harrow moves that ally up to half its speed. This movement does not provoke opportunity attacks. If the ally is no longer a legal target, the attacker must choose another legal target.",
        "rosterInteraction": {
          "kind": "target_substitution",
          "requiresZone": "Winter’s Toll"
        }
      }
    ],
    "resources": [],
    "notes": [
      "A courtly Fey in a mantle of dead-green leaves stitched through with pale winter light. She speaks of hardship as cultivation: the Wood has sheltered too much, spared too much, and should learn again what deserves to survive."
    ],
    "visibility": {
      "defaultState": "hp-bar",
      "hiddenName": "Gloam Harrow",
      "revealedName": "Gloam Harrow"
    }
  },
  {
    "templateId": "broken-chain:act3:grief-colossus:v1",
    "name": "Grief Colossus",
    "encounterId": "act3-e10-the-center",
    "encounterLabel": "Act 3 E10 - The Center",
    "stats": {
      "kind": "aberration",
      "ac": 18,
      "maxHp": 261,
      "speed": "35 ft.",
      "defenses": [
        {
          "name": "Legendary Resistance (1/Day)",
          "ehpMultiplier": 1.042458,
          "rule": "Legendary Resistance - 1 use",
          "note": "Workbook: Legendary Resistance - 1 use (+0.042458), exact."
        },
        {
          "name": "Weight of Grief",
          "ehpMultiplier": 1,
          "note": "⚠ v3.44 REPLACED A DAMAGE DEFENCE WITH A CONDITION REDIRECT, and the old multiplier would have been a straight overprice. Body Between reduced the triggering damage by 12 once per round — the workbook's exact Fixed prevention 12/round row (+0.232313). Weight of Grief reduces NO DAMAGE: it takes a failed save's forced movement or condition off the Thought Harrower and onto the Colossus. That is protection for a DIFFERENT body against a DIFFERENT thing, and it belongs to the control model, not to this creature's effective HP. DECIDED 1.0."
        }
      ],
      "attacksPerTurn": 2,
      "size": "Huge",
      "classification": "act-boss",
      "archetype": "guardian",
      "skills": [
        {
          "label": "Athletics",
          "modifier": 10
        }
      ],
      "proficiencyBonus": 4
    },
    "abilities": [
      {
        "label": "STR",
        "value": "22 (+6)",
        "saveProficient": true
      },
      {
        "label": "DEX",
        "value": "16 (+3)"
      },
      {
        "label": "CON",
        "value": "22 (+6)",
        "saveProficient": true
      },
      {
        "label": "INT",
        "value": "8 (-1)"
      },
      {
        "label": "WIS",
        "value": "10 (+0)"
      },
      {
        "label": "CHA",
        "value": "10 (+0)"
      }
    ],
    "traits": [
      {
        "name": "Legendary Resistance (1/Day)",
        "kind": "trait",
        "uses": 1,
        "text": "If the Colossus fails a saving throw, it can choose to succeed instead."
      },
      {
        "name": "Impossible Mass",
        "kind": "trait",
        "text": "The Colossus has Advantage on saving throws against effects that would give it the Prone condition or move it against its will."
      }
    ],
    "actions": [
      {
        "name": "Anchor the Wrong",
        "kind": "action",
        "economyCost": "bonus",
        "text": "Until the start of its next turn, the Colossus's Speed becomes 0, its reach increases by 5 feet, and it cannot be moved against its will."
      },
      {
        "name": "Slam",
        "kind": "attack",
        "roll": "1d20+10",
        "damage": "5d12 + 5",
        "damageType": "Bludgeoning",
        "range": "reach 10 ft."
      },
      {
        "name": "Collapse Space (Recharge 5–6)",
        "kind": "action",
        "damage": "7d8 + 7",
        "damageType": "Force",
        "save": "STR DC 18",
        "onSave": "half",
        "recharge": "5-6",
        "text": "Strength Saving Throw: DC 18, each creature of the Colossus's choice within 15 feet. Failure: 39 (7d8 + 7) Force damage, and the creature has the Prone condition. Success: Half damage only."
      }
    ],
    "reactions": [
      {
        "name": "Weight of Grief",
        "kind": "action",
        "text": "When the Thought Harrower within 30 feet fails a saving throw and the effect would move it against its will or give it a condition, the Colossus becomes the target of the effect instead, provided the effect could affect the Colossus. The Colossus makes no new saving throw."
      }
    ],
    "resources": [],
    "notes": [
      "The weight behind the thought. Its limbs do not bend in the same number of places twice, but when it decides a space is occupied, the battlefield has to argue with several tons of certainty."
    ],
    "visibility": {
      "defaultState": "hp-bar",
      "hiddenName": "Grief Colossus",
      "revealedName": "Grief Colossus"
    }
  },
  {
    "templateId": "broken-chain:act3:marrowstalk:v1",
    "name": "Marrowstalk",
    "encounterId": "act3-e2-the-cut-below",
    "encounterLabel": "Act 3 E2 - The Cut Below",
    "stats": {
      "kind": "fiend",
      "ac": 15,
      "maxHp": 79,
      "speed": "30 ft.",
      "defenses": [
        {
          "name": "No notable defensive traits",
          "ehpMultiplier": 1,
          "note": "v3.44: Crushed Passage is terrain, Hooked Wound is a speed debuff on the TARGET, and Hooked Stance is anti-prone. None of the three reduces damage taken. Breakroot and Marrow Grip are retired. Plain HP bar."
        }
      ],
      "attacksPerTurn": 2,
      "size": "Large",
      "classification": "elite",
      "archetype": "bruiser",
      "skills": [
        {
          "label": "Athletics",
          "modifier": 7
        }
      ],
      "proficiencyBonus": 3
    },
    "abilities": [
      {
        "label": "STR",
        "value": "18 (+4)",
        "saveProficient": true
      },
      {
        "label": "DEX",
        "value": "16 (+3)"
      },
      {
        "label": "CON",
        "value": "18 (+4)",
        "saveProficient": true
      },
      {
        "label": "INT",
        "value": "10 (+0)"
      },
      {
        "label": "WIS",
        "value": "10 (+0)"
      },
      {
        "label": "CHA",
        "value": "12 (+1)"
      }
    ],
    "traits": [
      {
        "name": "Crushed Passage",
        "kind": "trait",
        "text": "The first 10 ft. of natural difficult terrain Marrowstalk enters on a turn costs no extra movement. The spaces it crosses become scarred until the start of its next turn; natural difficult terrain in those spaces is suppressed, and a hostile creature entering a scarred space spends 5 extra ft. of movement."
      },
      {
        "name": "Hooked Wound",
        "kind": "trait",
        "text": "A creature hit by Hooking Claw has its speed reduced by 10 ft. until the start of Marrowstalk’s next turn; multiple hits do not stack."
      },
      {
        "name": "Hooked Stance",
        "kind": "trait",
        "text": "Marrowstalk has Advantage on saving throws against effects that would give it the Prone condition or move it against its will."
      }
    ],
    "actions": [
      {
        "name": "Hook and Hammer",
        "kind": "attack",
        "economyCost": "bonus",
        "roll": "1d20+7",
        "damage": "1d6 + 4",
        "damageType": "Bludgeoning",
        "range": "reach 5 feet",
        "targets": 1,
        "text": "Immediately after Marrowstalk hits one creature with both Hooking Claw attacks on the same turn, it makes one Heavy Knee attack against that creature:"
      },
      {
        "name": "Hooking Claw",
        "kind": "attack",
        "roll": "1d20+7",
        "damage": "2d8 + 3",
        "damageType": "Slashing",
        "range": "reach 10 ft."
      },
      {
        "name": "Crushing Cast (Recharge 5–6)",
        "kind": "action",
        "damage": "6d6",
        "damageType": "Bludgeoning",
        "save": "STR DC 15",
        "onSave": "half",
        "recharge": "5-6",
        "targets": 1,
        "text": "Strength Saving Throw: DC 15, one creature within 10 feet. Failure: 21 (6d6) Bludgeoning damage, the target has the Prone condition, and Marrowstalk moves it up to 10 feet into a space Marrowstalk can see. Success: Half damage only; the target is not moved."
      }
    ],
    "reactions": [
      {
        "name": "Turn the Hook",
        "kind": "action",
        "text": "When a creature within 10 feet hits Marrowstalk with a melee attack, Marrowstalk moves the attacker to another unoccupied space within its reach. This forced movement does not provoke Opportunity Attacks."
      }
    ],
    "resources": [],
    "notes": [
      "A heavy Fiend whose limbs look assembled around the idea of a hook. It does not pass through undergrowth; it crushes a corridor through it and leaves that corridor wrong behind it."
    ],
    "visibility": {
      "defaultState": "hp-bar",
      "hiddenName": "Marrowstalk",
      "revealedName": "Marrowstalk"
    }
  },
  {
    "templateId": "broken-chain:act3:quillshrike:v1",
    "name": "Quillshrike",
    "encounterId": "act3-e2-the-cut-below",
    "encounterLabel": "Act 3 E2 - The Cut Below",
    "stats": {
      "kind": "fiend",
      "ac": 17,
      "maxHp": 41,
      "speed": "40 ft., climb 20 ft.",
      "defenses": [
        {
          "name": "Quill Brace",
          "ehpMultiplier": 1.028819,
          "provenance": "interpolated",
          "note": "v3.44 ADDS THIS TRAIT: the first time each round Quillshrike is hit by a RANGED attack, reduce the damage by 3. Same interpolation the Hollow Warden's flat DR 3 uses (+0.028819), and a CEILING for the same reason as Larkskein's veil — the ranged condition is not inside the multiplier. Driven Stakes and Drive a Nail are repositioning and add nothing; First Nails and Snap to the Nail are retired."
        }
      ],
      "attacksPerTurn": 2,
      "size": "Medium",
      "classification": "elite",
      "archetype": "skirmisher",
      "skills": [
        {
          "label": "Acrobatics",
          "modifier": 8
        },
        {
          "label": "Stealth",
          "modifier": 8
        }
      ],
      "proficiencyBonus": 3
    },
    "abilities": [
      {
        "label": "STR",
        "value": "14 (+2)"
      },
      {
        "label": "DEX",
        "value": "20 (+5)",
        "saveProficient": true
      },
      {
        "label": "CON",
        "value": "12 (+1)"
      },
      {
        "label": "INT",
        "value": "12 (+1)"
      },
      {
        "label": "WIS",
        "value": "10 (+0)"
      },
      {
        "label": "CHA",
        "value": "14 (+2)"
      }
    ],
    "traits": [
      {
        "name": "Driven Stakes",
        "kind": "trait",
        "text": "When initiative is rolled, place two visible nail marks in spaces within 20 ft. Quillshrike may then move up to half speed toward one of them. No attack or save occurs."
      },
      {
        "name": "Quill Brace",
        "kind": "trait",
        "text": "The first time each round Quillshrike is hit by a ranged attack, reduce the damage by 3."
      }
    ],
    "actions": [
      {
        "name": "Drive a Nail",
        "kind": "action",
        "economyCost": "bonus",
        "text": "Quillshrike places one visible nail mark in an unoccupied space it can see within 30 feet. It can have no more than three nail marks at once; placing a fourth removes the oldest."
      },
      {
        "name": "Razor Quill",
        "kind": "attack",
        "roll": "1d20+8",
        "damage": "2d8 + 4",
        "damageType": "Slashing",
        "range": "reach 5 ft.",
        "riders": [
          {
            "name": "Razor Quill rider",
            "damage": "1d8",
            "damageType": "Psychic",
            "cadence": "once-per-turn"
          }
        ]
      },
      {
        "name": "Black Fan (Recharge 5–6)",
        "kind": "action",
        "damage": "6d6",
        "damageType": "Piercing",
        "save": "DEX DC 16",
        "onSave": "half",
        "recharge": "5-6",
        "text": "Dexterity Saving Throw: DC 16, each creature in a 15-foot Cone. Failure: 21 (6d6) Piercing damage. Success: Half damage. The ground in the Cone becomes visibly scored by straight black cuts until the end of the next round."
      }
    ],
    "reactions": [
      {
        "name": "Barbed Recall",
        "kind": "attack",
        "roll": "1d20+8",
        "damage": "1d4 + 5",
        "damageType": "Piercing",
        "range": "range 30 feet",
        "text": "When a hostile creature ends its movement within 5 feet of one of Quillshrike's nail marks, Quillshrike removes that mark and makes the following attack against the creature from the mark's space:"
      }
    ],
    "resources": [],
    "notes": [
      "A narrow Fiend plated in black quills like forged nails. Wherever it stops, one of those nails ends up driven into bark, stone, or soil, leaving a straight line where the forest had none."
    ],
    "visibility": {
      "defaultState": "hp-bar",
      "hiddenName": "Quillshrike",
      "revealedName": "Quillshrike"
    }
  },
  {
    "templateId": "broken-chain:act3:shardbound:v1",
    "name": "Shardbound",
    "encounterId": "act3-e2-the-cut-below",
    "encounterLabel": "Act 3 E2 - The Cut Below",
    "stats": {
      "kind": "fiend",
      "ac": 17,
      "maxHp": 55,
      "speed": "30 ft.",
      "defenses": [
        {
          "name": "Recalculate the Facet",
          "ehpMultiplier": 1,
          "note": "⚠ v3.44 CHANGED THE MECHANIC, NOT JUST THE NAME. The old Shatter the Stake spent a stake to impose Disadvantage on an ATTACK, which is the workbook's First-attack-each-round-at-disadvantage rule (+0.047749). The v3.44 reaction rerolls a failed DEX/INT/WIS SAVE instead. Those are different defences: one reduces incoming attack damage, the other buys one save against an effect — and no calibrated row prices a save reroll, so carrying the old multiplier forward would have priced an attack defence the creature no longer has. DECIDED 1.0, with the gap stated: the reroll is real and unpriced, the same way Legendary Resistance is."
        }
      ],
      "attacksPerTurn": 2,
      "size": "Medium",
      "classification": "elite",
      "archetype": "tactician",
      "skills": [
        {
          "label": "Arcana",
          "modifier": 8
        }
      ],
      "proficiencyBonus": 3
    },
    "abilities": [
      {
        "label": "STR",
        "value": "10 (+0)"
      },
      {
        "label": "DEX",
        "value": "16 (+3)",
        "saveProficient": true
      },
      {
        "label": "CON",
        "value": "14 (+2)"
      },
      {
        "label": "INT",
        "value": "20 (+5)",
        "saveProficient": true
      },
      {
        "label": "WIS",
        "value": "12 (+1)"
      },
      {
        "label": "CHA",
        "value": "12 (+1)"
      }
    ],
    "traits": [
      {
        "name": "Refracted Origin",
        "kind": "trait",
        "text": "When making a ranged spell attack, Shardbound can have the attack originate from itself or from one of its stakes it can see. Range is measured from the chosen origin. This can bend a sight line but does not increase damage."
      }
    ],
    "actions": [
      {
        "name": "Raise Prism",
        "kind": "action",
        "economyCost": "bonus",
        "text": "Shardbound creates one crystal stake in an unoccupied space it can see within 30 feet. It can have no more than two stakes at once; creating a third destroys the oldest."
      },
      {
        "name": "Crystal Bolt",
        "kind": "attack",
        "roll": "1d20+8",
        "damage": "2d8 + 5",
        "damageType": "Force",
        "range": "range 100 ft."
      },
      {
        "name": "Refracted Lance (Recharge 5–6)",
        "kind": "action",
        "damage": "7d6 + 2",
        "damageType": "Force",
        "save": "DEX DC 16",
        "onSave": "half",
        "recharge": "5-6",
        "text": "Shardbound draws a 60-foot Line from itself or one visible stake. Dexterity Saving Throw: DC 16, each creature in the Line. Failure: 26 (7d6 + 2) Force damage. Success: Half damage."
      }
    ],
    "reactions": [
      {
        "name": "Recalculate the Facet",
        "kind": "action",
        "text": "When Shardbound fails a Dexterity, Intelligence, or Wisdom saving throw, it destroys one crystal stake it can see within 30 feet and rerolls the save. It must use the new roll."
      }
    ],
    "resources": [],
    "notes": [
      "A faceted Fiend that plants crystal into living soil as if staking a survey line. The crystal does not grow with the Wood. It replaces what was there."
    ],
    "visibility": {
      "defaultState": "hp-bar",
      "hiddenName": "Shardbound",
      "revealedName": "Shardbound"
    }
  },
  {
    "templateId": "broken-chain:act3:thought-harrower:v1",
    "lair": {
      "initiative": 20,
      "noRepeatConsecutive": true,
      "note": "The Center. Distance stops agreeing with itself.",
      "options": [
        {
          "name": "Adjacent Elsewhere",
          "effect": "portal",
          "text": "Choose two 10-ft. spaces within 90 ft. Until the next initiative count 20, a creature that enters one may spend 5 ft. of movement to exit from the other. Each creature can use this once per turn."
        },
        {
          "name": "Memory of Falling",
          "effect": "forced_movement",
          "save": "STR DC 18",
          "text": "Choose a 15-ft.-radius area within 90 ft. Creatures there make a DC 18 Strength save or slide 10 ft. in one horizontal direction chosen by the Harrower. No damage."
        },
        {
          "name": "Wrong Angle",
          "effect": "cover",
          "text": "Choose a 20-ft.-radius area within 90 ft. Until the next initiative count 20, ranged attacks that originate inside or target inside the area treat half cover as no cover and three-quarters cover as half cover. The distortion benefits both sides."
        }
      ]
    },
    "name": "Thought Harrower",
    "encounterId": "act3-e10-the-center",
    "encounterLabel": "Act 3 E10 - The Center",
    "stats": {
      "kind": "aberration",
      "ac": 17,
      "maxHp": 232,
      "speed": "30 ft.",
      "defenses": [
        {
          "name": "Legendary Resistance (1/Day)",
          "ehpMultiplier": 1.042458,
          "rule": "Legendary Resistance - 1 use",
          "note": "Workbook: Legendary Resistance - 1 use (+0.042458), exact."
        }
      ],
      "attacksPerTurn": 3,
      "size": "Medium",
      "classification": "act-boss",
      "archetype": "tactician",
      "legendaryPerRound": 1,
      "skills": [
        {
          "label": "Arcana",
          "modifier": 10
        },
        {
          "label": "Perception",
          "modifier": 8
        }
      ],
      "proficiencyBonus": 4
    },
    "abilities": [
      {
        "label": "STR",
        "value": "14 (+2)"
      },
      {
        "label": "DEX",
        "value": "12 (+1)"
      },
      {
        "label": "CON",
        "value": "18 (+4)"
      },
      {
        "label": "INT",
        "value": "22 (+6)",
        "saveProficient": true
      },
      {
        "label": "WIS",
        "value": "18 (+4)",
        "saveProficient": true
      },
      {
        "label": "CHA",
        "value": "18 (+4)"
      }
    ],
    "traits": [
      {
        "name": "Legendary Resistance (1/Day)",
        "kind": "trait",
        "uses": 1,
        "text": "If the Harrower fails a saving throw, it can choose to succeed instead."
      },
      {
        "name": "Spellcasting",
        "kind": "trait",
        "text": "The Harrower is a 9th-level spellcaster. Intelligence is its spellcasting ability (spell save DC 18, +10 to hit with spell attacks). It can cast the following spells, requiring no material components: At will: Mage Hand, Minor Illusion. 2/Day Each: Dispel Magic, Misty Step. 1/Day Each: Confusion, Counterspell, Phantasmal Killer, Telekinesis. Tactical Casting below overrides the normal Action cost of Dispel Magic and the repeat Action of Telekinesis."
      },
      {
        "name": "Residual Hunger",
        "kind": "trait",
        "text": "Once per round when a creature within 60 ft. expends a spell slot or limited-use class or item resource, Harrower may move up to 10 ft. without provoking. Nothing is stolen or suppressed."
      },
      {
        "name": "Wrong Origin",
        "kind": "trait",
        "text": "A Rift Lance may originate from Harrower or from one fracture it can see. Range is measured from the origin. This changes geometry, not damage."
      }
    ],
    "actions": [
      {
        "name": "Tactical Casting",
        "kind": "action",
        "economyCost": "bonus",
        "text": "Misty Step (2/Day) and Dispel Magic (2/Day) are Bonus Actions for the Harrower. After Misty Step resolves, it can leave one visible fracture in the space it departed, to a maximum of two fractures. While concentrating on Telekinesis, the spell’s later creature/object exertion uses a Bonus Action instead of an Action."
      },
      {
        "name": "Rift Lance",
        "kind": "attack",
        "roll": "1d20+10",
        "damage": "5d10 + 4",
        "damageType": "Psychic",
        "range": "range 120 ft."
      },
      {
        "name": "Unmake Distance (Recharge 5–6)",
        "kind": "action",
        "damage": "11d6 + 6",
        "damageType": "Psychic",
        "save": "INT DC 18",
        "onSave": "half",
        "recharge": "5-6",
        "text": "Intelligence Saving Throw: DC 18, each creature in a 30-foot Cone originating from the Harrower or one fracture. Failure: 45 (11d6 + 6) Psychic damage, and the Harrower moves the creature up to 15 feet toward or away from the origin. Success: Half damage only; the creature isn't moved."
      },
      {
        "name": "Mind Hook",
        "kind": "action",
        "legendaryCost": 1,
        "damage": "5d8 + 4",
        "damageType": "Psychic",
        "save": "WIS DC 18",
        "onSave": "half",
        "targets": 1,
        "text": "Once per round at the end of another creature's turn, Wisdom Saving Throw: DC 18, one creature within 30 feet of the Harrower or a fracture. Failure: 27 (5d8 + 4) Psychic damage, and the creature is moved 10 feet toward the origin. Success: Half damage only; the creature isn't moved."
      },
      {
        "name": "Opening Fold",
        "kind": "action",
        "legendaryCost": 1,
        "uses": 1,
        "text": "ESCALATION ACTION, once per encounter. The Harrower places two fractures in unoccupied spaces it can see within 90 feet. These fractures do not count against the maximum created by Residual Hunger. The Harrower or the Colossus can then move up to half its Speed."
      },
      {
        "name": "Crossed Lines",
        "kind": "action",
        "legendaryCost": 1,
        "uses": 1,
        "save": "INT DC 18",
        "text": "ESCALATION ACTION, once per encounter. The Harrower chooses two 15-foot-radius Spheres centered on different fractures. Until the end of the next round, the two areas are adjacent. Each hostile creature in either area must succeed on a DC 18 Intelligence saving throw or be unable to take Reactions until the end of its next turn."
      },
      {
        "name": "Collapse the Map",
        "kind": "action",
        "legendaryCost": 1,
        "uses": 1,
        "damage": "5d8",
        "damageType": "Psychic",
        "save": "INT DC 18",
        "onSave": "half",
        "text": "ESCALATION ACTION, once per encounter. Intelligence Saving Throw: DC 18, each hostile creature within 30 feet of the Harrower or one of its fractures. Failure: 22 (5d8) Psychic damage, and the Harrower moves the creature up to 15 feet toward one fracture. Success: Half damage only, and the creature isn't moved. After the saving throws are resolved, all fractures created by Opening Fold disappear."
      }
    ],
    "reactions": [
      {
        "name": "Counterspell (1/Day)",
        "kind": "action",
        "uses": 1,
        "text": "The Harrower casts Counterspell."
      },
      {
        "name": "Fracture Exchange",
        "kind": "action",
        "text": "When an attack targets the Harrower and it can see a fracture within 60 feet, the Harrower swaps places with that fracture before the attack resolves. The attack then resolves against the Harrower in its new space if it remains a legal target; otherwise, the attack misses. The fracture moves to the Harrower’s former space."
      }
    ],
    "resources": [],
    "notes": [
      "The thing doing the thinking at the center has too many correct angles. It does not cast darkness or shadow; it makes two places become adjacent because it has forgotten that they were not.",
      "LAIR ACTIONS (not yet playable from the tracker — a lair is a SUMMON at initiative 20, and the summon mechanism is unbuilt). At initiative count 20 (losing ties), choose one option. The same option cannot be used on consecutive rounds. Adjacent Elsewhere. Choose two 10-ft. spaces within 90 ft. Until the next initiative count 20, a creature that enters one may spend 5 ft. of movement to exit from the other. Each creature can use this once per turn. Memory of Falling. Choose a 15-ft.-radius area within 90 ft. Creatures there make a DC 18 Strength save or slide 10 ft. in one horizontal direction chosen by the Harrower. No damage. Wrong Angle. Choose a 20-ft.-radius area within 90 ft. Until the next initiative count 20, ranged attacks that originate inside or target inside the area treat half cover as no cover and three-quarters cover as half cover. The distortion benefits both sides."
    ],
    "visibility": {
      "defaultState": "hp-bar",
      "hiddenName": "Thought Harrower",
      "revealedName": "Thought Harrower"
    }
  },
  {
    "templateId": "broken-chain:act3:veil-torn-dragon:v1",
    "lair": {
      "initiative": 20,
      "noRepeatConsecutive": true,
      "note": "Gate III. The clearing remembers being somewhere else.",
      "options": [
        {
          "name": "Ground Remembers Wrong",
          "effect": "forced_movement",
          "save": "STR DC 17",
          "text": "Choose up to three 10-ft. squares of natural ground within 90 ft. Creatures there make a DC 17 Strength save or slide up to 10 ft. to a safe space chosen by the lair."
        },
        {
          "name": "Branches Close",
          "effect": "obscure",
          "text": "A 15-ft.-radius sphere within 90 ft. becomes heavily obscured by overlapping leaves and wrong-angle branches until the next initiative count 20."
        },
        {
          "name": "Borrowed Sky",
          "effect": "forced_movement",
          "save": "STR DC 17",
          "text": "Choose one creature within 90 ft. The lair moves it up to 20 ft. horizontally and 10 ft. vertically, placing it safely on a surface. An unwilling creature can resist with a DC 17 Strength save."
        }
      ]
    },
    "name": "Veil-Torn Dragon",
    "encounterId": "act3-e9-gate-iii-veil-torn-dragon",
    "encounterLabel": "Act 3 E9 - Gate III: The Veil-Torn Dragon",
    "stats": {
      "kind": "dragon",
      "ac": 19,
      "maxHp": 244,
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
      "proficiencyBonus": 4
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
        "saveProficient": true
      },
      {
        "label": "INT",
        "value": "20 (+5)"
      },
      {
        "label": "WIS",
        "value": "20 (+5)",
        "saveProficient": true
      },
      {
        "label": "CHA",
        "value": "22 (+6)",
        "saveProficient": true
      }
    ],
    "traits": [
      {
        "name": "Legendary Resistance (1/Day)",
        "kind": "trait",
        "uses": 1,
        "text": "If the dragon fails a saving throw, it can choose to succeed instead."
      }
    ],
    "actions": [
      {
        "name": "Broken Lift",
        "kind": "action",
        "economyCost": "bonus",
        "text": "The dragon launches and glides up to 40 feet, ignoring ground terrain and Opportunity Attacks. It must end on a surface that supports it; it has no flying Speed."
      },
      {
        "name": "Bite",
        "kind": "attack",
        "roll": "1d20+7",
        "damage": "3d10 + 3",
        "damageType": "Piercing",
        "range": "reach 10 ft.",
        "riders": [
          {
            "name": "Bite rider",
            "damage": "2d6",
            "damageType": "Cold",
            "cadence": "per-hit"
          }
        ]
      },
      {
        "name": "Claw",
        "kind": "attack",
        "roll": "1d20+7",
        "damage": "3d6 + 3",
        "damageType": "Slashing",
        "range": "reach 5 ft."
      },
      {
        "name": "Veilstorm Breath (Recharge 5–6)",
        "kind": "action",
        "damage": "10d8",
        "damageType": "Lightning",
        "save": "DEX DC 18",
        "onSave": "half",
        "recharge": "5-6",
        "text": "Dexterity Saving Throw: DC 18, each creature in a 90-foot-long, 10-foot-wide Line. Failure: 45 (10d8) Lightning damage. Success: Half damage."
      },
      {
        "name": "Tail Sweep",
        "kind": "attack",
        "legendaryCost": 1,
        "roll": "1d20+7",
        "damage": "2d6 + 3",
        "damageType": "Bludgeoning",
        "range": "reach 15 ft.",
        "text": "Once per round at the end of another creature's turn, the dragon makes one Tail attack. and the dragon can move 5 feet without provoking Opportunity Attacks from the target hit."
      },
      {
        "name": "Ground Remembers Wrong",
        "kind": "action",
        "save": "STR DC 17",
        "text": "Strength Saving Throw: DC 17, each creature in up to three 10-foot squares of natural ground within 90 feet. Failure: The lair slides the creature up to 10 feet to a safe space chosen by the lair."
      },
      {
        "name": "Branches Close",
        "kind": "action",
        "text": "A 15-ft.-radius sphere within 90 ft. becomes heavily obscured by overlapping leaves and wrong-angle branches until the next initiative count 20."
      },
      {
        "name": "Borrowed Sky",
        "kind": "action",
        "save": "STR DC 17",
        "onSave": "none",
        "targets": 1,
        "text": "The lair chooses one creature within 90 feet and moves it up to 20 feet horizontally and 10 feet vertically, placing it safely on a surface. An unwilling creature can resist. Strength Saving Throw: DC 17, the target. Success: The target isn't moved."
      }
    ],
    "reactions": [
      {
        "name": "Last Flight",
        "kind": "action",
        "text": "When a Veilbound Drake Guard the dragon can see within 60 feet is reduced to 0 Hit Points, the dragon recharges Veilstorm Breath."
      }
    ],
    "resources": [],
    "notes": [
      "A real Fey-touched dragon caught at the point where native belonging has become control. Its wings still know how to fly. The Wood has started deciding when they open.",
      "LAIR ACTIONS (not yet playable from the tracker — a lair is a SUMMON at initiative 20, and the summon mechanism is unbuilt). At initiative count 20 (losing ties), choose one option. The same option cannot be used on consecutive rounds. Ground Remembers Wrong. Choose up to three 10-ft. squares of natural ground within 90 ft. Creatures there make a DC 17 Strength save or slide up to 10 ft. to a safe space chosen by the lair. Branches Close. A 15-ft.-radius sphere within 90 ft. becomes heavily obscured by overlapping leaves and wrong-angle branches until the next initiative count 20. Borrowed Sky. Choose one creature within 90 ft. The lair moves it up to 20 ft. horizontally and 10 ft. vertically, placing it safely on a surface. An unwilling creature can resist with a DC 17 Strength save."
    ],
    "visibility": {
      "defaultState": "hp-bar",
      "hiddenName": "Veil-Torn Dragon",
      "revealedName": "Veil-Torn Dragon"
    }
  },
  {
    "templateId": "broken-chain:act3:veil-torn-wyrmling:v1",
    "name": "Veilbound Drake Guard",
    "encounterId": "act3-e9-gate-iii-veil-torn-dragon",
    "encounterLabel": "Act 3 E9 - Gate III: The Veil-Torn Dragon",
    "stats": {
      "kind": "dragon",
      "ac": 15,
      "maxHp": 70,
      "speed": "30 ft., fly 60 ft.",
      "defenses": [
        {
          "name": "Moon-Slick Scales",
          "ehpMultiplier": 1.047749,
          "rule": "First attack each round at disadvantage",
          "note": "Workbook: First attack each round at disadvantage (+0.047749). Applies to the first opportunity attack each round."
        }
      ],
      "size": "Medium",
      "classification": "mid-boss",
      "archetype": "skirmisher",
      "skills": [
        {
          "label": "Perception",
          "modifier": 5
        }
      ],
      "cr": 4
    },
    "abilities": [
      {
        "label": "STR",
        "value": "14 (+2)"
      },
      {
        "label": "DEX",
        "value": "15 (+2)",
        "saveProficient": true
      },
      {
        "label": "CON",
        "value": "16 (+3)"
      },
      {
        "label": "INT",
        "value": "10 (+0)"
      },
      {
        "label": "WIS",
        "value": "14 (+2)"
      },
      {
        "label": "CHA",
        "value": "10 (+0)",
        "saveProficient": true
      }
    ],
    "traits": [
      {
        "name": "Veil Skim",
        "kind": "trait",
        "text": "The first time each round the guard moves at least 20 feet before it is targeted by a ranged attack, it gains a +2 bonus to AC against that attack."
      }
    ],
    "actions": [
      {
        "name": "Patrol Ground",
        "kind": "action",
        "economyCost": "bonus",
        "text": "The guard moves up to 20 feet without provoking Opportunity Attacks. Until the start of its next turn, the area within 10 feet of it is Guarded Ground and is Difficult Terrain for hostile creatures."
      },
      {
        "name": "Bite",
        "kind": "attack",
        "roll": "1d20+4",
        "damage": "2d8 + 3",
        "damageType": "Piercing",
        "range": "reach 5 ft."
      },
      {
        "name": "Claw",
        "kind": "attack",
        "roll": "1d20+4",
        "damage": "2d8 + 3",
        "damageType": "Slashing",
        "range": "reach 5 ft.",
        "riders": [
          {
            "name": "Claw rider",
            "damage": "1d8",
            "damageType": "Fire",
            "cadence": "per-hit"
          }
        ]
      },
      {
        "name": "Tail",
        "kind": "attack",
        "roll": "1d20+4",
        "damage": "2d8 + 2",
        "damageType": "Bludgeoning",
        "range": "reach 10 ft",
        "save": "STR DC 12",
        "text": "Strength Saving Throw: DC 12, a Large or smaller target hit by this attack. Failure: The target has the Prone condition."
      },
      {
        "name": "Veil Breath (Recharge 6)",
        "kind": "action",
        "damage": "5d6 + 1",
        "damageType": "Fire",
        "save": "DEX DC 12",
        "onSave": "half",
        "text": "Dexterity Saving Throw: DC 12, each creature in a 20-foot Cone. Failure: 19 (5d6 + 1) Fire damage. Success: Half damage."
      }
    ],
    "reactions": [
      {
        "name": "Perimeter Strike",
        "kind": "action",
        "text": "When a hostile creature enters the guard’s Guarded Ground or moves at least 5 feet within it, the guard moves up to 10 feet to an unoccupied space adjacent to that creature without provoking Opportunity Attacks and makes one Claw attack against it. On a hit, the creature’s Speed becomes 0 for the rest of the current turn."
      }
    ],
    "resources": [],
    "notes": [
      "A smaller dragon whose movements still look graceful until the canopy tugs it half a beat too early. Both wyrmlings use the same standalone block."
    ],
    "visibility": {
      "defaultState": "hp-bar",
      "hiddenName": "Veilbound Drake Guard",
      "revealedName": "Veilbound Drake Guard"
    }
  },
  {
    "templateId": "broken-chain:act3:veilwood-crone:v1",
    "name": "Veilwood Crone",
    "encounterId": "act3-e3-gate-i-crone-and-mare",
    "encounterLabel": "Act 3 E3 - Gate I: The Crone and the Mare",
    "stats": {
      "kind": "fey",
      "ac": 15,
      "maxHp": 120,
      "speed": "30 ft., swim 30 ft.",
      "defenses": [
        {
          "name": "Control spellcasting",
          "ehpMultiplier": 1.108348,
          "rule": "Opposing damage uptime -10%",
          "note": "Workbook: Opposing damage uptime -10% (+0.108348). Entangle, Web and Hold Person cost the party attacking turns; this is a CLOCK tax, not resistance."
        }
      ],
      "attacksPerTurn": 2,
      "size": "Medium",
      "classification": "mid-boss",
      "archetype": "mystic",
      "spellSlots": [
        {
          "level": 1,
          "max": 4
        },
        {
          "level": 2,
          "max": 3
        },
        {
          "level": 3,
          "max": 3
        },
        {
          "level": 4,
          "max": 1
        }
      ],
      "skills": [
        {
          "label": "Nature",
          "modifier": 7
        },
        {
          "label": "Perception",
          "modifier": 9
        }
      ],
      "proficiencyBonus": 3
    },
    "abilities": [
      {
        "label": "STR",
        "value": "18 (+4)"
      },
      {
        "label": "DEX",
        "value": "18 (+4)"
      },
      {
        "label": "CON",
        "value": "18 (+4)",
        "saveProficient": true
      },
      {
        "label": "INT",
        "value": "18 (+4)"
      },
      {
        "label": "WIS",
        "value": "22 (+6)",
        "saveProficient": true
      },
      {
        "label": "CHA",
        "value": "14 (+2)"
      }
    ],
    "traits": [
      {
        "name": "Spellcasting",
        "kind": "trait",
        "text": "The Crone is a 7th-level spellcaster. Wisdom is her spellcasting ability (spell save DC 17, +9 to hit with spell attacks). She has four 1st-level slots, three 2nd-level slots, three 3rd-level slots, and one 4th-level slot. At will: Chill Touch, Thorn Whip. Core control list: Entangle, Web, Hold Person. A spell replaces Multiattack."
      },
      {
        "name": "Night-Garden Native",
        "kind": "trait",
        "text": "The Crone ignores difficult terrain created by plants and vegetation, and nonmagical plants do not impede her movement."
      }
    ],
    "actions": [
      {
        "name": "Misty Step (2/Day)",
        "kind": "action",
        "economyCost": "bonus",
        "uses": 2,
        "text": "The Crone casts Misty Step without expending a spell slot."
      },
      {
        "name": "Claw",
        "kind": "attack",
        "roll": "1d20+7",
        "damage": "2d10 + 5",
        "damageType": "Slashing",
        "range": "reach 5 ft."
      },
      {
        "name": "Venomous Eruption",
        "kind": "action",
        "damage": "11d6",
        "damageType": "Poison",
        "save": "WIS DC 17",
        "onSave": "half",
        "text": "The Crone chooses a point within 60 feet. Wisdom Saving Throw: DC 17, each creature in a 20-foot-radius Sphere centered on that point. Failure: 39 (11d6) Poison damage, and the creature has the Poisoned condition until the end of its next turn. Success: Half damage only. This action expends the Crone's 4th-level spell slot."
      },
      {
        "name": "Blighted Vitality (Recharge 4–6)",
        "kind": "action",
        "save": "CON DC 17",
        "recharge": "4-6",
        "targets": 2,
        "text": "Constitution Saving Throw: DC 17, up to two creatures within 60 feet. Failure: Healing the target receives is halved until the end of the Crone's second turn after the effect begins. Reapplying the effect doesn't extend or stack its duration."
      },
      {
        "name": "Control Spells",
        "kind": "action",
        "text": "Entangle, Hold Person, and Fear use the Crone’s spell save DC 17 and normal spell-slot costs. A spell replaces Multiattack."
      }
    ],
    "reactions": [
      {
        "name": "Briar-Cast Opportunity",
        "kind": "action",
        "text": "When a creature provokes an Opportunity Attack from the Crone, she casts Thorn Whip at that creature instead of making an Opportunity Attack."
      }
    ],
    "resources": [],
    "notes": [
      "The Crone is not an invader. Black flowers open for her because this is still Feywild soil. Her cruelty is native: poisonous hospitality, thorn-shadow, and the night-side of living things."
    ],
    "visibility": {
      "defaultState": "hp-bar",
      "hiddenName": "Veilwood Crone",
      "revealedName": "Veilwood Crone"
    }
  },
  {
    "templateId": "broken-chain:act3:elemental-mirror:v1",
    "name": "Elemental Mirror",
    "encounterId": "act3-e6-gate-ii-the-mirrors",
    "encounterLabel": "Act 3 E6 - Gate II: The Mirrors",
    "isTemplate": true,
    "bodyNameFormat": "{pick} Mirror",
    "stats": {
      "kind": "aberration",
      "ac": 15,
      "maxHp": 105,
      "speed": "30 ft.",
      "attacksPerTurn": 2,
      "defenses": [
        {
          "name": "Elemental Guard",
          "ehpMultiplier": 1.075916,
          "rule": "Telegraphed alternating immunity/resistance",
          "note": "Workbook: Telegraphed alternating immunity/resistance (+0.075916), exact. Read from the trait text by traitClassifier on \"immunity that rotates each turn\" - the mirror had NO defences at all, so a Gate boss priced at flat 90 raw HP with its signature ability worth zero."
        },
        {
          "name": "Reactive Refraction",
          "ehpMultiplier": 1.047749,
          "rule": "First attack each round at disadvantage",
          "note": "v3.44 ADDS A REACTION TO EVERY MIRROR: when an attack targets it, it can impose Disadvantage on that attack, decided before the roll. That is the workbook’s First-attack-each-round-at-disadvantage rule exactly (+0.047749) — the mirror spends its normal Reaction, so it is once per round by the Reaction budget rather than by its own wording. It stacks with Elemental Guard on ONE pass fraction because they answer different questions: the Guard removes a damage TYPE, this one removes a hit."
        },
        {
          "name": "Sunstone Aegis",
          "setId": "element",
          "setOption": "Earth",
          "ehpMultiplier": 1.056615,
          "provenance": "interpolated",
          "note": "Workbook: temporary AC, interpolated to +2 AC for 1 round from the +5 AC anchor (+0.056615) — the same value the Darkmare's Shadow Shroud carries, because it is the same effect. ⚠ AND IT IS ONCE PER DAY: the anchor prices a one-round window and Sunstone Aegis gets exactly one of those in the fight, so this is if anything generous. The blinding save it also imposes is CONTROL and is not counted here."
        }
      ],
      "damageResponses": [],
      "size": "Medium",
      "classification": "elite",
      "cr": 7,
      "oneBodyPerPc": true
    },
    "abilities": [
      {
        "label": "STR",
        "value": "18 (+4)"
      },
      {
        "label": "DEX",
        "value": "16 (+3)"
      },
      {
        "label": "CON",
        "value": "14 (+2)"
      },
      {
        "label": "INT",
        "value": "12 (+1)"
      },
      {
        "label": "WIS",
        "value": "12 (+1)"
      },
      {
        "label": "CHA",
        "value": "10 (+0)"
      }
    ],
    "actionSets": [
      {
        "id": "element",
        "label": "Element package",
        "pick": 1,
        "namesBody": true,
        "note": "Primary locks its paired secondary. Do not duplicate a package across the roster.",
        "optionVars": {
          "Ice": {
            "primary": "ice",
            "secondary": "necrotic",
            "pair": "Ice/Necrotic",
            "group": "Defensive-solid",
            "line": "front",
            "physical1": "bludgeoning",
            "physical2": ""
          },
          "Earth": {
            "primary": "earth",
            "secondary": "radiant",
            "pair": "Earth/Radiant",
            "group": "Defensive-solid",
            "line": "front",
            "physical1": "bludgeoning",
            "physical2": ""
          },
          "Nature": {
            "primary": "nature",
            "secondary": "poison",
            "pair": "Nature/Poison",
            "group": "Defensive-solid",
            "line": "front",
            "physical1": "bludgeoning",
            "physical2": ""
          },
          "Fire": {
            "primary": "fire",
            "secondary": "lightning",
            "pair": "Fire/Lightning",
            "group": "Offensive-fluid",
            "line": "back",
            "physical1": "piercing",
            "physical2": "slashing"
          },
          "Water": {
            "primary": "water",
            "secondary": "acid",
            "pair": "Water/Acid",
            "group": "Offensive-fluid",
            "line": "back",
            "physical1": "piercing",
            "physical2": "slashing"
          },
          "Air": {
            "primary": "air",
            "secondary": "force",
            "pair": "Air/Force",
            "group": "Offensive-fluid",
            "line": "back",
            "physical1": "piercing",
            "physical2": "slashing"
          }
        }
      }
    ],
    "traits": [
      {
        "name": "Elemental Guard",
        "kind": "trait",
        "text": "At the start of each turn, choose one element in the mirror’s pair as the active guard: the mirror is immune to that damage type and resistant to the paired type until the start of its next turn. The active immunity is visibly telegraphed before affected players commit damage."
      },
      {
        "name": "Inherent Bond",
        "kind": "trait",
        "text": "The mirror has the DM-assigned Bond and Metamorphosis path selected during construction. It resolves with its printed timing and one activation per round."
      },
      {
        "name": "Primary Convergence",
        "kind": "trait",
        "text": "A signature spell consumes the mirror’s action. In one round, no more than one Offensive mirror and one Defensive mirror can use a 1/day signature spell."
      },
      {
        "name": "Role Attack",
        "kind": "trait",
        "text": "Use the chosen archetype’s Attack line. Claws and Bolts deal 2d6 + the listed damage modifier for that archetype. A mirror can replace its normal attack routine with a spell from its elemental package."
      },
      {
        "name": "Constructed Answer",
        "kind": "trait",
        "text": "The mirror is built from an archetype, an element package and one bond at its Metamorphosis path. It is close enough to a party's roles to be insulting, and never an exact copy."
      },
      {
        "name": "Signature Limit",
        "kind": "trait",
        "text": "Roster-limited: at most one 1/day signature effect per round across the whole mirror encounter, and at most one Offensive and one Defensive mirror may use a signature in any one round."
      }
    ],
    "actions": [
      {
        "name": "Claw",
        "kind": "attack",
        "roll": "1d20+@MAIN+@PROF",
        "damage": "3d6+@MAIN {primary}",
        "routineSlots": 1,
        "text": "Melee Weapon Attack, reach 5 ft. The archetype sets the modifier; the element sets the damage type."
      },
      {
        "name": "Bolt",
        "kind": "attack",
        "roll": "1d20+@MAIN+@PROF",
        "damage": "3d6+@MAIN {primary}",
        "routineSlots": 1,
        "text": "Ranged Spell Attack, range 60 ft. The archetype sets the modifier; the element sets the damage type."
      },
      {
        "name": "Gravefrost Reflections",
        "kind": "reaction",
        "setId": "element",
        "setOption": "Ice",
        "uses": 1,
        "damage": "2d6",
        "save": "WIS DC @DC",
        "text": "1/Day, Reaction when the mirror is targeted by an attack. Three ice-and-shadow reflections appear for up to 1 minute. While a reflection remains, when an attack would hit the mirror, roll a d20; on a 6 or higher the attack destroys a reflection instead. A reflection uses the mirror's AC. When the last reflection is destroyed, the creature that destroyed it takes 2d6 cold or necrotic damage (mirror's choice) and must succeed on a Wisdom saving throw or be frightened of the mirror until the end of its next turn."
      },
      {
        "name": "Ray of Frost",
        "kind": "spell",
        "replacesRoutineSlot": true,
        "setId": "element",
        "setOption": "Ice",
        "roll": "1d20+@SPELL",
        "damage": "2d8 cold",
        "damageType": "Cold",
        "range": "range 60 ft.",
        "text": "At-will cantrip.,"
      },
      {
        "name": "Misty Step",
        "kind": "spell",
        "setId": "element",
        "setOption": "Ice",
        "uses": 3,
        "text": "3/day. Bonus Action. The mirror teleports up to 30 feet to an unoccupied space it can see. No damage."
      },
      {
        "name": "Sunstone Aegis",
        "kind": "action",
        "setId": "element",
        "setOption": "Earth",
        "uses": 1,
        "save": "CON DC @DC",
        "text": "1/Day, Action. Luminous stone closes around the mirror until the start of its next turn, granting +2 AC. The first time each creature targets the mirror with an attack during the effect, that creature makes a Constitution saving throw before the attack. On a failed save, it is blinded until the end of the current turn. A creature makes this save only once per casting."
      },
      {
        "name": "Mold Earth",
        "kind": "spell",
        "economyCost": "bonus",
        "setId": "element",
        "setOption": "Earth",
        "text": "At-will cantrip. Move or shape a 5-foot cube of dirt or stone within 30 ft. — excavate it, change its colour, or make it difficult terrain until the mirror's concentration ends. No damage."
      },
      {
        "name": "Guiding Bolt",
        "kind": "spell",
        "setId": "element",
        "setOption": "Earth",
        "uses": 3,
        "roll": "1d20+@SPELL",
        "damage": "4d6 radiant",
        "damageType": "Radiant",
        "range": "range 120 ft.",
        "text": "3/day.,"
      },
      {
        "name": "Venomroot Bloom",
        "kind": "action",
        "setId": "element",
        "setOption": "Nature",
        "uses": 1,
        "save": "CON DC @DC",
        "text": "1/Day, Action. Choose a point within 60 feet. Poisonous roots erupt in a 20-foot-radius area until the start of the mirror's next turn. The area is difficult terrain for creatures other than the mirror. A creature that enters the area for the first time on a turn or starts its turn there makes a Constitution saving throw. On a failed save, its speed becomes 0 and it is poisoned until the start of its next turn. On a success, its speed is halved until the start of its next turn."
      },
      {
        "name": "Thorn Whip",
        "kind": "spell",
        "replacesRoutineSlot": true,
        "setId": "element",
        "setOption": "Nature",
        "roll": "1d20+@SPELL",
        "damage": "2d6 piercing",
        "damageType": "Piercing",
        "range": "reach 30 ft.",
        "text": "At-will cantrip.,"
      },
      {
        "name": "Ray of Sickness",
        "kind": "spell",
        "setId": "element",
        "setOption": "Nature",
        "uses": 3,
        "roll": "1d20+@SPELL",
        "damage": "2d8 poison",
        "damageType": "Poison",
        "range": "range 60 ft.",
        "text": "3/day. On a hit, the target makes a Constitution saving throw or has the Poisoned condition until the end of the mirror's next turn."
      },
      {
        "name": "Stormcharged Fireball",
        "kind": "action",
        "setId": "element",
        "setOption": "Fire",
        "uses": 1,
        "damage": "3d6 {primary} + 3d6 {secondary}",
        "save": "DEX DC @DC",
        "text": "1/Day, Action. Choose a point within 90 feet. A 15-foot-radius sphere erupts with fire threaded by lightning. Each creature in the area makes a Dexterity saving throw, taking 3d6 fire plus 3d6 lightning damage on a failed save, or half as much on a success."
      },
      {
        "name": "Fire Bolt",
        "kind": "spell",
        "replacesRoutineSlot": true,
        "setId": "element",
        "setOption": "Fire",
        "roll": "1d20+@SPELL",
        "damage": "2d10 fire",
        "damageType": "Fire",
        "range": "range 120 ft.",
        "text": "At-will cantrip., A flammable object hit by this spell ignites if it is not being worn or carried."
      },
      {
        "name": "Thunderwave",
        "kind": "spell",
        "setId": "element",
        "setOption": "Fire",
        "uses": 3,
        "damage": "2d8 thunder",
        "save": "CON DC @DC",
        "text": "3/day. Each creature in a 15-foot cube originating from the mirror makes a Constitution save, taking 2d8 thunder damage and being pushed 10 feet away on a failure, or half damage and no push on a success."
      },
      {
        "name": "Caustic Tide",
        "kind": "action",
        "setId": "element",
        "setOption": "Water",
        "uses": 1,
        "damage": "2d8 bludgeoning + 2d8 {secondary}",
        "save": "DEX DC @DC",
        "text": "1/Day, Action. A 30-foot-long, 10-foot-wide wave surges from the mirror. Creatures in the wave make a Dexterity saving throw, taking 2d8 bludgeoning plus 2d8 acid damage and falling prone on a failed save. On a success, a creature takes half damage and does not fall prone."
      },
      {
        "name": "Shape Water",
        "kind": "spell",
        "economyCost": "bonus",
        "setId": "element",
        "setOption": "Water",
        "text": "At-will cantrip. Move or shape a 5-foot cube of water within 30 ft., freeze it, or change its colour. No damage."
      },
      {
        "name": "Grease",
        "kind": "spell",
        "setId": "element",
        "setOption": "Water",
        "uses": 3,
        "save": "DEX DC @DC",
        "text": "3/day. A 10-foot square within 60 ft. becomes difficult terrain. A creature there when it appears, or entering or ending its turn there, makes a Dexterity save or falls prone. No damage."
      },
      {
        "name": "Gravitic Squall",
        "kind": "action",
        "setId": "element",
        "setOption": "Air",
        "uses": 1,
        "damage": "2d8 thunder + 2d8 {secondary}",
        "save": "STR DC @DC",
        "text": "1/Day, Action. A 30-foot cone of compressed air and force tears outward. Creatures in the cone make a Strength saving throw, taking 2d8 thunder plus 2d8 force damage on a failed save, and the mirror pushes or pulls each failed target 15 feet. On a success, a creature takes half damage and is not moved."
      },
      {
        "name": "Gust",
        "kind": "spell",
        "economyCost": "bonus",
        "setId": "element",
        "setOption": "Air",
        "save": "STR DC @DC",
        "text": "At-will cantrip. One creature within 30 ft. makes a Strength save or is pushed 5 feet away, or the mirror moves an unattended object or creates a harmless gust. No damage."
      },
      {
        "name": "Vortex Warp",
        "kind": "spell",
        "setId": "element",
        "setOption": "Air",
        "uses": 3,
        "save": "CON DC @DC",
        "text": "3/day. One creature within 90 ft. makes a Constitution save. On a failure, the mirror teleports it to an unoccupied space it can see within 90 feet. No damage."
      }
    ],
    "reactions": [
      {
        "name": "Reactive Refraction",
        "kind": "action",
        "text": "When an attack targets the mirror, it can impose Disadvantage on that attack. The mirror decides before the attack roll. This reaction uses the mirror's normal Reaction and does not require a counterpart, Bond match, or ongoing mark."
      }
    ],
    "resources": [],
    "notes": [
      "Elemental Guard must remain deterministic and readable. The active immunity changes every turn; players should be able to route damage around it.",
      "Use different prime archetypes so the fight reads as a party-shaped system rather than identical attackers. At 3 players use three, at 4 use four, at 5 use five.",
      "Party-size scaling is the MIRROR EXCEPTION: each mirror stays at 90 HP and AC 15, and the encounter scales only by matching the number of mirrors to the number of PCs."
    ],
    "visibility": {
      "defaultState": "hp-bar",
      "hiddenName": "Mirror",
      "revealedName": "Elemental Mirror"
    }
  },
  {
    "templateId": "broken-chain:act3:rootwake-warden:v1",
    "name": "Rootwake Warden",
    "encounterId": "act3-e5-the-scar-line",
    "encounterLabel": "Act 3 E5 - The Scar Line",
    "stats": {
      "kind": "fey",
      "ac": 16,
      "maxHp": 120,
      "speed": "50 ft.",
      "defenses": [
        {
          "name": "Rootbound Guard",
          "ehpMultiplier": 1.038413,
          "provenance": "interpolated",
          "note": "v3.44 ADDS THIS TRAIT: the first time each round the Warden takes damage while touching natural ground, reduce it by 4. Interpolated on the same line the Hollow Warden's DR 3 sits on — the workbook anchors fixed prevention at 8/round (+0.076838), so 4/round is half of it (+0.038413). ⚠ CEILING: the ground condition is not inside the multiplier, and this fight is fought on natural ground, so it is close to the real value here and would not be elsewhere."
        },
        {
          "name": "Living Footing",
          "ehpMultiplier": 1,
          "note": "DECIDED 1.0. Terrain immunity is movement, not survivability — it changes where the Warden can be, never how much damage reaches it."
        }
      ],
      "attacksPerTurn": 2,
      "size": "Large",
      "classification": "elite",
      "archetype": "skirmisher",
      "skills": [
        {
          "label": "Athletics",
          "modifier": 7
        },
        {
          "label": "Perception",
          "modifier": 7
        }
      ],
      "proficiencyBonus": 3
    },
    "abilities": [
      {
        "label": "STR",
        "value": "18 (+4)"
      },
      {
        "label": "DEX",
        "value": "16 (+3)",
        "saveProficient": true
      },
      {
        "label": "CON",
        "value": "18 (+4)",
        "saveProficient": true
      },
      {
        "label": "INT",
        "value": "12 (+1)"
      },
      {
        "label": "WIS",
        "value": "18 (+4)",
        "saveProficient": true
      },
      {
        "label": "CHA",
        "value": "12 (+1)"
      }
    ],
    "traits": [
      {
        "name": "Living Footing",
        "kind": "trait",
        "text": "Natural difficult terrain created by plants or undergrowth costs the Warden no extra movement."
      },
      {
        "name": "Rootbound Guard",
        "kind": "trait",
        "text": "The first time each round the Warden takes damage, reduce that damage by 4."
      }
    ],
    "actions": [
      {
        "name": "Wake the Route",
        "kind": "action",
        "economyCost": "bonus",
        "text": "The Warden marks a 20-foot path of natural ground it can see within 30 feet. Until the start of its next turn, the path is normal terrain for the Warden and its allies and difficult terrain for its enemies."
      },
      {
        "name": "Branch Lance",
        "kind": "attack",
        "roll": "1d20+@ATK",
        "damage": "2d6 + @STR",
        "damageType": "Piercing",
        "range": "reach 10 ft.",
        "routineSlots": 2
      },
      {
        "name": "Sunthorn",
        "kind": "attack",
        "roll": "1d20+@ATK",
        "damage": "2d6 + @WIS",
        "damageType": "Radiant",
        "range": "range 90 ft.",
        "routineSlots": 2
      },
      {
        "name": "Entangling Passage (Recharge 5–6)",
        "kind": "action",
        "save": "DEX DC 15",
        "onSave": "half",
        "damage": "2d8 + 5",
        "damageType": "Bludgeoning",
        "targets": 2,
        "recharge": "5-6",
        "text": "Roots of the forest lash out at two creatures within 15 feet of the Warden. Each target must make a DC 15 Dexterity saving throw. On a failed save, a target takes 14 (2d8 + 5) Bludgeoning damage and has the Restrained condition until the end of the Warden’s next turn. On a successful save, the target takes half as much damage only.",
        "range": "15 FT"
      }
    ],
    "reactions": [
      {
        "name": "Rootbound Counsel",
        "kind": "action",
        "text": "When an ally standing on the Warden's marked path makes a Dexterity saving throw, the Warden gives that ally Advantage on the save."
      }
    ],
    "resources": [],
    "notes": [
      "A long-limbed Fey pathkeeper whose hooves strike the ground only after roots have chosen where they will land. It opens living routes by running them, and the Wood knots shut behind its passage."
    ],
    "visibility": {
      "defaultState": "hp-bar",
      "hiddenName": "Rootwake Warden",
      "revealedName": "Rootwake Warden"
    }
  },
  {
    "templateId": "broken-chain:act3:stormscar-ravager:v1",
    "name": "Stormscar Ravager",
    "encounterId": "act3-e5-the-scar-line",
    "encounterLabel": "Act 3 E5 - The Scar Line",
    "stats": {
      "kind": "fiend",
      "ac": 16,
      "maxHp": 110,
      "speed": "60 ft.",
      "defenses": [
        {
          "name": "Stormhide",
          "ehpMultiplier": 1.038413,
          "provenance": "interpolated",
          "note": "v3.44 ADDS THIS TRAIT: the first time each round the Ravager takes Lightning, Thunder, or ranged weapon damage, reduce it by 4. Interpolated at half the workbook's 8/round fixed-prevention anchor (+0.038413), the same line the Rootwake Warden's Rootbound Guard uses. ⚠ CEILING, AND A GENEROUS ONE: it is TYPED and ranged-conditional. A melee party dealing no lightning or thunder triggers it never, and the multiplier cannot express that — the party damage mix would have to price it, the way a creature's typed resistances already are."
        }
      ],
      "attacksPerTurn": 3,
      "size": "Large",
      "classification": "elite",
      "archetype": "bruiser",
      "skills": [
        {
          "label": "Athletics",
          "modifier": 7
        },
        {
          "label": "Acrobatics",
          "modifier": 7
        },
        {
          "label": "Perception",
          "modifier": 4
        }
      ],
      "proficiencyBonus": 3
    },
    "abilities": [
      {
        "label": "STR",
        "value": "18 (+4)"
      },
      {
        "label": "DEX",
        "value": "18 (+4)",
        "saveProficient": true
      },
      {
        "label": "CON",
        "value": "20 (+5)",
        "saveProficient": true
      },
      {
        "label": "INT",
        "value": "14 (+2)"
      },
      {
        "label": "WIS",
        "value": "12 (+1)"
      },
      {
        "label": "CHA",
        "value": "14 (+2)"
      }
    ],
    "traits": [
      {
        "name": "Long-Striding",
        "kind": "trait",
        "text": "The Ravager ignores the first 10 feet of difficult terrain it enters on each of its turns."
      },
      {
        "name": "Stormhide",
        "kind": "trait",
        "text": "The first time each round the Ravager takes Lightning or Thunder damage, reduce that damage by 4."
      }
    ],
    "actions": [
      {
        "name": "Claw",
        "kind": "attack",
        "roll": "1d20+@ATK",
        "damage": "2d8 + @STR",
        "damageType": "Slashing",
        "range": "reach 5 ft.",
        "routineSlots": 1
      },
      {
        "name": "Crushing Foreclaw",
        "kind": "attack",
        "roll": "1d20+@ATK",
        "damage": "2d8 + @STR",
        "damageType": "Bludgeoning",
        "range": "reach 5 ft.",
        "save": "STR DC 16",
        "text": "Strength Saving Throw: DC 16, a Large or smaller target hit by this attack. Failure: The target has the Prone condition.",
        "routineSlots": 1
      },
      {
        "name": "Serrated Tail",
        "kind": "attack",
        "roll": "1d20+@ATK",
        "damage": "2d8 + @DEX",
        "damageType": "Slashing",
        "range": "reach 10 ft.",
        "routineSlots": 1
      },
      {
        "name": "Stormscar Lance (Recharge 5–6)",
        "kind": "action",
        "damage": "8d8 + 2",
        "damageType": "Lightning",
        "save": "DEX DC 16",
        "onSave": "half",
        "recharge": "5-6",
        "text": "Dexterity Saving Throw: DC 16, each creature in a 60-foot-long, 10-foot-wide Line. Failure: 38 (8d8 + 2) Lightning damage. Success: Half damage."
      }
    ],
    "reactions": [
      {
        "name": "Intercepting Leap",
        "kind": "action",
        "damage": "2d8",
        "damageType": "Lightning",
        "save": "DEX DC 16",
        "onSave": "half",
        "text": "When a hostile creature the Ravager can see within 40 feet moves at least 20 feet during its turn toward one of the Ravager’s allies and ends that movement within 20 feet of that ally, the Ravager leaps up to 30 feet to an unoccupied space adjacent to the creature. Dexterity Saving Throw: DC 16, the moving creature. Failure: 9 (2d8) Lightning damage, and the creature is Pinned until the start of its next turn. While Pinned, its Speed is 0. Success: Half damage only. The Pinned condition ends early if the Ravager moves or has the Incapacitated condition.",
        "range": "30 FT"
      }
    ],
    "resources": [],
    "notes": [
      "A four-limbed Fiend built around speed rather than concealment. Lightning crawls through old cuts in its hide; when it lowers its body and runs, the charge ends in a straight flash across the Wood."
    ],
    "visibility": {
      "defaultState": "hp-bar",
      "hiddenName": "Stormscar Ravager",
      "revealedName": "Stormscar Ravager"
    }
  },
  {
    "templateId": "broken-chain:act3:claimchain-exactor:v1",
    "name": "Claimchain Exactor",
    "encounterId": "act3-e5-the-scar-line",
    "encounterLabel": "Act 3 E5 - The Scar Line",
    "stats": {
      "kind": "fiend",
      "ac": 17,
      "maxHp": 110,
      "speed": "30 ft.",
      "defenses": [
        {
          "name": "Chain Screen",
          "ehpMultiplier": 1.047749,
          "rule": "First attack each round at disadvantage",
          "note": "v3.44 ADDS THIS TRAIT: while at least one claim chain is free, the first ranged attack each round has Disadvantage. That is the workbook's First-attack-each-round-at-disadvantage rule exactly (+0.047749). ⚠ IT SWITCHES OFF WHEN BOTH CHAINS GRAPPLE, which the multiplier cannot express — a Exactor holding two PCs is undefended by this and priced as though it were not."
        },
        {
          "name": "Two Claim Chains",
          "ehpMultiplier": 1,
          "note": "DECIDED 1.0. The chains are the Exactor's OFFENCE and its grapple economy; the constraint that a grappling chain cannot attack is a limit on it, not a defence."
        }
      ],
      "attacksPerTurn": 2,
      "size": "Medium",
      "classification": "elite",
      "archetype": "tactician",
      "skills": [
        {
          "label": "Athletics",
          "modifier": 8
        },
        {
          "label": "Insight",
          "modifier": 5
        }
      ],
      "proficiencyBonus": 3
    },
    "abilities": [
      {
        "label": "STR",
        "value": "20 (+5)",
        "saveProficient": true
      },
      {
        "label": "DEX",
        "value": "16 (+3)"
      },
      {
        "label": "CON",
        "value": "18 (+4)",
        "saveProficient": true
      },
      {
        "label": "INT",
        "value": "18 (+4)",
        "saveProficient": true
      },
      {
        "label": "WIS",
        "value": "14 (+2)"
      },
      {
        "label": "CHA",
        "value": "16 (+3)"
      }
    ],
    "traits": [
      {
        "name": "Two Claim Chains",
        "kind": "trait",
        "targets": 1,
        "text": "The Exactor has two chains. Each chain can Grapple one creature at a time. A chain that is Grappling a creature cannot attack another target until that grapple ends."
      },
      {
        "name": "Chain Screen",
        "kind": "trait",
        "text": "While at least one claim chain is free, the first ranged attack made against the Exactor each round has Disadvantage."
      }
    ],
    "actions": [
      {
        "name": "Balance the Chains",
        "kind": "action",
        "economyCost": "bonus",
        "targets": 1,
        "text": "The Exactor pulls each creature Grappled by a claim chain up to 10 feet toward a point it chooses between them. If only one creature is Grappled, the Exactor instead pulls that creature up to 10 feet toward itself."
      },
      {
        "name": "Claim Chain",
        "kind": "attack",
        "roll": "1d20+8",
        "damage": "2d6 + 5",
        "damageType": "Slashing",
        "range": "reach 10 ft.",
        "text": "If the target is Large or smaller and the chain is free, the Exactor can give the target the Grappled condition (escape DC 16)."
      },
      {
        "name": "Conjure Tether (Recharge 5–6)",
        "kind": "action",
        "damage": "2d8 + 6",
        "damageType": "Fire",
        "save": "DEX DC 16",
        "onSave": "half",
        "recharge": "5-6",
        "targets": 1,
        "text": "Dexterity Saving Throw: DC 16, one creature the Exactor can see within 60 feet. Failure: 15 (2d8 + 6) Fire damage, the target is pulled up to 20 feet toward the Exactor, and it has the Restrained condition until the end of the Exactor’s next turn. Success: Half damage only."
      }
    ],
    "reactions": [
      {
        "name": "Collect Interest",
        "kind": "action",
        "damage": "2d6",
        "damageType": "Fire",
        "targets": 1,
        "text": "When a creature Grappled by a claim chain uses a Bonus Action or Reaction, the creature takes 7 (2d6) Fire damage after the triggering action is resolved."
      }
    ],
    "resources": [],
    "notes": [
      "An infernal surveyor wrapped in two living chains. It does not build walls; it decides where bodies belong, hooks them into that geometry, and drags the battlefield toward the line it has chosen.",
      ""
    ],
    "visibility": {
      "defaultState": "hp-bar",
      "hiddenName": "Claimchain Exactor",
      "revealedName": "Claimchain Exactor"
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
    "activation": "action",
    "name": "Farwatch Glass",
    "type": "magic",
    "description": "A silver thread floats inside this thumb-sized oval of smoky glass. Tags: A1 · Utility",
    "mechanicsText": "The glass has the following properties. Once you use either property, you can't use either again until you finish a Long Rest. Farwatch. As a Magic Action, choose a creature or object you can see within 60 feet. For 10 minutes, the silver thread points toward that target while it is within 300 feet of you and on the same plane of existence. The thread doesn't reveal the target's distance or any obstacles between you. Stored Glimmer. When you cast a 1st-level spell you know or have prepared, you can cast it at its lowest level without expending a spell slot.",
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
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "bc-slipstone",
    "activation": "bonus",
    "name": "Slipstone",
    "type": "magic",
    "description": "The faces of this violet-grey stone are slightly offset. As it turns, one edge seems to move ahead of the other. Tags: A1 · Movement",
    "mechanicsText": "As a Bonus Action, you can move up to 10 feet without provoking Opportunity Attacks or spending extra movement for Difficult Terrain. Once you use this property, you can't use it again until you finish a Short or Long Rest.",
    "isUsable": false,
    "value": "60gp",
    "act": "Act 1",
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
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "bc-rootheart-seed",
    "activation": "reaction",
    "name": "Rootheart Seed",
    "type": "magic",
    "description": "Dull green-gold veins cross this black seed. It grows heavy when the ground shifts beneath its bearer. Tags: A1 · Stability",
    "mechanicsText": "When an effect would knock you Prone or move you against your will, you can take a Reaction to remain standing or reduce the forced movement by up to 10 feet. If the effect does both, choose which benefit to receive. This property doesn't prevent teleportation. Once you use this property, you can't use it again until you finish a Long Rest.",
    "isUsable": false,
    "value": "50gp",
    "act": "Act 1",
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
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "tbc-thornback-hatchet",
    "name": "Thornback Hatchet",
    "type": "weapon",
    "category": "Melee One-Handed",
    "description": "This hatchet has a hardwood grip worn smooth beneath several layers of old wrapping.",
    "mechanicsText": "You have a +1 bonus to attack and damage rolls made with this magic weapon.",
    "isUsable": false,
    "attack": "1d20+@PROF+@STR+1",
    "damage": "1d6+@STR+1",
    "crit": "2d6+@STR+1",
    "mastery": "Vex",
    "act": "Act 1",
    "sourceEncounter": "A1 The Creekside Den",
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "tbc-frontier-greataxe",
    "name": "Frontier Greataxe",
    "type": "weapon",
    "category": "Melee Two-Handed",
    "description": "This broad-headed axe has a straight-grained hardwood haft. Field repairs mark the socket, but the edge is freshly sharpened.",
    "mechanicsText": "You have a +1 bonus to attack and damage rolls made with this magic weapon.",
    "isUsable": false,
    "attack": "1d20+@PROF+@STR+1",
    "damage": "1d12+@STR+1",
    "crit": "2d12+@STR+1",
    "mastery": "Cleave",
    "act": "Act 1",
    "sourceEncounter": "A1 The Creekside Den",
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "tbc-briarfang-rapier",
    "name": "Briarfang Rapier",
    "type": "weapon",
    "category": "Finesse",
    "description": "This slender rapier has a narrow guard shaped to slip between close branches.",
    "mechanicsText": "You have a +1 bonus to attack and damage rolls made with this magic weapon.",
    "isUsable": false,
    "attack": "1d20+@PROF+@DEX+1",
    "damage": "1d8+@DEX+1",
    "crit": "2d8+@DEX+1",
    "mastery": "Vex",
    "act": "Act 1",
    "sourceEncounter": "A1 The Creekside Den",
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "tbc-canopy-bow",
    "name": "Canopy Bow",
    "type": "weapon",
    "category": "Ranged",
    "description": "Bark lacquer darkens this shortbow. Its light limbs are strung with braided gut.",
    "mechanicsText": "You have a +1 bonus to attack and damage rolls made with this magic weapon.",
    "isUsable": false,
    "attack": "1d20+@PROF+@DEX+1",
    "damage": "1d6+@DEX+1",
    "crit": "2d6+@DEX+1",
    "mastery": "Vex",
    "act": "Act 1",
    "sourceEncounter": "A1 The Creekside Den",
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "tbc-rootknot-staff",
    "name": "Rootknot Staff",
    "isSpellFocus": true,
    "type": "magic",
    "description": "A knot worked into an unfamiliar pattern crowns this wooden staff.",
    "mechanicsText": "You can use this staff as a Spellcasting Focus. While using it as a focus, you gain a +1 bonus to your spell attack rolls and spell save DC. You also have a +1 bonus to attack and damage rolls made with the staff as a magic Quarterstaff.",
    "isUsable": false,
    "attack": "1d20+@PROF+@STR+1",
    "damage": "1d6+@STR+1",
    "crit": "2d6+@STR+1",
    "mastery": "Topple",
    "spellFocusAttack": "+1",
    "spellFocusDamage": "+1",
    "spellFocusSaveDc": "+1",
    "act": "Act 1",
    "sourceEncounter": "A1 The Creekside Den",
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "tbc-ironbark-plate",
    "name": "Ironbark Plate",
    "type": "armor",
    "description": "Overlapping plates of compressed bark are riveted to an iron backing.",
    "mechanicsText": "While wearing this armor, your base Armor Class is 14, and you have Advantage on saving throws to avoid or end the Frightened condition.",
    "isUsable": false,
    "ac": "14",
    "act": "Act 1",
    "sourceEncounter": "A1 The Creekside Den",
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "tbc-huntsman-s-brigandine",
    "name": "Huntsman's Brigandine",
    "type": "armor",
    "description": "Cured hide plates cover a canvas jacket, their edges polished by long use.",
    "mechanicsText": "While wearing this armor, your base Armor Class is 14 plus your Dexterity modifier (maximum 2). You also have Advantage on Wisdom (Perception) checks.",
    "isUsable": false,
    "ac": "14 + DEX (max 2)",
    "act": "Act 1",
    "sourceEncounter": "A1 The Creekside Den",
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "tbc-tracker-s-wrap",
    "name": "Tracker's Wrap",
    "type": "armor",
    "description": "Dark cloth strips break up the outline of this close-fitting leather armor.",
    "mechanicsText": "While wearing this armor, your base Armor Class is 11 plus your Dexterity modifier. You also have Advantage on Dexterity (Stealth) checks.",
    "isUsable": false,
    "ac": "11 + DEX",
    "act": "Act 1",
    "sourceEncounter": "A1 The Creekside Den",
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "tbc-pathfinder-s-token",
    "name": "Pathfinder's Token",
    "type": "magic",
    "description": "This dense wooden disc hangs from a belt cord. It pulls gently toward open ground. Tags: A1 · Movement",
    "mechanicsText": "While wearing this token, moving through natural terrain such as mud, roots, undergrowth, and shallow water costs you no extra movement.",
    "isUsable": false,
    "act": "Act 1",
    "sourceEncounter": "A1 The Creekside Den",
    "convergence": {
      "role": "input",
      "enabled": true,
      "mechanicalTag": "Movement",
      "actLabel": "A1"
    },
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "tbc-canopy-eye",
    "activation": "bonus",
    "name": "Canopy Eye",
    "type": "magic",
    "description": "A polished amber lens rests in a small bone frame. Tags: A1 · Utility",
    "mechanicsText": "As a Bonus Action, you can make a Wisdom (Perception) check to locate a concealed creature or object you could detect with your senses. Once you use this property, you can't use it again until you finish a Short or Long Rest.",
    "isUsable": false,
    "act": "Act 1",
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
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "tbc-stillstep-blade",
    "name": "Stillstep Mace",
    "type": "weapon",
    "category": "Melee One-Handed",
    "description": "The head of this mace appears slightly displaced from its haft when seen from the corner of the eye.",
    "mechanicsText": "You have a +1 bonus to attack and damage rolls made with this magic weapon. Stillstep. Immediately after you hit a creature with this weapon, you can move up to 10 feet without provoking Opportunity Attacks. Once you use this property, you can't use it again until you finish a Short or Long Rest.",
    "isUsable": false,
    "attack": "1d20+@PROF+@STR+1",
    "damage": "1d6+@STR+1",
    "crit": "2d6+@STR+1",
    "mastery": "Sap",
    "act": "Act 1",
    "sourceEncounter": "A1 The Ruined Keep",
    "charges": {
      "max": 1,
      "reset": "shortRest"
    },
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "tbc-splitwood-maul",
    "name": "Splitwood Maul",
    "type": "weapon",
    "category": "Melee Two-Handed",
    "description": "This maul was carved from a tree split at the roots. A black seam runs through its head.",
    "mechanicsText": "You have a +1 bonus to attack and damage rolls made with this magic weapon. Splintering Blow. When you hit a Large or smaller creature with this weapon, you can push it up to 10 feet directly away from you. Once you use this property, you can't use it again until you finish a Long Rest.",
    "isUsable": false,
    "attack": "1d20+@PROF+@STR+1",
    "damage": "2d6+@STR+1",
    "crit": "4d6+@STR+1",
    "mastery": "Topple",
    "act": "Act 1",
    "sourceEncounter": "A1 The Ruined Keep",
    "charges": {
      "max": 1,
      "reset": "longRest"
    },
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "tbc-phantom-cord-dagger",
    "name": "Phantom Cord Dagger",
    "type": "weapon",
    "category": "Finesse",
    "description": "Sinew winds around this dagger's grip. After a cut, the cord draws taut toward the wounded creature.",
    "mechanicsText": "You have a +1 bonus to attack and damage rolls made with this magic weapon. When you hit a creature with it, you know the creature's exact location until the start of your next turn. It can't be hidden from you during that time.",
    "isUsable": false,
    "attack": "1d20+@PROF+@DEX+1",
    "damage": "1d4+@DEX+1",
    "crit": "2d4+@DEX+1",
    "mastery": "Nick",
    "act": "Act 1",
    "sourceEncounter": "A1 The Ruined Keep",
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "tbc-hollow-elk-bow",
    "name": "Hollow Elk Bow",
    "type": "weapon",
    "category": "Ranged",
    "description": "Pale antler reinforces the limbs of this bow. Its string hums softly when drawn.",
    "mechanicsText": "You have a +1 bonus to attack and damage rolls made with this magic weapon. Attacks made with it ignore Half Cover.",
    "isUsable": false,
    "attack": "1d20+@PROF+@DEX+1",
    "damage": "1d6+@DEX+1",
    "crit": "2d6+@DEX+1",
    "mastery": "Vex",
    "act": "Act 1",
    "sourceEncounter": "A1 The Ruined Keep",
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
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
    "description": "The grain of this pale wooden wand spirals into a dark knot at the tip. The knot resembles a watchful eye.",
    "mechanicsText": "You can use this wand as a Spellcasting Focus. The wand has 1 charge and regains its expended charge when you finish a Long Rest. When a creature succeeds on a saving throw against a spell you cast, you can expend the charge to make it reroll the saving throw. It must use the new result.",
    "isUsable": false,
    "act": "Act 1",
    "sourceEncounter": "A1 The Ruined Keep",
    "charges": {
      "max": 1,
      "reset": "longRest"
    },
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "tbc-splitgrain-vest",
    "name": "Splitgrain Vest",
    "type": "armor",
    "description": "The leather of this vest bears two overlapping grain patterns.",
    "mechanicsText": "While wearing this armor, your base Armor Class is 11 plus your Dexterity modifier, and you have Advantage on saving throws to avoid or end the Frightened condition.",
    "isUsable": false,
    "ac": "11 + DEX",
    "act": "Act 1",
    "sourceEncounter": "A1 The Ruined Keep",
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "tbc-ashwood-brigandine",
    "activation": "reaction",
    "name": "Ashwood Brigandine",
    "type": "armor",
    "description": "Dense, dark bark plates cover this brigandine. Each was cut near the edge of the corruption.",
    "mechanicsText": "While wearing this armor, your base Armor Class is 14 plus your Dexterity modifier (maximum 2). Ashwood Guard. When an attack hits you, you can take a Reaction to reduce its damage to you by 1d6. Once you use this property, you can't use it again until you finish a Long Rest.",
    "isUsable": true,
    "damage": "1d6",
    "ac": "14 + DEX (max 2)",
    "act": "Act 1",
    "sourceEncounter": "A1 The Ruined Keep",
    "charges": {
      "max": 1,
      "reset": "longRest"
    },
    "isLocked": true,
    "unlockSnapshot": "{\"ac\":\"14 + DEX (max 2)\",\"act\":\"Act 2\",\"charges\":{},\"damage\":\"1d6\",\"description\":\"Plated with bark from the corruption's edge, where the wood hardened wrong — denser than any living tree.\",\"id\":\"tbc-ashwood-brigandine\",\"isUsable\":true,\"mechanicsText\":\"AC 14 + DEX modifier (max 2). Once per long rest, when you are hit by an attack, you can use your reaction to reduce that attack's damage by 1d6.\",\"name\":\"Ashwood Brigandine\",\"sourceEncounter\":\"MIRAGE STALKER\",\"type\":\"armor\"}",
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "tbc-hollowstep-plate",
    "name": "Hollowstep Plate",
    "type": "armor",
    "description": "This plate armor bears the marks of the fort armory and later field repairs. Its joints make little sound.",
    "mechanicsText": "While wearing this armor, your base Armor Class is 16. The armor doesn't impose Disadvantage on your Dexterity (Stealth) checks.",
    "isUsable": false,
    "ac": "16",
    "act": "Act 1",
    "sourceEncounter": "A1 The Ruined Keep",
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "tbc-displaced-ward-brooch",
    "activation": "reaction",
    "name": "Displaced Ward Brooch",
    "type": "magic",
    "description": "Cracked enamel and a bent pin mark this recovered Ward field brooch. Tags: A1 · Defense",
    "mechanicsText": "When you take Force damage, you can take a Reaction to reduce that damage by 1d6, to a minimum of 0. Once you use this property, you can't use it again until you finish a Long Rest.",
    "isUsable": true,
    "damage": "1d6",
    "act": "Act 1",
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
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "tbc-pack-sense-totem",
    "name": "Pack-Sense Totem",
    "type": "magic",
    "description": "This small wooden figure hums when carried among companions and falls quiet in solitude. Tags: A1 · Stability",
    "mechanicsText": "While wearing this totem, you have Advantage on saving throws to avoid being knocked Prone.",
    "isUsable": false,
    "act": "Act 1",
    "sourceEncounter": "A1 The Ruined Keep",
    "convergence": {
      "role": "input",
      "enabled": true,
      "mechanicalTag": "Stability",
      "actLabel": "A1"
    },
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "tbc-ward-signet",
    "name": "Ward Signet",
    "type": "gear",
    "description": "Hale forms this signet from two Ward objects in front of the party, then leaves it with them as proof of Convergence. Tags: Demo output · No player recipe",
    "mechanicsText": "While wearing this signet, you can't be surprised.",
    "isUsable": false,
    "act": "Act 1",
    "sourceEncounter": "HALE'S COTTAGE",
    "isLocked": true,
    "attunementRequired": false,
    "dmNote": "Hale creates this completed item as a demonstration. It has no player recipe and can't be used as a raw component. Track it separately from the T1–T3 recipe and completed-tag totals.",
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "tbc-frostedge",
    "name": "Frostedge",
    "type": "weapon",
    "category": "Melee Versatile",
    "description": "Recovered from the Ward cache at the cemetery edge, this blade remains cold even beside a fire.",
    "mechanicsText": "You have a +1 bonus to attack and damage rolls made with this magic Longsword. It deals 1d8 Slashing damage when wielded in one hand, or 1d10 when wielded in two hands. Frostbite. When you hit a creature with this weapon, you can deal an extra 1d6 Cold damage to it. Once you use this property, you can't use it again until you finish a Short or Long Rest.",
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
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "tbc-coldshot",
    "name": "Coldshot",
    "type": "weapon",
    "category": "Ranged",
    "description": "This Ward crossbow has a pale grip and carefully balanced limbs. Frost collects in its bolt channel.",
    "mechanicsText": "While attuned to this magic Heavy Crossbow, you are proficient with it and have a +1 bonus to attack and damage rolls made with it. Coldshot. When you hit a creature with this weapon, you can deal an extra 2d6 Cold damage to it. Once you use this property, you can't use it again until you finish a Short or Long Rest.",
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
    "isLocked": true,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "tbc-rimeguard-heavy",
    "name": "Rimeguard (Heavy)",
    "type": "armor",
    "description": "The straps and plates of this armor shift as it is donned, settling into a close fit.",
    "mechanicsText": "This magic armor adapts to the highest category of armor you are proficient with. Your base Armor Class is 17 for Heavy armor, 15 plus your Dexterity modifier (maximum 2) for Medium armor, or 13 plus your Dexterity modifier for Light armor. These values include the armor's +1 bonus. While wearing the armor, you reduce the Cold damage you take from each hit by 3.",
    "isUsable": false,
    "ac": "17",
    "act": "Act 2",
    "sourceEncounter": "ELITE QUEST REWARD",
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z",
    "armorType": "heavy"
  },
  {
    "id": "tbc-rimeguard-medium",
    "name": "Rimeguard (Medium)",
    "type": "armor",
    "description": "The straps and plates of this armor shift as it is donned, settling into a close fit.",
    "mechanicsText": "This magic armor adapts to the highest category of armor you are proficient with. Your base Armor Class is 17 for Heavy armor, 15 plus your Dexterity modifier (maximum 2) for Medium armor, or 13 plus your Dexterity modifier for Light armor. These values include the armor's +1 bonus. While wearing the armor, you reduce the Cold damage you take from each hit by 3.",
    "isUsable": false,
    "ac": "15 + DEX (max 2)",
    "act": "Act 2",
    "sourceEncounter": "ELITE QUEST REWARD",
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z",
    "armorType": "heavy"
  },
  {
    "id": "tbc-rimeguard-light",
    "name": "Rimeguard (Light)",
    "type": "armor",
    "description": "The straps and plates of this armor shift as it is donned, settling into a close fit.",
    "mechanicsText": "This magic armor adapts to the highest category of armor you are proficient with. Your base Armor Class is 17 for Heavy armor, 15 plus your Dexterity modifier (maximum 2) for Medium armor, or 13 plus your Dexterity modifier for Light armor. These values include the armor's +1 bonus. While wearing the armor, you reduce the Cold damage you take from each hit by 3.",
    "isUsable": false,
    "ac": "13 + DEX",
    "act": "Act 2",
    "sourceEncounter": "ELITE QUEST REWARD",
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z",
    "armorType": "heavy"
  },
  {
    "id": "tbc-marrow",
    "name": "Marrow Shield",
    "type": "shield",
    "description": "+3 bonus to AC — a shield's base +2 plus a +1 magical bonus. When the bearer would suffer a Strength score reduction, they add +2 to the Constitution saving throw.",
    "isUsable": false,
    "statEffects": [
      {
        "type": "addAC",
        "stat": "str",
        "value": 3
      }
    ],
    "category": "Shield"
  },
  {
    "id": "tbc-frost-brace",
    "name": "Frost Brace",
    "type": "magic",
    "description": "This pale iron bracer bears the issue marks of Ward operatives stationed north of the treeline. Tags: A2 · Defense",
    "mechanicsText": "While wearing this brace, you reduce each instance of Cold damage you take by 2, to a minimum of 0. Apply this reduction before Resistance to Cold damage.",
    "isUsable": false,
    "act": "Act 2",
    "sourceEncounter": "ELITE QUEST REWARD",
    "convergence": {
      "role": "input",
      "enabled": true,
      "mechanicalTag": "Defense",
      "actLabel": "A2"
    },
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "tbc-drift-globe",
    "name": "Drift Globe",
    "type": "magic",
    "description": "Brennan left this frosted orb on the innkeeper's shelf. Its steady light doesn't gutter in wind or cold. Tags: A2 · Cleanse",
    "mechanicsText": "As a Magic Action, you can cause the globe to shed Bright Light in a 20-foot radius and Dim Light for an additional 20 feet, or extinguish its light. The globe hovers within 5 feet of you and follows you, but it can't pass through solid barriers. Revealing Flare. As a Bonus Action, you can cause the globe to flare for 1 minute. During that time, you know the spaces occupied by hidden or Invisible creatures in its Bright Light, unless they are behind Total Cover. The flare reveals their locations without making them visible. Once you use this property, you can't use it again until you finish a Long Rest.",
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
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "tbc-frostward-periapt",
    "name": "Frostward Periapt",
    "type": "magic",
    "description": "Frost never clings to this bone pendant or its leather cord. Tags: A2 · Defense",
    "mechanicsText": "While wearing this periapt, you have Advantage on saving throws against disease and against effects that would give you the Poisoned condition. You also ignore nonmagical extreme cold.",
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
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "tbc-north-wind-flask",
    "activation": "action",
    "name": "North Wind Flask",
    "type": "gear",
    "description": "Trapped wind rattles inside this blue-glass flask. Frost gathers around the cork.",
    "mechanicsText": "The flask has 2 charges and regains all expended charges at dawn. As a Magic Action, you can expend 1 charge to create a 15-foot Cube of wind originating from you. The wind lasts until the end of your next turn. A creature that enters the Cube for the first time on a turn or starts its turn there must succeed on a DC 13 Strength saving throw or be pushed 10 feet directly away from you. Ranged weapon attacks that pass through the wind have Disadvantage.",
    "isUsable": false,
    "value": "115gp",
    "act": "Act 2",
    "sourceEncounter": "NORTHGATE INN STOCK",
    "charges": {
      "max": 2,
      "reset": "manual",
      "note": "Recharges at dawn"
    },
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "tbc-frostmarrow-spear",
    "name": "Frostmarrow Spear",
    "type": "weapon",
    "category": "Melee Versatile",
    "description": "The head of this spear is made from ice recovered from the frozen lakebed. It never melts.",
    "mechanicsText": "You have a +1 bonus to attack and damage rolls made with this magic weapon. Once per round, when you hit a creature with it, you can force the creature to make a DC 13 Constitution saving throw. On a failed save, its Speed is reduced by 10 feet until the end of its next turn.",
    "isUsable": false,
    "attack": "1d20+@PROF+@STR+1",
    "damage": "1d6+@STR+1",
    "crit": "2d6+@STR+1",
    "mastery": "Sap",
    "act": "Act 2",
    "sourceEncounter": "A2 Northgate Night Defense",
    "isLocked": true,
    "riders": [
      {
        "id": "frostmarrow-bite",
        "label": "Frostmarrow",
        "cadence": "perRound",
        "condition": "On a hit: DC 13 Constitution save or its Speed drops by 10 ft until the end of its next turn."
      }
    ],
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "tbc-rimecleaver-versatile-thrown-handaxe-equivalent-1-no-attunement",
    "name": "Rimecleaver",
    "type": "weapon",
    "category": "Melee Two-Handed",
    "description": "Dark iron forms this broad greatsword. The blade stays cold through hours of use.",
    "mechanicsText": "You have a +1 bonus to attack and damage rolls made with this magic weapon. Rimecut. Once per round, when you hit a creature with this weapon, it takes an extra 1d6 Cold damage. Cleaving Step. Once per round, when an attack with this weapon reduces a creature to 0 Hit Points, you can immediately move up to 10 feet without provoking Opportunity Attacks.",
    "isUsable": false,
    "attack": "1d20+@PROF+@STR+1",
    "damage": "2d6+@STR+1",
    "crit": "4d6+@STR+1",
    "mastery": "Graze",
    "act": "Act 2",
    "sourceEncounter": "A2 Northgate Night Defense",
    "isLocked": true,
    "riders": [
      {
        "id": "rimecleaver-rimebite",
        "label": "Rimecut",
        "formula": "1d6",
        "damageType": "Cold",
        "cadence": "perRound"
      },
      {
        "id": "rimecleaver-step",
        "label": "Cleaving Step",
        "cadence": "perRound",
        "condition": "When a hit with this weapon drops a creature to 0 HP: move up to 10 ft without provoking."
      }
    ],
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "tbc-splitfrost-blade",
    "name": "Splitfrost Blade",
    "type": "weapon",
    "category": "Finesse",
    "description": "A thin line of frost follows the edge of this silent-drawing rapier.",
    "mechanicsText": "You have a +1 bonus to attack and damage rolls made with this magic weapon. Once per round, when you hit a creature with it, the first attack roll that creature makes against you before the start of your next turn has Disadvantage.",
    "isUsable": false,
    "attack": "1d20+@PROF+@DEX+1",
    "damage": "1d8+@DEX+1",
    "crit": "2d8+@DEX+1",
    "mastery": "Vex",
    "act": "Act 2",
    "sourceEncounter": "A2 Northgate Night Defense",
    "isLocked": true,
    "riders": [
      {
        "id": "splitfrost-split",
        "label": "Splitfrost",
        "cadence": "perRound",
        "condition": "On a hit: that creature's first attack roll against you before the start of your next turn has disadvantage."
      }
    ],
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "tbc-coldsnap-bow",
    "name": "Coldsnap Bow",
    "type": "weapon",
    "category": "Ranged",
    "description": "The heavy limbs of this bow are strung with pale gut stiffened by frost.",
    "mechanicsText": "You have a +1 bonus to attack and damage rolls made with this magic weapon. Once per round, when you hit a creature with it, the target takes an extra 1d4 Cold damage.",
    "isUsable": false,
    "attack": "1d20+@PROF+@DEX+1",
    "damage": "1d8+@DEX+1",
    "crit": "2d8+@DEX+1",
    "mastery": "Slow",
    "act": "Act 2",
    "sourceEncounter": "A2 Northgate Night Defense",
    "isLocked": true,
    "riders": [
      {
        "id": "coldsnap-bite",
        "label": "Coldsnap",
        "formula": "1d4",
        "damageType": "Cold",
        "cadence": "perRound"
      }
    ],
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "tbc-icebound-reliquary",
    "name": "Icebound Reliquary",
    "isSpellFocus": true,
    "type": "magic",
    "description": "A clouded piece of ice rests in a Ward field mount. A new inscription cuts across the worn remains of an older one.",
    "mechanicsText": "You can use this gem as a Spellcasting Focus. While using it as a focus, you gain a +1 bonus to your spell attack rolls and spell save DC. Mending Ice. When you cast a spell that restores Hit Points, you can have one target of the spell regain an extra 1d8 Hit Points. Once you use this property, you can't use it again until you finish a Long Rest.",
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
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "tbc-permafrost-hide",
    "name": "Permafrost Hide",
    "type": "armor",
    "description": "These cured hides remain cool and dry against the skin.",
    "mechanicsText": "While wearing this magic armor, your base Armor Class is 13 plus your Dexterity modifier, including the armor's +1 bonus. You also have Resistance to Cold damage.",
    "isUsable": false,
    "ac": "13 + DEX",
    "act": "Act 2",
    "sourceEncounter": "A2 Northgate Night Defense",
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "tbc-hollowbone-halfplate",
    "name": "Hollowbone Halfplate",
    "type": "armor",
    "description": "Hollow bone inlays run between the iron plates of this armor.",
    "mechanicsText": "While wearing this magic armor, your base Armor Class is 16 plus your Dexterity modifier (maximum 2), including the armor's +1 bonus. When a creature within 5 feet of you hits you with a melee attack, it takes 2 Cold damage.",
    "isUsable": false,
    "ac": "16 + DEX (max 2)",
    "act": "Act 2",
    "sourceEncounter": "A2 Northgate Night Defense",
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "tbc-bonemarch-plate",
    "name": "Bonemarch Plate",
    "type": "armor",
    "description": "Recovered from the Ward northern cache, this plate armor has a fine, frost-like grain in its iron.",
    "mechanicsText": "While wearing this magic armor, your base Armor Class is 17, including the armor's +1 bonus. Deathless March. When you are reduced to 0 Hit Points but not killed outright, you can drop to 1 Hit Point instead. Once you use this property, you can't use it again until you finish a Long Rest.",
    "isUsable": false,
    "ac": "17",
    "act": "Act 2",
    "sourceEncounter": "A2 Northgate Night Defense",
    "charges": {
      "max": 1,
      "reset": "longRest"
    },
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "tbc-hollow-lantern",
    "activation": "bonus",
    "name": "Hollow Lantern",
    "type": "magic",
    "description": "A pale, windless flame burns inside this Ward field lantern. Tags: A2 · Cleanse",
    "mechanicsText": "The lantern has 1 charge and regains its expended charge when you finish a Long Rest. As a Bonus Action, you can expend the charge to see Invisible creatures within 15 feet of you until the end of your next turn.",
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
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "tbc-drifter-s-knot-charm",
    "name": "Drifter's Knot Charm",
    "type": "magic",
    "description": "This frozen cord is tied in a close knot. It tugs toward solid footing when worn at the belt. Tags: A2 · Stability",
    "mechanicsText": "While wearing this charm, you have Advantage on saving throws to avoid being knocked Prone or moved against your will.",
    "isUsable": false,
    "act": "Act 2",
    "sourceEncounter": "A2 Northgate Night Defense",
    "convergence": {
      "role": "input",
      "enabled": true,
      "mechanicalTag": "Stability",
      "actLabel": "A2"
    },
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "bc-sentinel-chalk",
    "activation": "action",
    "name": "Sentinel Chalk",
    "type": "magic",
    "description": "Marks made with this blue-white chalk remain sharp beneath snow and rime. Tags: A2 · Utility",
    "mechanicsText": "The chalk has 3 charges and regains all expended charges when you finish a Long Rest. It has the following properties. Sentinel Line. As a Magic Action, you can expend 1 charge to draw a line up to 10 feet long on a solid surface within your reach. When you draw the line, you can designate any creatures you can see as exempt from it. The first other creature of Tiny size or larger to cross the line while touching that surface triggers a flash of light and a chime audible within 60 feet. The line then disappears. You can have up to three lines at a time. Each lasts until triggered, until you erase it as a Magic Action, or until you finish a Long Rest. Stored Working. When you or a willing creature touching the chalk casts a 1st- or 2nd-level spell it knows or has prepared, you can expend all 3 charges to cast the spell at its lowest level without expending a spell slot. All active lines disappear.",
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
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "bc-gloamstep-shard",
    "activation": "bonus",
    "name": "Gloamstep Shard",
    "type": "magic",
    "description": "One edge of this dark glass shard is rimed white. In dim light, it appears just beyond the hand holding it. Tags: A2 · Movement",
    "mechanicsText": "While you are in Dim Light or Darkness, you can take a Bonus Action to teleport up to 10 feet to an unoccupied space you can see that is also in Dim Light or Darkness. Once you use this property, you can't use it again until you finish a Long Rest.",
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
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "tbc-lake-ice-blade",
    "name": "Lake-Ice Flail",
    "type": "weapon",
    "category": "Melee One-Handed",
    "description": "The head of this flail was cut from ice on the lake's deepest shelf. Its surface never thaws.",
    "mechanicsText": "You have a +1 bonus to attack and damage rolls made with this magic weapon. Lake's Bite. Once per round, when you hit a creature with this weapon, it takes an extra 1d6 Cold damage. Shattering Ice. When you reduce a creature to 0 Hit Points with this weapon, each other creature of your choice within 10 feet of it takes 1d6 Cold damage.",
    "isUsable": false,
    "attack": "1d20+@PROF+@STR+1",
    "damage": "1d8+@STR+1",
    "crit": "2d8+@STR+1",
    "mastery": "Sap",
    "act": "Act 2",
    "sourceEncounter": "A2 The Frozen Lake",
    "attunementRequired": true,
    "isLocked": true,
    "riders": [
      {
        "id": "lake-ice-bite",
        "label": "Lake's Bite",
        "formula": "1d6",
        "damageType": "Cold",
        "cadence": "perRound"
      }
    ],
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "tbc-shattered-vigil",
    "name": "Shattered Vigil",
    "type": "weapon",
    "category": "Melee Two-Handed",
    "description": "Faint carvings shift across this heavy Ward hammer when viewed indirectly.",
    "mechanicsText": "This magic hammer deals 2d6 Bludgeoning damage and has the Heavy and Two-Handed properties. You have a +1 bonus to attack and damage rolls made with it. Winter's Weight. Once per round, when you hit a creature with this weapon, it takes an extra 1d8 Cold damage. Break the Vigil. When you hit a creature with this weapon, you can force it to make a DC 14 Strength saving throw. On a failed save, it has the Prone condition. Once you use this property, you can't use it again until you finish a Short or Long Rest.",
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
    "isLocked": true,
    "riders": [
      {
        "id": "shattered-vigil-bite",
        "label": "Winter's Weight",
        "formula": "1d8",
        "damageType": "Cold",
        "cadence": "perRound"
      },
      {
        "id": "shattered-vigil-topple",
        "label": "Break the Vigil",
        "cadence": "shortRest",
        "condition": "On a hit: DC 14 Strength save or knocked prone. Once per short or long rest."
      }
    ],
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "tbc-hollow-fang",
    "name": "Hollow Fang",
    "type": "weapon",
    "category": "Finesse",
    "description": "This thin rapier was recovered from the lakebed. Its blade gives a low, steady hum when drawn.",
    "mechanicsText": "You have a +1 bonus to attack and damage rolls made with this magic weapon. Hollow Hunger. Once per round, when you hit a creature with this weapon, it takes an extra 1d6 Cold damage. If you have half your Hit Point maximum or fewer Hit Points when this extra damage is dealt, you regain 1d4 Hit Points, unless the target is a Construct or Undead.",
    "isUsable": false,
    "attack": "1d20+@PROF+@DEX+1",
    "damage": "1d8+@DEX+1",
    "crit": "2d8+@DEX+1",
    "mastery": "Vex",
    "act": "Act 2",
    "sourceEncounter": "A2 The Frozen Lake",
    "attunementRequired": true,
    "isLocked": true,
    "riders": [
      {
        "id": "hollow-fang-bite",
        "label": "Hollow Hunger",
        "formula": "1d6",
        "damageType": "Cold",
        "cadence": "perRound",
        "condition": "Once per round on a hit. If you have half your Hit Point maximum or fewer Hit Points when this lands, you regain 1d4 Hit Points — unless the target is a Construct or Undead."
      }
    ],
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "tbc-starvation-brand",
    "name": "Starvation Brand",
    "type": "weapon",
    "category": "Ranged",
    "description": "Unfamiliar repairs mark the limbs of this Ward bow. Its arrows leave a brief pale trail.",
    "mechanicsText": "You have a +1 bonus to attack and damage rolls made with this magic weapon. Once per round, when you hit a creature with it, the target takes an extra 1d6 Cold damage. Until the start of your next turn, that creature regains only half as many Hit Points from healing, rounded down.",
    "isUsable": false,
    "attack": "1d20+@PROF+@DEX+1",
    "damage": "1d8+@DEX+1",
    "crit": "2d8+@DEX+1",
    "mastery": "Slow",
    "act": "Act 2",
    "sourceEncounter": "A2 The Frozen Lake",
    "attunementRequired": true,
    "isLocked": true,
    "riders": [
      {
        "id": "starvation-brand-bite",
        "label": "Starvation",
        "formula": "1d6",
        "damageType": "Cold",
        "cadence": "perRound",
        "condition": "Until the start of your next turn, that creature regains only half as many HP from any healing, rounding down."
      }
    ],
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "tbc-voidtempered-blade-versatile-longsword",
    "name": "Voidtempered Blade",
    "isSpellFocus": true,
    "type": "magic",
    "description": "This shortsword surfaced when the Wendigo fell. A spell cast through it leaves the scent of ozone along the blade.",
    "mechanicsText": "While attuned to this magic Shortsword, you are proficient with it and have a +1 bonus to attack and damage rolls made with it. You can also use it as a Spellcasting Focus while wielding it, gaining a +1 bonus to your spell attack rolls and spell save DC. Voidfrost. Once per round, when you hit a creature with this weapon on a turn during which you have cast a spell, the target takes an extra 1d8 Cold damage.",
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
    "isLocked": true,
    "riders": [
      {
        "id": "voidtempered-bite",
        "label": "Voidfrost",
        "formula": "1d8",
        "damageType": "Cold",
        "cadence": "perRound",
        "condition": "Only on a turn you also cast a spell."
      }
    ],
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "tbc-wight-iron-plate",
    "name": "Wight Iron Plate",
    "type": "armor",
    "description": "This near-black plate armor was abandoned at the Ward lake base. Its iron is faintly warm.",
    "mechanicsText": "While wearing this magic armor, your base Armor Class is 18, including the armor's +1 bonus. You have Advantage on saving throws to avoid or end the Paralyzed or Restrained condition. If an effect would reduce your Strength score, reduce that loss by 1, to a minimum of 0.",
    "isUsable": false,
    "ac": "18",
    "act": "Act 2",
    "sourceEncounter": "A2 The Frozen Lake",
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "tbc-frosted-sentinel-wrap",
    "name": "Frosted Sentinel Wrap",
    "type": "armor",
    "description": "Field notes cover the lining of this armor. The handwriting grows less steady toward the final entry: \"north.\"",
    "mechanicsText": "While wearing this magic armor, your base Armor Class is 16 plus your Dexterity modifier (maximum 2), including the armor's +1 bonus. You have Resistance to Cold damage. When a melee attack hits you, the attacker takes 1d4 Cold damage.",
    "isUsable": true,
    "damage": "1d4",
    "ac": "16 + DEX (max 2)",
    "act": "Act 2",
    "sourceEncounter": "A2 The Frozen Lake",
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "tbc-veilstitched-leathers",
    "name": "Veilstitched Leathers",
    "type": "armor",
    "description": "The surface of these fitted leathers is smooth and entirely without grain.",
    "mechanicsText": "While wearing this magic armor, your base Armor Class is 13 plus your Dexterity modifier, including the armor's +1 bonus. You also have Advantage on Dexterity saving throws. Warding Veil. The first time in each encounter that you take damage that would reduce you below half your Hit Point maximum, you gain 2d6 Temporary Hit Points.",
    "isUsable": true,
    "damage": "2d6",
    "charges": {
      "max": 1,
      "reset": "encounter"
    },
    "ac": "13 + DEX",
    "act": "Act 2",
    "sourceEncounter": "A2 The Frozen Lake",
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "tbc-wendigo-heart-ember",
    "activation": "action",
    "name": "Wendigo Ember Heart",
    "type": "magic",
    "damage": "3d6",
    "saveDc": "CON DC 13",
    "description": "This porous black remnant crumbles like burned stone at the edges. It is warm to the touch, but a firm grip draws a pulse of cold from within. Tags: A2 · Offensive",
    "mechanicsText": "As a Magic Action, choose one creature you can see within 30 feet. The target must make a DC 13 Constitution saving throw, taking 3d6 Cold damage on a failed save or half as much damage on a successful one. Once you use this property, you can't use it again until the next dawn.",
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
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "tbc-frozen-lake-core",
    "name": "Frozen Lake Core",
    "type": "magic",
    "description": "This clear column of ice was found waiting on the shore after the battle at the lake. Tags: A2 · Stability",
    "mechanicsText": "When you fail a saving throw, you can roll 1d4 and add it to the total, possibly turning the failure into a success. Once you use this property, you can't use it again until the next dawn.",
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
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "bc-anchor-thread",
    "name": "Anchor Thread",
    "type": "magic",
    "description": "This braided metal thread tightens when its bearer loses their footing. Tags: Recipe: Movement + Stability · Completed: Stability",
    "mechanicsText": "When an effect would knock you Prone or move you against your will, you can remain standing or ignore that forced movement. If the effect does both, choose which benefit to receive. This property doesn't prevent teleportation or falling. Once you use this property, you can't use it again until you finish a Long Rest.",
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
      "mechanicalTag": "Movement + Stability",
      "tier": "T1"
    },
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
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
    "description": "Pale threads line this light hood, catching the edges of reflected images. Tags: Recipe: Defense + Utility · Completed: Defense",
    "mechanicsText": "When you fail a saving throw against the Charmed or Frightened condition, or against an illusion spell or effect, you can reroll the saving throw. You must use the new result. Once you use this property, you can't use it again until you finish a Long Rest.",
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
      "mechanicalTag": "Defense + Utility",
      "tier": "T1"
    },
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "bc-step-stabilizer",
    "activation": "bonus",
    "name": "Step Stabilizer",
    "type": "magic",
    "description": "These small heel plates settle firmly against uneven ground. Tags: Recipe: Movement + Utility · Completed: Movement",
    "mechanicsText": "Moving through natural Difficult Terrain costs you no extra movement. Sure Step. You can take the Disengage action as a Bonus Action. Once you use this property, you can't use it again until you finish a Short or Long Rest.",
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
      "mechanicalTag": "Movement + Utility",
      "tier": "T1"
    },
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "bc-reinforced-wrap",
    "activation": "reaction",
    "name": "Reinforced Wrap",
    "type": "magic",
    "description": "This strip of grey Ward cloth stiffens when struck. Tags: Recipe: Defense + Stability · Completed: Defense",
    "mechanicsText": "When an attack hits you, after its damage is determined, you can take a Reaction to reduce that damage by 1d10, to a minimum of 0. Once you use this property, you can't use it again until you finish a Long Rest.",
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
      "mechanicalTag": "Defense + Stability",
      "tier": "T1"
    },
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "bc-lensing-glass",
    "activation": "bonus",
    "name": "Lensing Glass",
    "type": "magic",
    "description": "Fine silver lines frame the edge of this clear lens. Tags: Recipe: Cleanse + Utility · Completed: Cleanse",
    "mechanicsText": "The glass has 2 charges and regains all expended charges when you finish a Long Rest. As a Bonus Action, you can expend 1 charge to see Invisible creatures and see through magical darkness and other magical visual obscurement within 30 feet of you until the end of your next turn. This sight doesn't extend through solid objects or nonmagical obscurement.",
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
      "mechanicalTag": "Cleanse + Utility",
      "tier": "T1"
    },
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "bc-splitgrain-grip",
    "name": "Splitgrain Grip",
    "type": "magic",
    "damage": "1d6",
    "description": "Two opposing grains run along this narrow wooden weapon wrap. Tags: Recipe: Offensive + Movement · Completed: Offensive",
    "mechanicsText": "When you hit a creature with a weapon attack, you can deal an extra 1d6 damage of one type dealt by the attack. Immediately after the attack resolves, you can move up to 10 feet without provoking Opportunity Attacks from that creature. Once you use this property, you can't use it again until you finish a Long Rest.",
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
      "mechanicalTag": "Offensive + Movement",
      "tier": "T1"
    },
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "bc-drift-anchor",
    "name": "Drift Anchor",
    "type": "magic",
    "description": "This compact Ward anchor grows heavy when pulled away from its bearer. Tags: Recipe: Movement + Stability · Completed: Stability",
    "mechanicsText": "You have Advantage on saving throws to avoid being moved against your will or knocked Prone. Hold Fast. When a hostile effect would move you against your will or knock you Prone, you can ignore all forced movement and any Prone condition caused by that effect. This property doesn't prevent teleportation or falling. Once you use this property, you can't use it again until you finish a Long Rest.",
    "isUsable": false,
    "tier": "2",
    "act": "Act 2",
    "charges": {
      "max": 1,
      "reset": "longRest",
      "note": ""
    },
    "convergence": {
      "role": "output",
      "enabled": true,
      "mechanicalTag": "Movement + Stability",
      "tier": "T2"
    },
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
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
    "description": "A pale flame burns inside a small, dark casing without illuminating the space around it. Tags: Recipe: Cleanse + Utility · Completed: Utility",
    "mechanicsText": "You can see through magical darkness within 30 feet of you. The item also has the following properties. Once you use either, you can't use either again until you finish a Long Rest. Clear Mind. When you fail a saving throw against the Blinded, Charmed, Frightened, or Restrained condition, you can reroll it. You must use the new result. Stored Light. When you cast a 1st- or 2nd-level spell you know or have prepared, you can cast it at its lowest level without expending a spell slot.",
    "isUsable": false,
    "tier": "2",
    "act": "Act 2",
    "charges": {
      "max": 1,
      "reset": "longRest",
      "note": ""
    },
    "convergence": {
      "role": "output",
      "enabled": true,
      "mechanicalTag": "Cleanse + Utility",
      "tier": "T2"
    },
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "bc-quickstep",
    "activation": "bonus",
    "name": "Quickstep",
    "type": "magic",
    "description": "These light Ward plates fasten to the feet and click softly with each stride. Tags: Recipe: Movement + Utility · Completed: Movement",
    "mechanicsText": "Your Speed increases by 5 feet, and moving through Difficult Terrain costs you no extra movement. Quickstep. You can take the Dash action as a Bonus Action. When you do, your movement doesn't provoke Opportunity Attacks for the rest of that turn. Once you use this property, you can't use it again until you finish a Long Rest.",
    "isUsable": false,
    "tier": "2",
    "act": "Act 2",
    "charges": {
      "max": 1,
      "reset": "longRest",
      "note": ""
    },
    "convergence": {
      "role": "output",
      "enabled": true,
      "mechanicalTag": "Movement + Utility",
      "tier": "T2"
    },
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "bc-edgeworn",
    "name": "Edgeworn",
    "type": "magic",
    "description": "Sharpened wood grain lines the inner face of this thin grip plate. Tags: Recipe: Offensive + Cleanse · Completed: Cleanse",
    "mechanicsText": "When you hit a creature with a weapon attack, you can choose one damage type dealt by the attack. For that hit, the attack ignores the target's Resistance to the chosen damage type and treats its Immunity to that type as Resistance instead. Once you use this property, you can't use it again until you finish a Long Rest.",
    "isUsable": false,
    "tier": "2",
    "act": "Act 2",
    "charges": {
      "max": 1,
      "reset": "longRest",
      "note": ""
    },
    "convergence": {
      "role": "output",
      "enabled": true,
      "mechanicalTag": "Offensive + Cleanse",
      "tier": "T2"
    },
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "bc-driftveil",
    "activation": "reaction",
    "name": "Driftveil",
    "type": "magic",
    "description": "The hem of this short mantle draws sideways when a blow approaches. Tags: Recipe: Defense + Movement · Completed: Defense",
    "mechanicsText": "When an attack hits you, after its damage is determined, you can take a Reaction to reduce that damage by 1d8, to a minimum of 0. After the attack resolves, you can move up to 10 feet without provoking Opportunity Attacks. Once you use this property, you can't use it again until you finish a Long Rest.",
    "isUsable": true,
    "damage": "1d8",
    "tier": "2",
    "act": "Act 2",
    "charges": {
      "max": 1,
      "reset": "longRest",
      "note": ""
    },
    "convergence": {
      "role": "output",
      "enabled": true,
      "mechanicalTag": "Defense + Movement",
      "tier": "T2"
    },
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "bc-clearward-mantle",
    "activation": "bonus",
    "name": "Clearward Mantle",
    "type": "magic",
    "description": "This narrow shoulder wrap grows warm in the presence of poison or hostile magic. Tags: Recipe: Defense + Cleanse · Completed: Cleanse",
    "mechanicsText": "You have Advantage on saving throws against effects that would give you the Poisoned condition. Clearward. As a Bonus Action, you can end one instance of the Blinded, Charmed, Frightened, or Poisoned condition on yourself. The source of the condition remains and can impose it again. Once you use this property, you can't use it again until you finish a Long Rest.",
    "isUsable": false,
    "tier": "2",
    "act": "Act 2",
    "charges": {
      "max": 1,
      "reset": "longRest",
      "note": ""
    },
    "convergence": {
      "role": "output",
      "enabled": true,
      "mechanicalTag": "Defense + Cleanse",
      "tier": "T2"
    },
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "bc-turnstep-relay",
    "activation": "reaction",
    "name": "Turnstep Relay",
    "type": "magic",
    "description": "Marks on these hinged plates turn toward nearby movement. Tags: Recipe: Movement + Tactical · Completed: Movement",
    "mechanicsText": "When a hostile creature you can see within 30 feet starts its turn, you can take a Reaction to move up to half your current Speed without provoking Opportunity Attacks. You move before the creature moves or takes an action. Once you use this property, you can't use it again until you finish a Long Rest.",
    "isUsable": false,
    "tier": "2",
    "act": "Act 3",
    "charges": {
      "max": 1,
      "reset": "longRest",
      "note": ""
    },
    "convergence": {
      "role": "output",
      "enabled": true,
      "mechanicalTag": "Movement + Tactical",
      "tier": "T2"
    },
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "bc-opening-thorn",
    "name": "Opening Thorn",
    "type": "magic",
    "description": "A bright seam runs along the curve of this hooked thorn. Tags: Recipe: Offensive + Tactical · Completed: Tactical",
    "mechanicsText": "When you damage a creature, you can mark it until the start of your next turn. The next ally other than you to attack the marked creature or force it to make a saving throw can use the mark before the roll is made. That ally gains Advantage on one attack roll against the creature, or subtracts 1d4 from one saving throw the creature makes against the ally's spell or feature. The mark then ends. If that attack hits or that saving throw fails, the ally can move up to 10 feet without provoking Opportunity Attacks from the marked creature. Once you use this property, you can't use it again until you finish a Long Rest.",
    "isUsable": false,
    "tier": "2",
    "act": "Act 3",
    "charges": {
      "max": 1,
      "reset": "longRest",
      "note": ""
    },
    "convergence": {
      "role": "output",
      "enabled": true,
      "mechanicalTag": "Offensive + Tactical",
      "tier": "T2"
    },
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "bc-heldroot-knot",
    "name": "Heldroot Knot",
    "type": "magic",
    "description": "Fine silver thread is woven through a closed loop of braided root. Tags: Recipe: Utility + Continuity · Completed: Continuity",
    "mechanicsText": "When a hostile creature's Reaction prevents an action you took from affecting any target, you can regain one spell slot, item charge, or use or point of a class resource spent on that action. This property can't restore a Convergence item's own use. Once you use this property, you can't use it again until you finish a Long Rest.",
    "isUsable": false,
    "tier": "2",
    "act": "Act 3",
    "charges": {
      "max": 1,
      "reset": "longRest",
      "note": ""
    },
    "convergence": {
      "role": "output",
      "enabled": true,
      "mechanicalTag": "Utility + Continuity",
      "tier": "T2"
    },
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "bc-rootfast-loop",
    "name": "Rootfast Loop",
    "type": "magic",
    "description": "This seamless loop of living root remains firm under strain. Tags: Recipe: Stability + Continuity · Completed: Stability",
    "mechanicsText": "When you fail a saving throw or ability check to avoid or end the Prone, Grappled, or Restrained condition, or to resist being moved against your will, you can succeed instead. Once you use this property, you can't use it again until you finish a Long Rest.",
    "isUsable": false,
    "tier": "2",
    "act": "Act 3",
    "charges": {
      "max": 1,
      "reset": "longRest",
      "note": ""
    },
    "convergence": {
      "role": "output",
      "enabled": true,
      "mechanicalTag": "Stability + Continuity",
      "tier": "T2"
    },
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
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
    "activation": "reaction",
    "name": "Branchcall Marker",
    "type": "magic",
    "description": "Branching paths cover a thin disc of living wood. Two routes brighten when the disc is turned. Tags: A3 · Tactical",
    "mechanicsText": "When a creature you can see within 30 feet ends its turn, you can take a Reaction to let yourself and one willing ally you can see within 30 feet each move up to 10 feet without provoking Opportunity Attacks. Your ally doesn't need to take a Reaction. Once you use this property, you can't use it again until you finish a Long Rest.",
    "isUsable": false,
    "act": "Act 3",
    "sourceEncounter": "A3 The Center",
    "charges": {
      "max": 1,
      "reset": "longRest",
      "note": ""
    },
    "convergence": {
      "role": "input",
      "enabled": true,
      "mechanicalTag": "Tactical",
      "actLabel": "A3"
    },
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "tbc-held-echo-knot",
    "name": "Held-Echo Knot",
    "type": "magic",
    "description": "This knot of silver bark-fiber remains taut after it is released. Tags: A3 · Continuity",
    "mechanicsText": "When a hostile creature's Reaction prevents a limited-use, non-spell class feature you used from affecting any target, you can regain one use or resource point spent on that feature. The knot can't restore spellcasting resources. Once you use this property, you can't use it again until you finish a Long Rest.",
    "isUsable": false,
    "act": "Act 3",
    "sourceEncounter": "A3 The Center",
    "charges": {
      "max": 1,
      "reset": "longRest",
      "note": ""
    },
    "convergence": {
      "role": "input",
      "enabled": true,
      "mechanicalTag": "Continuity",
      "actLabel": "A3"
    },
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "tbc-veilwash-leaf",
    "activation": "action",
    "name": "Veilwash Leaf",
    "type": "magic",
    "description": "Warm yellow and icy blue light flow in opposite directions through this translucent leaf. Tags: A3 · Cleanse",
    "mechanicsText": "As a Magic Action, you can touch a willing creature and end one instance of the Blinded, Deafened, Paralyzed, or Poisoned condition on it. The source of the condition remains and can impose it again. Once you use this property, you can't use it again until you finish a Long Rest.",
    "isUsable": false,
    "act": "Act 3",
    "sourceEncounter": "A3 The Center",
    "charges": {
      "max": 1,
      "reset": "longRest",
      "note": ""
    },
    "convergence": {
      "role": "input",
      "enabled": true,
      "mechanicalTag": "Cleanse",
      "actLabel": "A3"
    },
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "tbc-thornwake-splinter",
    "name": "Thornwake Splinter",
    "type": "magic",
    "damage": "2d8",
    "description": "A point of amber-red light glows at the tip of this dark thorn. Tags: A3 · Offensive",
    "mechanicsText": "When you damage a creature with a weapon or spell attack, you can deal an extra 2d8 damage to that creature. Choose one of the damage types dealt by the attack for this extra damage. Once you use this property, you can't use it again until you finish a Long Rest.",
    "isUsable": false,
    "act": "Act 3",
    "sourceEncounter": "A3 The Center",
    "charges": {
      "max": 1,
      "reset": "longRest",
      "note": ""
    },
    "convergence": {
      "role": "input",
      "enabled": true,
      "mechanicalTag": "Offensive",
      "actLabel": "A3"
    },
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "tbc-crosspath-token",
    "name": "Crosspath Token",
    "type": "magic",
    "description": "A pale vein divides this forked blackwood token. Tags: A3 · Tactical",
    "mechanicsText": "Immediately after Initiative is rolled, before the first turn begins, you can use one of the following properties. Once you use either property, you can't use either again until you finish a Long Rest. Cross the Path. Choose a hostile creature you can see that is ahead of you in the Initiative order. Your turn moves to immediately after that creature's turn. No other creature's position changes. First Working. Choose yourself or one willing ally you can see within 30 feet. The chosen creature's next 1st- or 2nd-level spell cast before the end of the first round is cast at its lowest level without expending a spell slot. It must know or have prepared the spell.",
    "isUsable": false,
    "act": "Act 3",
    "sourceEncounter": "A3 Gate I: Twilight Pond",
    "charges": {
      "max": 1,
      "reset": "longRest",
      "note": ""
    },
    "convergence": {
      "role": "input",
      "enabled": true,
      "mechanicalTag": "Tactical",
      "actLabel": "A3"
    },
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "tbc-rootbound-thread",
    "name": "Rootbound Thread",
    "type": "magic",
    "description": "Green-gold root fiber is braided around a dark inner strand. Tags: A3 · Continuity",
    "mechanicsText": "When you fail a Constitution saving throw to maintain Concentration, you can succeed instead. Once you use this property, you can't use it again until you finish a Long Rest.",
    "isUsable": false,
    "act": "Act 3",
    "sourceEncounter": "A3 Gate I: Twilight Pond",
    "charges": {
      "max": 1,
      "reset": "longRest",
      "note": ""
    },
    "convergence": {
      "role": "input",
      "enabled": true,
      "mechanicalTag": "Continuity",
      "actLabel": "A3"
    },
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "tbc-bloodbriar-seed",
    "name": "Bloodbriar Seed",
    "type": "magic",
    "damage": "2d8",
    "description": "Two hooked veins cross this red-black seed. They glow in turn when nearby blows land. Tags: A3 · Offensive",
    "mechanicsText": "After you damage a hostile creature, you can mark it until the end of the current round. The next time an ally other than you hits the marked creature with a weapon or spell attack before then, the attack deals an extra 2d8 damage of one type it deals. The mark then ends. Once you use this property, you can't use it again until you finish a Long Rest.",
    "isUsable": false,
    "act": "Act 3",
    "sourceEncounter": "A3 Gate I: Twilight Pond",
    "charges": {
      "max": 1,
      "reset": "longRest",
      "note": ""
    },
    "convergence": {
      "role": "input",
      "enabled": true,
      "mechanicalTag": "Offensive",
      "actLabel": "A3"
    },
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "tbc-mirrorbark-scale",
    "activation": "reaction",
    "name": "Mirrorbark Scale",
    "effect": {
      "type": "reroll",
      "rerollMethod": "reroll",
      "condition": "when an attack hits you (Reaction) — the attacker rerolls"
    },
    "type": "magic",
    "description": "Reflections appear slightly early in the polished grain of this small bark scale. Tags: A3 · Defense",
    "mechanicsText": "When a hostile creature hits you with an attack, before damage is rolled, you can take a Reaction to force it to reroll the attack. The attacker must use the new result. Once you use this property, you can't use it again until you finish a Long Rest.",
    "isUsable": false,
    "act": "Act 3",
    "sourceEncounter": "A3 Gate I: Twilight Pond",
    "charges": {
      "max": 1,
      "reset": "longRest",
      "note": ""
    },
    "convergence": {
      "role": "input",
      "enabled": true,
      "mechanicalTag": "Defense",
      "actLabel": "A3"
    },
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "item-mt4owsbd",
    "name": "Gift of Oakheart",
    "type": "weapon",
    "description": "Amber light shines through the grain of this living wooden weapon. A leaf-shaped mark rests beneath the wielder's thumb.",
    "isUsable": true,
    "sourceEncounter": "A3 Gate II: Open Clearing",
    "chassis": {
      "categories": [],
      "ability": "any",
      "formIds": [
        "base-longsword",
        "base-battleaxe",
        "base-warhammer",
        "base-war-pick",
        "base-mace",
        "base-flail",
        "base-morningstar"
      ],
      "requireTags": [],
      "anyOfTags": []
    },
    "grantsProficiency": true,
    "pbToDamage": true,
    "chassisBonus": 2,
    "act": "Act 3",
    "mechanicsText": "You have a +2 bonus to attack and damage rolls made with this magic weapon. On a hit, add your Proficiency Bonus to the damage roll, and the weapon deals an extra 1d6 damage of its normal type. While attuned to the weapon, you are proficient with it. Sheltering Bough. Once on each of your turns, when you hit a creature with this weapon, you can grant 1d6 Temporary Hit Points to yourself or one willing creature you can see within 5 feet of you.",
    "attunementRequired": true,
    "riders": [
      {
        "id": "rider-gift-of-the-realmkeeper",
        "label": "Sheltering Bough",
        "cadence": "perTurn",
        "formula": "1d6",
        "damageType": "Healing",
        "condition": "Once on each of your turns, when you hit: 1d6 Temporary HP to you or one willing creature you can see within 5 feet"
      }
    ],
    "sourceEncounters": [
      "A3 Gate III: Veilscar Hollow"
    ],
    "chassisBonusDice": "1d6",
    "revisedAt": "2026-09-16T12:41:00.000Z",
    "dmNote": "The forest bestows one Feywild Gift on each character in Act 3. Weapon Gifts take a permanent mundane form from their listed category. Gift of First Light is a Quarterstaff used as a two-handed focus; Gift of Duskthorn is a weapon charm. Keep the weapon's normal dice, properties, and attack ability; Weapon Mastery requires a feature that grants it. A damage or healing roll receives the Gifts' PB + 1d6 benefit only once, even if both a weapon attack and a Magic action qualify. Extra damage matches a damage type of the triggering attack or effect. For a roll shared by several targets, use the modified total for every target. Magic-action bonuses apply to rolls resolved as part of that action, not later damage from an ongoing effect. Cantrip Weaving is part of the Attack action. Both focuses can channel cantrips and spells without Material components. Their +2 bonuses apply while wielded; use the higher bonus if another item grants a bonus to the same roll or save DC. For a weapon attack made through a spell, use the Gift's +2 weapon bonus rather than also adding its +2 spell bonus. On a Critical Hit, double damage dice, including added dice, but not fixed bonuses."
  },
  {
    "id": "tbc-gift-of-the-last-measure",
    "name": "Gift of Winter's Mercy",
    "chassis": {
      "categories": [],
      "ability": "any",
      "requireTags": [],
      "formIds": [
        "base-greatclub",
        "base-greataxe",
        "base-greatsword",
        "base-maul",
        "base-battleaxe",
        "base-warhammer",
        "base-war-pick"
      ],
      "anyOfTags": []
    },
    "description": "A fine blue edge gleams along this heavy weapon of winter-pale wood. The grip grows cold when its wielder is wounded.",
    "type": "weapon",
    "isUsable": true,
    "act": "Act 3",
    "sourceEncounter": "A3 Gate II: Open Clearing",
    "sourceEncounters": [
      "A3 Gate III: Veilscar Hollow"
    ],
    "grantsProficiency": true,
    "pbToDamage": true,
    "chassisBonus": 2,
    "attunementRequired": true,
    "mechanicsText": "You have a +2 bonus to attack and damage rolls made with this magic weapon. On a hit, add your Proficiency Bonus to the damage roll, and the weapon deals an extra 1d6 damage of its normal type. While attuned to the weapon, you are proficient with it. Winter's Wrath. Once on each of your turns, when you hit a creature with this weapon while you have half your Hit Point maximum or fewer Hit Points, the attack deals an extra 2d6 damage of the weapon's type.",
    "riders": [
      {
        "id": "rider-gift-of-the-last-measure",
        "label": "Winter's Wrath",
        "cadence": "perTurn",
        "formula": "2d6",
        "condition": "Once on each of your turns: the hit lands while you have half your Hit Point maximum or fewer Hit Points"
      }
    ],
    "chassisBonusDice": "1d6",
    "revisedAt": "2026-09-16T12:41:00.000Z",
    "dmNote": "The forest bestows one Feywild Gift on each character in Act 3. Weapon Gifts take a permanent mundane form from their listed category. Gift of First Light is a Quarterstaff used as a two-handed focus; Gift of Duskthorn is a weapon charm. Keep the weapon's normal dice, properties, and attack ability; Weapon Mastery requires a feature that grants it. A damage or healing roll receives the Gifts' PB + 1d6 benefit only once, even if both a weapon attack and a Magic action qualify. Extra damage matches a damage type of the triggering attack or effect. For a roll shared by several targets, use the modified total for every target. Magic-action bonuses apply to rolls resolved as part of that action, not later damage from an ongoing effect. Cantrip Weaving is part of the Attack action. Both focuses can channel cantrips and spells without Material components. Their +2 bonuses apply while wielded; use the higher bonus if another item grants a bonus to the same roll or save DC. For a weapon attack made through a spell, use the Gift's +2 weapon bonus rather than also adding its +2 spell bonus. On a Critical Hit, double damage dice, including added dice, but not fixed bonuses."
  },
  {
    "id": "tbc-gift-of-the-long-watch",
    "name": "Gift of Hartseeker",
    "chassis": {
      "categories": [],
      "ability": "any",
      "formIds": [
        "base-shortbow",
        "base-longbow",
        "base-light-crossbow",
        "base-heavy-crossbow"
      ],
      "requireTags": [],
      "anyOfTags": []
    },
    "description": "Golden veins trace the limbs and grip of this wooden hunting weapon. When drawn or raised, they form the outline of a running hart.",
    "type": "weapon",
    "isUsable": true,
    "act": "Act 3",
    "sourceEncounter": "A3 Gate II: Open Clearing",
    "sourceEncounters": [
      "A3 Gate III: Veilscar Hollow"
    ],
    "grantsProficiency": true,
    "pbToDamage": true,
    "chassisBonus": 2,
    "attunementRequired": true,
    "mechanicsText": "You have a +2 bonus to attack and damage rolls made with this magic weapon. On a hit, add your Proficiency Bonus to the damage roll, and the weapon deals an extra 1d6 damage of its normal type. While attuned to the weapon, you are proficient with it. Hunter's Aim. If the first ranged attack you make with this weapon on your turn hits a creature, it deals an extra 1d8 damage of the weapon's type.",
    "riders": [
      {
        "id": "rider-gift-of-the-hunter-s-bounty",
        "label": "Hunter's Aim",
        "cadence": "perTurn",
        "formula": "1d8",
        "condition": "The FIRST ranged attack you make with this weapon on your turn hits"
      }
    ],
    "chassisBonusDice": "1d6",
    "revisedAt": "2026-09-16T12:41:00.000Z",
    "dmNote": "The forest bestows one Feywild Gift on each character in Act 3. Weapon Gifts take a permanent mundane form from their listed category. Gift of First Light is a Quarterstaff used as a two-handed focus; Gift of Duskthorn is a weapon charm. Keep the weapon's normal dice, properties, and attack ability; Weapon Mastery requires a feature that grants it. A damage or healing roll receives the Gifts' PB + 1d6 benefit only once, even if both a weapon attack and a Magic action qualify. Extra damage matches a damage type of the triggering attack or effect. For a roll shared by several targets, use the modified total for every target. Magic-action bonuses apply to rolls resolved as part of that action, not later damage from an ongoing effect. Cantrip Weaving is part of the Attack action. Both focuses can channel cantrips and spells without Material components. Their +2 bonuses apply while wielded; use the higher bonus if another item grants a bonus to the same roll or save DC. For a weapon attack made through a spell, use the Gift's +2 weapon bonus rather than also adding its +2 spell bonus. On a Critical Hit, double damage dice, including added dice, but not fixed bonuses."
  },
  {
    "id": "tbc-gift-of-the-open-hand",
    "name": "Gift of Rimefang",
    "chassis": {
      "categories": [],
      "ability": "any",
      "requireTags": [],
      "formIds": [
        "base-dagger",
        "base-dagger-str",
        "base-handaxe",
        "base-javelin",
        "base-light-hammer",
        "base-spear",
        "base-trident",
        "base-dart"
      ],
      "anyOfTags": []
    },
    "description": "This throwing weapon is carved from frost-pale wood. A thin blue trail follows it through the air and back to its wielder.",
    "type": "weapon",
    "isUsable": true,
    "act": "Act 3",
    "sourceEncounter": "A3 Gate II: Open Clearing",
    "sourceEncounters": [
      "A3 Gate III: Veilscar Hollow"
    ],
    "grantsProficiency": true,
    "pbToDamage": true,
    "chassisBonus": 2,
    "attunementRequired": true,
    "mechanicsText": "You have a +2 bonus to attack and damage rolls made with this magic weapon. On a hit, add your Proficiency Bonus to the damage roll, and the weapon deals an extra 1d6 damage of its normal type. While attuned to the weapon, you are proficient with it. Returning. Immediately after you make a ranged attack by throwing this weapon, it flies back to an empty hand. If neither hand is free, it falls in your space. Relentless Hunt. Once on each of your turns, when you hit a creature with a ranged attack by throwing this weapon, the attack deals an extra 2d6 damage of the weapon's type if you have already hit that creature with a different attack this turn.",
    "riders": [
      {
        "id": "rider-gift-of-the-necessary-cull",
        "label": "Relentless Hunt",
        "cadence": "perTurn",
        "formula": "2d6",
        "condition": "Once on each of your turns: a thrown hit on a creature you already hit with a different attack this turn"
      }
    ],
    "chassisBonusDice": "1d6",
    "revisedAt": "2026-09-16T12:41:00.000Z",
    "dmNote": "The forest bestows one Feywild Gift on each character in Act 3. Weapon Gifts take a permanent mundane form from their listed category. Gift of First Light is a Quarterstaff used as a two-handed focus; Gift of Duskthorn is a weapon charm. Keep the weapon's normal dice, properties, and attack ability; Weapon Mastery requires a feature that grants it. A damage or healing roll receives the Gifts' PB + 1d6 benefit only once, even if both a weapon attack and a Magic action qualify. Extra damage matches a damage type of the triggering attack or effect. For a roll shared by several targets, use the modified total for every target. Magic-action bonuses apply to rolls resolved as part of that action, not later damage from an ongoing effect. Cantrip Weaving is part of the Attack action. Both focuses can channel cantrips and spells without Material components. Their +2 bonuses apply while wielded; use the higher bonus if another item grants a bonus to the same roll or save DC. For a weapon attack made through a spell, use the Gift's +2 weapon bonus rather than also adding its +2 spell bonus. On a Critical Hit, double damage dice, including added dice, but not fixed bonuses."
  },
  {
    "id": "tbc-gift-of-the-quiet-step",
    "name": "Gift of Thornrunner",
    "chassis": {
      "categories": [],
      "ability": "any",
      "anyOfTags": [],
      "formIds": [
        "base-club",
        "base-dagger",
        "base-dagger-str",
        "base-sickle",
        "base-scimitar",
        "base-scimitar-str",
        "base-shortsword",
        "base-shortsword-str",
        "base-rapier",
        "base-rapier-str",
        "base-whip"
      ],
      "requireTags": []
    },
    "description": "Golden light traces an unbroken path through the wood of this slender weapon, from its grip to its striking end.",
    "type": "weapon",
    "isUsable": true,
    "act": "Act 3",
    "sourceEncounter": "A3 Gate II: Open Clearing",
    "sourceEncounters": [
      "A3 Gate III: Veilscar Hollow"
    ],
    "grantsProficiency": true,
    "pbToDamage": true,
    "chassisBonus": 2,
    "attunementRequired": true,
    "mechanicsText": "You have a +2 bonus to attack and damage rolls made with this magic weapon. On a hit, add your Proficiency Bonus to the damage roll, and the weapon deals an extra 1d6 damage of its normal type. While attuned to the weapon, you are proficient with it. Parting Strike. Once on each of your turns, when you hit a creature with a melee attack using this weapon, you can prevent it from making Opportunity Attacks until the start of your next turn.",
    "riders": [
      {
        "id": "rider-gift-of-the-open-way",
        "label": "Parting Strike",
        "cadence": "perTurn",
        "condition": "Once on each of your turns, after a melee hit: the target can't make Opportunity Attacks until the start of your next turn"
      }
    ],
    "chassisBonusDice": "1d6",
    "revisedAt": "2026-09-16T12:41:00.000Z",
    "dmNote": "The forest bestows one Feywild Gift on each character in Act 3. Weapon Gifts take a permanent mundane form from their listed category. Gift of First Light is a Quarterstaff used as a two-handed focus; Gift of Duskthorn is a weapon charm. Keep the weapon's normal dice, properties, and attack ability; Weapon Mastery requires a feature that grants it. A damage or healing roll receives the Gifts' PB + 1d6 benefit only once, even if both a weapon attack and a Magic action qualify. Extra damage matches a damage type of the triggering attack or effect. For a roll shared by several targets, use the modified total for every target. Magic-action bonuses apply to rolls resolved as part of that action, not later damage from an ongoing effect. Cantrip Weaving is part of the Attack action. Both focuses can channel cantrips and spells without Material components. Their +2 bonuses apply while wielded; use the higher bonus if another item grants a bonus to the same roll or save DC. For a weapon attack made through a spell, use the Gift's +2 weapon bonus rather than also adding its +2 spell bonus. On a Critical Hit, double damage dice, including added dice, but not fixed bonuses."
  },
  {
    "id": "tbc-gift-of-the-standing-line",
    "name": "Gift of Winterwatch",
    "chassis": {
      "categories": [],
      "ability": "any",
      "requireTags": [],
      "formIds": [
        "base-glaive",
        "base-halberd",
        "base-lance",
        "base-pike",
        "base-quarterstaff",
        "base-spear",
        "base-trident"
      ],
      "anyOfTags": []
    },
    "description": "Bands of blue light encircle the grips of this long wooden weapon. Its shadow resembles a bare tree across a winter road.",
    "type": "weapon",
    "isUsable": true,
    "act": "Act 3",
    "sourceEncounter": "A3 Gate II: Open Clearing",
    "sourceEncounters": [
      "A3 Gate III: Veilscar Hollow"
    ],
    "grantsProficiency": true,
    "pbToDamage": true,
    "chassisBonus": 2,
    "attunementRequired": true,
    "mechanicsText": "You have a +2 bonus to attack and damage rolls made with this magic weapon. On a hit, add your Proficiency Bonus to the damage roll, and the weapon deals an extra 1d6 damage of its normal type. While attuned to the weapon, you are proficient with it. Winter's Grasp. Once on each of your turns, when you hit a creature with this weapon, you can reduce its Speed by 10 feet, to a minimum of 0, until the start of your next turn. Hold the Line. When you hit a creature with an Opportunity Attack using this weapon, you can reduce its Speed to 0 for the rest of that turn. Once you use this property, you can't use it again until you finish a Short or Long Rest.",
    "riders": [
      {
        "id": "rider-gift-of-the-last-gate",
        "label": "Winter's Grasp",
        "cadence": "perTurn",
        "condition": "Once on each of your turns, after a hit: the target's Speed drops by 10 feet (minimum 0) until the start of your next turn"
      }
    ],
    "chassisBonusDice": "1d6",
    "charges": {
      "max": 1,
      "reset": "shortRest"
    },
    "revisedAt": "2026-09-16T12:41:00.000Z",
    "dmNote": "The forest bestows one Feywild Gift on each character in Act 3. Weapon Gifts take a permanent mundane form from their listed category. Gift of First Light is a Quarterstaff used as a two-handed focus; Gift of Duskthorn is a weapon charm. Keep the weapon's normal dice, properties, and attack ability; Weapon Mastery requires a feature that grants it. A damage or healing roll receives the Gifts' PB + 1d6 benefit only once, even if both a weapon attack and a Magic action qualify. Extra damage matches a damage type of the triggering attack or effect. For a roll shared by several targets, use the modified total for every target. Magic-action bonuses apply to rolls resolved as part of that action, not later damage from an ongoing effect. Cantrip Weaving is part of the Attack action. Both focuses can channel cantrips and spells without Material components. Their +2 bonuses apply while wielded; use the higher bonus if another item grants a bonus to the same roll or save DC. For a weapon attack made through a spell, use the Gift's +2 weapon bonus rather than also adding its +2 spell bonus. On a Critical Hit, double damage dice, including added dice, but not fixed bonuses."
  },
  {
    "id": "tbc-gift-of-the-deep-root",
    "name": "Gift of Briarwink",
    "chassis": {
      "requireTags": [],
      "categories": [],
      "formIds": [
        "base-blowgun",
        "base-hand-crossbow",
        "base-sling",
        "base-dart",
        "base-dagger",
        "base-dagger-str",
        "base-handaxe",
        "base-light-hammer"
      ],
      "anyOfTags": [],
      "ability": "any"
    },
    "description": "Small amber buds stud this compact wooden weapon. They flash like watchful eyes when a foe draws near.",
    "isSpellFocus": false,
    "type": "weapon",
    "isUsable": true,
    "act": "Act 3",
    "sourceEncounter": "A3 Gate II: Open Clearing",
    "sourceEncounters": [
      "A3 Gate III: Veilscar Hollow"
    ],
    "grantsProficiency": true,
    "pbToDamage": true,
    "chassisBonus": 2,
    "attunementRequired": true,
    "mechanicsText": "You are proficient with this magic weapon while attuned to it. You have a +2 bonus to attack and damage rolls made with it. Each hit deals extra damage equal to 1d6 plus your Proficiency Bonus, of the weapon’s normal damage type. Close Quarters. An enemy within 5 feet of you doesn’t impose Disadvantage on your ranged attack rolls with this weapon. Briar’s Bite. Once on each of your turns, when you hit a creature within 15 feet with a ranged attack using this weapon, the attack deals an extra 1d6 damage of the weapon’s type. Returning. If this weapon has the Thrown property, it returns to an empty hand immediately after you make a ranged attack by throwing it. If neither hand is free, it falls in your space.",
    "riders": [
      {
        "id": "rider-briars-bite",
        "label": "Briar’s Bite",
        "cadence": "perTurn",
        "formula": "1d6",
        "condition": "Once on each of your turns: a ranged attack with this weapon hits a creature within 15 feet"
      }
    ],
    "chassisBonusDice": "1d6",
    "revisedAt": "2026-09-16T12:41:00.000Z",
    "dmNote": "The forest bestows one Feywild Gift on each character in Act 3. Weapon Gifts take a permanent mundane form from their listed category. Gift of First Light is a Quarterstaff used as a two-handed focus; Gift of Duskthorn is a weapon charm. Keep the weapon's normal dice, properties, and attack ability; Weapon Mastery requires a feature that grants it. A damage or healing roll receives the Gifts' PB + 1d6 benefit only once, even if both a weapon attack and a Magic action qualify. Extra damage matches a damage type of the triggering attack or effect. For a roll shared by several targets, use the modified total for every target. Magic-action bonuses apply to rolls resolved as part of that action, not later damage from an ongoing effect. Cantrip Weaving is part of the Attack action. Both focuses can channel cantrips and spells without Material components. Their +2 bonuses apply while wielded; use the higher bonus if another item grants a bonus to the same roll or save DC. For a weapon attack made through a spell, use the Gift's +2 weapon bonus rather than also adding its +2 spell bonus. On a Critical Hit, double damage dice, including added dice, but not fixed bonuses.",
    "spellFocusAttack": "+2",
    "spellFocusDamage": "+2",
    "spellFocusSaveDc": "+2",
    "spellFocusMagicActionDamage": "1d6+@PROF"
  },
  {
    "id": "tbc-gift-of-the-turning-season",
    "name": "Gift of Duskthorn",
    "description": "Winter-pale wood and silver root hold a blue-lit thorn surrounded by amber buds. Blue light follows the bearer’s strikes; warm light blooms as a spell takes shape.",
    "isSpellFocus": true,
    "spellFocusAttack": "+2",
    "spellFocusDamage": "+2",
    "spellFocusSaveDc": "+2",
    "type": "magic",
    "isUsable": true,
    "act": "Act 3",
    "sourceEncounter": "A3 Gate II: Open Clearing",
    "sourceEncounters": [
      "A3 Gate III: Veilscar Hollow"
    ],
    "grantsProficiency": true,
    "attunementRequired": true,
    "mechanicsText": "Bound Focus. The staff is a magic Quarterstaff. As a Magic action, you can bind the charm or wrap to one weapon, making it magical, or remove it. The weapon can’t be another Feywild Gift or hold another Duskthorn. Any attunement it requires is separate. The handwraps make your damaging Unarmed Strikes magical. Feywild Armament. You are proficient with the staff or bound weapon. You gain a +2 bonus to attack and damage rolls with it, or with your damaging Unarmed Strikes while wearing the handwraps. Each hit deals extra damage equal to 1d6 plus your Proficiency Bonus, of the attack’s normal damage type. Spellcasting Focus. You can use Duskthorn as a Spellcasting Focus for spells from any class while holding a focus form, wielding the staff or bound weapon, or wearing the holy symbol or handwraps. For spells cast through it, you gain a +2 bonus to spell attack rolls, spell damage and healing rolls, and your spell save DC. Cantrip Weaving. Once on each of your turns, when you take the Attack action and can make at least two attacks, you can replace one attack with a cantrip you know. The cantrip must have a casting time of an action and be cast through Duskthorn. You can cast only one cantrip as part of that Attack action. Thornwoven Cantrip. When a cantrip you cast through Duskthorn deals damage as part of its casting, you can add 1d6 to the damage dealt to one creature. This applies to only one instance of damage per casting. The extra damage is of a type dealt by that instance. You can’t add this die to a hit that already gains the extra 1d6 from Feywild Armament. First Light Bloom. Once on each of your turns, when you take a Magic action, roll 3d6 and add twice your Proficiency Bonus. Add the total to one instance of damage dealt or Hit Points restored to one creature as part of that action. Extra damage is of a type dealt by that instance. If the action deals no immediate damage and restores no Hit Points, you can instead grant that total as Temporary Hit Points to yourself or one willing creature you can see within 30 feet. These Temporary Hit Points last until the start of your next turn. First Light Bloom can accompany Thornwoven Cantrip. Cantrip Weaving uses the Attack action, so it doesn’t trigger First Light Bloom. None of these properties disables Feywild Armament. ACT 3 CONVERGENCE INPUTS Act 3 adds Tactical and Continuity to the Component Tags. The full six-player reward pool contains eight inputs: Tactical ×2, Continuity ×2, Offensive ×2, Cleanse ×1, and Defense ×1. All are usable standalone Wondrous Items and require no attunement. Crosspath Token Wondrous item · Convergence Input · A3 A pale vein divides this forked blackwood token. Immediately after Initiative is rolled, before the first turn begins, you can use one of the following properties. Once you use either property, you can’t use either again until you finish a Long Rest. Cross the Path. Choose a hostile creature you can see that is ahead of you in the Initiative order. Your turn moves to immediately after that creature’s turn. No other creature’s position changes. First Working. Choose yourself or one willing ally you can see within 30 feet. The chosen creature’s next level 1 or 2 spell cast before the end of the first round is cast at its lowest level without expending a spell slot. It must know or have prepared the spell. Tags: A3 · Tactical Rootbound Thread Wondrous item · Convergence Input · A3 Green-gold root fiber is braided around a dark inner strand. When you fail a Constitution saving throw to maintain Concentration, you can succeed instead. Once you use this property, you can’t use it again until you finish a Long Rest. Tags: A3 · Continuity Bloodbriar Seed Wondrous item · Convergence Input · A3 Two hooked veins cross this red-black seed. They glow in turn when nearby blows land. After you damage a hostile creature, you can mark it until the end of the current round. The next time an ally other than you hits the marked creature with a weapon or spell attack before then, the attack deals an extra 2d8 damage of one type it deals. The mark then ends. Once you use this property, you can’t use it again until you finish a Long Rest. Tags: A3 · Offensive Mirrorbark Scale Wondrous item · Convergence Input · A3 Reflections appear slightly early in the polished grain of this small bark scale. When a hostile creature hits you with an attack, before damage is rolled, you can take a Reaction to force it to reroll the attack. The attacker must use the new result. Once you use this property, you can’t use it again until you finish a Long Rest. Tags: A3 · Defense Branchcall Marker Wondrous item · Convergence Input · A3 Branching paths cover a thin disc of living wood. Two routes brighten when the disc is turned. When a creature you can see within 30 feet ends its turn, you can take a Reaction to let yourself and one willing ally you can see within 30 feet each move up to 10 feet without provoking Opportunity Attacks. Your ally doesn’t need to take a Reaction. Once you use this property, you can’t use it again until you finish a Long Rest. Tags: A3 · Tactical Held-Echo Knot Wondrous item · Convergence Input · A3 This knot of silver bark-fiber remains taut after it is released. When a hostile creature’s Reaction prevents a limited-use, non-spell class feature you used from affecting any target, you can regain one use or resource point spent on that feature. The knot can’t restore spellcasting resources. Once you use this property, you can’t use it again until you finish a Long Rest. Tags: A3 · Continuity Veilwash Leaf Wondrous item · Convergence Input · A3 Warm yellow and icy blue light flow in opposite directions through this translucent leaf. As a Magic action, you can touch a willing creature and end one instance of the Blinded, Deafened, Paralyzed, or Poisoned condition on it. The source of the condition remains and can impose it again. Once you use this property, you can’t use it again until you finish a Long Rest. Tags: A3 · Cleanse Thornwake Splinter Wondrous item · Convergence Input · A3 A point of amber-red light glows at the tip of this dark thorn. When you damage a creature with a weapon or spell attack, you can deal an extra 2d8 damage to that creature. Choose one of the damage types dealt by the attack for this extra damage. Once you use this property, you can’t use it again until you finish a Long Rest. Tags: A3 · Offensive ACT 4 ELEMENTAL WASTES · Ruined A4 drops & Catalysts This document covers Act 4 loot only through the final Level 11→12 drop immediately before the Unmarked Ranger. The Unmarked Ranger, Entity, and Unbound Presence are outside this loot cutoff. All party sizes receive the same eight Ruined A4 components in the same encounter order. Catalyst quantity scales by party size. Each A4 is a standalone Convergence input with one normal Component Tag; the Act 4 tables below list when each one enters party inventory. ACT 4 DROP DELIVERY Seq. Level Source Ruined A4 Catalyst 1 9 First required Act 4 fight Movement — Blinkstep — 2 9 Second required Act 4 fight Defense — Deferred Wound — 3 9→10 Phoenix Offensive — Rupture Catalyst · all party sizes 4 10 First required Level 10 fight Utility — Applied Insight — 5 10 Second required Level 10 fight Stability — True Ground — 6 10→11 Elemental level fight Cleanse — Condition Vessel Catalyst · all party sizes 7 11 Construct / Ward outpost entrance Tactical — Threat Positioning Catalyst · 5P+ — 11 Djinn chamber No A4 Catalyst · 4P+ · removing it triggers room 8 11 Required outpost/cavern fight Continuity — Preserved Reaction Catalyst · 6P 9 11→12 Final level fight before UR No A4 Catalyst · all party sizes Pacing rule reflected here: Level 9 has two required fights before the Phoenix level encounter; Level 10 has two required fights before the Elemental level encounter; Level 11 has at least the Construct and the required outpost/cavern fight before the final Level 11→12 encounter. The optional Djinn combat never counts toward that minimum.",
    "riders": [],
    "spellFocusMagicActionDamage": "3d6+@PROF+@PROF",
    "attachesToWeapon": true,
    "boundWeaponBonus": 2,
    "boundWeaponHitDamage": "1d6+@PROF",
    "weaponOrSpellChoice": true,
    "revisedAt": "2026-09-16T12:41:00.000Z",
    "dmNote": "The forest bestows one Feywild Gift on each character in Act 3. Weapon Gifts take a permanent mundane form from their listed category. Gift of First Light is a Quarterstaff used as a two-handed focus; Gift of Duskthorn is a weapon charm. Keep the weapon's normal dice, properties, and attack ability; Weapon Mastery requires a feature that grants it. A damage or healing roll receives the Gifts' PB + 1d6 benefit only once, even if both a weapon attack and a Magic action qualify. Extra damage matches a damage type of the triggering attack or effect. For a roll shared by several targets, use the modified total for every target. Magic-action bonuses apply to rolls resolved as part of that action, not later damage from an ongoing effect. Cantrip Weaving is part of the Attack action. Both focuses can channel cantrips and spells without Material components. Their +2 bonuses apply while wielded; use the higher bonus if another item grants a bonus to the same roll or save DC. For a weapon attack made through a spell, use the Gift's +2 weapon bonus rather than also adding its +2 spell bonus. On a Critical Hit, double damage dice, including added dice, but not fixed bonuses."
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
  },
  {
    "id": "bc-sentrys-knot",
    "name": "Sentry’s Knot",
    "type": "magic",
    "description": "A fist of grey cord knotted around something that will not sit still. It pulls toward whoever in the group is closest to falling. Tags: A1–A2 · Ward Field Reward · Guardian / Devout",
    "mechanicsText": "When a creature other than you that you can see within 30 feet would be reduced to 0 hit points, the knot tears itself apart. That creature is reduced to 1 hit point instead and gains temporary hit points equal to one roll of its Hit Die + your proficiency bonus.",
    "isUsable": true,
    "act": "Act 1",
    "sourceEncounter": "WARD FIELD REWARD POOL",
    "charges": {
      "max": 1,
      "reset": "manual"
    },
    "dmNote": "Bond-matched to Guardian / Devout. Single use — spent, broken or emptied when it fires. No attunement, not a Convergence input, no offensive benefit. A PC can receive only one Ward Field Reward in the whole campaign, across Acts 1-2 only.",
    "isLocked": true
  },
  {
    "id": "bc-sighters-wrap",
    "name": "Sighter’s Wrap",
    "type": "magic",
    "description": "A strip of oiled cloth wound for a hand that is not yours. It tightens a little when something across the field takes aim. Tags: A1–A2 · Ward Field Reward · Suppressing / Precise",
    "mechanicsText": "When a creature you can see within 30 feet scores a Critical Hit against you or an ally, tear the wrap free and force that creature to reroll the triggering attack roll. It must use the new roll.",
    "isUsable": true,
    "act": "Act 1",
    "sourceEncounter": "WARD FIELD REWARD POOL",
    "charges": {
      "max": 1,
      "reset": "manual"
    },
    "dmNote": "Bond-matched to Suppressing / Precise. Single use — spent, broken or emptied when it fires. No attunement, not a Convergence input, no offensive benefit. A PC can receive only one Ward Field Reward in the whole campaign, across Acts 1-2 only.",
    "isLocked": true
  },
  {
    "id": "bc-fieldwork-flask",
    "name": "Fieldwork Flask",
    "type": "magic",
    "description": "A field flask with a Ward seal still intact over the stopper. Whatever is inside is warm through the glass. Tags: A1–A2 · Ward Field Reward · Mending / Warden",
    "mechanicsText": "When a creature you can see within 30 feet is reduced to 0 hit points, empty the flask. That creature immediately regains hit points equal to two rolls of its Hit Die + its Constitution modifier (minimum 1) and remains conscious.",
    "isUsable": true,
    "act": "Act 1",
    "sourceEncounter": "WARD FIELD REWARD POOL",
    "charges": {
      "max": 1,
      "reset": "manual"
    },
    "dmNote": "Bond-matched to Mending / Warden. Single use — spent, broken or emptied when it fires. No attunement, not a Convergence input, no offensive benefit. A PC can receive only one Ward Field Reward in the whole campaign, across Acts 1-2 only.",
    "isLocked": true
  },
  {
    "id": "bc-hardedge-cord",
    "name": "Hardedge Cord",
    "type": "magic",
    "description": "A short cord strung between two iron tabs, wound far tighter than a hand could manage. It is meant to be snapped, once. Tags: A1–A2 · Ward Field Reward · Vanguard / Skirmish",
    "mechanicsText": "When you are hit by an attack, after its damage is rolled but before the damage is applied, snap the cord. Reduce the triggering attack’s damage by 2d8. Until that attack finishes resolving, it can't knock you Prone, move you against your will, or give you the Grappled condition.",
    "isUsable": true,
    "act": "Act 1",
    "sourceEncounter": "WARD FIELD REWARD POOL",
    "charges": {
      "max": 1,
      "reset": "manual"
    },
    "dmNote": "Bond-matched to Vanguard / Skirmish. Single use — spent, broken or emptied when it fires. No attunement, not a Convergence input, no offensive benefit. A PC can receive only one Ward Field Reward in the whole campaign, across Acts 1-2 only.",
    "isLocked": true
  },
  {
    "id": "bc-reading-stone",
    "name": "Reading Stone",
    "type": "magic",
    "description": "A thin disc of pale stone with a hairline fracture already through it. Held up, the fracture seems to be reading the room rather than the light. Tags: A1–A2 · Ward Field Reward · Tactician / Breaker",
    "mechanicsText": "When you or a creature you can see within 30 feet fails a saving throw, break the stone. The creature succeeds on that saving throw instead.",
    "isUsable": true,
    "act": "Act 1",
    "sourceEncounter": "WARD FIELD REWARD POOL",
    "charges": {
      "max": 1,
      "reset": "manual"
    },
    "dmNote": "Bond-matched to Tactician / Breaker. Single use — spent, broken or emptied when it fires. No attunement, not a Convergence input, no offensive benefit. A PC can receive only one Ward Field Reward in the whole campaign, across Acts 1-2 only.",
    "isLocked": true
  },
  {
    "id": "bc-pack-sign-token",
    "name": "Pack-Sign Token",
    "type": "magic",
    "description": "A flat token scored down the middle so it can be split by hand. Both halves carry the same mark. Tags: A1–A2 · Ward Field Reward · Pack / Covenant",
    "mechanicsText": "When you or an ally you can see within 30 feet is hit by an attack while another allied creature is within 5 feet of the target, split the token. The target gains a +5 bonus to AC against the triggering attack only, potentially causing it to miss.",
    "isUsable": true,
    "act": "Act 1",
    "sourceEncounter": "WARD FIELD REWARD POOL",
    "charges": {
      "max": 1,
      "reset": "manual"
    },
    "dmNote": "Bond-matched to Pack / Covenant. Single use — spent, broken or emptied when it fires. No attunement, not a Convergence input, no offensive benefit. A PC can receive only one Ward Field Reward in the whole campaign, across Acts 1-2 only.",
    "isLocked": true
  },
  {
    "id": "bc-unspent-mark",
    "name": "Unspent Mark",
    "type": "magic",
    "description": "A Ward sigil struck onto soft metal and never spent. It sits cold against anything magical that comes near it. Tags: A1–A2 · Ward Field Reward · Resonant / Siphon",
    "mechanicsText": "When you fail a saving throw against a spell or magical effect, expend the mark to succeed on that saving throw instead. If a successful save normally deals reduced damage, you take that normal successful-save damage; the Mark grants no additional resistance or reduction.",
    "isUsable": true,
    "act": "Act 1",
    "sourceEncounter": "WARD FIELD REWARD POOL",
    "charges": {
      "max": 1,
      "reset": "manual"
    },
    "dmNote": "Bond-matched to Resonant / Siphon. Single use — spent, broken or emptied when it fires. No attunement, not a Convergence input, no offensive benefit. A PC can receive only one Ward Field Reward in the whole campaign, across Acts 1-2 only.",
    "isLocked": true
  },
  {
    "id": "bc-potion-of-healing",
    "name": "Potion of Healing",
    "type": "consumable",
    "activation": "action",
    "description": "A stoppered vial of red liquid, kept among the tavern's emergency supplies.",
    "mechanicsText": "A creature that drinks this potion regains 2d4 + 2 Hit Points. Use your campaign's normal rules for drinking or administering a potion.",
    "isUsable": true,
    "value": "50gp",
    "act": "Act 2",
    "sourceEncounter": "END-OF-ACT 2 TAVERN MERCHANT",
    "charges": {
      "max": 1,
      "reset": "manual"
    },
    "dmNote": "Final purchasing window before Act 3, which has no merchant. Merchant stock: 2.",
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "bc-smoke-flask",
    "name": "Smoke Flask",
    "type": "consumable",
    "activation": "action",
    "description": "Grey cloth wraps the stopper of this squat dark flask. The liquid inside swirls continuously.",
    "mechanicsText": "As a Magic Action, you can throw this flask at a point you can see within 30 feet. The flask shatters, filling a 10-foot-radius Sphere centered on that point with smoke. The area is Heavily Obscured until the end of your next turn. A strong wind disperses the smoke early. The flask is consumed on use.",
    "isUsable": true,
    "value": "100gp",
    "act": "Act 2",
    "sourceEncounter": "END-OF-ACT 2 TAVERN MERCHANT",
    "charges": {
      "max": 1,
      "reset": "manual"
    },
    "dmNote": "Final purchasing window before Act 3, which has no merchant. Merchant stock: 1.",
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "bc-wardbreaker-oil",
    "name": "Wardbreaker Oil",
    "type": "consumable",
    "activation": "bonus",
    "description": "This metallic oil is sealed in a narrow Ward vial. When poured, it gathers along the nearest edge or point.",
    "mechanicsText": "As a Bonus Action, you can coat one weapon or one piece of ammunition with this oil. The coating lasts until it is used or washed away. The first creature damaged by the coated weapon or ammunition takes an extra 2d6 Force damage. If the creature is Large or smaller, it is also pushed 5 feet directly away from the attacker. The coating then loses its magic.",
    "isUsable": true,
    "value": "150gp",
    "act": "Act 2",
    "sourceEncounter": "END-OF-ACT 2 TAVERN MERCHANT",
    "charges": {
      "max": 1,
      "reset": "manual"
    },
    "dmNote": "Final purchasing window before Act 3, which has no merchant. Merchant stock: 1.",
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "bc-a4-blinkstep",
    "name": "Blinkstep",
    "type": "magic",
    "activation": "bonus",
    "description": "Fine fractures cross these blackened ankle clasps. As the wearer shifts their weight, the clasps leave brief afterimages. Tags: A4 · Movement · Ruined / elemental saturation",
    "mechanicsText": "As a Bonus Action, you can teleport up to 20 feet to an unoccupied space you can see. Once you use this property, you can't use it again until you finish a Short or Long Rest.",
    "isUsable": false,
    "act": "Act 4",
    "sourceEncounter": "ACT 4 RUINED A4 REWARD TABLE",
    "charges": {
      "max": 1,
      "reset": "shortRest"
    },
    "convergence": {
      "role": "input",
      "enabled": true,
      "mechanicalTag": "Movement",
      "actLabel": "A4"
    },
    "dmNote": "Drops at: Act 4 sequence 1 — first required Level 9 fight. Standalone Convergence input with one normal Component Tag. May be used in a legal ordinary recipe OR tempered with a Catalyst into its same-tag Tier 4 Singular. Two A4 inputs do not form an ordinary Convergence output.",
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "bc-a4-deferred-wound",
    "name": "Deferred Wound",
    "type": "magic",
    "activation": "reaction",
    "description": "Dark seams divide the worn metal plates of this forearm guard. On impact, the seams hold a faint outline of the blow. Tags: A4 · Defense · Ruined / elemental saturation",
    "mechanicsText": "When you take damage, you can take a Reaction to roll 2d8 and reduce the damage by up to the number rolled. Record the amount prevented as deferred damage. Until the end of the current round, healing you receive reduces this deferred damage before restoring Hit Points. At the end of the round, you lose Hit Points equal to any deferred damage remaining. The original attack or effect still counts as having hit and dealt damage. Losing the deferred Hit Points doesn't trigger effects that occur when you are hit or take damage. Once you use this property, you can't use it again until you finish a Long Rest.",
    "isUsable": false,
    "act": "Act 4",
    "sourceEncounter": "ACT 4 RUINED A4 REWARD TABLE",
    "charges": {
      "max": 1,
      "reset": "longRest"
    },
    "convergence": {
      "role": "input",
      "enabled": true,
      "mechanicalTag": "Defense",
      "actLabel": "A4"
    },
    "dmNote": "Drops at: Act 4 sequence 2 — second required Level 9 fight. Standalone Convergence input with one normal Component Tag. May be used in a legal ordinary recipe OR tempered with a Catalyst into its same-tag Tier 4 Singular. Two A4 inputs do not form an ordinary Convergence output.",
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "bc-a4-rupture",
    "name": "Rupture",
    "type": "magic",
    "activation": "free",
    "description": "Ember-bright cracks split this narrow iron wrist ring. They flare when a blow lands. Tags: A4 · Offensive · Ruined / elemental saturation",
    "mechanicsText": "When you hit with an attack, you can deal an extra 2d10 damage of one type dealt by that attack. Once you use this property, you can't use it again until you finish a Long Rest.",
    "isUsable": false,
    "act": "Act 4",
    "sourceEncounter": "ACT 4 RUINED A4 REWARD TABLE",
    "charges": {
      "max": 1,
      "reset": "longRest"
    },
    "convergence": {
      "role": "input",
      "enabled": true,
      "mechanicalTag": "Offensive",
      "actLabel": "A4"
    },
    "dmNote": "Drops at: Act 4 sequence 3 — Phoenix. Standalone Convergence input with one normal Component Tag. May be used in a legal ordinary recipe OR tempered with a Catalyst into its same-tag Tier 4 Singular. Two A4 inputs do not form an ordinary Convergence output.",
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "bc-a4-applied-insight",
    "name": "Applied Insight",
    "type": "magic",
    "activation": "reaction",
    "description": "A scorched brass frame holds this many-faceted lens. One facet remains clear despite the mineral haze on the others. Tags: A4 · Utility · Ruined / elemental saturation",
    "mechanicsText": "When you or an ally within 30 feet fails an ability check, you can take a Reaction to add 1d10 to the result, possibly turning the failure into a success. Once you use this property, you can't use it again until you finish a Long Rest.",
    "isUsable": false,
    "act": "Act 4",
    "sourceEncounter": "ACT 4 RUINED A4 REWARD TABLE",
    "charges": {
      "max": 1,
      "reset": "longRest"
    },
    "convergence": {
      "role": "input",
      "enabled": true,
      "mechanicalTag": "Utility",
      "actLabel": "A4"
    },
    "dmNote": "Drops at: Act 4 sequence 4 — first required Level 10 fight. Standalone Convergence input with one normal Component Tag. May be used in a legal ordinary recipe OR tempered with a Catalyst into its same-tag Tier 4 Singular. Two A4 inputs do not form an ordinary Convergence output.",
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "bc-a4-true-ground",
    "name": "True Ground",
    "type": "magic",
    "activation": "bonus",
    "description": "An old metal brace surrounds this heavy black-stone ankle band. Loose grit gathers around its worn, flat base. Tags: A4 · Stability · Ruined / elemental saturation",
    "mechanicsText": "As a Bonus Action, you can anchor your current space until the end of the current round. If a hostile effect moves you against your will during that time, you teleport back to the anchor immediately after that movement resolves. If the anchor is occupied or otherwise unavailable, you appear in the nearest space you can occupy. Once you use this property, you can't use it again until you finish a Short or Long Rest.",
    "isUsable": false,
    "act": "Act 4",
    "sourceEncounter": "ACT 4 RUINED A4 REWARD TABLE",
    "charges": {
      "max": 1,
      "reset": "shortRest"
    },
    "convergence": {
      "role": "input",
      "enabled": true,
      "mechanicalTag": "Stability",
      "actLabel": "A4"
    },
    "dmNote": "Drops at: Act 4 sequence 5 — second required Level 10 fight. Standalone Convergence input with one normal Component Tag. May be used in a legal ordinary recipe OR tempered with a Catalyst into its same-tag Tier 4 Singular. Two A4 inputs do not form an ordinary Convergence output.",
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "bc-a4-condition-vessel",
    "name": "Condition Vessel",
    "type": "magic",
    "activation": "action",
    "description": "A tarnished silver cage holds a small hollow crystal. Colored stains drift inside without mixing. Tags: A4 · Cleanse · Ruined / elemental saturation",
    "mechanicsText": "As a Magic Action, choose one willing creature within 30 feet. End one of the following conditions on it: Blinded, Charmed, Deafened, Frightened, Paralyzed, Poisoned, or Restrained. You gain the chosen condition until the end of the current round. You can't choose a condition to which you are immune. Once you use this property, you can't use it again until you finish a Long Rest.",
    "isUsable": false,
    "act": "Act 4",
    "sourceEncounter": "ACT 4 RUINED A4 REWARD TABLE",
    "charges": {
      "max": 1,
      "reset": "longRest"
    },
    "convergence": {
      "role": "input",
      "enabled": true,
      "mechanicalTag": "Cleanse",
      "actLabel": "A4"
    },
    "dmNote": "Drops at: Act 4 sequence 6 — Elemental level fight. Standalone Convergence input with one normal Component Tag. May be used in a legal ordinary recipe OR tempered with a Catalyst into its same-tag Tier 4 Singular. Two A4 inputs do not form an ordinary Convergence output.",
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "bc-a4-threat-positioning",
    "name": "Threat Positioning",
    "type": "magic",
    "activation": "free",
    "description": "Three broken pointers lie beneath the glass of this dark compass. They turn toward nearby threats instead of north. Tags: A4 · Tactical · Ruined / elemental saturation",
    "mechanicsText": "Immediately after Initiative is rolled, before the first turn begins, you can choose one hostile creature you can see. Your turn moves to immediately after that creature's turn. The hostile creature's position in the Initiative order doesn't change. Once you use this property, you can't use it again until you finish a Long Rest.",
    "isUsable": false,
    "act": "Act 4",
    "sourceEncounter": "ACT 4 RUINED A4 REWARD TABLE",
    "charges": {
      "max": 1,
      "reset": "longRest"
    },
    "convergence": {
      "role": "input",
      "enabled": true,
      "mechanicalTag": "Tactical",
      "actLabel": "A4"
    },
    "dmNote": "Drops at: Act 4 sequence 7 — Construct / Ward outpost entrance. Standalone Convergence input with one normal Component Tag. May be used in a legal ordinary recipe OR tempered with a Catalyst into its same-tag Tier 4 Singular. Two A4 inputs do not form an ordinary Convergence output.",
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "bc-a4-preserved-reaction",
    "name": "Preserved Reaction",
    "type": "magic",
    "activation": "reaction",
    "description": "A slack strand hangs from this braid of silver wire and black root-fiber. It snaps taut when the wearer makes a sudden movement. Tags: A4 · Continuity · Ruined / elemental saturation",
    "mechanicsText": "When you would take a non-spell Reaction, you can use this property in place of expending your Reaction. You must have your normal Reaction available, and you pay all other costs. You can use this property for an Opportunity Attack; a non-spell Reaction granted by a class, subclass, feat, or item; or the release of a Readied non-spell action or movement. You can't use it for a Reaction spell, a Readied spell, or a Bond reaction. Once you use this property, you can't use it again until you finish a Long Rest.",
    "isUsable": false,
    "act": "Act 4",
    "sourceEncounter": "ACT 4 RUINED A4 REWARD TABLE",
    "charges": {
      "max": 1,
      "reset": "longRest"
    },
    "convergence": {
      "role": "input",
      "enabled": true,
      "mechanicalTag": "Continuity",
      "actLabel": "A4"
    },
    "dmNote": "Drops at: Act 4 sequence 8 — required outpost/cavern fight. Standalone Convergence input with one normal Component Tag. May be used in a legal ordinary recipe OR tempered with a Catalyst into its same-tag Tier 4 Singular. Two A4 inputs do not form an ordinary Convergence output.",
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "bc-catalyst",
    "name": "Catalyst",
    "type": "magic",
    "description": "Concentrated Convergence energy gathers in this dense shard. Light spreads through a compatible item when the two are joined. Tags: Catalyst · Tempering / stabilization · Not a Component Tag",
    "mechanicsText": "You can use a Catalyst to temper one raw Ruined A4 item. The Catalyst is consumed, and that item becomes the Tier 4 Singular with the same tag. A creature can bind only one Tier 4 Singular. A Catalyst isn't a normal Convergence component. It can't create a different tag, temper an A1–A3 component, or use a completed T3 item as its input.",
    "isUsable": false,
    "act": "Act 4",
    "sourceEncounter": "ACT 4 CATALYST REWARD TABLE",
    "charges": {
      "max": 1,
      "reset": "manual"
    },
    "dmNote": "Special Convergence Item — NO normal Component Tag, so it carries no `mechanicalTag` and can never be a recipe half. Consumed on use. Catalyst quantity scales by party size; the Act 4 tables are the source of truth for when each enters inventory.",
    "isLocked": true,
    "attunementRequired": false,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "bc-t4-blinkstep",
    "name": "Blinkstep — Tempered",
    "type": "magic",
    "activation": "free",
    "description": "Light fills the old fractures in these blackened clasps. Translucent afterimages follow each step. Tags: T4 Singular · same mechanical tag as its Ruined A4 · Catalyst-tempered",
    "mechanicsText": "Your Speed increases by 10 feet. Blinkstep. Once per encounter, you can teleport up to 30 feet to an unoccupied space you can see.",
    "isUsable": false,
    "tier": "4",
    "act": "Act 4",
    "sourceEncounter": "CONVERGENCE TIER 4 — TEMPERED SINGULARS",
    "attunementRequired": true,
    "charges": {
      "max": 1,
      "reset": "encounter"
    },
    "convergence": {
      "role": "output",
      "enabled": true,
      "mechanicalTag": "Movement",
      "tier": "T4"
    },
    "dmNote": "The same A4 item after Catalyst tempering, NOT a new A+B fusion — so its tag stays Movement rather than becoming a pair. Requires attunement, and a creature can bind only ONE Tier 4 Singular.",
    "isLocked": true,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "bc-t4-applied-insight",
    "name": "Applied Insight — Tempered",
    "type": "magic",
    "activation": "reaction",
    "description": "Two narrow brass rings turn around the original scorched lens. Light clears each facet as it rotates into view. Tags: T4 Singular · same mechanical tag as its Ruined A4 · Catalyst-tempered",
    "mechanicsText": "Applied Insight. When you or an ally within 30 feet fails an ability check, you can take a Reaction to add 1d12 to the result, possibly turning the failure into a success. Once you use this property, you can't use it again until you finish a Short or Long Rest. Borrowed Practice. When you finish a Long Rest, choose one skill or tool. You gain proficiency in that skill or with that tool until you finish your next Long Rest.",
    "isUsable": false,
    "tier": "4",
    "act": "Act 4",
    "sourceEncounter": "CONVERGENCE TIER 4 — TEMPERED SINGULARS",
    "attunementRequired": true,
    "charges": {
      "max": 1,
      "reset": "shortRest"
    },
    "convergence": {
      "role": "output",
      "enabled": true,
      "mechanicalTag": "Utility",
      "tier": "T4"
    },
    "dmNote": "The same A4 item after Catalyst tempering, NOT a new A+B fusion — so its tag stays Utility rather than becoming a pair. Requires attunement, and a creature can bind only ONE Tier 4 Singular.",
    "isLocked": true,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "bc-t4-deferred-wound",
    "name": "Deferred Wound — Tempered",
    "type": "magic",
    "activation": "reaction",
    "description": "Luminous threads bridge the dark seams of this worn guard. The threads brighten as the guard absorbs a blow. Tags: T4 Singular · same mechanical tag as its Ruined A4 · Catalyst-tempered",
    "mechanicsText": "Deferred Wound. When you take damage, you can take a Reaction to roll 2d10 and reduce the damage by up to the number rolled. Record the amount prevented as deferred damage. Until the end of the current round, healing you receive reduces this deferred damage before restoring Hit Points. At the end of the round, you lose Hit Points equal to any deferred damage remaining. The original attack or effect still counts as having hit and dealt damage. Losing the deferred Hit Points doesn't trigger effects that occur when you are hit or take damage. Once you use this property, you can't use it again until you finish a Short or Long Rest. Unbroken Guard. If all deferred damage is cleared before it resolves at the end of the round, you gain Temporary Hit Points equal to your Proficiency Bonus.",
    "isUsable": false,
    "tier": "4",
    "act": "Act 4",
    "sourceEncounter": "CONVERGENCE TIER 4 — TEMPERED SINGULARS",
    "attunementRequired": true,
    "charges": {
      "max": 1,
      "reset": "shortRest"
    },
    "convergence": {
      "role": "output",
      "enabled": true,
      "mechanicalTag": "Defense",
      "tier": "T4"
    },
    "dmNote": "The same A4 item after Catalyst tempering, NOT a new A+B fusion — so its tag stays Defense rather than becoming a pair. Requires attunement, and a creature can bind only ONE Tier 4 Singular.",
    "isLocked": true,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "bc-t4-true-ground",
    "name": "True Ground — Tempered",
    "type": "magic",
    "activation": "free",
    "description": "Concentric lines of light cross this black-stone band. A matching pattern appears on the ground beneath its wearer. Tags: T4 Singular · same mechanical tag as its Ruined A4 · Catalyst-tempered",
    "mechanicsText": "True Ground. Once per encounter, you can anchor your current space until the start of your next turn. After a hostile effect moves or teleports you against your will, you return to the anchor, or to the nearest space you can occupy if the anchor is unavailable. Firm Footing. Once per round, you can reduce forced movement applied to you by 10 feet.",
    "isUsable": false,
    "tier": "4",
    "act": "Act 4",
    "sourceEncounter": "CONVERGENCE TIER 4 — TEMPERED SINGULARS",
    "attunementRequired": true,
    "charges": {
      "max": 1,
      "reset": "encounter"
    },
    "convergence": {
      "role": "output",
      "enabled": true,
      "mechanicalTag": "Stability",
      "tier": "T4"
    },
    "dmNote": "The same A4 item after Catalyst tempering, NOT a new A+B fusion — so its tag stays Stability rather than becoming a pair. Requires attunement, and a creature can bind only ONE Tier 4 Singular.",
    "isLocked": true,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "bc-t4-condition-vessel",
    "name": "Condition Vessel — Tempered",
    "type": "magic",
    "activation": "action",
    "description": "Light runs through the bars of this silver cage and into the clear crystal within. Traces of color remain along the crystal's edge. Tags: T4 Singular · same mechanical tag as its Ruined A4 · Catalyst-tempered",
    "mechanicsText": "You have Advantage on saving throws against the Charmed, Frightened, and Poisoned conditions. Condition Vessel. As a Magic Action, you can end one of the following conditions on a willing creature within 30 feet: Blinded, Charmed, Deafened, Frightened, Paralyzed, Poisoned, or Restrained. The condition ends without transferring to you. Once you use this property, you can't use it again until you finish a Short or Long Rest.",
    "isUsable": false,
    "tier": "4",
    "act": "Act 4",
    "sourceEncounter": "CONVERGENCE TIER 4 — TEMPERED SINGULARS",
    "attunementRequired": true,
    "charges": {
      "max": 1,
      "reset": "shortRest"
    },
    "convergence": {
      "role": "output",
      "enabled": true,
      "mechanicalTag": "Cleanse",
      "tier": "T4"
    },
    "dmNote": "The same A4 item after Catalyst tempering, NOT a new A+B fusion — so its tag stays Cleanse rather than becoming a pair. Requires attunement, and a creature can bind only ONE Tier 4 Singular.",
    "isLocked": true,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "bc-t4-rupture",
    "name": "Rupture — Tempered",
    "type": "magic",
    "activation": "free",
    "description": "Thin iron segments hover beside this cracked ring, held in place by white-gold light. Tags: T4 Singular · same mechanical tag as its Ruined A4 · Catalyst-tempered",
    "mechanicsText": "Rupture. When you hit with an attack, you can deal an extra 2d12 damage of one type dealt by the attack. The target can't regain Hit Points until the start of your next turn. Once you use this property, you can't use it again until you finish a Short or Long Rest. Keen Fracture. Once on each of your turns, you can treat one damage die showing a 1 as a 2.",
    "isUsable": false,
    "tier": "4",
    "act": "Act 4",
    "sourceEncounter": "CONVERGENCE TIER 4 — TEMPERED SINGULARS",
    "attunementRequired": true,
    "charges": {
      "max": 1,
      "reset": "shortRest"
    },
    "convergence": {
      "role": "output",
      "enabled": true,
      "mechanicalTag": "Offensive",
      "tier": "T4"
    },
    "dmNote": "The same A4 item after Catalyst tempering, NOT a new A+B fusion — so its tag stays Offensive rather than becoming a pair. Requires attunement, and a creature can bind only ONE Tier 4 Singular.",
    "isLocked": true,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "bc-t4-threat-positioning",
    "name": "Threat Positioning — Tempered",
    "type": "magic",
    "activation": "free",
    "description": "A luminous ring turns above the broken pointers of this scratched compass-disc. Tags: T4 Singular · same mechanical tag as its Ruined A4 · Catalyst-tempered",
    "mechanicsText": "Threat Positioning. Immediately after Initiative is rolled, before the first turn begins, you can exchange your position in the Initiative order with one hostile creature you can see. This property can't move Initiative during a round or cause a creature to gain or lose a turn. Once you use this property, you can't use it again until you finish a Short or Long Rest. Watchful Step. When a hostile creature immediately before you in the Initiative order finishes its turn, you gain a +2 bonus to your next saving throw made before the end of your next turn.",
    "isUsable": false,
    "tier": "4",
    "act": "Act 4",
    "sourceEncounter": "CONVERGENCE TIER 4 — TEMPERED SINGULARS",
    "attunementRequired": true,
    "charges": {
      "max": 1,
      "reset": "shortRest"
    },
    "convergence": {
      "role": "output",
      "enabled": true,
      "mechanicalTag": "Tactical",
      "tier": "T4"
    },
    "dmNote": "The same A4 item after Catalyst tempering, NOT a new A+B fusion — so its tag stays Tactical rather than becoming a pair. Requires attunement, and a creature can bind only ONE Tier 4 Singular.",
    "isLocked": true,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "bc-t4-preserved-reaction",
    "name": "Preserved Reaction — Tempered",
    "type": "magic",
    "activation": "reaction",
    "description": "A bright filament follows the old twists of this silver-and-root braid, forming a second loop beside its once-slack strand. Tags: T4 Singular · same mechanical tag as its Ruined A4 · Catalyst-tempered",
    "mechanicsText": "Preserved Reaction. When you would take a non-spell Reaction, you can use this property in place of expending your Reaction. You must have your normal Reaction available, and you pay all other costs. You can use this property for an Opportunity Attack; a non-spell Reaction granted by a class, subclass, feat, or item; or the release of a Readied non-spell action or movement. You can't use it for a Reaction spell, a Readied spell, or a Bond reaction. If a hostile creature caused the trigger for your response, its next attempted Reaction before the start of its next turn is prevented. This interference ends after preventing one Reaction. Once you use this property, you can't use it again until you finish a Short or Long Rest. Held Intent. When you Ready a non-spell action or movement and its trigger hasn't occurred by the start of your next turn, it remains Readied until the end of that turn. You can preserve only one Readied action or movement in this way.",
    "isUsable": false,
    "tier": "4",
    "act": "Act 4",
    "sourceEncounter": "CONVERGENCE TIER 4 — TEMPERED SINGULARS",
    "attunementRequired": true,
    "charges": {
      "max": 1,
      "reset": "shortRest"
    },
    "convergence": {
      "role": "output",
      "enabled": true,
      "mechanicalTag": "Continuity",
      "tier": "T4"
    },
    "dmNote": "The same A4 item after Catalyst tempering, NOT a new A+B fusion — so its tag stays Continuity rather than becoming a pair. Requires attunement, and a creature can bind only ONE Tier 4 Singular.",
    "isLocked": true,
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "item-mtw83xt1",
    "name": "Mind Sharpener",
    "type": "gear",
    "description": "",
    "isUsable": false,
    "mechanicsText": "The item has 4 charges. When you fail a Constitution saving throw to maintain Concentration, you can take a Reaction and expend 1 of the item's charges to succeed instead. The item regains 1d4 expended charges daily at dawn.",
    "slot": "ring",
    "charges": {
      "max": 4,
      "reset": "manual",
      "note": "1d4 at dawn"
    },
    "activation": "reaction"
  },
  {
    "id": "bc-t3-briarfall-spur",
    "name": "Briarfall Spur",
    "description": "A hooked black thorn curves from this pale iron heel spur. Tags: Recipe: Movement + Offensive · Completed: Offensive",
    "mechanicsText": "When you hit a creature with an attack after moving at least 15 feet toward it during your turn, you can deal an extra 2d6 damage of one type dealt by the attack. Once you use this property, you can't use it again until you finish a Short or Long Rest.",
    "attunementRequired": false,
    "convergence": {
      "role": "output",
      "enabled": true,
      "mechanicalTag": "Movement + Offensive",
      "tier": "T3"
    },
    "tier": "3",
    "type": "magic",
    "isUsable": false,
    "act": "Act 3",
    "isLocked": true,
    "charges": {
      "max": 1,
      "reset": "shortRest"
    },
    "activation": "free",
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "bc-t3-waybranch-pennant",
    "name": "Waybranch Pennant",
    "description": "Two bright veins cross a strip of living bark suspended from a forked silver pin. Tags: Recipe: Movement + Tactical · Completed: Tactical",
    "mechanicsText": "After moving at least 15 feet on your turn, you can take a Bonus Action to choose one ally and one hostile creature, both of which you can see within 30 feet. Before the end of the current round, the ally can gain Advantage on one attack roll against that hostile creature, or subtract 1d4 from one saving throw the creature makes against the ally's spell or feature. The ally chooses before the roll, and the benefit then ends. Once you use this property, you can't use it again until you finish a Short or Long Rest.",
    "attunementRequired": false,
    "convergence": {
      "role": "output",
      "enabled": true,
      "mechanicalTag": "Movement + Tactical",
      "tier": "T3"
    },
    "tier": "3",
    "type": "magic",
    "isUsable": false,
    "act": "Act 3",
    "isLocked": true,
    "charges": {
      "max": 1,
      "reset": "shortRest"
    },
    "activation": "bonus",
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "bc-t3-veilscript-folio",
    "name": "Veilscript Folio",
    "description": "New script gathers on the translucent leaves of this folio whenever it is opened. Tags: Recipe: Utility + Cleanse · Completed: Utility",
    "mechanicsText": "As a Magic Action, you can use one of the following properties. The chosen benefit lasts until you finish a Short or Long Rest or give the folio to another bearer. Once you use either property, you can't use either again until you finish a Short or Long Rest. Rewrite. Replace one 1st- or 2nd-level spell you know or have prepared through a class with a different spell of the same level from that class's spell list. You must qualify to learn or prepare the new spell. If the class uses a spellbook, the new spell must be in your spellbook. The original spell returns when this property ends. Field Manual. You gain proficiency in one skill or with one tool of your choice.",
    "attunementRequired": false,
    "convergence": {
      "role": "output",
      "enabled": true,
      "mechanicalTag": "Utility + Cleanse",
      "tier": "T3"
    },
    "tier": "3",
    "type": "magic",
    "isUsable": false,
    "act": "Act 3",
    "isLocked": true,
    "charges": {
      "max": 1,
      "reset": "shortRest"
    },
    "activation": "action",
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "bc-t3-dawnwash-clasp",
    "name": "Dawnwash Clasp",
    "description": "A pale leaf folds over this shield-shaped clasp. Silver veins run through both. Tags: Recipe: Defense + Cleanse · Completed: Cleanse",
    "mechanicsText": "When you or an ally you can see within 30 feet fails a saving throw against the Blinded, Charmed, Deafened, Frightened, Paralyzed, Poisoned, or Restrained condition, you can take a Reaction to add 1d8 to the saving throw, possibly turning the failure into a success. Once you use this property, you can't use it again until you finish a Short or Long Rest.",
    "attunementRequired": false,
    "convergence": {
      "role": "output",
      "enabled": true,
      "mechanicalTag": "Defense + Cleanse",
      "tier": "T3"
    },
    "tier": "3",
    "type": "magic",
    "isUsable": false,
    "act": "Act 3",
    "isLocked": true,
    "charges": {
      "max": 1,
      "reset": "shortRest"
    },
    "activation": "reaction",
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "bc-t3-rimeglass-fang",
    "name": "Rimeglass Fang",
    "description": "Fine fractures gleam inside a clear fang set in a dark iron grip. Tags: Recipe: Cleanse + Offensive · Completed: Offensive",
    "mechanicsText": "When you hit a creature with an attack, or a creature fails a saving throw against a damaging spell you cast, you can deal an extra 1d8 Force damage to that creature. The extra damage is 2d8 if the creature has Resistance or Immunity to a damage type of the attack or spell, even if Immunity prevents the original damage. Once you use this property, you can't use it again until you finish a Short or Long Rest.",
    "attunementRequired": false,
    "convergence": {
      "role": "output",
      "enabled": true,
      "mechanicalTag": "Cleanse + Offensive",
      "tier": "T3"
    },
    "tier": "3",
    "type": "magic",
    "isUsable": false,
    "act": "Act 3",
    "isLocked": true,
    "charges": {
      "max": 1,
      "reset": "shortRest"
    },
    "activation": "free",
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "bc-t3-moongate-lantern",
    "name": "Moongate Lantern",
    "description": "Moon-pale ribs open around a hollow flame inside this small lantern. Tags: Recipe: Cleanse + Tactical · Completed: Tactical",
    "mechanicsText": "As a Magic Action, you can use one of the following properties. Once you use either property, you can't use either again until you finish a Short or Long Rest. Open Path. Choose a point within 60 feet. Until the end of the current round, you and your allies ignore magical visual obscurement within 15 feet of that point, and your movement within that area doesn't provoke Opportunity Attacks. Prepared Working. Choose one willing ally you can see within 30 feet. The next 1st- or 2nd-level spell the ally casts before the end of the current round is cast at its lowest level without expending a spell slot. The ally must know or have prepared the spell.",
    "attunementRequired": false,
    "convergence": {
      "role": "output",
      "enabled": true,
      "mechanicalTag": "Cleanse + Tactical",
      "tier": "T3"
    },
    "tier": "3",
    "type": "magic",
    "isUsable": false,
    "act": "Act 3",
    "isLocked": true,
    "charges": {
      "max": 1,
      "reset": "shortRest"
    },
    "activation": "action",
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "bc-t3-redwake-shuttle",
    "name": "Redwake Shuttle",
    "description": "A silver weaving shuttle carries a red thorn and a single bright thread. Tags: Recipe: Offensive + Tactical · Completed: Tactical",
    "mechanicsText": "After you resolve an attack that hits a hostile creature, or a hostile creature's failed saving throw against a damaging spell you cast, you can prevent that creature from taking Reactions until the start of your next turn. One willing ally you can see within 30 feet can immediately take a Reaction to move up to 10 feet without provoking Opportunity Attacks. Once you use this property, you can't use it again until you finish a Short or Long Rest.",
    "attunementRequired": false,
    "convergence": {
      "role": "output",
      "enabled": true,
      "mechanicalTag": "Offensive + Tactical",
      "tier": "T3"
    },
    "tier": "3",
    "type": "magic",
    "isUsable": false,
    "act": "Act 3",
    "isLocked": true,
    "charges": {
      "max": 1,
      "reset": "shortRest"
    },
    "activation": "free",
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "bc-t3-unfinished-thorn",
    "name": "Unfinished Thorn",
    "description": "A broken thorn floats inside an open iron ring. Its missing tip appears briefly after a missed strike. Tags: Recipe: Offensive + Continuity · Completed: Offensive",
    "mechanicsText": "When you miss a creature with a weapon or spell attack, you can reroll the attack roll. You must use the new result. Once you use this property, you can't use it again until you finish a Short or Long Rest.",
    "attunementRequired": false,
    "convergence": {
      "role": "output",
      "enabled": true,
      "mechanicalTag": "Offensive + Continuity",
      "tier": "T3"
    },
    "tier": "3",
    "type": "magic",
    "isUsable": false,
    "act": "Act 3",
    "isLocked": true,
    "charges": {
      "max": 1,
      "reset": "shortRest"
    },
    "activation": "free",
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "bc-t3-greywake-sandals",
    "name": "Greywake Sandals",
    "description": "Grey Ward cloth binds these narrow sandals. Their footprints linger for a moment after the wearer moves. Tags: Recipe: Movement + Defense · Completed: Movement",
    "mechanicsText": "Once per round, immediately after a hostile creature's attack against you resolves, you can move up to 5 feet without provoking Opportunity Attacks.",
    "attunementRequired": true,
    "convergence": {
      "role": "output",
      "enabled": true,
      "mechanicalTag": "Movement + Defense",
      "tier": "T3"
    },
    "tier": "3",
    "type": "magic",
    "isUsable": false,
    "act": "Act 3",
    "isLocked": true,
    "activation": "free",
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "bc-t3-mercyglass-reliquary",
    "name": "Mercyglass Reliquary",
    "description": "A fold of unburned Ward cloth rests inside this softly glowing glass reliquary. Tags: Recipe: Utility + Defense · Completed: Utility",
    "mechanicsText": "Steady Hands. As a Magic Action, you can touch a dying creature and stabilize it without a check or supplies. The reliquary also has the following properties. Once you use either of them, you can't use either again until you finish a Short or Long Rest. Protected Working. When you cast a 1st- or 2nd-level spell you know or have prepared, you can cast it at its lowest level without expending a spell slot if it targets only you or willing allies and restores Hit Points, grants Temporary Hit Points, increases Armor Class, or grants Resistance to damage. The spell must not deal damage. Field Aid. As a Magic Action, you can restore 2d6 Hit Points to a willing creature you touch.",
    "attunementRequired": true,
    "convergence": {
      "role": "output",
      "enabled": true,
      "mechanicalTag": "Utility + Defense",
      "tier": "T3"
    },
    "tier": "3",
    "type": "magic",
    "isUsable": false,
    "act": "Act 3",
    "isLocked": true,
    "charges": {
      "max": 1,
      "reset": "shortRest"
    },
    "activation": "action",
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "bc-t3-stillwell-spindle",
    "name": "Stillwell Spindle",
    "description": "Silver wire winds tightly around a smooth stone spindle. Tags: Recipe: Utility + Stability · Completed: Utility",
    "mechanicsText": "Practiced Hands. When you finish a Long Rest, choose one tool. You are proficient with that tool until you finish your next Long Rest. Quiet Reserve. When you finish a Short Rest, you can regain one expended 1st- or 2nd-level spell slot. If your spellcasting feature provides only higher-level slots, you can instead store one casting of a 1st- or 2nd-level spell you know or have prepared. You can cast that spell once at its lowest level without expending a spell slot. The stored casting is lost when you finish a Long Rest or your attunement ends. Once you use this property, you can't use it again until you finish a Long Rest.",
    "attunementRequired": true,
    "convergence": {
      "role": "output",
      "enabled": true,
      "mechanicalTag": "Utility + Stability",
      "tier": "T3"
    },
    "tier": "3",
    "type": "magic",
    "isUsable": false,
    "act": "Act 3",
    "isLocked": true,
    "charges": {
      "max": 1,
      "reset": "longRest"
    },
    "activation": "free",
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "bc-t3-stonebark-brigand",
    "name": "Stonebark Brigand",
    "description": "This small plate of petrified bark fastens over armor or clothing. Its grain shifts toward a repeated blow. Tags: Recipe: Defense + Stability · Completed: Defense",
    "mechanicsText": "When a hostile creature hits you with an attack, you gain a +2 bonus to Armor Class against further attacks made by that creature until the start of your next turn or until you leave your space, whichever comes first. Further hits from the same creature don't increase this bonus.",
    "attunementRequired": true,
    "convergence": {
      "role": "output",
      "enabled": true,
      "mechanicalTag": "Defense + Stability",
      "tier": "T3"
    },
    "tier": "3",
    "type": "magic",
    "isUsable": false,
    "act": "Act 3",
    "isLocked": true,
    "activation": "passive",
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "bc-t3-hearthroot-brooch",
    "name": "Hearthroot Brooch",
    "description": "A living root curls around a small, undying coal in this brooch. Tags: Recipe: Defense + Continuity · Completed: Continuity",
    "mechanicsText": "When you Ready a spell and its trigger hasn't occurred by the start of your next turn, you can hold the spell until the end of that turn without expending another spell slot. You must maintain Concentration on the spell and take a Reaction to release it when its trigger occurs. Taking the Ready action again replaces the spell you are holding.",
    "attunementRequired": true,
    "convergence": {
      "role": "output",
      "enabled": true,
      "mechanicalTag": "Defense + Continuity",
      "tier": "T3"
    },
    "tier": "3",
    "type": "magic",
    "isUsable": false,
    "act": "Act 3",
    "isLocked": true,
    "activation": "passive",
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "bc-t3-rimebreak-soles",
    "name": "Rimebreak Soles",
    "description": "Pale stone studs break through these frost-dark soles. Clinging ice flakes away as they move. Tags: Recipe: Stability + Cleanse · Completed: Stability",
    "mechanicsText": "When a hostile effect reduces your Speed without setting it to 0, reduce the penalty by 10 feet, to a minimum penalty of 0. Standing up from Prone costs you only 5 feet of movement.",
    "attunementRequired": true,
    "convergence": {
      "role": "output",
      "enabled": true,
      "mechanicalTag": "Stability + Cleanse",
      "tier": "T3"
    },
    "tier": "3",
    "type": "magic",
    "isUsable": false,
    "act": "Act 3",
    "isLocked": true,
    "activation": "passive",
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "bc-t3-everheld-filament",
    "name": "Everheld Filament",
    "description": "A green-gold filament loops through a seamless clasp. It stretches without fraying. Tags: Recipe: Stability + Continuity · Completed: Continuity",
    "mechanicsText": "When you fail a Constitution saving throw to maintain Concentration by 2 or less, you succeed instead.",
    "attunementRequired": true,
    "convergence": {
      "role": "output",
      "enabled": true,
      "mechanicalTag": "Stability + Continuity",
      "tier": "T3"
    },
    "tier": "3",
    "type": "magic",
    "isUsable": false,
    "act": "Act 3",
    "isLocked": true,
    "activation": "passive",
    "revisedAt": "2026-09-16T12:41:00.000Z"
  },
  {
    "id": "bc-t3-echochain-chime",
    "name": "Echochain Chime",
    "description": "Two small links hang from this chime. They ring a heartbeat apart. Tags: Recipe: Tactical + Continuity · Completed: Continuity",
    "mechanicsText": "Once per round, after a hostile creature within 30 feet of you resolves a Reaction that targets you or an ally within 30 feet, or interrupts your action or that of an ally within 30 feet, the affected creature gains a d4. The creature can add the die to its next attack roll or saving throw before the end of the current round. It can choose to do so after rolling, but before the outcome is known. A creature can have only one die from the chime at a time.",
    "attunementRequired": true,
    "convergence": {
      "role": "output",
      "enabled": true,
      "mechanicalTag": "Tactical + Continuity",
      "tier": "T3"
    },
    "tier": "3",
    "type": "magic",
    "isUsable": false,
    "act": "Act 3",
    "isLocked": true,
    "activation": "passive",
    "revisedAt": "2026-09-16T12:41:00.000Z"
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
        "hiddenNameOverride": "Darkmare",
        "spellPicks": {
          "3": [
            "Shadow Shroud "
          ]
        }
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
        "templateId": "broken-chain:act3:rootwake-warden:v1",
        "count": 1,
        "startingVisibility": "hp-bar",
        "hiddenNameOverride": "Rootwake Warden"
      },
      {
        "templateId": "broken-chain:act3:stormscar-ravager:v1",
        "count": 1,
        "startingVisibility": "hp-bar",
        "hiddenNameOverride": "Stormscar Ravager"
      },
      {
        "templateId": "broken-chain:act3:claimchain-exactor:v1",
        "count": 1,
        "startingVisibility": "hp-bar",
        "hiddenNameOverride": "Claimchain Exactor"
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

/**
 * Fingerprint of the PAYLOAD that last updated this file — not of the arrays above.
 *
 * They stopped being the same thing when the fold began MERGING creatures and equipment by id
 * rather than replacing them, which it does because a publish carrying three creatures must not
 * revert the other fourteen. The digest still answers the question it was built for — "is this
 * generated file the untouched output of a real export?" — and it is also what the encounter
 * library seed version keys off, so a publish still re-seeds a browser.
 */
export const AUTHORED_DIGEST = "fnv1a-3313fab5-202171";

/** When the fold script last wrote this file. */
export const AUTHORED_AT = "2026-10-04T17:57:03.143Z";

/** The merge is hand-written and lives beside this file — the fold rewrites this one. */
export { mergeAuthored } from "./mergeAuthored";
