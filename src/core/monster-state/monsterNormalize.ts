import type {
  MonsterAbility,
  MonsterAbilityId,
  MonsterAction,
  MonsterNormalizeResult,
  MonsterResource,
  MonsterTrait,
  MonsterValidationIssue,
  MonsterVisibilityMode,
  NormalizedMonsterActor,
} from "../types/monsterTypes";

const abilityIds: MonsterAbilityId[] = ["str", "dex", "con", "int", "wis", "cha"];
const visibilityModes: MonsterVisibilityMode[] = ["hidden", "label-only", "condition", "hp-bar", "full"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(asString).filter((entry): entry is string => Boolean(entry));
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function issue(severity: MonsterValidationIssue["severity"], path: string, message: string): MonsterValidationIssue {
  return { severity, path, message };
}

function normalizeSpeed(rawSpeed: unknown): string {
  if (typeof rawSpeed === "string" && rawSpeed.trim()) {
    return rawSpeed.trim();
  }

  if (typeof rawSpeed === "number" && Number.isFinite(rawSpeed)) {
    return `${rawSpeed} ft`;
  }

  if (isRecord(rawSpeed)) {
    return Object.entries(rawSpeed)
      .map(([key, value]) => {
        const speedValue = asString(value);
        return speedValue ? `${key} ${speedValue}${/^\d+$/.test(speedValue) ? " ft" : ""}` : undefined;
      })
      .filter((entry): entry is string => Boolean(entry))
      .join(" · ");
  }

  return "—";
}

function normalizeAbility(value: unknown): MonsterAbility | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return { score: value };
  }

  if (!isRecord(value)) {
    return undefined;
  }

  const score = asNumber(value.score);
  const modifier = asNumber(value.modifier ?? value.mod ?? value.bonus);

  if (score === undefined && modifier === undefined) {
    return undefined;
  }

  return { score, modifier };
}

function normalizeAbilities(raw: Record<string, unknown>, issues: MonsterValidationIssue[]) {
  const source = isRecord(raw.abilities)
    ? raw.abilities
    : isRecord(raw.abilityScores)
      ? raw.abilityScores
      : isRecord(raw.stats)
        ? raw.stats
        : undefined;

  if (!source) {
    issues.push(issue("warning", "abilities", "Missing ability scores; stat row will render blank placeholders."));
    return {};
  }

  const abilities: Partial<Record<MonsterAbilityId, MonsterAbility>> = {};

  abilityIds.forEach((abilityId) => {
    const ability = normalizeAbility(source[abilityId] ?? source[abilityId.toUpperCase()]);

    if (ability) {
      abilities[abilityId] = ability;
    }
  });

  if (Object.keys(abilities).length === 0) {
    issues.push(issue("warning", "abilities", "Ability score object was present, but no STR/DEX/CON/INT/WIS/CHA values were readable."));
  }

  return abilities;
}

function actionNameFrom(rawAction: Record<string, unknown>, fallback: string) {
  return asString(rawAction.name ?? rawAction.label ?? rawAction.title) ?? fallback;
}

function looksLikeRollableKind(kind: string) {
  const value = kind.toLowerCase();
  return value.includes("attack") || value.includes("spell") || value.includes("save") || value.includes("check");
}

function normalizeCritThreshold(value: unknown) {
  const parsed = asNumber(value);

  if (parsed === undefined) {
    return undefined;
  }

  return Math.min(20, Math.max(1, Math.floor(parsed)));
}


function normalizeHitRider(value: unknown) {
  if (!isRecord(value)) {
    return undefined;
  }

  const trigger = asString(value.trigger);
  const condition = asString(value.condition);
  const save = asString(value.save);
  const failEffect = asString(value.failEffect ?? value.fail ?? value.onFail);
  const successEffect = asString(value.successEffect ?? value.success ?? value.onSuccess);

  if (!trigger && !condition && !save && !failEffect && !successEffect) {
    return undefined;
  }

  return { trigger, condition, save, failEffect, successEffect };
}

function normalizeAttackCount(value: unknown) {
  const parsed = asNumber(value);

  if (parsed === undefined) {
    return undefined;
  }

  return Math.max(1, Math.floor(parsed));
}

