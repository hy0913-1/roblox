// 공유 저장소(db). 쓰기는 전부 주최자(아티팩트 주인)만 한다 — 친구들은 읽기만.
//   meta/season      {id, title, startedAt, used:[문제 id]}  시즌(순위표 단위)
//   results/<경기id>  {season, at, title, rows:[{by, place, pts, correct, alive}]}  공식전 결과
//   bank/main, bank/custom  {list:[{id,c,q,a,x}]}  공식전 문제은행 — 주최자만 읽을 수 있음(규칙)
export async function connectPlatform() {
  const c = typeof window !== 'undefined' ? window.claude : null;
  const use = async (n) => {
    try {
      return c && typeof c.use === 'function' ? await c.use(n) : null;
    } catch {
      return null;
    }
  };
  const [db, room, user] = await Promise.all([use('db'), use('room'), use('user')]);
  let me = { id: null, name: '', avatarUrl: '', isOwner: false };
  if (user) {
    try {
      me = await user.me();
    } catch {
      /* 기본값 */
    }
  }
  return { db, room, user, me };
}

export class QuizStore {
  constructor(plat, onChange) {
    this.db = plat.db;
    this.me = plat.me;
    this.onChange = onChange;
    this.season = null;
    this.results = [];
    this.loaded = false;
  }

  start() {
    if (!this.db) return;
    // 10초 안에 응답이 없으면 "아직 못 불러옴"으로 표시
    this.slowTimer = setTimeout(() => {
      if (!this.loaded) {
        this.slow = true;
        this.onChange();
      }
    }, 10000);
    this.db.doc('meta/season').onSnapshot(
      (s) => {
        this.season = s.exists ? s.data() : null;
        this.onChange();
      },
      () => {},
    );
    this.db.collection('results').onSnapshot(
      (s) => {
        this.results = s.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (!s.metadata || !s.metadata.fromCache) {
          this.loaded = true;
          this.slow = false;
          clearTimeout(this.slowTimer);
        }
        this.onChange();
      },
      () => {
        this.loaded = true;
        this.onChange();
      },
    );
  }

  standings() {
    const sid = this.season && this.season.id;
    const by = new Map();
    for (const r of this.results) {
      if (!sid || r.season !== sid) continue;
      for (const row of r.rows || []) {
        if (!row.by) continue;
        const s = by.get(row.by) || { by: row.by, name: '', pts: 0, games: 0, wins: 0, correct: 0, at: 0 };
        if (row.name && (r.at || 0) >= s.at) {
          s.name = row.name;
          s.at = r.at || 0;
        }
        s.pts += row.pts | 0;
        s.games += 1;
        s.correct += row.correct | 0;
        if (row.place === 1) s.wins += 1;
        by.set(row.by, s);
      }
    }
    const rows = [...by.values()].sort((a, b) => b.pts - a.pts || b.wins - a.wins || b.correct - a.correct);
    rows.forEach((r, i) => {
      r.rank = i > 0 && rows[i - 1].pts === r.pts ? rows[i - 1].rank : i + 1;
    });
    return rows;
  }

  matchesThisSeason() {
    const sid = this.season && this.season.id;
    return this.results.filter((r) => r.season === sid).sort((a, b) => b.at - a.at);
  }

  // ---------- 주최자 전용 ----------
  async ensureSeason() {
    if (this.season) return this.season;
    const s = { id: `s-${Date.now().toString(36)}`, title: '시즌 1', startedAt: Date.now(), used: [] };
    await this.db.doc('meta/season').set(s);
    this.season = s;
    return s;
  }

  async newSeason(title) {
    const s = { id: `s-${Date.now().toString(36)}`, title: title || '새 시즌', startedAt: Date.now(), used: [] };
    await this.db.doc('meta/season').set(s);
    this.season = s;
  }

  async loadBank() {
    const out = { main: [], custom: [] };
    for (const k of ['main', 'custom']) {
      try {
        const snap = await this.db.doc(`bank/${k}`).get();
        // 받은 데이터는 얼어 있어(frozen) 고칠 수 없으니 복사해서 쓴다
        if (snap.exists && Array.isArray(snap.data().list)) out[k] = JSON.parse(JSON.stringify(snap.data().list));
      } catch {
        /* 비어 있음 */
      }
    }
    return out;
  }

  async saveCustom(list) {
    await this.db.doc('bank/custom').set({ v: 1, list });
  }

  async recordResult(game) {
    const season = await this.ensureSeason();
    const rows = game.results().filter((r) => r.by);
    const id = `m-${Date.now().toString(36)}`;
    await this.db.doc(`results/${id}`).set({ season: season.id, at: Date.now(), title: game.title, rows });
    const used = [...new Set([...(season.used || []), ...game.questions.slice(0, game.round).map((q) => q.id)])];
    await this.db.doc('meta/season').set({ ...season, used });
    return rows.length;
  }
}
