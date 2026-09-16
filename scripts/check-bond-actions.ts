/**
 * Bond ladder -> clickable rows, every bond at every stage.
 *
 * Not a unit test suite: a printed proof that the generator reads the v13 templates rather than
 * guessing at them. Run it after any change to `bondActions.ts` or a re-extraction of the bonds.
 *   npx tsx scripts/check-bond-actions.ts
 */
import { generatedBondActions } from "../src/core/rules/bondActions";
import { BROKEN_CHAIN_BOND_TEMPLATES } from "../src/modules/the-broken-chain/content/bondTemplates";
import { BROKEN_CHAIN_BOND_GATES } from "../src/modules/the-broken-chain/content/bondGates";
import { TBC_MILESTONE } from "../src/modules/the-broken-chain/content/bondGates";

const LEVELS = [1, 3, 6, 9, 13];
let rows = 0;
let missingDice = 0;
const problems: string[] = [];

for (const tpl of BROKEN_CHAIN_BOND_TEMPLATES) {
  console.log(`\n=== ${tpl.name} (${tpl.id})${tpl.actor === "companion" ? " [companion]" : ""} ===`);
  for (const level of LEVELS) {
    for (const path of (level >= 6 ? [0, 1] : [undefined])) {
      const actions = generatedBondActions(
        tpl,
        { templateId: tpl.id, ...(path === undefined ? {} : { chosenPathIndex: path as 0 | 1 }) },
        { level, gates: BROKEN_CHAIN_BOND_GATES, milestones: [TBC_MILESTONE.act3BossDefeated] },
        { characterActorId: "pc-1", companionName: "Faelar" },
      );
      const tag = `L${level}${path === undefined ? "" : ` path${path}`}`;
      for (const a of actions) {
        rows++;
        const dice = a.metadata?.damage ?? "-";
        const kind = a.metadata?.effectKind ?? "-";
        if (a.metadata?.outcomeMode !== "passive" && dice === "-") missingDice++;
        console.log(`  ${tag.padEnd(12)} ${a.label.padEnd(28)} ${dice.padEnd(12)} ${kind.padEnd(10)} ${(a.tags ?? []).join(",")}`);
        if (/^[a-z]/.test(a.label)) problems.push(`${tpl.id} ${tag}: label starts lowercase -> "${a.label}"`);
        if (a.label.length > 40) problems.push(`${tpl.id} ${tag}: label too long -> "${a.label}"`);
      }
      if (actions.length === 0) problems.push(`${tpl.id} ${tag}: produced NO rows`);
    }
  }
}

// The gate: level 13 with the Act 3 boss still standing must hold at Metamorphosis.
const held = generatedBondActions(
  BROKEN_CHAIN_BOND_TEMPLATES[0],
  { templateId: BROKEN_CHAIN_BOND_TEMPLATES[0].id, chosenPathIndex: 0 },
  { level: 13, gates: BROKEN_CHAIN_BOND_GATES, milestones: [] },
);
console.log("\n=== gate: L13, Act 3 boss alive ===");
for (const a of held) console.log(`  ${a.label} | ${(a.tags ?? []).join(",")} | ${a.metadata?.damage ?? "-"}`);
if (!held.some(a => a.label.startsWith("Held at"))) problems.push("gate: no held-at note at L13 with the milestone unearned");
if (!held.some(a => (a.tags ?? []).some(t => t.includes("Metamorphosis")))) problems.push("gate: L13 did not hold at Metamorphosis");

/**
 * ⚠ AN OFF-TURN BOND OPTION IS LISTED WITH THE REACTIONS — AND SPENDS THE BOND, NOT THE REACTION.
 *
 * Christopher, 2026-09-15: *"the intercept cost bond action but should be listed as reaction option which
 * is suppose to consume that bond action."* Guardian's Intercept: *"This does not use your reaction."*
 * Action Timing r24 keeps such a response off the normal Reaction.
 *
 * The data half is proven on the generator; the card half on the source, because the pinned strip and
 * `handleUseReaction` both hard-coded `["reaction"]` — pinning Intercept without changing them would have
 * burned the one slot its text refuses to touch.
 */
