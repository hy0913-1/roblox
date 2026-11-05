// Game data: classes, skills, items, enemies, quests, the shop. Every tuning number lives here.

// The view in game pixels. It follows the screen's shape (set by fit() in main.js); ES module live bindings mean
// every importer sees the current size.
export let W = 320, H = 180;
export function setView(w, h) {
  W = w;
  H = h;
}

export const TILE = 16;
export const xpForLevel = (lv) => 30 + lv * lv * 12;
export const MAX_LEVEL = 20;
export const BAG_SIZE = 24;

// ---- classes -------------------------------------------------------------------------------------
// base stats at level 1 and what each level adds. skills: the basic attack, then three that open at levels 1/3/5.
export const CLASSES = {
  mage: {
    name: "마법사",
    title: "얼음 마법사",
    desc: "멀리서 얼려 버리는 원거리 마법. 체력은 낮지만 범위 공격이 강해요.",
    base: { maxHp: 80, maxMp: 90, atk: 10, def: 2, speed: 62, crit: 0.08 },
    grow: { maxHp: 10, maxMp: 12, atk: 2.2, def: 0.6 },
    skills: ["bolt", "ring", "blink", "blizzard"],
    weapon: "staff",
    color: "#9bdcff",
  },
  knight: {
    name: "전사",
    title: "왕국 기사",
    desc: "단단한 몸으로 앞에서 베는 근접 전사. 체력과 방어가 높아요.",
    base: { maxHp: 135, maxMp: 45, atk: 11, def: 6, speed: 60, crit: 0.06 },
    grow: { maxHp: 18, maxMp: 5, atk: 2.4, def: 1.4 },
    skills: ["slash", "spin", "dash", "quake"],
    weapon: "sword",
    color: "#ffd27a",
  },
  ranger: {
    name: "궁수",
    title: "숲의 궁수",
    desc: "빠른 발과 긴 사거리의 활. 치명타가 잘 터져요.",
    base: { maxHp: 95, maxMp: 60, atk: 10, def: 3, speed: 68, crit: 0.15 },
    grow: { maxHp: 12, maxMp: 7, atk: 2.3, def: 0.8 },
    skills: ["arrow", "pierce", "rain", "fan"],
    weapon: "bow",
    color: "#9be07a",
  },
};

// aim: "dir" (a direction: drag a touch button, or the mouse), "point" (a spot on the ground), "self" (no aim)
export const SKILLS = {
  bolt: { name: "얼음탄", desc: "얼음 화살을 쏩니다", mp: 0, cd: 0.34, mult: 1.0, aim: "dir", level: 1 },
  ring: { name: "빙하의 고리", desc: "주변을 얼리고 큰 피해", mp: 28, cd: 10, mult: 3.0, aim: "self", level: 1 },
  blink: { name: "블링크", desc: "바라보는 쪽으로 순간이동", mp: 15, cd: 4, aim: "dir", level: 3, range: 72 },
  blizzard: { name: "눈보라", desc: "지정한 곳에 4초간 눈보라", mp: 40, cd: 14, mult: 0.55, aim: "point", level: 5, range: 130, radius: 40 },
  slash: { name: "베기", desc: "앞쪽을 크게 벱니다", mp: 0, cd: 0.42, mult: 1.45, aim: "dir", level: 1, range: 26 },
  spin: { name: "회전 베기", desc: "주위의 적을 모두 벱니다", mp: 18, cd: 6, mult: 2.2, aim: "self", level: 1, radius: 34 },
  dash: { name: "돌진", desc: "앞으로 돌진하며 베고 지나갑니다", mp: 15, cd: 5, mult: 1.8, aim: "dir", level: 3, range: 84 },
  quake: { name: "대지 강타", desc: "땅을 내리쳐 주변을 기절시킵니다", mp: 34, cd: 12, mult: 3.2, aim: "self", level: 5, radius: 46 },
  arrow: { name: "화살", desc: "빠른 화살을 쏩니다", mp: 0, cd: 0.36, mult: 1.1, aim: "dir", level: 1 },
  pierce: { name: "관통 사격", desc: "모든 적을 꿰뚫는 강한 화살", mp: 14, cd: 4, mult: 3.0, aim: "dir", level: 1 },
  rain: { name: "화살비", desc: "지정한 곳에 화살이 쏟아집니다", mp: 28, cd: 10, mult: 0.75, aim: "point", level: 3, range: 140, radius: 30 },
  fan: { name: "부채꼴 사격", desc: "화살 일곱 발을 한 번에", mp: 22, cd: 7, mult: 1.0, aim: "dir", level: 5 },
  air: { name: "공군 공습", desc: "전투기가 폭탄을 줄지어 투하", mp: 0, cd: 28, mult: 3.4, aim: "point", level: 1, range: 150 },
};

