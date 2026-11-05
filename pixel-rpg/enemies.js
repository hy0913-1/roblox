// Monster and boss behaviour. Each monster type uses one of a few behaviours (hopper, bat, swinger, shooter,
// slammer, fleer); each boss has its own pattern, getting fiercer below half health.

import * as strikeMarker from "./vendor/pixelfx/src/fx/rpg/strike-marker.js";
import * as airBlast from "./vendor/pixelfx/src/fx/rpg/airstrike-blast.js";
import * as slimePop from "./vendor/pixelfx/src/fx/rpg/slime-pop.js";
import * as blinkFx from "./vendor/pixelfx/src/fx/rpg/blink.js";
import * as fireBreath from "./vendor/pixelfx/src/fx/fire/fire-breath.js";
import * as meteorFx from "./vendor/pixelfx/src/fx/fire/meteor.js";
import * as iceSpikes from "./vendor/pixelfx/src/fx/ice/ice-spikes.js";
import * as blackHole from "./vendor/pixelfx/src/fx/shadow/black-hole.js";
import * as darkBlast from "./vendor/pixelfx/src/fx/shadow/dark-explosion.js";
import { ENEMIES, TILE } from "./config.js";
import { G, rnd, addFx, slide, blocked, steer, lineOfSight, hurtPlayer, spawnEnemy, enemyShot, shake, toast, SHADOW_PAL } from "./game.js";
import { isSolidAt, isWaterAt } from "./world.js";
import { sfx } from "./audio.js";

const SLAM_PAL = ["#0d1a0c", "#173a14", "#265e18", "#3f8a1e", "#6cb82a", "#a8e04a", "#e0ff8a", "#ffffff"];
const EARTH_PAL = ["#2a1e14", "#6e4a28", "#b8732a", "#f2a03a", "#ffd27a", "#fff3c4", "#ffffff", "#ffffff"];
const BEHAVIOUR = {
  slime: "hopper", magma: "hopper", bat: "bat", archer: "shooter", imp: "shooter", gargoyle: "shooter",
  skeleton: "swinger", orc: "swinger", demon: "swinger", wolf: "swinger", yeti: "swinger",
  golem: "slammer", icegolem: "slammer", goldslime: "fleer", goblin: "fleer",
};
const SHOT = { archer: "arrow", imp: "fire", gargoyle: "shadow", yeti: "snow" };

