export const FDMC_SHARED_TABLE_SAFE_BYTES = 8000;
export const FDMC_SHARED_TABLE_WARN_BYTES = 9000;
export const FDMC_SHARED_TABLE_DANGER_BYTES = 11000;
export const FDMC_SHARED_TABLE_BLOCK_BYTES = 13000;

export type SharedTableBudgetLevel = "safe" | "warn" | "danger" | "block";

export type SharedTableBudgetStatus = {
  bytes: number;
  level: SharedTableBudgetLevel;
  message: string;
  canWrite: boolean;
};

export function estimateSharedTableStateBytes(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length;
  } catch {
    try {
      return JSON.stringify(value).length;
    } catch {
      return 0;
    }
  }
}

export function getSharedTableBudgetStatus(value: unknown): SharedTableBudgetStatus {
  const bytes = estimateSharedTableStateBytes(value);

  if (bytes >= FDMC_SHARED_TABLE_BLOCK_BYTES) {
    return {
      bytes,
      level: "block",
      canWrite: false,
      message: `FDMC sharedTableState blocked: ${bytes} bytes. Refusing non-maintenance write.`,
    };
  }

  if (bytes >= FDMC_SHARED_TABLE_DANGER_BYTES) {
    return {
      bytes,
      level: "danger",
      canWrite: true,
      message: `FDMC sharedTableState danger: ${bytes} bytes. Room metadata budget is close to the write block.`,
    };
  }

  if (bytes >= FDMC_SHARED_TABLE_WARN_BYTES) {
    return {
      bytes,
      level: "warn",
      canWrite: true,
      message: `FDMC sharedTableState warning: ${bytes} bytes. Room metadata budget is getting tight.`,
    };
  }

  return {
    bytes,
    level: "safe",
    canWrite: true,
    message: `FDMC sharedTableState safe: ${bytes} bytes.`,
  };
}

export function shouldLogSharedTableBudget(previousLevel: SharedTableBudgetLevel | undefined, nextLevel: SharedTableBudgetLevel): boolean {
  return previousLevel !== nextLevel && nextLevel !== "safe";
}
