# Frost Wizard

A tiny top-down pixel RPG, made as a test bed for [pixelfx](https://github.com/patch-gg/pixelfx) effects.
You are a wizard. Slimes keep coming. Shoot them, freeze them, blow them up.

## Play

ES modules need a web server (opening `index.html` directly from disk won't load them):

```
cd pixel-rpg
python3 -m http.server 8000      # or: npx serve
# open http://localhost:8000
```

| key | action |
|---|---|
| WASD / arrows | move |
| J / Space | frost bolt (flies the way you face) |
| K / R | ultimate: Glacier Ring (10 s cooldown, 0.4 s charge, freezes and hits everything in the ring) |
| Enter | restart after game over |

**On a phone** the touch controls appear by themselves: drag anywhere on the left half for a floating stick, hold
BOLT to keep firing (it aims at the nearest slime), tap ULT for the ultimate. Landscape is the bigger view; tap the
screen to restart after game over. Add `?touch=1` to the URL to try them on a desktop.

Slimes chase you when you get close, hop at you and hurt on touch. Some drop a heart (+15 HP).

## The effects

The four effects were written for this game with the pixelfx method (draft, render, look, refine, check)
and live in `vendor/pixelfx/src/fx/rpg/`. Contact sheets are in `docs/`.

| effect | used for | file |
|---|---|---|
| `rpg/frost-bolt` | the bolt in flight (loop, rotated to its heading) | `docs/fx-frost-bolt.png` |
| `rpg/frost-hit` | the bolt landing on a slime or a wall | `docs/fx-frost-hit.png` |
| `rpg/glacier-ring` | the ultimate (sigil, flash, ring of ice, three rows of crystals, melt) | `docs/fx-glacier-ring.png` |
| `rpg/slime-pop` | a slime dying | `docs/fx-slime-pop.png` |

They are drawn into pixelfx frames in world coordinates (`main.js`: `createFx`, `fx.draw(frame, "back" | "front")`,
`composite`), so they sort behind and in front of the characters.

To tweak one, edit its file and reload. To iterate with the pixelfx tools, copy the file into a pixelfx checkout's
`src/fx/rpg/` and run `node tools/render.mjs rpg/<name> --zoom 3` and `node tools/check.mjs "rpg/*"`.

## Files

- `main.js` game loop, input, combat, HUD
- `world.js` map generation and the ground painter
- `touch.js` the touch stick and buttons
- `sprites.js` the wizard, slime, heart, tree and rock, drawn from strings
- `vendor/pixelfx/` the pixelfx core (MIT, see `LICENSE` and `NOTICE.md` there) and the four effects

Everything is code: there are no image files in the game itself.
