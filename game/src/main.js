// main.js — game loop, screen states and the rules that tie the modules
// together. Screens: start, howto, credits, play, paused, levelcomplete,
// victory, caught. The loop runs at requestAnimationFrame with a clamped
// dt (max 0.05 s) so a slow frame cannot teleport the thief.
// Edge cases, listed so they are testable:
// - all 3 loot taken -> exit opens (unless a lockdown is running);
// - lockdown shuts the exit even with all loot; it reopens when the
//   lockdown ends.
// - guard touches the thief -> caught screen, level restarts on Space.
// - coins run out -> clicks do nothing (no throw, no sound).
// - jammers run out, or no camera in range -> Q does nothing.
// - chase with no sight for 3 s -> guard gives up to suspicious, then patrol.
// - thief hidden in a curtain -> no guard or camera can see them, alarm drains.
// - pause (P) freezes updates but keeps rendering the vault behind.
// - ?shot= states render frozen scenes with no input and no audio.

import {
  WORLD_W,
  LEVEL_COUNT,
  LOOT_PER_LEVEL,
  COIN_HEAR_RADIUS,
  LOCKDOWN_SPEED_MULT,
  SPAWN_GRACE_TIME,
  JAMMER_RANGE,
} from "./config.js";
import { getLevel } from "./vault.js";
import { createInput } from "./input.js";
import { createAudio } from "./audio.js";
import { Guard } from "./guard.js";
import { blockedAt } from "./geometry.js";
import { SecurityCamera, jamNearestCamera } from "./camera.js";
import { createAlarm, updateAlarm, alarmStatus, exitAllowed } from "./alarm.js";
import { createThief, updateThief, throwCoin, collectLoot, coinPosition } from "./thief.js";
import { parseShot, buildShotState } from "./shots.js";
import { VaultRenderer } from "./render.js";
import { updateHud, drawMinimap, showScreen, formatTime } from "./hud.js";

const input = createInput();
const audio = createAudio();
let renderer = null;

function startLevel(state, levelIndex) {
  const level = getLevel(levelIndex);
  state.levelIndex = levelIndex;
  state.level = level;
  state.thief = createThief(level);
  state.guards = level.guards.map((def) => new Guard(def, level));
  state.cameras = level.cameras.map((def) => new SecurityCamera(def, level));
  state.loot = level.loot.map((o) => ({ x: o.x, y: o.y, kind: o.kind, label: o.label, taken: false }));
  state.alarm = createAlarm();
  state.exitOpen = false;
  state.levelTime = 0;
  state.danger = "PATROL";
  state.maxSuspicion = 0;
  state.spawnGrace = SPAWN_GRACE_TIME; // s, no detection right after spawn
  state.jamToast = null; // "CAMERA JAMMED — 6s" + levelTime it was set
  state.jamToastAt = 0;
  state.screen = "play";
  state.coinPos = null;
  if (renderer) renderer.buildLevel(level);
}

