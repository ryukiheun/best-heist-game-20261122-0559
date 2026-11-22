# Consolidated EGM Review — Velvet Vault (best-heist-game-20261122-0559)

- Target: `/home/hatch/workspace/makefun/best-heist-game-20261122-0559/DESIGN.md`
- Code reviewed: `game/src/config.js`, `vault.js`, `guard.js`, `camera.js`, `alarm.js`,
  `thief.js`, `main.js`, `render.js` (skim/full by reviewers), `hud.js`, `audio.js`,
  `input.js`, `shots.js`, `game/index.html`, `main.ts`
- Screenshots viewed: `screenshots/1-play.jpg` (cover), `3-chase.jpg`, `4-victory.jpg`
- Method: EGM Goldfish consolidated flow — four fresh-context reviewers
  (comprehension, design critic, structural critic, implementation readiness),
  plus independent verification by the synthesizer (see "Independent verification").
  Nothing was edited. The design doc's "Verification so far" section was **not**
  taken on trust; every claim below was checked against the code.
- Date: 2026-11-22

## Verdict: NOT SUBMITTABLE

One gameplay Blocker (B1) is reachable by normal play: a coin thrown onto a
pillar, case, or curtain permanently parks the investigating guard — patrol
never resumes, and the player can deliberately park every guard. Fix B1
(investigate give-up timer, or reject coin targets inside solid rects) before
submitting. The victory screenshot (M8) also needs restaging — the thief is
not identifiable at the exit. The remaining Majors are doc-vs-code drift and
balance problems; the alarm/lockdown rebalance (M1) is the largest design fix
and should be done in the same pass, since the alarm meter is close to
decorative in organic play.

Note on scope: `DESIGN.md` is **not** part of the submitted output (`main.ts`
copies only `game/` + `screenshots/`; the judge never sees the doc). Doc-only
findings (M4, M11–M14, M17 and most Nits) therefore do not change the judge's
score directly — but they are the reason a doc-only reimplementation would
play a different game, and they hide real gameplay issues (M3, M15).

## Independent verification (synthesizer, not the doc)

- Layout check re-run: `/tmp/check-vault.mjs` → `LAYOUT OK` (3 floors).
  Independent segment-vs-expanded-rect test agrees: no patrol leg intersects
  a pillar/case/curtain expanded by the 16 px guard radius. Tightest legs
  sit at 20 px clearance (4 px margin over the radius) — see M16.
- Logic sim re-run: `/tmp/sim-heist.mjs` → 13/13 pass. Caveat: the sim was
  not inspected for whether it imports the real modules or re-implements the
  model; 13/13 is consistent with the code as read, not proof by itself.
- `main.ts` two runs → identical dossier bytes (reviewer-measured sha256
  `3e63950e…e7288`, 778,310 bytes). `main.ts` uses only `mkdirSync` + `cpSync`
  + `writeFileSync`; no `rmSync`/`rm(` anywhere in `main.ts` or
  `vendor/makefun-game.ts`. The `/output` gate is clean.
- Cover screenshot (`1-play.jpg`) does its job for judge criterion 1: room,
  two guard cones + "?", red camera cones, gold loot, alarm meter
  "WATCHED — 38%", thief visible with gold ring, LOOT 1/3, TIME 1:08 — all
  matching the staged `shots.js` values. Weakest elements: camera mounts are
  near-invisible (only the cones carry the "camera" read), the staged coin is
  a ~5 px dot, and the east guard's gold cone overlaps the NE camera's red
  cone. Guard cones are pale gold on green — low contrast next to the red
  camera cones.

## Verified consistent (no finding)

