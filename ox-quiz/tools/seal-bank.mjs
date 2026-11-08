// 공식전 비밀 문제를 주최자 비밀번호로 잠근다(AES-GCM, 키는 PBKDF2-SHA256 60만 번).
// 사용: OX_BANK_PASS='XXXX-XXXX-XXXX-XXXX' node ox-quiz/tools/seal-bank.mjs bank-main.json bank-custom.json > ox-quiz/web/bank.enc.json
// 잠그기 전 문제 파일과 비밀번호는 저장소에 넣지 않는다. 잠근 결과(bank.enc.json)만 넣는다.
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';

const ITER = 600000;
const norm = (p) => String(p || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const pass = norm(process.env.OX_BANK_PASS);
if (pass.length < 12) {
  console.error('OX_BANK_PASS(12자 이상)가 필요해요');
  process.exit(1);
}
const [mainPath, customPath] = process.argv.slice(2);
const main = JSON.parse(readFileSync(mainPath, 'utf8')).list;
const custom = customPath ? JSON.parse(readFileSync(customPath, 'utf8')).list : [];
const subtle = webcrypto.subtle;
const enc = (s) => new TextEncoder().encode(s);
const b64 = (u8) => Buffer.from(u8).toString('base64');
const salt = webcrypto.getRandomValues(new Uint8Array(16));
const iv = webcrypto.getRandomValues(new Uint8Array(12));
const base = await subtle.importKey('raw', enc(pass), 'PBKDF2', false, ['deriveKey']);
const key = await subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, key, enc(JSON.stringify({ v: 1, main, custom }))));
process.stdout.write(`${JSON.stringify({ v: 1, kdf: 'PBKDF2-SHA256', iter: ITER, salt: b64(salt), iv: b64(iv), ct: b64(ct) })}\n`);
