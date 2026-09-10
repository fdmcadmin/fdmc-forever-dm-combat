/**
 * FLAME BLADE IS TWO COSTS ON ONE CARD — and the editor could write neither.
 *   npx tsx scripts/check-armed-attack.ts
 *
 * Christopher, 2026-09-10: *"flame blade is different its a bonus action to cast and then a magic
 * action to use"*, and *"there is no spot to put the flame blade as a armed attack."*
 *
 * `metadata.grantsArmedAttack` has carried this shape for a while and the card already honours it —
 * casting arms a chip, each later use pays only the attack's own cost and spends no slot. It
 * appeared in NO editor, draft or adapter, so the only way to author one was to hand-edit JSON.
 *
 * ⚠ THE ASSERTIONS FOLLOW THE ROUND TRIP, both ways. A field the editor can write but not read
 * back is a field that disappears the second time the card is opened.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { adaptPcActionToActorAction } from "../src/core/ui/pcActionAdapters";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};

console.log("An action can arm a repeatable attack\n");

const flameBlade = {
  id: "flame-blade", label: "Flame Blade", tab: "spell", actionCost: "bonus",
  armedAttackDamage: "3d6+@INT", armedAttackType: "fire",
  armedAttackCost: ["main"], armedAttackRange: "reach 5 ft",
  armedAttackDuration: "Concentration, up to 10 min",
} as never;

console.log("1. the cast and the swing keep their own costs");
{
  const a: any = adaptPcActionToActorAction(flameBlade);
  const armed = a.metadata?.grantsArmedAttack;
  ok("the card arms an attack", Boolean(armed));
  ok("the CAST is a bonus action", JSON.stringify(a.economyCost) === JSON.stringify(["bonus"]), JSON.stringify(a.economyCost));
  ok("each USE is the Magic action", JSON.stringify(armed?.cost) === JSON.stringify(["main"]), JSON.stringify(armed?.cost));
  ok("the damage rides on the armed attack, not the cast", armed?.damage === "3d6+@INT", String(armed?.damage));
  ok("...and its type with it", armed?.damageType === "fire", String(armed?.damageType));
  ok("the duration reaches the chip", armed?.duration === "Concentration, up to 10 min", String(armed?.duration));

  /**
   * ⚠ THE ATTACK FORMULA IS LEFT OUT ON PURPOSE. It defaults to `1d20+@SPELL`, which follows the
   * caster's own stat and proficiency; writing a number here freezes the bonus at the level it was
   * authored and it silently stops being right the moment the character levels.
   */
  ok("an unset attack formula stays unset", armed?.attack === undefined, String(armed?.attack));
}

console.log("\n2. an action that arms nothing is unchanged");
{
  const plain: any = adaptPcActionToActorAction({
    id: "x", label: "Firebolt", tab: "spell", actionCost: "action", damage: "2d10",
  } as never);
  ok("no damage entered, no armed attack", plain.metadata?.grantsArmedAttack === undefined);

  /**
   * ⚠ MUTATION: qualifiers alone must not arm anything. A cost and a duration with no damage
   * describes an attack that deals nothing, which the card would still show as a usable chip.
   */
  const qualifiersOnly: any = adaptPcActionToActorAction({
    id: "y", label: "Half", tab: "spell", actionCost: "bonus",
    armedAttackCost: ["main"], armedAttackDuration: "1 min",
  } as never);
  ok("mutation: cost and duration without damage arm nothing",
    qualifiersOnly.metadata?.grantsArmedAttack === undefined);
}

console.log("\n3. the editor can write it AND read it back");
{
  const src = readFileSync(resolve(ROOT, "src/core/ui/ActorEditorActionTab.tsx"), "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  ok("the editor reads an existing armed attack onto its draft",
    /armedAttackDamage: action\.metadata\?\.grantsArmedAttack\?\.damage/.test(code));
  ok("...and writes the damage", /set\("armedAttackDamage"/.test(code));
  ok("...and the per-use cost", /set\("armedAttackCost"/.test(code));
  ok("...and only asks for the rest once it is armed", /draft\.armedAttackDamage\?\.trim\(\) && \(/.test(code));
}

console.log(failures ? `\nFAILED (${failures})` : "\nALL PASS");
process.exit(failures ? 1 : 0);