Walk 175 / sneak 95 px/s; suspicion fill 1.1 close / 0.28 far, ×0.45 sneaking,
drain 0.35/s (patrol state only — see M4); chase give-up 3.0 s; catch <26 px;
camera cone 260 px / 0.42 rad, fill 0.8 / 0.4, ×0.5 sneaking; jammer 3/floor,
430 px, 6 s; alarm guard add 0.45 / 0.18, drain 0.12, lockdown 10 s,
guards ×1.2, cameras ×1.5, reset to 55; coins 5/floor, 0.45 s flight,
320 px hear radius; floors 1–3 guard speeds 55/205/220, 70/225/260,
85/245/300 with 2/3/3 cameras; exit rule (all loot + no lockdown) and the
all-loot-during-lockdown edge (`alarm.js: exitAllowed`, `main.js: updatePlay`
recomputes it after the alarm update); `?shot=` frozen states exist and
`main.js` freezes time / skips input in shot mode; HUD layout matches the doc
(alarm top-right, loot top-left, tools bottom-left, minimap under the alarm);
all 12 files named in the doc's implementation plan exist with their stated jobs.

---

## Blockers

### B1 — Coin thrown onto a pillar / case / curtain permanently parks the investigating guard
- Files: `game/src/guard.js` (`Guard.update`, suspicious + `investigate` branch),
  `game/src/main.js` (coin throw), `game/src/thief.js` (`throwCoin`)
- `guard.js` clears `investigate` only when the guard gets within
  `INVESTIGATE_ARRIVE` (18 px) of the coin point. `blockedAt` keeps guards
  16 px outside solid rects, so a coin near the centre of a 60×60 pillar
  (guard stops ≥46 px away), an 80×40 case (≥36 px), or a curtain (≥51 px)
  can never be "arrived" at. The patrol-return check
  (`stateTime > SUSPICIOUS_TIME && suspicion < 0.35`) lives only in the
  non-investigate branch, so it never runs while `investigate` is set.
  `main.js` + `throwCoin` place no obstacle validation on the click target —
  clicking anywhere, including on an obstacle, is normal input.
- Effect: one click removes a guard from patrol forever (it stays
  suspicious/orange and can still see/chase, but never patrols again). A
  player can deliberately park all guards and trivialise a floor.
- Fix: reject coin targets inside solid rects, or add a give-up timer to the
  investigate branch (e.g. abandon after ~4 s and return to patrol).

## Majors

### M1 — Alarm / lockdown is effectively unreachable in organic play
- Files: `game/src/config.js` (`ALARM_*`, `CAMERA_FILL_*`), `game/src/alarm.js`
  (`updateAlarm`)
