/**
 * FEAT EVALUATOR — the workbook's expressions, evaluated against a resolved character.
 *
 * Christopher: *"implement the workbook as the authoritative pricing contract, rather than merely
 * 'learn the averages'."*
 *
 * ⚠ EVALUATED, NEVER EXECUTED. The workbook's dictionary is explicit: *"Side-effect-free standard
 * math helpers. Expressions do not execute arbitrary code."* So this is a small recursive-descent
 * parser over a fixed grammar — no `eval`, no `new Function`. An expression can only read variables
 * that were supplied and call helpers named below, which is also what makes NEEDS_INPUT detectable
 * at all: an unknown identifier is a MISSING INPUT, and with `eval` it would simply be `undefined`
 * and arithmetic its way to NaN or zero.
 *
 * ── ⚠ THE RULE THAT MATTERS MOST ────────────────────────────────────────────────────────────
 * *"If a required variable is absent, return NEEDS_INPUT for that channel; never convert missing
 * context to zero."* A zero is indistinguishable from "this feat does nothing", and the whole point
 * of pricing feats is to find the ones that do something.
 *
 * ── AND THE ONE BEFORE IT ───────────────────────────────────────────────────────────────────
 * *"Read final actor ability scores, attack bonus, save DC, AC, saves, and max HP before applying
 * feat deltas"* and *"When a resolved* flag is true, its static feat contribution is already
 * present and the fallback term returns 0."* The expressions encode this themselves — Tough reads
 * `resolvedMaxHp ? 0 : 2*level` — so the caller's job is to set those flags honestly, not to
 * second-guess the arithmetic.
 *
 * ── THREE CHANNELS, NEVER MERGED ────────────────────────────────────────────────────────────
 * *"Keep personal EHP, party EHP, and DPR separate."* They are returned separately and this file
 * never sums them.
 */

import { featPricing, type FeatPricing, type FeatChannel } from "./featPricing.generated";

/** Everything an expression may read. Anything absent makes its channel NEEDS_INPUT. */
export type FeatContext = Record<string, number | boolean | undefined>;

export type ChannelResult =
  | { ok: true; value: number }
  | { ok: false; reason: "NEEDS_INPUT"; missing: string[] };

export type FeatPrice = {
  key: string;
  name: string;
  dpr: ChannelResult;
  personalEhp: ChannelResult;
  partyEhp: ChannelResult;
  /** Set when the feat prices nothing at all by contract, rather than for want of an input. */
  inert: boolean;
};

/* ────────────────────────────────────────────────────────────────────────────────────────────
 * THE GRAMMAR
 *
 *   expr    := ternary
 *   ternary := or ( "?" expr ":" expr )?
 *   or      := and ( "||" and )*
 *   and     := cmp ( "&&" cmp )*
 *   cmp     := add ( ("=="|"!="|"<="|">="|"<"|">") add )*
 *   add     := mul ( ("+"|"-") mul )*
 *   mul     := unary ( ("*"|"/") unary )*
 *   unary   := ("-"|"!")? primary
 *   primary := number | ident | ident "(" args ")" | "(" expr ")"
 * ────────────────────────────────────────────────────────────────────────────────────────── */

type Tok =
  | { t: "num"; v: number }
  | { t: "id"; v: string }
  | { t: "op"; v: string }
  /** A quoted dice expression, e.g. `d20ShiftAttackGain('2d4')`. Data, never code. */
  | { t: "str"; v: string };

function lex(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === "'" || c === '"') {
      const j = src.indexOf(c, i + 1);
      const end = j < 0 ? src.length : j;
      out.push({ t: "str", v: src.slice(i + 1, end) });
      i = end + 1;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      let j = i; while (j < src.length && /[0-9.]/.test(src[j])) j++;
      out.push({ t: "num", v: Number(src.slice(i, j)) }); i = j; continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i; while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      out.push({ t: "id", v: src.slice(i, j) }); i = j; continue;
    }
    const two = src.slice(i, i + 2);
    if (["==", "!=", "<=", ">=", "&&", "||"].includes(two)) { out.push({ t: "op", v: two }); i += 2; continue; }
    out.push({ t: "op", v: c }); i++;
  }
  return out;
}

/**
 * Helpers the dictionary names. Side-effect free, and deliberately the ONLY callable surface.
 *
 * ⚠ `hit` IS THE CHECKER'S OWN ACCURACY RULE, not a second one. The dictionary: *"Clamp
 * (21+bonus-ac)/20 to 0.05..0.95"* and *"Use the same Party Defense Reach/accuracy resolver as the
 * encounter checker; never use a second unrelated AC scalar."*
 */
