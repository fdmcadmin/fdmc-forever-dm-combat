/**
 * A STOWED WEAPON HAS NO ATTACK — on the card and in the read, by one rule.
 *   npm run check:equippedattacks
 *
 * Christopher, 2026-10-06: *"i want to look into only having the actions of weapons that are
 * equipped on the character sheets, so if someone unequips it it removes the actions"*.
 *
 * ⚠ THE BUG WAS NOT ONLY COSMETIC. Attaching a weapon writes `equip-<id>` AND `atk-<id>`; only the
 * first carries `equipped`, and the equip toggle only ever flipped that one. `itemToAttackAction`
 * sets no `equipped` at all — so `equipped !== false`, the test `featContextFromActor` uses, passed
 * for every attack row ever written. A stowed greataxe went on winning the "representative weapon"
 * contest for feat pricing and went on being swung by `actorAsCreature` in the encounter checker.
 */
import { attackRowIsLive, attackRowIsStowed, owningEquipmentId } from "../src/core/rules/equippedAttacks";
import { applyEquippedOverlay } from "../src/core/state/equippedOverlay";
import { actorAsCreature } from "../src/core/encounter-band/actorAsCreature";
import { attackProfile } from "../src/modules/dnd-5e/featContextFromActor";

let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};

const equipRow = (id: string, equipped: boolean) => ({ id: `equip-${id}`, metadata: { equipped } });
const atkRow = (id: string, label: string, damage: string) => ({
  id: `atk-${id}`, label, actionKind: "equipment", economyCost: ["main"], logMode: "default",
  metadata: { attack: "1d20+@STR+@PROF", damage, damageType: "Slashing" },
});

console.log("A stowed weapon has no attack\n");

console.log("1. the rule itself");
{
  ok("an attack row names its equipment twin", owningEquipmentId("atk-blade") === "equip-blade");
  ok("an authored row names none", owningEquipmentId("longsword-attack") === undefined);
  ok("a row with no id names none", owningEquipmentId(undefined) === undefined);

  ok("equipped: the attack is live", attackRowIsLive({ id: "atk-blade" }, [equipRow("blade", true)]));
  ok("stowed: it is not", !attackRowIsLive({ id: "atk-blade" }, [equipRow("blade", false)]));
  ok("...and it says it is stowed rather than missing",
    attackRowIsStowed({ id: "atk-blade" }, [equipRow("blade", false)]));

  /**
   * ⚠ A ROW WITH NO FLAG AT ALL IS WORN. That is the convention everywhere else in the app
   * (`equipped !== false`), and it is what stops this gating every item attached before the flag
   * existed. It is the ATTACK row that lacks the flag, and it asks its twin.
   */
  ok("an equipment row with no flag is worn", attackRowIsLive({ id: "atk-blade" }, [{ id: "equip-blade" }]));

  /**
   * ⚠ A ROW WITH NO TWIN IS LIVE, and the first version of this rule had it backwards.
   *
   * It read an `atk-` row with no `equip-` row as a detached weapon and refused it. `check:party`
   * failed on the spot: the Wendigo Ember Heart is authored as `atk-heart` ON THE EQUIPMENT TAB
   * with no separate equipment row, and it is a real item with a real charge. The twin pair is what
   * `attachItem` writes, not what every attack row looks like.
   */
  ok("an attack row with no twin is live — nothing equips or stows it",
    attackRowIsLive({ id: "atk-heart" }, []));
  ok("...and is not reported as stowed either", !attackRowIsStowed({ id: "atk-heart" }, []));

  /** An authored attack belongs to no item and is never gated by one. */
  ok("an authored attack is live with no equipment at all", attackRowIsLive({ id: "psionic-strike" }, []));
}

