# Velvet Vault — design document (for egm-review)

## Problem statement
The make.fun best-heist-game-20261122-0559 bounty asks for an
original, static-files-only heist game for a desktop browser in which
one frame shows the whole game at once: the room the thief crosses,
guards with vision cones, cameras, a loot target, and an alarm meter
(the judge's first criterion, per the bounty kit in
`best-heist-game-20261122-0559-kit/`). The player must read patrols
and camera sweeps before moving, use two limited tools (coins to lure
guards, jammers to silence cameras), take 3 loot pieces per floor, and
reach the VAULT door EXIT before the alarm locks it down. The game
reuses the Moss & Shadow stealth engine (three.js low-poly oblique
camera, cone sectors with hard edges, DOM HUD) and adds rotating
cameras, loot + extraction, and a live alarm meter.

## What it is
Velvet Vault is an original top-down heist game for the make.fun
best-heist-game-20261122-0559 bounty. One thief crosses a vault hall,
takes 3 loot pieces, and reaches the VAULT door EXIT. Static files only,
three.js (vendored minified), desktop Chrome, keyboard + mouse.

## Goals
- One frame shows everything the judge's first criterion needs: the
  room the thief crosses, guards with vision cones, cameras, a loot
  target, and an alarm meter.
- Depth: timing-based routes — patrols and camera sweeps the player
  must read before moving, plus cover pockets (curtains to hide in,
  pillars that block sight) and two tools at a cost (coins to lure,
  jammers to silence cameras). Mid-room sight cover is the curtains
  (3 on floors 1–2, 3 on floor 3); pillars sit in the corners and
  cases block movement, not sight — so "routes" are timing gaps in
  cone sweeps, not separate spatial lanes.
- Feel: tension as cones sweep, a fair caught moment (guard touch only,
  never a camera, never through a curtain), a getaway that pays off
  planning. A "SPOTTED" bar ramps before the "?" appears, and a faint
  noise ring shows how far guards hear footsteps.
- Look: a vault hall, not a generic tile set — teal tile floor with gold
  grout, red carpet runner, marble pillars, velvet curtains, gold loot.

## Non-goals
- No network, no sound files, no multiplayer, no procedural levels.
- No instant-fail cameras: cameras feed the alarm only, never catch.
- No new verb, enemy type, or rule after floor 1 — floors differ in
  numbers only (guard speed / chase speed / cone size / camera count
  and sweep). This is a deliberate scope trade-off for a 12-hour
  bounty: floor 1's solution generalises, and depth rests on timing.
  (Alternatives considered a floor-3 wrinkle — a stationary guard or
  timed loot — and rejected it for the same reason.)

## Frame loop (architecture)
`main.js` drives one `requestAnimationFrame` loop with dt clamped to
0.05 s. Each frame in `play`: `updateThief` (input → move/sneak,
coin flight, loot) → coin throw / jammer actions → cameras sweep and
`detects` → guards `update` (see/hear → suspicion → state) →
`updateAlarm` (guard + camera rates → meter / lockdown) → exit check
(all loot + no lockdown + thief inside the exit trigger zone) →
`renderer.sync` (3D scene from state) → `updateHud` + `drawMinimap`
(DOM). Screens (`start`, `howto`, `credits`, `play`, `paused`,
`levelcomplete`, `victory`, `caught`) are a state machine in `main.js`;
`?shot=` states are frozen frames built by `shots.js` (no input, no
audio, time frozen) so a re-shoot is byte-comparable.

## Rules (all constants defined with units in game/src/config.js;
per-floor numbers live in game/src/vault.js, see Floors)
- World 1280x720 px. Thief walk 175 px/s, sneak 95 px/s (Shift).
  Thief collision is centre-point only (`blockedAt` radius 0, while
  guards use 16 px) — the thief's body can visually overlap a
  pillar/case edge by up to 13 px (its radius). Curtain hiding is
  centre-point too. Guards treat curtains as solid; the thief walks
  through them to hide inside.
- Guards: patrol -> suspicious (>0.35 suspicion) -> chase (suspicion 1).
  Suspicion fills in cone with line of sight, close/far boundary at
  40% of cone range (guard close 88/104/120 px by floor, camera close
  104 px): 1.1/s close / 0.28/s far, x0.45 while sneaking. Rates are
  state-dependent: patrol fills `seen + heard` and drains 0.35/s
  unseen; suspicious fills `seen x 1.4 + heard` and drains 0.175/s
  (half); chase does not drain, and on give-up (3 s without sight)
  suspicion resets to 0.5 — a re-spotted guard re-chases after ~0.32 s
  of close sight. Earliest return to patrol after losing sight is
  ~5.2 s (3 s chase give-up + 2.2 s SUSPICIOUS_TIME with suspicion
  drained below 0.35). Chase gives up after 3 s without sight. Guard
  touch (<26 px) = caught — except a thief hidden in a curtain cannot
  be caught by a guard that cannot enter it (`catches` returns false
  while `thief.hidden`).
