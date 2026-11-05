// Game data: classes and job advancements, skills, items, enemies, regions, quests, events. Every number lives here.

// The view in game pixels, set by fit() in main.js to the screen's shape; live bindings keep importers current.
export let W = 320, H = 180;
export function setView(w, h) {
  W = w;
  H = h;
}

export const TILE = 16;
export const xpForLevel = (lv) => Math.round(30 + lv * lv * 11 + lv ** 3 * 0.6);
export const MAX_LEVEL = 30;
export const BAG_SIZE = 30;
export const JOB_LEVELS = [10, 20]; // 2nd and 3rd job

// ---- classes & jobs --------------------------------------------------------------------------------
// skills: [basic, Lv1, Lv3, Lv5]. Each class branches at its 2nd job; the branch gives a 2nd-job skill (slot 4)
// and a 3rd-job skill (slot 5), and multiplies damage.
export const CLASSES = {
  mage: {
    name: "마법사", title: "견습 마법사", color: "#9bdcff", weapon: "staff",
    desc: "멀리서 얼리고 태우는 원거리 마법. 체력은 낮지만 범위 공격이 강해요.",
    base: { maxHp: 80, maxMp: 100, atk: 10, def: 2, speed: 62, crit: 0.08 },
    grow: { maxHp: 10, maxMp: 13, atk: 2.3, def: 0.6 },
    skills: ["bolt", "ring", "blink", "blizzard"],
    branches: {
      frost: { name: ["빙결술사", "서리의 군주"], desc: "얼음 창과 절대영도. 적을 얼려 묶어요.", skills: ["icelance", "absolute"], tint: "#9bdcff" },
      fire: { name: ["화염술사", "불꽃의 대마법사"], desc: "폭발하는 화염구와 하늘에서 떨어지는 메테오.", skills: ["fireball", "meteor"], tint: "#ff8a3a" },
    },
  },
  knight: {
    name: "전사", title: "견습 기사", color: "#ffd27a", weapon: "sword",
    desc: "단단한 몸으로 앞에서 베는 근접 전사. 체력과 방어가 높아요.",
    base: { maxHp: 140, maxMp: 45, atk: 11, def: 6, speed: 60, crit: 0.06 },
    grow: { maxHp: 19, maxMp: 5, atk: 2.5, def: 1.4 },
    skills: ["slash", "spin", "dash", "quake"],
    branches: {
      berserker: { name: ["버서커", "워로드"], desc: "광폭화로 몰아치고 대지를 가른다.", skills: ["rage", "cleave"], tint: "#ff5a4a" },
      paladin: { name: ["나이트", "팔라딘"], desc: "수호의 방패로 버티고 심판의 빛을 내린다.", skills: ["aegis", "judgment"], tint: "#ffe066" },
    },
  },
  ranger: {
    name: "궁수", title: "견습 궁수", color: "#9be07a", weapon: "bow",
    desc: "빠른 발과 긴 사거리의 활. 치명타가 잘 터져요.",
    base: { maxHp: 95, maxMp: 60, atk: 10, def: 3, speed: 68, crit: 0.15 },
    grow: { maxHp: 12, maxMp: 7, atk: 2.4, def: 0.8 },
    skills: ["arrow", "pierce", "rain", "fan"],
    branches: {
      hunter: { name: ["헌터", "보우마스터"], desc: "폭발 화살과 폭풍의 화살로 무리를 쓸어요.", skills: ["explosive", "storm"], tint: "#7ee88a" },
      sniper: { name: ["저격수", "신궁"], desc: "한 발의 저격과 하늘의 뇌전.", skills: ["snipe", "thunder"], tint: "#c8f0ff" },
    },
  },
  thief: {
    name: "도적", title: "견습 도적", color: "#c684ff", weapon: "dagger",
    desc: "표창과 단검의 속도전. 은신과 독으로 몰래 잡아요.",
    base: { maxHp: 90, maxMp: 60, atk: 10, def: 3, speed: 72, crit: 0.18 },
    grow: { maxHp: 11, maxMp: 7, atk: 2.4, def: 0.7 },
    skills: ["star", "flurry", "stealth", "poison"],
    branches: {
      assassin: { name: ["어쌔신", "나이트로드"], desc: "사방으로 표창을 뿌리고 암흑 소용돌이로 빨아들여요.", skills: ["starstorm", "vortex"], tint: "#9a48ec" },
      blade: { name: ["시프", "섀도어"], desc: "연속 베기로 파고들고 암흑 폭발로 마무리.", skills: ["assault", "eclipse"], tint: "#ff4a8a" },
    },
  },
};
export const JOB_BONUS = [1, 1.15, 1.35]; // damage by job rank

