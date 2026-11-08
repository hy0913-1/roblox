// 로비: 이벤트 상태, 내 점수, 놀이 버튼, 접속 중인 친구, 순위표, 규칙, 주최자 메뉴
import { FACTIONS } from '../cards.js';
import { PTS, CAP_PER_OPPONENT, CAP_TEAM } from '../standings.js';
import { FLOORS } from '../solo.js';
import { esc, avatarHtml, fmtTime, facColor } from './common.js';

const STATUS = { idle: '대기 중', q: '빠른 대전 찾는 중', busy: '대전 중', solo: '솔로 도전 중', room: '팀전 방' };

function eventPanel(app) {
  const st = app.store;
  const c = st.config;
  const rows = app.rows || [];
  const mine = rows.find((r) => r.uid === app.plat.me.id);
  if (!app.plat.db) {
    return `<article class="panel event"><h2>연습 모드</h2><p class="muted">이 화면에서는 기록을 저장할 수 없어요. claude.ai에 로그인한 상태로, 공유받은 링크로 열어주세요.</p></article>`;
  }
  if (!st.loaded.config) return `<article class="panel event"><h2>이벤트 정보 불러오는 중…</h2>${st.stale ? '<p class="warn">기록 서버에 아직 닿지 않았어요. 잠시 후 다시 확인해 주세요.</p>' : ''}</article>`;
  if (!c) return `<article class="panel event"><h2>이벤트 시작 전</h2><p class="muted">주최자가 이벤트를 시작하면 그때부터 점수가 순위에 올라가요. 지금은 연습 경기를 할 수 있어요.</p></article>`;
  const live = st.liveEvent;
  if (live) {
    const left = live.endsAt - Date.now();
    return `<article class="panel event live">
      <div class="evhead"><span class="pill live">진행 중</span><h2>${esc(live.title)}</h2></div>
      <p class="clock">남은 시간 <b id="ev-left">${fmtTime(left)}</b></p>
      ${mine ? `<div class="mystat"><div><span>내 순위</span><b>${mine.rank}위</b></div><div><span>솔로 최고</span><b>${mine.solo}</b></div><div><span>대전 승점</span><b>${mine.pvp}</b></div><div><span>합계</span><b>${mine.total}</b></div></div>` : '<p class="muted">아직 내 기록이 없어요. 솔로 도전이나 대전을 해 보세요.</p>'}
      ${st.readOnly ? '<p class="warn">이 계정은 기록을 저장할 권한이 없어요. 주최자에게 공유 권한을 "참여"로 바꿔 달라고 해 주세요.</p>' : ''}
      ${st.lastError ? `<p class="warn">${esc(st.lastError)}</p>` : ''}
    </article>`;
  }
  const fin = st.final && st.final.id === c.id ? st.final : null;
  const podium = (fin ? fin.rows : rows).slice(0, 3);
  return `<article class="panel event ended">
    <div class="evhead"><span class="pill">종료</span><h2>${esc(c.title)}</h2></div>
    ${fin ? '<p class="muted">최종 순위가 확정됐어요.</p>' : '<p class="muted">시간이 끝났어요. 주최자가 최종 순위를 확정하면 아래 순위가 고정돼요.</p>'}
    <ol class="podium">${podium.map((r, i) => `<li class="p${i + 1}">${avatarHtml(app.profile(r.uid), 32)}<b>${esc(app.nameOf(r.uid))}</b><span>${r.total}점</span></li>`).join('')}</ol>
  </article>`;
}

function deckChip(app) {
  const d = app.currentDeck();
  return `<div class="deckchip" style="--fc:${facColor(d.fac)}"><span class="dot"></span><div><b>${esc(d.name)}</b><span>${FACTIONS[d.fac].name} · ${esc(FACTIONS[d.fac].style)}</span></div>
    <button type="button" class="btn ghost" data-act="decks">덱 바꾸기</button></div>`;
}

