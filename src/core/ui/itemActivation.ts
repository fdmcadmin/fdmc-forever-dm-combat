/**
 * WHAT USING AN ITEM COSTS — and whether the item says so.
 *
 * Christopher: *"what about items with a charge cost, something like the Ashwood Brigandine, the
 * Repulsion Shield, and then there is bonus action charge items like the Gloamstep Shard and
 * Hollow Lantern"*, then: *"do a full equipment library sweep to make sure the items use the
 * action they describe."*
 *
 * ── ⚠ TWO CURRENCIES, AND THE APP ONLY EVER TRACKED ONE ─────────────────────────────────────
 *
 * A magic item can cost an ECONOMY slot and a CHARGE, and they are independent:
 *
 *   Repulsion Shield     Reaction + 1 charge of 4      "you can take a Reaction to expend 1 of
 *                                                       the shield's charges"
 *   Ashwood Brigandine   Reaction + 1 charge of 1
 *   Gloamstep Shard      Bonus Action + 1 charge of 1
 *   Voidtempered Blade   Action (it is a +1 longsword), no charge
 *   Frostward Periapt    nothing — it is worn
 *
 * `EquipmentItem` carried `charges` and no activation, so the adapters guessed by SHAPE:
 * `itemToAttackAction` hard-coded an Action, `itemToAction` charged nothing. Every reaction item
 * in the library therefore cost a full Action, and every bonus-action item cost nothing.
 *
 * ── WHAT THIS FILE READS, AND WHAT IT REFUSES TO WRITE ──────────────────────────────────────
 *
 * The sweep reads an item's own text and says what it CLAIMS to cost, so a mismatch with the
 * authored field is visible. It never sets the field: an item's rules text is prose, and tagging
 * from prose is the rule this codebase keeps having to un-break. The reading is offered — the
 * author confirms it, exactly as the damage-type reader works.
 */

export type ItemActivation = "action" | "bonus" | "reaction" | "free";

export const ITEM_ACTIVATION_LABEL: Record<ItemActivation, string> = {
  action: "Action",
  bonus: "Bonus Action",
  reaction: "Reaction",
  free: "No action",
};

/** The economy this activation spends. `free` spends nothing — a worn item, or a passive rider. */
export function economyCostFor(activation: ItemActivation): Array<"main" | "bonus" | "reaction"> {
  switch (activation) {
    case "action": return ["main"];
    case "bonus": return ["bonus"];
    case "reaction": return ["reaction"];
    case "free": return [];
  }
}

const ACTIVATION_PATTERNS: Array<[ItemActivation, RegExp]> = [
  ["reaction", /\b(?:use|take|spend)s?\s+(?:your|a|an|its|their)\s+reaction\b/],
  ["reaction", /\bas\s+(?:a|an|your)\s+reaction\b/],
  ["reaction", /\breaction:\s/],
  ["bonus", /\bbonus action\b/],
  ["action", /\bmagic action\b/],
  ["action", /\b(?:as|use|take|takes|requires?|costs?)\s+(?:an?\s+)?action\b/],
  ["action", /\baction:\s/],
];

/**
 * What the item's own text says it costs, or undefined when it does not say.
 *
 * ⚠ EARLIEST WINS — NOT A FIXED PRECEDENCE, AND THE FIRST VERSION GOT THIS WRONG. It checked
 * reaction, then bonus, then action, in that order, on the reasonable-sounding grounds that a
 * reaction item usually also contains the word "action". Run against the real library it misread
 * three items in the first twenty:
 *
 *   Drift Globe      "As a Magic action, command the globe [...] or as a Bonus Action, ..."
 *                    → read Bonus Action, because a later clause beat the primary use
 *   Step Stabilizer  "you can take the Disengage action [...]"
 *   Quickstep        same shape
 *
 * An item states its cost where it states its use, and any second mention is an alternative or a
 * different mode. The FIRST one in the text is the one the item leads with, so position decides
 * rather than a preference this file invented.
 */
export function readActivationFromText(text: string | undefined): ItemActivation | undefined {
  return readActivation(text).activation;
}

