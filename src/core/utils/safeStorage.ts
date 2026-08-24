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

/**
 * ⚠ THE LAST RESORT MUST NOT THROW EITHER.
 *
 * The original fallback returned `window.sessionStorage` without probing it. In a fully sandboxed
 * iframe BOTH stores throw on access, so the "safe" wrapper threw from the line that was supposed
 * to be the safety net — and every caller that had trusted it to be safe went down with it. An
 * in-memory Storage keeps the app running for the session; nothing persists, which is the correct
 * outcome when the browser has said no twice.
 */
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, String(v)); },
    removeItem: (k: string) => { map.delete(k); },
    clear: () => { map.clear(); },
  } as Storage;
}

/** Probe a store by writing to it. Availability is not "the object exists" — it is "a write works". */
function usable(store: Storage | undefined): store is Storage {
  if (!store) return false;
  try {
    const testKey = "__fdmc_storage_test__";
    store.setItem(testKey, "1");
    store.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

export function safeStorage(): Storage {
  if (_storage) return _storage;

  let local: Storage | undefined;
  let session: Storage | undefined;
  // Reading the PROPERTY throws under Firefox ETP, before any method is called.
  try { local = window.localStorage; } catch { /* blocked */ }
  try { session = window.sessionStorage; } catch { /* blocked */ }

  if (usable(local)) {
    _storage = local;
  } else if (usable(session)) {
    // Firefox ETP or a sandboxed iframe. sessionStorage is still permitted in strict iframe
    // contexts, and same-origin frames in one tab share it — so cross-window sync survives.
    console.warn("[FDMC] localStorage is blocked (Firefox Enhanced Tracking Protection, or a sandboxed iframe). Falling back to sessionStorage: the app works normally, but DM libraries and seat choices will not survive closing the browser.");
    _storage = session;
  } else {
    console.warn("[FDMC] Both localStorage and sessionStorage are blocked. Running with in-memory storage: nothing will be saved, but the app will run.");
    _storage = memoryStorage();
  }
  return _storage;
}

/** Which store is in use — for the diagnostic banner, and for tests. */
export function storageMode(): "local" | "session" | "memory" {
  const store = safeStorage();
  try { if (store === window.localStorage) return "local"; } catch { /* blocked */ }
  try { if (store === window.sessionStorage) return "session"; } catch { /* blocked */ }
  return "memory";
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
