import Phaser from 'phaser';
import { COLS, ROWS, CELL, FIELD_X, FIELD_Y, COLORS } from '../config.js';
import { Sim } from '../sim/Sim.js';
import { spend } from '../sim/bot.js';
import { TOWER_ORDER } from '../data/towers.js';
import { Fx } from '../fx/Fx.js';
import { Hud } from '../ui/Hud.js';
import { setupCamera } from '../ui/widgets.js';
import { sfx, unlock, isMuted, setMuted, startMusic, stopMusic } from '../audio/Sfx.js';

const SPEEDS = [1, 2, 3];
const PROJ_COLOR = { slash: 0x9fd6ff, lance: 0xe6edf5, orb: 0xe58fb8 };

// 스프라이트를 가장 긴 변이 size가 되도록 맞춘다. (기본 16px 도트와 GPT 이미지 모두 같은 코드로 처리)
function fit(img, size) {
  const k = size / Math.max(img.width, img.height);
  img.setScale(k);
  img.baseScale = k;
  return img;
}

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('game');
  }

  init() {
    this.speed = 1;
    this.paused = false;
    this.over = false;
    this.buildType = null;
    this.selectedId = null;
    this.ghostCell = null;
    this.lastInputTouch = false;
    this.towerViews = new Map();
    this.enemyViews = new Map();
    this.projViews = new Map();
  }

  create() {
    setupCamera(this);
    this.sim = new Sim();
    window.__td = { sim: this.sim, scene: this, spend }; // 테스트/디버그용

    const layer = () => this.add.container(FIELD_X, FIELD_Y);
    this.tileLayer = layer();
    this.decoLayer = layer();
    this.towerLayer = layer();
    this.enemyLayer = layer();
    this.projLayer = layer();
    this.fxLayer = layer();
    this.overGfx = this.add.graphics({ x: FIELD_X, y: FIELD_Y });
    this.hpGfx = this.add.graphics({ x: FIELD_X, y: FIELD_Y });

    this.drawMap();
    this.fx = new Fx(this, this.fxLayer);

    this.ghostSprite = this.add.image(0, 0, 'tower_yisang').setAlpha(0.65).setVisible(false);
    this.ghostSprite.setPosition(0, 0);

    this.hud = new Hud(this);
    this.ghostSprite.setDepth(20);
    this.overGfx.setDepth(19);
    this.hpGfx.setDepth(18);

    this.setupInput();
    startMusic();
    this.events.once('shutdown', () => {
      stopMusic();
      this.tweens.timeScale = 1;
    });
    this.hud.showToast('수감자를 배치하고 웨이브를 시작하세요', COLORS.text);
  }

  // ---------- 맵 ----------
  drawMap() {
    const { map } = this.sim.d;
    const key = (base, v) => (v && this.textures.exists(`${base}${v}`) ? `${base}${v}` : base);
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        const isPath = map.pathCells.has(`${c},${r}`);
        const tex = isPath ? key('tile_path', (c + r) % 2 ? 2 : 0) : key('tile_ground', (c * 3 + r) % 3 === 0 ? 2 : 0);
        const img = this.add.image(c * CELL, r * CELL, tex).setOrigin(0, 0).setDisplaySize(CELL, CELL);
        this.tileLayer.add(img);
      }
    }
    for (const k of map.rocks) {
      const [c, r] = k.split(',').map(Number);
      this.tileLayer.add(this.add.image(c * CELL, r * CELL, 'tile_rock').setOrigin(0, 0).setDisplaySize(CELL, CELL));
    }
    // 입구와 버스
    const sy = (map.start[1] + 0.5) * CELL;
    this.portal = fit(this.add.image(CELL * 0.5, sy, 'portal'), CELL * 0.95);
    this.decoLayer.add(this.portal);
    this.tweens.add({ targets: this.portal, angle: 360, duration: 7000, repeat: -1 });
    const gx = (map.goal[0] + 0.5) * CELL;
    const gy = (map.goal[1] + 0.5) * CELL;
    this.busPos = { x: gx, y: gy };
    this.bus = fit(this.add.image(gx, gy, 'bus'), CELL * 0.98);
    this.decoLayer.add(this.bus);
  }

  // ---------- 입력 ----------
  setupInput() {
    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', (p) => {
      unlock();
      this.lastInputTouch = !!p.wasTouch;
    });

    this.fieldZone = this.add.zone(FIELD_X, FIELD_Y, COLS * CELL, ROWS * CELL).setOrigin(0, 0).setInteractive();
    this.fieldZone.on('pointerdown', (p) => this.onFieldDown(p));
    this.fieldZone.on('pointermove', (p) => {
      if (this.buildType && !p.wasTouch) this.ghostCell = this.cellOf(p);
    });
    this.fieldZone.on('pointerout', (p) => {
      if (!p.wasTouch) this.ghostCell = null;
    });

    const kb = this.input.keyboard;
    if (kb) {
      const keys = { ONE: 0, TWO: 1, THREE: 2 };
      for (const [k, i] of Object.entries(keys)) kb.on(`keydown-${k}`, () => TOWER_ORDER[i] && this.toggleBuild(TOWER_ORDER[i]));
      kb.on('keydown-SPACE', () => this.startWave());
      kb.on('keydown-U', () => this.upgradeSelected());
      kb.on('keydown-S', () => this.sellSelected());
      kb.on('keydown-F', () => this.cycleSpeed());
      kb.on('keydown-P', () => this.togglePause());
      kb.on('keydown-M', () => this.toggleMute());
      kb.on('keydown-TAB', (e) => { e.preventDefault(); this.cycleSelected(); });
      kb.on('keydown-ESC', () => {
        if (this.buildType) this.cancelBuild();
        else if (this.selectedId) this.deselect();
        else this.togglePause();
      });
    }
  }

  cellOf(p) {
    return { c: Math.floor((p.worldX - FIELD_X) / CELL), r: Math.floor((p.worldY - FIELD_Y) / CELL) };
  }

  onFieldDown(p) {
    if (this.over || this.paused) return;
    if (p.rightButtonDown && p.rightButtonDown()) {
      this.cancelBuild();
      this.deselect();
      return;
    }
    const { c, r } = this.cellOf(p);
    if (this.buildType) {
      const touch = !!p.wasTouch;
      if (touch && !(this.ghostCell && this.ghostCell.c === c && this.ghostCell.r === r)) {
        this.ghostCell = { c, r }; // 모바일은 첫 탭에서 미리보기만
        sfx.click();
        return;
      }
      this.tryPlace(c, r);
      return;
    }
    const t = this.sim.towerAt(c, r);
    if (t) {
      this.selectTower(t.id);
      sfx.click();
    } else {
      this.deselect();
    }
  }

  tryPlace(c, r) {
    const sim = this.sim;
    const def = sim.d.towers[this.buildType];
    const existing = sim.towerAt(c, r);
    if (existing) {
      this.cancelBuild();
      this.selectTower(existing.id);
      return;
    }
    if (!sim.canBuild(c, r)) {
      this.hud.showToast('여기에는 놓을 수 없어요', COLORS.redText);
      sfx.deny();
      return;
    }
    if (sim.ahn < def.cost) {
      this.hud.showToast('아안이 부족해요', COLORS.redText);
      sfx.deny();
      return;
    }
    sim.build(this.buildType, c, r);
    sfx.build();
    this.ghostCell = null;
    if (sim.ahn < def.cost) this.cancelBuild();
  }

  // ---------- 행동(HUD/키보드에서 호출) ----------
  toggleBuild(id) {
    if (this.over) return;
    if (this.buildType === id) {
      this.cancelBuild();
      return;
    }
    this.deselect();
    this.buildType = id;
    this.ghostCell = null;
    sfx.click();
  }

  cancelBuild() {
    this.buildType = null;
    this.ghostCell = null;
  }

  selectTower(id) {
    this.cancelBuild();
    this.selectedId = id;
  }

  deselect() {
    this.selectedId = null;
  }

  selectedTower() {
    return this.selectedId ? this.sim.towers.find((t) => t.id === this.selectedId) || null : null;
  }

  upgradeSelected() {
    const t = this.selectedTower();
    if (!t || this.over) return;
    if (this.sim.upgrade(t.id)) sfx.upgrade();
    else {
      sfx.deny();
      this.hud.showToast(this.sim.upgradeCost(t) == null ? '이미 최대 레벨이에요' : '아안이 부족해요', COLORS.redText);
    }
  }

  sellSelected() {
    const t = this.selectedTower();
    if (!t || this.over) return;
    if (this.sim.sell(t.id)) {
      sfx.sell();
      this.deselect();
    }
  }

  cycleSelected() {
    const t = this.selectedTower();
    if (t) {
      this.sim.cyclePriority(t.id);
      sfx.click();
    }
  }

  startWave() {
    if (this.over || this.paused) return;
    if (this.sim.startWave()) sfx.click();
  }

  togglePause() {
    if (this.over) return;
    this.paused = !this.paused;
    sfx.click();
    if (this.paused) {
      this.tweens.pauseAll();
      this.hud.showOverlay({
        title: '일시정지',
        buttons: [
          { label: '계속하기', primary: true, onClick: () => this.togglePause() },
          { label: '처음부터 다시', onClick: () => this.scene.restart() },
          { label: '메뉴로', onClick: () => this.scene.start('menu') },
        ],
      });
    } else {
      this.tweens.resumeAll();
      this.hud.hideOverlay();
    }
  }

  cycleSpeed() {
    this.speed = SPEEDS[(SPEEDS.indexOf(this.speed) + 1) % SPEEDS.length];
    this.tweens.timeScale = this.speed;
    sfx.click();
  }

  toggleMute() {
    setMuted(!isMuted());
    sfx.click();
  }

  // ---------- 매 프레임 ----------
  update(time, delta) {
    if (!this.paused) {
      this.sim.advance((Math.min(delta, 100) / 1000) * this.speed);
      this.consumeEvents();
      this.syncTowers();
      this.syncEnemies(time);
      this.syncProjectiles();
      this.drawOverlays();
    }
    this.hud.refresh();
  }

  syncTowers() {
    const alive = new Set();
    for (const t of this.sim.towers) {
      alive.add(t.id);
      let v = this.towerViews.get(t.id);
      if (!v) {
        const c = this.add.container(t.x, t.y);
        const pad = fit(this.add.image(0, 4, 'pad'), CELL * 0.92);
        const spr = fit(this.add.image(0, -3, `tower_${t.type}`), CELL * 0.98);
        const pips = this.add.graphics();
        c.add([pad, spr, pips]);
        this.towerLayer.add(c);
        v = { c, spr, pips, level: 0 };
        this.towerViews.set(t.id, v);
      }
      if (v.level !== t.level) {
        v.level = t.level;
        v.pips.clear();
        for (let i = 0; i < t.level; i++) {
          v.pips.fillStyle(0x0c0b12, 1);
          v.pips.fillRect(-13 + i * 9, 17, 8, 6);
          v.pips.fillStyle(COLORS.gold, 1);
          v.pips.fillRect(-12 + i * 9, 18, 6, 4);
        }
      }
    }
    for (const [id, v] of this.towerViews) {
      if (!alive.has(id)) {
        v.c.destroy();
        this.towerViews.delete(id);
      }
    }
  }

  syncEnemies(time) {
    const seen = new Set();
    this.hpGfx.clear();
    for (const e of this.sim.enemies) {
      seen.add(e.id);
      let v = this.enemyViews.get(e.id);
      if (!v) {
        const c = this.add.container(e.x, e.y);
        const shadow = this.add.image(0, e.size * 0.38, 'dot').setTint(0x000000).setAlpha(0.35);
        shadow.setScale((e.size / 8) * 0.9, (e.size / 8) * 0.32);
        const spr = fit(this.add.image(0, 0, `enemy_${e.type}`), e.size);
        c.add([shadow, spr]);
        this.enemyLayer.add(c);
        v = { c, spr, state: 0 };
        this.enemyViews.set(e.id, v);
      }
      const bob = Math.sin(time * 0.012 + e.id) * 1.6;
      v.c.setPosition(e.x, e.y + bob);
      v.spr.setFlipX(e.dx < 0);
      const state = e.flash > 0 ? 2 : e.slow > 0 ? 1 : 0;
      if (state !== v.state) {
        v.state = state;
        // Phaser 4: setTintFill이 없어졌으므로 틴트 모드를 직접 바꾼다.
        if (state === 2) v.spr.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
        else if (state === 1) v.spr.setTintMode(Phaser.TintModes.MULTIPLY).setTint(0x9fd0ff);
        else v.spr.setTintMode(Phaser.TintModes.MULTIPLY).clearTint();
      }
      if (e.hp < e.maxHp || e.type === 'boss') {
        const w = Math.max(24, e.size * 0.85);
        const x = e.x - w / 2;
        const y = e.y - e.size / 2 - 8;
        const f = Phaser.Math.Clamp(e.hp / e.maxHp, 0, 1);
        this.hpGfx.fillStyle(0x0c0b12, 0.9);
        this.hpGfx.fillRect(x - 1, y - 1, w + 2, 6);
        this.hpGfx.fillStyle(f > 0.5 ? 0x7fd69a : f > 0.25 ? 0xe0c04a : 0xe05a4a, 1);
        this.hpGfx.fillRect(x, y, w * f, 4);
      }
    }
    for (const [id, v] of this.enemyViews) {
      if (!seen.has(id)) {
        v.c.destroy();
        this.enemyViews.delete(id);
      }
    }
  }

  syncProjectiles() {
    const seen = new Set();
    for (const p of this.sim.projectiles) {
      seen.add(p.id);
      let v = this.projViews.get(p.id);
      if (!v) {
        let obj;
        if (p.kind === 'lance') {
          obj = this.add.rectangle(0, 0, 24, 5, 0xe6edf5).setStrokeStyle(1, 0xd9b44a);
        } else if (p.kind === 'orb') {
          obj = this.add.image(0, 0, 'dot').setTint(PROJ_COLOR.orb).setScale(2);
        } else {
          obj = fit(this.add.image(0, 0, 'proj_slash'), 26);
        }
        this.projLayer.add(obj);
        v = { obj };
        this.projViews.set(p.id, v);
      }
      v.obj.setPosition(p.x, p.y);
      if (p.dir !== undefined) v.obj.setRotation(p.kind === 'slash' ? p.dir - Math.PI / 4 : p.dir);
    }
    for (const [id, v] of this.projViews) {
      if (!seen.has(id)) {
        v.obj.destroy();
        this.projViews.delete(id);
      }
    }
  }

  drawOverlays() {
    const g = this.overGfx;
    g.clear();
    const sim = this.sim;
    const rangeCircle = (x, y, range, color) => {
      g.fillStyle(color, 0.08);
      g.fillCircle(x, y, range);
      g.lineStyle(2, color, 0.85);
      g.strokeCircle(x, y, range);
    };

    this.ghostSprite.setVisible(false);
    if (this.buildType && this.ghostCell) {
      const { c, r } = this.ghostCell;
      if (sim.inGrid(c, r)) {
        const def = sim.d.towers[this.buildType];
        const ok = sim.canBuild(c, r) && sim.ahn >= def.cost;
        const x = (c + 0.5) * CELL;
        const y = (r + 0.5) * CELL;
        const color = ok ? 0x7fd69a : 0xe05a4a;
        g.fillStyle(color, 0.25);
        g.fillRect(c * CELL, r * CELL, CELL, CELL);
        rangeCircle(x, y, def.levels[0].range, color);
        this.ghostSprite.setTexture(`tower_${this.buildType}`);
        fit(this.ghostSprite, CELL * 0.98);
        this.ghostSprite.setPosition(FIELD_X + x, FIELD_Y + y - 3).setVisible(true);
        this.ghostSprite.setTint(ok ? 0xffffff : 0xff8080);
      }
    }
    const t = this.selectedTower();
    if (t) {
      g.fillStyle(COLORS.gold, 0.22);
      g.fillRect(t.c * CELL, t.r * CELL, CELL, CELL);
      rangeCircle(t.x, t.y, sim.stats(t).range, COLORS.gold);
    }
  }

  // ---------- 시뮬레이션 이벤트 → 소리/이펙트 ----------
  consumeEvents() {
    const sim = this.sim;
    for (const e of sim.drainEvents()) {
      switch (e.type) {
        case 'fire': {
          const v = this.towerViews.get(e.tower.id);
          const def = sim.d.towers[e.tower.type];
          sfx[def.proj.kind]?.();
          if (v) {
            v.spr.setFlipX(e.target.x < e.tower.x);
            this.tweens.add({ targets: v.spr, scaleX: v.spr.baseScale * 1.14, scaleY: v.spr.baseScale * 0.9, duration: 70, yoyo: true });
          }
          this.fx.burst(e.tower.x, e.tower.y - 6, def.color, 4, 40, 0.2, 2);
          break;
        }
        case 'hit': {
          const col = PROJ_COLOR[e.kind] || 0xffffff;
          if (e.splash > 0) {
            this.fx.ring(e.x, e.y, e.splash, 0xd9b44a, 0.32);
            this.fx.flashCircle(e.x, e.y, e.splash * 0.6, 0xffb060, 0.22);
            this.fx.burst(e.x, e.y, 0xffb060, 10, 110, 0.4, 3);
            sfx.boom();
          } else {
            this.fx.burst(e.x, e.y, col, 5, 70, 0.22, 3);
            sfx.hit();
          }
          break;
        }
        case 'kill':
          this.fx.burst(e.x, e.y, e.type === 'boss' ? 0xd9b44a : 0xb89cff, e.type === 'boss' ? 28 : 10, e.type === 'boss' ? 160 : 90, 0.5, e.type === 'boss' ? 5 : 3);
          this.fx.floatText(e.x, e.y - 10, `+${e.reward}`);
          if (e.type === 'boss') this.fx.shake(300, 0.01);
          sfx.kill();
          break;
        case 'leak':
          this.fx.shake(220, 0.007);
          this.fx.flashCircle(this.busPos.x, this.busPos.y, 30, 0xff3030, 0.3);
          this.fx.floatText(this.busPos.x, this.busPos.y - 22, `-${e.amount}`, COLORS.redText);
          sfx.leak();
          break;
        case 'build': {
          const t = e.tower;
          this.fx.ring(t.x, t.y, 30, 0xefe6c8, 0.28, 0.7);
          this.fx.burst(t.x, t.y + 10, 0xefe6c8, 8, 50, 0.3, 2);
          break;
        }
        case 'upgrade':
          this.fx.ring(e.tower.x, e.tower.y, 34, COLORS.gold, 0.35);
          this.fx.burst(e.tower.x, e.tower.y, COLORS.gold, 10, 80, 0.45, 3);
          break;
        case 'sell':
          this.fx.floatText(e.tower.x, e.tower.y - 14, `+${sim.sellValue(e.tower)}`);
          break;
        case 'waveStart':
          this.hud.showBanner(e.boss ? `웨이브 ${e.wave}  ·  보스 접근!` : `웨이브 ${e.wave}`, e.boss ? COLORS.redText : COLORS.goldText);
          sfx.wave();
          break;
        case 'waveClear':
          this.hud.showBanner('웨이브 클리어', COLORS.good);
          this.hud.showToast(`보너스 +${e.bonus} 아안`, COLORS.goldText);
          sfx.clear();
          break;
        case 'win':
          this.finish(true);
          break;
        case 'lose':
          this.finish(false);
          break;
        default:
      }
    }
  }

  finish(win) {
    if (this.over) return;
    this.over = true;
    this.cancelBuild();
    this.deselect();
    const sim = this.sim;
    win ? sfx.win() : sfx.lose();
    this.time.delayedCall(900, () => {
      const rank = sim.lives >= 18 ? 'S' : sim.lives >= 12 ? 'A' : sim.lives >= 6 ? 'B' : 'C';
      const lines = win
        ? [`버스 내구도  ${sim.lives} / ${sim.d.cfg.startLives}`, `처치한 왜곡체  ${sim.kills}`, `누수  ${sim.leaked}`, `평가  ${rank}`]
        : [`도달한 웨이브  ${sim.wave} / ${sim.totalWaves}`, `처치한 왜곡체  ${sim.kills}`];
      this.hud.showOverlay({
        title: win ? '방어 성공' : '버스 파괴',
        titleColor: win ? COLORS.goldText : COLORS.redText,
        lines,
        buttons: [
          { label: '다시 하기', primary: true, onClick: () => this.scene.restart() },
          { label: '메뉴로', onClick: () => this.scene.start('menu') },
        ],
      });
    });
  }
}