function normalizeSubAttack(value: unknown, index: number, groupPath: string, issues: MonsterValidationIssue[]) {
  if (!isRecord(value)) {
    issues.push(issue("warning", `${groupPath}.attacks[${index}]`, "Sub-attack entry is not an object and was skipped."));
    return undefined;
  }

  const name = asString(value.name ?? value.label ?? value.title) ?? `Sub-attack ${index + 1}`;
  const attack = asString(value.attack ?? value.attackFormula ?? value.roll ?? value.rollFormula);
  const damage = asString(value.damage ?? value.damageFormula);

  if (!attack && !damage) {
    issues.push(issue("info", `${groupPath}.attacks[${index}]`, `${name} has no attack or damage formula. It will still render as a manual sub-attack option.`));
  }

  return {
    id: asString(value.id) ?? `${groupPath}-sub-${index + 1}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    name,
    attack,
    range: asString(value.range),
    damage,
    critDamage: asString(value.critDamage ?? value.crit ?? value.critDamageFormula),
    damageType: asString(value.damageType),
    description: asString(value.description ?? value.text ?? value.details),
    hitRider: normalizeHitRider(value.hitRider ?? value.rider),
  };
}

function normalizeSubAttacks(value: unknown, groupPath: string, issues: MonsterValidationIssue[]) {
  return readArray(value)
    .map((entry, index) => normalizeSubAttack(entry, index, groupPath, issues))
    .filter((entry): entry is NonNullable<ReturnType<typeof normalizeSubAttack>> => Boolean(entry));
}

function normalizeAction(value: unknown, index: number, groupPath: string, issues: MonsterValidationIssue[]): MonsterAction | undefined {
  if (!isRecord(value)) {
    issues.push(issue("warning", `${groupPath}[${index}]`, "Action entry is not an object and was skipped."));
    return undefined;
  }

  const name = asString(value.name ?? value.label ?? value.title) ?? `Unnamed action ${index + 1}`;
  const kind = asString(value.kind ?? value.type ?? value.actionKind) ?? "action";
  const attack = asString(value.attack ?? value.attackFormula ?? value.roll ?? value.rollFormula);
  const save = asString(value.save ?? value.saveAbility ?? value.saveType);
  const dc = asNumber(value.dc ?? value.saveDc) ?? asString(value.dc ?? value.saveDc);
  const damage = asString(value.damage ?? value.damageFormula);
  const critDamage = asString(value.critDamage ?? value.crit ?? value.critDamageFormula);
  const cost = asString(value.cost ?? value.actionCost ?? value.economyCost);
  const attackCount = normalizeAttackCount(value.attackCount ?? value.attacksAllowed ?? value.attackUses);
  const attacks = normalizeSubAttacks(value.attacks ?? value.subAttacks, `${groupPath}[${index}]`, issues);
  const hitRider = normalizeHitRider(value.hitRider ?? value.rider);

  if (!asString(value.name ?? value.label ?? value.title)) {
    issues.push(issue("warning", `${groupPath}[${index}].name`, `Missing action name; rendered as ${name}.`));
  }

  if (looksLikeRollableKind(kind) && !attack && !save && dc === undefined) {
    issues.push(issue(
      "warning",
      `${groupPath}[${index}]`,
      `${name} is marked as ${kind} but has no attack formula, save, or DC. It will render as a triggered/manual action instead of a hit-miss roll button.`
    ));
  }

  if (attack && !damage) {
    issues.push(issue(
      "info",
      `${groupPath}[${index}].damage`,
      `${name} has an attack roll but no damage formula. Hit/Miss can still be tested, but no Damage button will appear after a hit.`
    ));
  }

  if (critDamage && !attack) {
    issues.push(issue(
      "info",
      `${groupPath}[${index}].critDamage`,
      `${name} has crit damage but no attack formula. Crit damage is ignored unless the action uses an attack roll.`
    ));
  }

  return {
    id: asString(value.id) ?? `${groupPath}-${index + 1}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    name,
    kind,
    cost,
    range: asString(value.range),
    attack,
    save,
    dc,
    damage,
    critDamage,
    critThreshold: normalizeCritThreshold(value.critThreshold ?? value.critRange),
    damageType: asString(value.damageType),
    attackCount: attackCount ?? (attacks.length > 0 ? attacks.length : undefined),
    attacks: attacks.length > 0 ? attacks : undefined,
    hitRider,
    recharge: asString(value.recharge),
    uses: asString(value.uses),
    description: asString(value.description ?? value.text ?? value.details),
  };
}

