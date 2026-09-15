import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DISPLAY_MODE_STORAGE_KEY,
  applyDisplayMode,
  describeDisplayMode,
  loadDisplayModeChoice,
  nextDisplayModeChoice,
  profileDevice,
  readDeviceSignals,
  resolveDisplayMode,
  saveDisplayModeChoice,
  type DeviceProfile,
  type DisplayMode,
  type DisplayModeChoice,
} from "./displayMode";

export type DisplayModeState = {
  choice: DisplayModeChoice;
  mode: DisplayMode;
  profile: DeviceProfile;
  label: string;
  cycle: () => void;
};

/** The main window's display mode — see `displayMode.ts`. */
export function useDisplayMode(): DisplayModeState {
  // Time since navigation at the first render: how long this device took to get the app on screen.
  const [startupMs] = useState(() => (typeof performance !== "undefined" ? performance.now() : undefined));
  const profile = useMemo(() => profileDevice(readDeviceSignals(startupMs)), [startupMs]);
  const [choice, setChoice] = useState<DisplayModeChoice>(loadDisplayModeChoice);
  const mode = resolveDisplayMode(choice, profile);

  useEffect(() => { applyDisplayMode(mode); }, [mode]);

  // A choice made in another FDMC window on this device applies here too.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === DISPLAY_MODE_STORAGE_KEY) setChoice(loadDisplayModeChoice());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const cycle = useCallback(() => {
    setChoice(current => {
      const next = nextDisplayModeChoice(current);
      saveDisplayModeChoice(next);
      return next;
    });
  }, []);

  return { choice, mode, profile, label: describeDisplayMode(choice, mode, profile), cycle };
}

/** One control: tap to go Auto → Full → Lite. It always says what it is showing and why. */
export function DisplayModeToggle({ state, compact = false }: { state: DisplayModeState; compact?: boolean }) {
  const offerLite = state.choice === "auto" && state.mode === "full" && state.profile.slowStartup;
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", alignItems: compact ? "flex-end" : "center", gap: 2 }}>
      <button
        type="button"
        onClick={state.cycle}
        data-fdmc-display-toggle={state.choice}
        title={"Display mode — tap to switch Auto → Full → Lite.\n"
          + "Full: character cards open in their own window beside the map.\n"
          + "Lite: one window, lighter styling — for phones, tablets and slower PCs.\n"
          + "Auto picks Lite on a phone, a tablet or a low-power device."}
        style={{ fontSize: compact ? 10 : 11, padding: compact ? "1px 6px" : "3px 10px", background: "transparent", border: `1px solid ${state.mode === "lite" ? "#d7b36a55" : "#333"}`, borderRadius: 3, color: state.mode === "lite" ? "#d7b36a" : "#777", cursor: "pointer" }}
      >
        {compact ? (state.mode === "lite" ? "◐ Lite" : "● Full") : `Display: ${state.label}`}
      </button>
      {offerLite && !compact && (
        <span style={{ fontSize: 10, color: "#8a7a50" }}>This device was slow to start FDMC — Lite may run better.</span>
      )}
    </span>
  );
}
