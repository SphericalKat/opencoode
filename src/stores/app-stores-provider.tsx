import type { ReactNode } from "react";

import { AppLifecycleStoreProvider } from "./app-lifecycle-store";
import { ChatUiStoreProvider } from "./chat-ui-store";
import { ComposerStoreProvider } from "./composer-store";
import { ConnectionStoreProvider } from "./connection-store";
import { SessionLocationStoreProvider } from "./session-location-store";
import { SessionTabsStoreProvider } from "./session-tabs-store";
import { SheetStoreProvider } from "./sheet-store";

export const AppStoresProvider = ({ children }: { children: ReactNode }) => (
  <ConnectionStoreProvider>
    <AppLifecycleStoreProvider>
      <SheetStoreProvider>
        <SessionLocationStoreProvider>
          <SessionTabsStoreProvider>
            <ChatUiStoreProvider>
              <ComposerStoreProvider>{children}</ComposerStoreProvider>
            </ChatUiStoreProvider>
          </SessionTabsStoreProvider>
        </SessionLocationStoreProvider>
      </SheetStoreProvider>
    </AppLifecycleStoreProvider>
  </ConnectionStoreProvider>
);
