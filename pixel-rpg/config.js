// Every number that decides how the game plays, in one place.

// The view in game pixels. It follows the screen's shape (set by fit() in main.js), so a phone is filled edge to
// edge in either orientation; ES module live bindings mean every importer sees the current size.
export let W = 320, H = 180;
export function setView(w, h) {
  W = w;
  H = h;
}

export const BASE = {
  speed: 64,
  maxHp: 100,
  regen: 0,
  magnet: 30,
  boltDamage: 12,
  boltCooldown: 0.34,
  boltCount: 1,
  pierce: 0,
  ultDamage: 45,
  ultCooldown: 12,
  airDamage: 55,
  airCooldown: 15,
  airBombs: 5,
};

export const BOLT = { speed: 200, life: 0.8, spread: 0.2, crit: 0.1 };
export const ULT = { reach: 52, freeze: 2.6, charge: 0.4, sy: 0.62 };
export const AIR = { range: 150, spacing: 18, radius: 24, sy: 0.55, jetSpeed: 380, approach: 260, fall: 0.42, altitude: 46 };
export const PLAYER = { invuln: 0.8, aimAssist: 170 };

export const ENEMIES = {
  slime: { hp: 28, speed: 30, touch: 8, xp: 1, score: 10, hitY: 6, rad: 7 },
  bat: { hp: 14, speed: 56, touch: 6, xp: 1, score: 12, hitY: 13, rad: 6 },
  archer: { hp: 36, speed: 22, touch: 6, xp: 2, score: 20, hitY: 9, rad: 6, range: 95, shootEvery: 2.4, arrowSpeed: 115, arrowDamage: 10 },
  king: { hp: 520, speed: 17, touch: 14, xp: 30, score: 300, hitY: 14, rad: 14 },
};

export const xpForLevel = (lv) => 4 + lv * 4;

// Level-up choices. `apply` changes the run's stats; `max` is how many times it can be taken.
export const UPGRADES = [
  { id: "bolt_power", name: "얼음탄 강화", desc: "얼음탄 피해 +25%", tag: "BOLT", max: 6, apply: (s) => (s.boltDamage *= 1.25) },
  { id: "bolt_rate", name: "빠른 시전", desc: "얼음탄 연사 속도 +18%", tag: "BOLT", max: 5, apply: (s) => (s.boltCooldown *= 0.82) },
  { id: "bolt_multi", name: "갈래 얼음탄", desc: "얼음탄을 한 발 더 쏩니다", tag: "BOLT", max: 4, apply: (s) => s.boltCount++ },
  { id: "bolt_pierce", name: "관통 얼음", desc: "얼음탄이 적을 하나 더 꿰뚫습니다", tag: "BOLT", max: 3, apply: (s) => s.pierce++ },
  { id: "speed", name: "가벼운 발걸음", desc: "이동 속도 +12%", tag: "BODY", max: 4, apply: (s) => (s.speed *= 1.12) },
  { id: "vitality", name: "강인함", desc: "최대 체력 +25, 바로 회복", tag: "BODY", max: 5, apply: (s, g) => { s.maxHp += 25; g.player.hp = Math.min(s.maxHp, g.player.hp + 25); } },
  { id: "regen", name: "재생", desc: "초당 체력 1 회복", tag: "BODY", max: 3, apply: (s) => (s.regen += 1) },
  { id: "magnet", name: "마나 자석", desc: "보석을 끌어오는 범위 +40%", tag: "BODY", max: 3, apply: (s) => (s.magnet *= 1.4) },
  { id: "ult_power", name: "빙하의 부름", desc: "궁극기 쿨타임 -15%, 피해 +20%", tag: "ULT", max: 4, apply: (s) => { s.ultCooldown *= 0.85; s.ultDamage *= 1.2; } },
  { id: "air_bombs", name: "융단 폭격", desc: "공습 폭탄 +2발", tag: "AIR", max: 4, apply: (s) => (s.airBombs += 2) },
  { id: "air_cd", name: "제공권 장악", desc: "공습 쿨타임 -15%, 피해 +15%", tag: "AIR", max: 4, apply: (s) => { s.airCooldown *= 0.85; s.airDamage *= 1.15; } },
];

export const TAG_COLOR = { BOLT: "#9bdcff", BODY: "#7ee88a", ULT: "#c8f0ff", AIR: "#ffb04a" };

// what spawns in wave n
export function waveRoster(n) {
  const boss = n % 5 === 0;
  const count = boss ? 4 + n : 5 + n * 3;
  const list = [];
  for (let i = 0; i < count; i++) {
    const r = (i * 7919 + n * 104729) % 100;
    if (n >= 3 && r < 22) list.push("archer");
    else if (n >= 2 && r < 52) list.push("bat");
    else list.push("slime");
  }
  if (boss) list.splice(2, 0, "king");
  return list;
}
export const waveHp = (n) => 1 + 0.16 * (n - 1);
