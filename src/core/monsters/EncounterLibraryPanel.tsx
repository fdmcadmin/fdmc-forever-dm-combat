import appManifest from "../../../public/manifest.json";
import OBR from "@owlbear-rodeo/sdk";
import { useState, useEffect, useCallback } from "react";
import type { MainMonsterTemplate, MainEncounterMonsterInstance, MainMonsterVisibilityState } from "./runtime/mainMonsterRuntime";
import type { MonsterReaderAction } from "./MonsterJconScanner";
import { parseActPlacement, campaignSortKey, parseActField } from "../campaign/actTags";
import {
  loadEncounterLibrary,
  loadUnusedEncounters,
  upsertEncounter,
  deleteEncounter,
  restoreEncounter,
  permanentlyDeleteEncounter,
  seedEncounterLibraryFromTemplates,
  spawnEncounterInstances,
  type EncounterDefinition,
  type EncounterMonsterEntry,
} from "./encounterLibrary";
import { SUPPORTED_PARTY_SIZES, BASELINE_PARTY_SIZE, PARTY_SIZE_HP_MULTIPLIER } from "../encounter-band/partyCurveV2";
import { upsertMonsterTemplate, deleteMonsterTemplate, loadMonsterLibrary, resolveMonsterLibrary, isCampaignTemplateId, exportMonsterLibrary, importMonsterLibrary, type MonsterImportResult } from "./dmMonsterLibrary";
import { exportCampaignAuthoring, exportFullCreatureLibrary } from "../campaign/authorExport";
import { publishCampaignAuthoring, hasPublishToken, savePublishToken, savePublishConfig, loadPublishConfig } from "../campaign/publishToGitHub";
// The panel is the seam where campaign content meets the engine editors — the same place
// chassisOptions is assembled. The editor itself never imports mod content (RULE 3).
import { BROKEN_CHAIN_BOND_TEMPLATES } from "../../modules/the-broken-chain/content/bondTemplates";
import type { BondTemplate } from "../types/bond";
import type { TemplateBodyChoice } from "./encounterLibrary";
import { availableFor, emptyPicks, needsSlotPicks, slotPlan, unfilledSlots, type SlotPicks } from "./spellSlotPicks";
import type { MonsterArchetype, MonsterBond } from "./runtime/mainMonsterRuntime";
import { actionSetPlan, bodyNameFor } from "./actionSetPicks";
import { ARCHETYPES } from "./creator/monsterCreatorModel";
import { readEncounterLog, clearEncounterLog, type EncounterLogEntry } from "../events/encounterLog";
import { generatePostCombatSummary, exportSummaryAsText, exportFilename, downloadExport } from "../export/encounterLogExport";
import { loadEquipmentLibrary, type EquipmentItem } from "../ui/EquipmentBagEditor";
import { useModuleUnlock, ModuleUnlockPrompt } from "../campaign/moduleUnlock";
import { MonsterTemplateEditor } from "./MonsterTemplateEditor";
import { safeStorage } from "../utils/safeStorage";

/** The build THIS WINDOW is running — the thing a stored copy is actually compared against. */
const APP_VERSION = appManifest.version;

/** One table, one party — persisted so every encounter loads scaled to it. */
const PARTY_SIZE_KEY = "fdmc.dm.encounterPartySize.v1";

// ─── Module unlock ────────────────────────────────────────────────────────────
// The campaign ("Broken Chain") library is gated behind a LOCAL SOFT password.
// A DM never needs it to create/manage their OWN monsters & encounters — only to
// open the bundled campaign content. Logic lives in core/campaign/moduleUnlock.
// (Front-end soft gate only — see the security note in that file / MASTER.md.)

// ─── Monster bands (P-UX1 guided creation scaffolds) ──────────────────────────
//
// Bands pre-populate the action economy so a first-time DM sees the right shape
// for a creature's difficulty. The band is a scaffold, not a hard limit — every
// section keeps its + Add button and rows can be deleted. These are FDMC-native
// guides, not official D&D CR automation.

export type MonsterBand = "normal" | "strong" | "elite" | "boss";

export const MONSTER_BANDS: { band: MonsterBand; label: string; color: string; blurb: string; shape: string }[] = [
  { band: "normal", label: "Normal", color: "#8a8aa0", blurb: "Rank-and-file creature. One thing it does, one thing it is.", shape: "1 Action · 1 Trait" },
  { band: "strong", label: "Strong", color: "#4f9dff", blurb: "A tougher threat with a recharge ability and more flavor.", shape: "1 Action · 1 Recharge · 3 Traits" },
  { band: "elite", label: "Elite", color: "#ffb02e", blurb: "A full action economy — acts on its turn and reacts on others.", shape: "Action · Bonus · Reaction · 3 Traits" },
  { band: "boss", label: "Boss", color: "#c8472e", blurb: "Centerpiece encounter. Multiattack, phases, and signature traits.", shape: "Multiattack · Bonus · Reaction · Recharge/Phase · 3+ Traits" },
];


// ─── Act grouping for the monster picker ──────────────────────────────────────
// Monsters carry their campaign position in `encounterId` (act2-s4-e1-…). Group by act
// in campaign order, alphabetical inside each act; creatures with no encounter (dormant
// or DM-made) collect under "Unsorted" at the end.
export function groupMonstersByAct(
  library: MainMonsterTemplate[],
): { label: string; monsters: MainMonsterTemplate[] }[] {
  const buckets = new Map<number, MainMonsterTemplate[]>();
  for (const t of library) {
    const { act } = parseActPlacement(t.encounterId);
    const key = act > 0 ? act : 9999;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(t);
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([act, monsters]) => ({
      label: act >= 9999 ? "Unsorted / no encounter" : `Act ${act}`,
      // Within an act, sort by campaign position first (session/encounter as authored),
      // then by name — so an act reads in play order and ties fall back to alphabetical.
      monsters: [...monsters].sort((x, y) =>
        campaignSortKey(x.encounterId, x.name).localeCompare(campaignSortKey(y.encounterId, y.name))),
    }));
}

/**
 * Encounters grouped under act headings, in campaign order.
 *
 * Position comes from the encounter id (`act2-s4-e1-…`) — NOT from `order`, which the
 * seeder never sets, so the previous `(a.order ?? 99)` sort tied every campaign encounter
 * at 99 and left them in insertion order. A DM-authored encounter with a free-text
 * `actTag` still lands in the right act; anything unplaceable collects at the end.
 */
export function groupEncountersByAct(
  encounters: EncounterDefinition[],
): { label: string; encounters: EncounterDefinition[] }[] {
  const buckets = new Map<number, EncounterDefinition[]>();
  for (const e of encounters) {
    // An EXPLICIT actTag wins over the id. The id is a good default — seeded content encodes
    // its own position — but it is immutable once an encounter exists, so deriving from it
    // alone meant a DM could never move an encounter into an act, or correct one that was
    // filed wrong. Falling back to the id keeps every seeded encounter exactly where it was.
    const tagged = parseActField(e.actTag);
    const act = tagged > 0 ? tagged : parseActPlacement(e.id).act;
    const key = act > 0 ? act : 9999;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(e);
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([act, list]) => ({
      label: act >= 9999 ? "Unsorted / no act" : `Act ${act}`,
      // An explicit `order` wins; everything unnumbered keeps its id order BEHIND the numbered
      // ones. So numbering one encounter slots it where you said without reshuffling the rest.
      encounters: [...list].sort((x, y) => {
        const ox = x.order ?? 0;
        const oy = y.order ?? 0;
        if (ox !== oy) return (ox || 9999) - (oy || 9999);
        return campaignSortKey(x.id, x.name).localeCompare(campaignSortKey(y.id, y.name));
      }),
    }));
}

function blankTrait(name = ""): MonsterReaderAction { return { name, kind: "trait" }; }
function blankAction(name = "", extra: Partial<MonsterReaderAction> = {}): MonsterReaderAction { return { name, kind: "action", ...extra }; }
function blankReaction(name = ""): MonsterReaderAction { return { name, kind: "reaction" }; }

/** Returns the scaffolded action/trait/reaction lists for a band. */
export function scaffoldForBand(band: MonsterBand): { actions: MonsterReaderAction[]; traits: MonsterReaderAction[]; reactions: MonsterReaderAction[] } {
  switch (band) {
    case "strong":
      return {
        actions: [blankAction("Action"), blankAction("Recharge Action", { recharge: "5-6" })],
        traits: [blankTrait("Trait 1"), blankTrait("Trait 2"), blankTrait("Trait 3")],
        reactions: [],
      };
    case "elite":
      return {
        actions: [blankAction("Action"), blankAction("Bonus Action", { text: "Bonus action" })],
        traits: [blankTrait("Trait 1"), blankTrait("Trait 2"), blankTrait("Trait 3")],
        reactions: [blankReaction("Reaction")],
      };
    case "boss":
      return {
        actions: [
          blankAction("Multiattack", { text: "Multiattack package" }),
          blankAction("Bonus Action", { text: "Bonus action" }),
          blankAction("Recharge / Phase Action", { recharge: "5-6" }),
        ],
        traits: [blankTrait("Boss / Phase Trait"), blankTrait("Trait 1"), blankTrait("Trait 2"), blankTrait("Trait 3")],
        reactions: [blankReaction("Reaction")],
      };
    case "normal":
    default:
      return { actions: [blankAction("Action")], traits: [blankTrait("Trait")], reactions: [] };
  }
}

/** Builds a fresh, banded monster template ready to drop into the editor. */
export function buildBandedMonster(band: MonsterBand): MainMonsterTemplate {
  const scaffold = scaffoldForBand(band);
  return {
    templateId: `custom-${Date.now().toString(36)}`,
    name: band === "boss" ? "New Boss" : "New Monster",
    stats: {
      // The band is a THREAT statement, so it seeds `classification`, not `kind`. kind is
      // the creature's D&D type and only the author can say what it is — it starts
      // "unspecified" so the editor shows it as still needing a decision.
      kind: "unspecified",
      classification: band === "boss" ? "mid-boss" : band === "elite" ? "elite" : band === "strong" ? "strong" : "normal",
      ac: band === "boss" ? 16 : band === "elite" ? 14 : 12,
      maxHp: band === "boss" ? 120 : band === "elite" ? 60 : band === "strong" ? 35 : 20,
      speed: "30 ft",
    },
    abilities: [
      { label: "STR", value: "10 (+0)" }, { label: "DEX", value: "12 (+1)" },
      { label: "CON", value: "12 (+1)" }, { label: "INT", value: "8 (-1)" },
      { label: "WIS", value: "10 (+0)" }, { label: "CHA", value: "8 (-1)" },
    ],
    traits: scaffold.traits,
    actions: scaffold.actions,
    reactions: scaffold.reactions,
    resources: [],
    notes: [],
    visibility: { defaultState: "condition", hiddenName: "Unknown creature", revealedName: "" },
  };
}

