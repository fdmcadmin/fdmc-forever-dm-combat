export type Act2Encounter = {
  id: string;
  order: number;
  name: string;
  enemies: string;
  totalHp: string;
  notes?: string;
};

export const act2Encounters: Act2Encounter[] = [
  { id: "hollow-pack", order: 1, name: "Hollow Pack", enemies: "1 Winter Wolf + 2 Worgs", totalHp: "~175", notes: "Opening fight, Act 2 tone-setter." },
  { id: "frozen-hollow", order: 2, name: "Frozen Hollow", enemies: "1 Frost Zombie + 1 Ghoul + 1 Ghast", totalHp: "~130", notes: "Undead introduction." },
  { id: "corrupted-hunters", order: 3, name: "Corrupted Hunters", enemies: "2 Wights", totalHp: "~90" },
  { id: "last-directive", order: 4, name: "Last Directive", enemies: "1 Wraith + 2 Shadows", totalHp: "~130", notes: "Elite quest." },
  { id: "lesser-wendigo", order: 5, name: "Lesser Wendigo", enemies: "2x 100 HP segments", totalHp: "200", notes: "Town defense fight. Level 4→5 gate." },
  { id: "dead-town", order: 6, name: "Dead Town", enemies: "Story only", totalHp: "—", notes: "No combat." },
  { id: "frozen-sentinels", order: 7, name: "Frozen Sentinels", enemies: "3 Deathlock Wights", totalHp: "~135" },
  { id: "frozen-watch", order: 8, name: "Frozen Watch", enemies: "2 Frost Zombies + 1 Shadow", totalHp: "~100" },
  { id: "full-wendigo", order: 9, name: "Full Wendigo", enemies: "Single creature", totalHp: "200", notes: "Level 5→6 gate. Final Act 2 boss." },
];
