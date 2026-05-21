-- 게임 전체 설정값 (서버/클라이언트 공유)
local GameConfig = {}

GameConfig.AUTOSAVE_INTERVAL = 60  -- 초마다 자동 저장

GameConfig.UPGRADES = {
	{
		id = "click_power_1",
		name = "클릭 강화 I",
		description = "클릭당 +1 코인",
		cost = 50,
		clickBonus = 1,
		autoBonus = 0,
		maxLevel = 1,
	},
	{
		id = "click_power_2",
		name = "클릭 강화 II",
		description = "클릭당 +5 코인",
		cost = 300,
		clickBonus = 5,
		autoBonus = 0,
		maxLevel = 1,
	},
	{
		id = "click_power_3",
		name = "클릭 강화 III",
		description = "클릭당 +20 코인",
		cost = 2000,
		clickBonus = 20,
		autoBonus = 0,
		maxLevel = 1,
	},
	{
		id = "auto_1",
		name = "자동 채굴기 I",
		description = "초당 +1 코인 자동 수집",
		cost = 100,
		clickBonus = 0,
		autoBonus = 1,
		maxLevel = 1,
	},
	{
		id = "auto_2",
		name = "자동 채굴기 II",
		description = "초당 +5 코인 자동 수집",
		cost = 800,
		clickBonus = 0,
		autoBonus = 5,
		maxLevel = 1,
	},
	{
		id = "auto_3",
		name = "자동 채굴기 III",
		description = "초당 +25 코인 자동 수집",
		cost = 5000,
		clickBonus = 0,
		autoBonus = 25,
		maxLevel = 1,
	},
}

return GameConfig