export function updateEnemy(e, dt) {
  const p = G.player, def = ENEMIES[e.type];
  e.anim += dt;
  e.spawnT += dt;
  for (const k of ["hit", "touchCd", "frozen", "stun", "slow"]) e[k] = Math.max(0, e[k] - dt);
  if (e.kx || e.ky) {
    if (def.flying) (e.x += e.kx * dt * 4), (e.y += e.ky * dt * 4);
    else slide(e, e.kx * dt * 4, e.ky * dt * 4, def.rad > 10 ? 10 : 4);
    e.kx *= 0.86;
    e.ky *= 0.86;
    if (Math.abs(e.kx) + Math.abs(e.ky) < 1) e.kx = e.ky = 0;
  }
  if (e.frozen > 0 || e.stun > 0) return;
  const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1, safe = G.scene.safe && !G.raid;
  const hidden = p.stealth > 0;
  if (!e.aggro && !hidden && d < def.sight && !safe && (def.flying || d < 50 || lineOfSight(e.x, e.y - 4, p.x, p.y - 4))) e.aggro = true;
  if (e.aggro && ((d > def.sight * 2.4 && !def.boss) || hidden)) e.aggro = false;
  const sp = def.speed * (e.slow > 0 ? 0.5 : 1) * (G.bloodMoon ? 1.15 : 1);
  if (def.boss) return BOSSES[e.type](e, dt, dx, dy, d, def, sp);

  const wander = () => {
    e.wt -= dt;
    if (e.wt <= 0) {
      e.wander = rnd.range(0, 6.28);
      e.wt = rnd.range(0.8, 2.2);
      if (Math.hypot(e.x - e.home.x, e.y - e.home.y) > 60) e.wander = Math.atan2(e.home.y - e.y, e.home.x - e.x);
    }
    return [Math.cos(e.wander) * 0.4, Math.sin(e.wander) * 0.4];
  };
  const b = BEHAVIOUR[e.type];
  if (b === "hopper") {
    const [vx, vy] = e.aggro ? steer(e.x, e.y, dx, dy, d) : wander();
    const hop = Math.max(0, Math.sin(e.anim * 6));
    slide(e, vx * sp * dt * hop * 1.6, vy * sp * dt * hop * 1.6);
    touch(e, d, def);
  } else if (b === "bat") {
    const wob = Math.sin(e.anim * 5) * 0.8, nx = -dy / d, ny = dx / d;
    const [tx, ty] = e.aggro ? [dx / d, dy / d] : wander();
    e.x += (tx + (e.aggro ? nx * wob : 0)) * sp * dt;
    e.y += (ty + (e.aggro ? ny * wob : 0)) * sp * dt;
    clampToScene(e);
    if (!e.aggro && isSolidAt(G.scene, e.x, e.y) && !isWaterAt(G.scene, e.x, e.y)) e.wander += Math.PI;
    e.z = 10 + Math.sin(e.anim * 9) * 2;
    touch(e, d, def);
  } else if (b === "shooter") {
    let vx = 0, vy = 0;
    if (def.flying) e.z = 10 + Math.sin(e.anim * 4) * 2;
    if (e.aggro) {
      const clear = def.flying || lineOfSight(e.x, e.y - 1, p.x, p.y - 1);
      if (d > def.range + 10 || !clear) [vx, vy] = def.flying ? [dx / d, dy / d] : steer(e.x, e.y, dx, dy, d);
      else if (d < def.range - 30) (vx = -dx / d), (vy = -dy / d);
      else (vx = (-dy / d) * 0.5 * Math.sign(Math.sin(e.wander))), (vy = (dx / d) * 0.5 * Math.sign(Math.sin(e.wander)));
      e.shootCd -= dt;
      if (e.shootCd <= 0 && d < def.range + 40 && clear) {
        e.shootCd = def.shootEvery * rnd.range(0.85, 1.15);
        enemyShot(e.x, e.y - def.hitY - e.z, p.x, p.y - 8, def.arrowSpeed, e.atk, SHOT[e.type]);
        e.draw = 0.25;
        e.type === "archer" ? sfx.arrow() : sfx.shadow();
      }
    } else [vx, vy] = wander();
    e.draw = Math.max(0, (e.draw ?? 0) - dt);
    if (def.flying) {
      e.x += vx * sp * dt;
      e.y += vy * sp * dt;
      clampToScene(e);
    } else slide(e, vx * sp * dt, vy * sp * dt);
  } else if (b === "swinger") {
    // walks up, winds up (a tell you can see), swings
    if (e.state === "swing") {
      e.timer -= dt;
      if (e.timer <= 0) {
        e.state = "walk";
        if (d < (e.type === "yeti" ? 26 : 22)) hurtPlayer(e.atk, e.x, e.y);
        e.swung = 0.2;
      }
    } else {
      const [vx, vy] = e.aggro ? steer(e.x, e.y, dx, dy, d) : wander();
      const lunge = e.type === "wolf" && e.aggro && d < 60 ? 1.4 : 1;
      slide(e, vx * sp * lunge * dt, vy * sp * lunge * dt, def.rad > 8 ? 6 : 4);
      if (e.aggro && d < 18 && e.touchCd <= 0) {
        e.state = "swing";
        e.timer = e.type === "wolf" ? 0.22 : e.type === "demon" ? 0.3 : 0.4;
        e.touchCd = e.type === "wolf" ? 0.9 : 1.3;
      }
      // the yeti also throws snowballs from range
      if (e.type === "yeti" && e.aggro && d > 50) {
        e.shootCd -= dt;
        if (e.shootCd <= 0) {
          e.shootCd = def.shootEvery;
          enemyShot(e.x, e.y - 14, p.x, p.y - 8, def.arrowSpeed, e.atk * 0.8, "snow");
        }
      }
    }
    e.swung = Math.max(0, (e.swung ?? 0) - dt);
  } else if (b === "slammer") {
    if (e.state === "slam") {
      e.timer -= dt;
      if (e.timer <= 0) {
        e.state = "walk";
        shake(0.15);
        sfx.slam();
        addFx(airBlast, { x: e.x, y: e.y, palette: e.type === "icegolem" ? undefined : EARTH_PAL, stone: e.type === "icegolem" ? "#8cc4f4" : "#6e5a40", scale: 0.6 });
        if (Math.hypot(p.x - e.x, (p.y - e.y) / 0.6) < 30) hurtPlayer(e.atk, e.x, e.y);
        e.marker?.fx.stop();
      }
    } else {
      const [vx, vy] = e.aggro ? steer(e.x, e.y, dx, dy, d) : wander();
      slide(e, vx * sp * dt, vy * sp * dt, 6);
      if (e.aggro && d < 26 && e.touchCd <= 0) {
        e.state = "slam";
        e.timer = 0.7;
        e.touchCd = 2.2;
        e.marker = addFx(strikeMarker, { x: e.x, y: e.y, radius: 26 });
      }
    }
  } else if (b === "fleer") {
    // runs from you; the treasure goblin digs away after a while
    e.life = (e.life ?? 25) - dt;
    const [vx, vy] = e.aggro ? [-dx / d, -dy / d] : wander();
    const jitter = Math.sin(e.anim * 3) * 0.5;
    slide(e, (vx - vy * jitter) * sp * dt, (vy + vx * jitter) * sp * dt);
    if (e.life <= 0) {
      e.dead = true;
      e.escaped = true;
      addFx(slimePop, { x: e.x, y: e.y, palette: ["#1c1610", "#33281c", "#4f3f2c", "#6e5a40", "#927a58", "#b89f78", "#dcc8a2", "#ffffff"] });
      toast(`${def.name}이(가) 도망쳤다…`, "#b89f78");
    }
  }
}

