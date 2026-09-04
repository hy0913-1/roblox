-- ============================================================
-- 붙여넣을 위치 : ServerScriptService > (일반 Script, 이름은 자유) 예: "MonsterAI"
-- 역할 : 2D 스프라이트 몬스터를 생성하고, 벽/천장을 타고 다니며
--        가장 가까운 플레이어를 추격하다가 닿으면 점프스케어 + 즉사 처리
-- ============================================================

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

-- ================= 설정값 (원하는 대로 수정하세요) =================
local MONSTER_IMAGE_ID   = "rbxassetid://0"      -- TODO: 몬스터 2D 이미지(배경 투명 PNG 업로드 후) 에셋 ID로 교체
local SPRITE_SIZE_STUDS  = 6                      -- 몬스터 스프라이트 크기 (스터드 단위)

-- Workspace에 "MonsterSpawn"이라는 이름의 Part를 만들어두면 그 위치에서 스폰됩니다.
-- 없으면 아래 기본 좌표에서 스폰됩니다.
local SPAWN_POSITION     = Vector3.new(0, 5, 0)

local MOVE_SPEED         = 14    -- 추격 속도 (studs/sec)
local WANDER_SPEED_MULT  = 0.35  -- 플레이어가 없을 때 배회 속도 배율
local DETECT_RANGE       = 60    -- 플레이어 감지 거리
local KILL_RANGE         = 3.5   -- 이 거리 이내면 공격 판정
local SURFACE_OFFSET     = 1.0   -- 표면에서 살짝 띄우는 거리
local STICK_RAY_LENGTH   = 6      -- 표면을 다시 찾기 위해 쏘는 레이 길이
local TURN_SPEED         = 8      -- 방향 전환 보간 속도
-- ================================================================

-- 1) 점프스케어 통지용 RemoteEvent 준비
local jumpscareEvent = ReplicatedStorage:FindFirstChild("JumpscareEvent")
if not jumpscareEvent then
    jumpscareEvent = Instance.new("RemoteEvent")
    jumpscareEvent.Name = "JumpscareEvent"
    jumpscareEvent.Parent = ReplicatedStorage
end

-- 2) 몬스터 모델 생성 (Explorer에서 직접 만들 필요 없이 이 스크립트가 전부 만듭니다)
local spawnPart = Workspace:FindFirstChild("MonsterSpawn")
local spawnPos = (spawnPart and spawnPart:IsA("BasePart")) and spawnPart.Position or SPAWN_POSITION

local monster = Instance.new("Model")
monster.Name = "Monster2D"

local hitbox = Instance.new("Part")
hitbox.Name = "HitBox"
hitbox.Size = Vector3.new(3, 3, 3)
hitbox.Anchored = true
hitbox.CanCollide = false
hitbox.CanTouch = true
hitbox.Transparency = 1
hitbox.CastShadow = false
hitbox.CFrame = CFrame.new(spawnPos)
hitbox.Parent = monster
monster.PrimaryPart = hitbox

local billboard = Instance.new("BillboardGui")
billboard.Name = "Sprite"
-- BillboardGui의 Size는 Scale 단위가 "스터드"로 취급됩니다.
billboard.Size = UDim2.fromScale(SPRITE_SIZE_STUDS, SPRITE_SIZE_STUDS)
billboard.AlwaysOnTop = false
billboard.LightInfluence = 0
billboard.Parent = hitbox

local image = Instance.new("ImageLabel")
image.Name = "Image"
image.Size = UDim2.fromScale(1, 1)
image.BackgroundTransparency = 1
image.Image = MONSTER_IMAGE_ID
image.Parent = billboard

monster.Parent = Workspace

-- 3) 이동/추격 로직
local raycastParams = RaycastParams.new()
raycastParams.FilterType = Enum.RaycastFilterType.Exclude
raycastParams.FilterDescendantsInstances = {monster}

local currentUp = Vector3.new(0, 1, 0)
local currentCFrame = hitbox.CFrame

local wanderDir = Vector3.new(1, 0, 0)
local wanderTimer = 0

local hasKilled = {} -- 플레이어별 중복 처치 방지용 디바운스

