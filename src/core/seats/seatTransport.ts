/**
 * A SEAT'S CHARACTERS HAVE TO ARRIVE, WHATEVER THEY WEIGH.
 *
 * Christopher, 2026-09-15: *"right now these version get a connecting to your seat and they never get
 * there"* — phones, tablets and a low-performance PC.
 *
 * The GM answered a seat claim with ONE broadcast carrying every character on the seat, sent with
 * `void OBR.broadcast.sendMessage(...)`. Owlbear caps a broadcast at 64KB, and a character sheet with its
 * tabs, spells, gear and bond is not small — two of them on a seat, plus the recent-event window, is
 * past the cap. The send was voided, so its rejection went nowhere: the GM saw nothing, and the player
 * waited on "Connecting to your seat…" for a message that had never left.
 *
 * Desktops hid it. A player who had joined before the sheets grew still had `fdmc.player.actorCache.v1`
 * and showed that copy under "syncing…". A fresh phone, tablet or PC has no cache, so it had nothing
 * to show at all. Same failure everywhere; only the clients without a fallback could see it.
 *
 *   one message    a payload that fits in SEAT_CHUNK_BYTES goes as the same `fdmc:actor-data` it always was
 *   chunks         anything larger is cut into `fdmc:actor-data-chunk` pieces the player reassembles
 *   one lane       each seat sends one transfer at a time and only its NEWEST pending payload — a slow
 *                  stale transfer cannot finish after a newer one and overwrite it
 *   reported       every send is awaited; a failure is returned with its size and reason, never voided
 */
import { isActorDataBroadcast, type ActorDataBroadcast } from "./seatTypes";

/** Owlbear's cap on a single broadcast message. */
const OBR_BROADCAST_LIMIT_BYTES = 64_000;
/** Room left under the cap for the envelope around a piece: type, seat, transfer id, index, count. */
const CHUNK_ENVELOPE_BYTES = 512;
/**
 * One message's budget for the data it carries. Well under the cap: the envelope, OBR's own framing,
 * and the JSON escaping a string of JSON picks up on the way (every `"` becomes `\"`) all land on top.
 */
export const SEAT_CHUNK_BYTES = 40_000;
/** A transfer that stops arriving is dropped after this long, so a dead one cannot pin memory. */
const TRANSFER_TTL_MS = 60_000;
/** More pieces than this is not a seat — it is a malformed or hostile message. */
const MAX_CHUNKS = 400;

export type ActorDataChunkBroadcast = {
  type: "fdmc:actor-data-chunk";
  seatId: string;
  transferId: string;
  index: number;
  count: number;
  part: string;
};

export function isActorDataChunkBroadcast(msg: unknown): msg is ActorDataChunkBroadcast {
  if (!msg || typeof msg !== "object") return false;
  const m = msg as Partial<ActorDataChunkBroadcast>;
  return m.type === "fdmc:actor-data-chunk"
    && typeof m.seatId === "string"
    && typeof m.transferId === "string"
    && typeof m.part === "string"
    && Number.isInteger(m.index) && Number.isInteger(m.count)
    && (m.count as number) > 0 && (m.count as number) <= MAX_CHUNKS
    && (m.index as number) >= 0 && (m.index as number) < (m.count as number);
}

const encoder = new TextEncoder();
/** The size a value takes on the wire, as JSON in UTF-8. */
export function wireBytes(value: unknown): number {
  return encoder.encode(JSON.stringify(value)).length;
}

export function newTransferId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Cut a string so every piece, sent as a JSON string, fits in `maxBytes`.
 *
 * Measured, not assumed: one character can be one byte or six once escaped, so a piece is shrunk until
 * its encoded size fits. It never cuts between the two halves of a surrogate pair — a lone half does not
 * survive UTF-8 and the reassembled JSON would not parse.
 */
export function splitForBroadcast(text: string, maxBytes = SEAT_CHUNK_BYTES): string[] {
  const parts: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(text.length, start + maxBytes);
    let size = wireBytes(text.slice(start, end));
    while (size > maxBytes && end - start > 1) {
      end = start + Math.max(1, Math.floor((end - start) * (maxBytes / size) * 0.97));
      size = wireBytes(text.slice(start, end));
    }
    const last = text.charCodeAt(end - 1);
    if (end < text.length && end - start > 1 && last >= 0xd800 && last <= 0xdbff) end -= 1;
    parts.push(text.slice(start, end));
    start = end;
  }
  return parts;
}

