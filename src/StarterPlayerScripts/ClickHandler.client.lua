-- 클라이언트: 버튼 클릭 → 서버 전송, UI 업데이트 수신
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")

local Events = ReplicatedStorage:WaitForChild("Events")
local ClickEvent    = Events:WaitForChild("OnClick")
local BuyUpgradeEvent = Events:WaitForChild("BuyUpgrade")
local SyncEvent     = Events:WaitForChild("SyncData")

local GameConfig = require(ReplicatedStorage:WaitForChild("GameConfig"))
local player = Players.LocalPlayer
local gui = player.PlayerGui:WaitForChild("ClickerGui")

local coinsLabel    = gui.Main.CoinsLabel
local cpsLabel      = gui.Main.CpsLabel
local clickButton   = gui.Main.ClickButton
local upgradeFrame  = gui.Main.UpgradeFrame

local currentData = nil

-- 숫자 포맷 (1000 → 1K, 1000000 → 1M)
local function formatNumber(n)
	if n >= 1e9 then return string.format("%.1fB", n / 1e9)
	elseif n >= 1e6 then return string.format("%.1fM", n / 1e6)
	elseif n >= 1e3 then return string.format("%.1fK", n / 1e3)
	else return tostring(math.floor(n))
	end
end

-- 업그레이드 버튼 상태 갱신
local function refreshUpgradeButtons()
	if not currentData then return end
	for _, btn in ipairs(upgradeFrame:GetChildren()) do
		if btn:IsA("TextButton") then
			local upgradeId = btn.Name
			local purchased = currentData.upgrades[upgradeId]
			btn.BackgroundColor3 = purchased and Color3.fromRGB(80, 180, 80)
				or (currentData.coins >= btn:GetAttribute("cost")
					and Color3.fromRGB(60, 120, 220)
					or Color3.fromRGB(100, 100, 100))
			btn.Text = purchased and ("✓ " .. btn:GetAttribute("name"))
				or (btn:GetAttribute("name") .. "\n💰 " .. formatNumber(btn:GetAttribute("cost")))
		end
	end
end

-- 서버에서 데이터 수신 → UI 갱신
SyncEvent.OnClientEvent:Connect(function(data)
	currentData = data
	coinsLabel.Text = "💰 " .. formatNumber(data.coins)
	cpsLabel.Text = "⚡ 클릭력: " .. data.clickPower
		.. "  |  🔄 초당: " .. data.autoPerSec
	refreshUpgradeButtons()
end)

-- 클릭 버튼 처리
local clicking = false
clickButton.MouseButton1Click:Connect(function()
	if clicking then return end
	clicking = true

	-- 클릭 애니메이션
	local tween = TweenService:Create(
		clickButton,
		TweenInfo.new(0.05, Enum.EasingStyle.Bounce),
		{ Size = UDim2.new(0.85, 0, 0.85, 0) }
	)
	tween:Play()
	tween.Completed:Connect(function()
		TweenService:Create(
			clickButton,
			TweenInfo.new(0.05),
			{ Size = UDim2.new(1, 0, 1, 0) }
		):Play()
		clicking = false
	end)

	ClickEvent:FireServer()
end)

-- 업그레이드 버튼 생성
for _, upgrade in ipairs(GameConfig.UPGRADES) do
	local btn = Instance.new("TextButton")
	btn.Name = upgrade.id
	btn.Size = UDim2.new(1, -10, 0, 60)
	btn.BackgroundColor3 = Color3.fromRGB(100, 100, 100)
	btn.TextColor3 = Color3.fromRGB(255, 255, 255)
	btn.Font = Enum.Font.GothamBold
	btn.TextSize = 13
	btn.TextWrapped = true
	btn.AutoButtonColor = false
	btn:SetAttribute("cost", upgrade.cost)
	btn:SetAttribute("name", upgrade.name)

	-- 설명 레이블
	local desc = Instance.new("TextLabel")
	desc.Size = UDim2.new(1, 0, 0.4, 0)
	desc.Position = UDim2.new(0, 0, 0.6, 0)
	desc.BackgroundTransparency = 1
	desc.TextColor3 = Color3.fromRGB(200, 200, 200)
	desc.Font = Enum.Font.Gotham
	desc.TextSize = 11
	desc.Text = upgrade.description
	desc.Parent = btn

	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 6)
	corner.Parent = btn

	btn.MouseButton1Click:Connect(function()
		if currentData and not currentData.upgrades[upgrade.id]
			and currentData.coins >= upgrade.cost then
			BuyUpgradeEvent:FireServer(upgrade.id)
		end
	end)

	btn.Parent = upgradeFrame
end

-- 업그레이드 리스트 레이아웃
local layout = Instance.new("UIListLayout")
layout.Padding = UDim.new(0, 6)
layout.Parent = upgradeFrame
