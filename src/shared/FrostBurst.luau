--!strict
-- Visual-only frost nova. Run on clients; the server decides damage separately.

local Debris = game:GetService("Debris")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local Workspace = game:GetService("Workspace")

local Config = require(script.Parent.UltimateConfig)

local FrostBurst = {}

local SPARKLE = "rbxasset://textures/particles/sparkles_main.dds"
local CORE_HEIGHT = 3 -- studs above the floor where the snowflake gathers

local palette: { Color3 } = {}
for _, hex in Config.Palette do
	table.insert(palette, Color3.fromHex(hex))
end

local function getFolder(): Folder
	local folder = Workspace:FindFirstChild("FrostFx")
	if folder and folder:IsA("Folder") then
		return folder
	end
	local created = Instance.new("Folder")
	created.Name = "FrostFx"
	created.Parent = Workspace
	return created
end

local function newPart(className: string, size: Vector3, color: Color3, transparency: number, cframe: CFrame): BasePart
	local part = Instance.new(className) :: BasePart
	part.Anchored = true
	part.CanCollide = false
	part.CanQuery = false
	part.CanTouch = false
	part.CastShadow = false
	part.Massless = true
	part.Material = Enum.Material.Neon
	part.Size = size
	part.Color = color
	part.Transparency = transparency
	part.CFrame = cframe
	return part
end

local function tween(instance: Instance, duration: number, goal: { [string]: any }, style: Enum.EasingStyle?, direction: Enum.EasingDirection?)
	local info = TweenInfo.new(duration, style or Enum.EasingStyle.Quad, direction or Enum.EasingDirection.Out)
	TweenService:Create(instance, info, goal):Play()
end

local function groundY(origin: Vector3): number
	local params = RaycastParams.new()
	params.FilterType = Enum.RaycastFilterType.Exclude
	local ignore: { Instance } = { getFolder() }
	for _, player in game:GetService("Players"):GetPlayers() do
		if player.Character then
			table.insert(ignore, player.Character)
		end
	end
	params.FilterDescendantsInstances = ignore
	local hit = Workspace:Raycast(origin + Vector3.new(0, 4, 0), Vector3.new(0, -40, 0), params)
	return if hit then hit.Position.Y else origin.Y - 3
end

-- the snowflake the cold gathers into: six arms, spinning and growing
local function playSnowflake(folder: Folder, center: Vector3)
	local arms: { BasePart } = {}
	for _ = 1, 6 do
		local arm = newPart("Part", Vector3.new(0.2, 0.2, 0.5), palette[7], 0, CFrame.new(center))
		arm.Parent = folder
		table.insert(arms, arm)
	end
	local start = os.clock()
	local connection: RBXScriptConnection
	connection = RunService.Heartbeat:Connect(function()
		local t = (os.clock() - start) / Config.ChargeTime
		if t >= 1 then
			connection:Disconnect()
			for _, arm in arms do
				arm:Destroy()
			end
			return
		end
		local length = 0.6 + 3.2 * t
		local spin = t * t * 14
		for index, arm in arms do
			arm.Size = Vector3.new(0.2, 0.2, length)
			arm.CFrame = CFrame.new(center) * CFrame.Angles(0, spin + index * math.pi / 3, 0) * CFrame.new(0, 0, -length / 2)
		end
	end)
end

local function playFlash(folder: Folder, center: Vector3, radius: number)
	local flash = newPart("Part", Vector3.new(2, 2, 2), palette[8], 0.1, CFrame.new(center))
	flash.Shape = Enum.PartType.Ball
	flash.Parent = folder
	local light = Instance.new("PointLight")
	light.Color = palette[6]
	light.Brightness = 8
	light.Range = radius
	light.Parent = flash
	tween(flash, 0.3, { Size = Vector3.new(radius * 0.6, radius * 0.6, radius * 0.6), Transparency = 1 })
	tween(light, 0.5, { Brightness = 0 })
end

-- flat discs lie on the floor: cylinders point along X, so roll them onto their side
local function disc(floorY: number, center: Vector3, thickness: number, diameter: number, color: Color3, transparency: number): BasePart
	local part = newPart(
		"Part",
		Vector3.new(thickness, diameter, diameter),
		color,
		transparency,
		CFrame.new(center.X, floorY + thickness / 2, center.Z) * CFrame.Angles(0, 0, math.pi / 2)
	)
	part.Shape = Enum.PartType.Cylinder
	return part
end

