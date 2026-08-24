/**
 * safeStorage, under every browser condition that matters — without a browser.
 *
 * Firefox's Enhanced Tracking Protection makes `window.localStorage` THROW on property access for
 * a third-party iframe, and FDMC runs inside OBR's. That is not a hypothetical: it stranded a
 * player on "syncing…" because `getViewerSeatKey` read it outside a try and the caller had no
 * `.catch()`. This proves each rung of the ladder still lands somewhere usable.
 *
 *   npx tsx scripts/probe-storage-fallback.ts            # all three scenarios
 *   npx tsx scripts/probe-storage-fallback.ts session    # one of: ok | session | memory
 */
import { spawnSync } from "node:child_process";

type Scenario = "ok" | "session" | "memory";
const EXPECTED: Record<Scenario, string> = { ok: "local", session: "session", memory: "memory" };

function fakeStore(): Storage {
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

async function runOne(scenario: Scenario): Promise<boolean> {
  const boom = (): Storage => { throw new Error("SecurityError: The operation is insecure."); };
  const local = fakeStore();
  const session = fakeStore();
  (globalThis as unknown as { window: unknown }).window = {
    get localStorage(): Storage { return scenario === "ok" ? local : boom(); },
    get sessionStorage(): Storage { return scenario === "memory" ? boom() : session; },
  };

  const { safeStorage, storageMode, storageGet, storageSet, storageRemove } =
    await import("../src/core/utils/safeStorage");

  storageSet("probe", "value");
  const mode = storageMode();
  const read = storageGet("probe");
  storageRemove("probe");
  const gone = storageGet("probe");
  const len = safeStorage().length;

  const pass = mode === EXPECTED[scenario] && read === "value" && gone === null && len === 0;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${scenario.padEnd(8)} mode=${mode.padEnd(7)} write/read=${read} afterRemove=${gone} length=${len}`);
  return pass;
}

const only = process.argv[2] as Scenario | undefined;
if (only) {
  const ok = await runOne(only);
  process.exit(ok ? 0 : 1);
}

// The module caches its choice on first call, so each scenario needs its own process.
console.log("safeStorage fallback ladder:");
let allPass = true;
for (const scenario of ["ok", "session", "memory"] as Scenario[]) {
  const r = spawnSync("npx", ["tsx", "scripts/probe-storage-fallback.ts", scenario], {
    encoding: "utf8", shell: process.platform === "win32",
  });
  process.stdout.write(r.stdout.split("\n").filter(l => /^\s{2}(ok|FAIL)/.test(l)).join("\n") + "\n");
  if (r.status !== 0) allPass = false;
}
console.log(allPass ? "ALL PASS" : "FAILURES ABOVE");
process.exit(allPass ? 0 : 1);
