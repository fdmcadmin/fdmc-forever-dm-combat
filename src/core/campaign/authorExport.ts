/**
 * AUTHOR EXPORT — the round trip that lets in-app authoring reach the shipped library.
 *
 * THE PROBLEM THIS SOLVES
 * -----------------------
 * Everything authored in the app lands in `localStorage`. That store belongs to one browser:
 * clear the cache, move machine, or reset the profile and the work is gone. Christopher,
 * authoring Act 4: *"if i author the entire act 4 creature set then nothing will be saved"*.
 * He is right, and the same is true of the eight Feywild Gifts — a Gift saved as an unpicked
 * chassis is still only a local record of one.
 *
 * The base library is CODE, and a browser extension cannot write its own source. So the loop
 * is closed the only way it can be: the app EXPORTS, `scripts/fold-authoring.mjs` writes
 * `authored.generated.ts`, and the next build ships it to everyone.
 *
 * WHAT COUNTS AS AUTHORED
 * -----------------------
 * On the author's machine the DM store IS the unshipped campaign work, so both are collected:
 *   • creatures — deliberate edits to bundled creatures (`dmEdited`) plus original creations
 *   • equipment — items unlocked and changed, plus original items including Gift chassis
 *
 * ⚠ PROVENANCE, NOT PROTECTION
 * ----------------------------
 * `campaignDigest` fingerprints content as published, so a local copy claiming to be campaign
 * content can be checked against what was actually shipped. It is not, and cannot be, content
 * protection: anything running in a browser can be edited by whoever is running it, and any
 * check in that bundle can be removed with it — the same reason the module unlock is a speed
 * bump. What the digest does buy is real, and it is the thing that was actually asked for:
 *
 *   • a local edit cannot PASS AS authored campaign content — it is shown as a DM override
 *   • no local edit reaches anybody else — the canonical library is whatever is in the build,
 *     and only the author can push a build
 *
 * So someone who jumps any future backend can still change their own table, and still cannot
 * change THE library. Server-side entitlement would move where the check runs; it would not
 * change that second guarantee, which already holds.
 */

import { loadMonsterLibrary } from "../monsters/dmMonsterLibrary";
import { exportableRecords } from "../content/contentScope";
import { loadEncounterLibrary, type EncounterDefinition } from "../monsters/encounterLibrary";
import { loadEquipmentLibrary, type EquipmentItem } from "../ui/EquipmentBagEditor";
import type { MainMonsterTemplate } from "../monsters/runtime/mainMonsterRuntime";
import { AUTHORED_DIGEST } from "../../data/broken-chain/authored.generated";

export const AUTHOR_EXPORT_SCHEMA = "fdmc.campaign-authoring.v1";

export type CampaignAuthoringPayload = {
  schema: typeof AUTHOR_EXPORT_SCHEMA;
  exportedAt: string;
  digest: string;
  monsters: MainMonsterTemplate[];
  equipment: EquipmentItem[];
  /**
   * THE FIGHTS THEMSELVES — and everything that only exists on an encounter.
   *
   * Christopher asked whether an export ordered the Act 1 fort and the Act 3 mirrors correctly.
   * It could not: encounters were not in the payload at all. That meant the ORDER of an act, its
   * act tag, its target classification, its loot pool and — worst — the BODIES a DM builds from
   * a template creature were all unshippable. A Mirror authored as a template could travel; the
   * five mirrors built from it could not.
   */
  encounters: EncounterDefinition[];
};

/**
 * A stable content fingerprint. FNV-1a over canonical JSON — sync (so it can be used during
 * render), dependency-free, and stable across key ordering because the keys are sorted.
 *
 * Not a security hash and not claimed to be one: it detects drift and substitution, which is
 * what provenance needs. Forgery resistance requires a signature, which requires a private key,
 * which requires a server.
 */
export function campaignDigest(monsters: unknown[], equipment: unknown[], encounters: unknown[] = []): string {
  const canonical = JSON.stringify({ monsters, equipment, encounters }, (_k, v) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)));
    }
    return v;
  });
  let h = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) {
    h ^= canonical.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `fnv1a-${h.toString(16).padStart(8, "0")}-${canonical.length}`;
}

