/**
 * WHAT AN ACTOR CAN LEGALLY SPEND ACROSS THE FIVE-FIGHT DAY.
 *
 * The runtime authority is `broken_chain_checker_runtime_v3_3_slot_resource_budget.xlsx`,
 * sheet `Resource Conversion`. This is the availability half of it, in the workbook's own columns:
 *
 *     total usable = starting uses + recovered uses + free uses
 *     allocated offense + allocated sustain + allocated other  <=  total usable
 *
 * ⚠ THE DAY IS THE WORKBOOK'S, NOT AN ASSUMPTION. Five fights per Long Rest, five rounds per
 * fight, 25 combat rounds, and ONE Short Rest — after fight three (`Resource Conversion` row 42,
 * "This benchmark has one Short Rest after fight three"). That single rest is why a level 9
 * Fighter has two potential Action Surges and not three.
 *
 * ⚠ A RESOURCE IS RESERVED ONCE. Row 44: *"The same slot cannot become both damage and healing."*
 * A tier whose spells offer more than one kind is CONTESTED, and its uses are split across those
 * kinds rather than counted for each — the allocation can never exceed the tier's usable total.
 *
 * ⚠ THE SHARES ARE DERIVED, NEVER TYPED. The workbook marks them NEEDS INPUT and says where they
 * come from: *"Set shares from the actor's prepared combat loadout."* A spreadsheet cannot read a
 * character sheet, so it asks a human. The app can, so it does not: `slotCapabilityFromActors`
 * already resolves which uses each tier's prepared spells offer, and the share is the option split
 * at that tier. Christopher: *"why do i need to do a input it this was tested over 4096 parties"* —
 * the 4,096 run certified the BASELINE, and the loadout supplies the shares.
 *
 * ⚠ THIS FILE COUNTS AND ALLOCATES. IT DOES NOT PRICE. Marginal damage per use, usable sustain per
 * use, and the three chance-to-affect cases are the cost half and are applied where the actions
 * are scheduled — the daily total is an audit figure and, per row 45, "not a replacement for round
 * scheduling".
 */

import type { Actor } from "../types/actor";
import { slotCapabilityFromActors, type SlotUse } from "../../modules/dnd-5e/slotCapability";
import { resolveNamedResourceCost } from "../state/consumeActionResources";

/** The workbook's day model. Stated once, here, so nothing re-invents it. */
/**
 * HOW FAR A ROLE TIPS A CONTESTED TIER.
 *
 * Christopher, 2026-09-07: *"the split should be based on what role that PC is playing, but it
 * should be about a 70/30 split that way."* So a slot a Support could spend either way goes mostly
 * to sustain, and the same slot on a Striker goes mostly to damage — the character is the tie
 * break, not how many of each spell they happened to prepare.
 *
 * The lean is the bond's, authored beside its role on the template (`BondTemplate.resourceLean`).
 * A character with no bond has no lean and keeps the loadout split, which the row reports.
 */
export const CONTESTED_ROLE_MAJORITY = 0.7;

export const RESOURCE_DAY = {
  fightsPerLongRest: 5,
  roundsPerFight: 5,
  shortRestsPerLongRest: 1,
  /** The rest lands AFTER this fight — it is not spread across the day. */
  shortRestAfterFight: 3,
  combatRoundsPerLongRest: 25,
} as const;

export type LedgerKind = "sharedSlot" | "pactSlot" | "classResource" | "freeCast";

export type ResourceLean = "offense" | "sustain" | "control";

export type LedgerRow = {
  actor: string;
  /** The resource as the sheet labels it. */
  resource: string;
  kind: LedgerKind;
  /** Slot level, when the resource states one. */
  tier?: number;
  startUses: number;
  /** Per scheduled Short Rest — NOT already multiplied. */
  recoveredPerShortRest: number;
  freeUses: number;
  totalUses: number;
  /** Allocation across the three channels. Sums to `totalUses`, never more. */
  offense: number;
  sustain: number;
  other: number;
  /** True when more than one KIND of spell wants this tier — the fork the DM should see. */
  contested: boolean;
  /** What the loadout offered at this tier, which is where the shares came from. */
  options: string[];
  notes: string[];
};

export type ResourceLedger = {
  rows: LedgerRow[];
  /** Anything carrying a resource the ledger could not size, named rather than dropped. */
  needsInput: string[];
};

const SLOT_TIER = /\b(?:l|level\s*)(\d)\b/i;

