import { safeStorage } from "../utils/safeStorage";
/**
 * The convergence inbox — a durable home for forge requests.
 *
 * A broadcast is ephemeral: it reaches whichever windows happen to be listening at that
 * instant and is then gone forever. Convergence requests were only ever caught by the DM
 * panel and the Library popover, so a player submitting while neither was open sent their
 * items into nothing — and opening the Library afterwards showed an empty list, because there
 * was nothing left to hear. The player sits on "Awaiting DM Approval" indefinitely.
 *
 * Level-up requests already avoided this by writing themselves to safeStorage(). This is the
 * same idea, made explicit and shared: the MAIN app window — the one that is always open —
 * records every request here, and any DM surface reads the inbox rather than racing to catch
 * a broadcast it may not be alive for.
 *
 * Keyed by offerId + seatId, which is what makes a re-broadcast or a second listener harmless:
 * the same request seen twice is still one request.
 */

export const CONVERGENCE_INBOX_KEY = "fdmc.dm.convergenceInbox.v1";

/** Structural shape only — the canonical type lives with the panel that renders it. */
export type ConvergenceInboxEntry = {
  type: "fdmc:convergence-request";
  seatId: string;
  offerId: string;
  submittedItemIds: string[];
  submittedItemNames?: string[];
  actorId?: string;
  actorName?: string;
  outputItemId?: string;
  /** When the DM's app first recorded it — so a stale request can be recognised as stale. */
  receivedAt?: number;
};

const keyOf = (r: { offerId?: string; seatId?: string }) => `${r.offerId ?? ""}::${r.seatId ?? ""}`;

/** Only entries the approval panel can actually render — see isConvergenceRequest. */
function isUsable(value: unknown): value is ConvergenceInboxEntry {
  if (!value || typeof value !== "object") return false;
  const v = value as ConvergenceInboxEntry;
  return v.type === "fdmc:convergence-request"
    && typeof v.seatId === "string"
    && Array.isArray(v.submittedItemIds);
}

export function loadConvergenceInbox(): ConvergenceInboxEntry[] {
  try {
    const raw = safeStorage().getItem(CONVERGENCE_INBOX_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isUsable) : [];
  } catch {
    return [];
  }
}

function save(list: ConvergenceInboxEntry[]): void {
  try { safeStorage().setItem(CONVERGENCE_INBOX_KEY, JSON.stringify(list)); } catch { /* private mode */ }
}

/**
 * Record a request. Returns the full inbox so a caller can render it without re-reading.
 * A repeat of one already held replaces it rather than stacking — a player who resubmits is
 * correcting their pick, not queueing a second forge.
 */
export function addToConvergenceInbox(request: unknown): ConvergenceInboxEntry[] {
  if (!isUsable(request)) return loadConvergenceInbox();
  const entry: ConvergenceInboxEntry = { ...request, receivedAt: request.receivedAt ?? Date.now() };
  const next = [...loadConvergenceInbox().filter(r => keyOf(r) !== keyOf(entry)), entry];
  save(next);
  return next;
}

/** Drop a request once it has been approved or denied. */
export function removeFromConvergenceInbox(request: { offerId?: string; seatId?: string }): ConvergenceInboxEntry[] {
  const next = loadConvergenceInbox().filter(r => keyOf(r) !== keyOf(request));
  save(next);
  return next;
}

export function clearConvergenceInbox(): void {
  save([]);
}
