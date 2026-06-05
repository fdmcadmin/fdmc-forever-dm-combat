import type { Actor } from "../types/actor";

// ─── Storage key ──────────────────────────────────────────────────────────────

const PLAYER_ACTOR_CACHE_KEY = "fdmc.player.actorCache.v1";

// ─── Cache operations ─────────────────────────────────────────────────────────

export function loadCachedActors(): Actor[] {
  try {
    const raw = window.localStorage.getItem(PLAYER_ACTOR_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Record<string, Actor>;
    return Object.values(parsed);
  } catch {
    return [];
  }
}

export function loadCachedActorMap(): Record<string, Actor> {
  try {
    const raw = window.localStorage.getItem(PLAYER_ACTOR_CACHE_KEY);
    return raw ? JSON.parse(raw) as Record<string, Actor> : {};
  } catch {
    return {};
  }
}

export function cacheActors(actors: Actor[]): void {
  try {
    const existing = loadCachedActorMap();
    for (const actor of actors) {
      existing[actor.id] = actor;
    }
    window.localStorage.setItem(PLAYER_ACTOR_CACHE_KEY, JSON.stringify(existing));
  } catch {
    // localStorage unavailable
  }
}

export function getCachedActor(actorId: string): Actor | undefined {
  return loadCachedActorMap()[actorId];
}

export function clearCache(): void {
  try {
    window.localStorage.removeItem(PLAYER_ACTOR_CACHE_KEY);
  } catch {
    // localStorage unavailable
  }
}