- Time to lockdown from 0: one guard close alone 222 s, one guard far alone
  556 s, one camera close alone 125 s, one camera far 250 s. A realistic
  crossing (1 guard far + 1 camera far = 0.58/s) needs 172 s of continuous
  exposure. Meanwhile suspicion reaches chase in 0.91 s close / 3.6 s far,
  and a chase ends in a catch in seconds — the thief is caught long before
  the meter moves. The meter will sit at 0–5% for a whole floor in normal
  play. The "38%" in `1-play.jpg` and "82%" in `3-chase.jpg` are staged
  `?shot=` values, not reachable states. (The sim's "camera alone can drive
  alarm to lockdown" pass required ~125 s of sustained exposure.)
- Fix: raise fills ~5–10× (e.g. camera close 3–4/s) or lower the threshold,
  and re-verify the staged percentages are organically reachable.

### M2 — Jammers are near-useless, for the same reason — plus a range asymmetry
- Files: `game/src/camera.js` (`jamNearestCamera`), `game/src/config.js`
  (`JAMMER_RANGE` 430, `JAMMER_DURATION` 6 s, 3/floor), `game/src/vault.js`
- Silencing one camera for 6 s saves ~5 alarm points against a 100-point
  meter. The south camera on floors 2–3 (`vault.js`, 640,690) cannot be
  jammed from the north half: loot at y≈140 is ~550 px away, beyond the 430
  range. `jamNearestCamera` picks the nearest camera with no UI indicator of
  which one that is.
- Fix: make jammers matter (tie to the M1 rebalance) and document the range
  limit, or show the jam target.

### M3 — Footstep hearing is a whole mechanic the doc never mentions, and it is invisible to the player
- Files: `game/src/guard.js` (`hearsThief`, `update`), `game/src/config.js`
  (`THIEF_NOISE_WALK` 70 px, `THIEF_NOISE_SNEAK` 26 px, `HEAR_FILL` 0.6/s),
  `game/src/thief.js` (`noiseRadius`)
- A moving thief within 70 px (walking) or 26 px (sneaking) of a guard gains
  0.6 suspicion/s with no cone check and no line-of-sight check, in both
  `patrol` and `suspicious` states. Stacked with vision in patrol
  (`fill = seen + heard`), close walk becomes 1.7/s → chase in 0.59 s. No
  noise ring is rendered (only the coin CLINK ring is), so a player walking
  behind a guard gets "?" with no visible cause. `DESIGN.md` Rules never
  mentions hearing; the comprehension reviewer rated this a Blocker as a
  doc-fidelity issue (a doc-only reimplementation would build deaf guards).
- Fix: document hearing in DESIGN, and add a telegraph (noise ring or HUD
  hint); at minimum state the 70/26 px radii and 0.6/s rate.

### M4 — Suspicion rates are state-dependent; the doc states them as flat
- Files: `game/src/guard.js` (`Guard.update`), `DESIGN.md` Rules
- The doc says suspicion "drains 0.35/s unseen". That holds only in `patrol`.
  In `suspicious` the fill is `seen * 1.4 + heard` (a 1.4× multiplier nowhere
  in DESIGN or `config.js` comments) and the drain is `DETECT_DRAIN * 0.5`
  = 0.175/s. In `chase` suspicion does not drain at all. On chase give-up
  (`loseTime > 3.0 s`) suspicion resets to 0.5, not 0 — a re-spotted guard
  re-chases after only ~0.32 s of close sight. Earliest return to patrol is
  ~5.2 s after losing sight (3 s + 2.2 s `SUSPICIOUS_TIME`), not "gives up,
  then patrol" as the doc implies.
- Fix: put the ×1.4, the half-drain, and the 0.5 reset in DESIGN and `config.js`.

### M5 — Loot collect radius is 46 px, not the documented 33 px
- Files: `game/src/thief.js` (`collectLoot`), `game/src/config.js`
  (`LOOT_COLLECT_RADIUS`), `DESIGN.md` Rules
- Code collects when `dist < thief.radius + LOOT_COLLECT_RADIUS` = 13 + 33
  = 46 px centre-to-centre. The doc and the `config.js` comment both state
  33 px centre-to-centre — wrong by 39%. At 46 px loot can be grabbed from
  behind a case edge without entering the cone.
- Fix: change one side to match the other and state whether the number
  includes the thief radius.

### M6 — No suspicion meter: suspicion 0→0.35 is invisible
- Files: `game/src/hud.js` (`updateHud`), `game/src/main.js` (`maxSuspicion`)
- The HUD shows only `GUARDS: PATROL/SUSPICIOUS/CHASE` (worst state).
  `main.js` tracks `maxSuspicion` but never displays it. The "?" mark and
  orange cone appear only at 0.35. Crossing a far cone edge on foot fills
  ~0.34 on floor 1 (just under the threshold) — the player gets no graded
  warning before the guard flips to suspicious.
- Fix: add a per-guard suspicion pip/bar, or at least a "being seen"
  indicator that ramps before 0.35.

### M7 — Spawn is under camera surveillance on floors 2–3 from t=0
- Files: `game/src/vault.js` (L2/L3 south camera at 640,690, base −π/2;
  L3 south patrol y=560), `game/src/camera.js` (`detects`)
- Spawn is (640,650) — 40 px from the south camera, dead-centre in its cone,
  inside the close band (<104 px), so `detects` feeds 0.8 alarm/s until the
  player moves out. Floor 3 adds a south horizontal patrol at y=560, 90 px
  north of spawn. Floor 1 spawn is safe; floors 2–3 give the player no safe
  planning moment at level start, and DESIGN never mentions it.
- Fix: move the south camera/patrol off the spawn lane or grant a spawn grace
  period, and document it.

### M8 — Victory shot stages the thief where the live game would never put him
- Files: `game/src/shots.js` (`buildShotState("victory")`),
  `game/src/main.js` (exit check), `screenshots/4-victory.jpg`
- Thief staged at (640, 120). The live exit trigger requires
  `y < e.y + e.h + 40` = 108, so the staged thief is 12 px south of the
  trigger zone — the frame does not depict a state the game reaches at
  victory. From the south-high camera the thief sits directly behind the
  mask loot pedestal at (640, 150): in `4-victory.jpg` no black-coated thief
  is identifiable at the exit — only the static gold pedestal/case figure,
  which appears identically in all three screenshots.
- Fix: stage the thief off the pedestal line (e.g. x offset) and inside y < 108.

### M9 — "Several routes per room" is overstated — real sight-blocking cover is only the curtains
- Files: `game/src/vault.js` (all floors)
- Pillars sit only in the four corners; cases block movement, not sight.
  Mid-room sight cover is 3 curtains (floors 1–2) and 2 (floor 3). The centre
  loot (640,150) has no cover within ~150 px. "Routes" are really timing gaps
  in cone sweeps, not spatial routes. Floor 3 ("less cover") has 2 curtains
  for 4 guards + 3 cameras with 300 px / 0.6 rad cones.
- Fix: add mid-room pillars/curtains or reword the claim to timing-based
  play; floor 3 in particular needs one more curtain or a wider cone gap.

### M10 — No mechanical escalation across floors, only numbers
- Files: `game/src/vault.js`, `DESIGN.md` (Alternatives: lasers rejected)
- Floors differ in guard speed / chase speed / cone size / camera count only.
  No new verb, enemy type, or rule after floor 1. Fixed deterministic patrols
  + 5 coins + 3 jammers means floor 1's solution generalises; replayability
  and "depth" rest on timing alone. Acceptable for a screenshot-judged
  bounty, but DESIGN's "Depth" goal overclaims.
- Fix: document this as a deliberate scope trade-off; ideally give floor 3
  one new wrinkle (e.g. a stationary guard, a patrolling camera, or timed loot).

### M11 — Alarm fill is summed per watcher; the doc reads as a single rate
- Files: `game/src/alarm.js` (`updateAlarm`), `game/src/main.js`
  (guardRates / cameraRate accumulation), `DESIGN.md` Rules
- The doc says "guards add 0.45/s close / 0.18/s far while seeing". The code
  sums one contribution *per seeing guard* (plus summed camera rates), so two
  guards seeing the thief close fills at 0.9/s, not 0.45/s. Time-to-lockdown
  under multiple watchers is materially faster than the doc implies, and the
  doc never says "per guard".

### M12 — "All constants defined in config.js" is false; per-floor numbers missing from the doc
- Files: `game/src/vault.js` (`LEVELS`), `game/src/alarm.js` (`alarmStatus`),
  `DESIGN.md` Rules header
- Guard patrol/chase speeds, cone ranges (220/260/300), cone half-angles
  (0.5/0.55/0.6 rad), camera sweep speeds (0.55/0.7/0.85 rad/s) and sweep
  amplitudes (L1 0.85/0.85, L2 0.9/0.9/0.7, L3 1.0/1.0/0.8), waypoints,
  camera base/sweep angles, and all obstacle/loot coordinates live in
  `vault.js`, not `config.js`, and the cone/sweep numbers appear nowhere in
  the doc. Also undocumented: alarm status thresholds CALM <35 / WATCHED
  35–69 / HOT 70+ (`alarm.js`), `SUSPICIOUS_TIME` 2.2 s,
  `INVESTIGATE_ARRIVE` 18 px.

### M13 — `guard.js` does two jobs, and constants are duplicated as literals elsewhere
- Files: `game/src/guard.js`, `game/src/camera.js`, `game/src/thief.js`,
  `game/src/render.js`, `game/src/hud.js`
- `guard.js` holds guard AI (`Guard`) *and* the shared geometry helpers
  (`segmentHitsRect`, `hasLineOfSight`, `blockedAt`, `pointInRect`,
  `isHiddenInCurtain`). `camera.js` imports `hasLineOfSight` from `guard.js`;
  `thief.js` imports `isHiddenInCurtain`/`blockedAt` from `guard.js` — the
  camera/thief depend on the guard module for pure math. The doc discloses
  this ("guard.js (guard AI + geometry)") but it still breaks criterion 5's
  "one clear job each".
- `render.js` hardcodes the camera cone as `260 / S` and `0.42` instead of
  importing `CAMERA_RANGE`/`CAMERA_HALF_ANGLE`. `hud.js` hardcodes tool-slot
  counts (`for (let i = 0; i < 5; i++)` coins, `3` jammers) instead of
  `COINS_PER_LEVEL`/`JAMMERS_PER_LEVEL`. A config change silently diverges
  the render/HUD.

### M14 — Verification evidence is not in the repo
- Files: `DESIGN.md` ("Verification so far", "Risks and mitigations")
- The layout check and 13/13 logic sim are cited as `/tmp/check-vault.mjs`
  and `/tmp/sim-heist.mjs`. `/tmp` is ephemeral per workspace convention;
  neither file ships in the repo, so a fresh reader cannot re-run or confirm
  "LAYOUT OK" / "13/13 pass". The doc also never states whether the sim
  imports the real modules or re-implements the model, and the screenshot
  claim ("4 real renders viewed") points at JPEGs the doc does not locate.
- Fix: move the two scripts into the repo (e.g. `tools/`) and cite paths.

### M15 — Catch through a curtain: a hidden thief can be caught by a guard that cannot enter
- Files: `game/src/guard.js` (`catches`), `game/src/thief.js`
- `catches()` checks only distance <26 px and ignores `thief.hidden`. A
  chasing guard stopped at a curtain edge can catch a thief standing <26 px
  inside the curtain it cannot enter. Narrow trigger, but it contradicts the
  doc's "hidden in a curtain: no guard or camera can see the thief" and the
  "fair caught moment" goal.
- Fix: `catches()` should return false while `thief.hidden` (or the guard
  should not path to a point inside a curtain).

### M16 — Stale L1 pillar comments misdescribe the clearance they claim; six legs sit at 4 px margin
- Files: `game/src/vault.js` (L1 guard comments)
- "Legs clear the west pillar (x 300..360) by 20+ px" and "the east pillar
  (x 920..980)" — no such pillars exist in floor 1 (pillars are x180–240 and
  x1040–1100). The actual nearest obstacles are the curtains. Independent
  measurement confirms all legs clear, but six legs sit at exactly 4.0 px
  margin over the 16 px guard radius: floor 1 guard 0 leg x=560 and guard 1
  leg x=720 (vs curtains), floor 3 guard 0 legs x=240 and guard 1 legs
  x=1040 (vs pillars). The layout check is the only guardrail; any future
  nudge breaks a leg.
