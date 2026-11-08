// 웹판 빌드: dist-web/ 폴더 하나를 아무 정적 호스팅(GitHub Pages, Netlify 등)에 올리면 된다.
// 대전 연결은 PeerJS 공개 신호 서버(+기본 STUN/TURN)를 쓰므로 따로 서버를 돌리지 않는다.
import { build } from 'vite';
import { copyFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, 'dist-web');
await build({
  configFile: false,
  root: resolve(here, 'web'),
  base: './',
  logLevel: 'warn',
  publicDir: false,
  build: { outDir: out, emptyOutDir: true, assetsInlineLimit: 0, chunkSizeWarningLimit: 2000 },
});
copyFileSync(resolve(here, 'assets/fonts/OFL.txt'), resolve(out, 'fonts-license.txt'));
writeFileSync(resolve(out, '.nojekyll'), '');
const size = (d) => readdirSync(d).reduce((n, f) => n + (statSync(join(d, f)).isDirectory() ? size(join(d, f)) : statSync(join(d, f)).size), 0);
console.log(`dist-web/ ${(size(out) / 1024).toFixed(0)}KB`);
