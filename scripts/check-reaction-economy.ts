/**
 * AN ACTION THAT USES A REACTION MUST SPEND ONE.
 *   npx tsx scripts/check-reaction-economy.ts
 *
 * Christopher: *"let check to make sure items that use reaction are tagged reaction and use the
 * reaction."*
 *
 * ⚠ THE FIXTURES ARE REAL ROWS FROM HIS OWN LIBRARY, in both directions. A detector for this is
 * only worth having if it stays quiet about the three shapes that mention a Reaction WITHOUT being
 * one — a check that shouts at all of them is a check nobody reads. Both halves are asserted here.
 *
 * The party sheets themselves are gitignored, so this runs on copies of the rows rather than on
 * the library — the same discipline `check-party-healing.ts` follows and for the same reason.
 */
import { auditReactionEconomy } from "../src/core/ui/reactionEconomyAudit";

const problems: string[] = [];

const actors = [
  {
    name: "Lights Stone",
    tabs: {
      // ⚠ THE BUG. In the MAIN tab, costed as an Action, kind "attack" — and its own text says
      // Reaction. Clicking it spends the turn.
      main: [{
        id: "brooch", label: "Displaced Ward Brooch", actionKind: "attack", economyCost: ["main"],
        description: "When you take force damage, you can use your Reaction to reduce that damage by 1d6. Once used, this property cannot be used again until you finish a long rest.",
      }],
      // A REFERENCE ROW. Same words, no economy cost — it describes the item, it is not the action.
      equipment: [{
        id: "brooch-ref", label: "Displaced Ward Brooch", actionKind: "equipment",
        description: "When you take force damage, you can use your Reaction to reduce that damage by 1d6.",
      }],
      // A FEAT THAT GRANTS ONE. "the Interpose Shield reaction" is a separate action it unlocks.
      feats: [{
        id: "shield-master", label: "Shield Master", actionKind: "feature",
        description: "Grants Shield Bash once per turn after a melee attack and the Interpose Shield reaction. Shield Bash save DC 14.",
      }],
      // CORRECTLY COSTED — the shape everything else should look like.
      bonus: [{
        id: "interpose", label: "Interpose Shield", actionKind: "feature", economyCost: ["reaction"],
        description: "As a Reaction, impose disadvantage on an attack against an ally within 5 ft.",
      }],
    },
  },
  {
    name: "Faelar",
    // SOMEBODY ELSE'S REACTION. About the companion's economy, not this row's.
    tabs: {
      features: [{
        id: "command", label: "Primal Companion Command", actionKind: "feature",
        description: "Faelar acts during Lyrielle's turn. He moves and uses his Reaction on his own, but normally takes only the Dodge action.",
      }],
    },
  },
];

const findings = auditReactionEconomy(actors as never);
console.log(`${findings.length} row(s) spend an action while their own text says Reaction:\n`);
for (const f of findings) {
  console.log(`  ${f.actor} · [${f.tab}] ${f.label}  costs [${f.costs.join(", ")}]`);
  console.log(`      "${f.evidence}"`);
}

if (findings.length !== 1) {
  problems.push(`found ${findings.length} finding(s), expected exactly 1 — the Brooch in the main tab`);
}
if (findings[0]?.label !== "Displaced Ward Brooch" || findings[0]?.tab !== "main") {
  problems.push(`the finding was ${findings[0]?.label ?? "(none)"} in [${findings[0]?.tab ?? "-"}], expected the Brooch in [main]`);
}

// ── The three quiet cases, asserted by name so a looser detector fails here ──────────────────
for (const quiet of ["Shield Master", "Primal Companion Command", "Interpose Shield"]) {
  if (findings.some(f => f.label === quiet)) {
    problems.push(`${quiet} was flagged — it mentions a Reaction without being one, and a check that shouts at those is noise`);
  }
}
if (findings.filter(f => f.tab === "equipment").length > 0) {
  problems.push("an equipment reference row was flagged — it carries no economy cost, so it is a description");
}

if (problems.length) { console.error(`\nFAILED:\n  ${problems.join("\n  ")}`); process.exit(1); }
console.log(`\nPASS — a live row that uses a Reaction must cost one, and a row that merely mentions one is left alone.`);
