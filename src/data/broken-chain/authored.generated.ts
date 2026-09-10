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
      "ac": 16,
      "maxHp": 108,
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
        "text": "The Reeve chooses one creature affected by Spoiling Cut within 30 feet. The first time that creature damages a creature other than the Reeve before the start of the Reeve's next turn, it takes 7 (2d6) Slashing damage after the triggering damage is resolved."
      },
      {
        "name": "Shearing Cut",
        "kind": "attack",
        "roll": "1d20+9",
        "damage": "3d10 + 5",
        "damageType": "Slashing",
        "range": "reach 5 ft., one target",
        "targets": 1
      },
      {
        "name": "Spoiling Cut",
        "kind": "attack",
        "roll": "1d20+9",
        "damage": "2d10 + 4",
        "damageType": "Slashing",
        "range": "reach 5 ft",
        "save": "CON DC 17",
        "text": "Constitution Saving Throw: DC 17, the target. Failure: Until the start of the Reeve's next turn, damage the target deals to creatures other than the Reeve is reduced by 5 for each damage instance. This effect ends early immediately after the affected creature makes an attack against the Reeve, whether that attack hits or misses."
      }
    ],
    "reactions": [
      {
        "name": "Final Pruning",
        "kind": "action",
        "text": "When an ally the Reeve can see within 30 feet is reduced to 0 Hit Points, the Reeve moves up to half its Speed toward the creature that dealt the damage. If the Reeve ends within reach, it makes one Shearing Cut attack against that creature. This movement provokes Opportunity Attacks normally."
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
      "maxHp": 101,
      "speed": "30 ft., fly 40 ft.",
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
      }
    ],
    "actions": [
      {
        "name": "Write the Ending",
        "kind": "action",
        "economyCost": "bonus",
        "targets": 1,
        "damage": "2d6",
        "damageType": "Psychic",
        "text": "Brandwing chooses one creature within 90 feet and writes one clause until the end of the turn. Clear Angle: Brandwing's Ember Lance attacks against the creature ignore Half Cover, Three-Quarters Cover, and Disadvantage. Closing Stroke: The first Ember Lance that hits the creature while it has half its Hit Points or fewer deals an extra 7 (2d6) Psychic damage."
      },
      {
        "name": "Ember Lance",
        "kind": "attack",
        "roll": "1d20+9",
        "damage": "3d12 + 5",
        "damageType": [
          "Fire",
          "Psychic"
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
      "A narrow Fiend with wing-like sheets of ember script. It writes on bark by touching it and leaves the letters burning after its hand is gone. Brandwing is the only Fiend in the Last Court roster.",
      "CINDER SKIP IS NOT MITIGATION, and prices at nothing on purpose. The block says the triggering attack or spell resolves COMPLETELY before the teleport, so it changes where Brandwing is standing next, not what it takes.",
      "RED SCRIPT CARRIES ITS 1d8 SO THE CHECKER CAN READ IT. Without a damage field the checker reported NEEDS DM INPUT - dice appear in the printed text and score zero - which is a real read failure, not a quibble. Once per turn is the rider’s true frequency, so a bonus-action line is the right shape. The trace applies it flat while the block conditions it on the first Ember Lance HITTING, so this reads about 1.4 a round generous. The +2 to hit is not counted at all."
    ],
    "visibility": {
      "defaultState": "hp-bar",
      "hiddenName": "Brandwing",
      "revealedName": "Brandwing"
    }
  },
  {
    "templateId": "broken-chain:act3:breaker:v1",
    "name": "Breaker",
    "encounterId": "act3-e8-the-occupied-acre",
    "encounterLabel": "Act 3 E8 - The Occupied Acre",
    "stats": {
      "kind": "fiend",
      "ac": 15,
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
      "ac": 16,
      "maxHp": 130,
      "speed": "30 ft.",
      "defenses": [
        {
          "name": "Shattered Plate",
          "ehpMultiplier": 1.028819,
          "provenance": "interpolated",
          "note": "Workbook: Fixed prevention, interpolated to 3/round below the 8/round anchor (+0.028819). The first time each round the Knight takes bludgeoning, piercing or slashing damage, reduce it by 3 — the SAME mechanic and the same interpolation as the Hollow Warden’s Barkhide. ⚠ NOT the calibrated \"Flat DR 3 per damaging hit [volatile]\" row (+0.377915): that one pays on EVERY hit, and this trait pays once a round. The classifier reaches for the per-hit row because the words match; the cadence is what separates them."
        },
        {
          "name": "Oppressive Presence + Commanding Presence",
          "ehpMultiplier": 1,
          "note": "UNPRICED, and left at 1.0 deliberately. Forcing one instance of every multi-target Action onto the Knight is the workbook's Damage transfer / redirection, which it publishes with a NULL contribution - the one category it declines to price. It is also not this creature's own sustain: it moves damage from its allies ONTO the Knight, so a per-creature multiplier above 1.0 would be backwards. Needs a roster-level decision."
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
        "text": "When the Demon Knight of Punishment takes bludgeoning, piercing, or Slashing damage, each enemy within 10 feet of the Knight takes Piercing damage equal to the Knight's Constitution modifier + 2 (6). The triggering damage resolves normally."
      },
      {
        "name": "Oppressive Presence",
        "kind": "trait",
        "text": "When a hostile creature uses an Action that creates two or more creature-targeting instances and the Knight is a legal target, at least one of those instances must target the Knight. This does not apply to single-target Actions or effects that target only a point, area, object, or space, and it never overrides the effect’s normal targeting restrictions."
      },
      {
        "name": "Shattered Plate",
        "kind": "trait",
        "text": "The first time each round the Knight takes bludgeoning, piercing, or Slashing damage, reduce it by 3."
      }
    ],
    "actions": [
      {
        "name": "Reckless Sentence",
        "kind": "action",
        "economyCost": "bonus",
        "text": "Until the start of the Knight's next turn, the Knight has Advantage on attack rolls, and attack rolls against it have Advantage."
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
        "text": "When a hostile creature the Knight can see within 30 feet uses an Action that creates two or more creature-targeting instances, before targets are chosen, one additional instance must target the Knight if it is a legal target. This cannot force more instances onto the Knight than the effect legally permits."
      }
    ],
    "resources": [],
    "notes": [
      "A broad knight-shape locked inside shattered infernal plate. The transformation has split the armor open at the joints and driven barbs through the seams, leaving it easier to strike than the intact knight it once resembled. It does not evade attention. It makes attention expensive.",
      "DM DESIGN READ. The Knight is the wall. Its shattered plate is deliberately hittable, but its raw body is large. Barbed Plate punishes repeated close physical hits. Oppressive Presence taxes multi-target creature effects once, and Commanding Presence can force a second legal instance into the Knight; single-target effects remain valid answers.",
      "BARBED PLATE IS DAMAGE, NOT DEFENCE, and the trace cannot see it. 4 piercing per melee hit taken is real pressure on the party - roughly 12 a round against three melee hits - but it is retaliation triggered by the PARTY's action, and the trace prices only what the creature spends its own action economy on. Not counted in the DPR below."
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
      "maxHp": 113,
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
      "maxHp": 108,
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
        "text": "Gloam Harrow has Advantage on saving throws against being Charmed, and magic cannot put her to sleep."
      }
    ],
    "actions": [
      {
        "name": "Cruel Instruction",
        "kind": "action",
        "economyCost": "bonus",
        "text": "One ally inside Winter's Toll can use its Reaction to make one weapon attack."
      },
      {
        "name": "Winter Needle",
        "kind": "attack",
        "roll": "1d20+8",
        "damage": "2d10 + 4",
        "damageType": [
          "Cold",
          "Psychic"
        ],
        "range": "range 90 ft., one target",
        "targets": 1
      },
      {
        "name": "Winter’s Toll",
        "kind": "action",
        "text": "Gloam Harrow chooses a point she can see within 60 feet. Until the start of her next turn, a 15-foot-radius area centered on that point is steeped in biting Fey glamour. Harrow’s allies in the area gain a +3 bonus to attack rolls and saving throws. Hostile creatures in the area take a −3 penalty to attack rolls and saving throws. The area ends early if Harrow is Incapacitated."
      }
    ],
    "reactions": [
      {
        "name": "Cold Counsel",
        "kind": "action",
        "text": "When an ally inside Winter's Toll is targeted by an attack, Gloam Harrow moves that ally up to half its Speed. This movement does not provoke Opportunity Attacks. If the ally is no longer a legal target, the attacker can choose another legal target or the attack misses."
      }
    ],
    "resources": [],
    "notes": [
      "A courtly Fey in a mantle of dead-green leaves stitched through with pale winter light. She speaks of hardship as cultivation: the Wood has sheltered too much, spared too much, and should learn again what deserves to survive.",
      "DM DESIGN READ. Harrow is the enchanter and commander, not a secondary damage dealer. Winter’s Toll helps allies and hinders enemies in the same space, so placement is the action. Using it costs Harrow her Action and therefore her own damage for the round. Its flat 3 is intentional.",
      "UNPRICED IN EHP, AND THE WRONG SHAPE FOR A PER-CREATURE MULTIPLIER. Winter’s Toll is roster-wide: -3 to party attack rolls reads as roughly +3 AC on every ally standing in it, against the workbook's Shield-like +5 AC - 1 round (+0.141537). It is also a trade, because casting it costs Harrow her whole action, which is why her own damage column is one attack and not two."
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
      "maxHp": 60,
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
      "maxHp": 115,
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
    "activation": "bonus",
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
    "activation": "reaction",
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
    "activation": "bonus",
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
    "activation": "reaction",
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
    "activation": "reaction",
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
    "activation": "action",
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
    "activation": "bonus",
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
    "activation": "action",
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
    "activation": "bonus",
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
    "activation": "action",
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
    "activation": "bonus",
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
    "activation": "reaction",
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
    "activation": "bonus",
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
    "activation": "bonus",
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
    "activation": "reaction",
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
    "activation": "bonus",
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
    "activation": "reaction",
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
    "activation": "reaction",
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
    "activation": "action",
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
    "activation": "reaction",
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
    "sourceEncounter": "A3 Gate II: Open Clearing",
    "sourceEncounters": [
      "A3 Gate III: Veilscar Hollow"
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
    "sourceEncounter": "A3 Gate II: Open Clearing",
    "sourceEncounters": [
      "A3 Gate III: Veilscar Hollow"
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
    "sourceEncounter": "A3 Gate II: Open Clearing",
    "sourceEncounters": [
      "A3 Gate III: Veilscar Hollow"
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
    "sourceEncounter": "A3 Gate II: Open Clearing",
    "sourceEncounters": [
      "A3 Gate III: Veilscar Hollow"
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
    "sourceEncounter": "A3 Gate II: Open Clearing",
    "sourceEncounters": [
      "A3 Gate III: Veilscar Hollow"
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
    "sourceEncounter": "A3 Gate II: Open Clearing",
    "sourceEncounters": [
      "A3 Gate III: Veilscar Hollow"
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
    "sourceEncounter": "A3 Gate II: Open Clearing",
    "sourceEncounters": [
      "A3 Gate III: Veilscar Hollow"
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
    "description": "A standard healing potion set aside with the tavern’s practical emergency stock. Tags: A2 · Tavern stock",
    "mechanicsText": "Use the normal D&D Potion of Healing rules.",
    "isUsable": true,
    "value": "50gp",
    "act": "Act 2",
    "sourceEncounter": "END-OF-ACT 2 TAVERN MERCHANT",
    "charges": {
      "max": 1,
      "reset": "manual"
    },
    "dmNote": "Final purchasing window before Act 3, which has no merchant. Merchant stock: 2.",
    "isLocked": true
  },
  {
    "id": "bc-smoke-flask",
    "name": "Smoke Flask",
    "type": "consumable",
    "activation": "action",
    "description": "A squat dark-glass flask whose stopper is wrapped in grey cloth. The liquid inside never settles; when the glass breaks, it becomes a wall of smoke before it reaches the ground. Tags: A2 · Tavern stock",
    "mechanicsText": "As a Magic action, throw the flask at a point you can see within 30 feet. It shatters and creates dense smoke in a 10-foot-radius sphere centered on that point. The area is Heavily Obscured until the end of your next turn. A strong wind disperses the smoke early.",
    "isUsable": true,
    "value": "100gp",
    "act": "Act 2",
    "sourceEncounter": "END-OF-ACT 2 TAVERN MERCHANT",
    "charges": {
      "max": 1,
      "reset": "manual"
    },
    "dmNote": "Final purchasing window before Act 3, which has no merchant. Merchant stock: 1.",
    "isLocked": true
  },
  {
    "id": "bc-wardbreaker-oil",
    "name": "Wardbreaker Oil",
    "type": "consumable",
    "activation": "bonus",
    "description": "A thin metallic oil kept in a narrow Ward-sealed vial. It crawls toward an edge or point as it is applied and holds there until impact. Tags: A2 · Tavern stock",
    "mechanicsText": "As a Bonus Action, apply the oil to one weapon or one piece of ammunition. The coating remains potent until its effect is delivered or washed away. The first time a creature takes damage from the coated weapon or ammunition, it takes an additional 2d6 Force damage; if it is Large or smaller, it is pushed 5 feet directly away from the attacker. The oil is then expended.",
    "isUsable": true,
    "value": "150gp",
    "act": "Act 2",
    "sourceEncounter": "END-OF-ACT 2 TAVERN MERCHANT",
    "charges": {
      "max": 1,
      "reset": "manual"
    },
    "dmNote": "Final purchasing window before Act 3, which has no merchant. Merchant stock: 1.",
    "isLocked": true
  },
  {
    "id": "bc-a4-blinkstep",
    "name": "Blinkstep",
    "type": "magic",
    "activation": "bonus",
    "description": "A matched pair of narrow, blackened ankle clasps whose metal has been pitted smooth by years of elemental exposure. Hairline fractures cross each face without ever quite meeting, and when the bearer shifts weight, one clasp seems to arrive a fraction of a heartbeat before the foot beneath it. Tags: A4 · Movement · Ruined / elemental saturation",
    "mechanicsText": "Bonus Action · 1/Short Rest: teleport up to 20 feet to an unoccupied space you can see.",
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
    "isLocked": true
  },
  {
    "id": "bc-a4-deferred-wound",
    "name": "Deferred Wound",
    "type": "magic",
    "activation": "reaction",
    "description": "A segmented forearm guard of dull layered metal, old enough that its dents have been worn smooth rather than repaired. Dark seams run between the plates like healed fractures. When a blow lands, those seams briefly hold the shape of the impact instead of letting it pass cleanly into the bearer. Tags: A4 · Defense · Ruined / elemental saturation",
    "mechanicsText": "Reaction · 1/Long Rest: when you take damage, roll 2d8. Reduce the triggering damage by up to the roll and record the amount actually reduced as deferred damage. Healing before the end of the current round removes deferred damage first. At round end, lose HP equal to any deferred damage that remains. The original hit still counts as a hit/damage event; deferred resolution does not retrigger hit/damage riders.",
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
    "isLocked": true
  },
  {
    "id": "bc-a4-rupture",
    "name": "Rupture",
    "type": "magic",
    "activation": "free",
    "description": "A narrow black-iron wrist ring split by ember-bright cracks that never cool completely. The metal looks less forged than pressure-broken and forced back together. At the instant an attack lands, the cracks flare toward the point of impact as though the ring is trying to widen the wound already made. Tags: A4 · Offensive · Ruined / elemental saturation",
    "mechanicsText": "Rider · 1/Long Rest: when you hit, deal an additional 2d10 damage of one damage type dealt by that attack.",
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
    "isLocked": true
  },
  {
    "id": "bc-a4-applied-insight",
    "name": "Applied Insight",
    "type": "magic",
    "activation": "reaction",
    "description": "A palm-sized many-faceted lens held in a scorched brass frame. Several faces are clouded with mineral haze while one always seems unnaturally clear when turned toward a problem. Its frame bears tiny adjustment marks from hands that kept refining it long after its original maker was gone. Tags: A4 · Utility · Ruined / elemental saturation",
    "mechanicsText": "Reaction · 1/Long Rest: after you or an ally within 30 feet fails an ability check, add 1d10 to the result, potentially turning it into a success.",
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
    "isLocked": true
  },
  {
    "id": "bc-a4-true-ground",
    "name": "True Ground",
    "type": "magic",
    "activation": "bonus",
    "description": "A heavy black-stone ankle band locked inside an old metal brace. Its underside has been worn perfectly flat despite the uneven ground it has crossed. Loose grit and tiny fragments of stone subtly orient toward it whenever the bearer plants their weight. Tags: A4 · Stability · Ruined / elemental saturation",
    "mechanicsText": "Bonus Action · 1/Short Rest: anchor your current space until the end of the current round. If a hostile effect moves you against your will, after that movement resolves teleport back to the anchor or the nearest space you can occupy.",
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
    "isLocked": true
  },
  {
    "id": "bc-a4-condition-vessel",
    "name": "Condition Vessel",
    "type": "magic",
    "activation": "action",
    "description": "A hollow crystal vessel no larger than a thumb joint, suspended inside a tarnished silver cage. Faint stains of different colors drift through the crystal and never mix. Near hostile magic or poison, one stain crawls toward the surface as if the vessel is already making room for something else. Tags: A4 · Cleanse · Ruined / elemental saturation",
    "mechanicsText": "Magic Action · 1/Long Rest: end Blinded, Charmed, Deafened, Frightened, Paralyzed, Poisoned, or Restrained on one willing creature within 30 feet. You gain that condition until the end of the current round. You cannot use this property for a condition you are immune to.",
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
    "isLocked": true
  },
  {
    "id": "bc-a4-threat-positioning",
    "name": "Threat Positioning",
    "type": "magic",
    "activation": "free",
    "description": "A thin compass-disc of dark alloy with no cardinal marks and three broken pointers trapped beneath its glass. The pointers ignore north. When danger is near, they settle instead on moving threats, then twitch a heartbeat after those threats change their intent. Tags: A4 · Tactical · Ruined / elemental saturation",
    "mechanicsText": "1/Long Rest, immediately after Initiative is rolled and before the first turn: choose one visible hostile creature and move your Initiative to immediately after it. The hostile creature does not move.",
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
    "isLocked": true
  },
  {
    "id": "bc-a4-preserved-reaction",
    "name": "Preserved Reaction",
    "type": "magic",
    "activation": "reaction",
    "description": "A braided wrist loop made from old silver wire and blackened root-fiber. One strand always hangs slightly slack no matter how tightly the loop is fastened. When the bearer commits to a sudden response, that slack strand snaps taut as if taking the strain of the reaction for them. Tags: A4 · Continuity · Ruined / elemental saturation",
    "mechanicsText": "1/Long Rest: when you use your normal Reaction for a standard non-spell Reaction, expend this item's charge instead of expending your Reaction. All other costs remain. Eligible uses are Opportunity Attacks, non-spell class/subclass/feat/item Reactions, or release of a Readied non-spell action or movement. Reaction spells, Readied spells, and Bond reactions are excluded.",
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
    "isLocked": true
  },
  {
    "id": "bc-catalyst",
    "name": "Catalyst",
    "type": "magic",
    "description": "A dense concentration of Convergence energy capable of infusing greater power into certain exceptional items. When accepted by a compatible item, the Catalyst strengthens and completes what is already present rather than forming something new. Tags: Catalyst · Tempering / stabilization · Not a Component Tag",
    "mechanicsText": "A Catalyst can temper one still-raw Ruined A4. The Catalyst is consumed, and that same A4 becomes its same-tag Tier 4 Singular. A Catalyst cannot be used as a normal component, cannot create a new tag, cannot temper A1–A3, and cannot use a completed T3 as the input. A creature can bind only one Tier 4 Singular.",
    "isUsable": false,
    "act": "Act 4",
    "sourceEncounter": "ACT 4 CATALYST REWARD TABLE",
    "charges": {
      "max": 1,
      "reset": "manual"
    },
    "dmNote": "Special Convergence Item — NO normal Component Tag, so it carries no `mechanicalTag` and can never be a recipe half. Consumed on use. Catalyst quantity scales by party size; the Act 4 tables are the source of truth for when each enters inventory.",
    "isLocked": true
  },
  {
    "id": "bc-t4-blinkstep",
    "name": "Blinkstep — Tempered",
    "type": "magic",
    "activation": "bonus",
    "description": "The Catalyst fills every old fracture in the ankle clasps with clean, luminous lines without erasing the pitted age of the metal. The two pieces remain unmistakably the same worn pair, but their edges now separate into brief translucent afterimages whenever the bearer moves, each afterimage appearing one perfect step ahead before folding back into the clasps. Tags: T4 Singular · same mechanical tag as its Ruined A4 · Catalyst-tempered",
    "mechanicsText": "Active — 1/Encounter: teleport up to 30 feet to an unoccupied space you can see. Passive — your Speed increases by 10 feet.",
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
      "mechanicalTag": "Movement"
    },
    "dmNote": "The same A4 item after Catalyst tempering, NOT a new A+B fusion — so its tag stays Movement rather than becoming a pair. Requires attunement, and a creature can bind only ONE Tier 4 Singular.",
    "isLocked": true
  },
  {
    "id": "bc-t4-applied-insight",
    "name": "Applied Insight — Tempered",
    "type": "magic",
    "activation": "reaction",
    "description": "The Catalyst runs through the clouded facets as bright internal veins, clearing them without replacing the old lens. The scorched brass frame unfolds into two thin nested rings that turn around the original setting on their own. What was once the single clear face now becomes whichever facet the item needs, visibly aligning itself with the task at hand. Tags: T4 Singular · same mechanical tag as its Ruined A4 · Catalyst-tempered",
    "mechanicsText": "Active — Reaction · 1/Short Rest: after you or an ally within 30 feet fails an ability check, add 1d12 to the result, potentially succeeding. Passive — after each Long Rest, choose one skill or tool; you gain proficiency with it until your next Long Rest.",
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
      "mechanicalTag": "Utility"
    },
    "dmNote": "The same A4 item after Catalyst tempering, NOT a new A+B fusion — so its tag stays Utility rather than becoming a pair. Requires attunement, and a creature can bind only ONE Tier 4 Singular.",
    "isLocked": true
  },
  {
    "id": "bc-t4-deferred-wound",
    "name": "Deferred Wound — Tempered",
    "type": "magic",
    "activation": "reaction",
    "description": "The Catalyst settles into the guard's dark seams like molten light and binds the old segmented plates without smoothing away their dents. Hair-thin luminous bridges now span the gaps between sections. When damage is deferred, the light gathers visibly inside those bridges; when the wound is fully cleared, the stored glow collapses inward and leaves a brief protective sheen over the bearer. Tags: T4 Singular · same mechanical tag as its Ruined A4 · Catalyst-tempered",
    "mechanicsText": "Active — Reaction · 1/Short Rest: Deferred Wound uses 2d10 instead of 2d8. Passive — if all deferred damage is cleared before it resolves at round end, you gain Temporary Hit Points equal to your Proficiency Bonus.",
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
      "mechanicalTag": "Defense"
    },
    "dmNote": "The same A4 item after Catalyst tempering, NOT a new A+B fusion — so its tag stays Defense rather than becoming a pair. Requires attunement, and a creature can bind only ONE Tier 4 Singular.",
    "isLocked": true
  },
  {
    "id": "bc-t4-true-ground",
    "name": "True Ground — Tempered",
    "type": "magic",
    "activation": "bonus",
    "description": "The Catalyst traces the old ankle band with concentric lines of pale light, turning the worn cracks into a deliberate geometric pattern. The black stone and metal remain unchanged in shape, but a faint ring of the same pattern now appears on the ground whenever the bearer anchors themselves. If they are displaced, that luminous imprint holds their place until they return to it. Tags: T4 Singular · same mechanical tag as its Ruined A4 · Catalyst-tempered",
    "mechanicsText": "Active — 1/Encounter: the anchor lasts until the start of your next turn and also answers hostile teleportation, returning you to the anchor or nearest space you can occupy after the hostile displacement resolves. Passive — once per round, reduce forced movement applied to you by 10 feet.",
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
      "mechanicalTag": "Stability"
    },
    "dmNote": "The same A4 item after Catalyst tempering, NOT a new A+B fusion — so its tag stays Stability rather than becoming a pair. Requires attunement, and a creature can bind only ONE Tier 4 Singular.",
    "isLocked": true
  },
  {
    "id": "bc-t4-condition-vessel",
    "name": "Condition Vessel — Tempered",
    "type": "magic",
    "activation": "action",
    "description": "The Catalyst threads through the tarnished cage and turns each bar into a bright channel feeding the original crystal vessel. The crystal itself becomes perfectly clear between uses, while its old colored stains survive as thin veins around the edge. When a condition is drawn out, its color flashes inside the vessel and is consumed by the Catalyst light instead of passing into the bearer. Tags: T4 Singular · same mechanical tag as its Ruined A4 · Catalyst-tempered",
    "mechanicsText": "Active — Magic Action · 1/Short Rest: end one listed Condition on a willing creature within 30 feet; the extracted condition ends without transferring to you. Passive — you have advantage on saving throws against Charmed, Frightened, and Poisoned.",
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
      "mechanicalTag": "Cleanse"
    },
    "dmNote": "The same A4 item after Catalyst tempering, NOT a new A+B fusion — so its tag stays Cleanse rather than becoming a pair. Requires attunement, and a creature can bind only ONE Tier 4 Singular.",
    "isLocked": true
  },
  {
    "id": "bc-t4-rupture",
    "name": "Rupture — Tempered",
    "type": "magic",
    "activation": "free",
    "description": "The Catalyst does not close the wrist ring's old splits; it makes them precise. Brilliant white-gold light burns inside each ember crack, and several razor-thin segments now hover a hair's breadth from the original iron while remaining bound to it. On a committed hit, the floating pieces snap into alignment and drive the ring's stored force through the same wound before drifting apart again. Tags: T4 Singular · same mechanical tag as its Ruined A4 · Catalyst-tempered",
    "mechanicsText": "Active — Rider · 1/Short Rest: when you hit, deal an additional 2d12 damage of one damage type dealt by the attack, and the target cannot regain Hit Points until the start of your next turn. Passive — once on each of your turns, one damage die showing 1 may count as 2.",
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
      "mechanicalTag": "Offensive"
    },
    "dmNote": "The same A4 item after Catalyst tempering, NOT a new A+B fusion — so its tag stays Offensive rather than becoming a pair. Requires attunement, and a creature can bind only ONE Tier 4 Singular.",
    "isLocked": true
  },
  {
    "id": "bc-t4-threat-positioning",
    "name": "Threat Positioning — Tempered",
    "type": "magic",
    "activation": "free",
    "description": "The Catalyst rebuilds nothing that was missing from the old compass-disc; instead it surrounds the original broken pointers with a thin luminous orbit. The dark disc remains scratched and incomplete beneath the glass, while the new ring moves freely above it. When initiative is set, one line of light locks onto the chosen threat and the orbit visibly turns until the bearer's place and the threat's place exchange. Tags: T4 Singular · same mechanical tag as its Ruined A4 · Catalyst-tempered",
    "mechanicsText": "Active — 1/Short Rest, immediately after Initiative is rolled and before the first turn: exchange your Initiative with one visible hostile creature. Initiative is never moved mid-round, and this cannot create double or skipped turns. Passive — when a hostile creature immediately before you in Initiative finishes its turn, gain +2 to your next saving throw before the end of your next turn.",
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
      "mechanicalTag": "Tactical"
    },
    "dmNote": "The same A4 item after Catalyst tempering, NOT a new A+B fusion — so its tag stays Tactical rather than becoming a pair. Requires attunement, and a creature can bind only ONE Tier 4 Singular.",
    "isLocked": true
  },
  {
    "id": "bc-t4-preserved-reaction",
    "name": "Preserved Reaction — Tempered",
    "type": "magic",
    "activation": "reaction",
    "description": "The Catalyst weaves a bright filament through the original silver-and-root braid, following every old bend instead of replacing it. The once-slack strand now carries a second luminous echo beside it. When the item preserves a Reaction, the physical braid tightens around the bearer while the echo flashes toward the triggering threat, making the item look momentarily connected to both the response that was kept and the interruption it denied. Tags: T4 Singular · same mechanical tag as its Ruined A4 · Catalyst-tempered",
    "mechanicsText": "Active — 1/Short Rest: use the A4 Preserved Reaction substitution. If a hostile creature caused the trigger, its next attempted Reaction before the start of its next turn is suppressed; then the suppression ends. Passive — Held Intent: when you Ready a non-spell action or movement and its trigger does not occur before the start of your next turn, it remains Readied until the end of that turn. Only one Readied intent can be preserved this way.",
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
      "mechanicalTag": "Continuity"
    },
    "dmNote": "The same A4 item after Catalyst tempering, NOT a new A+B fusion — so its tag stays Continuity rather than becoming a pair. Requires attunement, and a creature can bind only ONE Tier 4 Singular.",
    "isLocked": true
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
export const AUTHORED_DIGEST = "fnv1a-7bb13116-193373";

/** When the fold script last wrote this file. */
export const AUTHORED_AT = "2026-09-10T08:41:55.499Z";

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
  const merged = bundled.map(b => {
    const over = overrides.get(idOf(b));
    if (!over) return b;
    /**
     * ⚠ FIELD-WISE, NOT WHOLESALE — OR THE SEED CAN NEVER GAIN A FIELD AGAIN.
     *
     * This replaced the bundled entry outright. That is fine while the two describe the same
     * shape, and it silently freezes the library the moment the shape grows: the equipment export
     * carries ALL 137 items, so every seeded item is also an "authored" one, and an authored copy
     * taken before a field existed permanently shadowed it.
     *
     * The case that surfaced it: an activation field — what using an item costs — was added and written
     * onto 21 library items, and not one of them reached the app. Every single row was overridden
     * by its own snapshot from a browser that predated the field.
     *
     * A field the authored copy does not MENTION is not a decision to remove it; it is a field
     * that did not exist when the export was taken. So an authored copy overrides the fields it
     * actually states, and the seed supplies the rest.
     *
     * ⚠ THE COST, STATED: clearing a field back to empty no longer travels through the fold —
     * the seed's value returns. That is the rarer case and a visible one, and it is a far smaller
     * price than a library that can never be improved again.
     */
    const stated = Object.fromEntries(
      Object.entries(over as Record<string, unknown>).filter(([, v]) => v !== undefined),
    );
    return { ...(b as Record<string, unknown>), ...stated } as T;
  });
  const bundledIds = new Set(bundled.map(idOf));
  return [...merged, ...authored.filter(a => !bundledIds.has(idOf(a)))];
}
