-- ============================================================
-- 붙여넣을 위치 : StarterPlayer > StarterPlayerScripts > (LocalScript, 이름은 자유) 예: "JumpscareHandler"
-- 역할 : 서버가 보내는 신호를 받아 화면 전체에 몬스터 얼굴 점프스케어 + 효과음을 표시
-- ============================================================

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")

local player = Players.LocalPlayer
local jumpscareEvent = ReplicatedStorage:WaitForChild("JumpscareEvent")

-- ================= 설정값 (원하는 대로 수정하세요) =================
local JUMPSCARE_IMAGE_ID = "rbxassetid://0" -- TODO: 몬스터 클로즈업 이미지 에셋 ID로 교체
local JUMPSCARE_SOUND_ID = "rbxassetid://0" -- TODO: 비명/공격 효과음 에셋 ID로 교체
local FLASH_IN_TIME = 0.08
local HOLD_TIME = 1.1
local FADE_OUT_TIME = 0.6
-- ================================================================

local isPlaying = false

local function playJumpscare()
    if isPlaying then return end
    isPlaying = true

    local screenGui = Instance.new("ScreenGui")
    screenGui.Name = "JumpscareGui"
    screenGui.IgnoreGuiInset = true
    screenGui.DisplayOrder = 999
    screenGui.ResetOnSpawn = false
    screenGui.Parent = player:WaitForChild("PlayerGui")

    local image = Instance.new("ImageLabel")
    image.Name = "MonsterFace"
    image.AnchorPoint = Vector2.new(0.5, 0.5)
    image.Position = UDim2.fromScale(0.5, 0.5)
    image.Size = UDim2.fromScale(1.15, 1.15)
    image.BackgroundColor3 = Color3.new(0, 0, 0)
    image.BackgroundTransparency = 1
    image.Image = JUMPSCARE_IMAGE_ID
    image.ScaleType = Enum.ScaleType.Crop
    image.ImageTransparency = 1
    image.ZIndex = 10
    image.Parent = screenGui

    local sound = Instance.new("Sound")
    sound.Name = "JumpscareSound"
    sound.SoundId = JUMPSCARE_SOUND_ID
    sound.Volume = 1
    sound.Parent = screenGui
    sound:Play()

    local flashIn = TweenService:Create(image, TweenInfo.new(FLASH_IN_TIME, Enum.EasingStyle.Quad), {
        ImageTransparency = 0,
        BackgroundTransparency = 0,
    })
    flashIn:Play()

    task.wait(FLASH_IN_TIME + HOLD_TIME)

    local fadeOut = TweenService:Create(image, TweenInfo.new(FADE_OUT_TIME, Enum.EasingStyle.Quad), {
        ImageTransparency = 1,
        BackgroundTransparency = 1,
    })
    fadeOut:Play()
    fadeOut.Completed:Wait()

    screenGui:Destroy()
    isPlaying = false
end

jumpscareEvent.OnClientEvent:Connect(function()
    playJumpscare()
end)
