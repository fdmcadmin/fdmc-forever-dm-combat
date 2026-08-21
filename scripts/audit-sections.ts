import doc from "../src/data/checker/act3-v3_15.json";
const creatures = doc as any[];
const FIGHTS: Record<string, string[]> = {
  F1: ["Snarlroot","Hollow Warden","Larkskein"],
  F2: ["Quillshrike","Marrowstalk","Shardbound"],
  F3: ["Veilwood Crone","Darkmare"],
  F4: ["Briar Regent","Velvet Host","Folded Bulwark"],
  F5: ["Moss-Crowned Charger","Rift-Slick","Nail Saint"],
  F6: ["Elemental Mirror"],
  F9: ["Veil-Torn Dragon","Veil-Torn Wyrmling"],
  F10: ["Thought Harrower","Grief Colossus"],
};
const dmg = (t: string) => { let s = 0; for (const m of t.matchAll(/(\d+)\s*\((\d+d\d+[^)]*)\)/g)) s += +m[1]; return s; };
for (const [f, names] of Object.entries(FIGHTS)) {
  console.log(`\n=== ${f} ===`);
  for (const n of names) {
    const c = creatures.find(x => x.name === n);
    if (!c) { console.log(`  ${n}: NOT FOUND`); continue; }
    const secs = Object.keys(c.sections);
    console.log(`  ${n}  [sections: ${secs.join(", ") || "none"}]`);
    for (const s of secs) {
      for (const e of c.sections[s]) {
        const d = dmg(e.text);
        if (d > 0) console.log(`      ${s.padEnd(18)} ${String(e.name).slice(0,32).padEnd(34)} printed ${d}`);
      }
    }
    // Anything with dice we might be missing entirely
    for (const s of secs) for (const e of c.sections[s]) {
      if (dmg(e.text) === 0 && /\d+d\d+/.test(e.text)) console.log(`      ${s.padEnd(18)} ${String(e.name).slice(0,32).padEnd(34)} DICE, no pre-average: ${(e.text.match(/\d+d\d+[^.]{0,24}/)||[""])[0]}`);
    }
  }
}
