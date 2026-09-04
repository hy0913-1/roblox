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
	  - 이동 방향 정면에 벽이 감지되면(코너/모서리) 그 벽의 법선으로 갈아타서
	    벽을 관통하지 않고 타고 올라가도록 합니다.
	  - 표면을 한동안 못 찾으면(허공에 뜨거나 지형에 파묻힌 경우) 위에서 아래로
	    길게 레이를 쏴서 강제로 가까운 바닥/벽에 재배치합니다.
	  - 몸의 파츠는 전부 Anchored로 고정해, 죽은 플레이어의 래그돌 물리 등에
	    떠밀려 바닥에 파묻히는 문제를 원천적으로 막습니다.
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
local FORWARD_PROBE = 3 -- 정면에 벽이 있는지 확인하는 레이 길이 (관통 방지 핵심)
local HOVER_OFFSET = body.Size.Y / 2 -- 표면에서 몸을 띄우는 거리
local JUMPSCARE_TIME = 1.5 -- 점프스케어 연출 후 실제로 죽이기까지 대기 시간
local KILL_COOLDOWN = 3 -- 같은 플레이어를 다시 처리하기까지 대기 시간
local LOST_SURFACE_RECOVERY = 0.4 -- 표면을 이 시간(초)만큼 못 찾으면 강제 재배치

local raycastParams = RaycastParams.new()
raycastParams.FilterType = Enum.RaycastFilterType.Exclude
raycastParams.FilterDescendantsInstances = { monster }

local currentNormal = Vector3.new(0, 1, 0)
local busyWithKill = {}
local lostSurfaceTime = 0

-- 몬스터 파츠는 전부 Anchor + CanCollide 해제:
--  - Anchored=true: 죽은 캐릭터의 래그돌 등 물리 충돌에 밀려 바닥에 파묻히는 문제 방지
--  - CanCollide=false: 플레이어를 물리적으로 밀어내지 않고 Touched로만 감지
--    (CanTouch는 기본값 true라 CanCollide가 꺼져 있어도 Touched는 정상 작동합니다)
local function prepPart(part)
	part.Anchored = true
	part.CanCollide = false
end

local function killPlayer(hitPart)
	local char = hitPart:FindFirstAncestorOfClass("Model")
	local plr = char and Players:GetPlayerFromCharacter(char)
	local hum = char and char:FindFirstChildOfClass("Humanoid")
	if not plr or not hum or hum.Health <= 0 then
		return
	end
	if busyWithKill[plr.UserId] then
		return
	end
	busyWithKill[plr.UserId] = true

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

	task.delay(JUMPSCARE_TIME + KILL_COOLDOWN, function()
		busyWithKill[plr.UserId] = nil
	end)
end

for _, part in ipairs(monster:GetDescendants()) do
	if part:IsA("BasePart") then
		prepPart(part)
		part.Touched:Connect(killPlayer)
	end
end
monster.DescendantAdded:Connect(function(desc)
	if desc:IsA("BasePart") then
		prepPart(desc)
		desc.Touched:Connect(killPlayer)
	end
end)

-- 매 프레임 레이캐스트에서 플레이어 캐릭터는 "지형"으로 취급하지 않도록 제외 목록을 갱신
local function refreshRaycastFilter()
	local list = { monster }
	for _, plr in ipairs(Players:GetPlayers()) do
		if plr.Character then
			list[#list + 1] = plr.Character
		end
	end
	raycastParams.FilterDescendantsInstances = list
end

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

-- 표면(법선)을 찾는다:
--  1) 정면에 벽이 있으면 그 벽으로 갈아탐 (관통 방지 + 코너에서 벽 타기 시작)
--  2) 지금 붙어있는 면이 계속 이어지는지 확인
--  3) 모서리 끝(외곽 코너)이면 다음 면 탐색
-- 아무것도 못 찾으면 nil을 반환한다 (호출부에서 유실 시간을 누적해 복구 처리)
local function findSurface(moveDir)
	if moveDir and moveDir.Magnitude > 0.01 then
		local forwardResult = workspace:Raycast(body.Position, moveDir.Unit * FORWARD_PROBE, raycastParams)
		if forwardResult and forwardResult.Normal:Dot(moveDir) < -0.3 then
			return forwardResult.Normal, forwardResult.Position
		end
	end

	local downOrigin = body.Position + currentNormal * 0.5
	local downResult = workspace:Raycast(downOrigin, -currentNormal * SURFACE_PROBE, raycastParams)
	if downResult then
		return downResult.Normal, downResult.Position
	end

	if moveDir and moveDir.Magnitude > 0.01 then
		local aheadOrigin = body.Position + moveDir.Unit * 1.5 + currentNormal * 0.5
		local aheadResult = workspace:Raycast(aheadOrigin, -currentNormal * SURFACE_PROBE, raycastParams)
		if aheadResult then
			return aheadResult.Normal, aheadResult.Position
		end
	end

	return nil, nil
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

-- 표면을 한참 못 찾았을 때(허공에 뜨거나 지형에 파묻힌 경우) 위에서 아래로 길게
-- 쏴서 강제로 가까운 표면에 재배치한다.
local function recoverSurface()
	local result = workspace:Raycast(body.Position + Vector3.new(0, 50, 0), Vector3.new(0, -300, 0), raycastParams)
	if not result then
		return false
	end
	currentNormal = result.Normal
	local cf = buildCFrame(result.Position + result.Normal * HOVER_OFFSET, result.Normal, body.CFrame.LookVector)
	if monster.PrimaryPart then
		monster:SetPrimaryPartCFrame(cf)
	else
		body.CFrame = cf
	end
	return true
end

local function step(target, dt)
	local toTarget = target.Position - body.Position
	local along = toTarget - currentNormal * toTarget:Dot(currentNormal)
	if along.Magnitude < 0.01 then
		return
	end
	local moveDir = along.Unit

	local newNormal, hitPos = findSurface(moveDir)

	if not newNormal then
		lostSurfaceTime += dt
		if lostSurfaceTime >= LOST_SURFACE_RECOVERY then
			if recoverSurface() then
				lostSurfaceTime = 0
			end
			return
		end
		newNormal = currentNormal
	else
		lostSurfaceTime = 0
	end
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

RunService.Heartbeat:Connect(function(dt)
	refreshRaycastFilter()
	local target = findClosestTarget()
	if target then
		step(target, dt)
	end
end)
