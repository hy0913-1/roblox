# Wizard Ultimate: Frost Nova

Roblox (Rojo) project. Press **R** to cast the wizard's ultimate: a spinning snowflake gathers, bursts into a
shockwave and three rings of ice crystals, snow drifts down, and the ice melts back into the floor.
Anyone caught in the radius takes damage and is slowed.

The look and timing follow the pixelfx effect `ice/frost-nova` (https://github.com/patch-gg/pixelfx).
`docs/frost-nova-reference.png` is its contact sheet. pixelfx outputs 2D sprite sheets, so this version rebuilds
the effect in 3D from parts, tweens and `ParticleEmitter`.

## Run

```
rojo serve        # then connect from Studio's Rojo plugin
# or: rojo build -o WizardUltimate.rbxlx
```

## Layout

| file | where it runs | what it does |
|---|---|---|
| `src/shared/UltimateConfig.luau` | both | cooldown, radius, damage, timings, palette, crystal rings |
| `src/shared/FrostBurst.luau` | client | the visual effect only |
| `src/server/WizardUltimate.server.luau` | server | validates the cast, enforces cooldown, damage + slow |
| `src/client/UltimateClient.client.luau` | client | R key, plays the effect when the server says so |

The client sends no data with the request. The server takes the origin from the caster's server-side
character, so a client cannot choose where the nova lands.

## Tuning

Everything is in `UltimateConfig.luau`. Palette, `Rings` and the timings come from the pixelfx effect; change
`Palette` to recolor it (a fire nova, a poison nova).

## Not tested in Studio

The code was written without a Roblox runtime or Luau analyzer available. Open it in Studio and check the
Output window before relying on it.
