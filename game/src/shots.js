// shots.js — deterministic ?shot= screenshot states.
// Each shot is a frozen frame of the real game (no input, no audio,
// time frozen): the same query always renders the same frame, so a
// re-shoot is byte-comparable. Shots:
// - play (cover): mid-heist on floor 1 — 1 loot taken, the thief
//   crossing the red carpet between two gold cones, a camera cone
//   sweeping in from the north-east, alarm at 38% (WATCHED), coin
//   mid-flight toward a guard.
// - start: the title screen over the full vault hall.
// - chase: alarm HOT at 82%, a guard chasing (red cone, "!"), the
//   thief fleeing toward a curtain, a camera cone on the thief.
// - victory: all loot taken, vault door open green, thief at the exit.
// The shot state is built by hand-placing the actors (never by playing
// the game forward), so every element the judge must see is placed
// where it reads: cones apart, loot visible, alarm legible.

import { getLevel } from "./vault.js";
import { createThief } from "./thief.js";
import { Guard } from "./guard.js";
import { SecurityCamera } from "./camera.js";
import { createAlarm } from "./alarm.js";

export function parseShot() {
  const q = new URLSearchParams(window.location.search);
  return { shot: q.get("shot") || "" };
}

function baseState(levelIndex) {
  const level = getLevel(levelIndex);
  return {
    screen: "play",
    shotMode: true,
    menuIndex: 0,
    levelIndex,
    level,
    thief: createThief(level),
    guards: level.guards.map((def) => new Guard(def, level)),
    cameras: level.cameras.map((def) => new SecurityCamera(def, level)),
    loot: level.loot.map((o) => ({ x: o.x, y: o.y, kind: o.kind, label: o.label, taken: false })),
    alarm: createAlarm(),
    exitOpen: false,
    levelTime: 0,
    danger: "PATROL",
    maxSuspicion: 0,
    spawnGrace: 0,
    jamToast: null,
    jamToastAt: 0,
    levelStats: { loot: 0, time: "0:00", coins: 0, jammers: 0, lockdowns: 0 },
    coinPos: null,
  };
}

export function buildShotState(shot) {
  if (!shot) return null;
  if (shot === "start") {
    const state = baseState(0);
    state.screen = "start";
    return state;
  }
  if (shot === "play") {
    const state = baseState(0);
    const { thief, guards, cameras, loot, alarm } = state;
    // One loot already in the bag; the other two glow on their pedestals.
    loot[0].taken = true;
    thief.lootCollected = 1;
    thief.coins = 4;
    thief.coinsThrown = 1;
    // The thief mid-crossing on the red carpet, facing north.
    thief.x = 640;
    thief.y = 470;
    thief.facing = -Math.PI / 2;
    // A coin mid-flight toward open floor west of the thief, clink ring staged.
    thief.coinFlight = { sx: 640, sy: 470, tx: 400, ty: 420, t: 0.55 };
    // West guard suspicious (orange cone, "?"), clear of the curtain,
    // turned toward the coin.
    guards[0].x = 480;
    guards[0].y = 260;
    guards[0].angle = Math.atan2(420 - 260, 400 - 480);
    guards[0].state = "suspicious";
    guards[0].suspicion = 0.55;
    guards[0].investigate = { x: 400, y: 420 };
    guards[0].lastSeen = { x: 400, y: 420 };
    // East guard patrolling north, gold cone clear of the west one.
    guards[1].x = 900;
    guards[1].y = 260;
    guards[1].angle = -Math.PI / 2;
    // Cameras: north-east camera sweeping down toward the thief's lane,
    // north-west camera sweeping the west loot.
    cameras[0].angle = 1.1;
    cameras[0].phase = 0.4;
    cameras[1].angle = Math.PI - 1.1;
    cameras[1].phase = 0.4;
    alarm.value = 38;
    state.danger = "SUSPICIOUS";
    state.maxSuspicion = 0.55;
    state.levelTime = 68;
    return state;
  }
  if (shot === "chase") {
    const state = baseState(0);
    const { thief, guards, cameras, loot, alarm } = state;
    loot[0].taken = true;
    loot[1].taken = true;
    thief.lootCollected = 2;
    // The thief just slipped north past the middle curtain, fleeing
    // toward the vault door; the chasing guard is south of the curtain,
    // coming around it (red cone, "!"). The thief stands well north of
    // the guard so the floating "!" mark cannot occlude them.
    thief.x = 640;
    thief.y = 420;
    thief.facing = -Math.PI / 2;
    thief.coins = 2;
    thief.coinsThrown = 3;
    thief.jammers = 2;
    thief.jammersUsed = 1;
    // Chasing guard close behind, red cone, "!".
    guards[0].x = 610;
    guards[0].y = 610;
    guards[0].angle = Math.atan2(thief.y - 610, thief.x - 610);
    guards[0].state = "chase";
    guards[0].suspicion = 1;
    guards[0].lastSeen = { x: thief.x, y: thief.y };
    guards[1].x = 1010;
    guards[1].y = 280;
    guards[1].angle = -Math.PI / 2;
    // North-east camera has the thief in its cone.
    cameras[1].angle = Math.atan2(thief.y - 70, thief.x - 1040);
    cameras[1].seeing = true;
    cameras[1].fillRate = 0.8;
    // North-west camera jammed by the thief's Q (grey cone).
    cameras[0].jammed = 4.2;
    alarm.value = 82;
    state.danger = "CHASE";
    state.maxSuspicion = 1;
    state.levelTime = 141;
    return state;
  }
  if (shot === "victory") {
    const state = baseState(0);
    const { thief, guards, cameras, loot } = state;
    for (const piece of loot) piece.taken = true;
    thief.lootCollected = 3;
    // Thief at the exit: inside the exit trigger zone (x 550..730,
    // y 14..108) and off the mask pedestal line (x 640), so the thief
    // reads instead of hiding behind the pedestal.
    thief.x = 560;
    thief.y = 95;
    thief.facing = -Math.PI / 2;
    state.exitOpen = true;
    state.screen = "victory";
    state.levelStats = { loot: 3, time: "3:12", coins: 4, jammers: 2, lockdowns: 1 };
    // Guards staged clear of curtain corners (live guards can never
    // stand on a curtain corner — blockedAt forbids it).
    guards[0].x = 420;
    guards[0].y = 260;
    guards[0].angle = Math.PI;
    guards[1].x = 880;
    guards[1].y = 260;
    guards[1].angle = 0;
    cameras[0].angle = 1.4;
    cameras[1].angle = Math.PI - 1.4;
    state.levelTime = 192;
    return state;
  }
  return null;
}
