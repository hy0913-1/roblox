// The particle recipe (fire puffs that cool into smoke, sparks, embers, grit, rocks, scorch) is adapted from
// Sprite Fusion's open-source explosion (https://www.spritefusion.com/pixel-art-vfx/explosion), MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Bits, Lights, P, PF, B, Rng, fit, band, clamp, smooth, ease, rand, TAU, WHITE, hex, mix, scale, rgb } from "../../core/index.js";

export const meta = {
  name: "Airstrike blast",
  desc: "A bomb hitting the ground, seen from above at 3/4: white flash, a fireball that rolls into smoke, a floor shock ring, sparks, rocks and a glowing scorch.",
  tags: ["rpg", "explosion", "airstrike", "bomb", "fire", "one-shot"],
  size: [136, 136],
  origin: [68, 100],
  duration: 3.6,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#4a1712", "#c9281f", "#f2561d", "#ff8a2a", "#ffc23d", "#ffe26b", "#fff3a6", "#ffffff"], stone: "#5a4a3a", seed: 7 },
};

const SY = 0.55, RAD = 10, SOOT = hex("#14100e"), SOOT2 = hex("#221a16"), OUTLINE = hex("#1a1422"), WARM = rgb(255, 176, 96);

function stone(c) {
  c = hex(c);
  return { light: mix(scale(c, 1.35), WHITE, 0.08), body: c, shade: scale(c, 0.64), dust: mix(scale(c, 1.2), rgb(150, 140, 130), 0.35) };
}

// the floor under the blast, an ellipse: white-hot, cooling through the fire ramp to soot
function scorch(p, F, t, rx0, fade) {
  if (fade <= 0) return;
  const rx = rx0 * Math.min(1, t / 0.08), ry = rx * SY, heat = [...F].reverse();
  for (let y = Math.floor(-ry); y <= Math.ceil(ry); y++)
    for (let x = Math.floor(-rx); x <= Math.ceil(rx); x++) {
      const d = Math.hypot((x + 0.5) / rx, (y + 0.5) / ry);
      if (d > 1) continue;
      const k = rand(x * 31 + y * 7, 3), T = Math.pow(clamp(1 - t / 1.1), 1.4) * (1.25 - d) - k * 0.35;
      if (T > 0.06) {
        const c = heat[Math.min(heat.length - 1, Math.floor((1 - Math.min(1, T)) * (heat.length - 1)))];
        p.dot(x, y, c, fade);
        if (((x | y) & 3) === 0) p.glow(x + 0.5, y, 6, c, 0.18 * T * fade);
      } else p.dot(x, y, d < 0.55 ? SOOT : SOOT2, (d < 0.95 - k * 0.3 ? 0.9 : 0.9 - d * 0.6) * fade);
    }
}

function rock(p, b, st) {
  const r = 0.5 + b.s * 0.6, fade = Math.min(1, b.life / 0.4), lx = Math.cos(b.a) * r * 0.4, ly = Math.sin(b.a) * r * 0.4;
  p.shade(b.x - r - 1, b.y - r - 1, b.x + r + 1, b.y + r + 1, (x, y, out) => {
    const dx = x - b.x, dy = y - b.y, d = Math.hypot(dx * 1.15, dy);
    if (d > r + 0.9) return;
    const lit = dx * lx + dy * ly;
    out.c = d > r ? OUTLINE : lit < -0.4 ? st.light : lit > 0.6 ? st.shade : st.body;
    out.a = fade;
  });
}

