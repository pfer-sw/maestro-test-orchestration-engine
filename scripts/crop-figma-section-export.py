#!/usr/bin/env python3
"""
crop-figma-section-export.py

Fallback for when the Figma images API is rate-limited (429 with
x-figma-rate-limit-type: low — can mean a multi-day Retry-After).

A human exports whole SECTIONS as PNG from the Figma UI; this script cuts every
mapped frame out of those exports using each frame's absoluteBoundingBox
(from the nodes API, which is not render-limited), and writes the same
<nodeId>_figma.png files + _manifest.json that save-figma-screenshots.js produces.

Usage:
  python3 scripts/crop-figma-section-export.py \
      --tree <nodes-api JSON containing the sections> \
      --mapping config/figma-mapping.json \
      --section <sectionNodeId>=<export.png> [--section …] \
      --out screenshots/design-audit/figma/<date>/<label>

Scale is derived per section as image_width / section_width, so 1x, 2x or a
Figma-downscaled export all crop correctly. Requires Pillow.
"""
import argparse, json, os
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument("--tree", required=True)
ap.add_argument("--mapping", required=True)
ap.add_argument("--section", action="append", required=True, help="<sectionNodeId>=<png>")
ap.add_argument("--out", required=True)
a = ap.parse_args()

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
tree = json.load(open(a.tree))
screens = json.load(open(a.mapping))["screens"]

def find(n, nid):
    if n.get("id") == nid: return n
    for c in n.get("children", []):
        r = find(c, nid)
        if r: return r

def all_nodes(n, acc):
    acc[n["id"]] = n
    for c in n.get("children", []): all_nodes(c, acc)
    return acc

roots = [v["document"] for v in tree["nodes"].values()]
os.makedirs(a.out, exist_ok=True)
manifest_path = os.path.join(a.out, "_manifest.json")
manifest = json.load(open(manifest_path)) if os.path.exists(manifest_path) else {}

for spec in a.section:
    sid, png = spec.split("=", 1)
    sec = next(filter(None, (find(r, sid) for r in roots)), None)
    if not sec: raise SystemExit(f"section {sid} not found in tree")
    sb = sec["absoluteBoundingBox"]
    img = Image.open(png).convert("RGB")
    scale = img.width / sb["width"]
    inside = all_nodes(sec, {})
    n = 0
    for key, e in screens.items():
        node = inside.get(e["figmaNodeId"])
        if not node: continue
        b = node["absoluteBoundingBox"]
        box = [round((b["x"] - sb["x"]) * scale), round((b["y"] - sb["y"]) * scale),
               round((b["x"] - sb["x"] + b["width"]) * scale), round((b["y"] - sb["y"] + b["height"]) * scale)]
        fn = e["figmaNodeId"].replace(":", "_") + "_figma.png"
        img.crop(box).save(os.path.join(a.out, fn))
        manifest[e["figmaNodeId"]] = os.path.relpath(os.path.join(a.out, fn), ROOT)
        n += 1
    print(f"{sec['name']}: scale {scale:.3f} → {n} frames cropped")

json.dump(manifest, open(manifest_path, "w"), indent=2)
print(f"manifest: {os.path.relpath(manifest_path, ROOT)} ({len(manifest)} entries)")
