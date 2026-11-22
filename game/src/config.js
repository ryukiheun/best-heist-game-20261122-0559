// config.js — Velvet Vault: every tuned number, with its definition,
// unit and the reason for the value. Units: px = world pixels in a
// 1280 x 720 room, px/s = pixels per second, s = seconds, rad = radians.
// Counts and unitless ratios are marked as such. Alarm is a 0..100 meter
// (unitless points); loot is a count; jammers are a count.
// Playtest target: level 1 is winnable by a careful first-time player
// who reads cones before moving; level 3 demands coin lures + jammers.

export const WORLD_W = 1280; // px, room width
export const WORLD_H = 720; // px, room height

// --- Thief movement (px/s) ---
export const THIEF_WALK_SPEED = 175; // px/s, normal move speed
export const THIEF_SNEAK_SPEED = 95; // px/s, while Shift is held
export const THIEF_RADIUS = 13; // px, collision circle of the thief
export const THIEF_NOISE_WALK = 70; // px, radius in which guards hear walking
export const THIEF_NOISE_SNEAK = 26; // px, radius in which guards hear sneaking

// --- Coins (the lure tool) ---
export const COINS_PER_LEVEL = 5; // count, coins given at the start of each level
export const COIN_HEAR_RADIUS = 320; // px, guards inside hear the clink
export const COIN_FLIGHT_TIME = 0.45; // s, coin travel time to the click point

// --- Jammers (the camera tool) ---
export const JAMMERS_PER_LEVEL = 3; // count, jammers given at the start of each level
export const JAMMER_RANGE = 430; // px, a camera must be within this of the thief to jam
export const JAMMER_DURATION = 6; // s, how long one jammer silences a camera

// --- Guard vision ---
// Detection fills a guard's suspicion 0..1. Rate scales with closeness
// and with the thief's speed: walking close fills in ~0.9 s (1.1/s),
// walking far in ~3.6 s (0.28/s), sneaking far in ~7.9 s (0.28 x 0.45).
// Close/far boundary: dist < 40% of cone range (guard close 88/104/120
// px by floor, camera close 104 px). Rates are state-dependent:
// - patrol: fill = seen + heard, drain 0.35/s unseen.
// - suspicious: fill = seen x 1.4 + heard, drain 0.175/s (half).
// - chase: no drain; on give-up (3 s unseen) suspicion resets to 0.5,
//   so a re-spotted guard re-chases after ~0.32 s of close sight.
// Earliest return to patrol after losing sight is ~5.2 s (3 s chase
// give-up + 2.2 s SUSPICIOUS_TIME with suspicion drained below 0.35).
export const DETECT_FILL_CLOSE = 1.1; // per s, thief within 40% of cone range
export const DETECT_FILL_FAR = 0.28; // per s, thief near the cone edge
export const DETECT_FILL_SNEAK_MULT = 0.45; // unitless ratio while sneaking
export const DETECT_DRAIN = 0.35; // per s, suspicion drains when unseen
export const HEAR_FILL = 0.6; // per s, suspicion gained while a guard hears footsteps
export const SUSPICIOUS_TIME = 2.2; // s, guard stares at last seen spot
export const CHASE_LOSE_TIME = 3.0; // s without sight before chase gives up
// Chase speed is set per level in vault.js (205/225/245 px/s), always
// above the 175 px/s walk speed so a chase can catch a fleeing thief.
export const CATCH_DISTANCE = 26; // px, guard-to-thief distance = caught
export const INVESTIGATE_ARRIVE = 18; // px, close enough to the noise point
export const INVESTIGATE_GIVE_UP = 4.0; // s, abandon a noise point never reached
// (a coin thrown onto a pillar / case / curtain the guard cannot stand
// on) and return to patrol instead of parking there forever.
export const SPAWN_GRACE_TIME = 3.0; // s, no guard/camera detection right
// after a level starts — the south camera on floors 2-3 sits 40 px from
// the spawn, so the player gets a planning moment before exposure starts.

// --- Security cameras ---
export const CAMERA_RANGE = 260; // px, camera cone length
export const CAMERA_HALF_ANGLE = 0.42; // rad, half-angle of the camera cone
export const CAMERA_FILL_CLOSE = 2.5; // alarm points/s, thief within 40% of range
export const CAMERA_FILL_FAR = 1.2; // alarm points/s, thief near the cone edge
export const CAMERA_SNEAK_MULT = 0.5; // unitless ratio while sneaking

// --- Alarm meter (0..100 points) ---
// Fills while any guard sees the thief (1.5/s close, 0.6/s far — summed
// PER guard: two guards seeing close fill 3.0/s) and while a camera sees
// the thief (see CAMERA_FILL_*, also summed per camera); drains 0.5/s
// when nobody sees the thief. At 100 the vault locks down for 10 s: the
// exit shuts, guards run 10% faster and cameras sweep 50% faster; after
// a lockdown the meter resets to 55, not 0, so a second slip-up soon
// after is punished. During a lockdown the meter is frozen at 100 (no
// fill, no drain) until the lockdown ends. A camera on its own can never
// catch the thief — it only feeds the alarm; only a guard's touch
// catches. Time to lockdown from 0: one close camera alone 40 s, one
// far guard + one far camera together ~55 s of continuous exposure —
// reachable in organic play, and a 6 s jam on a close camera now saves
// 15 points instead of ~5.
export const ALARM_GUARD_CLOSE = 1.5; // alarm points/s per seeing guard, close
export const ALARM_GUARD_FAR = 0.6; // alarm points/s per seeing guard, far
export const ALARM_DRAIN = 0.5; // alarm points/s, drains when unseen
export const ALARM_LOCKDOWN_AT = 100; // points, lockdown threshold
export const LOCKDOWN_TIME = 10; // s, lockdown duration
export const LOCKDOWN_RESET = 55; // points, alarm after a lockdown ends
export const LOCKDOWN_SPEED_MULT = 1.1; // unitless, guard speed during lockdown
// (1.1 keeps floor-3 patrol 85 x 1.1 = 93.5 px/s below the 95 px/s sneak,
// so sneaking can still outpace a patrolling guard during a lockdown)
export const LOCKDOWN_SWEEP_MULT = 1.5; // unitless, camera sweep during lockdown

// --- Level structure ---
export const LOOT_PER_LEVEL = 3; // count of loot pieces per level (no unit)
export const LEVEL_COUNT = 3; // count of levels (no unit)
export const LOOT_COLLECT_RADIUS = 33; // px, thief centre to loot centre = collected
