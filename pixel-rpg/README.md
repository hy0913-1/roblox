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

**Classes and jobs** (MapleStory-style advancements: the 2nd job at Lv 10 branches into one of two paths, the 3rd
job at Lv 20 continues it; each adds a skill, damage and stats; the job master in the village runs the trials):

| class | skills (Lv 1/1/3/5) | 2nd job (Lv 10) → 3rd job (Lv 20) |
|---|---|---|
| Mage 마법사 | frost bolt, glacier ring, blink, blizzard | 빙결술사 (ice lances) → 서리의 군주 (absolute zero) · 화염술사 (fireball) → 불꽃의 대마법사 (meteor) |
| Knight 전사 | slash, spin, dash, ground slam | 버서커 (rage) → 워로드 (earth cleave) · 나이트 (aegis) → 팔라딘 (judgment) |
| Ranger 궁수 | arrow, piercing shot, arrow rain, fan | 헌터 (explosive arrow) → 보우마스터 (arrow storm) · 저격수 (snipe) → 신궁 (thunder arrows) |
| Thief 도적 | throwing star, double stab, stealth, poison mist | 어쌔신 (star storm) → 나이트로드 (dark vortex) · 시프 (assault) → 섀도어 (eclipse) |

All classes get the airstrike from the second main quest. Desktop keys: J/left mouse, Q E R, T G (job skills),
F/right mouse (airstrike), 1 2 potions, Space talk, I bag, M map, Esc pause.

**World.** Village → forest (cave, crypt) → highlands (orc camp) → volcano, ice cave → the Demon King's tower.
Dungeons are generated rooms and corridors with torches, lava, chests and a boss in the far room.

**Bosses.** King Slime (leaps, summons), Lich (shadow fans, skeletons, blinks), Orc Chief (charges, calls
warriors), Fire Drake (fire breath, fireball rain, dives), Frost Giant (ice-spike lines, snowballs, golems),
Bael the Demon King (three phases: shadow fans and demons, meteors, a black hole).

**Story.** Seven main quests from the elder and the guard captain to the Demon King, two job trials, four side
quests, and a bounty board with endless bounties.

**Items.** Weapon, helmet, armour, boots, trinket; six tiers; five rarities with rolled prefixes (sharp, mighty,
sturdy, vital, wise, swift, vampiric); named legendaries from bosses; the blacksmith enhances gear to +10 (failure
costs only gold); potions, greater potions, an elixir of strength and a return scroll.

**Events.** Day and night (more and stronger monsters at night), the blood moon (+50% XP), rain, golden slimes,
the treasure goblin (hit it before it escapes), the wandering merchant with rare stock, and raids on the village.

**Music and sound** are synthesised: a chiptune per area and a faster one for bosses and raids.

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
| `game.js` | the rules: scenes and travel, jobs and stats, items, loot, levels, quests, bounties, events, day and night, saving |
| `enemies.js` | monster behaviours and the six bosses |
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
