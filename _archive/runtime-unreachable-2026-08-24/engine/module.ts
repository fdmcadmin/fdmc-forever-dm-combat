import type { Actor } from "./actor";
import type { TabId } from "./tabs";
import type { CombatRulesProfile } from "./committedRoll";

export type CombatModuleFeatures = {
  bondSystem: boolean;
  actThemes: boolean;
  inspectCards: boolean;
  wardConvergence: boolean;
};

export type CombatModule = {
  schema: string;
  id: string;
  name: string;
  version: string;
  activeAct: number;
  features: CombatModuleFeatures;
  rulesProfile?: CombatRulesProfile;
  themes: Record<string, string>;
  defaultTabs: {
    player: TabId[];
    boss: string[];
  };
  actors: Actor[];
};
