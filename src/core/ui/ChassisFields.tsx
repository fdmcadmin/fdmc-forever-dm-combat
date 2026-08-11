/**
 * ChassisFields — the authoring block for an ADAPTIVE item.
 *
 * One component, used by BOTH item editors (the bag editor and the library panel). They are
 * separate files with separate forms, and a field added to only one of them is a field the DM
 * cannot reach from half the app — that is exactly how the attunement checkbox went missing.
 *
 * The point of this block is that a chassis is authored as a FILTER, not as a list of weapons:
 * you say "Two-Handed, Strength" and the item becomes any of the eight forms that match. The
 * live preview below the filter is the important part — it shows what the constraint actually
 * catches while you are writing it, instead of finding out at attach time that "Reach" matched
 * three things, or nothing.
 */

import { BASE_WEAPONS } from "../constants/baseWeapons";
import { matchingForms, type ChassisSpec } from "../constants/chassis";
import { WEAPON_CATEGORIES } from "../constants/weaponMastery";
import type { EquipmentItem } from "./EquipmentBagEditor";

/** Every tag the base weapon table actually uses — derived, so it cannot drift from the data. */
const ALL_TAGS = Array.from(new Set(BASE_WEAPONS.flatMap(w => w.tags))).sort();

type Props = {
  draft: EquipmentItem;
  set: <K extends keyof EquipmentItem>(key: K, value: EquipmentItem[K]) => void;
};

const box: React.CSSProperties = {
  background: "#0d0d14", border: "1px solid #2a2a3e", borderRadius: 6, padding: 10,
  display: "flex", flexDirection: "column", gap: 8,
};
const chip = (on: boolean): React.CSSProperties => ({
  fontSize: 10, padding: "2px 8px", borderRadius: 10, cursor: "pointer",
  background: on ? "rgba(123,104,238,0.18)" : "transparent",
  border: `1px solid ${on ? "rgba(123,104,238,0.5)" : "#333"}`,
  color: on ? "#9d8cff" : "#777",
});

export function ChassisFields({ draft, set }: Props) {
  const spec = draft.chassis;
  const on = Boolean(spec);

  const patch = (next: Partial<ChassisSpec>) => set("chassis", { ...(spec ?? {}), ...next });
  const toggleIn = (list: string[] | undefined, value: string): string[] => {
    const current = list ?? [];
    return current.includes(value) ? current.filter(v => v !== value) : [...current, value];
  };

  const forms = matchingForms(spec);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
        <input type="checkbox" checked={on}
          onChange={e => set("chassis", e.target.checked ? {} : undefined)} />
        Adaptive item — the wielder picks the weapon form (a chassis)
      </label>

      {on && (
        <div style={box}>
          <div style={{ fontSize: 10, color: "#666" }}>
            Authored as a FILTER. "Two-Handed Strength Weapon" is a constraint — every matching
            base weapon becomes a legal form, so one entry replaces one Gift per weapon.
          </div>

          <div>
            <div style={{ fontSize: 11, color: "#aaa", marginBottom: 3 }}>Categories <span style={{ color: "#555" }}>(any, if none selected)</span></div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {WEAPON_CATEGORIES.map(c => (
                <button key={c} type="button" style={chip(Boolean(spec?.categories?.includes(c)))}
                  onClick={() => patch({ categories: toggleIn(spec?.categories, c) })}>{c}</button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: "#aaa", marginBottom: 3 }}>Ability</div>
            <div style={{ display: "flex", gap: 4 }}>
              {(["any", "STR", "DEX"] as const).map(a => (
                <button key={a} type="button" style={chip((spec?.ability ?? "any") === a)}
                  onClick={() => patch({ ability: a })}>{a}</button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: "#aaa", marginBottom: 3 }}>
              Must have ALL of <span style={{ color: "#555" }}>— "Thrown", "Reach"</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {ALL_TAGS.map(t => (
                <button key={t} type="button" style={chip(Boolean(spec?.requireTags?.includes(t)))}
                  onClick={() => patch({ requireTags: toggleIn(spec?.requireTags, t) })}>{t}</button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: "#aaa", marginBottom: 3 }}>
              Must have ANY of <span style={{ color: "#555" }}>— this is how "Finesse OR Light" is expressed</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {ALL_TAGS.map(t => (
                <button key={t} type="button" style={chip(Boolean(spec?.anyOfTags?.includes(t)))}
                  onClick={() => patch({ anyOfTags: toggleIn(spec?.anyOfTags, t) })}>{t}</button>
              ))}
            </div>
          </div>

          {/* THE LIVE PREVIEW — what the filter actually catches, while you are writing it. */}
          <div style={{ borderTop: "1px solid #2a2a3e", paddingTop: 7 }}>
            <div style={{ fontSize: 11, color: forms.length === 0 ? "#e07b39" : "#4caf50", marginBottom: 3 }}>
              {forms.length === 0
                ? "Matches NO forms — this chassis cannot be built into anything."
                : `Matches ${forms.length} form${forms.length === 1 ? "" : "s"}`}
            </div>
            <div style={{ fontSize: 10, color: "#777", lineHeight: 1.5 }}>
              {forms.map(f => f.name).join(" · ") || "—"}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, borderTop: "1px solid #2a2a3e", paddingTop: 7 }}>
            <label style={{ fontSize: 12 }}>Magic bonus
              <input type="number" value={draft.chassisBonus ?? 0}
                onChange={e => set("chassisBonus", Number.parseInt(e.target.value, 10) || 0)}
                title="Added to BOTH attack and damage. Authored, never inferred from the name."
                style={{ width: "100%", padding: "3px 6px", fontSize: 12, background: "#111", border: "1px solid #333", borderRadius: 3, color: "#ddd" }} />
            </label>
            <label style={{ fontSize: 12 }}>Pre-set form <span style={{ color: "#555", fontSize: 10 }}>(optional)</span>
              <select value={spec?.formId ?? ""} onChange={e => patch({ formId: e.target.value || undefined })}
                title="Leave blank to let the form be chosen when the item is attached."
                style={{ width: "100%", padding: "3px 6px", fontSize: 12, background: "#111", border: "1px solid #333", borderRadius: 3, color: "#ddd" }}>
                <option value="">— chosen on attach —</option>
                {forms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </label>
          </div>

          <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={Boolean(draft.grantsProficiency)}
              onChange={e => set("grantsProficiency", e.target.checked || undefined)} />
            Grants proficiency <span style={{ color: "#666", fontSize: 10 }}>— @PROF applies even untrained</span>
          </label>
          <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={Boolean(draft.pbToDamage)}
              onChange={e => set("pbToDamage", e.target.checked || undefined)} />
            Adds Proficiency Bonus to damage
          </label>

          <div style={{ fontSize: 10, color: "#666", borderTop: "1px solid #2a2a3e", paddingTop: 7 }}>
            The form's weapon MASTERY carries through, but it is not granted — the character
            still has to have that mastery active to use it. A versatile form gets a 1H/2H
            switch on the player's equipment panel.
          </div>
        </div>
      )}
    </div>
  );
}
