// 클로드 아티팩트용 단일 HTML 조각을 만든다. (doctype/html/head/body는 아티팩트가 감싸 줌)
//  dist/artifact.html : 게시용 (외부 라이브러리 없음, 폰트만 Google Fonts)
//  dist/harness.html  : 테스트용 (가짜 window.claude + 같은 게임)
import { build } from 'vite';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, 'dist');
await build({
  configFile: false,
  root: here,
  logLevel: 'warn',
  build: {
    outDir: out,
    emptyOutDir: true,
    copyPublicDir: false,
    cssCodeSplit: false,
    lib: { entry: resolve(here, 'src/main.js'), name: 'CardDuel', formats: ['iife'], fileName: () => 'game.js', cssFileName: 'game' },
  },
});
const js = readFileSync(resolve(out, 'game.js'), 'utf8').replace(/<\/script/gi, '<\\/script');
const cssFile = readdirSync(out).find((f) => f.endsWith('.css'));
const css = cssFile ? readFileSync(resolve(out, cssFile), 'utf8') : '';
const fonts = '<link rel="preconnect" href="https://fonts.googleapis.com" />\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n<link href="https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=IBM+Plex+Sans+KR:wght@400;600;700&display=swap" rel="stylesheet" />';
const body = `<div id="app"></div>\n<div id="modal" hidden></div>\n<div id="toast" aria-live="polite"></div>`;
const fragment = `<title>카드 결투장</title>\n${fonts}\n<style>\n${css}\n</style>\n${body}\n<script>\n${js}\n</script>\n`;
mkdirSync(out, { recursive: true });
writeFileSync(resolve(out, 'artifact.html'), fragment);
const mock = readFileSync(resolve(here, 'test/mock-claude.js'), 'utf8');
writeFileSync(
  resolve(out, 'harness.html'),
  `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><script>${mock}</script></head><body>${fragment}</body></html>`,
);
console.log(`dist/artifact.html ${(fragment.length / 1024).toFixed(0)}KB (JS ${(js.length / 1024).toFixed(0)}KB, CSS ${(css.length / 1024).toFixed(0)}KB)`);
