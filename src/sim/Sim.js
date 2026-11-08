// 게임 규칙 전부를 담은 순수 시뮬레이션. Phaser에 의존하지 않아서 노드에서 밸런스/테스트를 돌릴 수 있다.
// 렌더러(GameScene)는 이 상태를 읽어서 그리기만 하고, 효과음/이펙트는 sim.events를 소비해서 낸다.
import { MAP } from '../data/map.js';
import { TOWERS, PRIORITIES } from '../data/towers.js';
import { ENEMIES } from '../data/enemies.js';
import { WAVES } from '../data/waves.js';

export const STEP = 1 / 60;

export const DEFAULT_DATA = {
  map: MAP,
  towers: TOWERS,
  enemies: ENEMIES,
  waves: WAVES,
  cfg: { startAhn: 160, startLives: 20, sellRatio: 0.7 },
};

export class Sim {
  constructor(data = DEFAULT_DATA) {
    this.d = data;
    this.reset();
  }

  reset() {
    const { cfg, map } = this.d;
    this.ahn = cfg.startAhn;
    this.lives = cfg.startLives;
    this.wave = 0; // 지금까지 시작한 웨이브 수
    this.phase = 'prep'; // prep | wave | won | lost
    this.time = 0;
    this.waveTime = 0;
    this.acc = 0;
    this.enemies = [];
    this.towers = [];
    this.projectiles = [];
    this.queue = [];
    this.events = [];
    this.kills = 0;
    this.leaked = 0;
    this._id = 1;
    this.blocked = new Set([...map.pathCells, ...map.rocks]);
  }

  get totalWaves() {
    return this.d.waves.length;
  }

  emit(type, data = {}) {
    this.events.push({ type, ...data });
  }

  drainEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }

  // ---------- 플레이어 행동 ----------
  inGrid(c, r) {
    return c >= 0 && c < this.d.map.cols && r >= 0 && r < this.d.map.rows;
  }

  canBuild(c, r) {
    return this.inGrid(c, r) && !this.blocked.has(`${c},${r}`);
  }

  towerAt(c, r) {
    return this.towers.find((t) => t.c === c && t.r === r) || null;
  }

  build(typeId, c, r) {
    if (this.phase === 'won' || this.phase === 'lost') return null;
    const def = this.d.towers[typeId];
    if (!def || !this.canBuild(c, r) || this.ahn < def.cost) return null;
    const cell = this.d.map.cell;
    const t = {
      id: this._id++,
      type: typeId,
      c,
      r,
      x: (c + 0.5) * cell,
      y: (r + 0.5) * cell,
      level: 1,
      cd: 0.2,
      priority: 'first',
      spent: def.cost,
    };
    this.ahn -= def.cost;
    this.towers.push(t);
    this.blocked.add(`${c},${r}`);
    this.emit('build', { tower: t });
    return t;
  }

  stats(t) {
    return this.d.towers[t.type].levels[t.level - 1];
  }

  upgradeCost(t) {
    const def = this.d.towers[t.type];
    return t.level < def.levels.length ? def.upgrade[t.level - 1] : null;
  }

  upgrade(id) {
    const t = this.towers.find((x) => x.id === id);
    if (!t) return false;
    const cost = this.upgradeCost(t);
    if (cost == null || this.ahn < cost || this.phase === 'won' || this.phase === 'lost') return false;
    this.ahn -= cost;
    t.spent += cost;
    t.level += 1;
    this.emit('upgrade', { tower: t });
    return true;
  }

  sellValue(t) {
    return Math.floor(t.spent * this.d.cfg.sellRatio);
  }

  sell(id) {
    const i = this.towers.findIndex((x) => x.id === id);
    if (i < 0 || this.phase === 'won' || this.phase === 'lost') return false;
    const t = this.towers[i];
    this.ahn += this.sellValue(t);
    this.blocked.delete(`${t.c},${t.r}`);
    this.towers.splice(i, 1);
    this.emit('sell', { tower: t });
    return true;
  }

  cyclePriority(id) {
    const t = this.towers.find((x) => x.id === id);
    if (!t) return null;
    t.priority = PRIORITIES[(PRIORITIES.indexOf(t.priority) + 1) % PRIORITIES.length];
    return t.priority;
  }

  startWave() {
    if (this.phase !== 'prep' || this.wave >= this.d.waves.length) return false;
    const w = this.d.waves[this.wave];
    this.queue = [];
    for (const g of w.groups) {
      for (let i = 0; i < g.n; i++) this.queue.push({ t: g.at + i * g.gap, type: g.type });
    }
    this.queue.sort((a, b) => a.t - b.t);
    this.waveTime = 0;
    this.phase = 'wave';
    this.wave += 1;
    this.emit('waveStart', { wave: this.wave, boss: w.groups.some((g) => g.type === 'boss') });
    return true;
  }

  // ---------- 진행 ----------
  advance(seconds) {
    this.acc = Math.min(this.acc + seconds, 0.5);
    while (this.acc >= STEP) {
      this.update(STEP);
      this.acc -= STEP;
    }
  }

  update(dt) {
    if (this.phase === 'won' || this.phase === 'lost') return;
    this.time += dt;
    if (this.phase === 'wave') {
      this.waveTime += dt;
      this.spawnDue();
    }
    this.moveEnemies(dt);
    this.updateTowers(dt);
    this.updateProjectiles(dt);
    this.enemies = this.enemies.filter((e) => e.alive);
    this.projectiles = this.projectiles.filter((p) => p.alive);
    this.checkWaveEnd();
  }

  spawnDue() {
    const w = this.d.waves[this.wave - 1];
    while (this.queue.length && this.queue[0].t <= this.waveTime) {
      const q = this.queue.shift();
      const def = this.d.enemies[q.type];
      const hp = Math.round(def.hp * w.hpMul);
      const p = this.d.map.posAt(0);
      this.enemies.push({
        id: this._id++,
        type: q.type,
        hp,
        maxHp: hp,
        progress: 0,
        speed: def.speed,
        armor: def.armor || 0,
        reward: def.reward,
        leak: def.leak || 1,
        size: def.size,
        slow: 0,
        slowT: 0,
        flash: 0,
        x: p.x,
        y: p.y,
        dx: 1,
        alive: true,
      });
    }
  }

  moveEnemies(dt) {
    const map = this.d.map;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.slowT > 0) {
        e.slowT -= dt;
        if (e.slowT <= 0) e.slow = 0;
      }
      if (e.flash > 0) e.flash -= dt;
      e.progress += e.speed * (1 - e.slow) * dt;
      if (e.progress >= map.length) {
        e.alive = false;
        this.lives -= e.leak;
        this.leaked += 1;
        this.emit('leak', { x: e.x, y: e.y, amount: e.leak, type: e.type });
        if (this.lives <= 0) {
          this.lives = 0;
          this.phase = 'lost';
          this.emit('lose', { wave: this.wave });
          return;
        }
        continue;
      }
      const p = map.posAt(e.progress);
      e.x = p.x;
      e.y = p.y;
      if (p.dx !== 0) e.dx = p.dx;
    }
  }

  pickTarget(t, range) {
    let best = null;
    let bestScore = -Infinity;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dist = Math.hypot(e.x - t.x, e.y - t.y);
      if (dist > range + e.size * 0.3) continue;
      let score;
      switch (t.priority) {
        case 'last': score = -e.progress; break;
        case 'strong': score = e.hp; break;
        case 'close': score = -dist; break;
        default: score = e.progress; // first
      }
      if (score > bestScore) {
        bestScore = score;
        best = e;
      }
    }
    return best;
  }

  updateTowers(dt) {
    for (const t of this.towers) {
      t.cd = Math.max(0, t.cd - dt);
      if (t.cd > 0) continue;
      const st = this.stats(t);
      const target = this.pickTarget(t, st.range);
      if (!target) continue;
      t.cd = st.cd;
      const def = this.d.towers[t.type];
      const p = {
        id: this._id++,
        type: t.type,
        kind: def.proj.kind,
        x: t.x,
        y: t.y,
        speed: def.proj.speed,
        target,
        tx: target.x,
        ty: target.y,
        dmg: st.dmg,
        splash: st.splash || 0,
        slow: st.slow || 0,
        slowT: st.slowT || 0,
        alive: true,
      };
      this.projectiles.push(p);
      this.emit('fire', { tower: t, target, proj: p });
    }
  }

  updateProjectiles(dt) {
    for (const p of this.projectiles) {
      if (!p.alive) continue;
      if (p.target && p.target.alive) {
        p.tx = p.target.x;
        p.ty = p.target.y;
      }
      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      const dist = Math.hypot(dx, dy);
      const step = p.speed * dt;
      if (dist <= step + 4) {
        this.impact(p);
        p.alive = false;
        continue;
      }
      p.x += (dx / dist) * step;
      p.y += (dy / dist) * step;
      p.dir = Math.atan2(dy, dx);
    }
  }

  impact(p) {
    this.emit('hit', { x: p.tx, y: p.ty, kind: p.kind, type: p.type, splash: p.splash, dir: p.dir || 0 });
    if (p.splash > 0) {
      for (const e of this.enemies) {
        if (e.alive && Math.hypot(e.x - p.tx, e.y - p.ty) <= p.splash + e.size * 0.25) this.damage(e, p.dmg, 0, 0);
      }
    } else if (p.target && p.target.alive) {
      this.damage(p.target, p.dmg, p.slow, p.slowT);
    }
  }

  damage(e, dmg, slow, slowT) {
    if (!e.alive) return;
    e.hp -= Math.max(1, dmg - e.armor);
    e.flash = 0.09;
    if (slow > 0 && slow >= e.slow) {
      e.slow = slow;
      e.slowT = Math.max(e.slowT, slowT);
    }
    if (e.hp <= 0) {
      e.alive = false;
      this.ahn += e.reward;
      this.kills += 1;
      this.emit('kill', { x: e.x, y: e.y, reward: e.reward, type: e.type, size: e.size });
    }
  }

  checkWaveEnd() {
    if (this.phase !== 'wave') return;
    if (this.queue.length > 0) return;
    if (this.enemies.some((e) => e.alive)) return;
    const w = this.d.waves[this.wave - 1];
    this.ahn += w.bonus;
    if (this.wave >= this.d.waves.length) {
      this.phase = 'won';
      this.emit('win', { lives: this.lives });
    } else {
      this.phase = 'prep';
      this.emit('waveClear', { wave: this.wave, bonus: w.bonus });
    }
  }
}