function playPanel(app) {
  const lb = app.lobby;
  const q = lb && lb.state.st === 'q';
  const roomOk = !!lb && !lb.error;
  const rooms = lb ? lb.teamRooms() : [];
  return `<article class="panel play">
    <h2>플레이</h2>
    ${deckChip(app)}
    <div class="modes">
      <button type="button" class="mode" data-act="solo"><b>솔로 도전</b><span>AI ${FLOORS.length}층을 차례로 이기기 · 최고 점수가 순위에 반영</span></button>
      <button type="button" class="mode ${q ? 'on' : ''}" data-act="quick" ${roomOk ? '' : 'disabled'}><b>${q ? '찾는 중… (취소)' : '빠른 대전'}</b><span>1:1 · 같은 버튼을 누른 친구와 자동으로 연결</span></button>
      <button type="button" class="mode" data-act="team-host" ${roomOk ? '' : 'disabled'}><b>팀전 방 만들기</b><span>2:2 · 생명력 30을 함께 쓰는 팀 대결 · 빈자리는 AI</span></button>
    </div>
    ${rooms.length ? `<h3>모집 중인 팀전 방</h3><ul class="rooms">${rooms.map((r) => `<li><span>${esc(app.nameOf(r.host.by))}의 방 · ${r.n}/4</span><button type="button" class="btn" data-act="team-join" data-code="${esc(r.code)}">참가</button></li>`).join('')}</ul>` : ''}
    ${!roomOk ? '<p class="muted">실시간 대전을 쓸 수 없는 화면이에요. 로그인하고 공유받은 링크로 열면 친구와 대전할 수 있어요.</p>' : ''}
  </article>`;
}

function onlinePanel(app) {
  const lb = app.lobby;
  if (!lb) return '';
  const others = lb.others();
  return `<article class="panel online">
    <h2>접속 중 <span class="count">${others.length + 1}</span></h2>
    <ul class="people">
      <li class="me">${avatarHtml(app.plat.me, 28)}<b>${esc(app.plat.me.name || '나')}</b><span class="muted">${STATUS[lb.state.st] || ''}</span></li>
      ${others
        .map((p) => {
          const st = p.presence.st || 'idle';
          const free = st === 'idle' || st === 'q';
          return `<li>${avatarHtml(app.profile(p.by), 28)}<b>${esc(app.nameOf(p.by))}</b><span class="muted">${STATUS[st] || ''}</span>
          ${free && lb.state.st !== 'busy' ? `<button type="button" class="btn" data-act="challenge" data-peer="${esc(p.peer)}">1:1 도전</button>` : ''}</li>`;
        })
        .join('')}
    </ul>
    ${others.length ? '' : '<p class="muted">지금은 나 혼자예요. 친구가 이 링크를 열면 여기에 보여요.</p>'}
  </article>`;
}

function boardPanel(app) {
  const rows = app.rows || [];
  const c = app.store.config;
  const owner = app.plat.me.isOwner;
  const fin = app.store.final && c && app.store.final.id === c.id;
  return `<article class="panel ranks">
    <h2>순위표 ${fin ? '<span class="pill">확정</span>' : app.store.liveEvent ? '<span class="pill live">실시간</span>' : ''}</h2>
    ${
      rows.length
        ? `<div class="tablewrap"><table><thead><tr><th>순위</th><th>이름</th><th>솔로</th><th>대전</th><th>합계</th>${owner ? '<th></th>' : ''}</tr></thead><tbody>
      ${rows
        .map(
          (r) => `<tr class="${r.uid === app.plat.me.id ? 'me' : ''}">
        <td class="num">${r.rank}</td>
        <td class="who">${avatarHtml(app.profile(r.uid), 22)}<span>${esc(app.nameOf(r.uid))}</span></td>
        <td class="num">${r.solo}${r.soloState === 'bad' ? ' <span class="bad" title="다시 계산한 점수가 기록과 달라서 반영하지 않았어요">✗</span>' : r.soloState === 'ok' ? ' <span class="good" title="리플레이로 검증됨">✓</span>' : ''}</td>
        <td class="num">${r.pvp}<small>${r.w}승 ${r.l}패${r.d ? ` ${r.d}무` : ''}${r.unconfirmed ? ` · 미확인 ${r.unconfirmed}` : ''}</small></td>
        <td class="num total">${r.total}</td>
        ${owner ? `<td><button type="button" class="btn ghost tiny" data-act="del-player" data-uid="${esc(r.uid)}">기록 삭제</button></td>` : ''}
      </tr>`,
        )
        .join('')}</tbody></table></div>`
        : '<p class="muted">아직 기록이 없어요.</p>'
    }
    <p class="fine">합계 = 솔로 최고 점수(리플레이 검증) + 대전 승점(승 ${PTS.W} · 무 ${PTS.D} · 패 ${PTS.L}). 대전은 상대 기록과 결과가 같을 때만 인정, 1:1은 같은 상대와 ${CAP_PER_OPPONENT}경기, 팀전은 ${CAP_TEAM}경기까지 반영.</p>
  </article>`;
}

