import { useState } from "react";
import { FormulaInput } from "./FormulaInput";
import { DAMAGE_TYPES, isCustomDamageType } from "../constants/damageTypes";
import { readDamageTypeChoice } from "../rules/damageTypeChoice";
import { tabAccent } from "./tabVisuals";
import { resolveOutcomeMode } from "../types/tabs";
import type { ActorAction, TabId } from "../types/tabs";

// Human heading per tab so the editor reads as a labeled section, not a raw list.
const ACTION_TAB_HEADING: Partial<Record<TabId, string>> = {
  main: "Actions",
  bonus: "Bonus Actions",
  bond: "Bonds & Additives",
  features: "Class Actions & Features",
  feats: "Feats",
  notes: "Notes",
};
import type { ActionCost } from "../types/actionEconomy";
import { actionFromEditorDraft, archiveActionFromTab, replaceActionInTab } from "./pcActionAdapters";
import type { PcActionDraft, PcRollMode, PcActionCost, PcCastingClass } from "./pcActionTypes";
import { slugifyForActionId } from "./pcActionTypes";

// ─── Outcome mode UI label ────────────────────────────────────────────────────

const OUTCOME_MODE_LABELS: Record<PcRollMode, string> = {
  attack: "Attack Roll",
  save: "Saving Throw",
  check: "Ability Check",
  damageOnly: "Straight Roll / Damage",
  healing: "Healing Roll",
  triggered: "Triggered Feature",
  additive: "Additive (rides next roll)",
  utility: "Utility",
  passive: "Passive",
  reference: "Reference Only",
};

/**
 * WHAT THE DROPDOWN OFFERS — every mode except the retired one.
 *
 * `reference` still has a LABEL above, because an action authored before the split can be
 * opened and must show something sensible rather than an empty box. But it must not be
 * offered as a NEW choice: picking it stores `passive`, and a passive action that spends a
 * resource can never spend it. Two of one class feature's three options were dead for
 * exactly that reason.
 *
 * Nothing has to be re-authored — `resolveOutcomeMode` resolves legacy `reference` at read
 * time. This only stops the tag being created again.
 */
const AUTHORABLE_OUTCOME_MODES = (Object.keys(OUTCOME_MODE_LABELS) as PcRollMode[])
  .filter(m => m !== "reference");

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
    economyCost === "main" ? "action" :
    economyCost === "free" ? "free" :
    economyCost === "passive" ? "passive" :
    // LEGACY ONLY: actions saved before 0.7.10.18 stored [] for both free and passive, so the
    // array says nothing and metadata.cost is the only surviving record. Anything saved since
    // is answered by the two lines above.
    action.metadata?.cost === "passive" ? "passive" : "free";

  const hasAttack = Boolean(action.metadata?.attack?.trim());
  const hasSave = Boolean(action.metadata?.saveDc?.trim());
  const hasDamage = Boolean(action.metadata?.damage?.trim());

  // Honor the explicitly-saved outcome mode first so the editor's choice round-trips
  // (e.g. "Triggered Feature" on a damage action no longer reverts to "Straight Damage").
  // RESOLVED, not raw — and resolved the same way the runtime does, which is the whole point.
  // Reading the raw value let a legacy `reference` tag fall past this chain into the inference
  // below and land on the "utility" fallback, so the editor SHOWED Utility while the engine
  // treated it as passive and refused the click. The DM saw three identical rows and two of
  // them silently did nothing. Editor and engine must resolve a mode through one function.
  const explicitOutcome = resolveOutcomeMode(action);
  const rollMode: PcRollMode =
    explicitOutcome === "attack-roll" ? "attack" :
    explicitOutcome === "dc-check" ? "save" :
    explicitOutcome === "ability-check" ? "check" :
    explicitOutcome === "damage-only" ? "damageOnly" :
    explicitOutcome === "healing" ? "healing" :
    explicitOutcome === "triggered" ? "triggered" :
    explicitOutcome === "additive" ? "additive" :
    explicitOutcome === "passive" ? "passive" :
    // `utility` MUST be honoured explicitly, not left to the fallback at the bottom. Without
    // this line an action saved as utility falls through to the inference chain, and any
    // leftover `damage` from a previous mode makes it read back as "Straight Damage" —
    // Rage - Enter, authored utility with a stale `damage: "+2"`, did exactly that. The mode
    // survived every export and every resolve; only the editor could not see it.
    explicitOutcome === "utility" ? "utility" :
    action.actionKind === "check" ? "check" :
    hasAttack ? "attack" :
    hasSave ? "save" :
    hasDamage ? "damageOnly" :
    action.actionKind === "bond" ? "triggered" :
    action.logMode === "silent" ? "passive" :
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
    damageType: action.metadata?.damageType,
    castingClass: action.metadata?.castingClass,
    critDamage: action.metadata?.crit,
    range: action.metadata?.range,
    slotCost: action.metadata?.slotCost,
    description: action.description ?? action.metadata?.details,
    source: action.category,
    visibility: action.logMode === "silent" ? "hidden" : "player",
    initiativeBonus: action.metadata?.initiativeBonus,
    acBonus: (action.metadata?.statEffects ?? [])
      .filter(e => e.type === "addAC")
      .reduce((sum, e) => sum + (e.value ?? 0), 0) || undefined,
    combatStyleAttack: action.metadata?.combatStyleAttack,
    combatStyleDamage: action.metadata?.combatStyleDamage,
    combatStyleTarget: action.metadata?.combatStyleTarget,
    weaponBuffDamage: action.metadata?.weaponBuffDamage,
    weaponBuffAttack: action.metadata?.weaponBuffAttack,
    turnRider: action.metadata?.turnRider,
    isRerollSource: action.metadata?.additive === "reroll" || (action.tags ?? []).includes("reroll") || undefined,
    rerollMethod: action.metadata?.rerollMethod as "reroll" | "flip" | undefined,
  };
}

