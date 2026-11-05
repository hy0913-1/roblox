--!strict
-- Press R to cast the frost nova. The server decides whether it actually happens.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")

local Config = require(ReplicatedStorage.Shared.UltimateConfig)
local FrostBurst = require(ReplicatedStorage.Shared.FrostBurst)

local requestRemote = ReplicatedStorage:WaitForChild("UltimateRequest") :: RemoteEvent
local fxRemote = ReplicatedStorage:WaitForChild("UltimateFx") :: RemoteEvent

local lastRequest = 0

UserInputService.InputBegan:Connect(function(input: InputObject, gameProcessed: boolean)
	if gameProcessed or input.KeyCode ~= Enum.KeyCode.R then
		return
	end
	local now = os.clock()
	if now - lastRequest < Config.Cooldown then
		return -- local debounce only; the server enforces the real cooldown
	end
	lastRequest = now
	requestRemote:FireServer()
end)

fxRemote.OnClientEvent:Connect(function(origin: Vector3)
	if typeof(origin) == "Vector3" then
		FrostBurst.play(origin)
	end
end)