/**
 * ⚠ THE TEMPLATE SHIPS; THE PICK NEVER DOES.
 *
 * A chassis Gift is authored as an unfilled shape — *"this is the 2h chassis gift"* — and the
 * DM chooses the actual weapon at the moment it is handed to a player. That choice is
 * `chassis.formId`, and it belongs to ONE character's copy: the whole reason the library entry
 * stays generic is so two players can hold the same Gift in different shapes.
 *
 * If the author happens to have picked a form on their own machine while testing, exporting it
 * unstripped would publish that pick as the campaign's — and every DM downstream would receive
 * a "2h chassis" that had already silently decided it was a greataxe. The template is exported
 * as authored, never as instantiated.
 */
function stripLocalInstantiation(item: EquipmentItem): EquipmentItem {
  if (!item.chassis?.formId) return item;
  const { formId: _pick, ...spec } = item.chassis;
  return { ...item, chassis: spec };
}

/**
 * Everything on this machine that belongs in the shipped campaign.
 *
 * `isCampaignTemplate` is passed in rather than recomputed, because only the caller holds the
 * bundled library it is measured against — and guessing at that is how a DM's own creature
 * would end up published as campaign content.
 */
export function collectCampaignAuthoring(
  opts: {
    /**
     * The creature list to ship, replacing the "what changed on this machine" collection below.
     *
     * Only `exportFullCreatureLibrary` passes this. Everything else — ↑ Publish and ↓ Author —
     * leaves it undefined and gets the changes-only payload, which is the right default: a
     * publish should carry the author's work, not re-state 54 creatures nobody touched.
     */
    monsters?: MainMonsterTemplate[];
  } = {},
): CampaignAuthoringPayload {
  /**
   * Everything in the CAMPAIGN store is authored campaign content by definition — the author put
   * it there deliberately, which is the whole point of the store existing.
   *
   * From the DM store, only two things qualify: a bundled creature the DM deliberately saved
   * (`dmEdited`), and their own creations. An unmarked stored copy is a stale seed, and
   * publishing one would re-ship an old creature as new work.
   */
  const campaignAuthored = loadMonsterLibrary("campaign");
  const campaignIds = new Set(campaignAuthored.map(t => t.templateId));
  const monsters = opts.monsters ?? [
    ...campaignAuthored,
    ...loadMonsterLibrary("dm").filter(t =>
      !campaignIds.has(t.templateId) && (t.dmEdited || t.templateId.startsWith("custom-"))),
  ];
  /**
   * ⚠ BOTH EQUIPMENT STORES. This read the DM store ONLY, which was right until "→ Campaign" and
   * the pool builder gave items somewhere else to live — after which promoting an item to the
   * campaign library REMOVED it from the export. An author could file eight Gifts correctly and
   * ship none of them.
   *
   * Campaign items are authored content by definition. From the DM store the same two things
   * qualify as before: a deliberate edit, or the DM own creation.
   */
  /**
   * ⚠ THE EDIT WINS, BECAUSE THE EDIT IS WHAT THE APP IS SHOWING.
   *
   * This kept the CAMPAIGN row wherever both stores held an id — and `upsertItem` writes every
   * edit to the DM store, campaign items included, precisely so the merged read (which gives DM
   * priority) picks it up. So the author edited a campaign item, saw the change everywhere in the
   * app, published, and shipped the row they had just replaced. Silent, and in the direction that
   * loses work rather than the direction that shouts.
   *
   * The export now resolves ids the same way `loadEquipmentLibrary()` does. What ships is what
   * the author was looking at when they pressed the button.
   */
  const campaignEquipment = loadEquipmentLibrary("campaign");
  const dmEquipment = loadEquipmentLibrary("dm");
  const dmItemIds = new Set(dmEquipment.map(i => i.id));
  const equipment = [
    ...campaignEquipment.filter(i => !dmItemIds.has(i.id)),
    ...dmEquipment,
  ].map(stripLocalInstantiation);
  /**
   * Campaign-owned encounters are authored content by definition. A DM's own fights stay theirs,
   * exactly as their own creatures do.
   */
  const encounters = loadEncounterLibrary("campaign")
    // Sorted the way an act reads, so a folded file is diffable and the order is the AUTHORED
    // order rather than whatever localStorage happened to hold.
    .slice()
    .sort((a, b) =>
      (a.actTag ?? "").localeCompare(b.actTag ?? "")
      || (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER)
      || a.name.localeCompare(b.name));

  return {
    schema: AUTHOR_EXPORT_SCHEMA,
    exportedAt: new Date().toISOString(),
    digest: campaignDigest(monsters, equipment, encounters),
    monsters,
    equipment,
    encounters,
  };
}

