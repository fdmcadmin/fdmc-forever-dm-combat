/**
 * A FIGHTING STYLE'S ACCURACY IS ALWAYS ON; ITS DAMAGE LANDS AS OFTEN AS ITS TRIGGER SAYS.
 *   npm run check:styles
 *
 * Two rulings from Christopher, 2026-09-23, pulling in opposite directions:
 *
 *   "Ac isnt hand authored it is listed on the feat and effects the character, the same would be for
 *    things like archary, its a added +2 and effects all ranged attacks"
 *
 *   "things like great weapon fighting effect 1 attack per turn so they cant read as always on since
 *    that would effect one hit"
 *
 * The first is accuracy: +2 on EVERY ranged weapon attack, which the trace already rolls one at a
 * time. The second is the real warning — a style's DAMAGE is not automatically a bonus on every hit.
 *
 * ⚠ THE CADENCE IS THE WORKBOOK'S, NOT THIS FILE'S. `featPricing` carries a `trigger` line per
 * style — Dueling "Each hit...", Great Weapon Fighting "Every damage roll...", Great Weapon Master
 * "...ONCE PER TURN; Hew only on critical hit or reducing a creature to 0 HP" — so the checker reads
 * cadence from the same table that prices the feat. A style the workbook does not know is read the
 * conservative way, once a turn.
 *
 * ⚠ AND THE MUTATIONS ARE HALF THE FILE. Removing the weapon a style rides has to make the style
 * worth exactly zero, or "always on" has crept back in through the other door.
 */
import { actorAsCreature } from "../src/core/encounter-band/actorAsCreature";
import { featPricing } from "../src/modules/dnd-5e/featPricing.generated";
import { priceFeat } from "../src/modules/dnd-5e/featEvaluator";

let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};

const style = (id: string, label: string, target: string, attack?: number, damage?: number) => ({
  id, label, actionKind: "feature", economyCost: [], logMode: "silent",
  metadata: {
    combatStyleTarget: target,
    ...(attack ? { combatStyleAttack: String(attack) } : {}),
    ...(damage ? { combatStyleDamage: String(damage) } : {}),
  },
});

const weapon = (id: string, label: string, damage: string, extra: Record<string, unknown> = {}) => ({
  id, label, actionKind: "attack", economyCost: ["main"], logMode: "default",
  metadata: { attack: "1d20+@DEX+@PROF", damage, damageType: "Piercing", ...extra },
});

const sheet = (rows: unknown[]) => ({
  id: "styles", kind: "player", name: "Style PC", level: 7, attacksPerAction: 2,
  stats: { ac: 17, hp: { current: 60, max: 60 }, speed: "30 ft." },
  abilityScores: {
    str: { score: 18 }, dex: { score: 18 }, con: { score: 14 },
    int: { score: 10 }, wis: { score: 12 }, cha: { score: 10 },
  },
  tabs: { main: rows },
}) as never;

type Row = {
  name?: string;
  roll?: string;
  damage?: string;
  riders?: Array<{ name?: string; damage?: string; cadence?: string }>;
};
const rowsOf = (actor: unknown) => actorAsCreature(actor as never).creature.actions as unknown as Row[];
const row = (actor: unknown, name: string) => rowsOf(actor).find(r => r.name === name);
const riders = (actor: unknown, styleName: string) =>
  rowsOf(actor).flatMap(r => (r.riders ?? []).filter(x => x.name === styleName));

console.log("A fighting style rides what it says it rides\n");

