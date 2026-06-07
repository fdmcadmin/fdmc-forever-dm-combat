import { useState } from "react";
import { FormulaInput } from "./FormulaInput";
import { tabAccent } from "./tabVisuals";
import type { ActorAction, TabId } from "../types/tabs";

// Human heading per tab so the editor reads as a labeled section, not a raw list.
const ACTION_TAB_HEADING: Partial<Record<TabId, string>> = {
  main: "Actions",
  bonus: "Bonus Actions",
  bond: "Bonds & Additives",
  notes: "Notes",
};
import type { ActionCost } from "../types/actionEconomy";
import { actionFromEditorDraft, archiveActionFromTab, replaceActionInTab } from "./pcActionAdapters";
import type { PcActionDraft, PcRollMode, PcActionCost } from "./pcActionTypes";
import { slugifyForActionId } from "./pcActionTypes";

// ─── Outcome mode UI label ────────────────────────────────────────────────────

const OUTCOME_MODE_LABELS: Record<PcRollMode, string> = {
  attack: "Attack Roll",
  save: "Saving Throw",
  check: "Ability Check",
  damageOnly: "Straight Roll / Damage",
  healing: "Healing Roll",
  triggered: "Triggered Feature",
  utility: "Utility",
  passive: "Passive",
  reference: "Reference Only",
};

const ACTION_COST_LABELS: Record<PcActionCost, string> = {
  action: "Action",
  bonus: "Bonus Action",
  reaction: "Reaction",
  bond: "Bond",
  free: "Free",
  passive: "Passive",
};

// ─── Draft ────────────────────────────────────────────────────────────────────

function actionToEditorDraft(action: ActorAction, tabId: TabId): PcActionDraft {
  const economyCost = action.economyCost?.[0];
  const actionCost: PcActionCost =
    economyCost === "bonus" ? "bonus" :
    economyCost === "reaction" ? "reaction" :
    economyCost === "bond" ? "bond" :
    economyCost === "main" ? "action" : "free";

  const hasAttack = Boolean(action.metadata?.attack?.trim());
  const hasSave = Boolean(action.metadata?.saveDc?.trim());
  const hasDamage = Boolean(action.metadata?.damage?.trim());

  const rollMode: PcRollMode =
    action.actionKind === "check" ? "check" :
    hasAttack ? "attack" :
    hasSave ? "save" :
    hasDamage ? "damageOnly" :
    action.actionKind === "bond" ? "triggered" :
    action.logMode === "silent" ? "reference" :
    "utility";

  return {
    id: action.id,
    name: action.label,
    tab: tabId === "spells" ? "spell" : tabId === "bond" ? "bond" : tabId === "bonus" ? "bonus" : tabId === "features" ? "feature" : tabId === "resources" ? "resource" : tabId === "outOfCombat" ? "outOfCombat" : "action",
    actionCost,
    rollMode,
    attackBonus: action.metadata?.attack,
    saveDc: action.metadata?.saveDc,
    damage: action.metadata?.damage,
    critDamage: action.metadata?.crit,
    range: action.metadata?.range,
    slotCost: action.metadata?.slotCost,
    description: action.description ?? action.metadata?.details,
    source: action.category,
    visibility: action.logMode === "silent" ? "hidden" : "player",
    initiativeBonus: action.metadata?.initiativeBonus,
  };
}

// ─── Action form ──────────────────────────────────────────────────────────────

type ActionFormProps = {
  tabId: TabId;
  initial?: ActorAction;
  onSave: (action: ActorAction) => void;
  onCancel: () => void;
};

