# OX 도트 대난투

친구들끼리 겨루는 도트 그래픽 O/X 퀴즈 대전. 문제가 나오면 O 또는 X 구역으로 뛰어가고, 맞혀서 모은 에너지로 스킬을 써서 서로 방해한다. PC·모바일.

같은 게임을 두 가지로 낸다.

- **웹판** (`npm run quiz:web` → `dist-web/`): 아무 정적 호스팅에 올리는 일반 웹사이트. 로그인 없이 닉네임으로 참가하고, 방 코드나 초대 링크(`…/#ABCD`)로 들어온다. 대전은 브라우저끼리 직접 연결(P2P)이라 서버를 따로 돌리지 않는다.
- **클로드 아티팩트판** (`npm run quiz:build` → `dist/artifact.html`): 클로드 계정으로 들어오고, 기록은 아티팩트 db에 남는다.

## 웹판 연결 방식

- 방장 브라우저가 허브가 되고 참가자는 방장에게 직접 붙는다(PeerJS · WebRTC). 연결을 이어 주는 신호 서버는 PeerJS 공개 서버(`0.peerjs.com`)를 쓰고, 직접 연결이 막힌 망에서는 PeerJS 기본 TURN 서버가 중계한다.
- 아티팩트판과 같은 presence 모양을 `src/web/p2p.js`가 흉내 내서 진행 코드(`game.js`, `net.js`)는 두 판이 같다.
- 신원: 기기마다 서명 키(ECDSA P-256)를 만들어 브라우저에 보관하고, 아이디는 공개키 해시다. 방에 들어갈 때 방장이 준 일회용 숫자에 서명하므로 남의 아이디를 흉내 낼 수 없다. 같은 기기·같은 브라우저로 들어와야 같은 사람으로 기록된다.
- 공식전 비밀 문제는 주최자 비밀번호로 잠근 묶음(`web/bank.enc.json`, AES-GCM · PBKDF2 60만 번)만 사이트에 들어간다. 주최자가 로비의 "주최자" 칸에 비밀번호를 넣으면 그 기기에서만 풀린다. 비밀번호와 풀린 문제는 저장소에 없다.
- 공식전 결과와 시즌 순위표는 주최자 기기(localStorage)에 쌓이고, 주최자가 연 공식전 방에 들어온 참가자에게 순위표가 전달된다(참가자 기기에도 마지막 순위표가 남음). "순위표 복사"로 카톡에 붙여 넣을 수 있다.
- 방장(공식전은 주최자)의 화면이 꺼지거나 나가면 방이 닫힌다. 참가자가 새로고침하면 같은 사람으로 다시 들어온다.

### 배포

`.github/workflows/web-pages.yml`이 main에 합쳐질 때마다 `dist-web/`을 GitHub Pages에 올린다. 처음 한 번 저장소 Settings → Pages → Source를 "GitHub Actions"로 바꿔야 한다(비공개 저장소의 Pages는 GitHub 유료/학생 요금제에서만 됨). 다른 곳(Netlify 등)에 올릴 때는 `dist-web/` 폴더를 그대로 올리면 된다.

비밀 문제를 다시 잠글 때: `OX_BANK_PASS='새 비밀번호' node ox-quiz/tools/seal-bank.mjs bank-main.json bank-custom.json > ox-quiz/web/bank.enc.json`

## 놀이 방식

- **혼자 연습**: 봇 4명과 10문제. 순위표에는 들어가지 않는다.
- **일반 방**: 누구나 방을 만들고 친구가 참가. 봇 추가 가능. 공개 문제 60개(상식·게임) 사용. 순위표에는 들어가지 않는다.
- **공식전(MC)**: 아티팩트판은 주인만, 웹판은 주최자 비밀번호를 넣은 기기에서만 열 수 있다. 주최자는 진행자로만 참여하고(플레이하지 않음), 비밀 문제은행에서 상식 60% · 게임·서브컬처 30% · 주최자 관련 10% 비율로 출제한다. 결과는 주최자 쪽에서만 기록하고, 시즌 순위표에 쌓인다.

규칙: 틀리면 하트 -1, 하트 0이면 탈락. 전원이 틀린 문제는 무효. 맞히면 에너지 +1(최대 5).
점수: 정답 10점(3연속부터 +5) + 끝까지 생존 20점 + 1·2·3등 50·30·20점.

| 스킬 | 에너지 | 효과 |
| --- | --- | --- |
| 먹물 | 1 | 4초 동안 상대 문제판을 가림 |
| 뒤죽박죽 | 1 | 4초 동안 상대 문제 글자를 섞음 |
| 뒤집기 | 1 | 이번 문제 동안 상대의 O·X 버튼 자리를 바꿈 |
| 얼음 | 2 | 3초 동안 상대가 못 움직임 |
| 밀치기 | 2 | 상대를 반대편으로 밀어냄 |
| 방패 | 1 | 이번 문제 동안 나에게 오는 방해 한 번을 막음 |

## 구조

- `src/game.js` 진행 로직(진행자 화면에서만 돈다). 정답은 공개 단계 전까지 공유 상태에 들어가지 않는다.
- `src/net.js` room presence로만 통신: 로비 / 진행자(심판) / 참가자.
- `src/store.js` db: `meta/season`, `results/*`(공식전 결과), `bank/main`·`bank/custom`(공식전 문제, 주인만 읽기).
- `src/stage.js`, `src/pixel.js` 코드로 그린 도트 무대·캐릭터 8종·아이콘. `src/sfx.js` WebAudio 칩튠 효과음.
- `src/qpublic.js` 일반 방용 공개 문제 60개.
- `src/web/` 웹판 전용: `p2p.js`(PeerJS 허브/참가자), `identity.js`(서명 신원), `localdb.js`(기기 저장소), `vault.js`(비밀 문제 열기), `platform.js`, `app-web.js`(닉네임·코드 참가·주최자 화면). 시작점은 `web/index.html`, `web/main.js`.

공식전 비밀 문제는 풀린 상태로는 저장소에 없다. 아티팩트판은 db(`bank/main`, 읽기 규칙이 주인 전용)에, 웹판은 비밀번호로 잠근 묶음(`web/bank.enc.json`)으로만 들어 있다.

게시할 때 선언하는 기능:

```json
{
  "db": { "rules": [
    { "path": "", "read": "view", "write": "owner" },
    { "path": "bank", "read": "owner", "write": "owner" }
  ] },
  "user": { "scopes": ["profile"] },
  "room": {}
}
```

## 명령

```sh
npm run quiz:test    # 진행 로직 테스트(노드)
npm run quiz:web     # 웹판 → ox-quiz/dist-web/
npm run quiz:build   # 아티팩트판 → dist/artifact.html(게시용), dist/harness.html(가짜 런타임 테스트용)

# 웹판 브라우저 테스트: 사람마다 따로 브라우저 프로필, 내 컴퓨터에 띄운 PeerJS 신호 서버로 연결
# (주최자 비밀번호가 있으면 공식전까지)
OX_BANK_PASS='…' npm run quiz:e2e:web

# 아티팩트판 브라우저 테스트: 여러 탭이 서로 다른 친구처럼 움직인다
(cd ox-quiz/dist && python3 -m http.server 4181) & npm run quiz:e2e
```

## 글꼴

[갈무리11](https://github.com/quiple/galmuri) (Copyright (c) 2019–2025 Lee Minseo, SIL Open Font License 1.1). 한글·영문만 남긴 부분 글꼴을 `assets/fonts`에 두고, 빌드할 때 라이선스 전문과 함께 페이지에 넣는다.
