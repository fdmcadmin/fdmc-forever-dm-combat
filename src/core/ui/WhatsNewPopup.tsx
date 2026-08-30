/**
 * WHAT'S NEW — the read-me, shown once when the app state changes.
 *
 * Christopher: *"i think the read me neds to probably be a pop up for when the new app state is
 * viewed and then clicking the button does a dm pop out window because it will need updates for the
 * estimators (shown that this is a unlocked only feature)."*
 *
 * ⚠ THE POPUP CARRIES THE CHANGES, AND ONLY THE CHANGES (Christopher, 2026-08-28):
 * *"i want only the whats changed to show up on the panel — that changes have been made, and only
 * the changes that have been made."*
 *
 * So the notes are keyed BY VERSION and the popup shows the versions this install has not
 * acknowledged yet. It is a DELTA, not a standing document. The first list was written at 0.8.6.0
 * as one flat block that mixed 0.7.32, 0.8.0.2, 0.8.2.0 and 0.8.5.0 together and then kept showing
 * all of it after those changes were old news — which is the failure this replaces. A panel that
 * re-announces settled behaviour trains a DM to dismiss it, and the next real notice pays for that.
 *
 * ⚠ ONCE PER CHANGE, NOT ONCE PER VERSION. The acknowledgement stores the newest NOTED version the
 * DM has been shown, so a version bump that changed nothing a DM can see does not open anything at
 * all. Under the old key it stored the APP version, so every bump re-opened the same stale list.
 *
 * ⚠ AND IT IS AN UNLOCK-ONLY FEATURE. Everything it documents — the estimators, the checker, the
 * engine — belongs to the campaign side, so a locked install has nothing to be told about.
 *
 * ── WHY THE FULL READ-ME IS A POP-OUT ───────────────────────────────────────────────────────
 * *"it will need updates for the estimators."* The notes will keep growing, and a growing document
 * inside a drawer competes with the drawer's actual job. The popup carries what is NEW; the button
 * opens the WHOLE HISTORY in its own window, where it can be read beside the panel it describes.
 * That split is what lets the popup stay short — nothing is lost by leaving a point out of it, it
 * is one click away in the document that is allowed to grow.
 */

import { useEffect, useState } from "react";
import { safeStorage } from "../utils/safeStorage";

/**
 * ⚠ v2 BECAUSE THE STORED VALUE CHANGED MEANING — it was the app version, it is now the newest
 * NOTED version that has been shown. Reusing v1 would let an old app-version string be read as a
 * note marker and silently hide notes the DM has never seen. v1 is still READ once, below, so an
 * install that has already dismissed the 0.8.6.0 list is not shown it a second time.
 */
const SEEN_KEY = "fdmc.whatsNew.seen.v2";
const SEEN_KEY_V1 = "fdmc.whatsNew.seen.v1";

export type ReleaseNote = {
  /** Section heading, e.g. "Estimators". */
  area: string;
  /** One line per change, written for a DM rather than a developer. */
  points: string[];
};

export type VersionNotes = {
  /** The version the changes below actually SHIPPED IN — not the version they were written up in. */
  version: string;
  notes: ReleaseNote[];
};

/**
 * ⚠ THE NOTES LIVE HERE, IN THE CODE, and are updated with the change they describe.
 *
 * A release note written later is written from memory. Keeping them beside the version means the
 * commit that changes behaviour is the commit that explains it.
 *
 * ⚠ NEWEST FIRST, AND THE ORDER OF THIS ARRAY IS THE ONLY ORDER THAT COUNTS. Nothing here parses a
 * version string to decide what is newer, because in this project the numbers have collided and
 * gone backwards before — the standing rule is to order by history, never by version string. Add a
 * new version at the TOP and the delta takes care of itself.
 *
 * ⚠ A VERSION WITH NOTHING A DM CAN SEE GETS NO ENTRY. An engine-only or build-only change belongs
 * in MASTER, not here. Adding an entry to record that a version happened is exactly the padding
 * this panel is not allowed to carry.
 */
