/**
 * A PLAYER DOWNLOADS THE PLAYER'S APP, AND CAN PICK LITE BEFORE ANY OF IT HAS ARRIVED.
 *   npm run build && npx tsx scripts/check-player-bundle.ts
 *
 * Christopher, 2026-09-15: *"this needs to be on the player side for the size because the issue is they get
 * stuck on loading the seat"* — and — *"we have to have a way to choose that from the players side before they
 * sit in the seat because my current player who is having the issue is using desktop but it doesnt load
 * because of slower connection or older pc."*
 *
 * The main window is the GM's window and every player's. At 0.8.62.1 its static script — everything that must
 * download and parse before the app mounts and a player can claim a seat — was 2,839KB: the SRD and campaign
 * monster libraries (1.1MB), the encounter checker runtime, the monster template editor, the equipment
 * catalogue and its panel, the actor editor. None of it is a player's.
 *
 *   1  the static closure of the BUILT main entry is under budget
 *   2  none of the GM's heavy code is in it — found by content, so a renamed chunk cannot hide it
 *   3  App reaches those modules only through import(), never a static import
 *   4  index.html carries a loading screen with the mode choice, before the app's script, and it works
 *
 * Reads `dist/`, so it runs after the build (as the workflow does).
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { DISPLAY_MODE_STORAGE_KEY } from "../src/core/ui/displayMode";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = resolve(ROOT, "dist");
let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};
const codeOf = (p: string) => readFileSync(resolve(ROOT, p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/[^\n]*/gm, "");

/**
 * The budget for what a player must download before the app mounts. 938KB when this was written — React,
 * the character card and the rules the card reads. Room to grow; not room for a library to slip back in.
 */
const PLAYER_STATIC_BUDGET_BYTES = 1_150_000;

/** Strings only the GM's heavy modules carry. Content, not chunk names: a rename cannot hide one. */
const GM_ONLY_MARKERS: Array<[string, string]> = [
  ["the SRD monster library", "Tarrasque"],
  ["the encounter checker runtime", "fdmc.encounter-checker-runtime.v7"],
  ["the campaign equipment catalogue", "Rimecleaver"],
  ["the actor editor", "Enter level split e.g."],
  ["the encounter library panel", "Monsters in this encounter:"],
];

if (!existsSync(resolve(DIST, "assets/main.js"))) {
  console.log("  FAIL  dist/assets/main.js is missing — run the build first");
  process.exit(1);
}

