/**
 * WHO IS AT THE KEYBOARD — the log and the dice bridge both have to say it.
 *
 * Christopher, 2026-10-25: *"there is no indicator of which character the dm rolls from or if a
 * player is controlling multiple characters."*
 *
 * Every log line and every Dice+ request already carried `actorName` — WHICH CHARACTER acted. What
 * neither carried was WHO acted it. So a DM rolling an NPC attack from a party member's card, and
 * a player running two characters from one seat, both produced lines indistinguishable from that
 * character acting on its own behalf. Reading the log back, there is no way to tell a DM's roll
 * from the player's, which is exactly what you need to know when a result is disputed.
 *
 * ⚠ MODULE-LEVEL, AND THAT IS THE POINT. The alternative is threading the viewer's identity
 * through every one of the ~50 `addEntry` call sites and every dice request, which would be a
 * large diff that silently rots the moment someone adds the fifty-first. The identity is a fact
 * about the WINDOW, not about any one event, so the window sets it once on mount and the two
 * sinks — `createEntry` and the dice bridge — stamp it on everything that leaves.
 *
 * It lives in its own leaf file for the same reason `equippedOverlay` and `rerollMethod` do:
 * nothing here imports the Owlbear SDK, so a gate or the packaged engine can read a stamped entry
 * without a browser.
 */

/** The human driving this window, as a log line needs to name them. */
export type LogRoller = {
  /**
   * `dm` is the real GM, `co-dm` a seat flagged co-dm, `player` a seated player.
   *
   * `unknown` is honest rather than a default: outside Owlbear, or before the viewer id
   * resolves, nobody has been identified and the log must not claim otherwise.
   */
  role: "dm" | "co-dm" | "player" | "unknown";
  /** The viewer's own display name, as Owlbear knows it. */
  name?: string;
  /** The seat they are bound to. This is what tells two characters on one seat apart. */
  seatId?: string;
  seatLabel?: string;
};

const UNKNOWN: LogRoller = { role: "unknown" };

let current: LogRoller = UNKNOWN;

/**
 * Called by each window once it knows who it is, and again whenever that changes — a seat claim,
 * a co-dm promotion, the GM claiming the table.
 */
export function setLogRoller(next: LogRoller): void {
  current = next;
}

export function currentLogRoller(): LogRoller {
  return current;
}

/**
 * One short phrase naming the roller, or undefined when nobody has been identified.
 *
 * ⚠ THE ROLE ALONE IS NOT ENOUGH, and neither is the name alone. "Chris" does not say whether
 * that was a GM ruling or a player's own attack, and "DM" does not say which of two co-DMs made
 * it. Both are included whenever both are known.
 */
export function describeRoller(roller: LogRoller = current): string | undefined {
  if (roller.role === "unknown" && !roller.name) return undefined;
  const who = roller.name?.trim();
  const seat = roller.seatLabel?.trim();
  const role = roller.role === "dm" ? "DM" : roller.role === "co-dm" ? "Co-DM" : roller.role === "player" ? "player" : undefined;
  // A seat label is only worth printing when it is not simply the person's own name again.
  const place = seat && seat.toLowerCase() !== who?.toLowerCase() ? seat : undefined;
  const parts = [who, role && place ? `${role}, ${place}` : role ?? place].filter(Boolean);
  return parts.length > 0 ? parts.join(" — ") : undefined;
}
