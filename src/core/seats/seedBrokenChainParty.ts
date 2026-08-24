/**
 * seedBrokenChainParty
 *
 * One-time import of the Broken Chain party actors from bundled source files.
 * Reads the compiled actor objects, validates all action paths, extracts
 * equipment to the equipment library, and writes to the DM actor library.
 *
 * Called from the "Import Party" button — only shows when library is empty.
 * In P4 this runs automatically in dev mode; in live it stays as a manual button.
 */

import type { Actor } from "../types/actor";
import type { ActorAction } from "../types/tabs";
import type { EquipmentItem } from "../ui/EquipmentBagEditor";
import { loadEquipmentLibrary, saveEquipmentLibrary } from "../ui/EquipmentBagEditor";
import { saveActorLibrary } from "./dmActorLibrary";
import { safeStorage } from "../utils/safeStorage";

// ─── Action validation — fix any broken roll paths ────────────────────────────

function validateAndFixAction(action: ActorAction, _actorName: string): { action: ActorAction; issues: string[] } {
  const issues: string[] = [];
  const fixed = { ...action };

  // Check: bond actions must have actionKind "bond" and economyCost ["bond"]
  if (action.economyCost?.includes("bond") && action.actionKind !== "bond") {
    fixed.actionKind = "bond";
    issues.push(`${action.label}: set actionKind to "bond"`);
  }

  // Check: spell actions should have actionKind "spell"
  if (action.metadata?.slotCost && action.actionKind !== "spell" && action.actionKind !== "bond" && action.actionKind !== "equipment") {
    fixed.actionKind = "spell";
    issues.push(`${action.label}: set actionKind to "spell"`);
  }

  // Check: attack actions with roll formula should have actionKind "attack"
  if (action.metadata?.attack && action.actionKind !== "attack" && action.actionKind !== "spell" && action.actionKind !== "bond" && action.actionKind !== "check") {
    fixed.actionKind = "attack";
    issues.push(`${action.label}: set actionKind to "attack"`);
  }

  // Check: check actions with formula in metadata.attack should have actionKind "check"
  if (action.actionKind === "check" && action.metadata?.attack && !action.metadata.attack.includes("d")) {
    // Check formula like "[1d20+5]" — strip brackets if present
    const cleaned = action.metadata.attack.replace(/^\[|\]$/g, "");
    if (cleaned !== action.metadata.attack) {
      fixed.metadata = { ...action.metadata, attack: cleaned };
      issues.push(`${action.label}: stripped brackets from check formula`);
    }
  }

  // Check: actions with damage but no outcome mode hint — set logMode if silent
  if (action.metadata?.damage && !action.metadata?.attack && action.logMode !== "silent" && action.actionKind === "bond") {
    // Bond actions with damage are triggered — correct
  }

  // Check: reference-only actions (logMode silent, no costs) should not have roll buttons
  // This is handled by TabPanel — no fix needed here

  return { action: fixed, issues };
}

function validateActorActions(actor: Actor): { actor: Actor; allIssues: string[] } {
  const allIssues: string[] = [];
  const fixedTabs = { ...actor.tabs };

  for (const [tabId, actions] of Object.entries(actor.tabs)) {
    if (!Array.isArray(actions)) continue;
    const fixedActions: ActorAction[] = [];
    for (const action of actions) {
      const { action: fixed, issues } = validateAndFixAction(action, actor.name);
      fixedActions.push(fixed);
      allIssues.push(...issues.map(i => `[${actor.name}/${tabId}] ${i}`));
    }
    fixedTabs[tabId as keyof typeof actor.tabs] = fixedActions;
  }

  return { actor: { ...actor, tabs: fixedTabs }, allIssues };
}

// ─── Equipment extraction ─────────────────────────────────────────────────────

function extractEquipmentItems(actor: Actor): EquipmentItem[] {
  const equipmentActions = actor.tabs.equipment ?? [];
  return equipmentActions
    .filter(a => a.actionKind === "equipment" || a.id.startsWith("equip-"))
    .map(action => {
      const itemId = action.id.replace("equip-", "").replace(/-[a-z0-9]{4,}$/, "") || action.id;
      return {
        id: `bc-equip-${itemId}`,
        name: action.label,
        type: (action.hasDefinedUse ? "gear" : "gear") as EquipmentItem["type"],
        description: action.description ?? action.metadata?.details ?? "",
        isUsable: Boolean(action.hasDefinedUse),
        attack: action.metadata?.attack,
        damage: action.metadata?.damage,
        crit: action.metadata?.crit,
        range: action.metadata?.range,
      } as EquipmentItem;
    });
}

// ─── Campaign bag ─────────────────────────────────────────────────────────────

const CAMPAIGN_BAG_KEY = "fdmc.campaign.bag.v1";

export type CampaignBagItem = {
  id: string;
  item: EquipmentItem;
  addedAt: string;
  fromActor?: string;
};

export function loadCampaignBag(): CampaignBagItem[] {
  try {
    const raw = safeStorage().getItem(CAMPAIGN_BAG_KEY);
    return raw ? JSON.parse(raw) as CampaignBagItem[] : [];
  } catch { return []; }
}

export function saveCampaignBag(bag: CampaignBagItem[]): void {
  try { safeStorage().setItem(CAMPAIGN_BAG_KEY, JSON.stringify(bag)); } catch { /* ok */ }
}

export function addItemToCampaignBag(item: EquipmentItem, fromActor?: string): void {
  const bag = loadCampaignBag();
  if (!bag.find(b => b.item.id === item.id)) {
    bag.push({ id: `bag-${Date.now().toString(36)}`, item, addedAt: new Date().toISOString(), fromActor });
    saveCampaignBag(bag);
  }
}

export function removeItemFromCampaignBag(bagItemId: string): void {
  saveCampaignBag(loadCampaignBag().filter(b => b.id !== bagItemId));
}

// ─── Main seed function ───────────────────────────────────────────────────────

export type SeedResult = {
  actorsCreated: string[];
  equipmentItemsCreated: number;
  validationFixes: string[];
  warnings: string[];
};

export function seedBrokenChainParty(bundledActors: Actor[]): SeedResult {
  const result: SeedResult = {
    actorsCreated: [],
    equipmentItemsCreated: 0,
    validationFixes: [],
    warnings: [],
  };

  if (bundledActors.length === 0) {
    result.warnings.push("No bundled actors provided. Source files may be empty.");
    return result;
  }

  const library: Record<string, Actor> = {};
  const equipmentLibrary = loadEquipmentLibrary();
  const newEquipmentIds = new Set(equipmentLibrary.map(e => e.id));

  for (const rawActor of bundledActors) {
    // Pass 1: validate and fix all action paths
    const { actor: validatedActor, allIssues } = validateActorActions(rawActor);
    result.validationFixes.push(...allIssues);

    // Pass 2: extract equipment to equipment library
    const equipmentItems = extractEquipmentItems(validatedActor);
    for (const item of equipmentItems) {
      if (!newEquipmentIds.has(item.id)) {
        equipmentLibrary.push(item);
        newEquipmentIds.add(item.id);
        result.equipmentItemsCreated++;
      }
    }

    // Store actor — equipment tab kept as-is (bag editor handles it)
    library[validatedActor.id] = validatedActor;
    result.actorsCreated.push(validatedActor.name);
  }

  // Write both libraries
  saveActorLibrary(library);
  if (result.equipmentItemsCreated > 0) {
    saveEquipmentLibrary(equipmentLibrary);
  }

  return result;
}
