#!/usr/bin/env python3
"""figma_compare.py --mapping config/figma-mapping-cv.json --manifest screenshots/design-audit/figma/<date>/<label>/_manifest.json \
       --out cmp.jpg  <figmaKey>=<appScreenshot.png> [<figmaKey>=<app.png> …]
Side-by-side Figma frame vs app screenshot for one or more pairs (the design-audit view used in the
release reports). Works with any mapping file written by save-figma-screenshots.js or
crop-figma-section-export.py. For animation keyframes pass the kf1/kf2/kf3 keys with the app frames.
Requires Pillow."""
import argparse, json, os
from PIL import Image, ImageDraw, ImageFont
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ap = argparse.ArgumentParser(); ap.add_argument("--mapping", required=True); ap.add_argument("--manifest", required=True)
ap.add_argument("--out", required=True); ap.add_argument("--width", type=int, default=300); ap.add_argument("--crop", type=int, default=650)
ap.add_argument("pairs", nargs="+"); a = ap.parse_args()
m = json.load(open(os.path.join(ROOT, a.mapping)))["screens"]; man = json.load(open(os.path.join(ROOT, a.manifest)))
try: font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 14)
except Exception: font = ImageFont.load_default()
W, H = a.width, a.crop; cols = []
for pair in a.pairs:
    k, app = pair.split("=", 1)
    for label, path in (("FIGMA " + k.split(".", 1)[-1], os.path.join(ROOT, man[m[k]["figmaNodeId"]])), ("APP " + os.path.basename(app), app)):
        im = Image.open(path).convert("RGB"); cols.append((label, im.resize((W, int(im.height * W / im.width))).crop((0, 0, W, H))))
sheet = Image.new("RGB", (len(cols) * (W + 8), H + 22), "white"); d = ImageDraw.Draw(sheet)
for i, (label, im) in enumerate(cols):
    sheet.paste(im, (i * (W + 8), 22)); d.text((i * (W + 8), 2), label[:44], fill="purple" if label.startswith("FIGMA") else "darkgreen", font=font)
sheet.save(a.out, quality=72); print(a.out)
