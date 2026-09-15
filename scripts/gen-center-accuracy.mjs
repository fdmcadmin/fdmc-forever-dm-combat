/**
 * THE BALANCED CENTRE LINE'S ACCURACY — the real actors behind the certified party curve.
 *
 *   node --max-old-space-size=8192 scripts/gen-center-accuracy.mjs \
 *     <unzipped Broken_Chain_Parties_4096_Runtime_Fixed_Gifts_Spells_v8 dir> \
 *     <unzipped Broken_Chain_Actor_First_Party_Curves_L1_16_V3_0_Certified xlsx dir> \
 *     src/core/encounter-band/centerLineAccuracy.generated.ts
 *
 * Christopher, 2026-09-13: *"make sure the checker can price against the unchosen party dpr balanced
 * center line."* With no chosen party the checker already runs the certified centre curve for DPR and
 * sustain — but that curve carries no accuracy, so anything priced through the party's hit chance (a
 * −3 zone, a persistent disadvantage defence) fell back or went unpriced.
 *
 * ⚠ A HIT CHANCE IS NEVER STORED. The runtime's own rule: *"Resolve real actor attack bonuses/save DCs
 * against real target AC/saves; do not store 65% as an outcome."* So this emits the ACTORS' numbers —
 * each endpoint member's final attack bonus (equipment included), save DC and attack-delivery share —
 * and the checker resolves them against the fight's own AC and saves.
 *
 * WHICH ACTORS. The certified workbook's `Endpoint Audit` names the four endpoint parties — BOS, BDS,
 * WOS, ODS — for every size, level and mode, member by member. The centre is (BOS + BDS + WOS + ODS) / 4
 * of their curves, so it is the same actors here, from the same four runtime populations.
 *
 * ⚠ TWO POPULATION LAYOUTS. Three populations are normalised (`actorProfiles` → `modeStateRefs` →
 * `primaryAction`). `full_solo_v8` is denormalised (`actors[id].levels[L].modes.{WOTC,BC}`) and carries
 * `mainAttackBonus` / `spellAttackBonus` / `spellSaveDC` but no delivery share. The share and the
 * weapon-or-focus delivery are CLASS PACKET facts (`core:<class>:primary_action`), so they are read off
 * the normalised populations per class and level and applied to the solo actors by their primary class.
 * The run prints every class whose share is not a single value, so a non-constant packet is visible.
 *
 * ⚠ THE WORKBOOK AND THE ZIP NEVER SHIP. Read at development time; the generated table is the input.
 */
import fs from "node:fs";
import path from "node:path";

const [RUNTIME_DIR, CURVES_DIR, OUT] = process.argv.slice(2);
if (!RUNTIME_DIR || !CURVES_DIR || !OUT) {
  console.error("usage: node --max-old-space-size=8192 scripts/gen-center-accuracy.mjs <runtime-dir> <curves-xlsx-dir> <out.ts>");
  process.exit(1);
}

// ── the Endpoint Audit sheet ─────────────────────────────────────────────────────────────────────
const decode = s => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const SHARED = [...fs.readFileSync(path.join(CURVES_DIR, "xl", "sharedStrings.xml"), "utf8")
  .matchAll(/<(?:x:)?si>([\s\S]*?)<\/(?:x:)?si>/g)]
  .map(([, si]) => decode([...si.matchAll(/<(?:x:)?t[^>]*>([\s\S]*?)<\/(?:x:)?t>/g)].map(m => m[1]).join("")));
const wb = fs.readFileSync(path.join(CURVES_DIR, "xl", "workbook.xml"), "utf8");
const rels = fs.readFileSync(path.join(CURVES_DIR, "xl", "_rels", "workbook.xml.rels"), "utf8");

