import { Particles, Bits, Lights, P, B, Rng, PAL, fit, band, crystal, flare, clamp, smooth, seg, ease, WHITE, TAU } from "../../core/index.js";

export const meta = {
  name: "Glacier ring",
  desc: "A top-down ultimate: a frost sigil spins open and the cold streams in, a flash throws a ring of ice across the floor, three rows of crystals punch up, then it melts.",
  tags: ["rpg", "ice", "ultimate", "aoe", "nova", "magic", "one-shot"],
  size: [192, 136],
  origin: [96, 80],
  duration: 3.7,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: PAL.ice, reach: 56, seed: 11 },
};

const CHARGE = 0.4, SPREAD = 0.5, HOLD = 1.75, MELT = 0.75, CORE_Y = -14, SY = 0.62;
const RINGS = [
  { q: [0.34, 0.4], h: [17, 22], w: [8, 10], n: 5, kids: 2 },
  { q: [0.54, 0.64], h: [10, 14], w: [5, 7], n: 8, kids: 1 },
  { q: [0.78, 0.93], h: [5, 8], w: [3.5, 5], n: 13, kids: 0 },
];

// a hexagram lying on the floor plane
function sigil(p, C, r, spin, a) {
  if (r < 3 || a <= 0) return;
  const pts = Array.from({ length: 6 }, (_, i) => [Math.cos(spin + (i * TAU) / 6) * r, Math.sin(spin + (i * TAU) / 6) * r * SY]);
  for (const tri of [[0, 2, 4], [1, 3, 5]])
    for (let i = 0; i < 3; i++) {
      const A = pts[tri[i]], B2 = pts[tri[(i + 1) % 3]];
      p.line(A[0], A[1], B2[0], B2[1], i === 0 ? WHITE : C[6], a);
    }
  band(p, 0, 0, r * 1.08, SY, 1.8, a, C);
  p.glow(0, 0, r * 1.5, C[4], 0.3 * a);
}

