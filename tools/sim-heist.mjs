// tools/sim-heist.mjs — scripted checks of the heist rules, no browser.
// Imports the real logic modules (no three.js, no DOM), so a pass means
// the shipped code behaves, not a re-implementation of the model.
// Run: node tools/sim-heist.mjs  (from the repo root)
import { getLevel } from "../game/src/vault.js";
import { Guard } from "../game/src/guard.js";
import { SecurityCamera, jamNearestCamera } from "../game/src/camera.js";
import { createAlarm, updateAlarm, exitAllowed } from "../game/src/alarm.js";
import { createThief, collectLoot, throwCoin } from "../game/src/thief.js";

let pass = 0, fail = 0;
function check(name, cond) { if (cond) { pass++; console.log("PASS", name); } else { fail++; console.log("FAIL", name); } }
const dt = 1 / 60;
const level = getLevel(0);
const thief = createThief(level);
const guard = new Guard({ waypoints: [[400, 300], [700, 300]], start: 0 }, level);
const cam = new SecurityCamera(level.cameras[0], level);

// 1. Guard sees the thief standing in its cone, close: suspicion -> chase.
guard.x = 400; guard.y = 300; guard.angle = 0; // facing east, walking the lane
thief.x = 550; thief.y = 340; // 40 px south of the patrol lane, inside the cone thief.hidden = false; thief.sneaking = false; thief.noiseRadius = 0;
for (let i = 0; i < 60 * 6; i++) guard.update(dt, thief, level, null, 1);
check("guard close in cone -> chase", guard.state === "chase");

// 2. Hidden in a curtain: guard cannot see the thief.
const g2 = new Guard(level.guards[0], level);
thief.x = 480; thief.y = 335; thief.hidden = true; // inside curtain (420,300,120,70)
check("hidden thief -> sees 0", g2.seesThief(thief, level) === 0);

// 3. Camera detects the thief in its cone and feeds the alarm.
const alarm = createAlarm();
cam.x = 240; cam.y = 70; cam.angle = Math.atan2(150 - 70, 300 - 240);
thief.hidden = false; thief.x = 300; thief.y = 150;
const rate = cam.detects(thief, level);
check("camera detects thief in cone", rate > 0 && cam.seeing);
let locked = false;
let lockTime = -1;
for (let i = 0; i < 60 * 150; i++) { if (updateAlarm(alarm, dt, [], cam.detects(thief, level))) { locked = true; lockTime = i / 60; break; } }
check("camera alone can drive alarm to lockdown", locked); // lockdown lasts 10 s, so it may already have ended by the check
check("camera alone locks down in under 60 s (rebalanced)", locked && lockTime > 0 && lockTime < 60);

// 4. Jammer silences the camera for 6 s.
const cam2 = new SecurityCamera(level.cameras[0], level);
cam2.x = 240; cam2.y = 70; cam2.angle = Math.atan2(150 - 70, 300 - 240);
thief.x = 300; thief.y = 150;
check("camera live before jam", cam2.detects(thief, level) > 0);
const jammed = jamNearestCamera([cam2], thief, 430);
check("jammer hits camera in range", jammed === cam2 && cam2.jammed > 0);
check("jammed camera detects nothing", cam2.detects(thief, level) === 0);

// 5. Loot: collect all 3 -> exit opens; lockdown shuts it.
const loot = level.loot.map((o) => ({ ...o, taken: false }));
const t2 = createThief(level);
for (const piece of loot) { t2.x = piece.x; t2.y = piece.y; collectLoot(t2, loot); }
check("all 3 loot collectable", t2.lootCollected === 3);
const a2 = createAlarm();
check("exit opens with all loot, no lockdown", exitAllowed(a2, 3, 3));
a2.lockdown = 5;
check("exit shut during lockdown", !exitAllowed(a2, 3, 3));

// 5b. Loot radius is centre-to-centre 33 px (not 33 + thief radius).
const t2b = createThief(level);
const lootB = [{ x: 400, y: 300, taken: false }];
t2b.x = 440; t2b.y = 300; // 40 px away: outside 33, inside old 46
check("loot NOT collected at 40 px", collectLoot(t2b, lootB) === null && !lootB[0].taken);
t2b.x = 420; t2b.y = 300; // 20 px away: inside 33
check("loot collected at 20 px", collectLoot(t2b, lootB) !== null && lootB[0].taken);

// 6. Coin lure: guard in earshot investigates the clink.
const g3 = new Guard(level.guards[0], level);
g3.x = 500; g3.y = 300;
const t3 = createThief(level);
t3.x = 500; t3.y = 300;
check("coin throw works", throwCoin(t3, 700, 300) && t3.coins === 4);
g3.hearNoise(700, 300, 320);
check("guard investigates coin clink", g3.state === "suspicious" && g3.investigate?.x === 700);
check("lured guard shows '?' (suspicion >= 0.35)", g3.suspicion >= 0.35);

// 6b. B1: a coin onto an unreachable point (pillar centre) must NOT
// park the guard forever — it gives up and returns to patrol.
const g3b = new Guard(level.guards[0], level);
g3b.x = 300; g3b.y = 200; // 120 px from the pillar centre: in earshot
thief.x = 1200; thief.y = 650; thief.hidden = true; thief.noiseRadius = 0;
g3b.hearNoise(210, 120, 320); // centre of the NW pillar (180,90,60,60)
check("guard investigates pillar coin", g3b.state === "suspicious" && g3b.investigate !== null);
for (let i = 0; i < 60 * 10; i++) g3b.update(dt, thief, level, null, 1);
check("guard gives up unreachable coin and patrols again", g3b.state === "patrol" && g3b.investigate === null);

// 6c. M15: a hidden thief cannot be caught, even point-blank.
const g3c = new Guard(level.guards[0], level);
g3c.x = 480; g3c.y = 335;
thief.x = 480; thief.y = 335; thief.hidden = true;
check("hidden thief cannot be caught", g3c.catches(thief) === false);
thief.hidden = false;
check("visible thief at same spot can be caught", g3c.catches(thief) === true);

// 7. Chase gives up after 3 s without sight.
const g4 = new Guard(level.guards[0], level);
g4.state = "chase"; g4.suspicion = 1; g4.lastSeen = { x: 0, y: 0 };
thief.x = 1200; thief.y = 650; thief.hidden = true;
for (let i = 0; i < 60 * 4; i++) g4.update(dt, thief, level, null, 1);
check("chase gives up to suspicious", g4.state === "suspicious");

// 8. M7: spawn grace — no detection while grace runs (floor 2 south
// camera sits 40 px from the spawn).
const level2 = getLevel(1);
const t8 = createThief(level2); // spawn (640,650)
const cam8 = new SecurityCamera(level2.cameras[2], level2); // south camera
cam8.angle = -Math.PI / 2;
t8.hidden = false; t8.sneaking = false; t8.noiseRadius = 0;
check("south camera sees spawn without grace", cam8.detects(t8, level2) > 0);
check("south camera blind during grace", cam8.detects(t8, level2, 3.0) === 0);
const g8 = new Guard(level2.guards[2], level2); // centre vertical patrol
g8.x = 640; g8.y = 560; g8.angle = Math.PI / 2; // facing south, toward spawn
t8.x = 640; t8.y = 650;
check("guard sees spawn without grace", g8.seesThief(t8, level2) > 0);
for (let i = 0; i < 60 * 2; i++) g8.update(dt, t8, level2, null, 1, 3.0);
check("guard gains no suspicion during grace", g8.suspicion === 0 && g8.state === "patrol");

console.log(`SIM: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
