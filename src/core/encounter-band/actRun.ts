/**
 * ACT RUN — an act played end to end, with the rests where the campaign puts them.
 *
 * SOURCE: the "Act Run Setup" sheet of `broken_chain_encounter_checker_v7_4_UR_corrected.xlsx`
 * (RULE 1). Its own header states the boundary this model keeps:
 *
 *   *"App-facing run setup only. Encounters are built in Encounter Checker from estimator-priced
 *   creatures."*
 *
 * So this file NEVER prices a fight. It sequences fights, applies rest state between them, and
 * asks the existing checker for each one — *"dont change anything from the corrected estimator
 * and checker"*. Everything about how a single encounter is judged stays exactly where it was.
 *
 * ⚠ LAYER. The SHAPE (a sequence, rest types, rest outcomes, a level gate) is engine — any
 * campaign has acts and rests. WHICH fights are in Act 3 and where its long rests fall is Broken
 * Chain content and lives in the module (RULE 3).
 */

/** None / Short / Long — what the campaign offers after this fight. */
export type RestType = "None" | "Short" | "Long";

/**
 * How reliable that rest is, per the workbook's Rest Semantics table.
 *
 * The distinction that matters: `Set` is guaranteed by the campaign, `Available` is a normal
 * opportunity, and `Threatened` / `Unsafe` / `Conditional` are branches a run must NOT silently
 * assume completed — which is the whole reason a status exists beside the type.
 */
export type RestStatus = "Set" | "Available" | "Threatened" | "Safe" | "Unsafe" | "Conditional" | "—";

/** What the run does with the opportunity by default. */
export type RestDefault = "Complete" | "Take" | "Skip";

export const REST_SEMANTICS: Record<string, string> = {
  "Short/Set": "Campaign guarantees the 1-hour window; apply Short Rest benefits.",
  "Short/Available": "A normal rest opportunity. Default can be Take or Skip; Broken Chain usually treats these as completable unless authored otherwise.",
  "Short/Threatened": "Attempt can be interrupted by initiative, non-cantrip casting, or damage. Interrupted branch receives no Short Rest benefits.",
  "Long/Set": "Campaign-authored major rest; apply full Long Rest recovery when legal.",
  "Long/Safe": "Optional Long Rest location with no authored interruption.",
  "Long/Unsafe": "Rest may be attempted, but the default run should not silently assume completion.",
  "Long/Conditional": "Completion depends on an authored campaign condition or branch.",
};

export type ActRunStep = {
  act: string;
  sequence: number;
  /**
   * References an encounter assembled from estimator-priced creatures — NOT a built-in preset.
   * The workbook is explicit about this, and v7.4's own architecture_rule repeats it.
   */
  encounterId: string;
  name: string;
  partyLevel: number;
  partyMode: "WotC Standard" | "Broken Chain";
  /** Campaign progression state; read only when partyMode is "Broken Chain". */
  bcState: string;
  /** Hale's ally overlay may activate only when its runtime conditions are also satisfied. */
  vsEntity: boolean;
  restType: RestType;
  restStatus: RestStatus;
  restDefault: RestDefault;
  /** Level after this fight and its rest resolve — a level GATE, not a per-fight bump. */
  levelAfter: number;
  notes?: string;
};

/** What the DM chose for one step's rest, when they overrode the default. */
export type RestChoice = "default" | "complete" | "skip";

export type ActRunResolvedStep = ActRunStep & {
  /** The rest actually applied after this fight. */
  restTaken: RestType | "None";
  /** True when the run took a rest the workbook flags as not-guaranteed. */
  assumedRisky: boolean;
  /** Why, when it is risky or skipped. */
  restNote: string;
};

/**
 * CONDITIONAL ALLY RULE, verbatim from the sheet:
 *
 * *"Hale is added only for Broken Chain runs with Party Level > 12 AND vs_entity = TRUE. He is an
 * allied actor and does not increase PC party-size scaling."*
 *
 * ⚠ THE SECOND HALF IS THE PART THAT GETS FORGOTTEN. Adding an ally to the party size would
 * inflate every HP band in the act — Hale helps, he does not make the fights bigger.
 */
export function haleOverlayActive(step: Pick<ActRunStep, "partyMode" | "partyLevel" | "vsEntity">): boolean {
  return step.partyMode === "Broken Chain" && step.partyLevel > 12 && step.vsEntity;
}

/**
 * Does the default run complete this rest?
 *
 * *"Broken Chain normally treats ordinary short-rest opportunities as completable. Use Threatened
 * only where the authored scene can actually interrupt the hour."*
 */
export function restCompletesByDefault(step: ActRunStep): boolean {
  if (step.restType === "None") return false;
  if (step.restDefault === "Skip") return false;
  // Set and Safe are guaranteed. Available follows the Broken Chain default above.
  if (step.restStatus === "Set" || step.restStatus === "Safe" || step.restStatus === "Available") return true;
  // Threatened / Unsafe / Conditional: only when the DM explicitly says so.
  return false;
}

/**
 * Resolve a run: what rest each step actually gets, and where the run is ASSUMING something the
 * campaign does not guarantee.
 *
 * The risky flag is the point of the whole tab. A run that quietly completes a Threatened short
 * rest reports a party in better shape than the act can promise, and every fight after it is
 * judged against resources they might not have.
 */
export function resolveActRun(
  steps: ActRunStep[],
  choices: Record<string, RestChoice> = {},
): ActRunResolvedStep[] {
  return steps
    .slice()
    .sort((a, b) => a.sequence - b.sequence)
    .map(step => {
      const choice = choices[step.encounterId] ?? "default";
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
        ? "No rest between this fight and the next."
        : taken === "None"
          ? `${step.restType} rest skipped — the party carries its state into the next fight.`
          : assumedRisky
            ? `⚠ ${key}: ${REST_SEMANTICS[key] ?? "Not guaranteed by the campaign."} This run assumes it completed.`
            : REST_SEMANTICS[key] ?? `${step.restType} rest applied.`;

      return { ...step, restTaken: taken, assumedRisky, restNote };
    });
}

/** Where the act's level gates fall, for the header strip. */
export function actLevelGates(steps: ActRunStep[]): { after: string; from: number; to: number }[] {
  return steps
    .slice()
    .sort((a, b) => a.sequence - b.sequence)
    .filter(s => s.levelAfter > s.partyLevel)
    .map(s => ({ after: s.name, from: s.partyLevel, to: s.levelAfter }));
}

/** The distinct acts a run table covers, in first-seen order. */
export function actsIn(steps: ActRunStep[]): string[] {
  const seen: string[] = [];
  for (const s of steps) if (!seen.includes(s.act)) seen.push(s.act);
  return seen;
}
