// 웹판 플랫폼: 클로드 아티팩트의 {db, room, user, me}와 같은 모양을 브라우저만으로 만든다.
//  db   → 이 기기의 localStorage (주최자 기기에 공식전 기록이 쌓임)
//  room → PeerJS P2P (방장 브라우저가 허브)
//  user → 닉네임(이 기기에 저장) + 서명 키 아이디
import { createLocalDb } from './localdb.js';
import { createWebRoom } from './p2p.js';
import { loadIdentity } from './identity.js';

const NAMES = 'oxw-names';

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

// 테스트 때만: localhost에서 ?ps=local 이면 내 컴퓨터의 신호 서버를 쓴다
export function peerOptions() {
  const q = new URLSearchParams(location.search);
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && q.get('ps') === 'local') {
    return { host: location.hostname, port: Number(q.get('psport') || 9000), path: '/', secure: false, debug: 0, config: { iceServers: [] } };
  }
  // PeerJS 공개 신호 서버 + PeerJS 기본 STUN/TURN(직접 연결이 막힌 망에서도 중계)
  return { debug: 0 };
}

export const isOrganizer = () => lget('oxw-org', false) === true && lget('oxw-db:bank/main', null) !== null;

export async function connectWeb() {
  const db = createLocalDb('oxw-db:');
  let ident = null;
  try {
    ident = await loadIdentity();
  } catch {
    ident = null; // https가 아니면 서명을 못 해서 대전은 꺼진다(혼자 연습은 됨)
  }
  const names = lget(NAMES, {}) || {};
  const me = { id: ident ? ident.id : null, name: lget('oxw-nick', '') || '', avatarUrl: '', isOwner: isOrganizer() };
  let saveT = 0;
  const onName = (by, name) => {
    if (!by || !name || names[by] === name) return;
    names[by] = name;
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      const keys = Object.keys(names);
      for (const k of keys.slice(0, Math.max(0, keys.length - 300))) delete names[k];
      lset(NAMES, names);
    }, 500);
  };
  const room = ident && typeof RTCPeerConnection !== 'undefined' ? createWebRoom({ ident, getName: () => me.name, onName, options: peerOptions() }) : null;
  const user = {
    profiles: async (ids) => Object.fromEntries([].concat(ids).map((id) => [id, { id, name: id === me.id ? me.name : names[id] || '' }])),
    me: async () => me,
    isOwner: async () => me.isOwner,
  };
  return { db, room, user, me, kind: 'web', names, onName };
}