console.log("1. Archery's +2 is on EVERY ranged weapon attack");
{
  const rows = [
    weapon("bow", "Longbow", "1d8+@DEX", { range: "150/600 ft" }),
    weapon("hand", "Hand Crossbow", "1d6+@DEX", { range: "30/120 ft" }),
    weapon("rapier", "Rapier", "1d8+@DEX"),
    {
      id: "bolt", label: "Fire Bolt", actionKind: "spell", economyCost: ["main"], logMode: "default",
      metadata: { attack: "1d20", damage: "2d10", damageType: "Fire", range: "120 ft" },
    },
  ];
  const a = sheet([...rows, style("archery", "Archery", "ranged", 2)]);
  const plain = sheet(rows);

  ok("the longbow gains it", row(a, "Longbow")?.roll === `${row(plain, "Longbow")?.roll}+2`,
    `${row(plain, "Longbow")?.roll} -> ${row(a, "Longbow")?.roll}`);
  ok("the SECOND ranged weapon gains it too, not just the first",
    row(a, "Hand Crossbow")?.roll === `${row(plain, "Hand Crossbow")?.roll}+2`,
    `${row(plain, "Hand Crossbow")?.roll} -> ${row(a, "Hand Crossbow")?.roll}`);
  ok("the melee weapon does not", row(a, "Rapier")?.roll === row(plain, "Rapier")?.roll,
    String(row(a, "Rapier")?.roll));
  ok("a ranged SPELL attack does not — Archery is a weapon style",
    row(a, "Fire Bolt")?.roll === row(plain, "Fire Bolt")?.roll, String(row(a, "Fire Bolt")?.roll));
  ok("and an accuracy style adds no damage anywhere",
    rowsOf(a).every((r, i) => r.damage === rowsOf(plain)[i]?.damage));
  ok("...and raises no rider", rowsOf(a).every(r => (r.riders ?? []).length === 0));

  /**
   * ⚠ THE DOUBLE-COUNT GUARD. Archery is also a row in the feat table, and the sheet now applies it
   * itself. The workbook's own expression is what keeps the two apart — `resolvedAttackBonus ? 0 :
   * ...` — so a character carrying Archery on the feats tab AND armed on the card is paid once.
   */
  const feat = priceFeat("Archery", { resolvedAttackBonus: true } as never);
  ok("the feat channel prices Archery at zero once the sheet resolves the attack bonus",
    feat?.dpr.ok === true && feat.dpr.value === 0,
    feat?.dpr.ok ? String(feat.dpr.value) : JSON.stringify(feat?.dpr));
}

console.log("\n2. a PER-HIT style is paid on every hit, because its trigger says so");
{
  const rows = [weapon("rapier", "Rapier", "1d8+@DEX"), weapon("dagger", "Dagger", "1d4+@DEX")];
  const a = sheet([...rows, style("dueling", "Dueling", "melee", 0, 2)]);
  const plain = sheet(rows);

  ok("the workbook is the source of that cadence",
    /each hit/i.test(String(featPricing("Dueling")?.trigger ?? "")),
    String(featPricing("Dueling")?.trigger));
  ok("the rapier's damage carries it", row(a, "Rapier")?.damage === `${row(plain, "Rapier")?.damage} + 2`,
    String(row(a, "Rapier")?.damage));
  ok("the dagger's does too", row(a, "Dagger")?.damage === `${row(plain, "Dagger")?.damage} + 2`,
    String(row(a, "Dagger")?.damage));
  ok("no roll grew — a damage style is not accuracy",
    rowsOf(a).every((r, i) => r.roll === rowsOf(plain)[i]?.roll));
  ok("and it raises no rider, because it is already in the damage", riders(a, "Dueling").length === 0);

  const gwf = sheet([
    weapon("great", "Greatsword", "2d6+@STR", { details: "Melee Two-Handed weapon" }),
    weapon("rapier", "Rapier", "1d8+@DEX"),
    style("gwf", "Great Weapon Fighting", "two-handed", 0, 2),
  ]);
  ok("Great Weapon Fighting reads the same way — 'Every damage roll'",
    /every damage roll/i.test(String(featPricing("Great Weapon Fighting")?.trigger ?? "")),
    String(featPricing("Great Weapon Fighting")?.trigger));
  ok("...so the greatsword carries it", /\+ 2$/.test(String(row(gwf, "Greatsword")?.damage)),
    String(row(gwf, "Greatsword")?.damage));
  ok("...and the rapier, which it does not ride, does not",
    !/\+ 2$/.test(String(row(gwf, "Rapier")?.damage)), String(row(gwf, "Rapier")?.damage));
}

