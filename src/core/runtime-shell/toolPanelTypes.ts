export type ToolPanelId =
  | "actorAssignments"
  | "editActors"
  | "equipmentImport"
  | "monsterPanel"
  | "roomMaintenance"
  | "encounterCleanup"
  | "monsterCard"
  | null;

export type ToolPanelMode = "drawer" | "modal";

export const TOOL_PANEL_TITLES: Record<Exclude<ToolPanelId, null>, string> = {
  actorAssignments: "Actor Assignments",
  editActors: "Edit Actors",
  equipmentImport: "Equipment Import",
  monsterPanel: "Monster Panel",
  roomMaintenance: "Room Maintenance",
  encounterCleanup: "Encounter Cleanup",
  monsterCard: "Monster Card",
};

export function getToolPanelTitle(panelId: ToolPanelId): string {
  return panelId ? TOOL_PANEL_TITLES[panelId] : "DM Tools";
}
