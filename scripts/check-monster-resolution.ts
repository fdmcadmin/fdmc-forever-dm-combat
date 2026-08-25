/**
 * The monster library precedence rule — the one the checker now reads through.
 *   npx tsx scripts/check-monster-resolution.ts
 *
 * A rule that lived inside a component was obeyed only by that component; the encounter checker
 * and creature estimator priced SHIPPED creatures while the library panel showed edited ones.
 * These are the four cases that rule has to get right.
 */
import { resolveMonsterLibrary, isCampaignTemplateId } from "../src/core/monsters/dmMonsterLibrary";
import type { MainMonsterTemplate } from "../src/core/monsters/runtime/mainMonsterRuntime";
import { rosterFromTemplates } from "../src/core/encounter-band/rosterFromLibrary";
import { effectiveHpPerBody } from "../src/core/encounter-band/checkerV2";
import { BROKEN_CHAIN_MONSTER_LIBRARY } from "../src/data/broken-chain/monsterLibrary";

const tpl = (templateId: string, name: string, maxHp: number, ac: number, extra: Partial<MainMonsterTemplate> = {}) => ({
  templateId, name,
  stats: { ac, maxHp, speed: "30 ft", kind: "humanoid" },
  abilities: [], actions: [], traits: [], reactions: [],
  visibility: { defaultState: "hp-bar", hiddenName: "?", revealedName: name },
  ...extra,
}) as unknown as MainMonsterTemplate;

const bundled = [tpl("broken-chain:warden", "Hollow Warden", 76, 16)];

const problems: string[] = [];
const eq = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}${ok ? "" : `   got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`);
  if (!ok) problems.push(label);
};
const hpOf = (r: { library: MainMonsterTemplate[] }, id: string) =>
  r.library.find(t => t.templateId === id)?.stats.maxHp;

console.log("monster library precedence:");

// 1. Nothing stored — the shipped creature, untouched.
eq("no stored copy -> shipped stats", hpOf(resolveMonsterLibrary(bundled, { stored: [] }), "broken-chain:warden"), 76);

// 2. A DELIBERATE edit wins, and is reported as an override.
const edited = tpl("broken-chain:warden", "Hollow Warden", 99, 18, { dmEdited: { at: "2026-08-24" } });
const r2 = resolveMonsterLibrary(bundled, { stored: [edited] });
eq("dmEdited copy wins", hpOf(r2, "broken-chain:warden"), 99);
eq("...and is reported as overridden", r2.overridden.map(o => o.id), ["broken-chain:warden"]);
eq("...and is not called a stale seed", r2.shadowed.length, 0);

// 3. An UNMARKED stored copy is a stale seed: the shipped template wins, and it is reported.
//    This is the Hollow Warden 78/18-vs-76/16 case that started the rule.
const stale = tpl("broken-chain:warden", "Hollow Warden", 78, 18);
const r3 = resolveMonsterLibrary(bundled, { stored: [stale] });
eq("unmarked copy LOSES", hpOf(r3, "broken-chain:warden"), 76);
eq("...and is reported as shadowed", r3.shadowed.map(s => `${s.was} -> ${s.now}`), ["78 HP / AC 18 -> 76 HP / AC 16"]);
eq("...and is not called an override", r3.overridden.length, 0);

// 4. A DM's own creature always appears, and is never mistaken for campaign content.
const mine = tpl("custom-goblin", "Ripper", 22, 13);
const r4 = resolveMonsterLibrary(bundled, { stored: [mine] });
eq("DM creation is present", hpOf(r4, "custom-goblin"), 22);
eq("DM creation is not campaign", isCampaignTemplateId("custom-goblin", bundled), false);
eq("bundled id IS campaign", isCampaignTemplateId("broken-chain:warden", bundled), true);

// 5. Locked module: campaign content is withheld, the DM's own is not.
const r5 = resolveMonsterLibrary(bundled, { stored: [mine, edited], includeCampaign: false });
eq("locked hides campaign", hpOf(r5, "broken-chain:warden"), undefined);
eq("locked keeps DM creations", hpOf(r5, "custom-goblin"), 22);

// 6. ONE BODY PER PC — the campaign's sole body-count exception.
//    "The Wood builds one mirror for each adventurer." Party size sets HOW MANY bodies, each
//    keeps a flat 90 HP, and the party-size HP band must NOT also apply. Priced from its stored
//    `count: 1` with the band on top, Gate II read 82.7 EHP against its authored 331.0 at 4P —
//    a gate at exactly a quarter of its real size, at every party count.
{
  const mirror = BROKEN_CHAIN_MONSTER_LIBRARY.find(t => t.name === "Elemental Mirror");
  eq("the Mirror declares one body per PC", Boolean(mirror?.stats.oneBodyPerPc), true);
  const perBody: number[] = [];
  for (const size of [3, 4, 5]) {
    const built = rosterFromTemplates([{ template: mirror!, quantity: 1 }], 8,
      { ac: 16, saveBonus: 2.6, partySize: size } as never);
    const group = built.roster[0];
    eq(`${size}P fields ${size} mirrors, not the stored count`, group.quantity, size);
    perBody.push(Number(effectiveHpPerBody(group, size).toFixed(4)));
  }
  // The band would give 0.75 / 1.0 / 1.25 here. One value across all three proves it is off.
  eq("every mirror is the same EHP at every party size", new Set(perBody).size, 1);
}

console.log(problems.length ? `\nFAILED: ${problems.join(", ")}` : "\nALL PASS");
process.exit(problems.length ? 1 : 0);
