import { useState } from "react";
import { loadPendingDrafts, savePendingDraft, removePendingDraft, newPendingDraftId, type PendingDraft } from "../state/pendingDrafts";
import type { Actor, AbilityId, AbilityScores, ActorKind } from "../types/actor";
import type { TabId, TabActionMap } from "../types/tabs";
import { ActorEditorActionTab } from "./ActorEditorActionTab";
import { EquipmentBagEditor } from "./EquipmentBagEditor";
import { ResourceTableEditor } from "./ResourceTableEditor";
import { SpellTableEditor } from "./SpellTableEditor";
import { tabAccent } from "./tabVisuals";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActorEditorMode = "edit-current" | "create-new" | "duplicate";

export type ActorEditorSaveMode = "current" | "current-and-library" | "duplicate";

export type OwnerOption = { id: string; name: string };

export type ActorEditorProps = {
  actor?: Actor;  // optional — if omitted, editor starts blank (create-new mode)
  mode: ActorEditorMode;
  onSave: (actor: Actor, saveMode: ActorEditorSaveMode) => void;
  onCancel: () => void;
  /** When true: replaces all save buttons with a single "Submit for DM Approval" button.
   *  Used by the player-facing level-up flow. The DM receives the full proposed actor. */
  proposeMode?: boolean;
  /** Candidate owners (player actors) for the Companion "Owner" dropdown. */
  ownerOptions?: OwnerOption[];
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
      features: [], feats: [], status: [], equipment: [], resources: [], outOfCombat: [], notes: [],
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
  | "feats"
  | "equipment"
  | "notes";

const EDITOR_TAB_LABELS: Record<EditorTab, string> = {
  profile: "Profile",
  actions: "Class Actions",
  bonus: "Bonus",
  reactions: "Reactions",
  bonds: "Bond",
  spells: "Spells",
  resources: "Resources",
  feats: "Feats",
  equipment: "Equipment",
  notes: "Notes",
};

const EDITOR_TABS: EditorTab[] = ["profile", "actions", "bonus", "reactions", "bonds", "spells", "resources", "feats", "equipment", "notes"];

// Distinct color accent per creator step (P-UX1). Derived from the shared
// `tabVisuals` source of truth so the creator's tabs match the character sheet's
// tabs a player sees afterward. profile/reactions are creator-only steps with no
// 1:1 sheet tab, so they carry their own accents.
const EDITOR_TAB_ACCENT: Record<EditorTab, string> = {
  profile: "#7b68ee",
  actions: tabAccent("main"),
  bonus: tabAccent("bonus"),
  reactions: "#9be9a8",
  bonds: tabAccent("bond"),
  spells: tabAccent("spells"),
  resources: tabAccent("features"),
  feats: tabAccent("feats"),
  equipment: tabAccent("equipment"),
  notes: tabAccent("notes"),
};

// Which steps are required vs optional in the guided flow.
const REQUIRED_STEPS = new Set<EditorTab>(["profile"]);
const RECOMMENDED_STEPS = new Set<EditorTab>(["actions"]);

const STEP_HINT: Record<EditorTab, string> = {
  profile: "Required — name, level, and core stats. Everything else builds on this.",
  actions: "Recommended — add at least one attack or ability (the character's main turn action).",
  bonus: "Optional — bonus actions this character can take.",
  reactions: "Optional — reactions triggered on other turns.",
  bonds: "Optional — bonds & primed additives (Rage, Focus, Pressure, Dark Bargain…).",
  spells: "Optional — spells and slot levels.",
  resources: "Optional — resource pools and class features.",
  feats: "Optional — feats. Add statEffects in data to feed derived stats (Tough → +HP, ASI → +stat).",
  equipment: "Optional — equipment bag and attached gear.",
  notes: "Optional — freeform notes. Finish to save the character.",
};

const ABILITY_IDS: AbilityId[] = ["str", "dex", "con", "int", "wis", "cha"];
const ABILITY_LABELS: Record<AbilityId, string> = { str: "STR", dex: "DEX", con: "CON", int: "INT", wis: "WIS", cha: "CHA" };

// ─── Profile form ─────────────────────────────────────────────────────────────

type ProfileDraft = {
  /** player / companion / npc — drives combat-tracker grouping. */
  kind: ActorKind;
  /** When kind === "companion": the owner PC's actor id (combat tracker groups under it). */
  ownerId: string;
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
    kind: actor.kind,
    ownerId: actor.moduleData?.ownerId ?? "",
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
    kind: draft.kind,
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

const ACTOR_TYPE_OPTIONS: { value: ActorKind; label: string }[] = [
  { value: "player", label: "Player Character" },
  { value: "companion", label: "Companion (owned by a PC)" },
  { value: "npc", label: "NPC / Ally" },
];

function ProfileTab({ draft, onChange, ownerOptions }: { draft: ProfileDraft; onChange: (d: ProfileDraft) => void; ownerOptions: OwnerOption[] }) {
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
      {/* Character type + companion ownership */}
      <div style={{ display: "grid", gridTemplateColumns: draft.kind === "companion" ? "1fr 1fr" : "1fr", gap: 8, padding: "8px 10px", background: "#13131f", border: "1px solid #2a2a3e", borderRadius: 6 }}>
        <label style={labelStyle}>
          Character Type
          <select value={draft.kind} onChange={e => set("kind", e.target.value as ActorKind)} style={{ ...inputStyle, marginTop: 2 }}>
            {ACTOR_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        {draft.kind === "companion" && (
          <label style={labelStyle}>
            Owner (acts on their turn)
            <select value={draft.ownerId} onChange={e => set("ownerId", e.target.value)} style={{ ...inputStyle, marginTop: 2 }}>
              <option value="">— Choose owner —</option>
              {ownerOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
        )}
        {draft.kind === "companion" && !draft.ownerId && (
          <span style={{ gridColumn: "span 2", fontSize: 11, color: "#e9a66a" }}>Pick an owner so this companion is grouped under that PC in the combat tracker.</span>
        )}
      </div>

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

export function ActorEditor({ actor: actorProp, mode, onSave, onCancel, proposeMode = false, ownerOptions = [] }: ActorEditorProps) {
  const actor = actorProp ?? createBlankActor();
  const [activeTab, setActiveTab] = useState<EditorTab>("profile");
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>(() => actorToProfileDraft(actor));
  const [tabsDraft, setTabsDraft] = useState<TabActionMap>(() => ({ ...actor.tabs }));
  const [showDanger, setShowDanger] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  // Pending drafts (P-ROLL3b) — only surfaced when creating a brand-new character
  const isCreateMode = mode === "create-new" && !proposeMode;
  const [actorDrafts, setActorDrafts] = useState<PendingDraft<Actor>[]>(
    () => loadPendingDrafts<Actor>("actor"),
  );
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);

  function buildEditedActor(newId?: string): Actor {
    const profilePatch = profileDraftToActorPatch(profileDraft);
    const edited: Actor = {
      ...actor,
      ...profilePatch,
      id: newId ?? actor.id,
      tabs: tabsDraft,
      stats: profilePatch.stats ?? actor.stats,
    };
    // Companion ownership → moduleData.ownerId. The combat tracker groups any
    // kind:"companion" actor under the PC whose id matches moduleData.ownerId.
    if (profileDraft.kind === "companion") {
      edited.moduleData = {
        act: 1,
        theme: "the-broken-chain",
        statBlockStatus: "confirmed",
        ...(actor.moduleData ?? {}),
        ownerId: profileDraft.ownerId.trim() || undefined,
      };
    } else if (actor.moduleData?.ownerId) {
      // Switched away from companion — drop ownerId, keep any other module data.
      edited.moduleData = { ...actor.moduleData, ownerId: undefined };
    }
    return edited;
  }

  // Save wrapper: once a character is truly saved, clear its pending draft.
  function finalizeSave(edited: Actor, saveMode: ActorEditorSaveMode) {
    if (activeDraftId) removePendingDraft("actor", activeDraftId);
    onSave(edited, saveMode);
  }

  function handleSaveDraft() {
    const id = activeDraftId ?? newPendingDraftId("actor");
    setActorDrafts(savePendingDraft<Actor>("actor", {
      id,
      name: profileDraft.name.trim() || "Unnamed Character",
      savedAt: new Date().toISOString(),
      payload: buildEditedActor(),
    }));
    setActiveDraftId(id);
  }

  function handleResumeDraft(d: PendingDraft<Actor>) {
    setProfileDraft(actorToProfileDraft(d.payload));
    setTabsDraft({ ...d.payload.tabs });
    setActiveDraftId(d.id);
    setActiveTab("profile");
  }

  function handleDiscardActorDraft(id: string) {
    setActorDrafts(removePendingDraft<Actor>("actor", id));
    if (activeDraftId === id) setActiveDraftId(null);
  }

  function handleTabActions(tabId: TabId) {
    return (actions: typeof tabsDraft[typeof tabId]) => {
      setTabsDraft(d => ({ ...d, [tabId]: actions }));
    };
  }

  // Per-step item count, used for tab count badges + guided gating.
  function stepCount(tab: EditorTab): number {
    switch (tab) {
      case "actions": return (tabsDraft.main ?? []).filter(a => !a.economyCost?.includes("reaction")).length;
      case "reactions": return (tabsDraft.main ?? []).filter(a => a.economyCost?.includes("reaction")).length;
      case "bonus": return (tabsDraft.bonus ?? []).length;
      case "bonds": return (tabsDraft.bond ?? []).length;
      case "spells": return (tabsDraft.spells ?? []).length;
      case "resources": return (tabsDraft.resources ?? []).length;
      case "feats": return (tabsDraft.feats ?? []).length;
      case "equipment": return (tabsDraft.equipment ?? []).length;
      case "notes": return (tabsDraft.notes ?? []).length;
      default: return 0;
    }
  }

  // ── Guided flow (P-UX1) ───────────────────────────────────────────────────
  // New characters are walked Profile → … → Notes with Next/Back/Finish.
  // Advanced users can still click any tab to jump.
  const stepIndex = EDITOR_TABS.indexOf(activeTab);
  const isFirstStep = stepIndex <= 0;
  const isLastStep = stepIndex === EDITOR_TABS.length - 1;
  const profileValid = profileDraft.name.trim().length > 0;
  // Profile must be valid before leaving the first step on the guided path.
  const canAdvance = activeTab !== "profile" || profileValid;
  function goToStep(delta: number) {
    const next = EDITOR_TABS[Math.min(EDITOR_TABS.length - 1, Math.max(0, stepIndex + delta))];
    if (next) setActiveTab(next);
  }

  const modeLabel = proposeMode
    ? "Propose Level-Up Changes"
    : mode === "edit-current" ? "Edit Party Character"
    : mode === "duplicate" ? "Duplicate Party Character"
    : "Create Party Character";

  return (
    <div className="actor-editor" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "10px 14px", borderBottom: "1px solid #2a2a3e", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, color: "#888" }}>{modeLabel}</p>
          <h3 style={{ margin: 0 }}>{profileDraft.name || "Unnamed Character"}</h3>
        </div>
        <button type="button" onClick={onCancel} style={{ fontSize: 12, padding: "3px 10px", background: "transparent", border: "1px solid #444", borderRadius: 4, color: "#888", cursor: "pointer" }}>Cancel</button>
      </div>

      {/* Pending / Drafts — parked in-progress characters (create-new only) */}
      {isCreateMode && actorDrafts.length > 0 && (
        <div style={{ margin: "8px 14px 0", padding: "8px 10px", background: "#13131f", border: "1px solid #2a2a3e", borderRadius: 6, display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 10, color: "#9d8cff", textTransform: "uppercase", letterSpacing: 1 }}>Pending / Drafts · {actorDrafts.length}</span>
          {actorDrafts.map(d => (
            <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <strong style={{ flex: 1, minWidth: 100, fontSize: 12 }}>{d.name}{activeDraftId === d.id ? " · editing" : ""}</strong>
              <span style={{ fontSize: 10, color: "#666" }}>{new Date(d.savedAt).toLocaleString()}</span>
              <button type="button" onClick={() => handleResumeDraft(d)} style={{ fontSize: 11, padding: "2px 8px", background: "#7b68ee22", border: "1px solid #7b68ee44", borderRadius: 3, color: "#9d8cff", cursor: "pointer" }}>Resume</button>
              <button type="button" onClick={() => handleDiscardActorDraft(d.id)} style={{ fontSize: 11, padding: "2px 8px", background: "transparent", border: "1px solid #5a1a1a", borderRadius: 3, color: "#ff9999", cursor: "pointer" }}>Discard</button>
            </div>
          ))}
        </div>
      )}

      {/* Tab bar — distinct color accent + count badge per step */}
      <div style={{ display: "flex", overflowX: "auto", borderBottom: "1px solid #2a2a3e", background: "#0d0d14" }}>
        {EDITOR_TABS.map(tab => {
          const isActive = activeTab === tab;
          const accent = EDITOR_TAB_ACCENT[tab];
          const count = stepCount(tab);
          const isRequired = REQUIRED_STEPS.has(tab);
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              aria-current={isActive ? "true" : undefined}
              style={{
                padding: "7px 12px",
                fontSize: 12,
                background: "transparent",
                border: "none",
                borderBottom: isActive ? `2px solid ${accent}` : "2px solid transparent",
                color: isActive ? accent : "#666",
                cursor: "pointer",
                whiteSpace: "nowrap",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: accent, opacity: isActive ? 1 : 0.4, flexShrink: 0 }} />
              {EDITOR_TAB_LABELS[tab]}
              {isRequired && <span title="Required" style={{ color: "#ff9999", fontSize: 11 }}>*</span>}
              {count > 0 && (
                <span style={{ fontSize: 10, fontWeight: 600, lineHeight: 1, padding: "1px 5px", borderRadius: 8, background: isActive ? accent : "#2a2a3e", color: isActive ? "#0d0d14" : "#9a9ab0" }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Guided step hint banner */}
      {!proposeMode && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", background: "#0a0a12", borderBottom: "1px solid #1a1a2e", fontSize: 11, color: "#8a8aa0" }}>
          <span style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: 1, flexShrink: 0 }}>
            Step {stepIndex + 1}/{EDITOR_TABS.length}
          </span>
          <span style={{ color: RECOMMENDED_STEPS.has(activeTab) ? "#ffce6a" : REQUIRED_STEPS.has(activeTab) ? "#ff9999" : "#777" }}>
            {STEP_HINT[activeTab]}
          </span>
        </div>
      )}

      {/* Tab content */}
      <div style={{ flex: 1, overflow: "auto", padding: 14 }}>
        {activeTab === "profile" && (
          <ProfileTab draft={profileDraft} onChange={setProfileDraft} ownerOptions={ownerOptions.filter(o => o.id !== actor.id)} />
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
        {activeTab === "feats" && (
          <ActorEditorActionTab tabId="feats" actions={tabsDraft.feats ?? []} onChange={handleTabActions("feats")} />
        )}
        {activeTab === "equipment" && (
          <EquipmentBagEditor
            equippedActions={tabsDraft.equipment ?? []}
            mainActions={tabsDraft.main ?? []}
            onChange={(updates) => {
              setTabsDraft(d => ({ ...d, ...updates }));
            }}
          />
        )}
        {activeTab === "notes" && (
          <ActorEditorActionTab tabId="notes" actions={tabsDraft.notes ?? []} onChange={handleTabActions("notes")} />
        )}
      </div>

      {/* Save buttons */}
      <div style={{ padding: "10px 14px", borderTop: "1px solid #2a2a3e", display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Guided Back / Next / Finish (DM + create/edit only — not in propose mode) */}
        {!proposeMode && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              type="button"
              onClick={() => goToStep(-1)}
              disabled={isFirstStep}
              style={{ padding: "7px 14px", background: "transparent", color: isFirstStep ? "#444" : "#aaa", border: "1px solid #444", borderRadius: 4, cursor: isFirstStep ? "default" : "pointer", fontSize: 12 }}
            >
              ← Back
            </button>
            <span style={{ flex: 1 }} />
            {!isLastStep ? (
              <button
                type="button"
                onClick={() => goToStep(1)}
                disabled={!canAdvance}
                title={!canAdvance ? "Enter a name on the Profile step first" : "Continue to the next step"}
                style={{ padding: "7px 22px", background: canAdvance ? "#7b68ee" : "#2a2a3e", color: canAdvance ? "#fff" : "#666", border: "none", borderRadius: 4, cursor: canAdvance ? "pointer" : "default", fontSize: 13, fontWeight: 600 }}
              >
                Next →
              </button>
            ) : (
              <button
                type="button"
                onClick={() => finalizeSave(buildEditedActor(), "current-and-library")}
                style={{ padding: "7px 22px", background: "#34c759", color: "#06210f", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 13, fontWeight: 700 }}
              >
                ✓ Finish &amp; Save
              </button>
            )}
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          {proposeMode ? (
            /* Player propose mode — single submit button, no direct save */
            <button
              type="button"
              onClick={() => finalizeSave(buildEditedActor(), "current")}
              style={{ flex: 1, padding: "7px 12px", background: "#7b68ee", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 13, fontWeight: 500 }}
            >
              Submit for DM Approval
            </button>
          ) : (
            /* DM mode — save now (escape hatch), override-only, and duplicate */
            <>
              <button
                type="button"
                onClick={() => finalizeSave(buildEditedActor(), "current-and-library")}
                style={{ flex: 1, padding: "6px 12px", background: "transparent", color: "#9a9ab0", border: "1px solid #3a3a52", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
                title="Save to the library now without stepping through the rest of the flow"
              >
                Save now
              </button>
              <button
                type="button"
                onClick={() => finalizeSave(buildEditedActor(), "current")}
                style={{ padding: "6px 12px", background: "transparent", color: "#888", border: "1px solid #444", borderRadius: 4, cursor: "pointer", fontSize: 11 }}
                title="Save as session override only — not written to base library (changes lost on next Sync)"
              >
                Override Only
              </button>
              <button
                type="button"
                onClick={() => finalizeSave(buildEditedActor(`${actor.id}-copy-${Date.now().toString(36)}`), "duplicate")}
                style={{ padding: "7px 12px", background: "transparent", color: "#aaa", border: "1px solid #444", borderRadius: 4, cursor: "pointer", fontSize: 11 }}
              >
                Duplicate
              </button>
              {isCreateMode && (
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  title="Park this in-progress character as a pending draft (survives reloads)"
                  style={{ padding: "7px 12px", background: "transparent", color: "#9d8cff", border: "1px solid #7b68ee44", borderRadius: 4, cursor: "pointer", fontSize: 11 }}
                >
                  {activeDraftId ? "Update Draft" : "Save as Draft"}
                </button>
              )}
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