function normalizeActionArray(value: unknown, path: string, issues: MonsterValidationIssue[]): MonsterAction[] {
  return readArray(value)
    .map((entry, index) => normalizeAction(entry, index, path, issues))
    .filter((entry): entry is MonsterAction => Boolean(entry));
}

function normalizeTrait(value: unknown, index: number, groupPath: string, issues: MonsterValidationIssue[]): MonsterTrait | undefined {
  if (!isRecord(value)) {
    issues.push(issue("warning", `${groupPath}[${index}]`, "Trait entry is not an object and was skipped."));
    return undefined;
  }

  const name = asString(value.name ?? value.label ?? value.title) ?? `Unnamed trait ${index + 1}`;
  const description = asString(value.description ?? value.text ?? value.note ?? value.effect) ?? "No trait description provided.";

  if (!asString(value.name ?? value.label ?? value.title)) {
    issues.push(issue("warning", `${groupPath}[${index}].name`, `Missing trait name; rendered as ${name}.`));
  }

  if (!asString(value.description ?? value.text ?? value.note ?? value.effect)) {
    issues.push(issue("warning", `${groupPath}[${index}].description`, `Missing trait description for ${name}.`));
  }

  return {
    id: asString(value.id) ?? `${groupPath}-${index + 1}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    name,
    description,
  };
}

function normalizeTraits(value: unknown, issues: MonsterValidationIssue[]) {
  return readArray(value)
    .map((entry, index) => normalizeTrait(entry, index, "traits", issues))
    .filter((entry): entry is MonsterTrait => Boolean(entry));
}

function normalizeResource(value: unknown, index: number, issues: MonsterValidationIssue[]): MonsterResource | undefined {
  if (!isRecord(value)) {
    issues.push(issue("warning", `resources[${index}]`, "Resource entry is not an object and was skipped."));
    return undefined;
  }

  const name = asString(value.name ?? value.label) ?? `Unnamed resource ${index + 1}`;

  return {
    id: asString(value.id) ?? `resource-${index + 1}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    name,
    current: asNumber(value.current),
    max: asNumber(value.max),
    reset: asString(value.reset),
    note: asString(value.note ?? value.description),
  };
}

function normalizeResources(value: unknown, issues: MonsterValidationIssue[]) {
  return readArray(value)
    .map((entry, index) => normalizeResource(entry, index, issues))
    .filter((entry): entry is MonsterResource => Boolean(entry));
}

function normalizeVisibility(raw: Record<string, unknown>, issues: MonsterValidationIssue[]) {
  const visibility = isRecord(raw.visibility) ? raw.visibility : undefined;
  const defaultMode = asString(visibility?.defaultMode ?? visibility?.mode ?? raw.visibilityMode);
  const safeMode = defaultMode && visibilityModes.includes(defaultMode as MonsterVisibilityMode)
    ? defaultMode as MonsterVisibilityMode
    : "condition";

  if (defaultMode && safeMode !== defaultMode) {
    issues.push(issue("warning", "visibility.defaultMode", `Unknown visibility mode '${defaultMode}', using condition.`));
  }

  return {
    defaultMode: safeMode,
    revealedName: asString(visibility?.revealedName),
    hiddenName: asString(visibility?.hiddenName) ?? "Unrevealed Enemy",
  };
}

