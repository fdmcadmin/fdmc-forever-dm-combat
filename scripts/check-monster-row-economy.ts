/**
 * A MONSTER CARD ROW SPENDS ITS OWN ECONOMY, AND LOOKS LIKE WHAT IT IS.
 *   npx tsx scripts/check-monster-row-economy.ts
 *
 * Christopher, 2026-09-16: *"bond actions are consuming the entire monster action, same with reaction, and
 * there is no clear distinction between the action/reaction/bond as well as each of the attack set
 * (multiattack action should be colored the same) should be distinguishable between each other."*
 *
 * Three faults, one component:
 *   1  a bond row fell to "the whole action" on use, and so did every legendary option
 *   2  Commit and Clear spent an action STEP for whatever resolved — reactions included
 *   3  a reaction authored in `reactions` with `kind: "action"` rendered with the Actions and spent the action
 * and a card whose rows all wore the same grey.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  FRESH_ECONOMY, cardRows, classifyMonsterRows, economyOf, rowAccent, setHues, spendOnUse, spendsActionBudget,
  type RowAccentContext,
} from "../src/core/monsters/monsterRowEconomy";
import { deriveMonsterActionCounter } from "../src/core/monsters/runtime/mainMonsterRuntime";
import { materializeTemplateBody } from "../src/core/monsters/actionSetPicks";
import { BROKEN_CHAIN_MONSTER_LIBRARY } from "../src/data/broken-chain/monsterLibrary";
import type { MainMonsterTemplate } from "../src/core/monsters/runtime/mainMonsterRuntime";
import type { MonsterReaderAction } from "../src/core/monsters/MonsterJconScanner";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};
const codeOf = (p: string) => readFileSync(resolve(ROOT, p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/[^\n]*/gm, "");

const row = (over: Partial<MonsterReaderAction> & { name: string }): MonsterReaderAction => ({ kind: "action", ...over } as MonsterReaderAction);
const bondRow = row({ name: "◈ Challenge", economyCost: "bond" } as never);
const bondOffTurn = row({ name: "◈ Guardian's Stand", kind: "reaction", economyCost: "bond" } as never);
const reaction = row({ name: "Parry", kind: "reaction" });
const legendary = row({ name: "Tail Swipe", legendaryCost: 2 } as never);
const bonus = row({ name: "Dash", economyCost: "bonus" } as never);
const attack = row({ name: "Claw", kind: "attack", roll: "1d20+5" });
const whole = row({ name: "Breath", recharge: "5-6" } as never);

console.log("A monster card row spends its own economy\n");

console.log("1. what each row spends");
{
  ok("a bond row spends the bond", economyOf(bondRow) === "bond");
  ok("...an off-turn bond option too — listed with the reactions, still the bond", economyOf(bondOffTurn) === "bond");
  ok("a reaction spends the reaction", economyOf(reaction) === "reaction");
  ok("a legendary option spends its own pool", economyOf(legendary) === "legendary");
  ok("a bonus action spends the bonus", economyOf(bonus) === "bonus");
  ok("an attack is one step", economyOf(attack) === "attack");
  ok("a recharge ability is the whole action", economyOf(whole) === "action");
}

console.log("\n2. using it spends that, and only that");
{
  const max = 2;
  const after = (r: MonsterReaderAction) => spendOnUse(FRESH_ECONOMY, economyOf(r), max);
  const b = after(bondRow);
  ok("a bond row marks the bond and leaves the action untouched", b.bondUsed && !b.actionUsed && b.stepsUsed === 0 && !b.reactionUsed, JSON.stringify(b));
  const off = after(bondOffTurn);
  ok("...the off-turn option does not spend the REACTION", off.bondUsed && !off.reactionUsed);
  const r = after(reaction);
  ok("a reaction marks the reaction and leaves the action untouched", r.reactionUsed && !r.actionUsed && r.stepsUsed === 0);
  const l = after(legendary);
  ok("a legendary option leaves the creature's own action untouched", !l.actionUsed && l.stepsUsed === 0);
  const a = after(attack);
  ok("an attack spends nothing yet — it is spent when it resolves", a.stepsUsed === 0 && !a.actionUsed);
  const w = after(whole);
  ok("a whole action takes the turn", w.actionUsed && w.stepsUsed === max);
}

console.log("\n3. resolving it (Commit / Clear) spends a step only for the action budget");
{
  ok("an attack resolving costs a step", spendsActionBudget("attack"));
  ok("a whole action resolving counts against the budget", spendsActionBudget("action"));
  for (const e of ["bond", "reaction", "legendary", "bonus"] as const) {
    ok(`a ${e} resolving costs no step`, !spendsActionBudget(e));
  }
  const card = codeOf("src/core/ui/MonsterActorCard.tsx");
  /**
   * ⚠ EACH HANDLER'S OWN BODY. The first version searched the whole file, and one guarded handler satisfied
   * both checks — removing the guard from Commit left the gate green. Proven by breaking it.
   */
  const between = (from: string, to: string) => {
    const at = card.indexOf(from);
    return at < 0 ? "" : card.slice(at, card.indexOf(to, at + from.length));
  };
  const commitBody = between("async function handleCommit()", "function handleClearRoll()");
  const clearBody = between("function handleClearRoll()", "const abilityChecks");
  const guard = "spendsActionBudget(committedRoll.economy)";
  ok("Commit asks before spending a step", commitBody.length > 0 && commitBody.includes(guard));
  ok("...and so does Clear", clearBody.length > 0 && clearBody.includes(guard));
  ok("the roll carries what it spends into Commit and Clear", card.includes("economy: spends,"));
  ok("using a row spends through the one rule", card.includes("spendOnUse(e, spends, actionsMax)"));
}

