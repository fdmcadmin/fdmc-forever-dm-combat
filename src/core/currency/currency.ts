/**
 * Currency model — multi-coin wallet (CP / SP / GP / PP, no electrum).
 *
 * One campaign can use gold only; another can use every coin. Coins with a zero
 * balance are simply hidden in display (see `nonZeroCoins`). Internally everything
 * converts to copper so the merchant can take payment from any mix of coins and make
 * change ("auto-convert"). Legacy single-`gold` (gp) state migrates into `coins.gp`.
 */

export type CoinType = "cp" | "sp" | "gp" | "pp";

/** Display order, most → least valuable. */
export const COIN_TYPES: CoinType[] = ["pp", "gp", "sp", "cp"];

export const COIN_LABEL: Record<CoinType, string> = {
  pp: "Platinum",
  gp: "Gold",
  sp: "Silver",
  cp: "Copper",
};
export const COIN_ABBR: Record<CoinType, string> = { pp: "pp", gp: "gp", sp: "sp", cp: "cp" };

/** Value of one coin in copper (1 gp = 100 cp, 1 pp = 1000 cp, 1 sp = 10 cp). */
export const COIN_COPPER: Record<CoinType, number> = { cp: 1, sp: 10, gp: 100, pp: 1000 };

export type Coins = Partial<Record<CoinType, number>>;

const clampInt = (n: unknown): number =>
  typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;

/** Normalize a coins record: non-negative integers, only the four known coins. */
export function normalizeCoins(value: unknown): Coins {
  const v = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const out: Coins = {};
  for (const t of COIN_TYPES) {
    const n = clampInt(v[t]);
    if (n > 0) out[t] = n;
  }
  return out;
}

export function coinsToCopper(coins: Coins): number {
  return COIN_TYPES.reduce((sum, t) => sum + clampInt(coins[t]) * COIN_COPPER[t], 0);
}

/** Distribute a copper total into the fewest coins, largest first. */
export function copperToCoins(totalCopper: number): Coins {
  let rem = Math.max(0, Math.floor(totalCopper));
  const out: Coins = {};
  for (const t of COIN_TYPES) {
    const each = COIN_COPPER[t];
    const n = Math.floor(rem / each);
    if (n > 0) {
      out[t] = n;
      rem -= n * each;
    }
  }
  return out;
}

export function addCoin(coins: Coins, type: CoinType, amount: number): Coins {
  const next = normalizeCoins(coins);
  const sum = clampInt(next[type]) + Math.floor(amount);
  if (sum > 0) next[type] = sum;
  else delete next[type];
  return next;
}

export function setCoin(coins: Coins, type: CoinType, amount: number): Coins {
  const next = normalizeCoins(coins);
  const n = clampInt(amount);
  if (n > 0) next[type] = n;
  else delete next[type];
  return next;
}

export function canAfford(coins: Coins, copperPrice: number): boolean {
  return coinsToCopper(coins) >= Math.max(0, Math.floor(copperPrice));
}

/** Pay a copper price from the wallet, auto-converting and making change. */
export function spendCopper(coins: Coins, copperPrice: number): Coins {
  const price = Math.max(0, Math.floor(copperPrice));
  const remaining = coinsToCopper(coins) - price;
  return copperToCoins(Math.max(0, remaining));
}

/** Coins with a positive balance, in display order — used to hide empty coin types. */
export function nonZeroCoins(coins: Coins): Array<{ type: CoinType; amount: number }> {
  return COIN_TYPES.map((t) => ({ type: t, amount: clampInt(coins[t]) })).filter((c) => c.amount > 0);
}

export function formatCoins(coins: Coins): string {
  const parts = nonZeroCoins(coins).map((c) => `${c.amount} ${COIN_ABBR[c.type]}`);
  return parts.length ? parts.join(" ") : "0 gp";
}

/** Migrate a legacy single gold (gp) number into a coins record. */
export function coinsFromGold(gold: unknown): Coins {
  const gp = clampInt(gold);
  return gp > 0 ? { gp } : {};
}

const COIN_TOKEN: Record<string, CoinType> = { cp: "cp", sp: "sp", gp: "gp", pp: "pp" };

/**
 * Parse an item's price text into copper. Accepts "15 gp", "1,200 gp", "5 sp",
 * "2 pp", "200 cp", or a bare number (treated as gp). Returns 0 when unpriced.
 */
export function parsePriceCopper(value?: string | number | null): number {
  if (typeof value === "number") return Number.isFinite(value) ? Math.max(0, Math.floor(value)) * COIN_COPPER.gp : 0;
  if (!value) return 0;
  const text = String(value).toLowerCase().replace(/,/g, "");
  const m = text.match(/(\d+(?:\.\d+)?)\s*(pp|gp|sp|cp)?/);
  if (!m) return 0;
  const amount = parseFloat(m[1]);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const coin: CoinType = m[2] && COIN_TOKEN[m[2]] ? COIN_TOKEN[m[2]] : "gp";
  return Math.round(amount * COIN_COPPER[coin]);
}

/** Short price label for a copper amount (e.g. 1530 → "15 gp 3 sp"). */
export function formatCopperPrice(copper: number): string {
  return formatCoins(copperToCoins(copper));
}
