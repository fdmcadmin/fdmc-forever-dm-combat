import { useMemo, useState } from "react";
import type { MonsterCombatCandidate } from "../MonsterJconScanner";
import { createEncounterMonsterInstance, type MainEncounterMonsterInstance, type MainMonsterTemplate, type MainMonsterVisibilityState } from "./mainMonsterRuntime";

type MonsterRuntimeSetupSlotProps = {
  roster: MonsterCombatCandidate[];
  library: MainMonsterTemplate[];
  activeMonsterId: string;
  onAddInstance: (monster: MainEncounterMonsterInstance) => void;
  onSetActiveMonster: (monsterId: string) => void;
  onUpdateInstance: (monsterId: string, patch: Partial<Pick<MainEncounterMonsterInstance, "currentHp" | "tempHp" | "status" | "visibilityState" | "hiddenName" | "isNameRevealed">>) => void;
  onRemoveInstance: (monsterId: string) => void;
};

function asEncounterMonster(candidate: MonsterCombatCandidate): MainEncounterMonsterInstance | undefined {
  if (typeof (candidate as { instanceId?: unknown }).instanceId !== "string") {
    return undefined;
  }

  return candidate as MainEncounterMonsterInstance;
}

const visibilityOptions: MainMonsterVisibilityState[] = ["hidden", "label-only", "condition", "hp-bar", "full"];

