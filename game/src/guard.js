// guard.js — museum guard AI and its vision cone.
// States: "patrol" (walk waypoints, gold cone) -> "suspicious" (orange
// cone, "?", stares at the last seen / heard spot) -> "chase" (red cone,
// "!", runs at the thief). A coin clink sends guards to "investigate"
// the noise point. Suspicion is a 0..1 meter per guard; it fills while
// the thief is inside the cone with line of sight, drains otherwise.
// Hiding inside a velvet curtain breaks line of sight, so suspicion
// drains there. Pillars and curtains block sight; low display cases do
// not (guards see over the glass), but they still block movement.
// Geometry helpers live in geometry.js (shared with cameras + thief).

import {
  DETECT_FILL_CLOSE,
  DETECT_FILL_FAR,
  DETECT_FILL_SNEAK_MULT,
  DETECT_DRAIN,
  HEAR_FILL,
  SUSPICIOUS_TIME,
  CHASE_LOSE_TIME,
  CATCH_DISTANCE,
  INVESTIGATE_ARRIVE,
  INVESTIGATE_GIVE_UP,
} from "./config.js";
import { hasLineOfSight, blockedAt } from "./geometry.js";

export class Guard {
  constructor(def, level) {
    this.waypoints = def.waypoints;
    this.wpIndex = def.start || 0;
    this.x = def.waypoints[this.wpIndex][0];
    this.y = def.waypoints[this.wpIndex][1];
    this.speed = level.guardSpeed;
    this.chaseSpeed = level.chaseSpeed; // px/s, always above walk speed
    this.coneRange = level.coneRange;
    this.coneHalf = level.coneHalfAngle;
    this.angle = 0;
    this.state = "patrol";
    this.suspicion = 0; // 0..1; 1 triggers chase
    this.stateTime = 0; // s spent in the current state
    this.loseTime = 0; // s since last seeing the thief while chasing
    this.stuckTime = 0; // s spent not moving while walking waypoints
    this.investigate = null; // {x, y} noise point, or null
    this.investigateTime = 0; // s spent walking to the noise point
    this.lastSeen = null;
    this.faceTarget();
  }

  faceTarget() {
    const wp = this.waypoints[(this.wpIndex + 1) % this.waypoints.length];
    this.angle = Math.atan2(wp[1] - this.y, wp[0] - this.x);
  }

