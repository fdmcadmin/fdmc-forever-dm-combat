import { normalizeMonsterJcon } from "./monsterNormalize";
import { sampleMonsterJcons, type SampleMonsterKey } from "./sampleMonsterJcons";
import type { MonsterVisibilityMode } from "../types/monsterTypes";
import type { SundayMonsterEncounterSet, SundayMonsterInstance, SundayMonsterRuntimeState, SundayMonsterTemplate } from "./SundayMonsterStateContract";

const ENCOUNTERS: SundayMonsterEncounterSet[] = [
  {
    encounterId: "act2-s1-e1-hollow-pack",
    label: "Act 2 S1 E1 — Hollow Pack",
    sessionLabel: "Act 2 Session 1",
    description: "Pale Stalker + 2 Pack Hunters.",
    templateEntries: [
      { templateId: "act2S1PaleStalker", count: 1 },
      { templateId: "act2S1PackHunter", count: 2 },
    ],
  },
  {
    encounterId: "act2-s1-e2-frozen-hollow",
    label: "Act 2 S1 E2 — Frozen Hollow",
    sessionLabel: "Act 2 Session 1",
    description: "Icebound Zombie + Ghoul + Hollow Mourner.",
    templateEntries: [
      { templateId: "act2S1IceboundZombie", count: 1 },
      { templateId: "act2S1Ghoul", count: 1 },
      { templateId: "act2S1HollowMourner", count: 1 },
    ],
  },
  {
    encounterId: "act2-s2-e1-corrupted-hunters",
    label: "Act 2 S2 E1 — Corrupted Hunters",
    sessionLabel: "Act 2 Session 2",
    description: "2 Corrupted Hunters.",
    templateEntries: [
      { templateId: "act2S2CorruptedHunter", count: 2 },
    ],
  },
  {
    encounterId: "act2-s2-e2-last-directive",
    label: "Act 2 S2 E2 — Last Directive",
    sessionLabel: "Act 2 Session 2",
    description: "Soul-Gorged Guardian + 3 Grave Lights.",
    templateEntries: [
      { templateId: "act2S2SoulGorgedGuardian", count: 1 },
      { templateId: "act2S2GraveLight", count: 3 },
    ],
  },
];

const SUNDAY_TEMPLATE_KEYS: SampleMonsterKey[] = [
  "mirageStalker",
  "act2S1PaleStalker",
  "act2S1PackHunter",
  "act2S1IceboundZombie",
  "act2S1Ghoul",
  "act2S1HollowMourner",
  "act2S2CorruptedHunter",
  "act2S2SoulGorgedGuardian",
  "act2S2GraveLight",
];

function makeTemplate(templateId: SampleMonsterKey): SundayMonsterTemplate {
  const monster = normalizeMonsterJcon(sampleMonsterJcons[templateId]).monster;
  return {
    templateId,
    name: monster.name,
    subtitle: monster.subtitle,
    moduleId: monster.campaignModule ?? "the-broken-chain",
    encounterId: monster.tags.find((tag) => tag.startsWith("act-")) ?? "the-broken-chain",
    tags: monster.tags,
    monster,
  };
}

export const theBrokenChainSundayMonsterTemplates = SUNDAY_TEMPLATE_KEYS.map(makeTemplate);
export const theBrokenChainSundayEncounterSets = ENCOUNTERS;

function makeInstance(template: SundayMonsterTemplate, encounterId: string, index: number, visibilityMode: MonsterVisibilityMode = "hp-bar"): SundayMonsterInstance {
  const duplicateSuffix = index > 1 ? ` ${index}` : "";
  return {
    instanceId: `${encounterId}:${template.templateId}:${index}`,
    templateId: template.templateId,
    encounterId,
    displayName: `${template.name}${duplicateSuffix}`,
    monster: template.monster,
    hp: {
      current: template.monster.defense.hp.current,
      max: template.monster.defense.hp.max,
      temp: template.monster.defense.hp.temp,
    },
    visibilityMode,
    revealed: true,
    active: false,
    actionState: {},
  };
}

export function makeSundayMonsterRuntimeState(encounterId: string = "act2-s1-e1-hollow-pack"): SundayMonsterRuntimeState {
  const encounter = ENCOUNTERS.find((set) => set.encounterId === encounterId) ?? ENCOUNTERS[0];
  const monsters: SundayMonsterInstance[] = [];

  encounter.templateEntries.forEach((entry) => {
    const template = theBrokenChainSundayMonsterTemplates.find((candidate) => candidate.templateId === entry.templateId);
    if (!template) return;

    for (let index = 1; index <= entry.count; index += 1) {
      monsters.push(makeInstance(template, encounter.encounterId, index));
    }
  });

  const activeMonsterInstanceId = monsters[0]?.instanceId ?? null;

  return {
    schema: "fdmc.sunday.monster-runtime.v1",
    updatedAt: new Date().toISOString(),
    updatedBy: "system",
    syncVersion: 1,
    selectedEncounterId: encounter.encounterId,
    activeMonsterInstanceId,
    templates: theBrokenChainSundayMonsterTemplates,
    encounterSets: ENCOUNTERS,
    monsters: monsters.map((monster) => ({
      ...monster,
      active: monster.instanceId === activeMonsterInstanceId,
    })),
  };
}
