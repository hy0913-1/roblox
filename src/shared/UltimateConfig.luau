--!strict
-- Wizard ultimate "Frost Nova": gameplay numbers and visual timings.
-- Timings and palette come from pixelfx `ice/frost-nova` (see docs/frost-nova-reference.png).

local Config = {
	-- gameplay (enforced on the server)
	Cooldown = 20, -- seconds
	Radius = 18, -- studs
	Damage = 35,
	SlowSpeed = 6, -- WalkSpeed while frozen
	SlowDuration = 3, -- seconds

	-- timeline, seconds from the cast
	ChargeTime = 0.42, -- snowflake gathers, then the nova bursts
	SpreadTime = 0.62, -- the wave reaches full radius
	MeltStart = 1.95, -- ice starts melting back into the floor
	MeltTime = 0.9,

	-- pixelfx palette, dark to bright
	Palette = {
		"#151a3d",
		"#212f6b",
		"#2c58aa",
		"#3a8bd8",
		"#62c8f4",
		"#a6ecff",
		"#dcfbff",
		"#ffffff",
	},

	-- crystal rings: where they stand (fraction of Radius), size in studs, count
	Rings = {
		{ reachMin = 0.15, reachMax = 0.24, height = { 3.2, 4.5 }, width = { 1.3, 1.7 }, count = 6 },
		{ reachMin = 0.36, reachMax = 0.52, height = { 1.8, 2.6 }, width = { 0.9, 1.2 }, count = 12 },
		{ reachMin = 0.62, reachMax = 0.90, height = { 0.7, 1.4 }, width = { 0.5, 0.8 }, count = 20 },
	},
	Seed = 4,
}

return Config
