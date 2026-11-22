# Velvet Vault

[![make.fun · best-heist-game-20261122-0559](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/ryukiheun/best-heist-game-20261122-0559/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/ryukiheun/best-heist-game-20261122-0559/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)

An original top-down heist game for the [best-heist-game-20261122-0559](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559) bounty on make.fun.

You are the thief in a velvet-draped vault hall. Guards patrol with golden vision cones, wall cameras sweep red cones across the room, and every watcher feeds the ALARM meter. Take all 3 loot pieces — the Golden Mask, the Blue Diamond, the Lady in Gold — then reach the VAULT door EXIT before the alarm locks it down. Three floors, rising difficulty.

## How to play

- **WASD / Arrow keys** — move
- **Shift** — sneak (slower, harder to spot, quieter: guards hear walking within 70 px but sneaking only within 26 px)
- **Click** — throw a coin; guards investigate the CLINK (5 per floor, heard within 320 px)
- **Q / Right click** — jam the nearest camera for 6 s (3 per floor, within 430 px)
- **P** — pause, **M** — mute, **Esc** — main menu
- **Space / Enter** — advance: start the game, go to the next floor, play again after victory, or retry after being caught. On the start screen, Up/Down (or W/S) move the menu selection; you can also click a menu row.

Guard states: **PATROL** (gold cone) → **SUSPICIOUS** (orange cone, `?`) → **CHASE** (red cone, `!`). Suspicion is a 0–1 meter per guard: it fills while you are inside a cone with line of sight, drains when you are unseen (faster in curtains, which block sight), turns a guard suspicious above 0.35, and chases at 1. A chase gives up after 3.0 s without sight, and the guard returns to suspicious, then patrol. A guard that touches you catches you.

The **ALARM meter** (0–100) is fed by every watcher: a guard seeing you adds 0.45/s close or 0.18/s far, a camera seeing you adds 0.8/s close or 0.4/s far (halved while sneaking), and it drains 0.12/s when nobody sees you. At 100 the vault **locks down for 10 s**: the exit shuts even with all loot, guards run 20% faster and cameras sweep 50% faster. After a lockdown the meter resets to 55, not 0. A camera on its own can never catch you — it only feeds the alarm; only a guard's touch catches.

- **Velvet curtains** — hide inside; guards and cameras cannot see you there, your footsteps are muffled, and guards walk around a curtain instead of through it.
- **Marble pillars** — block a guard's and a camera's line of sight and block movement for you and for guards.
- **Glass display cases** — block movement, but guards see over the glass.
- **Loot and the exit** — collect all 3 loot pieces and the vault door EXIT opens (its glow turns green). Touching the door then finishes the floor. There is no stealth check at the door itself: a chased thief that reaches it still escapes, so the only lose condition is being touched — or being locked out by a lockdown at the wrong moment.

The HUD shows the floor (`FLOOR n OF 3`), the loot counter (`LOOT: n / 3`), a floor timer, a sneak indicator (`SNEAK: ON/OFF`), five coin slots and three jammer slots, a live mini-map (guards as gold/orange/red dots, cameras as red dots, loot, the exit, and you), and the ALARM METER with its status (`CALM / WATCHED / HOT / LOCKDOWN`) and a guard-status line. The game flows through eight screens: start, how to play, credits, play, paused, floor cleared, victory, caught.

Floors: **1 The Gilded Gallery** (2 guards, 55 px/s patrol, 205 px/s chase, 220 px cones, 2 cameras), **2 The Vault Hall** (3 guards, 70 px/s, 225 px/s chase, 260 px cones, 3 cameras), **3 The Crown Vault** (4 guards, 85 px/s, 245 px/s chase, 300 px cones, 3 fast cameras). Chase speed is always above your 175 px/s walk speed, so a chase can catch a thief that only runs — break line of sight in a curtain or behind a pillar instead.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

No runtime build step and no network requests: the game is plain static files, three.js is vendored locally in the repo, and all sounds are procedural WebAudio. `main.ts` is only the submission assembler — it copies `game/` and `screenshots/` into the output directory and writes `dossier.json`. All art is built from 3D primitives in code (three.js WebGL 3D) with a DOM HUD on top; all sounds are made with the WebAudio API.

## Layout

- `game/index.html` — the page: three.js canvas plus the DOM HUD and screens
- `game/vendor/three.module.min.js` — vendored three.js (minified build, MIT)
- `game/src/config.js` — the main tuned constants, each defined with units
- `game/src/vault.js` — the three vault layouts (guards, cameras, loot, curtains, pillars, cases, exit, spawn)
- `game/src/guard.js` — guard AI: patrol / suspicious / chase, vision cones, line of sight, footstep hearing, obstacle collision
- `game/src/camera.js` — security cameras: sweep, cone detection, jammers
- `game/src/alarm.js` — the alarm meter and lockdown rules
- `game/src/thief.js` — the thief: movement, sneaking, coins, jammers, loot
- `game/src/render.js` — the 3D vault hall: three.js scene, actors, cones, loot, vault door, chandeliers
- `game/src/hud.js` — DOM HUD, alarm meter, mini-map and full screens
- `game/src/audio.js` — procedural WebAudio sound effects (loot, clink, jam, lockdown, chase, victory, caught)
- `game/src/input.js` — keyboard + mouse state
- `game/src/shots.js` — deterministic `?shot=` screenshot states
- `game/src/main.js` — game loop and screen states
- `serve.ts` — tiny static server for local play
- `shots.json` — the four screenshot names and their `?shot=` queries
- `main.ts` — builds `/output` (game + screenshots + dossier.json)
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged
- `screenshots/` — real renders of the game (see `shots.json`)

## Screenshots

The cover (`1-play.jpg`) shows a mid-heist frame: the thief crossing the red carpet with one loot taken, a suspicious guard's orange cone turned toward a thrown coin, a camera cone sweeping in, and the alarm meter at 38% (WATCHED). `2-start.jpg` is the title screen over the full hall, `3-chase.jpg` is a chase at 82% alarm with a jammed camera, and `4-victory.jpg` is the clean getaway at the open vault door.
