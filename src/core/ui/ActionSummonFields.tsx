/**
 * ATTACHING A SUMMON TO A CHARACTER'S ACTION — the field that never existed.
 *
 * Christopher, 2026-11-10: *"fix the spell for lightstone."*
 *
 * ── ⚠ THE SPELL WAS NEVER WIRED, AND IT COULD NOT BE ────────────────────────────────────────
 *
 * Lights Stone's Find Steed reads *"summon an Otherworldly Steed … Choose Celestial, Fey, or
 * Fiend. Use the summoned steed's stat block"* — and its metadata carries no `summon` at all, so
 * casting it spent the free cast and put nothing on the field. That was not an oversight on his
 * sheet: **nothing in the app could write that field.** `metadata.summon` has existed on the type
 * since summons landed, `ActorCard` calls `onSummonBody` whenever an action carries one, and
 * `check:summontracker` proves the body reaches the chart — but the only writer anywhere was the
 * monster side. A player's spell had no way to declare what it calls.
 *
 * ⚠ AND IT IS NOT INFERRED FROM THE NAME. A spell called "Find Steed" does not get a steed
 * because of what it is called — that is the rule this project keeps ("tag from stated fields
 * only, never item names or descriptions"). The DM points it at a creature; the app reads the
 * pointer.
 *
 * ── ⚠ THE FORM IS A CAST-TIME CHOICE, SO IT CAN BE LEFT OPEN ────────────────────────────────
 *
 * The Otherworldly Steed is ONE template with three form packages — Celestial / Fey / Fiend —
 * exactly the shape the Elemental Mirror uses, and `check:summons` proves all three. The spell
 * says "choose" on each casting, so this offers "ask when cast" as well as a fixed form: a DM who
 * wants the choice made at the table leaves it open, and the card asks.
 */

import { useMemo } from "react";
import type { SummonSpec } from "../monsters/summon";
import type { MainMonsterTemplate } from "../monsters/runtime/mainMonsterRuntime";
import { useLazyMonsterLibrary } from "../monsters/useLazyMonsterLibrary";

/** The option names inside a template's first action set — "Celestial", "Fey", "Fiend". */
export function formOptionsFor(template: MainMonsterTemplate | undefined): { setId: string; label: string; options: string[] } | null {
  const set = template?.actionSets?.[0];
  if (!set) return null;
  const options: string[] = [];
  for (const action of template?.actions ?? []) {
    const a = action as { setId?: string; setOption?: string };
    if (a.setId === set.id && a.setOption && !options.includes(a.setOption)) options.push(a.setOption);
  }
  return options.length > 0 ? { setId: set.id, label: set.label ?? "Form", options } : null;
}

const labelStyle = { fontSize: 12, display: "block" as const };
const inputStyle = {
  display: "block" as const, width: "100%", marginTop: 2, padding: "4px 8px",
  borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff",
};
const hintStyle = { fontSize: 10, color: "#555", marginTop: 2, display: "block" as const };

