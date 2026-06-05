import type { ActionCost } from "./actionEconomy";
import type { TabId } from "./tabs";

export type CombatLogEntryTone = "combat" | "table-note" | "system";

export type CombatLogEntry = {
  id: string;
  actorName: string;
  actionName: string;
  message: string;
  rollResult?: string;
  timestamp: string;
  tabId?: TabId | "pinned" | "system";
  actionCosts?: ActionCost[];
  pendingKey?: string;
  tone?: CombatLogEntryTone;
};

export type AddCombatLogEntryInput = {
  actorName: string;
  actionName: string;
  message?: string;
  rollResult?: string;
  tabId?: TabId | "pinned" | "system";
  actionCosts?: ActionCost[];
  pendingKey?: string;
  supersedePendingKeys?: string[];
  tone?: CombatLogEntryTone;
};
