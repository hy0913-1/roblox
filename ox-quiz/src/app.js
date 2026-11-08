import { connectPlatform, QuizStore } from './store.js';
import { Lobby, HostClient, PlayerClient } from './net.js';
import { SKILLS, SKILL_ORDER, CATS, LIMITS, POINTS } from './game.js';
import { PUBLIC_BANK } from './qpublic.js';
import { CHARS, charURL, iconURL } from './pixel.js';
import { Stage } from './stage.js';
import { sfx, unlock, isMuted, setMuted } from './sfx.js';

const EMOTES = ['ㅋㅋㅋ', '헐', '가자!', 'ㅠㅠ', '?!'];
const PHASE = { wait: '대기 중', count: '곧 시작', ask: '문제', reveal: '정답 공개', end: '끝' };

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function scramble(text, seed) {
  const chars = [...text];
  let s = seed >>> 0;
  for (let i = chars.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

const lget = (k, d) => {
  try {
    const v = localStorage.getItem(k);
    return v === null ? d : JSON.parse(v);
  } catch {
    return d;
  }
};
const lset = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* 무시 */
  }
};

let toastT = 0;
export function toast(msg, bad = false) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = `show${bad ? ' bad' : ''}`;
  clearTimeout(toastT);
  toastT = setTimeout(() => (el.className = ''), 2600);
}

const randCode = () => Math.random().toString(36).slice(2, 8);

// O/X 도트 마크. colored=false면 흰색(색 버튼 위)
const mark = (s, colored = true, cls = '') => `<i class="mk mk-${s === 'O' ? 'o' : 'x'}${colored ? '-c' : ''} ${cls}" role="img" aria-label="${s}"></i>`;

export class App {
  constructor(root) {
    this.root = root;
    this.screen = 'loading';
    this.profiles = {};
    this.client = null;
    this.stage = null;
  }

  async boot() {
    this.root.innerHTML = '<section class="wait"><p class="blink">불러오는 중…</p></section>';
    this.plat = await connectPlatform();
    this.me = this.plat.me;
    this.char = lget('ox-char', Math.floor(Math.random() * CHARS.length));
    this.store = new QuizStore(this.plat, () => this.onData());
    this.store.start();
    if (this.plat.room) {
      this.lobby = new Lobby(this.plat.room, { onChange: () => this.onLobby() });
      this.lobby.state.ch = this.char;
      this.lobby.start();
    }
    this.root.addEventListener('click', (e) => this.onClick(e));
    this.root.addEventListener('change', (e) => this.onChange(e));
    document.addEventListener('keydown', (e) => this.onKey(e));
    document.addEventListener('pointerdown', unlock, { once: true });
    this.go('lobby');
  }

  go(screen) {
    this.screen = screen;
    if (screen !== 'room' && this.stage) {
      this.stage.stop();
      this.stage = null;
    }
    this.render();
    window.scrollTo(0, 0);
  }

  render() {
    if (this.screen === 'lobby') this.renderLobby();
    else if (this.screen === 'admin') this.renderAdmin();
    else if (this.screen === 'room') this.updateRoom(true);
  }

  // ---------- 이름 ----------
  refreshProfiles(ids) {
    const user = this.plat.user;
    if (!user) return;
    const need = [...new Set(ids.filter((id) => id && !this.profiles[id]))];
    if (!need.length || this.profBusy) return;
    this.profBusy = true;
    user
      .profiles(need)
      .then((ps) => {
        Object.assign(this.profiles, ps);
        for (const id of need) if (!this.profiles[id]) this.profiles[id] = { name: '' };
      })
      .catch(() => {})
      .finally(() => {
        this.profBusy = false;
        if (this.screen === 'lobby') this.renderLobby();
        else if (this.screen === 'room') this.updateRoom(true);
      });
  }

  nameOf(by) {
    if (by && by === this.me.id) return this.me.name || '나';
    const p = by && this.profiles[by];
    return (p && p.name) || '참가자';
  }

  playerName(p) {
    return p.bot ? p.name : this.nameOf(p.by);
  }

  onData() {
    const ids = this.store.standings().map((r) => r.by);
    this.refreshProfiles(ids);
    if (this.screen === 'lobby') this.renderLobby();
  }

  onLobby() {
    if (!this.lobby) return;
    this.refreshProfiles(this.lobby.online().map((p) => p.by));
    if (this.screen === 'lobby') this.renderLobby();
  }

