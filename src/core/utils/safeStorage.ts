/**
 * safeStorage — Firefox ETP (Enhanced Tracking Protection) fallback
 *
 * Firefox blocks third-party localStorage when ETP is active.
 * Since FDMC runs inside OBR's iframe, Firefox treats our origin as
 * third-party and throws SecurityError on any localStorage access.
 *
 * This wrapper tests localStorage on first call and falls back to
 * sessionStorage if blocked. sessionStorage is always permitted even
 * in strict iframe contexts.
 *
 * SessionStorage fallback means data doesn't persist across browser
 * sessions, but the app stays functional within a play session.
 */

let _storage: Storage | null = null;

export function safeStorage(): Storage {
  if (_storage) return _storage;
  try {
    const testKey = "__fdmc_storage_test__";
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
    _storage = window.localStorage;
  } catch {
    // Firefox ETP or sandboxed iframe — fall back to sessionStorage
    console.warn("[FDMC] localStorage blocked (Firefox ETP or sandbox). Using sessionStorage fallback. Data will not persist across browser restarts.");
    _storage = window.sessionStorage;
  }
  return _storage;
}

/** Convenience wrappers */
export const storageGet = (key: string): string | null => {
  try { return safeStorage().getItem(key); } catch { return null; }
};

export const storageSet = (key: string, value: string): void => {
  try { safeStorage().setItem(key, value); } catch { /* ok */ }
};

export const storageRemove = (key: string): void => {
  try { safeStorage().removeItem(key); } catch { /* ok */ }
};
