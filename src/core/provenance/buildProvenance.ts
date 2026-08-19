export const FDM_BUILD_PROVENANCE = {
  schema: "fdmc/provenance-v1",
  projectId: "fdmc",
  appId: "forever-dm-combat",
  canonicalName: "Forever DM Combat",
  engineName: "Forever DM Combat Engine",
  firstCampaignModule: "The Broken Chain",
  communityId: "WARD",
  ownerPublicId: "fdmc-project",
  publisherPublicId: "fdmc-project",
  buildLabel: "0.7.10.19",
  buildId: "fdmc-build-0.7.10.19-2026-08-17",
  buildChannel: "dev",
  distribution: "internal-pre-public",
  sourcePolicy: "private-source",
  redistribution: "not-authorized",
  aiAssistedRebranding: "not-authorized",
  contact: "official-discord-support-channel",
  notice:
    "Forever DM Combat is private-source pre-public software. Redistribution, resale, cloning, or AI-assisted rebranding is not authorized without project-owner approval.",
  privacyNote:
    "No personal owner identity, personal email, home address, private key, or secret is embedded in this client-visible metadata.",
} as const;

export type FdmBuildProvenance = typeof FDM_BUILD_PROVENANCE;
