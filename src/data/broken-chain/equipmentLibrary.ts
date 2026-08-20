// Auto-generated from broken_chain_loot_acts1_2_app_ready_v3_cleaned.docx — do not edit manually.
//
// THE DOC IS THE SOURCE OF TRUTH.
//
// SCOPE. FULL REBUILD. The cleaned doc is complete for Acts 1-2 — all loot through the Act 2
// final plus the completed convergence items — so EVERY entry comes from it and nothing is
// carried over from the previous library. The app library had drifted from the document;
// this replaces it rather than patching it.
//
// The doc LABELS its body lines ("Effect." then "Description.") and puts Effect FIRST, which
// is inverted from the previous revision. Reading by position rather than by label filed
// every rules text as flavour and every flavour as the mechanics.
//
// CONVERGENCE, rebuilt. Outputs are now Tier 1 and Tier 2 (the old 1.5 / 2 / 2.5 / 3 pools are
// retired), and neither tier requires attunement. Provenance sets strength: A1+A1 and A1+A2
// produce Tier 1, A2+A2 produces Tier 2. Inputs carry their act and mechanical tag; outputs
// carry the recipe pair that makes them. Both live in `convergence`.
//
// MERCHANT STOCK now sells Convergence-capable Wondrous Items with gold attached — Aldric's
// three A1 items (165gp total) and Northgate's two tagged A2 items (185gp), plus the untagged
// North Wind Flask. The mundane catalog is GONE: the doc replaces it with two ledger lines
// (Tools/Repairs 15gp, Rations 10gp) and says not to build a separate mundane catalog.
//
// IDS SURVIVE RENAMES, because an item attached to a character is referenced by id.
// RETIRED_EQUIPMENT_IDS is removed from the campaign library on re-seed.
import type { EquipmentItem } from "../../core/ui/EquipmentBagEditor";
import { AUTHORED_EQUIPMENT, mergeAuthored } from "./authored.generated";

/** Items the loot doc no longer contains. Removed from the campaign library on re-seed. */
export const RETIRED_EQUIPMENT_IDS: string[] = [
"tbc-warden-s-mark", // Warden's Mark
  "tbc-rimestone-pauldron", // Rimestone Pauldron
  "tbc-ward-iron-bracer", // Ward Iron Bracer
  "tbc-coldwell-vial", // Coldwell Vial
  "tbc-bonded-cord", // Bonded Cord
  "tbc-voidtouched-lens", // Voidtouched Lens
  "tbc-hollow-pack-ward-token", // Hollow Pack Ward Token
  "tbc-frontier-ration-tin-x3", // Frontier Ration Tin (×3)
  "tbc-warding-salve", // Warding Salve
  "tbc-signal-striker", // Signal Striker
  "tbc-ward-issue-climbing-line-50ft", // Ward-Issue Climbing Line (50ft)
  "tbc-wayfarer-s-token", // Wayfarer's Token
  "bc-anchor-thread-ring", // Anchor Thread Ring
  "bc-step-stabilizer-boots", // Step Stabilizer Boots
  "bc-deepset-band", // Deepset Band
  "bc-lensing-ring", // Lensing Ring
  "bc-driftveil-cloak", // Driftveil Cloak
  "bc-frostgrip-treads", // Frostgrip Treads
  "bc-gapstep-boots", // Gapstep Boots
  "bc-splitgrain-gauntlets", // Splitgrain Gauntlets
  "bc-ring-of-protection", // Ring of Protection
  "bc-edge-alignment-ring", // Edge Alignment Ring
  "bc-stabilized-band", // Stabilized Band
  "bc-verdant-stride-boots", // Verdant Stride Boots
  "bc-warden-s-bulwark-cloak", // Warden's Bulwark Cloak
  "bc-grasp-of-the-hollow", // Grasp of the Hollow
  "bc-drift-anchor-ring", // Drift Anchor Ring
  "bc-hollowlight-cloak", // Hollowlight Cloak
  "bc-quickstep-boots", // Quickstep Boots
  "bc-edgeworn-gloves", // Edgeworn Gloves
  "bc-ring-of-the-standing-ward", // Ring of the Standing Ward
  "bc-ring-of-the-open-edge", // Ring of the Open Edge
  "bc-mantle-of-the-held-line", // Mantle of the Held Line
  "bc-veilturn-cloak", // Veilturn Cloak
  "bc-boots-of-the-long-step", // Boots of the Long Step
  "bc-rootbound-striders", // Rootbound Striders
  "bc-gauntlets-of-the-closing-hand", // Gauntlets of the Closing Hand
  "bc-unbinding-wraps", // Unbinding Wraps
  "tbc-briarfang-rapier-str", // Briarfang Rapier (STR)
  "tbc-phantom-cord-dagger-str", // Phantom Cord Dagger (STR)
  "tbc-splitfrost-blade-str", // Splitfrost Blade (STR)
  "tbc-hollow-fang-str", // Hollow Fang (STR)
  "bc-wendigo-ember-heart", // Wendigo Ember Heart
];