/** "1st" / "2nd" / "3rd" — spell levels read as ordinals on a statblock, not as bare numbers. */
function ordinalLevel(n: number): string {
  const suffix = ["th", "st", "nd", "rd"][(n % 100) - (n % 10) === 10 ? 0 : n % 10] ?? "th";
  return `${n}${suffix}`;
}

// ─── Visibility options ───────────────────────────────────────────────────────

const visibilityOptions: { value: MainMonsterVisibilityState; label: string }[] = [
  { value: "hidden", label: "Hidden" },
  { value: "label-only", label: "Label Only" },
  { value: "condition", label: "Show Condition" },
  { value: "hp-bar", label: "Show HP Bar" },
  { value: "full", label: "Full Reveal" },
];

// ─── Monster template editor — extracted to MonsterTemplateEditor.tsx ─────────
// (Monster Gate WS-A: the flat inline form became the A1–A7 stepper. Both create
// and edit open it, so the three axes are editable after creation.)

// ─── Encounter entry editor ───────────────────────────────────────────────────

type EntryEditorProps = {
  entry: EncounterMonsterEntry;
  monsterLibrary: MainMonsterTemplate[];
  onChange: (entry: EncounterMonsterEntry) => void;
  onRemove: () => void;
  onEditMonster: (templateId: string) => void;
  /** The campaign's bonds, for a template body's bond pick. */
  bondOptions?: BondTemplate[];
};

