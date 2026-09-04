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

local SHAKE_DURATION = 0.9 -- 카메라 흔들림 지속 시간
local SHAKE_MAGNITUDE = 0.55 -- 카메라 흔들림 강도
local HOLD_TIME = 1.6 -- 이미지가 화면을 채운 채 유지되는 시간
local FADE_OUT_TIME = 0.5 -- 검은 화면으로 전환되는 시간

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

-- 시작할 때 번쩍이는 흰색 스트로브
local strobe = Instance.new("Frame")
strobe.Name = "Strobe"
strobe.Size = UDim2.fromScale(1, 1)
strobe.BackgroundColor3 = Color3.new(1, 1, 1)
strobe.BorderSizePixel = 0
strobe.BackgroundTransparency = 1
strobe.ZIndex = 3
strobe.Parent = screenGui

-- 연출 내내 깔리는 붉은 틴트 (서서히 옅어짐)
local redTint = Instance.new("Frame")
redTint.Name = "RedTint"
redTint.Size = UDim2.fromScale(1, 1)
redTint.BackgroundColor3 = Color3.fromRGB(120, 0, 0)
redTint.BorderSizePixel = 0
redTint.BackgroundTransparency = 1
redTint.ZIndex = 1
redTint.Parent = screenGui

-- 점프스케어 이미지: 화면을 꽉 채우도록 크게 표시
local image = Instance.new("ImageLabel")
image.Name = "JumpscareImage"
image.AnchorPoint = Vector2.new(0.5, 0.5)
image.Position = UDim2.fromScale(0.5, 0.5)
image.Size = UDim2.fromScale(0, 0)
image.BackgroundTransparency = 1
image.Image = IMAGE_ID
image.ImageTransparency = 0
image.ScaleType = Enum.ScaleType.Crop
image.ZIndex = 2
image.Parent = screenGui

-- 연출이 끝날 때 사망/리스폰 전환을 자연스럽게 가려주는 암전
local blackOut = Instance.new("Frame")
blackOut.Name = "BlackOut"
blackOut.Size = UDim2.fromScale(1, 1)
blackOut.BackgroundColor3 = Color3.new(0, 0, 0)
blackOut.BorderSizePixel = 0
blackOut.BackgroundTransparency = 1
blackOut.ZIndex = 4
blackOut.Parent = screenGui

local sound = Instance.new("Sound")
sound.Name = "JumpscareSound"
sound.SoundId = SOUND_ID
sound.Volume = 1
sound.Parent = screenGui

local reverb = Instance.new("ReverbSoundEffect")
reverb.DecayTime = 2.5
reverb.WetLevel = 2
reverb.Parent = sound

local SHAKE_BINDING = "JumpscareShake"

local function startShake(duration, magnitude)
	local elapsed = 0
	RunService:BindToRenderStep(SHAKE_BINDING, Enum.RenderPriority.Camera.Value + 1, function(dt)
		elapsed += dt
		local camera = workspace.CurrentCamera
		if elapsed >= duration or not camera then
			RunService:UnbindFromRenderStep(SHAKE_BINDING)
			return
		end
		local falloff = 1 - (elapsed / duration)
		local amt = magnitude * falloff
		camera.CFrame = camera.CFrame
			* CFrame.Angles(
				math.rad((math.random() - 0.5) * amt * 6),
				math.rad((math.random() - 0.5) * amt * 6),
				math.rad((math.random() - 0.5) * amt * 4)
			)
			* CFrame.new((math.random() - 0.5) * amt, (math.random() - 0.5) * amt, 0)
	end)
end

local function strobeFlash()
	for _ = 1, 3 do
		strobe.BackgroundTransparency = 0.1
		task.wait(0.04)
		strobe.BackgroundTransparency = 1
		task.wait(0.05)
	end
end

local playing = false

local function playJumpscare()
	if playing then
		return
	end
	playing = true

	screenGui.Enabled = true
	image.Size = UDim2.fromScale(0, 0)
	image.ImageTransparency = 0
	redTint.BackgroundTransparency = 0.55
	blackOut.BackgroundTransparency = 1

	sound.PlaybackSpeed = 0.95 + math.random() * 0.15
	sound:Play()
	startShake(SHAKE_DURATION, SHAKE_MAGNITUDE)
	task.spawn(strobeFlash)

	-- 화면 밖으로 튀어나올 정도로 확 커졌다가(펀치) 화면을 꽉 채우는 크기로 안착
	TweenService:Create(image, TweenInfo.new(0.12, Enum.EasingStyle.Back, Enum.EasingDirection.Out), {
		Size = UDim2.fromScale(1.35, 1.35),
	}):Play()
	task.delay(0.12, function()
		TweenService:Create(image, TweenInfo.new(0.25, Enum.EasingStyle.Sine, Enum.EasingDirection.Out), {
			Size = UDim2.fromScale(1.05, 1.05),
		}):Play()
	end)

	TweenService:Create(redTint, TweenInfo.new(HOLD_TIME), {
		BackgroundTransparency = 1,
	}):Play()

	task.delay(HOLD_TIME, function()
		local fade = TweenService:Create(blackOut, TweenInfo.new(FADE_OUT_TIME), {
			BackgroundTransparency = 0,
		})
		fade:Play()
		fade.Completed:Wait()
		screenGui.Enabled = false
		blackOut.BackgroundTransparency = 1
		playing = false
	end)
end

jumpscareEvent.OnClientEvent:Connect(playJumpscare)
