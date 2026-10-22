/**
 * NO REACT HOOK BELOW AN EARLY RETURN.
 *   npm run check:hooks
 *
 * ⚠ EIGHTY-THREE GATES PASSED ON A CHANGE THAT WOULD NOT START.
 *
 * 0.8.78.0 added `useEffect(..., [actorToShow?.id])` beside `actorToShow` in App.tsx's main
 * render — which sits below five early returns (`isRoleLoading`, an unknown viewer role, a viewer
 * seat, a player with no card, an empty actor list). A hook after an early return is a
 * CONDITIONAL hook: on any render that takes one of those branches React counts one fewer hook
 * than last time and throws #310, *"Rendered more hooks than during the previous render"*.
 *
 * The GM screen came up blank on launch. Christopher, 2026-10-21, mid-session:
 * *"error on launch after the patch so this needs fixed or reverted for now."*
 *
 * ⚠ NOTHING IN THIS REPO WAS LOOKING. `npm run build` is `tsc -b && vite build`; TypeScript has
 * no opinion about hook ORDER, and no gate ran eslint, so `react-hooks/rules-of-hooks` — the rule
 * written for precisely this — never executed. The whole suite was green on code that could not
 * render. This gate is the cheap, dependency-free version of that rule: it reads the component
 * top level and refuses a hook that appears after the first early return.
 *
 * Deliberately conservative. It only inspects TOP-LEVEL statements of exported components (two
 * spaces of indentation), which is where this class of mistake lives, and it only looks at files
 * big enough to hide one. It is not a replacement for the eslint rule; it is the part of it that
 * runs here today.
 */
import { readdirSync, readFileSync, statSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};

/** A hook call sitting at a component's top level. */
const HOOK = /^ {2}(?:const\s+\[?[\w\s,}{]*\]?\s*=\s*)?use[A-Z]\w*\(/;
/** A top-level `if (...) {` — the shape that guards an early return in these components. */
const IF_BLOCK = /^ {2}if \(.*\) \{\s*$/;
/** A bare top-level early return. */
const BARE_RETURN = /^ {2}return (?:null|<)/;

/**
 * ⚠ RESET AT EVERY TOP-LEVEL DECLARATION, or the scan crosses function boundaries.
 *
 * A module-level helper's body is indented two spaces exactly like a component's, so an early
 * return inside one helper was being matched against a hook inside a DIFFERENT function further
 * down the file. The first run of this gate reported TabPanel.tsx:420 against an early return on
 * line 95 — a `useMemo` in `TabPanel` (starts line 402) versus an `if` inside `inferCosts` (ends
 * line 110). Two unrelated functions, and a confident, wrong answer.
 */
const TOP_LEVEL_DECL = /^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var)\s/;

function scan(file: string): { line: number; code: string; guard: number } | null {
  const lines = readFileSync(file, "utf8").split("\n");
  let firstExit = -1;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    // A new top-level declaration starts a new scope: whatever returned above is not ours.
    if (TOP_LEVEL_DECL.test(l)) firstExit = -1;
    if (firstExit === -1) {
      // An `if (...) {` only counts as an exit when its block actually returns.
      if (IF_BLOCK.test(l)) {
        for (let j = i + 1; j < Math.min(i + 40, lines.length); j++) {
          if (/^ {2}\}/.test(lines[j])) break;
          if (/^ {4}return /.test(lines[j])) { firstExit = i + 1; break; }
        }
      } else if (BARE_RETURN.test(l)) firstExit = i + 1;
      continue;
    }
    if (HOOK.test(l)) return { line: i + 1, code: l.trim().slice(0, 72), guard: firstExit };
  }
  return null;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== "node_modules") walk(p, out); }
    else if (p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

console.log("No React hook below an early return\n");

const files = walk("src").filter(f => statSync(f).size > 4000);
console.log(`1. ${files.length} component files`);
{
  const bad: string[] = [];
  for (const f of files) {
    const hit = scan(f);
    if (hit) bad.push(`${f.replace(/\\/g, "/")}:${hit.line} — ${hit.code}  (first early return: line ${hit.guard})`);
  }
  ok("no hook runs after an early return", bad.length === 0,
    bad.length ? `\n      ${bad.join("\n      ")}` : `${files.length} files clean`);
}

console.log("\n2. the rule still has teeth");
{
  /**
   * ⚠ A GATE THAT CANNOT FAIL PROVES NOTHING. The scanner is run against the exact shape that
   * shipped broken, so a future refactor that quietly stops detecting it fails here instead of
   * going silently blind.
   */
  const mutation = [
    "export function Thing() {",
    "  const [a, setA] = useState(0);",
    "  if (!a) {",
    "    return null;",
    "  }",
    "  useEffect(() => {}, []);",   // ← the 0.8.78.0 mistake
    "  return <div />;",
    "}",
  ].join("\n");
  const tmp = join("scripts", "__hooks_mutation.tsx");
  writeFileSync(tmp, mutation);
  try {
    const hit = scan(tmp);
    ok("a hook after an early return IS detected", hit !== null, hit ? `line ${hit.line}` : "NOT DETECTED");
  } finally { unlinkSync(tmp); }

  const clean = [
    "export function Thing() {",
    "  const [a, setA] = useState(0);",
    "  useEffect(() => {}, []);",
    "  if (!a) {",
    "    return null;",
    "  }",
    "  return <div />;",
    "}",
  ].join("\n");
  const tmp2 = join("scripts", "__hooks_clean.tsx");
  writeFileSync(tmp2, clean);
  try {
    ok("...and the correct order is NOT flagged", scan(tmp2) === null);
  } finally { unlinkSync(tmp2); }
}

console.log(failures === 0
  ? "\nOK — every hook runs on every render"
  : `\n${failures} FAILED — React #310 is a blank screen, not a warning`);
process.exit(failures === 0 ? 0 : 1);
