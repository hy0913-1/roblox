--!strict
-- Server authority for the wizard's frost nova: validates the request, enforces the cooldown,
-- takes the position from the server-side character (never from the client), and applies damage + slow.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local Config = require(ReplicatedStorage.Shared.UltimateConfig)

local function makeRemote(name: string): RemoteEvent
	local remote = Instance.new("RemoteEvent")
	remote.Name = name
	remote.Parent = ReplicatedStorage
	return remote
end

local requestRemote = makeRemote("UltimateRequest") -- client -> server, no arguments
local fxRemote = makeRemote("UltimateFx") -- server -> clients, origin position

local lastCast: { [Player]: number } = {}
local slowState: { [Humanoid]: { token: number, base: number } } = {}

local function applySlow(humanoid: Humanoid)
	local state = slowState[humanoid]
	if not state then
		state = { token = 0, base = humanoid.WalkSpeed }
		slowState[humanoid] = state
	end
	state.token += 1
	local token = state.token
	humanoid.WalkSpeed = Config.SlowSpeed
	task.delay(Config.SlowDuration, function()
		if state.token == token then
			humanoid.WalkSpeed = state.base
			slowState[humanoid] = nil
		end
	end)
end

local function strike(caster: Model, origin: Vector3)
	local hitModels: { [Model]: boolean } = {}
	for _, part in Workspace:GetPartBoundsInRadius(origin, Config.Radius) do
		local model = part:FindFirstAncestorOfClass("Model")
		if model and model ~= caster and not hitModels[model] then
			local humanoid = model:FindFirstChildOfClass("Humanoid")
			if humanoid and humanoid.Health > 0 then
				hitModels[model] = true
				humanoid:TakeDamage(Config.Damage)
				applySlow(humanoid)
			end
		end
	end
end

requestRemote.OnServerEvent:Connect(function(player: Player)
	local now = os.clock()
	local last = lastCast[player]
	if last and now - last < Config.Cooldown then
		return
	end

	local character = player.Character
	local humanoid = character and character:FindFirstChildOfClass("Humanoid")
	local root = character and character:FindFirstChild("HumanoidRootPart")
	if not character or not humanoid or humanoid.Health <= 0 or not root or not root:IsA("BasePart") then
		return
	end

	lastCast[player] = now
	local origin = root.Position
	fxRemote:FireAllClients(origin)

	task.delay(Config.ChargeTime, function()
		strike(character, origin)
	end)
end)

Players.PlayerRemoving:Connect(function(player: Player)
	lastCast[player] = nil
end)
