import type {
  FormInfo,
  OpenCodeEvent,
  PermissionRequest,
  SessionInboxInfo,
  SessionInfo,
  SessionMessageInfo,
  SessionStatus,
} from "@opencode/client";
import React from "react";

import { isAssistantProgress } from "../../lib/chat";
import type { ChatBackend, ChatBackendSnapshot } from "../../lib/chat-backend";
import { errorMessage } from "../../lib/client";
import type { createStreamBatch } from "../../lib/stream-batch";
import type { SyncScope } from "./types";
import { settle } from "./util";

export type CoreClient = ChatBackend["core"];
export type OpenCodeClient = ChatBackend["opencodeClient"];
export type Capabilities = ChatBackend["capabilities"];
export type StreamBatch<T> = ReturnType<typeof createStreamBatch<T>>;
export type SyncErrors = Partial<Record<SyncScope, string>>;

export const PAGE_SIZE = 80;

export const mergeForms = (
  previous: FormInfo[],
  own: PromiseSettledResult<FormInfo[] | undefined>,
  global: PromiseSettledResult<{ data: FormInfo[] } | undefined>,
  sessionID: string
) => [
  ...(own.status === "fulfilled" && own.value
    ? own.value
    : previous.filter((form) => form.sessionID === sessionID)),
  ...(global.status === "fulfilled" && global.value
    ? global.value.data.filter((form) => form.sessionID === "global")
    : previous.filter((form) => form.sessionID === "global")),
];

export const nextCursor = (page: {
  cursor: { next?: string | null };
  data: unknown[];
}) =>
  page.data.length === PAGE_SIZE ? (page.cursor.next ?? undefined) : undefined;

export const fetchErrorOf = (
  results: readonly PromiseSettledResult<unknown>[]
) => {
  const failed = results.find((result) => result.status === "rejected");
  return failed?.status === "rejected" ? errorMessage(failed.reason) : null;
};

export const withoutScopeError = (errors: SyncErrors, scope: SyncScope) =>
  Object.fromEntries(
    Object.entries(errors).filter(([key]) => key !== scope)
  ) as SyncErrors;

export const fetchSessionSnapshot = (
  client: CoreClient,
  opencodeClient: OpenCodeClient,
  capabilities: Capabilities,
  sessionID: string,
  opts: { signal?: AbortSignal }
) => {
  const sessionRequest = client.session.get({ sessionID }, opts);
  return Promise.allSettled([
    sessionRequest,
    client.message.list({ limit: PAGE_SIZE, order: "desc", sessionID }, opts),
    opencodeClient && capabilities.inbox
      ? opencodeClient.session.inbox.list({ sessionID }, opts)
      : undefined,
    opencodeClient && capabilities.forms
      ? opencodeClient.session.form.list({ sessionID }, opts)
      : undefined,
    opencodeClient && capabilities.permissions
      ? opencodeClient.permission.list({ sessionID }, opts)
      : undefined,
    client.session.active(opts),
    opencodeClient && capabilities.forms
      ? sessionRequest.then((info) =>
          opencodeClient.form.list(
            { location: { directory: info.location.directory } },
            opts
          )
        )
      : undefined,
  ] as const);
};

export interface ScopeDeps {
  applyMessageSnapshot: (snapshot: SessionMessageInfo[]) => void;
  capabilities: Capabilities;
  client: CoreClient;
  current: () => boolean;
  opencodeClient: OpenCodeClient;
  scheduleRefresh: () => void;
  sessionDirectory: { current: string | undefined };
  sessionID: string;
  setForms: React.Dispatch<React.SetStateAction<FormInfo[]>>;
  setInbox: (inbox: SessionInboxInfo[]) => void;
  setPermissions: (permissions: PermissionRequest[]) => void;
  setSession: (session: SessionInfo) => void;
  signal: AbortSignal;
}

