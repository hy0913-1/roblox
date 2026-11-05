#!/usr/bin/env python3
"""Turn the raw SpriteCook sheets in assets-src/ into the game's assets/ folder + assets/manifest.json.

  cd pixel-rpg && python3 -I tools/make_assets.py          # rebuilds everything listed in SHEETS

Each sheet entry: file, grid (cols, rows), colours, and a list of cells in reading order. A cell says where it goes
in the game (`kind`) and how tall it should be. The second animation frame is made here (a small bob / step / squash),
because one generated pose per creature is much cheaper than a generated animation.  Needs Pillow + numpy.
"""
import json, os, sys
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sheet import cells, shrink, outline, quantise  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC, OUT = os.path.join(ROOT, "assets-src"), os.path.join(ROOT, "assets")


# ---- second frames -------------------------------------------------------------------------------
def bob(a):
    """breathing / marching bob: drop one row from the middle, the feet stay on the ground line"""
    h = a.shape[0]
    cut = max(2, int(h * 0.55))
    return np.concatenate([a[:cut], a[cut + 1:]], 0) if h > 8 else a


def step(a):
    """walk: the left foot lifts a pixel (the bottom 3 rows of the left half move up)"""
    b = a.copy()
    h, w = a.shape[:2]
    half = w // 2
    low = slice(h - 3, h)
    b[h - 4:h - 1, :half] = a[low, :half]
    b[h - 1, :half] = 0
    # keep the row above the lifted foot as it was
    return b


def squash(a, kx=1.14, ky=0.78):
    h, w = a.shape[:2]
    nh, nw = max(2, round(h * ky)), max(2, round(w * kx))
    im = Image.fromarray(a, "RGBA").resize((nw, nh), Image.NEAREST)
    return np.asarray(im)


FRAMES = {"bob": bob, "step": step, "squash": squash}


def trim(a):
    ys, xs = np.where(a[..., 3] > 0)
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def save(name, arr):
    os.makedirs(OUT, exist_ok=True)
    Image.fromarray(arr, "RGBA").save(os.path.join(OUT, name + ".png"))
    return name + ".png"


def process(sheet, manifest):
    im = Image.open(os.path.join(SRC, sheet["file"])).convert("RGBA")
    boxes = cells(np.asarray(im)[..., 3], *sheet["grid"])
    raw, scales = [], {}
    for i, (x0, y0, x1, y1) in enumerate(boxes):
        cell = sheet["cells"][i] if i < len(sheet["cells"]) else None
        if not cell:
            raw.append(None)
            continue
        crop = im.crop((x0, y0, x1 + 1, y1 + 1))
        if "like" in cell:
            k = scales[cell["like"]]
            size = (max(1, round(crop.width * k)), max(1, round(crop.height * k)))
        else:
            k = cell["h"] / crop.height
            size = (max(1, round(crop.width * k)), cell["h"])
        scales[i] = k
        raw.append(outline(shrink(crop, size), 0.72))
    live = [r for r in raw if r is not None]
    pal = quantise(live, sheet.get("colors", 120))
    it = iter(pal)
    for cell, r in zip(sheet["cells"], raw):
        if r is None:
            continue
        a = next(it)
        kind, key = cell["kind"], cell["key"]
        fr = FRAMES[cell.get("frame", "bob")]
        b = fr(a)
        if kind == "hero":  # key = class.direction
            cls, d = key.split(".")
            files = [save(f"hero_{cls}_{d}_a", a), save(f"hero_{cls}_{d}_b", b)]
            manifest.setdefault("hero", {}).setdefault(cls, {})[d] = files
        elif kind == "prop":  # one image, no second frame
            manifest.setdefault("prop", {})[key] = [save(f"prop_{key}", a)]
        elif "." in key:  # key.a / key.b: the two frames come from two cells (e.g. drake wings up / down)
            base, fr = key.split(".")
            manifest.setdefault(kind, {}).setdefault(base, [None, None])[0 if fr == "a" else 1] = save(f"{kind}_{base}_{fr}", a)
        else:
            files = [save(f"{kind}_{key}_a", a), save(f"{kind}_{key}_b", b)]
            manifest.setdefault(kind, {})[key] = files
        print(kind, key, a.shape[1], "x", a.shape[0])


HERO_H = 28
SHEETS = [
    {
        "file": "heroes.png", "grid": (4, 3), "colors": 120,
        "cells": [{"kind": "hero", "key": f"{c}.{d}", "h": HERO_H, "frame": "step"} for d in ("down", "up", "right") for c in ("mage", "knight", "ranger", "thief")],
    },
]
if os.path.exists(os.path.join(os.path.dirname(os.path.abspath(__file__)), "sheets_extra.py")):
    from sheets_extra import SHEETS as EXTRA  # noqa: E402
    SHEETS += EXTRA

if __name__ == "__main__":
    manifest = {"version": 1}
    for sh in SHEETS:
        if os.path.exists(os.path.join(SRC, sh["file"])):
            process(sh, manifest)
    with open(os.path.join(OUT, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=1)
    print("manifest:", {k: len(v) for k, v in manifest.items() if isinstance(v, dict)})
