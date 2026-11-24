import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import type { Connection } from "../lib/client";
import { makePiChatBackend } from "../lib/pi-chat-backend";
import { createPiClient } from "../lib/pi-client";
import { useServerScope } from "../lib/server-scope";

export const usePiBackend = (connection: Connection) => {
  const queryClient = useQueryClient();
  const scope = useServerScope();
  const client = useMemo(() => createPiClient(connection), [connection]);
  const backend = useMemo(
    () => makePiChatBackend(connection, queryClient, scope, client),
    [connection, queryClient, scope, client]
  );
  return { backend, client };
};
