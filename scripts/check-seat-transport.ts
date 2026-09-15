/**
 * A SEAT'S CHARACTERS ARRIVE ON EVERY DEVICE, AND A DEVICE GETS THE MODE IT CAN RUN.
 *   npx tsx scripts/check-seat-transport.ts
 *
 * Christopher, 2026-09-15: *"we have to fix something for low performance pc that could default to the
 * table and mobile version [...] because right now these version get a connecting to your seat and they
 * never get there."*
 *
 * The GM answered a seat claim with one broadcast holding every character on the seat. Owlbear caps a
 * broadcast at 64KB; past it the send rejects, and the rejection was voided. Desktops that had joined
 * before the sheets grew showed their cached copy; a fresh phone, tablet or PC had nothing and waited.
 *
 *   1  a payload that fits is still ONE message, unchanged — nothing about a small seat moved
 *   2  a payload past the cap goes as pieces, every one under the cap, and reassembles exactly
 *   3  the cut is measured: escape-heavy text and surrogate pairs survive it
 *   4  the player's assembler: out of order, duplicated, interleaved, damaged
 *   5  sends are awaited and retried, and a seat's newest push is never overtaken by an older one
 *   6  the wiring: GM sends through the lanes, only the GM answers, the player reassembles and re-asks
 *   7  display mode: phones, tablets and low-power devices get Lite; a choice always wins
 *   8  the wiring: Lite opens a player's card in the one window, and every window stamps the mode
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { ActorDataBroadcast } from "../src/core/seats/seatTypes";
import type { Actor } from "../src/core/types/actor";
import {
  SEAT_CHUNK_BYTES,
  createActorDataAssembler,
  createSeatSendLanes,
  isActorDataChunkBroadcast,
  planActorDataMessages,
  sendActorData,
  splitForBroadcast,
  wireBytes,
  type ActorDataChunkBroadcast,
  type SeatSendReport,
} from "../src/core/seats/seatTransport";
import {
  describeDisplayMode,
  nextDisplayModeChoice,
  profileDevice,
  resolveDisplayMode,
  type DeviceSignals,
} from "../src/core/ui/displayMode";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
/**
 * Owlbear's cap on one broadcast, written here rather than imported: a gate that read the limit from the
 * code it checks would pass whatever the code said the limit was.
 */
const OBR_BROADCAST_LIMIT_BYTES = 64_000;
let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");
const codeOf = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

/**
 * A synthetic character of a real sheet's shape. The live library is in the GM's browser and the export
 * is gitignored, so the size is built, not read: the 2026-08-24 export measured 10–12KB a character, and
 * sheets have only grown since. `rows` sets the weight.
 */
function syntheticActor(id: string, rows: number, flavour = "Deals 2d6 slashing damage on a hit."): Actor {
  const row = (i: number) => ({
    id: `${id}-action-${i}`,
    label: `Action ${i}`,
    description: `${flavour} On a failed DC 15 Constitution save the target is "Poisoned" until the end of its next turn.`,
    economyCost: ["main"],
    damage: [{ dice: "2d6", type: "slashing" }],
  });
  return {
    id, name: id, kind: "player",
    stats: { hp: { current: 40, max: 40, temp: 0 }, ac: 16 },
    tabs: { main: Array.from({ length: rows }, (_, i) => row(i)), spells: Array.from({ length: rows }, (_, i) => row(i + rows)) },
  } as unknown as Actor;
}
const seatPayload = (actors: Actor[], seatId = "seat-2"): ActorDataBroadcast => ({ type: "fdmc:actor-data", seatId, actors, recentEventWindow: [] });
const shuffled = <T,>(items: T[]): T[] => items.map((v, i) => [((i * 7919) % 101) / 101, v] as const).sort((a, b) => a[0] - b[0]).map(([, v]) => v);
/** Every message a real send would hand to Owlbear is under its cap. */
const allUnderCap = (messages: unknown[]) => messages.every(m => wireBytes(m) < OBR_BROADCAST_LIMIT_BYTES);

