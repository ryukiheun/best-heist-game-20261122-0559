// vault.js — the three vault layouts for Velvet Vault.
// One level = { name, sub, guardSpeed, chaseSpeed, coneRange,
// coneHalfAngle, sweepSpeed, guards, cameras, loot, curtains, pillars,
// cases, exit, spawn }.
// Coordinates are world px in a 1280 x 720 room. The thief spawns at the
// south door (bottom centre) and must cross the room north to the vault
// door (top centre), which stays shut until all 3 loot pieces are taken.
// "pillars" block movement AND line of sight (tall marble columns).
// "cases" block movement only (low glass display cases — guards see over
// them, the thief cannot walk through them). "curtains" are velvet drapes:
// the thief hides inside them (guards cannot see in), guards walk around
// them, and they block line of sight from outside. Every guard waypoint
// sits in open floor and every patrol leg clears every pillar/case/
// curtain by at least the guard's 16 px collision radius — verified by
// the layout check in tools/check-vault.mjs (run it after any layout edit).
// Difficulty: level 1 has 2 slow guards + 2 slow cameras, level 2 has 3
// faster guards + 3 cameras, level 3 has 4 fast guards + 3 fast cameras
// with long wide cones and less curtain cover. Chase speed is always
// above the 175 px/s walk speed (see config.js).

