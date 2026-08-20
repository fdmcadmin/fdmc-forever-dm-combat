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
};

/**
 * A stable content fingerprint. FNV-1a over canonical JSON — sync (so it can be used during
 * render), dependency-free, and stable across key ordering because the keys are sorted.
 *
 * Not a security hash and not claimed to be one: it detects drift and substitution, which is
 * what provenance needs. Forgery resistance requires a signature, which requires a private key,
 * which requires a server.
 */
export function campaignDigest(monsters: unknown[], equipment: unknown[]): string {
  const canonical = JSON.stringify({ monsters, equipment }, (_k, v) => {
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
export function collectCampaignAuthoring(): CampaignAuthoringPayload {
  // A bundled creature is only "authored over" when the DM deliberately saved it; an unmarked
  // stored copy is a stale seed, and publishing one would re-ship an old creature as new work.
  const monsters = loadMonsterLibrary().filter(t => t.dmEdited || t.templateId.startsWith("custom-"));
  // Equipment has no such marker: the DM store only ever holds items that were unlocked and
  // changed, or created outright. Both are authoring.
  const equipment = loadEquipmentLibrary("dm").map(stripLocalInstantiation);
  return {
    schema: AUTHOR_EXPORT_SCHEMA,
    exportedAt: new Date().toISOString(),
    digest: campaignDigest(monsters, equipment),
    monsters,
    equipment,
  };
}

/** Download the payload as the file `scripts/fold-authoring.mjs` consumes. */
export function exportCampaignAuthoring(): { ok: boolean; message: string } {
  const payload = collectCampaignAuthoring();
  const total = payload.monsters.length + payload.equipment.length;
  if (total === 0) {
    return { ok: false, message: "Nothing authored on this machine yet — no edited campaign creatures and no custom equipment." };
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
    message: `Exported ${payload.monsters.length} creature${payload.monsters.length === 1 ? "" : "s"} and ${payload.equipment.length} item${payload.equipment.length === 1 ? "" : "s"}. Fold it into the build with: node scripts/fold-authoring.mjs <file>`,
  };
}

/**
 * Does the content shipped in this build still match what was published?
 *
 * Answers the provenance question only — see the header. A mismatch means the generated file
 * was edited by hand after the fold, which is exactly the case the file warns against.
 */
export function verifyCampaignProvenance(monsters: unknown[], equipment: unknown[]): boolean {
  if (!AUTHORED_DIGEST) return true; // nothing authored yet — nothing to verify against
  return campaignDigest(monsters, equipment) === AUTHORED_DIGEST;
}
