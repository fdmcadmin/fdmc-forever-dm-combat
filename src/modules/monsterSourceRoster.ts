/**
 * WHICH MODS SUPPLY REFERENCE CREATURES — the one place that names them.
 *
 * ⚠ THIS FILE IS THE MOD LAYER, NOT THE ENGINE, and it is the twin of `equipRuleRoster`. Something
 * has to know that this install ships D&D 5e's SRD as system-scope reference content, and it must
 * not be `core/`: `resolveMonsterLibrary` composes SOURCES and has no opinion about rulesets.
 * Swapping this roster is the whole cost of running a different system.
 *
 * ⚠ SYSTEM SCOPE IS CARRIED BY THE RECORDS, NOT ENFORCED HERE. Every template below holds the SRD
 * provenance, so `chassisSources` and `exportableRecords` refuse them in the DATA MODEL — a picker
 * is handed a list that never contained them. That is the design's own requirement: *"implemented
 * in the data model, not just by hiding buttons."*
 */

import type { MainMonsterTemplate } from "../core/monsters/runtime/mainMonsterRuntime";
import { SRD_TEMPLATES } from "./dnd-5e/srdToTemplate";

/**
 * Reference creatures a DM may put in a fight but may never author against.
 *
 * These reach the Encounter Builder, the Estimator and creature search because all three resolve
 * through one function. Before this existed they reached NOTHING — 330 parsed creatures with no
 * consumer, which is the largest instance of the wiring fault MASTER records.
 */
export const SYSTEM_MONSTER_TEMPLATES: readonly MainMonsterTemplate[] = SRD_TEMPLATES;
