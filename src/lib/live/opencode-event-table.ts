import type {
  OpenCodeEvent,
  SessionInfo,
  SessionStatus,
} from "@opencode/client";

import { queryKeys } from "../query-keys";
import type { Scope } from "../query-keys";

export type DirTail = "catalog" | "forms" | "pty" | "shells";

// A cache operation that an event causes. The router runs these. The
// `invalidate*` and `refreshHead` operations are debounced for each key.
export type CacheOperation =
  | { kind: "invalidate"; queryKey: readonly unknown[] }
  | { kind: "invalidateDirs"; tail: DirTail }
  | { kind: "invalidateChildren"; parentID?: string }
  | { kind: "refreshHead"; sessionID: string }
  | { kind: "resetMessages"; sessionID: string }
  | { kind: "setActive"; running: boolean; sessionID: string }
  | { kind: "setStatus"; sessionID: string; status: SessionStatus }
  | { kind: "clearRetry"; sessionID: string }
  | { kind: "refreshOpenSessions" }
  | {
      kind: "patchChild";
      patch: Partial<Pick<SessionInfo, "cost" | "title" | "tokens">>;
      sessionID: string;
    }
  | {
      kind: "patchUsage";
      cost: unknown;
      sessionID: string;
      tokens: unknown;
    };

interface Row {
  applies: (type: string) => boolean;
  plan: (
    event: OpenCodeEvent,
    sessionID: string,
    scope: Scope
  ) => CacheOperation[];
}

const types = (...names: string[]) => {
  const set = new Set(names);
  return (type: string) => set.has(type);
};

const EXECUTION_ENDED = types(
  "session.execution.succeeded",
  "session.execution.failed",
  "session.execution.interrupted",
  "session.idle"
);

// The session list refreshes on these events.
const SESSION_LIST_EVENTS = types(
  "session.created",
  "session.renamed",
  "session.archived",
  "session.unarchived",
  "session.deleted",
  "session.forked",
  "session.moved",
  "session.viewed",
  "session.agent.selected",
  "session.model.selected",
  "session.execution.started",
  "session.execution.succeeded",
  "session.execution.failed",
  "session.execution.interrupted",
  "session.inbox.enqueued",
  "session.inbox.delivered",
  "session.shell.started",
  "session.shell.ended"
);

const CHILD_SESSION_EVENTS = types(
  "session.created",
  "session.deleted",
  "session.archived",
  "session.unarchived",
  "session.renamed",
  "session.usage.updated",
  "session.execution.started",
  "session.execution.succeeded",
  "session.execution.failed",
  "session.execution.interrupted"
);

const CATALOG_EVENT =
  /^(?:model|provider|agent|command|skill|credential|config)\./u;

const invalidate = (queryKey: readonly unknown[]): CacheOperation => ({
  kind: "invalidate",
  queryKey,
});

const requestOperations = (
  scope: Scope,
  sessionID: string
): CacheOperation[] => [
  invalidate(queryKeys.session.forms(scope, sessionID)),
  invalidate(queryKeys.session.permissions(scope, sessionID)),
  { kind: "invalidateDirs", tail: "forms" },
];

const endedOperations = (scope: Scope, sessionID: string): CacheOperation[] => [
  { kind: "setActive", running: false, sessionID },
  { kind: "setStatus", sessionID, status: { type: "idle" } },
  { kind: "refreshHead", sessionID },
  invalidate(queryKeys.session.detail(scope, sessionID)),
  invalidate(queryKeys.session.inbox(scope, sessionID)),
  ...requestOperations(scope, sessionID),
  invalidate(queryKeys.sessions.active(scope)),
];

const statusOperations = (
  event: OpenCodeEvent,
  scope: Scope,
  sessionID: string
): CacheOperation[] => {
  if (event.type === "session.status") {
    const { status } = event.data;
    return status.type === "idle"
      ? endedOperations(scope, sessionID)
      : [
          { kind: "setStatus", sessionID, status },
          { kind: "setActive", running: true, sessionID },
        ];
  }
  if (event.type === "session.retry.scheduled") {
    return [
      {
        kind: "setStatus",
        sessionID,
        status: {
          attempt: event.data.attempt,
          message: event.data.error.message,
          next: event.data.at,
          type: "retry",
        },
      },
    ];
  }
  return [];
};

const parentOf = (event: OpenCodeEvent) => {
  const { parentID } = event.data as { parentID?: unknown };
  return typeof parentID === "string" ? parentID : undefined;
};