export const RELEASE_HISTORY: VersionNotes[] = [
  {
    version: "0.8.8.2",
    notes: [
      {
        area: "This panel",
        points: [
          "The DM Tools header shows the version you are actually running. It had been reading 0.7.10 for sixty-odd releases — the one line you would quote in a bug report.",
          "\"Import Party from Source Files\" no longer claims to import five characters it does not have, and no longer reports success when it imported nothing.",
        ],
      },
    ],
  },
  {
    version: "0.8.8.0",
    notes: [
      {
        area: "Estimators",
        points: [
          "The creature estimator rates up to CR 30. It stopped at CR 25 and sent anything above it to manual review, which caught every genuine titan.",
          "SRD creature stats were corrected against the published pages — challenge ratings for four dragons, hit points for ten small beasts, and the Vulture's CR.",
        ],
      },
    ],
  },
  {
    version: "0.8.7.1",
    notes: [
      {
        area: "This notice",
        points: [
          "This panel now shows only what has changed since you last read it, instead of the same standing list on every version. Once you have dismissed a point it does not come back.",
          "A version that changes nothing you would notice no longer opens it at all.",
          "\"Open the full read-me\" is now the whole history, newest first — that is where a point goes when it stops being new.",
        ],
      },
    ],
  },
  {
    version: "0.8.7.0",
    notes: [
      {
        area: "Under the hood",
        points: [
          "The app now carries a certified last-known-good copy of the encounter engine inside the build. If a capability breaks, the answer comes from that copy instead of the panel going quiet — and it needs no connection, because the moment recovery is wanted is the moment least likely to have one.",
          "Engine diagnostics report the build's hash beside its version. Two builds can carry the same version number and different engine code, so the hash is what makes a bug report traceable to exact bytes.",
        ],
      },
    ],
  },
  {
    version: "0.8.6.0",
    notes: [
      {
        area: "Character sheets",
        points: [
          "The Features tab hint now says what belongs on the tab, feats included.",
        ],
      },
      {
        area: "Under the hood",
        points: [
          "Engine diagnostics can break and restore a single capability on purpose, so degrading can be watched in a live room rather than only in a script. Author-only — deliberately breaking a capability is not something a player should be able to do to their own table.",
        ],
      },
    ],
  },
  {
    version: "0.8.5.0",
    notes: [
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
        ],
      },
    ],
  },
  {
    version: "0.8.2.0",
    notes: [
      {
        area: "Under the hood",
        points: [
          "SRD 5.2.1 creatures are available in encounters. They can never be used as a chassis, saved into your library, or carried in an export.",
        ],
      },
    ],
  },
  {
    version: "0.8.0.2",
    notes: [
      {
        area: "Estimators",
        points: [
          "The creature estimator refuses to price a TEMPLATE. A template is the instruction for building a creature, not a creature; build the bodies in the encounter editor, then rate any one of them.",
        ],
      },
    ],
  },
  {
    version: "0.7.32",
    notes: [
      {
        area: "Estimators",
        points: [
          "The encounter checker reads the library you can edit. Editing a creature changes what the checker reports — it used to price a frozen copy.",
        ],
      },
    ],
  },
];

function seenVersion(): string | null {
  try {
    const s = safeStorage();
    return s.getItem(SEEN_KEY) ?? s.getItem(SEEN_KEY_V1);
  } catch { return null; }
}

function markSeen(version: string): void {
  try { safeStorage().setItem(SEEN_KEY, version); } catch { /* ok */ }
}

/**
 * The versions this install has not been shown yet — newest first.
 *
 * ⚠ BY POSITION IN THE ARRAY, NOT BY COMPARING NUMBERS. Everything above the acknowledged entry is
 * unseen; that entry and everything below it is history.
 *
 * A marker that is not in the list at all — a fresh install, a downgrade, or a v1 value from a
 * version that never had notes — yields the newest entry ONLY. Under-reporting by a version is
 * recoverable in one click on the full read-me; replaying the whole history into a modal is the
 * thing this panel is not allowed to do.
 */
