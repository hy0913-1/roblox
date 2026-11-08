// pixelfx 이펙트(미리 구워둔 시트)를 Phaser 스프라이트 애니메이션으로 재생한다.
// 시트 파일이 없거나 못 불러오면 play()는 조용히 false를 돌려주고, 호출한 쪽이 기본 이펙트(Fx)로 대신한다.
import Phaser from 'phaser';
import { FX_SHEETS } from './fxSheets.js';
import { EMBED } from '../env.js';

export function preloadPixelFx(scene) {
  if (EMBED) return; // 임베드 모드는 loadEmbeddedPixelFx 를 쓴다
  for (const s of FX_SHEETS) {
    scene.load.spritesheet(s.key, `assets/fx/${s.file}`, { frameWidth: s.frameW, frameHeight: s.frameH });
  }
}

// 단일 HTML(아티팩트) 모드: data: URI 이미지를 <img>로 읽어서 텍스처로 등록한다. (XHR/fetch를 쓰지 않는다)
export function loadEmbeddedPixelFx(scene) {
  const urls = (typeof window !== 'undefined' && window.__ASSET_URLS) || {};
  return Promise.all(
    FX_SHEETS.map(
      (s) =>
        new Promise((resolve) => {
          const src = urls[s.file];
          if (!src || scene.textures.exists(s.key)) return resolve();
          const img = new Image();
          img.onload = () => {
            scene.textures.addSpriteSheet(s.key, img, { frameWidth: s.frameW, frameHeight: s.frameH });
            resolve();
          };
          img.onerror = () => resolve(); // 못 읽으면 도형 이펙트로 대체된다
          img.src = src;
        })
    )
  );
}

export function createPixelFxAnims(scene) {
  for (const s of FX_SHEETS) {
    if (!scene.textures.exists(s.key) || scene.anims.exists(s.key)) continue;
    scene.textures.get(s.key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    scene.anims.create({
      key: s.key,
      frames: scene.anims.generateFrameNumbers(s.key, { start: 0, end: s.frames - 1 }),
      frameRate: s.fps,
      repeat: 0,
    });
  }
}

const SHEET_BY_KEY = Object.fromEntries(FX_SHEETS.map((s) => [s.key, s]));

export class PixelFx {
  constructor(scene, layer) {
    this.scene = scene;
    this.layer = layer;
    this.live = 0;
  }

  // x,y는 이펙트의 기준점(pivot)이 놓일 좌표. scale은 시트 1픽셀이 화면에서 차지하는 크기.
  play(key, x, y, { scale = 1, angle = 0, alpha = 1, maxLive = 40 } = {}) {
    const sheet = SHEET_BY_KEY[key];
    const s = this.scene;
    if (!sheet || !s.textures.exists(key) || !s.anims.exists(key)) return false;
    if (this.live >= maxLive) return true; // 너무 많이 겹치면 건너뛴다(모바일 부하 방지)
    const spr = s.add.sprite(x, y, key, 0);
    spr.setOrigin(sheet.pivot[0] / sheet.frameW, sheet.pivot[1] / sheet.frameH);
    spr.setScale(scale);
    spr.setRotation(angle);
    spr.setAlpha(alpha);
    this.layer.add(spr);
    this.live += 1;
    spr.play(key);
    spr.once('animationcomplete', () => {
      this.live -= 1;
      spr.destroy();
    });
    return true;
  }
}