// aim: "dir" | "point" | "self". mult is of attack.
export const SKILLS = {
  bolt: { name: "얼음탄", mp: 0, cd: 0.34, mult: 1.0, aim: "dir", level: 1 },
  ring: { name: "빙하의 고리", mp: 26, cd: 10, mult: 3.0, aim: "self", level: 1 },
  blink: { name: "블링크", mp: 14, cd: 4, aim: "dir", level: 3, range: 72 },
  blizzard: { name: "눈보라", mp: 38, cd: 14, mult: 0.55, aim: "point", level: 5, range: 130, radius: 40 },
  icelance: { name: "얼음 창", mp: 22, cd: 3, mult: 2.2, aim: "dir", level: 10 },
  absolute: { name: "절대영도", mp: 70, cd: 22, mult: 6, aim: "self", level: 20, radius: 90 },
  fireball: { name: "화염구", mp: 20, cd: 2.5, mult: 2.4, aim: "dir", level: 10 },
  meteor: { name: "메테오", mp: 70, cd: 20, mult: 7, aim: "point", level: 20, range: 150, radius: 46 },

  slash: { name: "베기", mp: 0, cd: 0.42, mult: 1.45, aim: "dir", level: 1, range: 26 },
  spin: { name: "회전 베기", mp: 16, cd: 6, mult: 2.2, aim: "self", level: 1, radius: 34 },
  dash: { name: "돌진", mp: 14, cd: 5, mult: 1.8, aim: "dir", level: 3, range: 84 },
  quake: { name: "대지 강타", mp: 30, cd: 12, mult: 3.2, aim: "self", level: 5, radius: 46 },
  rage: { name: "광폭화", mp: 30, cd: 24, aim: "self", level: 10, buff: { atk: 0.4, speed: 0.2 }, dur: 10 },
  cleave: { name: "대지 가르기", mp: 60, cd: 16, mult: 6.5, aim: "dir", level: 20, range: 110 },
  aegis: { name: "수호의 방패", mp: 30, cd: 22, aim: "self", level: 10, buff: { guard: 0.6 }, dur: 8, heal: 0.25 },
  judgment: { name: "심판의 빛", mp: 60, cd: 16, mult: 6, aim: "point", level: 20, range: 120, radius: 44, heal: 0.2 },

  arrow: { name: "화살", mp: 0, cd: 0.36, mult: 1.1, aim: "dir", level: 1 },
  pierce: { name: "관통 사격", mp: 14, cd: 4, mult: 3.0, aim: "dir", level: 1 },
  rain: { name: "화살비", mp: 26, cd: 10, mult: 0.75, aim: "point", level: 3, range: 140, radius: 30 },
  fan: { name: "부채꼴 사격", mp: 22, cd: 7, mult: 1.0, aim: "dir", level: 5 },
  explosive: { name: "폭발 화살", mp: 18, cd: 2.5, mult: 2.6, aim: "dir", level: 10, radius: 26 },
  storm: { name: "폭풍의 화살", mp: 60, cd: 18, mult: 0.9, aim: "point", level: 20, range: 140, radius: 44 },
  snipe: { name: "저격", mp: 24, cd: 5, mult: 7, aim: "dir", level: 10 },
  thunder: { name: "뇌전의 화살", mp: 60, cd: 16, mult: 4.5, aim: "point", level: 20, range: 150, radius: 30 },

  star: { name: "표창", mp: 0, cd: 0.3, mult: 1.0, aim: "dir", level: 1 },
  flurry: { name: "더블 스탭", mp: 12, cd: 3, mult: 2.6, aim: "dir", level: 1, range: 28 },
  stealth: { name: "은신", mp: 20, cd: 14, aim: "self", level: 3, dur: 3.5 },
  poison: { name: "독 안개", mp: 30, cd: 12, mult: 0.5, aim: "point", level: 5, range: 120, radius: 40 },
  starstorm: { name: "표창 폭풍", mp: 24, cd: 4, mult: 1.6, aim: "self", level: 10 },
  vortex: { name: "암흑 소용돌이", mp: 65, cd: 18, mult: 0.8, aim: "point", level: 20, range: 130, radius: 46 },
  assault: { name: "연속 베기", mp: 22, cd: 4, mult: 1.6, aim: "dir", level: 10, range: 90 },
  eclipse: { name: "암흑 폭발", mp: 65, cd: 16, mult: 7, aim: "self", level: 20, radius: 60 },

  air: { name: "공군 공습", mp: 0, cd: 28, mult: 3.4, aim: "point", level: 1, range: 150 },
};

