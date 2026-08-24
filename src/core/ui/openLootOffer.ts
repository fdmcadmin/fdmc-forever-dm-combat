/**
 * Open loot offer — the SENT POOL is the stock, and picks go round in ORDER.
 *
 * THE MODEL (Christopher): the DM sends a pool, and what was sent is all there is. Send a
 * pool of one and exactly one player can take it. Stock is NOT a count looked up in the
 * library — the library is a CATALOGUE (names, stats, prices), not an inventory.
 *
 * Both shapes take turns; what differs is WHO is in the round and what ends a turn:
 *   boss loot — the DM picks the seats that are in it (X and Y, not Z). One pick each, and
 *               taking your item ends your turn.
 *   merchant  — normally the whole party, starting at seat 1. Your turn is a shopping trip:
 *               buy as much as you can afford, then "Done shopping" hands the counter on.
 *
 * Turn-taking is what makes single-copy stock work without a race — two players can't both
 * reach for the last item, because only one of them is at the counter.
 *
 * This is the baseline for the loot distributor generally: "send these items to these
 * players in this order", with taken items dropping off the choose-list as it travels.
 *
 * Why localStorage: the offer is SENT from the dm-panel window but claims are handled in the
 * main App window. Both are the GM's own browser, so the remaining pool lives here as the
 * shared record between them. The GM stays the only writer — a seat never touches this.
 */

import { obrSend } from "../utils/obrReady";
import { FDMC_SEAT_BROADCAST_CHANNEL } from "../seats/seatTypes";
import type { EquipmentItem } from "./EquipmentBagEditor";
import { safeStorage } from "../utils/safeStorage";

export type LootRecipient = { seatId: string; label: string };

/** One line of the round's ledger — what left the pool, who took it, and what it cost. */
export type LootClaim = {
  seatId: string;
  seatLabel: string;
  actorName: string;
  /** Absent for a pass or a DM skip. */
  itemId?: string;
  itemName?: string;
  costCopper?: number;
  kind: "took" | "bought" | "passed" | "skipped";
  at: number;
};

export type OpenLootOffer = {
  offerId: string;
  /** Item ids still up for grabs. A pick removes one; empty = the pool is exhausted. */
  remainingItemIds: string[];
  /** Recipients IN PICK ORDER (order is meaningless when `ordered` is false). */
  recipients: LootRecipient[];
  /** Index into `recipients` of whose pick it is. >= length = every seat has had its turn. */
  turnIndex: number;
  /** true = one at a time down the order; false = open to everyone, first claim wins. */
  ordered: boolean;
  /**
   * What ends a turn.
   *  true  — boss loot: taking your item ends it. One pick per seat.
   *  false — merchant: buy as many as you can afford; only "Done shopping" (a pass) hands on.
   */
  turnEndsOnPick: boolean;
  mode?: "boss-mid" | "boss-final" | "merchant";
  message: string;
  /**
   * Running ledger, oldest first. The DM's panel reads this to answer "who bought what"
   * while the round is live and after it closes — the pool alone only says what's LEFT.
   */
  claims: LootClaim[];
};

/** A player who doesn't want anything passes, so an AFK seat can't stall the whole round. */
export const LOOT_PASS_ID = "__pass__";

const OPEN_LOOT_OFFER_KEY = "fdmc.dm.openLootOffer.v1";

export function loadOpenLootOffer(): OpenLootOffer | null {
  try {
    const raw = safeStorage().getItem(OPEN_LOOT_OFFER_KEY);
    return raw ? JSON.parse(raw) as OpenLootOffer : null;
  } catch {
    return null;
  }
}

/**
 * Fired in THIS window whenever the record changes. The write is the signal.
 *
 * Cross-window updates already arrive as the native `storage` event, which only fires in
 * OTHER windows — this covers the window that did the writing. Between the two, nothing has
 * to poll: if nothing was written, nothing changed and nothing needs to re-render.
 */
