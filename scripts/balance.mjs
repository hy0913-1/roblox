// 밸런스 점검용. 렌더링 없이 같은 Sim을 돌려서 "이 정도 플레이로 클리어 가능한가"를 본다.
// 사용: node scripts/balance.mjs [전략...]   (전략: mixed | yisang | donquixote | faust | idle)
import { Sim, DEFAULT_DATA, STEP } from '../src/sim/Sim.js';
import { spend } from '../src/sim/bot.js';

export function run(strategy, { verbose = false } = {}) {
  const sim = new Sim();
  const log = [];
  let guard = 0;
  while (sim.phase !== 'won' && sim.phase !== 'lost' && guard++ < 200000) {
    if (sim.phase === 'prep') {
      spend(sim, strategy);
      sim.startWave();
    }
    sim.update(STEP);
    for (const e of sim.drainEvents()) {
      if (e.type === 'waveClear' || e.type === 'win') log.push({ wave: sim.wave, lives: sim.lives, ahn: sim.ahn, towers: sim.towers.length });
    }
  }
  if (verbose) {
    for (const l of log) console.log(`  웨이브 ${String(l.wave).padStart(2)} 클리어 | 내구도 ${String(l.lives).padStart(2)} | 아안 ${String(l.ahn).padStart(4)} | 타워 ${l.towers}`);
  }
  return { phase: sim.phase, wave: sim.wave, lives: sim.lives, kills: sim.kills, leaked: sim.leaked, time: Math.round(sim.time), towers: sim.towers.length, ahn: sim.ahn };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const strategies = process.argv.slice(2).length ? process.argv.slice(2) : ['mixed', 'yisang', 'donquixote', 'faust', 'idle'];
  for (const s of strategies) {
    const r = run(s, { verbose: s === 'mixed' });
    console.log(`[${s.padEnd(10)}] ${r.phase === 'won' ? '클리어' : '패배  '} | 도달 웨이브 ${r.wave}/${DEFAULT_DATA.waves.length} | 내구도 ${r.lives} | 처치 ${r.kills} | 누수 ${r.leaked} | 타워 ${r.towers} | 소요 ${r.time}s`);
  }
}