console.log("A seat's characters arrive whatever they weigh\n");

console.log("1. a seat that fits is one message, exactly as before");
{
  const small = seatPayload([syntheticActor("lyrielle", 4)]);
  const plan = planActorDataMessages(small, "t1");
  ok("one message", plan.length === 1, `${plan.length}, ${wireBytes(small)} bytes`);
  ok("...and it IS the payload, not a wrapper", plan[0] === small);
}

console.log("\n2. a seat past the cap goes in pieces, each under it, and comes back whole");
{
  const heavy = seatPayload([syntheticActor("lyrielle", 180), syntheticActor("bonded-companion", 120)]);
  const bytes = wireBytes(heavy);
  ok("the fixture really is past Owlbear's cap — else this section proves nothing", bytes > OBR_BROADCAST_LIMIT_BYTES, `${bytes} bytes`);
  /** ⚠ The old path, as a mutation: one message for the whole seat. It must be caught. */
  ok("MUTATION: sending the seat as one message breaks the cap", !allUnderCap([heavy]));

  const plan = planActorDataMessages(heavy, "t2");
  ok("more than one message", plan.length > 1, `${plan.length} messages`);
  ok("every message is a chunk", plan.every(isActorDataChunkBroadcast));
  ok("every message is under the cap", allUnderCap(plan), plan.map(m => wireBytes(m)).join(", "));
  ok("every chunk's text is within its budget", plan.every(m => wireBytes((m as ActorDataChunkBroadcast).part) <= SEAT_CHUNK_BYTES));

  const assembler = createActorDataAssembler();
  let whole: ActorDataBroadcast | undefined;
  for (const m of shuffled(plan as ActorDataChunkBroadcast[])) whole = assembler.accept(m).payload ?? whole;
  ok("reassembled out of order, it is the same seat, byte for byte", JSON.stringify(whole) === JSON.stringify(heavy));
}

console.log("\n3. the cut is measured, not assumed");
{
  // Every quote and backslash doubles when a string of JSON is itself sent as JSON.
  const escapey = seatPayload([syntheticActor("quoted", 140, `He said "\\\\ \\" \t\n" — ${"\"".repeat(40)}`)]);
  const plan = planActorDataMessages(escapey, "t3");
  ok("escape-heavy text: every message still under the cap", allUnderCap(plan), plan.map(m => wireBytes(m)).join(", "));

  // Four-byte characters, each two UTF-16 units: a cut between them would not survive.
  const emoji = "🐉🗡️🛡️🔥".repeat(9000);
  const parts = splitForBroadcast(emoji, 4_000);
  const orphanEnd = parts.slice(0, -1).some(p => { const c = p.charCodeAt(p.length - 1); return c >= 0xd800 && c <= 0xdbff; });
  ok("no piece ends on half of a surrogate pair", !orphanEnd, `${parts.length} pieces`);
  ok("...every piece within its budget", parts.every(p => wireBytes(p) <= 4_000));
  ok("...and they join back to the original", parts.join("") === emoji);
}

