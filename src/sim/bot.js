// 자동 플레이 봇. 밸런스 점검(scripts/balance.mjs)과 브라우저 전체 플레이 테스트(scripts/e2e-full.cjs)가 같이 쓴다.
import { TOWERS } from '../data/towers.js';

// 길을 얼마나 오래 사거리 안에 두는지로 칸 점수를 매긴다.
function cellScores(map, range) {
  const scores = [];
  for (let c = 0; c < map.cols; c++) {
    for (let r = 0; r < map.rows; r++) {
      const x = (c + 0.5) * map.cell;
      const y = (r + 0.5) * map.cell;
      let s = 0;
      for (let d = 0; d < map.length; d += 8) {
        const p = map.posAt(d);
        if (Math.hypot(p.x - x, p.y - y) <= range) s += 1;
      }
      scores.push({ c, r, s });
    }
  }
  return scores.sort((a, b) => b.s - a.s);
}

const cache = new WeakMap();
function bestCell(sim) {
  let scores = cache.get(sim.d.map);
  if (!scores) {
    scores = cellScores(sim.d.map, 125);
    cache.set(sim.d.map, scores);
  }
  return scores.find((x) => sim.canBuild(x.c, x.r));
}

// 전략별로 "다음에 살 것"을 정한다.
function plan(strategy, sim) {
  const owned = (id) => sim.towers.filter((t) => t.type === id).length;
  if (strategy === 'idle') return null;
  if (strategy !== 'mixed') return { build: strategy };
  // mixed: 이상 2 → 파우스트 1 → 돈키호테 2 → 이후 업그레이드 위주로 최대 9기
  if (owned('yisang') < 2) return { build: 'yisang' };
  if (owned('faust') < 1) return { build: 'faust' };
  if (owned('donquixote') < 2) return { build: 'donquixote' };
  if (sim.towers.length < 9) return { build: owned('yisang') < 4 ? 'yisang' : owned('donquixote') < 4 ? 'donquixote' : 'faust' };
  return { build: null };
}

// 준비 단계에서 가진 아안을 쓴다. 쓴 행동 수를 돌려준다.
export function spend(sim, strategy) {
  let acts = 0;
  for (let guard = 0; guard < 40; guard++) {
    const p = plan(strategy, sim);
    if (!p) return acts;
    let acted = false;
    if (p.build && sim.ahn >= TOWERS[p.build].cost) {
      const cell = bestCell(sim);
      if (cell && sim.build(p.build, cell.c, cell.r)) acted = true;
    }
    if (!acted) {
      const ups = sim.towers
        .map((t) => ({ t, cost: sim.upgradeCost(t) }))
        .filter((u) => u.cost != null && u.cost <= sim.ahn)
        .sort((a, b) => a.cost - b.cost);
      // 건설 목표가 남아 있으면 모으고, 돈이 넉넉할 때만 업그레이드한다.
      const wantBuild = p.build && sim.towers.length < 9 && strategy === 'mixed';
      if (ups.length && (!wantBuild || sim.ahn >= TOWERS[p.build].cost * 2)) {
        sim.upgrade(ups[0].t.id);
        acted = true;
      }
    }
    if (!acted) return acts;
    acts += 1;
  }
  return acts;
}
