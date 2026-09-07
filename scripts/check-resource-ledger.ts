/**
 * THE AT-WILL BASE AND THE RESOURCE LEDGER, AGAINST THE WORKBOOK'S OWN RULES.
 *   npm run check:ledger
 *
 * Authority: `broken_chain_checker_runtime_v3_3_slot_resource_budget.xlsx`, sheet
 * `Resource Conversion`. Two rules from it are asserted here because breaking either one is how a
 * resource enters the checker twice:
 *
 *   row 5   "Base DPR must exclude every resource listed below."
 *   row 44  "The same slot cannot become both damage and healing."
 *
 * and one arithmetic contract:
 *
 *   total usable = starting uses + recovered uses + free uses
 *   allocated offense + allocated sustain + allocated other <= total usable
 *
 * ⚠ THE WORKBOOK'S OWN WORKED CASE IS THE TEST. Row 11: *"With this workbook's one Short Rest, a
 * level-9 Fighter has two potential Action Surge uses, not three."* If the rest schedule is read
 * as anything other than one, that number moves, so it is asserted directly.
 *
 * ⚠ THE EXIT CHECK IS THE LAST THING IN THIS FILE.
 */

import { actorAsCreature } from "../src/core/encounter-band/actorAsCreature";
import { resourceLedgerFromActor, RESOURCE_DAY, CONTESTED_ROLE_MAJORITY } from "../src/core/encounter-band/resourceLedger";
import { BROKEN_CHAIN_BOND_TEMPLATES } from "../src/modules/the-broken-chain/content/bondTemplates";
import { bondTemplateForActor } from "../src/core/rules/bondProgress";
import { parseCreature } from "../src/core/encounter-band/parseCreature";
import { traceCreature } from "../src/core/encounter-band/actionTrace";

let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};

const resource = (id: string, label: string, kind: string, additive: number, regain?: number | "all") => ({
  id, label, actionKind: "resource", economyCost: [], logMode: "silent",
  metadata: { resourceKind: kind, additive: String(additive), ...(regain !== undefined ? { shortRestRegain: regain } : {}) },
});

/** A Fighter/Paladin-shaped sheet: a weapon, a cantrip, a smite rider, slots and Action Surge. */
const actor = {
  id: "test", kind: "player", name: "Test PC", level: 9,
  attacksPerAction: 2,
  stats: { ac: 18, hp: { current: 80, max: 80 }, speed: "30 ft." },
  abilityScores: { str: { score: 20 }, dex: { score: 12 }, con: { score: 16 },
    int: { score: 10 }, wis: { score: 12 }, cha: { score: 16 } },
  tabs: {
    main: [
      { id: "sword", label: "Longsword", actionKind: "attack", economyCost: ["main"], logMode: "default",
        metadata: { attack: "1d20+@STR+@PROF", damage: "1d8+@STR", damageType: "Slashing" } },
      { id: "surge", label: "Action Surge", actionKind: "feature", economyCost: ["main"], logMode: "silent",
        metadata: { cost: "Special; 1 Action Surge use", details: "One additional action." } },
    ],
    spells: [
      { id: "smite", label: "Divine Smite", actionKind: "spell", economyCost: [], logMode: "default",
        metadata: { damage: "2d8", spellLevel: 1, details: "On a hit, expend a slot." } },
      { id: "bolt", label: "Sacred Flame", actionKind: "spell", economyCost: ["main"], logMode: "default",
        metadata: { damage: "2d8", saveDc: "DEX DC 15", spellLevel: 0 } },
      { id: "cure", label: "Cure Wounds", actionKind: "spell", economyCost: ["main"], logMode: "default",
        metadata: { damage: "2d8+@CHA", spellLevel: 1, outcomeMode: "healing",
          // Worded the way the live sheets word it — a fixture that only says what the code
          // already accepts is a gate that cannot fail.
          details: "Touch a creature to restore 2d8+3 hit points." } },
    ],
    resources: [
      resource("slots1", "Spell Slots L1", "spellSlot", 4),
      resource("as", "Action Surge", "pool", 1, "all"),
      resource("hd", "Hit Dice (d10)", "pool", 9),
    ],
  },
} as never;

console.log("The at-will base excludes resources; the ledger counts and allocates them\n");