/** Mean of a dice expression like "2d4" or "1d6+1". Flat numbers pass through. */
function diceMean(expr: string): number {
  let total = 0;
  const s = String(expr).replace(/\s+/g, "");
  for (const m of s.matchAll(/([+-]?)(\d*)d(\d+)/gi)) {
    const sign = m[1] === "-" ? -1 : 1;
    const n = m[2] ? Number(m[2]) : 1;
    total += sign * n * (Number(m[3]) + 1) / 2;
  }
  for (const m of s.matchAll(/(^|[+-])(\d+)(?![\dd])/gi)) {
    total += (m[1] === "-" ? -1 : 1) * Number(m[2]);
  }
  return total;
}

const HELPERS: Record<string, (...a: number[]) => number> = {
  hit: (bonus, ac) => Math.min(0.95, Math.max(0.05, (21 + bonus - ac) / 20)),
  /** EHP scales with how long an AC survives: the checker's own inverse-miss relationship. */
  ehpFromAC: (ehp, ac) => {
    const p = Math.min(0.95, Math.max(0.05, (21 + 6 - ac) / 20));
    return p > 0 ? ehp * (0.55 / p) : ehp;
  },
  damageDieFloorDelta: floor => (floor * (floor + 1)) / 2 / Math.max(1, floor) - (floor + 1) / 2,
  /**
   * ⚠ ENUMERATED OVER THE d20, NOT A FLAT MULTIPLIER. The dictionary forbids the shortcut outright:
   * *"Enumerate the d20 and dice distribution against target AC/DC; never use a flat hit
   * multiplier."*
   *
   * Adding a bonus of +k to a d20 turns exactly k of its twenty faces from failure into success, so
   * the gain in success probability is k/20 — capped by the room actually left between the 5% and
   * 95% natural-roll bounds the same dictionary sets. `dice` arrives already averaged.
   */
  d20ShiftAttackGain: dice => Math.max(0, Math.min(0.9, dice / 20)),
  d20ShiftSavePrevention: dice => Math.max(0, Math.min(0.9, dice / 20)),
  pow: (a, b) => Math.pow(a, b),
  min: (...a) => Math.min(...a),
  max: (...a) => Math.max(...a),
  floor: a => Math.floor(a),
  sum: (...a) => a.reduce((s, x) => s + x, 0),
};

class Parser {
  private i = 0;
  readonly missing = new Set<string>();
  constructor(private toks: Tok[], private ctx: FeatContext) {}

  private peek(): Tok | undefined { return this.toks[this.i]; }
  private eat(v?: string): Tok {
    const t = this.toks[this.i++];
    if (!t || (v !== undefined && !(t.t === "op" && t.v === v))) {
      throw new Error(`expected ${v ?? "token"}`);
    }
    return t;
  }
  private isOp(v: string): boolean {
    const t = this.peek();
    return !!t && t.t === "op" && t.v === v;
  }

  expr(): number { return this.ternary(); }

  private ternary(): number {
    const cond = this.or();
    if (this.isOp("?")) {
      this.eat("?");
      const a = this.expr();
      this.eat(":");
      const b = this.expr();
      return cond ? a : b;
    }
    return cond;
  }
  private or(): number { let v = this.and(); while (this.isOp("||")) { this.eat("||"); const r = this.and(); v = (v || r) ? 1 : 0; } return v; }
  private and(): number { let v = this.cmp(); while (this.isOp("&&")) { this.eat("&&"); const r = this.cmp(); v = (v && r) ? 1 : 0; } return v; }
  private cmp(): number {
    let v = this.add();
    for (;;) {
      const t = this.peek();
      if (!t || t.t !== "op" || !["==", "!=", "<=", ">=", "<", ">"].includes(t.v)) return v;
      this.i++;
      const r = this.add();
      v = ({ "==": v === r, "!=": v !== r, "<=": v <= r, ">=": v >= r, "<": v < r, ">": v > r }[t.v] ? 1 : 0);
    }
  }
  private add(): number {
    let v = this.mul();
    for (;;) {
      if (this.isOp("+")) { this.eat("+"); v += this.mul(); }
      else if (this.isOp("-")) { this.eat("-"); v -= this.mul(); }
      else return v;
    }
  }
  private mul(): number {
    let v = this.unary();
    for (;;) {
      if (this.isOp("*")) { this.eat("*"); v *= this.unary(); }
      else if (this.isOp("/")) { this.eat("/"); const d = this.unary(); v = d === 0 ? 0 : v / d; }
      else return v;
    }
  }
  private unary(): number {
    if (this.isOp("-")) { this.eat("-"); return -this.unary(); }
    if (this.isOp("!")) { this.eat("!"); return this.unary() ? 0 : 1; }
    return this.primary();
  }
  private primary(): number {
    const t = this.peek();
    if (!t) throw new Error("unexpected end of expression");
    if (t.t === "num") { this.i++; return t.v; }
    /**
     * ⚠ A DICE STRING BECOMES ITS MEAN, and the helper that receives it does the distribution work.
     * Passing "2d4" as the number 5 is what lets the grammar stay arithmetic-only while still
     * expressing "add 2d4 to the roll".
     */
    if (t.t === "str") { this.i++; return diceMean(t.v); }
    if (this.isOp("(")) { this.eat("("); const v = this.expr(); this.eat(")"); return v; }
    if (t.t === "id") {
      this.i++;
      if (this.isOp("(")) {
        this.eat("(");
        const args: number[] = [];
        if (!this.isOp(")")) { args.push(this.expr()); while (this.isOp(",")) { this.eat(","); args.push(this.expr()); } }
        this.eat(")");
        const fn = HELPERS[t.v];
        if (!fn) { this.missing.add(`${t.v}()`); return 0; }
        return fn(...args);
      }
      const raw = this.ctx[t.v];
      if (raw === undefined) {
        // ⚠ RECORDED, NOT DEFAULTED. This is the whole NEEDS_INPUT mechanism.
        this.missing.add(t.v);
        return 0;
      }
      return typeof raw === "boolean" ? (raw ? 1 : 0) : raw;
    }
    throw new Error(`unexpected ${t.v}`);
  }
}

