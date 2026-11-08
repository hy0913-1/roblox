// 공식전 비밀 문제 열기. 페이지에는 잠긴 묶음(bank.enc.json)만 있고, 주최자 비밀번호로만 풀린다.
import sealed from '../../web/bank.enc.json';

const norm = (p) => String(p || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

// 맞으면 {main:[...], custom:[...]}, 틀리면 null
export async function openVault(pass) {
  const p = norm(pass);
  if (p.length < 12 || !crypto.subtle) return null;
  try {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(p), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: fromB64(sealed.salt), iterations: sealed.iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(sealed.iv) }, key, fromB64(sealed.ct));
    const data = JSON.parse(new TextDecoder().decode(plain));
    return { main: Array.isArray(data.main) ? data.main : [], custom: Array.isArray(data.custom) ? data.custom : [] };
  } catch {
    return null;
  }
}
