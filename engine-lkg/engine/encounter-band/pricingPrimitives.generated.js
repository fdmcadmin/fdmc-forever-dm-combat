export const PRICING_PRIMITIVES = [
    {
        "id": "multiattack_sequence",
        "channel": "offense",
        "family": "multiattack_or_action_sequence",
        "model": "action_budget",
        "priced": "Schedule only the legal ordered routine; sum priced child attacks/actions after substitutions.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Follow the printed sequence and alternatives; do not add every listed attack together.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "attack_substitution",
        "channel": "offense",
        "family": "multiattack_or_action_sequence",
        "model": "action_budget",
        "priced": "Replace the specified component; never add it as an extra action.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Follow the printed sequence and alternatives; do not add every listed attack together.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "first_hit_or_once_per_turn_rider",
        "channel": "offense",
        "family": "advantage_pack_tactics_sneak_or_conditional_damage",
        "model": "condition_probability",
        "priced": "P(at least one qualifying trigger in the legal turn) × rider EV; cap at printed frequency.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Recalculate hit and rider probability from the chance the positional or target condition is met.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "conditional_extra_damage",
        "channel": "offense",
        "family": "advantage_pack_tactics_sneak_or_conditional_damage",
        "model": "condition_probability",
        "priced": "P(condition true) × P(trigger succeeds) × extra damage EV.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Recalculate hit and rider probability from the chance the positional or target condition is met.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "save_damage_full_or_half",
        "channel": "offense",
        "family": "direct_damage_resolution",
        "model": "hit_save_target_math",
        "priced": "P(fail)×full + P(success)×success damage using the specific ability save curve.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Resolve each damage packet separately against hit/save/automatic delivery, target count, typed defenses, trigger frequency and action legality.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "aoe_target_count",
        "channel": "offense",
        "family": "direct_damage_resolution",
        "model": "hit_save_target_math",
        "priced": "Expected per-target value × authored/estimated legal target count.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Resolve each damage packet separately against hit/save/automatic delivery, target count, typed defenses, trigger frequency and action legality.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "recharge_action",
        "channel": "offense",
        "family": "recharge_or_limited_use_action",
        "model": "round_availability",
        "priced": "R1 uses authored initial availability; later rounds use printed recharge probability after use. Replaces normal Action if it is an Action.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Keep recharge probability separate from activation type; a recharge Action replaces the routine Action.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "limited_use_action",
        "channel": "offense",
        "family": "recharge_or_limited_use_action",
        "model": "round_availability",
        "priced": "Schedule the best legal use within the encounter horizon; enforce uses and action channel.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Keep recharge probability separate from activation type; a recharge Action replaces the routine Action.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "legendary_action_pool",
        "channel": "offense",
        "family": "bonus_reaction_legendary_lair_or_mythic_action",
        "model": "separate_action_budget",
        "priced": "Price separately; enforce pool, costs, timing, refresh and legal choices.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Add only separately legal actions, honoring costs, triggers, uses, and initiative timing.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "lair_action",
        "channel": "offense",
        "family": "bonus_reaction_legendary_lair_or_mythic_action",
        "model": "separate_action_budget",
        "priced": "Price on authored initiative/cadence; environment/context requirements must be true.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Add only separately legal actions, honoring costs, triggers, uses, and initiative timing.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "mythic_phase_action",
        "channel": "offense",
        "family": "bonus_reaction_legendary_lair_or_mythic_action",
        "model": "separate_action_budget",
        "priced": "Price only after the authored phase trigger and within its own action budget.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Add only separately legal actions, honoring costs, triggers, uses, and initiative timing.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "automatic_start_end_turn_damage",
        "channel": "offense",
        "family": "passive_aura_hazard_or_damage_over_time",
        "model": "exposure_rounds",
        "priced": "Damage EV × expected exposed targets × active trigger rounds.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Multiply expected per-target damage by exposed targets and active rounds, respecting repeat saves and exits.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "retaliation",
        "channel": "offense",
        "family": "retaliation_reflection_or_death_burst",
        "model": "trigger_probability",
        "priced": "Expected eligible trigger count × per-trigger EV × legal target count; retaliation is offense, not prevention.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Use expected eligible triggers; death effects occur once and reflected damage remains separate from prevented damage.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "death_burst",
        "channel": "offense",
        "family": "retaliation_reflection_or_death_burst",
        "model": "trigger_probability",
        "priced": "One expected death trigger × per-target EV × legal targets.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Use expected eligible triggers; death effects occur once and reflected damage remains separate from prevented damage.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "damage_over_time_persistent_mark",
        "channel": "offense",
        "family": "passive_aura_hazard_or_damage_over_time",
        "model": "exposure_rounds",
        "priced": "Track state, trigger timing, duration/end condition and repeated resolution.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Multiply expected per-target damage by exposed targets and active rounds, respecting repeat saves and exits.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "companion_or_summon_attack",
        "channel": "offense",
        "family": "summon_spawn_split_or_create_body",
        "model": "child_entities",
        "priced": "Create/use the companion body action schedule; do not add as free parent DPR.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Add each created body as a timed roster entry with its own HP, actions, duration, and initiative.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "persistent_damage_or_mark",
        "channel": "offense",
        "family": "passive_aura_hazard_or_damage_over_time",
        "model": "exposure_rounds",
        "priced": "Track persistent state and repeated legal trigger timing separately.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Multiply expected per-target damage by exposed targets and active rounds, respecting repeat saves and exits.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "critical_rider",
        "channel": "offense",
        "family": "advantage_pack_tactics_sneak_or_conditional_damage",
        "model": "condition_probability",
        "priced": "Crit probability × rider EV; respect non-critting Bond/feature dice.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Recalculate hit and rider probability from the chance the positional or target condition is met.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "advantage_disadvantage_attack_matrix",
        "channel": "offense",
        "family": "advantage_pack_tactics_sneak_or_conditional_damage",
        "model": "condition_probability",
        "priced": "Base p=clamp((21+AB-AC)/20,.05,.95); advantage=1-(1-p)^2; disadvantage=p^2.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Recalculate hit and rider probability from the chance the positional or target condition is met.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "healing",
        "channel": "sustain",
        "family": "regeneration_healing_or_temporary_hp",
        "model": "round_state",
        "priced": "Expected usable same-encounter healing, capped by missing HP/overheal and action/resource availability.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Track timing, uses, shutoff conditions, healing caps, and whether the pool can occur in this encounter.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "temporary_hp",
        "channel": "sustain",
        "family": "regeneration_healing_or_temporary_hp",
        "model": "round_state",
        "priced": "Expected usable THP only; replacement does not stack unless authored.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Track timing, uses, shutoff conditions, healing caps, and whether the pool can occur in this encounter.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "damage_reduction_flat",
        "channel": "sustain",
        "family": "damage_reduction_threshold_or_cap",
        "model": "per_hit_distribution",
        "priced": "For each eligible packet: prevented=min(flat reduction, packet damage).",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Resolve against individual hits or per-round damage before summing; never convert blindly to flat HP.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "damage_reduction_fraction",
        "channel": "sustain",
        "family": "damage_reduction_threshold_or_cap",
        "model": "per_hit_distribution",
        "priced": "For each eligible packet: prevented=packet damage×fraction.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Resolve against individual hits or per-round damage before summing; never convert blindly to flat HP.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "reaction_damage_halving",
        "channel": "sustain",
        "family": "bonus_reaction_legendary_lair_or_mythic_action",
        "model": "separate_action_budget",
        "priced": "P(trigger and reaction available)×50% of the selected eligible packet; enforce reaction budget.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Add only separately legal actions, honoring costs, triggers, uses, and initiative timing.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "adaptive_resistance",
        "channel": "sustain",
        "family": "damage_resistance_immunity_vulnerability",
        "model": "party_damage_profile",
        "priced": "After authored trigger, reweight typed incoming damage; no universal uptime assumption.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Weight by the selected party's actual damage-type share and bypass rules.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "resistance_immunity_vulnerability",
        "channel": "sustain",
        "family": "damage_resistance_immunity_vulnerability",
        "model": "party_damage_profile",
        "priced": "Weight actual damage-type share and bypass; resolve each typed packet before totals.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Weight by the selected party's actual damage-type share and bypass rules.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "regeneration_with_shutoff",
        "channel": "sustain",
        "family": "regeneration_healing_or_temporary_hp",
        "model": "round_state",
        "priced": "Expected usable healing at authored timing × active probability after shutoff rules.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Track timing, uses, shutoff conditions, healing caps, and whether the pool can occur in this encounter.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "drop_to_one_or_revive",
        "channel": "sustain",
        "family": "drop_prevention_revive_or_return",
        "model": "state_transition",
        "priced": "Expected additional same-encounter HP from trigger/use probability; preserve delay/shutoff.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Track the save, HP restored, uses, delay, and shutoff. Post-encounter rejuvenation gives no current-fight EHP.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "damage_transfer",
        "channel": "sustain",
        "family": "damage_transfer_shared_hp_or_possession",
        "model": "linked_pools",
        "priced": "Move damage to linked pool; never duplicate HP.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Move damage between existing bodies or one shared pool; never duplicate the same HP.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "shared_hp",
        "channel": "sustain",
        "family": "damage_transfer_shared_hp_or_possession",
        "model": "linked_pools",
        "priced": "Use one linked pool; remove body-specific actions only when authored.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Move damage between existing bodies or one shared pool; never duplicate the same HP.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "alternate_form_or_second_phase",
        "channel": "sustain",
        "family": "alternate_form_phase_or_replacement_body",
        "model": "sequential_pools",
        "priced": "Sequential profile/pools only after legal trigger; carry state as authored.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Add only forms that legally appear in the same fight, with trigger and carry-over rules.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "damage_threshold_or_cap",
        "channel": "sustain",
        "family": "damage_reduction_threshold_or_cap",
        "model": "per_hit_distribution",
        "priced": "Resolve packet/round distribution against threshold/cap before totaling.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Resolve against individual hits or per-round damage before summing; never convert blindly to flat HP.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "crit_suppression",
        "channel": "sustain",
        "family": "damage_reduction_threshold_or_cap",
        "model": "per_hit_distribution",
        "priced": "Reprice eligible critical hits as normal hits.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Resolve against individual hits or per-round damage before summing; never convert blindly to flat HP.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "legendary_resistance",
        "channel": "sustain",
        "family": "legendary_resistance_or_save_reroll",
        "model": "limited_event_budget",
        "priced": "Spend limited uses on highest-value failed saves; price avoided damage/control, not flat HP.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Spend uses against the most valuable failed saves and preserve the exact number of uses.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "save_reroll",
        "channel": "sustain",
        "family": "legendary_resistance_or_save_reroll",
        "model": "limited_event_budget",
        "priced": "Recompute fail probability for eligible saves and uses.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Spend uses against the most valuable failed saves and preserve the exact number of uses.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "attack_disadvantage_or_reroll",
        "channel": "sustain",
        "family": "attack_disadvantage_or_forced_reroll",
        "model": "event_probability",
        "priced": "Recompute incoming hit/crit probability for eligible attack events.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Recalculate hit probability for the affected attacks; do not use a flat HP bonus.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "conditional_healing_from_damage",
        "channel": "sustain",
        "family": "regeneration_healing_or_temporary_hp",
        "model": "round_state",
        "priced": "Expected actual damage dealt×heal fraction, capped by missing HP and triggers.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Track timing, uses, shutoff conditions, healing caps, and whether the pool can occur in this encounter.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "self_damage_cost",
        "channel": "sustain",
        "family": "damage_absorption_or_conversion",
        "model": "typed_damage_conversion",
        "priced": "Subtract expected self-damage from sustain/net action value.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Prevent eligible damage and add only explicitly granted healing; retain the damage-type trigger.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "prone",
        "channel": "control_reachability",
        "family": "grapple_restrain_prone_slow_or_forced_movement",
        "model": "action_and_hit_uptime",
        "priced": "Apply standing movement cost; while prone use own/incoming attack matrix and recompute reachability.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Track escape actions, save recurrence, movement/range impact, and resulting advantage rather than inventing damage.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "grappled_speed_zero",
        "channel": "control_reachability",
        "family": "grapple_restrain_prone_slow_or_forced_movement",
        "model": "action_and_hit_uptime",
        "priced": "Speed=0; choose best legal reachable routine; if none can reach, action-window DPR=0.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Track escape actions, save recurrence, movement/range impact, and resulting advantage rather than inventing damage.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "restrained",
        "channel": "control_reachability",
        "family": "grapple_restrain_prone_slow_or_forced_movement",
        "model": "action_and_hit_uptime",
        "priced": "Speed=0; own attacks disadvantage; attacks against advantage; DEX saves disadvantage.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Track escape actions, save recurrence, movement/range impact, and resulting advantage rather than inventing damage.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "stunned_or_incapacitated",
        "channel": "control_reachability",
        "family": "stun_paralyze_incapacitate_charm_fear_or_dominate",
        "model": "lost_action_probability",
        "priced": "Remove prohibited actions/reactions for duration and apply condition attack/save consequences.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Convert failed-save duration into expected lost actions and any attack/save consequences.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "frightened",
        "channel": "control_reachability",
        "family": "stun_paralyze_incapacitate_charm_fear_or_dominate",
        "model": "lost_action_probability",
        "priced": "Apply attack disadvantage while source visible plus approach restriction; choose best legal non-approach routine.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Convert failed-save duration into expected lost actions and any attack/save consequences.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "charmed",
        "channel": "control_reachability",
        "family": "stun_paralyze_incapacitate_charm_fear_or_dominate",
        "model": "lost_action_probability",
        "priced": "Apply harmful-target restriction against charmer plus any authored extra clauses.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Convert failed-save duration into expected lost actions and any attack/save consequences.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "forced_movement",
        "channel": "control_reachability",
        "family": "grapple_restrain_prone_slow_or_forced_movement",
        "model": "action_and_hit_uptime",
        "priced": "Update edge-to-edge separation and recompute legal reach/range for the next action window.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Track escape actions, save recurrence, movement/range impact, and resulting advantage rather than inventing damage.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "speed_reduction",
        "channel": "control_reachability",
        "family": "grapple_restrain_prone_slow_or_forced_movement",
        "model": "action_and_hit_uptime",
        "priced": "Reduce available movement then recompute reachability/legal routine.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Track escape actions, save recurrence, movement/range impact, and resulting advantage rather than inventing damage.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "difficult_terrain",
        "channel": "control_reachability",
        "family": "grapple_restrain_prone_slow_or_forced_movement",
        "model": "action_and_hit_uptime",
        "priced": "Apply movement cost through affected distance then recompute reachability.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Track escape actions, save recurrence, movement/range impact, and resulting advantage rather than inventing damage.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "no_opportunity_attacks",
        "channel": "control_reachability",
        "family": "flight_burrow_ethereal_teleport_or_flyby",
        "model": "damage_uptime",
        "priced": "Remove eligible OA events only; movement/reachability still changes normally.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Change each side's reachable-target fraction only when terrain and ranges make the movement relevant.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "reaction_suppression",
        "channel": "control_reachability",
        "family": "bonus_reaction_legendary_lair_or_mythic_action",
        "model": "separate_action_budget",
        "priced": "Remove reaction-channel value during suppression.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Add only separately legal actions, honoring costs, triggers, uses, and initiative timing.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "bonus_action_suppression",
        "channel": "control_reachability",
        "family": "bonus_reaction_legendary_lair_or_mythic_action",
        "model": "separate_action_budget",
        "priced": "Remove bonus-action-channel value during suppression.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Add only separately legal actions, honoring costs, triggers, uses, and initiative timing.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "disengage_suppression",
        "channel": "control_reachability",
        "family": "bonus_reaction_legendary_lair_or_mythic_action",
        "model": "separate_action_budget",
        "priced": "Reprice movement choice including OA exposure when Disengage is illegal.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Add only separately legal actions, honoring costs, triggers, uses, and initiative timing.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "blindness",
        "channel": "control_reachability",
        "family": "concealment_invisibility_or_displacement",
        "model": "targeting_probability",
        "priced": "Own attacks disadvantage; attacks against advantage; sight-dependent actions may become illegal.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Model targetability, advantage/disadvantage, and reveal conditions rather than a permanent HP multiplier.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "invisibility_or_concealment",
        "channel": "control_reachability",
        "family": "concealment_invisibility_or_displacement",
        "model": "targeting_probability",
        "priced": "Reprice targetability and attack matrix; respect reveal/end conditions.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Model targetability, advantage/disadvantage, and reveal conditions rather than a permanent HP multiplier.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "flight_burrow_teleport_flyby",
        "channel": "control_reachability",
        "family": "flight_burrow_ethereal_teleport_or_flyby",
        "model": "damage_uptime",
        "priced": "Change reachable-target fraction and OA exposure only when terrain/range makes it relevant.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Change each side's reachable-target fraction only when terrain and ranges make the movement relevant.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "swallow_or_engulf",
        "channel": "control_reachability",
        "family": "swallow_engulf_carry_or_containment",
        "model": "linked_target_state",
        "priced": "Track containment, ongoing damage, escape/action cost, targetability and carrier movement.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Track containment, escape/action cost, damage ticks, movement of the carrier, targetability, and reachability rather than converting the whole feature to flat DPR.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "carry_or_drag",
        "channel": "control_reachability",
        "family": "grapple_restrain_prone_slow_or_forced_movement",
        "model": "action_and_hit_uptime",
        "priced": "Update positions/speeds of linked bodies then recompute reachability.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Track escape actions, save recurrence, movement/range impact, and resulting advantage rather than inventing damage.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "forced_targeting",
        "channel": "control_reachability",
        "family": "stun_paralyze_incapacitate_charm_fear_or_dominate",
        "model": "lost_action_probability",
        "priced": "Reallocate legal target choices/expected damage to forced target; preserve impossible-to-comply attacks.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Convert failed-save duration into expected lost actions and any attack/save consequences.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "attack_roll_reduction",
        "channel": "control_reachability",
        "family": "attack_disadvantage_or_forced_reroll",
        "model": "event_probability",
        "priced": "Apply flat modifier before hit probability to every eligible attack event for duration.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Recalculate hit probability for the affected attacks; do not use a flat HP bonus.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "damage_roll_reduction",
        "channel": "control_reachability",
        "family": "maximum_hp_reduction_healing_block_or_resource_drain",
        "model": "persistent_state",
        "priced": "For every eligible damage instance: max(0, packet-reduction); honor expiry/clear trigger.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Track the altered pool or disabled recovery separately from immediate damage and reset it at the stated cadence.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "summon_spawn_child_body",
        "channel": "roster_state",
        "family": "summon_spawn_split_or_create_body",
        "model": "child_entities",
        "priced": "Create child body with HP, initiative/action schedule, duration and removal.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Add each created body as a timed roster entry with its own HP, actions, duration, and initiative.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "split_body",
        "channel": "roster_state",
        "family": "summon_spawn_split_or_create_body",
        "model": "child_entities",
        "priced": "Replace parent with authored bodies; never duplicate parent HP/actions.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Add each created body as a timed roster entry with its own HP, actions, duration, and initiative.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "transform_replace_body",
        "channel": "roster_state",
        "family": "alternate_form_phase_or_replacement_body",
        "model": "sequential_pools",
        "priced": "Replace profile at trigger; carry HP/state exactly as authored.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Add only forms that legally appear in the same fight, with trigger and carry-over rules.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "bloodied_profile_change",
        "channel": "roster_state",
        "family": "swarm_or_bloodied_profile_change",
        "model": "piecewise_profile",
        "priced": "Switch profile at threshold for subsequent events.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Switch offense, defenses, size, or traits at the printed HP/state threshold.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "persistent_stack_with_mark_cap",
        "channel": "roster_state",
        "family": "persistent_mark_or_stack",
        "model": "stateful_stack_resolution",
        "priced": "Track stack instances and marks separately; enforce caps/resolution/consumption.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Track active stack instances separately from marks per stack, resolution timing, persistence/consumption, cap, actual rolled/expected damage, and any conditional healing rider.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "resource_conversion_or_refund",
        "channel": "roster_state",
        "family": "maximum_hp_reduction_healing_block_or_resource_drain",
        "model": "persistent_state",
        "priced": "Value gained/refunded resource by best legal use within encounter horizon.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Track the altered pool or disabled recovery separately from immediate damage and reset it at the stated cadence.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "companion_body",
        "channel": "roster_state",
        "family": "summon_spawn_split_or_create_body",
        "model": "child_entities",
        "priced": "Independent body with own durability/action schedule.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Add each created body as a timed roster entry with its own HP, actions, duration, and initiative.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "temporary_body_duration",
        "channel": "roster_state",
        "family": "summon_spawn_split_or_create_body",
        "model": "child_entities",
        "priced": "Body/action value only for authored active rounds.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Add each created body as a timed roster entry with its own HP, actions, duration, and initiative.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "body_specific_action_removal",
        "channel": "roster_state",
        "family": "multiattack_or_action_sequence",
        "model": "action_budget",
        "priced": "Remove only that body's scheduled output when it dies/is disabled.",
        "inputs": "authored trigger/frequency/targets + relevant party/creature state",
        "guard": "Follow the printed sequence and alternatives; do not add every listed attack together.",
        "status": "SUPPORTED",
        "source": "workbook baseline"
    },
    {
        "id": "condition_poisoned",
        "channel": "control_reachability",
        "family": "attack_disadvantage_or_forced_reroll",
        "model": "event_probability",
        "priced": "While Poisoned, reprice every eligible attack at disadvantage for the authored duration. Checks matter only when they change an escape/contest outcome.",
        "inputs": "save/DC; duration; repeat/end trigger; affected attack events",
        "guard": "Maps Poisoned to attack-disadvantage math; no fake DPR.",
        "status": "ADDED",
        "source": "Crone: Venomous Eruption"
    },
    {
        "id": "healing_received_multiplier",
        "channel": "control_reachability",
        "family": "maximum_hp_reduction_healing_block_or_resource_drain",
        "model": "persistent_state",
        "priced": "Prevented healing = expected legal healing in active window × (1-multiplier), capped by missing HP and actual healing opportunities. Compare against action/resource opportunity cost.",
        "inputs": "multiplier; targets; save; duration; recharge/uses; healing opportunities; action cost",
        "guard": "Supports half healing, no healing and altered healing windows.",
        "status": "ADDED",
        "source": "Crone: Blighted Vitality"
    },
    {
        "id": "roll_modifier_zone",
        "channel": "control_reachability",
        "family": "terrain_lair_region_or_environment_dependency",
        "model": "conditional_layer",
        "priced": "For each eligible event in zone, add flat modifier to attack/save roll before probability math; re-evaluate occupancy and duration each event/round.",
        "inputs": "area; ally/enemy filters; roll types; modifier; duration; action cost",
        "guard": "Generic +N/-N field; no named spell dependency.",
        "status": "ADDED",
        "source": "F7 commander coverage"
    },
    {
        "id": "conditional_effect_end_on_attack_commitment",
        "channel": "roster_state",
        "family": "persistent_mark_or_stack",
        "model": "stateful_stack_resolution",
        "priced": "Maintain linked effect until normal expiry or until affected actor commits the authored attack/action toward the specified source; clear after that event resolves.",
        "inputs": "source/target; expiry; clear action; linked debuff",
        "guard": "State resolver only; value comes from linked effect plus resulting action choice.",
        "status": "ADDED",
        "source": "F7 bruiser coverage"
    },
    {
        "id": "post_resolution_reposition",
        "channel": "control_reachability",
        "family": "flight_burrow_ethereal_teleport_or_flyby",
        "model": "damage_uptime",
        "priced": "Triggering hit/spell fully resolves first, then apply movement/teleport; never erase triggering damage. Recompute subsequent reachability/attack legality.",
        "inputs": "action channel; trigger; distance; destination; OA rule",
        "guard": "Supports post-hit/spell reposition without false damage prevention.",
        "status": "ADDED",
        "source": "F7 tactical coverage"
    },
    {
        "id": "save_advantage_filter",
        "channel": "defense",
        "family": "save_advantage_reroll",
        "model": "event_probability",
        "priced": "For each eligible save event, replace normal fail probability with advantage fail probability; apply only to the named ability/effect filter.",
        "inputs": "eligible save filter; baseline save bonus/DC; duration/condition",
        "guard": "Do not treat as blanket Magic Resistance.",
        "status": "ADDED",
        "source": "current campaign coverage"
    },
    {
        "id": "condition_immunity",
        "channel": "defense",
        "family": "condition_immunity",
        "model": "event_probability",
        "priced": "Set probability of the named condition taking hold to 0; damage or other non-condition parts still resolve normally.",
        "inputs": "condition name; source effect; any bypass",
        "guard": "Do not erase damage attached to the same failed save unless immunity explicitly does so.",
        "status": "ADDED",
        "source": "current campaign coverage"
    },
    {
        "id": "temporary_ac_modifier",
        "channel": "defense",
        "family": "temporary_ac",
        "model": "damage_uptime",
        "priced": "Apply the AC modifier to eligible incoming attack events for the authored duration, then recompute hit/crit probabilities.",
        "inputs": "AC modifier; duration; affected target(s); action/resource cost",
        "guard": "Do not convert directly to flat EHP without the incoming attack mix.",
        "status": "ADDED",
        "source": "current campaign coverage"
    },
    {
        "id": "attack_disadvantage_until_hit",
        "channel": "defense",
        "family": "attack_disadvantage_or_forced_reroll",
        "model": "stateful",
        "priced": "Incoming eligible attacks have disadvantage until one attack hits or normal duration expires; clear immediately after the hit resolves.",
        "inputs": "target; duration; clear-on-hit; eligible attacks",
        "guard": "Stateful—not full-duration disadvantage after the first hit.",
        "status": "ADDED",
        "source": "current campaign coverage"
    },
    {
        "id": "alternate_attack_origin",
        "channel": "control_reachability",
        "family": "terrain_lair_region_or_environment_dependency",
        "model": "reachability",
        "priced": "Choose one legal authored origin for the attack/effect; measure range/line/cover from that origin and recompute reachable targets.",
        "inputs": "origin objects/points; range; LOS/cover; object durability if relevant",
        "guard": "Changes geometry only unless the feature also changes damage.",
        "status": "ADDED",
        "source": "current campaign coverage"
    },
    {
        "id": "cover_modifier",
        "channel": "control_reachability",
        "family": "terrain_lair_region_or_environment_dependency",
        "model": "conditional_layer",
        "priced": "Modify or ignore the applicable cover bonus before attack probability; apply only to attacks/areas that satisfy the authored geometry.",
        "inputs": "cover state; modifier/ignore rule; area/origin; duration",
        "guard": "No price when cover would not otherwise apply.",
        "status": "ADDED",
        "source": "current campaign coverage"
    },
    {
        "id": "target_substitution",
        "channel": "defense",
        "family": "damage_transfer_shared_hp_or_possession",
        "model": "stateful",
        "priced": "At the authored trigger timing, substitute the legal target. Recompute hit/defense against the new target; damage is not duplicated.",
        "inputs": "trigger timing; substitute target; reach/line legality; reaction budget",
        "guard": "Target redirection is not flat damage prevention.",
        "status": "ADDED",
        "source": "current campaign coverage"
    },
    {
        "id": "speed_modifier",
        "channel": "control_reachability",
        "family": "grapple_restrain_prone_slow_or_forced_movement",
        "model": "reachability",
        "priced": "Add/subtract the authored speed amount for the duration, then recompute movement cost and reachable routines.",
        "inputs": "speed modifier; duration; terrain; action ranges",
        "guard": "Use for both speed bonuses and penalties.",
        "status": "ADDED",
        "source": "current campaign coverage"
    },
    {
        "id": "hidden_or_invisibility_suppression",
        "channel": "control_reachability",
        "family": "concealment_invisibility_or_displacement",
        "model": "conditional_layer",
        "priced": "Remove the specified benefit from Hidden/Invisibility for the authored observer/attack window, then recompute targetability/attack matrix.",
        "inputs": "observer/target; suppressed benefit; duration",
        "guard": "Does not reveal to creatures not covered by the feature.",
        "status": "ADDED",
        "source": "current campaign coverage"
    },
    {
        "id": "resource_triggered_reposition",
        "channel": "control_reachability",
        "family": "flight_burrow_ethereal_teleport_or_flyby",
        "model": "reachability",
        "priced": "When the named resource-expenditure trigger occurs, apply authored movement/teleport without changing the resource cost; recompute subsequent reachability.",
        "inputs": "resource trigger; range/visibility; movement distance; OA rule; frequency",
        "guard": "Never price as resource denial unless the feature actually taxes/prevents the resource.",
        "status": "ADDED",
        "source": "current campaign coverage"
    },
    {
        "id": "reach_modifier",
        "channel": "control_reachability",
        "family": "grapple_restrain_prone_slow_or_forced_movement",
        "model": "reachability",
        "priced": "Change edge-to-edge attack reach for the authored duration/state and recompute legal routines.",
        "inputs": "reach delta; duration/state; body size/footprint",
        "guard": "Do not change creature footprint unless explicitly authored.",
        "status": "ADDED",
        "source": "current campaign coverage"
    },
    {
        "id": "movement_immunity_or_lock",
        "channel": "defense",
        "family": "grapple_restrain_prone_slow_or_forced_movement",
        "model": "conditional_layer",
        "priced": "For the authored duration/state, set probability of involuntary movement to 0 while preserving other effects from the same source.",
        "inputs": "movement types prevented; duration/state; activation cost",
        "guard": "Not immunity to prone unless explicitly included.",
        "status": "ADDED",
        "source": "current campaign coverage"
    },
    {
        "id": "terrain_portal_or_adjacency_link",
        "channel": "control_reachability",
        "family": "terrain_lair_region_or_environment_dependency",
        "model": "reachability",
        "priced": "Create the authored temporary movement/adjacency link; recompute movement cost, reachable targets and escape routes for both sides.",
        "inputs": "linked spaces; movement cost; uses per turn; duration; ally/enemy symmetry",
        "guard": "Price symmetrically when both sides can use it.",
        "status": "ADDED",
        "source": "current campaign coverage"
    },
    {
        "id": "one_way_obscurement",
        "channel": "control_reachability",
        "family": "concealment_invisibility_or_displacement",
        "model": "conditional_layer",
        "priced": "Apply obscurement/targeting penalties only to filtered observers while exempting authored allies; recompute attack/target legality.",
        "inputs": "area/source; observer filter; duration; special senses",
        "guard": "Do not apply concealment penalties to exempt allies.",
        "status": "ADDED",
        "source": "current campaign coverage"
    },
    {
        "id": "mirror_image_decoys",
        "channel": "defense",
        "family": "concealment_invisibility_or_displacement",
        "model": "stateful",
        "priced": "Track decoy count; for each would-hit attack use the authored diversion probability, remove one decoy on diversion, and continue until depleted.",
        "inputs": "decoy count; diversion probability; AC/target rule; duration; rider on last decoy",
        "guard": "Do not model as a static AC bonus.",
        "status": "ADDED",
        "source": "current campaign coverage"
    },
    {
        "id": "attack_advantage_grant",
        "channel": "offense",
        "family": "advantage_pack_tactics_sneak_or_conditional_damage",
        "model": "event_probability",
        "priced": "For specified attack event(s), replace normal hit probability with advantage hit probability, respecting duration/first-attack limits.",
        "inputs": "target; attack events; duration; clear/end rule",
        "guard": "No additional damage beyond improved hit/crit probability.",
        "status": "ADDED",
        "source": "current campaign coverage"
    },
    {
        "id": "body_lifecycle_state",
        "channel": "roster_state",
        "family": "multiattack_or_action_sequence",
        "model": "state_machine",
        "priced": "Each ordinary creature/add/spawn is an independent active body. After same-event prevention/return/phase checks resolve, a body at 0 HP becomes inactive and all future output owned by that body is removed immediately.",
        "inputs": "body id; current/max HP; active state; action owners; spawn/replacement/shared-HP links",
        "guard": "Do not reduce a living body's DPR linearly with HP. Do not keep dead bodies contributing. Explicit death-persistent effects are exceptions.",
        "status": "ADDED",
        "source": "runtime contract"
    },
    {
        "id": "event_filtered_attack_disadvantage",
        "channel": "defense",
        "family": "attack_disadvantage_or_forced_reroll",
        "model": "event_probability",
        "priced": "Recompute hit/crit probability only for the authored attack-event filter.",
        "inputs": "event filter; target; duration/frequency; baseline attack mix",
        "guard": "Never apply outside the filter.",
        "status": "ADDED",
        "source": "generic pricing coverage"
    },
    {
        "id": "attack_roll_modifier_event",
        "channel": "offense",
        "family": "advantage_pack_tactics_sneak_or_conditional_damage",
        "model": "event_probability",
        "priced": "Add the authored flat modifier to specified attack events before hit/crit probability.",
        "inputs": "modifier; event filter; duration/frequency; attack bonus; target AC",
        "guard": "No flat DPR substitution.",
        "status": "ADDED",
        "source": "generic pricing coverage"
    },
    {
        "id": "resource_triggered_target_mark",
        "channel": "roster_state",
        "family": "persistent_mark_or_stack",
        "model": "stateful_stack_resolution",
        "priced": "Assign/replace the marked target on the authored resource-spend trigger.",
        "inputs": "resource trigger; visibility/range; replacement; expiry",
        "guard": "Mark itself has no damage value.",
        "status": "ADDED",
        "source": "generic pricing coverage"
    },
    {
        "id": "conditional_speed_toward_mark",
        "channel": "control_reachability",
        "family": "grapple_restrain_prone_slow_or_forced_movement",
        "model": "reachability",
        "priced": "Apply speed bonus/multiplier only while moving toward the qualified target.",
        "inputs": "marked target; speed change; direction condition; terrain",
        "guard": "No unrestricted extra movement.",
        "status": "ADDED",
        "source": "generic pricing coverage"
    },
    {
        "id": "free_triggered_control_effect",
        "channel": "control_reachability",
        "family": "bonus_reaction_legendary_lair_or_mythic_action",
        "model": "separate_action_budget",
        "priced": "Schedule linked control in the free/automatic channel when its trigger succeeds.",
        "inputs": "trigger; frequency; linked primitive; target legality",
        "guard": "Consumes no normal Action unless authored.",
        "status": "ADDED",
        "source": "generic pricing coverage"
    },
    {
        "id": "ally_damage_prevention_with_self_cost",
        "channel": "sustain",
        "family": "damage_absorption_or_conversion",
        "model": "linked_pools",
        "priced": "Prevent ally damage, then apply authored self-damage to protector; net encounter sustain is prevention minus self-cost.",
        "inputs": "reaction trigger; prevention; self-damage; range; frequency",
        "guard": "Team sustain, not personal HP.",
        "status": "ADDED",
        "source": "generic pricing coverage"
    },
    {
        "id": "save_gated_support_effect",
        "channel": "offense",
        "family": "advantage_pack_tactics_sneak_or_conditional_damage",
        "model": "condition_probability",
        "priced": "Multiply linked support effect by failed-save probability, then price linked primitive.",
        "inputs": "save DC/ability; targets; duration; linked effect",
        "guard": "No invented damage.",
        "status": "ADDED",
        "source": "generic pricing coverage"
    },
    {
        "id": "retaliation_from_incoming_hit",
        "channel": "offense",
        "family": "retaliation_reflection_or_death_burst",
        "model": "trigger_probability",
        "priced": "Expected eligible incoming hits × retaliation EV, filtered by range/type/attacker.",
        "inputs": "incoming hits; eligible share; retaliation damage; filters",
        "guard": "Separate from self-turn DPR.",
        "status": "ADDED",
        "source": "generic pricing coverage"
    },
    {
        "id": "single_element_resistance_fallback",
        "channel": "sustain",
        "family": "damage_resistance_immunity_vulnerability",
        "model": "party_damage_profile",
        "priced": "Weight selected party's actual matching damage share; no fixed blanket multiplier by default.",
        "inputs": "damage type; party share; bypass rules",
        "guard": "Never assume ~50% exposure from one resistance.",
        "status": "ADDED",
        "source": "generic pricing coverage"
    },
    {
        "id": "mixed_delivery_round_sequence",
        "channel": "offense",
        "family": "multiattack_or_action_sequence",
        "model": "action_budget",
        "priced": "Price each attack-roll, save, automatic, legendary, bonus, reaction, and recharge packet with its own delivery math.",
        "inputs": "round schedule; per-packet AB/DC/save; damage; targets; recharge",
        "guard": "Never apply one attack bonus or DC to the whole creature.",
        "status": "ADDED",
        "source": "generic pricing coverage"
    },
    {
        "id": "authored_field_text_conflict",
        "channel": "validation",
        "family": "parser_contract",
        "model": "hard_gate",
        "priced": "If structured fields and printed text disagree on core combat values, block publication until corrected.",
        "inputs": "structured fields; printed text; conflict category",
        "guard": "Prevents silent stale-text pricing.",
        "status": "ADDED",
        "source": "generic pricing coverage"
    }
];
export const PRIMITIVE_ALIASES = [
    {
        "pattern": "poisoned / is poisoned",
        "primitive": "condition_poisoned",
        "meaning": "attack disadvantage for duration"
    },
    {
        "pattern": "healing received is halved",
        "primitive": "healing_received_multiplier",
        "meaning": "multiplier=0.5"
    },
    {
        "pattern": "cannot regain HP / healing prevented",
        "primitive": "healing_received_multiplier",
        "meaning": "multiplier=0"
    },
    {
        "pattern": "+N/-N attacks and saves in an area",
        "primitive": "roll_modifier_zone",
        "meaning": "flat roll modifier, zone occupancy and ally/enemy filter"
    },
    {
        "pattern": "after triggering hit/spell resolves, move/teleport",
        "primitive": "post_resolution_reposition",
        "meaning": "trigger resolves fully; movement affects only later events"
    },
    {
        "pattern": "effect ends after affected creature attacks source",
        "primitive": "conditional_effect_end_on_attack_commitment",
        "meaning": "state clear after committed attack resolves"
    },
    {
        "pattern": "prone",
        "primitive": "prone",
        "meaning": "condition alias"
    },
    {
        "pattern": "grappled",
        "primitive": "grappled_speed_zero",
        "meaning": "condition alias"
    },
    {
        "pattern": "restrained",
        "primitive": "restrained",
        "meaning": "condition alias"
    },
    {
        "pattern": "stunned/incapacitated/paralyzed/unconscious",
        "primitive": "stunned_or_incapacitated",
        "meaning": "decompose additional condition consequences"
    },
    {
        "pattern": "pushed/pulled/dragged",
        "primitive": "forced_movement",
        "meaning": "distance + recompute separation"
    },
    {
        "pattern": "speed reduced",
        "primitive": "speed_reduction",
        "meaning": "amount + duration"
    },
    {
        "pattern": "when hit / when damaged / retaliation",
        "primitive": "retaliation",
        "meaning": "expected trigger count + target count"
    },
    {
        "pattern": "resistance/immunity/vulnerability",
        "primitive": "resistance_immunity_vulnerability",
        "meaning": "typed exposure + bypass"
    },
    {
        "pattern": "heals/regains HP",
        "primitive": "healing",
        "meaning": "amount + timing + use/action budget"
    },
    {
        "pattern": "temporary hit points",
        "primitive": "temporary_hp",
        "meaning": "amount + timing + replacement"
    },
    {
        "pattern": "advantage on STR/DEX/etc saves against X",
        "primitive": "save_advantage_filter",
        "meaning": "filtered save advantage"
    },
    {
        "pattern": "immune to Charmed/Frightened/etc",
        "primitive": "condition_immunity",
        "meaning": "named condition cannot apply"
    },
    {
        "pattern": "+N AC until...",
        "primitive": "temporary_ac_modifier",
        "meaning": "temporary AC probability modifier"
    },
    {
        "pattern": "attacks have disadvantage until first hit",
        "primitive": "attack_disadvantage_until_hit",
        "meaning": "state clears after first hit"
    },
    {
        "pattern": "attack/effect may originate from stake/fracture/point",
        "primitive": "alternate_attack_origin",
        "meaning": "range/LOS measured from alternate origin"
    },
    {
        "pattern": "ignore/reduce/increase cover",
        "primitive": "cover_modifier",
        "meaning": "cover bonus changes before hit probability"
    },
    {
        "pattern": "becomes the target instead",
        "primitive": "target_substitution",
        "meaning": "legal target is replaced; no duplicate damage"
    },
    {
        "pattern": "speed increases/decreases by N",
        "primitive": "speed_modifier",
        "meaning": "movement/reachability recomputed"
    },
    {
        "pattern": "cannot benefit from Hidden/Invisibility",
        "primitive": "hidden_or_invisibility_suppression",
        "meaning": "remove specified concealment benefit"
    },
    {
        "pattern": "when a resource is spent, move toward spender",
        "primitive": "resource_triggered_reposition",
        "meaning": "movement only; resource unchanged"
    },
    {
        "pattern": "reach increases/decreases",
        "primitive": "reach_modifier",
        "meaning": "edge-to-edge legal reach changes"
    },
    {
        "pattern": "cannot be moved against its will",
        "primitive": "movement_immunity_or_lock",
        "meaning": "forced-movement probability set to 0"
    },
    {
        "pattern": "two spaces become linked/adjacent",
        "primitive": "terrain_portal_or_adjacency_link",
        "meaning": "temporary movement/adjacency connection"
    },
    {
        "pattern": "one-way magical obscurement",
        "primitive": "one_way_obscurement",
        "meaning": "filtered observer concealment"
    },
    {
        "pattern": "reflections/duplicates intercept attacks",
        "primitive": "mirror_image_decoys",
        "meaning": "stateful decoy interception"
    },
    {
        "pattern": "first/next attack has advantage",
        "primitive": "attack_advantage_grant",
        "meaning": "advantage hit math for limited attacks"
    },
    {
        "pattern": "body reaches 0 HP / summoned add dies",
        "primitive": "body_lifecycle_state",
        "meaning": "ordinary body becomes inactive after same-event save/return/phase checks; remove its future owned output"
    }
];
export const PRIMITIVE_BY_ID = new Map(PRICING_PRIMITIVES.map(p => [p.id, p]));
export const NEEDS_PRICING_PRIMITIVE = "NEEDS PRICING PRIMITIVE";
export function lookupPrimitive(text) {
    const t = (text ?? "").trim().toLowerCase();
    if (!t)
        return { ok: false, reason: NEEDS_PRICING_PRIMITIVE, text };
    const direct = PRIMITIVE_BY_ID.get(t.replace(/\s+/g, "_"));
    if (direct)
        return { ok: true, primitive: direct, matchedBy: "id" };
    for (const p of [...PRICING_PRIMITIVES].sort((a, b) => b.id.length - a.id.length)) {
        const phrase = p.id.replace(/_/g, " ");
        if (phrase.length > 5 && t.includes(phrase))
            return { ok: true, primitive: p, matchedBy: "id" };
        const head = phrase.split(" ").slice(0, 2).join(" ");
        if (head.length > 8 && t.includes(head))
            return { ok: true, primitive: p, matchedBy: "id" };
    }
    for (const a of PRIMITIVE_ALIASES) {
        const parts = a.pattern.toLowerCase().split(/\s*\/\s*/).map(s => s.trim()).filter(Boolean);
        if (parts.some(p => p.length > 2 && t.includes(p))) {
            const primitive = PRIMITIVE_BY_ID.get(a.primitive);
            if (primitive)
                return { ok: true, primitive, matchedBy: "alias", pattern: a.pattern };
        }
    }
    return { ok: false, reason: NEEDS_PRICING_PRIMITIVE, text };
}
export function primitivesInChannel(channel) {
    return PRICING_PRIMITIVES.filter(p => p.channel === channel);
}