// ---- items -----------------------------------------------------------------------------------------
export const SLOTS = [["weapon", "무기"], ["helmet", "투구"], ["armor", "갑옷"], ["boots", "신발"], ["trinket", "장신구"]];
export const RARITY = [
  { id: "common", name: "일반", color: "#d8dce8", mult: 1, affixes: 0 },
  { id: "uncommon", name: "고급", color: "#7ee88a", mult: 1.2, affixes: 1 },
  { id: "rare", name: "희귀", color: "#6ab4ff", mult: 1.45, affixes: 1 },
  { id: "epic", name: "영웅", color: "#c684ff", mult: 1.8, affixes: 2 },
  { id: "legendary", name: "전설", color: "#ffb04a", mult: 2.3, affixes: 3 },
];
const T6 = (names, base, step, icon, slot, cls, extra = {}) => names.map((n, i) => ({ base: `${icon}${i + 1}`, slot, cls, name: n, tier: i + 1, icon, stats: Object.fromEntries(Object.entries(base).map(([k, v]) => [k, Math.round((v + step[k] * i) * 100) / 100])), ...extra }));
export const GEAR = [
  ...T6(["견습 지팡이", "참나무 지팡이", "서리 지팡이", "룬 지팡이", "대마법사의 홀", "별의 지팡이"], { atk: 3, maxMp: 0 }, { atk: 4, maxMp: 8 }, "staff", "weapon", "mage"),
  ...T6(["낡은 검", "철검", "기사의 장검", "강철 대검", "용사의 대검", "성검"], { atk: 3 }, { atk: 4.4 }, "sword", "weapon", "knight"),
  ...T6(["사냥 활", "장궁", "엘프의 활", "합성 활", "바람의 활", "천공의 활"], { atk: 3, crit: 0 }, { atk: 4.2, crit: 0.01 }, "bow", "weapon", "ranger"),
  ...T6(["녹슨 단검", "철 단검", "그림자 단검", "쌍둥이 단검", "독사의 이빨", "어둠의 단검"], { atk: 3, crit: 0.01 }, { atk: 4.1, crit: 0.01 }, "dagger", "weapon", "thief"),
  ...T6(["가죽 모자", "철 투구", "기사 투구", "룬 투구", "용비늘 투구", "왕관"], { def: 1, maxHp: 4 }, { def: 1.5, maxHp: 8 }, "helmet", "helmet"),
  ...T6(["천 옷", "가죽 갑옷", "사슬 갑옷", "판금 갑옷", "용비늘 갑옷", "성스러운 갑옷"], { def: 2, maxHp: 8 }, { def: 2.4, maxHp: 14 }, "armor", "armor"),
  ...T6(["짚신", "가죽 장화", "철 장화", "바람 장화", "용비늘 장화", "천마의 장화"], { def: 1, speed: 1 }, { def: 1, speed: 1.2 }, "boots", "boots"),
  ...T6(["구리 반지", "은 반지", "체력의 목걸이", "마나의 목걸이", "수호의 부적", "용의 심장"], { atk: 1, maxHp: 0 }, { atk: 1.4, maxHp: 10 }, "ring", "trinket"),
];
// prefixes rolled onto better gear
export const AFFIXES = [
  { name: "날카로운", stat: "crit", v: (t) => 0.02 + 0.006 * t },
  { name: "강력한", stat: "atk", v: (t) => 2 + 2.2 * t },
  { name: "튼튼한", stat: "def", v: (t) => 1 + 1.4 * t },
  { name: "활력의", stat: "maxHp", v: (t) => 10 + 12 * t },
  { name: "지혜의", stat: "maxMp", v: (t) => 8 + 8 * t },
  { name: "신속한", stat: "speed", v: (t) => 2 + t },
  { name: "흡혈의", stat: "lifesteal", v: (t) => 0.01 + 0.004 * t },
];
// named legendaries, dropped by bosses
export const UNIQUES = [
  { name: "서리왕의 홀", slot: "weapon", cls: "mage", icon: "staff", tier: 6, stats: { atk: 38, maxMp: 80, crit: 0.08 } },
  { name: "용살자의 대검", slot: "weapon", cls: "knight", icon: "sword", tier: 6, stats: { atk: 42, maxHp: 120, lifesteal: 0.04 } },
  { name: "바람 정령의 활", slot: "weapon", cls: "ranger", icon: "bow", tier: 6, stats: { atk: 38, speed: 10, crit: 0.1 } },
  { name: "그림자 송곳니", slot: "weapon", cls: "thief", icon: "dagger", tier: 6, stats: { atk: 37, crit: 0.14, lifesteal: 0.03 } },
  { name: "드래곤 하트", slot: "trinket", icon: "amulet", tier: 6, stats: { atk: 14, maxHp: 160, def: 8 } },
  { name: "마왕의 왕관", slot: "helmet", icon: "helmet", tier: 6, stats: { atk: 12, def: 16, maxMp: 60, crit: 0.06 } },
];
export const STAT_NAME = { atk: "공격", def: "방어", maxHp: "최대 HP", maxMp: "최대 MP", crit: "치명타", speed: "이동속도", lifesteal: "흡혈" };
export const PCT_STATS = new Set(["crit", "lifesteal"]);

