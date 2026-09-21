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

/**
 * ⚠ `passive` IS ITS OWN COST, NOT A FLAVOUR OF `free`.
 *
 * Christopher, 2026-09-01: *"passive should be always on, we already have this action cost."*
 * Right — `ActionEconomyKind` has carried it since the PC action economy was built, and only this
 * item vocabulary was missing it. Two words for one concept is the drift this codebase keeps
 * paying for, so they are the same list now.
 *
 * The difference is real, and it is not about slots. Both spend nothing, but `free` is something
 * you DO at no cost — a rider you choose to fire, an initiative swap taken before the first turn —
 * while `passive` is always on and never chosen. An author reading "No action" against a Speed
 * increase learns the wrong thing about their own item.
 */
export type ItemActivation = "action" | "bonus" | "reaction" | "free" | "passive";

export const ITEM_ACTIVATION_LABEL: Record<ItemActivation, string> = {
  action: "Action",
  bonus: "Bonus Action",
  reaction: "Reaction",
  free: "No action",
  passive: "Always on",
};

/** The economy this activation spends. Neither `free` nor `passive` spends a slot. */
export function economyCostFor(activation: ItemActivation): Array<"main" | "bonus" | "reaction"> {
  switch (activation) {
    case "action": return ["main"];
    case "bonus": return ["bonus"];
    case "reaction": return ["reaction"];
    case "free": return [];
    // Always on: there is nothing to spend, and nothing to choose.
    case "passive": return [];
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
  const hits: Array<{ at: number; activation: ItemActivation; text: string }> = [];
  for (const [activation, re] of ACTIVATION_PATTERNS) {
    const m = t.match(re);
    if (m && m.index !== undefined) hits.push({ at: m.index, activation, text: m[0] });
  }
  /**
   * ⚠ A REACTION SOMEONE ELSE SPENDS IS NOT THIS ITEM'S COST.
   *
   * v6's Redwake Shuttle is a rider — the bearer spends nothing but the charge — and its text ends
   * "one willing ally you can see within 30 feet may immediately use its Reaction to move up to 10 feet".
   * Read literally that is a Reaction, so the item read as costing the BEARER one, which would take a
   * Reaction off a player who never spent it. A Reaction is the bearer's when the text says YOUR reaction;
   * "its" or "their" alongside an ally or another creature in the same sentence belongs to them.
   */
  const sentenceOf = (at: number) => {
    const start = t.lastIndexOf(".", at) + 1;
    const end = t.indexOf(".", at);
    return t.slice(start, end === -1 ? t.length : end);
  };
  /**
   * ⚠ AND "YOU CAN TAKE A REACTION" IS YOURS, WHOEVER ELSE THE SENTENCE NAMES.
   *
   * The rule above was written for Redwake Shuttle and read too wide. v11's Turnstep Relay: "When a hostile
   * creature you can see within 30 feet starts its turn, you can take a Reaction to move up to half your
   * current Speed […] You move before the creature moves or takes an action." The TRIGGER names a hostile, so
   * the bearer's own Reaction was thrown out — and then the hostile's "takes an action" was read as the item's
   * cost. Christopher's publish failed on it: "Turnstep Relay is authored as Reaction but its own text says
   * Action." Three readings, each checked against the words:
   *
   *   reaction   YOURS when "you" is the one taking it ("you can take a Reaction") or it says "your Reaction"
   *   action     a creature's when a creature "takes an action" — third person is never the bearer
   *   action     a TRIGGER, not a cost, in "whenever you take the Magic action" (Gift of First Light)
   */
  const before = (at: number, span = 48) => t.slice(Math.max(0, at - span), at);
  const someoneElses = (h: { at: number; activation: ItemActivation; text: string }) => {
    const sentence = sentenceOf(h.at);
    if (h.activation === "reaction") {
      if (/\byour reaction\b/.test(sentence)) return false;
      if (/\byou\s+(?:can\s+|may\s+|must\s+)?$/.test(before(h.at, 12))) return false;
      return /\b(?:ally|allies|willing creature|another creature|that creature|the attacker|a hostile)\b/.test(sentence);
    }
    if (h.activation === "action") {
      if (/^takes\b/.test(h.text) && /\b(?:creature|target|attacker|enemy|foe|ally|hostile)\b[^.]*$/.test(before(h.at))) return true;
      if (/\b(?:whenever|when|each time)\s+you\s+take\s+(?:the|a)\s+$/.test(before(h.at, 28))) return true;
    }
    return false;
  };
  for (let i = hits.length - 1; i >= 0; i--) if (someoneElses(hits[i])) hits.splice(i, 1);

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
  isUsable?: boolean; attack?: string; charges?: unknown; damage?: string; saveDc?: string; effect?: unknown; chassis?: unknown;
}): boolean {
  // ⚠ A CHASSIS IS A WEAPON TOO. A Feywild Gift has no `attack` until its form is chosen on a character, so it
  // read as a usable item and every Gift sat on the "says nothing about what it costs" list.
  if (item.attack || item.chassis) return false;
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
  damage?: string; saveDc?: string; effect?: unknown; chassis?: unknown;
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
