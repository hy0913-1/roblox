import { COLORS, W, H, PANEL_X, PANEL_W, COLS, CELL } from '../config.js';
import { TOWER_ORDER, PRIORITY_NAMES } from '../data/towers.js';
import { label, makeButton, setIfChanged } from './widgets.js';
import { isMuted } from '../audio/Sfx.js';

const PX = PANEL_X + 8; // 패널 안쪽 왼쪽 여백
const PW = PANEL_W - 16;

export class Hud {
  constructor(scene) {
    this.s = scene;
    this.sim = scene.sim;
    this.cards = {};
    this.overlay = null;
    this.makeTopBar();
    this.makePanel();
    this.makeBuildPanel();
    this.makeTowerPanel();
    this.makePreview();
    this.makeWaveButton();
    this.makeToast();
    this.refresh();
  }

  // ---------- 상단 바 ----------
  makeTopBar() {
    const s = this.s;
    s.add.rectangle(0, 0, W, 50, COLORS.panel).setOrigin(0, 0);
    s.add.rectangle(0, 49, W, 2, COLORS.panelEdge).setOrigin(0, 0);

    const stat = (x, cap, color) => {
      label(s, x, 5, cap, { size: 11, color: COLORS.dim });
      return label(s, x, 19, '', { size: 21, bold: true, color });
    };
    this.ahnT = stat(14, '아안', COLORS.goldText);
    this.livesT = stat(120, '버스 내구도', COLORS.text);
    this.waveT = stat(250, '웨이브', COLORS.text);
    this.foeT = stat(360, '남은 적', COLORS.text);

    // 오른쪽 버튼들(오른쪽 끝부터 배치)
    const y = 5;
    const h = 40;
    this.pauseBtn = makeButton(s, { x: W - 10 - 76, y, w: 76, h, label: '일시정지', size: 14, onClick: () => s.togglePause() });
    this.speedBtn = makeButton(s, { x: W - 10 - 76 - 6 - 58, y, w: 58, h, label: 'x1', size: 16, onClick: () => s.cycleSpeed() });
    this.soundBtn = makeButton(s, { x: W - 10 - 76 - 6 - 58 - 6 - 66, y, w: 66, h, label: '소리 켬', size: 13, onClick: () => s.toggleMute() });
    this.fullBtn = null;
    if (s.scale.fullscreen.available) {
      this.fullBtn = makeButton(s, { x: W - 10 - 76 - 6 - 58 - 6 - 66 - 6 - 66, y, w: 66, h, label: '전체화면', size: 13, onClick: () => s.scale.toggleFullscreen() });
    }
  }

  // ---------- 오른쪽 패널 ----------
  makePanel() {
    const s = this.s;
    s.add.rectangle(PANEL_X, 50, PANEL_W, H - 50, COLORS.panel).setOrigin(0, 0);
    s.add.rectangle(PANEL_X, 50, 2, H - 50, COLORS.panelEdge).setOrigin(0, 0);
  }

  makeBuildPanel() {
    const s = this.s;
    const c = s.add.container(0, 0);
    this.buildPanel = c;
    c.add(label(s, PX, 58, '수감자 배치', { size: 13, color: COLORS.dim }));

    TOWER_ORDER.forEach((id, i) => {
      const def = this.sim.d.towers[id];
      const y = 78 + i * 82;
      const card = s.add.container(PX, y);
      const bg = s.add.rectangle(0, 0, PW, 76, 0x1d1d28).setOrigin(0, 0).setStrokeStyle(2, 0x3a3a4a);
      const icon = s.add.image(8, 14, `tower_${id}`).setOrigin(0, 0);
      const k = 44 / Math.max(icon.width, icon.height);
      icon.setScale(k);
      const name = label(s, 60, 6, def.name, { size: 16, bold: true });
      const role = label(s, 60, 28, def.role, { size: 11, color: COLORS.dim, wrap: PW - 64 });
      const cost = label(s, 60, 54, `${def.cost} 아안`, { size: 14, bold: true, color: COLORS.goldText });
      const key = label(s, PW - 8, 6, String(i + 1), { size: 11, color: COLORS.dim, origin: [1, 0] });
      card.add([bg, icon, name, role, cost, key]);
      card.setSize(PW, 76);
      bg.setInteractive({ useHandCursor: true });
      let pressed = false;
      bg.on('pointerdown', () => { pressed = true; });
      bg.on('pointerout', () => { pressed = false; });
      bg.on('pointerup', () => {
        if (pressed) s.toggleBuild(id);
        pressed = false;
      });
      c.add(card);
      this.cards[id] = { card, bg, cost, def };
    });

    this.hint = label(s, PX, 326, '', { size: 12, color: COLORS.dim, wrap: PW, lineSpacing: 3 });
    c.add(this.hint);
  }

