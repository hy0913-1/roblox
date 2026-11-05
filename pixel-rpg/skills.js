// The hero's turn each frame: moving, aiming and casting. Every class skill and the airstrike live here.
//
// Aiming: a "dir" skill goes where the touch button was dragged, else at the mouse, else at the nearest enemy (or
// the way you face). A "point" skill lands where the button was dragged (a marker shows the spot while you drag),
// else at the mouse, else on the biggest crowd in range. A "self" skill just goes off.

import * as frostBolt from "./vendor/pixelfx/src/fx/rpg/frost-bolt.js";
import * as frostHit from "./vendor/pixelfx/src/fx/rpg/frost-hit.js";
import * as glacierRing from "./vendor/pixelfx/src/fx/rpg/glacier-ring.js";
import * as blinkFx from "./vendor/pixelfx/src/fx/rpg/blink.js";
import * as blizzardFx from "./vendor/pixelfx/src/fx/rpg/blizzard.js";
import * as swordArc from "./vendor/pixelfx/src/fx/rpg/sword-arc.js";
import * as spinSlash from "./vendor/pixelfx/src/fx/rpg/spin-slash.js";
import * as airBlast from "./vendor/pixelfx/src/fx/rpg/airstrike-blast.js";
import * as arrowFx from "./vendor/pixelfx/src/fx/rpg/arrow.js";
import * as arrowRain from "./vendor/pixelfx/src/fx/rpg/arrow-rain.js";
import * as fighterJet from "./vendor/pixelfx/src/fx/rpg/fighter-jet.js";
import * as strikeMarker from "./vendor/pixelfx/src/fx/rpg/strike-marker.js";
import { CLASSES, SKILLS, ENEMIES } from "./config.js";
import { G, addFx, hitEnemy, nearestEnemy, bestCluster, slide, blocked, faceFrom, camera, shake, drinkPotion, toast } from "./game.js";
import { sfx } from "./audio.js";

export const AIR = { spacing: 18, radius: 24, sy: 0.55, jetSpeed: 380, approach: 260, fall: 0.42, altitude: 46, bombs: 5 };
const GOLD_PAL = ["#2a1c08", "#9a6c18", "#d8a428", "#ffd84a", "#fff09a", "#ffffff"];
const EARTH_PAL = ["#2a1e14", "#6e4a28", "#b8732a", "#f2a03a", "#ffd27a", "#fff3c4", "#ffffff", "#ffffff"];

// which skill sits in each button: 0 the basic attack, 1-3 the class skills (once learned), 4 the airstrike
export function slotSkill(i) {
  const c = CLASSES[G.cls];
  if (i === 4) return G.keys?.radio ? "air" : null;
  const id = c.skills[i];
  return id && G.player.lv >= SKILLS[id].level ? id : null;
}
export function skillReady(id) {
  return id && (G.player.cds[id] ?? 0) <= 0 && G.player.mp >= SKILLS[id].mp;
}

function mouseWorld(input) {
  const [cx, cy] = camera();
  return { x: input.mouse.x + cx, y: input.mouse.y + cy + 8 };
}
const useMouse = (input) => !input.touch && input.mouse.over;

function aimDir(input, slot) {
  const p = G.player, ox = p.x, oy = p.y - 8, sl = input.slots[slot];
  const v = sl.aim ?? (sl.release && sl.release !== "auto" ? sl.release : null);
  if (v) return [v.x, v.y];
  if (useMouse(input)) {
    const m = mouseWorld(input), dx = m.x - ox, dy = m.y - 8 - oy, l = Math.hypot(dx, dy);
    if (l > 4) return [dx / l, dy / l];
  }
  const t = nearestEnemy(ox, oy, 170);
  if (t) {
    const dx = t.x - ox, dy = t.y - ENEMIES[t.type].hitY - t.z - oy, l = Math.hypot(dx, dy) || 1;
    return [dx / l, dy / l];
  }
  return [p.dx, p.dy];
}
function aimPoint(input, slot, range) {
  const p = G.player, sl = input.slots[slot];
  const v = sl.release && sl.release !== "auto" ? sl.release : null;
  let t = v ? { x: p.x + v.x * v.k * range, y: p.y + v.y * v.k * range * 0.8 } : useMouse(input) ? mouseWorld(input) : bestCluster(range);
  const d = Math.hypot(t.x - p.x, t.y - p.y);
  if (d > range) t = { x: p.x + ((t.x - p.x) / d) * range, y: p.y + ((t.y - p.y) / d) * range };
  return t;
}

