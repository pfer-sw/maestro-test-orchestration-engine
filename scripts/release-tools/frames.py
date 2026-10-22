#!/usr/bin/env python3
"""frames.py <burst_dir> <out_prefix> [threshold=4] [WIDTHxHEIGHT]
Keeps only visually distinct frames from a screenshot burst and writes labelled contact sheets
(<out_prefix>_0.jpg, _1.jpg …) plus <out_prefix>_keep.txt. Use it to review auto-advancing screens
and animation keyframes. Requires Pillow (pip install pillow).
Screen size: the WIDTHxHEIGHT arg, else `adb shell wm size` (device from $DEVICE), else the first frame's size.
The status bar (~4.7% of the height) and navigation bar (~3.8%) are ignored when comparing frames."""
import sys, os, glob, re, subprocess
from PIL import Image, ImageChops, ImageStat, ImageDraw, ImageFont
d, out = sys.argv[1], sys.argv[2]; thr = float(sys.argv[3]) if len(sys.argv) > 3 else 4
fs = sorted(glob.glob(os.path.join(d, "*.png"))); keep, prev = [], None

def screen_size():
    if len(sys.argv) > 4:
        m = re.fullmatch(r"(\d+)x(\d+)", sys.argv[4])
        if m: return int(m[1]), int(m[2])
        sys.exit(f"bad size {sys.argv[4]!r}, expected WIDTHxHEIGHT")
    try:
        cmd = ["adb"] + (["-s", os.environ["DEVICE"]] if os.environ.get("DEVICE") else []) + ["shell", "wm", "size"]
        txt = subprocess.run(cmd, capture_output=True, text=True, timeout=5).stdout
        m = re.findall(r"(\d+)x(\d+)", txt)  # "Override size" (last line) wins over "Physical size"
        if m: return int(m[-1][0]), int(m[-1][1])
    except Exception: pass
    for f in fs:
        try: return Image.open(f).size
        except Exception: continue
    return 1080, 2340

SW, SH = screen_size()
TOP, BOTTOM = round(SH * 110 / 2340), round(SH * 2250 / 2340)
for f in fs:
    try: im = Image.open(f).convert("L").crop((0, TOP, SW, BOTTOM)).resize((108, 214))
    except Exception: continue
    if prev is None or ImageStat.Stat(ImageChops.difference(im, prev)).mean[0] > thr: keep.append(f)
    prev = im
print(len(fs), "frames ->", len(keep), "distinct")
try: font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 18)
except Exception: font = ImageFont.load_default()
W = 250; ims = [(os.path.basename(f)[:6], Image.open(f).convert("RGB").resize((W, int(SH * W / SW)))) for f in keep]
for p in range(0, len(ims), 10):
    ch = ims[p:p + 10]; sh = Image.new("RGB", (len(ch) * (W + 8), ch[0][1].height + 28), "white"); dr = ImageDraw.Draw(sh)
    for i, (n, im) in enumerate(ch):
        sh.paste(im, (i * (W + 8), 28)); dr.text((i * (W + 8) + 4, 4), f"{n[:2]}:{n[2:4]}:{n[4:]}", fill="red", font=font)
    sh.save(f"{out}_{p // 10}.jpg", quality=70); print(f"{out}_{p // 10}.jpg")
open(out + "_keep.txt", "w").write("\n".join(keep))