// ─── Action form ──────────────────────────────────────────────────────────────

type ActionFormProps = {
  tabId: TabId;
  initial?: ActorAction;
  onSave: (action: ActorAction) => void;
  onCancel: () => void;
  /** The actor's resource labels — populates the "Spends resource" picker. */
  resourceLabels?: string[];
  /**
   * The character's class rows, in slot order. Populates the "Cast using" picker, which is
   * what makes `@SPELL` resolve per action instead of per sheet.
   */
  classRows?: { name: string; level: number }[];
};

function ActionForm({ tabId, initial, onSave, onCancel, resourceLabels = [], classRows = [] }: ActionFormProps) {
  const [draft, setDraft] = useState<PcActionDraft>(() =>
    initial ? actionToEditorDraft(initial, tabId) : {
      name: "",
      tab: tabId === "spells" ? "spell" : tabId === "bond" ? "bond" : tabId === "bonus" ? "bonus" : tabId === "features" ? "feature" : tabId === "feats" ? "feature" : "action",
      actionCost: tabId === "bonus" ? "bonus" : tabId === "bond" ? "bond" : "action",
      rollMode: "attack",
      // Auto-fill the Category heading so the DM doesn't have to type it:
      //   P-UX4 Phase 1 — Combat Actions (tabId "main") default to "Actions".
      //   P-UX4 Phase 2 — Homebrew/Bond entries (tabId "bond") default to "Bond".
      source: tabId === "main" ? "Actions" : tabId === "bond" ? "Bond" : undefined,
    }
  );
  const [errors, setErrors] = useState<string[]>([]);
  // P-UX4 Phase 3: damage-type picker is a standard-type dropdown + a Custom free-text
  // mode. Start in custom mode when editing an action whose type isn't a standard one.
  const [customDamageType, setCustomDamageType] = useState(() => isCustomDamageType(initial?.metadata?.damageType));

  function set<K extends keyof PcActionDraft>(key: K, value: PcActionDraft[K]) {
    setDraft(d => ({ ...d, [key]: value }));
    setErrors([]);
  }

  /**
   * CHANGING THE OUTCOME MODE STARTS THE FORMULAS OVER.
   *
   * The form only renders the boxes the current mode uses, but the draft kept every value it
   * had ever held, so a formula authored under one mode survived a switch invisibly and came
   * back the moment you switched again. Rage - Enter is the case: authored as an attack with
   * `damage "+2"`, moved to utility, and the +2 rode along — flip it back to Straight Damage
   * and the box was already filled, so it never looked like anything had been kept.
   *
   * Only the ROLL formulas reset. Name, description, cost, range, slot and riders describe the
   * action itself rather than how it resolves, and re-typing those on every mode change would
   * be its own bug. Nothing is written until Save.
   */
  function changeRollMode(next: PcRollMode) {
    setDraft(d => d.rollMode === next ? d : {
      ...d,
      rollMode: next,
      attackBonus: undefined,
      saveDc: undefined,
      damage: undefined,
      damageType: undefined,
      critDamage: undefined,
    });
    setErrors([]);
  }

  function handleSave() {
    const errs: string[] = [];
    if (!draft.name?.trim()) errs.push("Name is required.");
    if (draft.rollMode !== "utility" && draft.rollMode !== "passive" && draft.rollMode !== "triggered") {
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
  const showDamageField = ["attack", "save", "damageOnly", "triggered", "healing", "additive"].includes(draft.rollMode);

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

      {/* P-UX4 Phase 2: Homebrew/Bond entries always use the bond slot, so the Action
          Economy chooser isn't needed on the bond tab — hide it and let Outcome Mode
          take the full row. The economy stays "bond" (set in the draft defaults). */}
      <div style={{ display: "grid", gridTemplateColumns: tabId === "bond" ? "1fr" : "1fr 1fr", gap: 8 }}>
        {tabId !== "bond" && (
        <label style={{ fontSize: 12 }}>
          Action Economy
          <select value={draft.actionCost} onChange={e => {
            // P-UX4 Phase 1: choosing Action auto-fills the Category when it is empty.
            const next = e.target.value as PcActionCost;
            setDraft(d => ({ ...d, actionCost: next, source: next === "action" && !d.source?.trim() ? "Actions" : d.source }));
            setErrors([]);
          }}
            style={{ display: "block", width: "100%", marginTop: 2, padding: "4px 8px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff" }}>
            {(Object.entries(ACTION_COST_LABELS) as [PcActionCost, string][]).map(([v, l]) =>
              <option key={v} value={v}>{l}</option>
            )}
          </select>
        </label>
        )}

        <label style={{ fontSize: 12 }}>
          Outcome Mode
          <select value={draft.rollMode} onChange={e => changeRollMode(e.target.value as PcRollMode)}
            style={{ display: "block", width: "100%", marginTop: 2, padding: "4px 8px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff" }}>
            {AUTHORABLE_OUTCOME_MODES.map(v =>
              <option key={v} value={v}>{OUTCOME_MODE_LABELS[v]}</option>
            )}
            {/* Only present when the action being edited still carries the retired tag. */}
            {draft.rollMode === "reference" && (
              <option value="reference">{OUTCOME_MODE_LABELS.reference} (retired — pick another)</option>
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
          showVars={["@STR","@DEX","@INT","@ATK","@PROF","@SPELL","@CHA"]}
        />
      )}

      {showSaveFields && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <FormulaInput
            label="Save DC"
            value={String(draft.saveDc ?? "")}
            onChange={v => set("saveDc", v || undefined)}
            placeholder="CON DC 13"
            /**
             * A SAVE DC IS DERIVED, NOT TYPED. This field shipped with `showVars={[]}` — dice
             * buttons and nothing else — so the only way to author a DC was to hard-code the
             * number, which then never moved as the character levelled.
             *
             * Which modifier drives it depends on what the effect IS: a martial effect keys off
             * the attack modifier (`@ATK`, the higher of STR/DEX) and a magical one off spell
             * attack (`@SPELL`, casting mod + proficiency). Both already resolve; only the chips
             * were missing. The six abilities are here too, because a DC that keys off a
             * specific stat regardless of martial/magical is common enough to need one click.
             */
            showVars={["@STR","@DEX","@CON","@INT","@WIS","@CHA","@ATK","@SPELL"]}
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
            showVars={["@STR","@DEX","@CON","@INT","@WIS","@CHA","@SPELL"]}
          />
          {/* WHICH CLASS CASTS THIS. Only worth asking when the character HAS more than one
              class — a single-class sheet has nothing to choose and the fallback already picks
              the main class. Naming the slot (not the stat) means `@SPELL` resolves through
              that class's spellcasting ability, so a Wizard/Cleric gets INT on one spell and
              WIS on the next instead of one stat for the whole sheet. */}
          {classRows.length > 1 && (
            <label style={{ fontSize: 12 }}>
              Cast using
              <select
                value={draft.castingClass ?? ""}
                onChange={e => set("castingClass", (e.target.value || undefined) as PcCastingClass | undefined)}
                style={{ display: "block", width: "100%", marginTop: 2, padding: "4px 8px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff" }}
              >
                <option value="">— main class ({classRows[0]?.name}) —</option>
                {classRows.slice(0, 3).map((c, i) => (
                  <option key={c.name + i} value={i === 0 ? "main" : i === 1 ? "second" : "third"}>
                    {c.name} {c.level}
                  </option>
                ))}
              </select>
              <span style={{ fontSize: 10, color: "#667", display: "block", marginTop: 2 }}>
                Sets which spellcasting ability @SPELL uses for THIS action.
              </span>
            </label>
          )}

          {/* WHAT THE SPELL'S OWN TEXT SAYS ABOUT ITS TYPE. Read, never silently applied —
              a wrong guess has to be visible, which is why this is a note beside the picker
              rather than something that rewrites the field. "cold instead of fire" is one type;
              "you CAN use cold instead of fire" is two; "a type you choose" is all of them. */}
          {(() => {
            const reading = readDamageTypeChoice(draft.description, draft.rollMode === "healing" ? "healing" : undefined);
            if (reading.kind === "none") return null;
            return (
              <div style={{ fontSize: 10, color: reading.kind === "choice" ? "#7be08a" : "#667", padding: "2px 0" }}>
                {reading.kind === "choice" ? "⚡ Caster picks: " : "Reads as: "}
                <strong style={{ color: "#dfe4ff" }}>{reading.options.join(" · ")}</strong>
                <span style={{ display: "block", color: "#667" }}>{reading.reason}</span>
                {reading.primary && draft.damageType !== reading.primary && (
                  <button type="button" className="inline-commit-button" style={{ marginTop: 2 }}
                    onClick={() => { set("damageType", reading.primary); setCustomDamageType(false); }}>
                    Use {reading.primary}
                  </button>
                )}
              </div>
            );
          })()}

          {/* P-UX4 Phase 3: damage type — standard D&D defaults + Custom free text so the
              engine stays all-system, not D&D-locked. */}
          <label style={{ fontSize: 12 }}>
            Damage Type
            <select
              value={customDamageType ? "__custom__" : (draft.damageType ?? "")}
              onChange={e => {
                const v = e.target.value;
                if (v === "__custom__") { setCustomDamageType(true); }
                else { setCustomDamageType(false); set("damageType", v || undefined); }
              }}
              style={{ display: "block", width: "100%", marginTop: 2, padding: "4px 8px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff" }}
            >
              <option value="">— none —</option>
              {DAMAGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              <option value="__custom__">Custom…</option>
            </select>
            {customDamageType && (
              <input
                type="text"
                value={draft.damageType ?? ""}
                onChange={e => set("damageType", e.target.value || undefined)}
                placeholder="custom damage type (e.g. shadow, void)"
                style={{ display: "block", width: "100%", marginTop: 4, padding: "4px 8px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff" }}
              />
            )}
          </label>
          {draft.rollMode === "attack" && (
            <FormulaInput
              label="Crit Damage"
              value={draft.critDamage ?? ""}
              onChange={v => set("critDamage", v || undefined)}
              placeholder="4d6+@STR"
              showVars={["@STR","@DEX","@CON","@INT","@WIS","@CHA","@SPELL"]}
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

      {/* Feat/feature passive effects — AC + Initiative. Both fold into the actor's
          derived stats: AC Bonus → addAC (deriveActorStats), Initiative Bonus → the
          initiative roll formula (card + combat tracker). */}
      {(tabId === "feats" || tabId === "features" || draft.actionCost === "passive") && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <label style={{ fontSize: 12 }}>
            AC Bonus
            <input
              type="number"
              value={draft.acBonus ?? ""}
              onChange={e => set("acBonus", e.target.value === "" ? undefined : Number(e.target.value))}
              placeholder="0 (e.g. +1 Dual Wielder)"
              style={{ display: "block", width: "100%", marginTop: 2, padding: "4px 8px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff" }}
            />
            <span style={{ fontSize: 10, color: "#555", marginTop: 2, display: "block" }}>Adds to this actor's AC. Use for feats that grant AC (Dual Wielder +1, Medium Armor Master, etc.).</span>
          </label>
          <label style={{ fontSize: 12 }}>
            Initiative Bonus
            <input
              type="number"
              value={draft.initiativeBonus ?? ""}
              onChange={e => set("initiativeBonus", e.target.value === "" ? undefined : Number(e.target.value))}
              placeholder="0 (e.g. +5 for Alert feat)"
              style={{ display: "block", width: "100%", marginTop: 2, padding: "4px 8px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff" }}
            />
            <span style={{ fontSize: 10, color: "#555", marginTop: 2, display: "block" }}>Adds to this actor's initiative roll formula. Use only for feats/features that grant an initiative bonus.</span>
          </label>
        </div>
      )}

      {/* Spends resource — tag this action to a pool so using it deducts a charge
          (e.g. Vow of Enmity -> Channel Divinity). Spells use the slot level instead. */}
      {draft.tab !== "spell" && resourceLabels.length > 0 && (
        <label style={{ fontSize: 12 }}>
          Spends resource <span style={{ color: "#555", fontSize: 10 }}>(deducts one use when this action is used)</span>
          <select value={draft.slotCost ?? ""} onChange={e => set("slotCost", e.target.value || undefined)}
            style={{ display: "block", width: "100%", marginTop: 2, padding: "4px 8px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff" }}>
            <option value="">— none —</option>
            {draft.slotCost && !resourceLabels.includes(draft.slotCost) && <option value={draft.slotCost}>{draft.slotCost} (current)</option>}
            {resourceLabels.map(label => <option key={label} value={label}>{label}</option>)}
          </select>
        </label>
      )}

      {/* ONCE-PER-TURN RIDER. Arms a chip the player claims; refreshed when their turn starts.
          Two payloads, one mechanism: an extra attack (Hew off a crit, Distant Strike) or a
          damage rider (the Tier 3 weapons). Arming rather than rolling is the point — Hew was
          authored as its own action with greataxe dice baked in, so it was wrong the moment
          the character swung anything else. A claimed chip uses whatever is in hand. */}
      {draft.tab !== "spell" && (
        <div style={{ border: "1px solid #2a2a3e", borderRadius: 6, padding: "6px 8px" }}>
          <label style={{ fontSize: 12, display: "block" }}>
            Once-per-turn rider <span style={{ color: "#555", fontSize: 10 }}>— arms a chip on the card; comes back at the start of their turn</span>
            <select
              value={draft.turnRider?.kind ?? ""}
              onChange={e => set("turnRider", e.target.value
                ? { kind: e.target.value as "extraAttack" | "damage", damage: draft.turnRider?.damage, label: draft.turnRider?.label }
                : undefined)}
              style={{ display: "block", width: "100%", marginTop: 2, padding: "4px 8px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff" }}>
              <option value="">— none —</option>
              <option value="extraAttack">Extra attack — one more attack, with the weapon in hand</option>
              <option value="damage">Damage rider — added to one hit</option>
            </select>
          </label>
          {draft.turnRider?.kind === "damage" && (
            <label style={{ fontSize: 12, display: "block", marginTop: 6 }}>
              Rider damage
              <input type="text" value={draft.turnRider.damage ?? ""}
                onChange={e => set("turnRider", { ...draft.turnRider!, damage: e.target.value || undefined })}
                placeholder="1d6 or +2"
                style={{ display: "block", width: "100%", marginTop: 2, padding: "4px 8px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff" }} />
            </label>
          )}
          {draft.turnRider && (
            <label style={{ fontSize: 12, display: "block", marginTop: 6 }}>
              Chip label <span style={{ color: "#555", fontSize: 10 }}>— optional; defaults to the action's name</span>
              <input type="text" value={draft.turnRider.label ?? ""}
                onChange={e => set("turnRider", { ...draft.turnRider!, label: e.target.value || undefined })}
                placeholder="Hew"
                style={{ display: "block", width: "100%", marginTop: 2, padding: "4px 8px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff" }} />
            </label>
          )}
        </div>
      )}

      {/* Activated weapon buff — using/casting this action (a Bonus Action, feature, etc.)
          arms a PERSISTENT chip that adds this to weapon attacks until it ends. Use for
          Rage, Hunter's Mark, Channel Divinity damage. Pair with "Spends resource" above so
          the pool counts down on use; it auto-clears at End Combat. Numbers/dice only. */}
      {/* ⚠ REROLL SOURCE — a feat like Lucky. The scanner has always looked for a "reroll" tag,
          and nothing in the editor ever set one, so a Lucky feat on a sheet could not reach the
          reroll picker no matter how its text was written.

          The METHOD is chosen rather than read from the description, because "use the other side
          of the die" resolves to a DETERMINED value (21 − the natural) while a reroll is random —
          inferring the wrong one silently changes what the feat does. */}
      <div style={{ border: "1px solid #2a2a3e", borderRadius: 6, padding: "6px 8px" }}>
        <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={Boolean(draft.isRerollSource)}
            onChange={e => set("isRerollSource", e.target.checked || undefined)} />
          🎲 This can reroll a d20
          <span style={{ color: "#555", fontSize: 10 }}>— offers it in the reroll picker (Lucky, Bend Luck)</span>
        </label>
        {draft.isRerollSource && (
          <label style={{ fontSize: 12, display: "block", marginTop: 6 }}>
            Method
            <select value={draft.rerollMethod ?? "reroll"}
              onChange={e => set("rerollMethod", e.target.value as "reroll" | "flip")}
              style={{ display: "block", width: "100%", marginTop: 2, padding: "4px 8px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff" }}>
              <option value="reroll">Reroll — throw it again</option>
              <option value="advantage">Advantage — second d20, keep the higher</option>
              <option value="bonus">Add dice to the roll (+1d4, +1d10)</option>
              <option value="flip">Other side of the die (21 − roll)</option>
            </select>
            <span style={{ fontSize: 10, color: "#5a5a6e" }}>
              Pair with "Spends resource" above so using it counts down the pool.
            </span>
          </label>
        )}
      </div>

      {draft.tab !== "spell" && (
        <div style={{ border: "1px solid #2a2a3e", borderRadius: 6, padding: "6px 8px" }}>
          <label style={{ fontSize: 12, display: "block" }}>
            Weapon buff — damage <span style={{ color: "#555", fontSize: 10 }}>— arms a persistent bonus on weapon attacks when used (Rage, Hunter's Mark)</span>
            <input type="text" value={draft.weaponBuffDamage ?? ""} onChange={e => set("weaponBuffDamage", e.target.value || undefined)} placeholder="+2 or +1d6" style={{ display: "block", width: "100%", marginTop: 2, padding: "4px 8px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff" }} />
          </label>
          {/* ⚠ SOME RIDERS BUY TO-HIT, NOT DAMAGE. Sacred Weapon adds CHA to ATTACK ROLLS;
              authoring it in the damage box makes the paladin hit no more often and swing
              harder, which is the opposite of the feature. The runtime has carried
              `weaponBuffAttack` since it was written — one chip, both halves — but there was
              no box to type it in, so it could never be authored. */}
          <label style={{ fontSize: 12, display: "block", marginTop: 6 }}>
            Weapon buff — to hit <span style={{ color: "#555", fontSize: 10 }}>— rides the ATTACK ROLL instead (Sacred Weapon +CHA, Bless)</span>
            <input type="text" value={draft.weaponBuffAttack ?? ""} onChange={e => set("weaponBuffAttack", e.target.value || undefined)} placeholder="+@CHA or +1d4" style={{ display: "block", width: "100%", marginTop: 2, padding: "4px 8px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff" }} />
          </label>
          {(draft.weaponBuffAttack?.trim() || draft.weaponBuffDamage?.trim()) && (
            <div style={{ fontSize: 10, color: "#7be08a", marginTop: 4 }}>
              ⚔ One chip carries both: {[
                draft.weaponBuffAttack?.trim() ? `${draft.weaponBuffAttack.trim()} to hit` : "",
                draft.weaponBuffDamage?.trim() ? `${draft.weaponBuffDamage.trim()} to damage` : "",
              ].filter(Boolean).join(" and ")}. Armed on use, cleared by ✕ or End Combat.
            </div>
          )}
        </div>
      )}

      {/* Fighting style toggle (Archery / Two-Weapon / Great Weapon). Shows as a clickable
          toggle on the card; while on, adds the bonus to matching weapon attacks. */}
      {(tabId === "feats" || tabId === "features" || draft.actionCost === "passive") && (
        <div style={{ border: "1px solid #2a2a3e", borderRadius: 6, padding: "6px 8px" }}>
          <div style={{ fontSize: 11, color: "#e0a85a", marginBottom: 4 }}>⚔ Fighting style toggle <span style={{ color: "#555" }}>(blank = none · numbers/dice only, no labels)</span></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <label style={{ fontSize: 11 }}>Attack bonus
              <input type="text" value={draft.combatStyleAttack ?? ""} onChange={e => set("combatStyleAttack", e.target.value || undefined)} placeholder="+2" style={{ display: "block", width: "100%", marginTop: 2, padding: "4px 8px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff" }} /></label>
            <label style={{ fontSize: 11 }}>Damage bonus
              <input type="text" value={draft.combatStyleDamage ?? ""} onChange={e => set("combatStyleDamage", e.target.value || undefined)} placeholder="+1d6 or +2" style={{ display: "block", width: "100%", marginTop: 2, padding: "4px 8px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff" }} /></label>
            <label style={{ fontSize: 11 }}>Applies to
              <select value={draft.combatStyleTarget ?? ""} onChange={e => set("combatStyleTarget", (e.target.value || undefined) as PcActionDraft["combatStyleTarget"])} style={{ display: "block", width: "100%", marginTop: 2, padding: "4px 8px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff" }}>
                <option value="">—</option>
                <option value="ranged">Ranged</option>
                <option value="melee">Melee</option>
                <option value="two-handed">Two-handed / Heavy (GWF, GWM)</option>
                <option value="weapon">Any weapon</option>
              </select></label>
          </div>
          <span style={{ fontSize: 10, color: "#555", marginTop: 2, display: "block" }}>E.g. Archery → Attack +2 · Ranged. (Two-Weapon Fighting isn't a bonus — author the off-hand attack in the Bonus tab without the ability mod. Great Weapon Fighting's reroll isn't auto — use a flat bonus or a reminder.)</span>
        </div>
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
  resourceLabels?: string[];
  /** Passed through to the form so an action can name which class casts it. */
  classRows?: { name: string; level: number }[];
  /**
   * Move or copy an action to ANOTHER tab.
   *
   * This component only owns its own list, so it cannot write a second tab by itself — the
   * editor above it does. Without this, relocating an action meant deleting it and typing the
   * whole thing again somewhere else, which is both tedious and lossy: every formula, cost,
   * resource link and rider has to be re-entered by hand and any one of them can be fat-
   * fingered. That is a real problem right now, with `features` being retired into `feats`.
   */
  onMoveToTab?: (action: ActorAction, target: TabId, mode: "move" | "copy") => void;
};

/** Tabs an action can be sent to. Spells have their own table editor, so they are not here. */
const MOVE_TARGETS: Array<{ id: TabId; label: string }> = [
  { id: "main", label: "Actions" },
  { id: "bonus", label: "Bonus" },
  { id: "bond", label: "Bonds" },
  { id: "features", label: "Class Actions" },
  { id: "feats", label: "Feats" },
  { id: "checks", label: "Checks" },
  { id: "resources", label: "Resources" },
  { id: "outOfCombat", label: "Out of Combat" },
];

export function ActorEditorActionTab({ tabId, actions, onChange, resourceLabels, classRows, onMoveToTab }: ActorEditorActionTabProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  // Shift held when the Move dropdown was opened -> copy instead of move.
  const [moveAsCopy, setMoveAsCopy] = useState(false);

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
              resourceLabels={resourceLabels}
            />
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", background: "#161622", borderRadius: 6, border: "1px solid #2a2a3e" }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{action.label}</span>
                {action.category && <span style={{ fontSize: 11, color: "#666", marginLeft: 6 }}>({action.category})</span>}
                {action.metadata?.attack && <span style={{ fontSize: 11, color: "#7b68ee", marginLeft: 6 }}>⚔ {action.metadata.attack}</span>}
                {action.metadata?.damage && <span style={{ fontSize: 11, color: "#e07b39", marginLeft: 6 }}>💥 {action.metadata.damage}</span>}
              </div>
              {/* Send it somewhere else instead of deleting and retyping it. Hold Shift to
                  COPY rather than move — the same gesture as everywhere else, so a duplicate
                  into another tab does not need its own control. */}
              {onMoveToTab && (
                <select
                  value=""
                  title="Move this action to another tab (hold Shift when choosing to copy instead)"
                  onChange={e => {
                    const target = e.target.value as TabId;
                    if (!target) return;
                    onMoveToTab(action, target, moveAsCopy ? "copy" : "move");
                    e.currentTarget.value = "";
                  }}
                  onMouseDown={e => setMoveAsCopy(e.shiftKey)}
                  onKeyDown={e => setMoveAsCopy(e.shiftKey)}
                  style={{ fontSize: 11, padding: "2px 4px", background: "transparent", border: "1px solid #444", borderRadius: 3, color: "#aaa", cursor: "pointer" }}
                >
                  <option value="">Move →</option>
                  {MOVE_TARGETS.filter(t => t.id !== tabId).map(t => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              )}
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
          resourceLabels={resourceLabels}
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

// ─── Combat Actions (consolidated) ──────────────────────────────────────────────
// P-UX4 Phase 1: one tab replaces the separate Action / Bonus / Reaction creator
// steps. The DM creates an entry and picks its type; the entry is filed into the
// correct sheet bucket automatically by its chosen economy:
//   • Bonus Action          → tabs.bonus
//   • Action / Reaction / … → tabs.main
// Reactions (economy "reaction") are flagged pinned/pinReaction so they surface in
// the rendered sheet's PinnedReactions category (ActorCard.isPinnedReactionAction)
// and round-trip correctly when edited. The rendered sheet itself is unchanged.

const ECONOMY_BADGE: Record<string, { label: string; color: string }> = {
  bonus: { label: "Bonus", color: tabAccent("bonus") },
  reaction: { label: "Reaction", color: "#9be9a8" },
  bond: { label: "Bond", color: tabAccent("bond") },
  action: { label: "Action", color: tabAccent("main") },
};

function economyKey(action: ActorAction): string {
  const costs = action.economyCost ?? [];
  if (costs.includes("bonus")) return "bonus";
  if (costs.includes("reaction")) return "reaction";
  if (costs.includes("bond")) return "bond";
  return "action";
}

type CombatActionsTabProps = {
  mainActions: ActorAction[];
  bonusActions: ActorAction[];
  onChange: (next: { main: ActorAction[]; bonus: ActorAction[] }) => void;
  resourceLabels?: string[];
};

export function CombatActionsTab({ mainActions, bonusActions, onChange, resourceLabels }: CombatActionsTabProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);

  // Unified, ordered list: main first (Actions + Reactions), then Bonus.
  const entries = [...mainActions, ...bonusActions];

  // Route a saved action into the correct bucket by its economy, deriving the
  // pinned-reaction flags so reactions surface on the rendered sheet. Same-bucket
  // edits keep their position; cross-bucket edits move the entry.
  function routeAndApply(action: ActorAction) {
    const isReaction = Boolean(action.economyCost?.includes("reaction"));
    const routed: ActorAction = { ...action, pinned: isReaction, pinReaction: isReaction };
    const target: "main" | "bonus" = routed.economyCost?.includes("bonus") ? "bonus" : "main";

    const inMain = mainActions.some(a => a.id === routed.id);
    const inBonus = bonusActions.some(a => a.id === routed.id);

    let nextMain = mainActions;
    let nextBonus = bonusActions;
    if (target === "main") {
      nextBonus = inBonus ? bonusActions.filter(a => a.id !== routed.id) : bonusActions;
      nextMain = inMain ? mainActions.map(a => (a.id === routed.id ? routed : a)) : [...mainActions, routed];
    } else {
      nextMain = inMain ? mainActions.filter(a => a.id !== routed.id) : mainActions;
      nextBonus = inBonus ? bonusActions.map(a => (a.id === routed.id ? routed : a)) : [...bonusActions, routed];
    }
    onChange({ main: nextMain, bonus: nextBonus });
  }

  function handleSaveEdit(updated: ActorAction) {
    routeAndApply(updated);
    setEditingId(null);
  }

  function handleAddNew(action: ActorAction) {
    routeAndApply(action);
    setAddingNew(false);
  }

  function handleArchive(actionId: string) {
    onChange({
      main: mainActions.filter(a => a.id !== actionId),
      bonus: bonusActions.filter(a => a.id !== actionId),
    });
    if (editingId === actionId) setEditingId(null);
  }

  function handleDuplicate(action: ActorAction) {
    routeAndApply({
      ...action,
      id: `${action.id}-copy-${Date.now().toString(36)}`,
      label: `${action.label} (Copy)`,
    });
  }

  const accent = tabAccent("main");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div className="fdmc-section-head" style={{ color: accent, marginTop: 0 }}>
        Combat Actions
        {entries.length > 0 && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 8, background: accent, color: "#0d0d14", letterSpacing: 0 }}>{entries.length}</span>
        )}
      </div>
      <p style={{ fontSize: 11, color: "#777", margin: "0 0 2px" }}>
        Create an entry and choose its type — Action, Bonus Action, or Reaction. Each one is
        filed into the right place on the character sheet automatically.
      </p>

      {entries.length === 0 && !addingNew && (
        <p style={{ fontSize: 12, color: "#666", fontStyle: "italic" }}>Nothing here yet — use “+ Add Combat Action” below to create the first entry.</p>
      )}

      {entries.map(action => {
        const badge = ECONOMY_BADGE[economyKey(action)] ?? ECONOMY_BADGE.action;
        return (
          <div key={action.id}>
            {editingId === action.id ? (
              <ActionForm
                tabId="main"
                initial={action}
                onSave={handleSaveEdit}
                onCancel={() => setEditingId(null)}
                resourceLabels={resourceLabels}
              />
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", background: "#161622", borderRadius: 6, border: "1px solid #2a2a3e" }}>
                <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 8, background: badge.color, color: "#0d0d14", flexShrink: 0, textTransform: "uppercase", letterSpacing: 0.3 }}>{badge.label}</span>
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
        );
      })}

      {addingNew && (
        <ActionForm
          tabId="main"
          onSave={handleAddNew}
          onCancel={() => setAddingNew(false)}
          resourceLabels={resourceLabels}
        />
      )}

      {!addingNew && !editingId && (
        <button
          type="button"
          onClick={() => setAddingNew(true)}
          style={{ padding: "5px 12px", background: "transparent", border: "1px dashed #444", borderRadius: 4, color: "#888", cursor: "pointer", fontSize: 12, marginTop: 4 }}
        >
          + Add Combat Action
        </button>
      )}
    </div>
  );
}