function touch(e, d, def) {
  if (e.aggro && d < 11 && e.touchCd <= 0 && e.z < 14) {
    e.touchCd = 0.8;
    hurtPlayer(e.atk, e.x, e.y);
  }
}
function clampToScene(e) {
  e.x = Math.max(16, Math.min(G.scene.w * TILE - 16, e.x));
  e.y = Math.max(24, Math.min(G.scene.h * TILE - 8, e.y));
}
function summon(type, lv, n, e, spread = 30, fxPal) {
  if (G.enemies.length > 18) return;
  for (let i = 0; i < n; i++) {
    const a = rnd.range(0, Math.PI * 2), at = { x: e.x + Math.cos(a) * spread, y: e.y + Math.sin(a) * spread * 0.6 };
    if (blocked(at.x, at.y, 6)) continue;
    spawnEnemy(type, lv, at).aggro = true;
    if (fxPal) addFx(slimePop, { x: at.x, y: at.y, palette: fxPal });
  }
}
// a marked spot that blows up after a delay
function hazardAt(x, y, delay, radius, dmg, blast, pal) {
  const m = addFx(strikeMarker, { x, y, radius, palette: pal });
  G.timers.push({
    t: delay,
    fn: () => {
      m.fx.stop();
      blast();
      if (Math.hypot(G.player.x - x, (G.player.y - y) / 0.6) < radius + 4) hurtPlayer(dmg, x, y);
    },
  });
}

