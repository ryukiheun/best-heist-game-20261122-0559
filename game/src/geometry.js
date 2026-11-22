// geometry.js — pure 2D geometry helpers for Velvet Vault.
// No game state, no imports from other game modules: the guard AI,
// the cameras and the thief all use these. Units: world px (1280 x 720).
// - segmentHitsRect / pointInRect: low-level tests.
// - hasLineOfSight: pillars and curtains block sight (cases do not —
//   guards see over the low glass); a viewer inside a curtain sees
//   only inside that same curtain.
// - isHiddenInCurtain: the thief hides when its centre is inside a drape.
// - blockedAt: movement blocking — outside the room border or inside a
//   pillar / case / (for guards) curtain rect expanded by `radius` px.
//   Guards walk around curtains (curtainSolid true) so hiding in one is
//   a real escape; the thief passes through curtains (curtainSolid false).

import { WORLD_W, WORLD_H } from "./config.js";

// Does segment (x1,y1)-(x2,y2) cross rectangle r? Slab test.
export function segmentHitsRect(x1, y1, x2, y2, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tmin = 0;
  let tmax = 1;
  if (Math.abs(dx) < 1e-9) {
    if (x1 < r.x || x1 > r.x + r.w) return false;
  } else {
    let t1 = (r.x - x1) / dx;
    let t2 = (r.x + r.w - x1) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  if (Math.abs(dy) < 1e-9) {
    if (y1 < r.y || y1 > r.y + r.h) return false;
  } else {
    let t1 = (r.y - y1) / dy;
    let t2 = (r.y + r.h - y1) / dy;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  return true;
}

export function pointInRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

// True when nothing (pillar / curtain) stands between viewer and target.
export function hasLineOfSight(gx, gy, tx, ty, level) {
  for (const r of level.pillars) {
    if (segmentHitsRect(gx, gy, tx, ty, r)) return false;
  }
  // Curtains hide: sight into or out of a drape is blocked, unless the
  // viewer is inside the same drape.
  for (const b of level.curtains) {
    const viewerIn = pointInRect(gx, gy, b);
    const targetIn = pointInRect(tx, ty, b);
    if (viewerIn === targetIn) continue;
    if (segmentHitsRect(gx, gy, tx, ty, b)) return false;
  }
  return true;
}

export function isHiddenInCurtain(x, y, level) {
  return level.curtains.some((b) => pointInRect(x, y, b));
}

// True when the point (x, y) is blocked for movement: outside the room
// border or inside a pillar, display case or (for guards) curtain rect
// expanded by `radius` px. Guards walk around curtains (curtainSolid
// true) so hiding in one is a real escape; the thief passes through
// curtains to hide inside them (curtainSolid false).
export function blockedAt(x, y, level, radius, curtainSolid) {
  if (x < 24 + radius || x > WORLD_W - 24 - radius || y < 24 + radius || y > WORLD_H - 24 - radius) return true;
  for (const r of level.pillars) {
    if (x >= r.x - radius && x <= r.x + r.w + radius && y >= r.y - radius && y <= r.y + r.h + radius) return true;
  }
  for (const c of level.cases) {
    if (x >= c.x - radius && x <= c.x + c.w + radius && y >= c.y - radius && y <= c.y + c.h + radius) return true;
  }
  if (curtainSolid) {
    for (const b of level.curtains) {
      if (x >= b.x - radius && x <= b.x + b.w + radius && y >= b.y - radius && y <= b.y + b.h + radius) return true;
    }
  }
  return false;
}
