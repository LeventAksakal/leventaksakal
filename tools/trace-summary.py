"""Summarise a Chrome trace (tools/record.mjs): per-thread busy time, the longest tasks, and the
JS functions / GPU work inside them. Usage: python3 tools/trace-summary.py trace.json [top]"""
import json, sys, collections

path = sys.argv[1]
top = int(sys.argv[2]) if len(sys.argv) > 2 else 12
raw = json.load(open(path))
ev = raw['traceEvents'] if isinstance(raw, dict) else raw
names = {}
for e in ev:
    if e.get('ph') == 'M' and e.get('name') == 'thread_name':
        names[(e['pid'], e['tid'])] = e['args']['name']
t_min = min(e['ts'] for e in ev if e.get('ts'))
tasks = collections.defaultdict(list)
nested = collections.defaultdict(list)
for e in ev:
    if e.get('ph') != 'X' or 'dur' not in e:
        continue
    th = names.get((e['pid'], e['tid']), str(e['tid']))
    if e['name'] in ('RunTask', 'ThreadControllerImpl::RunTask'):
        tasks[th].append(e)
    else:
        nested[(e['pid'], e['tid'])].append(e)

def label(e):
    d = e.get('args', {}).get('data', {})
    fn = d.get('functionName') or ''
    url = (d.get('url') or '').split('/')[-1]
    return f"{e['name']}{(' ' + fn) if fn else ''}{(' ' + url + ':' + str(d.get('lineNumber'))) if url else ''}"

interesting = [t for t in tasks if any(k in t for k in ('CrRendererMain', 'DedicatedWorker', 'CrGpuMain', 'VizCompositor'))]
for th in sorted(interesting):
    ts = tasks[th]
    busy = sum(t['dur'] for t in ts) / 1e6
    span = (max(t['ts'] + t['dur'] for t in ts) - min(t['ts'] for t in ts)) / 1e6
    print(f"\n=== {th}: busy {busy:.1f} s over {span:.1f} s, {len(ts)} tasks, >50 ms: {sum(1 for t in ts if t['dur'] > 5e4)}")
    for t in sorted(ts, key=lambda t: -t['dur'])[:top]:
        inner = [n for n in nested[(t['pid'], t['tid'])] if n['ts'] >= t['ts'] and n['ts'] + n['dur'] <= t['ts'] + t['dur'] and n['dur'] > t['dur'] * 0.2]
        inner = sorted(inner, key=lambda n: -n['dur'])[:4]
        print(f"  {(t['ts'] - t_min) / 1e6:7.2f}s  {t['dur'] / 1e3:8.1f} ms   " + ' | '.join(f"{label(n)} {n['dur'] / 1e3:.0f}ms" for n in inner))
