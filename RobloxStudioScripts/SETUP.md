# 벽 타는 2D 몬스터 추격 + 점프스케어 설치 가이드

Rojo 없이 Roblox Studio 안에서 인스턴스를 직접 만들고, 아래 두 스크립트를
해당 위치에 그대로 붙여넣기만 하면 동작합니다.

## 1. RemoteEvent 생성

- `ReplicatedStorage` 안에 `RemoteEvent`를 하나 추가하고 이름을
  `JumpscareEvent` 로 설정합니다.

## 2. 몬스터 모델 준비

- `Workspace` 안에 몬스터용 `Model`을 만들고 이름을 예: `Monster` 로 지정합니다.
- 이미 갖고 계신 2D 에셋(이미지)을 붙인 `Part` (또는 `SurfaceGui` /
  `Decal` / `BillboardGui`로 스프라이트를 표시하는 파츠)를 이 Model 안에
  넣습니다. 여러 파츠로 구성됐다면 전부 이 Model 안에 넣어주세요.
- Model을 선택한 상태에서 **PrimaryPart**를 몬스터의 몸(히트박스 역할을
  할 파츠)으로 지정합니다.
- Model 안에 `Script`를 추가하고 이름을 `MonsterAI` 로 바꾼 뒤
  `MonsterAI.server.lua`의 내용을 그대로 붙여넣습니다.
- 몬스터를 여러 마리 배치하고 싶다면 이 Model을 통째로 복제(Duplicate)
  하면 됩니다. 스크립트가 각 인스턴스마다 독립적으로 실행됩니다.

## 3. 점프스케어 클라이언트 스크립트

- `StarterPlayer` > `StarterPlayerScripts` 안에 `LocalScript`를 추가하고
  이름을 `JumpscareClient` 로 바꾼 뒤 `JumpscareClient.client.lua`의
  내용을 그대로 붙여넣습니다.
- 스크립트 상단의 `IMAGE_ID`, `SOUND_ID`를 원하는 점프스케어 이미지와
  효과음의 `rbxassetid://...` 값으로 교체합니다. (Studio의 Toolbox나
  Asset Manager로 먼저 업로드해야 ID를 얻을 수 있습니다)

## 4. 테스트

- Play 버튼으로 테스트하면, 몬스터가 가장 가까운 플레이어를 향해 바닥/벽/
  천장을 타고 이동합니다. 몬스터 몸에 캐릭터가 닿으면 화면에 점프스케어가
  뜨고, 잠깐(약 1.1초) 뒤 캐릭터가 사망합니다.

## 튜닝 값 (MonsterAI.server.lua 상단)

| 변수 | 설명 |
| --- | --- |
| `WALK_SPEED` | 몬스터 이동 속도 |
| `DETECT_RANGE` | 추격을 시작하는 감지 거리 |
| `SURFACE_PROBE` | 표면을 찾기 위한 레이 길이 (너무 짧으면 코너에서 못 붙음) |
| `HOVER_OFFSET` | 표면에서 몸을 띄우는 거리 (파츠 두께에 맞게 자동 계산됨) |
| `JUMPSCARE_TIME` | 점프스케어 연출 후 실제로 죽기까지 대기 시간 |
| `KILL_COOLDOWN` | 같은 플레이어를 다시 처리하기까지 대기 시간 |

## 참고 / 한계

- 이동 로직은 매 프레임 레이캐스트로 "지금 붙어있는 면"과 "이동 방향 쪽
  다음 면"을 찾아 법선(normal)에 맞춰 CFrame을 재계산하는 방식입니다.
  일반적인 직육면체 방/복도 구조에서는 잘 동작하지만, 아주 날카로운
  모서리나 곡면이 많은 지형에서는 `SURFACE_PROBE`, `HOVER_OFFSET` 값을
  맵에 맞게 조정해야 할 수 있습니다.
- 킬 판정과 실제 사망 처리(`Humanoid.Health = 0`)는 서버에서만 수행되어
  클라이언트 조작으로는 무적이 될 수 없습니다. 점프스케어 연출만 클라이언트
  에서 재생됩니다.
- 몬스터가 여러 파츠로 이루어진 경우를 대비해 Model의 모든 `BasePart`에
  `Touched`를 연결해 두었습니다.
