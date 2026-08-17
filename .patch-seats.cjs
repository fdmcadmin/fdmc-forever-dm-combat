const fs = require("fs");
const p = "src/App.tsx";
let s = fs.readFileSync(p, "utf8");
const count = (s.match(/seatColor=\{seatColorById\[/g) || []).length;
// Pass the player seat names alongside the seat colour at every ActorCard mount.
s = s.replace(/(seatColor=\{seatColorById\[[^\]]+\]\})/g, "$1\n                seatNames={playerSeatNames}");
fs.writeFileSync(p, s);
console.log("patched", count, "ActorCard mounts");
