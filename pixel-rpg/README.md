# Frost Wizard

A top-down pixel action RPG. You are a frost wizard with an air force on call, holding out against waves of
slimes, bats and skeleton archers, with a King Slime every fifth wave. Kill, collect gems, level up, pick an
upgrade, survive. Plays on desktop and on phones (touch controls appear by themselves).

Every effect in the game was made with [pixelfx](https://github.com/patch-gg/pixelfx) for this game, and every
sprite and sound is generated in code: there are no image or audio files.

## Play

```
cd pixel-rpg
python3 -m http.server 8000      # ES modules need a server; then open http://localhost:8000
```

Or build a single self-contained file that opens anywhere, including straight on a phone:

```
node build.mjs                   # writes dist/frost-wizard.html (uses npx esbuild)
```

### Controls

| | desktop | phone |
|---|---|---|
| move | WASD / arrows | drag on the left half of the screen (analog stick) |
| frost bolt | hold left mouse (aims at the cursor) or Space | hold **BOLT**: a tap auto-aims at the nearest enemy, dragging the button aims by hand |
| airstrike | right click or E (at the cursor) | drag **AIR**: a target appears on the ground, let go to call the jet; tap for auto-target on the biggest crowd; let go back on the button to cancel |
| ultimate | K | tap **ULT** |
| pause / sound | Esc / M | the pause button, top right |

## How it plays

- **Waves.** Each wave is bigger and tougher (+16% enemy health per wave). Clearing one heals 15% and pays a
  bonus. Every 5th wave brings the **King Slime**: it leaps to where you stand (a green target marks the spot),
  slams down and calls more slimes.
- **Enemies.** Slimes hop after you. Bats fly over trees and water, weaving. Skeleton archers keep their distance
  and shoot, and come round obstacles when they can't see you. Walkers path round lakes and tree lines (a flow
  field over the tile grid).
- **Growth.** Enemies drop gems; enough gems is a level, and each level offers 3 of 11 upgrades: bolt damage,
  fire rate, extra bolts, pierce, speed, max health, regeneration, gem magnet, ultimate power, more bombs per
  airstrike, airstrike cooldown.
- **Skills.**
  - *Frost bolt*: the basic attack; 10% critical hits for double damage.
  - *Glacier Ring* (ultimate, 12 s): a 0.4 s charge, then a ring of ice that freezes and hits everything round you.
  - *Airstrike* (15 s): a fighter jet comes in from behind you, over the target, and drops a line of bombs.
- Best score and wave are saved in the browser.

## The effects

Made with the pixelfx method (draft, render, look, refine, `check`) and kept in `vendor/pixelfx/src/fx/rpg/`.
Contact sheets are in `docs/`.

| effect | used for |
|---|---|
| `rpg/frost-bolt` | the bolt in flight (a loop, rotated to its heading) |
| `rpg/frost-hit` | a bolt landing |
| `rpg/glacier-ring` | the ultimate |
| `rpg/slime-pop` | deaths (recoloured per enemy: green slime, purple bat, bone skeleton) |
| `rpg/fighter-jet` | the airstrike jet (a loop, rotated to its course, flown at altitude with a ground shadow) |
| `rpg/airstrike-blast` | each bomb, and (recoloured green) the King Slime's slam and death |
| `rpg/strike-marker` | the airstrike target and its aiming preview, and the King Slime's landing spot |

## Files

| file | what's in it |
|---|---|
| `main.js` | boot, the frame loop, screens (title, play, level-up, pause, game over), screen fitting |
| `game.js` | the rules: player, enemies and their AI, skills, airstrikes, waves, levels, pathfinding |
| `render.js` | drawing: ground, effects behind/in front, depth-sorted sprites, the jet's shadow, bombs, HUD |
| `input.js` | keyboard, mouse and touch (stick and drag-to-aim skill buttons) |
| `ui.js` | the menus (HTML, so Korean text renders properly) and the saved best score |
| `config.js` | every tuning number, the upgrades and the wave roster |
| `audio.js` | sound effects synthesised with WebAudio |
| `sprites.js` | the wizard, enemies, King Slime, gems, bomb, hearts, trees and rocks, drawn from strings |
| `world.js` | map generation and the ground painter |
| `build.mjs` | bundles everything into `dist/frost-wizard.html` |
| `vendor/pixelfx/` | the pixelfx core (MIT, see `LICENSE` and `NOTICE.md` there) and the seven effects |

The view size follows the screen's shape at a whole number of device pixels per game pixel, so the art stays crisp
and a phone is filled edge to edge either way up.
