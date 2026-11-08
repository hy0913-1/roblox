// 클로드 아티팩트용 단일 HTML 조각을 만든다. (doctype/html/head/body는 아티팩트가 감싸 줌)
//  dist/artifact.html : 게시용. 외부 파일 없음: 도트 글꼴(갈무리11, OFL)도 data URI로 넣는다
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
    lib: { entry: resolve(here, 'src/main.js'), name: 'OxQuiz', formats: ['iife'], fileName: () => 'game.js', cssFileName: 'game' },
  },
});
const js = readFileSync(resolve(out, 'game.js'), 'utf8').replace(/<\/script/gi, '<\\/script');
const cssFile = readdirSync(out).find((f) => f.endsWith('.css'));
const css = cssFile ? readFileSync(resolve(out, cssFile), 'utf8') : '';

// 갈무리11 (한글·영문 글자만 남긴 부분 글꼴). SIL Open Font License 1.1 — 라이선스 전문을 함께 싣는다
const fontDir = resolve(here, 'assets/fonts');
const license = readFileSync(resolve(fontDir, 'OFL.txt'), 'utf8').replace(/\*\//g, '* /');
const face = (file, weight) =>
  `@font-face{font-family:"Galmuri11";src:url(data:font/woff2;base64,${readFileSync(resolve(fontDir, file)).toString('base64')}) format("woff2");font-weight:${weight};font-style:normal;font-display:swap}`;
const fonts = `/*\nGalmuri11 font (subset: Hangul syllables, Latin, punctuation) by Lee Minseo — https://github.com/quiple/galmuri\n${license}\n*/\n${face('Galmuri11.woff2', 400)}\n${face('Galmuri11-Bold.woff2', 700)}`;

const body = '<div id="app"></div>\n<div id="toast" aria-live="polite"></div>';
const fragment = `<title>OX 도트 대난투</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n<style>\n${fonts}\n${css}\n</style>\n${body}\n<script>\n${js}\n</script>\n`;
mkdirSync(out, { recursive: true });
writeFileSync(resolve(out, 'artifact.html'), fragment);
const mock = readFileSync(resolve(here, 'test/mock-claude.js'), 'utf8');
writeFileSync(
  resolve(out, 'harness.html'),
  `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><script>${mock}</script></head><body>${fragment}</body></html>`,
);
console.log(`dist/artifact.html ${(fragment.length / 1024).toFixed(0)}KB (JS ${(js.length / 1024).toFixed(0)}KB, CSS ${(css.length / 1024).toFixed(0)}KB, 글꼴 포함)`);