/**
 * The full reading: what it leads with, and whether it names more than one.
 *
 * ⚠ AN ITEM WITH TWO MODES CANNOT BE ANSWERED BY ONE FIELD, and picking the first silently is
 * how a wrong cost ships. The Drift Globe is the case:
 *
 *   "As a Magic action, command the globe to shed bright light [...] Once per long rest, as a
 *    Bonus Action, the globe can flare for 1 minute"
 *
 * The at-will light is an Action; the CHARGED flare — the thing the charge pool is actually for —
 * is a Bonus Action. Earliest-wins reads it as an Action, which is true of the item and false of
 * the charge. So this says `ambiguous` and the sweep asks rather than answers.
 */
export function readActivation(text: string | undefined): {
  activation: ItemActivation | undefined;
  /** Every distinct activation the text names, in the order they appear. */
  named: ItemActivation[];
  ambiguous: boolean;
} {
  const t = (text ?? "").toLowerCase();
  if (!t.trim()) return { activation: undefined, named: [], ambiguous: false };
  const hits: Array<{ at: number; activation: ItemActivation }> = [];
  for (const [activation, re] of ACTIVATION_PATTERNS) {
    const m = t.match(re);
    if (m && m.index !== undefined) hits.push({ at: m.index, activation });
  }
  hits.sort((a, b) => a.at - b.at);
  const named: ItemActivation[] = [];
  for (const h of hits) if (!named.includes(h.activation)) named.push(h.activation);
  return { activation: named[0], named, ambiguous: named.length > 1 };
}

/**
 * Is this item something a player ACTIVATES, as opposed to something they wear, carry or swing?
 *
 * ⚠ A WEAPON IS NOT AN ACTIVATED ITEM. Its cost is the attack, which the main tab already spends
 * — asking a Longsword what its activation is would put every weapon in the library on a list of
 * things to fix, and charging it again on the equipment row would double-bill the swing. Anything
 * with a to-hit is out.
 *
 * What is left is the real question: a charge pool, an effect it fires, or dice with no to-hit —
 * a Drift Globe, a Repulsion Shield, a potion. A Frostward Periapt costs nothing because there is
 * nothing to spend.
 */
export function isUsableItem(item: {
  isUsable?: boolean; attack?: string; charges?: unknown; damage?: string; saveDc?: string; effect?: unknown;
}): boolean {
  if (item.attack) return false;
  return Boolean(item.isUsable || item.charges || item.effect || item.damage || item.saveDc);
}

export type ActivationFinding = {
  id: string;
  name: string;
  /** What the item is authored to cost, or undefined when it has never been said. */
  authored: ItemActivation | undefined;
  /** What its own text claims. */
  reads: ItemActivation | undefined;
  /**
   * `mismatch`   the text states a cost the field does not carry
   * `ambiguous`  the text names MORE THAN ONE, so one field cannot answer it — the author must
   * `unstated`   neither the text nor the field says anything
   */
  kind: "mismatch" | "ambiguous" | "unstated";
  /** Every activation the text names, when it names more than one. */
  named?: ItemActivation[];
  /** Does it also spend a charge? Shown because the two costs are independent. */
  charges?: number;
  evidence: string;
};

/** Sweep a library: which items do not use the action they describe. */
export function sweepItemActivation(items: readonly {
  id: string; name: string; description?: string; mechanicsText?: string;
  activation?: ItemActivation; isUsable?: boolean; charges?: { max: number };
  damage?: string; saveDc?: string; effect?: unknown;
}[]): ActivationFinding[] {
  const out: ActivationFinding[] = [];
  for (const item of items) {
    if (!isUsableItem(item)) continue;                 // worn or carried — nothing to spend
    const text = [item.mechanicsText, item.description].filter(Boolean).join(" ");
    const { activation: reads, named, ambiguous } = readActivation(text);
    const authored = item.activation;
    if (ambiguous && !authored) {
      out.push({ id: item.id, name: item.name, authored, reads, named, kind: "ambiguous", charges: item.charges?.max, evidence: text.slice(0, 200) });
    } else if (reads && authored && reads !== authored) {
      out.push({ id: item.id, name: item.name, authored, reads, kind: "mismatch", charges: item.charges?.max, evidence: text.slice(0, 140) });
    } else if (reads && !authored) {
      out.push({ id: item.id, name: item.name, authored, reads, kind: "mismatch", charges: item.charges?.max, evidence: text.slice(0, 140) });
    } else if (!reads && !authored) {
      out.push({ id: item.id, name: item.name, authored, reads, kind: "unstated", charges: item.charges?.max, evidence: text.slice(0, 140) });
    }
  }
  return out;
}
