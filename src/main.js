import Phaser from 'phaser';
import { W, H, RENDER_SCALE } from './config.js';
import BootScene from './scenes/BootScene.js';
import MenuScene from './scenes/MenuScene.js';
import GameScene from './scenes/GameScene.js';

async function start() {
  // 한글 웹폰트가 늦어도 게임이 막히지 않게 최대 1.5초만 기다린다.
  try {
    await Promise.race([document.fonts.load('700 16px "Noto Sans KR"'), new Promise((r) => setTimeout(r, 1500))]);
  } catch {
    /* 폰트를 못 받으면 시스템 폰트로 진행 */
  }

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: W * RENDER_SCALE,
    height: H * RENDER_SCALE,
    backgroundColor: '#0b0b10',
    banner: false,
    disableContextMenu: true,
    input: { activePointers: 3 },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [BootScene, MenuScene, GameScene],
  });
  window.__game = game;
}

start();
