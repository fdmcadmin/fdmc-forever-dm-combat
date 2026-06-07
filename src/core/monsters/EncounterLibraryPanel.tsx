import { useState, useEffect, useCallback } from "react";
import type { MainMonsterTemplate, MainEncounterMonsterInstance, MainMonsterVisibilityState } from "./runtime/mainMonsterRuntime";
import type { MonsterReaderAction } from "./MonsterJconScanner";
import {
  loadEncounterLibrary,
  loadUnusedEncounters,
  upsertEncounter,
  deleteEncounter,
  restoreEncounter,
  seedEncounterLibraryFromTemplates,
  spawnEncounterInstances,
  type EncounterDefinition,
  type EncounterMonsterEntry,
} from "./encounterLibrary";
import { upsertMonsterTemplate, loadMonsterLibrary, exportMonsterLibrary, importMonsterLibrary, type MonsterImportResult } from "./dmMonsterLibrary";
import { readEncounterLog, clearEncounterLog, type EncounterLogEntry } from "../events/encounterLog";
import { generatePostCombatSummary, exportSummaryAsText, exportSummaryAsJson, downloadExport } from "../export/encounterLogExport";

// ─── Module unlock — LOCAL SOFT GATE ONLY ─────────────────────────────────────
//
// ⚠️ SECURITY: This is a front-end-only soft gate. It is NOT content protection.
// The "hash" is plain base64 (btoa) and the code can be trivially recovered by
// anyone who opens dev tools or reads the bundle. Treat it as a demo/local
// convenience lock — a speed bump, not a lock. It must NOT be presented to users
// as protecting paid or private content. A real licensing system (server-side
// entitlement check + signed tokens) is required before any paid distribution.
// See _specs/P-UX1-SPEC.md → "Module Unlock security debt".
//
// Default code: "brokenchain" → base64 below.
// To change: run btoa("yourNewCode") in the browser console and paste here.

const MODULE_UNLOCK_HASH = "YnJva2VuY2hhaW4="; // btoa("brokenchain") — base64 of the unlock code
const MODULE_LOCK_KEY = "fdmc.module.unlocked.v1";
const MODULE_ID = "the-broken-chain";

// The stored "unlocked" flag is a DERIVED token, not the raw code hash. So casually
// pasting btoa("brokenchain") into the console does NOT unlock — only entering the code
// through the form issues this exact token. The snap-back watcher (below) re-locks the UI
// whenever the stored value is missing or doesn't match. (Still front-end only — see the
// Module Unlock security debt note in MASTER.md / P-UX1-SPEC.md.)
const UNLOCK_TOKEN = btoa(`fdmc-unlock:${MODULE_UNLOCK_HASH}:granted`);

function isModuleUnlocked(): boolean {
  try {
    return window.localStorage.getItem(MODULE_LOCK_KEY) === UNLOCK_TOKEN;
  } catch {
    return false;
  }
}

function unlockModule(code: string): boolean {
  if (btoa(code.trim()) === MODULE_UNLOCK_HASH) {
    try { window.localStorage.setItem(MODULE_LOCK_KEY, UNLOCK_TOKEN); } catch { /* ok */ }
    return true;
  }
  return false;
}

function lockModule(): void {
  try { window.localStorage.removeItem(MODULE_LOCK_KEY); } catch { /* ok */ }
}

// ─── Lock screen ──────────────────────────────────────────────────────────────

function ModuleLockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [patreonNote, setPatreonNote] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (unlockModule(code)) {
      onUnlock();
    } else {
      setError("Incorrect unlock code.");
      setCode("");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 16, padding: 24 }}>
      <div style={{ textAlign: "center" }}>
        <p style={{ margin: "0 0 4px", fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: 2 }}>Module Unlock</p>
        <h3 style={{ margin: "0 0 8px", fontSize: 18 }}>The Broken Chain</h3>
        <p style={{ margin: 0, fontSize: 12, color: "#666" }}>
          Enter the demo unlock code to load this module's sample encounters.
        </p>
      </div>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 260 }}>
        <input
          type="password"
          value={code}
          onChange={e => { setCode(e.target.value); setError(""); }}
          placeholder="Enter unlock code"
          style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #444", background: "#111", color: "#fff", fontSize: 14, textAlign: "center" }}
          autoFocus
        />
        {error && <p style={{ margin: 0, fontSize: 12, color: "#ff9999", textAlign: "center" }}>{error}</p>}
        <button type="submit" style={{ padding: "8px 16px", background: "#7b68ee", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 14, fontWeight: 500 }}>
          Unlock
        </button>
      </form>

      {/* Future unlock path — Patreon (placeholder; no real entitlement yet) */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: "100%", maxWidth: 260 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", color: "#444", fontSize: 10 }}>
          <span style={{ flex: 1, height: 1, background: "#2a2a3e" }} />
          <span>or</span>
          <span style={{ flex: 1, height: 1, background: "#2a2a3e" }} />
        </div>
        <button
          type="button"
          onClick={() => setPatreonNote(true)}
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "8px 16px", background: "#FF424D", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600 }}
          title="Unlock this module through Patreon (coming soon)"
        >
          <span aria-hidden style={{ fontWeight: 800 }}>ⓟ</span> Unlock with Patreon
        </button>
        {patreonNote && (
          <p style={{ margin: 0, fontSize: 11, color: "#FFb0b4", textAlign: "center", lineHeight: 1.5 }}>
            Patreon unlock is coming soon. Supporting the campaign will auto-unlock its modules here.
            For now, enter the code above (ask your DM).
          </p>
        )}
      </div>

      <p style={{ margin: 0, fontSize: 10, color: "#444", textAlign: "center", maxWidth: 260, lineHeight: 1.5 }}>
        Local demo gate — a soft unlock for this device, not secure content protection.
      </p>
    </div>
  );
}

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
      kind: band === "boss" ? "boss" : "monster",
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

// ─── Visibility options ───────────────────────────────────────────────────────

const visibilityOptions: { value: MainMonsterVisibilityState; label: string }[] = [
  { value: "hidden", label: "Hidden" },
  { value: "label-only", label: "Label Only" },
  { value: "condition", label: "Show Condition" },
  { value: "hp-bar", label: "Show HP Bar" },
  { value: "full", label: "Full Reveal" },
];

// ─── Inline monster template editor ──────────────────────────────────────────

type MonsterTemplateEditorProps = {
  template: MainMonsterTemplate;
  onSave: (updated: MainMonsterTemplate) => void;
  onCancel: () => void;
};

