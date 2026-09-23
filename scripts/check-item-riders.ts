/**
 * A RIDER ON A PLAIN WEAPON REACHES THE SWING — three gates, one feature.
 *   npx tsx scripts/check-item-riders.ts
 *
 * Christopher, 2026-09-10: *"things like the rimecleaver and some of the wendigo wights cant be
 * built correctly because the per turn rider on weapons are only on the gift chassis not the
 * regular weapons"*, then: *"so you are saying i still cant add the riders on the equipment, why
 * was it stopped before it was corrected to where i could author these."*
 *
 * ⚠ THREE GATES STOOD IN FRONT OF ONE FEATURE, AND EACH ONE HID THE NEXT.
 *
 *   1. the editor could not WRITE a rider on a plain weapon — the control sat inside the chassis
 *      panel, behind `const on = Boolean(spec)`
 *   2. `itemToAttackAction` did not CARRY one onto the swing — it took attack, damage, crit,
 *      range and charges, and dropped riders
 *   3. the card did not READ one — `turnRiders` looked at `metadata.turnRider` and nothing else
 *
 * Fixing any ONE of them alone would have looked like it worked and changed nothing a player could
 * see, which is exactly why this gate asserts the whole road rather than any single hop.
 *
 * Measured before: 8 of 164 authored items carried a rider, and all eight were Gift chassis items.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { itemToAttackAction, itemToAction, type EquipmentItem } from "../src/core/ui/EquipmentBagEditor";
import { riderSide, riderWeaponActionId } from "../src/core/rules/weaponRiders";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};
const codeOf = (p: string) => readFileSync(resolve(ROOT, p), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

/** Rimecleaver as the document prints it: a plain greatsword, no chassis. */
const rimecleaver = {
  id: "rimecleaver", name: "Rimecleaver", type: "weapon", description: "",
  isUsable: true, attack: "1d20+@STR+@PROF+1", damage: "2d6+@STR+1",
  riders: [{ id: "rimebite", label: "Rimebite", formula: "1d6", damageType: "Cold", cadence: "perTurn" }],
} as unknown as EquipmentItem;

console.log("A rider on a plain weapon reaches the swing\n");

console.log("1. the editor can write one without a chassis");
{
  const chassis = codeOf("src/core/ui/ChassisFields.tsx");
  /**
   * ⚠ THE MUTATION IS THE SHIPPED SHAPE: the Riders block inside `{on && …}`. It is asserted by
   * POSITION — the block has to start after the chassis conditional closes.
   */
  const gateAt = chassis.indexOf("{on && (");
  const ridersAt = chassis.indexOf("set(\"riders\"");
  const closeAt = chassis.indexOf("      )}", gateAt);
  ok("the chassis panel is still gated on being a chassis", gateAt > 0);
  ok("...and the Riders control is OUTSIDE that gate", ridersAt > closeAt && closeAt > 0,
    `riders@${ridersAt} close@${closeAt}`);
}

console.log("\n2. the weapon's ATTACK action carries it");
{
  const swing = itemToAttackAction(rimecleaver, false) as unknown as { metadata?: Record<string, unknown> };
  const riders = (swing.metadata?.riders ?? []) as Array<{ formula?: string }>;
  ok("the swing carries the rider", riders.length === 1, JSON.stringify(riders));
  ok("...with its dice", riders[0]?.formula === "1d6", String(riders[0]?.formula));

  // The generic item-use action always carried them; it must keep doing so.
  const use = itemToAction(rimecleaver, false) as unknown as { metadata?: Record<string, unknown> };
  ok("the item-use action still carries it too", ((use.metadata?.riders ?? []) as unknown[]).length === 1);

  /**
   * ⚠ AND AN ITEM WITH NO RIDER GAINS NO EMPTY FIELD. An `riders: []` on every weapon would make
   * "has a rider" untestable everywhere downstream.
   */
  const plain = itemToAttackAction({ ...rimecleaver, riders: undefined } as EquipmentItem, false) as unknown as { metadata?: Record<string, unknown> };
  ok("mutation: no rider authored, no riders field", plain.metadata?.riders === undefined);
}

console.log("\n3. the card reads it, through the chip it already had");
{
  const card = codeOf("src/core/ui/ActorCard.tsx");
  ok("turnRiders reads equipment riders as well as authored ones",
    /a\.metadata\?\.riders \?\? \[\]/.test(card));
  /**
   * ⚠ KEYED ON THE RIDER, NOT THE ACTION — for two reasons at once. A weapon may print two riders,
   * so an action-level key would collapse them into one chip; and one item reaches the sheet as
   * two actions, so an action-level key would print each rider twice. The rider's own id answers
   * both, which is why the key carries no action id at all.
   */
  ok("...keyed per RIDER, because a weapon may print two",
    /id: `rider::\$\{r\.id \|\| r\.label\}`/.test(card));
  /**
   * ⚠ ONLY THE PER-TURN CADENCES. A shortRest or perEncounter rider has a different reset, and
   * treating it as per-turn would hand the table a once-a-rest effect every round.
   */
  ok("...and only the per-turn cadences are claimed here",
    /r\.cadence === "perTurn" \|\| r\.cadence === "perRound"/.test(card));
}

