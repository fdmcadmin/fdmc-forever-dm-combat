/**
 * WHAT THE OVERLAY DOES TO A CHARACTER'S EQUIPMENT — the pure half, on its own.
 *
 * ⚠ THIS LIVES IN ITS OWN LEAF FILE ON PURPOSE, the same reason `rerollMethod` does. It was
 * declared in `useEquippedState`, which imports the Owlbear SDK — and the SDK reads `window` at
 * import time, so anything pulling this in headlessly (a gate, a script, the packaged engine)
 * crashed with "window is not defined" before reaching a single assertion. The rule is pure; only
 * the syncing needs a browser.
 *
 * `useEquippedState` re-exports it, so every existing caller is unchanged.
 */

/** actorId → (equipment action id → worn). */
export type EquippedMap = Record<string, Record<string, boolean>>;

/**
 * Apply the overlay to a character's equipment tab.
 *
 * Pure, so the card, the stat derivation and the attack gating share one answer about what is worn.
 * An item with no entry is left exactly as the document wrote it.
 */
export function applyEquippedOverlay<T extends { id: string; metadata?: { equipped?: boolean } }>(
  items: T[],
  overlay: Record<string, boolean> | undefined,
): T[] {
  if (!overlay || Object.keys(overlay).length === 0) return items;
  return items.map(item => {
    const worn = overlay[item.id];
    return worn === undefined ? item : { ...item, metadata: { ...item.metadata, equipped: worn } };
  });
}
