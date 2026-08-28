/**
 * WHICH MODS ARE ON — the one place that names them.
 *
 * ⚠ THIS FILE IS THE MOD LAYER, NOT THE ENGINE. Something has to know that this install runs D&D 5e
 * with the Broken Chain on top, and it must not be `core/`: `core/equipment/equipRules.ts` names no
 * ruleset and no cap, so swapping this roster is the whole cost of running a different system.
 *
 * ORDER IS THE ORDER THE PLAYER IS TOLD ABOUT. Attunement first because it is the cap a 5e player
 * already expects and can reason about; the campaign's own limit second. An item that trips both
 * reports the familiar one.
 *
 * When mods become selectable at runtime this becomes a lookup rather than a constant. It is a
 * constant today because there is exactly one combination, and inventing a registry for a list of
 * two would be machinery with nothing to choose between.
 */

import type { EquipRule } from "../core/equipment/equipRules";
import { attunementRule } from "./dnd-5e/attunementRule";
import { singularRule } from "./the-broken-chain/singularRule";

export const ACTIVE_EQUIP_RULES: readonly EquipRule[] = [attunementRule, singularRule];
