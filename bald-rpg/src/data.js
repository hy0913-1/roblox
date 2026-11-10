// 스킬·퀘스트·상점·성장 수치
export const SKILLS = {
  beam: { name: '탈모빔', key: 'A', unlock: 1, mp: 6, cd: 0.9, mult: 1.8, per: 0.3, max: 5, desc: '정수리에서 빛을 쏴 한 줄의 적을 꿰뚫어요. 맞은 적은 탈모 상태가 되어 받는 피해가 30% 늘어요.' },
  slam: { name: '몸무게 3톤 어택', key: 'S', unlock: 3, mp: 12, cd: 4, mult: 3.0, per: 0.45, max: 5, desc: '높이 뛰어올라 3톤의 무게로 내리찍어요. 땅 위의 적을 넓게 날려 버려요.' },
  quake: { name: '진동 폭발', key: 'D', unlock: 6, mp: 18, cd: 7, mult: 2.2, per: 0.3, max: 5, desc: '몸을 떨어 힘을 모은 뒤 터뜨려요. 주변의 적을 두 번 때리고 기절시켜요.' },
  air: { name: '공군 폭격', key: 'F', unlock: 9, mp: 35, cd: 18, mult: 5.0, per: 0.7, max: 5, desc: '신호탄을 쏘면 전투기 편대가 화면 전체에 폭탄을 떨어뜨려요.' },
};
export const SKILL_ORDER = ['beam', 'slam', 'quake', 'air'];

export const expNeed = (lv) => Math.floor(18 * Math.pow(lv, 1.55) + 12 * lv);
export const maxHp = (p) => 90 + p.lv * 24;
export const maxMp = (p) => 40 + p.lv * 9;
export const atkOf = (p) => 11 + p.lv * 3 + p.glove * 5;
export const gloveCost = (g) => 120 + g * g * 90 + g * 60;

export const SHOP = [
  { id: 'hp', name: '빨간 물약', desc: 'HP를 40% 회복해요', cost: 25 },
  { id: 'mp', name: '파란 물약', desc: 'MP를 50% 회복해요', cost: 30 },
  { id: 'glove', name: '광택 장갑 강화', desc: '공격력 +5 (살수록 비싸져요)', cost: 0 },
];

// 퀘스트: 순서대로. need: { kill: {몹:수}, item: {hair:수}, boss }
export const QUESTS = [
  {
    id: 'q1', title: '털뭉치 소탕', where: '솜털 초원',
    intro: ['어서 오게, 젊은 빛나리여.', '털보 대왕이 온 세상을 털로 덮으려 하고 있네.', '우선 솜털 초원의 털뭉치부터 정리해 주게. 탈모빔(A)을 쏘면 금방일세.'],
    need: { kill: { fluff: 6 } }, text: '털뭉치 6마리 처치',
    done: ['벌써 다 밀었는가! 머리에서 빛이 나는구먼.'], reward: { exp: 60, gold: 80, hp: 5 },
  },
  {
    id: 'q2', title: '털 뭉치 수거', where: '솜털 초원',
    intro: ['초원 안쪽에는 민트 털뭉치와 덥수룩 개구리가 있네.', '놈들이 떨어뜨리는 털 뭉치를 모아 오게. 가발 연구에 쓸 걸세… 아니, 봉인에 쓸 걸세.'],
    need: { item: { hair: 8 } }, text: '털 뭉치 8개 모으기',
    done: ['음, 윤기가 좋군. 수고했네.', '레벨 3이 되면 몸무게 3톤 어택(S)을 쓸 수 있을 걸세.'], reward: { exp: 160, gold: 150, mp: 5 },
  },
  {
    id: 'q3', title: '수염뱀 퇴치', where: '솜털 초원 동쪽',
    intro: ['초원 동쪽 언덕에 수염뱀이 자리를 잡았다네.', '동굴로 가는 길목이니 치워 주게.'],
    need: { kill: { snake: 6 } }, text: '수염뱀 6마리 처치',
    done: ['길이 열렸군! 이제 덥수룩 동굴로 갈 수 있네.'], reward: { exp: 320, gold: 220, hp: 5, mp: 3 },
  },
  {
    id: 'q4', title: '동굴의 곱슬들', where: '덥수룩 동굴',
    intro: ['동굴에는 곱슬 박쥐와 가발 유령이 득실거린다네.', '날아다니는 놈들이니 진동 폭발(D, 레벨 6)이 잘 먹힐 걸세.'],
    need: { kill: { bat: 8, ghost: 6 } }, text: '곱슬 박쥐 8, 가발 유령 6 처치',
    done: ['동굴이 훤해졌구먼. 자네 머리 덕인가?'], reward: { exp: 800, gold: 400, hp: 8, mp: 8 },
  },
  {
    id: 'q5', title: '폐허 정찰', where: '가발 폐허',
    intro: ['동굴 너머 가발 폐허에 대왕의 부하들이 있네.', '불꽃머리 해골과 속눈썹 눈알을 조심하게. 레벨 9가 되면 공군 폭격(F)을 부를 수 있네.'],
    need: { kill: { skull: 8, eye: 6 } }, text: '불꽃머리 해골 8, 속눈썹 눈알 6 처치',
    done: ['대단하네! 이제 남은 건 털보 대왕뿐일세.'], reward: { exp: 1800, gold: 700, hp: 10, mp: 10 },
  },
  {
    id: 'q6', title: '털보 대왕', where: '털보의 옥좌',
    intro: ['폐허 끝의 문을 지나면 털보의 옥좌일세.', '대왕의 털을 전부 밀어 버리고 세상에 빛을 되찾아 주게!'],
    need: { boss: 1 }, text: '털보 대왕 처치',
    done: ['해냈구먼… 온 세상이 반짝이네!', '자네야말로 진정한 빛나리 용사일세.'], reward: { exp: 3000, gold: 2000 },
  },
];

export const TALK = {
  shop: ['어서 와요! 머릿결… 아니, 물약이 필요한가요?'],
  guide: ['발판 위에서 ↓ + 점프를 누르면 아래로 내려갈 수 있어요.', '사다리는 ↑↓로 오르내려요. 포탈 앞에서는 ↑를 누르세요.', '스킬 창(K)에서 스킬 포인트로 스킬을 강화할 수 있어요!'],
  elderIdle: ['자네의 빛나는 활약, 잘 보고 있다네.'],
};
