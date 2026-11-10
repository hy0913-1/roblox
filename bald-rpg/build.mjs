// 빛나리 용사전 빌드.
//  dist/artifact.html : 클로드 아티팩트용 한 파일(글꼴까지 안에 넣음; html/head/body는 아티팩트가 감싼다)
//  dist/index.html    : 같은 내용을 그냥 열 수 있는 웹페이지로
import { build } from 'vite';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)), out = resolve(here, 'dist');
await build({
  configFile: false, root: here, logLevel: 'warn',
  build: { outDir: out, emptyOutDir: true, copyPublicDir: false, cssCodeSplit: false, lib: { entry: resolve(here, 'src/main.js'), name: 'BaldRpg', formats: ['iife'], fileName: () => 'game.js', cssFileName: 'game' } },
});
const js = readFileSync(resolve(out, 'game.js'), 'utf8').replace(/<\/script/gi, '<\\/script');
const css = readFileSync(resolve(out, readdirSync(out).find((f) => f.endsWith('.css'))), 'utf8');
const lic = readFileSync(resolve(here, 'assets/OFL.txt'), 'utf8').replace(/\*\//g, '* /');
const mit = readFileSync(resolve(here, 'vendor/pixelfx/LICENSE'), 'utf8').replace(/\*\//g, '* /');
const face = (f, w) => `@font-face{font-family:"Galmuri11";src:url(data:font/woff2;base64,${readFileSync(resolve(here, 'assets', f)).toString('base64')}) format("woff2");font-weight:${w};font-style:normal;font-display:swap}`;
const fonts = `/*\nGalmuri11 font (subset) by Lee Minseo — https://github.com/quiple/galmuri\n${lic}\n*/\n${face('Galmuri11.woff2', 400)}\n${face('Galmuri11-Bold.woff2', 700)}`;
const credit = `/*\nPixel effects, creatures and the character rig: pixelfx (https://github.com/patch-gg/pixelfx), with techniques from Sprite Fusion's open-source VFX by Hugo Duprez.\n${mit}\n*/`;
const fragment = `<title>빛나리 용사전</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n<style>\n${fonts}\n${css}\n</style>\n<div id="app"></div>\n<script>\n${credit}\n${js}\n</script>\n`;
writeFileSync(resolve(out, 'artifact.html'), fragment);
writeFileSync(resolve(out, 'index.html'), `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>${fragment}</body></html>`);
console.log(`dist/artifact.html ${(fragment.length / 1024).toFixed(0)}KB (JS ${(js.length / 1024).toFixed(0)}KB)`);
