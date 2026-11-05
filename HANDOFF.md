# Frost Wizard: handoff for a new session

Read this first. It says what exists, how to run and test it, what is unfinished, and what to do next.
Everything lives on branch **`claude/pixel-rpg`** of `hy0913-1/roblox` (the repo's `main` has only the first commit).

## The first message to paste into the new session

> 저장소 hy0913-1/roblox의 `claude/pixel-rpg` 브랜치를 체크아웃하고 `HANDOFF.md`를 읽어 줘. pixel-rpg 게임의 그림을 SpriteCook으로 만들어서 게임에 적용하고 싶어. 먼저 SpriteCook 도구가 연결됐는지 확인하고, 연결돼 있으면 HANDOFF.md의 "그림 작업 계획" 순서대로 진행해 줘. 질문은 하지 말고 진행해.

(The user previously said: permissions are all granted, don't ask permission questions, work autonomously.)

## What the project is

A top-down pixel RPG for browsers and phones, in `pixel-rpg/`. Plain ES modules, no framework, no image or audio files:
every sprite is drawn from strings or shapes in code, every sound is synthesised, every effect is a
[pixelfx](https://github.com/patch-gg/pixelfx) effect. The page `index.html` is the whole UI shell (Korean text, menus in HTML).

Also in the repo: a small Roblox/Rojo project at the root (`default.project.json`, `src/`), the first thing built; unrelated to the game.

Published copy (private artifact, the owner's account): https://claude.ai/artifact/ARWCyqJcSknRQVVqEbjCpy
It is the single-file build, republished with the `Artifact` tool using the same file path each time (see "Publishing").

## Run it

```
cd pixel-rpg
python3 -m http.server 8765      # ES modules need a server; open http://localhost:8765
node build.mjs                   # bundles everything into dist/frost-wizard.html (+ .fragment.html), uses npx esbuild
```

`?touch=1` forces the touch controls on a desktop, `?touch=0` forces them off.
In the cloud sandbox, start the server with the Bash tool's `run_in_background: true` and a long `timeout`;
it dies when a worker restarts, so restart it before browser tests.

## Game summary (what is implemented)

- 4 classes (mage, knight, ranger, thief), each with a basic attack and 3 skills (Lv 1/1/3/5 unlocks),
  a 2nd job at Lv 10 (two branches) and a 3rd job at Lv 20, each adding a skill. Plus the airstrike (a fighter jet
  drops bombs) unlocked by the 2nd main quest. 7 skill slots: `0` basic, `1-3` class, `4-5` job, `6` airstrike.
- Places: village (safe) → forest → cave (King Slime), crypt (Lich); forest → highlands (Orc Chief field boss) →
  volcano (Fire Drake), ice cave (Frost Giant), Demon King's tower (Bael, 3 phases).
- 7 main quests + 2 job trials + 4 side quests + endless bounties. NPCs: elder, merchant, guard captain, kid,
  job master, blacksmith, bounty board, wandering merchant (event).
- Items: 5 equipment slots, 6 tiers, 5 rarities with prefixes, named uniques, blacksmith enhancement +10, potions.
- Events: day/night, blood moon, rain, golden slime, treasure goblin, wandering merchant, village raids.
- Saves to `localStorage` (`frostwizard.rpg.save`), old saves are migrated field by field in `loadGame`.
- Touch: floating stick on the left; skill buttons you tap (auto-aim) or press and drag (aim; ground skills show a
  target marker). Desktop: WASD, mouse aim, J/left click, Q E R T G skills, F/right click airstrike, 1 2 potions, Space, I, M, Esc.

## Files (all in `pixel-rpg/`)

| file | role |
|---|---|
| `index.html` | page, CSS, every overlay (title, class, dialog, bag, shop, smith, pause, dead, ending), touch buttons |
| `main.js` | boot, frame loop, screens, interaction, `fit()` (view size follows the screen at whole device pixels) |
| `game.js` | state `G`, scenes and travel, stats and jobs, items, loot, quests, bounties, world events, saving, pathfinding (flow field) |
| `enemies.js` | monster behaviours and the six bosses |
| `skills.js` | movement, aiming, every skill, the airstrike |
| `render.js` | drawing: floor, effects, depth-sorted sprites, darkness, HUD, minimap; `scaledLayer` draws library effects smaller |
| `ui.js` | menus and the live HTML HUD |
| `input.js` | keyboard, mouse, touch |
| `config.js` | **all data**: classes, jobs, skills, items, enemies, quests, shop, NPCs. Change numbers here |
| `world.js` | the village, forest, highlands, dungeon generator, tile painter |
| `art.js`, `sprites.js` | all pixel art, drawn from strings and shapes |
| `audio.js` | WebAudio sfx and per-area music |
| `build.mjs` | single-file bundler |
| `vendor/pixelfx/` | pixelfx core + the effects used (MIT, see its LICENSE/NOTICE) |
| `docs/` | contact sheets of the custom effects |

`window.__game = { G, input, show, newGame, toTitle }` is exposed for tests.

### Effects

Custom ones, written for this game with the pixelfx method, in `vendor/pixelfx/src/fx/rpg/`: frost-bolt, frost-hit,
glacier-ring, blink, blizzard, sword-arc, spin-slash, arrow, arrow-rain, shuriken, slime-pop, level-up, chest-burst, heal,
portal, fighter-jet, airstrike-blast, strike-marker. Library ones used straight (drawn at about half size via
`addFx(mod, { scale })`): fire, ice, holy, melee, lightning, nature, shadow, status, explosions, arcane categories.
To make or change one: the `pixelfx` skill is in `.claude/skills/pixelfx/`; clone `https://github.com/patch-gg/pixelfx`
next to the repo, copy the file into its `src/fx/rpg/`, iterate with `node tools/render.mjs rpg/<name> --zoom 3` and
`node tools/check.mjs "rpg/*"`, then copy back into `pixel-rpg/vendor/pixelfx/src/fx/rpg/`.

## How it was tested (and how to again)

No automated test suite. Tests were Playwright scripts (Chromium is preinstalled; `require('playwright')` works)
driving the page and `window.__game`, plus screenshots read back. Useful patterns:

- Desktop `1000x600`, phone `844x390` / `390x844` with `hasTouch: true, isMobile: true`, and real touches through a CDP
  session (`Input.dispatchTouchEvent`), because a quick tap and a hold behave differently.
- Jump around: `const g = await import('./game.js'); g.newGame('mage'); g.enterScene('tower','start')`, set
  `G.player.lv`, `G.job = { rank: 3, branch: 'frost' }`, `G.keys.radio = 1`, big `G.stats.maxHp`.
- Cast every slot with `page.keyboard.press('KeyQ'|'KeyE'|'KeyR'|'KeyT'|'KeyG'|'KeyF')`.
- A bot that holds the basic attack and walks to the nearest enemy exposed balance problems early
  (two 3-minute runs got a knight and a mage to Lv 4-5 with no deaths).

Last verified: all 8 class/branch combos cast all 7 slots without errors; all 6 bosses reach their patterns and die;
events, raid, bounty board, blacksmith, job branch choice, bag screen; no console errors.

## Known gaps and ideas (not done)

- **Never played start to finish by hand.** Late-game balance (Lv 20+ bosses, enhancement odds, shop prices) is a guess.
- All art is code-drawn at 14-18px tall. The user wants better art (see below).
- Ideas not started: pets, a second map for the highlands town, skill upgrade points, a proper pause-menu settings
  page, gamepad support, a larger map for the forest, achievements, NG+ after the ending.
- `README.md` in `pixel-rpg/` describes the game for players; this file is for the next maintainer.

## 그림 작업 계획 (art plan, the next job)

The user asked to use **SpriteCook** (an AI sprite service) to replace the code-drawn art. In the previous session
the plugin was switched on at claude.ai (Settings → Plugins → Spritecook, with 10 skills and the `spritecook` MCP
connector) but the session had started earlier and never loaded its tools, so nothing was generated.
The skills are already vendored in `.claude/skills/spritecook-*`, with their rules in
`.claude/skills/spritecook-workflow-essentials/SKILL.md`; read it. In short: call `get_credit_balance` first; never ask
for or print API keys; generation is async (poll `check_job_status`); save `asset_id`s in a manifest.

**If the SpriteCook tools are not present in the new session**, say so, do not fake it, and do something useful
instead: build the image-loading path (below) so PNGs dropped into `pixel-rpg/assets/` are used automatically.

### Image-loading path to build first (works with any source of PNGs, SpriteCook or GPT)

`art.js` and `sprites.js` build every sprite as an off-screen canvas. Add `assets.js`: `loadAssets()` fetches a
manifest `assets/manifest.json` (id → file, frame size, frames), draws each PNG into a canvas, and **replaces** the
matching entry (`SPRITES.wizard`, `HEROES.knight`, `ENEMY_ART.wolf`, `BOSS_ART.drake`, `NPC_ART.elder`, `ICONS.staff`,
tile atlas for `world.js`'s `paint()`, `HOUSES`, `CHESTS`...). Anything not in the manifest keeps its code-drawn fallback.
Call it before `toTitle()` in `main.js` and bump `build.mjs` to inline PNGs as data URIs for the single-file build
(the artifact page cannot load other files, only inline `data:` URLs; mind the 16 MB page limit).

### What to generate, in this order (sizes are what the code expects; scale the AI output down with nearest-neighbour)

1. **Heroes**, one sheet each for mage, knight, ranger, thief. Frame about 16x20 px (the code's frames are 14 wide, 16-17
   tall). Directions: down, up, side (the game mirrors it for left). 2 walk frames each. Transparent background.
   Same palette family per class: mage purple robe and hat, knight steel and blue, ranger green and brown, thief dark violet.
2. **Villagers**: elder, merchant (also reused tinted as the wanderer), guard captain, kid, job master (hooded sage),
   blacksmith, bounty board. Idle 2 frames, about 14x16.
3. **Monsters** (2 frames each, `a`/`b`): slime (exists in 2 squash frames, 14x10/14x8), bat, skeleton archer/warrior,
   wolf, orc, rock golem, ice golem, fire imp, magma slime, golden slime, yeti, demon soldier, gargoyle, treasure goblin.
4. **Bosses** (2 frames, about 28-60 px): King Slime, Lich, Orc Chief, Fire Drake (flying, wings up/down), Frost Giant,
   Bael the Demon King. Each needs a recognisable silhouette.
5. **Tilesets**, 16x16: grass, dirt path, water, cobblestone, dry highland grass, cave floor and wall, crypt floor and
   wall, volcano floor and wall, lava, ice floor and wall, demon-tower floor and wall. SpriteCook has a tileset skill
   (`spritecook-generate-tilesets`) and a dual-grid autotile guide (`spritecook-use-dual-grid-tilesets`); the current
   `world.js` paints per-tile noise, so start with plain 16x16 tiles and add autotiling edges only if time allows.
6. **Props**: houses (3 roof colours, 56x52), well, fence, signpost, trees (3 variants, 26x34), rocks, graves, pillar,
   cave mouth, crypt gate (closed/open), tent, palisade stake, anvil, chests (wood/gold, closed/open).
7. **Item icons**, 12x12: staff, sword, bow, dagger, helmet, armor, boots, ring, amulet, charm, potions (red, blue),
   elixir, scroll, wing, doll, radio, ore, token. Rarity is shown by the border colour in the UI, not the icon.
8. **UI** (optional, last): HUD panel frame, skill button frames, bag cells. UI is HTML/CSS now; a kit would mean
   restyling `index.html`.

Style brief for every prompt: pixel art, limited palette (16-32 colours), 1 px dark outline, light from the top-left,
no anti-aliasing, transparent background, top-down 3/4 view like classic 16-bit RPGs. Reuse a design's `asset_id`
when asking for another pose so a character stays consistent.

## Environment notes (the cloud sandbox)

- `/plugin` slash commands do not work in cloud sessions; MCP/plugin tools are fixed when the session starts.
- No `gh`; GitHub through the `mcp__github__*` tools (these drop out and come back; the repo scope is `hy0913-1/roblox`).
- Do not create a PR unless asked. Commit and push to `claude/pixel-rpg`. The stop hook nags about uncommitted changes.
- When patching big files with Python `str.replace`, assert each `old` occurs exactly once, and put multi-edit patch
  scripts in the scratchpad directory; one failed assertion aborts the whole patch (it did once).
- Publishing: `node build.mjs`, copy `dist/frost-wizard.fragment.html` to a file in the scratchpad (the artifact
  wrapper adds the html/head/body), then `Artifact` publish with that same path; republishing the same path keeps the URL.
  Do a file-open smoke test first: wrap the fragment in a bare HTML shell and load it in Playwright with no server.
- Commit trailers: end commit messages with the attribution lines the system reminder gives.

## Working style the user wants

Korean replies, plain and concrete, say what was verified and what was not. Do not ask permission questions
("권한 허용질문은 하지 말고"). Make the game richer and higher quality; they care about phone play. They said
they can produce art with GPT if needed: ask for specific sheets with the sizes above only if SpriteCook is not available.
