// Sound effects synthesised with WebAudio: no audio files. Browsers only allow sound after the first tap or key,
// so unlockAudio() is called from the first input.

let ac = null, master = null, muted = false, noiseBuf = null;
const last = new Map();

export function unlockAudio() {
  try {
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain();
      master.gain.value = muted ? 0 : 0.45;
      master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ac.state === "suspended") ac.resume();
  } catch {
    ac = null;
  }
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.45;
}
export const isMuted = () => muted;

// the same sound at most once every `gap` seconds, so twenty hits in a frame don't clip
function gate(name, gap) {
  if (!ac || muted) return false;
  const now = ac.currentTime, t = last.get(name) ?? -1;
  if (now - t < gap) return false;
  last.set(name, now);
  return true;
}

function tone(type, f0, f1, dur, vol, delay = 0) {
  const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur, vol, f0, f1, filter = "lowpass", delay = 0, q = 1) {
  const t = ac.currentTime + delay, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = noiseBuf;
  s.loop = true;
  f.type = filter;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.02);
}

export const sfx = {
  bolt: () => gate("bolt", 0.05) && (tone("triangle", 1400, 500, 0.09, 0.12), noise(0.06, 0.05, 6000, 2000, "highpass")),
  hit: () => gate("hit", 0.04) && (noise(0.08, 0.14, 4000, 800, "bandpass", 0, 2), tone("square", 300, 120, 0.06, 0.05)),
  crit: () => gate("crit", 0.06) && (tone("square", 900, 1800, 0.08, 0.07), noise(0.1, 0.12, 5000, 1200, "bandpass", 0, 3)),
  pop: () => gate("pop", 0.05) && (tone("sine", 500, 90, 0.16, 0.18), noise(0.12, 0.08, 1500, 300)),
  gem: () => gate("gem", 0.03) && tone("sine", 1500 + Math.random() * 300, 2200, 0.06, 0.06),
  heart: () => gate("heart", 0.1) && (tone("triangle", 660, 660, 0.08, 0.12), tone("triangle", 990, 990, 0.12, 0.12, 0.08)),
  hurt: () => gate("hurt", 0.15) && (tone("sawtooth", 220, 70, 0.22, 0.14), noise(0.15, 0.1, 1200, 200)),
  arrow: () => gate("arrow", 0.08) && noise(0.12, 0.06, 3000, 6000, "bandpass", 0, 4),
  ultCharge: () => gate("ultc", 0.3) && (tone("sine", 200, 900, 0.4, 0.12), noise(0.4, 0.06, 500, 4000, "bandpass", 0, 3)),
  ultBurst: () => gate("ultb", 0.3) && (noise(0.7, 0.22, 3000, 200), tone("sine", 1600, 1200, 0.5, 0.08), tone("sine", 2400, 1800, 0.6, 0.05, 0.05)),
  jet: () => gate("jet", 0.5) && (noise(1.5, 0.16, 400, 2600, "bandpass", 0, 1.2), noise(1.3, 0.1, 2500, 300, "lowpass", 0.35)),
  boom: () => gate("boom", 0.06) && (noise(0.6, 0.35, 900, 60), tone("sine", 120, 35, 0.45, 0.3)),
  slam: () => gate("slam", 0.2) && (noise(0.5, 0.3, 600, 50), tone("sine", 90, 30, 0.4, 0.3)),
  level: () => gate("level", 0.3) && [523, 659, 784, 1047].forEach((f, i) => tone("triangle", f, f, 0.14, 0.12, i * 0.07)),
  wave: () => gate("wave", 0.5) && [392, 523, 659].forEach((f, i) => tone("square", f, f, 0.12, 0.06, i * 0.09)),
  boss: () => gate("boss", 1) && [196, 185, 175, 165].forEach((f, i) => tone("sawtooth", f, f * 0.98, 0.3, 0.08, i * 0.22)),
  click: () => gate("click", 0.04) && tone("square", 880, 880, 0.03, 0.05),
  sword: () => gate("sword", 0.06) && (noise(0.12, 0.16, 7000, 1500, "highpass"), tone("triangle", 900, 400, 0.08, 0.05)),
  arrowShot: () => gate("arrowS", 0.05) && (noise(0.08, 0.1, 2500, 6000, "bandpass", 0, 3), tone("triangle", 500, 900, 0.05, 0.04)),
  dash: () => gate("dash", 0.2) && noise(0.25, 0.18, 800, 4000, "bandpass", 0, 1.5),
  blink: () => gate("blink", 0.2) && (tone("sine", 600, 2400, 0.18, 0.1), tone("sine", 2400, 1200, 0.15, 0.06, 0.12)),
  shadow: () => gate("shadow", 0.3) && (tone("sawtooth", 160, 90, 0.35, 0.07), noise(0.3, 0.07, 400, 1500, "bandpass", 0, 4)),
  chest: () => gate("chest", 0.2) && [784, 988, 1175, 1568].forEach((f, i) => tone("triangle", f, f, 0.12, 0.1, i * 0.06)),
  coin: () => gate("coin", 0.04) && (tone("square", 1320, 1320, 0.04, 0.04), tone("square", 1760, 1760, 0.06, 0.04, 0.04)),
  quest: () => gate("quest", 0.4) && [523, 659, 784, 659, 1047].forEach((f, i) => tone("triangle", f, f, 0.12, 0.1, i * 0.09)),
  portal: () => gate("portal", 0.5) && (tone("sine", 300, 900, 0.4, 0.08), noise(0.4, 0.05, 800, 3000, "bandpass", 0, 5)),
  talk: () => gate("talk", 0.05) && tone("square", 440 + Math.random() * 200, 440, 0.03, 0.03),
  over: () => gate("over", 1) && [392, 330, 262, 196].forEach((f, i) => tone("triangle", f, f * 0.97, 0.3, 0.12, i * 0.2)),
};