function sheetRows(name) {
  const tag = [...wb.matchAll(/<(?:x:)?sheet [^>]*>/g)].map(m => m[0]).find(s => (s.match(/name="([^"]*)"/) || [])[1] === name);
  if (!tag) throw new Error(`sheet not found: ${name}`);
  const rid = (tag.match(/r:id="([^"]*)"/) || [])[1];
  const rel = [...rels.matchAll(/<Relationship[^>]*>/g)].map(m => m[0]).find(s => s.includes(`Id="${rid}"`));
  const xml = fs.readFileSync(path.join(CURVES_DIR, "xl", (rel.match(/Target="([^"]*)"/) || [])[1].replace(/^\/?xl\//, "")), "utf8");
  const rows = [];
  for (const [, row] of xml.matchAll(/<(?:x:)?row[^>]*>([\s\S]*?)<\/(?:x:)?row>/g)) {
    rows.push([...row.matchAll(/<(?:x:)?c r="([A-Z]+)\d+"(?:[^>]*?t="(\w+)")?[^>]*?(?:\/>|>([\s\S]*?)<\/(?:x:)?c>)/g)].map(c => {
      const inner = c[3] ?? "";
      const v = (inner.match(/<(?:x:)?v>([\s\S]*?)<\/(?:x:)?v>/) || [])[1];
      if (c[2] === "s") return SHARED[Number(v)] ?? "";
      if (/<(?:x:)?is>/.test(inner)) return decode([...inner.matchAll(/<(?:x:)?t[^>]*>([\s\S]*?)<\/(?:x:)?t>/g)].map(m => m[1]).join(""));
      return v ?? "";
    }));
  }
  return rows;
}

/** "population::MEMBER" (4P) or "Class — Bond [population::MEMBER]" (3/5/6P). */
function parseMember(raw) {
  const inner = (String(raw).match(/\[([^\]]+)\]/) || [])[1] ?? String(raw);
  const [population, ...rest] = inner.trim().split("::");
  return { population, member: rest.join("::") };
}

const endpoints = sheetRows("Endpoint Audit")
  .filter(r => /^\d+$/.test(r[0] ?? "") && /^\d+$/.test(r[1] ?? ""))
  .map(r => ({
    size: Number(r[0]), level: Number(r[1]), mode: String(r[2]).toUpperCase() === "BC" ? "brokenChain" : "wotcStandard",
    endpoint: r[3], party: r[4], members: String(r[13] ?? "").split(/;\s*(?=[A-Z]|broken_chain)/).filter(Boolean).map(parseMember),
  }));
if (endpoints.length === 0) throw new Error("no endpoint rows read");

const wanted = new Map(); // population → Set(member)
for (const e of endpoints) for (const m of e.members) {
  if (!wanted.has(m.population)) wanted.set(m.population, new Set());
  wanted.get(m.population).add(m.member);
}

const classKey = s => String(s ?? "").toLowerCase().replace(/[^a-z]/g, "");

/**
 * ── IS THIS ACTOR'S ATTACK A MELEE ATTACK ────────────────────────────────────────────────────────
 *
 * Christopher, 2026-09-15: *"cold counsel should use the 4 parties the balanced center was based line
 * to determine the melee share."* Cold Counsel moves a targeted ally and the attack is re-checked: only
 * an attack that cannot reach the ally's new square is affected, so the checker needs to know how much
 * of the centre party's damage arrives at reach.
 *
 * ⚠ READ FROM THE BUILD, NOT GUESSED FROM THE CLASS. The solo population carries each source member's
 * actual weapon per level and mode — `equipment.weapon.range` is "melee", "melee/thrown" or a range band
 * like "150/600", with `isFocus` for a spellcasting focus. A class name would be a guess ("Finesse or
 * ranged weapon" is the packet text for three classes and says nothing about which one this actor took).
 *
 * ⚠ THE OTHER POPULATIONS ARE THE SAME CHARACTERS. Every endpoint member id resolves in the solo
 * population, and the rebuild and both shuffles keep the source member's class in all 2048 profiles
 * each (checked 2026-09-15), so the source build's weapon is this actor's weapon.
 *
 * ⚠ "melee/thrown" IS NOT COUNTED AS MELEE. A handaxe or javelin still has a throw range, so moving the
 * target does not make it an illegal target — which is the only thing Cold Counsel does.
 */
function meleeFromWeapon(weapon) {
  if (!weapon || weapon.isFocus === true) return false;
  return String(weapon.range ?? "").trim().toLowerCase() === "melee";
}

const soloFile = fs.readdirSync(RUNTIME_DIR).find(f => /full_solo/.test(f) && f.endsWith(".json"));
if (!soloFile) throw new Error("the full_solo population is required for weapon delivery");
process.stdout.write(`reading ${soloFile} for weapon delivery… `);
const soloActors = JSON.parse(fs.readFileSync(path.join(RUNTIME_DIR, soloFile), "utf8")).actors;
console.log(`${Object.keys(soloActors).length} source builds`);
/** member + level + mode → does this actor swing at reach? */
function meleeOf(member, level, mode) {
  const actor = soloActors[member];
  if (!actor) throw new Error(`no source build for ${member} — cannot read its weapon`);
  const lv = actor.levels?.[level] ?? Object.values(actor.levels).find(l => l.level === level);
  if (!lv) throw new Error(`no L${level} in the source build for ${member}`);
  const m = lv.modes?.[mode === "brokenChain" ? "BC" : "WOTC"];
  if (!m) throw new Error(`no ${mode} mode in the source build for ${member} L${level}`);
  return meleeFromWeapon(m.equipment?.weapon);
}
const actorLevel = new Map(); // `${population}::${member}::L${level}::${mode}` → { attackBonus, spellSaveDc, attackShare }
/** class → level → { shares: number[], focus: number, weapon: number } — from every normalised actor. */
const classPackets = new Map();

// ── normalised populations first — they carry the class packets the solo population needs ────────
const populations = [...wanted.keys()].sort((a, b) => Number(/full_solo/.test(a)) - Number(/full_solo/.test(b)));
for (const population of populations) {
  const members = wanted.get(population);
  const file = path.join(RUNTIME_DIR, `${population}.json`);
  if (!fs.existsSync(file)) throw new Error(`population file missing: ${file}`);
  process.stdout.write(`reading ${population} (${members.size} actors)… `);
  const j = JSON.parse(fs.readFileSync(file, "utf8"));

  if (Array.isArray(j.actorProfiles)) {
    const modes = [["wotcStandard", "wotcModeStates", "wotc"], ["brokenChain", "brokenChainModeStates", "brokenChain"]];
    for (const profile of j.actorProfiles) {
      for (const lv of profile.levels) {
        for (const [, reg, ref] of modes) {
          const pa = j.registries[reg][lv.modeStateRefs[ref]]?.primaryAction;
          const cls = classKey((String(pa?.id ?? "").match(/^core:([^:]+):/) || [])[1]);
          if (!pa || !cls) continue;
          if (!classPackets.has(cls)) classPackets.set(cls, new Map());
          const perLevel = classPackets.get(cls);
          if (!perLevel.has(lv.level)) perLevel.set(lv.level, { shares: [], attacks: [], focus: 0, weapon: 0 });
          const slot = perLevel.get(lv.level);
          slot.shares.push(pa.attackDeliveryShare);
          if (typeof pa.attacks === "number") slot.attacks.push(pa.attacks);
          if (/focus/i.test(pa.name ?? "")) slot.focus++; else slot.weapon++;
        }
      }
    }
    /**
     * ⚠ THE ENDPOINTS NAME THE SOURCE MEMBER, AND NOT EVERY POPULATION INDEXES BY IT. The rebuild keys
     * its `actorDirectory` by its own `REBUILD-0001::PC1`; the source id lives on the profile. So the
     * lookup is built from `sourceMemberId`, and a source member that appears twice is refused.
     */
    const directory = {};
    const duplicated = new Set();
    j.actorProfiles.forEach((p, i) => {
      if (p.sourceMemberId in directory) duplicated.add(p.sourceMemberId);
      directory[p.sourceMemberId] = i;
    });
    for (const member of members) {
      if (duplicated.has(member)) throw new Error(`${population}: source member appears more than once: ${member}`);
      const profile = j.actorProfiles[directory[member]];
      if (!profile) throw new Error(`${population}: actor not found: ${member}`);
      for (const lv of profile.levels) {
        for (const [mode, reg, ref] of modes) {
          const pa = j.registries[reg][lv.modeStateRefs[ref]]?.primaryAction;
          if (!pa || typeof pa.attackBonus !== "number") throw new Error(`${population}: no primaryAction for ${member} L${lv.level} ${mode}`);
          actorLevel.set(`${population}::${member}::L${lv.level}::${mode}`, {
            attackBonus: pa.attackBonus, spellSaveDc: pa.spellSaveDc, attackShare: pa.attackDeliveryShare,
            attacks: Math.max(1, Math.round(Number(pa.attacks ?? 1))),
          });
        }
      }
    }
  } else if (j.actors && typeof j.actors === "object") {
    for (const member of members) {
      const actor = j.actors[member];
      if (!actor) throw new Error(`${population}: actor not found: ${member}`);
      const cls = classKey(actor.identity?.primaryClass);
      const perLevel = classPackets.get(cls);
      if (!perLevel) throw new Error(`${population}: no class packet learned for "${actor.identity?.primaryClass}" (${member})`);
      for (const lv of Object.values(actor.levels)) {
        const packet = perLevel.get(lv.level) ?? [...perLevel.values()][0];
        const share = packet.shares.reduce((s, x) => s + x, 0) / packet.shares.length;
        // The swing count is a class packet fact too — the solo population states no per-actor count.
        const attacks = packet.attacks.length ? Math.max(1, Math.round(packet.attacks.reduce((s, x) => s + x, 0) / packet.attacks.length)) : 1;
        const byFocus = packet.focus > packet.weapon;
        for (const [mode, key] of [["wotcStandard", "WOTC"], ["brokenChain", "BC"]]) {
          const m = lv.modes?.[key];
          if (!m || typeof m.mainAttackBonus !== "number") throw new Error(`${population}: no ${key} mode for ${member} L${lv.level}`);
          actorLevel.set(`${population}::${member}::L${lv.level}::${mode}`, {
            attackBonus: byFocus && typeof m.spellAttackBonus === "number" ? m.spellAttackBonus : m.mainAttackBonus,
            spellSaveDc: m.spellSaveDC,
            attackShare: share,
            attacks,
          });
        }
      }
    }
  } else {
    throw new Error(`${population}: unrecognised population layout`);
  }
  console.log("done");
}

// ── class packet report: a delivery share that is not one value per class and level is shown ─────
for (const [cls, perLevel] of classPackets) {
  const varying = [...perLevel.entries()].filter(([, s]) => new Set(s.shares.map(x => x.toFixed(4))).size > 1);
  const mixed = [...perLevel.entries()].filter(([, s]) => s.focus > 0 && s.weapon > 0);
  if (varying.length || mixed.length) {
    console.log(`  class packet ${cls}: share varies at L${varying.map(([l]) => l).join(",") || "-"}; focus/weapon mixed at L${mixed.map(([l]) => l).join(",") || "-"}`);
  }
}

// ── the table ───────────────────────────────────────────────────────────────────────────────────
const table = {};
for (const e of endpoints) {
  const key = `${e.size}P|${e.level}|${e.mode}`;
  table[key] ??= { endpoints: [] };
  table[key].endpoints.push({
    endpoint: e.endpoint,
    party: e.party,
    members: e.members.map(m => {
      const a = actorLevel.get(`${m.population}::${m.member}::L${e.level}::${e.mode}`);
      if (!a) throw new Error(`no actor data for ${m.population}::${m.member} L${e.level} ${e.mode}`);
      return { id: m.member, ...a, attackShare: Math.round(a.attackShare * 10000) / 10000, attacks: a.attacks, melee: meleeOf(m.member, e.level, e.mode) };
    }),
  });
}

const keys = Object.keys(table).sort((a, b) => {
  const [sa, la, ma] = a.split("|"); const [sb, lb, mb] = b.split("|");
  return sa.localeCompare(sb) || Number(la) - Number(lb) || ma.localeCompare(mb);
});
const body = keys.map(k => `  ${JSON.stringify(k)}: ${JSON.stringify(table[k])},`).join("\n");
const out = `/**
 * ⚠ GENERATED by scripts/gen-center-accuracy.mjs — do not edit by hand.
 *
 * The balanced centre line's ACTORS: every member of the four endpoint parties (BOS, BDS, WOS, ODS) the
 * certified curve averages, per party size, level and mode — from \`Broken_Chain_Actor_First_Party_Curves_
 * L1_16_V3_0_Certified\` (Endpoint Audit) and \`Broken_Chain_Parties_4096_Runtime_Fixed_Gifts_Spells_v8\`.
 *
 * Final \`attackBonus\` and \`spellSaveDc\` (equipment included) and \`attackShare\` — the share of the actor's
 * damage delivered by attack rolls. NO HIT CHANCE IS STORED: see \`centerLineAccuracy.ts\`.
 * \`spellSaveDc\` is null for an actor with no save DC at that level (a non-caster before its first).
 * \`attacks\` is the swings one Attack action makes at this level — a target-substitution Reaction moves ONE.
 * \`melee\` is this actor's own equipped weapon reaching only to melee (not thrown, not a focus) — what a
 * target-substitution Reaction like Cold Counsel can make an illegal target of.
 */
export type CenterActor = { id: string; attackBonus: number; spellSaveDc: number | null; attackShare: number; attacks: number; melee: boolean };
export type CenterEndpoint = { endpoint: string; party: string; members: CenterActor[] };

export const CENTER_LINE_ACTORS: Record<string, { endpoints: CenterEndpoint[] }> = {
${body}
};
`;
fs.writeFileSync(OUT, out);
console.log(`wrote ${OUT}: ${keys.length} size/level/mode rows, ${endpoints.length} endpoints, ${actorLevel.size} actor-level-modes`);
