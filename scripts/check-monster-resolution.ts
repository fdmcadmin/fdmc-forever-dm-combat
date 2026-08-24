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

console.log(problems.length ? `\nFAILED: ${problems.join(", ")}` : "\nALL PASS");
process.exit(problems.length ? 1 : 0);
