/**
 * P8 — Post-Combat Summary Generator + Export
 */

import type { EncounterLogEntry } from "../events/encounterLog";

export type PostCombatSummary = {
  encounterId: string;
  encounterName: string;
  completedAt: string;
  rounds: number;
  bossKillShot?: {
    actorId: string;
    actorName: string;
    actionCode: string;
    actionName: string;
    round: number;
    damageDealt: number;
  };
  damageDealt: Array<{ actorId: string; actorName: string; total: number }>;
  damageTaken: Array<{ actorId: string; actorName: string; total: number }>;
  resourcesUsed: Array<{ actorId: string; actorName: string; count: number }>;
  fullLog: EncounterLogEntry[];
};

export function generatePostCombatSummary(
  log: EncounterLogEntry[],
  encounterId: string,
  encounterName: string,
): PostCombatSummary {
  const rounds = log.reduce((max, e) => Math.max(max, e.round), 0);

  // Damage dealt by actors (roll-damage entries where actorId is an actor)
  const damageByActor: Record<string, { actorId: string; actorName: string; total: number }> = {};
  const damageTakenByActor: Record<string, { actorId: string; actorName: string; total: number }> = {};
  const resourcesByActor: Record<string, { actorId: string; actorName: string; count: number }> = {};

  let bossKillShot: PostCombatSummary["bossKillShot"] | undefined;

  for (const entry of log) {
    if (entry.type === "roll-damage" && entry.val > 0) {
      if (!damageByActor[entry.actorId]) damageByActor[entry.actorId] = { actorId: entry.actorId, actorName: entry.actorName, total: 0 };
      damageByActor[entry.actorId].total += entry.val;
    }
    if (entry.type === "hp-change" && entry.val < 0 && entry.targetId) {
      const key = entry.targetId;
      const name = entry.targetName ?? entry.targetId;
      if (!damageTakenByActor[key]) damageTakenByActor[key] = { actorId: key, actorName: name, total: 0 };
      damageTakenByActor[key].total += Math.abs(entry.val);
    }
    if ((entry.type === "roll-attack" || entry.type === "roll-damage") && entry.actorId) {
      if (!resourcesByActor[entry.actorId]) resourcesByActor[entry.actorId] = { actorId: entry.actorId, actorName: entry.actorName, count: 0 };
      resourcesByActor[entry.actorId].count += 1;
    }
    if (entry.type === "boss-killed" && !bossKillShot) {
      // Find the last damage entry by the killing actor in the same round
      const killEntry = log.find(e => e.type === "roll-damage" && e.round === entry.round && e.actorId === entry.actorId);
      bossKillShot = {
        actorId: entry.actorId,
        actorName: entry.actorName,
        actionCode: entry.code,
        actionName: entry.message,
        round: entry.round,
        damageDealt: killEntry?.val ?? entry.val,
      };
    }
  }

  return {
    encounterId,
    encounterName,
    completedAt: new Date().toLocaleString(),
    rounds,
    bossKillShot,
    damageDealt: Object.values(damageByActor).sort((a, b) => b.total - a.total),
    damageTaken: Object.values(damageTakenByActor).sort((a, b) => b.total - a.total),
    resourcesUsed: Object.values(resourcesByActor).sort((a, b) => b.count - a.count),
    fullLog: log,
  };
}

export function exportSummaryAsText(summary: PostCombatSummary): string {
  const lines: string[] = [
    `=== The Broken Chain — ${summary.encounterName} ===`,
    `Completed: Round ${summary.rounds}  |  ${summary.completedAt}`,
    "",
  ];

  if (summary.bossKillShot) {
    const k = summary.bossKillShot;
    lines.push(`KILL SHOT: ${k.actorName} — ${k.actionName} [Round ${k.round}] — ${k.damageDealt} damage`, "");
  }

  if (summary.damageDealt.length > 0) {
    lines.push("TOP DAMAGE DEALT");
    summary.damageDealt.forEach((d, i) => lines.push(`  ${i + 1}. ${d.actorName.padEnd(16)} ${d.total}`));
    lines.push("");
  }

  if (summary.damageTaken.length > 0) {
    lines.push("MOST DAMAGE TAKEN");
    summary.damageTaken.forEach((d, i) => lines.push(`  ${i + 1}. ${d.actorName.padEnd(16)} ${d.total}`));
    lines.push("");
  }

  if (summary.resourcesUsed.length > 0) {
    lines.push("MOST RESOURCES USED");
    summary.resourcesUsed.forEach((r, i) => lines.push(`  ${i + 1}. ${r.actorName.padEnd(16)} ${r.count} actions`));
    lines.push("");
  }

  return lines.join("\n");
}

export function exportSummaryAsJson(summary: PostCombatSummary): string {
  return JSON.stringify(summary, null, 2);
}

export function downloadExport(content: string, filename: string, mimeType = "text/plain"): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
