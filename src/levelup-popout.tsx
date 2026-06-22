/**
 * Level-Up Popout Entry Point
 *
 * Cold-boots from URL params: ?fdmLevelUp=<actorId>&seatId=<seatId>&seatColor=<hex>
 * Resolves the actor the same way the actor-card popout does (DM library → player
 * cache → bundled), then renders the full-size LevelUpWorkspace so the player isn't
 * cramped inside the combat popover.
 */

import React, { useMemo } from "react";
import OBR from "@owlbear-rodeo/sdk";
import ReactDOM from "react-dom/client";
import { LevelUpWorkspace } from "./core/ui/LevelUpWorkspace";
import { loadActorLibrary, loadActorOverrides, resolveActorFromLibrary } from "./core/seats/dmActorLibrary";
import { loadCachedActors } from "./core/seats/playerActorCache";
import { buildActorLibraryFromBundled } from "./core/table-state/actorHydrationBoundary";
import { brokenChainActors } from "./modules/the-broken-chain/actors/index";
import "./styles.css";

const params = new URLSearchParams(window.location.search);
const ACTOR_ID = params.get("fdmLevelUp") ?? "";
const SEAT_ID = params.get("seatId") ?? "";
const SEAT_COLOR = params.get("seatColor") ?? undefined;

function resolveActor(actorId: string) {
  if (!actorId) return undefined;

  const library = loadActorLibrary();
  const overrides = loadActorOverrides();
  if (library[actorId]) return resolveActorFromLibrary(actorId, library, overrides);

  const cached = loadCachedActors();
  const fromCache = cached.find(a => a.id === actorId);
  if (fromCache) return fromCache;

  const bundledLib = buildActorLibraryFromBundled(brokenChainActors);
  return bundledLib[actorId];
}

function LevelUpPopout() {
  const actor = useMemo(() => resolveActor(ACTOR_ID), []);

  if (!actor) {
    return (
      <div style={{ padding: 24, color: "#888" }}>
        <p>Actor not found: {ACTOR_ID || "(no id)"}</p>
        <p style={{ fontSize: 11 }}>Open this window from the ⬆ Level button on your character card.</p>
      </div>
    );
  }

  function handleClose() {
    if (OBR.isAvailable) void OBR.popover.close("fdm-levelup").catch(() => window.close());
    else window.close();
  }

  return (
    <div style={{ height: "100vh", overflow: "auto", background: "#0d0d14" }}>
      <LevelUpWorkspace actor={actor} seatId={SEAT_ID} seatColor={SEAT_COLOR} onClose={handleClose} />
    </div>
  );
}

function mount() {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <LevelUpPopout />
    </React.StrictMode>
  );
}

if (OBR.isAvailable) {
  OBR.onReady(mount);
} else {
  mount();
}
