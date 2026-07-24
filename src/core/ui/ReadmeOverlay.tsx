/**
 * ReadmeOverlay — the in-app quick guide.
 *
 * Tabbed, because the things a new person actually gets stuck on are not the colour
 * system: they are the non-obvious rules (a seat has to be deleted before you can hand
 * a character to a different player; a companion never gets its own turn; a save left
 * blank is not a save of 0). Each tab is one of those. Pure reference — changes no state.
 */

import { useState } from "react";

type ReadmeOverlayProps = {
  open: boolean;
  onClose: () => void;
};

const COLOR_LEGEND: { swatch: string; label: string; meaning: string }[] = [
  { swatch: "#3f9d5f", label: "Green", meaning: "Creation — build party characters, monsters, equipment." },
  { swatch: "#5f8fd9", label: "Blue", meaning: "Execution — manage, load, and run what exists." },
  { swatch: "#e0b85a", label: "Yellow", meaning: "Cleanup — post-combat tidy-up of defeated monsters and stale state." },
  { swatch: "#6fe0e0", label: "Teal", meaning: "GM controls — session-save / room-metadata tools." },
];

const FLOW_STEPS = [
  "Create your actors (party characters, monsters, equipment).",
  "Build an encounter from the Library.",
  "Start combat.",
  "Use the rotation — each actor's seat color identifies whose turn it is.",
  "Cleanup after the fight.",
];

type TabId = "basics" | "seats" | "companions" | "combat" | "dice" | "building";

const TABS: { id: TabId; label: string }[] = [
  { id: "basics", label: "Basics" },
  { id: "seats", label: "Seats & Players" },
  { id: "companions", label: "Companions" },
  { id: "combat", label: "Combat" },
  { id: "dice", label: "Dice" },
  { id: "building", label: "Building" },
];

const ACCENT = "#9d8cff";
const h4: React.CSSProperties = { margin: "0 0 6px", fontSize: 13, color: ACCENT };
const p: React.CSSProperties = { margin: 0, fontSize: 12, lineHeight: 1.55 };
const listStyle: React.CSSProperties = { margin: "4px 0 0", paddingLeft: 18, fontSize: 12, lineHeight: 1.6 };

/** A "this is the bit that catches people out" callout. */
function Gotcha({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      ...p, marginTop: 8, padding: "7px 9px", borderRadius: 6,
      background: "rgba(224,123,57,0.08)", border: "1px solid rgba(224,123,57,0.35)", color: "#e5c8a8",
    }}>
      <strong style={{ color: "#e07b39" }}>Watch out — </strong>{children}
    </p>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h4 style={h4}>{title}</h4>{children}</section>;
}

