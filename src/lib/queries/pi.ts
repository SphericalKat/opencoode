import { queryOptions } from "@tanstack/react-query";

import type { PiClient } from "../pi-client";
import { queryKeys } from "../query-keys";
import type { Scope } from "../query-keys";

// The session list is read each time the navigation sheet opens.
export const piSessionsOptions = (
  scope: Scope,
  client: PiClient,
  enabled: boolean
) =>
  queryOptions({
    enabled,
    queryFn: ({ signal }) => client.sessions(signal),
    queryKey: queryKeys.pi.sessions(scope),
    staleTime: 0,
  });
