/**
 * READING A TRAIT AND NAMING ITS CALIBRATED RULE.
 *
 * Christopher: *"i dont like the 'defense' button because the parser should be able to read
 * something like Elemental guard and do the assigned defense to it."*
 *
 * He is right, and the editor was already most of the way there. It made the DM pick a rule from
 * a list of 58 and derived the multiplier from it — which is RULE 2 and stays — but the DM had
 * ALREADY written the trait, in prose, two panels up. Making them find it again in a dropdown is
 * asking for the same fact twice.
 *
 * Elemental Guard is the example that makes the point: *"immune to it, resistant to the paired
 * type, until its next turn"* is, word for word, the workbook's `Telegraphed alternating
 * immunity/resistance`. Nobody should have to know that.
 *
 * ─── WHAT THIS IS ALLOWED TO DO, AND WHAT IT IS NOT ──────────────────────────────────────────
 *
 * ⚠ IT PROPOSES. IT NEVER DECIDES SILENTLY. The standing rule against inferring data from prose
 * exists because silent inference produced wrong data that nobody could see. Every match here
 * carries the EVIDENCE that produced it — the phrase it matched on — and the editor shows it, so
 * the author is confirming a reading rather than trusting a guess.
 *
 * ⚠ NO MATCH IS AN ANSWER. A trait that matches nothing returns nothing, and the author picks
 * from the list as before. Guessing the nearest rule is how a creature ends up priced by
 * something it does not do.
 *
 * ⚠ THE OUTPUT IS ALWAYS ONE OF THE 58. This cannot invent a multiplier — it names a rule, and
 * the rule carries the number. The coverage gate (`check:traits`) still applies to whatever it
 * produces.
 *
 * ORDER MATTERS. The table is scanned top-down and the FIRST match wins, so the specific sits
 * above the general: "the first attack each round has disadvantage" must be read before "attack
 * rolls against it have disadvantage", or every targeted-disadvantage trait prices as the blanket
 * one.
 */
import { traitRule, type TraitRule } from "./compactImport";

export type TraitMatch = {
  /** The calibrated rule's exact label. */
  label: string;
  rule: TraitRule;
  /** The phrase that produced the match, shown to the author. */
  evidence: string;
};

type Matcher = {
  label: string;
  /** Returns the matched phrase, or null. Receives lowercased name and text. */
  test: (name: string, text: string) => string | null;
};

/** Whichever of the given phrases appears first, or null. */
const any = (text: string, ...phrases: string[]): string | null => {
  for (const p of phrases) if (text.includes(p)) return p;
  return null;
};

/** All phrases must appear; the report names them together. */
const all = (text: string, ...phrases: string[]): string | null =>
  phrases.every(p => text.includes(p)) ? phrases.join(" + ") : null;

/**
 * ⚠ HAVING A RESISTANCE AND BEATING ONE ARE OPPOSITE FACTS, and the word is the same.
 *
 * The Pale Drifter's Soul-Touched says its *"attacks are magical and overcome resistance to
 * nonmagical damage"* — that is OFFENCE, a note about what its attacks get through. It matched
 * "resistan" + "nonmagical" and priced the Drifter as though IT were resistant, which is the
 * defence of a creature it is attacking. A trait that beats resistance must never read as one.
 */
const beatsResistance = (t: string): boolean =>
  /(overcom|ignor|bypass|penetrat)\w*\s+(the\s+)?resistance/.test(t)
  || /count as magical|are magical/.test(t) && t.includes("resistan");

/**
 * "reduce … by N" — but ONLY when it is DAMAGE being reduced.
 *
 * ⚠ SPEED IS REDUCED IN FEET AND IT IS NOT DAMAGE PREVENTION. The Velvet Host's Discourtesy
 * (*"The target's speed is reduced by 10 ft."*) and the Hollow Warden's Bar the Way (*"its
 * remaining speed is reduced by 10 ft."*) both priced as "Fixed prevention - 12/round", x1.232313
 * of effective HP, for slowing somebody down. The old test was `reduce\w*[^.]{0,40}by 1[0-4]` and
 * asked nothing about what was being reduced.
 *
 * Clause-scoped, because the match must not reach across a full stop — the Grief Colossus's Body
 * Between goes on to say it *"takes 6 psychic damage that cannot be reduced"*, and a matcher that
 * reads across sentences picks that up as a second prevention.
 */
