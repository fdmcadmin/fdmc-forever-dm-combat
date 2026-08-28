/**
 * FEAT PRICING — the D&D mod's copy of the workbook's feat contract.
 *
 * ⚠ GENERATED from `broken_chain_encounter_checker_v12_feat_pricing.xlsx` (tab 17) by
 * `scripts/gen-feats.mjs`. Do not hand-edit.
 *
 * ⚠ THIS IS MOD CONTENT, NOT ENGINE. Feats are a 5e concept; the engine must not learn what one is.
 * See `core/content/contentScope.ts` for the same split applied to creature libraries.
 *
 * ── THE CONTRACT, IN THE WORKBOOK'S OWN WORDS ───────────────────────────────────────────────
 *   Lookup            "edition:name; default missing edition to 2024"
 *   Resolved actor    "Do not re-add static ASI, attack bonus, AC, save, or max-HP benefits
 *                      already present on the character"
 *   Outputs           "dpr_delta + personal_ehp_delta + party_ehp_delta; utility/control remain
 *                      zero unless their stated exposure resolves"
 *   Action law        "One Action, Bonus Action, and Reaction budget per turn unless another
 *                      authored rule grants more; use/refresh limits are mandatory"
 *   Missing input     "If a required variable is absent, return NEEDS_INPUT for that channel;
 *                      never convert missing context to zero."
 *
 * 117 feats · 2014: 42 · 2024: 75
 * channels · DPR 61 · NONE 28 · PARTY_EHP 8 · PERSONAL_EHP 33
 */

/** Which budget a feat's contribution lands on. Three, kept SEPARATE by contract. */
export type FeatChannel = "DPR" | "PERSONAL_EHP" | "PARTY_EHP" | "NONE";

export type FeatPricing = {
  /** `edition:name`, the exact match key. */
  key: string;
  edition: string;
  name: string;
  category: string;
  minLevel: number;
  abilityIncrease: number;
  channels: FeatChannel[];
  dprRule: string;
  /** Expression in the workbook's grammar. Evaluated, never executed as code. */
  dpr: string;
  personalEhpRule: string;
  personalEhp: string;
  partyEhpRule: string;
  partyEhp: string;
  /** What the feat costs on the turn. A delta is ZERO when its budget is unavailable. */
  actionBudget: string;
  trigger: string;
  eligibility: string;
  status: string;
  /** The anti-double-count rule. Read before adding a second contribution. */
  doubleCountGuard: string;
  note: string;
};

