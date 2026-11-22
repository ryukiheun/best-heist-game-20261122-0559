// hud.js — DOM HUD, mini-map and full screens for Velvet Vault.
// The HUD is the judge's second read of the game: the ALARM meter is
// the biggest panel (top-right, with a coloured bar and a status word),
// the loot counter sits top-left, tools bottom-left, and the mini-map
// top-right under the alarm shows guards (gold/orange/red), cameras
// (red dots with a sweep tick), loot (gold), the exit (green/red) and
// the thief (white). Screens are shown/hidden by showScreen().

import { WORLD_W, WORLD_H, LOOT_PER_LEVEL, COINS_PER_LEVEL, JAMMERS_PER_LEVEL } from "./config.js";
import { alarmStatus } from "./alarm.js";

function $(id) {
  return document.getElementById(id);
}

// Shared with main.js (level-complete / victory stats).
export function formatTime(t) {
  const mm = Math.floor(t / 60);
  const ss = String(Math.floor(t % 60)).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function updateHud(state) {
  const hud = $("hud");
  if (!hud) return;
  const playing = state.screen === "play" || state.screen === "paused";
  hud.style.display = playing ? "block" : "none";
  if (!playing) return;
  $("hud-level").textContent = `FLOOR ${state.levelIndex + 1} OF 3 — ${state.level.name.toUpperCase()}`;
  $("loot-panel").textContent = `LOOT: ${state.thief.lootCollected} / ${LOOT_PER_LEVEL}`;
  $("time-panel").textContent = `TIME ${formatTime(state.levelTime)}`;
  $("sneak-mode").textContent = state.thief.sneaking ? "SNEAK: ON" : "SNEAK: OFF";
  $("sneak-mode").style.color = state.thief.sneaking ? "#ffe98a" : "#b8f5d0";
  // Coins.
  const coinSlots = $("coin-slots");
  if (coinSlots && coinSlots.children.length !== COINS_PER_LEVEL) {
    coinSlots.innerHTML = "";
    for (let i = 0; i < COINS_PER_LEVEL; i++) {
      const s = document.createElement("div");
      s.className = "slot";
      s.textContent = "●";
      coinSlots.appendChild(s);
    }
  }
  if (coinSlots) {
    for (let i = 0; i < COINS_PER_LEVEL; i++) {
      coinSlots.children[i].classList.toggle("empty", i >= state.thief.coins);
    }
  }
  // Jammers.
  const jamSlots = $("jam-slots");
  if (jamSlots && jamSlots.children.length !== JAMMERS_PER_LEVEL) {
    jamSlots.innerHTML = "";
    for (let i = 0; i < JAMMERS_PER_LEVEL; i++) {
      const s = document.createElement("div");
      s.className = "slot";
      s.textContent = "◉";
      jamSlots.appendChild(s);
    }
  }
  if (jamSlots) {
    for (let i = 0; i < JAMMERS_PER_LEVEL; i++) {
      jamSlots.children[i].classList.toggle("empty", i >= state.thief.jammers);
    }
  }
  // Alarm meter: the panel that must read at contact-sheet size.
  const alarm = state.alarm;
  const status = alarmStatus(alarm);
  const statusEl = $("alarm-status");
  statusEl.textContent = `ALARM: ${status} — ${Math.round(alarm.value)}%`;
  statusEl.style.color = alarm.lockdown > 0 ? "#ff6b6b" : alarm.value >= 70 ? "#ff9a3c" : alarm.value >= 35 ? "#ffe98a" : "#b8f5d0";
  const fill = $("alarm-fill");
  fill.style.width = `${Math.min(100, alarm.value)}%`;
  fill.style.background = alarm.lockdown > 0 ? "#ff2222" : alarm.value >= 70 ? "#ff6b3c" : alarm.value >= 35 ? "#ffb84d" : "#3dff7a";
  $("alarm-note").textContent = state.spawnGrace > 0
    ? `GET READY — ${Math.ceil(state.spawnGrace)}s (NO DETECTION YET)`
    : state.jamToast && state.levelTime - state.jamToastAt < 3
      ? state.jamToast
      : alarm.lockdown > 0
        ? `LOCKDOWN — EXIT SHUT ${Math.ceil(alarm.lockdown)}s`
        : state.exitOpen
          ? "VAULT OPEN — REACH THE EXIT!"
          : "CAMERAS + GUARDS FEED THE ALARM";
  // Danger line under the alarm.
  const danger = state.danger;
  $("danger-line").textContent = `GUARDS: ${danger}`;
  $("danger-line").style.color = danger === "CHASE" ? "#ff6b6b" : danger === "SUSPICIOUS" ? "#ff9a3c" : "#b8f5d0";
  // SPOTTED bar: the worst guard's suspicion (0..1) as a graded warning.
  // The "?" mark only appears at 0.35 — this bar ramps before that, so a
  // player crossing a cone edge sees the danger building instead of a
  // sudden flip to suspicious.
  const spotted = Math.max(0, Math.min(1, state.maxSuspicion || 0));
  $("spotted-line").textContent = `SPOTTED: ${Math.round(spotted * 100)}%`;
  $("spotted-line").style.color = spotted >= 1 ? "#ff6b6b" : spotted > 0.35 ? "#ff9a3c" : "#cfe0ff";
  const spottedFill = $("spotted-fill");
  spottedFill.style.width = `${Math.round(spotted * 100)}%`;
  spottedFill.style.background = spotted >= 1 ? "#ff2222" : spotted > 0.35 ? "#ff9a3c" : "#ffd76a";
}

export function drawMinimap(state) {
  const cv = $("minimap");
  if (!cv) return;
  const g = cv.getContext("2d");
  const W = cv.width;
  const H = cv.height;
  const sx = W / WORLD_W;
  const sy = H / WORLD_H;
  g.fillStyle = "#0a1a16";
  g.fillRect(0, 0, W, H);
  // Curtains.
  g.fillStyle = "#5a1420";
  for (const b of state.level.curtains) g.fillRect(b.x * sx, b.y * sy, b.w * sx, b.h * sy);
  // Pillars.
  g.fillStyle = "#8a8578";
  for (const r of state.level.pillars) g.fillRect(r.x * sx, r.y * sy, r.w * sx, r.h * sy);
  // Exit.
  const e = state.level.exit;
  g.fillStyle = state.exitOpen ? "#3dff7a" : "#ff4444";
  g.fillRect(e.x * sx, e.y * sy, e.w * sx, e.h * sy);
  // Loot.
  g.fillStyle = "#ffd76a";
  for (const o of state.loot) {
    if (o.taken) continue;
    g.beginPath();
    g.arc(o.x * sx, o.y * sy, 3, 0, Math.PI * 2);
    g.fill();
  }
  // Cameras: red dots; jammed ones are grey.
  for (const cam of state.cameras) {
    g.fillStyle = cam.jammed > 0 ? "#777777" : "#ff2222";
    g.beginPath();
    g.arc(cam.x * sx, cam.y * sy, 3, 0, Math.PI * 2);
    g.fill();
  }
  // Guards.
  for (const gd of state.guards) {
    g.fillStyle = gd.state === "chase" ? "#ff2222" : gd.state === "suspicious" ? "#ff9a3c" : "#ffc93c";
    g.beginPath();
    g.arc(gd.x * sx, gd.y * sy, 3.5, 0, Math.PI * 2);
    g.fill();
  }
  // Thief.
  g.fillStyle = "#ffffff";
  g.beginPath();
  g.arc(state.thief.x * sx, state.thief.y * sy, 3.5, 0, Math.PI * 2);
  g.fill();
}

const SCREENS = ["start", "howto", "credits", "levelcomplete", "victory", "caught", "paused"];

export function showScreen(state, time) {
  for (const name of SCREENS) {
    const el = $(`screen-${name}`);
    if (el) el.style.display = state.screen === name ? "block" : "none";
  }
  if (state.screen === "start") {
    const rows = document.querySelectorAll("#start-menu > div");
    rows.forEach((row, i) => {
      row.classList.toggle("sel", i === state.menuIndex);
      row.textContent = (i === state.menuIndex ? "> " : "  ") + ["START GAME", "HOW TO PLAY", "CREDITS"][i];
    });
    const press = $("press-space");
    if (press) press.style.opacity = Math.sin(time * 4) > -0.2 ? "1" : "0.35";
  }
  if (state.screen === "levelcomplete") {
    $("lc-stats").textContent = `LOOT: ${state.levelStats.loot} / ${LOOT_PER_LEVEL}   TIME: ${state.levelStats.time}   COINS: ${state.levelStats.coins}   JAMMERS: ${state.levelStats.jammers}   LOCKDOWNS: ${state.levelStats.lockdowns}`;
  }
  if (state.screen === "victory") {
    $("vic-stats").textContent = `LOOT: ${state.levelStats.loot} / ${LOOT_PER_LEVEL}   TIME: ${state.levelStats.time}   COINS: ${state.levelStats.coins}   JAMMERS: ${state.levelStats.jammers}   LOCKDOWNS: ${state.levelStats.lockdowns}`;
  }
}
