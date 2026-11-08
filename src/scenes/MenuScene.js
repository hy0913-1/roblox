import Phaser from 'phaser';
import { W, H, COLORS } from '../config.js';
import { TOWER_ORDER } from '../data/towers.js';
import { label, makeButton, setupCamera } from '../ui/widgets.js';
import { unlock, sfx } from '../audio/Sfx.js';

const HELP = [
  '■ 목표',
  '왜곡체가 길을 따라 버스에 닿으면 내구도가 깎여요. 내구도 0이면 패배, 10웨이브를 막으면 승리!',
  '',
  '■ 조작',
  '오른쪽 카드로 수감자를 고르고 빈 칸에 배치해요.',
  '모바일: 칸을 한 번 탭하면 미리보기, 같은 칸을 한 번 더 탭하면 배치.',
  '배치한 수감자를 누르면 업그레이드 · 판매 · 목표 우선순위 변경.',
  '"웨이브 시작"을 눌러야 적이 나와요. 준비는 천천히!',
  '',
  '■ PC 단축키',
  '1 · 2 · 3 수감자 선택 / Space 웨이브 시작 / U 업그레이드 / S 판매',
  'Tab 목표 변경 / F 배속 / P 일시정지 / M 소리 / Esc 취소',
];

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('menu');
  }

  create() {
    setupCamera(this);
    this.input.once('pointerdown', unlock);

    // 배경: 어두운 타일과 지나가는 왜곡체
    for (let c = 0; c < 20; c++) {
      for (let r = 0; r < 12; r++) {
        this.add.image(c * 48, r * 48, (c * 5 + r * 3) % 4 === 0 ? 'tile_ground2' : 'tile_ground').setOrigin(0, 0).setDisplaySize(48, 48).setAlpha(0.55);
      }
    }
    for (let c = 0; c < 20; c++) this.add.image(c * 48, 432, c % 2 ? 'tile_path2' : 'tile_path').setOrigin(0, 0).setDisplaySize(48, 48).setAlpha(0.8);
    ['shade', 'runner', 'carapace', 'shade', 'runner'].forEach((t, i) => {
      const e = this.add.image(-60 - i * 150, 456, `enemy_${t}`);
      e.setScale(48 / Math.max(e.width, e.height));
      this.tweens.add({ targets: e, x: W + 80, duration: 14000 + i * 600, repeat: -1, delay: i * 1500 });
    });
    TOWER_ORDER.forEach((id, i) => {
      const s = this.add.image(W / 2 - 120 + i * 120, 392, `tower_${id}`);
      s.setScale(80 / Math.max(s.width, s.height));
      this.tweens.add({ targets: s, y: s.y - 6, duration: 900 + i * 150, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });

    label(this, W / 2, 60, 'LIMBUS DEFENSE', { size: 60, bold: true, color: COLORS.goldText, align: 'center', origin: [0.5, 0], stroke: { color: '#0c0b12', width: 8 } });
    label(this, W / 2, 132, '버스를 지켜라', { size: 28, bold: true, align: 'center', origin: [0.5, 0], stroke: { color: '#0c0b12', width: 6 } });
    label(this, W / 2, 176, '림버스 컴퍼니 비영리 팬게임 · 타워 디펜스', { size: 15, color: COLORS.dim, align: 'center', origin: [0.5, 0] });

    makeButton(this, { x: W / 2 - 130, y: 214, w: 260, h: 56, label: '게임 시작', size: 22, fill: 0x3a2f12, stroke: COLORS.gold, onClick: () => { sfx.click(); this.scene.start('game'); } });
    makeButton(this, { x: W / 2 - 130, y: 280, w: 260, h: 44, label: '도움말', size: 16, onClick: () => this.toggleHelp() });

    label(this, W / 2, H - 22, '이 게임은 Project Moon과 무관한 비영리 팬 제작물이며, 원작의 모든 권리는 원 저작권자에게 있습니다.', {
      size: 11, color: COLORS.dim, align: 'center', origin: [0.5, 0.5],
    });
  }

  toggleHelp() {
    if (this.help) {
      this.help.destroy();
      this.help = null;
      return;
    }
    const c = this.add.container(0, 0).setDepth(10);
    const dim = this.add.rectangle(0, 0, W, H, 0x000000, 0.8).setOrigin(0, 0).setInteractive();
    const box = this.add.rectangle(W / 2, H / 2, 760, 400, COLORS.panel).setStrokeStyle(3, COLORS.gold);
    const txt = label(this, W / 2 - 350, H / 2 - 180, HELP.join('\n'), { size: 15, wrap: 700, lineSpacing: 5 });
    const close = makeButton(this, { x: W / 2 - 90, y: H / 2 + 148, w: 180, h: 40, label: '닫기', size: 16, onClick: () => this.toggleHelp() });
    c.add([dim, box, txt, close]);
    this.help = c;
  }
}