// ---- bosses ------------------------------------------------------------------------------------------
const BOSSES = {
  king(e, dt, dx, dy, d, def, sp) {
    if (!e.aggro) return;
    e.timer -= dt;
    if (e.state === "walk") {
      const hop = Math.max(0, Math.sin(e.anim * 4)), [sx, sy] = steer(e.x, e.y, dx, dy, d);
      slide(e, sx * sp * dt * hop * 1.8, sy * sp * dt * hop * 1.8, 10);
      if (e.timer <= 0) (e.state = "crouch"), (e.timer = 0.45);
    } else if (e.state === "crouch") {
      if (e.timer <= 0) {
        e.state = "air";
        e.timer = 0.95;
        e.from = { x: e.x, y: e.y };
        e.to = blocked(G.player.x, G.player.y, 10) ? { x: e.x, y: e.y } : { x: G.player.x, y: G.player.y };
        e.marker = addFx(strikeMarker, { x: e.to.x, y: e.to.y, radius: 34, palette: ["#0d1a0c", "#265e18", "#6cb82a", "#a8e04a", "#e0ff8a", "#ffffff"] });
      }
    } else if (e.state === "air") {
      const u = 1 - e.timer / 0.95;
      e.x = e.from.x + (e.to.x - e.from.x) * u;
      e.y = e.from.y + (e.to.y - e.from.y) * u;
      e.z = Math.sin(u * Math.PI) * 60;
      if (e.timer <= 0) {
        e.state = "walk";
        e.timer = rnd.range(3, 4.2);
        e.z = 0;
        e.marker?.fx.stop();
        e.jumps = (e.jumps ?? 0) + 1;
        shake(0.4);
        sfx.slam();
        addFx(airBlast, { x: e.x, y: e.y, palette: SLAM_PAL, stone: "#2f6a32" });
        if (Math.hypot(G.player.x - e.x, (G.player.y - e.y) / 0.6) < 38) hurtPlayer(e.atk * 1.3, e.x, e.y);
        if (e.jumps % 2 === 0) summon("slime", e.lv - 1, 2, e, 26);
      }
    }
    contact(e, d, 18);
  },

  lich(e, dt, dx, dy, d, def, sp) {
    e.z = 6 + Math.sin(e.anim * 2) * 3;
    if (!e.aggro) return;
    const rage = e.hp < e.max / 2;
    let vx = 0, vy = 0;
    if (d > 110) [vx, vy] = steer(e.x, e.y, dx, dy, d);
    else if (d < 70) (vx = -dx / d), (vy = -dy / d);
    else (vx = (-dy / d) * 0.6), (vy = (dx / d) * 0.6);
    slide(e, vx * sp * dt, vy * sp * dt, 6);
    e.shootCd -= dt;
    if (e.shootCd <= 0) {
      e.shootCd = rage ? 1.3 : 2;
      fan(e, rage ? 5 : 3, 0.28, 95, "shadow");
      e.cast = 0.3;
      sfx.shadow();
    }
    e.cast = Math.max(0, (e.cast ?? 0) - dt);
    e.timer -= dt;
    if (e.timer <= 0) {
      e.timer = rage ? 6 : 8;
      if (G.enemies.filter((o) => o.type === "skeleton").length < 4) summon("skeleton", e.lv - 2, 2, e, 30, SHADOW_PAL);
    }
    e.blinkCd = Math.max(0, (e.blinkCd ?? 2) - dt);
    if (d < 40 && e.blinkCd <= 0) blinkAway(e, 5);
  },

  // the Orc Chief: stomps after you, winds up and charges in a straight line; calls warriors below half health
  chief(e, dt, dx, dy, d, def, sp) {
    if (!e.aggro) return;
    e.timer -= dt;
    if (e.state === "walk") {
      const [sx, sy] = steer(e.x, e.y, dx, dy, d);
      slide(e, sx * sp * dt, sy * sp * dt, 10);
      if (e.timer <= 0 && d < 160) {
        e.state = "windup";
        e.timer = 0.6;
        e.dir = [dx / d, dy / d];
        e.marker = addFx(strikeMarker, { x: G.player.x, y: G.player.y, radius: 20 });
      }
    } else if (e.state === "windup") {
      if (e.timer <= 0) {
        e.state = "charge";
        e.timer = 0.55;
        e.marker?.fx.stop();
        sfx.dash();
      }
    } else if (e.state === "charge") {
      const before = { x: e.x, y: e.y };
      slide(e, e.dir[0] * 260 * dt, e.dir[1] * 260 * dt, 10);
      if (Math.hypot(G.player.x - e.x, G.player.y - e.y) < 20) hurtPlayer(e.atk * 1.4, e.x, e.y);
      if (e.timer <= 0 || (before.x === e.x && before.y === e.y)) {
        e.state = "walk";
        e.timer = rnd.range(2.5, 3.5);
        shake(0.3);
        sfx.slam();
        addFx(airBlast, { x: e.x, y: e.y, palette: EARTH_PAL, stone: "#6e5a40", scale: 0.8 });
        if (e.hp < e.max / 2 && !e.called) {
          e.called = true;
          toast("오크 족장이 부하를 부른다!", "#ff8a6a");
          summon("orc", e.lv - 3, 3, e, 34);
        }
      }
    }
    contact(e, d, 20);
  },

  // the Fire Drake: flies, breathes fire in a cone, rains fireballs; below half health it dives
  drake(e, dt, dx, dy, d, def, sp) {
    e.z = 12 + Math.sin(e.anim * 2.5) * 4;
    if (!e.aggro) return;
    const rage = e.hp < e.max / 2;
    e.timer -= dt;
    if (e.state === "walk") {
      const want = d > 90 ? 1 : d < 50 ? -1 : 0;
      e.x += ((dx / d) * want + (-dy / d) * 0.5) * sp * dt;
      e.y += ((dy / d) * want + (dx / d) * 0.5) * sp * dt;
      clampToScene(e);
      if (e.timer <= 0) {
        const roll = rnd.next();
        if (roll < 0.45) {
          e.state = "breath";
          e.timer = 1.4;
          e.aim = Math.atan2(dy, dx);
          e.breath = addFx(fireBreath, { x: e.x, y: e.y - 20, angle: e.aim, scale: 0.75 });
          sfx.jet();
        } else if (roll < 0.8 || !rage) {
          e.state = "walk";
          e.timer = rage ? 2.2 : 3;
          for (let i = 0; i < (rage ? 5 : 3); i++) {
            const tx = G.player.x + rnd.range(-50, 50), ty = G.player.y + rnd.range(-30, 30);
            hazardAt(tx, ty, 1.1 + i * 0.15, 20, e.atk, () => addFx(airBlast, { x: tx, y: ty, scale: 0.7 }), undefined);
          }
          sfx.shadow();
        } else {
          e.state = "dive";
          e.timer = 0.9;
          e.from = { x: e.x, y: e.y };
          e.to = { x: G.player.x, y: G.player.y };
          e.marker = addFx(strikeMarker, { x: e.to.x, y: e.to.y, radius: 30 });
        }
      }
    } else if (e.state === "breath") {
      e.aim += Math.sign(Math.sin(Math.atan2(dy, dx) - e.aim)) * dt * 0.8;
      e.breath.fx.options.angle = e.aim;
      e.breath.fx.options.x = e.x;
      e.breath.fx.options.y = e.y - 20;
      const pa = Math.atan2(G.player.y - (e.y - 8), G.player.x - e.x);
      if (d < 100 && Math.abs(Math.atan2(Math.sin(pa - e.aim), Math.cos(pa - e.aim))) < 0.35) {
        e.burnTick = (e.burnTick ?? 0) - dt;
        if (e.burnTick <= 0) (e.burnTick = 0.3), hurtPlayer(e.atk * 0.5, e.x, e.y);
      }
      if (e.timer <= 0) {
        e.breath.fx.stop();
        e.state = "walk";
        e.timer = rage ? 2 : 3;
      }
    } else if (e.state === "dive") {
      const u = 1 - e.timer / 0.9;
      e.x = e.from.x + (e.to.x - e.from.x) * u;
      e.y = e.from.y + (e.to.y - e.from.y) * u;
      e.z = 12 + Math.sin(u * Math.PI) * 50;
      if (e.timer <= 0) {
        e.state = "walk";
        e.timer = 2.4;
        e.marker?.fx.stop();
        shake(0.45);
        sfx.boom();
        addFx(airBlast, { x: e.x, y: e.y });
        if (Math.hypot(G.player.x - e.x, (G.player.y - e.y) / 0.6) < 34) hurtPlayer(e.atk * 1.5, e.x, e.y);
      }
    }
  },

  // the Frost Giant: lumbers after you, sends lines of ice spikes along the ground, throws boulders of snow
  giant(e, dt, dx, dy, d, def, sp) {
    if (!e.aggro) return;
    const rage = e.hp < e.max / 2;
    e.timer -= dt;
    if (e.state === "walk") {
      const [sx, sy] = steer(e.x, e.y, dx, dy, d);
      slide(e, sx * sp * dt, sy * sp * dt, 12);
      e.shootCd -= dt;
      if (e.shootCd <= 0 && d > 50) {
        e.shootCd = rage ? 1.6 : 2.4;
        fan(e, rage ? 3 : 1, 0.25, 110, "snow", 1.2);
      }
      if (e.timer <= 0) {
        e.state = "stomp";
        e.timer = 0.6;
      }
    } else if (e.state === "stomp" && e.timer <= 0) {
      e.state = "walk";
      e.timer = rage ? 3 : 4.2;
      shake(0.4);
      sfx.slam();
      // spikes race out toward you along the floor
      const a = Math.atan2(dy, dx), lines = rage ? [-0.5, 0, 0.5] : [0];
      for (const off of lines) {
        const ang = a + off;
        addFx(iceSpikes, { x: e.x, y: e.y, angle: ang, scale: 0.55 });
        for (let k = 1; k <= 6; k++) {
          const px = e.x + Math.cos(ang) * k * 22, py = e.y + Math.sin(ang) * k * 22;
          G.timers.push({ t: k * 0.09, fn: () => Math.hypot(G.player.x - px, G.player.y - py) < 16 && hurtPlayer(e.atk, px, py) });
        }
      }
      if (rage && !e.called) {
        e.called = true;
        toast("서리 거인이 얼음 골렘을 깨운다!", "#9bdcff");
        summon("icegolem", e.lv - 3, 2, e, 40);
      }
    }
    contact(e, d, 22);
  },

  // Bael, the Demon King: three phases. 1: shadow fans and demons. 2: meteors. 3: a black hole that pulls you in.
  demonking(e, dt, dx, dy, d, def, sp) {
    if (!e.aggro) return;
    const phase = e.hp > e.max * 0.66 ? 1 : e.hp > e.max * 0.33 ? 2 : 3;
    if (phase !== e.phase) {
      e.phase = phase;
      if (phase > 1) {
        toast(phase === 2 ? "마왕: 불타 사라져라!" : "마왕: 어둠 속으로 끌려와라!", "#ff6a8a");
        shake(0.5);
        addFx(darkBlast, { x: e.x, y: e.y, scale: 0.6 });
      }
    }
    let vx = 0, vy = 0;
    if (d > 100) [vx, vy] = steer(e.x, e.y, dx, dy, d);
    else if (d < 50) (vx = -dx / d), (vy = -dy / d);
    else (vx = (-dy / d) * 0.6), (vy = (dx / d) * 0.6);
    slide(e, vx * sp * dt, vy * sp * dt, 10);
    e.shootCd -= dt;
    if (e.shootCd <= 0) {
      e.shootCd = phase === 3 ? 1.2 : 1.7;
      fan(e, phase === 1 ? 5 : 7, 0.22, 105, "shadow");
      sfx.shadow();
    }
    e.timer -= dt;
    if (e.timer <= 0) {
      e.timer = phase === 1 ? 7 : 5;
      if (phase === 1) summon("demon", e.lv - 5, 2, e, 36, SHADOW_PAL);
      else
        for (let i = 0; i < (phase === 2 ? 4 : 6); i++) {
          const tx = G.player.x + rnd.range(-70, 70), ty = G.player.y + rnd.range(-45, 45);
          hazardAt(tx, ty, 1.2 + i * 0.2, 24, e.atk * 1.2, () => (addFx(meteorFx, { x: tx, y: ty, scale: 0.35 }), shake(0.2), sfx.boom()), undefined);
        }
    }
    if (phase === 3) {
      e.holeCd = (e.holeCd ?? 1) - dt;
      if (e.holeCd <= 0) {
        e.holeCd = 9;
        const hx = e.x, hy = e.y;
        const hole = addFx(blackHole, { x: hx, y: hy - 10, scale: 0.5 });
        G.zones.push({ x: hx, y: hy, r: 0, t: 3.5, every: 99, tick: 99, dmg: 0, pull: 34, hole });
      }
    }
    e.blinkCd = Math.max(0, (e.blinkCd ?? 3) - dt);
    if (d < 30 && e.blinkCd <= 0) blinkAway(e, 6);
    contact(e, d, 20);
  },
};

