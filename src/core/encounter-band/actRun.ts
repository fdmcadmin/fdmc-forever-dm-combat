/**
 * ACT RUN — a sequence of fights the DM composes, with the rests between them.
 *
 * ⚠ NOTHING HERE IS BUNDLED, AND THAT IS THE POINT.
 *
 * The first version shipped Act 3 as a ten-fight table read from the workbook. That was wrong,
 * and v7.4's own architecture_rule says why:
 *
 *   *"Encounter results are computed from creature/group inputs supplied to the checker. No
 *   campaign encounter preset or built-in monster roster may supply those values."*
 *
 * A bundled runthrough is a preset. Christopher: *"the BC campaign shouldnt have bundled sequence
 * for the checker window… the act run should be able to choose the fights you use and show the
 * run result."*
 *
 * THE VALIDATION CHAIN, in order:
 *   1. every creature goes through the ESTIMATOR to be validated and priced
 *   2. priced creatures are assembled into an ENCOUNTER
 *   3. the CHECKER rates that encounter against the party level
 *   4. the ACT RUN sequences chosen encounters and carries rest state between them
 *
 * Each step consumes the one before it. This file is step 4 only: it sequences and applies rest
 * state, and it NEVER prices a fight — the checker does that, unchanged.
 *
 * LAYER: engine. Acts, rests and level gates are not a 5e idea and not a Broken Chain one.
 */

/** None / Short / Long — what the DM says is available after this fight. */
export type RestType = "None" | "Short" | "Long";

/**
 * How reliable that rest is, per the workbook's Rest Semantics table.
 *
 * The distinction that matters: `Set` and `Safe` are guaranteed, `Available` is a normal
 * opportunity, and `Threatened` / `Unsafe` / `Conditional` are branches a run must NOT silently
 * assume completed — which is the whole reason a status exists beside the type.
 */
export type RestStatus = "Set" | "Available" | "Threatened" | "Safe" | "Unsafe" | "Conditional" | "—";

/** What the run does with the opportunity by default. */
export type RestDefault = "Complete" | "Take" | "Skip";

export const REST_STATUSES: RestStatus[] = ["Set", "Available", "Threatened", "Safe", "Unsafe", "Conditional", "—"];

export const REST_SEMANTICS: Record<string, string> = {
  "Short/Set": "Campaign guarantees the 1-hour window; apply Short Rest benefits.",
  "Short/Available": "A normal rest opportunity. Default can be Take or Skip; usually treated as completable unless authored otherwise.",
  "Short/Threatened": "Attempt can be interrupted by initiative, non-cantrip casting, or damage. Interrupted branch receives no Short Rest benefits.",
  "Long/Set": "Authored major rest; apply full Long Rest recovery when legal.",
  "Long/Safe": "Optional Long Rest location with no authored interruption.",
  "Long/Unsafe": "Rest may be attempted, but the default run should not silently assume completion.",
  "Long/Conditional": "Completion depends on an authored condition or branch.",
};

/**
 * One fight in a run, as the DM placed it.
 *
 * `encounterId` REFERENCES an encounter the DM built — it never carries the fight's contents.
 * The workbook is explicit: *"References an encounter assembled from estimator-priced creatures;
 * not a built-in monster preset."*
 */
export type ActRunStep = {
  /** Stable id within the run, so reordering does not swap steps. */
  id: string;
  sequence: number;
  /** Which encounter from the DM's own library. */
  encounterId: string;
  /** Cached label for display when the encounter is missing or renamed. */
  name: string;
  /** Party benchmark level for this fight. */
  partyLevel: number;
  restType: RestType;
  restStatus: RestStatus;
  restDefault: RestDefault;
  /** Level after this fight and its rest resolve — a level GATE, not a per-fight bump. */
  levelAfter: number;
  notes?: string;
};

/** A named run the DM composed. Stored locally, never bundled. */
export type ActRun = {
  id: string;
  name: string;
  /** Free-text — "Act 3", "the long night", whatever the DM calls it. */
  label?: string;
  partyMode: "WotC Standard" | "Broken Chain";
  /** Campaign progression state; read only when partyMode is "Broken Chain". */
  bcState?: string;
  /** Ally-overlay condition, evaluated per step. */
  vsEntity?: boolean;
  steps: ActRunStep[];
};

/** What the DM chose for one step's rest, when they overrode the default. */
export type RestChoice = "default" | "complete" | "skip";

export type ActRunResolvedStep = ActRunStep & {
  restTaken: RestType | "None";
  /** True when the run took a rest the status says is not guaranteed. */
  assumedRisky: boolean;
  restNote: string;
};

/**
 * CONDITIONAL ALLY RULE, from the workbook:
 *
 * *"Hale is added only for Broken Chain runs with Party Level > 12 AND vs_entity = TRUE. He is an
 * allied actor and does not increase PC party-size scaling."*
 *
 * ⚠ THE SECOND HALF IS THE PART THAT GETS FORGOTTEN. Counting an ally in party size would inflate
 * every HP band in the run — he helps, he does not make the fights bigger.
 */
