// pixelfx 이펙트를 스프라이트 시트(PNG+JSON)로 구워서 public/assets/fx 에 넣고, 게임이 읽을 src/fx/fxSheets.js 를 만든다.
// 구워진 결과물은 레포에 커밋돼 있어서, 평소엔 이 스크립트를 다시 돌릴 필요가 없다. (이펙트를 바꾸고 싶을 때만)
//
// 사용:
//   git clone https://github.com/patch-gg/pixelfx ../pixelfx
//   node scripts/bake-fx.mjs ../pixelfx
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = resolve(process.argv[2] || process.env.PIXELFX_DIR || '../pixelfx');
const outDir = resolve('public/assets/fx');
mkdirSync(outDir, { recursive: true });

const { PAL } = await import(pathToFileURL(join(dir, 'src/core/color.js')).href);

const PINK = ['#3d0a33', '#701560', '#b0228f', '#f53cd1', '#ff86e6', '#ffd2f6', '#ffffff'];
const DEATH = ['#2a2440', '#5a3c8a', '#8a64c8', '#b89cff', '#e6dcff', '#ffffff'];
const BOSS = ['#2a1206', '#6e1a22', '#a8321e', '#d9b44a', '#ffe28a', '#ffffff'];

// out: 파일/텍스처 키, id: pixelfx 이펙트, opts: 색 등 옵션
const VARIANTS = [
  { out: 'fx_hit_slash', id: 'impacts/hit-spark', opts: { palette: PAL.ice.slice(1) } },
  { out: 'fx_hit_orb', id: 'impacts/hit-spark', opts: { palette: PINK } },
  { out: 'fx_blast', id: 'impacts/crit-hit', opts: {} },
  { out: 'fx_poof', id: 'spawn/poof', opts: { palette: DEATH, stars: ['#b89cff', '#e6dcff', '#ffffff'] } },
  { out: 'fx_poof_boss', id: 'spawn/poof', opts: { palette: BOSS, stars: ['#d9b44a', '#ffe28a', '#ffffff'] } },
  { out: 'fx_sparkle', id: 'pickups/collect-burst', opts: { palette: PAL.holy } },
];

const sheets = [];
for (const v of VARIANTS) {
  const args = ['tools/render.mjs', v.id, '--sheet'];
  if (Object.keys(v.opts).length) args.push('--opts', JSON.stringify(v.opts));
  execFileSync('node', args, { cwd: dir, stdio: 'pipe' });

  const name = v.id.split('/')[1];
  const png = join(dir, 'records', v.id, `${name}.png`);
  const json = JSON.parse(readFileSync(join(dir, 'records', v.id, `${name}.json`), 'utf8'));
  copyFileSync(png, join(outDir, `${v.out}.png`));
  const m = json.meta.pixelfx;
  sheets.push({ key: v.out, file: `${v.out}.png`, frames: m.frames, frameW: m.frameSize[0], frameH: m.frameSize[1], fps: m.fps, pivot: m.pivot, source: v.id });
  console.log(`baked ${v.out.padEnd(14)} <- ${v.id}  (${m.frames} frames, ${m.frameSize.join('x')}, ${m.fps}fps)`);
}

const js = `// scripts/bake-fx.mjs 가 만든 파일이다. 직접 고치지 말고 스크립트를 다시 돌릴 것.
// pixelfx (MIT, https://github.com/patch-gg/pixelfx) 이펙트를 시트로 구운 목록.
export const FX_SHEETS = ${JSON.stringify(sheets, null, 2)};
`;
writeFileSync(resolve('src/fx/fxSheets.js'), js);
copyFileSync(join(dir, 'LICENSE'), join(outDir, 'LICENSE-pixelfx.txt'));
copyFileSync(join(dir, 'NOTICE.md'), join(outDir, 'NOTICE-pixelfx.md'));
console.log(`\n${sheets.length}개 시트 → public/assets/fx , 목록 → src/fx/fxSheets.js`);
