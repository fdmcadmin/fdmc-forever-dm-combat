/**
 * THE FOURTEEN BONDS — Broken Chain mod content, extracted from
 * `broken_chain_campaign_bonds_v13.html` (RULE 1: that file is the truth).
 *
 * ⚠ GENERATED. Re-run `scripts/extract-bonds.js` against the v13 document rather than editing
 * mechanics text here — a hand edit here silently disagrees with the document the table plays from.
 *
 * ── THE MODEL ────────────────────────────────────────────────────────────────────────────────
 * Five stages. Stages I and II have a single shared effect. Stages III, IV and V each hold TWO
 * path entries, and which one is live depends on the permanent choice made at Metamorphosis:
 *
 *   `chosen`   — what the path becomes when it IS the chosen one
 *   `unchosen` — what it holds at when the OTHER path was chosen
 *
 * ⚠ PATHS ARE KEYED BY INDEX, NOT NAME. A path RENAMES as it evolves — Pack's first path reads
 * "Bonded Strike" at Metamorphosis, "Apex Bond" at Tempered and "Unbroken Bond" at Unbroken. A
 * choice stored by name would fail to resolve one stage later, so the stored choice is 0 or 1.
 *
 * ⚠ METAMORPHOSIS IS PERMANENT (v13, "Rules That Always Hold"). Tempered and Unbroken are not
 * new choices — they DERIVE from the index chosen at Metamorphosis. There is deliberately no way
 * to express "switch path at Tempered" in this data or in `bondProgress.ts`. The only route to a
 * different path is the DM removing the bond and assigning it again, which clears the choice with
 * it. See RULE 2 → "EVERY LAYER OWNS ITS OWN CONSTANTS" in MASTER: this is BC mod law, and a DM
 * running the campaign does not get to re-rule it per character.
 */

import type { BondTemplate } from "../../../core/types/bond";

