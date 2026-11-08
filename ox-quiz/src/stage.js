// 도트 무대(캔버스). 논리 해상도 320x180, 3배로 그려 선명하게. 캐릭터 이동/낙하/얼음/투사체/말풍선 연출.
import { charCanvas, iconCanvas } from './pixel.js';

const W = 320;
const H = 180;
const S = 3;
const FLOOR = 104;
const ZONES = { O: [8, 132], X: [188, 312], '': [140, 180] };
const FONT = '"Galmuri11", "Galmuri9", monospace';

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export class Stage {
  constructor(canvas) {
    this.cv = canvas;
    canvas.width = W * S;
    canvas.height = H * S;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.actors = new Map(); // pid → {x,y,tx,ty,char,name,...}
    this.fx = [];
    this.parts = [];
    this.bubbles = new Map();
    this.pits = { O: 0, X: 0 };
    this.clouds = [0, 1, 2, 3].map((i) => ({ x: i * 90 + 10, y: 10 + (i % 2) * 18, w: 30 + (i % 3) * 8, v: 0.04 + i * 0.01 }));
    this.bg = this.makeBackground();
    this.t0 = performance.now();
    this.running = false;
  }

  makeBackground() {
    const cv = document.createElement('canvas');
    cv.width = W * S;
    cv.height = H * S;
    const c = cv.getContext('2d');
    const px = (x, y, w, h, col) => {
      c.fillStyle = col;
      c.fillRect(x * S, y * S, w * S, h * S);
    };
    const sky = ['#5aa9f0', '#6db5f3', '#80c1f5', '#95cdf7', '#abd9f9', '#c3e5fb'];
    sky.forEach((col, i) => px(0, i * 12, W, 12, col));
    px(0, 72, W, FLOOR - 72, '#c3e5fb');
    // 언덕
    const r = rng(7);
    for (let x = 0; x < W; x += 2) {
      const h = 10 + Math.round(6 * Math.sin(x / 23) + 4 * Math.sin(x / 9) + r() * 2);
      px(x, FLOOR - h, 2, h, '#7cc576');
      px(x, FLOOR - h, 2, 2, '#9bd98f');
    }
    // 무대 바닥: O(파랑) · 가운데(회색) · X(빨강)
    for (let y = FLOOR; y < H; y += 8) {
      for (let x = 0; x < W; x += 8) {
        const zone = x < 136 ? 'O' : x >= 184 ? 'X' : '';
        const even = ((x + y) / 8) % 2 === 0;
        const col = zone === 'O' ? (even ? '#3f74d6' : '#5288e6') : zone === 'X' ? (even ? '#d64f5a' : '#e6646d') : even ? '#8d8aa0' : '#a19eb4';
        px(x, y, 8, 8, col);
      }
    }
    px(0, FLOOR, W, 2, '#2c2440');
    px(134, FLOOR, 2, H - FLOOR, '#2c2440');
    px(184, FLOOR, 2, H - FLOOR, '#2c2440');
    // 큰 O, X 간판
    const sign = (cx, isO) => {
      px(cx - 2, 48, 4, FLOOR - 48, '#5b4a3a');
      px(cx - 22, 14, 44, 36, '#2c2440');
      px(cx - 20, 16, 40, 32, isO ? '#eaf3ff' : '#fff0f0');
      const col = isO ? '#2f6bd8' : '#d8394a';
      if (isO) {
        for (let a = 0; a < 360; a += 3) {
          const rr = 11;
          const x = Math.round(cx + rr * Math.cos((a * Math.PI) / 180));
          const y = Math.round(32 + rr * Math.sin((a * Math.PI) / 180));
          px(x - 2, y - 2, 4, 4, col);
        }
      } else {
        for (let i = -10; i <= 10; i++) {
          px(cx + i - 2, 32 + i - 2, 4, 4, col);
          px(cx + i - 2, 32 - i - 2, 4, 4, col);
        }
      }
    };
    sign(70, true);
    sign(250, false);
    return cv;
  }

  // players: [{pid, char, name, side, alive, frozen, shield, me}]
  setPlayers(list) {
    const seen = new Set();
    const groups = { O: [], X: [], '': [] };
    for (const p of list) if (p.alive !== false) groups[p.side || ''].push(p);
    for (const [side, arr] of Object.entries(groups)) {
      arr.sort((a, b) => (a.pid < b.pid ? -1 : 1));
      const [x0, x1] = ZONES[side];
      // 가운데(고민 중)는 좁아서 3줄로 촘촘히 겹쳐 세운다
      const mid = side === '';
      const cols = mid ? 3 : 4;
      const gap = mid ? 12 : (x1 - x0 - 16) / (cols - 1);
      arr.forEach((p, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const tx = mid ? x0 + col * gap : x0 + col * gap;
        const ty = FLOOR + 14 + row * (mid ? 15 : 21) + (mid ? (col % 2) * 4 : 0);
        this.upsert(p, tx, ty, mid);
        seen.add(p.pid);
      });
    }
    for (const p of list) if (p.alive === false) {
      const a = this.actors.get(p.pid);
      if (a) a.out = true;
      seen.add(p.pid);
    }
    for (const pid of [...this.actors.keys()]) if (!seen.has(pid)) this.actors.delete(pid);
  }

  upsert(p, tx, ty, mid = false) {
    let a = this.actors.get(p.pid);
    if (!a) {
      a = { pid: p.pid, x: tx, y: ty, tx, ty, fall: 0, hop: 0 };
      this.actors.set(p.pid, a);
    }
    if (a.tx !== tx || a.ty !== ty) {
      a.hop = 1;
      a.tx = tx;
      a.ty = ty;
    }
    Object.assign(a, { char: p.char, name: p.name, frozen: p.frozen, shield: p.shield, me: p.me, out: false, mid });
  }

  // 이름을 이름표 폭(약 34도트)에 맞게 자른다
  fitName(a) {
    // 글꼴이 늦게 들어오면 다시 잰다
    const key = `${a.name}|${document.fonts ? document.fonts.status : ''}`;
    if (a.fitFor === key) return a.fit;
    const c = this.ctx;
    c.font = `20px ${FONT}`;
    let chars = [...(a.name || '')];
    while (chars.length > 1 && c.measureText(chars.join('')).width > 34 * S) chars = chars.slice(0, -1);
    a.fitFor = key;
    a.fit = chars.join('') + (chars.length < [...(a.name || '')].length ? '…' : '');
    if (a.fit.length > 1 && c.measureText(a.fit).width > 38 * S) a.fit = chars.slice(0, -1).join('') + '…';
    return a.fit;
  }

  // 화면 좌표로 캐릭터 찾기(스킬 대상 고르기)
  pick(clientX, clientY) {
    const r = this.cv.getBoundingClientRect();
    if (!r.width) return null;
    const x = ((clientX - r.left) / r.width) * W;
    const y = ((clientY - r.top) / r.height) * H;
    let best = null;
    let bd = 20 * 20;
    for (const a of this.actors.values()) {
      if (a.out || a.falling) continue;
      const dx = x - (a.x + 8);
      const dy = y - (a.y - 8);
      const d = dx * dx + dy * dy;
      if (d < bd) {
        bd = d;
        best = a.pid;
      }
    }
    return best;
  }

  posOf(pid) {
    const a = this.actors.get(pid);
    return a ? { x: a.x + 8, y: a.y - a.fall } : { x: 160, y: 120 };
  }

  // 스킬 투사체
  shoot(fromPid, toPid, kind, blocked) {
    const from = this.posOf(fromPid);
    const to = this.posOf(toPid);
    this.fx.push({ kind, x0: from.x, y0: from.y, x1: to.x, y1: to.y, t: 0, blocked });
  }

  bubble(pid, text) {
    this.bubbles.set(pid, { text, until: performance.now() + 2600 });
  }

  // 공개: 오답 구역 바닥이 열리고 틀린 사람은 떨어졌다 다시 올라온다
  reveal(answer, results) {
    const wrong = answer === 'O' ? 'X' : 'O';
    this.pits[wrong] = 1;
    this.revealAt = performance.now();
    for (const [pid, ok] of Object.entries(results)) {
      const a = this.actors.get(pid);
      if (!a) continue;
      if (ok) a.hop = 1.6;
      else a.falling = true;
    }
    const [x0, x1] = ZONES[answer];
    for (let i = 0; i < 40; i++) {
      this.parts.push({ x: x0 + Math.random() * (x1 - x0), y: 60 + Math.random() * 30, vx: (Math.random() - 0.5) * 0.6, vy: -0.5 - Math.random(), life: 1, col: ['#ffd23f', '#ff6b8b', '#7cf0c0', '#ffffff', '#7fb8ff'][i % 5] });
    }
  }

  clearReveal() {
    this.pits = { O: 0, X: 0 };
    for (const a of this.actors.values()) {
      a.falling = false;
      a.fall = 0;
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      this.draw();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
  }

  draw() {
    const c = this.ctx;
    const now = performance.now();
    const t = (now - this.t0) / 1000;
    c.drawImage(this.bg, 0, 0);
    const px = (x, y, w, h, col) => {
      c.fillStyle = col;
      c.fillRect(Math.round(x) * S, Math.round(y) * S, Math.max(1, Math.round(w)) * S, Math.max(1, Math.round(h)) * S);
    };
    // 구름
    for (const cl of this.clouds) {
      cl.x += cl.v;
      if (cl.x > W + 10) cl.x = -cl.w - 10;
      px(cl.x, cl.y + 4, cl.w, 6, '#ffffff');
      px(cl.x + 6, cl.y, cl.w - 14, 6, '#ffffff');
      px(cl.x + 2, cl.y + 9, cl.w - 4, 2, '#e3f1fb');
    }
    // 열린 바닥(구덩이)
    for (const side of ['O', 'X']) {
      if (!this.pits[side]) continue;
      const [x0, x1] = ZONES[side];
      px(x0 - 6, FLOOR + 3, x1 - x0 + 12, H - FLOOR - 3, '#120e1c');
      px(x0 - 6, FLOOR + 3, x1 - x0 + 12, 2, '#3a2f55');
    }
    // 캐릭터
    const list = [...this.actors.values()].filter((a) => !a.out).sort((a, b) => a.ty - b.ty);
    const labels = [];
    const bubbles = [];
    for (const a of list) {
      a.x += (a.tx - a.x) * 0.18;
      a.y += (a.ty - a.y) * 0.18;
      if (Math.abs(a.tx - a.x) < 0.3) a.x = a.tx;
      if (a.hop > 0) a.hop = Math.max(0, a.hop - 0.04);
      if (a.falling) a.fall = Math.min(70, a.fall + 3.2);
      else if (a.fall > 0) a.fall = Math.max(0, a.fall - 4);
      const bob = a.frozen ? 0 : Math.round(Math.sin(t * 4 + a.x) * 0.8);
      const hopY = Math.sin(a.hop * Math.PI) * 8;
      const x = Math.round(a.x);
      const y = Math.round(a.y - 16 + bob - hopY + a.fall);
      if (a.fall > 60) continue;
      // 그림자
      if (!a.falling) px(x + 3, a.y + 1, 10, 2, 'rgba(20,16,30,0.35)');
      c.globalAlpha = a.falling ? Math.max(0, 1 - a.fall / 60) : 1;
      c.drawImage(charCanvas(a.char, S), x * S, y * S);
      c.globalAlpha = 1;
      if (a.frozen) {
        c.fillStyle = 'rgba(160,225,255,0.55)';
        c.fillRect((x - 1) * S, (y - 1) * S, 18 * S, 18 * S);
        px(x - 1, y - 1, 18, 1, '#e9fbff');
        px(x - 1, y - 1, 1, 18, '#e9fbff');
      }
      if (a.shield) {
        c.strokeStyle = 'rgba(127,209,255,0.95)';
        c.lineWidth = S;
        c.strokeRect((x - 2) * S, (y - 2) * S, 20 * S, 20 * S);
      }
      if (a.me) {
        px(x + 6, y - 6, 4, 2, '#ffd23f');
        px(x + 7, y - 4, 2, 2, '#ffd23f');
      }
      // 이름표(가운데 무리에서는 내 이름만)
      if ((!a.mid || a.me) && !a.falling) labels.push({ x: x + 8, y: a.y + 3, name: this.fitName(a), me: a.me });
      // 스킬 대상 고르는 중: 깜빡이는 화살표
      if (this.aim && !a.me && Math.floor(t * 4) % 2 === 0) {
        px(x + 5, y - 8, 6, 2, '#ff4d6d');
        px(x + 6, y - 6, 4, 2, '#ff4d6d');
        px(x + 7, y - 4, 2, 2, '#ff4d6d');
      }
      // 말풍선
      const b = this.bubbles.get(a.pid);
      if (b) {
        if (now > b.until) this.bubbles.delete(a.pid);
        else {
          bubbles.push({ x: x + 8, y: y - 15, text: b.text });
        }
      }
    }
    // 이름표와 말풍선은 캐릭터 위에 한꺼번에(폰에서도 읽히게 크게)
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = `20px ${FONT}`;
    for (const l of labels.sort((p, q) => p.me - q.me)) {
      const tw = c.measureText(l.name).width / S;
      px(l.x - tw / 2 - 2, l.y, tw + 4, 8, l.me ? 'rgba(80,50,0,0.85)' : 'rgba(20,16,30,0.72)');
      c.fillStyle = l.me ? '#ffd23f' : '#ffffff';
      c.fillText(l.name, l.x * S, (l.y + 4) * S + 1);
    }
    c.font = `22px ${FONT}`;
    for (const b of bubbles) {
      const bw = c.measureText(b.text).width / S + 6;
      const bx = Math.max(1, Math.min(W - bw - 1, b.x - bw / 2));
      px(bx, b.y - 1, bw, 11, '#2c2440');
      px(bx + 1, b.y, bw - 2, 9, '#ffffff');
      px(b.x - 1, b.y + 10, 2, 2, '#2c2440');
      c.fillStyle = '#2c2440';
      c.fillText(b.text, (bx + bw / 2) * S, (b.y + 4.5) * S + 1);
    }
    // 투사체
    this.fx = this.fx.filter((f) => f.t <= 1.25);
    for (const f of this.fx) {
      f.t += 0.035;
      const k = Math.min(1, f.t);
      const x = f.x0 + (f.x1 - f.x0) * k;
      const y = f.y0 + (f.y1 - f.y0) * k - Math.sin(k * Math.PI) * 20;
      if (f.t < 1) c.drawImage(iconCanvas(f.kind, S), Math.round(x - 4) * S, Math.round(y - 4) * S);
      else {
        const r = (f.t - 1) * 40;
        c.strokeStyle = f.blocked ? '#7fd1ff' : '#ffd23f';
        c.lineWidth = S;
        c.strokeRect((f.x1 - r) * S, (f.y1 - r) * S, r * 2 * S, r * 2 * S);
      }
    }
    // 반짝이
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const p of this.parts) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.03;
      p.life -= 0.012;
      px(p.x, p.y, 2, 2, p.col);
    }
  }
}
