// 결과 화면
import { PTS } from '../standings.js';
import { FLOORS } from '../solo.js';
import { esc } from './common.js';

const LABEL = { W: '승리', L: '패배', D: '무승부', X: '무효' };

export function renderResult(app, root) {
  const r = app.lastResult;
  if (!r) {
    app.go('home');
    return;
  }
  const live = !!app.store.liveEvent;
  let body = '';
  if (r.kind === 'solo') {
    const floors = r.run.results.length;
    body = `<h2 class="${floors ? 'good' : ''}">${floors === FLOORS.length ? '완주!' : floors ? `${floors}층 클리어` : '1층에서 탈락'}</h2>
      <p class="big">${r.run.score}점</p>
      <ul class="breakdown">${r.run.results.map((x) => `<li>${esc(FLOORS[x.f].name)} <b>+${x.pts}</b> <span class="muted">(남은 생명력 ${x.hp})</span></li>`).join('') || '<li class="muted">깬 층이 없어요</li>'}</ul>
      ${!r.verified ? '<p class="warn">기록을 다시 계산한 결과가 맞지 않아 저장하지 않았어요.</p>' : !r.run.score ? '<p class="muted">점수가 없어서 기록하지 않았어요.</p>' : live ? (r.saved ? '<p class="good">최고 기록이라 순위표에 올렸어요.</p>' : '<p class="muted">이벤트 최고 기록보다 낮아서 순위는 그대로예요.</p>') : '<p class="muted">이벤트 중이 아니라 연습 기록이에요.</p>'}`;
  } else {
    const res = r.result || { r: 'X' };
    const pts = res.r in PTS ? PTS[res.r] : 0;
    body = `<h2 class="${res.r === 'W' ? 'good' : res.r === 'L' ? 'bad' : ''}">${LABEL[res.r] || '종료'}</h2>
      <p class="muted">${r.mode === 'team' ? '2:2 팀전' : '1:1 대전'}</p>
      ${live && res.r !== 'X' ? `<p class="big">+${pts}점</p><p class="fine">상대${r.mode === 'team' ? ' 팀' : ''} 기록에도 같은 결과가 남으면 순위에 반영돼요.</p>` : ''}
      ${res.verified ? '<p class="good">✓ 경기 후 덱 공개로 전체 경기를 다시 계산해 확인했어요.</p>' : res.note ? `<p class="warn">${esc(res.note)}</p>` : ''}`;
  }
  root.innerHTML = `<section class="result"><div class="panel">${body}
    <div class="rbtns"><button type="button" class="btn primary" data-act="home">로비로</button>${r.kind === 'solo' ? '<button type="button" class="btn" data-act="solo">다시 도전</button>' : ''}</div></div></section>`;
}
