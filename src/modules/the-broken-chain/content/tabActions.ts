import type { ActorAction, TabActionMap } from "../../../core/types/tabs";
import { check, passiveEquipment, utility, referenceUtility } from "../actors/actorHelpers";

const playerChecks: ActorAction[] = [
  check("Perception", "Roll Perception from the sheet.", "Ability Checks"),
  check("Survival", "Roll Survival from the sheet.", "Ability Checks"),
  check("Stealth", "Roll Stealth from the sheet.", "Ability Checks"),
  check("Grapple", "Common combat check; resolve from the sheet/table rule.", "Combat Checks"),
  check("Shove", "Common combat check; resolve from the sheet/table rule.", "Combat Checks"),
  check("Escape Grapple", "Common combat check; resolve from the sheet/table rule.", "Combat Checks"),
  check("Hide", "Common combat check; resolve from the sheet/table rule.", "Combat Checks"),
];

const equipment: ActorAction[] = [
  passiveEquipment("basic-gear", "Gear Reference", "Reference-only equipment. Add a defined use action before it logs to combat."),
];

const outOfCombat: ActorAction[] = [
  utility("short-rest", "Short Rest", "Out-of-combat reminder only. No rest automation in BUILD 0.4.0b."),
  referenceUtility("long-rest", "Long Rest", "Out-of-combat reminder only. No rest automation in BUILD 0.4.0b."),
];

export const companionChecks: ActorAction[] = [
  check("Perception", "Roll Perception from the companion profile.", "Ability Checks"),
  check("Survival", "Roll Survival/tracking from the companion profile.", "Ability Checks"),
  check("Stealth", "Roll Stealth from the companion profile.", "Ability Checks"),
];

export function createPlayerTabs(options: {
  main: ActorAction[];
  bonus?: ActorAction[];
  spells?: ActorAction[];
  bond: ActorAction[];
  checksOverride?: ActorAction[];
  featuresOverride?: ActorAction[];
  equipmentOverride?: ActorAction[];
  resourcesOverride?: ActorAction[];
  outOfCombatOverride?: ActorAction[];
  notesOverride?: ActorAction[];
}): TabActionMap {
  return {
    main: options.main,
    bonus: options.bonus ?? [],
    spells: options.spells ?? [],
    bond: options.bond,
    checks: options.checksOverride ?? playerChecks,
    features: options.featuresOverride ?? [],
    status: [],
    equipment: options.equipmentOverride ?? equipment,
    resources: options.resourcesOverride ?? [],
    outOfCombat: options.outOfCombatOverride ?? outOfCombat,
    notes: options.notesOverride ?? [],
  };
}
