/**
 * THE FEAT TABLE THE APP READS — the generated workbook rows, with errata applied.
 *
 * ⚠ IMPORT FROM HERE, NEVER FROM `featPricing.generated`. The generated file is the workbook's own
 * copy and is right about 113 of 117 rows; the four it is wrong about are corrected in
 * `featPricingErrata`, against the printed feat text. A reader that goes straight to the generated
 * table gets the uncorrected row and disagrees with every other reader in the app — which is the
 * same drift the generated file's own "do not hand-edit" warning exists to prevent, one layer up.
 * `check:featerrata` fails the build if any file outside this seam imports the generated table.
 *
 * Nothing here decides a price. This is one join, in one place, so the correction is visible.
 */
import {
  FEAT_PRICING as GENERATED_FEAT_PRICING,
  featPricing as generatedPricing,
  type FeatPricing,
  type FeatChannel,
} from "./featPricing.generated";
import { withErrata } from "./featPricingErrata";

export type { FeatPricing, FeatChannel };

/** Every feat, corrected. Same order and same length as the generated table. */
export const FEAT_PRICING: FeatPricing[] = GENERATED_FEAT_PRICING.map(row => withErrata(row)!);

/**
 * Resolve a feat by name or `edition:name`, defaulting a missing edition to 2024 — the workbook's
 * own rule, applied by the generated lookup — and then applying any erratum for the row it found.
 */
export function featPricing(nameOrKey: string): FeatPricing | undefined {
  return withErrata(generatedPricing(nameOrKey));
}