console.log("\n4. the player's assembler");
{
  const a = seatPayload([syntheticActor("ash", 160)], "seat-3");
  const b = seatPayload([syntheticActor("king", 170)], "seat-3");
  const planA = planActorDataMessages(a, "ta") as ActorDataChunkBroadcast[];
  const planB = planActorDataMessages(b, "tb") as ActorDataChunkBroadcast[];
  const assembler = createActorDataAssembler();

  const first = assembler.accept(planA[0]);
  const again = assembler.accept(planA[0]);
  ok("a duplicated piece is not counted twice", first.received === 1 && again.received === 1);
  ok("progress reports pieces in and pieces expected", again.count === planA.length);

  const done: ActorDataBroadcast[] = [];
  const interleaved = planA.slice(1).flatMap((m, i) => (planB[i] ? [m, planB[i]] : [m])).concat(planB.slice(planA.length - 1));
  for (const m of interleaved) { const r = assembler.accept(m); if (r.payload) done.push(r.payload); }
  ok("two transfers interleaved both complete", done.length === 2, String(done.length));
  ok("...each as itself", done.some(p => p.actors[0]?.id === "ash") && done.some(p => p.actors[0]?.id === "king"));

  // A piece relabelled for another seat is not that seat's data.
  const forged = createActorDataAssembler();
  let forgedResult: ReturnType<typeof forged.accept> | undefined;
  for (const m of planA) forgedResult = forged.accept({ ...m, seatId: "seat-9" });
  ok("reassembled data for a different seat is refused", !forgedResult?.payload && Boolean(forgedResult?.error));

  const damaged = createActorDataAssembler();
  let damagedResult: ReturnType<typeof damaged.accept> | undefined;
  for (const m of planA) damagedResult = damaged.accept(m.index === 0 ? { ...m, part: m.part.slice(5) } : m);
  ok("a damaged transfer reports an error instead of applying", !damagedResult?.payload && /did not parse/.test(damagedResult?.error ?? ""));

  ok("the guard refuses a piece with no count", !isActorDataChunkBroadcast({ ...planA[0], count: 0 }));
  ok("...and an index past the count", !isActorDataChunkBroadcast({ ...planA[0], index: planA[0].count }));
  ok("...and a piece that is not text", !isActorDataChunkBroadcast({ ...planA[0], part: 12 }));
}

console.log("\n5. sends are awaited, retried, reported — and never overtaken");
await (async () => {
  const heavy = seatPayload([syntheticActor("lyrielle", 180)]);
  const count = planActorDataMessages(heavy, "x").length;

  const sent: number[] = [];
  let failedOnce = false;
  const flaky = async (m: unknown) => {
    const i = (m as ActorDataChunkBroadcast).index;
    if (i === 1 && !failedOnce) { failedOnce = true; throw new Error("Message OBR_BROADCAST_SEND_MESSAGE took longer than 5000ms"); }
    sent.push(i);
  };
  const report = await sendActorData(flaky, heavy, "r1");
  ok("one failed message is tried again and the send completes", report.ok && report.sent === count, JSON.stringify(report));
  ok("...in order", sent.join(",") === Array.from({ length: count }, (_, i) => i).join(","));

  const dead = await sendActorData(async (m) => { if ((m as ActorDataChunkBroadcast).index === 2) throw new Error("payload too large"); }, heavy, "r2");
  ok("a message that fails twice is REPORTED, with where it stopped and why",
    !dead.ok && dead.sent === 2 && dead.error === "payload too large" && dead.bytes === wireBytes(heavy), JSON.stringify(dead));

  // Lanes: a slow first transfer, then three pushes while it runs. Only the newest of those follows it.
  const order: string[] = [];
  const reports: SeatSendReport[] = [];
  let release: () => void = () => undefined;
  const gate = new Promise<void>(r => { release = r; });
  const push = createSeatSendLanes(async (p) => {
    order.push(p.actors[0].id);
    if (order.length === 1) await gate;
    return { ok: true, seatId: p.seatId, bytes: 0, messages: 1, sent: 1 };
  }, r => reports.push(r));
  push(seatPayload([syntheticActor("v1", 1)]));
  push(seatPayload([syntheticActor("v2", 1)]));
  push(seatPayload([syntheticActor("v3", 1)]));
  push(seatPayload([syntheticActor("v4", 1)]));
  push(seatPayload([syntheticActor("other-seat", 1)], "seat-5"));
  release();
  await new Promise(r => setTimeout(r, 20));
  ok("a push while the seat is sending waits, and only the NEWEST waiting push goes", order.filter(id => id !== "other-seat").join(",") === "v1,v4", order.join(","));
  ok("...another seat is its own lane and is not held behind it", order.includes("other-seat"));
  ok("...every send is reported", reports.length === 3, String(reports.length));
})();