export const POTIONS = {
  hp: { name: "체력 물약", desc: "HP 60 회복", heal: 60, price: 20, icon: "potionRed" },
  hp2: { name: "고급 체력 물약", desc: "HP 250 회복", heal: 250, price: 70, icon: "potionRed" },
  mp: { name: "마나 물약", desc: "MP 50 회복", mana: 50, price: 20, icon: "potionBlue" },
  mp2: { name: "고급 마나 물약", desc: "MP 200 회복", mana: 200, price: 70, icon: "potionBlue" },
  elixir: { name: "힘의 비약", desc: "60초간 공격 +25%", buff: { atk: 0.25 }, dur: 60, price: 120, icon: "elixir" },
  scroll: { name: "귀환 주문서", desc: "마을로 돌아갑니다", price: 40, icon: "scroll" },
};
export const KEY_ITEMS = {
  wing: { name: "박쥐 날개", desc: "상인 미라가 찾는 재료", icon: "wing" },
  doll: { name: "낡은 헝겊 인형", desc: "토토가 잃어버린 인형", icon: "doll" },
  radio: { name: "군용 무전기", desc: "왕국 공군을 부를 수 있다 (공습 스킬)", icon: "radio" },
  ore: { name: "철광석", desc: "대장장이 그론이 찾는 광석", icon: "ore" },
  token: { name: "시련의 증표", desc: "3차 전직에 필요한 증표", icon: "token" },
};
export const SHOP = [
  { kind: "potion", id: "hp" }, { kind: "potion", id: "mp" }, { kind: "potion", id: "hp2", minLv: 10 }, { kind: "potion", id: "mp2", minLv: 10 },
  { kind: "potion", id: "elixir", minLv: 8 }, { kind: "potion", id: "scroll" },
  { kind: "gear", tier: 2, slot: "weapon", rarity: 0 }, { kind: "gear", tier: 2, slot: "helmet", rarity: 0 }, { kind: "gear", tier: 2, slot: "armor", rarity: 0 },
  { kind: "gear", tier: 2, slot: "boots", rarity: 0 }, { kind: "gear", tier: 3, slot: "weapon", rarity: 1, minLv: 8 }, { kind: "gear", tier: 3, slot: "armor", rarity: 1, minLv: 8 },
  { kind: "gear", tier: 4, slot: "weapon", rarity: 1, minLv: 14 }, { kind: "gear", tier: 4, slot: "armor", rarity: 1, minLv: 14 },
];
// the blacksmith: +1..+10, each step +8% to the item's stats
export const ENHANCE = { max: 10, rate: (n) => Math.max(0.3, 0.95 - n * 0.07), cost: (it) => Math.round(it.value * (0.6 + it.plus * 0.5)) };

