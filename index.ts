import { registerRootComponent } from "expo";
import { fetch as expoFetch } from "expo/fetch";

import app from "./app";

globalThis.fetch = expoFetch;
registerRootComponent(app);