function tierOf(label: string): number | undefined {
  const m = label.match(SLOT_TIER);
  const n = m ? Number(m[1]) : NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function kindOf(label: string, resourceKind: string | undefined): LedgerKind {
  if (resourceKind === "freeCast") return "freeCast";
  if (/pact/i.test(label)) return "pactSlot";
  if (resourceKind === "spellSlot") return "sharedSlot";
  return "classResource";
}

/**
 * How many uses come back at ONE scheduled Short Rest.
 *
 * `shortRestRegain` is the field the registry writes (0.8.21.1): "all" restores the pool, a number
 * restores that many, absent restores nothing. Pact slots recover their full count, which is the
 * same statement said by the sheet rather than by this code.
 */
function regainPerShortRest(startUses: number, regain: number | "all" | undefined): number {
  if (regain === "all") return startUses;
  const n = Number(regain ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function resourceLedgerFromActor(
  actor: Actor,
  opts: { shortRests?: number; lean?: ResourceLean } = {},
): ResourceLedger {
  const shortRests = Math.max(0, opts.shortRests ?? RESOURCE_DAY.shortRestsPerLongRest);
  const rows: LedgerRow[] = [];
  const needsInput: string[] = [];
  const who = actor.name ?? "(unnamed)";

  /**
   * The prepared loadout, per tier — the source the workbook names for the shares. Reading it
   * through the existing resolver keeps one answer to "what can this slot become".
   */
  const capability = slotCapabilityFromActors([actor as never]);
  const usesByLabel = new Map<string, SlotUse[]>();
  for (const r of capability?.rows ?? []) usesByLabel.set(r.label, r.uses);

  /**
   * ⚠ A CLASS RESOURCE'S SHARE COMES FROM WHAT SPENDS IT, NOT FROM A SLOT TIER.
   *
   * The first pass keyed every row on its slot level, so anything without one — Lay on Hands,
   * Channel Divinity, an Eldritch Cannon — fell into the untiered bucket and inherited the split
   * of every non-levelled spell on the sheet. Lay on Hands came out allocating 20.5 of its 25 to
   * OFFENSE, which is not a thing it can do.
   *
   * The workbook separates `Kind` for exactly this reason: its Action Surge row is offense 1 /
   * sustain 0 / other 0 because that is what THAT resource does. So the actions that actually
   * spend a resource are found first — through `metadata.resourceId`, the authored link the
   * sheets carry — and their uses are what the share is drawn from.
   */
  /**
   * ⚠ ASK THE ONE RESOLVER THAT ALREADY ANSWERS "WHAT DOES THIS ACTION SPEND".
   *
   * Matching only `metadata.resourceId` found 8 actions across the whole party, because that field
   * is authored on some sheets and not others — so nearly every class resource resolved no spender
   * and was held as "other", which is the same silence as not reading it at all.
   *
   * `resolveNamedResourceCost` is the app's single implementation of that question: authored id
   * first, then `slotCost`, then the prose scan against this actor's own pool labels. Reusing it
   * means a resource is matched here exactly the way the card spends it — RULE ZERO — rather than
   * by a second rule that can disagree with the sheet.
   */
  const resourceRows = (actor.tabs?.resources ?? []) as unknown as Array<{ label?: string }>;
  const poolLabels = resourceRows.map(x => ({ label: String(x.label ?? "") })).filter(x => x.label);

  const spendersOf = (resourceLabel: string, tier: number | undefined): string[] => {
    const out: string[] = [];
    for (const [tab, list] of Object.entries(actor.tabs ?? {})) {
      if (!Array.isArray(list) || tab === "resources") continue;
      for (const a of list as Array<{ label?: string; metadata?: Record<string, unknown> }>) {
        if (!a) continue;
        const m = (a.metadata ?? {}) as Record<string, unknown>;
        // A levelled spell spends its tier's slots, which no named-cost lookup will say.
        if (tier !== undefined && Number(m.spellLevel ?? 0) === tier) { out.push(String(a.label ?? "")); continue; }
        const spent = resolveNamedResourceCost(a as never, poolLabels as never);
        if (spent && spent.trim().toLowerCase() === resourceLabel.trim().toLowerCase()) out.push(String(a.label ?? ""));
      }
    }
    return out.filter(Boolean);
  };

  for (const r of (actor.tabs?.resources ?? []) as unknown as Array<Record<string, unknown>>) {
    const label = String(r.label ?? "");
    if (!label) continue;
    const meta = (r.metadata ?? {}) as Record<string, unknown>;
    const resourceKind = meta.resourceKind as string | undefined;

    // Hit Dice are a SHORT REST resource, not an in-fight one. `shortRestRecoveryFromActors`
    // already owns them, and counting them here would spend the same recovery twice.
    if (/hit dice|hit die/i.test(label)) continue;
    if (resourceKind !== "spellSlot" && resourceKind !== "pool" && resourceKind !== "freeCast") continue;

    const startUses = Number(meta.additive ?? 0);
    if (!Number.isFinite(startUses) || startUses <= 0) {
      needsInput.push(`${who} — ${label}: no readable pool size, so it is counted as nothing rather than guessed.`);
      continue;
    }

    const kind = kindOf(label, resourceKind);
    const tier = tierOf(label);
    const freeUses = kind === "freeCast" ? startUses : 0;
    const start = kind === "freeCast" ? 0 : startUses;
    const recoveredPerShortRest = regainPerShortRest(start, meta.shortRestRegain as number | "all" | undefined);
    const totalUses = start + recoveredPerShortRest * shortRests + freeUses;

    /**
     * ⚠ ALLOCATE ONCE. The share is the option split at this tier, so a tier whose loadout is all
     * damage allocates entirely to offense and a contested tier divides. Nothing here can add up
     * to more than `totalUses`, which is the guard the workbook states.
     */
    const spenders = spendersOf(label, tier);
    const counts = new Map<SlotUse, number>();
    for (const label of spenders) {
      for (const u of usesByLabel.get(label) ?? []) counts.set(u, (counts.get(u) ?? 0) + 1);
    }
    const damage = counts.get("damage") ?? 0;
    const healing = counts.get("healing") ?? 0;
    const control = counts.get("control") ?? 0;
    const offered = damage + healing + control;

    let offense = 0, sustain = 0, other = 0;
    const notes: string[] = [];
    const offeredBy: Record<ResourceLean, number> = { offense: damage, sustain: healing, control };
    const contestedNow = [damage, healing, control].filter(n => n > 0).length > 1;
    const lean = opts.lean;

    if (offered > 0 && contestedNow && lean && offeredBy[lean] > 0) {
      /**
       * ⚠ THE ROLE IS THE TIE BREAK, NOT THE SPELL COUNT. The leaned channel takes the majority
       * and the rest is divided among the other channels this tier actually offers, so the total
       * is still exactly `totalUses` — allocate-once holds however the lean falls.
       */
      const major = totalUses * CONTESTED_ROLE_MAJORITY;
      const minorPool = totalUses - major;
      const others = (Object.keys(offeredBy) as ResourceLean[]).filter(k => k !== lean && offeredBy[k] > 0);
      const otherTotal = others.reduce((t, k) => t + offeredBy[k], 0);
      const share: Record<ResourceLean, number> = { offense: 0, sustain: 0, control: 0 };
      share[lean] = major;
      for (const k of others) share[k] = otherTotal > 0 ? (minorPool * offeredBy[k]) / otherTotal : 0;
      offense = share.offense;
      sustain = share.sustain;
      other = Math.max(0, totalUses - offense - sustain);
      notes.push(`contested tier — split ${Math.round(CONTESTED_ROLE_MAJORITY * 100)}/${Math.round((1 - CONTESTED_ROLE_MAJORITY) * 100)} toward ${lean}, the role this character plays`);
    } else if (offered === 0) {
      other = totalUses;
      notes.push(spenders.length === 0
        ? "no action on this sheet spends it, so it is held rather than allocated"
        : "its spenders offer no priced use, so it is held rather than allocated");
    } else {
      offense = (totalUses * damage) / offered;
      sustain = (totalUses * healing) / offered;
      other = Math.max(0, totalUses - offense - sustain);
    }

    const contested = contestedNow;
    if (contested && !(lean && offeredBy[lean] > 0)) {
      notes.push(lean
        ? "contested tier — this character's role does not appear at this tier, so the uses follow what the loadout offers"
        : "contested tier — no bond role to lean on, so the uses follow what the loadout offers");
    }

    rows.push({
      actor: who, resource: label, kind,
      ...(tier !== undefined ? { tier } : {}),
      startUses: start, recoveredPerShortRest, freeUses, totalUses,
      offense, sustain, other, contested,
      options: spenders,
      notes,
    });
  }

  return { rows, needsInput };
}

export function resourceLedgerFromActors(
  actors: readonly Actor[],
  /** `leanFor` is per ACTOR — every character plays their own role. */
  opts: { shortRests?: number; leanFor?: (actor: Actor) => ResourceLean | undefined } = {},
): ResourceLedger {
  const all = actors.map(a => {
    const lean = opts.leanFor?.(a);
    return resourceLedgerFromActor(a, { ...(opts.shortRests !== undefined ? { shortRests: opts.shortRests } : {}), ...(lean ? { lean } : {}) });
  });
  return {
    rows: all.flatMap(l => l.rows),
    needsInput: all.flatMap(l => l.needsInput),
  };
}