export const OPEN_LOOT_OFFER_CHANGED = "fdmc:open-loot-offer-changed";

export function saveOpenLootOffer(offer: OpenLootOffer | null): void {
  try {
    if (offer) safeStorage().setItem(OPEN_LOOT_OFFER_KEY, JSON.stringify(offer));
    else safeStorage().removeItem(OPEN_LOOT_OFFER_KEY);
  } catch { /* storage unavailable — the offer just won't be stock-limited */ }
  try { window.dispatchEvent(new CustomEvent(OPEN_LOOT_OFFER_CHANGED)); } catch { /* no DOM */ }
}

/** Whose pick it is, or null for an open shop / a finished round. */
export function currentPicker(offer: OpenLootOffer | null): LootRecipient | null {
  if (!offer || !offer.ordered) return null;
  return offer.recipients[offer.turnIndex] ?? null;
}

export type ClaimResult =
  /** Taken. `done` = the round is over (pool empty, or everyone has had their turn). */
  | { outcome: "claimed"; offer: OpenLootOffer; done: boolean }
  /** Ordered offer and it isn't this seat's turn yet. */
  | { outcome: "not-your-turn"; waitingOn: LootRecipient }
  /** Loot round, and this seat has already had its one pick. */
  | { outcome: "already-picked"; took?: string }
  /** Someone else took it first, it was never in this pool, or the offer is stale. */
  | { outcome: "gone" };

/**
 * Take one item out of the open pool. Authoritative and GM-side only: the FIRST claim to
 * arrive wins, and a second claim for the same item gets "gone" rather than a duplicate.
 */
export function claimFromOpenOffer(
  offerId: string | undefined,
  seatId: string | undefined,
  itemId: string,
  /** Ledger details — what the DM's panel shows for this line. */
  record?: { actorName?: string; itemName?: string; costCopper?: number },
): ClaimResult {
  const offer = loadOpenLootOffer();
  // No record means no stock. Every sender of an offer writes one first, so the only ways to
  // get here are a dismissed round or wiped storage — and refusing is the safe side of that
  // trade: a wrongly-refused claim is fixed by the DM handing the item over, whereas a
  // wrongly-granted one is a silent duplicate of a single-copy item.
  if (!offer) return { outcome: "gone" };
  // A claim against a previous offer is stale — don't let it draw from the current pool.
  if (offerId && offer.offerId !== offerId) return { outcome: "gone" };

  if (offer.ordered) {
    const picker = offer.recipients[offer.turnIndex];
    if (!picker) return { outcome: "gone" };          // round already finished
    if (picker.seatId !== seatId) return { outcome: "not-your-turn", waitingOn: picker };
  }

  const isPass = itemId === LOOT_PASS_ID;

  // LOOT IS CHOOSE-ONE. Always — that predates turn order and does not depend on it. An
  // unordered round (one recipient, or turns switched off) has no queue to stop a seat
  // coming back for more, so the limit lives HERE rather than in whether the player's panel
  // happens to have closed. A merchant is the exception by design: spend what you want or
  // can, then hand the counter on.
  if (offer.turnEndsOnPick && !isPass) {
    const already = (offer.claims ?? []).find(
      c => c.seatId === seatId && (c.kind === "took" || c.kind === "bought"),
    );
    if (already) return { outcome: "already-picked", took: already.itemName };
  }

  if (!isPass && !offer.remainingItemIds.includes(itemId)) return { outcome: "gone" };

  // A pass always hands the turn on — that's what it's for. A pick only does when the round
  // is one-pick-each (boss loot); at a merchant you keep shopping until you say you're done.
  const advances = offer.ordered && (isPass || offer.turnEndsOnPick);
  const cost = record?.costCopper ?? 0;
  const ledgerLine: LootClaim = {
    seatId: seatId ?? "",
    seatLabel: offer.recipients.find(r => r.seatId === seatId)?.label ?? seatId ?? "?",
    actorName: record?.actorName ?? "?",
    itemId: isPass ? undefined : itemId,
    itemName: isPass ? undefined : record?.itemName,
    costCopper: cost > 0 ? cost : undefined,
    kind: isPass ? "passed" : cost > 0 ? "bought" : "took",
    at: Date.now(),
  };
  const next: OpenLootOffer = {
    ...offer,
    remainingItemIds: isPass
      ? offer.remainingItemIds
      : offer.remainingItemIds.filter(id => id !== itemId),
    turnIndex: advances ? offer.turnIndex + 1 : offer.turnIndex,
    claims: [...(offer.claims ?? []), ledgerLine],
  };
  // Closes when the stock runs out, or when the last seat in the order has had its turn.
  const done = next.remainingItemIds.length === 0
    || (next.ordered && next.turnIndex >= next.recipients.length);

  // A finished round is KEPT, not deleted. Clearing it would make a late claim look like an
  // untracked offer and fall through to the unlimited path — handing out a free item after
  // the shop closed. The next send overwrites this record anyway.
  saveOpenLootOffer(next);
  return { outcome: "claimed", offer: next, done };
}

