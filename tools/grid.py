"""Draw specimen + skeleton + labeled 50px grid, cropped into panels, for picking trace waypoints."""
import sys
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, 'tools')
from centerline import load_mask
from skimage.morphology import skeletonize
font, blur, out = sys.argv[1], float(sys.argv[2]), sys.argv[3]
ink = load_mask(f'tools/out/specimen-{font}.png', blur)
sk = skeletonize(ink)
H, W = ink.shape
img = np.full((H, W, 3), 255, np.uint8); img[ink] = (205, 205, 205); img[sk] = (200, 0, 0)
ys, xs = np.nonzero(ink); y0, y1 = max(0, ys.min() - 20), ys.max() + 20
im = Image.fromarray(img); d = ImageDraw.Draw(im)
for x in range(0, W, 50):
    d.line([(x, 0), (x, H)], fill=(120, 160, 255) if x % 100 else (40, 90, 255), width=1)
    if x % 100 == 0: d.text((x + 2, y0 + 2), str(x), fill=(0, 0, 200), font_size=16)
for y in range(0, H, 50):
    d.line([(0, y), (W, y)], fill=(120, 160, 255) if y % 100 else (40, 90, 255), width=1)
    if y % 100 == 0: [d.text((xx + 2, y + 2), str(y), fill=(0, 0, 200), font_size=16) for xx in range(0, W, 400)] and None or d.text((2, y + 2), str(y), fill=(0, 0, 200), font_size=16)
n = int(sys.argv[4]) if len(sys.argv) > 4 else 3
step = W // n
for i in range(n):
    x0 = max(0, i * step - 60)
    crop = im.crop((x0, y0, min(W, (i + 1) * step + 60), y1))
    crop.save(f'{out}-{i}.png'); print(f'{out}-{i}.png', crop.size, 'x0', x0, 'y0', y0)