/* ── 1. The adapter ──────────────────────────────────────────────────────────────────────── */
console.log("Base DPR excludes every resource (Resource Conversion row 5)");
{
  const { creature, spends, unreadable } = actorAsCreature(actor);
  const names = (creature.actions ?? []).map(a => a.name);
  ok("the weapon is in the at-will base", names.includes("Longsword"), names.join(", "));
  ok("a levelled spell is NOT", !names.includes("Divine Smite"));
  ok("...it is handed to the ledger instead", spends.some(s => s.label === "Divine Smite"),
    spends.map(s => `${s.label}:${s.trigger}`).join(", "));
  ok("a damage cantrip stays at-will — it spends nothing", names.includes("Sacred Flame"));
  ok("healing is not counted as offence at all",
    !names.includes("Cure Wounds") && !spends.some(s => s.label === "Cure Wounds"));

  /**
   * ⚠ THE THREE CHANCE CASES. A rider is expended only after the hit lands, so it must be
   * classified apart from a spell that is spent before the roll resolves.
   */
  ok("a damage-only spell with no roll of its own is a RIDER",
    spends.find(s => s.label === "Divine Smite")?.trigger === "rider");

  ok("no @token survives into the base", !JSON.stringify(creature.actions).includes("@"),
    JSON.stringify(creature.actions?.[0]));
  ok("nothing damaging was silently dropped", unreadable.length === 0, unreadable.join(" | "));

  const trace = traceCreature(parseCreature(creature), {
    ac: 16, partySize: 4, saveBonus: 3,
    saves: { str: 3, dex: 3, con: 3, int: 3, wis: 3, cha: 3 },
  } as never, 4);
  const r1 = trace.rounds[0]?.totalExpectedDamage ?? 0;
  ok("the existing scheduler can price it", r1 > 0, `R1 ${r1.toFixed(2)}`);
}

/* ── 2. The ledger ───────────────────────────────────────────────────────────────────────── */
console.log("\nTotal usable = start + recovered × rests + free");
{
  const led = resourceLedgerFromActor(actor);
  const row = (label: string) => led.rows.find(r => r.resource === label)!;

  ok("the day is the workbook's", RESOURCE_DAY.shortRestsPerLongRest === 1
    && RESOURCE_DAY.combatRoundsPerLongRest === 25
    && RESOURCE_DAY.shortRestAfterFight === 3,
    `${RESOURCE_DAY.fightsPerLongRest} fights x ${RESOURCE_DAY.roundsPerFight} rounds, rest after ${RESOURCE_DAY.shortRestAfterFight}`);

  /** Row 11: with ONE Short Rest a level 9 Fighter has TWO Action Surges, not three. */
  ok("one Short Rest gives Action Surge two potential uses, not three",
    row("Action Surge").totalUses === 2,
    `start ${row("Action Surge").startUses} + ${row("Action Surge").recoveredPerShortRest}/rest = ${row("Action Surge").totalUses}`);

  ok("start, recovered and free stay separate",
    row("Spell Slots L1").startUses === 4
    && row("Spell Slots L1").recoveredPerShortRest === 0
    && row("Spell Slots L1").freeUses === 0);

  ok("Hit Dice are NOT in the in-fight ledger — the short rest owns them",
    !led.rows.some(r => /hit dice/i.test(r.resource)),
    led.rows.map(r => r.resource).join(", "));

  /** ⚠ ROW 44: the same slot cannot become both damage and healing. */
  const over = led.rows.filter(r => r.offense + r.sustain + r.other > r.totalUses + 1e-9);
  ok("no row allocates more than it has", over.length === 0,
    over.map(r => `${r.resource} ${r.offense}+${r.sustain}+${r.other} > ${r.totalUses}`).join("; "));

  const l1 = row("Spell Slots L1");
  ok("a tier wanted by damage AND healing is flagged contested", l1.contested,
    `offers ${l1.options.join(", ")}`);
  ok("...and its uses are DIVIDED, not counted twice",
    Math.abs(l1.offense + l1.sustain + l1.other - l1.totalUses) < 1e-9
    && l1.offense < l1.totalUses && l1.sustain > 0,
    `off ${l1.offense.toFixed(2)} sus ${l1.sustain.toFixed(2)} oth ${l1.other.toFixed(2)} of ${l1.totalUses}`);

  /** A rest schedule of zero must change the answer, or the schedule is not being read. */
  const noRest = resourceLedgerFromActor(actor, { shortRests: 0 });
  ok("with no scheduled Short Rest, the recovery is not granted",
    noRest.rows.find(r => r.resource === "Action Surge")!.totalUses === 1);
}

