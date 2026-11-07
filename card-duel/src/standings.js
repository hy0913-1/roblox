// 순위 계산(순수 함수). 합계 = 검증된 솔로 최고 점수 + 상대 기록과 일치하는 대전 승점.
export const PTS = { W: 120, D: 60, L: 30 };
export const CAP_PER_OPPONENT = 3; // 1:1에서 같은 상대와는 3경기까지만 점수에 반영 (담합 방지)
export const CAP_TEAM = 6; // 팀전은 1인당 6경기까지

const OPP = { W: 'L', L: 'W', D: 'D' };

// players: [{ uid, doc }] doc = { ev, solo: {best, run, at}, games: [{m, mode, o:[uid], tm:[uid], r, at}] }
// verifySolo(run) → 다시 계산한 점수(number) 또는 null(검증 실패)
export function computeStandings(players, evId, verifySolo) {
  const docs = new Map();
  for (const p of players) if (p.doc && p.doc.ev === evId) docs.set(p.uid, p.doc);
  const rows = [];
  for (const [uid, doc] of docs) {
    const claimed = doc.solo && Number.isFinite(doc.solo.best) ? doc.solo.best : 0;
    let solo = 0;
    let soloState = 'none';
    if (doc.solo && doc.solo.run) {
      const v = verifySolo(doc.solo.run);
      if (v === null || v === undefined) soloState = 'pending';
      else if (v === claimed) {
        solo = v;
        soloState = 'ok';
      } else soloState = 'bad';
    }
    let pvp = 0;
    let w = 0;
    let l = 0;
    let d = 0;
    let unconfirmed = 0;
    let capped = 0;
    const perOpp = {};
    let team = 0;
    const games = (doc.games || []).filter((g) => g && g.ev === evId && OPP[g.r]).sort((a, b) => (a.at || 0) - (b.at || 0));
    for (const g of games) {
      const agree = (g.o || []).some((o) => {
        const od = docs.get(o);
        return od && (od.games || []).some((h) => h && h.m === g.m && h.ev === evId && h.r === OPP[g.r] && (h.o || []).includes(uid));
      });
      if (!agree) {
        unconfirmed += 1;
        continue;
      }
      if (g.mode === 'team') {
        team += 1;
        if (team > CAP_TEAM) {
          capped += 1;
          continue;
        }
      } else {
        const k = (g.o || [])[0];
        perOpp[k] = (perOpp[k] || 0) + 1;
        if (perOpp[k] > CAP_PER_OPPONENT) {
          capped += 1;
          continue;
        }
      }
      pvp += PTS[g.r];
      if (g.r === 'W') w += 1;
      else if (g.r === 'L') l += 1;
      else d += 1;
    }
    rows.push({ uid, solo, soloClaim: claimed, soloState, pvp, w, l, d, unconfirmed, capped, total: solo + pvp });
  }
  rows.sort((a, b) => b.total - a.total || b.solo - a.solo || b.w - a.w || (a.uid < b.uid ? -1 : 1));
  rows.forEach((r, i) => {
    r.rank = i > 0 && rows[i - 1].total === r.total ? rows[i - 1].rank : i + 1;
  });
  return rows;
}
