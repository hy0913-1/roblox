# 빛나리 용사전

횡스크롤 도트 액션 RPG. 민머리 용사 "빛나리"가 털보 대왕의 털을 전부 밀어 버리러 떠난다. PC와 폰(세로·가로) 모두 된다.

- **스킬**: 탈모빔(A) · 몸무게 3톤 어택(S) · 진동 폭발(D) · 공군 폭격(F), 평타(X)
- **맵 5곳**: 빛나리 마을 → 솜털 초원 → 덥수룩 동굴 → 가발 폐허 → 털보의 옥좌(보스)
- 레벨·스킬 포인트·상점(물약, 장갑 강화)·퀘스트 6개·드롭·자동 저장

## 만드는 방식

그림 파일이 하나도 없다. 전부 코드로 그린다.

- 스킬 이펙트, 몹(슬라임·박쥐·유령 등), 횃불·포탈: [pixelfx](https://github.com/patch-gg/pixelfx) 이펙트를 그대로 쓰거나 색만 바꿔 쓴다. 몹처럼 반복되는 것은 시작할 때 한 번 구워 둔다(`src/sprites.js`).
- 주인공과 마을 사람: pixelfx의 뼈대 캐릭터(rig)에 포즈만 주고 옷 색을 입힌다(`src/hero.js`). `vendor/pixelfx/core/rig.js`는 부위 번호를 함께 내보내도록 두 줄 고쳤다.
- 배경·지형·집·나무: `src/maps.js`가 타일 배치에서 직접 그린다.
- 화면은 384×216 한 장(`src/game.js`)이고, 체력바·대화창·버튼은 그 위에 얹은 HTML이다(`src/main.js`).
- 소리는 WebAudio 합성(`src/audio.js`).

## 명령

```sh
npm run rpg:build   # bald-rpg/dist/artifact.html(클로드 아티팩트용), dist/index.html(그냥 여는 웹페이지)
npm run rpg:test    # 브라우저로 처음부터 엔딩까지 흐름 확인
node bald-rpg/test/smoke.cjs bald-rpg/shots   # 스킬 화면 찍기
```

## 라이선스 표기

- pixelfx: MIT (c) 2026 Patch, Hugo Duprez — `vendor/pixelfx/LICENSE`, `NOTICE.md`
- 갈무리11 글꼴: SIL OFL 1.1 (c) Lee Minseo — `assets/OFL.txt`
