import type { BondTemplate } from "../types/bond";
import { BOND_METAMORPHOSIS_STAGE, BOND_STAGE_NAMES, bondStageForLevel } from "../types/bond";
import { chooseBondPath, resolveBond } from "../rules/bondProgress";
// The fourteen bonds are MOD content; the editor is engine. They arrive here the same way the
// monster editor gets them — assembled at the seam, never imported by the control itself.
import { BROKEN_CHAIN_BOND_TEMPLATES } from "../../modules/the-broken-chain/content/bondTemplates";
import { useState } from "react";
import { loadPendingDrafts, savePendingDraft, removePendingDraft, newPendingDraftId, type PendingDraft } from "../state/pendingDrafts";
import type { Actor, AbilityId, AbilityScores, ActorKind } from "../types/actor";
import type { ActorAction, TabId, TabActionMap } from "../types/tabs";
import { abilityModifier, proficiencyBonus, savingThrowModifier, inferSaveProficiency } from "../rules/dnd5e";
import { ActorEditorActionTab, CombatActionsTab } from "./ActorEditorActionTab";
import { EquipmentBagEditor } from "./EquipmentBagEditor";
import { masteryCountForClass, MASTERY_CLASSES } from "../rules/weaponMastery";
import { parseClassLevels, hitDicePools } from "../rules/multiclass";
import { resourcesForClasses, classHasResources } from "../rules/classResources";
import { castingAbilityForClass } from "../rules/multiclass";
import { slugifyForActionId } from "./pcActionTypes";
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
  /** Label for the single proposeMode button. Defaults to "Submit for DM Approval".
   *  The level-up workspace overrides it (e.g. "Save as L5 Preset"). */
  submitLabel?: string;
  /** Candidate owners (player actors) for the Companion "Owner" dropdown. */
  ownerOptions?: OwnerOption[];
  /**
   * The COMPANIONS a bond may be performed by. Separate from `ownerOptions` because they answer
   * opposite questions — see the note in dm-panel.
   */
  companionOptions?: OwnerOption[];
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

// Class-feature spells (spellSlotMode "freeCast") spend a dedicated N-per-long-rest
// resource instead of a spell slot. Keep tabs.resources in sync: regenerate the
// auto-managed "cf-spell-" resources from the current class-feature spells so they show
// in the Resources list and the runtime automation can decrement/reset them. Manual
// resources (any id not prefixed "cf-spell-") are preserved untouched.
function syncClassFeatureSpellResources(tabs: TabActionMap): TabActionMap {
  try {
  const spells = tabs.spells ?? [];
  const cfSpells = spells.filter(
    s => s.metadata?.spellSlotMode === "freeCast" && (s.metadata?.classFeatureUses ?? 0) > 0,
  );
  // Keep every resource except the auto-managed cf-spell ones (guard non-string ids).
  const manualResources = (tabs.resources ?? []).filter(r => !(typeof r.id === "string" && r.id.startsWith("cf-spell-")));
  const cfResources: ActorAction[] = cfSpells.map(s => {
    const uses = s.metadata?.classFeatureUses ?? 1;
    const details = `Pool: ${uses} · Reset: Long Rest · Class feature spell`;
    return {
      id: `cf-spell-${s.id}`,
      label: s.label,
      description: details,
      actionKind: "resource",
      logMode: "silent",
      displayMode: "compact",
      category: "Class Features / Resources",
      metadata: { cost: "Long Rest", details, additive: String(uses), resourceKind: "freeCast" },
    };
  });
  return { ...tabs, resources: [...manualResources, ...cfResources] };
  } catch (err) {
    // Never block a character save on resource sync.
    console.error("[ActorEditor] class-feature resource sync failed:", err);
    return tabs;
  }
}

type EditorTab =
  | "profile"
  | "combat"
  | "features"
  | "bonds"
  | "spells"
  | "resources"
  | "feats"
  | "equipment"
  | "notes";

const EDITOR_TAB_LABELS: Record<EditorTab, string> = {
  profile: "Profile",
  combat: "Combat Actions",
  features: "Features",
  bonds: "Bond",
  spells: "Spells",
  resources: "Resources",
  feats: "Feats",
  equipment: "Equipment",
  notes: "Notes",
};

/**
 * ⚠ NO FEATS STEP. Feats and class features are ONE tab now, and it is Features.
 *
 * Christopher: *"they are suppose to be shown on the actor under features [...] one needs to go
 * away"*. Removing the step is what makes that true for a NEW actor; `migrateFeatsIntoFeatures`
 * does it for existing ones.
 *
 * ⚠ THE `feats` TAB ID STAYS IN THE TYPE. Stored characters still carry the key, every reader
 * still accepts it, and an entry can still be MOVED to Features by hand from the move menu. What
 * goes away is the editor step that invites a DM to put something there in the first place.
 */
const EDITOR_TABS: EditorTab[] = ["profile", "combat", "features", "bonds", "spells", "resources", "equipment", "notes"];

// Distinct color accent per creator step (P-UX1). Derived from the shared
// `tabVisuals` source of truth so the creator's tabs match the character sheet's
// tabs a player sees afterward. profile/reactions are creator-only steps with no
// 1:1 sheet tab, so they carry their own accents.
const EDITOR_TAB_ACCENT: Record<EditorTab, string> = {
  profile: "#7b68ee",
  combat: tabAccent("main"),
  features: tabAccent("features"),
  bonds: tabAccent("bond"),
  spells: tabAccent("spells"),
  resources: tabAccent("features"),
  feats: tabAccent("feats"),
  equipment: tabAccent("equipment"),
  notes: tabAccent("notes"),
};

// Which steps are required vs optional in the guided flow.
const REQUIRED_STEPS = new Set<EditorTab>(["profile"]);
const RECOMMENDED_STEPS = new Set<EditorTab>(["combat"]);

