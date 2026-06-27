/**
 * savePrompt — a room-wide "make this saving throw" pop-up.
 *
 * When an action forces a save (a save spell on cast, or an attack's rider save after
 * its damage), the source card broadcasts a SavePrompt. Every client shows a dismissible
 * banner so the table can't miss who must roll and at what DC. The shared combat log still
 * records the call too; this is just the prominent on-screen nudge.
 */

import { useEffect, useState } from "react";
import OBR from "@owlbear-rodeo/sdk";

export const FDMC_SAVE_PROMPT_CHANNEL = "forever-dm-combat:save-prompt:v1";

export type SavePrompt = {
  id: string;
  source: string;     // who forced the save (caster / monster)
  action: string;     // the action/spell name
  save: string;       // the save text, e.g. "DEX DC 15"
  targets?: string[]; // chosen combatants; empty/undefined = "each target"
};

export function broadcastSavePrompt(source: string, action: string, save: string, targets?: string[]): void {
  const cleanSave = save?.trim();
  if (!OBR.isAvailable || !cleanSave) return;
  const prompt: SavePrompt = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    source,
    action,
    save: cleanSave,
    targets: targets && targets.length > 0 ? targets : undefined,
  };
  void OBR.broadcast.sendMessage(FDMC_SAVE_PROMPT_CHANNEL, prompt, { destination: "ALL" }).catch(() => undefined);
}

/** Listen for save prompts; returns the current one (auto-clears after 14s) + a manual dismiss. */
export function useSavePrompt(): { prompt: SavePrompt | null; dismiss: () => void } {
  const [prompt, setPrompt] = useState<SavePrompt | null>(null);

  useEffect(() => {
    if (!OBR.isAvailable) return;
    return OBR.broadcast.onMessage(FDMC_SAVE_PROMPT_CHANNEL, (event) => {
      const incoming = event.data as Partial<SavePrompt> | undefined;
      if (!incoming || typeof incoming.save !== "string" || !incoming.id) return;
      const next = incoming as SavePrompt;
      setPrompt(next);
      window.setTimeout(() => setPrompt((cur) => (cur?.id === next.id ? null : cur)), 14000);
    });
  }, []);

  return { prompt, dismiss: () => setPrompt(null) };
}
