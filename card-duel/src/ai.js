// 결정적 AI: 가능한 행동을 하나씩 해 보고 판세 점수가 가장 좋아지는 것을 고른다(한 수 앞보기).
// 같은 상태 + 같은 AI 난수 상태면 언제나 같은 선택을 하므로, 솔로 기록을 리플레이로 검증할 수 있다.
import { CARDS } from './cards.js';
import { clone, act, legalActions, rnd } from './engine.js';

function unitVal(u) {
  const k = u.kw;
  let v = u.atk * 1.1 + u.hp * 0.9 + 0.5;
  if (k.taunt) v += 1 + u.hp * 0.2;
  if (k.shield) v += 1 + u.atk * 0.5;
  if (k.poison) v += 2;
  if (k.lifesteal) v += u.atk * 0.5;
  if (k.windfury) v += u.atk * 0.8;
  if (k.stealth) v += 1;
  if (u.sd) v += 1.5 * u.sd;
  const d = CARDS[u.id];
  if (!u.sil && (d.death || d.onSpell || d.onAnyDeath || d.turnEnd)) v += 1.5;
  if (u.frozen || u.frz) v -= u.atk * 0.4;
  return v;
}

function heroVal(H) {
  const e = H.hp + H.armor * 0.8;
  if (e <= 0) return -1000;
  return e < 10 ? e * 1.6 - 6 : e;
}

export function evaluate(s, side) {
  if (s.over) return s.winner === side ? 1e6 : s.winner === 2 ? -500 : -1e6;
  const me = s.sides[side];
  const op = s.sides[1 - side];
  let v = heroVal(me) - heroVal(op) * 1.05;
  for (const u of me.board) v += unitVal(u);
  for (const u of op.board) v -= unitVal(u) * 1.1;
  let hm = 0;
  let ho = 0;
  for (const P of s.seats) {
    if (P.side === side) hm += P.hand.length;
    else ho += P.hand.length;
  }
  return v + 1.2 * hm - 1.0 * ho;
}

// level: 'easy' | 'normal' | 'hard'. ai = { rng } (호출할 때마다 갱신됨)
export function aiChoose(s, pi, level, ai) {
  const side = s.seats[pi].side;
  const base = evaluate(s, side);
  const scored = [];
  for (const a of legalActions(s, pi)) {
    if (a.t === 'end') continue;
    const c = clone(s);
    if (act(c, pi, a)) continue;
    let v = evaluate(c, side);
    if (a.t === 'play') v += 0.3; // 같은 값이면 카드를 쓰는 쪽
    scored.push({ v, a });
  }
  scored.sort((x, y) => y.v - x.v);
  if (!scored.length) return { t: 'end' };
  // 쉬움: 30% 확률로 상위 3개 중 하나를 고르거나 턴을 일찍 끝낸다
  if (level === 'easy') {
    const roll = rnd(ai, 100);
    if (roll < 12) return { t: 'end' };
    if (roll < 35) {
      const pick = scored[rnd(ai, Math.min(3, scored.length))];
      if (pick.v > base - 3) return pick.a;
    }
  }
  const best = scored[0];
  if (best.v <= base + 0.05) return { t: 'end' };
  return best.a;
}

// 한 턴 전부를 AI가 진행한다(테스트/시뮬용). 최대 40번 행동 후 강제로 턴 종료.
export function aiTurn(s, pi, level, ai, onAction) {
  for (let i = 0; i < 40 && !s.over && s.active === pi; i++) {
    const a = aiChoose(s, pi, level, ai);
    const err = act(s, pi, a);
    if (err) {
      act(s, pi, { t: 'end' });
      if (onAction) onAction({ t: 'end' });
      return;
    }
    if (onAction) onAction(a);
    if (a.t === 'end') return;
  }
  if (!s.over && s.active === pi) {
    act(s, pi, { t: 'end' });
    if (onAction) onAction({ t: 'end' });
  }
}