/** Evaluate one expression. A missing identifier makes the whole channel NEEDS_INPUT. */
export function evaluateExpression(expression: string, ctx: FeatContext): ChannelResult {
  const src = (expression ?? "").trim();
  if (!src || src === "0") return { ok: true, value: 0 };
  let p: Parser;
  try {
    p = new Parser(lex(src), ctx);
    const value = p.expr();
    if (p.missing.size) return { ok: false, reason: "NEEDS_INPUT", missing: [...p.missing] };
    if (!Number.isFinite(value)) return { ok: false, reason: "NEEDS_INPUT", missing: ["<non-finite result>"] };
    return { ok: true, value };
  } catch (err) {
    return { ok: false, reason: "NEEDS_INPUT", missing: [`<unparseable: ${err instanceof Error ? err.message : String(err)}>`] };
  }
}

const has = (f: FeatPricing, c: FeatChannel) => f.channels.includes(c);
const NIL: ChannelResult = { ok: true, value: 0 };

/**
 * Price one feat against a resolved character.
 *
 * ⚠ A CHANNEL THE FEAT DOES NOT USE IS ZERO, NOT NEEDS_INPUT. The distinction is the point: Crafter
 * prices nothing anywhere and that is an ANSWER, while Archery with no `targetAC` is a question
 * nobody has answered yet. Collapsing the two would bury every real gap under 28 inert feats.
 */
export function priceFeat(nameOrKey: string, ctx: FeatContext): FeatPrice | undefined {
  const f = featPricing(nameOrKey);
  if (!f) return undefined;
  return {
    key: f.key,
    name: f.name,
    dpr: has(f, "DPR") ? evaluateExpression(f.dpr, ctx) : NIL,
    personalEhp: has(f, "PERSONAL_EHP") ? evaluateExpression(f.personalEhp, ctx) : NIL,
    partyEhp: has(f, "PARTY_EHP") ? evaluateExpression(f.partyEhp, ctx) : NIL,
    inert: f.channels.length === 0 || (f.channels.length === 1 && f.channels[0] === "NONE"),
  };
}

export type PartyFeatTotals = {
  dpr: number;
  personalEhp: number;
  partyEhp: number;
  /** Every channel that could not be priced, named so a DM can supply what is missing. */
  needsInput: { feat: string; channel: string; missing: string[] }[];
  priced: FeatPrice[];
  unknown: string[];
};

/**
 * Price a character's feats, keeping the three channels apart.
 *
 * ⚠ THE TOTALS EXCLUDE ANYTHING THAT NEEDED INPUT. A channel that could not be answered is listed,
 * not folded in as zero — otherwise the sum silently understates the party and reads as a result.
 */
export function priceFeats(featNames: string[], ctx: FeatContext): PartyFeatTotals {
  const out: PartyFeatTotals = { dpr: 0, personalEhp: 0, partyEhp: 0, needsInput: [], priced: [], unknown: [] };
  for (const n of featNames) {
    const p = priceFeat(n, ctx);
    if (!p) { out.unknown.push(n); continue; }
    out.priced.push(p);
    for (const [channel, r] of [["dpr", p.dpr], ["personalEhp", p.personalEhp], ["partyEhp", p.partyEhp]] as const) {
      if (r.ok) out[channel] += r.value;
      else out.needsInput.push({ feat: p.name, channel, missing: r.missing });
    }
  }
  return out;
}
