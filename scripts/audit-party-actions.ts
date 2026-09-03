/**
 * audit-party-actions — runs the REAL affordance predicates over a real actor-library export
 * and reports every button that cannot do anything when a player clicks it.
 *
 * This is a diagnostic, not a gate: it takes an export path because the party sheets are
 * private and never ship in the repo (see .gitignore `src/private/`).
 *
 *   npx tsx scripts/audit-party-actions.ts <export.json>
 *
 * It imports the production functions on purpose. A reimplementation here would answer a
 * question about ITSELF — the whole failure this is chasing is code that is never reached.
 */
import { readFileSync } from "node:fs";
import { inferCosts, hasAttachedDice, shouldShowDirectRollButton, isCheckAction } from "../src/core/ui/TabPanel";
import { isInertAction, resolveOutcomeMode } from "../src/core/types/tabs";
import { slotsOf } from "../src/core/types/actionEconomy";
import { resolveNamedResourceCost } from "../src/core/state/consumeActionResources";
import type { ActorAction, TabId } from "../src/core/types/tabs";

const path = process.argv[2];
if (!path) { console.error("usage: audit-party-actions <export.json>"); process.exit(2); }

const data = JSON.parse(readFileSync(path, "utf8"));
const actors: any[] = Array.isArray(data.actors) ? data.actors : Object.values(data.actors ?? {});

type Finding = { actor: string; tab: string; label: string; kind: string; why: string };
const findings: Finding[] = [];
let total = 0;

for (const actor of actors) {
  // PASS THE ROWS, exactly as every production call site does. Mapping to labels here made the
  // audit blind to the authored resourceId link it exists to check — the same class of mistake
  // as the bug it is chasing.
  const labels = (actor.tabs?.resources ?? []).filter((r: any) => r?.label);

  for (const [tab, list] of Object.entries(actor.tabs ?? {})) {
    if (!Array.isArray(list)) continue;
    for (const raw of list as ActorAction[]) {
      const action = raw as ActorAction & { metadata?: any };
      if (tab === "resources" || tab === "notes" || tab === "status") continue;
      total++;

      const costs = inferCosts(action, tab as TabId);
      const mode = resolveOutcomeMode(action);
      const inert = isInertAction(action, costs);
      const dice = hasAttachedDice(action);
      const direct = shouldShowDirectRollButton(action, tab as TabId, costs, mode as any);
      const named = resolveNamedResourceCost(action, labels);
      const md = action.metadata ?? {};
      const authoredLink: string | undefined = md.resourceId;
      const spellLevel: number = md.spellLevel ?? 0;

      const add = (kind: string, why: string) => findings.push({ actor: actor.name, tab, label: action.label, kind, why });

      // ── the authored action→pool link the runtime does not read ──────────────
      if (authoredLink && !named && !md.charges && !(action.actionKind === "spell" && spellLevel > 0)) {
        add("UNLINKED-POOL", `authored resourceId "${authoredLink}" is ignored; prose cost ${JSON.stringify(md.cost ?? "")} matches no pool label`);
      }

      // ── a click that can produce nothing at all ───────────────────────────────
      if (inert && resolveOutcomeMode(action) !== "passive") {
        add("INERT", `not clickable: costs=[${costs.join(",")}] logMode=${action.logMode}`);
      } else if (!inert && action.logMode === "silent" && !dice && !named && !md.charges && mode !== "additive" && mode !== "passive") {
        add("SILENT-NOTHING", `clickable but silent with no dice and no pool: cost=${JSON.stringify(md.cost ?? "")} outcomeMode=${mode}`);
      }

      // ── authored passive on a tab whose whole point is spending economy ───────
      if (mode === "passive" && (tab === "main" || tab === "bonus")) {
        add("PASSIVE-ON-ECONOMY-TAB", `authored outcomeMode "passive" — inert by definition, so this ${tab} action can never be used`);
      }

      // ── rollable-but-unreachable ──────────────────────────────────────────────
      if (dice && !direct && slotsOf(costs).length === 0 && !isCheckAction(action)) {
        add("DICE-NO-BUTTON", `has dice but no direct Roll button and no slot to ready into`);
      }

      // ── upcasting ─────────────────────────────────────────────────────────────
      if (action.actionKind === "spell" && spellLevel > 0) {
        const rider = (md.upcastDamage ?? "").trim();
        const rolls = /\d+d\d+/i.test(md.damage ?? "");
        if (!rider && rolls) {
          add("UPCAST-NOOP", `L${spellLevel} spell rolls ${JSON.stringify(md.damage)} but has no upcastDamage — a higher slot is spent and adds nothing`);
        }
        if (md.spellSlotMode === "freeCast" && !rider && rolls) {
          add("UPCAST-FREECAST-NOOP", `free-cast L${spellLevel}: upcasting correctly spends a slot but adds no dice (no upcastDamage)`);
        }
      }
    }
  }
}

const order = ["INERT", "PASSIVE-ON-ECONOMY-TAB", "SILENT-NOTHING", "UNLINKED-POOL", "DICE-NO-BUTTON", "UPCAST-NOOP", "UPCAST-FREECAST-NOOP"];
console.log(`audited ${total} actions across ${actors.length} actors\n`);
for (const kind of order) {
  const rows = findings.filter(f => f.kind === kind);
  if (!rows.length) continue;
  console.log(`\n### ${kind}  (${rows.length})`);
  for (const r of rows) console.log(`  ${r.actor.padEnd(13)} ${("[" + r.tab + "]").padEnd(12)} ${r.label}\n      ${r.why}`);
}
const unknown = findings.filter(f => !order.includes(f.kind));
for (const r of unknown) console.log(`  ?? ${r.kind} ${r.actor} ${r.label} ${r.why}`);
console.log(`\ntotal findings: ${findings.length}`);
