# Frost Wizard

A top-down pixel RPG. Pick a class, take quests from the villagers, clear the forest, the Slime Cave and the Old
Crypt, open chests, collect gear, and call in the air force when it gets bad. Plays on desktop and on phones
(touch controls appear by themselves). Progress saves automatically in the browser.

Every effect was made with [pixelfx](https://github.com/patch-gg/pixelfx) for this game, and every sprite and sound
is generated in code: there are no image or audio files.

## Play

```
cd pixel-rpg
python3 -m http.server 8000      # ES modules need a server; then open http://localhost:8000
node build.mjs                   # or build dist/frost-wizard.html, one file that opens anywhere (uses npx esbuild)
```

| | desktop | phone |
|---|---|---|
| move | WASD / arrows | drag on the left of the screen |
| basic attack | hold left mouse (aims at the cursor) or J | hold the big button: auto-aims; drag it to aim by hand |
| skills | Q, E, R (at the cursor) | tap = auto-aim; drag = aim (direction skills show a line, ground skills a target) |
| airstrike (after the 2nd main quest) | F or right click | the orange button, same as the skills |
| potions | 1 (HP), 2 (MP) | the red and blue buttons |
| talk / open / read | Space | the yellow button that appears |
| bag, quests | I | BAG, top right |
| map, pause | M, Esc | the map is top right; pause button |

## The game

**Classes** (chosen at the start):

| class | basic | Lv 1 | Lv 3 | Lv 5 |
|---|---|---|---|---|
| Mage (마법사) | Frost bolt | Glacier Ring: freeze everything round you | Blink: teleport | Blizzard: a storm on a spot for 4 s |
| Knight (전사) | Sword slash | Spin slash | Dash: charge through enemies | Ground slam: stuns |
| Ranger (궁수) | Arrow | Piercing shot | Arrow rain on a spot | Fan of seven arrows |

All classes get the **airstrike** (a fighter jet drops a line of bombs) from the second main quest's reward.
Skills cost MP; MP and HP refill slowly (HP only out of combat).

**Places.** The village (safe; the elder, the merchant, the guard, a kid), the forest (monsters come back over
time; chests; a lake), the Slime Cave and the Old Crypt (generated rooms and corridors, dark with torches,
monsters per room, chests, a boss in the far room; a portal opens there once the boss is down). The crypt stays
sealed until the second main quest is done.

**Quests.** Main: clear 8 slimes → defeat the King Slime → defeat the Lich (the ending). Side: bat wings for the
merchant, skeleton archers for the guard, the kid's lost doll. NPCs show `!` for a new quest and `?` when you can
report one.

**Items.** Weapons (per class), armour and trinkets in five rarities (common to legendary) with rolled stats;
potions; quest items. Drops from monsters, chests (gold chests in boss rooms) and quest rewards. The merchant
buys and sells. Dying sends you back to the village and costs 10% of your gold.

**Enemies.** Slimes, bats (fly over trees and water), skeleton archers (keep their distance, need line of sight),
skeleton warriors (wind up and swing), the King Slime (leaps onto you, calls slimes) and the Lich (fans of shadow
bolts, summons skeletons, blinks away; fiercer below half health). Walkers find their way round obstacles with a
flow field over the tile grid.

## The effects

Made with the pixelfx method (draft, render, look, refine, `check`) and kept in `vendor/pixelfx/src/fx/rpg/`.
Contact sheets are in `docs/`.

| effect | used for |
|---|---|
| `frost-bolt`, `frost-hit`, `glacier-ring`, `blink`, `blizzard` | the mage (frost-bolt recoloured is also the Lich's shadow bolt) |
| `sword-arc`, `spin-slash` | the knight (the dash and ground slam reuse `frost-hit` and `airstrike-blast` in gold and earth) |
| `arrow`, `arrow-rain` | the ranger (the piercing shot is a glowing gold arrow) |
| `fighter-jet`, `airstrike-blast`, `strike-marker` | the airstrike, the aiming marker, the King Slime's landing spot and slam |
| `slime-pop` | deaths, recoloured per monster |
| `level-up`, `chest-burst` (coloured by loot rarity), `heal` (green HP, blue MP), `portal` | the RPG bits |

## Files

| file | what's in it |
|---|---|
| `main.js` | boot, the frame loop, screens, interaction, screen fitting |
| `game.js` | the rules: scenes and travel, stats, enemies and their AI, projectiles, loot, levels, quests, saving |
| `skills.js` | moving, aiming and every skill, the airstrike |
| `render.js` | drawing: floor, effects, sorted sprites, darkness and torchlight, HUD, minimap |
| `ui.js` | class choice, dialogue, bag/equipment/quests, shop, pause, death, ending, the live HUD text |
| `input.js` | keyboard, mouse and touch (stick, tap-or-drag skill buttons) |
| `config.js` | classes, skills, items, enemies, quests, the shop: every number |
| `world.js` | the village, the forest, the dungeon generator, the floor painter |
| `art.js`, `sprites.js` | all the pixel art, drawn from strings and shapes |
| `audio.js` | sound effects synthesised with WebAudio |
| `build.mjs` | bundles everything into `dist/frost-wizard.html` |
| `vendor/pixelfx/` | the pixelfx core (MIT, see `LICENSE` and `NOTICE.md` there) and the effects |
