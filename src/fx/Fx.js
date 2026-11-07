import { COLORS, FONT } from '../config.js';

// 전투 이펙트. 지금은 Phaser 도형 기반이고, pixelfx 스프라이트 이펙트는 PixelFx.js가 위에 얹는다.
export class Fx {
  constructor(scene, layer) {
    this.scene = scene;
    this.layer = layer;
  }

  burst(x, y, color, n = 8, speed = 70, life = 0.35, size = 3) {
    const s = this.scene;
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.6;
      const v = speed * (0.5 + Math.random() * 0.7);
      const p = s.add.rectangle(x, y, size, size, color);
      this.layer.add(p);
      s.tweens.add({
        targets: p,
        x: x + Math.cos(a) * v * life,
        y: y + Math.sin(a) * v * life,
        alpha: 0,
        scale: 0.3,
        duration: life * 1000,
        ease: 'Quad.easeOut',
        onComplete: () => p.destroy(),
      });
    }
  }

  ring(x, y, radius, color, life = 0.3, alpha = 0.9) {
    const s = this.scene;
    const c = s.add.circle(x, y, 6, color, 0).setStrokeStyle(3, color, alpha);
    this.layer.add(c);
    s.tweens.add({
      targets: c,
      radius,
      alpha: 0,
      duration: life * 1000,
      ease: 'Cubic.easeOut',
      onComplete: () => c.destroy(),
    });
  }

  flashCircle(x, y, radius, color, life = 0.2) {
    const s = this.scene;
    const c = s.add.circle(x, y, radius, color, 0.55);
    this.layer.add(c);
    s.tweens.add({ targets: c, alpha: 0, scale: 1.4, duration: life * 1000, onComplete: () => c.destroy() });
  }

  floatText(x, y, str, color = COLORS.goldText) {
    const s = this.scene;
    const t = s.add.text(x, y, str, {
      fontFamily: FONT,
      fontSize: '14px',
      fontStyle: 'bold',
      color,
      stroke: '#0c0b12',
      strokeThickness: 3,
      resolution: 2,
    });
    t.setOrigin(0.5, 1);
    this.layer.add(t);
    s.tweens.add({ targets: t, y: y - 26, alpha: 0, duration: 800, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
  }

  line(x1, y1, x2, y2, color, width = 3, life = 0.12) {
    const s = this.scene;
    const g = s.add.graphics();
    g.lineStyle(width, color, 1);
    g.lineBetween(x1, y1, x2, y2);
    this.layer.add(g);
    s.tweens.add({ targets: g, alpha: 0, duration: life * 1000, onComplete: () => g.destroy() });
  }

  shake(duration = 160, intensity = 0.006) {
    this.scene.cameras.main.shake(duration, intensity);
  }
}
