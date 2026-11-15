import type { FileSystemEntry, SessionInfo } from "@opencode/client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { useDebouncedValue } from "../../lib/debounce";
import { directoryFileSearchOptions } from "../../lib/queries/panels";
import { useServerScope } from "../../lib/server-scope";
import type { OpenCodeClient, Capabilities } from "./session-sync";
import type { Panel } from "./types";

const SEARCH_DEBOUNCE_MS = 250;
const NO_RESULTS: FileSystemEntry[] = [];

interface UseFileSearchOptions {
  capabilities: Capabilities;
  opencodeClient: OpenCodeClient;
  panel: Panel;
  session: SessionInfo | null;
  showError: (reason: unknown) => void;
}

export const useFileSearch = ({
  capabilities,
  opencodeClient,
  panel,
  session,
  showError,
}: UseFileSearchOptions) => {
  const scope = useServerScope();
  const [fileQuery, setFileQuery] = useState("");
  const debouncedQuery = useDebouncedValue(fileQuery, SEARCH_DEBOUNCE_MS);
  const directory = session?.location.directory;
  const search = useQuery({
    ...directoryFileSearchOptions(
      scope,
      opencodeClient,
      directory,
      debouncedQuery
    ),
    enabled: panel === "mentions" && capabilities.files,
  });
  const { error, errorUpdatedAt } = search;
  useEffect(() => {
    if (error && errorUpdatedAt) {
      showError(error);
    }
  }, [error, errorUpdatedAt, showError]);
  return {
    fileQuery,
    fileResults: search.data ?? NO_RESULTS,
    fileSearchBusy: search.isFetching || debouncedQuery !== fileQuery,
    setFileQuery,
  };
};