function rulesPanel() {
  return `<details class="panel rules"><summary><h2>게임 방법</h2></summary>
    <ul>
      <li>생명력 20(팀전은 팀이 함께 30)을 먼저 0으로 만들면 이겨요.</li>
      <li>매 턴 에너지가 1씩 늘어나요(최대 10). 카드 왼쪽 위 숫자가 비용이에요.</li>
      <li>유닛은 낸 다음 턴부터 공격해요. 내 유닛을 누르고 공격할 대상을 누르세요.</li>
      <li>영웅 능력은 파벌마다 다르고, 에너지 2로 한 턴에 한 번 쓸 수 있어요.</li>
      <li>키워드: 수호(먼저 공격받음) · 돌진(바로 공격) · 보호막(첫 피해 무효) · 맹독(피해 주면 처치) · 흡혈(준 피해만큼 회복) · 질풍(두 번 공격) · 은신(공격 전엔 대상이 안 됨) · 빙결(다음 턴 공격 불가) · 침묵(능력 제거)</li>
      <li>덱은 파벌 하나 + 중립 카드로 20장. 같은 카드 2장, 전설 카드는 1장까지.</li>
      <li>팀전: 턴 순서는 A1 → B1 → A2 → B2. 같은 팀은 영웅 생명력과 전장을 같이 써요. 팀원 유닛도 강화할 수 있어요.</li>
      <li>대전 턴 제한: 1:1 60초, 팀전 45초. 시간이 지나면 자동으로 턴이 끝나요.</li>
    </ul></details>`;
}

function ownerPanel(app) {
  if (!app.plat.me.isOwner || !app.plat.db) return '';
  const live = app.store.liveEvent;
  return `<article class="panel owner"><h2>주최자 메뉴</h2>
    ${
      live
        ? `<p>이벤트가 진행 중이에요. 끝나면 이 화면이 자동으로 최종 순위를 확정해요(이 창이 열려 있을 때). 지금 끝낼 수도 있어요.</p>
           <button type="button" class="btn danger" data-act="ev-end">지금 종료하고 순위 확정</button>`
        : `<label for="ev-title">이벤트 이름</label><input id="ev-title" maxlength="40" value="${esc((app.store.config && app.store.config.title) || '카드 결투장 이벤트')}">
           <label for="ev-min">진행 시간</label>
           <select id="ev-min"><option value="60">1시간</option><option value="90" selected>1시간 30분</option><option value="120">2시간</option><option value="30">30분</option></select>
           <button type="button" class="btn primary" data-act="ev-start">이벤트 시작</button>
           <p class="fine">시작하면 새 이벤트로 순위가 처음부터 쌓여요. 이벤트 중에는 이 게임을 다시 게시(업데이트)하지 마세요. 저장된 기록의 검증이 틀어질 수 있어요.</p>`
    }
  </article>`;
}

export function renderHome(app, root) {
  const me = app.plat.me;
  root.innerHTML = `<section class="home">
    <header class="masthead">
      <div><h1>카드 결투장</h1><p class="sub">친구와 겨루는 턴제 카드 배틀 · 솔로 · 1:1 · 2:2 팀전</p></div>
      <div class="whoami">${avatarHtml(me, 34)}<span>${esc(me.name || '게스트')}</span></div>
    </header>
    ${app.resumeInfo ? `<div class="notice"><span>진행 중이던 대전이 있어요.</span><button type="button" class="btn primary" data-act="resume">돌아가기</button><button type="button" class="btn ghost" data-act="resume-drop">버리기</button></div>` : ''}
    <div class="cols">
      <div class="col">${eventPanel(app)}${playPanel(app)}${onlinePanel(app)}</div>
      <div class="col">${boardPanel(app)}${ownerPanel(app)}${rulesPanel()}</div>
    </div>
  </section>`;
}

export function tickHome(app) {
  const el = document.getElementById('ev-left');
  const live = app.store.liveEvent;
  if (el && live) el.textContent = fmtTime(live.endsAt - Date.now());
}