/**
 * Re-send an open offer to every recipient after a pick.
 *
 * The pool holds ids; the catalogue supplies the display items. Everyone gets the SAME
 * remaining list, so an item that was just taken stops being offered — that is the whole
 * point of the sent pool being the stock. `closed` tells the seats to drop the overlay
 * because the round is over (stock gone, or the last seat has had its turn).
 */
export async function broadcastOfferState(offer: OpenLootOffer, closed: boolean, catalogue: EquipmentItem[]) {
  const remaining = offer.remainingItemIds
    .map(id => catalogue.find(i => i.id === id))
    .filter((i): i is EquipmentItem => Boolean(i));
  const picker = currentPicker(offer);
  for (const r of offer.recipients) {
    await obrSend(FDMC_SEAT_BROADCAST_CHANNEL, {
      type: "fdmc:loot-offer",
      seatId: r.seatId,
      offerId: offer.offerId,
      items: remaining,
      message: offer.message || "Choose your item.",
      mode: offer.mode,
      ordered: offer.ordered,
      turnSeatId: picker?.seatId,
      turnLabel: picker?.label,
      closed,
    }, { destination: "REMOTE" });
  }
}

/**
 * DM override: hand the turn on without the current seat acting.
 *
 * A player who has disconnected or wandered off would otherwise hold the queue open forever,
 * since only their own click advances it.
 */
export async function skipCurrentPicker(catalogue: EquipmentItem[]): Promise<OpenLootOffer | null> {
  const offer = loadOpenLootOffer();
  if (!offer || !offer.ordered) return null;
  const skipped = offer.recipients[offer.turnIndex];
  const next: OpenLootOffer = {
    ...offer,
    turnIndex: offer.turnIndex + 1,
    claims: [...(offer.claims ?? []), {
      seatId: skipped?.seatId ?? "", seatLabel: skipped?.label ?? "?",
      actorName: skipped?.label ?? "?", kind: "skipped", at: Date.now(),
    }],
  };
  const done = next.turnIndex >= next.recipients.length || next.remainingItemIds.length === 0;
  saveOpenLootOffer(next);
  await broadcastOfferState(next, done, catalogue);
  return next;
}

/** DM override: end the round now — every recipient's panel closes. */
export async function closeOpenOffer(catalogue: EquipmentItem[]): Promise<void> {
  const offer = loadOpenLootOffer();
  if (!offer) return;
  // Park the turn past the last seat so a late claim is refused, not silently granted.
  const next = { ...offer, turnIndex: offer.recipients.length, remainingItemIds: [] };
  saveOpenLootOffer(next);
  await broadcastOfferState(next, true, catalogue);
}