function ActionForm({ tabId, initial, onSave, onCancel }: ActionFormProps) {
  const [draft, setDraft] = useState<PcActionDraft>(() =>
    initial ? actionToEditorDraft(initial, tabId) : {
      name: "",
      tab: tabId === "spells" ? "spell" : tabId === "bond" ? "bond" : tabId === "bonus" ? "bonus" : "action",
      actionCost: tabId === "bonus" ? "bonus" : tabId === "bond" ? "bond" : "action",
      rollMode: "attack",
    }
  );
  const [errors, setErrors] = useState<string[]>([]);

  function set<K extends keyof PcActionDraft>(key: K, value: PcActionDraft[K]) {
    setDraft(d => ({ ...d, [key]: value }));
    setErrors([]);
  }

  function handleSave() {
    const errs: string[] = [];
    if (!draft.name?.trim()) errs.push("Name is required.");
    if (draft.rollMode !== "reference" && draft.rollMode !== "utility" && draft.rollMode !== "passive" && draft.rollMode !== "triggered") {
      const hasFormula = draft.attackBonus || draft.saveDc || draft.damage || draft.healing;
      if (!hasFormula) errs.push("This outcome mode requires at least one formula. Add a formula or switch to Reference Only.");
    }
    if (errs.length > 0) { setErrors(errs); return; }

    const action = actionFromEditorDraft(draft, initial);
    onSave(action);
  }

  const showAttackFields = draft.rollMode === "attack";
  const showSaveFields = draft.rollMode === "save";
  const showCheckFields = draft.rollMode === "check";
  const showDamageField = ["attack", "save", "damageOnly", "triggered", "healing"].includes(draft.rollMode);

  return (
    <div className="action-form" style={{ display: "flex", flexDirection: "column", gap: 10, padding: 12, background: "#1a1a2e", borderRadius: 8 }}>
      <h4 style={{ margin: 0 }}>{initial ? "Edit Action" : "New Action"}</h4>

      <label style={{ fontSize: 12 }}>
        Name *
        <input type="text" value={draft.name} onChange={e => set("name", e.target.value)}
          style={{ display: "block", width: "100%", marginTop: 2, padding: "4px 8px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff" }} />
      </label>

      <label style={{ fontSize: 12 }}>
        Category (group heading in card)
        <input type="text" value={draft.source ?? ""} onChange={e => set("source", e.target.value)}
          placeholder="e.g. Attacks, Cantrips, Bond"
          style={{ display: "block", width: "100%", marginTop: 2, padding: "4px 8px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff" }} />
      </label>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <label style={{ fontSize: 12 }}>
          Action Economy
          <select value={draft.actionCost} onChange={e => set("actionCost", e.target.value as PcActionCost)}
            style={{ display: "block", width: "100%", marginTop: 2, padding: "4px 8px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff" }}>
            {(Object.entries(ACTION_COST_LABELS) as [PcActionCost, string][]).map(([v, l]) =>
              <option key={v} value={v}>{l}</option>
            )}
          </select>
        </label>

        <label style={{ fontSize: 12 }}>
          Outcome Mode
          <select value={draft.rollMode} onChange={e => set("rollMode", e.target.value as PcRollMode)}
            style={{ display: "block", width: "100%", marginTop: 2, padding: "4px 8px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff" }}>
            {(Object.entries(OUTCOME_MODE_LABELS) as [PcRollMode, string][]).map(([v, l]) =>
              <option key={v} value={v}>{l}</option>
            )}
          </select>
        </label>
      </div>

      {showAttackFields && (
        <FormulaInput
          label="Attack Formula"
          value={String(draft.attackBonus ?? "")}
          onChange={v => set("attackBonus", v || undefined)}
          placeholder="1d20+@STR+@PROF"
          showVars={["@STR","@DEX","@ATK","@PROF","@SPELL","@CHA"]}
        />
      )}

      {showSaveFields && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <FormulaInput
            label="Save DC"
            value={String(draft.saveDc ?? "")}
            onChange={v => set("saveDc", v || undefined)}
            placeholder="CON DC 13"
            showVars={[]}
          />
          <label style={{ fontSize: 12 }}>
            Save Ability
            <input type="text" value={draft.saveAbility ?? ""} onChange={e => set("saveAbility", e.target.value)}
              placeholder="CON, DEX, WIS..."
              style={{ display: "block", width: "100%", marginTop: 2, padding: "4px 8px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff" }} />
          </label>
        </div>
      )}

      {showCheckFields && (
        <FormulaInput
          label="Check Formula"
          value={String(draft.attackBonus ?? "")}
          onChange={v => set("attackBonus", v || undefined)}
          placeholder="1d20+@WIS+@PROF"
          showVars={["@STR","@DEX","@CON","@INT","@WIS","@CHA","@PROF"]}
        />
      )}

      {showDamageField && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FormulaInput
            label="Damage Formula"
            value={draft.damage ?? ""}
            onChange={v => set("damage", v || undefined)}
            placeholder="2d6+@STR"
            showVars={["@STR","@DEX","@CON","@WIS","@CHA"]}
          />
          {draft.rollMode === "attack" && (
            <FormulaInput
              label="Crit Damage"
              value={draft.critDamage ?? ""}
              onChange={v => set("critDamage", v || undefined)}
              placeholder="4d6+@STR"
              showVars={["@STR","@DEX"]}
            />
          )}
        </div>
      )}

      <label style={{ fontSize: 12 }}>
        Range
        <input type="text" value={draft.range ?? ""} onChange={e => set("range", e.target.value)}
          placeholder="5 ft, 120 ft..."
          style={{ display: "block", width: "100%", marginTop: 2, padding: "4px 8px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff" }} />
      </label>

      <label style={{ fontSize: 12 }}>
        Description / Details
        <textarea value={draft.description ?? ""} onChange={e => set("description", e.target.value)}
          rows={3}
          style={{ display: "block", width: "100%", marginTop: 2, padding: "4px 8px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff", resize: "vertical" }} />
      </label>

      {/* Initiative bonus — only relevant for features/passives (Alert, Jack of All Trades, etc.) */}
      {(tabId === "features" || draft.actionCost === "passive") && (
        <label style={{ fontSize: 12 }}>
          Initiative Bonus
          <input
            type="number"
            value={draft.initiativeBonus ?? ""}
            onChange={e => set("initiativeBonus", e.target.value === "" ? undefined : Number(e.target.value))}
            placeholder="0 (e.g. +5 for Alert feat)"
            style={{ display: "block", width: "100%", marginTop: 2, padding: "4px 8px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff" }}
          />
          <span style={{ fontSize: 10, color: "#555", marginTop: 2, display: "block" }}>Adds to this actor's initiative roll formula. Use only for feats/features that explicitly grant an initiative bonus.</span>
        </label>
      )}

      {errors.length > 0 && (
        <div style={{ background: "#5a1a1a", borderRadius: 4, padding: "6px 10px" }}>
          {errors.map(e => <p key={e} style={{ margin: 0, fontSize: 12, color: "#ff9999" }}>{e}</p>)}
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={handleSave} style={{ padding: "5px 16px", background: "#7b68ee", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>
          {initial ? "Save Changes" : "Add Action"}
        </button>
        <button type="button" onClick={onCancel} style={{ padding: "5px 16px", background: "transparent", color: "#888", border: "1px solid #444", borderRadius: 4, cursor: "pointer" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Action list editor ───────────────────────────────────────────────────────

type ActorEditorActionTabProps = {
  tabId: TabId;
  actions: ActorAction[];
  onChange: (actions: ActorAction[]) => void;
};

export function ActorEditorActionTab({ tabId, actions, onChange }: ActorEditorActionTabProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);

  const editingAction = editingId ? actions.find(a => a.id === editingId) : undefined;

  function handleSaveEdit(updated: ActorAction) {
    onChange(replaceActionInTab(actions, updated));
    setEditingId(null);
  }

  function handleAddNew(action: ActorAction) {
    onChange([...actions, action]);
    setAddingNew(false);
  }

  function handleArchive(actionId: string) {
    onChange(archiveActionFromTab(actions, actionId));
    if (editingId === actionId) setEditingId(null);
  }

  function handleDuplicate(action: ActorAction) {
    const cloned: ActorAction = {
      ...action,
      id: `${action.id}-copy-${Date.now().toString(36)}`,
      label: `${action.label} (Copy)`,
    };
    onChange([...actions, cloned]);
  }

  const accent = tabAccent(tabId);
  const heading = ACTION_TAB_HEADING[tabId] ?? "Entries";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div className="fdmc-section-head" style={{ color: accent, marginTop: 0 }}>
        {heading}
        {actions.length > 0 && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 8, background: accent, color: "#0d0d14", letterSpacing: 0 }}>{actions.length}</span>
        )}
      </div>

      {actions.length === 0 && !addingNew && (
        <p style={{ fontSize: 12, color: "#666", fontStyle: "italic" }}>Nothing here yet — use “+ Add” below to create the first entry.</p>
      )}

      {actions.map(action => (
        <div key={action.id}>
          {editingId === action.id ? (
            <ActionForm
              tabId={tabId}
              initial={action}
              onSave={handleSaveEdit}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", background: "#161622", borderRadius: 6, border: "1px solid #2a2a3e" }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{action.label}</span>
                {action.category && <span style={{ fontSize: 11, color: "#666", marginLeft: 6 }}>({action.category})</span>}
                {action.metadata?.attack && <span style={{ fontSize: 11, color: "#7b68ee", marginLeft: 6 }}>⚔ {action.metadata.attack}</span>}
                {action.metadata?.damage && <span style={{ fontSize: 11, color: "#e07b39", marginLeft: 6 }}>💥 {action.metadata.damage}</span>}
              </div>
              <button type="button" onClick={() => setEditingId(action.id)} style={{ fontSize: 11, padding: "2px 8px", background: "transparent", border: "1px solid #444", borderRadius: 3, color: "#aaa", cursor: "pointer" }}>Edit</button>
              <button type="button" onClick={() => handleDuplicate(action)} style={{ fontSize: 11, padding: "2px 8px", background: "transparent", border: "1px solid #444", borderRadius: 3, color: "#aaa", cursor: "pointer" }}>Dupe</button>
              <button type="button" onClick={() => handleArchive(action.id)} style={{ fontSize: 11, padding: "2px 8px", background: "transparent", border: "1px solid #5a1a1a", borderRadius: 3, color: "#ff9999", cursor: "pointer" }}>Remove</button>
            </div>
          )}
        </div>
      ))}

      {addingNew && (
        <ActionForm
          tabId={tabId}
          onSave={handleAddNew}
          onCancel={() => setAddingNew(false)}
        />
      )}

      {!addingNew && !editingId && (
        <button
          type="button"
          onClick={() => setAddingNew(true)}
          style={{ padding: "5px 12px", background: "transparent", border: "1px dashed #444", borderRadius: 4, color: "#888", cursor: "pointer", fontSize: 12, marginTop: 4 }}
        >
          + Add Action
        </button>
      )}
    </div>
  );
}
