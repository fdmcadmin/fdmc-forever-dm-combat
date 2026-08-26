/**
 * Monster Template Editor — the Monster Gate WS-A stepper (A1–A7).
 *
 * Mirrors the PC creator's tabbed-stepper shape, for monsters. Both CREATE (band picker
 * scaffold) and EDIT open this editor, so every field here — including the three axes
 * (creatureType / archetype / classification) — is editable after creation.
 *
 * Steps:
 *   1 Identity   — name · kind · size · creature type · classification · archetype · visibility
 *   2 Abilities  — chassis-sourced scores, archetype REDISTRIBUTES the pool, manual override
 *   3 Defenses   — HP / AC / speed + band/pressure references (Apply, never silent)
 *   4 Actions    — attacks-per-turn budget, attacks, saves, recharge (first-class)
 *   5 Reactions  — true reactions (trigger + effect + optional save)
 *   6 Legendary  — N per round + per-option cost (stored in actions[] via legendaryCost)
 *   7 Spellcasting — slot pools per level, plus which spells are POOL candidates for them
 *   7 Traits & Resources — passives, trackers, notes
 *
 * Everything generated is a STARTING POINT — reference scaffolding, not a rules engine.
 */

import React, { useMemo, useState } from "react";
import type { MainMonsterTemplate, MainMonsterVisibilityState, MonsterArchetype, MonsterClassification, MonsterActionSet } from "./runtime/mainMonsterRuntime";
import { MONSTER_KINDS } from "./runtime/mainMonsterRuntime";
import type { MonsterReaderAction } from "./MonsterJconScanner";
import type { BondTemplate } from "../types/bond";
import { BOND_STAGE_NAMES } from "../types/bond";
import { resolveBondAtStage } from "../rules/bondProgress";
import {
  ABILITY_ORDER,
  ARCHETYPES,
  CLASSIFICATION_OPTIONS,
  CREATOR_BANDS,
  PRESSURE_OPTIONS,
  SIZE_OPTIONS,
  archetypeInfo,
  chassisFromTemplate,
  formatAbilityEntry,
  parseAbilityScore,
  redistributeAbilityEntries,
  scoresFromTemplate,
  creatureSaveDisplay,
  type CreatorBandId,
  type CreatorPressureId,
} from "./creator/monsterCreatorModel";
import { TRAIT_RULES, traitRule, EXPECTED_MONSTER_AC } from "../encounter-band/compactImport";
import { classifyTraits } from "../encounter-band/traitClassifier";
import { acMultiplierFor } from "../encounter-band/rosterFromLibrary";

// ─── Props ────────────────────────────────────────────────────────────────────

export type MonsterTemplateEditorProps = {
  template: MainMonsterTemplate;
  /** Library monsters offered as CHASSIS sources (scores + defenses). */
  chassisOptions?: MainMonsterTemplate[];
  /**
   * Bonds this campaign offers. A PROP, not an import — the editor is engine and the fourteen
   * Broken Chain bonds are mod content. A campaign with no bonds passes nothing and the section
   * does not render.
   */
  bondOptions?: BondTemplate[];
  /** Save target. `owner` says WHICH library — campaign content, or the DM's own. */
  onSave: (updated: MainMonsterTemplate, owner?: "campaign" | "dm") => void;
  /**
   * Show the campaign save target.
   *
   * The mod AUTHOR builds campaign creatures; an ordinary DM building their own monsters never
   * sees it and never has to think about the distinction. Without this, every creature built in
   * the app landed in "My Library" whatever the intent, and authoring a new act meant editing
   * campaign source by hand.
   */
  canSaveToCampaign?: boolean;
  onCancel: () => void;
  /**
   * Drop the DM's saved copy and go back to the shipped campaign creature.
   *
   * Supplied ONLY for a campaign creature that currently has an override — undefined otherwise,
   * so the control never offers to revert something that has nothing to revert to. It is not a
   * delete: the campaign template holds the same templateId and takes the slot straight back.
   */
  onRevertToCampaign?: () => void;
};

// ─── Step defs ────────────────────────────────────────────────────────────────

