import type {
  AgentInfo,
  CommandInfo,
  FormInfo,
  ModelInfo,
  PermissionRequest,
  ProviderInfo,
  SessionInboxInfo,
  SkillInfo,
} from "@opencode/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo } from "react";

import type { ChatBackend } from "../../lib/chat-backend";
import { errorMessageOrNull } from "../../lib/client";
import {
  catalogAgentsOptions,
  catalogCommandsOptions,
  catalogDefaultModelOptions,
  catalogModelsOptions,
  catalogProvidersOptions,
  catalogSkillsOptions,
  directoryFormsOptions,
  sessionFormsOptions,
  sessionInboxOptions,
  sessionPermissionsOptions,
  sessionStatusOptions,
} from "../../lib/queries/chat";
import {
  activeSessionsOptions,
  sessionDetailOptions,
} from "../../lib/queries/sessions";
import { queryKeys } from "../../lib/query-keys";
import { useServerScope } from "../../lib/server-scope";

const NO_INBOX: SessionInboxInfo[] = [];
const NO_FORMS: FormInfo[] = [];
const NO_PERMISSIONS: PermissionRequest[] = [];
const NO_MODELS: ModelInfo[] = [];
const NO_PROVIDERS: ProviderInfo[] = [];
const NO_AGENTS: AgentInfo[] = [];
const NO_COMMANDS: CommandInfo[] = [];
const NO_SKILLS: SkillInfo[] = [];

const firstError = (...errors: unknown[]) =>
  errorMessageOrNull(errors.find(Boolean));

interface UseSessionDataOptions {
  backend: ChatBackend;
  foreground: boolean;
  reportConnectionFailure: (reason: unknown) => void;
  sessionID: string;
  visible: boolean;
}

export const useSessionData = ({
  backend,
  foreground,
  reportConnectionFailure,
  sessionID,
  visible,
}: UseSessionDataOptions) => {
  const scope = useServerScope();
  const queryClient = useQueryClient();
  const { capabilities, core, opencodeClient } = backend;
  // A hidden chat observes nothing of its session. An event for a session
  // that a list screen deleted must not refetch it behind the list.
  const live = foreground && visible;
  const detail = useQuery({
    ...sessionDetailOptions(scope, core.session, sessionID),
    enabled: live,
  });
  const directory = detail.data?.location.directory;
  const inbox = useQuery({
    ...sessionInboxOptions(
      scope,
      opencodeClient,
      capabilities.inbox,
      sessionID
    ),
    enabled: live,
  });
  const ownForms = useQuery({
    ...sessionFormsOptions(
      scope,
      opencodeClient,
      capabilities.forms,
      sessionID
    ),
    enabled: live,
  });
  const directoryForms = useQuery(
    directoryFormsOptions(scope, opencodeClient, capabilities.forms, directory)
  );
  const permissions = useQuery({
    ...sessionPermissionsOptions(
      scope,
      opencodeClient,
      capabilities.permissions,
      sessionID
    ),
    enabled: live,
  });
  const active = useQuery({
    ...activeSessionsOptions(scope, core.session),
    select: (running) => !!running[sessionID],
  });
  const status = useQuery(
    sessionStatusOptions(queryClient, scope, core, sessionID)
  );
  const models = useQuery({
    ...catalogModelsOptions(scope, core, directory),
    enabled: live,
  });
  const defaultModel = useQuery({
    ...catalogDefaultModelOptions(scope, core, directory),
    enabled: live,
  });
  const providers = useQuery({
    ...catalogProvidersOptions(scope, opencodeClient, directory),
    enabled: live,
  });
  const agents = useQuery({
    ...catalogAgentsOptions(
      scope,
      opencodeClient,
      capabilities.agents,
      directory
    ),
    enabled: live,
  });
  const commands = useQuery({
    ...catalogCommandsOptions(
      scope,
      opencodeClient,
      capabilities.commands,
      directory
    ),
    enabled: live,
  });
  const skills = useQuery({
    ...catalogSkillsOptions(
      scope,
      opencodeClient,
      capabilities.skills,
      directory
    ),
    enabled: live,
  });
  const forms = useMemo(
    () => [
      ...(ownForms.data ?? NO_FORMS),
      ...(directoryForms.data ?? NO_FORMS),
    ],
    [ownForms.data, directoryForms.data]
  );
  const { error: detailError, errorUpdatedAt } = detail;
  useEffect(() => {
    if (detailError && errorUpdatedAt) {
      reportConnectionFailure(detailError);
    }
  }, [detailError, errorUpdatedAt, reportConnectionFailure]);
  const refresh = useCallback(
    () =>
      Promise.all(
        [
          queryKeys.session.all(scope, sessionID),
          queryKeys.sessions.active(scope),
          ...(directory ? [queryKeys.dir.forms(scope, directory)] : []),
        ].map((queryKey) => queryClient.invalidateQueries({ queryKey }))
      ),
    [directory, queryClient, scope, sessionID]
  );
  const retryCatalog = useCallback(() => {
    if (directory) {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.dir.catalog(scope, directory),
      });
    }
  }, [directory, queryClient, scope]);
  return {
    active: active.data ?? false,
    agents: agents.data ?? NO_AGENTS,
    catalogError: firstError(
      models.error,
      defaultModel.error,
      providers.error,
      agents.error,
      commands.error,
      skills.error
    ),
    commands: commands.data ?? NO_COMMANDS,
    defaultModel: defaultModel.data ?? null,
    detailPending: detail.isPending,
    forms,
    inbox: inbox.data ?? NO_INBOX,
    models: models.data ?? NO_MODELS,
    permissions: permissions.data ?? NO_PERMISSIONS,
    providers: providers.data ?? NO_PROVIDERS,
    queryError: firstError(
      detail.error,
      inbox.error,
      ownForms.error,
      directoryForms.error,
      permissions.error,
      active.error
    ),
    refresh,
    retryCatalog,
    session: detail.data ?? null,
    sessionStatus: status.data ?? null,
    skills: skills.data ?? NO_SKILLS,
  };
};

export type SessionData = ReturnType<typeof useSessionData>;
