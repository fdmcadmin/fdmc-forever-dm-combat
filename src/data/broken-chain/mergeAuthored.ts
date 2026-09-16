/**
 * Merge authored content over a bundled list by id.
 *
 * Authored entries WIN for their own id — that is the point of authoring — and anything the
 * author has not touched is left exactly as the hand-written source has it. Order is stable:
 * bundled entries keep their position, genuinely new ones are appended.
 *
 * ⚠ THIS LIVES HERE, NOT IN `authored.generated.ts`, BECAUSE THE FOLD REWRITES THAT FILE.
 *
 * It used to be written out by `scripts/fold-authoring.mjs` from a template inside the script. 0.8.66.0
 * taught the generated copy the revision date and never taught the template, so the next author publish
 * would have regenerated the function WITHOUT it — and every published loot revision would have lost to the
 * older export again, silently. A hand-written function has one copy. The generated file re-exports it.
 */
export function mergeAuthored<T>(
  bundled: T[],
  authored: T[],
  idOf: (item: T) => string,
  /**
   * ⚠ WHEN THE SNAPSHOT IS OLDER THAN THE PUBLISHED REVISION, THE REVISION WINS.
   *
   * Christopher published a revised loot document (v6) whose text had to reach the table. Every one of
   * those items is also in the author export, which states the same fields, so the field-wise merge below
   * handed the table the OLD text and the revision could not arrive. Passing the export's date lets a
   * bundled item that states a later `revisedAt` win for the fields IT states — and the moment the DM
   * edits that item in the app again, their export is the newer one and wins as before.
   */
  opts: { authoredAt?: string } = {},
): T[] {
  if (authored.length === 0) return bundled;
  const authoredAt = Date.parse(String(opts.authoredAt ?? ""));
  const overrides = new Map(authored.map(a => [idOf(a), a]));
  const merged = bundled.map(b => {
    const over = overrides.get(idOf(b));
    if (!over) return b;
    /**
     * ⚠ FIELD-WISE, NOT WHOLESALE — OR THE SEED CAN NEVER GAIN A FIELD AGAIN.
     *
     * This replaced the bundled entry outright. That is fine while the two describe the same
     * shape, and it silently freezes the library the moment the shape grows: the equipment export
     * carries ALL 137 items, so every seeded item is also an "authored" one, and an authored copy
     * taken before a field existed permanently shadowed it.
     *
     * The case that surfaced it: an activation field — what using an item costs — was added and written
     * onto 21 library items, and not one of them reached the app. Every single row was overridden
     * by its own snapshot from a browser that predated the field.
     *
     * A field the authored copy does not MENTION is not a decision to remove it; it is a field
     * that did not exist when the export was taken. So an authored copy overrides the fields it
     * actually states, and the seed supplies the rest.
     */
    /**
     * ⚠ AND THE SAME RULE HAS TO REACH ONE LEVEL DOWN, WHICH IT DID NOT.
     *
     * Christopher published at 2026-09-12T17:30Z and all 24 convergence TIER labels vanished —
     * the identical shape as the nine weapon riders at 0.8.40.5, arriving through a door that was
     * supposed to be shut. `convergence` is a nested OBJECT, so an authored copy stating
     * `{role, enabled, mechanicalTag}` replaced the seed's `{role, enabled, mechanicalTag, tier}`
     * WHOLE, and the tier went with it. So plain objects merge key-wise and everything else —
     * arrays, dates, primitives — still replaces outright, because an array IS a complete statement.
     */
    const isPlainObject = (v: unknown): v is Record<string, unknown> =>
      typeof v === "object" && v !== null && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;

    const revisedAt = Date.parse(String((b as Record<string, unknown>).revisedAt ?? ""));
    /** The published revision is newer than this snapshot: the roles swap, field-wise, both ways. */
    const seedWins = Number.isFinite(revisedAt) && Number.isFinite(authoredAt) && revisedAt > authoredAt;
    const winner = (seedWins ? b : over) as Record<string, unknown>;
    const loser = (seedWins ? over : b) as Record<string, unknown>;

    const stated: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(winner)) {
      if (v === undefined) continue;
      const other = loser[k];
      stated[k] = isPlainObject(v) && isPlainObject(other) ? { ...other, ...v } : v;
    }
    return { ...loser, ...stated } as T;
  });
  const bundledIds = new Set(bundled.map(idOf));
  return [...merged, ...authored.filter(a => !bundledIds.has(idOf(a)))];
}

/**
 * ⚠ `null` IS "THIS FIELD IS GONE", AND IT IS THE ONLY WAY A LAYER CAN SAY SO.
 *
 * `undefined` means "this layer says nothing about it", which is what keeps an old export from erasing a
 * field it never knew about. That left no way at all to REMOVE one: Gift of Duskthorn stopped being a
 * weapon chassis in loot doc v11 and became a charm bound to a weapon, and the author export still stated
 * its old chassis — which also hides the bind control, since the editor offers a bind only to an item that
 * is not a chassis. A layer writes `chassis: null`; the merge applies it like any other statement.
 *
 * ⚠ STRIP ONCE, AT THE END — NEVER INSIDE A MERGE. The library is two merges deep, and the first build of
 * this stripped the null in the first one: the revision reached the second merge with no `chassis` key at
 * all, so it no longer SAID anything about the chassis and the export's old one won. The null has to survive
 * every merge and be removed only from what is finally published.
 */
export function withoutClears<T>(item: T): T {
  if (typeof item !== "object" || item === null) return item;
  const entries = Object.entries(item as Record<string, unknown>);
  if (!entries.some(([, v]) => v === null)) return item;
  return Object.fromEntries(entries.filter(([, v]) => v !== null)) as T;
}
