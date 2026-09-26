"""Guided centerline tracing: hand-placed waypoints snapped onto the font's medial axis.

A human (or Claude) authors the *order and direction* of each pen stroke as a short list
of rough waypoints; this tool supplies the *geometry* by routing between consecutive
waypoints along the skeleton of the rendered lettering (Dijkstra on skeleton pixels).
Retraces (going back up a stem) and loops come out right because the route follows
the waypoints, not the graph topology.

Input  (lettering/<font>.waypoints.json):
  { "font": "Yellowtail", "blur": 1.0, "nameWidthMm": 400,
    "strokes": [ { "id": "levent", "delayed": false, "waypoints": [[x, y], ...] }, ... ] }
Output (src/lettering/<font>.strokes.json and .svg): strokes in millimetres, writing order,
y pointing down in the SVG / "away from the viewer" on the paper.

Usage: python tools/trace.py lettering/Yellowtail.waypoints.json
"""

import heapq
import json
import math
import os
import sys

import numpy as np
from scipy import ndimage as ndi
from skimage.morphology import skeletonize

sys.path.insert(0, os.path.dirname(__file__))
from centerline import load_mask, resample, smooth  # noqa: E402

NB8 = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]


def nearest_on(mask, x, y, r=60):
    y0, y1 = max(0, int(y) - r), min(mask.shape[0], int(y) + r + 1)
    x0, x1 = max(0, int(x) - r), min(mask.shape[1], int(x) + r + 1)
    ys, xs = np.nonzero(mask[y0:y1, x0:x1])
    if len(ys) == 0:
        raise ValueError(f"no skeleton within {r}px of waypoint ({x}, {y})")
    i = np.argmin((ys + y0 - y) ** 2 + (xs + x0 - x) ** 2)
    return int(ys[i] + y0), int(xs[i] + x0)


def route(skel, a, b, prev_dir=None):
    """Shortest 8-connected path on skeleton pixels from a to b (both (y, x)).
    A small turn penalty against prev_dir keeps the route from doubling back at a junction."""
    H, W = skel.shape
    dist = {a: 0.0}
    back = {}
    pq = [(0.0, a)]
    while pq:
        d, p = heapq.heappop(pq)
        if p == b:
            break
        if d > dist.get(p, math.inf):
            continue
        for dy, dx in NB8:
            q = (p[0] + dy, p[1] + dx)
            if not (0 <= q[0] < H and 0 <= q[1] < W) or not skel[q]:
                continue
            w = math.hypot(dy, dx)
            if p == a and prev_dir is not None:
                w += 6.0 * max(0.0, -(dy * prev_dir[0] + dx * prev_dir[1]) / math.hypot(dy, dx))
            nd = d + w
            if nd < dist.get(q, math.inf):
                dist[q] = nd
                back[q] = p
                heapq.heappush(pq, (nd, q))
    if b not in dist:
        return None
    path = [b]
    while path[-1] != a:
        path.append(back[path[-1]])
    return path[::-1]


def trace_stroke(skel, waypoints, width, allow_gap):
    snapped = [(int(w[1]), int(w[0])) if len(w) > 2 and w[2] == "free" else nearest_on(skel, w[0], w[1]) for w in waypoints]
    free = [len(w) > 2 and w[2] == "free" for w in waypoints]
    pts = [snapped[0]]
    prev_dir = None
    for i, (a, b) in enumerate(zip(snapped, snapped[1:])):
        seg = None if (free[i] or free[i + 1]) else route(skel, a, b, prev_dir)
        if seg is None:
            gap = math.dist(a, b)
            if gap > allow_gap * width and not (free[i] or free[i + 1]):
                raise ValueError(f"no skeleton path {a[::-1]} -> {b[::-1]} (gap {gap:.0f}px)")
            n = max(2, int(gap))
            seg = [(a[0] + (b[0] - a[0]) * t / n, a[1] + (b[1] - a[1]) * t / n) for t in range(n + 1)]
        pts.extend(seg[1:])
        if len(seg) > 4:
            dy, dx = seg[-1][0] - seg[-4][0], seg[-1][1] - seg[-4][1]
            n = math.hypot(dy, dx) or 1
            prev_dir = (dy / n, dx / n)
    return pts


def extend_ends(a, by):
    """Skeletons stop ~half a stroke width short of the real stroke tips; extend along the tangent."""
    def ext(p, q):
        d = p - q
        n = np.linalg.norm(d) or 1.0
        return p + d / n * by
    k = min(6, len(a) - 1)
    return np.vstack([ext(a[0], a[k]), a, ext(a[-1], a[-1 - k])])


