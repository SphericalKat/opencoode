import type {
  AgentInfo,
  CommandInfo,
  FormInfo,
  ModelInfo,
  PermissionRequest,
  ProviderInfo,
  SessionInboxInfo,
  SessionInfo,
  SessionMessageAssistant,
  SessionMessageInfo,
  SessionStatus,
  SkillInfo,
} from "@opencode/client";
import { useRef, useState } from "react";

import type { ChatBackend } from "../../lib/chat-backend";
import type { SyncScope } from "./types";
import { noop } from "./util";

export const useSessionState = (backend: ChatBackend) => {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [messages, setMessages] = useState<SessionMessageInfo[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [inbox, setInbox] = useState<SessionInboxInfo[]>([]);
  const [forms, setForms] = useState<FormInfo[]>([]);
  const [permissions, setPermissions] = useState<PermissionRequest[]>([]);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [commands, setCommands] = useState<CommandInfo[]>([]);
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [catalogRevision, setCatalogRevision] = useState(0);
  const [active, setActive] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [syncErrors, setSyncErrors] = useState<
    Partial<Record<SyncScope, string>>
  >({});
  const [streamStatus, setStreamStatus] = useState("Connecting");
  const [activityNotice, setActivityNotice] = useState(backend.activityNotice);
  const [backendWaiting, setBackendWaiting] = useState<{
    kind: "approval" | "question";
    title: string;
  }>();
  const refreshRef = useRef<() => void>(noop);
  const flushStreamRef = useRef<() => void>(noop);
  const requestVersionRef = useRef(0);
  const sessionDirectoryRef = useRef<string | undefined>(undefined);
  const liveMessagesRef = useRef(new Map<string, SessionMessageAssistant>());
  const historyEpochRef = useRef(1);
  const activityRevisionRef = useRef(0);
  const appliedHistoryEpochRef = useRef(0);
  const refreshingRef = useRef<Promise<void> | null>(null);
  const refreshAgainRef = useRef(false);
  return {
    active,
    activityNotice,
    activityRevisionRef,
    agents,
    appliedHistoryEpochRef,
    backendWaiting,
    catalogError,
    catalogRevision,
    commands,
    cursor,
    fetchError,
    flushStreamRef,
    forms,
    historyEpochRef,
    inbox,
    liveMessagesRef,
    loading,
    messages,
    models,
    permissions,
    providers,
    refreshAgainRef,
    refreshRef,
    refreshingRef,
    requestVersionRef,
    session,
    sessionDirectoryRef,
    sessionStatus,
    setActive,
    setActivityNotice,
    setAgents,
    setBackendWaiting,
    setCatalogError,
    setCatalogRevision,
    setCommands,
    setCursor,
    setFetchError,
    setForms,
    setInbox,
    setLoading,
    setMessages,
    setModels,
    setPermissions,
    setProviders,
    setSession,
    setSessionStatus,
    setSkills,
    setStreamStatus,
    setSyncErrors,
    skills,
    streamStatus,
    syncErrors,
  };
};

export type SessionState = ReturnType<typeof useSessionState>;
