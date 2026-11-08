// 클로드 아티팩트에 올릴 단일 HTML 조각을 만든다. (<html>/<head>/<body>는 아티팩트가 감싸 주므로 넣지 않는다)
//  - Phaser: 아티팩트 규칙대로 jsDelivr CDN(정확한 버전 고정)에서 불러온다. 게임 코드는 전역 Phaser를 쓴다.
//  - 게임 코드/CSS: 페이지 안에 인라인
//  - pixelfx 이펙트 시트: data: URI 로 인라인 (CDN 외의 요청은 막히기 때문)
// 사용: npm run build:artifact  →  dist-artifact/artifact.html
import { build } from 'vite';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve('.');
const outDir = resolve(root, 'dist-artifact');
const phaserVersion = JSON.parse(readFileSync(resolve(root, 'node_modules/phaser/package.json'), 'utf8')).version;

await build({
  configFile: false,
  root,
  logLevel: 'warn',
  define: { __EMBED__: 'true' },
  build: {
    outDir,
    emptyOutDir: true,
    copyPublicDir: false,
    lib: { entry: resolve(root, 'src/main.js'), name: 'LimbusDefense', formats: ['iife'], fileName: () => 'game.js' },
    rollupOptions: { external: ['phaser'], output: { globals: { phaser: 'Phaser' } } },
  },
});

const game = readFileSync(resolve(outDir, 'game.js'), 'utf8').replace(/<\/script/gi, '<\\/script');

// 이펙트 시트를 data: URI 로
const { FX_SHEETS } = await import(resolve(root, 'src/fx/fxSheets.js').replace(/^/, 'file://'));
const assets = {};
for (const s of FX_SHEETS) {
  assets[s.file] = `data:image/png;base64,${readFileSync(resolve(root, 'public/assets/fx', s.file)).toString('base64')}`;
}

// index.html 의 스타일과 가로 안내 마크업을 그대로 가져온다
const index = readFileSync(resolve(root, 'index.html'), 'utf8');
const style = index.match(/<style>([\s\S]*?)<\/style>/)[1];
const rotate = index.match(/<div id="rotate">[\s\S]*?<\/div><\/div>/)[0];

const html = `<title>림버스 디펜스</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@500;700&display=swap" rel="stylesheet" />
<style>
  /* 단일 어두운 화면: 게임 자체가 하나의 고정된 룩이라 라이트/다크 전환 없이 모든 색을 명시한다. */
  :root { --bg: #0b0b10; --fg: #efe6c8; --gold: #d9b44a; --panel: #23232f; color-scheme: dark; }
  html, body { height: 100%; margin: 0; background: var(--bg); color: var(--fg); overflow: hidden; }
  #game { position: absolute; inset: 0; }
${style
  .replace(/html, body \{[^}]*\}\n?/, '')
  .replace(/#game \{[^}]*\}\n?/, '')
  .replace(/body \{ touch-action/, 'body { touch-action')}
</style>
<div id="game"></div>
${rotate}
<script src="https://cdn.jsdelivr.net/npm/phaser@${phaserVersion}/dist/phaser.min.js"></script>
<script>window.__ASSET_URLS = ${JSON.stringify(assets)};</script>
<script>
${game}
</script>
`;

mkdirSync(outDir, { recursive: true });
const file = resolve(outDir, 'artifact.html');
writeFileSync(file, html);
console.log(`Phaser ${phaserVersion} (jsDelivr) + 게임 ${(game.length / 1024).toFixed(0)}KB + 이펙트 시트 ${Object.keys(assets).length}개`);
console.log(`→ ${file}  (${(html.length / 1024).toFixed(0)}KB)`);
