import { queryOptions } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";

import type { PiSnapshot } from "../../../packages/pi-mobile/protocol";
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

// Window in which a stored snapshot answers `load` without a request.
export const PI_SNAPSHOT_WINDOW_MS = 250;

// One Pi snapshot for each server. The subscription writes newer snapshots
// into the same key. An answer is dropped when a write landed while the
// request ran, unless it is from the same instance and not older. `fresh`
// skips the window.
export const piSnapshotOptions = (
  queryClient: QueryClient,
  scope: Scope,
  load: (signal?: AbortSignal) => Promise<PiSnapshot>,
  fresh = false
) => {
  const queryKey = queryKeys.pi.snapshot(scope);
  return queryOptions({
    queryFn: async ({ signal }) => {
      const startedAt = queryClient.getQueryState(queryKey)?.dataUpdatedAt;
      const value = await load(signal);
      const stored = queryClient.getQueryData<PiSnapshot>(queryKey);
      const changed =
        queryClient.getQueryState(queryKey)?.dataUpdatedAt !== startedAt;
      if (
        stored &&
        changed &&
        !(
          stored.instanceID === value.instanceID &&
          value.cursor >= stored.cursor
        )
      ) {
        return stored;
      }
      return value;
    },
    queryKey,
    staleTime: fresh ? 0 : PI_SNAPSHOT_WINDOW_MS,
    structuralSharing: false,
  });
};
