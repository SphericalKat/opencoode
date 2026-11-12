"""Add measurement probes to a disposable copy of the production components."""
from pathlib import Path

bubble = Path('src/components/UserMessageBubble.tsx')
s = bubble.read_text().replace("import React from 'react';", "import React, {useRef} from 'react';")
s = s.replace('  const { colors } = useTheme();', '  const { colors } = useTheme(); const probe=useRef<View>(null);')
s = s.replace('<View style=', "<View ref={probe} onLayout={()=>setTimeout(()=>probe.current?.measureInWindow((x,y,w,h)=>console.log('REPRO45_BUBBLE',JSON.stringify({x,y,w,h}))),200)} style=")
bubble.write_text(s)
markdown = Path('src/components/Markdown.tsx')
s = markdown.read_text().replace(' Text, View,', ' Text as NativeText, View,')
s = s.replace('const parser =', "function Text(props: React.ComponentProps<typeof NativeText>){const ref=React.useRef<NativeText>(null);return <NativeText {...props} ref={ref} onLayout={()=>setTimeout(()=>ref.current?.measureInWindow((x,y,w,h)=>console.log('REPRO45_TEXT',JSON.stringify({x,y,w,h}))),300)}/>;}\nconst parser =")
markdown.write_text(s)
