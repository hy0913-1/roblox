--[[
	JumpscareClient (LocalScript)

	이 스크립트를 StarterPlayer > StarterPlayerScripts 안에 넣어주세요.

	아래 IMAGE_ID / SOUND_ID를 원하는 점프스케어 이미지·사운드의
	rbxassetid로 교체하세요. (둘 다 Roblox에 먼저 업로드되어 있어야 합니다)
]]

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")

local IMAGE_ID = "rbxassetid://0" -- TODO: 점프스케어 이미지로 교체
local SOUND_ID = "rbxassetid://0" -- TODO: 놀람 효과음으로 교체
local SHAKE_DURATION = 0.5
local HIDE_AFTER = 1.4

local jumpscareEvent = ReplicatedStorage:WaitForChild("JumpscareEvent")
local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

local screenGui = Instance.new("ScreenGui")
screenGui.Name = "JumpscareGui"
screenGui.IgnoreGuiInset = true
screenGui.DisplayOrder = 1000
screenGui.ResetOnSpawn = false
screenGui.Enabled = false
screenGui.Parent = playerGui

local flash = Instance.new("Frame")
flash.Name = "Flash"
flash.Size = UDim2.fromScale(1, 1)
flash.BackgroundColor3 = Color3.new(1, 0, 0)
flash.BackgroundTransparency = 1
flash.BorderSizePixel = 0
flash.ZIndex = 1
flash.Parent = screenGui

local image = Instance.new("ImageLabel")
image.Name = "JumpscareImage"
image.AnchorPoint = Vector2.new(0.5, 0.5)
image.Position = UDim2.fromScale(0.5, 0.5)
image.Size = UDim2.fromScale(0.6, 0.6)
image.BackgroundTransparency = 1
image.Image = IMAGE_ID
image.ImageTransparency = 0
image.ZIndex = 2
image.Parent = screenGui

local sound = Instance.new("Sound")
sound.Name = "JumpscareSound"
sound.SoundId = SOUND_ID
sound.Volume = 1
sound.Parent = screenGui

local SHAKE_BINDING = "JumpscareShake"

local function startShake(duration)
	local elapsed = 0
	RunService:BindToRenderStep(SHAKE_BINDING, Enum.RenderPriority.Camera.Value + 1, function(dt)
		elapsed += dt
		local camera = workspace.CurrentCamera
		if elapsed >= duration or not camera then
			RunService:UnbindFromRenderStep(SHAKE_BINDING)
			return
		end
		camera.CFrame = camera.CFrame * CFrame.new((math.random() - 0.5) * 0.4, (math.random() - 0.5) * 0.4, 0)
	end)
end

local playing = false

local function playJumpscare()
	if playing then
		return
	end
	playing = true

	screenGui.Enabled = true
	image.Size = UDim2.fromScale(1.4, 1.4)
	image.ImageTransparency = 0
	flash.BackgroundTransparency = 0.2
	sound:Play()
	startShake(SHAKE_DURATION)

	TweenService:Create(image, TweenInfo.new(0.35, Enum.EasingStyle.Back, Enum.EasingDirection.Out), {
		Size = UDim2.fromScale(0.6, 0.6),
	}):Play()
	TweenService:Create(flash, TweenInfo.new(0.5), {
		BackgroundTransparency = 1,
	}):Play()

	task.delay(HIDE_AFTER, function()
		screenGui.Enabled = false
		playing = false
	end)
end

jumpscareEvent.OnClientEvent:Connect(playJumpscare)