  makeTowerPanel() {
    const s = this.s;
    const c = s.add.container(0, 0);
    this.towerPanel = c;
    this.tpTitle = label(s, PX, 58, '', { size: 18, bold: true, color: COLORS.goldText });
    this.tpRole = label(s, PX, 82, '', { size: 12, color: COLORS.dim });
    this.tpStats = label(s, PX, 102, '', { size: 13, wrap: PW, lineSpacing: 4 });
    this.prioBtn = makeButton(s, { x: PX, y: 196, w: PW, h: 40, label: '', size: 13, onClick: () => s.cycleSelected() });
    this.upBtn = makeButton(s, { x: PX, y: 242, w: PW, h: 44, label: '', size: 15, onClick: () => s.upgradeSelected(), fill: 0x2a2a1a, stroke: 0x8a7330 });
    this.sellBtn = makeButton(s, { x: PX, y: 292, w: PW, h: 40, label: '', size: 14, onClick: () => s.sellSelected() });
    this.closeBtn = makeButton(s, { x: PX, y: 338, w: PW, h: 36, label: '닫기', size: 13, onClick: () => s.deselect() });
    c.add([this.tpTitle, this.tpRole, this.tpStats, this.prioBtn, this.upBtn, this.sellBtn, this.closeBtn]);
    c.setVisible(false);
  }

  makePreview() {
    const s = this.s;
    this.preCap = label(s, PX, 392, '', { size: 12, color: COLORS.dim });
    this.preBody = label(s, PX, 410, '', { size: 13, wrap: PW, lineSpacing: 3 });
  }

  makeWaveButton() {
    this.waveBtn = makeButton(this.s, {
      x: PX, y: 486, w: PW, h: 44, label: '', size: 16,
      onClick: () => this.s.startWave(),
      fill: 0x3a1a1a, stroke: COLORS.red,
    });
  }

  makeToast() {
    const s = this.s;
    this.toast = label(s, (COLS * CELL) / 2, 76, '', { size: 16, bold: true, align: 'center', origin: [0.5, 0], stroke: { color: '#0c0b12', width: 4 } });
    this.toast.setDepth(50).setAlpha(0);
    this.banner = label(s, (COLS * CELL) / 2, 250, '', { size: 44, bold: true, align: 'center', origin: [0.5, 0.5], color: COLORS.goldText, stroke: { color: '#0c0b12', width: 8 } });
    this.banner.setDepth(50).setAlpha(0);
  }

  showToast(msg, color = COLORS.text) {
    const s = this.s;
    this.toast.setText(msg).setColor(color).setAlpha(1);
    s.tweens.killTweensOf(this.toast);
    s.tweens.add({ targets: this.toast, alpha: 0, delay: 900, duration: 400 });
  }

  showBanner(msg, color = COLORS.goldText) {
    const s = this.s;
    this.banner.setText(msg).setColor(color).setAlpha(0).setScale(0.8);
    s.tweens.killTweensOf(this.banner);
    s.tweens.add({ targets: this.banner, alpha: 1, scale: 1, duration: 220, ease: 'Back.easeOut' });
    s.tweens.add({ targets: this.banner, alpha: 0, delay: 1300, duration: 400 });
  }

  // ---------- 매 프레임 갱신 ----------
  refresh() {
    const s = this.s;
    const sim = this.sim;
    setIfChanged(this.ahnT, String(sim.ahn));
    setIfChanged(this.livesT, String(sim.lives));
    this.livesT.setColor(sim.lives <= 5 ? COLORS.redText : COLORS.text);
    setIfChanged(this.waveT, `${Math.min(sim.wave, sim.totalWaves)} / ${sim.totalWaves}`);
    setIfChanged(this.foeT, String(sim.enemies.length + sim.queue.length));
    this.speedBtn.setLabel(`x${s.speed}`);
    this.soundBtn.setLabel(isMuted() ? '소리 끔' : '소리 켬');
    this.pauseBtn.setLabel(s.paused ? '계속' : '일시정지');

    // 타워 카드: 돈이 모자라면 흐리게, 선택되면 금색 테두리
    for (const id of TOWER_ORDER) {
      const { bg, cost, def } = this.cards[id];
      const afford = sim.ahn >= def.cost;
      cost.setColor(afford ? COLORS.goldText : COLORS.redText);
      bg.setStrokeStyle(2, s.buildType === id ? COLORS.gold : 0x3a3a4a);
      bg.setFillStyle(s.buildType === id ? 0x2b2a1c : 0x1d1d28);
      this.cards[id].card.setAlpha(afford || s.buildType === id ? 1 : 0.6);
    }
    this.hint.setText(this.hintText());
    this.hint.setVisible(!!s.buildType);

    // 선택한 타워 정보
    const t = s.selectedTower();
    this.buildPanel.setVisible(!t);
    this.towerPanel.setVisible(!!t);
    if (t) this.refreshTowerPanel(t);

    this.refreshPreview();
    this.refreshWaveButton();
  }