// ---- items ---------------------------------------------------------------------------------------
export const RARITY = [
  { id: "common", name: "일반", color: "#d8dce8", mult: 1 },
  { id: "uncommon", name: "고급", color: "#7ee88a", mult: 1.25 },
  { id: "rare", name: "희귀", color: "#6ab4ff", mult: 1.6 },
  { id: "epic", name: "영웅", color: "#c684ff", mult: 2.05 },
  { id: "legendary", name: "전설", color: "#ffb04a", mult: 2.7 },
];

// equipment bases: tier says roughly what level it belongs to
export const GEAR = [
  { base: "staff1", slot: "weapon", cls: "mage", name: "견습 지팡이", tier: 1, stats: { atk: 3 }, icon: "staff" },
  { base: "staff2", slot: "weapon", cls: "mage", name: "참나무 지팡이", tier: 2, stats: { atk: 6, maxMp: 10 }, icon: "staff" },
  { base: "staff3", slot: "weapon", cls: "mage", name: "서리 지팡이", tier: 3, stats: { atk: 10, maxMp: 20 }, icon: "staff" },
  { base: "staff4", slot: "weapon", cls: "mage", name: "대마법사의 홀", tier: 4, stats: { atk: 15, crit: 0.04, maxMp: 30 }, icon: "staff" },
  { base: "sword1", slot: "weapon", cls: "knight", name: "낡은 검", tier: 1, stats: { atk: 3 }, icon: "sword" },
  { base: "sword2", slot: "weapon", cls: "knight", name: "철검", tier: 2, stats: { atk: 6 }, icon: "sword" },
  { base: "sword3", slot: "weapon", cls: "knight", name: "기사의 장검", tier: 3, stats: { atk: 10, def: 2 }, icon: "sword" },
  { base: "sword4", slot: "weapon", cls: "knight", name: "용사의 대검", tier: 4, stats: { atk: 16, maxHp: 20 }, icon: "sword" },
  { base: "bow1", slot: "weapon", cls: "ranger", name: "사냥 활", tier: 1, stats: { atk: 3 }, icon: "bow" },
  { base: "bow2", slot: "weapon", cls: "ranger", name: "장궁", tier: 2, stats: { atk: 6 }, icon: "bow" },
  { base: "bow3", slot: "weapon", cls: "ranger", name: "엘프의 활", tier: 3, stats: { atk: 10, crit: 0.04 }, icon: "bow" },
  { base: "bow4", slot: "weapon", cls: "ranger", name: "바람의 활", tier: 4, stats: { atk: 15, speed: 6, crit: 0.04 }, icon: "bow" },
  { base: "armor1", slot: "armor", name: "천 옷", tier: 1, stats: { def: 1, maxHp: 5 }, icon: "cloth" },
  { base: "armor2", slot: "armor", name: "가죽 갑옷", tier: 2, stats: { def: 3, maxHp: 12 }, icon: "leather" },
  { base: "robe", slot: "armor", name: "마법사 로브", tier: 2, stats: { def: 2, maxMp: 25 }, icon: "robe" },
  { base: "armor3", slot: "armor", name: "사슬 갑옷", tier: 3, stats: { def: 6, maxHp: 22 }, icon: "chain" },
  { base: "armor4", slot: "armor", name: "판금 갑옷", tier: 4, stats: { def: 10, maxHp: 36, speed: -3 }, icon: "plate" },
  { base: "ring1", slot: "trinket", name: "구리 반지", tier: 1, stats: { atk: 1 }, icon: "ring" },
  { base: "ring2", slot: "trinket", name: "은 반지", tier: 2, stats: { crit: 0.04, atk: 1 }, icon: "ring" },
  { base: "amulet1", slot: "trinket", name: "체력의 목걸이", tier: 2, stats: { maxHp: 25 }, icon: "amulet" },
  { base: "amulet2", slot: "trinket", name: "마나의 목걸이", tier: 2, stats: { maxMp: 25 }, icon: "amulet" },
  { base: "charm1", slot: "trinket", name: "바람의 부적", tier: 3, stats: { speed: 8 }, icon: "charm" },
  { base: "charm2", slot: "trinket", name: "수호의 부적", tier: 3, stats: { def: 3, maxHp: 10 }, icon: "charm" },
];
export const STAT_NAME = { atk: "공격", def: "방어", maxHp: "최대 HP", maxMp: "최대 MP", crit: "치명타", speed: "이동속도" };

