// The hero's turn each frame: moving, aiming and casting. Every class skill, job skill and the airstrike.
//
// Slots: 0 basic attack (fires while held), 1-3 class skills (levels 1/3/5), 4 the 2nd-job skill, 5 the 3rd-job
// skill, 6 the airstrike. Aiming: a "dir" skill goes where the touch button was dragged, else at the mouse, else at
// the nearest enemy; a "point" skill lands where it was dragged (a marker shows the spot), else at the mouse, else
// on the biggest crowd in range; a "self" skill just goes off.

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
import * as shuriken from "./vendor/pixelfx/src/fx/rpg/shuriken.js";
import * as iceLance from "./vendor/pixelfx/src/fx/ice/ice-lance.js";
import * as frostNova from "./vendor/pixelfx/src/fx/ice/frost-nova.js";
import * as fireball from "./vendor/pixelfx/src/fx/fire/fireball.js";
import * as meteorFx from "./vendor/pixelfx/src/fx/fire/meteor.js";
import * as rageFx from "./vendor/pixelfx/src/fx/status/rage.js";
import * as heavyCleave from "./vendor/pixelfx/src/fx/melee/heavy-cleave.js";
import * as divineShield from "./vendor/pixelfx/src/fx/holy/divine-shield.js";
import * as smite from "./vendor/pixelfx/src/fx/holy/smite.js";
import * as tornado from "./vendor/pixelfx/src/fx/nature/tornado.js";
import * as lightning from "./vendor/pixelfx/src/fx/lightning/lightning-strike.js";
import * as daggerFlurry from "./vendor/pixelfx/src/fx/melee/dagger-flurry.js";
import * as poisonCloud from "./vendor/pixelfx/src/fx/nature/poison-cloud.js";
import * as blackHole from "./vendor/pixelfx/src/fx/shadow/black-hole.js";
import * as darkBlast from "./vendor/pixelfx/src/fx/shadow/dark-explosion.js";
import { CLASSES, SKILLS, ENEMIES, JOB_BONUS } from "./config.js";
import { G, addFx, hitEnemy, nearestEnemy, bestCluster, slide, blocked, faceFrom, camera, shake, drinkPotion, toast, addBuff, recalcStats, later, SHADOW_PAL, FIRE_PAL } from "./game.js";
import { sfx } from "./audio.js";

export const AIR = { spacing: 18, radius: 24, sy: 0.55, jetSpeed: 380, approach: 260, fall: 0.42, altitude: 46, bombs: 5 };
const GOLD_PAL = ["#2a1c08", "#9a6c18", "#d8a428", "#ffd84a", "#fff09a", "#ffffff"];
const EARTH_PAL = ["#2a1e14", "#6e4a28", "#b8732a", "#f2a03a", "#ffd27a", "#fff3c4", "#ffffff", "#ffffff"];
const POISON_PAL = ["#0d1a0c", "#173a14", "#265e18", "#3f8a1e", "#6cb82a", "#a8e04a", "#e0ff8a"];
const PURPLE_PAL = ["#140a26", "#2b1252", "#481c88", "#6b2cc0", "#9a48ec", "#c684ff", "#ecc8ff", "#ffffff"];
export const SLOT_COUNT = 7;

