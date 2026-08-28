/**
 * AUTHOR MODE — the publishing surface, hidden from every install but the author's.
 *
 * Christopher: *"ensure that these 4 boxes are on a hidden function, these should only be working
 * for my version of this app"* — `+ Campaign`, `↑ Publish`, `↓ Author`, `↓ Library`.
 *
 * ⚠ THIS IS NOT THE MODULE UNLOCK, AND CONFLATING THEM IS THE BUG IT FIXES. All four buttons were
 * gated on `isModuleUnlocked()`, which is the door into the Broken Chain CONTENT — every campaign
 * owner passes through it. So every campaign owner was also being shown the tools that publish that
 * campaign, export the author payload and dump the whole creature library. Those are the author's
 * controls, not a reader's, and "can see the campaign" was never meant to mean "can publish it".
 *
 * Two different questions, so two different gates:
 *
 *   isModuleUnlocked()  may this install READ the campaign content?
 *   isAuthorMode()      is this the author's own install?
 *
 * ── ⚠ WHAT THIS DOES AND DOES NOT DO ────────────────────────────────────────────────────────
 * It HIDES. It does not SECURE, and it must never be described as securing anything — the same
 * standing caveat the module unlock carries, for the same reason: this is front-end only and anyone
 * reading the bundle can find it.
 *
 * The real boundary is elsewhere and already holds. `↑ Publish` needs a saved GitHub token and says
 * so plainly when there is none; without that token the button cannot write anything to anybody's
 * repository no matter who clicks it. The three export/create buttons only ever touch the local
 * browser. So hiding them removes confusion and a surface nobody else should be looking at — it is
 * not what stops a stranger publishing, and nothing here should be relied on as if it were.
 *
 * ── HOW IT TURNS ON ─────────────────────────────────────────────────────────────────────────
 * Deliberately not a button, because a visible switch is not hidden. Load any FDMC window once with
 *
 *     ?author=<code>
 *
 * and the grant is stored for that browser; the parameter is not needed again. `?author=off` clears
 * it. There is no UI anywhere that offers this, and an install that never receives the parameter
 * behaves exactly as it does today with the four buttons absent.
 */

import { safeStorage } from "../utils/safeStorage";

/** btoa("fdmc-author") — the code the query parameter must carry. */
const AUTHOR_CODE_HASH = "ZmRtYy1hdXRob3I=";
const AUTHOR_KEY = "fdmc.author.mode.v1";

/**
 * A DERIVED token, not the code hash — the same shape as the module unlock's, and for the same
 * reason: pasting the hash into localStorage by hand must not grant author mode. Only passing the
 * parameter through `applyAuthorModeFromUrl` issues this exact value.
 */
const AUTHOR_TOKEN = btoa(`fdmc-author:${AUTHOR_CODE_HASH}:granted`);

/** Is this the author's install? Everything author-only asks here and nowhere else. */
export function isAuthorMode(): boolean {
  try {
    return safeStorage().getItem(AUTHOR_KEY) === AUTHOR_TOKEN;
  } catch {
    return false;
  }
}

/**
 * Does this string match the author key?
 *
 * ⚠ ASKED AT THE MOMENT OF USE, not once at start-up. The stored grant decides what is VISIBLE;
 * this decides what actually runs. Christopher: *"cant we lock the download buttons behind need[ing]
 * the same key [...] since it cant be a copied key."*
 *
 * The difference matters because a stored flag travels. Anyone can copy a localStorage value between
 * browsers, or restore one from a backup, and inherit a grant they were never given. Knowing the key
 * does not travel that way — so the irreversible actions ask for it every time, and the flag is
 * demoted to deciding whether the button is worth showing at all.
 */
export function verifyAuthorKey(code: string): boolean {
  try { return btoa(code.trim()) === AUTHOR_CODE_HASH; } catch { return false; }
}

export function clearAuthorMode(): void {
  try { safeStorage().removeItem(AUTHOR_KEY); } catch { /* ok */ }
}

/**
 * Read `?author=` once at start-up and record the result.
 *
 * ⚠ THE PARAMETER IS STRIPPED FROM THE URL after it is read, so the grant does not sit in the
 * address bar to be copied, bookmarked, or screen-shared into someone else's hands. It is already
 * stored by then; removing it costs nothing and closes the most likely way it leaks.
 *
 * Returns whether author mode is on AFTER applying, so a caller can seed state in one line.
 */
export function applyAuthorModeFromUrl(): boolean {
  try {
    const url = new URL(window.location.href);
    const param = url.searchParams.get("author");
    if (param !== null) {
      if (param.trim().toLowerCase() === "off") clearAuthorMode();
      else if (btoa(param.trim()) === AUTHOR_CODE_HASH) {
        safeStorage().setItem(AUTHOR_KEY, AUTHOR_TOKEN);
      }
      url.searchParams.delete("author");
      window.history.replaceState({}, "", url.toString());
    }
  } catch { /* no URL, no storage, or a sandboxed frame — stay locked */ }
  return isAuthorMode();
}