  hintText() {
    const s = this.s;
    if (!s.buildType) return '';
    return s.lastInputTouch
      ? '빈 칸 탭 → 미리보기\n같은 칸 한 번 더 탭 → 배치\n(카드를 다시 누르면 취소)'
      : '빈 칸을 클릭해서 배치\n우클릭 / ESC로 취소';
  }

  refreshTowerPanel(t) {
    const sim = this.sim;
    const def = sim.d.towers[t.type];
    const cur = sim.stats(t);
    const next = t.level < def.levels.length ? def.levels[t.level] : null;
    setIfChanged(this.tpTitle, `${def.name}  Lv.${t.level}`);
    setIfChanged(this.tpRole, def.role);
    const pair = (name, a, b, fmt = (v) => v) => (b != null && b !== a ? `${name}  ${fmt(a)} → ${fmt(b)}` : `${name}  ${fmt(a)}`);
    const lines = [
      pair('피해', cur.dmg, next && next.dmg),
      pair('사거리', cur.range, next && next.range),
      pair('공격 간격', cur.cd, next && next.cd, (v) => `${v.toFixed(2)}초`),
    ];
    if (cur.splash) lines.push(pair('폭발 반경', cur.splash, next && next.splash));
    if (cur.slow) lines.push(pair('감속', cur.slow, next && next.slow, (v) => `${Math.round(v * 100)}%`));
    setIfChanged(this.tpStats, lines.join('\n'));

    this.prioBtn.setLabel(`목표: ${PRIORITY_NAMES[t.priority]}  (탭해서 변경)`);
    const cost = sim.upgradeCost(t);
    if (cost == null) {
      this.upBtn.setLabel('최대 레벨');
      this.upBtn.setEnabled(false);
    } else {
      this.upBtn.setLabel(`업그레이드  ${cost} 아안`);
      this.upBtn.setEnabled(sim.ahn >= cost);
    }
    this.sellBtn.setLabel(`판매  +${sim.sellValue(t)} 아안`);
  }

  refreshPreview() {
    const sim = this.sim;
    if (sim.phase === 'won' || sim.phase === 'lost') {
      this.preCap.setText('');
      this.preBody.setText('');
      return;
    }
    if (sim.phase === 'wave') {
      setIfChanged(this.preCap, `웨이브 ${sim.wave} 진행 중`);
      setIfChanged(this.preBody, `남은 적 ${sim.enemies.length + sim.queue.length}\n누수 ${sim.leaked}`);
      return;
    }
    const w = sim.d.waves[sim.wave];
    if (!w) return;
    const counts = {};
    for (const g of w.groups) counts[g.type] = (counts[g.type] || 0) + g.n;
    const lines = Object.entries(counts).map(([type, n]) => `${sim.d.enemies[type].name} ×${n}`);
    lines.push(`체력 ×${w.hpMul.toFixed(2)}`);
    setIfChanged(this.preCap, `다음: 웨이브 ${sim.wave + 1}`);
    setIfChanged(this.preBody, lines.join('\n'));
  }

  refreshWaveButton() {
    const sim = this.sim;
    const b = this.waveBtn;
    if (sim.phase === 'prep') {
      b.setLabel(`웨이브 ${sim.wave + 1} 시작`);
      b.setEnabled(true);
      b.setVisible(true);
    } else if (sim.phase === 'wave') {
      b.setLabel('전투 중…');
      b.setEnabled(false);
      b.setVisible(true);
    } else {
      b.setVisible(false);
    }
  }

  // ---------- 오버레이 ----------
  hideOverlay() {
    if (this.overlay) {
      this.overlay.destroy();
      this.overlay = null;
    }
  }

  showOverlay({ title, titleColor = COLORS.goldText, lines = [], buttons = [] }) {
    const s = this.s;
    this.hideOverlay();
    const c = s.add.container(0, 0).setDepth(100);
    const dim = s.add.rectangle(0, 0, W, H, 0x000000, 0.7).setOrigin(0, 0).setInteractive();
    const pw = 440;
    const ph = 120 + lines.length * 24 + Math.ceil(buttons.length / 1) * 56;
    const px = (W - pw) / 2;
    const py = (H - ph) / 2;
    const box = s.add.rectangle(px, py, pw, ph, COLORS.panel).setOrigin(0, 0).setStrokeStyle(3, COLORS.gold);
    const ttl = label(s, W / 2, py + 22, title, { size: 34, bold: true, color: titleColor, align: 'center', origin: [0.5, 0] });
    c.add([dim, box, ttl]);
    lines.forEach((ln, i) => c.add(label(s, W / 2, py + 76 + i * 24, ln, { size: 16, align: 'center', origin: [0.5, 0] })));
    buttons.forEach((b, i) => {
      const btn = makeButton(s, { x: px + 40, y: py + 90 + lines.length * 24 + i * 56, w: pw - 80, h: 46, label: b.label, size: 17, onClick: b.onClick, fill: b.primary ? 0x3a2f12 : 0x23232f, stroke: b.primary ? COLORS.gold : 0x4a4a5c });
      c.add(btn);
    });
    this.overlay = c;
    return c;
  }
}
