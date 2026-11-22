// camera.js — wall-mounted security cameras for Velvet Vault.
// A camera sits on a wall and sweeps its red cone back and forth around
// a base angle: angle(t) = base + sweep * sin(phase), so the cone
// movement is smooth, readable and predictable — the player times the
// sweep. A camera never catches the thief by itself: while the thief is
// inside its cone with line of sight (pillars and curtains block it,
// display cases do not), it feeds the alarm meter (see alarm.js) at a
// rate that scales with closeness and with sneaking. A jammer (Q key,
// nearest camera within JAMMER_RANGE) silences a camera for
// JAMMER_DURATION seconds: its cone goes dark and it feeds nothing.
// During a lockdown cameras sweep LOCKDOWN_SWEEP_MULT times faster.

import {
  CAMERA_RANGE,
  CAMERA_HALF_ANGLE,
  CAMERA_FILL_CLOSE,
  CAMERA_FILL_FAR,
  CAMERA_SNEAK_MULT,
  JAMMER_DURATION,
  LOCKDOWN_SWEEP_MULT,
} from "./config.js";
import { hasLineOfSight } from "./geometry.js";

export class SecurityCamera {
  constructor(def, level) {
    this.x = def.x;
    this.y = def.y;
    this.base = def.base; // rad, centre of the sweep
    this.sweep = def.sweep; // rad, sweep amplitude either side of base
    this.speed = level.sweepSpeed; // rad/s, sweep angular speed
    this.angle = def.base;
    this.phase = 0; // rad, sweep phase — advances with time
    this.jammed = 0; // s left of jam, 0 = live
    this.seeing = false; // true this frame when the thief is in the cone
    this.fillRate = 0; // alarm points/s this frame, 0 when not seeing
  }

  // Advance the sweep and the jam timer. lockdown=true speeds the sweep.
  update(dt, lockdown) {
    if (this.jammed > 0) this.jammed = Math.max(0, this.jammed - dt);
    const speed = this.speed * (lockdown ? LOCKDOWN_SWEEP_MULT : 1);
    this.phase += speed * dt;
    this.angle = this.base + this.sweep * Math.sin(this.phase);
  }

  // True when the thief is inside the cone with line of sight. Sets
  // this.fillRate (alarm points/s) and this.seeing for the HUD/render.
  // Returns the fill rate, or 0 when the camera is jammed, the thief is
  // hidden in a curtain, out of range, outside the cone, unsighted, or
  // inside spawn grace (grace > 0: level-start planning moment).
  detects(thief, level, grace) {
    this.seeing = false;
    this.fillRate = 0;
    if (grace > 0) return 0;
    if (this.jammed > 0) return 0;
    if (thief.hidden) return 0;
    const dx = thief.x - this.x;
    const dy = thief.y - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > CAMERA_RANGE) return 0;
    let diff = Math.atan2(dy, dx) - this.angle;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    if (Math.abs(diff) > CAMERA_HALF_ANGLE) return 0;
    if (!hasLineOfSight(this.x, this.y, thief.x, thief.y, level)) return 0;
    let rate = dist < CAMERA_RANGE * 0.4 ? CAMERA_FILL_CLOSE : CAMERA_FILL_FAR;
    if (thief.sneaking) rate *= CAMERA_SNEAK_MULT;
    this.seeing = true;
    this.fillRate = rate;
    return rate;
  }

  // Silence this camera for one jammer's duration.
  jam() {
    this.jammed = JAMMER_DURATION;
    this.seeing = false;
    this.fillRate = 0;
  }
}

// Jam the nearest live camera within range of the thief, if any.
// Returns the jammed camera, or null when no camera qualifies (none in
// range, or all in range already jammed).
export function jamNearestCamera(cameras, thief, range) {
  let best = null;
  let bestDist = Infinity;
  for (const cam of cameras) {
    if (cam.jammed > 0) continue;
    const d = Math.hypot(cam.x - thief.x, cam.y - thief.y);
    if (d < range && d < bestDist) {
      best = cam;
      bestDist = d;
    }
  }
  if (!best) return null;
  best.jam();
  return best;
}