export function MonsterRuntimeSetupSlot({ roster, library, activeMonsterId, onAddInstance, onSetActiveMonster, onUpdateInstance, onRemoveInstance }: MonsterRuntimeSetupSlotProps) {
  const [addVisibilityState, setAddVisibilityState] = useState<MainMonsterVisibilityState>("hidden");
  const [selectedTemplateId, setSelectedTemplateId] = useState(library[0]?.templateId ?? "");
  const selectedTemplate = library.find((template) => template.templateId === selectedTemplateId) ?? library[0];
  const [hiddenName, setHiddenName] = useState(selectedTemplate?.visibility.hiddenName ?? "Unrevealed creature");
  const [stagedMonsters, setStagedMonsters] = useState<MainEncounterMonsterInstance[]>([]);
  const encounterRoster = roster.map(asEncounterMonster).filter((entry): entry is MainEncounterMonsterInstance => Boolean(entry));
  const activeMonster = encounterRoster.find((monster) => monster.instanceId === activeMonsterId) ?? encounterRoster[0];
  const groupedTemplates = useMemo(() => Object.entries(
    library.reduce<Record<string, MainMonsterTemplate[]>>((groups, template) => {
      const key = template.encounterId ?? "standalone";
      groups[key] = [...(groups[key] ?? []), template];
      return groups;
    }, {})
  ), [library]);

  function stageSelectedMonster() {
    if (!selectedTemplate) {
      return;
    }
    const monster = createEncounterMonsterInstance(selectedTemplate);
    monster.visibilityState = addVisibilityState;
    monster.hiddenName = hiddenName.trim() || selectedTemplate.visibility.hiddenName;
    monster.isNameRevealed = addVisibilityState === "full";
    setStagedMonsters((current) => [...current, monster]);
  }

  function sendStagedMonster(instanceId: string) {
    setStagedMonsters((current) => {
      const monster = current.find((entry) => entry.instanceId === instanceId);
      if (monster) {
        onAddInstance(monster);
      }
      return current.filter((entry) => entry.instanceId !== instanceId);
    });
  }

  function removeStagedMonster(instanceId: string) {
    setStagedMonsters((current) => current.filter((entry) => entry.instanceId !== instanceId));
  }

  function clearStagedMonsters() {
    setStagedMonsters([]);
  }

  function sendAllStagedMonsters() {
    setStagedMonsters((current) => {
      current.forEach((monster) => onAddInstance(monster));
      return [];
    });
  }

  return (
    <section className="controlled-intake-card monster-runtime-setup-slot" aria-label="Unified monster library and runtime setup">
      <p className="eyebrow">Monster Library</p>
      <h3>Import Monster Actor / HP Tracker</h3>
      <p className="subtle">
        Source templates stay in the app bundle. Room metadata stores only compact live monster HP, visibility, action-use state, and template refs.
      </p>

      <div className="intake-button-row">
        <label className="field-label">
          Selected monster
          <input value={selectedTemplate?.name ?? "None"} readOnly />
        </label>
        <label className="field-label">
          Player-facing name
          <input value={hiddenName} onChange={(event) => setHiddenName(event.target.value)} />
        </label>
        <label className="field-label">
          Entry visibility
          <select value={addVisibilityState} onChange={(event) => setAddVisibilityState(event.target.value as MainMonsterVisibilityState)}>
            <option value="hidden">hidden</option>
            <option value="label-only">masked name</option>
            <option value="condition">masked + condition</option>
            <option value="hp-bar">masked + hp bar</option>
            <option value="full">revealed</option>
          </select>
        </label>
        <button className="secondary-button" type="button" onClick={stageSelectedMonster}>
          Stage Monster
        </button>
      </div>

      <div className="monster-runtime-column">
        <p className="panel-title">Pre-Combat Staging</p>
        {stagedMonsters.length === 0 ? (
          <p className="subtle">No staged monsters yet. Select from the library, then stage before sending to combat.</p>
        ) : (
          <>
            {stagedMonsters.map((monster) => (
              <article className="roster-row" key={monster.instanceId}>
                <span>
                  <strong>{monster.displayName}</strong>
                  <small>{monster.templateId} - HP {monster.currentHp}/{monster.maxHp} - {monster.visibilityState}</small>
                </span>
                <div className="intake-button-row compact-row">
                  <button className="secondary-button compact" type="button" onClick={() => sendStagedMonster(monster.instanceId)}>
                    Send to Combat
                  </button>
                  <button className="secondary-button compact danger" type="button" onClick={() => removeStagedMonster(monster.instanceId)}>
                    Remove
                  </button>
                </div>
              </article>
            ))}
            <div className="intake-button-row compact-row">
              <button className="secondary-button compact" type="button" onClick={sendAllStagedMonsters}>
                Send All to Combat
              </button>
              <button className="secondary-button compact danger" type="button" onClick={clearStagedMonsters}>
                Clear Staged
              </button>
            </div>
          </>
        )}
      </div>

      <div className="encounter-group-library" aria-label="Encounter grouped monster library">
        {groupedTemplates.map(([encounterId, templates]) => (
          <div key={encounterId} className="encounter-group">
            <div className="encounter-group-header">
              <p className="eyebrow">{templates[0].encounterLabel ?? encounterId}</p>
            </div>
            {templates.map((template) => (
              <div key={template.templateId} className="encounter-group-template-row">
                <span>{template.name}</span>
                <button
                  className="secondary-button compact"
                  type="button"
                  onClick={() => {
                    setSelectedTemplateId(template.templateId);
                    setHiddenName(template.visibility.hiddenName ?? "Unrevealed creature");
                  }}
                >
                  Select
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="monster-runtime-grid">
        <div className="monster-runtime-column">
          <p className="panel-title">Encounter Roster</p>
          {encounterRoster.length === 0 ? (
            <p className="subtle">No monster instances in the encounter roster yet.</p>
          ) : (
            encounterRoster.map((monster) => (
              <article className={`roster-row ${monster.instanceId === activeMonster?.instanceId ? "active" : ""}`} key={monster.instanceId}>
                <span>
                  <strong>{monster.displayName}</strong>
                  <small>{monster.templateId} · HP {monster.currentHp}/{monster.maxHp} · {monster.visibilityState}</small>
                </span>
                <div className="intake-button-row compact-row">
                  <button className="secondary-button compact" type="button" onClick={() => onSetActiveMonster(monster.instanceId)}>
                    Set Active
                  </button>
                  <button className="secondary-button compact danger" type="button" onClick={() => onRemoveInstance(monster.instanceId)}>
                    Remove
                  </button>
                </div>
              </article>
            ))
          )}
        </div>

        <div className="monster-runtime-column">
          <p className="panel-title">Active Monster Instance</p>
          {activeMonster ? (
            <article className="monster-runtime-active-card">
              <h4>{activeMonster.displayName}</h4>
              <p className="subtle">instanceId: {activeMonster.instanceId}</p>
              <div className="monster-combat-stat-grid">
                <span><strong>AC</strong>{activeMonster.ac}</span>
                <span><strong>HP</strong>{activeMonster.currentHp}/{activeMonster.maxHp}</span>
                <span><strong>Temp</strong>{activeMonster.tempHp}</span>
                <span><strong>Status</strong>{activeMonster.status}</span>
              </div>
              <div className="monster-runtime-controls" aria-label="Shared monster HP and visibility controls">
                <label className="field-label">
                  Current HP
                  <input
                    inputMode="numeric"
                    value={String(activeMonster.currentHp)}
                    onChange={(event) => {
                      const nextHp = Number.parseInt(event.target.value.replace(/[^0-9-]/g, ""), 10);
                      if (Number.isFinite(nextHp)) {
                        onUpdateInstance(activeMonster.instanceId, { currentHp: Math.max(0, Math.min(activeMonster.maxHp, nextHp)) });
                      }
                    }}
                  />
                </label>
                <label className="field-label">
                  Visibility
                  <select
                    value={activeMonster.visibilityState}
                    onChange={(event) => onUpdateInstance(activeMonster.instanceId, { visibilityState: event.target.value as MainMonsterVisibilityState })}
                  >
                    {visibilityOptions.map((option) => <option value={option} key={option}>{option}</option>)}
                  </select>
                </label>
                <label className="field-label">
                  Player-facing name
                  <input
                    value={activeMonster.hiddenName}
                    onChange={(event) => onUpdateInstance(activeMonster.instanceId, { hiddenName: event.target.value })}
                  />
                </label>
                <div className="intake-button-row compact-row">
                  <button className="secondary-button compact" type="button" onClick={() => onUpdateInstance(activeMonster.instanceId, { currentHp: Math.max(0, activeMonster.currentHp - 5) })}>-5 HP</button>
                  <button className="secondary-button compact" type="button" onClick={() => onUpdateInstance(activeMonster.instanceId, { currentHp: Math.min(activeMonster.maxHp, activeMonster.currentHp + 5) })}>+5 HP</button>
                  <button className="secondary-button compact" type="button" onClick={() => onUpdateInstance(activeMonster.instanceId, { currentHp: activeMonster.maxHp, tempHp: 0, status: "ready" })}>Reset HP</button>
                  <button className="secondary-button compact" type="button" onClick={() => onUpdateInstance(activeMonster.instanceId, { isNameRevealed: true, visibilityState: "full" })}>Reveal Name</button>
                  <button className="secondary-button compact" type="button" onClick={() => onUpdateInstance(activeMonster.instanceId, { isNameRevealed: false })}>Mask Name</button>
                </div>
              </div>
              <div className="monster-combat-actions">
                <p className="panel-title">DM Runtime Actions</p>
                {activeMonster.actions?.slice(0, 6).map((action) => (
                  <article className="monster-combat-action-card ready" key={`${activeMonster.instanceId}-${action.name}`}>
                    <div className="monster-combat-action-head">
                      <strong>{action.name}</strong>
                      <span>{action.kind}</span>
                    </div>
                    <div className="monster-combat-action-lines">
                      {action.roll && <span>Attack {action.roll}</span>}
                      {action.damage && <span>Damage {action.damage}</span>}
                      {action.save && <span>Save {action.save}</span>}
                      {action.text && <p>{action.text}</p>}
                    </div>
                  </article>
                ))}
              </div>
            </article>
          ) : (
            <p className="subtle">Set or add a monster instance to preview the active monster.</p>
          )}
        </div>
      </div>
    </section>
  );
}