export const FEAT_PRICING: FeatPricing[] = [
  {
    "key": "2024:Alert",
    "edition": "2024",
    "name": "Alert",
    "category": "Origin",
    "minLevel": 1,
    "abilityIncrease": 0,
    "channels": [
      "DPR"
    ],
    "dprRule": "initiative_swing",
    "dpr": "round==1 ? baseDpr*0.015 : 0",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "+PB Initiative and initiative swap; first-round exposure",
    "eligibility": "Origin feat grant/background; repeat only when the feat says Repeatable",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "No generic DPR/EHP is added unless a listed primitive resolves from the character and encounter context."
  },
  {
    "key": "2024:Crafter",
    "edition": "2024",
    "name": "Crafter",
    "category": "Origin",
    "minLevel": 1,
    "abilityIncrease": 0,
    "channels": [
      "NONE"
    ],
    "dprRule": "none",
    "dpr": "0",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Always or no direct combat trigger",
    "eligibility": "Origin feat grant/background; repeat only when the feat says Repeatable",
    "status": "NO_DIRECT_DPR_EHP",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "No generic DPR/EHP is added unless a listed primitive resolves from the character and encounter context."
  },
  {
    "key": "2024:Healer",
    "edition": "2024",
    "name": "Healer",
    "category": "Origin",
    "minLevel": 1,
    "abilityIncrease": 0,
    "channels": [
      "PARTY_EHP"
    ],
    "dprRule": "none",
    "dpr": "0",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "battle_medic",
    "partyEhp": "partySize*(7.5+floor((level+1)/2))*availableUsesPerRestCycle",
    "actionBudget": "Utilize Action for Battle Medic",
    "trigger": "Per creature per Short/Long Rest; healing rerolls use actual healing packets",
    "eligibility": "Origin feat grant/background; repeat only when the feat says Repeatable",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "No generic DPR/EHP is added unless a listed primitive resolves from the character and encounter context."
  },
  {
    "key": "2024:Lucky",
    "edition": "2024",
    "name": "Lucky",
    "category": "Origin",
    "minLevel": 1,
    "abilityIncrease": 0,
    "channels": [
      "DPR",
      "PERSONAL_EHP"
    ],
    "dprRule": "luck_attack_reprice",
    "dpr": "luckPointsUsedOnAttacks*attackRerollGain",
    "personalEhpRule": "luck_defense_reprice",
    "personalEhp": "luckPointsUsedOnDefense*preventedDamagePerPoint",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "PB Luck points per Long Rest",
    "eligibility": "Origin feat grant/background; repeat only when the feat says Repeatable",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "No generic DPR/EHP is added unless a listed primitive resolves from the character and encounter context."
  },
  {
    "key": "2024:Magic Initiate",
    "edition": "2024",
    "name": "Magic Initiate",
    "category": "Origin",
    "minLevel": 1,
    "abilityIncrease": 0,
    "channels": [
      "DPR"
    ],
    "dprRule": "granted_spell_packet",
    "dpr": "round==1 ? (2.5+level*0.12)/6 : 0",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "One granted level-1 spell per Long Rest plus chosen cantrip action packets",
    "eligibility": "Origin feat grant/background; repeat only when the feat says Repeatable",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "No generic DPR/EHP is added unless a listed primitive resolves from the character and encounter context."
  },
  {
    "key": "2024:Musician",
    "edition": "2024",
    "name": "Musician",
    "category": "Origin",
    "minLevel": 1,
    "abilityIncrease": 0,
    "channels": [
      "DPR",
      "PARTY_EHP"
    ],
    "dprRule": "heroic_inspiration_offense",
    "dpr": "round==1 ? baseDpr*0.012 : 0",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "heroic_inspiration_defense",
    "partyEhp": "min(partySize,PB)*PB*0.6",
    "actionBudget": "Short/Long Rest performance",
    "trigger": "After a rest; price only available Heroic Inspiration uses",
    "eligibility": "Origin feat grant/background; repeat only when the feat says Repeatable",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "No generic DPR/EHP is added unless a listed primitive resolves from the character and encounter context."
  },
  {
    "key": "2024:Savage Attacker",
    "edition": "2024",
    "name": "Savage Attacker",
    "category": "Origin",
    "minLevel": 1,
    "abilityIncrease": 0,
    "channels": [
      "DPR"
    ],
    "dprRule": "damage_dice_advantage",
    "dpr": "eligibleWeaponTurn*1.55*onceHit",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Once per turn on eligible weapon damage dice",
    "eligibility": "Origin feat grant/background; repeat only when the feat says Repeatable",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "No generic DPR/EHP is added unless a listed primitive resolves from the character and encounter context."
  },
  {
    "key": "2024:Skilled",
    "edition": "2024",
    "name": "Skilled",
    "category": "Origin",
    "minLevel": 1,
    "abilityIncrease": 0,
    "channels": [
      "NONE"
    ],
    "dprRule": "none",
    "dpr": "0",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Always or no direct combat trigger",
    "eligibility": "Origin feat grant/background; repeat only when the feat says Repeatable",
    "status": "NO_DIRECT_DPR_EHP",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "No generic DPR/EHP is added unless a listed primitive resolves from the character and encounter context."
  },
  {
    "key": "2024:Tavern Brawler",
    "edition": "2024",
    "name": "Tavern Brawler",
    "category": "Origin",
    "minLevel": 1,
    "abilityIncrease": 0,
    "channels": [
      "DPR"
    ],
    "dprRule": "unarmed_reroll",
    "dpr": "unarmedAttacks*0.9*onceHit",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Eligible Unarmed Strikes/improvised attacks",
    "eligibility": "Origin feat grant/background; repeat only when the feat says Repeatable",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "No generic DPR/EHP is added unless a listed primitive resolves from the character and encounter context."
  },
  {
    "key": "2024:Tough",
    "edition": "2024",
    "name": "Tough",
    "category": "Origin",
    "minLevel": 1,
    "abilityIncrease": 0,
    "channels": [
      "PERSONAL_EHP"
    ],
    "dprRule": "none",
    "dpr": "0",
    "personalEhpRule": "maximum_hp",
    "personalEhp": "resolvedMaxHp ? 0 : 2*level",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Passive maximum-HP increase",
    "eligibility": "Origin feat grant/background; repeat only when the feat says Repeatable",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "No generic DPR/EHP is added unless a listed primitive resolves from the character and encounter context."
  },
  {
    "key": "2024:Archery",
    "edition": "2024",
    "name": "Archery",
    "category": "Fighting Style",
    "minLevel": 1,
    "abilityIncrease": 0,
    "channels": [
      "DPR"
    ],
    "dprRule": "attack_bonus_reprice",
    "dpr": "resolvedAttackBonus ? 0 : attacks*(hit(attackBonus+2,targetAC)-hit(attackBonus,targetAC))*perHitDamage",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Every eligible ranged-weapon attack",
    "eligibility": "Character has a Fighting Style feature and meets the style's equipment condition",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "No generic DPR/EHP is added unless a listed primitive resolves from the character and encounter context."
  },
  {
    "key": "2024:Blind Fighting",
    "edition": "2024",
    "name": "Blind Fighting",
    "category": "Fighting Style",
    "minLevel": 1,
    "abilityIncrease": 0,
    "channels": [
      "DPR"
    ],
    "dprRule": "concealment_recovery",
    "dpr": "blindTargetExposure*attacks*(normalHit-disadvantagedHit)*perHitDamage",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Target within 10 feet is unseen; exposure required",
    "eligibility": "Character has a Fighting Style feature and meets the style's equipment condition",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "No generic DPR/EHP is added unless a listed primitive resolves from the character and encounter context."
  },
  {
    "key": "2024:Defense",
    "edition": "2024",
    "name": "Defense",
    "category": "Fighting Style",
    "minLevel": 1,
    "abilityIncrease": 0,
    "channels": [
      "PERSONAL_EHP"
    ],
    "dprRule": "none",
    "dpr": "0",
    "personalEhpRule": "ac_reprice",
    "personalEhp": "resolvedAC ? 0 : ehpFromAC(baseEhp,AC+1)-ehpFromAC(baseEhp,AC)",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Passive while wearing Light, Medium, or Heavy armor",
    "eligibility": "Character has a Fighting Style feature and meets the style's equipment condition",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "No generic DPR/EHP is added unless a listed primitive resolves from the character and encounter context."
  },
  {
    "key": "2024:Dueling",
    "edition": "2024",
    "name": "Dueling",
    "category": "Fighting Style",
    "minLevel": 1,
    "abilityIncrease": 0,
    "channels": [
      "DPR"
    ],
    "dprRule": "per_hit_damage",
    "dpr": "eligibleOneHandedHits*hitChance*2",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Each hit with an eligible one-handed melee weapon",
    "eligibility": "Character has a Fighting Style feature and meets the style's equipment condition",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "No generic DPR/EHP is added unless a listed primitive resolves from the character and encounter context."
  },
  {
    "key": "2024:Great Weapon Fighting",
    "edition": "2024",
    "name": "Great Weapon Fighting",
    "category": "Fighting Style",
    "minLevel": 1,
    "abilityIncrease": 0,
    "channels": [
      "DPR"
    ],
    "dprRule": "damage_die_floor",
    "dpr": "eligibleTwoHandedHits*hitChance*damageDieFloorDelta(3)",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Every damage roll with an eligible two-handed/versatile melee weapon",
    "eligibility": "Character has a Fighting Style feature and meets the style's equipment condition",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "No generic DPR/EHP is added unless a listed primitive resolves from the character and encounter context."
  },
  {
    "key": "2024:Interception",
    "edition": "2024",
    "name": "Interception",
    "category": "Fighting Style",
    "minLevel": 1,
    "abilityIncrease": 0,
    "channels": [
      "PARTY_EHP"
    ],
    "dprRule": "none",
    "dpr": "0",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "reaction_prevention",
    "partyEhp": "reactionAvailable*adjacentAllyHitExposure*(5.5+PB)",
    "actionBudget": "Reaction",
    "trigger": "Once per round when an adjacent ally is hit and the reaction is available",
    "eligibility": "Character has a Fighting Style feature and meets the style's equipment condition",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "No generic DPR/EHP is added unless a listed primitive resolves from the character and encounter context."
  },
  {
    "key": "2024:Protection",
    "edition": "2024",
    "name": "Protection",
    "category": "Fighting Style",
    "minLevel": 1,
    "abilityIncrease": 0,
    "channels": [
      "PARTY_EHP"
    ],
    "dprRule": "none",
    "dpr": "0",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "reaction_disadvantage",
    "partyEhp": "reactionAvailable*adjacentAllyHitExposure*(normalHit-disadvantagedHit)*incomingDamagePerHit",
    "actionBudget": "Reaction",
    "trigger": "Once per round while wielding a shield and an adjacent ally is attacked",
    "eligibility": "Character has a Fighting Style feature and meets the style's equipment condition",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "No generic DPR/EHP is added unless a listed primitive resolves from the character and encounter context."
  },
  {
    "key": "2024:Thrown Weapon Fighting",
    "edition": "2024",
    "name": "Thrown Weapon Fighting",
    "category": "Fighting Style",
    "minLevel": 1,
    "abilityIncrease": 0,
    "channels": [
      "NONE"
    ],
    "dprRule": "none",
    "dpr": "0",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Always or no direct combat trigger",
    "eligibility": "Character has a Fighting Style feature and meets the style's equipment condition",
    "status": "NO_DIRECT_DPR_EHP",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "No generic DPR/EHP is added unless a listed primitive resolves from the character and encounter context."
  },
  {
    "key": "2024:Two-Weapon Fighting",
    "edition": "2024",
    "name": "Two-Weapon Fighting",
    "category": "Fighting Style",
    "minLevel": 1,
    "abilityIncrease": 0,
    "channels": [
      "DPR"
    ],
    "dprRule": "light_attack_modifier",
    "dpr": "extraLightAttackHitChance*max(0,abilityModNotAlreadyAdded)",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "Light-property extra attack; obey Bonus Action/Nick routing",
    "trigger": "Once when the legal Light extra attack occurs",
    "eligibility": "Character has a Fighting Style feature and meets the style's equipment condition",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "No generic DPR/EHP is added unless a listed primitive resolves from the character and encounter context."
  },
  {
    "key": "2024:Unarmed Fighting",
    "edition": "2024",
    "name": "Unarmed Fighting",
    "category": "Fighting Style",
    "minLevel": 1,
    "abilityIncrease": 0,
    "channels": [
      "DPR"
    ],
    "dprRule": "unarmed_die_reprice",
    "dpr": "unarmedHits*hitChance*(styledUnarmedAverage-currentUnarmedAverage)",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Every eligible Unarmed Strike; use one-hand/two-hand state",
    "eligibility": "Character has a Fighting Style feature and meets the style's equipment condition",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "No generic DPR/EHP is added unless a listed primitive resolves from the character and encounter context."
  },
  {
    "key": "2024:Ability Score Improvement",
    "edition": "2024",
    "name": "Ability Score Improvement",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 2,
    "channels": [
      "NONE"
    ],
    "dprRule": "none",
    "dpr": "0",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Always or no direct combat trigger",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "STAT_ONLY",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +2 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2024:Actor",
    "edition": "2024",
    "name": "Actor",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 1,
    "channels": [
      "NONE"
    ],
    "dprRule": "none",
    "dpr": "0",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Always or no direct combat trigger",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "STAT_ONLY",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2024:Athlete",
    "edition": "2024",
    "name": "Athlete",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 1,
    "channels": [
      "NONE"
    ],
    "dprRule": "none",
    "dpr": "0",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Always or no direct combat trigger",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "STAT_ONLY",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2024:Charger",
    "edition": "2024",
    "name": "Charger",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 1,
    "channels": [
      "DPR"
    ],
    "dprRule": "charger_once_turn",
    "dpr": "moved10FeetBeforeHit*onceHit*0.65*4.5",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "No extra action; rides on an eligible attack after movement",
    "trigger": "At most once per turn when movement/attack conditions are met",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2024:Chef",
    "edition": "2024",
    "name": "Chef",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 1,
    "channels": [
      "PERSONAL_EHP"
    ],
    "dprRule": "none",
    "dpr": "0",
    "personalEhpRule": "rest_healing",
    "personalEhp": "restUseAvailable ? 1.5+PB : 0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "Short Rest / prepared treat",
    "trigger": "Per available rest/treat use; do not exceed authored uses",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2024:Crossbow Expert",
    "edition": "2024",
    "name": "Crossbow Expert",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 1,
    "channels": [
      "DPR"
    ],
    "dprRule": "light_attack_reprice",
    "dpr": "legalLightAttack*0.6*hitChance*(weaponDie+abilityMod)",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "Light-property extra attack; obey Bonus Action/Nick routing",
    "trigger": "Once per turn when the required weapon sequence is legal",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2024:Crusher",
    "edition": "2024",
    "name": "Crusher",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 1,
    "channels": [
      "DPR"
    ],
    "dprRule": "control_uptime",
    "dpr": "onceHit*0.45",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Once per turn on eligible bludgeoning hit; control exposure",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2024:Defensive Duelist",
    "edition": "2024",
    "name": "Defensive Duelist",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 1,
    "channels": [
      "PERSONAL_EHP"
    ],
    "dprRule": "none",
    "dpr": "0",
    "personalEhpRule": "reaction_ac",
    "personalEhp": "reactionAvailable*meleeAttackExposure*baseEhp*0.075",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "Reaction",
    "trigger": "One eligible melee attack per round",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2024:Dual Wielder",
    "edition": "2024",
    "name": "Dual Wielder",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 1,
    "channels": [
      "DPR"
    ],
    "dprRule": "dual_wield_reprice",
    "dpr": "legalExtraAttack*0.45*hitChance*(weaponDie+max(0,abilityMod))",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "Obey Light/Nick/Bonus Action routing",
    "trigger": "Once per legal extra-attack sequence",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2024:Durable",
    "edition": "2024",
    "name": "Durable",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 1,
    "channels": [
      "PERSONAL_EHP"
    ],
    "dprRule": "none",
    "dpr": "0",
    "personalEhpRule": "rest_recovery",
    "personalEhp": "baseEhp*0.045*shortRestAvailability",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Hit Dice recovery on available Short Rests",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2024:Elemental Adept",
    "edition": "2024",
    "name": "Elemental Adept",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 1,
    "channels": [
      "DPR"
    ],
    "dprRule": "resistance_and_die_floor",
    "dpr": "eligibleSpellDpr*0.035*elementExposure",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Eligible spell damage of the chosen type",
    "eligibility": "Use official prerequisite; route only when the character has the required spellcasting/ability context",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2024:Fey Touched",
    "edition": "2024",
    "name": "Fey Touched",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 1,
    "channels": [
      "DPR"
    ],
    "dprRule": "granted_spell_packet",
    "dpr": "round==1 ? (2+level*0.1)/6 : 0",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "One granted spell per Long Rest plus normal spell-slot casting",
    "eligibility": "Use official prerequisite; route only when the character has the required spellcasting/ability context",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2024:Grappler",
    "edition": "2024",
    "name": "Grappler",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 1,
    "channels": [
      "DPR"
    ],
    "dprRule": "grapple_advantage",
    "dpr": "unarmedAttackDpr*0.12*grappleUptime",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "While the target is Grappled by this character",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2024:Great Weapon Master",
    "edition": "2024",
    "name": "Great Weapon Master",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 1,
    "channels": [
      "DPR"
    ],
    "dprRule": "heavy_weapon_master",
    "dpr": "PB*onceHit+0.10*hitChance*perHitDamage",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "Attack action; Hew uses Bonus Action when triggered",
    "trigger": "Heavy Weapon Master once per turn; Hew only on critical hit or reducing a creature to 0 HP",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2024:Heavily Armored",
    "edition": "2024",
    "name": "Heavily Armored",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 1,
    "channels": [
      "PERSONAL_EHP"
    ],
    "dprRule": "none",
    "dpr": "0",
    "personalEhpRule": "equipment_ac_reprice",
    "personalEhp": "resolvedAC ? 0 : baseEhp*0.035",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Passive only when the new armor/shield proficiency changes equipped AC",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2024:Heavy Armor Master",
    "edition": "2024",
    "name": "Heavy Armor Master",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 1,
    "channels": [
      "PERSONAL_EHP"
    ],
    "dprRule": "none",
    "dpr": "0",
    "personalEhpRule": "physical_damage_reduction",
    "personalEhp": "eligiblePhysicalHitCount*PB",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Each eligible incoming physical hit while wearing Heavy armor",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2024:Inspiring Leader",
    "edition": "2024",
    "name": "Inspiring Leader",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 1,
    "channels": [
      "PARTY_EHP"
    ],
    "dprRule": "none",
    "dpr": "0",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "temporary_hp",
    "partyEhp": "min(partySize,6)*(level+CHA_mod)*restUses",
    "actionBudget": "10-minute preparation / rest window",
    "trigger": "Once per Short or Long Rest per recipient; temporary HP does not stack",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2024:Keen Mind",
    "edition": "2024",
    "name": "Keen Mind",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 1,
    "channels": [
      "NONE"
    ],
    "dprRule": "none",
    "dpr": "0",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Always or no direct combat trigger",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "STAT_ONLY",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2024:Lightly Armored",
    "edition": "2024",
    "name": "Lightly Armored",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 1,
    "channels": [
      "NONE"
    ],
    "dprRule": "none",
    "dpr": "0",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Always or no direct combat trigger",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "STAT_ONLY",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2024:Mage Slayer",
    "edition": "2024",
    "name": "Mage Slayer",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 1,
    "channels": [
      "DPR",
      "PERSONAL_EHP"
    ],
    "dprRule": "reactive_attack",
    "dpr": "reactionAvailable*casterExposure*0.22*hitChance*perHitDamage",
    "personalEhpRule": "mental_save_guard",
    "personalEhp": "failedMentalSaveExposure*preventedDamageOrControlValue",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "Reaction where applicable",
    "trigger": "Only against qualifying spellcasting/magical effects",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2024:Martial Weapon Training",
    "edition": "2024",
    "name": "Martial Weapon Training",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 1,
    "channels": [
      "NONE"
    ],
    "dprRule": "none",
    "dpr": "0",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Always or no direct combat trigger",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "STAT_ONLY",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2024:Medium Armor Master",
    "edition": "2024",
    "name": "Medium Armor Master",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 1,
    "channels": [
      "PERSONAL_EHP"
    ],
    "dprRule": "none",
    "dpr": "0",
    "personalEhpRule": "equipment_ac_reprice",
    "personalEhp": "resolvedAC ? 0 : baseEhp*0.035",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Passive only when the new armor/shield proficiency changes equipped AC",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2024:Moderately Armored",
    "edition": "2024",
    "name": "Moderately Armored",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 1,
    "channels": [
      "PERSONAL_EHP"
    ],
    "dprRule": "none",
    "dpr": "0",
    "personalEhpRule": "equipment_ac_reprice",
    "personalEhp": "resolvedAC ? 0 : baseEhp*0.035",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Passive only when the new armor/shield proficiency changes equipped AC",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2024:Mounted Combatant",
    "edition": "2024",
    "name": "Mounted Combatant",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 1,
    "channels": [
      "DPR",
      "PERSONAL_EHP"
    ],
    "dprRule": "mounted_advantage",
    "dpr": "mountedUptime*baseDpr*0.03",
    "personalEhpRule": "mount_redirection",
    "personalEhp": "mountedUptime*mountProtectionValue",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Only while mounted and the target/mount conditions apply",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2024:Observant",
    "edition": "2024",
    "name": "Observant",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 1,
    "channels": [
      "NONE"
    ],
    "dprRule": "none",
    "dpr": "0",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Always or no direct combat trigger",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "STAT_ONLY",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2024:Piercer",
    "edition": "2024",
    "name": "Piercer",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 1,
    "channels": [
      "DPR"
    ],
    "dprRule": "piercing_reroll_crit",
    "dpr": "eligiblePiercingAttacks*0.65*onceHit",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Once-per-turn die reroll plus eligible critical-hit die",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2024:Poisoner",
    "edition": "2024",
    "name": "Poisoner",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 1,
    "channels": [
      "DPR"
    ],
    "dprRule": "poison_application",
    "dpr": "round<=2 && bonusActionAvailable ? 2.2 : 0",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "Bonus Action to apply poison",
    "trigger": "Only while poison doses and an eligible weapon are available",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2024:Polearm Master",
    "edition": "2024",
    "name": "Polearm Master",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 1,
    "channels": [
      "DPR"
    ],
    "dprRule": "polearm_bonus_and_reaction",
    "dpr": "bonusActionAvailable*hitChance*(2.5+abilityMod)+reactionAvailable*0.22*hitChance*perHitDamage",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "Bonus Action + Reaction",
    "trigger": "One haft attack per turn and qualifying reach-entry reaction",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2024:Resilient",
    "edition": "2024",
    "name": "Resilient",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 1,
    "channels": [
      "PERSONAL_EHP"
    ],
    "dprRule": "none",
    "dpr": "0",
    "personalEhpRule": "save_proficiency_reprice",
    "personalEhp": "resolvedSaves ? 0 : baseEhp*0.035",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Passive; only failed-save exposure for the chosen ability",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2024:Ritual Caster",
    "edition": "2024",
    "name": "Ritual Caster",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 1,
    "channels": [
      "NONE"
    ],
    "dprRule": "none",
    "dpr": "0",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Always or no direct combat trigger",
    "eligibility": "Use official prerequisite; route only when the character has the required spellcasting/ability context",
    "status": "STAT_ONLY",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2024:Sentinel",
    "edition": "2024",
    "name": "Sentinel",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 1,
    "channels": [
      "DPR"
    ],
    "dprRule": "reaction_attack",
    "dpr": "reactionAvailable*triggerExposure*0.25*hitChance*perHitDamage",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "Reaction",
    "trigger": "At most once per round when a Sentinel trigger occurs",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2024:Shadow Touched",
    "edition": "2024",
    "name": "Shadow Touched",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 1,
    "channels": [
      "DPR"
    ],
    "dprRule": "granted_spell_packet",
    "dpr": "round==1 ? (2+level*0.1)/6 : 0",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "One granted spell per Long Rest plus normal spell-slot casting",
    "eligibility": "Use official prerequisite; route only when the character has the required spellcasting/ability context",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2024:Sharpshooter",
    "edition": "2024",
    "name": "Sharpshooter",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 1,
    "channels": [
      "DPR"
    ],
    "dprRule": "cover_range_recovery",
    "dpr": "min(0.10,hitChance)*attacks*perHitDamage*coverExposure+(hitChance-pow(hitChance,2))*attacks*perHitDamage*longOrCloseExposure",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Only when cover, long range, or adjacent-enemy disadvantage would otherwise apply; no -5/+10",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2024:Shield Master",
    "edition": "2024",
    "name": "Shield Master",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 1,
    "channels": [
      "PERSONAL_EHP"
    ],
    "dprRule": "none",
    "dpr": "0",
    "personalEhpRule": "shield_save_reprice",
    "personalEhp": "shieldEquipped*baseEhp*0.045*DexSaveExposure",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "Shield Bash follows an Attack action; reaction/deflection as authored",
    "trigger": "Only while wielding a shield and a qualifying save/attack occurs",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2024:Skill Expert",
    "edition": "2024",
    "name": "Skill Expert",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 1,
    "channels": [
      "NONE"
    ],
    "dprRule": "none",
    "dpr": "0",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Always or no direct combat trigger",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "STAT_ONLY",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2024:Skulker",
    "edition": "2024",
    "name": "Skulker",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 1,
    "channels": [
      "DPR"
    ],
    "dprRule": "concealment_recovery",
    "dpr": "rangedDpr*0.02*concealmentExposure",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Only in the feat's concealment/hidden-attack conditions",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2024:Slasher",
    "edition": "2024",
    "name": "Slasher",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 1,
    "channels": [
      "DPR"
    ],
    "dprRule": "control_uptime",
    "dpr": "eligibleSlashingAttacks*0.35*onceHit",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Once per turn speed reduction plus eligible critical effect",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2024:Speedy",
    "edition": "2024",
    "name": "Speedy",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 1,
    "channels": [
      "NONE"
    ],
    "dprRule": "none",
    "dpr": "0",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Always or no direct combat trigger",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "STAT_ONLY",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2024:Spell Sniper",
    "edition": "2024",
    "name": "Spell Sniper",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 1,
    "channels": [
      "DPR"
    ],
    "dprRule": "spell_cover_range_recovery",
    "dpr": "spellAttackDpr*0.025*coverOrRangeExposure",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Only when spell-attack cover, melee, or range penalties would apply",
    "eligibility": "Use official prerequisite; route only when the character has the required spellcasting/ability context",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2024:Telekinetic",
    "edition": "2024",
    "name": "Telekinetic",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 1,
    "channels": [
      "DPR"
    ],
    "dprRule": "bonus_action_control",
    "dpr": "bonusActionAvailable*0.45*controlExposure",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "Bonus Action",
    "trigger": "Once per turn when shove/control has a legal target",
    "eligibility": "Use official prerequisite; route only when the character has the required spellcasting/ability context",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2024:Telepathic",
    "edition": "2024",
    "name": "Telepathic",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 1,
    "channels": [
      "NONE"
    ],
    "dprRule": "none",
    "dpr": "0",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Always or no direct combat trigger",
    "eligibility": "Use official prerequisite; route only when the character has the required spellcasting/ability context",
    "status": "STAT_ONLY",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2024:War Caster",
    "edition": "2024",
    "name": "War Caster",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 1,
    "channels": [
      "DPR",
      "PERSONAL_EHP"
    ],
    "dprRule": "concentration_and_reactive_spell",
    "dpr": "casterDpr*0.045*concentrationOrOpportunityExposure",
    "personalEhpRule": "concentration_uptime",
    "personalEhp": "preventedConcentrationLossValue",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "Reaction for Reactive Spell",
    "trigger": "Concentration saves and legal opportunity-spell triggers",
    "eligibility": "Use official prerequisite; route only when the character has the required spellcasting/ability context",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2024:Weapon Master",
    "edition": "2024",
    "name": "Weapon Master",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 1,
    "channels": [
      "DPR"
    ],
    "dprRule": "weapon_mastery_reprice",
    "dpr": "resolvedAttackPackets ? 0 : weaponDpr*0.01",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Selected mastery property on eligible attacks",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2024:Boon of Combat Prowess",
    "edition": "2024",
    "name": "Boon of Combat Prowess",
    "category": "Epic Boon",
    "minLevel": 19,
    "abilityIncrease": 1,
    "channels": [
      "DPR"
    ],
    "dprRule": "peerless_aim",
    "dpr": "perHitDamage*(1-pow(hitChance,attackCount))",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Once per turn, convert one missed attack roll to a hit",
    "eligibility": "Character level 19+",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2024:Boon of Dimensional Travel",
    "edition": "2024",
    "name": "Boon of Dimensional Travel",
    "category": "Epic Boon",
    "minLevel": 19,
    "abilityIncrease": 1,
    "channels": [
      "NONE"
    ],
    "dprRule": "none",
    "dpr": "0",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Teleport after Attack or Magic action; no generic DPR/EHP without positioning exposure",
    "eligibility": "Character level 19+",
    "status": "STAT_ONLY",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2024:Boon of Energy Resistance",
    "edition": "2024",
    "name": "Boon of Energy Resistance",
    "category": "Epic Boon",
    "minLevel": 19,
    "abilityIncrease": 1,
    "channels": [
      "DPR",
      "PERSONAL_EHP"
    ],
    "dprRule": "energy_redirection",
    "dpr": "reactionAvailable*eligibleEnergyHitExposure*redirectedDamage",
    "personalEhpRule": "typed_resistance",
    "personalEhp": "baseEhp/(1-0.5*incomingChosenTypeShare)-baseEhp",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "Reaction for redirection",
    "trigger": "Chosen energy types and reaction timing read from the character",
    "eligibility": "Character level 19+",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2024:Boon of Fate",
    "edition": "2024",
    "name": "Boon of Fate",
    "category": "Epic Boon",
    "minLevel": 19,
    "abilityIncrease": 1,
    "channels": [
      "DPR",
      "PARTY_EHP"
    ],
    "dprRule": "d20_shift",
    "dpr": "improveFateAvailable*d20ShiftAttackGain('2d4')",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "d20_shift_prevention",
    "partyEhp": "improveFateAvailable*d20ShiftSavePrevention('2d4')",
    "actionBudget": "None/passive",
    "trigger": "Once until Initiative or a Short/Long Rest resets it",
    "eligibility": "Character level 19+",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2024:Boon of Fortitude",
    "edition": "2024",
    "name": "Boon of Fortitude",
    "category": "Epic Boon",
    "minLevel": 19,
    "abilityIncrease": 1,
    "channels": [
      "PERSONAL_EHP"
    ],
    "dprRule": "none",
    "dpr": "0",
    "personalEhpRule": "fortified_health",
    "personalEhp": "(resolvedMaxHp?0:40)+healingEvents*CON_mod",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "+40 max HP; extra CON-mod healing at most once per turn",
    "eligibility": "Character level 19+",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2024:Boon of Irresistible Offense",
    "edition": "2024",
    "name": "Boon of Irresistible Offense",
    "category": "Epic Boon",
    "minLevel": 19,
    "abilityIncrease": 1,
    "channels": [
      "DPR"
    ],
    "dprRule": "ignore_bps_resistance_and_nat20",
    "dpr": "0.5*bpsRawDpr*resistanceExposure+0.05*attackCount*increasedAbilityScore",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Always ignore B/P/S resistance; extra damage only on a natural 20",
    "eligibility": "Character level 19+",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2024:Boon of Recovery",
    "edition": "2024",
    "name": "Boon of Recovery",
    "category": "Epic Boon",
    "minLevel": 19,
    "abilityIncrease": 1,
    "channels": [
      "PERSONAL_EHP"
    ],
    "dprRule": "none",
    "dpr": "0",
    "personalEhpRule": "recovery_pool",
    "personalEhp": "dropToZeroExposure*(0.5*maxHp+1)+bonusActionHealingDiceSpent*5.5",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "Bonus Action for healing-die pool",
    "trigger": "Drop-to-1 recovery once per Long Rest; 10d10 healing pool per Long Rest",
    "eligibility": "Character level 19+",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2024:Boon of Skill",
    "edition": "2024",
    "name": "Boon of Skill",
    "category": "Epic Boon",
    "minLevel": 19,
    "abilityIncrease": 1,
    "channels": [
      "NONE"
    ],
    "dprRule": "none",
    "dpr": "0",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Skill utility; no direct combat DPR/EHP unless an imported action explicitly uses it",
    "eligibility": "Character level 19+",
    "status": "STAT_ONLY",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2024:Boon of Speed",
    "edition": "2024",
    "name": "Boon of Speed",
    "category": "Epic Boon",
    "minLevel": 19,
    "abilityIncrease": 1,
    "channels": [
      "NONE"
    ],
    "dprRule": "none",
    "dpr": "0",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Movement/escape utility; no generic DPR/EHP without positioning exposure",
    "eligibility": "Character level 19+",
    "status": "STAT_ONLY",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2024:Boon of Spell Recall",
    "edition": "2024",
    "name": "Boon of Spell Recall",
    "category": "Epic Boon",
    "minLevel": 19,
    "abilityIncrease": 1,
    "channels": [
      "DPR"
    ],
    "dprRule": "slot_recall_resource",
    "dpr": "sum(level1to4SpellDamageByCast*0.25)",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Each level 1-4 slot has a 25% non-expenditure chance; price across the rest schedule",
    "eligibility": "Character level 19+ and Spellcasting feature",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2024:Boon of the Night Spirit",
    "edition": "2024",
    "name": "Boon of the Night Spirit",
    "category": "Epic Boon",
    "minLevel": 19,
    "abilityIncrease": 1,
    "channels": [
      "DPR",
      "PERSONAL_EHP"
    ],
    "dprRule": "shadow_advantage",
    "dpr": "dimDarkUptime*firstAttackAdvantageGain",
    "personalEhpRule": "shadow_resistance",
    "personalEhp": "baseEhp/(1-0.5*incomingNonPsychicRadiantShare*dimDarkUptime)-baseEhp",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "Bonus Action for invisibility",
    "trigger": "Only in Dim Light or Darkness; resistance excludes Psychic and Radiant",
    "eligibility": "Character level 19+",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2024:Boon of Truesight",
    "edition": "2024",
    "name": "Boon of Truesight",
    "category": "Epic Boon",
    "minLevel": 19,
    "abilityIncrease": 1,
    "channels": [
      "DPR",
      "PERSONAL_EHP"
    ],
    "dprRule": "concealment_recovery",
    "dpr": "truesightExposure*concealmentAttackLossRecovered",
    "personalEhpRule": "illusion_concealment_prevention",
    "personalEhp": "truesightExposure*concealmentDamagePrevented",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Only effects within 60 feet that Truesight actually resolves",
    "eligibility": "Character level 19+",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2014:Actor",
    "edition": "2014",
    "name": "Actor",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 1,
    "channels": [
      "NONE"
    ],
    "dprRule": "none",
    "dpr": "0",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Always or no direct combat trigger",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "STAT_ONLY",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2014:Alert",
    "edition": "2014",
    "name": "Alert",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 0,
    "channels": [
      "DPR"
    ],
    "dprRule": "initiative_swing",
    "dpr": "round==1 ? baseDpr*0.015 : 0",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "+5 Initiative; first-round exposure",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "No generic DPR/EHP is added unless a listed primitive resolves from the character and encounter context."
  },
  {
    "key": "2014:Athlete",
    "edition": "2014",
    "name": "Athlete",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 1,
    "channels": [
      "NONE"
    ],
    "dprRule": "none",
    "dpr": "0",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Always or no direct combat trigger",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "STAT_ONLY",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2014:Charger",
    "edition": "2014",
    "name": "Charger",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 0,
    "channels": [
      "DPR"
    ],
    "dprRule": "legacy_charger",
    "dpr": "dashActionUsed*bonusActionAvailable*0.25*onceHit*5",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "Action: Dash + Bonus Action attack",
    "trigger": "At most once per turn when movement/attack conditions are met",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "No generic DPR/EHP is added unless a listed primitive resolves from the character and encounter context."
  },
  {
    "key": "2014:Crossbow Expert",
    "edition": "2014",
    "name": "Crossbow Expert",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 0,
    "channels": [
      "DPR"
    ],
    "dprRule": "legacy_bonus_attack",
    "dpr": "bonusActionAvailable*hitChance*(weaponDie+abilityMod)",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "Bonus Action",
    "trigger": "Once per turn when the required weapon sequence is legal",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "No generic DPR/EHP is added unless a listed primitive resolves from the character and encounter context."
  },
  {
    "key": "2014:Defensive Duelist",
    "edition": "2014",
    "name": "Defensive Duelist",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 0,
    "channels": [
      "PERSONAL_EHP"
    ],
    "dprRule": "none",
    "dpr": "0",
    "personalEhpRule": "reaction_ac",
    "personalEhp": "reactionAvailable*meleeAttackExposure*baseEhp*0.075",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "Reaction",
    "trigger": "One eligible melee attack per round",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "No generic DPR/EHP is added unless a listed primitive resolves from the character and encounter context."
  },
  {
    "key": "2014:Dual Wielder",
    "edition": "2014",
    "name": "Dual Wielder",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 0,
    "channels": [
      "DPR"
    ],
    "dprRule": "dual_wield_reprice",
    "dpr": "legalExtraAttack*0.45*hitChance*(weaponDie+max(0,abilityMod))",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "Obey Light/Nick/Bonus Action routing",
    "trigger": "Once per legal extra-attack sequence",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "No generic DPR/EHP is added unless a listed primitive resolves from the character and encounter context."
  },
  {
    "key": "2014:Dungeon Delver",
    "edition": "2014",
    "name": "Dungeon Delver",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 0,
    "channels": [
      "NONE"
    ],
    "dprRule": "none",
    "dpr": "0",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Always or no direct combat trigger",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "NO_DIRECT_DPR_EHP",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "No generic DPR/EHP is added unless a listed primitive resolves from the character and encounter context."
  },
  {
    "key": "2014:Durable",
    "edition": "2014",
    "name": "Durable",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 1,
    "channels": [
      "PERSONAL_EHP"
    ],
    "dprRule": "none",
    "dpr": "0",
    "personalEhpRule": "rest_recovery",
    "personalEhp": "baseEhp*0.045*shortRestAvailability",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Hit Dice recovery on available Short Rests",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2014:Elemental Adept",
    "edition": "2014",
    "name": "Elemental Adept",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 0,
    "channels": [
      "DPR"
    ],
    "dprRule": "resistance_and_die_floor",
    "dpr": "eligibleSpellDpr*0.035*elementExposure",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Eligible spell damage of the chosen type",
    "eligibility": "Use official prerequisite; route only when the character has the required spellcasting/ability context",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "No generic DPR/EHP is added unless a listed primitive resolves from the character and encounter context."
  },
  {
    "key": "2014:Grappler",
    "edition": "2014",
    "name": "Grappler",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 0,
    "channels": [
      "DPR"
    ],
    "dprRule": "grapple_advantage",
    "dpr": "unarmedAttackDpr*0.12*grappleUptime",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "While the target is Grappled by this character",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "No generic DPR/EHP is added unless a listed primitive resolves from the character and encounter context."
  },
  {
    "key": "2014:Great Weapon Master",
    "edition": "2014",
    "name": "Great Weapon Master",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 0,
    "channels": [
      "DPR"
    ],
    "dprRule": "legacy_power_attack_ev",
    "dpr": "attacks*max(0,hit(attackBonus-5,targetAC)*(perHitDamage+10)-hit(attackBonus,targetAC)*perHitDamage)+0.12*hitChance*perHitDamage",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "Attack action; Hew uses Bonus Action when triggered",
    "trigger": "Choose normal or -5/+10 per attack by higher expected value",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "No generic DPR/EHP is added unless a listed primitive resolves from the character and encounter context."
  },
  {
    "key": "2014:Healer",
    "edition": "2014",
    "name": "Healer",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 0,
    "channels": [
      "PARTY_EHP"
    ],
    "dprRule": "none",
    "dpr": "0",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "battle_medic",
    "partyEhp": "partySize*(7.5+floor((level+1)/2))*availableUsesPerRestCycle",
    "actionBudget": "Utilize Action for Battle Medic",
    "trigger": "Per creature per Short/Long Rest; healing rerolls use actual healing packets",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "No generic DPR/EHP is added unless a listed primitive resolves from the character and encounter context."
  },
  {
    "key": "2014:Heavily Armored",
    "edition": "2014",
    "name": "Heavily Armored",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 1,
    "channels": [
      "PERSONAL_EHP"
    ],
    "dprRule": "none",
    "dpr": "0",
    "personalEhpRule": "equipment_ac_reprice",
    "personalEhp": "resolvedAC ? 0 : baseEhp*0.035",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Passive only when the new armor/shield proficiency changes equipped AC",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2014:Heavy Armor Master",
    "edition": "2014",
    "name": "Heavy Armor Master",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 1,
    "channels": [
      "PERSONAL_EHP"
    ],
    "dprRule": "none",
    "dpr": "0",
    "personalEhpRule": "physical_damage_reduction",
    "personalEhp": "eligiblePhysicalHitCount*3",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Each eligible incoming physical hit while wearing Heavy armor",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2014:Inspiring Leader",
    "edition": "2014",
    "name": "Inspiring Leader",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 0,
    "channels": [
      "PARTY_EHP"
    ],
    "dprRule": "none",
    "dpr": "0",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "temporary_hp",
    "partyEhp": "min(partySize,6)*(level+CHA_mod)*restUses",
    "actionBudget": "10-minute preparation / rest window",
    "trigger": "Once per Short or Long Rest per recipient; temporary HP does not stack",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "No generic DPR/EHP is added unless a listed primitive resolves from the character and encounter context."
  },
  {
    "key": "2014:Keen Mind",
    "edition": "2014",
    "name": "Keen Mind",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 1,
    "channels": [
      "NONE"
    ],
    "dprRule": "none",
    "dpr": "0",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Always or no direct combat trigger",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "STAT_ONLY",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2014:Lightly Armored",
    "edition": "2014",
    "name": "Lightly Armored",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 1,
    "channels": [
      "NONE"
    ],
    "dprRule": "none",
    "dpr": "0",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Always or no direct combat trigger",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "STAT_ONLY",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2014:Linguist",
    "edition": "2014",
    "name": "Linguist",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 1,
    "channels": [
      "NONE"
    ],
    "dprRule": "none",
    "dpr": "0",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Always or no direct combat trigger",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "STAT_ONLY",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2014:Lucky",
    "edition": "2014",
    "name": "Lucky",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 0,
    "channels": [
      "DPR",
      "PERSONAL_EHP"
    ],
    "dprRule": "luck_attack_reprice",
    "dpr": "luckPointsUsedOnAttacks*attackRerollGain",
    "personalEhpRule": "luck_defense_reprice",
    "personalEhp": "luckPointsUsedOnDefense*preventedDamagePerPoint",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "3 Luck points per Long Rest",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "No generic DPR/EHP is added unless a listed primitive resolves from the character and encounter context."
  },
  {
    "key": "2014:Mage Slayer",
    "edition": "2014",
    "name": "Mage Slayer",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 0,
    "channels": [
      "DPR",
      "PERSONAL_EHP"
    ],
    "dprRule": "reactive_attack",
    "dpr": "reactionAvailable*casterExposure*0.22*hitChance*perHitDamage",
    "personalEhpRule": "mental_save_guard",
    "personalEhp": "failedMentalSaveExposure*preventedDamageOrControlValue",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "Reaction where applicable",
    "trigger": "Only against qualifying spellcasting/magical effects",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "No generic DPR/EHP is added unless a listed primitive resolves from the character and encounter context."
  },
  {
    "key": "2014:Magic Initiate",
    "edition": "2014",
    "name": "Magic Initiate",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 0,
    "channels": [
      "DPR"
    ],
    "dprRule": "granted_spell_packet",
    "dpr": "round==1 ? (2.5+level*0.12)/6 : 0",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "One granted level-1 spell per Long Rest plus chosen cantrip action packets",
    "eligibility": "Use official prerequisite; route only when the character has the required spellcasting/ability context",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "No generic DPR/EHP is added unless a listed primitive resolves from the character and encounter context."
  },
  {
    "key": "2014:Martial Adept",
    "edition": "2014",
    "name": "Martial Adept",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 0,
    "channels": [
      "DPR"
    ],
    "dprRule": "superiority_die",
    "dpr": "round<=2 && eligibleWeaponAttack ? 0.75 : 0",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "One superiority die per Short/Long Rest; selected maneuver must be legal",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "No generic DPR/EHP is added unless a listed primitive resolves from the character and encounter context."
  },
  {
    "key": "2014:Medium Armor Master",
    "edition": "2014",
    "name": "Medium Armor Master",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 0,
    "channels": [
      "PERSONAL_EHP"
    ],
    "dprRule": "none",
    "dpr": "0",
    "personalEhpRule": "equipment_ac_reprice",
    "personalEhp": "resolvedAC ? 0 : baseEhp*0.035",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Passive only when the new armor/shield proficiency changes equipped AC",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "No generic DPR/EHP is added unless a listed primitive resolves from the character and encounter context."
  },
  {
    "key": "2014:Mobile",
    "edition": "2014",
    "name": "Mobile",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 0,
    "channels": [
      "NONE"
    ],
    "dprRule": "none",
    "dpr": "0",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Always or no direct combat trigger",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "NO_DIRECT_DPR_EHP",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "No generic DPR/EHP is added unless a listed primitive resolves from the character and encounter context."
  },
  {
    "key": "2014:Moderately Armored",
    "edition": "2014",
    "name": "Moderately Armored",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 1,
    "channels": [
      "PERSONAL_EHP"
    ],
    "dprRule": "none",
    "dpr": "0",
    "personalEhpRule": "equipment_ac_reprice",
    "personalEhp": "resolvedAC ? 0 : baseEhp*0.035",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Passive only when the new armor/shield proficiency changes equipped AC",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2014:Mounted Combatant",
    "edition": "2014",
    "name": "Mounted Combatant",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 0,
    "channels": [
      "DPR",
      "PERSONAL_EHP"
    ],
    "dprRule": "mounted_advantage",
    "dpr": "mountedUptime*baseDpr*0.03",
    "personalEhpRule": "mount_redirection",
    "personalEhp": "mountedUptime*mountProtectionValue",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Only while mounted and the target/mount conditions apply",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "No generic DPR/EHP is added unless a listed primitive resolves from the character and encounter context."
  },
  {
    "key": "2014:Observant",
    "edition": "2014",
    "name": "Observant",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 1,
    "channels": [
      "NONE"
    ],
    "dprRule": "none",
    "dpr": "0",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Always or no direct combat trigger",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "STAT_ONLY",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2014:Polearm Master",
    "edition": "2014",
    "name": "Polearm Master",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 0,
    "channels": [
      "DPR"
    ],
    "dprRule": "polearm_bonus_and_reaction",
    "dpr": "bonusActionAvailable*hitChance*(2.5+abilityMod)+reactionAvailable*0.22*hitChance*perHitDamage",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "Bonus Action + Reaction",
    "trigger": "One haft attack per turn and qualifying reach-entry reaction",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "No generic DPR/EHP is added unless a listed primitive resolves from the character and encounter context."
  },
  {
    "key": "2014:Resilient",
    "edition": "2014",
    "name": "Resilient",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 1,
    "channels": [
      "PERSONAL_EHP"
    ],
    "dprRule": "none",
    "dpr": "0",
    "personalEhpRule": "save_proficiency_reprice",
    "personalEhp": "resolvedSaves ? 0 : baseEhp*0.035",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Passive; only failed-save exposure for the chosen ability",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2014:Ritual Caster",
    "edition": "2014",
    "name": "Ritual Caster",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 0,
    "channels": [
      "NONE"
    ],
    "dprRule": "none",
    "dpr": "0",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Always or no direct combat trigger",
    "eligibility": "Use official prerequisite; route only when the character has the required spellcasting/ability context",
    "status": "NO_DIRECT_DPR_EHP",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "No generic DPR/EHP is added unless a listed primitive resolves from the character and encounter context."
  },
  {
    "key": "2014:Savage Attacker",
    "edition": "2014",
    "name": "Savage Attacker",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 0,
    "channels": [
      "DPR"
    ],
    "dprRule": "damage_dice_advantage",
    "dpr": "eligibleWeaponTurn*1.55*onceHit",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Once per turn on eligible weapon damage dice",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "No generic DPR/EHP is added unless a listed primitive resolves from the character and encounter context."
  },
  {
    "key": "2014:Sentinel",
    "edition": "2014",
    "name": "Sentinel",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 0,
    "channels": [
      "DPR"
    ],
    "dprRule": "reaction_attack",
    "dpr": "reactionAvailable*triggerExposure*0.25*hitChance*perHitDamage",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "Reaction",
    "trigger": "At most once per round when a Sentinel trigger occurs",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "No generic DPR/EHP is added unless a listed primitive resolves from the character and encounter context."
  },
  {
    "key": "2014:Sharpshooter",
    "edition": "2014",
    "name": "Sharpshooter",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 0,
    "channels": [
      "DPR"
    ],
    "dprRule": "legacy_power_attack_ev",
    "dpr": "attacks*max(0,hit(attackBonus-5,targetAC)*(perHitDamage+10)-hit(attackBonus,targetAC)*perHitDamage)",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Choose normal or -5/+10 per attack by higher expected value",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "No generic DPR/EHP is added unless a listed primitive resolves from the character and encounter context."
  },
  {
    "key": "2014:Shield Master",
    "edition": "2014",
    "name": "Shield Master",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 0,
    "channels": [
      "PERSONAL_EHP"
    ],
    "dprRule": "none",
    "dpr": "0",
    "personalEhpRule": "shield_save_reprice",
    "personalEhp": "shieldEquipped*baseEhp*0.045*DexSaveExposure",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "Shield Bash follows an Attack action; reaction/deflection as authored",
    "trigger": "Only while wielding a shield and a qualifying save/attack occurs",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "No generic DPR/EHP is added unless a listed primitive resolves from the character and encounter context."
  },
  {
    "key": "2014:Skilled",
    "edition": "2014",
    "name": "Skilled",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 0,
    "channels": [
      "NONE"
    ],
    "dprRule": "none",
    "dpr": "0",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Always or no direct combat trigger",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "NO_DIRECT_DPR_EHP",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "No generic DPR/EHP is added unless a listed primitive resolves from the character and encounter context."
  },
  {
    "key": "2014:Skulker",
    "edition": "2014",
    "name": "Skulker",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 0,
    "channels": [
      "DPR"
    ],
    "dprRule": "concealment_recovery",
    "dpr": "rangedDpr*0.02*concealmentExposure",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Only in the feat's concealment/hidden-attack conditions",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "No generic DPR/EHP is added unless a listed primitive resolves from the character and encounter context."
  },
  {
    "key": "2014:Spell Sniper",
    "edition": "2014",
    "name": "Spell Sniper",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 0,
    "channels": [
      "DPR"
    ],
    "dprRule": "spell_cover_range_recovery",
    "dpr": "spellAttackDpr*0.025*coverOrRangeExposure",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Only when spell-attack cover, melee, or range penalties would apply",
    "eligibility": "Use official prerequisite; route only when the character has the required spellcasting/ability context",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "No generic DPR/EHP is added unless a listed primitive resolves from the character and encounter context."
  },
  {
    "key": "2014:Tavern Brawler",
    "edition": "2014",
    "name": "Tavern Brawler",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 1,
    "channels": [
      "DPR"
    ],
    "dprRule": "unarmed_reroll",
    "dpr": "unarmedAttacks*0.9*onceHit",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Eligible Unarmed Strikes/improvised attacks",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  },
  {
    "key": "2014:Tough",
    "edition": "2014",
    "name": "Tough",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 0,
    "channels": [
      "PERSONAL_EHP"
    ],
    "dprRule": "none",
    "dpr": "0",
    "personalEhpRule": "maximum_hp",
    "personalEhp": "resolvedMaxHp ? 0 : 2*level",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Passive maximum-HP increase",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "No generic DPR/EHP is added unless a listed primitive resolves from the character and encounter context."
  },
  {
    "key": "2014:War Caster",
    "edition": "2014",
    "name": "War Caster",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 0,
    "channels": [
      "DPR",
      "PERSONAL_EHP"
    ],
    "dprRule": "concentration_and_reactive_spell",
    "dpr": "casterDpr*0.045*concentrationOrOpportunityExposure",
    "personalEhpRule": "concentration_uptime",
    "personalEhp": "preventedConcentrationLossValue",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "Reaction for Reactive Spell",
    "trigger": "Concentration saves and legal opportunity-spell triggers",
    "eligibility": "Use official prerequisite; route only when the character has the required spellcasting/ability context",
    "status": "FORMULA_PRICED",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "No generic DPR/EHP is added unless a listed primitive resolves from the character and encounter context."
  },
  {
    "key": "2014:Weapon Master",
    "edition": "2014",
    "name": "Weapon Master",
    "category": "General",
    "minLevel": 4,
    "abilityIncrease": 1,
    "channels": [
      "NONE"
    ],
    "dprRule": "none",
    "dpr": "0",
    "personalEhpRule": "none",
    "personalEhp": "0",
    "partyEhpRule": "none",
    "partyEhp": "0",
    "actionBudget": "None/passive",
    "trigger": "Weapon proficiency only; no generic DPR if the actor's attack packets are already legal",
    "eligibility": "Use official feat prerequisite and the character's class, proficiency, equipment, and ability records",
    "status": "STAT_ONLY",
    "doubleCountGuard": "Read final actor stats first. If ability scores, attack bonus, save DC, AC, saves, or max HP already include this feat, do not add that static benefit again.",
    "note": "Ability increase +1 is actor-first: apply it only when constructing unresolved stats; never add it after reading final character statistics."
  }
];

/**
 * The grammar the evaluator must implement, straight from the workbook's dictionary rows.
 *
 * Kept in the generated file so the contract and the table cannot drift apart: an expression that
 * uses a token missing from here is a signal the workbook moved and the evaluator has not.
 */
export const FEAT_EXPRESSION_DICTIONARY: { token: string; meaning: string }[] =
[
  {
    "token": "FEAT PRICING EXPRESSION DICTIONARY — REQUIRED APP GRAMMAR",
    "meaning": "FEAT PRICING EXPRESSION DICTIONARY — REQUIRED APP GRAMMAR"
  },
  {
    "token": "kind",
    "meaning": "definition"
  },
  {
    "token": "contract",
    "meaning": "If a required variable is absent, return NEEDS_INPUT for that channel; never convert missing context to zero."
  },
  {
    "token": "contract",
    "meaning": "Read final actor ability scores, attack bonus, save DC, AC, saves, and max HP before applying feat deltas."
  },
  {
    "token": "contract",
    "meaning": "When a resolved* flag is true, its static feat contribution is already present and the fallback term returns 0."
  },
  {
    "token": "output",
    "meaning": "Expected damage added by this feat after accuracy, action budget, trigger frequency, uses, and target exposure."
  },
  {
    "token": "output",
    "meaning": "EHP, healing, or prevention retained on the owning PC only."
  },
  {
    "token": "output",
    "meaning": "Explicitly shared EHP, healing, or prevention; identify the source and distribute only the authored shared amount."
  },
  {
    "token": "variable",
    "meaning": "Total character level."
  },
  {
    "token": "variable",
    "meaning": "Character proficiency bonus."
  },
  {
    "token": "variable",
    "meaning": "Number of PCs in the tested party."
  },
  {
    "token": "variable",
    "meaning": "Encounter round number, starting at 1."
  },
  {
    "token": "variable",
    "meaning": "Character DPR before this feat's unembedded delta."
  },
  {
    "token": "variable",
    "meaning": "Owning PC EHP before this feat's unembedded delta."
  },
  {
    "token": "variable",
    "meaning": "Owning PC resolved maximum HP."
  },
  {
    "token": "variable",
    "meaning": "Owning PC resolved Armor Class."
  },
  {
    "token": "variable",
    "meaning": "Resolved bonus for the eligible attack packet."
  },
  {
    "token": "variable",
    "meaning": "Armor Class of the target of the eligible attack packet."
  },
  {
    "token": "variable",
    "meaning": "Number of eligible attack rolls in the priced turn."
  },
  {
    "token": "variable",
    "meaning": "hit(attackBonus,targetAC), including advantage/disadvantage and the 5%-95% natural-roll bounds."
  },
  {
    "token": "variable",
    "meaning": "Expected damage of one eligible hit after dice, modifiers, and typed damage packets."
  },
  {
    "token": "variable",
    "meaning": "1-pow(1-hitChance,attacks): probability that at least one eligible attack hits."
  },
  {
    "token": "variable",
    "meaning": "Mean of the eligible weapon's damage die or dice."
  },
  {
    "token": "variable",
    "meaning": "Resolved ability modifier from the imported character."
  },
  {
    "token": "variable",
    "meaning": "True when the imported actor value already contains the feat's static contribution."
  },
  {
    "token": "variable",
    "meaning": "Action-budget availability after all other character actions have been scheduled."
  },
  {
    "token": "variable",
    "meaning": "Observed or selected encounter probability/share. Examples: coverExposure, casterExposure, dimDarkUptime, incomingChosenTypeShare."
  },
  {
    "token": "variable",
    "meaning": "Derived from equipment, action sequence, target, damage type, and prerequisite state."
  },
  {
    "token": "variable",
    "meaning": "Uses available under the actual adventure rest schedule; never assume a free rest."
  },
  {
    "token": "variable",
    "meaning": "Explicit event/use count after resource allocation and action timing."
  },
  {
    "token": "function",
    "meaning": "Clamp (21+bonus-ac)/20 to 0.05..0.95, then apply advantage/disadvantage or an authored override."
  },
  {
    "token": "function",
    "meaning": "Use the same Party Defense Reach/accuracy resolver as the encounter checker; never use a second unrelated AC scalar."
  },
  {
    "token": "function",
    "meaning": "Exact mean increase when qualifying damage-die results below floor are treated as floor."
  },
  {
    "token": "function",
    "meaning": "Enumerate the d20 and dice distribution against target AC/DC; never use a flat hit multiplier."
  },
  {
    "token": "function",
    "meaning": "Enumerate the d20 and dice distribution against the save DC, then price prevented damage/control on its owning target."
  },
  {
    "token": "function",
    "meaning": "Side-effect-free standard math helpers. Expressions do not execute arbitrary code."
  },
  {
    "token": "law",
    "meaning": "Temporary HP never stack; retain only the highest simultaneously available pool."
  },
  {
    "token": "law",
    "meaning": "Use actual incoming damage-type shares. Multiple instances of the same Resistance never stack."
  },
  {
    "token": "law",
    "meaning": "A feat delta is zero when its required Action, Bonus Action, Reaction, trigger, use, or legal target is unavailable."
  }
];

export const FEAT_BY_KEY = new Map(FEAT_PRICING.map(f => [f.key.toLowerCase(), f]));

/**
 * Resolve a feat by name, defaulting a missing edition to 2024.
 *
 * ⚠ THE DEFAULT IS THE WORKBOOK'S, NOT A CONVENIENCE. Tab 17: *"edition:name; default missing
 * edition to 2024"*. A 2014 feat and its 2024 rewrite are different prices under the same name, so
 * guessing the other way would silently misprice every unlabelled character sheet.
 */
export function featPricing(nameOrKey: string): FeatPricing | undefined {
  const raw = (nameOrKey ?? "").trim();
  if (!raw) return undefined;
  const direct = FEAT_BY_KEY.get(raw.toLowerCase());
  if (direct) return direct;
  return FEAT_BY_KEY.get(`2024:${raw}`.toLowerCase());
}
