"""Check native measureInWindow logs emitted by the fixture."""
import json
import re
import sys

cases = [('initial 393 beta', [], [])]
for line in open(sys.argv[1]):
    match = re.search(r'REPRO45_(CASE|BUBBLE|TEXT).*?(\{.*\})', line)
    if not match:
        continue
    kind, data = match[1], json.loads(match[2])
    if kind == 'CASE':
        cases.append((str(data), [], []))
    else:
        cases[-1][1 if kind == 'BUBBLE' else 2].append(data)
fail = False
for name, bubbles, texts in cases:
    if not bubbles and not texts:  # unchanged initial case does not relayout
        continue
    if not bubbles or len(texts) < 4:
        print(name, 'missing measurements')
        fail = True
        continue
    bubble = bubbles[-1]
    bottom = max(t['y'] + t['h'] for t in texts)
    padding = round(bubble['y'] + bubble['h'] - bottom, 2)
    ok = padding >= 11
    print(name, 'bottom padding:', padding, 'PASS' if ok else 'FAIL')
    fail |= not ok
if len(cases) < 7:
    print('missing width/layout cases')
    fail = True
sys.exit(fail)
