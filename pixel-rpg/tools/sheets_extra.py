# sheet layouts for everything after the heroes (imported by make_assets.py)
def c(kind, key, h, frame="bob"):
    return {"kind": kind, "key": key, "h": h, "frame": frame}

SHEETS = [
    {  # monsters.png: 4 x 4, reading order
        "file": "monsters.png", "grid": (4, 4), "colors": 120,
        "cells": [
            c("sprite", "slime", 12, "squash"), c("sprite", "bat", 11, "squash"), c("sprite", "archer", 20), c("enemy", "wolf", 15),
            c("enemy", "orc", 22), c("enemy", "golem", 24), c("enemy", "icegolem", 24), c("enemy", "imp", 16),
            c("enemy", "magma", 12, "squash"), c("enemy", "goldslime", 12, "squash"), c("enemy", "yeti", 26), c("enemy", "demon", 24),
            c("enemy", "gargoyle", 22), c("enemy", "goblin", 17), c("sprite", "skeleton", 20), c("sprite", "king", 34, "squash"),
        ],
    },
    {  # village.png: 4 x 4, reading order
        "file": "village.png", "grid": (4, 4), "colors": 120,
        "cells": [
            c("npc", "elder", 21), c("npc", "merchant", 20), c("npc", "guard", 26), c("npc", "kid", 17),
            c("npc", "jobmaster", 21), c("npc", "smith", 23), c("npc", "board", 26), c("prop", "lich", 32),
            c("boss", "drake.a", 46), {"kind": "boss", "key": "drake.b", "like": 8}, c("prop", "tree0", 34), c("prop", "tree1", 36),
            c("prop", "chest_wood", 14), c("prop", "chest_woodOpen", 16), c("prop", "house0", 52), c("prop", "well", 30),
        ],
    },
]
