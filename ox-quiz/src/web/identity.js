// 웹판 신원: 기기마다 서명 키(ECDSA P-256)를 하나 만들어 이 브라우저에 보관한다.
// 아이디 = 공개키의 해시. 방에 들어갈 때 방장이 준 일회용 숫자에 서명해서 "그 아이디의 주인"임을 증명한다.
// 비밀키는 이 기기 밖으로 나가지 않으므로 다른 사람이 내 아이디(=순위표 기록)를 흉내 낼 수 없다.
const KEY = 'oxw-key';
const ALG = { name: 'ECDSA', namedCurve: 'P-256' };
const SIGN = { name: 'ECDSA', hash: 'SHA-256' };
const enc = (s) => new TextEncoder().encode(s);

export function b64u(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function unb64u(str) {
  const s = atob(String(str).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function randomToken(bytes = 16) {
  return b64u(crypto.getRandomValues(new Uint8Array(bytes)));
}

export const canSign = () => typeof crypto !== 'undefined' && !!crypto.subtle && typeof crypto.subtle.sign === 'function';

const cleanPub = (p) => ({ kty: 'EC', crv: 'P-256', x: String(p.x), y: String(p.y) });

export async function idOf(pub) {
  const h = await crypto.subtle.digest('SHA-256', enc(`${pub.x}.${pub.y}`));
  return `w${b64u(h).slice(0, 21)}`;
}

export async function verify(pub, text, sig) {
  try {
    const key = await crypto.subtle.importKey('jwk', { ...cleanPub(pub), ext: true }, ALG, false, ['verify']);
    return await crypto.subtle.verify(SIGN, key, unb64u(sig), enc(text));
  } catch {
    return false;
  }
}

export async function loadIdentity() {
  if (!canSign()) throw new Error('no-subtle');
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    saved = null;
  }
  let priv = null;
  let pub = null;
  if (saved && saved.priv && saved.pub) {
    try {
      priv = await crypto.subtle.importKey('jwk', saved.priv, ALG, false, ['sign']);
      pub = cleanPub(saved.pub);
    } catch {
      priv = null;
    }
  }
  if (!priv) {
    const kp = await crypto.subtle.generateKey(ALG, true, ['sign', 'verify']);
    const privJwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
    pub = cleanPub(await crypto.subtle.exportKey('jwk', kp.publicKey));
    try {
      localStorage.setItem(KEY, JSON.stringify({ priv: privJwk, pub }));
    } catch {
      /* 저장이 안 되면 이번 방문 동안만 같은 아이디 */
    }
    priv = kp.privateKey;
  }
  const id = await idOf(pub);
  return {
    id,
    pub,
    sign: async (text) => b64u(await crypto.subtle.sign(SIGN, priv, enc(text))),
  };
}