function main() {
  const { shot } = parseShot();
  const shotState = buildShotState(shot);
  const state = shotState || {
    screen: "start",
    shotMode: false,
    menuIndex: 0,
    levelIndex: 0,
    level: getLevel(0),
    thief: createThief(getLevel(0)),
    guards: [],
    cameras: [],
    loot: [],
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
  renderer = new VaultRenderer(document.getElementById("scene"));
  renderer.buildLevel(state.level);
  let time = 0;
  let last = performance.now();
  let suspBeepCooldown = 0; // s, gates the suspicious beep only
  let stepTimer = 0; // s, paces the footstep sounds

  function finishLevel() {
    state.levelStats = {
      loot: state.thief.lootCollected,
      time: formatTime(state.levelTime),
      coins: state.thief.coinsThrown,
      jammers: state.thief.jammersUsed,
      lockdowns: state.alarm.lockdowns,
    };
    audio.victory();
    if (state.levelIndex + 1 >= LEVEL_COUNT) {
      state.screen = "victory";
    } else {
      state.screen = "levelcomplete";
    }
  }

  function caught() {
    state.screen = "caught";
    audio.caught();
  }

  function updatePlay(dt) {
    const { thief, guards, cameras, level, alarm } = state;
    state.levelTime += dt;
    suspBeepCooldown -= dt;
    stepTimer -= dt;
    // Spawn grace counts down; while it runs, guards and cameras do
    // not detect (see guard.js / camera.js `grace`).
    const grace = state.spawnGrace > 0 ? (state.spawnGrace = Math.max(0, state.spawnGrace - dt)) : 0;
    const inLockdown = alarm.lockdown > 0;
    const guardSpeedMult = inLockdown ? LOCKDOWN_SPEED_MULT : 1;

    updateThief(thief, input, dt, level);
    state.coinPos = coinPosition(thief);

    // Footsteps: a soft step sound while moving, quieter and slower
    // while sneaking — the sound the noise radius promises.
    if (thief.moving && stepTimer <= 0) {
      audio.step(thief.sneaking);
      stepTimer = thief.sneaking ? 0.62 : 0.42;
    }

    // Coin throw on left click: raycast the click onto the vault floor,
    // so the coin lands where the player pointed in 3D. A coin thrown
    // onto a pillar / case / curtain is rejected — no guard can ever
    // stand there to investigate, so the throw would only waste a coin
    // (the guard's INVESTIGATE_GIVE_UP timer is the backstop).
    if (input.mouse.clicked && renderer) {
      const target = renderer.screenToWorld(input.mouse.clientX, input.mouse.clientY);
      if (target && !blockedAt(target.x, target.y, level, 16, true) && throwCoin(thief, target.x, target.y)) audio.clink();
    }
    // Jammer on Q or right click: nearest live camera in range.
    if ((input.pressed("KeyQ") || input.mouse.rightClicked) && thief.jammers > 0) {
      const jammed = jamNearestCamera(cameras, thief, JAMMER_RANGE);
      if (jammed) {
        thief.jammers -= 1;
        thief.jammersUsed += 1;
        state.jamToast = "CAMERA JAMMED — 6s";
        state.jamToastAt = state.levelTime;
        audio.jam();
      }
    }
    // Coin landed this frame: guards in earshot investigate.
    if (thief.coinLand && thief.coinLand.t < dt + 0.001 && thief.coinLand.t >= 0) {
      if (!thief.coinLand.announced) {
        thief.coinLand.announced = true;
        for (const g of guards) g.hearNoise(thief.coinLand.x, thief.coinLand.y, COIN_HEAR_RADIUS);
      }
    }

    // Loot.
    if (collectLoot(thief, state.loot)) {
      audio.loot();
    }
    state.exitOpen = exitAllowed(alarm, thief.lootCollected, LOOT_PER_LEVEL);

    // Cameras sweep, then report what they see.
    let cameraRate = 0;
    for (const cam of cameras) {
      cam.update(dt, inLockdown);
      cameraRate += cam.detects(thief, level, grace);
    }

    // Guards.
    let worst = "PATROL";
    let maxS = 0;
    const guardRates = [];
    for (const g of guards) {
      g.update(dt, thief, level, () => audio.chase(), guardSpeedMult, grace);
      if (g.lastSeenRate) guardRates.push(g.lastSeenRate);
      if (g.state === "suspicious" && g.suspicion > 0.35 && suspBeepCooldown <= 0) {
        audio.suspicious();
        suspBeepCooldown = 1.2;
      }
      maxS = Math.max(maxS, g.suspicion);
      if (g.state === "chase") worst = "CHASE";
      else if (g.state === "suspicious" && worst !== "CHASE") worst = "SUSPICIOUS";
      if (g.catches(thief)) {
        caught();
        return;
      }
    }
    state.danger = worst;
    state.maxSuspicion = maxS;

    // Alarm meter: guards + cameras feed it; hitting 100 locks down.
    if (updateAlarm(alarm, dt, guardRates, cameraRate)) {
      audio.lockdown();
    }
    state.exitOpen = exitAllowed(alarm, thief.lootCollected, LOOT_PER_LEVEL);

    // Exit: only open when all loot is taken and no lockdown runs.
    if (state.exitOpen) {
      const e = level.exit;
      if (
        thief.x > e.x - 10 &&
        thief.x < e.x + e.w + 10 &&
        thief.y > e.y - 10 &&
        thief.y < e.y + e.h + 40
      ) {
        finishLevel();
      }
    }
  }

  function handleMenuKeys() {
    if (input.pressed("ArrowUp") || input.pressed("KeyW")) {
      state.menuIndex = (state.menuIndex + 2) % 3;
      audio.click();
    }
    if (input.pressed("ArrowDown") || input.pressed("KeyS")) {
      state.menuIndex = (state.menuIndex + 1) % 3;
      audio.click();
    }
    if (input.pressed("Space") || input.pressed("Enter")) {
      audio.unlock();
      audio.click();
      if (state.menuIndex === 0) startLevel(state, 0);
      else if (state.menuIndex === 1) state.screen = "howto";
      else state.screen = "credits";
    }
    if (input.mouse.clicked) {
      // Click a menu row: rows are centred at y = 400, 444, 488.
      const row = Math.floor((input.mouse.clickY - 380) / 44);
      if (row >= 0 && row < 3 && Math.abs(input.mouse.clickX - WORLD_W / 2) < 140) {
        state.menuIndex = row;
        audio.unlock();
        if (row === 0) startLevel(state, 0);
        else if (row === 1) state.screen = "howto";
        else state.screen = "credits";
      }
    }
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    // Shot mode renders frozen scenes: time never advances, so loot
    // bob, chandelier flicker and camera blink are identical on every
    // re-shoot of the same ?shot= scene.
    if (!state.shotMode) time += dt;

    if (!state.shotMode) {
      if (input.pressed("KeyM")) audio.toggleMute();
      if (state.screen === "start") {
        handleMenuKeys();
      } else if (state.screen === "howto" || state.screen === "credits") {
        if (input.pressed("Space") || input.pressed("Enter") || input.pressed("Escape") || input.mouse.clicked) {
          state.screen = "start";
        }
      } else if (state.screen === "play") {
        if (input.pressed("KeyP")) {
          state.screen = "paused";
        } else if (input.pressed("Escape")) {
          state.screen = "start";
          state.menuIndex = 0;
        } else {
          updatePlay(dt);
        }
      } else if (state.screen === "paused") {
        if (input.pressed("KeyP")) state.screen = "play";
        else if (input.pressed("Escape")) {
          state.screen = "start";
          state.menuIndex = 0;
        }
      } else if (state.screen === "levelcomplete") {
        if (input.pressed("Space") || input.pressed("Enter")) {
          startLevel(state, state.levelIndex + 1);
        } else if (input.pressed("Escape")) {
          state.screen = "start";
          state.menuIndex = 0;
        }
      } else if (state.screen === "victory") {
        if (input.pressed("Space") || input.pressed("Enter")) startLevel(state, 0);
        else if (input.pressed("Escape")) {
          state.screen = "start";
          state.menuIndex = 0;
        }
      } else if (state.screen === "caught") {
        if (input.pressed("Space") || input.pressed("Enter")) {
          startLevel(state, state.levelIndex);
        } else if (input.pressed("Escape")) {
          state.screen = "start";
          state.menuIndex = 0;
        }
      }
    }

    // Draw the current screen: sync the 3D vault, render it, then
    // drive the DOM HUD / screens / minimap on top.
    if (renderer) {
      renderer.sync(state, time);
      renderer.render();
    }
    showScreen(state, time);
    updateHud(state);
    if (state.screen === "play" || state.screen === "paused") drawMinimap(state);

    // Screenshot readiness: the shot helper waits for this flag, then
    // captures. Set it after the first rendered frame in shot mode,
    // and after the start screen has rendered once in normal mode.
    if (!window.__shotReady) window.__shotReady = true;
    input.endFrame();
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

main();
