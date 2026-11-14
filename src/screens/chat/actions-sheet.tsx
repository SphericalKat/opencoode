import type { SessionInfo } from "@opencode/client";

import { promptText } from "../../components/dialog";
import { SheetGroup, SheetRow } from "../../components/list-sheet";
import { useUndoableRemoval } from "../../components/snackbar";
import { BodyText, ErrorNotice, Sheet } from "../../components/ui";
import { sessionLabel } from "../../lib/session-title";
import { agentLabel, modelSummary } from "./labels";
import type { ChatController } from "./use-chat-controller";

const SHEET_CONTENT_STYLE = { gap: 12, paddingTop: 4 } as const;

const TITLE_STYLE = {
  fontSize: 15,
  fontWeight: "500",
  lineHeight: 22,
  paddingHorizontal: 14,
} as const;

type ToolLinksProps = Pick<
  ChatController,
  | "capabilities"
  | "inspect"
  | "opencodeClient"
  | "setBackgroundDirectory"
  | "setBackgroundShellID"
  | "setPanel"
  | "setSideQuestion"
>;

export const ToolLinks = ({
  capabilities,
  inspect,
  opencodeClient,
  setBackgroundDirectory,
  setBackgroundShellID,
  setPanel,
  setSideQuestion,
}: ToolLinksProps) =>
  opencodeClient &&
  (capabilities.diff ||
    capabilities.background ||
    capabilities.children ||
    capabilities.sideQuestion) && (
    <SheetGroup variant="menu" title="Tools">
      {capabilities.diff && (
        <SheetRow
          label="File changes"
          trailing="chevron"
          onPress={() => {
            void inspect("diff");
          }}
        />
      )}
      {capabilities.background && (
        <SheetRow
          label="Background commands"
          trailing="chevron"
          onPress={() => {
            setBackgroundShellID(undefined);
            setBackgroundDirectory(undefined);
            setPanel("background");
          }}
        />
      )}
      {capabilities.children && (
        <SheetRow
          label="Child sessions"
          trailing="chevron"
          onPress={() => setPanel("children")}
        />
      )}
      {capabilities.sideQuestion && (
        <SheetRow
          label="Side question"
          value="/btw"
          trailing="chevron"
          onPress={() => {
            setSideQuestion(undefined);
            setPanel("btw");
          }}
        />
      )}
    </SheetGroup>
  );

interface ConfigureLinksProps extends Pick<
  ChatController,
  "agents" | "capabilities" | "currentModel" | "opencodeClient" | "setPanel"
> {
  session: SessionInfo;
}

export const ConfigureLinks = ({
  agents,
  capabilities,
  currentModel,
  opencodeClient,
  session,
  setPanel,
}: ConfigureLinksProps) => (
  <SheetGroup variant="menu" title="Configure">
    <SheetRow label="Agent" value={agentLabel(agents, session)} />
    <SheetRow
      label="Model"
      value={modelSummary(session, currentModel)}
      trailing="chevron"
      onPress={() => setPanel("models")}
    />
    {opencodeClient && capabilities.instructions && (
      <SheetRow
        label="Instructions"
        trailing="chevron"
        onPress={() => setPanel("instructions")}
      />
    )}
    {opencodeClient && capabilities.schedules && (
      <SheetRow
        label="Schedules"
        trailing="chevron"
        onPress={() => setPanel("schedules")}
      />
    )}
  </SheetGroup>
);

type DetailLinksProps = Pick<
  ChatController,
  "capabilities" | "exportSession" | "inspect" | "opencodeClient" | "setPanel"
>;

export const DetailLinks = ({
  capabilities,
  exportSession,
  inspect,
  opencodeClient,
  setPanel,
}: DetailLinksProps) => (
  <SheetGroup variant="menu" title="Details">
    {capabilities.statistics && (
      <SheetRow
        label="Session statistics"
        trailing="chevron"
        onPress={() => setPanel("stats")}
      />
    )}
    {opencodeClient && capabilities.context && (
      <SheetRow
        label="Agent context"
        trailing="chevron"
        onPress={() => {
          void inspect("context");
        }}
      />
    )}
    {opencodeClient && capabilities.export && (
      <SheetRow
        label="Export session"
        onPress={() => {
          void exportSession();
        }}
      />
    )}
    <SheetRow
      label="Raw session details"
      trailing="chevron"
      onPress={() => setPanel("raw")}
    />
  </SheetGroup>
);

interface ManageSessionProps extends Pick<
  ChatController,
  | "active"
  | "capabilities"
  | "client"
  | "delivery"
  | "onOpenSession"
  | "opencodeClient"
  | "pending"
  | "run"
  | "sessionID"
  | "setPanel"
> {
  session: SessionInfo;
}

