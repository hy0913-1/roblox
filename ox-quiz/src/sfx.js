// 칩튠 효과음(WebAudio 합성, 음원 파일 없음). 첫 터치 뒤에만 소리가 난다.
let ctx = null;
let master = null;
let muted = false;
try {
  muted = localStorage.getItem('ox-muted') === '1';
} catch {
  /* 무시 */
}

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.35;
  master.connect(ctx.destination);
  return ctx;
}

export function unlock() {
  const c = ensure();
  if (c && c.state === 'suspended') c.resume();
}

export const isMuted = () => muted;
export function setMuted(m) {
  muted = m;
  try {
    localStorage.setItem('ox-muted', m ? '1' : '0');
  } catch {
    /* 무시 */
  }
  if (master) master.gain.value = m ? 0 : 0.35;
}

function note(freq, dur, { type = 'square', vol = 0.12, delay = 0, slide = 0 } = {}) {
  const c = ensure();
  if (!c || muted) return;
  const t0 = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  g.connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

const seq = (notes, step = 0.08, opts) => notes.forEach((f, i) => f && note(f, step * 0.95, { ...opts, delay: i * step }));

export const sfx = {
  move: () => note(660, 0.05, { vol: 0.07, slide: 220 }),
  tick: () => note(1200, 0.04, { type: 'triangle', vol: 0.08 }),
  go: () => seq([523, 659, 784], 0.07, { vol: 0.1 }),
  question: () => seq([392, 523], 0.09, { type: 'triangle', vol: 0.12 }),
  cast: () => note(300, 0.18, { type: 'sawtooth', vol: 0.06, slide: 600 }),
  hit: () => note(180, 0.2, { vol: 0.1, slide: -100 }),
  block: () => seq([880, 1320], 0.05, { type: 'triangle', vol: 0.09 }),
  correct: () => seq([523, 659, 784, 1047], 0.07, { vol: 0.11 }),
  wrong: () => seq([330, 262, 196], 0.11, { type: 'sawtooth', vol: 0.09 }),
  out: () => seq([392, 330, 262, 196, 131], 0.12, { type: 'triangle', vol: 0.12 }),
  win: () => seq([523, 659, 784, 1047, 0, 784, 1047, 1319], 0.1, { vol: 0.12 }),
  click: () => note(900, 0.03, { type: 'triangle', vol: 0.06 }),
};
