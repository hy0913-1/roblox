# KnockbackBlock

블록에 닿으면 오디오가 재생되고 플레이어를 멀리 날려보내는 스크립트입니다.

## 설치 방법

1. Roblox Studio에서 `Part`를 하나 만듭니다.
2. 해당 `Part` 안에 `Script`를 삽입하고, `KnockbackBlock.lua` 내용을 붙여넣습니다.
3. 같은 `Part` 안에 `Sound` 오브젝트를 삽입합니다.
   - Name: `HitSound`
   - SoundId: 원하는 오디오 에셋 ID (예: `rbxassetid://9120386436`)

## 계층 구조

```
Part
├── Script        ← KnockbackBlock.lua 내용 붙여넣기
└── Sound         ← Name = "HitSound"
```

## 설정값 (스크립트 상단에서 수정 가능)

| 변수 | 기본값 | 설명 |
|---|---|---|
| `KNOCKBACK_FORCE` | `120` | 수평 날아가는 힘 (높을수록 멀리 날아감) |
| `KNOCKBACK_UP` | `60` | 위로 튀어오르는 힘 |
| `COOLDOWN_SECONDS` | `1.5` | 같은 플레이어가 연속으로 맞지 않도록 하는 쿨다운 (초) |

## 동작 원리

1. 플레이어가 블록에 닿으면 `.Touched` 이벤트 발생
2. 쿨다운 체크 후 `Sound:Play()` 로 오디오 재생
3. `BodyVelocity`를 `HumanoidRootPart`에 추가해 블록 반대 방향으로 밀어냄
4. 0.18초 후 `BodyVelocity` 자동 제거로 일반 물리로 복귀
