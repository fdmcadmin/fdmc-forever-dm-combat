const j = require('C:/Users/cjda0/Downloads/fdmc-actor-library-2026-08-17.json');

const findings = [];
const add = (actor, sev, kind, detail) => findings.push({ actor, sev, kind, detail });

const LEVEL_CAT = n => n === 0 ? "Cantrips" : `L${n} Spells`;

for (const [id, a] of Object.entries(j.actors)) {
  const name = a.name;

  // ── spells: category must match the spell's own level ────────────────────
  for (const s of a.tabs.spells ?? []) {
    const lvl = s.metadata?.spellLevel;
    const cat = s.category ?? "";
    const slot = s.metadata?.slotCost ?? "";
    const freeCast = s.metadata?.spellSlotMode === "freeCast" || /long rest|\/day|class spell/i.test(cat + " " + slot);

    if (lvl === undefined) {
      add(name, "HIGH", "spell-no-level", `"${s.label}" is on the spells tab with no spellLevel — it cannot be filed under any heading.`);
      continue;
    }
    const want = LEVEL_CAT(lvl);
    if (!freeCast && cat !== want) {
      add(name, "HIGH", "spell-miscategorised", `"${s.label}" is level ${lvl} but filed under "${cat}" — should be "${want}".`);
    }
    // cantrip must never cost a slot
    if (lvl === 0 && slot && !/cantrip/i.test(slot)) {
      add(name, "HIGH", "cantrip-costs-slot", `"${s.label}" is a cantrip but its slotCost is "${slot}".`);
    }
    if (lvl > 0 && /cantrip/i.test(slot)) {
      add(name, "HIGH", "levelled-as-cantrip", `"${s.label}" is level ${lvl} but its slotCost is "${slot}".`);
    }
    // slot level must agree with the spell level
    const m = /^L(\d+)$/.exec(slot);
    if (m && Number(m[1]) < lvl) {
      add(name, "HIGH", "slot-below-level", `"${s.label}" is level ${lvl} but spends an ${slot} slot.`);
    }
  }

  // ── category spelling drift: same group, two headings ────────────────────
  const cats = new Map();
  for (const s of a.tabs.spells ?? []) {
    const c = (s.category ?? "").trim();
    if (!c) continue;
    const key = c.toLowerCase().replace(/s$/, "");
    if (!cats.has(key)) cats.set(key, new Set());
    cats.get(key).add(c);
  }
  for (const [, variants] of cats) {
    if (variants.size > 1) {
      add(name, "HIGH", "category-drift", `Two headings for one group: ${[...variants].map(v => `"${v}"`).join(" and ")} — they render as separate sections.`);
    }
  }

  // ── riders must actually ride ────────────────────────────────────────────
  for (const [tab, list] of Object.entries(a.tabs ?? {})) {
    for (const act of list ?? []) {
      const md = act.metadata ?? {};
      const mode = md.outcomeMode;
      const isRider = mode === "additive";
      const ridesSomething = Boolean(
        md.weaponBuffDamage?.trim() || md.weaponBuffAttack?.trim() ||
        md.turnRider?.kind || md.combatStyleAttack?.trim() || md.combatStyleDamage?.trim() ||
        md.spellFocusAttack?.trim() || md.spellFocusDamage?.trim() || md.damage?.trim()
      );
      if (isRider && !ridesSomething) {
        add(name, "HIGH", "rider-rides-nothing", `[${tab}] "${act.label}" is outcomeMode "additive" but carries no damage, weapon buff, turn rider or fighting-style bonus — clicking it does nothing.`);
      }
      // A rolling mode with nothing to roll.
      const rolling = mode === "attack-roll" || mode === "dc-check" || mode === "ability-check";
      const hasFormula = Boolean(md.attack?.trim() || md.damage?.trim() || md.saveDc?.trim() || md.healing?.trim());
      if (rolling && !hasFormula) {
        add(name, "MED", "rolling-no-formula", `[${tab}] "${act.label}" is outcomeMode "${mode}" but has no attack, damage, save DC or healing formula.`);
      }
      // An attack-roll action with a save DC but no attack formula, or vice versa.
      if (mode === "attack-roll" && !md.attack?.trim() && md.saveDc?.trim()) {
        add(name, "MED", "attack-mode-save-only", `[${tab}] "${act.label}" is an attack-roll but only carries a save DC — likely should be dc-check.`);
      }
      // Malformed focus bonus: adds @SPELL on top of a formula that already has it.
      for (const f of ["spellFocusAttack", "spellFocusDamage"]) {
        const v = md[f];
        if (v && /@SPELL/i.test(v)) {
          add(name, "HIGH", "focus-double-counts", `[${tab}] "${act.label}" ${f} is "${v}" — focus bonuses are ADDED to the spell's own formula, so @SPELL is counted twice. Should be the bonus alone.`);
        }
      }
    }
  }

  // ── equipment attached to this actor: armour with no AC ──────────────────
  for (const act of a.tabs.equipment ?? []) {
    const md = act.metadata ?? {};
    const acEffect = (md.statEffects ?? []).some(e => e.type === "addAC" || e.type === "setAC");
    const looksArmour = /shield|plate|mail|armor|armour|brigandine|leathers|hide|wrap|vest/i.test(act.label ?? "");
    if (looksArmour && !md.acDisplay && !acEffect) {
      add(name, "MED", "armour-no-ac", `[equipment] "${act.label}" grants no AC — no acDisplay and no addAC/setAC effect.`);
    }
  }
}

// ── the shared equipment library in the same export ────────────────────────
const items = Object.values(j.equipment ?? {});
const libNoAc = items.filter(i => (i.type === "armor" || i.type === "shield") && !i.ac && !(i.statEffects ?? []).some(e => e.type === "addAC" || e.type === "setAC"));

const order = { HIGH: 0, MED: 1, LOW: 2 };
findings.sort((x, y) => order[x.sev] - order[y.sev] || x.actor.localeCompare(y.actor));
console.log(`${findings.length} findings across ${Object.keys(j.actors).length} actors\n`);
let cur = "";
for (const f of findings) {
  if (f.actor !== cur) { cur = f.actor; console.log(`\n### ${cur}`); }
  console.log(`  [${f.sev}] ${f.kind}: ${f.detail}`);
}
console.log(`\n### shared equipment library (${items.length} items)`);
console.log(`  [MED] armour-no-ac: ${libNoAc.length} of ${items.filter(i => i.type === "armor" || i.type === "shield").length} armour/shield items carry no AC value:`);
libNoAc.forEach(i => console.log(`         - ${i.name} (${i.type})`));
