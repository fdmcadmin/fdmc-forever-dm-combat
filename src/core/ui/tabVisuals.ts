/**
 * Character-sheet tab visual language (P-UX1)
 *
 * Each tab in the character sheet / creator gets a distinct color accent so the
 * sheet stops reading as a row of same-weight buttons. Count badges and empty
 * states are driven from the same place.
 *
 * Pure module (no React) — safe to import in any component.
 */

import type { TabId } from "../types/tabs";

export type TabVisual = {
  /** Accent color used for the active underline, badge, and selected text. */
  accent: string;
  /** Short helper line shown as an empty-state hint when the tab has 0 items. */
  emptyHint: string;
};

// Accent palette is intentionally separate from the seat palette so a player's
// seat color never collides with a tab accent.
export const TAB_VISUALS: Record<TabId, TabVisual> = {
  main:       { accent: "#ff6b5e", emptyHint: "No actions yet — add an attack or ability." },
  bonus:      { accent: "#ffb02e", emptyHint: "No bonus actions yet." },
  spells:     { accent: "#7b9dff", emptyHint: "No spells prepared yet." },
  bond:       { accent: "#e07bff", emptyHint: "No bonds or additives yet." },
  checks:     { accent: "#2dd4bf", emptyHint: "No checks yet." },
  features:   { accent: "#34c759", emptyHint: "No class actions or features yet." },
  feats:      { accent: "#b388ff", emptyHint: "No feats yet." },
  status:     { accent: "#9be9a8", emptyHint: "No status trackers yet." },
  equipment:  { accent: "#c0a062", emptyHint: "No equipment yet." },
  resources:  { accent: "#46c2c2", emptyHint: "No resource pools yet." },
  outOfCombat:{ accent: "#8a8aa0", emptyHint: "No out-of-combat actions yet." },
  notes:      { accent: "#a0a0b0", emptyHint: "No notes yet." },
};

/** Accent for a tab, with a safe neutral fallback. */
export function tabAccent(tabId: TabId): string {
  return TAB_VISUALS[tabId]?.accent ?? "#7b68ee";
}

export function tabEmptyHint(tabId: TabId): string {
  return TAB_VISUALS[tabId]?.emptyHint ?? "Nothing here yet.";
}