export function ActionSummonFields({ value, onChange }: {
  value: SummonSpec | undefined;
  onChange: (next: SummonSpec | undefined) => void;
}) {
  /**
   * ⚠ LOADED ONLY WHEN THIS BLOCK IS OPEN. The library is ~800KB of stat blocks; the editor asks
   * for it when a summon is actually being authored, which is the same bargain
   * `useLazyMonsterLibrary` was written for.
   */
  const library = useLazyMonsterLibrary(true);
  const template = useMemo(
    () => library.find(t => t.templateId === value?.templateId),
    [library, value?.templateId],
  );
  const forms = useMemo(() => formOptionsFor(template), [template]);
  const picked = forms ? (value?.picks?.[forms.setId]?.[0] ?? "") : "";

  const patch = (next: Partial<SummonSpec>) => onChange({ ...(value ?? {}), ...next });

  if (!value) {
    return (
      <label style={{ ...labelStyle, display: "flex", alignItems: "flex-start", gap: 7 }}>
        <input type="checkbox" checked={false} onChange={() => onChange({})} style={{ marginTop: 2 }} />
        <span>
          Summons a creature
          <span style={hintStyle}>
            Find Steed, an Eldritch Cannon, a bond-creature. The body arrives on the combat tracker
            with its own HP when this action is used.
          </span>
        </span>
      </label>
    );
  }

  return (
    <div style={{ display: "grid", gap: 7, padding: "8px 9px", border: "1px solid #2a2a3e", borderRadius: 6, background: "#101018" }}>
      <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 7 }}>
        <input type="checkbox" checked onChange={() => onChange(undefined)} />
        <span style={{ fontWeight: 700, color: "#9d8cff" }}>Summons a creature</span>
      </label>

      <label style={labelStyle}>
        Creature
        <select
          value={value.templateId ?? ""}
          onChange={e => {
            const next = library.find(t => t.templateId === e.target.value);
            const choices = formOptionsFor(next);
            // Baked onto the action so the player’s card can offer the forms without the library.
            patch({ templateId: e.target.value || undefined, picks: undefined, formChoices: choices ?? undefined });
          }}
          style={inputStyle}
        >
          <option value="">— pick a creature —</option>
          {[...library]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(t => <option key={t.templateId} value={t.templateId}>{t.name}</option>)}
        </select>
        <span style={hintStyle}>
          {library.length === 0
            ? "Loading the creature library…"
            : "The body that arrives. Its numbers scale off the caster and the slot spent — nothing is copied onto this action."}
        </span>
      </label>

      {/*
        ⚠ "ASK WHEN CAST" IS THE DEFAULT FOR A REASON. Find Steed says *"Choose Celestial, Fey, or
        Fiend"* on each casting, so fixing one here would quietly take the choice away from the
        player for every future cast.
      */}
      {forms && (
        <label style={labelStyle}>
          {forms.label}
          <select
            value={picked}
            onChange={e => patch({ picks: e.target.value ? { [forms.setId]: [e.target.value] } : undefined })}
            style={inputStyle}
          >
            <option value="">Ask when cast</option>
            {forms.options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <span style={hintStyle}>
            This creature comes in {forms.options.length} forms ({forms.options.join(", ")}). Leave
            on “Ask when cast” and the card offers the choice each time it is used.
          </span>
        </label>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
        <label style={labelStyle}>
          How many
          <input
            type="number" min={1} value={value.count ?? ""}
            onChange={e => patch({ count: e.target.value ? Math.max(1, Number(e.target.value)) : undefined })}
            placeholder="1" style={inputStyle}
          />
          <span style={hintStyle}>One row per body.</span>
        </label>
        <label style={labelStyle}>
          Lasts (rounds)
          <input
            type="number" min={1} value={value.durationRounds ?? ""}
            onChange={e => patch({ durationRounds: e.target.value ? Math.max(1, Number(e.target.value)) : undefined })}
            placeholder="until it drops" style={inputStyle}
          />
          <span style={hintStyle}>Blank = until killed or dismissed.</span>
        </label>
      </div>

      {/*
        ⚠ THIS ONE CHANGES THE PRICE, not just the display. A body on its OWN initiative adds a
        whole turn to the round; one that acts on the summoner's turn does not. Reading the second
        as the first hands the party a free extra combatant every round.
      */}
      <label style={labelStyle}>
        Acts on
        <select
          value={value.acts ?? "own-initiative"}
          onChange={e => patch({ acts: e.target.value as SummonSpec["acts"] })}
          style={inputStyle}
        >
          <option value="own-initiative">Its own initiative</option>
          <option value="summoner-turn">The summoner's turn</option>
        </select>
        <span style={hintStyle}>
          A steed rolls its own; a bond-creature that “acts on your turn” does not.
        </span>
      </label>
    </div>
  );
}
