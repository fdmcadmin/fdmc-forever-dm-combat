import { useMemo, useState } from "react";
import type { MonsterAbilityId } from "../types/monsterTypes";
import { FormulaInput } from "./FormulaInput";

type MonsterLevelBandId = "low" | "mid" | "high" | "extreme" | "final";
type MonsterBuildMode = "guided" | "custom";
type MonsterPressureId = "standard" | "strong" | "elite" | "bossGate";
type MonsterBuilderPurpose = "encounter" | "publication";
type ActionDraftCost = "Action" | "Bonus Action" | "Reaction" | "Legendary Action";
type ActionDraftKind = "attack" | "save" | "manual" | "special" | "trait-trigger";

type DraftMonsterJcon = Record<string, unknown>;

type DraftAction = {
  id: string;
  name: string;
  kind: ActionDraftKind | string;
  cost: ActionDraftCost;
  range?: string;
  attack?: string;
  save?: string;
  dc?: number | string;
  damage?: string;
  critDamage?: string;
  damageType?: string;
  attackCount?: number;
  attacks?: Array<{
    id: string;
    name: string;
    attack?: string;
    range?: string;
    damage?: string;
    critDamage?: string;
    damageType?: string;
    description?: string;
    hitRider?: {
      trigger?: string;
      condition?: string;
      save?: string;
      failEffect?: string;
      successEffect?: string;
    };
  }>;
  hitRider?: {
    trigger?: string;
    condition?: string;
    save?: string;
    failEffect?: string;
    successEffect?: string;
  };
  recharge?: string;
  uses?: string;
  description?: string;
  critThreshold?: number;
};

type DraftTrait = {
  id: string;
  name: string;
  description: string;
};

type DraftResource = {
  id: string;
  name: string;
  current?: number;
  max?: number;
  reset?: string;
  note?: string;
};

const abilityIds: MonsterAbilityId[] = ["str", "dex", "con", "int", "wis", "cha"];
const actionCosts: ActionDraftCost[] = ["Action", "Bonus Action", "Reaction", "Legendary Action"];
const actionKinds: ActionDraftKind[] = ["attack", "save", "manual", "special", "trait-trigger"];

const builderPurposeLabels: Record<MonsterBuilderPurpose, string> = {
  encounter: "Encounter test",
  publication: "Publication draft",
};

const builderPurposeNotes: Record<MonsterBuilderPurpose, string> = {
  encounter: "fast table-ready native JCON for Owlbear testing",
  publication: "Dev/Builder-only campaign production draft for The Broken Chain; rough estimate only, hidden from Beta/player-facing modes",
};

const abilityLabels: Record<MonsterAbilityId, string> = {
  str: "STR",
  dex: "DEX",
  con: "CON",
  int: "INT",
  wis: "WIS",
  cha: "CHA",
};

const abilityStyleLabels: Record<MonsterAbilityId, string> = {
  str: "STR bruiser / brute",
  dex: "DEX hunter / skirmisher",
  con: "CON endurance / guardian",
  int: "INT caster / tactician",
  wis: "WIS predator / mystic",
  cha: "CHA presence / commander",
};

const pressureLabels: Record<MonsterPressureId, string> = {
  standard: "Standard table",
  strong: "Strong party",
  elite: "Elite creature",
  bossGate: "Boss / gate phase",
};

const pressureNotes: Record<MonsterPressureId, string> = {
  standard: "baseline quick combat creature",
  strong: "stronger party, magic items, or favorable player action economy",
  elite: "mini-boss, dangerous solo, or sturdy named enemy",
  bossGate: "boss, phase wall, ritual gate, or set-piece endurance target",
};

type HpReference = {
  low: number;
  high: number | null;
  suggested: number;
};

type MonsterLevelBandInfo = {
  label: string;
  shortLabel: string;
  primary: number;
  secondary: number;
  floor: number;
  attackBonus: number;
  damage: string;
  critDamage: string;
  suggestedHp: number;
  suggestedAc: number;
  hpReferences: Record<MonsterPressureId, HpReference>;
};

