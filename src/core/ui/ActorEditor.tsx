import { useState } from "react";
import type { Actor, AbilityId, AbilityScores } from "../types/actor";
import type { TabId, TabActionMap } from "../types/tabs";
import { ActorEditorActionTab } from "./ActorEditorActionTab";
import { EquipmentBagEditor } from "./EquipmentBagEditor";
import { ResourceTableEditor } from "./ResourceTableEditor";
import { SpellTableEditor } from "./SpellTableEditor";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActorEditorMode = "edit-current" | "create-new" | "duplicate";

export type ActorEditorSaveMode = "current" | "current-and-library" | "duplicate";

export type ActorEditorProps = {
  actor?: Actor;  // optional — if omitted, editor starts blank (create-new mode)
  mode: ActorEditorMode;
  onSave: (actor: Actor, saveMode: ActorEditorSaveMode) => void;
  onCancel: () => void;
  /** When true: replaces all save buttons with a single "Submit for DM Approval" button.
   *  Used by the player-facing level-up flow. The DM receives the full proposed actor. */
  proposeMode?: boolean;
};

// Blank actor used as the base for create-new mode
function createBlankActor(): Actor {
  return {
    id: `actor-${Date.now().toString(36)}`,
    kind: "player",
    name: "",
    subtitle: "",
    level: 1,
    stats: { ac: 10, hp: { current: 10, max: 10, temp: 0 }, speed: "30 ft" },
    pinnedReactions: [],
    tabs: {
      main: [], bonus: [], spells: [], bond: [], checks: [],
      features: [], status: [], equipment: [], resources: [], outOfCombat: [], notes: [],
    },
  };
}

type EditorTab =
  | "profile"
  | "actions"
  | "bonus"
  | "reactions"
  | "bonds"
  | "spells"
  | "resources"
  | "equipment"
  | "notes";

const EDITOR_TAB_LABELS: Record<EditorTab, string> = {
  profile: "Profile",
  actions: "Actions",
  bonus: "Bonus",
  reactions: "Reactions",
  bonds: "Bond",
  spells: "Spells",
  resources: "Resources / Features",
  equipment: "Equipment",
  notes: "Notes",
};

const EDITOR_TABS: EditorTab[] = ["profile", "actions", "bonus", "reactions", "bonds", "spells", "resources", "equipment", "notes"];

const ABILITY_IDS: AbilityId[] = ["str", "dex", "con", "int", "wis", "cha"];
const ABILITY_LABELS: Record<AbilityId, string> = { str: "STR", dex: "DEX", con: "CON", int: "INT", wis: "WIS", cha: "CHA" };

// ─── Profile form ─────────────────────────────────────────────────────────────

type ProfileDraft = {
  name: string;
  subtitle: string;
  race: string;
  className: string;
  /** e.g. "3 / 2" for Fighter 3 / Rogue 2. Left blank for single-class. */
  multiclassLevels: string;
  level: string;
  ac: string;
  hpMax: string;
  hpCurrent: string;
  speed: string;
  abilities: Record<AbilityId, { score: string; modifier: string }>;
  classFeatureLabel: string;
  classFeatureValue: string;
  classFeatureNote: string;
};

function actorToProfileDraft(actor: Actor): ProfileDraft {
  return {
    name: actor.name,
    subtitle: actor.subtitle,
    race: actor.race ?? "",
    className: actor.className ?? "",
    multiclassLevels: "",  // not stored separately yet — DM enters manually when building
    level: String(actor.level),
    ac: String(actor.stats.ac),
    hpMax: String(actor.stats.hp.max),
    hpCurrent: String(actor.stats.hp.current),
    speed: typeof actor.stats.speed === "string" ? actor.stats.speed : "30 ft",
    abilities: Object.fromEntries(
      ABILITY_IDS.map(id => [id, {
        score: String(actor.abilityScores?.[id]?.score ?? ""),
        modifier: String(actor.abilityScores?.[id]?.modifier ?? ""),
      }])
    ) as ProfileDraft["abilities"],
    classFeatureLabel: actor.classFeatureTracker?.label ?? "",
    classFeatureValue: actor.classFeatureTracker?.value ?? "",
    classFeatureNote: actor.classFeatureTracker?.note ?? "",
  };
}