export function ReadmeOverlay({ open, onClose }: ReadmeOverlayProps) {
  const [tab, setTab] = useState<TabId>("basics");
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Forever DM Combat quick guide"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "min(600px, 100%)", maxHeight: "85vh", display: "flex", flexDirection: "column",
          background: "#13131f", border: "1px solid #2a2a3e", borderRadius: 10,
          boxShadow: "0 12px 40px rgba(0,0,0,0.5)", color: "#dcdce6",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #2a2a3e" }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>Forever DM Combat — Quick Guide</h3>
          <button type="button" onClick={onClose} aria-label="Close guide"
            style={{ fontSize: 13, padding: "3px 10px", background: "transparent", border: "1px solid #444", borderRadius: 4, color: "#aaa", cursor: "pointer" }}>✕ Close</button>
        </div>

        {/* Tabs */}
        <div role="tablist" aria-label="Guide sections" style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: "8px 12px 0", borderBottom: "1px solid #2a2a3e" }}>
          {TABS.map(t => {
            const active = t.id === tab;
            return (
              <button key={t.id} type="button" role="tab" aria-selected={active} onClick={() => setTab(t.id)}
                style={{
                  fontSize: 12, padding: "5px 10px", cursor: "pointer", borderRadius: "5px 5px 0 0",
                  background: active ? "#1d1d2e" : "transparent",
                  border: "1px solid " + (active ? "#3a3a55" : "transparent"),
                  borderBottom: active ? "1px solid #1d1d2e" : "1px solid transparent",
                  marginBottom: -1,
                  color: active ? "#fff" : "#8a8aa0", fontWeight: active ? 700 : 500,
                }}>
                {t.label}
              </button>
            );
          })}
        </div>

        <div role="tabpanel" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16, overflowY: "auto" }}>

          {tab === "basics" && (<>
            <Section title="What the colors mean">
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {COLOR_LEGEND.map(c => (
                  <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span aria-hidden style={{ width: 14, height: 14, borderRadius: 4, background: c.swatch, flexShrink: 0, border: "1px solid rgba(255,255,255,0.15)" }} />
                    <span style={{ fontSize: 12 }}><strong style={{ color: c.swatch }}>{c.label}</strong> — {c.meaning}</span>
                  </div>
                ))}
              </div>
            </Section>
            <Section title="Opening a sheet">
              <p style={p}><strong>Right-click</strong> an actor tile or an initiative entry to open that character or monster's sheet.</p>
            </Section>
            <Section title="Basic flow">
              <ol style={listStyle}>{FLOW_STEPS.map((s, i) => <li key={i}>{s}</li>)}</ol>
            </Section>
          </>)}

          {tab === "seats" && (<>
            <Section title="Seat colors">
              <p style={p}>
                Each party character has its own <strong>seat color</strong>, shown on the card frame,
                the combat tracker and the token panel — so you can tell whose turn it is and who owns
                which token at a glance.
              </p>
            </Section>
            <Section title="Handing a character to a different player">
              <p style={p}>
                A seat binds one player to one character. To move a character to someone else, or to
                re-seat a player who left, you must <strong>delete the existing seat first</strong> and
                then have the new player claim it.
              </p>
              <Gotcha>
                Changing players does <strong>not</strong> happen by editing the character. If you skip
                deleting the old seat, the character stays bound to the previous player and the new
                person cannot claim it.
              </Gotcha>
            </Section>
          </>)}

          {tab === "companions" && (<>
            <Section title="Companions act on their owner's turn">
              <p style={p}>
                A companion is not its own combatant. Set the actor's kind to{" "}
                <strong>Companion</strong> and pick an <strong>Owner</strong>; it then inherits that
                character's initiative and appears as an indented row beneath them in the tracker,
                rather than taking a slot of its own in the order.
              </p>
              <ul style={listStyle}>
                <li>The companion row <strong>lights up</strong> while its owner's turn is active — that is when it can act.</li>
                <li><strong>Click the companion's name</strong> in that row to open its card and spend its action.</li>
                <li>Its action economy resets alongside its owner's, so it gets a fresh action each round.</li>
              </ul>
              <Gotcha>
                "Next turn" will never stop on a companion, and that is correct — it already acted
                during its owner's turn. If a companion has <em>no</em> owner set, it falls back to
                being its own combatant in the order instead.
              </Gotcha>
            </Section>
            <Section title="Summons">
              <p style={p}>
                Summons (a ranger's beast, a paladin's steed, a warlock's pact summon, an artificer's
                turret) are built as companions owned by the caster. Their numbers usually come from
                the <em>summoner</em>, not from themselves — AC, hit points, attack bonus and saving
                throws are all derived from the owner's level, proficiency bonus or spellcasting stat.
              </p>
              <Gotcha>
                Because those values belong to the owner, do not write them as <code>@vars</code> on
                the summon — <code>@WIS</code> and <code>@PROF</code> resolve against the{" "}
                <em>summon's own</em> sheet, which is the wrong creature. Enter the resolved number.
              </Gotcha>
            </Section>
          </>)}

          {tab === "combat" && (<>
            <Section title="The action economy">
              <p style={p}>
                Each combatant has an action, a bonus action and a reaction, shown as dots. Spending an
                entry marks its dot. <strong>Extra Attack</strong> is set per character as "attacks per
                Attack action" — you can use the same weapon for each attack, and the action is only
                consumed once the whole budget is spent. Casting a spell always uses the entire action.
              </p>
            </Section>
            <Section title="Benching someone for a fight">
              <p style={p}>
                Give a combatant a <strong>negative initiative</strong> (the Bench button does this) to
                sit them out. They stay listed so they are easy to bring back, but are skipped by Start
                Combat, Next Turn and the turn count.
              </p>
            </Section>
            <Section title="Riders and toggles end with the fight">
              <p style={p}>
                Armed riders and stances — Rage, Sacred Weapon, Hunter's Mark, fighting-style toggles —
                stay active across turns and are <strong>cleared automatically at End Combat</strong>,
                so nothing leaks into the next fight.
              </p>
              <Gotcha>
                Ending combat is what clears them. If you leave a fight by closing the window instead of
                pressing End Combat, those toggles are still armed next time.
              </Gotcha>
            </Section>
          </>)}

          {tab === "dice" && (<>
            <Section title="Dice+ is the built-in roller">
              <p style={p}>
                Rolls are sent to <strong>Dice+</strong>, the dice extension this tool is built around.
                It gets first refusal on every roll, and the result comes back into the log
                automatically with the natural roll preserved for crit and fumble handling.
              </p>
            </Section>
            <Section title="If no dice app answers">
              <p style={p}>
                When no dice extension responds — none installed, or the request times out — the
                <strong> math takes over</strong>. The formula is rolled locally and posted to the log
                exactly as though a dice app had rolled it, so the table is never stuck on
                "Waiting for roll…".
              </p>
            </Section>
            <Section title="Manual entry">
              <p style={p}>
                You can always type a natural roll by hand. That is what the manual entry on a committed
                roll is for — verifying a Nat 1, a Nat 20 or a crit threshold from physical dice.
              </p>
            </Section>
          </>)}

          {tab === "building" && (<>
            <Section title="Saving throws">
              <p style={p}>
                The ability grid in the character creator has three rows:{" "}
                <strong>score</strong>, <strong>modifier</strong>, then <strong>save</strong>. The save
                row is an override. Leave it <strong>blank</strong> and the card shows the save as equal
                to the modifier — correct for a save you are not proficient in. Fill it in for a
                proficient save, or for a summon whose saves key off its owner.
              </p>
              <Gotcha>
                Blank is not the same as 0. A blank save means "no override, use the modifier"; a typed
                0 is a real save of +0.
              </Gotcha>
            </Section>
            <Section title="Weapon Mastery">
              <p style={p}>
                Weapons have an optional <strong>Weapon Mastery</strong> picker. Choosing one shows its
                rules text in the form and attaches it under Information on the attack.
              </p>
              <Gotcha>
                Mastery is never filled in automatically from the weapon's name. A mastery only applies
                when the character has a feature unlocking it for that weapon — the same longsword is
                Sap for a fighter and nothing for a wizard — so it is always your choice per item.
              </Gotcha>
            </Section>
            <Section title="Formula variables">
              <p style={p}>
                Attack and damage formulas accept <code>@STR @DEX @CON @INT @WIS @CHA @PROF @SPELL</code>,
                which resolve against <em>that sheet's own</em> ability scores. Use them for a
                character's own weapons so the numbers follow level-ups.
              </p>
            </Section>
            <Section title="Importing a library">
              <p style={p}>
                Characters and equipment import as JSON. An import <strong>updates by id</strong>: an
                entry whose id matches an existing one overwrites it, and a new id creates a new entry.
              </p>
              <Gotcha>
                Two different import shapes exist — a character library and an equipment library. Feeding
                one to the other's importer fails. And if you mean to update a character, the id must
                match exactly, or you will quietly end up with a duplicate.
              </Gotcha>
            </Section>
          </>)}

        </div>
      </div>
    </div>
  );
}
