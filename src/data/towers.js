// 타워 = 수감자(Sinner). 능력치는 전부 여기서 조정한다.
// range: 픽셀, cd: 공격 주기(초), splash: 폭발 반경(픽셀), slow: 감속 비율(0~1), slowT: 감속 지속(초)
export const TOWER_ORDER = ['yisang', 'donquixote', 'faust'];

export const TOWERS = {
  yisang: {
    id: 'yisang',
    name: '이상',
    role: '균형형 · 단일 타격',
    desc: '빠르고 정확한 일격으로 한 명씩 베어낸다.',
    cost: 60,
    color: 0xe9e3d0,
    proj: { speed: 420, kind: 'slash' },
    levels: [
      { dmg: 11, range: 130, cd: 0.7 },
      { dmg: 18, range: 140, cd: 0.62 },
      { dmg: 28, range: 150, cd: 0.55 },
    ],
    upgrade: [70, 110],
  },
  donquixote: {
    id: 'donquixote',
    name: '돈키호테',
    role: '광역 · 돌격 폭발',
    desc: '창을 내던져 착탄 지점 주변의 적을 함께 날린다.',
    cost: 110,
    color: 0xc0553a,
    proj: { speed: 300, kind: 'lance' },
    levels: [
      { dmg: 16, range: 125, cd: 1.5, splash: 52 },
      { dmg: 26, range: 135, cd: 1.4, splash: 60 },
      { dmg: 40, range: 145, cd: 1.3, splash: 70 },
    ],
    upgrade: [90, 140],
  },
  faust: {
    id: 'faust',
    name: '파우스트',
    role: '보조 · 감속',
    desc: '맞은 적의 발을 늦춘다. 다른 타워와 함께 쓰면 강하다.',
    cost: 80,
    color: 0xe58fb8,
    proj: { speed: 360, kind: 'orb' },
    levels: [
      { dmg: 5, range: 115, cd: 0.9, slow: 0.4, slowT: 2.0 },
      { dmg: 8, range: 125, cd: 0.8, slow: 0.5, slowT: 2.4 },
      { dmg: 12, range: 135, cd: 0.7, slow: 0.6, slowT: 2.8 },
    ],
    upgrade: [70, 100],
  },
};

export const PRIORITIES = ['first', 'last', 'strong', 'close'];
export const PRIORITY_NAMES = { first: '선두', last: '후미', strong: '강한 적', close: '가까운 적' };