console.log("\n4. and it is claimed where the other toggles are");
{
  const card = codeOf("src/core/ui/ActorCard.tsx");
  /**
   * ⚠ PLACEMENT IS PART OF THE FEATURE. The chips first rendered beside the RESOURCE POOLS, on the
   * reasoning that a spent rider is "something you have or have spent". Christopher went looking
   * among the toggles and did not find them: *"they are not above the thing were GWM and TWF."*
   * Great Weapon Master, Two-Weapon Fighting and Rimebite are the same gesture — a thing you flip
   * on when it applies — so they belong in one strip.
   */
  const panelAt = card.indexOf("function renderWeaponBuffPanel");
  const chipsAt = card.indexOf("turnRiders.map", panelAt);
  const nextFn = card.indexOf("function renderTemporaryActionsPanel", panelAt);
  ok("the rider chips render inside the Fighting Styles & Buffs panel",
    panelAt > 0 && chipsAt > panelAt && chipsAt < nextFn,
    `panel@${panelAt} chips@${chipsAt} next@${nextFn}`);

  /**
   * ⚠ AND THE PANEL MUST NOT BAIL BEFORE SHOWING THEM. It returns null with no fighting style and
   * no light weapon — which describes a Barbarian holding a Rimecleaver, whose only toggle IS the
   * rider. The TWF clause fixed this same hole once already.
   */
  ok("...and the panel stays open for a character whose ONLY toggle is a rider",
    /buffs\.length === 0 && !showTwf && turnRiders\.length === 0/.test(card));
}

console.log("\n5. one item reaches the sheet as TWO actions — and claims ONE chip");
{
  /**
   * ⚠ AN EQUIPPED WEAPON IS BOTH ROWS. `itemToAction` builds the equipment entry and
   * `itemToAttackAction` builds the swing; both carry the item's riders, which is correct — the
   * rider belongs to the ITEM. Mapping over every action without deduping printed each one twice:
   * *"now it is on there twice."*
   */
  const rowRiders = ((itemToAction(rimecleaver, false) as never as { metadata?: { riders?: Array<{ id: string }> } }).metadata?.riders ?? []);
  const swingRiders = ((itemToAttackAction(rimecleaver, false) as never as { metadata?: { riders?: Array<{ id: string }> } }).metadata?.riders ?? []);
  ok("both actions carry the rider", rowRiders.length === 1 && swingRiders.length === 1);
  ok("...and they are the SAME rider by id, so it can be deduped",
    rowRiders[0]?.id === swingRiders[0]?.id, `${rowRiders[0]?.id} vs ${swingRiders[0]?.id}`);

  const card = codeOf("src/core/ui/ActorCard.tsx");
  ok("the card dedupes riders before claiming them", /const seen = new Set<string>\(\)/.test(card));
  ok("...keyed on the rider's own id", /const key = r\.id \|\| /.test(card));
}

console.log("\n6. editing the sheet's copy does not strip the item");
{
  /**
   * ⚠ OPENING THE EDITOR USED TO DELETE THEM. `actionToItem` reads an attached action back into an
   * item, and saving writes that item down — so a field missing THERE is stripped from the sheet
   * by the act of looking at it. Christopher: *"it deletes it if i open up the character editor."*
   *
   * Asserted on the source because the function is component-local. The list has to stay complete;
   * `charges` and `convergence` are already here for the same reason, and each was a bug first.
   */
  const equip = codeOf("src/core/ui/EquipmentBagEditor.tsx");
  const at = equip.indexOf("function actionToItem");
  const end = equip.indexOf("\n  }", at);
  const body = equip.slice(at, end);
  ok("actionToItem carries riders home", /riders: m\.riders/.test(body));
  ok("...and the chassis state with them", /chassis: m\.chassis/.test(body) && /pbToDamage: m\.pbToDamage/.test(body));
}

