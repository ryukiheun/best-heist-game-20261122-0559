// audio.js — procedural WebAudio sound effects, no audio files.
// Every sound is a few oscillators / noise bursts built at call time.
// The context is created lazily on the first user gesture (browsers block
// audio before interaction); calls before that are silent no-ops.

export function createAudio() {
  let ctx = null;
  let muted = false;

  function ensure() {
    if (!ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        ctx = new AC();
      } catch (err) {
        ctx = null;
      }
    }
    if (ctx && ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, vol, when, slideTo) {
    const c = ensure();
    if (!c || muted) return;
    const t0 = c.currentTime + (when || 0);
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol || 0.12, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noiseBurst(dur, vol, freq) {
    const c = ensure();
    if (!c || muted) return;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = freq || 1800;
    src.connect(filter).connect(c.destination);
    src.start();
  }

  return {
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    click() {
      tone(660, 0.07, "square", 0.06);
    },
    step(sneaking) {
      tone(sneaking ? 140 : 180, 0.06, "sine", sneaking ? 0.03 : 0.06);
    },
    clink() {
      // A coin's bright clink: two high pings.
      tone(2400, 0.12, "triangle", 0.14);
      tone(3200, 0.18, "triangle", 0.1, 0.05);
    },
    loot() {
      // Loot chime: a rising gold arpeggio.
      tone(880, 0.14, "triangle", 0.14);
      tone(1174, 0.14, "triangle", 0.14, 0.09);
      tone(1568, 0.22, "triangle", 0.14, 0.18);
    },
    suspicious() {
      tone(520, 0.16, "square", 0.07, 0, 380);
    },
    chase() {
      // Alarm sting when a guard starts chasing.
      tone(440, 0.2, "sawtooth", 0.1, 0, 660);
      tone(660, 0.2, "sawtooth", 0.1, 0.12, 440);
    },
    jam() {
      // Jammer fizz: filtered noise falling away.
      noiseBurst(0.4, 0.12, 3200);
      tone(1200, 0.3, "sine", 0.06, 0, 300);
    },
    lockdown() {
      // Lockdown siren: three low wails.
      for (let i = 0; i < 3; i++) {
        tone(330, 0.35, "sawtooth", 0.09, i * 0.4, 520);
        tone(520, 0.35, "sawtooth", 0.07, i * 0.4 + 0.18, 330);
      }
    },
    victory() {
      tone(523, 0.18, "triangle", 0.14);
      tone(659, 0.18, "triangle", 0.14, 0.14);
      tone(784, 0.18, "triangle", 0.14, 0.28);
      tone(1046, 0.4, "triangle", 0.16, 0.42);
    },
    caught() {
      tone(220, 0.5, "sawtooth", 0.12, 0, 110);
      noiseBurst(0.3, 0.1, 900);
    },
  };
}