// ---- the hero's frame ----------------------------------------------------------------------------
export function updateSkills(dt, input) {
  const p = G.player, s = G.stats;
  updateZones(dt);
  updateStrikes(dt);
  for (const d of G.dashes) d.t -= dt;
  G.dashes = G.dashes.filter((d) => d.t > 0);

  // a point skill being dragged on a touch screen: show where it will land
  let previewing = false;
  for (let i = 1; i <= 4; i++) {
    const id = slotSkill(i), sl = input.slots[i];
    if (id && SKILLS[id].aim === "point" && sl.aim && skillReady(id)) {
      const r = SKILLS[id].range, t = { x: p.x + sl.aim.x * sl.aim.k * r, y: p.y + sl.aim.y * sl.aim.k * r * 0.8 };
      if (!G.preview) G.preview = addFx(strikeMarker, { x: t.x, y: t.y, radius: SKILLS[id].radius ?? 28, palette: id === "air" ? undefined : ["#0c1430", "#1f4f94", "#3f8cff", "#7cc8ff", "#c8f0ff", "#ffffff"] });
      G.preview.fx.options.x = t.x;
      G.preview.fx.options.y = t.y;
      previewing = true;
    }
  }
  if (!previewing && G.preview) {
    G.preview.fx.stop();
    G.preview = null;
  }

  if (input.potion.hp) drinkPotion("hp");
  if (input.potion.mp) drinkPotion("mp");

  if (p.dash) {
    const d = p.dash;
    d.t -= dt;
    slide(p, d.vx * dt, d.vy * dt);
    G.dashes.push({ x: p.x, y: p.y, t: 0.25, face: p.face });
    for (const e of G.enemies)
      if (!e.dead && !d.hit.has(e) && Math.hypot(e.x - p.x, e.y - p.y) < 16) {
        d.hit.add(e);
        hitEnemy(e, d.dmg, d.vx * 0.3, d.vy * 0.3);
        addFx(frostHit, { x: e.x, y: e.y - 8, palette: GOLD_PAL, aim: Math.atan2(d.vy, d.vx) });
      }
    if (d.t <= 0) p.dash = null;
    p.moving = true;
    p.walk += dt * 2;
    return;
  }
  if (p.charge > 0) {
    p.charge -= dt;
    p.moving = false;
    if (p.charge <= 0) p.onCharge?.();
    return;
  }

  let ix = (input.key("KeyD", "ArrowRight") ? 1 : 0) - (input.key("KeyA", "ArrowLeft") ? 1 : 0);
  let iy = (input.key("KeyS", "ArrowDown") ? 1 : 0) - (input.key("KeyW", "ArrowUp") ? 1 : 0);
  let speed = 1;
  if (input.stick.x || input.stick.y) {
    ix = input.stick.x;
    iy = input.stick.y;
    speed = Math.min(1, Math.hypot(ix, iy)) * 0.5 + 0.5;
  }
  p.moving = ix !== 0 || iy !== 0;
  if (p.moving) {
    const l = Math.hypot(ix, iy);
    p.dx = ix / l;
    p.dy = iy / l;
    faceFrom(p, p.dx, p.dy);
    slide(p, p.dx * s.speed * speed * dt, p.dy * s.speed * speed * dt);
    p.walk += dt * speed;
  }
  if (G.scene.safe) return; // no fighting in the village

  // the basic attack fires while held
  const basic = slotSkill(0), sl0 = input.slots[0];
  if ((sl0.held || input.mouse.down) && skillReady(basic)) castSkill(basic, input, 0);
  // the others go off on a key, a tap, or letting go of a drag
  for (let i = 1; i <= 4; i++) {
    const id = slotSkill(i), sl = input.slots[i];
    if (!id || !(sl.keyTap || sl.release)) continue;
    if (!skillReady(id)) {
      if ((p.cds[id] ?? 0) <= 0) toast("MP가 부족해요", "#8ac8ff");
      continue;
    }
    castSkill(id, input, i);
  }
}

