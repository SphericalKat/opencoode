import React, { useEffect, useState } from 'react';
import { useFonts } from 'expo-font';
import { registerRootComponent } from 'expo';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SheetCoordinatorProvider } from '../../src/lib/sheets';
import { View } from 'react-native';
import type { SessionMessageAssistant } from '@opencode/client';
import { AssistantTurn } from '../../src/components/AssistantTurn';
import { ThemeProvider } from '../../src/lib/theme';
import { createPiClient } from '../../src/lib/piClient';
import { makePiChatBackend } from '../../src/lib/piChatBackend';
import { makeOpenCodeChatBackend } from '../../src/lib/chatBackend';
import { createClient } from '../../src/lib/client';
import { projectLiveEvent } from '../../src/lib/chat';

// Browser fixture renders the production conversation components; no app route is added.
Object.assign(globalThis, { createPiClient, makePiChatBackend, makeOpenCodeChatBackend, createClient, projectLiveEvent });
const png = (globalThis as typeof globalThis & { fixtureImage?: string }).fixtureImage || 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
function Demo() {
  const [mime, setMime] = useState('image/png');
  useEffect(() => {
    const update = () => setMime('image/jpeg');
    addEventListener('fixture-mime', update);
    return () => removeEventListener('fixture-mime', update);
  }, []);
  const [fontsReady] = useFonts({ Inter: require('../../assets/fonts/Inter.ttf'), IBMPlexMono: require('../../assets/fonts/IBMPlexMono-Text.ttf') });
  const scenario = new URLSearchParams(location.search).get('scenario') || 'single';
  const files = scenario === 'multiple' ? ['First.png', 'Second.png', 'Third.png'] : ['Screenshot.png'];
  const message: SessionMessageAssistant = {
    id: 'assistant', type: 'assistant', agent: 'build', model: { id: 'model', providerID: 'provider' }, time: { created: 1 },
    content: [{ type: 'tool', id: 'capture', name: 'screenshot', time: { created: 1 }, state: { status: 'completed', input: {}, content: [
      { type: 'text', text: 'Screenshot captured successfully' },
      ...files.map(name => ({ type: 'file' as const, name, mime, uri: ['unavailable', 'loading', 'undecodable'].includes(scenario) ? `${location.origin}/fixture-image.png` : `data:image/png;base64,${png}` })),
      { type: 'file', name: 'report.txt', mime: 'text/plain', uri: 'data:text/plain,report' },
    ] } }, { type: 'text', text: 'The screenshot is ready for review.' }],
  };
  if (scenario === 'tools') {
    const first = message.content[0];
    if (first.type === 'tool') message.content.splice(1, 0, { ...first, id: 'read', name: 'read', state: { ...first.state, status: 'completed', input: { path: '/project/result.png' }, content: [{ type: 'file', name: 'Result.png', mime: 'image/png', uri: `data:image/png;base64,${png}` }] } });
  }
  if (!fontsReady) return null;
  return <SafeAreaProvider><KeyboardProvider><ThemeProvider><SheetCoordinatorProvider><View style={{ padding: 16, backgroundColor: '#171717', minHeight: '100%' }}><AssistantTurn turn={{ type: 'assistant-turn', id: 'turn', messages: [message] }} animate={false} directory="/project" renderSource={(_message, key, content) => <View key={key}>{content}</View>} /></View></SheetCoordinatorProvider></ThemeProvider></KeyboardProvider></SafeAreaProvider>;
}
registerRootComponent(Demo);