const STEPS = [
  { id: "identity", label: "1 · Identity", accent: "#7b68ee" },
  { id: "abilities", label: "2 · Abilities", accent: "#4f9dff" },
  { id: "defenses", label: "3 · Defenses", accent: "#34c759" },
  { id: "actions", label: "4 · Actions", accent: "#ff6b5e" },
  { id: "reactions", label: "5 · Reactions", accent: "#9be9a8" },
  { id: "legendary", label: "6 · Legendary", accent: "#f0c040" },
  { id: "spells", label: "7 · Spellcasting", accent: "#9d8cff" },
  { id: "extras", label: "8 · Traits & Resources", accent: "#e07bff" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

const visibilityOptions: { value: MainMonsterVisibilityState; label: string }[] = [
  { value: "hidden", label: "Hidden" },
  { value: "label-only", label: "Label Only" },
  { value: "condition", label: "Show Condition" },
  { value: "hp-bar", label: "Show HP Bar" },
  { value: "full", label: "Full Reveal" },
];


// ─── Shared styles ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = { padding: "3px 7px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff", fontSize: 11, width: "100%" };
const labelStyle: React.CSSProperties = { fontSize: 10, color: "#666", marginBottom: 1, display: "block" };
const hintStyle: React.CSSProperties = { fontSize: 10, color: "#667", lineHeight: 1.5, margin: "4px 0 10px" };
const rowStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 3, background: "#0d0d14", borderRadius: 4, padding: "6px 8px", marginBottom: 4 };

function SmallBtn({ onClick, children, color = "#7b68ee", title }: { onClick: () => void; children: React.ReactNode; color?: string; title?: string }) {
  return (
    <button type="button" onClick={onClick} title={title}
      style={{ fontSize: 10, padding: "2px 8px", background: `${color}22`, border: `1px solid ${color}55`, borderRadius: 3, color, cursor: "pointer" }}>
      {children}
    </button>
  );
}

// ─── Editor ───────────────────────────────────────────────────────────────────

export function MonsterTemplateEditor({ template, chassisOptions = [], bondOptions = [], onSave, onCancel, onRevertToCampaign, canSaveToCampaign = false }: MonsterTemplateEditorProps) {
  const [draft, setDraft] = useState<MainMonsterTemplate>(() => JSON.parse(JSON.stringify(template)));
  const [step, setStep] = useState<StepId>("identity");
  const [chassisId, setChassisId] = useState<string>("");
  const [scoreArray, setScoreArray] = useState<string>("");
  const [refBand, setRefBand] = useState<CreatorBandId>("mid");
  const [refPressure, setRefPressure] = useState<CreatorPressureId>("standard");

  /**
   * The creature estimator no longer lives here — it MEASURES a creature rather than helping
   * build one. See `CreatureEstimatorPanel`, which runs the same parse + trace pair so the
   * estimate and the encounter check still cannot disagree about what a creature does.
   */

  function updateStat<K extends keyof MainMonsterTemplate["stats"]>(key: K, val: MainMonsterTemplate["stats"][K]) {
    setDraft(d => ({ ...d, stats: { ...d.stats, [key]: val } }));
  }

  // ── Actions plumbing — legendary actions live in actions[] tagged legendaryCost ──

  /**
   * One `actions[]` array, three views. A row must appear in exactly ONE step or the same
   * action is editable from two places and the DM cannot tell which they are looking at —
   * so a slot-costed spell leaves the Actions list the moment it becomes one.
   */
  /**
   * ⚠ A SPELL IS A SPELL BY KIND, not by whether it spends a slot.
   *
   * Christopher: *"the claw and bolt are the actions, the 18 are all spells that need to be set
   * because set is what determines the spells section."* The Elemental Mirror's eighteen are
   * 1/day, at-will and 3/day — none of them slot-costed — so filtering step 7 on spellSlotLevel
   * left every one of them in the ACTIONS list beside Claws and Bolt, which is exactly the
   * confusion this split exists to prevent.
   */
  const isSpellRow = (a: MonsterReaderAction) => a.kind === "spell" || typeof a.spellSlotLevel === "number";
  const standardActions = useMemo(() => draft.actions.map((a, i) => ({ a, i })).filter(({ a }) => !a.legendaryCost && !isSpellRow(a)), [draft.actions]);
  const legendaryActions = useMemo(() => draft.actions.map((a, i) => ({ a, i })).filter(({ a }) => !!a.legendaryCost), [draft.actions]);
  const slotSpells = useMemo(() => draft.actions.map((a, i) => ({ a, i })).filter(({ a }) => !a.legendaryCost && isSpellRow(a)), [draft.actions]);

  /**
   * Pick a calibrated defensive trait. The multiplier is READ from the workbook rule, never
   * typed — see the Defenses tab for why. A rule the workbook leaves unpriced stores 1 and is
   * flagged downstream rather than silently weighted.
   */
  function selectDefense(idx: number, label: string) {
    const rule = traitRule(label);
    setDraft(d => ({
      ...d,
      stats: {
        ...d.stats,
        defenses: (d.stats.defenses ?? []).map((x, i) => (i === idx
          /**
           * ⚠ THE OLD RULE AND PROVENANCE MUST GO WITH THE OLD TRAIT. This spread `...x` and then
           * overwrote name, multiplier and note — leaving `rule` and `provenance` behind,
           * describing a trait that is no longer selected.
           *
           * That is exactly what blocked the Veilbound Drake Guard's publish: its "Resistance -
           * ~50% of opposing damage" carried the correct x1.341834 and a `rule` reading "First
           * attack each round at disadvantage", left over from an earlier pick. The coverage gate
           * refused it, correctly — a defence naming one rule and priced by another has no
           * single answer to where its number came from.
           *
           * Picking from this list IS naming the rule, so `rule` is set to the label rather than
           * cleared, and `provenance` goes because a calibrated pick needs none.
           */
          ? { ...x, name: label, rule: label, provenance: undefined, ehpMultiplier: rule?.multiplier ?? 1, note: rule?.application }
          : x)),
      },
    }));
  }
  function addDefense() {
    setDraft(d => ({
      ...d,
      stats: { ...d.stats, defenses: [...(d.stats.defenses ?? []), { name: "", ehpMultiplier: 1 }] },
    }));
  }
  function removeDefense(idx: number) {
    setDraft(d => ({ ...d, stats: { ...d.stats, defenses: (d.stats.defenses ?? []).filter((_, i) => i !== idx) } }));
  }

  /**
   * Read the traits and reactions already written, and add the calibrated rules they name.
   *
   * ⚠ IT ADDS, IT NEVER OVERWRITES. A defence the author already chose stays exactly as chosen —
   * this only fills in what is missing, and skips any stack group already claimed so it cannot
   * double-count an effect that is already priced.
   *
   * ⚠ EVERY ADDITION CARRIES THE PHRASE IT MATCHED ON, in the note, because that is the whole
   * difference between reading and guessing. The author can see what it read and delete it.
   */
  function addDamageResponse() {
    setDraft(d => ({
      ...d,
      stats: { ...d.stats, damageResponses: [...(d.stats.damageResponses ?? []), { type: "", response: "resistant" as const }] },
    }));
  }
  function updateDamageResponse(idx: number, patch: Partial<{ type: string; response: "resistant" | "immune" | "vulnerable"; qualifier: string; share: number | undefined }>) {
    setDraft(d => ({
      ...d,
      stats: {
        ...d.stats,
        damageResponses: (d.stats.damageResponses ?? []).map((r, i) => (i === idx ? { ...r, ...patch } : r)),
      },
    }));
  }
  function removeDamageResponse(idx: number) {
    setDraft(d => ({
      ...d,
      stats: { ...d.stats, damageResponses: (d.stats.damageResponses ?? []).filter((_, i) => i !== idx) },
    }));
  }

  function readDefensesFromTraits() {
    setDraft(d => {
      const existing = d.stats.defenses ?? [];
      const claimed = new Set(existing.map(x => traitRule(x.name)?.stack_group ?? x.name).filter(Boolean));
      const found = classifyTraits({ traits: d.traits ?? [], reactions: d.reactions ?? [] });
      const additions = found
        .filter(m => !claimed.has(m.rule.stack_group ?? m.label) && !existing.some(x => x.name === m.label))
        .map(m => ({
          name: m.label,
          ehpMultiplier: m.rule.multiplier ?? 1,
          note: `Read from "${m.traitName}" (${m.from}) on "${m.evidence}".`
            + (m.rule.multiplier == null ? " The workbook calibrates this rule as UNPRICED — it is a real trait with no published weight." : ""),
        }));
      if (additions.length === 0) return d;
      return { ...d, stats: { ...d.stats, defenses: [...existing, ...additions] } };
    });
  }

  /** Skills — per-creature, because two creatures at the same CR are not good at the same things. */
  function updateSkill(idx: number, patch: Partial<{ label: string; modifier: number }>) {
    setDraft(d => ({
      ...d,
      stats: { ...d.stats, skills: (d.stats.skills ?? []).map((x, i) => (i === idx ? { ...x, ...patch } : x)) },
    }));
  }
  function addSkill() {
    setDraft(d => ({ ...d, stats: { ...d.stats, skills: [...(d.stats.skills ?? []), { label: "", modifier: 0 }] } }));
  }
  function removeSkill(idx: number) {
    setDraft(d => ({ ...d, stats: { ...d.stats, skills: (d.stats.skills ?? []).filter((_, i) => i !== idx) } }));
  }

  function updateListItem(list: "actions" | "traits" | "reactions", idx: number, patch: Partial<MonsterReaderAction>) {
    setDraft(d => {
      const next = [...d[list]];
      next[idx] = { ...next[idx], ...patch };
      return { ...d, [list]: next };
    });
  }

  function addListItem(list: "actions" | "traits" | "reactions", item: MonsterReaderAction) {
    setDraft(d => ({ ...d, [list]: [...d[list], item] }));
  }

  function removeListItem(list: "actions" | "traits" | "reactions", idx: number) {
    setDraft(d => ({ ...d, [list]: d[list].filter((_, i) => i !== idx) }));
  }

  // ── Abilities plumbing ──

  const scores = useMemo(() => scoresFromTemplate(draft.abilities), [draft.abilities]);

  function setScore(label: string, score: number) {
    setDraft(d => {
      const entries = ABILITY_ORDER.map(l => {
        const current = d.abilities.find(a => a.label.toUpperCase().startsWith(l));
        const s = l === label ? score : current ? parseAbilityScore(current.value) : 10;
        /**
         * ⚠ CARRY THE SAVE FIELDS THROUGH. `formatAbilityEntry` returns ONLY `{label, value}`, and
         * this rebuilds all six entries from it on every keystroke — so without the spread,
         * ticking a save proficiency and then nudging any score wiped all six ticks. Silent, and
         * invisible until the checker priced a boss as though it were not proficient.
         *
         * Same shape as the actor-tabs data loss: a rebuild that reconstructs a record from a
         * partial factory drops whatever the factory does not know about.
         */
        return { ...(current ?? {}), ...formatAbilityEntry(l, s) };
      });
      return { ...d, abilities: entries };
    });
  }

  /**
   * Tick or untick save proficiency for one ability.
   *
   * Stores the FLAG, never a computed number — the modifier follows the score and the CR on its
   * own, exactly as it does on a player sheet. An explicit `save` still overrides it.
   */
  /**
   * Tick or untick a save proficiency.
   *
   * ⚠ TICKING CLEARS THE AUTHORED NUMBER, and it has to. `creatureSaveDisplay` prefers an
   * explicit `save` over anything derived, so leaving one behind made the tick cosmetic: the box
   * changed and the number did not. Ticking means "derive this from the score and the proficiency
   * bonus", so the override it replaces must go.
   *
   * The override is not lost silently — it is shown in its own field beside the tick, and typing
   * it back in restores it. See `setSaveExplicit`.
   */
  function setSaveProficient(label: string, proficient: boolean) {
    setDraft(d => {
      const entries = ABILITY_ORDER.map(l => {
        const current: MainMonsterTemplate["abilities"][number] =
          d.abilities.find(a => a.label.toUpperCase().startsWith(l)) ?? formatAbilityEntry(l, 10);
        if (l !== label) return current;
        const next = { ...current };
        if (proficient) next.saveProficient = true;
        else delete next.saveProficient;
        delete next.save;
        return next;
      });
      return { ...d, abilities: entries };
    });
  }

  /**
   * Pin an explicit save, or clear it back to the derived one.
   *
   * ⚠ THIS IS THE CONTROL THAT WAS MISSING, and its absence was a trap. The tick used to be
   * DISABLED whenever a save matched neither the bare modifier nor modifier + proficiency — which
   * is exactly when a DM needs to change it. Christopher, on the Veil-Torn Dragon: *"i cant
   * override it because the con box only opens if the cr is 9 but then the cha and wis turn off."*
   *
   * He was right, and no CR could have fixed it: CON +5/save 9 implies a proficiency bonus of 4,
   * while WIS +5/save 8 and CHA +6/save 9 both imply 3. One creature, two bonuses, so every CR
   * left something locked. The tick is never disabled now, and this field is how a genuinely
   * bespoke save is set or removed. Blank means derived.
   */
  function setSaveExplicit(label: string, raw: string) {
    setDraft(d => {
      const entries = ABILITY_ORDER.map(l => {
        const current: MainMonsterTemplate["abilities"][number] =
          d.abilities.find(a => a.label.toUpperCase().startsWith(l)) ?? formatAbilityEntry(l, 10);
        if (l !== label) return current;
        const next = { ...current };
        const value = Number.parseInt(raw, 10);
        // A save of 0 is meaningful — CHA 10 with no proficiency — so test for a finite number
        // rather than truthiness, and treat a blank field as "no override" rather than zero.
        if (Number.isFinite(value)) next.save = value;
        else delete next.save;
        return next;
      });
      return { ...d, abilities: entries };
    });
  }

  function loadChassis(templateId: string) {
    const source = chassisOptions.find(t => t.templateId === templateId);
    if (!source) return;
    const payload = chassisFromTemplate(source);
    setDraft(d => ({
      ...d,
      abilities: payload.abilities,
      stats: { ...d.stats, ac: payload.ac, maxHp: payload.maxHp, speed: payload.speed },
    }));
  }

  /**
   * Deal a typed array into the six abilities.
   *
   * Six numbers or nothing happens — a partial array would silently leave some scores from a
   * previous creature in place, which is exactly the half-corrected state this control exists
   * to remove. AC, HP and speed are deliberately untouched: the array answers "what are its
   * scores", not "what creature is this".
   */
  function applyScoreArray() {
    const nums = (scoreArray.match(/\d+/g) ?? []).map(Number);
    if (nums.length !== 6) return;
    const dealt = ABILITY_ORDER.map((label, i) => formatAbilityEntry(label, nums[i]));
    setDraft(d => ({
      ...d,
      abilities: d.stats.archetype ? redistributeAbilityEntries(dealt, d.stats.archetype) : dealt,
    }));
  }

  function reshapeByArchetype() {
    if (!draft.stats.archetype) return;
    setDraft(d => ({ ...d, abilities: redistributeAbilityEntries(d.abilities, d.stats.archetype as MonsterArchetype) }));
  }

  // ── Row renderers ──

  function actionRow(list: "actions" | "traits" | "reactions", a: MonsterReaderAction, realIdx: number, opts: { legendary?: boolean; reaction?: boolean; spell?: boolean } = {}) {
    return (
      <div key={realIdx} style={rowStyle}>
        <div style={{ display: "flex", gap: 4 }}>
          <div style={{ flex: 2 }}>
            <span style={labelStyle}>Name</span>
            <input value={a.name} onChange={e => updateListItem(list, realIdx, { name: e.target.value })} style={inputStyle} />
          </div>
          {opts.legendary && (
            <div style={{ width: 62 }}>
              <span style={labelStyle}>Cost</span>
              <select value={a.legendaryCost ?? 1} onChange={e => updateListItem(list, realIdx, { legendaryCost: Number(e.target.value) })} style={inputStyle}>
                <option value={1}>1</option>
                <option value={2}>2</option>
              </select>
            </div>
          )}
          {!opts.reaction && (
            <>
              <div style={{ flex: 1 }}>
                <span style={labelStyle}>Roll</span>
                <input value={a.roll ?? ""} onChange={e => updateListItem(list, realIdx, { roll: e.target.value })} placeholder="1d20+4" style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <span style={labelStyle}>Dmg</span>
                <input value={a.damage ?? ""} onChange={e => updateListItem(list, realIdx, { damage: e.target.value })} placeholder="1d6+2" style={inputStyle} />
              </div>
            </>
          )}
          <div style={{ flex: 1 }}>
            <span style={labelStyle}>Save</span>
            <input value={a.save ?? ""} onChange={e => updateListItem(list, realIdx, { save: e.target.value })} placeholder="DEX DC 13" style={inputStyle} />
          </div>
          {/* ⚠ THE TWO FIELDS THE CHECKER OTHERWISE HAS TO GUESS.
              Christopher: *"there is no reason the PC looks so good and the creatures are all
              still text."* The PC side authors targets and success damage as DATA; the monster
              side left both in prose, so the checker parsed the sentence and reported an
              ESTIMATE. These make the same facts printed.

              Both blank is a legitimate state and stays supported: the checker falls back to
              reading the action text, prices an area against the party, and says it estimated. */}
          <div style={{ width: 62 }}>
            <span style={labelStyle}>Targets</span>
            <input type="number" min={1} value={a.targets ?? ""} placeholder="auto"
              onChange={e => updateListItem(list, realIdx, { targets: e.target.value ? Math.max(1, Number(e.target.value)) : undefined })}
              style={inputStyle}
              title="How many creatures this hits. Blank = single target, or an area priced against the party. Setting it turns the checker's estimate into a printed fact." />
          </div>
          {/* ── RANGE — ONE FIELD, AS ON THE PC SIDE ─────────────────────────────────────
              ⚠ THIS WAS THREE FIELDS AND SHOULD NEVER HAVE BEEN. Christopher, 2026-08-20:
              *"why is there a need to have reach feet, range ft and push/pull ft, this isnt how
              we designed the player side, the size of a creature should determine most of these,
              and then the action should have the range of that action, just like the PC side
              does."*

              He is right on both counts, and I broke the same rule twice in one row:

                · The PC action editor has ONE "Range" box — "5 ft, 120 ft…" — because an action
                  has A range. Splitting it into reach-vs-range made the DM classify the action
                  before typing a number, and the row grew three columns wide for one fact.
                · PUSH/PULL IS NOT AN AUTHORED FIELD. It is a consequence written in the action
                  text, and the parser reads it. Adding a box for it was RULE 1A applied
                  literally again — a schema field is not a reason to expose a control.

              Occupied space comes from creature SIZE, which is already authored in step 1. The
              parser derives reach/range feet from this string, so reachability pricing is
              unchanged — it just stops asking the DM to do the classifying. */}
          <div style={{ flex: 1, minWidth: 90 }}>
            <span style={labelStyle}>Range</span>
            <input value={a.range ?? ""} onChange={e => updateListItem(list, realIdx, { range: e.target.value || undefined })}
              placeholder="5 ft, 120 ft..." style={inputStyle}
              title="This action's reach or range, exactly as the PC sheet takes it. Occupied space comes from the creature's size; this is how far the action itself goes. Blank reads it from the action text." /></div>
          {(a.save ?? "").trim() !== "" && (
            <div style={{ width: 92 }}>
              <span style={labelStyle}>On a save</span>
              <select value={a.onSave ?? ""} onChange={e => updateListItem(list, realIdx, { onSave: (e.target.value || undefined) as MonsterReaderAction["onSave"] })}
                style={inputStyle}
                title="What a SUCCESSFUL save still takes. Half is never assumed — plenty of saves are all-or-nothing.">
                <option value="">— read text —</option>
                <option value="half">Half damage</option>
                <option value="none">No damage</option>
                <option value="custom">Printed amount</option>
              </select>
            </div>
          )}
          {a.onSave === "custom" && (
            <div style={{ width: 70 }}>
              <span style={labelStyle}>On success</span>
              <input value={a.successDamage ?? ""} onChange={e => updateListItem(list, realIdx, { successDamage: e.target.value || undefined })}
                placeholder="2d6" style={inputStyle} />
            </div>
          )}
          {(draft.actionSets?.length ?? 0) > 0 && !opts.legendary && list === "actions" && (
            <div style={{ width: 96 }}>
              <span style={labelStyle}>Set</span>
              <select value={a.setId ?? ""} style={inputStyle}
                title="Put this action in a pool. Each body picks the set's stated number from its candidates, and a picked action leaves the pool for the others."
                onChange={e => updateListItem(list, realIdx, { setId: e.target.value || undefined })}>
                <option value="">— always on —</option>
                {(draft.actionSets ?? []).map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
          )}
          {/*
            THE OPTION — which package this action belongs to.
            
            An option is often a BUNDLE. The Elemental Mirror's element pick is one of six
            packages and each carries three spells: eighteen actions, six choices. Actions
            sharing a set AND an option are taken or left together, so picking "Earth" brings
            all three Earth spells.
            
            Blank means the action is its own option, named for itself — the right shape for
            "two attacks out of five", where every candidate is a single action.
          */}
          {a.setId && !opts.legendary && list === "actions" && (
            <div style={{ width: 92 }}>
              <span style={labelStyle}>Option</span>
              <input value={a.setOption ?? ""} style={inputStyle} placeholder={a.name || "(own)"}
                title="Group several actions into ONE choice by giving them the same option name — an element package carrying three spells. Blank = this action is its own option."
                onChange={e => updateListItem(list, realIdx, { setOption: e.target.value || undefined })} />
            </div>
          )}
          {!opts.legendary && !opts.reaction && !opts.spell && list === "actions" && (
            <div style={{ width: 70 }}>
              <span style={labelStyle}>Recharge</span>
              <input value={a.recharge ?? ""} onChange={e => updateListItem(list, realIdx, { recharge: e.target.value })} placeholder="5-6" style={inputStyle} title="Recharge range, e.g. '6' or '5-6'" />
            </div>
          )}
          {/*
            SPELLCASTING — RULE ZERO. Both of these existed in the type and in NO editor, so a
            creature that spends spell slots could only be built by hand-editing code. A DM
            authoring their own caster could not express "this costs a level 2 slot" at all.

            Slot = which pool the action spends. Pool = the spell is a CANDIDATE for that slot
            rather than always live, so an authored caster can carry more spells than it brings
            to any one fight and the DM chooses at generation.
          */}
          {opts.spell && (
            <>
              <div style={{ width: 62 }}>
                <span style={labelStyle}>Slot</span>
                <select value={a.spellSlotLevel ?? ""} style={inputStyle}
                  title="Spell-slot level this action spends. Blank = costs no slot."
                  onChange={e => updateListItem(list, realIdx, {
                    spellSlotLevel: e.target.value ? Number(e.target.value) : undefined,
                    // A spell that costs no slot cannot be a candidate FOR one.
                    ...(e.target.value ? {} : { slotCandidate: undefined }),
                  })}>
                  <option value="">—</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(l => <option key={l} value={l}>L{l}</option>)}
                </select>
              </div>
              {typeof a.spellSlotLevel === "number" && (
                <label style={{ width: 54, alignSelf: "flex-end", display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "#9d8cff", cursor: "pointer", paddingBottom: 4 }}
                  title="Pool candidate — the creature MAY bring this spell. The DM picks which candidates fill its slots when the creature is generated, and a picked spell leaves the pool for the other slots at that level. Unticked = always available.">
                  <input type="checkbox" checked={Boolean(a.slotCandidate)}
                    onChange={e => updateListItem(list, realIdx, { slotCandidate: e.target.checked || undefined })} />
                  Pool
                </label>
              )}
            </>
          )}
          <button type="button" onClick={() => removeListItem(list, realIdx)}
            style={{ alignSelf: "flex-end", fontSize: 10, padding: "2px 5px", background: "transparent", border: "1px solid #5a1a1a", borderRadius: 3, color: "#ff9999", cursor: "pointer" }}>✕</button>
        </div>
        <div>
          <span style={labelStyle}>{opts.reaction ? "Trigger + effect" : "Text"}</span>
          <input value={a.text ?? ""} onChange={e => updateListItem(list, realIdx, { text: e.target.value })}
            placeholder={opts.reaction ? "Trigger: … Effect: …" : undefined} style={inputStyle} />
        </div>
      </div>
    );
  }

  // ── Step bodies ──

  function renderIdentity() {
    return (
      <>
        <p style={hintStyle}>What it IS (kind — its D&amp;D creature type), how BIG a threat it is (classification), and how it FIGHTS (archetype). Three separate questions, three separate fields. Kind no longer carries threat: a Boss is an <em>elite / act-boss classification</em>, not a kind.</p>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 2 }}>
            <span style={labelStyle}>Name</span>
            <input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} style={{ ...inputStyle, fontSize: 13, fontWeight: 500 }} />
          </div>
          <div style={{ flex: 1 }}>
            <span style={labelStyle}>Kind (creature type)</span>
            <select value={draft.stats.kind} onChange={e => updateStat("kind", e.target.value as MainMonsterTemplate["stats"]["kind"])} style={inputStyle}>
              {MONSTER_KINDS.map(k => (
                <option key={k} value={k}>
                  {k === "unspecified" ? "— not set —" : k === "npc" ? "NPC" : k[0].toUpperCase() + k.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <span style={labelStyle}>Size</span>
            <select value={draft.stats.size ?? ""} onChange={e => updateStat("size", e.target.value || undefined)} style={inputStyle}>
              <option value="">—</option>
              {SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <span style={labelStyle}>Classification (fight length)</span>
            <select value={draft.stats.classification ?? "normal"}
              onChange={e => updateStat("classification", e.target.value === "normal" ? undefined : e.target.value as MonsterClassification)} style={inputStyle}>
              {CLASSIFICATION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <p style={{ ...hintStyle, margin: "3px 0 0" }}>
              {CLASSIFICATION_OPTIONS.find(o => o.value === (draft.stats.classification ?? "normal"))?.blurb}
            </p>
          </div>
          <div style={{ flex: 1 }}>
            <span style={labelStyle}>Archetype (fighting style)</span>
            <select value={draft.stats.archetype ?? ""} onChange={e => updateStat("archetype", (e.target.value || undefined) as MonsterArchetype | undefined)} style={inputStyle}>
              <option value="">—</option>
              {ARCHETYPES.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
            <p style={{ ...hintStyle, margin: "3px 0 0" }}>
              {draft.stats.archetype ? archetypeInfo(draft.stats.archetype).blurb : "Optional — used by step 2 to reshape the chassis's scores."}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <span style={labelStyle}>Default Visibility</span>
            <select value={draft.visibility.defaultState}
              onChange={e => setDraft(d => ({ ...d, visibility: { ...d.visibility, defaultState: e.target.value as MainMonsterVisibilityState } }))} style={inputStyle}>
              {visibilityOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <span style={labelStyle}>Hidden Name</span>
            <input value={draft.visibility.hiddenName}
              onChange={e => setDraft(d => ({ ...d, visibility: { ...d.visibility, hiddenName: e.target.value } }))} style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <span style={labelStyle}>Revealed Name</span>
            <input value={draft.visibility.revealedName}
              onChange={e => setDraft(d => ({ ...d, visibility: { ...d.visibility, revealedName: e.target.value } }))} placeholder="(defaults to Name)" style={inputStyle} />
          </div>
        </div>
        {/*
          A TEMPLATE CREATURE. Christopher: *"ensure that the create a templet creature is a DM
          possible, and the way it needs to be handled is the DM say this is a one of them"*.
          A template is never dropped on the map raw — bodies are generated from it, one per
          adventurer, each differing by its own picks. RULE 2: a DM builds this, not the source.
        */}
        <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: 12, color: "#9d8cff", cursor: "pointer" }}
          title="A template is not used as a stat block itself — one body is built from it per party member, each taking its own picks from the action sets in step 4.">
          <input type="checkbox" checked={Boolean(draft.isTemplate)}
            onChange={e => setDraft(d => ({ ...d, isTemplate: e.target.checked || undefined }))} />
          This is a TEMPLATE — build one of these per party member
        </label>
        {renderCreatureBond()}
      </>
    );
  }

  /**
   * ACTION SETS — a pool of options and how many of them each body takes.
   *
   * *"on veritable actions like the spells there needs to be a how many of these types of actions
   * are able to be chosen for this action set."* This is the ABS-array pattern applied to
   * actions: the template lists every option, a body takes `pick` of them, and a taken option
   * leaves the pool so two bodies differ.
   *
   * Distinct from spell slots on purpose. A slot-costed spell pools by LEVEL because the ruleset
   * counts slots; a set is for pools nothing counts — a mirror's two attacks out of five.
   */
  function renderActionSets() {
    const sets = draft.actionSets ?? [];
    const setSets = (next: MonsterActionSet[]) => setDraft(d => ({ ...d, actionSets: next.length ? next : undefined }));
    // Count OPTIONS, not actions: six element packages of three spells are six choices, not
    // eighteen, and reporting eighteen would tell the DM a "pick 1" set was well stocked when
    // it is exactly as stocked as the packages are.
    /** The distinct option names authored into a set, in first-seen order. */
    const optionsIn = (id: string) => {
      const seen: string[] = [];
      for (const a of draft.actions) {
        if (a.setId !== id) continue;
        const key = a.setOption?.trim() || a.name;
        if (key && !seen.includes(key)) seen.push(key);
      }
      return seen;
    };
    // "primary=earth, secondary=radiant" <-> { primary: "earth", secondary: "radiant" }
    const varsToText = (v?: Record<string, string>) =>
      Object.entries(v ?? {}).map(([k, val]) => `${k}=${val}`).join(", ");
    const textToVars = (s: string) => {
      const out: Record<string, string> = {};
      for (const part of s.split(",")) {
        const [k, ...rest] = part.split("=");
        const key = k.trim();
        if (key && rest.length) out[key] = rest.join("=").trim();
      }
      return out;
    };
    const countIn = (id: string) =>
      new Set(draft.actions.filter(a => a.setId === id).map(a => a.setOption?.trim() || a.name)).size;
    return (
      <div style={{ marginBottom: 12, padding: "8px 10px", background: "#12101f", border: "1px solid #2a2a3e", borderRadius: 4 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#9d8cff" }}>
            Action sets <span style={{ color: "#666", fontWeight: 400 }}>— pools each body picks from</span>
          </span>
          <SmallBtn color="#7b68ee" onClick={() => setSets([...sets, { id: `set${sets.length + 1}`, label: "New set", pick: 1 }])}>+ Set</SmallBtn>
        </div>
        {sets.some(s => s.namesBody) && (
          <label style={{ display: "block", fontSize: 10, color: "#888", marginBottom: 6 }}>
            Body name format <span style={{ color: "#666" }}>— {"{pick}"} is the chosen option, {"{name}"} this template</span>
            <input value={draft.bodyNameFormat ?? ""} placeholder="{pick} Mirror" style={inputStyle}
              onChange={e => setDraft(d => ({ ...d, bodyNameFormat: e.target.value || undefined }))} />
          </label>
        )}
        {sets.length === 0 && (
          <p style={{ fontSize: 11, color: "#555", fontStyle: "italic", margin: 0 }}>
            No sets — every action below is simply on the creature. Add one to make a pool.
          </p>
        )}
        {sets.map((s, i) => {
          const have = countIn(s.id);
          // Asking for more than exists can never be filled: picks are distinct, so the extra
          // slots sit empty forever and block generation. Say so here, not at spawn time.
          const short = s.pick > have && have > 0;
          return (
            <React.Fragment key={s.id}>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 5 }}>
              <div style={{ flex: 1 }}>
                <span style={labelStyle}>Set name</span>
                <input value={s.label} style={inputStyle}
                  onChange={e => setSets(sets.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
              </div>
              <label style={{ width: 58, alignSelf: "flex-end", display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "#9d8cff", cursor: "pointer", paddingBottom: 5 }}
                title="This set names the body. An Earth Mirror is called that because it took the Earth package — the name is derived from the pick, never typed.">
                <input type="checkbox" checked={Boolean(s.namesBody)}
                  onChange={e => setSets(sets.map((x, j) => j === i ? { ...x, namesBody: e.target.checked || undefined } : x))} />
                Names
              </label>
              <div style={{ width: 70 }}>
                <span style={labelStyle}>Pick</span>
                <input type="number" min={1} value={s.pick} style={inputStyle}
                  onChange={e => setSets(sets.map((x, j) => j === i ? { ...x, pick: Math.max(1, Number(e.target.value) || 1) } : x))} />
              </div>
              <span style={{ flex: 1, fontSize: 10, color: short ? "#ff9999" : "#666", paddingBottom: 5 }}>
                {have === 0
                  ? "no actions in this set yet — tag them below"
                  : short
                    ? `only ${have} candidate${have === 1 ? "" : "s"} for ${s.pick} picks — add ${s.pick - have} more`
                    : `${have} candidates → each body picks ${s.pick}`}
              </span>
              <button type="button"
                onClick={() => {
                  // Untag the actions too, or they keep pointing at a set that no longer exists
                  // and quietly vanish from every generated body.
                  setDraft(d => ({
                    ...d,
                    actionSets: sets.filter((_, j) => j !== i).length ? sets.filter((_, j) => j !== i) : undefined,
                    actions: d.actions.map(a => a.setId === s.id ? { ...a, setId: undefined } : a),
                  }));
                }}
                style={{ fontSize: 10, padding: "2px 5px", background: "transparent", border: "1px solid #5a1a1a", borderRadius: 3, color: "#ff9999", cursor: "pointer" }}>✕</button>
            </div>
              {/*
                PER-OPTION VALUES. An option supplies facts, not just actions: the element decides
                the Claws' damage type and the Guard's immunities. Authoring six Claws and six
                Guards would be twelve chances to get one wrong — so one Claws reads "2d6 {primary}"
                and each option says what {primary} is.
              */}
              {optionsIn(s.id).length > 0 && (
                <div style={{ marginBottom: 8, paddingLeft: 8, borderLeft: "2px solid #2a2a3e" }}>
                  {optionsIn(s.id).map(opt => (
                    <div key={opt} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 3 }}>
                      <span style={{ fontSize: 10, color: "#9d8cff", width: 96, flexShrink: 0 }}>{opt}</span>
                      <input
                        value={varsToText(s.optionVars?.[opt])}
                        placeholder="primary=earth, secondary=radiant"
                        title="Values this option supplies. Any action may use them as {primary} in its damage, save, text or name."
                        onChange={e => setSets(sets.map((x, j) => j === i
                          ? { ...x, optionVars: { ...(x.optionVars ?? {}), [opt]: textToVars(e.target.value) } }
                          : x))}
                        style={{ ...inputStyle, fontSize: 10 }} />
                    </div>
                  ))}
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  /**
   * A BOND ON A CREATURE — the Elemental Mirrors' third choice.
   *
   * *"The Wood builds one mirror for each adventurer"*, each assembled from an archetype, an
   * elemental pair, and **one legal inherent Bond and its Metamorphosis path**. Archetype was
   * already authorable (step 2 reshapes the chassis by it); the bond had no field anywhere, so a
   * mirror could not be finished in the creator at all — RULE 2.
   *
   * The stage is EXPLICIT here, unlike a character's. A PC's stage comes from level (3/6/9/13);
   * a creature is built at a stage and never advances, so this is the fact rather than a copy of
   * one. Mirrors are built at Metamorphosis, which is also where the path becomes required.
   *
   * Renders nothing when the campaign ships no bonds — this is engine, and a mod without bonds
   * should not grow an empty control.
   */
  function renderCreatureBond() {
    if (bondOptions.length === 0) return null;
    const bond = draft.bond;
    const tpl = bond ? bondOptions.find(b => b.id === bond.templateId) : undefined;
    const stage = bond?.stage ?? 2;
    const needsPath = stage >= 2;
    const resolved = tpl ? resolveBondAtStage(tpl, bond?.chosenPathIndex, stage) : undefined;
    const pathNames = tpl?.stages[stage]?.paths ?? [];

    const setBond = (next: MainMonsterTemplate["bond"]) => setDraft(d => ({ ...d, bond: next }));

    return (
      <div style={{ marginTop: 10, padding: "8px 10px", background: "#12101f", border: "1px solid #2a2a3e", borderRadius: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#9d8cff", marginBottom: 6 }}>
          Bond <span style={{ color: "#666", fontWeight: 400 }}>— a creature that carries one, like an Elemental Mirror</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <span style={labelStyle}>Bond</span>
            <select value={bond?.templateId ?? ""} style={inputStyle}
              onChange={e => setBond(e.target.value
                // Changing the bond CLEARS the path — a path index means nothing against a
                // different bond's two options, and silently keeping it would pick one at random.
                ? { templateId: e.target.value, stage: (bond?.stage ?? 2) as 0 | 1 | 2 | 3 | 4 }
                : undefined)}>
              <option value="">— none —</option>
              {bondOptions.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          {bond && (
            <div style={{ width: 132 }}>
              <span style={labelStyle}>Stage</span>
              <select value={stage} style={inputStyle}
                onChange={e => {
                  const s = Number(e.target.value) as 0 | 1 | 2 | 3 | 4;
                  // Dropping below Metamorphosis drops the path with it — there is no path to
                  // hold at Instinct or Realized, and keeping a stale one would resurface if the
                  // stage went back up.
                  setBond({ ...bond, stage: s, ...(s >= 2 ? {} : { chosenPathIndex: undefined }) });
                }}>
                {BOND_STAGE_NAMES.map((n, i) => <option key={n} value={i}>{`${i + 1} · ${n}`}</option>)}
              </select>
            </div>
          )}
        </div>
        {bond && needsPath && (
          <div style={{ marginTop: 6 }}>
            <span style={labelStyle}>Path <span style={{ color: "#666" }}>— permanent for this creature</span></span>
            <div style={{ display: "flex", gap: 6, marginTop: 3 }}>
              {pathNames.map((p, i) => (
                <button key={p.name} type="button"
                  onClick={() => setBond({ ...bond, chosenPathIndex: i as 0 | 1 })}
                  style={{
                    flex: 1, fontSize: 11, padding: "4px 8px", borderRadius: 3, cursor: "pointer", textAlign: "left",
                    background: bond.chosenPathIndex === i ? "#7b68ee33" : "transparent",
                    border: `1px solid ${bond.chosenPathIndex === i ? "#7b68ee" : "#333"}`,
                    color: bond.chosenPathIndex === i ? "#cfc6ff" : "#999",
                  }}>
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {resolved && (
          <p style={{ fontSize: 10, color: resolved.awaitingPathChoice ? "#ff9999" : "#777", margin: "6px 0 0" }}>
            {resolved.awaitingPathChoice
              ? `${resolved.stageName} needs a path — the creature has no bond effect until one is chosen.`
              : resolved.chosen
                ? `${resolved.stageName} · ${resolved.chosen.name}: ${resolved.chosen.text}`
                : `${resolved.stageName}: ${resolved.effect ?? ""}`}
          </p>
        )}
      </div>
    );
  }

  function renderAbilities() {
    return (
      <>
        <p style={hintStyle}>
          Scores come from a <strong style={{ color: "#aaa" }}>chassis</strong> — an existing stat block at the fight's projected CR (or the encounter doc). The archetype never generates scores; <strong style={{ color: "#aaa" }}>Reshape</strong> deals the same six numbers into the archetype's priority order. Every value stays editable — all of this is a starting point.
        </p>
        <div style={{ display: "flex", gap: 6, alignItems: "flex-end", marginBottom: 10, flexWrap: "wrap" }}>
          <div style={{ flex: 2, minWidth: 200 }}>
            <span style={labelStyle}>Chassis (copies abilities + AC/HP/speed)</span>
            <select value={chassisId} onChange={e => setChassisId(e.target.value)} style={inputStyle}>
              <option value="">— pick a library monster —</option>
              {chassisOptions.map(t => (
                <option key={t.templateId} value={t.templateId}>{t.name} (AC {String(t.stats.ac)} · {t.stats.maxHp} HP)</option>
              ))}
            </select>
          </div>
          <SmallBtn color="#4f9dff" onClick={() => chassisId && loadChassis(chassisId)} title="Copy the chassis's ability scores, AC, HP, and speed into this draft">
            ⬇ Load chassis
          </SmallBtn>
          <SmallBtn color="#f0c040" onClick={reshapeByArchetype}
            title={draft.stats.archetype ? `Redistribute the current six scores into the ${archetypeInfo(draft.stats.archetype).label} shape` : "Pick an archetype in step 1 first"}>
            ♻ Reshape by {draft.stats.archetype ? archetypeInfo(draft.stats.archetype).label : "archetype"}
          </SmallBtn>
        </div>
        {/*
          A SCORE ARRAY — scores WITHOUT a donor creature.
          
          Christopher: *"abilities is what load the ABS, so i need to choose a chassis and the
          ghul doesnt give the correct abs count."* He is right, and the chassis was the only way
          in. A creature with its OWN published array — the Elemental Mirror is 18/16/14/12/12/10
          for every archetype, dealt differently — had to borrow an unrelated stat block and then
          have all six numbers corrected by hand, and loading a chassis also overwrites AC, HP and
          speed, so it stomps the very stats the card fixes.
          
          RULE 2: a DM authoring their own creature should not need a donor. Type the array, deal
          it by archetype. Nothing else on the draft is touched.
        */}
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            <span style={labelStyle}>Score array <span style={{ color: "#666" }}>— six numbers, dealt by archetype. Never touches AC/HP/speed.</span></span>
            <input value={scoreArray} onChange={e => setScoreArray(e.target.value)}
              placeholder="18, 16, 14, 12, 12, 10" style={inputStyle} />
          </div>
          <SmallBtn color="#34c759" onClick={applyScoreArray}
            title="Deal these six numbers into the archetype's priority order. With no archetype set they land in STR-DEX-CON-INT-WIS-CHA order.">
            ⬇ Deal array
          </SmallBtn>
        </div>
        {/* CR sits with the abilities because it is what turns a proficiency TICK into a save
            number — the monster proficiency table steps at the same points as the character one. */}
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 8 }}>
          <div style={{ width: 90 }}>
            <span style={labelStyle}>CR</span>
            <input type="number" step="0.125" min={0} value={draft.stats.cr ?? ""} placeholder="—"
              onChange={e => updateStat("cr", e.target.value === "" ? undefined : Math.max(0, Number(e.target.value)))}
              style={inputStyle}
              title="Challenge Rating. Sets the proficiency bonus used by save proficiencies: CR 0–4 = +2, 5–8 = +3, 9–12 = +4, and so on." />
          </div>
          {/*
            ⚠ THE BONUS IS ITS OWN FIELD, because stat blocks print it and often print no CR.
            Every creature in the Act 3 v3.23 packet carries "Proficiency Bonus: +3" or "+4" and
            no challenge rating, and backing a CR out of a bonus invents a number — +3 spans the
            whole CR 5-8 band.

            Without this control the field could not survive a round trip: the library migration
            gave the Veil-Torn Wyrmling a recovered +3, the DM re-authored it, and the export came
            back with no bonus at all — so its attacks resolved at the +2 floor again.
          */}
          <div style={{ width: 110 }}>
            <span style={labelStyle}>Prof. bonus</span>
            <input type="number" min={2} max={9}
              value={draft.stats.proficiencyBonus ?? ""}
              placeholder={`+${Math.floor((Math.max(1, Math.floor(draft.stats.cr ?? 1)) - 1) / 4) + 2} from CR`}
              onChange={e => updateStat("proficiencyBonus", e.target.value === "" ? undefined : Math.max(0, Number(e.target.value)))}
              style={inputStyle}
              title="The printed proficiency bonus. Leave blank to derive it from CR. Set it when the block prints a bonus but no challenge rating — it feeds every ticked save and every @PROF, @ATK, @SPELL and @DC on this creature." />
          </div>
          <span style={{ fontSize: 10, color: "#667", paddingBottom: 4 }}>
            using <strong style={{ color: "#99a" }}>
              +{draft.stats.proficiencyBonus ?? Math.floor((Math.max(1, Math.floor(draft.stats.cr ?? 1)) - 1) / 4) + 2}
            </strong>
            {draft.stats.proficiencyBonus === undefined ? " from CR" : " as printed"}
            {" "}— every ticked save below, and @PROF / @ATK / @SPELL / @DC in this creature's formulas
          </span>
        </div>
        {/* ⚠ SAVE PROFICIENCY, THE SAME WAY THE PLAYER SHEET DOES IT. Christopher, 2026-08-20:
            *"the player side has this in exisitance why would the creature side not also have
            this."* The field was on the type all along — `abilities[].save`, with a comment saying
            it is the modifier "when the creature is PROFICIENT" — and no editor ever offered it,
            so every creature in the library saves at its bare ability modifier. A CR 9 boss
            proficient in WIS saves four points higher than the checker was giving it, which
            over-prices every control effect aimed at it. */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
          {ABILITY_ORDER.map(label => {
            const entry = draft.abilities.find(a => a.label.toUpperCase().startsWith(label));
            // Reads the REAL save — an authored explicit value included — so the tick can never
            // sit empty next to a save the creature actually has.
            const { save, proficient, explicit } = creatureSaveDisplay(entry, draft.stats.cr);
            return (
              <div key={label}>
                <span style={{ ...labelStyle, textAlign: "center", fontWeight: 700 }}>{label}</span>
                <input type="number" value={scores[label]} onChange={e => setScore(label, Number(e.target.value) || 0)}
                  style={{ ...inputStyle, textAlign: "center" }} />
                <div style={{ fontSize: 10, color: "#888", textAlign: "center", marginTop: 2 }}>
                  {(() => { const m = Math.floor((scores[label] - 10) / 2); return `${m >= 0 ? "+" : ""}${m}`; })()}
                </div>
                {/*
                  ⚠ NEVER DISABLED. This tick used to be locked whenever a save matched neither
                  the bare modifier nor modifier + proficiency — which is precisely when a DM
                  needs it. Christopher, on the Veil-Torn Dragon: *"i cant override it because the
                  con box only opens if the cr is 9 but then the cha and wis turn off."*

                  No CR could have unlocked all three: CON +5/save 9 implies a proficiency bonus
                  of 4, while WIS +5/save 8 and CHA +6/save 9 both imply 3. One creature, two
                  bonuses. The control has to be editable regardless of whether the data currently
                  makes sense, or a creature can be authored into a state it cannot leave.
                */}
                <label
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3, marginTop: 3,
                    fontSize: 9, color: proficient ? "#34c759" : "#667", cursor: "pointer" }}
                  title={`Proficient in ${label} saves — adds the proficiency bonus. Ticking clears any pinned value below.`}>
                  <input type="checkbox" checked={proficient}
                    onChange={e => setSaveProficient(label, e.target.checked)} style={{ margin: 0 }} />
                  save {save >= 0 ? "+" : ""}{save}
                </label>
                {/* Blank = derived from the score and the tick. A number pins it. */}
                <input
                  type="number"
                  value={typeof entry?.save === "number" ? String(entry.save) : ""}
                  placeholder="—"
                  onChange={e => setSaveExplicit(label, e.target.value)}
                  style={{ ...inputStyle, textAlign: "center", marginTop: 2, fontSize: 10, padding: "2px 4px",
                    borderColor: explicit ? "#e07b39" : "#444", color: explicit ? "#e07b39" : "#888" }}
                  title={explicit
                    ? `Pinned at ${save >= 0 ? "+" : ""}${save}, which is neither the bare modifier nor modifier + proficiency. Clear the box to derive it instead.`
                    : "Pin a bespoke save here. Leave blank to derive it from the score and the proficiency tick."} />
              </div>
            );
          })}
        </div>

        {/* RULE 1A — skills were code-only. The rolled-check UI reads `stats.skills`, so a
            creature built in the app had no Perception or Stealth to roll and a code-authored
            one did. */}
        <div style={{ background: "#12121c", border: "1px solid #23233a", borderRadius: 6, padding: 10, marginTop: 12 }}>
          <span style={{ ...labelStyle, textTransform: "uppercase", letterSpacing: 1, color: "#f0c040" }}>Skills</span>
          <p style={{ ...hintStyle, marginTop: 4 }}>
            Only the ones this creature is actually trained in — the modifier is the whole roll, not a bonus on top of the ability. Two creatures at the same CR are rarely good at the same things.
          </p>
          {(draft.stats.skills ?? []).map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-end", marginTop: 6 }}>
              <div style={{ flex: 3 }}>
                <span style={labelStyle}>Skill</span>
                <input value={s.label} onChange={e => updateSkill(i, { label: e.target.value })} placeholder="Perception" style={inputStyle} />
              </div>
              <div style={{ width: 90 }}>
                <span style={labelStyle}>Modifier</span>
                <input type="number" value={s.modifier} onChange={e => updateSkill(i, { modifier: Number(e.target.value) || 0 })}
                  style={{ ...inputStyle, textAlign: "center" }} />
              </div>
              <SmallBtn color="#ff6b6b" onClick={() => removeSkill(i)}>✕</SmallBtn>
            </div>
          ))}
          <div style={{ marginTop: 8 }}><SmallBtn color="#f0c040" onClick={() => addSkill()}>+ Skill</SmallBtn></div>
        </div>
      </>
    );
  }

  function renderDefenses() {
    const band = CREATOR_BANDS.find(b => b.id === refBand) ?? CREATOR_BANDS[1];
    const hpRef = band.hp[refPressure];
    return (
      <>
        <p style={hintStyle}>HP normally keeps the chassis's number (the locked chassis-HP rule — fights are tuned with the two encounter levers, not by nudging HP). The band/pressure table below is REFERENCE — Apply copies a suggestion, nothing is set silently.</p>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
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
        <div style={{ background: "#12121c", border: "1px solid #23233a", borderRadius: 6, padding: 10 }}>
          <span style={{ ...labelStyle, textTransform: "uppercase", letterSpacing: 1, color: "#34c759" }}>Band / pressure reference (starting points)</span>
          <div style={{ display: "flex", gap: 6, alignItems: "flex-end", flexWrap: "wrap", marginTop: 6 }}>
            <div style={{ flex: 2, minWidth: 160 }}>
              <span style={labelStyle}>Party-level band</span>
              <select value={refBand} onChange={e => setRefBand(e.target.value as CreatorBandId)} style={inputStyle}>
                {CREATOR_BANDS.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 100 }}>
              <span style={labelStyle}>Pressure</span>
              <select value={refPressure} onChange={e => setRefPressure(e.target.value as CreatorPressureId)} style={inputStyle}>
                {PRESSURE_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8, flexWrap: "wrap", fontSize: 11, color: "#99a" }}>
            <span>AC <strong style={{ color: "#dfe4ff" }}>{band.baselineAc}</strong></span>
            <SmallBtn color="#34c759" onClick={() => updateStat("ac", band.baselineAc)}>Apply AC</SmallBtn>
            <span>HP <strong style={{ color: "#dfe4ff" }}>{hpRef.suggested}</strong> <span style={{ color: "#667" }}>(range {hpRef.low}–{hpRef.high ?? "∞"})</span></span>
            <SmallBtn color="#34c759" onClick={() => updateStat("maxHp", hpRef.suggested)}>Apply HP</SmallBtn>
            <span style={{ color: "#667" }}>attack +{band.attackBonus} · starter {band.starterDamage}</span>
          </div>
        </div>

        {/* ── DEFENSIVE TRAITS ───────────────────────────────────────────────────────────
            ⚠ THE DM PICKS THE TRAIT; THE WORKBOOK PRICES IT. `ehpMultiplier` is not a D&D fact,
            it is the checker's normalized pricing weight — the calibration's `contribution`
            column plus 1. So it is DERIVED here, never typed.

            An earlier version of this block gave the DM a free-text "EHP ×" box. That was wrong
            on Christopher's correction (2026-08-20): *"Do not add a generic DM control that lets
            the DM author arbitrary defense pricing simply because the internal schema contains
            stats.defenses."* Typing a multiplier is authoring the pricing model, which the
            workbook owns. RULE 1A means one authoritative pricing path, not an editable one.

            The 58 calibrated rules ship in the bundle with their own stack groups, so the
            double-count guard is the workbook's classification rather than a name this app
            invented. A rule with a null multiplier is calibrated as UNPRICED — it is a real
            trait the workbook has not assigned a weight to, and the checker flags it rather
            than inventing one. */}
        {/* ── TYPED DAMAGE RESPONSES ───────────────────────────────────────────────────────
            ⚠ NOT A DROPDOWN, AND DELIBERATELY NOT PART OF ONE. Christopher: *"i cant enter
            specific resistance or vulnerable to a element, this is why i didnt want the
            defensives to be a drop down box which they are unless i build a trait for the 2
            types."*

            Right, and the reason is that these are two different kinds of fact. The dropdown
            below is a PRICE — one of the 58 calibrated rules and the weight it carries. "Immune
            to cold" is what the stat block SAYS, and there is no calibrated row for it because
            those rows are shares of opposing damage rather than named types.

            Before this existed the only home for it was a free-text note, where the card, the
            editor and the checker could all not read it. */}
        <div style={{ background: "#12121c", border: "1px solid #23233a", borderRadius: 6, padding: 10, marginTop: 10 }}>
          <span style={{ ...labelStyle, textTransform: "uppercase", letterSpacing: 1, color: "#4a9eff" }}>Damage responses</span>
          <p style={{ ...hintStyle, marginTop: 4 }}>
            What the block prints — <strong style={{ color: "#aaa" }}>Damage Immunities Cold</strong>, <strong style={{ color: "#aaa" }}>Damage Vulnerabilities Radiant</strong>. Type them as they read. These record what the creature IS; the effective-HP weight is the trait list below, because the workbook prices resistance as a share of opposing damage rather than by name.
          </p>
          {(draft.stats.damageResponses ?? []).map((r, i) => (
            <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-end", marginTop: 6 }}>
              <div style={{ width: 120 }}>
                <span style={labelStyle}>Response</span>
                <select value={r.response} onChange={e => updateDamageResponse(i, { response: e.target.value as "resistant" | "immune" | "vulnerable" })} style={inputStyle}>
                  <option value="resistant">Resistant to</option>
                  <option value="immune">Immune to</option>
                  <option value="vulnerable">Vulnerable to</option>
                </select>
              </div>
              <div style={{ flex: 2, minWidth: 110 }}>
                <span style={labelStyle}>Damage type</span>
                <input value={r.type} onChange={e => updateDamageResponse(i, { type: e.target.value })}
                  placeholder="cold" style={inputStyle} />
              </div>
              <div style={{ flex: 3, minWidth: 140 }}>
                <span style={labelStyle}>Qualifier (optional)</span>
                <input value={r.qualifier ?? ""} onChange={e => updateDamageResponse(i, { qualifier: e.target.value })}
                  placeholder="from nonmagical attacks" style={inputStyle} />
              </div>
              <div style={{ width: 88 }}>
                <span style={labelStyle}>Share %</span>
                <input type="number" min={0} max={100} placeholder="—"
                  value={typeof r.share === "number" ? String(Math.round(r.share * 100)) : ""}
                  onChange={e => updateDamageResponse(i, { share: e.target.value === "" ? undefined : Math.max(0, Math.min(100, Number(e.target.value))) / 100 })}
                  style={{ ...inputStyle, textAlign: "center" }}
                  title="What share of the party-s damage is this type. The workbook weights a response by the party-s ACTUAL eligible share, so an unweighted response is recorded but prices at nothing." />
              </div>
              <SmallBtn color="#ff6b6b" onClick={() => removeDamageResponse(i)}>✕</SmallBtn>
            </div>
          ))}
          <div style={{ marginTop: 8, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <SmallBtn color="#4a9eff" onClick={() => addDamageResponse()}>+ Damage response</SmallBtn>
            {(draft.stats.damageResponses ?? []).length > 0 && (
              <span style={{ fontSize: 11, color: "#99a" }}>
                {(draft.stats.damageResponses ?? [])
                  .filter(r => r.type.trim())
                  .map(r => `${r.response === "immune" ? "Immune" : r.response === "vulnerable" ? "Vulnerable" : "Resistant"} to ${r.type}${r.qualifier ? ` ${r.qualifier}` : ""}`)
                  .join(" · ")}
              </span>
            )}
          </div>
        </div>

        <div style={{ background: "#12121c", border: "1px solid #23233a", borderRadius: 6, padding: 10, marginTop: 10 }}>
          <span style={{ ...labelStyle, textTransform: "uppercase", letterSpacing: 1, color: "#34c759" }}>Defensive traits</span>
          <p style={{ ...hintStyle, marginTop: 4 }}>
            What makes this creature harder to kill than its raw HP says — resistances, regeneration, a revival, a reaction that blunts a hit. Pick the trait; <strong style={{ color: "#aaa" }}>the workbook supplies its effective-HP weight</strong>. Leave empty for a creature whose HP is the whole story.
          </p>
          {(draft.stats.defenses ?? []).map((d, i) => {
            const rule = traitRule(d.name);
            return (
              <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-end", marginTop: 6 }}>
                <div style={{ flex: 3, minWidth: 200 }}>
                  <span style={labelStyle}>Trait</span>
                  <select value={d.name} onChange={e => selectDefense(i, e.target.value)} style={inputStyle}>
                    <option value="">— pick a calibrated trait —</option>
                    {TRAIT_RULES.map(r => (
                      <option key={r.label} value={r.label}>
                        {r.label}{r.multiplier == null ? " (unpriced)" : ` — ×${r.multiplier.toFixed(3)}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ width: 110 }}>
                  <span style={labelStyle}>EHP × (derived)</span>
                  <div style={{ ...inputStyle, background: "#0d0d16", color: rule?.multiplier == null ? "#e07b39" : "#dfe4ff", cursor: "default" }}>
                    {rule?.multiplier == null ? "unpriced" : `×${rule.multiplier.toFixed(3)}`}
                  </div>
                </div>
                <div style={{ flex: 2, minWidth: 120 }}>
                  <span style={labelStyle}>Stack group</span>
                  <div style={{ ...inputStyle, background: "#0d0d16", color: "#888", cursor: "default" }}>
                    {rule?.stack_group ?? "—"}
                  </div>
                </div>
                <SmallBtn color="#ff6b6b" onClick={() => removeDefense(i)}>✕</SmallBtn>
              </div>
            );
          })}
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
            <SmallBtn color="#34c759" onClick={() => addDefense()}>+ Defensive trait</SmallBtn>
            {/* ⚠ THE TRAITS ARE ALREADY WRITTEN. Asking the author to find the matching rule in a
                list of 58 is asking for the same fact twice — Christopher: *"the parser should be
                able to read something like Elemental guard and do the assigned defense to it."*
                It proposes with the phrase it matched on, never silently: see `traitClassifier`. */}
            <SmallBtn color="#4a9eff" onClick={() => readDefensesFromTraits()}>Read from traits</SmallBtn>
            <span style={{ fontSize: 11, color: "#99a" }}>
              Combined <strong style={{ color: "#dfe4ff" }}>
                ×{(draft.stats.defenses ?? []).reduce((p, d) => p * (traitRule(d.name)?.multiplier ?? 1), 1).toFixed(3)}
              </strong> → effective HP <strong style={{ color: "#dfe4ff" }}>
                {Math.round(draft.stats.maxHp * (draft.stats.defenses ?? []).reduce((p, d) => p * (traitRule(d.name)?.multiplier ?? 1), 1))}
              </strong>
            </span>
          </div>

          {/* ── WHAT THIS CREATURE'S AC IS WORTH ────────────────────────────────────────────
              Christopher: *"since we set the CR of a creature and the ac shouldnt the defense be
              able to see the standard ac of a creature vs the set and say + or - defenses."*

              It should, and the checker has always done exactly this — `acMultiplierFor` prices
              AC as its own multiplier on effective HP against the expected AC for the band. It
              was just never shown where the number is being typed, so the author set an AC and
              found out what it cost somewhere else. Same function, no second implementation. */}
          {(() => {
            const level = band.referenceLevel;
            const expected = EXPECTED_MONSTER_AC[level];
            // AC is authored as a free field, so it arrives as a string on a half-typed entry.
            const ac = Number(draft.stats.ac);
            if (expected === undefined || !Number.isFinite(ac)) return null;
            const delta = Math.round(ac - expected);
            const mult = acMultiplierFor(ac, level, draft.name || "creature", []);
            const traitProduct = (draft.stats.defenses ?? []).reduce((p, d) => p * (traitRule(d.name)?.multiplier ?? 1), 1);
            const tone = delta === 0 ? "#99a" : delta > 0 ? "#34c759" : "#e07b39";
            return (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #23233a", fontSize: 11, color: "#99a" }}>
                AC <strong style={{ color: "#dfe4ff" }}>{ac}</strong> against the expected{" "}
                <strong style={{ color: "#dfe4ff" }}>{expected}</strong> at {band.label.toLowerCase()} —{" "}
                <strong style={{ color: tone }}>
                  {delta === 0 ? "on the curve" : `${delta > 0 ? "+" : ""}${delta} AC`}
                </strong>
                {delta !== 0 && <> , worth <strong style={{ color: tone }}>×{mult.toFixed(3)}</strong> on its own</>}
                {". "}
                With its traits that is effective HP{" "}
                <strong style={{ color: "#dfe4ff" }}>{Math.round(draft.stats.maxHp * traitProduct * mult)}</strong>
                {" "}from {draft.stats.maxHp} raw.
              </div>
            );
          })()}
        </div>

        {/* The creature estimator used to sit here. It MEASURES a creature rather than helping
            build one, and inside the Defenses step it read as a live grade on the numbers being
            typed — as though the creator were steering toward a target CR. It is now its own
            tool: CreatureEstimatorPanel, beside the encounter checker. */}
      </>
    );
  }

  function renderActions() {
    return (
      <>
        <p style={hintStyle}>Attacks and standard actions. Recharge is a field, not a name suffix — the card's recharge roller reads it. Legendary actions live in step 6.</p>
        {/* ⚠ ATTACKS/TURN IS AN ACTION-ECONOMY FIELD AND BELONGS HERE. It sat under Defenses
            beside HP and AC, which is where you look for what a creature can SURVIVE, not for
            how many swings it gets — so the number that decides the whole turn was filed with
            the wrong question. It sits above the action list because it governs it. */}
        <div style={{
          display: "flex", alignItems: "flex-end", gap: 10, marginBottom: 8,
          background: "#12121c", border: "1px solid #23233a", borderRadius: 6, padding: 10,
        }}>
          <div style={{ width: 130 }}>
            <span style={labelStyle}>Attacks / turn</span>
            <input type="number" min={1} value={draft.stats.attacksPerTurn ?? ""} placeholder="1"
              onChange={e => updateStat("attacksPerTurn", e.target.value ? Math.max(1, Number(e.target.value)) : undefined)}
              style={inputStyle} title="How many of the actions below the creature may take on its turn. No action needs to be named 'Multiattack'." />
          </div>
          <p style={{ ...hintStyle, flex: 1, margin: 0 }}>
            How many of the actions below it may take on one turn — blank or 1 means a single
            action. This is the budget, not a list: the DM spends it on whichever actions they
            want. A spell or recharge ability IS the whole action and ends the turn's attacks.
          </p>
        </div>
        {renderActionSets()}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
          <SmallBtn color="#ff6b5e" onClick={() => addListItem("actions", { name: "", kind: "action" })}>+ Add action</SmallBtn>
        </div>
        {standardActions.map(({ a, i }) => actionRow("actions", a, i))}
        {standardActions.length === 0 && <p style={{ fontSize: 11, color: "#555", fontStyle: "italic" }}>No actions yet.</p>}
      </>
    );
  }

  function renderReactions() {
    return (
      <>
        <p style={hintStyle}>True reactions — a trigger, an effect, an optional save. (Glacial Counterspell shape: "Trigger: a creature it can see casts a spell. Effect: …")</p>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
          <SmallBtn color="#9be9a8" onClick={() => addListItem("reactions", { name: "", kind: "reaction" })}>+ Add reaction</SmallBtn>
        </div>
        {draft.reactions.map((a, i) => actionRow("reactions", a, i, { reaction: true }))}
        {draft.reactions.length === 0 && <p style={{ fontSize: 11, color: "#555", fontStyle: "italic" }}>No reactions yet.</p>}
      </>
    );
  }

  /**
   * SPELL SLOTS — the pools an action's "Slot" dropdown spends from.
   *
   * RULE ZERO: nothing that lives in the creators can be code gated. `stats.spellSlots` was
   * read at runtime and authorable NOWHERE, so a DM building their own caster had no way to
   * give it slots — the field could only be set by editing the campaign source. Hale and the
   * UR need it, and so does anybody building a caster of their own.
   */
  function renderSpellcasting() {
    const slots = draft.stats.spellSlots ?? [];
    const setSlots = (next: { level: number; max: number }[]) =>
      updateStat("spellSlots", next.length ? next.sort((a, b) => a.level - b.level) : undefined);
    const poolCount = (level: number) =>
      draft.actions.filter(a => a.slotCandidate && a.spellSlotLevel === level).length;
    return (
      <>
        <p style={hintStyle}>A caster's slot pools, and the spells that spend them. Tick <strong>Pool</strong> on a spell to make it a CANDIDATE rather than always-available: the DM then picks which candidates fill each slot when the creature is generated, and a picked spell leaves the pool for the other slots at that level.</p>
        <div style={{ marginBottom: 12, padding: "8px 10px", background: "#12101f", border: "1px solid #2a2a3e", borderRadius: 4 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#9d8cff" }}>Spell slots</span>
          <SmallBtn color="#7b68ee" onClick={() => {
            const used = new Set(slots.map(s => s.level));
            const next = [1, 2, 3, 4, 5, 6, 7, 8, 9].find(l => !used.has(l));
            if (next) setSlots([...slots, { level: next, max: 1 }]);
          }}>+ Slot level</SmallBtn>
        </div>
        {slots.length === 0 && (
          <p style={{ fontSize: 11, color: "#555", fontStyle: "italic", margin: 0 }}>
            No slots — the creature casts nothing that costs one. Add a level to make it a caster.
          </p>
        )}
        {slots.map((s, i) => {
          const pool = poolCount(s.level);
          // A pool smaller than the slot count cannot fill them: picks are distinct, so 3 slots
          // need at least 3 candidates. Saying so here beats failing at generation.
          const short = pool > 0 && pool < s.max;
          return (
            <div key={s.level} style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 5 }}>
              <div style={{ width: 62 }}>
                <span style={labelStyle}>Level</span>
                <select value={s.level} style={inputStyle}
                  onChange={e => setSlots(slots.map((x, j) => j === i ? { ...x, level: Number(e.target.value) } : x))}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9]
                    .filter(l => l === s.level || !slots.some(x => x.level === l))
                    .map(l => <option key={l} value={l}>L{l}</option>)}
                </select>
              </div>
              <div style={{ width: 62 }}>
                <span style={labelStyle}>Slots</span>
                <input type="number" min={1} max={9} value={s.max} style={inputStyle}
                  onChange={e => setSlots(slots.map((x, j) => j === i ? { ...x, max: Math.max(1, Number(e.target.value) || 1) } : x))} />
              </div>
              <span style={{ flex: 1, fontSize: 10, color: short ? "#ff9999" : "#666", paddingBottom: 5 }}>
                {pool === 0
                  ? "no pool — spells at this level are always available"
                  : short
                    ? `only ${pool} candidate${pool === 1 ? "" : "s"} for ${s.max} slots — picks are distinct, so add ${s.max - pool} more`
                    : `${pool} candidates → DM picks ${s.max}`}
              </span>
              <button type="button" onClick={() => setSlots(slots.filter((_, j) => j !== i))}
                style={{ fontSize: 10, padding: "2px 5px", background: "transparent", border: "1px solid #5a1a1a", borderRadius: 3, color: "#ff9999", cursor: "pointer" }}>✕</button>
            </div>
          );
        })}
      </div>
        {/*
          The spells themselves, filtered out of the noise. An authored caster carries more
          spells than it brings to a fight, so the list that matters here is the slot-costed
          one — everything else is an attack or a trait and belongs in step 4.
        */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
          {/* A new spell costs NO slot by default. Forcing spellSlotLevel:1 made every spell a
              slot caster, which is wrong for the at-will / 1-per-day / 3-per-day shape most
              authored casters actually use — set the slot only when the spell really spends one. */}
          <SmallBtn color="#9d8cff" onClick={() => addListItem("actions", { name: "", kind: "spell" })}>+ Add spell</SmallBtn>
        </div>
        {slotSpells.map(({ a, i }) => actionRow("actions", a, i, { spell: true }))}
        {slotSpells.length === 0 && (
          <p style={{ fontSize: 11, color: "#555", fontStyle: "italic" }}>
            No slot-costed spells yet. Add one, set its level, and tick Pool to make it a
            candidate the DM chooses between when the creature is generated.
          </p>
        )}
      </>
    );
  }

  function renderLegendary() {
    return (
      <>
        <p style={hintStyle}>Legendary actions keep a solo boss pacing 4–6 PCs: N actions per round, spent at the end of other creatures' turns. Each option costs 1 or 2 from the pool.</p>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 10 }}>
          <div style={{ width: 130 }}>
            <span style={labelStyle}>Legendary actions / round</span>
            <input type="number" min={0} max={5} value={draft.stats.legendaryPerRound ?? ""} placeholder="0"
              onChange={e => updateStat("legendaryPerRound", e.target.value ? Math.max(0, Number(e.target.value)) : undefined)} style={inputStyle} />
          </div>
          <SmallBtn color="#f0c040" onClick={() => addListItem("actions", { name: "", kind: "action", legendaryCost: 1 })}>+ Add legendary action</SmallBtn>
        </div>
        {legendaryActions.map(({ a, i }) => actionRow("actions", a, i, { legendary: true }))}
        {legendaryActions.length === 0 && <p style={{ fontSize: 11, color: "#555", fontStyle: "italic" }}>No legendary actions — fine for anything short of a boss.</p>}
      </>
    );
  }

  function renderExtras() {
    return (
      <>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span style={{ ...labelStyle, textTransform: "uppercase", letterSpacing: 1, color: "#e07bff" }}>Traits (passives)</span>
          <SmallBtn color="#e07bff" onClick={() => addListItem("traits", { name: "", kind: "trait" })}>+ Add trait</SmallBtn>
        </div>
        {draft.traits.map((a, i) => actionRow("traits", a, i, { reaction: true }))}
        {draft.traits.length === 0 && <p style={{ fontSize: 11, color: "#555", fontStyle: "italic" }}>No traits yet.</p>}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "14px 0 4px" }}>
          <span style={{ ...labelStyle, textTransform: "uppercase", letterSpacing: 1, color: "#4f9dff" }}>Resources / trackers (per-combat uses)</span>
          <SmallBtn color="#4f9dff" onClick={() => setDraft(d => ({ ...d, resources: [...d.resources, { id: `res-${Date.now().toString(36)}`, name: "", max: 1, reset: "encounter" }] }))}>+ Add resource</SmallBtn>
        </div>
        {draft.resources.map((r, i) => (
          <div key={r.id || i} style={rowStyle}>
            <div style={{ display: "flex", gap: 4 }}>
              <div style={{ flex: 2 }}>
                <span style={labelStyle}>Name</span>
                <input value={r.name} onChange={e => setDraft(d => { const next = [...d.resources]; next[i] = { ...next[i], name: e.target.value }; return { ...d, resources: next }; })} style={inputStyle} />
              </div>
              <div style={{ width: 60 }}>
                <span style={labelStyle}>Max</span>
                <input type="number" value={r.max ?? ""} onChange={e => setDraft(d => { const next = [...d.resources]; next[i] = { ...next[i], max: e.target.value ? Number(e.target.value) : undefined }; return { ...d, resources: next }; })} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <span style={labelStyle}>Reset</span>
                <input value={r.reset ?? ""} onChange={e => setDraft(d => { const next = [...d.resources]; next[i] = { ...next[i], reset: e.target.value }; return { ...d, resources: next }; })} placeholder="encounter / turn" style={inputStyle} />
              </div>
              <div style={{ flex: 2 }}>
                <span style={labelStyle}>Note</span>
                <input value={r.note ?? ""} onChange={e => setDraft(d => { const next = [...d.resources]; next[i] = { ...next[i], note: e.target.value }; return { ...d, resources: next }; })} style={inputStyle} />
              </div>
              <button type="button" onClick={() => setDraft(d => ({ ...d, resources: d.resources.filter((_, j) => j !== i) }))}
                style={{ alignSelf: "flex-end", fontSize: 10, padding: "2px 5px", background: "transparent", border: "1px solid #5a1a1a", borderRadius: 3, color: "#ff9999", cursor: "pointer" }}>✕</button>
            </div>
          </div>
        ))}

        <div style={{ margin: "14px 0 4px" }}>
          <span style={{ ...labelStyle, textTransform: "uppercase", letterSpacing: 1 }}>DM notes (one per line)</span>
          <textarea value={draft.notes.join("\n")}
            onChange={e => setDraft(d => ({ ...d, notes: e.target.value ? e.target.value.split("\n") : [] }))}
            rows={4} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
        </div>
      </>
    );
  }

  const stepBody: Record<StepId, () => React.ReactNode> = {
    identity: renderIdentity,
    abilities: renderAbilities,
    defenses: renderDefenses,
    actions: renderActions,
    reactions: renderReactions,
    legendary: renderLegendary,
    spells: renderSpellcasting,
    extras: renderExtras,
  };

  const stepIdx = STEPS.findIndex(s => s.id === step);

  /**
   * WHAT MUST BE TRUE BEFORE THIS CAN BE SAVED.
   *
   * The draft carries across the step tabs and “Save to My Library” is the commit, so this is
   * the only point that can catch a statblock with nothing on it. It BLOCKS on the two things
   * that make a monster unusable and only CAUTIONS about the rest — a DM saving a
   * work-in-progress should not be argued with.
   */
  const blockers: string[] = [];
  const cautions: string[] = [];
  if (!draft.name?.trim()) blockers.push("Name is required.");
  if (!((draft.stats?.maxHp ?? 0) > 0)) blockers.push("Max HP must be above 0 — a monster with no hit points cannot be fought.");
  if (!(draft.actions ?? []).length) cautions.push("No actions yet — it will have nothing to do on its turn.");
  if (!draft.stats?.ac) cautions.push("No AC set — attacks against it have nothing to beat.");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "8px 14px", borderBottom: "1px solid #2a2a3e", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>{draft.name || "New Monster"}</span>
          {/*
            The badge names the store this creature will land in. It said "My Library"
            unconditionally, which was true only because there was nowhere else to save.
          */}
          {canSaveToCampaign ? (
            <span title="Save targets: My Library keeps it private; Campaign makes it module content that ships through the author export."
              style={{ fontSize: 9, padding: "1px 7px", borderRadius: 8, background: "#1a1630", border: "1px solid #4b3f8f", color: "#9d8cff", textTransform: "uppercase", letterSpacing: 1 }}>Campaign or My Library</span>
          ) : (
            <span title="Monsters you create are saved to your personal My Library" style={{ fontSize: 9, padding: "1px 7px", borderRadius: 8, background: "#16291b", border: "1px solid #2f7d3f", color: "#7be08a", textTransform: "uppercase", letterSpacing: 1 }}>My Library</span>
          )}
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" disabled={blockers.length > 0}
            title={blockers.length ? blockers.join("  ") : cautions.join("  ") || "Save to My Library"}
            onClick={() => { if (blockers.length === 0) onSave(draft); }}
            style={{ fontSize: 11, padding: "3px 12px", border: "none", borderRadius: 3, fontWeight: 700,
                     background: blockers.length ? "#2a2a3e" : "#34c759",
                     color: blockers.length ? "#666" : "#06210f",
                     cursor: blockers.length ? "not-allowed" : "pointer" }}>
            ✓ Save to My Library
          </button>
          {/*
            SAVE TO CAMPAIGN — the route by which a DM authors module content.

            Without this, every creature built in the app was "My Library" whatever the intent, and
            authoring a new act meant editing campaign source by hand. Same blockers as the private
            save: campaign content is held to the same completeness bar, not a looser one.
          */}
          {canSaveToCampaign && (
            <button type="button" disabled={blockers.length > 0}
              title={blockers.length ? blockers.join("  ") : "Save as CAMPAIGN content — ships with the module through the author export, rather than staying in your personal library."}
              onClick={() => { if (blockers.length === 0) onSave(draft, "campaign"); }}
              style={{ fontSize: 11, padding: "3px 12px", borderRadius: 3, fontWeight: 700,
                       background: blockers.length ? "#2a2a3e" : "#7b68ee",
                       border: "none",
                       color: blockers.length ? "#666" : "#0d0a1f",
                       cursor: blockers.length ? "not-allowed" : "pointer" }}>
              ✓ Save to Campaign
            </button>
          )}
          {/* ⚠ THE WAY OUT OF AN OVERRIDE. Only rendered for a campaign creature that actually
              has one. Reverting is NOT deleting: the campaign template shares this templateId,
              so it takes the slot back and every encounter using it keeps working. */}
          {onRevertToCampaign && (
            <button type="button"
              onClick={() => {
                if (window.confirm(`Discard your saved copy of ${template.name} and go back to the campaign version?\n\nThis is not a delete — the campaign creature keeps the same slot and every encounter using it keeps working.`)) {
                  onRevertToCampaign();
                }
              }}
              title="Discard your edits and go back to the shipped campaign creature. Nothing leaves the library."
              style={{ fontSize: 11, padding: "3px 8px", background: "#4caf5022", border: "1px solid #4caf5055", borderRadius: 3, color: "#4caf50", cursor: "pointer" }}>
              ↩ Revert to campaign
            </button>
          )}
          <button type="button" onClick={onCancel}
            style={{ fontSize: 11, padding: "3px 8px", background: "transparent", border: "1px solid #444", borderRadius: 3, color: "#888", cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      </div>

      {/* Step tabs */}
      <div style={{ display: "flex", gap: 4, padding: "6px 10px", borderBottom: "1px solid #23233a", flexWrap: "wrap", flexShrink: 0 }}>
        {STEPS.map(s => (
          <button key={s.id} type="button" onClick={() => setStep(s.id)}
            style={{
              fontSize: 10.5, padding: "3px 9px", borderRadius: 10, cursor: "pointer",
              background: step === s.id ? `${s.accent}22` : "transparent",
              border: `1px solid ${step === s.id ? s.accent : "#2a2a3e"}`,
              color: step === s.id ? s.accent : "#778",
              fontWeight: step === s.id ? 700 : 400,
            }}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Step body */}
      <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
        {stepBody[step]()}
      </div>

      {/* Step navigation footer */}
      <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 14px", borderTop: "1px solid #23233a", flexShrink: 0 }}>
        <button type="button" disabled={stepIdx === 0} onClick={() => setStep(STEPS[Math.max(0, stepIdx - 1)].id)}
          style={{ fontSize: 11, padding: "3px 10px", background: "transparent", border: "1px solid #2a2a3e", borderRadius: 4, color: stepIdx === 0 ? "#444" : "#99a", cursor: stepIdx === 0 ? "default" : "pointer" }}>
          ← Back
        </button>
        <button type="button" disabled={stepIdx === STEPS.length - 1} onClick={() => setStep(STEPS[Math.min(STEPS.length - 1, stepIdx + 1)].id)}
          style={{ fontSize: 11, padding: "3px 10px", background: "transparent", border: "1px solid #2a2a3e", borderRadius: 4, color: stepIdx === STEPS.length - 1 ? "#444" : "#99a", cursor: stepIdx === STEPS.length - 1 ? "default" : "pointer" }}>
          Next →
        </button>
      </div>
    </div>
  );
}
