import type { FileSystemEntry, SessionInfo } from "@opencode/client";
import { useEffect, useState } from "react";

import type { OpenCodeClient, Capabilities } from "./session-sync";
import type { Panel } from "./types";

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
  const [fileQuery, setFileQuery] = useState("");
  const [fileResults, setFileResults] = useState<FileSystemEntry[]>([]);
  const [fileSearchBusy, setFileSearchBusy] = useState(false);
  const sessionLocationDirectory = session?.location.directory;
  useEffect(() => {
    if (
      panel !== "mentions" ||
      !sessionLocationDirectory ||
      !opencodeClient ||
      !capabilities.files
    ) {
      return;
    }
    const findFiles = opencodeClient.file.find.bind(opencodeClient.file);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setFileSearchBusy(true);
      void findFiles(
        {
          limit: 40,
          location: { directory: sessionLocationDirectory },
          query: fileQuery,
          type: "file",
        },
        { signal: controller.signal }
      )
        .then((value) => {
          if (!controller.signal.aborted) {
            setFileResults(value.data);
          }
          return value;
        })
        .catch((error_) => {
          if (!controller.signal.aborted) {
            showError(error_);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setFileSearchBusy(false);
          }
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    panel,
    opencodeClient,
    capabilities.files,
    sessionLocationDirectory,
    fileQuery,
    showError,
  ]);

  return { fileQuery, fileResults, fileSearchBusy, setFileQuery };
};
