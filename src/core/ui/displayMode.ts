/**
 * FULL OR LITE — A MODE FOR THE DEVICE THE TABLE IS ACTUALLY ON.
 *
 * Christopher, 2026-09-15: *"we have to fix something for low performance pc that could default to the
 * table and mobile version (if the app doesnt have different modes for it like the OBR has it needs to be
 * added) so a fall back for low performance and both mobile and tablet."*
 *
 * FDMC had one mode, built for a desktop GM: every character card opens as its own Owlbear popover — a
 * second iframe that loads the whole app again and does its own handshake with Owlbear — and panels sit
 * on blurred glass. On a phone, a tablet or a weak PC that is the expensive path twice over.
 *
 *   full   the desktop layout, unchanged
 *   lite   one window: a character card opens INSIDE the extension window instead of a second popover;
 *          no backdrop blur, transitions or animation; taps do not wait for a double-tap zoom
 *
 * The player picks Auto, Full or Lite. Auto chooses Lite for a phone, a tablet or a low-power device —
 * and says which of those it saw, so a wrong guess is visible and one tap undoes it. A PC that is merely
 * SLOW to start is offered Lite rather than switched to it (see `slowStartup`).
 *
 * ⚠ THE ONE-WINDOW CARD IS A PLAYER BEHAVIOUR. The GM's desktop workflow — cards as popovers beside the
 * map — is unchanged in either mode; Lite gives a GM window only the lighter styling.
 */
import { safeStorage } from "../utils/safeStorage";

export type DisplayModeChoice = "auto" | "full" | "lite";
export type DisplayMode = "full" | "lite";
export type DeviceKind = "phone" | "tablet" | "desktop";

export const DISPLAY_MODE_STORAGE_KEY = "fdmc.displayMode.v1";
export const DISPLAY_MODE_ATTRIBUTE = "data-fdmc-display";

export type DeviceSignals = {
  userAgent: string;
  /** `navigator.userAgentData.mobile` where the browser reports it. */
  uaMobile?: boolean;
  maxTouchPoints: number;
  /** The primary pointer is a finger, and no mouse or pen is present. */
  touchOnly: boolean;
  /** The shorter side of the screen, CSS pixels. */
  screenShortSide: number;
  hardwareConcurrency?: number;
  /** `navigator.deviceMemory`, GiB — Chromium only, and capped at 8. */
  deviceMemory?: number;
  saveData?: boolean;
  /** Milliseconds from navigation to the app's first render. */
  startupMs?: number;
};

export type DeviceProfile = {
  kind: DeviceKind;
  lowPower: boolean;
  /** Plain words for what was seen, shown beside the mode. */
  reasons: string[];
  /**
   * The app was slow to reach the screen. A HINT, never a switch: a slow room load or a slow network looks
   * the same from here, and flipping a capable desktop into Lite on a bad connection would be a surprise.
   */
  slowStartup: boolean;
};

/** Four GiB or less is the memory a weak laptop or an older tablet reports. */
const LOW_MEMORY_GIB = 4;
/** Two logical cores or fewer. */
const LOW_CORES = 2;
/** A device this slow to get the app on screen will be slow to run it. */
const SLOW_STARTUP_MS = 10_000;
/** Below this short side a touch-only screen is a phone; at or above it, a tablet. */
const TABLET_SHORT_SIDE = 600;

export function profileDevice(s: DeviceSignals): DeviceProfile {
  const ua = s.userAgent;
  const reasons: string[] = [];

  const iPadDesktopUa = /Macintosh/.test(ua) && s.maxTouchPoints > 1;   // iPadOS reports a Mac
  const tabletUa = /iPad|Tablet|PlayBook|Silk|Kindle/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua)) || iPadDesktopUa;
  const phoneUa = /iPhone|iPod|Windows Phone|IEMobile|BlackBerry|Opera Mini/i.test(ua) || (/Android/i.test(ua) && /Mobile/i.test(ua));

  let kind: DeviceKind = "desktop";
  if (tabletUa) kind = "tablet";
  else if (phoneUa || s.uaMobile) kind = "phone";
  else if (s.touchOnly) kind = s.screenShortSide >= TABLET_SHORT_SIDE ? "tablet" : "phone";
  if (kind !== "desktop") reasons.push(kind);

  let lowPower = false;
  if (s.saveData) { lowPower = true; reasons.push("data saver on"); }
  if (s.deviceMemory !== undefined && s.deviceMemory <= LOW_MEMORY_GIB) { lowPower = true; reasons.push(`${s.deviceMemory} GB memory`); }
  if (s.hardwareConcurrency !== undefined && s.hardwareConcurrency <= LOW_CORES) { lowPower = true; reasons.push(`${s.hardwareConcurrency} CPU cores`); }
  const slowStartup = s.startupMs !== undefined && s.startupMs >= SLOW_STARTUP_MS;

  return { kind, lowPower, reasons, slowStartup };
}