- Fix: correct the comments to name the real obstacle and margin.

### M17 — No Problem Statement or frame-loop architecture in the doc (feature-spec standard)
- Files: `DESIGN.md`
- The standard requires Problem Statement, Goals & Non-Goals, Proposed
  Architecture (component layout, data flows), Alternatives, Risks. "What it
  is" substitutes informally for a problem statement, and "Detailed
  implementation plan" is only a file list — there is no data-flow/frame-loop
  description (how `main.js` wires input → thief → guards/cameras → alarm →
  HUD/render each frame). Goals/Non-Goals, Alternatives (2D canvas, lasers,
  one floor — each with a concrete rejection reason), and Risks are present
  and pass. Also missing: success metrics (no target clear time or playtest
  pass rate for "winnable by a careful first-time player").

---

## Nits

### N1 — Close/far boundary (40% of cone range) is never stated in the doc
Every close/far rate pair depends on it (`guard.js seesThief`,
`camera.js detects`: `dist < range * 0.4` → guard close at 88/104/120 px by
floor, camera close at 104 px). Defined only in code comments.

### N2 — Exit trigger zone is larger than the exit, and undocumented
`main.js updatePlay` accepts x 550–730, y 14–108 vs exit rect 560–720,
24–68 (+10 px sides, +40 px south). A thief standing in the zone when a
lockdown ends wins instantly without re-entering.