console.log("\n7. a rider is a toggle that RIDES THE ROLL, like GWF and Hunter's Mark");
{
  /**
   * Christopher, 2026-09-18: *"also ensure any weapon riders are toggleables like GWF and HM, right now they are
   * click and it turns shows used but it may or may not add to the rolls."* It never added. The chip called
   * `claimTurnRider`, which marked it spent and logged "1d6 Cold added to this hit" — and no roll changed,
   * because the chip was a claim and never an armed effect `getDamageAdditives` could see.
   */
  ok("damage dice join the roll", riderSide("1d6", "Cold") === "damage" && riderSide("2d6") === "damage");
  ok("temporary HP rolls on its own, never onto the target's damage", riderSide("1d6", "Healing") === "healing");
  ok("a rider with no dice is applied, not rolled", riderSide(undefined) === "none" && riderSide("", "Cold") === "none");
  ok("a rider on either row of an item rides that item's swing",
    riderWeaponActionId("equip-rimecleaver", false) === "atk-rimecleaver" && riderWeaponActionId("atk-rimecleaver", false) === "atk-rimecleaver");
  ok("...an authored rider on an attack rides that attack; elsewhere, any weapon",
    riderWeaponActionId("hew", true) === "hew" && riderWeaponActionId("distant-strike", false) === undefined);

  const card = codeOf("src/core/ui/ActorCard.tsx");
  ok("the chip toggles an armed effect instead of claiming", card.includes("onClick={() => toggleTurnRider(chip)}")
    && !card.includes("onClick={() => claimTurnRider("));
  ok("...drawn as the same toggle chip as the fighting styles", card.includes('className={`armed-effect-chip ${armed ? "rage-armed" : ""}`}'));
  /**
   * ⚠ AN EXTRA ATTACK ASKS WHICH WEAPON — it does not assume the one it was authored on.
   *
   * Christopher, 2026-09-23: *"the hew in the app is listed as a set X weapon when it should be the
   * same way that different spell types are where you get to pick the spell type(or like OA is listed
   * where you choose which weapon to roll it with)"*. Hew is "one attack with the same weapon" — the
   * weapon that just crit or just dropped something, which the sheet cannot know in advance.
   */
  ok("...an extra-attack rider opens the weapon pick rather than logging a claim",
    card.includes("if (oaWeaponAttacks.length === 1) { useRiderExtraAttack(chip, oaWeaponAttacks[0].id); return; }")
    && card.includes("setRiderPickingWeapon(current => (current === action.id ? null : action.id));"));
  ok("...offering the SAME weapon list the Opportunity Attack offers",
    card.includes("{oaWeaponAttacks.map(w => (")
    && card.includes("onClick={() => useRiderExtraAttack(chip, w.id)}"));
  ok("...and the pick swings that weapon through the ordinary use path",
    card.includes('handleUseAction({ action: weapon, tabId: "main", costs });'));
  /** ⚠ Hew costs a Bonus Action; Distant Strike costs nothing. The rider says which. */
  ok("...spending exactly what the rider says the extra attack costs",
    card.includes('const costs = rider.kind === "extraAttack" ? rider.cost ?? [] : [];'));
  ok("...and a character with one weapon is not asked a question with one answer",
    card.includes("if (oaWeaponAttacks.length === 1)"));
  /**
   * ⚠ A BONUS ACTION AND AN EXTRA ATTACK ON THE ATTACK ACTION ARE DIFFERENT THINGS, and the chip has
   * to say which. Christopher, 2026-09-23: *"hew must also consume a bonus action not a +1 main attack,
   * while the class action of the horizon walker ... would be read as a +1 to main attack, as well as
   * the nick property"*. Hew spends the Bonus Action; Distant Strike and Nick spend nothing.
   */
  ok("...and the chip states which economy the extra attack uses",
    card.includes('"+1 attack · on the Attack action"')
    && card.includes("`+1 attack · ${riderCost.map(c => actionCostLabels[c] ?? c).join(\" + \")}`"));

  const editor = codeOf("src/core/ui/ActorEditorActionTab.tsx");
  ok("the editor can author that cost", editor.includes('<option value="bonus">Bonus Action (Hew)</option>')
    && editor.includes('<option value="">nothing — an extra attack on the Attack action (Distant Strike, Nick)</option>'));
  ok("...and the draft round-trips it, since the draft IS the metadata object",
    editor.includes("turnRider: action.metadata?.turnRider,")
    && codeOf("src/core/ui/pcActionTypes.ts").includes("cost?: ActionCost[] };"));
  ok("...pressing an armed rider puts it away unspent", card.includes("if (armedEffects.some(e => e.id === effectId)) { clearArmedEffect(effectId); return; }"));
  ok("...armed with its dice, on its own weapon", card.includes('...(chip.side === "damage" ? { formula: dice } : {}),')
    && card.includes("appliesToActionId: chip.weaponActionId,"));
  /** ⚠ THE WHOLE COMPLAINT: the dice reach the damage roll. */
  ok("getDamageAdditives adds an armed rider to its weapon's damage roll",
    card.includes('if (effect.id.startsWith("rider:") && !buffMatchesAttack(effect.appliesTo, entry?.action, effect.appliesToActionId)) {'));
  ok("...and the hit's damage roll is what spends it, before the additives clear",
    /await consumeArmedRiders\(\);\s*consumeResolvedDamageAdditives\(damageChoice\);/.test(card)
    && card.includes("riding.forEach(e => e.riderKey && next.add(e.riderKey))"));
  ok("...a healing rider rolls its own dice beside the hit", card.includes('if (effect.riderSide === "healing" && effect.sideFormula?.trim()) {'));
  /** A rider is one hit's worth. Persistence would ride every swing, which is what "once per turn" forbids. */
  const persistent = card.slice(card.indexOf("function isPersistentDamageAdditive"), card.indexOf("function normalizeFirstRollFormula"));
  ok("an armed rider is NOT persistent — it clears after the roll it rode", persistent.length > 0 && !persistent.includes("rider:"));
}

console.log(failures ? `\nFAILED (${failures})` : "\nALL PASS");
process.exit(failures ? 1 : 0);