const damageReducedBy = (text: string, lo: number, hi: number): string | null => {
  for (const m of text.matchAll(/[^.]*\breduc\w*[^.]*/g)) {
    const clause = m[0];
    const by = clause.match(/\bby (\d+)\b/);
    if (!by) continue;
    const n = Number(by[1]);
    if (n < lo || n > hi) continue;
    if (!/\bdamage\b/.test(clause)) continue;
    if (/\bspeed\b|\bft\b|\bfeet\b/.test(clause)) continue;
    return `damage reduced by ${n}`;
  }
  return null;
};

const MATCHERS: Matcher[] = [
  // ── Named outright ──────────────────────────────────────────────────────────
  { label: "Legendary Resistance - 3 uses",
    test: (n, t) => /legendary resistance/.test(n + t) && /3\/day|three times|\(3\)/.test(n + t) ? "legendary resistance, 3/day" : null },
  { label: "Legendary Resistance - 1 use",
    test: (n, t) => /legendary resistance/.test(n + t) ? "legendary resistance" : null },
  { label: "Magic Resistance",
    test: (n, t) => all(t, "advantage on saving throws against spells")
      ?? (/magic resistance/.test(n) ? "magic resistance" : null) },
  { label: "Evasion-like",
    test: (n, t) => (/\bevasion\b/.test(n + t) ? "evasion" : null)
      ?? all(t, "dexterity saving throw", "instead takes no damage") },

  // ── Resistance and immunity ─────────────────────────────────────────────────
  // Specific shapes before the blanket "resistance to" ones.
  /**
   * ⚠ THE TELEGRAPH IS THE RULE, NOT THE RESISTANCE HALF. This first required immunity AND
   * resistance in the same text, and so missed the trait it was written for: the Elemental
   * Mirror's Elemental Guard is immune to BOTH of its paired types and never says "resistant"
   * at all. What the workbook is pricing is the ROTATION — an immunity the party can see coming
   * and route around — so that is what this reads.
   */
  { label: "Telegraphed alternating immunity/resistance",
    test: (_n, t) => t.includes("immun")
      && any(t, "changes every turn", "active immunity", "alternat", "chooses one", "picks one",
        "active guard", "until its next turn", "each turn")
      ? "immunity that rotates each turn" : null },
  { label: "Reactive resistance to last damage type",
    test: (_n, t) => all(t, "resistan", "last damage type") ?? all(t, "resistan", "damage type it last took") },
  { label: "Nonmagical weapon resistance (campaign gear)",
    test: (_n, t) => beatsResistance(t) ? null : all(t, "resistan", "nonmagical") },
  { label: "Broad resistance below half HP",
    test: (_n, t) => t.includes("resistan") ? any(t, "below half", "half its hit point maximum or fewer", "bloodied") : null },
  { label: "Resistance - ~50% of opposing damage",
    test: (_n, t) => any(t, "resistance to all damage", "resistance to bludgeoning, piercing, and slashing") },
  { label: "Resistance - ~25% of opposing damage",
    test: (_n, t) => beatsResistance(t) ? null
      : (t.includes("resistance to") ? "resistance to (one damage type)" : null) },
  { label: "Limited spell immunity",
    test: (_n, t) => all(t, "immune", "spells of") },
  { label: "Condition immunity",
    test: (_n, t) => /immune to (the )?(charmed|frightened|poisoned|paralyzed|stunned|prone|grappled|restrained)/.test(t)
      ? "immune to a condition" : null },

  // ── Healing and returning ───────────────────────────────────────────────────
  { label: "Phase restore - 50% max HP",
    test: (_n, t) => any(t, "returns to half its hit point maximum", "returns at half") },
  { label: "Phase restore - 25% max HP",
    test: (_n, t) => any(t, "returns to a quarter", "returns at a quarter") },
  { label: "Regeneration 15/round",
    test: (_n, t) => /regains (1[4-9]|2\d) \(/.test(t) || /regains (1[4-9]|2\d) hit points/.test(t) ? "regains ~15/round" : null },
  { label: "Regeneration 10/round",
    test: (_n, t) => /regains (9|1[0-3]) \(/.test(t) || /regains (9|1[0-3]) hit points/.test(t) ? "regains ~10/round" : null },
  { label: "Regeneration 5/round",
    test: (_n, t) => /regains \d+ (\(|hit points)/.test(t) && t.includes("start of") ? "regains N at the start of its turn" : null },
  { label: "Conditional regeneration with shutoff",
    test: (_n, t) => all(t, "regain", "doesn't work") ?? all(t, "regain", "if it took") },
  { label: "Temporary HP",
    test: (_n, t) => any(t, "temporary hit points") },
  { label: "Rejuvenation after the encounter",
    test: (_n, t) => any(t, "rejuvenat", "returns to life", "reforms") },
  { label: "Relentless - drop to 1 HP once",
    test: (_n, t) => any(t, "drops to 1 hit point instead", "1 hit point instead", "reduced to 1 hit point instead") },

  // ── Making itself harder to hit ─────────────────────────────────────────────
  /**
   * ⚠ "ONCE PER ROUND" IS THE SAME RULE AS "THE FIRST ATTACK", written from the other end.
   *
   * This wanted the words "first attack", so it could not read the Shardbound's reaction —
   * *"it can destroy one visible stake within 30 ft. to impose disadvantage on that attack. Once
   * per round."* Christopher, 2026-08-31: *"the shardbound's defense is the reaction that it can
   * impose disadvantage on a attacker once per turn."* A reaction usable once a round IS the first
   * attack each round, and the workbook prices it at exactly the multiplier that creature already
   * carried.
   *
   * ⚠ THE FREQUENCY CLAUSE IS REQUIRED, and it is what keeps this off the Demonic Reaver. Shifting
   * Outline gives disadvantage with no limit at all, which is the CONTINUING rule below, worth
   * nearly three times as much. Reading a permanent defence as a once-a-round one would be the
   * Darkmane error again with the sign the other way.
   */
  { label: "First attack each round at disadvantage",
    test: (_n, t) => /(first|1st) (attack|opportunity attack)[^.]{0,60}disadvantage/.test(t)
      ? "first attack each round at disadvantage"
      : (/\bdisadvantage\b/.test(t) && /once per (round|turn)/.test(t) ? "disadvantage, once per round" : null) },
  { label: "All attacks at disadvantage - 1 round",
    test: (_n, t) => /attack rolls against (it|the|him|her)[^.]{0,40}disadvantage/.test(t) ? "attack rolls against it have disadvantage" : null },
  { label: "Three attack-decoy images",
    test: (_n, t) => any(t, "mirror image", "duplicates of itself", "illusory duplicates") },
  { label: "Half cover vs ranged attacks",
    test: (_n, t) => any(t, "half cover") },
  /**
   * ⚠ CONSTANT OBSCUREMENT IS NOT THE SAME RULE AS OBSCUREMENT THAT LAPSES, and reading them alike
   * under-priced the Darkmare for the life of the campaign.
   *
   * The calibrated concealment row is literally *"Concealment until first attack hits each
   * round"* — a defence that BUYS ONE ATTACK and then stops. The Darkmane is one-way magical
   * obscurement the creature simply stands inside; nothing about it ends on a hit, so every attack
   * all fight is made at disadvantage. Christopher, 2026-08-31: *"Persistent one-way obscurement
   * should be priced as a continuing attack-roll defense, not a 'first incoming attack only'
   * effect."* The bundled library's own note had said "permanent" while naming the lapsing rule.
   *
   * So the CONTINUING form reads as `attack_suppression`, which is the family for a defence that
   * keeps working. ⚠ IT IS STILL A FLOOR: the workbook calibrates that rule for ONE round
   * (+0.129416) and this never expires, so the true value is higher and no published row covers it.
   *
   * ⚠ AND THE TEST IS NARROW ON PURPOSE. Only obscurement that SAYS it is constant qualifies —
   * anything that names a lapse, a round limit or a trigger keeps the concealment rule, because
   * that is exactly what the concealment rule was calibrated on.
   */
  { label: "All attacks at disadvantage - 1 round",
    test: (n, t) => {
      const obscuring = any(t, "heavily obscured", "lightly obscured", "obscurement", "concealment");
      if (!obscuring) return null;
      const lapses = /until (it is hit|the first|hit once)|first attack|end of (its|the)|for 1 round|one round/.test(t);
      if (lapses) return null;
      const constant = /\bconstant\b|\bpermanent\b|\bat all times\b|\balways\b/.test(n + " " + t);
      return constant ? `${obscuring}, constant` : null;
    } },
  { label: "Concealment until first attack hits each round",
    test: (_n, t) => any(t, "heavily obscured", "lightly obscured", "obscurement", "concealment") },
  { label: "Shield-like +5 AC - 2 rounds",
    test: (_n, t) => /\+5 (bonus )?to ac|ac increases by 5/.test(t) && /2 rounds|two rounds/.test(t) ? "+5 AC for 2 rounds" : null },
  { label: "Shield-like +5 AC - 1 round",
    test: (_n, t) => /\+5 (bonus )?to ac|ac increases by 5/.test(t) ? "+5 AC" : null },
  { label: "Parry / reaction AC",
    test: (n, t) => (/parry/.test(n + t) ? "parry" : null) ?? all(t, "reaction", "to ac") },
  { label: "Untargetable / unreachable windows",
    test: (_n, t) => any(t, "cannot be targeted", "can't be targeted", "cannot be seen or targeted") },

  // ── Taking less from each hit ───────────────────────────────────────────────
  /**
   * ⚠ CLAUSE-SCOPED, AND WIDE ENOUGH FOR A REAL SENTENCE. Two lessons in one line. The window was
   * 20 characters, which missed the Grief Colossus's *"reduce the triggering damage by 12"* — the
   * exact trait it was written for. And the match must not cross a full stop: Body Between goes
   * on to say the Colossus *"takes 6 psychic damage that cannot be reduced"*, and a matcher that
   * reads across sentences picks that up as an 8/round prevention.
   */
  { label: "Fixed prevention - 12/round",
    test: (_n, t) => damageReducedBy(t, 10, 14) },
  { label: "Fixed prevention - 8/round",
    test: (_n, t) => damageReducedBy(t, 6, 9) },
  { label: "Flat DR 5 per damaging hit [volatile]",
    test: (_n, t) => /reduced by 5|reduce[sd]? .{0,24}by 5\b/.test(t) && t.includes("each") ? "each hit reduced by 5" : null },
  { label: "Flat DR 3 per damaging hit [volatile]",
    test: (_n, t) => /reduced by 3|reduce[sd]? .{0,24}by 3\b/.test(t) && t.includes("each") ? "each hit reduced by 3" : null },
  { label: "Once-per-round damage halving",
    test: (_n, t) => all(t, "reaction", "half the damage") ?? all(t, "reaction", "halve") },
  { label: "Damage threshold",
    test: (_n, t) => any(t, "damage threshold") },
  { label: "Damage cap - 40% max HP/round [volatile]",
    test: (_n, t) => any(t, "cannot take more than", "can't take more than") },
  { label: "Damage absorption / healing conversion",
    test: (_n, t) => all(t, "absorb") ?? all(t, "instead regains", "damage") },
  { label: "Damage transfer / redirection",
    test: (_n, t) => any(t, "must target", "instead targets", "redirect") },
  { label: "Spell reflection / turning",
    test: (_n, t) => any(t, "reflect", "turns the spell back") },
  { label: "Shared HP / linked bodies",
    test: (_n, t) => any(t, "damage is shared", "share hit points", "linked") },
  { label: "Multiple forms / replacement body",
    test: (_n, t) => any(t, "second form", "new body", "changes form") },
  { label: "Possession / body replacement",
    test: (_n, t) => any(t, "possess") },
  { label: "Save reroll / inspiration",
    test: (_n, t) => all(t, "reroll", "saving throw") ?? all(t, "re-roll", "saving throw") },
  { label: "Lair-action defense",
    test: (_n, t) => any(t, "lair action") },
];

/**
 * Read one authored trait and name the calibrated rule it is, if any.
 *
 * Returns null when nothing matches. That is the correct answer for a trait the workbook does not
 * price and for a trait this table does not recognise, and the two are indistinguishable from
 * here — which is why the caller offers the full list rather than treating null as "no defence".
 */
export function classifyTrait(name: string | undefined, text: string | undefined): TraitMatch | null {
  const n = (name ?? "").toLowerCase();
  const t = (text ?? "").toLowerCase();
  if (!n && !t) return null;
  for (const m of MATCHERS) {
    const evidence = m.test(n, t);
    if (!evidence) continue;
    const rule = traitRule(m.label);
    // A matcher naming a rule the bundle does not carry is a bug in this table, not a match.
    if (!rule) continue;
    return { label: m.label, rule, evidence };
  }
  return null;
}

/**
 * Read everything on a creature that can carry a defence, keeping the first match per stack group.
 *
 * ⚠ REACTIONS COUNT, AND MISSING THEM IS NOT HYPOTHETICAL. The Grief Colossus's Body Between —
 * *"reduce the triggering damage by 12"*, the workbook's `Fixed prevention - 12/round` exactly —
 * is authored as a REACTION. Reading only `traits` never saw the one line that priced it.
 *
 * ⚠ ACTIONS ARE NOT READ, AND THAT IS DELIBERATE. An action's text says what the creature does TO
 * the party, not what protects it, and reading them produced exactly the damage a confident wrong
 * answer does: the Blackbough Reeve's Spoiling Cut — which takes 5 off what its VICTIM deals to
 * everyone else — read as "Flat DR 5 per damaging hit", x1.751576 on the Reeve's own effective
 * HP. Reactions stay, because a reaction genuinely can be a defence and Body Between is one.
 * Anything defensive that is authored as an Action needs the dropdown.
 *
 * ⚠ ONE PER STACK GROUP. Two entries that resolve to the same group are the same effect wearing
 * two names, and applying both is the double-count the stack groups exist to prevent.
 */
export function classifyTraits(
  source:
    | ReadonlyArray<{ name?: string; text?: string }>
    | { traits?: ReadonlyArray<{ name?: string; text?: string }>;
        reactions?: ReadonlyArray<{ name?: string; text?: string }> },
): Array<TraitMatch & { traitName: string; from: "trait" | "reaction" }> {
  type Row = { name?: string; text?: string };
  const asCreature = Array.isArray(source)
    ? { traits: source as ReadonlyArray<Row>, reactions: [] as ReadonlyArray<Row> }
    : source as { traits?: ReadonlyArray<Row>; reactions?: ReadonlyArray<Row> };
  const rows: Array<Row & { from: "trait" | "reaction" }> = [
    ...(asCreature.traits ?? []).map(t => ({ ...t, from: "trait" as const })),
    ...(asCreature.reactions ?? []).map(t => ({ ...t, from: "reaction" as const })),
  ];

  const out: Array<TraitMatch & { traitName: string; from: "trait" | "reaction" }> = [];
  const claimed = new Set<string>();
  for (const row of rows) {
    const match = classifyTrait(row.name, row.text);
    if (!match) continue;
    const group = match.rule.stack_group ?? match.label;
    if (claimed.has(group)) continue;
    claimed.add(group);
    out.push({ ...match, traitName: row.name ?? match.label, from: row.from });
  }
  return out;
}