const levelBands: Record<MonsterLevelBandId, MonsterLevelBandInfo> = {
  low: {
    label: "Low party level 1–4",
    shortLabel: "low 1–4",
    primary: 14,
    secondary: 12,
    floor: 8,
    attackBonus: 4,
    damage: "1d6 + 2",
    critDamage: "2d6 + 2",
    suggestedHp: 22,
    suggestedAc: 13,
    hpReferences: {
      standard: { low: 11, high: 35, suggested: 22 },
      strong: { low: 35, high: 55, suggested: 44 },
      elite: { low: 55, high: 75, suggested: 65 },
      bossGate: { low: 75, high: null, suggested: 90 },
    },
  },
  mid: {
    label: "Mid party level 5–8",
    shortLabel: "mid 5–8",
    primary: 16,
    secondary: 14,
    floor: 10,
    attackBonus: 6,
    damage: "2d6 + 3",
    critDamage: "4d6 + 3",
    suggestedHp: 65,
    suggestedAc: 15,
    hpReferences: {
      standard: { low: 45, high: 90, suggested: 65 },
      strong: { low: 90, high: 135, suggested: 110 },
      elite: { low: 135, high: 190, suggested: 160 },
      bossGate: { low: 190, high: null, suggested: 220 },
    },
  },
  high: {
    label: "High party level 9–12",
    shortLabel: "high 9–12",
    primary: 18,
    secondary: 16,
    floor: 10,
    attackBonus: 8,
    damage: "3d8 + 4",
    critDamage: "6d8 + 4",
    suggestedHp: 135,
    suggestedAc: 17,
    hpReferences: {
      standard: { low: 90, high: 160, suggested: 125 },
      strong: { low: 160, high: 235, suggested: 195 },
      elite: { low: 235, high: 320, suggested: 275 },
      bossGate: { low: 320, high: null, suggested: 360 },
    },
  },
  extreme: {
    label: "Extreme party level 13–16",
    shortLabel: "extreme 13–16",
    primary: 20,
    secondary: 18,
    floor: 12,
    attackBonus: 10,
    damage: "4d10 + 5",
    critDamage: "8d10 + 5",
    suggestedHp: 230,
    suggestedAc: 19,
    hpReferences: {
      standard: { low: 160, high: 260, suggested: 215 },
      strong: { low: 260, high: 380, suggested: 315 },
      elite: { low: 380, high: 520, suggested: 450 },
      bossGate: { low: 520, high: null, suggested: 600 },
    },
  },
  final: {
    label: "Final party level 17–20",
    shortLabel: "final 17–20",
    primary: 22,
    secondary: 20,
    floor: 12,
    attackBonus: 12,
    damage: "6d10 + 6",
    critDamage: "12d10 + 6",
    suggestedHp: 360,
    suggestedAc: 21,
    hpReferences: {
      standard: { low: 260, high: 420, suggested: 340 },
      strong: { low: 420, high: 650, suggested: 520 },
      elite: { low: 650, high: 900, suggested: 760 },
      bossGate: { low: 900, high: null, suggested: 1000 },
    },
  },
};

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "custom-monster";
}

function abilityModifier(score: number) {
  return Math.floor((score - 10) / 2);
}