  // ---------- 로비 ----------
  renderLobby() {
    const isOwner = this.me.isOwner;
    const rooms = this.lobby ? this.lobby.rooms().filter((r) => !r.mine) : [];
    rooms.sort((a, b) => (b.off | 0) - (a.off | 0));
    const rows = this.store.standings();
    const season = this.store.season;
    const online = this.lobby ? this.lobby.online().length : 1;
    this.root.innerHTML = `<section class="lobby">
      <header class="top">
        <h1 class="logo" aria-label="OX 도트 대난투"><span class="marks" aria-hidden="true">${mark('O', true, 'logo-mk')}${mark('X', true, 'logo-mk')}</span><span aria-hidden="true">도트 대난투</span></h1>
        <div class="whoami"><img src="${charURL(this.char, 3)}" width="36" height="36" alt=""><b>${esc(this.me.name || '게스트')}</b>
          <button type="button" class="pbtn small" data-act="mute" aria-pressed="${isMuted() ? 'false' : 'true'}">${isMuted() ? '소리 꺼짐' : '소리 켜짐'}</button></div>
      </header>
      ${!this.plat.room ? '<p class="note">실시간 대전을 쓸 수 없는 화면이에요. claude.ai에 로그인한 상태로 공유받은 링크를 열어 주세요. 혼자 연습은 할 수 있어요.</p>' : ''}
      <div class="cols">
        <div class="col">
          <article class="panel">
            <h2>내 캐릭터</h2>
            <div class="chars">${CHARS.map((c, i) => `<button type="button" class="charbtn ${i === this.char ? 'on' : ''}" data-act="char" data-i="${i}" aria-label="${c.name}"><img src="${charURL(i, 3)}" width="48" height="48" alt=""><span>${c.name}</span></button>`).join('')}</div>
          </article>
          <article class="panel">
            <h2>게임하기 <small>접속 ${online}명</small></h2>
            <div class="modes">
              <button type="button" class="pbtn mode" data-act="practice"><b>혼자 연습</b><small>봇 4명과 10문제 · 순위에는 안 들어가요</small></button>
              <button type="button" class="pbtn mode" data-act="host" ${this.plat.room ? '' : 'disabled'}><b>일반 방 만들기</b><small>친구들과 자유롭게 · 봇 추가 가능 · 순위 미반영</small></button>
              ${isOwner ? `<button type="button" class="pbtn mode gold" data-act="official" ${this.plat.room && this.plat.db ? '' : 'disabled'}><b>공식전 열기 (MC)</b><small>내가 진행자 · 비밀 문제 · 결과가 순위표에 기록</small></button>
              <button type="button" class="pbtn mode" data-act="admin"><b>문제 관리 · 시즌</b><small>내 문제 추가, 시즌 초기화</small></button>` : ''}
            </div>
            <h3>열린 방</h3>
            <ul class="rooms">${rooms.length ? rooms.map((r) => `<li class="${r.off ? 'official' : ''}"><span>${r.off ? '<em>공식전</em> ' : ''}${esc(r.ti || '방')} · ${esc(this.nameOf(r.host.by))} · ${r.n | 0}명 · ${PHASE[r.ph] || ''}</span><button type="button" class="pbtn small" data-act="join" data-code="${esc(r.code)}">${r.ph === 'wait' || r.ph === 'end' ? '참가' : '관전'}</button></li>`).join('') : '<li class="muted">열린 방이 없어요. 방을 만들어 친구를 불러 보세요.</li>'}</ul>
          </article>
        </div>
        <div class="col">
          <article class="panel">
            <h2>순위표 ${season ? `<small>${esc(season.title)}</small>` : ''}</h2>
            ${!this.store.loaded && this.plat.db ? `<p class="muted">${this.store.slow ? '순위표를 아직 불러오지 못했어요. 잠시 뒤 다시 열어 보세요.' : '순위표를 불러오는 중…'}</p>` : rows.length ? `<div class="tablewrap"><table class="rank"><thead><tr><th>순위</th><th>이름</th><th>점수</th><th>공식전</th><th>1등</th></tr></thead><tbody>${rows.map((r) => `<tr class="${r.by === this.me.id ? 'me' : ''}"><td>${r.rank}</td><td>${esc(this.nameOf(r.by))}</td><td class="pts">${r.pts}</td><td>${r.games}</td><td>${r.wins}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">아직 공식전 기록이 없어요. 주최자가 공식전을 열면 여기에 쌓여요.</p>'}
            <p class="fine">공식전 점수 = 정답 ${POINTS.correct}점(3연속부터 +${POINTS.streak}) + 끝까지 생존 ${POINTS.survive}점 + 1·2·3등 ${POINTS.place.join('·')}점</p>
          </article>
          <details class="panel rules" open>
            <summary><h2>게임 방법</h2></summary>
            <ul>
              <li>문제가 나오면 <b>O</b> 또는 <b>X</b> 구역으로 이동하세요. 시간 안에는 몇 번이든 바꿀 수 있어요.</li>
              <li>틀리면 바닥이 열리고 하트를 하나 잃어요. 하트가 0이면 탈락! 전원이 틀리면 그 문제는 없던 걸로 해요.</li>
              <li>맞히면 에너지 <i class="bt" aria-hidden="true"></i>+1 (최대 ${LIMITS.maxEnergy}). 에너지로 스킬을 써서 친구를 방해하세요. 한 문제에 스킬 한 번.</li>
              <li>PC: ← / → 또는 O / X 키로 이동, 숫자 1~6으로 스킬.</li>
            </ul>
            <div class="skilllist">${SKILL_ORDER.map((k) => `<p><img src="${iconURL(k, 3)}" width="24" height="24" alt=""><b>${SKILLS[k].name}</b> <span class="cost"><i class="bt" aria-hidden="true"></i>${SKILLS[k].cost}</span> ${esc(SKILLS[k].desc)}</p>`).join('')}</div>
          </details>
        </div>
      </div>
    </section>`;
  }

  // ---------- 클릭/키 ----------
  onClick(e) {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const act = t.dataset.act;
    sfx.click();
    switch (act) {
      case 'mute':
        setMuted(!isMuted());
        this.render();
        return;
      case 'char':
        this.char = Number(t.dataset.i);
        lset('ox-char', this.char);
        if (this.lobby) this.lobby.set({ ch: this.char });
        this.renderLobby();
        return;
      case 'practice':
        this.openHost({ practice: true });
        return;
      case 'host':
        this.openHost({});
        return;
      case 'official':
        this.openOfficial();
        return;
      case 'admin':
        this.openAdmin();
        return;
      case 'join':
        this.joinRoom(t.dataset.code);
        return;
      case 'lobby':
        this.go('lobby');
        return;
      default:
    }
    if (this.screen === 'room') this.onRoomClick(act, t);
    if (this.screen === 'admin') this.onAdminClick(act, t);
  }

  // 진행자가 방 설정을 바꾸면 바로 적용해서 참가자에게도 보여 준다
  onChange(e) {
    const id = e.target && e.target.id;
    const c = this.client;
    if (this.screen !== 'room' || !c || c.role === 'player' || !['set-total', 'set-lives', 'set-time'].includes(id)) return;
    const val = Number(e.target.value);
    if (c.game.phase === 'end') {
      c.game.reset();
      c.onPeers();
    }
    if (id === 'set-total') c.game.setSettings({ total: val });
    if (id === 'set-lives') c.game.setSettings({ lives: val });
    if (id === 'set-time') c.game.setSettings({ askMs: val * 1000 });
    c.publish(true);
    this.updateRoom(true);
  }

  onKey(e) {
    if (this.screen !== 'room' || !this.client || e.target.closest('input,textarea,select')) return;
    const k = e.key.toLowerCase();
    const v = this.view();
    // 뒤집기에 걸리면 화살표도 화면의 버튼 자리를 따른다
    const swapped = v && this.eff.swapRound === v.round;
    if (k === 'arrowleft') this.move(swapped ? 'X' : 'O');
    else if (k === 'arrowright') this.move(swapped ? 'O' : 'X');
    else if (k === 'o') this.move('O');
    else if (k === 'x') this.move('X');
    else if (k >= '1' && k <= '6') this.pickSkill(SKILL_ORDER[Number(k) - 1]);
    else if (k === 'escape') {
      this.targeting = null;
      this.updateRoom(true);
    }
  }

  // ---------- 방 열기/참가 ----------
  async openHost({ practice = false }) {
    if (this.client) return;
    const room = this.plat.room || offlineRoom();
    const client = new HostClient({
      room,
      code: randCode(),
      me: this.me,
      char: this.char,
      title: practice ? '혼자 연습' : `${this.me.name || '친구'}의 방`,
      bank: PUBLIC_BANK,
      settings: practice ? { total: 10, lives: 3, askMs: 10000 } : undefined,
      hooks: this.roomHooks(),
    });
    if (practice) for (let i = 0; i < 4; i++) client.game.addBot();
    try {
      await client.start();
    } catch {
      toast('방을 만들지 못했어요', true);
      return;
    }
    this.enterRoom(client, practice ? null : { off: 0 });
    if (practice) setTimeout(() => client.game.start(Date.now()) && client.publish(true), 600);
  }

  async openOfficial() {
    if (this.client) return;
    toast('문제를 불러오는 중…');
    const bank = await this.store.loadBank();
    const list = [...bank.main, ...bank.custom];
    if (!list.length) {
      toast('공식전 문제가 없어요. 문제 관리에서 추가해 주세요.', true);
      return;
    }
    const season = await this.store.ensureSeason().catch(() => null);
    const client = new HostClient({
      room: this.plat.room,
      code: randCode(),
      me: this.me,
      mc: true,
      official: true,
      title: `공식전 #${this.store.matchesThisSeason().length + 1}`,
      bank: list,
      used: new Set((season && season.used) || []),
      hooks: {
        ...this.roomHooks(),
        onOfficialEnd: (game) =>
          this.store.recordResult(game).then(
            (n) => toast(`공식전 결과를 순위표에 기록했어요 (${n}명)`),
            () => toast('결과를 기록하지 못했어요', true),
          ),
      },
    });
    try {
      await client.start();
    } catch {
      toast('방을 만들지 못했어요', true);
      return;
    }
    this.bankInfo = { total: list.length, fresh: list.filter((q) => !client.game.used.has(q.id)).length };
    this.enterRoom(client, { off: 1 });
  }

  async joinRoom(code) {
    if (this.client) return;
    const client = new PlayerClient({ room: this.plat.room, code, me: this.me, char: this.char, hooks: this.roomHooks() });
    try {
      await client.start();
    } catch {
      toast('방에 들어가지 못했어요', true);
      return;
    }
    this.enterRoom(client, null);
  }

  roomHooks() {
    return {
      onUpdate: () => this.scheduleRoom(),
      onClosed: (why) => {
        toast(why === 'host_left' ? '진행자가 나가서 방이 닫혔어요' : '방 연결이 끊겼어요', true);
        this.leaveRoom();
      },
      onPublish: (game) => {
        if (!this.lobby || !this.client || !this.advertised || this.client.game !== game) return;
        const n = [...game.players.values()].filter((p) => !p.bot).length;
        const rm = { code: this.client.code, off: game.official ? 1 : 0, n, ti: game.title, ph: game.phase };
        const cur = this.lobby.state.rm;
        if (!cur || cur.n !== rm.n || cur.ph !== rm.ph || cur.code !== rm.code) this.lobby.set({ rm, st: 'room' });
      },
    };
  }

  enterRoom(client, advertise) {
    this.client = client;
    this.advertised = !!advertise && client.role !== 'player';
    this.ticks = new Set();
    this.fxSeen = -1;
    this.emSeen = {};
    this.lastKey = '';
    this.targeting = null;
    this.eff = { ink: 0, mess: 0, ice: 0, swapRound: -1, skillRound: -1 };
    if (this.lobby) this.lobby.set({ st: 'room', rm: advertise && client.role !== 'player' ? { code: client.code, off: advertise.off, n: 1, ti: client.game.title, ph: 'wait' } : null });
    this.screen = 'room';
    this.root.innerHTML = `<section class="room">
      <div class="rtop"><button type="button" class="pbtn small" data-act="leave">나가기</button><b class="rtitle"></b><span class="rinfo"></span><span class="mystat"></span></div>
      <div class="timer"><i></i></div>
      <div class="stagewrap"><canvas id="stage" aria-label="O X 무대"></canvas></div>
      <div class="qbox" aria-live="polite"></div>
      <div class="ctrl"></div>
      <div class="skills"></div>
      <div class="emotes">${EMOTES.map((e) => `<button type="button" class="pbtn small" data-act="emote" data-e="${esc(e)}">${esc(e)}</button>`).join('')}</div>
      <div class="chips"></div>
    </section>`;
    this.stage = new Stage(document.getElementById('stage'));
    this.stage.start();
    // 폰에서는 무대의 캐릭터를 눌러 스킬 대상을 고를 수 있다
    this.stage.cv.addEventListener('click', (e) => {
      if (!this.targeting) return;
      const v = this.view();
      const pid = this.stage && this.stage.pick(e.clientX, e.clientY);
      const t = pid && v && v.roster.find((p) => p.pid === pid);
      if (t && t.alive && (!v.me || t.pid !== v.me.pid)) this.cast(this.targeting, pid);
    });
    if (client.role !== 'player') this.keepAwake(true);
    this.sig = {};
    this.updateRoom(true);
    const loop = () => {
      if (this.screen !== 'room' || this.client !== client) return;
      this.frame();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // 진행자 화면이 꺼지면 게임이 멈추므로 화면 꺼짐을 막는다(안 되면 그냥 넘어감)
  async keepAwake(on) {
    try {
      if (on && navigator.wakeLock && !this.wake) {
        this.wake = await navigator.wakeLock.request('screen');
        if (!this.wakeHooked) {
          this.wakeHooked = true;
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && this.client && this.client.role !== 'player' && !this.wake) this.keepAwake(true);
          });
        }
        this.wake.addEventListener('release', () => (this.wake = null));
      } else if (!on && this.wake) {
        await this.wake.release();
        this.wake = null;
      }
    } catch {
      this.wake = null;
    }
  }

  async leaveRoom() {
    const c = this.client;
    this.client = null;
    this.keepAwake(false);
    if (c) await c.leave();
    if (this.lobby) this.lobby.set({ st: 'lobby', rm: null });
    this.go('lobby');
  }

  scheduleRoom() {
    if (this.roomRaf) return;
    this.roomRaf = requestAnimationFrame(() => {
      this.roomRaf = 0;
      this.updateRoom(false);
    });
  }

  // ---------- 방 화면 ----------
  view() {
    return this.client ? this.client.view() : null;
  }

  updateRoom(force) {
    if (this.screen !== 'room' || !this.client) return;
    const v = this.view();
    const q = (s) => this.root.querySelector(s);
    if (!v) {
      q('.qbox').innerHTML = '<p class="blink">진행자와 연결하는 중…</p>';
      return;
    }
    this.refreshProfiles(v.roster.map((p) => p.by));
    const me = v.me;
    const key = `${v.phase}|${v.round}`;
    if (key !== this.lastKey) this.onPhase(v);
    this.lastKey = key;
    this.applyFx(v);
    // 무대
    if (this.stage) {
      this.stage.aim = !!this.targeting;
      this.stage.setPlayers(v.roster.map((p) => ({ pid: p.pid, char: p.char, name: this.playerName(p), side: p.side, alive: p.alive, frozen: p.frozen, shield: p.shield, me: v.me && p.pid === v.me.pid })));
      for (const p of v.roster) {
        if (p.emN > (this.emSeen[p.pid] || 0)) {
          if (this.emSeen[p.pid] !== undefined) this.stage.bubble(p.pid, p.em);
          this.emSeen[p.pid] = p.emN;
        } else if (this.emSeen[p.pid] === undefined) this.emSeen[p.pid] = p.emN;
      }
    }
    q('.emotes').hidden = !me || v.phase === 'wait';
    q('.rtitle').textContent = v.title || '';
    q('.rinfo').textContent = v.phase === 'wait' ? `참가 ${v.roster.length}명` : v.phase === 'end' ? '경기 끝' : `${v.round || 0} / ${v.total}`;
    q('.mystat').innerHTML = me ? `${heartsHtml(me.hearts, v.lives)} <span class="bolt"><i class="bt" aria-hidden="true"></i>${me.energy}</span> <span class="score">${me.score}점</span>` : this.client.role === 'mc' ? '<span class="mc">진행자(MC)</span>' : '<span class="muted">관전 중</span>';
    this.renderQ(v);
    this.renderCtrl(v, force);
    this.renderSkills(v, force);
    this.renderChips(v, force);
  }

  onPhase(v) {
    const me = v.me;
    if (v.phase === 'ask') {
      this.stage && this.stage.clearReveal();
      this.ticks = new Set();
      this.targeting = null;
      sfx.question();
    } else if (v.phase === 'reveal') {
      const res = {};
      for (const p of v.roster) if (p.res) res[p.pid] = p.res === 'o';
      this.stage && this.stage.reveal(v.a, res);
      if (me && me.res === 'o') sfx.correct();
      else if (me && me.res === 'x') (me.alive ? sfx.wrong : sfx.out)();
    } else if (v.phase === 'count') sfx.go();
    else if (v.phase === 'end' && v.ranking && me) {
      const mine = v.ranking.find((r) => r[0] === me.pid);
      if (mine && mine[1] === 1) sfx.win();
    }
  }

  applyFx(v) {
    if (this.fxSeen < 0) {
      this.fxSeen = v.fx.reduce((m, f) => Math.max(m, f[0]), 0);
      return;
    }
    const myPid = v.me && v.me.pid;
    for (const [i, from, to, kind, blocked] of v.fx) {
      if (i <= this.fxSeen) continue;
      this.fxSeen = i;
      if (this.stage) this.stage.shoot(from, to, kind, !!blocked);
      if (from !== myPid) sfx.cast();
      if (to !== myPid || SKILLS[kind].self) continue;
      if (blocked) {
        sfx.block();
        toast('방패로 방해를 막았어요!');
        continue;
      }
      sfx.hit();
      const now = performance.now();
      const who = v.roster.find((p) => p.pid === from);
      const name = who ? this.playerName(who) : '누군가';
      if (kind === 'ink') this.eff.ink = now + SKILLS.ink.dur;
      if (kind === 'mess') this.eff.mess = now + SKILLS.mess.dur;
      if (kind === 'ice') this.eff.ice = now + SKILLS.ice.dur;
      if (kind === 'swap') this.eff.swapRound = v.round;
      if (kind === 'push' && this.client.pushed) {
        const st = this.client.snap && this.client.snap.S && this.client.snap.S[myPid];
        this.client.pushed(st ? st[6] : '');
      }
      toast(`${name}의 ${SKILLS[kind].name}!`, true);
    }
  }

  frame() {
    const v = this.view();
    const bar = this.root.querySelector('.timer i');
    if (!v || !bar) return;
    const now = performance.now();
    let left = 0;
    let total = 1;
    if (v.phase === 'ask') {
      left = v.deadline - now;
      total = v.askMs;
    } else if (v.phase === 'count' || v.phase === 'reveal') {
      left = v.deadline - now;
      total = v.phase === 'count' ? 3500 : 5500;
    }
    const f = Math.max(0, Math.min(1, left / total));
    bar.style.width = `${f * 100}%`;
    bar.className = v.phase === 'ask' && left < 3000 ? 'hurry' : '';
    if (v.phase === 'ask' && left > 0 && left < 3200) {
      const s = Math.ceil(left / 1000);
      if (!this.ticks.has(s)) {
        this.ticks.add(s);
        sfx.tick();
      }
    }
    const big = this.root.querySelector('.count');
    if (big && v.phase === 'count') big.textContent = Math.max(1, Math.ceil(left / 1000));
    // 효과(먹물/뒤죽박죽/얼음) 시간 갱신
    const qb = this.root.querySelector('.qbox');
    if (qb) {
      qb.classList.toggle('inked', this.eff.ink > now && v.phase === 'ask');
      const msg = qb.querySelector('.qt');
      if (msg && v.q) {
        const want = this.eff.mess > now && v.phase === 'ask' ? scramble(v.q.t, Math.floor(now / 400)) : v.q.t;
        if (msg.textContent !== want) msg.textContent = want;
      }
    }
    const frozen = this.eff.ice > now;
    this.root.querySelectorAll('.answer').forEach((b) => b.classList.toggle('frozen', frozen));
  }

  renderQ(v) {
    const qb = this.root.querySelector('.qbox');
    let html = '';
    if (v.phase === 'wait') html = `<p class="big">${this.client.role === 'player' ? '진행자가 시작하기를 기다리는 중…' : '참가자를 기다리는 중'}</p><p class="muted">참가자 ${v.roster.length}명 · 문제 ${v.total}개 · 하트 ${v.lives}개 · ${Math.round(v.askMs / 1000)}초</p>`;
    else if (v.phase === 'count') html = '<p class="muted">곧 시작해요</p><p class="count">3</p>';
    else if ((v.phase === 'ask' || v.phase === 'reveal') && v.q) {
      html = `<p class="cat">${esc(CATS[v.q.c] || '')} · ${v.round}번 문제</p><p class="qt">${esc(v.q.t)}</p>`;
      if (v.phase === 'ask' && v.mcAnswer) html += `<p class="mcans">정답 ${mark(v.mcAnswer, true, 'sm')} <small>(진행자에게만 보여요)</small></p>`;
      if (v.phase === 'reveal') {
        const me = v.me;
        html += `<p class="ans">정답은 ${mark(v.a, true, 'md')}${me && me.res ? (me.res === 'o' ? ' <span class="good">정답!</span>' : v.allWrong ? ' <span class="muted">(전원 오답이라 무효)</span>' : ` <span class="bad">오답 ${me.alive ? '-1 하트' : '탈락'}</span>`) : ''}</p><p class="ex">${esc(v.x)}</p>`;
        if (v.allWrong) html += '<p class="muted">모두 틀려서 아무도 하트를 잃지 않았어요.</p>';
      }
      html += '<div class="ink" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>';
    } else if (v.phase === 'end') html = this.resultsHtml(v);
    if (qb.dataset.html !== html) {
      qb.dataset.html = html;
      qb.innerHTML = html;
    }
  }

  resultsHtml(v) {
    const byPid = Object.fromEntries(v.roster.map((p) => [p.pid, p]));
    const rows = (v.ranking || []).map(([pid, place, pts]) => {
      const p = byPid[pid];
      return `<tr class="${v.me && v.me.pid === pid ? 'me' : ''}"><td>${place}</td><td><img src="${charURL(p ? p.char : 0, 2)}" width="24" height="24" alt=""> ${esc(p ? this.playerName(p) : '')}</td><td>${p ? p.correct : 0}</td><td class="pts">${pts}</td></tr>`;
    });
    return `<p class="big">경기 끝!</p><div class="tablewrap"><table class="rank"><thead><tr><th>순위</th><th>이름</th><th>정답</th><th>점수</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>${v.official ? '<p class="good">공식전 결과는 순위표에 기록돼요.</p>' : '<p class="muted">일반전이라 순위표에는 들어가지 않아요.</p>'}`;
  }

  renderCtrl(v, force) {
    const el = this.root.querySelector('.ctrl');
    const role = this.client.role;
    const me = v.me;
    const now = performance.now();
    let html = '';
    if (v.phase === 'wait' || v.phase === 'end') {
      if (role !== 'player') {
        const g = this.client.game;
        const humans = v.roster.filter((p) => !p.bot).length;
        html = `<div class="setup">
          <label>문제 <select id="set-total">${[10, 15, 20].map((n) => `<option ${g.settings.total === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
          <label>하트 <select id="set-lives">${[1, 2, 3, 5].map((n) => `<option ${g.settings.lives === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
          <label>시간 <select id="set-time">${[8, 10, 12, 15].map((n) => `<option value="${n}" ${g.settings.askMs === n * 1000 ? 'selected' : ''}>${n}초</option>`).join('')}</select></label>
          ${role === 'host' ? '<button type="button" class="pbtn small" data-act="bot-add">봇 추가</button><button type="button" class="pbtn small" data-act="bot-del">봇 빼기</button>' : ''}
          <button type="button" class="pbtn go" data-act="start" ${v.roster.length ? '' : 'disabled'}>${v.phase === 'end' ? '다시 하기' : '시작'}</button>
        </div>${role === 'mc' ? `<p class="fine">공식전은 봇 없이 진행해요. 사람 ${humans}명 · 새 문제 ${this.bankInfo ? this.bankInfo.fresh : '?'}개 남음 (다 쓰면 이미 낸 문제가 다시 나와요)</p>` : ''}`;
      } else html = v.phase === 'end' ? '<p class="muted">진행자가 다시 시작하면 바로 이어서 해요.</p>' : '';
    } else if (role === 'mc') {
      const n = (s) => v.roster.filter((p) => p.alive && p.side === s).length;
      html = `<div class="mcpanel"><span>${mark('O', false, 'sm')} ${n('O')}명</span><span>${mark('X', false, 'sm')} ${n('X')}명</span><span>고민 중 ${n('')}명</span><button type="button" class="pbtn small" data-act="finish">지금 끝내기</button></div>`;
    } else if (me && me.alive) {
      const swapped = this.eff.swapRound === v.round;
      const disabled = v.phase !== 'ask' || this.eff.ice > now;
      const b = (s) => `<button type="button" class="pbtn answer ${s === 'O' ? 'ob' : 'xb'} ${me.side === s ? 'on' : ''}" data-act="side" data-side="${s}" ${disabled ? 'disabled' : ''} aria-label="${s}로 이동"><i class="mk mk-${s === 'O' ? 'o' : 'x'}" aria-hidden="true"></i></button>`;
      html = `<div class="answers ${swapped ? 'swapped' : ''}">${swapped ? b('X') + b('O') : b('O') + b('X')}</div>${swapped ? '<p class="fine bad">뒤집기에 걸려서 버튼 자리가 바뀌었어요!</p>' : ''}`;
    } else if (me && !me.alive) html = '<p class="muted">탈락했어요. 끝까지 구경하며 응원해 주세요!</p>';
    else html = '<p class="muted">관전 중이에요. 다음 판부터 참가할 수 있어요.</p>';
    const sig = `${html}`;
    if (force || this.sig.ctrl !== sig) {
      this.sig.ctrl = sig;
      el.innerHTML = html;
    }
  }

  renderSkills(v, force) {
    const el = this.root.querySelector('.skills');
    const me = v.me;
    let html = '';
    if (me && me.alive && v.phase !== 'end' && v.phase !== 'wait') {
      const used = this.eff.skillRound === v.round;
      html = SKILL_ORDER.map((k, i) => {
        const sk = SKILLS[k];
        const ok = v.phase === 'ask' && !used && me.energy >= sk.cost;
        return `<button type="button" class="pbtn skill ${this.targeting === k ? 'on' : ''}" data-act="skill" data-id="${k}" ${ok ? '' : 'disabled'} title="${esc(sk.desc)}"><img src="${iconURL(k, 3)}" width="24" height="24" alt=""><b>${sk.name}</b><small><i class="bt" aria-hidden="true"></i>${sk.cost} · ${i + 1}</small></button>`;
      }).join('');
      if (this.targeting) html += `<p class="fine hint">${SKILLS[this.targeting].name}: 아래 참가자 중 대상을 고르세요 (Esc 취소)</p>`;
      else if (used && v.phase === 'ask') html += '<p class="fine">이번 문제의 스킬을 썼어요.</p>';
    }
    if (force || this.sig.skills !== html) {
      this.sig.skills = html;
      el.innerHTML = html;
    }
  }

  renderChips(v, force) {
    const el = this.root.querySelector('.chips');
    const me = v.me;
    const html = v.roster
      .slice()
      .sort((a, b) => b.alive - a.alive || b.score - a.score)
      .map((p) => {
        const isMe = me && p.pid === me.pid;
        const target = this.targeting && !isMe && p.alive;
        const tags = [!p.alive ? '탈락' : '', p.frozen ? '얼음' : '', p.shield ? '방패' : '', p.streak >= 3 ? `${p.streak}연속` : ''].filter(Boolean);
        return `<${target ? 'button type="button" data-act="target"' : 'div'} class="chip ${isMe ? 'me' : ''} ${p.alive ? '' : 'out'} ${target ? 'target' : ''}" data-pid="${p.pid}">
          <img src="${charURL(p.char, 2)}" width="32" height="32" alt=""><span class="cn">${esc(this.playerName(p))}${isMe ? ' (나)' : ''}</span>
          <span class="cs">${heartsHtml(p.hearts, v.lives)} <i class="bt" aria-hidden="true"></i>${p.energy} · ${p.score}점${tags.length ? ` · ${tags.join(' ')}` : ''}</span></${target ? 'button' : 'div'}>`;
      })
      .join('');
    if (force || this.sig.chips !== html) {
      this.sig.chips = html;
      el.innerHTML = html;
    }
  }

  move(side) {
    const v = this.view();
    if (!v || !v.me || !v.me.alive || v.phase !== 'ask' || this.eff.ice > performance.now() || this.client.role === 'mc') return;
    if (v.me.side === side) return;
    this.client.move(side);
    sfx.move();
    this.updateRoom(false);
  }

  pickSkill(id) {
    const v = this.view();
    if (!v || !v.me || !v.me.alive || v.phase !== 'ask' || this.eff.skillRound === v.round) return;
    if (v.me.energy < SKILLS[id].cost) {
      toast('에너지가 부족해요', true);
      return;
    }
    if (SKILLS[id].self) {
      this.cast(id, v.me.pid);
      return;
    }
    this.targeting = this.targeting === id ? null : id;
    this.updateRoom(true);
  }

  cast(id, to) {
    const v = this.view();
    this.client.skill(id, to);
    this.eff.skillRound = v.round;
    this.targeting = null;
    sfx.cast();
    this.updateRoom(true);
  }

  onRoomClick(act, t) {
    const c = this.client;
    if (!c) return;
    switch (act) {
      case 'leave':
        this.leaveRoom();
        break;
      case 'side':
        this.move(t.dataset.side);
        break;
      case 'skill':
        this.pickSkill(t.dataset.id);
        break;
      case 'target':
        if (this.targeting) this.cast(this.targeting, t.dataset.pid);
        break;
      case 'emote':
        c.emote(t.dataset.e);
        break;
      case 'bot-add':
        if (!c.game.addBot()) toast('대기 중에만, 최대 12명까지 넣을 수 있어요', true);
        c.publish(true);
        this.updateRoom(true);
        break;
      case 'bot-del': {
        const bots = [...c.game.players.values()].filter((p) => p.bot);
        if (bots.length) c.game.removePlayer(bots[bots.length - 1].pid);
        c.publish(true);
        this.updateRoom(true);
        break;
      }
      case 'start': {
        const g = c.game;
        if (g.phase === 'end') {
          // 끝난 방: 처음 상태로 돌리고, 그 사이 들어온/나간 사람을 반영
          g.reset();
          c.onPeers();
        }
        // 설정은 고를 때마다 바로 적용돼 있다(onChange)
        if (c.role === 'mc' && ![...g.players.values()].length) {
          toast('참가자가 없어요', true);
          break;
        }
        if (!g.start(Date.now())) toast('시작할 수 없어요', true);
        c.publish(true);
        this.updateRoom(true);
        break;
      }
      case 'finish':
        if (c.game && c.game.phase !== 'end') {
          c.game.finish();
          c.events.push({ e: 'end' });
          if (c.official && c.hooks.onOfficialEnd) c.hooks.onOfficialEnd(c.game);
          c.publish(true);
        }
        break;
      default:
    }
  }

  // ---------- 문제 관리(주최자) ----------
  async openAdmin() {
    this.adminBank = null;
    this.go('admin');
    this.adminBank = await this.store.loadBank();
    this.renderAdmin();
  }

  renderAdmin() {
    // 다시 그려도 쓰던 글은 남긴다
    const draft = {};
    for (const id of ['season-title', 'aq-q', 'aq-x', 'aq-cat']) {
      const el = document.getElementById(id);
      if (el) draft[id] = el.value;
    }
    const pickedA = document.querySelector('input[name="aq-a"]:checked');
    if (this.clearDraft) {
      delete draft['aq-q'];
      delete draft['aq-x'];
      this.clearDraft = false;
    }
    const b = this.adminBank;
    const season = this.store.season;
    const count = (list, c) => list.filter((q) => q.c === c).length;
    this.root.innerHTML = `<section class="admin">
      <header class="top"><button type="button" class="pbtn small" data-act="lobby">← 로비</button><h1>문제 관리 · 시즌</h1></header>
      <article class="panel">
        <h2>시즌</h2>
        <p>${season ? `<b>${esc(season.title)}</b> · 공식전 ${this.store.matchesThisSeason().length}판 · 낸 문제 ${(season.used || []).length}개` : '아직 시즌이 없어요. 첫 공식전을 열면 자동으로 시작돼요.'}</p>
        <label for="season-title">새 시즌 이름</label><input id="season-title" maxlength="20" placeholder="예: 11월 이벤트">
        <button type="button" class="pbtn ${this.confirmSeason ? 'warn' : ''}" data-act="new-season">${this.confirmSeason ? '한 번 더 누르면 순위표가 비워져요' : '새 시즌 시작 (순위표 초기화)'}</button>
      </article>
      <article class="panel">
        <h2>공식전 문제은행</h2>
        ${!b ? '<p class="blink">불러오는 중…</p>' : `<p>기본 문제 ${b.main.length}개 (상식 ${count(b.main, 'gen')} · 게임·서브컬처 ${count(b.main, 'game')}) · 내가 추가한 문제 ${b.custom.length}개 (주최자 ${count(b.custom, 'host')})</p>
        <p class="fine">공식전은 상식 60% · 게임·서브컬처 30% · 주최자 관련 10% 비율로 나와요. 주최자 관련 문제가 적으면 다른 문제로 채워져요. 이 문제들은 주최자만 볼 수 있어요.</p>
        <div class="addq">
          <label for="aq-cat">분류</label><select id="aq-cat"><option value="host">주최자 관련</option><option value="gen">상식</option><option value="game">게임·서브컬처</option></select>
          <label for="aq-q">문제 (O 또는 X로 답할 수 있는 문장)</label><textarea id="aq-q" maxlength="110" rows="2" placeholder="예: 주최자는 민트초코를 좋아한다."></textarea>
          <label>정답</label><div class="oxpick"><label><input type="radio" name="aq-a" value="O" checked> ${mark('O', true, 'sm')}</label><label><input type="radio" name="aq-a" value="X"> ${mark('X', true, 'sm')}</label></div>
          <label for="aq-x">해설 (정답 공개 때 보여요)</label><input id="aq-x" maxlength="80" placeholder="예: 민트초코 아이스크림만 3통 먹었어요.">
          <button type="button" class="pbtn go" data-act="add-q">문제 추가</button>
        </div>
        <ul class="qlist">${b.custom.map((q) => `<li><span class="tag">${esc(CATS[q.c] || q.c)}</span>${mark(q.a, true, 'sm')}<span class="qq">${esc(q.q)}${q.x ? `<small>${esc(q.x)}</small>` : ''}</span><button type="button" class="pbtn small" data-act="del-q" data-id="${esc(q.id)}">삭제</button></li>`).join('') || '<li class="muted">추가한 문제가 없어요.</li>'}</ul>`}
      </article>
    </section>`;
    for (const [id, v] of Object.entries(draft)) {
      const el = document.getElementById(id);
      if (el) el.value = v;
    }
    if (pickedA) {
      const r = document.querySelector(`input[name="aq-a"][value="${pickedA.value}"]`);
      if (r) r.checked = true;
    }
  }

  async onAdminClick(act, t) {
    const b = this.adminBank;
    if (act === 'new-season') {
      // 되돌리기 어려운 작업이라 두 번 눌러야 실행
      if (!this.confirmSeason) {
        this.confirmSeason = setTimeout(() => {
          this.confirmSeason = 0;
          if (this.screen === 'admin') this.renderAdmin();
        }, 4000);
        this.renderAdmin();
        return;
      }
      clearTimeout(this.confirmSeason);
      this.confirmSeason = 0;
      const title = (document.getElementById('season-title').value || '').trim() || '새 시즌';
      try {
        await this.store.newSeason(title);
        toast('새 시즌을 시작했어요. 순위표가 비었어요.');
      } catch {
        toast('시즌을 바꾸지 못했어요', true);
      }
      this.renderAdmin();
    }
    if (act === 'add-q' && b) {
      const q = (document.getElementById('aq-q').value || '').trim();
      const a = (document.querySelector('input[name="aq-a"]:checked') || {}).value || 'O';
      const x = (document.getElementById('aq-x').value || '').trim();
      const c = document.getElementById('aq-cat').value;
      if (q.length < 5) {
        toast('문제를 조금 더 길게 써 주세요', true);
        return;
      }
      b.custom.push({ id: `c${Date.now().toString(36)}`, c, q, a, x });
      try {
        await this.store.saveCustom(b.custom);
        toast('문제를 추가했어요');
        this.clearDraft = true;
      } catch {
        b.custom.pop();
        toast('저장하지 못했어요', true);
      }
      this.renderAdmin();
    }
    if (act === 'del-q' && b) {
      b.custom = b.custom.filter((q) => q.id !== t.dataset.id);
      await this.store.saveCustom(b.custom).catch(() => toast('저장하지 못했어요', true));
      this.renderAdmin();
    }
  }
}

function heartsHtml(n, max) {
  let s = '';
  for (let i = 0; i < max; i++) s += `<i class="ht ${i < n ? 'on' : ''}"></i>`;
  return `<span class="hearts" aria-label="하트 ${n}개">${s}</span>`;
}

// 실시간 기능이 없는 화면에서도 혼자 연습은 되게 하는 가짜 방
function offlineRoom() {
  const named = { presence: async () => {}, onPeers: () => () => {}, peers: () => [], leave: async () => {}, connected: () => false };
  return { join: async () => named };
}
