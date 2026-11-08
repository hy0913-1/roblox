import { connectPlatform, resolveProfiles } from './platform.js';
import { Store } from './store.js';
import { Lobby, TeamRoom, MatchSession, savedMatch, dropSavedMatch } from './net.js';
import { setLocalUser, lget, lset } from './local.js';
import { SoloSession } from './solo-session.js';
import { PRESETS, deckCode, parseDeckCode, validateDeck } from './cards.js';
import { FLOORS } from './solo.js';
import { renderHome, tickHome } from './ui/home.js';
import { renderDecks, renderBuilder, onDeckClick } from './ui/decks.js';
import { renderRoom, onRoomClick } from './ui/room.js';
import { renderGame, onGameClick, newGameUi, tickGame } from './ui/game.js';
import { renderResult } from './ui/result.js';
import { toast, modal, closeModal, esc } from './ui/common.js';
import { randomId } from './match.js';

const DEFAULT_DECK = { code: deckCode(PRESETS[0].fac, PRESETS[0].ids), name: PRESETS[0].name };

export class App {
  constructor(root) {
    this.root = root;
    this.screen = 'loading';
    this.profiles = {};
    this.rows = [];
    this.gameUi = newGameUi();
    this.session = null;
    this.room = null;
    this.raf = 0;
  }

  async boot() {
    this.root.innerHTML = '<section class="wait"><div class="spinner" aria-hidden="true"></div><p>연결하는 중…</p></section>';
    this.plat = await connectPlatform();
    setLocalUser(this.plat.me.id);
    this.store = new Store(this.plat, () => this.onData());
    this.store.start();
    if (this.plat.room) {
      this.lobby = new Lobby(this.plat.room, this.plat.me, {
        onChange: () => this.onLobby(),
        onInvite: (peer, inv) => this.onInvite(peer, inv),
        onMatch: (m) => this.startMatch(m),
        onDeclined: (timeout) => {
          closeModal();
          toast(timeout ? '도전장에 응답이 없어요' : '도전을 거절했어요');
          this.render();
        },
      });
      this.lobby.start();
    }
    this.loadDeck();
    this.resumeInfo = savedMatch();
    this.root.addEventListener('click', (e) => this.onClick(e));
    setInterval(() => this.tick(), 1000);
    this.go('home');
  }

  // ---------- 화면 ----------
  go(screen) {
    this.screen = screen;
    if (screen !== 'game') this.gameUi = newGameUi();
    this.render(true);
    window.scrollTo(0, 0);
  }

