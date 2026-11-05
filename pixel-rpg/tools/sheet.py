#!/usr/bin/env python3
"""Slice a SpriteCook grid sheet into game-sized sprites.

  python3 -I tools/sheet.py heroes raw/heroes.png assets/heroes --cols 4 --rows 3 --height 24

Steps: find each cell's bounding box from the alpha channel, scale every cell by ONE shared factor (so relative
sizes survive), box-filter down, cut alpha at 50 %, quantise to a shared palette (no dithering), then re-draw a
1 px dark outline on the outer edge so the sprite reads at small size. Needs Pillow + numpy.
"""
import argparse, json, os
import numpy as np
from PIL import Image


def runs(v, gap=1):
    out, s, last = [], None, None
    for i, x in enumerate(v):
        if x:
            if s is None:
                s = i
            last = i
        elif s is not None and i - last > gap:
            out.append((s, last))
            s = None
    if s is not None:
        out.append((s, last))
    return out


def cells(a, cols, rows):
    """cell boxes (x0,y0,x1,y1 inclusive) in reading order, from the alpha occupancy of the whole sheet"""
    H, W = a.shape
    cr = runs((a > 0).any(0), 2)
    rr = runs((a > 0).any(1), 2)
    if len(cr) != cols or len(rr) != rows:  # fall back to an even grid
        cr = [(int(W * i / cols), int(W * (i + 1) / cols) - 1) for i in range(cols)]
        rr = [(int(H * i / rows), int(H * (i + 1) / rows) - 1) for i in range(rows)]
    boxes = []
    for r in rr:
        for c in cr:
            sub = a[r[0]:r[1] + 1, c[0]:c[1] + 1] > 0
            ys, xs = np.where(sub)
            boxes.append((c[0] + xs.min(), r[0] + ys.min(), c[0] + xs.max(), r[0] + ys.max()))
    return boxes


def shrink(im, size):
    """box-filter an RGBA image down to size, alpha cut at 50 %"""
    arr = np.asarray(im.convert("RGBA")).astype(np.float64)
    pm = arr.copy()
    pm[..., :3] *= arr[..., 3:4] / 255
    small = Image.fromarray(pm.clip(0, 255).astype(np.uint8), "RGBA").resize(size, Image.BOX)
    s = np.asarray(small).astype(np.float64)
    al = s[..., 3:4]
    rgb = np.where(al > 0, s[..., :3] * 255 / np.maximum(al, 1), 0)
    out = np.concatenate([rgb, np.where(al >= 128, 255, 0)], -1).clip(0, 255).astype(np.uint8)
    return out


def outline(arr, dark=0.72):
    """darken the edge pixels of the silhouette (selective outline) so thin outlines survive the shrink"""
    a = arr[..., 3] > 0
    pad = np.pad(a, 1)
    edge = a & ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])
    out = arr.copy()
    out[edge, :3] = (out[edge, :3] * dark).astype(np.uint8)
    return out


def quantise(arrs, colors):
    stack = np.concatenate([a[a[..., 3] > 0][:, :3] for a in arrs])
    pal_im = Image.fromarray(stack.reshape(-1, 1, 3).astype(np.uint8), "RGB").quantize(colors, Image.MEDIANCUT, dither=Image.NONE)
    pal = pal_im.getpalette()[: colors * 3]
    pal = np.array(pal).reshape(-1, 3).astype(int)
    outs = []
    for a in arrs:
        o = a.copy()
        m = a[..., 3] > 0
        px = a[m][:, :3].astype(int)
        d = ((px[:, None, :] - pal[None, :, :]) ** 2).sum(-1)
        o[m, :3] = pal[d.argmin(1)].astype(np.uint8)
        outs.append(o)
    return outs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("name")
    ap.add_argument("src")
    ap.add_argument("outdir")
    ap.add_argument("--cols", type=int, required=True)
    ap.add_argument("--rows", type=int, required=True)
    ap.add_argument("--height", type=int, required=True, help="target height of the tallest cell")
    ap.add_argument("--colors", type=int, default=48)
    ap.add_argument("--no-outline", action="store_true")
    args = ap.parse_args()
    im = Image.open(args.src).convert("RGBA")
    a = np.asarray(im)[..., 3]
    boxes = cells(a, args.cols, args.rows)
    tallest = max(b[3] - b[1] + 1 for b in boxes)
    k = args.height / tallest
    sprites = []
    for (x0, y0, x1, y1) in boxes:
        crop = im.crop((x0, y0, x1 + 1, y1 + 1))
        size = (max(1, round(crop.width * k)), max(1, round(crop.height * k)))
        s = shrink(crop, size)
        sprites.append(s if args.no_outline else outline(s))
    sprites = quantise(sprites, args.colors)
    os.makedirs(args.outdir, exist_ok=True)
    info = []
    for i, s in enumerate(sprites):
        fn = f"{args.name}_{i}.png"
        Image.fromarray(s, "RGBA").save(os.path.join(args.outdir, fn))
        info.append({"i": i, "file": fn, "w": s.shape[1], "h": s.shape[0]})
    print(json.dumps({"scale": round(k, 3), "cells": info}))


if __name__ == "__main__":
    main()