function MonsterTemplateEditor({ template, onSave, onCancel }: MonsterTemplateEditorProps) {
  const [draft, setDraft] = useState<MainMonsterTemplate>(() => JSON.parse(JSON.stringify(template)));

  function updateStat<K extends keyof MainMonsterTemplate["stats"]>(key: K, val: MainMonsterTemplate["stats"][K]) {
    setDraft(d => ({ ...d, stats: { ...d.stats, [key]: val } }));
  }

  function updateAction(list: "actions" | "traits" | "reactions", idx: number, field: keyof MonsterReaderAction, val: string) {
    setDraft(d => {
      const next = [...d[list]] as MonsterReaderAction[];
      next[idx] = { ...next[idx], [field]: val };
      return { ...d, [list]: next };
    });
  }

  function addAction(list: "actions" | "traits" | "reactions") {
    const newAction: MonsterReaderAction = { name: "", kind: list === "traits" ? "trait" : list === "reactions" ? "reaction" : "action" };
    setDraft(d => ({ ...d, [list]: [...d[list], newAction] }));
  }

  function removeAction(list: "actions" | "traits" | "reactions", idx: number) {
    setDraft(d => ({ ...d, [list]: d[list].filter((_, i) => i !== idx) }));
  }

  const actionRowStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 3, background: "#0d0d14", borderRadius: 4, padding: "6px 8px", marginBottom: 4 };
  const inputStyle: React.CSSProperties = { padding: "2px 6px", borderRadius: 3, border: "1px solid #444", background: "#111", color: "#fff", fontSize: 11, width: "100%" };
  const labelStyle: React.CSSProperties = { fontSize: 10, color: "#666", marginBottom: 1, display: "block" };

  function renderActionList(list: "actions" | "traits" | "reactions", title: string, accent: string, emptyHint: string) {
    const count = draft[list].length;
    return (
      <div style={{ marginTop: 12, borderLeft: `3px solid ${accent}`, paddingLeft: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: accent, textTransform: "uppercase", letterSpacing: 1 }}>
            {title}
            {count > 0 && (
              <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 8, background: accent, color: "#0d0d14", letterSpacing: 0 }}>{count}</span>
            )}
          </span>
          <button type="button" onClick={() => addAction(list)} style={{ fontSize: 10, padding: "1px 7px", background: "#7b68ee22", border: "1px solid #7b68ee44", borderRadius: 3, color: "#7b68ee", cursor: "pointer" }}>+ Add</button>
        </div>
        {draft[list].map((a, i) => (
          <div key={i} style={actionRowStyle}>
            <div style={{ display: "flex", gap: 4 }}>
              <div style={{ flex: 2 }}>
                <span style={labelStyle}>Name</span>
                <input value={a.name} onChange={e => updateAction(list, i, "name", e.target.value)} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <span style={labelStyle}>Roll</span>
                <input value={a.roll ?? ""} onChange={e => updateAction(list, i, "roll", e.target.value)} placeholder="1d20+4" style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <span style={labelStyle}>Dmg</span>
                <input value={a.damage ?? ""} onChange={e => updateAction(list, i, "damage", e.target.value)} placeholder="1d6+2" style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <span style={labelStyle}>Recharge</span>
                <input value={(a as MonsterReaderAction & { recharge?: string }).recharge ?? ""} onChange={e => updateAction(list, i, "recharge" as keyof MonsterReaderAction, e.target.value)} placeholder="5-6" style={inputStyle} title="Recharge range e.g. '6' or '5-6'" />
              </div>
              <button type="button" onClick={() => removeAction(list, i)} style={{ alignSelf: "flex-end", fontSize: 10, padding: "2px 5px", background: "transparent", border: "1px solid #5a1a1a", borderRadius: 3, color: "#ff9999", cursor: "pointer" }}>✕</button>
            </div>
            <div>
              <span style={labelStyle}>Text</span>
              <input value={a.text ?? ""} onChange={e => updateAction(list, i, "text", e.target.value)} style={inputStyle} />
            </div>
          </div>
        ))}
        {draft[list].length === 0 && <p style={{ fontSize: 11, color: "#555", fontStyle: "italic", margin: "2px 0 0" }}>{emptyHint}</p>}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "8px 14px", borderBottom: "1px solid #2a2a3e", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Edit Monster</span>
          <span title="Monsters you create are saved to your personal My Library" style={{ fontSize: 9, padding: "1px 7px", borderRadius: 8, background: "#16291b", border: "1px solid #2f7d3f", color: "#7be08a", textTransform: "uppercase", letterSpacing: 1 }}>My Library</span>
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" onClick={() => onSave(draft)}
            style={{ fontSize: 11, padding: "3px 12px", background: "#34c759", color: "#06210f", border: "none", borderRadius: 3, cursor: "pointer", fontWeight: 700 }}>
            ✓ Save to My Library
          </button>
          <button type="button" onClick={onCancel}
            style={{ fontSize: 11, padding: "3px 8px", background: "transparent", border: "1px solid #444", borderRadius: 3, color: "#888", cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
        {/* Name + kind */}
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 2 }}>
            <span style={labelStyle}>Name</span>
            <input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
              style={{ ...inputStyle, fontSize: 13, fontWeight: 500 }} />
          </div>
          <div style={{ flex: 1 }}>
            <span style={labelStyle}>Kind</span>
            <select value={draft.stats.kind} onChange={e => updateStat("kind", e.target.value as MainMonsterTemplate["stats"]["kind"])}
              style={{ ...inputStyle, fontSize: 11 }}>
              <option value="monster">Monster</option>
              <option value="boss">Boss</option>
              <option value="npc">NPC</option>
            </select>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <span style={labelStyle}>Max HP</span>
            <input type="number" value={draft.stats.maxHp} onChange={e => updateStat("maxHp", Number(e.target.value))} style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <span style={labelStyle}>AC</span>
            <input value={String(draft.stats.ac)} onChange={e => updateStat("ac", isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value))} style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <span style={labelStyle}>Speed</span>
            <input value={draft.stats.speed} onChange={e => updateStat("speed", e.target.value)} style={inputStyle} />
          </div>
        </div>

        {/* Visibility */}
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <span style={labelStyle}>Default Visibility</span>
            <select value={draft.visibility.defaultState}
              onChange={e => setDraft(d => ({ ...d, visibility: { ...d.visibility, defaultState: e.target.value as MainMonsterVisibilityState } }))}
              style={{ ...inputStyle, fontSize: 11 }}>
              {visibilityOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <span style={labelStyle}>Hidden Name</span>
            <input value={draft.visibility.hiddenName}
              onChange={e => setDraft(d => ({ ...d, visibility: { ...d.visibility, hiddenName: e.target.value } }))}
              style={inputStyle} />
          </div>
        </div>

        {/* Actions / Traits / Reactions — each section color-accented.
            Recharge actions: set the Recharge field on a row (e.g. "5-6").
            Bonus actions: name the row and note "bonus" in its Text. */}
        {renderActionList("actions", "Actions", "#ff6b5e", "No actions yet — click + Add for an attack, multiattack, bonus, or recharge action.")}
        {renderActionList("reactions", "Reactions", "#9be9a8", "No reactions yet — click + Add for a triggered reaction.")}
        {renderActionList("traits", "Traits", "#e07bff", "No traits yet — click + Add for passive or signature traits.")}
      </div>
    </div>
  );
}