export const loadMetadataScope = async (deps: ScopeDeps) => {
  const info = await deps.client.session.get(
    { sessionID: deps.sessionID },
    { signal: deps.signal }
  );
  if (!deps.current()) {
    return false;
  }
  deps.sessionDirectory.current = info.location.directory;
  deps.setSession(info);
  return true;
};

export const loadHistoryScope = async (deps: ScopeDeps) => {
  const page = await deps.client.message.list(
    { limit: PAGE_SIZE, order: "desc", sessionID: deps.sessionID },
    { signal: deps.signal }
  );
  if (!deps.current()) {
    return false;
  }
  deps.applyMessageSnapshot(page.data);
  return true;
};

export const loadInboxScope = async (deps: ScopeDeps) => {
  if (!deps.opencodeClient || !deps.capabilities.inbox) {
    return false;
  }
  const inboxItems = await deps.opencodeClient.session.inbox.list(
    { sessionID: deps.sessionID },
    { signal: deps.signal }
  );
  if (!deps.current()) {
    return false;
  }
  deps.setInbox(inboxItems);
  return true;
};

export const loadRequestsScope = async (deps: ScopeDeps) => {
  const { capabilities, opencodeClient, sessionID } = deps;
  if (!opencodeClient) {
    return false;
  }
  const directory = deps.sessionDirectory.current;
  if (!directory) {
    deps.scheduleRefresh();
    return false;
  }
  const options = { signal: deps.signal };
  const [own, permissionResult, global] = await Promise.allSettled([
    capabilities.forms
      ? opencodeClient.session.form.list({ sessionID }, options)
      : undefined,
    capabilities.permissions
      ? opencodeClient.permission.list({ sessionID }, options)
      : undefined,
    capabilities.forms
      ? opencodeClient.form.list({ location: { directory } }, options)
      : undefined,
  ] as const);
  if (!deps.current()) {
    return false;
  }
  if (permissionResult.status === "fulfilled" && permissionResult.value) {
    deps.setPermissions(permissionResult.value);
  }
  if (capabilities.forms) {
    deps.setForms((previous) => mergeForms(previous, own, global, sessionID));
  }
  const failure = [own, permissionResult, global].find(
    (result) => result.status === "rejected"
  );
  if (failure?.status === "rejected") {
    throw failure.reason;
  }
  return true;
};

export const SCOPE_LOADERS: Record<
  SyncScope,
  (deps: ScopeDeps) => Promise<boolean>
> = {
  history: loadHistoryScope,
  inbox: loadInboxScope,
  metadata: loadMetadataScope,
  requests: loadRequestsScope,
};

export const CATALOG_EVENT =
  /^(?:model|provider|agent|command|skill|credential|config)\./u;
export const EXECUTION_ENDED = new Set([
  "session.execution.succeeded",
  "session.execution.failed",
  "session.execution.interrupted",
  "session.idle",
]);
export const REFRESH_ONLY = new Set([
  "session.moved",
  "session.revert.staged",
  "session.revert.cleared",
  "session.deleted",
]);
export const SCOPE_ROUTES = new Map<string, SyncScope[]>([
  ["permission.asked", ["requests"]],
  ["permission.replied", ["requests"]],
  ["form.replied", ["requests"]],
  ["form.cancelled", ["requests"]],
  ["session.inbox.delivered", ["inbox", "history"]],
  ["session.inbox.enqueued", ["inbox"]],
  ["session.inbox.cancelled", ["inbox"]],
  ["session.inbox.delivery.changed", ["inbox"]],
  ["session.agent.selected", ["metadata", "history"]],
  ["session.model.selected", ["metadata", "history"]],
  ["session.renamed", ["metadata"]],
  ["session.metadata.updated", ["metadata"]],
  ["session.permissions", ["metadata"]],
  ["session.viewed", ["metadata"]],
  ["session.archived", ["metadata"]],
  ["session.unarchived", ["metadata"]],
  ["session.synthetic", ["history"]],
  ["session.skill.activated", ["history"]],
  ["session.instructions.updated", ["history"]],
  ["session.shell.started", ["history"]],
  ["session.shell.ended", ["history"]],
  ["session.compaction.started", ["history"]],
  ["session.compaction.ended", ["history"]],
  ["session.compaction.failed", ["history"]],
]);

