-- GUI 구조 자동 생성 스크립트 (StarterGui에 LocalScript로 넣거나 Studio에서 직접 구성)
-- 이 스크립트는 Studio에서 직접 ScreenGui를 만들 때 참고하세요.
--
-- 구조:
-- ScreenGui (Name: ClickerGui)
--   └─ Main (Frame) — 화면 전체
--       ├─ CoinsLabel (TextLabel) — 코인 표시
--       ├─ CpsLabel (TextLabel) — 클릭력/초당 표시
--       ├─ ClickButton (TextButton) — 클릭 버튼 (중앙)
--       └─ UpgradeFrame (ScrollingFrame) — 업그레이드 목록 (오른쪽)

local Players = game:GetService("Players")
local player = Players.LocalPlayer

local screenGui = Instance.new("ScreenGui")
screenGui.Name = "ClickerGui"
screenGui.ResetOnSpawn = false
screenGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling

-- 배경 프레임
local main = Instance.new("Frame")
main.Name = "Main"
main.Size = UDim2.new(1, 0, 1, 0)
main.BackgroundColor3 = Color3.fromRGB(15, 15, 30)
main.BorderSizePixel = 0
main.Parent = screenGui

-- 코인 레이블
local coinsLabel = Instance.new("TextLabel")
coinsLabel.Name = "CoinsLabel"
coinsLabel.Size = UDim2.new(0.5, 0, 0, 50)
coinsLabel.Position = UDim2.new(0.05, 0, 0.04, 0)
coinsLabel.BackgroundTransparency = 1
coinsLabel.TextColor3 = Color3.fromRGB(255, 215, 0)
coinsLabel.Font = Enum.Font.GothamBold
coinsLabel.TextSize = 28
coinsLabel.Text = "💰 0"
coinsLabel.TextXAlignment = Enum.TextXAlignment.Left
coinsLabel.Parent = main

-- CPS / 클릭력 레이블
local cpsLabel = Instance.new("TextLabel")
cpsLabel.Name = "CpsLabel"
cpsLabel.Size = UDim2.new(0.5, 0, 0, 30)
cpsLabel.Position = UDim2.new(0.05, 0, 0.12, 0)
cpsLabel.BackgroundTransparency = 1
cpsLabel.TextColor3 = Color3.fromRGB(180, 220, 255)
cpsLabel.Font = Enum.Font.Gotham
cpsLabel.TextSize = 16
cpsLabel.Text = "⚡ 클릭력: 1  |  🔄 초당: 0"
cpsLabel.TextXAlignment = Enum.TextXAlignment.Left
cpsLabel.Parent = main

-- 클릭 버튼 (화면 중앙 왼쪽)
local clickButton = Instance.new("TextButton")
clickButton.Name = "ClickButton"
clickButton.Size = UDim2.new(0, 200, 0, 200)
clickButton.Position = UDim2.new(0.2, 0, 0.35, 0)
clickButton.AnchorPoint = Vector2.new(0.5, 0.5)
clickButton.BackgroundColor3 = Color3.fromRGB(255, 180, 0)
clickButton.TextColor3 = Color3.fromRGB(50, 30, 0)
clickButton.Font = Enum.Font.GothamBold
clickButton.TextSize = 22
clickButton.Text = "⛏️\nCLICK!"
clickButton.AutoButtonColor = false
clickButton.Parent = main

local btnCorner = Instance.new("UICorner")
btnCorner.CornerRadius = UDim.new(1, 0)
btnCorner.Parent = clickButton

local btnGradient = Instance.new("UIGradient")
btnGradient.Color = ColorSequence.new({
	ColorSequenceKeypoint.new(0, Color3.fromRGB(255, 220, 50)),
	ColorSequenceKeypoint.new(1, Color3.fromRGB(220, 140, 0)),
})
btnGradient.Rotation = 90
btnGradient.Parent = clickButton

-- 업그레이드 패널 (오른쪽)
local upgradePanel = Instance.new("Frame")
upgradePanel.Name = "UpgradePanel"
upgradePanel.Size = UDim2.new(0, 260, 0.85, 0)
upgradePanel.Position = UDim2.new(1, -275, 0.08, 0)
upgradePanel.BackgroundColor3 = Color3.fromRGB(25, 25, 50)
upgradePanel.BorderSizePixel = 0
upgradePanel.Parent = main

local panelCorner = Instance.new("UICorner")
panelCorner.CornerRadius = UDim.new(0, 12)
panelCorner.Parent = upgradePanel

local panelTitle = Instance.new("TextLabel")
panelTitle.Size = UDim2.new(1, 0, 0, 40)
panelTitle.BackgroundTransparency = 1
panelTitle.TextColor3 = Color3.fromRGB(255, 255, 255)
panelTitle.Font = Enum.Font.GothamBold
panelTitle.TextSize = 18
panelTitle.Text = "🛒 업그레이드"
panelTitle.Parent = upgradePanel

local upgradeFrame = Instance.new("ScrollingFrame")
upgradeFrame.Name = "UpgradeFrame"
upgradeFrame.Size = UDim2.new(1, -10, 1, -50)
upgradeFrame.Position = UDim2.new(0, 5, 0, 45)
upgradeFrame.BackgroundTransparency = 1
upgradeFrame.ScrollBarThickness = 4
upgradeFrame.CanvasSize = UDim2.new(0, 0, 0, 0)
upgradeFrame.AutomaticCanvasSize = Enum.AutomaticSize.Y
upgradeFrame.Parent = upgradePanel

upgradeFrame.Parent = main  -- ClickHandler가 Main에서 찾도록 재배치
upgradeFrame.Position = UDim2.new(0.62, 0, 0.1, 0)
upgradeFrame.Size = UDim2.new(0, 250, 0.82, 0)

screenGui.Parent = player.PlayerGui
