import Phaser from 'phaser';
import { IMAGE_OVERRIDES } from '../art/overrides.js';
import { generateTextures, smoothOverrides } from '../art/textures.js';
import { preloadPixelFx, createPixelFxAnims, loadEmbeddedPixelFx } from '../fx/PixelFx.js';
import { EMBED } from '../env.js';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload() {
    // 외부 이미지(GPT 등)가 지정돼 있으면 먼저 불러온다. 없는 파일은 경고만 나오고 기본 그림이 쓰인다.
    for (const [key, path] of Object.entries(IMAGE_OVERRIDES)) this.load.image(key, path);
    preloadPixelFx(this); // pixelfx로 구운 이펙트 시트
  }

  create() {
    smoothOverrides(this, Object.keys(IMAGE_OVERRIDES));
    generateTextures(this);
    const next = () => {
      createPixelFxAnims(this);
      this.scene.start('menu');
    };
    if (EMBED) loadEmbeddedPixelFx(this).then(next, next);
    else next();
  }
}
