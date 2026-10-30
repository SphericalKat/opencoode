import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { Platform } from 'react-native';

export function ShellIcon({ name, color, size = 20 }: { name: 'menu' | 'close' | 'chevron' | 'back' | 'compose' | 'more' | 'server' | 'refresh'; color: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    {name === 'menu' && <Path d="M4 7h16M4 12h11M4 17h16" stroke={color} strokeWidth={1.5} strokeLinecap="round" />}
    {name === 'close' && <Path d="m6 6 12 12M18 6 6 18" stroke={color} strokeWidth={1.5} strokeLinecap="round" />}
    {name === 'chevron' && <Path d="m9 5 7 7-7 7" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />}
    {name === 'back' && <Path d={Platform.OS === 'android' ? 'M20 12H4m8-8-8 8 8 8' : 'm15 5-7 7 7 7'} stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />}
    {name === 'compose' && <Path d="M12 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-7M16 3l5 5-10 10H6v-5L16 3Z" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />}
    {name === 'more' && <>{[5, 12, 19].map(x => <Circle key={x} cx={x} cy={12} r={1.4} fill={color} />)}</>}
    {name === 'server' && <><Rect x={4} y={4} width={16} height={16} rx={3} stroke={color} strokeWidth={1.5} /><Path d="M4 12h16M8 8h1M8 16h1" stroke={color} strokeWidth={1.5} strokeLinecap="round" /></>}
    {name === 'refresh' && <Path d="M20 7v5h-5M20 12a8 8 0 1 0-2.3 5.7" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />}
  </Svg>;
}
