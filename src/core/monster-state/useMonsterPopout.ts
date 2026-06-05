import { useEffect, useState } from "react";
import OBR from "@owlbear-rodeo/sdk";
import { getMonsterFromRoster, saveMonsterRoster, loadMonsterRoster } from "../monsters/runtime/monsterRosterStorage";
import type { MainEncounterMonsterInstance } from "../monsters/runtime/mainMonsterRuntime";

// Channel for popout → main window HP sync
export const MONSTER_POPOUT_HP_CHANNEL = "fdmc:monster-popout-hp:v1";

// Monster popout reads from DM localStorage only — no room metadata.
// HP changes write back to localStorage so the main window can reload on next interaction.

export type MonsterPopoutState = {
  monster: MainEncounterMonsterInstance | null;
  isLoaded: boolean;
  commitHp: (hp: { current: number; max: number; temp: number }) => void;
};

export function useMonsterPopout(instanceId: string): MonsterPopoutState {
  const [monster, setMonster] = useState<MainEncounterMonsterInstance | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!instanceId) return;
    setMonster(getMonsterFromRoster(instanceId) ?? null);
    setIsLoaded(true);
  }, [instanceId]);

  function commitHp(hp: { current: number; max: number; temp: number }) {
    const roster = loadMonsterRoster();
    const next = roster.map(m =>
      m.instanceId === instanceId
        ? { ...m, currentHp: hp.current, maxHp: hp.max, tempHp: hp.temp, hp: `${hp.current}/${hp.max}` }
        : m
    );
    saveMonsterRoster(next);
    setMonster(prev => prev ? { ...prev, currentHp: hp.current, maxHp: hp.max, tempHp: hp.temp, hp: `${hp.current}/${hp.max}` } : prev);
    // Notify main window to re-sync monsterCandidates and re-broadcast to players
    if (OBR.isAvailable) {
      void OBR.broadcast.sendMessage(
        MONSTER_POPOUT_HP_CHANNEL,
        { type: "fdmc:monster-popout-hp", instanceId, currentHp: hp.current, maxHp: hp.max, tempHp: hp.temp },
        { destination: "LOCAL" },
      ).catch(() => undefined);
    }
  }

  return { monster, isLoaded, commitHp };
}