export function unseenNotes(seen: string | null): VersionNotes[] {
  if (!seen) return RELEASE_HISTORY.slice(0, 1);
  const i = RELEASE_HISTORY.findIndex(v => v.version === seen);
  if (i < 0) return RELEASE_HISTORY.slice(0, 1);
  return RELEASE_HISTORY.slice(0, i);
}

/**
 * Open the full read-me in its own window.
 *
 * ⚠ SELF-CONTAINED HTML, NOT A ROUTE. The DM panel runs inside an embedded frame; a popup that
 * tried to load an app route would inherit that frame's constraints and, in some hosts, silently
 * fail to render. Writing the document directly always works and needs no build step.
 *
 * ⚠ THIS ONE CARRIES EVERYTHING. It is the counterpart to the popup's delta: the popup answers
 * "what changed", this answers "what has ever changed", and a point dropping out of the first is
 * the reason the second has to exist.
 */
export function openReadmeWindow(version: string): void {
  const w = window.open("", "fdmc-readme", "width=760,height=820,scrollbars=yes");
  if (!w) return;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const body = RELEASE_HISTORY.map(v =>
    `<h2>${esc(v.version)}</h2>` +
    v.notes.map(n =>
      `<h3>${esc(n.area)}</h3><ul>${n.points.map(p => `<li>${esc(p)}</li>`).join("")}</ul>`
    ).join("")
  ).join("");
  w.document.write(`<!doctype html><meta charset="utf-8"><title>FDMC ${esc(version)} — Read Me</title>
<style>
  body { margin:0; padding:22px 26px; background:#0e0e16; color:#c9d0e8;
         font:13px/1.65 system-ui,-apple-system,Segoe UI,Roboto,sans-serif; }
  h1 { font-size:17px; margin:0 0 2px; color:#fff; }
  .v { color:#7b68ee; font-size:11px; letter-spacing:.5px; margin-bottom:18px; }
  h2 { font-size:12px; letter-spacing:.5px; color:#7b68ee; margin:26px 0 0;
       border-top:1px solid #23233a; padding-top:14px; }
  h3 { font-size:11px; letter-spacing:.5px; color:#7bb0e0; margin:12px 0 5px;
       text-transform:uppercase; }
  li { margin:0 0 7px; }
  ul { padding-left:18px; margin:0; }
</style>
<h1>Forever DM Combat</h1>
<div class="v">${esc(version)} — everything that has changed, newest first</div>
${body}`);
  w.document.close();
}

export function WhatsNewPopup({ version, unlocked }: { version: string; unlocked: boolean }) {
  const [pending, setPending] = useState<VersionNotes[]>([]);

  useEffect(() => {
    if (!unlocked) return;
    setPending(unseenNotes(seenVersion()));
  }, [version, unlocked]);

  if (!unlocked || pending.length === 0) return null;

  /** Acknowledge the newest thing SHOWN, so anything above it next time is genuinely new. */
  const dismiss = () => { markSeen(pending[0].version); setPending([]); };

  /** One version needs no divider — the header already names it. Several do. */
  const showVersionLabels = pending.length > 1;

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
          <span style={{ fontSize: 11, color: "#7b68ee", letterSpacing: 0.5 }}>
            {showVersionLabels
              ? `${pending[pending.length - 1].version} → ${pending[0].version}`
              : pending[0].version}
          </span>
        </div>

        {pending.map(v => (
          <div key={v.version}>
            {showVersionLabels && (
              <div style={{
                fontSize: 10, letterSpacing: 0.5, color: "#7b68ee", marginBottom: 4,
                paddingTop: 6, borderTop: "1px solid #23233a",
              }}>
                {v.version}
              </div>
            )}
            {v.notes.map(n => (
              <div key={n.area} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, letterSpacing: 0.5, color: "#7bb0e0", textTransform: "uppercase", marginBottom: 3 }}>
                  {n.area}
                </div>
                <ul style={{ margin: 0, paddingLeft: 17, fontSize: 12, lineHeight: 1.55, color: "#b9c0d8" }}>
                  {n.points.map((p, i) => <li key={i} style={{ marginBottom: 5 }}>{p}</li>)}
                </ul>
              </div>
            ))}
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