// ─── Encounter entry editor ───────────────────────────────────────────────────

type EntryEditorProps = {
  entry: EncounterMonsterEntry;
  monsterLibrary: MainMonsterTemplate[];
  onChange: (entry: EncounterMonsterEntry) => void;
  onRemove: () => void;
  onEditMonster: (templateId: string) => void;
};

function EntryEditor({ entry, monsterLibrary, onChange, onRemove, onEditMonster }: EntryEditorProps) {
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
        <button type="button" onClick={() => onEditMonster(entry.templateId)}
          title="Edit this monster's stats"
          style={{ fontSize: 11, padding: "2px 7px", background: "#7b68ee22", border: "1px solid #7b68ee44", borderRadius: 3, color: "#7b68ee", cursor: "pointer" }}>
          ✎
        </button>
        <button type="button" onClick={onRemove} style={{ fontSize: 11, padding: "2px 6px", background: "transparent", border: "1px solid #5a1a1a", borderRadius: 3, color: "#ff9999", cursor: "pointer" }}>✕</button>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <select
          value={entry.hpVariant}
          onChange={e => onChange({ ...entry, hpVariant: e.target.value as EncounterMonsterEntry["hpVariant"] })}
          style={{ fontSize: 11, padding: "2px 4px", borderRadius: 3, border: "1px solid #444", background: "#111", color: "#aaa", flex: 1 }}
        >
          <option value="low">Low HP</option>
          <option value="standard">Standard</option>
          <option value="high">High HP</option>
        </select>
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
};

