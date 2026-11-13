import type { Project } from "@opencode/client";
import { useCallback, useEffect, useRef, useState } from "react";

import { errorMessage } from "../../lib/client";
import type { Client } from "../../lib/client";
import { useMounted } from "./use-mounted";

export interface ProjectScope {
  directory: string;
  revision: number;
}

const settleProjects = async (
  client: Client,
  signal: AbortSignal | undefined
): Promise<{ items: Project[] } | { error: unknown }> => {
  try {
    return { items: await client.project.list(undefined, { signal }) };
  } catch (error_) {
    return { error: error_ };
  }
};

interface ProjectsOptions {
  betaHome: boolean;
  client: Client;
  projectScope: ProjectScope | undefined;
}

export const useProjects = ({
  betaHome,
  client,
  projectScope,
}: ProjectsOptions) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectDirectory, setProjectDirectory] = useState<string | undefined>(
    betaHome && projectScope ? projectScope.directory : undefined
  );
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [projectsLoading, setProjectsLoading] = useState(betaHome);
  const [projectsError, setProjectsError] = useState<string>();
  const mounted = useMounted();
  const latestClient = useRef(client);

  const [synced, setSynced] = useState({ betaHome, client, projectScope });
  const clientChanged = synced.client !== client;
  const modeChanged = synced.betaHome !== betaHome;
  const scopeChanged = modeChanged || synced.projectScope !== projectScope;
  if (clientChanged || scopeChanged) {
    setSynced({ betaHome, client, projectScope });
    if (clientChanged || modeChanged) {
      setProjectDirectory(undefined);
      setProjects([]);
      setProjectsOpen(false);
      setProjectsLoading(betaHome);
      setProjectsError(undefined);
    }
    if (scopeChanged && betaHome && projectScope) {
      setProjectDirectory(projectScope.directory);
    }
  }

  useEffect(() => {
    latestClient.current = client;
  }, [client]);

  const applyProjects = useCallback(
    (
      result: Awaited<ReturnType<typeof settleProjects>>,
      signal: AbortSignal | undefined
    ) => {
      if (
        signal?.aborted ||
        !mounted.current ||
        latestClient.current !== client
      ) {
        return;
      }
      if ("items" in result) {
        setProjects(result.items);
      } else {
        setProjectsError(errorMessage(result.error));
      }
      setProjectsLoading(false);
    },
    [client, mounted]
  );

  const loadProjects = async (signal?: AbortSignal) => {
    setProjectsLoading(true);
    setProjectsError(undefined);
    applyProjects(await settleProjects(client, signal), signal);
  };

  useEffect(() => {
    if (!betaHome) {
      return;
    }
    const controller = new AbortController();
    void settleProjects(client, controller.signal).then((result) =>
      applyProjects(result, controller.signal)
    );
    return () => controller.abort();
  }, [betaHome, client, applyProjects]);

  return {
    loadProjects,
    projectDirectory,
    projects,
    projectsError,
    projectsLoading,
    projectsOpen,
    setProjectDirectory,
    setProjectsOpen,
  };
};