function contact(e, d, reach) {
  if (d < reach && e.touchCd <= 0 && e.z < 6) {
    e.touchCd = 1;
    hurtPlayer(e.atk, e.x, e.y);
  }
}
function fan(e, n, spread, speed, kind, size = 1) {
  const p = G.player, base = Math.atan2(p.y - 8 - (e.y - 16), p.x - e.x);
  for (let i = 0; i < n; i++) {
    const a = base + (i - (n - 1) / 2) * spread;
    const pr = enemyShot(e.x, e.y - 16, e.x + Math.cos(a) * 100, e.y - 16 + Math.sin(a) * 100, speed, e.atk, kind);
    pr.size = size;
  }
}
function blinkAway(e, cd) {
  e.blinkCd = cd;
  addFx(blinkFx, { x: e.x, y: e.y, palette: SHADOW_PAL.slice(1) });
  for (let k = 0; k < 20; k++) {
    const a = rnd.range(0, Math.PI * 2), r = rnd.range(70, 110), nx = G.player.x + Math.cos(a) * r, ny = G.player.y + Math.sin(a) * r * 0.7;
    if (!blocked(nx, ny, 8) && lineOfSight(nx, ny - 4, G.player.x, G.player.y - 4)) {
      e.x = nx;
      e.y = ny;
      break;
    }
  }
  addFx(blinkFx, { x: e.x, y: e.y, palette: SHADOW_PAL.slice(1) });
}