// ---- enemies ---------------------------------------------------------------------------------------
export const ENEMIES = {
  slime: { name: "슬라임", hp: 26, atk: 7, speed: 30, xp: 6, gold: [1, 4], hitY: 6, rad: 7, sight: 120 },
  bat: { name: "박쥐", hp: 15, atk: 6, speed: 56, xp: 7, gold: [1, 3], hitY: 13, rad: 6, sight: 140, flying: true },
  archer: { name: "해골 궁수", hp: 34, atk: 9, speed: 22, xp: 12, gold: [3, 8], hitY: 9, rad: 6, sight: 150, range: 95, shootEvery: 2.4, arrowSpeed: 115 },
  skeleton: { name: "해골 전사", hp: 48, atk: 11, speed: 34, xp: 14, gold: [3, 9], hitY: 9, rad: 7, sight: 130 },
  wolf: { name: "늑대", hp: 40, atk: 10, speed: 62, xp: 14, gold: [2, 6], hitY: 6, rad: 7, sight: 150 },
  orc: { name: "오크 전사", hp: 80, atk: 15, speed: 30, xp: 22, gold: [5, 12], hitY: 10, rad: 8, sight: 140 },
  golem: { name: "바위 골렘", hp: 150, atk: 18, speed: 20, xp: 30, gold: [6, 14], hitY: 11, rad: 9, sight: 110, ore: 0.35 },
  imp: { name: "화염 임프", hp: 55, atk: 14, speed: 40, xp: 26, gold: [5, 12], hitY: 12, rad: 6, sight: 150, flying: true, range: 100, shootEvery: 2.2, arrowSpeed: 100 },
  magma: { name: "마그마 슬라임", hp: 70, atk: 16, speed: 30, xp: 26, gold: [4, 10], hitY: 6, rad: 7, sight: 120 },
  yeti: { name: "예티", hp: 120, atk: 20, speed: 34, xp: 34, gold: [6, 14], hitY: 11, rad: 9, sight: 140, range: 110, shootEvery: 3, arrowSpeed: 105 },
  icegolem: { name: "얼음 골렘", hp: 200, atk: 22, speed: 20, xp: 40, gold: [8, 16], hitY: 11, rad: 9, sight: 110 },
  demon: { name: "악마 병사", hp: 160, atk: 26, speed: 46, xp: 48, gold: [10, 20], hitY: 10, rad: 8, sight: 150 },
  gargoyle: { name: "가고일", hp: 120, atk: 22, speed: 50, xp: 44, gold: [8, 18], hitY: 14, rad: 7, sight: 160, flying: true, range: 110, shootEvery: 2.4, arrowSpeed: 120 },
  goldslime: { name: "황금 슬라임", hp: 60, atk: 1, speed: 46, xp: 30, gold: [80, 140], hitY: 6, rad: 7, sight: 130, flee: true, event: true },
  goblin: { name: "보물 고블린", hp: 120, atk: 1, speed: 52, xp: 40, gold: [60, 120], hitY: 8, rad: 7, sight: 160, flee: true, event: true },
  king: { name: "킹 슬라임", hp: 620, atk: 16, speed: 17, xp: 160, gold: [80, 120], hitY: 14, rad: 14, sight: 160, boss: true },
  lich: { name: "리치", hp: 1100, atk: 18, speed: 22, xp: 420, gold: [200, 300], hitY: 14, rad: 9, sight: 170, boss: true, flying: true },
  chief: { name: "오크 족장", hp: 1400, atk: 26, speed: 30, xp: 600, gold: [250, 350], hitY: 14, rad: 12, sight: 160, boss: true },
  drake: { name: "화염 드레이크", hp: 2400, atk: 32, speed: 34, xp: 1300, gold: [400, 600], hitY: 18, rad: 16, sight: 190, boss: true, flying: true },
  giant: { name: "서리 거인", hp: 3000, atk: 38, speed: 22, xp: 1800, gold: [500, 700], hitY: 22, rad: 16, sight: 170, boss: true },
  demonking: { name: "마왕 바엘", hp: 5200, atk: 44, speed: 30, xp: 4000, gold: [1200, 1600], hitY: 22, rad: 14, sight: 200, boss: true },
};
export const enemyScale = (lv) => ({ hp: 1 + 0.3 * (lv - 1), atk: 1 + 0.17 * (lv - 1) });

