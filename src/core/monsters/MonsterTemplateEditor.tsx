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
import type { MainMonsterTemplate, MainMonsterVisibilityState, MonsterArchetype, MonsterClassification } from "./runtime/mainMonsterRuntime";
import { MONSTER_KINDS } from "./runtime/mainMonsterRuntime";
import type { MonsterReaderAction } from "./MonsterJconScanner";
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
  type CreatorBandId,
  type CreatorPressureId,
} from "./creator/monsterCreatorModel";
import { estimateCreature } from "../encounter-band/creatureEstimator";
import { parseCreature } from "../encounter-band/parseCreature";
import { traceCreature } from "../encounter-band/actionTrace";

// ─── Props ────────────────────────────────────────────────────────────────────

export type MonsterTemplateEditorProps = {
  template: MainMonsterTemplate;
  /** Library monsters offered as CHASSIS sources (scores + defenses). */
  chassisOptions?: MainMonsterTemplate[];
  onSave: (updated: MainMonsterTemplate) => void;
  onCancel: () => void;
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

export function MonsterTemplateEditor({ template, chassisOptions = [], onSave, onCancel }: MonsterTemplateEditorProps) {
  const [draft, setDraft] = useState<MainMonsterTemplate>(() => JSON.parse(JSON.stringify(template)));
  const [step, setStep] = useState<StepId>("identity");
  const [chassisId, setChassisId] = useState<string>("");
  const [refBand, setRefBand] = useState<CreatorBandId>("mid");
  const [refPressure, setRefPressure] = useState<CreatorPressureId>("standard");
  const [desiredCr, setDesiredCr] = useState<number | undefined>(undefined);

  /**
   * The workbook estimator, fed from THIS creature.
   *
   * ⚠ THE DPR COMES FROM THE TRACE, not from a number typed twice. `parseCreature` +
   * `traceCreature` are the same pair the encounter checker uses, so the estimate cannot drift
   * from what the checker says the creature does — and it already honours Recharge, use limits and
   * gated features. The sheet asks for "expected DPR from the parser"; this IS the parser.
   *
   * The trait multiplier is the PRODUCT of the authored defences, matching the checker's own
   * combination rule. Target AC 16 / save +3 is the estimator's fixed reference frame — it is
   * measuring the creature, not a specific party, so it must not move with a party level.
   */
  const estimate = useMemo(() => {
    const parsed = parseCreature(draft);
    // THREE rounds, not four: v6 rates the legal three-round action sequence.
    const trace = traceCreature(parsed, { ac: 16, saveBonus: 3 }, 3);
    // TWO CHANNELS, and a trait belongs to exactly one. The authored trait product stays a
    // MULTIPLIER — collapsing it into the flat term gives the same effective HP but hides the
    // sustain calibration. Flat effects (regeneration, healing, restored HP, fixed barriers)
    // belong in `ehpAdjustment`; AC-equivalent effects belong in `acAdjustment`.
    const traitMultiplier = (draft.stats.defenses ?? [])
      .reduce((product, d) => product * (d.ehpMultiplier || 1), 1);
    const rawHp = draft.stats.maxHp || 0;
    const acValue = typeof draft.stats.ac === "number"
      ? draft.stats.ac
      : Number.parseInt(String(draft.stats.ac), 10);
    // The offence axis comes from what the creature actually leads with. A creature that only
    // forces saves is rated on its DC; anything with an attack roll is rated on that.
    const attackBonus = parsed.features.reduce(
      (best, f) => Math.max(best, f.attackBonus ?? 0), 0);
    const saveDc = parsed.features.reduce(
      (best, f) => Math.max(best, f.saveDc ?? 0), 0);
    return estimateCreature({
      rawHp,
      ac: Number.isFinite(acValue) ? acValue : 15,
      ehpMultiplier: traitMultiplier,
      ehpAdjustment: 0,
      acAdjustment: 0,
      r1Dpr: trace.rounds[0]?.totalExpectedDamage ?? 0,
      r2PlusDpr: trace.rounds[1]?.totalExpectedDamage ?? 0,
      offenseBasis: attackBonus > 0 ? "attack" : "saveDc",
      attackBonus,
      saveDc,
      desiredCr,
    });
  }, [draft, desiredCr]);

  function updateStat<K extends keyof MainMonsterTemplate["stats"]>(key: K, val: MainMonsterTemplate["stats"][K]) {
    setDraft(d => ({ ...d, stats: { ...d.stats, [key]: val } }));
  }

  // ── Actions plumbing — legendary actions live in actions[] tagged legendaryCost ──

  /**
   * One `actions[]` array, three views. A row must appear in exactly ONE step or the same
   * action is editable from two places and the DM cannot tell which they are looking at —
   * so a slot-costed spell leaves the Actions list the moment it becomes one.
   */
  const standardActions = useMemo(() => draft.actions.map((a, i) => ({ a, i })).filter(({ a }) => !a.legendaryCost && typeof a.spellSlotLevel !== "number"), [draft.actions]);
  const legendaryActions = useMemo(() => draft.actions.map((a, i) => ({ a, i })).filter(({ a }) => !!a.legendaryCost), [draft.actions]);
  const slotSpells = useMemo(() => draft.actions.map((a, i) => ({ a, i })).filter(({ a }) => !a.legendaryCost && typeof a.spellSlotLevel === "number"), [draft.actions]);

  /** Defensive traits — the EHP multipliers. See the Defenses tab for why these are editable. */
  function updateDefense(idx: number, patch: Partial<{ name: string; ehpMultiplier: number; note: string }>) {
    setDraft(d => ({
      ...d,
      stats: { ...d.stats, defenses: (d.stats.defenses ?? []).map((x, i) => (i === idx ? { ...x, ...patch } : x)) },
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
        return formatAbilityEntry(l, s);
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
      </>
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
          {ABILITY_ORDER.map(label => (
            <div key={label}>
              <span style={{ ...labelStyle, textAlign: "center", fontWeight: 700 }}>{label}</span>
              <input type="number" value={scores[label]} onChange={e => setScore(label, Number(e.target.value) || 0)}
                style={{ ...inputStyle, textAlign: "center" }} />
              <div style={{ fontSize: 10, color: "#888", textAlign: "center", marginTop: 2 }}>
                {(() => { const m = Math.floor((scores[label] - 10) / 2); return `${m >= 0 ? "+" : ""}${m}`; })()}
              </div>
            </div>
          ))}
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
            RULE 1A. Every creature in the campaign library carries these, and until now they
            could ONLY be written in code — the editor showed the resulting ×multiplier on the
            estimator line and gave no way to author the traits producing it. A DM building a
            resistant creature in the app got a silent ×1.000 while a code-authored one got its
            real effective HP, so the same creature priced two different ways depending on who
            made it. That is exactly the half-built feature RULE 1A exists to catch. */}
        <div style={{ background: "#12121c", border: "1px solid #23233a", borderRadius: 6, padding: 10, marginTop: 10 }}>
          <span style={{ ...labelStyle, textTransform: "uppercase", letterSpacing: 1, color: "#34c759" }}>Defensive traits (effective-HP multipliers)</span>
          <p style={{ ...hintStyle, marginTop: 4 }}>
            What makes this creature harder to kill than its HP says. The multipliers <strong style={{ color: "#aaa" }}>multiply together</strong> — resistance to the party's main damage type is roughly ×1.4, a legendary-resistance-style bail-out ×1.15, a strong ranged/reposition game ×1.1. Leave empty for a creature whose HP is the whole story.
          </p>
          {(draft.stats.defenses ?? []).map((d, i) => (
            <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-end", marginTop: 6 }}>
              <div style={{ flex: 2, minWidth: 120 }}>
                <span style={labelStyle}>Trait</span>
                <input value={d.name} onChange={e => updateDefense(i, { name: e.target.value })} placeholder="Damage Resistance" style={inputStyle} />
              </div>
              <div style={{ width: 90 }}>
                <span style={labelStyle}>EHP ×</span>
                <input type="number" step="0.05" value={d.ehpMultiplier}
                  onChange={e => updateDefense(i, { ehpMultiplier: Number(e.target.value) || 1 })} style={inputStyle} />
              </div>
              <div style={{ flex: 3, minWidth: 140 }}>
                <span style={labelStyle}>Why (the arithmetic)</span>
                <input value={d.note ?? ""} onChange={e => updateDefense(i, { note: e.target.value })}
                  placeholder="half damage from the party's two main types" style={inputStyle} />
              </div>
              <SmallBtn color="#ff6b6b" onClick={() => removeDefense(i)}>✕</SmallBtn>
            </div>
          ))}
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
            <SmallBtn color="#34c759" onClick={() => addDefense()}>+ Defensive trait</SmallBtn>
            <span style={{ fontSize: 11, color: "#99a" }}>
              Combined <strong style={{ color: "#dfe4ff" }}>
                ×{(draft.stats.defenses ?? []).reduce((p, d) => p * (d.ehpMultiplier || 1), 1).toFixed(3)}
              </strong> → effective HP <strong style={{ color: "#dfe4ff" }}>
                {Math.round(draft.stats.maxHp * (draft.stats.defenses ?? []).reduce((p, d) => p * (d.ehpMultiplier || 1), 1))}
              </strong>
            </span>
          </div>
          <div style={{ marginTop: 10, maxWidth: 320 }}>
            <span style={labelStyle}>Damage uptime (0–1)</span>
            <input type="number" step="0.01" min={0.1} max={1}
              value={draft.stats.damageUptime ?? 1}
              onChange={e => updateStat("damageUptime", Math.min(1, Math.max(0.1, Number(e.target.value) || 1)))}
              style={inputStyle} />
            <p style={{ ...hintStyle, marginTop: 2 }}>
              The share of rounds this creature is actually <em>dealing</em> its damage. 1 = every round. Drop it for a creature that spends rounds repositioning, cycling an aura, or out of reach — the checker divides its output by this, so 0.86 means it needs to be worth more per active round to hit the same pressure.
            </p>
          </div>
        </div>

        {/* ── THE WORKBOOK'S CREATURE ESTIMATOR ──────────────────────────────────────────
            A faithful port of the v4 audit workbook's "Creature Estimator" sheet, reading THIS
            creature rather than asking for its numbers again: raw HP and AC from the fields
            above, the trait multiplier as the PRODUCT of its authored defences, and the DPR from
            its own traced action schedule — the same trace the encounter checker uses, so the
            estimate and the encounter check can never disagree about what the creature does.

            The sheet's own bounds, quoted because they limit what this may claim: *"it is not an
            official CR ruling and it never rewrites a creature's printed action budget."* So it
            SUGGESTS a range. Nothing here writes to the creature. */}
        <div style={{ background: "#12121c", border: "1px solid #23233a", borderRadius: 6, padding: 10, marginTop: 10 }}>
          <span style={{ ...labelStyle, textTransform: "uppercase", letterSpacing: 1, color: "#4f9dff" }}>
            Creature estimator — workbook v4
          </span>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 6, flexWrap: "wrap", fontSize: 11, color: "#99a" }}>
            <span>EHP multiplier <strong style={{ color: "#dfe4ff" }}>×{estimate.ehpMultiplier.toFixed(3)}</strong></span>
            <span>effective AC <strong style={{ color: "#dfe4ff" }}>{estimate.effectiveAc}</strong></span>
            <span>effective HP <strong style={{ color: "#dfe4ff" }}>{estimate.effectiveHp.toFixed(0)}</strong></span>
            <span>three-round DPR <strong style={{ color: "#dfe4ff" }}>{estimate.modeledDpr.toFixed(1)}</strong></span>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 4, flexWrap: "wrap", fontSize: 11, color: "#99a" }}>
            <span>defensive CR <strong style={{ color: "#dfe4ff" }}>{estimate.baseDefensiveCr}</strong>
              <span style={{ color: "#667" }}> → AC-adj {estimate.acAdjustedDefensiveCr}</span></span>
            <span>offensive CR <strong style={{ color: "#dfe4ff" }}>{estimate.baseOffensiveCr}</strong>
              <span style={{ color: "#667" }}> → atk/DC-adj {estimate.deliveryAdjustedOffensiveCr}</span></span>
            <span>suggested <strong style={{ color: "#7be08a" }}>{estimate.crRange}</strong>
              <span style={{ color: "#667" }}> centre {estimate.estimatedCr}</span></span>
            {estimate.capStatus !== "WITHIN CR 0-25 TABLE" && (
              <span style={{ color: "#e8b64c" }}>{estimate.capStatus}</span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginTop: 8, flexWrap: "wrap" }}>
            <div style={{ width: 120 }}>
              <span style={labelStyle}>Desired CR</span>
              <input type="number" min={1} max={20} value={desiredCr ?? ""} placeholder="—"
                onChange={e => setDesiredCr(e.target.value ? Math.max(1, Math.min(20, Number(e.target.value))) : undefined)}
                style={inputStyle} />
            </div>
            <p style={{ ...hintStyle, flex: 1, minWidth: 220, margin: 0 }}>{estimate.guidance}</p>
          </div>
          <p style={{ ...hintStyle, margin: "6px 0 0" }}>
            Estimated from selected SRD medians — a practical range, not an official CR ruling. The
            DPR is this creature's own traced schedule, so it already respects Recharge, use limits
            and gating. Nothing here writes to the creature.
          </p>
        </div>
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
          <SmallBtn color="#9d8cff" onClick={() => addListItem("actions", { name: "", kind: "spell", spellSlotLevel: 1, slotCandidate: true })}>+ Add spell</SmallBtn>
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
          <span title="Monsters you create are saved to your personal My Library" style={{ fontSize: 9, padding: "1px 7px", borderRadius: 8, background: "#16291b", border: "1px solid #2f7d3f", color: "#7be08a", textTransform: "uppercase", letterSpacing: 1 }}>My Library</span>
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