### N3 — Coin details omitted from the doc
One coin in flight at a time (`thief.js throwCoin` returns false while
`coinFlight`); a throw still consumes a coin even if no guard is within
320 px; `guard.js hearNoise` ignores guards already in `chase`. Also, a
click that does not raycast onto the floor (`screenToWorld` returns null)
throws nothing.

### N4 — Alarm meter is frozen at 100 during lockdown
`alarm.js updateAlarm` returns early while `lockdown > 0` — no fill, no
drain — then resets to 55. The doc states the reset but not the freeze.
Re-lockdown from 55 needs 45 points (≈18 s of maximal simultaneous close
exposure, 56 s of one close camera).

### N5 — Floor 3 lockdown patrol outruns sneak
85 × 1.2 = 102 px/s patrol vs 95 px/s sneak (`config.js`
`LOCKDOWN_SPEED_MULT`) — during lockdown on floor 3, sneaking cannot
outpace even a patrolling guard.

### N6 — Knife-edge tuning, undocumented
Walking across a far cone edge fills ≈0.34 on floor 1 (just under the 0.35
suspicious threshold) but ≈0.54 on floor 3 (guaranteed suspicious) — same
action, different outcome by floor, with no in-game explanation.

### N7 — Chase-shot narrative is backwards; victory guard sits on a curtain corner
`shots.js` "chase": the thief at (640, 600) is *south* of the (560, 520)
curtain with the chasing guard between them — fleeing away from the curtain
toward the south door, not "toward a curtain". `shots.js` "victory": guard 0
at (420, 300) is exactly the top-left corner of curtain (420, 300, 120×70),
a spot `blockedAt(..., 16, true)` forbids a live guard from ever standing on.

