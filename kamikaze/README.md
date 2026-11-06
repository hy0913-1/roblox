# 경덕 특공대

몰려오는 몬스터 한가운데로 전투기를 몰고 꼬라박는 1버튼 아레나 게임. 모든 폭발·팝·반짝임은 [pixelfx](https://github.com/patch-gg/pixelfx) 효과이고, 스프라이트는 코드의 문자열로 그린다. 이미지·오디오 파일 없음.

## 실행
```
cd kamikaze
python3 -m http.server 8770      # ES 모듈이라 서버가 필요하다. http://localhost:8770
node build.mjs                   # dist/kamikaze.html 한 파일로 묶기 (npx esbuild 사용)
```

## 조작
- 이동 WASD / 방향키, 조준 마우스, 전투기 출격 스페이스·클릭. 비행 중에 한 번 더 누르면 그 자리에서 폭발.
- 폰: 화면 왼쪽을 끌어서 이동, "꼬라박!" 버튼은 가장 빽빽한 적 무리를 자동 조준.

## 규칙
- 폭발 한 번에 경덕 한 명이 사라진다(대기 ★ -1). 적에게 닿아도 죽는다. 대기가 0이면 끝.
- 한 방에 잡은 수만큼 점수 배율(5킬 이상은 플라즈마, 12킬 이상은 큰 폭발). 8킬 이상 경덕 +1, 15킬 이상 +2.
- 웨이브를 깨면 경덕 +1, 폭발 반경 +2. 5웨이브마다 왕 슬라임. 화약통은 연쇄 폭발한다.

## 쓰는 pixelfx 효과 (`vendor/pixelfx`, MIT)
explosions/small-explosion, plasma-explosion(주황으로 재색칠), big-explosion, cartoon-pow; rpg/fighter-jet(경덕의 전투기); arcane/blink-in(부활); rpg/slime-pop, level-up.
