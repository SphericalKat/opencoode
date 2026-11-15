import { QueryClient } from "@tanstack/react-query";

// Matches the desktop app: an in-memory cache with no persister, and no
// automatic refetch on mount, window focus or reconnect. Each query sets its
// own `staleTime`. React Native never reports a window focus change, so
// polling queries gate themselves on the app lifecycle instead.
export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnMount: false,
        refetchOnReconnect: false,
        refetchOnWindowFocus: false,
      },
    },
  });
