import { fetch as expoFetch } from "expo/fetch";

// SSE needs the streaming fetch from expo/fetch. Import this module first in the root layout.
globalThis.fetch = expoFetch;