/** Download the payload as the file `scripts/fold-authoring.mjs` consumes. */
export function exportCampaignAuthoring(): { ok: boolean; message: string } {
  const payload = collectCampaignAuthoring();
  const total = payload.monsters.length + payload.equipment.length + payload.encounters.length;
  if (total === 0) {
    return { ok: false, message: "Nothing authored on this machine yet — no campaign creatures, encounters or custom equipment." };
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `fdmc-campaign-authoring-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  return {
    ok: true,
    message: `Exported ${payload.monsters.length} creature(s), ${payload.encounters.length} encounter(s) and ${payload.equipment.length} item(s). Fold it into the build with: node scripts/fold-authoring.mjs <file>`,
  };
}

/**
 * EXPORT EVERY CAMPAIGN CREATURE, not just the ones this browser changed.
 *
 * Christopher, on the author button: *"it only does changes, just give me a export creature
 * library button."*
 *
 * The changes-only payload is right for a publish and wrong for a reconciliation pass. A creature
 * the author has never opened in the app has no stored copy, so it never appears in an export — and
 * `authored.generated.ts` therefore shadows some creatures and not others, with no way to tell
 * which from inside the app. Correcting text against an encounter document means working on the
 * WHOLE library, so the whole library has to be able to leave the app.
 *
 * ⚠ EQUIPMENT AND ENCOUNTERS ARE CARRIED UNCHANGED, AND THAT IS NOT OPTIONAL. `fold-authoring`
 * merges creatures and equipment by id but REPLACES encounters wholesale, deliberately — deleting
 * a fight is a thing the author does. So a creatures-only payload with an empty `encounters` array
 * would fold to zero fights and take all 24 authored encounters with it. This collects them
 * exactly as ↓ Author does.
 *
 * The caller passes the resolved library because only it holds the bundled set the resolution is
 * measured against — the same reason `collectCampaignAuthoring` never guesses at it.
 */
/**
 * ⚠ AN EXPORT IS REDISTRIBUTION, so reference content does not travel in one.
 *
 * Content the app merely DISPLAYS under someone else's terms is not the app's to hand onward
 * inside a DM's export — that is the case attribution exists to prevent. `exportableRecords`
 * drops it; the engine decides from provenance and never asks whose reference content it is.
 *
 * Campaign and homebrew content still travel in full. Carrying those is the point of the export.
 */
export function exportFullCreatureLibrary(library: MainMonsterTemplate[]): { ok: boolean; message: string } {
  library = exportableRecords(library);
  if (library.length === 0) {
    return { ok: false, message: "No campaign creatures to export — unlock the module first." };
  }
  const payload = collectCampaignAuthoring({ monsters: library });
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `fdmc-creature-library-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  return {
    ok: true,
    message: `Exported all ${payload.monsters.length} campaign creature(s), plus ${payload.encounters.length} encounter(s) and ${payload.equipment.length} item(s). Fold it with: node scripts/fold-authoring.mjs <file>`,
  };
}

/**
 * Does the content shipped in this build still match what was published?
 *
 * Answers the provenance question only — see the header. A mismatch means the generated file
 * was edited by hand after the fold, which is exactly the case the file warns against.
 */
export function verifyCampaignProvenance(monsters: unknown[], equipment: unknown[], encounters: unknown[] = []): boolean {
  if (!AUTHORED_DIGEST) return true; // nothing authored yet — nothing to verify against
  return campaignDigest(monsters, equipment, encounters) === AUTHORED_DIGEST;
}
