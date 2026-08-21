// Generate the Broken Chain bond template module from the extracted v13 JSON.
const fs = require("fs");
const bonds = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));

const id = (name) => name.replace(/\s*Instinct$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
const q = (s) => JSON.stringify(s ?? "");
const stripPathLabel = (s) => s.replace(/\s*\(.*$/, "").trim();

const header = `/**
 * THE FOURTEEN BONDS — Broken Chain mod content, extracted from
 * \`broken_chain_campaign_bonds_v13.html\` (RULE 1: that file is the truth).
 *
 * ⚠ GENERATED. Re-run \`scripts/extract-bonds.js\` against the v13 document rather than editing
 * mechanics text here — a hand edit here silently disagrees with the document the table plays from.
 *
 * ── THE MODEL ────────────────────────────────────────────────────────────────────────────────
 * Five stages. Stages I and II have a single shared effect. Stages III, IV and V each hold TWO
 * path entries, and which one is live depends on the permanent choice made at Metamorphosis:
 *
 *   \`chosen\`   — what the path becomes when it IS the chosen one
 *   \`unchosen\` — what it holds at when the OTHER path was chosen
 *
 * ⚠ PATHS ARE KEYED BY INDEX, NOT NAME. A path RENAMES as it evolves — Pack's first path reads
 * "Bonded Strike" at Metamorphosis, "Apex Bond" at Tempered and "Unbroken Bond" at Unbroken. A
 * choice stored by name would fail to resolve one stage later, so the stored choice is 0 or 1.
 *
 * ⚠ METAMORPHOSIS IS PERMANENT (v13, "Rules That Always Hold"). Tempered and Unbroken are not
 * new choices — they DERIVE from the index chosen at Metamorphosis. There is deliberately no way
 * to express "switch path at Tempered" in this data or in \`bondProgress.ts\`. The only route to a
 * different path is the DM removing the bond and assigning it again, which clears the choice with
 * it. See RULE 2 → "EVERY LAYER OWNS ITS OWN CONSTANTS" in MASTER: this is BC mod law, and a DM
 * running the campaign does not get to re-rule it per character.
 */

import type { BondTemplate } from "../../../core/types/bond";

export const BROKEN_CHAIN_BOND_TEMPLATES: BondTemplate[] = [
`;

const body = bonds.map((b) => {
  const stages = b.stages.map((s) => {
    const parts = [
      `      numeral: ${q(s.numeral)}`,
      `      label: ${q(s.label)}`,
      `      blurb: ${q(s.blurb)}`,
    ];
    if (s.optionName) parts.push(`      optionName: ${q(s.optionName)}`);
    if (s.effect) parts.push(`      effect: ${q(s.effect)}`);
    if (s.paths) {
      const ps = s.paths.map(p =>
        `        { name: ${q(stripPathLabel(p.path))}, chosen: ${q(p.chosen)}, unchosen: ${q(p.unchosen)} },`
      ).join("\n");
      parts.push(`      paths: [\n${ps}\n      ]`);
    }
    return `    {\n${parts.join(",\n")},\n    }`;
  }).join(",\n");

  // Pack is the one bond whose effects belong to a COMPANION rather than the character.
  const isCompanion = /companion/i.test(b.role) || /your companion/i.test(JSON.stringify(b.stages));
  const companionLine = isCompanion
    ? `\n  /** The bond's effects are performed by the bonded COMPANION, not the character. */\n  actor: "companion",`
    : "";

  return `  {
  id: ${q(id(b.name))},
  name: ${q(b.name)},
  category: ${q(b.category)},
  role: ${q(b.role)},
  mode: ${q(b.mode)},
  timing: ${q(b.timing)},
  quote: ${q(b.quote)},${companionLine}
  reads: ${q(b.reads)},
  onYourTurn: ${q(b.onYourTurn)},
  stages: [
${stages},
  ],
  }`;
}).join(",\n");

fs.writeFileSync(process.argv[3], header + body + "\n];\n");
const companions = bonds.filter(b => /companion/i.test(b.role) || /your companion/i.test(JSON.stringify(b.stages)));
console.log(`wrote ${bonds.length} templates`);
console.log(`companion-actor bonds: ${companions.map(b => b.name).join(", ") || "(none)"}`);
