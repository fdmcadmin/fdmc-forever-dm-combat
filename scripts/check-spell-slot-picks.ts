/**
 * The spell-slot picker, end to end: pool -> plan -> ABS-array picking -> collapsed creature.
 *   npx tsx scripts/check-spell-slot-picks.ts
 */
import { slotPlan, needsSlotPicks, emptyPicks, availableFor, unfilledSlots, applySlotPicks } from "../src/core/monsters/spellSlotPicks";
import type { MainMonsterTemplate } from "../src/core/monsters/runtime/mainMonsterRuntime";

const spell = (name: string, level: number, candidate = true) =>
  ({ name, kind: "spell" as const, text: "", spellSlotLevel: level, ...(candidate ? { slotCandidate: true } : {}) });

const hale = {
  templateId: "probe-hale", name: "Hale",
  stats: { ac: 16, maxHp: 90, speed: "30 ft", kind: "humanoid", spellSlots: [{ level: 1, max: 3 }, { level: 2, max: 2 }] },
  abilities: [], visibility: { defaultState: "hp-bar", hiddenName: "?", revealedName: "Hale" },
  actions: [
    { name: "Longsword", kind: "attack" as const, text: "", roll: "+7", damage: "1d8+4" },
    spell("Bless", 1), spell("Shield of Faith", 1), spell("Healing Word", 1), spell("Guiding Bolt", 1),
    spell("Spiritual Weapon", 2), spell("Hold Person", 2), spell("Silence", 2),
    spell("Sacred Flame", 0, false),
  ],
  traits: [], reactions: [],
} as unknown as MainMonsterTemplate;

const problems: string[] = [];
const eq = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}${ok ? "" : `  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`);
  if (!ok) problems.push(label);
};

console.log("spell slot picker:");
eq("needsSlotPicks", needsSlotPicks(hale), true);

const plan = slotPlan(hale);
eq("levels planned", plan.map(l => `L${l.level}x${l.slots}(${l.candidates.length})`), ["L1x3(4)", "L2x2(3)"]);

const picks = emptyPicks(plan);
eq("empty sheet", picks, { 1: [null, null, null], 2: [null, null] });
eq("all slots reported unfilled", unfilledSlots(plan, picks).length, 5);

// ABS-array rule: a taken spell leaves the pool for its siblings at that level.
picks[1][0] = "Bless";
const forSecondSlot = availableFor(plan[0], 1, picks).map(c => c.name);
eq("taken spell leaves the pool", forSecondSlot.includes("Bless"), false);
eq("the slot that holds it still lists it", availableFor(plan[0], 0, picks).map(c => c.name).includes("Bless"), true);
eq("other levels untouched", availableFor(plan[1], 0, picks).length, 3);

picks[1][1] = "Healing Word";
picks[1][2] = "Guiding Bolt";
picks[2][0] = "Spiritual Weapon";
picks[2][1] = "Silence";
eq("nothing unfilled once picked", unfilledSlots(plan, picks), []);

const fielded = applySlotPicks(hale, picks);
const names = (fielded.actions ?? []).map(a => a.name);
eq("un-prepared candidate is gone", names.includes("Shield of Faith"), false);
eq("un-prepared candidate is gone (L2)", names.includes("Hold Person"), false);
eq("prepared spells came", ["Bless", "Healing Word", "Guiding Bolt", "Spiritual Weapon", "Silence"].every(n => names.includes(n)), true);
eq("non-candidates untouched", ["Longsword", "Sacred Flame"].every(n => names.includes(n)), true);
// 1 attack + 4 L1 candidates + 3 L2 candidates + 1 non-candidate cantrip.
eq("library entry unchanged", (hale.actions ?? []).length, 9);

console.log(problems.length ? `\nFAILED: ${problems.join(", ")}` : "\nALL PASS");
process.exit(problems.length ? 1 : 0);
