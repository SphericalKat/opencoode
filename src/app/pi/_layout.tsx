import { Stack } from "expo-router";

import { ServerScopeProvider } from "../../lib/server-scope";
import { PiWorkspace } from "../../screens/pi-workspace";
import { useOpenServers } from "../../shell/use-open-servers";
import { useAppLifecycleStore } from "../../stores/app-lifecycle-store";
import {
  useConnectionStore,
  useConnectionStoreApi,
} from "../../stores/connection-store";

const PiLayout = () => {
  const active = useConnectionStore((state) => state.active);
  const connecting = useConnectionStore((state) => state.connecting);
  const foreground = useAppLifecycleStore((state) => state.foreground);
  const connection = useConnectionStoreApi();
  const openServers = useOpenServers();

  if (active?.backend !== "pi") {
    return null;
  }

  return (
    <ServerScopeProvider scope={active.id}>
      <PiWorkspace
        connection={active}
        foreground={foreground && !connecting}
        onManageServers={openServers}
        onConnectionLost={(cause) =>
          connection.getState().recoverConnection(active, cause)
        }
      >
        <Stack screenOptions={{ animation: "none", headerShown: false }} />
      </PiWorkspace>
    </ServerScopeProvider>
  );
};

export default PiLayout;
