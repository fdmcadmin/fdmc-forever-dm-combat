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
import { verifyAuthorIdentity, type AuthorCheck } from "./authorIdentity";
import { savePublishToken } from "./publishToGitHub";

/**
 * ⚠ THERE IS NO AUTHOR CODE ANY MORE.
 *
 * This held `AUTHOR_CODE_HASH = btoa("…")` — base64, not a hash — compiled into a bundle that ships
 * to every table. One `atob` recovered it, and rotating it meant editing source and redeploying.
 * Christopher: *"anything that ship into the app is decodeable if someone is determined enough."*
 *
 * Author mode is a GITHUB IDENTITY now: `authorIdentity.verifyAuthorIdentity` asks GitHub who the
 * token belongs to and whether they can push the campaign repo. Only the authorised USER ID is
 * compiled in, which is public and grants nothing on its own.
 */
const AUTHOR_KEY = "fdmc.author.mode.v2";

/**
 * A LOCAL MARKER, NOT A CREDENTIAL. It records that GitHub said yes on this browser, so the panel
 * does not re-check on every render. It is not the token and cannot be exchanged for one — and
 * because it is only a marker, forging it buys nothing that matters: every irreversible action
 * still goes through the real GitHub token, which GitHub itself enforces.
 */
const AUTHOR_TOKEN = "fdmc-author:github-verified";

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
export async function verifyAuthorKey(token: string): Promise<boolean> {
  return (await verifyAuthorIdentity(token)).ok;
}

/**
 * Grant author mode by proving a GitHub identity.
 *
 * ⚠ THE CREDENTIAL IS OPAQUE TO FDMC. It is handed to GitHub and never compared against anything
 * here, so revoking a token and issuing a new one for the same account needs no source change —
 * which is the whole point. Paste the new one and it works.
 *
 * The token is stored where PUBLISHING already keeps it, because it is the same credential doing
 * the same job. One token, one place, and signing out clears it.
 */
export async function grantAuthorModeWithGitHub(token: string): Promise<AuthorCheck> {
  const check = await verifyAuthorIdentity(token);
  if (!check.ok) return check;
  try {
    savePublishToken(token.trim());
    safeStorage().setItem(AUTHOR_KEY, AUTHOR_TOKEN);
  } catch { /* storage refused — author mode lasts this session only */ }
  return check;
}

export function clearAuthorMode(): void {
  // Sign out of BOTH: the marker and the credential it was granted from.
  try { safeStorage().removeItem(AUTHOR_KEY); } catch { /* ok */ }
  try { savePublishToken(""); } catch { /* ok */ }
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
  /**
   * ⚠ `?author=<code>` IS GONE, AND ONLY `?author=off` REMAINS.
   *
   * A URL could carry the old compiled code because the check was local. Nothing can carry a
   * GitHub identity that way — the token would sit in an address bar, in history, and in whatever
   * frame the panel is embedded in. Signing out is still worth a parameter; signing IN is not.
   */
  try {
    const url = new URL(window.location.href);
    const param = url.searchParams.get("author");
    if (param !== null) {
      if (param.trim().toLowerCase() === "off") clearAuthorMode();
      url.searchParams.delete("author");
      window.history.replaceState({}, "", url.toString());
    }
  } catch { /* no URL, no storage, or a sandboxed frame — stay locked */ }
  return isAuthorMode();
}

