/**
 * DOES AN ACTION THAT USES A REACTION ACTUALLY SPEND ONE?
 *
 * Christopher: *"let check to make sure items that use reaction are tagged reaction and use the
 * reaction."*
 *
 * ⚠ TWO ROWS IN HIS OWN LIBRARY SAY REACTION AND COST AN ACTION. The Displaced Ward Brooch and
 * the Ashwood Brigandine both sit in the MAIN tab with `economyCost: ["main"]` and
 * `actionKind: "attack"`, while their own text reads *"you can use your Reaction to reduce that
 * damage by 1d6."* Clicking one spends the turn's Action on something that should have cost
 * nothing but the Reaction — and the action economy tracker, which is doing exactly what it was
 * told, records it as such.
 *
 * ── ⚠ WHAT THIS DELIBERATELY DOES NOT FLAG ──────────────────────────────────────────────────
 *
 * The same phrase appears all over a sheet without being a mistake, and a check that shouts at
 * all of it is a check nobody reads:
 *
 *   REFERENCE ROWS      the equipment tab's copy of the Brooch describes the item. It is not the
 *                       usable action, carries no `economyCost` at all, and is right as it is.
 *   FEATS THAT GRANT    "gain Shield Bash and the Interpose Shield reaction" describes a separate
 *                       action the feat unlocks. The feat is not itself a reaction.
 *   SOMEBODY ELSE'S     Faelar's "He moves and uses his Reaction on his own" is about the
 *                       companion's economy, not this row's.
 *
 * The discriminator is `economyCost`: only a row that actually SPENDS something is claiming to be
 * a live action, and only those are audited. A row with no cost is a description.
 *
 * ⚠ AND IT ONLY READS FIRST-PERSON USE. "use your Reaction", "take a Reaction", "as a Reaction" —
 * the phrasings that mean THIS row costs one. "grants ... reaction" and "his Reaction" do not
 * match, which is what keeps the three cases above quiet.
 */

/** The phrasings that mean this row itself spends a Reaction. */
const USES_A_REACTION = [
  /\buse (?:your|a|an|its|their) reaction\b/i,
  /\btake (?:a|an|your) reaction\b/i,
  /\bas (?:a|an|your) reaction\b/i,
  /\bspend (?:a|an|your) reaction\b/i,
  /\breaction:\s/i,
];

type AuditableAction = {
  id?: string;
  label?: string;
  description?: string;
  actionKind?: string;
  economyCost?: string[];
  metadata?: { details?: string; cost?: string };
};
type AuditableActor = { name?: string; actions?: AuditableAction[]; tabs?: Record<string, AuditableAction[] | undefined> };

export type ReactionEconomyFinding = {
  actor: string;
  tab: string;
  label: string;
  /** What it costs today. */
  costs: string[];
  /** The phrase that says it should cost a Reaction. */
  evidence: string;
};

/** Every phrase on a row that could say "this costs a Reaction". Fields only, never a guess. */
function textOf(action: AuditableAction): string {
  return [action.description, action.metadata?.details, action.metadata?.cost].filter(Boolean).join(" ");
}

function saysItUsesAReaction(text: string): string | undefined {
  for (const re of USES_A_REACTION) {
    const m = text.match(re);
    if (m) {
      // A little of the surrounding sentence, so the finding shows its working.
      const at = Math.max(0, (m.index ?? 0) - 30);
      return text.slice(at, (m.index ?? 0) + m[0].length + 30).trim();
    }
  }
  return undefined;
}

/**
 * Rows that spend an Action (or a Bonus Action) while their own text says they use a Reaction.
 *
 * @param actors the library as the app holds it
 */
export function auditReactionEconomy(actors: readonly AuditableActor[]): ReactionEconomyFinding[] {
  const findings: ReactionEconomyFinding[] = [];
  for (const actor of actors) {
    const who = actor.name ?? "unnamed";
    const groups: Array<[string, AuditableAction[]]> = [
      ["actions", actor.actions ?? []],
      ...Object.entries(actor.tabs ?? {}).map(([tab, list]) => [tab, Array.isArray(list) ? list : []] as [string, AuditableAction[]]),
    ];
    for (const [tab, list] of groups) {
      for (const action of list) {
        const costs = action.economyCost ?? [];
        // No cost = a description, not a live action. See the header.
        if (costs.length === 0) continue;
        if (costs.includes("reaction")) continue;
        const evidence = saysItUsesAReaction(textOf(action));
        if (!evidence) continue;
        findings.push({ actor: who, tab, label: action.label ?? "unnamed action", costs: [...costs], evidence });
      }
    }
  }
  return findings;
}
