"""Overlay extracted strokes on the specimen: one color per stroke, order number, start dot, end arrow."""
import json, sys, colorsys
from PIL import Image, ImageDraw
d = json.load(open(sys.argv[1])); img = Image.open(d["source"]).convert("RGB")
img = Image.blend(img, Image.new("RGB", img.size, "white"), 0.75); dr = ImageDraw.Draw(img)
for s in d["strokes"]:
    r, g, b = colorsys.hsv_to_rgb((s["order"] * 0.61) % 1, 0.9, 0.8); col = (int(r*255), int(g*255), int(b*255))
    p = [tuple(q) for q in s["points"]]; dr.line(p, fill=col, width=5)
    x, y = p[0]; dr.ellipse([x-9, y-9, x+9, y+9], fill=col); dr.text((x+10, y-26), str(s["order"]) + ("*" if s["delayed"] else ""), fill=col, font_size=28)
    x1, y1 = p[-1]; dr.rectangle([x1-6, y1-6, x1+6, y1+6], outline=col, width=3)
img.save(sys.argv[2]); print(sys.argv[2])