const assets = resolve(DIST, "assets");
const read = (file: string) => readFileSync(resolve(assets, file), "utf8");
/** `import{a as b}from"./x.js"` and `import"./x.js"` — never `import("./x.js")`, which is on demand. */
const staticImports = (code: string) => [...code.matchAll(/\bimport\s*(?:[\w$*{}\s,]+?\s*from\s*)?["']\.\/([\w.$-]+\.js)["']/g)].map(m => m[1]);
function closure(entry: string): Map<string, string> {
  const seen = new Map<string, string>();
  const walk = (file: string) => {
    if (seen.has(file)) return;
    const code = read(file);
    seen.set(file, code);
    staticImports(code).forEach(walk);
  };
  walk(entry);
  return seen;
}
const markersIn = (files: Map<string, string>) =>
  GM_ONLY_MARKERS.filter(([, marker]) => [...files.values()].some(code => code.includes(marker)));

console.log("A player downloads the player's app\n");

const main = closure("main.js");
const bytes = [...main.values()].reduce((sum, code) => sum + Buffer.byteLength(code), 0);

console.log("1. the static closure of the main entry");
{
  ok("the walk found the app's chunks, not just the entry", main.size >= 10, `${main.size} chunks`);
  ok(`under ${Math.round(PLAYER_STATIC_BUDGET_BYTES / 1024)}KB before a player can claim a seat`, bytes <= PLAYER_STATIC_BUDGET_BYTES, `${Math.round(bytes / 1024)}KB`);
  const biggest = [...main.entries()].map(([f, c]) => [f, Buffer.byteLength(c)] as const).sort((a, b) => b[1] - a[1]).slice(0, 6);
  console.log(`        largest: ${biggest.map(([f, b]) => `${f} ${Math.round(b / 1024)}K`).join(" · ")}`);
}

console.log("\n2. none of the GM's heavy code is in it");
{
  const everything = new Map(readdirSync(assets).filter(f => f.endsWith(".js")).map(f => [f, read(f)] as const));
  for (const [what, marker] of GM_ONLY_MARKERS) {
    ok(`the marker for ${what} exists in the build — else this check proves nothing`, [...everything.values()].some(c => c.includes(marker)), marker);
  }
  const leaked = markersIn(main);
  ok("no GM-only module is in a player's static download", leaked.length === 0, leaked.map(([what]) => what).join(", "));

  /** ⚠ MUTATION: the old wiring, a static edge from the entry to the SRD's chunk. The check must see it. */
  const srdChunk = [...everything.entries()].find(([, c]) => c.includes("Tarrasque"))?.[0];
  const mutated = new Map(main);
  if (srdChunk) for (const [f, c] of closure(srdChunk)) mutated.set(f, c);
  ok("MUTATION: a static edge to the SRD's chunk is caught", Boolean(srdChunk) && markersIn(mutated).some(([what]) => what === "the SRD monster library"));

  const lazy = read("main.js");
  ok("...and the entry does still reach those chunks — on demand", srdChunk !== undefined && lazy.includes("import(") );
}

console.log("\n3. App reaches the GM's modules only on demand");
{
  const app = codeOf("src/App.tsx");
  const staticFrom = (path: string) => new RegExp(`^import\\s+(?!type\\b)[^;]*?from\\s+"${path.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}";`, "m").test(app);
  for (const path of [
    "./core/monsters/EncounterLibraryPanel",
    "./data/broken-chain/monsterLibrary",
    "./data/broken-chain/equipmentLibrary",
    "./core/monsters/dmMonsterLibrary",
    "./core/ui/ActorEditor",
    "./core/seats/SeatAssignmentPanel",
    "./core/campaign/FdmcRoomMaintenancePanel",
    "./core/campaign/EncounterCleanupPanel",
    "./core/ui/EquipmentLibraryStandalone",
    "./core/campaign/repairDuplicateResistance",
  ]) ok(`no static import of ${path}`, !staticFrom(path));
  ok("the migrations load with import() after the first render", /import\("\.\/core\/campaign\/libraryMigrations"\)[\s\S]{0,80}runLibraryMigrations\(\)/.test(app));
  ok("the GM's monster repair loads only for the GM", /if \(!isDmMode\) return;\s*void import\("\.\/core\/campaign\/libraryMigrations"\)[\s\S]{0,80}runGmMonsterRepairs\(\)/.test(app));
  ok("the summon library loads for the GM or once a summon is on record",
    /if \(isDmMode \|\| summonRecords\.length > 0\) setNeedMonsterLibrary\(true\);/.test(app) && /useLazyMonsterLibrary\(needMonsterLibrary\)/.test(app));
  ok("the lazy panels render under Suspense", (app.match(/<Suspense fallback=\{<PanelLoading \/>\}>/g) ?? []).length >= 2);
  const level = codeOf("src/core/ui/LevelUpRequestPanel.tsx");
  ok("a player's level-up window loads the editor on demand too", !/from "\.\/ActorEditor"/.test(level) && /LazyActorEditor as ActorEditor/.test(level));
}

console.log("\n4. the loading screen, before any of the app");
{
  const html = readFileSync(resolve(DIST, "index.html"), "utf8");
  const boot = html.indexOf('id="fdmc-boot"');
  ok("dist/index.html has the loading screen inside #root", boot > html.indexOf('id="root"') && boot > 0);
  /**
   * ⚠ The build moves the app's script into <head>. That does not delay the screen: a module script is deferred
   * by the spec — it downloads while the page parses and paints, and runs after. What WOULD hold the screen back
   * is a classic (blocking) external script anywhere before it, so that is what is checked.
   */
  ok("...the app's script is a module script, which never holds the page's first paint",
    /<script type="module"[^>]*src="\/assets\/main\.js"/.test(html));
  const blocking = [...html.slice(0, boot).matchAll(/<script(?![^>]*type="module")[^>]*\bsrc=/g)];
  ok("...and no blocking external script comes before the loading screen", blocking.length === 0, `${blocking.length}`);
  ok("...with Auto, Full and Lite", ["auto", "full", "lite"].every(c => html.includes(`data-fdmc-boot-choice="${c}"`)));

  // Run the inline script against a small fake page: a click on Lite must reach the key the app reads.
  const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(s => s.includes("data-fdmc-boot-choice"));
  ok("the choice script is inline — it needs nothing downloaded", Boolean(inline));
  if (inline) {
    const run = (initial: Record<string, string>, clicks: string[]) => {
      const store = new Map(Object.entries(initial));
      const attrs = new Map<string, string>();
      const makeButton = (choice: string) => ({ style: {} as Record<string, string>, attrs: new Map<string, string>([["data-fdmc-boot-choice", choice]]),
        getAttribute(this: { attrs: Map<string, string> }, k: string) { return this.attrs.get(k) ?? null; },
        setAttribute(this: { attrs: Map<string, string> }, k: string, v: string) { this.attrs.set(k, v); } });
      const buttons = ["auto", "full", "lite"].map(makeButton);
      let clickHandler: ((e: { target: unknown }) => void) | undefined;
      const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, String(v)); }, removeItem: (k: string) => { store.delete(k); } };
      const window: Record<string, unknown> = { localStorage: storage };
      const document = {
        documentElement: { setAttribute: (k: string, v: string) => attrs.set(k, v), removeAttribute: (k: string) => attrs.delete(k) },
        querySelectorAll: () => buttons,
        getElementById: (id: string) => (id === "fdmc-boot" ? { addEventListener: (_: string, h: typeof clickHandler) => { clickHandler = h; } } : null),
      };
      vm.runInNewContext(inline, { window, document, setTimeout: () => 0 });
      for (const c of clicks) clickHandler?.({ target: buttons.find(b => b.attrs.get("data-fdmc-boot-choice") === c) });
      return { store, attrs, window, pressed: buttons.filter(b => b.attrs.get("aria-pressed") === "true").map(b => b.attrs.get("data-fdmc-boot-choice")) };
    };
    const lite = run({}, ["lite"]);
    ok("a tap on Lite writes the key the app reads", lite.store.get(DISPLAY_MODE_STORAGE_KEY) === "lite", String(lite.store.get(DISPLAY_MODE_STORAGE_KEY)));
    ok("...stamps Lite on the page at once", lite.attrs.get("data-fdmc-display") === "lite");
    ok("...and shows it chosen", lite.pressed.join() === "lite");
    const back = run({ [DISPLAY_MODE_STORAGE_KEY]: "lite" }, ["auto"]);
    ok("a stored choice is shown on load, and Auto clears it", !back.store.has(DISPLAY_MODE_STORAGE_KEY) && !back.attrs.has("data-fdmc-display") && back.pressed.join() === "auto");
    const fresh = run({}, []);
    ok("with nothing stored, Auto is what shows", fresh.pressed.join() === "auto" && !fresh.attrs.has("data-fdmc-display"));
  }

  const display = codeOf("src/core/ui/displayMode.ts");
  ok("the app falls back to the loading screen's choice when storage refused it", /__fdmcBootDisplayChoice/.test(display));
  const app = codeOf("src/App.tsx");
  ok("the app's own pre-seat screens carry the mode too (loading, no table, seat picker)",
    /<p style=\{\{ fontSize: 12, margin: 0 \}\}>Loading…<\/p>\s*(\{\s*\}\s*)?<DisplayModeToggle state=\{display\} \/>/.test(app)
    && /\{APP_VERSION\}<\/p>\s*<DisplayModeToggle state=\{display\} \/>\s*\{tableBinding \?/.test(app));
}

console.log(failures ? `\nFAILED (${failures})` : "\nALL PASS");
process.exit(failures ? 1 : 0);