export const LEVELS = [
  {
    name: "The Gilded Gallery",
    sub: "Floor 1 — the mask, the diamond, the portrait",
    guardSpeed: 55, // px/s patrol speed (level 1: slow, learnable)
    chaseSpeed: 205, // px/s, faster than the 175 px/s walk
    coneRange: 220, // px vision-cone length
    coneHalfAngle: 0.5, // rad, half-angle of the guard cone
    sweepSpeed: 0.55, // rad/s, camera sweep speed
    guards: [
      // West rectangle; legs clear the west curtain (x 420..540) by
      // 20 px (leg x=560) — the tightest clearance on this floor, 4 px
      // over the 16 px guard radius.
      { waypoints: [[300, 190], [560, 190], [560, 420], [300, 420]], start: 0 },
      // East rectangle; legs clear the east curtain (x 740..860) by
      // 20 px (leg x=720).
      { waypoints: [[720, 200], [980, 200], [980, 430], [720, 430]], start: 2 },
    ],
    cameras: [
      // North-west wall camera, sweeps the west half.
      { x: 240, y: 70, base: 0.9, sweep: 0.85 },
      // North-east wall camera, sweeps the east half.
      { x: 1040, y: 70, base: Math.PI - 0.9, sweep: 0.85 },
    ],
    loot: [
      { x: 640, y: 150, kind: "mask", label: "GOLDEN MASK" },
      { x: 1080, y: 330, kind: "diamond", label: "BLUE DIAMOND" },
      { x: 200, y: 330, kind: "painting", label: "LADY IN GOLD" },
    ],
    curtains: [
      { x: 420, y: 300, w: 120, h: 70 },
      { x: 740, y: 300, w: 120, h: 70 },
      { x: 560, y: 520, w: 160, h: 60 },
    ],
    pillars: [
      { x: 180, y: 90, w: 60, h: 60 },
      { x: 1040, y: 90, w: 60, h: 60 },
      { x: 180, y: 540, w: 60, h: 60 },
      { x: 1040, y: 540, w: 60, h: 60 },
    ],
    cases: [
      { x: 600, y: 240, w: 80, h: 40 },
      { x: 1080, y: 240, w: 80, h: 40 },
      { x: 120, y: 240, w: 80, h: 40 },
    ],
    exit: { x: 560, y: 24, w: 160, h: 44 },
    spawn: { x: 640, y: 650 },
  },
  {
    name: "The Vault Hall",
    sub: "Floor 2 — three guards, three cameras, no easy lane",
    guardSpeed: 70,
    chaseSpeed: 225,
    coneRange: 260,
    coneHalfAngle: 0.55,
    sweepSpeed: 0.7,
    guards: [
      { waypoints: [[260, 180], [620, 180], [620, 380], [260, 380]], start: 0 },
      { waypoints: [[660, 200], [1020, 200], [1020, 440], [660, 440]], start: 1 },
      // Centre vertical patrol between the two pillar rows.
      { waypoints: [[640, 120], [640, 560]], start: 0 },
    ],
    cameras: [
      { x: 240, y: 70, base: 0.9, sweep: 0.9 },
      { x: 1040, y: 70, base: Math.PI - 0.9, sweep: 0.9 },
      // South wall camera guards the spawn lane; its cone points north.
      { x: 640, y: 690, base: -Math.PI / 2, sweep: 0.7 },
    ],
    loot: [
      { x: 640, y: 130, kind: "mask", label: "GOLDEN MASK" },
      { x: 1100, y: 300, kind: "diamond", label: "BLUE DIAMOND" },
      { x: 180, y: 480, kind: "painting", label: "LADY IN GOLD" },
    ],
    curtains: [
      { x: 380, y: 470, w: 130, h: 70 },
      { x: 770, y: 470, w: 130, h: 70 },
      { x: 380, y: 250, w: 160, h: 55 },
    ],
    pillars: [
      { x: 180, y: 90, w: 60, h: 60 },
      { x: 1040, y: 90, w: 60, h: 60 },
      { x: 180, y: 540, w: 60, h: 60 },
      { x: 1040, y: 540, w: 60, h: 60 },
    ],
    cases: [
      { x: 420, y: 240, w: 80, h: 40 },
      { x: 780, y: 240, w: 80, h: 40 },
      { x: 1100, y: 480, w: 80, h: 40 },
      { x: 100, y: 300, w: 80, h: 40 },
    ],
    exit: { x: 560, y: 24, w: 160, h: 44 },
    spawn: { x: 640, y: 650 },
  },
  {
    name: "The Crown Vault",
    sub: "Floor 3 — four guards, fast cameras, thin cover",
    guardSpeed: 85,
    chaseSpeed: 245,
    coneRange: 300,
    coneHalfAngle: 0.6,
    sweepSpeed: 0.85,
    guards: [
      { waypoints: [[240, 170], [600, 170], [600, 400], [240, 400]], start: 0 },
      { waypoints: [[680, 170], [1040, 170], [1040, 400], [680, 400]], start: 2 },
      { waypoints: [[640, 110], [640, 580]], start: 0 },
      // South horizontal patrol, guards the spawn approach.
      { waypoints: [[220, 560], [1060, 560]], start: 1 },
    ],
    cameras: [
      { x: 240, y: 70, base: 0.9, sweep: 1.0 },
      { x: 1040, y: 70, base: Math.PI - 0.9, sweep: 1.0 },
      { x: 640, y: 690, base: -Math.PI / 2, sweep: 0.8 },
    ],
    loot: [
      { x: 640, y: 140, kind: "diamond", label: "CROWN DIAMOND" },
      { x: 1120, y: 300, kind: "mask", label: "GOLDEN MASK" },
      { x: 160, y: 300, kind: "painting", label: "LADY IN GOLD" },
    ],
    curtains: [
      { x: 440, y: 470, w: 120, h: 60 },
      { x: 720, y: 470, w: 120, h: 60 },
      // West mid-room pocket: clears the west patrol leg (x=240) by
      // 40 px and the (420,250) case by 20 px.
      { x: 280, y: 250, w: 120, h: 55 },
    ],
    pillars: [
      { x: 180, y: 90, w: 60, h: 60 },
      { x: 1040, y: 90, w: 60, h: 60 },
      { x: 180, y: 600, w: 60, h: 60 },
      { x: 1040, y: 600, w: 60, h: 60 },
    ],
    cases: [
      { x: 420, y: 250, w: 80, h: 40 },
      { x: 780, y: 250, w: 80, h: 40 },
      { x: 1100, y: 470, w: 80, h: 40 },
      { x: 100, y: 470, w: 80, h: 40 },
      { x: 500, y: 470, w: 80, h: 40 },
    ],
    exit: { x: 560, y: 24, w: 160, h: 44 },
    spawn: { x: 640, y: 650 },
  },
];

export function getLevel(index) {
  return LEVELS[index];
}
