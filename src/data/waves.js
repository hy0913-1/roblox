// 웨이브 데이터. hpMul: 체력 배율, bonus: 클리어 보너스(아안)
// groups: { type, n: 마리 수, gap: 간격(초), at: 웨이브 시작 후 첫 등장 시각(초) }
export const WAVES = [
  { hpMul: 1.0, bonus: 25, groups: [{ type: 'shade', n: 8, gap: 1.4, at: 0 }] },
  { hpMul: 1.15, bonus: 28, groups: [{ type: 'shade', n: 10, gap: 1.1, at: 0 }, { type: 'runner', n: 4, gap: 0.8, at: 8 }] },
  { hpMul: 1.35, bonus: 32, groups: [{ type: 'shade', n: 8, gap: 1.0, at: 0 }, { type: 'runner', n: 8, gap: 0.7, at: 6 }] },
  { hpMul: 1.58, bonus: 36, groups: [{ type: 'carapace', n: 3, gap: 3.0, at: 0 }, { type: 'shade', n: 10, gap: 0.9, at: 4 }] },
  { hpMul: 1.85, bonus: 40, groups: [{ type: 'runner', n: 14, gap: 0.55, at: 0 }, { type: 'shade', n: 10, gap: 0.8, at: 9 }] },
  { hpMul: 2.15, bonus: 44, groups: [{ type: 'carapace', n: 5, gap: 2.4, at: 0 }, { type: 'runner', n: 10, gap: 0.6, at: 5 }] },
  { hpMul: 2.5, bonus: 48, groups: [{ type: 'shade', n: 18, gap: 0.65, at: 0 }, { type: 'carapace', n: 4, gap: 2.2, at: 6 }] },
  { hpMul: 2.9, bonus: 52, groups: [{ type: 'runner', n: 18, gap: 0.45, at: 0 }, { type: 'carapace', n: 6, gap: 1.9, at: 5 }] },
  { hpMul: 3.4, bonus: 60, groups: [{ type: 'carapace', n: 8, gap: 1.6, at: 0 }, { type: 'shade', n: 20, gap: 0.55, at: 4 }, { type: 'runner', n: 10, gap: 0.5, at: 14 }] },
  {
    hpMul: 4.0,
    bonus: 0,
    groups: [
      { type: 'shade', n: 12, gap: 0.7, at: 0 },
      { type: 'boss', n: 1, gap: 1, at: 6 },
      { type: 'carapace', n: 6, gap: 2.0, at: 10 },
      { type: 'runner', n: 12, gap: 0.5, at: 18 },
    ],
  },
];