export const POTIONS = {
  hp: { name: "체력 물약", desc: "HP 60 회복", heal: 60, price: 25, icon: "potionRed" },
  mp: { name: "마나 물약", desc: "MP 50 회복", mana: 50, price: 25, icon: "potionBlue" },
};
export const KEY_ITEMS = {
  wing: { name: "박쥐 날개", desc: "상인 미라가 찾는 재료", icon: "wing" },
  doll: { name: "낡은 헝겊 인형", desc: "토토가 잃어버린 인형", icon: "doll" },
  radio: { name: "군용 무전기", desc: "왕국 공군을 부를 수 있다 (공습 스킬)", icon: "radio" },
};

// what the shop sells: potions and some gear (generated at fixed rarity)
export const SHOP = [
  { kind: "potion", id: "hp" },
  { kind: "potion", id: "mp" },
  { kind: "gear", base: "staff2", rarity: 0, price: 90 },
  { kind: "gear", base: "sword2", rarity: 0, price: 90 },
  { kind: "gear", base: "bow2", rarity: 0, price: 90 },
  { kind: "gear", base: "armor2", rarity: 0, price: 80 },
  { kind: "gear", base: "robe", rarity: 0, price: 80 },
  { kind: "gear", base: "ring2", rarity: 0, price: 120 },
  { kind: "gear", base: "armor3", rarity: 1, price: 260 },
];

// ---- enemies -------------------------------------------------------------------------------------
export const ENEMIES = {
  slime: { name: "슬라임", hp: 26, atk: 7, speed: 30, xp: 6, gold: [1, 4], hitY: 6, rad: 7, sight: 120 },
  bat: { name: "박쥐", hp: 15, atk: 6, speed: 56, xp: 7, gold: [1, 3], hitY: 13, rad: 6, sight: 140, flying: true },
  archer: { name: "해골 궁수", hp: 34, atk: 9, speed: 22, xp: 12, gold: [3, 8], hitY: 9, rad: 6, sight: 150, range: 95, shootEvery: 2.4, arrowSpeed: 115 },
  skeleton: { name: "해골 전사", hp: 48, atk: 11, speed: 34, xp: 14, gold: [3, 9], hitY: 9, rad: 7, sight: 130 },
  king: { name: "킹 슬라임", hp: 620, atk: 16, speed: 17, xp: 160, gold: [80, 120], hitY: 14, rad: 14, sight: 160, boss: true },
  lich: { name: "리치", hp: 1500, atk: 18, speed: 22, xp: 500, gold: [250, 350], hitY: 14, rad: 9, sight: 170, boss: true, flying: true },
};
export const enemyScale = (lv) => ({ hp: 1 + 0.28 * (lv - 1), atk: 1 + 0.16 * (lv - 1) });