const STEP_HINT: Record<EditorTab, string> = {
  profile: "Required — name, level, and core stats. Everything else builds on this.",
  combat: "Recommended — add the character's actions, bonus actions, and reactions. Choose each entry's type; it's filed automatically.",
  features:
    "Class actions, passive features AND feats — feats live here now. "
    + "Only add a feat that changes something the app CALCULATES: damage, party healing, "
    + "reach or accuracy. HP, ability scores and granted spells are values you type in, so a "
    + "feat whose only effect is +HP, an ASI or an extra spell does NOT need an entry — it is "
    + "already on the sheet, and adding it would price it twice.",
  bonds: "Optional — bonds & primed additives (Rage, Focus, Pressure, Dark Bargain…).",
  spells: "Optional — spells and slot levels.",
  resources: "Optional — resource pools and class features.",
  /**
   * ⚠ UNREACHABLE — the Feats step was removed and feats live on Features. Kept only because
   * `EditorTab` still includes the id, so this record must stay total.
   */
  feats: "Retired — feats are on the Features tab.",
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
  /** Which of the campaign's bonds this character carries. "" = none. */
  bondTemplateId: string;
  /**
   * The permanent path index, once Metamorphosis has been reached. Kept as a string so the
   * select can express "not yet chosen" without a sentinel number.
   */
  bondPathIndex: string;
  /** For a companion-performed bond (Pack): which companion actually acts. */
  bondCompanionId: string;
  name: string;
  subtitle: string;
  race: string;
  className: string;
  /** e.g. "3 / 2" for Fighter 3 / Rogue 2. Left blank for single-class. */
  multiclassLevels: string;
  /**
   * Spellcasting ability, when the class does not imply one. A Barbarian who picks up a spell
   * from an item or a race still needs a stat, and no class lookup will ever supply it.
   */
  castingAbility: string;
  /**
   * Declares a class the lookup does not know to be a caster — third-party or homebrew.
   * The derived table covers the 12 core classes; anything else needs to be able to say so.
   */
  isSpellcaster: boolean;
  /** Declares custom class resources for the same reason: the table cannot know them. */
  hasClassResource: boolean;
  level: string;
  /** Extra Attack — weapon/unarmed attacks per Attack action. Spells always cast once. */
  attacksPerAction: string;
  ac: string;
  hpMax: string;
  hpCurrent: string;
  speed: string;
  abilities: Record<AbilityId, { score: string; save: string; saveProficient: boolean }>;
  classFeatureLabel: string;
  classFeatureValue: string;
  classFeatureNote: string;
};

function actorToProfileDraft(actor: Actor): ProfileDraft {
  return {
    kind: actor.kind,
    ownerId: actor.moduleData?.ownerId ?? "",
    bondTemplateId: actor.moduleData?.bondAssignment?.templateId ?? "",
    bondPathIndex: actor.moduleData?.bondAssignment?.chosenPathIndex === undefined
      ? "" : String(actor.moduleData.bondAssignment.chosenPathIndex),
    bondCompanionId: actor.moduleData?.bondAssignment?.companionActorId ?? "",
    name: actor.name,
    subtitle: actor.subtitle,
    race: actor.race ?? "",
    className: actor.className ?? "",
    // Rebuilt from the stored class rows, so re-opening a multiclass sheet shows its split.
    multiclassLevels: (actor.classes ?? []).map(c => String(c.level)).join(" / "),
    level: String(actor.level),
    attacksPerAction: String(actor.attacksPerAction ?? 1),
    ac: String(actor.stats.ac),
    hpMax: String(actor.stats.hp.max),
    hpCurrent: String(actor.stats.hp.current),
    speed: typeof actor.stats.speed === "string" ? actor.stats.speed : "30 ft",
    abilities: Object.fromEntries(
      ABILITY_IDS.map(id => {
        const a = actor.abilityScores?.[id];
        const scoreNum = a?.score;
        // Sheets authored before the flag carry a typed save on every ability. Read it back
        // as proficiency where it matches the rule, so opening an actor converts it without
        // changing a single number. A save matching neither rule keeps its explicit value.
        let saveProficient = a?.saveProficient ?? false;
        let explicit = a?.save;
        if (a?.saveProficient === undefined && typeof a?.save === "number" && typeof scoreNum === "number") {
          const mod = typeof a.modifier === "number" ? a.modifier : abilityModifier(scoreNum);
          const read = inferSaveProficiency({ save: a.save, modifier: mod, level: actor.level });
          saveProficient = read.saveProficient;
          explicit = read.keepExplicit ? a.save : undefined;
        }
        return [id, {
          score: String(scoreNum ?? ""),
          save: String(explicit ?? ""),
          saveProficient,
        }];
      })
    ) as ProfileDraft["abilities"],
    castingAbility: actor.classes?.[0]?.castingAbility ?? "",
    isSpellcaster: Boolean(actor.classes?.[0]?.castingAbility) || Boolean(actor.tabs?.spells?.length),
    hasClassResource: Boolean(actor.tabs?.resources?.length),
    classFeatureLabel: actor.classFeatureTracker?.label ?? "",
    classFeatureValue: actor.classFeatureTracker?.value ?? "",
    classFeatureNote: actor.classFeatureTracker?.note ?? "",
  };
}