export function castSkill(id, input, slot) {
  const p = G.player, sk = SKILLS[id], atk = G.stats.atk;
  p.mp -= sk.mp;
  p.cds[id] = sk.cd * (id === "slash" || id === "arrow" || id === "bolt" ? 1 : 1);
  p.calm = 0;
  const dmg = atk * (sk.mult ?? 1);
  const dirCast = () => {
    const [ax, ay] = aimDir(input, slot);
    faceFrom(p, ax, ay);
    p.dx = ax;
    p.dy = ay;
    return [ax, ay, Math.atan2(ay, ax)];
  };
  switch (id) {
    case "bolt": {
      const [, , a] = dirCast();
      shoot({ x: p.x + Math.cos(a) * 8, y: p.y - 8 + Math.sin(a) * 8, ang: a, speed: 200, life: 0.8, dmg, fx: frostBolt, hitFx: frostHit, onHit: (e) => (e.frozen = Math.max(e.frozen, ENEMIES[e.type].boss ? 0 : 0.35)) });
      sfx.bolt();
      break;
    }
    case "arrow":
    case "pierce": {
      const [, , a] = dirCast(), pierce = id === "pierce";
      shoot({ x: p.x + Math.cos(a) * 8, y: p.y - 8 + Math.sin(a) * 8, ang: a, speed: pierce ? 320 : 260, life: pierce ? 0.9 : 0.75, dmg, fx: arrowFx, fxOpts: pierce ? { palette: GOLD_PAL.slice(1, 5), glow: 1 } : {}, pierce: pierce ? 99 : 0, size: pierce ? 2 : 0, hitFx: frostHit, hitPal: GOLD_PAL });
      pierce ? (sfx.crit(), shake(0.08)) : sfx.arrowShot();
      break;
    }
    case "fan": {
      const [, , a] = dirCast();
      for (let i = 0; i < 7; i++) {
        const ang = a + (i - 3) * 0.16;
        shoot({ x: p.x + Math.cos(ang) * 8, y: p.y - 8 + Math.sin(ang) * 8, ang, speed: 250, life: 0.6, dmg, fx: arrowFx, hitFx: frostHit, hitPal: GOLD_PAL });
      }
      sfx.arrowShot();
      break;
    }
    case "slash": {
      const [ax, ay, a] = dirCast();
      addFx(swordArc, { x: p.x, y: p.y - 8, angle: a, radius: 22 }, p).lift = 8;
      for (const e of G.enemies) {
        if (e.dead) continue;
        const dx = e.x - p.x, dy = e.y - ENEMIES[e.type].hitY - e.z - (p.y - 8), d = Math.hypot(dx, dy);
        if (d < sk.range + ENEMIES[e.type].rad && (dx * ax + dy * ay) / (d || 1) > 0.2) hitEnemy(e, dmg, ax * 60, ay * 60);
      }
      sfx.sword();
      break;
    }
    case "spin": {
      addFx(spinSlash, { x: p.x, y: p.y, radius: 30 }, p);
      for (const e of G.enemies) if (!e.dead && Math.hypot(e.x - p.x, (e.y - p.y) / 0.6) < sk.radius + ENEMIES[e.type].rad) hitEnemy(e, dmg, Math.sign(e.x - p.x) * 70, Math.sign(e.y - p.y) * 50);
      sfx.sword();
      shake(0.12);
      break;
    }
    case "dash": {
      const [ax, ay] = dirCast();
      p.dash = { vx: ax * sk.range / 0.18, vy: ay * sk.range / 0.18, t: 0.18, hit: new Set(), dmg };
      p.hurt = Math.max(p.hurt, 0.3);
      sfx.dash();
      break;
    }
    case "quake": {
      p.charge = 0.25;
      p.onCharge = () => {
        addFx(airBlast, { x: p.x, y: p.y, palette: EARTH_PAL, stone: "#6e5a40" });
        shake(0.35);
        sfx.slam();
        for (const e of G.enemies)
          if (!e.dead && Math.hypot(e.x - p.x, (e.y - p.y) / 0.6) < sk.radius + ENEMIES[e.type].rad) {
            hitEnemy(e, dmg, 0, 0);
            e.stun = ENEMIES[e.type].boss ? 0.5 : 1.6;
          }
      };
      break;
    }
    case "ring": {
      p.charge = 0.4;
      addFx(glacierRing, { x: p.x, y: p.y, reach: 52 });
      sfx.ultCharge();
      p.onCharge = () => {
        shake(0.3);
        G.hitstop = 0.05;
        sfx.ultBurst();
        for (const e of G.enemies)
          if (!e.dead && Math.hypot(e.x - p.x, (e.y - p.y) / 0.62) < 56) {
            e.frozen = ENEMIES[e.type].boss ? 1 : 2.6;
            hitEnemy(e, dmg);
          }
      };
      break;
    }
    case "blink": {
      const [ax, ay] = dirCast();
      addFx(blinkFx, { x: p.x, y: p.y });
      let moved = 0;
      while (moved < sk.range && !blocked(p.x + ax * 4, p.y + ay * 4)) {
        p.x += ax * 4;
        p.y += ay * 4;
        moved += 4;
      }
      addFx(blinkFx, { x: p.x, y: p.y });
      p.hurt = Math.max(p.hurt, 0.25);
      sfx.blink();
      break;
    }
    case "blizzard": {
      const t = aimPoint(input, slot, sk.range);
      const z = { x: t.x, y: t.y, r: sk.radius, t: 4, every: 0.5, tick: 0.2, dmg, slow: true };
      z.fx = addFx(blizzardFx, { x: t.x, y: t.y, radius: sk.radius });
      G.zones.push(z);
      sfx.ultCharge();
      break;
    }
    case "rain": {
      const t = aimPoint(input, slot, sk.range);
      addFx(arrowRain, { x: t.x, y: t.y, radius: sk.radius });
      G.zones.push({ x: t.x, y: t.y, r: sk.radius, t: 1.0, every: 0.15, tick: 0.3, dmg });
      sfx.arrowShot();
      break;
    }
    case "air": {
      const t = aimPoint(input, slot, sk.range);
      callAirstrike(t.x, t.y, dmg);
      break;
    }
  }
}

