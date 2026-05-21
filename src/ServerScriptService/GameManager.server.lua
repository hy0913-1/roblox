-- 서버 메인 로직: 코인 관리, 업그레이드, 데이터 저장
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local DataStoreService = game:GetService("DataStoreService")
local RunService = game:GetService("RunService")

local GameConfig = require(ReplicatedStorage:WaitForChild("GameConfig"))
local DataStore = DataStoreService:GetDataStore("ClickerData_v1")

-- Studio에서 미리 만들어둔 RemoteEvents 참조
local Events          = ReplicatedStorage:WaitForChild("Events")
local ClickEvent      = Events:WaitForChild("OnClick")
local BuyUpgradeEvent = Events:WaitForChild("BuyUpgrade")
local SyncEvent       = Events:WaitForChild("SyncData")

-- 플레이어 데이터 기본값
local function defaultData()
	return {
		coins = 0,
		totalCoins = 0,
		clickPower = 1,
		autoPerSec = 0,
		upgrades = {},
	}
end

-- 현재 세션 데이터 캐시
local playerData = {}

-- DataStore 불러오기
local function loadData(player)
	local success, data = pcall(function()
		return DataStore:GetAsync("player_" .. player.UserId)
	end)
	if success and data then
		-- 새로 추가된 필드 기본값 보정
		local base = defaultData()
		for k, v in pairs(base) do
			if data[k] == nil then data[k] = v end
		end
		return data
	end
	return defaultData()
end

-- DataStore 저장
local function saveData(player)
	local data = playerData[player.UserId]
	if not data then return end
	pcall(function()
		DataStore:SetAsync("player_" .. player.UserId, data)
	end)
end

-- 클라이언트에 전체 데이터 동기화
local function syncToClient(player)
	local data = playerData[player.UserId]
	if data then
		SyncEvent:FireClient(player, data)
	end
end

-- 플레이어 입장
Players.PlayerAdded:Connect(function(player)
	playerData[player.UserId] = loadData(player)
	syncToClient(player)
end)

-- 플레이어 퇴장 시 저장
Players.PlayerRemoving:Connect(function(player)
	saveData(player)
	playerData[player.UserId] = nil
end)

-- 서버 종료 시 전체 저장
game:BindToClose(function()
	for _, player in ipairs(Players:GetPlayers()) do
		saveData(player)
	end
end)

-- 클릭 처리
ClickEvent.OnServerEvent:Connect(function(player)
	local data = playerData[player.UserId]
	if not data then return end

	local earned = data.clickPower
	data.coins = data.coins + earned
	data.totalCoins = data.totalCoins + earned

	SyncEvent:FireClient(player, data)
end)

-- 업그레이드 구매 처리
BuyUpgradeEvent.OnServerEvent:Connect(function(player, upgradeId)
	local data = playerData[player.UserId]
	if not data then return end

	-- 이미 구매했는지 확인
	if data.upgrades[upgradeId] then return end

	-- 업그레이드 정보 검색
	local upgrade = nil
	for _, u in ipairs(GameConfig.UPGRADES) do
		if u.id == upgradeId then
			upgrade = u
			break
		end
	end
	if not upgrade then return end

	-- 비용 확인
	if data.coins < upgrade.cost then return end

	-- 적용
	data.coins = data.coins - upgrade.cost
	data.upgrades[upgradeId] = true
	data.clickPower = data.clickPower + upgrade.clickBonus
	data.autoPerSec = data.autoPerSec + upgrade.autoBonus

	SyncEvent:FireClient(player, data)
end)

-- 자동 수집 루프 (1초마다)
local ticker = 0
RunService.Heartbeat:Connect(function(dt)
	ticker = ticker + dt
	if ticker < 1 then return end
	ticker = 0

	for _, player in ipairs(Players:GetPlayers()) do
		local data = playerData[player.UserId]
		if data and data.autoPerSec > 0 then
			data.coins = data.coins + data.autoPerSec
			data.totalCoins = data.totalCoins + data.autoPerSec
			SyncEvent:FireClient(player, data)
		end
	end
end)

-- 자동 저장 루프
local saveTicker = 0
RunService.Heartbeat:Connect(function(dt)
	saveTicker = saveTicker + dt
	if saveTicker < GameConfig.AUTOSAVE_INTERVAL then return end
	saveTicker = 0

	for _, player in ipairs(Players:GetPlayers()) do
		saveData(player)
	end
end)