const BUNDLED_EQUIPMENT_LIBRARY: EquipmentItem[] = [
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
    "act": "Act 2",
    "sourceEncounter": "ALDRIC'S FINAL STOCK",
    "charges": {"max":1,"reset":"longRest"},
    "convergence": {"role":"input","enabled":true,"mechanicalTag":"Utility","actLabel":"A1"},
    "isLocked": true
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
    "charges": {"max":1,"reset":"shortRest"},
    "convergence": {"role":"input","enabled":true,"mechanicalTag":"Movement","actLabel":"A1"},
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
    "charges": {"max":1,"reset":"longRest"},
    "convergence": {"role":"input","enabled":true,"mechanicalTag":"Stability","actLabel":"A1"},
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
    "sourceEncounter": "DISPLACED OWLBEAR",
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
    "sourceEncounter": "DISPLACED OWLBEAR",
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
    "act": "Act 2",
    "sourceEncounter": "DISPLACED OWLBEAR",
    "isLocked": true
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
    "sourceEncounter": "DISPLACED OWLBEAR",
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
    "sourceEncounter": "DISPLACED OWLBEAR",
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
    "sourceEncounter": "DISPLACED OWLBEAR",
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
    "sourceEncounter": "DISPLACED OWLBEAR",
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
    "sourceEncounter": "DISPLACED OWLBEAR",
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
    "sourceEncounter": "DISPLACED OWLBEAR",
    "convergence": {"role":"input","enabled":true,"mechanicalTag":"Movement","actLabel":"A1"},
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
    "sourceEncounter": "DISPLACED OWLBEAR",
    "charges": {"max":1,"reset":"shortRest"},
    "convergence": {"role":"input","enabled":true,"mechanicalTag":"Utility","actLabel":"A1"},
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
    "sourceEncounter": "MIRAGE STALKER",
    "charges": {"max":1,"reset":"shortRest"},
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
    "sourceEncounter": "MIRAGE STALKER",
    "charges": {"max":1,"reset":"longRest"},
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
    "sourceEncounter": "MIRAGE STALKER",
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
    "sourceEncounter": "MIRAGE STALKER",
    "isLocked": true
  },
  {
    "id": "tbc-the-staring-knot",
    "name": "Staring-Knot Wand",
    "effect": { "type": "reroll", "rerollMethod": "reroll", "condition": "a creature succeeded on a save against your spell — it rerolls" },
    "isSpellFocus": true,
    "spellFocusAttack": "+1",
    "spellFocusDamage": "+1",
    "spellFocusSaveDc": "+1",
    "type": "magic",
    "description": "A short length of pale wood, the grain spiralling to a knot at the tip. Sight along it and the tip never sits quite where your hand says it should. The knot has a centre, and the centre has a way of being aimed back at you.",
    "mechanicsText": "Can be used as a spellcasting focus. The wand has 1 charge. When a creature succeeds on a saving throw against a spell you cast, you can expend the charge to force that creature to reroll the save; it must use the new result. The wand regains its charge when you finish a long rest.",
    "isUsable": false,
    "act": "Act 2",
    "sourceEncounter": "MIRAGE STALKER",
    "charges": {"max":1,"reset":"longRest"},
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
    "sourceEncounter": "MIRAGE STALKER",
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
    "act": "Act 2",
    "sourceEncounter": "MIRAGE STALKER",
    "charges": {"max":1,"reset":"longRest"},
    "isLocked": true
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
    "sourceEncounter": "MIRAGE STALKER",
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
    "sourceEncounter": "MIRAGE STALKER",
    "charges": {"max":1,"reset":"longRest"},
    "convergence": {"role":"input","enabled":true,"mechanicalTag":"Defense","actLabel":"A1"},
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
    "sourceEncounter": "MIRAGE STALKER",
    "convergence": {"role":"input","enabled":true,"mechanicalTag":"Stability","actLabel":"A1"},
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
    "charges": {"max":1,"reset":"shortRest"},
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
    "charges": {"max":1,"reset":"shortRest"},
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
    "convergence": {"role":"input","enabled":true,"mechanicalTag":"Defense","actLabel":"A2"},
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
    "charges": {"max":1,"reset":"longRest"},
    "convergence": {"role":"input","enabled":true,"mechanicalTag":"Cleanse","actLabel":"A2"},
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
    "convergence": {"role":"input","enabled":true,"mechanicalTag":"Defense","actLabel":"A2"},
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
    "charges": {"max":2,"reset":"manual","note":"Recharges at dawn"},
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
    "sourceEncounter": "LESSER WENDIGOS",
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
    "sourceEncounter": "LESSER WENDIGOS",
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
    "sourceEncounter": "LESSER WENDIGOS",
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
    "sourceEncounter": "LESSER WENDIGOS",
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
    "effect": {"type":"armedEffect","label":"Icebound Blessing","formula":"+1d8"},
    "spellFocusAttack": "+1",
    "spellFocusDamage": "+1",
    "spellFocusSaveDc": "+1",
    "act": "Act 2",
    "sourceEncounter": "LESSER WENDIGOS",
    "charges": {"max":1,"reset":"longRest"},
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
    "sourceEncounter": "LESSER WENDIGOS",
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
    "sourceEncounter": "LESSER WENDIGOS",
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
    "sourceEncounter": "LESSER WENDIGOS",
    "charges": {"max":1,"reset":"longRest"},
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
    "sourceEncounter": "LESSER WENDIGOS",
    "charges": {"max":1,"reset":"longRest"},
    "convergence": {"role":"input","enabled":true,"mechanicalTag":"Cleanse","actLabel":"A2"},
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
    "sourceEncounter": "LESSER WENDIGOS",
    "convergence": {"role":"input","enabled":true,"mechanicalTag":"Stability","actLabel":"A2"},
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
    "sourceEncounter": "FROZEN SENTINELS",
    "charges": {"max":3,"reset":"longRest"},
    "convergence": {"role":"input","enabled":true,"mechanicalTag":"Utility","actLabel":"A2"},
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
    "sourceEncounter": "PALE DRIFTER + FROZEN CLOAK",
    "charges": {"max":1,"reset":"longRest"},
    "convergence": {"role":"input","enabled":true,"mechanicalTag":"Movement","actLabel":"A2"},
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
    "sourceEncounter": "FULL WENDIGO",
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
    "sourceEncounter": "FULL WENDIGO",
    "attunementRequired": true,
    "charges": { "max": 1, "reset": "shortRest" },
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
    "sourceEncounter": "FULL WENDIGO",
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
    "sourceEncounter": "FULL WENDIGO",
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
    "sourceEncounter": "FULL WENDIGO",
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
    "sourceEncounter": "FULL WENDIGO",
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
    "sourceEncounter": "FULL WENDIGO",
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
    "charges": {"max":1,"reset":"encounter"},
    "ac": "13 + DEX",
    "act": "Act 2",
    "sourceEncounter": "FULL WENDIGO",
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
    "sourceEncounter": "FULL WENDIGO",
    "charges": {"max":1,"reset":"manual","note":"Recharges at dawn"},
    "convergence": {"role":"input","enabled":true,"mechanicalTag":"Offensive","actLabel":"A2"},
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
    "effect": { "type": "armedEffect", "label": "Frozen Resolve", "formula": "+1d4" },
    "act": "Act 2",
    "sourceEncounter": "FULL WENDIGO",
    "charges": {"max":1,"reset":"manual","note":"Recharges at dawn"},
    "convergence": {"role":"input","enabled":true,"mechanicalTag":"Stability","actLabel":"A2"},
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
    "charges": {"max":1,"reset":"longRest"},
    "convergence": {"role":"output","enabled":true,"mechanicalTag":"Movement + Stability"},
    "isLocked": true
  },
  {
    "id": "bc-clarity-hood",
    "name": "Clarity Hood",
    "effect": { "type": "reroll", "rerollMethod": "reroll", "condition": "a failed save vs Charmed, Frightened, or an illusion" },
    "type": "magic",
    "description": "A light hood whose inner weave sharpens at the edge of false images and invasive emotion. Tags: Recipe: Defense + Utility · Completed: Utility",
    "mechanicsText": "Once per long rest, when you fail a saving throw against being Charmed or Frightened, or against an illusion spell or effect, reroll the save and use the new result.",
    "isUsable": false,
    "tier": "1",
    "act": "Act 2",
    "charges": {"max":1,"reset":"longRest"},
    "convergence": {"role":"output","enabled":true,"mechanicalTag":"Defense + Utility"},
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
    "charges": {"max":1,"reset":"shortRest"},
    "convergence": {"role":"output","enabled":true,"mechanicalTag":"Movement + Utility"},
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
    "charges": {"max":1,"reset":"longRest"},
    "convergence": {"role":"output","enabled":true,"mechanicalTag":"Defense + Stability"},
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
    "charges": {"max":2,"reset":"longRest"},
    "convergence": {"role":"output","enabled":true,"mechanicalTag":"Cleanse + Utility"},
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
    "charges": {"max":1,"reset":"longRest"},
    "convergence": {"role":"output","enabled":true,"mechanicalTag":"Offensive + Movement"},
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
    "charges": {"max":1,"reset":"manual","note":"Recharges at dawn"},
    "convergence": {"role":"output","enabled":true,"mechanicalTag":"Movement + Stability"},
    "isLocked": true
  },
  {
    "id": "bc-hollowlight",
    "name": "Hollowlight",
    "effect": { "type": "reroll", "rerollMethod": "reroll", "condition": "a failed save vs Blinded, Charmed, Frightened or Restrained" },
    "type": "magic",
    "description": "A pale light source that does not brighten darkness so much as make it stop lying. Tags: Recipe: Cleanse + Utility · Completed: Utility",
    "mechanicsText": "You can see through magical darkness within 30 feet. Once per day, when you fail a saving throw against being Blinded, Charmed, Frightened, or Restrained, you can reroll the save and use the new result.",
    "isUsable": false,
    "tier": "2",
    "act": "Act 2",
    "charges": {"max":1,"reset":"manual","note":"Recharges at dawn"},
    "convergence": {"role":"output","enabled":true,"mechanicalTag":"Cleanse + Utility"},
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
    "charges": {"max":1,"reset":"manual","note":"Recharges at dawn"},
    "convergence": {"role":"output","enabled":true,"mechanicalTag":"Movement + Utility"},
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
    "charges": {"max":1,"reset":"manual","note":"Recharges at dawn"},
    "convergence": {"role":"output","enabled":true,"mechanicalTag":"Offensive + Cleanse"},
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
    "charges": {"max":1,"reset":"manual","note":"Recharges at dawn"},
    "convergence": {"role":"output","enabled":true,"mechanicalTag":"Defense + Movement"},
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
    "charges": {"max":1,"reset":"manual","note":"Recharges at dawn"},
    "convergence": {"role":"output","enabled":true,"mechanicalTag":"Defense + Cleanse"},
    "isLocked": true
  },

  // ─── ACT 3 CONVERGENCE INPUTS ────────────────────────────────────────────────
  //
  // From loot doc v12 (Acts 1–3). Act 3 adds TACTICAL and CONTINUITY to the tag vocabulary;
  // the authored pool is eight inputs — Tactical x2, Continuity x2, Offensive x2, Cleanse x1,
  // Defense x1 — and that is exactly what is here.
  //
  // There is no merchant in Act 3, so these arrive through the two DROPPING GATES, and which
  // ones drop depends on party size:
  //   Gate I  — Crosspath Token + Rootbound Thread always; +Bloodbriar Seed at 5; +Mirrorbark
  //             Scale at 6.
  //   Gate III— Branchcall Marker + Held-Echo Knot always; +Veilwash Leaf at 5; +Thornwake
  //             Splinter at 6.
  // `sourceEncounter` uses the gate's encounter label verbatim so the loot pool matches the
  // encounter the party actually fought. Gate II (The Mirrors) drops no inputs.
  {
    "id": "tbc-crosspath-token",
    "name": "Crosspath Token",
    "type": "magic",
    "description": "A forked token of blackwood split by a pale living vein. When danger is about to move first, the vein leans toward the opening as though the forest has already seen the crossing. Tags: A3 · Tactical",
    "mechanicsText": "Once per day, after Initiative is rolled but before the first turn begins, choose one hostile creature you can see that has a higher Initiative than you. During the first round, you take your turn immediately before that creature. You do not also act at your original Initiative that round. Starting with round 2, you return to your original Initiative.",
    "isUsable": false,
    "act": "Act 3",
    "sourceEncounter": "Act 3 E3 - Gate I: The Crone and the Mare",
    "charges": {"max":1,"reset":"manual","note":"Recharges at dawn"},
    "convergence": {"role":"input","enabled":true,"mechanicalTag":"Tactical","actLabel":"A3"},
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
    "sourceEncounter": "Act 3 E3 - Gate I: The Crone and the Mare",
    "charges": {"max":1,"reset":"manual","note":"Recharges at dawn"},
    "convergence": {"role":"input","enabled":true,"mechanicalTag":"Continuity","actLabel":"A3"},
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
    "sourceEncounter": "Act 3 E3 - Gate I: The Crone and the Mare",
    "charges": {"max":1,"reset":"manual","note":"Recharges at dawn"},
    "convergence": {"role":"input","enabled":true,"mechanicalTag":"Offensive","actLabel":"A3"},
    "isLocked": true
  },
  {
    "id": "tbc-mirrorbark-scale",
    "name": "Mirrorbark Scale",
    "effect": { "type": "reroll", "rerollMethod": "reroll", "condition": "when an attack hits you (Reaction) — the attacker rerolls" },
    "type": "magic",
    "description": "A thumb-sized plate of polished bark whose grain catches reflections a fraction too early. At the instant of impact, the false reflection seems to pull the real blow after it. Tags: A3 · Defense",
    "mechanicsText": "Once per day, when an attack hits you, you can use your Reaction to force the attacker to reroll the attack roll and use the new roll.",
    "isUsable": false,
    "act": "Act 3",
    "sourceEncounter": "Act 3 E3 - Gate I: The Crone and the Mare",
    "charges": {"max":1,"reset":"manual","note":"Recharges at dawn"},
    "convergence": {"role":"input","enabled":true,"mechanicalTag":"Defense","actLabel":"A3"},
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
    "sourceEncounter": "Act 3 E10 - The Center",
    "charges": {"max":1,"reset":"manual","note":"Recharges at dawn"},
    "convergence": {"role":"input","enabled":true,"mechanicalTag":"Tactical","actLabel":"A3"},
    "isLocked": true
  },
  {
    "id": "tbc-held-echo-knot",
    "name": "Held-Echo Knot",
    "type": "magic",
    "description": "A knot of silver bark-fiber that remembers tension after it is released. When an action is cut short, the knot tightens around the spent effort as though refusing to let the commitment disappear with it. Tags: A3 · Continuity",
    "mechanicsText": "Once per day, when a creature's Reaction causes an action you take to fail or prevents it from resolving, choose one spell slot, charge, or limited-use class resource you expended as part of that action. That resource is not expended. The Reaction otherwise resolves normally.",
    "isUsable": false,
    "act": "Act 3",
    "sourceEncounter": "Act 3 E10 - The Center",
    "charges": {"max":1,"reset":"manual","note":"Recharges at dawn"},
    "convergence": {"role":"input","enabled":true,"mechanicalTag":"Continuity","actLabel":"A3"},
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
    "sourceEncounter": "Act 3 E10 - The Center",
    "charges": {"max":1,"reset":"manual","note":"Recharges at dawn"},
    "convergence": {"role":"input","enabled":true,"mechanicalTag":"Cleanse","actLabel":"A3"},
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
    "sourceEncounter": "Act 3 E10 - The Center",
    "charges": {"max":1,"reset":"manual","note":"Recharges at dawn"},
    "convergence": {"role":"input","enabled":true,"mechanicalTag":"Offensive","actLabel":"A3"},
    "isLocked": true
  },

  // ─── CONVERGENCE TIER 2 — the four that complete the catalogue ────────────────
  //
  // v12 declares Tier 2 complete at ten outputs; six were already here. These four are the
  // ones the earlier edition reserved for "the two new normal tags introduced in Act 3" —
  // Tactical and Continuity first appear as COMPLETED tags at this tier, made by pairing an
  // Act 3 component with an earlier-provenance one (A2 + A3 -> Tier 2).
  //
  // Tier 3 is deliberately absent: v12 leaves it unbuilt, and Christopher is authoring some
  // of those himself. Do not fill it in from the recipe table.
  {
    "id": "bc-turnstep-relay",
    "name": "Turnstep Relay",
    "type": "magic",
    "description": "A narrow pair of hinged plates whose inner marks click toward the next threat a heartbeat before it moves. Tags: Recipe: Movement + Tactical · Completed: Tactical",
    "mechanicsText": "Once per day, when a hostile creature you can see within 30 feet starts its turn, you can use your Reaction to move up to half your Speed without provoking opportunity attacks. This movement occurs before that creature takes any action or movement.",
    "isUsable": false,
    "tier": "2",
    "act": "Act 3",
    "charges": {"max":1,"reset":"manual","note":"Recharges at dawn"},
    "convergence": {"role":"output","enabled":true,"mechanicalTag":"Movement + Tactical"},
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
    "charges": {"max":1,"reset":"manual","note":"Recharges at dawn"},
    "convergence": {"role":"output","enabled":true,"mechanicalTag":"Offensive + Tactical"},
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
    "charges": {"max":1,"reset":"manual","note":"Recharges at dawn"},
    "convergence": {"role":"output","enabled":true,"mechanicalTag":"Utility + Continuity"},
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
    "charges": {"max":1,"reset":"manual","note":"Recharges at dawn"},
    "convergence": {"role":"output","enabled":true,"mechanicalTag":"Stability + Continuity"},
    "isLocked": true
  }
];

/**
 * The campaign equipment library the app actually reads — bundled items with in-app authoring
 * folded over them by id. This is the path an unpicked Gift chassis takes into the build:
 * authored in the app, exported, folded here, shipped to every DM. The DM's only local choice
 * stays the form they pick when handing it over, which lives on the actor's copy.
 */
export const BROKEN_CHAIN_EQUIPMENT_LIBRARY: EquipmentItem[] =
  mergeAuthored(BUNDLED_EQUIPMENT_LIBRARY, AUTHORED_EQUIPMENT, i => i.id);