export function EncounterLibraryPanel({
  monsterLibrary,
  onLoadEncounter,
  onClearRoster,
  activeRosterCount,
  onMonsterLibraryUpdate,
  autoOpenBandPicker = false,
}: EncounterLibraryPanelProps) {
  const [unlocked, setUnlocked] = useState(() => isModuleUnlocked());
  const [showBandPicker, setShowBandPicker] = useState(autoOpenBandPicker);
  const [encounters, setEncounters] = useState<EncounterDefinition[]>([]);
  const [unusedEncounters, setUnusedEncounters] = useState<EncounterDefinition[]>(() => loadUnusedEncounters());
  const [editingId, setEditingId] = useState<string | null>(null);
  // Monster template editor — overlays the encounter edit view
  const [editingMonsterTemplateId, setEditingMonsterTemplateId] = useState<string | null>(null);
  // Local overrides for templates edited this session (before parent re-renders)
  const [monsterOverrides, setMonsterOverrides] = useState<Record<string, MainMonsterTemplate>>({});
  const [monsterImportResult, setMonsterImportResult] = useState<MonsterImportResult | null>(null);
  const [dmMonsterCount, setDmMonsterCount] = useState(() => loadMonsterLibrary().length);
  const [editDraft, setEditDraft] = useState<EncounterDefinition | null>(null);
  const [addingTemplateId, setAddingTemplateId] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [activeTab, setActiveTab] = useState<"library" | "staged">("library");
  const [saveTargetDraft, setSaveTargetDraft] = useState<"campaign" | "dm">("dm");
  // Staged queue — instances ready to push to combat, persisted in localStorage
  const [staged, setStaged] = useState<StagedEntry[]>(() => {
    try {
      const raw = window.localStorage.getItem("fdmc.dm.encounterStagedQueue.v1");
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });

  // Merge base library with any in-session edits.
  // Also include newly-created templates that aren't in the parent's library yet
  // (parent re-renders asynchronously; overrides make them visible immediately).
  const resolvedLibrary = [
    ...monsterLibrary.map(t => monsterOverrides[t.templateId] ?? t),
    ...Object.values(monsterOverrides).filter(
      t => !monsterLibrary.some(m => m.templateId === t.templateId)
    ),
  ];

  function handleSaveMonsterTemplate(updated: MainMonsterTemplate) {
    // Save to DM localStorage library
    upsertMonsterTemplate(updated);
    // Update local override so the encounter editor sees it immediately
    setMonsterOverrides(prev => ({ ...prev, [updated.templateId]: updated }));
    // Notify parent if it wants to refresh its static library copy
    onMonsterLibraryUpdate?.(updated);
    setEditingMonsterTemplateId(null);
  }

  function persistStaged(next: StagedEntry[]) {
    setStaged(next);
    try { window.localStorage.setItem("fdmc.dm.encounterStagedQueue.v1", JSON.stringify(next)); } catch { /* ok */ }
  }

  function stageEncounter(encounter: EncounterDefinition) {
    const instances = spawnEncounterInstances(encounter, monsterLibrary);
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

  // Lock snap-back guard — if the stored unlock flag is cleared or tampered (e.g.
  // someone pokes localStorage in the console), re-lock the UI until the correct code
  // is entered again. Front-end soft gate only.
  useEffect(() => {
    if (!unlocked) return;
    function revalidate() { if (!isModuleUnlocked()) setUnlocked(false); }
    window.addEventListener("storage", revalidate);
    const interval = window.setInterval(revalidate, 2000);
    return () => { window.removeEventListener("storage", revalidate); window.clearInterval(interval); };
  }, [unlocked]);

  // Load / seed encounters on mount
  useEffect(() => {
    if (!unlocked) return;
    const seeded = seedEncounterLibraryFromTemplates(monsterLibrary);
    setEncounters(seeded);
  }, [unlocked, monsterLibrary]);

  const refreshLibrary = useCallback(() => {
    setEncounters(loadEncounterLibrary());
    setUnusedEncounters(loadUnusedEncounters());
  }, []);

  // Clear stale monster template editor ID if template no longer exists
  useEffect(() => {
    if (editingMonsterTemplateId && !resolvedLibrary.find(t => t.templateId === editingMonsterTemplateId)) {
      setEditingMonsterTemplateId(null);
    }
  }, [editingMonsterTemplateId, resolvedLibrary]);

  function handleUnlock() {
    setUnlocked(true);
  }

  function handleLock() {
    lockModule();
    setUnlocked(false);
  }

  function startEdit(encounter: EncounterDefinition) {
    setEditDraft(JSON.parse(JSON.stringify(encounter)));
    setEditingId(encounter.id);
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
    const template = monsterLibrary.find(t => t.templateId === addingTemplateId);
    if (!template) return;
    setEditDraft({
      ...editDraft,
      entries: [...editDraft.entries, {
        templateId: addingTemplateId,
        count: 1,
        hpVariant: "standard",
        startingVisibility: template.visibility.defaultState,
        hiddenNameOverride: template.visibility.hiddenName,
      }],
    });
    setAddingTemplateId("");
  }

  function handleLoadEncounter(encounter: EncounterDefinition) {
    const instances = spawnEncounterInstances(encounter, monsterLibrary);
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

  if (!unlocked) {
    return <ModuleLockScreen onUnlock={handleUnlock} />;
  }

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
          onSave={handleSaveMonsterTemplate}
          onCancel={() => setEditingMonsterTemplateId(null)}
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
          <input
            type="text"
            value={editDraft.name}
            onChange={e => setEditDraft({ ...editDraft, name: e.target.value })}
            style={{ fontWeight: "bold", background: "transparent", border: "none", borderBottom: "1px solid #555", color: "inherit", fontSize: 14, width: 200 }}
          />
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <button type="button" onClick={() => saveEdit("campaign")}
              style={{ fontSize: 11, padding: "3px 9px", background: "#7b68ee33", border: "1px solid #7b68ee", borderRadius: 3, color: "#7b68ee", cursor: "pointer" }}
              title="Save to Campaign Library (module-locked)">
              → Campaign
            </button>
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
              {resolvedLibrary.map(t => (
                <option key={t.templateId} value={t.templateId}>{t.name}</option>
              ))}
            </select>
            <button type="button" onClick={handleAddEntry} disabled={!addingTemplateId}
              style={{ fontSize: 12, padding: "4px 10px", background: addingTemplateId ? "#7b68ee" : "#333", color: "#fff", border: "none", borderRadius: 4, cursor: addingTemplateId ? "pointer" : "default" }}>
              + Add
            </button>
          </div>

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
              {/* Create a new monster — opens the band picker (guided scaffold) */}
              <button type="button"
                onClick={() => setShowBandPicker(true)}
                style={{ fontSize: 11, padding: "3px 8px", background: "#7b68ee", color: "#fff", border: "none", borderRadius: 3, cursor: "pointer", fontWeight: 600 }}
                title="Create a new monster — pick a band to scaffold its action economy">
                + Create Monster
              </button>
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
          {dmMonsterCount > 0 && (
            <button type="button" onClick={() => exportMonsterLibrary()}
              style={{ fontSize: 11, padding: "3px 8px", background: "#2a3a2a", color: "#4caf50", border: "1px solid #2a6e2a55", borderRadius: 3, cursor: "pointer" }}
              title={`Export your ${dmMonsterCount} custom monster${dmMonsterCount === 1 ? "" : "s"} to JSON`}>
              ↓ Monsters
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
                if (result.ok) setDmMonsterCount(loadMonsterLibrary().length);
              });
              e.target.value = "";
            }} />
          </label>
          <button type="button" onClick={handleLock}
            style={{ fontSize: 11, padding: "3px 8px", background: "transparent", border: "1px solid #333", borderRadius: 3, color: "#555", cursor: "pointer" }}
            title="Lock campaign module">
            🔒
          </button>
        </div>
      </div>

      {/* Import result notification */}
      {monsterImportResult && (
        <div style={{ padding: "5px 14px", background: monsterImportResult.ok ? "#0d1a0d" : "#1a0a0a", borderBottom: "1px solid #2a2a3e", fontSize: 11, color: monsterImportResult.ok ? "#4caf50" : "#ff9999", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{monsterImportResult.ok ? "✓" : "✕"} {monsterImportResult.message}</span>
          <button type="button" onClick={() => setMonsterImportResult(null)} style={{ background: "transparent", border: "none", color: "#555", cursor: "pointer", fontSize: 11 }}>×</button>
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
        {encounters.length === 0 ? (
          <p style={{ fontSize: 12, color: "#555", textAlign: "center", marginTop: 32 }}>
            No encounters yet. Use + Mine to create your own, or unlock the campaign module.
          </p>
        ) : (
          (() => {
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
                        const t = monsterLibrary.find(m => m.templateId === e.templateId);
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
                {/* Campaign Library section */}
                {unlocked && campaign.length > 0 && (
                  <>
                    <p style={{ margin: "0 0 6px", fontSize: 10, color: "#7b68ee", textTransform: "uppercase", letterSpacing: 1 }}>
                      🔒 Campaign Library — The Broken Chain
                    </p>
                    {campaign.sort((a, b) => (a.order ?? 99) - (b.order ?? 99)).map(renderEncounter)}
                  </>
                )}

                {/* DM Custom Library section */}
                {dm.length > 0 && (
                  <>
                    <p style={{ margin: `${unlocked && campaign.length > 0 ? "12px" : "0"} 0 6px`, fontSize: 10, color: "#4caf50", textTransform: "uppercase", letterSpacing: 1 }}>
                      My Library
                    </p>
                    {dm.map(renderEncounter)}
                  </>
                )}

                {!unlocked && campaign.length === 0 && dm.length === 0 && (
                  <p style={{ fontSize: 12, color: "#555", textAlign: "center", marginTop: 32 }}>
                    No encounters yet. Use + Mine to create your own.
                  </p>
                )}
              </>
            );
          })()
        )}

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
                <button
                  type="button"
                  onClick={() => { restoreEncounter(enc.id); refreshLibrary(); }}
                  style={{ fontSize: 11, padding: "2px 10px", background: "#1a3a1a", border: "1px solid #2a6e2a55", borderRadius: 3, color: "#4caf50", cursor: "pointer" }}
                >
                  Restore
                </button>
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
                  downloadExport(exportSummaryAsText(summary), `fdmc-encounter-${Date.now()}.txt`);
                }}
                style={{ fontSize: 11, padding: "3px 10px", background: "#2a6e2a22", border: "1px solid #2a6e2a55", borderRadius: 3, color: "#4caf50", cursor: "pointer" }}>
                ↓ Export Text
              </button>
              <button type="button"
                onClick={() => {
                  const bk = log.find((e: EncounterLogEntry) => e.type === "boss-killed");
                  const summary = generatePostCombatSummary(log, bk?.actorId ?? "encounter", bk?.actorName ?? "Encounter");
                  downloadExport(exportSummaryAsJson(summary), `fdmc-encounter-${Date.now()}.json`, "application/json");
                }}
                style={{ fontSize: 11, padding: "3px 10px", background: "#2a2a3e", border: "1px solid #7b68ee44", borderRadius: 3, color: "#7b68ee", cursor: "pointer" }}>
                ↓ Export JSON
              </button>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
