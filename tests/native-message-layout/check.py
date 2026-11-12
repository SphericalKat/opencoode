"""Check native measureInWindow logs emitted by the fixture."""
import json
import re
import sys

EXPECTED = {(width, beta) for width in (320, 360, 393) for beta in (True, False)}
cases = [(None, [], [])]
for line in open(sys.argv[1]):
    match = re.search(r'REPRO45_(CASE|BUBBLE|TEXT).*?(\{.*\})', line)
    if not match:
        continue
    kind, data = match[1], json.loads(match[2])
    if kind == 'CASE':
        cases.append((data, [], []))
    else:
        cases[-1][1 if kind == 'BUBBLE' else 2].append(data)

fail = False
seen = set()
previous = None
for index, (case, bubbles, texts) in enumerate(cases):
    key = (393, True) if case is None else (case.get('w'), case.get('b'))
    if key not in EXPECTED or (case is not None and case.get('n') != 1):
        print(case, 'unexpected case')
        fail = True
        continue
    # Only the first explicit marker may repeat the already measured initial render.
    duplicate_initial = index == 1 and key == (393, True) and not bubbles and not texts
    if duplicate_initial and previous == key:
        continue
    if key in seen:
        print(case, 'duplicate case')
        fail = True
    seen.add(key)
    if not bubbles or len(texts) < 4:
        print(key, 'missing measurements')
        fail = True
        continue
    bubble = bubbles[-1]
    left, top = bubble['x'], bubble['y']
    right, bottom = left + bubble['w'], top + bubble['h']
    # Allow subpixel rounding, while requiring the production bubble's 12 dp padding.
    padding = min(min(t['x'] - left, t['y'] - top, right - t['x'] - t['w'], bottom - t['y'] - t['h']) for t in texts)
    ok = padding >= 11
    print(key, 'minimum padding:', round(padding, 2), 'PASS' if ok else 'FAIL')
    fail |= not ok
    previous = key if ok else None
missing = EXPECTED - seen
if missing:
    print('missing width/layout cases:', sorted(missing))
    fail = True
sys.exit(fail)
