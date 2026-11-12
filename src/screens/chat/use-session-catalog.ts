import { useEffect, useMemo } from "react";

import { errorMessage } from "../../lib/client";
import type { CoreClient, OpenCodeClient, Capabilities } from "./session-sync";
import type { SessionState } from "./use-session-state";

interface UseSessionCatalogOptions {
  betaLayout: boolean;
  capabilities: Capabilities;
  client: CoreClient;
  foreground: boolean;
  opencodeClient: OpenCodeClient;
  visible: boolean;
  sync: SessionState;
}

export const useSessionCatalog = ({
  betaLayout,
  capabilities,
  client,
  foreground,
  opencodeClient,
  visible,
  sync,
}: UseSessionCatalogOptions) => {
  const {
    session,
    setModels,
    setProviders,
    setAgents,
    setCommands,
    setSkills,
    catalogRevision,
    setCatalogError,
  } = sync;
  const sessionLocationDirectory = session?.location.directory;
  const catalogRequest = useMemo(
    () => ({ directory: sessionLocationDirectory, revision: catalogRevision }),
    [sessionLocationDirectory, catalogRevision]
  );
  useEffect(() => {
    if (!catalogRequest.directory || !foreground || !visible) {
      return;
    }
    const controller = new AbortController();
    const location = { directory: catalogRequest.directory };
    void Promise.allSettled([
      betaLayout && opencodeClient
        ? opencodeClient.provider
            .list({ location }, { signal: controller.signal })
            .then((value) => {
              if (!controller.signal.aborted) {
                setProviders(value.data);
              }
              return value;
            })
        : Promise.resolve(),
      client.model
        .list({ location, types: ["chat"] }, { signal: controller.signal })
        .then((value) => {
          if (!controller.signal.aborted) {
            setModels(value.data);
          }
          return value;
        }),
      opencodeClient && capabilities.agents
        ? opencodeClient.agent
            .list({ location }, { signal: controller.signal })
            .then((value) => {
              if (!controller.signal.aborted) {
                setAgents(value.data);
              }
              return value;
            })
        : Promise.resolve(),
      opencodeClient && capabilities.commands
        ? opencodeClient.command
            .list({ location }, { signal: controller.signal })
            .then((value) => {
              if (!controller.signal.aborted) {
                setCommands(value.data);
              }
              return value;
            })
        : Promise.resolve(),
      opencodeClient && capabilities.skills
        ? opencodeClient.skill
            .list({ location }, { signal: controller.signal })
            .then((value) => {
              if (!controller.signal.aborted) {
                setSkills(value.data);
              }
              return value;
            })
        : Promise.resolve(),
    ]).then((results) => {
      const failed = results.find((result) => result.status === "rejected");
      if (!controller.signal.aborted) {
        setCatalogError(
          failed?.status === "rejected" ? errorMessage(failed.reason) : null
        );
      }
      return results;
    });
    return () => controller.abort();
  }, [
    client,
    opencodeClient,
    capabilities,
    catalogRequest,
    foreground,
    visible,
    betaLayout,
    setModels,
    setProviders,
    setCatalogError,
    setSkills,
    setAgents,
    setCommands,
  ]);
};
