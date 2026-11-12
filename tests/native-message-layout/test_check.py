"""Behavior checks for the native-log validator; run with python -m unittest discover."""
import json
import subprocess
import tempfile
import unittest
from pathlib import Path

CHECK = Path(__file__).with_name('check.py')


def valid_log():
    lines = []
    def emit(kind, data):
        lines.append('REPRO45_' + kind + ' ' + json.dumps(data))
    for b in (True, False):
        for w in (393, 360, 320):
            for phase in ('initial', 'send', 'scroll'):
                if phase == 'scroll':
                    emit('AWAY', {'w': w, 'b': b, 'offset': 0})
                emit('CASE', {'w': w, 'b': b, 'phase': phase, 'offset': 1000})
                emit('BUBBLE', {'x': w - 116, 'y': 0, 'w': 100, 'h': 100})
                for _ in range(7):
                    emit('TEXT', {'x': w - 104, 'y': 12, 'w': 76, 'h': 76})
                emit('NEXT', {'x': 0, 'y': 116, 'w': 100, 'h': 20})
    for phase in ('short', 'attachment'):
        emit('CASE', {'w': 393, 'b': True, 'phase': phase, 'offset': 0})
        emit('BUBBLE', {'x': 277, 'y': 0, 'w': 100, 'h': 100})
        emit('TEXT', {'x': 289, 'y': 12, 'w': 76, 'h': 20})
        if phase == 'attachment':
            emit('ATTACHMENT', {'x': 289, 'y': 40, 'w': 76, 'h': 48})
        emit('NEXT', {'x': 0, 'y': 116, 'w': 100, 'h': 20})
    return '\n'.join(lines)


class CheckTest(unittest.TestCase):
    def run_check(self, log):
        with tempfile.NamedTemporaryFile(mode='w') as f:
            f.write(log)
            f.flush()
            return subprocess.run(['python', str(CHECK), f.name], capture_output=True).returncode

    def test_complete_measurements_pass(self):
        self.assertEqual(self.run_check(valid_log()), 0)

    def test_empty_cases_fail(self):
        self.assertNotEqual(self.run_check('\n'.join(line for line in valid_log().splitlines() if 'CASE' in line)), 0)

    def test_overflow_fails(self):
        self.assertNotEqual(self.run_check(valid_log().replace('"h": 76', '"h": 90', 1)), 0)

    def test_overlap_fails(self):
        self.assertNotEqual(self.run_check(valid_log().replace('"y": 116', '"y": 90', 1)), 0)

    def test_no_scroll_fails(self):
        self.assertNotEqual(self.run_check(valid_log().replace('"offset": 0}', '"offset": 1000}', 1)), 0)
