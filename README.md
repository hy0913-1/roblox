# LIMBUS DEFENSE — 버스를 지켜라

림버스 컴퍼니 **비영리 팬게임**(타워 디펜스)입니다. 수감자를 배치해서 길을 따라 몰려오는 왜곡체로부터 버스를 지키세요. 10웨이브를 막으면 승리!

> 이 게임은 Project Moon과 무관한 비영리 팬 제작물이며, 원작의 모든 권리는 원 저작권자에게 있습니다.
> 게임 안의 그림은 전부 코드로 그린 도트이고, 공식 에셋은 사용하지 않았습니다.

PC(마우스·키보드)와 모바일(터치, 가로 화면) 모두 지원합니다. Phaser 4 + Vite로 만든 정적 웹게임이라 서버가 필요 없습니다.

## 실행

```bash
npm install
npm run dev        # 개발 서버 (폰으로 보려면 같은 와이파이에서 표시되는 Network 주소로 접속)
npm run build      # dist/ 에 정적 빌드. 이 폴더를 itch.io, GitHub Pages 등에 그대로 올리면 됩니다
npm run preview    # 빌드 결과 미리보기
```

저사양 기기에서 버벅이면 주소 뒤에 `?q=1`을 붙이세요. (렌더 해상도를 절반으로 낮춥니다)

## 조작

| | PC | 모바일 |
|---|---|---|
| 수감자 선택 | 오른쪽 카드 클릭 / 키 `1` `2` `3` | 카드 탭 |
| 배치 | 빈 칸 클릭 (우클릭·`Esc`로 취소) | 빈 칸 탭 → 미리보기, **같은 칸 한 번 더 탭 → 배치** |
| 타워 관리 | 배치한 타워 클릭 → 업그레이드(`U`) · 판매(`S`) · 목표 변경(`Tab`) | 타워 탭 |
| 웨이브 시작 | 버튼 / `Space` | 버튼 |
| 배속·일시정지·소리 | 상단 버튼 / `F` `P` `M` | 상단 버튼 |

## 게임 규칙

- 적이 버스에 닿으면 **내구도**가 깎이고, 0이 되면 패배합니다. (보스는 10)
- 적을 처치하면 **아안**을 얻고, 웨이브를 클리어하면 보너스를 받습니다.
- 수감자는 3레벨까지 업그레이드할 수 있고, 판매하면 투자한 아안의 70%를 돌려받습니다.
- 수감자: **이상**(균형형 단일 타격) · **돈키호테**(광역 폭발) · **파우스트**(감속 보조)
- 왜곡체: 그림자(기본) · 질주체(빠름) · 갑각체(방어력 3) · 거대 왜곡체(보스)

## 여우굴 사계절 (`fox-den/`)

어미 여우가 새끼 셋을 데리고 봄부터 겨울까지 버티는 동물 가족 생존 게임입니다. 이름·캐릭터·맵·그림 모두 이 저장소에서 새로 만든 오리지널이고, 그림은 코드로 그린 도트입니다.

- `fox-den/index.html` 한 파일이 전부입니다. 빌드 없이 브라우저로 열면 됩니다. (PC 키보드, 모바일 터치 지원)
- 들쥐·토끼를 덮쳐 잡아 굴로 물어다 주고, 낮에는 매, 밤에는 삵을 짖어서 쫓습니다. 8일(계절마다 2일, 하루 96초)을 넘기면 끝.
- 숫자(하루 길이, 먹이 수, 배고픔 속도)는 파일 위쪽의 `DAY`, `SEASONS`, `FOOD`에서 고칩니다.

## 클로드 아티팩트로 올리기

게임을 단일 HTML 한 장으로 묶어서 claude.ai 아티팩트로 올릴 수 있습니다.

```bash
npm run build:artifact    # dist-artifact/artifact.html 생성 (약 670KB)
```

Phaser는 아티팩트 규칙에 맞춰 jsDelivr CDN(버전 고정)에서 불러오고, 게임 코드·CSS·이펙트 시트(data: URI)는 페이지 안에 들어갑니다. 아티팩트에서는 외부 파일 요청이 막혀 있어서 이 모드(`__EMBED__`)가 따로 있고, 샌드박스에서 막힐 수 있는 전체화면 버튼은 빠집니다.

## 프로젝트 구조

