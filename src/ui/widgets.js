import { COLORS, FONT, RENDER_SCALE, W, H } from '../config.js';

// 모든 씬의 메인 카메라를 논리 해상도(960x540)에 맞춘다. (캔버스는 RENDER_SCALE배라 선명하다)
export function setupCamera(scene) {
  const cam = scene.cameras.main;
  cam.setZoom(RENDER_SCALE);
  cam.centerOn(W / 2, H / 2);
  cam.setBackgroundColor(COLORS.bg);
}

export function label(scene, x, y, str, opts = {}) {
  const { size = 14, color = COLORS.text, bold = false, align = 'left', origin = [0, 0], stroke = null, wrap = 0, lineSpacing = 2 } = opts;
  const style = {
    fontFamily: FONT,
    fontSize: `${size}px`,
    fontStyle: bold ? 'bold' : 'normal',
    color,
    align,
    resolution: 2,
    lineSpacing,
  };
  if (stroke) {
    style.stroke = stroke.color;
    style.strokeThickness = stroke.width;
  }
  if (wrap) style.wordWrap = { width: wrap, useAdvancedWrap: true };
  const t = scene.add.text(x, y, str, style);
  t.setOrigin(origin[0], origin[1]);
  return t;
}

// 텍스트가 바뀔 때만 다시 그리게 한다. (매 프레임 setText는 캔버스를 다시 만들어서 느려진다)
export function setIfChanged(textObj, str) {
  if (textObj.__last !== str) {
    textObj.__last = str;
    textObj.setText(str);
  }
}

// 좌상단 기준 버튼. 눌렀다 뗐을 때만 동작해서 모바일에서 오터치가 덜하다.
export function makeButton(scene, { x, y, w, h, label: text, onClick, size = 15, fill = 0x23232f, stroke = 0x4a4a5c, color = COLORS.text, bold = true }) {
  const c = scene.add.container(x, y);
  const bg = scene.add.rectangle(0, 0, w, h, fill).setOrigin(0, 0).setStrokeStyle(2, stroke);
  const t = label(scene, w / 2, h / 2, text, { size, color, bold, align: 'center', origin: [0.5, 0.5] });
  c.add([bg, t]);
  c.setSize(w, h);
  bg.setInteractive({ useHandCursor: true });

  const state = { enabled: true, pressed: false, fill, stroke };
  const paint = () => {
    if (!state.enabled) {
      bg.setFillStyle(0x16161d);
      bg.setStrokeStyle(2, 0x2a2a35);
      t.setAlpha(0.45);
      return;
    }
    t.setAlpha(1);
    bg.setFillStyle(state.pressed ? 0x3a3a50 : state.fill);
    bg.setStrokeStyle(2, state.pressed ? COLORS.gold : state.stroke);
  };

  bg.on('pointerdown', () => {
    state.pressed = true;
    paint();
  });
  bg.on('pointerup', () => {
    const fire = state.pressed && state.enabled;
    state.pressed = false;
    paint();
    if (fire) onClick();
  });
  bg.on('pointerout', () => {
    state.pressed = false;
    paint();
  });

  c.setLabel = (s) => setIfChanged(t, s);
  c.setEnabled = (b) => {
    if (state.enabled === b) return;
    state.enabled = b;
    paint();
  };
  c.setStyleColors = (f, s) => {
    state.fill = f;
    state.stroke = s;
    paint();
  };
  c.text = t;
  c.bg = bg;
  return c;
}
