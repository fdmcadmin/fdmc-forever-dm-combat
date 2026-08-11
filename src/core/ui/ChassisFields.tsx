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
import type { EquipmentItem, ItemRider } from "./EquipmentBagEditor";

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

          {/* RIDERS — the conditional extras, deliberately player-toggled. */}
          <div style={{ borderTop: "1px solid #2a2a3e", paddingTop: 7 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: "#aaa" }}>Riders</span>
              <button type="button"
                onClick={() => set("riders", [...(draft.riders ?? []), {
                  id: `rider-${Date.now().toString(36)}`, label: "", cadence: "perTurn" as const,
                }])}
                style={{ fontSize: 10, padding: "2px 8px", background: "#2a2a4e", border: "1px solid #7b68ee55", borderRadius: 3, color: "#9d8cff", cursor: "pointer" }}>
                + Rider
              </button>
            </div>
            <div style={{ fontSize: 10, color: "#666", marginBottom: 6 }}>
              A rider is a TOGGLE the player flips when it applies. The app tracks the cadence and
              rolls the dice; the table rules on the trigger — automating "while below half HP"
              or "a creature you already hit this turn" would take the call away from the player.
              Leave the formula blank for a rider that rolls nothing.
            </div>
            {(draft.riders ?? []).map((r, i) => {
              const patchRider = (next: Partial<ItemRider>) =>
                set("riders", (draft.riders ?? []).map((x, j) => (j === i ? { ...x, ...next } : x)));
              return (
                <div key={r.id} style={{ background: "#111", border: "1px solid #2a2a3e", borderRadius: 4, padding: 7, marginBottom: 5, display: "flex", flexDirection: "column", gap: 5 }}>
                  <div style={{ display: "flex", gap: 5 }}>
                    <input type="text" value={r.label} placeholder="Rider name"
                      onChange={e => patchRider({ label: e.target.value })}
                      style={{ flex: 2, padding: "3px 6px", fontSize: 11, background: "#0d0d14", border: "1px solid #333", borderRadius: 3, color: "#ddd" }} />
                    <input type="text" value={r.formula ?? ""} placeholder="2d6 (optional)"
                      onChange={e => patchRider({ formula: e.target.value || undefined })}
                      style={{ flex: 1, padding: "3px 6px", fontSize: 11, background: "#0d0d14", border: "1px solid #333", borderRadius: 3, color: "#ddd" }} />
                    <button type="button" onClick={() => set("riders", (draft.riders ?? []).filter((_, j) => j !== i))}
                      style={{ fontSize: 11, padding: "0 8px", background: "transparent", border: "1px solid #5a3a1a", borderRadius: 3, color: "#e07b39", cursor: "pointer" }}>✕</button>
                  </div>
                  <div style={{ display: "flex", gap: 5 }}>
                    <select value={r.cadence} onChange={e => patchRider({ cadence: e.target.value as ItemRider["cadence"] })}
                      style={{ flex: 1, padding: "3px 6px", fontSize: 11, background: "#0d0d14", border: "1px solid #333", borderRadius: 3, color: "#ddd" }}>
                      <option value="perTurn">Once per turn</option>
                      <option value="perRound">Once per round</option>
                      <option value="perEncounter">Once per encounter</option>
                      <option value="shortRest">Short rest</option>
                      <option value="longRest">Long rest</option>
                      <option value="atWill">At will</option>
                    </select>
                    <input type="text" value={r.damageType ?? ""} placeholder="damage type (blank = weapon's)"
                      onChange={e => patchRider({ damageType: e.target.value || undefined })}
                      style={{ flex: 1, padding: "3px 6px", fontSize: 11, background: "#0d0d14", border: "1px solid #333", borderRadius: 3, color: "#ddd" }} />
                  </div>
                  <input type="text" value={r.condition ?? ""} placeholder="Trigger the player judges — e.g. while at or below half HP"
                    onChange={e => patchRider({ condition: e.target.value || undefined })}
                    style={{ padding: "3px 6px", fontSize: 11, background: "#0d0d14", border: "1px solid #333", borderRadius: 3, color: "#ddd" }} />
                </div>
              );
            })}
          </div>

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
