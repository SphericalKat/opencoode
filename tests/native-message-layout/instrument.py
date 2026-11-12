"""Add on-demand native measurement probes in a disposable source copy."""
from pathlib import Path

bubble = Path('src/components/UserMessageBubble.tsx')
s = bubble.read_text().replace("import React from 'react';", "import React, {useRef} from 'react';\nimport {useRepro45Probe} from './repro45Probe';")
s = s.replace('  const { colors } = useTheme();', "  const { colors } = useTheme(); const probe = useRef<React.ComponentRef<typeof View>>(null); useRepro45Probe(probe, 'BUBBLE');")
s = s.replace('<View style=', '<View ref={probe} style=')
bubble.write_text(s)
markdown = Path('src/components/Markdown.tsx')
s = markdown.read_text().replace(' Text, View,', ' Text as NativeText, View,')
s = s.replace('const parser =', "import {useRepro45Probe} from './repro45Probe';\nfunction Text(props: React.ComponentProps<typeof NativeText>){const ref=React.useRef<NativeText>(null);useRepro45Probe(ref, 'TEXT');return <NativeText {...props} ref={ref}/>;}\nconst parser =")
markdown.write_text(s)
Path('src/components/repro45Probe.ts').write_text('''import {useEffect} from 'react';
import type {RefObject} from 'react';
type Node = {measureInWindow: (callback: (x: number, y: number, w: number, h: number) => void) => void};
const probes = new Set<() => void>();
(globalThis as typeof globalThis & {repro45Measure?: () => void}).repro45Measure = () => probes.forEach(probe => probe());
export function useRepro45Probe(ref: RefObject<Node | null>, kind: string) {
  useEffect(() => {
    const probe = () => ref.current?.measureInWindow((x, y, w, h) => console.log('REPRO45_' + kind, JSON.stringify({x, y, w, h})));
    probes.add(probe);
    return () => { probes.delete(probe); };
  }, [ref, kind]);
}
''')
