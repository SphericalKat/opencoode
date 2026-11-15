import { ClientError } from "@opencode/client";
import { queryOptions } from "@tanstack/react-query";

import type { Client } from "../client";
import { queryKeys } from "../query-keys";
import type { Scope } from "../query-keys";

const USAGE_STALE_MS = 30_000;

export const USAGE_UNSUPPORTED =
  "Usage limits require OpenCode 2.2.1 or later. Update your server to use this view.";

export const GENERATE_UNSUPPORTED =
  "Standalone generation requires OpenCode 2.2.1 or later. Update your server to use this feature.";

export const isUnsupportedContent = (error: unknown) =>
  error instanceof ClientError && error.reason === "UnsupportedContentType";

export const usageLimitsOptions = (
  scope: Scope,
  client: Client,
  directory: string
) =>
  queryOptions({
    queryFn: async ({ signal }) => {
      try {
        const result = await client.experimental.usage.limits(
          { location: { directory } },
          { signal }
        );
        return result.data;
      } catch (error) {
        throw isUnsupportedContent(error)
          ? new Error(USAGE_UNSUPPORTED, { cause: error })
          : error;
      }
    },
    queryKey: [...queryKeys.dir.all(scope, directory), "usage-limits"],
    refetchOnMount: true,
    staleTime: USAGE_STALE_MS,
  });

export const webSearchProvidersOptions = (
  scope: Scope,
  client: Client,
  directory: string
) =>
  queryOptions({
    queryFn: async ({ signal }) => {
      const result = await client.websearch.providers(
        { location: { directory } },
        { signal }
      );
      return result.data;
    },
    queryKey: [...queryKeys.dir.all(scope, directory), "websearch-providers"],
  });

export const generateModelsOptions = (
  scope: Scope,
  client: Client,
  directory: string
) =>
  queryOptions({
    queryFn: async ({ signal }) => {
      const result = await client.model.list(
        { location: { directory }, types: ["chat", "image"] },
        { signal }
      );
      return result.data.filter((item) => item.enabled);
    },
    queryKey: [...queryKeys.dir.all(scope, directory), "generate-models"],
  });