console.log("\n4. the list a row is authored in is its economy");
{
  const mirror = (BROKEN_CHAIN_MONSTER_LIBRARY as MainMonsterTemplate[]).find(t => /Elemental Mirror/i.test(t.name));
  ok("the Elemental Mirror is in the library", Boolean(mirror));
  if (mirror) {
    const refraction = (mirror.reactions ?? []).find(a => /Reactive Refraction/i.test(a.name));
    ok("Reactive Refraction is authored in its reactions, typed as an action", Boolean(refraction) && refraction?.kind !== "reaction",
      String(refraction?.kind));
    const sorted = classifyMonsterRows(cardRows(mirror));
    ok("...and the card files it with the Reactions", sorted.reactions.some(a => /Reactive Refraction/.test(a.name))
      && !sorted.mainActions.some(a => /Reactive Refraction/.test(a.name)));
    /** ⚠ MUTATION: the old flatten, sorted by kind, puts it among the Actions — which is the bug. */
    const flattened = [...(mirror.actions ?? []), ...(mirror.reactions ?? []), ...(mirror.traits ?? [])];
    ok("MUTATION: flattening by kind files it with the Actions", classifyMonsterRows(flattened).mainActions.some(a => /Reactive Refraction/.test(a.name)));

    // A bonded body: its bond rows are the Bond section's, and never a swing.
    const body = materializeTemplateBody(mirror, { id: "gate", name: "Gate Mirror", bond: { templateId: "guardian", stage: 2, chosenPathIndex: 0 } as never });
    const bodySorted = classifyMonsterRows(cardRows(body));
    ok("a bonded body's bond rows are the Bond section's", bodySorted.bond.length > 0
      && !bodySorted.mainActions.some(a => a.name.startsWith("◈ ")) && !bodySorted.reactions.some(a => a.name.startsWith("◈ ")),
      bodySorted.bond.map(a => a.name).join(", "));
    const counter = deriveMonsterActionCounter(body.actions ?? [], 2);
    ok("...and the multiattack counter never counts one as a swing", !(counter?.actionNames ?? []).some(n => n.startsWith("◈ ")),
      (counter?.actionNames ?? []).join(", "));
  }
}

console.log("\n5. each row looks like what it is");
{
  const palette = { actions: "#ff6b5e", bonus: "#ffb02e", reactions: "#7b68ee", bond: "#e07bff", legendary: "#4ade80" };
  const claw = row({ name: "Claw", kind: "attack" });
  const bolt = row({ name: "Bolt", kind: "attack" });
  const fireball = row({ name: "Stormcharged Fireball", setId: "element", setOption: "Fire" } as never);
  const fireBolt = row({ name: "Fire Bolt", kind: "spell", setId: "element", setOption: "Fire" } as never);
  const frenzy = row({ name: "Frenzy", setId: "rage", setOption: "Blood" } as never);
  const rows = [claw, bolt, fireball, fireBolt, frenzy, bondRow, reaction, legendary, bonus, whole];
  const ctx: RowAccentContext = { palette, routine: { names: ["Claw", "Bolt"], perTurn: 2 }, setHueById: setHues(rows) };
  const acc = (r: MonsterReaderAction) => rowAccent(r, ctx);

  const economies = [acc(bondRow), acc(reaction), acc(claw), acc(bonus), acc(legendary)].map(a => a.color);
  ok("bond, reaction, action, bonus and legendary are five different colours", new Set(economies).size === 5, economies.join(" "));
  ok("every attack in the multiattack routine shares ONE colour and one label",
    acc(claw).color === acc(bolt).color && acc(claw).label === "Multiattack · 2/turn" && acc(bolt).label === acc(claw).label);
  ok("one authored set is one colour across sections — its action and its spell",
    acc(fireball).color === acc(fireBolt).color && acc(fireball).label === "Element · Fire", `${acc(fireball).label} / ${acc(fireBolt).label}`);
  ok("two different sets are two different colours", acc(fireball).color !== acc(frenzy).color);
  ok("...and neither is the routine's colour", acc(fireball).color !== acc(claw).color && acc(frenzy).color !== acc(claw).color);
  ok("a whole action outside any set is its own colour", acc(whole).color !== acc(claw).color && acc(whole).label === "Whole action");
  ok("an off-turn bond option says so", acc(bondOffTurn).label === "Bond · off-turn");
  ok("every row carries a label as well as a colour — colour alone fails colour-blind readers",
    rows.every(r => acc(r).label.trim().length > 0));

  const card = readFileSync(resolve(ROOT, "src/core/ui/MonsterActorCard.tsx"), "utf8");
  const cards = card.split("<ActionCard key={a.name} action={a}").length - 1;
  const accented = card.split("<ActionCard key={a.name} action={a} accent={rowAccentFor(a)}").length - 1;
  ok("every row on the card is drawn with its accent", cards > 0 && cards === accented, `${accented} of ${cards}`);
  ok("the row shows the stripe and the label", card.includes("borderLeft: `3px solid ${accent.color}`") && card.includes("{accent.label}"));
  ok("the card has a Bond section in the bond's colour", card.includes('<SectionLabel text="Bond" count={bond.length} accent={SECTION_ACCENT.bond} />'));
  ok("...whose rows are used by the bond, not the action", card.includes("isUsed={economy.bondUsed}"));
  ok("...and a Bond dot beside Reaction", card.includes('<EconomyDot label="Bond" used={economy.bondUsed}'));
  ok("legendary no longer borrows the bond colour", !/legendary:\s*tabAccent\("bond"\)/.test(card));
}

console.log(failures ? `\nFAILED (${failures})` : "\nALL PASS");
process.exit(failures ? 1 : 0);