function EntryEditor({ entry, monsterLibrary, onChange, onRemove, onEditMonster, bondOptions = [] }: EntryEditorProps) {
  const template = monsterLibrary.find(m => m.templateId === entry.templateId);
  const plan = template ? actionSetPlan(template) : [];
  const bodies = entry.bodies ?? [];

  /**
   * THE SPELL SLOT PICKER — where a creature's spell POOL becomes the spells it prepared.
   *
   * Christopher: *"i build all the spells hale and the UR have just like a character, then we make
   * the generater have a picker for each of the slots at X Level."* The creature editor is where a
   * spell is marked a candidate; this is where the DM says which ones this fight gets.
   *
   * ⚠ ABS-ARRAY SEMANTICS, the same rule the action sets and the ability spine use:
   * *"it would be like the ABS array in dnd beyond, when you pick it you cant see it."* A spell
   * taken by one slot leaves the pool for its siblings at that level, so three L1 slots drawn from
   * six candidates give three DIFFERENT spells. `availableFor` owns that rule — the picker only
   * renders what it returns.
   *
   * Renders for nobody else: `needsSlotPicks` is false unless the creature actually has candidates,
   * so a fixed spell list raises no empty control.
   */
  function renderSpellPicks() {
    if (!template || !needsSlotPicks(template)) return null;
    const slotLevels = slotPlan(template);
    const picks: SlotPicks = entry.spellPicks ?? emptyPicks(slotLevels);
    const missing = unfilledSlots(slotLevels, picks);

    return (
      <div style={{ marginTop: 6, padding: "7px 8px", background: "#101a18", border: "1px solid #2a3e3a", borderRadius: 4 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 5 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#57c07a" }}>Prepared spells</span>
          <span style={{ fontSize: 10, color: "#666" }}>
            — this creature's pool, one pick per slot. Unpicked candidates do not come to the fight.
          </span>
        </div>
        {slotLevels.map(level => (
          <div key={level.level} style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 3 }}>
            <span style={{ fontSize: 10, color: "#777", width: 96, flexShrink: 0 }}>
              {ordinalLevel(level.level)} · {level.slots} slot{level.slots === 1 ? "" : "s"}
            </span>
            {Array.from({ length: level.slots }, (_, s) => {
              const mine = picks[level.level] ?? [];
              const options = availableFor(level, s, picks);
              return (
                <select key={s} value={mine[s] ?? ""}
                  onChange={e => {
                    const next = [...(mine.length ? mine : Array(level.slots).fill(null))];
                    next[s] = e.target.value || null;
                    onChange({ ...entry, spellPicks: { ...picks, [level.level]: next } });
                  }}
                  style={{ flex: 1, minWidth: 0, fontSize: 10, padding: "2px 3px", borderRadius: 3, border: "1px solid " + (mine[s] ? "#444" : "#5a4a1a"), background: "#111", color: mine[s] ? "#ccc" : "#e0b34a" }}>
                  <option value="">— pick —</option>
                  {options.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
              );
            })}
          </div>
        ))}
        {missing.length > 0 && (
          <p style={{ fontSize: 10, color: "#e0b34a", fontStyle: "italic", margin: "3px 0 0" }}>
            {missing.length} slot{missing.length === 1 ? "" : "s"} still empty ({missing.join(", ")}) — this creature spawns without them.
          </p>
        )}
      </div>
    );
  }

  /**
   * THE BODY BUILDER — where a template becomes the five mirrors.
   *
   * Christopher: *"a DM has to set those in the 'campaign encounter'… it would give them the 5
   * with the locked stats and only the choices of the templet."*
   *
   * So the stats are PRINTED, not edited: every mirror is the template's AC and HP, and the only
   * things open are what the template left open — a name, an archetype, the action-set picks and
   * a bond. Editing here saves with the encounter into the DM's own copy, so the same roster
   * comes back next session.
   */
  function renderBodies() {
    if (!template?.isTemplate) return null;
    const setBodies = (next: TemplateBodyChoice[]) => onChange({ ...entry, bodies: next, count: Math.max(1, next.length) });
    const patch = (i: number, up: Partial<TemplateBodyChoice>) => setBodies(bodies.map((b, j) => j === i ? { ...b, ...up } : b));

    return (
      <div style={{ marginTop: 6, padding: "7px 8px", background: "#12101f", border: "1px solid #2a2a3e", borderRadius: 4 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#9d8cff" }}>
            Bodies <span style={{ color: "#666", fontWeight: 400 }}>
              — AC {String(template.stats.ac)} · {template.stats.maxHp} HP, locked. One per party member.
            </span>
          </span>
          <button type="button"
            onClick={() => setBodies([...bodies, { id: "b" + Date.now().toString(36), name: "" }])}
            style={{ fontSize: 10, padding: "2px 7px", background: "#7b68ee22", border: "1px solid #7b68ee55", borderRadius: 3, color: "#7b68ee", cursor: "pointer" }}>
            + Body
          </button>
        </div>
        {bodies.length === 0 && (
          <p style={{ fontSize: 10, color: "#ff9999", fontStyle: "italic", margin: 0 }}>
            No bodies built — this entry spawns nothing. Add one per party member.
          </p>
        )}
        {bodies.map((b, i) => {
          /**
           * ⚠ NO DUPLICATES ACROSS THE ROSTER — the same ABS-array rule, one level up.
           *
           * Within a body a taken option leaves that body's pool. Across the roster a taken
           * option leaves EVERY other body's pool, because the encounter doc says so:
           * *"Choose one unused archetype"* and *"Do not duplicate an elemental package in the
           * roster"*, which MASTER extends to the bond as the third of the three choices.
           *
           * So a mirror party is genuinely a party — six archetypes, six packages, distinct
           * bonds — rather than the same body printed four times. This body still sees its own
           * current pick, or its selection would look invalid.
           */
          const others = bodies.filter((_, j) => j !== i);
          const takenArchetypes = new Set(others.map(o => o.archetype).filter(Boolean));
          const takenBonds = new Set(others.map(o => o.bond?.templateId).filter(Boolean));
          const takenInSet = (setId: string) =>
            new Set(others.flatMap(o => (o.actionPicks?.[setId] ?? []).filter(Boolean) as string[]));
          const derivedName = template ? bodyNameFor(template, b.actionPicks, b.name) : b.name;
          const bondTpl = b.bond ? bondOptions.find(x => x.id === b.bond!.templateId) : undefined;
          const bondStage = b.bond?.stage ?? 2;
          const bondPaths = bondTpl?.stages[bondStage]?.paths ?? [];
          return (
            <div key={b.id} style={{ marginBottom: 6, padding: "6px 7px", background: "#161622", border: "1px solid #262638", borderRadius: 4 }}>
              <div style={{ display: "flex", gap: 5, alignItems: "center", marginBottom: 4 }}>
                {/*
                  THE NAME IS DERIVED, NOT TYPED. A body is an "Earth Mirror" because it took
                  the Earth package — printing it keeps the label and the package in step, and
                  removes the one free-text field from an editor whose whole point is that the
                  DM only makes CHOICES here.
                */}
                <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: derivedName === template.name ? "#e0b34a" : "#fff" }}>
                  {derivedName === template.name ? "— pick below to name it —" : derivedName}
                </span>
                <select value={b.archetype ?? ""} onChange={e => patch(i, { archetype: (e.target.value || undefined) as MonsterArchetype | undefined })}
                  title="Reshapes the template's own six scores into this archetype's order. It never invents a score."
                  style={{ width: 118, fontSize: 11, padding: "2px 4px", borderRadius: 3, border: "1px solid #444", background: "#111", color: "#aaa" }}>
                  <option value="">archetype…</option>
                  {ARCHETYPES.filter(a => a.id === b.archetype || !takenArchetypes.has(a.id)).map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                </select>
                <button type="button" onClick={() => setBodies(bodies.filter((_, j) => j !== i))}
                  style={{ fontSize: 10, padding: "2px 5px", background: "transparent", border: "1px solid #5a1a1a", borderRadius: 3, color: "#ff9999", cursor: "pointer" }}>✕</button>
              </div>
              {plan.map(pl => (
                <div key={pl.set.id} style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 3 }}>
                  <span style={{ fontSize: 10, color: "#777", width: 96, flexShrink: 0 }}>{pl.set.label}</span>
                  {Array.from({ length: pl.slots }, (_, s) => {
                    const picks = b.actionPicks ?? {};
                    const mine = picks[pl.set.id] ?? [];
                    // A taken option leaves the pool for its siblings — the same ABS-array rule
                    // the ability spine and the spell slots use. The slot keeps its own pick.
                    // This body's other slots, plus every other body in the roster.
                    const taken = new Set([
                      ...mine.filter((n, j) => j !== s && n) as string[],
                      ...takenInSet(pl.set.id),
                    ]);
                    return (
                      <select key={s} value={mine[s] ?? ""}
                        onChange={e => {
                          const next = [...(mine.length ? mine : Array(pl.slots).fill(null))];
                          next[s] = e.target.value || null;
                          patch(i, { actionPicks: { ...picks, [pl.set.id]: next } });
                        }}
                        style={{ flex: 1, minWidth: 0, fontSize: 10, padding: "2px 3px", borderRadius: 3, border: "1px solid " + (mine[s] ? "#444" : "#5a4a1a"), background: "#111", color: mine[s] ? "#ccc" : "#e0b34a" }}>
                        <option value="">— pick —</option>
                        {pl.candidates.filter(c => !taken.has(c.name)).map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                      </select>
                    );
                  })}
                </div>
              ))}
              {bondOptions.length > 0 && (
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <span style={{ fontSize: 10, color: "#777", width: 96, flexShrink: 0 }}>Bond</span>
                  <select value={b.bond?.templateId ?? ""}
                    title="Any legal bond — a mirror's bond is not tied to the character it mirrors."
                    onChange={e => patch(i, { bond: e.target.value ? { templateId: e.target.value, stage: 2 } : undefined })}
                    style={{ flex: 1, minWidth: 0, fontSize: 10, padding: "2px 3px", borderRadius: 3, border: "1px solid #444", background: "#111", color: "#ccc" }}>
                    <option value="">— none —</option>
                    {bondOptions.filter(x => x.id === b.bond?.templateId || !takenBonds.has(x.id)).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </select>
                  {bondPaths.map((pp, pi) => (
                    <button key={pp.name} type="button"
                      onClick={() => patch(i, { bond: { ...(b.bond as MonsterBond), chosenPathIndex: pi as 0 | 1 } })}
                      style={{
                        fontSize: 10, padding: "2px 6px", borderRadius: 3, cursor: "pointer", whiteSpace: "nowrap",
                        background: b.bond?.chosenPathIndex === pi ? "#7b68ee33" : "transparent",
                        border: "1px solid " + (b.bond?.chosenPathIndex === pi ? "#7b68ee" : "#333"),
                        color: b.bond?.chosenPathIndex === pi ? "#cfc6ff" : "#888",
                      }}>{pp.name}</button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "8px", background: "#161622", borderRadius: 6, marginBottom: 6, border: "1px solid #2a2a3e" }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {/* Monster template selector */}
        <select
          value={entry.templateId}
          onChange={e => {
            const t = monsterLibrary.find(m => m.templateId === e.target.value);
            onChange({
              ...entry,
              templateId: e.target.value,
              startingVisibility: t?.visibility.defaultState ?? entry.startingVisibility,
              hiddenNameOverride: t?.visibility.hiddenName ?? entry.hiddenNameOverride,
            });
          }}
          style={{ flex: 1, fontSize: 12, padding: "3px 6px", borderRadius: 3, border: "1px solid #444", background: "#111", color: "#fff" }}
        >
          {monsterLibrary.map(t => (
            <option key={t.templateId} value={t.templateId}>{t.name}</option>
          ))}
        </select>
        {!template?.isTemplate && (
        <label style={{ fontSize: 11, color: "#888", display: "flex", alignItems: "center", gap: 3 }}>
          ×
          <input
            type="number"
            min={1}
            max={10}
            value={entry.count}
            onChange={e => onChange({ ...entry, count: Math.max(1, Number(e.target.value)) })}
            style={{ width: 36, padding: "2px 4px", borderRadius: 3, border: "1px solid #444", background: "#111", color: "#fff", fontSize: 12, textAlign: "center" }}
          />
        </label>
        )}
        <button type="button" onClick={() => onEditMonster(entry.templateId)}
          title="Edit this monster's stats"
          style={{ fontSize: 11, padding: "2px 7px", background: "#7b68ee22", border: "1px solid #7b68ee44", borderRadius: 3, color: "#7b68ee", cursor: "pointer" }}>
          ✎
        </button>
        <button type="button" onClick={onRemove} style={{ fontSize: 11, padding: "2px 6px", background: "transparent", border: "1px solid #5a1a1a", borderRadius: 3, color: "#ff9999", cursor: "pointer" }}>✕</button>
      </div>
      {renderBodies()}
      {renderSpellPicks()}
      {/* No per-creature HP band here on purpose: the party-size band is a property of the
          FIGHT, set once for the panel. A row-level dial let a boss be scaled for 5 players
          while its adds were scaled for 3, and disagreed with the party size driving DPR. */}
      <div style={{ display: "flex", gap: 6 }}>
        <select
          value={entry.startingVisibility}
          onChange={e => onChange({ ...entry, startingVisibility: e.target.value as MainMonsterVisibilityState })}
          style={{ fontSize: 11, padding: "2px 4px", borderRadius: 3, border: "1px solid #444", background: "#111", color: "#aaa", flex: 1 }}
        >
          {visibilityOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

type StagedEntry = {
  id: string;
  encounterId: string;
  encounterName: string;
  instances: MainEncounterMonsterInstance[];
};

type EncounterLibraryPanelProps = {
  monsterLibrary: MainMonsterTemplate[];
  onLoadEncounter: (instances: MainEncounterMonsterInstance[]) => void;
  onClearRoster: () => void;
  activeRosterCount: number;
  onMonsterLibraryUpdate?: (updated: MainMonsterTemplate) => void;
  /** When true, open the monster band picker immediately on mount (Create Monster shortcut). */
  autoOpenBandPicker?: boolean;
  /** Hide in-panel create buttons — manage-only view (toolbar carries the create buttons). */
  hideCreate?: boolean;
  /**
   * Open the equipment creator pre-tagged to a loot pool. Wired by the DM panel to
   * jump to the Equipment tab with the encounter name pre-filled. When omitted the
   * loot-pool section still shows, but the "Create loot" button is hidden.
   */
  onCreateLootForEncounter?: (lootPoolName: string) => void;
  /** Bumping this opens a fresh monster band picker — Library "+ Create Monster" (P-UX4 Phase 5). */
  createSignal?: number;
};

export function EncounterLibraryPanel({
  monsterLibrary,
  onLoadEncounter,
  onClearRoster,
  activeRosterCount,
  onMonsterLibraryUpdate,
  autoOpenBandPicker = false,
  hideCreate = false,
  onCreateLootForEncounter,
  createSignal,
}: EncounterLibraryPanelProps) {
  // Campaign-library unlock state + snap-back watcher (shared module). The panel itself
  // is NEVER gated — only the Broken Chain (campaign) section reads `unlocked`.
  const { unlocked, unlock, lock } = useModuleUnlock();
  // The Broken Chain section is a click-to-open drawer. Collapsed by default; clicking it
  // reveals the lock prompt (if locked) or the campaign encounters (if unlocked).
  const [brokenChainOpen, setBrokenChainOpen] = useState(false);
  const [showBandPicker, setShowBandPicker] = useState(autoOpenBandPicker);
  // P-UX4 Phase 5: the Library "+ Create Monster" button bumps createSignal to open the
  // band picker without re-opening the whole panel.
  useEffect(() => {
    if (createSignal) setShowBandPicker(true);
  }, [createSignal]);
  const [encounters, setEncounters] = useState<EncounterDefinition[]>([]);
  const [unusedEncounters, setUnusedEncounters] = useState<EncounterDefinition[]>(() => loadUnusedEncounters());
  const [editingId, setEditingId] = useState<string | null>(null);
  /** Acts folded shut in the campaign list, by label. Session state — nothing persisted. */
  const [collapsedActs, setCollapsedActs] = useState<Set<string>>(() => new Set());
  // Monster template editor — overlays the encounter edit view
  const [editingMonsterTemplateId, setEditingMonsterTemplateId] = useState<string | null>(null);
  // Local overrides for templates edited this session (before parent re-renders)
  const [monsterOverrides, setMonsterOverrides] = useState<Record<string, MainMonsterTemplate>>({});
  /** The override list starts folded — it is a reference, not an alert. */
  const [overridesOpen, setOverridesOpen] = useState(false);
  const [monsterImportResult, setMonsterImportResult] = useState<MonsterImportResult | null>(null);
  /**
   * ⚠ WHAT THE SAVE ACTUALLY DID, READ BACK FROM THE STORE.
   *
   * Christopher: *"because i never know when the edit has gone through, i never know when my
   * submit instead reverts to a seeded version."* The editor closed and said nothing, so a save
   * that stuck and a save that was discarded were indistinguishable — and one of them really was
   * being discarded, which is how the Grief Colossus went back to 230 seven times.
   */
  const [saveNotice, setSaveNotice] = useState<{ name: string; ok: boolean; where: string; detail: string } | null>(null);
  // DM's own monster library from localStorage — "My Library" (DM creations). Reactive: the
  // monster picker + count derive from this, so created monsters persist and appear after reload.
  const [dmLibrary, setDmLibrary] = useState<MainMonsterTemplate[]>(() => loadMonsterLibrary());
  const [editDraft, setEditDraft] = useState<EncounterDefinition | null>(null);
  // Equipment library snapshot — used to resolve each encounter's loot pool. Refreshed
  // when the editor opens so newly-created loot shows up without a panel reload.
  const [equipmentItems, setEquipmentItems] = useState<EquipmentItem[]>(() => loadEquipmentLibrary());
  const [addingTemplateId, setAddingTemplateId] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [activeTab, setActiveTab] = useState<"library" | "staged">("library");
  const [saveTargetDraft, setSaveTargetDraft] = useState<"campaign" | "dm">("dm");
  const [authorExportMsg, setAuthorExportMsg] = useState<string | null>(null);
  /** Publishing is a network round-trip, so the button says so rather than looking inert. */
  const [publishing, setPublishing] = useState(false);
  const [publishSettingsOpen, setPublishSettingsOpen] = useState(false);
  const [tokenDraft, setTokenDraft] = useState("");
  const [branchDraft, setBranchDraft] = useState(() => loadPublishConfig().branch);
  /**
   * The party actually at the table — Lever 1, and the ONLY thing that may change about a
   * locked encounter. Set once for the panel rather than per encounter or per creature: one
   * table has one party, and every fight it loads is scaled to it.
   */
  const [partySize, setPartySize] = useState<number>(() => {
    try {
      const raw = safeStorage().getItem(PARTY_SIZE_KEY);
      const parsed = raw ? Number.parseInt(raw, 10) : NaN;
      return SUPPORTED_PARTY_SIZES.includes(parsed as never) ? parsed : BASELINE_PARTY_SIZE;
    } catch { return BASELINE_PARTY_SIZE; }
  });

  /**
   * ⚠ THE ACKNOWLEDGE PLUMBING WENT WITH THE BANNER IT SERVED. It existed so a DM could dismiss
   * the notice that their saved copy had just been overruled by the shipped creature. Nothing
   * overrules a saved copy any more, so there is nothing to acknowledge — and a "Got it" button
   * on a thing that no longer happens is worse than no button.
   */

  function changePartySize(next: number) {
    setPartySize(next);
    try { safeStorage().setItem(PARTY_SIZE_KEY, String(next)); } catch { /* ok */ }
  }

  // Staged queue — instances ready to push to combat, persisted in localStorage
  const [staged, setStaged] = useState<StagedEntry[]>(() => {
    try {
      const raw = safeStorage().getItem("fdmc.dm.encounterStagedQueue.v1");
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });

  // ── Monster library resolution ───────────────────────────────────────────────
  // `monsterLibrary` prop is the bundled CAMPAIGN library (BROKEN_CHAIN_MONSTER_LIBRARY).
  // "My Library" = the DM's own creations (templateIds that AREN'T campaign) — always available.
  // Campaign monsters surface only when the module is unlocked, with any DM edits applied on top.
  // In-session overrides give immediate visibility on create/edit.
  /**
   * ⚠ THE PRECEDENCE RULE MOVED OUT OF THIS COMPONENT (0.7.36.1). It used to live here and only
   * here, which is exactly why the encounter checker and the creature estimator went on pricing
   * SHIPPED creatures while this panel showed the edited ones — a rule trapped in a component is a
   * rule only that component obeys. `resolveMonsterLibrary` in `dmMonsterLibrary.ts` is now the
   * single implementation.
   *
   * What stays here is what is genuinely UI: the unlock gate, the acknowledge filter on stale-seed
   * notices, and the in-session override layer.
   */
  const isCampaignTemplate = (id: string) => isCampaignTemplateId(id, monsterLibrary);
  const resolution = resolveMonsterLibrary(monsterLibrary, { stored: dmLibrary, includeCampaign: unlocked });
  const overriddenCampaignTemplates = resolution.overridden;
  // A notice the DM has already acknowledged stays gone until the numbers move again.
  const myMonsters = resolution.library.filter(t => !isCampaignTemplate(t.templateId));
  const campaignBase = resolution.library.filter(t => isCampaignTemplate(t.templateId));
  const baseLibrary = [...myMonsters, ...campaignBase];
  const resolvedLibrary = [
    ...baseLibrary.map(t => monsterOverrides[t.templateId] ?? t),
    // newly-created templates not yet in baseLibrary — never leak a campaign template while locked
    ...Object.values(monsterOverrides).filter(
      t => !baseLibrary.some(m => m.templateId === t.templateId) && (unlocked || !isCampaignTemplate(t.templateId)),
    ),
  ];

  /**
   * Drop a DM override and go back to the shipped campaign creature.
   *
   * NOT a delete: the campaign template carries the same templateId, so it takes the slot straight
   * back and every encounter that references it is untouched. Only the stored copy goes.
   */
  function revertCampaignOverride(templateId: string) {
    deleteMonsterTemplate(templateId);
    setDmLibrary(loadMonsterLibrary());
    setMonsterOverrides(prev => {
      const next = { ...prev };
      delete next[templateId];
      return next;
    });
  }

  function handleSaveMonsterTemplate(updated: MainMonsterTemplate, owner: "campaign" | "dm" = "dm") {
    /**
     * Stamp a DELIBERATE edit. Only a marked copy of a campaign creature outranks the shipped
     * template — see `campaignBase` above. Without the stamp an old stored copy shadowed
     * corrected campaign data silently and permanently.
     */
    const stamped: MainMonsterTemplate = isCampaignTemplate(updated.templateId)
      ? { ...updated, dmEdited: { at: new Date().toISOString() } }
      : updated;
    /**
     * ⚠ A CAMPAIGN SAVE IS NOT A DM EDIT, so it carries no `dmEdited` stamp. That marker exists to
     * let a DM's private copy outrank shipped campaign data; stamping the campaign store with it
     * would make authored content look like an override of itself and survive re-seeds it should
     * not survive.
     */
    upsertMonsterTemplate(owner === "campaign" ? updated : stamped, owner);
    // Refresh My Library from localStorage so the created/edited monster persists across reloads.
    setDmLibrary(loadMonsterLibrary());
    // Update local override so the encounter editor sees it immediately
    setMonsterOverrides(prev => ({ ...prev, [updated.templateId]: stamped }));
    // Notify parent if it wants to refresh its static library copy
    onMonsterLibraryUpdate?.(updated);
    setEditingMonsterTemplateId(null);

    /**
     * ⚠ SAY WHETHER IT LANDED, BY READING IT BACK.
     *
     * Christopher: *"because i never know when the edit has gone through, i never know when my
     * submit instead reverts to a seeded version."* The editor closed on save and said nothing, so
     * a save that stuck and a save that was discarded looked exactly the same — and until 0.7.56
     * one of them really was being discarded.
     *
     * ⚠ IT RE-READS THE STORE RATHER THAN TRUSTING THE WRITE. `saveMonsterLibrary` swallows a
     * storage failure by design (a browser that has said no is not an error to crash on), so
     * "I called upsert" is not evidence that anything was written. A confirmation that cannot
     * fail is not a confirmation. This asks the resolver the same question the next reload will
     * ask, and reports what it actually answers.
     */
    const readBack = resolveMonsterLibrary(monsterLibrary, {
      stored: loadMonsterLibrary(),
      includeCampaign: unlocked,
    }).library.find(t => t.templateId === updated.templateId);
    const landed = readBack
      ? JSON.stringify(readBack.stats) === JSON.stringify(updated.stats)
      : false;
    setSaveNotice({
      name: updated.name,
      ok: landed,
      where: owner === "campaign" ? "the campaign library" : "My Library",
      detail: landed
        ? `${updated.stats.maxHp} HP · AC ${updated.stats.ac} — this is what the app will load next time.`
        : "The store did not read back what was just written. Nothing was lost in the editor — copy your changes before reloading.",
    });
  }

  function persistStaged(next: StagedEntry[]) {
    setStaged(next);
    try { safeStorage().setItem("fdmc.dm.encounterStagedQueue.v1", JSON.stringify(next)); } catch { /* ok */ }
  }

  function stageEncounter(encounter: EncounterDefinition) {
    const instances = spawnEncounterInstances(encounter, resolvedLibrary, partySize);
    const entry: StagedEntry = {
      id: `staged-${Date.now().toString(36)}`,
      encounterId: encounter.id,
      encounterName: encounter.name,
      instances,
    };
    persistStaged([...staged, entry]);
    setActiveTab("staged");
  }

  function sendStagedToRoster(stagedId: string) {
    const entry = staged.find(s => s.id === stagedId);
    if (!entry) return;
    onLoadEncounter(entry.instances);
    persistStaged(staged.filter(s => s.id !== stagedId));
  }

  function removeStagedEntry(stagedId: string) {
    persistStaged(staged.filter(s => s.id !== stagedId));
  }

  // Load encounters. My Library (DM-owned) encounters ALWAYS load so a new DM can
  // build immediately. The bundled campaign templates are only seeded once the Broken
  // Chain module is unlocked.
  useEffect(() => {
    if (unlocked) {
      setEncounters(seedEncounterLibraryFromTemplates(monsterLibrary));
    } else {
      setEncounters(loadEncounterLibrary("dm"));
    }
  }, [unlocked, monsterLibrary]);

  const refreshLibrary = useCallback(() => {
    // Mirror the load rule: hide campaign rows while locked.
    setEncounters(unlocked ? loadEncounterLibrary() : loadEncounterLibrary("dm"));
    setUnusedEncounters(loadUnusedEncounters());
  }, [unlocked]);

  // Clear stale monster template editor ID if template no longer exists
  useEffect(() => {
    if (editingMonsterTemplateId && !resolvedLibrary.find(t => t.templateId === editingMonsterTemplateId)) {
      setEditingMonsterTemplateId(null);
    }
  }, [editingMonsterTemplateId, resolvedLibrary]);

  function startEdit(encounter: EncounterDefinition) {
    setEditDraft(JSON.parse(JSON.stringify(encounter)));
    setEditingId(encounter.id);
    setEquipmentItems(loadEquipmentLibrary()); // refresh loot pool view on open
  }

  function saveEdit(targetOverride?: "campaign" | "dm") {
    if (!editDraft) return;
    const target = targetOverride ?? saveTargetDraft ?? editDraft.owner ?? "dm";
    upsertEncounter({ ...editDraft, owner: target }, target);
    refreshLibrary();
    setEditingId(null);
    setEditDraft(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(null);
  }

  function handleDeleteEncounter(id: string) {
    deleteEncounter(id);
    refreshLibrary();
  }

  function handleAddEntry() {
    if (!editDraft || !addingTemplateId) return;
    // Look up in resolvedLibrary (My Library + campaign + session overrides), NOT just
    // the campaign list — otherwise a DM-created monster can't be added to an encounter
    // (silently bailed on a fresh room with no campaign content).
    const template = resolvedLibrary.find(t => t.templateId === addingTemplateId);
    if (!template) return;
    setEditDraft({
      ...editDraft,
      entries: [...editDraft.entries, {
        templateId: addingTemplateId,
        count: 1,
        startingVisibility: template.visibility.defaultState,
        hiddenNameOverride: template.visibility.hiddenName,
      }],
    });
    setAddingTemplateId("");
  }

  function handleLoadEncounter(encounter: EncounterDefinition) {
    const instances = spawnEncounterInstances(encounter, resolvedLibrary, partySize);
    onLoadEncounter(instances);
  }

  function handleCreateBandedMonster(band: MonsterBand) {
    const monster = buildBandedMonster(band);
    upsertMonsterTemplate(monster);
    // Add to overrides immediately so resolvedLibrary contains it before the
    // parent re-renders with the new monsterLibrary prop.
    setMonsterOverrides(prev => ({ ...prev, [monster.templateId]: monster }));
    setShowBandPicker(false);
    setEditingMonsterTemplateId(monster.templateId);
    refreshLibrary();
  }

  function handleCreateNew(owner: "campaign" | "dm" = "dm") {
    const newEncounter: EncounterDefinition = {
      id: `${owner}-${Date.now().toString(36)}`,
      name: "New Encounter",
      entries: [],
      owner,
    };
    upsertEncounter(newEncounter, owner);
    refreshLibrary();
    setSaveTargetDraft(owner);
    startEdit(newEncounter);
  }

  // NOTE: the panel is intentionally NOT gated behind the module unlock. A new DM can
  // create and manage their own monsters & encounters immediately. Only the Broken
  // Chain (campaign) section inside the list reads `unlocked`.

  // ── Monster band picker (guided monster creation) ─────────────────────────
  if (showBandPicker) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
        <div style={{ padding: "8px 14px", borderBottom: "1px solid #2a2a3e", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Create Monster — pick a band</span>
          <button type="button" onClick={() => setShowBandPicker(false)}
            style={{ fontSize: 11, padding: "3px 8px", background: "transparent", border: "1px solid #444", borderRadius: 3, color: "#888", cursor: "pointer" }}>
            Cancel
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
          <p style={{ margin: "0 0 12px", fontSize: 11, color: "#777", lineHeight: 1.5 }}>
            A band scaffolds the right action economy for the creature's difficulty. It's a starting point —
            every section keeps its <strong style={{ color: "#aaa" }}>+ Add</strong> button and rows can be deleted.
          </p>
          {MONSTER_BANDS.map(({ band, label, color, blurb, shape }) => (
            <button key={band} type="button" onClick={() => handleCreateBandedMonster(band)}
              style={{ display: "block", width: "100%", textAlign: "left", marginBottom: 8, padding: "10px 12px",
                background: "#161622", border: "1px solid #2a2a3e", borderLeft: `4px solid ${color}`, borderRadius: 8, cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 14, fontWeight: 600, color }}>{label}</span>
                <span style={{ fontSize: 10, color: "#888" }}>{shape}</span>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 11, color: "#888" }}>{blurb}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Editing an encounter ──────────────────────────────────────────────────

  // ── Monster template editor overlay ──────────────────────────────────────
  if (editingMonsterTemplateId) {
    const template = resolvedLibrary.find(t => t.templateId === editingMonsterTemplateId);
    if (template) {
      return (
        <MonsterTemplateEditor
          template={template}
          chassisOptions={resolvedLibrary.filter(t => t.templateId !== template.templateId)}
          bondOptions={BROKEN_CHAIN_BOND_TEMPLATES}
          onSave={handleSaveMonsterTemplate}
          canSaveToCampaign={unlocked}
          onCancel={() => setEditingMonsterTemplateId(null)}
          /* The exit belongs HERE too, not only in the library list — this is where a DM is
             looking when they decide their edit was a mistake. Passed only for a campaign
             creature that actually has an override, so it never appears on a DM's own creature
             (where Revert would be meaningless) or on an unedited campaign one. */
          onRevertToCampaign={
            overriddenCampaignTemplates.some(o => o.id === template.templateId)
              ? () => { revertCampaignOverride(template.templateId); setEditingMonsterTemplateId(null); }
              : undefined
          }
        />
      );
    }
    // templateId no longer in library — clear via effect on next tick
    return null;
  }

  if (editingId && editDraft) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
        <div style={{ padding: "8px 14px", borderBottom: "1px solid #2a2a3e", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="text"
              value={editDraft.name}
              onChange={e => setEditDraft({ ...editDraft, name: e.target.value })}
              style={{ fontWeight: "bold", background: "transparent", border: "none", borderBottom: "1px solid #555", color: "inherit", fontSize: 14, width: 200 }}
            />
            {/* WHICH ACT THIS BELONGS TO.
                Act membership was only ever DERIVED from the encounter id ("act2-s4-e1-…"),
                which works for seeded campaign content and not at all for anything the DM
                builds: a created encounter gets an id like "custom-1a2b3c" and lands in
                Unsorted forever with no way to move it. The grouping already falls back to
                this field — it just had nothing writing it. */}
            <select
              value={String(parseActField(editDraft.actTag) || parseActPlacement(editDraft.id).act || 0)}
              onChange={e => {
                const n = Number(e.target.value);
                setEditDraft({ ...editDraft, actTag: n > 0 ? `Act ${n}` : undefined });
              }}
              title="Which act this encounter belongs to, for grouping in the library"
              style={{ fontSize: 11, padding: "2px 5px", borderRadius: 3, border: "1px solid #2a2a3e", background: "#0d0d14", color: "#aaa" }}
            >
              <option value="0">Unsorted</option>
              {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>Act {n}</option>)}
            </select>
            {/* WHERE IT SITS INSIDE THE ACT.
                Order was a field nothing ever wrote, so encounters inside an act fell back to
                the id ("act3-e7-…") — fine for seeded content, useless for anything built or
                inserted later, and there was no way to slot a new fight between two existing
                ones. An explicit number wins; everything unnumbered keeps its id order behind
                the numbered ones, so setting one encounter's position does not scramble the
                rest. */}
            <select
              value={String(editDraft.order ?? 0)}
              onChange={e => {
                const n = Number(e.target.value);
                setEditDraft({ ...editDraft, order: n > 0 ? n : undefined });
              }}
              title="Position within its act. Auto = keep the order its id implies."
              style={{ fontSize: 11, padding: "2px 5px", borderRadius: 3, border: "1px solid #2a2a3e", background: "#0d0d14", color: "#aaa" }}
            >
              <option value="0">Auto</option>
              {Array.from({ length: 20 }, (_, i) => i + 1).map(n => <option key={n} value={n}>#{n}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            {/* Save into the campaign library only when it's unlocked. */}
            {unlocked && (
              <button type="button" onClick={() => saveEdit("campaign")}
                style={{ fontSize: 11, padding: "3px 9px", background: "#7b68ee33", border: "1px solid #7b68ee", borderRadius: 3, color: "#7b68ee", cursor: "pointer" }}
                title="Save to Broken Chain Library (campaign)">
                → Campaign
              </button>
            )}
            <button type="button" onClick={() => saveEdit("dm")}
              style={{ fontSize: 11, padding: "3px 9px", background: "#2a6e2a", color: "#fff", border: "none", borderRadius: 3, cursor: "pointer" }}
              title="Save to My Library (DM personal)">
              → My Library
            </button>
            <button type="button" onClick={cancelEdit}
              style={{ fontSize: 11, padding: "3px 8px", background: "transparent", border: "1px solid #444", borderRadius: 3, color: "#888", cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
          <p style={{ margin: "0 0 8px", fontSize: 11, color: "#888" }}>Monsters in this encounter:</p>

          {editDraft.entries.map((entry, i) => (
            <EntryEditor
              key={`${entry.templateId}-${i}`}
              entry={entry}
              monsterLibrary={resolvedLibrary}
              bondOptions={BROKEN_CHAIN_BOND_TEMPLATES}
              onEditMonster={(templateId) => setEditingMonsterTemplateId(templateId)}
              onChange={updated => {
                const next = [...editDraft.entries];
                next[i] = updated;
                setEditDraft({ ...editDraft, entries: next });
              }}
              onRemove={() => {
                const next = editDraft.entries.filter((_, idx) => idx !== i);
                setEditDraft({ ...editDraft, entries: next });
              }}
            />
          ))}

          {editDraft.entries.length === 0 && (
            <p style={{ fontSize: 12, color: "#555", fontStyle: "italic" }}>No monsters yet. Add from library below.</p>
          )}

          <div style={{ marginTop: 12, display: "flex", gap: 6 }}>
            <select
              value={addingTemplateId}
              onChange={e => setAddingTemplateId(e.target.value)}
              style={{ flex: 1, padding: "4px 8px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff", fontSize: 12 }}
            >
              <option value="">— Add monster from library —</option>
              {/* Grouped by ACT in campaign order, alphabetical inside each act, so
                  picking a creature for an Act 3 fight doesn't mean scrolling one flat
                  list of every monster in the campaign. */}
              {groupMonstersByAct(resolvedLibrary).map(group => (
                <optgroup key={group.label} label={group.label}>
                  {group.monsters.map(t => (
                    <option key={t.templateId} value={t.templateId}>{t.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <button type="button" onClick={handleAddEntry} disabled={!addingTemplateId}
              style={{ fontSize: 12, padding: "4px 10px", background: addingTemplateId ? "#7b68ee" : "#333", color: "#fff", border: "none", borderRadius: 4, cursor: addingTemplateId ? "pointer" : "default" }}>
              + Add
            </button>
          </div>

          {/* ── Loot Pool ── tie equipment (boss drops / merchant stock) to this encounter.
              The pool is every equipment item tagged with the selected loot-pool name. */}
          {(() => {
            const pools = Array.from(new Set(
              equipmentItems.map(i => i.sourceEncounter?.trim()).filter((s): s is string => Boolean(s))
            )).sort((a, b) => a.localeCompare(b));
            const selectedPool = (editDraft.lootPool?.trim() || editDraft.name.trim() || "New Encounter");
            const poolItems = equipmentItems.filter(i => (i.sourceEncounter?.trim() || "") === selectedPool);
            return (
              <div style={{ marginTop: 16, borderTop: "1px solid #2a2a3e", paddingTop: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <label style={{ fontSize: 11, color: "#e0b34a", textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>🎁 Loot Pool</label>
                  <span style={{ fontSize: 10, color: "#555" }}>{poolItems.length} item{poolItems.length === 1 ? "" : "s"}</span>
                </div>
                <p style={{ margin: "0 0 8px", fontSize: 10, color: "#555", lineHeight: 1.5 }}>
                  Choose an existing loot pool or keep this encounter's own pool. Items tagged with the
                  pool name become this boss/merchant's drops.
                </p>
                <select
                  value={editDraft.lootPool ?? ""}
                  onChange={e => setEditDraft({ ...editDraft, lootPool: e.target.value || undefined })}
                  style={{ width: "100%", padding: "5px 8px", borderRadius: 4, border: "1px solid #5a4a1a", background: "#111", color: "#fff", fontSize: 12, marginBottom: 8 }}
                >
                  <option value="">— This encounter ({editDraft.name || "unnamed"}) —</option>
                  {pools.filter(p => p !== selectedPool).map(p => <option key={p} value={p}>{p}</option>)}
                </select>

                {poolItems.length === 0 ? (
                  <div style={{ background: "#1a1508", border: "1px solid #5a4a1a55", borderRadius: 6, padding: "10px 12px" }}>
                    <p style={{ margin: "0 0 8px", fontSize: 11, color: "#888" }}>
                      No loot in <strong style={{ color: "#e0b34a" }}>{selectedPool}</strong> yet.
                    </p>
                    {onCreateLootForEncounter && (
                      <button type="button" onClick={() => onCreateLootForEncounter(selectedPool)}
                        style={{ fontSize: 12, padding: "6px 12px", background: "#e0b34a", color: "#0d0d14", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 700 }}
                        title="Open the equipment creator pre-tagged to this encounter">
                        + Create loot for this encounter
                      </button>
                    )}
                  </div>
                ) : (
                  <div>
                    {poolItems.map(item => (
                      <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", background: "#161622", border: "1px solid #2a2a3e", borderRadius: 5, marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: "#ccc", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</span>
                        <span style={{ fontSize: 10, color: "#555" }}>{item.category ?? item.type}</span>
                        {item.tier && <span style={{ fontSize: 10, color: "#e0b34a99" }}>{item.tier}</span>}
                      </div>
                    ))}
                    {onCreateLootForEncounter && (
                      <button type="button" onClick={() => onCreateLootForEncounter(selectedPool)}
                        style={{ fontSize: 11, padding: "4px 10px", marginTop: 4, background: "#2a230d", color: "#e0b34a", border: "1px solid #5a4a1a", borderRadius: 5, cursor: "pointer" }}
                        title="Add another item to this encounter's loot pool">
                        + Add more loot
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          <div style={{ marginTop: 16, borderTop: "1px solid #2a2a3e", paddingTop: 12 }}>
            <label style={{ fontSize: 12, display: "block", marginBottom: 4, color: "#888" }}>DM Notes</label>
            <textarea
              value={editDraft.dmNotes ?? ""}
              onChange={e => setEditDraft({ ...editDraft, dmNotes: e.target.value })}
              rows={3}
              style={{ width: "100%", padding: "4px 8px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff", fontSize: 12, resize: "vertical" }}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Encounter list ────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "8px 14px", borderBottom: "1px solid #2a2a3e", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0, fontSize: 14 }}>Monsters</h3>
        <div style={{ display: "flex", gap: 6 }}>
          {activeTab === "library" && (
            <div style={{ display: "flex", gap: 4 }}>
              {/* Create a new monster — opens the band picker (guided scaffold).
                  Hidden in manage-only view (the DM toolbar's "+ Monster" covers it). */}
              {!hideCreate && (
                <button type="button"
                  onClick={() => setShowBandPicker(true)}
                  style={{ fontSize: 11, padding: "3px 8px", background: "#7b68ee", color: "#fff", border: "none", borderRadius: 3, cursor: "pointer", fontWeight: 600 }}
                  title="Create a new monster — pick a band to scaffold its action economy">
                  + Create Monster
                </button>
              )}
              <button type="button" onClick={() => handleCreateNew("dm")}
                style={{ fontSize: 11, padding: "3px 8px", background: "#2a6e2a", color: "#fff", border: "none", borderRadius: 3, cursor: "pointer" }}
                title="Create new encounter in My Library">
                + Encounter
              </button>
              {unlocked && (
                <button type="button" onClick={() => handleCreateNew("campaign")}
                  style={{ fontSize: 11, padding: "3px 8px", background: "#7b68ee22", color: "#7b68ee", border: "1px solid #7b68ee55", borderRadius: 3, cursor: "pointer" }}
                  title="Create new encounter in Campaign Library">
                  + Campaign
                </button>
              )}
            </div>
          )}
          {/* Monster library export */}
          {myMonsters.length > 0 && (
            <button type="button" onClick={() => exportMonsterLibrary()}
              style={{ fontSize: 11, padding: "3px 8px", background: "#2a3a2a", color: "#4caf50", border: "1px solid #2a6e2a55", borderRadius: 3, cursor: "pointer" }}
              title={`Export your ${myMonsters.length} custom monster${myMonsters.length === 1 ? "" : "s"} to JSON`}>
              ↓ Monsters
            </button>
          )}
          {/*
            AUTHOR EXPORT — the only route by which content built in this app reaches the
            shipped library. Everything authored here otherwise lives in localStorage, which
            belongs to one browser: authoring a whole act that way loses the act. Gated on the
            module unlock because it publishes CAMPAIGN content, not a DM's own creations.
          */}
          {/*
            ⚠ PUBLISH IS THE PRIMARY ROUTE NOW; THE DOWNLOAD IS THE FALLBACK.

            Christopher: *"the reason i dont want a download and a hand to you is because if small
            changes like moving hp, moving ac, or even creating each creature for act 4 then
            handing them to you is what burns usage."* Routine authoring should not cost a
            session, so the button writes to the repo and CI does what the hand-off used to.

            The download stays because it is the answer when the token is missing, GitHub is
            unreachable, or the DM simply wants the file — and because a publish path with no
            offline fallback is one outage away from losing an act.
          */}
          {unlocked && (
            <button type="button"
              disabled={publishing}
              onClick={() => {
                if (!hasPublishToken()) {
                  setAuthorExportMsg("No GitHub token saved yet — add a fine-grained token (Contents: read and write, this repository only) in the publish settings, or use ↓ Author to download the file instead.");
                  return;
                }
                setPublishing(true);
                setAuthorExportMsg("Publishing to GitHub…");
                void publishCampaignAuthoring()
                  .then(r => setAuthorExportMsg(r.ok ? `${r.message} ${r.url ?? ""}`.trim() : r.message))
                  .finally(() => setPublishing(false));
              }}
              style={{ fontSize: 11, padding: "3px 8px", background: "#7b68ee22", color: "#7b68ee", border: "1px solid #7b68ee55", borderRadius: 3, cursor: publishing ? "wait" : "pointer", opacity: publishing ? 0.6 : 1 }}
              title="Publish everything authored on this machine straight to the repo. CI folds it, runs every gate, and commits the result — nothing merges until the gates pass. No download, no hand-off.">
              {publishing ? "⋯ Publishing" : "↑ Publish"}
            </button>
          )}
          {unlocked && (
            <button type="button"
              onClick={() => setAuthorExportMsg(exportCampaignAuthoring().message)}
              style={{ fontSize: 11, padding: "3px 8px", background: "#7b68ee11", color: "#7b68ee99", border: "1px solid #7b68ee33", borderRadius: 3, cursor: "pointer" }}
              title="Download the same payload as a file, for folding by hand with scripts/fold-authoring.mjs. The fallback for when publishing is unavailable. Local picks (a chassis's chosen weapon form) are stripped: the template ships, the pick does not.">
              ↓ Author
            </button>
          )}
          {/*
            ⚠ THE WHOLE LIBRARY, NOT THE CHANGES — a different question from ↓ Author.

            Christopher: *"it only does changes, just give me a export creature library button."*
            ↓ Author carries what this browser edited, which is right for a publish and useless for
            a reconciliation pass against an encounter document: a creature never opened in the app
            has no stored copy and so never appears in an export at all.

            This ships every campaign creature as the app resolves it — bundled seed where nothing
            is stored, the stored copy where there is one — in the same payload schema the fold
            consumes. Encounters and equipment ride along untouched, because the fold REPLACES
            encounters and an empty array would delete every authored fight.
          */}
          {unlocked && (
            <button type="button"
              onClick={() => setAuthorExportMsg(
                exportFullCreatureLibrary(resolvedLibrary.filter(t => isCampaignTemplate(t.templateId))).message,
              )}
              style={{ fontSize: 11, padding: "3px 8px", background: "#7b68ee11", color: "#7b68ee99", border: "1px solid #7b68ee33", borderRadius: 3, cursor: "pointer" }}
              title="Download EVERY campaign creature, not just the ones edited on this machine — the full library as the app resolves it, in the same format the fold script consumes. Use this when reconciling the library against an encounter document.">
              ↓ Library
            </button>
          )}
          {/* Monster library import */}
          <label style={{ fontSize: 11, padding: "3px 8px", background: "#2a2a3e", color: "#aaa", border: "1px solid #444", borderRadius: 3, cursor: "pointer", display: "flex", alignItems: "center" }}
            title="Import custom monsters from a previously exported JSON file">
            ↑ Import
            <input type="file" accept=".json" style={{ display: "none" }} onChange={e => {
              const file = e.target.files?.[0];
              if (!file) return;
              void importMonsterLibrary(file).then(result => {
                setMonsterImportResult(result);
                if (result.ok) setDmLibrary(loadMonsterLibrary());
              });
              e.target.value = "";
            }} />
          </label>
          {unlocked && (
            <button type="button" onClick={lock}
              style={{ fontSize: 11, padding: "3px 8px", background: "transparent", border: "1px solid #333", borderRadius: 3, color: "#555", cursor: "pointer" }}
              title="Lock the Broken Chain campaign library">
              🔒
            </button>
          )}
        </div>
      </div>

      {saveNotice && (
        <div style={{
          padding: "6px 14px", fontSize: 11, borderBottom: "1px solid #2a2a3e",
          background: saveNotice.ok ? "#0f2015" : "#241612",
          color: saveNotice.ok ? "#7be08a" : "#ff8a5c",
          display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
        }}>
          <strong>{saveNotice.ok ? "Saved" : "NOT SAVED"} — {saveNotice.name}</strong>
          <span style={{ color: "#8a8aa0" }}>
            {saveNotice.ok ? `in ${saveNotice.where}. ` : ""}{saveNotice.detail}
          </span>
          <button type="button" onClick={() => setSaveNotice(null)}
            style={{ marginLeft: "auto", fontSize: 10, padding: "2px 8px", background: "transparent", border: "1px solid #333", borderRadius: 3, color: "#666", cursor: "pointer" }}>
            dismiss
          </button>
        </div>
      )}

      {/* ⚠ THE "STALE SEED" BANNER IS GONE, BECAUSE THE BEHAVIOUR IT ANNOUNCED IS GONE.
          It said a saved copy "had an older version — now reading the campaign version", which
          was the app telling the DM it had just thrown their save away. A stored copy always wins
          now; what remains worth saying is which creatures differ from the SHIPPED build, and
          that is the pending-changes notice below. */}

      {/* ⚠ PENDING CHANGES — NOT "YOU ARE USING AN EDITED VERSION".
          Christopher: *"for me the 'you are using an edited version' should never be a thing, at
          best it should tell me there are pending changes."* He is right, and the old wording was
          a symptom of the old model: it framed a saved edit as an unusual state the app was
          tolerating, when a saved edit is simply the creature. What is genuinely worth saying is
          narrower and more useful — these differ from the build that shipped, so they are what a
          publish would carry.

          Revert is still here, and still not a delete: the shipped creature takes the same slot
          and every encounter using it keeps working. */}
      {overriddenCampaignTemplates.length > 0 && (
        <div style={{ padding: "6px 14px", background: "#0f1412", borderBottom: "1px solid #2a2a3e", fontSize: 11, color: "#4caf50" }}>
          <button type="button" onClick={() => setOverridesOpen(o => !o)}
            style={{ background: "transparent", border: "none", padding: 0, color: "#4caf50", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
            {overridesOpen ? "▼" : "▶"} {overriddenCampaignTemplates.length} creature{overriddenCampaignTemplates.length === 1 ? " has" : "s have"} changes not in THIS build ({APP_VERSION})
          </button>
          {overridesOpen && (
            <>
              {overriddenCampaignTemplates.map(o => (
                <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3, flexWrap: "wrap" }}>
                  <span style={{ color: "#8a8aa0" }}>
                    {o.name}: yours {o.mine} · this build {o.campaign}
                    {o.at && <span style={{ color: "#555" }}> · edited {new Date(o.at).toLocaleDateString()}</span>}
                  </span>
                  {o.mine !== o.campaign && (
                    <button type="button" onClick={() => revertCampaignOverride(o.id)}
                      title="Go back to the campaign version. This is NOT a delete — the campaign creature takes the same slot and every encounter using it keeps working."
                      style={{ fontSize: 10, padding: "1px 7px", background: "#4caf5022", border: "1px solid #4caf5055", borderRadius: 3, color: "#4caf50", cursor: "pointer" }}>
                      ↩ Discard, use this build's
                    </button>
                  )}
                </div>
              ))}
              <div style={{ color: "#666", marginTop: 3 }}>
⚠ "This build" is the app running in THIS WINDOW, not what is on GitHub. A publish you have already made does not change it until the fold redeploys AND this window reloads — so a creature can be published and still listed here. Discarding falls back to this window's copy, which is why it can hand you back something older than what you published.
              </div>
            </>
          )}
        </div>
      )}

      {/* Import result notification */}
      {monsterImportResult && (
        <div style={{ padding: "5px 14px", background: monsterImportResult.ok ? "#0d1a0d" : "#1a0a0a", borderBottom: "1px solid #2a2a3e", fontSize: 11, color: monsterImportResult.ok ? "#4caf50" : "#ff9999", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{monsterImportResult.ok ? "✓" : "✕"} {monsterImportResult.message}</span>
          <button type="button" onClick={() => setMonsterImportResult(null)} style={{ background: "transparent", border: "none", color: "#555", cursor: "pointer", fontSize: 11 }}>×</button>
        </div>
      )}

      {/* The fold command is part of the result, because an export that is never folded has
          changed nothing — the file in the downloads folder is not yet in the build. */}
      {authorExportMsg && (
        <div style={{ padding: "5px 14px", background: "#12101f", borderBottom: "1px solid #2a2a3e", fontSize: 11, color: "#9d8cff", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <span style={{ flex: 1, minWidth: 0 }}>{authorExportMsg}</span>
          <button type="button" onClick={() => setPublishSettingsOpen(v => !v)} style={{ background: "transparent", border: "1px solid #2a2a3e", borderRadius: 3, color: "#7b68ee", cursor: "pointer", fontSize: 10, padding: "2px 6px" }}>
            {publishSettingsOpen ? "hide settings" : "publish settings"}
          </button>
          <button type="button" onClick={() => setAuthorExportMsg(null)} style={{ background: "transparent", border: "none", color: "#555", cursor: "pointer", fontSize: 11 }}>×</button>
        </div>
      )}
      {/*
        ⚠ THE TOKEN LIVES IN THIS BROWSER AND NOWHERE ELSE. It is never bundled, never committed,
        and never sent anywhere but api.github.com as an Authorization header.

        It is still readable by anyone who can open devtools on this page — that is true of any
        credential a browser holds, and pretending otherwise would be worse than saying it. So the
        exposure is bounded rather than hidden: use a FINE-GRAINED token, scoped to this ONE
        repository, with `Contents: read and write` and nothing else, and give it an expiry. A
        classic token, or a fine-grained one scoped to all repositories, hands whoever reads it
        the run of the account.
      */}
      {unlocked && publishSettingsOpen && (
        <div style={{ padding: "8px 14px", background: "#0e0d18", borderBottom: "1px solid #2a2a3e", fontSize: 11, color: "#8a8aa0", display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ minWidth: 84 }}>GitHub token</span>
            <input
              type="password"
              placeholder={hasPublishToken() ? "saved — type to replace" : "github_pat_…"}
              value={tokenDraft}
              onChange={e => setTokenDraft(e.target.value)}
              style={{ flex: 1, minWidth: 200, background: "#07070c", border: "1px solid #2a2a3e", borderRadius: 3, color: "#dfe4ff", fontSize: 11, padding: "3px 6px" }} />
            <button type="button"
              onClick={() => { savePublishToken(tokenDraft); setTokenDraft(""); setAuthorExportMsg(tokenDraft ? "Token saved to this browser." : "Token cleared."); }}
              style={{ fontSize: 10, padding: "3px 8px", background: "#2a3a2a", color: "#4caf50", border: "1px solid #2a6e2a55", borderRadius: 3, cursor: "pointer" }}>
              Save
            </button>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ minWidth: 84 }}>Branch</span>
            <input
              value={branchDraft}
              onChange={e => { setBranchDraft(e.target.value); savePublishConfig({ branch: e.target.value.trim() || "authoring" }); }}
              style={{ width: 160, background: "#07070c", border: "1px solid #2a2a3e", borderRadius: 3, color: "#dfe4ff", fontSize: 11, padding: "3px 6px" }} />
            <span style={{ color: "#666" }}>
              never main — CI folds the payload, runs every gate, and only then commits. What reaches main is a merge.
            </span>
          </div>
          <div style={{ color: "#666", lineHeight: 1.5 }}>
            Use a <strong style={{ color: "#8a8aa0" }}>fine-grained</strong> token scoped to this one repository with <strong style={{ color: "#8a8aa0" }}>Contents: read and write</strong>, and give it an expiry.
            Anyone with devtools access to this page can read it, so do not use a classic token or one scoped to all repositories.
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display: "flex", borderBottom: "1px solid #2a2a3e", background: "#0d0d14" }}>
        {(["library", "staged"] as const).map(tab => (
          <button key={tab} type="button"
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1, padding: "7px 0", fontSize: 12, background: "transparent", border: "none",
              borderBottom: activeTab === tab ? "2px solid #7b68ee" : "2px solid transparent",
              color: activeTab === tab ? "#fff" : "#666", cursor: "pointer",
            }}
          >
            {tab === "library" ? "Encounters" : `Staged${staged.length > 0 ? ` (${staged.length})` : ""}`}
          </button>
        ))}
      </div>

      {/* Active roster status */}
      {activeRosterCount > 0 && (
        <div style={{ padding: "6px 14px", background: "#1a1a2e", borderBottom: "1px solid #2a2a3e", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#7b68ee" }}>● {activeRosterCount} monster{activeRosterCount === 1 ? "" : "s"} in combat</span>
          {confirmClear ? (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "#ff9999" }}>Clear roster?</span>
              <button type="button" onClick={() => { onClearRoster(); setConfirmClear(false); }}
                style={{ fontSize: 11, padding: "1px 8px", background: "#8b0000", color: "#fff", border: "none", borderRadius: 3, cursor: "pointer" }}>Yes</button>
              <button type="button" onClick={() => setConfirmClear(false)}
                style={{ fontSize: 11, padding: "1px 8px", background: "transparent", border: "1px solid #444", borderRadius: 3, color: "#888", cursor: "pointer" }}>No</button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmClear(true)}
              style={{ fontSize: 11, padding: "2px 8px", background: "transparent", border: "1px solid #5a1a1a", borderRadius: 3, color: "#ff9999", cursor: "pointer" }}>
              Clear
            </button>
          )}
        </div>
      )}

      {/* Staged tab content */}
      {activeTab === "staged" && (
        <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
          {staged.length === 0 ? (
            <div style={{ textAlign: "center", marginTop: 40 }}>
              <p style={{ fontSize: 12, color: "#555" }}>No staged encounters.</p>
              <p style={{ fontSize: 11, color: "#444" }}>
                From the Encounters tab, use <strong style={{ color: "#e07b39" }}>Stage</strong> to pre-load a wave without sending it to combat yet.
              </p>
            </div>
          ) : (
            staged.map(entry => (
              <div key={entry.id} style={{ background: "#161622", border: "1px solid #e07b3933", borderRadius: 8, padding: 10, marginBottom: 8 }}>
                {/* Encounter header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontWeight: 500, fontSize: 13, color: "#e07b39" }}>⏸ {entry.encounterName}</span>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button type="button" onClick={() => sendStagedToRoster(entry.id)}
                      style={{ fontSize: 11, padding: "2px 10px", background: "#2a6e2a", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}
                      title="Send all monsters to combat">
                      ▶ All
                    </button>
                    <button type="button" onClick={() => removeStagedEntry(entry.id)}
                      style={{ fontSize: 11, padding: "2px 6px", background: "transparent", border: "1px solid #5a1a1a", borderRadius: 3, color: "#ff9999", cursor: "pointer" }}>
                      ✕
                    </button>
                  </div>
                </div>
                {/* Per-monster rows */}
                {entry.instances.map(inst => (
                  <div key={inst.instanceId} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 6px", background: "#0d0d14", borderRadius: 4, marginBottom: 4 }}>
                    <span style={{ flex: 1, fontSize: 12, color: "#aaa" }}>{inst.displayName}</span>
                    <span style={{ fontSize: 11, color: "#555" }}>{inst.maxHp} HP</span>
                    <button
                      type="button"
                      onClick={() => {
                        onLoadEncounter([inst]);
                        // Remove this instance from the staged entry; remove entry if empty
                        const remaining = entry.instances.filter(i => i.instanceId !== inst.instanceId);
                        if (remaining.length === 0) {
                          persistStaged(staged.filter(s => s.id !== entry.id));
                        } else {
                          persistStaged(staged.map(s => s.id === entry.id ? { ...s, instances: remaining } : s));
                        }
                      }}
                      style={{ fontSize: 11, padding: "2px 8px", background: "#1a3a1a", border: "1px solid #2a6e2a55", borderRadius: 3, color: "#4caf50", cursor: "pointer" }}
                    >
                      ▶
                    </button>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}

      {/* Encounter list */}
      {activeTab === "library" && <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
        {/* Lever 1 — the party at the table. The ONE thing that changes about a locked
            encounter; every Load/Stage below scales to it. */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, padding: "8px 10px", background: "#161622", border: "1px solid #2a2a3e", borderRadius: 8 }}>
          <span style={{ fontSize: 10, color: "#8a8aa0", textTransform: "uppercase", letterSpacing: 1 }}>Party size</span>
          <div style={{ display: "flex", gap: 4 }}>
            {SUPPORTED_PARTY_SIZES.map(size => {
              const active = partySize === size;
              const mult = PARTY_SIZE_HP_MULTIPLIER[size] ?? 1;
              return (
                <button
                  key={size}
                  type="button"
                  onClick={() => changePartySize(size)}
                  title={`${size} players — encounter HP ×${mult}${size === BASELINE_PARTY_SIZE ? " (as authored)" : ""}`}
                  style={{
                    width: 30, fontSize: 13, fontWeight: active ? 700 : 500, padding: "4px 0",
                    background: active ? "#4f9dff" : "#0d0d14",
                    color: active ? "#fff" : "#8a8aa0",
                    border: `1px solid ${active ? "#4f9dff" : "#2a2a3e"}`, borderRadius: 4, cursor: "pointer",
                  }}
                >
                  {size}
                </button>
              );
            })}
          </div>
          <span style={{ fontSize: 10, color: "#666" }}>
            encounter HP ×{PARTY_SIZE_HP_MULTIPLIER[partySize] ?? 1}
            {partySize === BASELINE_PARTY_SIZE ? " · as authored" : ""}
          </span>
        </div>
        {(() => {
            const campaign = encounters.filter(e => e.owner === "campaign" || (!e.owner && unlocked));
            const dm = encounters.filter(e => e.owner === "dm");
            const renderEncounter = (encounter: EncounterDefinition) => (
              <div key={encounter.id} style={{ background: "#161622", border: "1px solid #2a2a3e", borderRadius: 8, padding: 10, marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                  <div>
                    <span style={{ fontWeight: 500, fontSize: 13 }}>{encounter.name}</span>
                    {encounter.actTag && <span style={{ fontSize: 10, color: "#555", marginLeft: 6 }}>{encounter.actTag}</span>}
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button type="button" onClick={() => handleLoadEncounter(encounter)}
                      style={{ fontSize: 11, padding: "2px 8px", background: "#2a6e2a", color: "#fff", border: "none", borderRadius: 3, cursor: "pointer" }}
                      title="Send directly to combat roster">
                      ▶ Load
                    </button>
                    <button type="button" onClick={() => stageEncounter(encounter)}
                      style={{ fontSize: 11, padding: "2px 8px", background: "#e07b3922", border: "1px solid #e07b3944", borderRadius: 3, color: "#e07b39", cursor: "pointer" }}
                      title="Stage for later — push to combat when ready">
                      ⏸ Stage
                    </button>
                    <button type="button" onClick={() => startEdit(encounter)}
                      style={{ fontSize: 11, padding: "2px 8px", background: "#7b68ee22", border: "1px solid #7b68ee44", borderRadius: 3, color: "#7b68ee", cursor: "pointer" }}>
                      Edit
                    </button>
                    <button type="button" onClick={() => handleDeleteEncounter(encounter.id)}
                      style={{ fontSize: 11, padding: "2px 6px", background: "transparent", border: "1px solid #5a1a1a", borderRadius: 3, color: "#ff9999", cursor: "pointer" }}>
                      ✕
                    </button>
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: 11, color: "#666" }}>
                  {encounter.entries.length === 0
                    ? "Empty — edit to add monsters"
                    : encounter.entries.map(e => {
                        const t = resolvedLibrary.find(m => m.templateId === e.templateId);
                        return e.count > 1 ? `${e.count}× ${t?.name ?? e.templateId}` : (t?.name ?? e.templateId);
                      }).join(", ")}
                </p>
                {encounter.dmNotes && (
                  <p style={{ margin: "4px 0 0", fontSize: 11, color: "#555", fontStyle: "italic" }}>
                    {encounter.dmNotes}
                  </p>
                )}
              </div>
            );

            return (
              <>
                {/*
                  ⚖ ENCOUNTER BALANCE — its own window now.

                  Christopher: *"i think the checker, estimator and this deserves its own DM window
                  that can be pulled from a button on the monster library with how advanced it has
                  come."* Both panels rendered inline here and had grown large enough to push the
                  monster list they measure off the screen.

                  They are UNCHANGED and still mounted — just in `?panel=balance`, alongside the
                  new Act Run tab. A button, not a deletion.
                */}
                <button type="button"
                  onClick={() => {
                    const u = new URL(window.location.href);
                    u.searchParams.set("panel", "balance");
                    if (OBR.isAvailable) {
                      void OBR.popover.open({
                        id: "fdm-dm-balance",
                        url: `/dm-panel.html?panel=balance`,
                        width: 760, height: 900,
                      }).catch(() => { window.location.href = u.toString(); });
                    } else {
                      window.location.href = u.toString();
                    }
                  }}
                  title="Open the Encounter Balance window — the act run, the encounter checker and the creature estimator together, with room to read them."
                  style={{
                    display: "flex", alignItems: "center", gap: 8, width: "100%", marginBottom: 8,
                    padding: "7px 10px", background: "#1a1018", border: "1px solid #6e2a2a",
                    borderLeft: "3px solid #ff6b5e", borderRadius: 6, color: "#ff9b90",
                    cursor: "pointer", textAlign: "left", fontSize: 12, fontWeight: 600,
                  }}>
                  ⚖ Encounter Balance
                  <span style={{ fontWeight: 400, fontSize: 10, color: "#8a6a6a" }}>
                    act run · encounter checker · creature estimator
                  </span>
                </button>

                {/* My Library — always visible, no password needed */}
                <p style={{ margin: "0 0 6px", fontSize: 10, color: "#4caf50", textTransform: "uppercase", letterSpacing: 1 }}>
                  My Library
                </p>
                {dm.length > 0 ? (
                  dm.map(renderEncounter)
                ) : (
                  <p style={{ fontSize: 12, color: "#555", fontStyle: "italic", margin: "0 0 4px" }}>
                    No encounters yet. Use <strong style={{ color: "#aaa" }}>+ Encounter</strong> to build your own —
                    or <strong style={{ color: "#aaa" }}>+ Create Monster</strong> to make a creature first.
                  </p>
                )}

                {/* My Monsters — the DM's own creatures (so they show outside the encounter picker). */}
                {myMonsters.length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <p style={{ margin: "0 0 6px", fontSize: 10, color: "#4f9dff", textTransform: "uppercase", letterSpacing: 1 }}>
                      My Monsters · {myMonsters.length}
                    </p>
                    {/* Grouped by act in campaign order — same ordering as the picker. */}
                    {groupMonstersByAct(myMonsters).flatMap(group => [
                      <p key={`hdr-${group.label}`} style={{ margin: "8px 0 4px", fontSize: 9.5, fontWeight: 700,
                        letterSpacing: 1, textTransform: "uppercase", color: group.label.startsWith("Act") ? "#4f9dff" : "#667" }}>
                        {group.label}
                      </p>,
                      ...group.monsters.map(m => (
                      <div key={m.templateId} style={{ background: "#111", border: "1px solid #2a2a3e", borderRadius: 6, padding: "6px 10px", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <div style={{ minWidth: 0 }}>
                          <span style={{ fontSize: 12, color: "#fff", fontWeight: 500 }}>{m.name}</span>
                          <span style={{ fontSize: 10, color: "#666", marginLeft: 6 }}>{m.stats.kind} · {m.stats.maxHp} HP · AC {m.stats.ac}</span>
                        </div>
                        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                          <button type="button" onClick={() => setEditingMonsterTemplateId(m.templateId)}
                            title="Edit this monster"
                            style={{ fontSize: 11, padding: "2px 8px", background: "#7b68ee22", border: "1px solid #7b68ee44", borderRadius: 3, color: "#7b68ee", cursor: "pointer" }}>
                            ✎ Edit
                          </button>
                          <button type="button" onClick={() => { deleteMonsterTemplate(m.templateId); setDmLibrary(loadMonsterLibrary()); }}
                            title="Delete this monster"
                            style={{ fontSize: 11, padding: "2px 6px", background: "transparent", border: "1px solid #5a1a1a", borderRadius: 3, color: "#ff9999", cursor: "pointer" }}>
                            ✕
                          </button>
                        </div>
                      </div>
                      )),
                    ])}
                  </div>
                )}

                {/* Broken Chain campaign library — click-to-open drawer; the lock lives here */}
                <button type="button" onClick={() => setBrokenChainOpen(o => !o)}
                  style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", marginTop: 16, marginBottom: 6,
                    padding: "8px 10px", background: "#161018", border: "1px solid #4a2a2a", borderLeft: "3px solid #c8472e", borderRadius: 6, cursor: "pointer", color: "#fff" }}
                  title={brokenChainOpen ? "Collapse" : "Open the Broken Chain library"}>
                  <span style={{ fontSize: 11, color: "#c8472e", width: 12, flexShrink: 0 }}>{brokenChainOpen ? "▼" : "▶"}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, flex: 1, minWidth: 0 }}>🔒 Broken Chain Library</span>
                  <span style={{ fontSize: 10, color: unlocked ? "#4caf50" : "#c8472e", flexShrink: 0 }}>
                    {unlocked ? `unlocked · ${campaign.length}` : "locked"}
                  </span>
                </button>
                {brokenChainOpen && (
                  unlocked ? (
                    campaign.length > 0 ? (
                      // Grouped under ACT headings in campaign order. The old sort keyed on
                      // `order ?? 99`, but the seeder never sets `order` — so every campaign
                      // encounter tied at 99 and fell back to insertion order.
                      groupEncountersByAct(campaign).map(group => {
                        // Acts collapse. Three acts of authored encounters is a long scroll to
                        // reach the one act being played, and the header was already the
                        // natural place to fold it. Collapsed state is per act and remembered
                        // for the session, so opening Act 3 does not re-open Acts 1 and 2.
                        const collapsed = collapsedActs.has(group.label);
                        return (
                          <div key={group.label}>
                            <button
                              type="button"
                              onClick={() => setCollapsedActs(prev => {
                                const next = new Set(prev);
                                if (next.has(group.label)) next.delete(group.label); else next.add(group.label);
                                return next;
                              })}
                              title={collapsed ? `Show ${group.label}` : `Hide ${group.label}`}
                              style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", textAlign: "left",
                                margin: "10px 0 5px", padding: "0 0 3px", borderBottom: "1px solid #2a2a3e",
                                background: "transparent", border: "none", borderBottomStyle: "solid", cursor: "pointer",
                                fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase",
                                color: group.label.startsWith("Act") ? "#e0b34a" : "#667" }}
                            >
                              <span style={{ fontSize: 9, width: 8 }}>{collapsed ? "▶" : "▼"}</span>
                              {group.label}
                              <span style={{ marginLeft: "auto", color: "#555", fontWeight: 400, letterSpacing: 0 }}>
                                {group.encounters.length}
                              </span>
                            </button>
                            {!collapsed && group.encounters.map(renderEncounter)}
                          </div>
                        );
                      })
                    ) : (
                      <p style={{ fontSize: 12, color: "#555", fontStyle: "italic" }}>No campaign encounters loaded.</p>
                    )
                  ) : (
                    <ModuleUnlockPrompt onUnlock={unlock} what="encounters" />
                  )
                )}
              </>
            );
          })()}

        {/* Unused / archived encounters — always shown at bottom if any exist */}
        {unusedEncounters.length > 0 && (
          <div style={{ marginTop: 16, borderTop: "1px solid #2a2a2a", paddingTop: 10 }}>
            <p style={{ margin: "0 0 6px", fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: 1 }}>
              🗑 Deleted (can restore)
            </p>
            {unusedEncounters.map(enc => (
              <div key={enc.id} style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 6, padding: "6px 10px", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span style={{ fontSize: 12, color: "#666" }}>{enc.name}</span>
                  {enc.actTag && <span style={{ fontSize: 10, color: "#444", marginLeft: 6 }}>{enc.actTag}</span>}
                  <div style={{ fontSize: 10, color: "#444", marginTop: 1 }}>
                    {enc.entries.length === 0 ? "Empty" : enc.entries.map(e => e.templateId).join(", ")}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => { restoreEncounter(enc.id); refreshLibrary(); }}
                    style={{ fontSize: 11, padding: "2px 10px", background: "#1a3a1a", border: "1px solid #2a6e2a55", borderRadius: 3, color: "#4caf50", cursor: "pointer" }}
                  >
                    Restore
                  </button>
                  <button
                    type="button"
                    onClick={() => { permanentlyDeleteEncounter(enc.id); refreshLibrary(); }}
                    title="Delete permanently — cannot be restored"
                    style={{ fontSize: 11, padding: "2px 8px", background: "transparent", border: "1px solid #5a1a1a", borderRadius: 3, color: "#ff9999", cursor: "pointer" }}
                  >
                    ✕ Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>}

      {/* P8 — Post-combat export section */}
      {activeTab === "library" && (() => {
        const log: EncounterLogEntry[] = readEncounterLog();
        if (log.length === 0) return null;
        const rounds = log.reduce((max: number, e: EncounterLogEntry) => Math.max(max, e.round), 0);
        const bossKill = log.find((e: EncounterLogEntry) => e.type === "boss-killed");
        return (
          <div style={{ borderTop: "1px solid #2a2a3e", padding: "10px 14px", flexShrink: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: "#4caf50", textTransform: "uppercase", letterSpacing: 1 }}>
                📊 Encounter Log — {log.length} events · Round {rounds}{bossKill ? ` · ⚔ ${bossKill.actorName} defeated` : ""}
              </span>
              <button type="button" onClick={() => { clearEncounterLog(); /* force re-render */ }}
                style={{ fontSize: 9, padding: "1px 6px", background: "transparent", border: "1px solid #444", borderRadius: 3, color: "#555", cursor: "pointer" }}>
                Clear
              </button>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button type="button"
                onClick={() => {
                  const bk = log.find((e: EncounterLogEntry) => e.type === "boss-killed");
                  const summary = generatePostCombatSummary(log, bk?.actorId ?? "encounter", bk?.actorName ?? "Encounter");
                  downloadExport(exportSummaryAsText(summary), exportFilename(summary.encounterName, summary.completedAt));
                }}
                style={{ fontSize: 11, padding: "3px 10px", background: "#2a6e2a22", border: "1px solid #2a6e2a55", borderRadius: 3, color: "#4caf50", cursor: "pointer" }}>↓ Export Log</button>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
