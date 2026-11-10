// 게임 본체: 이동·충돌, 몹, 전투와 스킬, 드롭, 성장, 퀘스트, 그리기.
import { createFrame, clearFrame, createFx, composite, painterFor, hex, PAL, Rng } from '../vendor/pixelfx/core/index.js';
import * as fxBeam from '../vendor/pixelfx/fx/arcane/arcane-beam.js';
import * as fxSlam from '../vendor/pixelfx/fx/impacts/ground-slam.js';
import * as fxLanding from '../vendor/pixelfx/fx/impacts/heavy-landing.js';
import * as fxSpark from '../vendor/pixelfx/fx/impacts/hit-spark.js';
import * as fxBlunt from '../vendor/pixelfx/fx/impacts/blunt-hit.js';
import * as fxCrit from '../vendor/pixelfx/fx/impacts/crit-hit.js';
import * as fxImplode from '../vendor/pixelfx/fx/explosions/implosion.js';
import * as fxPlasma from '../vendor/pixelfx/fx/explosions/plasma-explosion.js';
import * as fxQuake from '../vendor/pixelfx/fx/nature/quake.js';
import * as fxBoom from '../vendor/pixelfx/fx/explosions/small-explosion.js';
import * as fxBigBoom from '../vendor/pixelfx/fx/explosions/big-explosion.js';
import * as fxFlare from '../vendor/pixelfx/fx/projectiles/flare.js';
import * as fxPoof from '../vendor/pixelfx/fx/spawn/poof.js';
import * as fxLevel from '../vendor/pixelfx/fx/ui/level-up.js';
import * as fxHeal from '../vendor/pixelfx/fx/holy/heal.js';
import * as fxCollect from '../vendor/pixelfx/fx/pickups/collect-burst.js';
import * as fxThorns from '../vendor/pixelfx/fx/nature/thorns.js';
import * as fxSpawn from '../vendor/pixelfx/fx/spawn/spawn-portal.js';
import * as fxZap from '../vendor/pixelfx/fx/lightning/zap-hit.js';
import * as wBlossom from '../vendor/pixelfx/fx/weather/cherry-blossoms.js';
import * as wFireflies from '../vendor/pixelfx/fx/weather/fireflies.js';
import * as wLeaves from '../vendor/pixelfx/fx/weather/falling-leaves.js';
import { loadMap, composeBg, isSolid, isPlat, isLadder, tileAt, T, SW, SH } from './maps.js';
import { drawHero, POSE, outfit } from './hero.js';
import { blit } from './sprites.js';
import { MOBS } from './mobs-data.js';
import { bakeAll, stamp, JET, BOMB, WEIGHT, COINS, HAIR, POT_HP, POT_MP } from './art.js';
import { SKILLS, SKILL_ORDER, QUESTS, expNeed, maxHp, maxMp, atkOf } from './data.js';

const C = (s) => hex(s) >>> 0;
const GOLD = ['#3a2408', '#7a4a10', '#c88a1a', '#ffd23f', '#ffe98a', '#fff6c2', '#ffffff', '#ffffff'];
const GRAV = 900;
const NPC_LOOK = {
  elder: outfit(['#8fe0a8', '#5cc084', '#3a9462', '#286a48'], ['#e8e0d0', '#c8bca8', '#a09480', '#786c5c']),
  shop: outfit(['#c8a0ff', '#a070e8', '#7848c0', '#543090'], ['#5a5068', '#463c54', '#342c40', '#241e2e']),
  guide: outfit(['#ffe07a', '#f2b93b', '#b9811f', '#7a5212'], ['#58b0d8', '#3a88b8', '#286490', '#1c4668']),
};
const WEATHER = { blossom: wBlossom, fireflies: wFireflies, leaves: wLeaves };
const SAVE_KEY = 'bald-rpg-save-v1';

export class Game {
  constructor(canvas, hooks) {
    this.cv = canvas;
    canvas.width = SW;
    canvas.height = SH;
    this.ctx = canvas.getContext('2d');
    this.img = this.ctx.createImageData(SW, SH);
    this.frame = createFrame(SW, SH);
    this.bg = new Uint32Array(SW * SH);
    this.hooks = hooks; // { sfx(name), toast(msg), ui(), dialog(lines, name, then), ending() }
    this.S = bakeAll();
    this.rng = new Rng(Date.now() & 0xffff);
    this.keys = {};
    this.pressed = {};
    this.time = 0;
    this.paused = false;
    this.fx = [];
    this.mobs = [];
    this.drops = [];
    this.nums = [];
    this.shots = [];
    this.hairs = [];
    this.timers = [];
    this.jets = [];
    this.bombs = [];
    this.shake = 0;
    this.stop = 0;
    this.fade = 0;
    this.cam = { x: 0, y: 0 };
    this.p = this.newPlayer();
  }

  newPlayer() {
    const p = { x: 0, y: 0, vx: 0, vy: 0, face: 1, ground: false, ladder: false, state: 'idle', st: 0, anim: 0, lv: 1, exp: 0, gold: 30, sp: 0, glove: 0, skills: { beam: 1, slam: 0, quake: 0, air: 0 }, cd: { punch: 0, beam: 0, slam: 0, quake: 0, air: 0 }, pots: { hp: 5, mp: 3 }, potCd: 0, inv: 0, dropT: 0, quest: 0, qstate: 'new', kills: {}, hair: 0, map: 'village', dead: false, won: false };
    p.hp = maxHp(p);
    p.mp = maxMp(p);
    return p;
  }

