import './src/lib/polyfills';
import { registerRootComponent } from 'expo';
import { fetch as expoFetch } from 'expo/fetch';

import App from './App';

globalThis.fetch = expoFetch;
registerRootComponent(App);