export function allyOverlayActive(run: Pick<ActRun, "partyMode" | "vsEntity">, step: Pick<ActRunStep, "partyLevel">): boolean {
  return run.partyMode === "Broken Chain" && step.partyLevel > 12 && Boolean(run.vsEntity);
}

/** Does the default run complete this rest? */
export function restCompletesByDefault(step: ActRunStep): boolean {
  if (step.restType === "None") return false;
  if (step.restDefault === "Skip") return false;
  if (step.restStatus === "Set" || step.restStatus === "Safe" || step.restStatus === "Available") return true;
  // Threatened / Unsafe / Conditional: only when the DM explicitly says so.
  return false;
}

/**
 * Resolve a run: what rest each step actually gets, and where the run is ASSUMING something that
 * is not guaranteed.
 *
 * The risky flag is the point of the whole tab. A run that quietly completes a Threatened short
 * rest reports a party in better shape than the fiction promises, and every fight after it is
 * judged against resources they might not have.
 */
export function resolveActRun(steps: ActRunStep[], choices: Record<string, RestChoice> = {}): ActRunResolvedStep[] {
  return steps
    .slice()
    .sort((a, b) => a.sequence - b.sequence)
    .map(step => {
      const choice = choices[step.id] ?? "default";
      const byDefault = restCompletesByDefault(step);
      const taken = step.restType === "None"
        ? "None" as const
        : choice === "complete" ? step.restType
        : choice === "skip" ? "None" as const
        : byDefault ? step.restType : "None" as const;

      const guaranteed = step.restStatus === "Set" || step.restStatus === "Safe";
      const assumedRisky = taken !== "None" && !guaranteed && step.restStatus !== "Available";

      const key = `${step.restType}/${step.restStatus}`;
      const restNote = step.restType === "None"
        ? "No rest before the next fight."
        : taken === "None"
          ? `${step.restType} rest skipped — the party carries its state forward.`
          : assumedRisky
            ? `⚠ ${key}: ${REST_SEMANTICS[key] ?? "Not guaranteed."} This run assumes it completed.`
            : REST_SEMANTICS[key] ?? `${step.restType} rest applied.`;

      return { ...step, restTaken: taken, assumedRisky, restNote };
    });
}

/**
 * The stretches between full resets.
 *
 * A LONG rest is the only thing that truly resets the party, so the meaningful unit is the block
 * between long rests — that is the span a party's resources have to cover, and the number a DM is
 * actually asking about when they ask how the run goes.
 */
export function restBlocks(resolved: ActRunResolvedStep[]): { fights: number; shortRests: number; endsAt: string }[] {
  const blocks: { fights: number; shortRests: number; endsAt: string }[] = [];
  let cur = { fights: 0, shortRests: 0, endsAt: "" };
  for (const s of resolved) {
    cur.fights += 1;
    if (s.restTaken === "Short") cur.shortRests += 1;
    if (s.restTaken === "Long") { blocks.push({ ...cur, endsAt: s.name }); cur = { fights: 0, shortRests: 0, endsAt: "" }; }
  }
  if (cur.fights > 0) blocks.push({ ...cur, endsAt: "end of run" });
  return blocks;
}

/** Where the run's level gates fall. */
export function runLevelGates(steps: ActRunStep[]): { after: string; from: number; to: number }[] {
  return steps
    .slice()
    .sort((a, b) => a.sequence - b.sequence)
    .filter(s => s.levelAfter > s.partyLevel)
    .map(s => ({ after: s.name, from: s.partyLevel, to: s.levelAfter }));
}

/**
 * Renumber and carry levels forward after an edit.
 *
 * A step's party level follows the previous step's `levelAfter` unless the DM set it, so inserting
 * a fight in the middle does not leave the tail of the run at the wrong level — which would
 * mis-price every fight after the insertion point without saying so.
 */
export function normalizeRun(steps: ActRunStep[]): ActRunStep[] {
  const sorted = steps.slice().sort((a, b) => a.sequence - b.sequence);
  let level = sorted[0]?.partyLevel ?? 1;
  return sorted.map((s, i) => {
    const partyLevel = i === 0 ? s.partyLevel : level;
    const levelAfter = Math.max(s.levelAfter, partyLevel);
    level = levelAfter;
    return { ...s, sequence: i + 1, partyLevel, levelAfter };
  });
}

// ─── Local storage — a run is the DM's, like their encounters ────────────────────────────────

const ACT_RUN_KEY = "fdmc.dm.actRuns.v1";

export function loadActRuns(): ActRun[] {
  try { return JSON.parse(window.localStorage.getItem(ACT_RUN_KEY) ?? "[]") as ActRun[]; } catch { return []; }
}

export function saveActRuns(runs: ActRun[]): void {
  try { window.localStorage.setItem(ACT_RUN_KEY, JSON.stringify(runs)); } catch { /* ok */ }
}

export function newActRun(name = "New run"): ActRun {
  return { id: `run-${Date.now().toString(36)}`, name, partyMode: "Broken Chain", steps: [] };
}
