/**
 * OBR readiness guard
 *
 * OBR.isAvailable = SDK is present (running inside OBR)
 * OBR.isReady     = SDK has completed handshake with OBR parent window
 *
 * Both must be true before any OBR calls fire.
 * Use obrSend() instead of OBR.broadcast.sendMessage() directly to avoid
 * "Unable to send message: not ready" errors during the startup window.
 */

import OBR from "@owlbear-rodeo/sdk";

export function isObrReady(): boolean {
  return OBR.isAvailable && OBR.isReady;
}

export async function obrSend(
  channel: string,
  data: unknown,
  options?: { destination: "LOCAL" | "REMOTE" | "ALL" }
): Promise<void> {
  if (!isObrReady()) return;
  try {
    await OBR.broadcast.sendMessage(channel, data, options ?? { destination: "REMOTE" });
  } catch {
    // Swallow — transient not-ready during OBR reconnect
  }
}