/* ── 3. The role breaks a contested tier ─────────────────────────────────────────────────── */
console.log(String.fromCharCode(10) + "A contested tier is broken by the ROLE, not by the spell count");
{
  ok("every bond states which way it leans",
    BROKEN_CHAIN_BOND_TEMPLATES.every(t => t.resourceLean !== undefined),
    BROKEN_CHAIN_BOND_TEMPLATES.filter(t => !t.resourceLean).map(t => t.id).join(", ") || "all 14");

  const l1 = (lean?: "offense" | "sustain" | "control") =>
    resourceLedgerFromActor(actor, lean ? { lean } : {}).rows.find(r => r.resource === "Spell Slots L1")!;

  const loadout = l1();
  const sustainLean = l1("sustain");
  const offenseLean = l1("offense");

  ok("a sustain role sends the majority to sustain",
    Math.abs(sustainLean.sustain - sustainLean.totalUses * CONTESTED_ROLE_MAJORITY) < 1e-9,
    `sus ${sustainLean.sustain.toFixed(2)} of ${sustainLean.totalUses}`);
  ok("an offense role sends the majority the other way",
    Math.abs(offenseLean.offense - offenseLean.totalUses * CONTESTED_ROLE_MAJORITY) < 1e-9,
    `off ${offenseLean.offense.toFixed(2)} of ${offenseLean.totalUses}`);
  ok("...so the two roles genuinely disagree about the same slots",
    Math.abs(sustainLean.offense - offenseLean.offense) > 0.5,
    `${sustainLean.offense.toFixed(2)} vs ${offenseLean.offense.toFixed(2)}`);

  /** ⚠ ALLOCATE-ONCE MUST SURVIVE THE LEAN, or the role becomes a way to conjure uses. */
  for (const [name, row] of [["sustain", sustainLean], ["offense", offenseLean], ["loadout", loadout]] as const) {
    ok(`${name}: still allocates exactly what it has`,
      Math.abs(row.offense + row.sustain + row.other - row.totalUses) < 1e-9,
      `${row.offense.toFixed(2)}+${row.sustain.toFixed(2)}+${row.other.toFixed(2)} of ${row.totalUses}`);
  }

  ok("no bond means no lean — the loadout split stands and says so",
    loadout.notes.some(n => /no bond role/.test(n)), loadout.notes.join(" | "));

  /** A lean this tier does not offer must not invent a channel. */
  const absent = l1("control");
  ok("a role absent from the tier falls back rather than forcing itself",
    Math.abs(absent.offense + absent.sustain + absent.other - absent.totalUses) < 1e-9
    && absent.notes.some(n => /does not appear at this tier/.test(n)),
    absent.notes.join(" | "));
}

/* ── 4. A bond stated on the CARD still counts ───────────────────────────────────────────── */
console.log(String.fromCharCode(10) + "A bond on the card counts even with no assignment written");
{
  const T = BROKEN_CHAIN_BOND_TEMPLATES;
  const withRow = { moduleData: {}, tabs: { bond: [{ label: "Pack Instinct (Meta)", actionKind: "bond" }] } };
  ok("an unassigned character with an authored bond row resolves it",
    bondTemplateForActor(withRow as never, T)?.id === "pack",
    String(bondTemplateForActor(withRow as never, T)?.id));

  const assigned = { moduleData: { bondAssignment: { templateId: "guardian" } },
    tabs: { bond: [{ label: "Pack Instinct (Meta)", actionKind: "bond" }] } };
  ok("...but a written assignment always wins over the row",
    bondTemplateForActor(assigned as never, T)?.id === "guardian",
    String(bondTemplateForActor(assigned as never, T)?.id));

  /** ⚠ IT CANNOT INVENT A BOND. A row that names no template resolves nothing. */
  const nameless = { moduleData: {}, tabs: { bond: [{ label: "Some Homebrew Thing", actionKind: "bond" }] } };
  ok("a row naming no template resolves nothing",
    bondTemplateForActor(nameless as never, T) === undefined);

  /** The companion carries the EFFECTS, not the bond — its rows are features, not bond rows. */
  const companion = { moduleData: {}, tabs: { bond: [{ label: "Protective Stance (Shielding Bond)", actionKind: "feature" }] } };
  ok("a companion’s effect row is not mistaken for its owner’s bond",
    bondTemplateForActor(companion as never, T) === undefined);
}

console.log(failures === 0 ? "\nAll assertions passed." : `\n${failures} assertion(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
