import React from 'react';
import Svg, { Path } from 'react-native-svg';

type Name = 'sessions' | 'workspace' | 'settings';

const artwork: Record<Name, { viewBox: string; paths: string[] }> = {
  sessions: {
    viewBox: '0 0 20 20',
    paths: ['M18.3334 10.0003C18.3334 5.57324 15.0927 2.91699 10.0001 2.91699C4.90749 2.91699 1.66675 5.57324 1.66675 10.0003C1.66675 11.1497 2.45578 13.1016 2.5771 13.3949C2.5878 13.4207 2.59839 13.4444 2.60802 13.4706C2.69194 13.6996 3.04282 14.9364 1.66675 16.7684C3.5186 17.6538 5.48526 16.1982 5.48526 16.1982C6.84592 16.9202 8.46491 17.0837 10.0001 17.0837C15.0927 17.0837 18.3334 14.4274 18.3334 10.0003Z'],
  },
  workspace: {
    viewBox: '0 0 16 16',
    paths: ['M1.33337 2V13.3333H14.6667V4H8.66671L6.66671 2H1.33337Z'],
  },
  settings: {
    viewBox: '0 0 16 16',
    paths: ['M7.99998 1.3335L14 4.66683V11.3335L7.99998 14.6668L2 11.3335V4.66683L7.99998 1.3335Z', 'M9.99998 8.00016C9.99998 9.10476 9.10458 10.0002 7.99998 10.0002C6.89538 10.0002 5.99998 9.10476 5.99998 8.00016C5.99998 6.89556 6.89538 6.00016 7.99998 6.00016C9.10458 6.00016 9.99998 6.89556 9.99998 8.00016Z'],
  },
};

export function NavIcon({ name, color, size = 20 }: { name: Name; color: string; size?: number }) {
  const icon = artwork[name];
  return <Svg width={size} height={size} viewBox={icon.viewBox} fill="none" aria-hidden>{icon.paths.map((path, index) => <Path key={index} d={path} stroke={color} strokeWidth={1} strokeLinecap="square" />)}</Svg>;
}
