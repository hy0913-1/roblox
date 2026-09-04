# 벽 타는 2D 몬스터 추격 + 점프스케어 설치 가이드

Rojo 없이 로블록스 스튜디오에서 스크립트를 직접 붙여넣어 동작합니다.
스크립트 2개만 넣으면 몬스터 모델(파트 + BillboardGui 스프라이트)까지 자동으로 생성됩니다.

## 1. 서버 스크립트 넣기

1. 스튜디오 Explorer에서 **ServerScriptService**를 우클릭 → `Insert Object` → **Script**
2. 이름은 아무거나 상관없음 (예: `MonsterAI`)
3. `scripts/MonsterAI.server.lua` 내용을 통째로 복사해서 붙여넣기

이 스크립트가 실행되면:
- `ReplicatedStorage`에 `JumpscareEvent`(RemoteEvent)를 자동 생성
- `Workspace`에 `Monster2D` 모델(투명 HitBox 파트 + BillboardGui 스프라이트)을 자동 생성
- 매 프레임 레이캐스트로 표면(바닥/벽/천장)을 찾아 몬스터를 그 위에 붙여서 이동시킴
- 플레이어와의 거리를 계산해 감지 범위 안이면 추격, 닿으면 점프스케어 신호 발사 + 사망 처리

## 2. 클라이언트 스크립트 넣기

1. Explorer에서 **StarterPlayer > StarterPlayerScripts**를 우클릭 → `Insert Object` → **LocalScript**
2. 이름은 아무거나 상관없음 (예: `JumpscareHandler`)
3. `scripts/JumpscareHandler.client.lua` 내용을 통째로 복사해서 붙여넣기

서버가 `JumpscareEvent`를 쏘면, 이 로컬스크립트가 화면 전체에 몬스터 얼굴 이미지 + 효과음을 잠깐 띄웠다가 사라집니다. 실제 사망(체력 0) 처리는 서버가 담당하므로 클라이언트는 연출만 맡습니다.

## 3. 이미지/사운드 에셋 준비

두 스크립트 상단의 `TODO` 표시된 값을 본인 에셋 ID로 교체하세요.

- `MonsterAI.server.lua` → `MONSTER_IMAGE_ID` : 몬스터를 표현할 2D 이미지 (배경이 투명한 PNG 권장)
- `JumpscareHandler.client.lua` → `JUMPSCARE_IMAGE_ID` : 점프스케어용 클로즈업 이미지
- `JumpscareHandler.client.lua` → `JUMPSCARE_SOUND_ID` : 놀람 효과음/괴성

에셋 업로드 방법: 스튜디오 상단 `Home` 탭 → `Import` (이미지/오디오 업로드) 후 생성된 자산의 `rbxassetid://숫자` 값을 그대로 넣으면 됩니다. (음원은 심사 후 사용 가능해지는 경우가 있습니다.)

## 4. 몬스터 스폰 위치 지정 (선택)

`Workspace`에 아무 Part나 만들고 이름을 정확히 `MonsterSpawn`으로 지정하면, 몬스터가 그 파트 위치에서 시작합니다. 안 만들면 스크립트 안의 `SPAWN_POSITION` 좌표(기본 `0, 5, 0`)에서 시작합니다.

## 5. 테스트

1. 상단 `Test` 탭 → `Play` (또는 `Play Here`)로 실행
2. 몬스터가 바닥/벽/천장을 타고 다니다가 캐릭터가 감지 범위(`DETECT_RANGE`, 기본 60스터드)에 들어오면 추격 시작
3. 닿으면 화면에 점프스케어가 뜨고 캐릭터가 사망(리스폰)

## 6. 튜닝 포인트 (MonsterAI.server.lua 상단 변수)

| 변수 | 설명 |
|---|---|
| `MOVE_SPEED` | 추격 속도 |
| `WANDER_SPEED_MULT` | 대기 중 배회 속도 배율 |
| `DETECT_RANGE` | 플레이어 감지 거리 |
| `KILL_RANGE` | 이 거리 이내면 즉시 공격 판정 |
| `SPRITE_SIZE_STUDS` | 몬스터 스프라이트 크기 |
| `SURFACE_OFFSET` | 표면에서 얼마나 띄울지 |

## 참고 사항

- 몬스터는 실제 파트를 프레임마다 레이캐스트로 표면에 붙이는 방식이라, 일반 NPC처럼 물리엔진에 종속되지 않고 벽/천장 전환이 자연스럽습니다. 급격한 절벽/좁은 틈에서는 표면을 못 찾고 잠시 멈출 수 있으니, 맵 구조가 복잡하면 `STICK_RAY_LENGTH`나 모서리 탐색 로직을 조정하세요.
- 여러 명이 플레이 중이면 몬스터는 항상 가장 가까운 플레이어 한 명만 쫓습니다. 몬스터를 여러 마리 두고 싶으면 `MonsterAI.server.lua`를 하나의 함수로 감싸서 원하는 수만큼 `spawnMonster()`를 호출하도록 확장하면 됩니다.
- 사망 처리는 `Humanoid.Health = 0`으로만 하므로, 리스폰/리스폰 시간 등은 로블록스 기본 설정(`Players` 서비스의 `RespawnTime` 등)을 따릅니다.
