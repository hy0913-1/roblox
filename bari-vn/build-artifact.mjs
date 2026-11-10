// index.html을 claude.ai 아티팩트용 한 장짜리로 묶는다. (딸린 이미지 없이 코드 그림만 쓰는 판)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, 'index.html'), 'utf8');
const cut = (a, b) => src.slice(src.indexOf(a) + a.length, src.indexOf(b));
const out = cut('<!--HEAD-->', '<!--/HEAD-->') + '<script>window.__EMBED__ = true;</script>' + cut('<!--BODY-->', '<!--/BODY-->');
mkdirSync(join(here, 'dist'), { recursive: true });
writeFileSync(join(here, 'dist', 'artifact.html'), out);
console.log('bari-vn/dist/artifact.html', (out.length / 1024).toFixed(1) + 'KB');
