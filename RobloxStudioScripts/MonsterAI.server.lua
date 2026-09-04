--[[
	MonsterAI (Script)

	이 스크립트를 몬스터 Model 안에 자식으로 넣어주세요.
	(Workspace > Monster(Model) > MonsterAI(Script))

	필요 조건:
	  1) 몬스터 Model에 PrimaryPart가 지정되어 있어야 합니다.
	     (2D 스프라이트를 붙인 BasePart, 예: SurfaceGui/Decal이 달린 Part)
	  2) ReplicatedStorage 안에 "JumpscareEvent"라는 이름의 RemoteEvent가 있어야 합니다.

	동작 방식:
	  - 매 프레임 가장 가까운 플레이어를 찾아 추격합니다.
	  - 항상 "현재 붙어있는 면의 법선(normal)"을 기준으로 이동 방향을 그 면 위로
	    투영시켜서, 바닥/벽/천장을 자연스럽게 타고 이동하도록 만듭니다.
	  - 이동 중 앞쪽/아래쪽으로 레이캐스트를 쏴서 다음 면(코너)을 찾고, 면이 바뀌면
	    법선과 몬스터의 방향(CFrame)을 그 면에 맞춰 다시 계산합니다.
	  - 플레이어 캐릭터에 몸이 닿으면(Touched) 점프스케어 이벤트를 클라이언트에
	    보내고, 잠시 뒤 서버에서 확실하게 죽입니다(치트/디레이 방지를 위해 킬은
	    항상 서버 권한으로 처리).
]]

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local monster = script.Parent
local body = monster.PrimaryPart or monster:FindFirstChildWhichIsA("BasePart")
assert(body, "MonsterAI: Monster 모델에 PrimaryPart(또는 BasePart)가 필요합니다.")

local jumpscareEvent = ReplicatedStorage:WaitForChild("JumpscareEvent")

-- ===== 튜닝 값 (원하는 대로 조절하세요) =====
local WALK_SPEED = 12 -- 이동 속도 (studs/sec)
local DETECT_RANGE = 60 -- 이 거리 안에 있는 플레이어를 추격 시작
local SURFACE_PROBE = 6 -- 표면을 찾기 위해 쏘는 레이 길이
local HOVER_OFFSET = body.Size.Y / 2 -- 표면에서 몸을 띄우는 거리
local JUMPSCARE_TIME = 1.1 -- 점프스케어 연출 후 실제로 죽이기까지 대기 시간
local KILL_COOLDOWN = 3 -- 같은 플레이어를 다시 처리하기까지 대기 시간

local raycastParams = RaycastParams.new()
raycastParams.FilterType = Enum.RaycastFilterType.Exclude
raycastParams.FilterDescendantsInstances = { monster }

local currentNormal = Vector3.new(0, 1, 0)
local busyWith = {}

-- 시작할 때 지금 서 있는 면을 한 번 스냅
do
	local result = workspace:Raycast(body.Position, Vector3.new(0, -1, 0) * SURFACE_PROBE, raycastParams)
	if result then
		currentNormal = result.Normal
	end
end

local function findClosestTarget()
	local closest, closestDist
	for _, plr in ipairs(Players:GetPlayers()) do
		local char = plr.Character
		local hum = char and char:FindFirstChildOfClass("Humanoid")
		local root = char and char:FindFirstChild("HumanoidRootPart")
		if hum and root and hum.Health > 0 then
			local dist = (root.Position - body.Position).Magnitude
			if dist <= DETECT_RANGE and (not closestDist or dist < closestDist) then
				closest, closestDist = root, dist
			end
		end
	end
	return closest
end

-- 현재 붙어있는 면(법선)을 갱신. 못 찾으면 이동 방향 쪽 모서리를 확인해 다음 면(코너)으로 전환.
local function findSurface(forwardDir)
	local downOrigin = body.Position + currentNormal * 0.5
	local downResult = workspace:Raycast(downOrigin, -currentNormal * SURFACE_PROBE, raycastParams)
	if downResult then
		return downResult.Normal, downResult.Position
	end

	if forwardDir and forwardDir.Magnitude > 0.01 then
		local aheadOrigin = body.Position + forwardDir.Unit * 1.5 + currentNormal * 0.5
		local aheadResult = workspace:Raycast(aheadOrigin, -currentNormal * SURFACE_PROBE, raycastParams)
		if aheadResult then
			return aheadResult.Normal, aheadResult.Position
		end
	end

	return currentNormal, nil
end

-- up(법선)과 look(이동 방향)을 기준으로 직교 좌표계를 만들어 CFrame 생성
local function buildCFrame(position, upVector, lookVector)
	local right = lookVector:Cross(upVector)
	if right.Magnitude < 0.001 then
		right = upVector:Cross(Vector3.new(1, 0, 0))
		if right.Magnitude < 0.001 then
			right = upVector:Cross(Vector3.new(0, 0, 1))
		end
	end
	right = right.Unit
	local fixedUp = right:Cross(lookVector).Unit
	return CFrame.fromMatrix(position, right, fixedUp, -lookVector)
end

local function step(target, dt)
	local toTarget = target.Position - body.Position
	local along = toTarget - currentNormal * toTarget:Dot(currentNormal)
	if along.Magnitude < 0.01 then
		return
	end
	local moveDir = along.Unit

	local newNormal, hitPos = findSurface(moveDir)
	currentNormal = newNormal

	local newPosition = body.Position + moveDir * WALK_SPEED * dt
	if hitPos then
		newPosition = hitPos + currentNormal * HOVER_OFFSET
	end

	local look = moveDir - currentNormal * moveDir:Dot(currentNormal)
	if look.Magnitude < 0.01 then
		look = body.CFrame.LookVector
	end

	local cf = buildCFrame(newPosition, currentNormal, look.Unit)
	if monster.PrimaryPart then
		monster:SetPrimaryPartCFrame(cf)
	else
		body.CFrame = cf
	end
end

local function killPlayer(hitPart)
	local char = hitPart:FindFirstAncestorOfClass("Model")
	local plr = char and Players:GetPlayerFromCharacter(char)
	local hum = char and char:FindFirstChildOfClass("Humanoid")
	if not plr or not hum or hum.Health <= 0 then
		return
	end
	if busyWith[plr.UserId] then
		return
	end
	busyWith[plr.UserId] = true

	-- 점프스케어가 재생되는 동안 플레이어를 잠깐 묶어둠
	hum.WalkSpeed = 0
	hum.JumpPower = 0
	hum.AutoRotate = false

	jumpscareEvent:FireClient(plr)

	task.delay(JUMPSCARE_TIME, function()
		if hum and hum.Health > 0 then
			hum.Health = 0
		end
	end)

	task.delay(KILL_COOLDOWN, function()
		busyWith[plr.UserId] = nil
	end)
end

for _, part in ipairs(monster:GetDescendants()) do
	if part:IsA("BasePart") then
		part.Touched:Connect(killPlayer)
	end
end
monster.DescendantAdded:Connect(function(desc)
	if desc:IsA("BasePart") then
		desc.Touched:Connect(killPlayer)
	end
end)

RunService.Heartbeat:Connect(function(dt)
	local target = findClosestTarget()
	if target then
		step(target, dt)
	end
end)