export interface LiveContext {
  activityRevision: { current: number };
  applyEvents: (events: OpenCodeEvent[]) => void;
  backend: ChatBackend;
  client: CoreClient;
  connectionFailures: { current: number };
  flushPending: () => void;
  live: {
    attempts: number;
    retryResolve?: () => void;
    retryTimer?: ReturnType<typeof setTimeout>;
  };
  refresh: (signal?: AbortSignal) => Promise<void>;
  reportConnectionFailure: (reason: unknown) => void;
  resetHistory: () => void;
  scheduleRefresh: () => void;
  scheduleScope: (scope: SyncScope) => void;
  sessionDirectory: { current: string | undefined };
  sessionID: string;
  setActive: (active: boolean) => void;
  setCatalogRevision: React.Dispatch<React.SetStateAction<number>>;
  setFetchError: (message: string | null) => void;
  setSession: React.Dispatch<React.SetStateAction<SessionInfo | null>>;
  setSessionStatus: React.Dispatch<React.SetStateAction<SessionStatus | null>>;
  setStreamStatus: (status: string) => void;
  signal: AbortSignal;
  snapshots: StreamBatch<ChatBackendSnapshot>;
  stream: StreamBatch<OpenCodeEvent>;
}

export const routeSessionEvent = (event: OpenCodeEvent, ctx: LiveContext) => {
  if (event.type === "session.execution.started") {
    ctx.activityRevision.current += 1;
    ctx.setActive(true);
    ctx.setSessionStatus({ type: "busy" });
    return;
  }
  if (event.type === "session.usage.updated") {
    const { cost, tokens } = event.data;
    ctx.setSession((previous) =>
      previous ? { ...previous, cost, tokens } : previous
    );
    return;
  }
  if (EXECUTION_ENDED.has(event.type)) {
    ctx.activityRevision.current += 1;
    ctx.setActive(false);
    ctx.setSessionStatus({ type: "idle" });
    ctx.scheduleRefresh();
    return;
  }
  if (event.type === "session.revert.committed") {
    ctx.resetHistory();
    ctx.scheduleRefresh();
    return;
  }
  if (REFRESH_ONLY.has(event.type)) {
    ctx.scheduleRefresh();
    return;
  }
  for (const scope of SCOPE_ROUTES.get(event.type) ?? []) {
    ctx.scheduleScope(scope);
  }
};

export const handleSessionStatusEvent = (
  event: OpenCodeEvent,
  ctx: LiveContext
) => {
  if (event.type === "session.status") {
    ctx.activityRevision.current += 1;
    ctx.setSessionStatus(event.data.status);
    ctx.setActive(event.data.status.type !== "idle");
    if (event.data.status.type === "idle") {
      ctx.scheduleRefresh();
    }
    return true;
  }
  if (event.type === "session.retry.scheduled") {
    ctx.activityRevision.current += 1;
    ctx.setSessionStatus({
      attempt: event.data.attempt,
      message: event.data.error.message,
      next: event.data.at,
      type: "retry",
    });
  } else if (isAssistantProgress(event)) {
    ctx.setSessionStatus((current) =>
      current?.type === "retry" ? { type: "busy" } : current
    );
  }
  return false;
};

export const handleSessionEvent = (
  event: OpenCodeEvent,
  data: Record<string, unknown>,
  ctx: LiveContext
) => {
  if (handleSessionStatusEvent(event, ctx)) {
    return true;
  }
  if (event.type === "session.compaction.delta") {
    return true;
  }
  if (event.type.endsWith(".delta") || event.type === "session.tool.progress") {
    ctx.stream.push(event);
    return true;
  }
  ctx.stream.flush();
  if ("assistantMessageID" in data) {
    ctx.applyEvents([event]);
    return true;
  }
  routeSessionEvent(event, ctx);
  return false;
};

