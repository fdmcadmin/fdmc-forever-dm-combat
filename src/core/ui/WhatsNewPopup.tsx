/**
 * WHAT'S NEW — the read-me, shown once when the app state changes.
 *
 * Christopher: *"i think the read me neds to probably be a pop up for when the new app state is
 * viewed and then clicking the button does a dm pop out window because it will need updates for the
 * estimators (shown that this is a unlocked only feature)."*
 *
 * ⚠ ONCE PER VERSION, NOT EVERY LOAD. The stored acknowledgement is the VERSION string, so a bump
 * re-opens it exactly once and an unchanged build never does. A notice that reappears on every
 * reload is one a DM dismisses without reading, which costs the next real notice its audience.
 *
 * ⚠ AND IT IS AN UNLOCK-ONLY FEATURE. Everything it documents — the estimators, the checker, the
 * engine — belongs to the campaign side, so a locked install has nothing to be told about.
 *
 * ── WHY THE FULL READ-ME IS A POP-OUT ───────────────────────────────────────────────────────
 * *"it will need updates for the estimators."* The notes will keep growing, and a growing document
 * inside a drawer competes with the drawer's actual job. The popup carries the headline; the button
 * opens the whole thing in its own window, where it can be read beside the panel it describes.
 */

import { useEffect, useState } from "react";
import { safeStorage } from "../utils/safeStorage";

const SEEN_KEY = "fdmc.whatsNew.seen.v1";

export type ReleaseNote = {
  /** Section heading, e.g. "Estimators". */
  area: string;
  /** One line per change, written for a DM rather than a developer. */
  points: string[];
};

/**
 * ⚠ THE NOTES LIVE HERE, IN THE CODE, and are updated with the change they describe.
 *
 * A release note written later is written from memory. Keeping them beside the version means the
 * commit that changes behaviour is the commit that explains it.
 */
export const RELEASE_NOTES: ReleaseNote[] = [
  {
    area: "Character sheets",
    points: [
      "Feats and class features are ONE tab now, and it is Features. The Feats step is gone from the editor and existing characters were migrated automatically — nothing was lost, the entries moved.",
      "Only add a feat that changes something the app CALCULATES: damage, party healing, reach or accuracy. HP, ability scores and granted spells are values you type in, so a feat whose only effect is +HP, an ASI or an extra spell needs no entry — it is already on the sheet, and adding it would count it twice.",
    ],
  },
  {
    area: "Estimators",
    points: [
      "The encounter panel's party line now shows \"+X from feats\" beside DPR and \"+X healing from feats\" beside sustain, read from the characters' own Features tab.",
      "A feat the app cannot price is named rather than counted as zero — the line says how many channels need input, and hovering tells you which.",
      "The creature estimator refuses to price a TEMPLATE. A template is the instruction for building a creature, not a creature; build the bodies in the encounter editor, then rate any one of them.",
    ],
  },
  {
    area: "Under the hood",
    points: [
      "The encounter checker reads the library you can edit. Editing a creature changes what the checker reports — it used to price a frozen copy.",
      "SRD 5.2.1 creatures are available in encounters. They can never be used as a chassis, saved into your library, or carried in an export.",
    ],
  },
];

function seenVersion(): string | null {
  try { return safeStorage().getItem(SEEN_KEY); } catch { return null; }
}

function markSeen(version: string): void {
  try { safeStorage().setItem(SEEN_KEY, version); } catch { /* ok */ }
}

/**
 * Open the full read-me in its own window.
 *
 * ⚠ SELF-CONTAINED HTML, NOT A ROUTE. The DM panel runs inside an embedded frame; a popup that
 * tried to load an app route would inherit that frame's constraints and, in some hosts, silently
 * fail to render. Writing the document directly always works and needs no build step.
 */
export function openReadmeWindow(version: string): void {
  const w = window.open("", "fdmc-readme", "width=760,height=820,scrollbars=yes");
  if (!w) return;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  w.document.write(`<!doctype html><meta charset="utf-8"><title>FDMC ${esc(version)} — Read Me</title>
<style>
  body { margin:0; padding:22px 26px; background:#0e0e16; color:#c9d0e8;
         font:13px/1.65 system-ui,-apple-system,Segoe UI,Roboto,sans-serif; }
  h1 { font-size:17px; margin:0 0 2px; color:#fff; }
  .v { color:#7b68ee; font-size:11px; letter-spacing:.5px; margin-bottom:18px; }
  h2 { font-size:12px; letter-spacing:.5px; color:#7bb0e0; margin:20px 0 6px;
       text-transform:uppercase; border-bottom:1px solid #23233a; padding-bottom:4px; }
  li { margin:0 0 7px; }
  ul { padding-left:18px; margin:0; }
</style>
<h1>Forever DM Combat</h1>
<div class="v">${esc(version)} — what changed</div>
${RELEASE_NOTES.map(n => `<h2>${esc(n.area)}</h2><ul>${n.points.map(p => `<li>${esc(p)}</li>`).join("")}</ul>`).join("")}`);
  w.document.close();
}

export function WhatsNewPopup({ version, unlocked }: { version: string; unlocked: boolean }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!unlocked) return;
    if (seenVersion() !== version) setOpen(true);
  }, [version, unlocked]);

  if (!open || !unlocked) return null;

  const dismiss = () => { markSeen(version); setOpen(false); };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9000, background: "rgba(6,6,12,0.72)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div style={{
        background: "#12121c", border: "1px solid #2f2f4a", borderLeft: "3px solid #7b68ee",
        borderRadius: 6, padding: 18, maxWidth: 520, maxHeight: "80vh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
          <strong style={{ fontSize: 14, color: "#fff" }}>What changed</strong>
          <span style={{ fontSize: 11, color: "#7b68ee", letterSpacing: 0.5 }}>{version}</span>
        </div>

        {RELEASE_NOTES.map(n => (
          <div key={n.area} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, letterSpacing: 0.5, color: "#7bb0e0", textTransform: "uppercase", marginBottom: 3 }}>
              {n.area}
            </div>
            <ul style={{ margin: 0, paddingLeft: 17, fontSize: 12, lineHeight: 1.55, color: "#b9c0d8" }}>
              {n.points.map((p, i) => <li key={i} style={{ marginBottom: 5 }}>{p}</li>)}
            </ul>
          </div>
        ))}

        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button type="button" onClick={() => openReadmeWindow(version)}
            style={{ fontSize: 12, padding: "5px 12px", background: "#7b68ee22", color: "#7b68ee",
              border: "1px solid #7b68ee55", borderRadius: 4, cursor: "pointer" }}>
            Open the full read-me
          </button>
          <button type="button" onClick={dismiss}
            style={{ marginLeft: "auto", fontSize: 12, padding: "5px 14px", background: "#7b68ee",
              color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