local function getNearestPlayerRoot()
    local nearest, nearestDist = nil, math.huge
    for _, plr in ipairs(Players:GetPlayers()) do
        local char = plr.Character
        local hum = char and char:FindFirstChildOfClass("Humanoid")
        local root = char and char:FindFirstChild("HumanoidRootPart")
        if char and hum and hum.Health > 0 and root then
            local dist = (root.Position - hitbox.Position).Magnitude
            if dist < nearestDist then
                nearest, nearestDist = root, dist
            end
        end
    end
    return nearest, nearestDist
end

local function killPlayer(player, humanoid)
    if hasKilled[player] then return end
    hasKilled[player] = true

    -- 클라이언트에 점프스케어 표시 요청
    jumpscareEvent:FireClient(player)

    -- 살짝 텀을 두고 실제 사망 처리 (점프스케어 임팩트를 위해)
    task.delay(0.15, function()
        if humanoid and humanoid.Health > 0 then
            humanoid.Health = 0
        end
    end)

    task.delay(3, function()
        hasKilled[player] = nil
    end)
end

hitbox.Touched:Connect(function(hit)
    local character = hit:FindFirstAncestorOfClass("Model")
    if not character then return end
    local humanoid = character:FindFirstChildOfClass("Humanoid")
    local player = Players:GetPlayerFromCharacter(character)
    if humanoid and player and humanoid.Health > 0 then
        killPlayer(player, humanoid)
    end
end)

RunService.Heartbeat:Connect(function(dt)
    local targetRoot, dist = getNearestPlayerRoot()
    local chasing = targetRoot ~= nil and dist <= DETECT_RANGE

    local desiredWorldDir
    if chasing then
        desiredWorldDir = targetRoot.Position - currentCFrame.Position
    else
        -- 추격 대상이 없으면 표면 위에서 천천히 배회
        wanderTimer -= dt
        if wanderTimer <= 0 then
            wanderTimer = math.random(3, 6)
            local randAngle = math.random() * math.pi * 2
            wanderDir = Vector3.new(math.cos(randAngle), 0, math.sin(randAngle))
        end
        desiredWorldDir = wanderDir
    end

    -- 현재 표면 평면(법선 기준) 위로 이동 방향을 투영
    local flatDir = desiredWorldDir - currentUp * desiredWorldDir:Dot(currentUp)
    if flatDir.Magnitude > 0.05 then
        flatDir = flatDir.Unit
    else
        flatDir = currentCFrame.LookVector
    end

    local speed = chasing and MOVE_SPEED or (MOVE_SPEED * WANDER_SPEED_MULT)
    local moveStep = flatDir * speed * dt
    local tentativePos = currentCFrame.Position + moveStep

    -- 표면을 다시 찾기 위한 레이캐스트 (현재 법선의 반대 방향으로 쏨)
    local rayOrigin = tentativePos + currentUp * (STICK_RAY_LENGTH * 0.5)
    local rayDir = -currentUp * STICK_RAY_LENGTH

    local result = Workspace:Raycast(rayOrigin, rayDir, raycastParams)

    if not result then
        -- 모서리를 돌 때: 이동 방향쪽으로 좀 더 나가서 벽/천장을 탐색
        local altOrigin = currentCFrame.Position + flatDir * 2 + currentUp * (STICK_RAY_LENGTH * 0.5)
        result = Workspace:Raycast(altOrigin, rayDir, raycastParams)
    end

    if result then
        currentUp = result.Normal
        local newPos = result.Position + result.Normal * SURFACE_OFFSET
        local lookDir = flatDir
        if lookDir.Magnitude < 0.01 then
            lookDir = currentCFrame.LookVector
        end

        local ok, goalCFrame = pcall(CFrame.lookAt, newPos, newPos + lookDir, currentUp)
        if ok then
            currentCFrame = currentCFrame:Lerp(goalCFrame, math.clamp(TURN_SPEED * dt, 0, 1))
        end
    end

    hitbox.CFrame = currentCFrame

    if chasing and dist <= KILL_RANGE then
        local player = Players:GetPlayerFromCharacter(targetRoot.Parent)
        local humanoid = targetRoot.Parent:FindFirstChildOfClass("Humanoid")
        if player and humanoid then
            killPlayer(player, humanoid)
        end
    end
end)
