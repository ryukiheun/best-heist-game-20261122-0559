// thief.js — the thief: movement, sneaking, coin throws, jammers,
// loot collection and the noise ring guards can hear.
// Movement is blocked by pillars, display cases and the room border;
// velvet curtains slow nothing but hide the thief (see guard.js
// isHiddenInCurtain). Click (left mouse) throws a coin toward the
// clicked floor point; Q jams the nearest camera in range. A coin in
// flight cannot be followed by another until it lands.

import {
  THIEF_WALK_SPEED,
  THIEF_SNEAK_SPEED,
  THIEF_RADIUS,
  THIEF_NOISE_WALK,
  THIEF_NOISE_SNEAK,
  COINS_PER_LEVEL,
  JAMMERS_PER_LEVEL,
  COIN_FLIGHT_TIME,
  LOOT_COLLECT_RADIUS,
} from "./config.js";
import { isHiddenInCurtain, blockedAt } from "./geometry.js";

export function createThief(level) {
  return {
    x: level.spawn.x,
    y: level.spawn.y,
    radius: THIEF_RADIUS,
    sneaking: false,
    moving: false,
    facing: -Math.PI / 2, // start facing up, toward the vault door
    coins: COINS_PER_LEVEL,
    coinsThrown: 0,
    jammers: JAMMERS_PER_LEVEL,
    jammersUsed: 0,
    lootCollected: 0,
    hidden: false,
    noiseRadius: 0,
    // Active coin flight, or null: {sx, sy, tx, ty, t}
    coinFlight: null,
    // Last landed coin, for the CLINK ring: {x, y, t} (t = age in s)
    coinLand: null,
  };
}

function blocked(x, y, level) {
  // Centre-point collision; guards use the same test with their
  // 16 px radius (see blockedAt in guard.js).
  return blockedAt(x, y, level, 0, false);
}

export function updateThief(thief, input, dt, level) {
  const v = input.moveVector();
  thief.sneaking = input.sneaking();
  thief.moving = v.x !== 0 || v.y !== 0;
  const speed = thief.sneaking ? THIEF_SNEAK_SPEED : THIEF_WALK_SPEED;
  if (thief.moving) {
    thief.facing = Math.atan2(v.y, v.x);
    // Move axis by axis so the thief slides along obstacles.
    const nx = thief.x + v.x * speed * dt;
    if (!blocked(nx, thief.y, level)) thief.x = nx;
    const ny = thief.y + v.y * speed * dt;
    if (!blocked(thief.x, ny, level)) thief.y = ny;
  }
  thief.hidden = isHiddenInCurtain(thief.x, thief.y, level);
  thief.noiseRadius = thief.moving
    ? thief.sneaking
      ? THIEF_NOISE_SNEAK
      : THIEF_NOISE_WALK
    : 0;

  // Coin flight: parabolic hop, then a landing that guards can hear.
  if (thief.coinFlight) {
    const f = thief.coinFlight;
    f.t += dt / COIN_FLIGHT_TIME;
    if (f.t >= 1) {
      thief.coinLand = { x: f.tx, y: f.ty, t: 0, announced: false };
      thief.coinFlight = null;
    }
  }
  if (thief.coinLand) {
    thief.coinLand.t += dt;
    if (thief.coinLand.t > 1.2) thief.coinLand = null;
  }
}

// Start a coin throw toward (tx, ty). Returns false with no coins left
// or while another coin is still flying.
export function throwCoin(thief, tx, ty) {
  if (thief.coins <= 0 || thief.coinFlight) return false;
  thief.coins -= 1;
  thief.coinsThrown += 1;
  thief.coinFlight = { sx: thief.x, sy: thief.y, tx, ty, t: 0 };
  return true;
}

// Current coin position (for drawing), or null when none is flying.
export function coinPosition(thief) {
  const f = thief.coinFlight;
  if (!f) return null;
  const hop = Math.sin(f.t * Math.PI) * 26; // px, arc height
  return { x: f.sx + (f.tx - f.sx) * f.t, y: f.sy + (f.ty - f.sy) * f.t - hop };
}

// Collect any loot within reach (centre-to-centre LOOT_COLLECT_RADIUS
// = 33 px — the thief's own radius is NOT added). Returns the loot
// collected, or null.
export function collectLoot(thief, loot) {
  for (const piece of loot) {
    if (piece.taken) continue;
    if (Math.hypot(piece.x - thief.x, piece.y - thief.y) < LOOT_COLLECT_RADIUS) {
      piece.taken = true;
      thief.lootCollected += 1;
      return piece;
    }
  }
  return null;
}