/** The messages one payload goes out as: itself when it fits, otherwise its chunks in order. */
export function planActorDataMessages(
  payload: ActorDataBroadcast,
  transferId: string = newTransferId(),
  maxBytes = SEAT_CHUNK_BYTES,
): Array<ActorDataBroadcast | ActorDataChunkBroadcast> {
  // No caller can ask for a piece Owlbear would refuse.
  const budget = Math.min(maxBytes, OBR_BROADCAST_LIMIT_BYTES - CHUNK_ENVELOPE_BYTES);
  const json = JSON.stringify(payload);
  if (encoder.encode(json).length <= budget) return [payload];
  const parts = splitForBroadcast(json, budget);
  return parts.map((part, index) => ({
    type: "fdmc:actor-data-chunk" as const,
    seatId: payload.seatId,
    transferId,
    index,
    count: parts.length,
    part,
  }));
}

export type SeatSendReport = {
  ok: boolean;
  seatId: string;
  bytes: number;
  messages: number;
  sent: number;
  error?: string;
};

export type BroadcastSend = (message: ActorDataBroadcast | ActorDataChunkBroadcast) => Promise<unknown>;

/** Send one payload, awaiting every message. A failed message is tried once more before it is reported. */
export async function sendActorData(
  send: BroadcastSend,
  payload: ActorDataBroadcast,
  transferId: string = newTransferId(),
): Promise<SeatSendReport> {
  const messages = planActorDataMessages(payload, transferId);
  const bytes = wireBytes(payload);
  for (let i = 0; i < messages.length; i++) {
    try {
      await send(messages[i]);
    } catch {
      try {
        await send(messages[i]);
      } catch (error) {
        return {
          ok: false, seatId: payload.seatId, bytes, messages: messages.length, sent: i,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  }
  return { ok: true, seatId: payload.seatId, bytes, messages: messages.length, sent: messages.length };
}

/**
 * One lane per seat. A push while that seat is still sending REPLACES whatever was waiting — only the
 * newest state is worth sending — and starts as soon as the current transfer finishes.
 */
export function createSeatSendLanes(
  sendOne: (payload: ActorDataBroadcast) => Promise<SeatSendReport>,
  onReport?: (report: SeatSendReport) => void,
) {
  const lanes = new Map<string, { running: boolean; next?: ActorDataBroadcast }>();
  return function push(payload: ActorDataBroadcast): void {
    let lane = lanes.get(payload.seatId);
    if (!lane) { lane = { running: false }; lanes.set(payload.seatId, lane); }
    lane.next = payload;
    if (lane.running) return;
    lane.running = true;
    const run = lane;
    void (async () => {
      try {
        while (run.next) {
          const current = run.next;
          run.next = undefined;
          const report = await sendOne(current).catch((error: unknown): SeatSendReport => ({
            ok: false, seatId: current.seatId, bytes: 0, messages: 0, sent: 0,
            error: error instanceof Error ? error.message : String(error),
          }));
          onReport?.(report);
        }
      } finally {
        run.running = false;
      }
    })();
  };
}

export type AssembleResult = {
  /** The whole payload, once its last piece is in. */
  payload?: ActorDataBroadcast;
  received: number;
  count: number;
  error?: string;
};

/** The player's half: collects pieces by transfer and hands back the payload when it is whole. */
export function createActorDataAssembler(now: () => number = () => Date.now()) {
  const transfers = new Map<string, { seatId: string; count: number; parts: Array<string | undefined>; received: number; touchedAt: number }>();
  return {
    accept(msg: ActorDataChunkBroadcast): AssembleResult {
      const t0 = now();
      for (const [id, t] of transfers) if (t0 - t.touchedAt > TRANSFER_TTL_MS) transfers.delete(id);

      const key = `${msg.seatId}:${msg.transferId}`;
      let transfer = transfers.get(key);
      if (!transfer || transfer.count !== msg.count) {
        transfer = { seatId: msg.seatId, count: msg.count, parts: new Array(msg.count), received: 0, touchedAt: t0 };
        transfers.set(key, transfer);
      }
      transfer.touchedAt = t0;
      if (transfer.parts[msg.index] === undefined) {
        transfer.parts[msg.index] = msg.part;
        transfer.received += 1;
      }
      if (transfer.received < transfer.count) return { received: transfer.received, count: transfer.count };

      transfers.delete(key);
      try {
        const parsed: unknown = JSON.parse(transfer.parts.join(""));
        if (isActorDataBroadcast(parsed) && parsed.seatId === msg.seatId && Array.isArray(parsed.actors)) {
          return { payload: parsed, received: transfer.received, count: transfer.count };
        }
        return { received: transfer.received, count: transfer.count, error: "the reassembled message is not this seat's character data" };
      } catch (error) {
        return { received: transfer.received, count: transfer.count, error: `the reassembled message did not parse: ${error instanceof Error ? error.message : String(error)}` };
      }
    },
    /** Pieces still outstanding, for a progress line. */
    pending(seatId: string): { received: number; count: number } | undefined {
      let best: { received: number; count: number } | undefined;
      for (const t of transfers.values()) {
        if (t.seatId !== seatId) continue;
        if (!best || t.received / t.count > best.received / best.count) best = { received: t.received, count: t.count };
      }
      return best;
    },
  };
}