function profileDraftToActorPatch(draft: ProfileDraft): Partial<Actor> {
  const level = Number.parseInt(draft.level, 10);
  const ac = Number.parseInt(draft.ac, 10);
  const hpMax = Number.parseInt(draft.hpMax, 10);
  const hpCurrent = Math.min(Number.parseInt(draft.hpCurrent, 10), hpMax);

  const abilities: AbilityScores = {};
  for (const id of ABILITY_IDS) {
    const score = Number.parseInt(draft.abilities[id].score, 10);
    const modifier = Number.parseInt(draft.abilities[id].modifier, 10);
    if (Number.isFinite(score) || Number.isFinite(modifier)) {
      abilities[id] = {
        ...(Number.isFinite(score) ? { score } : {}),
        ...(Number.isFinite(modifier) ? { modifier } : {}),
      };
    }
  }

  return {
    name: draft.name.trim() || "Unnamed Actor",
    subtitle: draft.subtitle.trim(),
    race: draft.race.trim() || undefined,
    // For multiclass: store "Fighter / Rogue" in className so the card shows it correctly
    className: draft.className.trim() || undefined,
    level: Number.isFinite(level) ? level : 1,
    stats: {
      ac: Number.isFinite(ac) ? ac : 10,
      hp: {
        current: Number.isFinite(hpCurrent) ? hpCurrent : 1,
        max: Number.isFinite(hpMax) ? hpMax : 1,
        temp: 0,
      },
      speed: draft.speed.trim() || "30 ft",
    },
    abilityScores: Object.keys(abilities).length > 0 ? abilities : undefined,
    classFeatureTracker: draft.classFeatureLabel.trim() ? {
      label: draft.classFeatureLabel.trim(),
      value: draft.classFeatureValue.trim(),
      note: draft.classFeatureNote.trim() || undefined,
    } : undefined,
  };
}

// ─── Profile tab ──────────────────────────────────────────────────────────────

function ProfileTab({ draft, onChange }: { draft: ProfileDraft; onChange: (d: ProfileDraft) => void }) {
  function set<K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) {
    onChange({ ...draft, [key]: value });
  }

  function setAbility(id: AbilityId, field: "score" | "modifier", value: string) {
    onChange({ ...draft, abilities: { ...draft.abilities, [id]: { ...draft.abilities[id], [field]: value } } });
  }

  const inputStyle = { display: "block", width: "100%", marginTop: 2, padding: "4px 8px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff", fontSize: 13 };
  const labelStyle: React.CSSProperties = { fontSize: 12, display: "block" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <label style={labelStyle}>Name <input type="text" value={draft.name} onChange={e => set("name", e.target.value)} style={inputStyle} /></label>
        <label style={labelStyle}>Subtitle <input type="text" value={draft.subtitle} onChange={e => set("subtitle", e.target.value)} style={inputStyle} /></label>
        <label style={labelStyle}>Race <input type="text" value={draft.race} onChange={e => set("race", e.target.value)} style={inputStyle} /></label>
        <label style={labelStyle}>
          Class
          <input type="text" value={draft.className} onChange={e => set("className", e.target.value)}
            placeholder="Fighter  — or —  Fighter / Rogue"
            style={inputStyle} />
        </label>
        {/* Multiclass level split — only shown when className contains "/" */}
        {draft.className.includes("/") && (
          <label style={{ ...labelStyle, gridColumn: "span 2" }}>
            <span style={{ color: "#7b68ee" }}>⚡ Multiclass detected</span>
            <span style={{ fontSize: 11, color: "#888", marginLeft: 8 }}>Enter level split e.g. "3 / 2"</span>
            <input type="text" value={draft.multiclassLevels}
              onChange={e => {
                set("multiclassLevels", e.target.value);
                // Auto-update subtitle to show class + levels if not already custom
                const levels = e.target.value.trim();
                const classes = draft.className.trim();
                if (levels && classes) {
                  const parts = classes.split("/").map(s => s.trim());
                  const levelParts = levels.split("/").map(s => s.trim());
                  const combined = parts.map((c, i) => `${c} ${levelParts[i] ?? ""}`.trim()).join(" / ");
                  if (!draft.subtitle || draft.subtitle.startsWith(draft.className) || draft.subtitle.includes(" / ")) {
                    set("subtitle", `${draft.race ? `${draft.race} ` : ""}${combined} · Level ${draft.level}`);
                  }
                }
              }}
              placeholder="3 / 2"
              style={{ ...inputStyle, marginTop: 4, maxWidth: 120 }} />
          </label>
        )}
        <label style={labelStyle}>Level <input type="number" min={1} max={20} value={draft.level} onChange={e => set("level", e.target.value)} style={inputStyle} /></label>
        <label style={labelStyle}>AC <input type="number" min={1} max={30} value={draft.ac} onChange={e => set("ac", e.target.value)} style={inputStyle} /></label>
        <label style={labelStyle}>HP Max <input type="number" min={1} value={draft.hpMax} onChange={e => set("hpMax", e.target.value)} style={inputStyle} /></label>
        <label style={labelStyle}>HP Current <input type="number" min={0} value={draft.hpCurrent} onChange={e => set("hpCurrent", e.target.value)} style={inputStyle} /></label>
        <label style={{ ...labelStyle, gridColumn: "span 2" }}>Speed <input type="text" value={draft.speed} onChange={e => set("speed", e.target.value)} style={inputStyle} /></label>
      </div>

      <h4 style={{ margin: "4px 0 0" }}>Ability Scores</h4>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
        {ABILITY_IDS.map(id => (
          <div key={id} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 2 }}>{ABILITY_LABELS[id]}</div>
            <input type="number" value={draft.abilities[id].score} onChange={e => setAbility(id, "score", e.target.value)}
              placeholder="—" title="Score"
              style={{ width: "100%", padding: "2px 4px", borderRadius: 3, border: "1px solid #333", background: "#111", color: "#fff", fontSize: 12, textAlign: "center" }} />
            <input type="number" value={draft.abilities[id].modifier} onChange={e => setAbility(id, "modifier", e.target.value)}
              placeholder="mod" title="Modifier"
              style={{ width: "100%", padding: "2px 4px", borderRadius: 3, border: "1px solid #222", background: "#0d0d0d", color: "#aaa", fontSize: 11, textAlign: "center", marginTop: 2 }} />
          </div>
        ))}
      </div>

      <h4 style={{ margin: "4px 0 0" }}>Class Feature Tracker</h4>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <label style={labelStyle}>Label <input type="text" value={draft.classFeatureLabel} onChange={e => set("classFeatureLabel", e.target.value)} placeholder="Rage / Ki / Spell Slots" style={inputStyle} /></label>
        <label style={labelStyle}>Value <input type="text" value={draft.classFeatureValue} onChange={e => set("classFeatureValue", e.target.value)} placeholder="2/3 Rage" style={inputStyle} /></label>
        <label style={{ ...labelStyle, gridColumn: "span 2" }}>Note <input type="text" value={draft.classFeatureNote} onChange={e => set("classFeatureNote", e.target.value)} placeholder="Save DC 13. Recharges on Short Rest." style={inputStyle} /></label>
      </div>
    </div>
  );
}

