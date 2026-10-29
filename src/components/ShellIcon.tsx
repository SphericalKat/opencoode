import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

export function ShellIcon({ name, color, size = 20 }: { name: 'menu' | 'close' | 'chevron' | 'server'; color: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    {name === 'menu' && <Path d="M4 7h16M4 12h11M4 17h16" stroke={color} strokeWidth={1.5} strokeLinecap="round" />}
    {name === 'close' && <Path d="m6 6 12 12M18 6 6 18" stroke={color} strokeWidth={1.5} strokeLinecap="round" />}
    {name === 'chevron' && <Path d="m9 5 7 7-7 7" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />}
    {name === 'server' && <><Rect x={4} y={4} width={16} height={16} rx={3} stroke={color} strokeWidth={1.5} /><Path d="M4 12h16M8 8h1M8 16h1" stroke={color} strokeWidth={1.5} strokeLinecap="round" /></>}
  </Svg>;
}
