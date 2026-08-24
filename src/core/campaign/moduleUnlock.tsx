/**
 * Module Unlock — shared LOCAL SOFT GATE for the campaign ("Broken Chain") library.
 *
 * ⚠️ SECURITY: This is a front-end-only soft gate. It is NOT content protection.
 * The "hash" is plain base64 (btoa) and the code can be trivially recovered by anyone
 * who opens dev tools or reads the bundle. Treat it as a demo/local convenience lock —
 * a speed bump, not a lock. It must NOT be presented to users as protecting paid or
 * private content. A real licensing system (server-side entitlement check + signed
 * tokens) is required before any paid distribution.
 * See _specs/P-UX1-SPEC.md → "Module Unlock security debt".
 *
 * IMPORTANT BEHAVIOR (2026-06-07): the gate ONLY guards the campaign / Broken Chain
 * library. A DM never needs the code to create or manage their OWN monsters,
 * encounters, or equipment — "My Library" is always open. The password is only the
 * door into the bundled Broken Chain content.
 *
 * Default code: "brokenchain" → base64 below.
 * To change: run btoa("yourNewCode") in the browser console and paste here.
 */

import { useEffect, useState } from "react";
import { safeStorage } from "../utils/safeStorage";

const MODULE_UNLOCK_HASH = "YnJva2VuY2hhaW4="; // btoa("brokenchain") — base64 of the unlock code
const MODULE_LOCK_KEY = "fdmc.module.unlocked.v1";

// The stored "unlocked" flag is a DERIVED token, not the raw code hash. So casually
// pasting btoa("brokenchain") into the console does NOT unlock — only entering the code
// through the form issues this exact token. The snap-back watcher (useModuleUnlock)
// re-locks the UI whenever the stored value is missing or doesn't match. (Still
// front-end only — see the Module Unlock security debt note in MASTER.md / P-UX1-SPEC.)
const UNLOCK_TOKEN = btoa(`fdmc-unlock:${MODULE_UNLOCK_HASH}:granted`);

export function isModuleUnlocked(): boolean {
  try {
    return safeStorage().getItem(MODULE_LOCK_KEY) === UNLOCK_TOKEN;
  } catch {
    return false;
  }
}

export function unlockModule(code: string): boolean {
  if (btoa(code.trim()) === MODULE_UNLOCK_HASH) {
    try { safeStorage().setItem(MODULE_LOCK_KEY, UNLOCK_TOKEN); } catch { /* ok */ }
    return true;
  }
  return false;
}

export function lockModule(): void {
  try { safeStorage().removeItem(MODULE_LOCK_KEY); } catch { /* ok */ }
}

/**
 * React hook wrapping the unlock state + snap-back watcher. If the stored unlock flag
 * is cleared or tampered (e.g. someone pokes localStorage in the console), the UI
 * re-locks until the correct code is entered again. Front-end soft gate only.
 */
export function useModuleUnlock() {
  const [unlocked, setUnlocked] = useState(() => isModuleUnlocked());

  useEffect(() => {
    if (!unlocked) return;
    function revalidate() { if (!isModuleUnlocked()) setUnlocked(false); }
    window.addEventListener("storage", revalidate);
    const interval = window.setInterval(revalidate, 2000);
    return () => { window.removeEventListener("storage", revalidate); window.clearInterval(interval); };
  }, [unlocked]);

  return {
    unlocked,
    /** Try a code; returns whether it succeeded. Updates local state on success. */
    unlock: (code: string): boolean => {
      const ok = unlockModule(code);
      if (ok) setUnlocked(true);
      return ok;
    },
    /** Re-lock the campaign library. */
    lock: () => { lockModule(); setUnlocked(false); },
  };
}

/**
 * Inline unlock card — embedded inside the Broken Chain section of a library panel
 * (NOT a full-screen wall). My Library stays visible above it; this only unlocks the
 * bundled campaign content. Includes the placeholder Patreon path.
 */
export function ModuleUnlockPrompt({ onUnlock, what = "encounters" }: {
  onUnlock: (code: string) => boolean;
  /** Noun for the unlock copy — "encounters" or "equipment". */
  what?: string;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [patreonNote, setPatreonNote] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (onUnlock(code)) {
      setCode("");
      setError("");
    } else {
      setError("Incorrect unlock code.");
      setCode("");
    }
  }

  return (
    <div style={{ background: "#161018", border: "1px solid #4a2a2a", borderLeft: "3px solid #c8472e", borderRadius: 8, padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <p style={{ margin: "0 0 2px", fontSize: 10, color: "#c8472e", textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>🔒 Locked — Campaign Module</p>
        <h4 style={{ margin: "0 0 4px", fontSize: 15 }}>The Broken Chain</h4>
        <p style={{ margin: 0, fontSize: 11, color: "#888", lineHeight: 1.5 }}>
          Your own creations are always available above. Enter the demo unlock code to load
          this module's bundled {what}.
        </p>
      </div>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 6 }}>
        <input
          type="password"
          value={code}
          onChange={e => { setCode(e.target.value); setError(""); }}
          placeholder="Unlock code"
          style={{ flex: 1, padding: "7px 10px", borderRadius: 6, border: "1px solid #444", background: "#111", color: "#fff", fontSize: 13 }}
        />
        <button type="submit" style={{ padding: "7px 16px", background: "#7b68ee", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
          Unlock
        </button>
      </form>
      {error && <p style={{ margin: 0, fontSize: 12, color: "#ff9999" }}>{error}</p>}

      {/* Future unlock path — Patreon (placeholder; no real entitlement yet) */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <button
          type="button"
          onClick={() => setPatreonNote(true)}
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "8px 16px", background: "#FF424D", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600 }}
          title="Unlock this module through Patreon (coming soon)"
        >
          <span aria-hidden style={{ fontWeight: 800 }}>ⓟ</span> Unlock with Patreon
        </button>
        {patreonNote && (
          <p style={{ margin: 0, fontSize: 11, color: "#FFb0b4", lineHeight: 1.5 }}>
            Patreon unlock is coming soon. Supporting the campaign will auto-unlock its modules here.
            For now, enter the code above (ask your DM).
          </p>
        )}
      </div>
      <p style={{ margin: 0, fontSize: 10, color: "#444", lineHeight: 1.5 }}>
        Local demo gate — a soft unlock for this device, not secure content protection.
      </p>
    </div>
  );
}