export function normalizeMonsterJcon(rawValue: unknown): MonsterNormalizeResult {
  const issues: MonsterValidationIssue[] = [];

  if (!isRecord(rawValue)) {
    const fallback = createFallbackMonster();
    return {
      monster: fallback,
      issues: [issue("error", "$", "JCON root must be a JSON object. Rendering fallback card so the workbench does not fail silently.")],
    };
  }

  const raw = rawValue;
  const schema = asString(raw.schema) ?? "unknown";

  if (!asString(raw.schema)) {
    issues.push(issue("warning", "schema", "Missing schema; expected native FDM actor schema such as fdm/actor-v1."));
  } else if (schema !== "fdm/actor-v1" && schema !== "fdm/monster-v1") {
    issues.push(issue("info", "schema", `Schema '${schema}' is readable in Monster Dev, but final baseline should prefer fdm/actor-v1 or fdm/monster-v1.`));
  }

  const kindInput = asString(raw.kind);
  const kind = kindInput === "boss" || kindInput === "npc" || kindInput === "monster" ? kindInput : "monster";

  if (!kindInput) {
    issues.push(issue("warning", "kind", "Missing kind; defaulted to monster."));
  } else if (kindInput !== kind) {
    issues.push(issue("warning", "kind", `Unsupported kind '${kindInput}' for Monster Dev; defaulted to monster.`));
  }

  const id = asString(raw.id) ?? "monster-generated-id";
  const name = asString(raw.name) ?? "Unnamed Monster";

  if (!asString(raw.id)) {
    issues.push(issue("warning", "id", "Missing id; generated temporary workbench id."));
  }

  if (!asString(raw.name)) {
    issues.push(issue("warning", "name", "Missing monster name; rendered as Unnamed Monster."));
  }

  const defenseSource = isRecord(raw.defense) ? raw.defense : isRecord(raw.stats) ? raw.stats : undefined;
  const hpSource = isRecord(defenseSource?.hp) ? defenseSource.hp : isRecord(raw.hp) ? raw.hp : undefined;
  const maxHp = asNumber(hpSource?.max ?? hpSource?.maximum ?? raw.maxHp) ?? 1;
  const currentHp = asNumber(hpSource?.current ?? hpSource?.value ?? raw.currentHp) ?? maxHp;
  const tempHp = asNumber(hpSource?.temp ?? hpSource?.temporary ?? raw.tempHp) ?? 0;
  const ac = asNumber(defenseSource?.ac ?? raw.ac) ?? asString(defenseSource?.ac ?? raw.ac) ?? "—";
  const speed = normalizeSpeed(defenseSource?.speed ?? raw.speed);

  if (!defenseSource) {
    issues.push(issue("warning", "defense", "Missing defense object; using fallback AC/HP/speed values where needed."));
  }

  if (!hpSource) {
    issues.push(issue("warning", "defense.hp", "Missing HP object; fallback HP is 1/1 until supplied."));
  }

  if (ac === "—") {
    issues.push(issue("warning", "defense.ac", "Missing AC; displayed as —."));
  }

  if (speed === "—") {
    issues.push(issue("warning", "defense.speed", "Missing speed; displayed as —."));
  }

  const actions = normalizeActionArray(raw.actions ?? raw.mainActions, "actions", issues);
  const bonusActions = normalizeActionArray(raw.bonusActions, "bonusActions", issues);
  const reactions = normalizeActionArray(raw.reactions, "reactions", issues);
  const legendaryActions = normalizeActionArray(raw.legendaryActions, "legendaryActions", issues);
  const traits = normalizeTraits(raw.traits ?? raw.features ?? raw.passives, issues);
  const resources = normalizeResources(raw.resources, issues);
  const notes = asStringArray(raw.notes);

  if (actions.length === 0 && bonusActions.length === 0 && reactions.length === 0 && legendaryActions.length === 0) {
    issues.push(issue("warning", "actions", "No actions were provided; monster card will render without combat buttons/actions."));
  }

  const monster: NormalizedMonsterActor = {
    schema,
    id,
    kind,
    name,
    subtitle: asString(raw.subtitle ?? raw.type ?? raw.creatureType) ?? (kind === "boss" ? "Boss monster" : "Monster actor"),
    campaignModule: asString(raw.campaignModule),
    tags: asStringArray(raw.tags),
    defense: {
      ac,
      hp: {
        current: Math.max(0, currentHp),
        max: Math.max(1, maxHp),
        temp: Math.max(0, tempHp),
      },
      speed,
    },
    abilities: normalizeAbilities(raw, issues),
    actions,
    bonusActions,
    reactions,
    legendaryActions,
    traits,
    resources,
    notes,
    visibility: normalizeVisibility(raw, issues),
  };

  return { monster, issues };
}

function createFallbackMonster(): NormalizedMonsterActor {
  return {
    schema: "unknown",
    id: "invalid-monster-jcon",
    kind: "monster",
    name: "Invalid Monster JCON",
    subtitle: "Fallback card",
    tags: [],
    defense: {
      ac: "—",
      hp: { current: 1, max: 1, temp: 0 },
      speed: "—",
    },
    abilities: {},
    actions: [],
    bonusActions: [],
    reactions: [],
    legendaryActions: [],
    traits: [],
    resources: [],
    notes: [],
    visibility: { defaultMode: "hidden", hiddenName: "Unrevealed Enemy" },
  };
}
