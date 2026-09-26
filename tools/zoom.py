"""Zoomed skeleton panels with a 25px labeled grid, for placing waypoints precisely."""
import sys
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, 'tools')
from centerline import load_mask
from skimage.morphology import skeletonize
font, blur, out = sys.argv[1], float(sys.argv[2]), sys.argv[3]
ranges = [tuple(map(int, r.split(':'))) for r in sys.argv[4].split(',')]
z = int(sys.argv[5]) if len(sys.argv) > 5 else 2
ink = load_mask(f'tools/out/specimen-{font}.png', blur); sk = skeletonize(ink)
ys, _ = np.nonzero(ink); y0, y1 = max(0, ys.min() - 15), ys.max() + 15
for i, (xa, xb) in enumerate(ranges):
    sub_i, sub_s = ink[y0:y1, xa:xb], sk[y0:y1, xa:xb]
    img = np.full(sub_i.shape + (3,), 255, np.uint8); img[sub_i] = (210, 210, 210); img[sub_s] = (220, 0, 0)
    im = Image.fromarray(img).resize(((xb - xa) * z, (y1 - y0) * z), Image.NEAREST); d = ImageDraw.Draw(im)
    for x in range((xa // 25 + 1) * 25, xb, 25):
        X = (x - xa) * z; d.line([(X, 0), (X, im.height)], fill=(60, 110, 255) if x % 50 == 0 else (170, 200, 255))
        if x % 50 == 0: d.text((X + 2, 2), str(x), fill=(0, 0, 180), font_size=15)
    for y in range((y0 // 25 + 1) * 25, y1, 25):
        Y = (y - y0) * z; d.line([(0, Y), (im.width, Y)], fill=(60, 110, 255) if y % 50 == 0 else (170, 200, 255))
        if y % 50 == 0: d.text((2, Y + 2), str(y), fill=(0, 0, 180), font_size=15)
    im.save(f'{out}-z{i}.png')
