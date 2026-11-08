// 카드 데이터. 숫자와 효과는 전부 여기서 조정한다.
//
// 효과(fx) 문법: { do: 종류, ...인자 }
//   dmg {n, to}        to: tgt(고른 대상) enemyHero myHero randEnemy(times) allEnemyUnits allEnemies allUnits otherUnits
//   drain {n}          고른 대상에 n 피해, 내 영웅 n 회복
//   heal {n, to}       to: tgt myHero
//   armor {n}          내 영웅 방어도 +n
//   draw {n}           카드 n장 뽑기
//   buff {a, h, to, kw} to: tgt self allyUnits otherAllyUnits, kw: 추가 키워드
//   summon {id, n}     토큰 소환
//   destroy {to:'tgt'} / freeze {to} / silence {to:'tgt'}
//   mana {n}           이번 턴 에너지 +n
//   armorDmg           고른 대상에 내 방어도만큼 피해
//   sacrifice {draw}   고른 아군 유닛을 파괴하고 카드 draw장
//   selfHit {n}        내 영웅이 n 피해
//   selfAtk {n}        (트리거) 이 유닛 공격력 +n
//
// 대상(tg): enemy enemyUnit enemyUnit4(공격력 4 이상) allyUnit(자신 제외) anyUnit(자신 제외) friendly(아군 유닛+내 영웅) any
// 트리거: play(출전/주문) death(유언) turnEnd(턴 종료) onSpell(내가 주문을 쓸 때) onAnyDeath(유닛이 죽을 때마다)

export const KEYWORDS = {
  taunt: { name: '수호', desc: '적은 이 유닛부터 공격해야 해요.' },
  charge: { name: '돌진', desc: '낸 턴에 바로 공격할 수 있어요.' },
  shield: { name: '보호막', desc: '처음 받는 피해 한 번을 막아요.' },
  poison: { name: '맹독', desc: '이 유닛에게 피해를 받은 유닛은 죽어요.' },
  lifesteal: { name: '흡혈', desc: '준 피해만큼 내 영웅이 회복해요.' },
  windfury: { name: '질풍', desc: '한 턴에 두 번 공격할 수 있어요.' },
  stealth: { name: '은신', desc: '공격하기 전까지 적이 대상으로 고를 수 없어요.' },
};

export const FACTIONS = {
  fire: {
    name: '불꽃', color: '#e0643f',
    style: '빠른 공격과 직접 피해로 몰아붙이는 덱',
    power: { name: '불씨', cost: 2, tg: 'enemy', fx: [{ do: 'dmg', n: 1, to: 'tgt' }], text: '적 하나에 1 피해' },
  },
  steel: {
    name: '강철', color: '#8fa3b8',
    style: '수호와 방어도로 버티다 큰 유닛으로 이기는 덱',
    power: { name: '강철 갑옷', cost: 2, fx: [{ do: 'armor', n: 2 }], text: '방어도 +2' },
  },
  arcane: {
    name: '비전', color: '#9b6cf2',
    style: '주문과 카드 뽑기, 빙결로 판을 조종하는 덱',
    power: { name: '금지된 지식', cost: 2, fx: [{ do: 'draw', n: 1 }, { do: 'selfHit', n: 1 }], text: '카드 1장 뽑고 내 영웅 1 피해' },
  },
  wild: {
    name: '야생', color: '#4cb06c',
    style: '작은 유닛을 많이 깔고 한꺼번에 강화하는 덱',
    power: { name: '늑대 호출', cost: 2, summon: true, fx: [{ do: 'summon', id: 'tw', n: 1 }], text: '1/1 늑대 소환' },
  },
  shadow: {
    name: '그림자', color: '#c0457a',
    style: '유언, 맹독, 흡혈로 손해 보는 교환을 이득으로 바꾸는 덱',
    power: { name: '생명 흡수', cost: 2, tg: 'enemyUnit', fx: [{ do: 'drain', n: 1 }], text: '적 유닛 하나에 1 피해, 내 영웅 1 회복' },
  },
  neutral: { name: '중립', color: '#b7a98b', style: '어느 덱에나 넣을 수 있는 카드', power: null },
};

const U = (id, fac, name, cost, atk, hp, extra = {}) => ({ id, fac, name, cost, type: 'unit', atk, hp, ...extra });
const S = (id, fac, name, cost, extra = {}) => ({ id, fac, name, cost, type: 'spell', ...extra });

