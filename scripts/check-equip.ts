/**
 * THE EQUIP GATE — the caps, and the layer each one lives in.
 *
 * Run: npm run check:equip
 *
 * These two rules were written THREE times (ActorCard, the GM-side handler, and not at all in
 * EquipmentBagEditor.attachItem, which attached items already worn). This gate exists so the third
 * copy cannot come back: every surface asks the same list, so asserting the list is asserting all
 * of them.
 *
 * ⚠ THE EXIT CHECK IS THE LAST THING IN THIS FILE. See MASTER on `check:summons`.
 */

import type { ActorAction } from "../src/core/types/tabs";
import { checkEquip, isWorn } from "../src/core/equipment/equipRules";
import { ACTIVE_EQUIP_RULES } from "../src/modules/equipRuleRoster";
import { attunementRule, attunementUsage, ATTUNEMENT_LIMIT } from "../src/modules/dnd-5e/attunementRule";
import { singularRule, singularUsage, isT4Singular } from "../src/modules/the-broken-chain/singularRule";
import { BROKEN_CHAIN_EQUIPMENT_LIBRARY } from "../src/data/broken-chain/equipmentLibrary";

let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};

/** An equipment row. `equipped` absent means WORN — that default is why grants must pass false. */
const item = (id: string, m: Partial<NonNullable<ActorAction["metadata"]>> = {}): ActorAction =>
  ({ id, label: id, metadata: m } as ActorAction);

const attuned = (id: string, equipped = true) => item(id, { attunementRequired: true, equipped });
const t4 = (id: string, equipped = true) => item(id, { tier: "T4", attunementRequired: true, equipped });

const ask = (target: ActorAction, equipment: ActorAction[]) =>
  checkEquip(ACTIVE_EQUIP_RULES, { actorName: "Tester", target, equipment });

console.log("Equip caps — engine asks, mods answer\n");

/* ── What "worn" means ──────────────────────────────────────────────────────────────────── */
console.log("The engine owns 'is it on?'");
ok("an absent equipped flag reads as WORN", isWorn(item("a")));
ok("equipped:false reads as in the bag", !isWorn(item("a", { equipped: false })));
ok("equipped:true reads as worn", isWorn(item("a", { equipped: true })));

/* ── Attunement — the D&D mod ───────────────────────────────────────────────────────────── */
console.log("\nAttunement (modules/dnd-5e)");
{
  const three = [attuned("a"), attuned("b"), attuned("c")];
  const target = attuned("d", false);
  ok(`a ${ATTUNEMENT_LIMIT + 1}th attuned item is refused`, ask(target, [...three, target])?.rule === "Attunement Full");

  const two = [attuned("a"), attuned("b")];
  ok("a third is allowed", ask(target, [...two, target]) === null);

  // The cap counts WORN items. Cargo in the bag holds no slot.
  const bagged = [attuned("a"), attuned("b"), attuned("c", false)];
  ok("an attuned item in the BAG holds no slot", ask(target, [...bagged, target]) === null);

  ok("a non-attuned item is never refused by this rule",
    attunementRule({ actorName: "T", target: item("plain", { equipped: false }), equipment: three }) === null);

  const usage = attunementUsage(three);
  ok("usage reports the badge numbers", usage.used === 3 && usage.limit === 3 && usage.full === true,
    `${usage.used}/${usage.limit}`);
}

/* ── T4 Singular — the Broken Chain mod ─────────────────────────────────────────────────── */
console.log("\nT4 Singular (modules/the-broken-chain)");
{
  ok("'4', 'T4' and 'Tier 4 Singular' all read as T4",
    isT4Singular("4") && isT4Singular("T4") && isT4Singular("Tier 4 Singular"));
  ok("'14' and 'Tier 3' do not", !isT4Singular("14") && !isT4Singular("Tier 3") && !isT4Singular(undefined));

  const held = [t4("relic")];
  const second = t4("second", false);
  ok("a SECOND T4 is refused", ask(second, [...held, second])?.rule === "T4 Limit");
  ok("the FIRST T4 is allowed", ask(second, [second]) === null);
  ok("a T4 in the bag does not block one being put on",
    ask(second, [t4("relic", false), second]) === null);

  const usage = singularUsage(held);
  ok("usage caps at one", usage.limit === 1 && usage.full === true);
}

