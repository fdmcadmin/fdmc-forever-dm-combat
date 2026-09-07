/**
 * THE NEUTRAL DAMAGE PROFILE — the curve's damage in TYPES, and nothing else.
 *
 * Transcribed from `broken_chain_checker_runtime_v3_3_slot_resource_budget.xlsx`, sheet
 * `Neutral Damage Profile`: *"Typed shares remain separate through defense resolution. Edit the mix
 * when certifying a different neutral profile."*
 *
 * ⚠ IT NAMES DAMAGE TYPES AND NOTHING ELSE. Christopher, 2026-09-07: *"it should only list damage
 * types not names of spells actions and classes."* That is what makes it general. The certified
 * curve is the mean of four endpoint parties — best and worst offensive and defensive sustain — and
 * those parties have classes, spells and feats that are theirs alone. What survives generalisation
 * is how their damage was TYPED, so this is the one shape a published line can carry without
 * smuggling somebody's Wizard into every table's answer.
 *
 * ─── ⚠ WHAT IT IS FOR ───────────────────────────────────────────────────────────────────────
 *
 * A creature's resistance is only worth what it actually stops, so the workbook weights a typed
 * response by the party's SHARE of that damage type. With no actors chosen the app had no share and
 * priced every typed response at zero — a Gate II mirror resistant to bludgeoning, piercing and
 * slashing came out worth nothing at all, and the panel asked the DM to "enter the share directly".
 *
 * This is that share, published. It is a DEFAULT and is reported as one: a party read off real
 * characters always outranks it, because a table whose damage is 40% radiant is not this table.
 */

/** Damage type → share of typed party output. Sums to 1.00. */
export type DamageTypeShares = Readonly<Record<string, number>>;

/**
 * The base column of the sheet. The variant columns beside it (Fire / Lightning, Water / Acid,
 * Air / Force, Bludgeoning / Radiant) re-weight the mix for a creature whose OWN resistances sit on
 * that pair; they are a second question and are not needed to weigh one response.
 */
export const NEUTRAL_DAMAGE_PROFILE: DamageTypeShares = Object.freeze({
  bludgeoning: 0.14,
  piercing: 0.14,
  slashing: 0.14,
  fire: 0.10,
  cold: 0.08,
  lightning: 0.08,
  force: 0.08,
  radiant: 0.06,
  necrotic: 0.05,
  psychic: 0.04,
  acid: 0.03,
  poison: 0.03,
  thunder: 0.03,
});

/**
 * The profile as a `PartyDamageMix`-shaped value, so a caller with no actors can price a typed
 * response instead of reporting a zero.
 *
 * ⚠ `coverage` IS 1 AND THAT IS HONEST: every type in the published mix states its type. What it is
 * NOT is a reading of this table's party, which is why the source is carried beside it and why the
 * panel says which one it used.
 */
export function neutralDamageMix(): {
  shares: DamageTypeShares;
  typedTotal: number;
  coverage: number;
  usable: true;
  untyped: never[];
  sources: never[];
  source: "published-neutral";
} {
  return {
    shares: NEUTRAL_DAMAGE_PROFILE,
    typedTotal: 1,
    coverage: 1,
    usable: true,
    untyped: [],
    sources: [],
    source: "published-neutral",
  };
}
