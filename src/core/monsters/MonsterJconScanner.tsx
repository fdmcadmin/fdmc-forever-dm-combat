import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FDMC_PRIVATE_MONSTER_LIBRARY_KEY,
  FDMC_PUBLIC_MONSTER_SNAPSHOTS_KEY,
  FDMC_SESSION_MONSTER_CANDIDATES_KEY,
  createPublicMonsterSnapshot,
} from "../jcon/jconStorageBoundary";
import OBR, { type Item, type Metadata } from "@owlbear-rodeo/sdk";
// Type-only, so it is erased at compile — mainMonsterRuntime already type-imports from
// this file, and neither side gains a runtime dependency on the other.
import type { MonsterClassification, MonsterKind } from "./runtime/mainMonsterRuntime";

type JconScanStatus =
  | "idle"
  | "not-in-owlbear"
  | "scene-not-ready"
  | "scanning"
  | "ready"
  | "error";

export type MonsterReaderAction = {
  name: string;
  kind: "action" | "attack" | "reaction" | "spell" | "trait";
  roll?: string;
  damage?: string;
  save?: string;
  text?: string;
  attackCount?: number;
  /** Recharge range e.g. "6", "5-6", "4-6" — ability re-enables on successful 1d6 roll */
  recharge?: string;
  /** Spell-slot level this action spends (1–9). Shows a level pill on the row and decrements
   *  the creature's matching `stats.spellSlots` pool on use. */
  spellSlotLevel?: number;
  /** Legendary-action cost (1 or 2). Set = this is a legendary action spending from the
   *  creature's `stats.legendaryPerRound` pool (Monster Gate A6). */
  legendaryCost?: number;
};

export type MonsterActionCounter = {
  label: string;
  total: number;
  remaining: number;
  sourceActionName?: string;
  actionNames?: string[];
};

export type MonsterReaderPreview = {
  sourcePath: string;
  name: string;
  schema?: string;
  kind?: string;
  hp?: string;
  ac?: string;
  speed?: string;
  /**
   * `value` is the display string ("14 (+2)"); the check modifier is parsed out of it.
   *
   * `save` is the SAVING-THROW modifier, which is NOT the same number as the check for a
   * creature proficient in that save (5e lists "Saving Throws: CON +6" independently of
   * "Skills: Perception +5"). Leave it undefined and the save equals the check — correct
   * for a creature with no save proficiency, which is every Act 2 creature as authored.
   */
  abilityScores: { label: string; value: string; save?: number }[];
  traits: MonsterReaderAction[];
  actions: MonsterReaderAction[];
  reactions: MonsterReaderAction[];
  spells: MonsterReaderAction[];
  actionCounter?: MonsterActionCounter;
  warnings: string[];
  rawKeys: string[];
};

type JconCandidateReadiness =
  | "ready-preview"
  | "needs-source-wake"
  | "metadata-signal";

type JconScanCandidate = {
  id: string;
  name: string;
  layer: string;
  type: string;
  strength: "native" | "likely" | "possible";
  readiness: JconCandidateReadiness;
  sourceFlavor: "FDM" | "Forge" | "Foundry" | "JCON" | "Metadata";
  matches: string[];
  preview?: MonsterReaderPreview;
};

type JconScanState = {
  status: JconScanStatus;
  scannedItems: number;
  candidates: JconScanCandidate[];
  lastScannedAt?: string;
  error?: string;
};


export type MonsterCombatCandidate = {
  id: string;
  name: string;
  kind: MonsterKind;
  hp?: string;
  ac?: string;
  sourceFlavor: string;
  speed?: string;
  abilityScores?: MonsterReaderPreview["abilityScores"];
  actions?: MonsterReaderAction[];
  reactions?: MonsterReaderAction[];
  traits?: MonsterReaderAction[];
  spells?: MonsterReaderAction[];
  actionCounter?: MonsterActionCounter;
  /** Attacks per turn declared on the creature — drives the multiattack counter directly,
   *  independent of what any action is named. */
  attacksPerTurn?: number;
  /** Spell slots per level, carried from the template so the card can track them. */
  spellSlots?: { level: number; max: number }[];
  /** Threat tier, carried from the template. Drives the heavy HP bar for mid-boss+ in the
   *  roster and the players' tracker. */
  classification?: MonsterClassification;
  /** Identity line on the card header: "Undead • Controller • Act Boss". */
  creatureType?: string;
  archetype?: string;
  /** Per-creature skill list, carried from the template. */
  skills?: { label: string; modifier: number }[];
  usedActionNames?: string[];
  // Main runtime absorption fields from Monster Cards BUILD 0.3.0c.
  // These keep the template/source record separate from live encounter state.
  instanceId?: string;
  templateId?: string;
  displayName?: string;
  currentHp?: number;
  maxHp?: number;
  tempHp?: number;
  status?: string;
  visibilityState?: "hidden" | "label-only" | "condition" | "hp-bar" | "full";
  hiddenName?: string;
  revealedName?: string;
  isNameRevealed?: boolean;
  templateRef?: string;
};

type MonsterJconScannerProps = {
  onCombatCandidatesChange?: (candidates: MonsterCombatCandidate[]) => void;
  onAddMonsterToCombatLog?: (candidate: MonsterCombatCandidate) => void;
};

type SavedMonsterDatabaseRecord = {
  id: string;
  name: string;
  raw: string;
  savedAt: string;
};

const MONSTER_DATABASE_STORAGE_KEY = FDMC_PRIVATE_MONSTER_LIBRARY_KEY;

function readSavedMonsterDatabase(): SavedMonsterDatabaseRecord[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(MONSTER_DATABASE_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((entry): entry is SavedMonsterDatabaseRecord => {
        if (!isPlainRecord(entry)) {
          return false;
        }

        return (
          typeof entry.id === "string" &&
          typeof entry.name === "string" &&
          typeof entry.raw === "string" &&
          typeof entry.savedAt === "string"
        );
      })
      .slice(0, 50);
  } catch {
    return [];
  }
}