- Hearing: guards hear footsteps with no cone or line-of-sight check —
  walking within 70 px, sneaking within 26 px, at 0.6 suspicion/s
  (stacked with vision in patrol: close walk fills 1.7/s, chase in
  0.59 s). Standing still is silent; hiding in a curtain muffles
  steps. The noise ring around the moving thief and the SPOTTED bar
  make this visible: the ring radius is the hearing radius, and the
  bar shows the worst guard's suspicion 0..100% (the "?" appears at
  35%). Knife-edge tuning, stated: walking across a far cone edge
  fills ~0.34 on floor 1 (just under the 0.35 threshold) but ~0.54 on
  floor 3 (guaranteed suspicious) — same action, different outcome
  by floor.
- Cameras: sweep angle = base + sweep * sin(phase). Red cone 260 px,
  half-angle 0.42 rad. Detection feeds the alarm 2.5/s close, 1.2/s
  far, x0.5 while sneaking (same 40% close/far boundary). Jammer (Q /
  right click, 3 per floor, range 430 px) silences the nearest live
  camera for 6 s — a 6 s jam on a close camera saves 15 alarm points.
  The south camera on floors 2–3 sits 40 px from the spawn; it cannot
  be jammed from the north half (loot at y≈140 is ~550 px away, beyond
  the 430 px range). The HUD shows "CAMERA JAMMED — 6s" for 3 s when a
  jam lands, so the player knows which action worked.
- Alarm meter 0..100: guards add 1.5/s close / 0.6/s far while seeing —
  summed PER guard (two guards seeing close fill 3.0/s) — cameras add
  their rate, also summed per camera; drains 0.5/s when unseen. At
  100: lockdown 10 s — exit shuts, guards 10% faster, cameras sweep
  50% faster; during a lockdown the meter is frozen at 100 (no fill,
  no drain) and after lockdown it resets to 55. Time to lockdown from
  0: one close camera alone 40 s, one far guard + one far camera
  together ~55 s of continuous exposure. HUD bands: CALM <35,
  WATCHED 35–69, HOT 70+, LOCKDOWN during a lockdown.