export const BROKEN_CHAIN_BOND_TEMPLATES: BondTemplate[] = [
  {
  id: "guardian",
  name: "Guardian Instinct",
  category: "TANK",
  role: "Tank / Protector",
  mode: "DEFENSIVE",
  timing: "REACTIVE — OFF-TURN",
  quote: "\"You stand where the blow is going to land. Someone moves toward your friend and your body is already there — not on your turn. On theirs.\"",
  reads: "COMBAT READS",
  onYourTurn: "ON YOUR TURN",
  stages: [
    {
      numeral: "I",
      label: "Instinct",
      blurb: "the bond, before you understand it",
      optionName: "Intercept",
      effect: "Once per round, when a creature you can see within 10 ft hits an ally, you may reduce that hit's damage by 1d6. This does not use your reaction.",
    },
    {
      numeral: "II",
      label: "Realized",
      blurb: "the second option awakens",
      optionName: "Challenge Unlocks",
      effect: "When the bond fires, choose one: Intercept — reduce the hit by 1d8. Challenge — 1 enemy within 10 ft must target you with its first attack roll on its turn, until the start of your next turn.",
    },
    {
      numeral: "III",
      label: "Metamorphosis",
      blurb: "permanent path choice — the unchosen path holds at its Realized form",
      paths: [
        { name: "Guardian's Stand", chosen: "Intercept evolves into Guardian's Stand. Guardian's Stand reduces the hit by 1d8 + PB.", unchosen: "Challenge 1 enemy within 10 ft must target you with its first attack roll on its turn, until the start of your next turn." },
        { name: "Sovereign's Cry", chosen: "Challenge evolves into Sovereign's Cry. 1 enemy within 10 ft must target you with its first two attack rolls on its turn, until the start of your next turn.", unchosen: "Intercept Reduces the hit by 1d8. This bond is not affected by bonuses." },
      ],
    },
    {
      numeral: "IV",
      label: "Tempered",
      blurb: "the unchosen path takes its single bump here — it holds this form through Unbroken",
      paths: [
        { name: "Wall of the Watch", chosen: "Guardian's Stand evolves into Wall of the Watch. Wall of the Watch reduces the hit by 1d10 + PB. Your next attack against the intercepted enemy before the end of your next turn adds 1d6.", unchosen: "Challenge 1 enemy within 10 ft must target you with its first two attack rolls on its turn, until the start of your next turn." },
        { name: "Sovereign's Reach", chosen: "Sovereign's Cry evolves into Sovereign's Reach. 1 enemy within 10 ft must target you with its first two attack rolls on its turn, and its speed is reduced by 10 ft, until the start of your next turn.", unchosen: "Intercept Reduces the hit by 1d10. This bond is not affected by bonuses." },
      ],
    },
    {
      numeral: "V",
      label: "Unbroken",
      blurb: "the chosen path deepens — the unchosen holds at its Tempered form",
      paths: [
        { name: "Unbroken Watch", chosen: "Wall of the Watch evolves into Unbroken Watch. Unbroken Watch reduces the hit by 1d12 + your modifier + PB. Your next attack against the intercepted enemy before the end of your next turn adds 1d8.", unchosen: "Challenge 1 enemy within 10 ft must target you with its first two attack rolls on its turn, until the start of your next turn." },
        { name: "Unbroken Cry", chosen: "Sovereign's Reach evolves into Unbroken Cry. 1 enemy within 10 ft must target you with its first two attack rolls on its turn and its speed is reduced by 10 ft; a second enemy within 10 ft must target you with its first attack roll. Until the start of your next turn.", unchosen: "Intercept Reduces the hit by 1d10. This bond is not affected by bonuses." },
      ],
    },
  ],
  },
  {
  id: "devout",
  name: "Devout Instinct",
  category: "SUPPORT / HEAL",
  role: "Divine Protector",
  mode: "HYBRID",
  timing: "RESOLVE AFTER ACTION",
  quote: "\"The power that moves through you can shelter or burn. In the moment after you act, you choose which face it shows.\"",
  reads: "COMBAT READS",
  onYourTurn: "ON YOUR TURN",
  stages: [
    {
      numeral: "I",
      label: "Instinct",
      blurb: "the bond, before you understand it",
      optionName: "Shelter",
      effect: "After you take your action, one ally within 10 ft gains 1d6 temporary HP.",
    },
    {
      numeral: "II",
      label: "Realized",
      blurb: "the second option awakens",
      optionName: "Smite Unlocks",
      effect: "After you act, choose one: Shelter — one ally within 10 ft gains 1d8 temporary HP. Smite — add 1d8 radiant to your first hit this turn.",
    },
    {
      numeral: "III",
      label: "Metamorphosis",
      blurb: "permanent path choice — the unchosen path holds at its Realized form",
      paths: [
        { name: "Aegis", chosen: "Shelter evolves into Aegis. Aegis grants one ally 1d8 + PB temporary HP.", unchosen: "Smite Adds 1d8 radiant to your first hit." },
        { name: "Wrath", chosen: "Smite evolves into Wrath. Wrath adds 1d8 + PB radiant to your first hit.", unchosen: "Shelter Grants one ally 1d8 temporary HP. This bond is not affected by bonuses." },
      ],
    },
    {
      numeral: "IV",
      label: "Tempered",
      blurb: "the unchosen path takes its single bump here — it holds this form through Unbroken",
      paths: [
        { name: "Sheltering Aegis", chosen: "Aegis evolves into Sheltering Aegis. Sheltering Aegis grants 1d10 + PB temporary HP. A second ally within 10 ft gains 1d6 temporary HP.", unchosen: "Smite 1d10 radiant on your first hit." },
        { name: "Wrathful Light", chosen: "Wrath evolves into Wrathful Light. Wrathful Light adds 1d10 + PB radiant. A second target within 10 ft takes 1d6 radiant immediately.", unchosen: "Shelter One ally gains 1d10 temporary HP. This bond is not affected by bonuses." },
      ],
    },
    {
      numeral: "V",
      label: "Unbroken",
      blurb: "the chosen path deepens — the unchosen holds at its Tempered form",
      paths: [
        { name: "Unbroken Aegis", chosen: "Sheltering Aegis evolves into Unbroken Aegis. Unbroken Aegis grants 1d12 + your modifier + PB temporary HP. A second ally within 10 ft gains 1d8 temporary HP.", unchosen: "Smite 1d10 radiant on your first hit." },
        { name: "Unbroken Light", chosen: "Wrathful Light evolves into Unbroken Light. Unbroken Light adds 1d12 + your modifier + PB radiant. A second target within 10 ft takes 1d8 radiant immediately.", unchosen: "Shelter One ally gains 1d10 temporary HP. This bond is not affected by bonuses." },
      ],
    },
  ],
  },
  {
  id: "mending",
  name: "Mending Instinct",
  category: "SUPPORT / HEAL",
  role: "Support / Sustain",
  mode: "DEFENSIVE",
  timing: "RESOLVE AFTER ACTION",
  quote: "\"You feel the party's condition the way you feel your own. When someone needs it, the bond moves before you decide to.\"",
  reads: "COMBAT READS",
  onYourTurn: "ON YOUR TURN",
  stages: [
    {
      numeral: "I",
      label: "Instinct",
      blurb: "the bond, before you understand it",
      optionName: "Restore",
      effect: "After you take your action, choose one ally within range — they regain 1d6 HP.",
    },
    {
      numeral: "II",
      label: "Realized",
      blurb: "the second option awakens",
      optionName: "Steady Unlocks",
      effect: "After your action, choose one: Restore — one ally within range regains 1d8 HP. Steady — choose one ally; the next hit they take is reduced by 1d8.",
    },
    {
      numeral: "III",
      label: "Metamorphosis",
      blurb: "permanent path choice — the unchosen path holds at its Realized form",
      paths: [
        { name: "Lifeline", chosen: "Restore evolves into Lifeline. Lifeline heals the target for 1d8 + PB HP.", unchosen: "Steady Reduces the next hit against the chosen ally by 1d8. This bond is not affected by bonuses." },
        { name: "Iron Ward", chosen: "Steady evolves into Iron Ward. Iron Ward reduces the next hit against the chosen ally by 1d8 + PB.", unchosen: "Restore Heals the target for 1d8 HP. This bond is not affected by bonuses." },
      ],
    },
    {
      numeral: "IV",
      label: "Tempered",
      blurb: "the unchosen path takes its single bump here — it holds this form through Unbroken",
      paths: [
        { name: "Surge of Life", chosen: "Lifeline evolves into Surge of Life. Surge of Life heals the target for 1d10 + PB HP. One adjacent ally also heals 1d6 HP.", unchosen: "Steady Next hit against chosen ally reduced by 1d10. This bond is not affected by bonuses." },
        { name: "Warding Bulwark", chosen: "Iron Ward evolves into Warding Bulwark. Warding Bulwark reduces the next hit by 1d10 + PB. The protection also applies to the next hit against a different ally at 1d6.", unchosen: "Restore One ally regains 1d10 HP. This bond is not affected by bonuses." },
      ],
    },
    {
      numeral: "V",
      label: "Unbroken",
      blurb: "the chosen path deepens — the unchosen holds at its Tempered form",
      paths: [
        { name: "Unbroken Surge", chosen: "Surge of Life evolves into Unbroken Surge. Unbroken Surge heals the target for 1d12 + your modifier + PB HP. One adjacent ally also heals 1d8 HP.", unchosen: "Steady Next hit against chosen ally reduced by 1d10. This bond is not affected by bonuses." },
        { name: "Unbroken Ward", chosen: "Warding Bulwark evolves into Unbroken Ward. Unbroken Ward reduces the next hit by 1d12 + your modifier + PB. The protection also applies to the next hit against a different ally at 1d8.", unchosen: "Restore One ally regains 1d10 HP. This bond is not affected by bonuses." },
      ],
    },
  ],
  },
  {
  id: "warden",
  name: "Warden Instinct",
  category: "CONTROL",
  role: "Offensive Healer",
  mode: "DEFENSIVE",
  timing: "RESOLVE AFTER ACTION",
  quote: "\"You heal by fighting. The pressure you put on the enemy is what gives your allies room to breathe.\"",
  reads: "COMBAT READS",
  onYourTurn: "ON YOUR TURN",
  stages: [
    {
      numeral: "I",
      label: "Instinct",
      blurb: "the bond, before you understand it",
      optionName: "Rally",
      effect: "After you take your action, one other ally within 15 ft regains 1d6 HP.",
    },
    {
      numeral: "II",
      label: "Realized",
      blurb: "the second option awakens",
      optionName: "Fortify Unlocks",
      effect: "After your action, choose one: Rally — one other ally within 15 ft regains 1d8 HP. Fortify — one other ally within 15 ft gains 1d8 temporary HP.",
    },
    {
      numeral: "III",
      label: "Metamorphosis",
      blurb: "permanent path choice — the unchosen path holds at its Realized form",
      paths: [
        { name: "Rallying Surge", chosen: "Rally evolves into Rallying Surge. Rallying Surge heals the primary ally for 1d8 + PB HP.", unchosen: "Fortify Grants the ally 1d8 temporary HP. This bond is not affected by bonuses." },
        { name: "Ironward", chosen: "Fortify evolves into Ironward. Ironward grants the ally 1d8 + PB temporary HP.", unchosen: "Rally Heals the primary ally for 1d8 HP. This bond is not affected by bonuses." },
      ],
    },
    {
      numeral: "IV",
      label: "Tempered",
      blurb: "the unchosen path takes its single bump here — it holds this form through Unbroken",
      paths: [
        { name: "War Medic", chosen: "Rallying Surge evolves into War Medic. War Medic heals the primary ally for 1d10 + PB HP. You also heal 1d6 HP.", unchosen: "Fortify One ally gains 1d10 temporary HP. This bond is not affected by bonuses." },
        { name: "Iron Bastion", chosen: "Ironward evolves into Iron Bastion. Iron Bastion grants the ally 1d10 + PB temporary HP. One additional ally within 15 ft gains 1d6 temporary HP.", unchosen: "Rally One ally regains 1d10 HP. This bond is not affected by bonuses." },
      ],
    },
    {
      numeral: "V",
      label: "Unbroken",
      blurb: "the chosen path deepens — the unchosen holds at its Tempered form",
      paths: [
        { name: "Unbroken Medic", chosen: "War Medic evolves into Unbroken Medic. Unbroken Medic heals the primary ally for 1d12 + your modifier + PB HP. You also heal 1d8 HP.", unchosen: "Fortify One ally gains 1d10 temporary HP. This bond is not affected by bonuses." },
        { name: "Unbroken Bastion", chosen: "Iron Bastion evolves into Unbroken Bastion. Unbroken Bastion grants the ally 1d12 + your modifier + PB temporary HP. One additional ally gains 1d8 temporary HP.", unchosen: "Rally One ally regains 1d10 HP. This bond is not affected by bonuses." },
      ],
    },
  ],
  },
  {
  id: "suppressing",
  name: "Suppressing Instinct",
  category: "CONTROL",
  role: "Ranged Controller",
  mode: "DENIAL",
  timing: "DECLARE BEFORE ACTION",
  quote: "\"You read the fight a half-second before it happens — where they'll move, what they'll try — and you take it away before they know it was an option.\"",
  reads: "COMBAT READS",
  onYourTurn: "ON YOUR TURN",
  stages: [
    {
      numeral: "I",
      label: "Instinct",
      blurb: "the bond, before you understand it",
      optionName: "Silencing Round",
      effect: "Declare before you act. Your next hit this turn suppresses the target's next reaction. Reaction suppression never affects Legendary Reactions.",
    },
    {
      numeral: "II",
      label: "Realized",
      blurb: "the second option awakens",
      optionName: "Suppressing Shot Unlocks",
      effect: "Declare before you act, then choose one: Silencing Round — suppress the target's next reaction. Suppressing Shot — the target's speed is halved until the start of its next turn.",
    },
    {
      numeral: "III",
      label: "Metamorphosis",
      blurb: "permanent path choice — the unchosen path holds at its Realized form",
      paths: [
        { name: "Keen Eye", chosen: "Silencing Round evolves into Keen Eye. Keen Eye suppresses ALL of the target's reactions until the start of its next turn.", unchosen: "Suppressing Shot The target's speed is halved until the start of its next turn." },
        { name: "Steady Aim", chosen: "Suppressing Shot evolves into Steady Aim. Steady Aim halves speed AND gives the target disadvantage on its next attack roll.", unchosen: "Silencing Round Suppresses the target's next reaction." },
      ],
    },
    {
      numeral: "IV",
      label: "Tempered",
      blurb: "the unchosen path takes its single bump here — it holds this form through Unbroken",
      paths: [
        { name: "Overwatch", chosen: "Keen Eye evolves into Overwatch. Overwatch suppresses all reactions on the target, and one other enemy within 10 ft also loses its next reaction.", unchosen: "Suppressing Shot Speed halved AND disadvantage on next attack roll." },
        { name: "Deadman's Mark", chosen: "Steady Aim evolves into Deadman's Mark. Deadman's Mark applies to two targets simultaneously — both have speed halved AND disadvantage on their next attack roll.", unchosen: "Silencing Round All of target's reactions suppressed until its next turn." },
      ],
    },
    {
      numeral: "V",
      label: "Unbroken",
      blurb: "the chosen path deepens — the unchosen holds at its Tempered form",
      paths: [
        { name: "Unbroken Watch", chosen: "Overwatch evolves into Unbroken Watch. Two more enemies within 10 ft also lose their next reaction.", unchosen: "Suppressing Shot Speed halved AND disadvantage on next attack roll." },
        { name: "Unbroken Mark", chosen: "Deadman's Mark evolves into Unbroken Mark. Two targets have speed halved and disadvantage, and the main target cannot use bonus actions until its next turn.", unchosen: "Silencing Round All of target's reactions suppressed until its next turn." },
      ],
    },
  ],
  },
  {
  id: "precise",
  name: "Precise Instinct",
  category: "FLEX",
  role: "Melee Controller",
  mode: "DENIAL",
  timing: "DECLARE BEFORE ACTION",
  quote: "\"Every fight is a conversation. You listen first — then you take away their next word.\"",
  reads: "COMBAT READS",
  onYourTurn: "ON YOUR TURN",
  stages: [
    {
      numeral: "I",
      label: "Instinct",
      blurb: "the bond, before you understand it",
      optionName: "Expose",
      effect: "Declare before you act. On a hit with a finesse or melee weapon, the target has disadvantage on its next attack roll.",
    },
    {
      numeral: "II",
      label: "Realized",
      blurb: "the second option awakens",
      optionName: "Disrupt Unlocks",
      effect: "Declare before you act, then choose one: Expose — on a hit, target has disadvantage on its next attack. Disrupt — on a hit, the target cannot make opportunity attacks until the start of its next turn.",
    },
    {
      numeral: "III",
      label: "Metamorphosis",
      blurb: "permanent path choice — the unchosen path holds at its Realized form",
      paths: [
        { name: "Crippling Precision", chosen: "Expose evolves into Crippling Precision. Crippling Precision gives the target disadvantage on its next attack AND it cannot disengage until the start of its next turn.", unchosen: "Disrupt The target cannot make opportunity attacks until the start of its next turn." },
        { name: "Duelist's Mark", chosen: "Disrupt evolves into Duelist's Mark. Duelist's Mark prevents opportunity attacks AND the target cannot disengage until the start of its next turn.", unchosen: "Expose Target has disadvantage on its next attack roll." },
      ],
    },
    {
      numeral: "IV",
      label: "Tempered",
      blurb: "the unchosen path takes its single bump here — it holds this form through Unbroken",
      paths: [
        { name: "Perfect Exploit", chosen: "Crippling Precision evolves into Perfect Exploit. The debuff also applies to a second target hit this turn.", unchosen: "Disrupt No OAs AND cannot disengage until start of its next turn." },
        { name: "Bound Duel", chosen: "Duelist's Mark evolves into Bound Duel. The debuff also applies to a second target hit this turn.", unchosen: "Expose Disadvantage on next attack AND cannot disengage." },
      ],
    },
    {
      numeral: "V",
      label: "Unbroken",
      blurb: "the chosen path deepens — the unchosen holds at its Tempered form",
      paths: [
        { name: "Unbroken Exploit", chosen: "Perfect Exploit evolves into Unbroken Exploit. The debuff applies to two additional targets hit this turn.", unchosen: "Disrupt No OAs AND cannot disengage." },
        { name: "Unbroken Duel", chosen: "Bound Duel evolves into Unbroken Duel. The debuff applies to two additional targets hit this turn.", unchosen: "Expose Disadvantage on next attack AND cannot disengage." },
      ],
    },
  ],
  },
  {
  id: "tactician",
  name: "Tactician Instinct",
  category: "FLEX",
  role: "Midline Controller",
  mode: "FLEX",
  timing: "DECLARE BEFORE ACTION",
  quote: "\"The field is a machine and you can see every gear. You don't need a bow or a blade — you need one opening, placed exactly where the party can use it.\"",
  reads: "COMBAT READS",
  onYourTurn: "ON YOUR TURN",
  stages: [
    {
      numeral: "I",
      label: "Instinct",
      blurb: "the bond, before you understand it",
      optionName: "Calculated Strike",
      effect: "Declare before you act. Your first hit or damaging effect this turn deals 1d6 damage. Works with weapons, spells, devices, or any damaging effect.",
    },
    {
      numeral: "II",
      label: "Realized",
      blurb: "the second option awakens",
      optionName: "Off-Balance Unlocks",
      effect: "Declare before you act, then choose one: Calculated Strike — 1d8 on your first hit or damaging effect. Off-Balance — on your first hit, the target's next attack roll is reduced by 1d8.",
    },
    {
      numeral: "III",
      label: "Metamorphosis",
      blurb: "permanent path choice — the unchosen path holds at its Realized form",
      paths: [
        { name: "Overcharge", chosen: "Calculated Strike evolves into Overcharge. Overcharge adds 1d8 + PB to your first hit or damaging effect.", unchosen: "Off-Balance The target's next attack roll is reduced by 1d8. This bond is not affected by bonuses." },
        { name: "Destabilize", chosen: "Off-Balance evolves into Destabilize. Destabilize reduces the target's next attack roll by 1d8 + PB.", unchosen: "Calculated Strike 1d8 on your first hit or damaging effect. This bond is not affected by bonuses." },
      ],
    },
    {
      numeral: "IV",
      label: "Tempered",
      blurb: "the unchosen path takes its single bump here — it holds this form through Unbroken",
      paths: [
        { name: "Perfected Charge", chosen: "Overcharge evolves into Perfected Charge. Perfected Charge adds 1d10 + PB. If your effect was a spell or device, one additional creature it affected takes 1d6.", unchosen: "Off-Balance Target's next attack roll reduced by 1d10. This bond is not affected by bonuses." },
        { name: "Systemic Failure", chosen: "Destabilize evolves into Systemic Failure. Systemic Failure reduces the target's next TWO attack rolls — by 1d10 + PB and 1d6.", unchosen: "Calculated Strike 1d10 on your first hit or damaging effect. This bond is not affected by bonuses." },
      ],
    },
    {
      numeral: "V",
      label: "Unbroken",
      blurb: "the chosen path deepens — the unchosen holds at its Tempered form",
      paths: [
        { name: "Unbroken Charge", chosen: "Perfected Charge evolves into Unbroken Charge. Unbroken Charge adds 1d12 + your modifier + PB. One additional creature affected takes 1d8.", unchosen: "Off-Balance Target's next attack roll reduced by 1d10. This bond is not affected by bonuses." },
        { name: "Unbroken Failure", chosen: "Systemic Failure evolves into Unbroken Failure. Unbroken Failure reduces the target's next two attack rolls by 1d12 + your modifier + PB and 1d8.", unchosen: "Calculated Strike 1d10 on your first hit or damaging effect. This bond is not affected by bonuses." },
      ],
    },
  ],
  },
  {
  id: "breaker",
  name: "Breaker Instinct",
  category: "BRUISER",
  role: "Disruptive Striker",
  mode: "FLEX",
  timing: "RESOLVE AFTER ACTION",
  quote: "\"Every defense has a seam. You find it, you crack it — and whatever swings back at you after that is already broken.\"",
  reads: "COMBAT READS",
  onYourTurn: "ON YOUR TURN",
  stages: [
    {
      numeral: "I",
      label: "Instinct",
      blurb: "the bond, before you understand it",
      optionName: "Crack",
      effect: "After you act — if you hit a creature this turn — your first hit deals +1d6 damage.",
    },
    {
      numeral: "II",
      label: "Realized",
      blurb: "the second option awakens",
      optionName: "Blunt Unlocks",
      effect: "After you act, choose one: Crack — +1d8 on your first hit. Blunt — the target's next damage roll before the start of your next turn is reduced by 1d8.",
    },
    {
      numeral: "III",
      label: "Metamorphosis",
      blurb: "permanent path choice — the unchosen path holds at its Realized form",
      paths: [
        { name: "Shatter", chosen: "Crack evolves into Shatter. Shatter adds +1d8 + PB to your first hit.", unchosen: "Blunt The target's next damage roll is reduced by 1d8. This bond is not affected by bonuses." },
        { name: "Breach", chosen: "Blunt evolves into Breach. Breach reduces the target's next damage roll by 1d8 + PB.", unchosen: "Crack +1d8 on your first hit. This bond is not affected by bonuses." },
      ],
    },
    {
      numeral: "IV",
      label: "Tempered",
      blurb: "the unchosen path takes its single bump here — it holds this form through Unbroken",
      paths: [
        { name: "Sunder", chosen: "Shatter evolves into Sunder. Sunder adds +1d10 + PB to your first hit, and you may push the target 5 ft.", unchosen: "Blunt Target's next damage roll reduced by 1d10. This bond is not affected by bonuses." },
        { name: "Rupture", chosen: "Breach evolves into Rupture. Rupture reduces the target's next damage roll by 1d10 + PB, and the target's speed is reduced by 10 ft until the end of its next turn.", unchosen: "Crack +1d10 on your first hit. This bond is not affected by bonuses." },
      ],
    },
    {
      numeral: "V",
      label: "Unbroken",
      blurb: "the chosen path deepens — the unchosen holds at its Tempered form",
      paths: [
        { name: "Unbroken Sunder", chosen: "Sunder evolves into Unbroken Sunder. Unbroken Sunder adds +1d12 + your modifier + PB to your first hit, and you may push the target 10 ft.", unchosen: "Blunt Target's next damage roll reduced by 1d10. This bond is not affected by bonuses." },
        { name: "Unbroken Rupture", chosen: "Rupture evolves into Unbroken Rupture. Unbroken Rupture reduces the target's next two damage rolls by 1d12 + your modifier + PB and 1d8. The target's speed is reduced by 10 ft until the end of its next turn.", unchosen: "Crack +1d10 on your first hit. This bond is not affected by bonuses." },
      ],
    },
  ],
  },
  {
  id: "vanguard",
  name: "Vanguard Instinct",
  category: "BRUISER",
  role: "Frontline Bruiser",
  mode: "HYBRID",
  timing: "DECLARE BEFORE ACTION",
  quote: "\"You hit harder when you commit. Every exchange teaches the body something — either how to break through, or how to not break.\"",
  reads: "COMBAT READS",
  onYourTurn: "ON YOUR TURN",
  stages: [
    {
      numeral: "I",
      label: "Instinct",
      blurb: "the bond, before you understand it",
      optionName: "Pressure",
      effect: "Declare before you act. Your first hit this turn deals 1d6 damage.",
    },
    {
      numeral: "II",
      label: "Realized",
      blurb: "the second option awakens",
      optionName: "Focus Unlocks",
      effect: "Declare before you act, then choose one: Pressure — 1d8 on your first hit. Focus — reduce the next attack roll against you by 1d8.",
    },
    {
      numeral: "III",
      label: "Metamorphosis",
      blurb: "permanent path choice — the unchosen path holds at its Realized form",
      paths: [
        { name: "Crushing Force", chosen: "Pressure evolves into Crushing Force. Crushing Force adds 1d8 + PB to your first hit.", unchosen: "Focus Reduces the next attack roll against you by 1d8. This bond is not affected by bonuses." },
        { name: "Iron Guard", chosen: "Focus evolves into Iron Guard. Iron Guard reduces the next attack roll against you by 1d8 + PB.", unchosen: "Pressure Adds 1d8 to your first hit. This bond is not affected by bonuses." },
      ],
    },
    {
      numeral: "IV",
      label: "Tempered",
      blurb: "the unchosen path takes its single bump here — it holds this form through Unbroken",
      paths: [
        { name: "Relentless Advance", chosen: "Crushing Force evolves into Relentless Advance. Relentless Advance adds 1d10 + PB to your first hit. If the target is within 5 ft of another enemy, that enemy also takes 1d6.", unchosen: "Focus Reduce next attack roll against you by 1d10. This bond is not affected by bonuses." },
        { name: "Iron Fortress", chosen: "Iron Guard evolves into Iron Fortress. Iron Fortress reduces the next attack roll against you by 1d10 + PB. A second attack roll is also reduced by 1d6.", unchosen: "Pressure Your first hit deals 1d10. This bond is not affected by bonuses." },
      ],
    },
    {
      numeral: "V",
      label: "Unbroken",
      blurb: "the chosen path deepens — the unchosen holds at its Tempered form",
      paths: [
        { name: "Unbroken Advance", chosen: "Relentless Advance evolves into Unbroken Advance. Unbroken Advance adds 1d12 + your modifier + PB to your first hit. The adjacent enemy also takes 1d8.", unchosen: "Focus Reduce next attack roll against you by 1d10. This bond is not affected by bonuses." },
        { name: "Unbroken Fortress", chosen: "Iron Fortress evolves into Unbroken Fortress. Unbroken Fortress reduces the next attack roll by 1d12 + your modifier + PB. A second attack roll is also reduced by 1d8.", unchosen: "Pressure Your first hit deals 1d10. This bond is not affected by bonuses." },
      ],
    },
  ],
  },
  {
  id: "skirmish",
  name: "Skirmish Instinct",
  category: "SPECIALTY",
  role: "Mobility Striker",
  mode: "OFFENSIVE",
  timing: "RESOLVE AFTER ACTION",
  quote: "\"You are never where they swing. The movement is the weapon — and the weapon hits harder because of the movement.\"",
  reads: "COMBAT READS",
  onYourTurn: "ON YOUR TURN",
  stages: [
    {
      numeral: "I",
      label: "Instinct",
      blurb: "the bond, before you understand it",
      optionName: "Closing Strike",
      effect: "After you act — if your movement brought you 10 ft closer to the target in a straight line before attacking — your first hit deals 1d6 damage.",
    },
    {
      numeral: "II",
      label: "Realized",
      blurb: "the second option awakens",
      optionName: "Dart Unlocks",
      effect: "After you act, choose one: Closing Strike — if your movement brought you 10 ft closer to the target in a straight line before attacking, deal 1d8 on your first hit. Dart — after you attack, move up to 10 ft without provoking opportunity attacks.",
    },
    {
      numeral: "III",
      label: "Metamorphosis",
      blurb: "permanent path choice — the unchosen path holds at its Realized form",
      paths: [
        { name: "Momentum", chosen: "Closing Strike evolves into Momentum. Momentum adds 1d8 + PB if your movement brought you 10 ft closer in a straight line.", unchosen: "Dart Move up to 10 ft without provoking." },
        { name: "Phantom Dash", chosen: "Dart evolves into Phantom Dash. Phantom Dash moves up to 15 ft without provoking.", unchosen: "Closing Strike If your movement brought you 10 ft closer in a straight line, 1d8 on your first hit. This bond is not affected by bonuses." },
      ],
    },
    {
      numeral: "IV",
      label: "Tempered",
      blurb: "the unchosen path takes its single bump here — it holds this form through Unbroken",
      paths: [
        { name: "Full Tilt", chosen: "Momentum evolves into Full Tilt. Full Tilt adds 1d10 + PB on your first hit if your movement brought you 10 ft closer in a straight line. If you move before your second hit this turn, that hit also deals 1d6.", unchosen: "Dart Move up to 15 ft without provoking." },
        { name: "Ghoststep", chosen: "Phantom Dash evolves into Ghoststep. Ghoststep moves up to 20 ft without provoking, and you may move through enemy spaces.", unchosen: "Closing Strike If your movement brought you 10 ft closer in a straight line, 1d10 on your first hit. This bond is not affected by bonuses." },
      ],
    },
    {
      numeral: "V",
      label: "Unbroken",
      blurb: "the chosen path deepens — the unchosen holds at its Tempered form",
      paths: [
        { name: "Unbroken Tilt", chosen: "Full Tilt evolves into Unbroken Tilt. Unbroken Tilt adds 1d12 + your modifier + PB on your first hit if your movement brought you 10 ft closer in a straight line. If you move before your second hit, that hit also deals 1d8.", unchosen: "Dart Move up to 15 ft without provoking." },
        { name: "Unbroken Step", chosen: "Ghoststep evolves into Unbroken Step. Unbroken Step moves up to 30 ft without provoking, and you may move through enemy spaces.", unchosen: "Closing Strike If your movement brought you 10 ft closer in a straight line, 1d10 on your first hit. This bond is not affected by bonuses." },
      ],
    },
  ],
  },
  {
  id: "pack",
  name: "Pack Instinct",
  category: "SPECIALTY",
  role: "Companion Controller",
  mode: "HYBRID",
  timing: "RESOLVE AFTER ACTION",
  quote: "\"You are never alone in a fight. When you move, it moves. When you commit, it commits. The bond runs on both your heartbeats — whatever those heartbeats sound like.\"",
  /** The bond's effects are performed by the bonded COMPANION, not the character. */
  actor: "companion",
  reads: "COMBAT READS",
  onYourTurn: "ON YOUR TURN",
  stages: [
    {
      numeral: "I",
      label: "Instinct",
      blurb: "the bond, before you understand it",
      optionName: "Coordinated Strike",
      effect: "After you take your action, your companion moves up to half its speed and makes one attack for 1d6 damage. Companion movement and actions are always free — never cost your bonus action.",
    },
    {
      numeral: "II",
      label: "Realized",
      blurb: "the second option awakens",
      optionName: "Bonded Strike / Shielding Bond Unlock",
      effect: "After you act, choose each turn: Bonded Strike — your companion moves up to its full speed and uses its stat block attack action. Shielding Bond — your companion moves toward one ally and the next hit against the closest ally is reduced by 1d8.",
    },
    {
      numeral: "III",
      label: "Metamorphosis",
      blurb: "permanent path choice — the unchosen path holds at its Realized form",
      paths: [
        { name: "Bonded Strike", chosen: "Companion stat block attack — the first strike gets +1d4.", unchosen: "Shielding Bond Reduces the next hit against the closest ally by 1d8. This bond is not affected by bonuses." },
        { name: "Shielding Bond", chosen: "Shielding Bond reduces the next hit against the closest ally by 1d8 + PB.", unchosen: "Bonded Strike Companion stat block attack — no bonus die." },
      ],
    },
    {
      numeral: "IV",
      label: "Tempered",
      blurb: "the unchosen path takes its single bump here — it holds this form through Unbroken",
      paths: [
        { name: "Apex Bond", chosen: "Bonded Strike evolves into Apex Bond. Companion stat block attack — the first strike gets +1d6 and ignores resistance to its damage type.", unchosen: "Shielding Bond Next hit against closest ally reduced by 1d10. This bond is not affected by bonuses." },
        { name: "Ironbound Guard", chosen: "Shielding Bond evolves into Ironbound Guard. Ironbound Guard reduces the next hit against the closest ally by 1d10 + PB.", unchosen: "Bonded Strike Companion stat block attack — the first strike gets +1d4." },
      ],
    },
    {
      numeral: "V",
      label: "Unbroken",
      blurb: "the chosen path deepens — the unchosen holds at its Tempered form",
      paths: [
        { name: "Unbroken Bond", chosen: "Apex Bond evolves into Unbroken Bond. Companion stat block attack — the first strike gets +1d8 and ignores resistance to its damage type.", unchosen: "Shielding Bond Next hit against closest ally reduced by 1d10. This bond is not affected by bonuses." },
        { name: "Unbroken Guard", chosen: "Ironbound Guard evolves into Unbroken Guard. Unbroken Guard reduces the next hit against any ally within 15 ft by 1d12 + your modifier + PB.", unchosen: "Bonded Strike Companion stat block attack — the first strike gets +1d4." },
      ],
    },
  ],
  },
  {
  id: "resonant",
  name: "Resonant Instinct",
  category: "SPECIALTY",
  role: "Arcane Striker",
  mode: "HYBRID",
  timing: "RESOLVE AFTER ACTION",
  quote: "\"Your magic leaves a wake. The spell lands — and something lingers in the air where it struck, or folds back around you. The weave answers either way.\"",
  reads: "COMBAT READS",
  onYourTurn: "ON YOUR TURN",
  stages: [
    {
      numeral: "I",
      label: "Instinct",
      blurb: "the bond, before you understand it",
      optionName: "Arcane Echo",
      effect: "After you cast a spell that hits a creature or that a creature fails its save against, that creature immediately takes 1d6 force damage.",
    },
    {
      numeral: "II",
      label: "Realized",
      blurb: "the second option awakens",
      optionName: "Runic Ward Unlocks",
      effect: "After your spell lands, choose one: Arcane Echo — the target immediately takes 1d8 force damage. Runic Ward — after you cast a spell, 1 enemy within 30 ft has disadvantage on their next attack against you.",
    },
    {
      numeral: "III",
      label: "Metamorphosis",
      blurb: "permanent path choice — the unchosen path holds at its Realized form",
      paths: [
        { name: "Shattered Echo", chosen: "Arcane Echo evolves into Shattered Echo. Shattered Echo deals 1d8 + PB force damage.", unchosen: "Runic Ward 1 enemy within 30 ft has disadvantage on their next attack against you." },
        { name: "Runic Bastion", chosen: "Runic Ward evolves into Runic Bastion. After you cast a spell, 2 enemies within 30 ft each have disadvantage on their next attack against you.", unchosen: "Arcane Echo The target takes 1d8 force damage. This bond is not affected by bonuses." },
      ],
    },
    {
      numeral: "IV",
      label: "Tempered",
      blurb: "the unchosen path takes its single bump here — it holds this form through Unbroken",
      paths: [
        { name: "Fracture", chosen: "Shattered Echo evolves into Fracture. Fracture deals 1d10 + PB force. If your spell affected two or more creatures, one additional creature also takes 1d6 force.", unchosen: "Runic Ward 2 enemies within 30 ft each have disadvantage on their next attack against you." },
        { name: "Warding Fracture", chosen: "Runic Bastion evolves into Warding Fracture. After you cast a spell, 2 enemies within 30 ft each have disadvantage on their next two attacks against you.", unchosen: "Arcane Echo Target takes 1d10 force. This bond is not affected by bonuses." },
      ],
    },
    {
      numeral: "V",
      label: "Unbroken",
      blurb: "the chosen path deepens — the unchosen holds at its Tempered form",
      paths: [
        { name: "Unbroken Fracture", chosen: "Fracture evolves into Unbroken Fracture. Unbroken Fracture deals 1d12 + your modifier + PB force. If your spell affected two or more creatures, one additional creature takes 1d8 force.", unchosen: "Runic Ward 2 enemies within 30 ft each have disadvantage on their next two attacks against you." },
        { name: "Unbroken Ward", chosen: "Warding Fracture evolves into Unbroken Ward. After you cast a spell, 2 enemies within 30 ft each have disadvantage on their next two attacks against you. The primary enemy also has speed reduced by 20 ft.", unchosen: "Arcane Echo Target takes 1d10 force. This bond is not affected by bonuses." },
      ],
    },
  ],
  },
  {
  id: "covenant",
  name: "Covenant Instinct",
  category: "SPECIALTY",
  role: "Summoner / Empowerer",
  mode: "OFFENSIVE",
  timing: "RESOLVE AFTER ACTION",
  quote: "\"Something answers when you call. It was always going to answer — the bond just taught you its name. And when you don't call it, the same power pours through whoever stands beside you.\"",
  reads: "COMBAT READS",
  onYourTurn: "ON YOUR TURN",
  stages: [
    {
      numeral: "I",
      label: "Instinct",
      blurb: "the bond, before you understand it",
      optionName: "Channel",
      effect: "After you take your action, one ally within 30 ft deals 1d6 damage on their next hit.",
    },
    {
      numeral: "II",
      label: "Realized",
      blurb: "the second option awakens",
      optionName: "Call Unlocks",
      effect: "After you act, choose one: Channel — one ally within 30 ft deals 1d8 on their next hit. Call — manifest a bond-creature in an unoccupied space within 15 ft. It lasts 2 turns and acts on your turn: moves up to 30 ft and makes one attack (1d20 + your proficiency to hit; 1d8 damage). Its HP equals your class Hit Die maximum + your level.",
    },
    {
      numeral: "III",
      label: "Metamorphosis",
      blurb: "permanent path choice — the unchosen path holds at its Realized form",
      paths: [
        { name: "Greater Call", chosen: "Call evolves into Greater Call. The bond-creature's attack deals 1d8 + your main stat damage.", unchosen: "Channel One ally deals 1d8 on their next hit. This bond is not affected by bonuses." },
        { name: "Greater Channel", chosen: "Channel evolves into Greater Channel. Greater Channel grants one ally 1d8 + PB on their next hit.", unchosen: "Call Bond-creature attack deals 1d8 (no main stat)." },
      ],
    },
    {
      numeral: "IV",
      label: "Tempered",
      blurb: "the unchosen path takes its single bump here — it holds this form through Unbroken",
      paths: [
        { name: "Apex Call", chosen: "Greater Call evolves into Apex Call. The bond-creature's attack deals 1d10 + your main stat damage.", unchosen: "Channel One ally deals 1d10 on their next hit. This bond is not affected by bonuses." },
        { name: "Apex Channel", chosen: "Greater Channel evolves into Apex Channel. Apex Channel grants one ally 1d10 + PB on their next hit. A second ally within 30 ft deals 1d6 on their next hit.", unchosen: "Call Bond-creature attack deals 1d10 (no main stat)." },
      ],
    },
    {
      numeral: "V",
      label: "Unbroken",
      blurb: "the chosen path deepens — the unchosen holds at its Tempered form",
      paths: [
        { name: "Unbroken Call", chosen: "Apex Call evolves into Unbroken Call. The bond-creature adds your main stat to its attack roll and your PB to its damage (1d12 + main stat + PB).", unchosen: "Channel One ally deals 1d10 on their next hit. This bond is not affected by bonuses." },
        { name: "Unbroken Channel", chosen: "Apex Channel evolves into Unbroken Channel. Unbroken Channel grants one ally 1d12 + your modifier + PB on their next hit. A second ally within 30 ft deals 1d8.", unchosen: "Call Bond-creature attack deals 1d10 (no main stat)." },
      ],
    },
  ],
  },
  {
  id: "siphon",
  name: "Siphon Instinct",
  category: "",
  role: "Sacrificial Exchanger",
  mode: "EXCHANGE",
  timing: "SACRIFICE BEFORE · EXCHANGE AFTER",
  quote: "\"Everything in a fight is a transaction. Pay with your own blood and the strike lands heavier. Or reach into whatever holds them together — flesh, bone, clockwork, grave-cold — and take it back.\"",
  reads: "COMBAT READS",
  onYourTurn: "ON YOUR TURN",
  stages: [
    {
      numeral: "I",
      label: "Instinct",
      blurb: "the bond, before you understand it",
      optionName: "Sacrifice",
      effect: "Declare before you act. Take 1d4 damage (cannot be reduced or prevented); your next damaging action this turn deals 1d6.",
    },
    {
      numeral: "II",
      label: "Realized",
      blurb: "the second option awakens",
      optionName: "Exchange Unlocks",
      effect: "Choose one each turn: Sacrifice — declare before you act; take 1d6 damage, your next damaging action deals 1d8. Exchange — after you hit a creature, drain 1d8 from it and regain that much HP. The drain pulls animating energy — works on constructs and undead.",
    },
    {
      numeral: "III",
      label: "Metamorphosis",
      blurb: "permanent path choice — the unchosen path holds at its Realized form",
      paths: [
        { name: "Deeper Cut", chosen: "Sacrifice evolves into Deeper Cut. Deeper Cut — take 1d6; your next damaging action deals 1d8 + PB.", unchosen: "Exchange Drain 1d8 from a creature you hit; regain that much HP. This bond is not affected by bonuses." },
        { name: "Deeper Draw", chosen: "Exchange evolves into Deeper Draw. Deeper Draw drains 1d8 + PB and you regain that much HP.", unchosen: "Sacrifice Take 1d6; your next damaging action deals 1d8. This bond is not affected by bonuses." },
      ],
    },
    {
      numeral: "IV",
      label: "Tempered",
      blurb: "the unchosen path takes its single bump here — it holds this form through Unbroken",
      paths: [
        { name: "Blood Price", chosen: "Deeper Cut evolves into Blood Price. Blood Price — take 1d8; your next damaging action deals 1d10 + PB.", unchosen: "Exchange Drain 1d10; regain that much HP. This bond is not affected by bonuses." },
        { name: "Soul Tithe", chosen: "Deeper Draw evolves into Soul Tithe. Soul Tithe drains 1d10 + PB and you regain that much HP — OR, once per combat, convert the drain into one extra use of a class ability or one 1st-level spell slot instead.", unchosen: "Sacrifice Take 1d8; your next damaging action deals 1d10. This bond is not affected by bonuses." },
      ],
    },
    {
      numeral: "V",
      label: "Unbroken",
      blurb: "the chosen path deepens — the unchosen holds at its Tempered form",
      paths: [
        { name: "Unbroken Price", chosen: "Blood Price evolves into Unbroken Price. Unbroken Price — take 1d10; your next damaging action deals 1d12 + your modifier + PB.", unchosen: "Exchange Drain 1d10; regain that much HP. This bond is not affected by bonuses." },
        { name: "Unbroken Tithe", chosen: "Soul Tithe evolves into Unbroken Tithe. Unbroken Tithe drains 1d12 + your modifier + PB — once per combat, convert the drain into one extra use of a class ability or a spell slot of up to 2nd level.", unchosen: "Sacrifice Take 1d8; your next damaging action deals 1d10. This bond is not affected by bonuses." },
      ],
    },
  ],
  }
];