export const eventFormSession = (event: OpenCodeEvent) => {
  if (event.type === "form.created") {
    return event.data.form.sessionID;
  }
  return event.type === "form.replied" || event.type === "form.cancelled"
    ? event.data.sessionID
    : undefined;
};

export const scheduleFormScope = (event: OpenCodeEvent, ctx: LiveContext) => {
  const formSession = eventFormSession(event);
  const sameDirectory =
    !event.location?.directory ||
    event.location.directory === ctx.sessionDirectory.current;
  if (
    formSession === ctx.sessionID ||
    (formSession === "global" && sameDirectory)
  ) {
    ctx.scheduleScope("requests");
  }
};

export const handleLiveEvent = (event: OpenCodeEvent, ctx: LiveContext) => {
  ctx.setStreamStatus("Live");
  ctx.connectionFailures.current = 0;
  ctx.live.attempts = 0;
  if (event.type === "server.connected") {
    ctx.stream.flush();
    ctx.setSessionStatus(null);
    ctx.resetHistory();
    ctx.scheduleRefresh();
    return;
  }
  const data = event.data as Record<string, unknown>;
  if (event.type === "location.shutdown" || CATALOG_EVENT.test(event.type)) {
    ctx.setCatalogRevision((value) => value + 1);
  }
  if (data.sessionID === ctx.sessionID) {
    if (handleSessionEvent(event, data, ctx)) {
      return;
    }
  } else if (event.type === "location.shutdown") {
    ctx.scheduleRefresh();
  }
  scheduleFormScope(event, ctx);
};

export const consumeStream = async <T>(
  iterable: AsyncIterable<T>,
  signal: AbortSignal,
  onItem: (item: T) => void
) => {
  for await (const item of iterable) {
    if (signal.aborted) {
      break;
    }
    onItem(item);
  }
};

export const connectOnce = async (ctx: LiveContext) => {
  const { signal } = ctx;
  ctx.setStreamStatus(ctx.live.attempts ? "Reconnecting" : "Connecting");
  if (ctx.backend.subscribe) {
    await consumeStream(
      ctx.backend.subscribe({ signal }),
      signal,
      (snapshot) => {
        ctx.live.attempts = 0;
        ctx.connectionFailures.current = 0;
        ctx.snapshots.push(snapshot);
      }
    );
  } else {
    if (!ctx.client.event) {
      throw new Error("This connection does not provide live updates");
    }
    await consumeStream(
      ctx.client.event.subscribe({ signal }),
      signal,
      (event) => handleLiveEvent(event, ctx)
    );
  }
  if (!signal.aborted) {
    throw new Error("The live connection closed");
  }
};

export const waitForRetry = (ctx: LiveContext, delay: number) => {
  const { promise, resolve } = Promise.withResolvers<null>();
  const finish = () => resolve(null);
  ctx.live.retryResolve = finish;
  ctx.live.retryTimer = setTimeout(finish, delay);
  return promise;
};

export const recoverFromFailure = async (reason: unknown, ctx: LiveContext) => {
  ctx.flushPending();
  if (ctx.signal.aborted) {
    return;
  }
  ctx.setStreamStatus("Reconnecting");
  ctx.reportConnectionFailure(reason);
  if (ctx.live.attempts > 1) {
    ctx.setFetchError(errorMessage(reason));
  }
  const delay = Math.min(1000 * 2 ** ctx.live.attempts, 15_000);
  ctx.live.attempts += 1;
  await waitForRetry(ctx, delay);
  if (!ctx.signal.aborted) {
    await ctx.refresh(ctx.signal);
  }
};

export const runLiveLoop = async (ctx: LiveContext): Promise<void> => {
  if (ctx.signal.aborted) {
    return;
  }
  await settle(
    () => connectOnce(ctx),
    (reason) => recoverFromFailure(reason, ctx)
  );
  await runLiveLoop(ctx);
};

export const startLive = async (ctx: LiveContext) => {
  await ctx.refresh(ctx.signal);
  await runLiveLoop(ctx);
};
