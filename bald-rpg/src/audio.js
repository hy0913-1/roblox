// 소리: 전부 WebAudio로 합성(음원 파일 없음). 첫 터치/키 입력 뒤에 켜진다.
let ctx = null, master = null, musicGain = null, muted = false, noiseBuf = null;
try { muted = localStorage.getItem('bald-rpg-muted') === '1'; } catch { /* 무시 */ }

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.5;
  master.connect(ctx.destination);
  musicGain = ctx.createGain();
  musicGain.gain.value = 0.16;
  musicGain.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}
export function unlock() {
  const c = ensure();
  if (c && c.state === 'suspended') c.resume();
}
export const isMuted = () => muted;
export function setMuted(m) {
  muted = m;
  try { localStorage.setItem('bald-rpg-muted', m ? '1' : '0'); } catch { /* 무시 */ }
  if (master) master.gain.value = m ? 0 : 0.5;
}

function tone(freq, dur, { type = 'square', vol = 0.12, delay = 0, slide = 0, out = master } = {}) {
  const c = ensure();
  if (!c || muted) return;
  const t0 = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(out);
  o.start(t0); o.stop(t0 + dur + 0.02);
}
function noise(dur, { vol = 0.2, delay = 0, freq = 1200, q = 0.7, slide = 0 } = {}) {
  const c = ensure();
  if (!c || muted) return;
  const t0 = c.currentTime + delay, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = noiseBuf;
  f.type = 'lowpass';
  f.frequency.setValueAtTime(freq, t0);
  if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(60, freq + slide), t0 + dur);
  f.Q.value = q;
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f); f.connect(g); g.connect(master);
  s.start(t0); s.stop(t0 + dur + 0.02);
}
const seq = (ns, step, o) => ns.forEach((f, i) => f && tone(f, step * 0.95, { ...o, delay: i * step }));

const SFX = {
  jump: () => tone(300, 0.12, { slide: 320, vol: 0.07 }),
  land: () => noise(0.06, { vol: 0.08, freq: 500 }),
  swing: () => noise(0.08, { vol: 0.1, freq: 2600, slide: -1800 }),
  hit: () => { noise(0.07, { vol: 0.16, freq: 1800 }); tone(220, 0.06, { vol: 0.07, slide: -90 }); },
  crit: () => { noise(0.1, { vol: 0.2, freq: 3200 }); seq([880, 1320], 0.04, { vol: 0.08 }); },
  hurt: () => tone(180, 0.2, { type: 'sawtooth', vol: 0.1, slide: -90 }),
  dead: () => seq([392, 330, 262, 196, 131], 0.13, { type: 'triangle', vol: 0.12 }),
  pop: () => { tone(520, 0.08, { vol: 0.07, slide: -300 }); noise(0.1, { vol: 0.07, freq: 900 }); },
  coin: () => seq([1319, 1760], 0.05, { vol: 0.06 }),
  potion: () => seq([523, 659, 784], 0.06, { type: 'triangle', vol: 0.1 }),
  level: () => seq([523, 659, 784, 1047, 0, 784, 1047, 1319], 0.09, { vol: 0.1 }),
  quest: () => seq([659, 784, 988, 1319], 0.08, { type: 'triangle', vol: 0.11 }),
  portal: () => tone(200, 0.4, { type: 'sine', vol: 0.12, slide: 700 }),
  beam: () => { tone(1400, 0.4, { type: 'sawtooth', vol: 0.06, slide: -900 }); tone(700, 0.4, { vol: 0.05, slide: 500 }); },
  slam: () => { noise(0.5, { vol: 0.4, freq: 300, slide: -220 }); tone(70, 0.4, { type: 'sine', vol: 0.3, slide: -30 }); },
  charge: () => tone(90, 0.7, { type: 'sawtooth', vol: 0.08, slide: 500 }),
  boom: () => { noise(0.7, { vol: 0.42, freq: 900, slide: -800 }); tone(60, 0.5, { type: 'sine', vol: 0.3, slide: -25 }); },
  flare: () => { noise(0.5, { vol: 0.1, freq: 4000, slide: -2000 }); tone(500, 0.5, { vol: 0.04, slide: 900 }); },
  jet: () => noise(1.6, { vol: 0.25, freq: 500, slide: 2400, q: 3 }),
  shot: () => tone(900, 0.15, { vol: 0.06, slide: -600 }),
  click: () => tone(900, 0.03, { type: 'triangle', vol: 0.06 }),
};
export const sfx = (name) => SFX[name] && SFX[name]();

