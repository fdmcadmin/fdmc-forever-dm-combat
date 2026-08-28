import { lookupPrimitive, NEEDS_PRICING_PRIMITIVE, } from "./pricingPrimitives.generated";
const INSTRUCTION = "Add a GENERIC resolver to the workbook with its required parameters and anti-double-count rule, "
    + "then rerun. Do not approximate from CR/tier, or add a creature-specific exception.";
const ABBREV = /\b(ft|in|lb|sq|hp|dc|cr|pb|no|vs|approx|max|min|avg|etc|ea)\./gi;
const DOT = "\u0001";
export function mechanicSentences(text) {
    const guarded = (text ?? "")
        .replace(ABBREV, m => m.slice(0, -1) + DOT)
        .replace(/(\d)\.(?=\s+[a-z(])/g, `$1${DOT}`);
    const raw = guarded
        .split(/(?<=[.;])\s+|\n+/)
        .map(s => s.split(DOT).join(".").trim())
        .filter(s => s.length > 3);
    const out = [];
    for (const s of raw) {
        if (/^(hit|miss|fail(ure)?|success|on a (hit|miss|fail(ure|ed save)?|success|successful save))\b\s*[:,.]?/i.test(s) && out.length) {
            out[out.length - 1] += " " + s;
        }
        else
            out.push(s);
    }
    return out;
}
const DICE = /\b\d+d\d+(\s*[+-]\s*\d+)?/g;
const DAMAGE_TYPES = /\b(acid|bludgeoning|cold|fire|force|lightning|necrotic|piercing|poison|psychic|radiant|slashing|thunder)\b/gi;
const TO_HIT = /[+-]\s*\d+\s*to hit|\bmakes? (a|an|one|two|three|four) .*\battack\b/i;
const SAVE_LINE = /\bDC\s*\d+\b[^.]*\bsav(e|ing)\b|\bsav(e|ing)\s+throw\b/i;
const ABILITY_CHECK_ONLY = /\bchecks?\b/i;
const CHECK_SKILL = /\b(perception|investigation|survival|stealth|insight|persuasion|deception|intimidation|performance|history|nature|arcana|religion|medicine|athletics|acrobatics|sleight of hand|animal handling)\b/i;
const SPELLCASTING_RESOURCE = [
    /\bconcentration\b/i,
    /\bspell (fails|is countered|slot is wasted|slot is expended)\b/i,
    /\bcounterspell\b/i,
    /\b(negates?|counters?|interrupts?) (the |a |that )?spell\b/i,
    /\bloses? the spell\b/i,
    /\btries to cast a spell\b/i,
];
const STATES_ABSENCE = [
    /^no damage\b/i,
    /\b(deals?|causes?) no damage\b/i,
    /\bat[- ]will\b/i,
    /\bno (action|cost|limit|save|effect)\b/i,
];
function statesAbsence(s) {
    if (/\d+d\d+/.test(s))
        return false;
    return STATES_ABSENCE.some(re => re.test(s));
}
function isSpellcastingResource(s) {
    return SPELLCASTING_RESOURCE.some(re => re.test(s));
}
function isAbilityCheckOnly(s) {
    if (!ABILITY_CHECK_ONLY.test(s))
        return false;
    if (/\bsav(e|ing)\b|\bdamage\b|\bd\d+\b|\bhit points?\b/i.test(s))
        return false;
    return CHECK_SKILL.test(s) || /\bability check/i.test(s);
}
const MECHANICAL = new RegExp([
    /\b\d+d\d+\b/,
    /\bDC\s*\d+\b/i,
    /\b\d+\s*(ft|feet|foot)\b/i,
    /\b(hit points?|HP|temporary hit points|damage|healing|heals?|regains?)\b/i,
    /\b(advantage|disadvantage|resistance|immunity|immune|vulnerability|vulnerable)\b/i,
    /\b(blinded|charmed|deafened|frightened|grappled|incapacitated|invisible|paralyzed|petrified|poisoned|prone|restrained|stunned|unconscious|exhaustion)\b/i,
    /\b(attacks?|saves?|saving throw|AC|armor class|initiative|opportunity)\b/i,
    /\b(action|bonus action|reaction|legendary|lair|mythic|recharge|multiattack)\b/i,
    /\b(speed|difficult terrain|pushed|pulled|dragged|teleports?)\b/i,
    /\bmoves?\b[^.]*(\d+\s*(ft|feet)|its speed)/i,
    /\b(round|turn|per (fight|day|encounter|round|turn)|once|twice|uses?)\b/i,
    /\b(spawns?|summons?|splits?|transforms?|dies|drops to|reduced to|0 hp|bloodied)\b/i,
    /\b(spell|concentration|cantrip|slot|aura|zone|area|cover|obscur)\b/i,
].map(r => r.source).join("|"), "i");
const QUALIFIER = [
    /\bdoes not (trigger|apply|stack|reset|return|provoke|impose|count)/i,
    /\bon turn (one|two|three|\d)\b|\bturn 1\b/i,
    /\bcannot use this\b|\bcannot be chosen again\b/i,
    /^no creature\b/i,
    /^(only|usable|uses?|recharge roll|this recharge)/i,
    /^[\w\s]{0,24}\bonly\b[:.]/i,
    /\b(per fight|per encounter|per round|per turn|per day|total)\b/i,
    /^(if|when|while|after|before|on a|at the)\b[^.]*$/i,
    /\b(belongs on this|not on|rather than|instead of) \b/i,
];
function isCommentary(sentences, resolvedHere) {
    if (resolvedHere > 0)
        return false;
    return !sentences.some(s => /\d/.test(s));
}
function isRestatement(s) {
    if (/\d/.test(s))
        return false;
    if (/\b(blinded|charmed|frightened|grappled|incapacitated|invisible|paralyzed|petrified|poisoned|prone|restrained|stunned|unconscious)\b/i.test(s))
        return false;
    return true;
}
function isQualifier(s) {
    if (/\b(takes?|deals?|regains?|heals?|gains?|becomes?|is (pushed|pulled|knocked|restrained|stunned|frightened|charmed|blinded|grappled))\b/i.test(s))
        return false;
    return QUALIFIER.some(re => re.test(s));
}
const TEXT_ROUTES = [
    { re: /\brecharge\s*\d(\s*[-–]\s*\d)?\b|\brecharges? (after|on a)\b/i, primitive: "recharge_action" },
    { re: /\b\d+\s*\/\s*(turn|round|day|fight|encounter|short rest|long rest|lr|sr)\b/i, primitive: "limited_use_action" },
    { re: /\b(once|twice|\d+ times?) per (fight|encounter|day|short rest|long rest|turn|round)\b|\busable (once|twice|\d+ times?)\b|\b\d+ uses?\b/i, primitive: "limited_use_action" },
    { re: /\bmultiattack\b|\bmakes (two|three|four) .*attacks\b/i, primitive: "multiattack_sequence" },
    { re: /\blegendary action/i, primitive: "legendary_action_pool" },
    { re: /\blair action/i, primitive: "lair_action" },
    { re: /\bexpends? (a|an|any) [^.]{0,40}?(resource|slot|charge|use)\b[^.]{0,80}?\b(quarry|mark(ed)?|target)\b/i,
        primitive: "resource_triggered_target_mark" },
    { re: /\b(while|when) moving toward\b[^.]{0,60}?\b(speed|movement)\b/i,
        primitive: "conditional_speed_toward_mark" },
    { re: /\bcan react before\b|\bbefore targets are (designated|chosen|selected)\b/i,
        primitive: "free_triggered_control_effect" },
    { re: /\bdrops? to 1 (hit point|HP)\b/i, primitive: "drop_to_one_or_revive" },
    { re: /\bdifficult terrain\b/i, primitive: "difficult_terrain" },
    { re: /\btemporary hit points\b|\btemp HP\b/i, primitive: "temporary_hp" },
    { re: /\b(regains?|heals?)\s+\d|\bregains hit points\b/i, primitive: "healing" },
    { re: /\bat the (start|end) of (its|each|the|their) turn\b[^.]*\bdamage\b/i, primitive: "automatic_start_end_turn_damage" },
    { re: /\bwhen\b[^.]*\b(it is|is )?(hit|damaged|struck|takes?)\b[^.]*\bdamage\b/i, primitive: "retaliation" },
    { re: /\b(dies|is reduced to 0)\b[^.]*\b(explodes?|bursts?|deals?)\b/i, primitive: "death_burst" },
    { re: /\b(is reduced to 0 hit points|drops to 0 hit points|reaches 0 HP|is killed|dies)\b/i, primitive: "body_lifecycle_state" },
    { re: /\bsummons?\b|\bspawns?\b|\bcalls? (forth|up)\b/i, primitive: "summon_spawn_child_body" },
    { re: /\bsplits? into\b/i, primitive: "split_body" },
    { re: /\b(transforms?|becomes) (into|a )\b|\bsecond (phase|form)\b/i, primitive: "transform_replace_body" },
    { re: /\bbloodied\b|\bat half (HP|hit points)\b|\bbelow half\b|\b\d+% of its own HP\b/i, primitive: "bloodied_profile_change" },
    { re: /\bflees\b|\bleaves the (fight|encounter|combat)\b|\bwithdraws\b|\bdoes not return\b/i, primitive: "body_lifecycle_state" },
    { re: /\bpack tactics\b/i, primitive: "advantage_disadvantage_attack_matrix" },
    { re: /\b(advantage|disadvantage) on (the |its |their )?attack/i, primitive: "advantage_disadvantage_attack_matrix" },
    { re: /\bopportunity attack/i, primitive: "retaliation" },
    { re: /\b(half|full) (damage )?on (a )?(success|successful save|save)\b|\bor half on\b|\bon a failed save[^.]*\bhalf\b/i, primitive: "save_damage_full_or_half" },
    { re: /\b(each|every|any) creature (in|within) (a )?\d+[- ]?(foot|ft)[- ]?(cone|line|cube|sphere|radius|square)/i, primitive: "aoe_target_count" },
    { re: /\b(advantage|disadvantage) on [^.]*\bsav(e|ing)/i, primitive: "save_advantage_filter" },
    { re: /\breroll\b[^.]*\b(sav(e|ing)|result)\b|\bmust use the new result\b/i, primitive: "save_reroll" },
    { re: /\b(additional|extra)\b[^.]*\bdamage\b/i, primitive: "conditional_extra_damage" },
    { re: /\b(immune|resistant|vulnerable) to\b|\b(immunity|resistance|vulnerability) to\b/i, primitive: "resistance_immunity_vulnerability" },
    { re: /\b(cut through|unhindered|bypass(es)?|ignores?)\b[^.]*\b(damage|resistance|immunity)\b|\bdamage\b[^.]*\b(cut through|unhindered)\b/i, primitive: "resistance_immunity_vulnerability" },
    { re: /\bstarting its turn within \d+\s*(ft|feet)\b|\bwithin \d+\s*(ft|feet)[^.]*\bmust succeed\b/i, primitive: "roll_modifier_zone" },
    { re: /\bmoves up to its speed\b|\bmay move\b[^.]*\d+\s*(ft|feet)/i, primitive: "forced_movement" },
    { re: /\btakes?\b[^.]*\bdamage\b[^.]*\bif it (ends|starts) its turn\b/i, primitive: "self_damage_cost" },
    { re: /\braise(s|d)? (it|them|the \w+) as\b|\badd it as a new (monster|body|creature)\b/i, primitive: "summon_spawn_child_body" },
    { re: /\bcan be \w+ once\b|\b1\/(fight|day|encounter)\b|\bonce (per|only|each)\b/i, primitive: "limited_use_action" },
    { re: /\b(costs?|spends?|uses?) (it|that \w+|its)\b[^.]*\b(whole )?action\b/i, primitive: "attack_substitution" },
    { re: /\bat 0 (HP|hit points)\b|\bwhen (it|the \w+) (drops|falls) to 0\b/i, primitive: "body_lifecycle_state" },
    { re: /\btakes the Hide action\b|\bbecomes? (hidden|invisible)\b/i, primitive: "invisibility_or_concealment" },
    { re: /\bsheds (dim|bright) light\b|\b(dim light|darkness|bright light)\b/i, primitive: "invisibility_or_concealment" },
    { re: /\b(leaps?|jumps?|flies|flying|burrows?|teleports?)\b[^.]*\d+\s*(ft|feet)/i, primitive: "flight_burrow_teleport_flyby" },
    { re: /\broll initiative for it\b|\bits own initiative\b|\binitiative count\b/i, primitive: "summon_spawn_child_body" },
    { re: /\bHP band\b|\bseparate add pool\b/i, primitive: "summon_spawn_child_body" },
    { re: /\bcannot take reactions\b|\bcan(not|'t) use reactions\b/i, primitive: "reaction_suppression" },
    { re: /\bwithout provoking\b|\bdoes not provoke\b/i, primitive: "no_opportunity_attacks" },
    { re: /\bcreatures? (there|inside|in the area|in the path|in it)\b|\b\d+[- ]?(ft|foot|feet)\.?[- ]?radius\b|\b(cone|line|cube|sphere)\b/i, primitive: "aoe_target_count" },
    { re: /\btreats? every \d+\s*ft[^.]*as \d+\s*ft\b/i, primitive: "difficult_terrain" },
    { re: /\b(is |are )?mov(es?|ed) up to \d+\s*(ft|feet)\b|\bmove up to half speed\b/i, primitive: "forced_movement" },
    { re: /[+-]\d+ AC\b|\bAC (increases|decreases|becomes)\b/i, primitive: "temporary_ac_modifier" },
    { re: /\bis an object \(AC \d+/i, primitive: "summon_spawn_child_body" },
    { re: /\bnail marks?\b|\bleaves? a\b[^.]*\btrail\b|\bis marked\b|\bmarks? (it|the target|one creature)\b/i, primitive: "persistent_damage_or_mark" },
    { re: /\b(gains?|becomes?|is|are|remains?)\b[^.]*\buntil the (start|end) of\b/i, primitive: "persistent_stack_with_mark_cap" },
    { re: /\bchoose (exactly )?(one|two|a) \b/i, primitive: "forced_targeting" },
    { re: /\bcover\b/i, primitive: "cover_modifier" },
    { re: /\b(speed|movement) (is |becomes |reduced|increases|decreases)/i, primitive: "speed_modifier" },
];
function routeText(text) {
    for (const r of TEXT_ROUTES)
        if (r.re.test(text))
            return r;
    return undefined;
}
export function auditCoverage(sources) {
    const covered = [];
    const packets = [];
    const unpriced = [];
    const parameters = [];
    const blocked = [];
    for (const source of sources) {
        const sentences = mechanicSentences(source.text);
        if (sentences.length === 0)
            continue;
        let resolvedHere = 0;
        const pending = [];
        for (const sentence of sentences) {
            const one = { ...source, text: sentence };
            if (/^(spell save DC|spellcasting|armor class|hit points|speed|senses|languages)\b/i.test(sentence)
                && !/\d+d\d+/.test(sentence)) {
                unpriced.push(one);
                continue;
            }
            if (!MECHANICAL.test(sentence) || isAbilityCheckOnly(sentence)
                || isSpellcastingResource(sentence) || statesAbsence(sentence)) {
                unpriced.push(one);
                continue;
            }
            const dice = sentence.match(DICE) ?? [];
            const isAttack = TO_HIT.test(sentence) || source.kindHint === "attack";
            const isSave = SAVE_LINE.test(sentence) || source.kindHint === "save";
            const isBareDamage = dice.length > 0
                && /\bdeal(s|ing)?\b/i.test(sentence)
                && !/\b(additional|extra|plus|instead)\b/i.test(sentence);
            if (dice.length && (isAttack || isSave || isBareDamage)) {
                packets.push({
                    source: one,
                    kind: isAttack ? "attack" : "save",
                    dice,
                    types: [...new Set((sentence.match(DAMAGE_TYPES) ?? []).map(t => t.toLowerCase()))],
                });
                resolvedHere++;
                continue;
            }
            const hit = lookupPrimitive(sentence);
            if (hit.ok) {
                covered.push({ source: one, primitive: hit.primitive, matchedBy: hit.matchedBy, pattern: hit.pattern });
                resolvedHere++;
                continue;
            }
            const routed = routeText(sentence);
            if (routed) {
                const viaId = lookupPrimitive(routed.primitive);
                if (viaId.ok) {
                    covered.push({ source: one, primitive: viaId.primitive, matchedBy: "alias", pattern: routed.re.source });
                    resolvedHere++;
                    continue;
                }
            }
            pending.push(one);
        }
        const commentary = isCommentary(sentences, resolvedHere);
        for (const one of pending) {
            if (commentary) {
                unpriced.push(one);
                continue;
            }
            if (resolvedHere > 0 && isQualifier(one.text))
                parameters.push(one);
            else if (resolvedHere > 0 && isRestatement(one.text))
                unpriced.push(one);
            else
                blocked.push({ source: one, reason: NEEDS_PRICING_PRIMITIVE, instruction: INSTRUCTION });
        }
    }
    return { covered, packets, unpriced, parameters, blocked, ok: blocked.length === 0 };
}
export function mechanicsOf(creature) {
    const out = [];
    const take = (channel, list) => {
        for (const m of list ?? []) {
            if (!m.text?.trim())
                continue;
            out.push({
                channel, name: m.name, text: m.text,
                kindHint: m.roll?.trim() ? "attack" : m.save?.trim() ? "save" : undefined,
            });
        }
    };
    take("trait", creature.traits);
    take("action", creature.actions);
    take("reaction", creature.reactions);
    take("legendary", creature.legendaryActions);
    return out;
}
export function coverageSummary(report) {
    const resolved = report.covered.length + report.packets.length;
    if (report.ok) {
        return `${resolved} mechanic${resolved === 1 ? "" : "s"} resolved `
            + `(${report.packets.length} damage packet${report.packets.length === 1 ? "" : "s"}, `
            + `${report.covered.length} primitive${report.covered.length === 1 ? "" : "s"}), none blocked.`;
    }
    return `${NEEDS_PRICING_PRIMITIVE}: ${report.blocked.length} of ${resolved + report.blocked.length} `
        + `mechanics have no workbook resolver.`;
}
