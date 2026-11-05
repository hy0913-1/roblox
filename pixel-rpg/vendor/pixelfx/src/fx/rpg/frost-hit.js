import { Particles, Bits, Lights, P, B, Rng, PAL, fit, flare, sparkle, seg, smooth, clamp, ease, WHITE, TAU } from "../../core/index.js";

export const meta = {
  name: "Frost hit",
  desc: "A frost bolt landing: white flare, a thin ring of cold, sparks and tumbling shards in a fan, a six-armed snowflake that spins open, flakes settling.",
  tags: ["rpg", "ice", "impact", "hit", "magic", "one-shot"],
  size: [144, 80],
  origin: [72, 44],
  duration: 1.2,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: PAL.ice, seed: 7, aim: 0 },
};

function snowflake(p, C, L, spin, a) {
  if (L < 1) return;
  for (let i = 0; i < 6; i++) {
    const ang = spin + (i * TAU) / 6, ca = Math.cos(ang), sa = Math.sin(ang);
    for (let d = 0; d <= L; d += 0.5) p.dot(ca * d, sa * d, d < L * 0.45 ? WHITE : C[6], a);
    if (L > 4)
      for (const s of [-1, 1]) {
        const bx = ca * L * 0.62, by = sa * L * 0.62, ba = ang + s * 0.85;
        for (let d = 0; d <= L * 0.32; d += 0.5) p.dot(bx + Math.cos(ba) * d, by + Math.sin(ba) * d, C[5], a * 0.9);
      }
  }
  p.px(0, 0, WHITE);
}

export function create(o) {
  const C = fit(o.palette, 8), R = new Rng(o.seed), floor = () => 20, aim = o.aim;
  const ps = new Particles({ rng: R, ground: floor, sparks: [C[7], C[6], C[5], C[4]], haze: C[5] });
  const bits = new Bits({ ground: floor }), lights = new Lights();
  lights.add(0, 0, 60, C[4], 0.8, 0.5);
  lights.add(0, 0, 32, WHITE, 0.8, 0.1);
  // a fan of sparks along the blow, a few going back the other way
  for (let i = 0; i < 22; i++) {
    const a = aim + R.range(-1.2, 1.2) + (R.chance(0.28) ? Math.PI : 0), sp = R.range(110, 270);
    ps.spawn(P.SPARK, R.range(-2, 2), R.range(-2, 2), Math.cos(a) * sp, Math.sin(a) * sp - 30, R.range(0.25, 0.6));
  }
  for (let i = 0; i < 11; i++) {
    const a = R.range(0, TAU), sp = R.range(70, 190);
    bits.add({ kind: B.SHARD, x: 0, y: 0, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 70, g: 0.8, drag: 0.6, bounce: 0.35, life: R.range(0.6, 1), a: R.range(0, TAU), va: R.range(-22, 22), s: R.range(1.5, 3.2), c: R.pick([C[7], C[6], C[5]]) });
  }
  for (let i = 0; i < 12; i++) {
    const a = R.range(0, TAU), sp = R.range(14, 70);
    ps.spawn(P.FLAKE, 0, -2, Math.cos(a) * sp, Math.sin(a) * sp * 0.6 - 18, R.range(0.7, 1), R.chance(0.6) ? WHITE : C[6], R.range(0.5, 1.4), R.range(0, 0.1));
  }
  for (const s of [-1, 1]) ps.spawn(P.VAPOUR, s * 5, 0, s * R.range(20, 45), -R.range(4, 14), R.range(0.45, 0.7), C[6], R.range(3, 4.5));
  let t = 0, glinted = 0;
  return {
    update(dt) {
      t += dt;
      // glints wink on the shards while they settle
      if (t > 0.18 && t < 0.6 && R.chance(0.35)) ps.spawn(P.STAR, R.range(-26, 26), R.range(-8, 18), 0, -4, R.range(0.2, 0.4), R.chance(0.5) ? WHITE : C[6], R.range(0.8, 1.8));
      ps.update(dt);
      bits.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      // frost the impact leaves on the floor, dry and bright, thinning away
      const k = seg(t, 0.06, 0.3), out = 1 - smooth(0.55, 0.95, t);
      if (k > 0 && out > 0) {
        const r = 4 + 16 * ease.outQuart(k);
        for (let i = 0; i < 26; i++) {
          const a = (i / 26) * TAU, rr = r * (0.55 + 0.45 * Math.sin(i * 12.9898) ** 2);
          const x = Math.cos(a) * rr, y = 20 + Math.sin(a) * rr * 0.4;
          p.dot(Math.round(x), Math.round(y), i % 3 ? C[6] : WHITE, out);
          if (rr > r * 0.7) p.dot(Math.round(x * 0.7), Math.round(20 + (y - 20) * 0.7), C[5], out * 0.7);
        }
      }
      ps.draw(p, "back");
    },
    draw(p) {
      // hero frame: a white diamond and an eight-ray flare that collapses
      if (t < 0.22) {
        const k = t / 0.22;
        flare(p, 0, 0, 30 * Math.pow(1 - k, 1.6), 1 - k, C);
        if (t < 0.07) p.poly([[0, -9], [6.5, 0], [0, 9], [-6.5, 0]], WHITE);
      }
      // the ring: thin, fast, bright then pale
      if (t < 0.3) {
        const k = t / 0.3, r = 5 + 27 * ease.outQuart(k);
        p.arc(0, 0, r, Math.max(0.9, 3.4 * (1 - k)), 0, TAU, k < 0.35 ? C[7] : C[5], 1 - k * 0.75);
      }
      // a snowflake spins open, hangs a beat, thins out
      if (t > 0.05 && t < 0.6) {
        const k = seg(t, 0.05, 0.6), L = 15 * ease.outBack(clamp(k * 3.5), 1.8) * (1 - smooth(0.6, 1, k));
        snowflake(p, C, L, k * 1.3, 1 - k * 0.45);
        p.glow(0, 0, 8 + L * 2, C[5], 0.3 * (1 - k));
      }
      bits.draw(p);
      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}