export function resolveDisplayMode(choice: DisplayModeChoice, profile: DeviceProfile): DisplayMode {
  if (choice === "full" || choice === "lite") return choice;
  return profile.kind !== "desktop" || profile.lowPower ? "lite" : "full";
}

export function readDeviceSignals(startupMs?: number): DeviceSignals {
  const nav = (typeof navigator === "undefined" ? {} : navigator) as Navigator & {
    userAgentData?: { mobile?: boolean };
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  const media = (query: string) => {
    try { return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(query).matches; }
    catch { return false; }
  };
  const screenShortSide = typeof window !== "undefined" && window.screen
    ? Math.min(window.screen.width || 0, window.screen.height || 0)
    : 0;
  return {
    userAgent: nav.userAgent ?? "",
    uaMobile: nav.userAgentData?.mobile,
    maxTouchPoints: nav.maxTouchPoints ?? 0,
    touchOnly: media("(pointer: coarse)") && !media("(any-pointer: fine)"),
    screenShortSide,
    hardwareConcurrency: nav.hardwareConcurrency || undefined,
    deviceMemory: nav.deviceMemory,
    saveData: nav.connection?.saveData,
    startupMs,
  };
}

export function loadDisplayModeChoice(): DisplayModeChoice {
  let raw: string | null | undefined;
  try {
    raw = safeStorage().getItem(DISPLAY_MODE_STORAGE_KEY);
  } catch { /* fall through to the loading screen's copy */ }
  if (raw === "full" || raw === "lite") return raw;
  /**
   * The loading screen in index.html (shown before any of the app has downloaded) also keeps its choice on
   * `window`, for a browser whose every store refused the write — a choice made there must still hold here.
   */
  const boot = typeof window !== "undefined" ? (window as { __fdmcBootDisplayChoice?: unknown }).__fdmcBootDisplayChoice : undefined;
  return boot === "full" || boot === "lite" ? boot : "auto";
}

export function saveDisplayModeChoice(choice: DisplayModeChoice): void {
  try {
    if (choice === "auto") safeStorage().removeItem(DISPLAY_MODE_STORAGE_KEY);
    else safeStorage().setItem(DISPLAY_MODE_STORAGE_KEY, choice);
  } catch { /* storage blocked — the choice lasts for this window */ }
}

/** Stamp the mode on the root element, where the lite stylesheet rules key off it. */
export function applyDisplayMode(mode: DisplayMode): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute(DISPLAY_MODE_ATTRIBUTE, mode);
}

/**
 * For the secondary windows (popouts, tracker, DM panel): read the stored choice and stamp it before
 * anything renders. Detection reads only the device, so the same device gives every window the same answer.
 */
export function applyStoredDisplayMode(): DisplayMode {
  const mode = resolveDisplayMode(loadDisplayModeChoice(), profileDevice(readDeviceSignals()));
  applyDisplayMode(mode);
  return mode;
}

/** Auto → Full → Lite → Auto, for a single cycling control. */
export function nextDisplayModeChoice(choice: DisplayModeChoice): DisplayModeChoice {
  return choice === "auto" ? "full" : choice === "full" ? "lite" : "auto";
}

export function describeDisplayMode(choice: DisplayModeChoice, mode: DisplayMode, profile: DeviceProfile): string {
  const name = mode === "lite" ? "Lite" : "Full";
  if (choice !== "auto") return `${name} (chosen)`;
  return profile.reasons.length ? `Auto: ${name} (${profile.reasons.join(", ")})` : `Auto: ${name}`;
}