function cleanNumber(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

function optionalString(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function optionalNumber(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function buildGuidedAbilities(primaryAbility: MonsterAbilityId, band: MonsterLevelBandId): Record<MonsterAbilityId, { score: number; modifier: number }> {
  const bandInfo = levelBands[band];
  const base: Record<MonsterAbilityId, number> = {
    str: bandInfo.floor,
    dex: bandInfo.floor,
    con: bandInfo.secondary,
    int: bandInfo.floor,
    wis: bandInfo.floor,
    cha: bandInfo.floor,
  };

  base[primaryAbility] = bandInfo.primary;

  if (primaryAbility !== "dex") {
    base.dex = Math.max(base.dex, bandInfo.floor + 2);
  }

  if (primaryAbility !== "con") {
    base.con = Math.max(base.con, bandInfo.secondary);
  }

  if (primaryAbility === "int" || primaryAbility === "wis" || primaryAbility === "cha") {
    base.wis = Math.max(base.wis, bandInfo.secondary - 2);
  }

  return Object.fromEntries(
    abilityIds.map((abilityId) => [
      abilityId,
      {
        score: base[abilityId],
        modifier: abilityModifier(base[abilityId]),
      },
    ])
  ) as Record<MonsterAbilityId, { score: number; modifier: number }>;
}

function customAbilitiesFromInputs(inputs: Record<MonsterAbilityId, string>) {
  return Object.fromEntries(
    abilityIds.map((abilityId) => {
      const score = cleanNumber(inputs[abilityId], 10);
      return [abilityId, { score, modifier: abilityModifier(score) }];
    })
  ) as Record<MonsterAbilityId, { score: number; modifier: number }>;
}

function formatAttackBonus(value: number) {
  return value >= 0 ? `1d20 + ${value}` : `1d20 - ${Math.abs(value)}`;
}

function formatHpReference(reference: HpReference) {
  return reference.high === null ? `${reference.low}+ HP` : `${reference.low}–${reference.high} HP`;
}

function roughStrengthEstimate(band: MonsterLevelBandId, pressure: MonsterPressureId) {
  const table: Record<MonsterLevelBandId, Record<MonsterPressureId, string>> = {
    low: {
      standard: "rough CR 1/8–1",
      strong: "rough CR 1–2",
      elite: "rough CR 2–3",
      bossGate: "rough CR 3–5 / set-piece",
    },
    mid: {
      standard: "rough CR 3–5",
      strong: "rough CR 5–7",
      elite: "rough CR 7–9",
      bossGate: "rough CR 9–12 / set-piece",
    },
    high: {
      standard: "rough CR 8–11",
      strong: "rough CR 11–14",
      elite: "rough CR 14–17",
      bossGate: "rough CR 17–20 / set-piece",
    },
    extreme: {
      standard: "rough CR 15–18",
      strong: "rough CR 18–21",
      elite: "rough CR 21–24",
      bossGate: "rough CR 24+ / set-piece",
    },
    final: {
      standard: "rough final-tier guidance",
      strong: "rough final-tier guidance",
      elite: "rough final-tier guidance",
      bossGate: "Arc/story-boss advisory",
    },
  };

  return table[band][pressure];
}

function splitActionGroups(actions: DraftAction[]) {
  return {
    actions: actions.filter((action) => action.cost === "Action"),
    bonusActions: actions.filter((action) => action.cost === "Bonus Action"),
    reactions: actions.filter((action) => action.cost === "Reaction"),
    legendaryActions: actions.filter((action) => action.cost === "Legendary Action"),
  };
}

function compactAction(action: DraftAction) {
  return {
    id: action.id,
    name: action.name,
    kind: action.kind,
    cost: action.cost,
    ...(action.range ? { range: action.range } : {}),
    ...(action.attack ? { attack: action.attack } : {}),
    ...(action.save ? { save: action.save } : {}),
    ...(action.dc !== undefined && action.dc !== "" ? { dc: action.dc } : {}),
    ...(action.damage ? { damage: action.damage } : {}),
    ...(action.critDamage ? { critDamage: action.critDamage } : {}),
    ...(action.damageType ? { damageType: action.damageType } : {}),
    ...(action.attackCount ? { attackCount: action.attackCount } : {}),
    ...(action.attacks && action.attacks.length > 0 ? { attacks: action.attacks } : {}),
    ...(action.hitRider ? { hitRider: action.hitRider } : {}),
    ...(action.recharge ? { recharge: action.recharge } : {}),
    ...(action.uses ? { uses: action.uses } : {}),
    ...(action.description ? { description: action.description } : {}),
    ...(action.critThreshold ? { critThreshold: action.critThreshold } : {}),
  };
}

export function MonsterJconBuilder({ onDraftReady }: { onDraftReady: (draft: DraftMonsterJcon) => void }) {
  const [mode, setMode] = useState<MonsterBuildMode>("guided");
  const [builderPurpose, setBuilderPurpose] = useState<MonsterBuilderPurpose>("encounter");
  const [name, setName] = useState("New Native Monster");
  const [creatureType, setCreatureType] = useState("undead");
  const [size, setSize] = useState("Medium");
  const [levelBand, setLevelBand] = useState<MonsterLevelBandId>("low");
  const [encounterPressure, setEncounterPressure] = useState<MonsterPressureId>("standard");
  const [primaryAbility, setPrimaryAbility] = useState<MonsterAbilityId>("str");
  const [hp, setHp] = useState(String(levelBands.low.hpReferences.standard.suggested));
  const [ac, setAc] = useState(String(levelBands.low.suggestedAc));
  const [speed, setSpeed] = useState("30 ft");
  const [mainActionName, setMainActionName] = useState("Primary Strike");
  const [attackBonus, setAttackBonus] = useState(String(levelBands.low.attackBonus));
  const [damageFormula, setDamageFormula] = useState(levelBands.low.damage);
  const [critDamageFormula, setCritDamageFormula] = useState(levelBands.low.critDamage);
  const [damageType, setDamageType] = useState("slashing");
  const [range, setRange] = useState("Melee 5 ft");
  const [customAbilities, setCustomAbilities] = useState<Record<MonsterAbilityId, string>>({
    str: "10",
    dex: "10",
    con: "10",
    int: "10",
    wis: "10",
    cha: "10",
  });

  const [actionDrafts, setActionDrafts] = useState<DraftAction[]>([]);
  const [actionCost, setActionCost] = useState<ActionDraftCost>("Action");
  const [actionName, setActionName] = useState("Claw");
  const [actionKind, setActionKind] = useState<ActionDraftKind>("attack");
  const [actionRange, setActionRange] = useState("Melee 5 ft");
  const [actionAttack, setActionAttack] = useState(formatAttackBonus(levelBands.low.attackBonus));
  const [actionAttackCount, setActionAttackCount] = useState("1");
  const [actionSave, setActionSave] = useState("");
  const [actionDc, setActionDc] = useState("");
  const [actionDamage, setActionDamage] = useState(levelBands.low.damage);
  const [actionCritDamage, setActionCritDamage] = useState(levelBands.low.critDamage);
  const [actionDamageType, setActionDamageType] = useState("slashing");
  const [actionUses, setActionUses] = useState("");
  const [actionRecharge, setActionRecharge] = useState("");
  const [actionDescription, setActionDescription] = useState("Generated by guided native Monster Cards helper; tune text before table use.");

  const [traitDrafts, setTraitDrafts] = useState<DraftTrait[]>([]);
  const [traitName, setTraitName] = useState("Tactical Trait");
  const [traitDescription, setTraitDescription] = useState("Describe a passive trait, aura, weakness, phase rule, or encounter reminder.");

  const [resourceDrafts, setResourceDrafts] = useState<DraftResource[]>([]);
  const [resourceName, setResourceName] = useState("Limited Uses");
  const [resourceCurrent, setResourceCurrent] = useState("1");
  const [resourceMax, setResourceMax] = useState("1");
  const [resourceReset, setResourceReset] = useState("combat");
  const [resourceNote, setResourceNote] = useState("Track this counter manually during combat.");

  const bandInfo = levelBands[levelBand];
  const hpReference = bandInfo.hpReferences[encounterPressure];
  const roughEstimate = roughStrengthEstimate(levelBand, encounterPressure);
  const abilities = useMemo(() => mode === "guided"
    ? buildGuidedAbilities(primaryAbility, levelBand)
    : customAbilitiesFromInputs(customAbilities), [customAbilities, levelBand, mode, primaryAbility]);

  const draftActionGroups = useMemo(() => splitActionGroups(actionDrafts), [actionDrafts]);
  const actionIsAttack = actionKind === "attack";
  const actionIsSave = actionKind === "save";
  const actionIsSpecial = actionKind === "manual" || actionKind === "special" || actionKind === "trait-trigger" || actionCost === "Legendary Action";
  const actionCanUseDamage = actionIsAttack || actionIsSave || actionIsSpecial;


  function applyBandDefaults(nextBand: MonsterLevelBandId) {
    setLevelBand(nextBand);
    setHp(String(levelBands[nextBand].hpReferences[encounterPressure].suggested));
    setAc(String(levelBands[nextBand].suggestedAc));
    setAttackBonus(String(levelBands[nextBand].attackBonus));
    setDamageFormula(levelBands[nextBand].damage);
    setCritDamageFormula(levelBands[nextBand].critDamage);
    setActionAttack(formatAttackBonus(levelBands[nextBand].attackBonus));
    setActionDamage(levelBands[nextBand].damage);
    setActionCritDamage(levelBands[nextBand].critDamage);
  }

  function applyPressureDefaults(nextPressure: MonsterPressureId) {
    setEncounterPressure(nextPressure);
    setHp(String(levelBands[levelBand].hpReferences[nextPressure].suggested));
  }

  function addActionDraft() {
    const nameValue = actionName.trim() || `${actionCost} ${actionDrafts.length + 1}`;
    const idBase = `${slugify(name)}-${slugify(nameValue)}`;
    const dcValue = optionalNumber(actionDc);
    const attackCountValue = Math.max(1, cleanNumber(actionAttackCount, 1));
    const isAttack = actionKind === "attack";
    const isSave = actionKind === "save";
    const isSpecial = actionKind === "manual" || actionKind === "special" || actionKind === "trait-trigger" || actionCost === "Legendary Action";
    const nextAction: DraftAction = {
      id: `${idBase}-${actionDrafts.length + 1}`,
      name: nameValue,
      kind: actionKind,
      cost: actionCost,
      range: optionalString(actionRange),
      ...(isAttack && actionAttack.trim() ? { attack: optionalString(actionAttack), critThreshold: 20 } : {}),
      ...(isAttack && attackCountValue > 1 ? { attackCount: attackCountValue } : {}),
      ...(isSave ? { save: optionalString(actionSave), dc: dcValue } : {}),
      ...((isAttack || isSave || isSpecial) && actionDamage.trim() ? { damage: optionalString(actionDamage) } : {}),
      ...(isAttack && actionCritDamage.trim() ? { critDamage: optionalString(actionCritDamage) } : {}),
      ...((isAttack || isSave || isSpecial) && actionDamageType.trim() ? { damageType: optionalString(actionDamageType) } : {}),
      ...(isSpecial && actionUses.trim() ? { uses: optionalString(actionUses) } : {}),
      ...(isSpecial && actionRecharge.trim() ? { recharge: optionalString(actionRecharge) } : {}),
      description: optionalString(actionDescription),
    };

    setActionDrafts((current) => [...current, nextAction]);
  }

  function addTraitDraft() {
    const nextName = traitName.trim() || `Trait ${traitDrafts.length + 1}`;
    setTraitDrafts((current) => [...current, {
      id: `${slugify(name)}-${slugify(nextName)}-${traitDrafts.length + 1}`,
      name: nextName,
      description: traitDescription.trim() || "No trait description provided.",
    }]);
  }

  function addResourceDraft() {
    const nextName = resourceName.trim() || `Resource ${resourceDrafts.length + 1}`;
    setResourceDrafts((current) => [...current, {
      id: `${slugify(name)}-${slugify(nextName)}-${resourceDrafts.length + 1}`,
      name: nextName,
      current: optionalNumber(resourceCurrent),
      max: optionalNumber(resourceMax),
      reset: optionalString(resourceReset),
      note: optionalString(resourceNote),
    }]);
  }

  function buildStarterAction(id: string, safeAttackBonus: number): DraftAction {
    const starterName = mainActionName.trim() || "Primary Strike";

    if (id === "mirage-stalker" && starterName.toLowerCase() === "multiattack") {
      return {
        id: `${id}-multiattack`,
        name: "Multiattack",
        kind: "attack",
        cost: "Action",
        attackCount: 2,
        attacks: [
          {
            id: "phantom-rake",
            name: "Phantom Rake",
            attack: "1d20 + 6",
            range: "Melee 10 ft",
            damage: "2d8 + 4",
            damageType: "piercing",
            description: "Corrupted antler strike. First half of the Mirage Stalker Multiattack.",
          },
          {
            id: "hollow-stamp",
            name: "Hollow Stamp",
            attack: "1d20 + 6",
            range: "Melee 5 ft",
            damage: "2d6 + 4",
            damageType: "bludgeoning",
            description: "Hollowed hoof impact. Second half of the Mirage Stalker Multiattack.",
          },
        ],
        description: "Make one Phantom Rake attack and one Hollow Stamp attack. The card locks after two attack resolutions.",
      };
    }

    return {
      id: `${id}-primary-action`,
      name: starterName,
      kind: "attack",
      cost: "Action",
      range: range.trim() || "Melee 5 ft",
      attack: formatAttackBonus(safeAttackBonus),
      damage: damageFormula.trim() || bandInfo.damage,
      critDamage: critDamageFormula.trim() || undefined,
      damageType: damageType.trim() || "untyped",
      critThreshold: 20,
      description: "Starter action generated by the Monster Cards native JCON helper. Tune numbers and text before table use. Crit damage auto-doubles dice from base damage if this field is blank.",
    };
  }


  function loadMirageStalkerStarter() {
    setMode("custom");
    setBuilderPurpose("publication");
    setName("Mirage Stalker");
    setCreatureType("aberration");
    setSize("Huge");
    setLevelBand("low");
    setEncounterPressure("bossGate");
    setPrimaryAbility("str");
    setCustomAbilities({
      str: "19",
      dex: "14",
      con: "16",
      int: "4",
      wis: "12",
      cha: "6",
    });
    setSpeed("50 ft");
    setHp("100");
    setAc("14");
    setMainActionName("Multiattack");
    setAttackBonus("6");
    setRange("Melee 10 ft");
    setDamageFormula("2d8 + 4");
    setCritDamageFormula("");
    setDamageType("piercing");
    setActionAttackCount("2");
    setActionDrafts([
      {
        id: "mirage-stalker-phantom-charge-1",
        name: "Phantom Charge",
        kind: "attack",
        cost: "Action",
        range: "Straight-line move, then Melee 10 ft",
        attack: "1d20 + 6",
        damage: "2d8 + 4",
        damageType: "piercing",
        recharge: "Recharge 5-6",
        hitRider: {
          trigger: "onHitOnly",
          condition: "Moved 20 ft or more in a straight line before the attack.",
          save: "DC 14 STR",
          failEffect: "Target is knocked prone and pushed 10 ft.",
        },
        description: "Move up to speed in a straight line and make one Phantom Rake attack at any point during that move. The prone/push rider only unlocks after a confirmed hit and the 20 ft movement condition.",
      },
      {
        id: "mirage-stalker-phantom-step-2",
        name: "Phantom Step",
        kind: "manual",
        cost: "Reaction",
        range: "Self",
        uses: "2/fight",
        description: "When the Stalker moves, it leaves an afterimage at its departure point. Attack rolls against the Stalker have disadvantage until it takes damage that round. Attacks targeting the afterimage auto-miss and trigger Phantom Lunge. Usable twice per fight total. Does not trigger the round the Stalker takes damage. Recharge/control belongs on Phantom Step.",
      },
    ]);
    setTraitDrafts([
      {
        id: "mirage-stalker-effective-defense-1",
        name: "Effective Defense Layer",
        description: "Printed AC 14 is the Act 1 boss baseline. Phantom Step is the effective defensive layer while active; once spent, the party should feel the boss become more hittable without becoming paper-thin.",
      },
      {
        id: "mirage-stalker-focus-note-2",
        name: "Focus Interaction",
        description: "Focus reduces the attack roll by 1d6. If the reduced total still meets or beats AC, the hit still counts and hit-gated riders may still trigger.",
      },
    ]);
    setResourceDrafts([
      {
        id: "mirage-stalker-phantom-step-recharge-1",
        name: "Phantom Step Uses",
        current: 2,
        max: 2,
        reset: "fight",
        note: "Two uses total. Phantom Charge is an Extra/Special Action with Recharge 5-6 after it has been used.",
      },
    ]);
  }

  function buildDraft() {
    const maxHp = Math.max(1, cleanNumber(hp, bandInfo.suggestedHp));
    const armorClass = Math.max(1, cleanNumber(ac, bandInfo.suggestedAc));
    const attackValue = Number.parseInt(attackBonus, 10);
    const safeAttackBonus = Number.isFinite(attackValue) ? attackValue : bandInfo.attackBonus;
    const id = slugify(name);
    const primaryLabel = abilityLabels[primaryAbility];
    const allActions = [buildStarterAction(id, safeAttackBonus), ...actionDrafts];
    const actionGroups = splitActionGroups(allActions);

    const draft: DraftMonsterJcon = {
      schema: "fdm/monster-v1",
      id,
      kind: "monster",
      name: name.trim() || "New Native Monster",
      subtitle: `${size} ${creatureType} · ${bandInfo.shortLabel} · ${primaryLabel}-style`,
      campaignModule: "custom-native",
      tags: [
        size,
        creatureType,
        bandInfo.shortLabel,
        `${primaryLabel} style`,
        mode === "guided" ? "guided draft" : "custom draft",
        `${pressureLabels[encounterPressure]} pressure`,
        `${builderPurposeLabels[builderPurpose]}`,
        builderPurpose === "publication" ? "publication draft" : "encounter test",
      ],
      defense: {
        hp: { current: maxHp, max: maxHp, temp: 0 },
        ac: armorClass,
        speed: speed.trim() || "30 ft",
      },
      abilities,
      actions: actionGroups.actions.map(compactAction),
      bonusActions: actionGroups.bonusActions.map(compactAction),
      reactions: actionGroups.reactions.map(compactAction),
      legendaryActions: actionGroups.legendaryActions.map(compactAction),
      traits: [
        ...traitDrafts,
        {
          id: `${id}-dm-starter-note`,
          name: "DM Starter Note",
          description: "Generated native FDM monster shell. Builder-side publication drafts may include rough strength estimates for Christopher, but this does not validate official rules, calculate final CR, or replace DM judgment.",
        },
      ],
      resources: resourceDrafts,
      notes: [
        `Build mode: ${mode}.`,
        `Primary style: ${abilityStyleLabels[primaryAbility]}.`,
        `Party band: ${bandInfo.label}.`,
        `Encounter pressure: ${pressureLabels[encounterPressure]}.`,
        `Builder purpose: ${builderPurposeLabels[builderPurpose]} — ${builderPurposeNotes[builderPurpose]}.`,
        `Builder-side rough strength estimate: ${roughEstimate}. Hide this from Beta/player-facing modes.`,
        `HP reference: ${formatHpReference(hpReference)}; current draft uses ${maxHp} HP.`,
        `Action blocks: ${actionGroups.actions.length} action(s), ${actionGroups.bonusActions.length} bonus action(s), ${actionGroups.reactions.length} reaction(s), ${actionGroups.legendaryActions.length} legendary action(s).`,
        `Traits: ${traitDrafts.length + 1}. Resources: ${resourceDrafts.length}.`,
        "Review HP, AC, attack bonus, damage, traits, resources, and visibility before running at the table.",
      ],
      visibility: {
        defaultMode: "condition",
        hiddenName: "Unrevealed Enemy",
        revealedName: name.trim() || "New Native Monster",
      },
    };

    onDraftReady(draft);
  }

  return (
    <section className="monster-jcon-builder" aria-label="Guided native monster JCON draft helper">
      <div className="monster-dev-panel-heading">
        <div>
          <p className="eyebrow">Native JCON helper</p>
          <h3>Guided monster draft</h3>
          <p className="subtle">Creates native FDM monster JCON shells for Owlbear testing and The Broken Chain publication prep. Builder-side estimates are rough and stay out of Beta/player-facing modes.</p>
        </div>
        <div className="monster-dev-segmented" aria-label="Monster draft mode">
          {(["guided", "custom"] as MonsterBuildMode[]).map((option) => (
            <button type="button" className={mode === option ? "active" : ""} onClick={() => setMode(option)} key={option}>
              {option === "guided" ? "Guided" : "Custom ABS"}
            </button>
          ))}
        </div>
      </div>

      <div className="monster-builder-publication-card" aria-label="Publication builder scope">
        <div>
          <p className="eyebrow">Publication workflow</p>
          <h4>Builder/Dev-only custom monster creation</h4>
          <p>Use this lane to create native FDM creature JCONs for The Broken Chain, test them in Monster Cards, then later migrate finalized text into the D&D Beyond module. Rough estimates are for Christopher only and must not ship into Beta/player views.</p>
        </div>
        <div className="monster-dev-button-row compact">
          <button type="button" onClick={loadMirageStalkerStarter}>Load Mirage Stalker starter</button>
        </div>
      </div>

      <div className="monster-builder-grid">
        <label>
          Name
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          Creature type
          <input value={creatureType} onChange={(event) => setCreatureType(event.target.value)} placeholder="undead, beast, fiend..." />
        </label>
        <label>
          Size
          <select value={size} onChange={(event) => setSize(event.target.value)}>
            {["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"].map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
        <label>
          Builder purpose
          <select value={builderPurpose} onChange={(event) => setBuilderPurpose(event.target.value as MonsterBuilderPurpose)}>
            {(Object.keys(builderPurposeLabels) as MonsterBuilderPurpose[]).map((option) => <option value={option} key={option}>{builderPurposeLabels[option]}</option>)}
          </select>
        </label>
        <label>
          Party band
          <select value={levelBand} onChange={(event) => applyBandDefaults(event.target.value as MonsterLevelBandId)}>
            {(Object.keys(levelBands) as MonsterLevelBandId[]).map((option) => <option value={option} key={option}>{levelBands[option].label}</option>)}
          </select>
        </label>
        <label>
          Encounter pressure
          <select value={encounterPressure} onChange={(event) => applyPressureDefaults(event.target.value as MonsterPressureId)}>
            {(Object.keys(pressureLabels) as MonsterPressureId[]).map((option) => <option value={option} key={option}>{pressureLabels[option]}</option>)}
          </select>
        </label>
        <label>
          Primary style
          <select value={primaryAbility} onChange={(event) => setPrimaryAbility(event.target.value as MonsterAbilityId)}>
            {abilityIds.map((abilityId) => <option value={abilityId} key={abilityId}>{abilityStyleLabels[abilityId]}</option>)}
          </select>
        </label>
        <label>
          Speed
          <input value={speed} onChange={(event) => setSpeed(event.target.value)} />
        </label>
        <label>
          HP
          <input inputMode="numeric" type="number" min="1" value={hp} onChange={(event) => setHp(event.target.value)} />
        </label>
        <label>
          AC
          <input inputMode="numeric" type="number" min="1" value={ac} onChange={(event) => setAc(event.target.value)} />
        </label>
      </div>

      <div className="monster-builder-hp-reference" aria-label="Estimated HP reference">
        <div>
          <span>HP reference</span>
          <strong>{formatHpReference(hpReference)}</strong>
          <p>{bandInfo.label} · {pressureLabels[encounterPressure]} · {pressureNotes[encounterPressure]}.</p>
          <p><strong>{roughEstimate}</strong> · Builder-side estimate only; tune by table feel before module export.</p>
        </div>
        <button type="button" onClick={() => setHp(String(hpReference.suggested))}>Use suggested {hpReference.suggested} HP</button>
        <p className="monster-builder-hp-caution">Reference only, not CR math. Adjust for action economy, player strength, magic items, encounter pacing, and boss/gate phases.</p>
      </div>

      {mode === "custom" && (
        <div className="monster-builder-ability-grid" aria-label="Custom ability score inputs">
          {abilityIds.map((abilityId) => (
            <label key={abilityId}>
              {abilityLabels[abilityId]}
              <input
                inputMode="numeric"
                type="number"
                value={customAbilities[abilityId]}
                onChange={(event) => setCustomAbilities((current) => ({ ...current, [abilityId]: event.target.value }))}
              />
            </label>
          ))}
        </div>
      )}

      <div className="monster-builder-preview">
        <span>ABS preview · {builderPurposeLabels[builderPurpose]}</span>
        {abilityIds.map((abilityId) => (
          <strong key={abilityId}>{abilityLabels[abilityId]} {abilities[abilityId].score} ({abilities[abilityId].modifier >= 0 ? "+" : ""}{abilities[abilityId].modifier})</strong>
        ))}
      </div>

      <div className="monster-builder-expanded-tools-card" aria-label="Guided builder tools included">
        <div>
          <span>0.3.0j adaptive builders</span>
          <strong>Extra Action Cards · Traits · Resources</strong>
          <p>If this panel is missing, Owlbear is still showing an older active-dev build instead of this 0.3.0j folder.</p>
        </div>
        <div className="monster-builder-generated-list compact">
          <strong>Starter action always included</strong>
          <strong>Extra cards below</strong>
          <strong>Build/Rebuild updates editor</strong>
        </div>
      </div>

      <section className="monster-builder-subsection highlighted-builder-section">
        <div>
          <p className="eyebrow">Starter action</p>
          <p className="subtle">This creates the first Main Action. Add extra actions, bonus actions, reactions, and legendary actions below.</p>
        </div>
        <div className="monster-builder-grid compact-action-fields">
          <label>
            Starter action
            <input value={mainActionName} onChange={(event) => setMainActionName(event.target.value)} />
          </label>
          <label>
            Attack bonus
            <input inputMode="numeric" type="number" value={attackBonus} onChange={(event) => setAttackBonus(event.target.value)} />
          </label>
          <label>
            Range
            <input value={range} onChange={(event) => setRange(event.target.value)} />
          </label>
          <label>
            Damage
            <input value={damageFormula} onChange={(event) => setDamageFormula(event.target.value)} />
          </label>
          <label>
            Crit damage (optional)
            <input value={critDamageFormula} onChange={(event) => setCritDamageFormula(event.target.value)} placeholder="blank = auto-double dice" />
          </label>
          <label>
            Damage type
            <input value={damageType} onChange={(event) => setDamageType(event.target.value)} />
          </label>
        </div>
      </section>

      <section className="monster-builder-subsection highlighted-builder-section">
        <div>
          <p className="eyebrow">Action card builder</p>
          <h4>Add action / bonus / reaction cards</h4>
          <p className="subtle">Adds native FDM action blocks with adaptive fields. Attack actions show attack/crit fields, save actions show save/DC fields, and special/legendary actions show usage/recharge fields.</p>
        </div>
        <div className="monster-builder-grid compact-action-fields">
          <label>
            Cost
            <select value={actionCost} onChange={(event) => setActionCost(event.target.value as ActionDraftCost)}>
              {actionCosts.map((cost) => <option value={cost} key={cost}>{cost}</option>)}
            </select>
          </label>
          <label>
            Name
            <input value={actionName} onChange={(event) => setActionName(event.target.value)} />
          </label>
          <label>
            Kind
            <select value={actionKind} onChange={(event) => setActionKind(event.target.value as ActionDraftKind)}>
              {actionKinds.map((kind) => <option value={kind} key={kind}>{kind === "trait-trigger" ? "trait / trigger" : kind}</option>)}
            </select>
          </label>
          <label>
            Range
            <input value={actionRange} onChange={(event) => setActionRange(event.target.value)} />
          </label>
          {actionIsAttack && (
            <>
              <div className="monster-builder-wide-field">
                <FormulaInput label="Attack roll" value={actionAttack} onChange={setActionAttack} placeholder="1d20 + 6" showVars={[]} />
              </div>
              <label>
                Attack count
                <input inputMode="numeric" type="number" min="1" value={actionAttackCount} onChange={(event) => setActionAttackCount(event.target.value)} />
              </label>
            </>
          )}
          {actionIsSave && (
            <>
              <label>
                Save ability
                <select value={actionSave} onChange={(event) => setActionSave(event.target.value)}>
                  <option value="">Choose save</option>
                  {abilityIds.map((abilityId) => <option value={abilityLabels[abilityId]} key={abilityId}>{abilityLabels[abilityId]}</option>)}
                </select>
              </label>
              <label>
                Save DC
                <input inputMode="numeric" type="number" value={actionDc} onChange={(event) => setActionDc(event.target.value)} placeholder="14" />
              </label>
            </>
          )}
          {actionCanUseDamage && (
            <>
              <label>
                Damage / effect amount
                <input value={actionDamage} onChange={(event) => setActionDamage(event.target.value)} placeholder={actionIsSave ? "2d6 or blank for effect only" : "2d8 + 4"} />
              </label>
              {actionIsAttack && (
                <label>
                  Crit damage (optional)
                  <input value={actionCritDamage} onChange={(event) => setActionCritDamage(event.target.value)} placeholder="blank = auto-double dice" />
                </label>
              )}
              <label>
                Damage type
                <input value={actionDamageType} onChange={(event) => setActionDamageType(event.target.value)} placeholder="piercing, fire, psychic..." />
              </label>
            </>
          )}
          {actionIsSpecial && (
            <>
              <label>
                Uses
                <input value={actionUses} onChange={(event) => setActionUses(event.target.value)} placeholder="1/day, Recharge, 3 uses..." />
              </label>
              <label>
                Recharge
                <input value={actionRecharge} onChange={(event) => setActionRecharge(event.target.value)} placeholder="Recharge 5–6" />
              </label>
            </>
          )}
          <label className="monster-builder-wide-field">
            Description
            <textarea value={actionDescription} onChange={(event) => setActionDescription(event.target.value)} />
          </label>
        </div>
        <div className="monster-dev-button-row">
          <button type="button" onClick={addActionDraft}>Add {actionCost}</button>
          <button type="button" onClick={() => setActionDrafts([])}>Clear added actions</button>
        </div>
        <div className="monster-builder-generated-list" aria-label="Generated action card summary">
          <span>Added blocks</span>
          <strong>Actions {draftActionGroups.actions.length}</strong>
          <strong>Bonus {draftActionGroups.bonusActions.length}</strong>
          <strong>Reactions {draftActionGroups.reactions.length}</strong>
          <strong>Legendary {draftActionGroups.legendaryActions.length}</strong>
        </div>
      </section>

      <section className="monster-builder-subsection highlighted-builder-section">
        <div>
          <p className="eyebrow">Trait builder</p>
          <h4>Add traits / phase reminders</h4>
        </div>
        <div className="monster-builder-grid compact-action-fields">
          <label>
            Trait name
            <input value={traitName} onChange={(event) => setTraitName(event.target.value)} />
          </label>
          <label className="monster-builder-wide-field">
            Trait text
            <textarea value={traitDescription} onChange={(event) => setTraitDescription(event.target.value)} />
          </label>
        </div>
        <div className="monster-dev-button-row">
          <button type="button" onClick={addTraitDraft}>Add Trait</button>
          <button type="button" onClick={() => setTraitDrafts([])}>Clear traits</button>
        </div>
        <div className="monster-builder-generated-list" aria-label="Generated trait summary">
          <span>Added traits</span>
          {traitDrafts.length === 0 ? <strong>None yet</strong> : traitDrafts.map((trait) => <strong key={trait.id}>{trait.name}</strong>)}
        </div>
      </section>

      <section className="monster-builder-subsection highlighted-builder-section">
        <div>
          <p className="eyebrow">Resource / counter builder</p>
          <h4>Add counters / limited uses</h4>
        </div>
        <div className="monster-builder-grid compact-action-fields">
          <label>
            Resource name
            <input value={resourceName} onChange={(event) => setResourceName(event.target.value)} />
          </label>
          <label>
            Current
            <input inputMode="numeric" type="number" value={resourceCurrent} onChange={(event) => setResourceCurrent(event.target.value)} />
          </label>
          <label>
            Max
            <input inputMode="numeric" type="number" value={resourceMax} onChange={(event) => setResourceMax(event.target.value)} />
          </label>
          <label>
            Reset
            <input value={resourceReset} onChange={(event) => setResourceReset(event.target.value)} placeholder="combat, day, recharge..." />
          </label>
          <label className="monster-builder-wide-field">
            Note
            <textarea value={resourceNote} onChange={(event) => setResourceNote(event.target.value)} />
          </label>
        </div>
        <div className="monster-dev-button-row">
          <button type="button" onClick={addResourceDraft}>Add Resource</button>
          <button type="button" onClick={() => setResourceDrafts([])}>Clear resources</button>
        </div>
        <div className="monster-builder-generated-list" aria-label="Generated resource summary">
          <span>Added resources</span>
          {resourceDrafts.length === 0 ? <strong>None yet</strong> : resourceDrafts.map((resource) => <strong key={resource.id}>{resource.name}</strong>)}
        </div>
      </section>

      <div className="monster-builder-note">
        <strong>Scope guard:</strong> This drafts native FDM JCON for card intake and publication prep. Rough strength estimates are Builder/Dev-side only; no official stat database, player-facing CR calculator, or party-vs-creature assessment is being shipped.
      </div>

      <div className="monster-dev-button-row">
        <button type="button" onClick={buildDraft}>Build / Rebuild JCON Draft Into Editor</button>
      </div>
    </section>
  );
}
