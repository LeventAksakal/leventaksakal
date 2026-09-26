"""Draft centerline extraction: rendered script text -> ordered open strokes.

This is brief option 3 (automatic skeletonization), used only to seed the
hand-authored centerlines. Pipeline:

  PNG (black ink on white) -> binary mask -> medial axis (skeleton)
  -> pixel graph (junctions, endpoints, edges) -> prune short spurs
  -> pair edges at each junction by best tangent continuation
  -> chains = pen strokes -> orient + order in writing order
  -> smooth -> JSON + debug SVG.

Usage: python tools/centerline.py tools/out/specimen-Sacramento.png out.json [--blur 1.5]
"""

import argparse
import json
import math
from collections import defaultdict

import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from skimage.morphology import remove_small_holes, remove_small_objects, skeletonize

NB8 = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]


def load_mask(path, blur):
    img = np.asarray(Image.open(path).convert("L"), dtype=np.float32) / 255.0
    if blur > 0:
        img = ndi.gaussian_filter(img, blur)
    ink = img < 0.5
    ink = remove_small_objects(ink, max_size=64)
    # Fill pinholes from rough outlines but keep real counters (e, a, loops).
    ink = remove_small_holes(ink, max_size=40)
    return ink


def build_graph(skel):
    """Return (nodes, edges). nodes: id -> (y, x). edges: list of (a, b, [pixels])."""
    ys, xs = np.nonzero(skel)
    on = set(zip(ys.tolist(), xs.tolist()))

    def nbrs(p):
        y, x = p
        return [(y + dy, x + dx) for dy, dx in NB8 if (y + dy, x + dx) in on]

    deg = {p: len(nbrs(p)) for p in on}
    special = {p for p, d in deg.items() if d != 2}

    # Cluster adjacent junction pixels into single nodes.
    node_of = {}
    nodes = {}
    for p in special:
        if p in node_of:
            continue
        nid = len(nodes)
        stack, members = [p], []
        node_of[p] = nid
        while stack:
            q = stack.pop()
            members.append(q)
            for r in nbrs(q):
                if r in special and r not in node_of:
                    node_of[r] = nid
                    stack.append(r)
        cy = sum(m[0] for m in members) / len(members)
        cx = sum(m[1] for m in members) / len(members)
        nodes[nid] = (cy, cx)

    edges = []
    visited = set()
    for p in special:
        for q in nbrs(p):
            if q in special or (p, q) in visited:
                continue
            path = [p, q]
            visited.add((p, q))
            prev, cur = p, q
            while cur not in special:
                nxt = [r for r in nbrs(cur) if r != prev and r not in path[-3:]]
                if not nxt:
                    break
                prev, cur = cur, nxt[0]
                path.append(cur)
            if cur in special:
                visited.add((cur, prev))
                edges.append((node_of[p], node_of[cur], path))

    # Pure cycles (no junction at all, e.g. an "o" drawn closed) become a loop at a fake node.
    covered = {px for _, _, pts in edges for px in pts}
    for p in on - covered - special:
        if deg[p] != 2 or p in covered:
            continue
        path = [p]
        prev, cur = None, p
        while True:
            nxt = [r for r in nbrs(cur) if r != prev and r not in path[-2:]]
            if not nxt or nxt[0] == p:
                break
            prev, cur = cur, nxt[0]
            if cur in covered:
                break
            path.append(cur)
        covered.update(path)
        nid = len(nodes)
        nodes[nid] = path[0]
        edges.append((nid, nid, path + [path[0]]))

    # Deduplicate edges found from both ends.
    seen, uniq = set(), []
    for a, b, pts in edges:
        key = (min(a, b), max(a, b), frozenset(pts[1:-1]))
        if key in seen:
            continue
        seen.add(key)
        uniq.append((a, b, pts))
    return nodes, uniq


def prune(nodes, edges, min_len):
    """Iteratively remove short spurs (edge with a free end) and merge degree-2 nodes."""
    changed = True
    while changed:
        changed = False
        deg = defaultdict(int)
        for a, b, _ in edges:
            deg[a] += 1
            deg[b] += 1
        keep = []
        for a, b, pts in edges:
            spur = (deg[a] == 1) != (deg[b] == 1)  # exactly one free end
            if spur and len(pts) < min_len:
                changed = True
                continue
            keep.append((a, b, pts))
        edges = keep
        edges, merged = merge_deg2(edges)
        changed = changed or merged
    return edges


def merge_deg2(edges):
    deg = defaultdict(list)
    for i, (a, b, _) in enumerate(edges):
        deg[a].append(i)
        deg[b].append(i)
    for n, inc in deg.items():
        if len(inc) != 2 or inc[0] == inc[1]:
            continue
        i, j = inc
        a1, b1, p1 = edges[i]
        a2, b2, p2 = edges[j]
        if b1 != n:
            a1, b1, p1 = b1, a1, p1[::-1]
        if a2 != n:
            a2, b2, p2 = b2, a2, p2[::-1]
        new = (a1, b2, p1 + p2[1:])
        rest = [e for k, e in enumerate(edges) if k not in (i, j)]
        return rest + [new], True
    return edges, False


def tangent_out(pts, k):
    """Unit direction leaving the start of pts, measured k pixels in."""
    k = min(k, len(pts) - 1)
    (y0, x0), (y1, x1) = pts[0], pts[k]
    d = math.hypot(y1 - y0, x1 - x0) or 1.0
    return ((y1 - y0) / d, (x1 - x0) / d)


