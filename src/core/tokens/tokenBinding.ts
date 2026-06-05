/**
 * P6 — Token Binding
 *
 * Binds an OBR map token to a FDMC seat/actor or monster instance.
 * Binding lives on the token metadata — never in room metadata.
 * Token deletion does not affect actor card access.
 * Only DM writes bindings. Players never see raw binding data.
 */

import OBR, { type Item } from "@owlbear-rodeo/sdk";

// ─── Types ────────────────────────────────────────────────────────────────────

export const FDMC_TOKEN_BINDING_KEY = "fdmc.token.binding.v1";

export type FdmcTokenBinding = {
  version: 1;
  tableId: string;          // must match current room tableId — safety guard
  bindingType: "seat" | "monster";
  seatId?: string;          // if bindingType === "seat"
  actorId?: string;         // if bindingType === "seat"
  instanceId?: string;      // if bindingType === "monster"
  actorType: "player" | "companion" | "monster" | "npc" | "boss";
  boundBy: "gm";
  boundAt: number;          // unix ms timestamp
  allowPlayerMove: boolean;
};

// ─── Read ─────────────────────────────────────────────────────────────────────

export function readTokenBinding(item: Item): FdmcTokenBinding | undefined {
  const raw = (item.metadata as Record<string, unknown>)[FDMC_TOKEN_BINDING_KEY];
  if (!raw || typeof raw !== "object") return undefined;
  const b = raw as Partial<FdmcTokenBinding>;
  if (b.version !== 1 || !b.bindingType || !b.tableId) return undefined;
  return b as FdmcTokenBinding;
}

// ─── Safety guard ─────────────────────────────────────────────────────────────

export function validateTokenBinding(binding: FdmcTokenBinding, currentTableId: string): boolean {
  return binding.tableId === currentTableId && binding.version === 1;
}

// ─── Write ────────────────────────────────────────────────────────────────────

export async function writeTokenBinding(itemId: string, binding: FdmcTokenBinding): Promise<void> {
  if (!OBR.isAvailable) return;
  await OBR.scene.items.updateItems([itemId], items => {
    for (const item of items) {
      item.metadata[FDMC_TOKEN_BINDING_KEY] = binding;
    }
  });
}

export async function clearTokenBinding(itemId: string): Promise<void> {
  if (!OBR.isAvailable) return;
  await OBR.scene.items.updateItems([itemId], items => {
    for (const item of items) {
      delete item.metadata[FDMC_TOKEN_BINDING_KEY];
    }
  });
}

// ─── Lock helpers ─────────────────────────────────────────────────────────────

export async function lockToken(itemId: string): Promise<void> {
  if (!OBR.isAvailable) return;
  await OBR.scene.items.updateItems([itemId], items => {
    for (const item of items) { item.locked = true; }
  });
}

export async function unlockToken(itemId: string): Promise<void> {
  if (!OBR.isAvailable) return;
  await OBR.scene.items.updateItems([itemId], items => {
    for (const item of items) { item.locked = false; }
  });
}

export async function lockAllTokens(): Promise<void> {
  if (!OBR.isAvailable) return;
  const items = await OBR.scene.items.getItems<Item>();
  const ids = items.map((i: Item) => i.id);
  if (ids.length === 0) return;
  await OBR.scene.items.updateItems(ids, items => {
    for (const item of items) { item.locked = true; }
  });
}

// ─── Get selected items ───────────────────────────────────────────────────────

export async function getSelectedItems(): Promise<Item[]> {
  if (!OBR.isAvailable) return [];
  try {
    const selected = await OBR.player.getSelection();
    if (!selected || selected.length === 0) return [];
    return await OBR.scene.items.getItems<Item>(selected);
  } catch {
    return [];
  }
}
