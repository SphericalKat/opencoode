"""Validate fresh native measurements for each FlashList interaction."""
import json
import re
import sys

expected = {(w, b, phase) for w in (320, 360, 393) for b in (True, False) for phase in ('initial', 'send', 'scroll')}
expected.update({(393, True, 'short'), (393, True, 'attachment')})
cases = []
away = {}
for line in open(sys.argv[1]):
    match = re.search(r'REPRO45_(CASE|BUBBLE|TEXT|NEXT|AWAY|ATTACHMENT).*?(\{.*\})', line)
    if not match:
        continue
    kind, data = match[1], json.loads(match[2])
    if kind == 'AWAY':
        away[(data['w'], data['b'])] = data['offset']
    elif kind == 'CASE':
        cases.append((data, {'BUBBLE': [], 'TEXT': [], 'NEXT': [], 'ATTACHMENT': []}))
    elif cases:
        cases[-1][1][kind].append(data)

seen = set()
failed = False
for case, measurements in cases:
    key = (case.get('w'), case.get('b'), case.get('phase'))
    if key not in expected or key in seen:
        print(key, 'unexpected or duplicate case')
        failed = True
        continue
    seen.add(key)
    bubbles, texts, following = (measurements[k] for k in ('BUBBLE', 'TEXT', 'NEXT'))
    if len(bubbles) != 1 or len(texts) < (1 if case['phase'] in ('short', 'attachment') else 7) or len(following) != 1:
        print(key, 'missing or ambiguous measurements', {k: len(v) for k, v in measurements.items()})
        failed = True
        continue
    bubble, next_row = bubbles[0], following[0]
    left, top = bubble['x'], bubble['y']
    right, bottom = left + bubble['w'], top + bubble['h']
    padding = min(min(t['x'] - left, t['y'] - top, right - t['x'] - t['w'], bottom - t['y'] - t['h']) for t in texts)
    gap = next_row['y'] - bottom
    attachments = measurements['ATTACHMENT']
    attachment_ok = case['phase'] != 'attachment' or (len(attachments) == 1 and attachments[0]['x'] >= left + 11 and attachments[0]['y'] >= top + 11 and attachments[0]['x'] + attachments[0]['w'] <= right - 11 and attachments[0]['y'] + attachments[0]['h'] <= bottom - 11)
    scroll_ok = case['phase'] != 'scroll' or ((case['w'], case['b']) in away and case.get('offset', 0) - away[(case['w'], case['b'])] > 500)
    aligned = abs(right - (case['w'] - 16)) <= 1
    ok = padding >= 11 and gap >= -0.5 and scroll_ok and attachment_ok and aligned
    print(key, 'minimum padding:', round(padding, 2), 'next row gap:', round(gap, 2), 'scroll:', scroll_ok, 'right aligned:', aligned, 'PASS' if ok else 'FAIL')
    failed |= not ok
missing = expected - seen
if missing:
    print('missing cases:', sorted(missing))
    failed = True
sys.exit(failed)