function writeSavedMonsterDatabase(records: SavedMonsterDatabaseRecord[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(MONSTER_DATABASE_STORAGE_KEY, JSON.stringify(records.slice(0, 50)));
}

function isMonsterReaderAction(value: unknown): value is MonsterReaderAction {
  if (!isPlainRecord(value)) {
    return false;
  }

  return typeof value.name === "string" && typeof value.kind === "string";
}

function isMonsterCombatCandidate(value: unknown): value is MonsterCombatCandidate {
  if (!isPlainRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.kind === "string"
  );
}


function normalizeMonsterCombatKey(value: string | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "monster";
}

function isBlockedMetadataSignalMonster(candidate: Pick<MonsterCombatCandidate, "id" | "name" | "hp" | "actions" | "traits" | "reactions" | "spells">): boolean {
  const name = normalizeMonsterCombatKey(candidate.name);
  const id = normalizeMonsterCombatKey(candidate.id);
  const hasCombatPayload =
    (candidate.actions?.length ?? 0) > 0 ||
    (candidate.traits?.length ?? 0) > 0 ||
    (candidate.reactions?.length ?? 0) > 0 ||
    (candidate.spells?.length ?? 0) > 0;

  if (name.includes("jcon-combat-metadata-signal") || id.includes("jcon-combat-metadata-signal")) {
    return true;
  }

  return name === "metadata-signal" && !hasCombatPayload;
}

function compactMonsterCombatCandidates(candidates: MonsterCombatCandidate[]): MonsterCombatCandidate[] {
  const seen = new Set<string>();
  const compacted: MonsterCombatCandidate[] = [];

  for (const candidate of candidates) {
    if (isBlockedMetadataSignalMonster(candidate)) {
      continue;
    }

    const stableKey = normalizeMonsterCombatKey(candidate.name);
    if (seen.has(stableKey)) {
      continue;
    }

    seen.add(stableKey);
    compacted.push(candidate);
  }

  return compacted.slice(0, 24);
}

function readSessionMonsterCombatCandidates(): MonsterCombatCandidate[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(FDMC_SESSION_MONSTER_CANDIDATES_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(isMonsterCombatCandidate)
      .map((entry) => ({
        ...entry,
        actions: Array.isArray(entry.actions) ? entry.actions.filter(isMonsterReaderAction) : [],
        reactions: Array.isArray(entry.reactions) ? entry.reactions.filter(isMonsterReaderAction) : [],
        traits: Array.isArray(entry.traits) ? entry.traits.filter(isMonsterReaderAction) : [],
        spells: Array.isArray(entry.spells) ? entry.spells.filter(isMonsterReaderAction) : [],
        usedActionNames: Array.isArray(entry.usedActionNames)
          ? entry.usedActionNames.filter((name): name is string => typeof name === "string")
          : [],
      }))
      .filter((entry) => !isBlockedMetadataSignalMonster(entry))
      .reduce<MonsterCombatCandidate[]>((compacted, entry) => compactMonsterCombatCandidates([entry, ...compacted]), [])
      .slice(0, 24);
  } catch {
    return [];
  }
}

function writeSessionMonsterCombatCandidates(candidates: MonsterCombatCandidate[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(FDMC_SESSION_MONSTER_CANDIDATES_KEY, JSON.stringify(compactMonsterCombatCandidates(candidates)));
}

async function writePublicMonsterSnapshotsToRoom(candidates: MonsterCombatCandidate[]): Promise<string> {
  if (!OBR.isAvailable) {
    return "OBR unavailable; public monster snapshots were not sent.";
  }

  try {
    const obr = OBR as unknown as {
      room?: {
        getMetadata?: () => Promise<Record<string, unknown>> | Record<string, unknown>;
        setMetadata?: (metadata: Record<string, unknown>) => Promise<void> | void;
      };
    };
    const current = (await obr.room?.getMetadata?.()) ?? {};
    const snapshots = compactMonsterCombatCandidates(candidates).map(createPublicMonsterSnapshot);
    await obr.room?.setMetadata?.({
      ...current,
      [FDMC_PUBLIC_MONSTER_SNAPSHOTS_KEY]: snapshots,
    });
    return `Public monster snapshot sent: ${snapshots.length} monster${snapshots.length === 1 ? "" : "s"}.`;
  } catch (error) {
    return `Public monster snapshot send failed: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function readPublicMonsterSnapshotCountFromRoom(): Promise<string> {
  if (!OBR.isAvailable) {
    return "OBR unavailable; public monster snapshot check could not run.";
  }

  try {
    const obr = OBR as unknown as {
      room?: { getMetadata?: () => Promise<Record<string, unknown>> | Record<string, unknown> };
    };
    const metadata = (await obr.room?.getMetadata?.()) ?? {};
    const value = metadata[FDMC_PUBLIC_MONSTER_SNAPSHOTS_KEY];
    if (!Array.isArray(value)) {
      return "Public monster snapshot check: missing.";
    }
    return `Public monster snapshot check: ${value.length} monster${value.length === 1 ? "" : "s"} visible in room metadata.`;
  } catch (error) {
    return `Public monster snapshot check failed: ${error instanceof Error ? error.message : String(error)}`;
  }
}

function toMonsterCombatCandidate(candidate: JconScanCandidate): MonsterCombatCandidate {
  return {
    id: `monster:${candidate.id}`,
    name: candidate.preview?.name ?? candidate.name,
    kind: "unspecified",
    hp: candidate.preview?.hp,
    ac: candidate.preview?.ac,
    speed: candidate.preview?.speed,
    sourceFlavor: candidate.sourceFlavor,
    abilityScores: candidate.preview?.abilityScores,
    actions: candidate.preview?.actions,
    reactions: candidate.preview?.reactions,
    traits: candidate.preview?.traits,
    spells: candidate.preview?.spells,
    actionCounter: candidate.preview?.actionCounter,
    usedActionNames: [],
  };
}

function upsertCombatCandidate(candidates: MonsterCombatCandidate[], candidate: MonsterCombatCandidate): MonsterCombatCandidate[] {
  return compactMonsterCombatCandidates([candidate, ...candidates]);
}

function buildImportedMonsterCandidate(raw: string, sourceLabel: string): JconScanCandidate {
  const parsed = safeParseJsonRecord(raw);

  if (!parsed) {
    throw new Error("Import must be a JSON object JCON record.");
  }

  const hit = collectReadableJconRecordHits(parsed, sourceLabel).find((candidate) => candidate.name)
    ?? collectReadableJconRecordHits(parsed, sourceLabel)[0];

  if (!hit) {
    throw new Error("No readable monster HP/action/name payload found in that JCON.");
  }

  const preview = buildMonsterReaderPreview(hit, findNameInRecord(parsed));
  const stableName = preview.name || findNameInRecord(parsed) || "Imported Monster";
  const stableId = `${sourceLabel}:${stableName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "monster"}`;

  return {
    id: stableId,
    name: stableName,
    layer: sourceLabel,
    type: "builder import",
    strength: "native",
    readiness: "ready-preview",
    sourceFlavor: "FDM",
    matches: ["builder import: native monster JCON"],
    preview,
  };
}

const initialScanState: JconScanState = {
  status: "idle",
  scannedItems: 0,
  candidates: [],
};

type ReadableJconHit = {
  path: string;
  preview: string;
  name?: string;
  schema?: string;
  kind?: string;
};

type ReadableJconRecordHit = ReadableJconHit & {
  record: Record<string, unknown>;
};

const nativeSchemaHints = [
  "fdm/actor-v1",
  "fdm/monster-v1",
  "fdmc/monster-v1",
  "fdmc/actor-v1",
];

const jconKeyHints = [
  "jcon",
  "fdm",
  "fdmc",
  "forge",
  "foundry",
  "statblock",
  "statBlock",
  "unit",
  "monster",
  "creature",
  "actor",
];

const strongSignalHints = [
  "jcon",
  "fdm",
  "fdmc",
  "forge",
  "foundry",
  "statblock",
  "stat block",
];

const jconValueHints = [
  "fdm/actor-v1",
  "fdm/monster-v1",
  "fdmc/actor-v1",
  "fdmc/monster-v1",
  "jcon",
  "forge",
  "foundry",
  "statblock",
  "stat block",
  "monster",
  "creature",
  "actions",
  "traits",
  "reactions",
];

const actionContainerKeys = [
  "actions",
  "action",
  "attacks",
  "attack",
  "multiattack",
  "bonusActions",
  "bonus_actions",
  "legendaryActions",
  "legendary_actions",
];

const reactionContainerKeys = ["reactions", "reaction"];
const traitContainerKeys = ["traits", "features", "feature", "passives", "passive"];
const spellContainerKeys = ["spells", "spellcasting", "cantrips", "spellActions"];

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeScalar(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value.trim() || undefined;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return undefined;
}

function isGenericItemName(value: unknown): boolean {
  const text = normalizeText(value).toLowerCase();
  return (
    !text ||
    text === "unnamed map item" ||
    text === "unnamed item" ||
    text === "map item" ||
    text === "image"
  );
}

function previewValue(value: unknown): string {
  if (typeof value === "string") {
    return value.length > 72 ? `${value.slice(0, 72)}...` : value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return `array(${value.length})`;
  }

  if (isPlainRecord(value)) {
    const keys = Object.keys(value).slice(0, 7).join(", ");
    return `{${keys}${Object.keys(value).length > 7 ? ", ..." : ""}}`;
  }

  return typeof value;
}

function getCaseInsensitive(
  record: Record<string, unknown>,
  keys: string[],
): unknown {
  const wanted = new Set(keys.map((key) => key.toLowerCase()));

  for (const [rawKey, value] of Object.entries(record)) {
    if (wanted.has(rawKey.toLowerCase())) {
      return value;
    }
  }

  return undefined;
}

function hasCaseInsensitiveKey(
  record: Record<string, unknown>,
  keys: string[],
): boolean {
  return getCaseInsensitive(record, keys) !== undefined;
}

function findNameInRecord(record: Record<string, unknown>): string | undefined {
  const directName = normalizeText(
    getCaseInsensitive(record, [
      "name",
      "title",
      "label",
      "displayName",
      "unitName",
      "creatureName",
      "monsterName",
    ]),
  );

  if (directName) {
    return directName;
  }

  const nestedContainers = [
    "actor",
    "monster",
    "creature",
    "unit",
    "statblock",
    "statBlock",
    "data",
    "jcon",
  ];

  for (const key of nestedContainers) {
    const nested = getCaseInsensitive(record, [key]);
    if (isPlainRecord(nested)) {
      const nestedName = findNameInRecord(nested);
      if (nestedName) {
        return nestedName;
      }
    }
  }

  return undefined;
}

function safeParseJsonRecord(
  value: string,
): Record<string, unknown> | undefined {
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    return undefined;
  }

  try {
    const parsed: unknown = JSON.parse(trimmed);
    return isPlainRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function countCombatShapeHints(record: Record<string, unknown>): number {
  let hints = 0;

  if (
    hasCaseInsensitiveKey(record, [
      "hp",
      "mhp",
      "maxHp",
      "maxHP",
      "hitPoints",
      "hit_points",
      "health",
    ])
  ) {
    hints += 1;
  }

  if (hasCaseInsensitiveKey(record, ["ac", "armorClass", "armor_class"])) {
    hints += 1;
  }

  if (
    hasCaseInsensitiveKey(record, [
      "speed",
      "speeds",
      "movement",
      "walkSpeed",
      "walk",
      "fly",
      "swim",
      "burrow",
      "climb",
    ])
  ) {
    hints += 1;
  }

  if (
    hasCaseInsensitiveKey(record, [
      "stats",
      "abilities",
      "abilityScores",
      "str",
      "dex",
      "con",
      "int",
      "wis",
      "cha",
    ])
  ) {
    hints += 1;
  }

  if (
    hasCaseInsensitiveKey(record, [
      "actions",
      "traits",
      "features",
      "reactions",
      "legendaryActions",
      "legendary_actions",
      "attacks",
    ])
  ) {
    hints += 1;
  }

  if (
    hasCaseInsensitiveKey(record, [
      "cr",
      "challenge",
      "challengeRating",
      "size",
      "type",
      "creatureType",
      "creature_type",
    ])
  ) {
    hints += 1;
  }

  return hints;
}

function hasActionOrHpSignal(record: Record<string, unknown>): boolean {
  if (
    hasCaseInsensitiveKey(record, [
      "hp",
      "mhp",
      "maxHp",
      "maxHP",
      "hitPoints",
      "hit_points",
      "currentHp",
      "currentHP",
      "health",
    ])
  ) {
    return true;
  }

  if (
    hasCaseInsensitiveKey(record, [
      "actions",
      "action",
      "attacks",
      "attack",
      "multiattack",
      "reactions",
      "reaction",
      "legendaryActions",
      "legendary_actions",
      "bonusActions",
      "bonus_actions",
      "spells",
      "spellcasting",
    ])
  ) {
    return true;
  }

  const forgeCombatKeyPattern = /(?:^|[/_.-])(?:hp|mhp|maxhp|action|actions|attack|attacks|multiattack|reaction|reactions|legendary|spell|spellcasting)(?:$|[/_.-])/i;

  for (const [rawKey, child] of Object.entries(record)) {
    if (forgeCombatKeyPattern.test(rawKey)) {
      return true;
    }

    if (isPlainRecord(child) && hasActionOrHpSignal(child)) {
      return true;
    }

    if (Array.isArray(child)) {
      for (const entry of child.slice(0, 20)) {
        if (isPlainRecord(entry) && hasActionOrHpSignal(entry)) {
          return true;
        }
      }
    }

    if (typeof child === "string") {
      const parsed = safeParseJsonRecord(child);
      if (parsed && hasActionOrHpSignal(parsed)) {
        return true;
      }
    }
  }

  return false;
}

function collectCombatGateMatches(
  value: unknown,
  basePath = "metadata",
  depth = 0,
): string[] {
  if (depth > 5 || value === undefined || value === null) {
    return [];
  }

  const matches: string[] = [];
  const keyPattern = /(?:^|[/_.-])(?:hp|mhp|maxhp|hitpoints|hit_points|health|action|actions|attack|attacks|multiattack|reaction|reactions|legendary|spell|spellcasting)(?:$|[/_.-])/i;
  const valuePattern = /\b(?:hp|hit points?|actions?|attacks?|multiattack|reactions?|legendary actions?|spellcasting)\b/i;

  if (typeof value === "string") {
    const parsed = safeParseJsonRecord(value);
    if (parsed) {
      matches.push(...collectCombatGateMatches(parsed, basePath, depth + 1));
    } else if (valuePattern.test(value)) {
      matches.push(`${basePath}: ${previewValue(value)}`);
    }
    return matches;
  }

  if (Array.isArray(value)) {
    value.slice(0, 20).forEach((entry, index) => {
      matches.push(
        ...collectCombatGateMatches(entry, `${basePath}[${index}]`, depth + 1),
      );
    });
    return matches;
  }

  if (!isPlainRecord(value)) {
    return matches;
  }

  for (const [rawKey, child] of Object.entries(value)) {
    const path = `${basePath}.${rawKey}`;

    if (keyPattern.test(rawKey)) {
      matches.push(`${path}: ${previewValue(child)}`);
    }

    matches.push(...collectCombatGateMatches(child, path, depth + 1));
  }

  const seen = new Set<string>();
  return matches.filter((match) => {
    const key = match.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function isReadableJconRecord(record: Record<string, unknown>): boolean {
  const schema = normalizeText(
    getCaseInsensitive(record, ["schema"]),
  ).toLowerCase();
  const kind = normalizeText(
    getCaseInsensitive(record, ["kind"]),
  ).toLowerCase();
  const type = normalizeText(
    getCaseInsensitive(record, ["type", "creatureType", "creature_type"]),
  ).toLowerCase();

  if (nativeSchemaHints.some((hint) => schema.includes(hint))) {
    return Boolean(findNameInRecord(record));
  }

  const hasIdentity = Boolean(findNameInRecord(record));
  const hasCombatGate = hasActionOrHpSignal(record);
  const combatShapeHints = countCombatShapeHints(record);
  const isCreatureKind = ["monster", "npc", "creature", "actor", "unit"].some(
    (hint) => kind.includes(hint) || type.includes(hint),
  );

  return (
    hasIdentity &&
    hasCombatGate &&
    (combatShapeHints >= 2 || isCreatureKind)
  );
}

function readablePreview(record: Record<string, unknown>): string {
  const schema = normalizeText(getCaseInsensitive(record, ["schema"]));
  const kind = normalizeText(
    getCaseInsensitive(record, [
      "kind",
      "type",
      "creatureType",
      "creature_type",
    ]),
  );
  const name = findNameInRecord(record);
  const pieces = [schema || "readable JCON", kind, name].filter(Boolean);
  return pieces.join(" · ");
}

function collectReadableJconRecordHits(
  value: unknown,
  basePath = "metadata",
  depth = 0,
): ReadableJconRecordHit[] {
  if (depth > 5) {
    return [];
  }

  const hits: ReadableJconRecordHit[] = [];

  if (typeof value === "string") {
    const parsed = safeParseJsonRecord(value);
    if (parsed && isReadableJconRecord(parsed)) {
      hits.push({
        path: basePath,
        preview: readablePreview(parsed),
        name: findNameInRecord(parsed),
        schema: normalizeText(getCaseInsensitive(parsed, ["schema"])),
        kind: normalizeText(
          getCaseInsensitive(parsed, [
            "kind",
            "type",
            "creatureType",
            "creature_type",
          ]),
        ),
        record: parsed,
      });
    }
    return hits;
  }

  if (Array.isArray(value)) {
    value.slice(0, 20).forEach((entry, index) => {
      hits.push(
        ...collectReadableJconRecordHits(entry, `${basePath}[${index}]`, depth + 1),
      );
    });
    return hits;
  }

  if (!isPlainRecord(value)) {
    return hits;
  }

  if (isReadableJconRecord(value)) {
    hits.push({
      path: basePath,
      preview: readablePreview(value),
      name: findNameInRecord(value),
      schema: normalizeText(getCaseInsensitive(value, ["schema"])),
      kind: normalizeText(
        getCaseInsensitive(value, [
          "kind",
          "type",
          "creatureType",
          "creature_type",
        ]),
      ),
      record: value,
    });
  }

  for (const [rawKey, child] of Object.entries(value)) {
    hits.push(
      ...collectReadableJconRecordHits(child, `${basePath}.${rawKey}`, depth + 1),
    );
  }

  const seen = new Set<string>();
  return hits.filter((hit) => {
    const key = `${hit.path}|${hit.preview}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function collectReadableJconHits(
  value: unknown,
  basePath = "metadata",
  depth = 0,
): ReadableJconHit[] {
  return collectReadableJconRecordHits(value, basePath, depth).map(
    ({ record: _record, ...hit }) => hit,
  );
}

function collectBroadSignalMatches(
  value: unknown,
  basePath = "metadata",
  depth = 0,
): string[] {
  if (depth > 5 || value === undefined || value === null) {
    return [];
  }

  const matches: string[] = [];

  if (typeof value === "string") {
    const lowerValue = value.toLowerCase();
    if (
      jconValueHints.some((hint) => lowerValue.includes(hint.toLowerCase()))
    ) {
      matches.push(`${basePath}: ${previewValue(value)}`);
    }
    return matches;
  }

  if (Array.isArray(value)) {
    value.slice(0, 20).forEach((entry, index) => {
      matches.push(
        ...collectBroadSignalMatches(entry, `${basePath}[${index}]`, depth + 1),
      );
    });
    return matches;
  }

  if (!isPlainRecord(value)) {
    return matches;
  }

  for (const [rawKey, child] of Object.entries(value)) {
    const path = `${basePath}.${rawKey}`;
    const key = rawKey.toLowerCase();
    const keyLooksRelevant = jconKeyHints.some((hint) =>
      key.includes(hint.toLowerCase()),
    );

    if (keyLooksRelevant) {
      matches.push(`${path}: ${previewValue(child)}`);
    }

    matches.push(...collectBroadSignalMatches(child, path, depth + 1));
  }

  const seen = new Set<string>();
  return matches.filter((match) => {
    const key = match.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function collectMetadataMatches(metadata: Metadata | undefined): string[] {
  if (!metadata) {
    return [];
  }

  const readableMatches = collectReadableJconHits(metadata).map(
    (hit) => `${hit.path}: ${hit.preview}`,
  );
  const combatGateMatches = collectCombatGateMatches(metadata);
  const signalMatches =
    readableMatches.length > 0 || combatGateMatches.length > 0
      ? [...combatGateMatches, ...collectBroadSignalMatches(metadata)]
      : [];
  const seen = new Set<string>();

  return [...readableMatches, ...signalMatches]
    .filter((match) => {
      const key = match.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, 10);
}

function bestReadableJconName(
  metadata: Metadata | undefined,
): string | undefined {
  if (!metadata) {
    return undefined;
  }

  return collectReadableJconHits(metadata).find((hit) => hit.name)?.name;
}

function classifyCandidate(matches: string[]): JconScanCandidate["strength"] {
  const joined = matches.join(" ").toLowerCase();

  if (nativeSchemaHints.some((hint) => joined.includes(hint))) {
    return "native";
  }

  if (strongSignalHints.some((hint) => joined.includes(hint))) {
    return "likely";
  }

  return "possible";
}

function classifySourceFlavor(matches: string[]): JconScanCandidate["sourceFlavor"] {
  const joined = matches.join(" ").toLowerCase();

  if (joined.includes("fdmc") || joined.includes("fdm/")) {
    return "FDM";
  }

  if (joined.includes("battle-system.forge") || joined.includes("forge")) {
    return "Forge";
  }

  if (joined.includes("foundry")) {
    return "Foundry";
  }

  if (joined.includes("jcon")) {
    return "JCON";
  }

  return "Metadata";
}

function classifyReadiness(
  matches: string[],
  preview: MonsterReaderPreview | undefined,
): JconCandidateReadiness {
  if (preview) {
    return "ready-preview";
  }

  const joined = matches.join(" ").toLowerCase();

  if (joined.includes("battle-system.forge") || joined.includes("forge")) {
    return "needs-source-wake";
  }

  return "metadata-signal";
}

function readinessLabel(readiness: JconCandidateReadiness): string {
  if (readiness === "ready-preview") {
    return "Preview available";
  }

  if (readiness === "needs-source-wake") {
    return "Needs source view + rescan";
  }

  return "Metadata signal only";
}

function findFieldDeep(
  value: unknown,
  keys: string[],
  depth = 0,
): unknown {
  if (depth > 6 || value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === "string") {
    const parsed = safeParseJsonRecord(value);
    return parsed ? findFieldDeep(parsed, keys, depth + 1) : undefined;
  }

  if (Array.isArray(value)) {
    for (const entry of value.slice(0, 20)) {
      const found = findFieldDeep(entry, keys, depth + 1);
      if (found !== undefined) {
        return found;
      }
    }
    return undefined;
  }

  if (!isPlainRecord(value)) {
    return undefined;
  }

  const direct = getCaseInsensitive(value, keys);
  if (direct !== undefined) {
    return direct;
  }

  const preferredNestedKeys = [
    "actor",
    "monster",
    "creature",
    "unit",
    "statblock",
    "statBlock",
    "data",
    "jcon",
    "system",
    "attributes",
  ];

  for (const key of preferredNestedKeys) {
    const nested = getCaseInsensitive(value, [key]);
    const found = findFieldDeep(nested, keys, depth + 1);
    if (found !== undefined) {
      return found;
    }
  }

  for (const child of Object.values(value)) {
    const found = findFieldDeep(child, keys, depth + 1);
    if (found !== undefined) {
      return found;
    }
  }

  return undefined;
}

function formatHp(value: unknown): string | undefined {
  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value === "string") {
    const clean = value.trim();
    if (!clean) {
      return undefined;
    }

    const fraction = clean.match(/(\d+)\s*\/\s*(\d+)/);
    if (fraction) {
      return `${fraction[1]}/${fraction[2]}`;
    }

    const hitPointText = clean.match(
      /(?:hp|hit points?)\D{0,18}(\d+)(?:\D{0,12}(?:max|maximum|total)\D{0,8}(\d+))?/i,
    );
    if (hitPointText) {
      return hitPointText[2] ? `${hitPointText[1]}/${hitPointText[2]}` : hitPointText[1];
    }

    return clean;
  }

  if (!isPlainRecord(value)) {
    return undefined;
  }

  const current = normalizeScalar(
    getCaseInsensitive(value, [
      "value",
      "current",
      "hp",
      "currentHp",
      "currentHP",
      "current_hit_points",
    ]),
  );
  const max = normalizeScalar(
    getCaseInsensitive(value, [
      "max",
      "maximum",
      "mhp",
      "maxHp",
      "maxHP",
      "max_hit_points",
      "hitPointMaximum",
    ]),
  );

  if (current && max) {
    return `${current}/${max}`;
  }

  return current ?? max ?? previewValue(value);
}

function formatAc(value: unknown): string | undefined {
  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value === "string") {
    const clean = value.trim();
    if (!clean) {
      return undefined;
    }

    const armorClassText = clean.match(/(?:ac|armor class)\D{0,16}(\d+)/i);
    return armorClassText?.[1] ?? clean;
  }

  if (!isPlainRecord(value)) {
    return undefined;
  }

  return (
    normalizeScalar(
      getCaseInsensitive(value, ["value", "base", "ac", "armorClass", "armor_class"]),
    ) ?? previewValue(value)
  );
}

function formatMovement(value: unknown): string | undefined {
  if (typeof value === "number" || typeof value === "string") {
    return normalizeScalar(value);
  }

  if (!isPlainRecord(value)) {
    return undefined;
  }

  const parts = [
    ["walk", "Walk"],
    ["land", "Walk"],
    ["fly", "Fly"],
    ["swim", "Swim"],
    ["climb", "Climb"],
    ["burrow", "Burrow"],
  ].flatMap(([key, label]) => {
    const found = normalizeScalar(getCaseInsensitive(value, [key]));
    return found ? [`${label} ${found}`] : [];
  });

  return parts.length > 0 ? parts.join(" · ") : previewValue(value);
}

function collectAbilityScores(record: Record<string, unknown>): { label: string; value: string }[] {
  const abilityMap = [
    ["STR", ["str", "strength"]],
    ["DEX", ["dex", "dexterity"]],
    ["CON", ["con", "constitution"]],
    ["INT", ["int", "intelligence"]],
    ["WIS", ["wis", "wisdom"]],
    ["CHA", ["cha", "charisma"]],
  ] as const;

  return abilityMap.flatMap(([label, keys]) => {
    const direct = findFieldDeep(record, [...keys, label]);

    if (isPlainRecord(direct)) {
      const score = normalizeScalar(
        getCaseInsensitive(direct, ["score", "value", "base", "mod", "modifier"]),
      );
      return score ? [{ label, value: score }] : [];
    }

    const score = normalizeScalar(direct);
    return score ? [{ label, value: score }] : [];
  });
}

function normalizeActionName(value: unknown, fallback: string): string {
  const text = normalizeText(value);
  if (text) {
    return text;
  }

  return fallback;
}

function parseActionEntry(
  value: unknown,
  kind: MonsterReaderAction["kind"],
  index: number,
): MonsterReaderAction | null {
  if (typeof value === "string") {
    const text = value.trim();
    if (!text) {
      return null;
    }

    const colonName = text.split(":")[0]?.trim();
    const sentenceName = text.split(/[.\n]/)[0]?.trim();
    const name = (colonName && colonName.length <= 42 ? colonName : sentenceName) || `${kind} ${index + 1}`;

    return {
      name: cleanMonsterActionName(name),
      kind,
      text: text.length > 180 ? cleanMonsterActionName(`${text.slice(0, 180)}...`) : cleanMonsterActionName(text),
    };
  }

  if (!isPlainRecord(value)) {
    return null;
  }

  const name = normalizeActionName(
    getCaseInsensitive(value, ["name", "title", "label", "actionName", "attackName", "spellName"]),
    `${kind} ${index + 1}`,
  );

  const roll = normalizeScalar(
    getCaseInsensitive(value, ["roll", "formula", "attack", "attackFormula", "toHit", "hit", "bonus"]),
  );
  const damage = normalizeScalar(
    getCaseInsensitive(value, ["damage", "damageFormula", "damageRoll", "damageDice"]),
  );
  const save = normalizeScalar(
    getCaseInsensitive(value, ["save", "saveDc", "saveDC", "dc", "savingThrow"]),
  );
  const text = normalizeScalar(
    getCaseInsensitive(value, ["text", "description", "effect", "notes", "details"]),
  );

  return {
    name: cleanMonsterActionName(name),
    kind,
    roll,
    damage,
    save,
    text: text && text.length > 180 ? cleanMonsterActionName(`${text.slice(0, 180)}...`) : text ? cleanMonsterActionName(text) : text,
  };
}

function collectActionEntriesFromContainer(
  container: unknown,
  kind: MonsterReaderAction["kind"],
): MonsterReaderAction[] {
  if (container === undefined || container === null) {
    return [];
  }

  if (typeof container === "string") {
    const parsed = safeParseJsonRecord(container);
    if (parsed) {
      return collectActionEntriesFromContainer(parsed, kind);
    }
    const parsedAction = parseActionEntry(container, kind, 0);
    return parsedAction ? [parsedAction] : [];
  }

  if (Array.isArray(container)) {
    return container
      .slice(0, 12)
      .map((entry, index) => parseActionEntry(entry, kind, index))
      .filter((entry): entry is MonsterReaderAction => Boolean(entry));
  }

  if (isPlainRecord(container)) {
    const values = Object.entries(container)
      .slice(0, 12)
      .map(([key, entry], index) => {
        const parsed = parseActionEntry(entry, kind, index);
        return parsed ? { ...parsed, name: parsed.name === `${kind} ${index + 1}` ? key : parsed.name } : null;
      })
      .filter((entry): entry is MonsterReaderAction => Boolean(entry));

    if (values.length > 0) {
      return values;
    }
  }

  return [];
}

function collectActionEntriesDeep(
  value: unknown,
  keys: string[],
  kind: MonsterReaderAction["kind"],
  depth = 0,
): MonsterReaderAction[] {
  if (depth > 5 || value === undefined || value === null) {
    return [];
  }

  if (typeof value === "string") {
    const parsed = safeParseJsonRecord(value);
    return parsed ? collectActionEntriesDeep(parsed, keys, kind, depth + 1) : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectActionEntriesDeep(entry, keys, kind, depth + 1));
  }

  if (!isPlainRecord(value)) {
    return [];
  }

  const direct = getCaseInsensitive(value, keys);
  const directEntries = collectActionEntriesFromContainer(direct, kind);

  const nestedEntries = Object.entries(value).flatMap(([rawKey, child]) => {
    if (keys.some((key) => key.toLowerCase() === rawKey.toLowerCase())) {
      return [];
    }

    return collectActionEntriesDeep(child, keys, kind, depth + 1);
  });

  const seen = new Set<string>();
  return [...directEntries, ...nestedEntries].filter((entry) => {
    const key = `${entry.kind}|${entry.name}|${entry.roll ?? ""}|${entry.damage ?? ""}|${entry.save ?? ""}`.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  }).slice(0, 12);
}

const numberWords: Record<string, number> = {
  one: 1,
  two: 2,
  twice: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
};

function cleanMonsterActionName(name: string): string {
  return name
    .replace(/\bPhantom\s+Rack\b/gi, "Phantom Rake")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeMonsterAction(action: MonsterReaderAction): MonsterReaderAction {
  const name = cleanMonsterActionName(action.name);
  const text = action.text ? cleanMonsterActionName(action.text) : action.text;
  return { ...action, name, text };
}

function uniqueActionNames(actions: MonsterReaderAction[]): string[] {
  const seen = new Set<string>();
  return actions
    .map((action) => cleanMonsterActionName(action.name))
    .filter((name) => {
      const key = name.toLowerCase();
      if (!name || seen.has(key) || /multi\s*attack|multiattack/i.test(name)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

function parseSmallNumber(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const clean = value.trim().toLowerCase();
  const numeric = Number.parseInt(clean, 10);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric;
  }

  return numberWords[clean];
}

function inferMultiattackCount(actions: MonsterReaderAction[]): MonsterActionCounter | undefined {
  const multiattack = actions.find((action) => /multi\s*attack|multiattack/i.test(`${action.name} ${action.text ?? ""}`));
  if (!multiattack) {
    return undefined;
  }

  const text = cleanMonsterActionName(`${multiattack.name}. ${multiattack.text ?? ""}`);
  const namedActions = uniqueActionNames(actions).filter((name) => text.toLowerCase().includes(name.toLowerCase()));
  if (namedActions.length > 0) {
    return {
      label: `Multiattack: ${namedActions.join(" + ")}`,
      total: namedActions.length,
      remaining: namedActions.length,
      sourceActionName: cleanMonsterActionName(multiattack.name),
      actionNames: namedActions,
    };
  }

  const patterns = [
    /\b(?:makes?|make)\s+(one|two|twice|three|four|five|six|\d+)\s+(?:[^.]{0,40}?\s)?attacks?\b/i,
    /\b(one|two|twice|three|four|five|six|\d+)\s+(?:melee|ranged|weapon|spell|claw|bite|slam|tentacle|attack)\s+attacks?\b/i,
    /\battacks?\s+(one|two|twice|three|four|five|six|\d+)\s+times?\b/i,
  ];

  for (const pattern of patterns) {
    const count = parseSmallNumber(text.match(pattern)?.[1]);
    if (count && count > 0) {
      return { label: `Multiattack x${count}`, total: count, remaining: count, sourceActionName: cleanMonsterActionName(multiattack.name), actionNames: namedActions };
    }
  }

  // Emergency fallback: if a JCON exposes a Multiattack action but the text is too custom to parse,
  // ready a 2-action counter so the DM has a usable monster turn tracker tonight.
  return { label: "Multiattack x2", total: 2, remaining: 2, sourceActionName: cleanMonsterActionName(multiattack.name), actionNames: namedActions };
}

function buildWarnings(preview: Omit<MonsterReaderPreview, "warnings">): string[] {
  const warnings: string[] = [];

  if (!preview.hp) {
    warnings.push("HP not detected.");
  }

  if (!preview.ac) {
    warnings.push("AC not detected.");
  }

  if (preview.actions.length === 0) {
    warnings.push("No action/attack lines detected.");
  }

  if (preview.abilityScores.length === 0) {
    warnings.push("Ability scores not detected.");
  }

  return warnings;
}

function buildMonsterReaderPreview(
  hit: ReadableJconRecordHit,
  fallbackName?: string,
): MonsterReaderPreview {
  const record = hit.record;
  const rawHp =
    findFieldDeep(record, ["hp", "hitPoints", "hit_points", "health", "currentHp", "currentHP"]) ??
    findFieldDeep(record, ["mhp", "maxHp", "maxHP"]);
  const hp = formatHp(rawHp);
  const ac = formatAc(
    findFieldDeep(record, ["ac", "armorClass", "armor_class", "armor", "defense"]),
  );
  const speed = formatMovement(
    findFieldDeep(record, [
      "speed",
      "speeds",
      "movement",
      "walkSpeed",
      "walk",
      "movementSpeed",
      "speedWalk",
    ]),
  );
  const actions = collectActionEntriesDeep(record, actionContainerKeys, "action").map(normalizeMonsterAction);
  const reactions = collectActionEntriesDeep(record, reactionContainerKeys, "reaction").map(normalizeMonsterAction);
  const traits = collectActionEntriesDeep(record, traitContainerKeys, "trait").map(normalizeMonsterAction);
  const spells = collectActionEntriesDeep(record, spellContainerKeys, "spell").map(normalizeMonsterAction);

  const previewWithoutWarnings = {
    sourcePath: hit.path,
    name: hit.name ?? fallbackName ?? "Unnamed Monster JCON",
    schema: hit.schema,
    kind: hit.kind,
    hp,
    ac,
    speed,
    abilityScores: collectAbilityScores(record),
    traits,
    actions,
    reactions,
    spells,
    actionCounter: inferMultiattackCount(actions),
    rawKeys: Object.keys(record).slice(0, 14),
  };

  return {
    ...previewWithoutWarnings,
    warnings: buildWarnings(previewWithoutWarnings),
  };
}

function stripMatchPrefix(match: string): string {
  const colonIndex = match.indexOf(":");
  const text = colonIndex >= 0 ? match.slice(colonIndex + 1).trim() : match.trim();
  return text.replace(/^description:\s*/i, "").trim();
}

function extractBracketFormula(text: string, fallbackPattern?: RegExp): string | undefined {
  const bracketMatches = [...text.matchAll(/\[([^\]]+)\]/g)].map((match) => match[1]?.trim()).filter(Boolean);

  if (bracketMatches.length > 0) {
    return bracketMatches[0];
  }

  if (fallbackPattern) {
    const fallback = text.match(fallbackPattern)?.[1]?.trim();
    return fallback || undefined;
  }

  return undefined;
}

function extractDamageFormula(text: string): string | undefined {
  const hitText = text.match(/hit:\s*([^.;]+)/i)?.[1]?.trim();
  if (!hitText) {
    return undefined;
  }

  return extractBracketFormula(hitText, /(\d+d\d+(?:\s*[+\-]\s*\d+)?)/i);
}

function buildActionFromSignalLine(text: string, index: number): MonsterReaderAction | null {
  const cleanText = text.trim();
  if (!cleanText) {
    return null;
  }

  const isAttackLine = /\b(?:melee weapon attack|ranged weapon attack|spell attack|to hit|attack roll)\b/i.test(cleanText);
  if (!isAttackLine) {
    return null;
  }

  const namedPrefix = cleanText.match(/^([^:.]{3,48}?):\s*(?:melee|ranged|spell|\[?1d20)/i)?.[1]?.trim();
  const weaponAttack = cleanText.match(/\b((?:melee|ranged) weapon attack|spell attack)\b/i)?.[1]?.trim();
  const name = namedPrefix || weaponAttack || `Attack ${index + 1}`;
  const roll = extractBracketFormula(cleanText, /(1d20\s*[+\-]\s*\d+)/i);
  const damage = extractDamageFormula(cleanText);

  return {
    name,
    kind: "attack",
    roll,
    damage,
    text: cleanText.length > 190 ? `${cleanText.slice(0, 190)}...` : cleanText,
  };
}

function buildTraitFromSignalLine(text: string, index: number): MonsterReaderAction | null {
  const cleanText = text.trim();
  if (!cleanText || /\b(?:to hit|melee weapon attack|ranged weapon attack|spell attack)\b/i.test(cleanText)) {
    return null;
  }

  if (!/\b(?:advantage|disadvantage|resistance|immune|immunity|trait|feature|senses|pack tactics|keen)\b/i.test(cleanText)) {
    return null;
  }

  const name = cleanText.match(/^([^:.]{3,48}?):/)?.[1]?.trim() || `Trait ${index + 1}`;

  return {
    name,
    kind: "trait",
    text: cleanText.length > 190 ? `${cleanText.slice(0, 190)}...` : cleanText,
  };
}

function buildSignalMonsterReaderPreview(
  matches: string[],
  fallbackName: string,
  sourceFlavor: JconScanCandidate["sourceFlavor"],
): MonsterReaderPreview | undefined {
  const readableLines = matches
    .map(stripMatchPrefix)
    .filter((line) => line && !/^array\(|^\{/.test(line));

  const actions = readableLines
    .map((line, index) => buildActionFromSignalLine(line, index))
    .filter((entry): entry is MonsterReaderAction => Boolean(entry))
    .slice(0, 8);

  const traits = readableLines
    .map((line, index) => buildTraitFromSignalLine(line, index))
    .filter((entry): entry is MonsterReaderAction => Boolean(entry))
    .slice(0, 8);

  const hp = readableLines
    .map((line) =>
      line.match(
        /\b(?:mhp|hp|hit points?)\D{0,18}(\d+)(?:\D{0,12}(?:max|maximum|total)\D{0,8}(\d+))?/i,
      ),
    )
    .map((match) => (match ? (match[2] ? `${match[1]}/${match[2]}` : match[1]) : undefined))
    .find(Boolean);
  const ac = readableLines
    .map((line) => line.match(/\b(?:ac|armor class)\D{0,16}(\d+)\b/i)?.[1])
    .find(Boolean);
  const speed = readableLines
    .map((line) => line.match(/\b(?:speed|walk|movement)\D{0,16}(\d+\s*ft\.?|\d+)\b/i)?.[1])
    .find(Boolean);
  const abilityScores = ([
    ["STR", /\b(?:str|strength)\D{0,10}(\d{1,2})\b/i],
    ["DEX", /\b(?:dex|dexterity)\D{0,10}(\d{1,2})\b/i],
    ["CON", /\b(?:con|constitution)\D{0,10}(\d{1,2})\b/i],
    ["INT", /\b(?:int|intelligence)\D{0,10}(\d{1,2})\b/i],
    ["WIS", /\b(?:wis|wisdom)\D{0,10}(\d{1,2})\b/i],
    ["CHA", /\b(?:cha|charisma)\D{0,10}(\d{1,2})\b/i],
  ] as const).flatMap(([label, pattern]) => {
    const score = readableLines.map((line) => line.match(pattern)?.[1]).find(Boolean);
    return score ? [{ label, value: score }] : [];
  });

  if (!hp && !ac && !speed && abilityScores.length === 0 && actions.length === 0 && traits.length === 0) {
    return undefined;
  }

  const previewWithoutWarnings = {
    sourcePath: `${sourceFlavor} metadata signal`,
    name: fallbackName || "Monster metadata signal",
    schema: undefined,
    kind: sourceFlavor === "Forge" ? "Forge-populated metadata" : "metadata signal",
    hp,
    ac,
    speed,
    abilityScores,
    traits,
    actions,
    reactions: [],
    spells: [],
    rawKeys: ["metadata signal", sourceFlavor],
  };

  const warnings = buildWarnings(previewWithoutWarnings);
  warnings.unshift("Partial preview from exposed Owlbear metadata. Open/View Unit + Rescan or use native FDM JCON for full HP/stat fields.");

  return {
    ...previewWithoutWarnings,
    warnings,
  };
}

function candidateSummary(candidate: JconScanCandidate): string {
  if (!candidate.preview) {
    return "Metadata seen; not enough readable combat fields yet.";
  }

  const parts = [
    candidate.preview.hp ? `HP ${candidate.preview.hp}` : undefined,
    candidate.preview.ac ? `AC ${candidate.preview.ac}` : undefined,
    candidate.preview.actions.length > 0 ? `${candidate.preview.actions.length} action${candidate.preview.actions.length === 1 ? "" : "s"}` : undefined,
    candidate.preview.traits.length > 0 ? `${candidate.preview.traits.length} trait${candidate.preview.traits.length === 1 ? "" : "s"}` : undefined,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : "Partial metadata preview available.";
}

function readableCandidateLine(candidate: JconScanCandidate): string {
  const firstAction = candidate.preview?.actions[0];
  if (firstAction) {
    const formula = firstAction.roll ? ` ${firstAction.roll}` : "";
    return `${firstAction.name}${formula}`;
  }

  const firstTrait = candidate.preview?.traits[0];
  if (firstTrait) {
    return firstTrait.name;
  }

  return candidateSummary(candidate);
}

function bestReadableJconPreview(
  metadata: Metadata | undefined,
  fallbackName?: string,
): MonsterReaderPreview | undefined {
  if (!metadata) {
    return undefined;
  }

  const hit = collectReadableJconRecordHits(metadata).find((candidate) => candidate.name) ?? collectReadableJconRecordHits(metadata)[0];

  return hit ? buildMonsterReaderPreview(hit, fallbackName) : undefined;
}

function buildCandidateFromMetadata(
  metadata: Metadata | undefined,
  id: string,
  layer: string,
  type: string,
  sourceName?: string,
): JconScanCandidate | null {
  const matches = collectMetadataMatches(metadata);

  if (matches.length === 0) {
    return null;
  }

  const readableName = bestReadableJconName(metadata);
  const cleanSourceName = isGenericItemName(sourceName)
    ? undefined
    : normalizeText(sourceName);
  const strength = classifyCandidate(matches);
  const combatGateMatches = collectCombatGateMatches(metadata);

  if (!readableName && combatGateMatches.length === 0) {
    return null;
  }

  const displayName = readableName ?? cleanSourceName ?? "JCON combat metadata signal";
  const sourceFlavor = classifySourceFlavor(matches);
  const preview =
    bestReadableJconPreview(metadata, displayName) ??
    buildSignalMonsterReaderPreview(matches, displayName, sourceFlavor);
  const readiness = classifyReadiness(matches, preview);

  return {
    id,
    name: preview?.name ?? displayName,
    layer,
    type,
    strength,
    readiness,
    sourceFlavor,
    matches,
    preview,
  };
}

function dedupeCandidates(
  candidates: JconScanCandidate[],
): JconScanCandidate[] {
  const seen = new Set<string>();

  return candidates.filter((candidate) => {
    const key = candidate.id;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function buildCandidatesFromItems(
  items: Item[],
  sourceLabel = "map item",
): JconScanCandidate[] {
  return items
    .map((item) =>
      buildCandidateFromMetadata(
        item.metadata,
        item.id,
        `${sourceLabel} · ${String(item.layer)}`,
        item.type,
        item.name,
      ),
    )
    .filter((candidate): candidate is JconScanCandidate => Boolean(candidate));
}

function buildCandidatesFromMetadataSource(
  metadata: Metadata | undefined,
  sourceId: string,
  sourceLabel: string,
): JconScanCandidate[] {
  const matches = collectMetadataMatches(metadata);

  if (matches.length === 0) {
    return [];
  }

  const readableName = bestReadableJconName(metadata);
  const combatGateMatches = collectCombatGateMatches(metadata);

  if (!readableName && combatGateMatches.length === 0) {
    return [];
  }

  const sourceFlavor = classifySourceFlavor(matches);
  const preview =
    bestReadableJconPreview(metadata, readableName ?? undefined) ??
    buildSignalMonsterReaderPreview(
      matches,
      readableName ?? "JCON combat metadata signal",
      sourceFlavor,
    );
  const readiness = classifyReadiness(matches, preview);

  return [
    {
      id: sourceId,
      name: preview?.name ?? readableName ?? "JCON combat metadata signal",
      layer: sourceLabel,
      type: "metadata",
      strength: classifyCandidate(matches),
      readiness,
      sourceFlavor,
      matches,
      preview,
    },
  ];
}

function ActionPreviewList({ title, actions }: { title: string; actions: MonsterReaderAction[] }) {
  if (actions.length === 0) {
    return null;
  }

  return (
    <div className="monster-reader-action-section">
      <h4>{title}</h4>
      <div className="monster-reader-action-list">
        {actions.slice(0, 6).map((action, index) => (
          <article className="monster-reader-action" key={`${title}-${action.name}-${index}`}>
            <div className="monster-reader-action-head">
              <strong>{action.name}</strong>
              <span>{action.kind}</span>
            </div>
            <div className="monster-reader-action-lines">
              {action.roll && <span>Roll: {action.roll}</span>}
              {action.damage && <span>Damage: {action.damage}</span>}
              {action.save && <span>Save: {action.save}</span>}
              {action.text && <p>{action.text}</p>}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export function MonsterJconScanner({ onCombatCandidatesChange, onAddMonsterToCombatLog }: MonsterJconScannerProps = {}) {
  const [scanState, setScanState] = useState<JconScanState>(initialScanState);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | undefined>();
  const [importText, setImportText] = useState("");
  const [importStatus, setImportStatus] = useState<string | undefined>();
  const [savedMonsters, setSavedMonsters] = useState<SavedMonsterDatabaseRecord[]>(() => readSavedMonsterDatabase());
  const [builderCandidates, setBuilderCandidates] = useState<JconScanCandidate[]>([]);
  const [sessionCombatCandidates, setSessionCombatCandidates] = useState<MonsterCombatCandidate[]>(() => readSessionMonsterCombatCandidates());
  const [publicSnapshotStatus, setPublicSnapshotStatus] = useState<string | undefined>();

  const scanItems = useCallback(
    (items: Item[], extraCandidates: JconScanCandidate[] = []) => {
      const candidates = dedupeCandidates([
        ...buildCandidatesFromItems(items),
        ...extraCandidates,
      ]);

      setScanState({
        status: "ready",
        scannedItems: items.length,
        candidates,
        lastScannedAt: new Date().toLocaleTimeString(),
      });

      setSelectedCandidateId((current) => {
        if (current && candidates.some((candidate) => candidate.id === current)) {
          return current;
        }

        return candidates[0]?.id;
      });
    },
    [],
  );

  const scanScene = useCallback(async () => {
    if (!OBR.isAvailable) {
      setScanState({
        status: "not-in-owlbear",
        scannedItems: 0,
        candidates: [],
        error: "Open inside an Owlbear room to scan map tokens/items.",
      });
      return;
    }

    setScanState((current) => ({
      ...current,
      status: "scanning",
      error: undefined,
    }));

    try {
      const sceneReady = await OBR.scene.isReady();

      if (!sceneReady) {
        setScanState({
          status: "scene-not-ready",
          scannedItems: 0,
          candidates: [],
          error: "No active Owlbear scene is ready yet.",
        });
        return;
      }

      const [items, localItems, sceneMetadata, roomMetadata] =
        await Promise.all([
          OBR.scene.items.getItems(),
          OBR.scene.local.getItems().catch(() => [] as Item[]),
          OBR.scene.getMetadata().catch(() => undefined),
          OBR.room.getMetadata().catch(() => undefined),
        ]);

      const metadataCandidates = [
        ...buildCandidatesFromItems(localItems, "local item"),
        ...buildCandidatesFromMetadataSource(
          sceneMetadata,
          "scene-metadata",
          "scene metadata",
        ),
        ...buildCandidatesFromMetadataSource(
          roomMetadata,
          "room-metadata",
          "room metadata",
        ),
      ];

      scanItems(items, metadataCandidates);
    } catch (error) {
      setScanState({
        status: "error",
        scannedItems: 0,
        candidates: [],
        error:
          error instanceof Error
            ? error.message
            : "Unable to scan Owlbear scene items.",
      });
    }
  }, [scanItems]);

  useEffect(() => {
    if (!OBR.isAvailable) {
      setScanState({
        status: "not-in-owlbear",
        scannedItems: 0,
        candidates: [],
        error: "Open inside an Owlbear room to scan map tokens/items.",
      });
      return undefined;
    }

    let cleanupItems: (() => void) | undefined;
    let cleanupReady: (() => void) | undefined;

    const setupScan = () => {
      void scanScene();
      cleanupItems = OBR.scene.items.onChange(() => {
        void scanScene();
      });
      cleanupReady = OBR.scene.onReadyChange((ready) => {
        if (ready) {
          void scanScene();
        } else {
          setScanState({
            status: "scene-not-ready",
            scannedItems: 0,
            candidates: [],
            error: "No active Owlbear scene is ready yet.",
          });
        }
      });
    };

    if (OBR.isReady) {
      setupScan();
    } else {
      OBR.onReady(setupScan);
    }

    return () => {
      cleanupItems?.();
      cleanupReady?.();
    };
  }, [scanItems, scanScene]);

  const combinedCandidates = useMemo(
    () => dedupeCandidates([...builderCandidates, ...scanState.candidates]),
    [builderCandidates, scanState.candidates],
  );

  const selectedCandidate = useMemo(
    () => combinedCandidates.find((candidate) => candidate.id === selectedCandidateId) ?? combinedCandidates[0],
    [combinedCandidates, selectedCandidateId],
  );

  const addBuilderCandidate = useCallback((candidate: JconScanCandidate) => {
    setBuilderCandidates((current) => dedupeCandidates([candidate, ...current]));
    setSelectedCandidateId(candidate.id);
  }, []);

  const addCombatCandidate = useCallback((candidate: MonsterCombatCandidate) => {
    setSessionCombatCandidates((current) => upsertCombatCandidate(current, candidate));
    onAddMonsterToCombatLog?.(candidate);
  }, [onAddMonsterToCombatLog]);

  const handleImportMonster = useCallback((shouldSave: boolean) => {
    try {
      const candidate = buildImportedMonsterCandidate(importText, `builder-import-${Date.now()}`);
      const combatCandidate = toMonsterCombatCandidate(candidate);
      addBuilderCandidate(candidate);
      addCombatCandidate(combatCandidate);

      if (shouldSave) {
        const savedRecord: SavedMonsterDatabaseRecord = {
          id: candidate.id,
          name: candidate.preview?.name ?? candidate.name,
          raw: importText.trim(),
          savedAt: new Date().toISOString(),
        };
        const nextSaved = [
          savedRecord,
          ...savedMonsters.filter((entry) => entry.name !== savedRecord.name && entry.raw !== savedRecord.raw),
        ].slice(0, 50);
        setSavedMonsters(nextSaved);
        writeSavedMonsterDatabase(nextSaved);
        setImportStatus(`${savedRecord.name} saved privately and added to the session monster list.`);
      } else {
        setImportStatus(`${combatCandidate.name} added to the session monster list.`);
      }
    } catch (error) {
      setImportStatus(error instanceof Error ? error.message : "Monster JCON import failed.");
    }
  }, [addBuilderCandidate, addCombatCandidate, importText, savedMonsters]);

  const handleLoadSavedMonster = useCallback((record: SavedMonsterDatabaseRecord) => {
    try {
      const candidate = buildImportedMonsterCandidate(record.raw, `builder-db-${record.id}`);
      addBuilderCandidate(candidate);
      setImportStatus(`${record.name} loaded from builder monster database.`);
    } catch (error) {
      setImportStatus(error instanceof Error ? error.message : "Saved monster could not be loaded.");
    }
  }, [addBuilderCandidate]);

  const handleAddSelectedToCombatLog = useCallback(() => {
    if (!selectedCandidate) {
      setImportStatus("Select or import a monster first.");
      return;
    }

    if (!selectedCandidate.preview || selectedCandidate.readiness === "metadata-signal") {
      setImportStatus("That entry is only a metadata signal. Paste/save the full monster JCON or select a readable monster preview.");
      return;
    }

    if (/jcon combat metadata signal/i.test(selectedCandidate.preview.name) || /jcon combat metadata signal/i.test(selectedCandidate.name)) {
      setImportStatus("Metadata signal entries are blocked from combat. Paste the full monster JCON or choose a real monster preview.");
      return;
    }

    const combatCandidate = toMonsterCombatCandidate(selectedCandidate);
    addCombatCandidate(combatCandidate);
    setImportStatus(`${combatCandidate.name} added to the controlled session monster list.`);
  }, [addCombatCandidate, selectedCandidate]);

  const handleClearSessionMonsters = useCallback(() => {
    setSessionCombatCandidates([]);
    writeSessionMonsterCombatCandidates([]);
    setImportStatus("Controlled session monster list cleared.");
    setPublicSnapshotStatus("Public snapshot not cleared yet. Use Send Player Snapshot after choosing the next monster, or Check Player Snapshot to confirm current room state.");
  }, []);

  const handleSendPublicMonsterSnapshot = useCallback(async () => {
    const result = await writePublicMonsterSnapshotsToRoom(sessionCombatCandidates);
    setPublicSnapshotStatus(result);
  }, [sessionCombatCandidates]);

  const handleCheckPublicMonsterSnapshot = useCallback(async () => {
    const result = await readPublicMonsterSnapshotCountFromRoom();
    setPublicSnapshotStatus(result);
  }, []);

  useEffect(() => {
    try {
      writeSessionMonsterCombatCandidates(sessionCombatCandidates);
    } catch {
      // Session candidate persistence is best-effort only; room-public snapshots come in a later controlled slice.
    }

    onCombatCandidatesChange?.(sessionCombatCandidates);
  }, [onCombatCandidatesChange, sessionCombatCandidates]);

  const statusText = useMemo(() => {
    if (scanState.status === "scanning") {
      return "Scanning map...";
    }

    if (scanState.status === "ready") {
      return `${combinedCandidates.length} JCON candidate${combinedCandidates.length === 1 ? "" : "s"} found`;
    }

    if (scanState.status === "not-in-owlbear") {
      return "Owlbear unavailable";
    }

    if (scanState.status === "scene-not-ready") {
      return "No ready scene";
    }

    if (scanState.status === "error") {
      return "Scan failed";
    }

    return "Ready to scan";
  }, [combinedCandidates.length, scanState]);

  return (
    <section className="monster-scan-panel" aria-label="Monster JCON scan">
      <div className="monster-scan-header">
        <div>
          <p className="eyebrow">Monsters</p>
          <h2>Builder monster intake</h2>
          <p className="subtle">
            Paste a native monster JCON, load one from the private builder monster library,
            or rescan Owlbear metadata. Full records stay private; only controlled session monster records enter the combat rotation. Use Send Player Snapshot to test the small player-safe room payload without starting a sync loop.
          </p>
        </div>
        <div className="monster-scan-status">
          <span
            className={`monster-scan-count ${scanState.candidates.length > 0 ? "has-candidates" : ""}`}
          >
            {statusText}
          </span>
          <button
            className="secondary-button compact-scan-button"
            type="button"
            onClick={() => void scanScene()}
          >
            Rescan
          </button>
        </div>
      </div>

      <div className="monster-builder-intake" aria-label="Builder monster import controls">
        <div className="monster-builder-import-box">
          <label className="panel-title" htmlFor="monster-jcon-import">Import Monster JCON</label>
          <textarea
            id="monster-jcon-import"
            className="monster-jcon-import-textarea"
            value={importText}
            placeholder='Paste a native monster JCON object here, then import for combat or save to the builder database.'
            onChange={(event) => setImportText(event.target.value)}
          />
          <div className="monster-builder-import-actions">
            <button className="secondary-button compact" type="button" onClick={() => handleImportMonster(false)}>
              Import for Combat
            </button>
            <button className="focused-window-button compact" type="button" onClick={() => handleImportMonster(true)}>
              Save + Import
            </button>
            <button className="secondary-button compact" type="button" onClick={handleClearSessionMonsters}>
              Clear Session Monsters
            </button>
            <button className="secondary-button compact" type="button" onClick={() => void handleSendPublicMonsterSnapshot()}>
              Send Player Snapshot
            </button>
            <button className="secondary-button compact" type="button" onClick={() => void handleCheckPublicMonsterSnapshot()}>
              Check Snapshot
            </button>
          </div>
          {importStatus && <p className="monster-import-status">{importStatus}</p>}
          {publicSnapshotStatus && <p className="monster-import-status">{publicSnapshotStatus}</p>}
        </div>

        <div className="monster-builder-database-box">
          <p className="panel-title">Private Monster Library</p>
          {savedMonsters.length === 0 ? (
            <p className="subtle">No private saved builder monsters in this browser yet.</p>
          ) : (
            <div className="monster-database-list">
              {savedMonsters.slice(0, 8).map((record) => (
                <button
                  className="monster-database-row"
                  type="button"
                  key={record.id}
                  onClick={() => handleLoadSavedMonster(record)}
                >
                  <strong>{record.name}</strong>
                  <span>{new Date(record.savedAt).toLocaleString()}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="monster-scan-summary">
        <span>Items scanned: {scanState.scannedItems}</span>
        <span>Builder imports: {builderCandidates.length}</span>
        <span>Session monsters: {sessionCombatCandidates.length}</span>
        {scanState.lastScannedAt && (
          <span>Last scan: {scanState.lastScannedAt}</span>
        )}
        {scanState.error && (
          <span className="monster-scan-warning">{scanState.error}</span>
        )}
      </div>

      {combinedCandidates.length > 0 ? (
        <div className="monster-reader-grid">
          <div className="monster-jcon-list">
            {combinedCandidates.map((candidate) => (
              <button
                className={`monster-jcon-card monster-jcon-select-card ${selectedCandidate?.id === candidate.id ? "selected" : ""}`}
                key={candidate.id}
                type="button"
                onClick={() => setSelectedCandidateId(candidate.id)}
              >
                <span className="monster-jcon-card-head">
                  <span>
                    <strong>{candidate.name}</strong>
                    <span>
                      {candidate.type} · {candidate.layer}
                    </span>
                  </span>
                  <span className={`monster-jcon-strength ${candidate.strength}`}>
                    {candidate.strength}
                  </span>
                </span>
                <span className="monster-jcon-card-hint">
                  {readinessLabel(candidate.readiness)}
                </span>
                <span className="monster-jcon-card-source">
                  Source: {candidate.sourceFlavor}
                </span>
                <span className="monster-jcon-card-summary">
                  {candidateSummary(candidate)}
                </span>
                <span className="monster-jcon-card-line">
                  {readableCandidateLine(candidate)}
                </span>
              </button>
            ))}
          </div>

          <aside className="monster-reader-preview" aria-label="Monster reader preview">
            {selectedCandidate?.preview ? (
              <>
                <div className="monster-reader-preview-head">
                  <div>
                    <p className="eyebrow">Reader Preview</p>
                    <h3>{selectedCandidate.preview.name}</h3>
                    <p className="subtle">
                      {selectedCandidate.preview.kind || "monster/unit"}
                      {selectedCandidate.preview.schema ? ` · ${selectedCandidate.preview.schema}` : ""}
                    </p>
                  </div>
                  <span className={`monster-jcon-strength ${selectedCandidate.strength}`}>
                    {selectedCandidate.strength}
                  </span>
                </div>

                <div className="monster-reader-stat-grid">
                  <span><strong>HP</strong>{selectedCandidate.preview.hp ?? "—"}</span>
                  <span><strong>AC</strong>{selectedCandidate.preview.ac ?? "—"}</span>
                  <span><strong>Speed</strong>{selectedCandidate.preview.speed ?? "—"}</span>
                  <span><strong>Source</strong>{selectedCandidate.preview.sourcePath}</span>
                </div>

                {selectedCandidate.preview.actionCounter && (
                  <div className="monster-reader-action-counter">
                    <strong>Action Counter</strong>
                    <span>{selectedCandidate.preview.actionCounter.label} ready</span>
                    <span>{selectedCandidate.preview.actionCounter.sourceActionName ?? "Multiattack"}</span>
                  </div>
                )}

                {selectedCandidate.preview.abilityScores.length > 0 && (
                  <div className="monster-reader-abilities">
                    {selectedCandidate.preview.abilityScores.map((score) => (
                      <span key={score.label}><strong>{score.label}</strong>{score.value}</span>
                    ))}
                  </div>
                )}

                {selectedCandidate.preview.warnings.length > 0 && (
                  <div className="monster-reader-warnings">
                    <strong>Missing / check before card:</strong>
                    <ul>
                      {selectedCandidate.preview.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <ActionPreviewList title="Actions / Attacks" actions={selectedCandidate.preview.actions} />
                <ActionPreviewList title="Reactions" actions={selectedCandidate.preview.reactions} />
                <ActionPreviewList title="Traits" actions={selectedCandidate.preview.traits} />
                <ActionPreviewList title="Spells" actions={selectedCandidate.preview.spells} />

                <div className="monster-reader-action-row">
                  <button className="focused-window-button compact" type="button" onClick={handleAddSelectedToCombatLog}>
                    Add Selected to Combat Log
                  </button>
                </div>

                <div className="monster-reader-footer-note">
                  Raw keys: {selectedCandidate.preview.rawKeys.join(", ") || "none visible"}
                </div>
              </>
            ) : (
              <div className="monster-reader-placeholder">
                Select a detected monster candidate to preview the readable HP,
                AC, stats, actions, traits, and warnings currently exposed by Owlbear metadata.
              </div>
            )}
          </aside>
        </div>
      ) : (
        <div className="monster-scan-empty">
          No readable FDM / Forge / Foundry / JCON combat payload found yet.
          Existing tokens stay eligible when they expose HP/action metadata;
          blank unit windows and size/type-only stubs are ignored.
        </div>
      )}
    </section>
  );
}