/* ── The caps are INDEPENDENT ───────────────────────────────────────────────────────────── */
console.log("\nThe two caps are separate rules from separate layers");
{
  // One T4 worn, two attunement slots free: attunement permits it, the campaign does not.
  const oneT4 = [t4("relic")];
  const second = t4("second", false);
  ok("free attunement slots do not permit a second T4",
    ask(second, [...oneT4, second])?.rule === "T4 Limit");

  // A T4 that needs no attunement at all is still capped.
  const freeT4 = item("free-t4", { tier: "4", equipped: false });
  ok("a T4 needing no attunement is still capped",
    singularRule({ actorName: "T", target: freeT4, equipment: [t4("relic"), freeT4] })?.rule === "T4 Limit");

  // Three ordinary attuned items and no T4: attunement refuses, singular has no opinion.
  const three = [attuned("a"), attuned("b"), attuned("c")];
  const plainAttuned = attuned("d", false);
  ok("attunement refuses where singular is silent",
    singularRule({ actorName: "T", target: plainAttuned, equipment: three }) === null
    && ask(plainAttuned, [...three, plainAttuned])?.rule === "Attunement Full");

  // Trips BOTH: the familiar cap is the one reported, per the roster's order.
  const bothTarget = t4("both", false);
  const full = [attuned("a"), attuned("b"), t4("relic")];
  ok("an item tripping both reports Attunement first",
    ask(bothTarget, [...full, bothTarget])?.rule === "Attunement Full");
}

/* ── Every denial is actionable ─────────────────────────────────────────────────────────── */
console.log("\nA refusal says how to fix it");
{
  const three = [attuned("a"), attuned("b"), attuned("c")];
  const target = attuned("d", false);
  const d = ask(target, [...three, target]);
  ok("message names the item and the way out",
    Boolean(d && d.message.includes(target.label) && /remove/i.test(d.message)));
  ok("hint is short enough for a tooltip", Boolean(d && d.hint.length > 0 && d.hint.length < 90));
}

/* ── THE T4 CAP AGAINST THE REAL LIBRARY ──────────────────────────────────────────────────── */
console.log("\nT4 Singular cap, read off the campaign library");
{
  /**
   * ⚠ THIS RULE HAD NEVER MET ITS OWN DATA. `singularRule` was written on 2026-08-17 and its own
   * note said so — *"NO T4 EXISTS IN THE CAMPAIGN LIBRARY YET — it tops out at tier 2. This guards
   * a shape the data has not reached."* Eight Catalyst-tempered Singulars landed on 2026-09-01, and
   * Christopher's question was the right one: *"why would we add in the T4 and not check if the
   * singularity tag was written correctly."*
   *
   * A cap that has only ever been tested against hand-built fixtures is a cap nobody has tested.
   * These read the library.
   */
  const lib = BROKEN_CHAIN_EQUIPMENT_LIBRARY as Array<{ name: string; tier?: string; convergence?: { actLabel?: string } }>;
  const t4Items = lib.filter(i => isT4Singular(i.tier));
  const a4Items = lib.filter(i => i.convergence?.actLabel === "A4");

  ok("every Tier 4 Singular in the library reads as one", t4Items.length === 8, `${t4Items.length} found`);
  ok("and nothing else does — no false positive on a tier string",
    lib.filter(i => isT4Singular(i.tier)).length === t4Items.length && t4Items.every(i => /Tempered/.test(i.name)),
    t4Items.map(i => i.name).join(", "));
  ok("the eight raw A4 components are NOT T4 — a component is not its own output",
    a4Items.length === 8 && a4Items.every(i => !isT4Singular(i.tier)));

  // The bag builds an equipped action's metadata with `tier: item.tier` (EquipmentBagEditor).
  const asWorn = (i: { name: string; tier?: string }, equipped = true) =>
    ({ id: i.name, label: i.name, metadata: { tier: i.tier, equipped } }) as unknown as ActorAction;

  ok("the first T4 equips", singularRule({ actorName: "PC", target: asWorn(t4Items[0], false), equipment: [] } as never) === null);
  const second = singularRule({ actorName: "PC", target: asWorn(t4Items[1], false), equipment: [asWorn(t4Items[0])] } as never);
  ok("a SECOND T4 is refused", Boolean(second), second ? second.rule : "not refused");
  ok("a raw A4 component beside a worn T4 is allowed",
    singularRule({ actorName: "PC", target: asWorn(a4Items[0], false), equipment: [asWorn(t4Items[0])] } as never) === null);
  ok("the cap reports itself full at one", singularUsage([asWorn(t4Items[0])] as never).full === true);
}

console.log(`\n${failures === 0 ? "PASS" : `FAIL — ${failures} check(s)`}`);
process.exit(failures === 0 ? 0 : 1);