// ─── Main editor ──────────────────────────────────────────────────────────────

export function ActorEditor({ actor: actorProp, mode, onSave, onCancel, proposeMode = false }: ActorEditorProps) {
  const actor = actorProp ?? createBlankActor();
  const [activeTab, setActiveTab] = useState<EditorTab>("profile");
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>(() => actorToProfileDraft(actor));
  const [tabsDraft, setTabsDraft] = useState<TabActionMap>(() => ({ ...actor.tabs }));
  const [showDanger, setShowDanger] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  function buildEditedActor(newId?: string): Actor {
    const profilePatch = profileDraftToActorPatch(profileDraft);
    return {
      ...actor,
      ...profilePatch,
      id: newId ?? actor.id,
      tabs: tabsDraft,
      stats: profilePatch.stats ?? actor.stats,
    };
  }

  function handleTabActions(tabId: TabId) {
    return (actions: typeof tabsDraft[typeof tabId]) => {
      setTabsDraft(d => ({ ...d, [tabId]: actions }));
    };
  }

  const modeLabel = proposeMode
    ? "Propose Level-Up Changes"
    : mode === "edit-current" ? "Edit Actor"
    : mode === "duplicate" ? "Duplicate Actor"
    : "Create New Actor";

  return (
    <div className="actor-editor" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "10px 14px", borderBottom: "1px solid #2a2a3e", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, color: "#888" }}>{modeLabel}</p>
          <h3 style={{ margin: 0 }}>{profileDraft.name || "Unnamed Actor"}</h3>
        </div>
        <button type="button" onClick={onCancel} style={{ fontSize: 12, padding: "3px 10px", background: "transparent", border: "1px solid #444", borderRadius: 4, color: "#888", cursor: "pointer" }}>Cancel</button>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", overflowX: "auto", borderBottom: "1px solid #2a2a3e", background: "#0d0d14" }}>
        {EDITOR_TABS.map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "7px 12px",
              fontSize: 12,
              background: "transparent",
              border: "none",
              borderBottom: activeTab === tab ? "2px solid #7b68ee" : "2px solid transparent",
              color: activeTab === tab ? "#fff" : "#666",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {EDITOR_TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: "auto", padding: 14 }}>
        {activeTab === "profile" && (
          <ProfileTab draft={profileDraft} onChange={setProfileDraft} />
        )}
        {activeTab === "actions" && (
          <ActorEditorActionTab tabId="main" actions={tabsDraft.main ?? []} onChange={handleTabActions("main")} />
        )}
        {activeTab === "bonus" && (
          <ActorEditorActionTab tabId="bonus" actions={tabsDraft.bonus ?? []} onChange={handleTabActions("bonus")} />
        )}
        {activeTab === "reactions" && (
          <ActorEditorActionTab tabId="main" actions={tabsDraft.main?.filter(a => a.economyCost?.includes("reaction")) ?? []} onChange={actions => {
            const nonReaction = (tabsDraft.main ?? []).filter(a => !a.economyCost?.includes("reaction"));
            handleTabActions("main")([...nonReaction, ...actions]);
          }} />
        )}
        {activeTab === "bonds" && (
          <ActorEditorActionTab tabId="bond" actions={tabsDraft.bond ?? []} onChange={handleTabActions("bond")} />
        )}
        {activeTab === "spells" && (
          <SpellTableEditor
            actions={tabsDraft.spells ?? []}
            onChange={handleTabActions("spells")}
          />
        )}
        {activeTab === "resources" && (
          <ResourceTableEditor
            actions={tabsDraft.resources ?? []}
            onChange={handleTabActions("resources")}
          />
        )}
        {activeTab === "equipment" && (
          <EquipmentBagEditor
            equippedActions={tabsDraft.equipment ?? []}
            onChange={handleTabActions("equipment")}
          />
        )}
        {activeTab === "notes" && (
          <ActorEditorActionTab tabId="notes" actions={tabsDraft.notes ?? []} onChange={handleTabActions("notes")} />
        )}
      </div>

      {/* Save buttons */}
      <div style={{ padding: "10px 14px", borderTop: "1px solid #2a2a3e", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {proposeMode ? (
            /* Player propose mode — single submit button, no direct save */
            <button
              type="button"
              onClick={() => onSave(buildEditedActor(), "current")}
              style={{ flex: 1, padding: "7px 12px", background: "#7b68ee", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 13, fontWeight: 500 }}
            >
              Submit for DM Approval
            </button>
          ) : (
            /* DM mode — full save options */
            <>
              <button
                type="button"
                onClick={() => onSave(buildEditedActor(), "current")}
                style={{ flex: 1, padding: "7px 12px", background: "#7b68ee", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 13, fontWeight: 500 }}
              >
                Save to Current Actor
              </button>
              <button
                type="button"
                onClick={() => onSave(buildEditedActor(), "current-and-library")}
                style={{ flex: 1, padding: "7px 12px", background: "#2a6e2a", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 13 }}
              >
                Save to Current + Library
              </button>
              <button
                type="button"
                onClick={() => onSave(buildEditedActor(`${actor.id}-copy-${Date.now().toString(36)}`), "duplicate")}
                style={{ padding: "7px 12px", background: "transparent", color: "#aaa", border: "1px solid #444", borderRadius: 4, cursor: "pointer", fontSize: 13 }}
              >
                Duplicate
              </button>
            </>
          )}
        </div>

        {/* Danger zone — DM only, hidden in propose mode */}
        {!proposeMode && (
          <button
            type="button"
            onClick={() => setShowDanger(d => !d)}
            style={{ fontSize: 11, color: "#888", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}
          >
            {showDanger ? "▲ Hide danger zone" : "▼ Danger zone"}
          </button>
        )}

        {showDanger && (
          <div style={{ background: "#1a0a0a", borderRadius: 4, padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
            <p style={{ margin: 0, fontSize: 11, color: "#ff9999" }}>
              Delete requires typing the actor's name exactly.
            </p>
            <input
              type="text"
              placeholder={`Type "${actor.name}" to confirm`}
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid #5a1a1a", background: "#111", color: "#fff", fontSize: 12 }}
            />
            <button
              type="button"
              disabled={deleteConfirm !== actor.name}
              onClick={() => onSave({ ...buildEditedActor(), id: `${actor.id}--DELETED` }, "current")}
              style={{
                padding: "5px 12px", background: deleteConfirm === actor.name ? "#8b0000" : "#333",
                color: deleteConfirm === actor.name ? "#fff" : "#666",
                border: "none", borderRadius: 4, cursor: deleteConfirm === actor.name ? "pointer" : "default", fontSize: 12,
              }}
            >
              Delete Actor Permanently
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
