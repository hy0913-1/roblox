# roblox

벽/천장을 기어다니며 플레이어를 추격하는 2D 스프라이트 몬스터 + 점프스케어 킬 스크립트.

Rojo 없이 로블록스 스튜디오에 직접 붙여넣는 방식입니다. 설치 방법은 [SETUP.md](./SETUP.md)를 참고하세요.

- `scripts/MonsterAI.server.lua` — `ServerScriptService`에 넣는 Script (몬스터 생성 + AI + 추격 + 킬 판정)
- `scripts/JumpscareHandler.client.lua` — `StarterPlayer > StarterPlayerScripts`에 넣는 LocalScript (점프스케어 연출)