console.log("\n=== off-turn bond options: listed as reactions, spend the bond ===");
{
  const guardian = BROKEN_CHAIN_BOND_TEMPLATES.find(t => t.id === "guardian")!;
  const off = new Set(guardian.offTurnOptions ?? []);
  if (off.size === 0) problems.push("guardian: no offTurnOptions authored — Intercept will not reach the reactions strip");
  const seenOff = new Set<string>();
  for (const level of LEVELS) {
    for (const path of (level >= 6 ? [0, 1] : [undefined])) {
      const rowsHere = generatedBondActions(
        guardian,
        { templateId: "guardian", ...(path === undefined ? {} : { chosenPathIndex: path as 0 | 1 }) },
        { level, gates: BROKEN_CHAIN_BOND_GATES, milestones: [TBC_MILESTONE.act3BossDefeated] },
        { characterActorId: "pc-1" },
      ).filter(a => a.economyCost?.includes("bond"));
      for (const a of rowsHere) {
        const tag = `L${level}${path === undefined ? "" : ` path${path}`} ${a.label}`;
        if (off.has(a.label)) {
          seenOff.add(a.label);
          if (a.pinReaction !== true) problems.push(`guardian ${tag}: off-turn option not flagged pinReaction`);
          if (a.economyCost?.includes("reaction")) problems.push(`guardian ${tag}: off-turn option costs the REACTION — its text says it does not`);
          if (!a.economyCost?.includes("bond")) problems.push(`guardian ${tag}: off-turn option does not spend the bond`);
        } else if (a.pinReaction) {
          problems.push(`guardian ${tag}: an ON-turn option was pinned as a reaction`);
        }
      }
    }
  }
  console.log(`  guardian off-turn rows seen: ${[...seenOff].join(", ")}`);
  for (const name of off) if (!seenOff.has(name)) problems.push(`guardian: offTurnOptions names "${name}", which no stage generates — a dead name`);

  // Every OTHER bond fires on the character's own turn: none may be pinned.
  for (const tpl of BROKEN_CHAIN_BOND_TEMPLATES.filter(t => t.id !== "guardian")) {
    if (tpl.offTurnOptions?.length) problems.push(`${tpl.id}: offTurnOptions authored, but only Guardian's Intercept fires off-turn`);
  }

  const fs = await import("node:fs");
  const card = fs.readFileSync("src/core/ui/ActorCard.tsx", "utf8");
  const strip = fs.readFileSync("src/core/ui/PinnedReactions.tsx", "utf8");
  if (!/const costs: ActionCost\[\] = \[reaction\.cost \?\? "reaction"\]/.test(card)) problems.push("ActorCard.handleUseReaction does not spend the pinned entry's own slot");
  if (!/pinReaction && costs\.includes\("bond"\)/.test(card)) problems.push("ActorCard.isPinnedReactionAction does not admit a pinReaction bond row");
  if (!/cost: "bond" as const/.test(card)) problems.push("ActorCard.actionToPinnedReaction does not carry the bond slot");
  if (/actionState\.reaction === activeKey|usedCostSlots\.includes\("reaction"\)|costs: \["reaction"\]/.test(strip)) {
    problems.push("PinnedReactions still reads the Reaction slot for every entry");
  }
}

/**
 * A CREATURE'S BOND REACHES ITS CARD.
 *
 * Christopher, 2026-09-15: *"the bonds actions did not get generated on my mirrors."* An Elemental Mirror is
 * built with one inherent Bond and its Metamorphosis path, the assignment rode onto every body as data, and
 * nothing ever resolved it — the card printed the Inherent Bond trait over a card with no bond on it.
 */
console.log("\n=== a creature's bond becomes rows on the body ===");
{
  const { materializeTemplateBody } = await import("../src/core/monsters/actionSetPicks");
  const { BROKEN_CHAIN_MONSTER_LIBRARY } = await import("../src/data/broken-chain/monsterLibrary");
  type Row = { name: string; kind?: string; text?: string; riders?: Array<{ name: string; damage: string; cadence: string }> };
  type Body = { actions?: Row[]; reactions?: Row[] };
  const mirror = (BROKEN_CHAIN_MONSTER_LIBRARY as Array<{ name: string }>).find(t => /Elemental Mirror/i.test(t.name));
  if (!mirror) problems.push("no Elemental Mirror template in the library to build a body from");

  const build = (bond?: { templateId: string; stage: number; chosenPathIndex?: 0 | 1 }) =>
    materializeTemplateBody(mirror as never, { id: "gate-body", name: "Gate Mirror", ...(bond ? { bond: bond as never } : {}) }) as Body;

  const generated = (body: Body) => [...(body.actions ?? []), ...(body.reactions ?? [])].filter(a => a.name.startsWith("◈ "));
  const withBond = build({ templateId: "guardian", stage: 2, chosenPathIndex: 0 });
  const rowsOn = generated(withBond);
  if (rowsOn.length === 0) problems.push("a mirror built with a bond generated no bond rows");
  const guardianTpl = BROKEN_CHAIN_BOND_TEMPLATES.find(t => t.id === "guardian")!;
  for (const r of rowsOn) {
    if (!String(r.text ?? "").startsWith(guardianTpl.name)) problems.push(`bond row "${r.name}" does not say which bond it came from`);
    if ((r as { damage?: string }).damage || (r as { roll?: string }).roll) {
      problems.push(`bond row "${r.name}" carries its own attack — a bond row is text plus a rider, never a new attack`);
    }
  }
  // Guardian's Intercept is the off-turn option: it belongs with the reactions, here as on a character.
  const offTurn = (guardianTpl.offTurnOptions ?? []).map(n => `◈ ${n}`);
  const asReactions = (withBond.reactions ?? []).filter(a => a.name.startsWith("◈ ")).map(a => a.name);
  for (const name of asReactions) if (!offTurn.includes(name)) problems.push(`${name} is on the reactions but is not one of the bond's off-turn options`);

  // The die rides the creature's attack once per round — the trait's own "one activation per round".
  const rider = (withBond.actions ?? []).flatMap(a => a.riders ?? []).filter(r => /bond/i.test(r.name));
  if (rider.length !== 1) problems.push(`expected exactly one bond rider on the body, saw ${rider.length}`);
  if (rider[0] && rider[0].cadence !== "once-per-turn") problems.push("the bond rider is not once per turn");
  if (rider[0] && /@/.test(rider[0].damage)) problems.push(`the bond rider's dice are unresolved: ${rider[0].damage}`);

  // ⚠ MUTATION: no bond, no rows — and a rebuild must not stack them.
  if (generated(build()).length !== 0) problems.push("a mirror with NO bond generated bond rows");
  if (generated(build({ templateId: "guardian", stage: 2, chosenPathIndex: 0 })).length !== rowsOn.length) {
    problems.push("rebuilding the same body changed its bond row count — the generation is not idempotent");
  }
  console.log(`  rows on a bonded mirror: ${rowsOn.map(r => r.name).join(", ")} | rider ${rider[0]?.damage ?? "none"}`);
}

console.log(`\nrows: ${rows} | rows with no dice (non-note): ${missingDice}`);
if (problems.length) {
  console.log("\nPROBLEMS:");
  for (const p of problems) console.log(" - " + p);
  process.exit(1);
}
console.log("OK");
