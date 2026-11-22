// alarm.js — the vault alarm meter (0..100 points) and lockdown.
// The meter is the heist's shared tension: every watcher feeds it, and
// it is the only thing a camera can do to the thief. It fills while any
// guard sees the thief (ALARM_GUARD_CLOSE/FAR per s, by closeness) and
// while a camera sees the thief (the camera's own fill rate), and drains
// at ALARM_DRAIN per s when nobody sees the thief. Reaching 100 starts
// a LOCKDOWN_TIME-second lockdown: the exit shuts (even with all loot),
// guards run LOCKDOWN_SPEED_MULT faster and cameras sweep
// LOCKDOWN_SWEEP_MULT faster. When the lockdown ends the meter resets to
// LOCKDOWN_RESET (55), not 0, so a second slip-up soon after is punished.
// Status text for the HUD: "CALM" below 35, "WATCHED" 35..69,
// "LOCKDOWN" during a lockdown, "HOT" at 70+ outside a lockdown.

import {
  ALARM_GUARD_CLOSE,
  ALARM_GUARD_FAR,
  ALARM_DRAIN,
  ALARM_LOCKDOWN_AT,
  LOCKDOWN_TIME,
  LOCKDOWN_RESET,
} from "./config.js";

export function createAlarm() {
  return {
    value: 0, // points, 0..100
    lockdown: 0, // s left of lockdown, 0 = not in lockdown
    lockdowns: 0, // count, how many lockdowns this level so far
  };
}

// Advance the meter one frame. guardRates is the list of "close"/"far"
// buckets from guards that see the thief this frame (empty = unseen);
// cameraRate is the summed alarm fill from cameras this frame.
// Returns true on the frame a lockdown starts.
export function updateAlarm(alarm, dt, guardRates, cameraRate) {
  if (alarm.lockdown > 0) {
    alarm.lockdown = Math.max(0, alarm.lockdown - dt);
    if (alarm.lockdown === 0) alarm.value = LOCKDOWN_RESET;
    return false;
  }
  let fill = cameraRate;
  for (const r of guardRates) fill += r === "close" ? ALARM_GUARD_CLOSE : ALARM_GUARD_FAR;
  if (fill > 0) {
    alarm.value = Math.min(ALARM_LOCKDOWN_AT, alarm.value + fill * dt);
  } else {
    alarm.value = Math.max(0, alarm.value - ALARM_DRAIN * dt);
  }
  if (alarm.value >= ALARM_LOCKDOWN_AT) {
    alarm.lockdown = LOCKDOWN_TIME;
    alarm.lockdowns += 1;
    return true;
  }
  return false;
}

export function alarmStatus(alarm) {
  if (alarm.lockdown > 0) return "LOCKDOWN";
  if (alarm.value >= 70) return "HOT";
  if (alarm.value >= 35) return "WATCHED";
  return "CALM";
}

// True when the exit may open: all loot taken AND no lockdown running.
export function exitAllowed(alarm, lootTaken, lootTotal) {
  return lootTaken >= lootTotal && alarm.lockdown <= 0;
}
