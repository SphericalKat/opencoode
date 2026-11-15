import { Stack, usePathname } from "expo-router";

import type { Connection } from "../../lib/client";
import { PiBus } from "../../lib/live/pi-bus";
import { routes } from "../../lib/routes";
import { ServerScopeProvider, useServerScope } from "../../lib/server-scope";
import { PiWorkspace } from "../../screens/pi-workspace";
import { usePiBackend } from "../../screens/use-pi-backend";
import { useOpenServers } from "../../shell/use-open-servers";
import { useAppLifecycleStore } from "../../stores/app-lifecycle-store";
import {
  useConnectionActions,
  useConnectionStore,
} from "../../stores/connection-store";
import { LiveStoreProvider } from "../../stores/live-store";

interface PiShellProps {
  active: Connection;
  foreground: boolean;
}

const PiShell = ({ active, foreground }: PiShellProps) => {
  const scope = useServerScope();
  const settingsOpen = usePathname().startsWith(routes.piSettings);
  const { markRecovering } = useConnectionActions();
  const openServers = useOpenServers();
  const { backend, client } = usePiBackend(active);
  const onConnectionLost = (cause: unknown) => markRecovering(active, cause);

  return (
    <LiveStoreProvider key={`${active.id}:${active.url}`}>
      <PiBus
        backend={backend}
        foreground={foreground && !settingsOpen}
        scope={scope}
        onConnectionLost={onConnectionLost}
      />
      <PiWorkspace
        backend={backend}
        client={client}
        connection={active}
        foreground={foreground}
        onManageServers={openServers}
        onConnectionLost={onConnectionLost}
      >
        <Stack screenOptions={{ animation: "none", headerShown: false }} />
      </PiWorkspace>
    </LiveStoreProvider>
  );
};

const PiLayout = () => {
  const active = useConnectionStore((state) => state.active);
  const connecting = useConnectionStore((state) => state.connecting);
  const foreground = useAppLifecycleStore((state) => state.foreground);

  if (active?.backend !== "pi") {
    return null;
  }

  return (
    <ServerScopeProvider scope={active.id}>
      <PiShell active={active} foreground={foreground && !connecting} />
    </ServerScopeProvider>
  );
};

export default PiLayout;
