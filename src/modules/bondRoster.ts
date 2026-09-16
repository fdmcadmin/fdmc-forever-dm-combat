/**
 * WHICH BONDS THIS INSTALL RUNS — the one place that names them for the engine.
 *
 * ⚠ THIS FILE IS THE MOD LAYER, NOT THE ENGINE, and it is the twin of `equipRuleRoster` and
 * `monsterSourceRoster`. A creature can carry a bond (`MainMonsterTemplate.bond` — the Elemental
 * Mirrors are built with one), and the engine that materializes a body has to be able to turn that
 * assignment into rows. It must not do so by naming a bond: the fourteen stay in the mod (RULE 3).
 *
 * Swapping this roster is the whole cost of running a different bond set.
 */
import type { BondTemplate } from "../core/types/bond";
import { BROKEN_CHAIN_BOND_TEMPLATES } from "./the-broken-chain/content/bondTemplates";

export const ACTIVE_BOND_TEMPLATES: readonly BondTemplate[] = BROKEN_CHAIN_BOND_TEMPLATES;