console.log("\n2. the encounter checker stops swinging it");
{
  const sheet = (equipped: boolean) => ({
    id: "pc", kind: "player", name: "Stower", level: 7, attacksPerAction: 1,
    stats: { ac: 17, hp: { current: 60, max: 60 }, speed: "30 ft." },
    abilityScores: {
      str: { score: 20 }, dex: { score: 12 }, con: { score: 14 },
      int: { score: 10 }, wis: { score: 12 }, cha: { score: 10 },
    },
    tabs: {
      main: [
        atkRow("dagger", "Dagger", "1d4+@STR"),
        atkRow("greataxe", "Greataxe", "1d12+@STR"),
      ],
      equipment: [equipRow("dagger", true), equipRow("greataxe", equipped)],
    },
  }) as never;

  const drawn = actorAsCreature(sheet(true));
  const stowed = actorAsCreature(sheet(false));
  const names = (c: ReturnType<typeof actorAsCreature>) =>
    (c.creature.actions as Array<{ name?: string }>).map(a => a.name);

  ok("with the axe drawn the routine has both", names(drawn).join(", ") === "Dagger, Greataxe", names(drawn).join(", "));
  ok("stowed, the axe is gone from the routine", names(stowed).join(", ") === "Dagger", names(stowed).join(", "));
  /** ⚠ NAMED, NOT SILENT. A number that drops with no explanation is the complaint this app keeps earning. */
  ok("...and the read says why", stowed.assumptions.some(a => /stowed, so it is not swung/.test(a)),
    stowed.assumptions.join(" | "));
  ok("a drawn weapon raises no such note", !drawn.assumptions.some(a => /stowed/.test(a)));

  /** ⚠ AND AN AUTHORED ITEM ATTACK WITH NO EQUIPMENT ROW STILL SWINGS — the Ember Heart shape. */
  const untwinned = actorAsCreature({
    ...(sheet(true) as unknown as { tabs: Record<string, unknown[]> }),
    tabs: { main: [atkRow("heart", "Wendigo Ember Heart", "3d6")], equipment: [] },
  } as never);
  ok("an attack row with no equipment twin is still swung",
    (untwinned.creature.actions as Array<{ name?: string }>).some(a => a.name === "Wendigo Ember Heart"),
    (untwinned.creature.actions as Array<{ name?: string }>).map(a => a.name).join(", "));
}

console.log("\n3. feat pricing reads the weapon in hand");
{
  const actor = (equipped: boolean) => ({
    level: 9, attacksPerAction: 2,
    abilityScores: { str: { score: 20 }, dex: { score: 12 }, con: { score: 16 },
      int: { score: 10 }, wis: { score: 12 }, cha: { score: 10 } },
    tabs: {
      main: [
        /** A plain bonus, as `check:feats` uses — `resolvedFormulaText` returns undefined for an
            unresolved @-token and the candidate is skipped, which is a different test than this one. */
        { ...atkRow("dagger", "Dagger", "1d4 + 5"), tags: ["simple", "light"], category: "Melee One-Handed",
          metadata: { attack: "+9", damage: "1d4 + 5", damageType: "Piercing" } },
        { ...atkRow("greataxe", "Greataxe", "1d12 + 5"), tags: ["martial", "heavy"], category: "Melee Two-Handed",
          metadata: { attack: "+9", damage: "1d12 + 5", damageType: "Slashing" } },
      ],
      equipment: [equipRow("dagger", true), equipRow("greataxe", equipped)],
    },
  }) as never;

  const drawn = attackProfile(actor(true), 16);
  const stowed = attackProfile(actor(false), 16);
  /**
   * ⚠ THE WHOLE POINT. The greataxe is the bigger number, so it won the representative-weapon
   * contest whatever the player had actually drawn — and with it went Great Weapon Master's Heavy
   * gate, the per-hit damage every DPR feat prices against, and the party's own read.
   */
  ok("drawn, the axe is the representative weapon", (drawn?.perHitDamage ?? 0) > 10, String(drawn?.perHitDamage));
  ok("stowed, the dagger is", (stowed?.perHitDamage ?? 0) < 10, String(stowed?.perHitDamage));
  ok("...so a stowed Heavy weapon no longer gates Great Weapon Master",
    drawn?.heavyWeaponEquipped === 1 && stowed?.heavyWeaponEquipped === 0,
    `drawn ${drawn?.heavyWeaponEquipped} / stowed ${stowed?.heavyWeaponEquipped}`);
}

console.log("\n4. the card reads the same rule");
{
  const card = (await import("node:fs")).readFileSync("src/core/ui/ActorCard.tsx", "utf8");
  /** WHICH rows it filters is asserted in §5, against the overlaid list the card actually renders. */
  ok("the Actions tab filters on it", card.includes(".filter((action) => attackRowIsLive("));
  ok("...and so do the Opportunity Attack and extra-attack pickers",
    card.includes(".filter(a => attackRowIsLive("));
  ok("...from the shared rule, not a second copy",
    card.includes('from "../rules/equippedAttacks"') && !card.includes("function attackRowIsLive"));
}