export function create(o) {
  const C = fit(o.palette, 8), DIM = [C[0], C[0], C[1], C[2], C[3], C[4], C[5], C[6]], REACH = o.reach;
  const R = new Rng(o.seed), floor = () => 0;
  const ps = new Particles({ rng: R, ground: floor, sparks: [C[7], C[6], C[5], C[4]], haze: C[5] });
  const bits = new Bits({ ground: floor }), lights = new Lights();
  const front = (t) => (t < CHARGE ? 0 : REACH * (1 - Math.pow(1 - clamp((t - CHARGE) / SPREAD), 3)));
  const reachedAt = (d) => CHARGE + SPREAD * (1 - Math.cbrt(1 - Math.min(1, d / REACH)));

  const sites = [];
  RINGS.forEach((ring, ri) => {
    const off = R.range(0, TAU);
    for (let i = 0; i < ring.n; i++) {
      const a = off + ((i + R.range(0.15, 0.85)) / ring.n) * TAU, q = R.range(...ring.q), h = R.range(...ring.h), w = R.range(...ring.w);
      const x = Math.cos(a) * q * REACH, y = Math.sin(a) * q * REACH * SY, side = x < 0 ? -1 : 1;
      const parts = [{ dx: 0, h, w, lean: side * h * R.range(0.08, 0.22) }];
      for (let k = 0; k < ring.kids; k++) {
        const s = k % 2 ? -side : side, kh = h * R.range(0.4, 0.6);
        parts.unshift({ dx: s * R.range(0.3, 0.5) * w, h: kh, w: w * 0.62, lean: s * kh * R.range(0.3, 0.55) });
      }
      sites.push({ x, y, d: q * REACH, h, parts, t0: reachedAt(q * REACH) + R.range(0, 0.03), up: false, phase: R.next() });
    }
  });
  sites.sort((a, b) => a.y - b.y);
  let t = 0, released = false;
  const sink = (tt) => smooth(HOLD, HOLD + MELT, tt);

  const drawCrystals = (p, back) => {
    const m = sink(t);
    for (const s of sites) {
      if (!s.up || m >= 1 || s.y < -1 !== back) continue;
      const g = ease.outBack(clamp((t - s.t0) / 0.1), 2.6), white = t < s.t0 + 0.03, sw = (((t - s.t0) * 0.7 + s.phase * 3) % 1.6) / 0.5;
      for (const q of s.parts)
        crystal(p, s.x + q.dx, s.y, q.h * g * (1 - m), q.w * (1 - m * 0.3), q.lean * g * (1 - m), back ? DIM : C, { white, glint: sw <= 1 ? sw : -1 });
    }
  };
  const ring = (p, back) => {
    if (t < CHARGE) return;
    const u = clamp((t - CHARGE) / (SPREAD + 0.15));
    if (u >= 1) return;
    band(p, 0, 0, front(t) + 2, SY, Math.max(2, 9 * Math.pow(1 - u, 0.7)), u < 0.75 ? 1 : (1 - u) / 0.25, C, (g) => Math.sin(g) < 0 === back, t - CHARGE < 0.1);
  };
  // frost over the floor inside the wave: a white crust at the rim, pale and then cold blue towards the middle
  const frost = (p, fr, out) => {
    const rx = Math.max(6, fr + 1), ry = rx * SY;
    for (let y = Math.floor(-ry); y <= ry; y++)
      for (let x = Math.floor(-rx); x <= rx; x++) {
        const e = Math.hypot((x + 0.5) / rx, (y + 0.5) / ry);
        if (e > 1) continue;
        const h = ((x * 73856093) ^ (y * 19349663)) >>> 0, r1 = (h % 1000) / 1000;
        if (e > 0.93) p.dot(x, y, r1 < 0.5 ? WHITE : C[6], 0.9 * out);
        else {
          p.blend(x, y, e > 0.55 ? C[5] : C[4], out * (0.08 + 0.2 * e * e));
          if (r1 < 0.03) p.dot(x, y, WHITE, out * 0.9);
        }
      }
  };

  return {
    update(dt) {
      t += dt;
      if (t < CHARGE - 0.06) {
        // the cold gathers: streaks spiral in to the caster's chest, vapour slides in along the floor
        if (R.chance(0.9)) {
          const a = R.range(0, TAU), D = R.range(28, 60), T = R.range(0.2, 0.3), v = (D * 3) / (Math.exp(3 * T) - 1);
          const x = Math.cos(a) * D, y = Math.min(CORE_Y + Math.sin(a) * D * 0.8, -2), l = Math.hypot(x, y - CORE_Y) || 1;
          ps.spawn(P.STREAK, x, y, (-x / l) * v, ((CORE_Y - y) / l) * v, T, R.chance(0.5) ? C[6] : C[5]);
        }
        if (R.chance(0.16)) {
          const a = R.range(0, TAU);
          ps.spawn(P.VAPOUR, Math.cos(a) * 44, Math.sin(a) * 44 * SY, -Math.cos(a) * 55, -Math.sin(a) * 55 * SY, R.range(0.35, 0.5), C[6], R.range(2, 3));
        }
      }
      if (t >= CHARGE && !released) {
        released = true;
        lights.add(0, CORE_Y, 96, C[4], 0.85, 0.6);
        lights.add(0, CORE_Y, 50, WHITE, 0.8, 0.14);
        for (let i = 0; i < 26; i++) {
          const a = R.range(0, TAU), sp = R.range(90, 250);
          bits.add({ kind: B.SHARD, x: R.range(-3, 3), y: CORE_Y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.5 - R.range(30, 130), g: 0.7, drag: 0.6, bounce: 0.3, life: R.range(0.9, 1.5), a: R.range(0, TAU), va: R.range(-20, 20), s: R.range(1.5, 3.5), c: R.pick([C[7], C[6], C[5]]) });
        }
        for (let i = 0; i < 14; i++) {
          const a = R.range(0, TAU), sp = R.range(30, 130);
          ps.spawn(P.FLAKE, 0, CORE_Y, Math.cos(a) * sp, Math.sin(a) * sp * 0.5 - 40, R.range(1.2, 1.8), R.chance(0.6) ? WHITE : C[6], R.range(0.5, 1.6));
        }
      }
      const fr = front(t);
      if (t > CHARGE && t < CHARGE + SPREAD) {
        for (let k = 0; k < 2; k++) {
          const a = R.range(0, TAU), ca = Math.cos(a), sa = Math.sin(a);
          ps.spawn(P.VAPOUR, ca * fr, sa * fr * SY, ca * R.range(15, 70), sa * R.range(15, 70) * SY - R.range(2, 10), R.range(0.6, 1), R.chance(0.7) ? C[6] : C[5], R.range(3, 5.5) * (1 - 0.4 * (fr / REACH)));
        }
        if (R.chance(0.6)) {
          const a = R.range(0, TAU);
          ps.spawn(P.FLAKE, Math.cos(a) * fr, Math.sin(a) * fr * SY - 2, 0, -R.range(25, 80), R.range(1.1, 1.9), R.chance(0.5) ? WHITE : C[6], R.range(0.5, 1.2));
        }
      }
      for (const s of sites) {
        if (!s.up && t >= s.t0) {
          s.up = true;
          for (let i = 0; i < 2 + Math.round(s.h / 8); i++) {
            const a = -Math.PI / 2 + R.range(-1.3, 1.3), sp = R.range(60, 200) * (0.5 + s.h / 40);
            bits.add({ kind: B.SHARD, x: s.x + R.range(-3, 3), y: s.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0.8, drag: 0.6, bounce: 0.3, life: R.range(0.9, 1.6), a: R.range(0, TAU), va: R.range(-18, 18), s: R.range(1.5, 3), c: R.pick([C[7], C[6], C[5]]) });
          }
          ps.spawn(P.VAPOUR, s.x, s.y - 1, R.range(-30, 30), -R.range(2, 8), R.range(0.5, 0.9), C[6], R.range(2.5, 4));
          if (s.h > 10) ps.spawn(P.STAR, s.x + R.range(-3, 3), s.y - R.range(4, s.h * 0.8), 0, -3, R.range(0.3, 0.6), C[6], R.range(1, 2.4));
        }
      }
      if (t > CHARGE + 0.2 && t < HOLD + 0.2) {
        if (R.chance(0.5)) {
          const s = R.pick(sites);
          if (s.up) ps.spawn(P.STAR, s.x + R.range(-3, 3), s.y - R.range(2, s.h * 0.9), 0, -3, R.range(0.3, 0.6), R.chance(0.6) ? C[6] : WHITE, R.range(0.6, 2.2));
        }
        if (t < HOLD - 0.3 && R.chance(0.2)) {
          const a = R.range(0, TAU), d = Math.sqrt(R.next()) * fr;
          ps.spawn(P.FLAKE, Math.cos(a) * d, Math.sin(a) * d * SY - R.range(40, 80), R.range(-5, 5), R.range(4, 12), R.range(1.1, 1.5), R.chance(0.5) ? WHITE : C[6], R.range(0.5, 1.4));
        }
      }
      if (t > HOLD && t < HOLD + MELT) {
        if (R.chance(0.5)) {
          const s = R.pick(sites);
          bits.add({ kind: B.DRIP, x: s.x + R.range(-3, 3), y: s.y - R.range(3, s.h * 0.6 * (1 - sink(t))), vy: 10, g: 0.6, life: 1, c: C[5] });
        }
        if (t < HOLD + MELT - 0.25 && R.chance(0.3)) {
          const a = R.range(0, TAU), d = Math.sqrt(R.next()) * REACH * 0.85;
          ps.spawn(P.VAPOUR, Math.cos(a) * d, Math.sin(a) * d * SY, R.range(-8, 8), -R.range(6, 16), R.range(0.6, 1), C[5], R.range(3, 5));
        }
      }
      ps.update(dt);
      bits.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      const out = 1 - smooth(HOLD + 0.2, HOLD + MELT + 0.6, t), fr = front(t);
      if (out > 0 && t > CHARGE) frost(p, fr, out);
      if (t < CHARGE) {
        const k = t / CHARGE;
        sigil(p, C, 8 + 24 * ease.outQuart(k), -k * 3.5, Math.min(1, k * 4) * (1 - smooth(0.9, 1, k)));
      }
      ring(p, true);
      drawCrystals(p, true);
      ps.draw(p, "back");
    },
    draw(p) {
      ring(p, false);
      drawCrystals(p, false);
      if (t < CHARGE) {
        // the gathered core brightens at the chest and beats twice before it goes
        const k = t / CHARGE, beat = 1 + 0.3 * Math.exp(-((t - CHARGE * 0.55) ** 2) / 0.002) + 0.35 * Math.exp(-((t - CHARGE * 0.85) ** 2) / 0.002);
        p.circle(0, CORE_Y, (1 + 3 * k * k) * beat, WHITE);
        p.glow(0, CORE_Y, 14 + 22 * k, C[5], 0.3 + 0.5 * k);
      } else if (t < CHARGE + 0.24) {
        const a = (t - CHARGE) / 0.24;
        flare(p, 0, CORE_Y, 40 * Math.pow(1 - a, 1.5), 1 - a, C);
        p.glow(0, CORE_Y, 52, WHITE, 0.6 * (1 - a));
      }
      if (t > CHARGE) {
        const k = (1 - smooth(HOLD, HOLD + MELT + 0.3, t)) * (0.85 + 0.15 * Math.sin(t * 2.4)), fr = front(t);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU + 0.3;
          p.glow(Math.cos(a) * fr * 0.6, Math.sin(a) * fr * 0.6 * SY - 3, 24, C[4], 0.14 * k);
        }
        p.glow(0, 0, fr * 0.9 + 10, C[4], 0.1 * k);
      }
      bits.draw(p);
      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}
