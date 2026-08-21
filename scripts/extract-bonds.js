// Extract the fourteen v13 bonds into structured JSON.
//
// RULE 1: the HTML is the truth. Nothing here invents or normalises mechanics text — it lifts
// what the document states and asserts every count, so a parsing miss fails loudly instead of
// shipping a bond with the wrong dice.
//
// Two parsing traps this file exists to survive:
//   · Page 7 carries THREE bond cards in one page div, so splitting on page merged Precise,
//     Tactician and Breaker into one 15-stage record and lost two bonds. Split on <h1>.
//   · Tactician and Breaker use class="mode flex-fill" and class="quote flex-line" — TWO
//     classes — so an exact class="mode" match returned undefined for exactly those two.
//     Every class match here is word-boundary within the attribute.
const fs = require("fs");

const src = fs.readFileSync(process.argv[2], "utf8");

const clean = (s) =>
  s.replace(/<[^>]+>/g, "")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&lsquo;|&rsquo;/g, "'")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ").replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/\s+/g, " ").trim();

/** class="…" matcher that tolerates extra classes on the same element. */
const cls = (name) => `class="[^"]*\\b${name}\\b[^"]*"`;

const grab = (chunk, name, tag = "div") => {
  const m = chunk.match(new RegExp(`<${tag} ${cls(name)}[^>]*>([\\s\\S]*?)</${tag}>`));
  return m ? clean(m[1]) : undefined;
};
const grabAll = (chunk, name) => {
  const out = [];
  const re = new RegExp(`<(?:div|span) ${cls(name)}[^>]*>([\\s\\S]*?)</(?:div|span)>`, "g");
  let m; while ((m = re.exec(chunk))) out.push(clean(m[1]));
  return out;
};

const slices = src.split(/(?=<h1[^>]*>)/).slice(1);
const bonds = [];

for (const slice of slices) {
  const h1 = slice.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  if (!h1 || !/class="[^"]*\broleline\b/.test(slice)) continue;
  const name = clean(h1[1]);
  if (!/Instinct$/.test(name)) continue;

  const stageRe = new RegExp(
    `<div ${cls("stage")}[^>]*>([\\s\\S]*?)</div>\\s*([\\s\\S]*?)` +
    `(?=<div ${cls("stage")}|<div ${cls("reads")}|<div ${cls("footrow")}|$)`,
    "g",
  );
  const stages = [];
  let sm;
  while ((sm = stageRe.exec(slice))) {
    const head = sm[1], body = sm[2];
    const numeral = clean((head.match(new RegExp(`<span ${cls("snum")}[^>]*>([\\s\\S]*?)</span>`)) || [])[1] || "");
    const label = clean((head.match(/<b>([\s\S]*?)<\/b>/) || [])[1] || "");
    const blurb = clean((head.match(new RegExp(`<i ${cls("slabel")}[^>]*>([\\s\\S]*?)</i>`)) || [])[1] || "");
    const tag = clean((head.match(new RegExp(`<span ${cls("tag")}[^>]*>([\\s\\S]*?)</span>`)) || [])[1] || "");

    const stage = { numeral, label, blurb };
    if (tag) stage.optionName = tag;

    const single = grab(body, "stagetext");
    if (single) stage.effect = single;

    // Stages III+ carry two path boxes: which path is CHOSEN, what it becomes, and what the
    // unchosen path holds at. The pair is the whole permanence model — see applyBondStage.
    // ⚠ SPLIT ON THE BOX OPENER, DO NOT LOOK AHEAD FOR THE CLOSER. A lookahead for
    // `</div></div>` matches at the palt's OWN closing tag, so every box was captured WITHOUT
    // it — `grab(b,"palt")` then found no closing tag and returned undefined, silently dropping
    // the unchosen-path text from all 84 boxes while every other assertion still passed.
    const boxes = [];
    const parts = body.split(new RegExp(`<div ${cls("pbox")}[^>]*>`)).slice(1);
    for (const b of parts) {
      const title = grab(b, "ptitle");
      const main = grab(b, "pmain");
      const alt = grab(b, "palt");
      if (title && main) boxes.push({ path: title, chosen: main, unchosen: alt });
    }
    if (boxes.length) stage.paths = boxes;
    stages.push(stage);
  }

  bonds.push({
    name,
    category: grab(slice, "catbadge"),
    role: grabAll(slice, "role")[0],
    mode: grabAll(slice, "mode")[0],
    timing: grabAll(slice, "timing")[0],
    quote: grab(slice, "quote"),
    stages,
    reads: grab(slice, "reads"),
    onYourTurn: grab(slice, "turnbox"),
  });
}

// ── Assertions: fourteen bonds, five stages each, three of them offering two paths ─────
const problems = [];
if (bonds.length !== 14) problems.push(`expected 14 bonds, got ${bonds.length}`);
for (const b of bonds) {
  if (b.stages.length !== 5) problems.push(`${b.name}: ${b.stages.length} stages, expected 5`);
  const pathStages = b.stages.filter(s => s.paths);
  if (pathStages.length !== 3) problems.push(`${b.name}: ${pathStages.length} path stages, expected 3`);
  for (const s of pathStages) {
    if (s.paths.length !== 2) problems.push(`${b.name} ${s.numeral}: ${s.paths.length} paths, expected 2`);
    for (const p of s.paths) {
      if (!p.chosen) problems.push(`${b.name} ${s.numeral} ${p.path}: no chosen text`);
      // Asserted because its absence is invisible otherwise — every other check passed while
      // all 84 unchosen texts were missing.
      if (!p.unchosen) problems.push(`${b.name} ${s.numeral} ${p.path}: no unchosen text`);
    }
  }
  for (const f of ["role", "mode", "timing", "quote"]) {
    if (!b[f]) problems.push(`${b.name}: missing ${f}`);
  }
  // The two path NAMES must be stable across III/IV/V or the permanence lock has nothing
  // to key on — a path chosen at Meta has to still be findable at Tempered and Unbroken.
  const sets = pathStages.map(s => s.paths.map(p => p.path.replace(/\s*\(.*$/, "").trim()));
  if (sets.length === 3) {
    const [a] = sets;
    for (let i = 1; i < 3; i++) {
      if (sets[i].length !== a.length) problems.push(`${b.name}: path count differs across stages`);
    }
  }
}

fs.writeFileSync(process.argv[3], JSON.stringify(bonds, null, 2));
console.log(`bonds: ${bonds.length}\n`);
for (const b of bonds) {
  const p = b.stages.filter(s => s.paths);
  console.log(`  ${b.name.padEnd(22)} ${String(b.mode).padEnd(10)} ${b.role}`);
  console.log(`      paths: ${p.map(s => s.paths.map(x => x.path.replace(/\s*\(.*$/, "")).join(" / ")).join("  |  ")}`);
}
if (problems.length) { console.log("\nPROBLEMS:"); problems.forEach(p => console.log("  " + p)); process.exit(1); }
console.log("\nall assertions passed");
