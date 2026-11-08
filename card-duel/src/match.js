// 실시간 대전 동기화(네트워크와 무관한 순수 로직).
// 각 참가자는 자기 행동 목록(log)과 마지막 행동 직후의 공개 해시(h)를 presence로 내보낸다.
// 모두가 같은 순서(턴 순서)로 행동을 적용하므로, 남의 손패를 몰라도 공개 상태가 똑같이 유지된다.
// 끝나면 각자 덱과 시드를 공개(reveal)하고, 시작 때 약속(commit)과 맞는지 + 모든 행동이 규칙에 맞았는지 전부 다시 계산해 확인한다.
import { createGame, act, dec, publicHash, hash32 } from './engine.js';
import { aiChoose } from './ai.js';
import { parseDeckCode, validateDeck } from './cards.js';
import { sha256hex } from './sha256.js';

export const MATCH_V = 1;

export function commitOf(deck, seed) {
  return sha256hex(`${MATCH_V}|${deck}|${seed >>> 0}`);
}

// nonces: 좌석 순서대로 각자 낸 공개 난수 → 공유 시드(누구 혼자 정할 수 없음)
export function sharedFrom(nonces) {
  return hash32(`m${MATCH_V}|${nonces.join('|')}`) || 1;
}

export function firstFrom(shared) {
  return hash32(`first|${shared}`) % 2;
}

// 내 관점의 게임: 내가 아는 좌석(나, 내가 조종하는 AI)만 덱을 넣고 나머지는 숨긴다.
// seats: [{fac, deck?: code, seed?}] (deck이 없으면 숨김)
export function createMatchGame(mode, seats, shared) {
  return createGame({
    mode,
    shared,
    first: firstFrom(shared),
    seats: seats.map((st) => {
      if (st.deck) {
        const p = parseDeckCode(st.deck);
        return { fac: p.fac, deck: p.ids, seed: st.seed };
      }
      return { fac: st.fac, deck: null, count: 20 };
    }),
  });
}

// 로그를 턴 순서대로 적용한다. 항복('x')은 차례와 상관없이 그 좌석 로그의 다음 행동이면 바로 적용.
export class MatchSync {
  constructor(game) {
    this.s = game;
    this.applied = game.seats.map(() => 0);
    this.hashAt = game.seats.map(() => []);
    this.error = null;
  }

  // logs[i]: 좌석 i의 행동 문자열 배열. 반환: 이번에 새로 적용한 행동 수
  advance(logs) {
    const s = this.s;
    let n = 0;
    for (let guard = 0; guard < 2000 && !s.over && !this.error; guard++) {
      let moved = false;
      for (let i = 0; i < s.seats.length && !s.over; i++) {
        const L = logs[i] || [];
        if (this.applied[i] < L.length && L[this.applied[i]] === 'x') {
          this.apply(i, L[this.applied[i]]);
          n += 1;
          moved = true;
        }
      }
      if (s.over || this.error) break;
      const pi = s.active;
      const L = logs[pi] || [];
      if (this.applied[pi] < L.length) {
        this.apply(pi, L[this.applied[pi]]);
        n += 1;
        moved = true;
      }
      if (!moved) break;
    }
    return n;
  }

  apply(pi, code) {
    const err = act(this.s, pi, dec(code));
    if (err) {
      this.error = { seat: pi, at: this.applied[pi], code, err };
      return;
    }
    this.hashAt[pi][this.applied[pi]] = publicHash(this.s);
    this.applied[pi] += 1;
  }

  // 좌석 pi가 n개 행동 후 h라는 해시를 냈을 때 내 계산과 같은지. 아직 거기까지 못 왔으면 null
  hashMatches(pi, n, h) {
    if (!n) return true;
    const mine = this.hashAt[pi][n - 1];
    if (mine === undefined) return null;
    return mine === h;
  }
}

// 대전이 끝난 뒤 전원의 덱/시드를 공개받아 처음부터 다시 계산한다.
// seats: [{fac, commit, deck, seed}], logs: [[...]], 결과: { ok, winner, why }
export function verifyMatch(mode, seats, shared, logs) {
  for (let i = 0; i < seats.length; i++) {
    const st = seats[i];
    if (!st.deck || st.seed === undefined) return { ok: false, why: `${i + 1}번 자리의 덱이 공개되지 않았어요` };
    if (commitOf(st.deck, st.seed) !== st.commit) return { ok: false, why: `${i + 1}번 자리의 덱이 시작 때 약속과 달라요` };
    const p = parseDeckCode(st.deck);
    if (!p || p.fac !== st.fac || validateDeck(p.fac, p.ids)) return { ok: false, why: `${i + 1}번 자리의 덱이 규칙에 맞지 않아요` };
  }
  const g = createMatchGame(mode, seats, shared);
  const sync = new MatchSync(g);
  sync.advance(logs);
  if (sync.error) return { ok: false, why: `${sync.error.seat + 1}번 자리의 행동이 규칙에 맞지 않아요 (${sync.error.err})` };
  for (let i = 0; i < logs.length; i++) {
    if (sync.applied[i] < (logs[i] || []).length) return { ok: false, why: '게임이 끝난 뒤의 행동이 있어요' };
  }
  if (!g.over) return { ok: false, why: '게임이 끝나지 않았어요' };
  return { ok: true, winner: g.winner, hash: publicHash(g) };
}

// AI 좌석(팀전 빈자리): 조종하는 사람의 브라우저가 대신 둔다. 결정적이라 공개 후 검증도 같은 방식으로 된다.
export function aiAction(game, pi, ai) {
  return aiChoose(game, pi, 'normal', ai);
}

export function randomSeed() {
  const a = new Uint32Array(1);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(a);
  else a[0] = Math.floor(Math.random() * 0xffffffff);
  return a[0] >>> 0 || 1;
}

export function randomId(len = 8) {
  const abc = 'abcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < len; i++) out += abc[randomSeed() % abc.length];
  return out;
}