// 배경 음악: 맵마다 짧은 선율을 되풀이
const N = { C3: 131, D3: 147, E3: 165, F3: 175, G3: 196, A3: 220, B3: 247, C4: 262, D4: 294, E4: 330, F4: 349, G4: 392, A4: 440, B4: 494, C5: 523, D5: 587, E5: 659, G5: 784, Eb4: 311, Bb3: 233, Ab3: 208, Eb3: 156, Gb4: 370 };
const TUNES = {
  town: { bpm: 112, lead: 'E4 G4 C5 G4 A4 G4 E4 . D4 F4 A4 F4 G4 E4 D4 .', bass: 'C3 . G3 . A3 . E3 . F3 . C3 . G3 . G3 .' },
  field: { bpm: 132, lead: 'G4 . C5 D5 E5 . D5 C5 A4 . C5 A4 G4 . E4 . F4 . A4 C5 D5 . C5 A4 G4 E4 G4 A4 G4 . . .', bass: 'C3 C3 G3 G3 A3 A3 E3 E3 F3 F3 C3 C3 G3 G3 G3 G3' },
  cave: { bpm: 96, lead: 'A3 . C4 . E4 . Eb4 . D4 . C4 . A3 . . . A3 . D4 . F4 . E4 . C4 . B3 . A3 . . .', bass: 'A3 . . . F3 . . . D3 . . . E3 . . .', type: 'triangle' },
  ruins: { bpm: 104, lead: 'E4 . G4 A4 B4 . A4 G4 E4 . D4 E4 Gb4 . . . E4 . G4 B4 D5 . B4 A4 G4 . Gb4 E4 E4 . . .', bass: 'E3 . B3 . C3 . G3 . A3 . E3 . B3 . B3 .', type: 'triangle' },
  boss: { bpm: 150, lead: 'A4 A4 C5 A4 Eb4 . E4 . A4 A4 C5 A4 G4 . Gb4 . F4 F4 A4 F4 E4 . D4 . E4 E4 Ab3 B3 E4 . . .', bass: 'A3 A3 A3 A3 F3 F3 F3 F3 D3 D3 D3 D3 E3 E3 E3 E3', type: 'sawtooth' },
};
let tune = null, timer = 0, step = 0, nextAt = 0;
export function music(name) {
  if (tune === name) return;
  tune = name;
  step = 0;
  clearInterval(timer);
  const T = TUNES[name];
  if (!T) return;
  const lead = T.lead.split(' '), bass = T.bass.split(' '), dur = 60 / T.bpm / 2;
  nextAt = 0;
  timer = setInterval(() => {
    const c = ensure();
    if (!c || c.state !== 'running' || muted) return;
    if (nextAt < c.currentTime) nextAt = c.currentTime + 0.05;
    while (nextAt < c.currentTime + 0.25) {
      const l = lead[step % lead.length], b = bass[Math.floor(step / (lead.length / bass.length)) % bass.length], d = nextAt - c.currentTime;
      if (l !== '.') tone(N[l], dur * 0.9, { type: T.type || 'square', vol: 0.5, delay: d, out: musicGain });
      if (b !== '.' && step % (lead.length / bass.length) === 0) tone(N[b] / 2, dur * 1.6, { type: 'triangle', vol: 0.8, delay: d, out: musicGain });
      if (step % 4 === 2) noise(0.03, { vol: 0.03, delay: d, freq: 6000 });
      step += 1;
      nextAt += dur;
    }
  }, 60);
}
