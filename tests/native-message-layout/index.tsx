import React, {useEffect, useRef, useState} from 'react';
import {registerRootComponent} from 'expo';
import {Text, View} from 'react-native';
import {FlashList, type FlashListRef} from '@shopify/flash-list';
import {UserMessageBubble} from '../../src/components/UserMessageBubble';
import {Markdown} from '../../src/components/Markdown';
import {ThemeProvider} from '../../src/lib/theme';
import {BetaLayoutContext} from '../../src/lib/betaLayout';

const text = `Initial set of feedback:

1. add a header that says "Latest models" in a row with a refresh button on the right
2. The loading state can be made simpler, just show a circular progress loader
3. Make the widget always respect the system light/dark theme with the default color scheme but if dynamic color color is enabled then pull colors from the wallpaper.`;
type Item = {id: string; target?: boolean; variant?: 'short' | 'attachment'};
type ProbeGlobal = typeof globalThis & {repro45Measure?: () => void};
const fillers = Array.from({length: 35}, (_, i) => ({id: `filler-${i}`}));
function Demo() {
  const [items, setItems] = useState<Item[]>([{id: 'initial', target: true}, ...fillers]);
  const [beta, setBeta] = useState(true);
  const [width, setWidth] = useState(393);
  const list = useRef<FlashListRef<Item>>(null);
  const next = useRef<React.ComponentRef<typeof View>>(null);
  const offset = useRef(0);
  const attachment = useRef<React.ComponentRef<typeof View>>(null);
  useEffect(() => {
    let cancelled = false;
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    const measure = async (w: number, b: boolean, phase: string) => {
      console.log('REPRO45_CASE', JSON.stringify({w, b, phase, offset: offset.current}));
      (globalThis as ProbeGlobal).repro45Measure?.();
      if (phase === 'attachment') attachment.current?.measureInWindow((x, y, w, h) => console.log('REPRO45_ATTACHMENT', JSON.stringify({x, y, w, h})));
      next.current?.measureInWindow((x, y, w, h) => console.log('REPRO45_NEXT', JSON.stringify({x, y, w, h})));
      await delay(500);
    };
    (async () => {
      for (const b of [true, false]) for (const w of [393, 360, 320]) {
        if (cancelled) return;
        setWidth(w); setBeta(b); setItems([{id: `initial-${w}-${b}`, target: true}, ...fillers]);
        list.current?.scrollToOffset({offset: 0, animated: false});
        await delay(1200);
        await measure(w, b, 'initial');
        setItems(previous => [...previous, {id: `sent-${w}-${b}`, target: true}, {id: 'following'}]);
        await delay(700);
        list.current?.scrollToEnd({animated: false});
        await delay(1200);
        await measure(w, b, 'send');
        list.current?.scrollToOffset({offset: 0, animated: false});
        await delay(1200);
        console.log('REPRO45_AWAY', JSON.stringify({w, b, offset: offset.current}));
        list.current?.scrollToEnd({animated: false});
        await delay(1200);
        await measure(w, b, 'scroll');
      }
      for (const variant of ['short', 'attachment'] as const) {
        setWidth(393); setBeta(true); setItems([{id: variant, target: true, variant}, ...fillers]);
        list.current?.scrollToOffset({offset: 0, animated: false});
        await delay(1200);
        await measure(393, true, variant);
      }
    })();
    return () => { cancelled = true; };
  }, []);
  return <BetaLayoutContext.Provider value={beta}><ThemeProvider><View style={{height: 700, width, padding: 16, backgroundColor: '#171717'}}>
    <FlashList ref={list} onScroll={event => { offset.current = event.nativeEvent.contentOffset.y; }} scrollEventThrottle={16} data={items} keyExtractor={item => item.id} getItemType={item => item.target ? 'message' : 'filler'} renderItem={({item, index}) => item.target
      ? <UserMessageBubble withAttachments={item.variant === 'attachment'}><Markdown text={item.variant ? 'A short message' : text}/>{item.variant === 'attachment' && <View ref={attachment} style={{width: '100%', height: 80, backgroundColor: '#555'}}><Text>Attached image</Text></View>}</UserMessageBubble>
      : <View ref={(item.id === 'following' || (index === 1 && items.length === 36)) ? next : undefined} style={{height: 64, marginTop: 16}}><Text>Following transcript item</Text></View>}/>
  </View></ThemeProvider></BetaLayoutContext.Provider>;
}
registerRootComponent(Demo);