local function playShockwave(folder: Folder, center: Vector3, floorY: number, radius: number)
	local ring = disc(floorY + 0.1, center, 0.4, 2, palette[6], 0.2)
	ring.Parent = folder
	tween(ring, Config.SpreadTime, { Size = Vector3.new(0.4, radius * 2, radius * 2), Transparency = 0.9 })

	-- frost that creeps across the floor behind the wave, then melts away
	local crust = disc(floorY, center, 0.15, 2, palette[7], 0.5)
	crust.Material = Enum.Material.Ice
	crust.Parent = folder
	tween(crust, Config.SpreadTime, { Size = Vector3.new(0.15, radius * 2, radius * 2), Transparency = 0.35 })
	task.delay(Config.MeltStart - Config.ChargeTime, function()
		tween(crust, Config.MeltTime, { Transparency = 1 })
	end)
end

local function playSnow(folder: Folder, center: Vector3, floorY: number, radius: number)
	local emitterPart = newPart("Part", Vector3.new(radius * 2, 0.2, radius * 2), palette[6], 1, CFrame.new(center.X, floorY + 4, center.Z))
	emitterPart.Parent = folder

	local emitter = Instance.new("ParticleEmitter")
	emitter.Texture = SPARKLE
	emitter.Color = ColorSequence.new(palette[6], palette[8])
	emitter.LightEmission = 0.8
	emitter.Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.5), NumberSequenceKeypoint.new(1, 0) })
	emitter.Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0), NumberSequenceKeypoint.new(1, 1) })
	emitter.Lifetime = NumberRange.new(1.2, 2.2)
	emitter.Speed = NumberRange.new(1, 4)
	emitter.SpreadAngle = Vector2.new(180, 180)
	emitter.Acceleration = Vector3.new(0, -2, 0)
	emitter.Rate = 0
	emitter.Parent = emitterPart

	emitter:Emit(80)
	local drift = Config.MeltStart - Config.ChargeTime
	emitter.Rate = 30
	task.delay(drift, function()
		emitter.Rate = 0
	end)
end

local function playCrystals(folder: Folder, center: Vector3, floorY: number, radius: number)
	local rng = Random.new(Config.Seed)
	for ringIndex, ring in Config.Rings do
		local color = if ringIndex == 1 then palette[6] elseif ringIndex == 2 then palette[5] else palette[4]
		for i = 1, ring.count do
			local reach = rng:NextNumber(ring.reachMin, ring.reachMax) * radius
			local angle = (i / ring.count) * math.pi * 2 + rng:NextNumber(-0.25, 0.25)
			local height = rng:NextNumber(ring.height[1], ring.height[2])
			local width = rng:NextNumber(ring.width[1], ring.width[2])
			local tilt = math.rad(rng:NextNumber(0, 14))

			local base = Vector3.new(center.X + math.cos(angle) * reach, floorY, center.Z + math.sin(angle) * reach)
			local facing = CFrame.new(base) * CFrame.Angles(0, -angle + math.pi / 2, 0) * CFrame.Angles(-tilt, 0, 0)

			local crystal = newPart("WedgePart", Vector3.new(width * 0.6, height, width), color, 0.15, facing * CFrame.new(0, -height / 2, 0))
			crystal.Parent = folder

			local appearAt = Config.ChargeTime + (reach / radius) * Config.SpreadTime
			local meltAt = Config.MeltStart + rng:NextNumber(0, 0.4)
			task.delay(appearAt, function()
				tween(crystal, 0.2, { CFrame = facing * CFrame.new(0, height / 2, 0) }, Enum.EasingStyle.Back, Enum.EasingDirection.Out)
			end)
			task.delay(meltAt, function()
				tween(crystal, Config.MeltTime, {
					Transparency = 1,
					CFrame = facing * CFrame.new(0, -height * 0.3, 0),
				}, Enum.EasingStyle.Quad, Enum.EasingDirection.In)
			end)
		end
	end
end

-- origin: the caster's position when the ultimate was cast
function FrostBurst.play(origin: Vector3)
	local radius = Config.Radius
	local floorY = groundY(origin)
	local center = Vector3.new(origin.X, floorY + CORE_HEIGHT, origin.Z)

	local folder = Instance.new("Folder")
	folder.Name = "FrostNova"
	folder.Parent = getFolder()
	Debris:AddItem(folder, Config.MeltStart + Config.MeltTime + 1.5)

	playSnowflake(folder, center)
	task.delay(Config.ChargeTime, function()
		playFlash(folder, center, radius)
		playShockwave(folder, center, floorY, radius)
		playSnow(folder, center, floorY, radius)
	end)
	playCrystals(folder, center, floorY, radius)
end

return FrostBurst