// Event types to cache operations. Every matching row applies, so an event can
// reach several keys. The router handles `server.connected`, the streamed
// deltas and the assistant-scoped events itself.
const SESSION_ROWS: Row[] = [
  {
    applies: types("session.renamed"),
    plan: (event, sessionID) => [
      {
        kind: "patchChild",
        patch: { title: (event.data as { title: string }).title },
        sessionID,
      },
    ],
  },
  {
    // Old scope "metadata".
    applies: types(
      "session.renamed",
      "session.metadata.updated",
      "session.permissions",
      "session.viewed",
      "session.archived",
      "session.unarchived",
      "session.agent.selected",
      "session.model.selected"
    ),
    plan: (_event, sessionID, scope) => [
      invalidate(queryKeys.session.detail(scope, sessionID)),
    ],
  },
  {
    // Old scope "history": a head refresh, never a plain invalidation.
    applies: types(
      "session.inbox.delivered",
      "session.agent.selected",
      "session.model.selected",
      "session.synthetic",
      "session.skill.activated",
      "session.instructions.updated",
      "session.shell.started",
      "session.shell.ended",
      "session.compaction.started",
      "session.compaction.ended",
      "session.compaction.failed"
    ),
    plan: (_event, sessionID) => [{ kind: "refreshHead", sessionID }],
  },
  {
    // Old scope "inbox".
    applies: types(
      "session.inbox.delivered",
      "session.inbox.enqueued",
      "session.inbox.cancelled",
      "session.inbox.delivery.changed"
    ),
    plan: (_event, sessionID, scope) => [
      invalidate(queryKeys.session.inbox(scope, sessionID)),
    ],
  },
  {
    // Old scope "requests".
    applies: types(
      "permission.asked",
      "permission.replied",
      "form.created",
      "form.replied",
      "form.cancelled"
    ),
    plan: (_event, sessionID, scope) => requestOperations(scope, sessionID),
  },
  {
    applies: types("session.execution.started"),
    plan: (_event, sessionID) => [
      { kind: "setActive", running: true, sessionID },
      { kind: "setStatus", sessionID, status: { type: "busy" } },
    ],
  },
  {
    applies: EXECUTION_ENDED,
    plan: (_event, sessionID, scope) => endedOperations(scope, sessionID),
  },
  {
    applies: types("session.status", "session.retry.scheduled"),
    plan: (event, sessionID, scope) =>
      statusOperations(event, scope, sessionID),
  },
  {
    applies: types("session.usage.updated"),
    plan: (event, sessionID) => {
      const { cost, tokens } = event.data as {
        cost: unknown;
        tokens: unknown;
      };
      return [
        { cost, kind: "patchUsage", sessionID, tokens },
        {
          kind: "patchChild",
          patch: { cost, tokens } as Partial<SessionInfo>,
          sessionID,
        },
      ];
    },
  },
  {
    applies: types("session.revert.committed"),
    plan: (_event, sessionID, scope) => [
      { kind: "resetMessages", sessionID },
      invalidate(queryKeys.session.detail(scope, sessionID)),
    ],
  },
  {
    applies: types(
      "session.moved",
      "session.revert.staged",
      "session.revert.cleared",
      "session.deleted"
    ),
    plan: (_event, sessionID, scope) => [
      invalidate(queryKeys.session.all(scope, sessionID)),
      invalidate(queryKeys.sessions.all(scope)),
    ],
  },
  {
    applies: SESSION_LIST_EVENTS,
    plan: (_event, _sessionID, scope) => [
      invalidate(queryKeys.sessions.all(scope)),
    ],
  },
  {
    applies: CHILD_SESSION_EVENTS,
    plan: (event, _sessionID, scope) => [
      { kind: "invalidateChildren", parentID: parentOf(event) },
      invalidate(queryKeys.sessions.active(scope)),
    ],
  },
];

const DIRECTORY_ROWS: Row[] = [
  {
    // The old chat refreshed its session, the session list and the forms.
    applies: types("location.shutdown"),
    plan: (_event, _sessionID, scope) => [
      invalidate(queryKeys.sessions.all(scope)),
      invalidate(queryKeys.sessions.active(scope)),
      { kind: "invalidateDirs", tail: "forms" },
      { kind: "refreshOpenSessions" },
    ],
  },
  {
    applies: types("persistent-pty.added", "persistent-pty.removed"),
    plan: () => [
      { kind: "invalidateDirs", tail: "shells" },
      { kind: "invalidateDirs", tail: "pty" },
    ],
  },
  {
    applies: (type) => CATALOG_EVENT.test(type) || type === "location.shutdown",
    plan: () => [{ kind: "invalidateDirs", tail: "catalog" }],
  },
  {
    applies: types("form.created", "form.replied", "form.cancelled"),
    plan: () => [{ kind: "invalidateDirs", tail: "forms" }],
  },
  {
    applies: types("pty.created", "pty.updated", "pty.deleted", "pty.exited"),
    plan: () => [
      { kind: "invalidateDirs", tail: "shells" },
      { kind: "invalidateDirs", tail: "pty" },
    ],
  },
];

export const sessionIDOf = (event: OpenCodeEvent): string | undefined => {
  const data = event.data as {
    form?: { sessionID?: unknown };
    sessionID?: unknown;
  };
  const id = data.form?.sessionID ?? data.sessionID;
  return typeof id === "string" ? id : undefined;
};

export const isDeltaEvent = (event: OpenCodeEvent) =>
  event.type.endsWith(".delta") || event.type === "session.tool.progress";

// Lists the cache operations for one event, without running them.
export const planEvent = (
  event: OpenCodeEvent,
  scope: Scope
): CacheOperation[] => {
  const sessionID = sessionIDOf(event);
  const operations: CacheOperation[] = [];
  if (sessionID) {
    for (const row of SESSION_ROWS) {
      if (row.applies(event.type)) {
        operations.push(...row.plan(event, sessionID, scope));
      }
    }
  }
  for (const row of DIRECTORY_ROWS) {
    if (row.applies(event.type)) {
      operations.push(...row.plan(event, "", scope));
    }
  }
  return operations;
};
