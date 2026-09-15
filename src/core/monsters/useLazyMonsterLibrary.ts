import { useEffect, useState } from "react";
import type { MainMonsterTemplate } from "./runtime/mainMonsterRuntime";

/**
 * THE MONSTER LIBRARY, FETCHED ONLY WHEN SOMETHING ON THIS WINDOW NEEDS A BODY FROM IT.
 *
 * `App` resolved the whole library — the SRD's 800KB of stat blocks included — on its first render, for one
 * reader: a summoned body (a Steed, a Cannon) materialized from its record. A player with no summon on the
 * field paid 1.1MB of download and parse to sit down. Now the library loads when a summon record exists or
 * the viewer is the GM, and a summon record resolves to no body until it arrives (a moment, once).
 *
 * The precedence rule is unchanged: it is still read through `resolveMonsterLibrary`, so a Steed the DM has
 * edited is the Steed that arrives.
 */
const EMPTY: readonly MainMonsterTemplate[] = [];
let pending: Promise<readonly MainMonsterTemplate[]> | undefined;

function loadLibrary(): Promise<readonly MainMonsterTemplate[]> {
  pending ??= Promise.all([import("./dmMonsterLibrary"), import("../../data/broken-chain/monsterLibrary")])
    .then(([{ resolveMonsterLibrary }, { BROKEN_CHAIN_MONSTER_LIBRARY }]) => resolveMonsterLibrary(BROKEN_CHAIN_MONSTER_LIBRARY).library)
    .catch((error: unknown) => { pending = undefined; throw error; });
  return pending;
}

export function useLazyMonsterLibrary(needed: boolean): readonly MainMonsterTemplate[] {
  const [library, setLibrary] = useState<readonly MainMonsterTemplate[]>(EMPTY);
  useEffect(() => {
    if (!needed || library !== EMPTY) return;
    let active = true;
    loadLibrary()
      .then(loaded => { if (active) setLibrary(loaded); })
      .catch(error => console.warn("[FDMC] the monster library did not load; summoned bodies cannot be built yet", error));
    return () => { active = false; };
  }, [needed, library]);
  return library;
}