// ---- quests ----------------------------------------------------------------------------------------
// type: kill (an enemy type, or "any" in a region), collect/find (key items), boss (an enemy type), level
export const QUESTS = {
  q1: { giver: "elder", main: true, name: "슬라임 소탕", type: "kill", target: "slime", count: 8,
    offer: "마을 밖 숲에 슬라임이 너무 늘었네. 밭이 엉망이야. 여덟 마리만 처치해 주겠나?",
    progress: "숲은 마을 동쪽 길로 나가면 바로일세.", done: "고맙네! 자네 실력이 보통이 아니군. 이걸 받게.",
    reward: { xp: 100, gold: 60, potions: { hp: 2 } }, unlocks: ["q2", "s2"] },
  q2: { giver: "elder", main: true, name: "슬라임 동굴", type: "boss", target: "king", count: 1,
    offer: "슬라임들은 숲 북쪽 동굴에서 나온다네. 동굴 깊은 곳에 거대한 킹 슬라임이 있다는 소문이야.",
    progress: "동굴 입구는 숲 북쪽에 있다네. 물약을 넉넉히 챙기게.", done: "킹 슬라임을! 왕국에서 보낸 무전기일세. 위급할 때 공군을 부를 수 있지.",
    reward: { xp: 320, gold: 180, item: "radio" }, unlocks: ["q3"] },
  q3: { giver: "elder", main: true, name: "고대 묘지의 리치", type: "boss", target: "lich", count: 1,
    offer: "숲 동쪽 고대 묘지의 봉인이 풀렸어. 죽은 자들을 부리는 리치가 깨어났네.",
    progress: "묘지의 문은 이제 열려 있을 걸세.", done: "리치를 쓰러뜨리다니! 하지만 리치가 남긴 말이 마음에 걸리네… '마왕께서 돌아오신다'라니.",
    reward: { xp: 900, gold: 400, gear: { tier: 3, rarity: 3 } }, unlocks: ["q4"] },
  q4: { giver: "guard", main: true, name: "고원의 오크 족장", type: "boss", target: "chief", count: 1,
    offer: "숲 남쪽 고원에 오크들이 진을 쳤소. 족장이 마왕의 깃발을 들고 있다는 보고요. 쓰러뜨려 주시오.",
    progress: "오크 진영은 고원 한가운데요. 족장은 거칠게 돌진하니 조심하시오.", done: "족장을 쓰러뜨렸군! 마왕군이 정말 움직이고 있소.",
    reward: { xp: 1600, gold: 600, gear: { tier: 4, rarity: 3 } }, unlocks: ["q5", "q6"] },
  q5: { giver: "elder", main: true, name: "화산의 드레이크", type: "boss", target: "drake", count: 1,
    offer: "고원 동쪽 화산에 마왕의 화염 드레이크가 깨어났다네. 녀석을 막지 않으면 고원이 불탈 걸세.",
    progress: "화산 입구는 고원 동쪽일세. 용암을 밟지 않게 조심하게.", done: "드레이크를! 자네는 정말 영웅이군.",
    reward: { xp: 3200, gold: 1200, gear: { tier: 5, rarity: 4 } }, unlocks: ["q7"] },
  q6: { giver: "guard", main: true, name: "얼음 동굴의 거인", type: "boss", target: "giant", count: 1,
    offer: "고원 서쪽 얼음 동굴에서 서리 거인이 마왕군에 합류했소. 막아 주시오.",
    progress: "얼음 동굴은 고원 서쪽이오.", done: "거인을 쓰러뜨렸군! 이제 마왕의 탑으로 가는 길이 열릴 거요.",
    reward: { xp: 3800, gold: 1400, gear: { tier: 5, rarity: 4 } }, unlocks: ["q7"] },
  q7: { giver: "elder", main: true, name: "마왕의 탑", type: "boss", target: "demonking", count: 1, needs: ["q5", "q6"],
    offer: "드레이크와 거인이 쓰러지자 고원 남쪽의 마왕의 탑 봉인이 풀렸네. 마지막일세. 마왕 바엘을 막아 주게!",
    progress: "탑은 고원 남쪽일세. 부디 살아서 돌아오게.", done: "마왕을… 쓰러뜨렸군! 세상이 자네를 기억할 걸세. 영웅이여, 고맙네.",
    reward: { xp: 8000, gold: 5000, unique: "드래곤 하트" }, unlocks: [], ending: true },
  j2: { giver: "jobmaster", main: true, name: "2차 전직의 시험", type: "kill", target: "any", region: "highlands", count: 20, minLevel: 10,
    offer: "레벨 10이 되었군. 2차 전직을 원한다면 고원의 몬스터 스무 마리를 쓰러뜨려 실력을 증명해라.",
    progress: "고원은 숲 남쪽이다. 스무 마리.", done: "훌륭하다. 이제 너의 길을 골라라.", reward: { xp: 800, gold: 200 }, unlocks: [], job: 2 },
  j3: { giver: "jobmaster", main: true, name: "3차 전직의 시험", type: "find", target: "token", count: 1, minLevel: 20,
    offer: "레벨 20이군. 3차 전직은 쉽지 않다. 화산의 드레이크나 얼음 동굴의 거인이 지닌 '시련의 증표'를 가져와라.",
    progress: "드레이크나 서리 거인을 쓰러뜨리면 증표를 얻을 것이다.", done: "증표를 가져왔군. 너는 이제 진정한 강자다.", reward: { xp: 3000, gold: 600 }, unlocks: [], job: 3 },
  s1: { giver: "merchant", name: "박쥐 날개 모으기", type: "collect", target: "wing", count: 5,
    offer: "박쥐 날개로 좋은 약을 만들 수 있거든요. 다섯 개만 구해다 주실래요?",
    progress: "박쥐 날개 다섯 개, 잊지 마세요!", done: "와, 다 모으셨네요! 약속한 보수예요.", reward: { xp: 90, gold: 120, potions: { mp: 2 } }, unlocks: [] },
  s2: { giver: "guard", name: "해골 궁수 퇴치", type: "kill", target: "archer", count: 6,
    offer: "숲 동쪽에서 해골 궁수들이 순찰병을 쏘고 있소. 여섯 놈만 처리해 주시오.",
    progress: "궁수들은 거리를 벌리니 바짝 붙어 싸우시오.", done: "훌륭하오! 내가 쓰던 갑옷이오.", reward: { xp: 160, gold: 80, gear: { tier: 3, slot: "armor", rarity: 2 } }, unlocks: [] },
  s3: { giver: "kid", name: "잃어버린 인형", type: "find", target: "doll", count: 1,
    offer: "숲에서 놀다가 인형을 잃어버렸어요… 호숫가 상자에 넣어 뒀던 것 같은데, 찾아 주실 수 있어요?",
    progress: "호숫가에 상자가 있었어요! 큰 호수 근처요.", done: "내 인형! 고맙습니다!", reward: { xp: 80, gold: 20, potions: { hp: 3 } }, unlocks: [] },
  s4: { giver: "smith", name: "대장장이의 부탁", type: "collect", target: "ore", count: 8, minLevel: 8,
    offer: "좋은 강화를 하려면 철광석이 필요해. 고원의 바위 골렘이 품고 있지. 여덟 개만 가져다주게.",
    progress: "바위 골렘을 부수면 철광석이 나온다네.", done: "좋은 광석이군! 내가 만든 장화를 주지.", reward: { xp: 600, gold: 300, gear: { tier: 4, slot: "boots", rarity: 3 } }, unlocks: [] },
};
export const START_QUESTS = ["q1", "s1", "s3"];
export const LEVEL_QUESTS = ["j2", "j3", "s4"]; // appear once you reach their minLevel