def main():
    spec_path = sys.argv[1]
    spec = json.load(open(spec_path))
    font = spec["font"]
    ink = load_mask(f"tools/out/specimen-{font}.png", spec.get("blur", 1.0))
    skel = skeletonize(ink)
    dist = ndi.distance_transform_edt(ink)
    width = 2.0 * float(np.median(dist[skel]))

    raw = []
    for s in spec["strokes"]:
        pts = trace_stroke(skel, s["waypoints"], width, spec.get("allowGap", 2.5))
        a = np.asarray(pts, dtype=np.float64)[:, ::-1]  # -> (x, y)
        a = resample(a, 1.0)
        a = smooth(a, sigma=s.get("smooth", 0.35 * width))
        if not s.get("keepEnds"):
            a = extend_ends(a, 0.35 * width)
        raw.append((s, resample(a, 2.0)))

    allpts = np.vstack([a for _, a in raw])
    x0, y0 = allpts.min(axis=0)
    x1, y1 = allpts.max(axis=0)
    mm_per_px = spec.get("nameWidthMm", 400) / (x1 - x0)

    strokes = []
    for i, (s, a) in enumerate(raw):
        mm = (a - [x0, y0]) * mm_per_px
        strokes.append(
            {
                "id": s["id"],
                "order": i,
                "delayed": bool(s.get("delayed", False)),
                "points": [[round(float(x), 3), round(float(y), 3)] for x, y in mm],
            }
        )

    out = {
        "font": font,
        "units": "mm",
        "size": [round(float((x1 - x0) * mm_per_px), 3), round(float((y1 - y0) * mm_per_px), 3)],
        "fontStrokeWidthMm": round(width * mm_per_px, 3),
        "strokes": strokes,
    }
    os.makedirs("src/lettering", exist_ok=True)
    base = f"src/lettering/{font}.strokes"
    with open(base + ".json", "w") as f:
        json.dump(out, f, indent=1)

    # Editable SVG: one open path per stroke, writing direction, data-order.
    w, h = out["size"]
    paths = []
    for s in strokes:
        d = "M" + " L".join(f"{x:.2f} {y:.2f}" for x, y in s["points"])
        paths.append(
            f'  <path id="{s["id"]}" data-order="{s["order"]}" data-delayed="{str(s["delayed"]).lower()}" d="{d}"/>'
        )
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-5 -5 {w + 10:.1f} {h + 10:.1f}" '
        f'width="{w + 10:.0f}mm" height="{h + 10:.0f}mm" fill="none" stroke="#000" '
        f'stroke-width="{out["fontStrokeWidthMm"]:.2f}" stroke-linecap="round" stroke-linejoin="round">\n'
        + "\n".join(paths)
        + "\n</svg>\n"
    )
    with open(base + ".svg", "w") as f:
        f.write(svg)
    print(f"{font}: {len(strokes)} strokes, {w:.0f}x{h:.0f} mm, font stroke {out['fontStrokeWidthMm']:.1f} mm")

    # Debug overlay in the specimen's pixel space.
    if "--debug" in sys.argv:
        import colorsys

        from PIL import Image, ImageDraw

        img = Image.open(f"tools/out/specimen-{font}.png").convert("RGB")
        img = Image.blend(img, Image.new("RGB", img.size, "white"), 0.7)
        dr = ImageDraw.Draw(img)
        for i, (s, a) in enumerate(raw):
            r, g, b = colorsys.hsv_to_rgb((i * 0.27) % 1, 0.9, 0.75)
            col = (int(r * 255), int(g * 255), int(b * 255))
            p = [tuple(q) for q in a]
            dr.line(p, fill=col, width=4)
            for j in range(0, len(p) - 12, 40):  # direction ticks
                (xa, ya), (xb, yb) = p[j], p[j + 10]
                dr.line([(xa, ya), (xb, yb)], fill=(0, 0, 0), width=2)
                dr.ellipse([xb - 3, yb - 3, xb + 3, yb + 3], fill=(0, 0, 0))
            dr.ellipse([p[0][0] - 9, p[0][1] - 9, p[0][0] + 9, p[0][1] + 9], fill=col)
            dr.text((p[0][0] + 10, p[0][1] - 30), f"{i}:{s['id']}", fill=col, font_size=24)
            for wx, wy, *_ in s["waypoints"]:
                dr.ellipse([wx - 4, wy - 4, wx + 4, wy + 4], outline=(0, 0, 0))
        img.save(f"tools/out/trace-{font}.png")


if __name__ == "__main__":
    main()
