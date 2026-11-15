import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import type { Client } from "../../lib/client";
import { errorMessageOrNull } from "../../lib/client";
import { projectsOptions } from "../../lib/queries/sessions";
import { useServerScope } from "../../lib/server-scope";

export interface ProjectScope {
  directory: string;
}

interface ProjectsOptions {
  client: Client;
  projectScope: ProjectScope | undefined;
}

export const useProjects = ({ client, projectScope }: ProjectsOptions) => {
  const scope = useServerScope();
  const query = useQuery(projectsOptions(scope, client));
  const [projectDirectory, setProjectDirectory] = useState<string | undefined>(
    projectScope?.directory
  );
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [synced, setSynced] = useState({ client, projectScope });
  const clientChanged = synced.client !== client;
  const scopeChanged = synced.projectScope !== projectScope;
  if (clientChanged || scopeChanged) {
    setSynced({ client, projectScope });
    if (clientChanged) {
      setProjectDirectory(undefined);
      setProjectsOpen(false);
    }
    if (scopeChanged && projectScope) {
      setProjectDirectory(projectScope.directory);
    }
  }
  const { refetch } = query;
  const loadProjects = () => {
    void refetch();
  };
  return {
    loadProjects,
    projectDirectory,
    projects: query.data ?? [],
    projectsError: errorMessageOrNull(query.error),
    projectsLoading: query.isFetching,
    projectsOpen,
    setProjectDirectory,
    setProjectsOpen,
  };
};
