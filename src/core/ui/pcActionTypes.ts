export type PcActionTab = "action" | "bonus" | "reaction" | "bond" | "spell" | "feature" | "resource" | "outOfCombat";

export type PcActionCost = "action" | "bonus" | "reaction" | "bond" | "free" | "passive";

export type PcRollMode = "attack" | "save" | "check" | "damageOnly" | "healing" | "triggered" | "additive" | "utility" | "passive" | "reference";

export type PcActionVisibility = "player" | "dm" | "hidden";

export type PcActionUses = {
  current: number;
  max: number;
  reset: "turn" | "shortRest" | "longRest" | "encounter" | "manual";
};

export type PcActionDraft = {
  id?: string;
  name: string;
  tab: PcActionTab;
  actionCost: PcActionCost;
  rollMode: PcRollMode;
  attackBonus?: string | number;
  saveAbility?: string;
  saveDc?: string | number;
  checkAbility?: string;
  damage?: string;
  damageType?: string;
  critDamage?: string;
  healing?: string;
  range?: string;
  reach?: string;
  resourceName?: string;
  slotCost?: string;
  spellLevel?: number;
  usableSpellLevels?: number[];
  defaultCastLevel?: number;
  lastCastLevel?: number;
  consumesSpellSlot?: boolean;
  uses?: PcActionUses;
  attackCount?: number;
  attackUses?: number;
  lockGroup?: string;
  locksWith?: string[];
  description?: string;
  source?: string;
  visibility?: PcActionVisibility;
  /** P5 F09 — initiative bonus contributed by this feature (e.g. Alert feat +5) */
  initiativeBonus?: number;
  /** Feat/feature AC bonus — applied as an addAC stat effect (e.g. Dual Wielder +1). */
  acBonus?: number;
  /** Fighting style toggle — bonus to matching weapon attacks (Archery, TWF, GWF). */
  combatStyleAttack?: string;
  combatStyleDamage?: string;
  combatStyleTarget?: "ranged" | "melee" | "weapon";
};

export type PcActorAction = PcActionDraft & {
  id: string;
};

export const PC_ACTION_TABS: PcActionTab[] = ["action", "bonus", "reaction", "bond", "spell", "feature", "resource", "outOfCombat"];

export const PC_ROLL_MODES: PcRollMode[] = ["attack", "save", "check", "damageOnly", "healing", "triggered", "utility", "passive", "reference"];

export function slugifyForActionId(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "pc-action";
}

function cleanNumber(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
}

export function normalizePcActionDraft(draft: PcActionDraft, actorName = "actor", index = 0): PcActorAction {
  const safeName = draft.name?.trim() || `Action ${index + 1}`;
  const id = draft.id?.trim() || `${slugifyForActionId(actorName)}-${slugifyForActionId(safeName)}-${index + 1}`;
  const attackCount = cleanNumber(draft.attackCount, 1);
  const attackUses = cleanNumber(draft.attackUses, 1);
  const spellLevel = draft.spellLevel === undefined ? undefined : cleanNumber(draft.spellLevel, 0);

  return {
    id,
    name: safeName,
    tab: draft.tab,
    actionCost: draft.actionCost,
    rollMode: draft.rollMode,
    ...(draft.attackBonus !== undefined && String(draft.attackBonus).trim() ? { attackBonus: draft.attackBonus } : {}),
    ...(draft.saveAbility?.trim() ? { saveAbility: draft.saveAbility.trim() } : {}),
    ...(draft.saveDc !== undefined && String(draft.saveDc).trim() ? { saveDc: draft.saveDc } : {}),
    ...(draft.checkAbility?.trim() ? { checkAbility: draft.checkAbility.trim() } : {}),
    ...(draft.damage?.trim() ? { damage: draft.damage.trim() } : {}),
    ...(draft.damageType?.trim() ? { damageType: draft.damageType.trim() } : {}),
    ...(draft.critDamage?.trim() ? { critDamage: draft.critDamage.trim() } : {}),
    ...(draft.healing?.trim() ? { healing: draft.healing.trim() } : {}),
    ...(draft.range?.trim() ? { range: draft.range.trim() } : {}),
    ...(draft.reach?.trim() ? { reach: draft.reach.trim() } : {}),
    ...(draft.resourceName?.trim() ? { resourceName: draft.resourceName.trim() } : {}),
    ...(draft.slotCost?.trim() ? { slotCost: draft.slotCost.trim() } : {}),
    ...(spellLevel !== undefined ? { spellLevel } : {}),
    ...(Array.isArray(draft.usableSpellLevels) && draft.usableSpellLevels.length ? { usableSpellLevels: Array.from(new Set(draft.usableSpellLevels.map((level) => cleanNumber(level, 0)))).sort((a, b) => a - b) } : {}),
    ...(draft.defaultCastLevel !== undefined ? { defaultCastLevel: cleanNumber(draft.defaultCastLevel, 0) } : {}),
    ...(draft.lastCastLevel !== undefined ? { lastCastLevel: cleanNumber(draft.lastCastLevel, 0) } : {}),
    ...(draft.consumesSpellSlot !== undefined ? { consumesSpellSlot: draft.consumesSpellSlot } : {}),
    ...(draft.uses ? { uses: draft.uses } : {}),
    ...(attackCount > 1 ? { attackCount } : {}),
    ...(attackUses > 1 ? { attackUses } : {}),
    ...(draft.lockGroup?.trim() ? { lockGroup: draft.lockGroup.trim() } : {}),
    ...(draft.locksWith?.length ? { locksWith: draft.locksWith.filter(Boolean) } : {}),
    ...(draft.description?.trim() ? { description: draft.description.trim() } : {}),
    ...(draft.source?.trim() ? { source: draft.source.trim() } : {}),
    visibility: draft.visibility ?? "player",
  };
}