  // ---------- 저장 ----------
  save() {
    const p = this.p;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ lv: p.lv, exp: p.exp, gold: p.gold, sp: p.sp, glove: p.glove, skills: p.skills, pots: p.pots, quest: p.quest, qstate: p.qstate, kills: p.kills, hair: p.hair, map: p.map === 'throne' ? 'ruins' : p.map, won: p.won, hp: p.hp, mp: p.mp }));
    } catch {
      /* 저장이 막힌 환경: 이번 판만 유지 */
    }
  }

  static hasSave() {
    try {
      return !!localStorage.getItem(SAVE_KEY);
    } catch {
      return false;
    }
  }

  load() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (!s) return false;
      Object.assign(this.p, this.newPlayer(), s);
      this.p.hp = Math.max(1, Math.min(maxHp(this.p), s.hp || 1));
      return true;
    } catch {
      return false;
    }
  }

  reset() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* 무시 */
    }
    this.p = this.newPlayer();
  }

  // ---------- 맵 ----------
  enter(id, tx, ty) {
    const m = loadMap(id), p = this.p;
    this.map = m;
    p.map = id;
    p.x = (tx ?? m.start[0]) * T + 8;
    p.y = (ty ?? m.start[1]) * T;
    p.vx = p.vy = 0;
    p.ladder = false;
    p.state = 'idle';
    this.fx = [];
    this.mobs = [];
    this.drops = [];
    this.nums = [];
    this.shots = [];
    this.hairs = [];
    this.timers = [];
    this.jets = [];
    this.bombs = [];
    this.boss = null;
    for (const sp of m.spawns) for (let i = 0; i < sp.n; i++) this.spawnMob(sp, true);
    this.weather = m.weather && WEATHER[m.weather] ? [createFx(WEATHER[m.weather], {}), createFx(WEATHER[m.weather], { seed: 31 })] : null;
    this.cam.x = Math.max(0, Math.min(m.w - SW, p.x - SW / 2));
    this.cam.y = Math.max(0, Math.min(m.h - SH, p.y - SH * 0.62));
    this.fade = 1;
    this.hooks.mapChanged(m);
    if (this.live) this.save();
  }

  spawnMob(sp, first) {
    const d = MOBS[sp.type], spr = this.S.mobs[sp.type], sc = d.scale || 1;
    const x = (sp.x0 + this.rng.next() * (sp.x1 - sp.x0 + 1)) * T;
    const y = sp.row * T;
    const m = { type: sp.type, d, spr, sp, sc, x, y, baseY: y, vx: 0, vy: 0, face: this.rng.next() < 0.5 ? 1 : -1, hp: d.hp, t: this.rng.next() * 5, wait: 0, aggro: 0, flash: 0, stun: 0, bald: 0, kb: 0, cool: 1 + this.rng.next() * 2, appear: first ? 0 : 0.5, boss: !!sp.boss, phase: 0, act: 'idle', at: 0 };
    if (m.boss) {
      this.boss = m;
      m.cool = 3;
    }
    this.mobs.push(m);
    if (!first) this.addFx(fxPoof, { x, y: y - 2, palette: PAL.smoke });
    return m;
  }

  mobBox(m) {
    const c = m.spr.core, s = m.sc;
    return { x0: m.x + c.x0 * s, x1: m.x + c.x1 * s, y0: m.y + c.y0 * s, y1: m.y + Math.min(0, c.y1) * s + (c.y1 > 0 ? 0 : 0) };
  }

  // ---------- 효과 ----------
  addFx(mod, o, life) {
    for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k]; // undefined가 기본값을 덮지 않게
    const f = createFx(mod, o);
    f.life = life;
    this.fx.push(f);
    return f;
  }

  num(x, y, v, kind = 'hit') {
    this.nums.push({ x: x + (this.rng.next() - 0.5) * 8, y, v: String(v), kind, t: 0 });
  }

  after(t, fn) {
    this.timers.push({ t, fn });
  }

  // ---------- 입력 ----------
  key(name, down) {
    if (down && !this.keys[name]) this.pressed[name] = true;
    this.keys[name] = down;
  }

  // ---------- 전투 계산 ----------
  hitMob(m, mult, o = {}) {
    if (m.hp <= 0 || m.appear > 0) return false;
    const p = this.p;
    let dmg = atkOf(p) * mult * (0.88 + this.rng.next() * 0.24);
    const crit = this.rng.next() < 0.15;
    if (crit) dmg *= 1.6;
    if (m.bald > 0) dmg *= 1.3;
    dmg = Math.max(1, Math.round(dmg));
    m.hp -= dmg;
    m.flash = 0.12;
    m.aggro = 8;
    const b = this.mobBox(m), cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    this.num(cx, b.y0 - 6 - (o.stack || 0) * 9, dmg, crit ? 'crit' : 'hit');
    if (o.kb && !m.boss) {
      m.kb = 0.22;
      m.vx = o.kb * (m.x >= p.x ? 1 : -1);
      if (o.up && m.d.kind === 'walk') m.vy = -o.up;
    }
    if (o.stun) m.stun = Math.max(m.stun, m.boss ? o.stun * 0.35 : o.stun);
    if (o.bald) {
      if (m.bald <= 0) this.shedHair(m, 10);
      m.bald = 6;
    }
    if (o.spark !== false) this.addFx(crit ? fxCrit : o.blunt ? fxBlunt : fxSpark, { x: cx - (crit ? 0 : 0), y: cy + (crit ? 26 : 20), flip: m.x < p.x, seed: (this.time * 1000) | 0, light: 0.7 });
    this.hooks.sfx(crit ? 'crit' : 'hit');
    if (m.hp <= 0) this.killMob(m);
    return true;
  }

  shedHair(m, n) {
    const b = this.mobBox(m), col = C(m.d.hair || '#8a5a2c');
    for (let i = 0; i < n; i++) this.hairs.push({ x: b.x0 + this.rng.next() * (b.x1 - b.x0), y: b.y0 + this.rng.next() * 6, vx: (this.rng.next() - 0.5) * 60, vy: -30 - this.rng.next() * 50, t: 0, life: 0.9 + this.rng.next() * 0.6, c: col, w: this.rng.next() * 6 });
  }

  killMob(m) {
    const p = this.p, d = m.d, b = this.mobBox(m), cx = (b.x0 + b.x1) / 2;
    m.dead = true;
    this.addFx(m.boss ? fxBigBoom : fxPoof, { x: cx, y: m.boss ? m.y : b.y1, seed: (this.time * 77) | 0 });
    this.hooks.sfx(m.boss ? 'boom' : 'pop');
    this.gainExp(d.exp);
    p.kills[m.type] = (p.kills[m.type] || 0) + 1;
    // 드롭
    const gold = Math.round(d.gold[0] + this.rng.next() * (d.gold[1] - d.gold[0]));
    const coins = m.boss ? 14 : 1 + (this.rng.next() < 0.4 ? 1 : 0);
    for (let i = 0; i < coins; i++) this.drop('gold', cx, b.y1 - 6, Math.ceil(gold / coins));
    if (!m.boss) {
      if (this.rng.next() < 0.45) this.drop('hair', cx, b.y1 - 6, 1);
      if (this.rng.next() < 0.1) this.drop('hp', cx, b.y1 - 6, 1);
      else if (this.rng.next() < 0.07) this.drop('mp', cx, b.y1 - 6, 1);
    }
    if (m.boss) {
      this.shake = 1.2;
      this.boss = null;
      p.kills.boss = 1;
      p.won = true;
      for (const o of this.mobs) if (o !== m && !o.dead) { o.hp = 0; o.dead = true; this.addFx(fxPoof, { x: o.x, y: o.y }); }
      this.after(3.2, () => this.hooks.toast('털보 대왕을 물리쳤어요! 촌장에게 돌아가세요.'));
    } else if (m.sp && !m.minion) this.after(7 + this.rng.next() * 4, () => this.map === loadMap(p.map) && this.spawnMob(m.sp));
    this.questCheck();
  }

  drop(kind, x, y, v) {
    this.drops.push({ kind, x, y, vx: (this.rng.next() - 0.5) * 90, vy: -150 - this.rng.next() * 70, v, t: 0, ground: false });
  }

  gainExp(n) {
    const p = this.p;
    p.exp += n;
    let up = false;
    while (p.exp >= expNeed(p.lv) && p.lv < 30) {
      p.exp -= expNeed(p.lv);
      p.lv += 1;
      p.sp += 1;
      up = true;
      for (const k of SKILL_ORDER) if (p.lv >= SKILLS[k].unlock && p.skills[k] === 0) {
        p.skills[k] = 1;
        this.after(1.4, () => this.hooks.toast(`새 스킬! ${SKILLS[k].name} (${SKILLS[k].key})`));
      }
    }
    if (up) {
      p.hp = maxHp(p);
      p.mp = maxMp(p);
      this.addFx(fxLevel, { x: p.x, y: p.y, text: 'LEVEL UP!' });
      this.hooks.sfx('level');
      this.hooks.toast(`레벨 ${p.lv}! 스킬 포인트 +1`);
      this.save();
    }
  }

  hurt(dmg, fromX) {
    const p = this.p;
    if (p.inv > 0 || p.dead || this.map.safe) return;
    dmg = Math.max(1, Math.round(dmg * (0.85 + this.rng.next() * 0.3)));
    p.hp -= dmg;
    p.inv = 1.3;
    this.num(p.x, p.y - 44, dmg, 'me');
    this.hooks.sfx('hurt');
    this.shake = Math.max(this.shake, 0.25);
    if (!['slamUp', 'slamDown', 'quake'].includes(p.state)) {
      p.state = 'hurt';
      p.st = 0;
      p.ladder = false;
      p.vx = (p.x >= fromX ? 1 : -1) * 110;
      p.vy = -170;
      p.ground = false;
    }
    if (p.hp <= 0) {
      p.hp = 0;
      p.dead = true;
      p.state = 'dead';
      p.st = 0;
      this.hooks.sfx('dead');
      this.after(2.6, () => {
        p.dead = false;
        p.exp = Math.floor(p.exp * 0.9);
        p.hp = Math.ceil(maxHp(p) * 0.6);
        p.mp = Math.ceil(maxMp(p) * 0.6);
        this.enter('village');
        this.hooks.toast('쓰러졌어요… 마을에서 다시 일어났어요. (경험치 10% 감소)');
      });
    }
  }

  // ---------- 퀘스트 ----------
  questProgress() {
    const p = this.p, q = QUESTS[p.quest];
    if (!q || p.qstate !== 'active') return null;
    const parts = [];
    let done = true;
    for (const [k, n] of Object.entries(q.need.kill || {})) {
      const have = Math.min(n, (p.kills[k] || 0) - ((p.qbase && p.qbase[k]) || 0));
      parts.push(`${MOBS[k].name} ${have}/${n}`);
      if (have < n) done = false;
    }
    for (const [, n] of Object.entries(q.need.item || {})) {
      parts.push(`털 뭉치 ${Math.min(n, p.hair)}/${n}`);
      if (p.hair < n) done = false;
    }
    if (q.need.boss) {
      parts.push(`털보 대왕 ${p.kills.boss ? 1 : 0}/1`);
      if (!p.kills.boss) done = false;
    }
    return { q, parts, done };
  }

  questCheck() {
    const pr = this.questProgress();
    if (pr && pr.done && !this.p.qtold) {
      this.p.qtold = true;
      this.hooks.toast(`퀘스트 달성! 민둥 촌장에게 돌아가세요.`);
      this.hooks.sfx('quest');
    }
    this.hooks.ui();
  }

  talk(npc) {
    const p = this.p, h = this.hooks;
    if (npc.id === 'shop') return h.shop();
    if (npc.id === 'guide') return h.dialog(npc.name, [...h.TALK.guide]);
    const q = QUESTS[p.quest];
    if (!q) return h.dialog(npc.name, h.TALK.elderIdle, () => p.won && h.ending());
    if (p.qstate === 'new') {
      return h.dialog(npc.name, [...q.intro, `[퀘스트] ${q.title}: ${q.text}`], () => {
        p.qstate = 'active';
        p.qbase = { ...p.kills };
        delete p.qbase.boss;
        p.qtold = false;
        h.sfx('quest');
        this.questCheck();
        this.save();
      });
    }
    const pr = this.questProgress();
    if (pr && !pr.done) return h.dialog(npc.name, [`아직이네. ${pr.parts.join(', ')}`, `${q.where}(으)로 가 보게.`]);
    const r = q.reward;
    return h.dialog(npc.name, [...q.done, `[보상] 경험치 ${r.exp}, ${r.gold}골드${r.hp ? `, 빨간 물약 ${r.hp}` : ''}${r.mp ? `, 파란 물약 ${r.mp}` : ''}`], () => {
      for (const [, n] of Object.entries(q.need.item || {})) p.hair -= n;
      p.gold += r.gold;
      p.pots.hp += r.hp || 0;
      p.pots.mp += r.mp || 0;
      p.quest += 1;
      p.qstate = 'new';
      this.gainExp(r.exp);
      h.sfx('quest');
      h.ui();
      this.save();
      if (!QUESTS[p.quest]) h.ending();
    });
  }

  // ---------- 주인공 ----------
  canAct() {
    const s = this.p.state;
    return !this.p.dead && (s === 'idle' || s === 'walk' || s === 'jump' || s === 'fall');
  }

  useSkill(id) {
    const p = this.p, sk = SKILLS[id], lv = p.skills[id];
    if (this.map.safe && id !== 'beam') return this.hooks.toast('마을에서는 쓸 수 없어요');
    if (!lv) return this.hooks.toast(`${sk.name}: 레벨 ${sk.unlock}에 배워요`);
    if (!this.canAct() || p.ladder) return null;
    if (p.cd[id] > 0) return null;
    if (p.mp < sk.mp) {
      this.hooks.toast('MP가 부족해요');
      return null;
    }
    p.mp -= sk.mp;
    p.cd[id] = sk.cd;
    p.st = 0;
    p.fired = false;
    const mult = sk.mult + sk.per * (lv - 1);
    if (id === 'beam') {
      p.state = 'beam';
      p.mult = mult;
      p.vx = 0;
    } else if (id === 'slam') {
      p.state = 'slamUp';
      p.mult = mult;
      p.vy = p.ground ? -400 : -220;
      p.vx = p.face * 60;
      p.ground = false;
      this.hooks.sfx('jump');
    } else if (id === 'quake') {
      p.state = 'quake';
      p.mult = mult;
      p.vx = 0;
      this.addFx(fxImplode, { x: p.x, y: p.y - 20, palette: GOLD.slice(0, 7), light: 0.8 });
      this.hooks.sfx('charge');
    } else if (id === 'air') {
      p.state = 'call';
      p.mult = mult;
      p.vx = 0;
      this.addFx(fxFlare, { x: p.x + p.face * 6, y: p.y - 40, height: 120, light: 0.8 }, 3);
      this.hooks.sfx('flare');
      const dir = p.face, cx = this.cam.x;
      this.after(0.9, () => this.airstrike(mult, dir, cx));
    }
    return true;
  }

  airstrike(mult, dir, camX) {
    this.hooks.sfx('jet');
    this.hooks.toast('공군 폭격!');
    const n = 9, pad = 30;
    for (let j = 0; j < 3; j++) this.jets.push({ x: dir > 0 ? camX - 60 - j * 46 : camX + SW + 60 + j * 46, y: this.cam.y + 16 + j * 13, dir, t: 0 });
    for (let i = 0; i < n; i++) {
      const tx = camX + pad + ((SW - pad * 2) * (dir > 0 ? i : n - 1 - i)) / (n - 1) + (this.rng.next() - 0.5) * 14;
      this.after(0.25 + i * 0.13, () => this.bombs.push({ x: tx, y: this.cam.y + 30, vy: 60, mult }));
    }
  }

  groundBelow(x, y) {
    // (x, y) 아래 첫 땅/발판의 윗면
    for (let ty = Math.floor(y / T); ty < this.map.g.h; ty++) {
      const k = tileAt(this.map, Math.floor(x / T), ty);
      if (k === 1 || ((k === 2 || k === 4) && ty * T >= y)) return ty * T;
    }
    return this.map.h;
  }

  updatePlayer(dt) {
    const p = this.p, K = this.keys, P = this.pressed, m = this.map;
    p.st += dt;
    p.anim += dt;
    p.inv = Math.max(0, p.inv - dt);
    p.potCd = Math.max(0, p.potCd - dt);
    p.dropT = Math.max(0, p.dropT - dt);
    for (const k of Object.keys(p.cd)) p.cd[k] = Math.max(0, p.cd[k] - dt);
    p.mp = Math.min(maxMp(p), p.mp + (1.4 + p.lv * 0.12) * dt * (m.safe ? 4 : 1));
    if (m.safe && !p.dead) p.hp = Math.min(maxHp(p), p.hp + maxHp(p) * 0.08 * dt);

    const free = this.canAct();
    let ax = 0;
    if (free && !p.dead) ax = (K.right ? 1 : 0) - (K.left ? 1 : 0);

    // 물약
    if (!p.dead) {
      for (const kind of ['hp', 'mp']) {
        if (!P[kind]) continue;
        const full = kind === 'hp' ? p.hp >= maxHp(p) : p.mp >= maxMp(p);
        if (p.pots[kind] <= 0) this.hooks.toast(kind === 'hp' ? '빨간 물약이 없어요' : '파란 물약이 없어요');
        else if (!full && p.potCd <= 0) {
          p.pots[kind] -= 1;
          p.potCd = 0.6;
          if (kind === 'hp') p.hp = Math.min(maxHp(p), p.hp + maxHp(p) * 0.4);
          else p.mp = Math.min(maxMp(p), p.mp + maxMp(p) * 0.5);
          this.addFx(fxHeal, { x: p.x, y: p.y, palette: kind === 'hp' ? undefined : PAL.ice, light: 0.6 });
          this.hooks.sfx('potion');
        }
      }
    }

    // 사다리
    if (p.ladder) {
      p.vx = 0;
      p.vy = ((K.down ? 1 : 0) - (K.up ? 1 : 0)) * 70;
      p.y += p.vy * dt;
      if (p.vy) p.anim += dt;
      const onL = isLadder(m, p.x, p.y - 2) || isLadder(m, p.x, p.y - 20);
      if (P.jump) {
        p.ladder = false;
        p.vy = -180;
        p.vx = ax * 80;
        this.hooks.sfx('jump');
      } else if (!onL) {
        p.ladder = false;
        if (p.vy < 0) {
          p.y = Math.floor(p.y / T) * T;
          p.vy = 0;
        }
      } else if (p.vy > 0 && isSolid(m, p.x, p.y + 1)) {
        p.ladder = false;
        p.y = Math.floor((p.y + 1) / T) * T;
      }
      p.state = 'ladder';
      return;
    }
    if (p.state === 'ladder') p.state = 'fall';

    if (free) {
      if (K.up && (isLadder(m, p.x, p.y - 8) || isLadder(m, p.x, p.y - 24))) {
        p.ladder = true;
        p.x = Math.floor(p.x / T) * T + 8;
        p.vx = p.vy = 0;
        return;
      }
      if (K.down && p.ground && isLadder(m, p.x, p.y + 4)) {
        p.ladder = true;
        p.x = Math.floor(p.x / T) * T + 8;
        p.y += 6;
        p.ground = false;
        return;
      }
      if (ax) p.face = ax;
      p.vx = ax * 96;
      if (P.jump && p.ground) {
        if (K.down && isPlat(m, p.x, p.y + 1) && !isSolid(m, p.x, p.y + 1)) p.dropT = 0.22;
        else {
          p.vy = -318;
          this.hooks.sfx('jump');
        }
        p.ground = false;
      }
      if (P.attack && p.cd.punch <= 0) {
        p.state = 'punch';
        p.st = 0;
        p.fired = false;
        p.cd.punch = 0.38;
        if (p.ground) p.vx *= 0.3;
      }
      for (const [k, id] of [['s1', 'beam'], ['s2', 'slam'], ['s3', 'quake'], ['s4', 'air']]) if (P[k]) this.useSkill(id);
      if (P.up) this.interact();
    }

    // 상태별 동작
    const s = p.state;
    if (s === 'punch') {
      if (!p.fired && p.st > 0.09) {
        p.fired = true;
        this.hooks.sfx('swing');
        let n = 0;
        for (const mob of this.mobs) {
          const b = this.mobBox(mob), front = p.face > 0 ? b.x1 > p.x - 4 && b.x0 < p.x + 34 : b.x0 < p.x + 4 && b.x1 > p.x - 34;
          if (front && b.y1 > p.y - 44 && b.y0 < p.y + 4 && n < 3 && this.hitMob(mob, 1, { kb: 70, blunt: true })) n++;
        }
        if (n) this.stop = 0.04;
      }
      if (p.ground) p.vx *= 0.8;
      if (p.st > 0.3) p.state = 'idle';
    } else if (s === 'beam') {
      p.vx = 0;
      if (!p.fired && p.st > 0.14) {
        p.fired = true;
        this.hooks.sfx('beam');
        const hd = this.headAt || [p.x + p.face * 10, p.y - 28];
        const f = this.addFx(fxBeam, { x: hd[0] - p.face * 11, y: hd[1] + 27, flip: p.face < 0, palette: GOLD, light: 0.9 }, 0.42);
        f.beam = true;
        let n = 0;
        const list = this.mobs.filter((mob) => !mob.dead).sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x));
        for (const mob of list) {
          const b = this.mobBox(mob), front = p.face > 0 ? b.x1 > p.x && b.x0 < p.x + 185 : b.x0 < p.x && b.x1 > p.x - 185;
          if (front && b.y1 > p.y - 46 && b.y0 < p.y - 6 && n < 8 && this.hitMob(mob, p.mult, { bald: true, kb: 30, stack: 0 })) n++;
        }
        if (n) this.stop = 0.05;
      }
      if (p.st > 0.55) p.state = 'idle';
    } else if (s === 'slamUp') {
      if (p.vy > -40 || p.st > 0.5) {
        p.state = 'slamDown';
        p.vy = 560;
        p.vx = 0;
      }
    } else if (s === 'slamDown') {
      p.vy = 560;
      p.vx = 0;
    } else if (s === 'slamLand') {
      p.vx = 0;
      if (p.st > 0.45) p.state = 'idle';
    } else if (s === 'quake') {
      p.vx = 0;
      this.shake = Math.max(this.shake, 0.08 + p.st * 0.2);
      if (!p.fired && p.st > 0.7) {
        p.fired = true;
        this.addFx(fxPlasma, { x: p.x, y: p.y - 22, palette: GOLD.slice(0, 7), accent: ['#ffffff', '#fff6c2', '#ffd23f', '#ff8a2a', '#c8421a'] });
        this.addFx(fxQuake, { x: p.x, y: p.y, light: 0.7 });
        this.hooks.sfx('boom');
        this.shake = 0.7;
        this.stop = 0.08;
        const hit = (stack) => {
          for (const mob of this.mobs) {
            const b = this.mobBox(mob), cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
            if (Math.abs(cx - p.x) < 118 + (b.x1 - b.x0) / 2 && Math.abs(cy - (p.y - 20)) < 84) this.hitMob(mob, p.mult, { stun: 3, kb: 90, up: 120, stack, spark: stack === 0 });
          }
        };
        hit(0);
        this.after(0.22, () => hit(1));
      }
      if (p.st > 1.15) p.state = 'idle';
    } else if (s === 'call') {
      p.vx = 0;
      if (p.st > 0.75) p.state = 'idle';
    } else if (s === 'hurt') {
      if (p.st > 0.35 && p.ground) p.state = 'idle';
    } else if (s === 'dead') {
      p.vx = 0;
    }

    // 중력과 충돌
    p.vy = Math.min(600, p.vy + GRAV * dt);
    const hw = 6, hh = 34;
    let nx = p.x + p.vx * dt;
    nx = Math.max(hw + 1, Math.min(m.w - hw - 1, nx));
    const side = p.vx > 0 ? hw : -hw;
    if (p.vx && (isSolid(m, nx + side, p.y - 2) || isSolid(m, nx + side, p.y - 17) || isSolid(m, nx + side, p.y - hh + 2))) {
      nx = p.vx > 0 ? Math.floor((nx + side) / T) * T - hw - 0.01 : Math.floor((nx + side) / T) * T + T + hw + 0.01;
      p.vx = 0;
    }
    p.x = nx;
    const oy = p.y;
    let ny = p.y + p.vy * dt;
    const was = p.ground;
    p.ground = false;
    if (p.vy >= 0) {
      const solid = isSolid(m, p.x - hw + 1, ny) || isSolid(m, p.x + hw - 1, ny);
      const top = Math.floor(ny / T) * T;
      const plat = !solid && p.dropT <= 0 && s !== 'slamDown2' && (isPlat(m, p.x - hw + 1, ny) || isPlat(m, p.x + hw - 1, ny)) && oy <= top + 0.5;
      if (solid || plat) {
        ny = top;
        p.vy = 0;
        p.ground = true;
      }
    } else if (isSolid(m, p.x - hw + 1, ny - hh) || isSolid(m, p.x + hw - 1, ny - hh)) {
      ny = Math.floor((ny - hh) / T) * T + T + hh;
      p.vy = 0;
    }
    p.y = ny;
    if (p.y > m.h + 40) {
      p.y = m.start[1] * T;
      p.x = m.start[0] * T + 8;
    }
    if (p.ground && !was && (s === 'slamDown' || s === 'slamUp')) this.slamLand();
    else if (p.ground && !was && oy !== ny && p.vy === 0 && s !== 'slamLand') this.hooks.sfx('land');

    if (this.canAct()) p.state = !p.ground ? (p.vy < 0 ? 'jump' : 'fall') : Math.abs(p.vx) > 5 ? 'walk' : 'idle';

    // 드롭 줍기(닿으면 자동)
    for (const d of this.drops) {
      if (d.t < 0.35 || d.got) continue;
      if (Math.abs(d.x - p.x) < 16 && d.y > p.y - 40 && d.y < p.y + 6) {
        d.got = true;
        if (d.kind === 'gold') { p.gold += d.v; this.num(d.x, d.y - 12, `+${d.v}`, 'gold'); }
        else if (d.kind === 'hair') p.hair += 1;
        else p.pots[d.kind] += 1;
        this.addFx(fxCollect, { x: d.x, y: d.y - 4, light: 0.5, palette: d.kind === 'gold' ? undefined : d.kind === 'hp' ? PAL.blood : d.kind === 'mp' ? PAL.ice : PAL.earth });
        this.hooks.sfx('coin');
        this.questCheck();
      }
    }
  }

  slamLand() {
    const p = this.p;
    p.state = 'slamLand';
    p.st = 0;
    this.addFx(fxSlam, { x: p.x, y: p.y, reach: 104 });
    this.hooks.sfx('slam');
    this.shake = 0.8;
    this.stop = 0.1;
    this.num(p.x, p.y - 52, '3t!', 'big');
    for (const mob of this.mobs) {
      const b = this.mobBox(mob), cx = (b.x0 + b.x1) / 2;
      if (Math.abs(cx - p.x) < 108 + (b.x1 - b.x0) / 2 && b.y1 > p.y - 60 && b.y0 < p.y + 26) this.hitMob(mob, p.mult, { kb: 150, up: 230, blunt: true, stun: 0.6 });
    }
  }

  interact() {
    const p = this.p, m = this.map;
    for (const n of m.npcs || []) if (Math.abs(n.x * T + 8 - p.x) < 22 && Math.abs(n.y * T - p.y) < 20) return this.talk(n);
    for (const po of m.portals) {
      if (Math.abs(po.x * T + 8 - p.x) < 18 && Math.abs(po.y * T - p.y) < 20) {
        if (po.boss && this.p.quest < 5) return this.hooks.toast('아직 들어갈 수 없어요. 촌장의 퀘스트를 진행하세요.');
        this.hooks.sfx('portal');
        this.fade = -1;
        this.fadeTo = () => this.enter(po.to, po.tx, po.ty);
        return null;
      }
    }
    return null;
  }

  // ---------- 몹 ----------
  updateMob(m, dt) {
    const p = this.p, d = m.d;
    m.t += dt;
    m.flash = Math.max(0, m.flash - dt);
    m.bald = Math.max(0, m.bald - dt);
    m.appear = Math.max(0, m.appear - dt);
    m.cool -= dt;
    if (m.aggro > 0) m.aggro -= dt;
    if (m.kb > 0) {
      m.kb -= dt;
      m.x += m.vx * dt;
    }
    if (d.kind === 'walk' || m.boss) {
      if (m.vy || m.y < m.baseY) {
        m.vy += GRAV * dt;
        m.y += m.vy * dt;
        if (m.y >= m.baseY) { m.y = m.baseY; m.vy = 0; if (m.landed) m.landed(); }
      }
    }
    const lo = m.sp.x0 * T + 6, hi = (m.sp.x1 + 1) * T - 6;
    if (m.stun > 0) {
      m.stun -= dt;
      m.x = Math.max(lo, Math.min(hi, m.x));
      return;
    }
    const dx = p.x - m.x, dy = p.y - 16 - (m.y + m.spr.core.y0 * m.sc / 2), near = Math.abs(dx) < 110 && Math.abs(dy) < 60 && !p.dead && !this.map.safe;
    if (near) m.aggro = Math.max(m.aggro, 2);
    if (m.boss) this.updateBoss(m, dt, dx);
    else if (d.kind === 'walk') {
      if (m.aggro > 0 && Math.abs(dx) > 10) m.face = dx > 0 ? 1 : -1;
      else if (m.aggro <= 0) {
        m.wait -= dt;
        if (m.wait < -2 - (m.t % 1.7)) { m.wait = 0.6 + this.rng.next() * 1.6; m.face = this.rng.next() < 0.5 ? 1 : -1; }
      }
      const moving = m.aggro > 0 ? Math.abs(dx) > 10 : m.wait <= 0;
      if (moving && m.kb <= 0) m.x += m.face * d.speed * (m.aggro > 0 ? 1.35 : 1) * dt;
      if (m.x < lo) { m.x = lo; m.face = 1; }
      if (m.x > hi) { m.x = hi; m.face = -1; }
    } else {
      // 날아다니는 몹: 떠서 맴돌다가 쫓아온다
      const home = m.baseY, tyv = m.aggro > 0 ? Math.max(home - 60, Math.min(home + 40, p.y - m.spr.core.y1 + (m.spr.core.y1 - m.spr.core.y0) / 2 + 10)) : home;
      if (m.aggro > 0) {
        if (Math.abs(dx) > 8) m.face = dx > 0 ? 1 : -1;
        const keep = d.shoot ? 90 : 0;
        if (Math.abs(dx) > keep + 8) m.x += m.face * d.speed * dt;
        else if (d.shoot && Math.abs(dx) < keep - 20) m.x -= m.face * d.speed * 0.6 * dt;
        if (d.shoot && m.cool <= 0 && Math.abs(dx) < 220) {
          m.cool = 2.6;
          const b = this.mobBox(m), sx = (b.x0 + b.x1) / 2, sy = (b.y0 + b.y1) / 2, a = Math.atan2(p.y - 18 - sy, p.x - sx);
          this.shots.push({ x: sx, y: sy, vx: Math.cos(a) * 130, vy: Math.sin(a) * 130, t: 0, atk: d.atk });
          this.hooks.sfx('shot');
        }
      } else {
        m.wait -= dt;
        if (m.wait < 0) { m.wait = 1.5 + this.rng.next() * 2; m.face = this.rng.next() < 0.5 ? 1 : -1; }
        m.x += m.face * d.speed * 0.4 * dt;
      }
      m.y += (tyv - m.y) * Math.min(1, dt * 1.6);
      const lo2 = lo - 40, hi2 = hi + 40;
      if (m.x < lo2) { m.x = lo2; m.face = 1; }
      if (m.x > hi2) { m.x = hi2; m.face = -1; }
    }
    // 몸통 박치기
    if (!p.dead && p.inv <= 0 && m.appear <= 0) {
      const b = this.mobBox(m);
      if (p.x + 5 > b.x0 && p.x - 5 < b.x1 && p.y > b.y0 + 2 && p.y - 32 < b.y1) this.hurt(d.atk, m.x);
    }
  }

  updateBoss(m, dt, dx) {
    const p = this.p, d = m.d, lo = 3 * T, hi = this.map.w - 3 * T;
    m.at += dt;
    const ratio = m.hp / d.hp;
    if (ratio < 0.5 && m.phase < 1) {
      m.phase = 1;
      m.spr = this.S.kingBald;
      this.shedHair(m, 60);
      this.hooks.toast('털보 대왕의 털이 다 빠졌어요! 화가 났어요!');
      this.shake = 0.6;
      this.summon(m, 3);
    }
    if (m.act === 'idle') {
      if (Math.abs(dx) > 30) m.face = dx > 0 ? 1 : -1;
      if (m.y >= m.baseY) m.x += m.face * d.speed * (m.phase ? 1.5 : 1) * dt;
      if (m.cool <= 0 && !p.dead) {
        const r = this.rng.next();
        if (r < 0.45) {
          // 뛰어올라 덮치기
          m.act = 'leap';
          m.at = 0;
          m.vy = -470;
          m.y -= 1;
          m.tx = Math.max(lo, Math.min(hi, p.x));
          m.sx = m.x;
          m.landed = () => {
            m.landed = null;
            m.act = 'idle';
            m.cool = m.phase ? 2 : 3;
            this.addFx(fxSlam, { x: m.x, y: m.y, reach: 110, palette: PAL.arcane });
            this.shake = 0.7;
            this.hooks.sfx('slam');
            if (p.ground && Math.abs(p.x - m.x) < 120) this.hurt(d.atk * 1.2, m.x);
          };
          this.hooks.sfx('jump');
        } else if (r < 0.8) {
          // 털 가시가 바닥을 따라 솟는다
          m.act = 'thorn';
          m.at = 0;
          const dir = m.face, x0 = m.x + dir * 40, y0 = m.y;
          this.addFx(fxThorns, { x: x0, y: y0, flip: dir < 0, palette: PAL.arcane, count: 7 });
          this.hooks.sfx('charge');
          this.after(0.45, () => {
            if (p.ground && Math.abs(p.y - y0) < 20 && (dir > 0 ? p.x > x0 - 10 && p.x < x0 + 180 : p.x < x0 + 10 && p.x > x0 - 180)) this.hurt(d.atk, x0);
          });
          this.after(0.9, () => { m.act = 'idle'; m.cool = m.phase ? 1.8 : 2.8; });
        } else {
          this.summon(m, m.phase ? 3 : 2);
          m.cool = 3.5;
        }
      }
    } else if (m.act === 'leap') {
      const u = Math.min(1, m.at / 1.0);
      m.x = m.sx + (m.tx - m.sx) * u;
    }
    m.x = Math.max(lo, Math.min(hi, m.x));
  }

  summon(boss, n) {
    const alive = this.mobs.filter((o) => o.minion && !o.dead).length;
    for (let i = 0; i < n && alive + i < 5; i++) {
      const tx = 5 + Math.floor(this.rng.next() * 32);
      this.addFx(fxSpawn, { x: tx * T, y: boss.baseY, light: 0.7 });
      this.after(1.1, () => {
        if (!this.boss) return;
        const mm = this.spawnMob({ type: this.rng.next() < 0.5 ? 'mint' : 'frog', x0: tx, x1: tx, row: boss.baseY / T, n: 1 }, true);
        mm.sp = { ...mm.sp, x0: 3, x1: 40 };
        mm.minion = true;
        mm.aggro = 99;
      });
    }
    this.hooks.sfx('portal');
  }

  // ---------- 한 틱 ----------
  update(dt) {
    if (this.paused) {
      this.pressed = {};
      if (this.fade > 0) this.fade = Math.max(0, this.fade - dt * 3);
      return;
    }
    // 화면 전환
    if (this.fade < 0) {
      this.fade = Math.max(-2, this.fade - dt * 4);
      if (this.fade <= -2) { const f = this.fadeTo; this.fadeTo = null; f && f(); }
      this.pressed = {};
      return;
    }
    if (this.fade > 0) this.fade = Math.max(0, this.fade - dt * 3);
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 2.2);
    if (this.stop > 0) {
      this.stop -= dt;
      this.pressed = {};
      return;
    }
    for (const t of this.timers) t.t -= dt;
    const due = this.timers.filter((t) => t.t <= 0);
    this.timers = this.timers.filter((t) => t.t > 0);
    for (const t of due) t.fn();

    this.updatePlayer(dt);
    for (const m of this.mobs) if (!m.dead) this.updateMob(m, dt);
    this.mobs = this.mobs.filter((m) => !m.dead);

    for (const f of this.fx) {
      f.update(dt);
      if (f.life !== undefined) { f.life -= dt; if (f.life <= 0) f.stop(); }
    }
    this.fx = this.fx.filter((f) => !f.done());
    if (this.weather) for (const w of this.weather) w.update(dt);

    for (const d of this.drops) {
      d.t += dt;
      if (!d.ground) {
        d.vy += GRAV * dt;
        d.x += d.vx * dt;
        const ny = d.y + d.vy * dt, g = this.groundBelow(d.x, d.y - 4);
        if (d.vy > 0 && ny >= g) { d.y = g; d.ground = true; } else d.y = ny;
        d.x = Math.max(20, Math.min(this.map.w - 20, d.x));
      }
    }
    this.drops = this.drops.filter((d) => !d.got && d.t < 40);
    for (const n of this.nums) n.t += dt;
    this.nums = this.nums.filter((n) => n.t < 0.9);
    for (const h of this.hairs) { h.t += dt; h.vy += 160 * dt; h.x += (h.vx + Math.sin(h.t * 9 + h.w) * 30) * dt; h.y += h.vy * dt; h.vx *= 0.97; }
    this.hairs = this.hairs.filter((h) => h.t < h.life);
    const p = this.p;
    for (const s of this.shots) {
      s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt;
      if (!p.dead && Math.abs(s.x - p.x) < 9 && s.y > p.y - 36 && s.y < p.y) { s.t = 99; this.hurt(s.atk, s.x - s.vx); this.addFx(fxZap, { x: s.x, y: s.y, light: 0.6 }); }
      if (isSolid(this.map, s.x, s.y)) s.t = 99;
    }
    this.shots = this.shots.filter((s) => s.t < 4);
    for (const j of this.jets) { j.t += dt; j.x += j.dir * 430 * dt; }
    this.jets = this.jets.filter((j) => j.t < 3);
    for (const b of this.bombs) {
      b.vy += 500 * dt;
      b.y += b.vy * dt;
      const g = this.groundBelow(b.x, this.cam.y + 40);
      if (b.y >= g - 2) {
        b.done = true;
        this.addFx(fxBoom, { x: b.x, y: g, seed: (b.x * 13) | 0, size: 0.8 }, 2.6);
        this.hooks.sfx('boom');
        this.shake = Math.max(this.shake, 0.6);
        for (const mob of this.mobs) {
          const bb = this.mobBox(mob), cx = (bb.x0 + bb.x1) / 2, cy = (bb.y0 + bb.y1) / 2;
          if (Math.abs(cx - b.x) < 52 + (bb.x1 - bb.x0) / 2 && cy > g - 150 && cy < g + 40) this.hitMob(mob, b.mult, { kb: 120, up: 160, spark: false });
        }
      }
    }
    this.bombs = this.bombs.filter((b) => !b.done);

    // 카메라
    const m = this.map, tx = Math.max(0, Math.min(m.w - SW, p.x + p.face * 24 - SW / 2)), ty = Math.max(0, Math.min(m.h - SH, p.y - SH * 0.62));
    this.cam.x += (tx - this.cam.x) * Math.min(1, dt * 5);
    this.cam.y += (ty - this.cam.y) * Math.min(1, dt * 4);
    this.pressed = {};
  }

  heroPose() {
    const p = this.p, t = p.anim;
    switch (p.state) {
      case 'walk': return POSE.walk(t);
      case 'jump': return POSE.jump();
      case 'fall': return POSE.fall(t);
      case 'ladder': return { ...POSE.jump(), yaw: Math.PI / 2, fx: -6, fy: -30 + Math.sin(p.y / 5) * 4, bx: 6, by: -30 - Math.sin(p.y / 5) * 4, ffy: -4 - Math.sin(p.y / 5) * 3, fby: -4 + Math.sin(p.y / 5) * 3, ffx: 3, fbx: -3 };
      case 'punch': return POSE.punch(p.st / 0.3);
      case 'beam': return POSE.beam(p.st / 0.55);
      case 'slamUp': return POSE.slamUp();
      case 'slamDown': return POSE.slamDown();
      case 'slamLand': return POSE.slamLand();
      case 'quake': return p.st < 0.7 ? POSE.quakeCharge(p.st) : POSE.quakeBurst();
      case 'call': return POSE.call(p.st / 0.75);
      case 'hurt': return POSE.hurt();
      case 'dead': return POSE.dead();
      default: return POSE.idle(t);
    }
  }

  // ---------- 그리기 ----------
  draw() {
    const f = this.frame, m = this.map, p = this.p, S = this.S, t = this.time;
    const sh = this.shake > 0 ? Math.round((Math.sin(t * 90) * 3 + Math.sin(t * 57) * 2) * Math.min(1, this.shake)) : 0;
    const camX = Math.round(this.cam.x) + (this.shake > 0 ? Math.round(Math.sin(t * 71) * 2 * Math.min(1, this.shake)) : 0), camY = Math.round(this.cam.y) + sh;
    composeBg(m, Math.max(0, Math.min(m.w - SW, camX)), camY, this.bg);
    clearFrame(f);
    f.ox = camX;
    f.oy = camY;
    // 뒤쪽 효과
    for (const e of this.fx) e.draw(f, 'back');
    // 장식
    for (const [tx, ty] of m.torches || []) blit(f, S.torch, t + tx, tx * T + 8, ty * T - 14, { light: 0.8 });
    for (const po of m.portals) blit(f, po.boss ? S.portalBoss : S.portal, t, po.x * T + 8, po.y * T, { light: 0.6 });
    for (const n of m.npcs || []) drawHero(f, n.x * T + 8, n.y * T, POSE.idle(t + n.x), p.x < n.x * T + 8 ? -1 : 1, { ramps: NPC_LOOK[n.id] });
    // 드롭
    for (const d of this.drops) {
      const bob = d.ground ? Math.round(Math.sin(t * 4 + d.x) * 1.5) : 0, blink = d.t > 32 && Math.floor(t * 8) % 2;
      if (blink) continue;
      if (d.kind === 'gold') stamp(f, COINS[Math.floor(t * 8 + d.x) & 3], d.x - 4, d.y - 9 + bob);
      else if (d.kind === 'hair') stamp(f, HAIR, d.x - 4, d.y - 7 + bob);
      else stamp(f, d.kind === 'hp' ? POT_HP : POT_MP, d.x - 4, d.y - 11 + bob);
      if (d.ground && d.kind !== 'hair') { const gp = painterFor(f); gp.place(0, 0); gp.glow(d.x, d.y - 5, 7, d.kind === 'gold' ? C('#ffd23f') : d.kind === 'hp' ? C('#ff4d6d') : C('#4d8aff'), 0.3); }
    }
    // 몹
    for (const mob of this.mobs) {
      const o = { flip: mob.face < 0, scale: mob.sc, light: 0.45 };
      if (mob.type === 'snake' || mob.type === 'frog') o.flip = mob.face < 0;
      if (mob.flash > 0) o.flash = true;
      else if (mob.bald > 0) o.tint = [C('#fff2c8'), 0.28];
      if (mob.appear > 0) o.dither = 1 - mob.appear * 2;
      blit(f, mob.spr, mob.stun > 0 ? 0.2 : mob.t, mob.x, mob.y, o);
      const b = this.mobBox(mob), cx = Math.round((b.x0 + b.x1) / 2);
      if (mob.stun > 0) blit(f, S.stun, t, cx, b.y0 + 34, {});
      if (mob.bald > 0) {
        // 반짝! 민머리 광택
        const tw = Math.floor(t * 6 + mob.x) % 4, gx = cx - 2, gy = Math.round(b.y0) + 2;
        const pp = painterFor(f);
        pp.place(0, 0);
        pp.px(gx, gy, 0xffffffff);
        if (tw < 2) { pp.px(gx - 1, gy, 0xffffffff); pp.px(gx + 1, gy, 0xffffffff); pp.px(gx, gy - 1, 0xffffffff); pp.px(gx, gy + 1, 0xffffffff); }
        if (tw === 0) { pp.px(gx - 2, gy, 0xffffffff); pp.px(gx + 2, gy, 0xffffffff); pp.px(gx, gy - 2, 0xffffffff); pp.px(gx, gy + 2, 0xffffffff); }
        pp.glow(gx, gy, 7, 0xffffffff, 0.35);
      }
      if (!mob.boss && mob.hp < mob.d.hp) {
        const w = 22, pp = painterFor(f);
        pp.place(0, 0);
        pp.rect(cx - w / 2 - 1, b.y0 - 6, w + 2, 4, C('#1b1226'));
        pp.rect(cx - w / 2, b.y0 - 5, Math.max(1, Math.round((w * mob.hp) / mob.d.hp)), 2, C('#ff4d6d'));
      }
    }
    // 적 탄환
    for (const s of this.shots) blit(f, S.laser, s.t, s.x, s.y, { flip: s.vx < 0, light: 0.8 });
    // 주인공
    const pose = this.heroPose(), blinkInv = p.inv > 0 && !p.dead && Math.floor(t * 16) % 2 === 0;
    if (!blinkInv) {
      const hx = p.x + (p.state === 'quake' && p.st < 0.7 ? Math.round(Math.sin(t * 80) * 1.5) : 0);
      const r = drawHero(f, hx, p.y, pose, p.face, { flash: p.inv > 1.2 });
      if (p.state === 'slamDown' || p.state === 'slamUp' || (p.state === 'slamLand' && p.st < 0.25)) stamp(f, WEIGHT, p.x - 11, p.y - 14 + (p.state === 'slamLand' ? 0 : -6));
      this.headAt = [p.x + p.face * r.headX, p.y + r.headY];
    }
    // 탈모빔 발사 중이면 정수리가 빛난다
    if (p.state === 'beam' && p.fired && this.headAt) {
      const pp = painterFor(f);
      pp.place(0, 0);
      pp.glow(this.headAt[0] + p.face * 3, this.headAt[1] + 2, 16, C('#ffe98a'), 0.9);
    }
    // 털 날리기
    {
      const pp = painterFor(f);
      pp.place(0, 0);
      for (const h of this.hairs) {
        const a = 1 - h.t / h.life;
        pp.dot(h.x, h.y, h.c, a + 0.3);
        pp.dot(h.x + (h.vx > 0 ? -1 : 1), h.y - 1, h.c, a);
      }
    }
    // 폭격기와 폭탄
    for (const j of this.jets) {
      stamp(f, JET, j.x - 15, j.y, j.dir < 0);
      const pp = painterFor(f);
      pp.place(0, 0);
      for (let i = 0; i < 26; i += 2) pp.dot(j.x - j.dir * (18 + i), j.y + 7 + Math.sin(i + t * 30), 0xffffffff, 0.8 - i / 30);
      pp.glow(j.x - j.dir * 17, j.y + 7, 6, C('#ffb04a'), 0.9);
    }
    for (const b of this.bombs) stamp(f, BOMB, b.x - 2, b.y - 10);
    // 앞쪽 효과
    for (const e of this.fx) e.draw(f, 'front');
    // 날씨(화면 고정)
    if (this.weather) {
      this.weather[0].options.x = camX + 160; this.weather[0].options.y = camY + 170;
      this.weather[1].options.x = camX + 160 + 224; this.weather[1].options.y = camY + 170 + 36;
      for (const w of this.weather) { w.options.light = 0.5; w.draw(f); }
    }
    // 숫자
    const pp = painterFor(f);
    pp.place(0, 0);
    for (const n of this.nums) {
      const u = n.t / 0.9, y = n.y - 18 * (1 - (1 - u) * (1 - u)) - (n.kind === 'big' ? 6 : 0);
      const col = n.kind === 'crit' ? C('#ffd23f') : n.kind === 'me' ? C('#b46bff') : n.kind === 'gold' ? C('#ffe98a') : n.kind === 'big' ? C('#ffffff') : C('#ff7a4a');
      const big = n.kind === 'crit' || n.kind === 'big';
      pp.text(n.v, n.x, y, col, { font: n.kind === 'gold' ? 'mini' : 'big', scale: big && u < 0.12 ? 2 : 1, align: 'center', outline: C('#1b1226'), a: u > 0.7 ? 1 - (u - 0.7) / 0.3 : 1 });
    }
    // 보스 이름표는 UI가 그린다
    composite(f, this.img.data, this.bg, m.th.cave || m.th.hall || m.th.ruins ? 1 : 0.5);
    // 화면 전환(픽셀 블록 디졸브)
    const fd = Math.abs(this.fade) > 1 ? 1 : Math.abs(this.fade);
    if (fd > 0) {
      const d = this.img.data;
      for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
        const cell = ((((x >> 3) * 7 + (y >> 3) * 13) % 16) + 0.5) / 16;
        if (cell < fd) { const i = (y * SW + x) * 4; d[i] = 14; d[i + 1] = 10; d[i + 2] = 24; }
      }
    }
    this.ctx.putImageData(this.img, 0, 0);
  }
}