const LIST = [
  // ---------- 토큰 (덱에 넣을 수 없음) ----------
  U('tw', 'wild', '늑대', 1, 1, 1, { token: true }),
  U('ts', 'wild', '묘목', 2, 2, 2, { token: true }),
  U('tg', 'shadow', '망령 조각', 1, 1, 1, { token: true }),
  U('tk', 'shadow', '죽음의 기사', 4, 4, 4, { token: true, kw: ['lifesteal'] }),
  S('tc', 'neutral', '동전', 0, { token: true, play: [{ do: 'mana', n: 1 }], text: '이번 턴에만 에너지 +1' }),

  // ---------- 불꽃: 공격/직접 피해 ----------
  U('f01', 'fire', '불씨 정령', 1, 2, 1),
  S('f02', 'fire', '불꽃 화살', 1, { tg: 'enemy', play: [{ do: 'dmg', n: 2, to: 'tgt' }], text: '적 하나에 2 피해' }),
  U('f03', 'fire', '화염 도약자', 2, 2, 1, { kw: ['charge'] }),
  U('f04', 'fire', '폭발 마술사', 2, 2, 2, { death: [{ do: 'dmg', n: 1, to: 'allEnemies' }], text: '유언: 모든 적에게 1 피해' }),
  U('f05', 'fire', '불꽃 연구가', 2, 1, 3, { spellDmg: 1, text: '주문 피해 +1' }),
  U('f06', 'fire', '화염 투사', 3, 3, 2, { tg: 'enemy', play: [{ do: 'dmg', n: 1, to: 'tgt' }], text: '출전: 적 하나에 1 피해' }),
  U('f07', 'fire', '광폭한 전사', 3, 4, 3),
  S('f08', 'fire', '화염구', 4, { tg: 'enemy', play: [{ do: 'dmg', n: 6, to: 'tgt' }], text: '적 하나에 6 피해' }),
  U('f09', 'fire', '불꽃 기수', 4, 4, 3, { kw: ['charge'] }),
  S('f10', 'fire', '불바다', 4, { play: [{ do: 'dmg', n: 2, to: 'allEnemyUnits' }], text: '모든 적 유닛에 2 피해' }),
  U('f11', 'fire', '용암 골렘', 5, 5, 5, { play: [{ do: 'dmg', n: 3, to: 'enemyHero' }], text: '출전: 적 영웅에게 3 피해' }),
  U('f12', 'fire', '화염 군주', 7, 7, 6, { leg: true, play: [{ do: 'dmg', n: 1, to: 'randEnemy', times: 4 }], text: '출전: 무작위 적에게 1 피해 4번' }),

  // ---------- 강철: 수호/방어도/회복 ----------
  U('s01', 'steel', '방패병', 1, 1, 2, { kw: ['taunt'] }),
  S('s02', 'steel', '치유의 손길', 1, { tg: 'friendly', play: [{ do: 'heal', n: 3, to: 'tgt' }], text: '아군 하나를 3 회복' }),
  U('s03', 'steel', '강철 견습생', 2, 2, 3),
  U('s04', 'steel', '수리공', 2, 2, 2, { play: [{ do: 'armor', n: 2 }], text: '출전: 방어도 +2' }),
  S('s05', 'steel', '성스러운 방벽', 2, { tg: 'allyUnit', play: [{ do: 'buff', a: 1, h: 2, to: 'tgt', kw: ['shield', 'taunt'] }], text: '아군 유닛 하나에 +1/+2, 보호막과 수호' }),
  U('s06', 'steel', '성벽 수호자', 3, 1, 5, { kw: ['taunt'] }),
  S('s07', 'steel', '방패 강타', 3, { tg: 'enemyUnit', play: [{ do: 'armor', n: 2 }, { do: 'armorDmg' }], text: '방어도 +2, 적 유닛 하나에 내 방어도만큼 피해' }),
  S('s08', 'steel', '정의의 일격', 3, { tg: 'enemyUnit4', play: [{ do: 'destroy', to: 'tgt' }], text: '공격력 4 이상인 적 유닛 하나를 파괴' }),
  U('s09', 'steel', '기사', 4, 4, 4, { kw: ['shield'] }),
  U('s10', 'steel', '전투 사제', 4, 3, 5, { play: [{ do: 'heal', n: 4, to: 'myHero' }], text: '출전: 내 영웅 4 회복' }),
  U('s11', 'steel', '수호 천사', 5, 4, 6, { kw: ['lifesteal'] }),
  U('s12', 'steel', '강철 거상', 7, 6, 8, { leg: true, kw: ['taunt'], play: [{ do: 'armor', n: 5 }], text: '출전: 방어도 +5' }),

  // ---------- 비전: 주문/뽑기/빙결 ----------
  S('a01', 'arcane', '비전 탄환', 1, { play: [{ do: 'dmg', n: 1, to: 'randEnemy', times: 3 }], text: '무작위 적에게 1 피해 3번 (주문 피해만큼 횟수 증가)' }),
  U('a02', 'arcane', '견습 마법사', 2, 2, 3, { play: [{ do: 'draw', n: 1 }], text: '출전: 카드 1장 뽑기' }),
  S('a03', 'arcane', '서리 화살', 2, { tg: 'enemy', play: [{ do: 'dmg', n: 3, to: 'tgt' }, { do: 'freeze', to: 'tgt' }], text: '적 하나에 3 피해, 빙결' }),
  U('a04', 'arcane', '마나 정령', 2, 2, 3, { onSpell: [{ do: 'selfAtk', n: 1 }], text: '내가 주문을 쓸 때마다 공격력 +1' }),
  S('a05', 'arcane', '지식의 샘', 3, { play: [{ do: 'draw', n: 2 }], text: '카드 2장 뽑기' }),
  U('a06', 'arcane', '수정 골렘', 3, 3, 5),
  S('a07', 'arcane', '눈보라', 4, { play: [{ do: 'dmg', n: 2, to: 'allEnemyUnits' }, { do: 'freeze', to: 'allEnemyUnits' }], text: '모든 적 유닛에 2 피해, 빙결' }),
  U('a08', 'arcane', '마법 방벽', 4, 3, 5, { kw: ['taunt'] }),
  U('a09', 'arcane', '시간 왜곡사', 5, 4, 6, { spellDmg: 1, text: '주문 피해 +1' }),
  U('a10', 'arcane', '대마법사', 6, 5, 6, { tg: 'enemy', play: [{ do: 'dmg', n: 3, to: 'tgt' }], text: '출전: 적 하나에 3 피해' }),
  S('a11', 'arcane', '운석', 6, { tg: 'enemy', play: [{ do: 'dmg', n: 7, to: 'tgt' }], text: '적 하나에 7 피해' }),
  U('a12', 'arcane', '대현자', 8, 6, 6, { leg: true, play: [{ do: 'draw', n: 3 }], text: '출전: 카드 3장 뽑기' }),

  // ---------- 야생: 토큰/강화 ----------
  U('w01', 'wild', '늑대 새끼', 1, 1, 1, { death: [{ do: 'summon', id: 'tw', n: 1 }], text: '유언: 1/1 늑대 소환' }),
  U('w02', 'wild', '독침 거미', 2, 1, 2, { kw: ['poison'] }),
  S('w03', 'wild', '무리 부르기', 2, { play: [{ do: 'summon', id: 'tw', n: 2 }], text: '1/1 늑대 2마리 소환' }),
  U('w04', 'wild', '숲 수호자', 2, 2, 2, { tg: 'allyUnit', play: [{ do: 'buff', a: 1, h: 1, to: 'tgt' }], text: '출전: 다른 아군 유닛 하나에 +1/+1' }),
  U('w05', 'wild', '덩굴 정령', 3, 2, 4, { kw: ['taunt'] }),
  U('w06', 'wild', '우두머리 늑대', 3, 3, 4, { play: [{ do: 'summon', id: 'tw', n: 1 }], text: '출전: 1/1 늑대 소환' }),
  S('w07', 'wild', '야생의 포효', 3, { play: [{ do: 'buff', a: 1, h: 1, to: 'allyUnits' }], text: '모든 아군 유닛에 +1/+1' }),
  U('w08', 'wild', '회색곰', 4, 4, 5),
  U('w09', 'wild', '맹수 조련사', 4, 3, 3, { tg: 'allyUnit', play: [{ do: 'buff', a: 2, h: 2, to: 'tgt', kw: ['charge'] }], text: '출전: 다른 아군 유닛 하나에 +2/+2와 돌진' }),
  U('w10', 'wild', '사냥꾼', 5, 4, 4, { play: [{ do: 'summon', id: 'tw', n: 2 }], text: '출전: 1/1 늑대 2마리 소환' }),
  U('w11', 'wild', '고대 나무', 6, 5, 7, { kw: ['taunt'], death: [{ do: 'summon', id: 'ts', n: 2 }], text: '유언: 2/2 묘목 2개 소환' }),
  U('w12', 'wild', '숲의 군주', 8, 7, 7, { leg: true, play: [{ do: 'buff', a: 2, h: 2, to: 'otherAllyUnits' }], text: '출전: 다른 아군 유닛 모두에 +2/+2' }),

  // ---------- 그림자: 유언/희생/맹독/흡혈 ----------
  U('d01', 'shadow', '해골 병사', 1, 1, 3, { death: [{ do: 'dmg', n: 1, to: 'randEnemy', times: 1 }], text: '유언: 무작위 적에게 1 피해' }),
  U('d02', 'shadow', '흡혈 박쥐', 2, 2, 2, { kw: ['lifesteal'] }),
  U('d03', 'shadow', '암살자', 2, 3, 1, { kw: ['stealth'] }),
  S('d04', 'shadow', '영혼 흡수', 2, { tg: 'enemyUnit', play: [{ do: 'drain', n: 2 }], text: '적 유닛 하나에 2 피해, 내 영웅 2 회복' }),
  S('d05', 'shadow', '독 칼날', 1, { tg: 'allyUnit', play: [{ do: 'buff', a: 1, h: 0, to: 'tgt', kw: ['poison'] }], text: '아군 유닛 하나에 +1 공격력과 맹독' }),
  U('d06', 'shadow', '망령', 3, 3, 3, { death: [{ do: 'summon', id: 'tg', n: 2 }], text: '유언: 1/1 망령 조각 2개 소환' }),
  U('d07', 'shadow', '시체 수집가', 3, 2, 4, { kw: ['taunt'], onAnyDeath: [{ do: 'selfAtk', n: 1 }], text: '유닛이 죽을 때마다 공격력 +1' }),
  S('d08', 'shadow', '영혼 수확', 3, { tg: 'allyUnit', play: [{ do: 'sacrifice', draw: 2 }], text: '아군 유닛 하나를 파괴하고 카드 2장 뽑기' }),
  S('d09', 'shadow', '피의 의식', 4, { play: [{ do: 'dmg', n: 2, to: 'allUnits' }], text: '모든 유닛에 2 피해 (아군 포함)' }),
  U('d10', 'shadow', '흑기사', 5, 5, 5, { kw: ['lifesteal'] }),
  U('d11', 'shadow', '죽음의 사신', 6, 4, 4, { tg: 'enemyUnit', play: [{ do: 'destroy', to: 'tgt' }], text: '출전: 적 유닛 하나를 파괴' }),
  U('d12', 'shadow', '리치 왕', 7, 5, 5, { leg: true, death: [{ do: 'summon', id: 'tk', n: 2 }], text: '유언: 4/4 흡혈 죽음의 기사 2명 소환' }),

  // ---------- 중립 ----------
  U('n01', 'neutral', '견습 기사', 1, 1, 2),
  U('n02', 'neutral', '방패 수습생', 1, 1, 1, { kw: ['shield'] }),
  U('n03', 'neutral', '화살병', 2, 2, 1, { tg: 'enemy', play: [{ do: 'dmg', n: 1, to: 'tgt' }], text: '출전: 적 하나에 1 피해' }),
  U('n04', 'neutral', '고블린 폭탄병', 2, 1, 2, { death: [{ do: 'dmg', n: 2, to: 'enemyHero' }], text: '유언: 적 영웅에게 2 피해' }),
  U('n05', 'neutral', '침묵 사제', 2, 2, 2, { tg: 'anyUnit', play: [{ do: 'silence', to: 'tgt' }], text: '출전: 유닛 하나를 침묵 (키워드와 효과 제거)' }),
  U('n06', 'neutral', '숙련 용병', 3, 3, 4),
  U('n07', 'neutral', '치유사', 3, 2, 3, { tg: 'friendly', play: [{ do: 'heal', n: 3, to: 'tgt' }], text: '출전: 아군 하나를 3 회복' }),
  U('n08', 'neutral', '은신 정찰병', 3, 3, 2, { kw: ['stealth'] }),
  U('n09', 'neutral', '거대 거북', 4, 2, 7, { kw: ['taunt'] }),
  U('n10', 'neutral', '질풍 기병', 4, 3, 3, { kw: ['windfury'] }),
  U('n11', 'neutral', '노련한 모험가', 4, 3, 3, { play: [{ do: 'draw', n: 1 }], text: '출전: 카드 1장 뽑기' }),
  U('n12', 'neutral', '기술자', 5, 4, 5, { play: [{ do: 'draw', n: 1 }], text: '출전: 카드 1장 뽑기' }),
  U('n13', 'neutral', '바위 거인', 6, 6, 7),
  U('n14', 'neutral', '거대 비룡', 6, 5, 4, { kw: ['charge'] }),
  U('n15', 'neutral', '고대 골렘', 8, 8, 8, { kw: ['taunt'] }),
  U('n16', 'neutral', '방랑 현자', 5, 4, 4, { leg: true, play: [{ do: 'buff', a: 0, h: 0, to: 'otherAllyUnits', kw: ['shield'] }], text: '출전: 다른 아군 유닛 모두에 보호막' }),
];