// ---- quests --------------------------------------------------------------------------------------
// type: kill (count of an enemy type), collect (count of a key item), boss (an enemy type), find (one key item)
export const QUESTS = {
  q1: {
    giver: "elder", main: true, name: "슬라임 소탕",
    type: "kill", target: "slime", count: 8,
    offer: "마을 밖 숲에 슬라임이 너무 늘었네. 밭이 엉망이야. 여덟 마리만 처치해 주겠나?",
    progress: "숲은 마을 동쪽 길로 나가면 바로일세.",
    done: "고맙네! 자네 실력이 보통이 아니군. 이걸 받게.",
    reward: { xp: 100, gold: 60, potions: { hp: 2 } },
    unlocks: ["q2", "s2"],
  },
  q2: {
    giver: "elder", main: true, name: "슬라임 동굴",
    type: "boss", target: "king", count: 1,
    offer: "슬라임들은 숲 북쪽 동굴에서 나온다네. 동굴 깊은 곳에 거대한 킹 슬라임이 있다는 소문이야. 부디 조심하게.",
    progress: "동굴 입구는 숲 북쪽에 있다네. 어두우니 물약을 넉넉히 챙기게.",
    done: "킹 슬라임을! 정말 해냈군. 왕국에서 보낸 무전기일세. 위급할 때 공군을 부를 수 있지.",
    reward: { xp: 320, gold: 180, item: "radio" },
    unlocks: ["q3"],
  },
  q3: {
    giver: "elder", main: true, name: "고대 묘지의 리치",
    type: "boss", target: "lich", count: 1,
    offer: "마지막 부탁일세. 숲 동쪽 고대 묘지의 봉인이 풀렸어. 죽은 자들을 부리는 리치가 깨어났네. 자네만이 막을 수 있어.",
    progress: "묘지의 문은 이제 열려 있을 걸세. 해골들이 지키고 있으니 각오하게.",
    done: "마을을 구했군! 자네는 이 마을의 영웅일세. 이 보물은 자네 것이야.",
    reward: { xp: 900, gold: 600, gear: { tier: 4, rarity: 4 } },
    unlocks: [],
    ending: true,
  },
  s1: {
    giver: "merchant", name: "박쥐 날개 모으기",
    type: "collect", target: "wing", count: 5,
    offer: "박쥐 날개로 좋은 약을 만들 수 있거든요. 다섯 개만 구해다 주실래요? 숲이나 동굴의 박쥐가 떨어뜨려요.",
    progress: "박쥐 날개 다섯 개, 잊지 마세요!",
    done: "와, 다 모으셨네요! 약속한 보수예요.",
    reward: { xp: 90, gold: 120, potions: { mp: 2 } },
    unlocks: [],
  },
  s2: {
    giver: "guard", name: "해골 궁수 퇴치",
    type: "kill", target: "archer", count: 6,
    offer: "숲 동쪽에서 해골 궁수들이 순찰병을 쏘고 있소. 여섯 놈만 처리해 주시오. 보답은 하겠소.",
    progress: "궁수들은 거리를 벌리니 바짝 붙어 싸우시오.",
    done: "훌륭하오! 내가 쓰던 갑옷이오. 받아 주시오.",
    reward: { xp: 160, gold: 80, gear: { base: "armor3", rarity: 2 } },
    unlocks: [],
  },
  s3: {
    giver: "kid", name: "잃어버린 인형",
    type: "find", target: "doll", count: 1,
    offer: "숲에서 놀다가 인형을 잃어버렸어요… 호숫가 상자에 넣어 뒀던 것 같은데, 찾아 주실 수 있어요?",
    progress: "호숫가에 상자가 있었어요! 큰 호수 근처요.",
    done: "내 인형! 고맙습니다! 엄마가 만든 물약인데 드릴게요.",
    reward: { xp: 80, gold: 20, potions: { hp: 3 } },
    unlocks: [],
  },
};
export const START_QUESTS = ["q1", "s1", "s3"];

export const NPCS = {
  elder: { name: "촌장 하르덴", sprite: "elder", greet: "어서 오게, 젊은이. 이 마을에 무슨 일인가?" },
  merchant: { name: "상인 미라", sprite: "merchant", greet: "어서 오세요! 물약, 장비 다 있어요.", shop: true },
  guard: { name: "경비병 브론", sprite: "guard", greet: "마을은 내가 지키오. 밖은 위험하니 조심하시오." },
  kid: { name: "꼬마 토토", sprite: "kid", greet: "모험가님이다! 칼 있어요? 마법 쓸 줄 알아요?" },
};