### N8 — Cover coin barely reads; camera mounts near-invisible
The staged coin mid-flight (world ≈(508, 417), t=0.55) renders as a ~5 px
dot against the curtain edge in `1-play.jpg`. Camera mounts are likewise
near-invisible; only the cones carry the "camera" read. Top-right, the east
guard's gold cone and the NE camera's red cone overlap, slightly muddling
attribution. The minimap panel covers the north-east corner of the room.

### N9 — Victory stats overlap the exit sign
In `4-victory.jpg` the "LOOT: 3 / 3 TIME: 3:12 …" line crosses the
"VAULT • EXIT" sign. Legible but cluttered.

### N10 — Thief collision is centre-point only
`thief.js blocked()` calls `blockedAt(..., 0, false)` despite `THIEF_RADIUS`
13, while guards use radius 16 — the thief's body can visually overlap
pillar/case edges by up to 13 px. The doc says these "block movement"
without specifying the asymmetry. Curtain hiding is likewise centre-point
based (a thief straddling the edge counts as visible), and guards treat
curtains as solid while the thief walks through them — stated only in a
`vault.js` comment, not the doc.

### N11 — Small code-smell cluster
- Duplicate import: `JAMMER_RANGE` imported in a second, separate import in
  `main.js` after the `hud.js` import.
- `formatTime` defined identically in both `main.js` and `hud.js`.
- `thief.coinLand.announced` is set dynamically in `main.js` (`updatePlay`)
  but `createThief()` never initialises it — the coin-land object shape is
  split across two files.
- Dead export: `audio.js isMuted()` is never called. `guard.js`
  `segmentHitsRect` / `pointInRect` are exported but only used inside
  `guard.js` (either unexport or move to the geometry module from M13).
- Menu click math in `main.js handleMenuKeys` hardcodes row geometry
  (`(input.mouse.clickY - 380) / 44`, `clickX - WORLD_W/2 < 140`) that must
  match the start-menu CSS; a CSS tweak silently breaks menu clicking.

