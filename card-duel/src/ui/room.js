// 팀전 대기실: A팀(1·3번 자리) vs B팀(2·4번 자리)
import { FACTIONS, parseDeckCode } from '../cards.js';
import { esc, avatarHtml, facColor } from './common.js';

function seatBox(app, room, i, seat) {
  const label = `${i % 2 === 0 ? 'A' : 'B'}${i < 2 ? 1 : 2}`;
  let body = '';
  if (seat.kind === 'human') {
    const p = app.profile(seat.by);
    body = `${avatarHtml(p, 30)}<div><b>${esc(app.nameOf(seat.by))}${seat.isMe ? ' (나)' : ''}</b><span>${seat.fac ? esc(FACTIONS[seat.fac].name) : '덱 고르는 중'} · ${seat.ready ? '<em class="good">준비 완료</em>' : '준비 중'}</span></div>`;
  } else if (seat.kind === 'ai') {
    body = `<span class="av ph">AI</span><div><b>AI</b><span>방장 브라우저가 대신 둬요</span></div>${room.isHost ? `<button type="button" class="btn ghost tiny" data-act="room-ai" data-i="${i}">빼기</button>` : ''}`;
  } else {
    const mine = room.state.seat;
    body = `<div class="emptyseat"><span>빈자리</span>
      ${!Number.isInteger(mine) || mine !== i ? `<button type="button" class="btn" data-act="room-sit" data-i="${i}">여기 앉기</button>` : ''}
      ${room.isHost ? `<button type="button" class="btn ghost" data-act="room-ai" data-i="${i}">AI 채우기</button>` : ''}</div>`;
  }
  return `<div class="seatbox ${seat.kind} ${seat.isMe ? 'me' : ''}" style="--fc:${seat.fac ? facColor(seat.fac) : 'var(--line)'}"><span class="slabel">${label}</span>${body}</div>`;
}

export function renderRoom(app, root) {
  const room = app.room;
  const seats = room.seats();
  const d = app.currentDeck();
  const sitting = Number.isInteger(room.state.seat);
  const humans = seats.filter((s) => s.kind === 'human').length;
  root.innerHTML = `<section class="teamroom">
    <header class="bar"><button type="button" class="btn ghost" data-act="room-leave">← 나가기</button><h2>팀전 대기실</h2><span class="muted">방 코드 ${esc(room.code)}</span></header>
    <div class="teams">
      <div class="team a"><h3>A팀</h3>${seatBox(app, room, 0, seats[0])}${seatBox(app, room, 2, seats[2])}</div>
      <div class="vs" aria-hidden="true">VS</div>
      <div class="team b"><h3>B팀</h3>${seatBox(app, room, 1, seats[1])}${seatBox(app, room, 3, seats[3])}</div>
    </div>
    <div class="panel roomctl">
      <div class="deckchip" style="--fc:${facColor(d.fac)}"><span class="dot"></span><div><b>${esc(d.name)}</b><span>${FACTIONS[d.fac].name}</span></div><button type="button" class="btn ghost" data-act="decks">덱 바꾸기</button></div>
      ${sitting ? `<button type="button" class="btn ${room.state.ready ? '' : 'primary'}" data-act="room-ready">${room.state.ready ? '준비 취소' : '준비 완료'}</button><button type="button" class="btn ghost" data-act="room-stand">자리에서 일어나기</button>` : '<p class="muted">빈자리를 골라 앉아 주세요.</p>'}
      ${room.isHost ? `<button type="button" class="btn primary big" data-act="room-start" ${room.canStart() ? '' : 'disabled'}>경기 시작</button><p class="fine">자리가 모두 차고(사람 2명 이상, 나머지는 AI) 모두 준비하면 시작할 수 있어요.</p>` : '<p class="fine">방장이 시작하면 바로 경기가 열려요.</p>'}
      <p class="fine">지금 사람 ${humans}명. 같은 팀은 영웅 생명력 30과 전장을 함께 써요.</p>
    </div>
  </section>`;
}

export function onRoomClick(app, e) {
  const t = e.target.closest('[data-act]');
  if (!t || !app.room) return false;
  const room = app.room;
  const i = Number(t.dataset.i);
  switch (t.dataset.act) {
    case 'room-sit':
      room.sit(i);
      return true;
    case 'room-stand':
      room.stand();
      return true;
    case 'room-ready':
      room.setReady(!room.state.ready, parseDeckCode(app.currentDeck().code).fac);
      return true;
    case 'room-ai':
      room.toggleAi(i);
      return true;
    case 'room-start':
      room.startMatch();
      return true;
    case 'room-leave':
      app.leaveRoom();
      return true;
    default:
      return false;
  }
}