console.log("\n6. the wiring");
{
  const seats = codeOf("src/core/seats/useSeatSystem.ts");
  ok("no seat data is sent with a voided single broadcast any more",
    !/void OBR\.broadcast\.sendMessage\(FDMC_SEAT_BROADCAST_CHANNEL, payload/.test(seats));
  ok("the GM's claim answer goes through the lanes", /seatLanes\(payload\);\s*\}\)\(\);/.test(seats));
  ok("...and so does a push", (seats.match(/seatLanes\(payload\)/g) ?? []).length >= 3);
  ok("the lanes send with sendActorData and log a failed send", /createSeatSendLanes\([\s\S]{0,200}sendActorData\(/.test(seats) && /console\.warn\(`\[FDMC seats\]/.test(seats));
  ok("only a GM window answers a claim", /isSeatClaimBroadcast\(msg\) \|\| isActorDataRequestBroadcast\(msg\)\) void \(async \(\) => \{[\s\S]{0,120}if \(!\(await isGmWindow\(\)\)\) return;/.test(seats));
  ok("...and the room's copy of the seat is used when this browser lacks it",
    /seatsRef\.current\[seatId\] \?\? liveStateRef\.current\.seats\?\.\[seatId\]/.test(seats));
  ok("...but a seat known only from the room is pushed by the GM alone",
    /if \(localSeat\) seatLanes\(payload\);\s*else void isGmWindow\(\)\.then/.test(seats));
  ok("the player reassembles pieces addressed to its seat",
    /isActorDataChunkBroadcast\(msg\) && msg\.seatId === claimedRef\.current/.test(seats) && /assemblerRef\.current\.accept\(msg\)/.test(seats));
  ok("the player re-asks while claiming",
    /if \(seatStatus !== "claiming"[\s\S]{0,700}"fdmc:actor-data-request"/.test(seats));
  ok("...and says what is wrong after the unanswered requests", /unanswered >= SEAT_PROBLEM_AFTER_ATTEMPTS/.test(seats));
  ok("...counting a chunk as progress, so a slow transfer is not restarted",
    /isActorDataChunkBroadcast\(msg\)[\s\S]{0,80}lastProgressRef\.current = Date\.now\(\)/.test(seats));

  const popout = codeOf("src/actor-popout.tsx");
  ok("the character popout reassembles pieces too", /isActorDataChunkBroadcast\(event\.data\) \? assembler\.accept\(event\.data\)\.payload/.test(popout));

  const app = codeOf("src/App.tsx");
  ok("the claim screen shows the problem", /\{seatSync\.problem && \(/.test(app));
  ok("...the transfer's progress", /Receiving your characters… \$\{seatSync\.receiving\.received\} of \$\{seatSync\.receiving\.count\}/.test(app));
  ok("...and a way out to another seat", /seatStatus === "claiming" \? \([\s\S]{0,2600}onClick=\{releaseSeat\}/.test(app));
}

console.log("\n7. display mode");
{
  const desktop: DeviceSignals = { userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0", maxTouchPoints: 0, touchOnly: false, screenShortSide: 1080, hardwareConcurrency: 8, deviceMemory: 8 };
  const mode = (s: Partial<DeviceSignals>, choice: "auto" | "full" | "lite" = "auto") => resolveDisplayMode(choice, profileDevice({ ...desktop, ...s }));

  ok("a capable desktop is Full", mode({}) === "full");
  ok("an iPhone is a phone, and Lite",
    profileDevice({ ...desktop, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Mobile/15E148 Safari/604.1", maxTouchPoints: 5, touchOnly: true, screenShortSide: 390 }).kind === "phone"
    && mode({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Mobile/15E148 Safari/604.1" }) === "lite");
  ok("an Android phone is a phone", profileDevice({ ...desktop, userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/128.0 Mobile Safari/537.36" }).kind === "phone");
  ok("an Android tablet is a tablet", profileDevice({ ...desktop, userAgent: "Mozilla/5.0 (Linux; Android 13; SM-X710) Chrome/128.0 Safari/537.36" }).kind === "tablet");
  /** ⚠ iPadOS asks for desktop sites and reports itself as a Mac. Touch points give it away. */
  ok("an iPad reporting a Mac is still a tablet",
    profileDevice({ ...desktop, userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15", maxTouchPoints: 5 }).kind === "tablet");
  ok("...while a real Mac is a desktop", profileDevice({ ...desktop, userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15", maxTouchPoints: 0 }).kind === "desktop");
  ok("a touch-only large screen with an unknown UA is a tablet", profileDevice({ ...desktop, userAgent: "Mozilla/5.0 (X11; Linux x86_64)", touchOnly: true, screenShortSide: 800 }).kind === "tablet");
  ok("a PC with 4 GB of memory is Lite", mode({ deviceMemory: 4 }) === "lite");
  ok("a PC with 2 cores is Lite", mode({ hardwareConcurrency: 2 }) === "lite");
  ok("data saver is Lite", mode({ saveData: true }) === "lite");
  ok("a 4-core, 8 GB PC is Full — ordinary is not low-power", mode({ hardwareConcurrency: 4, deviceMemory: 8 }) === "full");
  /** ⚠ A slow START is a hint, not a switch: a slow room load looks the same from inside the iframe. */
  const slow = profileDevice({ ...desktop, startupMs: 14_000 });
  ok("a slow start on a capable PC offers Lite but stays Full", slow.slowStartup && resolveDisplayMode("auto", slow) === "full");
  ok("a choice of Full wins on a phone", mode({ userAgent: "iPhone Mobile", touchOnly: true, screenShortSide: 390 }, "full") === "full");
  ok("a choice of Lite wins on a desktop", mode({}, "lite") === "lite");
  ok("the control cycles Auto → Full → Lite → Auto",
    nextDisplayModeChoice("auto") === "full" && nextDisplayModeChoice("full") === "lite" && nextDisplayModeChoice("lite") === "auto");
  const phone = profileDevice({ ...desktop, userAgent: "iPhone Mobile", deviceMemory: 3 });
  ok("Auto says what it saw", describeDisplayMode("auto", "lite", phone) === "Auto: Lite (phone, 3 GB memory)", describeDisplayMode("auto", "lite", phone));
}

console.log("\n8. the wiring for Lite");
{
  const app = codeOf("src/App.tsx");
  ok("a player's card opens in this window in Lite",
    /if \(!OBR\.isAvailable \|\| \(isPlayerMode && display\.mode === "lite"\)\) \{ setFocusedActorId\(actorId\);/.test(app));
  ok("...the covered duplicate card is not mounted in Lite",
    /\{focusedActorId && !\(isPlayerMode && display\.mode === "lite"\) && \(/.test(app));
  ok("...and the card that IS mounted carries the party purse",
    /actor=\{focusedActor\}\s*partyCoins=\{getPartyCoins\(roomLiveState\)\}/.test(app));
  ok("the mode control is on the seat screen, the seat bar and the GM toolbar",
    (app.match(/<DisplayModeToggle state=\{display\}/g) ?? []).length >= 3);
  for (const entry of ["actor-popout", "combat-window", "dm-panel", "levelup-popout", "monster-popout", "player-tracker"]) {
    ok(`${entry} stamps the stored mode before it mounts`, /applyStoredDisplayMode\(\);\s*if \(OBR\.isAvailable\)/.test(codeOf(`src/${entry}.tsx`)));
  }
  const css = read("src/styles.css");
  ok("Lite removes backdrop blur", /:root\[data-fdmc-display="lite"\] \*[\s\S]{0,200}backdrop-filter: none !important;/.test(css));
  ok("...but keeps box shadows, several of which are state", !/data-fdmc-display="lite"[^}]*box-shadow/.test(css));
}

console.log(failures ? `\nFAILED (${failures})` : "\nALL PASS");
process.exit(failures ? 1 : 0);
