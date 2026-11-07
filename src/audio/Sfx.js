// 외부 음원 없이 WebAudio로 효과음과 배경음을 합성한다. 모바일은 첫 터치 이후에야 소리가 나므로 unlock()을 입력 핸들러에서 부른다.
let ctx = null;
let master = null;
let muted = false;
let musicTimer = null;
let musicOn = false;

try {
  muted = localStorage.getItem('td-muted') === '1';
} catch {
  /* 저장소를 못 써도 무시 */
}

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.5;
  master.connect(ctx.destination);
  return ctx;
}

export function unlock() {
  const c = ensure();
  if (c && c.state === 'suspended') c.resume();
}

export function isMuted() {
  return muted;
}

export function setMuted(m) {
  muted = m;
  try {
    localStorage.setItem('td-muted', m ? '1' : '0');
  } catch {
    /* 무시 */
  }
  if (master) master.gain.value = m ? 0 : 0.5;
}

function tone({ freq = 440, end = freq, dur = 0.1, type = 'square', vol = 0.15, delay = 0, noise = false }) {
  const c = ensure();
  if (!c || muted) return;
  const t0 = c.currentTime + delay;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  g.connect(master);
  if (noise) {
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(freq, t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(60, end), t0 + dur);
    src.connect(f);
    f.connect(g);
    src.start(t0);
    src.stop(t0 + dur);
    return;
  }
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, end), t0 + dur);
  o.connect(g);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

// 같은 소리가 한꺼번에 쌓여 귀가 아프지 않게 짧은 시간 안의 반복은 건너뛴다.
const lastPlayed = {};
function gate(name, ms) {
  const now = performance.now();
  if (lastPlayed[name] && now - lastPlayed[name] < ms) return false;
  lastPlayed[name] = now;
  return true;
}

export const sfx = {
  click: () => gate('click', 40) && tone({ freq: 660, end: 880, dur: 0.05, type: 'triangle', vol: 0.12 }),
  deny: () => gate('deny', 80) && tone({ freq: 180, end: 120, dur: 0.12, type: 'sawtooth', vol: 0.12 }),
  build: () => {
    tone({ freq: 300, end: 600, dur: 0.1, type: 'square', vol: 0.12 });
    tone({ freq: 600, end: 900, dur: 0.12, type: 'square', vol: 0.1, delay: 0.08 });
  },
  upgrade: () => {
    [523, 659, 784].forEach((f, i) => tone({ freq: f, end: f, dur: 0.1, type: 'triangle', vol: 0.13, delay: i * 0.07 }));
  },
  sell: () => tone({ freq: 700, end: 300, dur: 0.15, type: 'triangle', vol: 0.12 }),
  slash: () => gate('slash', 50) && tone({ freq: 1400, end: 500, dur: 0.07, type: 'sawtooth', vol: 0.06 }),
  lance: () => gate('lance', 60) && tone({ freq: 220, end: 90, dur: 0.16, type: 'square', vol: 0.09 }),
  orb: () => gate('orb', 60) && tone({ freq: 900, end: 1500, dur: 0.1, type: 'sine', vol: 0.09 }),
  hit: () => gate('hit', 35) && tone({ freq: 300, end: 120, dur: 0.05, type: 'square', vol: 0.06 }),
  boom: () => gate('boom', 60) && tone({ freq: 500, end: 70, dur: 0.22, noise: true, vol: 0.18 }),
  kill: () => gate('kill', 40) && tone({ freq: 800, end: 1300, dur: 0.07, type: 'triangle', vol: 0.09 }),
  leak: () => {
    tone({ freq: 160, end: 60, dur: 0.35, type: 'sawtooth', vol: 0.2 });
    tone({ freq: 90, end: 50, dur: 0.4, noise: true, vol: 0.18 });
  },
  wave: () => {
    tone({ freq: 110, end: 110, dur: 0.5, type: 'sawtooth', vol: 0.14 });
    tone({ freq: 165, end: 165, dur: 0.5, type: 'sawtooth', vol: 0.1, delay: 0.02 });
  },
  clear: () => {
    [392, 523, 659].forEach((f, i) => tone({ freq: f, end: f, dur: 0.12, type: 'triangle', vol: 0.14, delay: i * 0.09 }));
  },
  win: () => {
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone({ freq: f, end: f, dur: 0.16, type: 'triangle', vol: 0.15, delay: i * 0.12 }));
  },
  lose: () => {
    [330, 262, 220, 165].forEach((f, i) => tone({ freq: f, end: f * 0.9, dur: 0.3, type: 'sawtooth', vol: 0.14, delay: i * 0.22 }));
  },
};

// ---------- 배경음: 어두운 단조 아르페지오 ----------
const NOTES = [110, 130.8, 164.8, 130.8, 98, 123.5, 146.8, 123.5, 87.3, 110, 130.8, 110, 98, 116.5, 146.8, 174.6];
let step = 0;

function musicTick() {
  if (!musicOn) return;
  const f = NOTES[step % NOTES.length];
  tone({ freq: f, end: f, dur: 0.42, type: 'triangle', vol: 0.09 });
  if (step % 4 === 0) tone({ freq: f / 2, end: f / 2, dur: 0.9, type: 'sine', vol: 0.12 });
  if (step % 8 === 6) tone({ freq: f * 4, end: f * 4, dur: 0.2, type: 'sine', vol: 0.03 });
  step += 1;
}

export function startMusic() {
  if (musicOn) return;
  musicOn = true;
  musicTimer = setInterval(musicTick, 380);
}

export function stopMusic() {
  musicOn = false;
  clearInterval(musicTimer);
  musicTimer = null;
}