  // Can this guard see the thief right now? Returns a fill rate (per s)
  // or 0 when the thief is out of the cone, out of range, or hidden.
  // Also returns the closeness bucket the alarm meter uses: the caller
  // reads this.lastSeenRate ("close" | "far" | null).
  seesThief(thief, level) {
    this.lastSeenRate = null;
    if (thief.hidden) return 0;
    const dx = thief.x - this.x;
    const dy = thief.y - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > this.coneRange) return 0;
    let diff = Math.atan2(dy, dx) - this.angle;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    if (Math.abs(diff) > this.coneHalf) return 0;
    if (!hasLineOfSight(this.x, this.y, thief.x, thief.y, level)) return 0;
    const close = dist < this.coneRange * 0.4;
    this.lastSeenRate = close ? "close" : "far";
    let rate = close ? DETECT_FILL_CLOSE : DETECT_FILL_FAR;
    if (thief.sneaking) rate *= DETECT_FILL_SNEAK_MULT;
    return rate;
  }

  // Footstep hearing: a moving thief inside its noise radius is heard.
  // Walking is heard within 70 px, sneaking within 26 px; standing
  // still and hiding in a curtain (which muffles steps) are silent.
  // Returns a suspicion fill rate (per s), or 0 when unheard.
  hearsThief(thief) {
    if (thief.hidden || thief.noiseRadius <= 0) return 0;
    const dist = Math.hypot(thief.x - this.x, thief.y - this.y);
    return dist < thief.noiseRadius ? HEAR_FILL : 0;
  }

  hearNoise(x, y, radius) {
    if (this.state === "chase") return;
    if (Math.hypot(x - this.x, y - this.y) > radius) return;
    this.investigate = { x, y };
    this.investigateTime = 0;
    this.state = "suspicious";
    this.stateTime = 0;
    // A lured guard shows "?" right away (suspicion floor 0.4), so the
    // player sees why the guard walks off — a lure is a telegraph,
    // not a silent patrol change.
    this.suspicion = Math.max(this.suspicion, 0.4);
    this.angle = Math.atan2(y - this.y, x - this.x);
  }

  update(dt, thief, level, onChaseStart, speedMult, grace) {
    const mult = speedMult || 1;
    this.stateTime += dt;
    // During spawn grace (level start) the guard does not see or hear
    // the thief at all — it keeps patrolling, just blind for a moment.
    const seen = grace > 0 ? 0 : this.seesThief(thief, level);

    if (this.state === "patrol") {
      const heard = grace > 0 ? 0 : this.hearsThief(thief);
      const fill = seen + heard;
      if (fill > 0) {
        this.suspicion = Math.min(1, this.suspicion + fill * dt);
        this.lastSeen = { x: thief.x, y: thief.y };
        if (this.suspicion >= 1) {
          this.investigate = null;
          this.state = "chase";
          this.stateTime = 0;
          this.loseTime = 0;
          if (onChaseStart) onChaseStart();
        } else if (this.suspicion > 0.35) {
          this.state = "suspicious";
          this.stateTime = 0;
        }
      } else {
        this.suspicion = Math.max(0, this.suspicion - DETECT_DRAIN * dt);
      }
      this.walkWaypoints(dt, level, mult);
    } else if (this.state === "suspicious") {
      const heard = grace > 0 ? 0 : this.hearsThief(thief);
      if (seen > 0 || heard > 0) {
        this.suspicion = Math.min(1, this.suspicion + (seen * 1.4 + heard) * dt);
        this.lastSeen = { x: thief.x, y: thief.y };
        if (this.suspicion >= 1) {
          this.investigate = null;
          this.state = "chase";
          this.stateTime = 0;
          this.loseTime = 0;
          if (onChaseStart) onChaseStart();
        }
      } else {
        this.suspicion = Math.max(0, this.suspicion - DETECT_DRAIN * 0.5 * dt);
      }
      // Stare at the last seen spot, or walk to a noise point. Once the
      // guard has stared long enough with suspicion drained, it gives up
      // and resumes its patrol — even when it never saw the thief
      // (a coin lure on its own must not freeze a guard forever).
      if (this.investigate) {
        this.investigateTime += dt;
        this.moveToward(this.investigate.x, this.investigate.y, this.speed * 0.9 * mult, dt, level);
        if (Math.hypot(this.investigate.x - this.x, this.investigate.y - this.y) < INVESTIGATE_ARRIVE) {
          this.investigate = null;
          this.stateTime = 0;
        } else if (this.investigateTime > INVESTIGATE_GIVE_UP) {
          // Give up: the noise point is unreachable (a coin thrown
          // onto a pillar / case / curtain the guard cannot stand on).
          // Drop the lure and let the patrol-return check below run
          // next frame instead of parking here forever.
          this.investigate = null;
          this.stateTime = 0;
        }
      } else {
        if (this.lastSeen) {
          this.angle = Math.atan2(this.lastSeen.y - this.y, this.lastSeen.x - this.x);
        }
        if (this.stateTime > SUSPICIOUS_TIME && this.suspicion < 0.35) {
          this.state = "patrol";
          this.stateTime = 0;
          this.faceTarget();
        }
      }
    } else if (this.state === "chase") {
      if (seen > 0) {
        this.loseTime = 0;
        this.lastSeen = { x: thief.x, y: thief.y };
      } else {
        this.loseTime += dt;
      }
      const tx = this.lastSeen ? this.lastSeen.x : thief.x;
      const ty = this.lastSeen ? this.lastSeen.y : thief.y;
      this.moveToward(tx, ty, this.chaseSpeed * mult, dt, level);
      if (this.loseTime > CHASE_LOSE_TIME) {
        this.state = "suspicious";
        this.stateTime = 0;
        this.suspicion = 0.5;
      }
    }
  }

  walkWaypoints(dt, level, mult) {
    const wp = this.waypoints[(this.wpIndex + 1) % this.waypoints.length];
    const bx = this.x;
    const by = this.y;
    const arrived = this.moveToward(wp[0], wp[1], this.speed * (mult || 1), dt, level);
    if (arrived) {
      this.wpIndex = (this.wpIndex + 1) % this.waypoints.length;
      this.faceTarget();
      this.stuckTime = 0;
    } else if (Math.hypot(this.x - bx, this.y - by) < 0.5) {
      // No progress: a corner the slide could not get around. Give up
      // on this waypoint after 2 s rather than standing there forever.
      this.stuckTime += dt;
      if (this.stuckTime > 2) {
        this.wpIndex = (this.wpIndex + 1) % this.waypoints.length;
        this.faceTarget();
        this.stuckTime = 0;
      }
    } else {
      this.stuckTime = 0;
    }
  }

  // Step toward (tx,ty) at speed, sliding along pillars, cases and
  // curtains instead of walking through them. Moves axis by axis so the
  // guard slides along an obstacle edge; if both axes are blocked it
  // sidesteps perpendicular, and if that fails too it stands still
  // (the waypoint watchdog above then skips the waypoint).
  // Returns true when arrived.
  moveToward(tx, ty, speed, dt, level) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 4) return true;
    const step = Math.min(dist, speed * dt);
    const ux = dx / dist;
    const uy = dy / dist;
    const ox = this.x;
    const oy = this.y;
    if (!blockedAt(this.x + ux * step, this.y, level, 16, true)) this.x += ux * step;
    if (!blockedAt(this.x, this.y + uy * step, level, 16, true)) this.y += uy * step;
    if (this.x === ox && this.y === oy) {
      if (!blockedAt(this.x - uy * step * 0.5, this.y + ux * step * 0.5, level, 16, true)) {
        this.x += -uy * step * 0.5;
        this.y += ux * step * 0.5;
      }
    }
    this.angle = Math.atan2(dy, dx);
    return Math.hypot(tx - this.x, ty - this.y) < 4;
  }

  catches(thief) {
    // A thief hidden inside a curtain cannot be caught by a guard that
    // cannot enter it — the curtain is a real escape, not a trap.
    if (thief.hidden) return false;
    return Math.hypot(thief.x - this.x, thief.y - this.y) < CATCH_DISTANCE;
  }
}