### N12 — `render.js` is 702 lines, ~3× the next-largest file
Single job (3D rendering) so it passes criterion 5, but `buildLevel()` alone
is ~400 lines of inline scene construction. Splitting the per-actor builders
out would match the doc's "one job each" spirit.

### N13 — `main.ts` `cpSync`-over with no cleanup
Copying over the previous run is the correct response to the no-delete gate,
but a file removed from `game/` would linger stale in `/output/game/` on the
next run. Accepted trade-off; worth one line in the doc. (Related: the
"two runs write identical dossier bytes" claim assumes an unchanged output
tree.)

### N14 — Coin-lured guards show no telegraph
`hearNoise` sets suspicious with suspicion possibly 0, so no "?" appears
(`render.js` requires suspicion > 0.35) — the player sees the guard walk off
with a gold cone, indistinguishable from patrol except by movement.

### N15 — Doc gaps: judge criterion, HUD bands, flows, external reference
- The doc's top goal cites "the judge's first criterion" without quoting,
  defining, or linking it; the bounty kit exists in the repo but the doc
  never points at it.
- HUD alarm status thresholds (CALM / WATCHED / HOT / LOCKDOWN at 35 and 70)
  are not in the doc; neither are the caught → level-restart,
  level-complete / victory flows, or the minimap.
- "Moss & Shadow rendering approach" is an undefined external reference
  (parenthetical gloss only).

---

## Traceability matrix

| Consolidated | Sources |
|---|---|
| B1 coin soft-lock | design critic Blocker |
| M1 alarm unreachable | design critic Major |
| M2 jammers near-useless | design critic Major |
| M3 hearing omitted + invisible | comprehension Blocker; design Major; structural Major 4 |
| M4 suspicion state rates | comprehension Major 2; design Major; impl-readiness Major 2 |
| M5 loot radius 46 vs 33 | comprehension Major 4; design Major; structural Major 1; impl-readiness Major 1 |
| M6 no suspicion meter | design critic Major |
| M7 spawn under camera | design critic Major |
| M8 victory staging | impl-readiness Major 4 |
| M9 routes overstated | design critic Major |
| M10 no escalation | design critic Major |
| M11 alarm summed per watcher | comprehension Major 3 |
| M12 constants not all in config.js | comprehension Major 5; impl-readiness Major 3 |
| M13 guard.js two jobs + literal constants | structural Major 2, 3; design Nit; impl-readiness Nit |
| M14 verification not in repo | comprehension Major 8; structural Major 5; design Nit |
| M15 catch through curtain | design critic Nit (upgraded: contradicts the cover promise) |
| M16 stale pillar comments + 4 px margins | impl-readiness Major 5 |
| M17 no problem statement / architecture | structural Major 6; design feature-spec check |
| N1–N15 | comprehension Nits 9–16; design Nits; structural Nits 7–15; impl-readiness Nits |

## Counts

- **Blockers: 1** (B1)
- **Majors: 17** (M1–M17)
- **Nits: 15** (N1–N15)

## Recommended fix order before submitting

1. B1: investigate give-up timer (or coin-target validation) + M15 `catches()`
   vs hidden — both are guard-logic fairness fixes in `guard.js`.
2. M8: restage the victory thief (inside y < 108, off the pedestal line);
   re-shoot `4-victory.jpg`.
3. M1 + M2: rebalance alarm fills (and jammer value) so lockdown is reachable
   in organic play; re-check the staged 38%/82% alarm values are plausible.
4. M7: move the floor 2–3 south camera/patrol off the spawn lane or add a
   spawn grace period.
5. M3 + M6: document hearing; add a noise telegraph and a suspicion indicator.
6. Doc pass (M4, M5, M11–M14, M17, N1, N15): correct the loot radius, state
   the state-dependent rates, the per-guard alarm sum, the 40% close/far
   boundary, and the per-floor numbers; move `/tmp/check-vault.mjs` and
   `/tmp/sim-heist.mjs` into the repo.
7. Nits: M13 literal constants, M16 comments, N11 code smells, N8/N9 shot
   polish — cheap, do with the same pass.