console.log("\n5. the overlay is what the card shows, so it is what the card gates on");
{
  /**
   * ⚠ `useEquippedState` WINS OVER THE DOCUMENT, BY DESIGN. It is a synced map so a toggle reaches
   * every card at once instead of waiting for a document push. 0.8.75.14 gated the Actions tab on
   * the RAW document, so the Actions tab and the equipment list beside it could disagree about the
   * same weapon — the row saying "Equipped" while its attack stayed hidden.
   */
  const docSaysStowed = [{ id: "equip-axe", metadata: { equipped: false } }];
  const overlaySaysWorn = applyEquippedOverlay(docSaysStowed, { "equip-axe": true });
  ok("the overlay can bring a stowed weapon back",
    attackRowIsLive({ id: "atk-axe" }, overlaySaysWorn) && !attackRowIsLive({ id: "atk-axe" }, docSaysStowed));

  const docSaysWorn = [{ id: "equip-axe", metadata: { equipped: true } }];
  const overlaySaysStowed = applyEquippedOverlay(docSaysWorn, { "equip-axe": false });
  ok("...and can stow one the document calls worn",
    !attackRowIsLive({ id: "atk-axe" }, overlaySaysStowed) && attackRowIsLive({ id: "atk-axe" }, docSaysWorn));

  const card = (await import("node:fs")).readFileSync("src/core/ui/ActorCard.tsx", "utf8");
  ok("the card gates on the overlaid rows, not the raw tab",
    card.includes("attackRowIsLive(action, carriedWithOverlay)")
    && card.includes("attackRowIsLive(a, carriedWithOverlay)")
    && !card.includes("attackRowIsLive(action, actor.tabs.equipment"));
  ok("...and the equipment list it renders is the SAME list",
    card.includes("const allCarried = carriedWithOverlay;"));
}

console.log("\n6. saving the character editor re-points the overlay at the document");
{
  /**
   * ⚠ NOTHING EVER TOOK THE OVERLAY BACK DOWN. Once an item had an entry, the editor could set it
   * equipped or stowed all day and the card went on showing the overlay's answer — Iskarn's editor
   * said Gift of Oakheart was unequipped while his card showed it worn, and his Flail the reverse.
   */
  const editor = (await import("node:fs")).readFileSync("src/core/ui/ActorEditor.tsx", "utf8");
  ok("every save re-points it", editor.includes("syncOverlayToDocument(edited.id, edited.tabs?.equipment ?? [])"));
  ok("...from the shared hook, not a second store", editor.includes("useEquippedState()"));

  const store = (await import("node:fs")).readFileSync("src/core/state/useEquippedState.ts", "utf8");
  /**
   * ⚠ IT SETS RATHER THAN CLEARS. `onMessage` MERGES per actor, so a broadcast can add or overwrite
   * a key but never remove one — a clear would heal this window and leave every other window holding
   * the stale entry.
   */
  ok("the helper writes the document's own values",
    store.includes("fromDocument[row.id] = row.metadata?.equipped !== false;"));
  ok("...and broadcasts them, so other windows follow",
    store.includes("state: { [actorId]: fromDocument }"));
}

console.log("\n7. the character editor can equip and stow as a fallback");
{
  /**
   * Christopher, 2026-10-07: *"give me a button on the character editor to toggle equipment items as
   * a fallback incase it doesnt trigger on the character sheet"*. The card stays the normal place to
   * equip; this is the second way in when its toggle does not reach the document.
   */
  const bag = (await import("node:fs")).readFileSync("src/core/ui/EquipmentBagEditor.tsx", "utf8");
  ok("each attached row offers the toggle", bag.includes("onClick={() => toggleEquippedItem(action)}"));
  ok("...labelled for the state it is in", bag.includes('{isUnequipped ? "Equip" : "Equipped"}'));
  /**
   * ⚠ IT WRITES THE DRAFT. This editor hands changes up through `onChange`; the character is written
   * when the editor SAVES, which is also what re-points the worn-state overlay. Pushing to every card
   * on the press would leave Cancel unable to undo it.
   */
  ok("...through onChange, so Cancel can still discard it",
    bag.includes("function toggleEquippedItem") && bag.includes("onChange({"));
  /**
   * ⚠ AND IT HONOURS THE SLOT RULE. A fallback that can put two body pieces on is a worse problem
   * than the one it works around — verified in the DOM: equipping a body-slot robe took the worn
   * plate off, while equipping a slotless Gift displaced nothing.
   */
  ok("...and takes off what shares the slot, as the card does",
    bag.includes("SLOT_CAPACITY[slot]") && bag.includes("displace.has(a.id)"));
  ok("the superseded comment is gone, not left contradicting the code",
    !bag.includes("it doesn't decide what is worn right now. The row still"));
}

console.log(failures === 0
  ? "\nOK — a stowed weapon is gone from the card and from the read"
  : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
