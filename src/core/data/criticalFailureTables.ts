export type CriticalFailureTableKind = "standard" | "double";

export type CriticalFailureEntry = {
  id: string;
  roll: number;
  title: string;
  playerSummary: string;
  dmEffect: string;
  damageClause?: string;
};

export const STANDARD_CRITICAL_FAILURE_TABLE: CriticalFailureEntry[] = [
  {
    id: "overextended",
    roll: 1,
    title: "Overextended",
    playerSummary: "The action misses and leaves the actor briefly open.",
    dmEffect: "The attack misses. Until the start of the actor's next turn, the next attack against them gains +2 to hit. No damage is dealt by this failure.",
  },
  {
    id: "bad-footing",
    roll: 2,
    title: "Bad Footing",
    playerSummary: "The actor slips, stumbles, or loses their stance.",
    dmEffect: "The attack misses. The actor's speed is reduced by 10 ft until the end of their next turn. No damage is dealt by this failure.",
  },
  {
    id: "lost-line",
    roll: 3,
    title: "Lost Line",
    playerSummary: "The target reads the mistake and shifts position.",
    dmEffect: "The attack misses. The target may move 5 ft without provoking opportunity attacks. No damage is dealt by this failure.",
  },
  {
    id: "guard-drops",
    roll: 4,
    title: "Guard Drops",
    playerSummary: "The actor's guard opens for a breath.",
    dmEffect: "The attack misses. The actor cannot benefit from cover or Shield-style reaction protection against the next attack before their next turn. No damage is dealt by this failure.",
  },
  {
    id: "resource-hiccup",
    roll: 5,
    title: "Resource Hiccup",
    playerSummary: "A weapon, focus, pouch, or stance needs a second to reset.",
    dmEffect: "The attack misses. The actor cannot use the same named action again until after their next turn unless the DM rules the setup was recovered. No damage is dealt by this failure.",
  },
  {
    id: "dm-soft-complication",
    roll: 6,
    title: "DM Soft Complication",
    playerSummary: "The DM chooses the cleanest non-damaging complication for the scene.",
    dmEffect: "The attack misses. Choose one: exposed position, lost footing, target reposition, dropped momentum, or noisy mistake. No damage is dealt by this failure.",
  },
];

export const DOUBLE_CRITICAL_FAILURE_TABLE: CriticalFailureEntry[] = [
  {
    id: "rattled",
    roll: 1,
    title: "Rattled",
    playerSummary: "The second failure shakes the actor's rhythm.",
    dmEffect: "The attack misses. The actor has disadvantage on their next attack roll. No damage is dealt by this result.",
  },
  {
    id: "hard-opening",
    roll: 2,
    title: "Hard Opening",
    playerSummary: "The enemy gets a clean read on the mistake.",
    dmEffect: "The attack misses. One enemy that can see the actor may move 10 ft without provoking opportunity attacks. No damage is dealt by this result.",
  },
  {
    id: "focus-snap",
    roll: 3,
    title: "Focus Snap",
    playerSummary: "The actor's rhythm breaks at the wrong moment.",
    dmEffect: "The attack misses. The actor loses one readied/pending minor benefit chosen by the DM, or the next bond/helpful rider they receive before their next turn is reduced by one die step. No damage is dealt by this result.",
  },
  {
    id: "wide-open",
    roll: 4,
    title: "Wide Open",
    playerSummary: "The actor is in the wrong place with the wrong guard.",
    dmEffect: "The attack misses. The next attack against the actor before their next turn has advantage. No damage is dealt by this result.",
  },
  {
    id: "broken-momentum",
    roll: 5,
    title: "Broken Momentum",
    playerSummary: "The turn collapses into recovery instead of pressure.",
    dmEffect: "The attack misses. The actor cannot take reactions until the start of their next turn and cannot gain advantage on their next attack. No damage is dealt by this result.",
  },
  {
    id: "painful-mistake",
    roll: 6,
    title: "Painful Mistake",
    playerSummary: "The second failure bites back.",
    dmEffect: "The attack misses. This is the only double-failure result that may deal damage. Level 1 only: the actor takes 1d4 damage. Level 2+: replace the damage with prone, disarmed/recoverable, separated 10 ft, or next attack against the actor has advantage.",
    damageClause: "Only this d6 result may deal damage, and only for level 1 actors.",
  },
];

export function getCriticalFailureEntries(kind: CriticalFailureTableKind) {
  return kind === "double" ? DOUBLE_CRITICAL_FAILURE_TABLE : STANDARD_CRITICAL_FAILURE_TABLE;
}

export function getCriticalFailureEntry(kind: CriticalFailureTableKind, roll: number) {
  return getCriticalFailureEntries(kind).find((entry) => entry.roll === roll) ?? null;
}

export function formatCriticalFailureLog(entry: CriticalFailureEntry, kind: CriticalFailureTableKind, actorLevel: number, isPlayerSafe = false) {
  const tier = kind === "double" ? "Double Nat 1" : "Nat 1";
  const effect = isPlayerSafe ? entry.playerSummary : entry.dmEffect;
  const damageGuard = kind === "double" && entry.roll === 6 && actorLevel > 1
    ? " Damage suppressed above level 1; use the non-damage replacement."
    : "";

  return `${tier} d6 result ${entry.roll} — ${entry.title}. ${effect}${damageGuard}`;
}