- Loot: 3 per floor, collect radius 33 px centre-to-centre (the
  thief's 13 px radius is NOT added — at 40 px loot is not collected).
  Exit opens only with all 3 loot AND no lockdown running. The exit
  trigger zone is larger than the door: x 550–730, y 14–108 vs the
  exit rect 560–720, 24–68 (+10 px sides, +40 px south) — a thief
  standing in the zone when a lockdown ends wins instantly without
  re-entering.
- Tools: coins 5 per floor (click to throw, 0.45 s flight, guards
  within 320 px investigate the clink). One coin in flight at a time;
  a throw still consumes a coin even if no guard is in earshot; a
  click that does not raycast onto the floor throws nothing. A coin
  thrown onto a pillar / case / curtain is rejected (no coin spent)
  because no guard can ever stand there — and as a backstop, an
  investigating guard gives up after 4 s (INVESTIGATE_GIVE_UP) and
  returns to patrol instead of parking forever. A lured guard shows
  "?" immediately (suspicion floor 0.4 on `hearNoise`). Guards already
  in chase ignore coin clinks. Jammers 3 per floor.
- Cover: velvet curtains hide the thief and block sight; marble
  pillars block sight and movement; glass cases block movement only.
- Spawn grace: the first 3 s of a floor have no guard/camera
  detection (SPAWN_GRACE_TIME) — the south camera on floors 2–3 sits
  40 px from the spawn, so the player gets a planning moment. The HUD
  shows "GET READY — Ns (NO DETECTION YET)" while it runs.
- Lockdown patrol speed: floor 3 patrol 85 x 1.1 = 93.5 px/s stays
  below the 95 px/s sneak, so sneaking can still outpace a patrolling
  guard during a lockdown.

## Floors
Per-floor numbers (in `vault.js` LEVELS, not `config.js` — layouts,
waypoints, camera base/sweep angles and obstacle/loot coordinates
all live there):
1. The Gilded Gallery: 2 guards (55 px/s patrol, 205 chase, 220 px
   cones, 0.5 rad half-angle), 2 cameras (sweep 0.55 rad/s,
   amplitude 0.85/0.85 rad). 3 curtains, 4 corner pillars, 3 cases.
2. The Vault Hall: 3 guards (70/225/260, 0.55 rad), 3 cameras (sweep
   0.7 rad/s, amplitude 0.9/0.9/0.7). South wall camera guards the
   spawn lane (base −π/2). 3 curtains, 4 pillars, 4 cases.
3. The Crown Vault: 4 guards (85/245/300, 0.6 rad), 3 fast cameras
   (sweep 0.85 rad/s, amplitude 1.0/1.0/0.8). 3 curtains, 4 pillars,
   5 cases. South horizontal patrol at y=560 guards the spawn
   approach. Chase speed is always above walk speed, so running alone
   cannot escape.

## Flows
- Caught (guard touch) → `caught` screen → Space restarts the level.
- All loot + exit zone → `levelcomplete` (stats: loot/time/coins/
  jammers/lockdowns) → Space starts the next floor; after floor 3 →
  `victory` ("CLEAN GETAWAY!") → Space restarts from floor 1.
- HUD: alarm meter top-right (bar + CALM/WATCHED/HOT/LOCKDOWN + note),
  SPOTTED bar under it, loot top-left, time under loot, tools
  bottom-left, minimap top-right under the alarm (guards gold/orange/
  red, cameras red dots — grey when jammed, loot gold, exit green/red,
  thief white).
- Pause (P) freezes updates, keeps rendering. ?shot= states are frozen
  deterministic frames for screenshots.

## Edge cases
- All loot + lockdown: exit stays shut until lockdown ends.
- Coins out / jammers out / no camera in range: the action does nothing.
- Chase with no sight for 3 s: guard gives up to suspicious, then patrol.
- Hidden in a curtain: no guard or camera can see the thief; alarm drains.
- Pause (P) freezes updates, keeps rendering. ?shot= states are frozen
  deterministic frames for screenshots.

## Alternatives considered
- 2D canvas (starter style): rejected — three.js low-poly 3D reads
  better at contact-sheet size and reuses the proven Moss & Shadow
  rendering approach (oblique camera, cone sectors with hard edges).
- Lasers as a third watcher: rejected — cameras already fill the
  watcher role; lasers would add a third detection rule for the player
  to learn in a 12-hour bounty.
- One floor only: rejected — 3 floors show depth and reuse the same
  engine with rising numbers, like the stealth entry that scored.

## Risks and mitigations
- Cover screenshot must read at small size: mitigated by a staged
  ?shot=play frame (suspicious guard + coin + camera cone + 38% alarm
  all placed to read), checked by viewing the actual JPEGs. The 38%
  and 82% staged alarm values are organically reachable (about 21 s
  and 45 s of far guard + far camera exposure at the rebalanced rates).
- Guard waypoints clipping obstacles: mitigated by tools/check-vault.mjs
  (segment-vs-expanded-rect test on every patrol leg), run after edits.
  Tightest legs sit at 20 px clearance (4 px over the 16 px guard
  radius) — any layout nudge must re-run the check.
- main.ts must never remove /output (stealth round-1 EBUSY lesson):
  mitigated by copying the starter pattern verbatim (mkdir + cpSync
  only) and verifying two runs write identical dossier bytes. Note:
  cpSync-over means a file removed from game/ would linger stale in
  /output/game/ on the next run — accepted trade-off, no deletions
  planned.
- Transcript authorship: all game source was written in this session
  with the write tool; vendored three.js is a *.min.js (excluded).

## Verification so far
- Layout check (tools/check-vault.mjs): LAYOUT OK (3 floors, all
  patrol legs clear). The check re-implements the segment test
  independently of the game's geometry.js.
- Logic sim (tools/sim-heist.mjs): 25/25 pass — it imports the real
  modules (vault/guard/camera/alarm/thief), not a re-implementation:
  guard chase, curtain hiding, camera detection, alarm-to-lockdown in
  under 60 s from one close camera, jam, loot+exit (incl. 33 px
  centre-to-centre radius), lockdown shuts exit, coin lure (with "?"
  telegraph), unreachable-coin give-up + return to patrol, hidden
  thief cannot be caught, chase give-up, spawn grace (south camera +
  guard blind for 3 s, seeing without it).
- Screenshots: 4 real renders viewed (play/start/chase/victory);
  cover fixed twice (camera framing, thief visibility, guard out of
  curtain, thief out of curtain in chase shot); victory restaged
  after review (thief inside the exit trigger zone, off the pedestal
  line, guards off curtain corners).
- main.ts: two runs, identical dossier sha256.

## Success metrics
- Level 1 winnable by a careful first-time player who reads cones
  before moving (playtest target in config.js); level 3 demands coin
  lures + jammers. No formal playtest pass rate was measured in the
  bounty window — the sim + layout check stand in for it.

## Detailed implementation plan
Files under game/src, one job each: config.js (constants),
vault.js (3 layouts), geometry.js (pure 2D helpers: segment/rect,
line of sight, movement blocking, curtain hiding — shared by guard,
camera and thief), guard.js (guard AI only), camera.js (cameras +
jammers), alarm.js (meter + lockdown), thief.js (player),
render.js (three.js vault hall), hud.js (DOM HUD + minimap + screens),
audio.js (WebAudio), input.js (keyboard + mouse), shots.js
(deterministic screenshot states), main.js (loop + screens).
index.html holds the HUD (alarm meter top-right, loot top-left,
tools bottom-left, minimap under the alarm) and the screens.
main.ts (repo root) copies game/ + screenshots/ and writes dossier.json.
