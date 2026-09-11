/**
 * THE CHECKS STEP — eighteen skills, ticked for proficiency, derived rather than typed.
 *
 * Christopher, 2026-09-10: *"why did raphael not get the checks, this wasnt build by me but
 * generated because checks should come from the SRD."*
 *
 * ⚠ `checks` WAS A TAB THE CARD RENDERED AND THE EDITOR COULD NOT OPEN. `EDITOR_TABS` ran
 * profile · combat · features · bonds · spells · resources · equipment · notes — no Checks step —
 * while `orderedTabs` on the card renders one. That is the `check:featstab` shape exactly: *"a tab
 * the card reads and the editor cannot open is invisible data."* It is why five sheets carry all
 * eighteen rows (from the hand-built module helper) and Raphael carries none: there was no route
 * to make them.
 *
 * ⚠ AND THE EXISTING ROWS ARE FROZEN. Ripsnarl's Athletics is `1d20+7` — a number correct at the
 * level it was typed. Rows made here are `1d20+@STR+@PROF`, so an ASI or a proficiency step moves
 * all eighteen at once. **The list itself is never written down** — `resolveSkillChecks` publishes
 * the eighteen while the mod is loaded, and a sheet stores only what deviates from them.
 */

import { useMemo } from "react";
import type { ActorAction } from "../types/tabs";
import {
  SRD_SKILLS, SKILL_BY_NAME, skillCheckRow, skillFormula,
  proficiencyFromFormula,
} from "../../modules/dnd-5e/srdSkills";

export function SkillChecksEditor({
  actions,
  onChange,
}: {
  actions: ActorAction[];
  onChange: (next: ActorAction[]) => void;
}) {
  const byLabel = useMemo(() => {
    const m = new Map<string, ActorAction>();
    for (const a of actions) m.set((a.label ?? "").trim().toLowerCase(), a);
    return m;
  }, [actions]);

  /**
   * ⚠ THE TICK REWRITES THE FORMULA, WHICH IS THE ONLY WAY IT CAN BE HONEST ON A FROZEN ROW.
   * A sheet carrying `1d20+7` states a total and not its parts, so there is nothing to add `@PROF`
   * to — ticking rebuilds the row from the SRD skill instead, and the row says so before you press.
   *
   * ⚠ AND UNTICKING REMOVES THE STORED ROW RATHER THAN WRITING AN UNPROFICIENT ONE. The generated
   * row already says the same thing, so storing it would be a second copy of the mod's own list —
   * eighteen of them per character, which is what the party's exports carry today.
   */
  function setProficient(name: string, proficient: boolean, expertise: boolean) {
    const skill = SKILL_BY_NAME.get(name.toLowerCase());
    if (!skill) return;
    const key = name.toLowerCase();
    const others = actions.filter(a => (a.label ?? "").trim().toLowerCase() !== key);
    onChange(proficient ? [...others, skillCheckRow(skill, true, expertise)] : others);
  }

  const cell: React.CSSProperties = { fontSize: 11, padding: "3px 6px", borderBottom: "1px solid #1e1e2e" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/*
        ⚠ THERE IS NO "ADD THE SKILLS" BUTTON, AND THAT IS THE POINT. Christopher: *"they are listed
        as srd so shouldnt need to be created once the dnd mode is loaded."* All eighteen are
        published by the mod and render on the card whether or not this sheet stores a single row;
        what gets SAVED is only what deviates from them.
      */}
      <span style={{ fontSize: 10, color: "#667" }}>
        All eighteen come from the SRD while the D&amp;D mod is loaded — nothing to create. Ticking
        proficiency saves a row; unticking removes it, because the generated row already says so.
      </span>

      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr style={{ fontSize: 10, color: "#667", textTransform: "uppercase", letterSpacing: 1 }}>
            <th style={{ ...cell, textAlign: "left" }}>Skill</th>
            <th style={{ ...cell, textAlign: "left", width: 44 }}>Abil</th>
            <th style={{ ...cell, width: 40 }}>Prof</th>
            <th style={{ ...cell, width: 40 }}>Exp</th>
            <th style={{ ...cell, textAlign: "left" }}>Formula</th>
          </tr>
        </thead>
        <tbody>
          {SRD_SKILLS.map(skill => {
            const row = byLabel.get(skill.name.toLowerCase());
            const formula = row?.metadata?.attack ?? row?.description ?? "";
            const { proficient, expertise } = proficiencyFromFormula(formula);
            /**
             * ⚠ A ROW WHOSE FORMULA IS A BARE NUMBER IS CALLED OUT. It cannot say whether it
             * includes proficiency, so the tick state is a guess — saying so is the difference
             * between a reading and a claim, and it is how the frozen rows get found.
             */
            const frozen = Boolean(row) && !/@/.test(formula);
            return (
              <tr key={skill.name}>
                <td style={{ ...cell, color: "#dfe4ff" }}>{skill.name}</td>
                <td style={{ ...cell, color: "#8a8aa0" }}>{skill.ability.toUpperCase()}</td>
                <td style={{ ...cell, textAlign: "center" }}>
                  <input type="checkbox" checked={proficient} aria-label={`${skill.name} proficient`}
                    onChange={e => setProficient(skill.name, e.target.checked, e.target.checked && expertise)} />
                </td>
                <td style={{ ...cell, textAlign: "center" }}>
                  <input type="checkbox" checked={expertise} disabled={!proficient} aria-label={`${skill.name} expertise`}
                    onChange={e => setProficient(skill.name, true, e.target.checked)} />
                </td>
                <td style={{ ...cell, color: frozen ? "#e8b64c" : "#7be08a", fontFamily: "monospace" }}>
                  {row ? formula : skillFormula(skill, false)}
                  {frozen && <span style={{ color: "#e8b64c" }}> — frozen total, tick to rebuild</span>}
                  {!row && <span style={{ color: "#667" }}> — generated, not stored</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/*
        ⚠ CUSTOM CHECKS ARE NOT SWEPT UP BY THIS TABLE. A sheet may carry a check that is not one of
        the eighteen — a tool, a save, a campaign roll — and it is listed here so the Checks step is
        the whole tab rather than the SRD's part of it.
      */}
      {actions.filter(a => !SKILL_BY_NAME.has((a.label ?? "").trim().toLowerCase())).length > 0 && (
        <div>
          <span style={{ fontSize: 10, color: "#667", textTransform: "uppercase", letterSpacing: 1 }}>
            Other checks on this sheet
          </span>
          {actions.filter(a => !SKILL_BY_NAME.has((a.label ?? "").trim().toLowerCase())).map(a => (
            <div key={a.id || a.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, padding: "3px 0" }}>
              <strong style={{ color: "#dfe4ff", minWidth: 140 }}>{a.label}</strong>
              <span style={{ fontFamily: "monospace", color: "#8a8aa0", flex: 1 }}>
                {a.metadata?.attack ?? a.description ?? ""}
              </span>
              <button type="button"
                onClick={() => onChange(actions.filter(x => x !== a))}
                style={{ fontSize: 10, padding: "2px 8px", background: "transparent", border: "1px solid #5a1a1a",
                         borderRadius: 3, color: "#ff9999", cursor: "pointer" }}>Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