// bounties on the village board: a fresh one after each is claimed
export const BOUNTIES = [
  { target: "slime", region: "forest", count: 10, lv: 1 }, { target: "bat", region: "forest", count: 8, lv: 2 }, { target: "archer", region: "forest", count: 8, lv: 4 },
  { target: "wolf", region: "highlands", count: 10, lv: 9 }, { target: "orc", region: "highlands", count: 8, lv: 11 }, { target: "golem", region: "highlands", count: 6, lv: 12 },
  { target: "imp", region: "volcano", count: 10, lv: 14 }, { target: "yeti", region: "icecave", count: 8, lv: 17 }, { target: "demon", region: "tower", count: 10, lv: 21 },
];

export const NPCS = {
  elder: { name: "촌장 하르덴", greet: "어서 오게, 젊은이. 이 마을에 무슨 일인가?" },
  merchant: { name: "상인 미라", greet: "어서 오세요! 물약, 장비 다 있어요.", shop: true },
  guard: { name: "경비대장 브론", greet: "마을은 내가 지키오. 밖은 위험하니 조심하시오." },
  kid: { name: "꼬마 토토", greet: "모험가님이다! 칼 있어요? 마법 쓸 줄 알아요?" },
  jobmaster: { name: "전직관 아르테", greet: "강해지고 싶은가? 레벨 10과 20에 나를 찾아와라." },
  smith: { name: "대장장이 그론", greet: "장비를 강화하고 싶나? 실패해도 부서지진 않네. 골드만 날아갈 뿐이지.", smith: true },
  board: { name: "현상수배 게시판", greet: "" },
  wanderer: { name: "떠돌이 상인 루", greet: "흐흐, 운이 좋군. 귀한 물건이 있다네." },
};