function shoot(o) {
  const pr = { owner: "player", x: o.x, y: o.y, vx: Math.cos(o.ang) * o.speed, vy: Math.sin(o.ang) * o.speed, ang: o.ang, life: o.life, dmg: o.dmg, pierce: o.pierce ?? 0, size: o.size ?? 0, hitSet: new Set(), hitFx: o.hitFx, hitPal: o.hitPal, onHit: o.onHit };
  pr.fx = addFx(o.fx, { x: pr.x, y: pr.y, angle: o.ang, ...(o.fxOpts ?? {}) }, pr);
  G.projectiles.push(pr);
}

// ground effects that hurt on a timer: the blizzard, the arrow rain
function updateZones(dt) {
  for (const z of G.zones) {
    z.t -= dt;
    z.tick -= dt;
    if (z.tick <= 0 && z.t > 0) {
      z.tick += z.every;
      for (const e of G.enemies)
        if (!e.dead && Math.hypot(e.x - z.x, (e.y - z.y) / 0.58) < z.r + ENEMIES[e.type].rad) {
          hitEnemy(e, z.dmg);
          if (z.slow) e.slow = 0.8;
        }
    }
  }
  for (const z of G.zones) if (z.t <= 0 && z.fx) z.fx.fx.stop();
  G.zones = G.zones.filter((z) => z.t > 0);
}

// ---- the airstrike -------------------------------------------------------------------------------
function callAirstrike(tx, ty, dmg) {
  const p = G.player;
  let ux = tx - p.x, uy = ty - p.y, l = Math.hypot(ux, uy);
  if (l < 8) (ux = p.dx), (uy = p.dy), (l = Math.hypot(ux, uy) || 1);
  ux /= l;
  uy /= l;
  const n = AIR.bombs, bombs = [];
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * AIR.spacing;
    bombs.push({ x: tx + ux * off, y: ty + uy * off, tHit: (AIR.approach + off) / AIR.jetSpeed, state: "wait" });
  }
  const st = { tx, ty, ux, uy, t: 0, bombs, dmg, jx: tx - ux * AIR.approach, jy: ty - uy * AIR.approach, angle: Math.atan2(uy, ux) };
  st.marker = addFx(strikeMarker, { x: tx, y: ty, radius: 18 + n * 4 });
  st.jet = addFx(fighterJet, { x: st.jx, y: st.jy - AIR.altitude, angle: st.angle });
  G.strikes.push(st);
  sfx.jet();
}
function updateStrikes(dt) {
  for (const st of G.strikes) {
    st.t += dt;
    st.jx = st.tx - st.ux * AIR.approach + st.ux * AIR.jetSpeed * st.t;
    st.jy = st.ty - st.uy * AIR.approach + st.uy * AIR.jetSpeed * st.t;
    st.jet.fx.options.x = st.jx;
    st.jet.fx.options.y = st.jy - AIR.altitude;
    for (const b of st.bombs) {
      if (b.state === "wait" && st.t >= b.tHit - AIR.fall) b.state = "fall";
      if (b.state === "fall") {
        b.k = Math.max(0, (b.tHit - st.t) / AIR.fall);
        if (st.t >= b.tHit) {
          b.state = "done";
          addFx(airBlast, { x: b.x, y: b.y });
          shake(0.22);
          sfx.boom();
          for (const e of G.enemies) {
            if (e.dead) continue;
            const dx = e.x - b.x, dy = (e.y - b.y) / AIR.sy, d = Math.hypot(dx, dy);
            if (d < AIR.radius + ENEMIES[e.type].rad) hitEnemy(e, st.dmg, (dx / (d || 1)) * 60, (dy / (d || 1)) * 40);
          }
        }
      }
    }
    if (st.bombs.every((b) => b.state === "done")) st.marker.fx.stop();
    if (st.t > (AIR.approach * 2) / AIR.jetSpeed + 0.2) {
      st.jet.fx.stop();
      st.done = true;
    }
  }
  G.strikes = G.strikes.filter((st) => !st.done);
}