function profileDraftToActorPatch(draft: ProfileDraft): Partial<Actor> {
  const level = Number.parseInt(draft.level, 10);
  const attacksPerAction = Number.parseInt(draft.attacksPerAction, 10);
  const ac = Number.parseInt(draft.ac, 10);
  const hpMax = Number.parseInt(draft.hpMax, 10);
  const hpCurrent = Math.min(Number.parseInt(draft.hpCurrent, 10), hpMax);

  const abilities: AbilityScores = {};
  for (const id of ABILITY_IDS) {
    const score = Number.parseInt(draft.abilities[id].score, 10);
    // The modifier is DERIVED from the score, never typed. Two independent boxes let a
    // score of 10 sit next to a modifier of +20 — wrong everywhere it is read, and invisible
    // until someone rolls, because the stored modifier wins over the derived one.
    const modifier = Number.isFinite(score) ? abilityModifier(score) : undefined;
    // A save of 0 is meaningful (CHA 10, no proficiency), so test for a finite number
    // rather than truthiness — and a blank field means "no override", not zero.
    const save = Number.parseInt(draft.abilities[id].save, 10);
    const prof = draft.abilities[id].saveProficient;
    if (Number.isFinite(score) || Number.isFinite(save) || prof) {
      abilities[id] = {
        ...(Number.isFinite(score) ? { score } : {}),
        ...(modifier !== undefined ? { modifier } : {}),
        ...(prof ? { saveProficient: true } : {}),
        ...(Number.isFinite(save) ? { save } : {}),
      };
    }
  }

  // "Paladin / Sorcerer" + "5 / 1" → real class rows. Empty for a single class.
  const multiclassRows = parseClassLevels(draft.className, draft.multiclassLevels);

  return {
    kind: draft.kind,
    name: draft.name.trim() || "Unnamed Actor",
    subtitle: draft.subtitle.trim(),
    race: draft.race.trim() || undefined,
    // For multiclass: store "Fighter / Rogue" in className so the card shows it correctly
    className: draft.className.trim() || undefined,
    // …and the SPLIT as real data. "Paladin / Sorcerer" + "5 / 1" becomes class rows, which is
    // what every per-class rule actually needs — weapon mastery counts four levels of Fighter,
    // not the character's ten. A single-class character grows no array: className and level
    // already say it, and duplicating that is how the two end up disagreeing.
    classes: multiclassRows.length > 0
      ? multiclassRows.map((c, i) => (i === 0 && draft.castingAbility
          ? { ...c, castingAbility: draft.castingAbility as never } : c))
      // A single-class sheet grows no array UNLESS a casting ability was chosen — that choice
      // has nowhere else to live, and a Barbarian with one spell needs it as much as a Wizard.
      : draft.castingAbility
        ? [{ name: draft.className, level: Number(draft.level) || 1, castingAbility: draft.castingAbility as never }]
        : undefined,
    // With a split present the character's level IS the sum, so the two can never drift.
    level: multiclassRows.length > 0
      ? multiclassRows.reduce((n, c) => n + c.level, 0)
      : (Number.isFinite(level) ? level : 1),
    attacksPerAction: Number.isFinite(attacksPerAction) && attacksPerAction > 1 ? attacksPerAction : undefined,
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

function ProfileTab({ draft, onChange, ownerOptions, companionOptions = [], hasSpells, bondOptions = [], characterLevel, canAssignBond = false }: { draft: ProfileDraft; onChange: (d: ProfileDraft) => void; ownerOptions: OwnerOption[]; companionOptions?: OwnerOption[]; hasSpells?: boolean; bondOptions?: BondTemplate[]; characterLevel?: number; canAssignBond?: boolean }) {
  /** Why the last path click was refused, in `chooseBondPath`'s own words. */
  const [bondPathRefusal, setBondPathRefusal] = useState<string | null>(null);

  function set<K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) {
    onChange({ ...draft, [key]: value });
  }

  function setAbility(id: AbilityId, field: "score" | "save" | "saveProficient", value: string | boolean) {
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

      {/*
        THE CHARACTER'S BOND.

        The stage is NOT set here and deliberately has no control: bonds scale on LEVEL (3/6/9/13)
        like cantrips, so it is derived and printed. What a DM sets is WHICH bond, and — once the
        character has reached Metamorphosis — the one permanent path.

        ⚠ The path select disables itself once chosen. v13: "Metamorphosis is permanent." The only
        way to change it is to clear the bond entirely, which costs the character their progress
        and is what makes the choice mean something.
      */}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <label style={labelStyle}>Name <input type="text" value={draft.name} onChange={e => set("name", e.target.value)} style={inputStyle} /></label>
        <label style={labelStyle}>Subtitle <input type="text" value={draft.subtitle} onChange={e => set("subtitle", e.target.value)} style={inputStyle} /></label>
        <label style={labelStyle}>Race <input type="text" value={draft.race} onChange={e => set("race", e.target.value)} style={inputStyle} /></label>
        <label style={labelStyle}>
          Class
          <input type="text" value={draft.className} onChange={e => set("className", e.target.value)}
            placeholder="Fighter  — or —  Fighter / Rogue"
            style={inputStyle} />
          {/* WEAPON MASTERY IS DRIVEN BY THIS FIELD, and every character in the library had it
              blank — their class lived only in the subtitle prose, which is not something to
              read data out of. Showing the resulting count here makes the connection visible:
              type "Paladin" and it says 2, so a blank field is obviously a blank field rather
              than silently meaning "no masteries". */}
          <span style={{ fontSize: 10, color: draft.className.trim() ? "#7b68ee" : "#6a5a2a", marginTop: 3, display: "block" }}>
            {draft.className.trim()
              ? (() => {
                  const n = masteryCountForClass(draft.className, Number(draft.level) || 1);
                  return n > 0
                    ? `⚔ ${n} weapon master${n === 1 ? "y" : "ies"} at level ${draft.level}`
                    : "Non-martial — no weapon masteries unless a feat grants one";
                })()
              : "⚠ Blank — weapon mastery needs a class here. Recognised: " + MASTERY_CLASSES.join(", ")}
          </span>
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
            {/* What the split actually buys. Character level is the SUM, not something typed
                separately — and the hit dice stop pretending to be six of one size when a
                Paladin 5 / Sorcerer 1 has 5d10 and 1d6. */}
            {(() => {
              const rows = parseClassLevels(draft.className, draft.multiclassLevels);
              if (rows.length === 0) {
                return <span style={{ fontSize: 10, color: "#6a5a2a", display: "block", marginTop: 4 }}>
                  ⚠ Enter one level per class, e.g. "5 / 1" — until then this reads as single-class.
                </span>;
              }
              const total = rows.reduce((n, c) => n + c.level, 0);
              const dice = hitDicePools({ classes: rows, className: draft.className, level: total });
              return <span style={{ fontSize: 10, color: "#7b68ee", display: "block", marginTop: 4 }}>
                {rows.map(c => `${c.name} ${c.level}`).join(" / ")} — character level {total}
                {dice.length > 0 && <> · hit dice {dice.map(d => `${d.count}${d.die}`).join(" + ")}</>}
                {/* WHICH STAT EACH CLASS CASTS ON. Derived from the class name, shown so it is
                    checkable, and overridable for the cases no lookup can know — a Hexblade on
                    CHA, or a homebrew class the table invented. This is what @SPELL and @CASTMOD
                    resolve through, per action, via the "Cast using" picker. */}
                <span style={{ display: "block", marginTop: 3, color: "#8a8aa0" }}>
                  casts on {rows.map(c => `${c.name} ${(c.castingAbility ?? "—").toUpperCase()}`).join(" · ")}
                </span>
              </span>;
            })()}
          </label>
        )}
        <label style={labelStyle}>Level <input type="number" min={1} max={20} value={draft.level} onChange={e => set("level", e.target.value)} style={inputStyle} /></label>
        <label style={labelStyle}>AC <input type="number" min={1} max={30} value={draft.ac} onChange={e => set("ac", e.target.value)} style={inputStyle} /></label>
        <label style={{ ...labelStyle, gridColumn: "span 2" }}>
          Attacks per Attack action
          <input type="number" min={1} max={4} value={draft.attacksPerAction} onChange={e => set("attacksPerAction", e.target.value)} style={inputStyle} />
          <span style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
            Extra Attack — 1 until L5, 2 for martials at L5, 3 for a Fighter at L11. Applies to
            weapon/unarmed attacks only; casting a spell always uses the whole action.
          </span>
        </label>
        <label style={labelStyle}>HP Max <input type="number" min={1} value={draft.hpMax} onChange={e => set("hpMax", e.target.value)} style={inputStyle} /></label>
        <label style={labelStyle}>HP Current <input type="number" min={0} value={draft.hpCurrent} onChange={e => set("hpCurrent", e.target.value)} style={inputStyle} /></label>
        <label style={{ ...labelStyle, gridColumn: "span 2" }}>Speed <input type="text" value={draft.speed} onChange={e => set("speed", e.target.value)} style={inputStyle} /></label>
      </div>

      <h4 style={{ margin: "4px 0 0" }}>Ability Scores</h4>
      {/* Score is the only number typed here.
          The modifier is DERIVED — two independent boxes let a score of 10 sit beside a
          modifier of +20, and the stored modifier wins wherever it is read, so the mistake
          is invisible until someone rolls.
          The save is a PROFICIENCY TOGGLE, not a number: proficiency adds the bonus for the
          character's level, so the save follows the score and the level by itself instead of
          needing a hand edit on every level-up. */}
      <p style={{ margin: 0, fontSize: 11, color: "#666" }}>
        Type the <span style={{ color: "#aaa" }}>score</span> — the modifier is worked out from it.
        Tick <span style={{ color: "#d7b36a" }}>SV</span> for a proficient save (adds +{proficiencyBonus(Number.parseInt(draft.level, 10) || 1)} at this level).
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
        {ABILITY_IDS.map(id => {
          const scoreNum = Number.parseInt(draft.abilities[id].score, 10);
          const mod = Number.isFinite(scoreNum) ? abilityModifier(scoreNum) : null;
          const lvl = Number.parseInt(draft.level, 10) || 1;
          const explicit = Number.parseInt(draft.abilities[id].save, 10);
          const sv = Number.isFinite(explicit)
            ? explicit
            : mod === null ? null
            : savingThrowModifier({ modifier: mod, saveProficient: draft.abilities[id].saveProficient, level: lvl });
          const fmt = (n: number | null) => n === null ? "—" : n >= 0 ? `+${n}` : `${n}`;
          return (
          <div key={id} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 2 }}>{ABILITY_LABELS[id]}</div>
            <input type="number" value={draft.abilities[id].score} onChange={e => setAbility(id, "score", e.target.value)}
              placeholder="—" title="Score — the only number you type"
              style={{ width: "100%", padding: "2px 4px", borderRadius: 3, border: "1px solid #333", background: "#111", color: "#fff", fontSize: 12, textAlign: "center" }} />
            <div title="Modifier — worked out from the score"
              style={{ width: "100%", padding: "2px 4px", borderRadius: 3, border: "1px solid #222", background: "#0d0d0d", color: "#aaa", fontSize: 11, textAlign: "center", marginTop: 2 }}>
              {fmt(mod)}
            </div>
            <label title={Number.isFinite(explicit)
                ? `Explicit save override of ${fmt(explicit)} — clear it on the sheet to use proficiency instead.`
                : "Proficient in this saving throw — adds the proficiency bonus for this level."}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 2,
                padding: "2px 4px", borderRadius: 3, border: "1px solid #3a2f18", background: "#0d0d0d",
                color: "#d7b36a", fontSize: 11, cursor: Number.isFinite(explicit) ? "default" : "pointer" }}>
              <input type="checkbox" disabled={Number.isFinite(explicit)}
                checked={draft.abilities[id].saveProficient}
                onChange={e => setAbility(id, "saveProficient", e.target.checked)}
                style={{ margin: 0 }} />
              <span>{fmt(sv)}</span>
            </label>
          </div>
          );
        })}
      </div>

      {/* THIRD-PARTY AND HOMEBREW ESCAPE HATCHES.
          The derived tables cover the 12 core classes. A class they have never heard of has no
          way to say "I cast" or "I track something" — and a table running its own content
          should not have to wait for the lookup to be taught about it. */}
      {!castingAbilityForClass(draft.className) && (
        <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
          <input type="checkbox" checked={draft.isSpellcaster}
            onChange={e => set("isSpellcaster", e.target.checked)} />
          Spellcaster <span style={{ color: "#667" }}>— tick for a class the app does not know casts</span>
        </label>
      )}
      {!classHasResources(draft.className) && (
        <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={draft.hasClassResource}
            onChange={e => set("hasClassResource", e.target.checked)} />
          Has class resources <span style={{ color: "#667" }}>— adds them on the Resources tab</span>
        </label>
      )}
      {draft.hasClassResource && !classHasResources(draft.className) && (
        <p style={{ margin: "2px 0 0", fontSize: 10, color: "#667" }}>
          Add each pool on the <strong style={{ color: "#8a8aa0" }}>Resources</strong> tab — name, uses and
          when it comes back. Anything added there is spendable and restores on rest like a built-in pool.
        </p>
      )}

      {/* ONE ROW PER CASTING CLASS, derived and never typed.
          A multiclass caster has a spellcasting entry per class — a Wizard/Cleric casts off INT
          for one list and WIS for the other, and even where both land on the same stat they are
          two separate entries, not one blended line.

          ⚠ Ability scores live at draft.abilities[id].score. Reading draft[ability] returns
          undefined and falls back to 10, which is how this first shipped showing "CHA +0" on a
          character with CHA 16. */}
      {(() => {
        const rows = parseClassLevels(draft.className, draft.multiclassLevels);
        const modOf = (id: string) => {
          const raw = (draft.abilities as Record<string, { score: string }> | undefined)?.[id]?.score;
          const score = Number.parseInt(raw ?? "10", 10);
          return Math.floor(((Number.isFinite(score) ? score : 10) - 10) / 2);
        };
        const total = rows.reduce((n, c) => n + c.level, 0) || Number(draft.level) || 1;
        const prof = Math.floor((total - 1) / 4) + 2;
        const sign = (n: number) => (n >= 0 ? `+${n}` : String(n));
        const single = rows.length < 2;
        /**
         * ⚠ parseClassLevels returns [] for a SINGLE-class character by design — className and
         * level already say it, so it grows no array. That meant rows[0] was undefined for every
         * single-class caster and NONE of them derived an ability: an Artificer, a Wizard, a
         * Cleric all fell through to "pick one" as though the class implied nothing. Ask the
         * class name directly when there is no split.
         */
        const chosen = draft.castingAbility
          || rows[0]?.castingAbility
          || castingAbilityForClass(draft.className);
        const casters = single
          ? (chosen ? [{ name: draft.className || "Class", ability: chosen }] : [])
          : rows.filter(c => c.castingAbility).map(c => ({ name: c.name, ability: c.castingAbility! }));

        if (casters.length === 0) {
          // A declared caster gets the picker even before a single spell is added.
          if (!hasSpells && !draft.isSpellcaster) return null;
          return (
            <div style={{ margin: "6px 0 0", fontSize: 11 }}>
              <span style={{ color: "#e8b64c" }}>⚠ This character has spells but no casting ability — pick one:</span>
              <div style={{ display: "flex", gap: 4, marginTop: 3 }}>
                {["str","dex","con","int","wis","cha"].map(a => (
                  <button key={a} type="button" onClick={() => set("castingAbility", a)}
                    style={{ fontSize: 11, padding: "3px 9px", borderRadius: 4, cursor: "pointer",
                             background: "#111", border: "1px solid #3a3a52", color: "#8a8aa0" }}>{a.toUpperCase()}</button>
                ))}
              </div>
            </div>
          );
        }

        return (
          <div style={{ margin: "6px 0 0", fontSize: 11 }}>
            {casters.map(c => {
              const mod = modOf(c.ability);
              return (
                <p key={c.name + c.ability} style={{ margin: "0 0 2px", color: "#7be08a" }}>
                  <strong style={{ color: "#dfe4ff" }}>{c.name}</strong> — {c.ability.toUpperCase()} {sign(mod)} ·
                  {" "}PROF {sign(prof)} · spell attack {sign(mod + prof)} · save DC {8 + mod + prof}
                </p>
              );
            })}
            {single && (
              <span style={{ display: "block", marginTop: 2 }}>
                {["str","dex","con","int","wis","cha"].map(x => (
                  <button key={x} type="button"
                    onClick={() => set("castingAbility", draft.castingAbility === x ? "" : x)}
                    style={{ fontSize: 10, padding: "2px 7px", marginRight: 3, borderRadius: 3, cursor: "pointer",
                             background: chosen === x ? "#2a3550" : "#111",
                             border: `1px solid ${chosen === x ? "#7b68ee" : "#3a3a52"}`,
                             color: chosen === x ? "#dfe4ff" : "#667" }}>{x.toUpperCase()}</button>
                ))}
                {draft.castingAbility && <span style={{ color: "#e8b64c" }}> override — click again to clear</span>}
              </span>
            )}
          </div>
        );
      })()}

      <h4 style={{ margin: "4px 0 0" }}>Class Feature Tracker</h4>
      {/* LABEL AND VALUE ARE GONE. They were hand-typed copies of things the engine derives —
          a class pool belongs in Resources where it can be spent and restored, and spell DC /
          attack come off the casting ability. Note stays: it is the one field holding something
          nothing else knows. The stored label/value are left untouched on existing actors. */}
      <label style={{ ...labelStyle }}>Note
        <input type="text" value={draft.classFeatureNote} onChange={e => set("classFeatureNote", e.target.value)}
          placeholder="Anything the sheet cannot derive" style={inputStyle} />
      </label>

      {/*
        THE BOND — one row, at the END of the profile.
        
        Christopher: *"i dont like the massive character box it created, the choice just needs to
        match how the current bonds are in the bond tab."* It was a tall panel sitting ABOVE Name,
        so an optional field pushed the required ones off screen. It is now a single row in the
        same shape the bond TAB already uses: the bond, then its two paths as side-by-side
        choices, and one line of resolved text.
      */}
      {bondOptions.length > 0 && draft.kind !== "companion" && (() => {
        const tpl = bondOptions.find(b => b.id === draft.bondTemplateId);
        const level = characterLevel ?? 1;
        const stage = bondStageForLevel(level);
        const atMeta = stage >= BOND_METAMORPHOSIS_STAGE;
        const locked = draft.bondPathIndex === "0" || draft.bondPathIndex === "1";
        const paths = tpl?.stages[Math.max(stage, BOND_METAMORPHOSIS_STAGE)]?.paths ?? [];
        const resolved = tpl
          ? resolveBond(tpl, { templateId: tpl.id, ...(locked ? { chosenPathIndex: Number(draft.bondPathIndex) as 0 | 1 } : {}) }, level)
          : undefined;
        return (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, alignItems: "end" }}>
            {/*
              ⚠ ONLY THE GM SWAPS THE BOND. Christopher: *"only is GM seat gets to see that just
              like the creating a convergence item"* and *"the level editor doesnt get to see the
              bond dropdown to swap the bonds."*

              A bond is granted, not shopped for. The level-up flow is player-facing, so it shows
              the bond READ-ONLY — the player still needs to see what they carry, and at
              Metamorphosis they still make the one choice the ladder asks of them. What they
              cannot do is change which of the fourteen they have.
            */}
            <label style={labelStyle}>
              Bond <span style={{ color: "#666" }}>— {BOND_STAGE_NAMES[stage]} at level {level}</span>
              {canAssignBond ? (
                <select value={draft.bondTemplateId} style={inputStyle}
                  onChange={e => onChange({ ...draft, bondTemplateId: e.target.value, bondPathIndex: "", bondCompanionId: "" })}>
                  <option value="">— none —</option>
                  {bondOptions.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              ) : (
                <div style={{ ...inputStyle, color: tpl ? "#cfc6ff" : "#666", display: "flex", alignItems: "center" }}>
                  {tpl?.name ?? "— none — the DM grants bonds"}
                </div>
              )}
            </label>
            {tpl?.actor === "companion" ? (
              <label style={labelStyle}>
                Bonded companion
                {/* ⚠ COMPANIONS, NOT OWNERS. This read `ownerOptions` — the PC list — so a bond
                    performed BY a companion offered player characters to perform it. */}
                <select value={draft.bondCompanionId} style={inputStyle}
                  onChange={e => onChange({ ...draft, bondCompanionId: e.target.value })}>
                  <option value="">— choose —</option>
                  {companionOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
                {companionOptions.length === 0 && (
                  <span style={{ display: "block", fontSize: 10, color: "#e9a66a", marginTop: 2 }}>
                    No companions in the library yet — create one with Character Type "Companion" and set its owner.
                  </span>
                )}
              </label>
            ) : tpl && atMeta ? (
              <label style={labelStyle}>
                Path <span style={{ color: locked ? "#e9a66a" : "#666" }}>{locked ? "— permanent" : "— permanent once chosen"}</span>
                <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
                  {paths.map((pp, pi) => (
                    <button key={pp.name} type="button" disabled={locked && Number(draft.bondPathIndex) !== pi}
                      /**
                       * ⚠ THE PERMANENCE RULE HAS ONE HOME, AND IT IS NOT THIS BUTTON.
                       *
                       * `chooseBondPath` refuses when a path is already set and when the character
                       * has not reached Metamorphosis, and it says WHY in words the DM can act on.
                       * A disabled button re-states the same rule in a second place, and two copies
                       * of one rule drift — RULE 0. The button still greys out, but what actually
                       * decides is the call.
                       */
                      onClick={() => {
                        if (!tpl) return;
                        const attempt = chooseBondPath(
                          { templateId: tpl.id, ...(locked ? { chosenPathIndex: Number(draft.bondPathIndex) as 0 | 1 } : {}) },
                          pi as 0 | 1,
                          level,
                        );
                        if (!attempt.ok) { setBondPathRefusal(attempt.reason); return; }
                        setBondPathRefusal(null);
                        onChange({ ...draft, bondPathIndex: String(attempt.assignment.chosenPathIndex) });
                      }}
                      style={{
                        flex: 1, fontSize: 11, padding: "5px 8px", borderRadius: 3,
                        cursor: locked ? "default" : "pointer",
                        background: draft.bondPathIndex === String(pi) ? "#7b68ee33" : "transparent",
                        border: `1px solid ${draft.bondPathIndex === String(pi) ? "#7b68ee" : "#333"}`,
                        color: draft.bondPathIndex === String(pi) ? "#cfc6ff" : locked ? "#444" : "#999",
                      }}>{pp.name}</button>
                  ))}
                </div>
              </label>
            ) : <span />}
            {bondPathRefusal && (
              <span style={{ gridColumn: "span 2", fontSize: 10, color: "#e9a66a", lineHeight: 1.4 }}>{bondPathRefusal}</span>
            )}
            {resolved && (resolved.chosen || resolved.awaitingPathChoice) && (
              <span style={{ gridColumn: "span 2", fontSize: 10, color: resolved.awaitingPathChoice ? "#e9a66a" : "#777" }}>
                {resolved.awaitingPathChoice
                  ? `${resolved.stageName} reached — choose the permanent path.`
                  : `${resolved.chosen!.name}: ${resolved.chosen!.text}`}
              </span>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// ─── Main editor ──────────────────────────────────────────────────────────────

export function ActorEditor({ actor: actorProp, mode, onSave, onCancel, proposeMode = false, submitLabel = "Submit for DM Approval", ownerOptions = [], companionOptions = [] }: ActorEditorProps) {
  const actor = actorProp ?? createBlankActor();
  const [activeTab, setActiveTab] = useState<EditorTab>("profile");
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>(() => actorToProfileDraft(actor));

  /**
   * Class rows in slot order, for the action editor's "Cast using" picker. Parsed from the
   * SAME source the profile summary uses, so the picker can never disagree with the split the
   * sheet displays.
   */
  const editorClassRows = parseClassLevels(profileDraft.className, profileDraft.multiclassLevels);
  const [tabsDraft, setTabsDraft] = useState<TabActionMap>(() => ({ ...actor.tabs }));
  const [showDanger, setShowDanger] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  // Surface save failures in the UI instead of silently swallowing them (the click
  // handler would otherwise just "do nothing" if buildEditedActor/onSave throws).
  const [saveError, setSaveError] = useState<string | null>(null);
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
      tabs: syncClassFeatureSpellResources(tabsDraft),
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
    /**
     * THE BOND ASSIGNMENT.
     *
     * ⚠ Clearing the bond clears the PATH with it, and that is the ONLY way a path ever changes.
     * v13: "Metamorphosis is permanent." Removing and re-granting is the DM's deliberate act and
     * costs the character their progress — which is exactly what makes it a real decision.
     */
    {
      const prev = actor.moduleData?.bondAssignment;
      const templateId = profileDraft.bondTemplateId.trim();
      const pathRaw = profileDraft.bondPathIndex.trim();
      const nextBond = templateId
        ? {
          templateId,
          ...(pathRaw === "0" || pathRaw === "1" ? { chosenPathIndex: Number(pathRaw) as 0 | 1 } : {}),
          ...(profileDraft.bondCompanionId.trim() ? { companionActorId: profileDraft.bondCompanionId.trim() } : {}),
          ...(prev?.note ? { note: prev.note } : {}),
        }
        : undefined;
      const base = edited.moduleData ?? actor.moduleData;
      if (nextBond || base) {
        edited.moduleData = { act: 1, theme: "the-broken-chain", statBlockStatus: "confirmed", ...(base ?? {}), bondAssignment: nextBond };
      }
    }
    return edited;
  }

  // Save wrapper: once a character is truly saved, clear its pending draft.
  function finalizeSave(edited: Actor, saveMode: ActorEditorSaveMode) {
    if (activeDraftId) removePendingDraft("actor", activeDraftId);
    onSave(edited, saveMode);
  }

  // Build + save, surfacing any thrown error in the UI rather than silently failing.
  function attemptSave(saveMode: ActorEditorSaveMode, newId?: string) {
    try {
      setSaveError(null);
      finalizeSave(buildEditedActor(newId), saveMode);
    } catch (err) {
      const message = err instanceof Error ? `${err.message}` : String(err);
      setSaveError(`Save failed: ${message}`);
      console.error("[ActorEditor] save failed:", err);
    }
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

  /**
   * Move (or copy) an action between tabs.
   *
   * Relocating one used to mean deleting it and retyping the whole thing — every formula,
   * cost, resource link and rider re-entered by hand, any one of which can be mistyped. This
   * moves the OBJECT, so nothing is re-derived and nothing can be lost in transit.
   *
   * Both tabs are written in ONE setState. Two calls would each read the same stale draft and
   * the second would clobber the first, so the action would land in the target and never leave
   * the source — a duplicate, silently.
   *
   * A COPY takes a new id. Two entries sharing an id collide in every keyed lookup the card
   * does: readied keys, charge pools, resolved-roll tracking.
   */
  function handleMoveActionToTab(action: ActorAction, target: TabId, mode: "move" | "copy") {
    setTabsDraft(d => {
      const landing = mode === "copy"
        ? { ...action, id: `${action.id}-copy-${Date.now().toString(36)}`, label: `${action.label} (Copy)` }
        : action;
      const next = { ...d, [target]: [...(d[target] ?? []), landing] };
      if (mode === "move") {
        for (const [tab, list] of Object.entries(d) as Array<[TabId, ActorAction[]]>) {
          if (tab === target || !list?.some(a => a.id === action.id)) continue;
          next[tab] = list.filter(a => a.id !== action.id);
        }
      }
      return next;
    });
  }

  // Per-step item count, used for tab count badges + guided gating.
  function stepCount(tab: EditorTab): number {
    switch (tab) {
      case "combat": return (tabsDraft.main ?? []).length + (tabsDraft.bonus ?? []).length;
      case "features": return (tabsDraft.features ?? []).length;
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
          <ProfileTab draft={profileDraft} onChange={setProfileDraft} ownerOptions={ownerOptions.filter(o => o.id !== actor.id)} companionOptions={companionOptions.filter(o => o.id !== actor.id)} hasSpells={(tabsDraft.spells ?? []).length > 0}
            bondOptions={BROKEN_CHAIN_BOND_TEMPLATES}
            characterLevel={actor.level ?? 1}
            canAssignBond={!proposeMode} />
        )}
        {activeTab === "combat" && (
          <CombatActionsTab
            mainActions={tabsDraft.main ?? []}
            bonusActions={tabsDraft.bonus ?? []}
            onChange={({ main, bonus }) => setTabsDraft(d => ({ ...d, main, bonus }))}
            resourceLabels={(tabsDraft.resources ?? []).map(r => r.label).filter(Boolean)}
            classRows={editorClassRows}
          />
        )}
        {activeTab === "features" && (
          <ActorEditorActionTab classRows={editorClassRows} tabId="features" actions={tabsDraft.features ?? []} onChange={handleTabActions("features")} onMoveToTab={handleMoveActionToTab} resourceLabels={(tabsDraft.resources ?? []).map(r => r.label).filter(Boolean)} />
        )}
        {activeTab === "bonds" && (
          <ActorEditorActionTab classRows={editorClassRows} tabId="bond" actions={tabsDraft.bond ?? []} onChange={handleTabActions("bond")} onMoveToTab={handleMoveActionToTab} resourceLabels={(tabsDraft.resources ?? []).map(r => r.label).filter(Boolean)} />
        )}
        {activeTab === "spells" && (
          <SpellTableEditor
            actions={tabsDraft.spells ?? []}
            onChange={handleTabActions("spells")}
            classRows={editorClassRows}
          />
        )}
        {activeTab === "resources" && (
          <>
            {/* AUTO-FILL FROM THE CLASS TABLE. Second Wind is 2 uses on a short rest for every
                Fighter alive, so typing it onto each one is copying a rule the app already
                knows. Same idea as weapon mastery: the class and level decide it.
                ⚠ ADDS ONLY WHAT IS MISSING, matched by label — an existing pool keeps its
                current count, because a half-spent Rage must not be silently refilled. */}
            {(() => {
              const rows = editorClassRows.length > 0
                ? editorClassRows
                : [{ name: profileDraft.className, level: Number(profileDraft.level) || 1 }];
              const granted = resourcesForClasses(rows);
              const existing = new Set((tabsDraft.resources ?? []).map(r => r.label?.toLowerCase()));
              const missing = granted.filter(g => !existing.has(g.label.toLowerCase()));
              if (granted.length === 0) return null;
              return (
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                  <button type="button" disabled={missing.length === 0}
                    onClick={() => handleTabActions("resources")([
                      ...(tabsDraft.resources ?? []),
                      ...missing.map(g => ({
                        id: `res-${slugifyForActionId(g.label)}`,
                        label: g.label,
                        actionKind: "resource" as const,
                        economyCost: [],
                        logMode: "silent" as const,
                        displayMode: "compact" as const,
                        category: "Resources",
                        tags: [],
                        metadata: {
                          resourceKind: g.kind,
                          cost: g.reset === "shortRest" ? "Short Rest" : g.reset === "longRest" ? "Long Rest" : g.reset,
                          details: [`Pool: ${g.max}`, `Reset: ${g.reset}`, g.note].filter(Boolean).join(" · "),
                          additive: String(g.max),
                        },
                      })),
                    ])}
                    style={{ fontSize: 11, padding: "4px 10px", borderRadius: 4, border: "1px solid #7b68ee",
                             background: missing.length ? "#2a3550" : "#111",
                             color: missing.length ? "#dfe4ff" : "#555", cursor: missing.length ? "pointer" : "default" }}>
                    {missing.length ? `Add ${missing.length} class resource${missing.length === 1 ? "" : "s"}` : "Class resources already present"}
                  </button>
                  <span style={{ fontSize: 10, color: "#667" }}>
                    {granted.map(g => `${g.label} ${g.max}`).join(" · ")}
                  </span>
                </div>
              );
            })()}
            <ResourceTableEditor
              actions={tabsDraft.resources ?? []}
              onChange={handleTabActions("resources")}
            />
          </>
        )}
        {activeTab === "feats" && (
          <ActorEditorActionTab classRows={editorClassRows} tabId="feats" actions={tabsDraft.feats ?? []} onChange={handleTabActions("feats")} onMoveToTab={handleMoveActionToTab} resourceLabels={(tabsDraft.resources ?? []).map(r => r.label).filter(Boolean)} />
        )}
        {activeTab === "equipment" && (
          <EquipmentBagEditor
            equippedActions={tabsDraft.equipment ?? []}
            mainActions={tabsDraft.main ?? []}
            // proposeMode IS the player-facing flow (the level-up request panel), so it is
            // the same question: is a player sitting here, or the DM?
            playerMode={proposeMode}
            onChange={(updates) => {
              setTabsDraft(d => ({ ...d, ...updates }));
            }}
          />
        )}
        {activeTab === "notes" && (
          <ActorEditorActionTab classRows={editorClassRows} tabId="notes" actions={tabsDraft.notes ?? []} onChange={handleTabActions("notes")} onMoveToTab={handleMoveActionToTab} />
        )}
      </div>

      {/* Save buttons */}
      <div style={{ padding: "10px 14px", borderTop: "1px solid #2a2a3e", display: "flex", flexDirection: "column", gap: 8 }}>
        {saveError && (
          <div style={{ background: "#3a1414", border: "1px solid #6e2a2a", borderRadius: 4, padding: "6px 10px", fontSize: 12, color: "#ff9999" }}>
            ⚠ {saveError}
          </div>
        )}
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
                onClick={() => attemptSave("current-and-library")}
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
              onClick={() => attemptSave("current")}
              style={{ flex: 1, padding: "7px 12px", background: "#7b68ee", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 13, fontWeight: 500 }}
            >
              {submitLabel}
            </button>
          ) : (
            /* DM mode — save now (escape hatch), override-only, and duplicate */
            <>
              <button
                type="button"
                onClick={() => attemptSave("current-and-library")}
                style={{ flex: 1, padding: "6px 12px", background: "transparent", color: "#9a9ab0", border: "1px solid #3a3a52", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
                title="Save to the library now without stepping through the rest of the flow"
              >
                Save now
              </button>
              <button
                type="button"
                onClick={() => attemptSave("current")}
                style={{ padding: "6px 12px", background: "transparent", color: "#888", border: "1px solid #444", borderRadius: 4, cursor: "pointer", fontSize: 11 }}
                title="Save as session override only — not written to base library (changes lost on next Sync)"
              >
                Override Only
              </button>
              <button
                type="button"
                onClick={() => attemptSave("duplicate", `${actor.id}-copy-${Date.now().toString(36)}`)}
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
