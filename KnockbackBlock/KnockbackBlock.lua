-- KnockbackBlock.lua
-- Place this Script inside a Part in Roblox Studio.
-- The Part should also contain a Sound object named "HitSound".
--
-- Setup:
--   Part (any shape)
--   └─ Script  (this file)
--   └─ Sound   (Name = "HitSound", SoundId = your audio asset)

local part = script.Parent
local sound = part:WaitForChild("HitSound")

local KNOCKBACK_FORCE   = 120   -- studs/s horizontal push
local KNOCKBACK_UP      = 60    -- studs/s vertical push
local COOLDOWN_SECONDS  = 1.5   -- per-player cooldown to prevent spam

local lastHitTime = {}          -- [userId] = tick()

local function applyKnockback(character, hitPart)
	local humanoid      = character:FindFirstChildOfClass("Humanoid")
	local rootPart      = character:FindFirstChild("HumanoidRootPart")

	if not humanoid or not rootPart or humanoid.Health <= 0 then return end

	-- Direction: away from the block's centre
	local direction = (rootPart.Position - part.Position)
	direction = Vector3.new(direction.X, 0, direction.Z).Unit

	-- Remove any existing BodyVelocity so forces don't stack
	local existing = rootPart:FindFirstChild("KnockbackVelocity")
	if existing then existing:Destroy() end

	local bv = Instance.new("BodyVelocity")
	bv.Name          = "KnockbackVelocity"
	bv.Velocity      = direction * KNOCKBACK_FORCE + Vector3.new(0, KNOCKBACK_UP, 0)
	bv.MaxForce      = Vector3.new(1e5, 1e5, 1e5)
	bv.P             = 1e5
	bv.Parent        = rootPart

	-- Remove the force after a short time so normal physics resume
	game:GetService("Debris"):AddItem(bv, 0.18)
end

part.Touched:Connect(function(hitPart)
	local character = hitPart.Parent
	local humanoid  = character:FindFirstChildOfClass("Humanoid")
	if not humanoid then return end

	local player = game:GetService("Players"):GetPlayerFromCharacter(character)
	if not player then return end

	-- Per-player cooldown
	local now = tick()
	if lastHitTime[player.UserId] and now - lastHitTime[player.UserId] < COOLDOWN_SECONDS then
		return
	end
	lastHitTime[player.UserId] = now

	-- Play sound
	sound:Play()

	-- Apply knockback
	applyKnockback(character, hitPart)
end)

-- Clean up table entries when a player leaves
game:GetService("Players").PlayerRemoving:Connect(function(player)
	lastHitTime[player.UserId] = nil
end)