export function create(o) {
  const F = fit(o.palette, 8), st = stone(o.stone), R = new Rng(o.seed), floor = () => 0;
  const ps = new Particles({ rng: R, ground: floor, sparks: [F[6], F[5], F[3], F[2]] });
  const rocks = new Bits({ ground: floor }), lights = new Lights(), Y = -RAD * 0.45;
  let t = 0, flash = 0.07, ring = 0.32;

  lights.add(0, Y, RAD * 4.5, WARM, 0.65, 0.6);
  lights.add(0, Y, RAD * 2, WHITE, 0.6, 0.08);
  for (let i = 0; i < 4; i++) ps.spawn(P.FIRE, R.range(-2, 2), Y + R.range(-2, 2), R.range(-15, 15), R.range(-30, -8), R.range(0.16, 0.26), 0, R.range(RAD * 0.45, RAD * 0.6));
  for (let i = 0; i < 18; i++) {
    const a = R.range(0, TAU), d = R.range(0, RAD * 0.5), sp = R.range(30, 150);
    ps.spawn(P.FIRE, Math.cos(a) * d, Y + Math.sin(a) * d * SY, Math.cos(a) * sp, Math.sin(a) * sp * SY - 35, R.range(0.45, 0.9), 0, R.range(RAD * 0.25, RAD * 0.5), 0, R.chance(0.45) ? PF.SMOKES | PF.BIG : 0);
  }
  for (let i = 0; i < 4; i++) ps.spawn(P.FIRE, R.range(-RAD * 0.25, RAD * 0.25), Y, R.range(-10, 10), R.range(-140, -80), R.range(0.6, 1), 0, R.range(RAD * 0.28, RAD * 0.38), R.range(0, 0.08), PF.SMOKES | PF.BIG);
  for (let i = 0; i < 7; i++) {
    const a = R.range(0, TAU), d = R.range(0, RAD * 0.7), sp = R.range(10, 60);
    ps.spawn(P.SMOKE, Math.cos(a) * d, Y + Math.sin(a) * d * SY, Math.cos(a) * sp, Math.sin(a) * sp * 0.4 - 28, R.range(1.3, 2), 0, R.range(RAD * 0.3, RAD * 0.5), R.range(0.1, 0.35), PF.BIG);
  }
  for (let i = 0; i < 36; i++) {
    const a = R.range(0, TAU), sp = R.range(110, 300);
    ps.spawn(P.SPARK, 0, Y, Math.cos(a) * sp, Math.sin(a) * sp * 0.7 - 70, R.range(0.15, 0.5));
  }
  for (let i = 0; i < 12; i++) {
    const a = R.range(0, TAU), sp = R.range(20, 100);
    ps.spawn(P.EMBER, Math.cos(a) * RAD * 0.4, Y + Math.sin(a) * RAD * 0.3, Math.cos(a) * sp, Math.sin(a) * sp * 0.5 - 60, R.range(0.9, 1.8), F[3]);
  }
  // dust rolling out along the floor in every direction (3/4 view, so flattened), rocks and grit thrown up
  for (let i = 0; i < 9; i++) {
    const a = R.range(0, TAU);
    ps.spawn(P.SMOKE, Math.cos(a) * RAD * 0.5, Math.sin(a) * RAD * 0.5 * SY, Math.cos(a) * R.range(40, 90), Math.sin(a) * R.range(40, 90) * SY - R.range(2, 8), R.range(0.9, 1.5), st.dust, R.range(4, 6.5), R.range(0, 0.05), PF.BIG);
  }
  for (let i = 0; i < 12; i++)
    rocks.add({ kind: B.CHUNK, x: R.range(-0.4, 0.4) * RAD, y: -2, vx: R.range(-1, 1) * RAD * 9, vy: -R.range(7, 14) * RAD * 0.9, g: 1, drag: 0.4, bounce: 0.3, life: R.range(1.2, 1.9), a: R.range(0, TAU), va: R.range(-16, 16), s: R.int(1, 3) });
  for (let i = 0; i < 26; i++) {
    const u = R.range(-1, 1), a = -Math.PI / 2 + u * 0.6, sp = R.range(5, 13) * RAD * (1 - 0.4 * Math.abs(u));
    ps.spawn(P.GRIT, u * 0.3 * RAD, -1, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.9, 1.6), R.pick([st.light, st.body, st.body, st.shade]), R.chance(0.45) ? 2 : 1);
  }

  return {
    update(dt) {
      t += dt;
      flash -= dt;
      ring -= dt;
      rocks.update(dt);
      for (const b of rocks.list)
        if (b.rest && !b.dusted) {
          b.dusted = true;
          ps.spawn(P.DUST, b.x, -0.5, R.sign() * R.range(10, 35), -R.range(2, 15), R.range(0.3, 0.6), st.dust, R.range(1.2, 2.4));
        }
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      scorch(p, F, t, RAD * 1.5, 1 - smooth(meta.duration - 1.1, meta.duration - 0.15, t));
      ps.draw(p, "back");
      const k = t / 0.45;
      if (k < 1) band(p, 0, 0, RAD * 4.2 * ease.outCubic(k), SY, Math.max(1, 3.4 * (1 - k)), 1.15 - k, [st.body, st.light, F[3], F[6]], (g) => Math.sin(g) < 0);
    },
    draw(p) {
      const k = t / 0.45;
      if (k < 1) band(p, 0, 0, RAD * 4.2 * ease.outCubic(k), SY, Math.max(1, 3.4 * (1 - k)), 1.15 - k, [st.body, st.light, F[3], F[6]], (g) => Math.sin(g) >= 0);
      for (const b of rocks.list) rock(p, b, st);
      ps.draw(p, "front");
      if (flash > 0) {
        const k2 = flash / 0.07, r = RAD * 1.15 * (0.8 + 0.2 * k2);
        p.circle(0, Y, r + 1.2, F[2]);
        p.circle(0, Y, r, k2 > 0.45 ? F[6] : F[5]);
        p.circle(0, Y, r * 0.6, k2 > 0.45 ? WHITE : F[6]);
      }
      if (ring > 0) {
        const k2 = ring / 0.32, e = 1 - Math.pow(k2, 3);
        p.ring(0, Y, RAD * 0.5 + RAD * 2.2 * e, Math.max(1, 2.4 * k2 + 0.4), F[5], Math.min(1, k2 * 1.6));
      }
      lights.draw(p);
    },
  };
}