  render(force = false) {
    if (this.screen === 'builder' && !force) return;
    if (force) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.draw();
      return;
    }
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.draw();
    });
  }

  draw() {
    const r = this.root;
    document.body.classList.toggle('in-game', this.screen === 'game');
    switch (this.screen) {
      case 'home':
        return renderHome(this, r);
      case 'decks':
        return renderDecks(this, r);
      case 'builder':
        return renderBuilder(this, r);
      case 'room':
        return this.room ? renderRoom(this, r) : this.go('home');
      case 'game':
        return this.session ? renderGame(this, r) : this.go('home');
      case 'result':
        return renderResult(this, r);
      default:
    }
  }

  tick() {
    if (this.screen === 'home') tickHome(this);
    if (this.screen === 'game') tickGame(this);
    const c = this.store && this.store.config;
    if (this.plat.me.isOwner && c && c.state === 'live' && c.endsAt && Date.now() > c.endsAt && !this.finalizing) {
      this.finalizing = true;
      this.store.endEvent().finally(() => {
        this.finalizing = false;
      });
    }
  }

  // ---------- 데이터 ----------
  onData() {
    this.rows = this.store.standings();
    if (!this.settled && this.store.loaded.players && this.store.config) {
      this.settled = true;
      this.store.settleAbandoned(this.resumeInfo && this.resumeInfo.mid);
    }
    this.refreshProfiles();
    if (this.screen !== 'game') this.render();
  }

  onLobby() {
    this.refreshProfiles();
    if (this.screen === 'home') this.render();
  }

  refreshProfiles() {
    if (!this.plat.user) return;
    const ids = new Set(this.rows.map((r) => r.uid));
    if (this.lobby) for (const p of this.lobby.others()) if (p.by) ids.add(p.by);
    if (this.room) for (const s of this.room.seats()) if (s.by) ids.add(s.by);
    if (this.session && this.session.roster) for (const r of this.session.roster) if (r.by) ids.add(r.by);
    const missing = [...ids].filter((id) => !this.profiles[id]);
    if (!missing.length || this.profilePending) return;
    this.profilePending = true;
    resolveProfiles(this.plat.user, [...ids]).then((ps) => {
      this.profilePending = false;
      Object.assign(this.profiles, ps);
      for (const id of missing) if (!this.profiles[id]) this.profiles[id] = { id, name: '', avatarUrl: '' };
      this.render();
    });
  }

  profile(uid) {
    if (uid && uid === this.plat.me.id) return this.plat.me;
    return (uid && this.profiles[uid]) || { name: '', avatarUrl: '' };
  }

  nameOf(uid) {
    return this.profile(uid).name || (uid ? '이름 비공개' : '알 수 없음');
  }

  get seatLabels() {
    const s = this.session;
    if (!s) return [];
    if (s.kind === 'solo') return [{ name: this.plat.me.name || '나', avatarUrl: this.plat.me.avatarUrl }, { name: `AI · ${FLOORS[s.run.floor].name}`, avatarUrl: '' }];
    return s.roster.map((r, i) => (r.kind === 'ai' ? { name: `AI ${i + 1}`, avatarUrl: '' } : i === s.mySeat ? { name: this.plat.me.name || '나', avatarUrl: this.plat.me.avatarUrl } : { name: this.nameOf(r.by), avatarUrl: this.profile(r.by).avatarUrl }));
  }

  // ---------- 덱 ----------
  loadDeck() {
    const v = lget('cd-deck', null);
    const p = v && parseDeckCode(v.code);
    this.deck = p && !validateDeck(p.fac, p.ids) ? v : DEFAULT_DECK;
  }

  setDeck(code, name) {
    this.deck = { code, name };
    lset('cd-deck', this.deck);
    if (this.room && this.room.state.ready) this.room.setReady(true, parseDeckCode(code).fac);
  }

  currentDeck() {
    return { ...this.deck, fac: parseDeckCode(this.deck.code).fac };
  }

  // ---------- 클릭 ----------
  onClick(e) {
    if (this.screen === 'game' && onGameClick(this, e)) return;
    if ((this.screen === 'decks' || this.screen === 'builder') && onDeckClick(this, e)) return;
    if (this.screen === 'room' && onRoomClick(this, e)) return;
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const act = t.dataset.act;
    switch (act) {
      case 'home':
        this.go('home');
        break;
      case 'decks':
        this.go('decks');
        break;
      case 'solo':
        this.startSolo();
        break;
      case 'quick':
        if (!this.lobby) break;
        this.lobby.setStatus(this.lobby.state.st === 'q' ? 'idle' : 'q');
        if (this.lobby.state.st === 'q') toast('빠른 대전을 찾는 중이에요. 다른 친구가 같은 버튼을 누르면 연결돼요');
        this.render();
        break;
      case 'team-host':
        this.openRoom(randomId(6), true);
        break;
      case 'team-join':
        this.openRoom(t.dataset.code, false);
        break;
      case 'challenge':
        this.challenge(t.dataset.peer);
        break;
      case 'del-player':
        modal('기록 삭제', `<p>${esc(this.nameOf(t.dataset.uid))}님의 이번 이벤트 기록을 지울까요? 되돌릴 수 없어요.</p>`, [
          { label: '취소', value: false },
          { label: '삭제', value: true, primary: true },
        ]).then((ok) => ok && this.store.deletePlayer(t.dataset.uid));
        break;
      case 'ev-start': {
        const min = Number(document.getElementById('ev-min').value) || 90;
        const title = (document.getElementById('ev-title').value || '').trim();
        this.store.startEvent(min, title).then(() => toast('이벤트를 시작했어요'), () => toast('시작하지 못했어요', 'bad'));
        break;
      }
      case 'ev-end':
        modal('이벤트 종료', '<p>지금 종료하고 현재 순위를 최종 순위로 확정할까요?</p>', [
          { label: '취소', value: false },
          { label: '종료하고 확정', value: true, primary: true },
        ]).then((ok) => ok && this.store.endEvent().then(() => toast('최종 순위를 확정했어요')));
        break;
      case 'resume':
        this.resume();
        break;
      case 'resume-drop':
        if (this.resumeInfo) this.store.finishGame(this.resumeInfo.mid, 'L', false);
        dropSavedMatch();
        this.resumeInfo = null;
        this.render();
        break;
      default:
    }
  }

  // ---------- 솔로 ----------
  startSolo() {
    if (this.session) return;
    if (this.lobby) this.lobby.setStatus('solo');
    this.session = new SoloSession(
      this.deck.code,
      () => this.render(),
      async (sess) => {
        let saved = false;
        if (sess.verified && sess.run.score > 0 && this.store.liveEvent) saved = await this.store.saveSolo(sess.run, sess.run.score);
        this.lastResult = { kind: 'solo', run: sess.run, verified: sess.verified, saved };
        this.session = null;
        if (this.lobby) this.lobby.setStatus('idle');
        setTimeout(() => this.go('result'), sess.abandoned ? 0 : 900);
      },
    );
    this.go('game');
  }

  // ---------- 1:1 ----------
  challenge(peerId) {
    const p = this.lobby.peers.find((x) => x.peer === peerId);
    if (!p) return;
    this.lobby.invite(p);
    modal('도전장을 보냈어요', `<p>${esc(this.nameOf(p.by))}님의 답을 기다리는 중…</p>`, [{ label: '취소', value: 'cancel' }]).then((v) => {
      if (v === 'cancel') this.lobby.cancelInvite();
    });
  }

  onInvite(peer, inv) {
    if (this.session || this.room) {
      this.lobby.answer(peer, inv, false);
      return;
    }
    modal('1:1 도전장', `<p><b>${esc(this.nameOf(peer.by))}</b>님이 대결을 신청했어요.</p><p class="muted">지금 덱: ${esc(this.deck.name)}</p>`, [
      { label: '거절', value: false },
      { label: '수락', value: true, primary: true },
    ]).then((ok) => this.lobby.answer(peer, inv, !!ok));
  }

  matchHooks() {
    return () => {
      const s = this.session;
      if (!s || s.kind === 'solo') return;
      if ((s.phase === 'done' || s.phase === 'aborted' || s.phase === 'desync') && !s.shown) {
        s.shown = true;
        const show = () => {
          this.lastResult = { kind: 'match', mode: s.mode, result: s.result };
          if (s.phase !== 'done') s.dispose();
          this.session = null;
          if (this.lobby) this.lobby.set({ st: 'idle', tr: null });
          this.go('result');
        };
        setTimeout(show, s.phase === 'done' ? 1500 : 300);
      }
      if (this.screen === 'game') this.render();
    };
  }

  startMatch({ id, mode, roster, mySeat, nr, resume, teamCode }) {
    closeModal();
    if (this.session) return;
    const deck = resume ? resume.deck : this.deck.code;
    this.session = new MatchSession({
      room: this.plat.room,
      nr,
      mid: id,
      mode,
      roster,
      mySeat,
      me: this.plat.me,
      deck,
      store: this.store,
      teamCode,
      resume,
      onUpdate: this.matchHooks(),
      aiDeckFor: (i) => {
        const p = PRESETS[(i * 3 + id.length) % PRESETS.length];
        return deckCode(p.fac, p.ids);
      },
    });
    this.session.start().catch(() => {
      toast('경기 방에 들어가지 못했어요', 'bad');
      this.session = null;
      this.go('home');
    });
    this.refreshProfiles();
    this.go('game');
  }

  async resume() {
    const r = this.resumeInfo;
    if (!r) return;
    this.resumeInfo = null;
    let nr = null;
    if (r.mode === 'team' && r.team) {
      try {
        nr = await this.plat.room.join(`t-${r.team}`);
      } catch {
        toast('방에 다시 들어가지 못했어요', 'bad');
        return;
      }
    }
    if (this.lobby) this.lobby.set({ st: 'busy' });
    this.startMatch({ id: r.mid, mode: r.mode, roster: r.roster, mySeat: r.mySeat, nr, resume: r, teamCode: r.team });
  }

  leaveGame() {
    if (this.session) {
      if (this.session.kind !== 'solo') this.session.abort('경기를 나갔어요', null);
      this.session.dispose();
    }
    this.session = null;
    if (this.lobby) this.lobby.set({ st: 'idle', tr: null });
    this.go('home');
  }

  // ---------- 팀전 방 ----------
  async openRoom(code, host) {
    if (this.session || this.room) return;
    const room = new TeamRoom(this.plat.room, code, host, this.plat.me, {
      onChange: () => {
        if (host && this.lobby) {
          const n = room.seats().filter((s) => s.kind !== 'empty').length;
          if (!this.lobby.state.tr || this.lobby.state.tr.n !== n) this.lobby.set({ tr: { code, n } });
        }
        this.refreshProfiles();
        if (this.screen === 'room') this.render();
      },
      onToast: (m) => toast(m),
      onStart: ({ mid, roster, mySeat, nr }) => {
        this.room = null;
        if (this.lobby) this.lobby.set({ tr: null, st: 'busy' });
        this.startMatch({ id: mid, mode: 'team', roster, mySeat, nr, teamCode: code });
      },
      onClosed: () => {
        toast('방이 닫혔어요');
        this.leaveRoom();
      },
    });
    try {
      await room.join();
    } catch {
      toast('팀전 방에 들어가지 못했어요', 'bad');
      return;
    }
    this.room = room;
    if (this.lobby) this.lobby.set({ st: 'room', tr: host ? { code, n: 1 } : null, qAt: 0 });
    // 비어 있는 첫 자리에 자동으로 앉기
    setTimeout(() => {
      if (this.room !== room || Number.isInteger(room.state.seat)) return;
      const i = room.seats().findIndex((s) => s.kind === 'empty');
      if (i >= 0) room.sit(i);
    }, host ? 0 : 1200);
    this.go('room');
  }

  leaveRoom() {
    if (this.room) this.room.leave();
    this.room = null;
    if (this.lobby) this.lobby.set({ st: 'idle', tr: null });
    this.go('home');
  }
}