export const ManageSession = ({
  active,
  capabilities,
  client,
  delivery,
  onOpenSession,
  opencodeClient,
  pending,
  run,
  session,
  sessionID,
  setPanel,
}: ManageSessionProps) => {
  const removal = useUndoableRemoval<string>("sessions");
  const renameSession = async () => {
    const next = await promptText("Rename session", {
      confirmLabel: "Rename",
      field: {
        defaultValue: sessionLabel(session),
        isValid: (value) => !!value.trim() && value.trim() !== session.title,
        label: "Title",
        returnKeyType: "done",
      },
    });
    if (next !== null) {
      await run(() => client.session.update({ sessionID, title: next }), true);
    }
  };
  const moveSession = async () => {
    if (!opencodeClient) {
      return;
    }
    const directory = await promptText("Move session", {
      confirmLabel: "Move",
      field: {
        autoCapitalize: "none",
        isValid: (value) => value.trim().startsWith("/"),
        keyboardType: "url",
        label: "Server directory",
        placeholder: "/path/to/project",
        returnKeyType: "go",
      },
    });
    if (directory !== null) {
      await run(
        () => opencodeClient.session.move({ delivery, directory, sessionID }),
        true
      );
    }
  };
  const deleteSession = () => {
    if (!opencodeClient) {
      return;
    }
    setPanel(null);
    onOpenSession("");
    removal.remove(sessionID, {
      commit: async () => {
        await opencodeClient.session.remove({ sessionID });
      },
      message: "Session deleted",
      onUndo: () => onOpenSession(sessionID),
    });
  };
  const sourceID = session.parentID || session.fork?.sessionID;
  return (
    <SheetGroup variant="menu" title="Manage">
      {capabilities.rename && (
        <SheetRow
          label="Rename…"
          disabled={pending}
          onPress={() => {
            void renameSession();
          }}
        />
      )}
      {opencodeClient && capabilities.move && (
        <SheetRow
          label="Move to directory…"
          disabled={pending}
          onPress={() => {
            void moveSession();
          }}
        />
      )}
      {capabilities.forkSession && (
        <SheetRow
          label="Fork session"
          disabled={pending}
          onPress={() => {
            void run(async () => {
              const next = await client.session.fork({ sessionID });
              onOpenSession(next.id);
            }, true);
          }}
        />
      )}
      {capabilities.compact && (
        <SheetRow
          label="Compact context"
          disabled={pending}
          onPress={() => {
            void run(
              () => client.session.compact({ delivery: "queue", sessionID }),
              true
            );
          }}
        />
      )}
      {opencodeClient && capabilities.background && active && (
        <SheetRow
          label="Background blocking tools"
          disabled={pending}
          onPress={() => {
            void run(
              () => opencodeClient.session.background({ sessionID }),
              true
            );
          }}
        />
      )}
      {sourceID && (
        <SheetRow
          label="Open source session"
          disabled={pending}
          onPress={() => {
            setPanel(null);
            onOpenSession(sourceID);
          }}
        />
      )}
      {opencodeClient && capabilities.archive && (
        <SheetRow
          label={
            session.time.archived ? "Unarchive session" : "Archive session"
          }
          disabled={pending}
          onPress={() => {
            void run(
              () =>
                opencodeClient.session.update({
                  archived: !session.time.archived,
                  sessionID,
                }),
              true
            );
          }}
        />
      )}
      {opencodeClient && capabilities.remove && (
        <SheetRow
          label="Delete session"
          destructive
          disabled={pending}
          onPress={deleteSession}
        />
      )}
    </SheetGroup>
  );
};

interface ActionsSheetProps extends Pick<
  ChatController,
  | "active"
  | "agents"
  | "capabilities"
  | "client"
  | "currentModel"
  | "delivery"
  | "error"
  | "exportSession"
  | "inspect"
  | "onOpenSession"
  | "opencodeClient"
  | "panel"
  | "pending"
  | "run"
  | "sessionID"
  | "setBackgroundDirectory"
  | "setBackgroundShellID"
  | "setPanel"
  | "setSideQuestion"
> {
  session: SessionInfo;
}

export const ActionsSheet = ({
  active,
  agents,
  capabilities,
  client,
  currentModel,
  delivery,
  error,
  exportSession,
  inspect,
  onOpenSession,
  opencodeClient,
  panel,
  pending,
  run,
  session,
  sessionID,
  setBackgroundDirectory,
  setBackgroundShellID,
  setPanel,
  setSideQuestion,
}: ActionsSheetProps) => (
  <Sheet
    visible={panel === "actions"}
    title="Session"
    fitContent
    contentStyle={SHEET_CONTENT_STYLE}
    onClose={() => setPanel(null)}
  >
    <BodyText numberOfLines={2} selectable style={TITLE_STYLE}>
      {sessionLabel(session)}
    </BodyText>
    <ErrorNotice error={error} />
    <ToolLinks
      capabilities={capabilities}
      inspect={inspect}
      opencodeClient={opencodeClient}
      setBackgroundDirectory={setBackgroundDirectory}
      setBackgroundShellID={setBackgroundShellID}
      setPanel={setPanel}
      setSideQuestion={setSideQuestion}
    />
    <ConfigureLinks
      agents={agents}
      capabilities={capabilities}
      currentModel={currentModel}
      opencodeClient={opencodeClient}
      setPanel={setPanel}
      session={session}
    />
    <DetailLinks
      capabilities={capabilities}
      exportSession={exportSession}
      inspect={inspect}
      opencodeClient={opencodeClient}
      setPanel={setPanel}
    />
    <ManageSession
      active={active}
      capabilities={capabilities}
      client={client}
      delivery={delivery}
      onOpenSession={onOpenSession}
      opencodeClient={opencodeClient}
      pending={pending}
      run={run}
      sessionID={sessionID}
      setPanel={setPanel}
      session={session}
    />
  </Sheet>
);