export function splitPcActionsByTab(actions: PcActorAction[]) {
  return PC_ACTION_TABS.reduce((groups, tab) => {
    groups[tab] = actions.filter((action) => action.tab === tab);
    return groups;
  }, {} as Record<PcActionTab, PcActorAction[]>);
}

export function makeBondPairActions(params: {
  actorName: string;
  focusName?: string;
  focusDescription?: string;
  pressureName?: string;
  pressureDescription?: string;
  source?: string;
}) {
  const lockGroup = `${slugifyForActionId(params.actorName)}-bond-choice`;
  const focusId = `${lockGroup}-focus`;
  const pressureId = `${lockGroup}-pressure`;

  const focus = normalizePcActionDraft({
    id: focusId,
    name: params.focusName ?? "Focus",
    tab: "bond",
    actionCost: "bond",
    rollMode: "utility",
    lockGroup,
    locksWith: [pressureId],
    description: params.focusDescription ?? "Bond action. Using this locks the paired bond choice until turn/round reset.",
    source: params.source ?? "Actor Bond",
    visibility: "player",
  }, params.actorName, 0);

  const pressure = normalizePcActionDraft({
    id: pressureId,
    name: params.pressureName ?? "Pressure",
    tab: "bond",
    actionCost: "bond",
    rollMode: "utility",
    lockGroup,
    locksWith: [focusId],
    description: params.pressureDescription ?? "Bond action. Using this locks the paired bond choice until turn/round reset.",
    source: params.source ?? "Actor Bond",
    visibility: "player",
  }, params.actorName, 1);

  return [focus, pressure];
}

export function validatePcActionDraft(draft: PcActionDraft) {
  const warnings: string[] = [];
  if (!draft.name?.trim()) warnings.push("Action name is required.");
  if (draft.rollMode === "attack" && !String(draft.attackBonus ?? "").trim()) warnings.push("Attack actions need an attack bonus/formula.");
  if (draft.rollMode === "save" && (!draft.saveAbility?.trim() || !String(draft.saveDc ?? "").trim())) warnings.push("Save actions need save ability and DC.");
  if (draft.rollMode === "healing" && !draft.healing?.trim()) warnings.push("Healing actions need a healing formula.");
  if (draft.tab === "bond" && draft.actionCost !== "bond") warnings.push("Bond-tab actions should use actionCost: bond.");
  if (draft.tab === "spell" && draft.slotCost && !String(draft.slotCost).trim()) warnings.push("Spell actions should carry a slot cost when known.");
  if (draft.lockGroup && draft.tab !== "bond") warnings.push("Lock groups are mainly intended for Bond choices unless a DM explicitly configures another action family.");
  return warnings;
}
