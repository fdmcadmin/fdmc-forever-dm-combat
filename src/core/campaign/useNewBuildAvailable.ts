/**
 * IS A NEWER BUILD LIVE THAN THE ONE THIS PAGE IS RUNNING?
 *
 * Christopher: *"why do i have to reload the app every time i publish, shouldnt a cache buster
 * make it to where it updates the mod library are sent to the app and any creature not in combat
 * is updated."*
 *
 * ── ⚠ MOST OF THAT RELOAD WAS A BUG, NOT A CACHE ────────────────────────────────────────────
 *
 * Until 0.7.56 `resolveMonsterLibrary` discarded a stored copy that carried no `dmEdited` stamp
 * and returned the BUNDLED creature instead. So an edit did not show up until the bundle itself
 * changed — which is to say, until a publish had been folded and redeployed and the page reloaded.
 * That is why publishing looked like the thing that made an edit take effect. It never was: a
 * stored copy wins now, and an edit is live the moment it is saved, on this machine, with no
 * publish and no reload at all.
 *
 * ── WHAT A RELOAD IS STILL FOR, AND WHY A CACHE-BUSTER CANNOT REPLACE IT ─────────────────────
 *
 * The library is not fetched. `BROKEN_CHAIN_MONSTER_LIBRARY` is `mergeAuthored(seed, AUTHORED_MONSTERS)`
 * and BOTH are compiled into the JavaScript bundle, which is the whole reason the app works with
 * no server and no network. A cache-buster changes what the browser fetches NEXT; it cannot change
 * the code a running page has already executed. Nothing short of re-executing that code — a reload
 * — picks up a new library.
 *
 * So this does the honest half: it NOTICES. The manifest is a small static file, it is fetched
 * with a cache-buster (which is where one actually belongs), and when the served version differs
 * from the version compiled into this page, the app can say so instead of the DM finding out by
 * accident.
 *
 * ⚠ IT NEVER RELOADS BY ITSELF. *"any creature not in combat is updated"* — the DM is drawing the
 * line at live combat, and so is this: a reload throws away nothing persisted, but it does close
 * pop-outs and interrupt whoever is mid-turn. Deciding when to take it belongs to the person
 * running the table, so this returns a fact and offers a button.
 */

import { useEffect, useState } from "react";

/**
 * The version this page is RUNNING — compiled in, so it cannot drift from the code beside it.
 * Callers pass their own so this module needs no import cycle back into the app shell.
 */
export type BuildWatch = {
  /** The version being served, when it differs from the running one. `null` while they agree. */
  available: string | null;
  /** Reload to pick it up. Separated so a caller can put it behind a confirmation. */
  reload: () => void;
};

export function useNewBuildAvailable(runningVersion: string, pollMs = 120_000): BuildWatch {
  const [available, setAvailable] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        /**
         * ⚠ THE CACHE-BUSTER GOES HERE, on the fetch — not on the page. `cache: "no-store"` alone
         * is not enough behind some proxies, and the manifest is a few hundred bytes.
         */
        const res = await fetch(`manifest.json?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        const served = (await res.json() as { version?: string }).version;
        if (cancelled || !served) return;
        // Compare against the compiled version, stripped of the "FDMC v" the shell prints.
        const running = runningVersion.replace(/^\D*/, "").trim();
        setAvailable(served.trim() !== running ? served.trim() : null);
      } catch {
        // Offline, blocked, or not served — a build check is never worth an error on screen.
      }
    }

    void check();
    const id = window.setInterval(() => void check(), pollMs);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [runningVersion, pollMs]);

  return { available, reload: () => window.location.reload() };
}