```
src/
  sim/Sim.js        게임 규칙 전부(Phaser 없는 순수 코드). 렌더러는 이 상태를 읽어서 그리기만 합니다
  sim/bot.js        자동 플레이 봇 (밸런스 점검/테스트용)
  data/             타워·적·웨이브·맵 데이터. 숫자는 여기서만 고치면 됩니다
  art/textures.js   코드로 그린 기본 도트 이미지
  art/overrides.js  GPT 등으로 만든 이미지로 교체하는 곳 (아래 참고)
  fx/               전투 이펙트 (Fx: 도형, PixelFx: pixelfx로 구운 시트)
  scenes/, ui/      Phaser 씬과 HUD
  audio/Sfx.js      WebAudio로 합성한 효과음·배경음 (음원 파일 없음)
scripts/
  balance.mjs       밸런스 점검 봇   npm run balance
  sim-test.mjs      규칙 단위 테스트  npm test
  e2e.cjs           브라우저 테스트(PC/모바일/세로 화면)
  e2e-full.cjs      브라우저에서 10웨이브 전체 자동 플레이
  bake-fx.mjs       pixelfx 이펙트를 시트로 굽는 스크립트
```

## 밸런스 조정

`src/data/towers.js`, `enemies.js`, `waves.js`의 숫자를 고친 뒤 봇으로 확인합니다.

```bash
npm run balance    # 전략별(혼합/한 종류만/방치) 클리어 여부와 남은 내구도 출력
npm test           # 규칙 단위 테스트
```

의도한 난이도: 혼합 전략은 간신히 클리어(내구도 약 10), 한 종류만 도배하거나 방치하면 패배.

## 이미지를 GPT 등으로 바꾸기

지금 그림은 전부 코드로 그린 16x16 도트입니다. 마음에 드는 이미지를 만들었다면 파일을 `public/assets/`에 넣고 `src/art/overrides.js`에 한 줄씩 추가하세요. 코드는 건드릴 필요 없고, 크기는 자동으로 칸에 맞춰집니다.

```js
export const IMAGE_OVERRIDES = {
  tower_yisang: 'assets/tower_yisang.png',
  enemy_shade: 'assets/enemy_shade.png',
};
```

| 키 | 용도 | 권장 |
|---|---|---|
| `tower_yisang` `tower_donquixote` `tower_faust` | 타워 | 투명 배경 PNG, 정사각형 256~512px |
| `enemy_shade` `enemy_runner` `enemy_carapace` `enemy_boss` | 적 | 투명 배경 PNG, 정사각형, **오른쪽을 보는 모습** |
| `tile_ground` `tile_path` `tile_rock` | 맵 타일 | 정사각형, 이어 붙여도 어색하지 않게. `tile_rock`은 바닥 위에 올라가는 투명 PNG |
| `bus` `portal` | 목표(버스)와 적 입구 | 투명 배경 PNG |

GPT에게 이렇게 요청하면 잘 나옵니다: "투명 배경, 정사각형, 캐릭터 한 명만, 전신이 가운데, 오른쪽을 바라봄, 가장자리에 여백". 일부만 바꿔도 됩니다. 나머지는 기본 도트가 그대로 쓰입니다.

## 이펙트(pixelfx)

전투 이펙트(피격, 폭발, 사망 연기, 반짝임)는 [pixelfx](https://github.com/patch-gg/pixelfx)의 이펙트를 스프라이트 시트로 **미리 구운** 파일입니다(`public/assets/fx`, 약 0.5MB). 게임이 돌 때는 pixelfx가 필요 없습니다. 이펙트나 색을 바꾸려면:

```bash
git clone https://github.com/patch-gg/pixelfx ../pixelfx
node scripts/bake-fx.mjs ../pixelfx    # scripts/bake-fx.mjs 의 VARIANTS 를 고친 뒤 실행
```

시트가 없으면 자동으로 단순한 도형 이펙트로 대신합니다.

## 라이선스와 출처

- 이 게임의 코드와 코드로 그린 도트는 자유롭게 수정·재사용해도 됩니다.
- [Phaser](https://phaser.io) — MIT
- [pixelfx](https://github.com/patch-gg/pixelfx) — MIT (Patch, Hugo Duprez). 전문은 `public/assets/fx/LICENSE-pixelfx.txt`, `NOTICE-pixelfx.md`
- 한글 폰트 Noto Sans KR — SIL OFL, Google Fonts에서 불러옵니다. (못 불러오면 시스템 폰트 사용)
- 림버스 컴퍼니, 수감자 이름 등 원작의 설정은 Project Moon의 것입니다.