def decompose(edges, k):
    """Pair edge-ends at every junction by straightest continuation, then walk chains."""
    ends = defaultdict(list)  # node -> [(edge index, end 0|1)]
    for i, (a, b, _) in enumerate(edges):
        ends[a].append((i, 0))
        ends[b].append((i, 1))

    def dir_at(i, end):
        pts = edges[i][2] if end == 0 else edges[i][2][::-1]
        return tangent_out(pts, k)

    link = {}  # (edge, end) -> (edge, end) continuing through the junction
    for n, inc in ends.items():
        if len(inc) < 2:
            continue
        cands = []
        for u in range(len(inc)):
            for v in range(u + 1, len(inc)):
                if inc[u][0] == inc[v][0] and len(inc) > 2:
                    continue  # don't close a self-loop at a real junction first
                du, dv = dir_at(*inc[u]), dir_at(*inc[v])
                straight = -(du[0] * dv[0] + du[1] * dv[1])  # 1 = perfectly straight through
                cands.append((straight, u, v))
        cands.sort(reverse=True)
        used = set()
        for s, u, v in cands:
            if u in used or v in used or s < -0.2:
                continue
            used.update((u, v))
            link[inc[u]] = inc[v]
            link[inc[v]] = inc[u]

    done = set()
    chains = []
    starts = [(i, e) for i in range(len(edges)) for e in (0, 1) if (i, e) not in link]
    for start in starts + [(i, 0) for i in range(len(edges))]:
        if start[0] in done:
            continue
        i, e = start
        pts = []
        while i not in done:
            done.add(i)
            seg = edges[i][2] if e == 0 else edges[i][2][::-1]
            pts.extend(seg if not pts else seg[1:])
            nxt = link.get((i, 1 - e))
            if nxt is None:
                break
            i, e = nxt
        chains.append(pts)
    return chains


def smooth(pts, sigma):
    a = np.asarray(pts, dtype=np.float64)
    if len(a) < 5:
        return a
    closed = np.allclose(a[0], a[-1])
    mode = "wrap" if closed else "nearest"
    out = np.stack([ndi.gaussian_filter1d(a[:, i], sigma, mode=mode) for i in (0, 1)], axis=1)
    if not closed:
        out[0], out[-1] = a[0], a[-1]
    return out


def resample(a, step):
    seg = np.linalg.norm(np.diff(a, axis=0), axis=1)
    s = np.concatenate([[0], np.cumsum(seg)])
    n = max(2, int(s[-1] / step) + 1)
    t = np.linspace(0, s[-1], n)
    return np.stack([np.interp(t, s, a[:, 0]), np.interp(t, s, a[:, 1])], axis=1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("png")
    ap.add_argument("out")
    ap.add_argument("--blur", type=float, default=1.0)
    ap.add_argument("--glyphs", help="JSON of per-character x ranges from the renderer")
    args = ap.parse_args()

    ink = load_mask(args.png, args.blur)
    dist = ndi.distance_transform_edt(ink)
    skel = skeletonize(ink)
    width = 2.0 * float(np.median(dist[skel]))

    nodes, edges = build_graph(skel)
    edges = prune(nodes, edges, min_len=int(1.6 * width))
    chains = decompose(edges, k=max(4, int(1.2 * width)))
    chains = [c for c in chains if len(c) > width]

    strokes = []
    for c in chains:
        a = smooth(c, sigma=max(1.5, width * 0.35))
        a = resample(a, step=2.0)
        yx = a
        ys, xs = yx[:, 0], yx[:, 1]
        # Orientation: horizontal-ish strokes go left->right, vertical ones top->bottom.
        span_x, span_y = np.ptp(xs), np.ptp(ys)
        flip = xs[0] > xs[-1] if span_x > 0.6 * span_y else ys[0] > ys[-1]
        if flip:
            yx = yx[::-1]
        strokes.append(
            {
                "points": [[round(float(x), 2), round(float(y), 2)] for y, x in yx],
                "bbox": [float(xs.min()), float(ys.min()), float(xs.max()), float(ys.max())],
                "length": float(np.sum(np.linalg.norm(np.diff(yx, axis=0), axis=1))),
            }
        )

    # Writing order: delayed strokes (short, flat, isolated crossbars) after the main strokes
    # of their word; everything else left to right by where it starts.
    h = ink.shape[0]
    for s in strokes:
        x0, y0, x1, y1 = s["bbox"]
        s["delayed"] = bool((y1 - y0) < 0.12 * h and (x1 - x0) > 3 * width and s["length"] < 0.5 * ink.shape[1])
    main_strokes = sorted([s for s in strokes if not s["delayed"]], key=lambda s: s["points"][0][0])
    delayed = [s for s in strokes if s["delayed"]]
    ordered = []
    for s in main_strokes:
        ordered.append(s)
    # Insert each delayed stroke right after the last main stroke that starts left of its end.
    for d in sorted(delayed, key=lambda s: s["bbox"][0]):
        idx = max([i for i, s in enumerate(ordered) if not s["delayed"] and s["points"][0][0] <= d["bbox"][2]], default=len(ordered) - 1)
        ordered.insert(idx + 1, d)

    out = {
        "source": args.png,
        "units": "px",
        "size": [int(ink.shape[1]), int(ink.shape[0])],
        "strokeWidth": width,
        "strokes": [
            {"id": f"s{i}", "order": i, "delayed": s["delayed"], "points": s["points"]} for i, s in enumerate(ordered)
        ],
    }
    with open(args.out, "w") as f:
        json.dump(out, f)
    print(f"{args.png}: width={width:.1f}px strokes={len(ordered)} delayed={sum(s['delayed'] for s in ordered)}")


if __name__ == "__main__":
    main()
