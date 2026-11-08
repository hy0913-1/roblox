// 웹판 화면. 아티팩트판 App 위에 닉네임, 코드·초대 링크로 참가, 주최자 잠금 풀기, 받은 순위표를 더한다.
import { App, esc, toast, lget, lset, MARK } from '../app.js';
import { connectWeb } from './platform.js';
import { openVault } from './vault.js';
import { cleanName } from './p2p.js';
import { CHARS, charURL } from '../pixel.js';
import { sfx, isMuted } from '../sfx.js';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function parseCode(s) {
  const c = String(s || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  return c.length === 4 && [...c].every((ch) => CODE_CHARS.includes(ch)) ? c : '';
}

const lbRows = (lb) => (lb && Array.isArray(lb.rows) ? lb.rows : []).map(([by, name, pts, games, wins, rank]) => ({ by, name, pts, games, wins, rank }));

function timeStr(ms) {
  const d = new Date(ms);
  const today = new Date().toDateString() === d.toDateString();
  return d.toLocaleString('ko-KR', today ? { hour: '2-digit', minute: '2-digit' } : { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export class WebApp extends App {
  constructor(root) {
    super(root, { connect: connectWeb, web: true });
    this.roomKind = '';
    this.pendingCode = '';
  }

  async boot() {
    await super.boot();
    this.cachedLb = lget('oxw-lb', null);
    this.root.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.isComposing) return;
      const id = e.target && e.target.id;
      if (id === 'nick') {
        e.preventDefault();
        this.saveNick(true);
      } else if (id === 'join-code') {
        e.preventDefault();
        this.syncNick();
        this.joinRoom(e.target.value);
      } else if (id === 'org-pass') {
        e.preventDefault();
        this.orgOn();
      }
    });
    // 초대 링크(…/#ABCD)로 들어오면 바로 참가
    const fromHash = () => {
      const code = parseCode(decodeURIComponent(location.hash.slice(1)));
      if (!code || this.client) return;
      if (this.me.name) this.joinRoom(code);
      else {
        this.pendingCode = code;
        if (this.screen === 'lobby') this.renderLobby();
        toast(`닉네임을 정하면 방 ${code}에 바로 들어가요`);
        this.focusNick();
      }
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
  }

  newCode() {
    const r = crypto.getRandomValues(new Uint8Array(4));
    return [...r].map((b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
  }

  // ---------- 이름 ----------
  focusNick() {
    setTimeout(() => {
      const el = document.getElementById('nick');
      if (el) el.focus();
    }, 60);
  }

  // 닉네임 칸에 쓴 것을 저장(버튼을 안 눌렀어도)
  syncNick() {
    const el = document.getElementById('nick');
    if (!el) return;
    const name = cleanName(el.value).slice(0, 10);
    if (name && name !== this.me.name) {
      this.me.name = name;
      lset('oxw-nick', name);
    }
  }

  saveNick(loud) {
    const el = document.getElementById('nick');
    if (!el) return;
    const name = cleanName(el.value).slice(0, 10);
    if (!name) {
      toast('닉네임을 한 글자 이상 써 주세요', true);
      return;
    }
    const changed = name !== this.me.name;
    this.me.name = name;
    lset('oxw-nick', name);
    if (this.pendingCode) {
      const code = this.pendingCode;
      this.pendingCode = '';
      this.joinRoom(code);
      return;
    }
    if (changed || loud) toast('닉네임을 저장했어요');
    this.renderLobby();
  }

  // ---------- 로비 ----------
  grabInputs(ids) {
    const out = {};
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) out[id] = el.value;
    }
    const a = document.activeElement;
    return { values: out, focus: a && ids.includes(a.id) ? a.id : '' };
  }

  restoreInputs(saved) {
    for (const [id, v] of Object.entries(saved.values)) {
      const el = document.getElementById(id);
      if (el && !(id === 'org-pass' && this.clearPass)) el.value = v;
    }
    this.clearPass = false;
    if (saved.focus) {
      const el = document.getElementById(saved.focus);
      if (el) el.focus();
    }
  }

  boardPanel() {
    const org = this.me.isOwner;
    const season = this.store.season;
    let title = '';
    let body;
    if (org) {
      const rows = this.store.standings();
      title = season ? season.title : '';
      body = rows.length
        ? `${this.boardHtml(rows)}<button type="button" class="pbtn small" data-act="copy-lb">순위표 복사 (카톡에 붙여 넣기)</button>`
        : '<p class="muted">아직 공식전 기록이 없어요. 공식전을 열면 여기에 쌓여요.</p>';
    } else if (this.cachedLb && lbRows(this.cachedLb).length) {
      title = this.cachedLb.t || '';
      body = `${this.boardHtml(lbRows(this.cachedLb))}<p class="fine">공식전 방에서 마지막으로 받은 순위표예요${this.cachedLb.got ? ` (${timeStr(this.cachedLb.got)})` : ''}.</p>`;
    } else body = '<p class="muted">공식전 방에 들어가면 주최자의 순위표를 받아 와요.</p>';
    return `<article class="panel"><h2>순위표 ${title ? `<small>${esc(title)}</small>` : ''}</h2>${body}${this.pointsHtml()}</article>`;
  }

  renderLobby() {
    const saved = this.grabInputs(['nick', 'join-code', 'org-pass']);
    const org = this.me.isOwner;
    const canNet = !!this.plat.room;
    const name = this.me.name;
    this.root.innerHTML = `<section class="lobby">
      <header class="top">
        <h1 class="logo" aria-label="OX 도트 대난투"><span class="marks" aria-hidden="true">${MARK('O', true, 'logo-mk')}${MARK('X', true, 'logo-mk')}</span><span aria-hidden="true">도트 대난투</span></h1>
        <div class="whoami"><img src="${charURL(this.char, 3)}" width="36" height="36" alt=""><b>${esc(name || '이름 없음')}</b>
          <button type="button" class="pbtn small" data-act="mute" aria-pressed="${isMuted() ? 'false' : 'true'}">${isMuted() ? '소리 꺼짐' : '소리 켜짐'}</button></div>
      </header>
      ${canNet ? '' : '<p class="note">이 브라우저에서는 친구와 대전할 수 없어요. 크롬·사파리·삼성 인터넷 최신판으로 https 주소를 열어 주세요. 혼자 연습은 할 수 있어요.</p>'}
      <div class="cols">
        <div class="col">
          <article class="panel">
            <h2>내 이름과 캐릭터</h2>
            <label class="lbl" for="nick">닉네임 <small>친구들에게 보이는 이름 · 10자까지</small></label>
            <div class="joinrow"><input id="nick" maxlength="10" autocomplete="nickname" spellcheck="false" placeholder="닉네임" value="${esc(name)}"><button type="button" class="pbtn" data-act="nick-save">저장</button></div>
            ${name ? '' : `<p class="fine bad">${this.pendingCode ? `닉네임을 저장하면 방 ${esc(this.pendingCode)}에 바로 들어가요.` : '친구와 대전하려면 닉네임을 먼저 정해 주세요.'}</p>`}
            <div class="chars">${CHARS.map((c, i) => `<button type="button" class="charbtn ${i === this.char ? 'on' : ''}" data-act="char" data-i="${i}" aria-label="${c.name}"><img src="${charURL(i, 3)}" width="48" height="48" alt=""><span>${c.name}</span></button>`).join('')}</div>
          </article>
          <article class="panel">
            <h2>게임하기</h2>
            <div class="modes">
              <button type="button" class="pbtn mode" data-act="practice"><b>혼자 연습</b><small>봇 4명과 10문제 · 인터넷이 없어도 돼요</small></button>
              <button type="button" class="pbtn mode" data-act="host" ${canNet ? '' : 'disabled'}><b>방 만들기</b><small>방 코드와 초대 링크가 생겨요 · 봇 추가 가능 · 순위 미반영</small></button>
              ${org ? `<button type="button" class="pbtn mode gold" data-act="official" ${canNet ? '' : 'disabled'}><b>공식전 열기 (MC)</b><small>내가 진행자 · 비밀 문제 · 결과가 이 기기의 순위표에 기록</small></button>
              <button type="button" class="pbtn mode" data-act="admin"><b>문제 관리 · 시즌</b><small>내 문제 추가, 시즌 초기화</small></button>` : ''}
            </div>
            <h3><label for="join-code">코드로 참가</label></h3>
            <div class="joinrow"><input id="join-code" maxlength="4" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="ABCD" value="${esc(this.pendingCode)}"><button type="button" class="pbtn go" data-act="join-code" ${canNet ? '' : 'disabled'}>참가</button></div>
            <p class="fine">친구가 보낸 초대 링크를 누르면 코드 없이 바로 들어가요.</p>
          </article>
        </div>
        <div class="col">
          ${this.boardPanel()}
          ${this.rulesHtml()}
          <article class="panel">
            <h2>주최자</h2>
            ${
              org
                ? `<p>이 기기가 주최자예요. 공식전은 꼭 이 기기로 열어 주세요. 기록과 순위표가 이 기기에 저장돼요.</p>
              <button type="button" class="pbtn small ${this.confirmOff ? 'warn' : ''}" data-act="org-off">${this.confirmOff ? '한 번 더 누르면 꺼져요' : '이 기기에서 주최자 모드 끄기'}</button>`
                : `<p class="fine">이벤트를 여는 사람만 써요. 비밀번호를 넣으면 이 기기에서 공식전 비밀 문제가 열려요.</p>
              <label class="lbl" for="org-pass">주최자 비밀번호</label>
              <div class="joinrow"><input id="org-pass" type="password" autocomplete="off" spellcheck="false"><button type="button" class="pbtn" data-act="org-on">주최자 모드 켜기</button></div>`
            }
          </article>
        </div>
      </div>
    </section>`;
    this.restoreInputs(saved);
  }

  // ---------- 클릭 ----------
  onClick(e) {
    const t = e.target.closest('[data-act]');
    if (t && this.onWebAct(t.dataset.act, t)) return;
    super.onClick(e);
  }

  onWebAct(act, t) {
    switch (act) {
      case 'nick-save':
        sfx.click();
        this.saveNick(true);
        return true;
      case 'join-code': {
        sfx.click();
        this.syncNick();
        const el = document.getElementById('join-code');
        this.joinRoom(el ? el.value : '');
        return true;
      }
      case 'host':
      case 'official':
        this.syncNick();
        if (act === 'host' && !this.me.name) {
          toast('닉네임을 먼저 정해 주세요', true);
          this.focusNick();
          return true;
        }
        return false;
      case 'practice':
        this.syncNick();
        return false;
      case 'org-on':
        sfx.click();
        this.orgOn();
        return true;
      case 'org-off':
        sfx.click();
        this.orgOff();
        return true;
      case 'copy-lb':
        sfx.click();
        this.copyLb();
        return true;
      case 'copy-link':
        sfx.click();
        this.copyLink();
        return true;
      case 'copy-close': {
        const box = document.getElementById('copybox');
        if (box) box.remove();
        return true;
      }
      default:
        return t ? false : false;
    }
  }

  onChange(e) {
    if (e.target && e.target.id === 'nick') {
      this.syncNick();
      return;
    }
    super.onChange(e);
  }

  // ---------- 방 ----------
  openHost(opts = {}) {
    if (!opts.practice && !this.me.name) {
      toast('닉네임을 먼저 정해 주세요', true);
      this.focusNick();
      return undefined;
    }
    this.roomKind = opts.practice ? 'practice' : 'host';
    return super.openHost(opts);
  }

  openOfficial() {
    this.roomKind = 'official';
    return super.openOfficial();
  }

  async joinRoom(code) {
    const c = parseCode(code);
    if (!c) {
      toast('방 코드는 4글자예요 (예: K7QF)', true);
      return false;
    }
    if (!this.me.name) {
      this.pendingCode = c;
      toast('닉네임을 먼저 정해 주세요', true);
      if (this.screen === 'lobby') this.renderLobby();
      this.focusNick();
      return false;
    }
    if (!this.plat.room) {
      toast('이 브라우저에서는 대전을 할 수 없어요', true);
      return false;
    }
    if (this.client) return false;
    this.pendingCode = '';
    this.roomKind = 'player';
    toast(`방 ${c}에 연결하는 중…`);
    const ok = await super.joinRoom(c);
    if (ok) history.replaceState(null, '', `#${c}`);
    else {
      this.roomKind = '';
      history.replaceState(null, '', location.pathname + location.search);
    }
    return ok;
  }

  afterLeave() {
    this.roomKind = '';
    history.replaceState(null, '', location.pathname + location.search);
  }

  // 공식전 진행자는 순위표를 presence에 실어 참가자에게 나눠 준다
  officialExtra() {
    return () => ({ lb: this.lbPayload() });
  }

  lbPayload() {
    const season = this.store.season;
    const results = this.store.results;
    const at = results.reduce((m, r) => Math.max(m, r.at || 0), 0);
    const key = `${season ? season.id : ''}|${results.length}|${at}`;
    if (this.lbMemo && this.lbMemo.key === key) return this.lbMemo.val;
    const rows = this.store
      .standings()
      .slice(0, 30)
      .map((r) => [r.by, r.name || this.nameOf(r.by), r.pts, r.games, r.wins, r.rank]);
    const val = { t: season ? season.title : '', at, rows };
    this.lbMemo = { key, val };
    return val;
  }

  cacheLb(lb) {
    const sig = JSON.stringify([lb.t, lb.at, lb.rows]);
    if (this.lbSig === sig) return;
    this.lbSig = sig;
    for (const r of lbRows(lb)) this.plat.onName(r.by, r.name);
    this.cachedLb = { t: lb.t, at: lb.at, rows: lb.rows, got: Date.now() };
    lset('oxw-lb', this.cachedLb);
  }

  renderRoomExtras(v) {
    const share = this.root.querySelector('.share');
    const box = this.root.querySelector('.lbbox');
    if (!share || !box || !this.client) return;
    const kind = this.roomKind;
    const calm = v.phase === 'wait' || v.phase === 'end';
    const shareHtml =
      kind && kind !== 'practice' && calm
        ? `<span class="muted">방 코드</span><b class="code">${esc(this.client.code)}</b><button type="button" class="pbtn small" data-act="copy-link">초대 링크 복사</button>${kind === 'player' ? '' : '<span class="fine">카톡에 링크를 보내면 친구가 바로 들어와요</span>'}`
        : '';
    if (share.dataset.html !== shareHtml) {
      share.dataset.html = shareHtml;
      share.innerHTML = shareHtml;
      share.hidden = !shareHtml;
    }
    let lb = v.lb;
    if (kind === 'official') lb = this.lbPayload();
    if (lb && kind === 'player') this.cacheLb(lb);
    const rows = lbRows(lb);
    const html = rows.length && calm ? `<article class="panel"><h2>순위표 <small>${esc(lb.t || '')}</small></h2>${this.boardHtml(rows)}${this.pointsHtml()}</article>` : '';
    if (box.dataset.html !== html) {
      box.dataset.html = html;
      box.innerHTML = html;
    }
  }

  // ---------- 복사 ----------
  async copyText(text, okMsg) {
    try {
      await navigator.clipboard.writeText(text);
      toast(okMsg);
    } catch {
      // 복사가 막힌 브라우저: 직접 길게 눌러 복사하도록 보여 준다
      let box = document.getElementById('copybox');
      if (!box) {
        box = document.createElement('div');
        box.id = 'copybox';
        box.className = 'copybox';
        document.body.appendChild(box);
        box.addEventListener('click', (e) => {
          if (e.target.closest('[data-act="copy-close"]')) box.remove();
        });
      }
      box.innerHTML = `<p>아래 글을 길게 눌러 복사하세요</p><textarea id="copy-text" rows="4" readonly></textarea><button type="button" class="pbtn small" data-act="copy-close">닫기</button>`;
      const ta = box.querySelector('textarea');
      ta.value = text;
      ta.focus();
      ta.select();
    }
  }

  copyLink() {
    const code = this.client && this.client.code;
    if (!code) return;
    this.copyText(`${location.origin}${location.pathname}#${code}`, '초대 링크를 복사했어요. 카톡에 붙여 넣으세요');
  }

  copyLb() {
    const season = this.store.season;
    const rows = this.store.standings();
    const lines = [`[OX 도트 대난투] ${season ? season.title : ''} 순위`, ...rows.map((r) => `${r.rank}. ${r.name || this.nameOf(r.by)} ${r.pts}점 (공식전 ${r.games}판 · 1등 ${r.wins}번)`)];
    this.copyText(lines.join('\n'), '순위표를 복사했어요. 카톡에 붙여 넣으세요');
  }

  // ---------- 주최자 ----------
  async orgOn() {
    const el = document.getElementById('org-pass');
    const pass = el ? el.value : '';
    if (!pass.trim()) {
      toast('비밀번호를 입력해 주세요', true);
      return;
    }
    if (this.unlocking) return;
    this.unlocking = true;
    toast('비밀번호를 확인하는 중…');
    const bank = await openVault(pass);
    this.unlocking = false;
    if (!bank) {
      toast('비밀번호가 맞지 않아요', true);
      return;
    }
    const db = this.plat.db;
    try {
      await db.doc('bank/main').set({ v: 1, list: bank.main });
      const cur = await db.doc('bank/custom').get();
      if (!cur.exists) await db.doc('bank/custom').set({ v: 1, list: bank.custom });
    } catch {
      toast('이 기기에 저장하지 못했어요. 사생활 보호 모드라면 끄고 다시 해 주세요', true);
      return;
    }
    lset('oxw-org', true);
    this.me.isOwner = true;
    this.clearPass = true;
    toast(`주최자 모드를 켰어요. 공식전 문제 ${bank.main.length}개가 열렸어요`);
    this.renderLobby();
  }

  async orgOff() {
    if (!this.confirmOff) {
      this.confirmOff = setTimeout(() => {
        this.confirmOff = 0;
        if (this.screen === 'lobby') this.renderLobby();
      }, 4000);
      this.renderLobby();
      return;
    }
    clearTimeout(this.confirmOff);
    this.confirmOff = 0;
    await this.plat.db.doc('bank/main').delete();
    lset('oxw-org', false);
    this.me.isOwner = false;
    toast('이 기기에서 주최자 모드를 껐어요. 순위 기록은 남아 있어요');
    this.renderLobby();
  }
}