export const CARDS = Object.fromEntries(LIST.map((c) => [c.id, c]));
export const COLLECTIBLE = LIST.filter((c) => !c.token).map((c) => c.id);

// ---------- 덱 ----------
export const DECK_SIZE = 20;

export function deckCode(fac, ids) {
  return `${fac}:${[...ids].sort().join(',')}`;
}

export function parseDeckCode(code) {
  if (typeof code !== 'string' || !code.includes(':')) return null;
  const [fac, rest] = code.split(':');
  const ids = rest ? rest.split(',').filter(Boolean) : [];
  return { fac, ids };
}

// 덱 규칙: 파벌 하나 + 중립, 20장, 같은 카드 2장까지(전설 1장), 토큰 불가
export function validateDeck(fac, ids) {
  if (!FACTIONS[fac] || fac === 'neutral') return '파벌을 골라주세요';
  if (ids.length !== DECK_SIZE) return `카드는 ${DECK_SIZE}장이어야 해요 (지금 ${ids.length}장)`;
  const count = {};
  for (const id of ids) {
    const c = CARDS[id];
    if (!c || c.token) return '쓸 수 없는 카드가 있어요';
    if (c.fac !== fac && c.fac !== 'neutral') return `${c.name}은(는) ${FACTIONS[fac].name} 덱에 넣을 수 없어요`;
    count[id] = (count[id] || 0) + 1;
    if (count[id] > (c.leg ? 1 : 2)) return `${c.name}은(는) ${c.leg ? 1 : 2}장까지만 넣을 수 있어요`;
  }
  return null;
}

const two = (...ids) => ids.flatMap((id) => [id, id]);

export const PRESETS = [
  { key: 'fire', fac: 'fire', name: '불꽃 돌격', ids: [...two('f01', 'f02', 'f03', 'f04', 'f06', 'f07', 'f08', 'f09'), 'n03', 'f05', 'f10', 'f11'] },
  { key: 'steel', fac: 'steel', name: '강철 성벽', ids: [...two('s01', 's02', 's04', 's06', 's08', 's09', 's10', 's11'), 's05', 'n05', 'n09', 's12'] },
  { key: 'arcane', fac: 'arcane', name: '비전 연구회', ids: [...two('a01', 'a02', 'a03', 'a04', 'a05', 'a06', 'a07', 'a08'), 'a10', 'a11', 'a12', 'n05'] },
  { key: 'wild', fac: 'wild', name: '야생 무리', ids: [...two('w01', 'w02', 'w03', 'w04', 'w05', 'w06', 'w07', 'w08', 'w10'), 'w11', 'w12'] },
  { key: 'shadow', fac: 'shadow', name: '그림자 의식', ids: [...two('d01', 'd02', 'd03', 'd04', 'd05', 'd06', 'd07', 'd10', 'd11'), 'd09', 'd12'] },
];
