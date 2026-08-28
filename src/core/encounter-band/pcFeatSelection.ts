/**
 * WHICH FEATS EACH PC HAS — the DM's own record, because the sheet does not carry one.
 *
 * ⚠ AN ACTOR HAS NO `feats` FIELD. Checked before building this: `TabId` is
 * main | bonus | spells | bond | checks | features, and nothing on `Actor` records a feat. So the
 * feats a character actually took are information the app does not have, and the estimator cannot
 * invent them.
 *
 * Rather than guess, the DM says. This is the store for what they said.
 *
 * ⚠ AND AN EMPTY LIST IS NOT "NO FEATS" — it is "nobody has told the app yet". The panel says so
 * rather than reporting a party with no feat contribution, which would read exactly like a party
 * whose feats are worth nothing. Same rule as NEEDS_INPUT one layer down.
 */

import { safeStorage } from "../utils/safeStorage";

const KEY = "fdmc.dm.pcFeats.v1";

/** actor id -> the feat keys or names the DM recorded for them. */
export type PcFeatSelection = Record<string, string[]>;

export function loadPcFeats(): PcFeatSelection {
  try {
    const raw = safeStorage().getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: PcFeatSelection = {};
    for (const [id, list] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(list)) out[id] = list.filter((x): x is string => typeof x === "string");
    }
    return out;
  } catch {
    return {};
  }
}

export function savePcFeats(selection: PcFeatSelection): void {
  try { safeStorage().setItem(KEY, JSON.stringify(selection)); } catch { /* ok */ }
}

export function setPcFeats(actorId: string, feats: string[]): PcFeatSelection {
  const next = { ...loadPcFeats(), [actorId]: feats };
  savePcFeats(next);
  return next;
}