// which skill sits in each button
export function slotSkill(i) {
  const c = CLASSES[G.cls], p = G.player;
  if (!c) return null;
  if (i === 6) return G.keys?.radio ? "air" : null;
  if (i >= 4) {
    if (G.job.rank < i - 2) return null;
    return c.branches[G.job.branch].skills[i - 4];
  }
  const id = c.skills[i];
  return id && p.lv >= SKILLS[id].level ? id : null;
}
// the name a locked slot shows (what it will be, and when)
export function slotPreview(i) {
  const c = CLASSES[G.cls];
  if (i === 6) return null;
  if (i >= 4) return { name: i === 4 ? "2차 전직" : "3차 전직", level: i === 4 ? 10 : 20 };
  const id = c.skills[i];
  return { name: SKILLS[id].name, level: SKILLS[id].level };
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
  const t = nearestEnemy(ox, oy, 180);
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
// everything in an ellipse on the floor
function inArea(x, y, r, sy = 0.6) {
  return G.enemies.filter((e) => !e.dead && Math.hypot(e.x - x, (e.y - y) / sy) < r + ENEMIES[e.type].rad);
}

// ---- the hero's frame ----------------------------------------------------------------------------
export function updateSkills(dt, input) {
  const p = G.player, s = G.stats;
  updateZones(dt);
  updateStrikes(dt);
  for (const d of G.dashes) d.t -= dt;
  G.dashes = G.dashes.filter((d) => d.t > 0);

  let previewing = false;
  for (let i = 1; i < SLOT_COUNT; i++) {
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
      if (!e.dead && Math.hypot(e.x - p.x, e.y - p.y) < 18 && (d.hits.get(e) ?? 0) < d.maxHits && (d.last.get(e) ?? -1) + 0.06 < d.t0 - d.t) {
        d.hits.set(e, (d.hits.get(e) ?? 0) + 1);
        d.last.set(e, d.t0 - d.t);
        hitEnemy(e, d.dmg, d.vx * 0.3, d.vy * 0.3);
        addFx(frostHit, { x: e.x, y: e.y - 8, palette: d.pal, aim: Math.atan2(d.vy, d.vx) });
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
  if (G.scene.safe && !G.raid) return;

  const basic = slotSkill(0), sl0 = input.slots[0];
  if ((sl0.held || input.mouse.down) && skillReady(basic)) castSkill(basic, input, 0);
  for (let i = 1; i < SLOT_COUNT; i++) {
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
  p.cds[id] = sk.cd;
  p.calm = 0;
  const dmg = atk * (sk.mult ?? 1);
  const dirCast = () => {
    const [ax, ay] = aimDir(input, slot);
    faceFrom(p, ax, ay);
    p.dx = ax;
    p.dy = ay;
    return [ax, ay, Math.atan2(ay, ax)];
  };
  const muzzle = (a) => ({ x: p.x + Math.cos(a) * 8, y: p.y - 8 + Math.sin(a) * 8 });
  switch (id) {
    // ---- mage
    case "bolt": {
      const [, , a] = dirCast();
      shoot({ ...muzzle(a), ang: a, speed: 200, life: 0.8, dmg, fx: frostBolt, hitFx: frostHit, onHit: (e) => (e.frozen = Math.max(e.frozen, ENEMIES[e.type].boss ? 0 : 0.35)) });
      sfx.bolt();
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
        for (const e of inArea(p.x, p.y, 52, 0.62)) (e.frozen = ENEMIES[e.type].boss ? 1 : 2.6), hitEnemy(e, dmg);
      };
      break;
    }
    case "blink": {
      const [ax, ay] = dirCast();
      addFx(blinkFx, { x: p.x, y: p.y });
      let moved = 0;
      while (moved < sk.range && !blocked(p.x + ax * 4, p.y + ay * 4)) (p.x += ax * 4), (p.y += ay * 4), (moved += 4);
      addFx(blinkFx, { x: p.x, y: p.y });
      p.hurt = Math.max(p.hurt, 0.25);
      sfx.blink();
      break;
    }
    case "blizzard": {
      const t = aimPoint(input, slot, sk.range);
      G.zones.push({ x: t.x, y: t.y, r: sk.radius, t: 4, every: 0.5, tick: 0.2, dmg, slow: true, fx: addFx(blizzardFx, { x: t.x, y: t.y, radius: sk.radius }) });
      sfx.ultCharge();
      break;
    }
    case "icelance": {
      const [, , a] = dirCast();
      for (const off of [-0.14, 0, 0.14]) {
        const ang = a + off;
        shoot({ ...muzzle(ang), ang, speed: 230, life: 0.9, dmg, fx: iceLance, fxScale: 0.45, pierce: 3, size: 2, hitFx: frostHit, onHit: (e) => (e.frozen = Math.max(e.frozen, ENEMIES[e.type].boss ? 0.3 : 1.2)) });
      }
      sfx.blink();
      break;
    }
    case "absolute": {
      p.charge = 0.5;
      sfx.ultCharge();
      addFx(frostNova, { x: p.x, y: p.y, reach: 100, scale: 0.9 });
      p.onCharge = () => {
        shake(0.5);
        G.hitstop = 0.08;
        sfx.ultBurst();
        for (const e of inArea(p.x, p.y, sk.radius, 0.62)) (e.frozen = ENEMIES[e.type].boss ? 2 : 4), hitEnemy(e, dmg);
      };
      break;
    }
    case "fireball": {
      const [, , a] = dirCast();
      shoot({ ...muzzle(a), ang: a, speed: 170, life: 1, dmg, fx: fireball, fxScale: 0.45, size: 2, onEnd: (pr) => explodeAt(pr.x, pr.y + 8, 28, dmg * 0.6, FIRE_PAL, 0.6) });
      sfx.shadow();
      break;
    }
    case "meteor": {
      const t = aimPoint(input, slot, sk.range);
      const mk = addFx(strikeMarker, { x: t.x, y: t.y, radius: sk.radius, palette: FIRE_PAL.slice(2) });
      later(1, () => mk.fx.stop());
      const m = addFx(meteorFx, { x: t.x, y: t.y, scale: 0.55 });
      later(0.95, () => {
        shake(0.6);
        G.hitstop = 0.06;
        sfx.boom();
        for (const e of inArea(t.x, t.y, sk.radius)) hitEnemy(e, dmg, Math.sign(e.x - t.x) * 70, Math.sign(e.y - t.y) * 40);
      });
      sfx.jet();
      break;
    }
    // ---- knight
    case "slash": {
      const [ax, ay, a] = dirCast();
      addFx(swordArc, { x: p.x, y: p.y - 8, angle: a, radius: 22, lift: 8 }, p);
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
      for (const e of inArea(p.x, p.y, sk.radius)) hitEnemy(e, dmg, Math.sign(e.x - p.x) * 70, Math.sign(e.y - p.y) * 50);
      sfx.sword();
      shake(0.12);
      break;
    }
    case "dash": {
      const [ax, ay] = dirCast();
      dashTo(ax, ay, sk.range, 0.18, dmg, 1, GOLD_PAL);
      sfx.dash();
      break;
    }
    case "quake": {
      p.charge = 0.25;
      p.onCharge = () => {
        addFx(airBlast, { x: p.x, y: p.y, palette: EARTH_PAL, stone: "#6e5a40" });
        shake(0.35);
        sfx.slam();
        for (const e of inArea(p.x, p.y, sk.radius)) hitEnemy(e, dmg), (e.stun = ENEMIES[e.type].boss ? 0.5 : 1.6);
      };
      break;
    }
    case "rage": {
      addBuff("rage", sk.buff, sk.dur, addFx(rageFx, { x: p.x, y: p.y, scale: 0.55 }, p));
      shake(0.2);
      sfx.ultCharge();
      break;
    }
    case "cleave": {
      const [ax, ay, a] = dirCast();
      p.charge = 0.3;
      p.onCharge = () => {
        addFx(heavyCleave, { x: p.x, y: p.y, angle: a, scale: 0.6 });
        shake(0.5);
        G.hitstop = 0.06;
        sfx.slam();
        // a line of shattered ground ahead
        for (let k = 1; k <= 5; k++) later(k * 0.05, () => addFx(airBlast, { x: p.x + ax * k * 20, y: p.y + ay * k * 20, palette: EARTH_PAL, stone: "#6e5a40", scale: 0.45 }));
        for (const e of G.enemies) {
          if (e.dead) continue;
          const dx = e.x - p.x, dy = e.y - p.y, along = dx * ax + dy * ay, side = Math.abs(dx * ay - dy * ax);
          if (along > -6 && along < sk.range && side < 20 + ENEMIES[e.type].rad) hitEnemy(e, dmg, ax * 90, ay * 90), (e.stun = ENEMIES[e.type].boss ? 0.3 : 1);
        }
      };
      break;
    }
    case "aegis": {
      addBuff("aegis", sk.buff, sk.dur, addFx(divineShield, { x: p.x, y: p.y, scale: 0.55 }, p));
      p.hp = Math.min(G.stats.maxHp, p.hp + G.stats.maxHp * sk.heal);
      sfx.heart();
      break;
    }
    case "judgment": {
      const t = aimPoint(input, slot, sk.range);
      addFx(smite, { x: t.x, y: t.y, scale: 0.55 });
      later(0.45, () => {
        shake(0.4);
        sfx.ultBurst();
        for (const e of inArea(t.x, t.y, sk.radius)) hitEnemy(e, dmg), (e.stun = ENEMIES[e.type].boss ? 0.4 : 1.4);
        p.hp = Math.min(G.stats.maxHp, p.hp + G.stats.maxHp * sk.heal);
      });
      break;
    }
    // ---- ranger
    case "arrow":
    case "pierce": {
      const [, , a] = dirCast(), pierce = id === "pierce";
      shoot({ ...muzzle(a), ang: a, speed: pierce ? 320 : 260, life: pierce ? 0.9 : 0.75, dmg, fx: arrowFx, fxOpts: pierce ? { palette: GOLD_PAL.slice(1, 5), glow: 1 } : {}, pierce: pierce ? 99 : 0, size: pierce ? 2 : 0, hitFx: frostHit, hitPal: GOLD_PAL });
      pierce ? (sfx.crit(), shake(0.08)) : sfx.arrowShot();
      break;
    }
    case "fan": {
      const [, , a] = dirCast();
      for (let i = 0; i < 7; i++) {
        const ang = a + (i - 3) * 0.16;
        shoot({ ...muzzle(ang), ang, speed: 250, life: 0.6, dmg, fx: arrowFx, hitFx: frostHit, hitPal: GOLD_PAL });
      }
      sfx.arrowShot();
      break;
    }
    case "rain": {
      const t = aimPoint(input, slot, sk.range);
      addFx(arrowRain, { x: t.x, y: t.y, radius: sk.radius });
      G.zones.push({ x: t.x, y: t.y, r: sk.radius, t: 1.0, every: 0.15, tick: 0.3, dmg });
      sfx.arrowShot();
      break;
    }
    case "explosive": {
      const [, , a] = dirCast();
      shoot({ ...muzzle(a), ang: a, speed: 260, life: 0.8, dmg, fx: arrowFx, fxOpts: { palette: FIRE_PAL.slice(3, 7), glow: 1 }, onEnd: (pr) => explodeAt(pr.x, pr.y + 8, sk.radius, dmg * 0.7, FIRE_PAL, 0.55) });
      sfx.arrowShot();
      break;
    }
    case "storm": {
      const t = aimPoint(input, slot, sk.range);
      G.zones.push({ x: t.x, y: t.y, r: sk.radius, t: 4, every: 0.25, tick: 0.1, dmg, suck: 30, fx: addFx(tornado, { x: t.x, y: t.y, scale: 0.5 }) });
      sfx.jet();
      break;
    }
    case "snipe": {
      const [, , a] = dirCast();
      p.charge = 0.4;
      p.onCharge = () => {
        shoot({ ...muzzle(a), ang: a, speed: 600, life: 0.6, dmg, fx: arrowFx, fxOpts: { palette: ["#3f8cff", "#7cc8ff", "#c8f0ff", "#ffffff"], glow: 1 }, pierce: 99, size: 3, hitFx: frostHit });
        shake(0.2);
        sfx.crit();
      };
      break;
    }
    case "thunder": {
      const t = aimPoint(input, slot, sk.range);
      for (let i = 0; i < 3; i++) {
        const x = t.x + (i - 1) * 22 + (i === 1 ? 0 : 6), y = t.y + (i === 1 ? -8 : 6);
        later(i * 0.25, () => {
          addFx(lightning, { x, y, scale: 0.45 });
          shake(0.25);
          sfx.boom();
          for (const e of inArea(x, y, sk.radius)) hitEnemy(e, dmg), (e.stun = ENEMIES[e.type].boss ? 0.2 : 0.8);
        });
      }
      break;
    }
    // ---- thief
    case "star": {
      const [, , a] = dirCast();
      shoot({ ...muzzle(a), ang: a, speed: 280, life: 0.6, dmg, fx: shuriken, hitFx: frostHit, hitPal: PURPLE_PAL });
      sfx.arrowShot();
      break;
    }
    case "flurry": {
      const [ax, ay, a] = dirCast();
      addFx(daggerFlurry, { x: p.x, y: p.y, angle: 0, flip: ax < 0, scale: 0.5 });
      for (let k = 0; k < 2; k++)
        later(k * 0.12, () => {
          for (const e of G.enemies) {
            if (e.dead) continue;
            const dx = e.x - p.x, dy = e.y - ENEMIES[e.type].hitY - (p.y - 8), d = Math.hypot(dx, dy);
            if (d < sk.range + ENEMIES[e.type].rad && (dx * ax + dy * ay) / (d || 1) > 0.1) hitEnemy(e, dmg / 2, ax * 30, ay * 30);
          }
          sfx.sword();
        });
      break;
    }
    case "stealth": {
      p.stealth = sk.dur;
      for (const e of G.enemies) if (!ENEMIES[e.type].boss) e.aggro = false;
      addFx(blinkFx, { x: p.x, y: p.y, palette: PURPLE_PAL.slice(1) });
      recalcStats();
      sfx.blink();
      toast("은신: 다음 공격이 치명타 2.5배", "#c684ff");
      break;
    }
    case "poison": {
      const t = aimPoint(input, slot, sk.range);
      G.zones.push({ x: t.x, y: t.y, r: sk.radius, t: 5, every: 0.5, tick: 0.2, dmg, slow: true, fx: addFx(poisonCloud, { x: t.x, y: t.y + 10, scale: 0.4 }) });
      sfx.shadow();
      break;
    }
    case "starstorm": {
      for (let i = 0; i < 10; i++) {
        const ang = (i / 10) * Math.PI * 2;
        shoot({ ...muzzle(ang), ang, speed: 240, life: 0.6, dmg, fx: shuriken, pierce: 1, hitFx: frostHit, hitPal: PURPLE_PAL });
      }
      sfx.arrowShot();
      shake(0.1);
      break;
    }
    case "vortex": {
      const t = aimPoint(input, slot, sk.range);
      G.zones.push({ x: t.x, y: t.y, r: sk.radius, t: 3.5, every: 0.25, tick: 0.2, dmg, suck: 50, fx: addFx(blackHole, { x: t.x, y: t.y - 8, scale: 0.5 }), end: () => explodeAt(t.x, t.y, sk.radius, dmg * 4, SHADOW_PAL, 0.7) });
      sfx.shadow();
      break;
    }
    case "assault": {
      const [ax, ay] = dirCast();
      dashTo(ax, ay, sk.range, 0.32, dmg, 3, PURPLE_PAL);
      sfx.dash();
      break;
    }
    case "eclipse": {
      p.charge = 0.35;
      p.hurt = Math.max(p.hurt, 0.6);
      p.onCharge = () => {
        addFx(darkBlast, { x: p.x, y: p.y, scale: 0.5 });
        shake(0.55);
        G.hitstop = 0.07;
        sfx.boom();
        for (const e of inArea(p.x, p.y, sk.radius)) hitEnemy(e, dmg, Math.sign(e.x - p.x) * 90, Math.sign(e.y - p.y) * 60);
      };
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
  const pr = { owner: "player", x: o.x, y: o.y, vx: Math.cos(o.ang) * o.speed, vy: Math.sin(o.ang) * o.speed, ang: o.ang, life: o.life, dmg: o.dmg, pierce: o.pierce ?? 0, size: o.size ?? 0, hitSet: new Set(), hitFx: o.hitFx, hitPal: o.hitPal, onHit: o.onHit, onEnd: o.onEnd };
  pr.fx = addFx(o.fx, { x: pr.x, y: pr.y, angle: o.ang, scale: o.fxScale, ...(o.fxOpts ?? {}) }, pr);
  G.projectiles.push(pr);
}
function dashTo(ax, ay, range, time, dmg, maxHits, pal) {
  const p = G.player;
  p.dash = { vx: (ax * range) / time, vy: (ay * range) / time, t: time, t0: time, hits: new Map(), last: new Map(), maxHits, dmg, pal };
  p.hurt = Math.max(p.hurt, time + 0.15);
}
function explodeAt(x, y, r, dmg, pal, scale) {
  addFx(airBlast, { x, y, palette: pal.length === 8 ? pal : undefined, scale });
  shake(0.18);
  sfx.boom();
  for (const e of inArea(x, y, r)) hitEnemy(e, dmg, Math.sign(e.x - x) * 50, Math.sign(e.y - y) * 30);
}

// ground effects on a timer: blizzard, rain, poison, storm, vortex, and the Demon King's black hole
function updateZones(dt) {
  const p = G.player;
  for (const z of G.zones) {
    z.t -= dt;
    z.tick -= dt;
    if (z.suck)
      for (const e of G.enemies) {
        const dx = z.x - e.x, dy = z.y - e.y, d = Math.hypot(dx, dy);
        if (!e.dead && !ENEMIES[e.type].boss && d < z.r * 1.6 && d > 4) slide(e, (dx / d) * z.suck * dt, (dy / d) * z.suck * dt);
      }
    if (z.pull) {
      const dx = z.x - p.x, dy = z.y - p.y, d = Math.hypot(dx, dy);
      if (d > 6 && d < 160) slide(p, (dx / d) * z.pull * dt, (dy / d) * z.pull * dt);
    }
    if (z.tick <= 0 && z.t > 0 && z.dmg) {
      z.tick += z.every;
      for (const e of inArea(z.x, z.y, z.r, 0.58)) {
        hitEnemy(e, z.dmg);
        if (z.slow) e.slow = 0.8;
      }
    }
  }
  for (const z of G.zones)
    if (z.t <= 0) {
      z.fx?.fx.stop();
      z.hole?.fx.stop();
      z.end?.();
    }
  G.zones = G.zones.filter((z) => z.t > 0);
}

// ---- the airstrike -------------------------------------------------------------------------------
function callAirstrike(tx, ty, dmg) {
  const p = G.player;
  let ux = tx - p.x, uy = ty - p.y, l = Math.hypot(ux, uy);
  if (l < 8) (ux = p.dx), (uy = p.dy), (l = Math.hypot(ux, uy) || 1);
  ux /= l;
  uy /= l;
  const n = AIR.bombs + (G.job.rank - 1) * 2, bombs = [];
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
          for (const e of inArea(b.x, b.y, AIR.radius, AIR.sy)) {
            const dx = e.x - b.x, dy = (e.y - b.y) / AIR.sy, d = Math.hypot(dx, dy) || 1;
            hitEnemy(e, st.dmg, (dx / d) * 60, (dy / d) * 40);
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