console.log("\n3. a style the workbook does not know is read once a turn, not always on");
{
  const rows = [weapon("rapier", "Rapier", "1d8+@DEX"), weapon("dagger", "Dagger", "1d4+@DEX")];
  const a = sheet([...rows, style("house", "Warden's Cut", "melee", 0, 3)]);
  const plain = sheet(rows);

  ok("the workbook has no row for it", featPricing("Warden's Cut") === undefined);
  ok("no attack's damage string grew", rowsOf(a).every((r, i) => r.damage === rowsOf(plain)[i]?.damage),
    rowsOf(a).map(r => `${r.name}: ${r.damage}`).join(" | "));

  const d = riders(a, "Warden's Cut");
  ok("it is booked as exactly ONE rider", d.length === 1, `${d.length} riders`);
  ok("...worth the style's damage", d[0]?.damage === "3", String(d[0]?.damage));
  ok("...once a turn, which prices it at P(one of the turn's attacks lands)",
    d[0]?.cadence === "once-per-turn", String(d[0]?.cadence));
  ok("...on the best attack it rides, not on the weakest",
    (row(a, "Rapier")?.riders ?? []).length === 1 && (row(a, "Dagger")?.riders ?? []).length === 0);

  /**
   * ⚠ THE NUMBER THIS BRANCH EXISTS FOR. Two attacks a turn: always-on would book +6 before hit
   * chance, once-a-turn books +3. Booking it per attack is the reading Christopher rejected.
   */
  const total = rowsOf(a).flatMap(r => r.riders ?? []).filter(x => x.name === "Warden's Cut")
    .reduce((n, x) => n + Number(x.damage ?? 0), 0);
  ok("a two-attack routine still books it once", total === 3, `${total} damage booked`);
}

console.log("\n4. a style nothing rides is worth nothing");
{
  const rows = [weapon("rapier", "Rapier", "1d8+@DEX")];
  const a = sheet([...rows, style("gwf", "Great Weapon Fighting", "two-handed", 0, 2)]);
  const plain = sheet(rows);

  ok("Great Weapon Fighting on a character holding a rapier changes no damage",
    row(a, "Rapier")?.damage === row(plain, "Rapier")?.damage, String(row(a, "Rapier")?.damage));
  ok("...and raises no rider", riders(a, "Great Weapon Fighting").length === 0);
  ok("...and does not fall through to the unreadable list either",
    actorAsCreature(a as never).unreadable.every(u => !/Great Weapon Fighting/.test(u)),
    actorAsCreature(a as never).unreadable.join(" | "));

  const houseRule = sheet([...rows, style("house", "Warden's Cut", "two-handed", 0, 3)]);
  ok("an unknown style with nothing to ride raises no rider either",
    riders(houseRule, "Warden's Cut").length === 0);
}

console.log("\n5. the read says what it did");
{
  const a = sheet([
    weapon("bow", "Longbow", "1d8+@DEX", { range: "150/600 ft" }),
    style("archery", "Archery", "ranged", 2),
  ]);
  const said = actorAsCreature(a as never).assumptions.join(" ");
  ok("the assumption names the style", /Archery/.test(said), said);
  ok("...and says the accuracy is on every attack it rides", /every attack it rides/.test(said));

  const b = sheet([weapon("rapier", "Rapier", "1d8+@DEX"), style("dueling", "Dueling", "melee", 0, 2)]);
  ok("a per-hit style says it is per hit",
    /on each hit/.test(actorAsCreature(b as never).assumptions.join(" ")),
    actorAsCreature(b as never).assumptions.join(" "));

  const c = sheet([weapon("rapier", "Rapier", "1d8+@DEX"), style("house", "Warden's Cut", "melee", 0, 3)]);
  ok("a once-a-turn style says it is once a turn",
    /once a turn/.test(actorAsCreature(c as never).assumptions.join(" ")),
    actorAsCreature(c as never).assumptions.join(" "));
}

console.log(failures === 0
  ? "\nOK — accuracy rides every attack, style damage rides its own trigger"
  : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
